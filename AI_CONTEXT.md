# AI CONTEXT - RUDN Schedule Telegram Web App

**Обновлено:** 2025-07 (актуальный аудит) | **Статус:** ✅ ПОЛНОСТЬЮ АКТУАЛИЗИРОВАН

---

## 🎯 МЕТА-ИНФОРМАЦИЯ

**Тип:** Telegram Web App + Standalone Web App для студентов РУДН
**Стек:** FastAPI (Python) + React 19 + MongoDB + Telegram Bot API + JWT
**Основные функции:**
- 📅 Расписание пар (интеграция с API РУДН)
- ✅ Задачи (личные + групповые в комнатах)
- 🎯 Планировщик событий (синхронизация с расписанием)
- 📓 Журнал посещений (для преподавателей)
- 🎵 VK Music интеграция (стриминг, плейлисты, комнаты прослушивания)
- 👥 Друзья (социальная система с QR-кодами)
- 💬 Система сообщений (чаты, реакции, пересылка, прикрепления)
- 📤 Совместное расписание (шаринг расписания с друзьями)
- 🏆 Достижения (24 ачивки + геймификация)
- 🔥 Streak-система (ежедневные серии посещений + награды)
- 📊 Аналитика и статистика
- 🌤 Погода
- 🔔 Уведомления V2 (±10 сек точность)
- 🎓 Личный кабинет РУДН (ЛК)
- 🔗 Реферальная система (3 уровня + админ-ссылки)
- 📱 Web Sessions (авторизация через QR)
- 🔒 Приватность профиля
- 🖥 Desktop Sidebar (адаптивная верстка)
- 🛡 Расширенная админ-панель (31 endpoint)
- 🆕 🔐 **Мульти-авторизация** (Email + Telegram Login Widget + VK ID OAuth + QR Cross-Device)
- 🆕 🔗 **Публичный профиль по UID** (`/u/{uid}`, 9-значный numeric UID)
- 🆕 🎖 Система уровней/XP (level_system.py + `xp_events`)

---

## 📊 СТАТИСТИКА ПРОЕКТА

| Метрика | Значение |
|---------|----------|
| Backend Python файлов (модулей) | **~20** |
| Backend LOC (server.py) | **19 826** |
| models.py LOC / классов | **2 913 / 249** |
| Frontend компонентов | **~119** (90 top-level + 17 journal + 13 music + 10 auth + 1 icons) |
| Frontend pages (SPA) | **4** (LoginPage, RegisterWizard, VKCallbackPage, QRConfirmPage) |
| API endpoints | **304** |
| MongoDB коллекций | **53** |
| Services (API клиенты) | **12** |
| Utils | **11** |
| Hooks | **3** |
| Contexts | **3** (Auth, Telegram, Theme) + PlayerContext |
| Constants | **3** (levelConstants, publicBase, roomColors) |
| Языков (i18n) | 2 (RU/EN) |
| Достижений | 24 |

---

## 📁 СТРУКТУРА ПРОЕКТА

```
/app/
├── backend/                     # FastAPI backend
│   ├── server.py                # Главный сервер (19 826 LOC, 304 endpoints, включая /u/{uid}/*)
│   ├── models.py                # Pydantic схемы (2 913 LOC, 249 классов)
│   ├── auth_routes.py           # 🆕 Auth router (842 LOC, 14 endpoints)
│   ├── auth_utils.py            # 🆕 JWT / bcrypt / UID / HMAC утилиты (283 LOC)
│   ├── migrate_users.py         # 🆕 Миграция user_settings → users (107 LOC)
│   ├── level_system.py          # 🆕 Система уровней / XP
│   ├── scalability_check.py     # 🆕 Диагностика масштабируемости
│   ├── telegram_bot.py          # Telegram Bot (1 359 LOC)
│   ├── scheduler_v2.py          # Уведомления V2 (1 039 LOC)
│   ├── achievements.py          # Достижения (792 LOC)
│   ├── cover_service.py         # Обложки треков (502 LOC)
│   ├── scheduler.py             # Старый планировщик (резерв)
│   ├── lk_parser.py             # Парсер ЛК РУДН
│   ├── music_service.py         # VK Music сервис
│   ├── vk_auth_service.py       # VK авторизация + OAuth
│   ├── rudn_parser.py           # Парсер API РУДН
│   ├── notifications.py         # Telegram уведомления
│   ├── weather.py               # OpenWeatherMap API
│   ├── config.py                # Конфигурация ENV (+ JWT_* ключи)
│   ├── cache.py                 # Кэширование данных
│   └── requirements.txt         # Python зависимости (+ python-jose, passlib[bcrypt], email-validator)
│
├── frontend/                    # React 19 frontend (Vite + react-router-dom)
│   └── src/
│       ├── App.jsx              # Главный компонент + Routes (/, /login, /register, /auth/vk/callback, /auth/qr/confirm)
│       ├── pages/               # 🆕 SPA страницы авторизации
│       │   ├── LoginPage.jsx
│       │   ├── RegisterWizard.jsx         # Многошаговая регистрация
│       │   ├── VKCallbackPage.jsx         # OAuth callback VK ID
│       │   └── QRConfirmPage.jsx          # Подтверждение QR-сессии
│       ├── components/          # 90 top-level + поддиректории
│       │   ├── auth/            # 🆕 10 компонентов авторизации
│       │   │   ├── AuthButton.jsx
│       │   │   ├── AuthGate.jsx           # Защита маршрутов
│       │   │   ├── AuthInput.jsx
│       │   │   ├── AuthLayout.jsx
│       │   │   ├── EmailLoginForm.jsx
│       │   │   ├── EmailRegisterForm.jsx
│       │   │   ├── QRLoginBlock.jsx       # QR + polling
│       │   │   ├── TelegramLoginWidget.jsx # Telegram Login Widget + fallback
│       │   │   ├── UsernameField.jsx      # С check-username
│       │   │   └── VkLoginButton.jsx
│       │   ├── journal/         # 17 компонентов журнала
│       │   ├── music/           # 13 компонентов музыки
│       │   └── icons/           # VkLogoIcon
│       ├── services/            # 12 API клиентов
│       │   └── authAPI.js       # 🆕 /api/auth/* клиент
│       ├── contexts/            # 3 контекста
│       │   ├── AuthContext.jsx  # 🆕 token, user, login, logout, refreshMe + axios interceptor
│       │   ├── TelegramContext.jsx
│       │   └── ThemeContext.jsx
│       ├── utils/               # 11 утилит
│       │   └── authStorage.js   # 🆕 localStorage wrapper для JWT
│       ├── hooks/               # 3 кастомных хука
│       ├── constants/           # levelConstants, publicBase, roomColors
│       │   └── publicBase.js    # 🆕 PUBLIC_BASE_URL = REACT_APP_BACKEND_URL
│       └── i18n/locales/        # ru.json, en.json
│
├── AI_CONTEXT.md                # ЭТО ФАЙЛ — быстрый обзор для ИИ
├── PROJECT_DETAILS.md           # Полная техническая документация
├── instrProfileAuth.md          # 🆕 План мульти-авторизации + публичного профиля
├── README.md                    # Инструкции по запуску
└── *.md                         # Дополнительная документация
```

---

## 🔌 API ENDPOINTS (304 всего)

### Группировка по модулям:

| Модуль | Endpoints | Описание |
|--------|-----------|----------|
| Журнал посещений | **37** | Журналы, студенты, предметы, занятия, заявки |
| VK Music | **35** | Поиск, стрим, плейлисты, комнаты, OAuth, история |
| Админ панель | **31** | Статистика, пользователи, рефералы, модальные изображения, мониторинг |
| Групповые задачи | **19** | CRUD, подзадачи, комментарии, приглашения |
| 💬 Сообщения | **18** | Чаты, сообщения, реакции, пересылка, типинг |
| Комнаты | **17** | CRUD, приглашения, активность, роли |
| Друзья | **15** | Запросы, блокировки, поиск, избранные |
| 🆕 Auth (`/api/auth/*`) | **14** | Email/Telegram/VK/QR + me/logout/link/check-username/profile-step/config |
| Пользователи | **11** | Настройки, тема, история, уведомления |
| Уведомления | **11** | CRUD, настройки, тестирование |
| Личные задачи | **10** | CRUD, подзадачи, продуктивность |
| Web Sessions | **10** | QR-авторизация, устройства |
| 📤 Совместное расписание | **9** | Шаринг, участники, токены |
| Другое | **9** | Погода, YouTube, VK Video, бот, статус |
| 🆕 Публичный профиль (`/api/u/{uid}/*`) | **8** | Resolve, профиль, расписание, QR, share-link, privacy (GET/PUT), view |
| Реферальная система | **7** | Коды, статистика, дерево, вебапп |
| Планировщик | **5** | Синхронизация, события, превью |
| Профиль (legacy `/profile/{telegram_id}/*`) | **5** | Обратная совместимость |
| Достижения | **5** | Список, трекинг, пометить просмотренными |
| Расписание РУДН | **4** | Факультеты, фильтры, расписание, кэш |
| ЛК РУДН | **4** | Подключение, отключение, данные, статус |
| Бэкапы | **3** | Экспорт БД, статистика |

### 🆕 Auth endpoints (в `auth_routes.py`):

```python
POST /api/auth/register/email              # Регистрация по email + bcrypt
POST /api/auth/login/email                 # Логин email+пароль
POST /api/auth/login/telegram              # Telegram Login Widget (HMAC валидация)
POST /api/auth/login/telegram-webapp       # Автологин в Telegram WebApp по initData
POST /api/auth/login/vk                    # VK ID OAuth (code → token → профиль)
POST /api/auth/login/qr/init               # Инициализация QR-сессии
GET  /api/auth/login/qr/{qr_token}/status  # Polling статуса
POST /api/auth/login/qr/{qr_token}/confirm # Подтверждение с авторизованного устройства
GET  /api/auth/me                          # Текущий пользователь (JWT)
POST /api/auth/logout                      # Выход
POST /api/auth/link/email                  # Привязать провайдер
GET  /api/auth/check-username/{username}   # Доступность username
PATCH /api/auth/profile-step               # Шаги 2-3 регистрации
GET  /api/auth/config                      # Публичная конфигурация (bot_username, VK app_id, etc.)
```

### 🆕 Публичный профиль по UID (в `server.py`):

```python
GET  /api/u/{uid}/resolve        # Резолв UID → идентификаторы
GET  /api/u/{uid}                # Публичный профиль (privacy-фильтры)
GET  /api/u/{uid}/schedule       # Расписание (для друзей + владельца)
GET  /api/u/{uid}/qr             # QR-данные
GET  /api/u/{uid}/share-link     # Публичная ссылка ({PUBLIC_BASE_URL}/u/{uid})
GET  /api/u/{uid}/privacy        # Настройки приватности (только владелец)
PUT  /api/u/{uid}/privacy        # Обновить приватность
POST /api/u/{uid}/view           # Зарегистрировать просмотр (TTL 7 дней)
```

### Прочие ключевые endpoint'ы:

```python
# Расписание
GET  /api/faculties
POST /api/filter-data
POST /api/schedule

# Пользователи
GET  /api/user-settings/{id}
POST /api/user-settings
POST /api/users/{id}/visit       # Трекинг визита + streak

# Задачи
GET  /api/tasks/{id}
POST /api/tasks

# 💬 Сообщения
POST /api/messages/conversations
POST /api/messages/send
POST /api/messages/send-music
POST /api/messages/send-schedule
POST /api/messages/forward
POST /api/messages/{id}/reactions
PUT  /api/messages/{id}/pin

# 📤 Совместное расписание
POST /api/shared-schedule
POST /api/shared-schedule/{id}/add-participant
POST /api/shared-schedule/{id}/share-token
GET  /api/shared-schedule/token/{token}

# VK Music
GET  /api/music/search?q=...
GET  /api/music/stream/{id}
POST /api/music/auth/{id}
POST /api/music/rooms

# Друзья
POST /api/friends/request/{id}
GET  /api/friends/{id}
GET  /api/friends/events/{id}

# Профиль (legacy)
GET  /api/profile/{id}
GET  /api/profile/{id}/qr
GET  /api/profile/{id}/schedule

# Web Sessions
POST /api/web-sessions
GET  /api/web-sessions/{token}/status
POST /api/web-sessions/{token}/link

# Админ (расширенный)
GET  /api/admin/stats
GET  /api/admin/online-users
GET  /api/admin/server-stats
GET  /api/admin/channel-stats
POST /api/admin/referral-links
POST /api/admin/modal-images
POST /api/admin/notifications/parse-telegram
POST /api/admin/notifications/send-from-post
```

---

## 🗄️ MONGODB КОЛЛЕКЦИИ (53)

### По категориям:

**Identity & Auth (6) — РАСШИРЕНО:**
- 🆕 `users` — центральный identity (uid, username, email+hash, telegram_id, vk_id, auth_providers)
- 🆕 `auth_sessions` — активные сессии / refresh tokens
- 🆕 `auth_qr_sessions` / `qr_login_sessions` — QR-подтверждение между устройствами
- `web_sessions` — старые web-сессии (QR авторизация)
- `profile_views` — лог просмотров публичного профиля (TTL 7 дней)

**Пользователи (5):**
- `user_settings` — настройки и группа (с обратной ссылкой `uid` после миграции)
- `user_stats` — статистика для достижений + streak
- `user_achievements` — полученные достижения
- `user_vk_tokens` — VK токены для музыки
- `user_blocks` — заблокированные пользователи
- 🆕 `xp_events` — события начисления XP (level_system)

**Задачи (4):**
- `tasks` — личные задачи
- `group_tasks` — групповые задачи
- `group_task_comments` — комментарии
- `group_task_invites` — приглашения

**Комнаты (3):**
- `rooms` — комнаты (участники встроены)
- `room_activities` — история активности
- `listening_rooms` — комнаты прослушивания музыки

**Журнал посещений (8):**
- `journals` / `attendance_journals` — журналы
- `journal_students` — студенты
- `journal_subjects` — предметы
- `journal_sessions` — занятия
- `attendance_records` — записи посещаемости
- `journal_pending_members` — ожидающие
- `journal_applications` — заявки

**Друзья (2):**
- `friends` — связи друзей
- `friend_requests` — запросы в друзья

**💬 Сообщения (2):**
- `conversations` — чаты/диалоги
- `messages` — сообщения

**Уведомления (4):**
- `scheduled_notifications` — V2
- `notification_history` — история
- `sent_notifications` — отправленные
- `in_app_notifications` — внутренние

**Реферальная система (5):**
- `referral_connections` — связи
- `referral_events` — события
- `admin_referral_links` — админ-ссылки
- `referral_link_events` — события ссылок
- `referral_rewards` — награды

**📤 Совместное расписание (2):**
- `shared_schedules` — совместные расписания
- `schedule_share_tokens` — токены для шаринга

**Кэш и медиа (5):**
- `schedule_cache` — кэш расписаний
- `cover_cache` — кэш обложек
- `music_favorites` — избранные треки
- `music_history` — история прослушиваний
- `modal_images` — изображения модалов

**Мониторинг и аналитика (5):**
- `status_checks` — проверки статуса
- `lk_connections` — подключения ЛК
- `channel_stats_history` — история статистики канала
- `online_stats_history` — история онлайн-статистики
- `server_metrics_history` — история метрик сервера

**Прочее (2):**
- `command` — служебные команды
- (+ вспомогательные TTL-индексы на `profile_views` и `auth_qr_sessions`)

---

## ⚡ БЫСТРЫЕ КОМАНДЫ

### Управление сервисами:
```bash
sudo supervisorctl status              # Статус
sudo supervisorctl restart all         # Перезапуск всех
sudo supervisorctl restart backend     # Только backend
sudo supervisorctl restart frontend    # Только frontend
```

### Логи:
```bash
tail -f /var/log/supervisor/backend.*.log     # Backend логи
tail -f /var/log/supervisor/frontend.*.log    # Frontend логи
tail -50 /var/log/supervisor/backend.err.log  # Ошибки
```

### Установка зависимостей:
```bash
# Backend
cd /app/backend && pip install PACKAGE && echo "PACKAGE" >> requirements.txt

# Frontend (ТОЛЬКО yarn!)
cd /app/frontend && yarn add PACKAGE
```

### Навигация по коду:
```bash
# Количество endpoints
grep -c "@api_router\." /app/backend/server.py
grep -cE "@router\.(get|post|put|patch|delete)" /app/backend/auth_routes.py

# MongoDB коллекции
grep -oE 'db\.[a-zA-Z_]+' /app/backend/server.py | sort -u

# Pydantic модели
grep -c "^class " /app/backend/models.py

# Компоненты / страницы
ls /app/frontend/src/components/
ls /app/frontend/src/components/auth/
ls /app/frontend/src/pages/
ls /app/frontend/src/services/
```

---

## ⚠️ КРИТИЧЕСКИЕ ПРАВИЛА

### ❌ НИКОГДА:
1. **НЕ использовать npm** — только `yarn`!
2. **НЕ хардкодить URLs/ports** — только через .env
3. **НЕ использовать MongoDB ObjectID** — только UUID (для identity — 9-значный `uid`)
4. **НЕ забывать `/api/` префикс** для backend routes
5. **НЕ изменять .env файлы** без крайней необходимости

### ✅ ВСЕГДА:
1. Читать `AI_CONTEXT.md` перед началом работы
2. Проверять логи после изменений
3. Следовать существующим паттернам кода
4. Тестировать в Telegram Web App **и** в standalone браузере (SPA)
5. Обновлять `requirements.txt` / `package.json`
6. Для авторизации: JWT в localStorage + axios `Authorization: Bearer` interceptor (см. `AuthContext.jsx`)

---

## 🔧 ENVIRONMENT VARIABLES

### Backend (.env):
```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
CORS_ORIGINS="*"
ENV="test"                     # или "production"

# Telegram
TELEGRAM_BOT_TOKEN=...          # Продакшн бот
TEST_TELEGRAM_BOT_TOKEN=...     # Тестовый бот
TELEGRAM_BOT_USERNAME=...       # Для Telegram Login Widget

# Внешние API
WEATHER_API_KEY=...

# VK Music
VK_MUSIC_TOKEN=...
VK_USER_ID=...

# VK OAuth (для мульти-авторизации)
VK_APP_ID=...
VK_CLIENT_SECRET=...
VK_REDIRECT_URI=...

# 🆕 JWT
JWT_SECRET_KEY=...              # auto-generated при первом старте
JWT_ALGORITHM=HS256
JWT_EXPIRE_DAYS=30

# Безопасность
DB_CLEAR_PASSWORD=...
LK_ENCRYPTION_KEY=...
```

### Frontend (.env):
```env
VITE_ENABLE_VISUAL_EDITS=false
ENABLE_HEALTH_CHECK=false
REACT_APP_BACKEND_URL=...       # Автоматически определяется (== PUBLIC_BASE_URL)
VITE_ENV=test
```

### Порты:
- **Frontend:** 3000 (internal)
- **Backend:** 8001 (internal)
- **MongoDB:** 27017

---

## 🔧 ТИПИЧНЫЕ ЗАДАЧИ

| Задача | Файлы |
|--------|-------|
| Новый API endpoint | `server.py` + `models.py` |
| 🆕 Новый auth-провайдер | `auth_routes.py` + `auth_utils.py` + `models.py` + `AuthContext.jsx` |
| 🆕 Логика публичного профиля | `server.py` (`/u/{uid}/*`) + `UserProfilePublic` модель |
| Новый UI компонент | `/components/NewComponent.jsx` |
| Новая страница (SPA) | `/pages/NewPage.jsx` + маршрут в `App.jsx` |
| Новое достижение | `achievements.py` (ACHIEVEMENTS dict) |
| Логика уведомлений | `scheduler_v2.py` + `notifications.py` |
| Схема БД | `models.py` (Pydantic) |
| Перевод | `/i18n/locales/ru.json` и `en.json` |
| VK Music | `/components/music/` + `musicAPI.js` |
| Журнал посещений | `/components/journal/` + `journalAPI.js` |
| Друзья | `Friend*.jsx` + `friendsAPI.js` |
| Сообщения | `ChatModal.jsx` + `messagesAPI.js` |
| Совместное расписание | `Share*.jsx` + `api.js` |
| Web Sessions | `DevicesModal.jsx` + `webSessionAPI.js` |
| Streak/Награды | `StreakRewardModal.jsx` + `server.py` |
| Админка | `AdminPanel.jsx` + `server.py` (admin endpoints) |
| 🆕 Миграция пользователей | `migrate_users.py` (startup hook) |

---

## 📚 ДОПОЛНИТЕЛЬНАЯ ДОКУМЕНТАЦИЯ

| Файл | Описание |
|------|----------|
| `PROJECT_DETAILS.md` | Полная техническая документация |
| 🆕 `instrProfileAuth.md` | План мульти-авторизации + публичного профиля (Stage 1-5) |
| `plan_vk_auth.md` | План интеграции VK ID (старый) |
| `NOTIFICATION_SYSTEM_V2.md` | Система уведомлений V2 |
| `PLANNER_EVENTS_DOCS.md` | Планировщик событий |
| `VK_MUSIC_INTEGRATION_PLAN.md` | VK Music интеграция |
| `ROOMS_DOCUMENTATION_INDEX.md` | Документация комнат |
| `BACKUP_GUIDE.md` | Руководство по бэкапам |
| `MIGRATION_GUIDE_RU.md` | Миграция БД |
| `TASKS_FEATURES.md` | Описание задач |
| `TASKS_ROADMAP.md` | Дорожная карта задач |

---

## 🎯 ТЕКУЩЕЕ СОСТОЯНИЕ

- **ENV:** `test` (TEST_TELEGRAM_BOT_TOKEN)
- **DB_NAME:** `test_database`
- **Backend:** RUNNING (port 8001)
- **Frontend:** RUNNING (port 3000)
- **MongoDB:** RUNNING (port 27017)
- **Auth:** JWT HS256, 30 дней, bcrypt для email-паролей
- **Миграция:** `migrate_user_settings_to_users()` выполняется при старте backend

---

## 🆕 НОВЫЕ ФУНКЦИИ (vs предыдущая редакция AI_CONTEXT)

### 1. 🔐 Мульти-авторизация (Stage 1-3 плана `instrProfileAuth.md`)
**Backend:**
- Коллекция `users` с 9-значным numeric `uid` (primary public ID)
- 14 endpoint'ов `/api/auth/*` (email/telegram/vk/qr + me/logout/link/check-username/profile-step/config)
- JWT HS256 (секрет `JWT_SECRET_KEY`), TTL 30 дней
- HMAC-валидация Telegram Login Widget (`verify_telegram_login_widget_hash`)
- Валидация Telegram WebApp `initData` (`verify_telegram_webapp_init_data`)
- VK ID OAuth (code → access_token → `users.get`)
- QR Cross-Device Login (init → polling status → confirm с авторизованного устройства)
- Миграция `user_settings` → `users` при старте (`migrate_users.py`)
- **Файлы:** `auth_routes.py`, `auth_utils.py`, `migrate_users.py`

**Frontend:**
- `AuthContext` + `AuthProvider` (token, user, login/logout/refreshMe)
- Axios interceptor (Bearer header + 401 → logout)
- Страницы: `/login`, `/register`, `/auth/vk/callback`, `/auth/qr/confirm`
- `AuthGate` защищает `/` (корневой маршрут)
- 10 компонентов в `components/auth/`
- Многошаговая регистрация: выбор провайдера → username/имя → учебные данные
- `publicBase.js` экспортирует `PUBLIC_BASE_URL = REACT_APP_BACKEND_URL`

### 2. 🔗 Публичный профиль по UID (Stage 2 плана)
**Backend:**
- 8 endpoint'ов `/api/u/{uid}/*` (resolve, профиль, schedule, qr, share-link, privacy, view)
- Helper `resolve_user_by_uid()` (fallback на legacy `user_settings` по telegram_id)
- TTL-индекс на `profile_views` (7 дней) для дедупликации просмотров
- Старые `/api/profile/{telegram_id}/*` сохранены для обратной совместимости
- Исправлены BUG-1…BUG-8 (share-link для владельца, activity-ping с JWT, view не считается для скрытых, qr для анонимов, created_at всем, Pydantic v2 `model_dump`, добавлены `uid`/`username` в `UserProfilePublic`)

**Frontend:**
- ⚠️ **Stage 4 не завершён**: нет `PublicProfilePage.jsx` и маршрута `/u/:uid`
- Кнопка "Поделиться ссылкой" в `ProfileScreen.jsx` пока использует `qrData.qr_data` (legacy)

### 3. 🎖 Система уровней/XP
- `level_system.py` — начисление XP за активности
- `xp_events` коллекция — лог начислений
- `levelConstants.js` — фронтенд-константы

### 4. 💬 Система сообщений (уже была)
Полноценная система чатов между друзьями.

### 5. 📤 Совместное расписание (уже было)
Шаринг расписания с друзьями.

### 6. 🔥 Streak-система (уже была)
Ежедневные серии посещений с наградами.

### 7. 🖥 Desktop Sidebar (уже был)
Адаптивный интерфейс для десктопа.

### 8. 🛡 Расширенная админ-панель (31 endpoint, уже была)

---

## ⏳ НЕЗАВЕРШЁННЫЕ ЭТАПЫ (instrProfileAuth.md)

| Stage | Статус | Что осталось |
|-------|--------|--------------|
| **Stage 4** — Публичная страница `/u/{uid}` | ⏳ Не начато | `PublicProfilePage.jsx` + маршрут React Router + переключение кнопки "Поделиться" на `{PUBLIC_BASE_URL}/u/{uid}` |
| **Stage 5** — Внешние интеграции | ⚠️ Частично (frontend+backend готов) | E2E тестирование всех 4 провайдеров, настройка `/setdomain` в BotFather |

---

**Этот файл содержит ВСЁ необходимое для быстрого старта разработки ИИ-агентами с минимальным потреблением токенов.**
