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
def main():
    """Main test execution"""
    print("🚀 Starting Backend API Testing for Productivity Stats API")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Test productivity statistics API
    success = test_productivity_stats_api()
    
    print("=" * 80)
    if success:
        print("🎉 ALL TESTS PASSED - Productivity Stats API Working Correctly!")
    else:
        print("💥 TESTS FAILED - Issues found in Productivity Stats API")
    print("=" * 80)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
