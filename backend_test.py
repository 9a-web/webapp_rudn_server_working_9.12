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
    
    # ============ Web Sessions API Tests ============
    
    def test_create_web_session(self) -> bool:
        """Test POST /api/web-sessions - create a new web session"""
        try:
            print("🧪 Testing: Create Web Session")
            
            # Test data for device info (optional)
            device_data = {
                "device_name": "Test Device",
                "browser": "Chrome",
                "os": "Linux",
                "user_agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
            }
            
            response = requests.post(f"{API_BASE}/web-sessions", json=device_data, timeout=10)
            
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
            
            # Validate status is PENDING
            if data.get("status") != "pending":
                self.log_test(
                    "Create Web Session", 
                    False, 
                    f"Expected status 'pending', got '{data.get('status')}'",
                    data
                )
                return False
            
            # Store session token for subsequent tests
            self.session_token = data["session_token"]
            
            self.log_test(
                "Create Web Session", 
                True, 
                f"Session created successfully. Token: {self.session_token[:8]}..., Status: {data['status']}",
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
    
    
    def test_get_session_status(self) -> bool:
        """Test GET /api/web-sessions/{token}/status - check session status"""
        if not self.session_token:
            self.log_test(
                "Get Session Status", 
                False, 
                "No session token available from previous test"
            )
            return False
        
        try:
            print("🧪 Testing: Get Session Status")
            
            response = requests.get(
                f"{API_BASE}/web-sessions/{self.session_token}/status",
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test(
                    "Get Session Status", 
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
                    "Get Session Status", 
                    False, 
                    f"Missing required fields: {missing_fields}",
                    data
                )
                return False
            
            # Validate session token matches
            if data.get("session_token") != self.session_token:
                self.log_test(
                    "Get Session Status", 
                    False, 
                    f"Session token mismatch. Expected: {self.session_token}, got: {data.get('session_token')}",
                    data
                )
                return False
            
            # Status should be pending (since we haven't linked it yet)
            expected_status = "pending"
            if data.get("status") != expected_status:
                self.log_test(
                    "Get Session Status", 
                    False, 
                    f"Expected status '{expected_status}', got '{data.get('status')}'",
                    data
                )
                return False
            
            self.log_test(
                "Get Session Status", 
                True, 
                f"Session status retrieved successfully. Status: {data['status']}, Token: {data['session_token'][:8]}...",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Get Session Status", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Get Session Status", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    
    def test_get_user_devices(self) -> bool:
        """Test GET /api/web-sessions/user/{telegram_id}/devices - get user devices"""
        try:
            print("🧪 Testing: Get User Devices")
            
            response = requests.get(
                f"{API_BASE}/web-sessions/user/{self.admin_telegram_id}/devices",
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test(
                    "Get User Devices", 
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
                    "Get User Devices", 
                    False, 
                    f"Missing required fields: {missing_fields}",
                    data
                )
                return False
            
            devices = data["devices"]
            total = data["total"]
            
            # Validate total matches devices length
            if total != len(devices):
                self.log_test(
                    "Get User Devices", 
                    False, 
                    f"Total count mismatch. Expected: {len(devices)}, got: {total}",
                    data
                )
                return False
            
            # Validate each device has required fields
            for i, device in enumerate(devices):
                device_required_fields = ["session_token", "device_name", "linked_at", "last_active"]
                device_missing_fields = [field for field in device_required_fields if field not in device]
                
                if device_missing_fields:
                    self.log_test(
                        "Get User Devices", 
                        False, 
                        f"Device {i} missing required fields: {device_missing_fields}",
                        device
                    )
                    return False
            
            self.log_test(
                "Get User Devices", 
                True, 
                f"Found {total} devices for user {self.admin_telegram_id}. All devices have required fields.",
                {"total_devices": total, "devices_sample": devices[:2] if devices else []}
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Get User Devices", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Get User Devices", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    
    def run_all_tests(self):
        """Run all Web Sessions API tests in sequence"""
        print("🚀 Starting Web Sessions API Testing")
        print("=" * 50)
        
        # Web Sessions API Tests (from review request)
        web_sessions_tests = [
            self.test_create_web_session,        # 1. Create web session
            self.test_get_session_status,        # 2. Check session status
            self.test_get_user_devices,          # 3. Get user devices
        ]
        
        all_tests = web_sessions_tests
        
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
            print("🎉 All Web Sessions API tests PASSED!")
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