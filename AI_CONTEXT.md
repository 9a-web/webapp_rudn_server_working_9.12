# AI CONTEXT — RUDN Schedule (Telegram Web App + Standalone SPA)

**Обновлено:** 2026-05-06 (real-time аудит кода) | **Статус:** ✅ АКТУАЛЬНО

> **Этот файл — TL;DR для ИИ-агента.** Прочитайте его ПОЛНОСТЬЮ перед любой задачей.
> Полная техническая документация — в [`PROJECT_DETAILS.md`](./PROJECT_DETAILS.md).
> Запуск/команды — в [`README.md`](./README.md).

---

## 🎯 МЕТА-ИНФОРМАЦИЯ

**Что это:** Telegram Web App + standalone SPA для студентов и преподавателей РУДН.
**Стек:** FastAPI 0.110 (Python 3.10+) · React 19 · MongoDB · Telegram Bot API · JWT (HS256) · Vite 7 · TailwindCSS 3.4

**Основные функциональные блоки:**
- 📅 Расписание пар (live-карусель, парсинг API РУДН + кэш)
- ✅ Задачи: личные + групповые (в комнатах/чатах) + подзадачи + теги + приоритеты + дедлайны
- 🎯 Планировщик событий (timeline-визуализация, синк с расписанием)
- 📓 Журнал посещений (для преподавателей: студенты, предметы, занятия, заявки)
- 🎵 VK Music (логин/OAuth, поиск, стрим, плейлисты, история, обложки, listening-rooms)
- 👥 Друзья (запросы, блокировки, поиск, QR, избранные, real-time события)
- 💬 Сообщения (text/music/schedule/forward, реакции, типинг, закрепление, поиск, пины)
- 📤 Совместное расписание (наложение расписаний, share-link)
- 🏆 Достижения (24 ачивки + 🎖 уровни/XP)
- 🔥 Streak ежедневных визитов + награды
- 🔔 Уведомления V2 (±10 сек точность)
- 🎓 Личный кабинет РУДН (LK parser + AES-encrypted credentials)
- 🔗 Реферальная система (3 уровня + админ-ссылки)
- 📱 Web Sessions (QR cross-device authentication)
- 🔒 Privacy-настройки профиля
- 🖥 Desktop Sidebar (адаптивная вёрстка)
- 🛡 Расширенная админ-панель (33 endpoint'а: статистика, мониторинг, рассылки, рефералы, модальные изображения)
- 🔐 **Мульти-авторизация:** Email + Telegram Login Widget + Telegram WebApp + VK ID OAuth + QR Cross-Device
- 🔐 **Password Management:** forgot/reset/change через SMTP (`aiosmtplib`) + DEV-fallback `/app/logs/emails.log`
- 🔐 **Email Verification:** SHA-256 hashed tokens + rate-limit
- 🔐 **Sessions/Devices:** JWT с `jti` + `auth_sessions` + revoke (one/all) + UA parsing
- 🔗 **Публичный профиль `/u/{uid}/*`:** 13 endpoints (resolve, профиль, schedule, qr, share-link, privacy, view, avatar, graffiti, wall-graffiti, friends, achievements)
- 🎨 **3D-логотип-singleton** (`Logo3DProvider` + `Logo3DHost` + `Logo3DAnchor` через React Portal — один Canvas на body, плавно перелетает между страницами)
- 🎨 **Profile customization:** custom avatar (`photo_url_custom`), graffiti на стене

---

## 📊 СТАТИСТИКА ПРОЕКТА (2026-05-06)

| Метрика | Значение |
|---------|----------|
| Backend Python модулей | **30** (включая тестовые скрипты) |
| Ключевые модули LOC | **~30,500** (server + models + auth_routes + auth_utils + scheduler_v2 + achievements + tg_bot + level_system + email_service) |
| `server.py` LOC | **20,789** |
| `models.py` LOC / классов | **3,035 / 259** |
| `auth_routes.py` LOC / endpoints | **2,537 / 28** |
| `auth_utils.py` LOC | **817** |
| API endpoints (всего) | **339** (311 в `server.py` + 28 в `auth_routes.py`) |
| MongoDB коллекций | **57** |
| Frontend компонентов | **134** (91 top-level + 12 auth + 17 journal + 13 music + 1 icons) |
| Frontend SPA-страниц | **9** |
| Services (API клиенты) | **12** |
| Contexts | **4** (Auth, Telegram, Theme, Logo3D) + PlayerContext (внутри `components/music`) |
| Utils | **14** | Hooks | **5** | Constants | **3** |
| `App.jsx` LOC | **2,734** |
| Языков (i18n) | 2 (RU/EN) |
| Достижений | 24 |

---

## 📁 СТРУКТУРА ПРОЕКТА

```
/app/
├── backend/                       # FastAPI backend
│   ├── server.py                  # Главный сервер (20,789 LOC, 311 endpoints)
│   ├── models.py                  # Pydantic схемы (3,035 LOC, 259 классов)
│   ├── auth_routes.py             # /api/auth/* (2,537 LOC, 28 endpoints)
│   ├── auth_utils.py              # JWT/bcrypt/sessions/rate-limit (817 LOC)
│   ├── email_service.py           # SMTP (aiosmtplib) + DEV → /app/logs/emails.log (278)
│   ├── level_system.py            # Уровни/XP, события (775)
│   ├── migrate_users.py           # Миграция user_settings → users (107)
│   ├── telegram_bot.py            # Telegram Bot (1,458)
│   ├── scheduler_v2.py            # Уведомления V2 (1,051)
│   ├── achievements.py            # 24 достижения (847)
│   ├── cover_service.py           # Обложки треков (502)
│   ├── lk_parser.py               # ЛК РУДН парсер
│   ├── music_service.py           # VK Music сервис
│   ├── vk_auth_service.py         # VK OAuth + audio token
│   ├── rudn_parser.py             # API РУДН парсер
│   ├── notifications.py           # Telegram нотификации
│   ├── weather.py                 # OpenWeatherMap
│   ├── config.py                  # ENV конфигурация
│   ├── cache.py                   # Кэш-функции
│   ├── scalability_check.py       # Диагностика
│   ├── seed_test_public_profile.py
│   ├── services/
│   │   ├── delivery.py            # MessagePriority, send_batch, retry/DLQ
│   │   └── __init__.py
│   ├── static/                    # Загруженные изображения
│   ├── tests/                     # Backend тесты
│   └── requirements.txt
│
├── frontend/                      # React 19 + Vite 7
│   ├── src/
│   │   ├── App.jsx                # 2,734 LOC, маршруты + основная логика
│   │   ├── index.jsx              # ReactDOM root
│   │   ├── pages/                 # 9 SPA-страниц
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterWizard.jsx     # Многошаговая регистрация
│   │   │   ├── ForgotPasswordPage.jsx     # 🆕
│   │   │   ├── ResetPasswordPage.jsx      # 🆕
│   │   │   ├── VerifyEmailPage.jsx        # 🆕
│   │   │   ├── VKCallbackPage.jsx
│   │   │   ├── QRConfirmPage.jsx
│   │   │   ├── PublicProfilePage.jsx      # /u/:uid (вне AuthGate)
│   │   │   └── Test3DLogoPage.jsx         # 🆕 для отладки 3D-логотипа
│   │   ├── components/
│   │   │   ├── auth/              # 12 компонентов
│   │   │   │   ├── AuthGate.jsx           # защита маршрутов
│   │   │   │   ├── AuthLayout.jsx
│   │   │   │   ├── AuthButton.jsx, AuthInput.jsx
│   │   │   │   ├── EmailLoginForm.jsx, EmailRegisterForm.jsx
│   │   │   │   ├── UsernameField.jsx      # с check-username
│   │   │   │   ├── TelegramLoginWidget.jsx
│   │   │   │   ├── TelegramWebAppLoginButton.jsx, TelegramWebAppConfirm.jsx
│   │   │   │   ├── VkLoginButton.jsx
│   │   │   │   └── QRLoginBlock.jsx       # QR + polling
│   │   │   ├── journal/           # 17 компонентов журнала посещений
│   │   │   ├── music/             # 13 компонентов VK Music + PlayerContext
│   │   │   ├── icons/             # VkLogoIcon
│   │   │   └── *.jsx              # 91 top-level (см. PROJECT_DETAILS.md)
│   │   ├── services/              # 12 API-клиентов
│   │   │   ├── api.js             # Основной + axios interceptor
│   │   │   ├── authAPI.js         # /api/auth/*
│   │   │   ├── friendsAPI.js, groupTasksAPI.js, journalAPI.js
│   │   │   ├── listeningRoomAPI.js, messagesAPI.js, musicAPI.js
│   │   │   ├── notificationsAPI.js, referralAPI.js, roomsAPI.js
│   │   │   └── webSessionAPI.js
│   │   ├── contexts/              # 4 контекста
│   │   │   ├── AuthContext.jsx    # token, user, login, logout, refreshMe
│   │   │   ├── TelegramContext.jsx
│   │   │   ├── ThemeContext.jsx
│   │   │   └── Logo3DContext.jsx  # 🆕 singleton 3D-логотипа
│   │   ├── utils/                 # 14 утилит
│   │   │   ├── authStorage.js     # localStorage wrapper
│   │   │   ├── safeRedirect.js    # 🆕 безопасные redirects
│   │   │   ├── userIdentity.js    # 🆕 isSameUser() (поддержка uid+tid)
│   │   │   ├── logoPreload.js     # 🆕 prefetch SVG для 3D-логотипа
│   │   │   ├── analytics, animations, botInfo, config, confetti
│   │   │   ├── dateUtils, gestures, pluralize, scheduleUtils, textUtils
│   │   │   └── __tests__/         # unit-тесты utils
│   │   ├── hooks/                 # 5 hooks
│   │   │   ├── useFaviconBadge.js, useFriendEvents.js, useRipple.js
│   │   │   ├── useIsAdmin.js          # 🆕
│   │   │   └── useIsInsideTelegram.js # 🆕
│   │   ├── constants/             # levelConstants, publicBase, roomColors
│   │   ├── i18n/locales/          # ru.json, en.json
│   │   └── fonts/                 # GG Zaglav.woff2
│   ├── public/                    # static assets
│   ├── plugins/                   # Vite plugins
│   ├── package.json               # yarn-only
│   └── vite.config.js
│
├── memory/
│   ├── PRD.md                     # Текущий план развития (Stage 9-10)
│   ├── test_credentials.md
│   └── 3dsvg_fix_notes.md
│
├── scripts/                       # Утилиты (mongodb_watchdog, simplify_svg, ...)
├── tests/                         # /app-уровень тесты
├── api_backups/, backups/, test_reports/
│
├── AI_CONTEXT.md                  # ⭐ ЭТО ФАЙЛ — TL;DR для ИИ
├── PROJECT_DETAILS.md             # Полная тех. документация (cross-reference)
├── README.md                      # Запуск, команды, структура
├── DEPLOYMENT_GUIDE.md            # Production deployment
└── *.md                           # Доп. документация (см. список ниже)
```

---

## 🔌 API ENDPOINTS (339 всего)

### Сводка по модулям

| Модуль | Endpoints | Файл | Описание |
|--------|-----------|------|----------|
| Журнал посещений | **36** | server.py | Журналы, студенты, предметы, занятия, заявки, ссылки на студентов |
| VK Music | **35** | server.py | Поиск, стрим, плейлисты, listening-rooms, OAuth, история |
| Админ-панель | **33** | server.py | Статистика, мониторинг, рефералы, модальные изображения, рассылки |
| 🔐 Auth (`/api/auth/*`) | **28** | auth_routes.py | Email/TG/VK/QR + me + sessions + password + email verification |
| Групповые задачи | **18** | server.py | CRUD + подзадачи + комментарии + приглашения |
| 💬 Сообщения | **18** | server.py | Чаты, реакции, типинг, пересылка, поиск |
| Профиль (legacy) | **18** | server.py | `/profile/{telegram_id}/*` (обратная совместимость) |
| Комнаты | **17** | server.py | CRUD + участники + активность + роли |
| Друзья | **15** | server.py | Запросы, блокировки, поиск, события, mutual, favorites |
| 🆕 Публичный профиль (`/api/u/{uid}/*`) | **13** | server.py | Resolve, профиль, schedule, qr, share-link, privacy, view, avatar, graffiti, wall-graffiti, friends, achievements |
| Уведомления | **11** | server.py | CRUD + настройки + тестирование |
| Web Sessions | **9** | server.py | QR-авторизация cross-device |
| Пользователи | **9** | server.py | Settings, тема, история, streak |
| Tasks (личные) | **9** | server.py | CRUD + подзадачи + продуктивность |
| 📤 Совместное расписание | **8** | server.py | Шаринг, участники, токены |
| Реферальная система | **7** | server.py | Коды, статистика, дерево, веб-апп |
| Планировщик | **5** | server.py | Синхронизация, события, превью |
| Достижения | **5** | server.py | Список, трекинг, пометить просмотренными |
| Расписание РУДН | **4** | server.py | Факультеты, фильтры, расписание, кэш |
| ЛК РУДН | **4** | server.py | Подключение, отключение, данные, статус |
| Privacy (legacy) | **4** | server.py | Настройки приватности |
| Бэкапы | **3** | server.py | Экспорт БД |
| Dev/диагностика | **5** | server.py | `/dev/*` |
| Прочее (погода, граффити, статус) | **8** | server.py | |

### 🔐 Auth endpoints (28) — `auth_routes.py`

```
# Регистрация / Логин
POST   /api/auth/register/email                  # Email + bcrypt
POST   /api/auth/login/email                     # Email + пароль
POST   /api/auth/login/telegram                  # Telegram Login Widget (HMAC валидация)
POST   /api/auth/login/telegram-webapp           # Автологин из Telegram WebApp (initData)
POST   /api/auth/login/vk                        # VK ID OAuth (code → access_token → users.get)

# QR Cross-Device
POST   /api/auth/login/qr/init                   # Инициализация QR-сессии
GET    /api/auth/login/qr/{qr_token}/status      # Polling статуса
POST   /api/auth/login/qr/{qr_token}/confirm     # Подтверждение с авторизованного устройства

# Текущий пользователь
GET    /api/auth/me                              # JWT-required, возвращает UserPublic
GET    /api/auth/me/is_admin                     # Проверка admin-роли

# Linking (привязка/отвязка провайдеров)
POST   /api/auth/link/email
POST   /api/auth/link/telegram
POST   /api/auth/link/telegram-webapp
POST   /api/auth/link/vk
DELETE /api/auth/link/{provider}                 # email | telegram | vk

# Username & профиль
GET    /api/auth/check-username/{username}       # Доступность username
PATCH  /api/auth/profile-step                    # Шаги 2-3 регистрации (имя, group, etc.)

# 🆕 Password Management
POST   /api/auth/password/change                 # Смена пароля (auth-required)
POST   /api/auth/password/forgot                 # Запрос reset-токена (privacy-aware, всегда 200)
POST   /api/auth/password/reset                  # Сброс пароля по токену + auto-login

# 🆕 Email Verification
POST   /api/auth/email/send-verification         # Отправить токен верификации (5/hr/uid)
POST   /api/auth/email/verify                    # Подтвердить email по токену

# 🆕 Sessions / Devices
GET    /api/auth/sessions                        # Список активных сессий + is_current + device_label
DELETE /api/auth/sessions/{jti}                  # Отозвать конкретную сессию
POST   /api/auth/logout                          # Отзыв текущей сессии (jti)
POST   /api/auth/logout-all                      # ?keep_current=true|false

# Конфиг
GET    /api/auth/config                          # bot_username, VK app_id, public flags
```

### 🔗 Публичный профиль `/api/u/{uid}/*` (13)

```
GET   /api/u/{uid}/resolve         # UID → внутренние идентификаторы
GET   /api/u/{uid}                 # Публичный профиль (privacy-фильтры)
GET   /api/u/{uid}/schedule        # Расписание (для друзей + владельца)
GET   /api/u/{uid}/qr              # QR-данные
GET   /api/u/{uid}/share-link      # {PUBLIC_BASE_URL}/u/{uid}
GET   /api/u/{uid}/privacy         # (только владелец)
PUT   /api/u/{uid}/privacy
POST  /api/u/{uid}/view            # Регистрация просмотра (TTL 7 дней, profile_views)
GET   /api/u/{uid}/avatar          # 🆕 Аватар (custom + fallback)
GET   /api/u/{uid}/graffiti        # 🆕 Граффити пользователя
GET   /api/u/{uid}/wall-graffiti   # 🆕 Стена с граффити (видимость по privacy)
GET   /api/u/{uid}/friends         # 🆕 Список друзей (privacy-aware)
GET   /api/u/{uid}/achievements    # 🆕 Список достижений (privacy-aware)
```

### Прочие ключевые endpoint'ы (выборка)

```
# Расписание / пользователи
GET   /api/faculties
POST  /api/filter-data
POST  /api/schedule
GET   /api/user-settings/{telegram_id}
POST  /api/user-settings
POST  /api/users/{telegram_id}/visit            # Streak + last_activity

# Сообщения
POST  /api/messages/conversations
POST  /api/messages/send
POST  /api/messages/send-music
POST  /api/messages/send-schedule
POST  /api/messages/forward
POST  /api/messages/{id}/reactions
PUT   /api/messages/{id}/pin

# Совместное расписание
POST  /api/shared-schedule
POST  /api/shared-schedule/{id}/add-participant
POST  /api/shared-schedule/{id}/share-token
GET   /api/shared-schedule/token/{token}

# VK Music (35)
GET   /api/music/search?q=...
GET   /api/music/stream/{track_id}
POST  /api/music/auth/{telegram_id}
GET   /api/music/auth/config
GET   /api/music/vk-callback
POST  /api/music/rooms
POST  /api/music/rooms/join/{invite_code}

# Админка (выборка из 33)
GET   /api/admin/stats, /online-users, /server-stats, /channel-stats
POST  /api/admin/referral-links
POST  /api/admin/modal-images
POST  /api/admin/notifications/parse-telegram
POST  /api/admin/notifications/send-from-post
POST  /api/admin/delivery/stats                  # 🆕 (services/delivery.py)
```

---

## 🗄️ MONGODB КОЛЛЕКЦИИ (57)

### Identity & Auth (10) — РАСШИРЕНО Stage 9

| Коллекция | Назначение |
|-----------|------------|
| `users` | Центральный identity (uid, username, email+hash, telegram_id, vk_id, photo_url_custom, email_verified, primary_auth, auth_providers[]) |
| `user_settings` | Настройки + `referral_code` (auto-gen) + group/faculty + privacy_settings (legacy primary key: `telegram_id`) |
| `auth_sessions` | Активные JWT-сессии (uid, jti unique, expires_at TTL, revoked, device_label, ip, ua) |
| 🆕 `auth_tokens` | Хеши SHA-256 токенов (purpose: password_reset / email_verify, used, expires_at TTL) |
| 🆕 `auth_events` | Аудит-лог (event, uid, provider, success, ts, ip, ua, hashed-email) |
| `auth_qr_sessions` / `qr_login_sessions` | QR cross-device (TTL) |
| `web_sessions` | Старые web-сессии (QR-авторизация устройств) |
| `profile_views` | Лог просмотров публичного профиля (TTL 7 дней) |

### Пользователи и активность (6)

`user_stats` (статистика + streak), `user_achievements`, `user_vk_tokens` (VK для музыки), `user_blocks`, `blocked_users`, `xp_events` (level_system).

### Задачи (4)

`tasks`, `group_tasks`, `group_task_comments`, `group_task_invites`.

### Комнаты (3)

`rooms` (участники embedded), `room_activities`, `listening_rooms` (VK Music совместное прослушивание).

### Журнал посещений (8)

`journals` / `attendance_journals`, `journal_students`, `journal_subjects`, `journal_sessions`, `attendance_records`, `journal_pending_members`, `journal_applications`.

### Друзья (3)

`friends`, `friendships`, `friend_requests`.

### Сообщения (2)

`conversations`, `messages`.

### Уведомления (4)

`scheduled_notifications` (V2), `notification_history`, `sent_notifications`, `in_app_notifications`.

### Реферальная система (5)

`referral_connections`, `referral_events`, `admin_referral_links`, `referral_link_events`, `referral_rewards`.

### Совместное расписание (2)

`shared_schedules`, `schedule_share_tokens`.

### Кэш и медиа (5)

`schedule_cache`, `cover_cache`, `music_favorites`, `music_history`, `modal_images`.

### Мониторинг и аналитика (5)

`status_checks`, `lk_connections`, `channel_stats_history`, `online_stats_history`, `server_metrics_history`.

### Системные

`command` (служебные команды), `delivery_attempts` (retry/DLQ для Telegram-нотификаций).

> Полный список с TTL-индексами и схемами — в [`PROJECT_DETAILS.md`](./PROJECT_DETAILS.md).

---

## ⚡ БЫСТРЫЕ КОМАНДЫ

### Сервисы

```bash
sudo supervisorctl status
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
sudo supervisorctl restart all
```

### Логи

```bash
tail -f /var/log/supervisor/backend.*.log
tail -f /var/log/supervisor/frontend.*.log
tail -50 /var/log/supervisor/backend.err.log    # Ошибки
tail -f /app/logs/emails.log                    # DEV-режим SMTP (когда нет реального)
```

### Установка зависимостей

```bash
# Backend
cd /app/backend && pip install <pkg> && echo "<pkg>" >> requirements.txt

# Frontend (ТОЛЬКО yarn!)
cd /app/frontend && yarn add <pkg>
# Важно: при ошибках engines (camera-controls требует node>=22) → yarn install --ignore-engines
```

### Навигация

```bash
# Endpoints
grep -cE "@(api_router|app)\.(get|post|put|patch|delete)" /app/backend/server.py
grep -cE "@router\.(get|post|put|patch|delete)" /app/backend/auth_routes.py

# MongoDB коллекции (unique)
grep -hoE 'db\.[a-zA-Z_]+' /app/backend/server.py /app/backend/auth_routes.py | sort -u

# Pydantic модели
grep -c "^class " /app/backend/models.py

# Фронтенд компоненты / страницы
fd ".jsx$" /app/frontend/src/components -t f | wc -l
ls /app/frontend/src/pages/
ls /app/frontend/src/services/
ls /app/frontend/src/contexts/
```

---

## ⚠️ КРИТИЧЕСКИЕ ПРАВИЛА

### ❌ НИКОГДА:
1. **Не используй `npm`** — только `yarn` (yarn-only repo с lock-файлом).
2. **Не хардкодь URLs/ports** — только через `process.env.REACT_APP_BACKEND_URL` (frontend) и `os.environ.get('MONGO_URL')` (backend).
3. **Не используй MongoDB ObjectID** — только UUID (для identity — 9-значный numeric `uid`).
4. **Не забывай `/api/` префикс** для backend routes (Kubernetes ingress).
5. **Не изменяй `.env` файлы** без крайней необходимости.
6. **Не сравнивай напрямую `===` для пользователей** — используй `isSameUser(a, b)` из `utils/userIdentity.js` (поддержка `uid` + `tid`).

### ✅ ВСЕГДА:
1. Читай `AI_CONTEXT.md` (этот файл) перед началом задачи.
2. Проверяй логи после изменений (`tail -50 /var/log/supervisor/backend.err.log`).
3. Следуй существующим паттернам кода (Pydantic v2, async/await, `app.state.db`).
4. Тестируй в Telegram Web App **И** в standalone браузере (SPA на `/login`).
5. Обновляй `requirements.txt` / `package.json` при добавлении пакетов.
6. JWT — в `localStorage` через `authStorage.js` + axios `Authorization: Bearer` interceptor (см. `AuthContext.jsx`).
7. Все Telegram-нотификации — через `safe_send_telegram` (anti-spam, retry, DLQ через `services/delivery.py`).

---

## 🔧 ENVIRONMENT VARIABLES

### Backend `.env`

```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
CORS_ORIGINS="*"
ENV="test"                    # или "production"

# Telegram
TELEGRAM_BOT_TOKEN=...         # Продакшн бот
TEST_TELEGRAM_BOT_TOKEN=...    # Тестовый бот
TELEGRAM_BOT_USERNAME=...      # Для Telegram Login Widget

# Внешние API
WEATHER_API_KEY=...

# VK Music + OAuth
VK_MUSIC_TOKEN=..., VK_USER_ID=...
VK_APP_ID=..., VK_CLIENT_SECRET=..., VK_REDIRECT_URI=...

# JWT (Stage 9)
JWT_SECRET_KEY=...             # auto-generated при первом старте, можно задать вручную
JWT_ALGORITHM=HS256
JWT_EXPIRE_DAYS=30
JWT_INCLUDE_JTI=true           # Для отзыва сессий

# SMTP (Stage 9 — Email Verification + Password Reset)
SMTP_HOST=...                  # Optional: если не задано → DEV-режим (логи в /app/logs/emails.log)
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM=...
SMTP_USE_TLS=true

# Безопасность
DB_CLEAR_PASSWORD=...
LK_ENCRYPTION_KEY=...          # AES-ключ для LK credentials
```

### Frontend `.env`

```env
VITE_ENABLE_VISUAL_EDITS=false
ENABLE_HEALTH_CHECK=false
REACT_APP_BACKEND_URL=https://...preview.emergentagent.com   # PUBLIC_BASE_URL
VITE_ENV=test
```

### Порты

- **Frontend:** 3000 (internal, Vite dev) → external через ingress
- **Backend:** 8001 (internal) → ingress route с `/api/` префиксом
- **MongoDB:** 27017

---

## 🔧 ТИПИЧНЫЕ ЗАДАЧИ — где править

| Задача | Файлы |
|--------|-------|
| Новый API endpoint | `server.py` + `models.py` |
| Новый auth-провайдер | `auth_routes.py` + `auth_utils.py` + `models.py` + `AuthContext.jsx` + `authAPI.js` |
| Логика публичного профиля | `server.py` (`/u/{uid}/*`) + `UserProfilePublic` модель + `PublicProfilePage.jsx` |
| Новый UI-компонент | `frontend/src/components/<NewComponent>.jsx` |
| Новая страница (SPA) | `frontend/src/pages/<NewPage>.jsx` + маршрут в `App.jsx` |
| Новое достижение | `achievements.py` (ACHIEVEMENTS dict) + перевод в i18n |
| Логика уведомлений | `scheduler_v2.py` + `notifications.py` + `services/delivery.py` |
| SMTP / Email | `email_service.py` (templates + send) + `auth_routes.py` |
| Pydantic схема | `models.py` |
| Миграция данных | новый файл в `/app/backend/migrate_*.py` + вызов из startup hook в `server.py` |
| Перевод | `frontend/src/i18n/locales/{ru,en}.json` |
| VK Music UI | `components/music/*` + `musicAPI.js` |
| Журнал посещений | `components/journal/*` + `journalAPI.js` |
| Друзья | `Friend*.jsx` + `friendsAPI.js` |
| Сообщения | `ChatModal.jsx` + `messagesAPI.js` |
| Совместное расписание | `Share*Schedule*.jsx` + `api.js` (sharedScheduleAPI) |
| Web Sessions | `DevicesModal.jsx` / `SessionsModal.jsx` + `webSessionAPI.js` + `authAPI.js` |
| 3D-логотип / animations | `Logo3D*.jsx` + `Logo3DContext.jsx` + `logoPreload.js` |
| Streak / Награды | `StreakRewardModal.jsx` + `server.py` (`/users/.../visit`, `/streak-claim`) |
| Админка | `AdminPanel.jsx` + admin endpoints в `server.py` |
| 3D / SVG | `scripts/simplify_svg_geometrically.cjs` + `Logo3D.jsx` |

---

## 📚 ДОПОЛНИТЕЛЬНАЯ ДОКУМЕНТАЦИЯ

| Файл | Описание |
|------|----------|
| [`PROJECT_DETAILS.md`](./PROJECT_DETAILS.md) | Полная техническая документация (модели, sequence-диаграммы, deploy) |
| [`README.md`](./README.md) | Запуск, команды, структура проекта |
| [`memory/PRD.md`](./memory/PRD.md) | Текущий план развития (Stage 9-10 Auth/Profile hardening) |
| `instrProfileAuth.md` | План мульти-авторизации + публичного профиля (Stage 1-5) |
| `instrUIDprofile.md` | План UID-миграции (Phase P3-P4) |
| `plan_vk_auth.md` | План интеграции VK ID |
| `NOTIFICATION_SYSTEM_V2.md`, `NOTIFICATION_V2_SUMMARY.md` | Уведомления V2 |
| `PLANNER_EVENTS_DOCS.md` | Планировщик событий |
| `VK_MUSIC_INTEGRATION_PLAN.md`, `authorization_vkmusic.md`, `cover_audio.md` | VK Music |
| `ROOMS_DOCUMENTATION_INDEX.md`, `HOW_TO_ENABLE_ROOMS.md`, `ROOMS_FEATURE_HIDDEN.md` | Комнаты |
| `BACKUP_GUIDE.md`, `BACKUP_INSTRUCTIONS.md`, `BACKUP_CHEATSHEET.md`, `RESTORE_DATABASE_GUIDE.md` | Бэкапы |
| `MIGRATION_GUIDE_RU.md` | Миграция БД |
| `TASKS_FEATURES.md`, `TASKS_ROADMAP.md`, `subtasksInstruction.md` | Задачи |
| `ADMIN_PANEL_FIX.md` | Фикс админки |
| `NEWYEAR_THEME_FIX.md` | New Year theme |
| `OPTIMIZATION_COMPLETE.md` | Перформанс |
| `DEPLOYMENT_GUIDE.md`, `UPDATE_SERVER_STEPS.md` | Production deployment |
| `lk-rudn-doc.md`, `lk-rudn.md` | ЛК РУДН парсер |
| `planBugCorrectProffile.md`, `stage7_test_summary.md` | План фиксов профиля |
| `RUDN_DB_Architecture.docx` | Архитектура БД |

---

## 🎯 ТЕКУЩЕЕ СОСТОЯНИЕ (2026-05-06)

- **ENV:** `test` (TEST_TELEGRAM_BOT_TOKEN)
- **DB_NAME:** `test_database`
- **Backend:** RUNNING (port 8001) — supervisor
- **Frontend:** RUNNING (port 3000) — supervisor (`yarn start` → vite)
- **MongoDB:** RUNNING (port 27017)
- **Auth:** JWT HS256 + `jti` (отзыв сессий), 30 дней, bcrypt, SMTP DEV-режим
- **Stage 9 hardening:** ✅ ВЫПОЛНЕНО (Password Mgmt, Email Verification, Sessions/Devices)
- **Stage 10 (UID + 3D-singleton):** ✅ ВЫПОЛНЕНО (singleton-логотип через React Portal, 0 ошибок в консоли)
- **PRD pending:** SMTP credentials (для production), UID Phase P3-P4 (resolve_user helper, 11 новых /api/u/{uid}/* endpoints, миграция 38 коллекций)

### Известные нюансы окружения

- `camera-controls@3.1.2` требует Node ≥ 22, но в контейнере Node 20 → используй `yarn install --ignore-engines`.
- При первом старте backend выполняется `migrate_user_settings_to_users()` (см. `migrate_users.py`).
- `JWT_SECRET_KEY` авто-генерируется при первом старте (хранится в state).

---

## 🚀 ROADMAP / Pending

| Этап | Статус | Что осталось |
|------|--------|--------------|
| **Stage 9** Auth/Profile hardening | ✅ DONE | — |
| **Stage 10** UID singleton + 3D-логотип | ✅ DONE | — |
| **UID Phase P3** | 🟡 PARTIAL | универсальный `resolve_user(db, identifier)` helper, 11 новых `/api/u/{uid}/*` (settings, tasks, notifications), JWT с `uid`+`tid` |
| **UID Phase P4** | ⏳ PENDING | миграционный скрипт `backfill_uid_to_collections.py` для 38 коллекций; `uid` в 93 Pydantic-модели; индексы по `uid` |
| **SMTP credentials** | ✅ DONE | VK WorkSpace (`smtp.mail.ru:465` SSL), отправитель `noreply@rudn-schedule.ru`. Email reset/verify/notifications работают. |
| **RegisterWizard UX polish** | ⏳ | per-step validation, лучше feedback |
| **Frontend E2E testing** | ⏳ | через testing agent |
| **Auth_routes split** | ⏳ P2 | `routes/email_auth.py`, `routes/oauth.py`, `routes/sessions.py`, `routes/password.py` |

---

**Этот файл — единая точка входа для ИИ-агента. При расхождении с кодом — приоритет у кода. После значительных изменений ОБЯЗАТЕЛЬНО обновляй счётчики (endpoints / collections / LOC) и `Текущее состояние`.**
