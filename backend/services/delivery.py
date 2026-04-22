"""
📬 Message Delivery Service — единая точка доставки уведомлений.

Релиз 1 (P0 + минимальный fallback из `instrUIDprofile.md`):
  ▪ Guard: не пытаемся писать в Telegram Bot API для pseudo_tid (VK / Email / QR
    юзеры без реального telegram_id) → никаких больше `chat not found` в логах.
  ▪ In-app fallback: ВСЕГДА пишем запись в `in_app_notifications`, чтобы
    VK/Email-юзеры получали те же уведомления внутри SPA, что и TG-юзеры
    получают в чате бота.
  ▪ Обратная совместимость: полный контракт `InAppNotification` из models.py
    (type / category / priority / emoji / data / action_url / actions).

Это минимальная реализация — полноценный `MessageDeliveryService` с Channel-enum,
retry, batch, метриками — это P1 (Релиз 2).
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from telegram.error import TelegramError

from auth_utils import (
    PSEUDO_TID_OFFSET,
    effective_tid_for_user,
    is_pseudo_tid,
    is_real_telegram_user,
    pseudo_tid_from_uid,
)

logger = logging.getLogger(__name__)


# ────────────────────────────────────────────────────────────────────────────
#  Helpers
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

    # real TG id
    if tid < PSEUDO_TID_OFFSET:
        return await db.users.find_one({"telegram_id": tid})

    # pseudo_tid → uid
    synth_uid = str(tid - PSEUDO_TID_OFFSET)
    return await db.users.find_one({"uid": synth_uid})


def _effective_tid_from_inputs(
    user_doc: Optional[dict],
    explicit_telegram_id: Optional[int],
) -> Optional[int]:
    """Возвращает «ключ для legacy-коллекций» (telegram_id для real TG или
    pseudo_tid для VK/Email). Нужен, чтобы in-app уведомление было совместимо
    с legacy-фронтом, который всё ещё выбирает записи по telegram_id.
    """
    # Если у нас есть user_doc — берём каноничный effective_tid
    if user_doc:
        eff = effective_tid_for_user(user_doc)
        if eff is not None:
            return int(eff)
    # Иначе возвращаем то, что передали (включая pseudo_tid — это нормально)
    if explicit_telegram_id is not None:
        try:
            return int(explicit_telegram_id)
        except (TypeError, ValueError):
            return None
    return None


# ────────────────────────────────────────────────────────────────────────────
#  Public API
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
) -> bool:
    """Безопасная обёртка над `bot.send_message` / `bot.send_photo`.

    Реализует P0 guard: если `telegram_id` — pseudo_tid (VK/Email/QR-юзер),
    или вообще не real TG — НЕ пытается вызвать Bot API (это предотвращает
    `chat not found` в логах), просто логирует info-запись и возвращает False.

    Возвращает True если сообщение ушло в TG, False если было пропущено или упало.
    Ошибки не пробрасываются (логируются).
    """
    if not is_real_telegram_user(telegram_id):
        reason = "pseudo_tid" if is_pseudo_tid(telegram_id) else "no_tid"
        logger.info(
            f"🟡 [delivery] Skip Telegram push: tid={telegram_id} reason={reason} "
            f"ctx={log_ctx or '-'}"
        )
        return False

    if bot is None:
        logger.debug(f"[delivery] bot is None (ctx={log_ctx})")
        return False

    try:
        # Выбираем метод
        effective_method = method
        if effective_method == "auto":
            effective_method = "photo" if photo is not None else "message"

        kwargs: dict = {"chat_id": int(telegram_id)}
        if parse_mode:
            kwargs["parse_mode"] = parse_mode
        if reply_markup is not None:
            kwargs["reply_markup"] = reply_markup

        if effective_method == "photo":
            if caption is not None:
                kwargs["caption"] = caption
            await bot.send_photo(photo=photo, **kwargs)
        else:
            kwargs["text"] = text or caption or ""
            await bot.send_message(**kwargs)
        return True
    except TelegramError as e:
        logger.warning(f"📤 [delivery] TelegramError tid={telegram_id} ctx={log_ctx}: {e}")
        return False
    except Exception as e:  # noqa: BLE001
        logger.error(
            f"📤 [delivery] Unexpected error tid={telegram_id} ctx={log_ctx}: {e}",
            exc_info=True,
        )
        return False


async def create_in_app_notification(
    db,
    *,
    telegram_id: int,
    title: str,
    message: str,
    type: str = "info",                 # NotificationType value
    category: str = "system",            # NotificationCategory value
    priority: str = "normal",            # NotificationPriority value
    emoji: str = "🔔",
    data: Optional[dict] = None,
    action_url: Optional[str] = None,
    actions: Optional[list] = None,
) -> Optional[str]:
    """Создаёт запись в `in_app_notifications` (совместимую с `InAppNotification`
    из models.py). Возвращает `id` созданного документа или None при ошибке.
    """
    try:
        notif_id = str(uuid.uuid4())
        doc = {
            "id": notif_id,
            "telegram_id": int(telegram_id),
            "type": type,
            "category": category,
            "priority": priority,
            "title": title[:200],
            "message": message[:2000],
            "emoji": emoji or "🔔",
            "data": data or {},
            "action_url": action_url,
            "actions": actions or [],
            "action_taken": None,
            "read": False,
            "dismissed": False,
            "created_at": datetime.now(timezone.utc),
            "read_at": None,
            "expires_at": None,
        }
        await db.in_app_notifications.insert_one(doc)
        return notif_id
    except Exception as e:  # noqa: BLE001
        logger.error(f"[delivery] in-app insert failed tid={telegram_id}: {e}", exc_info=True)
        return None


async def notify_user(
    db,
    bot,
    *,
    # Идентификация получателя (хотя бы одно должно быть задано)
    uid: Optional[str] = None,
    telegram_id: Optional[int] = None,
    user_doc: Optional[dict] = None,
    # Содержимое
    title: str,
    message: str,
    emoji: str = "🔔",
    # Метаданные
    type: str = "info",
    category: str = "system",
    priority: str = "normal",
    data: Optional[dict] = None,
    action_url: Optional[str] = None,
    actions: Optional[list] = None,
    # Каналы
    send_telegram: bool = True,
    send_in_app: bool = True,
    # Параметры TG-отправки
    telegram_text: Optional[str] = None,  # если не задан — строится из title+message
    telegram_parse_mode: str = "HTML",
    telegram_reply_markup: Any = None,
    log_ctx: str = "",
) -> dict:
    """Единая точка доставки уведомления пользователю.

    Returns:
        {
            "in_app_id": Optional[str],  # id записи in-app или None
            "telegram_sent": bool,       # ушло ли в TG
            "telegram_skipped_reason": Optional[str],  # "pseudo_tid"/"no_tid"/"disabled"/None
        }
    """
    result = {
        "in_app_id": None,
        "telegram_sent": False,
        "telegram_skipped_reason": None,
    }

    # 1. Если не передан user_doc — резолвим
    if user_doc is None and (uid or telegram_id is not None):
        user_doc = await _resolve_user_doc(db, uid=uid, telegram_id=telegram_id)

    # 2. effective_tid (для ключа in-app — он же используется legacy-фронтом)
    eff_tid = _effective_tid_from_inputs(user_doc, telegram_id)
    if eff_tid is None and uid:
        # Если есть только uid и нет user_doc — соберём pseudo сами
        try:
            eff_tid = pseudo_tid_from_uid(uid)
        except (TypeError, ValueError):
            eff_tid = None

    # 3. In-app: создаём всегда (если не запрещено явно)
    if send_in_app and eff_tid is not None:
        result["in_app_id"] = await create_in_app_notification(
            db,
            telegram_id=eff_tid,
            title=title,
            message=message,
            type=type,
            category=category,
            priority=priority,
            emoji=emoji,
            data=data,
            action_url=action_url,
            actions=actions,
        )

    # 4. Telegram: только для real TG id
    if send_telegram:
        real_tid: Optional[int] = None
        if user_doc:
            ut = user_doc.get("telegram_id")
            if ut is not None and is_real_telegram_user(ut):
                real_tid = int(ut)
        elif telegram_id is not None and is_real_telegram_user(telegram_id):
            real_tid = int(telegram_id)

        if real_tid is None:
            result["telegram_skipped_reason"] = (
                "pseudo_tid" if (eff_tid is not None and is_pseudo_tid(eff_tid)) else "no_tid"
            )
        else:
            tg_text = telegram_text
            if tg_text is None:
                # HTML по умолчанию — экранируем только в случае plain
                tg_text = f"{emoji} <b>{title}</b>\n{message}"

            ok = await safe_send_telegram(
                bot,
                real_tid,
                text=tg_text,
                parse_mode=telegram_parse_mode,
                reply_markup=telegram_reply_markup,
                method="message",
                log_ctx=log_ctx or f"notify_user/{category}",
            )
            result["telegram_sent"] = ok
            if not ok:
                result["telegram_skipped_reason"] = "send_error"
    else:
        result["telegram_skipped_reason"] = "disabled"

    return result


__all__ = [
    "safe_send_telegram",
    "create_in_app_notification",
    "notify_user",
]
