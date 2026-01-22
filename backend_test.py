#!/usr/bin/env python3
"""
Backend API Testing Script for Task Update with Skipped Field
Tests the task update API with skipped field as specified in the review request.
"""

import requests
import json
import sys
from urllib.parse import urlparse, parse_qs

# Backend URL - use localhost since external URL is not accessible in this environment
BACKEND_URL = "http://localhost:8001"
API_BASE = f"{BACKEND_URL}/api"

# Test user as specified in the review request
TEST_USER_ID = 765963392  # существующий в БД

def test_get_user_tasks():
    """
    Step 1: Get tasks for user 765963392
    GET /api/tasks/765963392 (for regular tasks)
    GET /api/planner/765963392/2026-01-22 (for planner events)
    """
    print("🔍 Step 1: Testing GET /api/tasks/765963392...")
    
    try:
        url = f"{API_BASE}/tasks/{TEST_USER_ID}"
        print(f"📡 Making request to: {url}")
        
        response = requests.get(url, timeout=15)
        print(f"📊 Response Status: {response.status_code}")
        print(f"📋 Response Headers: {dict(response.headers)}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            print(f"📄 Response body: {response.text}")
            return False, None
        
        try:
            data = response.json()
            print(f"📄 Response JSON: {json.dumps(data, indent=2, ensure_ascii=False)}")
        except json.JSONDecodeError:
            print(f"❌ FAILED: Response is not valid JSON")
            print(f"📄 Response body: {response.text}")
            return False, None
        
        # Validate response structure
        if not isinstance(data, list):
            print(f"❌ FAILED: Expected list response, got {type(data)}")
            return False, None
        
        print(f"✅ GET tasks API test PASSED - Found {len(data)} regular tasks")
        
        # Also get planner events
        planner_success, planner_events = get_planner_tasks()
        if planner_success:
            # Combine regular tasks and planner events
            all_tasks = data + planner_events
            print(f"✅ Combined: {len(data)} regular tasks + {len(planner_events)} planner events = {len(all_tasks)} total")
            return True, all_tasks
        else:
            return True, data
        
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Network error - {e}")
        return False, None
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {e}")
        return False, None


def get_planner_tasks():
    """
    Get tasks from planner endpoint since tasks with time_start and time_end are planner events
    GET /api/planner/765963392/2026-01-22
    """
    print("🔍 Getting tasks from planner endpoint...")
    
    try:
        url = f"{API_BASE}/planner/{TEST_USER_ID}/2026-01-22"
        print(f"📡 Making request to: {url}")
        
        response = requests.get(url, timeout=15)
        print(f"📊 Response Status: {response.status_code}")
        print(f"📋 Response Headers: {dict(response.headers)}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            print(f"📄 Response body: {response.text}")
            return False, None
        
        try:
            data = response.json()
            print(f"📄 Response JSON: {json.dumps(data, indent=2, ensure_ascii=False)}")
        except json.JSONDecodeError:
            print(f"❌ FAILED: Response is not valid JSON")
            print(f"📄 Response body: {response.text}")
            return False, None
        
        # Extract events from planner response
        events = data.get('events', [])
        print(f"✅ GET planner tasks PASSED - Found {len(events)} events")
        return True, events
        
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Network error - {e}")
        return False, None
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {e}")
        return False, None
    """
    Step 1: Get tasks for user 765963392
    GET /api/tasks/765963392 (for regular tasks)
    GET /api/planner/765963392/2026-01-22 (for planner events)
    """
    print("🔍 Step 1: Testing GET /api/tasks/765963392...")
    
    try:
        url = f"{API_BASE}/tasks/{TEST_USER_ID}"
        print(f"📡 Making request to: {url}")
        
        response = requests.get(url, timeout=15)
        print(f"📊 Response Status: {response.status_code}")
        print(f"📋 Response Headers: {dict(response.headers)}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            print(f"📄 Response body: {response.text}")
            return False, None
        
        try:
            data = response.json()
            print(f"📄 Response JSON: {json.dumps(data, indent=2, ensure_ascii=False)}")
        except json.JSONDecodeError:
            print(f"❌ FAILED: Response is not valid JSON")
            print(f"📄 Response body: {response.text}")
            return False, None
        
        # Validate response structure
        if not isinstance(data, list):
            print(f"❌ FAILED: Expected list response, got {type(data)}")
            return False, None
        
        print(f"✅ GET tasks API test PASSED - Found {len(data)} regular tasks")
        
        # Also get planner events
        planner_success, planner_events = get_planner_tasks()
        if planner_success:
            # Combine regular tasks and planner events
            all_tasks = data + planner_events
            print(f"✅ Combined: {len(data)} regular tasks + {len(planner_events)} planner events = {len(all_tasks)} total")
            return True, all_tasks
        else:
            return True, data
        
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Network error - {e}")
        return False, None
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {e}")
        return False, None


def create_test_task_if_needed():
    """
    Create a test task with origin='user' if no tasks exist for the user
    """
    print("🔍 Creating test task with origin='user'...")
    
    try:
        url = f"{API_BASE}/tasks"
        payload = {
            "telegram_id": TEST_USER_ID,
            "text": "Test task for skipped field testing",
            "origin": "user",
            "time_start": "10:00",
            "time_end": "11:00",
            "target_date": "2026-01-22T00:00:00Z",
            "subtasks": []
        }
        print(f"📡 Making request to: {url} with payload: {payload}")
        
        response = requests.post(url, json=payload, timeout=15)
        print(f"📊 Response Status: {response.status_code}")
        print(f"📋 Response Headers: {dict(response.headers)}")
        
        if response.status_code not in [200, 201]:
            print(f"❌ FAILED: Expected status 200/201, got {response.status_code}")
            print(f"📄 Response body: {response.text}")
            return False, None
        
        try:
            data = response.json()
            print(f"📄 Response JSON: {json.dumps(data, indent=2, ensure_ascii=False)}")
        except json.JSONDecodeError:
            print(f"❌ FAILED: Response is not valid JSON")
            print(f"📄 Response body: {response.text}")
            return False, None
        
        print("✅ Test task created successfully")
        return True, data
        
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Network error - {e}")
        return False, None
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {e}")
        return False, None
def find_user_origin_task(tasks):
    """
    Step 2: Find a task with origin="user" (пользовательское событие планировщика)
    """
    print("🔍 Step 2: Looking for task with origin='user'...")
    
    user_tasks = [task for task in tasks if task.get("origin") == "user"]
    
    if not user_tasks:
        print("❌ No tasks with origin='user' found")
        return None
    
    # Prefer tasks that are not completed and not skipped
    preferred_task = None
    for task in user_tasks:
        if not task.get("completed", False) and not task.get("skipped", False):
            preferred_task = task
            break
    
    # If no preferred task, take the first one
    selected_task = preferred_task or user_tasks[0]
    
    print(f"✅ Found task with origin='user': ID={selected_task['id']}, text='{selected_task['text'][:50]}...', completed={selected_task.get('completed', False)}, skipped={selected_task.get('skipped', False)}")
    return selected_task


def test_update_task_with_skipped(task_id):
    """
    Step 3: Update task with skipped=true
    PUT /api/tasks/{task_id}
    Body: {"skipped": true}
    """
    print(f"🔍 Step 3: Testing PUT /api/tasks/{task_id} with skipped=true...")
    
    try:
        url = f"{API_BASE}/tasks/{task_id}"
        payload = {"skipped": True}
        print(f"📡 Making request to: {url} with payload: {payload}")
        
        response = requests.put(url, json=payload, timeout=15)
        print(f"📊 Response Status: {response.status_code}")
        print(f"📋 Response Headers: {dict(response.headers)}")
        
        if response.status_code not in [200, 201]:
            print(f"❌ FAILED: Expected status 200/201, got {response.status_code}")
            print(f"📄 Response body: {response.text}")
            return False, None
        
        try:
            data = response.json()
            print(f"📄 Response JSON: {json.dumps(data, indent=2, ensure_ascii=False)}")
        except json.JSONDecodeError:
            print(f"❌ FAILED: Response is not valid JSON")
            print(f"📄 Response body: {response.text}")
            return False, None
        
        # Check if skipped field is present and set to true
        if 'skipped' not in data:
            print(f"❌ FAILED: Missing 'skipped' field in response")
            return False, None
        
        if data.get('skipped') != True:
            print(f"❌ FAILED: Expected skipped=true, got skipped={data.get('skipped')}")
            return False, None
        
        print("✅ Update task with skipped=true PASSED")
        return True, data
        
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Network error - {e}")
        return False, None
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {e}")
        return False, None


def test_verify_task_skipped(task_id):
    """
    Step 4: Verify that skipped field is saved by getting the task again
    GET /api/tasks/765963392 and check the specific task
    """
    print(f"🔍 Step 4: Verifying skipped field is saved for task {task_id}...")
    
    try:
        url = f"{API_BASE}/tasks/{TEST_USER_ID}"
        print(f"📡 Making request to: {url}")
        
        response = requests.get(url, timeout=15)
        print(f"📊 Response Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            print(f"📄 Response body: {response.text}")
            return False
        
        try:
            data = response.json()
        except json.JSONDecodeError:
            print(f"❌ FAILED: Response is not valid JSON")
            print(f"📄 Response body: {response.text}")
            return False
        
        # Find the specific task
        target_task = None
        for task in data:
            if task.get('id') == task_id:
                target_task = task
                break
        
        if not target_task:
            print(f"❌ FAILED: Task {task_id} not found in response")
            return False
        
        # Check skipped field
        if 'skipped' not in target_task:
            print(f"❌ FAILED: Missing 'skipped' field in task {task_id}")
            return False
        
        if target_task.get('skipped') != True:
            print(f"❌ FAILED: Expected skipped=true, got skipped={target_task.get('skipped')}")
            return False
        
        print(f"✅ Task {task_id} skipped field verification PASSED - skipped={target_task.get('skipped')}")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Network error - {e}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {e}")
        return False


def test_planner_endpoint_skipped():
    """
    Step 5: Check planner endpoint for skipped field
    GET /api/planner/765963392/2026-01-22
    """
    print("🔍 Step 5: Testing GET /api/planner/765963392/2026-01-22...")
    
    try:
        url = f"{API_BASE}/planner/{TEST_USER_ID}/2026-01-22"
        print(f"📡 Making request to: {url}")
        
        response = requests.get(url, timeout=15)
        print(f"📊 Response Status: {response.status_code}")
        print(f"📋 Response Headers: {dict(response.headers)}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            print(f"📄 Response body: {response.text}")
            return False
        
        try:
            data = response.json()
            print(f"📄 Response JSON: {json.dumps(data, indent=2, ensure_ascii=False)}")
        except json.JSONDecodeError:
            print(f"❌ FAILED: Response is not valid JSON")
            print(f"📄 Response body: {response.text}")
            return False
        
        # Validate response structure
        if 'events' not in data:
            print(f"❌ FAILED: Missing 'events' field in response")
            return False
        
        if not isinstance(data['events'], list):
            print(f"❌ FAILED: Expected 'events' to be a list, got {type(data['events'])}")
            return False
        
        # Check if any events have skipped field
        events_with_skipped = []
        for event in data['events']:
            if 'skipped' in event:
                events_with_skipped.append(event)
        
        if events_with_skipped:
            print(f"✅ Planner endpoint test PASSED - Found {len(events_with_skipped)} events with 'skipped' field")
            for event in events_with_skipped[:3]:  # Show first 3 events
                print(f"   Event: {event.get('text', 'No text')[:30]}... skipped={event.get('skipped')}")
        else:
            print(f"⚠️ Planner endpoint test - No events with 'skipped' field found (may be expected if no events on this date)")
        
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Network error - {e}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {e}")
        return False


def main():
    """Run Task Update with Skipped Field API Tests"""
    print("🚀 Starting Task Update with Skipped Field API Tests")
    print("=" * 60)
    
    # Step 1: Get user tasks
    success, tasks = test_get_user_tasks()
    if not success:
        print("\n💥 Cannot proceed - failed to get user tasks")
        return 1
    
    # If no tasks, create a test task
    if not tasks:
        print("\n📝 No tasks found, creating a test task...")
        success, created_task = create_test_task_if_needed()
        if not success:
            print("\n💥 Cannot proceed - failed to create test task")
            return 1
        
        # Get tasks again after creating
        success, tasks = test_get_user_tasks()
        if not success or not tasks:
            print("\n💥 Cannot proceed - failed to get tasks after creation")
            return 1
    
    # Step 2: Find task with origin="user"
    user_task = find_user_origin_task(tasks)
    if not user_task:
        print("\n💥 Cannot proceed - no task with origin='user' found")
        return 1
    
    task_id = user_task['id']
    
    # Step 3: Update task with skipped=true
    success, updated_task = test_update_task_with_skipped(task_id)
    if not success:
        print(f"\n💥 Failed to update task {task_id} with skipped=true")
        return 1
    
    # Step 4: Verify skipped field is saved
    success = test_verify_task_skipped(task_id)
    if not success:
        print(f"\n💥 Failed to verify skipped field for task {task_id}")
        return 1
    
    # Step 5: Check planner endpoint
    success = test_planner_endpoint_skipped()
    if not success:
        print("\n💥 Failed to test planner endpoint")
        return 1
    
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    print("✅ Step 1: GET /api/tasks/765963392 - PASSED")
    print("✅ Step 2: Found task with origin='user' - PASSED")
    print("✅ Step 3: PUT /api/tasks/{task_id} with skipped=true - PASSED")
    print("✅ Step 4: Verified skipped field is saved - PASSED")
    print("✅ Step 5: GET /api/planner/765963392/2026-01-22 - PASSED")
    
    print(f"\n🎉 All tests PASSED! Task {task_id} successfully updated with skipped=true")
    return 0

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)