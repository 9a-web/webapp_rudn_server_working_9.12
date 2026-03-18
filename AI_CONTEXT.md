# AI CONTEXT - RUDN Schedule Telegram Web App

**Обновлено:** 2025-07-17 | **Статус:** ✅ ПОЛНОСТЬЮ АКТУАЛИЗИРОВАН (автоматический аудит кода)

---

## 🎯 МЕТА-ИНФОРМАЦИЯ

**Тип:** Telegram Web App для студентов РУДН  
**Стек:** FastAPI (Python) + React 19 + MongoDB + Telegram Bot API  
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

---

## 📊 СТАТИСТИКА ПРОЕКТА

| Метрика | Значение |
|---------|----------|
| Backend Python файлов | **15** |
| Backend LOC | **~26,300** |
| Pydantic моделей | **230** |
| Frontend компонентов | **109** (78 основных + 17 journal + 13 music + 1 icons) |
| Frontend LOC | **~64,000** |
| API endpoints | **268** |
| MongoDB коллекций | **46** |
| Services (API клиенты) | **11** |
| Utils | **10** |
| Hooks | **3** |
| Contexts | **2** (Telegram, Theme) + PlayerContext |
| Языков (i18n) | 2 (RU/EN) |
| Достижений | 24 |

---

## 📁 СТРУКТУРА ПРОЕКТА

```
/app/
├── backend/                    # FastAPI backend (~26,300 LOC)
│   ├── server.py              # Главный сервер (17,675 LOC, 268 endpoints)
│   ├── models.py              # Pydantic схемы (2,665 LOC, 230 классов)
│   ├── telegram_bot.py        # Telegram Bot (1,359 LOC)
│   ├── scheduler_v2.py        # Уведомления V2 (1,039 LOC)
│   ├── achievements.py        # Достижения (792 LOC)
│   ├── cover_service.py       # Обложки треков (502 LOC)
│   ├── scheduler.py           # Старый планировщик (383 LOC, резерв)
│   ├── lk_parser.py           # Парсер ЛК РУДН (380 LOC)
│   ├── music_service.py       # VK Music сервис (387 LOC)
│   ├── vk_auth_service.py     # VK авторизация + OAuth (331 LOC)
│   ├── rudn_parser.py         # Парсер API РУДН (323 LOC)
│   ├── notifications.py       # Telegram уведомления (177 LOC)
│   ├── weather.py             # OpenWeatherMap API (118 LOC)
│   ├── config.py              # Конфигурация ENV (113 LOC)
│   ├── cache.py               # Кэширование данных (42 LOC)
│   └── requirements.txt       # Python зависимости
│
├── frontend/                   # React 19 frontend (~64,000 LOC)
│   └── src/
│       ├── App.jsx            # Главный компонент (2,600 LOC)
│       ├── components/        # 78 основных компонентов
│       │   ├── journal/       # 17 компонентов журнала
│       │   ├── music/         # 13 компонентов музыки
│       │   └── icons/         # 1 иконка (VkLogoIcon)
│       ├── services/          # 11 API клиентов
│       ├── contexts/          # 2 React контекста
│       ├── utils/             # 10 утилит
│       ├── hooks/             # 3 кастомных хука
│       ├── constants/         # Константы (roomColors)
│       └── i18n/locales/      # ru.json, en.json
│
├── AI_CONTEXT.md              # ЭТО ФАЙЛ — быстрый обзор для ИИ
├── PROJECT_DETAILS.md         # Полная техническая документация
├── README.md                  # Инструкции по запуску
└── *.md                       # Дополнительная документация
```

---

## 🔌 API ENDPOINTS (268 всего)

### Группировка по модулям:

| Модуль | Endpoints | Описание |
|--------|-----------|----------|
| Журнал посещений | **37** | Журналы, студенты, предметы, занятия, заявки |
| VK Music | **35** | Поиск, стрим, плейлисты, комнаты, OAuth, история |
| Админ панель | **31** | Статистика, пользователи, рефералы, модальные изображения, мониторинг |
| Групповые задачи | **19** | CRUD, подзадачи, комментарии, приглашения |
| 💬 Сообщения (НОВОЕ) | **18** | Чаты, сообщения, реакции, пересылка, типинг |
| Комнаты | **17** | CRUD, приглашения, активность, роли |
| Друзья | **15** | Запросы, блокировки, поиск, избранные |
| Пользователи | **11** | Настройки, тема, история, уведомления |
| Уведомления | **11** | CRUD, настройки, тестирование |
| Личные задачи | **10** | CRUD, подзадачи, продуктивность |
| Web Sessions | **10** | QR-авторизация, устройства |
| 📤 Совместное расписание (НОВОЕ) | **9** | Шаринг, участники, токены |
| Другое | **9** | Погода, YouTube, VK Video, бот, статус |
| Реферальная система | **7** | Коды, статистика, дерево, вебапп |
| Планировщик | **5** | Синхронизация, события, превью |
| Профиль | **5** | Публичный профиль, QR, расписание, приватность |
| Достижения | **5** | Список, трекинг, пометить просмотренными |
| Расписание РУДН | **4** | Факультеты, фильтры, расписание, кэш |
| ЛК РУДН | **4** | Подключение, отключение, данные, статус |
| Бэкапы | **3** | Экспорт БД, статистика |

### Ключевые endpoint'ы:

```python
# Расписание
GET  /api/faculties              # Список факультетов
POST /api/filter-data            # Фильтры (курс, группа)
POST /api/schedule               # Расписание группы

# Пользователи
GET  /api/user-settings/{id}     # Настройки юзера
POST /api/user-settings          # Сохранить настройки
POST /api/users/{id}/visit       # Трекинг визита + streak

# Задачи
GET  /api/tasks/{id}             # Список задач
POST /api/tasks                  # Создать задачу

# 💬 Сообщения (НОВОЕ)
POST /api/messages/conversations  # Создать диалог
GET  /api/messages/conversations/{id}  # Список диалогов
POST /api/messages/send           # Отправить сообщение
POST /api/messages/send-music     # Отправить трек другу
POST /api/messages/send-schedule  # Отправить расписание
POST /api/messages/forward        # Переслать сообщение
POST /api/messages/{id}/reactions # Реакция на сообщение
PUT  /api/messages/{id}/pin       # Закрепить сообщение

# 📤 Совместное расписание (НОВОЕ)
POST /api/shared-schedule         # Создать совместное расписание
GET  /api/shared-schedule/{id}    # Получить расписание
POST /api/shared-schedule/{id}/add-participant  # Добавить участника
POST /api/shared-schedule/{id}/share-token      # Токен для шаринга
GET  /api/shared-schedule/token/{token}         # Расписание по токену

# VK Music
GET  /api/music/search?q=...     # Поиск треков
GET  /api/music/stream/{id}      # Стрим трека
POST /api/music/auth/{id}        # VK авторизация
GET  /api/music/vk-callback      # OAuth callback
POST /api/music/history/{id}     # Сохранить историю
GET  /api/music/similar/{id}     # Похожие треки
POST /api/music/rooms            # Создать комнату прослушивания

# Друзья
POST /api/friends/request/{id}   # Отправить запрос
GET  /api/friends/{id}           # Список друзей
GET  /api/friends/events/{id}    # События друзей (real-time)

# Профиль
GET  /api/profile/{id}           # Публичный профиль
GET  /api/profile/{id}/qr        # QR-код профиля
GET  /api/profile/{id}/schedule  # Расписание (для друзей)

# Web Sessions
POST /api/web-sessions           # Создать сессию (QR)
GET  /api/web-sessions/{token}/status  # Статус
POST /api/web-sessions/{token}/link    # Привязать

# Админ (расширенный)
GET  /api/admin/stats             # Общая статистика
GET  /api/admin/online-users      # Онлайн мониторинг
GET  /api/admin/server-stats      # Метрики сервера
GET  /api/admin/channel-stats     # Статистика канала
POST /api/admin/referral-links    # Создать реферальную ссылку
POST /api/admin/modal-images      # Загрузить изображение
POST /api/admin/notifications/parse-telegram  # Парсинг поста из Telegram
POST /api/admin/notifications/send-from-post  # Рассылка из поста
```

---

## 🗄️ MONGODB КОЛЛЕКЦИИ (46)

### По категориям:

**Пользователи (6):**
- `user_settings` — настройки и группа
- `user_stats` — статистика для достижений + streak
- `user_achievements` — полученные достижения
- `user_vk_tokens` — VK токены для музыки
- `user_blocks` — заблокированные пользователи
- `web_sessions` — веб-сессии (QR авторизация)

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

**💬 Сообщения (2) — НОВОЕ:**
- `conversations` — чаты/диалоги
- `messages` — сообщения

**Уведомления (4):**
- `scheduled_notifications` — V2
- `notification_history` — история
- `sent_notifications` — отправленные
- `in_app_notifications` — внутренние

**Реферальная система (5) — расширено:**
- `referral_connections` — связи
- `referral_events` — события
- `admin_referral_links` — админ-ссылки (НОВОЕ)
- `referral_link_events` — события ссылок (НОВОЕ)
- `referral_rewards` — награды (НОВОЕ)

**📤 Совместное расписание (2) — НОВОЕ:**
- `shared_schedules` — совместные расписания
- `schedule_share_tokens` — токены для шаринга

**Кэш и медиа (5):**
- `schedule_cache` — кэш расписаний
- `cover_cache` — кэш обложек
- `music_favorites` — избранные треки
- `music_history` — история прослушиваний (НОВОЕ)
- `modal_images` — изображения модалов (НОВОЕ)

**Мониторинг и аналитика (5) — НОВОЕ:**
- `status_checks` — проверки статуса
- `lk_connections` — подключения ЛК
- `channel_stats_history` — история статистики канала
- `online_stats_history` — история онлайн-статистики
- `server_metrics_history` — история метрик сервера

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

# MongoDB коллекции
grep -oP 'db\.\K[a-zA-Z_]+' /app/backend/server.py | sort -u

# Pydantic модели
grep -c "^class " /app/backend/models.py

# Компоненты
ls /app/frontend/src/components/
ls /app/frontend/src/components/journal/
ls /app/frontend/src/components/music/
ls /app/frontend/src/services/
```

---

## ⚠️ КРИТИЧЕСКИЕ ПРАВИЛА

### ❌ НИКОГДА:
1. **НЕ использовать npm** — только `yarn`!
2. **НЕ хардкодить URLs/ports** — только через .env
3. **НЕ использовать MongoDB ObjectID** — только UUID
4. **НЕ забывать `/api/` префикс** для backend routes
5. **НЕ изменять .env файлы** без крайней необходимости

### ✅ ВСЕГДА:
1. Читать `AI_CONTEXT.md` перед началом работы
2. Проверять логи после изменений
3. Следовать существующим паттернам кода
4. Тестировать в Telegram Web App
5. Обновлять `requirements.txt` / `package.json`

---

## 🔧 ENVIRONMENT VARIABLES

### Backend (.env):
```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
CORS_ORIGINS="*"
ENV="test"  # или "production"

# Telegram
TELEGRAM_BOT_TOKEN=...        # Продакшн бот
TEST_TELEGRAM_BOT_TOKEN=...   # Тестовый бот

# Внешние API
WEATHER_API_KEY=...

# VK Music
VK_MUSIC_TOKEN=...
VK_USER_ID=...

# VK OAuth
VK_APP_ID=...
VK_CLIENT_SECRET=...
VK_REDIRECT_URI=...

# Безопасность
DB_CLEAR_PASSWORD=...
LK_ENCRYPTION_KEY=...
```

### Frontend (.env):
```env
VITE_ENABLE_VISUAL_EDITS=false
ENABLE_HEALTH_CHECK=false
REACT_APP_BACKEND_URL=...     # Автоматически определяется
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
| Новый UI компонент | `/components/NewComponent.jsx` |
| Новое достижение | `achievements.py` (ACHIEVEMENTS dict) |
| Логика уведомлений | `scheduler_v2.py` + `notifications.py` |
| Новая страница | `App.jsx` + новый компонент |
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

---

## 📚 ДОПОЛНИТЕЛЬНАЯ ДОКУМЕНТАЦИЯ

| Файл | Описание |
|------|----------|
| `PROJECT_DETAILS.md` | Полная техническая документация |
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

---

## 🆕 НОВЫЕ ФУНКЦИИ (не в старых доках)

### 1. 💬 Система сообщений
Полноценная система чатов между друзьями с поддержкой:
- Текстовые сообщения, пересылка, редактирование
- Реакции на сообщения
- Закрепление сообщений
- Отправка музыки и расписания
- Создание задач из сообщений
- Индикатор набора текста
- **Файлы:** `ChatModal.jsx`, `ConversationsListModal.jsx`, `messagesAPI.js`

### 2. 📤 Совместное расписание
Шаринг расписания с друзьями:
- Создание совместного расписания
- Добавление/удаление участников
- Генерация токенов для приглашения
- **Файлы:** `ShareScheduleModal.jsx`, `SharedScheduleView.jsx`

### 3. 🔥 Streak-система
Ежедневные серии посещений с наградами:
- Трекинг визитов
- Автоматический подсчет серий
- Награды за 7-дневные серии
- **Файлы:** `StreakRewardModal.jsx`

### 4. 🖥 Desktop Sidebar
Адаптивный интерфейс для десктопа:
- Боковая панель навигации
- **Файлы:** `DesktopSidebar.jsx`

### 5. 🛡 Расширенная админ-панель (31 endpoint)
- Статистика сервера в реальном времени
- История онлайн-пользователей
- Статистика канала Telegram
- Управление реферальными ссылками
- Модальные изображения
- Парсинг уведомлений из Telegram

---

**Этот файл содержит ВСЁ необходимое для быстрого старта разработки ИИ-агентами с минимальным потреблением токенов.**
