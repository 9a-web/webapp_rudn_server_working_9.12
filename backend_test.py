#!/usr/bin/env python3
"""
Backend Testing Script for Admin User Type Filtering
Testing with seeded database containing:
- 5 Telegram users (telegram_id < 10,000,000,000): IDs 765963392, 1311283832, 523439151, 987654321, 111222333
- 3 Web visitors (telegram_id >= 10,000,000,000): IDs 10000000000001, 10000000000002, 10000000000003
"""

import asyncio
import httpx
import os
from typing import Dict, List, Any
import json

# Get backend URL from environment
BACKEND_URL = "https://session-debug-1.preview.emergentagent.com/api"

class AdminEndpointsTest:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.results = []
        
    async def make_request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make HTTP request and return response data"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                url = f"{self.base_url}{endpoint}"
                print(f"🔗 {method} {url}")
                
                if 'params' in kwargs:
                    print(f"📋 Query params: {kwargs['params']}")
                
                response = await client.request(method, url, **kwargs)
                
                print(f"✅ Status: {response.status_code}")
                
                if response.status_code >= 400:
                    error_text = response.text
                    print(f"❌ Error response: {error_text}")
                    return {
                        "status_code": response.status_code,
                        "error": error_text,
                        "success": False
                    }
                
                try:
                    data = response.json()
                    print(f"📄 Response keys: {list(data.keys()) if isinstance(data, dict) else f'Array length: {len(data)}' if isinstance(data, list) else 'Non-dict response'}")
                    return {
                        "status_code": response.status_code,
                        "data": data,
                        "success": True
                    }
                except Exception as e:
                    print(f"❌ JSON parse error: {e}")
                    return {
                        "status_code": response.status_code,
                        "error": f"JSON parse error: {e}",
                        "success": False
                    }
                    
            except Exception as e:
                print(f"❌ Request failed: {e}")
                return {
                    "status_code": 0,
                    "error": str(e),
                    "success": False
                }

    def log_result(self, test_name: str, success: bool, message: str, details: Dict = None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"\n{status} {test_name}")
        print(f"   {message}")
        if details:
            print(f"   Details: {details}")
        
        self.results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "details": details or {}
        })

    async def test_admin_users_telegram_filter(self):
        """Test GET /api/admin/users?user_type=telegram → should return exactly 5 users"""
        print(f"\n{'='*60}")
        print("TEST 1: Admin Users - Telegram Filter")
        print(f"{'='*60}")
        
        response = await self.make_request("GET", "/admin/users", params={"user_type": "telegram"})
        
        if not response["success"]:
            self.log_result("Admin Users Telegram Filter", False, f"API call failed: {response['error']}")
            return False
        
        data = response["data"]
        
        # Check if response is a list
        if not isinstance(data, list):
            self.log_result("Admin Users Telegram Filter", False, f"Expected array, got {type(data)}")
            return False
        
        # Check count
        if len(data) != 5:
            self.log_result("Admin Users Telegram Filter", False, 
                          f"Expected 5 Telegram users, got {len(data)}", 
                          {"actual_count": len(data), "users": [u.get('telegram_id') for u in data]})
            return False
        
        # Check user_type field for each user
        for user in data:
            if user.get("user_type") != "telegram":
                self.log_result("Admin Users Telegram Filter", False, 
                              f"User {user.get('telegram_id')} has user_type='{user.get('user_type')}', expected 'telegram'")
                return False
            
            # Check telegram_id is < 10B
            telegram_id = user.get("telegram_id", 0)
            if telegram_id >= 10_000_000_000:
                self.log_result("Admin Users Telegram Filter", False, 
                              f"User {telegram_id} should have telegram_id < 10B for telegram type")
                return False
        
        telegram_ids = [u.get('telegram_id') for u in data]
        expected_ids = {765963392, 1311283832, 523439151, 987654321, 111222333}
        actual_ids = set(telegram_ids)
        
        if actual_ids != expected_ids:
            self.log_result("Admin Users Telegram Filter", False, 
                          f"Telegram user IDs don't match expected", 
                          {"expected": sorted(expected_ids), "actual": sorted(actual_ids)})
            return False
        
        self.log_result("Admin Users Telegram Filter", True, 
                       f"Found exactly 5 Telegram users with correct user_type", 
                       {"telegram_ids": sorted(telegram_ids)})
        return True

    async def test_admin_users_web_filter(self):
        """Test GET /api/admin/users?user_type=web → should return exactly 3 users"""
        print(f"\n{'='*60}")
        print("TEST 2: Admin Users - Web Filter")
        print(f"{'='*60}")
        
        response = await self.make_request("GET", "/admin/users", params={"user_type": "web"})
        
        if not response["success"]:
            self.log_result("Admin Users Web Filter", False, f"API call failed: {response['error']}")
            return False
        
        data = response["data"]
        
        # Check if response is a list
        if not isinstance(data, list):
            self.log_result("Admin Users Web Filter", False, f"Expected array, got {type(data)}")
            return False
        
        # Check count
        if len(data) != 3:
            self.log_result("Admin Users Web Filter", False, 
                          f"Expected 3 web users, got {len(data)}", 
                          {"actual_count": len(data), "users": [u.get('telegram_id') for u in data]})
            return False
        
        # Check user_type field for each user
        for user in data:
            if user.get("user_type") != "web":
                self.log_result("Admin Users Web Filter", False, 
                              f"User {user.get('telegram_id')} has user_type='{user.get('user_type')}', expected 'web'")
                return False
            
            # Check telegram_id is >= 10B
            telegram_id = user.get("telegram_id", 0)
            if telegram_id < 10_000_000_000:
                self.log_result("Admin Users Web Filter", False, 
                              f"User {telegram_id} should have telegram_id >= 10B for web type")
                return False
        
        telegram_ids = [u.get('telegram_id') for u in data]
        expected_ids = {10000000000001, 10000000000002, 10000000000003}
        actual_ids = set(telegram_ids)
        
        if actual_ids != expected_ids:
            self.log_result("Admin Users Web Filter", False, 
                          f"Web user IDs don't match expected", 
                          {"expected": sorted(expected_ids), "actual": sorted(actual_ids)})
            return False
        
        self.log_result("Admin Users Web Filter", True, 
                       f"Found exactly 3 web users with correct user_type", 
                       {"telegram_ids": sorted(telegram_ids)})
        return True

    async def test_admin_users_no_filter(self):
        """Test GET /api/admin/users (no filter) → should return all 8 users"""
        print(f"\n{'='*60}")
        print("TEST 3: Admin Users - No Filter (All Users)")
        print(f"{'='*60}")
        
        response = await self.make_request("GET", "/admin/users")
        
        if not response["success"]:
            self.log_result("Admin Users No Filter", False, f"API call failed: {response['error']}")
            return False
        
        data = response["data"]
        
        # Check if response is a list
        if not isinstance(data, list):
            self.log_result("Admin Users No Filter", False, f"Expected array, got {type(data)}")
            return False
        
        # Check total count (should be at least 8, could be more if other users exist)
        if len(data) < 8:
            self.log_result("Admin Users No Filter", False, 
                          f"Expected at least 8 users, got {len(data)}", 
                          {"actual_count": len(data)})
            return False
        
        # Check that all users have user_type field
        users_without_type = []
        telegram_count = 0
        web_count = 0
        
        for user in data:
            if "user_type" not in user:
                users_without_type.append(user.get('telegram_id'))
            elif user["user_type"] == "telegram":
                telegram_count += 1
            elif user["user_type"] == "web":
                web_count += 1
        
        if users_without_type:
            self.log_result("Admin Users No Filter", False, 
                          f"Users without user_type field: {users_without_type}")
            return False
        
        # Check that we have at least our expected users
        telegram_ids = [u.get('telegram_id') for u in data if u.get('user_type') == 'telegram']
        web_ids = [u.get('telegram_id') for u in data if u.get('user_type') == 'web']
        
        expected_telegram = {765963392, 1311283832, 523439151, 987654321, 111222333}
        expected_web = {10000000000001, 10000000000002, 10000000000003}
        
        actual_telegram = set(telegram_ids)
        actual_web = set(web_ids)
        
        missing_telegram = expected_telegram - actual_telegram
        missing_web = expected_web - actual_web
        
        if missing_telegram or missing_web:
            self.log_result("Admin Users No Filter", False, 
                          f"Missing expected users", 
                          {"missing_telegram": list(missing_telegram), "missing_web": list(missing_web)})
            return False
        
        self.log_result("Admin Users No Filter", True, 
                       f"Found all expected users among {len(data)} total users", 
                       {"total_users": len(data), "telegram_users": telegram_count, "web_users": web_count})
        return True

    async def test_admin_stats(self):
        """Test GET /api/admin/stats → should show telegram_users=5 and web_guest_users=3"""
        print(f"\n{'='*60}")
        print("TEST 4: Admin Stats - User Type Counts")
        print(f"{'='*60}")
        
        response = await self.make_request("GET", "/admin/stats")
        
        if not response["success"]:
            self.log_result("Admin Stats", False, f"API call failed: {response['error']}")
            return False
        
        data = response["data"]
        
        # Check required fields exist
        required_fields = ["telegram_users", "web_guest_users", "total_users"]
        missing_fields = [f for f in required_fields if f not in data]
        
        if missing_fields:
            self.log_result("Admin Stats", False, 
                          f"Missing required fields: {missing_fields}")
            return False
        
        # Check telegram_users count
        telegram_users = data.get("telegram_users", 0)
        if telegram_users < 5:
            self.log_result("Admin Stats", False, 
                          f"Expected at least 5 telegram_users, got {telegram_users}")
            return False
        
        # Check web_guest_users count
        web_guest_users = data.get("web_guest_users", 0)
        if web_guest_users < 3:
            self.log_result("Admin Stats", False, 
                          f"Expected at least 3 web_guest_users, got {web_guest_users}")
            return False
        
        # Check that total_users >= telegram_users + web_guest_users
        total_users = data.get("total_users", 0)
        expected_min_total = telegram_users + web_guest_users
        
        if total_users < expected_min_total:
            self.log_result("Admin Stats", False, 
                          f"total_users ({total_users}) < telegram_users ({telegram_users}) + web_guest_users ({web_guest_users})")
            return False
        
        self.log_result("Admin Stats", True, 
                       f"Correct user type statistics", 
                       {"telegram_users": telegram_users, "web_guest_users": web_guest_users, "total_users": total_users})
        return True

    async def test_admin_users_search_with_filter(self):
        """Test GET /api/admin/users?user_type=telegram&search=Алексей → should return 1 user (Алексей Иванов)"""
        print(f"\n{'='*60}")
        print("TEST 5: Admin Users - Search with Telegram Filter")
        print(f"{'='*60}")
        
        # First, let's see what users we have to find one with Cyrillic name
        response = await self.make_request("GET", "/admin/users", params={"user_type": "telegram"})
        
        if not response["success"]:
            self.log_result("Admin Users Search with Filter", False, f"Failed to get telegram users: {response['error']}")
            return False
        
        telegram_users = response["data"]
        
        # Find a user with a Russian name to search for
        search_user = None
        for user in telegram_users:
            first_name = user.get('first_name', '')
            if first_name and any(ord(char) > 127 for char in first_name):  # Contains non-ASCII (Cyrillic)
                search_user = user
                search_term = first_name[:3] if len(first_name) >= 3 else first_name  # Use first 3 chars
                break
        
        if not search_user:
            # Try to find any user with a first name
            for user in telegram_users:
                if user.get('first_name'):
                    search_user = user
                    search_term = user['first_name'][:3] if len(user['first_name']) >= 3 else user['first_name']
                    break
        
        if not search_user:
            self.log_result("Admin Users Search with Filter", False, 
                          "No telegram users with searchable names found in test data")
            return False
        
        print(f"🔍 Searching for: '{search_term}' in telegram users")
        
        # Perform the search
        search_response = await self.make_request("GET", "/admin/users", 
                                                params={"user_type": "telegram", "search": search_term})
        
        if not search_response["success"]:
            self.log_result("Admin Users Search with Filter", False, 
                          f"Search API call failed: {search_response['error']}")
            return False
        
        search_data = search_response["data"]
        
        # Check if response is a list
        if not isinstance(search_data, list):
            self.log_result("Admin Users Search with Filter", False, f"Expected array, got {type(search_data)}")
            return False
        
        # Check that we found at least one user
        if len(search_data) == 0:
            self.log_result("Admin Users Search with Filter", False, 
                          f"No users found for search term '{search_term}'")
            return False
        
        # Check that all returned users are telegram type
        non_telegram_users = [u for u in search_data if u.get("user_type") != "telegram"]
        if non_telegram_users:
            self.log_result("Admin Users Search with Filter", False, 
                          f"Search returned non-telegram users: {[u.get('telegram_id') for u in non_telegram_users]}")
            return False
        
        # Check that the search term matches
        found_matching = False
        for user in search_data:
            first_name = user.get('first_name', '').lower()
            last_name = user.get('last_name', '').lower()
            username = user.get('username', '').lower()
            
            if (search_term.lower() in first_name or 
                search_term.lower() in last_name or 
                search_term.lower() in username):
                found_matching = True
                break
        
        if not found_matching:
            self.log_result("Admin Users Search with Filter", False, 
                          f"Search results don't contain search term '{search_term}'")
            return False
        
        self.log_result("Admin Users Search with Filter", True, 
                       f"Search with user_type filter working correctly", 
                       {"search_term": search_term, "results_count": len(search_data), 
                        "found_users": [f"{u.get('first_name', '')} {u.get('last_name', '')}" for u in search_data]})
        return True

    async def run_all_tests(self):
        """Run all test scenarios"""
        print(f"\n{'='*80}")
        print("🧪 STARTING ADMIN USER TYPE FILTERING TESTS")
        print(f"Backend URL: {self.base_url}")
        print(f"{'='*80}")
        
        tests = [
            self.test_admin_users_telegram_filter,
            self.test_admin_users_web_filter, 
            self.test_admin_users_no_filter,
            self.test_admin_stats,
            self.test_admin_users_search_with_filter
        ]
        
        passed = 0
        total = len(tests)
        
        for test_func in tests:
            try:
                success = await test_func()
                if success:
                    passed += 1
            except Exception as e:
                print(f"❌ Test {test_func.__name__} crashed: {e}")
                self.log_result(test_func.__name__, False, f"Test crashed: {e}")
        
        print(f"\n{'='*80}")
        print(f"🏁 TEST SUMMARY: {passed}/{total} PASSED")
        print(f"{'='*80}")
        
        # Print detailed results
        for result in self.results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}: {result['message']}")
            
        return passed, total, self.results

async def main():
    """Main test function"""
    tester = AdminEndpointsTest()
    passed, total, results = await tester.run_all_tests()
    
    print(f"\n📊 Final Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests PASSED!")
        return 0
    else:
        print("❌ Some tests FAILED!")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)