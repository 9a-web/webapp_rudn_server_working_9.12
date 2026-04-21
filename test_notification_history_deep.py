import asyncio
import httpx
import os
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
import sys
from dotenv import load_dotenv
from pathlib import Path

# Load env
ROOT_DIR = Path("/app")
load_dotenv(ROOT_DIR / 'backend' / '.env')

# Configuration
BASE_URL = "http://localhost:8001/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "rudn_schedule")

print(f"DEBUG: Using DB_NAME={DB_NAME}")

TEST_TELEGRAM_ID = 123456789

async def setup_test_data():
    print(f"Connecting to MongoDB at {MONGO_URL}...")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # 1. Clear existing history for test user
    print(f"Clearing history for user {TEST_TELEGRAM_ID}...")
    await db.notification_history.delete_many({"telegram_id": TEST_TELEGRAM_ID})
    
    # 2. Insert 25 items
    print("Inserting 25 mock history items...")
    items = []
    base_time = datetime.utcnow()
    
    for i in range(25):
        # Create items with different times (newest first)
        sent_at = base_time - timedelta(minutes=i*10)
        item = {
            "id": str(uuid.uuid4()),
            "telegram_id": TEST_TELEGRAM_ID,
            "title": f"Test Notification {i+1}",
            "message": f"This is message number {i+1}",
            "sent_at": sent_at,
            "read": False
        }
        items.append(item)
    
    await db.notification_history.insert_many(items)
    print("Test data inserted.")
    client.close()

async def test_api():
    async with httpx.AsyncClient(timeout=10.0) as client:
        print("\nTesting GET /history endpoint...")
        
        # Test 1: Page 1 (limit=10, offset=0)
        print("1. Testing Page 1 (limit=10, offset=0)...")
        resp = await client.get(f"{BASE_URL}/user-settings/{TEST_TELEGRAM_ID}/history?limit=10&offset=0")
        
        if resp.status_code != 200:
            print(f"FAILED: Status code {resp.status_code}")
            print(resp.text)
            return False
            
        data = resp.json()
        history = data.get("history", [])
        count = data.get("count", 0)
        
        print(f"   Received {len(history)} items. Total count: {count}")
        
        if len(history) != 10:
            print(f"   FAILED: Expected 10 items, got {len(history)}")
            return False
            
        if count != 25:
            print(f"   FAILED: Expected count 25, got {count}")
            return False
            
        first_title = history[0]["title"]
        print(f"   First item title: {first_title}")
        if first_title != "Test Notification 1":
            print(f"   FAILED: Expected 'Test Notification 1', got '{first_title}'")
            return False
            
        print("   ✅ Page 1 Passed")
        
        # Test 2: Page 2 (limit=10, offset=10)
        print("\n2. Testing Page 2 (limit=10, offset=10)...")
        resp = await client.get(f"{BASE_URL}/user-settings/{TEST_TELEGRAM_ID}/history?limit=10&offset=10")
        data = resp.json()
        history = data.get("history", [])
        
        print(f"   Received {len(history)} items.")
        
        if len(history) != 10:
            print(f"   FAILED: Expected 10 items, got {len(history)}")
            return False
            
        first_title = history[0]["title"]
        print(f"   First item title: {first_title}")
        if first_title != "Test Notification 11":
            print(f"   FAILED: Expected 'Test Notification 11', got '{first_title}'")
            return False

        print("   ✅ Page 2 Passed")
        
        # Test 3: Page 3 (limit=10, offset=20) - Should have 5 items
        print("\n3. Testing Page 3 (limit=10, offset=20)...")
        resp = await client.get(f"{BASE_URL}/user-settings/{TEST_TELEGRAM_ID}/history?limit=10&offset=20")
        data = resp.json()
        history = data.get("history", [])
        
        print(f"   Received {len(history)} items.")
        
        if len(history) != 5:
            print(f"   FAILED: Expected 5 items, got {len(history)}")
            return False
            
        print("   ✅ Page 3 Passed")

        return True

async def main():
    try:
        await setup_test_data()
        success = await test_api()
        if success:
            print("\n🎉 ALL BACKEND TESTS PASSED!")
            sys.exit(0)
        else:
            print("\n❌ BACKEND TESTS FAILED")
            sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
