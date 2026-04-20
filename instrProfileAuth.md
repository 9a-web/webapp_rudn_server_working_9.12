# 📋 План реализации: Публичный профиль + Мульти-авторизация

**Создан:** 2025-07-17  
**Обновлён (аудит кода):** 2025-07 — синхронизация статусов с фактическим состоянием репозитория  
**Статус:** 🔄 В работе — Stage 4 (Stage 1-3 завершены, Stage 5 частично)

---

## 🎯 Задача (от пользователя)

> "Я хочу сделать каждый профиль публичным (у каждого уникальная ссылка профиль). Сделать профиль как в социальной сети: с конкретной формой регистрации и присвоением уникального UID, UID соц сетей для плюрализма выбора авторизации: Telegram Login Widget, QR, VK ID, Почта"

## ✅ Уточнённые требования

| # | Параметр | Решение |
|---|----------|---------|
| 1 | Порядок работ | Сначала новая регистрация + UID, потом фиксы багов параллельно |
| 2 | Модель | **Site-first**: сайт — основа с формой логина; в Telegram WebApp та же форма (но с автологином по initData) |
| 3 | Формат публичной ссылки | `{PUBLIC_BASE_URL}/u/{uid}` где `uid` = 9-значный UID **только цифры** |
| 4 | Форма регистрации | Многошаговая: шаг 1 — способ авторизации (если email → пароль), шаг 2 — профиль, шаг 3 — учебные данные |
| 5a | Username в URL | **НЕТ** — в URL только цифры системного UID (username — только для отображения) |
| 5b | Миграция существующих users | Автоматическая при старте — всем выдаётся `uid` |
| 5c | `PUBLIC_BASE_URL` | = `REACT_APP_BACKEND_URL` (через константу, потом легко поменять) |
| 6 | Email-верификация | Пока **БЕЗ** (просто пароль + bcrypt) |
| 7 | VK ID | Использовать существующие `VK_APP_ID` / `VK_CLIENT_SECRET` из `.env` |
| 8 | Telegram Login Widget | Домен = `REACT_APP_BACKEND_URL` |

---

## 📐 Архитектура

### Новая коллекция `users` (MongoDB)

```python
{
    "_id": ObjectId,  # только для Mongo, не используем
    "uid": "123456789",      # 9-значный numeric UID (unique, indexed)
    "username": "john_doe",  # unique handle (optional, задаётся на шаге 2)
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",   # unique если задан
    "password_hash": "$2b$...",    # bcrypt hash (только если auth=email)
    "telegram_id": 123456,         # unique если задан (linked)
    "vk_id": "98765",              # unique если задан (linked)
    "auth_providers": ["email", "telegram"],  # массив активных провайдеров
    "primary_auth": "email",       # основной метод регистрации
    "email_verified": False,       # пока всегда False (нет верификации)
    "created_at": ISODate,
    "updated_at": ISODate,
    "last_login_at": ISODate,
    # Академические данные (шаг 3 регистрации) - дублируются в user_settings для совместимости
    "facultet_id": "...",
    "facultet_name": "...",
    "group_id": "...",
    "group_name": "...",
    "kurs": "...",
}
```

### Связи
- **`uid`** — первичный публичный идентификатор (в URL)
- **`telegram_id`** — связь с существующей `user_settings` коллекцией (обратная совместимость)
- **`vk_id`** — связь с VK OAuth
- **`email` + `password_hash`** — для email-авторизации

### JWT payload
```json
{
  "sub": "123456789",    // uid
  "tid": 123456,          // telegram_id (optional)
  "providers": ["email"],
  "iat": ..., "exp": ...  // 30 дней
}
```

---

## 🏗 Stage 1 — Backend: Identity & Auth Foundation

**Цель:** Фундамент — коллекция `users`, миграция, JWT, 4 auth endpoint'а.

### 1.1 Установка зависимостей
- [x] `python-jose[cryptography]==3.3.0`
- [x] `passlib[bcrypt]==1.7.4`
- [x] `email-validator==2.1.0`
- [x] Добавить в `requirements.txt`

### 1.2 Конфигурация
- [x] В `.env` добавить: `JWT_SECRET_KEY` (auto-generated), `JWT_ALGORITHM=HS256`, `JWT_EXPIRE_DAYS=30`
- [x] В `config.py` — load & expose

### 1.3 Модели (models.py)
- [x] `User` — Pydantic модель коллекции
- [x] `UserPublic` — публичное представление (без password_hash)
- [x] `RegisterEmailRequest` — email, password, first_name
- [x] `LoginEmailRequest` — email, password
- [x] `TelegramLoginRequest` — Telegram Login Widget data (id, first_name, username, auth_date, hash)
- [x] `VKLoginRequest` — access_token or code + device_id
- [x] `QRInitResponse` — qr_token, qr_url, expires_at
- [x] `QRConfirmRequest` — qr_token, authorization (JWT from authorized device)
- [x] `AuthTokenResponse` — access_token, token_type, user: UserPublic
- [x] `UpdateProfileStepRequest` — username, first_name, last_name, facultet_id, group_id, kurs (для шагов регистрации)

### 1.4 Утилиты
- [x] `auth_utils.py` — модуль:
  - `generate_uid()` — 9-digit unique numeric (с проверкой коллизий)
  - `hash_password(p)`, `verify_password(p, h)` — bcrypt
  - `create_jwt(payload)`, `decode_jwt(token)`
  - `get_current_user(credentials)` — FastAPI dependency (optional/required)
  - `verify_telegram_login_widget_hash(data, bot_token)` — HMAC validation

### 1.5 Миграция (startup hook в server.py)
- [x] На старте backend:
  - Создать индекс `users.uid` unique, `users.email` unique sparse, `users.telegram_id` unique sparse, `users.vk_id` unique sparse, `users.username` unique sparse
  - Скрипт `migrate_user_settings_to_users()`:
    - Для каждой записи в `user_settings` без `uid` → создать `users` запись
    - Сохранить mapping в `user_settings.uid` (backward-compat)
    - Логировать количество мигрированных

### 1.6 Auth endpoints (новый файл `auth_routes.py` или в server.py)
- [x] `POST /api/auth/register/email` → (email, password, first_name) → JWT + UserPublic
- [x] `POST /api/auth/login/email` → (email, password) → JWT + UserPublic
- [x] `POST /api/auth/login/telegram` → Telegram Widget data → JWT + UserPublic
  - Проверка HMAC hash
  - Поиск/создание user по telegram_id
- [x] `POST /api/auth/login/vk` → (code, device_id, redirect_uri) → JWT + UserPublic
  - Обмен code на access_token
  - GET /users.get → профиль
  - Поиск/создание user по vk_id
- [x] `POST /api/auth/login/qr/init` → { qr_token, qr_url, expires_at, status: "pending" }
- [x] `GET  /api/auth/login/qr/{qr_token}/status` → { status: "pending" | "confirmed" | "expired", access_token? }
- [x] `POST /api/auth/login/qr/{qr_token}/confirm` (защищённый JWT) → подтвердить сессию → сайт получает access_token через polling
- [x] `GET  /api/auth/me` (JWT) → UserPublic текущего пользователя
- [x] `POST /api/auth/logout` (JWT) → invalidate (minimally — клиент просто удаляет JWT)
- [x] `POST /api/auth/link/{provider}` (JWT) — привязать доп. провайдер к существующему аккаунту
- [x] `GET  /api/auth/check-username/{username}` — доступен ли username
- [x] `PATCH /api/auth/profile-step` (JWT) — обновить профиль (шаги 2 и 3 регистрации)

### 1.7 Тестирование Stage 1
- [x] `deep_testing_backend_v2` — проверить все 4 метода auth + me + миграцию

**Статус Stage 1:** ✅ Завершено

---

## 🔧 Stage 2 — Backend: Public Profile by UID + Bug Fixes

**Цель:** Публичный профиль по UID + исправление всех найденных багов.

### 2.1 Новые endpoints по UID
- [x] `GET  /api/u/{uid}` — публичный профиль (без auth, с privacy-фильтрами)
- [x] `GET  /api/u/{uid}/schedule?viewer_uid=` — расписание (для друзей + владельца)
- [x] `GET  /api/u/{uid}/qr` — QR-данные
- [x] `GET  /api/u/{uid}/share-link` — публичная ссылка
- [x] `GET  /api/u/{uid}/privacy` (JWT, только владелец) — текущие настройки
- [x] `PUT  /api/u/{uid}/privacy` (JWT, только владелец) — обновить
- [x] `POST /api/u/{uid}/view` — зарегистрировать просмотр
- [x] Helper: `resolve_user_by_uid(uid)` — найти в `users`, отфолбэчить в `user_settings` по legacy mapping

### 2.2 Обратная совместимость
- [x] Старые endpoint'ы `/profile/{telegram_id}/*` — **СОХРАНИТЬ**, но внутри преобразовывать telegram_id → uid
- [x] Во всех Pydantic моделях публичного профиля добавить поле `uid`

### 2.3 Баги (фиксы)
- [x] **🐛 BUG-1**: `/profile/{id}/share-link` — добавить check `is_owner` (владелец со `show_in_search=false` должен получать свою ссылку)
- [x] **🐛 BUG-2**: `/profile/activity-ping` — требовать JWT и валидировать что `current_user.uid` совпадает с `telegram_id` пользователя (никто не может пинговать чужого)
- [x] **🐛 BUG-3**: `/profile/{id}/view` — для анонимов + скрытого из поиска → **не засчитывать**
- [x] **🐛 BUG-4**: `/profile/{id}/qr` — унифицировать логику для анонимов (возвращать 401 если anonymous && !show_in_search)
- [x] **⚠️ BUG-5**: `created_at` — показывать всем (Member since)
- [x] **⚠️ BUG-6**: Pydantic v2 — `model_dump()` вместо `.dict()` везде (уже частично)
- [x] **⚠️ BUG-7**: В `UserProfilePublic` добавить поле `uid` (обязательно), `username`
- [x] **⚠️ BUG-8**: Добавить rate-limit на `/view` — 1 просмотр в час уже есть, но дедупликация через `profile_views` коллекцию — **добавить TTL index** (auto-cleanup старше 7 дней)

### 2.4 Тестирование Stage 2
- [x] `deep_testing_backend_v2` — все новые endpoint'ы + проверка что старые работают

**Статус Stage 2:** ✅ Завершено

---

## 🎨 Stage 3 — Frontend: Auth Flow

**Цель:** Страницы `/login` + `/register` + AuthContext + защита роутов.

### 3.1 Зависимости
- [x] `jwt-decode` (если не установлен)
- [x] Опционально `@vkontakte/superappkit` для VK ID SDK

### 3.2 Инфраструктура
- [x] `src/contexts/AuthContext.jsx` — провайдер (token, user, login, logout, refreshMe)
- [x] `src/services/authAPI.js` — API клиент для `/api/auth/*`
- [x] `src/utils/authStorage.js` — localStorage wrapper для JWT
- [x] `src/constants/publicBase.js` — экспорт `PUBLIC_BASE_URL` (= `REACT_APP_BACKEND_URL`)

### 3.3 Страница `/login`
- [x] `src/pages/LoginPage.jsx`
  - 4 кнопки: Email, Telegram, VK, QR
  - Email → форма ввода email+пароль
  - Telegram → Telegram Login Widget (iframe)
  - VK → redirect на VK OAuth
  - QR → показ QR-кода + poll статуса

### 3.4 Страница `/register` (многошаговая)
- [x] `src/pages/RegisterWizard.jsx`
  - Шаг 1: выбор способа авторизации (4 метода)
    - Если email → форма email+пароль+имя
    - Иначе → внешний провайдер
  - Шаг 2: username (с проверкой доступности), first_name, last_name
  - Шаг 3: факультет, курс, группа (reuse существующих compoнентов `FacultySelector`)
- [x] Progress indicator

### 3.5 Auth Gate
- [x] В `App.jsx` — если нет JWT и нет Telegram WebApp initData → redirect на `/login`
- [x] В Telegram WebApp — auto-login через `/api/auth/login/telegram` с initData
- [x] Сохранение JWT в localStorage, authorization header для всех API

### 3.6 Тестирование Stage 3
- [x] `auto_frontend_testing_agent` — все формы логина + регистрации
- [x] Проверка Telegram WebApp автологина

**Статус Stage 3:** ✅ Завершено (подтверждено аудитом 2025-07)

**Артефакты в репозитории:**
- `frontend/src/contexts/AuthContext.jsx` (230 LOC) — провайдер + axios interceptor + 401 handler
- `frontend/src/services/authAPI.js` (73 LOC) — API клиент `/api/auth/*`
- `frontend/src/utils/authStorage.js` — localStorage wrapper + `isTokenValid`
- `frontend/src/constants/publicBase.js` — `PUBLIC_BASE_URL = REACT_APP_BACKEND_URL`
- `frontend/src/pages/LoginPage.jsx` (164 LOC) — 4 способа логина
- `frontend/src/pages/RegisterWizard.jsx` (383 LOC) — многошаговая регистрация
- `frontend/src/pages/VKCallbackPage.jsx` (113 LOC) — OAuth callback
- `frontend/src/pages/QRConfirmPage.jsx` (109 LOC) — подтверждение QR
- `frontend/src/components/auth/` — 10 компонентов (AuthButton, AuthGate, AuthInput, AuthLayout, EmailLoginForm, EmailRegisterForm, QRLoginBlock, TelegramLoginWidget, UsernameField, VkLoginButton)
- `App.jsx` обёрнут в `AuthProvider`, корневой маршрут `/` защищён `AuthGate`, добавлены маршруты `/login`, `/register`, `/auth/vk/callback`, `/auth/qr/confirm`

---

## 🌐 Stage 4 — Frontend: Публичная страница `/u/{uid}`

**Цель:** Shareable публичная страница профиля.

### 4.1 Роутинг
- [ ] React Router добавить маршрут `/u/:uid`
- [ ] `src/pages/PublicProfilePage.jsx`
  - Работает БЕЗ auth (если есть JWT — показывает друзей/статус)
  - Переиспользует UI из `FriendProfileModal`

### 4.2 Кнопка «Поделиться» в профиле
- [ ] В `ProfileScreen.jsx` / `ProfileModal.jsx` — кнопка «Копировать ссылку на профиль»
- [ ] Формат: `${PUBLIC_BASE_URL}/u/{uid}`
- [ ] Использовать `navigator.clipboard` + Telegram share (если в WebApp)
- [ ] **Сейчас:** кнопка «Поделиться ссылкой» (ProfileScreen.jsx:1469-1506) использует устаревший `qrData.qr_data` — заменить на новый share-link из `/api/u/{uid}/share-link` или построить на клиенте из `PUBLIC_BASE_URL + "/u/" + uid`

### 4.3 Тестирование Stage 4
- [ ] Открыть `/u/{uid}` в инкогнито → должен показать публичный профиль
- [ ] Проверить уважение privacy-настроек
- [ ] Проверить TTL-дедупликацию просмотров (коллекция `profile_views`, 7 дней)

**Статус Stage 4:** ⏳ Не начато (Backend готов — фронтенд нужно дописать)

---

## 🔌 Stage 5 — Внешние интеграции

**Цель:** Полноценная работа Telegram Login Widget + VK ID + QR.

### 5.1 Telegram Login Widget
- [x] Frontend: `TelegramLoginWidget.jsx` компонент (script + data-telegram-login + fallback-подсказка при отсутствии домена)
- [x] Backend: HMAC проверка hash (`verify_telegram_login_widget_hash` в `auth_utils.py`)
- [x] Backend: дополнительная валидация Telegram WebApp `initData` (`verify_telegram_webapp_init_data`) + endpoint `POST /api/auth/login/telegram-webapp`
- [ ] Bot: `/setdomain` через BotFather — установить `REACT_APP_BACKEND_URL` (инструкция в README, требует действий пользователя вне кода)

### 5.2 VK ID OAuth
- [x] Frontend: кнопка «Войти через VK» (`VkLoginButton.jsx`) → redirect на VK OAuth
- [x] Frontend: страница `/auth/vk/callback` (`VKCallbackPage.jsx`) — обмен code через backend
- [x] Backend: `POST /api/auth/login/vk` — обмен code на access_token + профиль VK
- [x] Используются существующие `VK_APP_ID`, `VK_CLIENT_SECRET`, `VK_REDIRECT_URI` из `.env`

### 5.3 QR Cross-Device Login
- [x] Frontend `/login`: QR-блок (`QRLoginBlock.jsx`) с `qr_token` + polling каждые ~2 сек
- [x] Frontend: страница `/auth/qr/confirm` (`QRConfirmPage.jsx`) для подтверждения с авторизованного устройства
- [x] Backend: `POST /api/auth/login/qr/init`, `GET /api/auth/login/qr/{token}/status`, `POST /api/auth/login/qr/{token}/confirm`
- [x] Коллекция `auth_qr_sessions` / `qr_login_sessions` с TTL 5 минут

### 5.4 Тестирование Stage 5
- [ ] E2E flow для каждого провайдера (auto_frontend_testing_agent)
- [ ] Проверка реальной привязки домена Telegram Login Widget (после `/setdomain`)
- [ ] Проверка VK OAuth с реальным `VK_APP_ID` и корректным redirect_uri

**Статус Stage 5:** 🟡 Частично готово — код написан (frontend + backend), осталась настройка домена бота и E2E-тестирование

---

## 🎯 Текущий прогресс

```
[████████████] Stage 1: Backend Auth Foundation — ✅ Завершено
[████████████] Stage 2: Public Profile by UID + Bugfixes — ✅ Завершено
[████████████] Stage 3: Frontend Auth Flow — ✅ Завершено (подтверждено аудитом)
[            ] Stage 4: Public Profile Page /u/{uid} — ⏳ Не начато (backend готов)
[██████▒▒▒▒▒▒] Stage 5: External Integrations — 🟡 Код готов, нужно E2E + /setdomain
```

### Ближайшие шаги

1. **Stage 4** — создать `frontend/src/pages/PublicProfilePage.jsx`, добавить маршрут `/u/:uid` в `App.jsx` (БЕЗ `AuthGate` — публичная страница), заменить кнопку «Поделиться» в `ProfileScreen.jsx` на использование `${PUBLIC_BASE_URL}/u/${uid}` вместо `qrData.qr_data`.
2. **Stage 5.1** — инструкция пользователю выполнить `/setdomain` в BotFather (это единственное, что осталось из кода).
3. **Stage 5.4** — запустить `auto_frontend_testing_agent` для E2E-теста всех 4 auth-провайдеров.

---

## 📝 Лог изменений

| Дата | Что сделано |
|------|-------------|
| 2025-07-17 | Создан план `instrProfileAuth.md` |
| 2025-07-17 | Stage 1: Установлены зависимости (python-jose, passlib[bcrypt], email-validator) |
| 2025-07-17 | Stage 1: Создан `auth_utils.py` с JWT/bcrypt/UID утилитами |
| 2025-07-17 | Stage 1: Добавлены Pydantic модели (User, AuthTokenResponse и др.) |
| 2025-07-17 | Stage 1: Создана коллекция `users` с миграцией из `user_settings` |
| 2025-07-17 | Stage 1: Реализовано 13 auth endpoints (email/telegram/vk/qr + me/link/check-username/profile-step) |
| 2025-07-17 | Stage 1: Backend успешно протестирован (deep_testing_backend_v2) — 100% pass rate |
| 2025-07-17 | Stage 2: Созданы 7 новых `/api/u/{uid}/*` endpoints (профиль, расписание, QR, share-link, privacy, view) |
| 2025-07-17 | Stage 2: Добавлен helper `resolve_user_by_uid()` для унификации поиска |
| 2025-07-17 | Stage 2: Исправлены BUG-1 (share-link для владельца), BUG-2 (activity-ping требует JWT), BUG-3 (view не считает для скрытых), BUG-4 (qr для анонимов), BUG-5 (created_at всем), BUG-7 (добавлены uid/username в UserProfilePublic), BUG-8 (TTL index 7 дней) |
| 2025-07-17 | Stage 2: Backend успешно протестирован (27/27 tests passed, 100%) |
| 2025-07 (аудит) | Stage 3: подтверждён как ✅ завершённый — исправлено противоречивое «Не начато» при всех отмеченных [x]. В репо присутствуют: `AuthContext.jsx` (230 LOC), `authAPI.js`, `authStorage.js`, `publicBase.js`, 4 страницы (`LoginPage`, `RegisterWizard`, `VKCallbackPage`, `QRConfirmPage`), 10 компонентов в `components/auth/`, `AuthGate` защищает `/` в `App.jsx` |
| 2025-07 (аудит) | Stage 5: переквалифицирован в 🟡 «Частично готово» — frontend+backend код для Telegram Login Widget, VK ID OAuth и QR Cross-Device Login реализован; осталось `/setdomain` в BotFather и E2E-тестирование |
| 2025-07 (аудит) | `AI_CONTEXT.md` обновлён: 15→20 backend файлов, 17 675→19 826 LOC server.py, 230→249 Pydantic моделей, 268→304 endpoints, 46→53 коллекции MongoDB (добавлены `users`, `auth_sessions`, `auth_qr_sessions`, `qr_login_sessions`, `profile_views`, `xp_events`), описана структура `pages/`, `components/auth/`, `AuthContext`, обновлены переменные `.env` (`JWT_*`, `TELEGRAM_BOT_USERNAME`) |
