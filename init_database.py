"""
Скрипт инициализации базы данных test_database
Создает все необходимые коллекции и индексы
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

# Загрузка переменных окружения
ROOT_DIR = Path(__file__).parent / "backend"
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "test_database")


async def init_database():
    """Инициализация базы данных с необходимыми коллекциями и индексами"""
    
    print("🚀 Инициализация базы данных")
    print(f"📍 MongoDB: {MONGO_URL}")
    print(f"🗄  Database: {DB_NAME}\n")
    
    # Подключение к MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # Список необходимых коллекций
        collections_to_create = [
            "user_settings",
            "user_stats", 
            "user_achievements",
            "tasks",
            "rooms",
            "room_participants",
            "group_tasks",
            "sent_notifications"
        ]
        
        existing_collections = await db.list_collection_names()
        
        print("📝 Создание коллекций:")
        for collection_name in collections_to_create:
            if collection_name not in existing_collections:
                await db.create_collection(collection_name)
                print(f"   ✅ Создана коллекция: {collection_name}")
            else:
                print(f"   ⚪ Коллекция уже существует: {collection_name}")
        
        print("\n📊 Создание индексов:")
        
        # Индексы для user_settings
        await db.user_settings.create_index("telegram_id", unique=True)
        print("   ✅ user_settings: telegram_id (unique)")
        
        # Индексы для user_stats
        await db.user_stats.create_index("telegram_id", unique=True)
        print("   ✅ user_stats: telegram_id (unique)")
        
        # Индексы для user_achievements
        await db.user_achievements.create_index([("telegram_id", 1), ("achievement_id", 1)], unique=True)
        print("   ✅ user_achievements: telegram_id + achievement_id (unique)")
        
        # Индексы для tasks
        await db.tasks.create_index("telegram_id")
        await db.tasks.create_index("created_at")
        print("   ✅ tasks: telegram_id, created_at")
        
        # Индексы для rooms
        await db.rooms.create_index("creator_id")
        await db.rooms.create_index("invite_token", unique=True)
        print("   ✅ rooms: creator_id, invite_token (unique)")
        
        # Индексы для room_participants
        await db.room_participants.create_index([("room_id", 1), ("telegram_id", 1)], unique=True)
        await db.room_participants.create_index("telegram_id")
        print("   ✅ room_participants: room_id + telegram_id (unique), telegram_id")
        
        # Индексы для group_tasks
        await db.group_tasks.create_index("room_id")
        await db.group_tasks.create_index("creator_id")
        print("   ✅ group_tasks: room_id, creator_id")
        
        # Индексы для sent_notifications
        await db.sent_notifications.create_index([("telegram_id", 1), ("lesson_id", 1), ("notification_date", 1)], unique=True)
        await db.sent_notifications.create_index("notification_date")
        print("   ✅ sent_notifications: telegram_id + lesson_id + notification_date (unique)")
        
        print("\n📊 Статистика базы данных:")
        stats = await db.command("dbStats")
        print(f"   Коллекций: {stats['collections']}")
        print(f"   Документов: {stats['objects']}")
        print(f"   Размер данных: {stats['dataSize'] / 1024 / 1024:.2f} MB")
        
        print("\n✅ Инициализация завершена успешно!")
        print(f"\n💡 База данных {DB_NAME} готова к использованию")
        
    except Exception as e:
        print(f"\n❌ Ошибка при инициализации: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(init_database())
