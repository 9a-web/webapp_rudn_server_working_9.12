"""
Unit-тесты для services/delivery.py
Запуск: cd /app/backend && python3 -m pytest tests/test_delivery.py -v
или просто: python3 /app/backend/tests/test_delivery.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from unittest.mock import AsyncMock, MagicMock

from auth_utils import PSEUDO_TID_OFFSET, is_real_telegram_user, is_pseudo_tid
from services.delivery import (
    safe_send_telegram,
    create_in_app_notification,
    notify_user,
)


def _passed(name: str, ok: bool, ctx: str = "") -> None:
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"  ✅ {name}")
    else:
        FAIL += 1
        print(f"  ❌ {name}  ({ctx})")


PASS = 0
FAIL = 0


async def test_is_real_telegram_user():
    print("\n── is_real_telegram_user ──")
    _passed("real TG int", is_real_telegram_user(771010408))
    _passed("real TG str", is_real_telegram_user("771010408"))
    _passed("pseudo", not is_real_telegram_user(PSEUDO_TID_OFFSET + 771010408))
    _passed("None", not is_real_telegram_user(None))
    _passed("zero", not is_real_telegram_user(0))


async def test_safe_send_telegram_pseudo_skip():
    print("\n── safe_send_telegram (guard pseudo) ──")
    bot = MagicMock()
    bot.send_message = AsyncMock()

    # pseudo_tid → skip, bot.send_message не должен вызваться
    res = await safe_send_telegram(
        bot,
        PSEUDO_TID_OFFSET + 771010408,
        text="test",
        log_ctx="unit_test",
    )
    _passed("pseudo returns False", res is False)
    _passed("bot NOT called for pseudo", not bot.send_message.called)

    # None → skip
    res = await safe_send_telegram(bot, None, text="test")
    _passed("None returns False", res is False)


async def test_safe_send_telegram_real():
    print("\n── safe_send_telegram (real TG) ──")
    bot = MagicMock()
    bot.send_message = AsyncMock(return_value=None)

    res = await safe_send_telegram(bot, 771010408, text="hello")
    _passed("real TG returns True", res is True)
    _passed("bot called once", bot.send_message.call_count == 1)
    call = bot.send_message.call_args
    _passed("chat_id in call", call.kwargs.get("chat_id") == 771010408)


async def test_create_in_app_notification():
    print("\n── create_in_app_notification ──")
    db = MagicMock()
    db.in_app_notifications.insert_one = AsyncMock()

    notif_id = await create_in_app_notification(
        db,
        telegram_id=PSEUDO_TID_OFFSET + 771010408,  # pseudo — ок для in-app
        title="Test",
        message="Body",
        category="friends",
        priority="high",
        emoji="👥",
        data={"foo": "bar"},
    )
    _passed("returns id", notif_id is not None and len(notif_id) > 8)
    _passed("insert called", db.in_app_notifications.insert_one.call_count == 1)
    doc = db.in_app_notifications.insert_one.call_args.args[0]
    _passed("doc has id", doc.get("id") == notif_id)
    _passed("doc tid preserved", doc.get("telegram_id") == PSEUDO_TID_OFFSET + 771010408)
    _passed("doc title", doc.get("title") == "Test")
    _passed("doc read=False", doc.get("read") is False)


async def test_notify_user_pseudo_only_inapp():
    """pseudo_tid юзер: TG пропущен, in-app создан."""
    print("\n── notify_user (pseudo_tid → только in-app) ──")
    db = MagicMock()
    db.users.find_one = AsyncMock(return_value={
        "uid": "771010408",
        "telegram_id": PSEUDO_TID_OFFSET + 771010408,  # pseudo
    })
    db.in_app_notifications.insert_one = AsyncMock()

    bot = MagicMock()
    bot.send_message = AsyncMock()

    res = await notify_user(
        db, bot,
        uid="771010408",
        title="Тест",
        message="Привет",
        category="system",
    )
    _passed("in-app создан", res["in_app_id"] is not None)
    _passed("TG НЕ отправлен", res["telegram_sent"] is False)
    _passed("skip reason = pseudo_tid", res["telegram_skipped_reason"] == "pseudo_tid")
    _passed("bot.send_message не вызывался", not bot.send_message.called)


async def test_notify_user_real_tg_both():
    """Real TG юзер: и in-app, и TG."""
    print("\n── notify_user (real TG → оба канала) ──")
    db = MagicMock()
    db.users.find_one = AsyncMock(return_value={
        "uid": "someuid",
        "telegram_id": 771010408,
    })
    db.in_app_notifications.insert_one = AsyncMock()

    bot = MagicMock()
    bot.send_message = AsyncMock()

    res = await notify_user(
        db, bot,
        uid="someuid",
        title="Тест",
        message="Привет",
    )
    _passed("in-app создан", res["in_app_id"] is not None)
    _passed("TG отправлен", res["telegram_sent"] is True)
    _passed("skip reason = None", res["telegram_skipped_reason"] is None)
    _passed("bot.send_message вызван 1 раз", bot.send_message.call_count == 1)


async def test_notify_user_only_telegram_disabled():
    """send_telegram=False → только in-app."""
    print("\n── notify_user (send_telegram=False) ──")
    db = MagicMock()
    db.users.find_one = AsyncMock(return_value={
        "uid": "u1",
        "telegram_id": 771010408,
    })
    db.in_app_notifications.insert_one = AsyncMock()

    bot = MagicMock()
    bot.send_message = AsyncMock()

    res = await notify_user(
        db, bot,
        uid="u1",
        title="t",
        message="m",
        send_telegram=False,
    )
    _passed("in-app создан", res["in_app_id"] is not None)
    _passed("TG НЕ отправлен", res["telegram_sent"] is False)
    _passed("skip reason = disabled", res["telegram_skipped_reason"] == "disabled")


async def main():
    await test_is_real_telegram_user()
    await test_safe_send_telegram_pseudo_skip()
    await test_safe_send_telegram_real()
    await test_create_in_app_notification()
    await test_notify_user_pseudo_only_inapp()
    await test_notify_user_real_tg_both()
    await test_notify_user_only_telegram_disabled()
    print(f"\nSummary: {PASS} passed, {FAIL} failed\n")
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
