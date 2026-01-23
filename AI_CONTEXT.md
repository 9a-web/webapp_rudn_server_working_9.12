# AI CONTEXT - RUDN Schedule Telegram Web App

**Обновлено:** 2025-07-16 | **Статус:** Полностью актуализирован | **ENV:** test ✅

---

## МЕТА-ИНФОРМАЦИЯ

**Тип:** Telegram Web App для студентов РУДН  
**Стек:** FastAPI (Python) + React 19 + MongoDB + Telegram Bot API  
**Основные функции:**
- Расписание пар (интеграция с API РУДН)
- Задачи (личные + групповые в комнатах)
- Планировщик событий (синхронизация с расписанием)
- Журнал посещений (для преподавателей)
- VK Music интеграция (стриминг, плейлисты)
- Друзья (социальная система с QR-кодами)
- Достижения (24 ачивки + геймификация)
- Аналитика и статистика
- Погода
- Уведомления V2 (±10 сек точность)
- Личный кабинет РУДН (ЛК)
- Реферальная система (3 уровня)

---

## 📊 СТАТИСТИКА (актуально на 2025-07-16)

| Метрика | Значение |
|---------|----------|
| Backend Python файлов | 24 |
| Backend LOC | ~22,250 |
| Frontend компонентов | 86 (74 основных + 14 journal + 12 music) |
| API endpoints | **173** |
| MongoDB коллекций | **30** |
| Достижений | 24 |
| Языков (i18n) | 2 (RU/EN) |
| Services (API клиенты) | 8 |
| Utils | 8 |
| Contexts | 3 (Telegram, Theme, Player) |

---

## БЫСТРАЯ НАВИГАЦИЯ

### Backend (/app/backend/)

| Файл | LOC | Описание |
|------|-----|----------|
| `server.py` | **10,432** | ВСЕ API endpoints (173) |
| `models.py` | 1,959 | Pydantic схемы |
| `telegram_bot.py` | 1,204 | Telegram Bot логика |
| `achievements.py` | 733 | 24 достижения |
| `scheduler_v2.py` | 828 | Планировщик уведомлений V2 |
| `scheduler.py` | 383 | ⚠️ Старый планировщик (резерв) |
| `lk_parser.py` | 380 | **Парсинг ЛК РУДН** |
| `vk_auth_service.py` | 350 | **VK Music авторизация** |
| `music_service.py` | 333 | **VK Music сервис** |
| `rudn_parser.py` | 311 | Парсинг API РУДН |
| `cover_service.py` | 270 | Обложки треков |
| `notifications.py` | 165 | Рассылка через Bot API |
| `weather.py` | 118 | OpenWeatherMap API |
| `config.py` | 93 | Конфигурация ENV |
| `cache.py` | - | Кэширование данных |

### Frontend (/app/frontend/src/)

| Директория/Файл | Количество | Описание |
|-----------------|------------|----------|
| `App.jsx` | 1 | Роутинг, главный компонент (~45KB) |
| `components/` | 74 | React компоненты (основные) |
| `components/journal/` | 14 | Компоненты журнала посещений |
| `components/music/` | 12 | **VK Music компоненты** |
| `services/` | 8 | API клиенты |
| `contexts/` | 3 | Telegram, Theme, **Player** |
| `hooks/` | 1 | useRipple.js |
| `i18n/locales/` | 2 | Локализация (ru.json, en.json) |
| `utils/` | 8 | Утилиты |
| `constants/` | 1 | roomColors.js |

### Документация (в /app/)

| Файл | Описание |
|------|----------|
| `AI_CONTEXT.md` | **Этот файл** - краткий обзор для ИИ |
| `PROJECT_DETAILS.md` | Полная техническая документация |
| `README.md` | Инструкции по запуску |
| `NOTIFICATION_SYSTEM_V2.md` | Система уведомлений V2 |
| `PLANNER_EVENTS_DOCS.md` | Планировщик событий |
| `VK_MUSIC_INTEGRATION_PLAN.md` | VK Music интеграция |
| `ROOMS_DOCUMENTATION_INDEX.md` | Документация комнат |

---

## АРХИТЕКТУРА

```
Telegram Bot (@rudn_pro_bot / @test_rudn_bot)
  ↓ /start → добавляет user в БД
  ↓ кнопка "Открыть расписание" → открывает Web App
  
React Frontend (port 3000 internal)
  ↓ HTTP REST API (/api/*)
  
FastAPI Backend (port 8001 internal)
  ↓ MongoDB queries
  ↓ Proxy к API РУДН
  ↓ VK Music API
  ↓ OpenWeatherMap API
  ↓ Telegram Bot API (уведомления)
  
MongoDB (local)
  - 30 коллекций (см. раздел СХЕМЫ БД)
```

**Важно:**
- Frontend → Backend: через `REACT_APP_BACKEND_URL` или автоопределение домена
- Backend → MongoDB: через `MONGO_URL` (из .env)
- ВСЕ backend routes начинаются с `/api/` (Kubernetes ingress правило)
- Никогда не хардкодить URLs/ports!

---

## API ENDPOINTS (173) - ГРУППИРОВКА

### 1. Расписание РУДН (6 endpoints)
```
GET  /api/                         - root
GET  /api/faculties                - список факультетов
POST /api/filter-data              - фильтры (курс, уровень, группы)
POST /api/schedule                 - расписание группы
GET  /api/schedule-cached/{group_id}/{week_number}
POST /api/status                   - статус проверка
GET  /api/status                   - история статусов
```

### 2. Пользователи (15 endpoints)
```
GET    /api/user-settings/{telegram_id}
POST   /api/user-settings
DELETE /api/user-settings/{telegram_id}
DELETE /api/user/{telegram_id}
GET    /api/user-settings/{telegram_id}/notifications
PUT    /api/user-settings/{telegram_id}/notifications
GET    /api/user-settings/{telegram_id}/theme
PUT    /api/user-settings/{telegram_id}/theme
GET    /api/user-settings/{telegram_id}/history
GET    /api/user-profile-photo/{telegram_id}
GET    /api/user-profile-photo-proxy/{telegram_id}
GET    /api/profile/{telegram_id}
GET    /api/profile/{telegram_id}/schedule
GET    /api/profile/{telegram_id}/privacy
PUT    /api/profile/{telegram_id}/privacy
GET    /api/profile/{telegram_id}/qr
```

### 3. Планировщик событий (5 endpoints)
```
POST /api/planner/sync             - синхронизация с расписанием
POST /api/planner/preview          - предпросмотр синхронизации
POST /api/planner/sync-selected    - выборочная синхронизация
POST /api/planner/events           - создание события
GET  /api/planner/{telegram_id}/{date} - события на день
```

### 4. Личные задачи (9 endpoints)
```
GET    /api/tasks/{telegram_id}
POST   /api/tasks
PUT    /api/tasks/reorder
PUT    /api/tasks/{task_id}
DELETE /api/tasks/{task_id}
POST   /api/tasks/{task_id}/subtasks
PUT    /api/tasks/{task_id}/subtasks/{subtask_id}
DELETE /api/tasks/{task_id}/subtasks/{subtask_id}
GET    /api/tasks/{telegram_id}/productivity-stats
```

### 5. Комнаты (12 endpoints)
```
POST   /api/rooms
GET    /api/rooms/{telegram_id}
GET    /api/rooms/detail/{room_id}
POST   /api/rooms/{room_id}/invite-link
POST   /api/rooms/join/{invite_token}
DELETE /api/rooms/{room_id}/leave
DELETE /api/rooms/{room_id}
PUT    /api/rooms/{room_id}
PUT    /api/rooms/{room_id}/participant-role
GET    /api/rooms/{room_id}/tasks
GET    /api/rooms/{room_id}/activity
GET    /api/rooms/{room_id}/stats
PUT    /api/rooms/{room_id}/tasks-reorder
```

### 6. Групповые задачи (16 endpoints)
```
POST   /api/rooms/{room_id}/tasks
POST   /api/group-tasks
GET    /api/group-tasks/{telegram_id}
GET    /api/group-tasks/detail/{task_id}
POST   /api/group-tasks/{task_id}/invite
GET    /api/group-tasks/invites/{telegram_id}
POST   /api/group-tasks/{task_id}/accept
POST   /api/group-tasks/{task_id}/decline
PUT    /api/group-tasks/{task_id}/update
PUT    /api/group-tasks/{task_id}/complete
DELETE /api/group-tasks/{task_id}/leave
DELETE /api/group-tasks/{task_id}
POST   /api/group-tasks/{task_id}/subtasks
PUT    /api/group-tasks/{task_id}/subtasks/{subtask_id}
DELETE /api/group-tasks/{task_id}/subtasks/{subtask_id}
POST   /api/group-tasks/{task_id}/comments
GET    /api/group-tasks/{task_id}/comments
```

### 7. Журнал посещений (23 endpoints)
```
POST   /api/journals
GET    /api/journals/{telegram_id}
GET    /api/journals/detail/{journal_id}
PUT    /api/journals/{journal_id}
DELETE /api/journals/{journal_id}
POST   /api/journals/{journal_id}/invite-link
POST   /api/journals/join/{invite_token}
POST   /api/journals/join-student/{invite_code}
POST   /api/journals/process-webapp-invite
# Студенты
POST   /api/journals/{journal_id}/students
POST   /api/journals/{journal_id}/students/bulk
GET    /api/journals/{journal_id}/students
PUT    /api/journals/{journal_id}/students/{student_id}
DELETE /api/journals/{journal_id}/students/{student_id}
POST   /api/journals/{journal_id}/students/{student_id}/link
POST   /api/journals/{journal_id}/students/{student_id}/unlink
GET    /api/journals/{journal_id}/pending-members
# Предметы
POST   /api/journals/{journal_id}/subjects
GET    /api/journals/{journal_id}/subjects
GET    /api/journals/subjects/{subject_id}
PUT    /api/journals/subjects/{subject_id}
GET    /api/journals/subjects/{subject_id}/attendance-stats
DELETE /api/journals/subjects/{subject_id}
# Занятия
POST   /api/journals/{journal_id}/sessions
GET    /api/journals/{journal_id}/sessions
PUT    /api/journals/sessions/{session_id}
DELETE /api/journals/sessions/{session_id}
POST   /api/journals/{journal_id}/sessions/from-schedule
POST   /api/journals/sessions/{session_id}/attendance
GET    /api/journals/sessions/{session_id}/attendance
GET    /api/journals/{journal_id}/my-attendance/{telegram_id}
GET    /api/journals/{journal_id}/stats
```

### 8. VK Music (20 endpoints)
```
GET    /api/music/search
GET    /api/music/stream/{track_id}
GET    /api/music/redirect/{track_id}
GET    /api/music/my
GET    /api/music/popular
GET    /api/music/playlists
GET    /api/music/playlists-vk/{telegram_id}
GET    /api/music/playlist/{owner_id}/{playlist_id}
GET    /api/music/playlist-vk/{telegram_id}/{owner_id}/{playlist_id}
GET    /api/music/artist/{artist_name}
GET    /api/music/favorites/{telegram_id}
POST   /api/music/favorites/{telegram_id}
DELETE /api/music/favorites/{telegram_id}/{track_id}
GET    /api/music/auth/config
GET    /api/music/vk-callback
POST   /api/music/auth/{telegram_id}
GET    /api/music/auth/status/{telegram_id}
DELETE /api/music/auth/{telegram_id}
GET    /api/music/my-vk/{telegram_id}
```

### 9. Друзья (15 endpoints)
```
POST   /api/friends/request/{target_telegram_id}
POST   /api/friends/accept/{request_id}
POST   /api/friends/reject/{request_id}
POST   /api/friends/cancel/{request_id}
DELETE /api/friends/{friend_telegram_id}
POST   /api/friends/block/{target_telegram_id}
DELETE /api/friends/block/{target_telegram_id}
POST   /api/friends/{friend_telegram_id}/favorite
GET    /api/friends/search
GET    /api/friends/{telegram_id}
GET    /api/friends/{telegram_id}/requests
GET    /api/friends/mutual/{telegram_id}/{other_telegram_id}
GET    /api/friends/{telegram_id}/blocked
POST   /api/friends/process-invite
```

### 10. In-App уведомления (8 endpoints)
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

### 11. Достижения и статистика (5 endpoints)
```
GET  /api/achievements
GET  /api/user-achievements/{telegram_id}
GET  /api/user-stats/{telegram_id}
POST /api/track-action
POST /api/user-achievements/{telegram_id}/mark-seen
```

### 12. Реферальная система (4 endpoints)
```
GET  /api/referral/code/{telegram_id}
POST /api/referral/process-webapp
GET  /api/referral/stats/{telegram_id}
GET  /api/referral/tree/{telegram_id}
```

### 13. Личный кабинет РУДН (4 endpoints)
```
POST   /api/lk/connect
GET    /api/lk/data/{telegram_id}
GET    /api/lk/status/{telegram_id}
DELETE /api/lk/disconnect/{telegram_id}
```

### 14. Админ статистика (12 endpoints)
```
GET /api/admin/stats
GET /api/admin/referral-stats
GET /api/admin/users-activity
GET /api/admin/hourly-activity
GET /api/admin/weekly-activity
GET /api/admin/feature-usage
GET /api/admin/top-users
GET /api/admin/faculty-stats
GET /api/admin/course-stats
GET /api/admin/users
GET /api/admin/journals
```

### 15. Бэкапы и экспорт (3 endpoints)
```
GET /api/export/database
GET /api/export/collection/{collection_name}
GET /api/backup/stats
```

### 16. Прочее (5 endpoints)
```
GET  /api/weather
GET  /api/bot-info
GET  /api/youtube/info
GET  /api/notifications/stats
POST /api/notifications/test
```

---

## СХЕМЫ БД (MongoDB Collections - 30)

### Пользователи
- `user_settings` - настройки и выбранная группа
- `user_stats` - статистика для достижений
- `user_achievements` - полученные достижения
- `user_vk_tokens` - VK токены для музыки
- `user_blocks` - заблокированные пользователи

### Задачи
- `tasks` - личные задачи
- `group_tasks` - групповые задачи
- `group_task_comments` - комментарии к задачам
- `group_task_invites` - приглашения в задачи

### Комнаты
- `rooms` - комнаты для групповой работы (участники встроены)
- `room_activities` - история активности

### Журнал посещений
- `attendance_journals` / `journals`
- `journal_students`
- `journal_subjects`
- `journal_sessions`
- `attendance_records`
- `journal_pending_members`

### Друзья
- `friends` - связи друзей
- `friend_requests` - запросы в друзья

### Уведомления
- `scheduled_notifications` - запланированные (V2)
- `notification_history` - история отправок
- `sent_notifications` - отправленные
- `in_app_notifications` - внутренние уведомления

### Реферальная система
- `referral_connections` - связи рефералов
- `referral_events` - события переходов

### Кэш и прочее
- `schedule_cache` - кэш расписаний
- `cover_cache` - кэш обложек треков
- `music_favorites` - избранные треки
- `status_checks` - проверки статуса

---

## КРИТИЧЕСКИЕ ПРАВИЛА

### ❌ НИКОГДА НЕ ДЕЛАТЬ:
1. Хардкодить URLs/ports в коде (использовать .env переменные)
2. Использовать `npm` для frontend (только `yarn`!)
3. Использовать MongoDB ObjectID (только UUID!)
4. Забывать префикс `/api/` для backend routes
5. Изменять .env файлы без крайней необходимости
6. Модифицировать URL variables: `REACT_APP_BACKEND_URL`, `MONGO_URL`

### ✅ ВСЕГДА ДЕЛАТЬ:
1. Проверять логи после изменений
2. Использовать hot reload (работает для большинства изменений)
3. Следовать существующим паттернам кода
4. Тестировать в Telegram Web App (не в обычном браузере)
5. Читать AI_CONTEXT.md перед началом работы
6. Добавлять новые зависимости в requirements.txt / package.json

---

## Environment Variables

### Backend .env:
```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
CORS_ORIGINS="*"

# Environment: "test" или "production"
ENV="test"

# Токены Telegram ботов
TELEGRAM_BOT_TOKEN=...           # Продакшн бот
TEST_TELEGRAM_BOT_TOKEN=...      # Тестовый бот

WEATHER_API_KEY=...
DB_CLEAR_PASSWORD=...

# VK Music (опционально)
VK_SERVICE_TOKEN=...
```

**Переключение между ботами:**
- `ENV=test` → используется `TEST_TELEGRAM_BOT_TOKEN`
- `ENV=production` → используется `TELEGRAM_BOT_TOKEN`

### Frontend .env:
```env
VITE_ENABLE_VISUAL_EDITS=false
ENABLE_HEALTH_CHECK=false
# REACT_APP_BACKEND_URL определяется автоматически в api.js
```

---

## FRONTEND КОМПОНЕНТЫ (86 всего)

### Главные (74 в components/)
**Экраны:** App.jsx, GroupSelector.jsx, WelcomeScreen.jsx

**Навигация:** Header.jsx, BottomNavigation.jsx, DesktopSidebar.jsx, MenuModal.jsx

**Расписание:** LiveScheduleCard, LiveScheduleCarousel, LiveScheduleSection, WeekDaySelector, WeekDateSelector, CalendarModal, PrepareForLectureModal, ShareScheduleModal

**Планировщик:** PlannerTimeline.jsx, PlannerEventCard.jsx, CreateEventModal.jsx, EditEventModal.jsx, SyncPreviewModal.jsx

**Задачи:** TasksSection.jsx, AddTaskModal, EditTaskModal, TaskDetailModal, SubtasksList, ProductivityStats

**Комнаты:** RoomCard, RoomDetailModal, CreateRoomModal, AddRoomTaskModal, EditRoomTaskModal, CreateGroupTaskModal, GroupTaskCard, GroupTaskDetailModal, RoomParticipantsList, RoomStatsPanel, RoomActivityFeed

**Друзья:** FriendsSection.jsx, FriendCard.jsx, FriendProfileModal.jsx, FriendSearchModal.jsx, SelectFriendsModal.jsx

**Профиль:** ProfileModal, AnalyticsModal, AchievementsModal, AchievementNotification, NotificationSettings, NotificationSettingsPanel, NotificationHistory, NotificationQueue, NotificationsPanel, ReferralTree, PrivacySettingsModal, LKConnectionModal

**UI:** SkeletonCard, LoadingScreen, SwipeHint, TagsInput, TopGlow, GreetingNotification, UpcomingClassNotification, RippleEffect, WeatherWidget, DeleteConfirmModal, YouTubePreview

**Темы:** NewYearTheme.jsx, NewYearTheme.css, SnowfallBackground.jsx

**Админка:** AdminPanel.jsx

### Журнал посещений (14 в components/journal/)
- JournalSection.jsx (в components/)
- JournalCard.jsx, JournalDetailModal.jsx
- CreateJournalModal.jsx, CreateSessionModal.jsx, CreateSubjectModal.jsx
- SubjectDetailModal.jsx, SubjectAttendanceModal.jsx, AttendanceModal.jsx
- AddStudentsModal.jsx, EditStudentModal.jsx, LinkStudentModal.jsx
- JournalStatsTab.jsx, MyAttendanceStats.jsx, index.js

### VK Music (12 в components/music/)
- MusicSection.jsx (главный)
- MusicSearch.jsx
- TrackCard.jsx, TrackCover.jsx, TrackList.jsx
- ArtistCard.jsx, PlaylistCard.jsx
- MiniPlayer.jsx, FullscreenPlayer.jsx
- VKAuthModal.jsx
- PlayerContext.jsx (контекст плеера)
- index.js

### Services (8 API клиентов)
- api.js (20KB) - основной API клиент
- roomsAPI.js - комнаты
- groupTasksAPI.js - групповые задачи
- journalAPI.js - журнал посещений
- musicAPI.js - VK Music
- friendsAPI.js - друзья
- notificationsAPI.js - уведомления
- referralAPI.js - реферальная система

### Utils (8 файлов)
- analytics.js - аналитика расписания
- animations.js - Framer Motion presets
- confetti.js - конфетти для достижений
- dateUtils.js - работа с датами
- gestures.js - жесты свайпов
- pluralize.js - склонение слов
- scheduleUtils.js - утилиты расписания
- textUtils.js - работа с текстом

---

## БЫСТРЫЕ КОМАНДЫ

### Управление сервисами
```bash
# Перезапуск
sudo supervisorctl restart all
sudo supervisorctl restart backend
sudo supervisorctl restart frontend

# Статус
sudo supervisorctl status

# Логи
tail -f /var/log/supervisor/backend.*.log
tail -f /var/log/supervisor/frontend.*.log
tail -50 /var/log/supervisor/backend.err.log | grep -i error
```

### Установка зависимостей
```bash
# Backend
cd /app/backend
pip install PACKAGE && echo "PACKAGE" >> requirements.txt

# Frontend (ТОЛЬКО yarn!)
cd /app/frontend
yarn add PACKAGE
```

### Навигация по проекту
```bash
# Backend файлы
ls -la /app/backend/*.py

# Frontend компоненты
ls -la /app/frontend/src/components/
ls -la /app/frontend/src/components/journal/
ls -la /app/frontend/src/components/music/

# API endpoints (173)
grep -c "@api_router\." /app/backend/server.py

# MongoDB коллекции (30)
grep -oP 'db\.\K[a-zA-Z_]+' /app/backend/server.py | sort -u
```

---

## ТИПИЧНЫЕ ЗАДАЧИ

| Задача | Файлы |
|--------|-------|
| Новый API endpoint | `/app/backend/server.py` + `models.py` |
| Новый UI компонент | `/app/frontend/src/components/NewComponent.jsx` |
| Новое достижение | `/app/backend/achievements.py` (массив ACHIEVEMENTS) |
| Логика уведомлений V2 | `/app/backend/scheduler_v2.py` + `notifications.py` |
| Новая страница | `/app/frontend/src/App.jsx` + новый компонент |
| Схема БД | `/app/backend/models.py` (Pydantic) |
| Перевод | `/app/frontend/src/i18n/locales/ru.json` и `en.json` |
| Стили | Компонент (Tailwind) или `/app/frontend/src/index.css` |
| Журнал посещений | `/app/frontend/src/components/journal/` |
| Планировщик | `/app/frontend/src/components/Planner*.jsx` |
| VK Music | `/app/frontend/src/components/music/` + `musicAPI.js` |
| Друзья | `/app/frontend/src/components/Friend*.jsx` + `friendsAPI.js` |

---

## КЛЮЧЕВЫЕ ЗАВИСИМОСТИ

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

## ВАЖНЫЕ ОСОБЕННОСТИ

### 1. Telegram Web App Integration
- `window.Telegram.WebApp` API
- Haptic Feedback на всех кнопках
- MainButton/BackButton для навигации
- initDataUnsafe для получения telegram_id

### 2. VK Music Integration
- Авторизация через логин/пароль VK
- Стриминг треков через прокси
- Персональные плейлисты
- Поиск треков и исполнителей
- Избранные треки

### 3. Система друзей
- Отправка/принятие запросов в друзья
- Блокировка пользователей
- Взаимные друзья
- QR-коды для добавления
- Просмотр расписания друзей (с учётом приватности)

### 4. Уведомления V2
- **Точность:** ±10 секунд
- **Трехуровневая архитектура:**
  - Daily Planner (06:00) - подготовка
  - Notification Executor - отправка
  - Retry Handler (2 мин) - повтор
- **Retry:** 3 попытки (1, 3, 5 минут)

### 5. Журнал посещений
- Преподаватели создают журналы
- Студенты присоединяются по ссылке
- Привязка telegram к записям
- Статистика посещаемости

---

## ТЕКУЩЕЕ ОКРУЖЕНИЕ

- **ENV:** `test` (TEST_TELEGRAM_BOT_TOKEN)
- **DB_NAME:** `test_database`
- **Backend:** port 8001
- **Frontend:** port 3000
- **Статус:** Требуется `sudo supervisorctl restart all`

---

**Этот файл содержит ВСЁ необходимое для быстрого старта разработки ИИ-сервисом с минимальным потреблением токенов.**
