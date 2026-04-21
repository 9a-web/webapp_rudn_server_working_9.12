#!/usr/bin/env python3
"""
Скрипт для создания тестовых данных в MongoDB
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import uuid
import random

# Correct DB settings matching backend/.env
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"

async def create_test_data():
    """Создать тестовые данные"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print(f"🚀 Создание тестовых данных в {DB_NAME}...")
    
    # Очистка для чистого теста (опционально раскомментировать)
    # await db.user_settings.delete_many({})
    # await db.attendance_journals.delete_many({})
    # await db.journal_students.delete_many({})
    # await db.journal_sessions.delete_many({})
    # await db.attendance_records.delete_many({})
    
    # Тестовые факультеты и группы
    faculties = [
        {"id": "1", "name": "Инженерная академия"},
        {"id": "2", "name": "Экономический факультет"},
        {"id": "3", "name": "Юридический институт"},
    ]
    
    groups = ["НМб-21-1-о", "ЭБ-21-1-о", "ЮМ-21-1-о"]
    
    # Создаём 5 тестовых пользователей
    base_date = datetime.utcnow()
    users_count = 5
    telegram_ids = []
    
    for i in range(1, users_count + 1):
        telegram_id = 100000 + i
        telegram_ids.append(telegram_id)
        
        # Проверяем, есть ли юзер
        existing = await db.user_settings.find_one({"telegram_id": telegram_id})
        if not existing:
            user_settings = {
                "id": str(uuid.uuid4()),
                "telegram_id": telegram_id,
                "username": f"test_user_{i}",
                "first_name": f"Студент {i}",
                "last_name": f"Тестовый",
                "group_id": "group_1",
                "group_name": groups[0],
                "facultet_id": "1",
                "facultet_name": faculties[0]["name"],
                "level_id": "1",
                "kurs": "3",
                "form_code": "1",
                "created_at": base_date,
                "updated_at": base_date
            }
            await db.user_settings.insert_one(user_settings)
            print(f"✅ Создан пользователь {telegram_id}")

    # === СОЗДАНИЕ ЖУРНАЛА ===
    owner_id = telegram_ids[0] # Первый юзер - староста
    journal_id = str(uuid.uuid4())
    
    journal = {
        "journal_id": journal_id,
        "name": "Математический анализ",
        "group_name": groups[0],
        "description": "Осенний семестр 2025",
        "owner_id": owner_id,
        "color": "purple",
        "invite_token": str(uuid.uuid4())[:12],
        "settings": {
            "allow_self_mark": False,
            "show_group_stats": True,
            "absence_reasons": ["Болезнь", "Уважительная", "Работа"]
        },
        "created_at": base_date,
        "updated_at": base_date
    }
    
    await db.attendance_journals.insert_one(journal)
    print(f"✅ Создан журнал: {journal['name']}")
    
    # === СОЗДАНИЕ СТУДЕНТОВ В ЖУРНАЛЕ ===
    students_ids = []
    
    # 1. Староста (привязан)
    s1_id = str(uuid.uuid4())
    await db.journal_students.insert_one({
        "id": s1_id,
        "journal_id": journal_id,
        "full_name": "Студент 1 (Староста)",
        "telegram_id": telegram_ids[0],
        "is_linked": True,
        "order": 1,
        "created_at": base_date - timedelta(days=30) # Был с начала
    })
    students_ids.append(s1_id)
    
    # 2. Отличник (привязан)
    s2_id = str(uuid.uuid4())
    await db.journal_students.insert_one({
        "id": s2_id,
        "journal_id": journal_id,
        "full_name": "Студент 2 (Отличник)",
        "telegram_id": telegram_ids[1],
        "is_linked": True,
        "order": 2,
        "created_at": base_date - timedelta(days=30)
    })
    students_ids.append(s2_id)
    
    # 3. Прогульщик (не привязан)
    s3_id = str(uuid.uuid4())
    await db.journal_students.insert_one({
        "id": s3_id,
        "journal_id": journal_id,
        "full_name": "Студент 3 (Прогульщик)",
        "telegram_id": None,
        "is_linked": False,
        "order": 3,
        "created_at": base_date - timedelta(days=30)
    })
    students_ids.append(s3_id)
    
    # 4. "Болеющий" (с уважительными причинами)
    s4_id = str(uuid.uuid4())
    await db.journal_students.insert_one({
        "id": s4_id,
        "journal_id": journal_id,
        "full_name": "Студент 4 (Болеет)",
        "telegram_id": telegram_ids[2],
        "is_linked": True,
        "order": 4,
        "created_at": base_date - timedelta(days=30)
    })
    students_ids.append(s4_id)
    
    # 5. Новичок (пришел недавно)
    s5_id = str(uuid.uuid4())
    await db.journal_students.insert_one({
        "id": s5_id,
        "journal_id": journal_id,
        "full_name": "Студент 5 (Новичок)",
        "telegram_id": telegram_ids[3],
        "is_linked": True,
        "order": 5,
        "created_at": base_date - timedelta(days=2) # Пришел 2 дня назад
    })
    students_ids.append(s5_id)
    
    # === СОЗДАНИЕ ЗАНЯТИЙ И ОТМЕТОК ===
    # Создадим 10 занятий за последние 20 дней (через день)
    
    for i in range(10):
        session_date = base_date - timedelta(days=20 - (i*2))
        session_id = str(uuid.uuid4())
        
        await db.journal_sessions.insert_one({
            "session_id": session_id,
            "journal_id": journal_id,
            "subject_id": "subj_1",
            "date": session_date.strftime("%Y-%m-%d"),
            "title": f"Лекция {i+1}",
            "type": "lecture",
            "created_at": session_date,
            "created_by": owner_id
        })
        
        # Проставляем посещаемость
        
        # Студент 1 (Староста) - всегда был
        await db.attendance_records.insert_one({
            "id": str(uuid.uuid4()),
            "journal_id": journal_id,
            "session_id": session_id,
            "student_id": s1_id,
            "status": "present",
            "marked_by": owner_id,
            "marked_at": base_date
        })
        
        # Студент 2 (Отличник) - иногда опаздывал
        status = "late" if i % 3 == 0 else "present"
        await db.attendance_records.insert_one({
            "id": str(uuid.uuid4()),
            "journal_id": journal_id,
            "session_id": session_id,
            "student_id": s2_id,
            "status": status,
            "marked_by": owner_id,
            "marked_at": base_date
        })
        
        # Студент 3 (Прогульщик) - 50/50
        status = "absent" if i % 2 == 0 else "present"
        await db.attendance_records.insert_one({
            "id": str(uuid.uuid4()),
            "journal_id": journal_id,
            "session_id": session_id,
            "student_id": s3_id,
            "status": status,
            "marked_by": owner_id,
            "marked_at": base_date
        })
        
        # Студент 4 (Болеет) - половина по уважительной
        status = "excused" if i < 5 else "present"
        await db.attendance_records.insert_one({
            "id": str(uuid.uuid4()),
            "journal_id": journal_id,
            "session_id": session_id,
            "student_id": s4_id,
            "status": status,
            "marked_by": owner_id,
            "marked_at": base_date
        })
        
        # Студент 5 (Новичок) - отмечаем ТОЛЬКО если дата занятия >= дата создания студента
        # Он создан 2 дня назад, значит попадет только на последние 1-2 занятия
        student_created = base_date - timedelta(days=2)
        if session_date >= student_created:
            await db.attendance_records.insert_one({
                "id": str(uuid.uuid4()),
                "journal_id": journal_id,
                "session_id": session_id,
                "student_id": s5_id,
                "status": "present",
                "marked_by": owner_id,
                "marked_at": base_date
            })
            
    print("✅ Созданы записи посещаемости")
    print("🏁 Тестовые данные журнала готовы!")
    client.close()

if __name__ == "__main__":
    asyncio.run(create_test_data())