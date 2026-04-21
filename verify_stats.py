import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import httpx
import sys

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"

async def verify():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # 1. Check server health
    print("🏥 Checking API health...")
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get("http://localhost:8001/api/status")
            print(f"Health check: {resp.status_code}")
        except Exception as e:
            print(f"Health check failed: {e}")
            
    # 2. Get Journal ID
    journal = await db.attendance_journals.find_one({"name": "Математический анализ"})
    if not journal:
        print("❌ Journal not found in DB!")
        return
        
    j_id = journal["journal_id"]
    print(f"Journal ID in DB: {j_id}")
    
    # 3. Call API
    url = f"http://localhost:8001/api/journals/{j_id}/stats"
    print(f"Fetching: {url}")
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url)
            if resp.status_code != 200:
                print(f"❌ API Error: {resp.status_code}")
                print(f"Response: {resp.text}")
                return
                
            data = resp.json()
            print("\n📊 --- STATS VERIFICATION --- 📊")
            print(f"Overall Attendance: {data['overall_attendance_percent']}%")
            print("-" * 75)
            print(f"{'Name':<25} | {'%':<5} | {'Pres':<4} | {'Abs':<4} | {'Exc':<4} | {'Tot':<4}")
            print("-" * 75)
            
            for s in data['students_stats']:
                print(f"{s['full_name']:<25} | {s['attendance_percent']}%   | {s['present_count']:<4} | {s['absent_count']:<4} | {s['excused_count']:<4} | {s['total_sessions']:<4}")
                
            print("-" * 75)
            
        except Exception as e:
            print(f"❌ Request failed: {e}")

if __name__ == "__main__":
    asyncio.run(verify())
