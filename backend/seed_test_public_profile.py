"""Сидинг тестового пользователя для проверки Stage 4 PublicProfilePage."""
import asyncio
import os
import uuid
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient


async def main():
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    test_uid = "123456789"
    telegram_id = 777000111

    # 1) users (новая identity)
    await db.users.update_one(
        {"uid": test_uid},
        {
            "$set": {
                "uid": test_uid,
                "username": "ivan_test",
                "first_name": "Иван",
                "last_name": "Тестов",
                "telegram_id": telegram_id,
                "email": "ivan@test.local",
                "auth_providers": ["telegram"],
                "created_at": datetime(2025, 3, 12, tzinfo=timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "is_deleted": False,
            }
        },
        upsert=True,
    )

    # 2) user_settings (для legacy API /api/u/{uid} при построении профиля)
    await db.user_settings.update_one(
        {"telegram_id": telegram_id},
        {
            "$set": {
                "id": str(uuid.uuid4()),
                "uid": test_uid,
                "telegram_id": telegram_id,
                "first_name": "Иван",
                "last_name": "Тестов",
                "username": "ivan_test",
                "group_name": "ОБ-Б-23-1",
                "facultet_name": "Факультет физико-математических и естественных наук",
                "selected_group_id": "G-TEST-123",
                "selected_filters": {
                    "facultetName": "Факультет физико-математических и естественных наук",
                    "facultetId": "F1",
                    "kursName": "1 курс",
                    "kursId": "K1",
                    "groupName": "ОБ-Б-23-1",
                    "groupId": "G-TEST-123",
                },
                "theme": "dark",
                "language": "ru",
                "last_activity": datetime.now(timezone.utc),
                "created_at": datetime(2025, 3, 12, tzinfo=timezone.utc),
                "privacy_settings": {
                    "show_in_search": True,
                    "show_schedule": True,
                    "show_friends_list": True,
                    "show_achievements": True,
                    "show_online_status": True,
                    "show_last_activity": True,
                },
            }
        },
        upsert=True,
    )

    # 3) user_stats
    await db.user_stats.update_one(
        {"telegram_id": telegram_id},
        {
            "$set": {
                "telegram_id": telegram_id,
                "total_xp": 1420,
                "current_level": 4,
                "current_tier": "silver",
                "current_stars": 2,
                "classes_attended": 58,
                "current_streak": 7,
                "longest_streak": 12,
                "friends_count": 12,
                "achievements_count": 8,
            }
        },
        upsert=True,
    )

    # 4) friends (чтобы был счётчик — реальная схема: user_telegram_id + friend_telegram_id)
    for i in range(12):
        await db.friends.update_one(
            {"user_telegram_id": telegram_id, "friend_telegram_id": 800000000 + i},
            {
                "$set": {
                    "user_telegram_id": telegram_id,
                    "friend_telegram_id": 800000000 + i,
                    "status": "accepted",
                    "created_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )

    print(f"✅ Seeded test user: UID={test_uid}, telegram_id={telegram_id}")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
