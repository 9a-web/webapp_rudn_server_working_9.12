"""
Система достижений для приложения расписания РУДН
"""

from datetime import datetime
from typing import List, Optional
from models import Achievement, UserAchievement, UserStats, NewAchievementsResponse
import uuid

# Определение всех достижений
ACHIEVEMENTS = [
    {
        "id": "first_group",
        "name": "Первопроходец",
        "description": "Выбор первой группы",
        "emoji": "🎯",
        "points": 10,
        "type": "first_group",
        "requirement": 1
    },
    {
        "id": "group_explorer",
        "name": "Шпион",
        "description": "Просмотр 3+ разных групп",
        "emoji": "🕵️",
        "points": 15,
        "type": "group_explorer",
        "requirement": 3
    },
    {
        "id": "social_butterfly",
        "name": "Социальная бабочка",
        "description": "5+ приглашенных друзей",
        "emoji": "🦋",
        "points": 20,
        "type": "social_butterfly",
        "requirement": 5
    },
    {
        "id": "schedule_gourmet",
        "name": "Расписаний гурман",
        "description": "50+ просмотров расписания",
        "emoji": "🍕",
        "points": 25,
        "type": "schedule_gourmet",
        "requirement": 50
    },
    {
        "id": "attentive_student",
        "name": "Внимательный студент",
        "description": "50+ детальных просмотров (развернутые карточки)",
        "emoji": "🔍",
        "points": 30,
        "type": "attentive_student",
        "requirement": 50
    },
    {
        "id": "night_owl",
        "name": "Ночной совёнок",
        "description": "Использование с 23:00 до 04:00",
        "emoji": "🦉",
        "points": 10,
        "type": "night_owl",
        "requirement": 1
    },
    {
        "id": "early_bird",
        "name": "Утренняя пташка",
        "description": "Использование до 08:00",
        "emoji": "🌅",
        "points": 10,
        "type": "early_bird",
        "requirement": 1
    },
    # Новые достижения за исследование приложения
    {
        "id": "analyst",
        "name": "Аналитик",
        "description": "Открыл раздел аналитики",
        "emoji": "📈",
        "points": 10,
        "type": "analyst",
        "requirement": 1
    },
    {
        "id": "chart_lover",
        "name": "Любитель графиков",
        "description": "Проверил статистику 5 раз",
        "emoji": "📊",
        "points": 15,
        "type": "chart_lover",
        "requirement": 5
    },
    {
        "id": "organizer",
        "name": "Организатор",
        "description": "Использовал календарь",
        "emoji": "📅",
        "points": 10,
        "type": "organizer",
        "requirement": 1
    },
    {
        "id": "settings_master",
        "name": "Мастер настроек",
        "description": "Настроил уведомления",
        "emoji": "⚙️",
        "points": 10,
        "type": "settings_master",
        "requirement": 1
    },
    {
        "id": "knowledge_sharer",
        "name": "Делишься знаниями",
        "description": "Поделился расписанием",
        "emoji": "🔗",
        "points": 15,
        "type": "knowledge_sharer",
        "requirement": 1
    },
    {
        "id": "ambassador",
        "name": "Амбассадор",
        "description": "Поделился расписанием 5 раз",
        "emoji": "🎤",
        "points": 25,
        "type": "ambassador",
        "requirement": 5
    },
    {
        "id": "explorer",
        "name": "Исследователь",
        "description": "Открыл все разделы меню",
        "emoji": "🔎",
        "points": 20,
        "type": "explorer",
        "requirement": 4  # Достижения, Аналитика, Уведомления, Календарь
    },
    {
        "id": "first_week",
        "name": "Первая неделя",
        "description": "Использовал приложение 7 дней подряд",
        "emoji": "📆",
        "points": 30,
        "type": "first_week",
        "requirement": 7
    },
    {
        "id": "perfectionist",
        "name": "Перфекционист",
        "description": "Получил все базовые достижения",
        "emoji": "✨",
        "points": 50,
        "type": "perfectionist",
        "requirement": 23  # Все остальные достижения (24 - 1)
    },
    # Достижения для раздела "Список дел"
    {
        "id": "first_task",
        "name": "Первая задача",
        "description": "Создал первую задачу",
        "emoji": "📝",
        "points": 5,
        "type": "first_task",
        "requirement": 1
    },
    {
        "id": "productive_day",
        "name": "Продуктивный день",
        "description": "Выполнил 5 задач за день",
        "emoji": "✅",
        "points": 15,
        "type": "productive_day",
        "requirement": 5
    },
    {
        "id": "early_riser_tasks",
        "name": "Рано встаешь",
        "description": "Выполнил 10 задач до 9:00",
        "emoji": "🌅",
        "points": 15,
        "type": "early_riser_tasks",
        "requirement": 10
    },
    {
        "id": "task_specialist",
        "name": "Специалист по задачам",
        "description": "Создал 50 задач",
        "emoji": "🎯",
        "points": 20,
        "type": "task_specialist",
        "requirement": 50
    },
    {
        "id": "lightning_fast",
        "name": "Молния",
        "description": "Выполнил 20 задач за день",
        "emoji": "⚡",
        "points": 25,
        "type": "lightning_fast",
        "requirement": 20
    },
    {
        "id": "flawless",
        "name": "Безупречный",
        "description": "Выполнил 50 задач без просрочки",
        "emoji": "💎",
        "points": 30,
        "type": "flawless",
        "requirement": 50
    },
    {
        "id": "marathon_runner",
        "name": "Марафонец",
        "description": "Выполнял задачи 30 дней подряд",
        "emoji": "🏃",
        "points": 30,
        "type": "marathon_runner",
        "requirement": 30
    },
    {
        "id": "completion_master",
        "name": "Мастер завершения",
        "description": "Выполнил 100 задач",
        "emoji": "🏆",
        "points": 40,
        "type": "completion_master",
        "requirement": 100
    },
    # ============ Достижения за друзей ============
    {
        "id": "first_friend",
        "name": "Первый друг",
        "description": "Добавил первого друга",
        "emoji": "🤝",
        "points": 10,
        "type": "first_friend",
        "requirement": 1
    },
    {
        "id": "friendly_5",
        "name": "Общительный",
        "description": "5 друзей в приложении",
        "emoji": "👋",
        "points": 15,
        "type": "friendly",
        "requirement": 5
    },
    {
        "id": "friendly_15",
        "name": "Дружелюбный",
        "description": "15 друзей в приложении",
        "emoji": "🎉",
        "points": 20,
        "type": "friendly",
        "requirement": 15
    },
    {
        "id": "friendly_25",
        "name": "Популярный",
        "description": "25 друзей в приложении",
        "emoji": "⭐",
        "points": 25,
        "type": "friendly",
        "requirement": 25
    },
    {
        "id": "soul_of_company",
        "name": "Душа компании",
        "description": "50 друзей в приложении",
        "emoji": "👑",
        "points": 40,
        "type": "friendly",
        "requirement": 50
    },
    {
        "id": "interfaculty",
        "name": "Межфакультетский",
        "description": "Друзья с 3+ разных факультетов",
        "emoji": "🌐",
        "points": 25,
        "type": "interfaculty",
        "requirement": 3
    },
    {
        "id": "networker",
        "name": "Нетворкер",
        "description": "Друзья с 5+ разных факультетов",
        "emoji": "🔗",
        "points": 35,
        "type": "networker",
        "requirement": 5
    },
    {
        "id": "recruiter",
        "name": "Рекрутер",
        "description": "Пригласил 3 новых пользователей",
        "emoji": "📢",
        "points": 20,
        "type": "recruiter",
        "requirement": 3
    },
    {
        "id": "influencer",
        "name": "Инфлюенсер",
        "description": "Пригласил 10 новых пользователей",
        "emoji": "🚀",
        "points": 40,
        "type": "influencer",
        "requirement": 10
    }
]


def get_all_achievements() -> List[Achievement]:
    """Получить список всех достижений"""
    return [Achievement(**achievement) for achievement in ACHIEVEMENTS]


def get_achievement_by_id(achievement_id: str) -> Optional[Achievement]:
    """Получить достижение по ID"""
    for achievement in ACHIEVEMENTS:
        if achievement["id"] == achievement_id:
            return Achievement(**achievement)
    return None


async def check_and_award_achievements(db, telegram_id: int, stats: UserStats) -> NewAchievementsResponse:
    """
    Проверить и выдать новые достижения пользователю
    Возвращает список новых достижений
    """
    new_achievements = []
    total_points = 0
    
    # Получаем уже полученные достижения
    existing_achievements = await db.user_achievements.find(
        {"telegram_id": telegram_id}
    ).to_list(100)
    existing_ids = [ach["achievement_id"] for ach in existing_achievements]
    
    # Проверяем каждое достижение
    for achievement_data in ACHIEVEMENTS:
        achievement_id = achievement_data["id"]
        
        # Пропускаем, если уже есть
        if achievement_id in existing_ids:
            continue
        
        # Проверяем условия
        earned = False
        
        if achievement_id == "first_group" and stats.first_group_selected:
            earned = True
        elif achievement_id == "group_explorer" and len(stats.unique_groups) >= 3:
            earned = True
        elif achievement_id == "social_butterfly" and stats.friends_invited >= 5:
            earned = True
        elif achievement_id == "schedule_gourmet" and stats.schedule_views >= 50:
            earned = True
        elif achievement_id == "attentive_student" and stats.detailed_views >= 50:
            earned = True
        elif achievement_id == "night_owl" and stats.night_usage_count >= 1:
            earned = True
        elif achievement_id == "early_bird" and stats.early_usage_count >= 1:
            earned = True
        # Новые достижения за исследование приложения
        elif achievement_id == "analyst" and stats.analytics_views >= 1:
            earned = True
        elif achievement_id == "chart_lover" and stats.analytics_views >= 5:
            earned = True
        elif achievement_id == "organizer" and stats.calendar_opens >= 1:
            earned = True
        elif achievement_id == "settings_master" and stats.notifications_configured:
            earned = True
        elif achievement_id == "knowledge_sharer" and stats.schedule_shares >= 1:
            earned = True
        elif achievement_id == "ambassador" and stats.schedule_shares >= 5:
            earned = True
        elif achievement_id == "explorer" and len(stats.menu_items_visited) >= 4:
            earned = True
        elif achievement_id == "first_week":
            # Проверяем 7 дней подряд
            if len(stats.active_days) >= 7:
                # Сортируем даты и проверяем последовательность
                sorted_days = sorted(stats.active_days)
                consecutive_count = 1
                max_consecutive = 1
                
                for i in range(1, len(sorted_days)):
                    prev_date = datetime.strptime(sorted_days[i-1], "%Y-%m-%d").date()
                    curr_date = datetime.strptime(sorted_days[i], "%Y-%m-%d").date()
                    
                    if (curr_date - prev_date).days == 1:
                        consecutive_count += 1
                        max_consecutive = max(max_consecutive, consecutive_count)
                    else:
                        consecutive_count = 1
                
                if max_consecutive >= 7:
                    earned = True
        # Достижения для раздела "Список дел"
        elif achievement_id == "first_task" and stats.first_task_created:
            earned = True
        elif achievement_id == "productive_day" and stats.tasks_completed_today >= 5:
            earned = True
        elif achievement_id == "early_riser_tasks" and stats.tasks_completed_early >= 10:
            earned = True
        elif achievement_id == "task_specialist" and stats.tasks_created_total >= 50:
            earned = True
        elif achievement_id == "lightning_fast" and stats.tasks_completed_today >= 20:
            earned = True
        elif achievement_id == "flawless" and stats.tasks_completed_on_time >= 50:
            earned = True
        elif achievement_id == "marathon_runner" and stats.task_streak_current >= 30:
            earned = True
        elif achievement_id == "completion_master" and stats.tasks_completed_total >= 100:
            earned = True
        elif achievement_id == "perfectionist":
            # Проверяем, что получены все остальные достижения
            if len(existing_ids) >= 23:  # Все кроме самого перфекциониста
                earned = True
        
        # Если заработано, добавляем
        if earned:
            achievement = Achievement(**achievement_data)
            
            # Сохраняем в БД
            user_achievement = UserAchievement(
                telegram_id=telegram_id,
                achievement_id=achievement_id,
                earned_at=datetime.utcnow(),
                seen=False
            )
            
            await db.user_achievements.insert_one(user_achievement.dict())
            
            new_achievements.append(achievement)
            total_points += achievement.points
    
    # Обновляем статистику пользователя
    if total_points > 0:
        await db.user_stats.update_one(
            {"telegram_id": telegram_id},
            {
                "$inc": {
                    "total_points": total_points,
                    "achievements_count": len(new_achievements)
                },
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        # Начисляем бонусы рефереру за активность (10% от заработанных баллов)
        await award_referral_points(db, telegram_id, total_points)
    
    return NewAchievementsResponse(
        new_achievements=new_achievements,
        total_points_earned=total_points
    )


async def get_or_create_user_stats(db, telegram_id: int) -> UserStats:
    """Получить или создать статистику пользователя"""
    stats_data = await db.user_stats.find_one({"telegram_id": telegram_id})
    
    if not stats_data:
        # Создаем новую статистику
        stats = UserStats(telegram_id=telegram_id)
        await db.user_stats.insert_one(stats.dict())
        return stats
    
    return UserStats(**stats_data)


async def track_user_action(db, telegram_id: int, action_type: str, metadata: dict = None) -> NewAchievementsResponse:
    """
    Отследить действие пользователя и проверить достижения
    """
    if metadata is None:
        metadata = {}
    
    # Получаем статистику
    stats = await get_or_create_user_stats(db, telegram_id)
    
    # Обновляем статистику в зависимости от типа действия
    update_data = {"$set": {"updated_at": datetime.utcnow()}}
    
    if action_type == "select_group":
        if not stats.first_group_selected:
            update_data["$set"]["first_group_selected"] = True
    
    elif action_type == "view_group":
        group_id = metadata.get("group_id")
        if group_id and group_id not in stats.unique_groups:
            update_data["$push"] = {"unique_groups": group_id}
            update_data["$inc"] = {"groups_viewed": 1}
    
    elif action_type == "invite_friend":
        update_data["$inc"] = {"friends_invited": 1}
    
    elif action_type == "view_schedule":
        # Получаем количество уникальных пар из metadata
        # Если не передано, считаем как 1 просмотр для обратной совместимости
        classes_count = metadata.get("classes_count", 1)
        update_data["$inc"] = {"schedule_views": classes_count}
    
    elif action_type == "detailed_view":
        # Детальный просмотр - развернутая карточка предмета
        update_data["$inc"] = {"detailed_views": 1}
    
    elif action_type == "night_usage":
        update_data["$inc"] = {"night_usage_count": 1}
    
    elif action_type == "early_usage":
        update_data["$inc"] = {"early_usage_count": 1}
    
    # Новые действия для исследования приложения
    elif action_type == "view_analytics":
        update_data["$inc"] = {"analytics_views": 1}
    
    elif action_type == "open_calendar":
        update_data["$inc"] = {"calendar_opens": 1}
    
    elif action_type == "configure_notifications":
        update_data["$set"]["notifications_configured"] = True
    
    elif action_type == "share_schedule":
        update_data["$inc"] = {"schedule_shares": 1}
    
    elif action_type == "visit_menu_item":
        menu_item = metadata.get("menu_item")
        if menu_item and menu_item not in stats.menu_items_visited:
            if "$push" not in update_data:
                update_data["$push"] = {}
            update_data["$push"]["menu_items_visited"] = menu_item
    
    elif action_type == "daily_activity":
        # Отслеживаем активность по дням
        today = datetime.utcnow().strftime("%Y-%m-%d")
        if today not in stats.active_days:
            if "$push" not in update_data:
                update_data["$push"] = {}
            update_data["$push"]["active_days"] = today
    
    # Новые действия для раздела "Список дел"
    elif action_type == "create_task":
        # Первая задача
        if not stats.first_task_created:
            update_data["$set"]["first_task_created"] = True
        # Увеличиваем счетчик созданных задач
        update_data["$inc"] = {"tasks_created_total": 1}
    
    elif action_type == "complete_task":
        # Получаем метаданные
        current_hour = metadata.get("hour", 12)  # Час выполнения (0-23)
        was_on_time = metadata.get("on_time", False)  # Выполнена в срок?
        
        # Обновляем общий счетчик
        if "$inc" not in update_data:
            update_data["$inc"] = {}
        update_data["$inc"]["tasks_completed_total"] = 1
        update_data["$inc"]["tasks_completed_today"] = 1
        
        # Проверяем выполнение до 9:00
        if current_hour < 9:
            update_data["$inc"]["tasks_completed_early"] = 1
        
        # Проверяем выполнение в срок
        if was_on_time:
            update_data["$inc"]["tasks_completed_on_time"] = 1
        
        # Обновляем streak (серию дней)
        today = datetime.utcnow().strftime("%Y-%m-%d")
        last_completion = stats.last_task_completion_date
        
        if last_completion is None:
            # Первое выполнение
            update_data["$set"]["task_streak_current"] = 1
            update_data["$set"]["task_streak_days"] = 1
            update_data["$set"]["last_task_completion_date"] = today
        else:
            # Проверяем, продолжается ли серия
            last_date = datetime.strptime(last_completion, "%Y-%m-%d").date()
            current_date = datetime.strptime(today, "%Y-%m-%d").date()
            days_diff = (current_date - last_date).days
            
            if days_diff == 0:
                # Сегодня уже выполняли задачи, ничего не меняем в streak
                pass
            elif days_diff == 1:
                # Следующий день подряд - продолжаем серию
                new_streak = stats.task_streak_current + 1
                update_data["$set"]["task_streak_current"] = new_streak
                update_data["$set"]["task_streak_days"] = max(stats.task_streak_days, new_streak)
                update_data["$set"]["last_task_completion_date"] = today
            else:
                # Пропущены дни - сброс серии
                update_data["$set"]["task_streak_current"] = 1
                update_data["$set"]["last_task_completion_date"] = today
    
    elif action_type == "reset_daily_tasks":
        # Сброс счетчика задач за день (вызывается в начале нового дня)
        update_data["$set"]["tasks_completed_today"] = 0
        update_data["$set"]["last_daily_reset"] = datetime.utcnow().strftime("%Y-%m-%d")
    
    # Обновляем статистику в БД
    await db.user_stats.update_one(
        {"telegram_id": telegram_id},
        update_data
    )
    
    # Получаем обновленную статистику
    updated_stats = await get_or_create_user_stats(db, telegram_id)
    
    # Проверяем и выдаем новые достижения
    new_achievements_response = await check_and_award_achievements(db, telegram_id, updated_stats)
    
    return new_achievements_response


async def get_user_achievements(db, telegram_id: int) -> List[dict]:
    """Получить все достижения пользователя"""
    user_achievements = await db.user_achievements.find(
        {"telegram_id": telegram_id}
    ).to_list(100)
    
    result = []
    for user_ach in user_achievements:
        achievement = get_achievement_by_id(user_ach["achievement_id"])
        if achievement:
            result.append({
                "achievement": achievement.dict(),
                "earned_at": user_ach["earned_at"],
                "seen": user_ach.get("seen", False)
            })
    
    return result


async def mark_achievements_as_seen(db, telegram_id: int) -> bool:
    """Отметить все достижения как просмотренные"""
    result = await db.user_achievements.update_many(
        {"telegram_id": telegram_id, "seen": False},
        {"$set": {"seen": True}}
    )
    return result.modified_count > 0


async def award_referral_points(db, telegram_id: int, points_earned: int):
    """
    Начислить баллы рефереру за активность реферала
    10% от заработанных баллов распределяется по цепочке:
    - Уровень 1: 50% от 10% = 5% от original points
    - Уровень 2: 25% от 10% = 2.5% от original points
    - Уровень 3: 10% от 10% = 1% от original points
    """
    try:
        # Получаем все реферальные связи для этого пользователя
        connections = await db.referral_connections.find({
            "referred_telegram_id": telegram_id
        }).to_list(None)
        
        if not connections:
            return  # Нет рефереров
        
        # Расчет бонусов по уровням
        # 10% от заработанных баллов идёт в реферальную программу
        total_referral_pool = int(points_earned * 0.10)
        
        level_percentages = {
            1: 0.50,  # 50% от реферального пула
            2: 0.25,  # 25% от реферального пула
            3: 0.10   # 10% от реферального пула
        }
        
        for connection in connections:
            referrer_id = connection["referrer_telegram_id"]
            level = connection["level"]
            
            # Вычисляем бонус для этого уровня
            bonus = int(total_referral_pool * level_percentages.get(level, 0))
            
            if bonus > 0:
                # Обновляем статистику реферера
                await db.user_stats.update_one(
                    {"telegram_id": referrer_id},
                    {
                        "$inc": {"total_points": bonus},
                        "$set": {"updated_at": datetime.utcnow()}
                    },
                    upsert=True
                )
                
                # Обновляем заработанные баллы в user_settings
                await db.user_settings.update_one(
                    {"telegram_id": referrer_id},
                    {"$inc": {"referral_points_earned": bonus}}
                )
                
                # Обновляем заработанные баллы в реферальной связи
                await db.referral_connections.update_one(
                    {
                        "referrer_telegram_id": referrer_id,
                        "referred_telegram_id": telegram_id,
                        "level": level
                    },
                    {"$inc": {"points_earned": bonus}}
                )
                
                logger.info(f"💰 Начислено {bonus} баллов пользователю {referrer_id} за активность реферала {telegram_id} (уровень {level})")
    
    except Exception as e:
        logger.error(f"❌ Ошибка при начислении реферальных баллов: {e}", exc_info=True)
