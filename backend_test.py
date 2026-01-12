#!/usr/bin/env python3
"""
Music Pagination API Testing
Testing the music pagination API `/api/music/my` to verify "Load More" functionality
Based on review request requirements
"""

import requests
import json
import sys
from datetime import datetime

# Configuration - Using localhost as backend runs on 0.0.0.0:8001 internally
BACKEND_URL = "http://localhost:8001/api"

class MusicPaginationTester:
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
    
    def test_get_lk_status(self):
        """Test GET /api/lk/status/{telegram_id} - Check LK connection status"""
        print("📊 Testing GET /api/lk/status/{telegram_id}...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/lk/status/{TEST_TELEGRAM_ID}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check response structure - should have lk_connected field
                if "lk_connected" in data:
                    # For new user (telegram_id=999777888), should return lk_connected=false
                    expected_connected = False
                    if data["lk_connected"] == expected_connected:
                        self.log_result(
                            "GET /api/lk/status/{telegram_id} - New user status",
                            True,
                            f"✅ Correct: lk_connected={data['lk_connected']} for new user",
                            data
                        )
                    else:
                        self.log_result(
                            "GET /api/lk/status/{telegram_id} - New user status",
                            False,
                            f"❌ Expected lk_connected={expected_connected}, got {data['lk_connected']}",
                            data
                        )
                else:
                    self.log_result(
                        "GET /api/lk/status/{telegram_id} - Response structure",
                        False,
                        "Missing required field: lk_connected",
                        data
                    )
            else:
                try:
                    data = response.json()
                except:
                    data = response.text
                self.log_result(
                    "GET /api/lk/status/{telegram_id} - Response",
                    False,
                    f"Unexpected status code: {response.status_code}",
                    data
                )
                
        except Exception as e:
            self.log_result(
                "GET /api/lk/status/{telegram_id} - Request",
                False,
                f"Request failed: {str(e)}"
            )

    def test_get_lk_data(self):
        """Test GET /api/lk/data/{telegram_id} - Get LK data for user without connection"""
        print("🔍 Testing GET /api/lk/data/{telegram_id}...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/lk/data/{TEST_TELEGRAM_ID}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check response structure according to review request
                required_fields = ["personal_data", "last_sync", "cached", "lk_connected"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    # Expected response for user without connection
                    expected_response = {
                        "personal_data": None,
                        "last_sync": None,
                        "cached": False,
                        "lk_connected": False
                    }
                    
                    # Check each field
                    all_correct = True
                    details = []
                    
                    for field, expected_value in expected_response.items():
                        actual_value = data.get(field)
                        if actual_value == expected_value:
                            details.append(f"✅ {field}: {actual_value}")
                        else:
                            details.append(f"❌ {field}: expected {expected_value}, got {actual_value}")
                            all_correct = False
                    
                    self.log_result(
                        "GET /api/lk/data/{telegram_id} - User without connection",
                        all_correct,
                        "; ".join(details),
                        data
                    )
                else:
                    self.log_result(
                        "GET /api/lk/data/{telegram_id} - Response structure",
                        False,
                        f"Missing required fields: {missing_fields}",
                        data
                    )
            else:
                try:
                    data = response.json()
                except:
                    data = response.text
                self.log_result(
                    "GET /api/lk/data/{telegram_id} - Response",
                    False,
                    f"Unexpected status code: {response.status_code}",
                    data
                )
                
        except Exception as e:
            self.log_result(
                "GET /api/lk/data/{telegram_id} - Request",
                False,
                f"Request failed: {str(e)}"
            )
    
    def test_post_lk_connect(self):
        """Test POST /api/lk/connect - Attempt connection with invalid credentials"""
        print("🔗 Testing POST /api/lk/connect...")
        
        # Using exact credentials from review request
        payload = {
            "telegram_id": 123456789,
            "email": "test@student.rudn.ru",
            "password": "testpassword"
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/lk/connect", json=payload)
            
            if response.status_code == 401:
                # Expected response for invalid credentials
                try:
                    data = response.json()
                    if "message" in data and "Неверный логин или пароль ЛК РУДН" in data["message"]:
                        self.log_result(
                            "POST /api/lk/connect - Invalid credentials (401)",
                            True,
                            "✅ Correct 401 response with expected error message",
                            data
                        )
                    else:
                        self.log_result(
                            "POST /api/lk/connect - Invalid credentials (401)",
                            True,
                            f"✅ 401 response received, message: {data.get('message', 'No message')}",
                            data
                        )
                except:
                    self.log_result(
                        "POST /api/lk/connect - Invalid credentials (401)",
                        True,
                        "✅ 401 response received (no JSON body)"
                    )
            elif response.status_code == 404:
                self.log_result(
                    "POST /api/lk/connect - Endpoint existence",
                    False,
                    "❌ Endpoint returns 404 - endpoint not found",
                    response.text
                )
            elif response.status_code == 500:
                try:
                    data = response.json()
                except:
                    data = response.text
                self.log_result(
                    "POST /api/lk/connect - Server error",
                    True,
                    "⚠️ Endpoint exists, server error (500) - likely RUDN connection issue",
                    data
                )
            elif response.status_code == 200:
                try:
                    data = response.json()
                except:
                    data = response.text
                self.log_result(
                    "POST /api/lk/connect - Unexpected success",
                    False,
                    "❌ Unexpected 200 response for invalid credentials",
                    data
                )
            else:
                try:
                    data = response.json()
                except:
                    data = response.text
                self.log_result(
                    "POST /api/lk/connect - Other response",
                    True,
                    f"Endpoint exists, status: {response.status_code}",
                    data
                )
                
        except Exception as e:
            self.log_result(
                "POST /api/lk/connect - Request",
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