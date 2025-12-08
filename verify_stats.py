import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import httpx

MONGO_URL = "mongodb://localhost:27017/rudn_schedule"

async def verify():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.rudn_schedule
    
    # 1. Get Journal ID
    journal = await db.attendance_journals.find_one({"name": "Математический анализ"})
    if not journal:
        print("❌ Journal not found!")
        return
        
    j_id = journal["journal_id"]
    print(f"Journal ID: {j_id}")
    
    # 2. Call API (Simulate via direct DB or http if server running)
    # We will use the same logic/code flow or just call the URL if we knew the port mapping inside container
    # Since we are inside, localhost:8001 should work
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"http://localhost:8001/api/journals/{j_id}/stats")
            if resp.status_code != 200:
                print(f"❌ API Error: {resp.status_code} {resp.text}")
                return
                
            data = resp.json()
            print("\n📊 --- STATS VERIFICATION --- 📊")
            print(f"Overall Attendance: {data['overall_attendance_percent']}%")
            print("-" * 40)
            print(f"{'Name':<25} | {'%':<5} | {'Pres':<4} | {'Abs':<4} | {'Exc':<4} | {'Tot':<4}")
            print("-" * 40)
            
            for s in data['students_stats']:
                print(f"{s['full_name']:<25} | {s['attendance_percent']}%   | {s['present_count']:<4} | {s['absent_count']:<4} | {s['excused_count']:<4} | {s['total_sessions']:<4}")
                
            print("-" * 40)
            
        except Exception as e:
            print(f"❌ Request failed: {e}")

if __name__ == "__main__":
    asyncio.run(verify())
