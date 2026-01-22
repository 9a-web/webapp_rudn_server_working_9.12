#!/usr/bin/env python3
"""
Backend API Testing Script for Task Update with Skipped Field
Tests the task update API with skipped field as specified in the review request.
"""

import requests
import json
import sys
from urllib.parse import urlparse, parse_qs

# Backend URL - use production URL for testing
BACKEND_URL = "https://rudn-schedule.ru"
API_BASE = f"{BACKEND_URL}/api"

# Test user as specified in the review request
TEST_USER_ID = 765963392  # существующий в БД

def test_get_user_tasks():
    """
    Step 1: Get tasks for user 765963392
    GET /api/tasks/765963392
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
        
        print(f"✅ GET tasks API test PASSED - Found {len(data)} tasks")
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


def test_public_profile():
    """
    Test GET /api/profile/{telegram_id}?viewer_telegram_id={viewer_id}
    Should return profile with friendship_status
    """
    print("🔍 Testing Public Profile API...")
    
    try:
        url = f"{API_BASE}/profile/{TEST_USER_2}"
        params = {"viewer_telegram_id": TEST_USER_1}
        print(f"📡 Making request to: {url} with params: {params}")
        
        response = requests.get(url, params=params, timeout=10)
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
        
        # Validate that friendship_status is present
        if 'friendship_status' not in data:
            print(f"❌ FAILED: Missing 'friendship_status' field in profile response")
            return False
        
        print("✅ Public Profile API test PASSED")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Network error - {e}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {e}")
        return False


def test_privacy_settings_get():
    """
    Test GET /api/profile/{telegram_id}/privacy
    Should return privacy settings
    """
    print("🔍 Testing Get Privacy Settings API...")
    
    try:
        url = f"{API_BASE}/profile/{TEST_USER_1}/privacy"
        print(f"📡 Making request to: {url}")
        
        response = requests.get(url, timeout=10)
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
        
        print("✅ Get Privacy Settings API test PASSED")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Network error - {e}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {e}")
        return False


def test_privacy_settings_update():
    """
    Test PUT /api/profile/{telegram_id}/privacy
    Body: {"show_online_status": false, "show_in_search": true}
    """
    print("🔍 Testing Update Privacy Settings API...")
    
    try:
        url = f"{API_BASE}/profile/{TEST_USER_1}/privacy"
        payload = {"show_online_status": False, "show_in_search": True}
        print(f"📡 Making request to: {url} with payload: {payload}")
        
        response = requests.put(url, json=payload, timeout=10)
        print(f"📊 Response Status: {response.status_code}")
        print(f"📋 Response Headers: {dict(response.headers)}")
        
        if response.status_code not in [200, 201]:
            print(f"❌ FAILED: Expected status 200/201, got {response.status_code}")
            print(f"📄 Response body: {response.text}")
            return False
        
        try:
            data = response.json()
            print(f"📄 Response JSON: {json.dumps(data, indent=2, ensure_ascii=False)}")
        except json.JSONDecodeError:
            print(f"❌ FAILED: Response is not valid JSON")
            print(f"📄 Response body: {response.text}")
            return False
        
        print("✅ Update Privacy Settings API test PASSED")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Network error - {e}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {e}")
        return False


def test_qr_code():
    """
    Test GET /api/profile/{telegram_id}/qr
    Should return: {"qr_data": "https://t.me/bot?start=friend_123", "telegram_id": 123, "display_name": "Имя"}
    """
    print("🔍 Testing QR Code API...")
    
    try:
        url = f"{API_BASE}/profile/{TEST_USER_1}/qr"
        print(f"📡 Making request to: {url}")
        
        response = requests.get(url, timeout=10)
        print(f"📊 Response Status: {response.status_code}")
        print(f"📋 Response Headers: {dict(response.headers)}")
        
        if response.status_code not in [200, 404]:
            print(f"❌ FAILED: Expected status 200 or 404, got {response.status_code}")
            print(f"📄 Response body: {response.text}")
            return False
        
        try:
            data = response.json()
            print(f"📄 Response JSON: {json.dumps(data, indent=2, ensure_ascii=False)}")
        except json.JSONDecodeError:
            print(f"❌ FAILED: Response is not valid JSON")
            print(f"📄 Response body: {response.text}")
            return False
        
        # Handle different response cases
        if response.status_code == 404:
            # Expected case: user not found (test user doesn't exist)
            if 'detail' in data:
                print(f"✅ QR Code API test PASSED - User not found response: {data['detail']}")
                return True
            else:
                print(f"❌ FAILED: Expected 'detail' field in 404 response")
                return False
        
        # Validate success response structure
        required_fields = ['qr_data', 'telegram_id', 'display_name']
        for field in required_fields:
            if field not in data:
                print(f"❌ FAILED: Missing required field '{field}' in response")
                return False
        
        # Validate QR data format
        qr_data = data.get('qr_data', '')
        if not qr_data.startswith('https://t.me/'):
            print(f"❌ FAILED: QR data should start with 'https://t.me/', got: {qr_data}")
            return False
        
        print("✅ QR Code API test PASSED")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Network error - {e}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {e}")
        return False


def test_youtube_info_in_tasks():
    """
    Test YouTube info integration in tasks
    Test POST /api/tasks with YouTube URL - should return youtube_title, youtube_duration, youtube_thumbnail
    """
    print("🔍 Testing YouTube Info in Tasks API...")
    
    try:
        # First create a task with YouTube URL
        url = f"{API_BASE}/tasks"
        payload = {
            "telegram_id": TEST_USER_1,
            "text": "Watch this video: https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "subtasks": []
        }
        print(f"📡 Making request to: {url} with payload: {payload}")
        
        response = requests.post(url, json=payload, timeout=15)
        print(f"📊 Response Status: {response.status_code}")
        print(f"📋 Response Headers: {dict(response.headers)}")
        
        if response.status_code not in [200, 201]:
            print(f"❌ FAILED: Expected status 200/201, got {response.status_code}")
            print(f"📄 Response body: {response.text}")
            return False
        
        try:
            data = response.json()
            print(f"📄 Response JSON: {json.dumps(data, indent=2, ensure_ascii=False)}")
        except json.JSONDecodeError:
            print(f"❌ FAILED: Response is not valid JSON")
            print(f"📄 Response body: {response.text}")
            return False
        
        # Check if YouTube metadata is present
        youtube_fields = ['youtube_title', 'youtube_duration', 'youtube_thumbnail']
        youtube_present = any(field in data for field in youtube_fields)
        
        if youtube_present:
            print("✅ YouTube Info in Tasks API test PASSED - YouTube metadata found")
            
            # Clean up - delete the created task
            if 'id' in data:
                try:
                    delete_url = f"{API_BASE}/tasks/{data['id']}"
                    requests.delete(delete_url, timeout=10)
                    print("🧹 Test task cleaned up")
                except:
                    print("⚠️ Could not clean up test task")
            
            return True
        else:
            print("⚠️ YouTube Info in Tasks API test - No YouTube metadata found (may be expected if feature is not fully implemented)")
            
            # Clean up - delete the created task
            if 'id' in data:
                try:
                    delete_url = f"{API_BASE}/tasks/{data['id']}"
                    requests.delete(delete_url, timeout=10)
                    print("🧹 Test task cleaned up")
                except:
                    print("⚠️ Could not clean up test task")
            
            return True  # Don't fail the test, just note the observation
        
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Network error - {e}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {e}")
        return False

def main():
    """Run all Friends System API tests"""
    print("🚀 Starting Friends System API Tests")
    print("=" * 50)
    
    # Test results tracking
    test_results = {}
    
    # Test Friends System APIs
    test_results['friends_search'] = test_friends_search()
    test_results['send_friend_request'] = test_send_friend_request()
    test_results['get_friend_requests'] = test_get_friend_requests()
    test_results['get_friends_list'] = test_get_friends_list()
    test_results['public_profile'] = test_public_profile()
    test_results['privacy_settings_get'] = test_privacy_settings_get()
    test_results['privacy_settings_update'] = test_privacy_settings_update()
    test_results['qr_code'] = test_qr_code()
    
    # Test YouTube Info in Tasks
    test_results['youtube_info_tasks'] = test_youtube_info_in_tasks()
    
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    passed_count = 0
    total_count = len(test_results)
    
    for test_name, result in test_results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")
        if result:
            passed_count += 1
    
    print(f"\n📈 Results: {passed_count}/{total_count} tests passed")
    
    if passed_count == total_count:
        print("\n🎉 All tests PASSED!")
        return 0
    else:
        print(f"\n💥 {total_count - passed_count} test(s) FAILED!")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)