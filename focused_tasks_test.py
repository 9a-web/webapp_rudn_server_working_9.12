#!/usr/bin/env python3
"""
Focused Backend API Testing for Basic Tasks API
Testing the specific endpoints requested by user:
1. GET /api/tasks/{telegram_id} - Get user's task list
2. POST /api/tasks - Create task
3. DELETE /api/tasks/{task_id} - Delete task

Using telegram_id = 12345 as requested
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL configuration - using production URL as per environment
BACKEND_URL = "https://rudn-schedule.ru"
API_BASE = f"{BACKEND_URL}/api"

# Test data as requested by user
TELEGRAM_ID = 12345
TASK_TEXT = "Test task"

class FocusedTasksAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.task_id = None
        
    def log(self, message, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def test_get_tasks_initial(self):
        """1. GET /api/tasks/{telegram_id} - Get initial task list"""
        self.log("🔄 Тест 1: Получение списка задач пользователя (начальное состояние)")
        
        url = f"{API_BASE}/tasks/{TELEGRAM_ID}"
        
        try:
            response = self.session.get(url, timeout=10)
            self.log(f"GET {url}")
            self.log(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Список задач получен успешно")
                self.log(f"Количество задач: {len(data)}")
                self.log(f"Response: {json.dumps(data, ensure_ascii=False, indent=2)}")
                return True
            else:
                self.log(f"❌ Ошибка получения списка задач: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Исключение при получении списка задач: {e}", "ERROR")
            return False
    
    def test_create_task(self):
        """2. POST /api/tasks - Create task with specified data"""
        self.log("🔄 Тест 2: Создание задачи")
        
        url = f"{API_BASE}/tasks"
        payload = {
            "telegram_id": TELEGRAM_ID,
            "text": TASK_TEXT
        }
        
        try:
            response = self.session.post(url, json=payload, timeout=10)
            self.log(f"POST {url}")
            self.log(f"Request: {json.dumps(payload, ensure_ascii=False)}")
            self.log(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.task_id = data.get("id")
                self.log(f"✅ Задача создана успешно. ID: {self.task_id}")
                self.log(f"Text: {data.get('text')}")
                self.log(f"Telegram ID: {data.get('telegram_id')}")
                self.log(f"Response: {json.dumps(data, ensure_ascii=False, indent=2)}")
                
                # Validate response structure
                if data.get("telegram_id") == TELEGRAM_ID and data.get("text") == TASK_TEXT:
                    self.log("✅ Данные задачи корректны")
                else:
                    self.log("⚠️ Данные задачи не соответствуют ожидаемым", "WARNING")
                
                return True
            else:
                self.log(f"❌ Ошибка создания задачи: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Исключение при создании задачи: {e}", "ERROR")
            return False
    
    def test_get_tasks_after_create(self):
        """3. GET /api/tasks/{telegram_id} - Verify task appears in list"""
        self.log("🔄 Тест 3: Проверка что созданная задача появилась в списке")
        
        url = f"{API_BASE}/tasks/{TELEGRAM_ID}"
        
        try:
            response = self.session.get(url, timeout=10)
            self.log(f"GET {url}")
            self.log(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Список задач получен")
                self.log(f"Количество задач: {len(data)}")
                
                # Find our created task
                created_task = None
                for task in data:
                    if task.get("id") == self.task_id:
                        created_task = task
                        break
                
                if created_task:
                    self.log(f"✅ Созданная задача найдена в списке")
                    self.log(f"Task ID: {created_task.get('id')}")
                    self.log(f"Text: {created_task.get('text')}")
                    self.log(f"Telegram ID: {created_task.get('telegram_id')}")
                    return True
                else:
                    self.log(f"❌ Созданная задача не найдена в списке", "ERROR")
                    self.log(f"Response: {json.dumps(data, ensure_ascii=False, indent=2)}")
                    return False
            else:
                self.log(f"❌ Ошибка получения списка задач: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Исключение при получении списка задач: {e}", "ERROR")
            return False
    
    def test_delete_task(self):
        """4. DELETE /api/tasks/{task_id} - Delete the created task"""
        if not self.task_id:
            self.log("❌ Нет ID задачи для удаления", "ERROR")
            return False
            
        self.log("🔄 Тест 4: Удаление созданной задачи")
        
        url = f"{API_BASE}/tasks/{self.task_id}"
        
        try:
            response = self.session.delete(url, timeout=10)
            self.log(f"DELETE {url}")
            self.log(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Задача удалена успешно")
                self.log(f"Response: {json.dumps(data, ensure_ascii=False, indent=2)}")
                return True
            else:
                self.log(f"❌ Ошибка удаления задачи: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Исключение при удалении задачи: {e}", "ERROR")
            return False
    
    def test_get_tasks_after_delete(self):
        """5. GET /api/tasks/{telegram_id} - Verify task is removed from list"""
        self.log("🔄 Тест 5: Проверка что задача удалена из списка")
        
        url = f"{API_BASE}/tasks/{TELEGRAM_ID}"
        
        try:
            response = self.session.get(url, timeout=10)
            self.log(f"GET {url}")
            self.log(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Список задач получен")
                self.log(f"Количество задач: {len(data)}")
                
                # Check that our task is no longer in the list
                deleted_task_found = False
                for task in data:
                    if task.get("id") == self.task_id:
                        deleted_task_found = True
                        break
                
                if not deleted_task_found:
                    self.log(f"✅ Задача успешно удалена из списка")
                    return True
                else:
                    self.log(f"❌ Удаленная задача все еще присутствует в списке", "ERROR")
                    self.log(f"Response: {json.dumps(data, ensure_ascii=False, indent=2)}")
                    return False
            else:
                self.log(f"❌ Ошибка получения списка задач: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Исключение при получении списка задач: {e}", "ERROR")
            return False
    
    def run_focused_tests(self):
        """Запустить фокусированные тесты для основных API задач"""
        self.log("🚀 Начинаем фокусированное тестирование Tasks API")
        self.log(f"Backend URL: {BACKEND_URL}")
        self.log(f"Test User ID: {TELEGRAM_ID}")
        self.log(f"Test Task Text: '{TASK_TEXT}'")
        
        tests = [
            ("GET /api/tasks/{telegram_id} - Начальный список", self.test_get_tasks_initial),
            ("POST /api/tasks - Создание задачи", self.test_create_task),
            ("GET /api/tasks/{telegram_id} - Проверка создания", self.test_get_tasks_after_create),
            ("DELETE /api/tasks/{task_id} - Удаление задачи", self.test_delete_task),
            ("GET /api/tasks/{telegram_id} - Проверка удаления", self.test_get_tasks_after_delete)
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            self.log(f"\n{'='*70}")
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
        
        self.log(f"\n{'='*70}")
        self.log(f"🏁 РЕЗУЛЬТАТЫ ФОКУСИРОВАННОГО ТЕСТИРОВАНИЯ:")
        self.log(f"✅ Пройдено: {passed}")
        self.log(f"❌ Провалено: {failed}")
        self.log(f"📊 Общий результат: {passed}/{len(tests)} тестов")
        
        if failed == 0:
            self.log("🎉 ВСЕ ФОКУСИРОВАННЫЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!")
            return True
        else:
            self.log("⚠️ ЕСТЬ ПРОВАЛЕННЫЕ ТЕСТЫ!")
            return False

if __name__ == "__main__":
    tester = FocusedTasksAPITester()
    success = tester.run_focused_tests()
    sys.exit(0 if success else 1)