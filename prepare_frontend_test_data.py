import asyncio
import os
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
from dotenv import load_dotenv
from pathlib import Path

# Load env
ROOT_DIR = Path("/app")
load_dotenv(ROOT_DIR / 'backend' / '.env')

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "rudn_schedule")
TEST_TELEGRAM_ID = 999888777 # The ID used by TelegramContext mock

async def setup_data():
    print(f"Connecting to MongoDB at {MONGO_URL} (DB: {DB_NAME})...")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # 1. Clear existing history
    print(f"Clearing history for user {TEST_TELEGRAM_ID}...")
    await db.notification_history.delete_many({"telegram_id": TEST_TELEGRAM_ID})
    
    # 2. Insert items
    print("Inserting 5 mock history items for frontend test...")
    items = []
    base_time = datetime.utcnow()
    
    for i in range(5):
        sent_at = base_time - timedelta(minutes=i*10)
        item = {
            "id": str(uuid.uuid4()),
            "telegram_id": TEST_TELEGRAM_ID,
            "title": f"Frontend Test Notification {i+1}",
            "message": f"Message {i+1} for UI testing",
            "sent_at": sent_at,
            "read": False
        }
        items.append(item)
    
    await db.notification_history.insert_many(items)
    print("Frontend test data inserted.")
    client.close()

if __name__ == "__main__":
    asyncio.run(setup_data())
