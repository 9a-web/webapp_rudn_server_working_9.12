# 📋 План интеграции VK ID OAuth

**Дата создания:** 2025-07-06  
**Статус:** В процессе  
**ENV:** test

---

## Данные VK ID приложения

| Параметр | Значение |
|----------|----------|
| App ID | 54426792 |
| Client Secret | yIej7gAG0WLQiULrFAVB |
| Redirect URL | https://rudn-schedule.ru/api/music/vk-callback |
| Домен | https://rudn-schedule.ru |

---

## Архитектура VK ID OAuth 2.0 (Authorization Code Flow)

```
┌─────────────────────────────────────────────────────────────────┐
│                     Telegram WebApp                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  1. Пользователь нажимает "Подключить VK"                    ││
│  │  2. Открывается VK ID OAuth в браузере                       ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     VK ID (id.vk.com)                            │
│  - Пользователь вводит логин/пароль                             │
│  - Подтверждает разрешения (audio + аккаунт)                    │
│  - VK редиректит на callback URL с code                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ GET /api/music/vk-callback?code=xxx
┌─────────────────────────────────────────────────────────────────┐
│                     FastAPI Backend                              │
│  1. Получает code из query params                               │
│  2. Обменивает code на access_token через VK API                │
│  3. Проверяет токен и доступ к аудио                            │
│  4. Сохраняет токен в MongoDB                                   │
│  5. Редиректит обратно в WebApp с результатом                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## План реализации

### Этап 1: Backend - Обновление конфигурации OAuth
- [x] Обновить VK_OAUTH_CONFIG с новыми данными приложения
- [x] Изменить response_type на "code" (Authorization Code Flow)
- [ ] Добавить client_secret в .env

**Статус:** ✅ Завершено (конфиг обновлён)

### Этап 2: Backend - Callback эндпоинт
- [x] Создать GET /api/music/vk-callback
- [x] Реализовать обмен code на access_token
- [x] Добавить проверку state для CSRF защиты
- [x] Реализовать редирект в WebApp после авторизации

**Статус:** ✅ Завершено

### Этап 3: Backend - Хранение state
- [x] Добавить временное хранение state в MongoDB/memory
- [x] Связать state с telegram_id для безопасности

**Статус:** ✅ Завершено

### Этап 4: Frontend - Обновление VKAuthModal
- [x] Упростить процесс (только кнопка авторизации)
- [x] Убрать поле ввода URL с токеном
- [x] Добавить параметр telegram_id в OAuth URL
- [x] Обработка результата авторизации через WebApp URL

**Статус:** ✅ Завершено

### Этап 5: Тестирование
- [ ] Проверить полный flow авторизации
- [ ] Проверить получение аудиозаписей
- [ ] Проверить обработку ошибок

**Статус:** ⏳ Ожидает

---

## API Endpoints (обновлённые)

### GET /api/music/auth/config
Получить URL для OAuth авторизации VK ID.

**Response:**
```json
{
  "auth_url": "https://id.vk.com/authorize?...",
  "app_id": 54426792,
  "redirect_uri": "https://rudn-schedule.ru/api/music/vk-callback"
}
```

### GET /api/music/vk-callback
Callback для VK OAuth. Получает code, обменивает на token, сохраняет.

**Query params:**
- `code` - код авторизации от VK
- `state` - state для CSRF защиты (содержит telegram_id)

**Response:** Redirect в WebApp или HTML страница с результатом

### GET /api/music/auth/status/{telegram_id}
Статус авторизации пользователя (без изменений).

### DELETE /api/music/auth/{telegram_id}
Отключение VK аккаунта (без изменений).

---

## Изменения в файлах

| Файл | Изменения |
|------|-----------|
| `/app/backend/.env` | Добавить VK_CLIENT_SECRET |
| `/app/backend/server.py` | Обновить VK_OAUTH_CONFIG, добавить callback endpoint |
| `/app/frontend/src/components/music/VKAuthModal.jsx` | Упростить UI |
| `/app/frontend/src/services/musicAPI.js` | Обновить getVKOAuthConfig |

---

## Лог выполнения

### 2025-07-06 - Начало работы
- Создан план интеграции
- Проанализирована текущая реализация (Kate Mobile OAuth)
- Определены необходимые изменения для VK ID App

### 2025-07-06 - Реализация Backend
- ✅ Обновлена конфигурация VK_OAUTH_CONFIG
- ✅ Создан эндпоинт /api/music/vk-callback
- ✅ Реализован обмен code на access_token
- ✅ Добавлена поддержка state с telegram_id
- ✅ Добавлен client_secret в .env

### 2025-07-06 - Реализация Frontend
- ✅ Обновлён VKAuthModal для нового flow
- ✅ Добавлена передача telegram_id через state
- ✅ Упрощён интерфейс (только кнопка авторизации)
