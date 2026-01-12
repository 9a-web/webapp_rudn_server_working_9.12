#!/usr/bin/env python3
"""
Backend API Testing for Tasks Subtasks API
Testing the personal tasks subtasks functionality
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
TASK_TEXT = "Тестовая задача с подзадачами"

class TasksSubtasksAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.task_id = None
        self.subtask1_id = None
        self.subtask2_id = None
        
    def log(self, message, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def test_create_task(self):
        """1. Создать задачу с текстом 'Тестовая задача с подзадачами'"""
        self.log("🔄 Тест 1: Создание задачи")
        
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
                self.log(f"Response: {json.dumps(data, ensure_ascii=False, indent=2)}")
                return True
            else:
                self.log(f"❌ Ошибка создания задачи: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Исключение при создании задачи: {e}", "ERROR")
            return False
    
    def test_add_subtask1(self):
        """2. Добавить подзадачу к созданной задаче"""
        if not self.task_id:
            self.log("❌ Нет ID задачи для добавления подзадачи", "ERROR")
            return False
            
        self.log("🔄 Тест 2: Добавление первой подзадачи")
        
        url = f"{API_BASE}/tasks/{self.task_id}/subtasks"
        payload = {
            "title": "Подзадача 1"
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
                    self.subtask1_id = subtasks[0].get("subtask_id")
                    
                # Проверяем ответ
                subtasks_progress = data.get("subtasks_progress", -1)
                subtasks_total = data.get("subtasks_total", -1)
                
                self.log(f"✅ Подзадача 1 добавлена. ID: {self.subtask1_id}")
                self.log(f"Subtasks progress: {subtasks_progress}%, Total: {subtasks_total}")
                
                if subtasks_progress == 0 and subtasks_total == 1:
                    self.log("✅ Прогресс подзадач корректный (0%, 1 всего)")
                else:
                    self.log(f"⚠️ Неожиданный прогресс: {subtasks_progress}%, {subtasks_total} всего", "WARNING")
                
                self.log(f"Response: {json.dumps(data, ensure_ascii=False, indent=2)}")
                return True
            else:
                self.log(f"❌ Ошибка добавления подзадачи: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Исключение при добавлении подзадачи: {e}", "ERROR")
            return False
    
    def test_add_subtask2(self):
        """3. Добавить вторую подзадачу"""
        if not self.task_id:
            self.log("❌ Нет ID задачи для добавления подзадачи", "ERROR")
            return False
            
        self.log("🔄 Тест 3: Добавление второй подзадачи")
        
        url = f"{API_BASE}/tasks/{self.task_id}/subtasks"
        payload = {
            "title": "Подзадача 2"
        }
        
        try:
            response = self.session.post(url, json=payload, timeout=10)
            self.log(f"POST {url}")
            self.log(f"Request: {json.dumps(payload, ensure_ascii=False)}")
            self.log(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                subtasks = data.get("subtasks", [])
                if len(subtasks) >= 2:
                    self.subtask2_id = subtasks[1].get("subtask_id")
                    
                # Проверяем ответ
                subtasks_progress = data.get("subtasks_progress", -1)
                subtasks_total = data.get("subtasks_total", -1)
                
                self.log(f"✅ Подзадача 2 добавлена. ID: {self.subtask2_id}")
                self.log(f"Subtasks progress: {subtasks_progress}%, Total: {subtasks_total}")
                
                if subtasks_progress == 0 and subtasks_total == 2:
                    self.log("✅ Прогресс подзадач корректный (0%, 2 всего)")
                else:
                    self.log(f"⚠️ Неожиданный прогресс: {subtasks_progress}%, {subtasks_total} всего", "WARNING")
                
                self.log(f"Response: {json.dumps(data, ensure_ascii=False, indent=2)}")
                return True
            else:
                self.log(f"❌ Ошибка добавления второй подзадачи: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Исключение при добавлении второй подзадачи: {e}", "ERROR")
            return False
    
    def test_complete_subtask1(self):
        """4. Отметить подзадачу выполненной"""
        if not self.task_id or not self.subtask1_id:
            self.log("❌ Нет ID задачи или подзадачи для выполнения", "ERROR")
            return False
            
        self.log("🔄 Тест 4: Отметка первой подзадачи выполненной")
        
        url = f"{API_BASE}/tasks/{self.task_id}/subtasks/{self.subtask1_id}"
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
                
                # Проверяем ответ
                subtasks_progress = data.get("subtasks_progress", -1)
                subtasks_completed = data.get("subtasks_completed", -1)
                subtasks_total = data.get("subtasks_total", -1)
                
                self.log(f"✅ Подзадача 1 отмечена выполненной")
                self.log(f"Progress: {subtasks_progress}%, Completed: {subtasks_completed}, Total: {subtasks_total}")
                
                if subtasks_progress == 50 and subtasks_completed == 1 and subtasks_total == 2:
                    self.log("✅ Прогресс подзадач корректный (50%, 1 из 2)")
                else:
                    self.log(f"⚠️ Неожиданный прогресс: {subtasks_progress}%, {subtasks_completed}/{subtasks_total}", "WARNING")
                
                self.log(f"Response: {json.dumps(data, ensure_ascii=False, indent=2)}")
                return True
            else:
                self.log(f"❌ Ошибка выполнения подзадачи: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Исключение при выполнении подзадачи: {e}", "ERROR")
            return False
    
    def test_complete_subtask2(self):
        """5. Отметить вторую подзадачу выполненной"""
        if not self.task_id or not self.subtask2_id:
            self.log("❌ Нет ID задачи или второй подзадачи для выполнения", "ERROR")
            return False
            
        self.log("🔄 Тест 5: Отметка второй подзадачи выполненной")
        
        url = f"{API_BASE}/tasks/{self.task_id}/subtasks/{self.subtask2_id}"
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
                
                # Проверяем ответ
                subtasks_progress = data.get("subtasks_progress", -1)
                subtasks_completed = data.get("subtasks_completed", -1)
                subtasks_total = data.get("subtasks_total", -1)
                
                self.log(f"✅ Подзадача 2 отмечена выполненной")
                self.log(f"Progress: {subtasks_progress}%, Completed: {subtasks_completed}, Total: {subtasks_total}")
                
                if subtasks_progress == 100 and subtasks_completed == 2 and subtasks_total == 2:
                    self.log("✅ Прогресс подзадач корректный (100%, 2 из 2)")
                else:
                    self.log(f"⚠️ Неожиданный прогресс: {subtasks_progress}%, {subtasks_completed}/{subtasks_total}", "WARNING")
                
                self.log(f"Response: {json.dumps(data, ensure_ascii=False, indent=2)}")
                return True
            else:
                self.log(f"❌ Ошибка выполнения второй подзадачи: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Исключение при выполнении второй подзадачи: {e}", "ERROR")
            return False
    
    def test_delete_subtask(self):
        """6. Удалить подзадачу"""
        if not self.task_id or not self.subtask1_id:
            self.log("❌ Нет ID задачи или подзадачи для удаления", "ERROR")
            return False
            
        self.log("🔄 Тест 6: Удаление первой подзадачи")
        
        url = f"{API_BASE}/tasks/{self.task_id}/subtasks/{self.subtask1_id}"
        
        try:
            response = self.session.delete(url, timeout=10)
            self.log(f"DELETE {url}")
            self.log(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Проверяем ответ
                subtasks_total = data.get("subtasks_total", -1)
                
                self.log(f"✅ Подзадача удалена")
                self.log(f"Subtasks total: {subtasks_total}")
                
                if subtasks_total == 1:
                    self.log("✅ Количество подзадач корректное (1)")
                else:
                    self.log(f"⚠️ Неожиданное количество подзадач: {subtasks_total}", "WARNING")
                
                self.log(f"Response: {json.dumps(data, ensure_ascii=False, indent=2)}")
                return True
            else:
                self.log(f"❌ Ошибка удаления подзадачи: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Исключение при удалении подзадачи: {e}", "ERROR")
            return False
    
    def test_get_all_tasks(self):
        """7. Получить все задачи и проверить что прогресс сохранён"""
        self.log("🔄 Тест 7: Получение всех задач пользователя")
        
        url = f"{API_BASE}/tasks/{TELEGRAM_ID}"
        
        try:
            response = self.session.get(url, timeout=10)
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
                    subtasks_progress = test_task.get("subtasks_progress", -1)
                    
                    self.log(f"✅ Тестовая задача найдена")
                    self.log(f"Subtasks: {len(subtasks)}, Progress: {subtasks_progress}%")
                    self.log(f"Task data: {json.dumps(test_task, ensure_ascii=False, indent=2)}")
                    
                    if len(subtasks) > 0 and subtasks_progress >= 0:
                        self.log("✅ Прогресс подзадач сохранён")
                    else:
                        self.log("⚠️ Прогресс подзадач не найден", "WARNING")
                    
                    return True
                else:
                    self.log("❌ Тестовая задача не найдена в списке", "ERROR")
                    self.log(f"Response: {json.dumps(data, ensure_ascii=False, indent=2)}")
                    return False
            else:
                self.log(f"❌ Ошибка получения задач: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Исключение при получении задач: {e}", "ERROR")
            return False
    
    def test_cleanup(self):
        """8. Удалить тестовую задачу (cleanup)"""
        if not self.task_id:
            self.log("❌ Нет ID задачи для удаления", "ERROR")
            return False
            
        self.log("🔄 Тест 8: Удаление тестовой задачи (cleanup)")
        
        url = f"{API_BASE}/tasks/{self.task_id}"
        
        try:
            response = self.session.delete(url, timeout=10)
            self.log(f"DELETE {url}")
            self.log(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Тестовая задача удалена")
                self.log(f"Response: {json.dumps(data, ensure_ascii=False, indent=2)}")
                return True
            else:
                self.log(f"❌ Ошибка удаления задачи: {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Исключение при удалении задачи: {e}", "ERROR")
            return False
    
    def run_all_tests(self):
        """Запустить все тесты"""
        self.log("🚀 Начинаем тестирование Tasks Subtasks API")
        self.log(f"Backend URL: {BACKEND_URL}")
        self.log(f"Test User ID: {TELEGRAM_ID}")
        
        tests = [
            ("Создание задачи", self.test_create_task),
            ("Добавление подзадачи 1", self.test_add_subtask1),
            ("Добавление подзадачи 2", self.test_add_subtask2),
            ("Выполнение подзадачи 1", self.test_complete_subtask1),
            ("Выполнение подзадачи 2", self.test_complete_subtask2),
            ("Удаление подзадачи", self.test_delete_subtask),
            ("Получение всех задач", self.test_get_all_tasks),
            ("Cleanup - удаление задачи", self.test_cleanup)
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            self.log(f"\n{'='*60}")
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
        
        self.log(f"\n{'='*60}")
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
    tester = TasksSubtasksAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)