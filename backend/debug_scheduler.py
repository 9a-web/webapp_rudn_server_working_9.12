
import os
import logging
from datetime import datetime, timedelta
from dotenv import load_dotenv
from pathlib import Path

# Загрузка .env
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import asyncio
import pytz
from motor.motor_asyncio import AsyncIOMotorClient
from scheduler_v2 import get_scheduler_v2

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Конфигурация
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017/rudn_schedule")
TELEGRAM_ID = 123456789  # Тестовый ID
MOSCOW_TZ = pytz.timezone('Europe/Moscow')

async def test_scheduler():
    client = AsyncIOMotorClient(MONGO_URL)
    db_name = os.environ.get("DB_NAME", "rudn_schedule")
    db = client[db_name]
    
    now_msk = datetime.now(MOSCOW_TZ)
    today_str = now_msk.strftime('%Y-%m-%d')
    
    # День недели на русском (для фильтрации)
    current_day = now_msk.strftime('%A')
    day_mapping = {
        'Monday': 'Понедельник', 'Tuesday': 'Вторник', 'Wednesday': 'Среда',
        'Thursday': 'Четверг', 'Friday': 'Пятница', 'Saturday': 'Суббота', 'Sunday': 'Воскресенье'
    }
    russian_day = day_mapping.get(current_day, current_day)
    
    logger.info(f"🕒 Current MSK time: {now_msk.strftime('%H:%M:%S')}")
    logger.info(f"📅 Date: {today_str}, Day: {russian_day}")

    # 1. Создаем пользователя
    await db.user_settings.update_one(
        {"telegram_id": TELEGRAM_ID},
        {"$set": {
            "telegram_id": TELEGRAM_ID,
            "notifications_enabled": True,
            "notification_time": 10,
            "group_id": "TEST_GROUP"
        }},
        upsert=True
    )
    logger.info("✅ User created/updated")

    # 2. Создаем тестовую пару через 15 минут
    # Если сейчас 23:00, пара будет в 23:15. Уведомление д.б. в 23:05 (через 5 мин)
    class_time = now_msk + timedelta(minutes=15)
    start_time_str = class_time.strftime("%H:%M")
    end_time_str = (class_time + timedelta(minutes=90)).strftime("%H:%M")
    time_str = f"{start_time_str} - {end_time_str}"
    
    logger.info(f"🎓 Creating fake class at: {time_str} (Notification expected at {(class_time - timedelta(minutes=10)).strftime('%H:%M')})")

    fake_schedule = {
        "group_id": "TEST_GROUP",
        "week_number": 1 if now_msk.isocalendar()[1] % 2 != 0 else 2, # Правильный номер недели
        "expires_at": datetime.utcnow() + timedelta(hours=1),
        "events": [
            {
                "day": russian_day,
                "discipline": "TEST SUBJECT",
                "time": time_str,
                "teacher": "Test Teacher",
                "auditory": "101",
                "lessonType": "Practice"
            }
        ]
    }

    await db.schedule_cache.update_one(
        {"group_id": "TEST_GROUP"}, # Упрощаем поиск, scheduler ищет по group_id + week_number
        {"$set": fake_schedule},
        upsert=True
    )
    # Важно! Scheduler ищет с week_number. Нам нужно убедиться, что мы пишем в правильный week_number
    # В _prepare_user_schedule вычисляется week_number.
    # Давайте продублируем для обеих недель, чтобы наверняка
    fake_schedule["week_number"] = 1
    await db.schedule_cache.update_one({"group_id": "TEST_GROUP", "week_number": 1}, {"$set": fake_schedule}, upsert=True)
    fake_schedule["week_number"] = 2
    await db.schedule_cache.update_one({"group_id": "TEST_GROUP", "week_number": 2}, {"$set": fake_schedule}, upsert=True)
    
    logger.info("✅ Schedule cache updated")

    # 3. Запускаем планировщик вручную
    logger.info("🔄 Running scheduler...")
    scheduler = get_scheduler_v2(db)
    result = await scheduler.schedule_user_notifications(TELEGRAM_ID)
    
    logger.info(f"📊 Result: {result}")
    
    # 4. Проверяем БД
    notification = await db.scheduled_notifications.find_one({
        "telegram_id": TELEGRAM_ID,
        "date": today_str,
        "class_info.discipline": "TEST SUBJECT"
    })
    
    if notification:
        logger.info(f"🎉 SUCCESS! Found notification in DB:")
        logger.info(f"   - Scheduled time: {notification['scheduled_time']}")
        logger.info(f"   - Status: {notification['status']}")
    else:
        logger.error("❌ FAILURE! Notification not found in DB")
        
        # Debug: почему не нашли?
        # Проверим кэш еще раз
        cache = await db.schedule_cache.find_one({"group_id": "TEST_GROUP", "week_number": scheduler._get_week_number(now_msk)})
        if not cache:
             logger.error("   - Cache NOT found for current week!")
        else:
             logger.info(f"   - Cache found. Events: {len(cache.get('events', []))}")
             # Проверим день недели в событиях
             events_today = [e for e in cache.get('events', []) if e.get('day') == russian_day]
             logger.info(f"   - Events for {russian_day}: {len(events_today)}")

if __name__ == "__main__":
    asyncio.run(test_scheduler())
