#!/usr/bin/env python3
"""
Backend API Testing Script for RUDN Schedule App - Profile Endpoints
Tests all profile-related endpoints with comprehensive test cases.
"""

import asyncio
import aiohttp
import json
import sys
from datetime import datetime
import base64

# Backend URL from environment
BACKEND_URL = "https://rudn-server-4.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

# Test user IDs
TEST_USER_1 = 123456789
TEST_USER_2 = 987654321
TEST_USER_3 = 555666777

class ProfileAPITester:
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
    
    async def setup_test_users(self):
        """Create test users for testing"""
        print("🔧 Setting up test users...")
        
        users = [
            {
                "telegram_id": TEST_USER_1,
                "first_name": "TestUser1",
                "username": "testuser1",
                "group_id": "ИБАС-01-23",
                "group_name": "ИБАС-01-23",
                "facultet_id": "1",
                "facultet_name": "Институт прикладной математики и телекоммуникаций",
                "level_id": "1",
                "kurs": "1",
                "form_code": "1"
            },
            {
                "telegram_id": TEST_USER_2,
                "first_name": "TestUser2", 
                "username": "testuser2",
                "group_id": "ИБАС-02-23",
                "group_name": "ИБАС-02-23",
                "facultet_id": "1",
                "facultet_name": "Институт прикладной математики и телекоммуникаций",
                "level_id": "1",
                "kurs": "1",
                "form_code": "1"
            },
            {
                "telegram_id": TEST_USER_3,
                "first_name": "TestUser3",
                "username": "testuser3",
                "group_id": "ИБАС-03-23", 
                "group_name": "ИБАС-03-23",
                "facultet_id": "1",
                "facultet_name": "Институт прикладной математики и телекоммуникаций",
                "level_id": "1",
                "kurs": "1",
                "form_code": "1"
            }
        ]
        
        for user in users:
            status, response = await self.make_request(
                "POST",
                f"{API_BASE}/user-settings",
                json=user
            )
            if status == 200:
                print(f"✅ Created user {user['telegram_id']}")
            else:
                print(f"⚠️ User {user['telegram_id']} setup: {status} - {response}")
    
    # ========== PROFILE ENDPOINT TESTS ==========
    
    async def test_profile_bidirectional_block_check(self):
        """Test 1: Bidirectional block check in profile endpoint"""
        test_name = "Profile - Bidirectional block check"
        
        # First create a block relationship: USER_1 blocks USER_2
        block_payload = {
            "telegram_id": TEST_USER_1
        }
        
        # Create block via friends API
        status, response = await self.make_request(
            "POST", 
            f"{API_BASE}/friends/block/{TEST_USER_2}",
            json=block_payload
        )
        
        if status != 200:
            self.log_test(f"{test_name} - Block setup", False, f"Failed to create block: {status} - {response}")
            return
        
        # Test 1a: USER_2 tries to view USER_1's profile (should get 403)
        status, response = await self.make_request(
            "GET",
            f"{API_BASE}/profile/{TEST_USER_1}?viewer_telegram_id={TEST_USER_2}"
        )
        
        if status == 403:
            self.log_test(f"{test_name} - Blocked viewer", True, f"Correctly blocked: {response}")
        else:
            self.log_test(f"{test_name} - Blocked viewer", False, f"HTTP {status}", "403", str(response))
        
        # Test 1b: USER_1 tries to view USER_2's profile (should also get 403 - bidirectional)
        status, response = await self.make_request(
            "GET", 
            f"{API_BASE}/profile/{TEST_USER_2}?viewer_telegram_id={TEST_USER_1}"
        )
        
        if status == 403:
            self.log_test(f"{test_name} - Blocker viewing blocked", True, f"Correctly blocked bidirectionally: {response}")
        else:
            self.log_test(f"{test_name} - Blocker viewing blocked", False, f"HTTP {status}", "403", str(response))
        
        # Clean up: unblock the user
        await self.make_request(
            "DELETE",
            f"{API_BASE}/friends/block/{TEST_USER_2}",
            json=block_payload
        )
    
    async def test_profile_anonymous_privacy(self):
        """Test 2: Anonymous privacy - limited data without viewer_telegram_id"""
        test_name = "Profile - Anonymous privacy"
        
        # Request profile without viewer_telegram_id
        status, response = await self.make_request(
            "GET",
            f"{API_BASE}/profile/{TEST_USER_1}"
        )
        
        if status == 200 and isinstance(response, dict):
            # Check that sensitive fields are null for anonymous requests
            group_id = response.get("group_id")
            kurs = response.get("kurs") 
            created_at = response.get("created_at")
            
            if group_id is None and kurs is None and created_at is None:
                self.log_test(test_name, True, f"Anonymous request correctly limited: {response}")
            else:
                self.log_test(
                    test_name, False,
                    f"Anonymous request exposed sensitive data",
                    "group_id=null, kurs=null, created_at=null",
                    f"group_id={group_id}, kurs={kurs}, created_at={created_at}"
                )
        else:
            self.log_test(test_name, False, f"HTTP {status}", "200", str(response))
    
    async def test_profile_friendship_status(self):
        """Test 3: Friendship status in profile response"""
        test_name = "Profile - Friendship status"
        
        # Request USER_2's profile from USER_3's perspective
        status, response = await self.make_request(
            "GET",
            f"{API_BASE}/profile/{TEST_USER_2}?viewer_telegram_id={TEST_USER_3}"
        )
        
        if status == 200 and isinstance(response, dict):
            friendship_status = response.get("friendship_status")
            # friendship_status can be null when users aren't friends, which is correct
            if "friendship_status" in response:
                self.log_test(test_name, True, f"Friendship status field present: {friendship_status}")
            else:
                self.log_test(test_name, False, "Missing friendship_status field", "friendship_status field", str(response))
        else:
            self.log_test(test_name, False, f"HTTP {status}", "200", str(response))
    
    # ========== QR ENDPOINT TESTS ==========
    
    async def test_qr_privacy_check(self):
        """Test 4: QR endpoint privacy check"""
        test_name = "QR - Privacy check"
        
        # First set user privacy to hide from search
        privacy_payload = {
            "show_in_search": False,
            "show_friends_list": True,
            "show_achievements": True,
            "show_online_status": True
        }
        
        await self.make_request(
            "PUT",
            f"{API_BASE}/profile/{TEST_USER_1}/privacy",
            json=privacy_payload
        )
        
        # Try to get QR data for user with show_in_search=false
        status, response = await self.make_request(
            "GET",
            f"{API_BASE}/profile/{TEST_USER_1}/qr"
        )
        
        if status == 403:
            self.log_test(test_name, True, f"QR correctly blocked for hidden user: {response}")
        else:
            self.log_test(test_name, False, f"HTTP {status}", "403", str(response))
        
        # Reset privacy to allow search
        privacy_payload["show_in_search"] = True
        await self.make_request(
            "PUT",
            f"{API_BASE}/profile/{TEST_USER_1}/privacy", 
            json=privacy_payload
        )
        
        # Now QR should work
        status, response = await self.make_request(
            "GET",
            f"{API_BASE}/profile/{TEST_USER_1}/qr"
        )
        
        if status == 200 and isinstance(response, dict):
            qr_data = response.get("qr_data")
            if qr_data and qr_data.startswith("https://t.me/"):
                self.log_test(f"{test_name} - Allowed", True, f"QR data generated: {qr_data}")
            else:
                self.log_test(f"{test_name} - Allowed", False, "Invalid QR data format", "https://t.me/ URL", str(response))
        else:
            self.log_test(f"{test_name} - Allowed", False, f"HTTP {status}", "200", str(response))
    
    # ========== AVATAR ENDPOINT TESTS ==========
    
    async def test_avatar_authorization_put(self):
        """Test 5: Avatar PUT endpoint authorization"""
        test_name = "Avatar PUT - Authorization"
        
        valid_avatar_data = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        
        # Test 5a: Missing requester_telegram_id
        payload = {
            "avatar_data": valid_avatar_data
        }
        
        status, response = await self.make_request(
            "PUT",
            f"{API_BASE}/profile/{TEST_USER_1}/avatar",
            json=payload
        )
        
        if status == 400:
            self.log_test(f"{test_name} - Missing requester", True, f"Correctly rejected: {response}")
        else:
            self.log_test(f"{test_name} - Missing requester", False, f"HTTP {status}", "400", str(response))
        
        # Test 5b: Wrong requester_telegram_id
        payload = {
            "avatar_data": valid_avatar_data,
            "requester_telegram_id": TEST_USER_2  # Wrong user
        }
        
        status, response = await self.make_request(
            "PUT",
            f"{API_BASE}/profile/{TEST_USER_1}/avatar",
            json=payload
        )
        
        if status == 403:
            self.log_test(f"{test_name} - Wrong requester", True, f"Correctly rejected: {response}")
        else:
            self.log_test(f"{test_name} - Wrong requester", False, f"HTTP {status}", "403", str(response))
        
        # Test 5c: Correct requester_telegram_id
        payload = {
            "avatar_data": valid_avatar_data,
            "requester_telegram_id": TEST_USER_1  # Correct user
        }
        
        status, response = await self.make_request(
            "PUT",
            f"{API_BASE}/profile/{TEST_USER_1}/avatar",
            json=payload
        )
        
        if status == 200:
            self.log_test(f"{test_name} - Correct requester", True, f"Avatar saved: {response}")
        else:
            self.log_test(f"{test_name} - Correct requester", False, f"HTTP {status}", "200", str(response))
    
    async def test_avatar_authorization_delete(self):
        """Test 6: Avatar DELETE endpoint authorization"""
        test_name = "Avatar DELETE - Authorization"
        
        # Test 6a: Missing requester_telegram_id parameter
        status, response = await self.make_request(
            "DELETE",
            f"{API_BASE}/profile/{TEST_USER_1}/avatar"
        )
        
        if status == 400:
            self.log_test(f"{test_name} - Missing requester", True, f"Correctly rejected: {response}")
        else:
            self.log_test(f"{test_name} - Missing requester", False, f"HTTP {status}", "400", str(response))
        
        # Test 6b: Wrong requester_telegram_id parameter
        status, response = await self.make_request(
            "DELETE",
            f"{API_BASE}/profile/{TEST_USER_1}/avatar?requester_telegram_id={TEST_USER_2}"
        )
        
        if status == 403:
            self.log_test(f"{test_name} - Wrong requester", True, f"Correctly rejected: {response}")
        else:
            self.log_test(f"{test_name} - Wrong requester", False, f"HTTP {status}", "403", str(response))
        
        # Test 6c: Correct requester_telegram_id parameter
        status, response = await self.make_request(
            "DELETE",
            f"{API_BASE}/profile/{TEST_USER_1}/avatar?requester_telegram_id={TEST_USER_1}"
        )
        
        if status == 200:
            self.log_test(f"{test_name} - Correct requester", True, f"Avatar deleted: {response}")
        else:
            self.log_test(f"{test_name} - Correct requester", False, f"HTTP {status}", "200", str(response))
    
    async def test_avatar_get(self):
        """Test 7: Avatar GET endpoint"""
        test_name = "Avatar GET"
        
        status, response = await self.make_request(
            "GET",
            f"{API_BASE}/profile/{TEST_USER_1}/avatar"
        )
        
        if status == 200 and isinstance(response, dict):
            avatar_data = response.get("avatar_data")
            avatar_mode = response.get("avatar_mode")
            
            if avatar_data is not None and avatar_mode is not None:
                self.log_test(test_name, True, f"Avatar data retrieved: mode={avatar_mode}")
            else:
                self.log_test(test_name, False, "Missing avatar fields", "avatar_data and avatar_mode", str(response))
        else:
            self.log_test(test_name, False, f"HTTP {status}", "200", str(response))
    
    # ========== GRAFFITI ENDPOINT TESTS ==========
    
    async def test_graffiti_put_authorization(self):
        """Test 8: Graffiti PUT endpoint authorization"""
        test_name = "Graffiti PUT - Authorization"
        
        valid_graffiti_data = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        
        # Test 8a: Missing requester_telegram_id
        payload = {
            "graffiti_data": valid_graffiti_data
        }
        
        status, response = await self.make_request(
            "PUT",
            f"{API_BASE}/profile/{TEST_USER_1}/graffiti",
            json=payload
        )
        
        if status == 400:
            self.log_test(f"{test_name} - Missing requester", True, f"Correctly rejected: {response}")
        else:
            self.log_test(f"{test_name} - Missing requester", False, f"HTTP {status}", "400", str(response))
        
        # Test 8b: Wrong requester_telegram_id
        payload = {
            "graffiti_data": valid_graffiti_data,
            "requester_telegram_id": TEST_USER_2  # Wrong user
        }
        
        status, response = await self.make_request(
            "PUT",
            f"{API_BASE}/profile/{TEST_USER_1}/graffiti",
            json=payload
        )
        
        if status == 403:
            self.log_test(f"{test_name} - Wrong requester", True, f"Correctly rejected: {response}")
        else:
            self.log_test(f"{test_name} - Wrong requester", False, f"HTTP {status}", "403", str(response))
        
        # Test 8c: Correct requester_telegram_id
        payload = {
            "graffiti_data": valid_graffiti_data,
            "requester_telegram_id": TEST_USER_1  # Correct user
        }
        
        status, response = await self.make_request(
            "PUT",
            f"{API_BASE}/profile/{TEST_USER_1}/graffiti",
            json=payload
        )
        
        if status == 200:
            self.log_test(f"{test_name} - Correct requester", True, f"Graffiti saved: {response}")
        else:
            self.log_test(f"{test_name} - Correct requester", False, f"HTTP {status}", "200", str(response))
    
    async def test_graffiti_get(self):
        """Test 9: Graffiti GET endpoint"""
        test_name = "Graffiti GET"
        
        status, response = await self.make_request(
            "GET",
            f"{API_BASE}/profile/{TEST_USER_1}/graffiti"
        )
        
        if status == 200 and isinstance(response, dict):
            graffiti_data = response.get("graffiti_data")
            graffiti_updated_at = response.get("graffiti_updated_at")
            
            if graffiti_data is not None and graffiti_updated_at is not None:
                self.log_test(test_name, True, f"Graffiti data retrieved: {len(graffiti_data)} chars")
            else:
                self.log_test(test_name, False, "Missing graffiti fields", "graffiti_data and graffiti_updated_at", str(response))
        else:
            self.log_test(test_name, False, f"HTTP {status}", "200", str(response))
    
    async def test_graffiti_clear_authorization(self):
        """Test 10: Graffiti clear endpoint authorization"""
        test_name = "Graffiti CLEAR - Authorization"
        
        # Test 10a: Missing requester_telegram_id
        payload = {}
        
        status, response = await self.make_request(
            "POST",
            f"{API_BASE}/profile/{TEST_USER_1}/graffiti/clear",
            json=payload
        )
        
        if status == 400:
            self.log_test(f"{test_name} - Missing requester", True, f"Correctly rejected: {response}")
        else:
            self.log_test(f"{test_name} - Missing requester", False, f"HTTP {status}", "400", str(response))
        
        # Test 10b: Wrong requester_telegram_id
        payload = {
            "requester_telegram_id": TEST_USER_2  # Wrong user
        }
        
        status, response = await self.make_request(
            "POST",
            f"{API_BASE}/profile/{TEST_USER_1}/graffiti/clear",
            json=payload
        )
        
        if status == 403:
            self.log_test(f"{test_name} - Wrong requester", True, f"Correctly rejected: {response}")
        else:
            self.log_test(f"{test_name} - Wrong requester", False, f"HTTP {status}", "403", str(response))
        
        # Test 10c: Correct requester_telegram_id
        payload = {
            "requester_telegram_id": TEST_USER_1  # Correct user
        }
        
        status, response = await self.make_request(
            "POST",
            f"{API_BASE}/profile/{TEST_USER_1}/graffiti/clear",
            json=payload
        )
        
        if status == 200:
            self.log_test(f"{test_name} - Correct requester", True, f"Graffiti cleared: {response}")
        else:
            self.log_test(f"{test_name} - Correct requester", False, f"HTTP {status}", "200", str(response))
    
    async def run_all_tests(self):
        """Run all profile API tests in sequence"""
        print(f"🧪 Starting Profile API Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test Users: {TEST_USER_1}, {TEST_USER_2}, {TEST_USER_3}")
        print("=" * 60)
        
        # Setup test users first
        await self.setup_test_users()
        print("=" * 60)
        
        # Test sequence as specified in the review request
        test_methods = [
            self.test_profile_bidirectional_block_check,
            self.test_profile_anonymous_privacy,
            self.test_profile_friendship_status,
            self.test_qr_privacy_check,
            self.test_avatar_authorization_put,
            self.test_avatar_authorization_delete,
            self.test_avatar_get,
            self.test_graffiti_put_authorization,
            self.test_graffiti_get,
            self.test_graffiti_clear_authorization,
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
    async with ProfileAPITester() as tester:
        passed, total = await tester.run_all_tests()
        
        # Exit with error code if any tests failed
        if passed < total:
            sys.exit(1)
        else:
            print("\n🎉 All tests passed!")
            sys.exit(0)

if __name__ == "__main__":
    asyncio.run(main())