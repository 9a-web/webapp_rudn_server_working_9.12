#!/usr/bin/env python3
"""
Focused test for Tasks Subtasks API as requested:
1. POST /api/tasks - создай тестовую задачу с telegram_id=123456789, text="Тестовая задача"
2. POST /api/tasks/{task_id}/subtasks - добавь подзадачу с title="Подзадача 1"  
3. PUT /api/tasks/{task_id}/subtasks/{subtask_id} - переключи completed с false на true
4. DELETE /api/tasks/{task_id} - удали тестовую задачу
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL configuration
BACKEND_URL = "https://rudn-schedule.ru"
API_BASE = f"{BACKEND_URL}/api"

# Test data
TELEGRAM_ID = 123456789
TASK_TEXT = "Тестовая задача"
SUBTASK_TITLE = "Подзадача 1"

class SubtasksAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.task_id = None
        self.subtask_id = None
        
    def log(self, message, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def test_1_create_task(self):
        """1. POST /api/tasks - создать тестовую задачу"""
        self.log("🔄 Тест 1: POST /api/tasks - Создание тестовой задачи")
        
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
                return True
            else:
                self.log(f"❌ Ошибка создания задачи: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Исключение при создании задачи: {e}", "ERROR")
            return False
    
    def test_2_add_subtask(self):
        """2. POST /api/tasks/{task_id}/subtasks - добавить подзадачу"""
        if not self.task_id:
            self.log("❌ Нет ID задачи для добавления подзадачи", "ERROR")
            return False
            
        self.log("🔄 Тест 2: POST /api/tasks/{task_id}/subtasks - Добавление подзадачи")
        
        url = f"{API_BASE}/tasks/{self.task_id}/subtasks"
        payload = {
            "title": SUBTASK_TITLE
        }
        
        try:
            response = self.session.post(url, json=payload, timeout=10)
            self.log(f"POST {url}")
            self.log(f"Request: {json.dumps(payload, ensure_ascii=False)}")
            self.log(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                subtasks = data.get("subtasks", [])
                if subtasks:
                    self.subtask_id = subtasks[0].get("subtask_id")
                    
                self.log(f"✅ Подзадача добавлена. ID: {self.subtask_id}")
                self.log(f"Title: {subtasks[0].get('title') if subtasks else 'N/A'}")
                self.log(f"Completed: {subtasks[0].get('completed') if subtasks else 'N/A'}")
                self.log(f"Subtasks total: {data.get('subtasks_total')}")
                return True
            else:
                self.log(f"❌ Ошибка добавления подзадачи: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Исключение при добавлении подзадачи: {e}", "ERROR")
            return False
    
    def test_3_complete_subtask(self):
        """3. PUT /api/tasks/{task_id}/subtasks/{subtask_id} - переключить completed с false на true"""
        if not self.task_id or not self.subtask_id:
            self.log("❌ Нет ID задачи или подзадачи для выполнения", "ERROR")
            return False
            
        self.log("🔄 Тест 3: PUT /api/tasks/{task_id}/subtasks/{subtask_id} - Переключение completed с false на true")
        
        url = f"{API_BASE}/tasks/{self.task_id}/subtasks/{self.subtask_id}"
        payload = {
            "completed": True
        }
        
        try:
            response = self.session.put(url, json=payload, timeout=10)
            self.log(f"PUT {url}")
            self.log(f"Request: {json.dumps(payload, ensure_ascii=False)}")
            self.log(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                subtasks = data.get("subtasks", [])
                
                # Найдем нашу подзадачу
                our_subtask = None
                for subtask in subtasks:
                    if subtask.get("subtask_id") == self.subtask_id:
                        our_subtask = subtask
                        break
                
                if our_subtask:
                    completed = our_subtask.get("completed")
                    completed_at = our_subtask.get("completed_at")
                    
                    self.log(f"✅ Подзадача обновлена")
                    self.log(f"Completed: {completed}")
                    self.log(f"Completed at: {completed_at}")
                    self.log(f"Progress: {data.get('subtasks_progress')}%")
                    
                    if completed:
                        self.log("✅ Подзадача корректно отмечена как выполненная")
                        return True
                    else:
                        self.log("❌ Подзадача не отмечена как выполненная", "ERROR")
                        return False
                else:
                    self.log("❌ Подзадача не найдена в ответе", "ERROR")
                    return False
            else:
                self.log(f"❌ Ошибка обновления подзадачи: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Исключение при обновлении подзадачи: {e}", "ERROR")
            return False
    
    def test_4_delete_task(self):
        """4. DELETE /api/tasks/{task_id} - удалить тестовую задачу"""
        if not self.task_id:
            self.log("❌ Нет ID задачи для удаления", "ERROR")
            return False
            
        self.log("🔄 Тест 4: DELETE /api/tasks/{task_id} - Удаление тестовой задачи")
        
        url = f"{API_BASE}/tasks/{self.task_id}"
        
        try:
            response = self.session.delete(url, timeout=10)
            self.log(f"DELETE {url}")
            self.log(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Тестовая задача удалена")
                self.log(f"Response: {json.dumps(data, ensure_ascii=False)}")
                return True
            else:
                self.log(f"❌ Ошибка удаления задачи: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Исключение при удалении задачи: {e}", "ERROR")
            return False
    
    def run_tests(self):
        """Запустить все тесты в указанном порядке"""
        self.log("🚀 Начинаем тестирование Tasks Subtasks API")
        self.log(f"Backend URL: {BACKEND_URL}")
        self.log(f"Test User ID: {TELEGRAM_ID}")
        self.log(f"Task Text: '{TASK_TEXT}'")
        self.log(f"Subtask Title: '{SUBTASK_TITLE}'")
        
        tests = [
            ("POST /api/tasks - Создание задачи", self.test_1_create_task),
            ("POST /api/tasks/{task_id}/subtasks - Добавление подзадачи", self.test_2_add_subtask),
            ("PUT /api/tasks/{task_id}/subtasks/{subtask_id} - Выполнение подзадачи", self.test_3_complete_subtask),
            ("DELETE /api/tasks/{task_id} - Удаление задачи", self.test_4_delete_task)
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
                    # Не прерываем тестирование, продолжаем
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
    success = tester.run_tests()
    sys.exit(0 if success else 1)