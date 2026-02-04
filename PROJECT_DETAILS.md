# 📘 PROJECT DETAILS - Техническая документация

**Обновлено:** 2025-07-16 | **Статус:** ✅ ПОЛНОСТЬЮ АКТУАЛИЗИРОВАН

---

## 📋 Содержание

1. [Архитектура системы](#1-архитектура-системы)
2. [Backend структура](#2-backend-структура)
3. [Frontend структура](#3-frontend-структура)
4. [Модели данных](#4-модели-данных)
5. [API интеграции](#5-api-интеграции)
6. [Workflow и сценарии](#6-workflow-и-сценарии)
7. [Deployment](#7-deployment)
8. [VK Music интеграция](#8-vk-music-интеграция)
9. [Система друзей](#9-система-друзей)
10. [In-App уведомления](#10-in-app-уведомления)
11. [Web Sessions (QR-авторизация)](#11-web-sessions-qr-авторизация)
12. [Privacy Settings](#12-privacy-settings)
13. [MongoDB коллекции](#13-mongodb-коллекции)

---

## 1. Архитектура системы

### 1.1 Общая схема

Приложение состоит из 4 основных слоёв:

1. **Presentation Layer** - React 19 Telegram Web App
2. **API Layer** - FastAPI REST API (200 endpoints)
3. **Business Logic Layer** - Python модули (achievements, notifications, scheduler)
4. **Data Layer** - MongoDB (33 коллекции) + External APIs

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

### 2.1 Главные модули (LOC statistics)

| Файл | LOC | Описание |
|------|-----|----------|
| `server.py` | **12,753** | ВСЕ API endpoints (200) |
| `models.py` | **2,262** | Pydantic схемы |
| `telegram_bot.py` | **1,347** | Telegram Bot логика |
| `scheduler_v2.py` | **828** | Уведомления V2 |
| `achievements.py` | **770** | 24 достижения |
| `scheduler.py` | 383 | Старый планировщик (резерв) |
| `lk_parser.py` | 380 | Парсинг ЛК РУДН |
| `vk_auth_service.py` | 350 | VK авторизация |
| `music_service.py` | 333 | VK Music сервис |
| `rudn_parser.py` | 311 | Парсинг API РУДН |
| `cover_service.py` | 270 | Обложки треков |
| `notifications.py` | 194 | Telegram уведомления |
| **ИТОГО** | **~25,000** | |

### 2.2 server.py - Главный файл

**Ключевые зависимости:**
```python
from models import *  # Все Pydantic модели
from achievements import check_and_award_achievements, track_user_action, ACHIEVEMENTS
from weather import get_weather_data
from rudn_parser import get_faculties, get_filter_data, get_schedule
from notifications import send_class_notification
from cache import get_cached, set_cached
from music_service import MusicService  # VK Music
from vk_auth_service import VKAuthService  # VK авторизация
from lk_parser import LKParser  # ЛК РУДН
from cover_service import CoverService  # Обложки треков
```

**Основные функции:**
```python
async def get_user_settings(telegram_id)
async def update_last_activity(telegram_id)
async def get_or_create_user_stats(telegram_id)
async def create_in_app_notification(...)
```

### 2.3 achievements.py - 24 достижения

**Категории:**
1. **Basic** - базовые действия (выбор группы, первая неделя)
2. **Social** - социальные (приглашения друзей)
3. **Exploration** - исследование (открытие всех разделов)
4. **Milestone** - milestone (получить все ачивки)
5. **Activity** - активность (ночное/раннее использование)

**Триггеры:**
```python
"select_group" -> first_group
"view_schedule" -> schedule_explorer (10x), schedule_master (50x)
"invite_friend" -> friend_inviter (1x), super_inviter (5x)
"night_usage" -> night_owl (5x)
"early_usage" -> early_bird (5x)
"view_analytics" -> analyst (1x), chart_lover (5x)
```

### 2.4 scheduler_v2.py - Уведомления V2

**Трёхуровневая архитектура:**
1. **Daily Planner** (06:00) - подготовка уведомлений
2. **Notification Executor** - отправка
3. **Retry Handler** (2 мин) - повтор

**Точность:** ±10 секунд  
**Retry:** 3 попытки (1, 3, 5 минут)

---

## 3. Frontend структура

### 3.1 Статистика

| Категория | Количество |
|-----------|------------|
| Основные компоненты | **72** |
| Journal компоненты | **15** |
| Music компоненты | **12** |
| Services (API клиенты) | **10** |
| Utils | **8** |
| Contexts | 2 + PlayerContext |
| **ИТОГО LOC** | **~46,000** |

### 3.2 Ключевые компоненты (по размеру)

| Компонент | LOC | Описание |
|-----------|-----|----------|
| `TasksSection.jsx` | **2,464** | Личные задачи |
| `App.jsx` | **1,610** | Главный компонент |
| `ProfileModal.jsx` | **1,542** | Профиль пользователя |
| `ListeningRoomModal.jsx` | **1,089** | Комнаты прослушивания |
| `AdminPanel.jsx` | **974** | Админ панель |
| `JournalDetailModal.jsx` | **938** | Детали журнала |
| `JournalStatsTab.jsx` | **871** | Статистика журнала |
| `RoomDetailModal.jsx` | **784** | Детали комнаты |

### 3.3 Services (API клиенты)

| Service | Описание |
|---------|----------|
| `api.js` | Основной API клиент |
| `roomsAPI.js` | Комнаты |
| `groupTasksAPI.js` | Групповые задачи |
| `journalAPI.js` | Журнал посещений |
| `musicAPI.js` | VK Music |
| `friendsAPI.js` | Друзья |
| `notificationsAPI.js` | Уведомления |
| `referralAPI.js` | Реферальная система |
| `webSessionAPI.js` | Web Sessions |
| `listeningRoomAPI.js` | Комнаты прослушивания |

### 3.4 Journal компоненты (15)

```
/components/journal/
├── JournalCard.jsx
├── JournalDetailModal.jsx
├── JournalStatsTab.jsx
├── CreateJournalModal.jsx
├── CreateSessionModal.jsx
├── CreateSubjectModal.jsx
├── SubjectDetailModal.jsx
├── SubjectAttendanceModal.jsx
├── AttendanceModal.jsx
├── AddStudentsModal.jsx
├── EditStudentModal.jsx
├── LinkStudentModal.jsx
├── ShareStudentLinkModal.jsx
├── JournalApplicationsModal.jsx
└── MyAttendanceStats.jsx
```

### 3.5 Music компоненты (12)

```
/components/music/
├── MusicSection.jsx         # Главный компонент
├── MusicSearch.jsx          # Поиск треков
├── TrackCard.jsx            # Карточка трека
├── TrackCover.jsx           # Обложка трека
├── TrackList.jsx            # Список треков
├── ArtistCard.jsx           # Карточка исполнителя
├── PlaylistCard.jsx         # Карточка плейлиста
├── MiniPlayer.jsx           # Мини-плеер
├── FullscreenPlayer.jsx     # Полноэкранный плеер
├── VKAuthModal.jsx          # Авторизация VK
├── PlayerContext.jsx        # Контекст плеера
└── ListeningRoomModal.jsx   # Комнаты прослушивания
```

### 3.6 Utils (8)

```
/utils/
├── analytics.js      # Аналитика расписания
├── animations.js     # Framer Motion presets
├── confetti.js       # Конфетти для достижений
├── dateUtils.js      # Работа с датами
├── gestures.js       # Жесты свайпов
├── pluralize.js      # Склонение слов
├── scheduleUtils.js  # Утилиты расписания
└── textUtils.js      # Работа с текстом
```

---

## 4. Модели данных

### 4.1 UserSettings

```python
{
    "id": UUID,
    "telegram_id": int,           # ID в Telegram
    "username": str?,
    "first_name": str?,
    "last_name": str?,
    "group_id": str,              # ID группы РУДН
    "group_name": str,            # Название группы
    "facultet_id": str,
    "facultet_name": str?,
    "level_id": str,
    "kurs": str,
    "form_code": str,
    "notifications_enabled": bool,
    "notification_time": int,     # 5-30 минут
    "referral_code": str,
    "referred_by": int?,
    "invited_count": int,
    "created_at": datetime,
    "last_activity": datetime,
    "privacy_settings": {         # НОВОЕ
        "show_online_status": bool,
        "show_in_search": bool,
        "show_friends_list": bool,
        "show_achievements": bool,
        "show_schedule": bool
    }
}
```

### 4.2 Task

```python
{
    "id": UUID,
    "telegram_id": int,
    "text": str,
    "completed": bool,
    "category": str,              # учеба, личное, спорт, проекты
    "priority": str,              # high, medium, low
    "deadline": datetime?,
    "target_date": datetime?,
    "notes": str?,
    "tags": List[str],
    "order": int,
    "subtasks": List[Subtask],
    "created_at": datetime,
    "updated_at": datetime
}
```

### 4.3 Room

```python
{
    "id": UUID,
    "name": str,
    "color": str,                 # #hex
    "emoji": str,
    "description": str?,
    "owner_id": int,
    "participants": List[{
        "telegram_id": int,
        "username": str?,
        "first_name": str?,
        "role": str,              # owner, member
        "joined_at": datetime
    }],
    "total_tasks": int,
    "completed_tasks": int,
    "created_at": datetime
}
```

### 4.4 WebSession (НОВОЕ)

```python
{
    "session_token": UUID,
    "telegram_id": int?,          # После привязки
    "status": str,                # pending, scanned, linked, expired, revoked
    "device_info": {
        "browser": str,
        "os": str,
        "device": str
    },
    "qr_url": str,
    "created_at": datetime,
    "expires_at": datetime,
    "linked_at": datetime?,
    "last_active": datetime?
}
```

### 4.5 ListeningRoom (НОВОЕ)

```python
{
    "id": UUID,
    "name": str,
    "owner_id": int,
    "invite_code": str,
    "participants": List[{
        "telegram_id": int,
        "username": str?,
        "joined_at": datetime,
        "is_ready": bool
    }],
    "current_track": {
        "track_id": str,
        "title": str,
        "artist": str,
        "position": float,
        "is_playing": bool,
        "updated_at": datetime
    },
    "settings": {
        "allow_skip": bool,
        "private": bool
    },
    "created_at": datetime
}
```

---

## 5. API интеграции

### 5.1 API РУДН

**Base URL:** `http://www.rudn.ru/rasp/lessons/view`

```
# Факультеты
GET /rasp/lessons/view
→ HTML с <select id="facultet">

# Фильтры
POST /rasp/lessons/view
Body: {facultet, level?, kurs?, forma?}
→ HTML с обновленными <select>

# Расписание
POST /rasp/lessons/view
Body: {facultet, level, kurs, forma, group, week}
→ HTML таблица с расписанием
```

### 5.2 OpenWeatherMap API

```
GET /weather?lat=55.7558&lon=37.6173&appid={KEY}&units=metric&lang=ru
→ {temp, feels_like, humidity, wind_speed, description, icon}
```

### 5.3 Telegram Bot API

```python
# Основные методы
bot.send_message(chat_id, text, parse_mode='HTML', reply_markup=...)
bot.get_me()
bot.get_user_profile_photos(user_id)
```

### 5.4 VK Music API

```python
# vkpymusic
service = MusicService(token)
service.search(query)          # Поиск
service.get_audio(user_id)     # Мои аудио
service.get_popular()          # Популярные
service.get_playlists(user_id) # Плейлисты
```

---

## 6. Workflow и сценарии

### 6.1 Первый запуск (новый пользователь)

```
1. Пользователь → /start в @rudn_pro_bot
2. Bot создает user_settings (без группы)
3. Показывает кнопку "Открыть расписание"
4. WebApp → WelcomeScreen → GroupSelector
5. 4 шага выбора: факультет → уровень/курс → форма → группа
6. POST /api/user-settings → сохранение
7. Достижение "Первопроходец" (10 очков)
8. Главный экран с расписанием
```

### 6.2 Просмотр расписания

```
1. GET /api/user-settings/{telegram_id}
2. POST /api/schedule {group_id, week_number}
3. Отображение LiveScheduleCarousel + LiveScheduleSection
4. POST /api/track-action {action: "view_schedule"}
5. Проверка достижений
```

### 6.3 QR-авторизация (Web Sessions)

```
1. Desktop: POST /api/web-sessions → session_token, qr_url
2. Показ QR-кода
3. Mobile: сканирование → POST /api/web-sessions/{token}/scanned
4. Mobile: подтверждение → POST /api/web-sessions/{token}/link
5. Desktop: polling GET /api/web-sessions/{token}/status
6. status: "linked" → авторизован
```

### 6.4 Создание комнаты прослушивания

```
1. POST /api/music/rooms → {id, invite_code}
2. Приглашение друзей через invite_code
3. POST /api/music/rooms/join/{code}
4. POST /api/music/rooms/{id}/sync → синхронизация воспроизведения
5. WebSocket-like polling для обновлений
```

---

## 7. Deployment

### 7.1 Конфигурация Supervisor

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
```

### 7.2 Порты и URL

- **Backend:** 8001 (internal) → через ingress с `/api/` prefix
- **Frontend:** 3000 (internal) → root URL
- **MongoDB:** 27017 (local)

### 7.3 Команды управления

```bash
# Статус
sudo supervisorctl status

# Перезапуск
sudo supervisorctl restart all
sudo supervisorctl restart backend
sudo supervisorctl restart frontend

# Логи
tail -f /var/log/supervisor/backend.*.log
tail -f /var/log/supervisor/frontend.*.log
tail -50 /var/log/supervisor/backend.err.log | grep -i error
```

---

## 8. VK Music интеграция

### 8.1 Компоненты

- `vk_auth_service.py` - авторизация VK (логин/пароль)
- `music_service.py` - API для работы с музыкой
- `cover_service.py` - получение обложек треков

### 8.2 Авторизация

```python
POST /api/music/auth/{telegram_id}
Body: {"login": "...", "password": "..."}
Response: {"success": true, "audio_count": 150}

# Токен сохраняется в user_vk_tokens
```

### 8.3 API Endpoints (25)

```
GET    /api/music/search?q={query}
GET    /api/music/stream/{track_id}
GET    /api/music/redirect/{track_id}
GET    /api/music/my
GET    /api/music/my-vk/{telegram_id}
GET    /api/music/popular
GET    /api/music/playlists
GET    /api/music/playlists-vk/{telegram_id}
GET    /api/music/playlist/{owner_id}/{playlist_id}
GET    /api/music/artist/{artist_name}
GET    /api/music/favorites/{telegram_id}
POST   /api/music/favorites/{telegram_id}
DELETE /api/music/favorites/{telegram_id}/{track_id}
POST   /api/music/auth/{telegram_id}
GET    /api/music/auth/status/{telegram_id}
DELETE /api/music/auth/{telegram_id}
# Listening Rooms
POST   /api/music/rooms
GET    /api/music/rooms/{room_id}
POST   /api/music/rooms/join/{invite_code}
POST   /api/music/rooms/{room_id}/leave
DELETE /api/music/rooms/{room_id}
PUT    /api/music/rooms/{room_id}/settings
GET    /api/music/rooms/user/{telegram_id}
GET    /api/music/rooms/{room_id}/state
POST   /api/music/rooms/{room_id}/sync
```

---

## 9. Система друзей

### 9.1 Функциональность

- Отправка/принятие/отклонение запросов
- Удаление из друзей
- Блокировка пользователей
- Поиск друзей
- Взаимные друзья
- Избранные друзья
- QR-коды для добавления
- Просмотр расписания друзей (с учётом приватности)

### 9.2 API Endpoints (15)

```
POST   /api/friends/request/{target_id}
POST   /api/friends/accept/{request_id}
POST   /api/friends/reject/{request_id}
POST   /api/friends/cancel/{request_id}
DELETE /api/friends/{friend_id}
POST   /api/friends/block/{target_id}
DELETE /api/friends/block/{target_id}
POST   /api/friends/{friend_id}/favorite
GET    /api/friends/search?q={query}
GET    /api/friends/{telegram_id}
GET    /api/friends/{telegram_id}/requests
GET    /api/friends/mutual/{id1}/{id2}
GET    /api/friends/{telegram_id}/blocked
POST   /api/friends/process-invite
```

---

## 10. In-App уведомления

### 10.1 Типы уведомлений

- `friend_request` - запрос в друзья
- `friend_accepted` - запрос принят
- `room_invite` - приглашение в комнату
- `task_assigned` - назначена задача
- `task_completed` - задача выполнена
- `achievement` - новое достижение
- `system` - системные

### 10.2 API Endpoints (8)

```
GET    /api/notifications/{telegram_id}
GET    /api/notifications/{telegram_id}/unread-count
PUT    /api/notifications/{notification_id}/read
PUT    /api/notifications/{telegram_id}/read-all
DELETE /api/notifications/{notification_id}
PUT    /api/notifications/{notification_id}/action
GET    /api/notifications/{telegram_id}/settings
PUT    /api/notifications/{telegram_id}/settings
```

---

## 11. Web Sessions (QR-авторизация)

### 11.1 Описание

Система позволяет авторизоваться на другом устройстве (например, десктоп) через сканирование QR-кода с мобильного телефона.

### 11.2 Статусы сессии

- `pending` - ожидает сканирования
- `scanned` - QR отсканирован
- `linked` - сессия привязана к пользователю
- `expired` - сессия истекла
- `revoked` - сессия отозвана

### 11.3 API Endpoints (11)

```
POST   /api/web-sessions                       # Создать сессию
GET    /api/web-sessions/{token}/status        # Статус сессии
POST   /api/web-sessions/{token}/link          # Привязать устройство
POST   /api/web-sessions/{token}/scanned       # Отметить как отсканированную
POST   /api/web-sessions/{token}/rejected      # Отклонить
GET    /api/web-sessions/user/{id}/devices     # Список устройств
POST   /api/web-sessions/{token}/notify-revoked
POST   /api/web-sessions/{token}/heartbeat     # Keep-alive
DELETE /api/web-sessions/{token}               # Завершить сессию
DELETE /api/web-sessions/user/{id}/all         # Завершить все сессии
```

### 11.4 Frontend компонент

- `DevicesModal.jsx` - управление устройствами

---

## 12. Privacy Settings

### 12.1 Описание

Настройки приватности профиля пользователя.

### 12.2 Поля

```python
{
    "show_online_status": bool,    # Показывать онлайн статус
    "show_in_search": bool,        # Показывать в поиске
    "show_friends_list": bool,     # Показывать список друзей
    "show_achievements": bool,     # Показывать достижения
    "show_schedule": bool          # Показывать расписание
}
```

### 12.3 API Endpoints (2)

```
GET  /api/profile/{telegram_id}/privacy
PUT  /api/profile/{telegram_id}/privacy
```

### 12.4 Frontend компонент

- `PrivacySettingsModal.jsx`

---

## 13. MongoDB коллекции (33)

### Пользователи (6)
| Коллекция | Описание |
|-----------|----------|
| `user_settings` | Настройки и группа |
| `user_stats` | Статистика для достижений |
| `user_achievements` | Полученные достижения |
| `user_vk_tokens` | VK токены для музыки |
| `user_blocks` | Заблокированные |
| `web_sessions` | Веб-сессии (QR авторизация) |

### Задачи (4)
| Коллекция | Описание |
|-----------|----------|
| `tasks` | Личные задачи |
| `group_tasks` | Групповые задачи |
| `group_task_comments` | Комментарии |
| `group_task_invites` | Приглашения |

### Комнаты (3)
| Коллекция | Описание |
|-----------|----------|
| `rooms` | Комнаты (участники встроены) |
| `room_activities` | История активности |
| `listening_rooms` | Комнаты прослушивания музыки |

### Журнал посещений (7)
| Коллекция | Описание |
|-----------|----------|
| `journals` | Журналы |
| `journal_students` | Студенты |
| `journal_subjects` | Предметы |
| `journal_sessions` | Занятия |
| `attendance_records` | Записи посещаемости |
| `journal_pending_members` | Ожидающие |
| `journal_applications` | Заявки |

### Друзья (2)
| Коллекция | Описание |
|-----------|----------|
| `friends` | Связи друзей |
| `friend_requests` | Запросы |

### Уведомления (4)
| Коллекция | Описание |
|-----------|----------|
| `scheduled_notifications` | V2 запланированные |
| `notification_history` | История |
| `sent_notifications` | Отправленные |
| `in_app_notifications` | Внутренние |

### Реферальная система (2)
| Коллекция | Описание |
|-----------|----------|
| `referral_connections` | Связи |
| `referral_events` | События |

### Кэш и прочее (5)
| Коллекция | Описание |
|-----------|----------|
| `schedule_cache` | Кэш расписаний |
| `cover_cache` | Кэш обложек |
| `music_favorites` | Избранные треки |
| `status_checks` | Проверки статуса |
| `lk_connections` | Подключения ЛК |

---

## 14. Ключевые зависимости

### Backend (requirements.txt)
```
fastapi==0.110.1
uvicorn==0.25.0
pymongo==4.5.0
motor==3.3.1
pydantic>=2.6.4
requests>=2.31.0
aiohttp>=3.9.0
httpx>=0.24.0
beautifulsoup4>=4.12.0
lxml>=4.9.0
python-telegram-bot>=20.7
apscheduler>=3.10.4
vkpymusic
vkaudiotoken
yt-dlp
Pillow>=10.0.0
qrcode
```

### Frontend (package.json)
```json
"react": "^19.0.0"
"framer-motion": "^12.23.24"
"axios": "^1.12.2"
"@twa-dev/sdk": "^8.0.2"
"lucide-react": "^0.546.0"
"recharts": "^3.4.1"
"i18next": "^25.6.0"
"react-i18next": "^16.2.0"
"react-router-dom": "^7.5.1"
"canvas-confetti": "^1.9.4"
"qrcode.react": "^4.2.0"
"@vkontakte/icons": "^3.33.0"
"vite": "^7.2.2"
"tailwindcss": "^3.4.17"
```

---

**Конец подробной технической документации**

**Последнее обновление:** 2025-07-16
