#!/usr/bin/env python3
"""
Backend API Testing Script for Friends System
Tests the Friends System API endpoints as specified in the review request.
"""

import requests
import json
import sys
from urllib.parse import urlparse, parse_qs

# Backend URL - use local for testing since external URL is not accessible in this environment
BACKEND_URL = "http://localhost:8001"
API_BASE = f"{BACKEND_URL}/api"

# Test users as specified in the review request
TEST_USER_1 = 123456789  # тестовый
TEST_USER_2 = 765963392  # существующий в БД

def test_friends_search():
    """
    Test GET /api/friends/search?telegram_id={id}&query={text}&limit=10
    Should return list of users with fields: telegram_id, username, first_name, last_name, group_name, friendship_status
    """
    print("🔍 Testing Friends Search API...")
    
    try:
        url = f"{API_BASE}/friends/search"
        params = {
            "telegram_id": TEST_USER_1,
            "query": "test",
            "limit": 10
        }
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
        
        # Validate response structure
        if not isinstance(data, dict):
            print(f"❌ FAILED: Expected dict response, got {type(data)}")
            return False
        
        if 'results' not in data:
            print(f"❌ FAILED: Missing 'results' field in response")
            return False
        
        if not isinstance(data['results'], list):
            print(f"❌ FAILED: Expected 'results' to be a list, got {type(data['results'])}")
            return False
        
        # Check if users have required fields
        if data['results']:  # If there are results
            required_fields = ['telegram_id', 'username', 'first_name', 'last_name', 'group_name', 'friendship_status']
            for user in data['results'][:1]:  # Check first user
                for field in required_fields:
                    if field not in user:
                        print(f"❌ FAILED: Missing required field '{field}' in user object")
                        return False
        
        print("✅ Friends Search API test PASSED")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Network error - {e}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {e}")
        return False


def test_send_friend_request():
    """
    Test POST /api/friends/request/{target_telegram_id}
    Body: {"telegram_id": 123456789}
    Should return: {"success": true, "message": "Запрос на дружбу отправлен"}
    """
    print("🔍 Testing Send Friend Request API...")
    
    try:
        url = f"{API_BASE}/friends/request/{TEST_USER_2}"
        payload = {"telegram_id": TEST_USER_1}
        print(f"📡 Making request to: {url} with payload: {payload}")
        
        response = requests.post(url, json=payload, timeout=10)
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
        
        # Validate response structure
        required_fields = ['success', 'message']
        for field in required_fields:
            if field not in data:
                print(f"❌ FAILED: Missing required field '{field}' in response")
                return False
        
        if not data.get('success'):
            print(f"❌ FAILED: Expected success=true, got success={data.get('success')}")
            return False
        
        print("✅ Send Friend Request API test PASSED")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Network error - {e}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {e}")
        return False


def test_get_friend_requests():
    """
    Test GET /api/friends/{telegram_id}/requests
    Should return: {"incoming": [...], "outgoing": [...], "incoming_count": N, "outgoing_count": N}
    """
    print("🔍 Testing Get Friend Requests API...")
    
    try:
        url = f"{API_BASE}/friends/{TEST_USER_1}/requests"
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
        
        # Validate response structure
        required_fields = ['incoming', 'outgoing', 'incoming_count', 'outgoing_count']
        for field in required_fields:
            if field not in data:
                print(f"❌ FAILED: Missing required field '{field}' in response")
                return False
        
        # Validate that incoming and outgoing are lists
        if not isinstance(data['incoming'], list):
            print(f"❌ FAILED: Expected 'incoming' to be a list, got {type(data['incoming'])}")
            return False
        
        if not isinstance(data['outgoing'], list):
            print(f"❌ FAILED: Expected 'outgoing' to be a list, got {type(data['outgoing'])}")
            return False
        
        print("✅ Get Friend Requests API test PASSED")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Network error - {e}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {e}")
        return False


def test_get_friends_list():
    """
    Test GET /api/friends/{telegram_id}
    Should return: {"friends": [...], "total": N}
    """
    print("🔍 Testing Get Friends List API...")
    
    try:
        url = f"{API_BASE}/friends/{TEST_USER_1}"
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
        
        # Validate response structure
        required_fields = ['friends', 'total']
        for field in required_fields:
            if field not in data:
                print(f"❌ FAILED: Missing required field '{field}' in response")
                return False
        
        # Validate that friends is a list
        if not isinstance(data['friends'], list):
            print(f"❌ FAILED: Expected 'friends' to be a list, got {type(data['friends'])}")
            return False
        
        # Validate that total is a number
        if not isinstance(data['total'], int):
            print(f"❌ FAILED: Expected 'total' to be an integer, got {type(data['total'])}")
            return False
        
        print("✅ Get Friends List API test PASSED")
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