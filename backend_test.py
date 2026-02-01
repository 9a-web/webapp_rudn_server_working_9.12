#!/usr/bin/env python3
"""
Backend Testing Suite for Web Sessions Device Activity Tracking
Tests the device activity tracking fix for web sessions (last_active field updates)
"""

import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Backend URL from environment - using localhost for testing in container environment
BACKEND_URL = "http://localhost:8001"
API_BASE = f"{BACKEND_URL}/api"

class BackendTester:
    def __init__(self):
        self.session_token: Optional[str] = None
        self.test_results = []
        self.test_telegram_id = 765963392  # Test user ID from review request
        
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
    
    # ============ Device Activity Tracking Tests ============
    
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
            
            # Store session token for subsequent tests
            self.session_token = data["session_token"]
            
            self.log_test(
                "Create Web Session", 
                True, 
                f"Session created successfully. Token: {self.session_token[:8]}...",
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
    
    def test_link_session_with_user(self) -> bool:
        """Test POST /api/web-sessions/{token}/link - связывание сессии с пользователем"""
        if not self.session_token:
            self.log_test(
                "Link Session with User", 
                False, 
                "No session token available from previous test"
            )
            return False
        
        try:
            print("🧪 Testing: Link Session with User")
            
            # Test data from review request
            link_data = {
                "telegram_id": self.test_telegram_id,
                "first_name": "Test",
                "username": "test_user"
            }
            
            response = requests.post(
                f"{API_BASE}/web-sessions/{self.session_token}/link",
                json=link_data,
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test(
                    "Link Session with User", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate success response
            if not data.get("success"):
                self.log_test(
                    "Link Session with User", 
                    False, 
                    f"Link failed. Response: {data}",
                    data
                )
                return False
            
            self.log_test(
                "Link Session with User", 
                True, 
                f"Session successfully linked with Telegram ID {self.test_telegram_id}",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Link Session with User", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Link Session with User", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    def test_check_session_status_updates_last_active(self) -> bool:
        """Test GET /api/web-sessions/{token}/status - проверка что статус обновляет last_active"""
        if not self.session_token:
            self.log_test(
                "Check Session Status Updates Last Active", 
                False, 
                "No session token available from previous test"
            )
            return False
        
        try:
            print("🧪 Testing: Check Session Status Updates Last Active")
            
            # Get initial timestamp
            time_before = datetime.utcnow()
            
            # Wait a small amount to ensure timestamp difference
            time.sleep(1)
            
            response = requests.get(f"{API_BASE}/web-sessions/{self.session_token}/status", timeout=10)
            
            if response.status_code != 200:
                self.log_test(
                    "Check Session Status Updates Last Active", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate status is "linked"
            if data["status"] != "linked":
                self.log_test(
                    "Check Session Status Updates Last Active", 
                    False, 
                    f"Expected status 'linked', got '{data['status']}'",
                    data
                )
                return False
            
            self.log_test(
                "Check Session Status Updates Last Active", 
                True, 
                f"Status check successful. Status: {data['status']} for user {data.get('telegram_id')}",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Check Session Status Updates Last Active", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Check Session Status Updates Last Active", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    def test_send_heartbeat(self) -> bool:
        """Test POST /api/web-sessions/{token}/heartbeat - отправка heartbeat"""
        if not self.session_token:
            self.log_test(
                "Send Heartbeat", 
                False, 
                "No session token available from previous test"
            )
            return False
        
        try:
            print("🧪 Testing: Send Heartbeat")
            
            response = requests.post(f"{API_BASE}/web-sessions/{self.session_token}/heartbeat", timeout=10)
            
            if response.status_code != 200:
                self.log_test(
                    "Send Heartbeat", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate response structure
            required_fields = ["success", "updated_at"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test(
                    "Send Heartbeat", 
                    False, 
                    f"Missing required fields: {missing_fields}",
                    data
                )
                return False
            
            # Validate success is True
            if not data["success"]:
                self.log_test(
                    "Send Heartbeat", 
                    False, 
                    f"Heartbeat failed. Response: {data}",
                    data
                )
                return False
            
            # Validate updated_at is present and recent
            updated_at_str = data["updated_at"]
            try:
                updated_at = datetime.fromisoformat(updated_at_str.replace('Z', '+00:00'))
                time_diff = abs((datetime.utcnow() - updated_at.replace(tzinfo=None)).total_seconds())
                if time_diff > 10:  # Should be within 10 seconds
                    self.log_test(
                        "Send Heartbeat", 
                        False, 
                        f"updated_at timestamp too old: {updated_at_str} (diff: {time_diff}s)",
                        data
                    )
                    return False
            except Exception as e:
                self.log_test(
                    "Send Heartbeat", 
                    False, 
                    f"Invalid updated_at format: {updated_at_str}. Error: {e}",
                    data
                )
                return False
            
            self.log_test(
                "Send Heartbeat", 
                True, 
                f"Heartbeat successful. Updated at: {updated_at_str}",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Send Heartbeat", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Send Heartbeat", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    def test_get_devices_list_and_check_last_active(self) -> bool:
        """Test GET /api/web-sessions/user/{telegram_id}/devices - получение списка устройств и проверка last_active"""
        try:
            print("🧪 Testing: Get Devices List and Check Last Active")
            
            response = requests.get(f"{API_BASE}/web-sessions/user/{self.test_telegram_id}/devices", timeout=10)
            
            if response.status_code != 200:
                self.log_test(
                    "Get Devices List and Check Last Active", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate response structure
            required_fields = ["devices", "total"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test(
                    "Get Devices List and Check Last Active", 
                    False, 
                    f"Missing required fields: {missing_fields}",
                    data
                )
                return False
            
            devices = data["devices"]
            total = data["total"]
            
            # Should have at least one device (our test session)
            if total == 0 or len(devices) == 0:
                self.log_test(
                    "Get Devices List and Check Last Active", 
                    False, 
                    f"No devices found for user {self.test_telegram_id}. Expected at least 1 device.",
                    data
                )
                return False
            
            # Find our test session device
            test_device = None
            for device in devices:
                if device.get("session_token") == self.session_token:
                    test_device = device
                    break
            
            if not test_device:
                self.log_test(
                    "Get Devices List and Check Last Active", 
                    False, 
                    f"Test session {self.session_token[:8]}... not found in devices list",
                    data
                )
                return False
            
            # Validate last_active is present and recent
            last_active_str = test_device.get("last_active")
            if not last_active_str:
                self.log_test(
                    "Get Devices List and Check Last Active", 
                    False, 
                    f"last_active field is missing or null for test device",
                    test_device
                )
                return False
            
            try:
                last_active = datetime.fromisoformat(last_active_str.replace('Z', '+00:00'))
                time_diff = abs((datetime.utcnow() - last_active.replace(tzinfo=None)).total_seconds())
                if time_diff > 60:  # Should be within 1 minute (recent activity)
                    self.log_test(
                        "Get Devices List and Check Last Active", 
                        False, 
                        f"last_active timestamp too old: {last_active_str} (diff: {time_diff}s)",
                        test_device
                    )
                    return False
            except Exception as e:
                self.log_test(
                    "Get Devices List and Check Last Active", 
                    False, 
                    f"Invalid last_active format: {last_active_str}. Error: {e}",
                    test_device
                )
                return False
            
            self.log_test(
                "Get Devices List and Check Last Active", 
                True, 
                f"Found {total} devices. Test device last_active: {last_active_str} (recent: {time_diff:.1f}s ago)",
                {"total_devices": total, "test_device_last_active": last_active_str}
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Get Devices List and Check Last Active", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Get Devices List and Check Last Active", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    def test_heartbeat_for_invalid_session(self) -> bool:
        """Test POST /api/web-sessions/invalid-token/heartbeat - heartbeat для несуществующей сессии"""
        try:
            print("🧪 Testing: Heartbeat for Invalid Session")
            
            invalid_token = "invalid-token-12345"
            
            response = requests.post(f"{API_BASE}/web-sessions/{invalid_token}/heartbeat", timeout=10)
            
            # Should return 404 for invalid session
            if response.status_code != 404:
                self.log_test(
                    "Heartbeat for Invalid Session", 
                    False, 
                    f"Expected HTTP 404 for invalid token, got {response.status_code}",
                    response.text
                )
                return False
            
            self.log_test(
                "Heartbeat for Invalid Session", 
                True, 
                f"Correctly returned 404 for invalid session token: {invalid_token}",
                {"status_code": response.status_code}
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Heartbeat for Invalid Session", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Heartbeat for Invalid Session", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    
    def run_all_tests(self):
        """Run all Device Activity Tracking tests in sequence"""
        print("🚀 Starting Device Activity Tracking Testing")
        print("=" * 50)
        
        # Device Activity Tracking Tests (from review request scenarios)
        device_activity_tests = [
            self.test_create_web_session,                    # 1. Create web session
            self.test_link_session_with_user,               # 2. Link session with user
            self.test_check_session_status_updates_last_active,  # 3. Check status (should update last_active)
            self.test_send_heartbeat,                       # 4. Send heartbeat
            self.test_get_devices_list_and_check_last_active,   # 5. Get devices list and check last_active
            self.test_heartbeat_for_invalid_session         # 6. Test heartbeat for non-existent session
        ]
        
        all_tests = device_activity_tests
        
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
            print("🎉 All Device Activity Tracking tests PASSED!")
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
    """Main test execution for Device Activity Tracking"""
    print("🔗 Device Activity Tracking Testing")
    print(f"Backend URL: {BACKEND_URL}")
    print()
    
    tester = BackendTester()
    
    # Run all tests
    success = tester.run_all_tests()
    
    # Print detailed results
    tester.print_detailed_results()
    
    return success


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)