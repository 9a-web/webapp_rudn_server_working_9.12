# RUDN Schedule — Telegram Web App + Standalone SPA

> Telegram Web App / Standalone SPA для студентов и преподавателей РУДН: расписание, задачи, журнал посещений, VK Music, сообщения, друзья, достижения и многое другое.

---

## 📱 О проекте

**RUDN Schedule** объединяет в одном приложении расписание пар (с интеграцией API РУДН), задачи, журнал посещений для преподавателей, VK Music со стримингом, систему сообщений, социальный профиль с публичной ссылкой `/u/{uid}` и расширенную геймификацию.

Поддерживает **5 способов авторизации** (Email + Telegram Login Widget + Telegram WebApp + VK ID OAuth + QR Cross-Device), **password management**, **email verification** и **управление сессиями устройств**.

### 🌟 Возможности

- **📅 Расписание пар** — интеграция с официальным API РУДН, live-карусель текущих занятий, таймеры, кэш
- **✅ Задачи** — личные + групповые (в комнатах) с категориями, приоритетами, дедлайнами, подзадачами, тегами
- **🎯 Планировщик** — синхронизация событий с расписанием, timeline-визуализация
- **📓 Журнал посещений** — для преподавателей: учёт студентов, занятий, заявки, статистика
- **🎵 VK Music** — авторизация (логин + OAuth), стриминг, плейлисты, обложки, история, listening-rooms
- **👥 Друзья** — запросы, блокировки, поиск, QR-коды, избранные, real-time события
- **💬 Сообщения** — чаты с реакциями, типингом, пересылкой, отправкой музыки и расписания, поиском, пинами
- **📤 Совместное расписание** — наложение и шаринг расписаний с друзьями, share-токены
- **🏆 Достижения** — 24 ачивки + 🎖 уровни/XP с конфетти-анимацией
- **🔥 Streak-система** — ежедневные серии посещений с наградами
- **🔔 Уведомления V2** — точные нотификации о парах (±10 сек), retry/DLQ
- **📊 Аналитика** — статистика расписания, графики нагрузки
- **🌤 Погода** — виджет погоды в Москве (OpenWeatherMap)
- **🔗 Реферальная система** — 3-уровневая + админ-ссылки + статистика
- **📱 Web Sessions** — QR cross-device authentication
- **🔒 Privacy** — гранулярные настройки видимости профиля
- **🖥 Desktop Sidebar** — адаптивный интерфейс
- **🛡 Админ-панель** — статистика, мониторинг, рассылки из Telegram-постов, рефералы (33 endpoint'а)
- **🔐 Multi-Auth** — Email + Telegram + VK + QR; Password Reset + Email Verification + Sessions Mgmt
- **🔗 Public Profile** — `/u/{uid}` (13 endpoints: profile, schedule, qr, share-link, privacy, view, avatar, graffiti, friends, achievements)
- **🎨 3D-логотип** — singleton через React Portal (один Canvas на body, плавный transition между страницами)

---

## 🛠 Стек технологий

### Backend
- **FastAPI** 0.110.1, Python 3.10+
- **MongoDB** (`pymongo` 4.5.0, `motor` 3.3.1)
- **Pydantic** v2.6+ (259 моделей)
- **APScheduler** 3.10+ (уведомления V2)
- **python-telegram-bot** 20.7+
- **vkpymusic / vkaudiotoken** (VK Music API)
- **aiosmtplib** (SMTP для password reset / email verification)
- **httpx**, **aiohttp** (async HTTP)
- **bcrypt + python-jose + pyjwt + passlib** (JWT HS256, bcrypt, sessions с `jti`)
- **cryptography** (AES для LK credentials)
- **psutil** (мониторинг)
- **yt-dlp**, **Pillow**, **matplotlib** (медиа)

### Frontend
- **React** 19.0.0 + **react-router-dom** 7.5.1
- **Vite** 7.2.2 (сборка, hot reload)
- **TailwindCSS** 3.4.17 + **PostCSS** + **Autoprefixer**
- **Framer Motion** 12.23.24 (анимации)
- **@twa-dev/sdk** 8.0.2 (Telegram Web App)
- **axios** 1.12.2 (с interceptor'ом для JWT)
- **i18next** 25.6+ + **react-i18next** 16.2 (RU/EN)
- **recharts** 3.4.1 (графики)
- **qrcode.react** 4.2.0
- **html-to-image** 1.11.13 (скриншоты)
- **canvas-confetti** 1.9.4 (достижения)
- **lucide-react** 1.7.0 (иконки)
- **three** 0.183 + **@react-three/fiber** 9.5 + **@react-three/drei** 10.7 (3D-логотип)
- **3dsvg**, **jwt-decode**

### Infrastructure
- **Kubernetes** (ingress: `/api/*` → backend:8001, остальное → frontend:3000)
- **Supervisor** (process manager: `backend`, `frontend`, `mongodb`, `code-server`, `nginx-code-proxy`)
- **MongoDB** (локально, port 27017)

---

## 📊 Статистика проекта (real-time, 2026-05-06)

| Метрика | Значение |
|---------|----------|
| Backend Python модулей | **30** |
| Backend LOC (ключевые файлы) | **~30,500** |
| `server.py` LOC | **20,789** |
| `models.py` LOC / классов | **3,035 / 259** |
| `auth_routes.py` LOC / endpoints | **2,537 / 28** |
| API endpoints (всего) | **339** (311 в server.py + 28 в auth_routes.py) |
| MongoDB коллекций | **57** |
| Frontend компонентов | **134** |
| Frontend SPA-страниц | **9** |
| Services (API клиенты) | **12** |
| Contexts / Hooks / Utils | **4 / 5 / 14** |
| `App.jsx` LOC | **2,734** |
| Языков (i18n) | 2 (RU / EN) |
| Достижений | 24 |

---

## 🚀 Быстрый старт

### 1. Статус сервисов

```bash
sudo supervisorctl status
```

### 2. Перезапуск

```bash
sudo supervisorctl restart all
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
```

### 3. Логи

```bash
# Backend
tail -f /var/log/supervisor/backend.*.log
tail -50 /var/log/supervisor/backend.err.log | grep -i error

# Frontend
tail -f /var/log/supervisor/frontend.*.log

# DEV-режим SMTP (когда не настроен реальный)
tail -f /app/logs/emails.log
```

### 4. Установка зависимостей

**Backend:**
```bash
cd /app/backend
pip install <package>
echo "<package>" >> requirements.txt
sudo supervisorctl restart backend
```

**Frontend (только yarn!):**
```bash
cd /app/frontend
yarn add <package>
# Hot reload автоматически перезагрузит UI
```

> ⚠️ Если `yarn install` падает с ошибкой engines (`camera-controls@3.1.2 requires node ≥22`), используй `yarn install --ignore-engines` (Node в контейнере = 20).

### 5. Дополнительные пакеты (Emergent integrations)

```bash
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
```

---

## 📁 Структура проекта (упрощённо)

```
/app/
├── backend/                       # FastAPI backend (~30,500 LOC ключевых файлов)
│   ├── server.py                  # 311 endpoints
│   ├── models.py                  # 259 Pydantic-моделей
│   ├── auth_routes.py             # /api/auth/* (28 endpoints)
│   ├── auth_utils.py              # JWT + bcrypt + sessions + rate-limit
│   ├── email_service.py           # SMTP (aiosmtplib) + DEV fallback
│   ├── level_system.py            # Уровни / XP
│   ├── migrate_users.py           # user_settings → users
│   ├── telegram_bot.py            # Telegram Bot
│   ├── scheduler_v2.py            # Уведомления V2
│   ├── achievements.py            # 24 достижения
│   ├── cover_service.py           # Обложки треков
│   ├── lk_parser.py, rudn_parser.py
│   ├── music_service.py, vk_auth_service.py
│   ├── notifications.py, weather.py, cache.py, config.py
│   ├── services/delivery.py       # MessagePriority + retry/DLQ
│   ├── static/                    # Загруженные изображения
│   └── requirements.txt
│
├── frontend/                      # React 19 + Vite 7 (~74,300 LOC)
│   └── src/
│       ├── App.jsx                # 2,734 LOC
│       ├── pages/                 # 9 SPA-страниц
│       ├── components/            # 134 компонента (включая auth/, journal/, music/, icons/)
│       ├── services/              # 12 API-клиентов
│       ├── contexts/              # AuthContext, TelegramContext, ThemeContext, Logo3DContext
│       ├── utils/                 # 14 утилит
│       ├── hooks/                 # 5 хуков
│       ├── constants/             # levelConstants, publicBase, roomColors
│       ├── i18n/locales/          # ru.json, en.json
│       └── fonts/                 # GG Zaglav.woff2
│
├── memory/
│   ├── PRD.md                     # Текущий план разработки
│   ├── test_credentials.md
│   └── 3dsvg_fix_notes.md
│
├── scripts/                       # mongodb_watchdog, simplify_svg
├── tests/                         # Backend/integration тесты
│
├── AI_CONTEXT.md                  # ⭐ TL;DR для ИИ-агентов
├── PROJECT_DETAILS.md             # Полная техническая документация
├── README.md                      # Этот файл
├── DEPLOYMENT_GUIDE.md            # Production deployment
└── *.md                           # Дополнительная документация
```

Полная структура — в [`AI_CONTEXT.md`](./AI_CONTEXT.md) и [`PROJECT_DETAILS.md`](./PROJECT_DETAILS.md).

---

## 🔧 Конфигурация

### Backend `.env`

```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
CORS_ORIGINS="*"
ENV="test"                       # или "production"

# Telegram
TELEGRAM_BOT_TOKEN=...
TEST_TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=...        # для Telegram Login Widget

# VK Music + OAuth
VK_MUSIC_TOKEN=..., VK_USER_ID=...
VK_APP_ID=..., VK_CLIENT_SECRET=..., VK_REDIRECT_URI=...

# JWT
JWT_SECRET_KEY=...               # auto-gen при старте, можно задать вручную
JWT_ALGORITHM=HS256
JWT_EXPIRE_DAYS=30
JWT_INCLUDE_JTI=true

# SMTP (если не задан → DEV-режим, логи в /app/logs/emails.log)
SMTP_HOST=..., SMTP_PORT=587, SMTP_USER=..., SMTP_PASSWORD=...
SMTP_FROM=..., SMTP_USE_TLS=true

# Прочее
WEATHER_API_KEY=...
DB_CLEAR_PASSWORD=...
LK_ENCRYPTION_KEY=...            # AES для LK РУДН credentials
```

### Frontend `.env`

```env
VITE_ENABLE_VISUAL_EDITS=false
ENABLE_HEALTH_CHECK=false
REACT_APP_BACKEND_URL=...        # external URL = PUBLIC_BASE_URL
VITE_ENV=test
```

### Порты

- **Frontend:** 3000 (internal, Vite)
- **Backend:** 8001 (internal, Uvicorn)
- **MongoDB:** 27017

---

## 📚 Документация

| Документ | Описание |
|----------|----------|
| [AI_CONTEXT.md](./AI_CONTEXT.md) | ⭐ Быстрый обзор для ИИ-агентов (точка входа) |
| [PROJECT_DETAILS.md](./PROJECT_DETAILS.md) | Полная техническая документация (модели, sequence-диаграммы) |
| [memory/PRD.md](./memory/PRD.md) | Текущий план развития (Stage 9-10 Auth hardening) |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Production deployment |
| [NOTIFICATION_SYSTEM_V2.md](./NOTIFICATION_SYSTEM_V2.md) | Уведомления V2 |
| [PLANNER_EVENTS_DOCS.md](./PLANNER_EVENTS_DOCS.md) | Планировщик событий |
| [VK_MUSIC_INTEGRATION_PLAN.md](./VK_MUSIC_INTEGRATION_PLAN.md) | VK Music |
| [ROOMS_DOCUMENTATION_INDEX.md](./ROOMS_DOCUMENTATION_INDEX.md) | Комнаты |
| [BACKUP_GUIDE.md](./BACKUP_GUIDE.md) | Бэкапы |
| [TASKS_FEATURES.md](./TASKS_FEATURES.md), [TASKS_ROADMAP.md](./TASKS_ROADMAP.md) | Задачи |
| `instrProfileAuth.md` | План мульти-авторизации (Stage 1-5) |
| `instrUIDprofile.md` | UID миграция (Phase P3-P4) |

---

## ⚠️ Важные правила

### ❌ ЗАПРЕЩЕНО
1. Использовать `npm` (только `yarn`!).
2. Хардкодить URLs/ports — только через ENV.
3. Использовать MongoDB ObjectID (только UUID; для identity — 9-значный numeric `uid`).
4. Забывать `/api/` префикс для backend routes.
5. Изменять `.env` файлы без необходимости.
6. Сравнивать пользователей через `===` — используй `isSameUser()` из `utils/userIdentity.js`.

### ✅ ОБЯЗАТЕЛЬНО
1. Читать `AI_CONTEXT.md` перед началом задачи.
2. Проверять логи после изменений.
3. Следовать паттернам кода (Pydantic v2, async/await, `app.state.db`).
4. Тестировать в Telegram Web App **И** в standalone браузере.
5. Обновлять `requirements.txt` / `package.json`.
6. JWT — через `localStorage` + axios `Authorization: Bearer` interceptor (см. `AuthContext.jsx`).
7. Telegram-нотификации — через `safe_send_telegram` (anti-spam, retry, DLQ).

---

## 🔗 Полезные ссылки

- **Продакшн Bot:** [@rudn_mosbot](https://t.me/rudn_mosbot)
- **API РУДН:** http://www.rudn.ru/rasp/lessons/view
- **OpenWeather:** https://openweathermap.org/api

---

## 📦 API endpoints (sumарно по модулям)

| Модуль | Endpoints | Файл |
|--------|-----------|------|
| Журнал посещений | **36** | server.py |
| VK Music | **35** | server.py |
| Админ-панель | **33** | server.py |
| 🔐 Auth (`/api/auth/*`) | **28** | auth_routes.py |
| Групповые задачи | **18** | server.py |
| 💬 Сообщения | **18** | server.py |
| Профиль (legacy) | **18** | server.py |
| Комнаты | **17** | server.py |
| Друзья | **15** | server.py |
| 🔗 Public Profile (`/api/u/{uid}/*`) | **13** | server.py |
| Уведомления | **11** | server.py |
| Web Sessions | **9** | server.py |
| Пользователи | **9** | server.py |
| Tasks (личные) | **9** | server.py |
| 📤 Совместное расписание | **8** | server.py |
| Реферальная система | **7** | server.py |
| Планировщик | **5** | server.py |
| Достижения | **5** | server.py |
| Расписание РУДН | **4** | server.py |
| ЛК РУДН | **4** | server.py |
| Privacy (legacy) | **4** | server.py |
| Бэкапы | **3** | server.py |
| Dev / Прочее | **13** | server.py |
| **ИТОГО** | **339** | |

---

## 📝 Для ИИ-агентов

**Перед началом работы:**

1. Прочитайте [`AI_CONTEXT.md`](./AI_CONTEXT.md) — TL;DR проекта (точка входа).
2. При необходимости детальной информации — [`PROJECT_DETAILS.md`](./PROJECT_DETAILS.md).
3. Текущий план разработки — [`memory/PRD.md`](./memory/PRD.md).
4. Используйте `grep` для поиска по коду (он быстрее, чем чтение файлов целиком).
5. Проверяйте логи после каждого значимого изменения.

**Полезные команды:**

```bash
# Подсчёт endpoints
grep -cE "@(api_router|app)\.(get|post|put|patch|delete)" /app/backend/server.py
grep -cE "@router\.(get|post|put|patch|delete)" /app/backend/auth_routes.py

# MongoDB коллекции
grep -hoE 'db\.[a-zA-Z_]+' /app/backend/server.py /app/backend/auth_routes.py | sort -u

# Pydantic модели
grep -c "^class " /app/backend/models.py

# Frontend компоненты / страницы
fd ".jsx$" /app/frontend/src/components -t f | wc -l
ls /app/frontend/src/pages/ /app/frontend/src/services/ /app/frontend/src/contexts/

# LOC ключевых файлов
wc -l /app/backend/server.py /app/backend/models.py /app/backend/auth_routes.py /app/frontend/src/App.jsx
```

---

**Последнее обновление:** 2026-05-06  
**Метод обновления:** Real-time аудит кода (grep, wc, fd) + актуализация при каждом значимом изменении.  
**Источник истины:** код в `/app/backend` и `/app/frontend/src`. При расхождениях — приоритет у кода.
