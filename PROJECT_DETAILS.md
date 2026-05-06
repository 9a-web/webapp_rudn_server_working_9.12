# 📘 PROJECT DETAILS — Полная техническая документация

**Обновлено:** 2026-05-06 | **Статус:** ✅ ПОЛНОСТЬЮ АКТУАЛИЗИРОВАН (real-time аудит)

> **TL;DR:** [`AI_CONTEXT.md`](./AI_CONTEXT.md). **Запуск/команды:** [`README.md`](./README.md). **Текущий план:** [`memory/PRD.md`](./memory/PRD.md).

---

## 📋 Содержание

1. [Архитектура системы](#1-архитектура-системы)
2. [Backend структура](#2-backend-структура)
3. [Frontend структура](#3-frontend-структура)
4. [Модели данных](#4-модели-данных)
5. [Auth & Identity (Stage 9-10)](#5-auth--identity-stage-9-10)
6. [Публичный профиль `/u/{uid}`](#6-публичный-профиль-uuid)
7. [API интеграции (внешние)](#7-api-интеграции-внешние)
8. [Workflow и сценарии](#8-workflow-и-сценарии)
9. [Deployment](#9-deployment)
10. [VK Music интеграция](#10-vk-music-интеграция)
11. [Система друзей](#11-система-друзей)
12. [In-App уведомления](#12-in-app-уведомления)
13. [Web Sessions (QR-авторизация устройств)](#13-web-sessions-qr-авторизация-устройств)
14. [Privacy Settings](#14-privacy-settings)
15. [Система сообщений](#15-система-сообщений)
16. [Совместное расписание](#16-совместное-расписание)
17. [Streak-система](#17-streak-система)
18. [Расширенная админ-панель](#18-расширенная-админ-панель)
19. [3D-логотип (singleton)](#19-3d-логотип-singleton)
20. [MongoDB коллекции (57)](#20-mongodb-коллекции-57)
21. [Ключевые зависимости](#21-ключевые-зависимости)

---

## 1. Архитектура системы

### 1.1 Общая схема

Приложение состоит из 4 основных слоёв:

1. **Presentation Layer** — React 19 (Telegram Web App + standalone SPA через Vite + react-router-dom)
2. **API Layer** — FastAPI REST API (**339 endpoints** = 311 в `server.py` + 28 в `auth_routes.py`)
3. **Business Logic Layer** — Python модули: `achievements`, `scheduler_v2`, `level_system`, `email_service`, `music_service`, `vk_auth_service`, `lk_parser`, `cover_service`, `notifications`, `services/delivery`
4. **Data Layer** — MongoDB (**57 коллекций**) + External APIs (РУДН, VK, Telegram, OpenWeather, SMTP)

### 1.2 Технологический стек

#### Backend
- **Framework:** FastAPI 0.110.1
- **Language:** Python 3.10+
- **Database:** MongoDB (`pymongo` 4.5.0, `motor` 3.3.1)
- **Async:** asyncio, httpx 0.24+, aiohttp 3.9+
- **Scheduler:** APScheduler 3.10.4
- **Telegram:** python-telegram-bot 20.7+
- **Validation:** Pydantic v2.6+ (**259 моделей**)
- **HTTP Clients:** httpx (async), requests
- **VK Music:** vkpymusic, vkaudiotoken
- **Media:** yt-dlp, Pillow, matplotlib
- **Monitoring:** psutil
- **Security:** cryptography (AES для LK), pyjwt + python-jose (JWT HS256), passlib + bcrypt (хеши паролей)
- **SMTP:** aiosmtplib (Stage 9)
- **Data:** pandas, numpy
- **Cloud:** boto3 (опц. для S3)
- **OAuth:** requests-oauthlib

#### Frontend
- **Framework:** React 19.0.0
- **Bundler:** Vite 7.2.2
- **Routing:** react-router-dom 7.5.1
- **Styling:** TailwindCSS 3.4.17 + PostCSS + Autoprefixer
- **Animation:** Framer Motion 12.23.24
- **i18n:** i18next 25.6+, react-i18next 16.2, browser-languagedetector
- **State:** React Hooks + Context API (4 контекста)
- **HTTP:** axios 1.12.2 (с `Authorization: Bearer` interceptor + 401 → logout)
- **Telegram:** @twa-dev/sdk 8.0.2
- **Charts:** recharts 3.4.1
- **QR:** qrcode.react 4.2.0
- **Screenshots:** html-to-image 1.11.13
- **Confetti:** canvas-confetti 1.9.4
- **Icons:** lucide-react 1.7.0 + inline VkLogoIcon
- **3D:** three 0.183, @react-three/fiber 9.5, @react-three/drei 10.7
- **JWT:** jwt-decode 4.0.0
- **3dsvg:** 0.2.1 (для импорта SVG как 3D-меша)

#### Infrastructure
- **Container:** Docker / Kubernetes (с ingress: `/api/*` → backend:8001, иначе → frontend:3000)
- **Process Manager:** Supervisor (`backend`, `frontend`, `mongodb`, `code-server`, `nginx-code-proxy`)
- **Database:** MongoDB (локально, port 27017)
- **Reverse Proxy:** Nginx (через K8s ingress)

---

## 2. Backend структура

### 2.1 Главные модули (LOC + назначение)

| Файл | LOC | Назначение |
|------|-----|------------|
| `server.py` | **20,789** | Все API endpoints (311), startup/shutdown hooks, middleware, app.state.db |
| `models.py` | **3,035** | Pydantic схемы (259 классов) — User*, Task, Room, Message, Auth*, Schedule, Notifications, … |
| `auth_routes.py` | **2,537** | `APIRouter` для `/api/auth/*` (28 endpoints) — все auth-провайдеры + sessions + password + email |
| `auth_utils.py` | **817** | `_issue_token`, `verify_token`, `register_session`, `revoke_session`, bcrypt, rate-limit, HMAC validation Telegram, JWT с `jti` |
| `email_service.py` | **278** | `send_email()` через `aiosmtplib` + DEV-fallback в `/app/logs/emails.log`; шаблоны для verify/reset/change-notif |
| `level_system.py` | **775** | Уровни/XP, события `xp_events`, формулы прогрессии, награды |
| `migrate_users.py` | **107** | One-time миграция `user_settings` → `users` (вызывается из startup hook) |
| `scalability_check.py` | **30** | Диагностика индексов, размеров коллекций |
| `seed_test_public_profile.py` | **130** | Сидер для PublicProfilePage (тестовые данные) |
| `telegram_bot.py` | **1,458** | Telegram Bot (handlers, commands, message routing, anti-spam через `safe_send_telegram`) |
| `scheduler_v2.py` | **1,051** | Daily Planner (06:00) → Notification Executor → Retry Handler (3 попытки: 1/3/5 мин) |
| `scheduler.py` | **383** | Старый планировщик (резерв, можно удалить) |
| `achievements.py` | **847** | 24 достижения, ACHIEVEMENTS dict, `track_user_action`, `check_and_award_achievements` |
| `cover_service.py` | **502** | Получение / кэш обложек треков (iTunes / Last.fm fallback) |
| `music_service.py` | **387** | VK Music сервис (поиск, плейлисты, стрим, similar) |
| `vk_auth_service.py` | **331** | VK login/password + OAuth (token exchange) |
| `lk_parser.py` | **380** | Парсинг ЛК РУДН (HTML scraping + AES-encrypted credentials) |
| `rudn_parser.py` | **323** | Парсинг публичного API РУДН (`/rasp/lessons/view`) |
| `notifications.py` | **177** | Telegram-нотификации (низкоуровневые) |
| `weather.py` | **118** | OpenWeatherMap API |
| `config.py` | **113** | ENV → Python settings (с дефолтами) |
| `cache.py` | **42** | `get_cached`/`set_cached` для расписания |
| `services/delivery.py` | **~250** | `MessagePriority`, `send_batch` (через семафор), retry/DLQ через `delivery_attempts` |
| **Тестовые скрипты** | **~3,500** | `test_*.py`, `seed_*.py` (отдельно от prod-кода) |

**Итого ключевых:** ~30,500 LOC.

### 2.2 server.py — главный файл

#### Импорты (ключевые)

```python
from models import *
from achievements import check_and_award_achievements, track_user_action, ACHIEVEMENTS
from weather import get_weather_data
from rudn_parser import get_faculties, get_filter_data, get_schedule
from notifications import send_class_notification
from cache import get_cached, set_cached
from music_service import MusicService
from vk_auth_service import VKAuthService
from lk_parser import LKParser
from cover_service import CoverService
from level_system import grant_xp, get_user_level
from scheduler_v2 import schedule_daily_notifications, retry_failed_notifications
from auth_routes import router as auth_router
from migrate_users import migrate_user_settings_to_users
from services.delivery import safe_send_telegram, send_batch, MessagePriority
```

#### Ключевые async-функции

```python
async def get_user_settings(telegram_id)
async def update_last_activity(telegram_id)
async def get_or_create_user_stats(telegram_id)
async def create_in_app_notification(...)
async def enrich_conversation(conv)
async def resolve_user_by_uid(uid)            # /u/{uid} helper
async def get_current_user_required(request)  # JWT validation + session-revocation enforcement
```

#### Startup hooks

```python
@app.on_event("startup")
async def startup():
    app.state.db = client[DB_NAME]
    await migrate_user_settings_to_users()
    await create_indexes()                   # TTL на auth_sessions, profile_views, auth_tokens
    schedule_daily_notifications()
    retry_failed_notifications()
```

### 2.3 Endpoints по модулям (339 всего)

| Модуль | Endpoints | Методы | Описание |
|--------|-----------|--------|----------|
| Журнал посещений | **36** | GET+POST+PUT+DELETE | Журналы, студенты, предметы, занятия, заявки, ссылки на студентов |
| VK Music | **35** | GET+POST+PUT+DELETE | Поиск, стрим, плейлисты, listening-rooms, OAuth, история, similar |
| Админ-панель | **33** | GET+POST+PUT+DELETE | Статистика, мониторинг, рефералы, модальные изображения, рассылки, delivery |
| 🔐 Auth | **28** | в `auth_routes.py` | Email/TG/VK/QR + me + sessions + password + email |
| Групповые задачи | **18** | GET+POST+PUT+DELETE | CRUD + подзадачи + комментарии + приглашения |
| 💬 Сообщения | **18** | GET+POST+PUT+DELETE | Чаты, реакции, типинг, пересылка, поиск, пины |
| Профиль (legacy `/profile/*`) | **18** | GET+POST+PUT+DELETE | Обратная совместимость — `qr`, `schedule`, `privacy`, `wall-graffiti`, `avatar` |
| Комнаты | **17** | GET+POST+PUT+DELETE | CRUD + участники + активность + роли |
| Друзья | **15** | GET+POST+DELETE | Запросы, блокировки, поиск, mutual, favorites, events |
| 🔗 Публичный профиль `/u/{uid}/*` | **13** | GET+POST+PUT | Resolve, профиль, schedule, qr, share-link, privacy, view, avatar, graffiti, wall-graffiti, friends, achievements |
| Уведомления | **11** | GET+POST+PUT+DELETE | CRUD + настройки + тестирование |
| Web Sessions | **9** | GET+POST+DELETE | QR-авторизация cross-device |
| Пользователи | **9** | GET+POST+PUT+DELETE | Settings, тема, история, streak, visit |
| Tasks (личные) | **9** | GET+POST+PUT+DELETE | CRUD + подзадачи + продуктивность |
| 📤 Совместное расписание | **8** | GET+POST+DELETE | Шаринг, участники, токены |
| Реферальная система | **7** | GET+POST | Коды, статистика, дерево, веб-апп |
| Планировщик | **5** | GET+POST | Синхронизация, события, превью |
| Достижения | **5** | GET+POST | Список, трекинг, пометить просмотренными |
| Расписание РУДН | **4** | GET+POST | Факультеты, фильтры, расписание, кэш |
| ЛК РУДН | **4** | GET+POST+DELETE | Подключение, отключение, данные, статус |
| Privacy (legacy) | **4** | GET+PUT | Настройки приватности |
| Бэкапы | **3** | GET | Экспорт БД |
| Dev / диагностика | **5** | `/dev/*` | Внутренние тулзы |
| Граффити / прочее | **8** | GET+POST | Wall-graffiti, weather, status |
| **ИТОГО** | **339** | | |

### 2.4 achievements.py — 24 достижения

**Категории:**
1. **Basic** — базовые действия (выбор группы, первая неделя)
2. **Social** — приглашения друзей, рефералы
3. **Exploration** — открытие всех разделов
4. **Milestone** — milestone (получить все ачивки, 100 задач)
5. **Activity** — ночное / раннее использование

**Триггеры (примеры):**
```python
"select_group" → first_group
"view_schedule" → schedule_explorer (10x), schedule_master (50x)
"invite_friend" → friend_inviter (1x), super_inviter (5x)
"night_usage" → night_owl (5x)
"early_usage" → early_bird (5x)
"view_analytics" → analyst (1x), chart_lover (5x)
"complete_task" → task_doer (10x), task_master (100x)
```

### 2.5 scheduler_v2.py — Уведомления V2

**Трёхуровневая архитектура:**
1. **Daily Planner** (06:00) — анализ расписания, подготовка `scheduled_notifications`
2. **Notification Executor** — отправка через `safe_send_telegram` (с антиспамом)
3. **Retry Handler** (каждые 2 мин) — повтор неудачных через `delivery_attempts` (DLQ)

- **Точность:** ±10 секунд
- **Retry:** 3 попытки (через 1, 3, 5 минут)
- **Anti-spam:** проверка `last_sent_at` для каждого `(user, notification_kind)`

---

## 3. Frontend структура

### 3.1 Статистика

| Категория | Количество | LOC |
|-----------|------------|-----|
| Top-level компоненты | **91** | ~50,000 |
| Auth компоненты | **12** | ~3,200 |
| Journal компоненты | **17** | ~7,900 |
| Music компоненты | **13** | ~6,100 |
| Icons | **1** | ~30 |
| Pages | **9** | ~3,700 |
| Services (API клиенты) | **12** | ~4,600 |
| Contexts | **4** | ~940 |
| Utils | **14** | ~2,250 |
| Hooks | **5** | ~455 |
| Constants | **3** | ~120 |
| `App.jsx` | **1** | 2,734 |
| `index.jsx` + CSS | **3** | ~150 |
| **ИТОГО** | **~185 файлов** | **~74,300** |

### 3.2 Pages (9 SPA-страниц)

```
/app/frontend/src/pages/
├── LoginPage.jsx
├── RegisterWizard.jsx              # Многошаговая регистрация (provider → username → group/faculty)
├── ForgotPasswordPage.jsx          # 🆕 Stage 9
├── ResetPasswordPage.jsx           # 🆕 Stage 9 (auto-login после сброса)
├── VerifyEmailPage.jsx             # 🆕 Stage 9
├── VKCallbackPage.jsx              # OAuth callback VK ID
├── QRConfirmPage.jsx               # Подтверждение QR-сессии
├── PublicProfilePage.jsx           # /u/:uid (вне AuthGate)
└── Test3DLogoPage.jsx              # 🆕 Тестовая страница 3D-логотипа
```

### 3.3 Маршруты (App.jsx)

```jsx
<BrowserRouter>
  <Routes>
    {/* Без авторизации */}
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterWizard />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/verify-email" element={<VerifyEmailPage />} />
    <Route path="/auth/vk/callback" element={<VKCallbackPage />} />
    <Route path="/auth/qr/confirm" element={<QRConfirmPage />} />
    <Route path="/u/:uid" element={<PublicProfilePage />} />

    {/* Защищено AuthGate */}
    <Route path="/" element={<AuthGate><Home /></AuthGate>} />

    {/* Diag/тест */}
    <Route path="/status-tester" element={<StatusTester />} />
    <Route path="/streak-demo" element={<StreakRewardPreview />} />
    <Route path="/test-3d-logo" element={<Test3DLogoPage />} />
  </Routes>
</BrowserRouter>
```

### 3.4 Top-level компоненты (91)

```
AchievementNotification, AchievementsModal, AddRoomTaskModal, AddTaskModal,
AdminPanel, AnalyticsModal, BottomNavigation, CalendarModal,
ChangePasswordModal, ChatModal, ConversationsListModal, CreateEventModal,
CreateGroupTaskModal, CreateRoomModal, DeleteConfirmModal, DesktopSidebar,
DevicesModal, EditEventModal, EditRoomTaskModal, EditTaskModal,
EmailVerificationBanner, ErrorBoundary, FriendCard, FriendProfileModal,
FriendSearchModal, FriendsSection, GraffitiEditor, GreetingNotification,
GroupSelector, GroupTaskCard, GroupTaskDetailModal, Header, JournalSection,
LKConnectionModal, LevelDetailModal, LevelUpModal, LinkedAccountsModal,
LiveScheduleCard, LiveScheduleCarousel, LiveScheduleSection, LoadingScreen,
Logo3D, Logo3DAnchor, Logo3DHost, MenuModal, NewYearTheme,
NotificationHistory, NotificationQueue, NotificationSettings,
NotificationSettingsPanel, NotificationsPanel, PlannerEventCard,
PlannerTimeline, PrepareForLectureModal, ProductivityStats, ProfileEditScreen,
ProfileModal, ProfileScreen, ProfileSettingsModal, ReferralModal,
ReferralTree, RippleEffect, RoomActivityFeed, RoomCard, RoomDetailModal,
RoomParticipantsList, RoomStatsPanel, SelectFriendsModal, SessionsModal,
ShareScheduleModal, SharedScheduleView, SkeletonCard, SnowfallBackground,
StreakRewardModal, SubtasksList, SwipeHint, SyncPreviewModal, TagsInput,
TaskCompletionBanner, TaskDetailModal, TasksSection, TelegramLinkConfirmModal,
TelegramLinkScreen, TopGlow, UpcomingClassNotification, WallGraffiti,
WeatherWidget, WeekDateSelector, WeekDaySelector, WelcomeScreen, YouTubePreview
```

### 3.5 Auth компоненты (12)

```
/components/auth/
├── AuthGate.jsx                       # Защита маршрутов
├── AuthLayout.jsx                     # Базовый layout страниц авторизации
├── AuthButton.jsx, AuthInput.jsx
├── EmailLoginForm.jsx, EmailRegisterForm.jsx
├── UsernameField.jsx                  # Real-time check-username
├── TelegramLoginWidget.jsx            # Telegram Login Widget (HMAC)
├── TelegramWebAppLoginButton.jsx      # 🆕 кнопка для Telegram WebApp
├── TelegramWebAppConfirm.jsx          # 🆕 подтверждение в WebApp
├── VkLoginButton.jsx
└── QRLoginBlock.jsx                   # QR + polling статуса
```

### 3.6 Services (12 API клиентов)

| Service | Файл | Описание |
|---------|------|----------|
| Основной | `api.js` | scheduleAPI, userAPI, achievementsAPI, tasksAPI, activityAPI, streakAPI, sharedScheduleAPI + axios interceptor |
| Auth | `authAPI.js` | `/api/auth/*` (login/register/me/sessions/password/email) |
| Друзья | `friendsAPI.js` | `/api/friends/*` |
| Групповые задачи | `groupTasksAPI.js` | `/api/group-tasks/*` |
| Журнал | `journalAPI.js` | `/api/journals/*` |
| Listening Rooms | `listeningRoomAPI.js` | VK Music совместное прослушивание |
| Сообщения | `messagesAPI.js` | `/api/messages/*` |
| VK Music | `musicAPI.js` | `/api/music/*` |
| Уведомления | `notificationsAPI.js` | In-app notifications |
| Рефералы | `referralAPI.js` | `/api/referral/*` |
| Комнаты | `roomsAPI.js` | `/api/rooms/*` |
| Web Sessions | `webSessionAPI.js` | `/api/web-sessions/*` |

### 3.7 Contexts (4)

```
/contexts/
├── AuthContext.jsx              # token, user, login, logout, refreshMe + axios Bearer interceptor + 401 → logout
├── TelegramContext.jsx          # Telegram WebApp SDK обёртка
├── ThemeContext.jsx             # Light/Dark + accent colors
└── Logo3DContext.jsx            # 🆕 Singleton 3D-логотипа (anchors map + setRect)
```

### 3.8 Utils (14)

```
/utils/
├── analytics.js          # Метрики расписания
├── animations.js         # Framer Motion presets
├── authStorage.js        # 🆕 localStorage wrapper для JWT
├── botInfo.js            # Информация о боте (@username для приглашений)
├── confetti.js           # Конфетти-эффект для achievements
├── config.js             # Frontend конфигурация
├── dateUtils.js          # Работа с датами (week numbers, isoWeek)
├── gestures.js           # Жесты swipe (mobile)
├── logoPreload.js        # 🆕 prefetch SVG для 3D-логотипа (экономия 500-3000ms)
├── pluralize.js          # Склонение "1 задача / 2 задачи / 5 задач"
├── safeRedirect.js       # 🆕 Whitelisted redirect (безопасность)
├── scheduleUtils.js      # Утилиты расписания
├── textUtils.js          # Работа с текстом (труcncate, escape)
├── userIdentity.js       # 🆕 isSameUser(a, b) — поддержка uid+tid (КРИТИЧНО для UID-миграции)
└── __tests__/            # Unit-тесты utils
```

### 3.9 Hooks (5)

```
/hooks/
├── useFaviconBadge.js          # Badge counter на favicon
├── useFriendEvents.js          # Real-time события друзей (polling)
├── useRipple.js                # Material Ripple эффект на кнопках
├── useIsAdmin.js               # 🆕 Проверка admin-роли через /auth/me/is_admin
└── useIsInsideTelegram.js      # 🆕 Детект Telegram WebApp окружения
```

### 3.10 Constants (3)

```
/constants/
├── levelConstants.js     # Уровни/XP формулы
├── publicBase.js         # PUBLIC_BASE_URL = REACT_APP_BACKEND_URL
└── roomColors.js         # Палитра цветов для комнат
```

### 3.11 Ключевые компоненты (по размеру)

| Компонент | LOC | Назначение |
|-----------|-----|------------|
| `AdminPanel.jsx` | **4,400+** | Админ-панель (статистика, мониторинг, рассылки, рефералы) |
| `TasksSection.jsx` | **3,000+** | Личные задачи с фильтрами/категориями |
| `App.jsx` | **2,734** | Главный компонент + маршруты + основная логика |
| `SharedScheduleView.jsx` | **2,000+** | Наложение расписаний друзей |
| `ChatModal.jsx` | **1,800+** | Чат с другом (текст/музыка/расписание/реакции) |
| `ListeningRoomModal.jsx` | **1,800+** | Комнаты прослушивания VK Music |
| `ProfileModal.jsx` | **1,500+** | Профиль пользователя |
| `PlannerTimeline.jsx` | **1,300+** | Timeline планировщика |
| `FriendsSection.jsx` | **1,300+** | Список друзей + поиск |
| `JournalStatsTab.jsx` | **1,200+** | Статистика журнала |
| `JournalDetailModal.jsx` | **1,100+** | Детали журнала |
| `RoomDetailModal.jsx` | **1,000+** | Детали комнаты |
| `StreakRewardModal.jsx` | **800+** | Streak-награды с анимацией |

---

## 4. Модели данных

### 4.1 User (Stage 9 расширена)

```python
{
  "id": UUID,                          # Mongo _id (UUID)
  "uid": "123456789",                  # 9-значный numeric public ID
  "username": "petr_smirnov",          # lowercase, unique
  "email": "petr@example.com",         # unique, optional
  "password_hash": "$2b$12$...",       # bcrypt
  "telegram_id": 12345678,             # optional
  "vk_id": 87654321,                   # optional
  "photo_url": "https://t.me/...",     # из Telegram/VK
  "photo_url_custom": "https://...",   # 🆕 кастомный аватар
  "email_verified": false,             # 🆕 Stage 9
  "primary_auth": "email",             # email | telegram | vk
  "auth_providers": ["email", "telegram"],
  "first_name": "Пётр",
  "last_name": "Смирнов",
  "created_at": datetime,
  "last_activity": datetime
}
```

### 4.2 UserSettings (legacy primary, telegram_id-based)

```python
{
  "telegram_id": 12345678,             # primary key
  "uid": "123456789",                  # FK → users.uid (после миграции)
  "username": str?,
  "first_name": str?,
  "last_name": str?,
  "group_id": str,
  "group_name": str,
  "facultet_id": str,
  "facultet_name": str?,
  "level_id": str,
  "kurs": str,
  "form_code": str,
  "notifications_enabled": bool,
  "notification_time": int,            # 5-30 минут до пары
  "referral_code": str,                # auto-gen (Stage 9)
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

### 4.3 AuthSession (Stage 9)

```python
{
  "id": UUID,
  "uid": "123456789",
  "jti": "uuid-jti-...",               # unique, в JWT
  "device_label": "Chrome on macOS",   # parsed from UA
  "ip": "192.168.1.1",
  "user_agent": "Mozilla/5.0 ...",
  "created_at": datetime,
  "last_seen": datetime,
  "expires_at": datetime,              # TTL индекс
  "revoked": false
}
```

### 4.4 AuthToken (Stage 9 — для password-reset / email-verify)

```python
{
  "token_hash": "sha256_hex...",       # хранится только хеш
  "purpose": "password_reset",         # | "email_verify"
  "uid": "123456789",
  "email": "petr@example.com",
  "used": false,
  "created_at": datetime,
  "expires_at": datetime               # TTL: 1 час для reset, 24 часа для verify
}
```

### 4.5 AuthEvent (Stage 9 audit-log)

```python
{
  "id": UUID,
  "event": "login_success",            # login_success/failure, password_change, ...
  "uid": "123456789",
  "provider": "email",                 # email | telegram | vk | qr
  "success": true,
  "ts": datetime,
  "ip": str,
  "ua": str,
  "extra": { "hashed_email": "..." }   # privacy-friendly
}
```

### 4.6 Task

```python
{
  "id": UUID, "telegram_id": int, "text": str, "completed": bool,
  "category": "учеба|личное|спорт|проекты", "priority": "high|medium|low",
  "deadline": datetime?, "target_date": datetime?, "notes": str?,
  "tags": List[str], "order": int,
  "subtasks": [{"id": UUID, "text": str, "completed": bool}],
  "created_at": datetime, "updated_at": datetime
}
```

### 4.7 Room

```python
{
  "id": UUID, "name": str, "color": "#hex", "emoji": str,
  "description": str?, "owner_id": int,
  "participants": [{
    "telegram_id": int, "username": str?, "first_name": str?,
    "role": "owner|member", "joined_at": datetime
  }],
  "total_tasks": int, "completed_tasks": int, "created_at": datetime
}
```

### 4.8 Conversation + Message

```python
# Conversation
{
  "id": UUID, "participant_ids": [int, int], "type": "direct",
  "created_at": datetime, "updated_at": datetime
}

# Message
{
  "id": UUID, "conversation_id": UUID, "sender_id": int,
  "type": "text|music|schedule|forward",
  "text": str?, "music_data": dict?, "schedule_data": dict?,
  "reply_to": UUID?, "forwarded_from": UUID?,
  "reactions": [{"user_id": int, "emoji": str}],
  "is_pinned": bool, "read_at": datetime?,
  "created_at": datetime, "updated_at": datetime?
}
```

### 4.9 SharedSchedule

```python
{
  "id": UUID, "owner_id": int,
  "participants": [{
    "telegram_id": int, "username": str?, "first_name": str?,
    "group_name": str?, "added_at": datetime
  }],
  "created_at": datetime, "updated_at": datetime
}
```

### 4.10 ListeningRoom (VK Music)

```python
{
  "id": UUID, "name": str, "owner_id": int, "invite_code": str,
  "participants": [{
    "telegram_id": int, "username": str?,
    "joined_at": datetime, "is_ready": bool
  }],
  "current_track": {
    "track_id": str, "title": str, "artist": str,
    "position": float, "is_playing": bool, "updated_at": datetime
  },
  "settings": {"allow_skip": bool, "private": bool},
  "created_at": datetime
}
```

### 4.11 WebSession (QR-авторизация устройств)

```python
{
  "session_token": UUID, "telegram_id": int?,
  "status": "pending|scanned|linked|expired|revoked",
  "device_info": {"browser": str, "os": str, "device": str},
  "qr_url": str,
  "created_at": datetime, "expires_at": datetime,
  "linked_at": datetime?, "last_active": datetime?
}
```

> **Полные модели (259 классов) — в** `/app/backend/models.py`. Включают `*Request` / `*Response` / `*Public` / `*Update` варианты для каждого основного класса.

---

## 5. Auth & Identity (Stage 9-10)

### 5.1 Архитектура

```
┌──────────────┐    JWT (HS256, jti)    ┌──────────────┐
│   Frontend   │ ◄────────────────────► │   Backend    │
│ AuthContext  │   localStorage         │ auth_routes  │
│ + axios int. │   ↓                    │ + auth_utils │
└──────────────┘   Authorization: Bearer└──────────────┘
                                              │
                                              ▼
                  ┌─────────────────────────────────────────────┐
                  │ MongoDB:                                    │
                  │   users (identity)                          │
                  │   auth_sessions (jti, expires_at TTL)       │
                  │   auth_tokens (sha256, purpose, TTL)        │
                  │   auth_events (audit-log)                   │
                  │   auth_qr_sessions / qr_login_sessions      │
                  └─────────────────────────────────────────────┘
```

### 5.2 JWT-структура

```json
{
  "sub": "uid:123456789",
  "uid": "123456789",
  "tid": 12345678,
  "jti": "uuid-of-session",
  "iat": 1714000000,
  "exp": 1716592000
}
```

- **Algorithm:** HS256
- **Secret:** `JWT_SECRET_KEY` (auto-gen при первом старте, можно задать через ENV)
- **Expire:** 30 дней
- **`jti`:** для отзыва сессий — каждый JWT привязан к записи в `auth_sessions`

### 5.3 28 Auth endpoints (полный список)

```
# ───── Регистрация / Логин ─────
POST   /api/auth/register/email
POST   /api/auth/login/email
POST   /api/auth/login/telegram                  # HMAC-валидация Login Widget
POST   /api/auth/login/telegram-webapp           # initData валидация
POST   /api/auth/login/vk                        # VK ID OAuth code → token

# ───── QR Cross-Device ─────
POST   /api/auth/login/qr/init
GET    /api/auth/login/qr/{qr_token}/status
POST   /api/auth/login/qr/{qr_token}/confirm

# ───── Текущий пользователь ─────
GET    /api/auth/me                              # → UserPublic (включая email_verified, referral_code, invited_count, referred_by)
GET    /api/auth/me/is_admin

# ───── Linking ─────
POST   /api/auth/link/email
POST   /api/auth/link/telegram
POST   /api/auth/link/telegram-webapp
POST   /api/auth/link/vk
DELETE /api/auth/link/{provider}                 # email | telegram | vk → 404 если не привязан

# ───── Username & профиль ─────
GET    /api/auth/check-username/{username}
PATCH  /api/auth/profile-step

# ───── Password Management (Stage 9) ─────
POST   /api/auth/password/change                 # auth-required, wrong old → 401, new==old → 400, revoke other sessions, email-notification
POST   /api/auth/password/forgot                 # privacy-aware (всегда 200), rate-limit 5/hr/IP + 3/hr/email, SHA-256 hashed token
POST   /api/auth/password/reset                  # token + auto-login + revoke other sessions + email-notification

# ───── Email Verification (Stage 9) ─────
POST   /api/auth/email/send-verification         # 5/hr/uid
POST   /api/auth/email/verify                    # token valid, not-reused, email-not-changed

# ───── Sessions / Devices (Stage 9) ─────
GET    /api/auth/sessions                        # с is_current + device_label (UA-parsed)
DELETE /api/auth/sessions/{jti}                  # → 404 если нет
POST   /api/auth/logout                          # отзыв текущей сессии (jti)
POST   /api/auth/logout-all                      # ?keep_current=true|false

# ───── Конфиг ─────
GET    /api/auth/config                          # bot_username, VK_APP_ID, public flags
```

### 5.4 Telegram HMAC-валидация

```python
def verify_telegram_login_widget_hash(data, bot_token):
    secret = sha256(bot_token).digest()
    check_string = '\n'.join(f'{k}={v}' for k, v in sorted(data.items()) if k != 'hash')
    expected_hash = hmac.new(secret, check_string.encode(), sha256).hexdigest()
    return expected_hash == data['hash']
```

### 5.5 Sessions enforcement (КРИТИЧНО)

```python
# auth_utils.py
async def get_current_user_required(request: Request):
    token = extract_bearer(request)
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    jti = payload['jti']

    # Stage 9 fix: проверка отзыва сессии
    db = request.app.state.db
    session = await db.auth_sessions.find_one({"jti": jti})
    if not session or session.get("revoked"):
        raise HTTPException(401, "Session revoked")

    user = await db.users.find_one({"uid": payload['uid']})
    return user
```

### 5.6 Email Service (Stage 9)

```python
# email_service.py
async def send_email(to, subject, html_body):
    if not SMTP_HOST:
        # DEV-fallback
        with open('/app/logs/emails.log', 'a') as f:
            f.write(f"[{datetime.now()}] To: {to}\nSubj: {subject}\n{html_body}\n---\n")
        return
    async with aiosmtplib.SMTP(...) as smtp:
        await smtp.send_message(...)
```

**Шаблоны:**
- `template_password_reset(token_url)` — ссылка на `/reset-password?token=...`
- `template_email_verify(token_url)` — ссылка на `/verify-email?token=...`
- `template_password_changed_notification(ip, ua)` — уведомление о смене

---

## 6. Публичный профиль `/u/{uid}`

### 6.1 Архитектура

- 9-значный numeric `uid` — единый public ID (легко вводить, не раскрывает `telegram_id`)
- Доступ БЕЗ авторизации (вне `AuthGate`)
- Privacy-фильтры применяются на уровне backend (см. `privacy_settings`)

### 6.2 13 endpoints

| Endpoint | Описание |
|----------|----------|
| `GET /api/u/{uid}/resolve` | UID → внутренние идентификаторы (`telegram_id`, `id`) |
| `GET /api/u/{uid}` | `UserProfilePublic` (с privacy-фильтром) |
| `GET /api/u/{uid}/schedule` | Расписание (для друзей + владельца) |
| `GET /api/u/{uid}/qr` | QR-данные для добавления в друзья |
| `GET /api/u/{uid}/share-link` | `{PUBLIC_BASE_URL}/u/{uid}` |
| `GET /api/u/{uid}/privacy` | Только владелец |
| `PUT /api/u/{uid}/privacy` | Обновить privacy_settings |
| `POST /api/u/{uid}/view` | Регистрация просмотра (TTL 7 дней в `profile_views`) |
| `GET /api/u/{uid}/avatar` | Кастомный аватар + fallback на photo_url |
| `GET /api/u/{uid}/graffiti` | Граффити-логотип пользователя |
| `GET /api/u/{uid}/wall-graffiti` | Стена с граффити (privacy-aware) |
| `GET /api/u/{uid}/friends` | Список друзей (privacy: `show_friends_list`) |
| `GET /api/u/{uid}/achievements` | Список достижений (privacy: `show_achievements`) |

### 6.3 PublicProfilePage.jsx

- ~480 LOC, состояния: `loading | 404 | hidden | 422 | loaded`
- Hero: avatar gradient + initials, name, username, group/faculty, level/tier badge, online, friendship badge
- Stats grid (Друзей / Общих / Достижений) + privacy-индикация
- XP progress bar, member-since chip, profile_views (для владельца)
- CTA: "Открыть в Telegram" / "Поделиться" / "Копировать ссылку"
- Auto-регистрация просмотра + Document.title + meta description (SEO)

---

## 7. API интеграции (внешние)

### 7.1 API РУДН

```
GET  http://www.rudn.ru/rasp/lessons/view
POST http://www.rudn.ru/rasp/lessons/view  (Body: facultet/level/kurs/forma/group/week)
```

### 7.2 OpenWeatherMap

```
GET https://api.openweathermap.org/data/2.5/weather?lat=55.7558&lon=37.6173&appid={KEY}&units=metric&lang=ru
```

### 7.3 Telegram Bot API

```python
bot.send_message(chat_id, text, parse_mode='HTML', reply_markup=...)
bot.get_me() / get_user_profile_photos(user_id)
# Через safe_send_telegram (services/delivery.py) — anti-spam + retry + DLQ
```

### 7.4 VK Music + VK ID OAuth

```python
# vkpymusic
service = MusicService(token)
service.search(query) / get_audio(user_id) / get_popular() / get_playlists(user_id)

# OAuth (Stage 1-3 instrProfileAuth)
GET /authorize?client_id={VK_APP_ID}&redirect_uri={VK_REDIRECT_URI}&response_type=code&scope=email
POST /access_token?client_id=...&client_secret={VK_CLIENT_SECRET}&code=...
GET /method/users.get?access_token=...
```

### 7.5 SMTP (Stage 9)

```python
# aiosmtplib
async with aiosmtplib.SMTP(SMTP_HOST, SMTP_PORT, use_tls=SMTP_USE_TLS) as smtp:
    await smtp.login(SMTP_USER, SMTP_PASSWORD)
    await smtp.send_message(message)
```

> При отсутствии SMTP_HOST — DEV-режим (логи в `/app/logs/emails.log`).

---

## 8. Workflow и сценарии

### 8.1 Первый запуск (новый пользователь, Telegram)

```
1. /start в @rudn_mosbot
2. Bot создает user_settings (без группы) → migrate_users() создаёт user
3. Кнопка "Открыть расписание" → Telegram WebApp
4. Auto-login через POST /api/auth/login/telegram-webapp (initData)
5. WelcomeScreen → GroupSelector (4 шага: факультет → уровень/курс → форма → группа)
6. POST /api/user-settings → сохранение
7. Достижение "Первопроходец" + XP grant
8. Главный экран
```

### 8.2 Email-регистрация (standalone)

```
1. /register → RegisterWizard
2. Выбор провайдера → email
3. EmailRegisterForm: email + password (двойной ввод) + username
4. POST /api/auth/register/email → создание users + user_settings + JWT
5. Step 2: имя/фамилия → PATCH /api/auth/profile-step
6. Step 3: группа/факультет → PATCH /api/auth/profile-step
7. Email verification: POST /api/auth/email/send-verification → ссылка на email
8. Переход на главный экран (AuthGate пропускает, т.к. JWT есть)
```

### 8.3 Password Reset flow (Stage 9)

```
1. /forgot-password → POST /api/auth/password/forgot {email}
2. Backend: всегда 200 (privacy-aware), создаёт SHA-256 hashed token (TTL 1 час)
3. Email с ссылкой /reset-password?token=...
4. /reset-password → POST /api/auth/password/reset {token, new_password}
5. Backend: проверка token + bcrypt new_password + auto-login (_issue_token) + revoke других сессий + email-notification
6. Frontend: setToken(jwt) → /
```

### 8.4 QR Cross-Device login

```
Device 1 (desktop, без авторизации):
1. /login → POST /api/auth/login/qr/init → {qr_token, qr_url}
2. Показ QR + polling GET /api/auth/login/qr/{qr_token}/status

Device 2 (mobile, авторизован):
3. Сканирование QR → /auth/qr/confirm?token=...
4. Подтверждение → POST /api/auth/login/qr/{qr_token}/confirm (с Bearer)

Device 1:
5. Polling видит "confirmed" → получает JWT → setToken → /
```

### 8.5 Web Sessions (старые QR для устройств)

```
1. POST /api/web-sessions → session_token + qr_url
2. QR + polling GET /api/web-sessions/{token}/status
3. Mobile: scanned → POST /api/web-sessions/{token}/scanned
4. Mobile: link → POST /api/web-sessions/{token}/link
5. status: "linked" → авторизован
```

### 8.6 Listening Room

```
1. POST /api/music/rooms → {id, invite_code}
2. Поделиться invite_code → друг POST /api/music/rooms/join/{code}
3. POST /api/music/rooms/{id}/sync (от owner)
4. Polling GET /api/music/rooms/{id}/state (для участников) → синхронизация
```

### 8.7 Streak

```
1. Каждый вход → POST /api/users/{telegram_id}/visit
2. Backend: подсчёт серии (current/max), update last_visit_date
3. Если streak % 7 == 0 и !claimed_today → frontend показывает StreakRewardModal
4. POST /api/users/{telegram_id}/streak-claim → bonus XP/items
```

---

## 9. Deployment

### 9.1 Supervisor конфигурация

```ini
[program:backend]
command=/root/.venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --workers 1 --reload
directory=/app/backend
environment=APP_URL="...",INTEGRATION_PROXY_URL="..."
autostart=true autorestart=true

[program:frontend]
command=yarn start          # → vite --mode test --host 0.0.0.0 --port 3000
environment=HOST="0.0.0.0",PORT="3000"
directory=/app/frontend
autostart=true autorestart=true

[program:mongodb]
command=/usr/bin/mongod --bind_ip_all
autostart=true autorestart=true
```

### 9.2 Порты и URL

- **Backend:** 8001 (internal) → ingress: `/api/*` → backend:8001
- **Frontend:** 3000 (internal) → ingress: остальное → frontend:3000
- **MongoDB:** 27017 (local)

### 9.3 Команды управления

```bash
sudo supervisorctl status
sudo supervisorctl restart all|backend|frontend
tail -f /var/log/supervisor/{backend,frontend}.*.log
tail -50 /var/log/supervisor/backend.err.log
tail -f /app/logs/emails.log         # DEV SMTP
```

### 9.4 Production

См. [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) и [`UPDATE_SERVER_STEPS.md`](./UPDATE_SERVER_STEPS.md).

---

## 10. VK Music интеграция

### 10.1 Компоненты

- `vk_auth_service.py` — VK login/password + OAuth
- `music_service.py` — VK Music API (поиск, плейлисты, стрим)
- `cover_service.py` — обложки треков (iTunes / Last.fm fallback)

### 10.2 API endpoints (35) — выборка

```
# Поиск / стрим
GET    /api/music/search?q={query}
GET    /api/music/stream/{track_id}
GET    /api/music/redirect/{track_id}
GET    /api/music/similar/{track_id}

# Библиотека / плейлисты
GET    /api/music/my, /api/music/my-vk/{telegram_id}
GET    /api/music/popular
GET    /api/music/playlists, /playlist/{owner_id}/{playlist_id}

# Артисты
GET    /api/music/artist/{artist_name}

# Избранное / История
GET/POST/DELETE /api/music/favorites/{telegram_id}/...
GET/POST /api/music/history/{telegram_id}

# Авторизация
POST   /api/music/auth/{telegram_id}                   # логин/пароль
GET    /api/music/auth/status/{telegram_id}
GET    /api/music/auth/config                          # OAuth конфиг
GET    /api/music/vk-callback                          # OAuth redirect
DELETE /api/music/auth/{telegram_id}

# Listening Rooms
POST   /api/music/rooms, /rooms/{room_id}/{leave|state|sync}
GET    /api/music/rooms/preview/{invite_code}
GET    /api/music/rooms/{room_id}/{queue|history}
POST   /api/music/rooms/{room_id}/queue/add
```

---

## 11. Система друзей

### 11.1 Функциональность

- Запросы / принятие / отклонение / отмена / удаление
- Блокировки + просмотр заблокированных
- Поиск (по username/имени)
- Mutual friends, favorites
- QR-коды для добавления (через `/u/{uid}/qr`)
- Просмотр расписания друзей (с privacy)
- Real-time события (polling через `useFriendEvents` hook + `/api/friends/events/{telegram_id}`)

### 11.2 15 endpoints

```
POST   /api/friends/request/{target_telegram_id}
POST   /api/friends/accept/{request_id}
POST   /api/friends/reject/{request_id}
POST   /api/friends/cancel/{request_id}
DELETE /api/friends/{friend_telegram_id}
POST   /api/friends/block/{target_telegram_id}
DELETE /api/friends/block/{target_telegram_id}
POST   /api/friends/{friend_telegram_id}/favorite
GET    /api/friends/search?q={query}
GET    /api/friends/{telegram_id}                       # FriendsListResponse
GET    /api/friends/{telegram_id}/requests              # FriendRequestsResponse
GET    /api/friends/mutual/{telegram_id}/{other_telegram_id}
GET    /api/friends/{telegram_id}/blocked
GET    /api/friends/events/{telegram_id}
POST   /api/friends/process-invite                      # из QR / share-link
```

---

## 12. In-App уведомления

### 12.1 Типы

- `friend_request` / `friend_accepted`
- `room_invite` / `task_assigned` / `task_completed`
- `achievement` / `level_up` / `streak_reward`
- `message` (новое сообщение в чате)
- `system` (объявления, рассылки из админки)
- `journal_invite` / `shared_schedule_invite`

### 12.2 11 endpoints

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
POST   /api/notifications/test
POST   /api/notifications/test-inapp
```

---

## 13. Web Sessions (QR-авторизация устройств)

### 13.1 Статусы

`pending` → `scanned` → `linked` (или `expired` / `revoked`)

### 13.2 9 endpoints

```
POST   /api/web-sessions
GET    /api/web-sessions/{token}/status
POST   /api/web-sessions/{token}/link, /scanned, /rejected
POST   /api/web-sessions/{token}/notify-revoked
POST   /api/web-sessions/{token}/heartbeat
DELETE /api/web-sessions/{token}
GET    /api/web-sessions/user/{id}/devices
DELETE /api/web-sessions/user/{id}/all
```

### 13.3 Frontend

- `DevicesModal.jsx` — для legacy web_sessions (telegram_id-based)
- `SessionsModal.jsx` — 🆕 для Stage 9 `auth_sessions` (jti-based)

---

## 14. Privacy Settings

### 14.1 Поля

```python
{
  "show_online_status": bool,
  "show_in_search": bool,
  "show_friends_list": bool,
  "show_achievements": bool,
  "show_schedule": bool
}
```

### 14.2 Endpoints

- Legacy (`/profile/{telegram_id}/privacy`): GET / PUT
- Public profile (`/u/{uid}/privacy`): GET / PUT (только владелец)

### 14.3 Frontend

- `PrivacySettingsModal.jsx`

---

## 15. Система сообщений

### 15.1 Типы

`text` | `music` | `schedule` | `forward`

### 15.2 18 endpoints

```
# Диалоги
POST   /api/messages/conversations
GET    /api/messages/conversations/{telegram_id}

# Сообщения
POST   /api/messages/send / send-music / send-schedule / forward
GET    /api/messages/{conversation_id}/messages
DELETE /api/messages/{message_id}

# Редактирование
PUT    /api/messages/{message_id}/edit
PUT    /api/messages/{message_id}/pin
PUT    /api/messages/{conversation_id}/read

# Реакции и типинг
POST   /api/messages/{message_id}/reactions
POST/GET /api/messages/{conversation_id}/typing

# Поиск и пины
GET    /api/messages/{conversation_id}/search
GET    /api/messages/{conversation_id}/pinned

# Непрочитанные
GET    /api/messages/unread/{telegram_id}

# Создание задач из сообщений
POST   /api/messages/create-task
```

### 15.3 Frontend

- `ChatModal.jsx` (1,800+ LOC)
- `ConversationsListModal.jsx`
- `SendTrackToFriendModal.jsx` (в Music)
- `messagesAPI.js`

---

## 16. Совместное расписание

### 16.1 8 endpoints

```
POST   /api/shared-schedule
GET    /api/shared-schedule/{telegram_id}
POST   /api/shared-schedule/{id}/add-participant, /add-my-schedule
DELETE /api/shared-schedule/{id}/remove-participant/{pid}
DELETE /api/shared-schedule/{id}
POST   /api/shared-schedule/{id}/share-token
GET    /api/shared-schedule/token/{token}
```

### 16.2 Frontend

- `ShareScheduleModal.jsx` (~700 LOC)
- `SharedScheduleView.jsx` (2,000+ LOC) — наложение расписаний с цветовой кодировкой

---

## 17. Streak-система

### 17.1 Endpoints

```
POST /api/users/{telegram_id}/visit         # фиксирует визит
POST /api/users/{telegram_id}/streak-claim  # награда за 7-дневный streak
```

### 17.2 UserStats поля

```python
{
  "visit_streak_current": int,
  "visit_streak_max": int,
  "streak_claimed_today": bool,
  "last_visit_date": datetime
}
```

### 17.3 Frontend

- `StreakRewardModal.jsx` (~850 LOC) — анимация + получение награды

---

## 18. Расширенная админ-панель

### 18.1 33 endpoints

```
# Статистика
GET  /api/admin/stats, /users, /users-activity, /hourly-activity, /weekly-activity,
     /feature-usage, /top-users, /faculty-stats, /course-stats

# Мониторинг
GET  /api/admin/online-users, /server-stats, /server-stats-history,
     /online-stats-history, /channel-stats, /channel-stats-history
POST /api/admin/track-activity

# Журналы
GET  /api/admin/journals

# Реферальные ссылки
GET/POST/PUT/DELETE /api/admin/referral-links[/{id}]
GET  /api/admin/referral-stats, /referral-links/analytics
POST /api/admin/referral-track

# Уведомления / рассылки
POST /api/admin/send-notification
POST /api/admin/notifications/parse-telegram         # парсинг поста по ссылке
POST /api/admin/notifications/send-from-post         # массовая рассылка из распарсенного поста

# Модальные изображения
POST/GET/DELETE /api/admin/modal-images[/{id}]

# Delivery (services/delivery.py)
GET  /api/admin/delivery/stats
```

### 18.2 Frontend

- `AdminPanel.jsx` (4,400+ LOC)

---

## 19. 3D-логотип (singleton)

### 19.1 Архитектура (Stage 10)

**Проблема:** При переходах между `/login` ↔ `/register` ↔ `/forgot-password` 3D-логотип перемонтировался → 500-3000ms лаг.

**Решение:** Singleton через React Portal — один Canvas на body, плавно перелетает.

```
Logo3DProvider (контекст: Map<anchorId, anchorRef>)
  ↓
Logo3DHost (Portal на document.body)
  - Один <Canvas> с <Logo3D />
  - position: fixed; transition: 0.3s ease
  - useEffect зависит от activeAnchorId+anchorRef → пересчитывает rect
  ↓
Logo3DAnchor (placeholder в каждой странице)
  - <div ref={anchorRef} style={{ width, height }} />
  - useEffect: ctxRef.current.registerAnchor(anchorId, ref)
```

### 19.2 Bug fixes (2026-04-24)

- Дефолтный `lightPosition = [-0.5, 2, 4]` создавал новый массив на каждом рендере → `propsObject` useMemo инвалидировался → бесконечный `updateAnchorProps` цикл. **Fix:** вынесен в константу.
- `useEffect` в `Logo3DAnchor` зависел от целого `ctx`-объекта (пересоздаётся при каждом setAnchors). **Fix:** `ctxRef`.
- `setRect` в RAF-цикле создавал новый объект каждый кадр без сравнения. **Fix:** epsilon-сравнение (0.5px).
- `useEffect` `Logo3DHost` зависел от `activeAnchor` целиком. **Fix:** `anchorId`+`anchorRef`.

### 19.3 Файлы

```
/components/
├── Logo3D.jsx               # 3D-меш (three.js + drei)
├── Logo3DAnchor.jsx         # placeholder в каждой странице
└── Logo3DHost.jsx           # Portal + один Canvas
/contexts/Logo3DContext.jsx
/utils/logoPreload.js        # prefetch SVG
```

---

## 20. MongoDB коллекции (57)

### 20.1 Сводка

```
db.users                      # 🔐 Identity (Stage 9)
db.user_settings              # legacy primary (telegram_id)
db.auth_sessions              # 🆕 JWT jti + TTL
db.auth_tokens                # 🆕 SHA-256 (password_reset, email_verify) + TTL
db.auth_events                # 🆕 audit-log
db.auth_qr_sessions           # QR cross-device
db.qr_login_sessions          # ↑ alias (legacy)
db.web_sessions               # legacy QR авторизация устройств
db.profile_views              # TTL 7 дней (для дедупликации)

db.user_stats                 # streak + active_minutes
db.user_achievements
db.user_vk_tokens             # VK для музыки
db.user_blocks
db.blocked_users              # ↑ alias
db.xp_events                  # 🆕 события начисления XP

db.tasks                      # личные задачи
db.group_tasks
db.group_task_comments
db.group_task_invites

db.rooms                      # участники embedded
db.room_activities
db.listening_rooms            # VK Music совместное прослушивание

db.journals
db.attendance_journals        # ↑ alias
db.journal_students
db.journal_subjects
db.journal_sessions
db.attendance_records
db.journal_pending_members
db.journal_applications

db.friends
db.friendships                # 🆕 нормализованная схема
db.friend_requests

db.conversations
db.messages

db.scheduled_notifications    # V2
db.notification_history
db.sent_notifications
db.in_app_notifications

db.referral_connections
db.referral_events
db.admin_referral_links
db.referral_link_events
db.referral_rewards

db.shared_schedules
db.schedule_share_tokens

db.schedule_cache
db.cover_cache
db.music_favorites
db.music_history
db.modal_images               # для админских модалов

db.status_checks
db.lk_connections
db.channel_stats_history
db.online_stats_history
db.server_metrics_history

db.command                    # служебные команды
db.delivery_attempts          # 🆕 retry/DLQ Telegram-нотификаций
```

### 20.2 TTL-индексы

| Коллекция | Поле | TTL |
|-----------|------|-----|
| `auth_sessions` | `expires_at` | 30 дней (по JWT) |
| `auth_tokens` | `expires_at` | 1 час (reset) / 24 часа (verify) |
| `auth_qr_sessions` | `expires_at` | 5 минут |
| `qr_login_sessions` | `expires_at` | 5 минут |
| `profile_views` | `created_at` | 7 дней |
| `web_sessions` | `expires_at` | переменное |

### 20.3 Unique индексы (Stage 9)

```javascript
db.users.createIndex({"username": 1}, {unique: true, partialFilterExpression: {username: {$exists: true}}})
db.users.createIndex({"email": 1}, {unique: true, partialFilterExpression: {email: {$exists: true}}})
db.users.createIndex({"uid": 1}, {unique: true})
db.user_settings.createIndex({"telegram_id": 1}, {unique: true})
db.user_settings.createIndex({"referral_code": 1}, {unique: true, sparse: true})
db.auth_sessions.createIndex({"jti": 1}, {unique: true})
```

---

## 21. Ключевые зависимости

### Backend (`requirements.txt`)

```
# Core
fastapi==0.110.1
uvicorn==0.25.0
pymongo==4.5.0
motor==3.3.1
pydantic>=2.6.4
python-multipart>=0.0.9
python-dotenv>=1.0.1

# HTTP
requests>=2.31.0
aiohttp>=3.9.0
httpx>=0.24.0
aiofiles
multidict>=6.0.0
attrs>=25.4.0
aiohappyeyeballs>=2.5.0
aiosignal>=1.4.0
frozenlist>=1.1.1
propcache>=0.2.0
yarl>=1.17.0

# Parsing
beautifulsoup4>=4.12.0
lxml>=4.9.0
soupsieve>=2.0.0

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

# Security & Auth (Stage 9)
cryptography>=42.0.8
pyjwt>=2.10.1
passlib>=1.7.4
bcrypt>=4.0.1
python-jose>=3.3.0
email-validator>=2.2.0
aiosmtplib>=3.0.0          # 🆕 SMTP для password-reset / email-verify

# OAuth
requests-oauthlib>=2.0.0

# Cloud (опц.)
boto3>=1.34.129

# Data
pandas>=2.2.0
numpy>=1.26.0

# System
psutil
pytz, tzdata>=2024.2, tzlocal>=5.0.0

# Dev
pytest>=8.0.0
black>=24.1.1, isort>=5.13.2, flake8>=7.0.0, mypy>=1.8.0
playwright, pyee, greenlet
typer>=0.9.0, jq>=1.6.0
```

### Frontend (`package.json`)

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
    "lucide-react": "^1.7.0",
    "recharts": "^3.4.1",
    "canvas-confetti": "^1.9.4",
    "qrcode.react": "^4.2.0",
    "html-to-image": "^1.11.13",
    "jwt-decode": "^4.0.0",
    "three": "^0.183.2",
    "@react-three/fiber": "^9.5.0",
    "@react-three/drei": "^10.7.7",
    "3dsvg": "^0.2.1",
    "serve": "^14.2.5",
    "signal-exit": "^4.1.0"
  },
  "devDependencies": {
    "vite": "^7.2.2",
    "@vitejs/plugin-react": "^5.1.1",
    "tailwindcss": "^3.4.17",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "eslint": "9.23.0",
    "@eslint/js": "9.23.0",
    "eslint-plugin-import": "2.31.0",
    "eslint-plugin-jsx-a11y": "6.10.2",
    "eslint-plugin-react": "7.37.4",
    "globals": "15.15.0"
  },
  "packageManager": "yarn@1.22.22"
}
```

> **Важно для агента:** при `yarn install` падает с ошибкой engines (`camera-controls@3.1.2 requires node ≥22`). В контейнере Node 20 → используй `yarn install --ignore-engines`.

---

## 22. Известные нюансы / гайды агенту

1. **Не использовать `npm`** — yarn-only, есть `yarn.lock`.
2. **Все backend routes** должны быть префиксированы `/api/` (Kubernetes ingress).
3. **MongoDB ObjectID не сериализуется в JSON** — используй UUID, для identity — 9-значный numeric `uid`.
4. **JWT в localStorage** через `authStorage.js`. Axios interceptor (см. `AuthContext.jsx`) автоматически добавляет `Authorization: Bearer` и при 401 → logout.
5. **`isSameUser(a, b)` из `utils/userIdentity.js`** — единственно правильный способ сравнения юзеров (поддерживает и `uid`, и `tid`). Никогда не используй `===`.
6. **`safe_send_telegram` из `services/delivery.py`** — единственная точка отправки Telegram-нотификаций (anti-spam + retry + DLQ).
7. **При первом старте** выполняется `migrate_user_settings_to_users()` — миграция старых записей.
8. **JWT_SECRET_KEY** — auto-gen при первом старте, можно задать вручную через ENV.
9. **SMTP не настроен → DEV-режим** (логи в `/app/logs/emails.log`). Для production нужны SMTP credentials.
10. **Frontend Hot Reload** — Vite автоматически перезагружает при изменении файлов в `src/`.
11. **3D-логотип** — singleton через Portal. НИКОГДА не оборачивай `<Canvas>` напрямую в pages, используй `<Logo3DAnchor anchorId="login" />`.

---

## 23. Текущее состояние / Roadmap

### ✅ Выполнено (актуально на 2026-05-06)

- **Stage 1-3** мульти-авторизации (Email + Telegram + VK + QR)
- **Stage 4** публичного профиля (`/u/{uid}/*` 13 endpoints + PublicProfilePage)
- **Stage 9** Auth/Profile hardening:
  - Password Management (forgot/reset/change + email-notifications)
  - Email Verification (SHA-256 hashed tokens + rate-limit)
  - Sessions/Devices с JWT `jti` + revoke
  - Lowercase username, unique индексы, rate-limit hardening
  - Session-revocation enforcement в `get_current_user_required`
  - Referral integration во всех register/login endpoints
- **Stage 10** UID singleton + 3D-логотип (Portal-based, 0 ошибок)

### 🟡 Pending

- **UID Phase P3** — `resolve_user(db, identifier)` helper, 11 новых `/api/u/{uid}/*` (settings, tasks, notifications), JWT с `uid`+`tid`
- **UID Phase P4** — `backfill_uid_to_collections.py` для 38 коллекций, `uid` в 93 моделях, индексы по `uid`
- **SMTP credentials** (P0) — нужны от пользователя для production
- **RegisterWizard UX polish** — per-step validation, лучше feedback
- **Frontend E2E testing** — через testing agent
- **Auth_routes split** (P2) — `routes/{email_auth,oauth,sessions,password}.py`

---

**Конец полной технической документации.**

**Метод обновления:** real-time аудит (grep, wc, fd) + актуализация при значимых изменениях кода.  
**Источник истины:** код в `/app/backend` и `/app/frontend/src`. При расхождениях — приоритет у кода.
