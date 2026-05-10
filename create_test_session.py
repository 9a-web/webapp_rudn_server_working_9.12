"""
Create auth session for Email-only test user
"""
import asyncio
import os
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime, timezone, timedelta

load_dotenv('/app/backend/.env')

async def main():
    """Create auth session for test user"""
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    uid = '197964944'
    jti = str(uuid.uuid4())
    
    print(f"Creating auth session for UID: {uid}")
    print(f"JTI: {jti}")
    
    session_doc = {
        'jti': jti,
        'uid': uid,
        'provider': 'email',
        'created_at': datetime.now(timezone.utc),
        'last_active_at': datetime.now(timezone.utc),
        'expires_at': datetime.now(timezone.utc) + timedelta(days=30),
        'ip': '127.0.0.1',
        'user_agent': 'test-agent',
        'device_label': 'Test Device',
        'revoked': False,
    }
    
    result = await db.auth_sessions.update_one(
        {'jti': jti},
        {'$set': session_doc},
        upsert=True
    )
    
    print(f"✅ Session created: {jti}")
    print(f"\nUse this JTI in your JWT token for testing")
    
    client.close()

if __name__ == '__main__':
    asyncio.run(main())
