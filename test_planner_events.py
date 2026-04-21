#!/usr/bin/env python3
"""
Тест функциональности Планировщика событий (Planner Events)

Проверяет:
1. Создание события через POST /api/planner/events
2. События не появляются в GET /api/tasks/{telegram_id}
3. События возвращаются через GET /api/planner/{telegram_id}/{date}
4. Валидация времени и даты для событий
"""

import sys
import asyncio
import requests
from datetime import datetime, timedelta
from typing import Dict, Any
import json

# Цвета для вывода
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

# Backend URL
BACKEND_URL = "https://315a37f8-0901-4235-b562-44757018cefa.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

# Тестовый telegram_id
TEST_TELEGRAM_ID = 999888777


def print_section(title: str):
    """Вывод заголовка секции"""
    print(f"\n{BLUE}{'=' * 60}{RESET}")
    print(f"{BLUE}{title}{RESET}")
    print(f"{BLUE}{'=' * 60}{RESET}\n")


def print_test(test_name: str):
    """Вывод названия теста"""
    print(f"{YELLOW}▶ {test_name}{RESET}")


def print_success(message: str):
    """Вывод успеха"""
    print(f"{GREEN}✅ {message}{RESET}")


def print_error(message: str):
    """Вывод ошибки"""
    print(f"{RED}❌ {message}{RESET}")


def print_info(message: str):
    """Вывод информации"""
    print(f"   {message}")


class PlannerEventsTest:
    def __init__(self):
        self.test_event_id = None
        self.test_date = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        self.failed_tests = []
        self.passed_tests = []

    def test_1_create_event_validation(self) -> bool:
        """Тест 1: Валидация при создании события (без времени)"""
        print_test("Тест 1: Валидация - событие БЕЗ времени должно быть отклонено")
        
        try:
            # Попытка создать событие без времени (должно вернуть 400)
            event_data = {
                "telegram_id": TEST_TELEGRAM_ID,
                "text": "Событие без времени",
                "target_date": self.test_date + "T10:00:00"
            }
            
            response = requests.post(
                f"{API_BASE}/planner/events",
                json=event_data,
                timeout=10
            )
            
            if response.status_code == 400:
                print_success("Валидация работает: событие без времени отклонено (400)")
                print_info(f"Сообщение об ошибке: {response.json().get('detail')}")
                return True
            else:
                print_error(f"Ожидался код 400, получен {response.status_code}")
                print_info(f"Response: {response.json()}")
                return False
                
        except Exception as e:
            print_error(f"Ошибка при тестировании валидации: {e}")
            return False

    def test_2_create_event_success(self) -> bool:
        """Тест 2: Успешное создание события"""
        print_test("Тест 2: Создание события с временем начала и окончания")
        
        try:
            # Создаем событие с полными данными
            event_data = {
                "telegram_id": TEST_TELEGRAM_ID,
                "text": "Встреча с деканом",
                "category": "учеба",
                "priority": "high",
                "target_date": self.test_date + "T14:00:00",
                "time_start": "14:00",
                "time_end": "15:30",
                "notes": "Кабинет 305, 3 этаж",
                "subject": "Администрация"
            }
            
            response = requests.post(
                f"{API_BASE}/planner/events",
                json=event_data,
                timeout=10
            )
            
            if response.status_code == 200:
                event = response.json()
                self.test_event_id = event.get('id')
                
                print_success(f"Событие создано успешно!")
                print_info(f"ID события: {self.test_event_id}")
                print_info(f"Текст: {event.get('text')}")
                print_info(f"Время: {event.get('time_start')} - {event.get('time_end')}")
                print_info(f"Дата: {event.get('target_date')}")
                
                # Проверяем наличие обязательных полей
                if (event.get('time_start') == "14:00" and 
                    event.get('time_end') == "15:30" and
                    event.get('text') == "Встреча с деканом"):
                    print_success("Все поля события корректны")
                    return True
                else:
                    print_error("Некоторые поля события некорректны")
                    return False
            else:
                print_error(f"Ошибка создания события: {response.status_code}")
                print_info(f"Response: {response.json()}")
                return False
                
        except Exception as e:
            print_error(f"Ошибка при создании события: {e}")
            return False

    def test_3_event_not_in_tasks(self) -> bool:
        """Тест 3: События не появляются в списке задач"""
        print_test("Тест 3: Событие НЕ должно появиться в GET /api/tasks/{telegram_id}")
        
        try:
            response = requests.get(
                f"{API_BASE}/tasks/{TEST_TELEGRAM_ID}",
                timeout=10
            )
            
            if response.status_code == 200:
                tasks = response.json()
                print_info(f"Получено задач: {len(tasks)}")
                
                # Проверяем, что наше событие НЕ в списке задач
                event_in_tasks = any(task.get('id') == self.test_event_id for task in tasks)
                
                # Дополнительно проверяем, что нет задач с обоими временами
                tasks_with_both_times = [
                    task for task in tasks 
                    if task.get('time_start') and task.get('time_end')
                ]
                
                if not event_in_tasks and len(tasks_with_both_times) == 0:
                    print_success("События правильно исключены из списка задач")
                    print_info(f"Задач с временем начала И окончания: 0")
                    return True
                else:
                    print_error("Событие найдено в списке задач (должно быть исключено!)")
                    if tasks_with_both_times:
                        print_info(f"Найдено задач с обоими временами: {len(tasks_with_both_times)}")
                        for task in tasks_with_both_times[:3]:
                            print_info(f"  - {task.get('text')} ({task.get('time_start')} - {task.get('time_end')})")
                    return False
            else:
                print_error(f"Ошибка получения задач: {response.status_code}")
                return False
                
        except Exception as e:
            print_error(f"Ошибка при получении задач: {e}")
            return False

    def test_4_get_planner_day(self) -> bool:
        """Тест 4: Получение событий на конкретную дату"""
        print_test(f"Тест 4: Получение событий через GET /api/planner/{TEST_TELEGRAM_ID}/{self.test_date}")
        
        try:
            response = requests.get(
                f"{API_BASE}/planner/{TEST_TELEGRAM_ID}/{self.test_date}",
                timeout=10
            )
            
            if response.status_code == 200:
                planner_data = response.json()
                events = planner_data.get('events', [])
                total_count = planner_data.get('total_count', 0)
                date = planner_data.get('date')
                
                print_success(f"Данные планировщика получены")
                print_info(f"Дата: {date}")
                print_info(f"Всего событий: {total_count}")
                
                # Проверяем структуру ответа
                if date != self.test_date:
                    print_error(f"Неверная дата в ответе: {date} != {self.test_date}")
                    return False
                
                # Ищем наше событие
                our_event = None
                for event in events:
                    if event.get('id') == self.test_event_id:
                        our_event = event
                        break
                
                if our_event:
                    print_success("Созданное событие найдено в планировщике!")
                    print_info(f"Текст: {our_event.get('text')}")
                    print_info(f"Время: {our_event.get('time_start')} - {our_event.get('time_end')}")
                    
                    # Проверяем сортировку по времени
                    times = [e.get('time_start', '') for e in events if e.get('time_start')]
                    if times == sorted(times):
                        print_success("События отсортированы по времени")
                    else:
                        print_error("События не отсортированы по времени")
                        return False
                    
                    return True
                else:
                    print_error("Созданное событие НЕ найдено в планировщике!")
                    print_info(f"ID искали: {self.test_event_id}")
                    print_info(f"Всего событий в ответе: {len(events)}")
                    return False
            else:
                print_error(f"Ошибка получения событий планировщика: {response.status_code}")
                print_info(f"Response: {response.json()}")
                return False
                
        except Exception as e:
            print_error(f"Ошибка при получении событий: {e}")
            return False

    def test_5_create_multiple_events(self) -> bool:
        """Тест 5: Создание нескольких событий и проверка сортировки"""
        print_test("Тест 5: Создание нескольких событий на один день")
        
        try:
            events_to_create = [
                {
                    "telegram_id": TEST_TELEGRAM_ID,
                    "text": "Утренняя пробежка",
                    "target_date": self.test_date + "T08:00:00",
                    "time_start": "08:00",
                    "time_end": "09:00",
                    "category": "спорт"
                },
                {
                    "telegram_id": TEST_TELEGRAM_ID,
                    "text": "Обед в столовой",
                    "target_date": self.test_date + "T13:00:00",
                    "time_start": "13:00",
                    "time_end": "14:00",
                    "category": "личное"
                },
                {
                    "telegram_id": TEST_TELEGRAM_ID,
                    "text": "Вечерняя встреча",
                    "target_date": self.test_date + "T19:00:00",
                    "time_start": "19:00",
                    "time_end": "21:00",
                    "category": "личное"
                }
            ]
            
            created_count = 0
            for event_data in events_to_create:
                response = requests.post(
                    f"{API_BASE}/planner/events",
                    json=event_data,
                    timeout=10
                )
                if response.status_code == 200:
                    created_count += 1
                    print_info(f"Создано: {event_data['text']}")
            
            if created_count == len(events_to_create):
                print_success(f"Создано {created_count} событий")
                
                # Теперь получаем все события на эту дату
                response = requests.get(
                    f"{API_BASE}/planner/{TEST_TELEGRAM_ID}/{self.test_date}",
                    timeout=10
                )
                
                if response.status_code == 200:
                    planner_data = response.json()
                    events = planner_data.get('events', [])
                    
                    print_info(f"Всего событий на {self.test_date}: {len(events)}")
                    
                    # Проверяем что все события отсортированы
                    print_info("\nПорядок событий:")
                    for i, event in enumerate(events, 1):
                        print_info(f"{i}. {event.get('time_start')} - {event.get('text')}")
                    
                    # Минимум должно быть 4 события (1 из теста 2 + 3 новых)
                    if len(events) >= 4:
                        print_success("Все события сохранены и получены")
                        return True
                    else:
                        print_error(f"Ожидалось минимум 4 события, получено {len(events)}")
                        return False
                else:
                    print_error("Не удалось получить события после создания")
                    return False
            else:
                print_error(f"Создано только {created_count} из {len(events_to_create)} событий")
                return False
                
        except Exception as e:
            print_error(f"Ошибка при создании множественных событий: {e}")
            return False

    def run_all_tests(self):
        """Запуск всех тестов"""
        print_section("🧪 ТЕСТИРОВАНИЕ ПЛАНИРОВЩИКА СОБЫТИЙ (PLANNER EVENTS)")
        
        print_info(f"Backend URL: {BACKEND_URL}")
        print_info(f"Test Telegram ID: {TEST_TELEGRAM_ID}")
        print_info(f"Test Date: {self.test_date}")
        print()
        
        tests = [
            ("Валидация события без времени", self.test_1_create_event_validation),
            ("Создание события", self.test_2_create_event_success),
            ("События не в списке задач", self.test_3_event_not_in_tasks),
            ("Получение событий планировщика", self.test_4_get_planner_day),
            ("Множественные события", self.test_5_create_multiple_events),
        ]
        
        for test_name, test_func in tests:
            try:
                result = test_func()
                if result:
                    self.passed_tests.append(test_name)
                else:
                    self.failed_tests.append(test_name)
                print()
            except Exception as e:
                print_error(f"Критическая ошибка в тесте: {e}")
                self.failed_tests.append(test_name)
                print()
        
        # Итоговый отчет
        print_section("📊 ИТОГИ ТЕСТИРОВАНИЯ")
        print_info(f"Всего тестов: {len(tests)}")
        print_success(f"Успешно: {len(self.passed_tests)}")
        if self.failed_tests:
            print_error(f"Провалено: {len(self.failed_tests)}")
            print_info("\nПроваленные тесты:")
            for test in self.failed_tests:
                print_error(f"  • {test}")
        
        print()
        if not self.failed_tests:
            print_success("🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!")
            return 0
        else:
            print_error("⚠️ НЕКОТОРЫЕ ТЕСТЫ НЕ ПРОШЛИ")
            return 1


if __name__ == "__main__":
    tester = PlannerEventsTest()
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)
