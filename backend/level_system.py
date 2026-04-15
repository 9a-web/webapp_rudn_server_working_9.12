"""
Система уровней RUDN GO
XP → Level → Tier (Base / Medium / Rare / Premium / Legend)

v4.0 — Психология-ориентированный редизайн:
- 5 тиров × 4 уровня = 20 основных уровней + open-ended
- Сниженные пороги XP (Legend ≈ 3400 XP вместо 92000)
- 4 звезды на тир (1 уровень = 1 звезда) — без дублирования
- Непрерывная нумерация уровней (не сбрасывается между тирами)
- Каждый уровень = +1000 XP за пределами таблицы
- Психологические принципы:
  * Немедленное вознаграждение: LV.2 за 15 XP (первый день)
  * Эффект градиента цели: короткие промежутки = частые "почти!"
  * Социальная идентичность: 5 чётких тиров
  * Эффект Зейгарник: 4 звезды на тир = всегда к чему стремиться
  * Достижимый пик: Legend за 3-5 месяцев активного использования

v3.1 — Предыдущие исправления:
- Исправлен подсчёт breakdown (task_on_time)
- Начисление XP за групповые задачи
- Приватность level/tier/stars
"""

import logging
import traceback
from datetime import datetime, timedelta
from pymongo import ReturnDocument

logger = logging.getLogger(__name__)


def _now_moscow():
    """Текущее время по Москве (UTC+3)."""
    try:
        import pytz
        return datetime.now(pytz.timezone('Europe/Moscow'))
    except Exception:
        return datetime.utcnow() + timedelta(hours=3)


def _today_moscow_str():
    """Сегодняшняя дата по Москве в формате YYYY-MM-DD."""
    return _now_moscow().strftime("%Y-%m-%d")


def _today_moscow_range():
    """Возвращает (start, end) datetime для текущего дня по Москве в UTC."""
    try:
        import pytz
        moscow_tz = pytz.timezone('Europe/Moscow')
        now = datetime.now(moscow_tz)
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)
        # Конвертируем в UTC для запросов MongoDB
        start_utc = start_of_day.astimezone(pytz.utc).replace(tzinfo=None)
        end_utc = end_of_day.astimezone(pytz.utc).replace(tzinfo=None)
        return start_utc, end_utc
    except Exception:
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(hours=3)
        return today, today + timedelta(days=1)


# ──────────────────────────────────────────────
# Таблица порогов XP для каждого уровня (1-20)
# 5 тиров × 4 уровня, плавная кривая
# ──────────────────────────────────────────────
LEVEL_THRESHOLDS = [
    0,       # LV 1  (Base ★)
    15,      # LV 2  (Base ★★)
    40,      # LV 3  (Base ★★★)
    80,      # LV 4  (Base ★★★★)
    140,     # LV 5  (Medium ★)
    220,     # LV 6  (Medium ★★)
    320,     # LV 7  (Medium ★★★)
    450,     # LV 8  (Medium ★★★★)
    600,     # LV 9  (Rare ★)
    780,     # LV 10 (Rare ★★)
    1000,    # LV 11 (Rare ★★★)
    1250,    # LV 12 (Rare ★★★★)
    1550,    # LV 13 (Premium ★)
    1900,    # LV 14 (Premium ★★)
    2300,    # LV 15 (Premium ★★★)
    2800,    # LV 16 (Premium ★★★★)
    3400,    # LV 17 (Legend ★)
    4100,    # LV 18 (Legend ★★)
    4900,    # LV 19 (Legend ★★★)
    5800,    # LV 20 (Legend ★★★★)
]

# За пределами таблицы каждый уровень = +1000 XP
EXTRA_LEVEL_STEP = 1000

# Привязка уровня → тир (4 уровня на тир)
TIER_THRESHOLDS = [
    (17, "legend"),
    (13, "premium"),
    (9,  "rare"),
    (5,  "medium"),
    (1,  "base"),
]

# ──────────────────────────────────────────────
# Названия уровней (русские) — 20 основных
# ──────────────────────────────────────────────
LEVEL_TITLES = {
    1: "Новичок",
    2: "Студент",
    3: "Первокурсник",
    4: "Знаток",
    5: "Активист",
    6: "Организатор",
    7: "Энтузиаст",
    8: "Профи",
    9: "Эксперт",
    10: "Мастер",
    11: "Наставник",
    12: "Авторитет",
    13: "Стратег",
    14: "Лидер",
    15: "Гуру",
    16: "Титан",
    17: "Элита",
    18: "Герой",
    19: "Абсолют",
    20: "Легенда",
}

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
    "referral":             100,  # УВЕЛИЧЕНО: 50 → 100
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
    {"action": "daily_visit",       "xp": 3,   "label": "Ежедневный визит",        "limit": "1/день"},
    {"action": "task_complete",     "xp": 5,   "label": "Выполнение задачи",       "limit": None},
    {"action": "task_on_time_bonus","xp": 3,   "label": "Задача вовремя (бонус)",  "limit": None},
    {"action": "group_task_complete","xp": 8,  "label": "Групповая задача",        "limit": None},
    {"action": "achievement_earned","xp": "5–50", "label": "Получение достижения",  "limit": None},
    {"action": "referral",          "xp": 100, "label": "Приглашение друга",       "limit": None},
    {"action": "schedule_view",     "xp": 1,   "label": "Просмотр расписания",     "limit": "3/день"},
    {"action": "message_sent",      "xp": 1,   "label": "Отправка сообщения",      "limit": "5/день"},
    {"action": "streak_7_bonus",    "xp": 20,  "label": "Стрик 7 дней",            "limit": "каждые 7 дней"},
    {"action": "streak_14_bonus",   "xp": 40,  "label": "Стрик 14 дней",           "limit": "каждые 14 дней"},
    {"action": "streak_30_bonus",   "xp": 80,  "label": "Стрик 30 дней",           "limit": "каждые 30 дней"},
]


# ──────────────────────────────────────────────
# Система звёзд внутри тиров (1–4)
# ──────────────────────────────────────────────
def get_stars_in_tier(level: int, tier: str) -> int:
    """
    Возвращает количество звёзд (1-4) внутри текущего тира.
    Каждый тир = 4 уровня, 1 уровень = 1 звезда.

    v4.0: Упрощённая формула — все тиры одинаковые (4 уровня × 4 звезды).
    """
    tier_ranges = {
        "base":    (1, 4),
        "medium":  (5, 8),
        "rare":    (9, 12),
        "premium": (13, 16),
        "legend":  (17, 20),
    }

    rng = tier_ranges.get(tier, (1, 4))
    min_lvl, max_lvl = rng

    if level < min_lvl:
        return 1
    if level > max_lvl:
        # За пределами таблицы (legend 21+): циклическая ★ 1-4
        extra = (level - max_lvl - 1) % 4
        return extra + 1

    return level - min_lvl + 1


def get_tier(level: int) -> str:
    """Определяет тир по уровню"""
    for threshold, tier in TIER_THRESHOLDS:
        if level >= threshold:
            return tier
    return "base"


def get_level_title(level: int) -> str:
    """Получить название уровня"""
    if level in LEVEL_TITLES:
        return LEVEL_TITLES[level]
    # Для уровней выше 20 (beyond legend)
    return f"Легенда {level - 19}"


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

    tier = get_tier(level)

    # Пороги текущего и следующего уровня
    xp_current = get_level_threshold(level)
    xp_next = get_level_threshold(level + 1)

    # Прогресс внутри уровня
    xp_in_level = xp - xp_current
    xp_needed = xp_next - xp_current
    progress = round(min(max(xp_in_level / xp_needed, 0.0), 1.0), 4) if xp_needed > 0 else 1.0

    stars = get_stars_in_tier(level, tier)
    title = get_level_title(level)

    return {
        "level": level,
        "tier": tier,
        "xp": xp,
        "xp_current_level": xp_current,
        "xp_next_level": xp_next,
        "xp_in_level": max(0, xp_in_level),
        "xp_needed": xp_needed,
        "progress": progress,
        "stars": stars,
        "title": title,
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
# Дневные лимиты (ИСПРАВЛЕНО: теперь по московскому времени)
# ──────────────────────────────────────────────
async def check_daily_xp_limit(db, telegram_id: int, action: str) -> bool:
    """
    Проверяет, не превышен ли дневной лимит XP для указанного действия.
    Возвращает True, если начисление разрешено.
    ИСПРАВЛЕНО: использует московское время вместо UTC.
    """
    limit = DAILY_XP_LIMITS.get(action)
    if limit is None:
        return True  # Нет лимита для этого действия

    start_utc, end_utc = _today_moscow_range()

    # Считаем сколько раз уже начислено сегодня (по московскому дню)
    count = await db.xp_events.count_documents({
        "telegram_id": telegram_id,
        "reason": action,
        "created_at": {
            "$gte": start_utc,
            "$lt": end_utc,
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
                        "level_title": new_info.get("title", ""),
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
    """
    result = await db.user_stats.find_one_and_update(
        {"telegram_id": telegram_id, "pending_level_up": {"$exists": True, "$ne": None}},
        {"$unset": {"pending_level_up": ""}},
        return_document=False,
    )

    if result and result.get("pending_level_up"):
        return result["pending_level_up"]

    return None


# ──────────────────────────────────────────────
# XP History (для графиков)
# ──────────────────────────────────────────────
async def get_xp_history(db, telegram_id: int, days: int = 30) -> list:
    """
    Возвращает историю XP по дням за последние N дней.
    Агрегирует xp_events в дневные суммы.
    """
    try:
        import pytz  # noqa: F811
        moscow_tz = pytz.timezone('Europe/Moscow')  # noqa: F841
    except Exception:
        moscow_tz = None  # noqa: F841

    since = datetime.utcnow() - timedelta(days=days)

    pipeline = [
        {"$match": {
            "telegram_id": telegram_id,
            "created_at": {"$gte": since},
        }},
        {"$sort": {"created_at": 1}},
        {"$group": {
            "_id": {
                "$dateToString": {
                    "format": "%Y-%m-%d",
                    "date": "$created_at",
                    "timezone": "+03:00",  # Moscow
                }
            },
            "xp": {"$sum": "$amount"},
            "events": {"$sum": 1},
            "last_total": {"$last": "$new_total"},
        }},
        {"$sort": {"_id": 1}},
    ]

    results = await db.xp_events.aggregate(pipeline).to_list(length=days + 1)

    history = []
    for r in results:
        history.append({
            "date": r["_id"],
            "xp_earned": r["xp"],
            "events_count": r["events"],
            "total_xp": r.get("last_total", 0),
        })

    return history


# ──────────────────────────────────────────────
# Daily XP Progress (сколько заработал сегодня)
# ──────────────────────────────────────────────
async def get_daily_xp_progress(db, telegram_id: int) -> dict:
    """
    Возвращает XP заработанный сегодня с разбивкой по действиям.
    """
    start_utc, end_utc = _today_moscow_range()

    pipeline = [
        {"$match": {
            "telegram_id": telegram_id,
            "created_at": {"$gte": start_utc, "$lt": end_utc},
        }},
        {"$group": {
            "_id": "$reason",
            "total_xp": {"$sum": "$amount"},
            "count": {"$sum": 1},
        }},
    ]

    results = await db.xp_events.aggregate(pipeline).to_list(length=50)

    by_action = {}
    total_today = 0
    for r in results:
        reason = r["_id"] or "unknown"
        # Нормализуем reason (daily_visit_streak_5 → daily_visit)
        base_reason = reason.split("_streak_")[0] if "_streak_" in reason else reason
        if base_reason.startswith("task_complete"):
            base_reason = "task_complete" if "on_time" not in base_reason else "task_on_time"

        if base_reason not in by_action:
            by_action[base_reason] = {"xp": 0, "count": 0}
        by_action[base_reason]["xp"] += r["total_xp"]
        by_action[base_reason]["count"] += r["count"]
        total_today += r["total_xp"]

    return {
        "date": _today_moscow_str(),
        "total_xp_today": total_today,
        "by_action": by_action,
    }


# ──────────────────────────────────────────────
# Read-only breakdown XP (ИСПРАВЛЕНО: точные данные из xp_events)
# ──────────────────────────────────────────────
async def get_xp_breakdown_readonly(db, telegram_id: int) -> dict:
    """
    Подсчитывает breakdown XP БЕЗ перезаписи в БД.
    ИСПРАВЛЕНО v3.0: streak, messages, schedule_views считаются из xp_events
    для точного соответствия реальным начислениям.
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

    stats = await db.user_stats.find_one({"telegram_id": telegram_id})

    # === Из xp_events (точные данные) ===
    try:
        pipeline = [
            {"$match": {"telegram_id": telegram_id}},
            {"$group": {
                "_id": None,
                # Стрик бонусы (все разы когда были начислены)
                "streak_xp": {"$sum": {
                    "$cond": [
                        {"$regexMatch": {"input": "$reason", "regex": "^daily_visit_streak_"}},
                        {"$subtract": ["$amount", XP_REWARDS["daily_visit"]]},
                        0
                    ]
                }},
                # Ежедневные визиты
                "visit_xp": {"$sum": {
                    "$cond": [
                        {"$regexMatch": {"input": "$reason", "regex": "^daily_visit"}},
                        XP_REWARDS["daily_visit"],
                        0
                    ]
                }},
                # Сообщения
                "message_xp": {"$sum": {
                    "$cond": [{"$eq": ["$reason", "message_sent"]}, "$amount", 0]
                }},
                # Просмотры расписания
                "schedule_xp": {"$sum": {
                    "$cond": [{"$eq": ["$reason", "schedule_view"]}, "$amount", 0]
                }},
                # Рефералы
                "referral_xp": {"$sum": {
                    "$cond": [{"$eq": ["$reason", "referral"]}, "$amount", 0]
                }},
                # Задачи (базовый XP: 5 за каждую, включая выполненные вовремя)
                # FIX v3.1: on_time задачи тоже дают базовые 5 XP в "tasks"
                "task_xp": {"$sum": {
                    "$cond": [
                        {"$regexMatch": {"input": "$reason", "regex": "^task_complete"}},
                        XP_REWARDS["task_complete"],
                        0
                    ]
                }},
                # Бонус за вовремя (только дополнительные 3 XP, не вся сумма)
                # FIX v3.1: вычитаем базовый XP задачи из суммы
                "task_on_time_xp": {"$sum": {
                    "$cond": [
                        {"$regexMatch": {"input": "$reason", "regex": "on_time"}},
                        {"$subtract": ["$amount", XP_REWARDS["task_complete"]]},
                        0
                    ]
                }},
                # Групповые задачи
                "group_task_xp": {"$sum": {
                    "$cond": [
                        {"$regexMatch": {"input": "$reason", "regex": "group_task"}},
                        "$amount",
                        0
                    ]
                }},
            }},
        ]

        xp_agg = await db.xp_events.aggregate(pipeline).to_list(1)

        if xp_agg:
            agg = xp_agg[0]
            breakdown["visits"] = agg.get("visit_xp", 0)
            breakdown["streak_bonuses"] = max(0, agg.get("streak_xp", 0))
            breakdown["messages"] = agg.get("message_xp", 0)
            breakdown["schedule_views"] = agg.get("schedule_xp", 0)
            breakdown["referrals"] = agg.get("referral_xp", 0)
            breakdown["tasks"] = agg.get("task_xp", 0)
            breakdown["task_on_time_bonus"] = agg.get("task_on_time_xp", 0)
            breakdown["group_tasks"] = agg.get("group_task_xp", 0)
    except Exception as e:
        logger.warning(f"xp_events aggregation failed for {telegram_id}, falling back: {e}")
        # Fallback: старый метод подсчёта
        await _breakdown_fallback(db, telegram_id, stats, breakdown)

    # === Достижения (всегда из коллекции) ===
    try:
        achievements = await db.user_achievements.find(
            {"telegram_id": telegram_id}
        ).to_list(length=200)
        breakdown["achievements"] = sum(a.get("points", 0) for a in achievements)
    except Exception:
        pass

    # === Бонусный XP (от dev-команд) ===
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


async def _breakdown_fallback(db, telegram_id: int, stats, breakdown: dict):
    """Fallback подсчёт если xp_events агрегация не удалась."""
    # Задачи
    try:
        completed_tasks = await db.tasks.count_documents({
            "telegram_id": telegram_id,
            "completed": True,
        })
        breakdown["tasks"] = completed_tasks * XP_REWARDS["task_complete"]
    except Exception:
        pass

    # Бонус за задачи вовремя
    try:
        on_time_count = await db.tasks.count_documents({
            "telegram_id": telegram_id,
            "completed": True,
            "completed_on_time": True,
        })
        breakdown["task_on_time_bonus"] = on_time_count * XP_REWARDS["task_on_time_bonus"]
    except Exception:
        pass

    # Визиты
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

    # Рефералы
    try:
        referral_connections = await db.referral_connections.count_documents({
            "referrer_id": telegram_id,
        })
        breakdown["referrals"] = referral_connections * XP_REWARDS["referral"]
    except Exception:
        pass

    # Групповые задачи
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
        breakdown["group_tasks"] = group_tasks_completed * XP_REWARDS["group_task_complete"]
    except Exception:
        pass

    # Сообщения и расписание — приблизительно
    if stats:
        active_days_count = max(len(stats.get("active_days", [])), 1)
        try:
            messages_sent = await db.messages.count_documents({"sender_id": telegram_id})
            max_msg_xp = active_days_count * DAILY_XP_LIMITS["message_sent"]
            breakdown["messages"] = min(messages_sent, max_msg_xp)
        except Exception:
            pass

        schedule_views_total = stats.get("schedule_views", 0)
        max_sched_xp = active_days_count * DAILY_XP_LIMITS["schedule_view"]
        breakdown["schedule_views"] = min(schedule_views_total, max_sched_xp)


# ──────────────────────────────────────────────
# Ретроактивный пересчёт (с защитой от потери XP)
# ──────────────────────────────────────────────
async def recalculate_xp_for_user(db, telegram_id: int) -> dict:
    """
    Ретроактивный пересчёт XP для пользователя.
    ЗАЩИТА: никогда не уменьшает текущий XP.
    """
    breakdown_result = await get_xp_breakdown_readonly(db, telegram_id)
    calculated_xp = breakdown_result["calculated_xp"]

    stats = await db.user_stats.find_one({"telegram_id": telegram_id})
    current_xp = stats.get("xp", 0) if stats else 0

    final_xp = max(current_xp, calculated_xp)

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
