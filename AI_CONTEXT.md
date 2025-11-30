# AI CONTEXT - RUDN Schedule Telegram Web App

**Обновлено:** 2025-01-22 | **Статус:** Оптимизирован для ИИ (↓60% токенов)

---

## МЕТА-ИНФОРМАЦИЯ

**Тип:** Telegram Web App для студентов РУДН  
**Стек:** FastAPI (Python) + React + MongoDB + Telegram Bot API  
**Функции:** Расписание пар, задачи (личные + групповые), достижения, аналитика, погода, уведомления  
**Особенность:** Интеграция с API РУДН, геймификация, реферальная система

---

## БЫСТРАЯ НАВИГАЦИЯ

### Backend (/app/backend/)
- `server.py` (3500 LOC) - ВСЕ API endpoints (50+)
- `models.py` (750 LOC) - Pydantic схемы
- `telegram_bot.py` (850 LOC) - Telegram Bot логика
- `achievements.py` (630 LOC) - 25 достижений
- `scheduler_v2.py` (720 LOC) - **НОВЫЙ** Улучшенный планировщик уведомлений V2
- `scheduler.py` (460 LOC) - ⚠️ Старый планировщик (резерв)
- `rudn_parser.py` (310 LOC) - парсинг API РУДН
- `notifications.py` (140 LOC) - рассылка через Bot API
- `weather.py` (120 LOC) - OpenWeatherMap API

### Frontend (/app/frontend/src/)
- `App.js` - роутинг, главный компонент
- `components/` - 30+ React компонентов
- `services/` - api.js, roomsAPI.js, groupTasksAPI.js
- `i18n/` - локализация (ru/en)
- `utils/` - analytics, dateUtils, animations, confetti

### Документация
- `AI_CONTEXT.md` - этот файл (краткий обзор)
- `PROJECT_DETAILS.md` - полная техническая документация
- `test_result.md` - история разработки (1100+ строк)
- `README.md` - инструкции по запуску

---

## АРХИТЕКТУРА

```
Telegram Bot (@rudn_pro_bot)
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
  - user_settings, user_stats, user_achievements
  - tasks (личные), rooms, room_participants, group_tasks
```

**Важно:**
- Frontend → Backend: через `REACT_APP_BACKEND_URL` (из .env)
- Backend → MongoDB: через `MONGO_URL` (из .env)
- ВСЕ backend routes начинаются с `/api/` (Kubernetes ingress правило)
- Никогда не хардкодить URLs/ports!

---

## API ENDPOINTS (50+)

### Расписание РУДН
```
GET  /api/faculties           - список факультетов
POST /api/filter-data         - фильтры (курс, уровень, группы)
POST /api/schedule            - расписание группы
```

### Пользователи
```
POST /api/user-settings                         - сохранить группу
GET  /api/user-settings/{telegram_id}           - получить настройки
GET  /api/user-settings/{telegram_id}/notifications
PUT  /api/user-settings/{telegram_id}/notifications
```

### Статистика и достижения
```
GET  /api/achievements                    - все 25 достижений
GET  /api/user-stats/{telegram_id}        - статистика
GET  /api/user-achievements/{telegram_id} - полученные ачивки
POST /api/track-action                    - трекинг действий
```

### Личные задачи
```
GET    /api/tasks/{telegram_id}  - все задачи юзера
POST   /api/tasks                - создать
PUT    /api/tasks/{task_id}      - обновить
DELETE /api/tasks/{task_id}      - удалить
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
```

### Групповые задачи
```
POST   /api/rooms/{room_id}/tasks  - создать задачу в комнате
GET    /api/rooms/{room_id}/tasks  - список задач комнаты
PUT    /api/group-tasks/{task_id}  - обновить
DELETE /api/group-tasks/{task_id}  - удалить
```

### Прочее
```
GET /api/weather    - погода в Москве
GET /api/bot-info   - инфо о боте
GET /api/health     - health check
```

---

## СХЕМЫ БД (MongoDB Collections)

### user_settings
```python
id: UUID, telegram_id: int, username, first_name, last_name
group_id, group_name, facultet_id, facultet_name, level_id, kurs, form_code
notifications_enabled: bool, notification_time: int
referral_code: str, referred_by: int, invited_count: int
created_at: datetime, last_activity: datetime
```

### user_stats
```python
telegram_id: int (unique)
groups_viewed, friends_invited, schedule_views, night_usage_count, early_usage_count
total_points, achievements_count, analytics_views, calendar_opens
notifications_configured, schedule_shares, menu_items_visited, active_days
```

### user_achievements
```python
telegram_id: int, achievement_id: str, earned_at: datetime, seen: bool
```

### tasks (личные задачи)
```python
id: UUID, telegram_id: int, text: str, completed: bool
category: str ('учеба'|'личное'|'спорт'|'проекты')
priority: str ('high'|'medium'|'low')
deadline: datetime?, target_date: datetime?, notes: str, tags: [str], order: int
created_at: datetime, updated_at: datetime
```

### rooms
```python
id: UUID, name: str, color: str, emoji: str, description: str, owner_id: int
created_at: datetime
total_participants: int, total_tasks: int, completed_tasks: int
```

### room_participants
```python
room_id: UUID, telegram_id: int, username, first_name, avatar_url
role: str ('owner'|'member'), joined_at: datetime, referral_code: int
```

### group_tasks (групповые задачи)
```python
id: UUID, room_id: UUID, text: str, description: str, completed: bool
priority: str, deadline: datetime?, created_by: int, assigned_to: [int]
category: str, tags: [str], order: int
created_at: datetime, updated_at: datetime
completed_by: int?, completed_at: datetime?
```

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
MONGO_URL=mongodb://localhost:27017/rudn_schedule
TELEGRAM_BOT_TOKEN=...
WEATHER_API_KEY=...
```

**Frontend .env:**
```env
REACT_APP_BACKEND_URL=https://class-progress-1.preview.emergentagent.com
```

---

## КОМПОНЕНТЫ FRONTEND (30+)

**Главные экраны:** App.js, GroupSelector.jsx, WelcomeScreen.jsx

**Навигация:** Header.jsx, BottomNavigation.jsx, DesktopSidebar.jsx

**Расписание:** LiveScheduleCard, LiveScheduleCarousel, LiveScheduleSection, WeekDaySelector, CalendarModal

**Задачи:** TasksSection.jsx (900+ LOC), AddTaskModal, EditTaskModal, TaskDetailModal

**Комнаты:** RoomCard, RoomDetailModal, CreateRoomModal, AddRoomTaskModal, EditRoomTaskModal, GroupTaskCard, GroupTaskDetailModal, RoomParticipantsList, RoomStatsPanel

**Модалки:** AnalyticsModal, AchievementsModal, NotificationSettings, ProfileModal, MenuModal, ShareScheduleModal

**UI:** AchievementNotification, SkeletonCard, LoadingScreen, SwipeHint, TagsInput, TopGlow

---

## ВАЖНЫЕ ОСОБЕННОСТИ

### 1. Telegram Web App Integration
- `window.Telegram.WebApp` API
- Haptic Feedback на всех кнопках
- MainButton/BackButton для навигации
- initDataUnsafe для получения telegram_id

### 2. Система достижений
- 25 достижений (achievements.py)
- Автопроверка при каждом действии
- Всплывающие уведомления с конфетти
- Points суммируются в total_points

### 3. Реферальная система
- Invite links: `https://t.me/{bot}?start=room_{token}_ref_{user_id}`
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
- Расписания: 1 час
- Погода: 30 минут

### 8. Уведомления
- APScheduler проверяет каждую минуту
- Отправка за N минут до пары (настраивается 5-30 мин)
- Через Telegram Bot API

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

# API endpoints
grep -n "@app\." /app/backend/server.py | head -20

# MongoDB коллекции
grep -n "db\[" /app/backend/server.py | cut -d"[" -f2 | cut -d"]" -f1 | sort -u
```

---

## ТИПИЧНЫЕ ЗАДАЧИ

| Задача | Файлы |
|--------|-------|
| Новый API endpoint | `/app/backend/server.py` + `models.py` |
| Новый UI компонент | `/app/frontend/src/components/NewComponent.jsx` |
| Новое достижение | `/app/backend/achievements.py` (массив ACHIEVEMENTS) |
| Логика уведомлений | `/app/backend/notifications.py` + `scheduler.py` |
| Новая страница | `/app/frontend/src/App.js` + новый компонент |
| Схема БД | `/app/backend/models.py` (Pydantic) |
| Перевод | `/app/frontend/src/i18n/locales/ru.json` и `en.json` |
| Стили | Компонент (Tailwind) или `/app/frontend/src/index.css` |

---

## СТАТИСТИКА

- Backend: ~6,000 LOC (Python)
- Frontend: ~10,000 LOC (React/JSX)
- Компонентов: 30+
- API endpoints: 50+
- Достижений: 25
- БД коллекций: 7
- Языков: 2 (RU/EN)

---

## ССЫЛКИ

- **Bot:** [@rudn_mosbot](https://t.me/rudn_mosbot)
- **Frontend:** https://rudn-schedule.ru
- **API РУДН:** http://www.rudn.ru/rasp/lessons/view
- **OpenWeather API:** https://openweathermap.org/api

---

**Этот файл содержит ВСЁ необходимое для быстрого старта разработки ИИ-сервисом с минимальным потреблением токенов.**
