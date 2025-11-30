from fastapi import FastAPI, APIRouter, HTTPException, Body
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
import asyncio
import threading

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
    NotificationStatsResponse,
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
    TaskReorderRequest,
    GroupTask,
    GroupTaskCreate,
    GroupTaskResponse,
    GroupTaskParticipant,
    GroupTaskComment,
    GroupTaskCommentCreate,
    GroupTaskCommentResponse,
    GroupTaskInvite,
    GroupTaskInviteCreate,
    GroupTaskInviteResponse,
    GroupTaskCompleteRequest,
    Room,
    RoomCreate,
    RoomResponse,
    RoomParticipant,
    RoomInviteLinkResponse,
    RoomJoinRequest,
    RoomTaskCreate,
    AdminStatsResponse,
    UserActivityPoint,
    HourlyActivityPoint,
    FeatureUsageStats,
    TopUser,
    FacultyStats,
    CourseStats,
    Subtask,
    SubtaskCreate,
    SubtaskUpdate,
    GroupTaskUpdate,
    RoomActivity,
    RoomActivityResponse,
    RoomStatsResponse,
    ParticipantRoleUpdate,
    RoomUpdate,
    TaskReorderRequest as RoomTaskReorderRequest,
    ReferralUser,
    ReferralStats,
    ReferralTreeNode,
    ReferralCodeResponse,
    ReferralConnection
)
from notifications import get_notification_service
from scheduler import get_scheduler  # Старая система (резерв)
from scheduler_v2 import get_scheduler_v2  # Новая улучшенная система
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

# Global bot application instance
bot_application = None

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
        
        # Попытка запланировать уведомления для пользователей этой группы, у которых включены уведомления
        # (В реальном production лучше делать это фоновой задачей, но для MVP можно и так)
        try:
            # Запускаем в фоне, чтобы не тормозить ответ
            async def schedule_for_group():
                users = await db.user_settings.find({
                    "group_id": request.group_id,
                    "notifications_enabled": True
                }).to_list(None)
                
                if users:
                    scheduler = get_scheduler_v2(db)
                    for user in users:
                        await scheduler.schedule_user_notifications(user['telegram_id'])
            
            asyncio.create_task(schedule_for_group())
        except Exception as e:
            logger.error(f"Failed to trigger group scheduling: {e}")
        
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
        
        # Конвертируем _id в строку для поля id
        if "_id" in user_data:
            user_data["id"] = str(user_data["_id"])
            del user_data["_id"]
        
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
            
            # Пересчитываем уведомления при обновлении настроек (например, смена группы)
            try:
                scheduler = get_scheduler_v2(db)
                await scheduler.schedule_user_notifications(settings.telegram_id)
            except Exception as e:
                logger.error(f"Failed to reschedule notifications on settings update: {e}")
            
            user_data = await db.user_settings.find_one({"telegram_id": settings.telegram_id})
            return UserSettingsResponse(**user_data)
        else:
            # Создаем нового пользователя
            user_settings = UserSettings(**settings.dict())
            user_dict = user_settings.dict()
            
            await db.user_settings.insert_one(user_dict)
            
            # Если у нового пользователя включены уведомления (вдруг), планируем их
            if user_settings.notifications_enabled:
                try:
                    scheduler = get_scheduler_v2(db)
                    await scheduler.schedule_user_notifications(settings.telegram_id)
                except Exception as e:
                    logger.error(f"Failed to schedule notifications for new user: {e}")
            
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
        
        # Если уведомления включены, отправляем тестовое уведомление и планируем реальные
        test_notification_sent = None
        test_notification_error = None
        
        if settings.notifications_enabled:
            # 1. Отправляем тестовое (сразу)
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
            
            # 2. Планируем уведомления на сегодня (асинхронно)
            try:
                scheduler = get_scheduler_v2(db)
                stats = await scheduler.schedule_user_notifications(telegram_id)
                logger.info(f"Scheduled {stats.get('scheduled', 0)} notifications for user {telegram_id}")
            except Exception as e:
                logger.error(f"Failed to schedule notifications after enabling: {e}")
        
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


@api_router.get("/notifications/stats", response_model=NotificationStatsResponse)
async def get_notification_stats(date: Optional[str] = None):
    """
    Получить статистику уведомлений за день
    
    Args:
        date: Дата в формате YYYY-MM-DD (по умолчанию - сегодня)
    """
    try:
        scheduler_v2 = get_scheduler_v2(db)
        stats = await scheduler_v2.get_notification_stats(date)
        
        if not stats:
            # Возвращаем пустую статистику
            from datetime import datetime
            import pytz
            today = datetime.now(pytz.timezone('Europe/Moscow')).strftime('%Y-%m-%d') if not date else date
            return NotificationStatsResponse(
                date=today,
                total=0,
                pending=0,
                sent=0,
                failed=0,
                cancelled=0
            )
        
        return NotificationStatsResponse(**stats)
    except Exception as e:
        logger.error(f"Ошибка при получении статистики уведомлений: {e}")
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
            detailed_views=stats.detailed_views,
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
        
        # Отслеживаем создание задачи для достижений
        await track_user_action(
            db, 
            task_data.telegram_id, 
            "create_task",
            metadata={}
        )
        
        return TaskResponse(**task_dict)
    except Exception as e:
        logger.error(f"Ошибка при создании задачи: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/tasks/reorder", response_model=SuccessResponse)
async def reorder_tasks(request: TaskReorderRequest):
    """
    Обновить порядок задач (batch update)
    Принимает объект с массивом: {"tasks": [{"id": "task_id", "order": 0}, ...]}
    ВАЖНО: Этот роут должен быть ПЕРЕД /tasks/{task_id} чтобы избежать конфликта
    """
    try:
        logger.info(f"🔄 Reordering {len(request.tasks)} tasks...")
        
        # Обновляем order для каждой задачи
        updated_count = 0
        for task_order in request.tasks:
            logger.info(f"  Updating task {task_order.id} to order {task_order.order}")
            
            result = await db.tasks.update_one(
                {"id": task_order.id},
                {"$set": {"order": task_order.order, "updated_at": datetime.utcnow()}}
            )
            
            if result.modified_count > 0:
                updated_count += 1
                logger.info(f"    ✅ Task {task_order.id} updated")
            else:
                logger.warning(f"    ⚠️ Task {task_order.id} not found or not modified")
        
        logger.info(f"✅ Successfully updated {updated_count} out of {len(request.tasks)} tasks")
        return SuccessResponse(success=True, message=f"Обновлен порядок {updated_count} задач")
    except Exception as e:
        logger.error(f"❌ Ошибка при изменении порядка задач: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, task_update: TaskUpdate):
    """Обновить задачу (все поля опциональны)"""
    try:
        # Проверяем существование задачи
        existing_task = await db.tasks.find_one({"id": task_id})
        
        if not existing_task:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        
        # Проверяем, если задача отмечается как выполненная
        was_incomplete = not existing_task.get("completed", False)
        is_completing = task_update.completed is True and was_incomplete
        
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
        
        # Если задача была выполнена, отслеживаем для достижений
        if is_completing:
            current_hour = datetime.utcnow().hour
            
            # Проверяем, выполнена ли в срок (до дедлайна или без дедлайна)
            deadline = existing_task.get("deadline")
            on_time = True  # По умолчанию считаем в срок
            
            if deadline:
                # Если есть дедлайн, проверяем
                if isinstance(deadline, str):
                    deadline = datetime.fromisoformat(deadline.replace('Z', '+00:00'))
                on_time = datetime.utcnow() <= deadline
            
            # Отслеживаем выполнение задачи
            await track_user_action(
                db,
                existing_task["telegram_id"],
                "complete_task",
                metadata={
                    "hour": current_hour,
                    "on_time": on_time
                }
            )
        
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


# ============ API для групповых задач ============

@api_router.post("/group-tasks", response_model=GroupTaskResponse)
async def create_group_task(task_data: GroupTaskCreate):
    """Создать новую групповую задачу"""
    try:
        # Получаем информацию о создателе
        creator_settings = await db.user_settings.find_one({"telegram_id": task_data.telegram_id})
        if not creator_settings:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Создаём участника-владельца
        owner_participant = GroupTaskParticipant(
            telegram_id=task_data.telegram_id,
            username=creator_settings.get('username'),
            first_name=creator_settings.get('first_name', 'Пользователь'),
            role='owner'
        )
        
        # Создаём групповую задачу
        group_task = GroupTask(
            title=task_data.title,
            description=task_data.description,
            deadline=task_data.deadline,
            category=task_data.category,
            priority=task_data.priority,
            owner_id=task_data.telegram_id,
            participants=[owner_participant],
            status='created'
        )
        
        # Сохраняем в БД
        await db.group_tasks.insert_one(group_task.model_dump())
        
        # Создаём приглашения для указанных пользователей
        for invited_user_id in task_data.invited_users:
            invite = GroupTaskInvite(
                task_id=group_task.task_id,
                invited_by=task_data.telegram_id,
                invited_user=invited_user_id,
                status='pending'
            )
            await db.group_task_invites.insert_one(invite.model_dump())
        
        # Формируем ответ
        total_participants = len(group_task.participants)
        completed_participants = sum(1 for p in group_task.participants if p.completed)
        completion_percentage = int((completed_participants / total_participants * 100) if total_participants > 0 else 0)
        
        return GroupTaskResponse(
            **group_task.model_dump(),
            completion_percentage=completion_percentage,
            total_participants=total_participants,
            completed_participants=completed_participants
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при создании групповой задачи: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/group-tasks/{telegram_id}", response_model=List[GroupTaskResponse])
async def get_user_group_tasks(telegram_id: int):
    """Получить все групповые задачи пользователя"""
    try:
        # Находим все задачи, где пользователь является участником
        tasks_cursor = db.group_tasks.find({
            "participants.telegram_id": telegram_id
        })
        
        tasks = []
        async for task_doc in tasks_cursor:
            # Проверяем статус и обновляем при необходимости
            task = GroupTask(**task_doc)
            
            # Обновляем статус на overdue если дедлайн прошёл
            if task.deadline and task.deadline < datetime.utcnow() and task.status not in ['completed', 'overdue']:
                task.status = 'overdue'
                await db.group_tasks.update_one(
                    {"task_id": task.task_id},
                    {"$set": {"status": "overdue"}}
                )
            
            # Проверяем, все ли выполнили задачу
            total_participants = len(task.participants)
            completed_participants = sum(1 for p in task.participants if p.completed)
            
            if total_participants > 0 and completed_participants == total_participants and task.status != 'completed':
                task.status = 'completed'
                await db.group_tasks.update_one(
                    {"task_id": task.task_id},
                    {"$set": {"status": "completed"}}
                )
            elif completed_participants > 0 and task.status == 'created':
                task.status = 'in_progress'
                await db.group_tasks.update_one(
                    {"task_id": task.task_id},
                    {"$set": {"status": "in_progress"}}
                )
            
            completion_percentage = int((completed_participants / total_participants * 100) if total_participants > 0 else 0)
            
            tasks.append(GroupTaskResponse(
                **task.model_dump(),
                completion_percentage=completion_percentage,
                total_participants=total_participants,
                completed_participants=completed_participants
            ))
        
        return tasks
    except Exception as e:
        logger.error(f"Ошибка при получении групповых задач: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/group-tasks/detail/{task_id}", response_model=GroupTaskResponse)
async def get_group_task_detail(task_id: str):
    """Получить детальную информацию о групповой задаче"""
    try:
        task_doc = await db.group_tasks.find_one({"task_id": task_id})
        
        if not task_doc:
            raise HTTPException(status_code=404, detail="Групповая задача не найдена")
        
        task = GroupTask(**task_doc)
        
        total_participants = len(task.participants)
        completed_participants = sum(1 for p in task.participants if p.completed)
        completion_percentage = int((completed_participants / total_participants * 100) if total_participants > 0 else 0)
        
        return GroupTaskResponse(
            **task.model_dump(),
            completion_percentage=completion_percentage,
            total_participants=total_participants,
            completed_participants=completed_participants
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении деталей групповой задачи: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/group-tasks/{task_id}/invite", response_model=SuccessResponse)
async def invite_to_group_task(task_id: str, invite_data: GroupTaskInviteCreate):
    """Пригласить пользователя в групповую задачу"""
    try:
        # Проверяем существование задачи
        task_doc = await db.group_tasks.find_one({"task_id": task_id})
        if not task_doc:
            raise HTTPException(status_code=404, detail="Групповая задача не найдена")
        
        task = GroupTask(**task_doc)
        
        # Проверяем, что приглашающий является участником
        is_participant = any(p.telegram_id == invite_data.telegram_id for p in task.participants)
        if not is_participant:
            raise HTTPException(status_code=403, detail="Только участники могут приглашать других")
        
        # Проверяем лимит участников
        if len(task.participants) >= 10:
            raise HTTPException(status_code=400, detail="Достигнут лимит участников (10)")
        
        # Проверяем, не приглашён ли уже пользователь
        already_invited = await db.group_task_invites.find_one({
            "task_id": task_id,
            "invited_user": invite_data.invited_user,
            "status": "pending"
        })
        if already_invited:
            raise HTTPException(status_code=400, detail="Приглашение уже отправлено")
        
        # Проверяем, не является ли пользователь уже участником
        is_already_participant = any(p.telegram_id == invite_data.invited_user for p in task.participants)
        if is_already_participant:
            raise HTTPException(status_code=400, detail="Пользователь уже является участником")
        
        # Создаём приглашение
        invite = GroupTaskInvite(
            task_id=task_id,
            invited_by=invite_data.telegram_id,
            invited_user=invite_data.invited_user,
            status='pending'
        )
        
        await db.group_task_invites.insert_one(invite.model_dump())
        
        return SuccessResponse(success=True, message="Приглашение отправлено")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при приглашении в групповую задачу: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/group-tasks/invites/{telegram_id}", response_model=List[GroupTaskInviteResponse])
async def get_user_invites(telegram_id: int):
    """Получить все приглашения пользователя"""
    try:
        invites_cursor = db.group_task_invites.find({
            "invited_user": telegram_id,
            "status": "pending"
        })
        
        invites = []
        async for invite_doc in invites_cursor:
            invite = GroupTaskInvite(**invite_doc)
            
            # Получаем информацию о задаче
            task_doc = await db.group_tasks.find_one({"task_id": invite.task_id})
            if not task_doc:
                continue
            
            task = GroupTask(**task_doc)
            
            # Получаем информацию о пригласившем
            inviter = next((p for p in task.participants if p.telegram_id == invite.invited_by), None)
            inviter_name = inviter.first_name if inviter else "Пользователь"
            
            invites.append(GroupTaskInviteResponse(
                invite_id=invite.invite_id,
                task_id=invite.task_id,
                task_title=task.title,
                invited_by=invite.invited_by,
                invited_by_name=inviter_name,
                status=invite.status,
                created_at=invite.created_at
            ))
        
        return invites
    except Exception as e:
        logger.error(f"Ошибка при получении приглашений: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/notifications/test", response_model=SuccessResponse)
async def send_test_notification_endpoint(telegram_id: int = Body(..., embed=True)):
    """Отправить тестовое уведомление о паре в Telegram"""
    try:
        service = get_notification_service()
        
        # Тестовые данные о паре
        dummy_class = {
            "discipline": "Тестовая пара (Test Subject)",
            "time": "10:00 - 11:30",
            "teacher": "Тестовый Преподаватель",
            "auditory": "Кабинет 101",
            "lessonType": "Лекция"
        }
        
        success = await service.send_class_notification(
            telegram_id=telegram_id,
            class_info=dummy_class,
            minutes_before=10
        )
        
        if success:
            return SuccessResponse(success=True, message="Тестовое уведомление отправлено в Telegram")
        else:
            # Даже если не удалось отправить в телеграм (например, бот заблокирован), возвращаем ошибку 500
            raise HTTPException(status_code=500, detail="Не удалось отправить уведомление (возможно, бот заблокирован пользователем)")
            
    except Exception as e:
        logger.error(f"Ошибка при отправке тестового уведомления: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@api_router.post("/group-tasks/{task_id}/accept", response_model=SuccessResponse)
async def accept_group_task_invite(task_id: str, telegram_id: int = Body(..., embed=True)):
    """Принять приглашение в групповую задачу"""
    try:
        # Находим приглашение
        invite_doc = await db.group_task_invites.find_one({
            "task_id": task_id,
            "invited_user": telegram_id,
            "status": "pending"
        })
        
        if not invite_doc:
            raise HTTPException(status_code=404, detail="Приглашение не найдено")
        
        # Получаем задачу
        task_doc = await db.group_tasks.find_one({"task_id": task_id})
        if not task_doc:
            raise HTTPException(status_code=404, detail="Групповая задача не найдена")
        
        # Получаем информацию о пользователе
        user_settings = await db.user_settings.find_one({"telegram_id": telegram_id})
        if not user_settings:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Создаём участника
        new_participant = GroupTaskParticipant(
            telegram_id=telegram_id,
            username=user_settings.get('username'),
            first_name=user_settings.get('first_name', 'Пользователь'),
            role='member'
        )
        
        # Добавляем участника в задачу
        await db.group_tasks.update_one(
            {"task_id": task_id},
            {"$push": {"participants": new_participant.model_dump()}}
        )
        
        # Обновляем статус приглашения
        await db.group_task_invites.update_one(
            {"_id": invite_doc["_id"]},
            {
                "$set": {
                    "status": "accepted",
                    "responded_at": datetime.utcnow()
                }
            }
        )
        
        return SuccessResponse(success=True, message="Вы присоединились к групповой задаче")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при принятии приглашения: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/group-tasks/{task_id}/decline", response_model=SuccessResponse)
async def decline_group_task_invite(task_id: str, telegram_id: int = Body(..., embed=True)):
    """Отклонить приглашение в групповую задачу"""
    try:
        # Находим приглашение
        invite_doc = await db.group_task_invites.find_one({
            "task_id": task_id,
            "invited_user": telegram_id,
            "status": "pending"
        })
        
        if not invite_doc:
            raise HTTPException(status_code=404, detail="Приглашение не найдено")
        
        # Обновляем статус приглашения
        await db.group_task_invites.update_one(
            {"_id": invite_doc["_id"]},
            {
                "$set": {
                    "status": "declined",
                    "responded_at": datetime.utcnow()
                }
            }
        )
        
        return SuccessResponse(success=True, message="Приглашение отклонено")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при отклонении приглашения: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/group-tasks/{task_id}/complete", response_model=GroupTaskResponse)
async def complete_group_task(task_id: str, complete_data: GroupTaskCompleteRequest):
    """Отметить задачу выполненной/невыполненной"""
    try:
        task_doc = await db.group_tasks.find_one({"task_id": task_id})
        
        if not task_doc:
            raise HTTPException(status_code=404, detail="Групповая задача не найдена")
        
        task = GroupTask(**task_doc)
        
        # Находим участника
        participant_index = next((i for i, p in enumerate(task.participants) if p.telegram_id == complete_data.telegram_id), None)
        
        if participant_index is None:
            raise HTTPException(status_code=403, detail="Вы не являетесь участником этой задачи")
        
        # Обновляем статус выполнения
        update_data = {
            f"participants.{participant_index}.completed": complete_data.completed,
        }
        
        if complete_data.completed:
            update_data[f"participants.{participant_index}.completed_at"] = datetime.utcnow()
        else:
            update_data[f"participants.{participant_index}.completed_at"] = None
        
        await db.group_tasks.update_one(
            {"task_id": task_id},
            {"$set": update_data}
        )
        
        # Получаем обновлённую задачу
        updated_task_doc = await db.group_tasks.find_one({"task_id": task_id})
        updated_task = GroupTask(**updated_task_doc)
        
        # Проверяем, все ли выполнили
        total_participants = len(updated_task.participants)
        completed_participants = sum(1 for p in updated_task.participants if p.completed)
        
        # Обновляем статус задачи
        if completed_participants == total_participants:
            await db.group_tasks.update_one(
                {"task_id": task_id},
                {"$set": {"status": "completed"}}
            )
            updated_task.status = "completed"
        elif completed_participants > 0:
            await db.group_tasks.update_one(
                {"task_id": task_id},
                {"$set": {"status": "in_progress"}}
            )
            updated_task.status = "in_progress"
        
        completion_percentage = int((completed_participants / total_participants * 100) if total_participants > 0 else 0)
        
        # Логируем активность
        if updated_task.room_id:
            participant = next((p for p in updated_task.participants if p.telegram_id == complete_data.telegram_id), None)
            activity = RoomActivity(
                room_id=updated_task.room_id,
                user_id=complete_data.telegram_id,
                username=participant.username if participant else "",
                first_name=participant.first_name if participant else "User",
                action_type="task_completed" if complete_data.completed else "task_uncompleted",
                action_details={"task_title": updated_task.title, "task_id": task_id}
            )
            await db.room_activities.insert_one(activity.model_dump())
        
        # Подсчитываем количество комментариев
        comments_count = await db.group_task_comments.count_documents({"task_id": task_id})
        
        return GroupTaskResponse(
            **updated_task.model_dump(),
            completion_percentage=completion_percentage,
            total_participants=total_participants,
            completed_participants=completed_participants,
            comments_count=comments_count
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при обновлении статуса выполнения: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/group-tasks/{task_id}/leave", response_model=SuccessResponse)
async def leave_group_task(task_id: str, telegram_id: int = Body(..., embed=True)):
    """Покинуть групповую задачу"""
    try:
        task_doc = await db.group_tasks.find_one({"task_id": task_id})
        
        if not task_doc:
            raise HTTPException(status_code=404, detail="Групповая задача не найдена")
        
        task = GroupTask(**task_doc)
        
        # Проверяем, что пользователь не владелец
        if task.owner_id == telegram_id:
            raise HTTPException(status_code=400, detail="Владелец не может покинуть задачу. Удалите задачу или передайте права другому участнику.")
        
        # Удаляем участника
        await db.group_tasks.update_one(
            {"task_id": task_id},
            {"$pull": {"participants": {"telegram_id": telegram_id}}}
        )
        
        return SuccessResponse(success=True, message="Вы покинули групповую задачу")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при выходе из групповой задачи: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/group-tasks/{task_id}", response_model=SuccessResponse)
async def delete_group_task(task_id: str, telegram_id: int = Body(..., embed=True)):
    """Удалить групповую задачу (только владелец)"""
    try:
        task_doc = await db.group_tasks.find_one({"task_id": task_id})
        
        if not task_doc:
            raise HTTPException(status_code=404, detail="Групповая задача не найдена")
        
        task = GroupTask(**task_doc)
        
        # Проверяем, что пользователь является владельцем
        if task.owner_id != telegram_id:
            raise HTTPException(status_code=403, detail="Только владелец может удалить задачу")
        
        # Логируем активность перед удалением
        if task.room_id:
            activity = RoomActivity(
                room_id=task.room_id,
                user_id=telegram_id,
                username="",
                first_name="User",
                action_type="task_deleted",
                action_details={"task_title": task.title, "task_id": task_id}
            )
            await db.room_activities.insert_one(activity.model_dump())
        
        # Удаляем задачу
        await db.group_tasks.delete_one({"task_id": task_id})
        
        # Удаляем все приглашения
        await db.group_task_invites.delete_many({"task_id": task_id})
        
        # Удаляем все комментарии
        await db.group_task_comments.delete_many({"task_id": task_id})
        
        return SuccessResponse(success=True, message="Групповая задача удалена")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при удалении групповой задачи: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/group-tasks/{task_id}/comments", response_model=GroupTaskCommentResponse)
async def create_group_task_comment(task_id: str, comment_data: GroupTaskCommentCreate):
    """Добавить комментарий к групповой задаче"""
    try:
        # Проверяем существование задачи
        task_doc = await db.group_tasks.find_one({"task_id": task_id})
        if not task_doc:
            raise HTTPException(status_code=404, detail="Групповая задача не найдена")
        
        task = GroupTask(**task_doc)
        
        # Проверяем, что пользователь является участником
        participant = next((p for p in task.participants if p.telegram_id == comment_data.telegram_id), None)
        if not participant:
            raise HTTPException(status_code=403, detail="Только участники могут комментировать")
        
        # Создаём комментарий
        comment = GroupTaskComment(
            task_id=task_id,
            telegram_id=comment_data.telegram_id,
            username=participant.username,
            first_name=participant.first_name,
            text=comment_data.text
        )
        
        await db.group_task_comments.insert_one(comment.model_dump())
        
        return GroupTaskCommentResponse(**comment.model_dump())
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при создании комментария: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/group-tasks/{task_id}/comments", response_model=List[GroupTaskCommentResponse])
async def get_group_task_comments(task_id: str):
    """Получить все комментарии групповой задачи"""
    try:
        comments_cursor = db.group_task_comments.find({"task_id": task_id}).sort("created_at", 1)
        
        comments = []
        async for comment_doc in comments_cursor:
            comments.append(GroupTaskCommentResponse(**comment_doc))
        
        return comments
    except Exception as e:
        logger.error(f"Ошибка при получении комментариев: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# ============ API endpoints для комнат (Rooms) ============

@api_router.post("/rooms", response_model=RoomResponse)
async def create_room(room_data: RoomCreate):
    """Создать новую комнату"""
    try:
        # Создаем участника-владельца
        owner_participant = RoomParticipant(
            telegram_id=room_data.telegram_id,
            first_name="Owner",  # будет обновлено при первом обращении
            role='owner'
        )
        
        room = Room(
            name=room_data.name,
            description=room_data.description,
            owner_id=room_data.telegram_id,
            color=room_data.color,
            participants=[owner_participant]
        )
        
        await db.rooms.insert_one(room.model_dump())
        
        return RoomResponse(
            **room.model_dump(),
            total_participants=len(room.participants),
            total_tasks=0,
            completed_tasks=0,
            completion_percentage=0
        )
    except Exception as e:
        logger.error(f"Ошибка при создании комнаты: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/rooms/{telegram_id}", response_model=List[RoomResponse])
async def get_user_rooms(telegram_id: int):
    """Получить все комнаты пользователя"""
    try:
        # Находим комнаты, где пользователь является участником
        rooms_cursor = db.rooms.find({
            "participants.telegram_id": telegram_id
        })
        
        rooms = []
        async for room_doc in rooms_cursor:
            # Подсчитываем задачи в комнате
            total_tasks = await db.group_tasks.count_documents({"room_id": room_doc["room_id"]})
            completed_tasks = await db.group_tasks.count_documents({
                "room_id": room_doc["room_id"],
                "status": "completed"
            })
            
            completion_percentage = 0
            if total_tasks > 0:
                completion_percentage = int((completed_tasks / total_tasks) * 100)
            
            rooms.append(RoomResponse(
                **room_doc,
                total_participants=len(room_doc.get("participants", [])),
                total_tasks=total_tasks,
                completed_tasks=completed_tasks,
                completion_percentage=completion_percentage
            ))
        
        return rooms
    except Exception as e:
        logger.error(f"Ошибка при получении комнат: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/rooms/detail/{room_id}", response_model=RoomResponse)
async def get_room_detail(room_id: str):
    """Получить детальную информацию о комнате"""
    try:
        room_doc = await db.rooms.find_one({"room_id": room_id})
        
        if not room_doc:
            raise HTTPException(status_code=404, detail="Комната не найдена")
        
        # Подсчитываем задачи
        total_tasks = await db.group_tasks.count_documents({"room_id": room_id})
        completed_tasks = await db.group_tasks.count_documents({
            "room_id": room_id,
            "status": "completed"
        })
        
        completion_percentage = 0
        if total_tasks > 0:
            completion_percentage = int((completed_tasks / total_tasks) * 100)
        
        return RoomResponse(
            **room_doc,
            total_participants=len(room_doc.get("participants", [])),
            total_tasks=total_tasks,
            completed_tasks=completed_tasks,
            completion_percentage=completion_percentage
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении деталей комнаты: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def send_room_join_notifications_api(room_doc: dict, new_user_name: str, new_user_id: int):
    """
    Отправляет уведомления всем участникам комнаты и новому участнику о вступлении
    """
    try:
        from telegram import Bot
        
        bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
        if not bot_token:
            logger.warning("⚠️ TELEGRAM_BOT_TOKEN не настроен, уведомления не отправлены")
            return
        
        bot = Bot(token=bot_token)
        room_name = room_doc.get("name", "комнату")
        participants = room_doc.get("participants", [])
        
        # Отправляем уведомление новому участнику
        try:
            new_member_message = f"""🎉 <b>Добро пожаловать в комнату!</b>

📋 Комната: <b>{room_name}</b>
👥 Участников: {len(participants)}

✅ Вы успешно присоединились к командной комнате для совместного выполнения задач!

<i>Откройте приложение, чтобы увидеть задачи комнаты 👇</i>"""
            
            await bot.send_message(
                chat_id=new_user_id,
                text=new_member_message,
                parse_mode='HTML'
            )
            logger.info(f"✅ Отправлено уведомление новому участнику {new_user_id}")
        except Exception as e:
            logger.warning(f"⚠️ Не удалось отправить уведомление новому участнику {new_user_id}: {e}")
        
        # Отправляем уведомления всем существующим участникам (кроме нового)
        for participant in participants:
            participant_id = participant.get("telegram_id")
            
            # Пропускаем нового участника
            if participant_id == new_user_id:
                continue
            
            try:
                existing_member_message = f"""👋 <b>Новый участник в комнате!</b>

📋 Комната: <b>{room_name}</b>
✨ К команде присоединился: <b>{new_user_name}</b>
👥 Всего участников: {len(participants)}

<i>Продолжайте выполнять задачи вместе! 💪</i>"""
                
                await bot.send_message(
                    chat_id=participant_id,
                    text=existing_member_message,
                    parse_mode='HTML'
                )
                logger.info(f"✅ Отправлено уведомление участнику {participant_id}")
            except Exception as e:
                logger.warning(f"⚠️ Не удалось отправить уведомление участнику {participant_id}: {e}")
    
    except Exception as e:
        logger.error(f"❌ Ошибка при отправке уведомлений о присоединении к комнате: {e}")


@api_router.post("/rooms/{room_id}/invite-link", response_model=RoomInviteLinkResponse)
async def generate_room_invite_link(room_id: str, telegram_id: int = Body(..., embed=True)):
    """Сгенерировать ссылку-приглашение в комнату"""
    try:
        # Проверяем существование комнаты
        room_doc = await db.rooms.find_one({"room_id": room_id})
        
        if not room_doc:
            raise HTTPException(status_code=404, detail="Комната не найдена")
        
        # Проверяем, что пользователь является участником комнаты
        is_participant = any(p["telegram_id"] == telegram_id for p in room_doc.get("participants", []))
        if not is_participant:
            raise HTTPException(status_code=403, detail="Вы не являетесь участником комнаты")
        
        # Получаем информацию о боте
        from telegram import Bot
        
        bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
        if not bot_token:
            raise HTTPException(status_code=500, detail="Bot token не настроен")
        
        bot = Bot(token=bot_token)
        bot_info = await bot.get_me()
        bot_username = bot_info.username
        
        # Формируем ссылку с реферальным кодом
        invite_token = room_doc.get("invite_token")
        invite_link = f"https://t.me/{bot_username}?start=room_{invite_token}_ref_{telegram_id}"
        
        return RoomInviteLinkResponse(
            invite_link=invite_link,
            invite_token=invite_token,
            room_id=room_id,
            bot_username=bot_username
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при генерации ссылки: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/rooms/join/{invite_token}", response_model=RoomResponse)
async def join_room_by_token(invite_token: str, join_data: RoomJoinRequest):
    """Присоединиться к комнате по токену приглашения"""
    try:
        # Находим комнату по токену
        room_doc = await db.rooms.find_one({"invite_token": invite_token})
        
        if not room_doc:
            raise HTTPException(status_code=404, detail="Комната не найдена")
        
        # Проверяем, не является ли пользователь уже участником
        is_already_participant = any(
            p["telegram_id"] == join_data.telegram_id 
            for p in room_doc.get("participants", [])
        )
        
        if is_already_participant:
            # Возвращаем информацию о комнате
            total_tasks = await db.group_tasks.count_documents({"room_id": room_doc["room_id"]})
            completed_tasks = await db.group_tasks.count_documents({
                "room_id": room_doc["room_id"],
                "status": "completed"
            })
            
            completion_percentage = 0
            if total_tasks > 0:
                completion_percentage = int((completed_tasks / total_tasks) * 100)
            
            return RoomResponse(
                **room_doc,
                total_participants=len(room_doc.get("participants", [])),
                total_tasks=total_tasks,
                completed_tasks=completed_tasks,
                completion_percentage=completion_percentage
            )
        
        # Добавляем нового участника
        new_participant = RoomParticipant(
            telegram_id=join_data.telegram_id,
            username=join_data.username,
            first_name=join_data.first_name,
            role='member',
            referral_code=join_data.referral_code
        )
        
        await db.rooms.update_one(
            {"invite_token": invite_token},
            {
                "$push": {"participants": new_participant.model_dump()},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        # Автоматически добавляем пользователя во все групповые задачи комнаты
        tasks_cursor = db.group_tasks.find({"room_id": room_doc["room_id"]})
        async for task_doc in tasks_cursor:
            # Проверяем, не является ли уже участником задачи
            is_task_participant = any(
                p["telegram_id"] == join_data.telegram_id 
                for p in task_doc.get("participants", [])
            )
            
            if not is_task_participant:
                task_participant = GroupTaskParticipant(
                    telegram_id=join_data.telegram_id,
                    username=join_data.username,
                    first_name=join_data.first_name,
                    role='member'
                )
                
                await db.group_tasks.update_one(
                    {"task_id": task_doc["task_id"]},
                    {
                        "$push": {"participants": task_participant.model_dump()},
                        "$set": {"updated_at": datetime.utcnow()}
                    }
                )
        
        # Получаем обновленную комнату
        updated_room = await db.rooms.find_one({"invite_token": invite_token})
        
        total_tasks = await db.group_tasks.count_documents({"room_id": updated_room["room_id"]})
        completed_tasks = await db.group_tasks.count_documents({
            "room_id": updated_room["room_id"],
            "status": "completed"
        })
        
        completion_percentage = 0
        if total_tasks > 0:
            completion_percentage = int((completed_tasks / total_tasks) * 100)
        
        # Отправляем уведомления всем участникам комнаты о новом участнике
        await send_room_join_notifications_api(
            room_doc=updated_room,
            new_user_name=join_data.first_name,
            new_user_id=join_data.telegram_id
        )
        
        return RoomResponse(
            **updated_room,
            total_participants=len(updated_room.get("participants", [])),
            total_tasks=total_tasks,
            completed_tasks=completed_tasks,
            completion_percentage=completion_percentage
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при присоединении к комнате: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/rooms/{room_id}/tasks", response_model=GroupTaskResponse)
async def create_task_in_room(room_id: str, task_data: RoomTaskCreate):
    """Создать групповую задачу в комнате"""
    try:
        # Проверяем существование комнаты
        room_doc = await db.rooms.find_one({"room_id": room_id})
        
        if not room_doc:
            raise HTTPException(status_code=404, detail="Комната не найдена")
        
        # Проверяем, что пользователь является участником комнаты
        is_participant = any(p["telegram_id"] == task_data.telegram_id for p in room_doc.get("participants", []))
        if not is_participant:
            raise HTTPException(status_code=403, detail="Вы не являетесь участником комнаты")
        
        # Создаем владельца задачи
        creator_info = next(
            (p for p in room_doc.get("participants", []) if p["telegram_id"] == task_data.telegram_id),
            None
        )
        
        owner_participant = GroupTaskParticipant(
            telegram_id=task_data.telegram_id,
            username=creator_info.get("username") if creator_info else None,
            first_name=creator_info.get("first_name", "User") if creator_info else "User",
            role='owner'
        )
        
        # Автоматически добавляем всех участников комнаты как участников задачи
        participants = [owner_participant]
        for room_participant in room_doc.get("participants", []):
            if room_participant["telegram_id"] != task_data.telegram_id:
                task_participant = GroupTaskParticipant(
                    telegram_id=room_participant["telegram_id"],
                    username=room_participant.get("username"),
                    first_name=room_participant.get("first_name", "User"),
                    role='member'
                )
                participants.append(task_participant)
        
        # Создаем подзадачи из списка строк
        subtasks = []
        for i, subtask_title in enumerate(task_data.subtasks):
            subtasks.append(Subtask(
                title=subtask_title,
                order=i
            ))
        
        # Создаем групповую задачу
        group_task = GroupTask(
            title=task_data.title,
            description=task_data.description,
            deadline=task_data.deadline,
            category=task_data.category,
            priority=task_data.priority,
            owner_id=task_data.telegram_id,
            room_id=room_id,
            participants=participants,
            tags=task_data.tags,
            subtasks=subtasks
        )
        
        await db.group_tasks.insert_one(group_task.model_dump())
        
        # Логируем активность
        activity = RoomActivity(
            room_id=room_id,
            user_id=task_data.telegram_id,
            username=creator_info.get("username") if creator_info else "",
            first_name=creator_info.get("first_name", "User") if creator_info else "User",
            action_type="task_created",
            action_details={"task_title": task_data.title, "task_id": group_task.task_id}
        )
        await db.room_activities.insert_one(activity.model_dump())
        
        # Подсчитываем процент выполнения
        total_participants = len(group_task.participants)
        completed_participants = sum(1 for p in group_task.participants if p.completed)
        completion_percentage = 0
        if total_participants > 0:
            completion_percentage = int((completed_participants / total_participants) * 100)
        
        comments_count = 0
        
        return GroupTaskResponse(
            **group_task.model_dump(),
            completion_percentage=completion_percentage,
            total_participants=total_participants,
            completed_participants=completed_participants,
            comments_count=comments_count
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при создании задачи в комнате: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/rooms/{room_id}/leave", response_model=SuccessResponse)
async def leave_room(room_id: str, telegram_id: int = Body(..., embed=True)):
    """Покинуть комнату"""
    try:
        room_doc = await db.rooms.find_one({"room_id": room_id})
        
        if not room_doc:
            raise HTTPException(status_code=404, detail="Комната не найдена")
        
        # Проверяем, что пользователь не является владельцем
        if room_doc.get("owner_id") == telegram_id:
            raise HTTPException(
                status_code=403, 
                detail="Владелец не может покинуть комнату. Удалите комнату или передайте права владельца."
            )
        
        # Удаляем участника из комнаты
        await db.rooms.update_one(
            {"room_id": room_id},
            {
                "$pull": {"participants": {"telegram_id": telegram_id}},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        # Удаляем участника из всех задач комнаты
        await db.group_tasks.update_many(
            {"room_id": room_id},
            {
                "$pull": {"participants": {"telegram_id": telegram_id}},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        return SuccessResponse(success=True, message="Вы успешно покинули комнату")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при выходе из комнаты: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/rooms/{room_id}", response_model=SuccessResponse)
async def delete_room(room_id: str, telegram_id: int = Body(..., embed=True)):
    """Удалить комнату (только владелец)"""
    try:
        room_doc = await db.rooms.find_one({"room_id": room_id})
        
        if not room_doc:
            raise HTTPException(status_code=404, detail="Комната не найдена")
        
        # Проверяем, что пользователь является владельцем
        if room_doc.get("owner_id") != telegram_id:
            raise HTTPException(status_code=403, detail="Только владелец может удалить комнату")
        
        # Удаляем все задачи комнаты
        await db.group_tasks.delete_many({"room_id": room_id})
        
        # Удаляем комментарии к задачам комнаты
        tasks_to_delete = await db.group_tasks.find({"room_id": room_id}).to_list(length=None)
        task_ids = [task["task_id"] for task in tasks_to_delete]
        if task_ids:
            await db.group_task_comments.delete_many({"task_id": {"$in": task_ids}})
        
        # Удаляем комнату
        await db.rooms.delete_one({"room_id": room_id})
        
        return SuccessResponse(success=True, message="Комната успешно удалена")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при удалении комнаты: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@api_router.put("/rooms/{room_id}", response_model=RoomResponse)
async def update_room(room_id: str, update_data: RoomUpdate, telegram_id: int = Body(..., embed=True)):
    """Обновить комнату (название, описание, цвет) - только владелец или админ"""
    try:
        room_doc = await db.rooms.find_one({"room_id": room_id})
        
        if not room_doc:
            raise HTTPException(status_code=404, detail="Комната не найдена")
        
        # Проверяем права доступа (владелец или админ)
        participant = next((p for p in room_doc.get("participants", []) if p["telegram_id"] == telegram_id), None)
        if not participant or (participant["role"] not in ["owner", "admin"]):
            raise HTTPException(status_code=403, detail="Недостаточно прав для редактирования комнаты")
        
        # Формируем обновления
        updates = {"updated_at": datetime.utcnow()}
        if update_data.name is not None:
            updates["name"] = update_data.name
        if update_data.description is not None:
            updates["description"] = update_data.description
        if update_data.color is not None:
            updates["color"] = update_data.color
        
        # Обновляем комнату
        await db.rooms.update_one({"room_id": room_id}, {"$set": updates})
        
        # Получаем обновленную комнату
        updated_room = await db.rooms.find_one({"room_id": room_id})
        
        # Получаем статистику
        tasks_cursor = db.group_tasks.find({"room_id": room_id})
        all_tasks = await tasks_cursor.to_list(length=None)
        total_tasks = len(all_tasks)
        completed_tasks = sum(1 for task in all_tasks if task.get("status") == "completed")
        completion_percentage = int((completed_tasks / total_tasks * 100)) if total_tasks > 0 else 0
        
        # Логируем активность
        activity = RoomActivity(
            room_id=room_id,
            user_id=telegram_id,
            first_name=participant.get("first_name", ""),
            username=participant.get("username"),
            action_type="room_updated",
            action_details={"changes": updates}
        )
        await db.room_activities.insert_one(activity.model_dump())
        
        return RoomResponse(
            room_id=updated_room["room_id"],
            name=updated_room["name"],
            description=updated_room.get("description"),
            owner_id=updated_room["owner_id"],
            created_at=updated_room["created_at"],
            updated_at=updated_room["updated_at"],
            participants=[RoomParticipant(**p) for p in updated_room.get("participants", [])],
            invite_token=updated_room["invite_token"],
            color=updated_room.get("color", "blue"),
            total_participants=len(updated_room.get("participants", [])),
            total_tasks=total_tasks,
            completed_tasks=completed_tasks,
            completion_percentage=completion_percentage
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при обновлении комнаты: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/rooms/{room_id}/participant-role", response_model=SuccessResponse)
async def update_participant_role(role_update: ParticipantRoleUpdate):
    """Изменить роль участника комнаты - только владелец или админ"""
    try:
        room_doc = await db.rooms.find_one({"room_id": role_update.room_id})
        
        if not room_doc:
            raise HTTPException(status_code=404, detail="Комната не найдена")
        
        # Проверяем права изменяющего (владелец или админ)
        changer = next((p for p in room_doc.get("participants", []) if p["telegram_id"] == role_update.changed_by), None)
        if not changer or (changer["role"] not in ["owner", "admin"]):
            raise HTTPException(status_code=403, detail="Недостаточно прав для изменения ролей")
        
        # Проверяем, что изменяемый участник существует
        target = next((p for p in room_doc.get("participants", []) if p["telegram_id"] == role_update.telegram_id), None)
        if not target:
            raise HTTPException(status_code=404, detail="Участник не найден в комнате")
        
        # Нельзя изменить роль владельца
        if target["role"] == "owner":
            raise HTTPException(status_code=403, detail="Нельзя изменить роль владельца")
        
        # Валидация новой роли
        valid_roles = ["owner", "admin", "moderator", "member", "viewer"]
        if role_update.new_role not in valid_roles:
            raise HTTPException(status_code=400, detail=f"Недопустимая роль. Допустимые: {', '.join(valid_roles)}")
        
        # Обновляем роль участника
        await db.rooms.update_one(
            {"room_id": role_update.room_id, "participants.telegram_id": role_update.telegram_id},
            {"$set": {"participants.$.role": role_update.new_role, "updated_at": datetime.utcnow()}}
        )
        
        # Логируем активность
        activity = RoomActivity(
            room_id=role_update.room_id,
            user_id=role_update.changed_by,
            first_name=changer.get("first_name", ""),
            username=changer.get("username"),
            action_type="role_changed",
            action_details={
                "target_user": role_update.telegram_id,
                "target_name": target.get("first_name", ""),
                "old_role": target.get("role"),
                "new_role": role_update.new_role
            }
        )
        await db.room_activities.insert_one(activity.model_dump())
        
        return SuccessResponse(success=True, message=f"Роль участника изменена на {role_update.new_role}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при изменении роли участника: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@api_router.get("/rooms/{room_id}/tasks", response_model=List[GroupTaskResponse])
async def get_room_tasks(room_id: str):
    """Получить все задачи комнаты"""
    try:
        # Проверяем существование комнаты
        room_doc = await db.rooms.find_one({"room_id": room_id})
        
        if not room_doc:
            raise HTTPException(status_code=404, detail="Комната не найдена")
        
        # Получаем все задачи комнаты
        tasks_cursor = db.group_tasks.find({"room_id": room_id}).sort("created_at", -1)
        
        tasks = []
        async for task_doc in tasks_cursor:
            # Обновляем статус задачи если нужно
            if task_doc.get("deadline") and task_doc.get("status") != "completed":
                if datetime.utcnow() > task_doc["deadline"]:
                    await db.group_tasks.update_one(
                        {"task_id": task_doc["task_id"]},
                        {"$set": {"status": "overdue"}}
                    )
                    task_doc["status"] = "overdue"
            
            # Проверяем завершенность задачи
            participants = task_doc.get("participants", [])
            if participants:
                all_completed = all(p.get("completed", False) for p in participants)
                if all_completed and task_doc.get("status") != "completed":
                    await db.group_tasks.update_one(
                        {"task_id": task_doc["task_id"]},
                        {"$set": {"status": "completed"}}
                    )
                    task_doc["status"] = "completed"
            
            total_participants = len(participants)
            completed_participants = sum(1 for p in participants if p.get("completed", False))
            completion_percentage = 0
            if total_participants > 0:
                completion_percentage = int((completed_participants / total_participants) * 100)
            
            tasks.append(GroupTaskResponse(
                **task_doc,
                completion_percentage=completion_percentage,
                total_participants=total_participants,
                completed_participants=completed_participants
            ))
        
        return tasks
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении задач комнаты: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/group-tasks/{task_id}/update", response_model=GroupTaskResponse)
async def update_group_task(task_id: str, update_data: GroupTaskUpdate):
    """Обновить групповую задачу (название, описание, дедлайн, категорию, приоритет, теги)"""
    try:
        task_doc = await db.group_tasks.find_one({"task_id": task_id})
        
        if not task_doc:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        
        # Подготавливаем данные для обновления
        update_fields = {}
        if update_data.title is not None:
            update_fields["title"] = update_data.title
        if update_data.description is not None:
            update_fields["description"] = update_data.description
        if update_data.deadline is not None:
            update_fields["deadline"] = update_data.deadline
        if update_data.category is not None:
            update_fields["category"] = update_data.category
        if update_data.priority is not None:
            update_fields["priority"] = update_data.priority
        if update_data.status is not None:
            update_fields["status"] = update_data.status
        if update_data.tags is not None:
            update_fields["tags"] = update_data.tags
        
        update_fields["updated_at"] = datetime.utcnow()
        
        # Обновляем задачу
        await db.group_tasks.update_one(
            {"task_id": task_id},
            {"$set": update_fields}
        )
        
        # Получаем обновленную задачу
        updated_task = await db.group_tasks.find_one({"task_id": task_id})
        
        # Подсчитываем статистику
        participants = updated_task.get("participants", [])
        total_participants = len(participants)
        completed_participants = sum(1 for p in participants if p.get("completed", False))
        completion_percentage = 0
        if total_participants > 0:
            completion_percentage = int((completed_participants / total_participants) * 100)
        
        # Подсчитываем количество комментариев
        comments_count = await db.group_task_comments.count_documents({"task_id": task_id})
        
        # Логируем активность
        if updated_task.get("room_id"):
            activity = RoomActivity(
                room_id=updated_task["room_id"],
                user_id=updated_task["owner_id"],
                username="",
                first_name="User",
                action_type="task_updated",
                action_details={"task_title": updated_task["title"], "task_id": task_id}
            )
            await db.room_activities.insert_one(activity.model_dump())
        
        return GroupTaskResponse(
            **updated_task,
            completion_percentage=completion_percentage,
            total_participants=total_participants,
            completed_participants=completed_participants,
            comments_count=comments_count
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при обновлении задачи: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/group-tasks/{task_id}/subtasks", response_model=GroupTaskResponse)
async def add_subtask(task_id: str, subtask: SubtaskCreate):
    """Добавить подзадачу"""
    try:
        task_doc = await db.group_tasks.find_one({"task_id": task_id})
        
        if not task_doc:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        
        # Создаем подзадачу
        new_subtask = Subtask(
            title=subtask.title,
            order=len(task_doc.get("subtasks", []))
        )
        
        # Добавляем подзадачу к задаче
        await db.group_tasks.update_one(
            {"task_id": task_id},
            {
                "$push": {"subtasks": new_subtask.model_dump()},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        # Получаем обновленную задачу
        updated_task = await db.group_tasks.find_one({"task_id": task_id})
        
        # Подсчитываем статистику
        participants = updated_task.get("participants", [])
        total_participants = len(participants)
        completed_participants = sum(1 for p in participants if p.get("completed", False))
        completion_percentage = 0
        if total_participants > 0:
            completion_percentage = int((completed_participants / total_participants) * 100)
        
        comments_count = await db.group_task_comments.count_documents({"task_id": task_id})
        
        return GroupTaskResponse(
            **updated_task,
            completion_percentage=completion_percentage,
            total_participants=total_participants,
            completed_participants=completed_participants,
            comments_count=comments_count
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при добавлении подзадачи: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/group-tasks/{task_id}/subtasks/{subtask_id}", response_model=GroupTaskResponse)
async def update_subtask(task_id: str, subtask_id: str, update_data: SubtaskUpdate):
    """Обновить подзадачу (название, статус выполнения)"""
    try:
        task_doc = await db.group_tasks.find_one({"task_id": task_id})
        
        if not task_doc:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        
        # Находим подзадачу
        subtasks = task_doc.get("subtasks", [])
        subtask_index = next((i for i, s in enumerate(subtasks) if s.get("subtask_id") == subtask_id), None)
        
        if subtask_index is None:
            raise HTTPException(status_code=404, detail="Подзадача не найдена")
        
        # Обновляем подзадачу
        if update_data.title is not None:
            subtasks[subtask_index]["title"] = update_data.title
        if update_data.completed is not None:
            subtasks[subtask_index]["completed"] = update_data.completed
            if update_data.completed:
                subtasks[subtask_index]["completed_at"] = datetime.utcnow()
        
        # Сохраняем изменения
        await db.group_tasks.update_one(
            {"task_id": task_id},
            {
                "$set": {
                    "subtasks": subtasks,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        # Получаем обновленную задачу
        updated_task = await db.group_tasks.find_one({"task_id": task_id})
        
        # Подсчитываем статистику
        participants = updated_task.get("participants", [])
        total_participants = len(participants)
        completed_participants = sum(1 for p in participants if p.get("completed", False))
        completion_percentage = 0
        if total_participants > 0:
            completion_percentage = int((completed_participants / total_participants) * 100)
        
        comments_count = await db.group_task_comments.count_documents({"task_id": task_id})
        
        return GroupTaskResponse(
            **updated_task,
            completion_percentage=completion_percentage,
            total_participants=total_participants,
            completed_participants=completed_participants,
            comments_count=comments_count
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при обновлении подзадачи: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/group-tasks/{task_id}/subtasks/{subtask_id}", response_model=GroupTaskResponse)
async def delete_subtask(task_id: str, subtask_id: str):
    """Удалить подзадачу"""
    try:
        task_doc = await db.group_tasks.find_one({"task_id": task_id})
        
        if not task_doc:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        
        # Удаляем подзадачу
        await db.group_tasks.update_one(
            {"task_id": task_id},
            {
                "$pull": {"subtasks": {"subtask_id": subtask_id}},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        # Получаем обновленную задачу
        updated_task = await db.group_tasks.find_one({"task_id": task_id})
        
        # Подсчитываем статистику
        participants = updated_task.get("participants", [])
        total_participants = len(participants)
        completed_participants = sum(1 for p in participants if p.get("completed", False))
        completion_percentage = 0
        if total_participants > 0:
            completion_percentage = int((completed_participants / total_participants) * 100)
        
        comments_count = await db.group_task_comments.count_documents({"task_id": task_id})
        
        return GroupTaskResponse(
            **updated_task,
            completion_percentage=completion_percentage,
            total_participants=total_participants,
            completed_participants=completed_participants,
            comments_count=comments_count
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при удалении подзадачи: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/rooms/{room_id}/activity", response_model=List[RoomActivityResponse])
async def get_room_activity(room_id: str, limit: int = 50):
    """Получить историю активности комнаты"""
    try:
        # Проверяем существование комнаты
        room_doc = await db.rooms.find_one({"room_id": room_id})
        
        if not room_doc:
            raise HTTPException(status_code=404, detail="Комната не найдена")
        
        # Получаем активности
        activities_cursor = db.room_activities.find({"room_id": room_id}).sort("created_at", -1).limit(limit)
        
        activities = []
        async for activity_doc in activities_cursor:
            activities.append(RoomActivityResponse(**activity_doc))
        
        return activities
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении активности комнаты: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/rooms/{room_id}/stats", response_model=RoomStatsResponse)
async def get_room_stats(room_id: str):
    """Получить статистику комнаты"""
    try:
        # Проверяем существование комнаты
        room_doc = await db.rooms.find_one({"room_id": room_id})
        
        if not room_doc:
            raise HTTPException(status_code=404, detail="Комната не найдена")
        
        # Получаем все задачи комнаты
        tasks_cursor = db.group_tasks.find({"room_id": room_id})
        
        total_tasks = 0
        completed_tasks = 0
        overdue_tasks = 0
        in_progress_tasks = 0
        
        async for task in tasks_cursor:
            total_tasks += 1
            status = task.get("status", "created")
            
            if status == "completed":
                completed_tasks += 1
            elif status == "overdue":
                overdue_tasks += 1
            elif status == "in_progress":
                in_progress_tasks += 1
        
        # Подсчитываем процент выполнения
        completion_percentage = 0
        if total_tasks > 0:
            completion_percentage = int((completed_tasks / total_tasks) * 100)
        
        # Статистика по участникам
        participants = room_doc.get("participants", [])
        participants_stats = []
        
        for participant in participants:
            telegram_id = participant.get("telegram_id")
            
            # Подсчитываем задачи участника
            user_tasks = await db.group_tasks.count_documents({
                "room_id": room_id,
                "owner_id": telegram_id
            })
            
            # Подсчитываем выполненные задачи
            user_completed = 0
            async for task in db.group_tasks.find({"room_id": room_id}):
                for p in task.get("participants", []):
                    if p.get("telegram_id") == telegram_id and p.get("completed", False):
                        user_completed += 1
                        break
            
            participants_stats.append({
                "telegram_id": telegram_id,
                "username": participant.get("username"),
                "first_name": participant.get("first_name"),
                "role": participant.get("role"),
                "tasks_created": user_tasks,
                "tasks_completed": user_completed,
                "joined_at": participant.get("joined_at")
            })
        
        # Сортируем по количеству выполненных задач
        participants_stats.sort(key=lambda x: x["tasks_completed"], reverse=True)
        
        # График активности по дням (последние 7 дней)
        activity_chart = []
        for i in range(7):
            day_start = datetime.utcnow() - timedelta(days=i)
            day_start = day_start.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            
            day_activities = await db.room_activities.count_documents({
                "room_id": room_id,
                "created_at": {"$gte": day_start, "$lt": day_end}
            })
            
            activity_chart.append({
                "date": day_start.strftime("%Y-%m-%d"),
                "activities": day_activities
            })
        
        activity_chart.reverse()
        
        return RoomStatsResponse(
            room_id=room_id,
            total_tasks=total_tasks,
            completed_tasks=completed_tasks,
            overdue_tasks=overdue_tasks,
            in_progress_tasks=in_progress_tasks,
            completion_percentage=completion_percentage,
            participants_stats=participants_stats,
            activity_chart=activity_chart
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении статистики комнаты: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/rooms/{room_id}/participant-role", response_model=SuccessResponse)
async def update_participant_role(role_update: ParticipantRoleUpdate):
    """Изменить роль участника комнаты"""
    try:
        room_doc = await db.rooms.find_one({"room_id": role_update.room_id})
        
        if not room_doc:
            raise HTTPException(status_code=404, detail="Комната не найдена")
        
        # Проверяем права (только owner и admin могут менять роли)
        changer = next((p for p in room_doc.get("participants", []) if p.get("telegram_id") == role_update.changed_by), None)
        
        if not changer or changer.get("role") not in ["owner", "admin"]:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        
        # Нельзя изменить роль owner
        target = next((p for p in room_doc.get("participants", []) if p.get("telegram_id") == role_update.telegram_id), None)
        
        if target and target.get("role") == "owner":
            raise HTTPException(status_code=403, detail="Нельзя изменить роль владельца")
        
        # Обновляем роль
        await db.rooms.update_one(
            {"room_id": role_update.room_id, "participants.telegram_id": role_update.telegram_id},
            {"$set": {"participants.$.role": role_update.new_role}}
        )
        
        # Логируем активность
        activity = RoomActivity(
            room_id=role_update.room_id,
            user_id=role_update.changed_by,
            username="",
            first_name="User",
            action_type="role_changed",
            action_details={
                "target_user": role_update.telegram_id,
                "new_role": role_update.new_role
            }
        )
        await db.room_activities.insert_one(activity.model_dump())
        
        return SuccessResponse(success=True, message="Роль успешно обновлена")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при изменении роли: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/rooms/{room_id}/tasks-reorder", response_model=SuccessResponse)
async def reorder_room_tasks(reorder_request: TaskReorderRequest):
    """Изменить порядок задач в комнате (drag & drop)"""
    try:
        room_doc = await db.rooms.find_one({"room_id": reorder_request.room_id})
        
        if not room_doc:
            raise HTTPException(status_code=404, detail="Комната не найдена")
        
        # Обновляем порядок для каждой задачи
        for task_order in reorder_request.tasks:
            await db.group_tasks.update_one(
                {"task_id": task_order["task_id"]},
                {"$set": {"order": task_order["order"]}}
            )
        
        return SuccessResponse(success=True, message="Порядок задач обновлен")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при изменении порядка задач: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ Эндпоинты для реферальной системы ============

def generate_referral_code(telegram_id: int) -> str:
    """Генерирует уникальный реферальный код для пользователя"""
    import hashlib
    import secrets
    
    # Создаём код из telegram_id + случайная соль
    salt = secrets.token_hex(4)
    raw_string = f"{telegram_id}_{salt}"
    hash_object = hashlib.sha256(raw_string.encode())
    code = hash_object.hexdigest()[:10].upper()
    
    return code


@api_router.get("/referral/code/{telegram_id}", response_model=ReferralCodeResponse)
async def get_referral_code(telegram_id: int):
    """
    Получить или создать реферальный код пользователя
    """
    try:
        # Получаем пользователя
        user = await db.user_settings.find_one({"telegram_id": telegram_id})
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Если у пользователя ещё нет реферального кода - создаём
        referral_code = user.get("referral_code")
        if not referral_code:
            referral_code = generate_referral_code(telegram_id)
            
            # Сохраняем код в базу
            await db.user_settings.update_one(
                {"telegram_id": telegram_id},
                {"$set": {"referral_code": referral_code}}
            )
            logger.info(f"✅ Создан реферальный код для пользователя {telegram_id}: {referral_code}")
        
        # Получаем информацию о боте
        bot_info = await db.bot_info.find_one({})
        bot_username = bot_info.get("username", "rudn_mosbot") if bot_info else "rudn_mosbot"
        
        # Формируем реферальную ссылку
        referral_link = f"https://t.me/{bot_username}?start=ref_{referral_code}"
        
        return ReferralCodeResponse(
            referral_code=referral_code,
            referral_link=referral_link,
            bot_username=bot_username
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении реферального кода: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def get_referral_level(referrer_id: int, referred_id: int, db) -> int:
    """
    Определяет уровень нового реферала в цепочке
    Returns: 1, 2, или 3 (уровень в реферальной цепочке)
    """
    # Ищем связь пригласившего с его referrer
    referrer = await db.user_settings.find_one({"telegram_id": referrer_id})
    
    if not referrer or not referrer.get("referred_by"):
        # Если у пригласившего нет своего referrer - новый пользователь будет уровня 1
        return 1
    
    # Ищем связь на уровень выше
    parent_referrer_id = referrer.get("referred_by")
    parent_referrer = await db.user_settings.find_one({"telegram_id": parent_referrer_id})
    
    if not parent_referrer or not parent_referrer.get("referred_by"):
        # Если у parent нет своего referrer - новый пользователь будет уровня 2
        return 2
    
    # Иначе - уровень 3 (максимум)
    return 3


async def create_referral_connections(referred_id: int, referrer_id: int, db):
    """
    Создаёт связи реферала со всеми вышестоящими в цепочке (до 3 уровней)
    """
    connections = []
    current_referrer_id = referrer_id
    level = 1
    
    # Проходим по цепочке вверх максимум 3 уровня
    while current_referrer_id and level <= 3:
        # Создаём связь
        connection = {
            "id": str(uuid.uuid4()),
            "referrer_telegram_id": current_referrer_id,
            "referred_telegram_id": referred_id,
            "level": level,
            "created_at": datetime.utcnow(),
            "points_earned": 0
        }
        connections.append(connection)
        
        # Ищем следующего в цепочке
        current_referrer = await db.user_settings.find_one({"telegram_id": current_referrer_id})
        if current_referrer and current_referrer.get("referred_by"):
            current_referrer_id = current_referrer.get("referred_by")
            level += 1
        else:
            break
    
    # Сохраняем все связи
    if connections:
        await db.referral_connections.insert_many(connections)
        logger.info(f"✅ Создано {len(connections)} реферальных связей для пользователя {referred_id}")
    
    return connections


@api_router.get("/referral/stats/{telegram_id}", response_model=ReferralStats)
async def get_referral_stats(telegram_id: int):
    """
    Получить статистику по рефералам пользователя
    """
    try:
        # Получаем пользователя и его реферальный код
        user = await db.user_settings.find_one({"telegram_id": telegram_id})
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        referral_code = user.get("referral_code")
        if not referral_code:
            # Создаём код если его нет
            referral_code = generate_referral_code(telegram_id)
            await db.user_settings.update_one(
                {"telegram_id": telegram_id},
                {"$set": {"referral_code": referral_code}}
            )
        
        # Получаем информацию о боте для ссылки
        bot_info = await db.bot_info.find_one({})
        bot_username = bot_info.get("username", "rudn_mosbot") if bot_info else "rudn_mosbot"
        referral_link = f"https://t.me/{bot_username}?start=ref_{referral_code}"
        
        # Получаем все реферальные связи пользователя
        connections = await db.referral_connections.find({
            "referrer_telegram_id": telegram_id
        }).to_list(None)
        
        # Группируем по уровням
        level_1_ids = [c["referred_telegram_id"] for c in connections if c["level"] == 1]
        level_2_ids = [c["referred_telegram_id"] for c in connections if c["level"] == 2]
        level_3_ids = [c["referred_telegram_id"] for c in connections if c["level"] == 3]
        
        # Получаем информацию о рефералах
        async def get_referrals_info(telegram_ids, level):
            if not telegram_ids:
                return []
            
            users = await db.user_settings.find({
                "telegram_id": {"$in": telegram_ids}
            }).to_list(None)
            
            result = []
            for u in users:
                # Получаем статистику баллов реферала
                stats = await db.user_stats.find_one({"telegram_id": u["telegram_id"]})
                total_points = stats.get("total_points", 0) if stats else 0
                
                # Получаем сколько заработал для пригласившего
                connection = next((c for c in connections if c["referred_telegram_id"] == u["telegram_id"] and c["level"] == level), None)
                points_for_referrer = connection.get("points_earned", 0) if connection else 0
                
                result.append(ReferralUser(
                    telegram_id=u["telegram_id"],
                    username=u.get("username"),
                    first_name=u.get("first_name"),
                    last_name=u.get("last_name"),
                    registered_at=u.get("created_at", datetime.utcnow()),
                    level=level,
                    total_points=total_points,
                    points_earned_for_referrer=points_for_referrer
                ))
            
            return result
        
        level_1_referrals = await get_referrals_info(level_1_ids, 1)
        level_2_referrals = await get_referrals_info(level_2_ids, 2)
        level_3_referrals = await get_referrals_info(level_3_ids, 3)
        
        # Подсчитываем заработанные баллы по уровням
        level_1_points = sum(c.get("points_earned", 0) for c in connections if c["level"] == 1)
        level_2_points = sum(c.get("points_earned", 0) for c in connections if c["level"] == 2)
        level_3_points = sum(c.get("points_earned", 0) for c in connections if c["level"] == 3)
        total_referral_points = level_1_points + level_2_points + level_3_points
        
        return ReferralStats(
            telegram_id=telegram_id,
            referral_code=referral_code,
            referral_link=referral_link,
            level_1_count=len(level_1_referrals),
            level_2_count=len(level_2_referrals),
            level_3_count=len(level_3_referrals),
            total_referral_points=total_referral_points,
            level_1_points=level_1_points,
            level_2_points=level_2_points,
            level_3_points=level_3_points,
            level_1_referrals=level_1_referrals,
            level_2_referrals=level_2_referrals,
            level_3_referrals=level_3_referrals
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении статистики рефералов: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/referral/tree/{telegram_id}")
async def get_referral_tree(telegram_id: int):
    """
    Получить дерево рефералов пользователя (для визуализации)
    """
    try:
        async def build_tree_node(user_telegram_id: int, current_level: int = 1, max_depth: int = 3) -> Optional[ReferralTreeNode]:
            if current_level > max_depth:
                return None
            
            # Получаем пользователя
            user = await db.user_settings.find_one({"telegram_id": user_telegram_id})
            if not user:
                return None
            
            # Получаем статистику
            stats = await db.user_stats.find_one({"telegram_id": user_telegram_id})
            total_points = stats.get("total_points", 0) if stats else 0
            
            # Получаем прямых рефералов (level 1 от этого пользователя)
            direct_referrals = await db.referral_connections.find({
                "referrer_telegram_id": user_telegram_id,
                "level": 1
            }).to_list(None)
            
            # Рекурсивно строим детей
            children = []
            for ref in direct_referrals[:10]:  # Ограничиваем 10 на уровень для производительности
                child_node = await build_tree_node(
                    ref["referred_telegram_id"],
                    current_level + 1,
                    max_depth
                )
                if child_node:
                    children.append(child_node)
            
            return ReferralTreeNode(
                telegram_id=user["telegram_id"],
                username=user.get("username"),
                first_name=user.get("first_name"),
                level=current_level,
                total_points=total_points,
                children=children,
                registered_at=user.get("created_at", datetime.utcnow())
            )
        
        # Строим дерево начиная с текущего пользователя
        tree = await build_tree_node(telegram_id, 1, 3)
        
        if not tree:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        return tree
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при построении дерева рефералов: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Duplicate admin endpoints removed - using the improved implementation below
    """
    Получить общую статистику для админ панели
    """
    try:
        # Определяем временной диапазон
        if days:
            date_filter = {"created_at": {"$gte": datetime.utcnow() - timedelta(days=days)}}
        else:
            date_filter = {}
        
        # Общая статистика пользователей
        total_users = await db.user_settings.count_documents({})
        
        # Активные пользователи сегодня
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        active_users_today = await db.user_settings.count_documents({
            "last_activity": {"$gte": today_start}
        })
        
        # Новые пользователи за неделю
        week_ago = datetime.utcnow() - timedelta(days=7)
        new_users_week = await db.user_settings.count_documents({
            "created_at": {"$gte": week_ago}
        })
        
        # Статистика задач
        total_tasks = await db.tasks.count_documents(date_filter)
        total_completed_tasks = await db.tasks.count_documents({
            **date_filter,
            "completed": True
        })
        
        # Статистика достижений
        total_achievements_earned = await db.user_achievements.count_documents(date_filter)
        
        # Статистика комнат
        total_rooms = await db.rooms.count_documents(date_filter)
        
        return AdminStatsResponse(
            total_users=total_users,
            active_users_today=active_users_today,
            new_users_week=new_users_week,
            total_tasks=total_tasks,
            total_completed_tasks=total_completed_tasks,
            total_achievements_earned=total_achievements_earned,
            total_rooms=total_rooms
        )
    
    except Exception as e:
        logger.error(f"Ошибка при получении статистики админ панели: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/admin/users-activity", response_model=List[UserActivityPoint])
async def get_users_activity(days: Optional[int] = 30):
    """
    Получить активность регистраций пользователей по дням
    """
    try:
        # Определяем временной диапазон
        if days:
            start_date = datetime.utcnow() - timedelta(days=days)
        else:
            # Если не указано, берем все записи
            start_date = datetime(2020, 1, 1)
        
        # Агрегация по дням
        pipeline = [
            {
                "$match": {
                    "created_at": {"$gte": start_date}
                }
            },
            {
                "$group": {
                    "_id": {
                        "$dateToString": {
                            "format": "%Y-%m-%d",
                            "date": "$created_at"
                        }
                    },
                    "count": {"$sum": 1}
                }
            },
            {
                "$sort": {"_id": 1}
            }
        ]
        
        results = await db.user_settings.aggregate(pipeline).to_list(length=None)
        
        # Преобразуем результат
        activity = [
            UserActivityPoint(date=result["_id"], count=result["count"])
            for result in results
        ]
        
        return activity
    
    except Exception as e:
        logger.error(f"Ошибка при получении активности пользователей: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/admin/hourly-activity", response_model=List[HourlyActivityPoint])
async def get_hourly_activity(days: Optional[int] = 30):
    """
    Получить активность пользователей по часам
    """
    try:
        # Определяем временной диапазон
        if days:
            start_date = datetime.utcnow() - timedelta(days=days)
        else:
            start_date = datetime(2020, 1, 1)
        
        # Агрегация по часам (используем last_activity)
        pipeline = [
            {
                "$match": {
                    "last_activity": {"$gte": start_date}
                }
            },
            {
                "$group": {
                    "_id": {
                        "$hour": "$last_activity"
                    },
                    "count": {"$sum": 1}
                }
            },
            {
                "$sort": {"_id": 1}
            }
        ]
        
        results = await db.user_settings.aggregate(pipeline).to_list(length=None)
        
        # Заполняем все часы (0-23)
        hourly_data = {i: 0 for i in range(24)}
        for result in results:
            hour = result["_id"]
            if hour is not None:
                hourly_data[hour] = result["count"]
        
        # Преобразуем результат
        activity = [
            HourlyActivityPoint(hour=f"{hour:02d}:00", count=count)
            for hour, count in hourly_data.items()
        ]
        
        return activity
    
    except Exception as e:
        logger.error(f"Ошибка при получении почасовой активности: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/admin/weekly-activity", response_model=List[dict])
async def get_weekly_activity(days: Optional[int] = 30):
    """
    Получить активность пользователей по дням недели
    """
    try:
        # Определяем временной диапазон
        if days:
            start_date = datetime.utcnow() - timedelta(days=days)
        else:
            start_date = datetime(2020, 1, 1)
        
        # Агрегация по дням недели (используем last_activity)
        pipeline = [
            {
                "$match": {
                    "last_activity": {"$gte": start_date}
                }
            },
            {
                "$group": {
                    "_id": {
                        "$dayOfWeek": "$last_activity"
                    },
                    "count": {"$sum": 1}
                }
            },
            {
                "$sort": {"_id": 1}
            }
        ]
        
        results = await db.user_settings.aggregate(pipeline).to_list(length=None)
        
        # Маппинг дней недели (MongoDB: 1=Воскресенье, 2=Понедельник, ...)
        day_names = {
            1: "Вс",
            2: "Пн",
            3: "Вт",
            4: "Ср",
            5: "Чт",
            6: "Пт",
            7: "Сб"
        }
        
        # Заполняем все дни
        weekly_data = {day: 0 for day in range(1, 8)}
        for result in results:
            day = result["_id"]
            if day is not None:
                weekly_data[day] = result["count"]
        
        # Преобразуем результат (начинаем с понедельника)
        activity = []
        for day_num in [2, 3, 4, 5, 6, 7, 1]:  # Пн-Вс
            activity.append({
                "day": day_names[day_num],
                "count": weekly_data[day_num]
            })
        
        return activity
    
    except Exception as e:
        logger.error(f"Ошибка при получении недельной активности: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/admin/feature-usage", response_model=FeatureUsageStats)
async def get_feature_usage(days: Optional[int] = None):
    """
    Получить статистику использования функций
    """
    try:
        # Определяем временной диапазон для новых пользователей
        if days:
            date_filter = {"created_at": {"$gte": datetime.utcnow() - timedelta(days=days)}}
        else:
            date_filter = {}
        
        # Получаем список telegram_id пользователей в заданном диапазоне
        if days:
            users_cursor = db.user_settings.find(date_filter, {"telegram_id": 1})
            users = await users_cursor.to_list(length=None)
            telegram_ids = [user["telegram_id"] for user in users]
            stats_filter = {"telegram_id": {"$in": telegram_ids}}
        else:
            stats_filter = {}
        
        # Агрегация статистики
        pipeline = [
            {"$match": stats_filter},
            {
                "$group": {
                    "_id": None,
                    "schedule_views": {"$sum": "$schedule_views"},
                    "analytics_views": {"$sum": "$analytics_views"},
                    "calendar_opens": {"$sum": "$calendar_opens"},
                    "notifications_configured": {"$sum": "$notifications_configured"},
                    "schedule_shares": {"$sum": "$schedule_shares"},
                    "tasks_created": {"$sum": {"$ifNull": ["$tasks_created", 0]}},
                    "achievements_earned": {"$sum": "$achievements_count"}
                }
            }
        ]
        
        results = await db.user_stats.aggregate(pipeline).to_list(length=None)
        
        if results:
            data = results[0]
            return FeatureUsageStats(
                schedule_views=data.get("schedule_views", 0),
                analytics_views=data.get("analytics_views", 0),
                calendar_opens=data.get("calendar_opens", 0),
                notifications_configured=data.get("notifications_configured", 0),
                schedule_shares=data.get("schedule_shares", 0),
                tasks_created=data.get("tasks_created", 0),
                achievements_earned=data.get("achievements_earned", 0)
            )
        else:
            # Возвращаем нули, если нет данных
            return FeatureUsageStats(
                schedule_views=0,
                analytics_views=0,
                calendar_opens=0,
                notifications_configured=0,
                schedule_shares=0,
                tasks_created=0,
                achievements_earned=0
            )
    
    except Exception as e:
        logger.error(f"Ошибка при получении статистики функций: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/admin/top-users", response_model=List[TopUser])
async def get_top_users(
    metric: str = "points",
    limit: int = 10
):
    """
    Получить топ пользователей по заданной метрике
    """
    try:
        # Доступные метрики
        valid_metrics = {
            "points": "total_points",
            "achievements": "achievements_count",
            "tasks": "tasks_created",
            "schedule_views": "schedule_views"
        }
        
        if metric not in valid_metrics:
            raise HTTPException(
                status_code=400,
                detail=f"Недопустимая метрика. Доступные: {', '.join(valid_metrics.keys())}"
            )
        
        field_name = valid_metrics[metric]
        
        # Агрегация для получения топа
        pipeline = [
            {
                "$match": {
                    field_name: {"$gt": 0}
                }
            },
            {
                "$sort": {field_name: -1}
            },
            {
                "$limit": limit
            },
            {
                "$lookup": {
                    "from": "user_settings",
                    "localField": "telegram_id",
                    "foreignField": "telegram_id",
                    "as": "user_info"
                }
            },
            {
                "$unwind": "$user_info"
            },
            {
                "$project": {
                    "telegram_id": 1,
                    "value": f"${field_name}",
                    "username": "$user_info.username",
                    "first_name": "$user_info.first_name",
                    "group_name": "$user_info.group_name"
                }
            }
        ]
        
        results = await db.user_stats.aggregate(pipeline).to_list(length=None)
        
        # Преобразуем результат
        top_users = [
            TopUser(
                telegram_id=result["telegram_id"],
                value=result["value"],
                username=result.get("username"),
                first_name=result.get("first_name"),
                group_name=result.get("group_name")
            )
            for result in results
        ]
        
        return top_users
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении топа пользователей: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/admin/faculty-stats")
async def get_faculty_stats():
    """
    Получить статистику по факультетам
    """
    try:
        # Агрегация по факультетам
        pipeline = [
            {
                "$match": {
                    "facultet_name": {"$ne": None, "$exists": True}
                }
            },
            {
                "$group": {
                    "_id": "$facultet_name",
                    "faculty_id_first": {"$first": "$facultet_id"},
                    "users_count": {"$sum": 1}
                }
            },
            {
                "$sort": {"users_count": -1}
            }
        ]
        
        results = await db.user_settings.aggregate(pipeline).to_list(length=None)
        
        # Преобразуем результат
        faculty_stats = [
            FacultyStats(
                faculty_name=result["_id"],
                faculty_id=result.get("faculty_id_first"),
                users_count=result["users_count"]
            )
            for result in results
        ]
        
        return faculty_stats
    
    except Exception as e:
        import traceback
        logger.error(f"Ошибка при получении статистики факультетов: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/admin/course-stats", response_model=List[CourseStats])
async def get_course_stats():
    """
    Получить статистику по курсам
    """
    try:
        # Агрегация по курсам
        pipeline = [
            {
                "$match": {
                    "kurs": {"$ne": None, "$exists": True}
                }
            },
            {
                "$group": {
                    "_id": "$kurs",
                    "users_count": {"$sum": 1}
                }
            },
            {
                "$sort": {"_id": 1}
            }
        ]
        
        results = await db.user_settings.aggregate(pipeline).to_list(length=None)
        
        # Преобразуем результат
        course_stats = [
            CourseStats(
                course=result["_id"],
                users_count=result["users_count"]
            )
            for result in results
        ]
        
        return course_stats
    
    except Exception as e:
        logger.error(f"Ошибка при получении статистики курсов: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# ============ Экспорт/Импорт базы данных ============

@api_router.get("/export/database")
async def export_database():
    """
    Экспорт всей базы данных в JSON формате
    Возвращает все коллекции с данными
    """
    try:
        logger.info("Starting database export...")
        
        # Список коллекций для экспорта
        collections_to_export = [
            "user_settings",
            "user_stats",
            "user_achievements",
            "tasks",
            "rooms",
            "room_participants",
            "group_tasks"
        ]
        
        export_data = {
            "export_date": datetime.utcnow().isoformat(),
            "database": "rudn_schedule",
            "collections": {}
        }
        
        # Экспортируем каждую коллекцию
        for collection_name in collections_to_export:
            try:
                collection = db[collection_name]
                documents = await collection.find().to_list(length=None)
                
                # Конвертируем ObjectId и datetime в строки
                for doc in documents:
                    if '_id' in doc:
                        doc['_id'] = str(doc['_id'])
                    for key, value in doc.items():
                        if isinstance(value, datetime):
                            doc[key] = value.isoformat()
                
                export_data["collections"][collection_name] = {
                    "count": len(documents),
                    "data": documents
                }
                
                logger.info(f"Exported {len(documents)} documents from {collection_name}")
            
            except Exception as e:
                logger.error(f"Error exporting collection {collection_name}: {e}")
                export_data["collections"][collection_name] = {
                    "count": 0,
                    "data": [],
                    "error": str(e)
                }
        
        # Добавляем статистику
        total_documents = sum(
            col_data["count"] 
            for col_data in export_data["collections"].values()
        )
        export_data["total_documents"] = total_documents
        export_data["total_collections"] = len(collections_to_export)
        
        logger.info(f"Database export completed: {total_documents} documents from {len(collections_to_export)} collections")
        
        return JSONResponse(content=export_data)
    
    except Exception as e:
        logger.error(f"Error during database export: {e}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@api_router.get("/export/collection/{collection_name}")
async def export_collection(collection_name: str):
    """
    Экспорт отдельной коллекции в JSON формате
    """
    try:
        allowed_collections = [
            "user_settings", "user_stats", "user_achievements",
            "tasks", "rooms", "room_participants", "group_tasks"
        ]
        
        if collection_name not in allowed_collections:
            raise HTTPException(
                status_code=400, 
                detail=f"Collection not allowed. Allowed: {', '.join(allowed_collections)}"
            )
        
        collection = db[collection_name]
        documents = await collection.find().to_list(length=None)
        
        # Конвертируем ObjectId и datetime в строки
        for doc in documents:
            if '_id' in doc:
                doc['_id'] = str(doc['_id'])
            for key, value in doc.items():
                if isinstance(value, datetime):
                    doc[key] = value.isoformat()
        
        export_data = {
            "collection": collection_name,
            "export_date": datetime.utcnow().isoformat(),
            "count": len(documents),
            "data": documents
        }
        
        logger.info(f"Exported {len(documents)} documents from {collection_name}")
        
        return JSONResponse(content=export_data)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting collection {collection_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/backup/stats")
async def backup_stats():
    """
    Получить статистику базы данных для бэкапа
    """
    try:
        collections = [
            "user_settings", "user_stats", "user_achievements",
            "tasks", "rooms", "room_participants", "group_tasks"
        ]
        
        stats = {
            "database": "rudn_schedule",
            "timestamp": datetime.utcnow().isoformat(),
            "collections": {}
        }
        
        total_size = 0
        total_documents = 0
        
        for collection_name in collections:
            collection = db[collection_name]
            count = await collection.count_documents({})
            
            stats["collections"][collection_name] = {
                "documents": count
            }
            
            total_documents += count
        
        stats["total_collections"] = len(collections)
        stats["total_documents"] = total_documents
        
        return stats
    
    except Exception as e:
        logger.error(f"Error getting backup stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# Include the router in the main app
app.include_router(api_router)


# ============ События жизненного цикла приложения ============

@app.on_event("startup")
async def startup_event():
    """Инициализация при запуске приложения"""
    logger.info("Starting RUDN Schedule API...")
    
    # Создаем индексы для коллекций
    try:
        # Уникальный индекс для sent_notifications (старая система)
        await db.sent_notifications.create_index(
            [("notification_key", 1)],
            unique=True,
            name="unique_notification_key"
        )
        
        # Индексы для новой системы scheduled_notifications
        await db.scheduled_notifications.create_index(
            [("notification_key", 1)],
            unique=True,
            name="unique_scheduled_notification_key"
        )
        await db.scheduled_notifications.create_index(
            [("telegram_id", 1), ("date", 1)],
            name="user_date_index"
        )
        await db.scheduled_notifications.create_index(
            [("status", 1), ("date", 1)],
            name="status_date_index"
        )
        await db.scheduled_notifications.create_index(
            [("scheduled_time", 1)],
            name="scheduled_time_index"
        )
        
        logger.info("✅ Database indexes created successfully")
    except Exception as e:
        logger.warning(f"Index creation warning (may already exist): {e}")
    
    # Запускаем НОВЫЙ планировщик уведомлений V2
    try:
        scheduler_v2 = get_scheduler_v2(db)
        scheduler_v2.start()
        logger.info("✅ Notification Scheduler V2 started successfully")
    except Exception as e:
        logger.error(f"❌ Failed to start notification scheduler V2: {e}")
        # Fallback на старую систему в случае ошибки
        try:
            logger.info("Attempting fallback to old scheduler...")
            scheduler = get_scheduler(db)
            scheduler.start()
            logger.info("⚠️ Fallback: Old notification scheduler started")
        except Exception as fallback_error:
            logger.error(f"❌ Fallback also failed: {fallback_error}")
    
    # Запускаем Telegram бота как background task
    try:
        global bot_application
        from telegram import Update
        from telegram.ext import Application, CommandHandler
        
        # Импортируем обработчики команд
        import sys
        sys.path.insert(0, '/app/backend')
        from telegram_bot import start_command, users_command, clear_db_command, TELEGRAM_BOT_TOKEN
        
        if TELEGRAM_BOT_TOKEN:
            # Создаем приложение бота
            bot_application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
            
            # Регистрируем обработчики
            bot_application.add_handler(CommandHandler("start", start_command))
            bot_application.add_handler(CommandHandler("users", users_command))
            bot_application.add_handler(CommandHandler("clear_db", clear_db_command))
            
            # Запускаем бота в фоне
            async def start_bot():
                await bot_application.initialize()
                await bot_application.start()
                await bot_application.updater.start_polling(
                    allowed_updates=Update.ALL_TYPES,
                    drop_pending_updates=True
                )
                logger.info("✅ Telegram bot polling started successfully")
            
            # Создаем background task
            asyncio.create_task(start_bot())
            logger.info("Telegram bot initialization started as background task")
        else:
            logger.warning("TELEGRAM_BOT_TOKEN not found, bot not started")
    except Exception as e:
        logger.error(f"Failed to start Telegram bot: {e}", exc_info=True)


@app.on_event("shutdown")
async def shutdown_db_client():
    """Очистка ресурсов при остановке"""
    logger.info("Shutting down RUDN Schedule API...")
    
    # Останавливаем Telegram бота
    global bot_application
    if bot_application:
        try:
            logger.info("Stopping Telegram bot...")
            await bot_application.updater.stop()
            await bot_application.stop()
            await bot_application.shutdown()
            logger.info("Telegram bot stopped")
        except Exception as e:
            logger.error(f"Error stopping Telegram bot: {e}")
    
    # Останавливаем планировщик V2
    try:
        scheduler_v2 = get_scheduler_v2(db)
        scheduler_v2.stop()
        logger.info("✅ Notification Scheduler V2 stopped")
    except Exception as e:
        logger.error(f"Error stopping scheduler V2: {e}")
        # Пытаемся остановить старый планировщик на всякий случай
        try:
            scheduler = get_scheduler(db)
            scheduler.stop()
        except:
            pass
    
    # Закрываем подключение к БД
    client.close()
    logger.info("Database connection closed")

# ============ Admin Panel Endpoints ============

@api_router.get("/admin/stats", response_model=AdminStatsResponse)
async def get_admin_stats(days: Optional[int] = None):
    """Get general statistics for admin panel"""
    now = datetime.utcnow()
    start_date = None
    if days:
        start_date = now - timedelta(days=days)

    # Helper to apply date filter
    def date_filter(field_name="created_at"):
        return {field_name: {"$gte": start_date}} if start_date else {}

    # 1. Total Users
    total_users = await db.user_settings.count_documents(date_filter("created_at"))
    
    # 2. Active Users Today (using updated_at or last_activity from user_settings or user_stats)
    today_start = datetime(now.year, now.month, now.day)
    active_users_today = await db.user_settings.count_documents({"last_activity": {"$gte": today_start}})
    
    # 3. New Users Week
    week_ago = now - timedelta(days=7)
    new_users_week = await db.user_settings.count_documents({"created_at": {"$gte": week_ago}})
    
    # 4. Tasks
    total_tasks = await db.tasks.count_documents(date_filter("created_at"))
    total_completed_tasks = await db.tasks.count_documents({"completed": True, **date_filter("created_at")})
    
    # 5. Achievements (using user_achievements collection)
    total_achievements_earned = await db.user_achievements.count_documents(date_filter("earned_at"))
    
    # 6. Rooms
    total_rooms = await db.rooms.count_documents(date_filter("created_at"))

    return AdminStatsResponse(
        total_users=total_users,
        active_users_today=active_users_today,
        new_users_week=new_users_week,
        total_tasks=total_tasks,
        total_completed_tasks=total_completed_tasks,
        total_achievements_earned=total_achievements_earned,
        total_rooms=total_rooms
    )

@api_router.get("/admin/users-activity", response_model=List[UserActivityPoint])
async def get_users_activity(days: Optional[int] = 30):
    """Get user registration activity over time"""
    if not days:
        days = 30
        
    start_date = datetime.utcnow() - timedelta(days=days)
    
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {
            "$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    results = await db.user_settings.aggregate(pipeline).to_list(None)
    return [UserActivityPoint(date=r["_id"], count=r["count"]) for r in results]

@api_router.get("/admin/hourly-activity", response_model=List[HourlyActivityPoint])
async def get_hourly_activity(days: Optional[int] = 30):
    """Get activity distribution by hour of day (based on tasks creation)"""
    # We use tasks as a proxy for activity
    start_date = datetime.utcnow() - timedelta(days=days if days else 30)
    
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {
            "$project": {
                "hour": {"$hour": "$created_at"}
            }
        },
        {
            "$group": {
                "_id": "$hour",
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    results = await db.tasks.aggregate(pipeline).to_list(None)
    
    # Fill missing hours
    hours_map = {r["_id"]: r["count"] for r in results}
    return [HourlyActivityPoint(hour=h, count=hours_map.get(h, 0)) for h in range(24)]

@api_router.get("/admin/weekly-activity")
async def get_weekly_activity(days: Optional[int] = 30):
    """Get activity distribution by day of week"""
    # Using tasks as proxy
    start_date = datetime.utcnow() - timedelta(days=days if days else 30)
    
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {
            "$project": {
                # MongoDB $dayOfWeek: 1 (Sun) - 7 (Sat)
                "day": {"$dayOfWeek": "$created_at"}
            }
        },
        {
            "$group": {
                "_id": "$day",
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    results = await db.tasks.aggregate(pipeline).to_list(None)
    
    # Map 1-7 to Mon-Sun strings
    days_map = {
        1: "Вс", 2: "Пн", 3: "Вт", 4: "Ср", 5: "Чт", 6: "Пт", 7: "Сб"
    }
    
    data_map = {r["_id"]: r["count"] for r in results}
    
    # Order: Mon to Sun (2,3,4,5,6,7,1)
    ordered_keys = [2, 3, 4, 5, 6, 7, 1]
    
    return [
        {"day": days_map[k], "count": data_map.get(k, 0)}
        for k in ordered_keys
    ]

@api_router.get("/admin/feature-usage", response_model=FeatureUsageStats)
async def get_feature_usage(days: Optional[int] = None):
    """Get aggregated feature usage stats"""
    pipeline = [
        {
            "$group": {
                "_id": None,
                "schedule_views": {"$sum": "$schedule_views"},
                "analytics_views": {"$sum": "$analytics_views"},
                "calendar_opens": {"$sum": "$calendar_opens"},
                "notifications_configured": {"$sum": {"$cond": ["$notifications_configured", 1, 0]}},
                "schedule_shares": {"$sum": "$schedule_shares"},
                "tasks_created": {"$sum": "$tasks_created_total"},
                "achievements_earned": {"$sum": "$achievements_count"}
            }
        }
    ]
    
    result = await db.user_stats.aggregate(pipeline).to_list(1)
    if not result:
        return FeatureUsageStats(
            schedule_views=0, analytics_views=0, calendar_opens=0,
            notifications_configured=0, schedule_shares=0, tasks_created=0, achievements_earned=0
        )
        
    r = result[0]
    return FeatureUsageStats(
        schedule_views=r.get("schedule_views", 0),
        analytics_views=r.get("analytics_views", 0),
        calendar_opens=r.get("calendar_opens", 0),
        notifications_configured=r.get("notifications_configured", 0),
        schedule_shares=r.get("schedule_shares", 0),
        tasks_created=r.get("tasks_created", 0),
        achievements_earned=r.get("achievements_earned", 0)
    )

@api_router.get("/admin/top-users", response_model=List[TopUser])
async def get_top_users(metric: str = "points", limit: int = 10):
    """Get top users by metric"""
    sort_field = "total_points"
    if metric == "achievements":
        sort_field = "achievements_count"
        
    users_stats = await db.user_stats.find().sort(sort_field, -1).limit(limit).to_list(limit)
    
    result = []
    for stat in users_stats:
        telegram_id = stat["telegram_id"]
        # Fetch user details
        user_settings = await db.user_settings.find_one({"telegram_id": telegram_id})
        
        name = "Unknown"
        username = None
        group_name = None
        
        if user_settings:
            name = user_settings.get("first_name", "Unknown")
            username = user_settings.get("username")
            group_name = user_settings.get("group_name")
            
        result.append(TopUser(
            telegram_id=telegram_id,
            username=username,
            first_name=name,
            value=stat.get(sort_field, 0),
            group_name=group_name
        ))
        
    return result

@api_router.get("/admin/faculty-stats", response_model=List[FacultyStats])
async def get_faculty_stats():
    """Get user distribution by faculty"""
    pipeline = [
        {
            "$group": {
                "_id": "$facultet_name",
                "count": {"$sum": 1},
                "facultet_id": {"$first": "$facultet_id"}
            }
        },
        {"$sort": {"count": -1}}
    ]
    
    results = await db.user_settings.aggregate(pipeline).to_list(None)
    
    return [
        FacultyStats(
            faculty_name=r["_id"] or "Неизвестно",
            users_count=r["count"],
            faculty_id=r.get("facultet_id")
        )
        for r in results
    ]

@api_router.get("/admin/course-stats", response_model=List[CourseStats])
async def get_course_stats():
    """Get user distribution by course"""
    pipeline = [
        {
            "$group": {
                "_id": "$kurs",
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    results = await db.user_settings.aggregate(pipeline).to_list(None)
    
    return [
        CourseStats(
            course=str(r["_id"]) if r["_id"] else "Неизвестно",
            users_count=r["count"]
        )
        for r in results
    ]
