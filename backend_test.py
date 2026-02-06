#!/usr/bin/env python3
"""
Backend API Testing Script for RUDN Schedule Tasks and Planner
Tests all endpoints according to the review request specifications
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
import sys

# Configuration
BASE_URL = "http://localhost:8001/api"
TEST_TELEGRAM_ID = 12345

def print_test_result(test_name, success, details=None):
    """Print formatted test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"   {details}")
    print()

def test_create_task():
    """Test 1: Create a task"""
    print("🔄 Testing: Create Task...")
    
    url = f"{BASE_URL}/tasks"
    payload = {
        "telegram_id": TEST_TELEGRAM_ID,
        "text": "Test Task",
        "category": "study",
        "priority": "high",
        "target_date": "2026-02-07T00:00:00Z",
        "subtasks": ["Subtask 1", "Subtask 2"]
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify required fields
            required_fields = ['id', 'subtasks']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print_test_result("Create Task", False, f"Missing fields: {missing_fields}")
                return None
            
            # Verify subtasks structure
            if isinstance(data['subtasks'], list) and len(data['subtasks']) == 2:
                # Check if subtasks have proper structure (subtask_id, title, completed)
                subtask_valid = True
                for subtask in data['subtasks']:
                    if not all(key in subtask for key in ['subtask_id', 'title', 'completed']):
                        subtask_valid = False
                        break
                
                if subtask_valid:
                    print_test_result("Create Task", True, f"Task created with ID: {data['id']}")
                    return data['id']
                else:
                    print_test_result("Create Task", False, "Subtasks don't have required structure (subtask_id, title, completed)")
                    return None
            else:
                print_test_result("Create Task", False, f"Expected 2 subtasks, got: {data.get('subtasks', [])}")
                return None
        else:
            print_test_result("Create Task", False, f"HTTP {response.status_code}: {response.text}")
            return None
            
    except Exception as e:
        print_test_result("Create Task", False, f"Exception: {str(e)}")
        return None

def test_update_task(task_id):
    """Test 2: Update task with notes and origin"""
    print("🔄 Testing: Update Task (BUG FIX #1 and #2)...")
    
    if not task_id:
        print_test_result("Update Task", False, "No task_id provided (previous test failed)")
        return False
    
    url = f"{BASE_URL}/tasks/{task_id}"
    payload = {
        "notes": "Test notes updated",
        "origin": "schedule"
    }
    
    try:
        response = requests.put(url, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify the updated fields
            if data.get('notes') == "Test notes updated" and data.get('origin') == "schedule":
                print_test_result("Update Task", True, "Task updated successfully with notes and origin")
                return True
            else:
                print_test_result("Update Task", False, f"Fields not updated correctly. notes: {data.get('notes')}, origin: {data.get('origin')}")
                return False
        else:
            print_test_result("Update Task", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Update Task", False, f"Exception: {str(e)}")
        return False

def test_get_tasks():
    """Test 3: Get tasks"""
    print("🔄 Testing: Get Tasks...")
    
    url = f"{BASE_URL}/tasks/{TEST_TELEGRAM_ID}"
    
    try:
        response = requests.get(url, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            if isinstance(data, list):
                # Check if our created task is in the list with updated notes
                test_task_found = False
                for task in data:
                    if task.get('text') == 'Test Task' and task.get('notes') == 'Test notes updated':
                        test_task_found = True
                        break
                
                if test_task_found:
                    print_test_result("Get Tasks", True, f"Found {len(data)} tasks including our test task with updated notes")
                    return True
                else:
                    print_test_result("Get Tasks", False, "Test task with updated notes not found in the list")
                    return False
            else:
                print_test_result("Get Tasks", False, f"Expected list, got: {type(data)}")
                return False
        else:
            print_test_result("Get Tasks", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Get Tasks", False, f"Exception: {str(e)}")
        return False

def test_create_planner_event():
    """Test 4: Create planner event (BUG FIX #3)"""
    print("🔄 Testing: Create Planner Event (BUG FIX #3)...")
    
    url = f"{BASE_URL}/planner/events"
    payload = {
        "telegram_id": TEST_TELEGRAM_ID,
        "text": "Planner Event Test",
        "time_start": "10:00",
        "time_end": "11:30",
        "target_date": "2026-02-07T00:00:00Z",
        "category": "study",
        "priority": "medium",
        "subtasks": ["Step 1", "Step 2"]
    }
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify required fields for planner events
            required_fields = ['id', 'subtasks', 'videos']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print_test_result("Create Planner Event", False, f"Missing fields: {missing_fields}")
                return None
            
            # Verify subtasks are TaskSubtask objects with proper structure
            if isinstance(data['subtasks'], list) and len(data['subtasks']) == 2:
                subtask_valid = True
                for subtask in data['subtasks']:
                    if not all(key in subtask for key in ['subtask_id', 'title', 'completed']):
                        subtask_valid = False
                        break
                
                if subtask_valid and 'videos' in data:
                    print_test_result("Create Planner Event", True, f"Planner event created with ID: {data['id']}")
                    return data['id']
                else:
                    print_test_result("Create Planner Event", False, "Subtasks conversion or videos field issue")
                    return None
            else:
                print_test_result("Create Planner Event", False, f"Expected 2 subtasks, got: {data.get('subtasks', [])}")
                return None
        else:
            print_test_result("Create Planner Event", False, f"HTTP {response.status_code}: {response.text}")
            return None
            
    except Exception as e:
        print_test_result("Create Planner Event", False, f"Exception: {str(e)}")
        return None

def test_get_planner_day_events():
    """Test 5: Get planner day events (BUG FIX #4)"""
    print("🔄 Testing: Get Planner Day Events (BUG FIX #4)...")
    
    url = f"{BASE_URL}/planner/{TEST_TELEGRAM_ID}/2026-02-07"
    
    try:
        response = requests.get(url, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify response structure (PlannerDayResponse)
            required_fields = ['date', 'events', 'total_count']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print_test_result("Get Planner Day Events", False, f"Missing fields: {missing_fields}")
                return False
            
            # Check if events array has proper structure with subtasks progress and videos
            if isinstance(data['events'], list):
                events_valid = True
                for event in data['events']:
                    # Check if event has subtasks progress fields and videos
                    required_event_fields = ['subtasks', 'videos']
                    if not all(field in event for field in required_event_fields):
                        events_valid = False
                        break
                
                if events_valid:
                    print_test_result("Get Planner Day Events", True, f"Found {len(data['events'])} events with proper structure")
                    return True
                else:
                    print_test_result("Get Planner Day Events", False, "Events missing subtasks or videos fields")
                    return False
            else:
                print_test_result("Get Planner Day Events", False, f"Expected events array, got: {type(data.get('events'))}")
                return False
        else:
            print_test_result("Get Planner Day Events", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Get Planner Day Events", False, f"Exception: {str(e)}")
        return False

def test_get_productivity_stats():
    """Test 6: Get productivity stats (BUG FIX #6)"""
    print("🔄 Testing: Get Productivity Stats (BUG FIX #6)...")
    
    url = f"{BASE_URL}/tasks/{TEST_TELEGRAM_ID}/productivity-stats"
    
    try:
        response = requests.get(url, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify daily_stats array contains 7 days
            if 'daily_stats' in data and isinstance(data['daily_stats'], list):
                if len(data['daily_stats']) == 7:
                    print_test_result("Get Productivity Stats", True, f"Stats returned with 7 days of data")
                    return True
                else:
                    print_test_result("Get Productivity Stats", False, f"Expected 7 days, got: {len(data['daily_stats'])}")
                    return False
            else:
                print_test_result("Get Productivity Stats", False, "Missing or invalid daily_stats field")
                return False
        else:
            print_test_result("Get Productivity Stats", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Get Productivity Stats", False, f"Exception: {str(e)}")
        return False

def cleanup_tasks():
    """Test 7: Cleanup - delete created tasks"""
    print("🔄 Testing: Cleanup Created Tasks...")
    
    # First get all tasks
    url = f"{BASE_URL}/tasks/{TEST_TELEGRAM_ID}"
    
    try:
        response = requests.get(url, timeout=30)
        
        if response.status_code != 200:
            print_test_result("Cleanup Tasks", False, f"Failed to get tasks: HTTP {response.status_code}")
            return False
        
        tasks = response.json()
        deleted_count = 0
        
        # Delete tasks that match our test data
        for task in tasks:
            if task.get('text') in ['Test Task', 'Planner Event Test']:
                delete_url = f"{BASE_URL}/tasks/{task['id']}"
                try:
                    delete_response = requests.delete(delete_url, timeout=30)
                    if delete_response.status_code in [200, 204]:
                        deleted_count += 1
                    else:
                        print(f"   Failed to delete task {task['id']}: HTTP {delete_response.status_code}")
                except Exception as e:
                    print(f"   Exception deleting task {task['id']}: {str(e)}")
        
        print_test_result("Cleanup Tasks", True, f"Deleted {deleted_count} test tasks")
        return True
        
    except Exception as e:
        print_test_result("Cleanup Tasks", False, f"Exception: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting RUDN Schedule Backend API Tests")
    print(f"Backend URL: {BASE_URL}")
    print(f"Test Telegram ID: {TEST_TELEGRAM_ID}")
    print("=" * 60)
    
    results = {}
    
    # Test 1: Create Task
    task_id = test_create_task()
    results['create_task'] = task_id is not None
    
    # Test 2: Update Task (depends on Test 1)
    results['update_task'] = test_update_task(task_id)
    
    # Test 3: Get Tasks
    results['get_tasks'] = test_get_tasks()
    
    # Test 4: Create Planner Event
    planner_event_id = test_create_planner_event()
    results['create_planner_event'] = planner_event_id is not None
    
    # Test 5: Get Planner Day Events
    results['get_planner_day_events'] = test_get_planner_day_events()
    
    # Test 6: Get Productivity Stats
    results['get_productivity_stats'] = test_get_productivity_stats()
    
    # Test 7: Cleanup
    results['cleanup'] = cleanup_tasks()
    
    # Summary
    print("=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name.replace('_', ' ').title()}")
    
    print()
    print(f"Overall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed. Check the details above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())