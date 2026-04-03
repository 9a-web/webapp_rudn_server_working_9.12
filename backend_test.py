#!/usr/bin/env python3
"""
Backend API Testing Script for RUDN Schedule App - Graffiti Endpoints
Tests all graffiti-related endpoints with comprehensive test cases.
"""

import asyncio
import aiohttp
import json
import sys
from datetime import datetime
import base64

# Backend URL from environment
BACKEND_URL = "https://student-platform-11.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

# Test user ID
TEST_USER_ID = 765963392

class GraffitiAPITester:
    def __init__(self):
        self.session = None
        self.test_results = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_test(self, test_name, success, details="", expected="", actual=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "success": success,
            "details": details,
            "expected": expected,
            "actual": actual,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        print(f"{status}: {test_name}")
        if details:
            print(f"    Details: {details}")
        if not success and expected:
            print(f"    Expected: {expected}")
            print(f"    Actual: {actual}")
        print()
    
    async def make_request(self, method, url, **kwargs):
        """Make HTTP request with error handling"""
        try:
            async with self.session.request(method, url, **kwargs) as response:
                try:
                    data = await response.json()
                except:
                    data = await response.text()
                return response.status, data
        except Exception as e:
            return None, str(e)
    
    async def test_save_graffiti_valid(self):
        """Test 1: Valid graffiti save"""
        test_name = "Save graffiti - Valid data URL"
        
        # Create a simple base64 PNG data URL
        valid_data_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        
        payload = {
            "graffiti_data": valid_data_url,
            "requester_telegram_id": TEST_USER_ID
        }
        
        status, response = await self.make_request(
            "PUT", 
            f"{API_BASE}/profile/{TEST_USER_ID}/graffiti",
            json=payload
        )
        
        if status == 200:
            if isinstance(response, dict):
                has_success = response.get("success") is True
                has_timestamp = "graffiti_updated_at" in response
                
                if has_success and has_timestamp:
                    self.log_test(test_name, True, f"Response: {response}")
                else:
                    missing = []
                    if not has_success: missing.append("success: true")
                    if not has_timestamp: missing.append("graffiti_updated_at")
                    self.log_test(
                        test_name, False, 
                        f"Missing fields: {missing}",
                        "Response with success: true AND graffiti_updated_at",
                        str(response)
                    )
            else:
                self.log_test(test_name, False, "Invalid response format", "JSON object", str(response))
        else:
            self.log_test(test_name, False, f"HTTP {status}", "200", str(response))
    
    async def test_save_graffiti_missing_requester(self):
        """Test 2: Missing requester_telegram_id"""
        test_name = "Save graffiti - Missing requester"
        
        payload = {
            "graffiti_data": "data:image/png;base64,test"
        }
        
        status, response = await self.make_request(
            "PUT", 
            f"{API_BASE}/profile/{TEST_USER_ID}/graffiti",
            json=payload
        )
        
        if status == 400:
            self.log_test(test_name, True, f"Correctly rejected: {response}")
        else:
            self.log_test(test_name, False, f"HTTP {status}", "400", str(response))
    
    async def test_save_graffiti_wrong_requester(self):
        """Test 3: Wrong requester_telegram_id"""
        test_name = "Save graffiti - Wrong requester"
        
        payload = {
            "graffiti_data": "data:image/png;base64,abc",
            "requester_telegram_id": 99999
        }
        
        status, response = await self.make_request(
            "PUT", 
            f"{API_BASE}/profile/{TEST_USER_ID}/graffiti",
            json=payload
        )
        
        if status == 403:
            self.log_test(test_name, True, f"Correctly rejected: {response}")
        else:
            self.log_test(test_name, False, f"HTTP {status}", "403", str(response))
    
    async def test_save_graffiti_invalid_format(self):
        """Test 4: Invalid data URL format"""
        test_name = "Save graffiti - Invalid format"
        
        payload = {
            "graffiti_data": "not_a_data_url",
            "requester_telegram_id": TEST_USER_ID
        }
        
        status, response = await self.make_request(
            "PUT", 
            f"{API_BASE}/profile/{TEST_USER_ID}/graffiti",
            json=payload
        )
        
        if status == 400:
            self.log_test(test_name, True, f"Correctly rejected: {response}")
        else:
            self.log_test(test_name, False, f"HTTP {status}", "400", str(response))
    
    async def test_save_graffiti_empty_data(self):
        """Test 5: Empty graffiti data"""
        test_name = "Save graffiti - Empty data"
        
        payload = {
            "graffiti_data": "",
            "requester_telegram_id": TEST_USER_ID
        }
        
        status, response = await self.make_request(
            "PUT", 
            f"{API_BASE}/profile/{TEST_USER_ID}/graffiti",
            json=payload
        )
        
        if status == 200:
            self.log_test(test_name, True, f"Empty data accepted: {response}")
        else:
            self.log_test(test_name, False, f"HTTP {status}", "200", str(response))
    
    async def test_get_graffiti_after_save(self):
        """Test 6: Get graffiti after saving"""
        test_name = "Get graffiti - After save"
        
        status, response = await self.make_request(
            "GET", 
            f"{API_BASE}/profile/{TEST_USER_ID}/graffiti"
        )
        
        if status == 200:
            if isinstance(response, dict):
                has_data = "graffiti_data" in response
                has_timestamp = "graffiti_updated_at" in response
                
                if has_data and has_timestamp:
                    self.log_test(test_name, True, f"Response: {response}")
                else:
                    missing = []
                    if not has_data: missing.append("graffiti_data")
                    if not has_timestamp: missing.append("graffiti_updated_at")
                    self.log_test(
                        test_name, False,
                        f"Missing fields: {missing}",
                        "Response with graffiti_data AND graffiti_updated_at",
                        str(response)
                    )
            else:
                self.log_test(test_name, False, "Invalid response format", "JSON object", str(response))
        else:
            self.log_test(test_name, False, f"HTTP {status}", "200", str(response))
    
    async def test_get_graffiti_nonexistent_user(self):
        """Test 7: Get graffiti for non-existent user"""
        test_name = "Get graffiti - Non-existent user"
        
        nonexistent_user_id = 999999999
        status, response = await self.make_request(
            "GET", 
            f"{API_BASE}/profile/{nonexistent_user_id}/graffiti"
        )
        
        if status == 200:
            if isinstance(response, dict):
                graffiti_data = response.get("graffiti_data")
                graffiti_timestamp = response.get("graffiti_updated_at")
                
                if graffiti_data == "" and graffiti_timestamp is None:
                    self.log_test(test_name, True, f"Correct empty response: {response}")
                else:
                    self.log_test(
                        test_name, False,
                        "Incorrect empty response format",
                        '{"graffiti_data": "", "graffiti_updated_at": null}',
                        str(response)
                    )
            else:
                self.log_test(test_name, False, "Invalid response format", "JSON object", str(response))
        elif status == 404:
            self.log_test(test_name, False, "Should return 200 with empty data, not 404", "200", f"404: {response}")
        else:
            self.log_test(test_name, False, f"HTTP {status}", "200", str(response))
    
    async def test_clear_graffiti_valid(self):
        """Test 8: Valid graffiti clear"""
        test_name = "Clear graffiti - Valid request"
        
        payload = {
            "requester_telegram_id": TEST_USER_ID
        }
        
        status, response = await self.make_request(
            "POST", 
            f"{API_BASE}/profile/{TEST_USER_ID}/graffiti/clear",
            json=payload
        )
        
        if status == 200:
            if isinstance(response, dict) and response.get("success") is True:
                self.log_test(test_name, True, f"Response: {response}")
            else:
                self.log_test(test_name, False, "Missing success: true", '{"success": true}', str(response))
        else:
            self.log_test(test_name, False, f"HTTP {status}", "200", str(response))
    
    async def test_clear_graffiti_missing_requester(self):
        """Test 9: Clear graffiti missing requester"""
        test_name = "Clear graffiti - Missing requester"
        
        payload = {}
        
        status, response = await self.make_request(
            "POST", 
            f"{API_BASE}/profile/{TEST_USER_ID}/graffiti/clear",
            json=payload
        )
        
        if status == 400:
            self.log_test(test_name, True, f"Correctly rejected: {response}")
        else:
            self.log_test(test_name, False, f"HTTP {status}", "400", str(response))
    
    async def test_clear_graffiti_wrong_requester(self):
        """Test 10: Clear graffiti wrong requester"""
        test_name = "Clear graffiti - Wrong requester"
        
        payload = {
            "requester_telegram_id": 99999
        }
        
        status, response = await self.make_request(
            "POST", 
            f"{API_BASE}/profile/{TEST_USER_ID}/graffiti/clear",
            json=payload
        )
        
        if status == 403:
            self.log_test(test_name, True, f"Correctly rejected: {response}")
        else:
            self.log_test(test_name, False, f"HTTP {status}", "403", str(response))
    
    async def test_get_graffiti_after_clear(self):
        """Test 11: Get graffiti after clear"""
        test_name = "Get graffiti - After clear"
        
        status, response = await self.make_request(
            "GET", 
            f"{API_BASE}/profile/{TEST_USER_ID}/graffiti"
        )
        
        if status == 200:
            if isinstance(response, dict):
                graffiti_data = response.get("graffiti_data")
                
                if graffiti_data == "":
                    self.log_test(test_name, True, f"Graffiti cleared: {response}")
                else:
                    self.log_test(test_name, False, "Graffiti not cleared", "Empty graffiti_data", str(response))
            else:
                self.log_test(test_name, False, "Invalid response format", "JSON object", str(response))
        else:
            self.log_test(test_name, False, f"HTTP {status}", "200", str(response))
    
    async def run_all_tests(self):
        """Run all graffiti API tests in sequence"""
        print(f"🧪 Starting Graffiti API Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test User ID: {TEST_USER_ID}")
        print("=" * 60)
        
        # Test sequence as specified in the review request
        test_methods = [
            self.test_save_graffiti_valid,
            self.test_get_graffiti_after_save,
            self.test_save_graffiti_wrong_requester,
            self.test_save_graffiti_missing_requester,
            self.test_save_graffiti_invalid_format,
            self.test_save_graffiti_empty_data,
            self.test_clear_graffiti_valid,
            self.test_clear_graffiti_missing_requester,
            self.test_clear_graffiti_wrong_requester,
            self.test_get_graffiti_after_clear,
            self.test_get_graffiti_nonexistent_user,
        ]
        
        for test_method in test_methods:
            try:
                await test_method()
            except Exception as e:
                self.log_test(test_method.__name__, False, f"Test exception: {e}")
        
        # Summary
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in self.test_results if r["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return passed, total

async def main():
    """Main test runner"""
    async with GraffitiAPITester() as tester:
        passed, total = await tester.run_all_tests()
        
        # Exit with error code if any tests failed
        if passed < total:
            sys.exit(1)
        else:
            print("\n🎉 All tests passed!")
            sys.exit(0)

if __name__ == "__main__":
    asyncio.run(main())