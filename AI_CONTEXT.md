# AI CONTEXT - RUDN Schedule Telegram Web App

**Обновлено:** 2025-07-06 | **Статус:** Актуализирован для ИИ | **ENV:** test ✅

---

## МЕТА-ИНФОРМАЦИЯ

**Тип:** Telegram Web App для студентов РУДН  
**Стек:** FastAPI (Python) + React 19 + MongoDB + Telegram Bot API  
**Функции:** Расписание пар, задачи (личные + групповые), планировщик событий, достижения, аналитика, погода, уведомления V2, журнал посещений  
**Особенность:** Интеграция с API РУДН, геймификация, реферальная система

---

## БЫСТРАЯ НАВИГАЦИЯ

### Backend (/app/backend/)
| Файл | LOC | Описание |
|------|-----|----------|
| `server.py` | 6928 | ВСЕ API endpoints (117) |
| `models.py` | 1393 | Pydantic схемы |
| `telegram_bot.py` | 1204 | Telegram Bot логика |
| `achievements.py` | 632 | 24 достижения |
| `scheduler_v2.py` | 828 | **Планировщик уведомлений V2** |
| `scheduler.py` | 383 | ⚠️ Старый планировщик (резерв) |
| `rudn_parser.py` | 311 | Парсинг API РУДН |
| `notifications.py` | 165 | Рассылка через Bot API |
| `weather.py` | 118 | OpenWeatherMap API |
| `config.py` | - | Конфигурация ENV/токенов |
| `cache.py` | - | Кэширование данных |

### Frontend (/app/frontend/src/)
| Директория/Файл | Количество | Описание |
|-----------------|------------|----------|
| `App.jsx` | 1 | Роутинг, главный компонент (43KB) |
| `components/` | 55 | React компоненты (основные) |
| `components/journal/` | 12 | Компоненты журнала посещений |
| `services/` | 5 | api.js, roomsAPI.js, groupTasksAPI.js, journalAPI.js, referralAPI.js |
| `contexts/` | 2 | TelegramContext.jsx, ThemeContext.jsx |
| `hooks/` | 1 | useRipple.js |
| `i18n/locales/` | 2 | Локализация (ru.json, en.json) |
| `utils/` | 7 | analytics, dateUtils, animations, confetti, gestures, pluralize, scheduleUtils |
| `constants/` | 1 | roomColors.js |

### Документация (в /app/)
| Файл | Описание |
|------|----------|
| `AI_CONTEXT.md` | **Этот файл** - краткий обзор для ИИ |
| `PROJECT_DETAILS.md` | Полная техническая документация (50KB) |
| `NOTIFICATION_SYSTEM_V2.md` | Документация системы уведомлений V2 |
| `PLANNER_EVENTS_DOCS.md` | Документация планировщика событий |
| `ROOMS_DOCUMENTATION_INDEX.md` | Индекс документации комнат |
| `README.md` | Инструкции по запуску |

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
  ↓ OpenWeatherMap API
  ↓ Telegram Bot API (уведомления)
  
MongoDB (local)
  - 23 коллекции (см. раздел СХЕМЫ БД)
```

**Важно:**
- Frontend → Backend: через `REACT_APP_BACKEND_URL` или автоопределение домена
- Backend → MongoDB: через `MONGO_URL` (из .env)
- ВСЕ backend routes начинаются с `/api/` (Kubernetes ingress правило)
- Никогда не хардкодить URLs/ports!

---

## API ENDPOINTS (117)

### Расписание РУДН
```
GET  /api/faculties           - список факультетов
POST /api/filter-data         - фильтры (курс, уровень, группы)
POST /api/schedule            - расписание группы
GET  /api/schedule-cached/{group_id}/{week_number} - кэшированное расписание
```

### Планировщик событий (NEW!)
```
POST /api/planner/sync        - синхронизация событий с расписанием
POST /api/planner/events      - создание события планировщика
GET  /api/planner/{telegram_id}/{date} - события на день
```

### Пользователи
```
POST /api/user-settings                         - сохранить группу
GET  /api/user-settings/{telegram_id}           - получить настройки
DELETE /api/user-settings/{telegram_id}         - удалить настройки
DELETE /api/user/{telegram_id}                  - удалить аккаунт полностью
GET  /api/user-settings/{telegram_id}/notifications
PUT  /api/user-settings/{telegram_id}/notifications
GET  /api/user-settings/{telegram_id}/history   - история уведомлений
GET  /api/user-profile-photo/{telegram_id}      - фото профиля
GET  /api/user-profile-photo-proxy/{telegram_id}
```

### Статистика и достижения
```
GET  /api/achievements                    - все 24 достижения
GET  /api/user-stats/{telegram_id}        - статистика
GET  /api/user-achievements/{telegram_id} - полученные ачивки
POST /api/track-action                    - трекинг действий
POST /api/user-achievements/{telegram_id}/mark-seen
```

### Личные задачи
```
GET    /api/tasks/{telegram_id}           - все задачи юзера
POST   /api/tasks                         - создать
PUT    /api/tasks/{task_id}               - обновить
DELETE /api/tasks/{task_id}               - удалить
PUT    /api/tasks/reorder                 - изменить порядок
GET    /api/tasks/{telegram_id}/productivity-stats - статистика продуктивности
```

### Комнаты (групповая работа)
```
POST   /api/rooms                         - создать комнату
GET    /api/rooms/{telegram_id}           - список комнат юзера
GET    /api/rooms/detail/{room_id}        - детали комнаты
POST   /api/rooms/{room_id}/invite-link   - сгенерировать ссылку
POST   /api/rooms/join/{invite_token}     - присоединиться
DELETE /api/rooms/{room_id}/leave         - выйти
DELETE /api/rooms/{room_id}               - удалить (owner only)
PUT    /api/rooms/{room_id}               - обновить
PUT    /api/rooms/{room_id}/participant-role - изменить роль
GET    /api/rooms/{room_id}/activity      - активность
GET    /api/rooms/{room_id}/stats         - статистика
PUT    /api/rooms/{room_id}/tasks-reorder - порядок задач
```

### Групповые задачи (в комнатах)
```
POST   /api/rooms/{room_id}/tasks         - создать задачу в комнате
GET    /api/rooms/{room_id}/tasks         - список задач комнаты
PUT    /api/group-tasks/{task_id}/update  - обновить
DELETE /api/group-tasks/{task_id}         - удалить
PUT    /api/group-tasks/{task_id}/complete - завершить
POST   /api/group-tasks/{task_id}/subtasks - добавить подзадачу
PUT    /api/group-tasks/{task_id}/subtasks/{subtask_id}
DELETE /api/group-tasks/{task_id}/subtasks/{subtask_id}
POST   /api/group-tasks/{task_id}/comments
GET    /api/group-tasks/{task_id}/comments
```

### Журнал посещений
```
POST   /api/journals                      - создать журнал
GET    /api/journals/{telegram_id}        - список журналов
GET    /api/journals/detail/{journal_id}  - детали журнала
PUT    /api/journals/{journal_id}         - обновить
DELETE /api/journals/{journal_id}         - удалить
POST   /api/journals/{journal_id}/invite-link - ссылка приглашения
POST   /api/journals/join/{invite_token}  - присоединиться по ссылке
POST   /api/journals/join-student/{invite_code} - присоединиться как студент
POST   /api/journals/process-webapp-invite - обработка webapp ссылки
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
DELETE /api/journals/subjects/{subject_id}
# Занятия и посещаемость
POST   /api/journals/{journal_id}/sessions
GET    /api/journals/{journal_id}/sessions
PUT    /api/journals/sessions/{session_id}
DELETE /api/journals/sessions/{session_id}
POST   /api/journals/sessions/{session_id}/attendance
GET    /api/journals/sessions/{session_id}/attendance
GET    /api/journals/{journal_id}/stats   - статистика посещаемости
GET    /api/journals/{journal_id}/my-attendance - моя посещаемость
```

### Реферальная система
```
GET  /api/referral/code/{telegram_id}     - получить реф. код
POST /api/referral/process-webapp         - обработка реф. ссылки
GET  /api/referral/stats/{telegram_id}    - статистика рефералов
GET  /api/referral/tree/{telegram_id}     - дерево рефералов
```

### Админ статистика
```
GET /api/admin/stats            - общая статистика (users, tasks, rooms, referrals)
GET /api/admin/referral-stats   - детальная статистика реферальных переходов
GET /api/admin/users-activity   - активность пользователей
GET /api/admin/hourly-activity  - активность по часам
GET /api/admin/weekly-activity  - недельная активность
GET /api/admin/feature-usage    - использование функций
GET /api/admin/top-users        - топ пользователей
GET /api/admin/faculty-stats    - статистика по факультетам
GET /api/admin/course-stats     - статистика по курсам
```

### VK Music Авторизация (NEW!)
```
POST   /api/music/auth/{telegram_id}        - авторизация VK (login/password)
GET    /api/music/auth/status/{telegram_id} - статус подключения VK
DELETE /api/music/auth/{telegram_id}        - отключение VK аккаунта
GET    /api/music/my-vk/{telegram_id}       - аудиозаписи с персональным токеном
```

### Бэкапы и экспорт
```
GET /api/export/database        - экспорт всей БД
GET /api/export/collection/{collection_name}
GET /api/backup/stats           - статистика бэкапов
```

### Прочее
```
GET  /api/weather               - погода в Москве
GET  /api/bot-info              - инфо о боте
GET  /api/notifications/stats   - статистика уведомлений
POST /api/notifications/test    - тестовое уведомление
GET  /api/health                - health check
```

---

## СХЕМЫ БД (MongoDB Collections - 23)

### Основные коллекции

**user_settings**
```python
id: UUID, telegram_id: int, username, first_name, last_name
group_id, group_name, facultet_id, facultet_name, level_id, kurs, form_code
notifications_enabled: bool, notification_time: int
referral_code: str, referred_by: int, invited_count: int
created_at: datetime, last_activity: datetime
```

**user_stats**
```python
telegram_id: int (unique)
groups_viewed, friends_invited, schedule_views, night_usage_count, early_usage_count
total_points, achievements_count, analytics_views, calendar_opens
notifications_configured, schedule_shares, menu_items_visited, active_days
```

**user_achievements**
```python
telegram_id: int, achievement_id: str, earned_at: datetime, seen: bool
```

### Задачи

**tasks** (личные задачи)
```python
id: UUID, telegram_id: int, text: str, completed: bool
category: str ('учеба'|'личное'|'спорт'|'проекты')
priority: str ('high'|'medium'|'low')
deadline: datetime?, target_date: datetime?, notes: str, tags: [str], order: int
created_at: datetime, updated_at: datetime, completed_at: datetime?
```

**group_tasks** (групповые задачи)
```python
id: UUID, room_id: UUID, text: str, description: str, completed: bool
priority: str, deadline: datetime?, created_by: int, assigned_to: [int]
category: str, tags: [str], order: int
subtasks: [Subtask], comments_count: int
created_at: datetime, updated_at: datetime
completed_by: int?, completed_at: datetime?
```

**group_task_comments**, **group_task_invites**

### Комнаты

**rooms**
```python
id: UUID, name: str, color: str, emoji: str, description: str, owner_id: int
participants: [{telegram_id, role, joined_at}]  # встроенные участники
invite_token: str, created_at: datetime
total_participants: int, total_tasks: int, completed_tasks: int
```

**room_activities**
```python
id: UUID, room_id: UUID, action_type: str, actor_id: int
details: dict, created_at: datetime
```

### Журнал посещений

**attendance_journals**
```python
id: UUID, name: str, owner_id: int, group_name: str
invite_token: str?, student_invite_code: str?
allow_self_join: bool, show_attendance_stats: bool
stats_viewers: [int]  # telegram_ids с доступом к статистике
created_at: datetime
```

**journal_students**
```python
id: UUID, journal_id: UUID, full_name: str
linked_telegram_id: int?, invite_link: str?
created_at: datetime
```

**journal_subjects**
```python
id: UUID, journal_id: UUID, name: str, teacher: str?
color: str?, hours_per_week: int?
created_at: datetime
```

**journal_sessions** (занятия)
```python
id: UUID, journal_id: UUID, subject_id: UUID
date: str, time_start: str, time_end: str
auditory: str?, type: str ('lecture'|'practice'|'lab')
topic: str?, notes: str?, teacher: str?
created_at: datetime
```

**attendance_records** (посещаемость)
```python
id: UUID, session_id: UUID, student_id: UUID
status: str ('present'|'absent'|'late'|'excused')
comment: str?, marked_by: int?, marked_at: datetime?
```

**journal_pending_members**

### Уведомления и история

**scheduled_notifications** (V2)
```python
id: UUID, notification_key: str (unique), telegram_id: int, date: str
class_info: {discipline, time, teacher, auditory, lessonType}
scheduled_time: datetime, notification_time_minutes: int
status: str ('pending'|'sent'|'failed'|'cancelled')
attempts: int, last_attempt_at: datetime?, error_message: str?
created_at: datetime, sent_at: datetime?
```

**notification_history**, **sent_notifications**

### Реферальная система

**referral_connections**
```python
telegram_id: int, referrer_id: int, level: int (1-3)
created_at: datetime
```

**referral_events**
```python
id: UUID, event_type: str ('room_join'|'journal_join')
telegram_id: int, referrer_id: int?, target_id: str, target_name: str
invite_token: str, is_new_member: bool, created_at: datetime
```

### VK Music Авторизация

**user_vk_tokens**
```python
telegram_id: int (unique), vk_user_id: int, vk_token: str
user_agent: str, audio_count: int
created_at: datetime, updated_at: datetime
```

### Кэш и прочее

**schedule_cache**, **status_checks**

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

### Environment Variables

**Backend .env:**
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
```

**Переключение между ботами:**
- `ENV=test` → используется `TEST_TELEGRAM_BOT_TOKEN`
- `ENV=production` → используется `TELEGRAM_BOT_TOKEN`

**Frontend .env:**
```env
VITE_ENABLE_VISUAL_EDITS=false
ENABLE_HEALTH_CHECK=false
# REACT_APP_BACKEND_URL определяется автоматически в api.js
```

---

## КОМПОНЕНТЫ FRONTEND (67 + 4 в src)

### Главные компоненты (55 в components/)
**Экраны:** App.jsx, GroupSelector.jsx, WelcomeScreen.jsx

**Навигация:** Header.jsx, BottomNavigation.jsx, DesktopSidebar.jsx, MenuModal.jsx

**Расписание:** LiveScheduleCard, LiveScheduleCarousel, LiveScheduleSection, WeekDaySelector, WeekDateSelector, CalendarModal, PrepareForLectureModal, ShareScheduleModal

**Планировщик:** PlannerTimeline.jsx, PlannerEventCard.jsx, CreateEventModal.jsx

**Задачи:** TasksSection.jsx (большой!), AddTaskModal, EditTaskModal, TaskDetailModal, SubtasksList, ProductivityStats

**Комнаты:** RoomCard, RoomDetailModal, CreateRoomModal, AddRoomTaskModal, EditRoomTaskModal, CreateGroupTaskModal, GroupTaskCard, GroupTaskDetailModal, RoomParticipantsList, RoomStatsPanel, RoomActivityFeed

**Профиль:** ProfileModal, AnalyticsModal, AchievementsModal, AchievementNotification, NotificationSettings, NotificationHistory, NotificationQueue, ReferralTree

**UI:** SkeletonCard, LoadingScreen, SwipeHint, TagsInput, TopGlow, GreetingNotification, UpcomingClassNotification, RippleEffect, WeatherWidget

**Темы:** NewYearTheme.jsx, NewYearTheme.css, SnowfallBackground.jsx

**Админка:** AdminPanel.jsx

### Журнал посещений (12 в components/journal/)
- JournalSection.jsx (главный, в components/)
- JournalCard.jsx, JournalDetailModal.jsx
- CreateJournalModal.jsx, CreateSessionModal.jsx, CreateSubjectModal.jsx
- SubjectDetailModal.jsx, AttendanceModal.jsx
- AddStudentsModal.jsx, EditStudentModal.jsx, LinkStudentModal.jsx
- JournalStatsTab.jsx, MyAttendanceStats.jsx

### Файлы в src/
- App.jsx (главный компонент)
- index.jsx (точка входа)
- AnimationDemo.jsx (демо анимаций)
- StatusTester.jsx (тестер статусов)

---

## ВАЖНЫЕ ОСОБЕННОСТИ

### 1. Telegram Web App Integration
- `window.Telegram.WebApp` API
- Haptic Feedback на всех кнопках
- MainButton/BackButton для навигации
- initDataUnsafe для получения telegram_id

### 2. Система достижений
- 24 достижения (achievements.py)
- Автопроверка при каждом действии
- Всплывающие уведомления с конфетти
- Points суммируются в total_points

### 3. Реферальная система
- Invite links: `https://t.me/{bot}?start=room_{token}_ref_{user_id}`
- 3-уровневая система (referral_connections)
- Трекинг через referral_code
- Достижения за приглашения

### 4. Hot Reload
- Frontend: Vite (port 3000)
- Backend: uvicorn --reload (port 8001)
- Рестарт только при: установке зависимостей, изменении .env

### 5. Локализация (i18n)
- Языки: RU (default) + EN
- Библиотека: react-i18next
- Сохранение в localStorage

### 6. Анимации
- Framer Motion для модалок и переходов
- Swipe gestures для удаления задач
- Drag & Drop для изменения порядка (Framer Motion Reorder)

### 7. Кэширование
- Факультеты кэшируются (cache.py)
- Расписания: 1 час (schedule_cache)
- Погода: 30 минут

### 8. Уведомления V2
- **Трехуровневая архитектура:**
  - Уровень 1: Daily Planner (06:00) - подготовка расписания на день
  - Уровень 2: Notification Executor (точное время) - отправка
  - Уровень 3: Retry Handler (каждые 2 мин) - повтор неудачных
- **Точность:** ±10 секунд (было ±5 минут)
- **Retry механизм:** 3 попытки с интервалами 1, 3, 5 минут
- **Коллекция:** `scheduled_notifications`
- **API:** `/api/notifications/stats` - статистика за день

### 9. Журнал посещений
- Преподаватели создают журналы для групп
- Студенты могут присоединяться по ссылке
- Привязка telegram аккаунтов к записям
- Статистика посещаемости
- Контроль доступа к статистике (stats_viewers)

### 10. Планировщик событий (NEW!)
- Создание событий на день
- Синхронизация с расписанием пар
- Визуальная timeline с временной шкалой
- Компоненты: PlannerTimeline, PlannerEventCard, CreateEventModal

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

# API endpoints (117 штук)
grep -c "@api_router\." /app/backend/server.py

# MongoDB коллекции (23 штуки)
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

---

## СТАТИСТИКА (актуально на 2025-07-06)

- **Backend:** ~11,000 LOC (Python)
- **Frontend:** ~15,000+ LOC (React/JSX)
- **Компонентов:** 71 всего (55 основных + 12 journal + 4 в src/)
- **API endpoints:** 117
- **Достижений:** 24
- **БД коллекций:** 23
- **Языков:** 2 (RU/EN)
- **Services:** 5 (api, rooms, groupTasks, journal, referral)
- **Contexts:** 2 (Telegram, Theme)

---

## ТЕКУЩЕЕ ОКРУЖЕНИЕ

- **ENV:** `test` (используется TEST_TELEGRAM_BOT_TOKEN)
- **DB_NAME:** `test_database`
- **Backend:** port 8001
- **Frontend:** port 3000
- **Статус:** Сервисы остановлены (требуется `sudo supervisorctl restart all`)

---

## КЛЮЧЕВЫЕ ЗАВИСИМОСТИ

### Backend (requirements.txt)
- fastapi==0.110.1, uvicorn==0.25.0
- pymongo==4.5.0, motor==3.3.1
- pydantic>=2.6.4
- requests>=2.31.0, aiohttp>=3.9.0
- beautifulsoup4>=4.12.0, lxml>=4.9.0

### Frontend (package.json)
- react: ^19.0.0
- framer-motion: ^12.23.24
- axios: ^1.12.2
- @twa-dev/sdk: ^8.0.2
- lucide-react: ^0.546.0
- recharts: ^3.4.1
- i18next: ^25.6.0
- vite: ^7.2.2
- tailwindcss: ^3.4.17

---

## ССЫЛКИ

- **Продакшн Bot:** [@rudn_mosbot](https://t.me/rudn_mosbot)
- **Тестовый Bot:** Настроен через TEST_TELEGRAM_BOT_TOKEN
- **API РУДН:** http://www.rudn.ru/rasp/lessons/view
- **OpenWeather API:** https://openweathermap.org/api

---

**Этот файл содержит ВСЁ необходимое для быстрого старта разработки ИИ-сервисом с минимальным потреблением токенов.**
