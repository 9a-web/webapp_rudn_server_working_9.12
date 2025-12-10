import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import uuid

# Configuration
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

async def reproduce():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print(f"Connecting to {DB_NAME}...")
    
    # 1. Setup Data
    owner_id = 123456789
    journal_id = str(uuid.uuid4())
    student_id = str(uuid.uuid4())
    
    # Create Journal
    await db.attendance_journals.insert_one({
        "journal_id": journal_id,
        "name": "Stats Test Journal",
        "group_name": "Test Group",
        "owner_id": owner_id,
        "created_at": datetime.utcnow(),
        "stats_viewers": []
    })
    
    # Create Student (Created NOW)
    now = datetime.utcnow()
    await db.journal_students.insert_one({
        "id": student_id,
        "journal_id": journal_id,
        "full_name": "Test Student",
        "created_at": now,
        "order": 0
    })
    
    # Create Session 1 (TODAY - Valid)
    session1_id = str(uuid.uuid4())
    await db.journal_sessions.insert_one({
        "session_id": session1_id,
        "journal_id": journal_id,
        "date": now.strftime("%Y-%m-%d"),
        "title": "Session 1",
        "created_at": now,
        "created_by": owner_id
    })
    
    # Create Session 2 (YESTERDAY - Before student created? Check logic)
    # If student created NOW, yesterday is BEFORE created_at.
    # Logic: sess["date"] >= s_created_date_str
    # If created_at = 2025-07-15 10:00:00. s_created_date_str = "2025-07-15".
    # Session yesterday = "2025-07-14".
    # "2025-07-14" >= "2025-07-15" -> FALSE.
    # So Session 2 should be EXCLUDED.
    yesterday = now - timedelta(days=1)
    session2_id = str(uuid.uuid4())
    await db.journal_sessions.insert_one({
        "session_id": session2_id,
        "journal_id": journal_id,
        "date": yesterday.strftime("%Y-%m-%d"),
        "title": "Session 2 (Old)",
        "created_at": yesterday,
        "created_by": owner_id
    })
    
    # Mark Session 1 as PRESENT
    await db.attendance_records.insert_one({
        "id": str(uuid.uuid4()),
        "journal_id": journal_id,
        "session_id": session1_id,
        "student_id": student_id,
        "status": "present",
        "marked_by": owner_id,
        "marked_at": now
    })
    
    # Session 2 is UNMARKED.
    
    print("Data prepared. Calculating stats...")
    
    # --- SIMULATE SERVER LOGIC ---
    students = [await db.journal_students.find_one({"id": student_id})]
    sessions = await db.journal_sessions.find({"journal_id": journal_id}).to_list(None)
    
    pipeline = [
        {"$match": {"journal_id": journal_id}},
        {"$group": {
            "_id": "$student_id",
            "present": {"$sum": {"$cond": [{"$in": ["$status", ["present"]]}, 1, 0]}},
            "late": {"$sum": {"$cond": [{"$eq": ["$status", "late"]}, 1, 0]}},
            "absent": {"$sum": {"$cond": [{"$eq": ["$status", "absent"]}, 1, 0]}},
            "excused": {"$sum": {"$cond": [{"$eq": ["$status", "excused"]}, 1, 0]}},
        }}
    ]
    att_data = await db.attendance_records.aggregate(pipeline).to_list(None)
    att_map = {item["_id"]: item for item in att_data}
    
    for s in students:
        stats = att_map.get(s["id"], {"present": 0, "late": 0, "absent": 0, "excused": 0})
        print(f"Raw DB Stats: {stats}")
        
        student_created_at = s.get("created_at")
        s_created_date_str = student_created_at.strftime("%Y-%m-%d")
        print(f"Student Created: {s_created_date_str}")
        
        valid_sessions_count = 0
        for sess in sessions:
            print(f"Checking Session: {sess['date']} >= {s_created_date_str} ? {sess['date'] >= s_created_date_str}")
            if sess["date"] >= s_created_date_str:
                valid_sessions_count += 1
                
        print(f"Valid Sessions Count: {valid_sessions_count}")
        
        effective_sessions = valid_sessions_count - stats["excused"]
        numerator = stats["present"] + stats["late"]
        
        if effective_sessions > 0:
            att_percent = round((numerator / effective_sessions) * 100, 1)
        else:
            att_percent = 0
            
        implicit_absent = effective_sessions - numerator
        
        print(f"--- RESULT ---")
        print(f"Attendance Percent: {att_percent}%")
        print(f"Present: {numerator}")
        print(f"Absent (Implicit): {implicit_absent}")
        print(f"Total Valid Sessions: {valid_sessions_count}")

    # Cleanup
    await db.attendance_journals.delete_one({"journal_id": journal_id})
    await db.journal_students.delete_one({"id": student_id})
    await db.journal_sessions.delete_many({"journal_id": journal_id})
    await db.attendance_records.delete_many({"journal_id": journal_id})

if __name__ == "__main__":
    asyncio.run(reproduce())
