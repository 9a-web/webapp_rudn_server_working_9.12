"""
Pydantic модели для API расписания РУДН
"""

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Union
from datetime import datetime
import uuid


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
    id: str
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
    
    # Настройки уведомлений
    notifications_enabled: bool = False
    notification_time: int = 10
    
    created_at: datetime
    updated_at: datetime
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
    schedule_views: int = 0  # Количество просмотров расписания
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
    night_usage_count: int
    early_usage_count: int
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
    username: str  # Username бота (например, @rudn_pro_bot)
    first_name: str  # Имя бота
    id: int  # ID бота
    can_join_groups: bool = False
    can_read_all_group_messages: bool = False
    supports_inline_queries: bool = False


# ============ Модели для списка дел ============

class Task(BaseModel):
    """Модель задачи"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    telegram_id: int
    text: str
    completed: bool = False
    
    # Новые поля
    category: Optional[str] = None  # Категория: 'study', 'personal', 'sport', 'project'
    priority: Optional[str] = 'medium'  # Приоритет: 'low', 'medium', 'high'
    deadline: Optional[datetime] = None  # Дедлайн задачи (для реальных сроков)
    target_date: Optional[datetime] = None  # Целевая дата задачи (день, к которому привязана задача)
    subject: Optional[str] = None  # Привязка к предмету из расписания
    discipline_id: Optional[str] = None  # ID дисциплины (для интеграции с расписанием)
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


class TaskUpdate(BaseModel):
    """Запрос обновления задачи"""
    text: Optional[str] = None
    completed: Optional[bool] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    deadline: Optional[datetime] = None
    subject: Optional[str] = None
    discipline_id: Optional[str] = None
    order: Optional[int] = None


class TaskResponse(BaseModel):
    """Ответ с задачей"""
    id: str
    telegram_id: int
    text: str
    completed: bool
    category: Optional[str] = None
    priority: Optional[str] = 'medium'
    deadline: Optional[datetime] = None
    subject: Optional[str] = None
    discipline_id: Optional[str] = None
    order: int = 0
    created_at: datetime
    updated_at: datetime
