import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import uuid
import os

async def main():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
    db = client['test_database']
    
    # Create user settings for test users
    await db.user_settings.update_one(
        {'telegram_id': 777001}, 
        {'$set': {'telegram_id': 777001, 'first_name': 'Тестов', 'group_name': 'ИВТ-21'}}, 
        upsert=True
    )
    await db.user_settings.update_one(
        {'telegram_id': 777002}, 
        {'$set': {'telegram_id': 777002, 'first_name': 'Иванов', 'group_name': 'ПМИ-22'}}, 
        upsert=True
    )
    await db.user_settings.update_one(
        {'telegram_id': 777003}, 
        {'$set': {'telegram_id': 777003, 'first_name': 'Петров', 'group_name': 'МАТ-23'}}, 
        upsert=True
    )
    
    # Create friendship (bidirectional) 777001 <-> 777002
    for u1, u2 in [(777001, 777002), (777002, 777001)]:
        await db.friends.update_one(
            {'user_telegram_id': u1, 'friend_telegram_id': u2},
            {'$set': {
                'user_telegram_id': u1, 
                'friend_telegram_id': u2, 
                'id': str(uuid.uuid4()), 
                'created_at': datetime.utcnow()
            }},
            upsert=True
        )
    
    # 777003 is NOT a friend of 777001 — no entry
    
    # Clean up old shared schedules
    await db.shared_schedules.delete_many({'owner_id': {'$in': [777001, 777002, 777003]}})
    
    # Verify
    f_count = await db.friends.count_documents({'user_telegram_id': 777001, 'friend_telegram_id': 777002})
    print(f'Friends 777001 <-> 777002: {f_count > 0}')
    
    nf_count = await db.friends.count_documents({'user_telegram_id': 777001, 'friend_telegram_id': 777003})
    print(f'Friends 777001 <-> 777003: {nf_count > 0}')

asyncio.run(main())
