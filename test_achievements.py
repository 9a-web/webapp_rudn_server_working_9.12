import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import os, json

async def main():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
    db = client['test_database']
    
    TID = 555001
    
    # Cleanup
    await db.user_stats.delete_many({'telegram_id': TID})
    await db.user_achievements.delete_many({'telegram_id': TID})
    
    print("=== Test 1: tasks_completed_today auto-reset ===")
    # Simulate yesterday's stats
    yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
    today = datetime.utcnow().strftime("%Y-%m-%d")
    
    import uuid
    await db.user_stats.insert_one({
        'id': str(uuid.uuid4()),
        'telegram_id': TID,
        'tasks_completed_today': 99,  # yesterday's leftover
        'last_daily_reset': yesterday,
        'tasks_completed_total': 100,
        'tasks_created_total': 0,
        'tasks_completed_early': 0,
        'tasks_completed_on_time': 0,
        'task_streak_current': 0,
        'task_streak_days': 0,
        'last_task_completion_date': None,
        'first_task_created': False,
        'groups_viewed': 0,
        'unique_groups': [],
        'friends_invited': 0,
        'schedule_views': 0,
        'detailed_views': 0,
        'night_usage_count': 0,
        'early_usage_count': 0,
        'first_group_selected': False,
        'analytics_views': 0,
        'calendar_opens': 0,
        'notifications_configured': False,
        'schedule_shares': 0,
        'menu_items_visited': [],
        'active_days': [],
        'friends_count': 0,
        'friends_faculties_count': 0,
        'users_invited': 0,
        'visit_streak_current': 0,
        'visit_streak_max': 0,
        'last_visit_date': None,
        'freeze_shields': 0,
        'streak_claimed_today': False,
        'total_points': 0,
        'achievements_count': 0,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
    })
    
    import aiohttp
    async with aiohttp.ClientSession() as session:
        # Complete a task — should reset today counter to 1 (not 100)
        async with session.post('http://localhost:8001/api/track-action', json={
            'telegram_id': TID,
            'action_type': 'complete_task',
            'metadata': {'hour': 10, 'on_time': True}
        }) as resp:
            data = await resp.json()
            print(f"  Track response: {resp.status}")
        
        # Check stats
        async with session.get(f'http://localhost:8001/api/user-stats/{TID}') as resp:
            stats = await resp.json()
            today_count = stats.get('tasks_completed_today', -1)
            print(f"  tasks_completed_today: {today_count} (expected: 1)")
            assert today_count == 1, f"FAIL: expected 1, got {today_count}"
            print("  ✅ Daily reset works!")
    
    print("\n=== Test 2: UserStatsResponse has all new fields ===")
    async with aiohttp.ClientSession() as session:
        async with session.get(f'http://localhost:8001/api/user-stats/{TID}') as resp:
            stats = await resp.json()
            required_fields = ['unique_groups', 'analytics_views', 'calendar_opens', 
                             'schedule_shares', 'menu_items_visited', 'active_days',
                             'friends_count', 'friends_faculties_count', 'users_invited']
            missing = [f for f in required_fields if f not in stats]
            if missing:
                print(f"  ❌ Missing fields: {missing}")
            else:
                print(f"  ✅ All {len(required_fields)} new fields present!")
    
    print("\n=== Test 3: schedule_views increments by 1 (not classes_count) ===")
    async with aiohttp.ClientSession() as session:
        # Track with classes_count=15
        async with session.post('http://localhost:8001/api/track-action', json={
            'telegram_id': TID,
            'action_type': 'view_schedule',
            'metadata': {'classes_count': 15}
        }) as resp:
            pass
        
        async with session.get(f'http://localhost:8001/api/user-stats/{TID}') as resp:
            stats = await resp.json()
            views = stats.get('schedule_views', -1)
            print(f"  schedule_views: {views} (expected: 1)")
            assert views == 1, f"FAIL: expected 1, got {views}"
            print("  ✅ View inflation fixed!")
    
    print("\n=== Test 4: perfectionist requirement check ===")
    async with aiohttp.ClientSession() as session:
        async with session.get('http://localhost:8001/api/achievements') as resp:
            achievements = await resp.json()
            perf = next((a for a in achievements if a['id'] == 'perfectionist'), None)
            req = perf.get('requirement', -1)
            print(f"  perfectionist requirement: {req} (expected: 32)")
            assert req == 32, f"FAIL: expected 32, got {req}"
            print("  ✅ Perfectionist requirement correct!")
    
    # Cleanup
    await db.user_stats.delete_many({'telegram_id': TID})
    await db.user_achievements.delete_many({'telegram_id': TID})
    
    print("\n=== ALL TESTS PASSED ===")

asyncio.run(main())
