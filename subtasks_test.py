#!/usr/bin/env python3
"""
Specific test for subtasks API as requested by user:
1. Create task with telegram_id: 123456789
2. Add subtask with title "Тестовая подзадача"
3. Check that task contains the subtask via GET /api/tasks/123456789
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL configuration - using production URL
BACKEND_URL = "https://rudn-schedule.ru"
API_BASE = f"{BACKEND_URL}/api"

# Test data as requested
TELEGRAM_ID = 123456789
TASK_TEXT = "Тестовая задача"
SUBTASK_TITLE = "Тестовая подзадача"

class SubtasksAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.task_id = None
        
    def log(self, message, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def test_create_task(self):
        """1. Создать задачу через POST /api/tasks с telegram_id: 123456789"""
        self.log("🔄 Тест 1: Создание задачи через POST /api/tasks")
        
        url = f"{API_BASE}/tasks"
        payload = {
            "telegram_id": TELEGRAM_ID,
            "text": TASK_TEXT
        }
        
        try:
            response = self.session.post(url, json=payload, timeout=15)
            self.log(f"POST {url}")
            self.log(f"Request: {json.dumps(payload, ensure_ascii=False)}")
            self.log(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.task_id = data.get("id")
                self.log(f"✅ Задача создана успешно. ID: {self.task_id}")
                self.log(f"Response: {json.dumps(data, ensure_ascii=False, indent=2)}")
                return True
            else:
                self.log(f"❌ Ошибка создания задачи: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Исключение при создании задачи: {e}", "ERROR")
            return False
    
    def test_add_subtask(self):
        """2. Добавить подзадачу через POST /api/tasks/{task_id}/subtasks с телом {"title": "Тестовая подзадача"}"""
        if not self.task_id:
            self.log("❌ Нет ID задачи для добавления подзадачи", "ERROR")
            return False
            
        self.log("🔄 Тест 2: Добавление подзадачи через POST /api/tasks/{task_id}/subtasks")
        
        url = f"{API_BASE}/tasks/{self.task_id}/subtasks"
        payload = {
            "title": SUBTASK_TITLE
        }
        
        try:
            response = self.session.post(url, json=payload, timeout=15)
            self.log(f"POST {url}")
            self.log(f"Request: {json.dumps(payload, ensure_ascii=False)}")
            self.log(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                subtasks = data.get("subtasks", [])
                
                self.log(f"✅ Подзадача добавлена успешно")
                self.log(f"Количество подзадач: {len(subtasks)}")
                
                # Проверяем что подзадача добавилась
                if subtasks and any(s.get("title") == SUBTASK_TITLE for s in subtasks):
                    self.log(f"✅ Подзадача '{SUBTASK_TITLE}' найдена в ответе")
                else:
                    self.log(f"❌ Подзадача '{SUBTASK_TITLE}' не найдена в ответе", "ERROR")
                
                self.log(f"Response: {json.dumps(data, ensure_ascii=False, indent=2)}")
                return True
            else:
                self.log(f"❌ Ошибка добавления подзадачи: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Исключение при добавлении подзадачи: {e}", "ERROR")
            return False
    
    def test_get_tasks_with_subtask(self):
        """3. Проверить что задача содержит подзадачу через GET /api/tasks/123456789"""
        self.log("🔄 Тест 3: Проверка задачи через GET /api/tasks/123456789")
        
        url = f"{API_BASE}/tasks/{TELEGRAM_ID}"
        
        try:
            response = self.session.get(url, timeout=15)
            self.log(f"GET {url}")
            self.log(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Ищем нашу тестовую задачу
                test_task = None
                for task in data:
                    if task.get("id") == self.task_id:
                        test_task = task
                        break
                
                if test_task:
                    subtasks = test_task.get("subtasks", [])
                    self.log(f"✅ Тестовая задача найдена")
                    self.log(f"Количество подзадач: {len(subtasks)}")
                    
                    # Проверяем наличие нашей подзадачи
                    found_subtask = None
                    for subtask in subtasks:
                        if subtask.get("title") == SUBTASK_TITLE:
                            found_subtask = subtask
                            break
                    
                    if found_subtask:
                        self.log(f"✅ Подзадача '{SUBTASK_TITLE}' найдена в задаче")
                        self.log(f"Подзадача: {json.dumps(found_subtask, ensure_ascii=False, indent=2)}")
                        return True
                    else:
                        self.log(f"❌ Подзадача '{SUBTASK_TITLE}' НЕ найдена в задаче", "ERROR")
                        self.log(f"Доступные подзадачи: {[s.get('title') for s in subtasks]}")
                        return False
                else:
                    self.log("❌ Тестовая задача не найдена в списке", "ERROR")
                    self.log(f"Найдено задач: {len(data)}")
                    return False
            else:
                self.log(f"❌ Ошибка получения задач: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Исключение при получении задач: {e}", "ERROR")
            return False
    
    def test_cleanup(self):
        """Удалить тестовую задачу (cleanup)"""
        if not self.task_id:
            self.log("❌ Нет ID задачи для удаления", "ERROR")
            return False
            
        self.log("🔄 Cleanup: Удаление тестовой задачи")
        
        url = f"{API_BASE}/tasks/{self.task_id}"
        
        try:
            response = self.session.delete(url, timeout=15)
            self.log(f"DELETE {url}")
            self.log(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                self.log(f"✅ Тестовая задача удалена")
                return True
            else:
                self.log(f"❌ Ошибка удаления задачи: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Исключение при удалении задачи: {e}", "ERROR")
            return False
    
    def run_test_scenario(self):
        """Запустить точный сценарий тестирования как запросил пользователь"""
        self.log("🚀 Тестирование API для подзадач (subtasks) личных задач")
        self.log(f"Backend URL: {BACKEND_URL}")
        self.log(f"Test User ID: {TELEGRAM_ID}")
        self.log(f"Задача: '{TASK_TEXT}'")
        self.log(f"Подзадача: '{SUBTASK_TITLE}'")
        
        tests = [
            ("1. Создание задачи через POST /api/tasks", self.test_create_task),
            ("2. Добавление подзадачи через POST /api/tasks/{task_id}/subtasks", self.test_add_subtask),
            ("3. Проверка задачи через GET /api/tasks/123456789", self.test_get_tasks_with_subtask),
            ("Cleanup - удаление задачи", self.test_cleanup)
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            self.log(f"\n{'='*80}")
            try:
                if test_func():
                    passed += 1
                    self.log(f"✅ {test_name} - PASSED")
                else:
                    failed += 1
                    self.log(f"❌ {test_name} - FAILED")
            except Exception as e:
                failed += 1
                self.log(f"❌ {test_name} - EXCEPTION: {e}", "ERROR")
        
        self.log(f"\n{'='*80}")
        self.log(f"🏁 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ:")
        self.log(f"✅ Пройдено: {passed}")
        self.log(f"❌ Провалено: {failed}")
        self.log(f"📊 Общий результат: {passed}/{len(tests)} тестов")
        
        if failed == 0:
            self.log("🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!")
            return True
        else:
            self.log("⚠️ ЕСТЬ ПРОВАЛЕННЫЕ ТЕСТЫ!")
            return False

if __name__ == "__main__":
    tester = SubtasksAPITester()
    success = tester.run_test_scenario()
    sys.exit(0 if success else 1)