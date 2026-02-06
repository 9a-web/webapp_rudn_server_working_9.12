#!/usr/bin/env python3
"""
Backend Performance Testing for RUDN Schedule API
Tests the performance-critical endpoints as specified in the review request.
"""

import time
import requests
import json
from datetime import datetime, timedelta
import sys

# Backend URL from frontend env
BACKEND_URL = "https://d8cc5781-41cf-497a-8d0d-1a5844d54640.preview.emergentagent.com/api"

# Test data
TEST_TELEGRAM_ID = 123456

def measure_time(func):
    """Decorator to measure function execution time"""
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        end_time = time.time()
        duration = end_time - start_time
        return result, duration
    return wrapper

@measure_time
def test_get_tasks(telegram_id):
    """Test GET /api/tasks/{telegram_id}"""
    url = f"{BACKEND_URL}/tasks/{telegram_id}"
    response = requests.get(url)
    return response

@measure_time
def test_create_task(telegram_id, text):
    """Test POST /api/tasks"""
    url = f"{BACKEND_URL}/tasks"
    data = {
        "telegram_id": telegram_id,
        "text": text
    }
    response = requests.post(url, json=data)
    return response

@measure_time
def test_create_planner_event(telegram_id, text, time_start, time_end, target_date):
    """Test POST /api/planner/events"""
    url = f"{BACKEND_URL}/planner/events"
    data = {
        "telegram_id": telegram_id,
        "text": text,
        "time_start": time_start,
        "time_end": time_end,
        "target_date": target_date
    }
    response = requests.post(url, json=data)
    return response

@measure_time
def test_get_planner_day(telegram_id, date):
    """Test GET /api/planner/{telegram_id}/{date}"""
    url = f"{BACKEND_URL}/planner/{telegram_id}/{date}"
    response = requests.get(url)
    return response

@measure_time
def test_update_task(task_id, completed):
    """Test PUT /api/tasks/{task_id}"""
    url = f"{BACKEND_URL}/tasks/{task_id}"
    data = {"completed": completed}
    response = requests.put(url, json=data)
    return response

def print_test_result(test_name, response, duration):
    """Print formatted test result"""
    status_icon = "✅" if response.status_code == 200 else "❌"
    print(f"{status_icon} {test_name}")
    print(f"   Status: {response.status_code}")
    print(f"   Time: {duration:.3f}s {'(SLOW!)' if duration > 2.0 else ''}")
    
    if response.status_code != 200:
        print(f"   Error: {response.text}")
    elif response.headers.get('content-type', '').startswith('application/json'):
        try:
            json_data = response.json()
            if isinstance(json_data, list):
                print(f"   Response: {len(json_data)} items")
            elif isinstance(json_data, dict):
                print(f"   Response: {list(json_data.keys())}")
            else:
                print(f"   Response: {type(json_data).__name__}")
        except:
            print(f"   Response: {len(response.text)} chars")
    print()
    
    return response.status_code == 200 and duration <= 2.0

def main():
    """Run all performance tests"""
    print("🚀 Starting RUDN Schedule Backend Performance Tests")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Telegram ID: {TEST_TELEGRAM_ID}")
    print("=" * 60)
    
    results = {}
    total_time = 0
    
    # 1. Test initial task list loading
    print("1️⃣ Testing Task List Loading (GET /api/tasks/{telegram_id})")
    response, duration = test_get_tasks(TEST_TELEGRAM_ID)
    results['get_tasks_initial'] = print_test_result("Initial Task List", response, duration)
    total_time += duration
    
    # 2. Test task creation
    print("2️⃣ Testing Task Creation (POST /api/tasks)")
    response, duration = test_create_task(TEST_TELEGRAM_ID, "Test task for performance check")
    task_creation_success = print_test_result("Task Creation", response, duration)
    results['create_task'] = task_creation_success
    total_time += duration
    
    # Get created task ID for later use
    created_task_id = None
    if task_creation_success and response.status_code == 200:
        try:
            task_data = response.json()
            created_task_id = task_data.get('id')
            print(f"   Created Task ID: {created_task_id}")
        except:
            pass
    
    # 3. Test task list after creation
    print("3️⃣ Testing Task List After Creation")
    response, duration = test_get_tasks(TEST_TELEGRAM_ID)
    results['get_tasks_after_create'] = print_test_result("Task List After Creation", response, duration)
    total_time += duration
    
    # 4. Test planner event creation
    print("4️⃣ Testing Planner Event Creation (POST /api/planner/events)")
    target_date = "2026-02-07T00:00:00"
    response, duration = test_create_planner_event(
        TEST_TELEGRAM_ID, 
        "Test planner event", 
        "10:00", 
        "11:30", 
        target_date
    )
    results['create_planner_event'] = print_test_result("Planner Event Creation", response, duration)
    total_time += duration
    
    # 5. Test planner day events
    print("5️⃣ Testing Planner Day Events (GET /api/planner/{telegram_id}/{date})")
    response, duration = test_get_planner_day(TEST_TELEGRAM_ID, "2026-02-07")
    results['get_planner_day'] = print_test_result("Planner Day Events", response, duration)
    total_time += duration
    
    # 6. Test task update (if we have a task ID)
    if created_task_id:
        print("6️⃣ Testing Task Update (PUT /api/tasks/{task_id})")
        response, duration = test_update_task(created_task_id, True)
        results['update_task'] = print_test_result("Task Update", response, duration)
        total_time += duration
    else:
        print("6️⃣ Skipping Task Update (no task ID available)")
        results['update_task'] = False
    
    # 7. Test multiple rapid task creation
    print("7️⃣ Testing Multiple Rapid Task Creation")
    rapid_creation_start = time.time()
    rapid_results = []
    
    for i in range(3):
        text = f"Rapid test task {i+1}"
        response, duration = test_create_task(TEST_TELEGRAM_ID, text)
        success = response.status_code == 200 and duration <= 2.0
        rapid_results.append(success)
        print(f"   Task {i+1}: {'✅' if success else '❌'} ({duration:.3f}s)")
    
    rapid_creation_end = time.time()
    rapid_total_time = rapid_creation_end - rapid_creation_start
    
    results['rapid_creation'] = all(rapid_results) and rapid_total_time <= 5.0
    print(f"   Total time for 3 tasks: {rapid_total_time:.3f}s {'✅' if rapid_total_time <= 5.0 else '❌ SLOW!'}")
    total_time += rapid_total_time
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 PERFORMANCE TEST SUMMARY")
    print("=" * 60)
    
    passed_tests = sum(results.values())
    total_tests = len(results)
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{test_name.replace('_', ' ').title()}: {status}")
    
    print(f"\nTotal Tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {total_tests - passed_tests}")
    print(f"Total Time: {total_time:.3f}s")
    
    if passed_tests == total_tests:
        print("\n🎉 All performance tests PASSED! Backend is performing well.")
        return True
    else:
        print(f"\n⚠️  {total_tests - passed_tests} test(s) FAILED. Performance issues detected.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)