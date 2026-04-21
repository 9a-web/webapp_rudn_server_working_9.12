#!/usr/bin/env python3
"""
Тест создания задачи с target_date на прошедшую дату
"""
import requests
import json
from datetime import datetime, timedelta

API_BASE = "http://localhost:8001/api"
TEST_USER_ID = 999888777

def test_create_task_past_date():
    """Тест создания задачи на прошедшую дату"""
    
    # Дата 3 дня назад
    past_date = datetime.now() - timedelta(days=3)
    past_date = past_date.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Сегодняшняя дата
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Будущая дата (завтра)
    future_date = datetime.now() + timedelta(days=1)
    future_date = future_date.replace(hour=23, minute=59, second=0, microsecond=0)
    
    print("=" * 80)
    print("ТЕСТ: Создание задачи на прошедшую дату")
    print("=" * 80)
    
    # Создаем задачу на прошлую дату (без deadline, только target_date)
    task_data = {
        "telegram_id": TEST_USER_ID,
        "text": f"Задача на прошлую дату ({past_date.strftime('%Y-%m-%d')})",
        "priority": "medium",
        "target_date": past_date.isoformat(),  # Прошлая дата
        "deadline": None  # Без deadline для прошлых дат
    }
    
    print(f"\n1. Создаем задачу с target_date на прошлую дату:")
    print(f"   target_date: {task_data['target_date']}")
    print(f"   deadline: {task_data['deadline']}")
    
    response = requests.post(f"{API_BASE}/tasks", json=task_data)
    
    if response.status_code == 200:
        created_task = response.json()
        print(f"   ✅ Задача создана успешно!")
        print(f"   ID: {created_task['id']}")
        print(f"   target_date: {created_task.get('target_date')}")
        print(f"   deadline: {created_task.get('deadline')}")
    else:
        print(f"   ❌ Ошибка создания: {response.status_code}")
        print(f"   {response.text}")
        return
    
    task_id = created_task['id']
    
    # Получаем все задачи пользователя
    print(f"\n2. Получаем все задачи пользователя {TEST_USER_ID}:")
    response = requests.get(f"{API_BASE}/tasks/{TEST_USER_ID}")
    
    if response.status_code == 200:
        tasks = response.json()
        print(f"   ✅ Получено задач: {len(tasks)}")
        
        # Находим нашу задачу
        our_task = next((t for t in tasks if t['id'] == task_id), None)
        if our_task:
            print(f"\n   Наша задача найдена:")
            print(f"   - text: {our_task['text']}")
            print(f"   - target_date: {our_task.get('target_date')}")
            print(f"   - deadline: {our_task.get('deadline')}")
            
            # Проверяем фильтрацию
            print(f"\n3. Проверяем фильтрацию по датам:")
            
            if our_task.get('target_date'):
                task_date = datetime.fromisoformat(our_task['target_date'].replace('Z', '+00:00'))
                task_date = task_date.replace(hour=0, minute=0, second=0, microsecond=0)
                
                print(f"   target_date (normalized): {task_date.isoformat()}")
                print(f"   past_date (normalized):   {past_date.isoformat()}")
                print(f"   today (normalized):       {today.isoformat()}")
                
                if task_date.date() == past_date.date():
                    print(f"   ✅ target_date соответствует прошлой дате!")
                else:
                    print(f"   ❌ target_date НЕ соответствует прошлой дате!")
                
                if task_date.date() == today.date():
                    print(f"   ❌ ОШИБКА: target_date равен сегодняшнему дню!")
                else:
                    print(f"   ✅ target_date НЕ равен сегодняшнему дню")
        else:
            print(f"   ❌ Задача не найдена в списке!")
    else:
        print(f"   ❌ Ошибка получения задач: {response.status_code}")
    
    # Создаем задачу на будущую дату (с deadline)
    print(f"\n4. Создаем задачу на будущую дату для сравнения:")
    
    future_task_data = {
        "telegram_id": TEST_USER_ID,
        "text": f"Задача на будущую дату ({future_date.strftime('%Y-%m-%d')})",
        "priority": "high",
        "target_date": future_date.replace(hour=0).isoformat(),  # Будущая дата
        "deadline": future_date.isoformat()  # С deadline для будущих дат
    }
    
    print(f"   target_date: {future_task_data['target_date']}")
    print(f"   deadline: {future_task_data['deadline']}")
    
    response = requests.post(f"{API_BASE}/tasks", json=future_task_data)
    
    if response.status_code == 200:
        future_task = response.json()
        print(f"   ✅ Задача на будущую дату создана!")
        print(f"   ID: {future_task['id']}")
        print(f"   target_date: {future_task.get('target_date')}")
        print(f"   deadline: {future_task.get('deadline')}")
    else:
        print(f"   ❌ Ошибка: {response.status_code}")
    
    print("\n" + "=" * 80)
    print("ТЕСТ ЗАВЕРШЕН")
    print("=" * 80)

if __name__ == "__main__":
    test_create_task_past_date()
