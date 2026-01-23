# 📘 PROJECT DETAILS - Техническая документация

**Обновлено:** 2025-07-16 | **Статус:** Актуализирован

## 📋 Содержание
1. [Архитектура системы](#архитектура-системы)
2. [Backend структура](#backend-структура)
3. [Frontend структура](#frontend-структура)
4. [Модели данных](#модели-данных)
5. [API интеграции](#api-интеграции)
6. [Workflow и сценарии](#workflow-и-сценарии)
7. [Deployment](#deployment)
8. [VK Music интеграция](#vk-music-интеграция)
9. [Система друзей](#система-друзей)
10. [In-App уведомления](#in-app-уведомления)

---

## 1. Архитектура системы

### 1.1 Общая схема

Приложение состоит из 4 основных слоев:

1. **Presentation Layer** - React Telegram Web App
2. **API Layer** - FastAPI REST API
3. **Business Logic Layer** - Python модули (achievements, notifications, scheduler)
4. **Data Layer** - MongoDB + External APIs

### 1.2 Технологический стек

#### Backend
- **Framework:** FastAPI 0.110.1
- **Language:** Python 3.10+
- **Database:** MongoDB (pymongo 4.5.0)
- **Async:** asyncio, httpx 0.24+, aiohttp 3.9+
- **Scheduler:** APScheduler 3.10.4
- **Telegram:** python-telegram-bot 20.7+
- **Validation:** Pydantic v2.6+
- **HTTP Client:** httpx (async)
- **VK Music:** vkpymusic, vkaudiotoken
- **Media:** yt-dlp, Pillow

#### Frontend
- **Framework:** React 19.0.0
- **Bundler:** Vite 7.2.2
- **Styling:** TailwindCSS 3.4.17
- **Animation:** Framer Motion 12.23.24
- **i18n:** i18next 25.6.0, react-i18next 16.2.0
- **State:** React Hooks + Context API
- **HTTP Client:** axios 1.12.2
- **Telegram:** @twa-dev/sdk 8.0.2
- **Charts:** recharts 3.4.1
- **QR Codes:** qrcode.react 4.2.0
- **Confetti:** canvas-confetti 1.9.4
- **VK Icons:** @vkontakte/icons 3.33.0

#### Infrastructure
- **Container:** Docker/Kubernetes
- **Process Manager:** Supervisor
- **Database:** MongoDB (local)
- **Reverse Proxy:** Nginx (handled by K8s ingress)

---

## 2. Backend структура

### 2.1 Главные модули

#### server.py (3500+ LOC)

**Назначение:** Главный FastAPI сервер со всеми endpoints

**Основные разделы:**
```python
# 1. Инициализация
app = FastAPI()
router = APIRouter(prefix="/api")
db = client["rudn_schedule"]

# 2. CORS настройки
app.add_middleware(CORSMiddleware, ...)

# 3. Health check
@router.get("/health")

# 4. Endpoints (50+):
# - Расписание РУДН (5 endpoints)
# - Пользователи (4 endpoints)
# - Задачи (4 endpoints)
# - Комнаты (7 endpoints)
# - Групповые задачи (4 endpoints)
# - Достижения (3 endpoints)
# - Статистика (2 endpoints)
# - Уведомления (2 endpoints)
# - Погода (1 endpoint)
# - Бот инфо (1 endpoint)
```

**Ключевые зависимости:**
```python
from models import *  # Все Pydantic модели
from achievements import check_and_award_achievements, track_user_action, ACHIEVEMENTS
from weather import get_weather_data
from rudn_parser import get_faculties, get_filter_data, get_schedule
from notifications import send_class_notification
from cache import get_cached, set_cached
```

**Основные функции:**
- `get_user_settings(telegram_id)` - получить настройки юзера
- `update_last_activity(telegram_id)` - обновить last_activity
- `get_or_create_user_stats(telegram_id)` - получить/создать статистику

#### models.py (750+ LOC)

**Все Pydantic модели:**

```python
# Расписание
class Faculty(BaseModel): ...
class FilterOption(BaseModel): ...
class FilterDataRequest(BaseModel): ...
class ScheduleRequest(BaseModel): ...
class ScheduleEvent(BaseModel): ...
class ScheduleResponse(BaseModel): ...

# Пользователи
class UserSettings(BaseModel): ...
class UserSettingsResponse(BaseModel): ...
class NotificationSettings(BaseModel): ...
class UserStats(BaseModel): ...

# Задачи
class Task(BaseModel): ...
class TaskCreate(BaseModel): ...
class TaskUpdate(BaseModel): ...

# Комнаты
class Room(BaseModel): ...
class RoomCreate(BaseModel): ...
class RoomParticipant(BaseModel): ...
class RoomInviteLinkResponse(BaseModel): ...

# Групповые задачи
class GroupTask(BaseModel): ...
class GroupTaskCreate(BaseModel): ...
class GroupTaskUpdate(BaseModel): ...

# Достижения
class Achievement(BaseModel): ...
class UserAchievement(BaseModel): ...

# Трекинг
class ActionTrack(BaseModel): ...
```

#### achievements.py (630 LOC)

**25 достижений в словаре ACHIEVEMENTS:**

```python
ACHIEVEMENTS = {
    "first_group": {
        "id": "first_group",
        "name": "Первопроходец",
        "description": "Выбор первой группы",
        "emoji": "🎯",
        "points": 10,
        "type": "basic",
        "requirement": "Выбрать группу расписания"
    },
    # ... еще 24 достижения
}
```

**Категории достижений:**
1. **Basic** - базовые действия (выбор группы, первая неделя)
2. **Social** - социальные (приглашения друзей)
3. **Exploration** - исследование (открытие всех разделов)
4. **Milestone** - milestone (получить все ачивки)
5. **Activity** - активность (ночное/раннее использование)

**Главные функции:**
- `check_and_award_achievements(telegram_id, user_stats, action_type, metadata=None)` - проверка и выдача ачивок
- `track_user_action(telegram_id, action_type, metadata=None)` - трекинг действий

**Триггеры достижений:**
```python
"select_group" -> first_group
"view_schedule" -> schedule_explorer (10x), schedule_master (50x)
"invite_friend" -> friend_inviter (1x), super_inviter (5x)
"night_usage" -> night_owl (5x)
"early_usage" -> early_bird (5x)
"view_analytics" -> analyst (1x), chart_lover (5x)
"open_calendar" -> organizer (1x)
"configure_notifications" -> settings_master (1x)
"share_schedule" -> knowledge_sharer (1x), ambassador (5x)
"visit_menu_item" -> explorer (все разделы)
"daily_activity" -> first_week (7 дней), perfectionist (все ачивки)
```

#### telegram_bot.py (850 LOC)

**Telegram Bot функции:**

1. **Команды:**
   - `/start` - регистрация юзера, показ welcome message
   - Deep linking: `/start room_{token}_ref_{user_id}` - присоединение к комнате

2. **Функции:**
   - `start_command(update, context)` - обработка /start
   - `send_telegram_message(telegram_id, message, reply_markup=None)` - отправка сообщений
   - `send_class_notification(telegram_id, class_info)` - уведомление о паре
   - `notify_room_member(telegram_id, room_name, inviter_name, room_id)` - уведомление о приглашении

3. **Inline клавиатура:**
```python
button = InlineKeyboardButton(
    "Открыть расписание ✨",
    web_app=WebAppInfo(url="https://rudn-schedule.ru")
)
```

#### rudn_parser.py (310 LOC)

**Интеграция с API РУДН:**

```python
BASE_URL = "http://www.rudn.ru"
API_ENDPOINT = "/rasp/lessons/view"

# Функции:
async def get_faculties() -> List[Faculty]
async def get_filter_data(facultet_id: str, level_id="", kurs="", form_code="") -> dict
async def get_schedule(facultet_id, level_id, kurs, form_code, group_id, week_number=1) -> dict
```

**Особенности:**
- Парсинг HTML через BeautifulSoup
- Асинхронные запросы (httpx)
- Обработка ошибок и таймаутов
- Нормализация данных (например, int -> str для курсов)

#### weather.py (120 LOC)

**OpenWeatherMap интеграция:**

```python
API_KEY = os.environ.get('WEATHER_API_KEY')
BASE_URL = "http://api.openweathermap.org/data/2.5/weather"

async def get_weather_data() -> dict:
    # Запрос погоды для Москвы (lat=55.7558, lon=37.6173)
    # Возвращает: temperature, feels_like, humidity, wind_speed, description, icon
```

#### notifications.py (140 LOC)

**Система уведомлений:**

```python
async def send_class_notification(telegram_id: int, class_info: dict):
    # Отправка уведомления о предстоящей паре
    # class_info: {discipline, time, teacher, auditory, lessonType}
```

**Интеграция с scheduler.py для периодической проверки:**

#### scheduler.py (460 LOC)

**APScheduler задачи:**

```python
scheduler = AsyncIOScheduler()

# Задача 1: Проверка предстоящих пар (каждую минуту)
@scheduler.scheduled_job('cron', minute='*')
async def check_upcoming_classes():
    # Получить всех юзеров с notifications_enabled=True
    # Для каждого: получить расписание на сегодня
    # Найти пары, которые начинаются через notification_time минут
    # Отправить уведомление через Telegram Bot

# Задача 2: Обновление кэша (каждый час)
@scheduler.scheduled_job('cron', hour='*')
async def update_cache():
    # Очистка устаревших данных из кэша
```

#### cache.py (40 LOC)

**In-memory кэш:**

```python
cache = {}  # {key: {"data": ..., "timestamp": ...}}

def get_cached(key: str, max_age: int = 3600) -> Optional[Any]
def set_cached(key: str, data: Any)
```

---

## 3. Frontend структура

### 3.1 App.js (Root Component)

**Основная структура:**

```javascript
function App() {
  // 1. State управление
  const [activeTab, setActiveTab] = useState('home'); // home | tasks | journal
  const [userSettings, setUserSettings] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekNumber, setWeekNumber] = useState(1);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  // + 10+ других state переменных для модальных окон

  // 2. Telegram WebApp инициализация
  const { user, webApp } = useTelegram();

  // 3. Load user settings
  useEffect(() => {
    if (user?.id) {
      loadUserSettings(user.id);
    }
  }, [user]);

  // 4. Load schedule
  useEffect(() => {
    if (userSettings) {
      fetchSchedule();
    }
  }, [userSettings, selectedDate, weekNumber]);

  // 5. Achievement system
  const checkAchievements = async (achievements) => { ... };

  // 6. Rendering
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F0F0F] to-[#1A1A1A]">
      {/* Welcome Screen для новых юзеров */}
      {!userSettings && <WelcomeScreen />}

      {/* Main App */}
      {userSettings && (
        <>
          <Header {...props} />

          {/* Content по activeTab */}
          {activeTab === 'home' && (
            <>
              <LiveScheduleCarousel />
              <WeekDaySelector />
              <LiveScheduleSection />
            </>
          )}
          {activeTab === 'tasks' && <TasksSection {...props} />}
          {activeTab === 'journal' && <JournalSection />}

          {/* Modals */}
          <CalendarModal />
          <AnalyticsModal />
          <AchievementsModal />
          <NotificationSettings />
          {/* ... другие модалки */}

          {/* Bottom Navigation */}
          <BottomNavigation activeTab={activeTab} onChange={setActiveTab} />

          {/* Achievement Notification */}
          <AchievementNotification />
        </>
      )}
    </div>
  );
}
```

### 3.2 Ключевые компоненты

#### TasksSection.jsx (900+ LOC)

**Самый большой компонент - управление личными задачами**

**Функции:**
1. Список задач с фильтрацией (категория, приоритет, дедлайн)
2. Drag & Drop для изменения порядка
3. Создание/редактирование/удаление задач
4. Группировка по дате (сегодня, завтра, на этой неделе)
5. Интеграция с расписанием (привязка к предметам)
6. Быстрые действия (шаблоны задач)
7. Прогресс-бар завершенности

**State:**
```javascript
const [tasks, setTasks] = useState([]);
const [tasksSelectedDate, setTasksSelectedDate] = useState(new Date());
const [isAddModalOpen, setIsAddModalOpen] = useState(false);
const [filterCategory, setFilterCategory] = useState('all');
const [filterPriority, setFilterPriority] = useState('all');
const [sortBy, setSortBy] = useState('priority'); // priority | deadline
```

#### LiveScheduleSection.jsx (560 LOC)

**Отображение списка пар на день**

**Функции:**
1. Карточки пар с деталями (время, предмет, преподаватель, аудитория)
2. Статус пары (закончилась, в процессе, предстоит)
3. Expand/collapse для деталей
4. Кнопка "Поделиться расписанием"
5. Смена группы
6. Empty state если нет пар

#### RoomDetailModal.jsx (600+ LOC)

**Детали комнаты + управление групповыми задачами**

**Функции:**
1. Информация о комнате (название, описание, цвет, эмодзи)
2. Список участников с ролями (owner/member)
3. Список задач комнаты
4. Создание/редактирование/удаление задач
5. Прогресс комнаты (completed/total tasks)
6. Генерация/копирование invite ссылки
7. Покинуть/удалить комнату

### 3.3 Utils

#### analytics.js

**Функции для аналитики:**

```javascript
export function calculateScheduleStats(schedule) {
  // Подсчет уникальных пар (по день+время)
  const uniqueTimeSlots = new Set();
  schedule.forEach(event => {
    uniqueTimeSlots.add(`${event.day}|${event.time}`);
  });

  return {
    totalClasses: uniqueTimeSlots.size,
    totalHours: uniqueTimeSlots.size * 1.5, // 1 пара = 1.5 часа
    averageClassesPerDay: uniqueTimeSlots.size / 6, // на 6 дней
    // ...
  };
}

export function getWeekLoadChart(schedule) {
  // График загрузки по дням недели
  const dayMap = { 'Пн': 0, 'Вт': 1, ... };
  // Возвращает массив объектов {day, classes, hours}
}

export function getClassTypeStats(schedule) {
  // Статистика по типам занятий (лекция, практика, лаб)
}
```

#### dateUtils.js

**Утилиты для работы с датами:**

```javascript
export function getCurrentWeekNumber(date) {
  // Возвращает 1 или 2 (четная/нечетная неделя)
}

export function getWeekDateRange(date, weekNumber) {
  // Возвращает понедельник и воскресенье для недели
}

export function isSameDay(date1, date2) { ... }
export function isToday(date) { ... }
export function isTomorrow(date) { ... }
```

#### animations.js

**Preset анимации для Framer Motion:**

```javascript
export const modalVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 }
};

export const slideUpVariants = {
  hidden: { y: '100%' },
  visible: { y: 0 },
  exit: { y: '100%' }
};

export const fadeInVariants = { ... };
```

#### confetti.js

**Генерация конфетти при получении достижения:**

```javascript
export function generateConfetti(count = 50) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * window.innerWidth,
    delay: Math.random() * 0.5,
    duration: 2 + Math.random() * 2,
    rotation: Math.random() * 360
  }));
}
```

### 3.4 Services (API клиенты)

#### api.js

**Базовый API клиент:**

```javascript
import axios from 'axios';

const API_BASE = process.env.REACT_APP_BACKEND_URL;

export const api = {
  // Расписание
  getFaculties: () => axios.get(`${API_BASE}/api/faculties`),
  getFilterData: (data) => axios.post(`${API_BASE}/api/filter-data`, data),
  getSchedule: (data) => axios.post(`${API_BASE}/api/schedule`, data),

  // Пользователи
  getUserSettings: (telegramId) => axios.get(`${API_BASE}/api/user-settings/${telegramId}`),
  saveUserSettings: (data) => axios.post(`${API_BASE}/api/user-settings`, data),

  // Задачи
  getTasks: (telegramId) => axios.get(`${API_BASE}/api/tasks/${telegramId}`),
  createTask: (data) => axios.post(`${API_BASE}/api/tasks`, data),
  updateTask: (taskId, data) => axios.put(`${API_BASE}/api/tasks/${taskId}`, data),
  deleteTask: (taskId) => axios.delete(`${API_BASE}/api/tasks/${taskId}`),

  // Достижения
  getAchievements: () => axios.get(`${API_BASE}/api/achievements`),
  getUserAchievements: (telegramId) => axios.get(`${API_BASE}/api/user-achievements/${telegramId}`),
  trackAction: (data) => axios.post(`${API_BASE}/api/track-action`, data),

  // Погода
  getWeather: () => axios.get(`${API_BASE}/api/weather`),

  // ...
};
```

#### roomsAPI.js

**API для комнат:**

```javascript
export const roomsAPI = {
  createRoom: (data) => axios.post(`${API_BASE}/api/rooms`, data),
  getRooms: (telegramId) => axios.get(`${API_BASE}/api/rooms/${telegramId}`),
  getRoomDetail: (roomId) => axios.get(`${API_BASE}/api/rooms/detail/${roomId}`),
  generateInviteLink: (roomId) => axios.post(`${API_BASE}/api/rooms/${roomId}/invite-link`),
  joinRoom: (inviteToken, data) => axios.post(`${API_BASE}/api/rooms/join/${inviteToken}`, data),
  leaveRoom: (roomId, telegramId) => axios.delete(`${API_BASE}/api/rooms/${roomId}/leave`, { data: { telegram_id: telegramId } }),
  deleteRoom: (roomId, telegramId) => axios.delete(`${API_BASE}/api/rooms/${roomId}`, { data: { telegram_id: telegramId } }),
};
```

#### groupTasksAPI.js

**API для групповых задач:**

```javascript
export const groupTasksAPI = {
  createGroupTask: (roomId, data) => axios.post(`${API_BASE}/api/rooms/${roomId}/tasks`, data),
  getRoomTasks: (roomId) => axios.get(`${API_BASE}/api/rooms/${roomId}/tasks`),
  updateGroupTask: (taskId, data) => axios.put(`${API_BASE}/api/group-tasks/${taskId}`, data),
  deleteGroupTask: (taskId) => axios.delete(`${API_BASE}/api/group-tasks/${taskId}`),
};
```

---

## 4. Модели данных (подробно)

### 4.1 UserSettings

**Назначение:** Хранит выбранную группу и настройки юзера

**Поля:**
- `id` (UUID) - уникальный идентификатор
- `telegram_id` (int) - ID юзера в Telegram
- `username` (str, optional) - @username
- `first_name` (str, optional) - имя
- `last_name` (str, optional) - фамилия
- `group_id` (str) - ID группы в API РУДН
- `group_name` (str) - название группы (например, "СААад-01-24")
- `facultet_id` (str) - ID факультета
- `facultet_name` (str, optional) - название факультета
- `level_id` (str) - уровень образования
- `kurs` (str) - курс ("1", "2", ...)
- `form_code` (str) - форма обучения
- `notifications_enabled` (bool) - включены ли уведомления
- `notification_time` (int, 5-30) - за сколько минут присылать уведомление
- `referral_code` (str) - код для реферальной системы
- `referred_by` (int, optional) - кто пригласил
- `invited_count` (int) - сколько друзей пригласил
- `created_at` (datetime) - дата регистрации
- `last_activity` (datetime) - последняя активность

**Индексы:** `telegram_id` (unique)

### 4.2 UserStats

**Назначение:** Статистика для достижений и аналитики

**Поля:**
- `telegram_id` (int, unique) - ID юзера
- `groups_viewed` (int) - сколько раз смотрел разные группы
- `friends_invited` (int) - сколько друзей пригласил
- `schedule_views` (int) - сколько раз просмотрел расписание
- `night_usage_count` (int) - ночное использование (22:00-06:00)
- `early_usage_count` (int) - раннее использование (06:00-08:00)
- `total_points` (int) - общее количество очков
- `achievements_count` (int) - количество полученных достижений
- `analytics_views` (int) - просмотры аналитики
- `calendar_opens` (int) - открытия календаря
- `notifications_configured` (int) - настроек уведомлений
- `schedule_shares` (int) - поделился расписанием
- `menu_items_visited` (int) - посещено разделов меню
- `active_days` (int) - дней подряд активности

**Индексы:** `telegram_id` (unique)

### 4.3 Task

**Назначение:** Личная задача юзера

**Поля:**
- `id` (UUID) - уникальный идентификатор
- `telegram_id` (int) - владелец
- `text` (str) - текст задачи
- `completed` (bool) - выполнена ли
- `category` (str) - категория ('учеба', 'личное', 'спорт', 'проекты')
- `priority` (str) - приоритет ('high', 'medium', 'low')
- `deadline` (datetime, optional) - дедлайн
- `target_date` (datetime, optional) - целевая дата (для привязки к дню)
- `notes` (str, optional) - заметки
- `tags` (List[str]) - теги
- `order` (int) - порядок в списке (для drag & drop)
- `created_at` (datetime) - дата создания
- `updated_at` (datetime) - дата обновления

**Индексы:** `telegram_id`, `deadline`, `target_date`

**Важно:** 
- `deadline` - реальный дедлайн (используется для уведомлений и группировки)
- `target_date` - дата, к которой привязана задача (для показа в определенный день)

### 4.4 Room

**Назначение:** Комната для групповой работы

**Поля:**
- `id` (UUID) - уникальный идентификатор
- `name` (str) - название комнаты
- `color` (str) - цвет (#hex)
- `emoji` (str) - эмодзи
- `description` (str, optional) - описание
- `owner_id` (int) - владелец (telegram_id)
- `created_at` (datetime) - дата создания
- `total_participants` (int) - количество участников
- `total_tasks` (int) - общее количество задач
- `completed_tasks` (int) - выполненных задач

**Индексы:** `owner_id`, `id`

### 4.5 RoomParticipant

**Назначение:** Участник комнаты

**Поля:**
- `room_id` (str) - ID комнаты
- `telegram_id` (int) - ID участника
- `username` (str, optional) - @username
- `first_name` (str, optional) - имя
- `avatar_url` (str, optional) - аватар
- `role` (str) - роль ('owner', 'member')
- `joined_at` (datetime) - дата присоединения
- `referral_code` (int, optional) - кто пригласил

**Индексы:** `room_id`, `telegram_id`, composite: (`room_id`, `telegram_id`) unique

### 4.6 GroupTask

**Назначение:** Групповая задача в комнате

**Поля:**
- `id` (UUID) - уникальный идентификатор
- `room_id` (str) - ID комнаты
- `text` (str) - текст задачи
- `description` (str, optional) - описание
- `completed` (bool) - выполнена ли
- `priority` (str) - приоритет
- `deadline` (datetime, optional) - дедлайн
- `created_by` (int) - кто создал (telegram_id)
- `assigned_to` (List[int]) - кому назначена (telegram_ids)
- `category` (str, optional) - категория
- `tags` (List[str]) - теги
- `order` (int) - порядок в списке
- `created_at` (datetime) - дата создания
- `updated_at` (datetime) - дата обновления
- `completed_by` (int, optional) - кто выполнил
- `completed_at` (datetime, optional) - когда выполнена

**Индексы:** `room_id`, `deadline`, `assigned_to`

**Особенность:** При создании задачи все участники комнаты автоматически добавляются в `assigned_to`

---

## 5. API интеграции

### 5.1 API РУДН

**Base URL:** `http://www.rudn.ru/rasp/lessons/view`

**Endpoint 1: Получить факультеты**
```
GET /rasp/lessons/view
Response: HTML с списком факультетов в <select id="facultet">

Парсинг:
<option value="{facultet_id}">{facultet_name}</option>

Результат: List[Faculty]
```

**Endpoint 2: Получить фильтры (уровень, курс, форма, группы)**
```
POST /rasp/lessons/view
Body (form-data):
  facultet: {facultet_id}
  level: {level_id}  # опционально
  kurs: {kurs}       # опционально
  forma: {form_code} # опционально

Response: HTML с обновленными <select> элементами

Парсинг:
- <select id="level"> для уровней
- <select id="kurs"> для курсов
- <select id="forma"> для форм
- <select id="group"> для групп

Результат: FilterDataResponse {levels, courses, forms, groups}
```

**Endpoint 3: Получить расписание**
```
POST /rasp/lessons/view
Body (form-data):
  facultet: {facultet_id}
  level: {level_id}
  kurs: {kurs}
  forma: {form_code}
  group: {group_id}
  week: {week_number}  # 1 или 2

Response: HTML таблица с расписанием

Парсинг:
<table id="schedule">
  <tr class="schedule-row" data-day="{day}" data-time="{time}">
    <td class="discipline">{discipline}</td>
    <td class="lesson-type">{lessonType}</td>
    <td class="teacher">{teacher}</td>
    <td class="auditory">{auditory}</td>
  </tr>
</table>

Результат: ScheduleResponse {events: List[ScheduleEvent], group_id, week_number}
```

**Особенности:**
- API возвращает HTML (нет JSON)
- Нужен BeautifulSoup для парсинга
- Данные не всегда консистентны (например, kurs может быть int или str)
- Таймаут запросов: 30 секунд

### 5.2 OpenWeatherMap API

**Base URL:** `http://api.openweathermap.org/data/2.5`

**Endpoint: Текущая погода**
```
GET /weather
Params:
  lat: 55.7558        # Москва
  lon: 37.6173        # Москва
  appid: {API_KEY}
  units: metric       # Цельсии
  lang: ru            # Русский язык

Response: JSON
{
  "main": {
    "temp": 5.0,
    "feels_like": 2.0,
    "humidity": 93
  },
  "wind": {"speed": 3.5},
  "weather": [{
    "description": "ясно",
    "icon": "01d"
  }]
}

Результат:
{
  "temperature": 5,
  "feels_like": 2,
  "humidity": 93,
  "wind_speed": 3.5,
  "description": "Ясно",
  "icon": "01d"
}
```

**Кэширование:** 30 минут

### 5.3 Telegram Bot API

**Base URL:** `https://api.telegram.org/bot{TOKEN}`

**Используемые методы:**

1. **getMe** - информация о боте
```
GET /bot{TOKEN}/getMe
Response: {"ok": true, "result": {"id", "username", "first_name", ...}}
```

2. **sendMessage** - отправка сообщения
```
POST /bot{TOKEN}/sendMessage
Body:
{
  "chat_id": {telegram_id},
  "text": "Привет!",
  "parse_mode": "HTML",
  "reply_markup": {"inline_keyboard": [[...]]}
}
```

3. **WebAppInfo** - кнопка для открытия Web App
```json
{
  "inline_keyboard": [[
    {
      "text": "Открыть расписание ✨",
      "web_app": {"url": "https://rudn-schedule.ru"}
    }
  ]]
}
```

**Используется в:**
- `telegram_bot.py` - основная логика бота
- `notifications.py` - отправка уведомлений о парах

---

## 6. Workflow и сценарии

### 6.1 Первый запуск (новый пользователь)

```
1. Пользователь открывает бота @rudn_pro_bot в Telegram
2. Нажимает /start
3. Bot:
   - Получает telegram_id, username, first_name, last_name
   - Проверяет, есть ли юзер в БД (collection: user_settings)
   - Если НЕТ:
     - Создает запись в user_settings (без группы)
     - Создает запись в user_stats (все счетчики = 0)
   - Если ЕСТЬ:
     - Обновляет last_activity
   - Отправляет welcome message с кнопкой "Открыть расписание ✨"

4. Пользователь нажимает кнопку "Открыть расписание"
5. Открывается Telegram Web App (React приложение)
6. Frontend:
   - Получает telegram_id из window.Telegram.WebApp.initDataUnsafe.user.id
   - Запрос GET /api/user-settings/{telegram_id}
   - Получает user_settings (но group_id = null)
   - Показывает WelcomeScreen

7. WelcomeScreen:
   - Анимированная заставка "Let's go"
   - Кнопка "Get Started"
   - Пользователь нажимает -> переход к GroupSelector

8. GroupSelector (4 шага):
   Шаг 1: Выбор факультета
     - Запрос GET /api/faculties
     - Показывает список ~16 факультетов
     - Пользователь выбирает -> selectedFaculty

   Шаг 2: Выбор уровня и курса
     - Запрос POST /api/filter-data {facultet_id}
     - Получает levels и courses
     - Пользователь выбирает -> selectedLevel, selectedCourse

   Шаг 3: Выбор формы обучения
     - Запрос POST /api/filter-data {facultet_id, level_id, kurs}
     - Получает forms
     - Пользователь выбирает -> selectedForm

   Шаг 4: Выбор группы
     - Запрос POST /api/filter-data {facultet_id, level_id, kurs, form_code}
     - Получает groups
     - Пользователь выбирает -> selectedGroup
     - Нажимает "Сохранить"

9. Сохранение группы:
   - Запрос POST /api/user-settings
   Body: {
     telegram_id,
     username,
     first_name,
     last_name,
     group_id: selectedGroup.value,
     group_name: selectedGroup.label,
     facultet_id: selectedFaculty.id,
     facultet_name: selectedFaculty.name,
     level_id: selectedLevel.value,
     kurs: selectedCourse.value,
     form_code: selectedForm.value
   }
   - Backend:
     - Сохраняет в user_settings
     - Трекает действие "select_group"
     - Проверяет достижения -> выдает "Первопроходец" (10 очков)
     - Возвращает UserSettingsResponse

10. Frontend:
    - Получает userSettings с group_id
    - Показывает AchievementNotification (конфетти!)
    - Переход к главному экрану

11. Главный экран:
    - Запрос POST /api/schedule {group_id, week_number: 1}
    - Получает расписание на текущую неделю
    - Отображает:
      - Header с кнопками
      - LiveScheduleCarousel (текущие пары)
      - WeekDaySelector (выбор дня)
      - LiveScheduleSection (список пар)
      - BottomNavigation
```

### 6.2 Просмотр расписания (существующий пользователь)

```
1. Пользователь открывает Web App (через бота или прямую ссылку)
2. Frontend:
   - Получает telegram_id
   - Запрос GET /api/user-settings/{telegram_id}
   - Получает userSettings с сохраненной группой
   - Запрос POST /api/schedule {group_id, week_number: getCurrentWeekNumber()}
   - Получает schedule: List[ScheduleEvent]

3. Отображение:
   LiveScheduleCarousel:
     - Фильтрует пары на СЕЙЧАС (текущий день + текущее время)
     - Определяет статус:
       - "Закончилась" (end_time < now) - зеленый
       - "В процессе" (start_time <= now <= end_time) - желтый
       - "Предстоит" (start_time > now) - красный
     - Показывает карусель (Swiper) с карточками
     - Живой таймер обновляется каждую секунду

   LiveScheduleSection:
     - Фильтрует пары на выбранный день (selectedDate)
     - Группирует по времени (например, "10:30 - 12:00")
     - Показывает список карточек
     - Каждая карточка:
       - Время
       - Дисциплина
       - Тип занятия (лекция, практика, лаб)
       - Преподаватель
       - Аудитория
       - Статус (цветная метка)
       - Expand для деталей

4. Трекинг:
   - При загрузке расписания:
     - Подсчет уникальных пар (по день+время)
     - Запрос POST /api/track-action
     Body: {
       telegram_id,
       action_type: "view_schedule",
       metadata: {classes_count: uniqueTimeSlotsCount}
     }
   - Backend:
     - Обновляет user_stats.schedule_views += classes_count
     - Проверяет достижения:
       - 10 просмотров -> "Исследователь расписания" (15 очков)
       - 50 просмотров -> "Мастер расписания" (25 очков)
```

### 6.3 Создание личной задачи

```
1. Пользователь переходит на вкладку "Задачи" (activeTab = 'tasks')
2. TasksSection:
   - Запрос GET /api/tasks/{telegram_id}
   - Получает список задач
   - Отображает:
     - Карточка "Сегодня" (компактный список задач на сегодня)
     - Основной список задач (с фильтрами и группировкой)
     - Кнопка "+" для создания

3. Пользователь нажимает "+"
4. Открывается AddTaskModal:
   - Поле текста задачи (обязательное)
   - Выбор категории (учеба, личное, спорт, проекты)
   - Выбор приоритета (высокий, средний, низкий)
   - Выбор дедлайна (date + time picker, опционально)
   - Поле заметок (опционально)
   - Теги (через TagsInput, опционально)
   - Кнопка "Создать"

5. Пользователь заполняет и нажимает "Создать"
6. Запрос POST /api/tasks
   Body: {
     telegram_id,
     text: "Подготовиться к экзамену по математике",
     category: "учеба",
     priority: "high",
     deadline: "2025-11-25T10:00:00",
     target_date: "2025-11-25T00:00:00",
     notes: "Повторить главы 1-5",
     tags: ["экзамен", "математика"],
     completed: false,
     order: 0
   }

7. Backend:
   - Создает документ в collection: tasks
   - Генерирует UUID для id
   - Устанавливает created_at, updated_at
   - Возвращает созданную задачу

8. Frontend:
   - Добавляет задачу в локальный state
   - Закрывает модальное окно
   - Задача появляется в списке (в соответствующей группе по дедлайну)
```

### 6.4 Создание комнаты и групповая работа

```
1. Пользователь переходит на вкладку "Журнал" (раздел Rooms в разработке)
2. Нажимает "Создать комнату"
3. Открывается CreateRoomModal:
   - Название комнаты
   - Выбор цвета (из preset палитры)
   - Выбор эмодзи
   - Описание (опционально)
   - Кнопка "Создать"

4. Пользователь заполняет и создает
5. Запрос POST /api/rooms
   Body: {
     name: "Проект по Python",
     color: "#A3F7BF",
     emoji: "🐍",
     description: "Совместная работа над финальным проектом",
     owner_id: telegram_id
   }

6. Backend:
   - Создает документ в collection: rooms (генерирует UUID)
   - Создает первого участника в collection: room_participants
   {
     room_id,
     telegram_id,
     username,
     first_name,
     role: "owner",
     joined_at: now()
   }
   - Возвращает созданную комнату

7. Приглашение участников:
   - Владелец открывает RoomDetailModal
   - Нажимает "Пригласить участников"
   - Запрос POST /api/rooms/{room_id}/invite-link
   - Backend:
     - Генерирует уникальный token (UUID)
     - Формирует ссылку: https://t.me/{bot_username}?start=room_{token}_ref_{owner_id}
     - Возвращает {invite_link, token}
   - Frontend показывает ссылку, кнопка "Копировать"

8. Новый участник:
   - Получает ссылку от владельца
   - Открывает в Telegram -> запускает бота с deep link
   - Bot получает /start room_{token}_ref_{owner_id}
   - Парсит параметры: invite_token, referral_code
   - Запрос POST /api/rooms/join/{invite_token}
   Body: {
     telegram_id: new_user_id,
     username,
     first_name,
     referral_code: owner_id
   }
   - Backend:
     - Находит комнату по token
     - Проверяет, не участник ли уже
     - Добавляет в room_participants (role: "member")
     - Обновляет room.total_participants += 1
     - Отправляет уведомления:
       - Владельцу: "Новый участник {first_name} присоединился к комнате {room_name}"
       - Участнику: "Добро пожаловать в комнату {room_name}"
   - Возвращает информацию о комнате

9. Создание групповой задачи:
   - Любой участник открывает RoomDetailModal
   - Нажимает "+" в секции задач
   - Открывается AddRoomTaskModal
   - Заполняет: текст, приоритет, дедлайн, категория, теги
   - Запрос POST /api/rooms/{room_id}/tasks
   Body: {
     text: "Написать функцию обработки данных",
     priority: "high",
     deadline: "2025-11-30T23:59:00",
     category: "Разработка",
     tags: ["python", "backend"],
     created_by: telegram_id
   }
   - Backend:
     - Создает документ в collection: group_tasks
     - АВТОМАТИЧЕСКИ добавляет всех участников комнаты в assigned_to
     - Обновляет room.total_tasks += 1
     - Возвращает созданную задачу

10. Выполнение задачи:
    - Участник открывает GroupTaskDetailModal
    - Нажимает checkbox "Выполнено"
    - Запрос PUT /api/group-tasks/{task_id}
    Body: {completed: true}
    - Backend:
      - Обновляет task.completed = true
      - Устанавливает task.completed_by = telegram_id
      - Устанавливает task.completed_at = now()
      - Обновляет room.completed_tasks += 1
    - Frontend:
      - Обновляет прогресс комнаты (например, "5 / 10 задач")
      - Показывает галочку на карточке задачи
```

### 6.5 Получение достижения

```
1. Любое действие пользователя -> трекинг:
   - Запрос POST /api/track-action {telegram_id, action_type, metadata}

2. Backend (achievements.py):
   function track_user_action(telegram_id, action_type, metadata):
     # Обновить user_stats в зависимости от action_type
     if action_type == "view_schedule":
       user_stats.schedule_views += metadata.get("classes_count", 1)
     elif action_type == "invite_friend":
       user_stats.friends_invited += 1
     # ... другие actions

     # Проверить достижения
     new_achievements = check_and_award_achievements(telegram_id, user_stats, action_type, metadata)

     # Вернуть список новых достижений
     return new_achievements

   function check_and_award_achievements(telegram_id, user_stats, action_type, metadata):
     new_achievements = []

     # Перебрать все ACHIEVEMENTS
     for achievement_id, achievement in ACHIEVEMENTS.items():
       # Проверить, не получено ли уже
       if already_awarded(telegram_id, achievement_id):
         continue

       # Проверить условие получения
       if check_achievement_condition(achievement, user_stats, action_type, metadata):
         # Выдать достижение
         user_achievements.insert_one({
           "telegram_id": telegram_id,
           "achievement_id": achievement_id,
           "earned_at": datetime.now(),
           "seen": False
         })

         # Обновить статистику
         user_stats.achievements_count += 1
         user_stats.total_points += achievement["points"]

         # Добавить в список новых
         new_achievements.append(achievement)

     return new_achievements

3. Backend возвращает response:
   {
     "new_achievements": [
       {
         "id": "schedule_explorer",
         "name": "Исследователь расписания",
         "description": "Просмотрел расписание 10 раз",
         "emoji": "📚",
         "points": 15,
         "type": "activity",
         "requirement": "Просмотреть расписание 10 раз"
       }
     ]
   }

4. Frontend (App.js):
   function checkAchievements(achievements) {
     if (achievements && achievements.length > 0) {
       // Показать уведомление для каждого достижения
       achievements.forEach((achievement, index) => {
         setTimeout(() => {
           setNewAchievement(achievement);
           setShowAchievement(true);
         }, index * 3000); // По очереди с задержкой 3 сек
       });
     }
   }

5. AchievementNotification компонент:
   - Показывается сверху экрана (position: fixed, top: 8px)
   - Анимация появления (spring animation)
   - Отображает:
     - Эмодзи (большой, 3xl)
     - Текст "Достижение разблокировано!"
     - Название достижения (градиентный текст)
     - Описание
     - Очки (с иконкой звезды)
   - Конфетти падают по всему экрану (generateConfetti())
   - Автоматическое скрытие через 5 секунд
   - Кнопка "Закрыть" (X)
   - Haptic feedback при показе
```

### 6.6 Уведомления о парах

```
1. Scheduler (scheduler.py) запускает задачу каждую минуту:
   @scheduler.scheduled_job('cron', minute='*')
   async def check_upcoming_classes():

2. Логика:
   - Получить текущее время (now)
   - Получить всех пользователей с notifications_enabled=True

   for user in users_with_notifications:
     - Получить userSettings (group_id, notification_time)
     - Получить расписание на сегодня: POST /api/schedule

     for event in schedule:
       - Распарсить время пары (например, "10:30")
       - Вычислить время уведомления: class_time - notification_time минут

       if notification_time <= now < class_time:
         - Проверить, не отправлялось ли уже уведомление (кэш или БД)
         - Если НЕТ:
           - Отправить уведомление через Telegram Bot
           - Запомнить, что уведомление отправлено

3. Отправка уведомления (notifications.py):
   async def send_class_notification(telegram_id, class_info):
     message = f"""
     🔔 <b>Скоро пара!</b>

     📚 <b>{class_info['discipline']}</b>
     🕒 Время: {class_info['time']}
     👨‍🏫 Преподаватель: {class_info['teacher']}
     🏢 Аудитория: {class_info['auditory']}
     📝 Тип: {class_info['lessonType']}
     """

     # Отправка через Bot API
     bot.send_message(
       chat_id=telegram_id,
       text=message,
       parse_mode='HTML'
     )

4. Пользователь получает уведомление в Telegram:
   - Сообщение от @rudn_pro_bot
   - Может открыть Web App и посмотреть расписание
```

---

## 7. Deployment

### 7.1 Текущая конфигурация

**Environment:** Docker/Kubernetes контейнер

**Process Manager:** Supervisor

**Конфигурация Supervisor:**

```ini
[program:backend]
command=python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
directory=/app/backend
autostart=true
autorestart=true
stdout_logfile=/var/log/supervisor/backend.out.log
stderr_logfile=/var/log/supervisor/backend.err.log

[program:frontend]
command=yarn dev --host 0.0.0.0 --port 3000
directory=/app/frontend
autostart=true
autorestart=true
stdout_logfile=/var/log/supervisor/frontend.out.log
stderr_logfile=/var/log/supervisor/frontend.err.log

[program:telegram_bot]
command=python telegram_bot.py
directory=/app/backend
autostart=true
autorestart=true
stdout_logfile=/var/log/supervisor/telegram_bot.out.log
stderr_logfile=/var/log/supervisor/telegram_bot.err.log
```

### 7.2 Сервисы

**Backend:**
- Внутренний порт: 8001
- Доступ: через Kubernetes ingress
- Префикс: /api/*
- Hot reload: enabled (uvicorn --reload)

**Frontend:**
- Внутренний порт: 3000
- Доступ: через Kubernetes ingress
- Root URL: https://class-progress-1.preview.emergentagent.com
- Hot reload: enabled (Vite)

**MongoDB:**
- Внутренний доступ: mongodb://localhost:27017/rudn_schedule
- Database: rudn_schedule
- Коллекции: 7 (см. раздел "База данных")

**Telegram Bot:**
- Запускается отдельным процессом (telegram_bot.py)
- Polling mode (не webhook)
- Обрабатывает команды и отправляет уведомления

### 7.3 Kubernetes Ingress Rules

```yaml
# Упрощенная схема
apiVersion: networking.k8s.io/v1
kind: Ingress
spec:
  rules:
  - host: class-progress-1.preview.emergentagent.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            port: 8001  # Backend

      - path: /
        pathType: Prefix
        backend:
          service:
            port: 3000  # Frontend
```

**Критично:**
- Все API запросы ДОЛЖНЫ начинаться с `/api/`
- Frontend роуты НЕ должны начинаться с `/api/`
- Hardcoding URLs/ports запрещен - только через .env

### 7.4 Мониторинг

**Логи:**
```bash
# Backend
tail -f /var/log/supervisor/backend.out.log
tail -f /var/log/supervisor/backend.err.log

# Frontend
tail -f /var/log/supervisor/frontend.out.log
tail -f /var/log/supervisor/frontend.err.log

# Telegram Bot
tail -f /var/log/supervisor/telegram_bot.out.log
```

**Health Check:**
```bash
curl http://localhost:8001/api/health
# Response: {"status": "ok"}
```

**Supervisor Status:**
```bash
sudo supervisorctl status
# Output:
backend                          RUNNING   pid 1234, uptime 1:23:45
frontend                         RUNNING   pid 5678, uptime 1:23:45
telegram_bot                     RUNNING   pid 9012, uptime 1:23:45
```

### 7.5 Рестарт сервисов

```bash
# Рестарт всех
sudo supervisorctl restart all

# Рестарт отдельных
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
sudo supervisorctl restart telegram_bot

# Только при установке зависимостей:
cd /app/backend && pip install -r requirements.txt && sudo supervisorctl restart backend
cd /app/frontend && yarn install && sudo supervisorctl restart frontend
```

---

**Конец подробной технической документации**