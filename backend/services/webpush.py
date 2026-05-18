"""
Web Push (PWA) — отправка push-уведомлений в браузеры / iOS PWA через стандартный
Web Push Protocol (RFC 8030 / RFC 8291 / RFC 8292 VAPID).

Архитектура:
  Frontend (service worker) → подписывается через `pushManager.subscribe()` →
  endpoint от FCM/APNs → бэкенд хранит подписку в Mongo (`push_subscriptions`).
  Когда нужно отправить — шифруем payload через ECDH+AES128-GCM (делает pywebpush),
  POST на endpoint с VAPID JWT.

iOS specifics (с iOS 16.4):
  - PWA должен быть «Добавлен на экран Домой»
  - Permission запрашивается только из standalone-режима
  - Limit на payload — 4 KB (как и везде)

Отказы:
  - 410 Gone / 404 → подписка протухла, удаляем из БД
  - 413 Payload Too Large → клиент должен укоротить
  - 429 Too Many Requests → respect Retry-After (мы пока не реализуем — circuit breaker
    задушит лавину, если будет проблема)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time as _time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

from pywebpush import WebPushException, webpush

logger = logging.getLogger(__name__)


PUSH_SUBSCRIPTIONS_COLL = "push_subscriptions"
WEBPUSH_TTL_SEC = 86400  # 1 day — для критичных уведомлений достаточно
WEBPUSH_SEND_TIMEOUT_SEC = 15.0


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def get_vapid_public_key() -> Optional[str]:
    """Возвращает публичный VAPID ключ (base64url) для подписки на стороне фронта."""
    return os.environ.get("VAPID_PUBLIC_KEY") or None


def _vapid_claims() -> dict:
    subject = os.environ.get("VAPID_SUBJECT") or "mailto:admin@example.com"
    if not (subject.startswith("mailto:") or subject.startswith("http")):
        subject = f"mailto:{subject}"
    return {"sub": subject}


def _vapid_private_key() -> Optional[str]:
    """VAPID private key (base64url, без padding)."""
    return os.environ.get("VAPID_PRIVATE_KEY") or None


def is_webpush_configured() -> bool:
    """True если в env есть всё необходимое для Web Push."""
    return bool(get_vapid_public_key() and _vapid_private_key())


# ────────────────────────────────────────────────────────────────────────────
#  Circuit breaker (анал. delivery.py)
# ────────────────────────────────────────────────────────────────────────────


class _WPCircuitBreaker:
    def __init__(self, fail_threshold: int = 20, open_duration_sec: float = 60.0):
        self.fail_threshold = fail_threshold
        self.open_duration_sec = open_duration_sec
        self._consecutive_fails = 0
        self._opened_at: Optional[float] = None

    def is_open(self) -> bool:
        if self._opened_at is None:
            return False
        if _time.monotonic() - self._opened_at >= self.open_duration_sec:
            self._opened_at = None
            self._consecutive_fails = 0
            logger.info("[webpush.cb] reset (half-open)")
            return False
        return True

    def record_success(self) -> None:
        if self._consecutive_fails > 0:
            logger.info("[webpush.cb] success — reset")
        self._consecutive_fails = 0
        self._opened_at = None

    def record_failure(self, transient: bool) -> None:
        if not transient:
            return
        self._consecutive_fails += 1
        if self._consecutive_fails >= self.fail_threshold and self._opened_at is None:
            self._opened_at = _time.monotonic()
            logger.warning(
                f"[webpush.cb] OPEN after {self._consecutive_fails} fails for {self.open_duration_sec}s"
            )


_wp_breaker = _WPCircuitBreaker()


# ────────────────────────────────────────────────────────────────────────────
#  Storage
# ────────────────────────────────────────────────────────────────────────────


async def ensure_push_subscriptions_indexes(db) -> None:
    """Создаёт индексы для коллекции push_subscriptions."""
    coll = db[PUSH_SUBSCRIPTIONS_COLL]
    try:
        await coll.create_index("endpoint", unique=True, name="endpoint_unique")
    except Exception as e:  # noqa: BLE001
        logger.debug(f"[webpush] endpoint_unique index: {e}")
    for spec, name in [
        ("telegram_id", "telegram_id_1"),
        ("uid", "uid_1"),
        ([("telegram_id", 1), ("active", 1)], "tid_active"),
        ([("uid", 1), ("active", 1)], "uid_active"),
    ]:
        try:
            await coll.create_index(spec, name=name)
        except Exception as e:  # noqa: BLE001
            logger.debug(f"[webpush] index {name}: {e}")


async def save_subscription(
    db,
    *,
    telegram_id: Optional[int],
    uid: Optional[str],
    endpoint: str,
    p256dh: str,
    auth: str,
    user_agent: str = "",
) -> str:
    """Сохраняет или обновляет подписку. Идемпотентно по endpoint.

    Returns:
        id записи (UUID).
    """
    now = _utc_now()
    sub_id = str(uuid.uuid4())
    doc = {
        "endpoint": endpoint,
        "keys": {"p256dh": p256dh, "auth": auth},
        "telegram_id": int(telegram_id) if telegram_id is not None else None,
        "uid": str(uid) if uid else None,
        "user_agent": (user_agent or "")[:500],
        "active": True,
        "updated_at": now,
        "last_success_at": None,
        "fail_count": 0,
    }
    # Upsert по endpoint (юникальный, может быть у одного юзера на нескольких устройствах)
    result = await db[PUSH_SUBSCRIPTIONS_COLL].find_one_and_update(
        {"endpoint": endpoint},
        {
            "$set": doc,
            "$setOnInsert": {"id": sub_id, "created_at": now},
        },
        upsert=True,
        return_document=True,
    )
    return (result or {}).get("id", sub_id)


async def remove_subscription(db, *, endpoint: str) -> bool:
    """Удалить подписку по endpoint."""
    res = await db[PUSH_SUBSCRIPTIONS_COLL].delete_one({"endpoint": endpoint})
    return res.deleted_count > 0


async def remove_subscriptions_for_user(db, *, telegram_id: int) -> int:
    """Удалить ВСЕ подписки юзера (например, при logout)."""
    res = await db[PUSH_SUBSCRIPTIONS_COLL].delete_many({"telegram_id": int(telegram_id)})
    return res.deleted_count


async def get_subscriptions_for_user(
    db, *, telegram_id: Optional[int] = None, uid: Optional[str] = None
) -> list[dict]:
    """Найти активные подписки юзера (по telegram_id или uid)."""
    query: dict = {"active": True}
    or_parts = []
    if telegram_id is not None:
        or_parts.append({"telegram_id": int(telegram_id)})
    if uid:
        or_parts.append({"uid": str(uid)})
    if not or_parts:
        return []
    if len(or_parts) == 1:
        query.update(or_parts[0])
    else:
        query["$or"] = or_parts
    return await db[PUSH_SUBSCRIPTIONS_COLL].find(query).to_list(None)


# ────────────────────────────────────────────────────────────────────────────
#  Sending
# ────────────────────────────────────────────────────────────────────────────


@dataclass
class WebPushResult:
    sent_count: int = 0
    failed_count: int = 0
    removed_count: int = 0  # сколько протухших подписок удалили
    errors: list[str] = None

    def __post_init__(self):
        if self.errors is None:
            self.errors = []

    @property
    def any_sent(self) -> bool:
        return self.sent_count > 0


def _build_payload(
    *,
    title: str,
    body: str,
    icon: Optional[str] = None,
    badge: Optional[str] = None,
    url: Optional[str] = None,
    tag: Optional[str] = None,
    data: Optional[dict] = None,
) -> str:
    """Формирует JSON payload для service worker'а (он его парсит и показывает Notification)."""
    payload = {
        "title": (title or "")[:200],
        "body": (body or "")[:500],
        "icon": icon or "/icons/icon-192.png",
        "badge": badge or "/icons/badge-72.png",
        "url": url or "/",
        "tag": tag or "rudn-go",
        "data": data or {},
    }
    return json.dumps(payload, ensure_ascii=False)


def _send_one_sync(
    *,
    subscription_info: dict,
    payload: str,
    vapid_private_key: str,
    vapid_claims: dict,
    ttl: int = WEBPUSH_TTL_SEC,
) -> tuple[bool, Optional[int], Optional[str]]:
    """Синхронная отправка одного push (pywebpush работает синхронно).

    Returns:
        (success, http_status_code, error_message)
    """
    try:
        webpush(
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=vapid_private_key,
            vapid_claims=dict(vapid_claims),  # копия, т.к. pywebpush мутирует
            ttl=ttl,
            timeout=WEBPUSH_SEND_TIMEOUT_SEC,
        )
        return True, 200, None
    except WebPushException as e:
        status = None
        try:
            status = e.response.status_code if e.response is not None else None
        except Exception:
            status = None
        return False, status, str(e)[:300]
    except Exception as e:  # noqa: BLE001
        return False, None, str(e)[:300]


async def send_web_push_to_user(
    db,
    *,
    telegram_id: Optional[int] = None,
    uid: Optional[str] = None,
    title: str,
    body: str,
    url: Optional[str] = None,
    tag: Optional[str] = None,
    icon: Optional[str] = None,
    data: Optional[dict] = None,
    log_ctx: str = "",
) -> WebPushResult:
    """Отправить push на ВСЕ активные подписки пользователя.

    Если не сконфигурировано (нет VAPID keys) — возвращает пустой результат.
    Протухшие подписки (HTTP 404/410) автоматически удаляются.
    """
    result = WebPushResult()

    if not is_webpush_configured():
        return result

    if _wp_breaker.is_open():
        logger.warning(f"[webpush] circuit breaker open — skip tid={telegram_id} uid={uid}")
        return result

    subs = await get_subscriptions_for_user(db, telegram_id=telegram_id, uid=uid)
    if not subs:
        return result

    payload = _build_payload(
        title=title, body=body, icon=icon, url=url, tag=tag, data=data,
    )
    vapid_priv = _vapid_private_key()
    vapid_cl = _vapid_claims()

    # Отправляем параллельно (но не больше 10 одновременно для одного юзера —
    # обычно 1-3 устройства)
    loop = asyncio.get_event_loop()

    async def _send(sub_doc: dict):
        sub_info = {"endpoint": sub_doc["endpoint"], "keys": sub_doc["keys"]}
        try:
            ok, status, err = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: _send_one_sync(
                        subscription_info=sub_info,
                        payload=payload,
                        vapid_private_key=vapid_priv,
                        vapid_claims=vapid_cl,
                    ),
                ),
                timeout=WEBPUSH_SEND_TIMEOUT_SEC + 5,
            )
        except asyncio.TimeoutError:
            ok, status, err = False, None, "timeout"

        if ok:
            _wp_breaker.record_success()
            await db[PUSH_SUBSCRIPTIONS_COLL].update_one(
                {"endpoint": sub_doc["endpoint"]},
                {"$set": {"last_success_at": _utc_now(), "fail_count": 0}},
            )
            return ("sent", None)

        # Fail
        if status in (404, 410):
            # Подписка протухла — удаляем
            await db[PUSH_SUBSCRIPTIONS_COLL].delete_one({"endpoint": sub_doc["endpoint"]})
            _wp_breaker.record_failure(transient=False)
            return ("removed", err)

        # Transient: инкрементируем fail_count, после 5 fail подряд — деактивируем
        await db[PUSH_SUBSCRIPTIONS_COLL].update_one(
            {"endpoint": sub_doc["endpoint"]},
            {"$inc": {"fail_count": 1}, "$set": {"last_error": (err or "")[:200]}},
        )
        # Чекаем — может уже надо деактивировать
        updated = await db[PUSH_SUBSCRIPTIONS_COLL].find_one(
            {"endpoint": sub_doc["endpoint"]}, {"fail_count": 1}
        )
        if updated and int(updated.get("fail_count", 0)) >= 5:
            await db[PUSH_SUBSCRIPTIONS_COLL].update_one(
                {"endpoint": sub_doc["endpoint"]},
                {"$set": {"active": False}},
            )
        _wp_breaker.record_failure(transient=True)
        return ("failed", err)

    outcomes = await asyncio.gather(*[_send(s) for s in subs], return_exceptions=True)

    for outcome in outcomes:
        if isinstance(outcome, Exception):
            result.failed_count += 1
            result.errors.append(str(outcome)[:200])
            continue
        kind, err = outcome
        if kind == "sent":
            result.sent_count += 1
        elif kind == "removed":
            result.removed_count += 1
            if err:
                result.errors.append(f"removed: {err}")
        else:
            result.failed_count += 1
            if err:
                result.errors.append(err)

    if result.any_sent:
        logger.info(
            f"📲 [webpush] sent={result.sent_count} failed={result.failed_count} "
            f"removed={result.removed_count} tid={telegram_id} ctx={log_ctx}"
        )
    elif result.failed_count or result.removed_count:
        logger.warning(
            f"📲 [webpush] no delivery — failed={result.failed_count} "
            f"removed={result.removed_count} tid={telegram_id} ctx={log_ctx}"
        )

    return result


__all__ = [
    "PUSH_SUBSCRIPTIONS_COLL",
    "WebPushResult",
    "ensure_push_subscriptions_indexes",
    "get_subscriptions_for_user",
    "get_vapid_public_key",
    "is_webpush_configured",
    "remove_subscription",
    "remove_subscriptions_for_user",
    "save_subscription",
    "send_web_push_to_user",
]
