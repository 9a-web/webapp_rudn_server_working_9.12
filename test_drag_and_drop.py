#!/usr/bin/env python3
"""
Тест drag & drop функционала для задач
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8001/api"
TEST_TELEGRAM_ID = 999999999

def test_reorder_endpoint():
    """Тест endpoint /tasks/reorder"""
    print("\n" + "="*60)
    print("🧪 ТЕСТ DRAG & DROP ЗАДАЧ")
    print("="*60)
    
    # 1. Получаем текущие задачи
    print("\n📥 Шаг 1: Получаем существующие задачи...")
    response = requests.get(f"{BASE_URL}/tasks/{TEST_TELEGRAM_ID}")
    
    if response.status_code == 200:
        tasks = response.json()
        print(f"✅ Получено задач: {len(tasks)}")
        
        if len(tasks) == 0:
            print("\n⚠️  Нет задач для тестирования. Создаём тестовые задачи...")
            
            # Создаём 3 тестовые задачи
            test_tasks = [
                {"text": "Задача 1 - Первая", "priority": "high"},
                {"text": "Задача 2 - Вторая", "priority": "medium"},
                {"text": "Задача 3 - Третья", "priority": "low"}
            ]
            
            created_tasks = []
            for task_data in test_tasks:
                task_payload = {
                    "telegram_id": TEST_TELEGRAM_ID,
                    "text": task_data["text"],
                    "priority": task_data["priority"],
                    "completed": False
                }
                
                response = requests.post(f"{BASE_URL}/tasks", json=task_payload)
                if response.status_code == 200:
                    created_task = response.json()
                    created_tasks.append(created_task)
                    print(f"  ✅ Создана: {created_task['text']} (order: {created_task.get('order', 'N/A')})")
            
            tasks = created_tasks
        
        print(f"\n📋 Текущий порядок задач:")
        for i, task in enumerate(tasks):
            print(f"  {i+1}. {task['text']} (id: {task['id']}, order: {task.get('order', 'N/A')})")
        
        # 2. Проверяем, есть ли минимум 2 задачи
        if len(tasks) < 2:
            print("\n❌ Недостаточно задач для теста перестановки (нужно минимум 2)")
            return
        
        # 3. Меняем порядок: переворачиваем список
        print(f"\n🔄 Шаг 2: Меняем порядок задач (переворачиваем список)...")
        
        reversed_tasks = list(reversed(tasks))
        task_orders = [
            {"id": task["id"], "order": index}
            for index, task in enumerate(reversed_tasks)
        ]
        
        print(f"📤 Отправляем новый порядок:")
        for item in task_orders:
            task_text = next(t['text'] for t in tasks if t['id'] == item['id'])
            print(f"  order {item['order']}: {task_text}")
        
        # 4. Отправляем запрос на изменение порядка
        response = requests.put(f"{BASE_URL}/tasks/reorder", json={"tasks": task_orders})
        
        if response.status_code == 200:
            result = response.json()
            print(f"\n✅ Успешно: {result.get('message')}")
        else:
            print(f"\n❌ Ошибка {response.status_code}: {response.text}")
            return
        
        # 5. Проверяем новый порядок
        print(f"\n📥 Шаг 3: Проверяем, сохранился ли новый порядок...")
        response = requests.get(f"{BASE_URL}/tasks/{TEST_TELEGRAM_ID}")
        
        if response.status_code == 200:
            updated_tasks = response.json()
            print(f"✅ Получено задач: {len(updated_tasks)}")
            
            print(f"\n📋 Новый порядок задач:")
            for i, task in enumerate(updated_tasks):
                print(f"  {i+1}. {task['text']} (id: {task['id']}, order: {task.get('order', 'N/A')})")
            
            # 6. Проверяем, что порядок изменился
            print(f"\n🔍 Шаг 4: Проверяем корректность изменений...")
            
            success = True
            for expected_order, task_order_item in enumerate(task_orders):
                task_id = task_order_item["id"]
                expected_order_value = task_order_item["order"]
                
                # Находим задачу в обновлённом списке
                updated_task = next((t for t in updated_tasks if t['id'] == task_id), None)
                
                if updated_task:
                    actual_order = updated_task.get('order', None)
                    if actual_order == expected_order_value:
                        print(f"  ✅ Задача '{updated_task['text']}': order = {actual_order} (ожидалось: {expected_order_value})")
                    else:
                        print(f"  ❌ Задача '{updated_task['text']}': order = {actual_order} (ожидалось: {expected_order_value})")
                        success = False
                else:
                    print(f"  ❌ Задача с id={task_id} не найдена!")
                    success = False
            
            if success:
                print(f"\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Drag & drop работает корректно!")
            else:
                print(f"\n❌ ТЕСТЫ НЕ ПРОЙДЕНЫ! Есть проблемы с сохранением порядка.")
        else:
            print(f"❌ Ошибка при получении обновлённых задач: {response.status_code}")
    else:
        print(f"❌ Ошибка при получении задач: {response.status_code}")

if __name__ == "__main__":
    try:
        test_reorder_endpoint()
    except Exception as e:
        print(f"\n❌ Ошибка выполнения теста: {e}")
        import traceback
        traceback.print_exc()
