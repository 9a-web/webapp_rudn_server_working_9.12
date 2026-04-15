"""
Система уровней RUDN GO
XP → Level → Tier (Base / Medium / Rare / Premium)

v2.0 — Полная переработка:
- Атомарное начисление XP (findOneAndUpdate)
- Enforcement дневных лимитов (schedule_view, message_sent)
- XP event log для аудита
- Read-only breakdown (без мутации данных)
- Учёт task_on_time_bonus и schedule_view в пересчёте
- Защита от уменьшения XP при recalculate
"""

import logging
import traceback
from datetime import datetime, timedelta
from pymongo import ReturnDocument

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Таблица порогов XP для каждого уровня
# ──────────────────────────────────────────────
LEVEL_THRESHOLDS = [
    0,       # LV 1
    100,     # LV 2
    250,     # LV 3
    450,     # LV 4
    700,     # LV 5  ← Medium
    1000,    # LV 6
    1400,    # LV 7
    1900,    # LV 8
    2500,    # LV 9
    3200,    # LV 10 ← Rare
    4000,    # LV 11
    5000,    # LV 12
    6200,    # LV 13
    7600,    # LV 14
    9200,    # LV 15
    11000,   # LV 16
    13000,   # LV 17
    15500,   # LV 18
    18500,   # LV 19
    22000,   # LV 20 ← Premium
]

# За пределами таблицы каждый уровень = +4000 XP
EXTRA_LEVEL_STEP = 4000

# Привязка уровня → тир
TIER_THRESHOLDS = [
    (20, "premium"),
    (10, "rare"),
    (5,  "medium"),
    (1,  "base"),
]

# ──────────────────────────────────────────────
# XP за действия
# ──────────────────────────────────────────────
XP_REWARDS = {
    "task_complete":        5,
    "task_on_time_bonus":   3,
    "group_task_complete":  8,
    "daily_visit":          3,
    "streak_7_bonus":       20,
    "streak_14_bonus":      40,
    "streak_30_bonus":      80,
    "achievement_earned":   0,   # = очки ачивки (dynamic)
    "referral":             50,
    "schedule_view":        1,   # лимит 3/день
    "message_sent":         1,   # лимит 5/день
}

# Дневные лимиты для определённых действий
DAILY_XP_LIMITS = {
    "schedule_view": 3,
    "message_sent":  5,
}

# Описания XP-наград для отображения на фронтенде
XP_REWARDS_INFO = [
    {"action": "daily_visit",       "xp": 3,  "label": "Ежедневный визит",        "emoji": "📅", "limit": "1/день"},
    {"action": "task_complete",     "xp": 5,  "label": "Выполнение задачи",       "emoji": "✅", "limit": None},
    {"action": "task_on_time_bonus","xp": 3,  "label": "Задача вовремя (бонус)",  "emoji": "⏰", "limit": None},
    {"action": "group_task_complete","xp": 8, "label": "Групповая задача",        "emoji": "👥", "limit": None},
    {"action": "referral",          "xp": 50, "label": "Приглашение друга",       "emoji": "🔗", "limit": None},
    {"action": "schedule_view",     "xp": 1,  "label": "Просмотр расписания",     "emoji": "📋", "limit": "3/день"},
    {"action": "message_sent",      "xp": 1,  "label": "Отправка сообщения",      "emoji": "💬", "limit": "5/день"},
    {"action": "streak_7_bonus",    "xp": 20, "label": "Стрик 7 дней",            "emoji": "🔥", "limit": "1 раз"},
    {"action": "streak_14_bonus",   "xp": 40, "label": "Стрик 14 дней",           "emoji": "🔥🔥", "limit": "1 раз"},
    {"action": "streak_30_bonus",   "xp": 80, "label": "Стрик 30 дней",           "emoji": "🔥🔥🔥", "limit": "1 раз"},
]


def get_tier(level: int) -> str:
    """Определяет тир по уровню"""
    for threshold, tier in TIER_THRESHOLDS:
        if level >= threshold:
            return tier
    return "base"


def get_level_threshold(level: int) -> int:
    """XP, необходимый для достижения данного уровня"""
    if level < 1:
        return 0
    idx = level - 1
    if idx < len(LEVEL_THRESHOLDS):
        return LEVEL_THRESHOLDS[idx]
    # За пределами таблицы
    return LEVEL_THRESHOLDS[-1] + (idx - len(LEVEL_THRESHOLDS) + 1) * EXTRA_LEVEL_STEP


def calculate_level_info(xp: int) -> dict:
    """
    Вычисляет полную информацию об уровне по XP.

    Returns:
        {
            "level": 7,
            "tier": "medium",
            "xp": 1450,
            "xp_current_level": 1400,
            "xp_next_level": 1900,
            "xp_in_level": 50,
            "xp_needed": 500,
            "progress": 0.1,
        }
    """
    xp = max(0, int(xp))

    # Определяем уровень по таблице
    level = 1
    for i, threshold in enumerate(LEVEL_THRESHOLDS):
        if xp >= threshold:
            level = i + 1
        else:
            break

    # За пределами таблицы: каждый уровень = +EXTRA_LEVEL_STEP XP
    if level >= len(LEVEL_THRESHOLDS) and xp >= LEVEL_THRESHOLDS[-1]:
        extra = xp - LEVEL_THRESHOLDS[-1]
        level = len(LEVEL_THRESHOLDS) + extra // EXTRA_LEVEL_STEP

    # Пороги текущего и следующего уровня
    xp_current = get_level_threshold(level)
    xp_next = get_level_threshold(level + 1)

    # Прогресс внутри уровня
    xp_in_level = xp - xp_current
    xp_needed = xp_next - xp_current
    progress = round(min(max(xp_in_level / xp_needed, 0.0), 1.0), 4) if xp_needed > 0 else 1.0

    return {
        "level": level,
        "tier": get_tier(level),
        "xp": xp,
        "xp_current_level": xp_current,
        "xp_next_level": xp_next,
        "xp_in_level": max(0, xp_in_level),
        "xp_needed": xp_needed,
        "progress": progress,
    }


# ──────────────────────────────────────────────
# XP Event Log (аудит)
# ──────────────────────────────────────────────
async def _log_xp_event(db, telegram_id: int, amount: int, reason: str, new_total: int):
    """Записывает событие начисления XP для аудита."""
    try:
        await db.xp_events.insert_one({
            "telegram_id": telegram_id,
            "amount": amount,
            "reason": reason,
            "new_total": new_total,
            "created_at": datetime.utcnow(),
        })
    except Exception:
        pass  # Не критично — не роняем основной поток


# ──────────────────────────────────────────────
# Дневные лимиты
# ──────────────────────────────────────────────
async def check_daily_xp_limit(db, telegram_id: int, action: str) -> bool:
    """
    Проверяет, не превышен ли дневной лимит XP для указанного действия.
    Возвращает True, если начисление разрешено.
    """
    limit = DAILY_XP_LIMITS.get(action)
    if limit is None:
        return True  # Нет лимита для этого действия

    today_str = datetime.utcnow().strftime("%Y-%m-%d")

    # Считаем сколько раз уже начислено сегодня
    count = await db.xp_events.count_documents({
        "telegram_id": telegram_id,
        "reason": action,
        "created_at": {
            "$gte": datetime.strptime(today_str, "%Y-%m-%d"),
            "$lt": datetime.strptime(today_str, "%Y-%m-%d") + timedelta(days=1),
        }
    })

    return count < limit


# ──────────────────────────────────────────────
# Начисление XP
# ──────────────────────────────────────────────
async def award_xp(db, telegram_id: int, amount: int, reason: str = "") -> dict:
    """
    Атомарно начисляет XP пользователю и возвращает информацию об уровне.
    Использует findOneAndUpdate для предотвращения race conditions.
    Если произошёл level-up, сохраняет pending_level_up в БД.
    """
    if amount <= 0:
        return {"leveled_up": False}

    # Проверяем дневной лимит
    if reason in DAILY_XP_LIMITS:
        allowed = await check_daily_xp_limit(db, telegram_id, reason)
        if not allowed:
            logger.debug(f"Daily XP limit reached: user={telegram_id} action={reason}")
            return {"leveled_up": False, "daily_limit_reached": True}

    # Атомарный инкремент XP + получение нового значения
    updated_doc = await db.user_stats.find_one_and_update(
        {"telegram_id": telegram_id},
        {
            "$inc": {"xp": amount},
            "$setOnInsert": {"telegram_id": telegram_id, "bonus_xp": 0},
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    new_xp = updated_doc.get("xp", amount)
    old_xp = new_xp - amount

    old_info = calculate_level_info(old_xp)
    new_info = calculate_level_info(new_xp)

    leveled_up = new_info["level"] > old_info["level"]
    tier_changed = new_info["tier"] != old_info["tier"]

    # Логируем XP event
    await _log_xp_event(db, telegram_id, amount, reason, new_xp)

    result = {
        "leveled_up": leveled_up,
        "tier_changed": tier_changed,
        "old_level": old_info["level"],
        "new_level": new_info["level"],
        "old_tier": old_info["tier"],
        "new_tier": new_info["tier"],
        "xp_awarded": amount,
        "reason": reason,
        **new_info,
    }

    # Сохраняем pending level-up для фронтенда
    if leveled_up:
        logger.info(
            f"🎉 Level UP! user={telegram_id} "
            f"LV.{old_info['level']}→{new_info['level']} "
            f"({old_info['tier']}→{new_info['tier']}) +{amount}XP reason={reason}"
        )
        try:
            await db.user_stats.update_one(
                {"telegram_id": telegram_id},
                {"$set": {
                    "pending_level_up": {
                        "old_level": old_info["level"],
                        "new_level": new_info["level"],
                        "old_tier": old_info["tier"],
                        "new_tier": new_info["tier"],
                        "xp_awarded": amount,
                        "reason": reason,
                    }
                }}
            )
        except Exception as e:
            logger.warning(f"Failed to save pending level-up: {e}")

    return result


async def safe_award_xp(db, telegram_id: int, amount: int, reason: str = "") -> dict:
    """
    Безопасная обёртка для award_xp — логирует ошибки вместо silent fail.
    Используется внутри asyncio.create_task().
    """
    try:
        return await award_xp(db, telegram_id, amount, reason)
    except Exception as e:
        logger.error(
            f"❌ Failed to award XP: user={telegram_id} amount={amount} reason={reason} "
            f"error={e}\n{traceback.format_exc()}"
        )
        return {"leveled_up": False, "error": str(e)}


async def consume_pending_level_up(db, telegram_id: int) -> dict:
    """
    Атомарно забирает pending level-up из БД (consumed after read).
    Использует findOneAndUpdate чтобы избежать race condition.
    """
    result = await db.user_stats.find_one_and_update(
        {"telegram_id": telegram_id, "pending_level_up": {"$exists": True, "$ne": None}},
        {"$unset": {"pending_level_up": ""}},
        return_document=False,  # Возвращаем документ ДО изменения
    )

    if result and result.get("pending_level_up"):
        return result["pending_level_up"]

    return None


# ──────────────────────────────────────────────
# Read-only breakdown XP (без мутации)
# ──────────────────────────────────────────────
async def get_xp_breakdown_readonly(db, telegram_id: int) -> dict:
    """
    Подсчитывает breakdown XP БЕЗ перезаписи в БД.
    Используется для GET /xp-breakdown (без побочных эффектов).
    """
    breakdown = {
        "tasks": 0,
        "task_on_time_bonus": 0,
        "achievements": 0,
        "visits": 0,
        "streak_bonuses": 0,
        "referrals": 0,
        "group_tasks": 0,
        "messages": 0,
        "schedule_views": 0,
        "bonus": 0,
    }

    # 1. Выполненные задачи
    completed_tasks = await db.tasks.count_documents({
        "telegram_id": telegram_id,
        "completed": True,
    })
    breakdown["tasks"] = completed_tasks * XP_REWARDS["task_complete"]

    # 1b. Бонус за задачи вовремя (из XP event log или из tasks)
    try:
        on_time_count = await db.tasks.count_documents({
            "telegram_id": telegram_id,
            "completed": True,
            "completed_on_time": True,
        })
        breakdown["task_on_time_bonus"] = on_time_count * XP_REWARDS["task_on_time_bonus"]
    except Exception:
        # Fallback: подсчёт из xp_events
        try:
            on_time_events = await db.xp_events.count_documents({
                "telegram_id": telegram_id,
                "reason": {"$regex": "task_complete_on_time"},
            })
            breakdown["task_on_time_bonus"] = on_time_events * XP_REWARDS["task_on_time_bonus"]
        except Exception:
            pass

    # 2. Достижения
    achievements = await db.user_achievements.find(
        {"telegram_id": telegram_id}
    ).to_list(length=200)
    breakdown["achievements"] = sum(a.get("points", 0) for a in achievements)

    # 3. Стрик + визиты
    stats = await db.user_stats.find_one({"telegram_id": telegram_id})
    if stats:
        active_days = stats.get("active_days", [])
        breakdown["visits"] = len(active_days) * XP_REWARDS["daily_visit"]

        max_streak = stats.get("visit_streak_max", 0)
        streak_bonus = 0
        if max_streak >= 7:
            streak_bonus += XP_REWARDS["streak_7_bonus"]
        if max_streak >= 14:
            streak_bonus += XP_REWARDS["streak_14_bonus"]
        if max_streak >= 30:
            streak_bonus += XP_REWARDS["streak_30_bonus"]
        breakdown["streak_bonuses"] = streak_bonus

    # 4. Рефералы
    referral_connections = await db.referral_connections.count_documents({
        "referrer_id": telegram_id,
    })
    breakdown["referrals"] = referral_connections * XP_REWARDS["referral"]

    # 5. Групповые задачи
    try:
        pipeline = [
            {"$match": {"participants.telegram_id": telegram_id}},
            {"$unwind": "$participants"},
            {"$match": {
                "participants.telegram_id": telegram_id,
                "participants.completed": True
            }},
            {"$count": "total"}
        ]
        result = await db.group_tasks.aggregate(pipeline).to_list(1)
        group_tasks_completed = result[0]["total"] if result else 0
    except Exception:
        group_tasks_completed = 0
    breakdown["group_tasks"] = group_tasks_completed * XP_REWARDS["group_task_complete"]

    # 6. Сообщения (с приблизительным лимитом 5/день)
    try:
        messages_sent = await db.messages.count_documents({"sender_id": telegram_id})
        active_days_count = len(stats.get("active_days", [])) if stats else 1
        max_message_xp = active_days_count * DAILY_XP_LIMITS["message_sent"] * XP_REWARDS["message_sent"]
        breakdown["messages"] = min(messages_sent * XP_REWARDS["message_sent"], max_message_xp)
    except Exception:
        pass

    # 7. Просмотры расписания (с приблизительным лимитом 3/день)
    try:
        schedule_views_total = stats.get("schedule_views", 0) if stats else 0
        active_days_count = len(stats.get("active_days", [])) if stats else 1
        max_schedule_xp = active_days_count * DAILY_XP_LIMITS["schedule_view"] * XP_REWARDS["schedule_view"]
        breakdown["schedule_views"] = min(schedule_views_total * XP_REWARDS["schedule_view"], max_schedule_xp)
    except Exception:
        pass

    # 8. Бонус XP (от dev-команд)
    breakdown["bonus"] = stats.get("bonus_xp", 0) if stats else 0

    # Итоговый XP из breakdown
    calculated_xp = sum(breakdown.values())

    # Реальный XP из БД
    real_xp = stats.get("xp", 0) if stats else 0

    # Используем максимум (защита от занижения)
    display_xp = max(real_xp, calculated_xp)

    info = calculate_level_info(display_xp)

    return {
        "telegram_id": telegram_id,
        "xp": display_xp,
        "calculated_xp": calculated_xp,
        "real_xp": real_xp,
        "breakdown": breakdown,
        **info,
    }


# ──────────────────────────────────────────────
# Ретроактивный пересчёт (с защитой от потери XP)
# ──────────────────────────────────────────────
async def recalculate_xp_for_user(db, telegram_id: int) -> dict:
    """
    Ретроактивный пересчёт XP для пользователя.
    ЗАЩИТА: никогда не уменьшает текущий XP.
    ОПТИМИЗИРОВАНО: фильтрация group_tasks на уровне MongoDB.
    """
    breakdown_result = await get_xp_breakdown_readonly(db, telegram_id)
    calculated_xp = breakdown_result["calculated_xp"]

    # Получаем текущий XP из БД
    stats = await db.user_stats.find_one({"telegram_id": telegram_id})
    current_xp = stats.get("xp", 0) if stats else 0

    # ЗАЩИТА: берём максимум, чтобы не потерять XP
    final_xp = max(current_xp, calculated_xp)

    # Обновляем только если calculated > current (не уменьшаем)
    if final_xp != current_xp:
        await db.user_stats.update_one(
            {"telegram_id": telegram_id},
            {"$set": {"xp": final_xp}},
            upsert=True,
        )

    info = calculate_level_info(final_xp)
    logger.info(
        f"📊 Recalculated XP for user={telegram_id}: "
        f"{final_xp} XP (calculated={calculated_xp}, was={current_xp}) → LV.{info['level']} ({info['tier']})"
    )

    return {
        "telegram_id": telegram_id,
        "xp": final_xp,
        "breakdown": breakdown_result["breakdown"],
        **info,
    }
