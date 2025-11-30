"""
Тестовый скрипт для проверки новой системы уведомлений V2
"""

import asyncio
import sys
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import pytz
import os
from pathlib import Path
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv('/app/backend/.env')

# Добавляем backend в path
sys.path.insert(0, '/app/backend')

from scheduler_v2 import get_scheduler_v2

# Московское время
MOSCOW_TZ = pytz.timezone('Europe/Moscow')


async def test_scheduler_v2():
    """Тестирование новой системы планировщика"""
    
    print("=" * 80)
    print("🧪 ТЕСТИРОВАНИЕ NOTIFICATION SCHEDULER V2")
    print("=" * 80)
    print()
    
    # Подключаемся к БД
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/rudn_schedule')
    client = AsyncIOMotorClient(mongo_url)
    db = client.get_database()
    
    print("✅ Подключение к MongoDB установлено")
    print()
    
    # Получаем scheduler
    scheduler_v2 = get_scheduler_v2(db)
    
    # Проверяем статус scheduler
    print("📊 Статус планировщика:")
    print(f"   - Состояние: {'Запущен ✅' if scheduler_v2.scheduler.running else 'Остановлен ❌'}")
    print(f"   - Количество активных задач: {len(scheduler_v2.scheduler.get_jobs())}")
    print()
    
    # Показываем запланированные задачи
    print("📅 Запланированные задачи в APScheduler:")
    jobs = scheduler_v2.scheduler.get_jobs()
    for job in jobs:
        print(f"   - {job.id}: {job.name}")
        if hasattr(job.trigger, 'run_date'):
            print(f"     Время: {job.trigger.run_date.strftime('%Y-%m-%d %H:%M:%S')}")
        print()
    
    # Проверяем статистику уведомлений за сегодня
    today = datetime.now(MOSCOW_TZ).strftime('%Y-%m-%d')
    stats = await scheduler_v2.get_notification_stats(today)
    
    print("📊 Статистика уведомлений за сегодня:")
    print(f"   Дата: {stats.get('date', today)}")
    print(f"   Всего: {stats.get('total', 0)}")
    print(f"   Ожидают: {stats.get('pending', 0)}")
    print(f"   Отправлено: {stats.get('sent', 0)}")
    print(f"   Ошибки: {stats.get('failed', 0)}")
    print(f"   Отменено: {stats.get('cancelled', 0)}")
    print()
    
    # Проверяем записи в БД
    scheduled_count = await db.scheduled_notifications.count_documents({"date": today})
    print(f"📝 Записей в scheduled_notifications за сегодня: {scheduled_count}")
    
    if scheduled_count > 0:
        print("\n📋 Примеры запланированных уведомлений:")
        notifications = await db.scheduled_notifications.find({"date": today}).limit(5).to_list(5)
        
        for notif in notifications:
            print(f"\n   🔔 {notif.get('class_info', {}).get('discipline', 'Unknown')}")
            print(f"      Пользователь: {notif.get('telegram_id')}")
            print(f"      Время пары: {notif.get('class_info', {}).get('time', 'N/A')}")
            print(f"      Время отправки: {notif.get('scheduled_time')}")
            print(f"      Статус: {notif.get('status')}")
            print(f"      Попыток: {notif.get('attempts', 0)}")
    
    print()
    
    # Проверяем пользователей с уведомлениями
    users_with_notifications = await db.user_settings.count_documents({
        "notifications_enabled": True,
        "group_id": {"$exists": True, "$ne": None}
    })
    
    print(f"👥 Пользователей с включенными уведомлениями: {users_with_notifications}")
    
    if users_with_notifications > 0:
        print("\n📋 Примеры пользователей:")
        users = await db.user_settings.find({
            "notifications_enabled": True,
            "group_id": {"$exists": True, "$ne": None}
        }).limit(3).to_list(3)
        
        for user in users:
            print(f"\n   👤 {user.get('first_name', 'Unknown')} (ID: {user.get('telegram_id')})")
            print(f"      Группа: {user.get('group_name', 'N/A')}")
            print(f"      Уведомления за: {user.get('notification_time', 10)} минут")
    
    print()
    print("=" * 80)
    print("✅ ТЕСТИРОВАНИЕ ЗАВЕРШЕНО")
    print("=" * 80)
    
    # Закрываем соединение
    client.close()


async def trigger_daily_planner():
    """Принудительно запустить daily planner для тестирования"""
    
    print("=" * 80)
    print("🚀 ПРИНУДИТЕЛЬНЫЙ ЗАПУСК DAILY PLANNER")
    print("=" * 80)
    print()
    
    # Подключаемся к БД
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/rudn_schedule')
    client = AsyncIOMotorClient(mongo_url)
    db = client.get_database()
    
    scheduler_v2 = get_scheduler_v2(db)
    
    print("⏳ Запускаем подготовку расписания на сегодня...")
    print()
    
    await scheduler_v2.prepare_daily_schedule()
    
    print()
    print("✅ DAILY PLANNER ЗАВЕРШЕН")
    print()
    
    # Показываем результаты
    stats = await scheduler_v2.get_notification_stats()
    
    print("📊 Результаты:")
    print(f"   Создано уведомлений: {stats.get('total', 0)}")
    print(f"   Ожидают отправки: {stats.get('pending', 0)}")
    print()
    
    # Закрываем соединение
    client.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Тестирование Scheduler V2")
    parser.add_argument(
        '--trigger',
        action='store_true',
        help='Принудительно запустить daily planner'
    )
    
    args = parser.parse_args()
    
    if args.trigger:
        asyncio.run(trigger_daily_planner())
    else:
        asyncio.run(test_scheduler_v2())
