from fastapi import FastAPI, APIRouter, HTTPException, Body, WebSocket, WebSocketDisconnect, Request, Query
from fastapi.responses import JSONResponse, StreamingResponse, RedirectResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timedelta
from itertools import groupby
import httpx
import aiohttp
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
    YouTubeInfoResponse,
    VKVideoInfoResponse,
    TaskProductivityStats,
    TaskReorderItem,
    TaskReorderRequest,
    TaskSubtask,
    TaskSubtaskCreate,
    TaskSubtaskUpdate,
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
    AdminSendNotificationRequest,
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
    RoomAddFriendsRequest,
    RoomFriendToAdd,
    TaskReorderRequest as RoomTaskReorderRequest,
    ReferralUser,
    ReferralStats,
    ReferralTreeNode,
    ReferralCodeResponse,
    ReferralConnection,
    ProcessReferralRequest,
    PlannerSyncRequest,
    PlannerSyncResponse,
    PlannerDayRequest,
    PlannerDayResponse,
    ProcessReferralResponse,
    # Модели для журнала посещений
    AttendanceJournal,
    JournalCreate,
    JournalStudent,
    JournalStudentCreate,
    JournalStudentBulkCreate,
    JournalStudentsFromFriendsCreate,
    JournalStudentFromFriend,
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
    JournalJoinApplication,
    ProcessJournalApplicationRequest,
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
    NotificationHistoryResponse,
    # Модели для ЛК РУДН
    LKCredentialsRequest,
    LKPersonalData,
    LKConnectionResponse,
    LKDataResponse,
    LKStatusResponse,
    # Модели для системы друзей
    FriendshipStatus,
    PrivacySettings,
    FriendRequest,
    FriendRequestCreate,
    Friend,
    UserBlock,
    UserProfilePublic,
    FriendCard,
    FriendRequestCard,
    FriendsListResponse,
    FriendRequestsResponse,
    FriendSearchResult,
    FriendSearchResponse,
    ProcessFriendInviteRequest,
    ProcessFriendInviteResponse,
    MutualFriendsResponse,
    FriendScheduleResponse,
    PrivacySettingsUpdate,
    FriendActionResponse,
    # Модели для системы уведомлений
    NotificationType,
    NotificationCategory,
    NotificationPriority,
    InAppNotification,
    InAppNotificationCreate,
    NotificationCard,
    NotificationsListResponse,
    ExtendedNotificationSettings,
    ExtendedNotificationSettingsUpdate,
    UnreadCountResponse,
    # Модели для веб-сессий (связка Telegram профиля)
    WebSessionStatus,
    WebSession,
    WebSessionCreate,
    WebSessionResponse,
    WebSessionLinkRequest,
    WebSessionLinkResponse,
    WebSessionCreateRequest,
    DeviceInfo,
    DevicesListResponse,
    # Модели для совместного прослушивания музыки
    ListeningRoomControlMode,
    ListeningRoomParticipant,
    ListeningRoomTrack,
    ListeningRoomState,
    ListeningRoom,
    CreateListeningRoomRequest,
    CreateListeningRoomResponse,
    JoinListeningRoomRequest,
    JoinListeningRoomResponse,
    ListeningRoomResponse,
    UpdateListeningRoomSettingsRequest,
    ListeningRoomSyncEvent
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
from lk_parser import RUDNLKParser


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
    # FIX: Даже с wildcard, используем allow_credentials=True и echoing origin
    # Это лучше работает с Kubernetes ingress/proxy
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=cors_origins_list,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
        max_age=3600,
    )
    logger.info("CORS configured with wildcard (*) - all origins allowed with credentials")
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
    origin = request.headers.get("origin", "")
    
    # FIX: Для OPTIONS preflight — быстрый ответ с CORS headers
    if request.method == "OPTIONS":
        response = Response(content="OK", status_code=200)
        response.headers["access-control-allow-origin"] = origin or "*"
        response.headers["access-control-allow-methods"] = "DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT"
        response.headers["access-control-allow-headers"] = "*"
        response.headers["access-control-allow-credentials"] = "true"
        response.headers["access-control-max-age"] = "3600"
        return response
    
    response = await call_next(request)
    
    # FIX: ВСЕГДА перезаписываем CORS headers (echo origin для совместимости с credentials)
    # access-control-allow-origin: * + credentials: true запрещено спецификацией CORS
    if origin:
        response.headers["access-control-allow-origin"] = origin
    elif not response.headers.get("access-control-allow-origin"):
        response.headers["access-control-allow-origin"] = "*"
    
    response.headers["access-control-allow-methods"] = "DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT"
    response.headers["access-control-allow-headers"] = "*"
    response.headers["access-control-allow-credentials"] = "true"
    response.headers["access-control-max-age"] = "3600"
        
    return response


# ============ Database Indexes Optimization ============
async def safe_create_index(collection, keys, **kwargs):
    """Безопасное создание индекса — игнорирует конфликты с существующими индексами"""
    try:
        await collection.create_index(keys, **kwargs)
    except Exception as e:
        if "IndexOptionsConflict" in str(e) or "already exists" in str(e):
            logger.debug(f"Index already exists for {collection.name}: {keys}")
        else:
            logger.warning(f"Index creation warning for {collection.name}: {e}")

async def create_indexes():
    """Create indexes for all collections to ensure scalability"""
    try:
        # User Settings
        await safe_create_index(db.user_settings, "telegram_id", unique=True)
        await safe_create_index(db.user_settings, "group_id")
        
        # Tasks - основной индекс для списка задач
        await safe_create_index(db.tasks, [("telegram_id", 1), ("completed", 1)])
        # Tasks - индекс для telegram_id отдельно (для сортировки по order)
        await safe_create_index(db.tasks, "telegram_id")
        # Tasks - составной индекс для планировщика (target_date запросы)
        await safe_create_index(db.tasks, [("telegram_id", 1), ("target_date", 1)])
        
        # User Stats - индекс для быстрого поиска статистики достижений
        await safe_create_index(db.user_stats, "telegram_id", unique=True)
        
        # User Achievements - индекс для быстрой проверки достижений
        await safe_create_index(db.user_achievements, "telegram_id")
        await safe_create_index(db.user_achievements, [("telegram_id", 1), ("achievement_id", 1)], unique=True)
        
        # Rooms
        await safe_create_index(db.rooms, "owner_id")
        await safe_create_index(db.rooms, "participants.telegram_id")
        await safe_create_index(db.rooms, "invite_token", unique=True)
        
        # Group Tasks
        await safe_create_index(db.group_tasks, "room_id")
        await safe_create_index(db.group_tasks, [("participants.telegram_id", 1), ("completed", 1)])
        
        # Journals & Attendance
        await safe_create_index(db.journals, "owner_id")
        await safe_create_index(db.journals, "invite_token", unique=True)
        
        await safe_create_index(db.journal_students, "journal_id")
        await safe_create_index(db.journal_students, "telegram_id")
        await safe_create_index(db.journal_students, "invite_code", unique=True)
        
        # Compound index for fast attendance lookups
        await safe_create_index(db.attendance_records, [("journal_id", 1), ("session_id", 1)])
        await safe_create_index(db.attendance_records, [("journal_id", 1), ("student_id", 1)])
        
        # Scheduled Notifications
        await safe_create_index(db.scheduled_notifications, "notification_key", unique=True)
        await safe_create_index(db.scheduled_notifications, [("date", 1), ("status", 1)])
        
        # Referral System
        await safe_create_index(db.referral_events, "telegram_id")
        await safe_create_index(db.referral_events, "referrer_id")
        
        # Notification History
        await safe_create_index(db.notification_history, [("telegram_id", 1), ("sent_at", -1)])
        
        # Cover Cache (Deezer обложки)
        await safe_create_index(db.cover_cache, "cache_key", unique=True)
        await safe_create_index(db.cover_cache, "expires_at", expireAfterSeconds=0)
        
        # In-App Notifications
        await safe_create_index(db.in_app_notifications, [("telegram_id", 1), ("created_at", -1)])
        
        # Friends system indexes
        await safe_create_index(db.friends, [("user_telegram_id", 1), ("friend_telegram_id", 1)], unique=True)
        await safe_create_index(db.friends, "user_telegram_id")
        await safe_create_index(db.friends, "friend_telegram_id")
        await safe_create_index(db.friend_requests, [("from_telegram_id", 1), ("to_telegram_id", 1), ("status", 1)])
        await safe_create_index(db.friend_requests, [("to_telegram_id", 1), ("status", 1)])
        await safe_create_index(db.user_blocks, [("blocker_telegram_id", 1), ("blocked_telegram_id", 1)], unique=True)
        
        logger.info("✅ Database indexes created successfully")
    except Exception as e:
        logger.error(f"❌ Failed to create database indexes: {e}")

@app.on_event("startup")
async def startup_event():
    # Setup Playwright browser symlinks for LK RUDN parser
    import subprocess
    try:
        setup_script = "/app/scripts/setup_playwright.sh"
        if os.path.exists(setup_script):
            subprocess.run(["bash", setup_script], check=True, capture_output=True)
            logger.info("✅ Playwright browser symlinks configured")
    except Exception as e:
        logger.warning(f"⚠️ Failed to setup Playwright symlinks: {e}")
    
    # Initialize cover service for Deezer album art
    try:
        init_cover_service(db)
    except Exception as e:
        logger.warning(f"⚠️ Failed to init cover service: {e}")
    
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
    """Получить расписание для группы (с fallback на кэш)"""
    try:
        events = await get_schedule(
            facultet_id=request.facultet_id,
            level_id=request.level_id,
            kurs=request.kurs,
            form_code=request.form_code,
            group_id=request.group_id,
            week_number=request.week_number
        )
        
        if events:
            # Кэшируем расписание
            cache_data = {
                "id": str(uuid.uuid4()),
                "group_id": request.group_id,
                "week_number": request.week_number,
                "events": [event for event in events],
                "cached_at": datetime.utcnow(),
                "expires_at": datetime.utcnow() + timedelta(hours=6)
            }
            
            await db.schedule_cache.update_one(
                {"group_id": request.group_id, "week_number": request.week_number},
                {"$set": cache_data},
                upsert=True
            )
            
            # Планируем уведомления в фоне
            try:
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
        else:
            # Пустой результат от RUDN API — пробуем кэш
            cached = await db.schedule_cache.find_one({
                "group_id": request.group_id,
                "week_number": request.week_number
            })
            
            if cached and cached.get("events"):
                logger.info(f"RUDN API вернул пустой ответ, используем кэш для группы {request.group_id}")
                return ScheduleResponse(
                    events=[ScheduleEvent(**event) for event in cached["events"]],
                    group_id=request.group_id,
                    week_number=request.week_number
                )
            
            # Нет ни данных, ни кэша — возвращаем пустое расписание
            return ScheduleResponse(
                events=[],
                group_id=request.group_id,
                week_number=request.week_number
            )
            
    except Exception as e:
        logger.error(f"Ошибка при получении расписания: {e}")
        
        # При ошибке — пробуем отдать кэш
        try:
            cached = await db.schedule_cache.find_one({
                "group_id": request.group_id,
                "week_number": request.week_number
            })
            if cached and cached.get("events"):
                logger.info(f"Ошибка RUDN API, отдаём кэш для группы {request.group_id}")
                return ScheduleResponse(
                    events=[ScheduleEvent(**event) for event in cached["events"]],
                    group_id=request.group_id,
                    week_number=request.week_number
                )
        except Exception:
            pass
        
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
        
        # 13. Удаляем веб-сессии (привязанные устройства)
        # Сначала закрываем активные WebSocket соединения
        sessions = await db.web_sessions.find({"telegram_id": telegram_id}).to_list(length=100)
        for session in sessions:
            session_token = session.get("session_token")
            if session_token and session_token in web_session_connections:
                try:
                    ws = web_session_connections[session_token]
                    await ws.send_json({"event": "revoked", "message": "Аккаунт удалён"})
                    await ws.close()
                except:
                    pass
                finally:
                    if session_token in web_session_connections:
                        del web_session_connections[session_token]
        
        result = await db.web_sessions.delete_many({"telegram_id": telegram_id})
        deleted_counts["web_sessions"] = result.deleted_count
        
        # 14. Удаляем VK токены
        result = await db.user_vk_tokens.delete_many({"telegram_id": telegram_id})
        deleted_counts["vk_tokens"] = result.deleted_count
        
        # 15. Удаляем избранные треки
        result = await db.music_favorites.delete_many({"telegram_id": telegram_id})
        deleted_counts["music_favorites"] = result.deleted_count
        
        # 16. Удаляем уведомления
        await db.scheduled_notifications.delete_many({"telegram_id": telegram_id})
        await db.notification_history.delete_many({"telegram_id": telegram_id})
        await db.in_app_notifications.delete_many({"telegram_id": telegram_id})
        
        # 17. Удаляем друзей и запросы в друзья
        await db.friends.delete_many({
            "$or": [
                {"user_id": telegram_id},
                {"friend_id": telegram_id}
            ]
        })
        await db.friend_requests.delete_many({
            "$or": [
                {"from_user_id": telegram_id},
                {"to_user_id": telegram_id}
            ]
        })
        
        # 18. Удаляем блокировки
        await db.user_blocks.delete_many({
            "$or": [
                {"blocker_id": telegram_id},
                {"blocked_id": telegram_id}
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


# ============ YouTube API ============

import re
import yt_dlp

# Кэш для YouTube информации (в памяти, чтобы не запрашивать повторно)
youtube_cache = {}
vk_video_cache = {}

def extract_youtube_video_id(url: str) -> Optional[str]:
    """Извлекает video_id из YouTube URL"""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def extract_vk_video_id(url: str) -> Optional[str]:
    """Извлекает video_id из VK Video URL"""
    patterns = [
        r'vk\.com/video(-?\d+_\d+)',  # vk.com/video-123_456
        r'vk\.com/clip(-?\d+_\d+)',   # vk.com/clip-123_456
        r'vkvideo\.ru/video(-?\d+_\d+)',  # vkvideo.ru/video-123_456
        r'[?&]z=video(-?\d+_\d+)',  # ?z=video-123_456 или &z=video-123_456 (из любого пути: wall, videos, club, etc.)
        r'vk\.com/.*video(-?\d+_\d+)',  # любой URL с video-123_456 (fallback)
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def find_vk_video_url_in_text(text: str) -> Optional[str]:
    """Находит первую VK Video ссылку в тексте"""
    patterns = [
        r'https?://(?:www\.)?vk\.com/video-?\d+_\d+[^\s]*',  # vk.com/video-123_456
        r'https?://(?:www\.)?vk\.com/clip-?\d+_\d+[^\s]*',   # vk.com/clip-123_456
        r'https?://(?:www\.)?vkvideo\.ru/video-?\d+_\d+[^\s]*',  # vkvideo.ru/video-123_456
        r'https?://(?:www\.)?vk\.com/[^\s]*[?&]z=video-?\d+_\d+[^\s]*',  # любой путь с ?z=video (wall, videos, club, etc.)
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(0)
    return None

def find_all_vk_video_urls_in_text(text: str) -> List[str]:
    """Находит ВСЕ VK Video ссылки в тексте"""
    patterns = [
        r'https?://(?:www\.)?vk\.com/video-?\d+_\d+[^\s]*',  # vk.com/video-123_456
        r'https?://(?:www\.)?vk\.com/clip-?\d+_\d+[^\s]*',   # vk.com/clip-123_456
        r'https?://(?:www\.)?vkvideo\.ru/video-?\d+_\d+[^\s]*',  # vkvideo.ru/video-123_456
        r'https?://(?:www\.)?vk\.com/[^\s]*[?&]z=video-?\d+_\d+[^\s]*',  # любой путь с ?z=video (wall, videos, club, etc.)
    ]
    urls = []
    for pattern in patterns:
        matches = re.findall(pattern, text)
        urls.extend(matches)
    return list(set(urls))  # Убираем дубликаты

def format_duration(seconds: int) -> str:
    """Форматирует длительность в человекочитаемый формат"""
    if seconds < 0:
        return "0:00"
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"

def find_youtube_url_in_text(text: str) -> Optional[str]:
    """Находит первую YouTube ссылку в тексте"""
    patterns = [
        r'https?://(?:www\.)?youtube\.com/watch\?v=[a-zA-Z0-9_-]{11}[^\s]*',
        r'https?://youtu\.be/[a-zA-Z0-9_-]{11}[^\s]*',
        r'https?://(?:www\.)?youtube\.com/shorts/[a-zA-Z0-9_-]{11}[^\s]*',
        r'https?://(?:www\.)?youtube\.com/embed/[a-zA-Z0-9_-]{11}[^\s]*',
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(0)
    return None

def find_all_youtube_urls_in_text(text: str) -> List[str]:
    """Находит ВСЕ YouTube ссылки в тексте"""
    patterns = [
        r'https?://(?:www\.)?youtube\.com/watch\?v=[a-zA-Z0-9_-]{11}[^\s]*',
        r'https?://youtu\.be/[a-zA-Z0-9_-]{11}[^\s]*',
        r'https?://(?:www\.)?youtube\.com/shorts/[a-zA-Z0-9_-]{11}[^\s]*',
        r'https?://(?:www\.)?youtube\.com/embed/[a-zA-Z0-9_-]{11}[^\s]*',
    ]
    urls = []
    for pattern in patterns:
        matches = re.findall(pattern, text)
        urls.extend(matches)
    return list(set(urls))  # Убираем дубликаты


@api_router.get("/youtube/info", response_model=YouTubeInfoResponse)
async def get_youtube_info(url: str):
    """
    Получить информацию о YouTube видео (название, длительность, превью)
    """
    try:
        # Проверяем кэш
        video_id = extract_youtube_video_id(url)
        if not video_id:
            raise HTTPException(status_code=400, detail="Некорректная YouTube ссылка")
        
        if video_id in youtube_cache:
            logger.info(f"🎬 YouTube info from cache: {video_id}")
            return youtube_cache[video_id]
        
        logger.info(f"🎬 Fetching YouTube info for: {url}")
        
        # Используем yt-dlp для получения информации
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'skip_download': True,
        }
        
        loop = asyncio.get_event_loop()
        
        def fetch_info():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                return ydl.extract_info(url, download=False)
        
        info = await loop.run_in_executor(None, fetch_info)
        
        if not info:
            raise HTTPException(status_code=404, detail="Видео не найдено")
        
        duration_seconds = info.get('duration', 0) or 0
        
        result = YouTubeInfoResponse(
            url=url,
            video_id=video_id,
            title=info.get('title', 'Без названия'),
            duration=format_duration(duration_seconds),
            duration_seconds=duration_seconds,
            thumbnail=info.get('thumbnail', f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg"),
            channel=info.get('channel', info.get('uploader', None))
        )
        
        # Сохраняем в кэш
        youtube_cache[video_id] = result
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении информации о YouTube видео: {e}")
        raise HTTPException(status_code=500, detail=f"Не удалось получить информацию о видео: {str(e)}")


@api_router.get("/vkvideo/info", response_model=VKVideoInfoResponse)
async def get_vk_video_info(url: str):
    """
    Получить информацию о VK видео (название, длительность, превью)
    """
    try:
        # Проверяем кэш
        video_id = extract_vk_video_id(url)
        if not video_id:
            raise HTTPException(status_code=400, detail="Некорректная VK Video ссылка")
        
        if video_id in vk_video_cache:
            logger.info(f"🎬 VK Video info from cache: {video_id}")
            return vk_video_cache[video_id]
        
        logger.info(f"🎬 Fetching VK Video info for: {url}")
        
        # Используем yt-dlp для получения информации (поддерживает VK)
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'skip_download': True,
        }
        
        loop = asyncio.get_event_loop()
        
        def fetch_info():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                return ydl.extract_info(url, download=False)
        
        info = await loop.run_in_executor(None, fetch_info)
        
        if not info:
            raise HTTPException(status_code=404, detail="Видео не найдено")
        
        duration_seconds = info.get('duration', 0) or 0
        
        # Пытаемся получить превью
        thumbnail = info.get('thumbnail')
        if not thumbnail:
            thumbnails = info.get('thumbnails', [])
            if thumbnails:
                thumbnail = thumbnails[-1].get('url', '')
        
        result = VKVideoInfoResponse(
            url=url,
            video_id=video_id,
            title=info.get('title', 'Без названия'),
            duration=format_duration(duration_seconds),
            duration_seconds=duration_seconds,
            thumbnail=thumbnail or '',
            channel=info.get('channel', info.get('uploader', None))
        )
        
        # Сохраняем в кэш
        vk_video_cache[video_id] = result
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении информации о VK видео: {e}")
        raise HTTPException(status_code=500, detail=f"Не удалось получить информацию о видео: {str(e)}")


async def enrich_task_with_youtube(task_dict: dict) -> dict:
    """DEPRECATED: Используйте enrich_task_with_all_videos для поддержки нескольких ссылок"""
    return task_dict


async def enrich_task_with_vk_video(task_dict: dict) -> dict:
    """DEPRECATED: Используйте enrich_task_with_all_videos для поддержки нескольких ссылок"""
    return task_dict


async def get_youtube_video_info(youtube_url: str) -> Optional[dict]:
    """Получает информацию о YouTube видео по URL"""
    video_id = extract_youtube_video_id(youtube_url)
    if not video_id:
        return None
    
    try:
        # Проверяем кэш
        if video_id in youtube_cache:
            info = youtube_cache[video_id]
            return {
                'url': youtube_url,
                'title': info.title,
                'duration': info.duration,
                'thumbnail': info.thumbnail,
                'type': 'youtube'
            }
        
        # Если нет в кэше - запрашиваем
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'skip_download': True,
        }
        
        loop = asyncio.get_event_loop()
        
        def fetch_info():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                return ydl.extract_info(youtube_url, download=False)
        
        info = await loop.run_in_executor(None, fetch_info)
        
        if info:
            duration_seconds = info.get('duration', 0) or 0
            
            result = YouTubeInfoResponse(
                url=youtube_url,
                video_id=video_id,
                title=info.get('title', 'Без названия'),
                duration=format_duration(duration_seconds),
                duration_seconds=duration_seconds,
                thumbnail=info.get('thumbnail', f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg"),
                channel=info.get('channel', info.get('uploader', None))
            )
            
            # Сохраняем в кэш
            youtube_cache[video_id] = result
            
            return {
                'url': youtube_url,
                'title': result.title,
                'duration': result.duration,
                'thumbnail': result.thumbnail,
                'type': 'youtube'
            }
    except Exception as e:
        logger.warning(f"Не удалось получить YouTube info: {e}")
    
    return None


async def get_vk_video_info(vk_video_url: str) -> Optional[dict]:
    """Получает информацию о VK видео по URL"""
    video_id = extract_vk_video_id(vk_video_url)
    if not video_id:
        return None
    
    try:
        # Проверяем кэш
        if video_id in vk_video_cache:
            info = vk_video_cache[video_id]
            return {
                'url': vk_video_url,
                'title': info.title,
                'duration': info.duration,
                'thumbnail': info.thumbnail,
                'type': 'vk'
            }
        
        # Если нет в кэше - запрашиваем
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'skip_download': True,
        }
        
        loop = asyncio.get_event_loop()
        
        def fetch_info():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                return ydl.extract_info(vk_video_url, download=False)
        
        info = await loop.run_in_executor(None, fetch_info)
        
        if info:
            duration_seconds = info.get('duration', 0) or 0
            thumbnail = info.get('thumbnail')
            if not thumbnail:
                thumbnails = info.get('thumbnails', [])
                if thumbnails:
                    thumbnail = thumbnails[-1].get('url', '')
            
            result = VKVideoInfoResponse(
                url=vk_video_url,
                video_id=video_id,
                title=info.get('title', 'Без названия'),
                duration=format_duration(duration_seconds),
                duration_seconds=duration_seconds,
                thumbnail=thumbnail or '',
                channel=info.get('channel', info.get('uploader', None))
            )
            
            # Сохраняем в кэш
            vk_video_cache[video_id] = result
            
            return {
                'url': vk_video_url,
                'title': result.title,
                'duration': result.duration,
                'thumbnail': result.thumbnail,
                'type': 'vk'
            }
    except Exception as e:
        logger.warning(f"Не удалось получить VK Video info: {e}")
    
    return None


async def enrich_task_with_all_videos(task_dict: dict) -> dict:
    """Обогащает задачу информацией о ВСЕХ видео (YouTube и VK) в тексте"""
    # Если videos уже заполнен клиентом - не перезаписываем
    existing_videos = task_dict.get('videos', [])
    if existing_videos and len(existing_videos) > 0:
        return task_dict
    
    text = task_dict.get('text', '')
    if not text:
        task_dict['videos'] = []
        return task_dict
    
    videos = []
    
    # Находим все YouTube ссылки
    youtube_urls = find_all_youtube_urls_in_text(text)
    for url in youtube_urls:
        video_info = await get_youtube_video_info(url)
        if video_info:
            videos.append(video_info)
    
    # Находим все VK ссылки
    vk_urls = find_all_vk_video_urls_in_text(text)
    for url in vk_urls:
        video_info = await get_vk_video_info(url)
        if video_info:
            videos.append(video_info)
    
    task_dict['videos'] = videos
    return task_dict


async def enrich_task_with_video(task_dict: dict) -> dict:
    """Обогащает задачу информацией о видео (YouTube и VK) - новая версия с поддержкой нескольких ссылок"""
    return await enrich_task_with_all_videos(task_dict)


# ============ Эндпоинты для списка дел ============

@api_router.get("/tasks/{telegram_id}", response_model=List[TaskResponse])
async def get_user_tasks(telegram_id: int):
    """Получить все задачи пользователя (исключая события планировщика)"""
    try:
        # Исключаем события планировщика (задачи с time_start И time_end)
        # События планировщика получаются через /api/planner/{telegram_id}/{date}
        query = {
            "telegram_id": telegram_id,
            "$or": [
                {"time_start": {"$exists": False}},
                {"time_start": None},
                {"time_end": {"$exists": False}},
                {"time_end": None}
            ]
        }
        
        # Сортируем по order (порядок drag & drop), затем по created_at
        tasks = await db.tasks.find(query).sort([("order", 1), ("created_at", -1)]).to_list(1000)
        
        # ОПТИМИЗАЦИЯ: НЕ вызываем enrich_task_with_video() для каждой задачи
        # Это убирает медленные сетевые запросы к YouTube/VK через yt_dlp
        # Видео информация возвращается только если уже сохранена в документе
        result = []
        for task in tasks:
            # Используем уже сохранённые videos, без сетевых запросов
            if 'videos' not in task:
                task['videos'] = []
            progress_info = calculate_subtasks_progress(task.get("subtasks", []))
            result.append(TaskResponse(**task, **progress_info))
        
        return result
    except Exception as e:
        logger.error(f"Ошибка при получении задач: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def calculate_subtasks_progress(subtasks: list) -> dict:
    """Вычислить прогресс по подзадачам"""
    if not subtasks:
        return {"subtasks_progress": 0, "subtasks_completed": 0, "subtasks_total": 0}
    
    total = len(subtasks)
    completed = sum(1 for s in subtasks if s.get("completed", False))
    progress = round((completed / total) * 100) if total > 0 else 0
    
    return {
        "subtasks_progress": progress,
        "subtasks_completed": completed,
        "subtasks_total": total
    }


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
        
        # Создаём подзадачи из переданных названий
        subtasks = []
        for i, subtask_title in enumerate(task_data.subtasks):
            subtasks.append(TaskSubtask(
                title=subtask_title,
                order=i
            ).model_dump())
        
        # Создаём задачу без поля subtasks из task_data (оно содержит только названия)
        task_dict_data = task_data.model_dump()
        task_dict_data.pop('subtasks', None)  # Удаляем строковые названия
        
        task = Task(**task_dict_data, order=next_order, subtasks=subtasks)
        task_dict = task.model_dump()
        
        await db.tasks.insert_one(task_dict)
        
        # ОПТИМИЗАЦИЯ: Трекинг достижений fire-and-forget (не блокируем ответ)
        asyncio.create_task(track_user_action(
            db, 
            task_data.telegram_id, 
            "create_task",
            metadata={}
        ))
        
        # ОПТИМИЗАЦИЯ: НЕ вызываем enrich_task_with_video — убираем медленные yt_dlp запросы
        # Видео обогащение происходит лениво при обновлении задачи
        if 'videos' not in task_dict:
            task_dict['videos'] = []
        
        # Добавляем статистику подзадач
        progress_info = calculate_subtasks_progress(task_dict.get("subtasks", []))
        
        return TaskResponse(**task_dict, **progress_info)
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
        if task_update.skipped is not None:
            update_data["skipped"] = task_update.skipped
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
        
        # FIX: Обновление заметок (ранее пропущено)
        if task_update.notes is not None:
            update_data["notes"] = task_update.notes
        
        # FIX: Обновление origin (ранее пропущено)
        if task_update.origin is not None:
            update_data["origin"] = task_update.origin
        
        # Обновление времени (для событий планировщика)
        if task_update.time_start is not None:
            update_data["time_start"] = task_update.time_start
        if task_update.time_end is not None:
            update_data["time_end"] = task_update.time_end
        if task_update.is_fixed is not None:
            update_data["is_fixed"] = task_update.is_fixed
        
        # Массив видео (новый формат)
        if task_update.videos is not None:
            update_data["videos"] = [v.model_dump() if hasattr(v, 'model_dump') else v for v in task_update.videos]
        
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
            
            # ОПТИМИЗАЦИЯ: Трекинг достижений fire-and-forget (не блокируем ответ)
            asyncio.create_task(track_user_action(
                db,
                existing_task["telegram_id"],
                "complete_task",
                metadata={
                    "hour": current_hour,
                    "on_time": on_time
                }
            ))
        
        # ОПТИМИЗАЦИЯ: НЕ вызываем enrich_task_with_video — убираем медленные yt_dlp запросы
        if 'videos' not in updated_task:
            updated_task['videos'] = []
        
        # Добавляем статистику подзадач
        progress_info = calculate_subtasks_progress(updated_task.get("subtasks", []))
        
        return TaskResponse(**updated_task, **progress_info)
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


# ============ Подзадачи для личных задач ============

@api_router.post("/tasks/{task_id}/subtasks", response_model=TaskResponse)
async def add_task_subtask(task_id: str, subtask: TaskSubtaskCreate):
    """Добавить подзадачу к личной задаче"""
    try:
        # Проверяем существование задачи
        task_doc = await db.tasks.find_one({"id": task_id})
        
        if not task_doc:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        
        # Создаём новую подзадачу
        new_subtask = TaskSubtask(
            title=subtask.title,
            order=len(task_doc.get("subtasks", []))
        )
        
        # Добавляем подзадачу в массив
        await db.tasks.update_one(
            {"id": task_id},
            {
                "$push": {"subtasks": new_subtask.model_dump()},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        # Получаем обновленную задачу
        updated_task = await db.tasks.find_one({"id": task_id})
        
        # Добавляем статистику подзадач
        progress_info = calculate_subtasks_progress(updated_task.get("subtasks", []))
        
        return TaskResponse(**updated_task, **progress_info)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при добавлении подзадачи: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/tasks/{task_id}/subtasks/{subtask_id}", response_model=TaskResponse)
async def update_task_subtask(task_id: str, subtask_id: str, update_data: TaskSubtaskUpdate):
    """Обновить подзадачу личной задачи"""
    try:
        # Проверяем существование задачи
        task_doc = await db.tasks.find_one({"id": task_id})
        
        if not task_doc:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        
        # Ищем подзадачу
        subtasks = task_doc.get("subtasks", [])
        subtask_index = next((i for i, s in enumerate(subtasks) if s.get("subtask_id") == subtask_id), None)
        
        if subtask_index is None:
            raise HTTPException(status_code=404, detail="Подзадача не найдена")
        
        # Обновляем поля подзадачи
        if update_data.title is not None:
            subtasks[subtask_index]["title"] = update_data.title
        if update_data.completed is not None:
            subtasks[subtask_index]["completed"] = update_data.completed
            if update_data.completed:
                subtasks[subtask_index]["completed_at"] = datetime.utcnow()
            else:
                subtasks[subtask_index]["completed_at"] = None
        
        # Сохраняем изменения
        await db.tasks.update_one(
            {"id": task_id},
            {
                "$set": {
                    "subtasks": subtasks,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        # Получаем обновленную задачу
        updated_task = await db.tasks.find_one({"id": task_id})
        
        # Добавляем статистику подзадач
        progress_info = calculate_subtasks_progress(updated_task.get("subtasks", []))
        
        return TaskResponse(**updated_task, **progress_info)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при обновлении подзадачи: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/tasks/{task_id}/subtasks/{subtask_id}", response_model=TaskResponse)
async def delete_task_subtask(task_id: str, subtask_id: str):
    """Удалить подзадачу из личной задачи"""
    try:
        # Проверяем существование задачи
        task_doc = await db.tasks.find_one({"id": task_id})
        
        if not task_doc:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        
        # Удаляем подзадачу из массива
        await db.tasks.update_one(
            {"id": task_id},
            {
                "$pull": {"subtasks": {"subtask_id": subtask_id}},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        # Получаем обновленную задачу
        updated_task = await db.tasks.find_one({"id": task_id})
        
        # Добавляем статистику подзадач
        progress_info = calculate_subtasks_progress(updated_task.get("subtasks", []))
        
        return TaskResponse(**updated_task, **progress_info)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при удалении подзадачи: {e}")
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
        # FIX: Оптимизация O(N) вместо O(7*N) — предварительно группируем задачи по дням
        day_counts = {}
        for task in completed_tasks:
            completed_at = task.get("completed_at")
            if completed_at:
                if isinstance(completed_at, str):
                    completed_at = datetime.fromisoformat(completed_at.replace('Z', '+00:00'))
                task_day = completed_at.date()
                day_counts[task_day] = day_counts.get(task_day, 0) + 1
        
        daily_stats = []
        for i in range(6, -1, -1):
            day = (today_start - timedelta(days=i)).date()
            day_name = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][day.weekday()]
            day_count = day_counts.get(day, 0)
            
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


# ============ Эндпоинты для планировщика (Planner) ============

@api_router.post("/planner/sync", response_model=PlannerSyncResponse)
async def sync_schedule_to_planner(request: PlannerSyncRequest):
    """
    Синхронизировать расписание в планировщик на конкретную дату.
    Создает/обновляет Task записи для каждой пары из расписания.
    """
    try:
        telegram_id = request.telegram_id
        target_date_str = request.date  # YYYY-MM-DD
        week_number = request.week_number
        
        # Проверяем существование пользователя и получаем его группу
        user = await db.user_settings.find_one({"telegram_id": telegram_id})
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        group_id = user.get("group_id")
        if not group_id:
            raise HTTPException(status_code=400, detail="У пользователя не выбрана группа")
        
        # Получаем расписание из кэша или парсим
        cached = await db.schedule_cache.find_one({
            "group_id": group_id,
            "week_number": week_number,
            "expires_at": {"$gt": datetime.utcnow()}
        })
        
        if not cached:
            # Если кэш отсутствует, получаем расписание
            try:
                events = await get_schedule(
                    facultet_id=user.get("facultet_id"),
                    level_id=user.get("level_id"),
                    kurs=user.get("kurs"),
                    form_code=user.get("form_code"),
                    group_id=group_id,
                    week_number=week_number
                )
                # Кэшируем
                cache_data = {
                    "id": str(uuid.uuid4()),
                    "group_id": group_id,
                    "week_number": week_number,
                    "events": [event for event in events],
                    "cached_at": datetime.utcnow(),
                    "expires_at": datetime.utcnow() + timedelta(hours=1)
                }
                await db.schedule_cache.update_one(
                    {"group_id": group_id, "week_number": week_number},
                    {"$set": cache_data},
                    upsert=True
                )
                schedule_events = events
            except Exception as e:
                logger.error(f"Не удалось получить расписание: {e}")
                raise HTTPException(status_code=500, detail="Не удалось получить расписание")
        else:
            schedule_events = cached.get("events", [])
        
        # Парсим дату для фильтрации по дню недели
        try:
            target_date = datetime.strptime(target_date_str, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Неверный формат даты. Используйте YYYY-MM-DD")
        
        # Определяем день недели на русском (для фильтрации)
        day_names_ru = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
        target_day_name = day_names_ru[target_date.weekday()]
        
        # Фильтруем события по дню недели и неделе
        filtered_events = [
            event for event in schedule_events
            if event.get("day") == target_day_name and event.get("week") == week_number
        ]
        
        # Создаем уникальные идентификаторы для каждого события (чтобы избежать дублей)
        synced_tasks = []
        synced_count = 0
        
        for event in filtered_events:
            # Создаем уникальный идентификатор события на основе дня, времени и дисциплины
            event_key = f"{target_date_str}_{event.get('time')}_{event.get('discipline')}"
            
            # Проверяем, существует ли уже такое событие
            existing_task = await db.tasks.find_one({
                "telegram_id": telegram_id,
                "origin": "schedule",
                "target_date": target_date,
                "time_start": event.get("time").split("-")[0].strip() if "-" in event.get("time", "") else event.get("time"),
                "text": event.get("discipline")
            })
            
            if existing_task:
                # Событие уже существует, пропускаем
                continue
            
            # Парсим время (формат: "10:00-11:30")
            time_parts = event.get("time", "").split("-")
            time_start = time_parts[0].strip() if len(time_parts) > 0 else ""
            time_end = time_parts[1].strip() if len(time_parts) > 1 else ""
            
            # Создаем новую задачу-событие
            new_task = {
                "id": str(uuid.uuid4()),
                "telegram_id": telegram_id,
                "text": event.get("discipline", ""),
                "completed": False,
                "completed_at": None,
                "skipped": False,
                "category": "study",
                "priority": "medium",
                "deadline": None,
                "target_date": target_date,
                "subject": event.get("discipline"),
                "discipline_id": None,
                "notes": None,
                "time_start": time_start,
                "time_end": time_end,
                "is_fixed": True,  # Пары - жесткие события
                "origin": "schedule",
                "order": 0,
                "subtasks": [],
                "videos": [],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                # Дополнительные поля для отображения
                "teacher": event.get("teacher", ""),
                "auditory": event.get("auditory", ""),
                "lessonType": event.get("lessonType", "")
            }
            
            await db.tasks.insert_one(new_task)
            synced_count += 1
            
            # FIX: Формируем ответ через TaskResponse(**dict) — проще и надёжнее
            progress_info = calculate_subtasks_progress(new_task.get("subtasks", []))
            task_response = TaskResponse(**new_task, **progress_info)
            synced_tasks.append(task_response)
        
        return PlannerSyncResponse(
            success=True,
            synced_count=synced_count,
            events=synced_tasks,
            message=f"Синхронизировано {synced_count} событий на {target_date_str}"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при синхронизации расписания в планировщик: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/planner/preview")
async def get_schedule_preview_for_sync(request: PlannerSyncRequest):
    """
    Получить предварительный просмотр пар для синхронизации.
    НЕ создает записи, только возвращает список пар на дату.
    """
    from models import ScheduleEventPreview, PlannerPreviewResponse
    
    try:
        telegram_id = request.telegram_id
        target_date_str = request.date
        week_number = request.week_number
        
        # Проверяем существование пользователя и получаем его группу
        user = await db.user_settings.find_one({"telegram_id": telegram_id})
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        group_id = user.get("group_id")
        if not group_id:
            raise HTTPException(status_code=400, detail="У пользователя не выбрана группа")
        
        # Получаем расписание из кэша или парсим
        cached = await db.schedule_cache.find_one({
            "group_id": group_id,
            "week_number": week_number,
            "expires_at": {"$gt": datetime.utcnow()}
        })
        
        if not cached:
            try:
                events = await get_schedule(
                    facultet_id=user.get("facultet_id"),
                    level_id=user.get("level_id"),
                    kurs=user.get("kurs"),
                    form_code=user.get("form_code"),
                    group_id=group_id,
                    week_number=week_number
                )
                # Кэшируем
                cache_data = {
                    "id": str(uuid.uuid4()),
                    "group_id": group_id,
                    "week_number": week_number,
                    "events": [event for event in events],
                    "cached_at": datetime.utcnow(),
                    "expires_at": datetime.utcnow() + timedelta(hours=1)
                }
                await db.schedule_cache.update_one(
                    {"group_id": group_id, "week_number": week_number},
                    {"$set": cache_data},
                    upsert=True
                )
                schedule_events = events
            except Exception as e:
                logger.error(f"Не удалось получить расписание: {e}")
                raise HTTPException(status_code=500, detail="Не удалось получить расписание")
        else:
            schedule_events = cached.get("events", [])
        
        # Парсим дату для фильтрации по дню недели
        try:
            target_date = datetime.strptime(target_date_str, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Неверный формат даты. Используйте YYYY-MM-DD")
        
        # Определяем день недели на русском
        day_names_ru = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
        target_day_name = day_names_ru[target_date.weekday()]
        
        # Фильтруем события по дню недели и неделе
        filtered_events = [
            event for event in schedule_events
            if event.get("day") == target_day_name and event.get("week") == week_number
        ]
        
        # Формируем preview список
        preview_events = []
        already_synced_count = 0
        
        for idx, event in enumerate(filtered_events):
            # Парсим время
            time_parts = event.get("time", "").split("-")
            time_start = time_parts[0].strip() if len(time_parts) > 0 else ""
            time_end = time_parts[1].strip() if len(time_parts) > 1 else ""
            
            # Проверяем, синхронизировано ли уже
            existing_task = await db.tasks.find_one({
                "telegram_id": telegram_id,
                "origin": "schedule",
                "target_date": target_date,
                "time_start": time_start,
                "text": event.get("discipline")
            })
            
            is_synced = existing_task is not None
            if is_synced:
                already_synced_count += 1
            
            preview_event = ScheduleEventPreview(
                id=f"{target_date_str}_{idx}_{time_start}",
                discipline=event.get("discipline", ""),
                time=event.get("time", ""),
                time_start=time_start,
                time_end=time_end,
                teacher=event.get("teacher"),
                auditory=event.get("auditory"),
                lessonType=event.get("lessonType"),
                selected=not is_synced,  # Не выбираем уже синхронизированные
                already_synced=is_synced
            )
            preview_events.append(preview_event)
        
        return PlannerPreviewResponse(
            success=True,
            date=target_date_str,
            day_name=target_day_name,
            events=preview_events,
            total_count=len(preview_events),
            already_synced_count=already_synced_count,
            message=f"Найдено {len(preview_events)} пар на {target_day_name}"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении preview пар: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/planner/sync-selected", response_model=PlannerSyncResponse)
async def sync_selected_schedule_events(request: dict):
    """
    Синхронизировать выбранные (и возможно отредактированные) пары в планировщик.
    """
    from models import PlannerSyncSelectedRequest, ScheduleEventToSync
    
    try:
        telegram_id = request.get("telegram_id")
        target_date_str = request.get("date")
        events_data = request.get("events", [])
        
        if not telegram_id or not target_date_str:
            raise HTTPException(status_code=400, detail="Не указан telegram_id или date")
        
        # Проверяем существование пользователя
        user = await db.user_settings.find_one({"telegram_id": telegram_id})
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Парсим дату
        try:
            target_date = datetime.strptime(target_date_str, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Неверный формат даты. Используйте YYYY-MM-DD")
        
        synced_tasks = []
        synced_count = 0
        
        for event_data in events_data:
            discipline = event_data.get("discipline", "")
            time_start = event_data.get("time_start", "")
            time_end = event_data.get("time_end", "")
            teacher = event_data.get("teacher", "")
            auditory = event_data.get("auditory", "")
            lessonType = event_data.get("lessonType", "")
            
            # Проверяем, существует ли уже такое событие
            existing_task = await db.tasks.find_one({
                "telegram_id": telegram_id,
                "origin": "schedule",
                "target_date": target_date,
                "time_start": time_start,
                "text": discipline
            })
            
            if existing_task:
                # Событие уже существует, пропускаем
                continue
            
            # Создаем новую задачу-событие
            new_task = {
                "id": str(uuid.uuid4()),
                "telegram_id": telegram_id,
                "text": discipline,
                "completed": False,
                "completed_at": None,
                "skipped": False,
                "category": "study",
                "priority": "medium",
                "deadline": None,
                "target_date": target_date,
                "subject": discipline,
                "discipline_id": None,
                "notes": None,
                "time_start": time_start,
                "time_end": time_end,
                "is_fixed": True,
                "origin": "schedule",
                "order": 0,
                "subtasks": [],
                "videos": [],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "teacher": teacher,
                "auditory": auditory,
                "lessonType": lessonType
            }
            
            await db.tasks.insert_one(new_task)
            synced_count += 1
            
            # FIX: Формируем ответ через TaskResponse(**dict)
            progress_info = calculate_subtasks_progress(new_task.get("subtasks", []))
            task_response = TaskResponse(**new_task, **progress_info)
            synced_tasks.append(task_response)
        
        return PlannerSyncResponse(
            success=True,
            synced_count=synced_count,
            events=synced_tasks,
            message=f"Синхронизировано {synced_count} событий на {target_date_str}"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при синхронизации выбранных пар: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/planner/events", response_model=TaskResponse)
async def create_planner_event(task_data: TaskCreate):
    """
    Создать новое событие в планировщике (не задачу в списке дел).
    События всегда имеют time_start и time_end.
    """
    try:
        # Валидация: события должны иметь время
        if not task_data.time_start or not task_data.time_end:
            raise HTTPException(
                status_code=400, 
                detail="События должны иметь время начала и окончания"
            )
        
        # Валидация: события должны иметь target_date
        if not task_data.target_date:
            raise HTTPException(
                status_code=400, 
                detail="События должны иметь дату (target_date)"
            )
        
        # FIX: Конвертируем subtasks из List[str] в List[TaskSubtask]
        subtasks = []
        for i, subtask_title in enumerate(task_data.subtasks):
            subtasks.append(TaskSubtask(
                title=subtask_title,
                order=i
            ).model_dump())
        
        # FIX: Используем model_dump() вместо deprecated .dict()
        task_dict_data = task_data.model_dump()
        task_dict_data.pop('subtasks', None)  # Удаляем строковые названия
        
        task = Task(
            **task_dict_data,
            order=0,  # События не участвуют в drag&drop
            subtasks=subtasks
        )
        task_dict = task.model_dump()
        
        # FIX: Гарантируем наличие videos
        if 'videos' not in task_dict:
            task_dict['videos'] = []
        
        await db.tasks.insert_one(task_dict)
        
        logger.info(f"Создано событие для пользователя {task_data.telegram_id}: {task_data.text}")
        
        # FIX: Добавляем прогресс подзадач
        progress_info = calculate_subtasks_progress(task_dict.get("subtasks", []))
        
        return TaskResponse(**task_dict, **progress_info)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при создании события: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/planner/{telegram_id}/{date}", response_model=PlannerDayResponse)
async def get_planner_day_events(telegram_id: int, date: str):
    """
    Получить все события (пары + пользовательские задачи) на конкретную дату.
    Возвращает ТОЛЬКО события с установленным временем (time_start и time_end).
    Задачи без времени не показываются в планировщике.
    """
    try:
        # Парсим дату
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Неверный формат даты. Используйте YYYY-MM-DD")
        
        # FIX: Упрощённый MongoDB-запрос (убраны избыточные $ne + $nin)
        # Получаем только события с установленным временем на эту дату
        tasks_cursor = db.tasks.find({
            "telegram_id": telegram_id,
            "target_date": {
                "$gte": target_date - timedelta(hours=12),
                "$lt": target_date + timedelta(days=1, hours=12)
            },
            # Только события с установленным временем (не null и не пустая строка)
            "time_start": {"$exists": True, "$nin": [None, ""]},
            "time_end": {"$exists": True, "$nin": [None, ""]}
        })
        
        tasks = await tasks_cursor.to_list(length=None)
        
        # FIX: Формируем ответ с прогрессом подзадач и videos
        events = []
        for task in tasks:
            # Гарантируем наличие videos
            if 'videos' not in task:
                task['videos'] = []
            # Вычисляем прогресс подзадач
            progress_info = calculate_subtasks_progress(task.get("subtasks", []))
            task_response = TaskResponse(**task, **progress_info)
            events.append(task_response)
        
        # Сортируем события по времени начала
        events.sort(key=lambda x: x.time_start or "23:59")
        
        return PlannerDayResponse(
            date=date,
            events=events,
            total_count=len(events)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении событий планировщика: {e}")
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
            room_id=task_data.room_id,
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
            
            # Подсчитываем количество комментариев
            comments_count = await db.group_task_comments.count_documents({"task_id": task.task_id})
            
            tasks.append(GroupTaskResponse(
                **task.model_dump(),
                completion_percentage=completion_percentage,
                total_participants=total_participants,
                completed_participants=completed_participants,
                comments_count=comments_count
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


@api_router.post("/notifications/test-inapp", response_model=SuccessResponse)
async def create_test_inapp_notification(telegram_id: int = Body(..., embed=True)):
    """Создать тестовое in-app уведомление для проверки анимации"""
    try:
        notification_id = await create_notification(
            telegram_id=telegram_id,
            notification_type=NotificationType.ANNOUNCEMENT,
            category=NotificationCategory.SYSTEM,
            title="🔔 Тестовое уведомление",
            message="Это тестовое уведомление для проверки анимации колокольчика!",
            emoji="🔔",
            priority=NotificationPriority.HIGH,
            send_push=False  # Не отправляем в Telegram
        )
        
        if notification_id:
            return SuccessResponse(success=True, message=f"Тестовое уведомление создано: {notification_id}")
        else:
            raise HTTPException(status_code=500, detail="Не удалось создать уведомление")
            
    except Exception as e:
        logger.error(f"Ошибка при создании тестового уведомления: {e}")
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
        else:
            # Все сняли галочку - возвращаем в "created"
            # Но проверяем дедлайн — если просрочен, ставим overdue
            if updated_task.deadline and updated_task.deadline < datetime.utcnow():
                new_status = "overdue"
            else:
                new_status = "created"
            await db.group_tasks.update_one(
                {"task_id": task_id},
                {"$set": {"status": new_status}}
            )
            updated_task.status = new_status
        
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


@api_router.post("/rooms/{room_id}/add-friends", response_model=RoomResponse)
async def add_friends_to_room(room_id: str, data: RoomAddFriendsRequest):
    """Быстро добавить друзей в комнату"""
    try:
        # Проверяем существование комнаты
        room_doc = await db.rooms.find_one({"room_id": room_id})
        if not room_doc:
            raise HTTPException(status_code=404, detail="Комната не найдена")
        
        # Проверяем, что пользователь является участником комнаты
        is_participant = any(
            p["telegram_id"] == data.telegram_id 
            for p in room_doc.get("participants", [])
        )
        if not is_participant:
            raise HTTPException(status_code=403, detail="Вы не являетесь участником комнаты")
        
        added_friends = []
        existing_participant_ids = {p["telegram_id"] for p in room_doc.get("participants", [])}
        
        for friend in data.friends:
            # Проверяем что друг еще не в комнате
            if friend.telegram_id in existing_participant_ids:
                continue
            
            # Проверяем что это действительно друг
            is_friend = await db.friends.find_one({
                "$or": [
                    {"user1_id": data.telegram_id, "user2_id": friend.telegram_id},
                    {"user1_id": friend.telegram_id, "user2_id": data.telegram_id}
                ]
            })
            
            if not is_friend:
                continue  # Пропускаем если не друзья
            
            # Добавляем друга в комнату
            new_participant = {
                "telegram_id": friend.telegram_id,
                "username": friend.username,
                "first_name": friend.first_name,
                "role": "member",
                "joined_at": datetime.utcnow()
            }
            
            added_friends.append(new_participant)
            existing_participant_ids.add(friend.telegram_id)
        
        if not added_friends:
            raise HTTPException(status_code=400, detail="Все выбранные друзья уже в комнате или не являются вашими друзьями")
        
        # Обновляем комнату
        await db.rooms.update_one(
            {"room_id": room_id},
            {"$push": {"participants": {"$each": added_friends}}}
        )
        
        # Записываем активность
        # Получаем имя добавляющего
        adder_info = next((p for p in room_doc.get("participants", []) if p["telegram_id"] == data.telegram_id), None)
        for friend in added_friends:
            activity = RoomActivity(
                room_id=room_id,
                user_id=data.telegram_id,
                username=adder_info.get("username") if adder_info else None,
                first_name=adder_info.get("first_name", "User") if adder_info else "User",
                action_type="member_added",
                action_details={
                    "target_user_id": friend["telegram_id"],
                    "target_user_name": friend["first_name"],
                    "description": f"Добавлен участник {friend['first_name']}"
                }
            )
            await db.room_activities.insert_one(activity.model_dump())
        
        # Добавляем друзей ко всем существующим задачам комнаты
        room_tasks = await db.group_tasks.find({"room_id": room_id}).to_list(200)
        for task in room_tasks:
            for friend in added_friends:
                # Проверяем что друг еще не участник задачи
                existing_task_participants = {p["telegram_id"] for p in task.get("participants", [])}
                if friend["telegram_id"] in existing_task_participants:
                    continue
                
                new_task_participant = GroupTaskParticipant(
                    telegram_id=friend["telegram_id"],
                    username=friend.get("username"),
                    first_name=friend["first_name"],
                    role='member'
                )
                
                await db.group_tasks.update_one(
                    {"task_id": task["task_id"]},
                    {"$push": {"participants": new_task_participant.model_dump()}}
                )
        
        # Отправляем уведомления
        for friend in added_friends:
            await send_room_join_notifications_api(
                room_doc=room_doc,
                new_user_name=friend["first_name"],
                new_user_id=friend["telegram_id"]
            )
        
        # Получаем обновленную комнату
        updated_room = await db.rooms.find_one({"room_id": room_id})
        
        # Статистика задач
        total_tasks = await db.group_tasks.count_documents({"room_id": room_id})
        completed_tasks = 0
        room_tasks = await db.group_tasks.find({"room_id": room_id}).to_list(200)
        for task in room_tasks:
            if task.get("status") == "completed":
                completed_tasks += 1
        completion_percentage = round((completed_tasks / total_tasks * 100) if total_tasks > 0 else 0)
        
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
        logger.error(f"Ошибка при добавлении друзей в комнату: {e}")
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
        
        # Сначала собираем ID задач ДЛЯ удаления комментариев
        tasks_to_delete = await db.group_tasks.find({"room_id": room_id}).to_list(length=None)
        task_ids = [task["task_id"] for task in tasks_to_delete]
        
        # Удаляем комментарии к задачам комнаты
        if task_ids:
            await db.group_task_comments.delete_many({"task_id": {"$in": task_ids}})
            await db.group_task_invites.delete_many({"task_id": {"$in": task_ids}})
        
        # Теперь удаляем сами задачи
        await db.group_tasks.delete_many({"room_id": room_id})
        
        # Удаляем активности комнаты
        await db.room_activities.delete_many({"room_id": room_id})
        
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
        
        # Получаем все задачи комнаты (сортировка по order, затем по дате создания)
        tasks_cursor = db.group_tasks.find({"room_id": room_id}).sort([("order", 1), ("created_at", -1)])
        
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
            
            # Подсчитываем количество комментариев
            comments_count = await db.group_task_comments.count_documents({"task_id": task_doc.get("task_id")})
            
            tasks.append(GroupTaskResponse(
                **task_doc,
                completion_percentage=completion_percentage,
                total_participants=total_participants,
                completed_participants=completed_participants,
                comments_count=comments_count
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
        
        # Проверяем права (если telegram_id передан)
        telegram_id = update_data.telegram_id
        if telegram_id:
            is_participant = any(p.get("telegram_id") == telegram_id for p in task_doc.get("participants", []))
            is_owner = task_doc.get("owner_id") == telegram_id
            
            # Проверяем также по комнате (владелец/админ комнаты может редактировать)
            is_room_admin = False
            room_id = task_doc.get("room_id")
            if room_id:
                room_doc_check = await db.rooms.find_one({"room_id": room_id})
                if room_doc_check:
                    room_participant = next((p for p in room_doc_check.get("participants", []) if p.get("telegram_id") == telegram_id), None)
                    if room_participant and room_participant.get("role") in ["owner", "admin"]:
                        is_room_admin = True
            
            if not is_participant and not is_owner and not is_room_admin:
                raise HTTPException(status_code=403, detail="Недостаточно прав для редактирования задачи")
        
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
async def add_subtask(task_id: str, subtask: SubtaskCreate, telegram_id: int = Body(..., embed=True)):
    """Добавить подзадачу"""
    try:
        task_doc = await db.group_tasks.find_one({"task_id": task_id})
        
        if not task_doc:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        
        # Проверяем, что пользователь является участником задачи
        is_participant = any(p.get("telegram_id") == telegram_id for p in task_doc.get("participants", []))
        if not is_participant:
            raise HTTPException(status_code=403, detail="Только участники могут добавлять подзадачи")
        
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
                subtasks[subtask_index]["completed_by"] = getattr(update_data, 'completed_by', None)
            else:
                subtasks[subtask_index]["completed_at"] = None
                subtasks[subtask_index]["completed_by"] = None
        
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


@api_router.put("/rooms/{room_id}/tasks-reorder", response_model=SuccessResponse)
async def reorder_room_tasks(room_id: str, reorder_request: RoomTaskReorderRequest):
    """Изменить порядок задач в комнате (drag & drop)"""
    try:
        room_doc = await db.rooms.find_one({"room_id": room_id})
        
        if not room_doc:
            raise HTTPException(status_code=404, detail="Комната не найдена")
        
        # Обновляем порядок для каждой задачи
        for task_order in reorder_request.tasks:
            task_id = task_order.get("task_id") if isinstance(task_order, dict) else getattr(task_order, "task_id", None)
            order = task_order.get("order") if isinstance(task_order, dict) else getattr(task_order, "order", None)
            if task_id is not None and order is not None:
                await db.group_tasks.update_one(
                    {"task_id": task_id},
                    {"$set": {"order": order}}
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
async def get_faculty_stats(days: Optional[int] = None):
    """
    Получить статистику по факультетам (с опциональным фильтром по периоду регистрации)
    """
    try:
        # Базовый фильтр
        match_filter = {
            "facultet_name": {"$ne": None, "$exists": True}
        }
        
        # Фильтр по периоду
        if days:
            start_date = datetime.utcnow() - timedelta(days=days)
            match_filter["created_at"] = {"$gte": start_date}
        
        # Агрегация по факультетам
        pipeline = [
            {"$match": match_filter},
            {
                "$group": {
                    "_id": "$facultet_name",
                    "faculty_id_first": {"$first": "$facultet_id"},
                    "users_count": {"$sum": 1}
                }
            },
            {"$sort": {"users_count": -1}}
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
async def get_course_stats(days: Optional[int] = None):
    """
    Получить статистику по курсам (с опциональным фильтром по периоду)
    """
    try:
        match_filter = {
            "kurs": {"$ne": None, "$exists": True}
        }
        if days:
            start_date = datetime.utcnow() - timedelta(days=days)
            match_filter["created_at"] = {"$gte": start_date}
        
        pipeline = [
            {"$match": match_filter},
            {
                "$group": {
                    "_id": "$kurs",
                    "users_count": {"$sum": 1}
                }
            },
            {"$sort": {"_id": 1}}
        ]
        
        results = await db.user_settings.aggregate(pipeline).to_list(length=None)
        
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


@api_router.post("/admin/send-notification")
async def admin_send_notification(data: AdminSendNotificationRequest):
    """Отправить уведомление пользователю от имени администратора"""
    try:
        results = {
            "telegram_id": data.telegram_id,
            "in_app_sent": False,
            "telegram_sent": False,
            "errors": []
        }
        
        # Проверяем существование пользователя
        user = await db.user_settings.find_one({"telegram_id": data.telegram_id})
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Маппинг типов на NotificationType enum
        type_mapping = {
            "admin_message": NotificationType.ADMIN_MESSAGE,
            "announcement": NotificationType.ANNOUNCEMENT,
            "app_update": NotificationType.APP_UPDATE,
            "schedule_changed": NotificationType.SCHEDULE_CHANGED,
            "task_deadline": NotificationType.TASK_DEADLINE,
            "achievement_earned": NotificationType.ACHIEVEMENT_EARNED,
            "level_up": NotificationType.LEVEL_UP,
            "room_invite": NotificationType.ROOM_INVITE,
        }
        
        # Маппинг категорий
        category_mapping = {
            "system": NotificationCategory.SYSTEM,
            "study": NotificationCategory.STUDY,
            "achievements": NotificationCategory.ACHIEVEMENTS,
            "rooms": NotificationCategory.ROOMS,
            "social": NotificationCategory.SOCIAL,
            "journal": NotificationCategory.JOURNAL,
        }
        
        notification_type = type_mapping.get(data.notification_type, NotificationType.ADMIN_MESSAGE)
        notification_category = category_mapping.get(data.category, NotificationCategory.SYSTEM)
        
        # Отправляем In-App уведомление
        if data.send_in_app:
            try:
                notification = InAppNotification(
                    telegram_id=data.telegram_id,
                    type=notification_type,
                    category=notification_category,
                    priority=NotificationPriority.HIGH,
                    title=data.title,
                    message=data.message,
                    emoji="",  # Не используем emoji, иконка определяется по типу
                    data={"from_admin": True}
                )
                await db.in_app_notifications.insert_one(notification.model_dump())
                results["in_app_sent"] = True
                logger.info(f"📬 Admin notification sent in-app to {data.telegram_id}")
            except Exception as e:
                logger.error(f"Failed to send in-app notification: {e}")
                results["errors"].append(f"In-App: {str(e)}")
        
        # Отправляем Telegram сообщение
        if data.send_telegram:
            try:
                from notifications import get_notification_service
                notification_service = get_notification_service()
                
                # Форматируем красивое сообщение для Telegram
                type_emojis = {
                    "admin_message": "📢",
                    "announcement": "📣",
                    "app_update": "✨",
                    "schedule_changed": "📅",
                    "task_deadline": "⏰",
                    "achievement_earned": "🏆",
                    "level_up": "⭐",
                    "room_invite": "🏠",
                }
                msg_emoji = type_emojis.get(data.notification_type, "🔔")
                
                tg_lines = []
                tg_lines.append(f"{msg_emoji}  <b>{data.title}</b>")
                tg_lines.append("")
                if data.message.strip():
                    tg_lines.append(data.message.strip())
                    tg_lines.append("")
                tg_lines.append("<i>RUDN Go • Уведомление</i>")
                
                tg_text = "\n".join(tg_lines)
                
                await notification_service.send_message(data.telegram_id, tg_text)
                results["telegram_sent"] = True
                logger.info(f"📨 Admin message sent via Telegram to {data.telegram_id}")
            except Exception as e:
                logger.error(f"Failed to send Telegram message: {e}")
                results["errors"].append(f"Telegram: {str(e)}")
        
        if not results["in_app_sent"] and not results["telegram_sent"]:
            raise HTTPException(
                status_code=500, 
                detail=f"Не удалось отправить уведомление: {', '.join(results['errors'])}"
            )
        
        return {
            "status": "success",
            "message": "Уведомление отправлено",
            **results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending admin notification: {e}")
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

    # 1. Total Users — ВСЕГДА считаем ВСЕХ пользователей (не зависит от фильтра)
    total_users = await db.user_settings.count_documents({})
    
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

    # 10. Web-version statistics
    # Всего linked веб-сессий
    web_sessions_total = await db.web_sessions.count_documents({"status": "linked"})
    
    # Активные веб-сессии (linked + last_active < 10 мин назад)
    web_threshold = now - timedelta(minutes=10)
    web_sessions_active = await db.web_sessions.count_documents({
        "status": "linked",
        "last_active": {"$gte": web_threshold}
    })
    
    # Уникальные пользователи веб-версии (все время)
    web_unique_pipeline = [
        {"$match": {"status": "linked", "telegram_id": {"$ne": None}}},
        {"$group": {"_id": "$telegram_id"}},
        {"$count": "total"}
    ]
    web_unique_result = await db.web_sessions.aggregate(web_unique_pipeline).to_list(1)
    web_unique_users = web_unique_result[0]["total"] if web_unique_result else 0
    
    # Веб-пользователи сегодня (уникальные, с активностью сегодня)
    web_today_pipeline = [
        {"$match": {"status": "linked", "telegram_id": {"$ne": None}, "last_active": {"$gte": today_start}}},
        {"$group": {"_id": "$telegram_id"}},
        {"$count": "total"}
    ]
    web_today_result = await db.web_sessions.aggregate(web_today_pipeline).to_list(1)
    web_users_today = web_today_result[0]["total"] if web_today_result else 0

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
        total_journals=total_journals,
        # Web-version statistics
        web_sessions_total=web_sessions_total,
        web_sessions_active=web_sessions_active,
        web_unique_users=web_unique_users,
        web_users_today=web_users_today
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


# ============ API для отслеживания онлайн пользователей в реальном времени ============

@api_router.get("/admin/online-users")
async def get_online_users(minutes: int = 5):
    """
    Получить список пользователей онлайн в реальном времени.
    Пользователь считается онлайн если его last_activity было в течение указанных минут.
    """
    try:
        threshold = datetime.utcnow() - timedelta(minutes=minutes)
        
        # Получаем пользователей с недавней активностью
        pipeline = [
            {
                "$match": {
                    "last_activity": {"$gte": threshold}
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "telegram_id": 1,
                    "first_name": 1,
                    "last_name": 1,
                    "username": 1,
                    "photo_url": 1,
                    "faculty": 1,
                    "course": 1,
                    "last_activity": 1,
                    "current_section": 1
                }
            },
            {
                "$sort": {"last_activity": -1}
            },
            {
                "$limit": 100
            }
        ]
        
        online_users = await db.user_settings.aggregate(pipeline).to_list(100)
        
        # Форматируем данные
        result = []
        
        # Получаем все активные web-сессии для определения платформы
        web_threshold_online = datetime.utcnow() - timedelta(minutes=minutes)
        active_web_sessions = await db.web_sessions.find({
            "status": "linked",
            "last_active": {"$gte": web_threshold_online}
        }).to_list(1000)
        web_user_ids = set()
        web_session_info = {}
        for ws in active_web_sessions:
            tid = ws.get("telegram_id")
            if tid:
                web_user_ids.add(tid)
                web_session_info[tid] = {
                    "browser": ws.get("browser", ""),
                    "os": ws.get("os", ""),
                    "device_name": ws.get("device_name", "")
                }
        
        for user in online_users:
            last_activity = user.get("last_activity")
            if last_activity:
                seconds_ago = (datetime.utcnow() - last_activity).total_seconds()
                if seconds_ago < 60:
                    activity_text = "только что"
                elif seconds_ago < 120:
                    activity_text = "1 мин назад"
                else:
                    activity_text = f"{int(seconds_ago // 60)} мин назад"
            else:
                activity_text = "неизвестно"
            
            tid = user.get("telegram_id")
            is_web = tid in web_user_ids
            ws_info = web_session_info.get(tid, {})
            
            result.append({
                "telegram_id": tid,
                "first_name": user.get("first_name", ""),
                "last_name": user.get("last_name", ""),
                "username": user.get("username", ""),
                "photo_url": user.get("photo_url"),
                "faculty": user.get("faculty", ""),
                "course": user.get("course"),
                "last_activity": last_activity.isoformat() if last_activity else None,
                "activity_text": activity_text,
                "current_section": user.get("current_section", ""),
                "platform": "web" if is_web else "telegram",
                "browser": ws_info.get("browser", "") if is_web else "",
                "os": ws_info.get("os", "") if is_web else "",
                "device_name": ws_info.get("device_name", "") if is_web else ""
            })
        
        # Также получаем общую статистику
        total_online = await db.user_settings.count_documents({
            "last_activity": {"$gte": threshold}
        })
        
        # Онлайн за последний час
        hour_threshold = datetime.utcnow() - timedelta(hours=1)
        online_last_hour = await db.user_settings.count_documents({
            "last_activity": {"$gte": hour_threshold}
        })
        
        # Онлайн за последние 24 часа
        day_threshold = datetime.utcnow() - timedelta(hours=24)
        online_last_day = await db.user_settings.count_documents({
            "last_activity": {"$gte": day_threshold}
        })
        
        # Подсчёт по платформам
        web_online = len([u for u in result if u.get("platform") == "web"])
        tg_online = len([u for u in result if u.get("platform") == "telegram"])
        
        return {
            "online_now": total_online,
            "online_last_hour": online_last_hour,
            "online_last_day": online_last_day,
            "web_online": web_online,
            "telegram_online": tg_online,
            "users": result,
            "threshold_minutes": minutes,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting online users: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/admin/track-activity")
async def track_user_activity(telegram_id: int, section: str = None):
    """
    Обновить активность пользователя (вызывается с фронтенда периодически).
    """
    try:
        update_data = {"last_activity": datetime.utcnow()}
        if section:
            update_data["current_section"] = section
            
        await db.user_settings.update_one(
            {"telegram_id": telegram_id},
            {"$set": update_data}
        )
        return {"success": True}
    except Exception as e:
        logger.error(f"Error tracking activity: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ API для ЛК РУДН (lk.rudn.ru) ============

@api_router.post("/lk/connect", response_model=LKConnectionResponse)
async def connect_lk(data: LKCredentialsRequest):
    """
    Подключение личного кабинета РУДН к аккаунту пользователя
    
    - Авторизуется через OAuth RUDN ID
    - Парсит персональные данные из профиля
    - Сохраняет зашифрованный пароль в БД для последующей синхронизации
    """
    logger.info(f"LK connect request for telegram_id={data.telegram_id}")
    
    parser = RUDNLKParser()
    
    try:
        async with parser:
            # Проверяем авторизацию
            success = await parser.login(data.email, data.password)
            
            if not success:
                logger.warning(f"LK login failed for {data.email}")
                raise HTTPException(
                    status_code=401, 
                    detail="Неверный логин или пароль ЛК РУДН"
                )
            
            # Получаем персональные данные
            personal_data = await parser.get_personal_data()
            
            # Шифруем пароль для хранения
            encrypted_password = parser.encrypt_password(data.password)
            
            # Сохраняем в БД
            await db.user_settings.update_one(
                {"telegram_id": data.telegram_id},
                {
                    "$set": {
                        "lk_email": data.email,
                        "lk_password_encrypted": encrypted_password,
                        "lk_connected": True,
                        "lk_last_sync": datetime.utcnow().isoformat(),
                        "lk_personal_data": personal_data
                    }
                },
                upsert=True
            )
            
            logger.info(f"LK connected successfully for telegram_id={data.telegram_id}")
            
            return LKConnectionResponse(
                success=True,
                message="ЛК РУДН успешно подключен",
                personal_data=LKPersonalData(**personal_data) if personal_data else None
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"LK connect error: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка подключения ЛК: {str(e)}")


@api_router.get("/lk/data/{telegram_id}", response_model=LKDataResponse)
async def get_lk_data(telegram_id: int, refresh: bool = False):
    """
    Получение данных из ЛК РУДН
    
    - refresh=False: возвращает кэшированные данные из БД
    - refresh=True: заново авторизуется и парсит актуальные данные
    """
    user = await db.user_settings.find_one({"telegram_id": telegram_id})
    
    if not user or not user.get("lk_connected"):
        return LKDataResponse(
            personal_data=None,
            last_sync=None,
            cached=False,
            lk_connected=False
        )
    
    if not refresh and user.get("lk_personal_data"):
        return LKDataResponse(
            personal_data=LKPersonalData(**user["lk_personal_data"]),
            last_sync=user.get("lk_last_sync"),
            cached=True,
            lk_connected=True
        )
    
    # Обновляем данные с сайта
    parser = RUDNLKParser()
    
    try:
        async with parser:
            password = parser.decrypt_password(user["lk_password_encrypted"])
            success = await parser.login(user["lk_email"], password)
            
            if not success:
                # Пароль изменился или сессия истекла
                await db.user_settings.update_one(
                    {"telegram_id": telegram_id},
                    {"$set": {"lk_connected": False}}
                )
                raise HTTPException(
                    status_code=401, 
                    detail="Сессия ЛК истекла. Переподключите аккаунт."
                )
            
            personal_data = await parser.get_personal_data()
            
            # Обновляем кэш
            now = datetime.utcnow().isoformat()
            await db.user_settings.update_one(
                {"telegram_id": telegram_id},
                {
                    "$set": {
                        "lk_last_sync": now,
                        "lk_personal_data": personal_data
                    }
                }
            )
            
            return LKDataResponse(
                personal_data=LKPersonalData(**personal_data) if personal_data else None,
                last_sync=now,
                cached=False,
                lk_connected=True
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"LK refresh error: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка обновления данных ЛК: {str(e)}")


@api_router.get("/lk/status/{telegram_id}", response_model=LKStatusResponse)
async def get_lk_status(telegram_id: int):
    """
    Проверка статуса подключения ЛК РУДН
    """
    user = await db.user_settings.find_one({"telegram_id": telegram_id})
    
    if not user:
        return LKStatusResponse(lk_connected=False)
    
    return LKStatusResponse(
        lk_connected=user.get("lk_connected", False),
        lk_email=user.get("lk_email"),
        lk_last_sync=user.get("lk_last_sync")
    )


@api_router.delete("/lk/disconnect/{telegram_id}")
async def disconnect_lk(telegram_id: int):
    """
    Отключение ЛК РУДН от аккаунта
    
    Удаляет сохранённые учётные данные и персональные данные
    """
    result = await db.user_settings.update_one(
        {"telegram_id": telegram_id},
        {
            "$unset": {
                "lk_email": "",
                "lk_password_encrypted": "",
                "lk_personal_data": ""
            },
            "$set": {
                "lk_connected": False
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    logger.info(f"LK disconnected for telegram_id={telegram_id}")
    
    return {"success": True, "message": "ЛК РУДН отключен"}


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
        
        # Проверяем, был ли студент отмечен хотя бы раз
        total_records = await db.attendance_records.count_documents({
            "student_id": student_id,
            "journal_id": journal_id
        })
        
        # Если студент ни разу не был отмечен - не показываем процент
        if total_records == 0:
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


@api_router.post("/journals/{journal_id}/leave")
async def leave_journal(journal_id: str, telegram_id: int):
    """Выйти из журнала (для студентов, не владельцев)"""
    try:
        journal = await db.attendance_journals.find_one({"journal_id": journal_id})
        if not journal:
            raise HTTPException(status_code=404, detail="Journal not found")
        
        # Владелец не может выйти из своего журнала
        if journal["owner_id"] == telegram_id:
            raise HTTPException(status_code=403, detail="Owner cannot leave their journal. Delete it instead.")
        
        # Найти студента, привязанного к этому telegram_id
        student = await db.journal_students.find_one({
            "journal_id": journal_id,
            "telegram_id": telegram_id
        })
        
        if student:
            # Отвязать студента (но не удалять запись - только сбросить привязку)
            await db.journal_students.update_one(
                {"id": student["id"]},
                {"$set": {"telegram_id": None, "is_linked": False, "username": None, "first_name": None}}
            )
        
        # Удалить из ожидающих привязки
        await db.journal_pending_members.delete_many({
            "journal_id": journal_id,
            "telegram_id": telegram_id
        })
        
        # Удалить из stats_viewers если был там
        if telegram_id in journal.get("stats_viewers", []):
            new_viewers = [v for v in journal.get("stats_viewers", []) if v != telegram_id]
            await db.attendance_journals.update_one(
                {"journal_id": journal_id},
                {"$set": {"stats_viewers": new_viewers}}
            )
        
        logger.info(f"User {telegram_id} left journal: {journal_id}")
        return {"status": "success", "message": "Successfully left the journal"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error leaving journal: {e}")
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
        
        # Владелец (староста) тоже может привязать себя к студенту
        # Это нужно для случаев когда староста также является студентом группы
        is_owner = journal["owner_id"] == data.telegram_id
        
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
            
            # Проверить, не подана ли уже заявка
            existing_application = await db.journal_applications.find_one({
                "journal_id": journal_id,
                "telegram_id": data.telegram_id,
                "status": "pending"
            })
            if existing_application:
                return {
                    "success": True,
                    "status": "pending",
                    "message": f"Ваша заявка на вступление в журнал «{journal_name}» ожидает рассмотрения старостой",
                    "journal_id": journal_id,
                    "journal_name": journal_name
                }
            
            # Создаём заявку на вступление
            application = JournalJoinApplication(
                journal_id=journal_id,
                telegram_id=data.telegram_id,
                username=data.username,
                first_name=data.first_name,
                last_name=data.last_name
            )
            await db.journal_applications.insert_one(application.model_dump())
            
            # Отправляем уведомление старосте
            owner_id = journal["owner_id"]
            applicant_name = data.first_name or data.username or f"User {data.telegram_id}"
            if data.last_name:
                applicant_name = f"{data.first_name} {data.last_name}"
            
            await create_notification(
                telegram_id=owner_id,
                notification_type=NotificationType.JOURNAL_INVITE,
                category=NotificationCategory.JOURNAL,
                priority=NotificationPriority.HIGH,
                title="Новая заявка в журнал",
                message=f"{applicant_name} хочет присоединиться к журналу «{journal_name}»",
                emoji="",
                data={
                    "application_id": application.id,
                    "journal_id": journal_id,
                    "applicant_telegram_id": data.telegram_id,
                    "applicant_name": applicant_name,
                    "applicant_username": data.username
                },
                actions=[
                    {"id": "view_application", "label": "Просмотреть", "type": "primary"}
                ]
            )
            
            logger.info(f"📝 User {data.telegram_id} applied to journal '{journal_name}'")
            return {
                "success": True,
                "status": "application_sent",
                "message": f"Заявка на вступление в журнал «{journal_name}» отправлена! Ожидайте подтверждения от старосты.",
                "journal_id": journal_id,
                "journal_name": journal_name
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
            
            # Владелец (староста) тоже может привязать себя к студенту
            # Это нужно для случаев когда староста также является студентом группы
            is_owner = journal["owner_id"] == data.telegram_id
            
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


@api_router.post("/journals/{journal_id}/students/from-friends")
async def add_students_from_friends(journal_id: str, data: JournalStudentsFromFriendsCreate):
    """Добавить друзей как студентов журнала с автоматической привязкой"""
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
        skipped = []
        
        for i, friend in enumerate(data.friends):
            # Проверяем, не добавлен ли уже этот telegram_id
            existing = await db.journal_students.find_one({
                "journal_id": journal_id,
                "telegram_id": friend.telegram_id
            })
            
            if existing:
                skipped.append(friend.full_name)
                continue
            
            # Создаем студента с автоматической привязкой
            student = JournalStudent(
                journal_id=journal_id,
                full_name=friend.full_name,
                telegram_id=friend.telegram_id,
                username=friend.username,
                first_name=friend.first_name,
                is_linked=True,
                linked_at=datetime.utcnow(),
                order=next_order + i
            )
            await db.journal_students.insert_one(student.model_dump())
            added.append({
                "full_name": friend.full_name,
                "telegram_id": friend.telegram_id
            })
            
            # Удаляем из pending если был
            await db.journal_pending_members.delete_many({
                "journal_id": journal_id,
                "telegram_id": friend.telegram_id
            })
        
        return {
            "status": "success", 
            "added_count": len(added), 
            "skipped_count": len(skipped),
            "added": added,
            "skipped": skipped
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding students from friends: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== Заявки на вступление в журнал =====

@api_router.get("/journals/{journal_id}/applications")
async def get_journal_applications(journal_id: str, telegram_id: int):
    """Получить список заявок на вступление в журнал (только для владельца)"""
    try:
        journal = await db.attendance_journals.find_one({"journal_id": journal_id})
        if not journal:
            raise HTTPException(status_code=404, detail="Journal not found")
        
        # Проверяем что это владелец
        if journal["owner_id"] != telegram_id:
            raise HTTPException(status_code=403, detail="Только староста может просматривать заявки")
        
        applications = await db.journal_applications.find({
            "journal_id": journal_id,
            "status": "pending"
        }).sort("created_at", -1).to_list(100)
        
        result = []
        for app in applications:
            result.append({
                "id": app["id"],
                "telegram_id": app["telegram_id"],
                "username": app.get("username"),
                "first_name": app.get("first_name"),
                "last_name": app.get("last_name"),
                "full_name": f"{app.get('first_name', '')} {app.get('last_name', '')}".strip() or app.get("username") or f"User {app['telegram_id']}",
                "telegram_link": f"tg://user?id={app['telegram_id']}",
                "created_at": app["created_at"].isoformat() if app.get("created_at") else None,
                "status": app["status"]
            })
        
        return {
            "applications": result,
            "total": len(result)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting journal applications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/journals/applications/{application_id}/process")
async def process_journal_application(application_id: str, data: ProcessJournalApplicationRequest):
    """Обработать заявку на вступление в журнал"""
    try:
        # Находим заявку
        application = await db.journal_applications.find_one({"id": application_id})
        if not application:
            raise HTTPException(status_code=404, detail="Заявка не найдена")
        
        if application["status"] != "pending":
            raise HTTPException(status_code=400, detail="Заявка уже обработана")
        
        journal_id = application["journal_id"]
        journal = await db.attendance_journals.find_one({"journal_id": journal_id})
        if not journal:
            raise HTTPException(status_code=404, detail="Журнал не найден")
        
        # Проверяем что это владелец
        if journal["owner_id"] != data.owner_telegram_id:
            raise HTTPException(status_code=403, detail="Только староста может обрабатывать заявки")
        
        applicant_telegram_id = application["telegram_id"]
        applicant_name = f"{application.get('first_name', '')} {application.get('last_name', '')}".strip()
        if not applicant_name:
            applicant_name = application.get("username") or f"User {applicant_telegram_id}"
        
        if data.action == "approve":
            if not data.student_id:
                raise HTTPException(status_code=400, detail="Не выбран студент для привязки")
            
            # Проверяем что студент существует и не привязан
            student = await db.journal_students.find_one({
                "id": data.student_id,
                "journal_id": journal_id
            })
            if not student:
                raise HTTPException(status_code=404, detail="Студент не найден")
            
            if student.get("is_linked") and student.get("telegram_id") != applicant_telegram_id:
                raise HTTPException(status_code=400, detail="Этот студент уже привязан к другому пользователю")
            
            # Привязываем студента
            await db.journal_students.update_one(
                {"id": data.student_id},
                {
                    "$set": {
                        "telegram_id": applicant_telegram_id,
                        "is_linked": True,
                        "linked_at": datetime.utcnow(),
                        "username": application.get("username"),
                        "first_name": application.get("first_name")
                    }
                }
            )
            
            # Обновляем статус заявки
            await db.journal_applications.update_one(
                {"id": application_id},
                {
                    "$set": {
                        "status": "approved",
                        "processed_at": datetime.utcnow(),
                        "linked_student_id": data.student_id
                    }
                }
            )
            
            # Уведомляем заявителя
            await create_notification(
                telegram_id=applicant_telegram_id,
                notification_type=NotificationType.JOURNAL_ATTENDANCE,
                category=NotificationCategory.JOURNAL,
                priority=NotificationPriority.HIGH,
                title="Заявка одобрена!",
                message=f"Вы добавлены в журнал «{journal.get('name', 'Журнал')}» как «{student['full_name']}»",
                emoji="",
                data={
                    "journal_id": journal_id,
                    "student_id": data.student_id,
                    "student_name": student['full_name']
                }
            )
            
            logger.info(f"✅ Application {application_id} approved: user {applicant_telegram_id} linked to student '{student['full_name']}'")
            
            return {
                "status": "success",
                "message": f"Заявка одобрена. {applicant_name} привязан к «{student['full_name']}»",
                "student_name": student['full_name']
            }
        
        elif data.action == "reject":
            # Отклоняем заявку
            await db.journal_applications.update_one(
                {"id": application_id},
                {
                    "$set": {
                        "status": "rejected",
                        "processed_at": datetime.utcnow()
                    }
                }
            )
            
            # Уведомляем заявителя
            await create_notification(
                telegram_id=applicant_telegram_id,
                notification_type=NotificationType.JOURNAL_ATTENDANCE,
                category=NotificationCategory.JOURNAL,
                priority=NotificationPriority.NORMAL,
                title="Заявка отклонена",
                message=f"Ваша заявка на вступление в журнал «{journal.get('name', 'Журнал')}» была отклонена",
                emoji="",
                data={"journal_id": journal_id}
            )
            
            logger.info(f"❌ Application {application_id} rejected for user {applicant_telegram_id}")
            
            return {
                "status": "success",
                "message": "Заявка отклонена"
            }
        
        else:
            raise HTTPException(status_code=400, detail="Неверное действие. Используйте 'approve' или 'reject'")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing journal application: {e}")
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
            
            # Рассчитать статистику оценок
            grades_pipeline = [
                {"$match": {"student_id": s["id"], "grade": {"$ne": None}}},
                {"$group": {
                    "_id": None,
                    "count": {"$sum": 1},
                    "sum": {"$sum": "$grade"},
                    "grade_5": {"$sum": {"$cond": [{"$eq": ["$grade", 5]}, 1, 0]}},
                    "grade_4": {"$sum": {"$cond": [{"$eq": ["$grade", 4]}, 1, 0]}},
                    "grade_3": {"$sum": {"$cond": [{"$eq": ["$grade", 3]}, 1, 0]}},
                    "grade_2": {"$sum": {"$cond": [{"$eq": ["$grade", 2]}, 1, 0]}},
                    "grade_1": {"$sum": {"$cond": [{"$eq": ["$grade", 1]}, 1, 0]}}
                }}
            ]
            grades_result = await db.attendance_records.aggregate(grades_pipeline).to_list(1)
            
            average_grade = None
            grades_count = 0
            grade_5_count = grade_4_count = grade_3_count = grade_2_count = grade_1_count = 0
            
            if grades_result:
                g = grades_result[0]
                grades_count = g["count"]
                if grades_count > 0:
                    average_grade = round(g["sum"] / grades_count, 2)
                grade_5_count = g["grade_5"]
                grade_4_count = g["grade_4"]
                grade_3_count = g["grade_3"]
                grade_2_count = g["grade_2"]
                grade_1_count = g["grade_1"]
            
            attendance_percent = None
            # Общее количество записей для этого студента (был ли он вообще отмечен)
            total_records = present_count + absent_count + excused_count + late_count
            
            # Показываем процент только если есть занятия И студент был отмечен хотя бы раз
            if total_sessions > 0 and total_records > 0:
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
                total_sessions=total_sessions,
                average_grade=average_grade,
                grades_count=grades_count,
                grade_5_count=grade_5_count,
                grade_4_count=grade_4_count,
                grade_3_count=grade_3_count,
                grade_2_count=grade_2_count,
                grade_1_count=grade_1_count
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


@api_router.get("/journals/subjects/{subject_id}/attendance-stats")
async def get_subject_attendance_stats(subject_id: str, telegram_id: int = 0):
    """Получить детальную статистику посещаемости по предмету со списком студентов"""
    try:
        # Получаем предмет
        subject = await db.journal_subjects.find_one({"subject_id": subject_id})
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        
        journal_id = subject["journal_id"]
        
        # Получаем журнал для проверки доступа
        journal = await db.attendance_journals.find_one({"journal_id": journal_id})
        if not journal:
            raise HTTPException(status_code=404, detail="Journal not found")
        
        # Получаем все занятия этого предмета
        sessions = await db.journal_sessions.find(
            {"subject_id": subject_id}
        ).sort("date", -1).to_list(1000)
        
        # Получаем всех студентов журнала
        students = await db.journal_students.find(
            {"journal_id": journal_id}
        ).to_list(1000)
        
        # Получаем все записи посещаемости для занятий этого предмета
        session_ids = [s["session_id"] for s in sessions]
        attendance_records = await db.attendance_records.find(
            {"session_id": {"$in": session_ids}}
        ).to_list(10000)
        
        # Создаём маппинг записей: {session_id: {student_id: record}}
        records_map = {}
        for record in attendance_records:
            session_id = record["session_id"]
            student_id = record["student_id"]
            if session_id not in records_map:
                records_map[session_id] = {}
            records_map[session_id][student_id] = record
        
        total_students = len(students)
        total_sessions = len(sessions)
        
        # Статистика по студентам
        students_stats = []
        total_present = 0
        total_absent = 0
        total_late = 0
        total_excused = 0
        
        for student in students:
            student_id = student["id"]
            present = 0
            absent = 0
            late = 0
            excused = 0
            
            for session in sessions:
                session_id = session["session_id"]
                record = records_map.get(session_id, {}).get(student_id)
                if record:
                    status = record.get("status", "absent")
                    if status == "present":
                        present += 1
                    elif status == "absent":
                        absent += 1
                    elif status == "late":
                        late += 1
                        present += 1  # late считается как присутствие
                    elif status == "excused":
                        excused += 1
            
            # Считаем процент (присутствие = present + late)
            marked_sessions = present + absent + excused
            attendance_percent = 0.0
            if marked_sessions > 0:
                # present уже включает late
                attendance_percent = round((present / marked_sessions) * 100, 1)
            
            students_stats.append({
                "student_id": student_id,
                "full_name": student.get("full_name", ""),
                "is_linked": bool(student.get("linked_telegram_id")),
                "telegram_id": student.get("linked_telegram_id"),
                "present_count": present,
                "absent_count": absent,
                "late_count": late,
                "excused_count": excused,
                "total_sessions": total_sessions,
                "attendance_percent": attendance_percent
            })
            
            total_present += present
            total_absent += absent
            total_late += late
            total_excused += excused
        
        # Сортируем по посещаемости (от худшей к лучшей для выявления проблемных студентов)
        students_stats.sort(key=lambda x: (-x["attendance_percent"], x["full_name"]))
        
        # Статистика по занятиям
        sessions_stats = []
        for session in sessions:
            session_id = session["session_id"]
            session_records = records_map.get(session_id, {})
            
            s_present = 0
            s_absent = 0
            s_late = 0
            s_excused = 0
            
            for student_id, record in session_records.items():
                status = record.get("status", "absent")
                if status == "present":
                    s_present += 1
                elif status == "absent":
                    s_absent += 1
                elif status == "late":
                    s_late += 1
                    s_present += 1
                elif status == "excused":
                    s_excused += 1
            
            marked = s_present + s_absent + s_excused
            s_percent = round((s_present / marked * 100), 1) if marked > 0 else 0.0
            
            sessions_stats.append({
                "session_id": session_id,
                "date": session["date"],
                "title": session.get("title", ""),
                "type": session.get("type", "lecture"),
                "present_count": s_present,
                "absent_count": s_absent,
                "late_count": s_late,
                "excused_count": s_excused,
                "total_students": total_students,
                "attendance_percent": s_percent
            })
        
        # Общий процент посещаемости
        total_marked = total_present + total_absent + total_excused
        overall_percent = round((total_present / total_marked * 100), 1) if total_marked > 0 else 0.0
        
        return {
            "subject_id": subject_id,
            "subject_name": subject.get("name", ""),
            "subject_color": subject.get("color", "blue"),
            "description": subject.get("description"),
            "journal_id": journal_id,
            "total_sessions": total_sessions,
            "total_students": total_students,
            "overall_attendance_percent": overall_percent,
            "present_count": total_present,
            "absent_count": total_absent,
            "late_count": total_late,
            "excused_count": total_excused,
            "students_stats": students_stats,
            "sessions_stats": sessions_stats
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting subject attendance stats: {e}")
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
            
            # Статистика оценок за сессию
            grades_pipeline = [
                {"$match": {"session_id": s["session_id"], "grade": {"$ne": None}}},
                {"$group": {
                    "_id": None,
                    "count": {"$sum": 1},
                    "sum": {"$sum": "$grade"}
                }}
            ]
            grades_result = await db.attendance_records.aggregate(grades_pipeline).to_list(1)
            
            grades_count = 0
            average_grade = None
            if grades_result:
                g = grades_result[0]
                grades_count = g["count"]
                if grades_count > 0:
                    average_grade = round(g["sum"] / grades_count, 2)
            
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
                absent_count=absent_count,
                grades_count=grades_count,
                average_grade=average_grade
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
                        "grade": record.grade,
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
                    grade=record.grade,
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
                "grade": record.get("grade") if record else None,
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
        
        # Показываем процент только если студент был отмечен хотя бы раз
        attendance_percent = None
        total_records = len(records)
        if total_sessions > 0 and total_records > 0:
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
                    "sessions": [],
                    # Оценки по предмету
                    "grades": [],
                    "average_grade": None,
                    "grades_count": 0
                }
            
            subjects_stats[subject_id]["total_sessions"] += 1
            
            record = records_map.get(s["session_id"])
            status = record["status"] if record else "unmarked"
            grade = record.get("grade") if record else None
            
            if status in ["present", "late"]:
                subjects_stats[subject_id]["present_count"] += 1
            if status == "absent":
                subjects_stats[subject_id]["absent_count"] += 1
            if status == "late":
                subjects_stats[subject_id]["late_count"] += 1
            if status == "excused":
                subjects_stats[subject_id]["excused_count"] += 1
            
            # Добавляем оценку если есть
            if grade is not None:
                subjects_stats[subject_id]["grades"].append({
                    "grade": grade,
                    "date": s["date"],
                    "session_title": s["title"],
                    "session_type": s.get("type", "lecture")
                })
            
            subjects_stats[subject_id]["sessions"].append({
                "session_id": s["session_id"],
                "date": s["date"],
                "title": s["title"],
                "type": s.get("type", "lecture"),
                "status": status,
                "grade": grade
            })
        
        # Вычисляем процент и среднюю оценку по каждому предмету
        subjects_list = []
        for subject_id, subj_stats in subjects_stats.items():
            if subj_stats["total_sessions"] > 0:
                subj_stats["attendance_percent"] = round(
                    (subj_stats["present_count"] / subj_stats["total_sessions"]) * 100, 1
                )
            
            # Средняя оценка по предмету
            if subj_stats["grades"]:
                subj_stats["grades_count"] = len(subj_stats["grades"])
                total_grade = sum(g["grade"] for g in subj_stats["grades"])
                subj_stats["average_grade"] = round(total_grade / subj_stats["grades_count"], 2)
            
            subjects_list.append(subj_stats)
        
        # Сортируем предметы по имени
        subjects_list.sort(key=lambda x: x["subject_name"])
        
        # Статистика по оценкам
        grades_pipeline = [
            {"$match": {"student_id": student["id"], "grade": {"$ne": None}}},
            {"$group": {
                "_id": None,
                "count": {"$sum": 1},
                "sum": {"$sum": "$grade"},
                "grade_5": {"$sum": {"$cond": [{"$eq": ["$grade", 5]}, 1, 0]}},
                "grade_4": {"$sum": {"$cond": [{"$eq": ["$grade", 4]}, 1, 0]}},
                "grade_3": {"$sum": {"$cond": [{"$eq": ["$grade", 3]}, 1, 0]}},
                "grade_2": {"$sum": {"$cond": [{"$eq": ["$grade", 2]}, 1, 0]}},
                "grade_1": {"$sum": {"$cond": [{"$eq": ["$grade", 1]}, 1, 0]}}
            }}
        ]
        grades_result = await db.attendance_records.aggregate(grades_pipeline).to_list(1)
        
        average_grade = None
        grades_count = 0
        grade_5_count = grade_4_count = grade_3_count = grade_2_count = grade_1_count = 0
        
        if grades_result:
            g = grades_result[0]
            grades_count = g["count"]
            if grades_count > 0:
                average_grade = round(g["sum"] / grades_count, 2)
            grade_5_count = g["grade_5"]
            grade_4_count = g["grade_4"]
            grade_3_count = g["grade_3"]
            grade_2_count = g["grade_2"]
            grade_1_count = g["grade_1"]
        
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
            "records": attendance_records,
            # Статистика по оценкам
            "average_grade": average_grade,
            "grades_count": grades_count,
            "grade_5_count": grade_5_count,
            "grade_4_count": grade_4_count,
            "grade_3_count": grade_3_count,
            "grade_2_count": grade_2_count,
            "grade_1_count": grade_1_count
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting my attendance: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/journals/{journal_id}/student-stats/{student_id}")
async def get_student_stats_by_id(journal_id: str, student_id: str, telegram_id: int = 0):
    """Получить статистику студента по student_id (для владельца журнала)"""
    try:
        # Проверяем права доступа
        journal = await db.attendance_journals.find_one({"journal_id": journal_id})
        if not journal:
            raise HTTPException(status_code=404, detail="Journal not found")
        
        is_owner = journal["owner_id"] == telegram_id
        stats_viewers = journal.get("stats_viewers", [])
        can_view = is_owner or telegram_id in stats_viewers
        
        if not can_view:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Найти студента
        student = await db.journal_students.find_one({
            "journal_id": journal_id,
            "id": student_id
        })
        
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        
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
            {"student_id": student_id}
        ).to_list(500)
        
        records_map = {r["session_id"]: r for r in records}
        
        # Общая статистика
        present_count = sum(1 for r in records if r["status"] in ["present", "late"])
        absent_count = sum(1 for r in records if r["status"] == "absent")
        excused_count = sum(1 for r in records if r["status"] == "excused")
        late_count = sum(1 for r in records if r["status"] == "late")
        total_sessions = len(sessions)
        
        attendance_percent = round((present_count / total_sessions) * 100, 1) if total_sessions > 0 else 0
        
        # Стрики
        current_streak = 0
        best_streak = 0
        temp_streak = 0
        
        sorted_sessions = sorted(sessions, key=lambda x: x["date"])
        for s in sorted_sessions:
            record = records_map.get(s["session_id"])
            if record and record["status"] in ["present", "late"]:
                temp_streak += 1
                if temp_streak > best_streak:
                    best_streak = temp_streak
            else:
                temp_streak = 0
        
        # Подсчёт текущего стрика с конца
        for s in reversed(sorted_sessions):
            record = records_map.get(s["session_id"])
            if record and record["status"] in ["present", "late"]:
                current_streak += 1
            else:
                break
        
        # Статистика по предметам с оценками
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
                    "sessions": [],
                    "grades": [],
                    "average_grade": None,
                    "grades_count": 0
                }
            
            subjects_stats[subject_id]["total_sessions"] += 1
            
            record = records_map.get(s["session_id"])
            status = record["status"] if record else "unmarked"
            grade = record.get("grade") if record else None
            
            if status in ["present", "late"]:
                subjects_stats[subject_id]["present_count"] += 1
            if status == "absent":
                subjects_stats[subject_id]["absent_count"] += 1
            if status == "late":
                subjects_stats[subject_id]["late_count"] += 1
            if status == "excused":
                subjects_stats[subject_id]["excused_count"] += 1
            
            if grade is not None:
                subjects_stats[subject_id]["grades"].append({
                    "grade": grade,
                    "date": s["date"],
                    "session_title": s["title"],
                    "session_type": s.get("type", "lecture")
                })
            
            subjects_stats[subject_id]["sessions"].append({
                "session_id": s["session_id"],
                "date": s["date"],
                "title": s["title"],
                "type": s.get("type", "lecture"),
                "status": status,
                "grade": grade
            })
        
        # Вычисляем процент и среднюю оценку по каждому предмету
        subjects_list = []
        for subject_id, subj_stats in subjects_stats.items():
            if subj_stats["total_sessions"] > 0:
                subj_stats["attendance_percent"] = round(
                    (subj_stats["present_count"] / subj_stats["total_sessions"]) * 100, 1
                )
            
            if subj_stats["grades"]:
                subj_stats["grades_count"] = len(subj_stats["grades"])
                total_grade = sum(g["grade"] for g in subj_stats["grades"])
                subj_stats["average_grade"] = round(total_grade / subj_stats["grades_count"], 2)
            
            subjects_list.append(subj_stats)
        
        subjects_list.sort(key=lambda x: x["subject_name"])
        
        # Статистика по оценкам
        grades_pipeline = [
            {"$match": {"student_id": student_id, "grade": {"$ne": None}}},
            {"$group": {
                "_id": None,
                "count": {"$sum": 1},
                "sum": {"$sum": "$grade"},
                "grade_5": {"$sum": {"$cond": [{"$eq": ["$grade", 5]}, 1, 0]}},
                "grade_4": {"$sum": {"$cond": [{"$eq": ["$grade", 4]}, 1, 0]}},
                "grade_3": {"$sum": {"$cond": [{"$eq": ["$grade", 3]}, 1, 0]}},
                "grade_2": {"$sum": {"$cond": [{"$eq": ["$grade", 2]}, 1, 0]}},
                "grade_1": {"$sum": {"$cond": [{"$eq": ["$grade", 1]}, 1, 0]}}
            }}
        ]
        grades_result = await db.attendance_records.aggregate(grades_pipeline).to_list(1)
        
        average_grade = None
        grades_count = 0
        grade_5_count = grade_4_count = grade_3_count = grade_2_count = grade_1_count = 0
        
        if grades_result:
            g = grades_result[0]
            grades_count = g["count"]
            if grades_count > 0:
                average_grade = round(g["sum"] / grades_count, 2)
            grade_5_count = g["grade_5"]
            grade_4_count = g["grade_4"]
            grade_3_count = g["grade_3"]
            grade_2_count = g["grade_2"]
            grade_1_count = g["grade_1"]
        
        # Формируем общие записи
        attendance_records = []
        for s in sessions[:50]:
            record = records_map.get(s["session_id"])
            attendance_records.append({
                "session_id": s["session_id"],
                "date": s["date"],
                "subject_name": subjects_map.get(s.get("subject_id"), {}).get("name", "Без предмета"),
                "title": s["title"],
                "type": s.get("type", "lecture"),
                "status": record["status"] if record else "unmarked",
                "grade": record.get("grade") if record else None
            })
        
        return {
            "student_id": student["id"],
            "full_name": student["full_name"],
            "telegram_id": student.get("telegram_id"),
            "is_linked": student.get("is_linked", False),
            "attendance_percent": attendance_percent,
            "present_count": present_count,
            "absent_count": absent_count,
            "excused_count": excused_count,
            "late_count": late_count,
            "total_sessions": total_sessions,
            "current_streak": current_streak,
            "best_streak": best_streak,
            "subjects_stats": subjects_list,
            "records": attendance_records,
            "average_grade": average_grade,
            "grades_count": grades_count,
            "grade_5_count": grade_5_count,
            "grade_4_count": grade_4_count,
            "grade_3_count": grade_3_count,
            "grade_2_count": grade_2_count,
            "grade_1_count": grade_1_count
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting student stats: {e}")
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
            stats = att_map.get(s_id, {"present": 0, "late": 0, "absent": 0, "excused": 0, "total_marked": 0})
            
            present = stats["present"]
            late = stats["late"]
            absent = stats["absent"]
            excused = stats["excused"]
            total_marked = stats.get("total_marked", 0)
            
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
            
            # Процент - показываем только если студент был отмечен хотя бы раз
            att_percent = None
            if effective_sessions > 0 and total_marked > 0:
                att_percent = round((numerator / effective_sessions) * 100, 1)
                
                # Добавляем в общую копилку (только если есть занятия И студент отмечен)
                global_numerator += numerator
                global_denominator += effective_sessions
            
            # IMPLICIT ABSENT FIX:
            # Чтобы в UI (present / present+absent) совпадало с процентом,
            # считаем "неотмеченные" (unmarked) как прогулы для отображения
            # absent_count = (Total Valid - Excused) - (Present + Late)
            # Но только если студент был отмечен
            implicit_absent = 0
            if total_marked > 0:
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


# ============ MUSIC API ENDPOINTS ============

from music_service import music_service
from cover_service import init_cover_service, get_cover_service

@api_router.get("/music/search")
async def music_search(q: str, count: int = 20):
    """
    Асинхронный поиск музыки по запросу с обложками из Deezer.
    Возвращает треки с метаданными. Прямая ссылка может быть пустой -
    используйте /api/music/stream/{track_id} для получения URL при воспроизведении.
    """
    try:
        tracks = await music_service.search(q, count)
        
        # Обогащаем треки обложками из Deezer API
        tracks = await music_service.enrich_tracks_with_covers(tracks)
        
        return {"tracks": tracks, "count": len(tracks)}
    except Exception as e:
        logger.error(f"Music search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/music/stream/{track_id}")
async def music_stream(track_id: str):
    """
    Получение прямой ссылки на трек для воспроизведения.
    Вызывается frontend'ом при нажатии play.
    Возвращает JSON с url или редирект на прямую ссылку.
    """
    try:
        url = await music_service.get_track_url(track_id)
        
        if not url:
            raise HTTPException(
                status_code=404, 
                detail="Трек недоступен или заблокирован правообладателем"
            )
        
        # Возвращаем JSON с URL (frontend сам установит src)
        return {"url": url, "track_id": track_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Music stream error for {track_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/music/redirect/{track_id}")
async def music_redirect(track_id: str):
    """
    Альтернативный endpoint - редирект на прямую ссылку.
    Полезен для <audio src="/api/music/redirect/...">
    """
    try:
        url = await music_service.get_track_url(track_id)
        
        if not url:
            raise HTTPException(
                status_code=404, 
                detail="Трек недоступен"
            )
        
        return RedirectResponse(url=url)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Music redirect error for {track_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/music/my")
async def music_my_audio(count: int = 50, offset: int = 0):
    """Мои аудиозаписи VK с обложками из Deezer"""
    try:
        tracks = await music_service.get_my_audio(count, offset)
        current_count = len(tracks)
        
        # Обогащаем треки обложками из Deezer API
        tracks = await music_service.enrich_tracks_with_covers(tracks)
        
        # FIX: Убираем двойной VK API запрос для has_more.
        # Вместо этого: если получили полный набор — скорее всего есть ещё
        has_more = current_count >= count
        
        return {"tracks": tracks, "count": current_count, "offset": offset, "has_more": has_more}
    except Exception as e:
        logger.error(f"Music my audio error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/music/popular")
async def music_popular(count: int = 30, offset: int = 0):
    """Популярные треки с пагинацией и обложками из Deezer"""
    try:
        tracks = await music_service.get_popular(count, offset)
        
        # Обогащаем треки обложками из Deezer API
        tracks = await music_service.enrich_tracks_with_covers(tracks)
        
        # has_more = true если получили полный набор треков
        has_more = len(tracks) == count
        return {"tracks": tracks, "count": len(tracks), "has_more": has_more, "offset": offset}
    except Exception as e:
        logger.error(f"Music popular error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/music/playlists")
async def music_playlists():
    """Плейлисты пользователя VK (DEPRECATED - используйте /music/playlists-vk/{telegram_id})"""
    try:
        playlists = await music_service.get_playlists()
        return {"playlists": playlists}
    except Exception as e:
        logger.error(f"Music playlists error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/music/playlists-vk/{telegram_id}")
async def music_playlists_vk(telegram_id: int):
    """
    Получение плейлистов пользователя с использованием его персонального токена VK.
    """
    try:
        # Получаем токен пользователя
        token_doc = await db.user_vk_tokens.find_one({"telegram_id": telegram_id})
        
        if not token_doc:
            raise HTTPException(
                status_code=401, 
                detail="VK аккаунт не подключен. Авторизуйтесь в разделе Музыка."
            )
        
        token = token_doc.get("vk_token")
        vk_user_id = token_doc.get("vk_user_id")
        user_agent = token_doc.get("user_agent", "KateMobileAndroid/93 lite-530")
        
        # Запрос плейлистов к VK API (async)
        async with aiohttp.ClientSession() as session:
            async with session.get(
                "https://api.vk.com/method/audio.getPlaylists",
                params={
                    "access_token": token,
                    "owner_id": vk_user_id,
                    "count": 50,
                    "v": "5.131"
                },
                headers={"User-Agent": user_agent},
                timeout=aiohttp.ClientTimeout(total=15)
            ) as response:
                data = await response.json()
        
        if "error" in data:
            error = data["error"]
            error_code = error.get("error_code", 0)
            
            # Токен истёк
            if error_code in [5, 27]:
                raise HTTPException(
                    status_code=401,
                    detail="Токен истёк. Требуется повторная авторизация."
                )
            
            raise HTTPException(
                status_code=400,
                detail=error.get("error_msg", "VK API Error")
            )
        
        items = data.get("response", {}).get("items", [])
        
        # Форматируем плейлисты
        playlists = []
        for item in items:
            # Получаем обложку плейлиста
            cover_url = None
            thumbs = item.get("thumbs", [])
            if thumbs and len(thumbs) > 0:
                cover_url = thumbs[0].get("photo_600") or thumbs[0].get("photo_300")
            if not cover_url:
                photo = item.get("photo", {})
                if photo:
                    cover_url = photo.get("photo_600") or photo.get("photo_300")
            
            playlists.append({
                "id": item.get("id", 0),
                "owner_id": item.get("owner_id", vk_user_id),
                "title": item.get("title", "Без названия"),
                "count": item.get("count", 0),
                "cover": cover_url,
                "access_key": item.get("access_key", "")
            })
        
        logger.info(f"VK playlists for telegram_id={telegram_id}: found {len(playlists)} playlists")
        
        return {"playlists": playlists}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Music playlists VK error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/music/playlist/{owner_id}/{playlist_id}")
async def music_playlist_tracks(owner_id: int, playlist_id: int, access_key: str = "", count: int = 100):
    """Треки конкретного плейлиста с обложками из Deezer (DEPRECATED - используйте /music/playlist-vk/{telegram_id}/{owner_id}/{playlist_id})"""
    try:
        tracks = await music_service.get_playlist_tracks(owner_id, playlist_id, access_key, count)
        
        # Обогащаем треки обложками из Deezer API
        tracks = await music_service.enrich_tracks_with_covers(tracks)
        
        return {"tracks": tracks, "count": len(tracks)}
    except Exception as e:
        logger.error(f"Music playlist tracks error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/music/playlist-vk/{telegram_id}/{owner_id}/{playlist_id}")
async def music_playlist_tracks_vk(telegram_id: int, owner_id: int, playlist_id: int, access_key: str = "", count: int = 100):
    """
    Получение треков плейлиста с использованием персонального токена VK.
    """
    try:
        # Получаем токен пользователя
        token_doc = await db.user_vk_tokens.find_one({"telegram_id": telegram_id})
        
        if not token_doc:
            raise HTTPException(
                status_code=401, 
                detail="VK аккаунт не подключен. Авторизуйтесь в разделе Музыка."
            )
        
        token = token_doc.get("vk_token")
        user_agent = token_doc.get("user_agent", "KateMobileAndroid/93 lite-530")
        
        # Запрос треков плейлиста к VK API (async)
        params = {
            "access_token": token,
            "owner_id": owner_id,
            "playlist_id": playlist_id,
            "count": min(count, 100),
            "v": "5.131"
        }
        if access_key:
            params["access_key"] = access_key
            
        async with aiohttp.ClientSession() as session:
            async with session.get(
                "https://api.vk.com/method/audio.get",
                params=params,
                headers={"User-Agent": user_agent},
                timeout=aiohttp.ClientTimeout(total=15)
            ) as response:
                data = await response.json()
        
        if "error" in data:
            error = data["error"]
            error_code = error.get("error_code", 0)
            
            if error_code in [5, 27]:
                raise HTTPException(
                    status_code=401,
                    detail="Токен истёк. Требуется повторная авторизация."
                )
            
            raise HTTPException(
                status_code=400,
                detail=error.get("error_msg", "VK API Error")
            )
        
        items = data.get("response", {}).get("items", [])
        
        # Форматируем треки
        tracks = []
        for item in items:
            cover_url = None
            album = item.get("album", {})
            if album:
                thumb = album.get("thumb", {})
                if thumb:
                    cover_url = thumb.get("photo_600") or thumb.get("photo_300")
            
            track_id = f"{item['owner_id']}_{item['id']}"
            direct_url = item.get("url", "")
            is_blocked = not direct_url or "audio_api_unavailable" in direct_url
            
            tracks.append({
                "id": track_id,
                "owner_id": item["owner_id"],
                "song_id": item["id"],
                "artist": item.get("artist", "Unknown"),
                "title": item.get("title", "Unknown"),
                "duration": item.get("duration", 0),
                "cover": cover_url,
                "stream_url": f"/api/music/stream/{track_id}",
                "is_blocked": is_blocked
            })
        
        # Обогащаем треки обложками из Deezer API
        tracks = await music_service.enrich_tracks_with_covers(tracks)
        
        logger.info(f"VK playlist tracks for telegram_id={telegram_id}: found {len(tracks)} tracks")
        
        return {"tracks": tracks, "count": len(tracks)}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Music playlist tracks VK error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/music/artist/{artist_name:path}")
async def music_artist_tracks(artist_name: str, count: int = 50):
    """Получить треки артиста по имени с обложками из Deezer"""
    try:
        result = await music_service.get_artist_tracks(artist_name, count)
        
        # Обогащаем треки обложками из Deezer API
        if result.get('tracks'):
            result['tracks'] = await music_service.enrich_tracks_with_covers(result['tracks'])
        
        return result
    except Exception as e:
        logger.error(f"Music artist tracks error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Избранные треки (хранятся в MongoDB)
@api_router.get("/music/favorites/{telegram_id}")
async def get_music_favorites(telegram_id: int):
    """Получить избранные треки пользователя"""
    try:
        favorites = await db.music_favorites.find(
            {"telegram_id": telegram_id}
        ).sort("added_at", -1).to_list(500)
        
        # Убираем _id из ответа
        for f in favorites:
            f.pop("_id", None)
        
        return {"tracks": favorites, "count": len(favorites)}
    except Exception as e:
        logger.error(f"Get music favorites error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/music/favorites/{telegram_id}")
async def add_music_favorite(telegram_id: int, track: dict):
    """Добавить трек в избранное"""
    try:
        # Проверяем, не добавлен ли уже
        existing = await db.music_favorites.find_one({
            "telegram_id": telegram_id,
            "id": track.get("id")
        })
        
        if existing:
            return {"success": False, "message": "Track already in favorites"}
        
        # FIX: Копируем dict чтобы не мутировать оригинал и не пробрасывать _id
        favorite_doc = {**track}
        favorite_doc["telegram_id"] = telegram_id
        favorite_doc["added_at"] = datetime.utcnow()
        
        await db.music_favorites.insert_one(favorite_doc)
        return {"success": True}
    except Exception as e:
        logger.error(f"Add music favorite error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/music/favorites/{telegram_id}/{track_id}")
async def remove_music_favorite(telegram_id: int, track_id: str):
    """Удалить трек из избранного"""
    try:
        result = await db.music_favorites.delete_one({
            "telegram_id": telegram_id,
            "id": track_id
        })
        return {"success": result.deleted_count > 0}
    except Exception as e:
        logger.error(f"Remove music favorite error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ MUSIC HISTORY & SIMILAR ============

@api_router.post("/music/history/{telegram_id}")
async def add_to_history(telegram_id: int, track: dict):
    """Добавить трек в историю прослушивания"""
    try:
        history_doc = {**track}
        history_doc["telegram_id"] = telegram_id
        history_doc["played_at"] = datetime.utcnow()
        # Удаляем старую запись этого трека (если есть) чтобы поднять наверх
        await db.music_history.delete_many({
            "telegram_id": telegram_id,
            "id": track.get("id")
        })
        await db.music_history.insert_one(history_doc)
        # Ограничиваем историю 200 записями
        count = await db.music_history.count_documents({"telegram_id": telegram_id})
        if count > 200:
            oldest = await db.music_history.find(
                {"telegram_id": telegram_id}
            ).sort("played_at", 1).limit(count - 200).to_list(None)
            if oldest:
                ids = [d["_id"] for d in oldest]
                await db.music_history.delete_many({"_id": {"$in": ids}})
        return {"success": True}
    except Exception as e:
        logger.error(f"Add to history error: {e}")
        return {"success": False}

@api_router.get("/music/history/{telegram_id}")
async def get_history(telegram_id: int, limit: int = 50):
    """Получить историю прослушивания"""
    try:
        history = await db.music_history.find(
            {"telegram_id": telegram_id},
            {"_id": 0, "telegram_id": 0}
        ).sort("played_at", -1).limit(limit).to_list(None)
        return {"tracks": history, "count": len(history)}
    except Exception as e:
        logger.error(f"Get history error: {e}")
        return {"tracks": [], "count": 0}

@api_router.get("/music/similar/{track_id}")
async def get_similar_tracks(track_id: str, count: int = 20):
    """Получить похожие треки (на основе артиста текущего трека)"""
    try:
        # Извлекаем информацию о текущем треке из поиска
        artist = None
        # Ищем трек в избранном или истории
        for coll in [db.music_favorites, db.music_history]:
            doc = await coll.find_one({"id": track_id})
            if doc:
                artist = doc.get("artist")
                break
        
        if not artist:
            # Пробуем получить через VK API
            url = await music_service.get_track_url(track_id)
            # Используем поиск по ID для получения метаданных
            return {"tracks": [], "count": 0, "source": "unknown_track"}
        
        # Ищем треки того же артиста
        results = await music_service.search(artist, count=count)
        # Фильтруем текущий трек
        similar = [t for t in results if t.get("id") != track_id]
        # Обогащаем обложками
        similar = await music_service.enrich_tracks_with_covers(similar)
        
        return {"tracks": similar[:count], "count": len(similar[:count]), "source": "artist"}
    except Exception as e:
        logger.error(f"Get similar tracks error: {e}")
        return {"tracks": [], "count": 0}


# ============ VK AUTH API ============

from vk_auth_service import vk_auth_service, VKAuthError
from fastapi.responses import RedirectResponse, HTMLResponse
from urllib.parse import urlencode, quote

class VKAuthRequest(BaseModel):
    """Запрос авторизации VK через логин/пароль (Kate Mobile)"""
    # Авторизация через логин/пароль (основной метод)
    login: Optional[str] = Field(None, description="Телефон, email или логин VK")
    password: Optional[str] = Field(None, description="Пароль от аккаунта VK")
    two_fa_code: Optional[str] = Field(None, description="Код двухфакторной аутентификации")
    captcha_key: Optional[str] = Field(None, description="Ответ на капчу")
    captcha_sid: Optional[str] = Field(None, description="ID капчи")
    # Fallback - OAuth токен (если есть)
    token_url: Optional[str] = Field(None, description="URL с токеном из redirect")
    access_token: Optional[str] = Field(None, description="Или напрямую access_token")

class VKAuthResponse(BaseModel):
    """Ответ авторизации VK"""
    success: bool
    message: str
    vk_user_id: Optional[int] = None
    needs_2fa: bool = False
    captcha_data: Optional[dict] = None
    twofa_data: Optional[dict] = None  # phone_mask, validation_sid, validation_type

class VKOAuthConfigResponse(BaseModel):
    """Конфигурация OAuth для VK"""
    auth_url: str
    app_id: int
    redirect_uri: str

# VK OAuth Configuration - Kate Mobile (как vkserv.ru)
# Используем Implicit Grant Flow для получения токена с доступом к аудио
VK_OAUTH_CONFIG = {
    "app_id": 2685278,  # Kate Mobile - даёт доступ к audio API
    "redirect_uri": "https://api.vk.com/blank.html",  # Стандартный redirect для Implicit Grant
    "scope": "audio,offline",  # Минимальные права: только музыка и бессрочный токен
    "response_type": "token",  # Implicit Grant Flow - токен сразу в URL
    "display": "page"  # Полноразмерная страница авторизации
}

# Временное хранилище state для CSRF защиты (telegram_id -> state)
vk_oauth_states = {}

@api_router.get("/music/auth/config")
async def get_vk_oauth_config(telegram_id: int = None):
    """
    Получить конфигурацию OAuth для авторизации VK (Kate Mobile).
    
    Используем Implicit Grant Flow как на vkserv.ru:
    - client_id=2685278 (Kate Mobile)
    - redirect_uri=https://api.vk.com/blank.html
    - response_type=token (токен сразу в URL)
    
    Flow:
    1. Пользователь открывает auth_url
    2. Авторизуется в VK
    3. VK редиректит на blank.html#access_token=XXX&user_id=YYY
    4. Пользователь копирует URL и вставляет в приложение
    """
    # Формируем OAuth URL (Implicit Grant - токен сразу в URL)
    params = {
        "client_id": VK_OAUTH_CONFIG["app_id"],
        "redirect_uri": VK_OAUTH_CONFIG["redirect_uri"],
        "response_type": VK_OAUTH_CONFIG["response_type"],
        "scope": VK_OAUTH_CONFIG["scope"],
        "display": VK_OAUTH_CONFIG["display"]
    }
    
    auth_url = f"https://oauth.vk.com/authorize?{urlencode(params)}"
    
    return VKOAuthConfigResponse(
        auth_url=auth_url,
        app_id=VK_OAUTH_CONFIG["app_id"],
        redirect_uri=VK_OAUTH_CONFIG["redirect_uri"]
    )


@api_router.get("/music/vk-callback")
async def vk_oauth_callback(code: str = None, state: str = None, error: str = None, error_description: str = None):
    """
    Callback для VK OAuth.
    
    VK перенаправляет сюда после авторизации пользователя с параметром code.
    Мы обмениваем code на access_token и сохраняем токен.
    """
    
    # HTML шаблон для ответа
    def make_html_response(success: bool, message: str, vk_user_name: str = None):
        color = "#4CAF50" if success else "#f44336"
        icon = "✅" if success else "❌"
        return HTMLResponse(content=f"""
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VK Авторизация - RUDN Schedule</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            color: white;
        }}
        .container {{
            background: rgba(255,255,255,0.05);
            border-radius: 24px;
            padding: 40px;
            max-width: 400px;
            width: 100%;
            text-align: center;
            border: 1px solid rgba(255,255,255,0.1);
        }}
        .icon {{
            font-size: 64px;
            margin-bottom: 20px;
        }}
        .title {{
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 12px;
            color: {color};
        }}
        .message {{
            font-size: 16px;
            color: rgba(255,255,255,0.7);
            margin-bottom: 24px;
            line-height: 1.5;
        }}
        .user-name {{
            font-size: 18px;
            color: white;
            margin-bottom: 24px;
        }}
        .hint {{
            font-size: 14px;
            color: rgba(255,255,255,0.5);
            margin-top: 20px;
        }}
        .close-btn {{
            background: {color};
            color: white;
            border: none;
            border-radius: 12px;
            padding: 14px 32px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            margin-top: 16px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">{icon}</div>
        <div class="title">{"Успешно!" if success else "Ошибка"}</div>
        {f'<div class="user-name">{vk_user_name}</div>' if vk_user_name else ''}
        <div class="message">{message}</div>
        <button class="close-btn" onclick="window.close()">Закрыть</button>
        <div class="hint">Вернитесь в приложение</div>
    </div>
    <script>
        // Попробуем закрыть окно автоматически через 3 секунды
        setTimeout(() => {{
            try {{ window.close(); }} catch(e) {{}}
        }}, 3000);
    </script>
</body>
</html>
        """)
    
    # Проверяем ошибку от VK
    if error:
        logger.error(f"VK OAuth error: {error} - {error_description}")
        return make_html_response(False, f"VK вернул ошибку: {error_description or error}")
    
    # Проверяем наличие code
    if not code:
        return make_html_response(False, "Код авторизации не получен")
    
    # Проверяем state и извлекаем telegram_id
    telegram_id = None
    if state:
        state_data = vk_oauth_states.get(state)
        if state_data:
            telegram_id = state_data.get("telegram_id")
            # Удаляем использованный state
            del vk_oauth_states[state]
        else:
            # Пробуем извлечь telegram_id из state напрямую
            try:
                telegram_id = int(state.split("_")[0])
            except:
                pass
    
    if not telegram_id:
        return make_html_response(False, "Не удалось определить пользователя. Попробуйте авторизоваться заново.")
    
    try:
        # Обмениваем code на access_token
        token_url = "https://oauth.vk.com/access_token"
        token_params = {
            "client_id": VK_OAUTH_CONFIG["app_id"],
            "client_secret": VK_OAUTH_CONFIG["client_secret"],
            "redirect_uri": VK_OAUTH_CONFIG["redirect_uri"],
            "code": code
        }
        
        response = requests.get(token_url, params=token_params, timeout=10)
        token_data = response.json()
        
        if "error" in token_data:
            error_msg = token_data.get("error_description", token_data.get("error", "Unknown error"))
            logger.error(f"VK token exchange error: {error_msg}")
            return make_html_response(False, f"Ошибка получения токена: {error_msg}")
        
        access_token = token_data.get("access_token")
        vk_user_id = token_data.get("user_id")
        expires_in = token_data.get("expires_in", 0)
        
        if not access_token:
            return make_html_response(False, "Токен не получен от VK")
        
        # Валидируем токен
        verify_result = await vk_auth_service.verify_token(access_token)
        
        if not verify_result.get("valid"):
            return make_html_response(False, f"Недействительный токен: {verify_result.get('error', 'Unknown')}")
        
        # Получаем user_id из токена если не было
        if not vk_user_id:
            vk_user_id = verify_result.get("user_id")
        
        # Проверяем доступ к аудио
        audio_check = await vk_auth_service.test_audio_access(access_token)
        audio_count = audio_check.get("audio_count", 0)
        has_audio = audio_check.get("has_access", False)
        
        # Формируем имя пользователя
        user_name = f"{verify_result.get('first_name', '')} {verify_result.get('last_name', '')}".strip()
        
        # Сохраняем токен в MongoDB
        token_doc = {
            "telegram_id": telegram_id,
            "vk_user_id": vk_user_id,
            "vk_token": access_token,
            "user_agent": "VKAndroidApp/8.0-15000 (Android 10; SDK 29; arm64-v8a; ru)",
            "audio_count": audio_count,
            "has_audio_access": has_audio,
            "expires_in": expires_in,
            "auth_method": "vk_id_oauth",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        await db.user_vk_tokens.update_one(
            {"telegram_id": telegram_id},
            {"$set": token_doc},
            upsert=True
        )
        
        logger.info(f"VK ID OAuth success: telegram_id={telegram_id}, vk_user_id={vk_user_id}, user={user_name}, audio_count={audio_count}")
        
        if has_audio:
            return make_html_response(
                True, 
                f"VK аккаунт успешно подключен! У вас {audio_count} аудиозаписей.",
                user_name
            )
        else:
            return make_html_response(
                True,
                f"Аккаунт подключен, но доступ к аудио ограничен VK. Попробуйте использовать Kate Mobile.",
                user_name
            )
        
    except Exception as e:
        logger.error(f"VK OAuth callback error: {e}")
        return make_html_response(False, f"Ошибка обработки: {str(e)}")

def parse_vk_token_from_url(url: str) -> dict:
    """
    Парсит токен VK из URL после OAuth редиректа.
    
    URL формат: https://api.vk.com/blank.html#access_token=...&expires_in=...&user_id=...
    """
    import re
    from urllib.parse import urlparse, parse_qs
    
    result = {
        "access_token": None,
        "user_id": None,
        "expires_in": None
    }
    
    # Если это полный URL
    if url.startswith("http"):
        parsed = urlparse(url)
        # Токен в fragment (#)
        fragment = parsed.fragment
        if fragment:
            params = parse_qs(fragment)
            result["access_token"] = params.get("access_token", [None])[0]
            result["user_id"] = params.get("user_id", [None])[0]
            result["expires_in"] = params.get("expires_in", [None])[0]
    
    # Если это просто токен
    elif url.startswith("vk1.") or len(url) > 50:
        result["access_token"] = url.strip()
    
    # Попробуем извлечь токен из произвольной строки
    if not result["access_token"]:
        # Ищем access_token= в строке
        token_match = re.search(r'access_token=([^&\s]+)', url)
        if token_match:
            result["access_token"] = token_match.group(1)
        
        # Ищем user_id
        user_match = re.search(r'user_id=(\d+)', url)
        if user_match:
            result["user_id"] = user_match.group(1)
    
    return result

@api_router.post("/music/auth/{telegram_id}", response_model=VKAuthResponse)
async def vk_auth(telegram_id: int, request: VKAuthRequest):
    """
    Авторизация VK через логин/пароль (Kate Mobile) или OAuth токен.
    
    Основной метод - логин/пароль:
    1. Пользователь вводит логин и пароль от VK
    2. Сервер получает токен Kate Mobile через vkaudiotoken
    3. Токен даёт доступ к VK Audio API
    4. Токен сохраняется в MongoDB
    
    Fallback - OAuth токен (если передан):
    1. Парсим токен из URL
    2. Валидируем и сохраняем
    """
    try:
        token = None
        vk_user_id = None
        user_agent = "KateMobileAndroid/93 lite-530 (Android 10; SDK 29; arm64-v8a; Xiaomi Redmi Note 8 Pro; ru)"
        auth_method = "kate_mobile"
        user_name = ""
        
        # === Метод 1: Авторизация через логин/пароль (Kate Mobile) ===
        if request.login and request.password:
            logger.info(f"VK Kate auth attempt for telegram_id: {telegram_id}")
            
            try:
                auth_result = await vk_auth_service.authenticate(
                    login=request.login,
                    password=request.password,
                    two_fa_code=request.two_fa_code,
                    captcha_key=request.captcha_key,
                    captcha_sid=request.captcha_sid
                )
                
                token = auth_result.get("token")
                vk_user_id = auth_result.get("user_id")
                user_agent = auth_result.get("user_agent", user_agent)
                
            except VKAuthError as e:
                logger.warning(f"VK Kate auth error: {e.error_code} - {e.message}")
                return VKAuthResponse(
                    success=False,
                    message=e.message,
                    needs_2fa=e.needs_2fa,
                    captcha_data=e.captcha_data,
                    twofa_data=e.twofa_data  # Передаём данные о 2FA (phone_mask и т.д.)
                )
        
        # === Метод 2: OAuth токен (fallback) ===
        elif request.token_url or request.access_token:
            auth_method = "oauth"
            
            if request.token_url:
                parsed = parse_vk_token_from_url(request.token_url)
                token = parsed.get("access_token")
                vk_user_id = parsed.get("user_id")
                if vk_user_id:
                    vk_user_id = int(vk_user_id)
            elif request.access_token:
                token = request.access_token.strip()
        
        # === Проверка токена ===
        if not token:
            return VKAuthResponse(
                success=False,
                message="Введите логин и пароль от VK для авторизации",
                needs_2fa=False
            )
        
        # Валидируем токен через VK API
        verify_result = await vk_auth_service.verify_token(token)
        
        if not verify_result.get("valid"):
            return VKAuthResponse(
                success=False,
                message=f"Ошибка токена: {verify_result.get('error', 'Unknown error')}",
                needs_2fa=False
            )
        
        # Получаем user_id из токена если не было
        if not vk_user_id:
            vk_user_id = verify_result.get("user_id")
        
        user_name = f"{verify_result.get('first_name', '')} {verify_result.get('last_name', '')}".strip()
        
        # Проверяем доступ к аудио
        audio_check = await vk_auth_service.test_audio_access(token)
        
        if not audio_check.get("has_access"):
            return VKAuthResponse(
                success=False,
                message="Токен получен, но нет доступа к аудио. Возможно, VK ограничил доступ. Попробуйте позже.",
                needs_2fa=False
            )
        
        # === Сохраняем токен в MongoDB ===
        token_doc = {
            "telegram_id": telegram_id,
            "vk_user_id": vk_user_id,
            "vk_token": token,
            "user_agent": user_agent,
            "audio_count": audio_check.get("audio_count", 0),
            "auth_method": auth_method,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        # Upsert - обновляем если существует, создаем если нет
        await db.user_vk_tokens.update_one(
            {"telegram_id": telegram_id},
            {"$set": token_doc},
            upsert=True
        )
        
        logger.info(f"VK {auth_method} token saved for telegram_id: {telegram_id}, vk_user_id: {vk_user_id}, user: {user_name}")
        
        return VKAuthResponse(
            success=True,
            message=f"VK аккаунт подключен! Добро пожаловать, {user_name}",
            vk_user_id=vk_user_id,
            needs_2fa=False
        )
        
    except Exception as e:
        logger.error(f"VK auth error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/music/auth/status/{telegram_id}")
async def vk_auth_status(telegram_id: int):
    """
    Проверка статуса авторизации VK пользователя.
    
    Returns:
        - is_connected: bool - подключен ли VK аккаунт
        - vk_user_id: int - ID пользователя VK
        - vk_user_info: dict - информация о пользователе VK
        - token_valid: bool - валиден ли токен
        - audio_access: bool - есть ли доступ к аудио
    """
    try:
        # Ищем сохраненный токен
        token_doc = await db.user_vk_tokens.find_one({"telegram_id": telegram_id})
        
        if not token_doc:
            return {
                "is_connected": False,
                "message": "VK аккаунт не подключен"
            }
        
        # Проверяем валидность токена
        token = token_doc.get("vk_token")
        verify_result = await vk_auth_service.verify_token(token)
        
        if not verify_result.get("valid"):
            return {
                "is_connected": True,
                "vk_user_id": token_doc.get("vk_user_id"),
                "token_valid": False,
                "message": "Токен истёк, требуется повторная авторизация",
                "error": verify_result.get("error")
            }
        
        # Проверяем доступ к аудио
        audio_check = await vk_auth_service.test_audio_access(token)
        
        return {
            "is_connected": True,
            "vk_user_id": token_doc.get("vk_user_id"),
            "vk_user_info": {
                "first_name": verify_result.get("first_name"),
                "last_name": verify_result.get("last_name"),
                "photo": verify_result.get("photo")
            },
            "token_valid": True,
            "audio_access": audio_check.get("has_access", False),
            "audio_count": audio_check.get("audio_count", 0),
            "connected_at": token_doc.get("created_at").isoformat() if token_doc.get("created_at") else None
        }
        
    except Exception as e:
        logger.error(f"VK auth status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/music/auth/{telegram_id}")
async def vk_auth_disconnect(telegram_id: int):
    """
    Отключение VK аккаунта (удаление токена).
    """
    try:
        result = await db.user_vk_tokens.delete_one({"telegram_id": telegram_id})
        
        if result.deleted_count > 0:
            logger.info(f"VK token deleted for telegram_id: {telegram_id}")
            return {"success": True, "message": "VK аккаунт отключен"}
        else:
            return {"success": False, "message": "VK аккаунт не был подключен"}
            
    except Exception as e:
        logger.error(f"VK auth disconnect error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/music/my-vk/{telegram_id}")
async def get_my_vk_audio(telegram_id: int, count: int = 50, offset: int = 0):
    """
    Получение аудиозаписей пользователя с использованием его персонального токена.
    
    Использует персональный токен пользователя для доступа к его аудио.
    """
    try:
        # Получаем токен пользователя
        token_doc = await db.user_vk_tokens.find_one({"telegram_id": telegram_id})
        
        if not token_doc:
            raise HTTPException(
                status_code=401, 
                detail="VK аккаунт не подключен. Авторизуйтесь в разделе Музыка."
            )
        
        token = token_doc.get("vk_token")
        vk_user_id = token_doc.get("vk_user_id")
        user_agent = token_doc.get("user_agent", "KateMobileAndroid/93 lite-530")
        
        # Запрос к VK API (async)
        async with aiohttp.ClientSession() as session:
            async with session.get(
                "https://api.vk.com/method/audio.get",
                params={
                    "access_token": token,
                    "owner_id": vk_user_id,
                    "count": count,
                    "offset": offset,
                    "v": "5.131"
                },
                headers={"User-Agent": user_agent},
                timeout=aiohttp.ClientTimeout(total=15)
            ) as response:
                data = await response.json()
        
        if "error" in data:
            error = data["error"]
            error_code = error.get("error_code", 0)
            
            # Токен истёк
            if error_code in [5, 27]:
                raise HTTPException(
                    status_code=401,
                    detail="Токен истёк. Требуется повторная авторизация."
                )
            
            raise HTTPException(
                status_code=400,
                detail=error.get("error_msg", "VK API Error")
            )
        
        items = data.get("response", {}).get("items", [])
        total_count = data.get("response", {}).get("count", 0)
        
        # Форматируем треки
        tracks = []
        for item in items:
            cover_url = None
            album = item.get("album", {})
            if album:
                thumb = album.get("thumb", {})
                if thumb:
                    cover_url = thumb.get("photo_600") or thumb.get("photo_300")
            
            track_id = f"{item['owner_id']}_{item['id']}"
            direct_url = item.get("url", "")
            is_blocked = not direct_url or "audio_api_unavailable" in direct_url
            
            tracks.append({
                "id": track_id,
                "owner_id": item["owner_id"],
                "song_id": item["id"],
                "artist": item.get("artist", "Unknown"),
                "title": item.get("title", "Unknown"),
                "duration": item.get("duration", 0),
                "url": direct_url if not is_blocked else None,
                "cover": cover_url,
                "stream_url": f"/api/music/stream/{track_id}",
                "is_blocked": is_blocked
            })
        
        # Обогащаем обложками
        tracks = await music_service.enrich_tracks_with_covers(tracks)
        
        return {
            "tracks": tracks,
            "count": len(tracks),
            "total": total_count,
            "has_more": offset + len(tracks) < total_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get my VK audio error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# ============ API для совместного прослушивания музыки (Listening Rooms) ============

# Хранилище WebSocket соединений для комнат прослушивания
listening_room_connections: Dict[str, Dict[int, WebSocket]] = {}  # room_id -> {telegram_id -> websocket}


def calculate_actual_position(state: dict) -> float:
    """
    Рассчитывает актуальную позицию воспроизведения с учётом времени.
    
    Если музыка играет (is_playing=True), то актуальная позиция = 
    сохранённая позиция + время прошедшее с последнего обновления.
    
    Returns:
        Актуальная позиция в секундах
    """
    if not state:
        return 0
    
    position = state.get("position", 0)
    is_playing = state.get("is_playing", False)
    updated_at = state.get("updated_at")
    
    # Если не играет или нет времени обновления - возвращаем сохранённую позицию
    if not is_playing or not updated_at:
        return position
    
    # Рассчитываем время прошедшее с последнего обновления
    try:
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
        
        now = datetime.utcnow()
        if updated_at.tzinfo:
            now = datetime.utcnow().replace(tzinfo=updated_at.tzinfo)
        
        elapsed = (now - updated_at.replace(tzinfo=None) if updated_at.tzinfo else now - updated_at).total_seconds()
        
        # Ограничиваем elapsed чтобы не уходить слишком далеко (макс 30 секунд drift)
        elapsed = max(0, min(elapsed, 30))
        
        actual_position = position + elapsed
        
        # Ограничиваем позицию длительностью трека (если известна и валидна)
        current_track = state.get("current_track")
        if current_track:
            duration = current_track.get("duration")
            # Проверяем что duration валидный (больше 0)
            if duration and isinstance(duration, (int, float)) and duration > 0:
                actual_position = min(actual_position, duration)
        
        return actual_position
        
    except Exception as e:
        logger.warning(f"Error calculating actual position: {e}")
        return position


def get_state_with_actual_position(state: dict) -> dict:
    """
    Возвращает копию состояния с актуальной позицией воспроизведения.
    """
    if not state:
        return {}
    
    result = dict(state)
    result["position"] = calculate_actual_position(state)
    return result

@api_router.post("/music/rooms", response_model=CreateListeningRoomResponse)
async def create_listening_room(request: CreateListeningRoomRequest):
    """
    Создать комнату совместного прослушивания музыки.
    Улучшено: добавлены queue, history, initiated_by, max_participants
    """
    try:
        room_id = str(uuid.uuid4())
        invite_code = str(uuid.uuid4())[:8].upper()
        
        # Создаём хоста как первого участника
        host_participant = {
            "telegram_id": request.telegram_id,
            "first_name": request.first_name,
            "last_name": request.last_name,
            "username": request.username,
            "photo_url": request.photo_url,
            "joined_at": datetime.utcnow(),
            "can_control": True,
            "is_online": False  # Станет True при подключении к WebSocket
        }
        
        room_data = {
            "id": room_id,
            "invite_code": invite_code,
            "name": request.name,
            "host_id": request.telegram_id,
            "control_mode": request.control_mode.value,
            "allowed_controllers": [],
            "participants": [host_participant],
            "state": {
                "is_playing": False,
                "current_track": None,
                "position": 0,
                "updated_at": datetime.utcnow(),
                "initiated_by": None,
                "initiated_by_name": ""
            },
            "queue": [],  # Очередь треков
            "history": [],  # История последних 20 треков
            "created_at": datetime.utcnow(),
            "is_active": True,
            "max_participants": 50
        }
        
        await db.listening_rooms.insert_one(room_data)
        
        bot_username = get_telegram_bot_username()
        invite_link = f"https://t.me/{bot_username}/app?startapp=listen_{invite_code}"
        
        logger.info(f"🎵 Created listening room {room_id[:8]}... by user {request.telegram_id}")
        
        return CreateListeningRoomResponse(
            success=True,
            room_id=room_id,
            invite_code=invite_code,
            invite_link=invite_link,
            message="Комната создана!"
        )
        
    except Exception as e:
        logger.error(f"Create listening room error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/music/rooms/{room_id}", response_model=ListeningRoomResponse)
async def get_listening_room(room_id: str, telegram_id: int):
    """
    Получить информацию о комнате прослушивания.
    Улучшено: добавлен online_count, queue, history
    """
    try:
        room = await db.listening_rooms.find_one({"id": room_id, "is_active": True})
        
        if not room:
            raise HTTPException(status_code=404, detail="Комната не найдена")
        
        is_host = room["host_id"] == telegram_id
        
        # Определяем, может ли пользователь управлять воспроизведением
        can_control = False
        if room["control_mode"] == ListeningRoomControlMode.EVERYONE.value:
            can_control = True
        elif room["control_mode"] == ListeningRoomControlMode.HOST_ONLY.value:
            can_control = is_host
        elif room["control_mode"] == ListeningRoomControlMode.SELECTED.value:
            can_control = is_host or telegram_id in room.get("allowed_controllers", [])
        
        # Получаем актуальный online_count из WebSocket соединений
        online_count = len(listening_room_connections.get(room_id, {}))
        
        # Безопасное создание state с новыми полями
        state_data = room.get("state", {})
        state = ListeningRoomState(
            is_playing=state_data.get("is_playing", False),
            current_track=ListeningRoomTrack(**state_data["current_track"]) if state_data.get("current_track") else None,
            position=state_data.get("position", 0),
            updated_at=state_data.get("updated_at", datetime.utcnow()),
            initiated_by=state_data.get("initiated_by"),
            initiated_by_name=state_data.get("initiated_by_name", "")
        )
        
        # Конвертируем в Pydantic модель
        room_model = ListeningRoom(
            id=room["id"],
            invite_code=room["invite_code"],
            name=room["name"],
            host_id=room["host_id"],
            control_mode=ListeningRoomControlMode(room["control_mode"]),
            allowed_controllers=room.get("allowed_controllers", []),
            participants=[ListeningRoomParticipant(**p) for p in room["participants"]],
            state=state,
            queue=[ListeningRoomTrack(**t) for t in room.get("queue", [])],
            history=room.get("history", [])[:20],  # Последние 20 треков
            created_at=room["created_at"],
            is_active=room["is_active"],
            max_participants=room.get("max_participants", 50)
        )
        
        return ListeningRoomResponse(
            room=room_model,
            is_host=is_host,
            can_control=can_control,
            online_count=online_count
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get listening room error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/music/rooms/join/{invite_code}", response_model=JoinListeningRoomResponse)
async def join_listening_room_by_code(invite_code: str, request: JoinListeningRoomRequest):
    """
    Присоединиться к комнате по коду приглашения.
    Улучшено: проверка max_participants, is_online статус
    """
    try:
        room = await db.listening_rooms.find_one({
            "invite_code": invite_code.upper(),
            "is_active": True
        })
        
        if not room:
            return JoinListeningRoomResponse(
                success=False,
                message="Комната не найдена или уже закрыта"
            )
        
        # Проверяем лимит участников
        max_participants = room.get("max_participants", 50)
        if len(room["participants"]) >= max_participants:
            return JoinListeningRoomResponse(
                success=False,
                message=f"Комната заполнена (макс. {max_participants} участников)"
            )
        
        # Проверяем, не находится ли пользователь уже в комнате
        existing_participant = next(
            (p for p in room["participants"] if p["telegram_id"] == request.telegram_id),
            None
        )
        
        if existing_participant:
            # Уже в комнате - просто возвращаем её
            online_count = len(listening_room_connections.get(room["id"], {}))
            state_data = room.get("state", {})
            state = ListeningRoomState(
                is_playing=state_data.get("is_playing", False),
                current_track=ListeningRoomTrack(**state_data["current_track"]) if state_data.get("current_track") else None,
                position=state_data.get("position", 0),
                updated_at=state_data.get("updated_at", datetime.utcnow()),
                initiated_by=state_data.get("initiated_by"),
                initiated_by_name=state_data.get("initiated_by_name", "")
            )
            room_model = ListeningRoom(
                id=room["id"],
                invite_code=room["invite_code"],
                name=room["name"],
                host_id=room["host_id"],
                control_mode=ListeningRoomControlMode(room["control_mode"]),
                allowed_controllers=room.get("allowed_controllers", []),
                participants=[ListeningRoomParticipant(**p) for p in room["participants"]],
                state=state,
                queue=[ListeningRoomTrack(**t) for t in room.get("queue", [])],
                history=room.get("history", [])[:20],
                created_at=room["created_at"],
                is_active=room["is_active"],
                max_participants=max_participants
            )
            return JoinListeningRoomResponse(
                success=True,
                room=room_model,
                message="Вы уже в этой комнате"
            )
        
        # Определяем, может ли новый участник управлять
        can_control = room["control_mode"] == ListeningRoomControlMode.EVERYONE.value
        
        # Добавляем нового участника
        new_participant = {
            "telegram_id": request.telegram_id,
            "first_name": request.first_name,
            "last_name": request.last_name,
            "username": request.username,
            "photo_url": request.photo_url,
            "joined_at": datetime.utcnow(),
            "can_control": can_control,
            "is_online": False  # Станет True при подключении к WebSocket
        }
        
        await db.listening_rooms.update_one(
            {"id": room["id"]},
            {"$push": {"participants": new_participant}}
        )
        
        # Получаем обновлённую комнату
        room = await db.listening_rooms.find_one({"id": room["id"]})
        online_count = len(listening_room_connections.get(room["id"], {}))
        
        state_data = room.get("state", {})
        state = ListeningRoomState(
            is_playing=state_data.get("is_playing", False),
            current_track=ListeningRoomTrack(**state_data["current_track"]) if state_data.get("current_track") else None,
            position=state_data.get("position", 0),
            updated_at=state_data.get("updated_at", datetime.utcnow()),
            initiated_by=state_data.get("initiated_by"),
            initiated_by_name=state_data.get("initiated_by_name", "")
        )
        
        room_model = ListeningRoom(
            id=room["id"],
            invite_code=room["invite_code"],
            name=room["name"],
            host_id=room["host_id"],
            control_mode=ListeningRoomControlMode(room["control_mode"]),
            allowed_controllers=room.get("allowed_controllers", []),
            participants=[ListeningRoomParticipant(**p) for p in room["participants"]],
            state=state,
            queue=[ListeningRoomTrack(**t) for t in room.get("queue", [])],
            history=room.get("history", [])[:20],
            created_at=room["created_at"],
            is_active=room["is_active"],
            max_participants=room.get("max_participants", 50)
        )
        
        # Уведомляем других участников через WebSocket
        await broadcast_to_listening_room(room["id"], {
            "event": "user_joined",
            "user": new_participant,
            "participants_count": len(room["participants"]),
            "online_count": online_count
        }, exclude_user=request.telegram_id)
        
        logger.info(f"🎵 User {request.telegram_id} joined room {room['id'][:8]}...")
        
        return JoinListeningRoomResponse(
            success=True,
            room=room_model,
            message="Вы присоединились к комнате!"
        )
        
    except Exception as e:
        logger.error(f"Join listening room error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/music/rooms/{room_id}/leave")
async def leave_listening_room(room_id: str, telegram_id: int):
    """
    Выйти из комнаты прослушивания.
    """
    try:
        room = await db.listening_rooms.find_one({"id": room_id, "is_active": True})
        
        if not room:
            raise HTTPException(status_code=404, detail="Комната не найдена")
        
        # Если выходит хост - закрываем комнату
        if room["host_id"] == telegram_id:
            await db.listening_rooms.update_one(
                {"id": room_id},
                {"$set": {"is_active": False}}
            )
            
            # Уведомляем всех участников
            await broadcast_to_listening_room(room_id, {
                "event": "room_closed",
                "message": "Хост закрыл комнату"
            })
            
            # Закрываем все соединения
            if room_id in listening_room_connections:
                for ws in listening_room_connections[room_id].values():
                    try:
                        await ws.close()
                    except:
                        pass
                del listening_room_connections[room_id]
            
            logger.info(f"🎵 Room {room_id[:8]}... closed by host")
            return {"success": True, "message": "Комната закрыта"}
        
        # Удаляем участника
        await db.listening_rooms.update_one(
            {"id": room_id},
            {"$pull": {"participants": {"telegram_id": telegram_id}}}
        )
        
        # Удаляем WebSocket соединение
        if room_id in listening_room_connections and telegram_id in listening_room_connections[room_id]:
            try:
                await listening_room_connections[room_id][telegram_id].close()
            except:
                pass
            del listening_room_connections[room_id][telegram_id]
        
        # Уведомляем других
        await broadcast_to_listening_room(room_id, {
            "event": "user_left",
            "telegram_id": telegram_id
        })
        
        logger.info(f"🎵 User {telegram_id} left room {room_id[:8]}...")
        return {"success": True, "message": "Вы вышли из комнаты"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Leave listening room error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/music/rooms/{room_id}")
async def delete_listening_room(room_id: str, telegram_id: int):
    """
    Удалить комнату (только для хоста).
    """
    try:
        room = await db.listening_rooms.find_one({"id": room_id})
        
        if not room:
            raise HTTPException(status_code=404, detail="Комната не найдена")
        
        if room["host_id"] != telegram_id:
            raise HTTPException(status_code=403, detail="Только хост может удалить комнату")
        
        await db.listening_rooms.update_one(
            {"id": room_id},
            {"$set": {"is_active": False}}
        )
        
        # Уведомляем всех и закрываем соединения
        await broadcast_to_listening_room(room_id, {
            "event": "room_closed",
            "message": "Комната закрыта хостом"
        })
        
        if room_id in listening_room_connections:
            for ws in listening_room_connections[room_id].values():
                try:
                    await ws.close()
                except:
                    pass
            del listening_room_connections[room_id]
        
        logger.info(f"🎵 Room {room_id[:8]}... deleted")
        return {"success": True, "message": "Комната удалена"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete listening room error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/music/rooms/{room_id}/settings")
async def update_listening_room_settings(
    room_id: str, 
    telegram_id: int,
    request: UpdateListeningRoomSettingsRequest
):
    """
    Изменить настройки комнаты (только для хоста).
    """
    try:
        room = await db.listening_rooms.find_one({"id": room_id, "is_active": True})
        
        if not room:
            raise HTTPException(status_code=404, detail="Комната не найдена")
        
        if room["host_id"] != telegram_id:
            raise HTTPException(status_code=403, detail="Только хост может изменять настройки")
        
        update_data = {}
        if request.name is not None:
            update_data["name"] = request.name
        if request.control_mode is not None:
            update_data["control_mode"] = request.control_mode.value
        if request.allowed_controllers is not None:
            update_data["allowed_controllers"] = request.allowed_controllers
        
        if update_data:
            await db.listening_rooms.update_one(
                {"id": room_id},
                {"$set": update_data}
            )
            
            # Уведомляем участников об изменении настроек
            await broadcast_to_listening_room(room_id, {
                "event": "settings_changed",
                "settings": update_data
            })
        
        return {"success": True, "message": "Настройки обновлены"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update listening room settings error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/music/rooms/user/{telegram_id}")
async def get_user_listening_rooms(telegram_id: int):
    """
    Получить активные комнаты пользователя.
    """
    try:
        # Комнаты где пользователь является участником
        cursor = db.listening_rooms.find({
            "participants.telegram_id": telegram_id,
            "is_active": True
        })
        
        rooms = await cursor.to_list(length=50)
        
        result = []
        for room in rooms:
            # Получаем актуальный online_count из WebSocket соединений
            room_online_count = len(listening_room_connections.get(room["id"], {}))
            
            result.append({
                "id": room["id"],
                "name": room["name"],
                "invite_code": room["invite_code"],
                "host_id": room["host_id"],
                "is_host": room["host_id"] == telegram_id,
                "participants_count": len(room["participants"]),
                "online_count": room_online_count,  # Актуальное количество онлайн
                "is_playing": room.get("state", {}).get("is_playing", False),
                "current_track": room.get("state", {}).get("current_track"),
                "created_at": room["created_at"]
            })
        
        return {"rooms": result, "count": len(result)}
        
    except Exception as e:
        logger.error(f"Get user listening rooms error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/music/rooms/{room_id}/state")
async def get_listening_room_state(room_id: str):
    """
    Получить текущее состояние комнаты (для HTTP polling).
    Используется как fallback когда WebSocket недоступен.
    Возвращает актуальную позицию с учётом времени прошедшего с последнего обновления.
    """
    try:
        room = await db.listening_rooms.find_one({"id": room_id, "is_active": True})
        
        if not room:
            raise HTTPException(status_code=404, detail="Комната не найдена")
        
        state = room.get("state", {})
        
        # Рассчитываем актуальную позицию
        actual_position = calculate_actual_position(state)
        
        return {
            "is_playing": state.get("is_playing", False),
            "current_track": state.get("current_track"),
            "position": actual_position,
            "updated_at": state.get("updated_at").isoformat() if state.get("updated_at") else None,
            "participants_count": len(room.get("participants", []))
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get listening room state error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/music/rooms/{room_id}/sync")
async def sync_listening_room_state(
    room_id: str, 
    telegram_id: int = Query(...),
    event: str = Query(...),
    position: float = Query(0),
    request: Request = None
):
    """
    Синхронизировать состояние комнаты через HTTP (fallback для WebSocket).
    Track передаётся в body как JSON.
    """
    try:
        # Получаем track из body
        track = None
        if request:
            try:
                body = await request.json()
                if body and isinstance(body, dict) and body.get('id'):
                    track = body
            except:
                pass
        
        room = await db.listening_rooms.find_one({"id": room_id, "is_active": True})
        
        if not room:
            raise HTTPException(status_code=404, detail="Комната не найдена")
        
        # Проверяем права на управление
        can_control = False
        if room["control_mode"] == ListeningRoomControlMode.EVERYONE.value:
            can_control = True
        elif room["control_mode"] == ListeningRoomControlMode.HOST_ONLY.value:
            can_control = room["host_id"] == telegram_id
        elif room["control_mode"] == ListeningRoomControlMode.SELECTED.value:
            can_control = room["host_id"] == telegram_id or telegram_id in room.get("allowed_controllers", [])
        
        if event in ["play", "pause", "seek", "track_change"] and not can_control:
            raise HTTPException(status_code=403, detail="У вас нет прав на управление воспроизведением")
        
        # Обновляем состояние
        state_update = {"state.updated_at": datetime.utcnow()}
        
        if event == "play":
            state_update["state.is_playing"] = True
            state_update["state.position"] = position
            if track:
                state_update["state.current_track"] = track
        elif event == "pause":
            state_update["state.is_playing"] = False
            state_update["state.position"] = position
        elif event == "seek":
            state_update["state.position"] = position
        elif event == "track_change":
            if track:
                state_update["state.current_track"] = track
                state_update["state.position"] = 0
                state_update["state.is_playing"] = True
        
        await db.listening_rooms.update_one(
            {"id": room_id},
            {"$set": state_update}
        )
        
        logger.info(f"🎵 Room {room_id[:8]}... sync: {event} by {telegram_id}")
        
        # Отправляем через WebSocket тем, кто подключен
        await broadcast_to_listening_room(room_id, {
            "event": event,
            "track": track,
            "position": position,
            "triggered_by": telegram_id,
            "timestamp": datetime.utcnow().isoformat()
        }, exclude_user=telegram_id)
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Sync listening room state error: {e}")
        raise HTTPException(status_code=500, detail=str(e))




def serialize_for_json(obj):
    """
    Рекурсивно конвертирует datetime объекты в ISO строки для JSON сериализации.
    """
    if isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {k: serialize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [serialize_for_json(item) for item in obj]
    return obj


async def broadcast_to_listening_room(room_id: str, message: dict, exclude_user: int = None):
    """
    Отправить сообщение всем участникам комнаты через WebSocket.
    """
    if room_id not in listening_room_connections:
        return
    
    # Сериализуем сообщение для JSON
    serialized_message = serialize_for_json(message)
    
    disconnected = []
    for user_id, ws in listening_room_connections[room_id].items():
        if exclude_user and user_id == exclude_user:
            continue
        try:
            await ws.send_json(serialized_message)
        except:
            disconnected.append(user_id)
    
    # Удаляем отключённые соединения
    for user_id in disconnected:
        del listening_room_connections[room_id][user_id]


@app.websocket("/api/ws/listening-room/{room_id}/{telegram_id}")
async def listening_room_websocket(websocket: WebSocket, room_id: str, telegram_id: int):
    """
    WebSocket для синхронизации воспроизведения в комнате.
    """
    await websocket.accept()
    
    # Проверяем существование комнаты
    room = await db.listening_rooms.find_one({"id": room_id, "is_active": True})
    if not room:
        await websocket.send_json({"event": "error", "message": "Комната не найдена"})
        await websocket.close()
        return
    
    # Проверяем, что пользователь является участником
    is_participant = any(p["telegram_id"] == telegram_id for p in room["participants"])
    if not is_participant:
        await websocket.send_json({"event": "error", "message": "Вы не являетесь участником комнаты"})
        await websocket.close()
        return
    
    # Определяем права на управление
    can_control = False
    if room["control_mode"] == ListeningRoomControlMode.EVERYONE.value:
        can_control = True
    elif room["control_mode"] == ListeningRoomControlMode.HOST_ONLY.value:
        can_control = room["host_id"] == telegram_id
    elif room["control_mode"] == ListeningRoomControlMode.SELECTED.value:
        can_control = room["host_id"] == telegram_id or telegram_id in room.get("allowed_controllers", [])
    
    # Сохраняем соединение
    if room_id not in listening_room_connections:
        listening_room_connections[room_id] = {}
    listening_room_connections[room_id][telegram_id] = websocket
    
    # Обновляем is_online статус в БД
    await db.listening_rooms.update_one(
        {"id": room_id, "participants.telegram_id": telegram_id},
        {"$set": {"participants.$.is_online": True}}
    )
    
    # Получаем актуальное количество онлайн
    online_count = len(listening_room_connections[room_id])
    
    # Отправляем текущее состояние новому участнику
    # Рассчитываем актуальную позицию с учётом времени прошедшего с последнего обновления
    # Это важно для синхронизации - новый участник должен начать с той же позиции что и остальные
    state_with_actual_position = get_state_with_actual_position(room.get("state", {}))
    
    # Сериализуем state для JSON (datetime -> ISO string)
    await websocket.send_json({
        "event": "connected",
        "room_id": room_id,
        "can_control": can_control,
        "state": serialize_for_json(state_with_actual_position),
        "queue": room.get("queue", []),
        "history": serialize_for_json(room.get("history", [])[:10]),  # Последние 10 треков
        "online_count": online_count
    })
    
    # Уведомляем остальных участников о новом подключении с актуальным online_count
    await broadcast_to_listening_room(room_id, {
        "event": "user_connected",
        "telegram_id": telegram_id,
        "online_count": online_count
    }, exclude_user=telegram_id)
    
    logger.info(f"🎵 WebSocket connected: user {telegram_id} to room {room_id[:8]}... (online: {online_count})")
    
    try:
        while True:
            data = await websocket.receive_json()
            event = data.get("event")
            
            # Проверяем права на управление для событий воспроизведения
            control_events = ["play", "pause", "seek", "track_change", "queue_add", "queue_remove", "queue_clear"]
            if event in control_events and not can_control:
                await websocket.send_json({
                    "event": "error",
                    "message": "У вас нет прав на управление воспроизведением"
                })
                continue
            
            # Получаем имя пользователя для initiated_by
            participant = next((p for p in room["participants"] if p["telegram_id"] == telegram_id), None)
            user_name = f"{participant.get('first_name', '')} {participant.get('last_name', '')}".strip() if participant else ""
            
            if event == "play":
                # Воспроизведение
                track_data = data.get("track")
                position = data.get("position", 0)
                
                state_update = {
                    "state.is_playing": True,
                    "state.position": position,
                    "state.updated_at": datetime.utcnow(),
                    "state.initiated_by": telegram_id,
                    "state.initiated_by_name": user_name
                }
                if track_data:
                    state_update["state.current_track"] = track_data
                
                await db.listening_rooms.update_one(
                    {"id": room_id},
                    {"$set": state_update}
                )
                
                # Отправляем всем участникам
                await broadcast_to_listening_room(room_id, {
                    "event": "play",
                    "track": track_data,
                    "position": position,
                    "triggered_by": telegram_id,
                    "triggered_by_name": user_name,
                    "timestamp": datetime.utcnow().isoformat()
                }, exclude_user=telegram_id)
                
            elif event == "pause":
                # Пауза
                position = data.get("position", 0)
                
                await db.listening_rooms.update_one(
                    {"id": room_id},
                    {"$set": {
                        "state.is_playing": False,
                        "state.position": position,
                        "state.updated_at": datetime.utcnow()
                    }}
                )
                
                await broadcast_to_listening_room(room_id, {
                    "event": "pause",
                    "position": position,
                    "triggered_by": telegram_id,
                    "triggered_by_name": user_name,
                    "timestamp": datetime.utcnow().isoformat()
                }, exclude_user=telegram_id)
                
            elif event == "seek":
                # Перемотка
                position = data.get("position", 0)
                
                await db.listening_rooms.update_one(
                    {"id": room_id},
                    {"$set": {
                        "state.position": position,
                        "state.updated_at": datetime.utcnow()
                    }}
                )
                
                await broadcast_to_listening_room(room_id, {
                    "event": "seek",
                    "position": position,
                    "triggered_by": telegram_id,
                    "timestamp": datetime.utcnow().isoformat()
                }, exclude_user=telegram_id)
                
            elif event == "track_change":
                # Смена трека - добавляем в историю
                track_data = data.get("track")
                
                # Создаём запись для истории
                history_item = {
                    "track": track_data,
                    "played_by": telegram_id,
                    "played_by_name": user_name,
                    "played_at": datetime.utcnow()
                }
                
                # Обновляем состояние и добавляем в историю (максимум 20 записей)
                await db.listening_rooms.update_one(
                    {"id": room_id},
                    {
                        "$set": {
                            "state.current_track": track_data,
                            "state.position": 0,
                            "state.is_playing": True,
                            "state.updated_at": datetime.utcnow(),
                            "state.initiated_by": telegram_id,
                            "state.initiated_by_name": user_name
                        },
                        "$push": {
                            "history": {
                                "$each": [history_item],
                                "$position": 0,
                                "$slice": 20  # Храним только последние 20 треков
                            }
                        }
                    }
                )
                
                await broadcast_to_listening_room(room_id, {
                    "event": "track_change",
                    "track": track_data,
                    "triggered_by": telegram_id,
                    "triggered_by_name": user_name,
                    "timestamp": datetime.utcnow().isoformat()
                }, exclude_user=telegram_id)
            
            elif event == "queue_add":
                # Добавить трек в очередь
                track_data = data.get("track")
                if track_data:
                    await db.listening_rooms.update_one(
                        {"id": room_id},
                        {"$push": {"queue": track_data}}
                    )
                    
                    # Получаем обновлённую очередь
                    room = await db.listening_rooms.find_one({"id": room_id})
                    queue = room.get("queue", [])
                    
                    await broadcast_to_listening_room(room_id, {
                        "event": "queue_updated",
                        "queue": queue,
                        "action": "add",
                        "track": track_data,
                        "triggered_by": telegram_id,
                        "triggered_by_name": user_name
                    })
            
            elif event == "queue_remove":
                # Удалить трек из очереди по индексу
                track_index = data.get("index", -1)
                if track_index >= 0:
                    room = await db.listening_rooms.find_one({"id": room_id})
                    queue = room.get("queue", [])
                    if 0 <= track_index < len(queue):
                        removed_track = queue.pop(track_index)
                        await db.listening_rooms.update_one(
                            {"id": room_id},
                            {"$set": {"queue": queue}}
                        )
                        
                        await broadcast_to_listening_room(room_id, {
                            "event": "queue_updated",
                            "queue": queue,
                            "action": "remove",
                            "track": removed_track,
                            "triggered_by": telegram_id
                        })
            
            elif event == "queue_clear":
                # Очистить очередь
                await db.listening_rooms.update_one(
                    {"id": room_id},
                    {"$set": {"queue": []}}
                )
                
                await broadcast_to_listening_room(room_id, {
                    "event": "queue_updated",
                    "queue": [],
                    "action": "clear",
                    "triggered_by": telegram_id
                })
            
            elif event == "queue_play_next":
                # Воспроизвести следующий трек из очереди
                room = await db.listening_rooms.find_one({"id": room_id})
                queue = room.get("queue", [])
                if queue:
                    next_track = queue.pop(0)
                    
                    # Добавляем в историю
                    history_item = {
                        "track": next_track,
                        "played_by": telegram_id,
                        "played_by_name": user_name,
                        "played_at": datetime.utcnow()
                    }
                    
                    await db.listening_rooms.update_one(
                        {"id": room_id},
                        {
                            "$set": {
                                "queue": queue,
                                "state.current_track": next_track,
                                "state.position": 0,
                                "state.is_playing": True,
                                "state.updated_at": datetime.utcnow(),
                                "state.initiated_by": telegram_id,
                                "state.initiated_by_name": user_name
                            },
                            "$push": {
                                "history": {
                                    "$each": [history_item],
                                    "$position": 0,
                                    "$slice": 20
                                }
                            }
                        }
                    )
                    
                    await broadcast_to_listening_room(room_id, {
                        "event": "track_change",
                        "track": next_track,
                        "triggered_by": telegram_id,
                        "triggered_by_name": user_name,
                        "from_queue": True,
                        "timestamp": datetime.utcnow().isoformat()
                    })
                    
                    await broadcast_to_listening_room(room_id, {
                        "event": "queue_updated",
                        "queue": queue,
                        "action": "play_next"
                    })
                
            elif event == "sync_request":
                # Запрос синхронизации состояния - проверяем что пользователь участник
                room = await db.listening_rooms.find_one({"id": room_id})
                if room:
                    is_participant = any(p["telegram_id"] == telegram_id for p in room["participants"])
                    if not is_participant:
                        await websocket.send_json({
                            "event": "error",
                            "message": "Вы не являетесь участником комнаты"
                        })
                        continue
                    
                    state_with_actual_position = get_state_with_actual_position(room.get("state", {}))
                    await websocket.send_json({
                        "event": "sync_state",
                        "state": serialize_for_json(state_with_actual_position),
                        "queue": room.get("queue", []),
                        "history": serialize_for_json(room.get("history", [])[:10])  # Последние 10
                    })
                    
            elif event == "ping":
                await websocket.send_json({"event": "pong"})
                
    except WebSocketDisconnect:
        logger.info(f"🎵 WebSocket disconnected: user {telegram_id} from room {room_id[:8]}...")
    except Exception as e:
        logger.error(f"Listening room WebSocket error: {e}")
    finally:
        # Удаляем соединение и обновляем статус участника
        if room_id in listening_room_connections and telegram_id in listening_room_connections[room_id]:
            del listening_room_connections[room_id][telegram_id]
            
            # Обновляем is_online статус в БД
            try:
                await db.listening_rooms.update_one(
                    {"id": room_id, "participants.telegram_id": telegram_id},
                    {"$set": {"participants.$.is_online": False}}
                )
            except Exception as e:
                logger.warning(f"Failed to update participant online status: {e}")
            
            # Получаем актуальное количество онлайн
            online_count = len(listening_room_connections.get(room_id, {}))
            
            # Уведомляем остальных об отключении и актуальном online_count
            try:
                await broadcast_to_listening_room(room_id, {
                    "event": "user_disconnected",
                    "telegram_id": telegram_id,
                    "online_count": online_count
                })
            except Exception as e:
                logger.warning(f"Failed to broadcast disconnect: {e}")


# ============ API для очереди и истории Listening Room ============

@api_router.get("/music/rooms/{room_id}/queue")
async def get_listening_room_queue(room_id: str, telegram_id: int):
    """Получить очередь треков комнаты"""
    try:
        room = await db.listening_rooms.find_one({"id": room_id, "is_active": True})
        if not room:
            raise HTTPException(status_code=404, detail="Комната не найдена")
        
        # Проверяем что пользователь участник
        is_participant = any(p["telegram_id"] == telegram_id for p in room["participants"])
        if not is_participant:
            raise HTTPException(status_code=403, detail="Вы не являетесь участником комнаты")
        
        return {
            "queue": room.get("queue", []),
            "count": len(room.get("queue", []))
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get queue error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/music/rooms/{room_id}/history")
async def get_listening_room_history(room_id: str, telegram_id: int, limit: int = 20):
    """Получить историю прослушивания комнаты"""
    try:
        room = await db.listening_rooms.find_one({"id": room_id, "is_active": True})
        if not room:
            raise HTTPException(status_code=404, detail="Комната не найдена")
        
        # Проверяем что пользователь участник
        is_participant = any(p["telegram_id"] == telegram_id for p in room["participants"])
        if not is_participant:
            raise HTTPException(status_code=403, detail="Вы не являетесь участником комнаты")
        
        history = room.get("history", [])[:limit]
        
        return {
            "history": serialize_for_json(history),
            "count": len(history)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/music/rooms/{room_id}/queue/add")
async def add_to_listening_room_queue(room_id: str, telegram_id: int, track: dict):
    """Добавить трек в очередь комнаты (HTTP fallback)"""
    try:
        room = await db.listening_rooms.find_one({"id": room_id, "is_active": True})
        if not room:
            raise HTTPException(status_code=404, detail="Комната не найдена")
        
        # Проверяем права
        can_control = False
        if room["control_mode"] == ListeningRoomControlMode.EVERYONE.value:
            can_control = True
        elif room["control_mode"] == ListeningRoomControlMode.HOST_ONLY.value:
            can_control = room["host_id"] == telegram_id
        elif room["control_mode"] == ListeningRoomControlMode.SELECTED.value:
            can_control = room["host_id"] == telegram_id or telegram_id in room.get("allowed_controllers", [])
        
        if not can_control:
            raise HTTPException(status_code=403, detail="У вас нет прав на управление")
        
        await db.listening_rooms.update_one(
            {"id": room_id},
            {"$push": {"queue": track}}
        )
        
        # Уведомляем участников
        participant = next((p for p in room["participants"] if p["telegram_id"] == telegram_id), None)
        user_name = f"{participant.get('first_name', '')} {participant.get('last_name', '')}".strip() if participant else ""
        
        room = await db.listening_rooms.find_one({"id": room_id})
        await broadcast_to_listening_room(room_id, {
            "event": "queue_updated",
            "queue": room.get("queue", []),
            "action": "add",
            "track": track,
            "triggered_by": telegram_id,
            "triggered_by_name": user_name
        })
        
        return {"success": True, "queue_length": len(room.get("queue", []))}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add to queue error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ API для системы друзей (Friends) ============

# Вспомогательные функции для друзей

async def get_user_friends_count(telegram_id: int) -> int:
    """Получить количество друзей пользователя"""
    return await db.friends.count_documents({"user_telegram_id": telegram_id})


async def get_mutual_friends_count(user1_id: int, user2_id: int) -> int:
    """Получить количество общих друзей двух пользователей (оптимизировано через aggregation)"""
    try:
        pipeline = [
            {"$match": {"user_telegram_id": user1_id}},
            {"$lookup": {
                "from": "friends",
                "let": {"friend_id": "$friend_telegram_id"},
                "pipeline": [
                    {"$match": {
                        "$expr": {
                            "$and": [
                                {"$eq": ["$user_telegram_id", user2_id]},
                                {"$eq": ["$friend_telegram_id", "$$friend_id"]}
                            ]
                        }
                    }}
                ],
                "as": "mutual"
            }},
            {"$match": {"mutual": {"$ne": []}}},
            {"$count": "total"}
        ]
        result = await db.friends.aggregate(pipeline).to_list(1)
        return result[0]["total"] if result else 0
    except Exception:
        # Fallback к простому методу
        friends1 = await db.friends.find({"user_telegram_id": user1_id}).to_list(1000)
        friends1_ids = set(f["friend_telegram_id"] for f in friends1)
        friends2 = await db.friends.find({"user_telegram_id": user2_id}).to_list(1000)
        friends2_ids = set(f["friend_telegram_id"] for f in friends2)
        return len(friends1_ids & friends2_ids)


async def get_mutual_friends_count_batch(user_id: int, target_ids: list) -> dict:
    """Batch-подсчёт общих друзей для списка пользователей"""
    if not target_ids:
        return {}
    
    my_friends = await db.friends.find({"user_telegram_id": user_id}).to_list(1000)
    my_friend_ids = set(f["friend_telegram_id"] for f in my_friends)
    
    result = {}
    for tid in target_ids:
        their_friends = await db.friends.find({"user_telegram_id": tid}).to_list(1000)
        their_ids = set(f["friend_telegram_id"] for f in their_friends)
        result[tid] = len(my_friend_ids & their_ids)
    return result


async def is_blocked(blocker_id: int, blocked_id: int) -> bool:
    """Проверить, заблокирован ли пользователь"""
    block = await db.user_blocks.find_one({
        "blocker_telegram_id": blocker_id,
        "blocked_telegram_id": blocked_id
    })
    return block is not None


async def are_friends(user1_id: int, user2_id: int) -> bool:
    """Проверить, являются ли пользователи друзьями"""
    friend = await db.friends.find_one({
        "user_telegram_id": user1_id,
        "friend_telegram_id": user2_id
    })
    return friend is not None


async def get_friendship_status(user_id: int, target_id: int) -> Optional[str]:
    """Получить статус дружбы между пользователями"""
    # Проверка блокировки
    if await is_blocked(user_id, target_id):
        return "blocked"
    if await is_blocked(target_id, user_id):
        return "blocked_by"
    
    # Проверка дружбы
    if await are_friends(user_id, target_id):
        return "friend"
    
    # Проверка входящих запросов
    incoming = await db.friend_requests.find_one({
        "from_telegram_id": target_id,
        "to_telegram_id": user_id,
        "status": "pending"
    })
    if incoming:
        return "pending_incoming"
    
    # Проверка исходящих запросов
    outgoing = await db.friend_requests.find_one({
        "from_telegram_id": user_id,
        "to_telegram_id": target_id,
        "status": "pending"
    })
    if outgoing:
        return "pending_outgoing"
    
    return None


async def get_user_privacy_settings(telegram_id: int) -> PrivacySettings:
    """Получить настройки приватности пользователя"""
    user = await db.user_settings.find_one({"telegram_id": telegram_id})
    if user and "privacy_settings" in user:
        return PrivacySettings(**user["privacy_settings"])
    return PrivacySettings()  # Возвращаем настройки по умолчанию


async def build_friend_card(user_data: dict, current_user_id: int, friendship_date: datetime = None, is_favorite: bool = False) -> FriendCard:
    """Построить карточку друга"""
    friend_id = user_data.get("telegram_id")
    privacy = await get_user_privacy_settings(friend_id)
    
    # Проверяем онлайн-статус (активность за последние 5 минут)
    is_online = False
    last_activity = user_data.get("last_activity")
    if last_activity and privacy.show_online_status:
        if isinstance(last_activity, str):
            last_activity = datetime.fromisoformat(last_activity.replace('Z', '+00:00'))
        is_online = (datetime.utcnow() - last_activity).total_seconds() < 300
    
    return FriendCard(
        telegram_id=friend_id,
        username=user_data.get("username"),
        first_name=user_data.get("first_name"),
        last_name=user_data.get("last_name"),
        group_name=user_data.get("group_name"),
        facultet_name=user_data.get("facultet_name"),
        is_online=is_online if privacy.show_online_status else False,
        last_activity=last_activity if privacy.show_online_status else None,
        is_favorite=is_favorite,
        mutual_friends_count=await get_mutual_friends_count(current_user_id, friend_id),
        friendship_date=friendship_date
    )


async def update_friends_stats(telegram_id: int):
    """Обновить статистику друзей пользователя"""
    # Подсчитываем друзей
    friends_count = await get_user_friends_count(telegram_id)
    
    # Подсчитываем уникальные факультеты друзей
    friends = await db.friends.find({"user_telegram_id": telegram_id}).to_list(1000)
    friend_ids = [f["friend_telegram_id"] for f in friends]
    
    faculties = set()
    if friend_ids:
        friend_users = await db.user_settings.find({"telegram_id": {"$in": friend_ids}}).to_list(1000)
        for u in friend_users:
            if u.get("facultet_id"):
                faculties.add(u["facultet_id"])
    
    # Обновляем статистику
    await db.user_stats.update_one(
        {"telegram_id": telegram_id},
        {
            "$set": {
                "friends_count": friends_count,
                "friends_faculties_count": len(faculties),
                "updated_at": datetime.utcnow()
            }
        },
        upsert=True
    )


# API Endpoints для друзей

@api_router.post("/friends/request/{target_telegram_id}", response_model=FriendActionResponse)
async def send_friend_request(target_telegram_id: int, telegram_id: int = Body(..., embed=True)):
    """Отправить запрос на дружбу"""
    try:
        # Проверяем, что не отправляем запрос самому себе
        if telegram_id == target_telegram_id:
            raise HTTPException(status_code=400, detail="Нельзя добавить себя в друзья")
        
        # Проверяем существование целевого пользователя
        target_user = await db.user_settings.find_one({"telegram_id": target_telegram_id})
        if not target_user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Проверяем блокировку
        if await is_blocked(target_telegram_id, telegram_id):
            raise HTTPException(status_code=403, detail="Вы заблокированы этим пользователем")
        if await is_blocked(telegram_id, target_telegram_id):
            raise HTTPException(status_code=403, detail="Вы заблокировали этого пользователя")
        
        # Проверяем, не друзья ли уже
        if await are_friends(telegram_id, target_telegram_id):
            raise HTTPException(status_code=400, detail="Вы уже друзья")
        
        # Проверяем существующий запрос от нас
        existing_outgoing = await db.friend_requests.find_one({
            "from_telegram_id": telegram_id,
            "to_telegram_id": target_telegram_id,
            "status": "pending"
        })
        if existing_outgoing:
            raise HTTPException(status_code=400, detail="Запрос уже отправлен")
        
        # Проверяем входящий запрос от этого пользователя
        existing_incoming = await db.friend_requests.find_one({
            "from_telegram_id": target_telegram_id,
            "to_telegram_id": telegram_id,
            "status": "pending"
        })
        
        if existing_incoming:
            # Автоматически принимаем - взаимный запрос
            await db.friend_requests.update_one(
                {"id": existing_incoming["id"]},
                {"$set": {"status": "accepted", "updated_at": datetime.utcnow()}}
            )
            
            # Создаем связи дружбы
            friend1 = Friend(
                user_telegram_id=telegram_id,
                friend_telegram_id=target_telegram_id
            )
            friend2 = Friend(
                user_telegram_id=target_telegram_id,
                friend_telegram_id=telegram_id
            )
            await db.friends.insert_many([friend1.dict(), friend2.dict()])
            
            # Обновляем статистику
            await update_friends_stats(telegram_id)
            await update_friends_stats(target_telegram_id)
            
            # Проверяем достижения
            from achievements import check_and_award_achievements, get_or_create_user_stats
            stats = await get_or_create_user_stats(db, telegram_id)
            await check_and_award_achievements(db, telegram_id, stats)
            
            friend_card = await build_friend_card(target_user, telegram_id, datetime.utcnow())
            return FriendActionResponse(
                success=True,
                message="Запрос принят, вы теперь друзья!",
                friend=friend_card
            )
        
        # Создаем новый запрос
        request = FriendRequest(
            from_telegram_id=telegram_id,
            to_telegram_id=target_telegram_id
        )
        await db.friend_requests.insert_one(request.dict())
        
        # Отправляем уведомление получателю
        sender_user = await db.user_settings.find_one({"telegram_id": telegram_id})
        if sender_user:
            await notify_friend_request(target_telegram_id, sender_user, request.id)
        
        logger.info(f"👥 Friend request sent: {telegram_id} -> {target_telegram_id}")
        return FriendActionResponse(
            success=True,
            message="Запрос на дружбу отправлен"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Send friend request error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/friends/accept/{request_id}", response_model=FriendActionResponse)
async def accept_friend_request(request_id: str, telegram_id: int = Body(..., embed=True)):
    """Принять запрос на дружбу"""
    try:
        # Находим запрос
        request = await db.friend_requests.find_one({"id": request_id, "status": "pending"})
        if not request:
            raise HTTPException(status_code=404, detail="Запрос не найден")
        
        # Проверяем, что запрос адресован нам
        if request["to_telegram_id"] != telegram_id:
            raise HTTPException(status_code=403, detail="Это не ваш запрос")
        
        # Обновляем статус запроса
        await db.friend_requests.update_one(
            {"id": request_id},
            {"$set": {"status": "accepted", "updated_at": datetime.utcnow()}}
        )
        
        from_id = request["from_telegram_id"]
        
        # Создаем связи дружбы (двусторонние)
        friend1 = Friend(
            user_telegram_id=telegram_id,
            friend_telegram_id=from_id
        )
        friend2 = Friend(
            user_telegram_id=from_id,
            friend_telegram_id=telegram_id
        )
        await db.friends.insert_many([friend1.dict(), friend2.dict()])
        
        # Обновляем статистику обоих
        await update_friends_stats(telegram_id)
        await update_friends_stats(from_id)
        
        # Проверяем достижения для обоих
        from achievements import check_and_award_achievements, get_or_create_user_stats
        for user_id in [telegram_id, from_id]:
            stats = await get_or_create_user_stats(db, user_id)
            await check_and_award_achievements(db, user_id, stats)
        
        # Получаем данные нового друга
        friend_user = await db.user_settings.find_one({"telegram_id": from_id})
        friend_card = await build_friend_card(friend_user, telegram_id, datetime.utcnow()) if friend_user else None
        
        # Отправляем уведомление отправителю заявки
        accepter_user = await db.user_settings.find_one({"telegram_id": telegram_id})
        if accepter_user:
            await notify_friend_accepted(from_id, accepter_user)
        
        logger.info(f"👥 Friend request accepted: {from_id} <-> {telegram_id}")
        return FriendActionResponse(
            success=True,
            message="Запрос принят, вы теперь друзья!",
            friend=friend_card
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Accept friend request error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/friends/reject/{request_id}", response_model=FriendActionResponse)
async def reject_friend_request(request_id: str, telegram_id: int = Body(..., embed=True)):
    """Отклонить запрос на дружбу"""
    try:
        # Находим запрос
        request = await db.friend_requests.find_one({"id": request_id, "status": "pending"})
        if not request:
            raise HTTPException(status_code=404, detail="Запрос не найден")
        
        # Проверяем, что запрос адресован нам
        if request["to_telegram_id"] != telegram_id:
            raise HTTPException(status_code=403, detail="Это не ваш запрос")
        
        # Обновляем статус запроса
        await db.friend_requests.update_one(
            {"id": request_id},
            {"$set": {"status": "rejected", "updated_at": datetime.utcnow()}}
        )
        
        logger.info(f"👥 Friend request rejected: {request['from_telegram_id']} -> {telegram_id}")
        return FriendActionResponse(
            success=True,
            message="Запрос отклонен"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reject friend request error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/friends/cancel/{request_id}", response_model=FriendActionResponse)
async def cancel_friend_request(request_id: str, telegram_id: int = Body(..., embed=True)):
    """Отменить отправленный запрос на дружбу"""
    try:
        # Находим запрос
        request = await db.friend_requests.find_one({"id": request_id, "status": "pending"})
        if not request:
            raise HTTPException(status_code=404, detail="Запрос не найден")
        
        # Проверяем, что запрос от нас
        if request["from_telegram_id"] != telegram_id:
            raise HTTPException(status_code=403, detail="Это не ваш запрос")
        
        # Удаляем запрос
        await db.friend_requests.delete_one({"id": request_id})
        
        logger.info(f"👥 Friend request cancelled: {telegram_id} -> {request['to_telegram_id']}")
        return FriendActionResponse(
            success=True,
            message="Запрос отменен"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cancel friend request error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/friends/{friend_telegram_id}", response_model=FriendActionResponse)
async def remove_friend(friend_telegram_id: int, telegram_id: int = Body(..., embed=True)):
    """Удалить из друзей"""
    try:
        # Проверяем, что действительно друзья
        if not await are_friends(telegram_id, friend_telegram_id):
            raise HTTPException(status_code=400, detail="Вы не друзья")
        
        # Удаляем связи дружбы (обе стороны)
        await db.friends.delete_many({
            "$or": [
                {"user_telegram_id": telegram_id, "friend_telegram_id": friend_telegram_id},
                {"user_telegram_id": friend_telegram_id, "friend_telegram_id": telegram_id}
            ]
        })
        
        # Обновляем статистику
        await update_friends_stats(telegram_id)
        await update_friends_stats(friend_telegram_id)
        
        logger.info(f"👥 Friend removed: {telegram_id} X {friend_telegram_id}")
        return FriendActionResponse(
            success=True,
            message="Удален из друзей"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Remove friend error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/friends/block/{target_telegram_id}", response_model=FriendActionResponse)
async def block_user(target_telegram_id: int, telegram_id: int = Body(..., embed=True)):
    """Заблокировать пользователя"""
    try:
        if telegram_id == target_telegram_id:
            raise HTTPException(status_code=400, detail="Нельзя заблокировать себя")
        
        # Проверяем, не заблокирован ли уже
        if await is_blocked(telegram_id, target_telegram_id):
            raise HTTPException(status_code=400, detail="Пользователь уже заблокирован")
        
        # Удаляем из друзей, если были друзьями
        await db.friends.delete_many({
            "$or": [
                {"user_telegram_id": telegram_id, "friend_telegram_id": target_telegram_id},
                {"user_telegram_id": target_telegram_id, "friend_telegram_id": telegram_id}
            ]
        })
        
        # Удаляем все запросы между пользователями
        await db.friend_requests.delete_many({
            "$or": [
                {"from_telegram_id": telegram_id, "to_telegram_id": target_telegram_id},
                {"from_telegram_id": target_telegram_id, "to_telegram_id": telegram_id}
            ]
        })
        
        # Создаем блокировку
        block = UserBlock(
            blocker_telegram_id=telegram_id,
            blocked_telegram_id=target_telegram_id
        )
        await db.user_blocks.insert_one(block.dict())
        
        # Обновляем статистику
        await update_friends_stats(telegram_id)
        await update_friends_stats(target_telegram_id)
        
        logger.info(f"🚫 User blocked: {telegram_id} blocked {target_telegram_id}")
        return FriendActionResponse(
            success=True,
            message="Пользователь заблокирован"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Block user error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/friends/block/{target_telegram_id}", response_model=FriendActionResponse)
async def unblock_user(target_telegram_id: int, telegram_id: int = Body(..., embed=True)):
    """Разблокировать пользователя"""
    try:
        result = await db.user_blocks.delete_one({
            "blocker_telegram_id": telegram_id,
            "blocked_telegram_id": target_telegram_id
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Пользователь не был заблокирован")
        
        logger.info(f"✅ User unblocked: {telegram_id} unblocked {target_telegram_id}")
        return FriendActionResponse(
            success=True,
            message="Пользователь разблокирован"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unblock user error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/friends/{friend_telegram_id}/favorite", response_model=FriendActionResponse)
async def toggle_favorite_friend(friend_telegram_id: int, telegram_id: int = Body(..., embed=True), is_favorite: bool = Body(...)):
    """Добавить/убрать из избранных друзей"""
    try:
        result = await db.friends.update_one(
            {"user_telegram_id": telegram_id, "friend_telegram_id": friend_telegram_id},
            {"$set": {"is_favorite": is_favorite}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Друг не найден")
        
        message = "Добавлен в избранное" if is_favorite else "Убран из избранного"
        return FriendActionResponse(success=True, message=message)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Toggle favorite friend error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/friends/search", response_model=FriendSearchResponse)
async def search_users(
    telegram_id: int,
    query: str = None,
    group_id: str = None,
    facultet_id: str = None,
    limit: int = 50
):
    """Поиск пользователей для добавления в друзья (оптимизировано)"""
    try:
        # Получаем заблокированных пользователей
        blocked_by_me = await db.user_blocks.find({"blocker_telegram_id": telegram_id}).to_list(100)
        blocked_me = await db.user_blocks.find({"blocked_telegram_id": telegram_id}).to_list(100)
        blocked_ids = [b["blocked_telegram_id"] for b in blocked_by_me] + [b["blocker_telegram_id"] for b in blocked_me]
        
        # Исключаем себя и заблокированных
        exclude_ids = [telegram_id] + blocked_ids
        
        # Базовый фильтр
        filter_query = {"telegram_id": {"$nin": exclude_ids}}
        
        # Поиск по группе
        if group_id:
            filter_query["group_id"] = group_id
        
        # Поиск по факультету
        if facultet_id:
            filter_query["facultet_id"] = facultet_id
        
        # Текстовый поиск
        if query:
            filter_query["$or"] = [
                {"username": {"$regex": query, "$options": "i"}},
                {"first_name": {"$regex": query, "$options": "i"}},
                {"last_name": {"$regex": query, "$options": "i"}}
            ]
        
        users = await db.user_settings.find(filter_query).limit(limit).to_list(limit)
        
        if not users:
            return FriendSearchResponse(results=[], total=0, query=query)
        
        # Batch-загрузка privacy settings (проверяем поле в уже загруженных user_settings)
        # Batch-подсчёт статусов дружбы
        user_ids = [u["telegram_id"] for u in users]
        
        # Получаем все дружбы текущего пользователя
        my_friends = await db.friends.find({"user_telegram_id": telegram_id}).to_list(1000)
        my_friend_ids = set(f["friend_telegram_id"] for f in my_friends)
        
        # Получаем все pending запросы текущего пользователя
        my_outgoing = await db.friend_requests.find({
            "from_telegram_id": telegram_id,
            "to_telegram_id": {"$in": user_ids},
            "status": "pending"
        }).to_list(100)
        outgoing_map = {r["to_telegram_id"] for r in my_outgoing}
        
        my_incoming = await db.friend_requests.find({
            "to_telegram_id": telegram_id,
            "from_telegram_id": {"$in": user_ids},
            "status": "pending"
        }).to_list(100)
        incoming_map = {r["from_telegram_id"] for r in my_incoming}
        
        # Batch mutual friends
        mutual_counts = await get_mutual_friends_count_batch(telegram_id, user_ids)
        
        results = []
        for user in users:
            uid = user["telegram_id"]
            
            # Проверяем privacy
            privacy_data = user.get("privacy_settings", {})
            show_in_search = privacy_data.get("show_in_search", True) if privacy_data else True
            if not show_in_search:
                continue
            
            # Определяем статус дружбы
            if uid in my_friend_ids:
                friendship_status = "friend"
            elif uid in incoming_map:
                friendship_status = "pending_incoming"
            elif uid in outgoing_map:
                friendship_status = "pending_outgoing"
            else:
                friendship_status = None
            
            results.append(FriendSearchResult(
                telegram_id=uid,
                username=user.get("username"),
                first_name=user.get("first_name"),
                last_name=user.get("last_name"),
                group_name=user.get("group_name"),
                facultet_name=user.get("facultet_name"),
                kurs=user.get("kurs"),
                mutual_friends_count=mutual_counts.get(uid, 0),
                friendship_status=friendship_status
            ))
        
        return FriendSearchResponse(
            results=results,
            total=len(results),
            query=query
        )
        
    except Exception as e:
        logger.error(f"Search users error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/friends/{telegram_id}", response_model=FriendsListResponse)
async def get_friends_list(telegram_id: int, favorites_only: bool = False, search: str = None):
    """Получить список друзей (оптимизировано: batch-запросы)"""
    try:
        query = {"user_telegram_id": telegram_id}
        if favorites_only:
            query["is_favorite"] = True
        
        friends_data = await db.friends.find(query).to_list(1000)
        if not friends_data:
            return FriendsListResponse(friends=[], total=0)
        
        # Batch-загрузка всех user_settings за один запрос
        friend_ids = [f["friend_telegram_id"] for f in friends_data]
        friend_users_list = await db.user_settings.find({"telegram_id": {"$in": friend_ids}}).to_list(1000)
        friend_users_map = {u["telegram_id"]: u for u in friend_users_list}
        
        # Batch-подсчёт общих друзей
        mutual_counts = await get_mutual_friends_count_batch(telegram_id, friend_ids)
        
        # Маппинг is_favorite и created_at
        friend_meta = {f["friend_telegram_id"]: f for f in friends_data}
        
        friends = []
        for fid in friend_ids:
            user_data = friend_users_map.get(fid)
            if not user_data:
                continue
            
            # Фильтрация по поиску
            if search:
                search_lower = search.lower()
                name = f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}".lower()
                username = (user_data.get("username") or "").lower()
                if search_lower not in name and search_lower not in username:
                    continue
            
            meta = friend_meta.get(fid, {})
            privacy = await get_user_privacy_settings(fid)
            
            # Проверяем онлайн-статус
            is_online = False
            last_activity = user_data.get("last_activity")
            if last_activity and privacy.show_online_status:
                if isinstance(last_activity, str):
                    last_activity = datetime.fromisoformat(last_activity.replace('Z', '+00:00'))
                is_online = (datetime.utcnow() - last_activity).total_seconds() < 300
            
            friend_card = FriendCard(
                telegram_id=fid,
                username=user_data.get("username"),
                first_name=user_data.get("first_name"),
                last_name=user_data.get("last_name"),
                group_name=user_data.get("group_name"),
                facultet_name=user_data.get("facultet_name"),
                is_online=is_online if privacy.show_online_status else False,
                last_activity=last_activity if privacy.show_online_status else None,
                is_favorite=meta.get("is_favorite", False),
                mutual_friends_count=mutual_counts.get(fid, 0),
                friendship_date=meta.get("created_at")
            )
            friends.append(friend_card)
        
        # Сортируем: избранные первые, потом по алфавиту
        friends.sort(key=lambda x: (not x.is_favorite, x.first_name or "", x.last_name or ""))
        
        return FriendsListResponse(friends=friends, total=len(friends))
        
    except Exception as e:
        logger.error(f"Get friends list error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/friends/{telegram_id}/requests", response_model=FriendRequestsResponse)
async def get_friend_requests(telegram_id: int):
    """Получить входящие и исходящие запросы на дружбу (оптимизировано)"""
    try:
        # Загружаем все запросы одним батчем
        all_requests = await db.friend_requests.find({
            "$or": [
                {"to_telegram_id": telegram_id, "status": "pending"},
                {"from_telegram_id": telegram_id, "status": "pending"}
            ]
        }).to_list(200)
        
        incoming_data = [r for r in all_requests if r["to_telegram_id"] == telegram_id]
        outgoing_data = [r for r in all_requests if r["from_telegram_id"] == telegram_id]
        
        # Собираем все нужные user IDs
        user_ids = set()
        for req in incoming_data:
            user_ids.add(req["from_telegram_id"])
        for req in outgoing_data:
            user_ids.add(req["to_telegram_id"])
        
        # Batch-загрузка пользователей
        users_list = await db.user_settings.find({"telegram_id": {"$in": list(user_ids)}}).to_list(200)
        users_map = {u["telegram_id"]: u for u in users_list}
        
        # Batch-подсчёт общих друзей
        mutual_counts = await get_mutual_friends_count_batch(telegram_id, list(user_ids))
        
        incoming = []
        for req in incoming_data:
            user = users_map.get(req["from_telegram_id"])
            if user:
                incoming.append(FriendRequestCard(
                    request_id=req["id"],
                    telegram_id=req["from_telegram_id"],
                    username=user.get("username"),
                    first_name=user.get("first_name"),
                    last_name=user.get("last_name"),
                    group_name=user.get("group_name"),
                    facultet_name=user.get("facultet_name"),
                    message=req.get("message"),
                    mutual_friends_count=mutual_counts.get(req["from_telegram_id"], 0),
                    created_at=req.get("created_at", datetime.utcnow())
                ))
        
        outgoing = []
        for req in outgoing_data:
            user = users_map.get(req["to_telegram_id"])
            if user:
                outgoing.append(FriendRequestCard(
                    request_id=req["id"],
                    telegram_id=req["to_telegram_id"],
                    username=user.get("username"),
                    first_name=user.get("first_name"),
                    last_name=user.get("last_name"),
                    group_name=user.get("group_name"),
                    facultet_name=user.get("facultet_name"),
                    message=req.get("message"),
                    mutual_friends_count=mutual_counts.get(req["to_telegram_id"], 0),
                    created_at=req.get("created_at", datetime.utcnow())
                ))
        
        return FriendRequestsResponse(
            incoming=incoming,
            outgoing=outgoing,
            incoming_count=len(incoming),
            outgoing_count=len(outgoing)
        )
        
    except Exception as e:
        logger.error(f"Get friend requests error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/friends/mutual/{telegram_id}/{other_telegram_id}", response_model=MutualFriendsResponse)
async def get_mutual_friends(telegram_id: int, other_telegram_id: int):
    """Получить список общих друзей"""
    try:
        # Получаем друзей первого пользователя
        friends1 = await db.friends.find({"user_telegram_id": telegram_id}).to_list(1000)
        friends1_ids = set(f["friend_telegram_id"] for f in friends1)
        
        # Получаем друзей второго пользователя
        friends2 = await db.friends.find({"user_telegram_id": other_telegram_id}).to_list(1000)
        friends2_ids = set(f["friend_telegram_id"] for f in friends2)
        
        # Находим пересечение
        mutual_ids = friends1_ids & friends2_ids
        
        mutual_friends = []
        for friend_id in mutual_ids:
            user = await db.user_settings.find_one({"telegram_id": friend_id})
            if user:
                friend_card = await build_friend_card(user, telegram_id)
                mutual_friends.append(friend_card)
        
        return MutualFriendsResponse(
            mutual_friends=mutual_friends,
            count=len(mutual_friends)
        )
        
    except Exception as e:
        logger.error(f"Get mutual friends error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# API для профиля

@api_router.get("/profile/{telegram_id}", response_model=UserProfilePublic)
async def get_user_profile(telegram_id: int, viewer_telegram_id: int = None):
    """Получить публичный профиль пользователя"""
    try:
        user = await db.user_settings.find_one({"telegram_id": telegram_id})
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        privacy = await get_user_privacy_settings(telegram_id)
        
        # Получаем статистику
        stats = await db.user_stats.find_one({"telegram_id": telegram_id})
        achievements_count = await db.user_achievements.count_documents({"telegram_id": telegram_id})
        friends_count = await get_user_friends_count(telegram_id)
        
        # Проверяем онлайн-статус
        is_online = False
        last_activity = user.get("last_activity")
        if last_activity and privacy.show_online_status:
            if isinstance(last_activity, str):
                last_activity = datetime.fromisoformat(last_activity.replace('Z', '+00:00'))
            is_online = (datetime.utcnow() - last_activity).total_seconds() < 300
        
        # Вычисляем общих друзей
        mutual_count = 0
        if viewer_telegram_id and viewer_telegram_id != telegram_id:
            mutual_count = await get_mutual_friends_count(viewer_telegram_id, telegram_id)
        
        # Определяем статус дружбы
        friendship_status = None
        if viewer_telegram_id and viewer_telegram_id != telegram_id:
            friendship_status = await get_friendship_status(viewer_telegram_id, telegram_id)
        
        return UserProfilePublic(
            telegram_id=telegram_id,
            username=user.get("username"),
            first_name=user.get("first_name"),
            last_name=user.get("last_name"),
            group_id=user.get("group_id"),
            group_name=user.get("group_name"),
            facultet_id=user.get("facultet_id"),
            facultet_name=user.get("facultet_name"),
            kurs=user.get("kurs"),
            friends_count=friends_count if privacy.show_friends_list else 0,
            mutual_friends_count=mutual_count,
            achievements_count=achievements_count if privacy.show_achievements else 0,
            total_points=stats.get("total_points", 0) if stats and privacy.show_achievements else 0,
            is_online=is_online if privacy.show_online_status else False,
            last_activity=last_activity if privacy.show_online_status else None,
            privacy=privacy,
            created_at=user.get("created_at"),
            friendship_status=friendship_status
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get user profile error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/profile/{telegram_id}/schedule", response_model=FriendScheduleResponse)
async def get_friend_schedule(telegram_id: int, viewer_telegram_id: int, date: str = None):
    """Получить расписание друга"""
    try:
        # Проверяем, что пользователи друзья
        if not await are_friends(viewer_telegram_id, telegram_id):
            raise HTTPException(status_code=403, detail="Вы не друзья с этим пользователем")
        
        # Проверяем настройки приватности
        privacy = await get_user_privacy_settings(telegram_id)
        if not privacy.show_schedule:
            raise HTTPException(status_code=403, detail="Пользователь скрыл своё расписание")
        
        # Получаем данные пользователя
        user = await db.user_settings.find_one({"telegram_id": telegram_id})
        if not user or not user.get("group_id"):
            raise HTTPException(status_code=404, detail="У пользователя не настроена группа")
        
        # Получаем расписание
        from rudn_parser import get_schedule
        
        if not date:
            date = datetime.now().strftime("%Y-%m-%d")
        
        # Правильный порядок параметров: facultet_id, level_id, kurs, form_code, group_id
        schedule_events = await get_schedule(
            user.get("facultet_id", ""),
            user.get("level_id", ""),
            user.get("kurs", ""),
            user.get("form_code", ""),
            user["group_id"]
        )
        
        # schedule_events - это уже список событий
        if not isinstance(schedule_events, list):
            schedule_events = []
        
        # Фильтруем по дню недели (расписание содержит day, а не date)
        if date and schedule_events:
            # Конвертируем дату в день недели
            try:
                date_obj = datetime.strptime(date, "%Y-%m-%d")
                days_ru = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
                day_name = days_ru[date_obj.weekday()]
                schedule_events = [e for e in schedule_events if e.get("day") == day_name]
            except Exception as e:
                logger.warning(f"Error filtering schedule by date: {e}")
        
        # Получаем расписание просматривающего для сравнения
        viewer = await db.user_settings.find_one({"telegram_id": viewer_telegram_id})
        common_classes = []
        common_breaks = []
        
        if viewer and viewer.get("group_id") == user.get("group_id"):
            # Если в одной группе - все пары общие
            common_classes = schedule_events
        
        friend_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or "Друг"
        
        return FriendScheduleResponse(
            friend_telegram_id=telegram_id,
            friend_name=friend_name,
            group_name=user.get("group_name"),
            schedule=schedule_events,
            common_classes=common_classes,
            common_breaks=common_breaks
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get friend schedule error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/profile/{telegram_id}/privacy", response_model=PrivacySettings)
async def update_privacy_settings(telegram_id: int, settings: PrivacySettingsUpdate):
    """Обновить настройки приватности"""
    try:
        # Получаем текущие настройки
        current = await get_user_privacy_settings(telegram_id)
        
        # Обновляем только переданные поля
        update_data = settings.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(current, key, value)
        
        # Сохраняем
        await db.user_settings.update_one(
            {"telegram_id": telegram_id},
            {"$set": {"privacy_settings": current.dict()}}
        )
        
        logger.info(f"🔒 Privacy settings updated for {telegram_id}")
        return current
        
    except Exception as e:
        logger.error(f"Update privacy settings error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/profile/{telegram_id}/privacy", response_model=PrivacySettings)
async def get_privacy_settings(telegram_id: int):
    """Получить настройки приватности"""
    try:
        return await get_user_privacy_settings(telegram_id)
    except Exception as e:
        logger.error(f"Get privacy settings error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/profile/{telegram_id}/qr")
async def get_profile_qr_data(telegram_id: int):
    """Получить данные для QR-кода профиля"""
    try:
        user = await db.user_settings.find_one({"telegram_id": telegram_id})
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Генерируем ссылку для добавления в друзья (открывает Web App напрямую)
        bot_username = os.getenv("BOT_USERNAME", "rudn_mosbot")
        # Формат для прямого открытия Web App: https://t.me/{bot}/app?startapp=friend_{id}
        friend_link = f"https://t.me/{bot_username}/app?startapp=friend_{telegram_id}"
        
        return {
            "qr_data": friend_link,
            "telegram_id": telegram_id,
            "display_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or user.get("username", "Пользователь")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get profile QR data error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Обработка приглашения от друга (онбординг)

@api_router.post("/friends/process-invite", response_model=ProcessFriendInviteResponse)
async def process_friend_invite(request: ProcessFriendInviteRequest):
    """Обработать приглашение от друга при онбординге"""
    try:
        inviter = await db.user_settings.find_one({"telegram_id": request.inviter_telegram_id})
        if not inviter:
            return ProcessFriendInviteResponse(
                success=False,
                friend_added=False,
                group_set=False,
                message="Пригласивший пользователь не найден"
            )
        
        # Проверяем, новый ли это пользователь
        existing_user = await db.user_settings.find_one({"telegram_id": request.telegram_id})
        is_new_user = existing_user is None
        
        # Автоматически добавляем в друзья
        if not await are_friends(request.telegram_id, request.inviter_telegram_id):
            friend1 = Friend(
                user_telegram_id=request.telegram_id,
                friend_telegram_id=request.inviter_telegram_id
            )
            friend2 = Friend(
                user_telegram_id=request.inviter_telegram_id,
                friend_telegram_id=request.telegram_id
            )
            await db.friends.insert_many([friend1.dict(), friend2.dict()])
            
            # Обновляем статистику
            await update_friends_stats(request.telegram_id)
            await update_friends_stats(request.inviter_telegram_id)
            
            # Если новый пользователь - увеличиваем счетчик приглашений
            if is_new_user:
                await db.user_stats.update_one(
                    {"telegram_id": request.inviter_telegram_id},
                    {"$inc": {"users_invited": 1}},
                    upsert=True
                )
        
        # Устанавливаем группу пригласившего если запрошено
        group_set = False
        if request.use_inviter_group and inviter.get("group_id"):
            await db.user_settings.update_one(
                {"telegram_id": request.telegram_id},
                {
                    "$set": {
                        "group_id": inviter["group_id"],
                        "group_name": inviter.get("group_name"),
                        "facultet_id": inviter.get("facultet_id"),
                        "facultet_name": inviter.get("facultet_name"),
                        "level_id": inviter.get("level_id"),
                        "kurs": inviter.get("kurs"),
                        "form_code": inviter.get("form_code")
                    }
                },
                upsert=True
            )
            group_set = True
        
        # Проверяем достижения
        from achievements import check_and_award_achievements, get_or_create_user_stats
        for user_id in [request.telegram_id, request.inviter_telegram_id]:
            stats = await get_or_create_user_stats(db, user_id)
            await check_and_award_achievements(db, user_id, stats)
        
        inviter_card = await build_friend_card(inviter, request.telegram_id, datetime.utcnow())
        
        logger.info(f"👥 Friend invite processed: {request.inviter_telegram_id} -> {request.telegram_id}")
        return ProcessFriendInviteResponse(
            success=True,
            friend_added=True,
            group_set=group_set,
            inviter_info=inviter_card,
            message="Вы добавлены в друзья!"
        )
        
    except Exception as e:
        logger.error(f"Process friend invite error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/friends/{telegram_id}/blocked")
async def get_blocked_users(telegram_id: int):
    """Получить список заблокированных пользователей"""
    try:
        blocks = await db.user_blocks.find({"blocker_telegram_id": telegram_id}).to_list(100)
        
        blocked_users = []
        for block in blocks:
            user = await db.user_settings.find_one({"telegram_id": block["blocked_telegram_id"]})
            if user:
                blocked_users.append({
                    "telegram_id": block["blocked_telegram_id"],
                    "username": user.get("username"),
                    "first_name": user.get("first_name"),
                    "last_name": user.get("last_name"),
                    "blocked_at": block.get("created_at")
                })
        
        return {"blocked_users": blocked_users, "count": len(blocked_users)}
        
    except Exception as e:
        logger.error(f"Get blocked users error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ API для системы уведомлений (In-App Notifications) ============

def get_time_ago(dt: datetime) -> str:
    """Получить относительное время (5м, 2ч, вчера)"""
    now = datetime.utcnow()
    diff = now - dt
    
    seconds = diff.total_seconds()
    minutes = seconds / 60
    hours = minutes / 60
    days = hours / 24
    
    if seconds < 60:
        return "сейчас"
    elif minutes < 60:
        return f"{int(minutes)}м"
    elif hours < 24:
        return f"{int(hours)}ч"
    elif days < 2:
        return "вчера"
    elif days < 7:
        return f"{int(days)}д"
    else:
        return dt.strftime("%d.%m")


async def get_notification_settings(telegram_id: int) -> ExtendedNotificationSettings:
    """Получить расширенные настройки уведомлений"""
    user = await db.user_settings.find_one({"telegram_id": telegram_id})
    if user and "extended_notification_settings" in user:
        return ExtendedNotificationSettings(**user["extended_notification_settings"])
    return ExtendedNotificationSettings()


async def should_send_notification(telegram_id: int, category: NotificationCategory, notification_type: NotificationType) -> tuple[bool, bool]:
    """Проверить, нужно ли отправлять уведомление. Возвращает (in_app, push)"""
    settings = await get_notification_settings(telegram_id)
    
    if not settings.notifications_enabled:
        return False, False
    
    in_app = True
    push = False
    
    if category == NotificationCategory.STUDY:
        in_app = settings.study_enabled
        push = settings.study_push
    elif category == NotificationCategory.SOCIAL:
        in_app = settings.social_enabled
        push = settings.social_push
        if notification_type == NotificationType.FRIEND_REQUEST:
            in_app = in_app and settings.social_friend_requests
        elif notification_type == NotificationType.FRIEND_ACCEPTED:
            in_app = in_app and settings.social_friend_accepted
    elif category == NotificationCategory.ROOMS:
        in_app = settings.rooms_enabled
        push = settings.rooms_push
        if notification_type == NotificationType.ROOM_TASK_NEW:
            in_app = in_app and settings.rooms_new_tasks
        elif notification_type == NotificationType.ROOM_TASK_ASSIGNED:
            in_app = in_app and settings.rooms_assignments
        elif notification_type == NotificationType.ROOM_TASK_COMPLETED:
            in_app = in_app and settings.rooms_completions
    elif category == NotificationCategory.JOURNAL:
        in_app = settings.journal_enabled
        push = settings.journal_push
    elif category == NotificationCategory.ACHIEVEMENTS:
        in_app = settings.achievements_enabled
        push = settings.achievements_push
    elif category == NotificationCategory.SYSTEM:
        in_app = settings.system_enabled
        push = settings.system_push
    
    return in_app, push


async def create_notification(
    telegram_id: int,
    notification_type: NotificationType,
    category: NotificationCategory,
    title: str,
    message: str,
    emoji: str = "🔔",
    priority: NotificationPriority = NotificationPriority.NORMAL,
    data: dict = None,
    actions: list = None,
    send_push: bool = None
) -> Optional[str]:
    """Создать уведомление"""
    try:
        # Проверяем настройки
        should_in_app, should_push = await should_send_notification(telegram_id, category, notification_type)
        
        if not should_in_app:
            return None
        
        notification = InAppNotification(
            telegram_id=telegram_id,
            type=notification_type,
            category=category,
            priority=priority,
            title=title,
            message=message,
            emoji=emoji,
            data=data or {},
            actions=actions or []
        )
        
        await db.in_app_notifications.insert_one(notification.dict())
        
        # Отправляем push если нужно
        if (send_push is True) or (send_push is None and should_push and priority == NotificationPriority.HIGH):
            try:
                from notifications import get_notification_service
                notification_service = get_notification_service()
                
                # Красиво форматируем push-сообщение
                push_text = f"{emoji}  <b>{title}</b>\n\n{message}"
                
                await notification_service.send_message(
                    telegram_id,
                    push_text
                )
            except Exception as e:
                logger.warning(f"Failed to send push notification: {e}")
        
        logger.info(f"📬 Notification created: {notification_type} for {telegram_id}")
        return notification.id
        
    except Exception as e:
        logger.error(f"Create notification error: {e}")
        return None


# Хелперы для создания уведомлений разных типов

async def notify_friend_request(to_telegram_id: int, from_user: dict, request_id: str):
    """Уведомление о новой заявке в друзья"""
    from_name = f"{from_user.get('first_name', '')} {from_user.get('last_name', '')}".strip() or from_user.get('username', 'Пользователь')
    
    await create_notification(
        telegram_id=to_telegram_id,
        notification_type=NotificationType.FRIEND_REQUEST,
        category=NotificationCategory.SOCIAL,
        priority=NotificationPriority.HIGH,
        title="Заявка в друзья",
        message=f"👤 {from_name} хочет добавить вас в друзья",
        emoji="💌",
        data={
            "request_id": request_id,
            "from_telegram_id": from_user.get("telegram_id"),
            "from_name": from_name
        },
        actions=[
            {"id": "accept", "label": "✅ Принять", "type": "primary"},
            {"id": "reject", "label": "Отклонить", "type": "secondary"}
        ]
    )


async def notify_friend_accepted(to_telegram_id: int, friend_user: dict):
    """Уведомление о принятии заявки"""
    friend_name = f"{friend_user.get('first_name', '')} {friend_user.get('last_name', '')}".strip() or friend_user.get('username', 'Пользователь')
    
    await create_notification(
        telegram_id=to_telegram_id,
        notification_type=NotificationType.FRIEND_ACCEPTED,
        category=NotificationCategory.SOCIAL,
        priority=NotificationPriority.NORMAL,
        title="Вы теперь друзья!",
        message=f"🤝 {friend_name} принял вашу заявку",
        emoji="🎉",
        data={
            "friend_telegram_id": friend_user.get("telegram_id"),
            "friend_name": friend_name
        }
    )


async def notify_room_invite(to_telegram_id: int, room: dict, inviter: dict):
    """Уведомление о приглашении в комнату"""
    inviter_name = f"{inviter.get('first_name', '')} {inviter.get('last_name', '')}".strip() or inviter.get('username', 'Пользователь')
    room_name = room.get('name', 'Комната')
    
    await create_notification(
        telegram_id=to_telegram_id,
        notification_type=NotificationType.ROOM_INVITE,
        category=NotificationCategory.ROOMS,
        priority=NotificationPriority.HIGH,
        title="Приглашение в комнату",
        message=f"👤 {inviter_name} зовёт вас в «{room_name}»",
        emoji="🏠",
        data={
            "room_id": room.get("id"),
            "room_name": room_name,
            "inviter_telegram_id": inviter.get("telegram_id")
        },
        actions=[
            {"id": "join", "label": "✅ Вступить", "type": "primary"},
            {"id": "decline", "label": "Отклонить", "type": "secondary"}
        ]
    )


async def notify_room_task(to_telegram_id: int, room: dict, task: dict, creator: dict):
    """Уведомление о новой задаче в комнате"""
    creator_name = f"{creator.get('first_name', '')} {creator.get('last_name', '')}".strip() or "Участник"
    task_text = task.get('text', '')[:50]
    room_name = room.get('name', '')
    
    await create_notification(
        telegram_id=to_telegram_id,
        notification_type=NotificationType.ROOM_TASK_NEW,
        category=NotificationCategory.ROOMS,
        priority=NotificationPriority.NORMAL,
        title="Новая задача в комнате",
        message=f"📝 {creator_name} → «{task_text}»\n🏠 {room_name}",
        emoji="📋",
        data={
            "room_id": room.get("id"),
            "task_id": task.get("id"),
            "room_name": room_name
        }
    )


async def notify_task_assigned(to_telegram_id: int, room: dict, task: dict, assigner: dict):
    """Уведомление о назначении задачи"""
    assigner_name = f"{assigner.get('first_name', '')} {assigner.get('last_name', '')}".strip() or "Участник"
    task_text = task.get('text', '')[:50]
    room_name = room.get('name', '')
    
    await create_notification(
        telegram_id=to_telegram_id,
        notification_type=NotificationType.ROOM_TASK_ASSIGNED,
        category=NotificationCategory.ROOMS,
        priority=NotificationPriority.HIGH,
        title="Вам назначена задача",
        message=f"📌 «{task_text}»\n👤 От: {assigner_name}\n🏠 {room_name}",
        emoji="🎯",
        data={
            "room_id": room.get("id"),
            "task_id": task.get("id"),
            "room_name": room_name
        }
    )


async def notify_task_completed(to_telegram_id: int, room: dict, task: dict, completer: dict):
    """Уведомление о выполнении задачи"""
    completer_name = f"{completer.get('first_name', '')} {completer.get('last_name', '')}".strip() or "Участник"
    task_text = task.get('text', '')[:50]
    
    await create_notification(
        telegram_id=to_telegram_id,
        notification_type=NotificationType.ROOM_TASK_COMPLETED,
        category=NotificationCategory.ROOMS,
        priority=NotificationPriority.LOW,
        title="Задача выполнена ✓",
        message=f"✅ «{task_text}»\n👤 {completer_name}",
        emoji="🎉",
        data={
            "room_id": room.get("id"),
            "task_id": task.get("id")
        }
    )


async def notify_achievement(to_telegram_id: int, achievement: dict):
    """Уведомление о получении достижения"""
    ach_name = achievement.get('name', '')
    ach_emoji = achievement.get('emoji', '🏆')
    ach_points = achievement.get('points', 0)
    
    await create_notification(
        telegram_id=to_telegram_id,
        notification_type=NotificationType.ACHIEVEMENT_EARNED,
        category=NotificationCategory.ACHIEVEMENTS,
        priority=NotificationPriority.NORMAL,
        title="Новое достижение!",
        message=f"{ach_emoji} «{ach_name}»\n⭐ +{ach_points} очков",
        emoji="🏆",
        data={
            "achievement_id": achievement.get("id"),
            "achievement_name": ach_name,
            "points": ach_points
        }
    )


async def notify_journal_attendance(to_telegram_id: int, journal: dict, status: str, date: str):
    """Уведомление об отметке посещаемости"""
    status_map = {
        "present":  ("✅", "присутствие"),
        "absent":   ("❌", "отсутствие"),
        "late":     ("⏰", "опоздание"),
    }
    status_emoji, status_text = status_map.get(status, ("📋", status))
    journal_name = journal.get('name', '')
    
    await create_notification(
        telegram_id=to_telegram_id,
        notification_type=NotificationType.JOURNAL_ATTENDANCE,
        category=NotificationCategory.JOURNAL,
        priority=NotificationPriority.LOW,
        title="Отметка в журнале",
        message=f"{status_emoji} {status_text.capitalize()} — {date}\n📚 {journal_name}",
        emoji="📓",
        data={
            "journal_id": journal.get("id"),
            "status": status,
            "date": date
        }
    )


# API Endpoints для уведомлений

@api_router.get("/notifications/{telegram_id}", response_model=NotificationsListResponse)
async def get_notifications(telegram_id: int, limit: int = 50, offset: int = 0, unread_only: bool = False):
    """Получить список уведомлений"""
    try:
        query = {"telegram_id": telegram_id, "dismissed": False}
        if unread_only:
            query["read"] = False
        
        total = await db.in_app_notifications.count_documents(query)
        unread_count = await db.in_app_notifications.count_documents({
            "telegram_id": telegram_id, 
            "read": False,
            "dismissed": False
        })
        
        notifications_cursor = db.in_app_notifications.find(query) \
            .sort("created_at", -1) \
            .skip(offset) \
            .limit(limit)
        
        notifications = []
        async for notif in notifications_cursor:
            created_at = notif.get("created_at")
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            
            notifications.append(NotificationCard(
                id=notif["id"],
                type=notif["type"],
                category=notif["category"],
                priority=notif.get("priority", "normal"),
                title=notif["title"],
                message=notif["message"],
                emoji=notif.get("emoji", "🔔"),
                data=notif.get("data", {}),
                actions=notif.get("actions", []),
                action_taken=notif.get("action_taken"),
                read=notif.get("read", False),
                created_at=created_at,
                time_ago=get_time_ago(created_at) if created_at else ""
            ))
        
        return NotificationsListResponse(
            notifications=notifications,
            total=total,
            unread_count=unread_count,
            has_more=offset + limit < total
        )
        
    except Exception as e:
        logger.error(f"Get notifications error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/notifications/{telegram_id}/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(telegram_id: int):
    """Получить количество непрочитанных уведомлений"""
    try:
        total = await db.in_app_notifications.count_documents({
            "telegram_id": telegram_id,
            "read": False,
            "dismissed": False
        })
        
        # Считаем по категориям
        pipeline = [
            {"$match": {"telegram_id": telegram_id, "read": False, "dismissed": False}},
            {"$group": {"_id": "$category", "count": {"$sum": 1}}}
        ]
        
        by_category = {}
        async for doc in db.in_app_notifications.aggregate(pipeline):
            by_category[doc["_id"]] = doc["count"]
        
        return UnreadCountResponse(unread_count=total, by_category=by_category)
        
    except Exception as e:
        logger.error(f"Get unread count error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, telegram_id: int = Body(..., embed=True)):
    """Отметить уведомление как прочитанное"""
    try:
        result = await db.in_app_notifications.update_one(
            {"id": notification_id, "telegram_id": telegram_id},
            {"$set": {"read": True, "read_at": datetime.utcnow()}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Уведомление не найдено")
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Mark notification read error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/notifications/{telegram_id}/read-all")
async def mark_all_notifications_read(telegram_id: int):
    """Отметить все уведомления как прочитанные"""
    try:
        result = await db.in_app_notifications.update_many(
            {"telegram_id": telegram_id, "read": False},
            {"$set": {"read": True, "read_at": datetime.utcnow()}}
        )
        
        return {"success": True, "updated": result.modified_count}
        
    except Exception as e:
        logger.error(f"Mark all notifications read error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/notifications/{notification_id}")
async def dismiss_notification(notification_id: str, telegram_id: int = Body(..., embed=True)):
    """Скрыть уведомление"""
    try:
        result = await db.in_app_notifications.update_one(
            {"id": notification_id, "telegram_id": telegram_id},
            {"$set": {"dismissed": True}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Уведомление не найдено")
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Dismiss notification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/notifications/{notification_id}/action")
async def notification_action(notification_id: str, telegram_id: int = Body(...), action_id: str = Body(...)):
    """Выполнить действие уведомления"""
    try:
        result = await db.in_app_notifications.update_one(
            {"id": notification_id, "telegram_id": telegram_id},
            {"$set": {"action_taken": action_id, "read": True, "read_at": datetime.utcnow()}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Уведомление не найдено")
        
        return {"success": True, "action_id": action_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Notification action error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/notifications/{telegram_id}/settings", response_model=ExtendedNotificationSettings)
async def get_extended_notification_settings(telegram_id: int):
    """Получить расширенные настройки уведомлений"""
    try:
        return await get_notification_settings(telegram_id)
    except Exception as e:
        logger.error(f"Get extended notification settings error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/notifications/{telegram_id}/settings", response_model=ExtendedNotificationSettings)
async def update_extended_notification_settings(telegram_id: int, settings: ExtendedNotificationSettingsUpdate):
    """Обновить расширенные настройки уведомлений"""
    try:
        current = await get_notification_settings(telegram_id)
        
        # Обновляем только переданные поля
        update_data = settings.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(current, key, value)
        
        await db.user_settings.update_one(
            {"telegram_id": telegram_id},
            {"$set": {"extended_notification_settings": current.dict()}},
            upsert=True
        )
        
        logger.info(f"📬 Extended notification settings updated for {telegram_id}")
        return current
        
    except Exception as e:
        logger.error(f"Update extended notification settings error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ Web Sessions (связка Telegram профиля через QR) ============

# Словарь для хранения активных WebSocket соединений по session_token
web_session_connections: dict = {}


@api_router.post("/web-sessions", response_model=WebSessionResponse)
async def create_web_session(
    request: Request,
    device_info: WebSessionCreateRequest = None
):
    """
    Создать новую веб-сессию для связки с Telegram профилем.
    Возвращает session_token и QR URL для сканирования.
    """
    try:
        # Генерируем уникальный токен сессии
        session_token = str(uuid.uuid4())
        
        # Получаем username бота для формирования ссылки
        bot_username = get_telegram_bot_username()
        
        # Формируем URL для QR-кода (открывает Telegram Web App с параметром)
        qr_url = f"https://t.me/{bot_username}/app?startapp=link_{session_token}"
        
        # Время истечения сессии (10 минут)
        expires_at = datetime.utcnow() + timedelta(minutes=10)
        
        # Получаем информацию об устройстве из заголовков или тела запроса
        user_agent = request.headers.get("User-Agent", "")
        ip_address = request.client.host if request.client else None
        
        # Парсим User-Agent для определения браузера и ОС
        browser_name = None
        os_name = None
        device_name = None
        
        if device_info:
            browser_name = device_info.browser
            os_name = device_info.os
            device_name = device_info.device_name
            if device_info.user_agent:
                user_agent = device_info.user_agent
        
        # Автоматический парсинг User-Agent если не переданы данные
        if not browser_name or not os_name:
            ua_lower = user_agent.lower()
            
            # Определяем браузер
            if "chrome" in ua_lower and "edg" not in ua_lower:
                browser_name = browser_name or "Chrome"
            elif "firefox" in ua_lower:
                browser_name = browser_name or "Firefox"
            elif "safari" in ua_lower and "chrome" not in ua_lower:
                browser_name = browser_name or "Safari"
            elif "edg" in ua_lower:
                browser_name = browser_name or "Edge"
            elif "opera" in ua_lower or "opr" in ua_lower:
                browser_name = browser_name or "Opera"
            else:
                browser_name = browser_name or "Browser"
            
            # Определяем ОС
            if "windows" in ua_lower:
                os_name = os_name or "Windows"
            elif "mac os" in ua_lower or "macos" in ua_lower:
                os_name = os_name or "macOS"
            elif "linux" in ua_lower:
                os_name = os_name or "Linux"
            elif "android" in ua_lower:
                os_name = os_name or "Android"
            elif "iphone" in ua_lower or "ipad" in ua_lower:
                os_name = os_name or "iOS"
            else:
                os_name = os_name or "Unknown"
        
        # Формируем название устройства
        if not device_name:
            device_name = f"{browser_name} на {os_name}"
        
        # Создаем сессию в БД
        session_data = {
            "id": str(uuid.uuid4()),
            "session_token": session_token,
            "status": WebSessionStatus.PENDING.value,
            "telegram_id": None,
            "first_name": None,
            "last_name": None,
            "username": None,
            "photo_url": None,
            "device_name": device_name,
            "browser": browser_name,
            "os": os_name,
            "user_agent": user_agent,
            "ip_address": ip_address,
            "user_settings": None,
            "created_at": datetime.utcnow(),
            "expires_at": expires_at,
            "linked_at": None,
            "last_active": datetime.utcnow()
        }
        
        await db.web_sessions.insert_one(session_data)
        
        logger.info(f"🔗 Created web session: {session_token[:8]}... ({device_name})")
        
        return WebSessionResponse(
            session_token=session_token,
            status=WebSessionStatus.PENDING,
            qr_url=qr_url,
            expires_at=expires_at
        )
        
    except Exception as e:
        logger.error(f"Create web session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/web-sessions/{session_token}/status", response_model=WebSessionResponse)
async def get_web_session_status(session_token: str):
    """
    Получить статус веб-сессии.
    Используется для polling или проверки после WebSocket disconnect.
    Обновляет last_active для связанных сессий.
    Возвращает данные сканирования если QR-код был отсканирован.
    """
    try:
        session = await db.web_sessions.find_one({"session_token": session_token})
        
        if not session:
            raise HTTPException(status_code=404, detail="Сессия не найдена")
        
        # Проверяем истечение срока
        if session.get("expires_at") and datetime.utcnow() > session["expires_at"]:
            if session["status"] == WebSessionStatus.PENDING.value:
                await db.web_sessions.update_one(
                    {"session_token": session_token},
                    {"$set": {"status": WebSessionStatus.EXPIRED.value}}
                )
                session["status"] = WebSessionStatus.EXPIRED.value
        
        # Обновляем last_active для связанных сессий при каждом запросе статуса
        if session["status"] == WebSessionStatus.LINKED.value:
            await db.web_sessions.update_one(
                {"session_token": session_token},
                {"$set": {"last_active": datetime.utcnow()}}
            )
        
        bot_username = get_telegram_bot_username()
        qr_url = f"https://t.me/{bot_username}/app?startapp=link_{session_token}"
        
        # Для PENDING сессий с данными сканирования — передаём scanned_by
        # (polling-клиенты узнают что QR отсканирован)
        response_data = {
            "session_token": session_token,
            "status": WebSessionStatus(session["status"]),
            "qr_url": qr_url,
            "expires_at": session.get("expires_at"),
            "telegram_id": session.get("telegram_id"),
            "first_name": session.get("first_name"),
            "last_name": session.get("last_name"),
            "username": session.get("username"),
            "photo_url": session.get("photo_url"),
            "user_settings": session.get("user_settings")
        }
        
        # Если сессия PENDING но уже отсканирована — передаём данные в first_name/photo_url/telegram_id
        # чтобы polling-клиент мог показать "waiting" состояние
        if session["status"] == WebSessionStatus.PENDING.value and session.get("scanned_by"):
            response_data["telegram_id"] = session.get("scanned_by")
            response_data["first_name"] = session.get("scanned_first_name")
            response_data["photo_url"] = session.get("scanned_photo_url")
        
        return WebSessionResponse(**response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get web session status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/web-sessions/{session_token}/link", response_model=WebSessionLinkResponse)
async def link_web_session(session_token: str, request: WebSessionLinkRequest):
    """
    Связать веб-сессию с Telegram профилем.
    Вызывается из Telegram Web App после подтверждения пользователем.
    Использует атомарную операцию find_one_and_update для предотвращения race condition.
    """
    try:
        # Проверяем срок действия (предварительная проверка)
        session_check = await db.web_sessions.find_one({"session_token": session_token})
        
        if not session_check:
            return WebSessionLinkResponse(
                success=False,
                message="Сессия не найдена"
            )
        
        if session_check.get("expires_at") and datetime.utcnow() > session_check["expires_at"]:
            await db.web_sessions.update_one(
                {"session_token": session_token},
                {"$set": {"status": WebSessionStatus.EXPIRED.value}}
            )
            return WebSessionLinkResponse(
                success=False,
                message="Срок действия сессии истёк"
            )
        
        # Получаем настройки пользователя из БД
        user_settings = await db.user_settings.find_one({"telegram_id": request.telegram_id})
        user_settings_dict = None
        if user_settings:
            # Убираем _id для сериализации
            user_settings_dict = {k: v for k, v in user_settings.items() if k != "_id"}
            # Конвертируем datetime в string для JSON
            for key, value in user_settings_dict.items():
                if isinstance(value, datetime):
                    user_settings_dict[key] = value.isoformat()
        
        # АТОМАРНАЯ ОПЕРАЦИЯ: find_one_and_update с условием status=PENDING
        # Предотвращает race condition - только один запрос сможет связать сессию
        update_data = {
            "status": WebSessionStatus.LINKED.value,
            "telegram_id": request.telegram_id,
            "first_name": request.first_name,
            "last_name": request.last_name,
            "username": request.username,
            "photo_url": request.photo_url,
            "user_settings": user_settings_dict,
            "linked_at": datetime.utcnow(),
            "last_active": datetime.utcnow()
        }
        
        result = await db.web_sessions.find_one_and_update(
            {
                "session_token": session_token,
                "status": WebSessionStatus.PENDING.value
            },
            {"$set": update_data},
            return_document=True  # pymongo.ReturnDocument.AFTER
        )
        
        if not result:
            return WebSessionLinkResponse(
                success=False,
                message="Сессия уже использована или истекла"
            )
        
        logger.info(f"✅ Web session linked: {session_token[:8]}... -> {request.telegram_id}")
        
        # Отправляем уведомление в Telegram о новом устройстве (fire-and-forget)
        async def _send_telegram_notification():
            try:
                from telegram_bot import send_device_linked_notification
                device_name = result.get("device_name", "Неизвестное устройство")
                await send_device_linked_notification(
                    telegram_id=request.telegram_id,
                    device_name=device_name,
                    session_token=session_token,
                    photo_url=request.photo_url,
                    first_name=request.first_name
                )
            except Exception as notify_err:
                logger.warning(f"⚠️ Не удалось отправить Telegram уведомление: {notify_err}")
        
        asyncio.create_task(_send_telegram_notification())
        
        # Отправляем уведомление через WebSocket если есть активное соединение
        if session_token in web_session_connections:
            try:
                ws = web_session_connections[session_token]
                await ws.send_json({
                    "event": "linked",
                    "data": {
                        "telegram_id": request.telegram_id,
                        "first_name": request.first_name,
                        "last_name": request.last_name,
                        "username": request.username,
                        "photo_url": request.photo_url,
                        "user_settings": user_settings_dict
                    }
                })
                logger.info(f"📤 WebSocket notification sent for session {session_token[:8]}...")
            except Exception as ws_error:
                logger.warning(f"WebSocket send error: {ws_error}")
        
        return WebSessionLinkResponse(
            success=True,
            message="Профиль успешно подключен!",
            session_token=session_token
        )
        
    except Exception as e:
        logger.error(f"Link web session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/web-sessions/{session_token}/scanned")
async def notify_session_scanned(session_token: str, telegram_id: int = Body(...), first_name: str = Body(None), photo_url: str = Body(None)):
    """
    Уведомить веб-клиент о том, что QR-код отсканирован и ожидается подтверждение.
    Вызывается мобильным клиентом при показе модального окна подтверждения.
    Сохраняет данные сканирования в БД для polling-клиентов.
    """
    try:
        # Проверяем существование сессии
        session = await db.web_sessions.find_one({"session_token": session_token})
        if not session:
            raise HTTPException(status_code=404, detail="Сессия не найдена")
        
        # Проверяем что сессия ещё pending (не linked/expired)
        if session.get("status") != WebSessionStatus.PENDING.value:
            raise HTTPException(status_code=400, detail="Сессия уже не ожидает связки")
        
        # Сохраняем данные сканирования в БД — для polling-клиентов
        await db.web_sessions.update_one(
            {"session_token": session_token},
            {"$set": {
                "scanned_by": telegram_id,
                "scanned_first_name": first_name,
                "scanned_photo_url": photo_url,
                "scanned_at": datetime.utcnow()
            }}
        )
        
        # Отправляем через WebSocket
        if session_token in web_session_connections:
            try:
                ws = web_session_connections[session_token]
                await ws.send_json({
                    "event": "scanned",
                    "data": {
                        "telegram_id": telegram_id,
                        "first_name": first_name,
                        "photo_url": photo_url
                    }
                })
                logger.info(f"📱 Session scanned notification sent: {session_token[:8]}...")
            except Exception as ws_error:
                logger.warning(f"WebSocket send error: {ws_error}")
        
        return {"success": True, "message": "Уведомление отправлено"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Scanned notification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/web-sessions/{session_token}/rejected")
async def notify_session_rejected(session_token: str):
    """
    Уведомить веб-клиент о том, что пользователь отклонил подключение.
    Вызывается мобильным клиентом при нажатии "Отмена".
    """
    try:
        # Обновляем статус в БД на EXPIRED, чтобы polling-клиенты тоже узнали
        session = await db.web_sessions.find_one({"session_token": session_token})
        if session and session.get("status") == WebSessionStatus.PENDING.value:
            await db.web_sessions.update_one(
                {"session_token": session_token},
                {"$set": {"status": WebSessionStatus.EXPIRED.value}}
            )
        
        # Отправляем через WebSocket
        if session_token in web_session_connections:
            try:
                ws = web_session_connections[session_token]
                await ws.send_json({
                    "event": "rejected"
                })
                logger.info(f"❌ Session rejected notification sent: {session_token[:8]}...")
            except Exception as ws_error:
                logger.warning(f"WebSocket send error: {ws_error}")
        
        return {"success": True, "message": "Уведомление отправлено"}
        
    except Exception as e:
        logger.error(f"Rejected notification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/web-sessions/user/{telegram_id}/devices", response_model=DevicesListResponse)
async def get_user_devices(telegram_id: int, current_token: str = None):
    """
    Получить список активных устройств пользователя.
    current_token - токен текущей сессии для маркировки.
    """
    try:
        # Получаем все активные (linked) сессии пользователя
        cursor = db.web_sessions.find({
            "telegram_id": telegram_id,
            "status": WebSessionStatus.LINKED.value
        }).sort("linked_at", -1)
        
        sessions = await cursor.to_list(length=100)
        
        devices = []
        for session in sessions:
            device = DeviceInfo(
                session_token=session.get("session_token", ""),
                device_name=session.get("device_name", "Неизвестное устройство"),
                browser=session.get("browser"),
                os=session.get("os"),
                linked_at=session.get("linked_at"),
                last_active=session.get("last_active"),
                is_current=(current_token == session.get("session_token")) if current_token else False
            )
            devices.append(device)
        
        logger.info(f"📱 Found {len(devices)} devices for user {telegram_id}")
        
        return DevicesListResponse(
            devices=devices,
            total=len(devices)
        )
        
    except Exception as e:
        logger.error(f"Get user devices error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/web-sessions/{session_token}/notify-revoked")
async def notify_session_revoked(session_token: str):
    """
    Уведомить веб-клиент о том, что сессия была отозвана.
    Вызывается из telegram_bot при удалении через inline-кнопку.
    """
    try:
        # Отправляем через WebSocket
        if session_token in web_session_connections:
            try:
                ws = web_session_connections[session_token]
                await ws.send_json({
                    "event": "revoked",
                    "message": "Сессия отключена"
                })
                logger.info(f"🔌 Revoked notification sent for session {session_token[:8]}...")
                # Закрываем соединение
                await ws.close()
            except Exception as ws_error:
                logger.warning(f"WebSocket send error: {ws_error}")
            finally:
                if session_token in web_session_connections:
                    del web_session_connections[session_token]
        
        return {"success": True, "message": "Уведомление отправлено"}
        
    except Exception as e:
        logger.error(f"Notify revoked error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/web-sessions/{session_token}/heartbeat")
async def session_heartbeat(session_token: str):
    """
    Обновить last_active для сессии (heartbeat/ping).
    Вызывается периодически из frontend для отслеживания активности.
    Возвращает 404 если сессия удалена или не активна.
    """
    try:
        # Сначала проверяем существует ли сессия вообще
        session = await db.web_sessions.find_one({"session_token": session_token})
        
        if not session:
            # Сессия удалена (revoked)
            raise HTTPException(status_code=404, detail="Сессия не найдена")
        
        if session.get("status") != WebSessionStatus.LINKED.value:
            # Сессия существует, но не активна (expired или pending)
            raise HTTPException(status_code=404, detail="Сессия не активна")
        
        # Обновляем last_active
        await db.web_sessions.update_one(
            {"session_token": session_token},
            {"$set": {"last_active": datetime.utcnow()}}
        )
        
        return {"success": True, "updated_at": datetime.utcnow().isoformat()}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Session heartbeat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@api_router.delete("/web-sessions/{session_token}")
async def revoke_device_session(session_token: str, telegram_id: int):
    """
    Отключить устройство (отозвать сессию).
    telegram_id используется для проверки владельца.
    """
    try:
        # Проверяем, что сессия принадлежит пользователю
        session = await db.web_sessions.find_one({
            "session_token": session_token,
            "telegram_id": telegram_id
        })
        
        if not session:
            raise HTTPException(status_code=404, detail="Сессия не найдена или не принадлежит вам")
        
        # Удаляем сессию
        result = await db.web_sessions.delete_one({"session_token": session_token})
        
        if result.deleted_count > 0:
            logger.info(f"🗑️ Revoked session {session_token[:8]}... for user {telegram_id}")
            
            # Если есть активное WebSocket соединение - закрываем его
            if session_token in web_session_connections:
                try:
                    ws = web_session_connections[session_token]
                    await ws.send_json({"event": "revoked", "message": "Сессия отключена"})
                    await ws.close()
                except:
                    pass
                finally:
                    del web_session_connections[session_token]
            
            return {"success": True, "message": "Устройство отключено"}
        else:
            raise HTTPException(status_code=500, detail="Не удалось удалить сессию")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Revoke device session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/web-sessions/user/{telegram_id}/all")
async def revoke_all_devices(telegram_id: int):
    """
    Отключить все устройства пользователя (удалить все сессии).
    """
    try:
        # Получаем все сессии пользователя для закрытия WebSocket соединений
        sessions = await db.web_sessions.find({
            "telegram_id": telegram_id,
            "status": WebSessionStatus.LINKED.value
        }).to_list(length=100)
        
        # Закрываем WebSocket соединения
        for session in sessions:
            session_token = session.get("session_token")
            if session_token and session_token in web_session_connections:
                try:
                    ws = web_session_connections[session_token]
                    await ws.send_json({"event": "revoked", "message": "Все сессии отключены"})
                    await ws.close()
                except:
                    pass
                finally:
                    if session_token in web_session_connections:
                        del web_session_connections[session_token]
        
        # Удаляем все сессии пользователя
        result = await db.web_sessions.delete_many({
            "telegram_id": telegram_id
        })
        
        logger.info(f"🗑️ Revoked all {result.deleted_count} sessions for user {telegram_id}")
        
        return {
            "success": True, 
            "message": f"Отключено устройств: {result.deleted_count}",
            "deleted_count": result.deleted_count
        }
        
    except Exception as e:
        logger.error(f"Revoke all devices error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ Очистка устаревших сессий ============

async def cleanup_expired_sessions():
    """Удаляет expired и старые pending сессии (старше 30 минут) из БД"""
    try:
        cutoff_time = datetime.utcnow() - timedelta(minutes=30)
        
        # Удаляем expired сессии
        result_expired = await db.web_sessions.delete_many({
            "status": WebSessionStatus.EXPIRED.value
        })
        
        # Удаляем зависшие pending сессии (старше 30 минут)
        result_pending = await db.web_sessions.delete_many({
            "status": WebSessionStatus.PENDING.value,
            "created_at": {"$lt": cutoff_time}
        })
        
        total = result_expired.deleted_count + result_pending.deleted_count
        if total > 0:
            logger.info(f"🧹 Cleaned up {total} stale sessions (expired: {result_expired.deleted_count}, old pending: {result_pending.deleted_count})")
        
        # Очищаем stale WebSocket connections
        stale_tokens = []
        for token, ws in web_session_connections.items():
            try:
                # Проверяем существует ли сессия в БД
                session = await db.web_sessions.find_one({"session_token": token})
                if not session:
                    stale_tokens.append(token)
            except Exception:
                stale_tokens.append(token)
        
        for token in stale_tokens:
            try:
                ws = web_session_connections.pop(token, None)
                if ws:
                    await ws.close()
            except Exception:
                pass
        
        if stale_tokens:
            logger.info(f"🧹 Cleaned up {len(stale_tokens)} stale WebSocket connections")
            
    except Exception as e:
        logger.warning(f"Session cleanup error: {e}")

# Include the router in the main app
app.include_router(api_router)


# ============ WebSocket для Web Sessions (связка Telegram профиля) ============

@app.websocket("/api/ws/session/{session_token}")
async def websocket_session(websocket: WebSocket, session_token: str):
    """
    WebSocket для real-time уведомления о связке/мониторинге сессии.
    - Для PENDING сессий: ждёт событие 'linked'/'scanned'/'rejected'
    - Для LINKED сессий: мониторит событие 'revoked' (вместо закрытия)
    """
    await websocket.accept()
    
    # Проверяем существование сессии
    session = await db.web_sessions.find_one({"session_token": session_token})
    if not session:
        await websocket.send_json({"event": "error", "message": "Сессия не найдена"})
        await websocket.close()
        return
    
    # Для LINKED сессий — режим мониторинга (ждём revoked)
    # НЕ закрываем сразу, а держим соединение для получения revoked событий
    is_monitor_mode = session["status"] == WebSessionStatus.LINKED.value
    
    # Сохраняем соединение
    web_session_connections[session_token] = websocket
    logger.info(f"🔌 WebSocket connected for session {session_token[:8]}... (monitor={is_monitor_mode})")
    
    try:
        # Отправляем подтверждение подключения с текущим статусом
        if is_monitor_mode:
            await websocket.send_json({
                "event": "connected",
                "session_token": session_token,
                "mode": "monitor",
                "status": "linked"
            })
        else:
            await websocket.send_json({"event": "connected", "session_token": session_token})
        
        # Ждём сообщений или отключения
        while True:
            try:
                # Ждём ping/pong для поддержания соединения
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                
                if data == "ping":
                    await websocket.send_text("pong")
                elif data == "check":
                    # Проверяем статус сессии
                    session = await db.web_sessions.find_one({"session_token": session_token})
                    if not session:
                        # Сессия удалена (revoked)
                        await websocket.send_json({"event": "revoked", "message": "Сессия удалена"})
                        break
                    
                    if session["status"] == WebSessionStatus.LINKED.value and not is_monitor_mode:
                        # Сессия связана — отправляем данные
                        await websocket.send_json({
                            "event": "linked",
                            "data": {
                                "telegram_id": session.get("telegram_id"),
                                "first_name": session.get("first_name"),
                                "last_name": session.get("last_name"),
                                "username": session.get("username"),
                                "photo_url": session.get("photo_url"),
                                "user_settings": session.get("user_settings")
                            }
                        })
                        break
                    elif session["status"] == WebSessionStatus.EXPIRED.value:
                        await websocket.send_json({"event": "expired"})
                        break
                        
            except asyncio.TimeoutError:
                # Проверяем статус сессии при timeout
                session = await db.web_sessions.find_one({"session_token": session_token})
                if not session:
                    # Сессия удалена (revoked)
                    await websocket.send_json({"event": "revoked", "message": "Сессия удалена"})
                    break
                
                if session["status"] == WebSessionStatus.LINKED.value and not is_monitor_mode:
                    await websocket.send_json({
                        "event": "linked",
                        "data": {
                            "telegram_id": session.get("telegram_id"),
                            "first_name": session.get("first_name"),
                            "last_name": session.get("last_name"),
                            "username": session.get("username"),
                            "photo_url": session.get("photo_url"),
                            "user_settings": session.get("user_settings")
                        }
                    })
                    break
                elif session.get("expires_at") and datetime.utcnow() > session["expires_at"]:
                    if not is_monitor_mode:
                        await websocket.send_json({"event": "expired"})
                        break
                
                # Отправляем ping для поддержания соединения
                try:
                    await websocket.send_text("ping")
                except Exception:
                    break
                
    except WebSocketDisconnect:
        logger.info(f"🔌 WebSocket disconnected for session {session_token[:8]}...")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        # Удаляем соединение из словаря
        if session_token in web_session_connections:
            del web_session_connections[session_token]


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
        
        # Индексы для системы друзей
        await db.friends.create_index(
            [("user_telegram_id", 1), ("friend_telegram_id", 1)],
            unique=True,
            name="unique_friendship"
        )
        await db.friends.create_index(
            [("user_telegram_id", 1)],
            name="user_friends_index"
        )
        await db.friend_requests.create_index(
            [("from_telegram_id", 1), ("to_telegram_id", 1), ("status", 1)],
            name="friend_request_index"
        )
        await db.friend_requests.create_index(
            [("to_telegram_id", 1), ("status", 1)],
            name="incoming_requests_index"
        )
        await db.user_blocks.create_index(
            [("blocker_telegram_id", 1), ("blocked_telegram_id", 1)],
            unique=True,
            name="unique_block"
        )
        
        # Индексы для in-app уведомлений
        await db.in_app_notifications.create_index(
            [("telegram_id", 1), ("created_at", -1)],
            name="user_notifications_index"
        )
        await db.in_app_notifications.create_index(
            [("telegram_id", 1), ("read", 1), ("dismissed", 1)],
            name="unread_notifications_index"
        )
        
        # Индексы для web_sessions (связка Telegram профиля)
        await db.web_sessions.create_index(
            [("session_token", 1)],
            unique=True,
            name="session_token_index"
        )
        await db.web_sessions.create_index(
            [("telegram_id", 1), ("status", 1)],
            name="user_devices_index"
        )
        # Не используем TTL индекс для linked сессий, только для pending
        
        logger.info("✅ Database indexes created successfully")
    except Exception as e:
        logger.warning(f"Index creation warning (may already exist): {e}")
    
    # Очистка устаревших веб-сессий при старте
    try:
        await cleanup_expired_sessions()
    except Exception as e:
        logger.warning(f"Initial session cleanup failed: {e}")
    
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
        from telegram.ext import Application, CommandHandler, CallbackQueryHandler
        
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
            
            # Регистрируем обработчик callback_query для inline-кнопок устройств
            from telegram_bot import handle_revoke_device_callback
            bot_application.add_handler(CallbackQueryHandler(handle_revoke_device_callback, pattern=r"^revoke_device_"))
            
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
