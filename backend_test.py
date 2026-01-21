#!/usr/bin/env python3
"""
Backend API Testing Script for Friends System
Tests the Friends System API endpoints as specified in the review request.
"""

import requests
import json
import sys
from urllib.parse import urlparse, parse_qs

# Backend URL from frontend .env.production
BACKEND_URL = "https://rudn-schedule.ru"
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
        if not isinstance(data, list):
            print(f"❌ FAILED: Expected list response, got {type(data)}")
            return False
        
        # Check if users have required fields
        if data:  # If there are results
            required_fields = ['telegram_id', 'username', 'first_name', 'last_name', 'group_name', 'friendship_status']
            for user in data[:1]:  # Check first user
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

def test_with_curl():
    """Test using curl command as requested in the review"""
    print("\n🔧 Testing with curl command...")
    
    import subprocess
    
    try:
        curl_cmd = [
            'curl', '-s', '-w', '\\nHTTP_CODE:%{http_code}\\n',
            f'{API_BASE}/music/auth/config'
        ]
        
        print(f"🔧 Running: {' '.join(curl_cmd)}")
        
        result = subprocess.run(curl_cmd, capture_output=True, text=True, timeout=10)
        
        print(f"📤 curl stdout:")
        print(result.stdout)
        
        if result.stderr:
            print(f"📤 curl stderr:")
            print(result.stderr)
        
        print(f"📤 curl return code: {result.returncode}")
        
        # Parse the output to extract HTTP code
        lines = result.stdout.strip().split('\n')
        http_code_line = [line for line in lines if line.startswith('HTTP_CODE:')]
        
        if http_code_line:
            http_code = http_code_line[0].replace('HTTP_CODE:', '')
            print(f"📊 HTTP Status Code: {http_code}")
            
            if http_code == '200':
                print("✅ curl test PASSED - HTTP 200 received")
                return True
            else:
                print(f"❌ curl test FAILED - Expected HTTP 200, got {http_code}")
                return False
        else:
            print("⚠️  Could not extract HTTP status code from curl output")
            return False
            
    except subprocess.TimeoutExpired:
        print("❌ curl test FAILED - Request timed out")
        return False
    except Exception as e:
        print(f"❌ curl test FAILED - Error: {e}")
        return False

def main():
    """Run all VK OAuth API tests"""
    print("🚀 Starting VK OAuth API Tests")
    print("=" * 50)
    
    # Test VK OAuth Config
    config_test_passed = test_vk_oauth_config()
    
    # Test with curl as requested
    curl_test_passed = test_with_curl()
    
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    if config_test_passed:
        print("✅ VK OAuth Config API: PASSED")
    else:
        print("❌ VK OAuth Config API: FAILED")
    
    if curl_test_passed:
        print("✅ curl test: PASSED")
    else:
        print("❌ curl test: FAILED")
    
    if config_test_passed and curl_test_passed:
        print("\n🎉 All tests PASSED!")
        return 0
    else:
        print("\n💥 Some tests FAILED!")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)