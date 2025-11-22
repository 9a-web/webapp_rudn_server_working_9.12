#!/usr/bin/env python3
"""
Скрипт для создания тестовых данных в MongoDB
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import uuid
import random

MONGO_URL = "mongodb://localhost:27017/rudn_schedule"

async def create_test_data():
    """Создать тестовые данные"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.rudn_schedule
    
    print("🚀 Создание тестовых данных...")
    
    # Очистка существующих данных (опционально)
    # await db.user_settings.delete_many({})
    # await db.user_stats.delete_many({})
    # await db.tasks.delete_many({})
    # await db.user_achievements.delete_many({})
    # await db.rooms.delete_many({})
    
    # Тестовые факультеты и группы
    faculties = [
        {"id": "1", "name": "Инженерная академия"},
        {"id": "2", "name": "Экономический факультет"},
        {"id": "3", "name": "Юридический институт"},
        {"id": "4", "name": "Факультет физико-математических наук"},
    ]
    
    groups = [
        "НМб-21-1-о", "НМб-22-1-о", "НМб-23-1-о",
        "ЭБ-21-1-о", "ЭБ-22-1-о", "ЭБ-23-1-о",
        "ЮМ-21-1-о", "ЮМ-22-1-о", "ЮМ-23-1-о",
        "ФМб-21-1-о", "ФМб-22-1-о", "ФМб-23-1-о",
    ]
    
    # Создаём 15 тестовых пользователей
    base_date = datetime.utcnow()
    users_count = 15
    
    for i in range(1, users_count + 1):
        telegram_id = 100000 + i
        
        # Случайный факультет и группа
        faculty = random.choice(faculties)
        group_name = random.choice(groups)
        kurs = group_name.split('-')[1]
        
        # Дата регистрации (последние 30 дней)
        days_ago = random.randint(0, 30)
        created_at = base_date - timedelta(days=days_ago)
        
        # Последняя активность
        last_activity_days = random.randint(0, days_ago)
        last_activity = base_date - timedelta(days=last_activity_days, hours=random.randint(0, 23))
        
        # User settings
        user_settings = {
            "id": str(uuid.uuid4()),
            "telegram_id": telegram_id,
            "username": f"test_user_{i}",
            "first_name": f"Тестовый{i}",
            "last_name": f"Пользователь{i}",
            "group_id": f"group_{i}",
            "group_name": group_name,
            "facultet_id": faculty["id"],
            "facultet_name": faculty["name"],
            "level_id": "1",
            "kurs": kurs,
            "form_code": "1",
            "notifications_enabled": random.choice([True, False]),
            "notification_time": random.choice([5, 10, 15, 20, 30]),
            "referral_code": f"ref_{telegram_id}",
            "referred_by": None,
            "invited_count": random.randint(0, 5),
            "created_at": created_at,
            "last_activity": last_activity
        }
        
        await db.user_settings.insert_one(user_settings)
        
        # User stats
        user_stats = {
            "telegram_id": telegram_id,
            "groups_viewed": random.randint(1, 10),
            "friends_invited": random.randint(0, 5),
            "schedule_views": random.randint(10, 100),
            "night_usage_count": random.randint(0, 10),
            "early_usage_count": random.randint(0, 10),
            "total_points": random.randint(100, 1000),
            "achievements_count": random.randint(0, 10),
            "analytics_views": random.randint(0, 20),
            "calendar_opens": random.randint(0, 30),
            "notifications_configured": 1 if user_settings["notifications_enabled"] else 0,
            "schedule_shares": random.randint(0, 5),
            "menu_items_visited": random.randint(5, 20),
            "active_days": random.randint(1, 30),
            "created_at": created_at
        }
        
        await db.user_stats.insert_one(user_stats)
        
        # Создаём несколько задач для каждого пользователя
        tasks_count = random.randint(2, 8)
        for j in range(tasks_count):
            task = {
                "id": str(uuid.uuid4()),
                "telegram_id": telegram_id,
                "text": f"Тестовая задача {j+1} для пользователя {i}",
                "completed": random.choice([True, False]),
                "category": random.choice(["учеба", "личное", "спорт", "проекты"]),
                "priority": random.choice(["high", "medium", "low"]),
                "deadline": None,
                "target_date": None,
                "notes": "",
                "tags": [],
                "order": j,
                "created_at": created_at + timedelta(days=random.randint(0, days_ago)),
                "updated_at": created_at + timedelta(days=random.randint(0, days_ago))
            }
            await db.tasks.insert_one(task)
        
        # Случайные достижения
        achievements_count = random.randint(0, 5)
        for j in range(achievements_count):
            achievement = {
                "telegram_id": telegram_id,
                "achievement_id": f"achievement_{j+1}",
                "earned_at": created_at + timedelta(days=random.randint(0, days_ago)),
                "seen": random.choice([True, False])
            }
            await db.user_achievements.insert_one(achievement)
        
        print(f"✅ Создан пользователь {i}/{users_count}: {user_settings['first_name']} {user_settings['last_name']} (@{user_settings['username']})")
    
    # Создаём несколько комнат
    for i in range(1, 6):
        room = {
            "id": str(uuid.uuid4()),
            "name": f"Тестовая комната {i}",
            "color": random.choice(["purple", "blue", "green", "orange", "pink"]),
            "emoji": random.choice(["📚", "💻", "🎯", "🚀", "🎨"]),
            "description": f"Описание комнаты {i}",
            "owner_id": 100001,
            "created_at": base_date - timedelta(days=random.randint(0, 30)),
            "total_participants": random.randint(2, 8),
            "total_tasks": random.randint(5, 20),
            "completed_tasks": random.randint(0, 15)
        }
        await db.rooms.insert_one(room)
    
    print(f"\n🎉 Создано:")
    total_users = await db.user_settings.count_documents({})
    total_tasks = await db.tasks.count_documents({})
    total_achievements = await db.user_achievements.count_documents({})
    total_rooms = await db.rooms.count_documents({})
    
    print(f"   - {total_users} пользователей")
    print(f"   - {total_tasks} задач")
    print(f"   - {total_achievements} достижений")
    print(f"   - {total_rooms} комнат")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_test_data())
