from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import httpx

# Импорт модулей парсера и моделей
from rudn_parser import (
    get_facultets,
    get_filter_data,
    extract_options,
    get_schedule
)
from models import (
    Faculty,
    FilterDataRequest,
    FilterDataResponse,
    FilterOption,
    ScheduleRequest,
    ScheduleResponse,
    ScheduleEvent,
    UserSettings,
    UserSettingsCreate,
    UserSettingsResponse,
    ErrorResponse,
    SuccessResponse,
    NotificationSettingsUpdate,
    NotificationSettingsResponse,
    Achievement,
    UserAchievement,
    UserAchievementResponse,
    UserStats,
    UserStatsResponse,
    TrackActionRequest,
    NewAchievementsResponse,
    WeatherResponse,
    BotInfo,
    Task,
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    TaskReorderItem,
    TaskReorderRequest
)
from notifications import get_notification_service
from scheduler import get_scheduler
from cache import cache
from achievements import (
    get_all_achievements,
    get_user_achievements,
    track_user_action,
    get_or_create_user_stats,
    mark_achievements_as_seen
)
from weather import get_moscow_weather


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging early
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="RUDN Schedule API", version="1.0.0")

# Configure CORS middleware BEFORE adding routes
# When allow_credentials=True, we cannot use "*" for origins
cors_origins_str = os.environ.get('CORS_ORIGINS', '*')
cors_origins_list = [origin.strip() for origin in cors_origins_str.split(',')]

# Check if "*" is in the list
if '*' in cors_origins_list:
    # If "*" is specified, use it without credentials
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=False,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
        max_age=3600,
    )
    logger.info("CORS configured with wildcard (*) - all origins allowed without credentials")
else:
    # If specific origins are provided, enable credentials
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=cors_origins_list,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
        max_age=3600,
    )
    logger.info(f"CORS configured for specific origins: {cors_origins_list}")

# Additional middleware to ensure CORS headers are always present
@app.middleware("http")
async def add_cors_headers(request, call_next):
    response = await call_next(request)
    origin = request.headers.get("origin")
    
    # Always add CORS headers
    if not response.headers.get("access-control-allow-origin"):
        response.headers["access-control-allow-origin"] = "*"
    if not response.headers.get("access-control-allow-methods"):
        response.headers["access-control-allow-methods"] = "DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT"
    if not response.headers.get("access-control-allow-headers"):
        response.headers["access-control-allow-headers"] = "*"
    if not response.headers.get("access-control-max-age"):
        response.headers["access-control-max-age"] = "3600"
        
    return response

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models (старые для совместимости)
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# ============ Старые эндпоинты ============
@api_router.get("/")
async def root():
    return {"message": "RUDN Schedule API is running"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]


# ============ Эндпоинты для расписания ============

@api_router.get("/faculties", response_model=List[Faculty])
async def get_faculties():
    """Получить список всех факультетов (с кешированием на 60 минут)"""
    try:
        # Проверяем кеш
        cached_faculties = cache.get("faculties")
        if cached_faculties:
            return cached_faculties
            
        # Если нет в кеше, получаем из API
        faculties = await get_facultets()
        if not faculties:
            raise HTTPException(status_code=404, detail="Факультеты не найдены")
        
        # Сохраняем в кеш на 60 минут
        cache.set("faculties", faculties, ttl_minutes=60)
        return faculties
    except Exception as e:
        logger.error(f"Ошибка при получении факультетов: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/filter-data", response_model=FilterDataResponse)
async def get_filter_data_endpoint(request: FilterDataRequest):
    """Получить данные фильтров (уровни, курсы, формы, группы)"""
    try:
        elements = await get_filter_data(
            facultet_id=request.facultet_id,
            level_id=request.level_id or "",
            kurs=request.kurs or "",
            form_code=request.form_code or ""
        )
        
        response = FilterDataResponse(
            levels=extract_options(elements, "level"),
            courses=extract_options(elements, "kurs"),
            forms=extract_options(elements, "form"),
            groups=extract_options(elements, "group")
        )
        
        return response
    except Exception as e:
        logger.error(f"Ошибка при получении данных фильтра: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/schedule", response_model=ScheduleResponse)
async def get_schedule_endpoint(request: ScheduleRequest):
    """Получить расписание для группы"""
    try:
        events = await get_schedule(
            facultet_id=request.facultet_id,
            level_id=request.level_id,
            kurs=request.kurs,
            form_code=request.form_code,
            group_id=request.group_id,
            week_number=request.week_number
        )
        
        # Кэшируем расписание
        cache_data = {
            "id": str(uuid.uuid4()),
            "group_id": request.group_id,
            "week_number": request.week_number,
            "events": [event for event in events],
            "cached_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(hours=1)
        }
        
        await db.schedule_cache.update_one(
            {"group_id": request.group_id, "week_number": request.week_number},
            {"$set": cache_data},
            upsert=True
        )
        
        return ScheduleResponse(
            events=[ScheduleEvent(**event) for event in events],
            group_id=request.group_id,
            week_number=request.week_number
        )
    except Exception as e:
        logger.error(f"Ошибка при получении расписания: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ Эндпоинты для пользовательских настроек ============

@api_router.get("/user-settings/{telegram_id}", response_model=UserSettingsResponse)
async def get_user_settings(telegram_id: int):
    """Получить настройки пользователя по Telegram ID"""
    try:
        user_data = await db.user_settings.find_one({"telegram_id": telegram_id})
        
        if not user_data:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Обновляем время последней активности
        await db.user_settings.update_one(
            {"telegram_id": telegram_id},
            {"$set": {"last_activity": datetime.utcnow()}}
        )
        
        return UserSettingsResponse(**user_data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении настроек пользователя: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/user-settings", response_model=UserSettingsResponse)
async def save_user_settings(settings: UserSettingsCreate):
    """Сохранить или обновить настройки пользователя"""
    try:
        # Проверяем, существует ли пользователь
        existing_user = await db.user_settings.find_one({"telegram_id": settings.telegram_id})
        
        if existing_user:
            # Обновляем существующего пользователя
            update_data = settings.dict()
            update_data["updated_at"] = datetime.utcnow()
            update_data["last_activity"] = datetime.utcnow()
            
            await db.user_settings.update_one(
                {"telegram_id": settings.telegram_id},
                {"$set": update_data}
            )
            
            user_data = await db.user_settings.find_one({"telegram_id": settings.telegram_id})
            return UserSettingsResponse(**user_data)
        else:
            # Создаем нового пользователя
            user_settings = UserSettings(**settings.dict())
            user_dict = user_settings.dict()
            
            await db.user_settings.insert_one(user_dict)
            
            return UserSettingsResponse(**user_dict)
    except Exception as e:
        logger.error(f"Ошибка при сохранении настроек пользователя: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/user-settings/{telegram_id}", response_model=SuccessResponse)
async def delete_user_settings(telegram_id: int):
    """Удалить настройки пользователя"""
    try:
        result = await db.user_settings.delete_one({"telegram_id": telegram_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        return SuccessResponse(success=True, message="Настройки пользователя удалены")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при удалении настроек пользователя: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/schedule-cached/{group_id}/{week_number}", response_model=Optional[ScheduleResponse])
async def get_cached_schedule(group_id: str, week_number: int):
    """Получить кэшированное расписание"""
    try:
        cached = await db.schedule_cache.find_one({
            "group_id": group_id,
            "week_number": week_number,
            "expires_at": {"$gt": datetime.utcnow()}
        })
        
        if not cached:
            return None
        
        return ScheduleResponse(
            events=[ScheduleEvent(**event) for event in cached["events"]],
            group_id=cached["group_id"],
            week_number=cached["week_number"]
        )
    except Exception as e:
        logger.error(f"Ошибка при получении кэша: {e}")
        return None


# ============ Эндпоинты для управления уведомлениями ============

@api_router.put("/user-settings/{telegram_id}/notifications", response_model=NotificationSettingsResponse)
async def update_notification_settings(telegram_id: int, settings: NotificationSettingsUpdate):
    """Обновить настройки уведомлений пользователя"""
    try:
        # Проверяем существование пользователя
        user = await db.user_settings.find_one({"telegram_id": telegram_id})
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Обновляем настройки уведомлений
        await db.user_settings.update_one(
            {"telegram_id": telegram_id},
            {"$set": {
                "notifications_enabled": settings.notifications_enabled,
                "notification_time": settings.notification_time,
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Если уведомления включены, отправляем тестовое уведомление
        test_notification_sent = None
        test_notification_error = None
        
        if settings.notifications_enabled:
            try:
                notification_service = get_notification_service()
                success = await notification_service.send_test_notification(telegram_id)
                test_notification_sent = success
                if not success:
                    test_notification_error = "Не удалось отправить тестовое уведомление. Убедитесь, что вы начали диалог с ботом командой /start"
            except Exception as e:
                logger.warning(f"Failed to send test notification: {e}")
                test_notification_sent = False
                test_notification_error = f"Ошибка: {str(e)}. Пожалуйста, начните диалог с ботом командой /start в Telegram"
        
        return NotificationSettingsResponse(
            notifications_enabled=settings.notifications_enabled,
            notification_time=settings.notification_time,
            telegram_id=telegram_id,
            test_notification_sent=test_notification_sent,
            test_notification_error=test_notification_error
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при обновлении настроек уведомлений: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/user-settings/{telegram_id}/notifications", response_model=NotificationSettingsResponse)
async def get_notification_settings(telegram_id: int):
    """Получить настройки уведомлений пользователя"""
    try:
        user = await db.user_settings.find_one({"telegram_id": telegram_id})
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        return NotificationSettingsResponse(
            notifications_enabled=user.get("notifications_enabled", False),
            notification_time=user.get("notification_time", 10),
            telegram_id=telegram_id
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении настроек уведомлений: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ Эндпоинты для достижений ============

@api_router.get("/achievements", response_model=List[Achievement])
async def get_achievements():
    """Получить список всех достижений"""
    try:
        achievements = get_all_achievements()
        return achievements
    except Exception as e:
        logger.error(f"Ошибка при получении достижений: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/user-achievements/{telegram_id}", response_model=List[UserAchievementResponse])
async def get_user_achievements_endpoint(telegram_id: int):
    """Получить достижения пользователя"""
    try:
        achievements = await get_user_achievements(db, telegram_id)
        return achievements
    except Exception as e:
        logger.error(f"Ошибка при получении достижений пользователя: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/user-stats/{telegram_id}", response_model=UserStatsResponse)
async def get_user_stats_endpoint(telegram_id: int):
    """Получить статистику пользователя"""
    try:
        stats = await get_or_create_user_stats(db, telegram_id)
        return UserStatsResponse(
            telegram_id=stats.telegram_id,
            groups_viewed=stats.groups_viewed,
            friends_invited=stats.friends_invited,
            schedule_views=stats.schedule_views,
            night_usage_count=stats.night_usage_count,
            early_usage_count=stats.early_usage_count,
            total_points=stats.total_points,
            achievements_count=stats.achievements_count
        )
    except Exception as e:
        logger.error(f"Ошибка при получении статистики пользователя: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/track-action", response_model=NewAchievementsResponse)
async def track_action_endpoint(request: TrackActionRequest):
    """Отследить действие пользователя и проверить достижения"""
    try:
        # Отслеживаем действие и проверяем достижения
        new_achievements = await track_user_action(
            db,
            request.telegram_id,
            request.action_type,
            request.metadata
        )
        
        return new_achievements
    except Exception as e:
        logger.error(f"Ошибка при отслеживании действия: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/user-achievements/{telegram_id}/mark-seen", response_model=SuccessResponse)
async def mark_achievements_seen_endpoint(telegram_id: int):
    """Отметить все достижения как просмотренные"""
    try:
        await mark_achievements_as_seen(db, telegram_id)
        return SuccessResponse(success=True, message="Достижения отмечены как просмотренные")
    except Exception as e:
        logger.error(f"Ошибка при отметке достижений: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ Эндпоинты для погоды ============

@api_router.get("/weather", response_model=WeatherResponse)
async def get_weather_endpoint():
    """Получить текущую погоду в Москве (с кешированием на 10 минут)"""
    # Проверяем кеш
    cached_weather = cache.get("weather")
    if cached_weather:
        return cached_weather
    
    try:
        weather = await get_moscow_weather()
        
        if not weather:
            # Возвращаем mock данные вместо ошибки
            logger.warning("Weather API недоступен, возвращаем mock данные")
            weather = WeatherResponse(
                temperature=5,
                feels_like=2,
                humidity=85,
                wind_speed=15,
                description="Облачно",
                icon="☁️"
            )
        
        # Кешируем результат на 10 минут
        cache.set("weather", weather, ttl_minutes=10)
        return weather
    except Exception as e:
        logger.error(f"Ошибка при получении погоды: {e}")
        # Возвращаем mock данные вместо ошибки
        return WeatherResponse(
            temperature=5,
            feels_like=2,
            humidity=85,
            wind_speed=15,
            description="Облачно",
            icon="☁️"
        )


# ============ Эндпоинты для информации о боте ============

@api_router.get("/bot-info", response_model=BotInfo)
async def get_bot_info():
    """Получить информацию о боте (username, id и т.д.) с кешированием на 1 час"""
    # Проверяем кеш
    cached_bot_info = cache.get("bot_info")
    if cached_bot_info:
        return cached_bot_info
    
    try:
        from telegram import Bot
        
        bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
        if not bot_token:
            raise HTTPException(status_code=500, detail="Bot token не настроен")
        
        bot = Bot(token=bot_token)
        me = await bot.get_me()
        
        bot_info = BotInfo(
            username=me.username or "",
            first_name=me.first_name,
            id=me.id,
            can_join_groups=me.can_join_groups or False,
            can_read_all_group_messages=me.can_read_all_group_messages or False,
            supports_inline_queries=me.supports_inline_queries or False
        )
        
        # Кешируем на 1 час
        cache.set("bot_info", bot_info, ttl_minutes=60)
        return bot_info
    except Exception as e:
        logger.error(f"Ошибка при получении информации о боте: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/user-profile-photo/{telegram_id}")
async def get_user_profile_photo(telegram_id: int):
    """Получить URL фото профиля пользователя из Telegram"""
    try:
        from telegram import Bot
        
        bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
        if not bot_token:
            return JSONResponse({"photo_url": None})
        
        bot = Bot(token=bot_token)
        
        # Получаем фото профиля пользователя
        photos = await bot.get_user_profile_photos(telegram_id, limit=1)
        
        if photos.total_count > 0:
            # Берём самое большое фото (последнее в списке sizes)
            photo = photos.photos[0][-1]
            file = await bot.get_file(photo.file_id)
            
            # file.file_path может быть как полным URL, так и просто путём
            # Проверяем, если это уже URL, используем его, иначе формируем полный URL
            if file.file_path.startswith('http'):
                full_url = file.file_path
            else:
                full_url = f"https://api.telegram.org/file/bot{bot_token}/{file.file_path}"
            
            logger.info(f"Profile photo URL for {telegram_id}: {full_url}")
            return JSONResponse({"photo_url": full_url})
        else:
            return JSONResponse({"photo_url": None})
            
    except Exception as e:
        logger.error(f"Ошибка при получении фото профиля: {e}")
        return JSONResponse({"photo_url": None})


@api_router.get("/user-profile-photo-proxy/{telegram_id}")
async def get_user_profile_photo_proxy(telegram_id: int):
    """Получить фото профиля пользователя через прокси (для обхода CORS)"""
    try:
        from telegram import Bot
        
        bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
        if not bot_token:
            raise HTTPException(status_code=404, detail="Bot token not configured")
        
        bot = Bot(token=bot_token)
        
        # Получаем фото профиля пользователя
        photos = await bot.get_user_profile_photos(telegram_id, limit=1)
        
        if photos.total_count > 0:
            # Берём самое большое фото (последнее в списке sizes)
            photo = photos.photos[0][-1]
            file = await bot.get_file(photo.file_id)
            
            # Формируем URL для загрузки
            if file.file_path.startswith('http'):
                image_url = file.file_path
            else:
                image_url = f"https://api.telegram.org/file/bot{bot_token}/{file.file_path}"
            
            # Загружаем изображение
            async with httpx.AsyncClient() as client:
                response = await client.get(image_url)
                if response.status_code == 200:
                    # Возвращаем изображение с правильным content-type
                    return StreamingResponse(
                        iter([response.content]),
                        media_type=response.headers.get('content-type', 'image/jpeg'),
                        headers={
                            'Cache-Control': 'public, max-age=86400',  # Кешируем на 24 часа
                        }
                    )
        
        raise HTTPException(status_code=404, detail="Profile photo not found")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при проксировании фото профиля: {e}")
        raise HTTPException(status_code=500, detail="Failed to load profile photo")


# ============ Эндпоинты для списка дел ============

@api_router.get("/tasks/{telegram_id}", response_model=List[TaskResponse])
async def get_user_tasks(telegram_id: int):
    """Получить все задачи пользователя"""
    try:
        # Сортируем по order (порядок drag & drop), затем по created_at
        tasks = await db.tasks.find({"telegram_id": telegram_id}).sort([("order", 1), ("created_at", -1)]).to_list(1000)
        return [TaskResponse(**task) for task in tasks]
    except Exception as e:
        logger.error(f"Ошибка при получении задач: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/tasks", response_model=TaskResponse)
async def create_task(task_data: TaskCreate):
    """Создать новую задачу"""
    try:
        # Получаем максимальный order для данного пользователя
        max_order_task = await db.tasks.find_one(
            {"telegram_id": task_data.telegram_id},
            sort=[("order", -1)]
        )
        
        # Присваиваем order = max + 1 (или 0, если задач нет)
        next_order = (max_order_task.get("order", -1) + 1) if max_order_task else 0
        
        task = Task(**task_data.dict(), order=next_order)
        task_dict = task.dict()
        
        await db.tasks.insert_one(task_dict)
        
        return TaskResponse(**task_dict)
    except Exception as e:
        logger.error(f"Ошибка при создании задачи: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, task_update: TaskUpdate):
    """Обновить задачу (все поля опциональны)"""
    try:
        # Проверяем существование задачи
        existing_task = await db.tasks.find_one({"id": task_id})
        
        if not existing_task:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        
        # Обновляем только переданные поля
        update_data = {}
        if task_update.text is not None:
            update_data["text"] = task_update.text
        if task_update.completed is not None:
            update_data["completed"] = task_update.completed
        if task_update.category is not None:
            update_data["category"] = task_update.category
        if task_update.priority is not None:
            update_data["priority"] = task_update.priority
        if task_update.deadline is not None:
            update_data["deadline"] = task_update.deadline
        if task_update.target_date is not None:
            update_data["target_date"] = task_update.target_date
        if task_update.subject is not None:
            update_data["subject"] = task_update.subject
        if task_update.discipline_id is not None:
            update_data["discipline_id"] = task_update.discipline_id
        if task_update.order is not None:
            update_data["order"] = task_update.order
        
        update_data["updated_at"] = datetime.utcnow()
        
        await db.tasks.update_one(
            {"id": task_id},
            {"$set": update_data}
        )
        
        # Получаем обновленную задачу
        updated_task = await db.tasks.find_one({"id": task_id})
        
        return TaskResponse(**updated_task)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при обновлении задачи: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/tasks/{task_id}", response_model=SuccessResponse)
async def delete_task(task_id: str):
    """Удалить задачу"""
    try:
        result = await db.tasks.delete_one({"id": task_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        
        return SuccessResponse(success=True, message="Задача удалена")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при удалении задачи: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/tasks/reorder", response_model=SuccessResponse)
async def reorder_tasks(request: TaskReorderRequest):
    """
    Обновить порядок задач (batch update)
    Принимает объект с массивом: {"tasks": [{"id": "task_id", "order": 0}, ...]}
    """
    try:
        # Обновляем order для каждой задачи
        for task_order in request.tasks:
            await db.tasks.update_one(
                {"id": task_order.id},
                {"$set": {"order": task_order.order, "updated_at": datetime.utcnow()}}
            )
        
        return SuccessResponse(success=True, message=f"Обновлен порядок {len(request.tasks)} задач")
    except Exception as e:
        logger.error(f"Ошибка при изменении порядка задач: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# Include the router in the main app
app.include_router(api_router)


# ============ События жизненного цикла приложения ============

@app.on_event("startup")
async def startup_event():
    """Инициализация при запуске приложения"""
    logger.info("Starting RUDN Schedule API...")
    
    # Запускаем планировщик уведомлений
    try:
        scheduler = get_scheduler(db)
        scheduler.start()
        logger.info("Notification scheduler started successfully")
    except Exception as e:
        logger.error(f"Failed to start notification scheduler: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    """Очистка ресурсов при остановке"""
    logger.info("Shutting down RUDN Schedule API...")
    
    # Останавливаем планировщик
    try:
        scheduler = get_scheduler(db)
        scheduler.stop()
        logger.info("Notification scheduler stopped")
    except Exception as e:
        logger.error(f"Error stopping scheduler: {e}")
    
    # Закрываем подключение к БД
    client.close()
    logger.info("Database connection closed")
