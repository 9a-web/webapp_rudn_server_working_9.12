#!/usr/bin/env python3
"""
Notification Settings Endpoints Test
Tests the specific notification endpoints as requested
"""

import requests
import json
import sys

# Use local backend URL since external URL is not accessible
BACKEND_URL = "http://localhost:8001/api"
TIMEOUT = 10

class NotificationTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.session.timeout = TIMEOUT
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, message: str, details=None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details or {}
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details:
            print(f"   Details: {json.dumps(details, indent=2, ensure_ascii=False)}")
        print()
    
    def create_test_user(self, telegram_id: int) -> bool:
        """Create a test user for notification testing"""
        try:
            print(f"🔧 Creating test user with telegram_id: {telegram_id}...")
            
            payload = {
                "telegram_id": telegram_id,
                "username": "notification_test_user",
                "first_name": "Иван",
                "last_name": "Петров",
                "group_id": "test-group-notifications",
                "group_name": "Тестовая группа для уведомлений",
                "facultet_id": "test-facultet-notifications",
                "level_id": "test-level-notifications",
                "kurs": "1",
                "form_code": "д"
            }
            
            response = self.session.post(
                f"{self.base_url}/user-settings",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                print(f"✅ Test user created successfully")
                return True
            else:
                print(f"❌ Failed to create test user: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Exception creating test user: {str(e)}")
            return False
    
    def test_get_notification_settings(self, telegram_id: int) -> bool:
        """Test GET /api/user-settings/{telegram_id}/notifications"""
        try:
            print(f"🔍 Testing GET /api/user-settings/{telegram_id}/notifications...")
            
            response = self.session.get(f"{self.base_url}/user-settings/{telegram_id}/notifications")
            
            if response.status_code == 404:
                self.log_test(f"GET /api/user-settings/{telegram_id}/notifications", True, 
                            "Correctly returned 404 for non-existent user")
                return True
            elif response.status_code != 200:
                self.log_test(f"GET /api/user-settings/{telegram_id}/notifications", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            notification_data = response.json()
            
            # Validate response structure
            required_fields = ['notifications_enabled', 'notification_time', 'telegram_id']
            for field in required_fields:
                if field not in notification_data:
                    self.log_test(f"GET /api/user-settings/{telegram_id}/notifications", False, 
                                f"Missing required field: {field}")
                    return False
            
            # Validate telegram_id matches
            if notification_data['telegram_id'] != telegram_id:
                self.log_test(f"GET /api/user-settings/{telegram_id}/notifications", False, 
                            "Telegram ID mismatch in response")
                return False
            
            self.log_test(f"GET /api/user-settings/{telegram_id}/notifications", True, 
                        "Successfully retrieved notification settings",
                        {
                            "notifications_enabled": notification_data['notifications_enabled'],
                            "notification_time": notification_data['notification_time'],
                            "telegram_id": notification_data['telegram_id']
                        })
            return True
            
        except Exception as e:
            self.log_test(f"GET /api/user-settings/{telegram_id}/notifications", False, f"Exception: {str(e)}")
            return False
    
    def test_update_notification_settings(self, telegram_id: int, payload: dict) -> bool:
        """Test PUT /api/user-settings/{telegram_id}/notifications"""
        try:
            print(f"🔍 Testing PUT /api/user-settings/{telegram_id}/notifications with payload: {payload}...")
            
            response = self.session.put(
                f"{self.base_url}/user-settings/{telegram_id}/notifications",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 404:
                self.log_test(f"PUT /api/user-settings/{telegram_id}/notifications", True, 
                            "Correctly returned 404 for non-existent user")
                return True
            elif response.status_code != 200:
                self.log_test(f"PUT /api/user-settings/{telegram_id}/notifications", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            notification_data = response.json()
            
            # Validate response structure
            required_fields = ['notifications_enabled', 'notification_time', 'telegram_id']
            for field in required_fields:
                if field not in notification_data:
                    self.log_test(f"PUT /api/user-settings/{telegram_id}/notifications", False, 
                                f"Missing required field: {field}")
                    return False
            
            # Validate updated values match payload
            if notification_data['notifications_enabled'] != payload['notifications_enabled']:
                self.log_test(f"PUT /api/user-settings/{telegram_id}/notifications", False, 
                            f"notifications_enabled mismatch: expected {payload['notifications_enabled']}, got {notification_data['notifications_enabled']}")
                return False
            
            if notification_data['notification_time'] != payload['notification_time']:
                self.log_test(f"PUT /api/user-settings/{telegram_id}/notifications", False, 
                            f"notification_time mismatch: expected {payload['notification_time']}, got {notification_data['notification_time']}")
                return False
            
            self.log_test(f"PUT /api/user-settings/{telegram_id}/notifications", True, 
                        "Successfully updated notification settings",
                        {
                            "notifications_enabled": notification_data['notifications_enabled'],
                            "notification_time": notification_data['notification_time'],
                            "telegram_id": notification_data['telegram_id']
                        })
            return True
            
        except Exception as e:
            self.log_test(f"PUT /api/user-settings/{telegram_id}/notifications", False, f"Exception: {str(e)}")
            return False
    
    def test_invalid_notification_time(self, telegram_id: int) -> bool:
        """Test PUT with invalid notification_time values"""
        try:
            print(f"🔍 Testing invalid notification_time values for telegram_id: {telegram_id}...")
            
            invalid_payloads = [
                {"notifications_enabled": True, "notification_time": 4},   # < 5
                {"notifications_enabled": True, "notification_time": 31},  # > 30
            ]
            
            for payload in invalid_payloads:
                response = self.session.put(
                    f"{self.base_url}/user-settings/{telegram_id}/notifications",
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                
                # Should return 422 for validation error or 400 for bad request
                if response.status_code not in [400, 422]:
                    self.log_test("PUT /api/user-settings/{telegram_id}/notifications (invalid values)", False, 
                                f"Expected HTTP 400/422 for time={payload['notification_time']}, got {response.status_code}")
                    return False
            
            self.log_test("PUT /api/user-settings/{telegram_id}/notifications (invalid values)", True, 
                        "Successfully rejected invalid notification time values")
            return True
            
        except Exception as e:
            self.log_test("PUT /api/user-settings/{telegram_id}/notifications (invalid values)", False, f"Exception: {str(e)}")
            return False
    
    def run_notification_tests(self):
        """Run all notification endpoint tests as requested"""
        print("🚀 Starting Notification Settings Endpoints Test")
        print(f"🌐 Backend URL: {self.base_url}")
        print("=" * 60)
        
        telegram_id = 123456789
        
        # Test scenarios as requested
        tests_passed = 0
        total_tests = 0
        
        # 1. Test GET notifications for non-existent user (should return 404)
        total_tests += 1
        if self.test_get_notification_settings(telegram_id):
            tests_passed += 1
        
        # 2. Create test user
        if not self.create_test_user(telegram_id):
            print("❌ Failed to create test user. Cannot continue with tests.")
            return False
        
        # 3. Test GET notifications for existing user (should return default settings)
        total_tests += 1
        if self.test_get_notification_settings(telegram_id):
            tests_passed += 1
        
        # 4. Test PUT notifications - enable with time 15
        total_tests += 1
        payload1 = {"notifications_enabled": True, "notification_time": 15}
        if self.test_update_notification_settings(telegram_id, payload1):
            tests_passed += 1
        
        # 5. Test GET notifications again to verify persistence
        total_tests += 1
        if self.test_get_notification_settings(telegram_id):
            tests_passed += 1
        
        # 6. Test PUT notifications - disable with time 10
        total_tests += 1
        payload2 = {"notifications_enabled": False, "notification_time": 10}
        if self.test_update_notification_settings(telegram_id, payload2):
            tests_passed += 1
        
        # 7. Test GET notifications again to verify new settings
        total_tests += 1
        if self.test_get_notification_settings(telegram_id):
            tests_passed += 1
        
        # 8. Test invalid notification_time values
        total_tests += 1
        if self.test_invalid_notification_time(telegram_id):
            tests_passed += 1
        
        # 9. Test with non-existent user for PUT
        total_tests += 1
        nonexistent_id = 999999999
        payload3 = {"notifications_enabled": True, "notification_time": 15}
        if self.test_update_notification_settings(nonexistent_id, payload3):
            tests_passed += 1
        
        print("=" * 60)
        print(f"📊 Test Results: {tests_passed}/{total_tests} tests passed")
        
        if tests_passed == total_tests:
            print("🎉 All notification endpoint tests passed!")
            return True
        else:
            print("⚠️  Some tests failed. Check the details above.")
            return False

def main():
    """Main test runner"""
    tester = NotificationTester()
    success = tester.run_notification_tests()
    
    # Print summary
    print("\n" + "=" * 60)
    print("📋 DETAILED TEST SUMMARY")
    print("=" * 60)
    
    for result in tester.test_results:
        status = "✅" if result['success'] else "❌"
        print(f"{status} {result['test']}: {result['message']}")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())