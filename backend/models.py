"""
Pydantic модели для API расписания РУДН
"""

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Union
from datetime import datetime, timedelta
from enum import Enum
import uuid


# ============ Модели для видео данных ============

class VideoData(BaseModel):
    """Данные видео (YouTube или VK)"""
    url: str
    title: Optional[str] = None
    duration: Optional[str] = None
    thumbnail: Optional[str] = None
    type: str = "youtube"  # "youtube" или "vk"


# ============ Модели для парсера расписания ============

class Faculty(BaseModel):
    """Модель факультета"""
    id: str
    name: str


class FilterOption(BaseModel):
    """Модель опции фильтра (уровень, курс, форма, группа)"""
    value: str
    label: Optional[str] = None
    name: Optional[str] = None
    disabled: bool = False
    
    @field_validator('value', mode='before')
    @classmethod
    def convert_value_to_string(cls, v: Union[str, int]) -> str:
        """Convert integer values to strings"""
        return str(v)


class FilterDataRequest(BaseModel):
    """Запрос данных фильтра"""
    facultet_id: str
    level_id: Optional[str] = ""
    kurs: Optional[str] = ""
    form_code: Optional[str] = ""


class FilterDataResponse(BaseModel):
    """Ответ с данными фильтров"""
    levels: List[FilterOption] = []
    courses: List[FilterOption] = []
    forms: List[FilterOption] = []
    groups: List[FilterOption] = []


class ScheduleRequest(BaseModel):
    """Запрос расписания"""
    facultet_id: str
    level_id: str
    kurs: str
    form_code: str
    group_id: str
    week_number: int = Field(default=1, ge=1, le=2)


class ScheduleEvent(BaseModel):
    """Событие расписания (одна пара)"""
    day: str
    time: str
    discipline: str
    lessonType: str = ""
    teacher: str = ""
    auditory: str = ""
    week: int


class ScheduleResponse(BaseModel):
    """Ответ с расписанием"""
    events: List[ScheduleEvent]
    group_id: str
    week_number: int


# ============ Модели для пользовательских настроек ============

class UserSettings(BaseModel):
    """Настройки пользователя (сохраненная группа)"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    
    # Данные группы
    group_id: str
    group_name: str
    facultet_id: str
    facultet_name: Optional[str] = None
    level_id: str
    kurs: str
    form_code: str
    
    # Настройки уведомлений
    notifications_enabled: bool = False
    notification_time: int = Field(default=10, ge=5, le=30)  # минут до начала пары
    
    # Настройки темы
    new_year_theme_mode: str = "auto"  # Режим новогодней темы: "auto", "always", "off"
    
    # Реферальная система
    referral_code: Optional[str] = None  # уникальный реферальный код пользователя
    referred_by: Optional[int] = None  # telegram_id пригласившего
    referral_points_earned: int = 0  # заработано баллов с рефералов
    
    # Метаданные
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_activity: Optional[datetime] = None


class UserSettingsCreate(BaseModel):
    """Создание/обновление настроек пользователя"""
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    
    group_id: str
    group_name: str
    facultet_id: str
    facultet_name: Optional[str] = None
    level_id: str
    kurs: str
    form_code: str
    
    # Настройки уведомлений (опциональные при создании)
    notifications_enabled: Optional[bool] = False
    notification_time: Optional[int] = 10


class UserSettingsResponse(BaseModel):
    """Ответ с настройками пользователя"""
    id: Optional[str] = None
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    
    group_id: Optional[str] = None
    group_name: Optional[str] = None
    facultet_id: Optional[str] = None
    facultet_name: Optional[str] = None
    level_id: Optional[str] = None
    kurs: Optional[str] = None
    form_code: Optional[str] = None
    
    # Настройки уведомлений
    notifications_enabled: bool = False
    notification_time: int = 10
    
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_activity: Optional[datetime] = None


# ============ Модели для кэша расписания ============

class ScheduleCache(BaseModel):
    """Кэш расписания группы"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    group_id: str
    week_number: int
    events: List[ScheduleEvent]
    cached_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime


# ============ Общие модели ============

class ErrorResponse(BaseModel):
    """Модель ответа с ошибкой"""
    error: str
    detail: Optional[str] = None


class SuccessResponse(BaseModel):
    """Модель успешного ответа"""
    success: bool
    message: str


# ============ Модели для уведомлений ============

class NotificationSettingsUpdate(BaseModel):
    """Обновление настроек уведомлений"""
    notifications_enabled: bool
    notification_time: int = Field(ge=5, le=30)


class NotificationSettingsResponse(BaseModel):
    """Ответ с настройками уведомлений"""
    notifications_enabled: bool
    notification_time: int
    telegram_id: int
    test_notification_sent: Optional[bool] = None
    test_notification_error: Optional[str] = None


class NotificationStatsResponse(BaseModel):
    """Статистика уведомлений за день"""
    date: str
    total: int
    pending: int
    sent: int
    failed: int
    cancelled: int



class NotificationHistoryItem(BaseModel):
    """Элемент истории уведомлений"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    telegram_id: int
    title: str  # Заголовок (например, название предмета)
    message: str  # Текст (время, аудитория)
    sent_at: datetime = Field(default_factory=datetime.utcnow)
    read: bool = False  # Прочитано ли (на будущее)


class NotificationHistoryResponse(BaseModel):
    """Ответ с историей"""
    history: List[NotificationHistoryItem]
    count: int


# ============ Модели для настроек темы ============

class ThemeMode(str, Enum):
    """Режимы новогодней темы"""
    AUTO = "auto"      # Автоматически (только зимой: Dec/Jan/Feb)
    ALWAYS = "always"  # Всегда (круглый год)
    OFF = "off"        # Выключено

class ThemeSettingsUpdate(BaseModel):
    """Обновление настроек темы"""
    new_year_theme_mode: ThemeMode = ThemeMode.AUTO


class ThemeSettingsResponse(BaseModel):
    """Ответ с настройками темы"""
    new_year_theme_mode: str
    telegram_id: int


# ============ Модели для достижений ============

class Achievement(BaseModel):
    """Модель достижения"""
    id: str
    name: str
    description: str
    emoji: str
    points: int
    type: str  # first_group, group_explorer, social_butterfly, schedule_gourmet, night_owl, early_bird
    requirement: int  # Необходимое количество для получения
    

class UserAchievement(BaseModel):
    """Достижение пользователя"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    telegram_id: int
    achievement_id: str
    earned_at: datetime = Field(default_factory=datetime.utcnow)
    seen: bool = False  # Просмотрено ли уведомление
    

class UserStats(BaseModel):
    """Статистика пользователя для достижений"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    telegram_id: int
    
    # Счетчики для достижений
    groups_viewed: int = 0  # Количество просмотренных групп
    unique_groups: List[str] = []  # Уникальные ID групп
    friends_invited: int = 0  # Количество приглашенных друзей
    schedule_views: int = 0  # Количество просмотров расписания (общий счетчик)
    detailed_views: int = 0  # Количество детальных просмотров (развернутые карточки)
    night_usage_count: int = 0  # Использование после 00:00
    early_usage_count: int = 0  # Использование до 08:00
    first_group_selected: bool = False  # Выбрана ли первая группа
    
    # Новые счетчики для исследования приложения
    analytics_views: int = 0  # Количество просмотров аналитики
    calendar_opens: int = 0  # Количество открытий календаря
    notifications_configured: bool = False  # Настроены ли уведомления
    schedule_shares: int = 0  # Количество поделившихся расписанием
    menu_items_visited: List[str] = []  # Посещённые пункты меню
    active_days: List[str] = []  # Дни активности (даты в формате YYYY-MM-DD)
    
    # Счетчики для достижений "Список дел"
    tasks_created_total: int = 0  # Всего создано задач
    tasks_completed_total: int = 0  # Всего выполнено задач
    tasks_completed_today: int = 0  # Задач выполнено сегодня
    tasks_completed_early: int = 0  # Задач выполнено до 9:00
    tasks_completed_on_time: int = 0  # Задач выполнено в срок (без просрочки)
    task_streak_days: int = 0  # Дней подряд выполнения задач
    task_streak_current: int = 0  # Текущая серия дней
    last_task_completion_date: Optional[str] = None  # Дата последнего выполнения (YYYY-MM-DD)
    last_daily_reset: Optional[str] = None  # Дата последнего сброса счетчика дня
    first_task_created: bool = False  # Создана ли первая задача
    
    # Счетчики для достижений за друзей
    friends_count: int = 0  # Количество друзей
    friends_faculties_count: int = 0  # Количество разных факультетов друзей
    users_invited: int = 0  # Количество приглашенных новых пользователей
    
    # Общая статистика
    total_points: int = 0  # Всего очков
    achievements_count: int = 0  # Количество достижений
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class UserStatsResponse(BaseModel):
    """Ответ со статистикой пользователя"""
    telegram_id: int
    groups_viewed: int
    friends_invited: int
    schedule_views: int
    detailed_views: int
    night_usage_count: int
    early_usage_count: int
    # Task-related fields for new achievements
    tasks_created_total: int = 0
    tasks_completed_total: int = 0
    tasks_completed_today: int = 0
    tasks_completed_early: int = 0
    tasks_completed_on_time: int = 0
    task_streak_current: int = 0
    first_task_created: bool = False
    total_points: int
    achievements_count: int


class UserAchievementResponse(BaseModel):
    """Ответ с достижением пользователя"""
    achievement: Achievement
    earned_at: datetime
    seen: bool


class TrackActionRequest(BaseModel):
    """Запрос на отслеживание действия пользователя"""
    telegram_id: int
    action_type: str  # view_schedule, view_group, invite_friend, night_usage, early_usage, select_group
    metadata: Optional[dict] = {}


class NewAchievementsResponse(BaseModel):
    """Ответ с новыми достижениями"""
    new_achievements: List[Achievement]
    total_points_earned: int


# ============ Модели для погоды ============

class WeatherResponse(BaseModel):
    """Ответ с данными о погоде"""
    temperature: int  # Температура в °C
    feels_like: int  # Ощущается как
    humidity: int  # Влажность в %
    wind_speed: int  # Скорость ветра в км/ч
    description: str  # Описание погоды
    icon: str  # Иконка погоды (код)


# ============ Модели для информации о боте ============

class BotInfo(BaseModel):
    """Информация о боте"""
    username: str  # Username бота (например, @rudn_mosbot)
    first_name: str  # Имя бота
    id: int  # ID бота
    can_join_groups: bool = False
    can_read_all_group_messages: bool = False
    supports_inline_queries: bool = False


# ============ Модели для списка дел ============

class TaskSubtask(BaseModel):
    """Подзадача для личной задачи"""
    subtask_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    completed: bool = False
    completed_at: Optional[datetime] = None
    order: int = 0


class Task(BaseModel):
    """Модель задачи"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    telegram_id: int
    text: str
    completed: bool = False
    completed_at: Optional[datetime] = None  # Дата и время выполнения задачи
    skipped: bool = False  # Пропущено ли событие
    
    # Новые поля
    category: Optional[str] = None  # Категория: 'study', 'personal', 'sport', 'project'
    priority: Optional[str] = 'medium'  # Приоритет: 'low', 'medium', 'high'
    deadline: Optional[datetime] = None  # Дедлайн задачи (для реальных сроков)
    target_date: Optional[datetime] = None  # Целевая дата задачи (день, к которому привязана задача)
    subject: Optional[str] = None  # Привязка к предмету из расписания
    discipline_id: Optional[str] = None  # ID дисциплины (для интеграции с расписанием)
    notes: Optional[str] = None  # Заметки/описание
    
    # Подзадачи (чек-листы)
    subtasks: List[TaskSubtask] = []
    
    # Planner fields
    time_start: Optional[str] = None  # HH:MM
    time_end: Optional[str] = None    # HH:MM
    is_fixed: bool = False            # Жесткое событие (нельзя двигать)
    origin: str = "user"              # 'user', 'schedule'
    
    order: int = 0  # Порядок задачи для drag & drop (меньше = выше в списке)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class TaskCreate(BaseModel):
    """Запрос создания задачи"""
    telegram_id: int
    text: str
    category: Optional[str] = None
    priority: Optional[str] = 'medium'
    deadline: Optional[datetime] = None
    target_date: Optional[datetime] = None
    subject: Optional[str] = None
    discipline_id: Optional[str] = None
    notes: Optional[str] = None
    time_start: Optional[str] = None
    time_end: Optional[str] = None
    is_fixed: bool = False
    origin: str = "user"
    subtasks: List[str] = []  # Названия подзадач при создании
    # Массив видео (поддержка нескольких ссылок YouTube и VK)
    videos: List[VideoData] = []


class TaskUpdate(BaseModel):
    """Запрос обновления задачи"""
    text: Optional[str] = None
    completed: Optional[bool] = None
    skipped: Optional[bool] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    deadline: Optional[datetime] = None
    target_date: Optional[datetime] = None
    subject: Optional[str] = None
    discipline_id: Optional[str] = None
    notes: Optional[str] = None
    time_start: Optional[str] = None
    time_end: Optional[str] = None
    is_fixed: Optional[bool] = None
    origin: Optional[str] = None
    order: Optional[int] = None
    # Массив видео (поддержка нескольких ссылок YouTube и VK)
    videos: Optional[List[VideoData]] = None


class TaskResponse(BaseModel):
    """Ответ с задачей"""
    id: str
    telegram_id: int
    text: str
    completed: bool
    completed_at: Optional[datetime] = None
    skipped: bool = False
    category: Optional[str] = None
    priority: Optional[str] = 'medium'
    deadline: Optional[datetime] = None
    target_date: Optional[datetime] = None
    subject: Optional[str] = None
    discipline_id: Optional[str] = None
    time_start: Optional[str] = None
    time_end: Optional[str] = None
    is_fixed: bool = False
    origin: str = "user"
    order: int = 0
    created_at: datetime
    updated_at: datetime
    # Подзадачи
    subtasks: List[TaskSubtask] = []
    # Прогресс по подзадачам
    subtasks_progress: int = 0  # Процент выполнения подзадач (0-100)
    subtasks_completed: int = 0  # Количество выполненных подзадач
    subtasks_total: int = 0  # Общее количество подзадач
    # Дополнительные поля для событий расписания
    teacher: Optional[str] = None
    auditory: Optional[str] = None
    lessonType: Optional[str] = None
    # Массив видео (YouTube и VK)
    videos: List[VideoData] = []


class YouTubeInfoResponse(BaseModel):
    """Ответ с информацией о YouTube видео"""
    url: str
    video_id: str
    title: str
    duration: str  # Формат: "MM:SS" или "HH:MM:SS"
    duration_seconds: int
    thumbnail: str
    channel: Optional[str] = None


class VKVideoInfoResponse(BaseModel):
    """Ответ с информацией о VK видео"""
    url: str
    video_id: str
    title: str
    duration: str  # Формат: "MM:SS" или "HH:MM:SS"
    duration_seconds: int
    thumbnail: str
    channel: Optional[str] = None


class TaskProductivityStats(BaseModel):
    """Статистика продуктивности по задачам"""
    total_completed: int = 0  # Всего выполнено задач
    completed_today: int = 0  # Выполнено сегодня
    completed_this_week: int = 0  # Выполнено на этой неделе
    completed_this_month: int = 0  # Выполнено в этом месяце
    current_streak: int = 0  # Текущая серия дней подряд
    best_streak: int = 0  # Лучшая серия дней
    streak_dates: List[str] = []  # Даты текущего стрика для отображения
    daily_stats: List[dict] = []  # Статистика по дням за последние 7 дней


class TaskReorderItem(BaseModel):
    """Элемент для изменения порядка задач"""
    id: str
    order: int


class TaskReorderRequest(BaseModel):
    """Запрос на изменение порядка задач"""
    tasks: List[TaskReorderItem]


class TaskSubtaskCreate(BaseModel):
    """Запрос создания подзадачи для личной задачи"""
    title: str


class TaskSubtaskUpdate(BaseModel):
    """Запрос обновления подзадачи для личной задачи"""
    title: Optional[str] = None
    completed: Optional[bool] = None


# ============ Модели для планировщика ============

class PlannerSyncRequest(BaseModel):
    """Запрос синхронизации расписания в планировщик"""
    telegram_id: int
    date: str  # YYYY-MM-DD
    week_number: int = 1  # Номер недели (1 или 2)


class PlannerSyncResponse(BaseModel):
    """Ответ синхронизации планировщика"""
    success: bool
    synced_count: int  # Количество добавленных событий
    events: List[TaskResponse]  # Список добавленных событий
    message: str


class PlannerDayRequest(BaseModel):
    """Запрос событий дня"""
    telegram_id: int
    date: str  # YYYY-MM-DD


class PlannerDayResponse(BaseModel):
    """Ответ со списком событий дня"""
    date: str
    events: List[TaskResponse]  # Все события (пары + пользовательские) отсортированные по времени
    total_count: int


# ============ Модели для предварительного просмотра синхронизации ============

class ScheduleEventPreview(BaseModel):
    """Пара из расписания для предварительного просмотра"""
    id: str  # Уникальный идентификатор события (generated)
    discipline: str  # Название предмета
    time: str  # Время (полное, например "10:00-11:30")
    time_start: str  # Время начала
    time_end: str  # Время окончания
    teacher: Optional[str] = None
    auditory: Optional[str] = None
    lessonType: Optional[str] = None
    selected: bool = True  # Выбрано ли для синхронизации
    already_synced: bool = False  # Уже синхронизировано


class PlannerPreviewRequest(BaseModel):
    """Запрос предварительного просмотра пар для синхронизации"""
    telegram_id: int
    date: str  # YYYY-MM-DD
    week_number: int = 1


class PlannerPreviewResponse(BaseModel):
    """Ответ с предварительным списком пар для синхронизации"""
    success: bool
    date: str
    day_name: str  # День недели на русском
    events: List[ScheduleEventPreview]
    total_count: int
    already_synced_count: int
    message: str


class ScheduleEventToSync(BaseModel):
    """Событие для синхронизации (может быть отредактировано)"""
    id: str  # Идентификатор из preview
    discipline: str
    time_start: str
    time_end: str
    teacher: Optional[str] = None
    auditory: Optional[str] = None
    lessonType: Optional[str] = None


class PlannerSyncSelectedRequest(BaseModel):
    """Запрос синхронизации выбранных пар"""
    telegram_id: int
    date: str  # YYYY-MM-DD
    events: List[ScheduleEventToSync]


# ============ Модели для групповых задач ============

class GroupTaskParticipant(BaseModel):
    """Участник групповой задачи"""
    telegram_id: int
    username: Optional[str] = None
    first_name: str
    joined_at: datetime = Field(default_factory=datetime.utcnow)
    completed: bool = False
    completed_at: Optional[datetime] = None
    role: str = 'member'  # 'owner' или 'member'


class Subtask(BaseModel):
    """Подзадача"""
    subtask_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    completed: bool = False
    completed_by: Optional[int] = None
    completed_at: Optional[datetime] = None
    order: int = 0


class GroupTask(BaseModel):
    """Модель групповой задачи"""
    task_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = None
    deadline: Optional[datetime] = None
    category: Optional[str] = None
    priority: str = 'medium'  # 'low', 'medium', 'high'
    owner_id: int  # telegram_id владельца
    room_id: Optional[str] = None  # ID комнаты, к которой привязана задача
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = 'created'  # 'created', 'in_progress', 'completed', 'overdue'
    participants: List[GroupTaskParticipant] = []
    invite_token: str = Field(default_factory=lambda: str(uuid.uuid4())[:12])
    notification_settings: dict = {
        'enabled': True,
        'notify_on_join': True,
        'notify_on_complete': True,
        'notify_on_comment': True
    }
    tags: List[str] = []  # Теги/метки для задачи
    subtasks: List[Subtask] = []  # Подзадачи
    order: int = 0  # Порядок для drag & drop


class GroupTaskCreate(BaseModel):
    """Запрос создания групповой задачи"""
    title: str
    description: Optional[str] = None
    deadline: Optional[datetime] = None
    category: Optional[str] = None
    priority: str = 'medium'
    telegram_id: int  # создатель
    room_id: Optional[str] = None  # ID комнаты (если задача создается в комнате)
    invited_users: List[int] = []  # список telegram_id приглашённых


class GroupTaskResponse(BaseModel):
    """Ответ с групповой задачей"""
    task_id: str
    title: str
    description: Optional[str] = None
    deadline: Optional[datetime] = None
    category: Optional[str] = None
    priority: str
    owner_id: int
    room_id: Optional[str] = None  # ID комнаты
    created_at: datetime
    updated_at: datetime
    status: str
    participants: List[GroupTaskParticipant]
    invite_token: str
    completion_percentage: int = 0  # процент выполнения
    total_participants: int = 0
    completed_participants: int = 0
    tags: List[str] = []  # Теги/метки
    subtasks: List[Subtask] = []  # Подзадачи
    order: int = 0  # Порядок для drag & drop
    comments_count: int = 0  # Количество комментариев


class GroupTaskComment(BaseModel):
    """Комментарий к групповой задаче"""
    comment_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str
    telegram_id: int
    username: Optional[str] = None
    first_name: str
    text: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    edited: bool = False
    edited_at: Optional[datetime] = None


class GroupTaskCommentCreate(BaseModel):
    """Запрос создания комментария"""
    task_id: str
    telegram_id: int
    text: str


class GroupTaskCommentResponse(BaseModel):
    """Ответ с комментарием"""
    comment_id: str
    task_id: str
    telegram_id: int
    username: Optional[str] = None
    first_name: str
    text: str
    created_at: datetime
    edited: bool
    edited_at: Optional[datetime] = None


class GroupTaskInvite(BaseModel):
    """Приглашение в групповую задачу"""
    invite_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str
    invited_by: int  # telegram_id пригласившего
    invited_user: int  # telegram_id приглашённого
    status: str = 'pending'  # 'pending', 'accepted', 'declined'
    created_at: datetime = Field(default_factory=datetime.utcnow)
    responded_at: Optional[datetime] = None


class GroupTaskInviteCreate(BaseModel):
    """Запрос приглашения пользователя"""
    task_id: str
    telegram_id: int  # кто приглашает
    invited_user: int  # кого приглашают


class GroupTaskInviteResponse(BaseModel):
    """Ответ о приглашении"""
    invite_id: str
    task_id: str
    task_title: str
    invited_by: int
    invited_by_name: str
    status: str
    created_at: datetime


class GroupTaskCompleteRequest(BaseModel):
    """Запрос на отметку выполнения"""
    task_id: str
    telegram_id: int
    completed: bool



# ============ Модели для комнат (Rooms) ============

class RoomParticipant(BaseModel):
    """Участник комнаты"""
    telegram_id: int
    username: Optional[str] = None
    first_name: str
    joined_at: datetime = Field(default_factory=datetime.utcnow)
    role: str = 'member'  # 'owner', 'admin', 'moderator', 'member', 'viewer'
    referral_code: Optional[int] = None  # ID пользователя, который пригласил
    tasks_completed: int = 0  # Количество выполненных задач
    tasks_created: int = 0  # Количество созданных задач
    last_activity: Optional[datetime] = None  # Последняя активность


class Room(BaseModel):
    """Модель комнаты с групповыми задачами"""
    room_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # Название комнаты (например, "Экзамен по математике")
    description: Optional[str] = None
    owner_id: int  # telegram_id владельца
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    participants: List[RoomParticipant] = []
    invite_token: str = Field(default_factory=lambda: str(uuid.uuid4())[:12])  # короткий токен для ссылки
    color: str = 'blue'  # цвет комнаты (для UI)


class RoomCreate(BaseModel):
    """Запрос создания комнаты"""
    name: str
    description: Optional[str] = None
    telegram_id: int  # создатель
    color: str = 'blue'


class RoomResponse(BaseModel):
    """Ответ с комнатой"""
    room_id: str
    name: str
    description: Optional[str] = None
    owner_id: int
    created_at: datetime
    updated_at: datetime
    participants: List[RoomParticipant]
    invite_token: str
    color: str
    total_participants: int = 0
    total_tasks: int = 0
    completed_tasks: int = 0
    completion_percentage: int = 0  # процент выполнения всех задач комнаты


class RoomInviteLinkResponse(BaseModel):
    """Ответ с ссылкой-приглашением в комнату"""
    invite_link: str
    invite_token: str
    room_id: str
    bot_username: str


class RoomJoinRequest(BaseModel):
    """Запрос на присоединение к комнате по токену"""
    telegram_id: int
    username: Optional[str] = None
    first_name: str
    referral_code: Optional[int] = None  # ID пользователя, который пригласил


class RoomTaskCreate(BaseModel):
    """Запрос создания задачи в комнате"""
    title: str
    description: Optional[str] = None
    deadline: Optional[datetime] = None
    category: Optional[str] = None
    priority: str = 'medium'
    telegram_id: int  # создатель задачи
    tags: List[str] = []  # Теги для задачи
    subtasks: List[str] = []  # Названия подзадач
    assigned_to: Optional[List[int]] = None  # Список telegram_id участников (None = все участники)


class SubtaskCreate(BaseModel):
    """Запрос создания подзадачи"""
    title: str


class SubtaskUpdate(BaseModel):
    """Запрос обновления подзадачи"""
    subtask_id: str
    title: Optional[str] = None
    completed: Optional[bool] = None


class GroupTaskUpdate(BaseModel):
    """Запрос обновления групповой задачи"""
    title: Optional[str] = None
    description: Optional[str] = None
    deadline: Optional[datetime] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None
    assigned_to: Optional[List[int]] = None  # Список telegram_id участников (None = не менять, [] = все участники)


class RoomActivity(BaseModel):
    """Активность в комнате"""
    activity_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_id: str
    user_id: int
    username: Optional[str] = None
    first_name: str
    action_type: str  # 'task_created', 'task_completed', 'task_deleted', 'comment_added', 'user_joined', 'user_left'
    action_details: dict = {}  # Детали действия (название задачи, текст комментария и т.д.)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class RoomActivityResponse(BaseModel):
    """Ответ с активностью комнаты"""
    activity_id: str
    room_id: str
    user_id: int
    username: Optional[str]
    first_name: str
    action_type: str
    action_details: dict
    created_at: datetime


class RoomStatsResponse(BaseModel):
    """Статистика комнаты"""
    room_id: str
    total_tasks: int
    completed_tasks: int
    overdue_tasks: int
    in_progress_tasks: int
    completion_percentage: int
    participants_stats: List[dict]  # Статистика по каждому участнику
    activity_chart: List[dict]  # График активности по дням


class ParticipantRoleUpdate(BaseModel):
    """Запрос на изменение роли участника"""
    room_id: str
    telegram_id: int  # кого меняем
    new_role: str  # новая роль
    changed_by: int  # кто меняет



class RoomUpdate(BaseModel):
    """Запрос на обновление комнаты"""
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


class RoomTaskReorderRequest(BaseModel):
    """Запрос на изменение порядка задач"""
    room_id: str
    tasks: List[dict]  # [{"task_id": "...", "order": 0}, ...]


class RoomFriendToAdd(BaseModel):
    """Друг для добавления в комнату"""
    telegram_id: int
    username: Optional[str] = None
    first_name: str


class RoomAddFriendsRequest(BaseModel):
    """Запрос на добавление друзей в комнату"""
    telegram_id: int  # Кто добавляет
    friends: List[RoomFriendToAdd]  # Список друзей для добавления


# ============ Модели для админ панели ============

class AdminStatsResponse(BaseModel):
    """Общая статистика для админ панели"""
    total_users: int
    active_users_today: int
    active_users_week: int
    active_users_month: int
    new_users_today: int
    new_users_week: int
    new_users_month: int
    total_tasks: int
    total_completed_tasks: int
    total_achievements_earned: int
    total_rooms: int
    total_schedule_views: int
    # Новые поля для отслеживания присоединений
    total_room_joins: int = 0  # Всего присоединений к комнатам
    room_joins_today: int = 0  # Присоединений к комнатам сегодня
    room_joins_week: int = 0  # Присоединений к комнатам за неделю
    total_journal_joins: int = 0  # Всего присоединений к журналам
    journal_joins_today: int = 0  # Присоединений к журналам сегодня
    journal_joins_week: int = 0  # Присоединений к журналам за неделю
    total_journals: int = 0  # Всего журналов


class UserActivityPoint(BaseModel):
    """Точка данных для графика активности"""
    date: str  # YYYY-MM-DD
    count: int


class HourlyActivityPoint(BaseModel):
    """Точка данных для графика активности по часам"""
    hour: int  # 0-23
    count: int


class FeatureUsageStats(BaseModel):
    """Статистика использования функций"""
    schedule_views: int
    analytics_views: int
    calendar_opens: int
    notifications_configured: int
    schedule_shares: int
    tasks_created: int
    achievements_earned: int


class TopUser(BaseModel):
    """Топ пользователь"""
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    value: int  # значение метрики (очки, достижения, активность)
    group_name: Optional[str] = None


class AdminSendNotificationRequest(BaseModel):
    """Запрос на отправку уведомления от админа"""
    telegram_id: int  # Кому отправить
    title: str  # Заголовок
    message: str  # Текст сообщения
    notification_type: str = "admin_message"  # Тип уведомления
    category: str = "system"  # Категория
    send_in_app: bool = True  # Отправить в приложение
    send_telegram: bool = False  # Отправить в Telegram


class FacultyStats(BaseModel):
    """Статистика по факультету"""
    faculty_name: str
    users_count: int
    faculty_id: Optional[str] = None


class CourseStats(BaseModel):
    """Статистика по курсам"""
    course: str
    users_count: int


# ============ Модели для реферальной системы ============

class ReferralUser(BaseModel):
    """Информация о реферале"""
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    registered_at: datetime
    level: int  # уровень в реферальной цепочке (1, 2, 3)
    total_points: int = 0  # сколько баллов заработал сам реферал
    points_earned_for_referrer: int = 0  # сколько баллов принёс пригласившему


class ReferralStats(BaseModel):
    """Статистика по рефералам"""
    telegram_id: int
    referral_code: str
    referral_link: str
    
    # Статистика по уровням
    level_1_count: int = 0  # прямые рефералы (50%)
    level_2_count: int = 0  # рефералы второго уровня (25%)
    level_3_count: int = 0  # рефералы третьего уровня (10%)
    
    # Заработанные баллы
    total_referral_points: int = 0  # всего заработано баллов с рефералов
    level_1_points: int = 0  # заработано с 1 уровня
    level_2_points: int = 0  # заработано со 2 уровня
    level_3_points: int = 0  # заработано с 3 уровня
    
    # Списки рефералов по уровням
    level_1_referrals: List[ReferralUser] = []
    level_2_referrals: List[ReferralUser] = []
    level_3_referrals: List[ReferralUser] = []


class ReferralTreeNode(BaseModel):
    """Узел дерева рефералов"""
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    level: int
    total_points: int
    children: List['ReferralTreeNode'] = []
    registered_at: datetime


class ReferralCodeResponse(BaseModel):
    """Ответ с реферальным кодом"""
    referral_code: str
    referral_link: str
    referral_link_webapp: str = ""  # Ссылка через Web App (t.me/bot/app?startapp=)
    bot_username: str


class ProcessReferralRequest(BaseModel):
    """Запрос на обработку реферального кода через Web App"""
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    referral_code: str  # Код без префикса ref_


class ProcessReferralResponse(BaseModel):
    """Ответ на обработку реферального кода"""
    success: bool
    message: str
    referrer_name: Optional[str] = None
    bonus_points: int = 0


class ReferralConnection(BaseModel):
    """Связь между пользователем и пригласившим"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    referrer_telegram_id: int  # кто пригласил
    referred_telegram_id: int  # кого пригласили
    level: int  # уровень в цепочке от root referrer (1, 2, 3)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    points_earned: int = 0  # сколько баллов referrer заработал с этого реферала



# ============ Модели для журнала посещений ============

class AttendanceStatus(str):
    """Статусы посещаемости"""
    PRESENT = "present"      # Присутствовал
    ABSENT = "absent"        # Отсутствовал
    EXCUSED = "excused"      # Уважительная причина
    LATE = "late"            # Опоздал
    UNMARKED = "unmarked"    # Не отмечен


class JournalSettings(BaseModel):
    """Настройки журнала"""
    allow_self_mark: bool = False        # Могут ли участники отмечаться сами
    show_group_stats: bool = True        # Показывать общую статистику
    absence_reasons: List[str] = ["Болезнь", "Уважительная", "Семейные обстоятельства"]


class AttendanceJournal(BaseModel):
    """Модель журнала посещений"""
    journal_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str                            # Название журнала (предмет)
    group_name: str                      # Название группы
    description: Optional[str] = None    # Описание (семестр, год и т.д.)
    owner_id: int                        # Telegram ID старосты
    color: str = "purple"                # Цвет для UI
    invite_token: str = Field(default_factory=lambda: str(uuid.uuid4())[:12])
    settings: JournalSettings = Field(default_factory=JournalSettings)
    stats_viewers: List[int] = []        # Telegram ID пользователей с доступом к статистике (кроме owner)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class JournalCreate(BaseModel):
    """Запрос на создание журнала"""
    name: str
    group_name: str
    description: Optional[str] = None
    telegram_id: int                     # Создатель (староста)
    color: str = "purple"


class JournalStudent(BaseModel):
    """Студент в журнале"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    journal_id: str
    full_name: str                       # ФИО из списка
    telegram_id: Optional[int] = None    # После привязки
    username: Optional[str] = None       # После привязки
    first_name: Optional[str] = None     # После привязки
    is_linked: bool = False              # Привязан ли к Telegram
    linked_at: Optional[datetime] = None # Когда привязан
    order: int = 0                       # Порядок в списке
    invite_code: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])  # Уникальный код для персональной ссылки
    created_at: datetime = Field(default_factory=datetime.utcnow)


class JournalStudentCreate(BaseModel):
    """Запрос на добавление студента"""
    full_name: str


class JournalStudentBulkCreate(BaseModel):
    """Массовое добавление студентов"""
    names: List[str]                     # Список ФИО


class JournalStudentFromFriend(BaseModel):
    """Друг для добавления в журнал"""
    telegram_id: int
    full_name: str
    username: Optional[str] = None
    first_name: Optional[str] = None


class JournalStudentsFromFriendsCreate(BaseModel):
    """Массовое добавление друзей в журнал как студентов"""
    friends: List[JournalStudentFromFriend]  # Список друзей


class JournalStudentLink(BaseModel):
    """Привязка Telegram к ФИО"""
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None


class JournalSubject(BaseModel):
    """Предмет в журнале (страница журнала)"""
    subject_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    journal_id: str
    name: str                            # Название предмета
    description: Optional[str] = None    # Описание
    color: str = "blue"                  # Цвет для UI
    order: int = 0                       # Порядок в списке
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: int                      # Кто создал


class JournalSubjectCreate(BaseModel):
    """Запрос на создание предмета"""
    name: str
    description: Optional[str] = None
    color: str = "blue"
    telegram_id: int                     # Кто создаёт


class JournalSession(BaseModel):
    """Занятие в журнале"""
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    journal_id: str
    subject_id: str                      # К какому предмету относится
    date: str                            # YYYY-MM-DD
    title: str                           # Название занятия
    description: Optional[str] = None
    type: str = "lecture"                # lecture, seminar, lab, exam
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: int                      # Кто создал


class JournalSessionCreate(BaseModel):
    """Запрос на создание занятия"""
    subject_id: str                      # К какому предмету
    date: str                            # YYYY-MM-DD
    title: str
    description: Optional[str] = None
    type: str = "lecture"
    telegram_id: int                     # Кто создаёт


class ScheduleSessionItem(BaseModel):
    """Элемент занятия из расписания"""
    date: str                            # YYYY-MM-DD
    time: str                            # Время занятия (09:00-10:30)
    discipline: str                      # Название предмета
    lesson_type: str                     # Тип (лекция, семинар и т.д.)
    teacher: Optional[str] = None
    auditory: Optional[str] = None


class CreateSessionsFromScheduleRequest(BaseModel):
    """Запрос на создание занятий из расписания"""
    subject_id: str                      # К какому предмету
    telegram_id: int                     # Кто создаёт
    sessions: List[ScheduleSessionItem]  # Список занятий из расписания


class AttendanceRecord(BaseModel):
    """Запись посещаемости"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    journal_id: str
    session_id: str
    student_id: str                      # ID из journal_students
    status: str = "unmarked"             # present, absent, excused, late, unmarked
    grade: Optional[int] = None          # Оценка (1-5), None если не выставлена
    reason: Optional[str] = None         # Причина (если есть)
    note: Optional[str] = None           # Заметка
    marked_by: int                       # Кто отметил
    marked_at: datetime = Field(default_factory=datetime.utcnow)


class AttendanceRecordCreate(BaseModel):
    """Запрос на отметку посещаемости"""
    student_id: str
    status: str
    grade: Optional[int] = None          # Оценка (1-5), None если не выставлена
    reason: Optional[str] = None
    note: Optional[str] = None


class AttendanceBulkCreate(BaseModel):
    """Массовая отметка посещаемости"""
    records: List[AttendanceRecordCreate]
    telegram_id: int                     # Кто отмечает


class JournalPendingMember(BaseModel):
    """Ожидающий привязки участник"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    journal_id: str
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    joined_at: datetime = Field(default_factory=datetime.utcnow)
    is_linked: bool = False


class JournalJoinRequest(BaseModel):
    """Запрос на присоединение к журналу"""
    invite_token: str
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    referrer_id: Optional[int] = None  # ID пользователя, который пригласил


class JournalJoinApplication(BaseModel):
    """Заявка на вступление в журнал (ожидает одобрения старосты)"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    journal_id: str
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    status: str = "pending"  # pending, approved, rejected
    created_at: datetime = Field(default_factory=datetime.utcnow)
    processed_at: Optional[datetime] = None
    linked_student_id: Optional[str] = None  # К какому студенту привязали


class ProcessJournalApplicationRequest(BaseModel):
    """Запрос на обработку заявки в журнал"""
    application_id: str
    action: str  # approve, reject
    student_id: Optional[str] = None  # ID студента для привязки (при approve)
    owner_telegram_id: int  # ID старосты, который обрабатывает


# ===== Response модели =====

class JournalResponse(BaseModel):
    """Ответ с журналом"""
    journal_id: str
    name: str
    group_name: str
    description: Optional[str]
    owner_id: int
    color: str
    invite_token: str
    settings: JournalSettings
    stats_viewers: List[int] = []        # Кто может смотреть статистику
    created_at: datetime
    updated_at: datetime
    total_students: int = 0
    linked_students: int = 0
    total_sessions: int = 0
    is_owner: bool = False
    can_view_stats: bool = False         # Может ли текущий пользователь видеть статистику
    is_linked: bool = False              # Привязан ли текущий пользователь как студент
    my_attendance_percent: Optional[float] = None


class JournalStudentResponse(BaseModel):
    """Ответ со студентом"""
    id: str
    journal_id: str
    full_name: str
    telegram_id: Optional[int]
    username: Optional[str]
    first_name: Optional[str]
    is_linked: bool
    linked_at: Optional[datetime]
    order: int
    invite_code: str = ""                      # Код для персональной ссылки
    invite_link: Optional[str] = None          # Полная ссылка для приглашения (старый формат)
    invite_link_webapp: Optional[str] = None   # Ссылка через Web App (новый формат)
    attendance_percent: Optional[float] = None
    present_count: int = 0
    absent_count: int = 0
    excused_count: int = 0
    late_count: int = 0
    total_sessions: int = 0
    # Оценки
    average_grade: Optional[float] = None      # Средняя оценка
    grades_count: int = 0                       # Количество оценок
    grade_5_count: int = 0                      # Количество "5"
    grade_4_count: int = 0                      # Количество "4"
    grade_3_count: int = 0                      # Количество "3"
    grade_2_count: int = 0                      # Количество "2"
    grade_1_count: int = 0                      # Количество "1"


class JournalSessionResponse(BaseModel):
    """Ответ с занятием"""
    session_id: str
    journal_id: str
    date: str
    title: str
    description: Optional[str]
    type: str
    created_at: datetime
    created_by: int
    attendance_filled: int = 0           # Сколько отмечено
    total_students: int = 0              # Всего студентов
    present_count: int = 0
    absent_count: int = 0
    # Оценки
    grades_count: int = 0                 # Сколько выставлено оценок
    average_grade: Optional[float] = None # Средняя оценка за занятие


class AttendanceRecordResponse(BaseModel):
    """Ответ с записью посещаемости"""
    id: str
    journal_id: str
    session_id: str
    student_id: str
    student_name: str
    status: str
    grade: Optional[int] = None           # Оценка (1-5)
    reason: Optional[str]
    note: Optional[str]
    marked_by: int
    marked_at: datetime


class SubjectStatsResponse(BaseModel):
    """Статистика по предмету"""
    subject_id: str
    subject_name: str
    subject_color: str
    total_sessions: int
    present_count: int
    absent_count: int
    late_count: int
    excused_count: int
    attendance_percent: float


class JournalStatsResponse(BaseModel):
    """Статистика журнала"""
    journal_id: str
    total_students: int
    linked_students: int
    total_sessions: int
    overall_attendance_percent: float
    students_stats: List[JournalStudentResponse]
    sessions_stats: List[JournalSessionResponse]
    subjects_stats: List[SubjectStatsResponse] = []  # Статистика по предметам


class JournalStatsViewersUpdate(BaseModel):
    """Обновление списка пользователей с доступом к статистике"""
    stats_viewers: List[int]  # Список telegram_id


class SubjectStudentStats(BaseModel):
    """Статистика студента по конкретному предмету"""
    student_id: str
    full_name: str
    is_linked: bool = False
    telegram_id: Optional[int] = None
    present_count: int = 0
    absent_count: int = 0
    late_count: int = 0
    excused_count: int = 0
    total_sessions: int = 0
    attendance_percent: float = 0.0
    # Оценки
    average_grade: Optional[float] = None
    grades_count: int = 0


class SubjectSessionStats(BaseModel):
    """Статистика занятия предмета"""
    session_id: str
    date: str
    title: str
    type: str
    present_count: int = 0
    absent_count: int = 0
    late_count: int = 0
    excused_count: int = 0
    total_students: int = 0
    attendance_percent: float = 0.0


class SubjectDetailedStatsResponse(BaseModel):
    """Детальная статистика по предмету"""
    subject_id: str
    subject_name: str
    subject_color: str
    description: Optional[str] = None
    journal_id: str
    total_sessions: int = 0
    total_students: int = 0
    overall_attendance_percent: float = 0.0
    present_count: int = 0
    absent_count: int = 0
    late_count: int = 0
    excused_count: int = 0
    students_stats: List[SubjectStudentStats] = []
    sessions_stats: List[SubjectSessionStats] = []


class JournalInviteLinkResponse(BaseModel):
    """Ответ со ссылкой приглашения"""
    invite_link: str
    invite_link_webapp: str = ""  # Ссылка через Web App
    invite_token: str
    journal_id: str
    bot_username: str


class StudentInviteLinkResponse(BaseModel):
    """Ответ со ссылкой приглашения для конкретного студента"""
    invite_link: str
    invite_link_webapp: str = ""  # Ссылка через Web App
    invite_code: str
    student_id: str
    student_name: str
    journal_id: str
    bot_username: str


class JoinStudentRequest(BaseModel):
    """Запрос на присоединение по персональной ссылке студента"""
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None


class ProcessJournalInviteRequest(BaseModel):
    """Запрос на обработку приглашения в журнал через Web App"""
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    invite_type: str  # "journal" или "jstudent"
    invite_code: str  # invite_token для журнала или invite_code для студента


class MyAttendanceResponse(BaseModel):
    """Мои посещения"""
    student_id: str
    full_name: str
    attendance_percent: float
    present_count: int
    absent_count: int
    excused_count: int
    late_count: int
    total_sessions: int
    records: List[AttendanceRecordResponse]


# ============ Модели для отслеживания реферальных событий ============

class ReferralEvent(BaseModel):
    """Событие перехода по реферальной ссылке"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: str  # "room_join" | "journal_join"
    telegram_id: int  # Кто перешел по ссылке
    referrer_id: Optional[int] = None  # Кто пригласил (по чьей ссылке перешли)
    target_id: str  # room_id или journal_id
    target_name: str = ""  # Название комнаты или журнала
    invite_token: str  # Токен приглашения
    is_new_member: bool = True  # Новый участник или уже был
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ReferralEventResponse(BaseModel):
    """Ответ события реферала"""
    id: str
    event_type: str
    telegram_id: int
    referrer_id: Optional[int]
    target_id: str
    target_name: str
    invite_token: str
    is_new_member: bool
    created_at: datetime
    # Дополнительная информация о пользователе
    user_name: Optional[str] = None
    referrer_name: Optional[str] = None


class ReferralStatsDetailResponse(BaseModel):
    """Детальная статистика реферальных событий"""
    total_events: int
    events_today: int
    events_week: int
    events_month: int
    # По типам
    room_joins_total: int
    room_joins_today: int
    room_joins_week: int
    journal_joins_total: int
    journal_joins_today: int
    journal_joins_week: int
    # Новые участники
    new_members_total: int
    new_members_today: int
    new_members_week: int
    # Топ приглашающих
    top_referrers: List[dict] = []
    # Последние события
    recent_events: List[ReferralEventResponse] = []


# ============ Модели для ЛК РУДН (lk.rudn.ru) ============

class LKCredentialsRequest(BaseModel):
    """Запрос на подключение ЛК РУДН"""
    telegram_id: int
    email: str
    password: str


class LKPersonalData(BaseModel):
    """Персональные данные из ЛК РУДН"""
    full_name: Optional[str] = None
    last_name: Optional[str] = None
    first_name: Optional[str] = None
    patronymic: Optional[str] = None
    birth_date: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    citizenship: Optional[str] = None
    
    # Студенческие данные (для полных аккаунтов)
    student_id: Optional[str] = None
    faculty: Optional[str] = None
    faculty_id: Optional[str] = None
    group_name: Optional[str] = None
    group_id: Optional[str] = None
    course: Optional[int] = None
    level: Optional[str] = None  # Бакалавриат/Магистратура
    form: Optional[str] = None   # Очная/Заочная
    speciality: Optional[str] = None


class LKConnectionResponse(BaseModel):
    """Ответ на подключение ЛК"""
    success: bool
    message: str
    personal_data: Optional[LKPersonalData] = None


class LKDataResponse(BaseModel):
    """Ответ с данными из ЛК"""
    personal_data: Optional[LKPersonalData] = None
    last_sync: Optional[str] = None
    cached: bool = False
    lk_connected: bool = False


class LKStatusResponse(BaseModel):
    """Статус подключения ЛК"""
    lk_connected: bool
    lk_email: Optional[str] = None
    lk_last_sync: Optional[str] = None


# ============ Модели для системы друзей ============

class FriendshipStatus(str, Enum):
    """Статус дружбы"""
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    BLOCKED = "blocked"


class PrivacySettings(BaseModel):
    """Настройки приватности профиля"""
    show_online_status: bool = True
    show_in_search: bool = True
    show_friends_list: bool = True
    show_achievements: bool = True
    show_schedule: bool = True  # Показывать расписание друзьям


class FriendRequest(BaseModel):
    """Запрос на дружбу"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    from_telegram_id: int
    to_telegram_id: int
    status: FriendshipStatus = FriendshipStatus.PENDING
    message: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class FriendRequestCreate(BaseModel):
    """Создание запроса на дружбу"""
    from_telegram_id: int
    to_telegram_id: int
    message: Optional[str] = None


class Friend(BaseModel):
    """Связь дружбы между пользователями"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_telegram_id: int
    friend_telegram_id: int
    is_favorite: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserBlock(BaseModel):
    """Блокировка пользователя"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    blocker_telegram_id: int
    blocked_telegram_id: int
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserProfilePublic(BaseModel):
    """Публичный профиль пользователя"""
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    
    # Учебная информация
    group_id: Optional[str] = None
    group_name: Optional[str] = None
    facultet_id: Optional[str] = None
    facultet_name: Optional[str] = None
    kurs: Optional[str] = None
    
    # Статистика
    friends_count: int = 0
    mutual_friends_count: int = 0
    achievements_count: int = 0
    total_points: int = 0
    
    # Статус
    is_online: bool = False
    last_activity: Optional[datetime] = None
    
    # Приватность (что показывать)
    privacy: Optional[PrivacySettings] = None
    
    # Метаданные
    created_at: Optional[datetime] = None
    
    # Статус дружбы с текущим пользователем
    friendship_status: Optional[str] = None  # "friend", "pending_incoming", "pending_outgoing", "blocked", None


class FriendCard(BaseModel):
    """Карточка друга для списка"""
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    group_name: Optional[str] = None
    facultet_name: Optional[str] = None
    is_online: bool = False
    last_activity: Optional[datetime] = None
    is_favorite: bool = False
    mutual_friends_count: int = 0
    friendship_date: Optional[datetime] = None


class FriendRequestCard(BaseModel):
    """Карточка запроса на дружбу"""
    request_id: str
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    group_name: Optional[str] = None
    facultet_name: Optional[str] = None
    message: Optional[str] = None
    mutual_friends_count: int = 0
    created_at: datetime


class FriendsListResponse(BaseModel):
    """Ответ со списком друзей"""
    friends: List[FriendCard]
    total: int


class FriendRequestsResponse(BaseModel):
    """Ответ со списком запросов на дружбу"""
    incoming: List[FriendRequestCard]
    outgoing: List[FriendRequestCard]
    incoming_count: int
    outgoing_count: int


class FriendSearchResult(BaseModel):
    """Результат поиска пользователей"""
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    group_name: Optional[str] = None
    facultet_name: Optional[str] = None
    kurs: Optional[str] = None
    mutual_friends_count: int = 0
    friendship_status: Optional[str] = None  # "friend", "pending_incoming", "pending_outgoing", "blocked", None


class FriendSearchResponse(BaseModel):
    """Ответ на поиск пользователей"""
    results: List[FriendSearchResult]
    total: int
    query: Optional[str] = None


class ProcessFriendInviteRequest(BaseModel):
    """Запрос на обработку приглашения от друга"""
    telegram_id: int
    inviter_telegram_id: int
    use_inviter_group: bool = False


class ProcessFriendInviteResponse(BaseModel):
    """Ответ на обработку приглашения от друга"""
    success: bool
    friend_added: bool
    group_set: bool
    inviter_info: Optional[FriendCard] = None
    message: str


class MutualFriendsResponse(BaseModel):
    """Ответ с общими друзьями"""
    mutual_friends: List[FriendCard]
    count: int


class FriendScheduleResponse(BaseModel):
    """Расписание друга"""
    friend_telegram_id: int
    friend_name: str
    group_name: Optional[str] = None
    schedule: List[dict]  # ScheduleEvent objects
    common_classes: List[dict] = []  # Общие пары
    common_breaks: List[str] = []  # Общие окна


class PrivacySettingsUpdate(BaseModel):
    """Обновление настроек приватности"""
    show_online_status: Optional[bool] = None
    show_in_search: Optional[bool] = None
    show_friends_list: Optional[bool] = None
    show_achievements: Optional[bool] = None
    show_schedule: Optional[bool] = None


class FriendActionResponse(BaseModel):
    """Ответ на действие с другом"""
    success: bool
    message: str
    friend: Optional[FriendCard] = None
    new_achievements: List[dict] = []



# ============ Модели для системы уведомлений (In-App Notifications) ============

class NotificationType(str, Enum):
    """Типы уведомлений"""
    # Учебные
    CLASS_STARTING = "class_starting"
    SCHEDULE_CHANGED = "schedule_changed"
    TASK_DEADLINE = "task_deadline"
    
    # Социальные
    FRIEND_REQUEST = "friend_request"
    FRIEND_ACCEPTED = "friend_accepted"
    FRIEND_JOINED = "friend_joined"
    
    # Комнаты
    ROOM_INVITE = "room_invite"
    ROOM_TASK_NEW = "room_task_new"
    ROOM_TASK_ASSIGNED = "room_task_assigned"
    ROOM_TASK_COMPLETED = "room_task_completed"
    ROOM_MEMBER_JOINED = "room_member_joined"
    
    # Журнал
    JOURNAL_ATTENDANCE = "journal_attendance"
    JOURNAL_INVITE = "journal_invite"
    
    # Достижения
    ACHIEVEMENT_EARNED = "achievement_earned"
    LEVEL_UP = "level_up"
    
    # Системные
    APP_UPDATE = "app_update"
    ANNOUNCEMENT = "announcement"
    
    # Админские
    ADMIN_MESSAGE = "admin_message"


class NotificationCategory(str, Enum):
    """Категории уведомлений"""
    STUDY = "study"
    SOCIAL = "social"
    ROOMS = "rooms"
    JOURNAL = "journal"
    ACHIEVEMENTS = "achievements"
    SYSTEM = "system"


class NotificationPriority(str, Enum):
    """Приоритет уведомления"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"


class InAppNotification(BaseModel):
    """Уведомление в приложении"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    telegram_id: int
    type: NotificationType
    category: NotificationCategory
    priority: NotificationPriority = NotificationPriority.NORMAL
    title: str
    message: str
    emoji: str = "🔔"
    data: dict = {}
    action_url: Optional[str] = None
    actions: List[dict] = []
    action_taken: Optional[str] = None
    read: bool = False
    dismissed: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    read_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class InAppNotificationCreate(BaseModel):
    """Создание уведомления"""
    telegram_id: int
    type: NotificationType
    category: NotificationCategory
    priority: NotificationPriority = NotificationPriority.NORMAL


# ============ Модели для Web Session (связка Telegram профиля) ============

class WebSessionStatus(str, Enum):
    """Статус веб-сессии"""
    PENDING = "pending"        # Ожидает подтверждения
    LINKED = "linked"          # Связан с Telegram
    EXPIRED = "expired"        # Истёк срок действия
    CANCELLED = "cancelled"    # Отменён


class WebSession(BaseModel):
    """Веб-сессия для связки с Telegram профилем"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_token: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: WebSessionStatus = WebSessionStatus.PENDING
    
    # Данные пользователя после связки
    telegram_id: Optional[int] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    
    # Информация об устройстве
    device_name: Optional[str] = None       # Название устройства (Chrome на Windows)
    browser: Optional[str] = None           # Браузер
    os: Optional[str] = None                # Операционная система
    user_agent: Optional[str] = None        # Полный User-Agent
    ip_address: Optional[str] = None        # IP адрес
    
    # Метаданные
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime = Field(default_factory=lambda: datetime.utcnow() + timedelta(minutes=10))
    linked_at: Optional[datetime] = None
    last_active: Optional[datetime] = None  # Последняя активность
    
    # Дополнительные данные (группа, настройки)
    user_settings: Optional[dict] = None


class WebSessionCreate(BaseModel):
    """Создание веб-сессии"""
    pass  # Не требует параметров


class WebSessionResponse(BaseModel):
    """Ответ с данными веб-сессии"""
    session_token: str
    status: WebSessionStatus
    qr_url: str
    expires_at: datetime
    
    # Данные пользователя (если связан)
    telegram_id: Optional[int] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    user_settings: Optional[dict] = None


class WebSessionLinkRequest(BaseModel):
    """Запрос на связывание сессии с Telegram"""
    telegram_id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None


class WebSessionLinkResponse(BaseModel):
    """Ответ на связывание сессии"""
    success: bool
    message: str
    session_token: Optional[str] = None


class WebSessionCreateRequest(BaseModel):
    """Запрос на создание веб-сессии с информацией об устройстве"""
    device_name: Optional[str] = None
    browser: Optional[str] = None
    os: Optional[str] = None
    user_agent: Optional[str] = None


class DeviceInfo(BaseModel):
    """Информация об устройстве/сессии"""
    session_token: str
    device_name: str
    browser: Optional[str] = None
    os: Optional[str] = None
    linked_at: Optional[datetime] = None
    last_active: Optional[datetime] = None
    is_current: bool = False  # Текущее устройство


class DevicesListResponse(BaseModel):
    """Список устройств пользователя"""
    devices: List[DeviceInfo]
    total: int


class NotificationCard(BaseModel):
    """Карточка уведомления для отображения"""
    id: str
    type: str
    category: str
    priority: str
    title: str
    message: str
    emoji: str
    data: dict = {}
    actions: List[dict] = []
    action_taken: Optional[str] = None
    read: bool
    created_at: datetime
    time_ago: str = ""


class NotificationsListResponse(BaseModel):
    """Ответ со списком уведомлений"""
    notifications: List[NotificationCard]
    total: int
    unread_count: int
    has_more: bool


class ExtendedNotificationSettings(BaseModel):
    """Расширенные настройки уведомлений"""
    notifications_enabled: bool = True
    study_enabled: bool = True
    study_push: bool = True
    study_minutes_before: int = 10
    social_enabled: bool = True
    social_push: bool = True
    social_friend_requests: bool = True
    social_friend_accepted: bool = True
    rooms_enabled: bool = True
    rooms_push: bool = True
    rooms_new_tasks: bool = True
    rooms_assignments: bool = True
    rooms_completions: bool = True
    journal_enabled: bool = True
    journal_push: bool = False
    achievements_enabled: bool = True
    achievements_push: bool = False
    system_enabled: bool = True
    system_push: bool = True


class ExtendedNotificationSettingsUpdate(BaseModel):
    """Обновление расширенных настроек"""
    notifications_enabled: Optional[bool] = None
    study_enabled: Optional[bool] = None
    study_push: Optional[bool] = None
    study_minutes_before: Optional[int] = None
    social_enabled: Optional[bool] = None
    social_push: Optional[bool] = None
    social_friend_requests: Optional[bool] = None
    social_friend_accepted: Optional[bool] = None
    rooms_enabled: Optional[bool] = None
    rooms_push: Optional[bool] = None
    rooms_new_tasks: Optional[bool] = None
    rooms_assignments: Optional[bool] = None
    rooms_completions: Optional[bool] = None
    journal_enabled: Optional[bool] = None
    journal_push: Optional[bool] = None
    achievements_enabled: Optional[bool] = None
    achievements_push: Optional[bool] = None
    system_enabled: Optional[bool] = None
    system_push: Optional[bool] = None


class UnreadCountResponse(BaseModel):
    """Счётчик непрочитанных"""
    unread_count: int
    by_category: dict = {}

