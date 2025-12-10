#!/usr/bin/env python3
"""
Comprehensive Backend API Testing Script for РУДН Schedule App
Testing Study Streaks (Стрик-режим) functionality as requested in review
"""

import requests
import json
import sys
from datetime import datetime
import time

# Backend URL configuration
BACKEND_URL = "http://localhost:8001"
API_BASE = f"{BACKEND_URL}/api"

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_emoji = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"[{timestamp}] {status_emoji} {test_name}")
    if details:
        print(f"    {details}")
    print()
def test_productivity_stats_api():
    """Test the Productivity Stats API as requested in review"""
    print("=" * 80)
    print("🔍 TESTING PRODUCTIVITY STATS API")
    print("=" * 80)
    
    try:
        # Test Scenario 1: Request with non-existent telegram_id - should return empty stats
        log_test("Scenario 1: Testing non-existent telegram_id", "INFO", "Should return empty statistics")
        
        non_existent_telegram_id = 999999999
        response = requests.get(f"{API_BASE}/tasks/{non_existent_telegram_id}/productivity-stats", timeout=10)
        
        if response.status_code != 200:
            log_test("GET /api/tasks/{telegram_id}/productivity-stats (non-existent)", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        stats_response = response.json()
        
        # Validate empty stats structure
        expected_fields = [
            "total_completed", "completed_today", "completed_this_week", 
            "completed_this_month", "current_streak", "best_streak", 
            "streak_dates", "daily_stats"
        ]
        
        for field in expected_fields:
            if field not in stats_response:
                log_test("Empty Stats Structure Validation", "FAIL", f"Missing field '{field}' in response")
                return False
        
        # Check that all numeric fields are 0 for non-existent user
        numeric_fields = ["total_completed", "completed_today", "completed_this_week", "completed_this_month", "current_streak", "best_streak"]
        for field in numeric_fields:
            if stats_response.get(field) != 0:
                log_test("Empty Stats Values Validation", "FAIL", f"Expected {field}=0 for non-existent user, got {stats_response.get(field)}")
                return False
        
        # Check that streak_dates is empty array
        if stats_response.get("streak_dates") != []:
            log_test("Empty Streak Dates Validation", "FAIL", f"Expected empty streak_dates array, got {stats_response.get('streak_dates')}")
            return False
            
        log_test("Scenario 1: Non-existent telegram_id", "PASS", "Returns correct empty statistics")
        
        # Test Scenario 2: Check daily_stats contains exactly 7 elements
        log_test("Scenario 2: Testing daily_stats array length", "INFO", "Should contain exactly 7 elements")
        
        daily_stats = stats_response.get("daily_stats", [])
        if len(daily_stats) != 7:
            log_test("Daily Stats Length Validation", "FAIL", f"Expected 7 elements in daily_stats, got {len(daily_stats)}")
            return False
            
        log_test("Scenario 2: Daily stats length", "PASS", "Contains exactly 7 elements")
        
        # Test Scenario 3: Check day_name contains Russian day names
        log_test("Scenario 3: Testing Russian day names", "INFO", "Should contain Пн, Вт, Ср, Чт, Пт, Сб, Вс")
        
        expected_day_names = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
        actual_day_names = [day.get("day_name") for day in daily_stats]
        
        # Check that all expected day names are present (order may vary)
        for expected_day in expected_day_names:
            if expected_day not in actual_day_names:
                log_test("Russian Day Names Validation", "FAIL", f"Missing Russian day name '{expected_day}'. Got: {actual_day_names}")
                return False
        
        # Validate daily_stats structure
        required_daily_fields = ["date", "day_name", "count", "has_completed"]
        for i, day_stat in enumerate(daily_stats):
            for field in required_daily_fields:
                if field not in day_stat:
                    log_test("Daily Stats Field Validation", "FAIL", f"Day {i}: Missing field '{field}'")
                    return False
            
            # Validate data types
            if not isinstance(day_stat.get("count"), int):
                log_test("Daily Stats Type Validation", "FAIL", f"Day {i}: count should be integer, got {type(day_stat.get('count'))}")
                return False
                
            if not isinstance(day_stat.get("has_completed"), bool):
                log_test("Daily Stats Type Validation", "FAIL", f"Day {i}: has_completed should be boolean, got {type(day_stat.get('has_completed'))}")
                return False
                
        log_test("Scenario 3: Russian day names", "PASS", "All Russian day names present and correctly formatted")
        
        # Test Scenario 4: Check all numeric fields >= 0
        log_test("Scenario 4: Testing numeric fields >= 0", "INFO", "All numeric fields should be non-negative")
        
        all_numeric_fields = ["total_completed", "completed_today", "completed_this_week", "completed_this_month", "current_streak", "best_streak"]
        
        for field in all_numeric_fields:
            value = stats_response.get(field)
            if not isinstance(value, int) or value < 0:
                log_test("Numeric Fields Validation", "FAIL", f"Field '{field}' should be non-negative integer, got {value}")
                return False
        
        # Also check daily_stats counts are >= 0
        for i, day_stat in enumerate(daily_stats):
            count = day_stat.get("count")
            if count < 0:
                log_test("Daily Stats Count Validation", "FAIL", f"Day {i}: count should be >= 0, got {count}")
                return False
                
        log_test("Scenario 4: Numeric fields validation", "PASS", "All numeric fields are non-negative")
        
        # Test with existing user (create some test data)
        log_test("Scenario 5: Testing with real user data", "INFO", "Creating test user and tasks")
        
        test_telegram_id = 123456789
        
        # Create a test task to verify the endpoint works with real data
        task_data = {
            "telegram_id": test_telegram_id,
            "text": "Тестовая задача для проверки статистики",
            "completed": True,
            "category": "work",
            "priority": "medium"
        }
        
        # Try to create a task (this might fail if tasks API is not working, but that's ok)
        try:
            task_response = requests.post(f"{API_BASE}/tasks", json=task_data, timeout=10)
            if task_response.status_code == 200:
                log_test("Test Task Creation", "PASS", "Created test task successfully")
            else:
                log_test("Test Task Creation", "INFO", f"Could not create test task (Status: {task_response.status_code}), continuing with existing data")
        except Exception as e:
            log_test("Test Task Creation", "INFO", f"Could not create test task ({str(e)}), continuing with existing data")
        
        # Test the productivity stats with the test user
        response = requests.get(f"{API_BASE}/tasks/{test_telegram_id}/productivity-stats", timeout=10)
        
        if response.status_code != 200:
            log_test("GET /api/tasks/{telegram_id}/productivity-stats (real user)", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        real_stats = response.json()
        
        # Validate the same structure requirements
        for field in expected_fields:
            if field not in real_stats:
                log_test("Real User Stats Structure Validation", "FAIL", f"Missing field '{field}' in response")
                return False
        
        # Check daily_stats length again
        real_daily_stats = real_stats.get("daily_stats", [])
        if len(real_daily_stats) != 7:
            log_test("Real User Daily Stats Length", "FAIL", f"Expected 7 elements in daily_stats, got {len(real_daily_stats)}")
            return False
        
        # Check Russian day names again
        real_day_names = [day.get("day_name") for day in real_daily_stats]
        for expected_day in expected_day_names:
            if expected_day not in real_day_names:
                log_test("Real User Russian Day Names", "FAIL", f"Missing Russian day name '{expected_day}'. Got: {real_day_names}")
                return False
        
        # Check numeric fields are non-negative
        for field in all_numeric_fields:
            value = real_stats.get(field)
            if not isinstance(value, int) or value < 0:
                log_test("Real User Numeric Fields", "FAIL", f"Field '{field}' should be non-negative integer, got {value}")
                return False
        
        log_test("Scenario 5: Real user data", "PASS", f"All validations passed. Stats: total={real_stats.get('total_completed')}, today={real_stats.get('completed_today')}, streak={real_stats.get('current_streak')}")
        
        log_test("Productivity Stats API", "PASS", "All test scenarios completed successfully!")
        
        return True
        
    except requests.exceptions.RequestException as e:
        log_test("Network Error", "FAIL", f"Request failed: {str(e)}")
        return False
    except Exception as e:
        log_test("Unexpected Error", "FAIL", f"Error: {str(e)}")
        return False
def test_study_streaks_functionality():
    """Test Study Streaks (Стрик-режим) functionality as requested in review"""
    print("=" * 80)
    print("🔥 TESTING STUDY STREAKS (СТРИК-РЕЖИМ) FUNCTIONALITY")
    print("=" * 80)
    
    test_telegram_id = 999888777
    created_task_ids = []
    
    try:
        # Step 1: Create a task for test user
        log_test("Step 1: Creating task for test user", "INFO", f"telegram_id: {test_telegram_id}")
        
        task_data = {
            "telegram_id": test_telegram_id,
            "text": "Тестовая задача для streak",
            "category": "study"
        }
        
        response = requests.post(f"{API_BASE}/tasks", json=task_data, timeout=10)
        
        if response.status_code != 200:
            log_test("POST /api/tasks", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        task_response = response.json()
        task_id = task_response.get("id")
        created_task_ids.append(task_id)
        
        # Validate task creation response
        if not task_id:
            log_test("Task Creation Validation", "FAIL", "No task ID returned")
            return False
            
        if task_response.get("telegram_id") != test_telegram_id:
            log_test("Task Creation Validation", "FAIL", f"Wrong telegram_id: expected {test_telegram_id}, got {task_response.get('telegram_id')}")
            return False
            
        if task_response.get("text") != "Тестовая задача для streak":
            log_test("Task Creation Validation", "FAIL", f"Wrong text: expected 'Тестовая задача для streak', got {task_response.get('text')}")
            return False
            
        if task_response.get("category") != "study":
            log_test("Task Creation Validation", "FAIL", f"Wrong category: expected 'study', got {task_response.get('category')}")
            return False
            
        if task_response.get("completed") != False:
            log_test("Task Creation Validation", "FAIL", f"Task should be incomplete initially, got {task_response.get('completed')}")
            return False
            
        log_test("Step 1: Task creation", "PASS", f"Task created successfully with ID: {task_id}")
        
        # Step 2: Complete the created task
        log_test("Step 2: Completing the created task", "INFO", f"task_id: {task_id}")
        
        update_data = {"completed": True}
        response = requests.put(f"{API_BASE}/tasks/{task_id}", json=update_data, timeout=10)
        
        if response.status_code != 200:
            log_test("PUT /api/tasks/{task_id}", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        updated_task = response.json()
        
        # Validate task completion
        if updated_task.get("completed") != True:
            log_test("Task Completion Validation", "FAIL", f"Task should be completed, got {updated_task.get('completed')}")
            return False
            
        # Check that completed_at field is set
        completed_at = updated_task.get("completed_at")
        if not completed_at:
            log_test("Task Completion Validation", "FAIL", "completed_at field should be set when task is completed")
            return False
            
        log_test("Step 2: Task completion", "PASS", f"Task completed successfully at {completed_at}")
        
        # Step 3: Check productivity stats
        log_test("Step 3: Checking productivity stats", "INFO", "Should show current_streak >= 1 and completed_today >= 1")
        
        response = requests.get(f"{API_BASE}/tasks/{test_telegram_id}/productivity-stats", timeout=10)
        
        if response.status_code != 200:
            log_test("GET /api/tasks/{telegram_id}/productivity-stats", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        stats = response.json()
        
        # Validate productivity stats structure
        required_fields = ["total_completed", "completed_today", "completed_this_week", "completed_this_month", 
                          "current_streak", "best_streak", "streak_dates", "daily_stats"]
        
        for field in required_fields:
            if field not in stats:
                log_test("Productivity Stats Structure", "FAIL", f"Missing field '{field}' in response")
                return False
        
        # Check that current_streak >= 1 (if task completed today)
        current_streak = stats.get("current_streak")
        if current_streak < 1:
            log_test("Current Streak Validation", "FAIL", f"Expected current_streak >= 1, got {current_streak}")
            return False
            
        # Check that completed_today >= 1
        completed_today = stats.get("completed_today")
        if completed_today < 1:
            log_test("Completed Today Validation", "FAIL", f"Expected completed_today >= 1, got {completed_today}")
            return False
            
        # Check daily_stats shows has_completed: true for today
        daily_stats = stats.get("daily_stats", [])
        if len(daily_stats) != 7:
            log_test("Daily Stats Length", "FAIL", f"Expected 7 elements in daily_stats, got {len(daily_stats)}")
            return False
            
        # Find today's entry (should be the last one in the array)
        today_entry = daily_stats[-1]  # Last entry should be today
        if not today_entry.get("has_completed"):
            log_test("Today's Completion Status", "FAIL", f"Today's entry should show has_completed: true, got {today_entry.get('has_completed')}")
            return False
            
        log_test("Step 3: Productivity stats check", "PASS", 
                f"Stats validated - current_streak: {current_streak}, completed_today: {completed_today}, today_has_completed: {today_entry.get('has_completed')}")
        
        # Step 4: Create and complete another task to test counter increment
        log_test("Step 4: Creating and completing second task", "INFO", "Testing counter increments")
        
        task_data_2 = {
            "telegram_id": test_telegram_id,
            "text": "Вторая тестовая задача для streak",
            "category": "study"
        }
        
        response = requests.post(f"{API_BASE}/tasks", json=task_data_2, timeout=10)
        
        if response.status_code != 200:
            log_test("POST /api/tasks (second)", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        task_response_2 = response.json()
        task_id_2 = task_response_2.get("id")
        created_task_ids.append(task_id_2)
        
        # Complete the second task
        update_data_2 = {"completed": True}
        response = requests.put(f"{API_BASE}/tasks/{task_id_2}", json=update_data_2, timeout=10)
        
        if response.status_code != 200:
            log_test("PUT /api/tasks/{task_id} (second)", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        # Check updated stats
        response = requests.get(f"{API_BASE}/tasks/{test_telegram_id}/productivity-stats", timeout=10)
        
        if response.status_code != 200:
            log_test("GET /api/tasks/{telegram_id}/productivity-stats (after second task)", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        updated_stats = response.json()
        
        # Validate that counters increased
        new_completed_today = updated_stats.get("completed_today")
        if new_completed_today <= completed_today:
            log_test("Counter Increment Validation", "FAIL", f"completed_today should have increased from {completed_today} to at least {completed_today + 1}, got {new_completed_today}")
            return False
            
        log_test("Step 4: Second task completion", "PASS", 
                f"Counters incremented correctly - completed_today: {completed_today} → {new_completed_today}")
        
        # Step 5: Test uncompleting a task (set completed: false)
        log_test("Step 5: Testing task uncompletion", "INFO", "Setting completed: false and checking stats update")
        
        uncomplete_data = {"completed": False}
        response = requests.put(f"{API_BASE}/tasks/{task_id}", json=uncomplete_data, timeout=10)
        
        if response.status_code != 200:
            log_test("PUT /api/tasks/{task_id} (uncomplete)", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        uncompleted_task = response.json()
        
        # Validate task is now incomplete
        if uncompleted_task.get("completed") != False:
            log_test("Task Uncompletion Validation", "FAIL", f"Task should be incomplete, got {uncompleted_task.get('completed')}")
            return False
            
        # Check that completed_at field is cleared
        completed_at_after_uncomplete = uncompleted_task.get("completed_at")
        if completed_at_after_uncomplete is not None:
            log_test("Task Uncompletion Validation", "FAIL", f"completed_at should be None after uncompleting, got {completed_at_after_uncomplete}")
            return False
            
        # Check updated stats after uncompleting
        response = requests.get(f"{API_BASE}/tasks/{test_telegram_id}/productivity-stats", timeout=10)
        
        if response.status_code != 200:
            log_test("GET /api/tasks/{telegram_id}/productivity-stats (after uncomplete)", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        final_stats = response.json()
        
        # Validate that stats updated correctly
        final_completed_today = final_stats.get("completed_today")
        if final_completed_today >= new_completed_today:
            log_test("Uncompletion Stats Validation", "FAIL", f"completed_today should have decreased from {new_completed_today}, got {final_completed_today}")
            return False
            
        log_test("Step 5: Task uncompletion", "PASS", 
                f"Stats updated correctly after uncompleting - completed_today: {new_completed_today} → {final_completed_today}")
        
        # Final validation: Check all required fields are present and valid
        log_test("Final Validation: Complete stats structure", "INFO", "Validating all fields and data types")
        
        # Validate all numeric fields are non-negative integers
        numeric_fields = ["total_completed", "completed_today", "completed_this_week", "completed_this_month", "current_streak", "best_streak"]
        for field in numeric_fields:
            value = final_stats.get(field)
            if not isinstance(value, int) or value < 0:
                log_test("Final Stats Validation", "FAIL", f"Field '{field}' should be non-negative integer, got {value} ({type(value)})")
                return False
        
        # Validate streak_dates is a list
        streak_dates = final_stats.get("streak_dates")
        if not isinstance(streak_dates, list):
            log_test("Final Stats Validation", "FAIL", f"streak_dates should be a list, got {type(streak_dates)}")
            return False
            
        # Validate daily_stats structure
        daily_stats = final_stats.get("daily_stats", [])
        if len(daily_stats) != 7:
            log_test("Final Stats Validation", "FAIL", f"daily_stats should have 7 elements, got {len(daily_stats)}")
            return False
            
        for i, day_stat in enumerate(daily_stats):
            required_day_fields = ["date", "day_name", "count", "has_completed"]
            for field in required_day_fields:
                if field not in day_stat:
                    log_test("Final Stats Validation", "FAIL", f"Day {i}: Missing field '{field}'")
                    return False
                    
            # Validate data types
            if not isinstance(day_stat.get("count"), int) or day_stat.get("count") < 0:
                log_test("Final Stats Validation", "FAIL", f"Day {i}: count should be non-negative integer, got {day_stat.get('count')}")
                return False
                
            if not isinstance(day_stat.get("has_completed"), bool):
                log_test("Final Stats Validation", "FAIL", f"Day {i}: has_completed should be boolean, got {type(day_stat.get('has_completed'))}")
                return False
        
        log_test("Final Validation: Complete stats structure", "PASS", "All fields validated successfully")
        
        log_test("Study Streaks Functionality", "PASS", "All test scenarios completed successfully!")
        
        return True
        
    except requests.exceptions.RequestException as e:
        log_test("Network Error", "FAIL", f"Request failed: {str(e)}")
        return False
    except Exception as e:
        log_test("Unexpected Error", "FAIL", f"Error: {str(e)}")
        return False
    finally:
        # Cleanup: Delete created test tasks
        if created_task_ids:
            log_test("Cleanup: Deleting test tasks", "INFO", f"Deleting {len(created_task_ids)} test tasks")
            for task_id in created_task_ids:
                try:
                    requests.delete(f"{API_BASE}/tasks/{task_id}", timeout=5)
                except:
                    pass  # Ignore cleanup errors

def test_notification_history_system():
    """Test Notification History System as it needs retesting"""
    print("=" * 80)
    print("📋 TESTING NOTIFICATION HISTORY SYSTEM")
    print("=" * 80)
    
    test_telegram_id = 999888777
    
    try:
        # Test 1: Get notification history for user
        log_test("Test 1: Getting notification history", "INFO", f"telegram_id: {test_telegram_id}")
        
        response = requests.get(f"{API_BASE}/user-settings/{test_telegram_id}/history", timeout=10)
        
        if response.status_code != 200:
            log_test("GET /api/user-settings/{telegram_id}/history", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        history_response = response.json()
        
        # Validate response structure
        required_fields = ["history", "count"]
        for field in required_fields:
            if field not in history_response:
                log_test("History Response Structure", "FAIL", f"Missing field '{field}' in response")
                return False
        
        # Validate data types
        history = history_response.get("history")
        count = history_response.get("count")
        
        if not isinstance(history, list):
            log_test("History Response Validation", "FAIL", f"history should be a list, got {type(history)}")
            return False
            
        if not isinstance(count, int) or count < 0:
            log_test("History Response Validation", "FAIL", f"count should be non-negative integer, got {count} ({type(count)})")
            return False
        
        log_test("Test 1: Notification history retrieval", "PASS", f"Retrieved {count} history items successfully")
        
        # Test 2: Test with pagination parameters
        log_test("Test 2: Testing pagination parameters", "INFO", "limit=5, offset=0")
        
        response = requests.get(f"{API_BASE}/user-settings/{test_telegram_id}/history?limit=5&offset=0", timeout=10)
        
        if response.status_code != 200:
            log_test("GET /api/user-settings/{telegram_id}/history (with params)", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        paginated_response = response.json()
        
        # Validate pagination works
        paginated_history = paginated_response.get("history", [])
        if len(paginated_history) > 5:
            log_test("Pagination Validation", "FAIL", f"Expected max 5 items with limit=5, got {len(paginated_history)}")
            return False
        
        log_test("Test 2: Pagination parameters", "PASS", f"Pagination working correctly, returned {len(paginated_history)} items")
        
        # Test 3: Validate history item structure (if any items exist)
        if history:
            log_test("Test 3: Validating history item structure", "INFO", "Checking first history item")
            
            first_item = history[0]
            expected_item_fields = ["telegram_id", "notification_type", "message", "sent_at", "status"]
            
            for field in expected_item_fields:
                if field not in first_item:
                    log_test("History Item Structure", "FAIL", f"Missing field '{field}' in history item")
                    return False
            
            # Validate data types
            if first_item.get("telegram_id") != test_telegram_id:
                log_test("History Item Validation", "FAIL", f"Wrong telegram_id in history item: expected {test_telegram_id}, got {first_item.get('telegram_id')}")
                return False
                
            if not isinstance(first_item.get("message"), str):
                log_test("History Item Validation", "FAIL", f"message should be string, got {type(first_item.get('message'))}")
                return False
                
            if not isinstance(first_item.get("sent_at"), str):
                log_test("History Item Validation", "FAIL", f"sent_at should be string (ISO datetime), got {type(first_item.get('sent_at'))}")
                return False
            
            log_test("Test 3: History item structure", "PASS", "History item structure is valid")
        else:
            log_test("Test 3: History item structure", "PASS", "No history items to validate (empty history)")
        
        log_test("Notification History System", "PASS", "All test scenarios completed successfully!")
        
        return True
        
    except requests.exceptions.RequestException as e:
        log_test("Network Error", "FAIL", f"Request failed: {str(e)}")
        return False
    except Exception as e:
        log_test("Unexpected Error", "FAIL", f"Error: {str(e)}")
        return False

def main():
    """Main test execution"""
    print("🚀 Starting Backend API Testing for Study Streaks (Стрик-режим) and Notification History")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Test Study Streaks functionality as requested
    streaks_success = test_study_streaks_functionality()
    
    # Test Notification History System (needs retesting)
    history_success = test_notification_history_system()
    
    overall_success = streaks_success and history_success
    
    print("=" * 80)
    if overall_success:
        print("🎉 ALL TESTS PASSED - Both Study Streaks and Notification History Working Correctly!")
    else:
        print("💥 SOME TESTS FAILED - Issues found in backend functionality")
        if not streaks_success:
            print("   ❌ Study Streaks functionality has issues")
        if not history_success:
            print("   ❌ Notification History system has issues")
    print("=" * 80)
    
    return 0 if overall_success else 1

if __name__ == "__main__":
    sys.exit(main())
