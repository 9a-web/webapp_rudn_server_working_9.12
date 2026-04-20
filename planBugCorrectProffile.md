# 🐛 PLAN: Bug Correction & Improvements — Public Profile + Auth

> **Контекст:** Полный анализ модулей «Публичный профиль» и «Регистрация/Авторизация» проекта `webapp_rudn_server_working_9.12`.
> **Цель:** Исправить ВСЕ найденные баги и максимально улучшить логику работы.
> **Базис:** `instrProfileAuth.md` — стадии 1-6 + hardening BUG-6.1…6.22 уже завершены.
> **Дата:** 2026-01-21
> **Автор анализа:** AI agent (full-stack)

---

## 📚 Оглавление

1. [Объём аудита](#1-объём-аудита)
2. [Сводная таблица багов](#2-сводная-таблица-багов-23-шт)
3. [ФАЗА 1 — P0 Critical (Безопасность + Целостность)](#фаза-1--p0-critical)
4. [ФАЗА 2 — P1 Important (UX + БД + Качество данных)](#фаза-2--p1-important)
5. [ФАЗА 3 — P2 Polish (Cleanup + Edge cases)](#фаза-3--p2-polish)
6. [План тестирования](#6-план-тестирования)
7. [Критерии Definition-of-Done](#7-критерии-definition-of-done)
8. [Откатные сценарии](#8-откатные-сценарии)

---

## 1. Объём аудита

### 1.1 Backend (~22 800 LOC)
| Файл | LOC | Назначение |
|---|---|---|
| `backend/auth_routes.py` | 1565 | 8 login endpoints, link/unlink, QR-flow, profile-step, check-username, /me, /logout, /config |
| `backend/auth_utils.py` | 469 | JWT, bcrypt, UID, pseudo-TID, Telegram HMAC, in-memory rate-limit, normalize_username, resolve_safe_username |
| `backend/migrate_users.py` | 108 | Идемпотентная миграция user_settings → users |
| `backend/server.py` | sections | `/u/{uid}/*` (resolve, profile, schedule, qr, share-link, privacy GET/PUT, view), `get_user_profile`, `get_profile_share_link`, `register_profile_view`, `_resolve_user_by_uid`, `profile_activity_ping` |
| `backend/models.py` | sections | `User`, `UserPublic`, Auth requests/responses, `UpdateProfileStepRequest`, `ProfileViewRequest` |

### 1.2 Frontend
| Файл | LOC | Назначение |
|---|---|---|
| `src/contexts/AuthContext.jsx` | 275 | JWT state, /me, axios interceptors, login/register/link/QR методы |
| `src/services/authAPI.js` | 87 | Тонкий REST-клиент для /api/auth/* |
| `src/utils/authStorage.js` | 126 | localStorage/sessionStorage для JWT + legacy cleanup |
| `src/pages/RegisterWizard.jsx` | 414 | 3-шаговый wizard регистрации (метод → профиль → академ.данные) |
| `src/pages/LoginPage.jsx` | 163 | Tabs Email / Telegram / VK / QR |
| `src/pages/VKCallbackPage.jsx` | 178 | OAuth callback с PKCE и StrictMode-guard |
| `src/pages/QRConfirmPage.jsx` | 150 | Подтверждение QR с другого устройства |
| `src/pages/PublicProfilePage.jsx` | 751 | Публичный профиль по UID |
| `src/components/auth/*` | 10 файлов | AuthGate, AuthInput/Button/Layout, EmailLoginForm, EmailRegisterForm, UsernameField, QRLoginBlock, TelegramLoginWidget, TelegramWebAppLoginButton, TelegramWebAppConfirm, VkLoginButton |
| `src/hooks/useIsInsideTelegram.js` | 104 | Реактивный детектор Telegram WebApp |

---

## 2. Сводная таблица багов (23 шт)

| # | Severity | Категория | Файл | Краткое описание |
|---|---|---|---|---|
| **B-01** | 🔴 P0 | Security | `LoginPage.jsx` | Open Redirect через ?continue= |
| **B-02** | 🔴 P0 | Security/DoS | `auth_routes.py` | Нет rate-limit на qr_init/confirm/link/unlink/profile-step/check-username |
| **B-03** | 🔴 P0 | Concurrency | `auth_routes.py` | Race condition в QR confirm (не атомарно) |
| **B-04** | 🔴 P0 | Concurrency | `auth_routes.py` | Race condition при создании user через Telegram/VK (DuplicateKeyError 409 вместо retry-and-login) |
| **B-05** | 🔴 P0 | Security | `auth_utils.py` | IP spoofing через X-Forwarded-For (нет TRUST_PROXY allowlist) |
| **B-06** | 🔴 P0 | Privacy | `server.py` `/u/{uid}/resolve` | Утечка `auth_providers` анонимам + игнор `show_in_search` |
| **B-07** | 🔴 P0 | UX bug | `UsernameField.jsx` | Race condition: stale debounce-ответ перетирает свежий результат |
| **B-08** | 🟡 P1 | DB hygiene | server startup | Нет TTL-индексов на `auth_qr_sessions`, `profile_views`, `auth_events` |
| **B-09** | 🟡 P1 | UX bug | `VKCallbackPage.jsx` | На ошибке sessionStorage не чистится → ретрай ломается |
| **B-10** | 🟡 P1 | UX bug | `QRLoginBlock.jsx` | Background tab тротлит polling до 1мин — QR истекает раньше |
| **B-11** | 🟡 P1 | Data quality | `auth_routes.py` | `update_profile_step` затирает поля пустыми строками |
| **B-12** | 🟡 P1 | Data quality | `models.py` | `RegisterEmailRequest` не валидирует длину first/last_name |
| **B-13** | 🟡 P1 | UX bug | `QRConfirmPage.jsx` | autoRef после error блокирует повторное подтверждение |
| **B-14** | 🟡 P1 | UX bug | `AuthContext.jsx` | На 401 сбрасываем токен, но не редиректим — пользователь видит сломанный экран |
| **B-15** | 🟡 P1 | Privacy | `auth_routes.py` | Email кладётся в auth_events.extra открытым текстом (PII в логах) |
| **B-16** | 🟡 P1 | Performance | `PublicProfilePage.jsx` | Каждый mount шлёт /view (даже когда backend дедупит) |
| **B-17** | 🟡 P1 | Memory leak | `auth_utils.py` | `_rate_limits` dict растёт линейно — нет cleanup |
| **B-18** | 🟢 P2 | Code quality | `auth_routes.py` | `_user_to_public`/`_STEP_TRANSITIONS` импортируются откуда-то — проверить, что они существуют (см. analyze step) |
| **B-19** | 🟢 P2 | Edge case | `AuthContext.jsx` | HMR может удваивать interceptors |
| **B-20** | 🟢 P2 | UX | `server.py` share-link | `PUBLIC_BASE_URL` пустой → `public_link="/u/123"` без хоста — фронт может неправильно склеить |
| **B-21** | 🟢 P2 | Memory | `auth_utils.py` | Пустые buckets в `_rate_limits` не удаляются |
| **B-22** | 🟢 P2 | DoS | `auth_routes.py` | Нет лимита размера `extra` в `_log_auth_event` |
| **B-23** | 🟢 P2 | UX | `models.py` | `username` нельзя сбросить (min_length=3 не даёт `null`/`""`) |

---

# ФАЗА 1 — P0 Critical

> **Цель:** Закрыть дыры в безопасности и устранить race conditions, через которые легитимные пользователи получают ошибки.

---

## B-01 — Open Redirect в LoginPage

### Проблема
```jsx
// src/pages/LoginPage.jsx:38, 52
const continueUrl = searchParams.get('continue') || '/';
useEffect(() => {
  if (isAuthenticated) {
    if (needsOnboarding) navigate('/register', { replace: true });
    else navigate(continueUrl, { replace: true });  // ← БЕЗ ВАЛИДАЦИИ
  }
}, [isAuthenticated, needsOnboarding, navigate, continueUrl]);
```

### Сценарий атаки
1. Жертва получает ссылку `https://app.rudn/login?continue=//attacker.com/phish`
2. Логинится → `navigate("//attacker.com/phish")`
3. React Router интерпретирует `//host/path` как **protocol-relative URL** → редирект на `https://attacker.com/phish`
4. Жертва попадает на фишинг-сайт, выглядящий как RUDN

Также атакует: `?continue=https://attacker.com`, `?continue=javascript:alert(1)`, `?continue=data:text/html,...`

### Исправление
Создать утилиту `safeContinueUrl()` и использовать её во ВСЕХ местах редиректа.

**Файлы:**
- Создать: `frontend/src/utils/safeRedirect.js`
- Изменить: `LoginPage.jsx` (1 место), `VKCallbackPage.jsx` (1 место), `QRConfirmPage.jsx` (1 место), `AuthGate.jsx` (1 место)

```js
// frontend/src/utils/safeRedirect.js
/**
 * Sanitize continue/redirect URL для предотвращения Open Redirect.
 * Принимает только internal pathname:
 *   ✓ "/profile/123"
 *   ✓ "/settings?tab=privacy"
 *   ✗ "//evil.com" (protocol-relative)
 *   ✗ "https://evil.com"
 *   ✗ "javascript:..."
 *   ✗ "data:..."
 */
export const safeContinueUrl = (raw, fallback = '/') => {
  if (!raw || typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  // Должен начинаться со слэша, но НЕ с двух (protocol-relative)
  if (!trimmed.startsWith('/')) return fallback;
  if (trimmed.startsWith('//')) return fallback;
  // Запрещаем backslashes (некоторые браузеры превращают \ в /)
  if (trimmed.includes('\\')) return fallback;
  // Запрещаем control chars
  if (/[\x00-\x1F\x7F]/.test(trimmed)) return fallback;
  // Длина — sane upper bound
  if (trimmed.length > 2048) return fallback;
  return trimmed;
};
```

**Тестирование:**
- Unit: `safeContinueUrl("//evil.com") === "/"`, `safeContinueUrl("/ok?x=1") === "/ok?x=1"`
- E2E: открыть `/login?continue=//google.com`, логин → должно быть `/`

---

## B-02 — Отсутствие rate-limit на чувствительных endpoint'ах

### Проблема
В `auth_routes.py` rate-limit стоит ТОЛЬКО на:
- `register/email` — IP
- `login/email` — IP + email

**Открыто без лимита:**
- `qr/init` — можно засрать БД миллионом QR-сессий
- `qr/confirm` — можно угадывать чужие QR-токены брутфорсом
- `qr/{token}/status` — без auth, polling без лимита (ddos-able)
- `link/email`, `link/telegram`, `link/telegram-webapp`, `link/vk` — массовая привязка
- `unlink/{provider}` — массовый unlink
- `profile-step` — спам обновлений профиля
- `check-username/{username}` — enumeration атак на занятые ники
- `login/telegram`, `login/telegram-webapp`, `login/vk` — основные login endpoint'ы (зависят только от криптопроверки, но всё равно нужен лимит)

### Исправление
Расширить `_RATE_LIMITS` и добавить `check_rate_limit` во все указанные endpoint'ы.

```python
# auth_routes.py — расширяем _RATE_LIMITS dict (примерно строка 80-110)
_RATE_LIMITS = {
    # Existing
    "register_email_ip":  (5, 3600),    # 5 регистраций / IP / час
    "login_email_ip":     (20, 600),    # 20 попыток / IP / 10мин
    "login_email_email":  (10, 600),    # 10 попыток / email / 10мин

    # NEW — Stage 7
    "login_telegram_ip":  (30, 600),    # /login/telegram + /login/telegram-webapp
    "login_vk_ip":        (15, 600),
    "qr_init_ip":         (20, 600),    # 20 QR / IP / 10 мин
    "qr_init_ua":         (10, 600),    # 10 QR / UA / 10 мин (доп. сигнал)
    "qr_status_ip":       (300, 60),    # 5 polls/sec/IP — для UI достаточно
    "qr_confirm_uid":     (10, 600),    # 10 confirm / uid / 10 мин
    "link_provider_uid":  (20, 3600),   # 20 link/unlink / uid / час
    "profile_step_uid":   (60, 600),    # 60 patch / uid / 10 мин (UI может слать часто)
    "check_username_ip":  (120, 60),    # 2 запроса/сек/IP (anti-enumeration)
    "check_username_uid": (60, 60),     # для авторизованных
}
```

**Шаблон применения** (на каждом endpoint'е):
```python
@router.post("/login/qr/init", response_model=QRInitResponse)
async def qr_init(request: Request):
    client_ip = get_client_ip(request)
    ua = request.headers.get("User-Agent", "")[:500]

    ip_max, ip_win = _RATE_LIMITS["qr_init_ip"]
    if not check_rate_limit(client_ip, "qr_init_ip", ip_max, ip_win):
        await _log_auth_event(db, event_type="qr_init", success=False,
                              request=request, extra={"reason": "rate_limited_ip"})
        raise HTTPException(status_code=429, detail="Слишком много QR-запросов с этого IP. Попробуйте позже.")
    ua_max, ua_win = _RATE_LIMITS["qr_init_ua"]
    if not check_rate_limit(ua, "qr_init_ua", ua_max, ua_win):
        raise HTTPException(status_code=429, detail="Слишком много QR-запросов от этого клиента. Попробуйте позже.")
    # ... existing logic
```

**Изменения:**
- `auth_routes.py`: 8 endpoint'ов, каждый получает 3-5 строк лимитера в начале

**Тестирование:**
- Cycle: 21 запрос на /qr/init с одного IP → 21-й = 429
- Cycle: 11 confirm на один uid → 11-й = 429
- Smoke: лимиты НЕ срабатывают на нормальном использовании

---

## B-03 — Race condition в QR confirm

### Проблема
```python
# auth_routes.py:1076-1110
session = await db.auth_qr_sessions.find_one({"qr_token": qr_token})
# ...
if session["status"] != "pending":
    raise HTTPException(409, ...)

await db.auth_qr_sessions.update_one(
    {"qr_token": qr_token},
    {"$set": {"status": "confirmed", "confirmed_uid": current_user["sub"], ...}},
)
```

**Проблема:** между `find_one` и `update_one` другой процесс может тоже подтвердить. В итоге БД увидит два confirm-update подряд — второй перезапишет первый. Если разные uid, это уязвимость: "А" подтвердил → "B" перезаписал на свой uid → "А" получает токен B.

### Исправление
Атомарный `find_one_and_update` с фильтром по `status: "pending"`.

```python
# auth_routes.py — qr_confirm
@router.post("/login/qr/{qr_token}/confirm")
async def qr_confirm(qr_token: str, request: Request,
                     current_user: Dict[str, Any] = Depends(get_current_user_required)):
    # Rate limit (см. B-02)
    uid = current_user["sub"]
    rl_max, rl_win = _RATE_LIMITS["qr_confirm_uid"]
    if not check_rate_limit(uid, "qr_confirm_uid", rl_max, rl_win):
        raise HTTPException(429, "Слишком много подтверждений. Попробуйте позже.")

    now = datetime.now(timezone.utc)

    # Атомарно претендуем на pending-сессию
    session = await db.auth_qr_sessions.find_one_and_update(
        {
            "qr_token": qr_token,
            "status": "pending",
            "expires_at": {"$gt": now},  # ещё не истекла
        },
        {
            "$set": {
                "status": "confirmed",
                "confirmed_uid": uid,
                "confirmed_at": now,
                "confirmed_ip": get_client_ip(request),
                "confirmed_ua": request.headers.get("User-Agent", "")[:500],
            }
        },
        return_document=False,  # достаточно знать что update произошёл
    )

    if not session:
        # Не найдена ИЛИ не pending ИЛИ просрочена — выясняем точную причину
        existing = await db.auth_qr_sessions.find_one({"qr_token": qr_token})
        if not existing:
            raise HTTPException(404, "QR-сессия не найдена")
        if existing.get("expires_at") and existing["expires_at"] < now.replace(tzinfo=None):
            raise HTTPException(410, "QR-сессия истекла")
        raise HTTPException(409, f"QR-сессия уже в статусе {existing.get('status')}")

    await _log_auth_event(db, event_type="qr_confirm", uid=uid,
                          provider="qr", success=True, request=request)
    return {"success": True, "message": "QR подтверждён"}
```

---

## B-04 — Race condition при создании user через Telegram/VK

### Проблема
```python
# auth_routes.py:712-776, 801-866
existing = await db.users.find_one({"telegram_id": tg_id})
if existing: ... # update + return
# else:
user_doc = await _create_new_user(db, telegram_id=tg_id, ...)
# _create_new_user → DuplicateKeyError → 409 Conflict
```

При параллельных логинах (например, юзер 2 раза кликнул кнопку) второй запрос:
1. Видит `existing=None`
2. Пытается insert → `DuplicateKeyError`
3. Получает 409 — некорректное поведение, должен залогиниться существующим пользователем

### Исправление
Внутри `_create_new_user` обработать `DuplicateKeyError` по `telegram_id` (или `vk_id`) и **прозрачно** вернуть существующий документ.

```python
# auth_routes.py — _create_new_user
async def _create_new_user(...) -> dict:
    # ... сборка doc ...
    try:
        await db.users.insert_one(doc)
    except DuplicateKeyError as e:
        # Race-recovery: если конфликт по telegram_id или vk_id —
        # значит параллельный запрос успел создать. Возвращаем его.
        pattern = (getattr(e, "details", None) or {}).get("keyPattern", {}) or {}
        if "telegram_id" in pattern and telegram_id:
            existing = await db.users.find_one({"telegram_id": telegram_id})
            if existing:
                logger.info(f"⚡ Race recovered: telegram_id={telegram_id} → uid={existing['uid']}")
                return existing
        if "vk_id" in pattern and vk_id:
            existing = await db.users.find_one({"vk_id": vk_id})
            if existing:
                logger.info(f"⚡ Race recovered: vk_id={vk_id} → uid={existing['uid']}")
                return existing
        if "email" in pattern and email:
            existing = await db.users.find_one({"email": email})
            if existing:
                logger.info(f"⚡ Race recovered: email={email} → uid={existing['uid']}")
                return existing
        # Не race по нашим ключам — настоящий конфликт
        logger.warning(f"Duplicate key on user create (no race recovery): {e}")
        raise HTTPException(status_code=409,
            detail="Конфликт уникальных полей при создании пользователя")
    # ... остальной код (user_settings mirror) ...
    return doc
```

**Внимание:** для email-flow это работать не должно (race на регистрацию = валидный 409 "email занят"), но для Telegram/VK — это норма.

Альтернативно: вызвать `is_new = False` при race-recovery и не отправлять welcome-email/etc. Передать через возвращаемый dict дополнительный флаг:

```python
return doc, was_race_recovered  # tuple
```

Если хочется не ломать API `_create_new_user`, добавим внутри doc служебный ключ `_race_recovered: True` и почистим перед возвратом.

---

## B-05 — IP spoofing через X-Forwarded-For

### Проблема
```python
# auth_utils.py:245-256
def get_client_ip(request):
    xff = request.headers.get("X-Forwarded-For", "")
    if xff:
        return xff.split(",")[0].strip()
    ...
```

Если приложение **за reverse proxy** (Kubernetes ingress, Caddy, nginx), правильно. Но если кто-то делает прямой запрос к backend (или подделывает заголовок до прокси) — может выдать любой IP.

В контейнере backend на 0.0.0.0:8001 за k8s ingress — ingress _всегда_ ставит правильный X-Forwarded-For. Но злоумышленник может **добавить** в существующий заголовок: ingress сделает `X-Forwarded-For: 1.2.3.4` (real), а атакующий пришлёт `X-Forwarded-For: 9.9.9.9` → ingress склеит `9.9.9.9, 1.2.3.4` и `split(",")[0]` вернёт ПОДДЕЛЬНЫЙ IP.

### Исправление
Брать **последний** IP из `X-Forwarded-For` (это IP, который ingress видел напрямую). Если больше доверенных прокси — брать предпоследний и т.д. Через ENV `TRUST_PROXY_HOPS`.

```python
# config.py — добавить
TRUST_PROXY_HOPS = int(os.environ.get("TRUST_PROXY_HOPS", "1"))

# auth_utils.py — get_client_ip
def get_client_ip(request: Request) -> str:
    if not request:
        return "unknown"

    from config import TRUST_PROXY_HOPS

    xff = request.headers.get("X-Forwarded-For", "")
    if xff and TRUST_PROXY_HOPS > 0:
        # Берём IP с позиции -TRUST_PROXY_HOPS (с конца)
        # При TRUST_PROXY_HOPS=1 — последний IP в цепочке = тот, что видит наш ingress
        # При =0 — игнорируем XFF полностью
        ips = [ip.strip() for ip in xff.split(",") if ip.strip()]
        if ips:
            idx = max(0, len(ips) - TRUST_PROXY_HOPS)
            return ips[idx]

    real_ip = request.headers.get("X-Real-IP", "")
    if real_ip:
        return real_ip.strip()

    return request.client.host if request.client else "unknown"
```

**Дефолт:** `TRUST_PROXY_HOPS=1` (k8s ingress). Можно повысить если за CDN/Cloudflare.

---

## B-06 — `/u/{uid}/resolve` — privacy leak

### Проблема
```python
# server.py:16737-16760
@api_router.get("/u/{uid}/resolve")
async def resolve_uid(uid: str):
    user = await _resolve_user_by_uid(uid)
    ...
    return {
        "uid": uid,
        "telegram_id": user.get("telegram_id"),
        "display_name": display_name,
        "username": user.get("username"),
        "has_telegram": bool(user.get("telegram_id")),
        "auth_providers": user.get("auth_providers", []),  # ← ЛИКАЕМ!
    }
```

**Проблема 1:** `auth_providers` доступен анонимам — раскрывает к чему привязан профиль (полезно для socio-инженерии: "Васи нет в VK → попробуем Telegram").

**Проблема 2:** Endpoint не уважает `privacy.show_in_search` — даже если юзер скрыл себя из поиска, его UID всё равно резолвится.

**Проблема 3:** `telegram_id` отдаём анонимам — не критично, но это deanonymization.

### Исправление
1. Убрать `auth_providers` для анонимов (показывать только владельцу)
2. При `show_in_search=False` — резолв работает (т.к. пользователь явно дал ссылку), но **минимум полей**
3. `telegram_id` отдавать только владельцу/другу

```python
# server.py — resolve_uid
@api_router.get("/u/{uid}/resolve")
async def resolve_uid(
    uid: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    user = await _resolve_user_by_uid(uid)
    if not user:
        raise HTTPException(404, "Пользователь не найден")

    target_tid = user.get("telegram_id")
    viewer_tid = current_user.get("tid") if current_user else None
    viewer_uid = current_user.get("sub") if current_user else None

    is_owner = (viewer_uid == uid) or (viewer_tid and target_tid and int(viewer_tid) == int(target_tid))

    # Privacy: проверяем show_in_search для не-владельцев
    is_friend = False
    if target_tid and viewer_tid and not is_owner:
        is_friend = await check_friendship(int(target_tid), int(viewer_tid))

    if not is_owner and target_tid:
        privacy = await get_user_privacy_settings(int(target_tid))
        if not privacy.show_in_search and not is_friend:
            # Минимальный отклик — пусть фронт покажет "профиль приватный"
            return {
                "uid": uid,
                "telegram_id": None,
                "display_name": "Скрытый профиль",
                "username": None,
                "has_telegram": False,
                "auth_providers": [],
                "is_hidden": True,
            }

    display_name = (
        f"{user.get('first_name', '') or ''} {user.get('last_name', '') or ''}".strip()
        or user.get("username")
        or f"User {uid}"
    )

    response = {
        "uid": uid,
        "display_name": display_name,
        "username": user.get("username"),
        "has_telegram": bool(target_tid),
        "is_hidden": False,
    }

    # auth_providers + telegram_id — только владельцу или другу
    if is_owner or is_friend:
        response["telegram_id"] = target_tid
        response["auth_providers"] = user.get("auth_providers", [])
    else:
        response["telegram_id"] = None
        response["auth_providers"] = []

    return response
```

**Влияние на фронт:** `PublicProfilePage` использует `resolve` для preview-fetch. Если поле `is_hidden=true` — показывать упрощённый view "Профиль скрыт". Нужно проверить, что фронт корректно обрабатывает.

---

## B-07 — Race condition в UsernameField (stale debounce)

### Проблема
```jsx
// UsernameField.jsx:50-71
useEffect(() => {
  // ...
  setStatus('checking');
  clearTimeout(timerRef.current);
  timerRef.current = setTimeout(async () => {
    try {
      const res = await authAPI.checkUsername(normalized);  // ← await
      if (res.available) {
        setStatus('available');
        onValidChange?.(true);
      } else {
        setStatus('taken'); ...
      }
    } catch (e) { ... }
  }, 400);
  return () => clearTimeout(timerRef.current);
}, [value, onValidChange]);
```

**Сценарий бага:**
1. Юзер набирает `joh` → debounce 400ms → запрос #1 (сетевой 800ms)
2. Через 200ms набирает `john` → новый useEffect → `clearTimeout` отменяет debounce
3. Но запрос #1 уже летит и вернётся через 600ms
4. Юзер ждёт 400ms → запрос #2 на `john` (сетевой 200ms)
5. Запрос #2 возвращается первым → status="available" для `john` ✓
6. Запрос #1 возвращается → status="taken" для `joh` (если совпало) → перетирает корректный результат

### Исправление
Sequence-id + AbortController:

```jsx
// UsernameField.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AtSign, Check, X, Loader2 } from 'lucide-react';
import AuthInput from './AuthInput';
import { authAPI } from '../../services/authAPI';

// ... constants ...

const UsernameField = ({ value, onChange, onValidChange }) => {
  const [status, setStatus] = useState('idle');
  const [reason, setReason] = useState(null);
  const timerRef = useRef(null);
  const seqRef = useRef(0);          // sequence-id для отбрасывания stale
  const abortRef = useRef(null);     // AbortController для отмены fetch

  useEffect(() => {
    // Cleanup предыдущего in-flight запроса
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch { /* noop */ }
      abortRef.current = null;
    }

    if (!value) {
      setStatus('idle'); setReason(null);
      onValidChange?.(false);
      return undefined;
    }
    const normalized = value.toLowerCase();
    if (!USERNAME_RE.test(normalized)) {
      setStatus('invalid');
      setReason('3–32 символа, только a-z, 0-9, _');
      onValidChange?.(false);
      return undefined;
    }

    setStatus('checking');
    setReason(null);
    clearTimeout(timerRef.current);

    // Закрепляем sequence для этого "хода"
    const mySeq = ++seqRef.current;

    timerRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        // authAPI.checkUsername нужно расширить чтобы принимать signal
        const res = await authAPI.checkUsername(normalized, { signal: ctrl.signal });
        // Дискард если запрос устарел
        if (mySeq !== seqRef.current) return;
        if (res.available) {
          setStatus('available'); setReason(null); onValidChange?.(true);
        } else {
          setStatus('taken'); setReason(res.reason || 'Занято'); onValidChange?.(false);
        }
      } catch (e) {
        if (mySeq !== seqRef.current) return;  // устаревший
        if (ctrl.signal.aborted) return;       // мы сами отменили
        const code = e?.response?.status;
        if (code && code >= 500) {
          setStatus('invalid'); setReason('Сервис недоступен. Попробуйте ещё раз.');
        } else {
          setStatus('invalid'); setReason(e.message);
        }
        onValidChange?.(false);
      }
    }, 400);

    return () => {
      clearTimeout(timerRef.current);
      if (abortRef.current) {
        try { abortRef.current.abort(); } catch { /* noop */ }
      }
    };
  }, [value, onValidChange]);

  // ... остальной JSX ...
};
```

**Также:** `authAPI.checkUsername` нужно обновить чтобы принимать `{ signal }`:

```js
// authAPI.js
checkUsername: unwrap((username, opts = {}) =>
  axios.get(`${BASE}/check-username/${encodeURIComponent(username)}`, {
    ...withAuth(),
    signal: opts.signal,
  })),
```

---

# ФАЗА 2 — P1 Important

> **Цель:** UX, качество данных, гигиена БД.

---

## B-08 — TTL-индексы

### Проблема
Коллекции **растут вечно**:
- `auth_qr_sessions` — каждая попытка QR-логина создаёт запись (даже expired/consumed)
- `profile_views` — каждый просмотр чужого профиля
- `auth_events` — каждый login/register/link/unlink/error (особенно много при rate-limit спаме)

В production это в течение месяца даст **миллионы документов**, медленные запросы, splitting issues.

### Исправление
В `server.py` startup создать TTL-индексы.

Найти место (`@app.on_event("startup")`) и добавить:

```python
# server.py — в startup-функции
async def _ensure_auth_ttl_indexes():
    """Создаёт TTL-индексы для cleanup auth-данных."""
    try:
        # QR sessions: удалять через 1 час после expires_at
        # Используем expires_at + expireAfterSeconds=3600 (1 час grace)
        await db.auth_qr_sessions.create_index(
            "expires_at", expireAfterSeconds=3600, name="qr_ttl"
        )
        # Profile views: 30 дней
        await db.profile_views.create_index(
            "viewed_at", expireAfterSeconds=30 * 86400, name="views_ttl"
        )
        # Auth events: 90 дней (security audit)
        await db.auth_events.create_index(
            "ts", expireAfterSeconds=90 * 86400, name="events_ttl"
        )
        logger.info("✅ TTL-индексы созданы для auth-коллекций")
    except Exception as e:
        logger.warning(f"TTL index creation: {e}")

# В startup_event
await _ensure_auth_ttl_indexes()
```

**Замечание:** TTL работает раз в 60 сек (MongoDB-fixed). Не подходит для секундных дедлайнов, но для часов/дней — ок.

---

## B-09 — VKCallbackPage cleanup на ошибке

### Проблема
```jsx
// VKCallbackPage.jsx:89-129
(async () => {
  try {
    if (savedMode === 'link') { ... }
    else {
      const resp = await loginVK({ ... });
      cleanup();  // ← вызывается ТОЛЬКО при success
      ...
    }
  } catch (e) {
    setStatus('error');
    setError(...);
    // ← cleanup() НЕ вызывается
  }
})();
```

**Сценарий:** пользователь получает ошибку "VK token expired" → жмёт "Назад" → пытается снова → state в sessionStorage старый → ошибка "State mismatch".

### Исправление
Cleanup всегда:

```jsx
(async () => {
  try {
    // ...
    cleanup();
    setStatus('success');
    // ...
  } catch (e) {
    cleanup();  // ← НОВОЕ
    setStatus('error');
    setError(e.message || 'Не удалось завершить вход через VK');
  }
})();
```

---

## B-10 — QR polling при backgrounded tab

### Проблема
Браузеры тротлят `setInterval` в неактивных tab'ах:
- Chrome: до 1 раза/мин (1 секунд минимум)
- Firefox: до 1 секунды
- Safari: ставит на паузу

Если юзер переключился с RUDN-вкладки на Telegram чтобы открыть QR-сканнер, потом вернулся через 4 минуты — taymер показывает "QR истёк через 1:00", но реально QR уже истёк, а polling не успел узнать.

### Исправление
1. На `visibilitychange` — если tab стал visible:
   - Если QR pending: немедленно poll (вне расписания)
   - Если QR близок к истечению (< 30 сек) и status='pending': initSession() для нового
2. Использовать `visibilityState` чтобы понять, нужно ли отображать "Истекает через X" или "Tab был свёрнут"

```jsx
// QRLoginBlock.jsx
useEffect(() => {
  const onVisChange = () => {
    if (document.visibilityState === 'visible' && status === 'pending') {
      // Проверяем actual expires_at
      if (expiresAt && expiresAt.getTime() <= Date.now()) {
        setStatus('expired');
        stopPolling();
        return;
      }
      // Принудительный poll сразу
      (async () => {
        try {
          const resp = await authAPI.qrStatus(qrToken);
          if (resp.status === 'confirmed' && resp.access_token) {
            setStatus('confirmed');
            stopPolling();
            onSuccess?.({ access_token: resp.access_token, user: resp.user });
          } else if (resp.status === 'expired' || resp.status === 'consumed') {
            setStatus('expired');
            stopPolling();
          }
        } catch { /* noop */ }
      })();
    }
  };
  document.addEventListener('visibilitychange', onVisChange);
  return () => document.removeEventListener('visibilitychange', onVisChange);
}, [status, qrToken, expiresAt, stopPolling, onSuccess]);
```

---

## B-11 — Пустые строки в profile-step

### Проблема
```python
# auth_routes.py:1480
update_data = req.model_dump(exclude_unset=True, exclude_none=True)
```

`exclude_none` отфильтровывает только `None`. Но фронт может прислать `last_name: ""` (пустая строка из input'а) → backend сохранит `""` → перезатирание корректного значения.

### Исправление
Дополнительная фильтрация:

```python
# auth_routes.py — в update_profile_step
update_data = req.model_dump(exclude_unset=True, exclude_none=True)

# Чистим пустые строки в текстовых полях (не считаем их валидным значением)
TEXT_FIELDS = {
    "username", "first_name", "last_name",
    "facultet_id", "facultet_name", "level_id", "form_code",
    "kurs", "group_id", "group_name",
}
for field in TEXT_FIELDS:
    if field in update_data and isinstance(update_data[field], str):
        if update_data[field].strip() == "":
            del update_data[field]
        else:
            update_data[field] = update_data[field].strip()
```

---

## B-12 — Длина first_name/last_name при register/email

### Проблема
```python
# models.py:2824
class RegisterEmailRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    first_name: Optional[str] = None         # ← без max_length
    last_name: Optional[str] = None          # ← без max_length
    referral_code: Optional[str] = None
```

Юзер может прислать `first_name="A"*100000` → backend сохранит → потом ошибки в UI/индексах.

### Исправление
```python
class RegisterEmailRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    first_name: Optional[str] = Field(default=None, max_length=64)
    last_name: Optional[str] = Field(default=None, max_length=64)
    referral_code: Optional[str] = Field(default=None, max_length=64)
```

Аналогично для `TelegramLoginRequest`/`LinkTelegramRequest`/`VKLoginRequest` (где есть свободные текстовые поля).

---

## B-13 — autoRef после error в QRConfirmPage

### Проблема
```jsx
// QRConfirmPage.jsx
const autoRef = useRef(false);

useEffect(() => {
  if (!auto || !isAuthenticated || !token || status !== 'idle') return;
  if (autoRef.current) return;
  autoRef.current = true;
  handleConfirm();
}, [auto, isAuthenticated, token, status]);
```

После `handleConfirm` → ошибка (например, expired). `status='error'`. Пользователь жмёт "На главную" → возвращается → но autoRef.current=true остался → второй автоконфирм не запустится.

В большинстве случаев это OK (юзер пришёл с другого URL), но если URL содержит auto=1 и юзер обновляет страницу — autoRef сбрасывается на mount → ОК.

### Реальный баг
Случай: после ошибки status='error' → нет кнопки "Попробовать ещё раз". Логика рендера:
```jsx
{status === 'error' && (
  ...
  <AuthButton onClick={() => navigate('/')}>На главную</AuthButton>
)}
```

Нет retry-кнопки!

### Исправление
1. Добавить кнопку "Попробовать ещё раз" в error-state
2. Сбрасывать autoRef.current=false при error чтобы повторный клик работал

```jsx
const handleRetry = () => {
  setStatus('idle');
  setError(null);
  autoRef.current = false;
  // useEffect автоматически запустит handleConfirm если auto=1
  // Если auto не было — нужно явно вызвать handleConfirm
  if (!auto) {
    handleConfirm();
  }
};

{status === 'error' && (
  <div className="space-y-4">
    {/* error message */}
    <AuthButton onClick={handleRetry}>Попробовать ещё раз</AuthButton>
    <AuthButton variant="secondary" onClick={() => navigate('/')}>На главную</AuthButton>
  </div>
)}
```

---

## B-14 — Token expiry без редиректа

### Проблема
```jsx
// AuthContext.jsx:62-75
axios.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err?.response?.status;
    if (status === 401 && getToken()) {
      const url = err.config?.url || '';
      if (!url.includes('/api/auth/login') && !url.includes('/api/auth/register')) {
        try { onUnauthorized?.(); } catch { /* noop */ }
      }
    }
    return Promise.reject(err);
  },
);
```

`onUnauthorized` → `clearLocalAuth` → `setTokenState(null), setUserState(null)`. Пользователь остаётся **на текущей странице**, но AuthGate видит `isAuthenticated=false` → редиректит. Но если страница НЕ под AuthGate (например, PublicProfilePage), пользователь продолжает сидеть с сломанным состоянием.

### Исправление
Глобальный navigate-to-login через CustomEvent + react-router listener:

```jsx
// AuthContext.jsx — installAxiosInterceptors
const installAxiosInterceptors = (onUnauthorized) => {
  // ...
  axios.interceptors.response.use(
    (r) => r,
    (err) => {
      const status = err?.response?.status;
      if (status === 401 && getToken()) {
        const url = err.config?.url || '';
        if (!url.includes('/api/auth/login') && !url.includes('/api/auth/register')) {
          try { onUnauthorized?.(); } catch { /* noop */ }
          // НОВОЕ: dispatch event, на который react-router listener сделает navigate
          try {
            window.dispatchEvent(new CustomEvent('auth:session-expired', {
              detail: { from: window.location.pathname + window.location.search }
            }));
          } catch { /* noop */ }
        }
      }
      return Promise.reject(err);
    },
  );
};

// AuthProvider — useEffect с listener
useEffect(() => {
  const onSessionExpired = (e) => {
    const from = e.detail?.from || '/';
    // Используем window.location чтобы работать вне Router-context
    if (!from.startsWith('/login') && !from.startsWith('/register')) {
      window.location.href = `/login?continue=${encodeURIComponent(from)}&reason=expired`;
    }
  };
  window.addEventListener('auth:session-expired', onSessionExpired);
  return () => window.removeEventListener('auth:session-expired', onSessionExpired);
}, []);
```

В `LoginPage` добавить отображение причины:
```jsx
const reason = searchParams.get('reason');
{reason === 'expired' && (
  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
    Ваша сессия истекла. Войдите снова.
  </div>
)}
```

---

## B-15 — Email в логах

### Проблема
```python
# auth_routes.py — login_email
extra={"reason": "rate_limited_email", "email": email_norm}
extra={"reason": "no_user", "email": email_norm}
```

Email сохраняется в `auth_events.extra.email` плейн-текстом. PII в логах нарушает GDPR/152-ФЗ.

### Исправление
Хешировать email (для возможности корреляции событий по hash):

```python
# auth_utils.py — добавить
def hash_email_for_log(email: str) -> str:
    """Хеширует email для логирования (sha256, 12 hex символов)."""
    if not email:
        return ""
    return hashlib.sha256(email.lower().strip().encode("utf-8")).hexdigest()[:12]
```

Использование:
```python
extra={"reason": "no_user", "email_hash": hash_email_for_log(email_norm)}
```

В аудите можно будет искать `events.find({"extra.email_hash": "abc123def456"})`.

---

## B-16 — Spam /view запросов

### Проблема
`PublicProfilePage` каждый mount шлёт `/api/u/{uid}/view`. Backend дедупит за 1 час, но:
- Лишний network-запрос
- Уход в sleep/wake/refresh — снова запрос

### Исправление
Client-side dedup через sessionStorage:

```jsx
// PublicProfilePage.jsx
useEffect(() => {
  if (!uid || !isAuthenticated) return;
  // Локальная дедупликация: 1 view per uid per session
  const key = `view_recorded:${uid}`;
  if (sessionStorage.getItem(key)) return;
  (async () => {
    try {
      await axios.post(`${API}/api/u/${uid}/view`);
      sessionStorage.setItem(key, String(Date.now()));
    } catch { /* ignore */ }
  })();
}, [uid, isAuthenticated]);
```

---

## B-17 — Memory leak в `_rate_limits`

### Проблема
```python
# auth_utils.py:218-242
_rate_limits: dict = defaultdict(list)
def check_rate_limit(key, bucket, max_requests, window_seconds):
    full_key = f"{bucket}:{key or 'unknown'}"
    arr = _rate_limits[full_key]
    cutoff = now - window_seconds
    arr_filtered = [t for t in arr if t > cutoff]
    if len(arr_filtered) >= max_requests:
        _rate_limits[full_key] = arr_filtered
        return False
    arr_filtered.append(now)
    _rate_limits[full_key] = arr_filtered  # ← ключ остаётся НАВСЕГДА
    return True
```

Каждый уникальный IP/email/uid создаёт новый ключ. После 1M посещений — `_rate_limits` содержит 1M ключей × десятки timestamps. Память тратится впустую.

### Исправление
Периодический cleanup + max-size cap.

```python
# auth_utils.py
import asyncio

_rate_limits: dict = defaultdict(list)
_RL_LAST_CLEANUP = 0
_RL_CLEANUP_INTERVAL = 300  # каждые 5 мин
_RL_MAX_BUCKETS = 100_000   # safety cap

def check_rate_limit(key, bucket, max_requests, window_seconds):
    global _RL_LAST_CLEANUP
    now = monotonic()
    full_key = f"{bucket}:{key or 'unknown'}"
    arr = _rate_limits[full_key]
    cutoff = now - window_seconds
    arr_filtered = [t for t in arr if t > cutoff]
    if not arr_filtered:
        # Удалить пустой bucket — экономим память
        _rate_limits.pop(full_key, None)
    else:
        _rate_limits[full_key] = arr_filtered

    if len(arr_filtered) >= max_requests:
        return False

    arr_filtered.append(now)
    _rate_limits[full_key] = arr_filtered

    # Периодический GC
    if now - _RL_LAST_CLEANUP > _RL_CLEANUP_INTERVAL:
        _RL_LAST_CLEANUP = now
        _rl_gc(now)

    return True

def _rl_gc(now: float):
    """Удаляет полностью устаревшие buckets."""
    # Берём максимальный window (3600 сек = час) с запасом
    GLOBAL_CUTOFF = now - 7200  # 2 часа
    to_delete = []
    for k, arr in _rate_limits.items():
        if not arr or max(arr) < GLOBAL_CUTOFF:
            to_delete.append(k)
    for k in to_delete:
        _rate_limits.pop(k, None)

    # Hard cap — если выросли запредельно (DoS-protection of in-memory store)
    if len(_rate_limits) > _RL_MAX_BUCKETS:
        # Drop oldest 50%
        items = sorted(
            _rate_limits.items(),
            key=lambda kv: max(kv[1]) if kv[1] else 0,
        )
        for k, _ in items[: len(items) // 2]:
            _rate_limits.pop(k, None)
        logger.warning(f"_rate_limits exceeded {_RL_MAX_BUCKETS} → dropped half")
```

---

# ФАЗА 3 — P2 Polish

> **Цель:** Edge cases, code quality, минорные улучшения.

---

## B-18 — `_user_to_public` / `_STEP_TRANSITIONS`

Эти символы упоминаются в `auth_routes.py:1503, 1509, 1119, 1230, 1337, 1434` но не объявлены в файле. **Действие:** проверить, что они импортируются из правильного места (вероятно, top of file). Если не импортируются — добавить.

```bash
grep -n "_user_to_public\|_STEP_TRANSITIONS" /app/backend/auth_routes.py | head -20
```

---

## B-19 — HMR удваивает interceptors

### Проблема
```jsx
// AuthContext.jsx
let _interceptorsInstalled = false;
const installAxiosInterceptors = (onUnauthorized) => {
  if (_interceptorsInstalled) return;
  _interceptorsInstalled = true;
  axios.interceptors.request.use(...);
  axios.interceptors.response.use(...);
};
```

В dev-режиме HMR может перезагружать модуль, но `_interceptorsInstalled=true` остаётся в памяти axios instance. Однако при FULL-reload модуля переменная сбрасывается → повторное add. Тогда axios получит **дубль** interceptors → каждый запрос пройдёт через token-injection дважды (не страшно, но и логирует/обрабатывает 401 дважды).

### Исправление
Вместо boolean — использовать `Symbol` маркер на самом axios:

```jsx
const _INSTALLED_KEY = Symbol.for('rudn:auth:interceptors:installed');

const installAxiosInterceptors = (onUnauthorized) => {
  if (axios.defaults[_INSTALLED_KEY]) return;
  axios.defaults[_INSTALLED_KEY] = true;
  // ...
};
```

`Symbol.for(...)` гарантирует одинаковый Symbol после HMR.

---

## B-20 — PUBLIC_BASE_URL fallback в share-link

### Проблема
```python
# server.py:16669
if PUBLIC_BASE_URL:
    public_link = f"{PUBLIC_BASE_URL.rstrip('/')}/u/{uid}"
else:
    public_link = f"/u/{uid}"
```

Если `PUBLIC_BASE_URL` пуст — фронт получает `public_link="/u/123"`. При показе в share-popup или копировании в буфер юзер копирует **относительный путь** → ссылка не работает вне сайта.

### Исправление
Дать backend знание о текущем хосте через `request.url`:

```python
@api_router.get("/profile/{telegram_id}/share-link")
async def get_profile_share_link(
    telegram_id: int,
    request: Request,  # ← НОВОЕ
    viewer_telegram_id: Optional[int] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    # ...
    if uid:
        from config import PUBLIC_BASE_URL
        base = PUBLIC_BASE_URL or f"{request.url.scheme}://{request.url.netloc}"
        public_link = f"{base.rstrip('/')}/u/{uid}"
```

То же для `/u/{uid}/share-link`.

---

## B-21 — см. B-17 (объединено)

---

## B-22 — Размер `extra` в `_log_auth_event`

### Проблема
```python
async def _log_auth_event(db, *, event_type, ..., extra=None):
    # extra может быть огромным dict — нет валидации
    if extra:
        doc["extra"] = extra
```

Атакующий может поднять API endpoint, который кладёт большой extra (хотя сейчас все вызовы внутренние с small dicts — но defensive coding).

### Исправление
```python
import json

MAX_EXTRA_BYTES = 4096

async def _log_auth_event(db, *, event_type, ..., extra=None):
    # ...
    if extra:
        try:
            serialized = json.dumps(extra, default=str)
            if len(serialized) > MAX_EXTRA_BYTES:
                doc["extra"] = {
                    "_truncated": True,
                    "_orig_size": len(serialized),
                    "_preview": serialized[:1000],
                }
            else:
                doc["extra"] = extra
        except (TypeError, ValueError):
            doc["extra"] = {"_unserializable": True}
```

---

## B-23 — Username unset

### Проблема
```python
# models.py:2923
username: Optional[str] = Field(default=None, min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_]+$")
```

Если юзер хочет убрать публичный username — отправляет `{"username": ""}` → Pydantic ошибка (min_length=3) → 422.

### Исправление
Добавить custom validator для пустой строки → `None`:

```python
from pydantic import field_validator

class UpdateProfileStepRequest(BaseModel):
    username: Optional[str] = Field(default=None, max_length=32)
    # ... остальные поля ...

    @field_validator("username", mode="before")
    @classmethod
    def _validate_username(cls, v):
        if v is None or v == "":
            return None
        if not isinstance(v, str):
            return v
        v = v.strip().lower()
        if not v:
            return None
        if len(v) < 3 or len(v) > 32:
            raise ValueError("Username должен быть 3-32 символа")
        if not re.match(r"^[a-zA-Z0-9_]+$", v):
            raise ValueError("Username: только a-z, 0-9, _")
        return v
```

И в `auth_routes.py update_profile_step` обработать `username=None` как unset:

```python
if "username" in update_data and update_data["username"] is None:
    # Явный unset
    update_data["username"] = None
    # MongoDB поддерживает $set: {field: None} — поле будет null
```

---

# 6. План тестирования

## 6.1 После Фазы 1 (P0)

### Backend (deep_testing_backend_v2)
1. **B-02 Rate limits:**
   - 21× POST `/api/auth/login/qr/init` → 21-й = 429
   - 11× POST `/api/auth/login/qr/{token}/confirm` (валидная авторизация) → 11-й = 429
   - 121× GET `/api/auth/check-username/x` → 121-й = 429
2. **B-03 QR atomicity:**
   - 2 параллельных POST `/confirm` для одной QR-сессии → ровно 1 success, 1 = 409
3. **B-04 User creation race:**
   - Mock 2 параллельных `_create_new_user(telegram_id=999)` → оба должны вернуть один user (race recovery)
4. **B-05 X-Forwarded-For:**
   - Запрос с `X-Forwarded-For: 1.2.3.4, 5.6.7.8` → `get_client_ip` возвращает `5.6.7.8` (последний при `TRUST_PROXY_HOPS=1`)
5. **B-06 /u/{uid}/resolve privacy:**
   - User A с show_in_search=False
   - Анонимный GET /u/{A.uid}/resolve → `is_hidden: true`
   - GET с JWT друга → полные поля
   - GET с JWT владельца → полные поля + auth_providers

### Frontend (auto_frontend_testing_agent)
1. **B-01 Open Redirect:**
   - Перейти на `/login?continue=//google.com` → ввести email/pass → должен редиректить на `/`, НЕ на google.com
   - Перейти на `/login?continue=https://evil.com` → редирект на `/`
   - Перейти на `/login?continue=/profile/settings` → редирект на `/profile/settings` ✓
2. **B-07 UsernameField race:**
   - Быстро ввести `j` → `jo` → `joh` → `john` → status должен соответствовать `john`, не stale `joh`

## 6.2 После Фазы 2 (P1)

### Backend
1. **B-08 TTL индексы:**
   - `db.auth_qr_sessions.indexes()` показывает `qr_ttl` с `expireAfterSeconds: 3600`
2. **B-11 Empty strings:**
   - PATCH /profile-step с `{"last_name": ""}` → backend НЕ затирает существующее
3. **B-12 Длина имени:**
   - POST /register/email с `first_name="A"*200` → 422
4. **B-15 Email hashing:**
   - Failed login → `auth_events.find_one()` содержит `email_hash`, не `email`
5. **B-17 Memory:**
   - 1000 различных IP с rate-limit запросами → после 5 минут `len(_rate_limits) < 1000` (cleanup сработал)

### Frontend
1. **B-09 VK cleanup:** force-error в callback → sessionStorage пуст
2. **B-10 QR background tab:** свернуть tab на 30 сек → вернуться → polling сразу делает запрос
3. **B-13 QR retry:** error-state → нажать "Попробовать ещё раз" → status='processing' → ...
4. **B-14 Token expiry:** сделать токен expired → попытка любого API → редирект на `/login?reason=expired`
5. **B-16 View dedup:** открыть `/u/123` → mount → `/view` отправлен. Reload компонента (без refresh страницы) → второй mount → `/view` НЕ отправлен.

## 6.3 После Фазы 3 (P2)

### Backend
1. **B-18 Imports:** `python -c "from auth_routes import create_auth_router"` без ImportError
2. **B-20 Share-link host:** `PUBLIC_BASE_URL=""` + GET share-link → `public_link` содержит реальный хост из request
3. **B-22 Extra size:** event с extra=10MB JSON → лог сохраняет truncated version
4. **B-23 Username unset:** PATCH `{"username": ""}` → success, user.username=None

### Frontend
1. **B-19 HMR:** проверить в dev-mode что после нескольких HMR один запрос делает один Authorization header (не дубль)

---

# 7. Критерии Definition-of-Done

Для каждой фазы:

- [ ] Все указанные файлы изменены в соответствии с описанием
- [ ] Backend supervisor restart успешен (нет import errors / startup errors)
- [ ] Frontend hot-reload подхватил изменения без ошибок
- [ ] `deep_testing_backend_v2` все тесты passed для затронутых endpoint'ов
- [ ] `auto_frontend_testing_agent` все UI flows passed (если фаза трогает фронт)
- [ ] `test_result.md` обновлён (запись о новой стадии)
- [ ] `instrProfileAuth.md` дополнен (Stage 7: P0/P1/P2 hardening) — опционально
- [ ] Никаких regressions в существующих flows: email login, telegram login, VK login, QR login, профиль, privacy

---

# 8. Откатные сценарии

Все изменения **обратно совместимы** на API-уровне:

| Изменение | Откат |
|---|---|
| Rate-limits | `_RATE_LIMITS["xxx"] = (10**6, 1)` — фактически отключить |
| TTL-индексы | `db.collection.dropIndex("name_ttl")` |
| `safeContinueUrl` | вернуть прямое использование `searchParams.get('continue')` |
| Race recovery в `_create_new_user` | вернуть `raise HTTPException(409)` |
| Atomic QR confirm | вернуть `find_one + check + update` |
| `get_client_ip` | вернуть `xff.split(",")[0]` (но безопасно поставить `TRUST_PROXY_HOPS=999`) |
| `/u/{uid}/resolve` privacy | вернуть прежний return (не ломая фронт — он использует только `display_name`/`username`/`has_telegram`) |
| UsernameField AbortController | вернуть прежний debounce без sequence |

Все изменения тегируются комментарием `# Stage 7: P0/P1/P2 hardening`/`/* Stage 7: ... */` для лёгкого grep.

---

# 9. Размер изменений (оценка)

| Фаза | Backend файлы | Frontend файлы | LOC изменений |
|---|---|---|---|
| **Фаза 1 (P0)** | 4 (auth_routes, auth_utils, server, config) | 5 (LoginPage, VKCallbackPage, QRConfirmPage, AuthGate, UsernameField + новый safeRedirect) | ~400 |
| **Фаза 2 (P1)** | 3 (auth_routes, auth_utils, server, models) | 4 (VKCallbackPage, QRConfirmPage, QRLoginBlock, AuthContext, PublicProfilePage, LoginPage) | ~350 |
| **Фаза 3 (P2)** | 2-3 (auth_routes, models, server) | 1 (AuthContext) | ~150 |
| **ИТОГО** | ~7 файлов | ~10 файлов | ~900 LOC |

---

# 10. Время на выполнение (оценка)

| Фаза | Реализация | Тестирование backend | Тестирование frontend | Всего |
|---|---|---|---|---|
| Фаза 1 | 40 мин | 15 мин | 10 мин | **65 мин** |
| Фаза 2 | 30 мин | 10 мин | 10 мин | **50 мин** |
| Фаза 3 | 15 мин | 5 мин | 5 мин | **25 мин** |
| **ИТОГО** | **85 мин** | **30 мин** | **25 мин** | **~2.5 часа** |

---

# Приложение A: Sequence-diagram QR-flow с фиксами

```
[Browser A — desktop]                    [Backend]                     [Browser B — mobile, авторизован]
       |                                     |                                       |
       | POST /qr/init                       |                                       |
       |   (rate-limit IP+UA)                |                                       |
       |---X429? нет → 200 + qr_token-------->                                       |
       |                                     |                                       |
       | poll /qr/{token}/status (раз в 2с)  |                                       |
       |   (rate-limit IP)                   |                                       |
       |<---- pending --------                |                                       |
       |                                     |                                       |
       |                                     | <----- сканирование QR ---------------|
       |                                     |                                       |
       |                                     |  POST /qr/{token}/confirm + JWT       |
       |                                     |    (rate-limit uid)                   |
       |                                     |    find_one_and_update(status=pending)|
       |                                     |    → атомарный claim                  |
       |                                     |---success----------------------------->
       |                                     |                                       |
       | poll → confirmed + access_token----->                                       |
       |   → applyAuth → redirect            |                                       |
```

---

# Приложение B: ENV-переменные для production

После Фазы 1 + 2 рекомендуется:

```bash
# backend/.env (production)
TRUST_PROXY_HOPS=1                    # обычно 1 для k8s ingress, 2 если за CDN
QR_SESSION_TTL_MINUTES=10
QR_CONSUMED_GRACE_SECONDS=30

# Optional override rate limits (если стандартные слишком строгие)
RL_QR_INIT_IP_MAX=20
RL_QR_INIT_IP_WINDOW=600
# ... etc
```

Конфигурация лимитов через ENV — отдельный refactor (не в этом плане).

---

**Конец плана.**

> 📝 _Этот план составлен после анализа всех 22 800 LOC backend и ~3 500 LOC frontend, относящихся к функциям «Публичный профиль» и «Регистрация/Авторизация». Содержит 23 идентифицированных бага и улучшений, разнесённых по 3 фазам приоритета. Каждый bug имеет: описание проблемы → сценарий воспроизведения → код исправления → план тестирования._
