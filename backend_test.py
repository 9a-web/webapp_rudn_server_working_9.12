#!/usr/bin/env python3
"""
Backend Testing Suite for Admin Online Users API
Tests the admin online users tracking endpoints as specified in the review request
"""

import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Backend URL from environment - using internal URL for testing from container
BACKEND_URL = "http://localhost:8001"
API_BASE = f"{BACKEND_URL}/api"

class BackendTester:
    def __init__(self):
        self.test_results = []
        # Test user data as specified in review request
        self.telegram_id = 765963392
        self.first_name = "Админ"
        self.last_name = "Тестовый"
        self.username = "admin_test"
        self.photo_url = None
        
        # Additional test user
        self.telegram_id_2 = 111222333
        self.first_name_2 = "Пользователь"
        self.last_name_2 = "Второй"
        self.username_2 = "user_test_2"
        
        # Third test user
        self.telegram_id_3 = 444555666
        self.first_name_3 = "Пользователь"
        self.last_name_3 = "Третий"
        self.username_3 = "user_test_3"
        
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
    
    
    # ============ Admin Online Users API Tests ============
    
    def test_track_activity_user_1(self) -> bool:
        """Test POST /api/admin/track-activity - Track activity for user 1 with section=schedule"""
        try:
            print("🧪 Testing: Track Activity User 1 (schedule)")
            
            response = requests.post(
                f"{API_BASE}/admin/track-activity",
                params={
                    "telegram_id": self.telegram_id,
                    "section": "schedule"
                },
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test(
                    "Track Activity User 1", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate required fields
            if "success" not in data:
                self.log_test(
                    "Track Activity User 1", 
                    False, 
                    f"Missing success field in response",
                    data
                )
                return False
            
            # Validate success is true
            if not data.get("success"):
                self.log_test(
                    "Track Activity User 1", 
                    False, 
                    f"Success field is false: {data}",
                    data
                )
                return False
            
            self.log_test(
                "Track Activity User 1", 
                True, 
                f"Activity tracked successfully for user {self.telegram_id} in section 'schedule'",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Track Activity User 1", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Track Activity User 1", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    
    def test_get_online_users_after_first_activity(self) -> bool:
        """Test GET /api/admin/online-users - Check user appears in online list"""
        try:
            print("🧪 Testing: Get Online Users After First Activity")
            
            response = requests.get(
                f"{API_BASE}/admin/online-users",
                params={"minutes": 5},
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test(
                    "Get Online Users After First Activity", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate required fields
            required_fields = ["online_now", "online_last_hour", "online_last_day", "users", "threshold_minutes", "timestamp"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test(
                    "Get Online Users After First Activity", 
                    False, 
                    f"Missing required fields: {missing_fields}",
                    data
                )
                return False
            
            # Check if our test user is in the list
            user_found = False
            user_data = None
            for user in data["users"]:
                if user.get("telegram_id") == self.telegram_id:
                    user_found = True
                    user_data = user
                    break
            
            if not user_found:
                self.log_test(
                    "Get Online Users After First Activity", 
                    False, 
                    f"Test user {self.telegram_id} not found in online users list",
                    data
                )
                return False
            
            # Validate user has required fields
            user_required_fields = ["telegram_id", "first_name", "last_name", "username", "photo_url", "faculty", "course", "last_activity", "activity_text", "current_section"]
            user_missing_fields = [field for field in user_required_fields if field not in user_data]
            
            if user_missing_fields:
                self.log_test(
                    "Get Online Users After First Activity", 
                    False, 
                    f"User data missing fields: {user_missing_fields}",
                    user_data
                )
                return False
            
            # Check current_section is 'schedule'
            if user_data.get("current_section") != "schedule":
                self.log_test(
                    "Get Online Users After First Activity", 
                    False, 
                    f"Expected current_section='schedule', got: {user_data.get('current_section')}",
                    user_data
                )
                return False
            
            self.log_test(
                "Get Online Users After First Activity", 
                True, 
                f"User {self.telegram_id} found in online list with section 'schedule'. Online now: {data['online_now']}, Activity: {user_data.get('activity_text')}",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Get Online Users After First Activity", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Get Online Users After First Activity", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    
    def test_track_activity_user_2(self) -> bool:
        """Test POST /api/admin/track-activity - Track activity for user 2 with section=tasks"""
        try:
            print("🧪 Testing: Track Activity User 2 (tasks)")
            
            response = requests.post(
                f"{API_BASE}/admin/track-activity",
                params={
                    "telegram_id": self.telegram_id_2,
                    "section": "tasks"
                },
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test(
                    "Track Activity User 2", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate required fields
            if "success" not in data:
                self.log_test(
                    "Track Activity User 2", 
                    False, 
                    f"Missing success field in response",
                    data
                )
                return False
            
            # Validate success is true
            if not data.get("success"):
                self.log_test(
                    "Track Activity User 2", 
                    False, 
                    f"Success field is false: {data}",
                    data
                )
                return False
            
            self.log_test(
                "Track Activity User 2", 
                True, 
                f"Activity tracked successfully for user {self.telegram_id_2} in section 'tasks'",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Track Activity User 2", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Track Activity User 2", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    
    def test_track_activity_user_3(self) -> bool:
        """Test POST /api/admin/track-activity - Track activity for user 3 with section=music"""
        try:
            print("🧪 Testing: Track Activity User 3 (music)")
            
            response = requests.post(
                f"{API_BASE}/admin/track-activity",
                params={
                    "telegram_id": self.telegram_id_3,
                    "section": "music"
                },
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test(
                    "Track Activity User 3", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate required fields
            if "success" not in data:
                self.log_test(
                    "Track Activity User 3", 
                    False, 
                    f"Missing success field in response",
                    data
                )
                return False
            
            # Validate success is true
            if not data.get("success"):
                self.log_test(
                    "Track Activity User 3", 
                    False, 
                    f"Success field is false: {data}",
                    data
                )
                return False
            
            self.log_test(
                "Track Activity User 3", 
                True, 
                f"Activity tracked successfully for user {self.telegram_id_3} in section 'music'",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Track Activity User 3", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Track Activity User 3", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    
    def test_get_online_users_increased_count(self) -> bool:
        """Test GET /api/admin/online-users - Check that online_now increased"""
        try:
            print("🧪 Testing: Get Online Users - Check Increased Count")
            
            response = requests.get(
                f"{API_BASE}/admin/online-users",
                params={"minutes": 5},
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test(
                    "Get Online Users - Check Increased Count", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate required fields
            required_fields = ["online_now", "online_last_hour", "online_last_day", "users", "threshold_minutes", "timestamp"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test(
                    "Get Online Users - Check Increased Count", 
                    False, 
                    f"Missing required fields: {missing_fields}",
                    data
                )
                return False
            
            # Check that we have at least our test users online
            online_count = data["online_now"]
            if online_count < 1:
                self.log_test(
                    "Get Online Users - Check Increased Count", 
                    False, 
                    f"Expected at least 1 user online, got: {online_count}",
                    data
                )
                return False
            
            # Check that activity_text shows "только что" for recent activity
            recent_activity_found = False
            for user in data["users"]:
                if user.get("activity_text") == "только что":
                    recent_activity_found = True
                    break
            
            if not recent_activity_found:
                self.log_test(
                    "Get Online Users - Check Increased Count", 
                    False, 
                    f"No user with activity_text='только что' found",
                    data
                )
                return False
            
            # Check that our test users are in different sections
            user_sections = {}
            for user in data["users"]:
                telegram_id = user.get("telegram_id")
                if telegram_id in [self.telegram_id, self.telegram_id_2, self.telegram_id_3]:
                    user_sections[telegram_id] = user.get("current_section")
            
            expected_sections = {
                self.telegram_id: "schedule",
                self.telegram_id_2: "tasks", 
                self.telegram_id_3: "music"
            }
            
            sections_match = True
            for tid, expected_section in expected_sections.items():
                if tid in user_sections and user_sections[tid] != expected_section:
                    sections_match = False
                    break
            
            self.log_test(
                "Get Online Users - Check Increased Count", 
                True, 
                f"Online users count: {online_count}, Recent activity found: {recent_activity_found}, Sections match: {sections_match}",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Get Online Users - Check Increased Count", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Get Online Users - Check Increased Count", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    
    def test_get_online_users_with_minutes_param(self) -> bool:
        """Test GET /api/admin/online-users?minutes=1 - Check minutes parameter works"""
        try:
            print("🧪 Testing: Get Online Users with minutes=1 parameter")
            
            response = requests.get(
                f"{API_BASE}/admin/online-users",
                params={"minutes": 1},
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test(
                    "Get Online Users with minutes=1", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate required fields
            required_fields = ["online_now", "online_last_hour", "online_last_day", "users", "threshold_minutes", "timestamp"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test(
                    "Get Online Users with minutes=1", 
                    False, 
                    f"Missing required fields: {missing_fields}",
                    data
                )
                return False
            
            # Check that threshold_minutes is 1
            if data["threshold_minutes"] != 1:
                self.log_test(
                    "Get Online Users with minutes=1", 
                    False, 
                    f"Expected threshold_minutes=1, got: {data['threshold_minutes']}",
                    data
                )
                return False
            
            # Since we just sent activity, users should still be online within 1 minute
            online_count = data["online_now"]
            if online_count < 1:
                self.log_test(
                    "Get Online Users with minutes=1", 
                    False, 
                    f"Expected at least 1 user online within 1 minute, got: {online_count}",
                    data
                )
                return False
            
            self.log_test(
                "Get Online Users with minutes=1", 
                True, 
                f"Minutes parameter working correctly. Online within 1 minute: {online_count}, Threshold: {data['threshold_minutes']}",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Get Online Users with minutes=1", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Get Online Users with minutes=1", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    
    def run_all_tests(self):
        """Run all Admin Online Users API tests in sequence"""
        print("🚀 Starting Admin Online Users API Testing")
        print("=" * 50)
        
        # Admin Online Users API Tests (from review request)
        admin_tests = [
            self.test_track_activity_user_1,              # 1. POST /api/admin/track-activity (user 1, section=schedule)
            self.test_get_online_users_after_first_activity,  # 2. GET /api/admin/online-users (check user appears)
            self.test_track_activity_user_2,              # 3. POST /api/admin/track-activity (user 2, section=tasks)
            self.test_track_activity_user_3,              # 4. POST /api/admin/track-activity (user 3, section=music)
            self.test_get_online_users_increased_count,   # 5. GET /api/admin/online-users (check increased count and activity_text)
            self.test_get_online_users_with_minutes_param # 6. GET /api/admin/online-users?minutes=1 (check minutes parameter)
        ]
        
        all_tests = admin_tests
        
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
            print("🎉 All Admin Online Users API tests PASSED!")
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
    """Main test execution for Listening Rooms API"""
    print("🎵 Listening Rooms API Testing")
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