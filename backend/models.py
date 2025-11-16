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
    target_date: Optional[datetime] = None
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
    target_date: Optional[datetime] = None
    subject: Optional[str] = None
    discipline_id: Optional[str] = None
    order: int = 0
    created_at: datetime
    updated_at: datetime


class TaskReorderItem(BaseModel):
    """Элемент для изменения порядка задач"""
    id: str
    order: int


class TaskReorderRequest(BaseModel):
    """Запрос на изменение порядка задач"""
    tasks: List[TaskReorderItem]



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
    referral_code: Optional[str] = None  # реферальный код, если пришел по ссылке
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
    invite_token: str
    telegram_id: int
    username: Optional[str] = None
    first_name: str
    referral_code: Optional[str] = None


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


class TaskReorderRequest(BaseModel):
    """Запрос на изменение порядка задач"""
    room_id: str
    tasks: List[dict]  # [{"task_id": "...", "order": 0}, ...]


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


class FacultyStats(BaseModel):
    """Статистика по факультету"""
    faculty_name: str
    faculty_id: str
    users_count: int


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
    bot_username: str


class ReferralConnection(BaseModel):
    """Связь между пользователем и пригласившим"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    referrer_telegram_id: int  # кто пригласил
    referred_telegram_id: int  # кого пригласили
    level: int  # уровень в цепочке от root referrer (1, 2, 3)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    points_earned: int = 0  # сколько баллов referrer заработал с этого реферала

