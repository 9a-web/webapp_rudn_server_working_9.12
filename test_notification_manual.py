"""
Скрипт для создания тестового пользователя с уведомлениями
Запускайте этот скрипт, чтобы протестировать отправку уведомлений
"""

import asyncio
import sys
from datetime import datetime, timedelta
import pytz

sys.path.insert(0, '/app/backend')

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv('/app/backend/.env')

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')
MOSCOW_TZ = pytz.timezone('Europe/Moscow')


async def setup_test_notification():
    """Настроить тестовое уведомление"""
    
    print("\n" + "="*70)
    print("СОЗДАНИЕ ТЕСТОВОГО СЦЕНАРИЯ ДЛЯ УВЕДОМЛЕНИЙ")
    print("="*70)
    
    # Получаем Telegram ID от пользователя
    print("\nДля тестирования уведомлений вам нужно:")
    print("1. Открыть Telegram")
    print("2. Найти бота @rudn_mosbot")
    print("3. Отправить команду /start")
    print("4. Узнать свой Telegram ID (можно у бота @userinfobot)")
    
    telegram_id_input = input("\nВведите ваш Telegram ID (или нажмите Enter для использования тестового ID 123456789): ")
    
    if telegram_id_input.strip():
        try:
            telegram_id = int(telegram_id_input.strip())
        except ValueError:
            print("❌ Неверный формат ID. Используется тестовый ID.")
            telegram_id = 123456789
    else:
        telegram_id = 123456789
        print("⚠️  Используется тестовый Telegram ID: 123456789")
        print("   Уведомление НЕ будет отправлено, так как это не реальный пользователь.")
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Текущее время в Москве
    now = datetime.now(MOSCOW_TZ)
    
    # Создаем время для пары через 11 минут
    class_start_time = now + timedelta(minutes=11)
    class_end_time = class_start_time + timedelta(hours=1, minutes=30)
    
    time_str = f"{class_start_time.strftime('%H:%M')}-{class_end_time.strftime('%H:%M')}"
    
    # Определяем день недели на русском
    day_mapping = {
        'Monday': 'Понедельник',
        'Tuesday': 'Вторник',
        'Wednesday': 'Среда',
        'Thursday': 'Четверг',
        'Friday': 'Пятница',
        'Saturday': 'Суббота',
        'Sunday': 'Воскресенье'
    }
    current_day = day_mapping.get(now.strftime('%A'), 'Понедельник')
    
    print(f"\n📅 Создаю тестовое расписание:")
    print(f"   День: {current_day}")
    print(f"   Время пары: {time_str}")
    print(f"   Текущее время: {now.strftime('%H:%M:%S')}")
    print(f"   Пара начнется через: ~11 минут")
    print(f"   Уведомление придет через: ~1 минуту")
    
    # Создаем тестовую группу
    test_group_id = f"test-group-{telegram_id}"
    
    # 1. Создаем пользователя с включенными уведомлениями
    print(f"\n1️⃣ Создаю пользователя с ID {telegram_id}...")
    await db.user_settings.update_one(
        {"telegram_id": telegram_id},
        {"$set": {
            "telegram_id": telegram_id,
            "group_id": test_group_id,
            "notifications_enabled": True,
            "notification_time": 10,  # За 10 минут до начала
            "created_at": datetime.utcnow(),
            "last_activity": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }},
        upsert=True
    )
    print("   ✅ Пользователь создан")
    
    # 2. Создаем расписание
    print(f"\n2️⃣ Создаю расписание для группы {test_group_id}...")
    schedule = {
        "group_id": test_group_id,
        "week_number": 1,
        "events": [
            {
                "day": current_day,
                "time": time_str,
                "discipline": "Тестовая дисциплина (проверка уведомлений)",
                "teacher": "Тестовый Преподаватель",
                "auditory": "Тестовая аудитория 101",
                "lessonType": "Лекция"
            }
        ],
        "cached_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(hours=24)
    }
    
    await db.schedule_cache.update_one(
        {"group_id": test_group_id, "week_number": 1},
        {"$set": schedule},
        upsert=True
    )
    print("   ✅ Расписание создано")
    
    # 3. Проверяем настройки
    print("\n3️⃣ Проверяю созданные данные...")
    user = await db.user_settings.find_one({"telegram_id": telegram_id})
    cached_schedule = await db.schedule_cache.find_one({"group_id": test_group_id})
    
    if user and cached_schedule:
        print("   ✅ Все данные созданы корректно")
        print(f"\n📊 Настройки пользователя:")
        print(f"   - Telegram ID: {user['telegram_id']}")
        print(f"   - Группа: {user['group_id']}")
        print(f"   - Уведомления: {'✅ Включены' if user['notifications_enabled'] else '❌ Выключены'}")
        print(f"   - Время уведомления: за {user['notification_time']} минут")
        
        print(f"\n📚 Расписание:")
        print(f"   - День: {cached_schedule['events'][0]['day']}")
        print(f"   - Время: {cached_schedule['events'][0]['time']}")
        print(f"   - Дисциплина: {cached_schedule['events'][0]['discipline']}")
    
    # 4. Информация о мониторинге
    print("\n" + "="*70)
    print("✅ ТЕСТОВЫЙ СЦЕНАРИЙ СОЗДАН!")
    print("="*70)
    
    print("\n⏱️  ЧТО ДОЛЖНО ПРОИЗОЙТИ:")
    print("   1. Через ~1 минуту scheduler обнаружит предстоящую пару")
    print("   2. Бот попытается отправить уведомление")
    print("   3. Если вы начали диалог с ботом - уведомление придет в Telegram")
    print("   4. Если нет - увидите ошибку 'Chat not found' в логах")
    
    print("\n📊 МОНИТОРИНГ:")
    print("   Следите за логами командой:")
    print("   tail -f /var/log/supervisor/backend.err.log | grep -E 'scheduler|notification|Sending'")
    
    print("\n🔍 ЧТО ИСКАТЬ В ЛОГАХ:")
    print("   - 'Found 1 users with notifications enabled'")
    print("   - 'Checking classes for user [your_id]'")
    print("   - 'Sending notification to [your_id]'")
    print("   - '✅ Notification sent successfully' ИЛИ '❌ Failed to send'")
    
    if telegram_id == 123456789:
        print("\n⚠️  ВАЖНО:")
        print("   Вы используете тестовый ID, уведомление НЕ будет отправлено!")
        print("   Для реального теста используйте ваш настоящий Telegram ID.")
    else:
        print("\n✅ Вы используете реальный Telegram ID.")
        print("   Убедитесь, что вы отправили /start боту @rudn_mosbot!")
    
    print("\n🧹 ОЧИСТКА ТЕСТОВЫХ ДАННЫХ:")
    cleanup = input("\nХотите оставить тестовые данные? (y/n, по умолчанию - y): ")
    
    if cleanup.lower() == 'n':
        await db.user_settings.delete_one({"telegram_id": telegram_id})
        await db.schedule_cache.delete_one({"group_id": test_group_id})
        print("✅ Тестовые данные удалены")
    else:
        print("✅ Тестовые данные сохранены")
        print("   Для удаления позже используйте:")
        print(f"   mongosh {MONGO_URL}/{DB_NAME} --eval \"db.user_settings.deleteOne({{telegram_id: {telegram_id}}})\"")
    
    print("\n" + "="*70)


if __name__ == "__main__":
    asyncio.run(setup_test_notification())
