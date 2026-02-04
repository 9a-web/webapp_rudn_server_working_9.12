#!/usr/bin/env python3
"""
Backend Testing Suite for Privacy Settings API
Tests the privacy settings endpoints as specified in the review request
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
        self.test_results = []
        self.admin_telegram_id = 765963392  # Admin telegram_id from review request
        self.original_privacy_settings = None  # Store original settings to restore later
        
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
    
    # ============ Privacy Settings API Tests ============
    
    def test_get_privacy_settings_initial(self) -> bool:
        """Test GET /api/profile/765963392/privacy - get current privacy settings"""
        try:
            print("🧪 Testing: Get Initial Privacy Settings")
            
            response = requests.get(f"{API_BASE}/profile/{self.admin_telegram_id}/privacy", timeout=10)
            
            if response.status_code != 200:
                self.log_test(
                    "Get Initial Privacy Settings", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate required fields
            required_fields = ["show_online_status", "show_in_search", "show_friends_list", "show_achievements", "show_schedule"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test(
                    "Get Initial Privacy Settings", 
                    False, 
                    f"Missing required fields: {missing_fields}",
                    data
                )
                return False
            
            # Validate all fields are boolean
            for field in required_fields:
                if not isinstance(data[field], bool):
                    self.log_test(
                        "Get Initial Privacy Settings", 
                        False, 
                        f"Field '{field}' should be boolean, got {type(data[field]).__name__}: {data[field]}",
                        data
                    )
                    return False
            
            # Store original settings for restoration later
            self.original_privacy_settings = data.copy()
            
            self.log_test(
                "Get Initial Privacy Settings", 
                True, 
                f"Privacy settings retrieved successfully. Settings: {data}",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Get Initial Privacy Settings", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Get Initial Privacy Settings", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    
    def test_update_privacy_settings(self) -> bool:
        """Test PUT /api/profile/765963392/privacy - update privacy settings"""
        try:
            print("🧪 Testing: Update Privacy Settings")
            
            # Test data as specified in review request
            update_data = {
                "show_online_status": False,
                "show_in_search": True,
                "show_friends_list": False,
                "show_achievements": True,
                "show_schedule": False
            }
            
            response = requests.put(
                f"{API_BASE}/profile/{self.admin_telegram_id}/privacy", 
                json=update_data,
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test(
                    "Update Privacy Settings", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate required fields
            required_fields = ["show_online_status", "show_in_search", "show_friends_list", "show_achievements", "show_schedule"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test(
                    "Update Privacy Settings", 
                    False, 
                    f"Missing required fields: {missing_fields}",
                    data
                )
                return False
            
            # Validate updated values match what we sent
            for field, expected_value in update_data.items():
                if data.get(field) != expected_value:
                    self.log_test(
                        "Update Privacy Settings", 
                        False, 
                        f"Field '{field}' not updated correctly. Expected: {expected_value}, got: {data.get(field)}",
                        data
                    )
                    return False
            
            self.log_test(
                "Update Privacy Settings", 
                True, 
                f"Privacy settings updated successfully. New settings: {data}",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Update Privacy Settings", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Update Privacy Settings", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    
    def test_verify_privacy_settings_saved(self) -> bool:
        """Test GET /api/profile/765963392/privacy - verify the settings were saved correctly"""
        try:
            print("🧪 Testing: Verify Privacy Settings Saved")
            
            response = requests.get(f"{API_BASE}/profile/{self.admin_telegram_id}/privacy", timeout=10)
            
            if response.status_code != 200:
                self.log_test(
                    "Verify Privacy Settings Saved", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Expected values from the update test
            expected_values = {
                "show_online_status": False,
                "show_in_search": True,
                "show_friends_list": False,
                "show_achievements": True,
                "show_schedule": False
            }
            
            # Validate all values match what we set
            for field, expected_value in expected_values.items():
                if data.get(field) != expected_value:
                    self.log_test(
                        "Verify Privacy Settings Saved", 
                        False, 
                        f"Field '{field}' not persisted correctly. Expected: {expected_value}, got: {data.get(field)}",
                        data
                    )
                    return False
            
            self.log_test(
                "Verify Privacy Settings Saved", 
                True, 
                f"Privacy settings verified successfully. All values persisted correctly: {data}",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Verify Privacy Settings Saved", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Verify Privacy Settings Saved", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    
    def test_restore_original_privacy_settings(self) -> bool:
        """Restore original privacy settings after testing"""
        if not self.original_privacy_settings:
            self.log_test(
                "Restore Original Privacy Settings", 
                True, 
                "No original settings to restore"
            )
            return True
        
        try:
            print("🧪 Testing: Restore Original Privacy Settings")
            
            response = requests.put(
                f"{API_BASE}/profile/{self.admin_telegram_id}/privacy", 
                json=self.original_privacy_settings,
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test(
                    "Restore Original Privacy Settings", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate restored values match original
            for field, expected_value in self.original_privacy_settings.items():
                if data.get(field) != expected_value:
                    self.log_test(
                        "Restore Original Privacy Settings", 
                        False, 
                        f"Field '{field}' not restored correctly. Expected: {expected_value}, got: {data.get(field)}",
                        data
                    )
                    return False
            
            self.log_test(
                "Restore Original Privacy Settings", 
                True, 
                f"Original privacy settings restored successfully: {data}",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Restore Original Privacy Settings", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Restore Original Privacy Settings", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    
    def run_all_tests(self):
        """Run all Privacy Settings API tests in sequence"""
        print("🚀 Starting Privacy Settings API Testing")
        print("=" * 50)
        
        # Privacy Settings API Tests (from review request)
        privacy_tests = [
            self.test_get_privacy_settings_initial,     # 1. GET /api/profile/765963392/privacy - get current privacy settings
            self.test_update_privacy_settings,          # 2. PUT /api/profile/765963392/privacy - update privacy settings
            self.test_verify_privacy_settings_saved,    # 3. GET /api/profile/765963392/privacy - verify the settings were saved correctly
            self.test_restore_original_privacy_settings # 4. Restore original settings (cleanup)
        ]
        
        all_tests = privacy_tests
        
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
            print("🎉 All Privacy Settings API tests PASSED!")
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
    """Main test execution for Web Sessions API"""
    print("🔗 Web Sessions API Testing")
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