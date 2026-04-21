# 📘 Инструкция: Унификация идентификатора пользователя на базе UID

**Создано:** 2026-04-21  
**Автор:** AI audit + рефакторинг-план  
**Статус:** 📋 Запланировано. Выполнение — по фазам P0 → P4  
**Связано с:** `AI_CONTEXT.md`, `instrProfileAuth.md` (Stage 2 public profile), `auth_utils.py`

---

## 🎯 Цель

Сделать `uid` (9-значный numeric string, `users.uid`) **единственным каноническим идентификатором** пользователя во всей системе, **независимо от**:

1. **Способа авторизации** (Telegram WebApp, Telegram Login Widget, VK ID, Email, QR Cross-Device).
2. **Точки входа** (Telegram WebApp внутри мессенджера, браузер на ПК, браузер на телефоне, deep-link `/u/{uid}`).
3. **Наличия привязанного Telegram-аккаунта** — UID не меняется, даже если юзер сегодня зашёл через email, а завтра прилинковал Telegram.

Результат: один человек = один UID = все данные. Никаких «потерянных» комнат, друзей, задач, достижений при смене провайдера авторизации.

---

## 🚨 Почему это срочно

### Текущее состояние (после последних фиксов апреля 2026)

- `users.uid` — есть у всех пользователей (9 цифр, unique).
- `users.telegram_id` — **NULL** у 5 из 7 текущих юзеров (VK/Email).
- В **38 из 53** MongoDB-коллекций данные привязаны к полю `telegram_id` (int).
- Для VK/Email юзеров в эти 38 коллекций пишется **`pseudo_tid = 10_000_000_000 + int(uid)`**.
- 82 REST endpoint'а имеют в URL `/{telegram_id}`.
- 93 Pydantic модели содержат поле `telegram_id: int`.

### Что ломается

| Сценарий | Симптом | Причина |
|---|---|---|
| VK-юзер подписывается на пуши расписания | Ничего не приходит (или ошибка в логах `chat not found`) | `scheduler_v2` шлёт `bot.send_message(chat_id=pseudo_tid)` |
| Email-админ заходит в `/admin` | 403 или админка не показывается | `ADMIN_UIDS.includes(tgUser.id)` проверка по tgUser.id |
| VK-юзер приглашает друга в комнату | Другу-VK не приходит пуш в TG (ок: его нет в TG); но и in-app уведомление не создаётся в ряде мест | Логика привязана к bot.send_message без fallback |
| Email-юзер линкует Telegram после регистрации | Часть данных остаётся на pseudo_tid, часть переходит на real_tid → данные частично «теряются» | Миграция в `auth_routes.py:1408` работает только для `user_settings`, не для остальных 37 коллекций |
| Public-profile аватар-seed для VK vs TG | Разные аватары для одного и того же юзера | `dicebear(seed=telegram_id)` — у VK-юзера = pseudo, у TG = real |
| День рождения, ачивка — бот-нотификация | Для не-TG юзера тихо не отправляется, и нет fallback в in-app | Функции хардкодят `bot.send_message` |

### Принципиальная проблема

Поле `telegram_id` в 38 коллекциях — **лживое имя**: реальный Telegram ID там только для пользователей, пришедших через TG. Для остальных — искусственный ключ. Это ведёт к багам, которые тяжело отловить, потому что внешне «работает».

---

## 🧭 Принципы рефакторинга

1. **Backward compatibility first.** Не ломаем работающее. Никаких одномоментных rename-ов поля в БД.
2. **Дуальный режим на переходный период.** `uid` и `telegram_id` сосуществуют в документах и endpoint'ах, пока фронт не переедет.
3. **Один helper — один источник правды.** Вся логика resolve «получить user по любому ID» — в одном месте (`auth_utils.resolve_user`).
4. **Идемпотентная миграция.** Migration-скрипт можно запускать многократно без вреда.
5. **Telegram-операции инкапсулированы.** Всё, что касается отправки сообщений ботом, идёт через единый `MessageDeliveryService`, который САМ решает — Telegram Bot API, in-app notification, FCM (в будущем), email.

---

# 🗺 План миграции по фазам

| Фаза | Название | Приоритет | Оценка | Риск |
|---|---|---|---|---|
| **P0** | Безопасные пуши (anti-pseudo-tid guard) | 🔴 Critical | 4-6 ч | Низкий |
| **P1** | `MessageDeliveryService` абстракция + миграция отправлений | 🔴 Critical | 1-2 дня | Средний |
| **P2** | Быстрые фронт-фиксы (админка, avatar-seed, localStorage) | 🟠 High | 3-4 ч | Низкий |
| **P3** | `uid` как первичный ключ в новых endpoint'ах + resolver | 🟡 Medium | 2-3 дня | Низкий |
| **P4** | Дублирование `uid` в 38 коллекциях + backfill | 🟢 Optional | 3-5 дней | Высокий |
| **P5** | Deprecation & cleanup legacy `/{telegram_id}/*` | ⚪ Far future | 5 дней | Высокий |

---

## ФАЗА P0 — Guard для Telegram push

**Цель:** ни одна `bot.send_message` не должна стрелять в pseudo_tid.  
**Результат:** в логах больше нет `chat not found`/`Bad Request: chat not found` для VK/Email юзеров.

### P0.1 — Вспомогательные утилиты (уже существуют)

Файл `backend/auth_utils.py` уже содержит:
```python
PSEUDO_TID_OFFSET = 10_000_000_000

def is_pseudo_tid(tid: Optional[int]) -> bool:
    """True если значение — синтетический ключ, а не реальный Telegram ID."""
    if tid is None: return False
    try: return int(tid) >= PSEUDO_TID_OFFSET
    except: return False

def effective_tid_for_user(user_doc: dict) -> Optional[int]:
    """Возвращает ключ для user_settings: real если есть, иначе pseudo."""
```

### P0.2 — Добавить helper `is_real_telegram_user`
```python
# backend/auth_utils.py
def is_real_telegram_user(tid: Optional[int]) -> bool:
    """True если tid — настоящий Telegram ID (можно писать в бот)."""
    if tid is None: return False
    try:
        t = int(tid)
        return 0 < t < PSEUDO_TID_OFFSET
    except: return False
```

### P0.3 — Жёсткий guard во всех `bot.send_message`

Файлы для правки (с точным указанием мест):

| Файл | Строки | Что заменить |
|---|---|---|
| `notifications.py` | 51, 117, 143 | Перед `await self.bot.send_message` — `if not is_real_telegram_user(telegram_id): return False` |
| `telegram_bot.py` | 195, 208, 406, 432, 747 | Аналогично |
| `server.py` | 4730, 4756, 7169, 17641, 20016, 20102, 20113, 20119 | Аналогично |
| `scheduler_v2.py` | 482 (вызов `send_class_notification`) | Фильтр на уровне `_create_scheduled_notification` — не создавать задачу рассылки, если юзер не real TG |
| `scheduler_v2.py` | 982 (вызов `send_message` для greeting) | Аналогично |

Паттерн:
```python
from auth_utils import is_real_telegram_user

async def send_something(telegram_id, ...):
    if not is_real_telegram_user(telegram_id):
        logger.info(f"Skip bot push for non-TG user tid={telegram_id}")
        return False
    try:
        await bot.send_message(chat_id=telegram_id, ...)
    except TelegramError as e:
        ...
```

### P0.4 — Scheduler: фильтрация на уровне выборки

В `scheduler_v2.prepare_daily_schedule()` при выборке юзеров для рассылки добавить:

```python
users_cursor = db.user_settings.find({
    "telegram_id": {"$lt": PSEUDO_TID_OFFSET},  # только real TG
    "notifications_enabled": True,
})
```

Это экономит итерации и исключает pseudo_tid на ранней стадии.

### P0.5 — Тест

Регистрация email-юзера → вручную создать запись в `scheduled_notifications` на pseudo_tid → запустить `_retry_notification` → убедиться, что в логах `Skip bot push`, а не `chat not found`.

---

## ФАЗА P1 — `MessageDeliveryService` (ключевая абстракция)

**Цель:** вынести всю логику «уведомить пользователя» за единый интерфейс. Сервис сам решает: писать в Telegram, создавать in-app, отправлять email, или всё сразу.

### P1.1 — Интерфейс

Новый файл `backend/services/delivery.py`:

```python
"""
MessageDeliveryService — единая точка для доставки сообщений пользователю.

Заменяет прямые вызовы bot.send_message / notification_service.send_message.
Автоматически определяет транспорт по наличию провайдеров у юзера.

Транспорты:
- telegram (Bot API)    — только если user.telegram_id задан (real)
- in_app (Mongo coll)   — для всех пользователей
- email (future)        — если user.email задан и notifications.email=True
- push_fcm (future)     — если web-session зарегистрирован с FCM-токеном
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional, List

class Channel(str, Enum):
    TELEGRAM = "telegram"
    IN_APP = "in_app"
    EMAIL = "email"
    PUSH_FCM = "push_fcm"

class MessagePriority(str, Enum):
    SILENT = "silent"          # только in-app
    NORMAL = "normal"           # TG (если есть) + in-app
    IMPORTANT = "important"     # TG + in-app + email + push
    URGENT = "urgent"           # все каналы, retry

@dataclass
class DeliveryResult:
    delivered: List[Channel]
    skipped: List[Channel]
    errors: dict  # {channel: error_msg}

class MessageDeliveryService:
    def __init__(self, db, bot_instance=None):
        self.db = db
        self.bot = bot_instance

    async def send(
        self,
        *,
        uid: str | None = None,
        telegram_id: int | None = None,
        kind: str,              # "achievement", "friend_request", "class_reminder", ...
        title: str,
        body: str,
        data: dict | None = None,
        priority: MessagePriority = MessagePriority.NORMAL,
        html: bool = False,
        buttons: list | None = None,   # inline buttons (только для TG)
    ) -> DeliveryResult:
        """Доставляет сообщение пользователю по любому каналу, который доступен."""
        user = await self._resolve_user(uid=uid, telegram_id=telegram_id)
        if not user:
            return DeliveryResult(delivered=[], skipped=[], errors={"all": "user not found"})

        result = DeliveryResult(delivered=[], skipped=[], errors={})

        # 1. in-app (всегда, кроме SILENT с явным отказом)
        if priority != MessagePriority.SILENT or True:
            ok = await self._send_in_app(user, kind, title, body, data)
            (result.delivered if ok else result.skipped).append(Channel.IN_APP)

        # 2. Telegram (если пользователь прилинкован)
        real_tid = user.get("telegram_id")
        if real_tid and is_real_telegram_user(real_tid) and priority != MessagePriority.SILENT:
            ok = await self._send_telegram(real_tid, title, body, html, buttons)
            (result.delivered if ok else result.skipped).append(Channel.TELEGRAM)
        else:
            result.skipped.append(Channel.TELEGRAM)

        # 3. Email (future) — for IMPORTANT+
        if priority in (MessagePriority.IMPORTANT, MessagePriority.URGENT):
            if user.get("email"):
                # TODO P3: email transport
                result.skipped.append(Channel.EMAIL)

        return result

    async def _resolve_user(self, *, uid, telegram_id):
        if uid:
            return await self.db.users.find_one({"uid": str(uid)})
        if telegram_id:
            # Сначала как real tid, потом как pseudo
            u = await self.db.users.find_one({"telegram_id": int(telegram_id)})
            if u: return u
            if is_pseudo_tid(telegram_id):
                synth_uid = str(int(telegram_id) - PSEUDO_TID_OFFSET)
                return await self.db.users.find_one({"uid": synth_uid})
        return None

    async def _send_in_app(self, user, kind, title, body, data) -> bool:
        try:
            notification = {
                "uid": user["uid"],
                "telegram_id": effective_tid_for_user(user),  # legacy index
                "kind": kind,
                "title": title,
                "body": body,
                "data": data or {},
                "read": False,
                "dismissed": False,
                "created_at": datetime.now(timezone.utc),
            }
            await self.db.in_app_notifications.insert_one(notification)
            return True
        except Exception as e:
            logger.error(f"in_app delivery failed for uid={user.get('uid')}: {e}")
            return False

    async def _send_telegram(self, tid, title, body, html, buttons) -> bool:
        if not self.bot: return False
        try:
            text = f"<b>{title}</b>\n\n{body}" if html else f"{title}\n\n{body}"
            reply_markup = self._build_reply_markup(buttons) if buttons else None
            await self.bot.send_message(
                chat_id=tid, text=text, parse_mode="HTML" if html else None,
                reply_markup=reply_markup,
            )
            return True
        except Exception as e:
            logger.error(f"telegram delivery failed for tid={tid}: {e}")
            return False

    def _build_reply_markup(self, buttons):
        from telegram import InlineKeyboardButton, InlineKeyboardMarkup
        rows = []
        for row in buttons:
            rows.append([InlineKeyboardButton(b["text"], url=b.get("url"), callback_data=b.get("callback")) for b in row])
        return InlineKeyboardMarkup(rows)


# Singleton
_delivery_service = None
def get_delivery_service(db, bot=None):
    global _delivery_service
    if _delivery_service is None:
        _delivery_service = MessageDeliveryService(db, bot)
    return _delivery_service
```

### P1.2 — Места миграции в `MessageDeliveryService`

| Модуль | Функция | Вид уведомления (`kind`) | Приоритет |
|---|---|---|---|
| `notifications.py` | `send_class_notification` | `class_reminder` | `IMPORTANT` |
| `scheduler_v2.py` | greeting уведомление | `greeting` | `NORMAL` |
| `scheduler_v2.py` | `check_inactive_users` | `inactive_reminder` | `NORMAL` |
| `telegram_bot.py` | `send_device_linked_notification` | `device_linked` | `IMPORTANT` |
| `telegram_bot.py` | `send_room_join_notifications` | `room_joined` | `NORMAL` |
| `telegram_bot.py` | `award_referral_bonus` (нотификация реферреру) | `referral_bonus` | `NORMAL` |
| `achievements.py` | `create_achievement_notification` | `achievement_unlocked` | `NORMAL` |
| `server.py:4730` | Friend request notification | `friend_request` | `NORMAL` |
| `server.py:4756` | Friend accepted notification | `friend_accepted` | `NORMAL` |
| `server.py:7169` | Test admin notification | `admin_broadcast` | `IMPORTANT` |
| `server.py:17641` | Profile view notification | `profile_view` | `SILENT` |
| `server.py:20016,20102,20113,20119` | Birthday / admin broadcasts с фото | `birthday` / `admin` | `IMPORTANT` |

**Правило миграции:**
```python
# ДО:
await bot.send_message(chat_id=telegram_id, text="...")

# ПОСЛЕ:
delivery = get_delivery_service(db, bot)
await delivery.send(
    telegram_id=telegram_id,       # или uid=user.uid
    kind="friend_request",
    title="Новый запрос в друзья",
    body=f"{sender_name} хочет добавить вас в друзья",
    priority=MessagePriority.NORMAL,
    html=True,
    buttons=[[{"text": "Открыть", "url": f"{FRONTEND_URL}/friends"}]],
)
```

### P1.3 — Отдельная обработка фото-нотификаций

`bot.send_photo` используется для:
- Поздравление с ДР (открытка)
- Админ-рассылка с картинкой
- Ачивки с картинкой

Добавить метод `delivery.send_photo(**kwargs, photo_url)`. В in-app записи сохраняем `data: {"image_url": "..."}` — фронт его рендерит.

### P1.4 — Batch-отправка

Для scheduler_v2.prepare_daily_schedule — 100+ уведомлений разом. Добавить `delivery.send_batch(recipients: list, ...)` с параллельной отправкой (asyncio.gather с семафором) и дедупликацией ошибок.

### P1.5 — Retry + DLQ

В `scheduler_v2.retry_failed_notifications` уже есть retry. Адаптировать под новый сервис: `delivery.send(...)` пишет в `delivery_attempts` коллекцию (status=pending/sent/failed, retry_count), scheduler ретраит только те, где `status=failed AND retry_count<3`.

---

## ФАЗА P2 — Быстрые фронт-фиксы

### P2.1 — Admin detection по UID

**Файл:** `frontend/src/components/FriendsSection.jsx:197`, `AdminPanel.jsx:xx`  
**Сейчас:** `ADMIN_UIDS.includes(String(tgUser.id))`  
**Должно быть:** `ADMIN_UIDS.includes(String(user.uid))`

Также: на backend добавить эндпоинт `GET /api/auth/me/is_admin` который возвращает `{is_admin: bool}` на основании `ENV.ADMIN_UIDS`. Фронт проверяет через этот флаг, а не хардкодит список.

### P2.2 — Avatar seed по UID

**Файл:** `frontend/src/pages/PublicProfilePage.jsx:307`  
**Сейчас:** `const avatarSeed = profile?.telegram_id || profile?.uid || uid;`  
**Должно быть:** `const avatarSeed = profile?.uid || uid;`

То же для всех `DiceBear(seed=...)` вызовов во фронте (grep `avatarSeed`).

### P2.3 — `localStorage` unification

Устаревший ключ `telegram_user` (12 мест) → заменить на чтение из `AuthContext.user` / `localStorage.auth_user` (= UserPublic с полем `uid`).

**Шаги:**
1. Пометить `telegram_user` как legacy — читать, но не писать.
2. Через 7-14 дней удалить.
3. Все `user.id` в сравнениях заменить на helper `userMatches(a, b)` (см. P2.5).

### P2.4 — Helper `utils/userIdentity.js`

```js
// frontend/src/utils/userIdentity.js
export const PSEUDO_TID_OFFSET = 10_000_000_000;

export const isPseudoTid = (id) => Number(id) >= PSEUDO_TID_OFFSET;
export const isRealTelegramTid = (id) => Number(id) > 0 && Number(id) < PSEUDO_TID_OFFSET;
export const getUid = (user) => user?.uid ?? null;
export const getTid = (user) => user?.id ?? user?.telegram_id ?? null;

/** Сравнить двух пользователей (participant vs currentUser). */
export const isSameUser = (a, b) => {
  if (!a || !b) return false;
  if (a.uid && b.uid) return String(a.uid) === String(b.uid);
  const aid = getTid(a), bid = getTid(b);
  if (aid && bid) return String(aid) === String(bid);
  return false;
};

export const isTelegramUser = (user) => isRealTelegramTid(getTid(user));
```

### P2.5 — Заменить `=== telegram_id` сравнения

~30 мест в компонентах (`RoomDetailModal`, `GroupTaskDetailModal`, `ListeningRoomModal`, `JournalDetailModal`, `RoomParticipantsList`, `SharedScheduleView`, и др.) — перевести на `isSameUser(participant, user)`.

### P2.6 — Environment detection (browser vs webapp)

UID должен быть одинаковый независимо от точки входа. Создать helper:

```js
// frontend/src/utils/environment.js
export const isTelegramWebApp = () => {
  return typeof window !== "undefined" &&
    window.Telegram?.WebApp?.initData &&
    window.Telegram.WebApp.initData.length > 0;
};

export const getAuthContext = (authUser, tgUser) => ({
  uid: authUser?.uid ?? null,                      // ✅ canonical
  telegram_id: authUser?.telegram_id ?? tgUser?.id ?? null,
  is_webapp: isTelegramWebApp(),
  is_browser: !isTelegramWebApp(),
  provider: authUser?.auth_providers?.[0] ?? (tgUser ? "telegram" : null),
});
```

**Ключевое правило:** любые вызовы к backend должны первым делом смотреть на `authUser.uid`, и только если его нет — fallback на tid/tgUser.id.

### P2.7 — Убрать `linked_telegram_id` из localStorage

В `App.jsx:1686,1214` — ключ `linked_telegram_id` делает то же, что `authUser.telegram_id`. Не нужен → убрать.

---

## ФАЗА P3 — UID как первичный ключ в API (новые endpoint'ы)

### P3.1 — Универсальный resolver в auth_utils

```python
# backend/auth_utils.py
async def resolve_user(db, identifier: str | int) -> Optional[dict]:
    """Принимает uid, telegram_id (real или pseudo) — возвращает user_doc.
    Приоритет: uid > real_tid > pseudo_tid."""
    if identifier is None: return None
    s = str(identifier)

    # 1. Если 9 цифр без ведущего 1 > 10^9 → uid
    if s.isdigit() and len(s) == 9:
        u = await db.users.find_one({"uid": s})
        if u: return u

    # 2. Как telegram_id (int)
    try:
        tid = int(identifier)
    except (TypeError, ValueError):
        return None

    if tid < PSEUDO_TID_OFFSET:
        # real tid
        return await db.users.find_one({"telegram_id": tid})
    else:
        # pseudo tid → расшифровка
        synth_uid = str(tid - PSEUDO_TID_OFFSET)
        return await db.users.find_one({"uid": synth_uid})
```

### P3.2 — Расширение API под uid

Для каждого легаси-endpoint'а `/api/xxx/{telegram_id}` создать alias `/api/u/{uid}/xxx` (или universal `/api/xxx/{user_identifier}` с dual-resolve).

**Паттерн:**
```python
@api_router.get("/u/{uid}/tasks", response_model=List[TaskResponse])
async def get_user_tasks_by_uid(uid: str, current_user = Depends(get_current_user_required)):
    user = await resolve_user(db, uid)
    if not user:
        raise HTTPException(404, "User not found")
    # переиспользуем существующий хендлер
    return await _get_tasks_internal(user, current_user)
```

**Приоритет на первую волну:**
1. `/u/{uid}/settings` → `/user-settings/{telegram_id}`
2. `/u/{uid}/tasks` → `/tasks/{telegram_id}`
3. `/u/{uid}/notifications` → `/notifications/{telegram_id}`
4. `/u/{uid}/achievements` → `/user-achievements/{telegram_id}`
5. `/u/{uid}/friends` → `/friends/{telegram_id}`
6. `/u/{uid}/rooms` → `/rooms/{telegram_id}`
7. `/u/{uid}/messages/conversations` → `/messages/conversations/{telegram_id}`
8. `/u/{uid}/journal` → `/journals/{telegram_id}`
9. `/u/{uid}/level` → `/users/{telegram_id}/level`
10. `/u/{uid}/streak-claim` → `/users/{telegram_id}/streak-claim`
11. `/u/{uid}/profile` → `/profile/{telegram_id}` (аватар, граффити — но это уже частично в Stage 2)

### P3.3 — Dual-accept на существующих endpoint'ах

В `Depends()` функции `resolve_user_identifier`:

```python
from fastapi import Path

async def _get_user_by_any(identifier: str = Path(..., alias="telegram_id")):
    """Акцептирует uid ИЛИ telegram_id в тот же path-параметр."""
    db = await get_db()
    user = await resolve_user(db, identifier)
    if not user:
        raise HTTPException(404, "User not found")
    return user
```

Применить к критическим endpoint'ам постепенно. **Не ломает фронт** — существующие telegram_id-вызовы продолжают работать.

### P3.4 — JWT расширение

`create_jwt` теперь пишет `tid` (уже исправлено) + должно писать `uid`:

```python
def create_jwt(*, uid, telegram_id=None, providers=None):
    payload = {
        "sub": str(uid),           # canonical
        "uid": str(uid),           # explicit (дублирует sub для удобства)
        "tid": int(telegram_id) if telegram_id else None,
        "providers": providers or [],
        "iat": now, "exp": now + TTL,
        "jti": secrets.token_urlsafe(12),
    }
```

`get_current_user` возвращает `{uid, tid, providers}`. Всё, что сейчас использует `current_user.tid`, должно иметь fallback на `current_user.uid`.

---

## ФАЗА P4 — Миграция данных (дублирование UID в коллекциях)

### P4.1 — Обновлённые Pydantic модели

Все 93 модели с `telegram_id: int` получают `uid: Optional[str]`:

```python
class Task(BaseModel):
    telegram_id: int                 # legacy: pseudo_or_real_tid
    uid: Optional[str] = None        # canonical
    # ...
```

### P4.2 — Backfill-скрипт

```python
# backend/migrations/backfill_uid_to_collections.py
"""
Добавляет поле `uid` во все документы в 38 коллекциях, где есть telegram_id.
Идемпотентный: пропускает документы, где uid уже установлен.

Запуск: python -m backend.migrations.backfill_uid_to_collections
"""
async def backfill():
    COLLS_WITH_TID = [
        "user_settings", "tasks", "group_tasks", "group_task_comments",
        "group_task_invites", "rooms", "room_activities",
        "friends", "friendships", "friend_requests", "blocked_users", "user_blocks",
        "journals", "journal_students", "journal_sessions", "journal_pending_members",
        "journal_applications", "attendance_records",
        "messages", "conversations", "message_reactions",
        "music_favorites", "music_history", "listening_rooms", "user_vk_tokens",
        "shared_schedules", "schedule_share_tokens",
        "in_app_notifications", "notification_history",
        "scheduled_notifications", "sent_notifications",
        "user_stats", "user_achievements", "xp_events",
        "profile_views", "referral_connections", "referral_events",
        "referral_rewards", "referral_link_events",
        "lk_connections", "web_sessions", "auth_events",
    ]
    for coll_name in COLLS_WITH_TID:
        coll = db[coll_name]
        cursor = coll.find({"uid": {"$exists": False}, "telegram_id": {"$exists": True}})
        async for doc in cursor:
            tid = doc["telegram_id"]
            if tid >= PSEUDO_TID_OFFSET:
                synth_uid = str(tid - PSEUDO_TID_OFFSET)
            else:
                user = await db.users.find_one({"telegram_id": int(tid)})
                synth_uid = user["uid"] if user else None
            if synth_uid:
                await coll.update_one({"_id": doc["_id"]}, {"$set": {"uid": synth_uid}})
        # Индекс
        try:
            await coll.create_index("uid")
        except: pass
```

Запуск:
```bash
cd /app/backend && python -m migrations.backfill_uid_to_collections
```

Включить в автозапуск (startup event с флагом `UID_MIGRATION_DONE` в коллекции `_migrations`).

### P4.3 — Обновить CRUD-хендлеры: писать оба поля

Во всех `insert_one` / `insert_many` писать одновременно `telegram_id` и `uid`:

```python
new_task = {
    "telegram_id": effective_tid_for_user(user),
    "uid": user["uid"],                          # ← добавить
    # ...
}
await db.tasks.insert_one(new_task)
```

Grep-помощник: найти все места с `.insert_one(` в server.py + каждой модели — добавить uid.

### P4.4 — Читать сначала по uid (медленно)

Запросы типа `db.tasks.find({"telegram_id": tid})` менять на `find({"uid": user["uid"]})`. Через 30 дней после backfill — убрать fallback на telegram_id.

---

## ФАЗА P5 — Cleanup legacy

После полной стабилизации (30+ дней):

1. Удалить `/api/xxx/{telegram_id}` endpoint'ы → оставить только `/api/u/{uid}/*`.
2. В моделях: удалить `telegram_id`, оставить только `uid`.
3. В коллекциях: `$unset telegram_id` (или оставить для audit-trail).
4. `pseudo_tid_from_uid` → deprecated → удалить.
5. В JWT: убрать `tid`, оставить только `uid`.

**⚠️ Этап P5 выполняется последним и только после подтверждения, что всё работает без `telegram_id`.**

---

# 🔄 Замена функций отправки сообщений в ЛС (детально)

## Карта всех `bot.send_*` вызовов и замена

### Группа 1: `notifications.py`

```python
# ДО (строка 51):
await self.bot.send_message(chat_id=telegram_id, text=message, parse_mode='HTML')

# ПОСЛЕ:
from services.delivery import get_delivery_service, MessagePriority
delivery = get_delivery_service(self.db, self.bot)
await delivery.send(
    telegram_id=telegram_id,
    kind="class_reminder",
    title=class_info.get("discipline", "Пара"),
    body=message,
    priority=MessagePriority.IMPORTANT,
    html=True,
)
```

### Группа 2: `telegram_bot.py:150 send_device_linked_notification`

```python
# ДО:
async def send_device_linked_notification(bot, telegram_id, session_info):
    text = f"🔔 Новое устройство: {session_info['device']}..."
    keyboard = [[InlineKeyboardButton("Отозвать", callback_data=f"revoke_{session_id}")]]
    await bot.send_message(telegram_id, text, reply_markup=InlineKeyboardMarkup(keyboard))

# ПОСЛЕ:
async def send_device_linked_notification(db, bot, uid: str, session_info):
    delivery = get_delivery_service(db, bot)
    await delivery.send(
        uid=uid,
        kind="device_linked",
        title="🔔 Новое устройство привязано",
        body=f"Устройство: {session_info['device']}\nIP: {session_info['ip']}",
        priority=MessagePriority.IMPORTANT,
        data={"session_id": session_info["id"], "action": "revoke"},
        buttons=[[{"text": "Отозвать доступ", "callback": f"revoke_{session_info['id']}"}]],
    )
```

### Группа 3: `telegram_bot.py:382 send_room_join_notifications`

Когда новый юзер присоединяется к room, все участники должны получить уведомление. Для pseudo_tid-юзеров оно раньше молча пропадало.

```python
# ДО: бежит по participants и шлёт bot.send_message каждому

# ПОСЛЕ:
async def send_room_join_notifications(db, bot, room_data, new_user_name, new_user_uid):
    delivery = get_delivery_service(db, bot)
    for participant in room_data.get("participants", []):
        if participant.get("uid") == new_user_uid:
            continue  # не себе
        await delivery.send(
            uid=participant["uid"] if "uid" in participant else None,
            telegram_id=participant.get("telegram_id"),
            kind="room_joined",
            title=f"👥 {new_user_name} присоединился",
            body=f"к комнате «{room_data['name']}»",
            priority=MessagePriority.NORMAL,
            data={"room_id": room_data["id"]},
        )
```

**Эффект:** VK-юзер в комнате теперь видит in-app уведомление (если есть TG — ещё и в чат бота).

### Группа 4: `achievements.py:765 create_achievement_notification`

```python
# ДО:
text = f"🏆 Ачивка: {achievement['title']}"
try:
    await bot.send_message(chat_id=telegram_id, text=text)
except: pass

# ПОСЛЕ:
delivery = get_delivery_service(db, bot)
await delivery.send(
    telegram_id=telegram_id,
    kind="achievement_unlocked",
    title=f"🏆 {achievement['title']}",
    body=achievement.get("description", ""),
    priority=MessagePriority.NORMAL,
    data={"achievement_id": achievement["id"], "xp": achievement.get("xp", 0)},
)
```

### Группа 5: `scheduler_v2.py:482 class-reminder`

```python
# ДО:
success = await self.notification_service.send_class_notification(
    telegram_id, class_info, minutes_before
)

# ПОСЛЕ:
# notification_service внутри уже использует delivery
# (см. Группа 1), ничего менять не надо, но при выборке юзеров
# в prepare_daily_schedule добавить фильтр:
users_cursor = db.user_settings.find({
    "notifications_enabled": True,
    # не фильтруем по telegram_id — notification_service решит сам через delivery
})
# Если delivery вернул only skipped → не создаём scheduled_notification record.
```

### Группа 6: `server.py` 9 точек (friend_request, friend_accepted, admin_broadcast, birthday, profile_view)

Централизовать в helper:

```python
# server.py (наверху, после импортов)
async def _notify_user(
    *, uid=None, telegram_id=None, kind, title, body,
    priority=MessagePriority.NORMAL, data=None, html=False, buttons=None,
):
    delivery = get_delivery_service(db, bot_instance)
    return await delivery.send(
        uid=uid, telegram_id=telegram_id,
        kind=kind, title=title, body=body,
        priority=priority, data=data, html=html, buttons=buttons,
    )
```

Все 9 мест → заменить на `await _notify_user(...)`.

---

## 📱 WebApp vs Browser: единое поведение

### Проблема

Сейчас в Telegram WebApp автоматически срабатывает `TelegramContext` и создаёт/находит пользователя по `tgUser.id`. В браузере — LoginPage → AuthContext по uid.

Это приводит к тому, что один и тот же человек может получить **две учётки**: одну по real_tid (если он открыл WebApp первым), другую по pseudo_tid (если он сначала зарегался через email в браузере).

### Решение

**Правило №1: UID выдаётся один раз, навсегда.**  
При регистрации через любой канал:
- Проверить, не существует ли уже юзера с таким `telegram_id`/`vk_id`/`email`.
- Если да — взять его `uid`.
- Если нет — сгенерировать новый.

**Правило №2: WebApp = auto-login, не auto-register.**  
При открытии WebApp:
1. Клиент отправляет `initData` на `/api/auth/login/telegram-webapp` (существующий endpoint).
2. Backend верифицирует HMAC initData → получает `telegram_id` → ищет пользователя.
3. **Если найден** → выдаёт JWT (с uid + tid).
4. **Если не найден** — возвращает `{needs_registration: true, telegram_data: {...}}`. Фронт показывает форму регистрации (такую же, как в браузере!), но префилом `first_name`, `last_name`, `photo_url` из initData.
5. После регистрации — backend создаёт user с `uid` + `telegram_id`, выдаёт JWT.

**Правило №3: Email-юзер может прилинковать Telegram из настроек.**  
В WebApp уже залогиненный email-юзер нажимает "Прилинковать Telegram" → backend делает `users.update_one({uid}, {"$set": {"telegram_id": tid}, "$addToSet": {"auth_providers": "telegram"}})`.

### Синхронизация истории

Если в момент прилинковки TG у юзера была активность под pseudo_tid, backend запускает миграцию в 37 коллекциях:
```python
pseudo_tid = PSEUDO_TID_OFFSET + int(uid)
real_tid = new_telegram_id
for coll_name in COLLS_WITH_TID:
    await db[coll_name].update_many(
        {"telegram_id": pseudo_tid},
        {"$set": {"telegram_id": real_tid}}
    )
```

(Этот код частично есть в `auth_routes.py:1408`, но только для `user_settings`. Расширить на все 37 коллекций.)

### Frontend: единый entry-point

```jsx
// App.jsx — упрощённый флоу
function App() {
  const { authUser, loading } = useAuth();
  const { tgUser, isWebApp } = useTelegram();

  useEffect(() => {
    if (isWebApp && !authUser && !loading) {
      // Авто-логин через initData
      loginViaTelegramWebApp(window.Telegram.WebApp.initData).then(res => {
        if (res.needs_registration) {
          // Показать форму регистрации с префилом
          openRegistration({ prefill: res.telegram_data });
        }
      });
    }
  }, [isWebApp, authUser, loading]);

  if (loading) return <Splash />;
  if (!authUser) return <LoginPage />;

  return <MainApp user={authUser} />;
}
```

Результат: независимо от точки входа (WebApp/браузер), у юзера одна и та же учётка с одним UID.

---

# 🧪 Тест-план

## P0 тесты
- [ ] Регистрация email → запись в `scheduled_notifications` с pseudo_tid → scheduler не падает, логирует `Skip bot push`.
- [ ] Привязка TG к email-юзеру → миграция данных → `scheduled_notifications` перенесён на real_tid → бот шлёт уведомление.
- [ ] Unit-тест `is_real_telegram_user`: 0, -1, 1000, `10_000_000_000`, `11_000_000_000` → корректные результаты.

## P1 тесты
- [ ] `delivery.send(uid="771010408", kind="test", ...)` → in-app создано, TG skipped (юзер без tid).
- [ ] `delivery.send(telegram_id=765963392, ...)` → in-app + TG.
- [ ] `delivery.send(uid=???, priority=SILENT)` → только in-app.
- [ ] Retry: падает TG → через 5 мин scheduler ретраит → OK.

## P2 тесты
- [ ] Email-юзер с `uid` из `ADMIN_UIDS` → видит админку.
- [ ] Avatar на PublicProfilePage одинаковый для email и TG юзера с одним uid.
- [ ] `localStorage.telegram_user` больше не перезаписывается.

## P3 тесты
- [ ] `GET /api/u/771010408/tasks` → те же данные, что `GET /api/tasks/10771010408` (pseudo_tid VK-юзера).
- [ ] `GET /api/tasks/771010408` (dual-accept) → те же данные.
- [ ] JWT содержит и `uid`, и `tid`.

## P4 тесты
- [ ] После backfill: `db.tasks.countDocuments({uid: {$exists: false}})` == 0.
- [ ] Новая задача: `db.tasks.findOne({_id: new_id})` содержит и `telegram_id`, и `uid`.

## E2E: «один человек — один UID»
1. Открыть браузер → зарегистрироваться по email `test@ex.com` → UID = X.
2. Создать задачу, вступить в комнату.
3. Прилинковать Telegram (в настройках).
4. Открыть WebApp Telegram от того же аккаунта → авто-логин → **тот же UID = X**.
5. Задачи и комната — на месте.
6. Отвязать Email, оставить только TG → всё равно тот же UID = X.

---

# 📋 Чеклист для разработчика

## Перед началом
- [ ] Сделать бэкап БД: `mongodump --uri="$MONGO_URL" --out=/app/backups/pre_uid_migration`
- [ ] Прочитать `AI_CONTEXT.md` и `instrProfileAuth.md`.
- [ ] Проверить, что тесты из `/app/tests/` зелёные.

## P0 (обязательно к релизу)
- [ ] `is_real_telegram_user` добавлен в `auth_utils.py`.
- [ ] Guard во всех 18 местах `bot.send_*` / `notification_service.send_message`.
- [ ] Фильтр `PSEUDO_TID_OFFSET` в `prepare_daily_schedule`.
- [ ] Прогнать deep_testing_backend_v2 → 0 `chat not found` в логах.

## P1
- [ ] `services/delivery.py` создан, singleton работает.
- [ ] Все 18 точек DM-отправки мигрированы на `delivery.send`.
- [ ] `in_app_notifications` получает все типы уведомлений.
- [ ] Ретраи через scheduler работают.

## P2
- [ ] `utils/userIdentity.js` создан, используется везде.
- [ ] Admin detection через `user.uid`.
- [ ] Avatar-seed через `uid`.
- [ ] `localStorage.telegram_user` помечен legacy.

## P3
- [ ] `resolve_user` helper работает.
- [ ] 11 новых `/api/u/{uid}/*` endpoints.
- [ ] JWT содержит `uid` + `tid`.

## P4
- [ ] Backfill-скрипт прогнан на dev-DB → 0 документов без `uid`.
- [ ] Все CRUD-хендлеры пишут оба поля.
- [ ] Индексы по `uid` созданы.

---

# 🚫 Чего НЕ делать

1. ❌ **Не переименовывать поле `telegram_id` → `uid` в БД за один раз.** Это сломает всё.
2. ❌ **Не трогать боевой `telegram_bot.py` без guard-проверок.** Один неверный `bot.send_message` может уронить polling.
3. ❌ **Не убирать pseudo_tid pока есть код, который пишет в коллекции по telegram_id.** Сначала P4 (backfill), потом P5 (cleanup).
4. ❌ **Не делать breaking-change в JWT.** Старые токены должны продолжать работать 30 дней.
5. ❌ **Не удалять legacy endpoints `/{telegram_id}/*` пока фронт на них ссылается.**

---

# 🎯 Итог

По завершении всех фаз:

- ✅ Один пользователь — один UID. Навсегда.
- ✅ Один человек может зайти хоть через email, хоть через VK, хоть через TG WebApp — данные одни и те же.
- ✅ Push-уведомления в TG не ломают систему для VK/Email (идут через `MessageDeliveryService`, который сам решает канал).
- ✅ Админка, аватары, friends/rooms/chats работают одинаково для всех провайдеров.
- ✅ В коде и в БД термин `uid` — канонический. `telegram_id` — всего лишь один из опциональных link'ов (как `vk_id`, `email`).
- ✅ Запас на будущее: легко добавить новые провайдеры (Google, Apple, GitHub) — они дают свой `xxx_id`, но UID остаётся один.

---

**Связанные документы:**
- `AI_CONTEXT.md` — общий контекст проекта
- `instrProfileAuth.md` — Stage 1-5: мульти-авторизация
- `backend/auth_utils.py` — helpers (`pseudo_tid_from_uid`, `is_pseudo_tid`, `effective_tid_for_user`, будущий `resolve_user`)
- `backend/services/delivery.py` — ключевая абстракция (создаётся в P1)
- `frontend/src/utils/userIdentity.js` — фронт-хелперы (создаётся в P2)
- `backend/migrations/backfill_uid_to_collections.py` — backfill-скрипт (создаётся в P4)

**Контакт при вопросах:** `planBugCorrectProffile.md`, `diary.md`.
