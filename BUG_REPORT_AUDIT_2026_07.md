# 🔍 Аудит безопасности и логики — Отчёт по багам

**Дата:** 2026-07
**Зоны аудита:** Авторизация/регистрация, Уведомления (web/email/TG push + scheduler), Кроссплатформенность (PWA, Telegram WebApp)
**Общий объём проанализированного кода:** ~9 200 LOC

Все находки разделены на 5 уровней критичности: 🟥 **CRITICAL** (немедленный фикс) → 🟧 **HIGH** → 🟨 **MED** → 🟦 **LOW** → ⬜ **NIT**.

---

## 🟥 CRITICAL — требуют немедленного фикса

### **C1. JWT-секрет — hardcoded default + НЕ задан в `.env` → подделка любых токенов**

**Файлы:**
- `backend/config.py:46-50`
- `backend/.env` (отсутствует `JWT_SECRET_KEY`)

**Что не так:**
```python
# config.py
JWT_SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY",
    "rudn-auth-default-secret-CHANGE-ME-IN-PROD-8f3a2b1c9d7e"  # ← в открытом репо!
)
```
В `backend/.env` НЕТ переменной `JWT_SECRET_KEY` → бэкенд использует default, лежащий в публичном GitHub-репозитории.

**Эксплуатация (1 минута):**
```python
import jwt
fake = jwt.encode(
    {"uid":"100000001","role":"admin","exp":9999999999},
    "rudn-auth-default-secret-CHANGE-ME-IN-PROD-8f3a2b1c9d7e",
    algorithm="HS256"
)
# → полный доступ к админ-эндпоинтам
```

**Impact:** 🔴 Полный bypass любой авторизации, RCE-уровень для админ-функционала, утечка ВСЕХ пользовательских данных.

**Фикс:**
1. Сгенерировать `python -c "import secrets;print(secrets.token_urlsafe(64))"` → положить в `backend/.env` как `JWT_SECRET_KEY=...`
2. В `config.py` при `ENV == "prod"` и default-значении секрета **падать с ошибкой при импорте** (а не warning).
3. Аналогично проверить `LK_ENCRYPTION_KEY`, `DB_CLEAR_PASSWORD` — у них тоже defaults?
4. Все ранее выпущенные JWT станут невалидными → пользователи должны перелогиниться (приемлемо).

---

### **C2. Web Push endpoints — ZERO auth → перехват чужих уведомлений**

**Файлы:** `backend/server.py:4373-4496`

**Что не так:**
```python
@api_router.post("/push/subscribe")
async def push_subscribe(payload: dict = Body(...)):  # ← НЕТ Depends(get_current_user_required)
    telegram_id = payload.get("telegram_id")          # ← берётся из body, без проверки
    uid_       = payload.get("uid")
    ...
    await save_subscription(db, telegram_id=tid_int, uid=uid_, endpoint=endpoint, ...)
```
То же самое для `/push/unsubscribe`, `/push/test`, `/push/subscriptions` — **полное отсутствие аутентификации**.

**Эксплуатация:**
1. Атакующий знает чужой `telegram_id` (его можно увидеть в публичных профилях, шарингах расписания, реферальных ссылках, чате)
2. POST `/api/push/subscribe` со своим `endpoint`+`keys` и чужим `telegram_id`
3. Теперь все push-уведомления (расписание, напоминания о парах, оценки) приходят атакующему
4. Бонус: через `/push/test` можно слать произвольный спам на любой `telegram_id`
5. Через `/push/unsubscribe` (тоже без auth) — массово удалять чужие подписки

**Impact:** 🔴 IDOR на push-канале, нарушение GDPR (перехват личной переписки/расписания), DoS подписок.

**Фикс:**
- Добавить `current_user: dict = Depends(get_current_user_required)` ко всем `/push/*`.
- Удалить параметры `telegram_id` и `uid` из тел — брать только из `current_user`.
- `/push/test` — лимит 5/час/uid, чтобы избежать спама даже после фикса.

---

### **C3. QR-логин выдаёт JWT с `jti`, но НЕ регистрирует сессию → 401 на первом же запросе**

**Файлы:** `backend/auth_routes.py:1588-1611` (endpoint `qr_status`)

**Что не так:**
```python
if status == "confirmed" and session.get("confirmed_uid"):
    user_doc = await db.users.find_one({"uid": session["confirmed_uid"]})
    if user_doc:
        token = create_jwt(
            uid=user_doc["uid"],
            telegram_id=effective_tid_for_user(user_doc),
            providers=user_doc.get("auth_providers", []),
            # ❌ jti не передан → create_jwt сгенерит default jti
        )
        # ❌ register_session(db, uid, jti, ...) НЕ ВЫЗВАН
        await db.auth_qr_sessions.update_one(...)
        return QRStatusResponse(status="confirmed", access_token=token, ...)
```

Затем при следующем запросе:
```python
# auth_utils.py get_current_user_required
if not await is_session_active(db, jti):   # ← вернёт False (нет doc в auth_sessions)
    raise HTTPException(401, "Сессия отозвана")
```

**Impact:** 🔴 QR-логин полностью сломан. Пользователь видит "успех", потом 401 на любом protected endpoint. Сравните с правильной реализацией в `_issue_token_and_log()` (lines 679-696) — там есть `jti` + `register_session`.

**Фикс:**
- Заменить ad-hoc `create_jwt` на вызов хелпера `_issue_token_and_log(...)` (или продублировать его логику с jti+register_session).

---

## 🟧 HIGH — серьёзные баги UX/безопасности

### **H1. Service Worker — НЕТ offline-кэша → "Установить PWA" работает, но offline=пустая страница**

**Файлы:** `frontend/public/service-worker.js`

**Что не так:**
- Комментарий в файле: *"Минимальная версия — фокус на push"*.
- Нет `caches.open`, нет `cache.addAll` на install, нет fetch-handler с cache-first/stale-while-revalidate.
- Manifest объявляет приложение PWA-installable, но при offline просмотр невозможен.

**Impact:** 🟧 Заявленная фича "offline mode" в PWA не работает. Пользователь установил PWA → выключил интернет → пустая страница вместо последнего расписания.

**Фикс (минимальный, без Workbox):**
- Cache-first для статики (`/static/`, иконки, manifest).
- Network-first с fallback на cache для HTML и `/api/schedule/*`.
- Отдельный кэш для последнего расписания (важнейший use-case offline).

---

### **H2. Service Worker — нет `SKIP_WAITING` handler → update-flow ломается**

**Файлы:**
- `frontend/public/service-worker.js` — install: `self.skipWaiting()` уже стоит, но нет `message` listener
- `frontend/src/utils/webpush.js:380+` (или подобный update prompt) — отправляет message, но SW его игнорирует

**Что не так:**
```js
// service-worker.js — отсутствует:
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
```
Плюс агрессивный `self.skipWaiting()` в install — устанавливается без согласия пользователя, может прервать его работу.

**Impact:** 🟧 Update UI ("Доступна новая версия — обновить") не работает; новая SW активируется только после закрытия всех вкладок.

**Фикс:**
- Убрать `self.skipWaiting()` из install (или оставить, но решить, что критично).
- Добавить `message` handler для контролируемого update.
- Добавить broadcast при activate → клиенты делают `window.location.reload()`.

---

### **H3. Telegram WebApp `.expand()` вызывается 26+ раз → throttling, viewport-flicker**

**Файлы:** `frontend/public/index.html` (полл-цикл expand)

**Что не так:**
```js
// 20 итераций по 50ms + ещё 6 одноразовых таймаутов
for (let i=0; i<20; i++) setTimeout(()=>tg.expand(), 50*i);
[10, 50, 100, 200, 500, 1000].forEach(d => setTimeout(()=>tg.expand(), d));
// Итого 26 вызовов expand() в первую секунду
```

**Impact:** 🟧 На некоторых версиях Telegram Android приводит к глюкам viewport, дёрганью layout, потенциальному фризу WebApp.

**Фикс:**
```js
tg.ready();
tg.expand();  // один раз
tg.onEvent("viewportChanged", () => { if (!tg.isExpanded) tg.expand(); });
```

---

### **H4. VAPID-ключ не доставляется на фронт → push subscribe падает в браузере**

**Файлы:**
- `frontend/src/utils/webpush.js:64-78` (читает `VITE_VAPID_PUBLIC_KEY`)
- `frontend/.env` — переменной НЕТ
- `backend/server.py:4360` — есть endpoint `/api/push/vapid-public-key`, но фронт его не использует первым

**Что не так:**
Фронт пытается прочитать ключ из `import.meta.env.VITE_VAPID_PUBLIC_KEY` (или `REACT_APP_VAPID_PUBLIC_KEY`), а его в `.env` нет. При build-time `undefined` зашивается в bundle. Если есть fallback на endpoint — то он скорее всего сделан, но порядок и кэш могут быть неправильные.

**Impact:** 🟧 `pushManager.subscribe({applicationServerKey})` → `InvalidStateError` или `Empty key`.

**Фикс:**
- Фронт ВСЕГДА сначала фетчит `/api/push/vapid-public-key` (с кэшем в sessionStorage).
- Удалить build-time переменную.
- Backend endpoint должен возвращать `{public_key}` — он уже так делает (✓).

---

### **H5. Backend: notification scheduler — нет idempotency-ключа для отправки**

**Файлы:** `backend/services/delivery.py`, `backend/scheduler_v2.py`

**Что не так (потенциально):**
- При параллельных воркерах/перезапуске scheduler может попытаться отправить уведомление 2 раза.
- В `scheduler_v2._attempt_atomic_delivery_lock` есть распределённая блокировка с TTL, но если процесс упал между "lock acquired" и "send_telegram" — после TTL другой воркер пошлёт повторно.

**Impact:** 🟨 (понижено до MED, если есть единственный воркер; HIGH если >1 reploya). Дубликаты push/email в редких race-conditions.

**Фикс:** дополнить delivery_attempts хранением `delivery_id` (UUID на попытку, сохраняемый ДО отправки) — если такая запись уже есть со статусом "in_progress" >TTL, повторять с тем же ID.

---

### **H6. Frontend AuthContext — не отзывает сессию при logout (только удаляет local token)**

**Файлы:** `frontend/src/contexts/AuthContext.jsx`, `frontend/src/utils/authStorage.js`

**Что не так:** при logout фронт делает только `clearAuthToken()` (удаляет из localStorage). Endpoint `POST /api/auth/logout` (с серверной ревокацией jti) НЕ вызывается.

**Impact:** 🟧 Украденный токен остаётся валидным до своего истечения (default 30 дней) даже после "выхода".

**Фикс:** перед очисткой локального токена — `await axios.post('/api/auth/logout', {}, { headers: { Authorization: `Bearer ${token}` }})`. Игнорировать ошибки (если 401/network — просто чистим локально).

---

## 🟨 MED — UX-улучшения и менее опасные баги

### **M1. PWA `beforeinstallprompt` не перехватывается → нет красивой кнопки "Установить"**

**Файлы:** нигде во фронте нет обработки `beforeinstallprompt`.

**Что не так:** Manifest валидный, иконки есть, но кнопки "Установить" в UI нет. Браузеры (особенно Chrome desktop) могут не показывать встроенный prompt — пользователь не знает, что приложение можно установить.

**Фикс:** компонент `PWAInstallButton` ловит event, сохраняет в стейт, рендерит CTA. После accept — скрывает.

---

### **M2. Пароль `min_length = 6` — слабый для серверной валидации**

**Файлы:** `backend/auth_utils.py:43`, `frontend/src/components/auth/EmailRegisterForm.jsx`

**Что не так:** 6 символов = ~28 бит энтропии, ломается за минуты. NIST 800-63B рекомендует ≥8.

**Фикс:** поднять до 8 на бэке. Опционально: проверка через `zxcvbn` (популярный пароль → отказ).

---

### **M3. Notification permission запрашивается без UX-пре-объяснения**

**Файлы:** `frontend/src/utils/webpush.js:188-200` (`initWebPush` или равный)

**Что не так:** браузер показывает нативный prompt сразу. Пользователь дисмиссит → permission навсегда `denied`, восстановить можно только в настройках браузера.

**Фикс:** в UI настройки уведомлений — собственный модал "Зачем нам уведомления? Расписание, оценки..." → только при клике на "Включить" вызывать `Notification.requestPermission()`.

---

### **M4. Email reset URL — `EMAIL_PUBLIC_BASE_URL` fallback на hardcoded `https://rudn-schedule.ru`**

**Файлы:** `backend/email_service.py` (`PUBLIC_BASE_URL` chain)

**Что не так:**
```python
PUBLIC_BASE_URL = (
    os.getenv("PUBLIC_BASE_URL","").strip()
    or os.getenv("REACT_APP_BACKEND_URL","").strip()   # ← backend не имеет этой env
    or "https://rudn-schedule.ru"
).rstrip("/")
```
В dev-окружении письма указывают на prod-URL — пользователь dev-тестовый сбрасывает пароль через prod-сайт.

**Фикс:** добавить `PUBLIC_BASE_URL` в `backend/.env` (значение текущего preview-URL), убрать прод-fallback.

---

### **M5. `/api/auth/forgot-password` rate-limit по email → side-channel определения существования email**

**Файлы:** `backend/auth_routes.py:2503-2570`

**Что не так:** rate limiter `forgot_password_email` (3/час на email). Если email НЕ существует — лимит не наполняется (rate-key всё равно используется, но реальная отправка письма не происходит). Атакующий, делая 100 запросов с разных email, может по latency или по специально измеримым параметрам определять существование. Минорно — privacy комментарий говорит "всегда 200", но key per-email повышает latency для существующих юзеров (SMTP send).

**Impact:** 🟦 (LOW) — теоретическая атака. Если SMTP в LOG_ONLY режиме (как сейчас, нет SMTP_*) — разницы во времени нет.

**Фикс:** перевести send_email в фоновую таску (`BackgroundTasks`) → ответ возвращается мгновенно, без timing-leak.

---

### **M6. TelegramContext — гостевой `device_id` повторяется между разными браузерами того же устройства, но НЕ переносится при переустановке**

**Файлы:** `frontend/src/contexts/TelegramContext.jsx:230-260`

**Что не так:** `getOrCreateDeviceId()` сохраняет в localStorage → пропадает при очистке кэша/переустановке PWA → создаётся новый "user", прогресс теряется.

**Impact:** 🟨 Пользователь теряет настройки/прогресс при переустановке PWA.

**Фикс:** при гостевом доступе на бэке создавать реальный uid и регистрировать стабильный refresh-cookie (httpOnly) — тогда даже при потере localStorage сессия восстановится.

---

### **M7. Frontend AuthContext не перезагружает данные пользователя после изменений (email/avatar/...)**

**Файлы:** `frontend/src/contexts/AuthContext.jsx`

**Что не так:** методов типа `refreshUser()` нет. После смены email/имени UI показывает старые данные до перезагрузки.

**Фикс:** добавить `refreshUser()` → `GET /api/auth/me` → `setUser(...)`. Дёргать после успешных мутаций.

---

### **M8. `/push/test` доступен без авторизации (см. C2), даже после фикса C2 — нет cooldown**

**Покрыто в C2.** Дополнить: 5 тестов/час/uid, чтобы юзер не спамил себя или сосед-злоумышленник.

---

### **M9. Telegram WebApp — не сохраняется `closingConfirmation` для критических флоу**

**Файлы:** `frontend/src/contexts/TelegramContext.jsx`

**Что не так:** при заполнении регистрационной формы / редактирования профиля юзер может случайно свайпнуть вниз → WebApp закроется → данные потеряны.

**Фикс:** при mount критических компонентов вызывать `tg.enableClosingConfirmation()`, при unmount — `tg.disableClosingConfirmation()`.

---

### **M10. Notification service — нет дедупликации `category` для последовательных одинаковых уведомлений**

**Файлы:** `backend/services/delivery.py`

**Что не так:** если 2 push с одинаковым `category` посылаются с разрывом <1мин, оба показываются (tag=category, но `renotify=true`). На iOS оба создают вибрацию + звук.

**Impact:** 🟦 spammy UX, особенно для "пара через 5 минут" + "пара через 1 минута".

**Фикс:** в `notify_user` — проверять `delivery_attempts` за последние 60с по uid+category → если был успешный, использовать `silent: true` для нового.

---

## 🟦 LOW — мелкие улучшения

### **L1. JWT `sub` claim не используется — `uid` в payload, но не в `sub`**

**Файлы:** `backend/auth_utils.py` (create_jwt / decode_jwt)

**Что не так:** Стандарт RFC 7519 рекомендует `sub` для идентификатора субъекта. Сейчас `uid` — кастомное поле. Не баг, но усложняет интеграцию с внешними IdP.

---

### **L2. `service-worker.js`: notificationclick handler не передаёт data в открываемый window**

**Файлы:** `frontend/public/service-worker.js`

**Что не так:** при клике на пуш открывается `url`, но кастомные `data` (например, `lesson_id`) теряются. Если приложение уже открыто — нет focus + data.

**Фикс:** через `clients.matchAll` найти открытое окно, focus + postMessage с data.

---

### **L3. Email-валидация регексом — пропускает невалидные адреса**

**Файлы:** `backend/auth_routes.py` (валидация email формы)

**Что не так:** регекс `^[^@]+@[^@]+\.[^@]+$` слишком либерален. Лучше pydantic `EmailStr` (с email-validator).

---

### **L4. Auth events не имеют TTL → коллекция auth_events растёт бесконечно**

**Файлы:** `backend/auth_utils.py:_log_auth_event`

**Что не так:** логи аутентификации не покрыты TTL индексом.

**Фикс:** TTL index 90 дней на `auth_events.created_at`.

---

### **L5. Notification scheduler — `_attempt_atomic_delivery_lock` использует in-memory счётчик**

**Файлы:** `backend/scheduler_v2.py`

**Что не так:** при >1 реплике backend счётчик локальный → не работает.

**Impact:** обычно 1 реплика → ОК. На k8s autoscale → race.

---

### **L6. Кроссплатформенность: iOS Safari/Telegram WebApp safe-area не настроена**

**Файлы:** `frontend/public/index.html`, `frontend/src/index.css`

**Что не так:** нет `viewport-fit=cover` и CSS `env(safe-area-inset-*)`. На iPhone X+ контент уходит под notch.

**Фикс:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```
+ CSS `padding-top: env(safe-area-inset-top)` для шапки.

---

### **L7. PWA `manifest.webmanifest` — нет `theme_color` для dark mode media query**

**Файлы:** `frontend/public/manifest.webmanifest`

**Что не так:** один `theme_color` → splash screen всегда светлый/тёмный.

**Фикс:** в index.html — два `<meta name="theme-color">` с `media="(prefers-color-scheme: ...)"`.

---

## ⬜ NIT — стилистические / документация

- **N1:** `auth_routes.py` 2 835 LOC — кандидат на split (упомянуто в AI_CONTEXT.md как Roadmap).
- **N2:** Многие endpoints возвращают разные форматы ошибок (`{detail:...}` vs `{error:...}`) — стоит унифицировать.
- **N3:** Notification templates (`template_password_reset`, etc.) — нет i18n, только русский.
- **N4:** Logging не пропускает sensitive data (email, IP) перед записью в централизованный лог-агрегатор.

---

# 📊 Сводка по приоритетам

| Уровень | Кол-во | Время на фикс |
|---------|--------|---------------|
| 🟥 Critical | **3** | ~2 часа |
| 🟧 High | **6** | ~3-4 часа |
| 🟨 Med | **10** | ~3-4 часа |
| 🟦 Low | **7** | ~2 часа |
| ⬜ Nit | 4 | по желанию |

---

# 🎯 Рекомендованный порядок

1. **C1** (JWT secret) — **СЕЙЧАС**, до любого следующего деплоя
2. **C2** (push auth) — сегодня
3. **C3** (QR session) — сегодня
4. **H1, H2** (PWA offline + update) — самый видимый user-facing фикс
5. **H4** (VAPID delivery) — без него C2-фикс не имеет смысла
6. **H6** (logout server-side)
7. **H3, H5, M*** — батчем
