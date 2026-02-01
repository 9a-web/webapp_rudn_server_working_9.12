#!/usr/bin/env python3
"""
Backend Testing Suite for Web Sessions System and Friends APIs
Tests the Telegram Profile Link via QR-code functionality and Friends integration
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional

# Backend URL from environment - using localhost for testing in container environment
BACKEND_URL = "http://localhost:8001"
API_BASE = f"{BACKEND_URL}/api"

class BackendTester:
    def __init__(self):
        self.session_token: Optional[str] = None
        self.test_results = []
        self.test_room_id: Optional[str] = None
        self.test_journal_id: Optional[str] = None
        
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        if not success and response_data:
            print(f"   Response: {response_data}")
        print()
    
    # ============ Web Sessions Tests ============
    
    def test_create_web_session(self) -> bool:
        """Test POST /api/web-sessions - создание новой сессии"""
        try:
            print("🧪 Testing: Create Web Session")
            
            response = requests.post(f"{API_BASE}/web-sessions", timeout=10)
            
            if response.status_code != 200:
                self.log_test(
                    "Create Web Session", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate required fields
            required_fields = ["session_token", "status", "qr_url", "expires_at"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test(
                    "Create Web Session", 
                    False, 
                    f"Missing required fields: {missing_fields}",
                    data
                )
                return False
            
            # Validate status is "pending"
            if data["status"] != "pending":
                self.log_test(
                    "Create Web Session", 
                    False, 
                    f"Expected status 'pending', got '{data['status']}'",
                    data
                )
                return False
            
            # Validate QR URL format
            expected_qr_pattern = "https://t.me/"
            if not data["qr_url"].startswith(expected_qr_pattern):
                self.log_test(
                    "Create Web Session", 
                    False, 
                    f"QR URL doesn't match expected pattern. Got: {data['qr_url']}",
                    data
                )
                return False
            
            # Check if QR URL contains link_ parameter
            if "startapp=link_" not in data["qr_url"]:
                self.log_test(
                    "Create Web Session", 
                    False, 
                    f"QR URL missing 'startapp=link_' parameter. Got: {data['qr_url']}",
                    data
                )
                return False
            
            # Store session token for subsequent tests
            self.session_token = data["session_token"]
            
            self.log_test(
                "Create Web Session", 
                True, 
                f"Session created successfully. Token: {self.session_token[:8]}..., QR: {data['qr_url'][:50]}...",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Create Web Session", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Create Web Session", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    def test_get_session_status_pending(self) -> bool:
        """Test GET /api/web-sessions/{session_token}/status - проверка статуса pending"""
        if not self.session_token:
            self.log_test(
                "Get Session Status (Pending)", 
                False, 
                "No session token available from previous test"
            )
            return False
        
        try:
            print("🧪 Testing: Get Session Status (Pending)")
            
            response = requests.get(f"{API_BASE}/web-sessions/{self.session_token}/status", timeout=10)
            
            if response.status_code != 200:
                self.log_test(
                    "Get Session Status (Pending)", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate status is still "pending"
            if data["status"] != "pending":
                self.log_test(
                    "Get Session Status (Pending)", 
                    False, 
                    f"Expected status 'pending', got '{data['status']}'",
                    data
                )
                return False
            
            # Validate session_token matches
            if data["session_token"] != self.session_token:
                self.log_test(
                    "Get Session Status (Pending)", 
                    False, 
                    f"Session token mismatch. Expected: {self.session_token}, Got: {data['session_token']}",
                    data
                )
                return False
            
            self.log_test(
                "Get Session Status (Pending)", 
                True, 
                f"Status correctly shows 'pending' for session {self.session_token[:8]}...",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Get Session Status (Pending)", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Get Session Status (Pending)", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    def test_link_session_with_telegram(self) -> bool:
        """Test POST /api/web-sessions/{session_token}/link - связывание сессии с Telegram"""
        if not self.session_token:
            self.log_test(
                "Link Session with Telegram", 
                False, 
                "No session token available from previous test"
            )
            return False
        
        try:
            print("🧪 Testing: Link Session with Telegram")
            
            # Test data - using realistic looking data as per instructions
            link_data = {
                "telegram_id": 765963392,  # Existing user from test_result.md
                "first_name": "Александр",
                "last_name": "Петров", 
                "username": "alex_petrov",
                "photo_url": "https://t.me/i/userpic/320/alex_petrov.jpg"
            }
            
            response = requests.post(
                f"{API_BASE}/web-sessions/{self.session_token}/link",
                json=link_data,
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test(
                    "Link Session with Telegram", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate response structure
            required_fields = ["success", "message"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test(
                    "Link Session with Telegram", 
                    False, 
                    f"Missing required fields: {missing_fields}",
                    data
                )
                return False
            
            # Validate success is True
            if not data["success"]:
                self.log_test(
                    "Link Session with Telegram", 
                    False, 
                    f"Link failed. Message: {data.get('message', 'No message')}",
                    data
                )
                return False
            
            # Validate success message
            expected_message = "Профиль успешно подключен!"
            if data["message"] != expected_message:
                self.log_test(
                    "Link Session with Telegram", 
                    False, 
                    f"Unexpected message. Expected: '{expected_message}', Got: '{data['message']}'",
                    data
                )
                return False
            
            # Validate session_token is returned
            if "session_token" not in data or data["session_token"] != self.session_token:
                self.log_test(
                    "Link Session with Telegram", 
                    False, 
                    f"Session token not returned or mismatch. Expected: {self.session_token}, Got: {data.get('session_token')}",
                    data
                )
                return False
            
            self.log_test(
                "Link Session with Telegram", 
                True, 
                f"Session successfully linked with Telegram ID {link_data['telegram_id']}",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Link Session with Telegram", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Link Session with Telegram", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    def test_get_session_status_linked(self) -> bool:
        """Test GET /api/web-sessions/{session_token}/status - проверка статуса linked"""
        if not self.session_token:
            self.log_test(
                "Get Session Status (Linked)", 
                False, 
                "No session token available from previous test"
            )
            return False
        
        try:
            print("🧪 Testing: Get Session Status (Linked)")
            
            response = requests.get(f"{API_BASE}/web-sessions/{self.session_token}/status", timeout=10)
            
            if response.status_code != 200:
                self.log_test(
                    "Get Session Status (Linked)", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate status is now "linked"
            if data["status"] != "linked":
                self.log_test(
                    "Get Session Status (Linked)", 
                    False, 
                    f"Expected status 'linked', got '{data['status']}'",
                    data
                )
                return False
            
            # Validate user data is present
            expected_telegram_id = 765963392
            if data.get("telegram_id") != expected_telegram_id:
                self.log_test(
                    "Get Session Status (Linked)", 
                    False, 
                    f"Expected telegram_id {expected_telegram_id}, got {data.get('telegram_id')}",
                    data
                )
                return False
            
            # Validate user settings - can be null if user doesn't exist in database
            # This is expected behavior for new users
            user_settings = data.get("user_settings")
            if user_settings is not None:
                # If user settings exist, validate they're a dict
                if not isinstance(user_settings, dict):
                    self.log_test(
                        "Get Session Status (Linked)", 
                        False, 
                        f"User settings should be dict or null, got {type(user_settings)}",
                        data
                    )
                    return False
            
            self.log_test(
                "Get Session Status (Linked)", 
                True, 
                f"Status correctly shows 'linked' with user data for Telegram ID {expected_telegram_id}. User settings: {'loaded' if user_settings else 'null (new user)'}",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Get Session Status (Linked)", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Get Session Status (Linked)", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    def test_duplicate_link_attempt(self) -> bool:
        """Test повторная попытка связки уже связанной сессии (должна вернуть ошибку)"""
        if not self.session_token:
            self.log_test(
                "Duplicate Link Attempt", 
                False, 
                "No session token available from previous test"
            )
            return False
        
        try:
            print("🧪 Testing: Duplicate Link Attempt")
            
            # Try to link the same session again
            link_data = {
                "telegram_id": 123456789,  # Different user
                "first_name": "Иван",
                "last_name": "Иванов"
            }
            
            response = requests.post(
                f"{API_BASE}/web-sessions/{self.session_token}/link",
                json=link_data,
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test(
                    "Duplicate Link Attempt", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Should return success=False for already linked session
            if data.get("success", True):  # Default True to catch missing field
                self.log_test(
                    "Duplicate Link Attempt", 
                    False, 
                    f"Expected success=False for already linked session, got success={data.get('success')}",
                    data
                )
                return False
            
            # Should have appropriate error message
            expected_messages = ["уже использована", "истекла", "already", "used"]
            message = data.get("message", "").lower()
            if not any(expected in message for expected in expected_messages):
                self.log_test(
                    "Duplicate Link Attempt", 
                    False, 
                    f"Error message doesn't indicate session already used. Got: '{data.get('message')}'",
                    data
                )
                return False
            
            self.log_test(
                "Duplicate Link Attempt", 
                True, 
                f"Correctly rejected duplicate link attempt with message: '{data.get('message')}'",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Duplicate Link Attempt", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Duplicate Link Attempt", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    def test_get_user_settings(self) -> bool:
        """Test GET /api/user-settings/{telegram_id} - проверка данных пользователя"""
        try:
            print("🧪 Testing: Get User Settings")
            
            # Test with the telegram_id we used in linking
            telegram_id = 765963392
            
            response = requests.get(f"{API_BASE}/user-settings/{telegram_id}", timeout=10)
            
            # User settings can return 404 if user doesn't exist, which is expected for new users
            if response.status_code == 404:
                self.log_test(
                    "Get User Settings", 
                    True, 
                    f"User settings not found for telegram_id {telegram_id} (expected for new user)",
                    {"status_code": 404, "message": "User not configured yet"}
                )
                return True
            elif response.status_code != 200:
                self.log_test(
                    "Get User Settings", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # If user exists, validate the response structure
            if "telegram_id" not in data:
                self.log_test(
                    "Get User Settings", 
                    False, 
                    "Response missing telegram_id field",
                    data
                )
                return False
            
            if data["telegram_id"] != telegram_id:
                self.log_test(
                    "Get User Settings", 
                    False, 
                    f"Telegram ID mismatch. Expected: {telegram_id}, Got: {data['telegram_id']}",
                    data
                )
                return False
            
            self.log_test(
                "Get User Settings", 
                True, 
                f"User settings loaded successfully for telegram_id {telegram_id}",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Get User Settings", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Get User Settings", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    def test_invalid_session_token(self) -> bool:
        """Test запросы с несуществующим session_token"""
        try:
            print("🧪 Testing: Invalid Session Token")
            
            fake_token = "00000000-0000-0000-0000-000000000000"
            
            # Test status endpoint
            response = requests.get(f"{API_BASE}/web-sessions/{fake_token}/status", timeout=10)
            
            if response.status_code != 404:
                self.log_test(
                    "Invalid Session Token", 
                    False, 
                    f"Expected HTTP 404 for invalid token, got {response.status_code}",
                    response.text
                )
                return False
            
            # Test link endpoint
            link_data = {"telegram_id": 123456789}
            response = requests.post(
                f"{API_BASE}/web-sessions/{fake_token}/link",
                json=link_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success", True):  # Should be False for invalid session
                    self.log_test(
                        "Invalid Session Token", 
                        False, 
                        f"Link endpoint should return success=False for invalid token, got {data}",
                        data
                    )
                    return False
            elif response.status_code != 404:
                self.log_test(
                    "Invalid Session Token", 
                    False, 
                    f"Expected HTTP 404 or success=False for invalid token, got {response.status_code}",
                    response.text
                )
                return False
            
            self.log_test(
                "Invalid Session Token", 
                True, 
                "Correctly handled invalid session token requests"
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Invalid Session Token", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Invalid Session Token", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    
    # ============ Friends API Tests ============
    
    def test_quick_add_friends_to_room(self) -> bool:
        """Test POST /api/rooms/{room_id}/add-friends - быстрое добавление друзей в комнату"""
        try:
            print("🧪 Testing: Quick Add Friends to Room API")
            
            # This API requires existing room, friends relationship, and participants
            # Since we don't have test data setup, we'll test the API response structure
            
            # Test with non-existent room first
            fake_room_id = "test-room-12345"
            test_data = {
                "telegram_id": 765963392,
                "friends": [
                    {
                        "telegram_id": 123456789,
                        "first_name": "Иван",
                        "username": "ivan_test"
                    }
                ]
            }
            
            response = requests.post(
                f"{API_BASE}/rooms/{fake_room_id}/add-friends",
                json=test_data,
                timeout=10
            )
            
            # Should return 404 for non-existent room
            if response.status_code != 404:
                self.log_test(
                    "Quick Add Friends to Room API", 
                    False, 
                    f"Expected HTTP 404 for non-existent room, got {response.status_code}",
                    response.text
                )
                return False
            
            # Check error message structure
            try:
                error_data = response.json()
                if "detail" not in error_data:
                    self.log_test(
                        "Quick Add Friends to Room API", 
                        False, 
                        "Error response missing 'detail' field",
                        error_data
                    )
                    return False
            except:
                # Plain text error is also acceptable
                pass
            
            self.log_test(
                "Quick Add Friends to Room API", 
                True, 
                "API correctly handles non-existent room with 404 error. Endpoint structure is valid.",
                {"status_code": response.status_code, "endpoint": f"/rooms/{fake_room_id}/add-friends"}
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Quick Add Friends to Room API", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Quick Add Friends to Room API", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    def test_quick_add_friends_to_journal(self) -> bool:
        """Test POST /api/journals/{journal_id}/students/from-friends - добавление друзей в журнал"""
        try:
            print("🧪 Testing: Quick Add Friends to Journal API")
            
            # Test with non-existent journal first
            fake_journal_id = "test-journal-12345"
            test_data = {
                "friends": [
                    {
                        "telegram_id": 123456789,
                        "full_name": "Иван Петров",
                        "first_name": "Иван",
                        "username": "ivan_test"
                    }
                ]
            }
            
            response = requests.post(
                f"{API_BASE}/journals/{fake_journal_id}/students/from-friends",
                json=test_data,
                timeout=10
            )
            
            # Should return 404 for non-existent journal
            if response.status_code != 404:
                self.log_test(
                    "Quick Add Friends to Journal API", 
                    False, 
                    f"Expected HTTP 404 for non-existent journal, got {response.status_code}",
                    response.text
                )
                return False
            
            # Check error message structure
            try:
                error_data = response.json()
                if "detail" not in error_data:
                    self.log_test(
                        "Quick Add Friends to Journal API", 
                        False, 
                        "Error response missing 'detail' field",
                        error_data
                    )
                    return False
            except:
                # Plain text error is also acceptable
                pass
            
            self.log_test(
                "Quick Add Friends to Journal API", 
                True, 
                "API correctly handles non-existent journal with 404 error. Endpoint structure is valid.",
                {"status_code": response.status_code, "endpoint": f"/journals/{fake_journal_id}/students/from-friends"}
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Quick Add Friends to Journal API", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Quick Add Friends to Journal API", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    def run_all_tests(self):
        """Run all Backend API tests in sequence"""
        print("🚀 Starting Backend API Testing")
        print("=" * 50)
        
        # Web Sessions Tests
        web_session_tests = [
            self.test_create_web_session,
            self.test_get_session_status_pending,
            self.test_link_session_with_telegram,
            self.test_get_session_status_linked,
            self.test_get_user_settings,
            self.test_duplicate_link_attempt,
            self.test_invalid_session_token
        ]
        
        # Friends API Tests
        friends_api_tests = [
            self.test_quick_add_friends_to_room,
            self.test_quick_add_friends_to_journal
        ]
        
        all_tests = web_session_tests + friends_api_tests
        
        passed = 0
        total = len(all_tests)
        
        for test in all_tests:
            try:
                if test():
                    passed += 1
                time.sleep(0.5)  # Small delay between tests
            except Exception as e:
                print(f"❌ Test failed with exception: {e}")
        
        print("=" * 50)
        print(f"📊 Test Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All Backend API tests PASSED!")
            return True
        else:
            print(f"⚠️  {total - passed} tests FAILED")
            return False
    
    def print_detailed_results(self):
        """Print detailed test results"""
        print("\n📋 Detailed Test Results:")
        print("-" * 50)
        
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}")
            if result["details"]:
                print(f"   {result['details']}")
            print()


def main():
    """Main test execution"""
    print("🔗 Web Sessions System Testing")
    print(f"Backend URL: {BACKEND_URL}")
    print()
    
    tester = WebSessionTester()
    
    # Run all tests
    success = tester.run_all_tests()
    
    # Print detailed results
    tester.print_detailed_results()
    
    return success


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)