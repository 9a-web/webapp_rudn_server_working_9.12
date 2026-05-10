"""
Seed script for creating Email-only test user for BUG-FIX 2026-07 testing
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv('/app/backend/.env')

PSEUDO_TID_OFFSET = 10_000_000_000

async def main():
    """Create Email-only test user with pseudo_tid"""
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Test user data
    uid = '197964944'
    pseudo_tid = PSEUDO_TID_OFFSET + int(uid)
    
    print(f"Creating Email-only test user:")
    print(f"  UID: {uid}")
    print(f"  Pseudo TID: {pseudo_tid}")
    
    # 1. Create/update users document (Email-only, NO telegram_id)
    user_doc = {
        'uid': uid,
        'username': 'testuser',
        'first_name': 'Test',
        'last_name': 'User',
        'email': 'test@example.com',
        'password_hash': '$2b$12$dummyhashfortest',  # Dummy hash
        'auth_providers': ['email'],
        'primary_auth': 'email',
        'registration_step': 0,  # Completed
        'email_verified': True,
        'created_at': datetime.now(timezone.utc),
        'updated_at': datetime.now(timezone.utc),
        # NO telegram_id field - this is the key for Email-only users
    }
    
    result = await db.users.update_one(
        {'uid': uid},
        {'$set': user_doc},
        upsert=True
    )
    print(f"  Users collection: {'created' if result.upserted_id else 'updated'}")
    
    # 2. Create/update user_settings with pseudo_tid
    settings_doc = {
        'telegram_id': pseudo_tid,  # Pseudo TID
        'uid': uid,
        'first_name': 'Test',
        'last_name': 'User',
        'username': 'testuser',
        'group_name': 'НИБ-01-25',
        'group_id': 'test_group_id',
        'facultet_id': 'test_facultet',
        'level_id': 'test_level',
        'kurs': '1',
        'form_code': 'test_form',
        'created_at': datetime.now(timezone.utc),
        'updated_at': datetime.now(timezone.utc),
        'privacy_settings': {
            'show_online_status': True,
            'show_in_search': True,
            'show_friends_list': True,
            'show_achievements': True,
            'show_schedule': True,
        },
        'notifications_enabled': False,
        'notification_time': 10,
    }
    
    result = await db.user_settings.update_one(
        {'telegram_id': pseudo_tid},
        {'$set': settings_doc},
        upsert=True
    )
    print(f"  User_settings collection: {'created' if result.upserted_id else 'updated'}")
    
    # Verify
    user_check = await db.users.find_one({'uid': uid})
    settings_check = await db.user_settings.find_one({'telegram_id': pseudo_tid})
    
    print(f"\n✅ Seed completed successfully!")
    print(f"  User has telegram_id: {user_check.get('telegram_id') is not None}")
    print(f"  User_settings telegram_id: {settings_check.get('telegram_id')}")
    print(f"  User_settings uid: {settings_check.get('uid')}")
    print(f"  User_settings group_name: {settings_check.get('group_name')}")
    
    client.close()

if __name__ == '__main__':
    asyncio.run(main())
