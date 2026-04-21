# RUDN Schedule — Telegram Web App

## 📱 О проекте

**RUDN Schedule** — Telegram Web App для студентов РУДН, объединяющий расписание пар, задачи, журнал посещений, VK Music, систему сообщений и социальные функции в одном приложении.

### 🌟 Основные возможности

- **📅 Расписание пар** — интеграция с официальным API РУДН, карусель текущих занятий, живые таймеры
- **✅ Задачи** — личные и групповые задачи с категориями, приоритетами, дедлайнами и подзадачами
- **🎯 Планировщик** — синхронизация событий с расписанием, timeline визуализация
- **📓 Журнал посещений** — для преподавателей: учёт студентов, занятий, статистика
- **🎵 VK Music** — авторизация VK (логин + OAuth), стриминг треков, плейлисты, комнаты совместного прослушивания
- **👥 Друзья** — социальная система с запросами, блокировками, QR-кодами
- **💬 Сообщения** — чаты между друзьями с реакциями, пересылкой, отправкой музыки и расписания
- **📤 Совместное расписание** — шаринг и наложение расписаний с друзьями
- **🏆 Достижения** — 24 ачивки с геймификацией и конфетти
- **🔥 Streak-система** — ежедневные серии посещений с наградами
- **🔔 Уведомления V2** — точные уведомления о парах (±10 сек)
- **📊 Аналитика** — статистика расписания, графики нагрузки
- **🌤 Погода** — виджет погоды в Москве
- **🔗 Реферальная система** — 3-уровневая система приглашений + админ-ссылки
- **📱 Web Sessions** — авторизация на других устройствах через QR-код
- **🔒 Приватность** — настройки видимости профиля
- **🖥 Desktop Sidebar** — адаптивный интерфейс для десктопа
- **🛡 Админ-панель** — расширенная панель с мониторингом, рассылками и статистикой

---

## 🛠 Технологический стек

### Backend
- **FastAPI** 0.110.1 — веб-фреймворк
- **Python** 3.10+ — язык
- **MongoDB** — база данных (pymongo 4.5.0, motor 3.3.1)
- **APScheduler** — планировщик задач
- **python-telegram-bot** 20.7+ — Telegram Bot API
- **vkpymusic** — VK Music API
- **BeautifulSoup** — парсинг HTML
- **Pydantic** v2.6+ — валидация данных (230 моделей)
- **httpx** — async HTTP клиент
- **psutil** — мониторинг системы

### Frontend
- **React** 19.0.0 — UI библиотека
- **Vite** 7.2.2 — сборщик
- **TailwindCSS** 3.4.17 — стили
- **Framer Motion** 12.23.24 — анимации
- **@twa-dev/sdk** — Telegram Web App SDK
- **axios** — HTTP клиент
- **i18next** — локализация (RU/EN)
- **recharts** — графики
- **html-to-image** — скриншоты для шаринга
- **react-router-dom** — маршрутизация

### Infrastructure
- **Kubernetes** — оркестрация
- **Supervisor** — процесс-менеджер
- **MongoDB** — локальная БД

---

## 📊 Статистика проекта

| Метрика | Значение |
|---------|----------|
| Backend Python файлов | **15** |
| Backend LOC | **~26,300** |
| Pydantic моделей | **230** |
| Frontend компонентов | **109** |
| Frontend LOC | **~64,000** |
| API endpoints | **268** |
| MongoDB коллекций | **46** |
| Services (API клиенты) | **11** |
| Языков (i18n) | 2 |

---

## 🚀 Быстрый старт

### 1. Проверка статуса сервисов
```bash
sudo supervisorctl status
```

### 2. Перезапуск сервисов
```bash
sudo supervisorctl restart all
```

### 3. Просмотр логов
```bash
# Backend логи
tail -f /var/log/supervisor/backend.*.log

# Frontend логи
tail -f /var/log/supervisor/frontend.*.log

# Ошибки backend
tail -50 /var/log/supervisor/backend.err.log | grep -i error
```

### 4. Установка зависимостей

**Backend:**
```bash
cd /app/backend
pip install PACKAGE_NAME
echo "PACKAGE_NAME" >> requirements.txt
sudo supervisorctl restart backend
```

**Frontend (только yarn!):**
```bash
cd /app/frontend
yarn add PACKAGE_NAME
# Hot reload автоматически перезагрузит
```

---

## 📁 Структура проекта

```
/app/
├── backend/                    # FastAPI backend (~26,300 LOC)
│   ├── server.py              # Главный сервер (268 endpoints)
│   ├── models.py              # Pydantic схемы (230 моделей)
│   ├── achievements.py        # Система достижений (24 ачивки)
│   ├── scheduler_v2.py        # Уведомления V2
│   ├── telegram_bot.py        # Telegram bot
│   ├── music_service.py       # VK Music сервис
│   ├── vk_auth_service.py     # VK авторизация + OAuth
│   ├── cover_service.py       # Обложки треков
│   ├── rudn_parser.py         # Парсер API РУДН
│   ├── lk_parser.py           # Парсер ЛК РУДН
│   ├── weather.py             # Погода
│   ├── notifications.py       # Отправка уведомлений
│   ├── cache.py               # Кэширование
│   ├── config.py              # Конфигурация
│   └── requirements.txt       # Python зависимости
│
├── frontend/                   # React frontend (~64,000 LOC)
│   ├── src/
│   │   ├── App.jsx            # Главный компонент (2,600 LOC)
│   │   ├── components/        # 109 компонентов
│   │   │   ├── journal/       # 17 компонентов журнала
│   │   │   ├── music/         # 13 компонентов музыки
│   │   │   └── icons/         # Иконки
│   │   ├── services/          # 11 API клиентов
│   │   ├── contexts/          # React контексты
│   │   ├── utils/             # 10 утилит
│   │   ├── hooks/             # 3 кастомных хука
│   │   ├── i18n/              # Локализация (RU/EN)
│   │   └── constants/         # Константы
│   ├── package.json           # Зависимости
│   └── vite.config.js         # Конфигурация Vite
│
├── AI_CONTEXT.md              # Контекст для ИИ (быстрый обзор)
├── PROJECT_DETAILS.md         # Полная техническая документация
├── README.md                  # Этот файл
└── *.md                       # Дополнительная документация
```

---

## 🔧 Конфигурация

### Environment Variables

**Backend (.env):**
```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
CORS_ORIGINS="*"
ENV="test"  # или "production"

# Telegram боты
TELEGRAM_BOT_TOKEN=...
TEST_TELEGRAM_BOT_TOKEN=...

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

# API ключи
WEATHER_API_KEY=...
```

**Frontend (.env):**
```env
VITE_ENABLE_VISUAL_EDITS=false
ENABLE_HEALTH_CHECK=false
REACT_APP_BACKEND_URL=...  # Определяется автоматически
VITE_ENV=test
```

### Порты
- **Frontend:** 3000 (internal)
- **Backend:** 8001 (internal)
- **MongoDB:** 27017

---

## 📚 Документация

| Документ | Описание |
|----------|----------|
| [AI_CONTEXT.md](/app/AI_CONTEXT.md) | Быстрый обзор для ИИ-агентов |
| [PROJECT_DETAILS.md](/app/PROJECT_DETAILS.md) | Полная техническая документация |
| [NOTIFICATION_SYSTEM_V2.md](/app/NOTIFICATION_SYSTEM_V2.md) | Система уведомлений V2 |
| [PLANNER_EVENTS_DOCS.md](/app/PLANNER_EVENTS_DOCS.md) | Планировщик событий |
| [VK_MUSIC_INTEGRATION_PLAN.md](/app/VK_MUSIC_INTEGRATION_PLAN.md) | VK Music интеграция |
| [ROOMS_DOCUMENTATION_INDEX.md](/app/ROOMS_DOCUMENTATION_INDEX.md) | Документация комнат |
| [BACKUP_GUIDE.md](/app/BACKUP_GUIDE.md) | Руководство по бэкапам |
| [TASKS_FEATURES.md](/app/TASKS_FEATURES.md) | Описание задач |
| [TASKS_ROADMAP.md](/app/TASKS_ROADMAP.md) | Дорожная карта |

---

## ⚠️ Важные правила

### ❌ ЗАПРЕЩЕНО:
1. Использовать `npm` (только `yarn`!)
2. Хардкодить URLs и порты
3. Использовать MongoDB ObjectID (только UUID)
4. Забывать префикс `/api/` для backend routes
5. Изменять `.env` файлы без необходимости

### ✅ ОБЯЗАТЕЛЬНО:
1. Читать `AI_CONTEXT.md` перед работой
2. Проверять логи после изменений
3. Следовать существующим паттернам
4. Тестировать в Telegram Web App
5. Обновлять `requirements.txt` / `package.json`

---

## 🔗 Ссылки

- **Продакшн Bot:** [@rudn_mosbot](https://t.me/rudn_mosbot)
- **API РУДН:** http://www.rudn.ru/rasp/lessons/view
- **OpenWeather:** https://openweathermap.org/api

---

## 📝 Для ИИ-агентов

**Перед началом работы:**
1. Прочитайте `/app/AI_CONTEXT.md` — краткий обзор всего проекта
2. При необходимости детальной информации — `/app/PROJECT_DETAILS.md`
3. Используйте `grep` для поиска по коду
4. Проверяйте логи после каждого изменения

**Полезные команды:**
```bash
# Количество endpoints
grep -c "@api_router\." /app/backend/server.py

# MongoDB коллекции
grep -oP 'db\.\K[a-zA-Z_]+' /app/backend/server.py | sort -u

# Pydantic модели
grep -c "^class " /app/backend/models.py

# Компоненты frontend
find /app/frontend/src/components -name "*.jsx" | wc -l

# Services
ls /app/frontend/src/services/
```

---

## 📦 Модули и API endpoints

### По количеству endpoints

| Модуль | Endpoints | Описание |
|--------|-----------|----------|
| Журнал посещений | **37** | Управление журналами, студентами, предметами, занятиями |
| VK Music | **35** | Поиск, стриминг, плейлисты, комнаты прослушивания, OAuth |
| Админ-панель | **31** | Статистика, мониторинг, рефералы, рассылки |
| Групповые задачи | **19** | CRUD, подзадачи, комментарии, приглашения |
| Сообщения | **18** | Чаты, реакции, пересылка, типинг |
| Комнаты | **17** | CRUD, приглашения, участники, роли |
| Друзья | **15** | Запросы, блокировки, поиск, QR |
| Пользователи | **11** | Настройки, тема, уведомления |
| Уведомления | **11** | CRUD, настройки |
| Личные задачи | **10** | CRUD, подзадачи, продуктивность |
| Web Sessions | **10** | QR-авторизация |
| Совместное расписание | **9** | Шаринг, участники, токены |
| Другое | **9** | Погода, YouTube, VK Video, бот |
| Реферальная система | **7** | Коды, статистика, дерево |
| Планировщик | **5** | Синхронизация, события |
| Профиль | **5** | QR, расписание, приватность |
| Достижения | **5** | Список, трекинг |
| Расписание РУДН | **4** | Факультеты, фильтры, расписание |
| ЛК РУДН | **4** | Подключение, данные |
| Бэкапы | **3** | Экспорт |
| **ИТОГО** | **268** | |

---

**Последнее обновление:** 2025-07-17  
**Метод обновления:** Автоматический аудит кода (grep, wc, find)
