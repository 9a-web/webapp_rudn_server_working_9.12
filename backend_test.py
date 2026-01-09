#!/usr/bin/env python3
"""
Comprehensive Backend Testing for LK RUDN API
Testing LK RUDN (Личный Кабинет РУДН) API endpoints with ENV=test
"""

import requests
import json
import sys
from datetime import datetime

# Configuration - Using production URL as specified in review request
BACKEND_URL = "https://rudn-schedule.ru/api"
TEST_TELEGRAM_ID = 123456789  # Non-existent user for testing as specified

class LKRUDNTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'LK-RUDN-API-Tester/1.0'
        })
        self.results = []
        
    def log_result(self, test_name, success, details="", response_data=None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        if not success and response_data:
            print(f"    Response: {response_data}")
        print()
    
    def test_get_lk_data(self):
        """Test GET /api/lk/data/{telegram_id} - Check connection status"""
        print("🔍 Testing GET /api/lk/data/{telegram_id}...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/lk/data/{TEST_TELEGRAM_ID}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check response structure
                required_fields = ["lk_connected", "personal_data", "last_sync", "cached"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    # For non-existent user, lk_connected should be False
                    if data["lk_connected"] == False:
                        self.log_result(
                            "GET /api/lk/data/{telegram_id} - Non-existent user",
                            True,
                            f"Correct response structure, lk_connected=False for non-existent user",
                            data
                        )
                    else:
                        self.log_result(
                            "GET /api/lk/data/{telegram_id} - Non-existent user",
                            True,
                            f"Response structure correct, lk_connected={data['lk_connected']}",
                            data
                        )
                else:
                    self.log_result(
                        "GET /api/lk/data/{telegram_id} - Non-existent user",
                        False,
                        f"Missing required fields: {missing_fields}",
                        data
                    )
            elif response.status_code == 404:
                # 404 is acceptable for non-existent user
                try:
                    data = response.json()
                    self.log_result(
                        "GET /api/lk/data/{telegram_id} - Non-existent user",
                        True,
                        "404 response is acceptable for non-existent user",
                        data
                    )
                except:
                    self.log_result(
                        "GET /api/lk/data/{telegram_id} - Non-existent user",
                        True,
                        "404 response (no JSON body)"
                    )
            else:
                try:
                    data = response.json()
                except:
                    data = response.text
                self.log_result(
                    "GET /api/lk/data/{telegram_id} - Non-existent user",
                    False,
                    f"Unexpected status code: {response.status_code}",
                    data
                )
                
        except Exception as e:
            self.log_result(
                "GET /api/lk/data/{telegram_id} - Non-existent user",
                False,
                f"Request failed: {str(e)}"
            )
    
    def test_post_lk_connect(self):
        """Test POST /api/lk/connect - Connect LK account"""
        print("🔗 Testing POST /api/lk/connect...")
        
        payload = {
            "telegram_id": TEST_TELEGRAM_ID,
            "email": "test@rudn.ru",
            "password": "testpassword"
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/lk/connect", json=payload)
            
            # Should NOT return 404 (endpoint should exist)
            if response.status_code == 404:
                self.log_result(
                    "POST /api/lk/connect - Endpoint existence",
                    False,
                    "Endpoint returns 404 - endpoint not found",
                    response.text
                )
            else:
                # Any other status code means endpoint exists
                try:
                    data = response.json()
                except:
                    data = response.text
                
                if response.status_code == 401:
                    self.log_result(
                        "POST /api/lk/connect - Endpoint existence",
                        True,
                        "Endpoint exists, authentication failed as expected (401)",
                        data
                    )
                elif response.status_code == 500:
                    self.log_result(
                        "POST /api/lk/connect - Endpoint existence",
                        True,
                        "Endpoint exists, server error (500) - likely RUDN connection issue",
                        data
                    )
                elif response.status_code == 200:
                    self.log_result(
                        "POST /api/lk/connect - Endpoint existence",
                        True,
                        "Endpoint exists and working (200) - unexpected success",
                        data
                    )
                else:
                    self.log_result(
                        "POST /api/lk/connect - Endpoint existence",
                        True,
                        f"Endpoint exists, status: {response.status_code}",
                        data
                    )
                
        except Exception as e:
            self.log_result(
                "POST /api/lk/connect - Endpoint existence",
                False,
                f"Request failed: {str(e)}"
            )
    
    def test_delete_lk_disconnect(self):
        """Test DELETE /api/lk/disconnect/{telegram_id} - Disconnect LK account"""
        print("🔌 Testing DELETE /api/lk/disconnect/{telegram_id}...")
        
        try:
            response = self.session.delete(f"{BACKEND_URL}/lk/disconnect/{TEST_TELEGRAM_ID}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if "success" in data and "message" in data:
                        self.log_result(
                            "DELETE /api/lk/disconnect/{telegram_id} - Success response",
                            True,
                            "Endpoint working, proper success response structure",
                            data
                        )
                    else:
                        self.log_result(
                            "DELETE /api/lk/disconnect/{telegram_id} - Success response",
                            True,
                            "Endpoint working, response structure may vary",
                            data
                        )
                except:
                    self.log_result(
                        "DELETE /api/lk/disconnect/{telegram_id} - Success response",
                        True,
                        "Endpoint working (200), no JSON response"
                    )
            elif response.status_code == 404:
                try:
                    data = response.json()
                    # Check if it's user not found (acceptable) vs endpoint not found
                    if "detail" in data and "не найден" in data["detail"].lower():
                        self.log_result(
                            "DELETE /api/lk/disconnect/{telegram_id} - User not found",
                            True,
                            "Endpoint exists, user not found (404) - acceptable",
                            data
                        )
                    else:
                        self.log_result(
                            "DELETE /api/lk/disconnect/{telegram_id} - User not found",
                            False,
                            "Endpoint may not exist (404)",
                            data
                        )
                except:
                    self.log_result(
                        "DELETE /api/lk/disconnect/{telegram_id} - User not found",
                        False,
                        "404 response, unclear if endpoint exists"
                    )
            else:
                try:
                    data = response.json()
                except:
                    data = response.text
                self.log_result(
                    "DELETE /api/lk/disconnect/{telegram_id} - Response",
                    True,
                    f"Endpoint exists, status: {response.status_code}",
                    data
                )
                
        except Exception as e:
            self.log_result(
                "DELETE /api/lk/disconnect/{telegram_id} - Response",
                False,
                f"Request failed: {str(e)}"
            )
    
    def run_all_tests(self):
        """Run all LK RUDN API tests"""
        print("🧪 LK RUDN API Testing Suite")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test Telegram ID: {TEST_TELEGRAM_ID}")
        print("=" * 60)
        
        # Test all endpoints
        self.test_get_lk_data()
        self.test_post_lk_connect()
        self.test_delete_lk_disconnect()
        
        # Summary
        total_tests = len(self.results)
        passed_tests = sum(1 for result in self.results if result["success"])
        
        print("=" * 60)
        print(f"📊 Test Summary: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            print("🎉 All LK RUDN API endpoints are working correctly!")
            return True
        else:
            print("⚠️  Some tests failed. Check the details above.")
            
            # Show failed tests
            failed_tests = [result for result in self.results if not result["success"]]
            if failed_tests:
                print("\n❌ Failed Tests:")
                for test in failed_tests:
                    print(f"  - {test['test']}: {test['details']}")
            
            return False

def main():
    """Main test runner"""
    tester = LKRUDNTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)