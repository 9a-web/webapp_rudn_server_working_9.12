#!/usr/bin/env python3
"""
Comprehensive Backend API Testing Script for РУДН Schedule App
Testing referral event tracking system as requested in review
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
def test_referral_event_tracking():
    """Test the new referral event tracking system as requested in review"""
    print("=" * 80)
    print("🔍 TESTING REFERRAL EVENT TRACKING SYSTEM")
    print("=" * 80)
    
    # Test data as specified in review request
    creator_telegram_id = 123456789
    creator_name = "Тестер"
    room_name = "Тестовая комната"
    
    joiner_telegram_id = 987654321
    joiner_name = "Новый участник"
    
    try:
        # Step 1: Create room (POST /api/rooms)
        log_test("Step 1: Creating room", "INFO", f"Creating room with telegram_id={creator_telegram_id}")
        
        room_data = {
            "telegram_id": creator_telegram_id,
            "name": room_name,
            "first_name": creator_name
        }
        
        response = requests.post(f"{API_BASE}/rooms", json=room_data, timeout=10)
        
        if response.status_code != 200:
            log_test("POST /api/rooms", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        room_response = response.json()
        room_id = room_response.get("room_id")
        
        if not room_id:
            log_test("POST /api/rooms", "FAIL", "No room_id in response")
            return False
            
        log_test("POST /api/rooms", "PASS", f"Room created successfully. ID: {room_id}")
        
        # Step 2: Generate invite link (POST /api/rooms/{room_id}/invite-link)
        log_test("Step 2: Generating invite link", "INFO", f"Generating invite link for room {room_id}")
        
        invite_data = {
            "telegram_id": creator_telegram_id
        }
        
        response = requests.post(f"{API_BASE}/rooms/{room_id}/invite-link", json=invite_data, timeout=10)
        
        if response.status_code != 200:
            log_test("POST /api/rooms/{room_id}/invite-link", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        invite_response = response.json()
        invite_token = invite_response.get("invite_token")
        invite_link = invite_response.get("invite_link")
        
        if not invite_token:
            log_test("POST /api/rooms/{room_id}/invite-link", "FAIL", "No invite_token in response")
            return False
            
        log_test("POST /api/rooms/{room_id}/invite-link", "PASS", f"Invite link generated. Token: {invite_token}")
        print(f"    Invite link: {invite_link}")
        
        # Step 3: Join by link with referral tracking (POST /api/rooms/join/{invite_token})
        log_test("Step 3: Joining room via invite link", "INFO", f"User {joiner_telegram_id} joining via token {invite_token}")
        
        join_data = {
            "telegram_id": joiner_telegram_id,
            "first_name": joiner_name,
            "referral_code": creator_telegram_id  # ID of the inviter as specified in review
        }
        
        response = requests.post(f"{API_BASE}/rooms/join/{invite_token}", json=join_data, timeout=10)
        
        if response.status_code != 200:
            log_test("POST /api/rooms/join/{invite_token}", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        join_response = response.json()
        
        if not join_response.get("success"):
            log_test("POST /api/rooms/join/{invite_token}", "FAIL", f"Join failed: {join_response}")
            return False
            
        log_test("POST /api/rooms/join/{invite_token}", "PASS", f"Successfully joined room. Response: {join_response}")
        
        # Wait a moment for the referral event to be processed
        time.sleep(1)
        
        # Step 4: Check general stats (GET /api/admin/stats)
        log_test("Step 4: Checking general admin stats", "INFO", "Verifying room join statistics")
        
        response = requests.get(f"{API_BASE}/admin/stats", timeout=10)
        
        if response.status_code != 200:
            log_test("GET /api/admin/stats", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        stats_response = response.json()
        
        total_room_joins = stats_response.get("total_room_joins", 0)
        room_joins_today = stats_response.get("room_joins_today", 0)
        
        log_test("GET /api/admin/stats", "PASS", f"Stats retrieved successfully")
        print(f"    Total room joins: {total_room_joins}")
        print(f"    Room joins today: {room_joins_today}")
        
        # Verify expected values
        if total_room_joins < 1:
            log_test("Admin Stats Validation", "FAIL", f"Expected total_room_joins >= 1, got {total_room_joins}")
            return False
            
        if room_joins_today < 1:
            log_test("Admin Stats Validation", "FAIL", f"Expected room_joins_today >= 1, got {room_joins_today}")
            return False
            
        log_test("Admin Stats Validation", "PASS", "Room join statistics are correct")
        
        # Step 5: Check detailed referral stats (GET /api/admin/referral-stats)
        log_test("Step 5: Checking detailed referral stats", "INFO", "Verifying referral event tracking")
        
        response = requests.get(f"{API_BASE}/admin/referral-stats", timeout=10)
        
        if response.status_code != 200:
            log_test("GET /api/admin/referral-stats", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        referral_stats = response.json()
        
        total_events = referral_stats.get("total_events", 0)
        recent_events = referral_stats.get("recent_events", [])
        top_referrers = referral_stats.get("top_referrers", [])
        
        log_test("GET /api/admin/referral-stats", "PASS", f"Referral stats retrieved successfully")
        print(f"    Total events: {total_events}")
        print(f"    Recent events count: {len(recent_events)}")
        print(f"    Top referrers count: {len(top_referrers)}")
        
        # Verify expected values
        if total_events < 1:
            log_test("Referral Stats Validation", "FAIL", f"Expected total_events >= 1, got {total_events}")
            return False
            
        # Check for room_join event in recent events
        room_join_found = False
        for event in recent_events:
            if (event.get("event_type") == "room_join" and 
                event.get("telegram_id") == joiner_telegram_id and
                event.get("referrer_id") == creator_telegram_id):
                room_join_found = True
                log_test("Recent Events Validation", "PASS", f"Found room_join event: {event}")
                break
        
        if not room_join_found:
            log_test("Recent Events Validation", "FAIL", "No matching room_join event found in recent_events")
            print(f"    Recent events: {recent_events}")
            return False
        
        # Check for referrer in top_referrers
        referrer_found = False
        for referrer in top_referrers:
            if referrer.get("referrer_id") == creator_telegram_id:
                referrer_found = True
                log_test("Top Referrers Validation", "PASS", f"Found referrer {creator_telegram_id} in top_referrers: {referrer}")
                break
        
        if not referrer_found:
            log_test("Top Referrers Validation", "FAIL", f"Referrer {creator_telegram_id} not found in top_referrers")
            print(f"    Top referrers: {top_referrers}")
            return False
        
        log_test("Referral Event Tracking System", "PASS", "All referral tracking functionality working correctly!")
        
        return True
        
    except requests.exceptions.RequestException as e:
        log_test("Network Error", "FAIL", f"Request failed: {str(e)}")
        return False
    except Exception as e:
        log_test("Unexpected Error", "FAIL", f"Error: {str(e)}")
        return False
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
    if not response or "room_id" not in response:
        log_test("Add participant 1", "FAIL", "Failed to add participant 1")
        return False
    
    # Add second participant
    participant_2_data = {
        "telegram_id": TEST_PARTICIPANT_2,
        "username": "test_participant_2", 
        "first_name": "Test Participant 2"
    }
    
    response = make_request("POST", f"/rooms/join/{invite_token}", participant_2_data, 200)
    if not response or "room_id" not in response:
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
