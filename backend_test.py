#!/usr/bin/env python3
"""
Backend API Testing Script for assigned_to functionality in group tasks
Tests the new assigned_to functionality for group tasks as requested in the review.
"""

import requests
import json
import sys
from datetime import datetime, timedelta

# Backend URL - using local backend since external URL is not accessible
BACKEND_URL = "http://localhost:8001"
API_BASE = f"{BACKEND_URL}/api"

# Test data
TEST_CREATOR_ID = 123456789
TEST_PARTICIPANT_1 = 987654321
TEST_PARTICIPANT_2 = 555666777
TEST_ROOM_NAME = "Test Room for assigned_to functionality"
TEST_ROOM_COLOR = "blue"

def log_test(test_name, status, details=""):
    """Log test results"""
    status_symbol = "✅" if status == "PASS" else "❌"
    print(f"{status_symbol} {test_name}")
    if details:
        print(f"   {details}")
    print()

def make_request(method, endpoint, data=None, expected_status=200):
    """Make HTTP request and handle errors"""
    url = f"{API_BASE}{endpoint}"
    try:
        if method == "GET":
            response = requests.get(url)
        elif method == "POST":
            response = requests.post(url, json=data)
        elif method == "PUT":
            response = requests.put(url, json=data)
        elif method == "DELETE":
            response = requests.delete(url, json=data)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        print(f"   {method} {endpoint} -> {response.status_code}")
        
        if response.status_code != expected_status:
            print(f"   Expected {expected_status}, got {response.status_code}")
            print(f"   Response: {response.text}")
            return None
        
        return response.json() if response.content else {}
    except Exception as e:
        print(f"   Request failed: {e}")
        return None
def test_create_room():
    """Test 1: Create test room"""
    print("🧪 Test 1: Create test room")
    
    room_data = {
        "name": TEST_ROOM_NAME,
        "description": "Test room for assigned_to functionality testing",
        "telegram_id": TEST_CREATOR_ID,
        "color": TEST_ROOM_COLOR
    }
    
    response = make_request("POST", "/rooms", room_data, 200)
    if response and "room_id" in response:
        log_test("Create room", "PASS", f"Room ID: {response['room_id']}")
        return response["room_id"]
    else:
        log_test("Create room", "FAIL", "Failed to create room")
        return None

def test_add_participants_to_room(room_id):
    """Test 2: Add participants to room"""
    print("🧪 Test 2: Add participants to room")
    
    # First, get room invite token
    response = make_request("POST", f"/rooms/{room_id}/invite-link", {"telegram_id": TEST_CREATOR_ID}, 200)
    if not response or "invite_token" not in response:
        log_test("Get room invite token", "FAIL", "Failed to get invite token")
        return False
    
    invite_token = response["invite_token"]
    
    # Add first participant
    participant_1_data = {
        "telegram_id": TEST_PARTICIPANT_1,
        "username": "test_participant_1",
        "first_name": "Test Participant 1"
    }
    
    response = make_request("POST", f"/rooms/join/{invite_token}", participant_1_data, 200)
    if not response or not response.get("success"):
        log_test("Add participant 1", "FAIL", "Failed to add participant 1")
        return False
    
    # Add second participant
    participant_2_data = {
        "telegram_id": TEST_PARTICIPANT_2,
        "username": "test_participant_2", 
        "first_name": "Test Participant 2"
    }
    
    response = make_request("POST", f"/rooms/join/{invite_token}", participant_2_data, 200)
    if not response or not response.get("success"):
        log_test("Add participant 2", "FAIL", "Failed to add participant 2")
        return False
    
    log_test("Add participants to room", "PASS", "Both participants added successfully")
    return True

def test_get_room_participants(room_id):
    """Test 3: Get room participants (need at least 2)"""
    print("🧪 Test 3: Get room participants")
    
    response = make_request("GET", f"/rooms/detail/{room_id}", None, 200)
    if not response:
        log_test("Get room participants", "FAIL", "Failed to get room details")
        return None
    
    participants = response.get("participants", [])
    participant_count = len(participants)
    
    if participant_count < 2:
        log_test("Get room participants", "FAIL", f"Only {participant_count} participants, need at least 2")
        return None
    
    participant_ids = [p["telegram_id"] for p in participants]
    log_test("Get room participants", "PASS", f"Found {participant_count} participants: {participant_ids}")
    return participants

def test_task_creation_assigned_to_null(room_id):
    """Test 4: Test task creation with assigned_to: null (should add ALL participants)"""
    print("🧪 Test 4: Task creation with assigned_to: null")
    
    task_data = {
        "title": "Test task all participants",
        "description": "Task with assigned_to: null should include all participants",
        "telegram_id": TEST_CREATOR_ID,
        "priority": "medium",
        "assigned_to": None  # This should add ALL participants
    }
    
    response = make_request("POST", f"/rooms/{room_id}/tasks", task_data, 200)
    if not response:
        log_test("Task creation with assigned_to: null", "FAIL", "Failed to create task")
        return None
    
    task_id = response.get("task_id")
    participants = response.get("participants", [])
    participant_count = len(participants)
    
    # Should have 3 participants: creator + 2 added participants
    if participant_count != 3:
        log_test("Task creation with assigned_to: null", "FAIL", 
                f"Expected 3 participants, got {participant_count}")
        return None
    
    participant_ids = [p["telegram_id"] for p in participants]
    expected_ids = {TEST_CREATOR_ID, TEST_PARTICIPANT_1, TEST_PARTICIPANT_2}
    actual_ids = set(participant_ids)
    
    if actual_ids != expected_ids:
        log_test("Task creation with assigned_to: null", "FAIL", 
                f"Expected participants {expected_ids}, got {actual_ids}")
        return None
    
    log_test("Task creation with assigned_to: null", "PASS", 
            f"All 3 participants added: {participant_ids}")
    return task_id

def test_task_creation_specific_assigned_to(room_id):
    """Test 5: Test task creation with specific assigned_to"""
    print("🧪 Test 5: Task creation with specific assigned_to")
    
    task_data = {
        "title": "Test task specific participant",
        "description": "Task assigned to specific participant only",
        "telegram_id": TEST_CREATOR_ID,
        "priority": "medium",
        "assigned_to": [TEST_PARTICIPANT_1]  # Only assign to participant 1
    }
    
    response = make_request("POST", f"/rooms/{room_id}/tasks", task_data, 200)
    if not response:
        log_test("Task creation with specific assigned_to", "FAIL", "Failed to create task")
        return None
    
    task_id = response.get("task_id")
    participants = response.get("participants", [])
    participant_count = len(participants)
    
    # Should have 2 participants: creator + participant 1 only
    if participant_count != 2:
        log_test("Task creation with specific assigned_to", "FAIL", 
                f"Expected 2 participants, got {participant_count}")
        return None
    
    participant_ids = [p["telegram_id"] for p in participants]
    expected_ids = {TEST_CREATOR_ID, TEST_PARTICIPANT_1}
    actual_ids = set(participant_ids)
    
    if actual_ids != expected_ids:
        log_test("Task creation with specific assigned_to", "FAIL", 
                f"Expected participants {expected_ids}, got {actual_ids}")
        return None
    
    # Verify participant 2 is NOT in the task
    if TEST_PARTICIPANT_2 in actual_ids:
        log_test("Task creation with specific assigned_to", "FAIL", 
                f"Participant 2 should not be in task but was found")
        return None
    
    log_test("Task creation with specific assigned_to", "PASS", 
            f"Only creator and participant 1 added: {participant_ids}")
    return task_id

def test_task_update_assigned_to_empty_list(task_id):
    """Test 6: Test task update with assigned_to: [] (reassign to ALL)"""
    print("🧪 Test 6: Task update with assigned_to: [] (reassign to ALL)")
    
    update_data = {
        "assigned_to": []  # Empty list should add ALL participants
    }
    
    response = make_request("PUT", f"/group-tasks/{task_id}/update", update_data, 200)
    if not response:
        log_test("Task update with assigned_to: []", "FAIL", "Failed to update task")
        return False
    
    participants = response.get("participants", [])
    participant_count = len(participants)
    
    # Should now have 3 participants: creator + 2 participants
    if participant_count != 3:
        log_test("Task update with assigned_to: []", "FAIL", 
                f"Expected 3 participants after update, got {participant_count}")
        return False
    
    participant_ids = [p["telegram_id"] for p in participants]
    expected_ids = {TEST_CREATOR_ID, TEST_PARTICIPANT_1, TEST_PARTICIPANT_2}
    actual_ids = set(participant_ids)
    
    if actual_ids != expected_ids:
        log_test("Task update with assigned_to: []", "FAIL", 
                f"Expected participants {expected_ids}, got {actual_ids}")
        return False
    
    log_test("Task update with assigned_to: []", "PASS", 
            f"All 3 participants now in task: {participant_ids}")
    return True

def test_task_update_specific_assigned_to(task_id):
    """Test 7: Test task update with specific assigned_to"""
    print("🧪 Test 7: Task update with specific assigned_to")
    
    update_data = {
        "assigned_to": [TEST_PARTICIPANT_2]  # Only assign to participant 2
    }
    
    response = make_request("PUT", f"/group-tasks/{task_id}/update", update_data, 200)
    if not response:
        log_test("Task update with specific assigned_to", "FAIL", "Failed to update task")
        return False
    
    participants = response.get("participants", [])
    participant_count = len(participants)
    
    # Should have 2 participants: creator + participant 2 only
    if participant_count != 2:
        log_test("Task update with specific assigned_to", "FAIL", 
                f"Expected 2 participants after update, got {participant_count}")
        return False
    
    participant_ids = [p["telegram_id"] for p in participants]
    expected_ids = {TEST_CREATOR_ID, TEST_PARTICIPANT_2}
    actual_ids = set(participant_ids)
    
    if actual_ids != expected_ids:
        log_test("Task update with specific assigned_to", "FAIL", 
                f"Expected participants {expected_ids}, got {actual_ids}")
        return False
    
    # Verify participant 1 is NOT in the task anymore
    if TEST_PARTICIPANT_1 in actual_ids:
        log_test("Task update with specific assigned_to", "FAIL", 
                f"Participant 1 should not be in task but was found")
        return False
    
    log_test("Task update with specific assigned_to", "PASS", 
            f"Only creator and participant 2 in task: {participant_ids}")
    return True

def cleanup_test_data(room_id, task_ids):
    """Clean up test data"""
    print("🧹 Cleaning up test data...")
    
    # Delete tasks
    for task_id in task_ids:
        if task_id:
            make_request("DELETE", f"/group-tasks/{task_id}", 
                        {"telegram_id": TEST_CREATOR_ID}, 200)
    
    # Note: We don't delete the room as there's no delete room endpoint in the current API
    print("   Test tasks cleaned up")

def main():
    """Main test function"""
    print("🚀 Starting assigned_to functionality tests for group tasks")
    print(f"Backend URL: {BACKEND_URL}")
    print("=" * 60)
    
    # Track created resources for cleanup
    room_id = None
    task_ids = []
    
    try:
        # Test 1: Create room
        room_id = test_create_room()
        if not room_id:
            print("❌ Cannot continue without room")
            return False
        
        # Test 2: Add participants to room
        if not test_add_participants_to_room(room_id):
            print("❌ Cannot continue without participants")
            return False
        
        # Test 3: Get room participants
        participants = test_get_room_participants(room_id)
        if not participants:
            print("❌ Cannot continue without participants")
            return False
        
        # Test 4: Task creation with assigned_to: null
        task_id_1 = test_task_creation_assigned_to_null(room_id)
        if task_id_1:
            task_ids.append(task_id_1)
        
        # Test 5: Task creation with specific assigned_to
        task_id_2 = test_task_creation_specific_assigned_to(room_id)
        if task_id_2:
            task_ids.append(task_id_2)
        
        # Test 6: Task update with assigned_to: []
        if task_id_2:
            test_task_update_assigned_to_empty_list(task_id_2)
        
        # Test 7: Task update with specific assigned_to
        if task_id_2:
            test_task_update_specific_assigned_to(task_id_2)
        
        print("=" * 60)
        print("✅ All assigned_to functionality tests completed!")
        return True
        
    except Exception as e:
        print(f"❌ Test execution failed: {e}")
        return False
    
    finally:
        # Cleanup
        if room_id and task_ids:
            cleanup_test_data(room_id, task_ids)

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
