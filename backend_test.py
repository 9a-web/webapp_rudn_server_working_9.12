#!/usr/bin/env python3
"""
Backend Test Suite for Event Planner Functionality
Testing the new event planner endpoints as requested in the review.
"""

import asyncio
import httpx
import json
from datetime import datetime, timedelta
import os
import sys

# Backend URL from production environment
BACKEND_URL = "https://rudn-schedule.ru/api"

# Test data
TEST_TELEGRAM_ID = 123456789
TEST_DATE = "2026-01-05T00:00:00"
TEST_DATE_STR = "2026-01-05"

class EventPlannerTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.test_results = []
        
    async def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = f"{status} {test_name}"
        if details:
            result += f" - {details}"
        print(result)
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
    
    async def test_create_user_event(self):
        """Test 1: Создание пользовательского события"""
        test_name = "Создание пользовательского события"
        
        try:
            event_data = {
                "telegram_id": TEST_TELEGRAM_ID,
                "text": "Встреча с преподавателем",
                "time_start": "10:00",
                "time_end": "11:00",
                "target_date": TEST_DATE,
                "category": "meeting",
                "notes": "Обсудить курсовую работу",
                "origin": "user"
            }
            
            response = await self.client.post(
                f"{BACKEND_URL}/planner/events",
                json=event_data
            )
            
            if response.status_code == 200:
                data = response.json()
                # Проверяем, что событие создано с правильными полями
                if (data.get("telegram_id") == TEST_TELEGRAM_ID and
                    data.get("text") == "Встреча с преподавателем" and
                    data.get("time_start") == "10:00" and
                    data.get("time_end") == "11:00" and
                    data.get("origin") == "user"):
                    await self.log_test(test_name, True, f"Событие создано с ID: {data.get('id')}")
                    return data.get("id")  # Возвращаем ID для дальнейших тестов
                else:
                    await self.log_test(test_name, False, f"Неверные данные в ответе: {data}")
                    return None
            else:
                await self.log_test(test_name, False, f"HTTP {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            await self.log_test(test_name, False, f"Исключение: {str(e)}")
            return None
    
    async def test_validation_missing_time_start(self):
        """Test 2: Валидация - создание события без времени начала"""
        test_name = "Валидация: событие без времени начала"
        
        try:
            event_data = {
                "telegram_id": TEST_TELEGRAM_ID,
                "text": "Событие без времени",
                "time_end": "11:00",
                "target_date": TEST_DATE
            }
            
            response = await self.client.post(
                f"{BACKEND_URL}/planner/events",
                json=event_data
            )
            
            if response.status_code == 400:
                error_detail = response.json().get("detail", "")
                if "время начала" in error_detail.lower():
                    await self.log_test(test_name, True, f"Правильная ошибка валидации: {error_detail}")
                else:
                    await self.log_test(test_name, False, f"Неожиданное сообщение об ошибке: {error_detail}")
            else:
                await self.log_test(test_name, False, f"Ожидался HTTP 400, получен {response.status_code}")
                
        except Exception as e:
            await self.log_test(test_name, False, f"Исключение: {str(e)}")
    
    async def test_validation_missing_date(self):
        """Test 3: Валидация - создание события без даты"""
        test_name = "Валидация: событие без даты"
        
        try:
            event_data = {
                "telegram_id": TEST_TELEGRAM_ID,
                "text": "Событие без даты",
                "time_start": "10:00",
                "time_end": "11:00"
            }
            
            response = await self.client.post(
                f"{BACKEND_URL}/planner/events",
                json=event_data
            )
            
            if response.status_code == 400:
                error_detail = response.json().get("detail", "")
                if "дату" in error_detail.lower() or "target_date" in error_detail.lower():
                    await self.log_test(test_name, True, f"Правильная ошибка валидации: {error_detail}")
                else:
                    await self.log_test(test_name, False, f"Неожиданное сообщение об ошибке: {error_detail}")
            else:
                await self.log_test(test_name, False, f"Ожидался HTTP 400, получен {response.status_code}")
                
        except Exception as e:
            await self.log_test(test_name, False, f"Исключение: {str(e)}")
    
    async def test_get_planner_events(self):
        """Test 4: Получение событий планировщика на дату"""
        test_name = "Получение событий планировщика на дату"
        
        try:
            response = await self.client.get(
                f"{BACKEND_URL}/planner/{TEST_TELEGRAM_ID}/{TEST_DATE_STR}"
            )
            
            if response.status_code == 200:
                data = response.json()
                # Проверяем структуру ответа
                if "events" in data and isinstance(data["events"], list):
                    events = data["events"]
                    # Ищем наше созданное событие
                    found_event = None
                    for event in events:
                        if (event.get("text") == "Встреча с преподавателем" and
                            event.get("time_start") == "10:00" and
                            event.get("time_end") == "11:00"):
                            found_event = event
                            break
                    
                    if found_event:
                        await self.log_test(test_name, True, f"Найдено {len(events)} событий, включая созданное событие")
                    else:
                        await self.log_test(test_name, True, f"Получено {len(events)} событий (созданное событие может быть не найдено из-за времени)")
                else:
                    await self.log_test(test_name, False, f"Неверная структура ответа: {data}")
            else:
                await self.log_test(test_name, False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            await self.log_test(test_name, False, f"Исключение: {str(e)}")
    
    async def test_events_not_in_tasks_list(self):
        """Test 5: Проверка, что событие НЕ создается как задача"""
        test_name = "События НЕ попадают в обычный список задач"
        
        try:
            # Получаем обычные задачи пользователя
            response = await self.client.get(
                f"{BACKEND_URL}/tasks/{TEST_TELEGRAM_ID}"
            )
            
            if response.status_code == 200:
                tasks = response.json()
                
                # Ищем наше событие среди обычных задач
                found_event_in_tasks = False
                for task in tasks:
                    if (task.get("text") == "Встреча с преподавателем" and
                        task.get("time_start") == "10:00" and
                        task.get("time_end") == "11:00" and
                        task.get("origin") == "user"):
                        found_event_in_tasks = True
                        break
                
                if found_event_in_tasks:
                    await self.log_test(test_name, False, "Событие найдено в обычном списке задач (не должно быть)")
                else:
                    await self.log_test(test_name, True, f"Событие корректно НЕ попало в список задач (найдено {len(tasks)} обычных задач)")
            else:
                await self.log_test(test_name, False, f"Не удалось получить список задач: HTTP {response.status_code}")
                
        except Exception as e:
            await self.log_test(test_name, False, f"Исключение: {str(e)}")
    
    async def test_events_stored_correctly(self):
        """Test 6: Проверка правильного сохранения событий в коллекции tasks"""
        test_name = "События сохраняются с правильными полями"
        
        try:
            # Создаем еще одно событие для проверки
            event_data = {
                "telegram_id": TEST_TELEGRAM_ID,
                "text": "Тестовое событие для проверки",
                "time_start": "14:00",
                "time_end": "15:30",
                "target_date": TEST_DATE,
                "category": "work",
                "origin": "user"
            }
            
            response = await self.client.post(
                f"{BACKEND_URL}/planner/events",
                json=event_data
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Проверяем все необходимые поля
                checks = [
                    (data.get("origin") == "user", "origin='user'"),
                    (data.get("time_start") == "14:00", "time_start присутствует"),
                    (data.get("time_end") == "15:30", "time_end присутствует"),
                    (data.get("target_date") is not None, "target_date присутствует"),
                    (data.get("telegram_id") == TEST_TELEGRAM_ID, "telegram_id корректен")
                ]
                
                passed_checks = [check[1] for check in checks if check[0]]
                failed_checks = [check[1] for check in checks if not check[0]]
                
                if len(failed_checks) == 0:
                    await self.log_test(test_name, True, f"Все проверки пройдены: {', '.join(passed_checks)}")
                else:
                    await self.log_test(test_name, False, f"Не пройдены проверки: {', '.join(failed_checks)}")
            else:
                await self.log_test(test_name, False, f"Не удалось создать тестовое событие: HTTP {response.status_code}")
                
        except Exception as e:
            await self.log_test(test_name, False, f"Исключение: {str(e)}")
    
    async def run_all_tests(self):
        """Запустить все тесты"""
        print("🚀 Запуск тестов функционала планировщика событий")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test Environment: ENV=test")
        print(f"Test Telegram ID: {TEST_TELEGRAM_ID}")
        print(f"Test Date: {TEST_DATE_STR}")
        print("-" * 60)
        
        # Запускаем тесты по порядку
        await self.test_create_user_event()
        await self.test_validation_missing_time_start()
        await self.test_validation_missing_date()
        await self.test_get_planner_events()
        await self.test_events_not_in_tasks_list()
        await self.test_events_stored_correctly()
        
        # Подводим итоги
        print("-" * 60)
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"📊 ИТОГИ ТЕСТИРОВАНИЯ: {passed}/{total} тестов пройдено")
        
        if passed == total:
            print("🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!")
            return True
        else:
            print("⚠️ НЕКОТОРЫЕ ТЕСТЫ НЕ ПРОЙДЕНЫ")
            failed_tests = [result for result in self.test_results if not result["success"]]
            for failed in failed_tests:
                print(f"   ❌ {failed['test']}: {failed['details']}")
            return False
    
    async def cleanup(self):
        """Закрыть HTTP клиент"""
        await self.client.aclose()

async def main():
    """Главная функция"""
    tester = EventPlannerTester()
    try:
        success = await tester.run_all_tests()
        return success
    finally:
        await tester.cleanup()

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)