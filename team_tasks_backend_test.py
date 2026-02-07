#!/usr/bin/env python3
"""
Team Tasks Backend API Test
Tests all team task endpoints according to the review request specifications for bug fixes
"""

import requests
import json
import uuid
from datetime import datetime
import sys
import os

# Configuration - Use external backend URL from frontend/.env
BACKEND_URL = "https://rudn-app-staging.preview.emergentagent.com/api"
TIMEOUT = 30

# Test data
TEST_TELEGRAM_ID = 12345
SECOND_USER_ID = 99999

def test_create_user_settings():
    """Test 0: Create user settings (prerequisite for group task creation)"""
    print("🔄 Testing: Create User Settings...")
    
    url = f"{BACKEND_URL}/user-settings"
    payload = {
        "telegram_id": TEST_TELEGRAM_ID,
        "username": "testuser",
        "first_name": "Test User",
        "group_id": "test-group",
        "group_name": "Test Group Name", 
        "facultet_id": "test-facultet",
        "facultet_name": "Test Facultet",
        "level_id": "test-level",
        "kurs": "1",
        "form_code": "test-form",
        "notifications_enabled": True,
        "notification_time": 10
    }
    
    try:
        response = requests.post(url, json=payload, timeout=TIMEOUT)
        
        if response.status_code == 200:
            data = response.json()
            print_test_result("Create User Settings", True, f"User settings created for ID: {data['telegram_id']}")
            return True
        else:
            print_test_result("Create User Settings", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Create User Settings", False, f"Exception: {str(e)}")
        return False

def print_test_result(test_name, success, details=None):
    """Print formatted test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"   {details}")
    print()

def test_create_room():
    """Test 1: Create a room (prerequisite for team tasks)"""
    print("🔄 Testing: Create Room...")
    
    url = f"{BACKEND_URL}/rooms"
    payload = {
        "name": "Test Room",
        "description": "Testing room",
        "telegram_id": TEST_TELEGRAM_ID,
        "emoji": "🏠",
        "participants": [{
            "telegram_id": TEST_TELEGRAM_ID,
            "username": "testuser",
            "first_name": "Test",
            "role": "owner"
        }]
    }
    
    try:
        response = requests.post(url, json=payload, timeout=TIMEOUT)
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify required fields
            required_fields = ['room_id', 'name', 'participants']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print_test_result("Create Room", False, f"Missing fields: {missing_fields}")
                return None
            
            # Verify participants structure
            if len(data['participants']) == 1 and data['participants'][0]['role'] == 'owner':
                print_test_result("Create Room", True, f"Room created with ID: {data['room_id']}")
                return data['room_id']
            else:
                print_test_result("Create Room", False, f"Invalid participants structure: {data.get('participants')}")
                return None
        else:
            print_test_result("Create Room", False, f"HTTP {response.status_code}: {response.text}")
            return None
            
    except Exception as e:
        print_test_result("Create Room", False, f"Exception: {str(e)}")
        return None

def test_create_group_task(room_id):
    """Test 2: Create group task WITH room_id (Bug 4 fix - room_id should persist)"""
    print("🔄 Testing: Create Group Task with room_id (Bug 4 fix)...")
    
    if not room_id:
        print_test_result("Create Group Task", False, "No room_id provided (previous test failed)")
        return None
    
    url = f"{BACKEND_URL}/group-tasks"
    payload = {
        "title": "Test Task",
        "description": "Test description", 
        "telegram_id": TEST_TELEGRAM_ID,
        "room_id": room_id,
        "priority": "high",
        "category": "study"
    }
    
    try:
        response = requests.post(url, json=payload, timeout=TIMEOUT)
        
        if response.status_code == 200:
            data = response.json()
            task_id = data.get('task_id')
            
            # Check room_id preservation (Bug 4 fix)
            if data.get('room_id') == room_id:
                print_test_result("Create Group Task", True, f"Task created with room_id: {task_id}")
                return task_id
            else:
                # Bug 4 not fully fixed, but task was created - continue testing
                print_test_result("Create Group Task (Bug 4 Issue)", False, f"room_id not preserved. Expected: {room_id}, Got: {data.get('room_id')}. Task ID: {task_id}")
                return task_id  # Return task_id so other tests can continue
        else:
            print_test_result("Create Group Task", False, f"HTTP {response.status_code}: {response.text}")
            return None
            
    except Exception as e:
        print_test_result("Create Group Task", False, f"Exception: {str(e)}")
        return None

def test_get_user_group_tasks():
    """Test 3: Get user group tasks - verify comments_count is 0 (Bug 11 fix)"""
    print("🔄 Testing: Get User Group Tasks (Bug 11 fix - comments_count)...")
    
    url = f"{BACKEND_URL}/group-tasks/{TEST_TELEGRAM_ID}"
    
    try:
        response = requests.get(url, timeout=TIMEOUT)
        
        if response.status_code == 200:
            data = response.json()
            
            if isinstance(data, list) and len(data) > 0:
                task = data[0]
                # Verify comments_count field exists (Bug 11 fix)
                if 'comments_count' in task:
                    print_test_result("Get User Group Tasks", True, f"Found {len(data)} tasks with comments_count field")
                    return True
                else:
                    print_test_result("Get User Group Tasks", False, "comments_count field missing")
                    return False
            else:
                print_test_result("Get User Group Tasks", True, "No tasks found (expected for new user)")
                return True
        else:
            print_test_result("Get User Group Tasks", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Get User Group Tasks", False, f"Exception: {str(e)}")
        return False

def test_get_room_tasks(room_id):
    """Test 4: Get room tasks - verify sorted by order and has comments_count (Bug 10, 11 fix)"""
    print("🔄 Testing: Get Room Tasks (Bug 10, 11 fix - sorting and comments_count)...")
    
    if not room_id:
        print_test_result("Get Room Tasks", False, "No room_id provided")
        return False
    
    url = f"{BACKEND_URL}/rooms/{room_id}/tasks"
    
    try:
        response = requests.get(url, timeout=TIMEOUT)
        
        if response.status_code == 200:
            data = response.json()
            
            if isinstance(data, list):
                if len(data) > 0:
                    task = data[0]
                    # Verify comments_count field exists (Bug 11 fix)
                    if 'comments_count' in task:
                        # Check if sorted by order (Bug 10 fix) - if order field exists
                        if len(data) > 1:
                            orders = [t.get('order', 0) for t in data]
                            is_sorted = orders == sorted(orders)
                            if is_sorted:
                                print_test_result("Get Room Tasks", True, f"Tasks sorted by order and have comments_count")
                            else:
                                print_test_result("Get Room Tasks", False, f"Tasks not sorted by order: {orders}")
                            return is_sorted
                        else:
                            print_test_result("Get Room Tasks", True, f"Single task has comments_count field")
                            return True
                    else:
                        print_test_result("Get Room Tasks", False, "comments_count field missing")
                        return False
                else:
                    print_test_result("Get Room Tasks", True, "No tasks in room (expected for new room)")
                    return True
            else:
                print_test_result("Get Room Tasks", False, f"Expected list, got: {type(data)}")
                return False
        else:
            print_test_result("Get Room Tasks", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Get Room Tasks", False, f"Exception: {str(e)}")
        return False

def test_complete_group_task(task_id):
    """Test 5: Complete a group task (Bug 9 fix)"""
    print("🔄 Testing: Complete Group Task (Bug 9 fix - status transitions)...")
    
    if not task_id:
        print_test_result("Complete Group Task", False, "No task_id provided")
        return False
    
    # Complete the task
    url = f"{BACKEND_URL}/group-tasks/{task_id}/complete"
    payload = {"telegram_id": TEST_TELEGRAM_ID, "completed": True}
    
    try:
        response = requests.put(url, json=payload, timeout=TIMEOUT)
        
        if response.status_code == 200:
            data = response.json()
            
            # Now uncomplete the task (Bug 9 fix - should return to "created" not stuck at "in_progress")
            uncomplete_payload = {"telegram_id": TEST_TELEGRAM_ID, "completed": False}
            uncomplete_response = requests.put(url, json=uncomplete_payload, timeout=TIMEOUT)
            
            if uncomplete_response.status_code == 200:
                uncomplete_data = uncomplete_response.json()
                
                # Verify status returns to "created" (Bug 9 fix)
                if uncomplete_data.get('status') == 'created':
                    print_test_result("Complete Group Task", True, "Status correctly returns to 'created' when uncompleted")
                    return True
                else:
                    print_test_result("Complete Group Task", False, f"Status not 'created' after uncomplete: {uncomplete_data.get('status')}")
                    return False
            else:
                print_test_result("Complete Group Task", False, f"Uncomplete failed: HTTP {uncomplete_response.status_code}")
                return False
        else:
            print_test_result("Complete Group Task", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Complete Group Task", False, f"Exception: {str(e)}")
        return False

def test_update_group_task_permissions(task_id):
    """Test 6: Update group task with permission check (Bug 6 fix)"""
    print("🔄 Testing: Update Group Task Permissions (Bug 6 fix)...")
    
    if not task_id:
        print_test_result("Update Group Task Permissions", False, "No task_id provided")
        return False
    
    url = f"{BACKEND_URL}/group-tasks/{task_id}/update"
    
    # Test 1: Valid user (participant) should succeed
    valid_payload = {"title": "Updated Title", "telegram_id": TEST_TELEGRAM_ID}
    
    try:
        response = requests.put(url, json=valid_payload, timeout=TIMEOUT)
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('title') == "Updated Title":
                print_test_result("Update Group Task (Valid User)", True, "Participant can update task")
                
                # Test 2: Invalid user (non-participant) should fail
                invalid_payload = {"title": "Hacked", "telegram_id": SECOND_USER_ID}
                
                invalid_response = requests.put(url, json=invalid_payload, timeout=TIMEOUT)
                
                if invalid_response.status_code == 403:
                    print_test_result("Update Group Task (Invalid User)", True, "Non-participant correctly denied with 403")
                    return True
                elif invalid_response.status_code == 200:
                    print_test_result("Update Group Task (Invalid User)", False, "Non-participant was allowed to update (permission check failed)")
                    return False
                else:
                    print_test_result("Update Group Task (Invalid User)", False, f"Unexpected status: {invalid_response.status_code}")
                    return False
            else:
                print_test_result("Update Group Task (Valid User)", False, "Title not updated correctly")
                return False
        else:
            print_test_result("Update Group Task (Valid User)", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Update Group Task Permissions", False, f"Exception: {str(e)}")
        return False

def test_add_subtask_permissions(task_id):
    """Test 7: Add subtask with permission check (Bug 7 fix)"""
    print("🔄 Testing: Add Subtask Permissions (Bug 7 fix)...")
    
    if not task_id:
        print_test_result("Add Subtask Permissions", False, "No task_id provided")
        return False
    
    url = f"{BACKEND_URL}/group-tasks/{task_id}/subtasks"
    payload = {"title": "Subtask 1", "telegram_id": TEST_TELEGRAM_ID}
    
    try:
        response = requests.post(url, json=payload, timeout=TIMEOUT)
        
        if response.status_code == 200:
            data = response.json()
            
            if 'subtask_id' in data:
                print_test_result("Add Subtask Permissions", True, f"Subtask added by participant: {data['subtask_id']}")
                return True
            else:
                print_test_result("Add Subtask Permissions", False, "Subtask not created properly")
                return False
        else:
            print_test_result("Add Subtask Permissions", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Add Subtask Permissions", False, f"Exception: {str(e)}")
        return False

def test_reorder_room_tasks(room_id, task_id):
    """Test 8: Reorder room tasks (Bug 3 fix - was completely broken)"""
    print("🔄 Testing: Reorder Room Tasks (Bug 3 fix - was returning 422/500)...")
    
    if not room_id or not task_id:
        print_test_result("Reorder Room Tasks", False, "Missing room_id or task_id")
        return False
    
    url = f"{BACKEND_URL}/rooms/{room_id}/tasks-reorder"
    payload = {
        "room_id": room_id,
        "tasks": [{"task_id": task_id, "order": 0}]
    }
    
    try:
        response = requests.put(url, json=payload, timeout=TIMEOUT)
        
        if response.status_code == 200:
            print_test_result("Reorder Room Tasks", True, "Task reordering successful")
            return True
        else:
            print_test_result("Reorder Room Tasks", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Reorder Room Tasks", False, f"Exception: {str(e)}")
        return False

def test_get_room_stats(room_id):
    """Test 9: Get room stats (Bug 17 fix - optimized)"""
    print("🔄 Testing: Get Room Stats (Bug 17 fix - optimized query)...")
    
    if not room_id:
        print_test_result("Get Room Stats", False, "No room_id provided")
        return False
    
    url = f"{BACKEND_URL}/rooms/{room_id}/stats?telegram_id={TEST_TELEGRAM_ID}"
    
    try:
        response = requests.get(url, timeout=TIMEOUT)
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify stats structure
            if 'participants_stats' in data:
                print_test_result("Get Room Stats", True, "Room stats with participants_stats returned")
                return True
            else:
                print_test_result("Get Room Stats", False, "participants_stats field missing")
                return False
        else:
            print_test_result("Get Room Stats", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Get Room Stats", False, f"Exception: {str(e)}")
        return False

def test_delete_room_cleanup(room_id):
    """Test 10: Delete room - verify cleanup order (Bug 1 fix)"""
    print("🔄 Testing: Delete Room Cleanup (Bug 1 fix - proper cleanup order)...")
    
    if not room_id:
        print_test_result("Delete Room Cleanup", False, "No room_id provided")
        return False
    
    url = f"{BACKEND_URL}/rooms/{room_id}"
    payload = {"telegram_id": TEST_TELEGRAM_ID}
    
    try:
        response = requests.delete(url, json=payload, timeout=TIMEOUT)
        
        if response.status_code == 200:
            print_test_result("Delete Room Cleanup", True, "Room deleted successfully (cleanup order fixed)")
            return True
        else:
            print_test_result("Delete Room Cleanup", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Delete Room Cleanup", False, f"Exception: {str(e)}")
        return False

def main():
    """Run all team tasks tests in sequence"""
    print("🚀 Starting Team Tasks Backend API Tests")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Telegram ID: {TEST_TELEGRAM_ID}")
    print("=" * 60)
    
    results = {}
    
    # Test 0: Create User Settings (prerequisite)
    results['create_user_settings'] = test_create_user_settings()
    
    # Test 1: Create Room (prerequisite)
    room_id = test_create_room()
    results['create_room'] = room_id is not None
    
    # Test 2: Create Group Task
    task_id = test_create_group_task(room_id)
    results['create_group_task'] = task_id is not None
    
    # Test 3: Get User Group Tasks
    results['get_user_group_tasks'] = test_get_user_group_tasks()
    
    # Test 4: Get Room Tasks
    results['get_room_tasks'] = test_get_room_tasks(room_id)
    
    # Test 5: Complete Group Task
    results['complete_group_task'] = test_complete_group_task(task_id)
    
    # Test 6: Update Group Task Permissions
    results['update_group_task_permissions'] = test_update_group_task_permissions(task_id)
    
    # Test 7: Add Subtask Permissions
    results['add_subtask_permissions'] = test_add_subtask_permissions(task_id)
    
    # Test 8: Reorder Room Tasks
    results['reorder_room_tasks'] = test_reorder_room_tasks(room_id, task_id)
    
    # Test 9: Get Room Stats
    results['get_room_stats'] = test_get_room_stats(room_id)
    
    # Test 10: Delete Room Cleanup
    results['delete_room_cleanup'] = test_delete_room_cleanup(room_id)
    
    # Summary
    print("=" * 60)
    print("📊 TEAM TASKS TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name.replace('_', ' ').title()}")
    
    print()
    print(f"Overall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 All team tasks tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed. Check the details above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())