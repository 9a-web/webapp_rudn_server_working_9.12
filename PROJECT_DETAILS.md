# 📘 PROJECT DETAILS — Техническая документация

**Обновлено:** 2025-07-17 | **Статус:** ✅ ПОЛНОСТЬЮ АКТУАЛИЗИРОВАН (автоматический аудит кода)

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
13. [Система сообщений](#13-система-сообщений)
14. [Совместное расписание](#14-совместное-расписание)
15. [Streak-система](#15-streak-система)
16. [Расширенная админ-панель](#16-расширенная-админ-панель)
17. [MongoDB коллекции](#17-mongodb-коллекции)
18. [Ключевые зависимости](#18-ключевые-зависимости)

---

## 1. Архитектура системы

### 1.1 Общая схема

Приложение состоит из 4 основных слоёв:

1. **Presentation Layer** — React 19 Telegram Web App
2. **API Layer** — FastAPI REST API (268 endpoints)
3. **Business Logic Layer** — Python модули (achievements, notifications, scheduler, music, VK auth)
4. **Data Layer** — MongoDB (46 коллекций) + External APIs (РУДН, VK, Telegram, OpenWeather)

### 1.2 Технологический стек

#### Backend
- **Framework:** FastAPI 0.110.1
- **Language:** Python 3.10+
- **Database:** MongoDB (pymongo 4.5.0, motor 3.3.1)
- **Async:** asyncio, httpx 0.24+, aiohttp 3.9+
- **Scheduler:** APScheduler 3.10.4
- **Telegram:** python-telegram-bot 20.7+
- **Validation:** Pydantic v2.6+ (230 моделей)
- **HTTP Client:** httpx (async), requests
- **VK Music:** vkpymusic, vkaudiotoken
- **Media:** yt-dlp, Pillow
- **Monitoring:** psutil
- **Security:** cryptography, pyjwt, passlib, python-jose
- **Data:** pandas, numpy, matplotlib

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
- **Screenshots:** html-to-image 1.11.13
- **Confetti:** canvas-confetti 1.9.4
- **Routing:** react-router-dom 7.5.1
- **Icons:** lucide-react 0.546.0, inline VkLogoIcon

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
| `server.py` | **17,675** | ВСЕ API endpoints (268) |
| `models.py` | **2,665** | Pydantic схемы (230 классов) |
| `telegram_bot.py` | **1,359** | Telegram Bot логика |
| `scheduler_v2.py` | **1,039** | Уведомления V2 |
| `achievements.py` | **792** | 24 достижения |
| `cover_service.py` | **502** | Обложки треков |
| `music_service.py` | **387** | VK Music сервис |
| `scheduler.py` | 383 | Старый планировщик (резерв) |
| `lk_parser.py` | 380 | Парсинг ЛК РУДН |
| `vk_auth_service.py` | 331 | VK авторизация + OAuth |
| `rudn_parser.py` | 323 | Парсинг API РУДН |
| `notifications.py` | 177 | Telegram уведомления |
| `weather.py` | 118 | OpenWeatherMap API |
| `config.py` | 113 | Конфигурация ENV |
| `cache.py` | 42 | Кэширование данных |
| **ИТОГО** | **~26,300** | |

### 2.2 server.py — Главный файл

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
async def enrich_conversation(conv)  # НОВОЕ: обогащение диалогов
```

### 2.3 Endpoints по модулям (268 всего)

| Модуль | Endpoints | Методы |
|--------|-----------|--------|
| Журнал посещений | **37** | 10 GET + 16 POST + 4 PUT + 7 DELETE |
| VK Music | **35** | 18 GET + 11 POST + 1 PUT + 5 DELETE |
| Админ панель | **31** | 17 GET + 8 POST + 3 PUT + 3 DELETE |
| Групповые задачи | **19** | 4 GET + 6 POST + 5 PUT + 4 DELETE |
| Сообщения (НОВОЕ) | **18** | 6 GET + 7 POST + 3 PUT + 2 DELETE |
| Комнаты | **17** | 4 GET + 6 POST + 4 PUT + 3 DELETE |
| Друзья | **15** | 6 GET + 7 POST + 0 PUT + 2 DELETE |
| Пользователи | **11** | 6 GET + 2 POST + 2 PUT + 1 DELETE |
| Уведомления | **11** | 4 GET + 2 POST + 4 PUT + 1 DELETE |
| Личные задачи | **10** | 2 GET + 2 POST + 4 PUT + 2 DELETE |
| Web Sessions | **10** | 2 GET + 5 POST + 0 PUT + 3 DELETE |
| Совместное расписание (НОВОЕ) | **9** | 3 GET + 4 POST + 0 PUT + 2 DELETE |
| Реферальная система | **7** | 4 GET + 3 POST |
| Планировщик | **5** | 1 GET + 4 POST |
| Профиль | **5** | 4 GET + 0 POST + 1 PUT |
| Достижения | **5** | 3 GET + 2 POST |
| Расписание РУДН | **4** | 2 GET + 2 POST |
| ЛК РУДН | **4** | 2 GET + 1 POST + 0 PUT + 1 DELETE |
| Бэкапы | **3** | 3 GET |
| Другое | **9** | 6 GET + 3 POST |
| **ИТОГО** | **268** | **123 GET + 87 POST + 29 PUT + 29 DELETE** |

### 2.4 achievements.py — 24 достижения

**Категории:**
1. **Basic** — базовые действия (выбор группы, первая неделя)
2. **Social** — социальные (приглашения друзей)
3. **Exploration** — исследование (открытие всех разделов)
4. **Milestone** — milestone (получить все ачивки)
5. **Activity** — активность (ночное/раннее использование)

**Триггеры:**
```python
"select_group" -> first_group
"view_schedule" -> schedule_explorer (10x), schedule_master (50x)
"invite_friend" -> friend_inviter (1x), super_inviter (5x)
"night_usage" -> night_owl (5x)
"early_usage" -> early_bird (5x)
"view_analytics" -> analyst (1x), chart_lover (5x)
```

### 2.5 scheduler_v2.py — Уведомления V2

**Трёхуровневая архитектура:**
1. **Daily Planner** (06:00) — подготовка уведомлений
2. **Notification Executor** — отправка
3. **Retry Handler** (2 мин) — повтор

**Точность:** ±10 секунд  
**Retry:** 3 попытки (1, 3, 5 минут)

---

## 3. Frontend структура

### 3.1 Статистика

| Категория | Количество | LOC |
|-----------|------------|-----|
| Основные компоненты | **78** | ~39,100 |
| Journal компоненты | **17** | ~7,900 |
| Music компоненты | **13** | ~6,100 |
| Icons | **1** | ~30 |
| Services (API клиенты) | **11** | ~4,150 |
| Utils | **10** | ~1,730 |
| Contexts | **2** | ~510 |
| Hooks | **3** | ~200 |
| App.jsx | **1** | ~2,600 |
| Прочие (index, CSS, etc.) | **8** | ~950 |
| **ИТОГО** | **~145 файлов** | **~64,000** |

### 3.2 Ключевые компоненты (по размеру)

| Компонент | LOC | Описание |
|-----------|-----|----------|
| `AdminPanel.jsx` | **4,382** | Админ панель (расширенная) |
| `TasksSection.jsx` | **3,085** | Личные задачи |
| `App.jsx` | **2,600** | Главный компонент |
| `SharedScheduleView.jsx` | **2,075** | Совместное расписание (НОВОЕ) |
| `ChatModal.jsx` | **1,858** | Чат/сообщения (НОВОЕ) |
| `ListeningRoomModal.jsx` | **1,836** | Комнаты прослушивания |
| `ProfileModal.jsx` | **1,556** | Профиль пользователя |
| `PlannerTimeline.jsx` | **1,386** | Таймлайн планировщика |
| `FriendsSection.jsx` | **1,372** | Друзья |
| `JournalStatsTab.jsx` | **1,205** | Статистика журнала |
| `JournalDetailModal.jsx` | **1,146** | Детали журнала |
| `RoomDetailModal.jsx` | **1,059** | Детали комнаты |
| `PlayerContext.jsx` | **893** | Контекст плеера |
| `MyAttendanceStats.jsx` | **869** | Статистика посещаемости |
| `StreakRewardModal.jsx` | **845** | Streak награды (НОВОЕ) |

### 3.3 Services (API клиенты) — 11 файлов

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
| `messagesAPI.js` | **Сообщения (НОВОЕ)** |

### 3.4 Journal компоненты (17)

```
/components/journal/
├── JournalCard.jsx
├── JournalDetailModal.jsx
├── JournalStatsTab.jsx
├── CreateJournalModal.jsx
├── CreateSessionModal.jsx
├── CreateSubjectModal.jsx
├── EditJournalModal.jsx           # НОВОЕ
├── EditSessionModal.jsx           # НОВОЕ
├── SubjectDetailModal.jsx
├── SubjectAttendanceModal.jsx
├── AttendanceModal.jsx
├── AddStudentsModal.jsx
├── EditStudentModal.jsx
├── LinkStudentModal.jsx
├── ShareStudentLinkModal.jsx
├── JournalApplicationsModal.jsx
├── MyAttendanceStats.jsx
└── index.js
```

### 3.5 Music компоненты (13)

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
├── ListeningRoomModal.jsx   # Комнаты прослушивания
├── SendTrackToFriendModal.jsx # Отправка трека другу (НОВОЕ)
└── index.js
```

### 3.6 Utils (10)

```
/utils/
├── analytics.js      # Аналитика расписания
├── animations.js     # Framer Motion presets
├── botInfo.js        # Информация о боте (НОВОЕ)
├── config.js         # Конфигурация (НОВОЕ)
├── confetti.js       # Конфетти для достижений
├── dateUtils.js      # Работа с датами
├── gestures.js       # Жесты свайпов
├── pluralize.js      # Склонение слов
├── scheduleUtils.js  # Утилиты расписания
└── textUtils.js      # Работа с текстом
```

### 3.7 Hooks (3) — НОВОЕ

```
/hooks/
├── useFaviconBadge.js  # Бейдж на иконке вкладки
├── useFriendEvents.js  # Real-time события друзей
└── useRipple.js        # Ripple эффект для кнопок
```

### 3.8 Дополнительные компоненты (НОВОЕ)

```
/icons/
└── VkLogoIcon.jsx      # Инлайн VK логотип (замена @vkontakte/icons)

Новые основные компоненты:
├── ChatModal.jsx                # Чат с другом
├── ConversationsListModal.jsx   # Список диалогов
├── DesktopSidebar.jsx           # Боковая панель для десктопа
├── ShareScheduleModal.jsx       # Модал шаринга расписания
├── SharedScheduleView.jsx       # Просмотр совместного расписания
├── SelectFriendsModal.jsx       # Выбор друзей (универсальный)
├── StreakRewardModal.jsx        # Награды за streak
├── TelegramLinkConfirmModal.jsx # Подтверждение Telegram ссылки
├── TelegramLinkScreen.jsx       # Экран привязки Telegram
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
    "privacy_settings": {
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

### 4.4 WebSession

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

### 4.5 ListeningRoom

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

### 4.6 Conversation (НОВОЕ)

```python
{
    "id": UUID,
    "participant_ids": List[int],     # telegram_id участников
    "type": str,                       # "direct"
    "created_at": datetime,
    "updated_at": datetime
}
```

### 4.7 Message (НОВОЕ)

```python
{
    "id": UUID,
    "conversation_id": UUID,
    "sender_id": int,                  # telegram_id
    "type": str,                       # text, music, schedule, forward
    "text": str?,
    "music_data": dict?,               # Данные трека
    "schedule_data": dict?,            # Данные расписания
    "reply_to": UUID?,                 # ID сообщения-ответа
    "forwarded_from": UUID?,           # Пересланное сообщение
    "reactions": List[dict],           # Реакции
    "is_pinned": bool,
    "read_at": datetime?,
    "created_at": datetime,
    "updated_at": datetime?
}
```

### 4.8 SharedSchedule (НОВОЕ)

```python
{
    "id": UUID,
    "owner_id": int,                   # telegram_id
    "participants": List[{
        "telegram_id": int,
        "username": str?,
        "first_name": str?,
        "group_name": str?,
        "added_at": datetime
    }],
    "created_at": datetime,
    "updated_at": datetime
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

### 5.5 VK OAuth (НОВОЕ)

```python
# OAuth авторизация через VK ID
VK_APP_ID=...
VK_CLIENT_SECRET=...
VK_REDIRECT_URI=.../api/music/vk-callback
```

---

## 6. Workflow и сценарии

### 6.1 Первый запуск (новый пользователь)

```
1. Пользователь → /start в @rudn_mosbot
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

### 6.5 Отправка сообщения (НОВОЕ)

```
1. Открыть ConversationsListModal → список диалогов
2. POST /api/messages/conversations → создать/найти диалог
3. POST /api/messages/send → отправить сообщение
4. Поддержка: текст, музыка, расписание, пересылка
5. POST /api/messages/{id}/reactions → добавить реакцию
```

### 6.6 Совместное расписание (НОВОЕ)

```
1. POST /api/shared-schedule → создать совместное расписание
2. POST /api/shared-schedule/{id}/add-participant → добавить друга
3. POST /api/shared-schedule/{id}/share-token → генерация ссылки
4. GET /api/shared-schedule/token/{token} → расписание по ссылке
5. SharedScheduleView отображает наложение расписаний
```

### 6.7 Streak-система (НОВОЕ)

```
1. POST /api/users/{id}/visit → визит при входе
2. Автоматический подсчёт серий
3. Каждые 7 дней → POST /api/users/{id}/streak-claim → награда
4. StreakRewardModal → анимация награды
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

- `vk_auth_service.py` — авторизация VK (логин/пароль + OAuth)
- `music_service.py` — API для работы с музыкой
- `cover_service.py` — получение обложек треков

### 8.2 Авторизация

```python
# Логин/пароль
POST /api/music/auth/{telegram_id}
Body: {"login": "...", "password": "..."}
Response: {"success": true, "audio_count": 150}

# VK OAuth (НОВОЕ)
GET /api/music/vk-callback  # OAuth redirect
GET /api/music/auth/config   # Конфигурация OAuth

# Токен сохраняется в user_vk_tokens
```

### 8.3 API Endpoints (35)

```
# Поиск и стриминг
GET    /api/music/search?q={query}
GET    /api/music/stream/{track_id}
GET    /api/music/redirect/{track_id}
GET    /api/music/similar/{track_id}          # НОВОЕ

# Библиотека
GET    /api/music/my
GET    /api/music/my-vk/{telegram_id}
GET    /api/music/popular

# Плейлисты
GET    /api/music/playlists
GET    /api/music/playlists-vk/{telegram_id}
GET    /api/music/playlist/{owner_id}/{playlist_id}
GET    /api/music/playlist-vk/{telegram_id}/{owner_id}/{playlist_id}

# Исполнители
GET    /api/music/artist/{artist_name}

# Избранное
GET    /api/music/favorites/{telegram_id}
POST   /api/music/favorites/{telegram_id}
DELETE /api/music/favorites/{telegram_id}/{track_id}

# История (НОВОЕ)
GET    /api/music/history/{telegram_id}
POST   /api/music/history/{telegram_id}

# Авторизация
POST   /api/music/auth/{telegram_id}
GET    /api/music/auth/status/{telegram_id}
GET    /api/music/auth/config                  # НОВОЕ
GET    /api/music/vk-callback                  # НОВОЕ
DELETE /api/music/auth/{telegram_id}

# Listening Rooms
POST   /api/music/rooms
GET    /api/music/rooms/{room_id}
GET    /api/music/rooms/preview/{invite_code}  # НОВОЕ
POST   /api/music/rooms/join/{invite_code}
POST   /api/music/rooms/{room_id}/leave
DELETE /api/music/rooms/{room_id}
PUT    /api/music/rooms/{room_id}/settings
GET    /api/music/rooms/user/{telegram_id}
GET    /api/music/rooms/{room_id}/state
POST   /api/music/rooms/{room_id}/sync
GET    /api/music/rooms/{room_id}/queue        # НОВОЕ
POST   /api/music/rooms/{room_id}/queue/add    # НОВОЕ
GET    /api/music/rooms/{room_id}/history      # НОВОЕ
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
- Real-time события друзей (НОВОЕ)

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
GET    /api/friends/events/{telegram_id}       # НОВОЕ
POST   /api/friends/process-invite
```

---

## 10. In-App уведомления

### 10.1 Типы уведомлений

- `friend_request` — запрос в друзья
- `friend_accepted` — запрос принят
- `room_invite` — приглашение в комнату
- `task_assigned` — назначена задача
- `task_completed` — задача выполнена
- `achievement` — новое достижение
- `system` — системные
- `message` — новое сообщение (НОВОЕ)

### 10.2 API Endpoints (11)

```
GET    /api/notifications/{telegram_id}
GET    /api/notifications/{telegram_id}/unread-count
PUT    /api/notifications/{notification_id}/read
PUT    /api/notifications/{telegram_id}/read-all
DELETE /api/notifications/{notification_id}
PUT    /api/notifications/{notification_id}/action
GET    /api/notifications/{telegram_id}/settings
PUT    /api/notifications/{telegram_id}/settings
GET    /api/notifications/stats
POST   /api/notifications/test                  # НОВОЕ
POST   /api/notifications/test-inapp            # НОВОЕ
```

---

## 11. Web Sessions (QR-авторизация)

### 11.1 Описание

Система позволяет авторизоваться на другом устройстве (например, десктоп) через сканирование QR-кода с мобильного телефона.

### 11.2 Статусы сессии

- `pending` — ожидает сканирования
- `scanned` — QR отсканирован
- `linked` — сессия привязана к пользователю
- `expired` — сессия истекла
- `revoked` — сессия отозвана

### 11.3 API Endpoints (10)

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

- `DevicesModal.jsx` — управление устройствами

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

## 13. Система сообщений (НОВОЕ)

### 13.1 Описание

Полноценная система обмена сообщениями между друзьями с поддержкой мультимедиа, реакций и пересылки.

### 13.2 Типы сообщений

- `text` — текстовое сообщение
- `music` — трек VK Music
- `schedule` — расписание
- `forward` — пересланное сообщение

### 13.3 API Endpoints (18)

```
# Диалоги
POST   /api/messages/conversations             # Создать/найти диалог
GET    /api/messages/conversations/{telegram_id}  # Список диалогов

# Сообщения
POST   /api/messages/send                      # Отправить текст
POST   /api/messages/send-music                # Отправить трек
POST   /api/messages/send-schedule             # Отправить расписание
POST   /api/messages/forward                   # Переслать
GET    /api/messages/{conversation_id}/messages # Получить сообщения
DELETE /api/messages/{message_id}              # Удалить

# Редактирование
PUT    /api/messages/{message_id}/edit         # Редактировать
PUT    /api/messages/{message_id}/pin          # Закрепить
PUT    /api/messages/{conversation_id}/read    # Отметить прочитанными

# Реакции
POST   /api/messages/{message_id}/reactions    # Реакция

# Типинг
POST   /api/messages/{conversation_id}/typing  # Начал печатать
GET    /api/messages/{conversation_id}/typing   # Проверить типинг

# Поиск
GET    /api/messages/{conversation_id}/search  # Поиск по сообщениям
GET    /api/messages/{conversation_id}/pinned  # Закреплённые

# Непрочитанные
GET    /api/messages/unread/{telegram_id}      # Счётчик непрочитанных

# Создание задач
POST   /api/messages/create-task               # Создать задачу из сообщения
```

### 13.4 Frontend компоненты

- `ChatModal.jsx` — основной чат (1,858 LOC)
- `ConversationsListModal.jsx` — список диалогов (334 LOC)
- `SendTrackToFriendModal.jsx` — отправка трека (Music)
- `messagesAPI.js` — API клиент

---

## 14. Совместное расписание (НОВОЕ)

### 14.1 Описание

Система для совместного просмотра расписаний с друзьями. Позволяет наложить расписания нескольких студентов и найти общие окна.

### 14.2 API Endpoints (9)

```
POST   /api/shared-schedule                    # Создать
GET    /api/shared-schedule/{telegram_id}      # Получить своё
POST   /api/shared-schedule/{id}/add-participant    # Добавить участника
POST   /api/shared-schedule/{id}/add-my-schedule    # Добавить своё расписание
DELETE /api/shared-schedule/{id}/remove-participant/{pid}  # Удалить участника
DELETE /api/shared-schedule/{id}               # Удалить
POST   /api/shared-schedule/{id}/share-token   # Генерация токена
GET    /api/shared-schedule/token/{token}      # По токену
GET    /api/shared-schedule/{id}/invite-link   # Ссылка приглашения
```

### 14.3 Frontend компоненты

- `ShareScheduleModal.jsx` — модал для шаринга (684 LOC)
- `SharedScheduleView.jsx` — просмотр совместного расписания (2,075 LOC)

---

## 15. Streak-система (НОВОЕ)

### 15.1 Описание

Система ежедневных серий посещений. При каждом входе в приложение фиксируется визит. При непрерывной серии в 7 дней доступна награда.

### 15.2 API Endpoints

```
POST /api/users/{telegram_id}/visit         # Зафиксировать визит
POST /api/users/{telegram_id}/streak-claim  # Забрать награду за 7-дневный streak
```

### 15.3 UserStats поля

```python
{
    "visit_streak_current": int,    # Текущая серия
    "visit_streak_max": int,        # Максимальная серия
    "streak_claimed_today": bool,   # Награда получена сегодня
    "last_visit_date": datetime     # Дата последнего визита
}
```

### 15.4 Frontend компонент

- `StreakRewardModal.jsx` — анимация и получение награды (845 LOC)

---

## 16. Расширенная админ-панель (НОВОЕ)

### 16.1 Описание

Админ-панель значительно расширена: мониторинг сервера, управление реферальными ссылками, статистика каналов, модальные изображения и рассылка из Telegram.

### 16.2 API Endpoints (31)

```
# Статистика
GET  /api/admin/stats                      # Общая статистика
GET  /api/admin/users                      # Список пользователей
GET  /api/admin/users-activity             # Активность пользователей
GET  /api/admin/hourly-activity            # Почасовая активность
GET  /api/admin/weekly-activity            # Еженедельная активность
GET  /api/admin/feature-usage              # Использование функций
GET  /api/admin/top-users                  # Топ пользователей
GET  /api/admin/faculty-stats              # Статистика факультетов
GET  /api/admin/course-stats               # Статистика курсов

# Мониторинг (НОВОЕ)
GET  /api/admin/online-users               # Онлайн пользователи
POST /api/admin/track-activity             # Heartbeat
GET  /api/admin/server-stats               # Метрики сервера
GET  /api/admin/server-stats-history       # История метрик
GET  /api/admin/online-stats-history       # История онлайн
GET  /api/admin/channel-stats              # Статистика канала
GET  /api/admin/channel-stats-history      # История канала

# Журналы
GET  /api/admin/journals                   # Все журналы

# Реферальные ссылки (НОВОЕ)
GET  /api/admin/referral-stats             # Статистика рефералов
POST /api/admin/referral-links             # Создать ссылку
GET  /api/admin/referral-links             # Список ссылок
GET  /api/admin/referral-links/{id}        # Детали ссылки
PUT  /api/admin/referral-links/{id}        # Обновить
DELETE /api/admin/referral-links/{id}      # Удалить
GET  /api/admin/referral-links/analytics   # Аналитика
POST /api/admin/referral-track             # Трекинг

# Уведомления (НОВОЕ)
POST /api/admin/send-notification          # Отправить уведомление
POST /api/admin/notifications/parse-telegram  # Парсинг поста из Telegram
POST /api/admin/notifications/send-from-post  # Рассылка из поста

# Изображения (НОВОЕ)
POST   /api/admin/modal-images             # Загрузить изображение
GET    /api/admin/modal-images             # Список изображений
DELETE /api/admin/modal-images/{id}        # Удалить
```

### 16.3 Frontend компонент

- `AdminPanel.jsx` — расширенная админка (4,382 LOC)

---

## 17. MongoDB коллекции (46)

### Пользователи (6)
| Коллекция | Описание |
|-----------|----------|
| `user_settings` | Настройки и группа |
| `user_stats` | Статистика + streaks |
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

### Журнал посещений (8)
| Коллекция | Описание |
|-----------|----------|
| `journals` / `attendance_journals` | Журналы |
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

### Сообщения (2) — НОВОЕ
| Коллекция | Описание |
|-----------|----------|
| `conversations` | Чаты/диалоги |
| `messages` | Сообщения |

### Уведомления (4)
| Коллекция | Описание |
|-----------|----------|
| `scheduled_notifications` | V2 запланированные |
| `notification_history` | История |
| `sent_notifications` | Отправленные |
| `in_app_notifications` | Внутренние |

### Реферальная система (5)
| Коллекция | Описание |
|-----------|----------|
| `referral_connections` | Связи |
| `referral_events` | События |
| `admin_referral_links` | Админ-ссылки (НОВОЕ) |
| `referral_link_events` | События ссылок (НОВОЕ) |
| `referral_rewards` | Награды (НОВОЕ) |

### Совместное расписание (2) — НОВОЕ
| Коллекция | Описание |
|-----------|----------|
| `shared_schedules` | Совместные расписания |
| `schedule_share_tokens` | Токены для шаринга |

### Кэш и медиа (5)
| Коллекция | Описание |
|-----------|----------|
| `schedule_cache` | Кэш расписаний |
| `cover_cache` | Кэш обложек |
| `music_favorites` | Избранные треки |
| `music_history` | История прослушиваний (НОВОЕ) |
| `modal_images` | Изображения модалов (НОВОЕ) |

### Мониторинг и аналитика (5)
| Коллекция | Описание |
|-----------|----------|
| `status_checks` | Проверки статуса |
| `lk_connections` | Подключения ЛК |
| `channel_stats_history` | История статистики канала (НОВОЕ) |
| `online_stats_history` | История онлайн-статистики (НОВОЕ) |
| `server_metrics_history` | История метрик сервера (НОВОЕ) |

---

## 18. Ключевые зависимости

### Backend (requirements.txt)
```
# Core
fastapi==0.110.1
uvicorn==0.25.0
pymongo==4.5.0
motor==3.3.1
pydantic>=2.6.4
python-multipart>=0.0.9

# HTTP
requests>=2.31.0
aiohttp>=3.9.0
httpx>=0.24.0
aiofiles

# Parsing
beautifulsoup4>=4.12.0
lxml>=4.9.0

# Telegram
python-telegram-bot>=20.7

# Scheduling
apscheduler>=3.10.4

# VK Music
vkpymusic
vkaudiotoken

# Media
yt-dlp
Pillow>=10.0.0
matplotlib>=3.7.0

# Security
cryptography>=42.0.8
pyjwt>=2.10.1
passlib>=1.7.4
python-jose>=3.3.0

# Data
pandas>=2.2.0
numpy>=1.26.0

# System
psutil
python-dotenv>=1.0.1
pytz
tzdata>=2024.2
tzlocal>=5.0.0
```

### Frontend (package.json)
```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.5.1",
    "axios": "^1.12.2",
    "framer-motion": "^12.23.24",
    "i18next": "^25.6.0",
    "react-i18next": "^16.2.0",
    "i18next-browser-languagedetector": "^8.2.0",
    "@twa-dev/sdk": "^8.0.2",
    "lucide-react": "^0.546.0",
    "recharts": "^3.4.1",
    "canvas-confetti": "^1.9.4",
    "qrcode.react": "^4.2.0",
    "html-to-image": "^1.11.13"
  },
  "devDependencies": {
    "vite": "^7.2.2",
    "@vitejs/plugin-react": "^5.1.1",
    "tailwindcss": "^3.4.17",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "eslint": "9.23.0"
  }
}
```

---

**Конец подробной технической документации**

**Последнее обновление:** 2025-07-17  
**Метод обновления:** Автоматический аудит кода (grep, wc, find)
