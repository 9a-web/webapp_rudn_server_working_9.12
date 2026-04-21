"""
Скрипт для добавления демо-данных в базу для тестирования админ панели
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import random
import uuid

MONGO_URL = "mongodb://localhost:27017"
db_client = AsyncIOMotorClient(MONGO_URL)
db = db_client.test_database  # Используем правильную базу из .env

async def add_demo_data():
    print("🚀 Начинаем добавление демо-данных...")
    
    # Создаем демо-пользователей
    demo_users = []
    faculties = [
        {"id": "1", "name": "Инженерная академия"},
        {"id": "2", "name": "Экономический факультет"},
        {"id": "3", "name": "Факультет гуманитарных наук"},
        {"id": "4", "name": "Медицинский институт"},
        {"id": "5", "name": "Юридический институт"},
    ]
    
    courses = ["1", "2", "3", "4"]
    
    # Создаем 20 демо-пользователей
    for i in range(20):
        faculty = random.choice(faculties)
        course = random.choice(courses)
        telegram_id = 100000 + i
        
        # Дата регистрации - случайная в последние 30 дней
        days_ago = random.randint(1, 30)
        created_at = datetime.utcnow() - timedelta(days=days_ago)
        
        # Последняя активность - случайная в последние 7 дней
        last_activity_days = random.randint(0, 7)
        last_activity = datetime.utcnow() - timedelta(days=last_activity_days, hours=random.randint(0, 23))
        
        user = {
            "id": str(uuid.uuid4()),
            "telegram_id": str(telegram_id),
            "first_name": f"Пользователь {i+1}",
            "username": f"user{i+1}",
            "faculty_id": faculty["id"],
            "faculty_name": faculty["name"],
            "course": course,
            "group_id": f"group_{i}",
            "group_name": f"Группа-{i+1:02d}-{24}",
            "created_at": created_at,
            "last_activity": last_activity
        }
        
        demo_users.append(user)
    
    # Вставляем пользователей
    await db.user_settings.delete_many({"telegram_id": {"$regex": "^10000"}})  # Очищаем старые демо-данные
    await db.user_settings.insert_many(demo_users)
    print(f"✅ Добавлено {len(demo_users)} пользователей")
    
    # Создаем статистику для пользователей
    demo_stats = []
    for user in demo_users:
        stats = {
            "id": str(uuid.uuid4()),
            "telegram_id": user["telegram_id"],
            "groups_viewed": random.randint(1, 10),
            "friends_invited": random.randint(0, 5),
            "schedule_views": random.randint(5, 100),
            "analytics_views": random.randint(0, 20),
            "calendar_opens": random.randint(0, 30),
            "notifications_configured": random.choice([0, 1]),
            "schedule_shares": random.randint(0, 10),
            "night_usage_count": random.randint(0, 15),
            "early_usage_count": random.randint(0, 10),
            "total_points": random.randint(10, 200),
            "achievements_count": random.randint(1, 10),
            "tasks_created": random.randint(0, 50),
            "menu_items_visited": random.randint(0, 5),
            "active_days": random.randint(1, 30),
            "created_at": user["created_at"]
        }
        demo_stats.append(stats)
    
    await db.user_stats.delete_many({"telegram_id": {"$regex": "^10000"}})  # Очищаем старые демо-данные
    await db.user_stats.insert_many(demo_stats)
    print(f"✅ Добавлена статистика для {len(demo_stats)} пользователей")
    
    # Создаем демо-задачи
    demo_tasks = []
    for user in demo_users[:10]:  # Задачи только для 10 пользователей
        num_tasks = random.randint(3, 15)
        for j in range(num_tasks):
            task = {
                "id": str(uuid.uuid4()),
                "telegram_id": user["telegram_id"],
                "text": f"Задача {j+1} для {user['first_name']}",
                "completed": random.choice([True, False]),
                "created_at": datetime.utcnow() - timedelta(days=random.randint(0, 14)),
                "deadline": datetime.utcnow() + timedelta(days=random.randint(-5, 10)) if random.random() > 0.3 else None,
                "priority": random.choice(["high", "medium", "low"]),
                "category": random.choice(["study", "personal", "sport", "project"])
            }
            demo_tasks.append(task)
    
    await db.tasks.delete_many({"telegram_id": {"$regex": "^10000"}})  # Очищаем старые демо-данные
    await db.tasks.insert_many(demo_tasks)
    print(f"✅ Добавлено {len(demo_tasks)} задач")
    
    # Создаем демо-достижения
    # Простой список ID достижений
    achievement_ids = ["first_group", "analytics_viewer", "organizer", "settings_master", "sharer", "ambassador", "explorer", "first_week", "perfectionist"]
    demo_achievements = []
    for user in demo_users[:15]:  # Достижения для 15 пользователей
        num_achievements = random.randint(1, min(5, len(achievement_ids)))
        for achievement_id in random.sample(achievement_ids, num_achievements):
            user_achievement = {
                "id": str(uuid.uuid4()),
                "telegram_id": user["telegram_id"],
                "achievement_id": achievement_id,
                "earned_at": datetime.utcnow() - timedelta(days=random.randint(0, 20)),
                "seen": random.choice([True, False])
            }
            demo_achievements.append(user_achievement)
    
    await db.user_achievements.delete_many({"telegram_id": {"$regex": "^10000"}})  # Очищаем старые демо-данные
    await db.user_achievements.insert_many(demo_achievements)
    print(f"✅ Добавлено {len(demo_achievements)} достижений")
    
    # Создаем демо-комнаты
    demo_rooms = []
    for i in range(5):
        room = {
            "id": str(uuid.uuid4()),
            "name": f"Комната {i+1}",
            "description": f"Описание комнаты {i+1}",
            "owner_id": demo_users[i]["telegram_id"],
            "participants": [demo_users[i]["telegram_id"]] + [demo_users[j]["telegram_id"] for j in range(i+1, min(i+4, len(demo_users)))],
            "created_at": datetime.utcnow() - timedelta(days=random.randint(1, 20)),
            "invite_token": f"token_{i}"
        }
        demo_rooms.append(room)
    
    await db.rooms.delete_many({"owner_id": {"$regex": "^10000"}})  # Очищаем старые демо-данные
    await db.rooms.insert_many(demo_rooms)
    print(f"✅ Добавлено {len(demo_rooms)} комнат")
    
    print("\n🎉 Демо-данные успешно добавлены!")
    print("\n📊 Статистика:")
    print(f"  - Пользователей: {len(demo_users)}")
    print(f"  - Задач: {len(demo_tasks)}")
    print(f"  - Достижений: {len(demo_achievements)}")
    print(f"  - Комнат: {len(demo_rooms)}")
    
    # Выводим примерную статистику
    total_schedule_views = sum(s["schedule_views"] for s in demo_stats)
    total_points = sum(s["total_points"] for s in demo_stats)
    completed_tasks = len([t for t in demo_tasks if t["completed"]])
    
    print(f"\n💡 Общие метрики:")
    print(f"  - Просмотры расписания: {total_schedule_views}")
    print(f"  - Всего очков: {total_points}")
    print(f"  - Выполненных задач: {completed_tasks}/{len(demo_tasks)}")

if __name__ == "__main__":
    asyncio.run(add_demo_data())
