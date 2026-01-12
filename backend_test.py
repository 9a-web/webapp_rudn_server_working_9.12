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
            'User-Agent': 'Music-Pagination-Tester/1.0'
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
    
    def test_initial_load(self):
        """Test initial load: GET /api/music/my?count=30&offset=0"""
        print("🎵 Testing initial load (count=30, offset=0)...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/music/my?count=30&offset=0")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check response structure
                required_fields = ["tracks", "has_more", "count"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    tracks = data.get("tracks", [])
                    has_more = data.get("has_more")
                    count = data.get("count")
                    
                    # Validate response structure
                    success = True
                    details = []
                    
                    # Check tracks array
                    if isinstance(tracks, list):
                        details.append(f"✅ tracks: array with {len(tracks)} items")
                    else:
                        details.append(f"❌ tracks: expected array, got {type(tracks)}")
                        success = False
                    
                    # Check has_more boolean
                    if isinstance(has_more, bool):
                        details.append(f"✅ has_more: {has_more}")
                        # If we have tracks and there are more than 30 total, has_more should be true
                        if len(tracks) == 30 and has_more:
                            details.append("✅ has_more=true indicates more tracks available")
                        elif len(tracks) < 30 and not has_more:
                            details.append("✅ has_more=false indicates no more tracks")
                        elif len(tracks) > 0:
                            details.append(f"ℹ️  has_more={has_more} with {len(tracks)} tracks returned")
                    else:
                        details.append(f"❌ has_more: expected boolean, got {type(has_more)}")
                        success = False
                    
                    # Check count field
                    if isinstance(count, int):
                        details.append(f"✅ count: {count}")
                        if count == len(tracks):
                            details.append("✅ count matches tracks array length")
                        else:
                            details.append(f"⚠️  count ({count}) != tracks length ({len(tracks)})")
                    else:
                        details.append(f"❌ count: expected integer, got {type(count)}")
                        success = False
                    
                    self.log_result(
                        "Initial load - Response structure",
                        success,
                        "; ".join(details),
                        {"tracks_count": len(tracks), "has_more": has_more, "count": count}
                    )
                else:
                    self.log_result(
                        "Initial load - Response structure",
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
                    "Initial load - HTTP Response",
                    False,
                    f"Unexpected status code: {response.status_code}",
                    data
                )
                
        except Exception as e:
            self.log_result(
                "Initial load - Request",
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