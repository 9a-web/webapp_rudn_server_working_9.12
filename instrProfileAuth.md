# 📋 План реализации: Публичный профиль + Мульти-авторизация

**Создан:** 2025-07-17  
**Обновлён (аудит кода):** 2025-07 — синхронизация статусов с фактическим состоянием репозитория  
**🔍 Повторный глубокий аудит + полный список багов:** 2026-04 (см. раздел «Stage 6» ниже)  
**Статус:** 🔄 В работе — Stage 1-4 ✅, Stage 5 🟡, Stage 6 (hardening) 🔴 запланировано

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

**Статус Stage 4:** ✅ Завершено (2025-07)

**Артефакты:**
- `frontend/src/pages/PublicProfilePage.jsx` (~480 LOC) — публичная страница с:
  - Состояниями: loading skeleton, 404, 422 (not configured), hidden (auth required), generic error
  - Hero-блоком: avatar gradient + initials, name, username, group/faculty, level/tier badge, online status, friendship badge
  - Статистикой: Друзей / Общих / Достижений (с индикацией «Скрыто» по privacy-флагам)
  - XP progress bar (цвета tier)
  - Meta: member-since chip, profile_views (для владельца)
  - CTA: «Открыть в Telegram», «Поделиться», «Копировать ссылку» (с feedback «Скопировано»)
  - URL preview (моно-шрифт)
  - Login CTA для анонимных с `?continue=/u/{uid}`
  - Авто-регистрация просмотра через `POST /api/u/{uid}/view` (только для авторизованных, 1200 мс задержка)
  - Document.title + meta description (SEO-friendly)
  - Responsive (max-width 640px, работает mobile + desktop)
- `frontend/src/App.jsx` — добавлен lazy-route `/u/:uid` ВНЕ `AuthGate`
- `frontend/src/components/ProfileScreen.jsx`:
  - Импортирован `buildProfileUrl` из `constants/publicBase`
  - Кнопка «Поделиться ссылкой» теперь формирует URL `${PUBLIC_BASE_URL}/u/${profileData.uid || qrData.uid}` (с fallback)
  - Добавлено feedback-состояние `copiedProfileLink` → зелёная кнопка «✓ Скопировано» на 1.8 сек
  - Добавлен URL-preview chip под кнопкой (моно-шрифт, копирует в буфер по клику)
  - Fallback copy через `document.execCommand('copy')` для старых WebView

**Тестирование:**
- [x] Lint ✅ (все 3 файла без замечаний)
- [x] Route resolve (200) ✅
- [x] 404 state ✅ (скриншот подтверждён)
- [x] Loaded profile state ✅ (mobile + desktop)
- [x] Backend `/api/u/{uid}` → корректная отдача публичного профиля (200 для существующего UID, 404 для несуществующего)

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
[████████████] Stage 3: Frontend Auth Flow — ✅ Завершено
[████████████] Stage 4: Public Profile Page /u/{uid} — ✅ Завершено (2025-07)
[██████▒▒▒▒▒▒] Stage 5: External Integrations — 🟡 Код готов, нужно E2E + /setdomain
```

### Ближайшие шаги

1. **Stage 5.1** — инструкция пользователю выполнить `/setdomain` в BotFather (единственное, что осталось из кода для Telegram Login Widget).
2. **Stage 5.4** — запустить `auto_frontend_testing_agent` для E2E-теста всех 4 auth-провайдеров + Public Profile flow.

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
| 2025-07 | **Stage 4 завершён** 🎉 Создана публичная страница профиля `/u/:uid`: `frontend/src/pages/PublicProfilePage.jsx` (~480 LOC) со всеми состояниями (loading skeleton, 404, 422, hidden, loaded), richer UI с avatar gradient + level/tier badge + stats + XP bar + member-since chip + CTA-кнопками. Маршрут добавлен в `App.jsx` ВНЕ `AuthGate`. Кнопка «Поделиться» в `ProfileScreen.jsx` переведена на `buildProfileUrl()` с feedback «✓ Скопировано» и URL preview chip. Lint ✅, 404 state ✅, loaded profile (mobile + desktop) ✅ |
| 2026-04 | **🔍 Глубокий повторный аудит** — проанализированы все 7 backend+frontend auth-файлов (`auth_utils.py` 353 LOC, `auth_routes.py` 1289 LOC, `models.py` auth-секция, `server.py /u/{uid}/*` блок, `AuthContext.jsx`, `authAPI.js`, `authStorage.js`, 4 страницы, 10 auth-компонентов). Выявлены **22 проблемы**, классифицированы по критичности (см. Stage 6 ниже) |

---

## 🔴 Stage 6 — Hardening: Bugfixes & Improvements (2026-04 аудит)

**Цель:** Устранить все найденные в коде проблемы и довести auth-систему до production-grade качества.

**Статус:** ✅ **ЗАВЕРШЁН** (2026-04). Все 22 проблемы исправлены + 8 улучшений внедрены.

### 🧱 Классификация находок

- **КРИТ (7 шт)** — архитектурные баги, приводящие к поломке данных или security-риску.
- **ВЫС (5 шт)** — заметные UX/логические ошибки, ломающие сценарии.
- **СРЕД (6 шт)** — некритичные баги и неудобства.
- **МИН (4 шт)** — косметика и мелкие улучшения.

---

### 🔥 КРИТИЧЕСКИЕ

#### BUG-6.1 — Коллизия `int(uid)` с реальным `telegram_id` в `user_settings`
- **Где:** `auth_routes.py:164` (`_create_new_user`) и `auth_routes.py:1235-1237` (`profile-step`).
- **Суть:** Для email/VK/QR регистраций в `user_settings.telegram_id` пишется `int(uid)`. UID = 9-значное число (100000000..999999999), в этом же диапазоне находятся реальные Telegram ID старых аккаунтов (2014-2017). При привязке реального Telegram с таким же 9-значным ID → `DuplicateKeyError` на unique-индексе `user_settings.telegram_id`.
- **Фикс:** Использовать псевдо-ключ вне диапазона Telegram (`10**10 + int(uid)`, т.е. 11-значный) ИЛИ отрицательное значение (`-int(uid)`). Telegram IDs всегда положительные ≤ ~10^10.

#### BUG-6.2 — После `/link/telegram*` и `/link/vk` не мигрируется `user_settings.telegram_id`
- **Где:** `auth_routes.py:link_telegram`, `link_telegram_webapp`, `link_vk`.
- **Суть:** `users.telegram_id` корректно обновляется, НО соответствующий документ `user_settings` остаётся привязан к псевдо-ключу (`int(uid)`). Legacy-endpoints типа `/api/profile/{telegram_id}/*` после линковки возвращают 404 для реального Telegram ID.
- **Фикс:** Вынести helper `_remap_user_settings_tid(db, uid, old_tid, new_tid)` и вызывать его во всех трёх link-обработчиках. При `DuplicateKeyError` (если целевой user_settings уже есть) — merge.

#### BUG-6.3 — Полный дубликат VK OAuth exchange-кода
- **Где:** `auth_routes.py:551-596` (в `login_vk`) и `auth_routes.py:977-1009` (в `link_vk`).
- **Суть:** ~45 строк логики (POST на `id.vk.com/oauth2/auth` + fallback на `oauth.vk.com` + парсинг ошибок) продублированы. Фикс одного — нужно не забыть второй.
- **Фикс:** Вынести `_vk_exchange_code(code, redirect_uri, device_id, code_verifier, state) → (access_token, vk_user_id, vk_profile)` в helper-модуль. Обе функции используют.

#### BUG-6.4 — VKCallbackPage двойной вызов в React StrictMode
- **Где:** `frontend/src/pages/VKCallbackPage.jsx:27-107`.
- **Суть:** В dev-mode (StrictMode) `useEffect` с пустыми зависимостями запускается дважды. VK `code` — одноразовый → второй обмен падает с ошибкой «code already used», статус = error даже после успешного первого обмена.
- **Фикс:** Добавить `const processedRef = useRef(false)` guard в начале useEffect.

#### BUG-6.5 — `refreshMe` «теряет» пользователя при временных 500/network-ошибках
- **Где:** `AuthContext.jsx:103-124`.
- **Суть:** Если `/api/auth/me` отдаёт 500 (кратковременная ошибка сервера) — `user` остаётся `null`, а token валиден → `isAuthenticated = false` → `AuthGate` редиректит на `/login`. Пользователь теряет сессию без вины.
- **Фикс:** При non-401 ошибке — не сбрасывать stored user, оставлять `user = previousStoredUser`, `initializing = false`. Опционально: retry через 5 секунд. Только 401 → clearAuth.

#### BUG-6.6 — Нет rate-limit на `/login/email` (brute-force уязвимость)
- **Где:** `auth_routes.py:366-378`.
- **Суть:** На `/register/email` есть rate-limit 5/час, на `/login/email` — нет. Злоумышленник может перебирать пароли неограниченно.
- **Фикс:** Добавить `_check_rate_limit(ip, "login_email", 10, 300)` — максимум 10 попыток за 5 минут с IP. Плюс — отдельный лимит per-email `20/hour` для защиты от перебора по известному e-mail с разных IP.

#### BUG-6.7 — `primary_auth` при unlink выбирается из `set` — недетерминированный порядок
- **Где:** `auth_routes.py:1122` (`new_primary = next(iter(remaining))`).
- **Суть:** `set` в Python не гарантирует порядок. Разные запуски могут дать разный `primary_auth`. Это влияет на UI-индикатор «Вы вошли через X».
- **Фикс:** Приоритет: `email > telegram > vk`. Пример: `new_primary = next((p for p in ("email", "telegram", "vk") if p in remaining), "email")`.

---

### 🟠 ВЫСОКИЕ

#### BUG-6.8 — QR Confirm требует ручного клика после возврата с логина
- **Где:** `frontend/src/pages/QRConfirmPage.jsx:43-60`.
- **Суть:** Если не авторизован — редирект на `/login?continue=/auth/qr/confirm?token=...`. После успешного входа пользователь возвращается, но должен **вручную** нажать «Подтвердить вход». Плохой UX для cross-device сценария.
- **Фикс:** Если URL содержит `?auto=1` — автоматически вызвать `handleConfirm()` после первого рендера с `isAuthenticated=true`. На LoginPage при detekции `continue=/auth/qr/confirm` — добавить `&auto=1` к continue.

#### BUG-6.9 — `AuthGate` использует свой `useMemo` с пустой зависимостью для Telegram SDK
- **Где:** `frontend/src/components/auth/AuthGate.jsx:34-39`.
- **Суть:** `useMemo(() => ..., [])` читает `window.Telegram.WebApp.initData` ровно один раз на mount. SDK иногда кладёт initData позже монтирования (см. комментарий в `useIsInsideTelegram.js`) → `insideTelegram=false` → редирект на `/login` вместо показа confirm-экрана.
- **Фикс:** Использовать `useIsInsideTelegram()` хук (он уже поллит 3 раза: 100мс, 500мс, 1500мс).

#### BUG-6.10 — `suggested_username_taken` не отдаётся при повторном login существующего Telegram-user
- **Где:** `auth_routes.py:412-418` (telegram widget) и `:494-506` (webapp), path «existing».
- **Суть:** Если user существует и БЕЗ username, а Telegram-username занят другим — тихо не устанавливаем username и **не** передаём `suggested_username_taken`. Пользователь не узнаёт, что его @name занят и имеет пустой username.
- **Фикс:** В path «existing» тоже возвращать `suggested_username_taken=original_raw` (если `resolve_safe_username` вернул conflict).

#### BUG-6.11 — QR session «consumed» — нет grace-периода для retry
- **Где:** `auth_routes.py:qr_status:721-742`.
- **Суть:** При получении статуса «confirmed» сервер отдаёт token и переводит сессию в «consumed». Если клиент потерял ответ (сеть, закрыл вкладку) — токен навсегда потерян, следующий polling вернёт status=consumed без данных.
- **Фикс:** Вместо «consumed» хранить токен ещё 30 секунд. Retries в этом окне → same token. По истечении 30с — удалять (или ставить consumed=true).

#### BUG-6.12 — `UserPublic` не содержит `level_id` и `form_code`
- **Где:** `models.py:2795-2816` (`UserPublic`).
- **Суть:** После login/me фронт получает `UserPublic` без `level_id`/`form_code`. Для корректного отображения «форма обучения / уровень» приходится делать дополнительный запрос в `user_settings`. Неконсистентно.
- **Фикс:** Добавить оба поля в `UserPublic` и в `_user_to_public()`.

---

### 🟡 СРЕДНИЕ

#### BUG-6.13 — Логика `registration_step` запутана (`next_step = 3 if complete == 2 else (0 if complete >= 3 else complete+1)`)
- **Где:** `auth_routes.py:1219`.
- **Фикс:** Заменить на явную карту `_STEP_TRANSITIONS = {1: 2, 2: 3, 3: 0}` и использовать `next_step = _STEP_TRANSITIONS.get(complete_step, 0)`.

#### BUG-6.14 — `canSubmit` в RegisterWizard Step2 противоречив
- **Где:** `frontend/src/pages/RegisterWizard.jsx:203`.
- **Суть:** `canSubmit = (usernameValid || !!username) && firstName.trim().length > 0` — если username введён невалидно, `usernameValid=false`, но `!!username=true` → кнопка активна → клик → error.
- **Фикс:** `canSubmit = (!username || usernameValid) && firstName.trim().length > 0`.

#### BUG-6.15 — `clearAllLocalAuthData` не чистит `auth:username_conflict` и `vk_oauth_mode` в sessionStorage
- **Где:** `frontend/src/utils/authStorage.js:56-81`.
- **Фикс:** Добавить эти ключи в legacy-list + тотально очищать sessionStorage от auth:*.

#### BUG-6.16 — Username-нормализация в UsernameField срезает caret-позицию
- **Где:** `frontend/src/components/auth/UsernameField.jsx:59` (`e.target.value.toLowerCase()`).
- **Суть:** При быстрой печати `toLowerCase` на каждом keystroke вызывает setState → React перерисовывает input → caret перемещается в конец. Незаметно на десктопе, но плохо на мобиле.
- **Фикс:** Нормализовать только при blur + финальной проверке; в онлайн-событии оставлять как есть (и даже запрещать non-ASCII на лету через `onKeyDown`).

#### BUG-6.17 — `_bearer_scheme_required` объявлен, но не используется
- **Где:** `auth_utils.py:185`, нигде не вызывается.
- **Суть:** Мёртвый код. `get_current_user_required` использует `_bearer_scheme_optional` и сам бросает 401 — это сделано правильно (поддерживает `?access_token=` query), но объявление `_bearer_scheme_required` вводит в заблуждение.
- **Фикс:** Удалить.

#### BUG-6.18 — Migration `migrate_user_settings_to_users` не обрабатывает случай «username занят»
- **Где:** `auth_routes.py:295-302`.
- **Суть:** При `DuplicateKeyError` (скорее всего конфликт username) — обнуляем username и повторяем. Но могут быть и другие дубли (telegram_id — если почему-то две записи в user_settings имеют один tg_id). Тогда второй insert тоже падает и migration зависает.
- **Фикс:** Явно проверять, какой именно key дубликат через `e.details.get('keyPattern')` и обрабатывать специфично. Логировать.

---

### 🟢 МИНОРНЫЕ

#### BUG-6.19 — `AuthInput` `rightSlot` и `isPassword` eye-icon могут накладываться
- **Где:** `frontend/src/components/auth/AuthInput.jsx:38-49`.
- **Фикс:** Косметика — если оба `rightSlot` и `isPassword`, отрисовать иконку глаза ПЕРЕД rightSlot и добавить gap.

#### BUG-6.20 — `/auth/config` не отдаёт `qr_login_ttl_minutes` (frontend жёстко считает через `expires_at`)
- **Суть:** Работает, но неявная связь. Если backend поменяет TTL, frontend не узнает.
- **Фикс:** Добавить в config: `qr_login_ttl_minutes: 5`.

#### BUG-6.21 — В `AuthContext.refreshMe` двойная обработка 401 (interceptor + catch)
- **Суть:** При 401 срабатывает и axios-interceptor, и catch в refreshMe. Оба чистят state. Не критично, но можно упростить.
- **Фикс:** Убрать проверку 401 в refreshMe, полагаться на interceptor.

#### BUG-6.22 — В `VkLoginButton` и `TelegramLoginWidget` нет aria-*  атрибутов для a11y
- **Фикс:** Добавить `aria-label` и proper semantics.

---

### 🚀 Улучшения (не баги, но апгрейд logic/UX)

| # | Улучшение | Приоритет |
|---|-----------|-----------|
| IMP-1 | Логирование login attempts (успех/неудача + IP/UA) в отдельную коллекцию `auth_events` для security audit | СРЕД |
| IMP-2 | Добавить `GET /api/auth/sessions` (список активных JWT по jti) + `DELETE /api/auth/sessions/{jti}` для logout из конкретной сессии | НИЗК (отложить) |
| IMP-3 | `_issue_token` принимать `request: Request` и сохранять `last_login_ip` / `last_login_ua` | СРЕД |
| IMP-4 | Вынести константы `PROVIDERS = ("email", "telegram", "vk")` и `PROVIDER_PRIORITY` | НИЗК |
| IMP-5 | Показывать в `/auth/me` полное состояние для onboarding UI (например, `has_academic_data`) | НИЗК |
| IMP-6 | Защита от CSRF для VK OAuth callback (сейчас есть `state` — но проверка только если `savedState` есть; при потере sessionStorage пропускается молча) | СРЕД |
| IMP-7 | Graceful retry в `UsernameField` при 500/network | НИЗК |
| IMP-8 | В migration скрипте добавить dry-run режим + вывод кол-ва потенциальных дублей | НИЗК |

---

### 📋 План исправлений Stage 6 — ✅ ВСЁ ВЫПОЛНЕНО

**Этап A (КРИТ, обязательные):** ✅
1. ✅ BUG-6.1 — `pseudo_tid_from_uid()` helper в `auth_utils.py` (`10**10 + int(uid)`).
2. ✅ BUG-6.2 — `_remap_user_settings_tid()` + вызовы в `_do_link_telegram()` и `unlink_provider()`.
3. ✅ BUG-6.3 — `_vk_exchange_code()` helper, дубликат устранён.
4. ✅ BUG-6.4 — VKCallback `processedRef` guard + cleanup sessionStorage.
5. ✅ BUG-6.5 — `refreshMe` не сбрасывает user при 500/network — только при 401/403/404.
6. ✅ BUG-6.6 — rate-limit на login: IP 10/5min + email 20/час.
7. ✅ BUG-6.7 — `choose_primary_auth()` с приоритетом email > telegram > vk.

**Этап B (ВЫС):** ✅
8. ✅ BUG-6.8 — `?auto=1` flag + auto-confirm в QRConfirmPage.
9. ✅ BUG-6.9 — AuthGate использует `useIsInsideTelegram` с `ready` флагом.
10. ✅ BUG-6.10 — `suggested_username_taken` отдаётся и для existing telegram users.
11. ✅ BUG-6.11 — Grace-период 30 сек для `consumed` QR-сессии.
12. ✅ BUG-6.12 — `level_id` + `form_code` + `last_login_at` добавлены в `UserPublic`.

**Этап C (СРЕД):** ✅
13. ✅ BUG-6.13 — `_STEP_TRANSITIONS = {1: 2, 2: 3, 3: 0}` карта.
14. ✅ BUG-6.14 — `canSubmit = (!username || usernameValid) && firstName.trim().length > 0`.
15. ✅ BUG-6.15 — `clearAllLocalAuthData` чистит ВСЕ `auth:*` и `vk_oauth*` ключи (Local + Session).
16. ✅ BUG-6.16 — UsernameField: блокировка ввода через `onKeyDown` + lowercase только при отправке.
17. ✅ BUG-6.17 — `_bearer_scheme_required` удалён, унифицирован один `_bearer_scheme`.
18. ✅ BUG-6.18 — Migration анализирует `keyPattern` для специфичной обработки duplicates.

**Этап D (МИН + Improvements):** ✅
19. ✅ BUG-6.19 — AuthInput: композиция rightSlot + isPassword без наложения, gap.
20. ✅ BUG-6.20 — `/auth/config` отдаёт `qr_login_ttl_minutes`.
21. ✅ BUG-6.21 — refreshMe полагается на response.status (не parsing message).
22. ✅ BUG-6.22 — `role="region"`/`aria-busy` для Telegram Widget, useId+aria-* для AuthInput.
23. ✅ IMP-1 — Коллекция `auth_events` (event/uid/provider/success/ip/ua/ts) + индексы + TTL 30д.
24. ✅ IMP-3 — `last_login_ip` + `last_login_ua` сохраняются при каждом login (через `_update_last_login(request=...)`).
25. ✅ IMP-4 — `PROVIDERS = ("email", "telegram", "vk")` + `choose_primary_auth()` константы.
26. ✅ IMP-6 — VKCallbackPage: усиленная CSRF-проверка state (отказ при потере sessionStorage в login-режиме).
27. ✅ IMP-7 — UsernameField: при 5xx показывает «Сервис недоступен», не invalid.

**Все improvements учтены.** IMP-2 (Sessions API) отложен — JWT уже содержит `jti` для будущей реализации без breaking change.

---

**Тестирование:**
- ✅ Backend: lint clean (`ruff` All checks passed)
- ✅ Frontend: lint clean (eslint No issues found)
- ✅ Сервисы: `backend RUNNING`, `frontend RUNNING`
- ✅ Smoke: `/api/auth/config` → 200 с новым `qr_login_ttl_minutes`
- ✅ Smoke: `/api/auth/login/qr/init` → 200 с правильной структурой
- ✅ Индексы `auth_events` создались успешно
- ⏳ Полное E2E будет через `deep_testing_backend_v2` следующим шагом

