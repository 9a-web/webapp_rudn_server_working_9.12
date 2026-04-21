"""
Comprehensive test script for notification system
"""

import asyncio
import os
import sys
from datetime import datetime, timedelta
import pytz

# Add backend to path
sys.path.insert(0, '/app/backend')

from motor.motor_asyncio import AsyncIOMotorClient
from notifications import get_notification_service, TelegramNotificationService
from scheduler import NotificationScheduler
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/backend/.env')

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN')
MOSCOW_TZ = pytz.timezone('Europe/Moscow')


async def test_1_bot_connection():
    """Test 1: Check if bot token is valid and bot can connect"""
    print("\n" + "="*60)
    print("TEST 1: Bot Connection Test")
    print("="*60)
    
    try:
        if not TELEGRAM_BOT_TOKEN:
            print("❌ TELEGRAM_BOT_TOKEN is not set in environment!")
            return False
        
        print(f"✓ Bot token found: {TELEGRAM_BOT_TOKEN[:20]}...")
        
        notification_service = TelegramNotificationService(TELEGRAM_BOT_TOKEN)
        
        # Try to get bot info
        bot_info = await notification_service.bot.get_me()
        print(f"✅ Bot connected successfully!")
        print(f"   Bot username: @{bot_info.username}")
        print(f"   Bot name: {bot_info.first_name}")
        print(f"   Bot ID: {bot_info.id}")
        
        return True
        
    except Exception as e:
        print(f"❌ Bot connection failed: {e}")
        return False


async def test_2_database_connection():
    """Test 2: Check database connection"""
    print("\n" + "="*60)
    print("TEST 2: Database Connection Test")
    print("="*60)
    
    try:
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Try to ping database
        await db.command('ping')
        print(f"✅ Database connected successfully!")
        print(f"   MongoDB URL: {MONGO_URL}")
        print(f"   Database: {DB_NAME}")
        
        # Check collections
        collections = await db.list_collection_names()
        print(f"   Collections: {', '.join(collections)}")
        
        # Count users with notifications enabled
        count_all = await db.user_settings.count_documents({})
        count_notifications = await db.user_settings.count_documents({"notifications_enabled": True})
        
        print(f"   Total users: {count_all}")
        print(f"   Users with notifications enabled: {count_notifications}")
        
        return True, db
        
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False, None


async def test_3_notification_service():
    """Test 3: Test notification service directly"""
    print("\n" + "="*60)
    print("TEST 3: Notification Service Test")
    print("="*60)
    
    try:
        notification_service = get_notification_service()
        
        # Test data
        test_telegram_id = 123456789  # This is a test ID, won't send real message
        test_class_info = {
            'discipline': 'Тестовая дисциплина',
            'time': '10:30-12:00',
            'teacher': 'Тестовый преподаватель',
            'auditory': '101',
            'lessonType': 'Лекция'
        }
        
        print("Testing notification formatting...")
        formatted_message = notification_service._format_class_notification(test_class_info, 10)
        print("✅ Notification formatted successfully:")
        print("---")
        print(formatted_message)
        print("---")
        
        return True
        
    except Exception as e:
        print(f"❌ Notification service test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_4_scheduler_configuration():
    """Test 4: Check scheduler configuration"""
    print("\n" + "="*60)
    print("TEST 4: Scheduler Configuration Test")
    print("="*60)
    
    try:
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        
        scheduler = NotificationScheduler(db)
        
        print("✅ Scheduler created successfully")
        print(f"   Scheduler type: {type(scheduler.scheduler).__name__}")
        print(f"   Notification service: {type(scheduler.notification_service).__name__}")
        
        # Check scheduler jobs
        print("\n   Checking scheduler jobs...")
        scheduler.start()
        
        jobs = scheduler.scheduler.get_jobs()
        print(f"   Number of jobs: {len(jobs)}")
        
        for job in jobs:
            print(f"   - Job: {job.name}")
            print(f"     ID: {job.id}")
            print(f"     Trigger: {job.trigger}")
            print(f"     Next run: {job.next_run_time}")
        
        scheduler.stop()
        
        return True
        
    except Exception as e:
        print(f"❌ Scheduler configuration test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_5_notification_logic():
    """Test 5: Test notification logic with mock data"""
    print("\n" + "="*60)
    print("TEST 5: Notification Logic Test")
    print("="*60)
    
    try:
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Create test user with notifications enabled
        test_user_id = 999999999
        test_group_id = "test-group-123"
        
        print("Creating test user...")
        await db.user_settings.update_one(
            {"telegram_id": test_user_id},
            {"$set": {
                "telegram_id": test_user_id,
                "group_id": test_group_id,
                "notifications_enabled": True,
                "notification_time": 10,
                "created_at": datetime.utcnow(),
                "last_activity": datetime.utcnow()
            }},
            upsert=True
        )
        
        print(f"✅ Test user created: {test_user_id}")
        
        # Create test schedule that will trigger soon
        now = datetime.now(MOSCOW_TZ)
        future_time = now + timedelta(minutes=11)  # 11 minutes from now
        
        time_str = f"{future_time.strftime('%H:%M')}-{(future_time + timedelta(hours=1, minutes=30)).strftime('%H:%M')}"
        
        # Get current day in Russian
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
        
        test_schedule = {
            "group_id": test_group_id,
            "week_number": 1,
            "events": [
                {
                    "day": current_day,
                    "time": time_str,
                    "discipline": "Тестовая дисциплина",
                    "teacher": "Тестовый преподаватель",
                    "auditory": "Аудитория 101",
                    "lessonType": "Лекция"
                }
            ],
            "cached_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(hours=24)
        }
        
        print(f"Creating test schedule for {current_day} at {time_str}...")
        await db.schedule_cache.update_one(
            {"group_id": test_group_id, "week_number": 1},
            {"$set": test_schedule},
            upsert=True
        )
        
        print(f"✅ Test schedule created")
        print(f"   Day: {current_day}")
        print(f"   Time: {time_str}")
        print(f"   Current time: {now.strftime('%H:%M')}")
        print(f"   Class starts in: ~11 minutes")
        print(f"   Notification should trigger in: ~1 minute")
        
        # Now test the scheduler's check function
        print("\nTesting scheduler check function...")
        scheduler = NotificationScheduler(db)
        
        # Run one check manually
        await scheduler.check_and_send_notifications()
        
        print("✅ Scheduler check completed (check logs for details)")
        
        # Cleanup
        print("\nCleaning up test data...")
        await db.user_settings.delete_one({"telegram_id": test_user_id})
        await db.schedule_cache.delete_one({"group_id": test_group_id})
        print("✅ Test data cleaned up")
        
        return True
        
    except Exception as e:
        print(f"❌ Notification logic test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_6_scheduler_job_execution():
    """Test 6: Check if scheduler jobs are actually executing"""
    print("\n" + "="*60)
    print("TEST 6: Scheduler Job Execution Test")
    print("="*60)
    
    try:
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Create a test collection to track execution
        test_collection = "scheduler_execution_test"
        await db[test_collection].delete_many({})
        
        print("Starting scheduler for 90 seconds...")
        print("Waiting to see if jobs execute...")
        
        scheduler = NotificationScheduler(db)
        scheduler.start()
        
        # Wait for at least one execution cycle
        print("Waiting 90 seconds for scheduler to run...")
        for i in range(9):
            await asyncio.sleep(10)
            print(f"   {(i+1)*10} seconds elapsed...")
        
        scheduler.stop()
        
        # Check logs for execution
        print("\n✅ Scheduler ran for 90 seconds")
        print("   Check /var/log/supervisor/backend.*.log for execution logs")
        print("   Look for: 'Checking for upcoming classes' or 'Found X users with notifications'")
        
        # Cleanup
        await db[test_collection].drop()
        
        return True
        
    except Exception as e:
        print(f"❌ Scheduler execution test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("COMPREHENSIVE NOTIFICATION SYSTEM DIAGNOSTIC")
    print("="*80)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    results = {}
    
    # Test 1: Bot Connection
    results['bot_connection'] = await test_1_bot_connection()
    
    # Test 2: Database Connection
    results['database'], db = await test_2_database_connection()
    
    # Test 3: Notification Service
    results['notification_service'] = await test_3_notification_service()
    
    # Test 4: Scheduler Configuration
    results['scheduler_config'] = await test_4_scheduler_configuration()
    
    # Test 5: Notification Logic
    results['notification_logic'] = await test_5_notification_logic()
    
    # Test 6: Scheduler Execution (takes 90 seconds)
    results['scheduler_execution'] = await test_6_scheduler_job_execution()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name.ljust(25)}: {status}")
    
    all_passed = all(results.values())
    
    if all_passed:
        print("\n✅ ALL TESTS PASSED! Notification system should be working.")
    else:
        print("\n❌ SOME TESTS FAILED! Review the output above for details.")
    
    print("="*80)
    
    return all_passed


if __name__ == "__main__":
    asyncio.run(main())
