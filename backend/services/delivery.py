"""
📬 Message Delivery Service — единая точка доставки уведомлений.

## История версий

**Релиз 1** (P0 из `instrUIDprofile.md`):
  - `safe_send_telegram`: guard для pseudo_tid — больше нет `chat not found`.
  - `create_in_app_notification`: in-app fallback для всех.
  - `notify_user`: единая функция доставки in-app + TG.

**Релиз 2** (P1 Extension, текущий):
  - Enums `Channel` и `MessagePriority` — явная семантика каналов/приоритета.
  - `send_photo` — отдельная обёртка для фото-уведомлений (админ-рассылки, ДР, ачивки).
  - `send_batch` — параллельная отправка с семафором (N параллельных задач).
  - Retry/DLQ через коллекцию `delivery_attempts`.
  - `notify_user` принимает `priority: MessagePriority` (backward-compatible со строкой).
  - Сохранена обратная совместимость — старые вызовы `notify_user(..., priority="high")`
    и `safe_send_telegram(bot, tid, text=...)` продолжают работать.

## Каналы и приоритет

| Priority    | in-app | Telegram | Email¹ | Push FCM¹ | Retry |
|-------------|--------|----------|--------|-----------|-------|
| SILENT      | ✓      | —        | —      | —         | нет   |
| LOW         | ✓      | —²       | —      | —         | нет   |
| NORMAL      | ✓      | ✓        | —      | —         | 1     |
| HIGH        | ✓      | ✓        | —      | —         | 2     |
| IMPORTANT   | ✓      | ✓        | (план) | (план)    | 3     |
| URGENT      | ✓      | ✓        | (план) | (план)    | 5     |

¹ Email/FCM каналы — placeholder в этом релизе (P3+).
² LOW не шлёт в Telegram, чтобы не засорять чат.
"""

from __future__ import annotations

import asyncio
import html as _html
import logging
import time as _time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Awaitable, Callable, Iterable, Optional

from telegram.error import (
    BadRequest,
    Forbidden,
    NetworkError,
    RetryAfter,
    TelegramError,
    TimedOut,
)

from auth_utils import (
    PSEUDO_TID_OFFSET,
    effective_tid_for_user,
    is_pseudo_tid,
    is_real_telegram_user,
    pseudo_tid_from_uid,
)

logger = logging.getLogger(__name__)


# ────────────────────────────────────────────────────────────────────────────
#  Helpers / Constants
# ────────────────────────────────────────────────────────────────────────────


def _utc_now() -> datetime:
    """Текущий момент в UTC (tz-aware). Единая точка для всего модуля."""
    return datetime.now(timezone.utc)


def _utc_now_naive() -> datetime:
    """Naive UTC — для legacy-полей в БД, которые исторически naive."""
    return _utc_now().replace(tzinfo=None)


# Таймаут для одного TG-вызова. Защита от зависания (TG API иногда «висит»).
TG_SEND_TIMEOUT_SEC = 25.0

# Telegram caption (фото) лимит и text лимит
TG_CAPTION_MAX = 1024
TG_TEXT_MAX = 4096

# Перманентные ошибки TG — НЕ ретраим (юзер заблокировал бота / неверный chat_id).
_PERMANENT_TG_ERRORS = (
    "bot was blocked",
    "user is deactivated",
    "chat not found",
    "blocked by the user",
    "forbidden",
    "have no rights",
)


def _is_permanent_tg_error(err: BaseException) -> bool:
    """True если ошибку TG нет смысла ретраить."""
    if isinstance(err, Forbidden):
        return True
    msg = str(err).lower()
    return any(p in msg for p in _PERMANENT_TG_ERRORS)


def _html_escape_safe(text: Optional[str]) -> str:
    """Эскейпит спецсимволы HTML — для безопасного fallback при parse_mode=HTML."""
    if not text:
        return ""
    return _html.escape(str(text), quote=False)


# ────────────────────────────────────────────────────────────────────────────
#  Circuit Breaker (in-memory) — на случай падения TG API
# ────────────────────────────────────────────────────────────────────────────


class _TGCircuitBreaker:
    """Простой circuit breaker: при N последовательных fail'ах открывается на T сек.

    Открыт → safe_send_telegram сразу возвращает False (без вызова TG).
    Это снимает нагрузку с TG API во время глобального отказа и не забивает retry-queue.

    Перманентные ошибки (Forbidden, chat_not_found) НЕ считаются — это not TG-фейлы,
    а проблемы конкретного юзера.
    """

    def __init__(self, fail_threshold: int = 10, open_duration_sec: float = 60.0):
        self.fail_threshold = fail_threshold
        self.open_duration_sec = open_duration_sec
        self._consecutive_fails = 0
        self._opened_at: Optional[float] = None

    def is_open(self) -> bool:
        if self._opened_at is None:
            return False
        if _time.monotonic() - self._opened_at >= self.open_duration_sec:
            # Half-open: сбрасываем после паузы, даём шанс
            self._opened_at = None
            self._consecutive_fails = 0
            logger.info("[delivery.cb] Circuit breaker reset (half-open).")
            return False
        return True

    def record_success(self) -> None:
        if self._consecutive_fails > 0 or self._opened_at is not None:
            logger.info("[delivery.cb] TG send succeeded — resetting fail counter.")
        self._consecutive_fails = 0
        self._opened_at = None

    def record_failure(self, transient: bool) -> None:
        if not transient:
            # Перманентные ошибки не считаем
            return
        self._consecutive_fails += 1
        if self._consecutive_fails >= self.fail_threshold and self._opened_at is None:
            self._opened_at = _time.monotonic()
            logger.warning(
                f"[delivery.cb] OPEN: {self._consecutive_fails} consecutive TG fails. "
                f"Pausing TG sends for {self.open_duration_sec}s."
            )


_tg_breaker = _TGCircuitBreaker()


# ────────────────────────────────────────────────────────────────────────────
#  Enums
# ────────────────────────────────────────────────────────────────────────────


class Channel(str, Enum):
    """Каналы доставки сообщения."""

    TELEGRAM = "telegram"      # Telegram Bot API
    IN_APP = "in_app"          # MongoDB `in_app_notifications`
    WEB_PUSH = "web_push"      # Web Push (PWA, RFC 8030 + VAPID) — iOS 16.4+, Android, Desktop
    EMAIL = "email"            # SMTP (план P3)
    PUSH_FCM = "push_fcm"      # Firebase Cloud Messaging (план P3, нативные мобильные)


class MessagePriority(str, Enum):
    """Приоритет сообщения — определяет набор каналов и retry-стратегию."""

    SILENT = "silent"          # только in-app, без уведомления
    LOW = "low"                # только in-app (видимое)
    NORMAL = "normal"          # in-app + TG (если real TG)
    HIGH = "high"              # in-app + TG + retry x2
    IMPORTANT = "important"    # in-app + TG + email (план) + retry x3
    URGENT = "urgent"          # все каналы + агрессивный retry x5


# Map priority → max retry attempts
_PRIORITY_RETRY_MAX = {
    MessagePriority.SILENT: 0,
    MessagePriority.LOW: 0,
    MessagePriority.NORMAL: 1,
    MessagePriority.HIGH: 2,
    MessagePriority.IMPORTANT: 3,
    MessagePriority.URGENT: 5,
}

# Map priority → отправлять ли в Telegram
_PRIORITY_SENDS_TG = {
    MessagePriority.SILENT: False,
    MessagePriority.LOW: False,
    MessagePriority.NORMAL: True,
    MessagePriority.HIGH: True,
    MessagePriority.IMPORTANT: True,
    MessagePriority.URGENT: True,
}


# Mapping приоритета к legacy-строке для InAppNotification.priority
_LEGACY_PRIORITY_MAP = {
    MessagePriority.SILENT: "low",
    MessagePriority.LOW: "low",
    MessagePriority.NORMAL: "normal",
    MessagePriority.HIGH: "high",
    MessagePriority.IMPORTANT: "high",
    MessagePriority.URGENT: "urgent",
}


def _coerce_priority(priority: Any) -> MessagePriority:
    """Принимает MessagePriority, строку ('high'/'normal'/...) или None → MessagePriority."""
    if isinstance(priority, MessagePriority):
        return priority
    if priority is None:
        return MessagePriority.NORMAL
    try:
        return MessagePriority(str(priority).lower())
    except ValueError:
        # Обратная совместимость: строки, которых нет в enum
        mapping = {
            "low": MessagePriority.LOW,
            "medium": MessagePriority.NORMAL,
            "normal": MessagePriority.NORMAL,
            "high": MessagePriority.HIGH,
            "critical": MessagePriority.URGENT,
        }
        return mapping.get(str(priority).lower(), MessagePriority.NORMAL)


# ────────────────────────────────────────────────────────────────────────────
#  Result dataclass
# ────────────────────────────────────────────────────────────────────────────


@dataclass
class DeliveryResult:
    """Результат отправки одного сообщения — какие каналы сработали."""

    delivered: list[Channel] = field(default_factory=list)
    skipped: list[Channel] = field(default_factory=list)
    errors: dict[str, str] = field(default_factory=dict)
    in_app_id: Optional[str] = None
    telegram_sent: bool = False
    telegram_skipped_reason: Optional[str] = None
    retry_scheduled: bool = False
    attempts: int = 0

    # ─── Web Push (PWA) ────────────────────────────────────────────────────
    web_push_sent_count: int = 0          # сколько устройств получили push
    web_push_failed_count: int = 0        # сколько устройств fail'нули
    web_push_subscriptions: int = 0       # сколько активных подписок было у юзера

    # ─── Cross-platform семантика (P2 fix) ────────────────────────────────
    user_has_real_telegram: bool = False
    delivered_to_user: bool = False
    requires_retry: bool = False

    def to_dict(self) -> dict:
        """Сериализация в dict (для обратной совместимости со старыми хендлерами)."""
        return {
            "delivered": [c.value for c in self.delivered],
            "skipped": [c.value for c in self.skipped],
            "errors": dict(self.errors),
            "in_app_id": self.in_app_id,
            "telegram_sent": self.telegram_sent,
            "telegram_skipped_reason": self.telegram_skipped_reason,
            "retry_scheduled": self.retry_scheduled,
            "attempts": self.attempts,
            "web_push_sent_count": self.web_push_sent_count,
            "web_push_failed_count": self.web_push_failed_count,
            "web_push_subscriptions": self.web_push_subscriptions,
            "user_has_real_telegram": self.user_has_real_telegram,
            "delivered_to_user": self.delivered_to_user,
            "requires_retry": self.requires_retry,
        }

    # Dict-подобный доступ для обратной совместимости (как делают старые вызовы):
    #   result["telegram_sent"], result["in_app_id"], result["telegram_skipped_reason"]
    def __getitem__(self, key: str) -> Any:
        return self.to_dict()[key]

    def get(self, key: str, default: Any = None) -> Any:
        return self.to_dict().get(key, default)

    @property
    def any_delivered(self) -> bool:
        """True если хоть куда-то доставлено."""
        return len(self.delivered) > 0


# ────────────────────────────────────────────────────────────────────────────
#  User resolver
# ────────────────────────────────────────────────────────────────────────────


async def _resolve_user_doc(
    db,
    *,
    uid: Optional[str] = None,
    telegram_id: Optional[int] = None,
) -> Optional[dict]:
    """Резолв пользователя по uid или telegram_id (real или pseudo)."""
    if uid:
        u = await db.users.find_one({"uid": str(uid)})
        if u:
            return u

    if telegram_id is None:
        return None

    try:
        tid = int(telegram_id)
    except (TypeError, ValueError):
        return None

    if tid < PSEUDO_TID_OFFSET:
        return await db.users.find_one({"telegram_id": tid})

    synth_uid = str(tid - PSEUDO_TID_OFFSET).zfill(9)
    return await db.users.find_one({"uid": synth_uid})


def _effective_tid_from_inputs(
    user_doc: Optional[dict],
    explicit_telegram_id: Optional[int],
) -> Optional[int]:
    """«Ключ для legacy-коллекций» — real tid или pseudo_tid."""
    if user_doc:
        eff = effective_tid_for_user(user_doc)
        if eff is not None:
            return int(eff)
    if explicit_telegram_id is not None:
        try:
            return int(explicit_telegram_id)
        except (TypeError, ValueError):
            return None
    return None


# ────────────────────────────────────────────────────────────────────────────
#  Low-level Telegram wrapper
# ────────────────────────────────────────────────────────────────────────────


async def safe_send_telegram(
    bot,
    telegram_id: Any,
    *,
    text: Optional[str] = None,
    photo: Any = None,
    caption: Optional[str] = None,
    parse_mode: Optional[str] = "HTML",
    reply_markup: Any = None,
    method: str = "auto",  # "auto" | "message" | "photo"
    log_ctx: str = "",
    timeout: float = TG_SEND_TIMEOUT_SEC,
) -> bool:
    """Безопасная обёртка над `bot.send_message` / `bot.send_photo`.

    P0 guard: если `telegram_id` — pseudo_tid (VK/Email/QR-юзер), НЕ вызываем Bot API
    (иначе `chat not found` в логах). Просто логируем и возвращаем False.

    P2 fix:
    - timeout-protected (asyncio.wait_for) — не виснем на проблемах сети
    - валидация пустого текста (TG возвращает 400 на пустой text)
    - circuit breaker: при N последовательных fails — пауза, чтобы не забивать retry-queue
    - pseudo-tid skip логируется как DEBUG (а не INFO) — это ожидаемая ситуация
    - перманентные ошибки (Forbidden, chat_not_found) — INFO, не WARNING

    Returns:
        True если сообщение ушло в TG, False если пропущено или упало.
    """
    # ── Guard 1: pseudo-tid / no-tid ───────────────────────────────────────
    if not is_real_telegram_user(telegram_id):
        reason = "pseudo_tid" if is_pseudo_tid(telegram_id) else "no_tid"
        logger.debug(
            f"🟡 [delivery] Skip Telegram push: tid={telegram_id} reason={reason} "
            f"ctx={log_ctx or '-'}"
        )
        return False

    # ── Guard 2: bot не инициализирован ────────────────────────────────────
    if bot is None:
        logger.debug(f"[delivery] bot is None (ctx={log_ctx})")
        return False

    # ── Guard 3: circuit breaker открыт ────────────────────────────────────
    if _tg_breaker.is_open():
        logger.warning(
            f"[delivery] Circuit breaker OPEN — skip TG send tid={telegram_id} ctx={log_ctx}"
        )
        return False

    # ── Guard 4: валидация контента ────────────────────────────────────────
    effective_method = method
    if effective_method == "auto":
        effective_method = "photo" if photo is not None else "message"

    if effective_method == "message":
        body = text or caption or ""
        if not body.strip():
            logger.warning(
                f"[delivery] empty text for TG send tid={telegram_id} ctx={log_ctx} — skip"
            )
            return False
        # TG лимит 4096 символов для text
        if len(body) > TG_TEXT_MAX:
            body = body[: TG_TEXT_MAX - 3] + "..."
            text = body  # обновляем для kwargs ниже
    else:  # photo
        # photo сам может быть пустым только если ошибочно передали None — это поймает TG API
        cap = caption or ""
        if cap and len(cap) > TG_CAPTION_MAX:
            caption = cap[: TG_CAPTION_MAX - 3] + "..."

    # ── Send (с timeout) ───────────────────────────────────────────────────
    kwargs: dict = {"chat_id": int(telegram_id)}
    if parse_mode:
        kwargs["parse_mode"] = parse_mode
    if reply_markup is not None:
        kwargs["reply_markup"] = reply_markup

    try:
        if effective_method == "photo":
            if caption is not None:
                kwargs["caption"] = caption
            await asyncio.wait_for(
                bot.send_photo(photo=photo, **kwargs),
                timeout=timeout,
            )
        else:
            kwargs["text"] = text or caption or ""
            await asyncio.wait_for(
                bot.send_message(**kwargs),
                timeout=timeout,
            )
        _tg_breaker.record_success()
        return True

    except asyncio.TimeoutError:
        logger.warning(
            f"📤 [delivery] TG send TIMEOUT ({timeout}s) tid={telegram_id} ctx={log_ctx}"
        )
        _tg_breaker.record_failure(transient=True)
        return False

    except RetryAfter as e:
        # TG flood-control: бот превысил rate. Записываем как transient.
        logger.warning(
            f"📤 [delivery] TG RetryAfter tid={telegram_id} ctx={log_ctx}: "
            f"retry_after={getattr(e, 'retry_after', '?')}s"
        )
        _tg_breaker.record_failure(transient=True)
        return False

    except (Forbidden,) as e:
        # Юзер заблокировал бота / деактивирован — НЕ ретраим
        logger.info(
            f"📤 [delivery] TG forbidden tid={telegram_id} ctx={log_ctx}: {e}"
        )
        _tg_breaker.record_failure(transient=False)
        return False

    except BadRequest as e:
        # chat_not_found / message too long / parse-error и т.д.
        # Большинство — перманентные (для данного юзера), retry бессмыслен.
        permanent = _is_permanent_tg_error(e)
        if permanent:
            logger.info(
                f"📤 [delivery] TG bad_request (permanent) tid={telegram_id} ctx={log_ctx}: {e}"
            )
        else:
            logger.warning(
                f"📤 [delivery] TG bad_request (transient?) tid={telegram_id} ctx={log_ctx}: {e}"
            )
        _tg_breaker.record_failure(transient=not permanent)
        return False

    except (NetworkError, TimedOut) as e:
        logger.warning(
            f"📤 [delivery] TG network error tid={telegram_id} ctx={log_ctx}: {e}"
        )
        _tg_breaker.record_failure(transient=True)
        return False

    except TelegramError as e:
        permanent = _is_permanent_tg_error(e)
        level = logger.info if permanent else logger.warning
        level(
            f"📤 [delivery] TelegramError tid={telegram_id} ctx={log_ctx}: {e}"
        )
        _tg_breaker.record_failure(transient=not permanent)
        return False

    except Exception as e:  # noqa: BLE001
        logger.error(
            f"📤 [delivery] Unexpected error tid={telegram_id} ctx={log_ctx}: {e}",
            exc_info=True,
        )
        _tg_breaker.record_failure(transient=True)
        return False


# ────────────────────────────────────────────────────────────────────────────
#  In-app notification
# ────────────────────────────────────────────────────────────────────────────


async def create_in_app_notification(
    db,
    *,
    telegram_id: int,
    title: str,
    message: str,
    type: str = "info",
    category: str = "system",
    priority: str = "normal",
    emoji: str = "🔔",
    data: Optional[dict] = None,
    action_url: Optional[str] = None,
    actions: Optional[list] = None,
    uid: Optional[str] = None,  # P4 preparation: дублируем для backfill'a
) -> Optional[str]:
    """Создаёт запись в `in_app_notifications`.

    Returns:
        id созданного документа или None при ошибке.
    """
    try:
        notif_id = str(uuid.uuid4())
        doc = {
            "id": notif_id,
            "telegram_id": int(telegram_id),
            "type": type,
            "category": category,
            "priority": priority,
            "title": (title or "")[:200],
            "message": (message or "")[:2000],
            "emoji": emoji or "🔔",
            "data": data or {},
            "action_url": action_url,
            "actions": actions or [],
            "action_taken": None,
            "read": False,
            "dismissed": False,
            "created_at": _utc_now(),
            "read_at": None,
            "expires_at": None,
        }
        # P4 preparation: дублируем uid (пусть пока неиспользуемый фронтом)
        if uid:
            doc["uid"] = str(uid)
        await db.in_app_notifications.insert_one(doc)
        return notif_id
    except Exception as e:  # noqa: BLE001
        logger.error(f"[delivery] in-app insert failed tid={telegram_id}: {e}", exc_info=True)
        return None


# ────────────────────────────────────────────────────────────────────────────
#  Delivery Attempts / DLQ
# ────────────────────────────────────────────────────────────────────────────

DELIVERY_ATTEMPTS_COLL = "delivery_attempts"

# Задержки retry в секундах — экспоненциальный backoff
_RETRY_DELAYS_SEC = [30, 120, 300, 900, 1800]  # 30s, 2m, 5m, 15m, 30m


async def _record_delivery_attempt(
    db,
    *,
    uid: Optional[str],
    telegram_id: Optional[int],
    kind: str,
    category: str,
    priority: MessagePriority,
    payload: dict,
    status: str,               # "sent" | "failed" | "pending_retry"
    attempt: int,
    error: Optional[str] = None,
    next_retry_at: Optional[datetime] = None,
) -> None:
    """Логирует попытку доставки в `delivery_attempts`. Silent failure на ошибке логирования."""
    try:
        doc = {
            "id": str(uuid.uuid4()),
            "uid": str(uid) if uid else None,
            "telegram_id": int(telegram_id) if telegram_id else None,
            "kind": kind,
            "category": category,
            "priority": priority.value,
            "payload": payload,
            "status": status,
            "attempt": attempt,
            "max_attempts": _PRIORITY_RETRY_MAX[priority] + 1,
            "error": error,
            "next_retry_at": next_retry_at,
            "created_at": _utc_now(),
        }
        await db[DELIVERY_ATTEMPTS_COLL].insert_one(doc)
    except Exception as e:  # noqa: BLE001
        logger.error(f"[delivery] failed to record attempt: {e}", exc_info=False)


async def ensure_delivery_attempts_indexes(db) -> None:
    """Создаёт индексы для `delivery_attempts` (вызывается из startup)."""
    coll = db[DELIVERY_ATTEMPTS_COLL]
    # Базовые индексы — быстро и идемпотентно
    for idx_spec, idx_name in [
        ("status", "status_1"),
        ([("status", 1), ("next_retry_at", 1)], "status_nextretry"),
        ("uid", "uid_1"),
        ("telegram_id", "telegram_id_1"),
    ]:
        try:
            await coll.create_index(idx_spec, name=idx_name)
        except Exception as e:  # noqa: BLE001
            logger.debug(f"[delivery] index {idx_name}: {e}")

    # TTL: удаляем логи старше 14 дней. Если уже есть индекс на created_at
    # без TTL — просто логируем и пропускаем (не критично).
    try:
        await coll.create_index(
            "created_at",
            expireAfterSeconds=14 * 24 * 3600,
            name="delivery_attempts_ttl",
        )
    except Exception as e:  # noqa: BLE001
        # IndexOptionsConflict — уже есть без TTL, это ОК
        err_msg = str(e)
        if "IndexOptionsConflict" in err_msg or "already exists" in err_msg:
            logger.info(
                "[delivery] TTL index already exists as non-TTL — "
                "14-day cleanup disabled. Can be fixed manually: "
                "db.delivery_attempts.dropIndex('created_at_1')"
            )
        else:
            logger.warning(f"[delivery] TTL index failed: {e}")
    logger.info("✅ delivery_attempts indexes checked")


# ────────────────────────────────────────────────────────────────────────────
#  High-level API: notify_user
# ────────────────────────────────────────────────────────────────────────────


async def notify_user(
    db,
    bot,
    *,
    # Идентификация получателя
    uid: Optional[str] = None,
    telegram_id: Optional[int] = None,
    user_doc: Optional[dict] = None,
    # Содержимое
    title: str,
    message: str,
    emoji: str = "🔔",
    # Метаданные для in-app
    type: str = "info",
    category: str = "system",
    priority: Any = MessagePriority.NORMAL,   # MessagePriority | str
    data: Optional[dict] = None,
    action_url: Optional[str] = None,
    actions: Optional[list] = None,
    # Каналы (override, если нужно)
    send_telegram: Optional[bool] = None,     # None → по приоритету
    send_in_app: bool = True,
    send_web_push: Optional[bool] = None,     # None → по приоритету (как send_telegram)
    # Telegram-specific
    telegram_text: Optional[str] = None,      # если не задан — из title+message
    telegram_parse_mode: str = "HTML",
    telegram_reply_markup: Any = None,
    # Web Push specific
    web_push_url: Optional[str] = None,       # куда вести юзера по клику (relative или absolute)
    web_push_tag: Optional[str] = None,       # group tag (одинаковый tag → схлопывается в одну)
    web_push_icon: Optional[str] = None,
    # Retry
    enable_retry: bool = False,               # писать ли в delivery_attempts при fail
    # Diagnostics
    log_ctx: str = "",
) -> DeliveryResult:
    """Единая точка доставки уведомления пользователю.

    Returns:
        DeliveryResult — что доставлено/пропущено/с какими ошибками.
        Поддерживает обратно-совместимый доступ через `result["telegram_sent"]`.
    """
    result = DeliveryResult()
    prio = _coerce_priority(priority)
    result.attempts = 1

    # ── 1. Резолв user_doc ───────────────────────────────────────────────
    if user_doc is None and (uid or telegram_id is not None):
        user_doc = await _resolve_user_doc(db, uid=uid, telegram_id=telegram_id)

    # Восстанавливаем uid из user_doc, если он не был передан
    if not uid and user_doc:
        uid = user_doc.get("uid")

    # ── 2. effective_tid — ключ для legacy in-app ────────────────────────
    eff_tid = _effective_tid_from_inputs(user_doc, telegram_id)
    if eff_tid is None and uid:
        try:
            eff_tid = pseudo_tid_from_uid(uid)
        except (TypeError, ValueError):
            eff_tid = None

    # ── 3. In-app channel ────────────────────────────────────────────────
    if send_in_app and eff_tid is not None:
        result.in_app_id = await create_in_app_notification(
            db,
            telegram_id=eff_tid,
            title=title,
            message=message,
            type=type,
            category=category,
            priority=_LEGACY_PRIORITY_MAP[prio],
            emoji=emoji,
            data=data,
            action_url=action_url,
            actions=actions,
            uid=uid,
        )
        if result.in_app_id:
            result.delivered.append(Channel.IN_APP)
        else:
            result.skipped.append(Channel.IN_APP)
            result.errors["in_app"] = "insert_failed"
    else:
        result.skipped.append(Channel.IN_APP)
        if not send_in_app:
            result.errors["in_app"] = "disabled"

    # ── 4. Telegram channel ──────────────────────────────────────────────
    # Определяем, нужно ли отправлять в TG
    should_send_tg = send_telegram if send_telegram is not None else _PRIORITY_SENDS_TG[prio]

    # Сначала вычисляем real_tid — это важно для итоговой семантики
    real_tid: Optional[int] = None
    if user_doc:
        ut = user_doc.get("telegram_id")
        if ut is not None and is_real_telegram_user(ut):
            real_tid = int(ut)
    elif telegram_id is not None and is_real_telegram_user(telegram_id):
        real_tid = int(telegram_id)

    # P2 fix: запоминаем, есть ли у юзера реальный TG. Это ключ для requires_retry.
    result.user_has_real_telegram = real_tid is not None

    if not should_send_tg:
        result.skipped.append(Channel.TELEGRAM)
        result.telegram_skipped_reason = "priority_low" if prio in (
            MessagePriority.SILENT, MessagePriority.LOW
        ) else "disabled"
    else:
        if real_tid is None:
            result.skipped.append(Channel.TELEGRAM)
            result.telegram_skipped_reason = (
                "pseudo_tid" if (eff_tid is not None and is_pseudo_tid(eff_tid)) else "no_tid"
            )
        else:
            tg_text = telegram_text
            if tg_text is None:
                # Fallback: эскейпим title/message чтобы избежать parse-error при HTML
                tg_text = f"{emoji} <b>{_html_escape_safe(title)}</b>\n{_html_escape_safe(message)}"

            ok = await safe_send_telegram(
                bot,
                real_tid,
                text=tg_text,
                parse_mode=telegram_parse_mode,
                reply_markup=telegram_reply_markup,
                method="message",
                log_ctx=log_ctx or f"notify_user/{category}",
            )
            result.telegram_sent = ok
            if ok:
                result.delivered.append(Channel.TELEGRAM)
            else:
                result.skipped.append(Channel.TELEGRAM)
                result.telegram_skipped_reason = "send_error"
                result.errors["telegram"] = "send_failed"

                # ── 5. Retry scheduling (только если priority >= NORMAL) ─
                if enable_retry and _PRIORITY_RETRY_MAX[prio] > 0:
                    delay = _RETRY_DELAYS_SEC[0]
                    next_retry_at = _utc_now() + timedelta(seconds=delay)
                    try:
                        await _record_delivery_attempt(
                            db,
                            uid=uid,
                            telegram_id=real_tid,
                            kind=type,
                            category=category,
                            priority=prio,
                            payload={
                                "title": title,
                                "message": message,
                                "emoji": emoji,
                                "telegram_text": tg_text,
                                "parse_mode": telegram_parse_mode,
                                "data": data or {},
                            },
                            status="pending_retry",
                            attempt=1,
                            error="tg_send_failed",
                            next_retry_at=next_retry_at,
                        )
                        result.retry_scheduled = True
                    except Exception as e:  # noqa: BLE001
                        logger.error(f"[delivery] retry schedule failed: {e}")

    # ── 5b. Web Push channel (PWA / iOS 16.4+) ───────────────────────────
    # Отправляем для NORMAL и выше приоритета (как TG).
    # Делаем это для ВСЕХ юзеров с активной подпиской (real-TG и pseudo-tid).
    # iOS-юзер мог установить PWA и не пользоваться TG — для него web push критичен.
    should_send_wp = send_web_push if send_web_push is not None else _PRIORITY_SENDS_TG[prio]
    if should_send_wp:
        try:
            from services.webpush import is_webpush_configured, send_web_push_to_user
            if is_webpush_configured() and (uid or eff_tid is not None or real_tid is not None):
                wp_body = message or title
                wp_res = await send_web_push_to_user(
                    db,
                    telegram_id=eff_tid if eff_tid is not None else real_tid,
                    uid=uid,
                    title=f"{emoji} {title}".strip() if emoji else title,
                    body=wp_body,
                    url=web_push_url or action_url,
                    tag=web_push_tag or f"{category}",
                    icon=web_push_icon,
                    data={"category": category, "type": type, **(data or {})},
                    log_ctx=log_ctx or f"notify_user/{category}",
                )
                result.web_push_sent_count = wp_res.sent_count
                result.web_push_failed_count = wp_res.failed_count
                result.web_push_subscriptions = wp_res.sent_count + wp_res.failed_count + wp_res.removed_count
                if wp_res.any_sent:
                    result.delivered.append(Channel.WEB_PUSH)
                elif wp_res.failed_count or wp_res.removed_count:
                    result.skipped.append(Channel.WEB_PUSH)
                    if wp_res.errors:
                        result.errors["web_push"] = wp_res.errors[0][:120]
                else:
                    # Подписок нет — просто скип, без шума
                    result.skipped.append(Channel.WEB_PUSH)
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[delivery] web_push step failed: {e}")
            result.skipped.append(Channel.WEB_PUSH)
            result.errors["web_push"] = str(e)[:120]
    else:
        result.skipped.append(Channel.WEB_PUSH)

    # ── 6. Финальная семантика: delivered_to_user / requires_retry ───────
    # delivered_to_user: считаем успехом, если хоть один из ОСНОВНЫХ каналов сработал.
    #   — real-TG юзер: TG ИЛИ web push (последний — отличный fallback)
    #   — pseudo-tid юзер: in-app ИЛИ web push
    if result.user_has_real_telegram:
        if result.telegram_sent or result.web_push_sent_count > 0:
            result.delivered_to_user = True
        elif not should_send_tg and result.in_app_id is not None:
            # Если TG не пытались (low priority), достаточно in-app
            result.delivered_to_user = True
        else:
            result.delivered_to_user = False
    else:
        # pseudo-tid юзер: web push ИЛИ in-app
        result.delivered_to_user = (
            result.web_push_sent_count > 0 or result.in_app_id is not None
        )

    # requires_retry: только если real-TG юзер, хотели в TG, упало, и web push не спас
    result.requires_retry = (
        should_send_tg
        and result.user_has_real_telegram
        and not result.telegram_sent
        and result.web_push_sent_count == 0
    )

    return result


# ────────────────────────────────────────────────────────────────────────────
#  High-level API: send_photo (для админ-рассылок / ДР / ачивок)
# ────────────────────────────────────────────────────────────────────────────


async def notify_user_with_photo(
    db,
    bot,
    *,
    uid: Optional[str] = None,
    telegram_id: Optional[int] = None,
    user_doc: Optional[dict] = None,
    # Содержимое
    title: str,
    message: str,
    photo: Any,                               # URL или file_id или BytesIO
    caption: Optional[str] = None,            # caption для TG; default = telegram_text
    emoji: str = "🖼️",
    # Метаданные
    type: str = "info",
    category: str = "system",
    priority: Any = MessagePriority.NORMAL,
    data: Optional[dict] = None,
    action_url: Optional[str] = None,
    actions: Optional[list] = None,
    send_telegram: Optional[bool] = None,
    send_in_app: bool = True,
    # Telegram-specific
    telegram_parse_mode: str = "HTML",
    telegram_reply_markup: Any = None,
    telegram_text: Optional[str] = None,
    log_ctx: str = "",
) -> DeliveryResult:
    """Как `notify_user`, но шлёт в TG фото с caption. In-app сохраняет `image_url` в data."""
    result = DeliveryResult()
    prio = _coerce_priority(priority)
    result.attempts = 1

    if user_doc is None and (uid or telegram_id is not None):
        user_doc = await _resolve_user_doc(db, uid=uid, telegram_id=telegram_id)
    if not uid and user_doc:
        uid = user_doc.get("uid")

    eff_tid = _effective_tid_from_inputs(user_doc, telegram_id)
    if eff_tid is None and uid:
        try:
            eff_tid = pseudo_tid_from_uid(uid)
        except (TypeError, ValueError):
            eff_tid = None

    # In-app: добавляем image_url в data
    if send_in_app and eff_tid is not None:
        merged_data = dict(data or {})
        if isinstance(photo, str) and photo.startswith(("http://", "https://")):
            merged_data.setdefault("image_url", photo)
        result.in_app_id = await create_in_app_notification(
            db,
            telegram_id=eff_tid,
            title=title,
            message=message,
            type=type,
            category=category,
            priority=_LEGACY_PRIORITY_MAP[prio],
            emoji=emoji,
            data=merged_data,
            action_url=action_url,
            actions=actions,
            uid=uid,
        )
        if result.in_app_id:
            result.delivered.append(Channel.IN_APP)
        else:
            result.skipped.append(Channel.IN_APP)

    # Telegram photo
    should_send_tg = send_telegram if send_telegram is not None else _PRIORITY_SENDS_TG[prio]

    real_tid: Optional[int] = None
    if user_doc:
        ut = user_doc.get("telegram_id")
        if ut is not None and is_real_telegram_user(ut):
            real_tid = int(ut)
    elif telegram_id is not None and is_real_telegram_user(telegram_id):
        real_tid = int(telegram_id)

    result.user_has_real_telegram = real_tid is not None

    if not should_send_tg:
        result.skipped.append(Channel.TELEGRAM)
        result.telegram_skipped_reason = "disabled"
    else:
        if real_tid is None:
            result.skipped.append(Channel.TELEGRAM)
            result.telegram_skipped_reason = (
                "pseudo_tid" if (eff_tid is not None and is_pseudo_tid(eff_tid)) else "no_tid"
            )
        else:
            tg_caption = caption if caption is not None else (
                telegram_text if telegram_text is not None
                else f"{emoji} <b>{_html_escape_safe(title)}</b>\n{_html_escape_safe(message)}"
            )
            # TG caption лимит 1024 символа — обрабатываем уже в safe_send_telegram

            ok = await safe_send_telegram(
                bot,
                real_tid,
                photo=photo,
                caption=tg_caption,
                parse_mode=telegram_parse_mode,
                reply_markup=telegram_reply_markup,
                method="photo",
                log_ctx=log_ctx or f"notify_user_photo/{category}",
            )
            result.telegram_sent = ok
            if ok:
                result.delivered.append(Channel.TELEGRAM)
            else:
                result.skipped.append(Channel.TELEGRAM)
                result.telegram_skipped_reason = "send_error"

    # Финальная семантика — как в notify_user
    if result.user_has_real_telegram:
        if result.telegram_sent:
            result.delivered_to_user = True
        elif not should_send_tg and result.in_app_id is not None:
            result.delivered_to_user = True
        else:
            result.delivered_to_user = False
    else:
        result.delivered_to_user = result.in_app_id is not None

    result.requires_retry = (
        should_send_tg
        and result.user_has_real_telegram
        and not result.telegram_sent
    )

    return result


# ────────────────────────────────────────────────────────────────────────────
#  Batch API: параллельная отправка с семафором
# ────────────────────────────────────────────────────────────────────────────


@dataclass
class BatchRecipient:
    """Один получатель в batch-рассылке."""

    uid: Optional[str] = None
    telegram_id: Optional[int] = None
    # Персональные override-параметры контента (опционально)
    title_override: Optional[str] = None
    message_override: Optional[str] = None
    data_override: Optional[dict] = None


@dataclass
class BatchResult:
    """Агрегат результата batch-рассылки."""

    total: int = 0
    delivered_telegram: int = 0
    delivered_in_app: int = 0
    skipped_telegram: int = 0
    skipped_in_app: int = 0
    errors: int = 0
    # P2 fix: «доставлено пользователю» = TG (для real-TG) ИЛИ in-app (для pseudo).
    # Это правильная метрика «отправлено» для cross-platform рассылок.
    delivered_to_user: int = 0
    # Сколько pseudo-tid юзеров (VK/Email) — для них TG не пытались (это OK)
    pseudo_tid_recipients: int = 0
    # Сколько real-TG юзеров — у которых TG-fail (стоит ретраить / есть проблема)
    real_tg_failed: int = 0
    per_recipient: list[DeliveryResult] = field(default_factory=list)

    def summary(self) -> str:
        return (
            f"batch: total={self.total} "
            f"delivered={self.delivered_to_user} (tg={self.delivered_telegram} "
            f"in_app={self.delivered_in_app}) "
            f"pseudo={self.pseudo_tid_recipients} "
            f"tg_fail={self.real_tg_failed} err={self.errors}"
        )


async def send_batch(
    db,
    bot,
    recipients: Iterable[BatchRecipient] | Iterable[dict],
    *,
    title: str,
    message: str,
    emoji: str = "🔔",
    type: str = "info",
    category: str = "system",
    priority: Any = MessagePriority.NORMAL,
    data: Optional[dict] = None,
    action_url: Optional[str] = None,
    actions: Optional[list] = None,
    send_telegram: Optional[bool] = None,
    send_in_app: bool = True,
    telegram_text: Optional[str] = None,
    telegram_parse_mode: str = "HTML",
    enable_retry: bool = False,
    concurrency: int = 20,
    inter_batch_delay_ms: int = 0,  # пауза между «слотами» семафора
    log_ctx: str = "batch",
) -> BatchResult:
    """Параллельная отправка одного уведомления списку получателей.

    Args:
        recipients: итерируемое из BatchRecipient или dict ({'uid': ..., 'telegram_id': ...}).
        concurrency: количество параллельных отправок (Semaphore).
        inter_batch_delay_ms: задержка между слотами, чтобы не превышать TG rate-limit.

    Returns:
        BatchResult — агрегированная статистика.
    """
    # Нормализуем recipients в BatchRecipient
    normalized: list[BatchRecipient] = []
    for r in recipients:
        if isinstance(r, BatchRecipient):
            normalized.append(r)
        elif isinstance(r, dict):
            normalized.append(BatchRecipient(
                uid=r.get("uid"),
                telegram_id=r.get("telegram_id"),
                title_override=r.get("title_override"),
                message_override=r.get("message_override"),
                data_override=r.get("data_override"),
            ))
        else:
            # Считаем, что это просто telegram_id
            try:
                normalized.append(BatchRecipient(telegram_id=int(r)))
            except (TypeError, ValueError):
                continue

    result = BatchResult(total=len(normalized))
    if not normalized:
        return result

    semaphore = asyncio.Semaphore(max(1, concurrency))

    async def _send_one(recipient: BatchRecipient) -> DeliveryResult:
        async with semaphore:
            try:
                res = await notify_user(
                    db,
                    bot,
                    uid=recipient.uid,
                    telegram_id=recipient.telegram_id,
                    title=recipient.title_override or title,
                    message=recipient.message_override or message,
                    emoji=emoji,
                    type=type,
                    category=category,
                    priority=priority,
                    data=recipient.data_override or data,
                    action_url=action_url,
                    actions=actions,
                    send_telegram=send_telegram,
                    send_in_app=send_in_app,
                    telegram_text=telegram_text,
                    telegram_parse_mode=telegram_parse_mode,
                    enable_retry=enable_retry,
                    log_ctx=log_ctx,
                )
                if inter_batch_delay_ms > 0:
                    await asyncio.sleep(inter_batch_delay_ms / 1000)
                return res
            except Exception as e:  # noqa: BLE001
                logger.error(
                    f"[delivery.batch] recipient failed uid={recipient.uid} "
                    f"tid={recipient.telegram_id}: {e}",
                    exc_info=False,
                )
                err_result = DeliveryResult()
                err_result.errors["exception"] = str(e)[:200]
                return err_result

    tasks = [_send_one(r) for r in normalized]
    results = await asyncio.gather(*tasks, return_exceptions=False)

    for res in results:
        result.per_recipient.append(res)
        if Channel.TELEGRAM in res.delivered:
            result.delivered_telegram += 1
        if Channel.TELEGRAM in res.skipped:
            result.skipped_telegram += 1
        if Channel.IN_APP in res.delivered:
            result.delivered_in_app += 1
        if Channel.IN_APP in res.skipped:
            result.skipped_in_app += 1
        if res.errors:
            result.errors += 1
        # P2 fix: cross-platform aware counters
        if res.delivered_to_user:
            result.delivered_to_user += 1
        if not res.user_has_real_telegram:
            result.pseudo_tid_recipients += 1
        elif res.user_has_real_telegram and not res.telegram_sent:
            result.real_tg_failed += 1

    logger.info(f"[delivery.batch] {log_ctx}: {result.summary()}")
    return result


# ────────────────────────────────────────────────────────────────────────────
#  Retry worker — периодически вызывается scheduler'ом
# ────────────────────────────────────────────────────────────────────────────


async def process_pending_retries(
    db,
    bot,
    *,
    limit: int = 50,
    log_ctx: str = "retry_worker",
) -> dict:
    """Обработать ожидающие retry из `delivery_attempts`.

    Идемпотентный: использует `$inc` на attempt + `findAndModify`-style update
    для защиты от дубликатов при параллельном запуске (не обязательно, но полезно).

    Returns:
        {"processed": N, "sent": K, "failed": M, "dlq": P}
    """
    now = _utc_now()
    stats = {"processed": 0, "sent": 0, "failed": 0, "dlq": 0}

    try:
        cursor = db[DELIVERY_ATTEMPTS_COLL].find({
            "status": "pending_retry",
            "next_retry_at": {"$lte": now},
        }).sort("next_retry_at", 1).limit(limit)

        pending = await cursor.to_list(length=limit)
    except Exception as e:  # noqa: BLE001
        logger.error(f"[delivery.retry] fetch failed: {e}")
        return stats

    for attempt_doc in pending:
        stats["processed"] += 1
        try:
            # Атомарно захватываем запись — меняем status на 'processing'
            take = await db[DELIVERY_ATTEMPTS_COLL].update_one(
                {"_id": attempt_doc["_id"], "status": "pending_retry"},
                {"$set": {"status": "processing", "processing_started_at": _utc_now()}},
            )
            if take.modified_count == 0:
                # Кто-то другой уже обрабатывает
                continue

            payload = attempt_doc.get("payload") or {}
            tid = attempt_doc.get("telegram_id")
            attempt_num = int(attempt_doc.get("attempt", 1)) + 1
            prio = _coerce_priority(attempt_doc.get("priority"))
            max_attempts = _PRIORITY_RETRY_MAX[prio]

            # Выбираем текст: предпочитаем готовый telegram_text (с разметкой).
            # Если его нет — берём message, но эскейпим HTML, чтобы не упасть на parse_mode=HTML.
            tg_text = payload.get("telegram_text")
            parse_mode_ = payload.get("parse_mode", "HTML")
            if not tg_text:
                raw_msg = payload.get("message") or payload.get("title") or ""
                if parse_mode_ and parse_mode_.upper() == "HTML":
                    tg_text = _html_escape_safe(raw_msg)
                else:
                    tg_text = raw_msg

            # Пробуем отправить
            ok = await safe_send_telegram(
                bot,
                tid,
                text=tg_text,
                parse_mode=parse_mode_,
                method="message",
                log_ctx=f"{log_ctx}/attempt_{attempt_num}",
            )

            if ok:
                # Успех — финализируем
                await db[DELIVERY_ATTEMPTS_COLL].update_one(
                    {"_id": attempt_doc["_id"]},
                    {"$set": {
                        "status": "sent",
                        "attempt": attempt_num,
                        "sent_at": _utc_now(),
                    }},
                )
                stats["sent"] += 1
            else:
                # Fail — планируем следующий retry или в DLQ
                if attempt_num > max_attempts:
                    await db[DELIVERY_ATTEMPTS_COLL].update_one(
                        {"_id": attempt_doc["_id"]},
                        {"$set": {
                            "status": "dlq",
                            "attempt": attempt_num,
                            "failed_at": _utc_now(),
                            "error": "max_retries_exceeded",
                        }},
                    )
                    stats["dlq"] += 1
                    logger.warning(
                        f"[delivery.retry] DLQ: tid={tid} kind={attempt_doc.get('kind')} "
                        f"attempts={attempt_num}"
                    )
                else:
                    # Следующая задержка (cap'им по размеру таблицы _RETRY_DELAYS_SEC)
                    delay_idx = min(attempt_num - 1, len(_RETRY_DELAYS_SEC) - 1)
                    next_retry = _utc_now() + timedelta(
                        seconds=_RETRY_DELAYS_SEC[delay_idx]
                    )
                    await db[DELIVERY_ATTEMPTS_COLL].update_one(
                        {"_id": attempt_doc["_id"]},
                        {"$set": {
                            "status": "pending_retry",
                            "attempt": attempt_num,
                            "next_retry_at": next_retry,
                            "error": "retry_tg_failed",
                        }},
                    )
                    stats["failed"] += 1
        except Exception as e:  # noqa: BLE001
            logger.error(f"[delivery.retry] unexpected: {e}", exc_info=True)
            try:
                await db[DELIVERY_ATTEMPTS_COLL].update_one(
                    {"_id": attempt_doc["_id"]},
                    {"$set": {"status": "pending_retry", "error": str(e)[:200]}},
                )
            except Exception:
                pass

    if stats["processed"] > 0:
        logger.info(
            f"[delivery.retry] {log_ctx}: processed={stats['processed']} "
            f"sent={stats['sent']} failed={stats['failed']} dlq={stats['dlq']}"
        )
    return stats


# ────────────────────────────────────────────────────────────────────────────
#  Exports
# ────────────────────────────────────────────────────────────────────────────

__all__ = [
    # Enums
    "Channel",
    "MessagePriority",
    # Dataclasses
    "DeliveryResult",
    "BatchRecipient",
    "BatchResult",
    # Low-level
    "safe_send_telegram",
    "create_in_app_notification",
    # High-level
    "notify_user",
    "notify_user_with_photo",
    "send_batch",
    # Retry
    "process_pending_retries",
    "ensure_delivery_attempts_indexes",
]
