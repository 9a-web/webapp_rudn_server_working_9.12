#!/usr/bin/env python3
"""
Backend Test Suite for User Type Filtering Feature
Tests user_type filtering on admin endpoints
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any, List

# Backend URL from frontend .env
BACKEND_URL = "https://ref-tracker-admin.preview.emergentagent.com/api"

class TestResults:
    def __init__(self):
        self.results = []
        self.passed = 0
        self.failed = 0
        
    def add_result(self, test_name: str, success: bool, message: str, details: str = ""):
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": datetime.utcnow().isoformat()
        }
        self.results.append(result)
        if success:
            self.passed += 1
            print(f"✅ {test_name}: {message}")
        else:
            self.failed += 1
            print(f"❌ {test_name}: {message}")
            if details:
                print(f"   Details: {details}")
                
    def print_summary(self):
        print(f"\n{'='*80}")
        print(f"TEST SUMMARY: {self.passed} passed, {self.failed} failed")
        print(f"{'='*80}")
        if self.failed > 0:
            print("\nFAILED TESTS:")
            for result in self.results:
                if not result["success"]:
                    print(f"- {result['test']}: {result['message']}")

def make_request(method: str, endpoint: str, data: Dict[Any, Any] = None, expected_status: int = 200, allow_redirects: bool = True) -> Dict[Any, Any]:
    """Make HTTP request with error handling"""
    url = f"{BACKEND_URL}{endpoint}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, timeout=10, allow_redirects=allow_redirects)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, timeout=10, allow_redirects=allow_redirects)
        elif method.upper() == "PUT":
            response = requests.put(url, json=data, timeout=10, allow_redirects=allow_redirects)
        elif method.upper() == "DELETE":
            response = requests.delete(url, timeout=10, allow_redirects=allow_redirects)
        else:
            raise ValueError(f"Unsupported method: {method}")
            
        print(f"{method} {endpoint} -> {response.status_code}")
        
        if response.status_code != expected_status:
            print(f"Expected {expected_status}, got {response.status_code}")
            if response.text and len(response.text) < 500:
                print(f"Response: {response.text}")
            
        # Handle redirect responses
        if response.status_code in [301, 302, 303, 307, 308]:
            return {
                "status_code": response.status_code,
                "data": {"redirect_url": response.headers.get("Location", "")},
                "success": response.status_code == expected_status
            }
            
        return {
            "status_code": response.status_code,
            "data": response.json() if response.text and response.text.strip().startswith('{') else {},
            "success": response.status_code == expected_status
        }
    except requests.exceptions.Timeout:
        return {"status_code": 0, "data": {}, "success": False, "error": "Request timeout"}
    except requests.exceptions.RequestException as e:
        return {"status_code": 0, "data": {}, "success": False, "error": str(e)}
    except json.JSONDecodeError:
        return {
            "status_code": response.status_code if 'response' in locals() else 0,
            "data": {"raw_response": response.text[:200] if 'response' in locals() and response.text else ""},
            "success": response.status_code == expected_status,
            "error": "Invalid JSON response"
        }

def test_user_type_filtering():
    """Test user_type filtering feature on admin endpoints"""
    results = TestResults()
    
    print(f"Testing User Type Filtering Feature at {BACKEND_URL}")
    print("="*80)
    
    # Test user data following the test plan
    test_telegram_users = [
        {
            "telegram_id": 123456789,  # < 10B = Telegram user "Иван"
            "username": "ivan_user",
            "first_name": "Иван",
            "last_name": "Петров",
            "group_id": "test_group_1",
            "group_name": "ИСИТ-23-1",
            "facultet_id": "test_faculty",
            "level_id": "bachelor", 
            "kurs": "2",
            "form_code": "full_time"
        },
        {
            "telegram_id": 987654321,  # < 10B = Telegram user "Мария"
            "username": "maria_user",
            "first_name": "Мария",
            "last_name": "Сидорова",
            "group_id": "test_group_2", 
            "group_name": "ИСИТ-23-2",
            "facultet_id": "test_faculty",
            "level_id": "bachelor",
            "kurs": "2",
            "form_code": "full_time"
        }
    ]
    
    test_web_user = {
        "telegram_id": 142191465619684,  # >= 10B = Web guest "Пользователь"
        "username": "web_guest_user",
        "first_name": "Пользователь",
        "last_name": "Веб",
        "group_id": "test_group_3",
        "group_name": "ИСИТ-23-3",
        "facultet_id": "test_faculty", 
        "level_id": "bachelor",
        "kurs": 2,
        "form_code": "full_time"
    }
    
    created_user_ids = []
    
    # Step 1: Clean up existing test users
    print("\n1. Cleaning up existing test users...")
    test_ids = [123456789, 987654321, 142191465619684]
    cleanup_success = 0
    
    for user_id in test_ids:
        response = make_request("DELETE", f"/user-settings/{user_id}", expected_status=200)
        if response["success"] or response["status_code"] == 404:
            cleanup_success += 1
            print(f"   ✓ Cleaned up user {user_id} (or didn't exist)")
        else:
            print(f"   ⚠ Failed to clean user {user_id}: {response}")
    
    results.add_result(
        "Cleanup Test Users", True,
        f"Cleaned up {cleanup_success}/{len(test_ids)} test users successfully",
        "Existing test users removed or didn't exist"
    )
    
    # Step 2: Create test users
    print("\n2. Creating test users...")
    
    # Create first Telegram user
    response = make_request("POST", "/user-settings", test_telegram_users[0])
    if response["success"] and response["data"]:
        telegram_user_1_id = response["data"].get("telegram_id")
        created_user_ids.append(telegram_user_1_id)
        results.add_result(
            "Create Telegram User 1", True,
            f"Created Telegram user 'Иван' with ID {telegram_user_1_id}",
            f"Response: {response['data']}"
        )
    else:
        results.add_result(
            "Create Telegram User 1", False,
            "Failed to create first Telegram user",
            f"Response: {response}"
        )
        return results  # Can't continue without users
    
    # Create second Telegram user
    response = make_request("POST", "/user-settings", test_telegram_users[1])
    if response["success"] and response["data"]:
        telegram_user_2_id = response["data"].get("telegram_id")
        created_user_ids.append(telegram_user_2_id)
        results.add_result(
            "Create Telegram User 2", True,
            f"Created Telegram user 'Мария' with ID {telegram_user_2_id}",
            f"Response: {response['data']}"
        )
    else:
        results.add_result(
            "Create Telegram User 2", False,
            "Failed to create second Telegram user",
            f"Response: {response}"
        )
    
    # Create web guest user
    response = make_request("POST", "/user-settings", test_web_user)
    if response["success"] and response["data"]:
        web_user_id = response["data"].get("telegram_id")
        created_user_ids.append(web_user_id)
        results.add_result(
            "Create Web User", True,
            f"Created web guest user 'Пользователь' with ID {web_user_id}",
            f"Response: {response['data']}"
        )
    else:
        results.add_result(
            "Create Web User", False,
            "Failed to create web guest user",
            f"Response: {response}"
        )
    
    # Step 3: Test GET /api/admin/users (no filter) - should return 3 users with user_type field
    print("\n3. Testing admin users endpoint (no filter)...")
    response = make_request("GET", "/admin/users?limit=100")
    if response["success"] and isinstance(response["data"], list):
        users = response["data"]
        
        # Find our test users
        test_users_found = [u for u in users if u.get("telegram_id") in created_user_ids]
        
        # Check if all users have user_type field
        users_with_type = [u for u in test_users_found if "user_type" in u]
        
        if len(test_users_found) >= 3 and len(users_with_type) >= 3:
            results.add_result(
                "Admin Users No Filter", True,
                f"Found {len(test_users_found)} test users, all have user_type field",
                f"User types found: {[u.get('user_type') for u in users_with_type]}"
            )
        else:
            results.add_result(
                "Admin Users No Filter", False,
                f"Expected 3 users with user_type field, found {len(test_users_found)} test users, {len(users_with_type)} with user_type",
                f"Test users: {test_users_found}"
            )
    else:
        results.add_result(
            "Admin Users No Filter", False,
            "Failed to get admin users list",
            f"Response: {response}"
        )
    
    # Step 4: Test GET /api/admin/users?user_type=telegram - should return exactly 2 users
    print("\n4. Testing admin users endpoint (telegram filter)...")
    response = make_request("GET", "/admin/users?user_type=telegram&limit=100")
    if response["success"] and isinstance(response["data"], list):
        telegram_users = response["data"]
        
        # Find our test telegram users
        test_telegram_found = [u for u in telegram_users if u.get("telegram_id") in [123456789, 987654321]]
        
        # Verify all returned users are telegram type
        all_telegram = all(u.get("user_type") == "telegram" for u in telegram_users if "user_type" in u)
        
        if len(test_telegram_found) >= 2 and all_telegram:
            results.add_result(
                "Admin Users Telegram Filter", True,
                f"Found {len(test_telegram_found)} test Telegram users, all have user_type='telegram'",
                f"Telegram users: {[u.get('first_name') for u in test_telegram_found]}"
            )
        else:
            results.add_result(
                "Admin Users Telegram Filter", False,
                f"Expected 2 Telegram users, found {len(test_telegram_found)}, all_telegram={all_telegram}",
                f"Response: {telegram_users[:5]}"  # Show first 5 for debugging
            )
    else:
        results.add_result(
            "Admin Users Telegram Filter", False,
            "Failed to get telegram users list",
            f"Response: {response}"
        )
    
    # Step 5: Test GET /api/admin/users?user_type=web - should return exactly 1 user
    print("\n5. Testing admin users endpoint (web filter)...")
    response = make_request("GET", "/admin/users?user_type=web&limit=100")
    if response["success"] and isinstance(response["data"], list):
        web_users = response["data"]
        
        # Find our test web user
        test_web_found = [u for u in web_users if u.get("telegram_id") == 142191465619684]
        
        # Verify all returned users are web type
        all_web = all(u.get("user_type") == "web" for u in web_users if "user_type" in u)
        
        if len(test_web_found) >= 1 and all_web:
            results.add_result(
                "Admin Users Web Filter", True,
                f"Found {len(test_web_found)} test web user, all have user_type='web'",
                f"Web user: {test_web_found[0].get('first_name') if test_web_found else 'None'}"
            )
        else:
            results.add_result(
                "Admin Users Web Filter", False,
                f"Expected 1 web user, found {len(test_web_found)}, all_web={all_web}",
                f"Response: {web_users[:5]}"  # Show first 5 for debugging
            )
    else:
        results.add_result(
            "Admin Users Web Filter", False,
            "Failed to get web users list",
            f"Response: {response}"
        )
    
    # Step 6: Test GET /api/admin/stats - should have telegram_users=2, web_guest_users=1
    print("\n6. Testing admin stats endpoint...")
    response = make_request("GET", "/admin/stats")
    if response["success"] and response["data"]:
        stats = response["data"]
        telegram_count = stats.get("telegram_users", 0)
        web_count = stats.get("web_guest_users", 0)
        total_count = stats.get("total_users", 0)
        
        # We expect at least our test users
        if telegram_count >= 2 and web_count >= 1 and total_count >= 3:
            results.add_result(
                "Admin Stats User Types", True,
                f"Stats correct: telegram_users={telegram_count}, web_guest_users={web_count}, total_users={total_count}",
                f"Full stats: telegram_users={telegram_count}, web_guest_users={web_count}, total_users={total_count}"
            )
        else:
            results.add_result(
                "Admin Stats User Types", False,
                f"Stats incorrect: telegram_users={telegram_count}, web_guest_users={web_count}, total_users={total_count}",
                f"Expected at least: telegram_users>=2, web_guest_users>=1, total_users>=3"
            )
    else:
        results.add_result(
            "Admin Stats User Types", False,
            "Failed to get admin stats",
            f"Response: {response}"
        )
    
    # Step 7: Test search + filter: GET /api/admin/users?search=Иван&user_type=telegram
    print("\n7. Testing search with user type filter...")
    response = make_request("GET", "/admin/users?search=Иван&user_type=telegram&limit=100")
    if response["success"] and isinstance(response["data"], list):
        search_results = response["data"]
        
        # Should find our "Иван" user
        ivan_found = [u for u in search_results if u.get("first_name") == "Иван" and u.get("user_type") == "telegram"]
        
        # All results should be telegram type and contain search term
        all_telegram = all(u.get("user_type") == "telegram" for u in search_results if "user_type" in u)
        contains_ivan = all("иван" in (u.get("first_name", "") + u.get("last_name", "") + u.get("username", "")).lower() 
                           for u in search_results)
        
        if len(ivan_found) >= 1 and all_telegram and contains_ivan:
            results.add_result(
                "Search with User Type Filter", True,
                f"Found {len(ivan_found)} 'Иван' users with telegram type",
                f"Results: {[{'name': u.get('first_name'), 'type': u.get('user_type')} for u in search_results]}"
            )
        else:
            results.add_result(
                "Search with User Type Filter", False,
                f"Search failed: found {len(ivan_found)} Ivan users, all_telegram={all_telegram}, contains_ivan={contains_ivan}",
                f"Search results: {search_results}"
            )
    else:
        results.add_result(
            "Search with User Type Filter", False,
            "Failed to search users with filter",
            f"Response: {response}"
        )
    
    return results

if __name__ == "__main__":
    print("Starting User Type Filtering Backend Test Suite")
    print(f"Backend URL: {BACKEND_URL}")
    print("="*80)
    
    test_results = test_user_type_filtering()
    test_results.print_summary()
    
    # Return exit code based on results
    exit_code = 1 if test_results.failed > 0 else 0
    print(f"\nTest completed with exit code: {exit_code}")
    exit(exit_code)