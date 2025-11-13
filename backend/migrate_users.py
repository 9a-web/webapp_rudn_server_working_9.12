"""
Миграция пользователей - добавление недостающих полей
Запуск: python migrate_users.py
"""

import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime
import uuid

# Загрузка переменных окружения
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "test_database")


async def migrate_users():
    """Миграция пользователей - добавление отсутствующих полей"""
    
    print("🔄 Начало миграции пользователей...")
    print(f"📍 MongoDB: {MONGO_URL}")
    print(f"🗄 Database: {DB_NAME}\n")
    
    # Подключение к MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # 1. Добавление поля 'id' для пользователей без него
        users_without_id = await db.user_settings.find({"id": {"$exists": False}}).to_list(length=None)
        
        if users_without_id:
            print(f"📝 Найдено {len(users_without_id)} пользователей без поля 'id'")
            
            for user in users_without_id:
                user_id = str(uuid.uuid4())
                result = await db.user_settings.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"id": user_id}}
                )
                
                if result.modified_count > 0:
                    print(f"   ✅ Пользователь {user['telegram_id']} (@{user.get('username', 'N/A')}): добавлен id = {user_id}")
        else:
            print("✅ Все пользователи уже имеют поле 'id'")
        
        print()
        
        # 2. Добавление поля 'updated_at' для пользователей без него
        result = await db.user_settings.update_many(
            {"updated_at": {"$exists": False}},
            {"$set": {"updated_at": datetime.utcnow()}}
        )
        
        if result.modified_count > 0:
            print(f"📝 Обновлено {result.modified_count} пользователей: добавлено поле 'updated_at'")
        else:
            print("✅ Все пользователи уже имеют поле 'updated_at'")
        
        print()
        
        # 3. Добавление поля 'created_at' для пользователей без него (на основе _id timestamp)
        users_without_created = await db.user_settings.find({"created_at": {"$exists": False}}).to_list(length=None)
        
        if users_without_created:
            print(f"📝 Найдено {len(users_without_created)} пользователей без поля 'created_at'")
            
            for user in users_without_created:
                # Извлекаем timestamp из ObjectId
                created_at = user["_id"].generation_time
                result = await db.user_settings.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"created_at": created_at}}
                )
                
                if result.modified_count > 0:
                    print(f"   ✅ Пользователь {user['telegram_id']}: добавлен created_at = {created_at}")
        else:
            print("✅ Все пользователи уже имеют поле 'created_at'")
        
        print()
        
        # 4. Статистика после миграции
        total_users = await db.user_settings.count_documents({})
        users_with_groups = await db.user_settings.count_documents({"group_id": {"$exists": True, "$ne": None}})
        users_without_groups = total_users - users_with_groups
        
        print("📊 Статистика пользователей:")
        print(f"   Всего пользователей: {total_users}")
        print(f"   С выбранной группой: {users_with_groups}")
        print(f"   Без группы: {users_without_groups}")
        
        print("\n✅ Миграция завершена успешно!")
        
    except Exception as e:
        print(f"\n❌ Ошибка при миграции: {e}")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(migrate_users())
