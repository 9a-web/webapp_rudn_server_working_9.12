"""
Система уровней RUDN GO
XP → Level → Tier (Base / Medium / Rare / Premium)

Исправления:
- Оптимизация recalculate_xp_for_user (фильтрация group_tasks на уровне БД)
- Добавлен safe_award_xp с логированием ошибок
- Учёт XP за сообщения в пересчёте
- Добавлен get_xp_breakdown для фронтенда
"""

import logging
import traceback

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

# Описания XP-наград для отображения на фронтенде
XP_REWARDS_INFO = [
    {"action": "daily_visit", "xp": 3, "label": "Ежедневный визит", "emoji": "📅", "limit": "1/день"},
    {"action": "task_complete", "xp": 5, "label": "Выполнение задачи", "emoji": "✅", "limit": None},
    {"action": "task_on_time_bonus", "xp": 3, "label": "Задача вовремя (бонус)", "emoji": "⏰", "limit": None},
    {"action": "group_task_complete", "xp": 8, "label": "Групповая задача", "emoji": "👥", "limit": None},
    {"action": "referral", "xp": 50, "label": "Приглашение друга", "emoji": "🔗", "limit": None},
    {"action": "schedule_view", "xp": 1, "label": "Просмотр расписания", "emoji": "📋", "limit": "3/день"},
    {"action": "message_sent", "xp": 1, "label": "Отправка сообщения", "emoji": "💬", "limit": "5/день"},
    {"action": "streak_7_bonus", "xp": 20, "label": "Стрик 7 дней", "emoji": "🔥", "limit": "1 раз"},
    {"action": "streak_14_bonus", "xp": 40, "label": "Стрик 14 дней", "emoji": "🔥🔥", "limit": "1 раз"},
    {"action": "streak_30_bonus", "xp": 80, "label": "Стрик 30 дней", "emoji": "🔥🔥🔥", "limit": "1 раз"},
]


def get_tier(level: int) -> str:
    """Определяет тир по уровню"""
    for threshold, tier in TIER_THRESHOLDS:
        if level >= threshold:
            return tier
    return "base"


def get_level_threshold(level: int) -> int:
    """XP, необходимый для достижения данного уровня"""
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
    xp = max(0, xp)
    
    # Определяем уровень
    level = 1
    for i, threshold in enumerate(LEVEL_THRESHOLDS):
        if xp >= threshold:
            level = i + 1
        else:
            break
    
    # За пределами таблицы
    if level == len(LEVEL_THRESHOLDS) and xp >= LEVEL_THRESHOLDS[-1]:
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


async def award_xp(db, telegram_id: int, amount: int, reason: str = "") -> dict:
    """
    Начисляет XP пользователю и возвращает информацию об уровне.
    Если произошёл level-up, возвращает {"leveled_up": True, "old_level": N, "new_level": M}
    """
    if amount <= 0:
        return {"leveled_up": False}
    
    # Получаем текущий XP
    stats = await db.user_stats.find_one({"telegram_id": telegram_id})
    old_xp = stats.get("xp", 0) if stats else 0
    old_info = calculate_level_info(old_xp)
    
    new_xp = old_xp + amount
    new_info = calculate_level_info(new_xp)
    
    # Обновляем XP в БД
    await db.user_stats.update_one(
        {"telegram_id": telegram_id},
        {"$inc": {"xp": amount}},
        upsert=True
    )
    
    leveled_up = new_info["level"] > old_info["level"]
    tier_changed = new_info["tier"] != old_info["tier"]
    
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
    
    # Сохраняем event level-up в БД для фронтенда
    if leveled_up:
        logger.info(
            f"🎉 Level UP! user={telegram_id} "
            f"LV.{old_info['level']}→{new_info['level']} "
            f"({old_info['tier']}→{new_info['tier']}) +{amount}XP reason={reason}"
        )
        # Сохраняем pending level-up для отображения на фронтенде
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
    Забирает pending level-up из БД (фронтенд вызывает после отображения).
    Возвращает данные level-up или None.
    """
    stats = await db.user_stats.find_one({"telegram_id": telegram_id})
    if not stats or not stats.get("pending_level_up"):
        return None
    
    pending = stats["pending_level_up"]
    
    # Очищаем pending
    await db.user_stats.update_one(
        {"telegram_id": telegram_id},
        {"$unset": {"pending_level_up": ""}}
    )
    
    return pending


async def recalculate_xp_for_user(db, telegram_id: int) -> dict:
    """
    Ретроактивный пересчёт XP для пользователя на основе всех его действий.
    ОПТИМИЗИРОВАНО: фильтрация group_tasks на уровне MongoDB + учёт сообщений.
    """
    xp = 0
    
    # 1. Выполненные задачи
    completed_tasks = await db.tasks.count_documents({
        "telegram_id": telegram_id,
        "completed": True,
    })
    xp += completed_tasks * XP_REWARDS["task_complete"]
    
    # 2. Достижения
    achievements = await db.user_achievements.find(
        {"telegram_id": telegram_id}
    ).to_list(length=100)
    for ach in achievements:
        xp += ach.get("points", 0)
    
    # 3. Стрик + визиты
    stats = await db.user_stats.find_one({"telegram_id": telegram_id})
    if stats:
        max_streak = stats.get("visit_streak_max", 0)
        active_days = stats.get("active_days", [])
        xp += len(active_days) * XP_REWARDS["daily_visit"]
        # Бонусы за milestones
        if max_streak >= 7:
            xp += XP_REWARDS["streak_7_bonus"]
        if max_streak >= 14:
            xp += XP_REWARDS["streak_14_bonus"]
        if max_streak >= 30:
            xp += XP_REWARDS["streak_30_bonus"]
    
    # 4. Рефералы
    referral_connections = await db.referral_connections.count_documents({
        "referrer_id": telegram_id,
    })
    xp += referral_connections * XP_REWARDS["referral"]
    
    # 5. Групповые задачи — ОПТИМИЗИРОВАНО: фильтрация на уровне MongoDB
    group_tasks_completed = 0
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
    except Exception as e:
        logger.warning(f"Failed to aggregate group tasks for {telegram_id}, falling back: {e}")
        # Fallback к старому методу
        group_tasks = await db.group_tasks.find(
            {"participants.telegram_id": telegram_id}
        ).to_list(length=500)
        for gt in group_tasks:
            for p in gt.get("participants", []):
                if p.get("telegram_id") == telegram_id and p.get("completed"):
                    group_tasks_completed += 1
    xp += group_tasks_completed * XP_REWARDS["group_task_complete"]
    
    # 6. Отправленные сообщения (учитываем лимит 5/день)
    messages_sent = 0
    try:
        messages_sent = await db.messages.count_documents({
            "sender_id": telegram_id
        })
    except Exception:
        pass
    # Лимит: 5 XP за сообщения в день. Приблизительный подсчёт:
    # Считаем макс 5 XP/день × кол-во активных дней
    active_days_count = len(stats.get("active_days", [])) if stats else 0
    max_message_xp = active_days_count * 5 * XP_REWARDS["message_sent"]
    message_xp = min(messages_sent * XP_REWARDS["message_sent"], max_message_xp)
    xp += message_xp
    
    # Обновляем в БД
    await db.user_stats.update_one(
        {"telegram_id": telegram_id},
        {"$set": {"xp": xp}},
        upsert=True,
    )
    
    info = calculate_level_info(xp)
    logger.info(
        f"📊 Recalculated XP for user={telegram_id}: "
        f"{xp} XP → LV.{info['level']} ({info['tier']})"
    )
    
    return {
        "telegram_id": telegram_id,
        "xp": xp,
        "breakdown": {
            "tasks": completed_tasks * XP_REWARDS["task_complete"],
            "achievements": sum(a.get("points", 0) for a in achievements),
            "visits": len(stats.get("active_days", [])) * XP_REWARDS["daily_visit"] if stats else 0,
            "streak_bonuses": (
                (XP_REWARDS["streak_7_bonus"] if (stats and stats.get("visit_streak_max", 0) >= 7) else 0) +
                (XP_REWARDS["streak_14_bonus"] if (stats and stats.get("visit_streak_max", 0) >= 14) else 0) +
                (XP_REWARDS["streak_30_bonus"] if (stats and stats.get("visit_streak_max", 0) >= 30) else 0)
            ),
            "referrals": referral_connections * XP_REWARDS["referral"],
            "group_tasks": group_tasks_completed * XP_REWARDS["group_task_complete"],
            "messages": message_xp,
        },
        **info,
    }
