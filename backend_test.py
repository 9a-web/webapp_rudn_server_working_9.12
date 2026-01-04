#!/usr/bin/env python3
"""
Backend Testing Script for Planner Events Functionality
Tests the fixed Planner Events functionality as requested in review.
"""

import requests
import json
import sys
from datetime import datetime, timedelta
import time

# Configuration
BACKEND_URL = "https://rudn-schedule.ru/api"
TEST_TELEGRAM_ID = 999888777
TEST_DATE = "2026-01-05"

def log_test(test_name, status, details=""):
    """Log test results"""
    status_symbol = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"{status_symbol} {test_name}")
    if details:
        print(f"   {details}")
    print()

def test_create_planner_event():
    """Test POST /api/planner/events - создание события"""
    print("=== ТЕСТ 1: Создание события (POST /api/planner/events) ===")
    
    # Тестовые данные для создания события
    event_data = {
        "telegram_id": TEST_TELEGRAM_ID,
        "text": "Встреча с командой",
        "target_date": "2026-01-05T00:00:00",
        "time_start": "10:00",
        "time_end": "11:30",
        "category": "учеба",
        "priority": "high"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/planner/events", json=event_data)
        
        if response.status_code == 200:
            data = response.json()
            
            # Проверяем структуру ответа TaskResponse
            required_fields = ["id", "telegram_id", "text", "target_date", "time_start", "time_end", "category", "priority", "origin"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                log_test("Создание события", "FAIL", f"Отсутствуют поля: {missing_fields}")
                return None
            
            # Проверяем что origin установлен автоматически как "user"
            if data.get("origin") != "user":
                log_test("Создание события", "FAIL", f"origin должен быть 'user', получен: {data.get('origin')}")
                return None
            
            # Проверяем корректность данных
            if (data["telegram_id"] == TEST_TELEGRAM_ID and 
                data["text"] == "Встреча с командой" and
                data["time_start"] == "10:00" and
                data["time_end"] == "11:30" and
                data["category"] == "учеба" and
                data["priority"] == "high"):
                
                log_test("Создание события", "PASS", f"Событие создано успешно. ID: {data['id']}, origin: {data['origin']}")
                return data["id"]
            else:
                log_test("Создание события", "FAIL", "Данные события не соответствуют отправленным")
                return None
        else:
            log_test("Создание события", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return None
            
    except Exception as e:
        log_test("Создание события", "FAIL", f"Ошибка запроса: {str(e)}")
        return None

def test_event_validation():
    """Test validation при создании событий"""
    print("=== ТЕСТ 2: Валидация при создании событий ===")
    
    # Тест 2.1: Событие без time_start
    print("Тест 2.1: Событие без time_start")
    event_without_time_start = {
        "telegram_id": TEST_TELEGRAM_ID,
        "text": "Событие без времени начала",
        "target_date": "2026-01-05T00:00:00",
        "time_end": "11:30",
        "category": "учеба"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/planner/events", json=event_without_time_start)
        if response.status_code == 400 and "время начала и окончания" in response.text:
            log_test("Валидация time_start", "PASS", "Корректная ошибка 400 при отсутствии time_start")
        else:
            log_test("Валидация time_start", "FAIL", f"Ожидалась ошибка 400, получен: {response.status_code}")
    except Exception as e:
        log_test("Валидация time_start", "FAIL", f"Ошибка запроса: {str(e)}")
    
    # Тест 2.2: Событие без target_date
    print("Тест 2.2: Событие без target_date")
    event_without_date = {
        "telegram_id": TEST_TELEGRAM_ID,
        "text": "Событие без даты",
        "time_start": "10:00",
        "time_end": "11:30",
        "category": "учеба"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/planner/events", json=event_without_date)
        if response.status_code == 400 and "target_date" in response.text:
            log_test("Валидация target_date", "PASS", "Корректная ошибка 400 при отсутствии target_date")
        else:
            log_test("Валидация target_date", "FAIL", f"Ожидалась ошибка 400, получен: {response.status_code}")
    except Exception as e:
        log_test("Валидация target_date", "FAIL", f"Ошибка запроса: {str(e)}")

def test_get_planner_day():
    """Test GET /api/planner/{telegram_id}/{date}"""
    print("=== ТЕСТ 3: Получение событий дня (GET /api/planner/{telegram_id}/{date}) ===")
    
    try:
        response = requests.get(f"{BACKEND_URL}/planner/{TEST_TELEGRAM_ID}/{TEST_DATE}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Проверяем что ответ - это объект PlannerDayResponse, а не массив
            if isinstance(data, list):
                log_test("Структура ответа", "FAIL", "Ответ должен быть объектом PlannerDayResponse, а не массивом")
                return False
            
            # Проверяем обязательные поля PlannerDayResponse
            required_fields = ["date", "events", "total_count"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                log_test("Структура ответа", "FAIL", f"Отсутствуют поля: {missing_fields}")
                return False
            
            # Проверяем типы данных
            if (isinstance(data["date"], str) and 
                isinstance(data["events"], list) and 
                isinstance(data["total_count"], int)):
                
                log_test("Структура ответа", "PASS", f"Корректная структура PlannerDayResponse. Дата: {data['date']}, Событий: {data['total_count']}")
                
                # Проверяем что созданное событие присутствует
                events = data["events"]
                meeting_event = None
                for event in events:
                    if event.get("text") == "Встреча с командой":
                        meeting_event = event
                        break
                
                if meeting_event:
                    log_test("Наличие созданного события", "PASS", f"Событие 'Встреча с командой' найдено в списке")
                    
                    # Проверяем сортировку по времени
                    events_with_time = [e for e in events if e.get("time_start")]
                    if len(events_with_time) > 1:
                        is_sorted = all(events_with_time[i]["time_start"] <= events_with_time[i+1]["time_start"] 
                                      for i in range(len(events_with_time)-1))
                        if is_sorted:
                            log_test("Сортировка по времени", "PASS", "События отсортированы по time_start")
                        else:
                            log_test("Сортировка по времени", "FAIL", "События не отсортированы по time_start")
                    else:
                        log_test("Сортировка по времени", "PASS", "Недостаточно событий для проверки сортировки")
                    
                    return True
                else:
                    log_test("Наличие созданного события", "FAIL", "Созданное событие не найдено в списке")
                    return False
            else:
                log_test("Структура ответа", "FAIL", "Неверные типы данных в ответе")
                return False
        else:
            log_test("Получение событий дня", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_test("Получение событий дня", "FAIL", f"Ошибка запроса: {str(e)}")
        return False

def test_multiple_events_sorting():
    """Test создание нескольких событий и проверка сортировки"""
    print("=== ТЕСТ 4: Создание нескольких событий и проверка сортировки ===")
    
    # Создаем 3 события с разным временем
    events_to_create = [
        {
            "telegram_id": TEST_TELEGRAM_ID,
            "text": "Событие 1 - Обед",
            "target_date": "2026-01-05T00:00:00",
            "time_start": "14:00",
            "time_end": "15:00",
            "category": "личное",
            "priority": "medium"
        },
        {
            "telegram_id": TEST_TELEGRAM_ID,
            "text": "Событие 2 - Утренняя зарядка",
            "target_date": "2026-01-05T00:00:00",
            "time_start": "09:00",
            "time_end": "09:30",
            "category": "спорт",
            "priority": "low"
        },
        {
            "telegram_id": TEST_TELEGRAM_ID,
            "text": "Событие 3 - Планерка",
            "target_date": "2026-01-05T00:00:00",
            "time_start": "12:00",
            "time_end": "12:30",
            "category": "работа",
            "priority": "high"
        }
    ]
    
    created_events = []
    
    # Создаем события
    for i, event_data in enumerate(events_to_create, 1):
        try:
            response = requests.post(f"{BACKEND_URL}/planner/events", json=event_data)
            if response.status_code == 200:
                data = response.json()
                created_events.append(data)
                log_test(f"Создание события {i}", "PASS", f"Событие '{event_data['text']}' создано")
            else:
                log_test(f"Создание события {i}", "FAIL", f"HTTP {response.status_code}")
        except Exception as e:
            log_test(f"Создание события {i}", "FAIL", f"Ошибка: {str(e)}")
    
    # Получаем список событий и проверяем сортировку
    try:
        response = requests.get(f"{BACKEND_URL}/planner/{TEST_TELEGRAM_ID}/{TEST_DATE}")
        if response.status_code == 200:
            data = response.json()
            events = data["events"]
            
            # Находим наши тестовые события
            test_events = []
            for event in events:
                if event.get("text") in ["Событие 1 - Обед", "Событие 2 - Утренняя зарядка", "Событие 3 - Планерка"]:
                    test_events.append(event)
            
            if len(test_events) >= 3:
                # Проверяем порядок: 09:00 -> 12:00 -> 14:00
                times = [event["time_start"] for event in test_events if event.get("time_start")]
                times.sort()
                
                expected_order = ["09:00", "12:00", "14:00"]
                if times[:3] == expected_order:
                    log_test("Сортировка нескольких событий", "PASS", f"События отсортированы правильно: {' -> '.join(times[:3])}")
                else:
                    log_test("Сортировка нескольких событий", "FAIL", f"Неверный порядок: {' -> '.join(times[:3])}, ожидался: {' -> '.join(expected_order)}")
            else:
                log_test("Сортировка нескольких событий", "FAIL", f"Найдено только {len(test_events)} из 3 созданных событий")
        else:
            log_test("Сортировка нескольких событий", "FAIL", f"Ошибка получения событий: HTTP {response.status_code}")
    except Exception as e:
        log_test("Сортировка нескольких событий", "FAIL", f"Ошибка: {str(e)}")

def test_response_structure():
    """Test проверка структуры ответа"""
    print("=== ТЕСТ 5: Проверка структуры ответа ===")
    
    try:
        response = requests.get(f"{BACKEND_URL}/planner/{TEST_TELEGRAM_ID}/{TEST_DATE}")
        if response.status_code == 200:
            data = response.json()
            
            # Проверяем что это объект с нужными полями
            if isinstance(data, dict) and "date" in data and "events" in data and "total_count" in data:
                log_test("Структура PlannerDayResponse", "PASS", "Ответ содержит все обязательные поля")
                
                # Проверяем структуру каждого события
                events = data["events"]
                if events:
                    sample_event = events[0]
                    task_response_fields = ["id", "telegram_id", "text", "created_at", "updated_at"]
                    
                    missing_fields = [field for field in task_response_fields if field not in sample_event]
                    if not missing_fields:
                        log_test("Структура TaskResponse", "PASS", "События имеют корректную структуру TaskResponse")
                    else:
                        log_test("Структура TaskResponse", "FAIL", f"Отсутствуют поля в событии: {missing_fields}")
                else:
                    log_test("Структура TaskResponse", "PASS", "Нет событий для проверки структуры")
            else:
                log_test("Структура PlannerDayResponse", "FAIL", "Ответ не является объектом с нужными полями")
        else:
            log_test("Структура ответа", "FAIL", f"HTTP {response.status_code}")
    except Exception as e:
        log_test("Структура ответа", "FAIL", f"Ошибка: {str(e)}")

def main():
    """Основная функция тестирования"""
    print("🧪 ТЕСТИРОВАНИЕ ПЛАНИРОВЩИКА СОБЫТИЙ (Planner Events)")
    print("=" * 60)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Telegram ID: {TEST_TELEGRAM_ID}")
    print(f"Test Date: {TEST_DATE}")
    print(f"ENV: test")
    print("=" * 60)
    print()
    
    # Выполняем тесты по порядку
    event_id = test_create_planner_event()
    test_event_validation()
    test_get_planner_day()
    test_multiple_events_sorting()
    test_response_structure()
    
    print("=" * 60)
    print("🏁 ТЕСТИРОВАНИЕ ЗАВЕРШЕНО")
    print("=" * 60)

if __name__ == "__main__":
    main()