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
from itertools import groupby
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
    ThemeMode,
    ThemeSettingsUpdate,
    ThemeSettingsResponse,
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
    TaskProductivityStats,
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
    ReferralConnection,
    ProcessReferralRequest,
    PlannerSyncRequest,
    ProcessReferralResponse,
    # Модели для журнала посещений
    AttendanceJournal,
    JournalCreate,
    JournalStudent,
    JournalStudentCreate,
    JournalStudentBulkCreate,
    JournalStudentLink,
    JournalSubject,
    JournalSubjectCreate,
    JournalSession,
    JournalSessionCreate,
    ScheduleSessionItem,
    CreateSessionsFromScheduleRequest,
    AttendanceRecord,
    AttendanceRecordCreate,
    AttendanceBulkCreate,
    JournalPendingMember,
    JournalJoinRequest,
    JournalResponse,
    JournalStudentResponse,
    JournalSessionResponse,
    AttendanceRecordResponse,
    JournalStatsResponse,
    SubjectStatsResponse,
    JournalInviteLinkResponse,
    StudentInviteLinkResponse,
    JoinStudentRequest,
    ProcessJournalInviteRequest,
    MyAttendanceResponse,
    JournalSettings,
    # Модели для отслеживания реферальных событий
    ReferralEvent,
    ReferralEventResponse,
    ReferralStatsDetailResponse,
    # Модели для истории уведомлений
    NotificationHistoryItem,
    NotificationHistoryResponse
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
from config import get_telegram_bot_token, get_telegram_bot_username, is_test_environment, ENV


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


# ============ Database Indexes Optimization ============
async def create_indexes():
    """Create indexes for all collections to ensure scalability"""
    try:
        # User Settings
        await db.user_settings.create_index("telegram_id", unique=True)
        await db.user_settings.create_index("group_id")
        
        # Tasks (Compound index for filtering by user and completion status)
        await db.tasks.create_index([("telegram_id", 1), ("completed", 1)])
        
        # Rooms
        await db.rooms.create_index("owner_id")
        await db.rooms.create_index("participants.telegram_id")
        await db.rooms.create_index("invite_token", unique=True)
        
        # Group Tasks
        await db.group_tasks.create_index("room_id")
        await db.group_tasks.create_index([("participants.telegram_id", 1), ("completed", 1)])
        
        # Journals & Attendance
        await db.journals.create_index("owner_id")
        await db.journals.create_index("invite_token", unique=True)
        
        await db.journal_students.create_index("journal_id")
        await db.journal_students.create_index("telegram_id")
        await db.journal_students.create_index("invite_code", unique=True)
        
        # Compound index for fast attendance lookups
        await db.attendance_records.create_index([("journal_id", 1), ("session_id", 1)])
        await db.attendance_records.create_index([("journal_id", 1), ("student_id", 1)])
        
        # Scheduled Notifications
        await db.scheduled_notifications.create_index("notification_key", unique=True)
        await db.scheduled_notifications.create_index([("date", 1), ("status", 1)])
        
        # Referral System
        await db.referral_events.create_index("telegram_id")
        await db.referral_events.create_index("referrer_id")
        
        # Notification History
        await db.notification_history.create_index([("telegram_id", 1), ("sent_at", -1)])
        
        logger.info("✅ Database indexes created successfully")
    except Exception as e:
        logger.error(f"❌ Failed to create database indexes: {e}")

@app.on_event("startup")
async def startup_event():
    # Start background tasks
    asyncio.create_task(create_indexes())

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



@api_router.get("/user-settings/{telegram_id}/history", response_model=NotificationHistoryResponse)
async def get_notification_history(telegram_id: int, limit: int = 20, offset: int = 0):
    """Получить историю уведомлений пользователя"""
    try:
        total = await db.notification_history.count_documents({"telegram_id": telegram_id})
        
        history_cursor = db.notification_history.find({"telegram_id": telegram_id}) \
            .sort("sent_at", -1) \
            .skip(offset) \
            .limit(limit)
            
        history = await history_cursor.to_list(None)
        
        # Конвертируем _id
        for item in history:
            if "_id" in item:
                del item["_id"]
                
        return NotificationHistoryResponse(history=history, count=total)
    except Exception as e:
        logger.error(f"Ошибка при получении истории уведомлений: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/user/{telegram_id}", response_model=SuccessResponse)
async def delete_user_account(telegram_id: int):
    """
    Полное удаление аккаунта пользователя и всех связанных данных.
    Удаляет: настройки, статистику, достижения, задачи, участие в комнатах.
    """
    try:
        deleted_counts = {}
        
        # 1. Удаляем настройки пользователя
        result = await db.user_settings.delete_one({"telegram_id": telegram_id})
        deleted_counts["user_settings"] = result.deleted_count
        
        # 2. Удаляем статистику
        result = await db.user_stats.delete_one({"telegram_id": telegram_id})
        deleted_counts["user_stats"] = result.deleted_count
        
        # 3. Удаляем достижения
        result = await db.user_achievements.delete_many({"telegram_id": telegram_id})
        deleted_counts["user_achievements"] = result.deleted_count
        
        # 4. Удаляем личные задачи
        result = await db.tasks.delete_many({"telegram_id": telegram_id})
        deleted_counts["tasks"] = result.deleted_count
        
        # 5. Удаляем из участников комнат
        await db.rooms.update_many(
            {"participants.telegram_id": telegram_id},
            {"$pull": {"participants": {"telegram_id": telegram_id}}}
        )
        
        # 6. Удаляем комнаты где пользователь владелец (и все связанные задачи)
        owned_rooms = await db.rooms.find({"owner_id": telegram_id}).to_list(None)
        for room in owned_rooms:
            await db.group_tasks.delete_many({"room_id": room["room_id"]})
        result = await db.rooms.delete_many({"owner_id": telegram_id})
        deleted_counts["owned_rooms"] = result.deleted_count
        
        # 7. Удаляем из участников групповых задач
        await db.group_tasks.update_many(
            {"participants.telegram_id": telegram_id},
            {"$pull": {"participants": {"telegram_id": telegram_id}}}
        )
        
        # 8. Удаляем из pending members журналов
        await db.journal_pending_members.delete_many({"telegram_id": telegram_id})
        
        # 9. Удаляем связи со студентами журналов
        await db.journal_students.update_many(
            {"telegram_id": telegram_id},
            {"$set": {"telegram_id": None, "is_linked": False}}
        )
        
        # 10. Удаляем журналы где пользователь владелец
        owned_journals = await db.attendance_journals.find({"owner_id": telegram_id}).to_list(None)
        for journal in owned_journals:
            await db.journal_students.delete_many({"journal_id": journal["journal_id"]})
            await db.journal_sessions.delete_many({"journal_id": journal["journal_id"]})
            await db.attendance_records.delete_many({"journal_id": journal["journal_id"]})
        result = await db.attendance_journals.delete_many({"owner_id": telegram_id})
        deleted_counts["owned_journals"] = result.deleted_count
        
        # 11. Удаляем реферальные события
        await db.referral_events.delete_many({"telegram_id": telegram_id})
        
        # 12. Удаляем реферальные связи
        await db.referral_connections.delete_many({
            "$or": [
                {"referrer_telegram_id": telegram_id},
                {"referred_telegram_id": telegram_id}
            ]
        })
        
        logger.info(f"✅ Аккаунт пользователя {telegram_id} полностью удален. Статистика: {deleted_counts}")
        
        return SuccessResponse(
            success=True, 
            message=f"Аккаунт и все данные удалены. Удалено записей: {sum(deleted_counts.values())}"
        )
    except Exception as e:
        logger.error(f"Ошибка при удалении аккаунта пользователя {telegram_id}: {e}")
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


@api_router.put("/user-settings/{telegram_id}/theme", response_model=ThemeSettingsResponse)
async def update_theme_settings(telegram_id: int, settings: ThemeSettingsUpdate):
    """Обновить настройки темы пользователя"""
    try:
        # Проверяем существование пользователя
        user = await db.user_settings.find_one({"telegram_id": telegram_id})
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Обновляем настройки темы
        await db.user_settings.update_one(
            {"telegram_id": telegram_id},
            {"$set": {
                "new_year_theme_mode": settings.new_year_theme_mode.value,
                "updated_at": datetime.utcnow()
            }}
        )
        
        return ThemeSettingsResponse(
            new_year_theme_mode=settings.new_year_theme_mode.value,
            telegram_id=telegram_id
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при обновлении настроек темы: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/user-settings/{telegram_id}/theme", response_model=ThemeSettingsResponse)
async def get_theme_settings(telegram_id: int):
    """Получить настройки темы пользователя"""
    try:
        user = await db.user_settings.find_one({"telegram_id": telegram_id})
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Миграция старых данных: если есть old boolean поле, конвертируем
        theme_mode = user.get("new_year_theme_mode")
        if theme_mode is None:
            # Миграция: boolean -> enum
            old_enabled = user.get("new_year_theme_enabled", True)
            theme_mode = "always" if old_enabled else "off"
            # Сохраняем новое значение
            await db.user_settings.update_one(
                {"telegram_id": telegram_id},
                {"$set": {"new_year_theme_mode": theme_mode}}
            )
        
        return ThemeSettingsResponse(
            new_year_theme_mode=theme_mode,
            telegram_id=telegram_id
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении настроек темы: {e}")
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
        
        bot_token = get_telegram_bot_token()
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
        
        bot_token = get_telegram_bot_token()
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
        
        bot_token = get_telegram_bot_token()
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



@api_router.post("/planner/sync", response_model=List[TaskResponse])
async def sync_schedule_to_planner(request: PlannerSyncRequest):
    """Синхронизировать расписания в планировщик"""
    try:
        created_tasks = []
        try:
            target_date = datetime.strptime(request.date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
            
        for event in request.events:
            # Parse time "09:00 - 10:30"
            start_time = None
            end_time = None
            if event.time:
                times = event.time.split("-") # Usually "09:00-10:30" or "09:00 - 10:30"
                if len(times) == 1:
                     times = event.time.split(" - ")
                
                if len(times) >= 2:
                    start_time = times[0].strip()
                    end_time = times[1].strip()
                elif len(times) == 1:
                    start_time = times[0].strip()
            
            # Check duplicate
            # We look for a fixed task on this date with same start time and subject
            existing = await db.tasks.find_one({
                "telegram_id": request.telegram_id,
                "target_date": target_date,
                "time_start": start_time,
                "origin": "schedule",
                "subject": event.discipline
            })
            
            if existing:
                continue
                
            # Create task
            task_data = Task(
                telegram_id=request.telegram_id,
                text=f"{event.discipline} ({event.lessonType})" if event.lessonType else event.discipline,
                category="study",
                priority="high",
                target_date=target_date,
                subject=event.discipline,
                discipline_id=None, # Could add hash here
                time_start=start_time,
                time_end=end_time,
                is_fixed=True,
                origin="schedule",
                order=0 
            )
            
            await db.tasks.insert_one(task_data.dict())
            created_tasks.append(task_data)
            
        return [TaskResponse(**t.dict()) for t in created_tasks]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing planner: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/planner/{telegram_id}/{date}", response_model=List[TaskResponse])
async def get_planner_tasks(telegram_id: int, date: str):
    """Получить задачи на день"""
    try:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        tasks = await db.tasks.find({
            "telegram_id": telegram_id,
            "target_date": target_date
        }).sort("time_start", 1).to_list(1000)
        
        return [TaskResponse(**t) for t in tasks]
    except HTTPException:
        raise
    except Exception as e:
         logger.error(f"Error getting planner tasks: {e}")
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
        is_uncompleting = task_update.completed is False and existing_task.get("completed", False)
        
        # Обновляем только переданные поля
        update_data = {}
        if task_update.text is not None:
            update_data["text"] = task_update.text
        if task_update.completed is not None:
            update_data["completed"] = task_update.completed
            # Если задача выполняется - записываем время выполнения
            if is_completing:
                update_data["completed_at"] = datetime.utcnow()
            # Если задача снимается с выполнения - очищаем время
            elif is_uncompleting:
                update_data["completed_at"] = None
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


@api_router.get("/tasks/{telegram_id}/productivity-stats", response_model=TaskProductivityStats)
async def get_productivity_stats(telegram_id: int):
    """Получить статистику продуктивности по задачам пользователя"""
    try:
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Начало недели (понедельник)
        week_start = today_start - timedelta(days=today_start.weekday())
        
        # Начало месяца
        month_start = today_start.replace(day=1)
        
        # Получаем все выполненные задачи пользователя
        completed_tasks = await db.tasks.find({
            "telegram_id": telegram_id,
            "completed": True
        }).to_list(length=None)
        
        total_completed = len(completed_tasks)
        
        # Подсчёт выполненных за разные периоды
        completed_today = 0
        completed_this_week = 0
        completed_this_month = 0
        
        # Собираем уникальные даты выполнения для расчёта streak
        completion_dates = set()
        
        for task in completed_tasks:
            completed_at = task.get("completed_at")
            if completed_at:
                if isinstance(completed_at, str):
                    completed_at = datetime.fromisoformat(completed_at.replace('Z', '+00:00'))
                
                # Дата выполнения (без времени)
                completion_date = completed_at.replace(hour=0, minute=0, second=0, microsecond=0)
                completion_dates.add(completion_date.date())
                
                # Подсчёт по периодам
                if completed_at >= today_start:
                    completed_today += 1
                if completed_at >= week_start:
                    completed_this_week += 1
                if completed_at >= month_start:
                    completed_this_month += 1
        
        # Расчёт streak (серии дней подряд)
        current_streak = 0
        best_streak = 0
        streak_dates = []
        
        if completion_dates:
            # Сортируем даты по убыванию (от самой новой)
            sorted_dates = sorted(completion_dates, reverse=True)
            
            # Проверяем текущий streak (начиная с сегодня или вчера)
            today = now.date()
            yesterday = (now - timedelta(days=1)).date()
            
            # Начинаем считать streak если сегодня или вчера была выполнена задача
            if sorted_dates[0] == today or sorted_dates[0] == yesterday:
                current_streak = 1
                streak_dates.append(sorted_dates[0].isoformat())
                
                # Считаем последовательные дни
                for i in range(1, len(sorted_dates)):
                    expected_date = sorted_dates[i-1] - timedelta(days=1)
                    if sorted_dates[i] == expected_date:
                        current_streak += 1
                        streak_dates.append(sorted_dates[i].isoformat())
                    else:
                        break
            
            # Находим лучший streak за всё время
            temp_streak = 1
            for i in range(1, len(sorted_dates)):
                expected_date = sorted_dates[i-1] - timedelta(days=1)
                if sorted_dates[i] == expected_date:
                    temp_streak += 1
                else:
                    best_streak = max(best_streak, temp_streak)
                    temp_streak = 1
            best_streak = max(best_streak, temp_streak, current_streak)
        
        # Статистика по последним 7 дням
        daily_stats = []
        for i in range(6, -1, -1):
            day = (today_start - timedelta(days=i)).date()
            day_name = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][day.weekday()]
            count = 1 if day in completion_dates else 0
            
            # Подсчитываем количество выполненных задач за этот день
            day_count = 0
            for task in completed_tasks:
                completed_at = task.get("completed_at")
                if completed_at:
                    if isinstance(completed_at, str):
                        completed_at = datetime.fromisoformat(completed_at.replace('Z', '+00:00'))
                    if completed_at.date() == day:
                        day_count += 1
            
            daily_stats.append({
                "date": day.isoformat(),
                "day_name": day_name,
                "count": day_count,
                "has_completed": day in completion_dates
            })
        
        return TaskProductivityStats(
            total_completed=total_completed,
            completed_today=completed_today,
            completed_this_week=completed_this_week,
            completed_this_month=completed_this_month,
            current_streak=current_streak,
            best_streak=best_streak,
            streak_dates=streak_dates,
            daily_stats=daily_stats
        )
    except Exception as e:
        logger.error(f"Ошибка при получении статистики продуктивности: {e}")
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
        
        bot_token = get_telegram_bot_token()
        if not bot_token:
            logger.warning("⚠️ Токен бота не настроен, уведомления не отправлены")
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
        
        # Получаем имя бота из конфига (зависит от ENV)
        # ENV=test -> rudn_pro_bot, ENV=production -> rudn_mosbot
        bot_username = get_telegram_bot_username()
        
        # Формируем ссылку с реферальным кодом (Web App формат для прямого открытия приложения)
        invite_token = room_doc.get("invite_token")
        invite_link = f"https://t.me/{bot_username}/app?startapp=room_{invite_token}_ref_{telegram_id}"
        
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
        
        # Логируем реферальное событие (новый участник)
        referral_event = ReferralEvent(
            event_type="room_join",
            telegram_id=join_data.telegram_id,
            referrer_id=join_data.referral_code,
            target_id=room_doc["room_id"],
            target_name=room_doc.get("name", ""),
            invite_token=invite_token,
            is_new_member=True
        )
        await db.referral_events.insert_one(referral_event.model_dump())
        logger.info(f"Referral event logged: room_join, user={join_data.telegram_id}, referrer={join_data.referral_code}, room={room_doc['room_id']}")
        
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
        
        # Определяем список участников задачи
        participants = [owner_participant]
        
        # Если assigned_to не указан или пустой - добавляем всех участников комнаты
        # Если assigned_to указан - добавляем только выбранных участников
        assigned_ids = task_data.assigned_to if task_data.assigned_to else None
        
        for room_participant in room_doc.get("participants", []):
            participant_id = room_participant["telegram_id"]
            # Пропускаем создателя (он уже добавлен как owner)
            if participant_id == task_data.telegram_id:
                continue
            # Если есть список assigned_to, добавляем только выбранных
            if assigned_ids is not None and participant_id not in assigned_ids:
                continue
            task_participant = GroupTaskParticipant(
                telegram_id=participant_id,
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
    """Обновить групповую задачу (название, описание, дедлайн, категорию, приоритет, теги, участников)"""
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
        
        # Обработка изменения участников задачи
        if update_data.assigned_to is not None:
            room_id = task_doc.get("room_id")
            if room_id:
                room_doc = await db.rooms.find_one({"room_id": room_id})
                if room_doc:
                    owner_id = task_doc.get("owner_id")
                    current_participants = task_doc.get("participants", [])
                    
                    # Сохраняем информацию о выполнении для текущих участников
                    completion_status = {p["telegram_id"]: p.get("completed", False) for p in current_participants}
                    completion_times = {p["telegram_id"]: p.get("completed_at") for p in current_participants}
                    
                    # Создаем новый список участников
                    new_participants = []
                    
                    # Добавляем владельца задачи
                    owner_info = next(
                        (p for p in room_doc.get("participants", []) if p["telegram_id"] == owner_id),
                        None
                    )
                    if owner_info:
                        new_participants.append({
                            "telegram_id": owner_id,
                            "username": owner_info.get("username"),
                            "first_name": owner_info.get("first_name", "User"),
                            "role": "owner",
                            "completed": completion_status.get(owner_id, False),
                            "completed_at": completion_times.get(owner_id),
                            "joined_at": datetime.utcnow()
                        })
                    
                    # Если assigned_to пустой список - добавляем всех участников комнаты
                    # Если assigned_to заполнен - добавляем только выбранных
                    assigned_ids = update_data.assigned_to if update_data.assigned_to else None
                    
                    for room_participant in room_doc.get("participants", []):
                        participant_id = room_participant["telegram_id"]
                        if participant_id == owner_id:
                            continue
                        if assigned_ids is not None and len(assigned_ids) > 0 and participant_id not in assigned_ids:
                            continue
                        new_participants.append({
                            "telegram_id": participant_id,
                            "username": room_participant.get("username"),
                            "first_name": room_participant.get("first_name", "User"),
                            "role": "member",
                            "completed": completion_status.get(participant_id, False),
                            "completed_at": completion_times.get(participant_id),
                            "joined_at": datetime.utcnow()
                        })
                    
                    update_fields["participants"] = new_participants
        
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
        
        # Получаем имя бота из конфига (зависит от ENV)
        # ENV=test -> rudn_pro_bot, ENV=production -> rudn_mosbot
        bot_username = get_telegram_bot_username()
        
        # Формируем реферальные ссылки
        # Старый формат через /start (для совместимости)
        referral_link = f"https://t.me/{bot_username}?start=ref_{referral_code}"
        # Новый формат через Web App (рекомендуемый)
        referral_link_webapp = f"https://t.me/{bot_username}/app?startapp=ref_{referral_code}"
        
        return ReferralCodeResponse(
            referral_code=referral_code,
            referral_link=referral_link,
            referral_link_webapp=referral_link_webapp,
            bot_username=bot_username
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении реферального кода: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/referral/process-webapp", response_model=ProcessReferralResponse)
async def process_referral_webapp(request: ProcessReferralRequest):
    """
    Обработать реферальный код через Web App.
    Вызывается при открытии приложения по ссылке t.me/bot/app?startapp=ref_CODE
    """
    try:
        telegram_id = request.telegram_id
        referral_code = request.referral_code
        
        logger.info(f"🔗 Обработка реферального кода через Web App: {referral_code} для пользователя {telegram_id}")
        
        # Проверяем существование пользователя
        user = await db.user_settings.find_one({"telegram_id": telegram_id})
        
        if not user:
            # Новый пользователь - создаём запись
            logger.info(f"👤 Новый пользователь {telegram_id} через реферальную ссылку Web App")
            
            # Ищем пригласившего по реферальному коду
            referrer = await db.user_settings.find_one({"referral_code": referral_code})
            
            if not referrer:
                logger.warning(f"⚠️ Реферальный код {referral_code} не найден")
                return ProcessReferralResponse(
                    success=False,
                    message="Реферальный код не найден"
                )
            
            referrer_id = referrer.get("telegram_id")
            
            # Проверяем, что пользователь не пытается пригласить сам себя
            if referrer_id == telegram_id:
                return ProcessReferralResponse(
                    success=False,
                    message="Нельзя использовать собственный реферальный код"
                )
            
            # Создаём нового пользователя с реферальной связью
            new_user = {
                "id": str(uuid.uuid4()),
                "telegram_id": telegram_id,
                "username": request.username,
                "first_name": request.first_name,
                "last_name": request.last_name,
                "referral_code": generate_referral_code(telegram_id),
                "referred_by": referrer_id,
                "invited_count": 0,
                "referral_points_earned": 0,
                "created_at": datetime.utcnow(),
                "last_activity": datetime.utcnow()
            }
            
            await db.user_settings.insert_one(new_user)
            logger.info(f"✅ Создан новый пользователь {telegram_id} с реферером {referrer_id}")
            
            # Создаём реферальные связи
            await create_referral_connections(telegram_id, referrer_id, db)
            
            # Начисляем бонусы пригласившему
            bonus_points = 50
            await award_referral_bonus(referrer_id, telegram_id, bonus_points, 1, db)
            
            # Увеличиваем счётчик приглашений
            await db.user_settings.update_one(
                {"telegram_id": referrer_id},
                {"$inc": {"invited_count": 1}}
            )
            
            referrer_name = referrer.get("first_name") or referrer.get("username") or "Пользователь"
            
            return ProcessReferralResponse(
                success=True,
                message=f"Вы присоединились по приглашению от {referrer_name}!",
                referrer_name=referrer_name,
                bonus_points=bonus_points
            )
        
        else:
            # Существующий пользователь
            if user.get("referred_by"):
                # Уже есть реферер
                return ProcessReferralResponse(
                    success=False,
                    message="Вы уже присоединились по реферальной ссылке ранее"
                )
            
            # Ищем пригласившего
            referrer = await db.user_settings.find_one({"referral_code": referral_code})
            
            if not referrer:
                return ProcessReferralResponse(
                    success=False,
                    message="Реферальный код не найден"
                )
            
            referrer_id = referrer.get("telegram_id")
            
            if referrer_id == telegram_id:
                return ProcessReferralResponse(
                    success=False,
                    message="Нельзя использовать собственный реферальный код"
                )
            
            # Привязываем существующего пользователя к рефереру
            await db.user_settings.update_one(
                {"telegram_id": telegram_id},
                {"$set": {"referred_by": referrer_id}}
            )
            
            # Создаём реферальные связи
            await create_referral_connections(telegram_id, referrer_id, db)
            
            # Начисляем бонусы
            bonus_points = 50
            await award_referral_bonus(referrer_id, telegram_id, bonus_points, 1, db)
            
            # Увеличиваем счётчик приглашений
            await db.user_settings.update_one(
                {"telegram_id": referrer_id},
                {"$inc": {"invited_count": 1}}
            )
            
            referrer_name = referrer.get("first_name") or referrer.get("username") or "Пользователь"
            
            logger.info(f"✅ Пользователь {telegram_id} привязан к рефереру {referrer_id}")
            
            return ProcessReferralResponse(
                success=True,
                message=f"Вы присоединились по приглашению от {referrer_name}!",
                referrer_name=referrer_name,
                bonus_points=bonus_points
            )
    
    except Exception as e:
        logger.error(f"❌ Ошибка при обработке реферального кода Web App: {e}", exc_info=True)
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


async def award_referral_bonus(referrer_id: int, referred_id: int, points: int, level: int, database):
    """
    Начисляет бонусные баллы пригласившему за регистрацию реферала
    """
    try:
        # Обновляем статистику пригласившего
        stats = await database.user_stats.find_one({"telegram_id": referrer_id})
        
        if not stats:
            # Создаём статистику если её нет
            stats = {
                "id": str(uuid.uuid4()),
                "telegram_id": referrer_id,
                "total_points": points,
                "friends_invited": 1,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            await database.user_stats.insert_one(stats)
        else:
            # Обновляем существующую статистику
            await database.user_stats.update_one(
                {"telegram_id": referrer_id},
                {
                    "$inc": {
                        "total_points": points,
                        "friends_invited": 1
                    },
                    "$set": {"updated_at": datetime.utcnow()}
                }
            )
        
        # Обновляем заработанные баллы с рефералов в user_settings
        await database.user_settings.update_one(
            {"telegram_id": referrer_id},
            {"$inc": {"referral_points_earned": points}}
        )
        
        # Обновляем заработанные баллы в реферальной связи
        await database.referral_connections.update_one(
            {
                "referrer_telegram_id": referrer_id,
                "referred_telegram_id": referred_id,
                "level": level
            },
            {"$inc": {"points_earned": points}}
        )
        
        logger.info(f"💰 Начислено {points} баллов пользователю {referrer_id} за реферала {referred_id} (уровень {level})")
        
    except Exception as e:
        logger.error(f"❌ Ошибка при начислении бонуса: {e}", exc_info=True)


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
        
        # Получаем имя бота из конфига (зависит от ENV)
        # ENV=test -> rudn_pro_bot, ENV=production -> rudn_mosbot
        bot_username = get_telegram_bot_username()
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
        
        # Преобразуем результат (hour как integer 0-23)
        activity = [
            HourlyActivityPoint(hour=hour, count=count)
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
    
    # 2. Active Users Today
    today_start = datetime(now.year, now.month, now.day)
    active_users_today = await db.user_settings.count_documents({"last_activity": {"$gte": today_start}})
    
    # 3. New Users Week
    week_ago = now - timedelta(days=7)
    new_users_week = await db.user_settings.count_documents({"created_at": {"$gte": week_ago}})
    
    # 4. Tasks
    total_tasks = await db.tasks.count_documents(date_filter("created_at"))
    total_completed_tasks = await db.tasks.count_documents({"completed": True, **date_filter("created_at")})
    
    # 5. Achievements
    total_achievements_earned = await db.user_achievements.count_documents(date_filter("earned_at"))
    
    # 6. Rooms
    total_rooms = await db.rooms.count_documents(date_filter("created_at"))
    
    # Additional fields
    week_start = now - timedelta(days=7)
    active_users_week = await db.user_settings.count_documents({"last_activity": {"$gte": week_start}})
    
    month_start = now - timedelta(days=30)
    active_users_month = await db.user_settings.count_documents({"last_activity": {"$gte": month_start}})
    
    new_users_today = await db.user_settings.count_documents({"created_at": {"$gte": today_start}})
    
    month_ago = now - timedelta(days=30)
    new_users_month = await db.user_settings.count_documents({"created_at": {"$gte": month_ago}})
    
    # Total schedule views
    schedule_views_result = await db.user_stats.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$schedule_views"}}}
    ]).to_list(1)
    total_schedule_views = schedule_views_result[0]["total"] if schedule_views_result else 0

    # 7. Referral events statistics (room joins)
    total_room_joins = await db.referral_events.count_documents({"event_type": "room_join", "is_new_member": True})
    room_joins_today = await db.referral_events.count_documents({
        "event_type": "room_join", 
        "is_new_member": True,
        "created_at": {"$gte": today_start}
    })
    room_joins_week = await db.referral_events.count_documents({
        "event_type": "room_join", 
        "is_new_member": True,
        "created_at": {"$gte": week_ago}
    })
    
    # 8. Referral events statistics (journal joins)
    total_journal_joins = await db.referral_events.count_documents({"event_type": "journal_join", "is_new_member": True})
    journal_joins_today = await db.referral_events.count_documents({
        "event_type": "journal_join", 
        "is_new_member": True,
        "created_at": {"$gte": today_start}
    })
    journal_joins_week = await db.referral_events.count_documents({
        "event_type": "journal_join", 
        "is_new_member": True,
        "created_at": {"$gte": week_ago}
    })
    
    # 9. Total journals
    total_journals = await db.attendance_journals.count_documents(date_filter("created_at"))

    return AdminStatsResponse(
        total_users=total_users,
        active_users_today=active_users_today,
        active_users_week=active_users_week,
        active_users_month=active_users_month,
        new_users_today=new_users_today,
        new_users_week=new_users_week,
        new_users_month=new_users_month,
        total_tasks=total_tasks,
        total_completed_tasks=total_completed_tasks,
        total_achievements_earned=total_achievements_earned,
        total_rooms=total_rooms,
        total_schedule_views=total_schedule_views,
        # Referral statistics
        total_room_joins=total_room_joins,
        room_joins_today=room_joins_today,
        room_joins_week=room_joins_week,
        total_journal_joins=total_journal_joins,
        journal_joins_today=journal_joins_today,
        journal_joins_week=journal_joins_week,
        total_journals=total_journals
    )


@api_router.get("/admin/referral-stats", response_model=ReferralStatsDetailResponse)
async def get_admin_referral_stats(days: Optional[int] = 30, limit: int = 10):
    """
    Получить детальную статистику реферальных событий.
    
    - **days**: Количество дней для анализа (по умолчанию 30)
    - **limit**: Количество записей в топах и последних событиях (по умолчанию 10)
    """
    try:
        now = datetime.utcnow()
        today_start = datetime(now.year, now.month, now.day)
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=days)
        
        # Общая статистика
        total_events = await db.referral_events.count_documents({})
        events_today = await db.referral_events.count_documents({"created_at": {"$gte": today_start}})
        events_week = await db.referral_events.count_documents({"created_at": {"$gte": week_ago}})
        events_month = await db.referral_events.count_documents({"created_at": {"$gte": month_ago}})
        
        # По типам - комнаты
        room_joins_total = await db.referral_events.count_documents({"event_type": "room_join"})
        room_joins_today = await db.referral_events.count_documents({
            "event_type": "room_join",
            "created_at": {"$gte": today_start}
        })
        room_joins_week = await db.referral_events.count_documents({
            "event_type": "room_join", 
            "created_at": {"$gte": week_ago}
        })

        # По типам - журналы
        journal_joins_total = await db.referral_events.count_documents({"event_type": "journal_join"})
        journal_joins_today = await db.referral_events.count_documents({
            "event_type": "journal_join",
            "created_at": {"$gte": today_start}
        })
        journal_joins_week = await db.referral_events.count_documents({
            "event_type": "journal_join",
            "created_at": {"$gte": week_ago}
        })

        # Новые участники
        new_members_total = await db.referral_events.count_documents({"is_new_member": True})
        new_members_today = await db.referral_events.count_documents({
            "is_new_member": True,
            "created_at": {"$gte": today_start}
        })
        new_members_week = await db.referral_events.count_documents({
            "is_new_member": True,
            "created_at": {"$gte": week_ago}
        })

        # Топ приглашающих
        pipeline = [
            {"$group": {"_id": "$referrer_id", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": limit}
        ]
        top_referrers_data = await db.referral_events.aggregate(pipeline).to_list(length=limit)
        
        top_referrers = []
        for item in top_referrers_data:
            if item["_id"]:
                user = await db.user_settings.find_one({"telegram_id": item["_id"]})
                name = "Unknown"
                if user:
                    name = user.get("first_name", "") + " " + (user.get("last_name", "") or "")
                    if user.get("username"):
                        name += f" (@{user['username']})"
                
                top_referrers.append({
                    "referrer_id": item["_id"],
                    "count": item["count"],
                    "name": name.strip()
                })

        # Последние события
        cursor = db.referral_events.find({}).sort("created_at", -1).limit(limit)
        recent_events_data = await cursor.to_list(length=limit)
        recent_events = []
        for event in recent_events_data:
            # Преобразуем ObjectId в str если нужно
            event["id"] = str(event["_id"])
            recent_events.append(event)

        return {
            "total_events": total_events,
            "events_today": events_today,
            "events_week": events_week,
            "events_month": events_month,
            "room_joins_total": room_joins_total,
            "room_joins_today": room_joins_today,
            "room_joins_week": room_joins_week,
            "journal_joins_total": journal_joins_total,
            "journal_joins_today": journal_joins_today,
            "journal_joins_week": journal_joins_week,
            "new_members_total": new_members_total,
            "new_members_today": new_members_today,
            "new_members_week": new_members_week,
            "top_referrers": top_referrers,
            "recent_events": recent_events
        }
    except Exception as e:
        logger.error(f"Error getting referral stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/admin/users", response_model=List[UserSettingsResponse])
async def get_admin_users(limit: int = 50, skip: int = 0, search: Optional[str] = None):
    """Get list of users for admin panel with search capability"""
    query = {}
    if search:
        # Case-insensitive search by name, username, or group
        query["$or"] = [
            {"username": {"$regex": search, "$options": "i"}},
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"group_name": {"$regex": search, "$options": "i"}}
        ]
        # Check if search is a number (telegram_id)
        if search.isdigit():
            query["$or"].append({"telegram_id": int(search)})

    cursor = db.user_settings.find(query).sort("created_at", -1).skip(skip).limit(limit)
    users = await cursor.to_list(length=limit)
    return users

@api_router.get("/admin/journals", response_model=List[JournalResponse])
async def get_admin_journals(limit: int = 50, skip: int = 0, search: Optional[str] = None):
    """Get list of journals (classes) for admin panel"""
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"group_name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]

    cursor = db.attendance_journals.find(query).sort("created_at", -1).skip(skip).limit(limit)
    journals = await cursor.to_list(length=limit)
    
    # Enrich with counts if needed, but the model has defaults. 
    # The model expects some calculated fields like 'total_students', 'total_sessions'.
    # We might need to compute them or ensure they are in the DB.
    # Looking at the model, these are fields.
    
    result = []
    for journal in journals:
        # Calculate stats for accurate display
        j_id = str(journal["journal_id"]) if "journal_id" in journal else str(journal["_id"])
        
        # Ensure journal_id is set (sometimes it's _id in mongo)
        if "journal_id" not in journal:
             journal["journal_id"] = str(journal["_id"])
             
        journal["total_students"] = await db.journal_students.count_documents({"journal_id": j_id})
        journal["total_sessions"] = await db.journal_sessions.count_documents({"journal_id": j_id})
        
        result.append(journal)
        
    return result



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


# ============ API для журнала посещений (Attendance Journal) ============

@api_router.post("/journals", response_model=JournalResponse)
async def create_journal(data: JournalCreate):
    """Создать новый журнал посещений"""
    try:
        journal = AttendanceJournal(
            name=data.name,
            group_name=data.group_name,
            description=data.description,
            owner_id=data.telegram_id,
            color=data.color
        )
        
        journal_dict = journal.model_dump()
        await db.attendance_journals.insert_one(journal_dict)
        
        logger.info(f"Journal created: {journal.journal_id} by user {data.telegram_id}")
        
        return JournalResponse(
            **journal_dict,
            total_students=0,
            linked_students=0,
            total_sessions=0,
            is_owner=True
        )
    except Exception as e:
        logger.error(f"Error creating journal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/journals/{telegram_id}", response_model=List[JournalResponse])
async def get_user_journals(telegram_id: int):
    """Получить все журналы пользователя (как владелец и как участник)"""
    try:
        journals = []
        
        # Журналы, где пользователь владелец
        owned_journals = await db.attendance_journals.find(
            {"owner_id": telegram_id}
        ).to_list(100)
        
        for j in owned_journals:
            total_students = await db.journal_students.count_documents({"journal_id": j["journal_id"]})
            linked_students = await db.journal_students.count_documents({"journal_id": j["journal_id"], "is_linked": True})
            total_sessions = await db.journal_sessions.count_documents({"journal_id": j["journal_id"]})
            
            journals.append(JournalResponse(
                journal_id=j["journal_id"],
                name=j["name"],
                group_name=j["group_name"],
                description=j.get("description"),
                owner_id=j["owner_id"],
                color=j.get("color", "purple"),
                invite_token=j["invite_token"],
                settings=JournalSettings(**j.get("settings", {})),
                created_at=j["created_at"],
                updated_at=j["updated_at"],
                total_students=total_students,
                linked_students=linked_students,
                total_sessions=total_sessions,
                is_owner=True
            ))
        
        # Журналы, где пользователь участник (привязан к студенту)
        linked_students = await db.journal_students.find(
            {"telegram_id": telegram_id, "is_linked": True}
        ).to_list(100)
        
        for ls in linked_students:
            journal = await db.attendance_journals.find_one({"journal_id": ls["journal_id"]})
            if journal and journal["owner_id"] != telegram_id:
                total_students = await db.journal_students.count_documents({"journal_id": journal["journal_id"]})
                linked_count = await db.journal_students.count_documents({"journal_id": journal["journal_id"], "is_linked": True})
                total_sessions = await db.journal_sessions.count_documents({"journal_id": journal["journal_id"]})
                
                # Рассчитать личную посещаемость
                my_attendance = await calculate_student_attendance(ls["id"], journal["journal_id"])
                
                journals.append(JournalResponse(
                    journal_id=journal["journal_id"],
                    name=journal["name"],
                    group_name=journal["group_name"],
                    description=journal.get("description"),
                    owner_id=journal["owner_id"],
                    color=journal.get("color", "purple"),
                    invite_token=journal["invite_token"],
                    settings=JournalSettings(**journal.get("settings", {})),
                    created_at=journal["created_at"],
                    updated_at=journal["updated_at"],
                    total_students=total_students,
                    linked_students=linked_count,
                    total_sessions=total_sessions,
                    is_owner=False,
                    my_attendance_percent=my_attendance
                ))
        
        # Также добавить журналы где пользователь в pending (ожидает привязки)
        pending = await db.journal_pending_members.find(
            {"telegram_id": telegram_id, "is_linked": False}
        ).to_list(100)
        
        for p in pending:
            journal = await db.attendance_journals.find_one({"journal_id": p["journal_id"]})
            if journal and journal["owner_id"] != telegram_id:
                # Проверить что журнал не уже добавлен
                if not any(jj.journal_id == journal["journal_id"] for jj in journals):
                    total_students = await db.journal_students.count_documents({"journal_id": journal["journal_id"]})
                    linked_count = await db.journal_students.count_documents({"journal_id": journal["journal_id"], "is_linked": True})
                    total_sessions = await db.journal_sessions.count_documents({"journal_id": journal["journal_id"]})
                    
                    journals.append(JournalResponse(
                        journal_id=journal["journal_id"],
                        name=journal["name"],
                        group_name=journal["group_name"],
                        description=journal.get("description"),
                        owner_id=journal["owner_id"],
                        color=journal.get("color", "purple"),
                        invite_token=journal["invite_token"],
                        settings=JournalSettings(**journal.get("settings", {})),
                        created_at=journal["created_at"],
                        updated_at=journal["updated_at"],
                        total_students=total_students,
                        linked_students=linked_count,
                        total_sessions=total_sessions,
                        is_owner=False,
                        my_attendance_percent=None  # Ещё не привязан
                    ))
        
        return journals
    except Exception as e:
        logger.error(f"Error getting user journals: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def calculate_student_attendance(student_id: str, journal_id: str) -> Optional[float]:
    """Рассчитать процент посещаемости студента"""
    try:
        total_sessions = await db.journal_sessions.count_documents({"journal_id": journal_id})
        if total_sessions == 0:
            return None
        
        present_count = await db.attendance_records.count_documents({
            "student_id": student_id,
            "journal_id": journal_id,
            "status": {"$in": ["present", "late"]}
        })
        
        return round((present_count / total_sessions) * 100, 1)
    except:
        return None


@api_router.get("/journals/detail/{journal_id}")
async def get_journal_detail(journal_id: str, telegram_id: int = 0):
    """Получить детальную информацию о журнале"""
    try:
        journal = await db.attendance_journals.find_one({"journal_id": journal_id})
        if not journal:
            raise HTTPException(status_code=404, detail="Journal not found")
        
        total_students = await db.journal_students.count_documents({"journal_id": journal_id})
        linked_students = await db.journal_students.count_documents({"journal_id": journal_id, "is_linked": True})
        total_sessions = await db.journal_sessions.count_documents({"journal_id": journal_id})
        
        is_owner = journal["owner_id"] == telegram_id
        stats_viewers = journal.get("stats_viewers", [])
        can_view_stats = is_owner or telegram_id in stats_viewers
        my_attendance = None
        is_linked = False
        
        if not is_owner and telegram_id > 0:
            student = await db.journal_students.find_one({
                "journal_id": journal_id,
                "telegram_id": telegram_id,
                "is_linked": True
            })
            if student:
                is_linked = True
                my_attendance = await calculate_student_attendance(student["id"], journal_id)
        
        return JournalResponse(
            journal_id=journal["journal_id"],
            name=journal["name"],
            group_name=journal["group_name"],
            description=journal.get("description"),
            owner_id=journal["owner_id"],
            color=journal.get("color", "purple"),
            invite_token=journal["invite_token"],
            settings=JournalSettings(**journal.get("settings", {})),
            stats_viewers=stats_viewers,
            created_at=journal["created_at"],
            updated_at=journal["updated_at"],
            total_students=total_students,
            linked_students=linked_students,
            total_sessions=total_sessions,
            is_owner=is_owner,
            can_view_stats=can_view_stats,
            is_linked=is_linked,
            my_attendance_percent=my_attendance
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting journal detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/journals/{journal_id}")
async def update_journal(journal_id: str, data: dict = Body(...)):
    """Обновить журнал"""
    try:
        journal = await db.attendance_journals.find_one({"journal_id": journal_id})
        if not journal:
            raise HTTPException(status_code=404, detail="Journal not found")
        
        update_data = {"updated_at": datetime.utcnow()}
        if "name" in data:
            update_data["name"] = data["name"]
        if "group_name" in data:
            update_data["group_name"] = data["group_name"]
        if "description" in data:
            update_data["description"] = data["description"]
        if "color" in data:
            update_data["color"] = data["color"]
        if "settings" in data:
            update_data["settings"] = data["settings"]
        if "stats_viewers" in data:
            # stats_viewers - список telegram_id пользователей с правом видеть статистику
            update_data["stats_viewers"] = data["stats_viewers"]
        
        await db.attendance_journals.update_one(
            {"journal_id": journal_id},
            {"$set": update_data}
        )
        
        return {"status": "success", "journal_id": journal_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating journal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/journals/{journal_id}")
async def delete_journal(journal_id: str, telegram_id: int):
    """Удалить журнал (только владелец)"""
    try:
        journal = await db.attendance_journals.find_one({"journal_id": journal_id})
        if not journal:
            raise HTTPException(status_code=404, detail="Journal not found")
        
        if journal["owner_id"] != telegram_id:
            raise HTTPException(status_code=403, detail="Only owner can delete journal")
        
        # Удалить все связанные данные
        await db.attendance_journals.delete_one({"journal_id": journal_id})
        await db.journal_students.delete_many({"journal_id": journal_id})
        await db.journal_sessions.delete_many({"journal_id": journal_id})
        await db.attendance_records.delete_many({"journal_id": journal_id})
        await db.journal_pending_members.delete_many({"journal_id": journal_id})
        
        logger.info(f"Journal deleted: {journal_id}")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting journal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/journals/{journal_id}/invite-link", response_model=JournalInviteLinkResponse)
async def generate_journal_invite_link(journal_id: str):
    """Сгенерировать пригласительную ссылку"""
    try:
        journal = await db.attendance_journals.find_one({"journal_id": journal_id})
        if not journal:
            raise HTTPException(status_code=404, detail="Journal not found")
        
        # Получаем имя бота из конфига (зависит от ENV)
        # ENV=test -> rudn_pro_bot, ENV=production -> rudn_mosbot
        bot_username = get_telegram_bot_username()
        # Старый формат через /start
        invite_link = f"https://t.me/{bot_username}?start=journal_{journal['invite_token']}"
        # Новый формат через Web App
        invite_link_webapp = f"https://t.me/{bot_username}/app?startapp=journal_{journal['invite_token']}"
        
        return JournalInviteLinkResponse(
            invite_link=invite_link,
            invite_link_webapp=invite_link_webapp,
            invite_token=journal["invite_token"],
            journal_id=journal_id,
            bot_username=bot_username
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating invite link: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/journals/join/{invite_token}")
async def join_journal(invite_token: str, data: JournalJoinRequest):
    """Присоединиться к журналу по приглашению"""
    try:
        journal = await db.attendance_journals.find_one({"invite_token": invite_token})
        if not journal:
            raise HTTPException(status_code=404, detail="Invalid invite link")
        
        is_new_member = True
        
        # Проверить, не владелец ли это
        if journal["owner_id"] == data.telegram_id:
            is_new_member = False
            # Логируем событие даже для владельца (переход по собственной ссылке)
            referral_event = ReferralEvent(
                event_type="journal_join",
                telegram_id=data.telegram_id,
                referrer_id=data.referrer_id,
                target_id=journal["journal_id"],
                target_name=journal.get("name", ""),
                invite_token=invite_token,
                is_new_member=False
            )
            await db.referral_events.insert_one(referral_event.model_dump())
            return {"status": "success", "message": "You are the owner", "journal_id": journal["journal_id"]}
        
        # Проверить, не привязан ли уже
        existing_link = await db.journal_students.find_one({
            "journal_id": journal["journal_id"],
            "telegram_id": data.telegram_id,
            "is_linked": True
        })
        if existing_link:
            is_new_member = False
            # Логируем событие даже для уже привязанного пользователя
            referral_event = ReferralEvent(
                event_type="journal_join",
                telegram_id=data.telegram_id,
                referrer_id=data.referrer_id,
                target_id=journal["journal_id"],
                target_name=journal.get("name", ""),
                invite_token=invite_token,
                is_new_member=False
            )
            await db.referral_events.insert_one(referral_event.model_dump())
            return {"status": "success", "message": "Already linked", "journal_id": journal["journal_id"]}
        
        # Проверить, не в pending ли уже
        existing_pending = await db.journal_pending_members.find_one({
            "journal_id": journal["journal_id"],
            "telegram_id": data.telegram_id
        })
        if existing_pending:
            is_new_member = False
            # Логируем событие даже для уже ожидающего пользователя
            referral_event = ReferralEvent(
                event_type="journal_join",
                telegram_id=data.telegram_id,
                referrer_id=data.referrer_id,
                target_id=journal["journal_id"],
                target_name=journal.get("name", ""),
                invite_token=invite_token,
                is_new_member=False
            )
            await db.referral_events.insert_one(referral_event.model_dump())
            return {"status": "success", "message": "Waiting for linking", "journal_id": journal["journal_id"]}
        
        # Добавить в pending
        pending = JournalPendingMember(
            journal_id=journal["journal_id"],
            telegram_id=data.telegram_id,
            username=data.username,
            first_name=data.first_name
        )
        await db.journal_pending_members.insert_one(pending.model_dump())
        
        # Логируем реферальное событие (новый участник)
        referral_event = ReferralEvent(
            event_type="journal_join",
            telegram_id=data.telegram_id,
            referrer_id=data.referrer_id,
            target_id=journal["journal_id"],
            target_name=journal.get("name", ""),
            invite_token=invite_token,
            is_new_member=True
        )
        await db.referral_events.insert_one(referral_event.model_dump())
        logger.info(f"Referral event logged: journal_join, user={data.telegram_id}, referrer={data.referrer_id}, journal={journal['journal_id']}")
        
        logger.info(f"User {data.telegram_id} joined journal {journal['journal_id']} (pending)")
        return {"status": "success", "message": "Joined, waiting for linking", "journal_id": journal["journal_id"]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error joining journal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/journals/join-student/{invite_code}")
async def join_journal_by_student_link(invite_code: str, data: JoinStudentRequest):
    """Присоединиться к журналу по персональной ссылке студента"""
    try:
        # Найти студента по invite_code
        student = await db.journal_students.find_one({"invite_code": invite_code})
        if not student:
            raise HTTPException(status_code=404, detail="Invalid student invite link")
        
        journal_id = student["journal_id"]
        
        # Найти журнал
        journal = await db.attendance_journals.find_one({"journal_id": journal_id})
        if not journal:
            raise HTTPException(status_code=404, detail="Journal not found")
        
        # Проверить, не владелец ли это
        if journal["owner_id"] == data.telegram_id:
            return {
                "status": "owner", 
                "message": "Вы являетесь старостой этого журнала", 
                "journal_id": journal_id,
                "student_name": student["full_name"]
            }
        
        # Проверить, не привязан ли уже этот студент к другому Telegram
        if student.get("is_linked") and student.get("telegram_id") != data.telegram_id:
            return {
                "status": "occupied",
                "message": f"Место для «{student['full_name']}» уже занято другим пользователем",
                "journal_id": journal_id,
                "student_name": student["full_name"]
            }
        
        # Проверить, не привязан ли уже этот пользователь к другому студенту в этом журнале
        existing_link = await db.journal_students.find_one({
            "journal_id": journal_id,
            "telegram_id": data.telegram_id,
            "is_linked": True
        })
        if existing_link and existing_link["id"] != student["id"]:
            return {
                "status": "already_linked",
                "message": f"Вы уже привязаны как «{existing_link['full_name']}» в этом журнале",
                "journal_id": journal_id,
                "student_name": existing_link["full_name"]
            }
        
        # Если уже привязан к этому же студенту
        if student.get("is_linked") and student.get("telegram_id") == data.telegram_id:
            return {
                "status": "success",
                "message": f"Вы уже привязаны как «{student['full_name']}»",
                "journal_id": journal_id,
                "student_name": student["full_name"]
            }
        
        # Привязать пользователя к студенту
        from datetime import datetime
        await db.journal_students.update_one(
            {"id": student["id"]},
            {"$set": {
                "telegram_id": data.telegram_id,
                "username": data.username,
                "first_name": data.first_name,
                "is_linked": True,
                "linked_at": datetime.utcnow()
            }}
        )
        
        # Удалить из pending если был там
        await db.journal_pending_members.delete_many({
            "journal_id": journal_id,
            "telegram_id": data.telegram_id
        })
        
        logger.info(f"✅ User {data.telegram_id} linked to student '{student['full_name']}' in journal {journal_id}")
        return {
            "status": "success",
            "message": f"Вы успешно привязаны как «{student['full_name']}»",
            "journal_id": journal_id,
            "student_name": student["full_name"],
            "journal_name": journal.get("name", "Журнал")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error joining journal by student link: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/journals/process-webapp-invite")
async def process_journal_webapp_invite(data: ProcessJournalInviteRequest):
    """
    Обработать приглашение в журнал через Web App.
    Вызывается при открытии приложения по ссылке:
    - t.me/bot/app?startapp=journal_{invite_token}
    - t.me/bot/app?startapp=jstudent_{invite_code}
    """
    try:
        logger.info(f"📚 Обработка приглашения в журнал через Web App: type={data.invite_type}, code={data.invite_code}")
        
        if data.invite_type == "journal":
            # Обработка общего приглашения в журнал
            journal = await db.attendance_journals.find_one({"invite_token": data.invite_code})
            if not journal:
                return {
                    "success": False,
                    "status": "not_found",
                    "message": "Журнал не найден или ссылка недействительна"
                }
            
            journal_id = journal["journal_id"]
            journal_name = journal.get("name", "Журнал")
            
            # Проверить, не владелец ли это
            if journal["owner_id"] == data.telegram_id:
                return {
                    "success": True,
                    "status": "owner",
                    "message": f"Вы являетесь старостой журнала «{journal_name}»",
                    "journal_id": journal_id,
                    "journal_name": journal_name
                }
            
            # Проверить, не привязан ли уже
            existing_link = await db.journal_students.find_one({
                "journal_id": journal_id,
                "telegram_id": data.telegram_id,
                "is_linked": True
            })
            if existing_link:
                return {
                    "success": True,
                    "status": "already_linked",
                    "message": f"Вы уже в журнале «{journal_name}» как «{existing_link['full_name']}»",
                    "journal_id": journal_id,
                    "journal_name": journal_name,
                    "student_name": existing_link['full_name']
                }
            
            # Проверить, не в pending ли уже (для обратной совместимости - удаляем из pending)
            existing_pending = await db.journal_pending_members.find_one({
                "journal_id": journal_id,
                "telegram_id": data.telegram_id
            })
            if existing_pending:
                # Удаляем из pending, так как сейчас будем создавать студента напрямую
                await db.journal_pending_members.delete_one({"_id": existing_pending["_id"]})
            
            # Создаем нового студента и сразу привязываем его
            # Приоритет имени: @username, затем Имя Фамилия из Telegram
            if data.username:
                student_name = f"@{data.username}"
            elif data.first_name:
                # Собираем полное имя из first_name и last_name
                name_parts = [data.first_name]
                if data.last_name:
                    name_parts.append(data.last_name)
                student_name = " ".join(name_parts)
            else:
                student_name = f"Студент {data.telegram_id}"
            
            # Получаем максимальный order для новых студентов
            max_order_student = await db.journal_students.find_one(
                {"journal_id": journal_id},
                sort=[("order", -1)]
            )
            new_order = (max_order_student["order"] + 1) if max_order_student else 0
            
            new_student = JournalStudent(
                journal_id=journal_id,
                full_name=student_name,
                telegram_id=data.telegram_id,
                username=data.username,
                first_name=data.first_name,
                is_linked=True,
                linked_at=datetime.utcnow(),
                order=new_order
            )
            await db.journal_students.insert_one(new_student.model_dump())
            
            logger.info(f"✅ User {data.telegram_id} joined journal '{journal_name}' as '{student_name}' (auto-linked)")
            return {
                "success": True,
                "status": "joined",
                "message": f"Вы присоединились к журналу «{journal_name}» как «{student_name}»!",
                "journal_id": journal_id,
                "journal_name": journal_name,
                "student_name": student_name
            }
        
        elif data.invite_type == "jstudent":
            # Обработка персональной ссылки студента
            student = await db.journal_students.find_one({"invite_code": data.invite_code})
            if not student:
                return {
                    "success": False,
                    "status": "not_found",
                    "message": "Персональная ссылка недействительна"
                }
            
            journal_id = student["journal_id"]
            journal = await db.attendance_journals.find_one({"journal_id": journal_id})
            if not journal:
                return {
                    "success": False,
                    "status": "not_found",
                    "message": "Журнал не найден"
                }
            
            journal_name = journal.get("name", "Журнал")
            student_name = student["full_name"]
            
            # Проверить, не владелец ли это
            if journal["owner_id"] == data.telegram_id:
                return {
                    "success": False,
                    "status": "owner",
                    "message": f"Вы являетесь старостой журнала «{journal_name}»",
                    "journal_id": journal_id,
                    "journal_name": journal_name,
                    "student_name": student_name
                }
            
            # Проверить, не занято ли место
            if student.get("is_linked") and student.get("telegram_id") != data.telegram_id:
                return {
                    "success": False,
                    "status": "occupied",
                    "message": f"Место «{student_name}» уже занято другим пользователем",
                    "journal_id": journal_id,
                    "journal_name": journal_name,
                    "student_name": student_name
                }
            
            # Проверить, не привязан ли пользователь к другому студенту
            existing_link = await db.journal_students.find_one({
                "journal_id": journal_id,
                "telegram_id": data.telegram_id,
                "is_linked": True
            })
            if existing_link and existing_link["id"] != student["id"]:
                return {
                    "success": False,
                    "status": "already_linked_other",
                    "message": f"Вы уже привязаны как «{existing_link['full_name']}» в этом журнале",
                    "journal_id": journal_id,
                    "journal_name": journal_name,
                    "student_name": existing_link["full_name"]
                }
            
            # Если уже привязан к этому студенту
            if student.get("is_linked") and student.get("telegram_id") == data.telegram_id:
                return {
                    "success": True,
                    "status": "already_linked",
                    "message": f"Вы уже привязаны как «{student_name}»",
                    "journal_id": journal_id,
                    "journal_name": journal_name,
                    "student_name": student_name
                }
            
            # Привязать пользователя к студенту
            await db.journal_students.update_one(
                {"id": student["id"]},
                {"$set": {
                    "telegram_id": data.telegram_id,
                    "username": data.username,
                    "first_name": data.first_name,
                    "is_linked": True,
                    "linked_at": datetime.utcnow()
                }}
            )
            
            # Удалить из pending если был там
            await db.journal_pending_members.delete_many({
                "journal_id": journal_id,
                "telegram_id": data.telegram_id
            })
            
            logger.info(f"✅ User {data.telegram_id} linked to student '{student_name}' in journal '{journal_name}' via Web App")
            return {
                "success": True,
                "status": "linked",
                "message": f"Вы успешно привязаны как «{student_name}» в журнале «{journal_name}»!",
                "journal_id": journal_id,
                "journal_name": journal_name,
                "student_name": student_name
            }
        
        else:
            return {
                "success": False,
                "status": "invalid_type",
                "message": "Неизвестный тип приглашения"
            }
    
    except Exception as e:
        logger.error(f"❌ Error processing journal webapp invite: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ===== Студенты в журнале =====

@api_router.post("/journals/{journal_id}/students", response_model=JournalStudentResponse)
async def add_student(journal_id: str, data: JournalStudentCreate):
    """Добавить студента в журнал"""
    try:
        journal = await db.attendance_journals.find_one({"journal_id": journal_id})
        if not journal:
            raise HTTPException(status_code=404, detail="Journal not found")
        
        # Получить максимальный order
        max_order_student = await db.journal_students.find_one(
            {"journal_id": journal_id},
            sort=[("order", -1)]
        )
        next_order = (max_order_student["order"] + 1) if max_order_student else 0
        
        student = JournalStudent(
            journal_id=journal_id,
            full_name=data.full_name,
            order=next_order
        )
        await db.journal_students.insert_one(student.model_dump())
        
        # Генерируем ссылки для студента
        # Получаем имя бота из конфига (зависит от ENV)
        bot_username = get_telegram_bot_username()
        invite_link = f"https://t.me/{bot_username}?start=jstudent_{student.invite_code}"
        invite_link_webapp = f"https://t.me/{bot_username}/app?startapp=jstudent_{student.invite_code}"
        
        return JournalStudentResponse(
            id=student.id,
            journal_id=student.journal_id,
            full_name=student.full_name,
            telegram_id=None,
            username=None,
            first_name=None,
            is_linked=False,
            linked_at=None,
            order=student.order,
            invite_code=student.invite_code,
            invite_link=invite_link,
            invite_link_webapp=invite_link_webapp
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding student: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/journals/{journal_id}/students/bulk")
async def add_students_bulk(journal_id: str, data: JournalStudentBulkCreate):
    """Массовое добавление студентов"""
    try:
        journal = await db.attendance_journals.find_one({"journal_id": journal_id})
        if not journal:
            raise HTTPException(status_code=404, detail="Journal not found")
        
        # Получить максимальный order
        max_order_student = await db.journal_students.find_one(
            {"journal_id": journal_id},
            sort=[("order", -1)]
        )
        next_order = (max_order_student["order"] + 1) if max_order_student else 0
        
        added = []
        for i, name in enumerate(data.names):
            name = name.strip()
            if not name:
                continue
            
            student = JournalStudent(
                journal_id=journal_id,
                full_name=name,
                order=next_order + i
            )
            await db.journal_students.insert_one(student.model_dump())
            added.append(student.full_name)
        
        return {"status": "success", "added_count": len(added), "names": added}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding students bulk: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/journals/{journal_id}/students", response_model=List[JournalStudentResponse])
async def get_journal_students(journal_id: str):
    """Получить список студентов журнала"""
    try:
        students = await db.journal_students.find(
            {"journal_id": journal_id}
        ).sort("order", 1).to_list(200)
        
        total_sessions = await db.journal_sessions.count_documents({"journal_id": journal_id})
        
        result = []
        # Получаем имя бота из конфига (зависит от ENV)
        bot_username = get_telegram_bot_username()
        for s in students:
            # Рассчитать статистику посещаемости
            present_count = await db.attendance_records.count_documents({
                "student_id": s["id"], "status": "present"
            })
            absent_count = await db.attendance_records.count_documents({
                "student_id": s["id"], "status": "absent"
            })
            excused_count = await db.attendance_records.count_documents({
                "student_id": s["id"], "status": "excused"
            })
            late_count = await db.attendance_records.count_documents({
                "student_id": s["id"], "status": "late"
            })
            
            attendance_percent = None
            if total_sessions > 0:
                attended = present_count + late_count
                attendance_percent = round((attended / total_sessions) * 100, 1)
            
            # Генерируем invite_code если его нет (для старых студентов)
            invite_code = s.get("invite_code")
            if not invite_code:
                invite_code = str(uuid.uuid4())[:8]
                await db.journal_students.update_one(
                    {"id": s["id"]},
                    {"$set": {"invite_code": invite_code}}
                )
            
            # Генерируем ссылки
            invite_link = f"https://t.me/{bot_username}?start=jstudent_{invite_code}"
            invite_link_webapp = f"https://t.me/{bot_username}/app?startapp=jstudent_{invite_code}"
            
            result.append(JournalStudentResponse(
                id=s["id"],
                journal_id=s["journal_id"],
                full_name=s["full_name"],
                telegram_id=s.get("telegram_id"),
                username=s.get("username"),
                first_name=s.get("first_name"),
                is_linked=s.get("is_linked", False),
                linked_at=s.get("linked_at"),
                order=s.get("order", 0),
                invite_code=invite_code,
                invite_link=invite_link,
                invite_link_webapp=invite_link_webapp,
                attendance_percent=attendance_percent,
                present_count=present_count,
                absent_count=absent_count,
                excused_count=excused_count,
                late_count=late_count,
                total_sessions=total_sessions
            ))
        
        return result
    except Exception as e:
        logger.error(f"Error getting students: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/journals/{journal_id}/students/{student_id}")
async def update_student(journal_id: str, student_id: str, data: dict = Body(...)):
    """Обновить студента"""
    try:
        student = await db.journal_students.find_one({"id": student_id, "journal_id": journal_id})
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        
        update_data = {}
        if "full_name" in data:
            update_data["full_name"] = data["full_name"]
        if "order" in data:
            update_data["order"] = data["order"]
        
        if update_data:
            await db.journal_students.update_one(
                {"id": student_id},
                {"$set": update_data}
            )
        
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating student: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/journals/{journal_id}/students/{student_id}")
async def delete_student(journal_id: str, student_id: str):
    """Удалить студента из журнала"""
    try:
        result = await db.journal_students.delete_one({"id": student_id, "journal_id": journal_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Student not found")
        
        # Удалить записи посещаемости
        await db.attendance_records.delete_many({"student_id": student_id})
        
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting student: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/journals/{journal_id}/students/{student_id}/link")
async def link_student(journal_id: str, student_id: str, data: JournalStudentLink):
    """Привязать Telegram пользователя к ФИО в журнале"""
    try:
        student = await db.journal_students.find_one({"id": student_id, "journal_id": journal_id})
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        
        # Обновить студента
        await db.journal_students.update_one(
            {"id": student_id},
            {"$set": {
                "telegram_id": data.telegram_id,
                "username": data.username,
                "first_name": data.first_name,
                "is_linked": True,
                "linked_at": datetime.utcnow()
            }}
        )
        
        # Обновить pending member если есть
        await db.journal_pending_members.update_one(
            {"journal_id": journal_id, "telegram_id": data.telegram_id},
            {"$set": {"is_linked": True}}
        )
        
        logger.info(f"Student {student_id} linked to telegram {data.telegram_id}")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error linking student: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/journals/{journal_id}/students/{student_id}/unlink")
async def unlink_student(journal_id: str, student_id: str):
    """Отвязать Telegram пользователя от ФИО в журнале"""
    try:
        student = await db.journal_students.find_one({"id": student_id, "journal_id": journal_id})
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        
        if not student.get("is_linked"):
            return {"status": "success", "message": "Student is not linked"}
        
        # Сохраняем telegram_id до отвязки
        old_telegram_id = student.get("telegram_id")
        
        # Отвязать студента
        await db.journal_students.update_one(
            {"id": student_id},
            {"$set": {
                "telegram_id": None,
                "username": None,
                "first_name": None,
                "is_linked": False,
                "linked_at": None
            }}
        )
        
        # Удалить из pending members если там был
        if old_telegram_id:
            await db.journal_pending_members.delete_many({
                "journal_id": journal_id,
                "telegram_id": old_telegram_id
            })
        
        logger.info(f"Student {student_id} unlinked from telegram")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unlinking student: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/journals/{journal_id}/pending-members")
async def get_pending_members(journal_id: str):
    """Получить список ожидающих привязки участников"""
    try:
        pending = await db.journal_pending_members.find(
            {"journal_id": journal_id, "is_linked": False}
        ).to_list(100)
        
        return [
            {
                "id": p["id"],
                "telegram_id": p["telegram_id"],
                "username": p.get("username"),
                "first_name": p.get("first_name"),
                "joined_at": p["joined_at"]
            }
            for p in pending
        ]
    except Exception as e:
        logger.error(f"Error getting pending members: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== Предметы (Subjects) =====

@api_router.post("/journals/{journal_id}/subjects")
async def create_subject(journal_id: str, data: JournalSubjectCreate):
    """Создать предмет в журнале"""
    try:
        journal = await db.attendance_journals.find_one({"journal_id": journal_id})
        if not journal:
            raise HTTPException(status_code=404, detail="Journal not found")
        
        # Получаем максимальный order для нового предмета
        max_order = await db.journal_subjects.find_one(
            {"journal_id": journal_id},
            sort=[("order", -1)]
        )
        new_order = (max_order["order"] + 1) if max_order else 0
        
        subject = JournalSubject(
            journal_id=journal_id,
            name=data.name,
            description=data.description,
            color=data.color,
            order=new_order,
            created_by=data.telegram_id
        )
        await db.journal_subjects.insert_one(subject.model_dump())
        
        logger.info(f"Subject created: {subject.subject_id} in journal {journal_id}")
        
        return {
            "subject_id": subject.subject_id,
            "journal_id": subject.journal_id,
            "name": subject.name,
            "description": subject.description,
            "color": subject.color,
            "order": subject.order,
            "created_at": subject.created_at.isoformat(),
            "sessions_count": 0
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating subject: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/journals/{journal_id}/subjects")
async def get_journal_subjects(journal_id: str):
    """Получить список предметов журнала"""
    try:
        subjects = await db.journal_subjects.find(
            {"journal_id": journal_id}
        ).sort("order", 1).to_list(100)
        
        result = []
        for s in subjects:
            # Считаем количество занятий для предмета
            sessions_count = await db.journal_sessions.count_documents({
                "subject_id": s["subject_id"]
            })
            
            result.append({
                "subject_id": s["subject_id"],
                "journal_id": s["journal_id"],
                "name": s["name"],
                "description": s.get("description"),
                "color": s.get("color", "blue"),
                "order": s.get("order", 0),
                "created_at": s["created_at"].isoformat() if isinstance(s["created_at"], datetime) else s["created_at"],
                "sessions_count": sessions_count
            })
        
        return result
    except Exception as e:
        logger.error(f"Error getting subjects: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/journals/subjects/{subject_id}")
async def get_subject_detail(subject_id: str):
    """Получить детали предмета с занятиями"""
    try:
        subject = await db.journal_subjects.find_one({"subject_id": subject_id})
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        
        # Получаем занятия предмета (сортировка: по дате занятия desc, затем по дате создания desc)
        sessions = await db.journal_sessions.find(
            {"subject_id": subject_id}
        ).sort([("date", -1), ("created_at", -1)]).to_list(200)
        
        total_students = await db.journal_students.count_documents({
            "journal_id": subject["journal_id"]
        })
        
        sessions_list = []
        for s in sessions:
            attendance_filled = await db.attendance_records.count_documents({
                "session_id": s["session_id"],
                "status": {"$ne": "unmarked"}
            })
            present_count = await db.attendance_records.count_documents({
                "session_id": s["session_id"],
                "status": {"$in": ["present", "late"]}
            })
            
            sessions_list.append({
                "session_id": s["session_id"],
                "date": s["date"],
                "title": s["title"],
                "description": s.get("description"),
                "type": s.get("type", "lecture"),
                "created_at": s["created_at"].isoformat() if isinstance(s["created_at"], datetime) else s["created_at"],
                "attendance_filled": attendance_filled,
                "total_students": total_students,
                "present_count": present_count
            })
        
        return {
            "subject_id": subject["subject_id"],
            "journal_id": subject["journal_id"],
            "name": subject["name"],
            "description": subject.get("description"),
            "color": subject.get("color", "blue"),
            "created_at": subject["created_at"].isoformat() if isinstance(subject["created_at"], datetime) else subject["created_at"],
            "sessions": sessions_list,
            "total_students": total_students
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting subject detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/journals/subjects/{subject_id}")
async def update_subject(subject_id: str, data: dict = Body(...)):
    """Обновить предмет"""
    try:
        subject = await db.journal_subjects.find_one({"subject_id": subject_id})
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        
        update_data = {}
        if "name" in data:
            update_data["name"] = data["name"]
        if "description" in data:
            update_data["description"] = data["description"]
        if "color" in data:
            update_data["color"] = data["color"]
        
        if update_data:
            await db.journal_subjects.update_one(
                {"subject_id": subject_id},
                {"$set": update_data}
            )
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating subject: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/journals/subjects/{subject_id}")
async def delete_subject(subject_id: str):
    """Удалить предмет и все его занятия"""
    try:
        subject = await db.journal_subjects.find_one({"subject_id": subject_id})
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        
        # Получаем все session_id для удаления записей посещаемости
        sessions = await db.journal_sessions.find(
            {"subject_id": subject_id}
        ).to_list(1000)
        session_ids = [s["session_id"] for s in sessions]
        
        # Удаляем записи посещаемости
        if session_ids:
            await db.attendance_records.delete_many({"session_id": {"$in": session_ids}})
        
        # Удаляем занятия
        await db.journal_sessions.delete_many({"subject_id": subject_id})
        
        # Удаляем предмет
        await db.journal_subjects.delete_one({"subject_id": subject_id})
        
        logger.info(f"Subject deleted: {subject_id}")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting subject: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== Занятия =====

@api_router.post("/journals/{journal_id}/sessions", response_model=JournalSessionResponse)
async def create_session(journal_id: str, data: JournalSessionCreate):
    """Создать занятие"""
    try:
        journal = await db.attendance_journals.find_one({"journal_id": journal_id})
        if not journal:
            raise HTTPException(status_code=404, detail="Journal not found")
        
        # Проверяем существование предмета
        subject = await db.journal_subjects.find_one({"subject_id": data.subject_id})
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        
        session = JournalSession(
            journal_id=journal_id,
            subject_id=data.subject_id,
            date=data.date,
            title=data.title,
            description=data.description,
            type=data.type,
            created_by=data.telegram_id
        )
        await db.journal_sessions.insert_one(session.model_dump())
        
        total_students = await db.journal_students.count_documents({"journal_id": journal_id})
        
        return JournalSessionResponse(
            session_id=session.session_id,
            journal_id=session.journal_id,
            date=session.date,
            title=session.title,
            description=session.description,
            type=session.type,
            created_at=session.created_at,
            created_by=session.created_by,
            attendance_filled=0,
            total_students=total_students
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/journals/{journal_id}/sessions", response_model=List[JournalSessionResponse])
async def get_journal_sessions(journal_id: str):
    """Получить список занятий журнала"""
    try:
        sessions = await db.journal_sessions.find(
            {"journal_id": journal_id}
        ).sort([("date", -1), ("created_at", -1)]).to_list(200)
        
        total_students = await db.journal_students.count_documents({"journal_id": journal_id})
        
        result = []
        for s in sessions:
            attendance_filled = await db.attendance_records.count_documents({
                "session_id": s["session_id"],
                "status": {"$ne": "unmarked"}
            })
            present_count = await db.attendance_records.count_documents({
                "session_id": s["session_id"],
                "status": {"$in": ["present", "late"]}
            })
            absent_count = await db.attendance_records.count_documents({
                "session_id": s["session_id"],
                "status": "absent"
            })
            
            result.append(JournalSessionResponse(
                session_id=s["session_id"],
                journal_id=s["journal_id"],
                date=s["date"],
                title=s["title"],
                description=s.get("description"),
                type=s.get("type", "lecture"),
                created_at=s["created_at"],
                created_by=s["created_by"],
                attendance_filled=attendance_filled,
                total_students=total_students,
                present_count=present_count,
                absent_count=absent_count
            ))
        
        return result
    except Exception as e:
        logger.error(f"Error getting sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/journals/sessions/{session_id}")
async def update_session(session_id: str, data: dict = Body(...)):
    """Обновить занятие"""
    try:
        session = await db.journal_sessions.find_one({"session_id": session_id})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        update_data = {}
        if "date" in data:
            update_data["date"] = data["date"]
        if "title" in data:
            update_data["title"] = data["title"]
        if "description" in data:
            update_data["description"] = data["description"]
        if "type" in data:
            update_data["type"] = data["type"]
        
        if update_data:
            await db.journal_sessions.update_one(
                {"session_id": session_id},
                {"$set": update_data}
            )
        
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/journals/sessions/{session_id}")
async def delete_session(session_id: str):
    """Удалить занятие"""
    try:
        result = await db.journal_sessions.delete_one({"session_id": session_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Удалить записи посещаемости для этого занятия
        await db.attendance_records.delete_many({"session_id": session_id})
        
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/journals/{journal_id}/sessions/from-schedule")
async def create_sessions_from_schedule(journal_id: str, data: CreateSessionsFromScheduleRequest):
    """
    Создать занятия из расписания (массовое создание).
    Принимает список занятий из расписания и создаёт соответствующие сессии.
    """
    try:
        journal = await db.attendance_journals.find_one({"journal_id": journal_id})
        if not journal:
            raise HTTPException(status_code=404, detail="Journal not found")
        
        # Проверяем существование предмета
        subject = await db.journal_subjects.find_one({"subject_id": data.subject_id})
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        
        total_students = await db.journal_students.count_documents({"journal_id": journal_id})
        
        # Маппинг типов занятий из расписания в типы сессий
        lesson_type_map = {
            "лекция": "lecture",
            "лек": "lecture",
            "лекции": "lecture",
            "семинар": "seminar",
            "сем": "seminar",
            "практика": "seminar",
            "практ": "seminar",
            "практическое": "seminar",
            "лабораторная": "lab",
            "лаб": "lab",
            "лабораторная работа": "lab",
            "экзамен": "exam",
            "зачёт": "exam",
            "зачет": "exam",
            "консультация": "lecture",
            "конс": "lecture",
        }
        
        created_sessions = []
        skipped_count = 0
        
        for schedule_item in data.sessions:
            # Проверяем, не существует ли уже такое занятие
            existing = await db.journal_sessions.find_one({
                "journal_id": journal_id,
                "subject_id": data.subject_id,
                "date": schedule_item.date,
                "title": {"$regex": f"^{schedule_item.time}", "$options": "i"}
            })
            
            if existing:
                skipped_count += 1
                continue
            
            # Определяем тип занятия
            lesson_type_lower = schedule_item.lesson_type.lower().strip()
            session_type = "lecture"  # по умолчанию
            for key, value in lesson_type_map.items():
                if key in lesson_type_lower:
                    session_type = value
                    break
            
            # Формируем название и описание
            title = f"{schedule_item.time} — {schedule_item.lesson_type}"
            
            description_parts = []
            if schedule_item.teacher:
                description_parts.append(f"Преподаватель: {schedule_item.teacher}")
            if schedule_item.auditory:
                description_parts.append(f"Аудитория: {schedule_item.auditory}")
            description = "; ".join(description_parts) if description_parts else None
            
            # Создаём сессию
            session = JournalSession(
                journal_id=journal_id,
                subject_id=data.subject_id,
                date=schedule_item.date,
                title=title,
                description=description,
                type=session_type,
                created_by=data.telegram_id
            )
            
            await db.journal_sessions.insert_one(session.model_dump())
            
            created_sessions.append(JournalSessionResponse(
                session_id=session.session_id,
                journal_id=session.journal_id,
                date=session.date,
                title=session.title,
                description=session.description,
                type=session.type,
                created_at=session.created_at,
                created_by=session.created_by,
                attendance_filled=0,
                total_students=total_students
            ))
        
        logger.info(f"Created {len(created_sessions)} sessions from schedule for journal {journal_id}, skipped {skipped_count}")
        
        return {
            "status": "success",
            "created_count": len(created_sessions),
            "skipped_count": skipped_count,
            "sessions": created_sessions
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating sessions from schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== Посещаемость =====

@api_router.post("/journals/sessions/{session_id}/attendance")
async def mark_attendance(session_id: str, data: AttendanceBulkCreate):
    """Массовая отметка посещаемости"""
    try:
        session = await db.journal_sessions.find_one({"session_id": session_id})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        journal_id = session["journal_id"]
        
        for record in data.records:
            # Проверить существующую запись
            existing = await db.attendance_records.find_one({
                "session_id": session_id,
                "student_id": record.student_id
            })
            
            if existing:
                # Обновить
                await db.attendance_records.update_one(
                    {"id": existing["id"]},
                    {"$set": {
                        "status": record.status,
                        "reason": record.reason,
                        "note": record.note,
                        "marked_by": data.telegram_id,
                        "marked_at": datetime.utcnow()
                    }}
                )
            else:
                # Создать новую запись
                new_record = AttendanceRecord(
                    journal_id=journal_id,
                    session_id=session_id,
                    student_id=record.student_id,
                    status=record.status,
                    reason=record.reason,
                    note=record.note,
                    marked_by=data.telegram_id
                )
                await db.attendance_records.insert_one(new_record.model_dump())
        
        return {"status": "success", "marked_count": len(data.records)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking attendance: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/journals/sessions/{session_id}/attendance")
async def get_session_attendance(session_id: str):
    """Получить посещаемость на занятии"""
    try:
        session = await db.journal_sessions.find_one({"session_id": session_id})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Получить всех студентов журнала
        students = await db.journal_students.find(
            {"journal_id": session["journal_id"]}
        ).sort("order", 1).to_list(200)
        
        # Получить записи посещаемости
        records = await db.attendance_records.find(
            {"session_id": session_id}
        ).to_list(200)
        
        records_map = {r["student_id"]: r for r in records}
        
        result = []
        for s in students:
            record = records_map.get(s["id"])
            result.append({
                "student_id": s["id"],
                "full_name": s["full_name"],
                "is_linked": s.get("is_linked", False),
                "status": record["status"] if record else "unmarked",
                "reason": record.get("reason") if record else None,
                "note": record.get("note") if record else None,
                "marked_at": record.get("marked_at") if record else None
            })
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting attendance: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/journals/{journal_id}/my-attendance/{telegram_id}")
async def get_my_attendance(journal_id: str, telegram_id: int):
    """Получить мою посещаемость с разбивкой по предметам"""
    try:
        # Найти студента
        student = await db.journal_students.find_one({
            "journal_id": journal_id,
            "telegram_id": telegram_id,
            "is_linked": True
        })
        
        if not student:
            raise HTTPException(status_code=404, detail="Not linked to any student")
        
        # Получить все предметы журнала
        subjects = await db.journal_subjects.find(
            {"journal_id": journal_id}
        ).to_list(100)
        subjects_map = {s["subject_id"]: s for s in subjects}
        
        # Получить все занятия
        sessions = await db.journal_sessions.find(
            {"journal_id": journal_id}
        ).sort("date", -1).to_list(500)
        
        # Получить записи посещаемости
        records = await db.attendance_records.find(
            {"student_id": student["id"]}
        ).to_list(500)
        
        records_map = {r["session_id"]: r for r in records}
        
        # Общая статистика
        present_count = sum(1 for r in records if r["status"] in ["present", "late"])
        absent_count = sum(1 for r in records if r["status"] == "absent")
        excused_count = sum(1 for r in records if r["status"] == "excused")
        late_count = sum(1 for r in records if r["status"] == "late")
        total_sessions = len(sessions)
        
        attendance_percent = 0
        if total_sessions > 0:
            attendance_percent = round((present_count / total_sessions) * 100, 1)
        
        # Расчет стрика (серии посещений)
        current_streak = 0
        best_streak = 0
        temp_streak = 0
        is_current_streak_active = True
        
        # Проходим по занятиям от новых к старым
        for s in sessions:
            record = records_map.get(s["session_id"])
            status = record["status"] if record else "unmarked"
            
            # Пропускаем неотмеченные занятия (например, будущие)
            if status == "unmarked":
                continue
                
            if status in ["present", "late"]:
                # Посещение (или опоздание)
                if is_current_streak_active:
                    current_streak += 1
                
                temp_streak += 1
                if temp_streak > best_streak:
                    best_streak = temp_streak
            else:
                # Пропуск (absent или excused)
                # Уважительная причина тоже прерывает стрик посещений "подряд"
                is_current_streak_active = False
                temp_streak = 0
                
        # Статистика по предметам
        subjects_stats = {}
        for s in sessions:
            subject_id = s.get("subject_id")
            if subject_id not in subjects_stats:
                subject = subjects_map.get(subject_id, {})
                subjects_stats[subject_id] = {
                    "subject_id": subject_id,
                    "subject_name": subject.get("name", "Без предмета"),
                    "subject_color": subject.get("color", "blue"),
                    "total_sessions": 0,
                    "present_count": 0,
                    "absent_count": 0,
                    "late_count": 0,
                    "excused_count": 0,
                    "attendance_percent": 0,
                    "sessions": []
                }
            
            subjects_stats[subject_id]["total_sessions"] += 1
            
            record = records_map.get(s["session_id"])
            status = record["status"] if record else "unmarked"
            
            if status in ["present", "late"]:
                subjects_stats[subject_id]["present_count"] += 1
            if status == "absent":
                subjects_stats[subject_id]["absent_count"] += 1
            if status == "late":
                subjects_stats[subject_id]["late_count"] += 1
            if status == "excused":
                subjects_stats[subject_id]["excused_count"] += 1
            
            subjects_stats[subject_id]["sessions"].append({
                "session_id": s["session_id"],
                "date": s["date"],
                "title": s["title"],
                "type": s.get("type", "lecture"),
                "status": status
            })
        
        # Вычисляем процент по каждому предмету
        subjects_list = []
        for subject_id, stats in subjects_stats.items():
            if stats["total_sessions"] > 0:
                stats["attendance_percent"] = round(
                    (stats["present_count"] / stats["total_sessions"]) * 100, 1
                )
            subjects_list.append(stats)
        
        # Сортируем предметы по имени
        subjects_list.sort(key=lambda x: x["subject_name"])
        
        # Формируем общие записи (для совместимости)
        attendance_records = []
        for s in sessions:
            record = records_map.get(s["session_id"])
            subject = subjects_map.get(s.get("subject_id"), {})
            attendance_records.append({
                "session_id": s["session_id"],
                "date": s["date"],
                "title": s["title"],
                "type": s.get("type", "lecture"),
                "subject_id": s.get("subject_id"),
                "subject_name": subject.get("name", ""),
                "status": record["status"] if record else "unmarked",
                "reason": record.get("reason") if record else None,
                "note": record.get("note") if record else None
            })
        
        return {
            "student_id": student["id"],
            "full_name": student["full_name"],
            "attendance_percent": attendance_percent,
            "present_count": present_count,
            "absent_count": absent_count,
            "excused_count": excused_count,
            "late_count": late_count,
            "total_sessions": total_sessions,
            "current_streak": current_streak,
            "best_streak": best_streak,
            "subjects_stats": subjects_list,  # Статистика по предметам
            "records": attendance_records
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting my attendance: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/journals/{journal_id}/stats", response_model=JournalStatsResponse)
async def get_journal_stats(journal_id: str, telegram_id: int = 0):
    """
    Получить статистику журнала
    ОПТИМИЗИРОВАНО: Uses Aggregation Pipeline + Smart Logic
    ДОСТУП: Только owner или пользователи из stats_viewers
    """
    try:
        # 1. Проверяем существование журнала
        journal = await db.attendance_journals.find_one({"journal_id": journal_id})
        if not journal:
            raise HTTPException(status_code=404, detail="Journal not found")
        
        # 2. Проверяем права доступа к статистике
        is_owner = journal["owner_id"] == telegram_id
        stats_viewers = journal.get("stats_viewers", [])
        can_view_stats = is_owner or telegram_id in stats_viewers
        
        if not can_view_stats:
            raise HTTPException(status_code=403, detail="Access denied. Only owner or authorized users can view stats.")
        
        # 3. Получаем всех студентов и занятия одним запросом (без лимитов для точности)
        students = await db.journal_students.find(
            {"journal_id": journal_id}
        ).sort("order", 1).to_list(None)
        
        sessions = await db.journal_sessions.find(
            {"journal_id": journal_id}
        ).sort("date", -1).to_list(None)
        
        total_students = len(students)
        linked_students = sum(1 for s in students if s.get("is_linked", False))
        total_sessions = len(sessions)
        
        # 4. АГРЕГАЦИЯ: Получаем все отметки одним запросом
        pipeline = [
            {"$match": {"journal_id": journal_id}},
            {"$group": {
                "_id": "$student_id",
                "present": {"$sum": {"$cond": [{"$in": ["$status", ["present"]]}, 1, 0]}},
                "late": {"$sum": {"$cond": [{"$eq": ["$status", "late"]}, 1, 0]}},
                "absent": {"$sum": {"$cond": [{"$eq": ["$status", "absent"]}, 1, 0]}},
                "excused": {"$sum": {"$cond": [{"$eq": ["$status", "excused"]}, 1, 0]}},
                # Считаем общее количество отметок (чтобы знать, кого отмечали)
                "total_marked": {"$sum": 1},
                # Собираем ID посещенных занятий для корректного расчета статистики новичков
                "attended_sessions": {"$addToSet": "$session_id"}
            }}
        ]
        
        att_data = await db.attendance_records.aggregate(pipeline).to_list(None)
        # Превращаем в словарь для быстрого доступа: {student_id: {stats}}
        att_map = {item["_id"]: item for item in att_data}
        
        # 5. Расчет статистики по каждому студенту (Python-side logic)
        students_stats = []
        
        # Переменные для общей статистики
        global_numerator = 0
        global_denominator = 0
        
        for s in students:
            s_id = s["id"]
            stats = att_map.get(s_id, {"present": 0, "late": 0, "absent": 0, "excused": 0})
            
            present = stats["present"]
            late = stats["late"]
            absent = stats["absent"]
            excused = stats["excused"]
            
            # --- ЛОГИКА "НОВИЧКА" (New Student Logic) ---
            # Студент отвечает за занятия, которые произошли после его добавления
            # ИЛИ за те занятия, где он был отмечен (даже если это было "в прошлом")
            student_created_at = s.get("created_at")
            attended_sessions = set(stats.get("attended_sessions", []))
            
            valid_sessions_count = 0
            
            if not student_created_at:
                # Если даты нет (старые данные), считаем все
                valid_sessions_count = total_sessions
            else:
                s_created_date_str = student_created_at.strftime("%Y-%m-%d")
                
                for sess in sessions:
                    # Учитываем занятие, если оно было после создания студента
                    # ИЛИ если студент был отмечен на этом занятии (даже если оно было раньше)
                    is_after_creation = sess["date"] >= s_created_date_str
                    is_marked = sess["session_id"] in attended_sessions
                    
                    if is_after_creation or is_marked:
                        valid_sessions_count += 1
            
            # --- ЛОГИКА "УВАЖИТЕЛЬНОЙ ПРИЧИНЫ" (Excused Logic) ---
            # Эффективное количество занятий для знаменателя
            # Если студент был excused, это занятие вычитается из "общего числа требований"
            effective_sessions = valid_sessions_count - excused
            
            # Защита от отрицательных чисел (если вдруг excused больше чем valid - редкий кейс рассинхрона)
            if effective_sessions < 0:
                effective_sessions = 0
                
            # Числитель: Присутствовал + Опоздал
            numerator = present + late
            
            # Процент
            att_percent = None
            if effective_sessions > 0:
                att_percent = round((numerator / effective_sessions) * 100, 1)
                
                # Добавляем в общую копилку (только если есть занятия)
                global_numerator += numerator
                global_denominator += effective_sessions
            
            # IMPLICIT ABSENT FIX:
            # Чтобы в UI (present / present+absent) совпадало с процентом,
            # считаем "неотмеченные" (unmarked) как прогулы для отображения
            # absent_count = (Total Valid - Excused) - (Present + Late)
            implicit_absent = effective_sessions - (present + late)
            # Если вдруг отрицательное (из-за рассинхрона дат), ставим 0
            if implicit_absent < 0:
                implicit_absent = 0
            
            students_stats.append(JournalStudentResponse(
                id=s["id"],
                journal_id=s["journal_id"],
                full_name=s["full_name"],
                telegram_id=s.get("telegram_id"),
                username=s.get("username"),
                first_name=s.get("first_name"),
                is_linked=s.get("is_linked", False),
                linked_at=s.get("linked_at"),
                order=s.get("order", 0),
                attendance_percent=att_percent,
                present_count=present + late, 
                absent_count=implicit_absent, # UPDATED: Includes explicit absent + unmarked
                excused_count=excused,
                late_count=late,
                total_sessions=valid_sessions_count 
            ))
            
        # 5. Общий процент по журналу
        overall_percent = 0
        if global_denominator > 0:
            overall_percent = round((global_numerator / global_denominator) * 100, 1)
        
        # 6. Статистика по занятиям (Sessions Stats)
        # Здесь тоже нужна агрегация, но для занятий их обычно меньше, и старый цикл был "OK", 
        # но лучше оптимизировать.
        
        # Агрегация по занятиям
        session_pipeline = [
            {"$match": {"journal_id": journal_id}},
            {"$group": {
                "_id": "$session_id",
                "filled_count": {"$sum": 1},
                "present": {"$sum": {"$cond": [{"$in": ["$status", ["present", "late"]]}, 1, 0]}},
                "absent": {"$sum": {"$cond": [{"$eq": ["$status", "absent"]}, 1, 0]}},
                # "late" уже включен в present выше, но если нужно отдельно:
                "late_only": {"$sum": {"$cond": [{"$eq": ["$status", "late"]}, 1, 0]}}
            }}
        ]
        sess_data = await db.attendance_records.aggregate(session_pipeline).to_list(None)
        sess_map = {item["_id"]: item for item in sess_data}
        
        sessions_stats = []
        for sess in sessions:
            s_stats = sess_map.get(sess["session_id"], {"filled_count": 0, "present": 0, "absent": 0})
            
            sessions_stats.append(JournalSessionResponse(
                session_id=sess["session_id"],
                journal_id=sess["journal_id"],
                date=sess["date"],
                title=sess["title"],
                description=sess.get("description"),
                type=sess.get("type", "lecture"),
                created_at=sess["created_at"],
                created_by=sess["created_by"],
                attendance_filled=s_stats["filled_count"],
                total_students=total_students,
                present_count=s_stats["present"],
                absent_count=s_stats["absent"]
            ))
        
        # 7. Статистика по предметам (Subjects Stats) - НОВАЯ СЕКЦИЯ
        # Получаем все предметы журнала
        subjects = await db.journal_subjects.find({"journal_id": journal_id}).to_list(None)
        subjects_map = {s["subject_id"]: s for s in subjects}
        
        # Создаем маппинг session_id -> subject_id
        session_to_subject = {sess["session_id"]: sess.get("subject_id") for sess in sessions}
        
        # Агрегируем посещаемость по предметам
        subjects_stats_dict = {}
        for subject in subjects:
            subject_id = subject["subject_id"]
            subjects_stats_dict[subject_id] = {
                "subject_id": subject_id,
                "subject_name": subject.get("name", "Без названия"),
                "subject_color": subject.get("color", "blue"),
                "total_sessions": 0,
                "total_records": 0,
                "present_count": 0,
                "absent_count": 0,
                "late_count": 0,
                "excused_count": 0,
                "attendance_percent": 0.0
            }
        
        # Считаем занятия по каждому предмету
        for sess in sessions:
            subject_id = sess.get("subject_id")
            if subject_id and subject_id in subjects_stats_dict:
                subjects_stats_dict[subject_id]["total_sessions"] += 1
                # Добавляем статистику из отмеченных посещений
                s_stats = sess_map.get(sess["session_id"], {"present": 0, "absent": 0, "late_only": 0, "filled_count": 0})
                subjects_stats_dict[subject_id]["present_count"] += s_stats.get("present", 0)
                subjects_stats_dict[subject_id]["absent_count"] += s_stats.get("absent", 0)
                subjects_stats_dict[subject_id]["late_count"] += s_stats.get("late_only", 0)
                subjects_stats_dict[subject_id]["total_records"] += s_stats.get("filled_count", 0)
        
        # Вычисляем проценты посещаемости по каждому предмету
        subjects_stats_list = []
        for subject_id, s_data in subjects_stats_dict.items():
            total_possible = s_data["total_sessions"] * total_students
            if total_possible > 0 and s_data["total_records"] > 0:
                # present_count уже включает late (present + late)
                s_data["attendance_percent"] = round(
                    (s_data["present_count"] / s_data["total_records"]) * 100, 1
                )
            subjects_stats_list.append(SubjectStatsResponse(**s_data))
        
        # Сортируем по имени предмета
        subjects_stats_list.sort(key=lambda x: x.subject_name)
        
        return JournalStatsResponse(
            journal_id=journal_id,
            total_students=total_students,
            linked_students=linked_students,
            total_sessions=total_sessions,
            overall_attendance_percent=overall_percent,
            students_stats=students_stats,
            sessions_stats=sessions_stats,
            subjects_stats=subjects_stats_list
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting journal stats: {e}")
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
        
        # Получаем токен через config (с учетом ENV)
        active_token = get_telegram_bot_token()
        
        if active_token:
            env_mode = "TEST" if is_test_environment() else "PRODUCTION"
            logger.info(f"🤖 Запуск Telegram бота в режиме {env_mode}...")
            
            # Создаем приложение бота
            bot_application = Application.builder().token(active_token).build()
            
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
                logger.info(f"✅ Telegram bot polling started successfully (ENV={ENV})")
            
            # Создаем background task
            asyncio.create_task(start_bot())
            logger.info(f"Telegram bot initialization started as background task (ENV={ENV})")
        else:
            logger.warning("Токен бота не найден, bot not started")
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
