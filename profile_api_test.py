#!/usr/bin/env python3
"""
RUDN Schedule App - Profile API Testing
Tests all profile-related backend API endpoints following the review request test plan.
"""

import asyncio
import aiohttp
import json
import sys
from datetime import datetime
import base64

# Backend URL from environment
BACKEND_URL = "http://localhost:8001"
API_BASE = f"{BACKEND_URL}/api"

# Test user IDs as specified in review request
TEST_USER_A = 999001
TEST_USER_B = 999002

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
    
    # ========== STEP 1: CREATE TEST USERS ==========
    
    async def step1_create_test_users(self):
        """Step 1: Create test users as specified in review request"""
        print("🔧 STEP 1: Creating test users...")
        
        users = [
            {
                "telegram_id": TEST_USER_A,
                "first_name": "TestUserA",
                "username": "testuserA",
                "group_id": "ИБАС-01-23",
                "group_name": "ИБАС-01-23",
                "facultet_id": "1",
                "facultet_name": "Институт прикладной математики и телекоммуникаций",
                "level_id": "1",
                "kurs": "1",
                "form_code": "1"
            },
            {
                "telegram_id": TEST_USER_B,
                "first_name": "TestUserB", 
                "username": "testuserB",
                "group_id": "ИБАС-02-23",
                "group_name": "ИБАС-02-23",
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
                self.log_test(f"Create User {user['telegram_id']}", True, f"User created successfully")
            else:
                self.log_test(f"Create User {user['telegram_id']}", False, f"HTTP {status} - {response}")
    
    # ========== STEP 2: TEST PRIVACY AUTHORIZATION ==========
    
    async def step2_test_privacy_authorization(self):
        """Step 2: Test Privacy Authorization (CRITICAL)"""
        print("🔒 STEP 2: Testing Privacy Authorization...")
        
        # Test 2a: GET /api/profile/999001/privacy WITHOUT requester_telegram_id → MUST return 400
        status, response = await self.make_request(
            "GET",
            f"{API_BASE}/profile/{TEST_USER_A}/privacy"
        )
        
        if status == 400:
            self.log_test("Privacy GET - Missing requester_telegram_id", True, f"Correctly returned 400: {response}")
        else:
            self.log_test("Privacy GET - Missing requester_telegram_id", False, f"HTTP {status}", "400", str(response))
        
        # Test 2b: GET /api/profile/999001/privacy?requester_telegram_id=999002 → MUST return 403 (not owner)
        status, response = await self.make_request(
            "GET",
            f"{API_BASE}/profile/{TEST_USER_A}/privacy?requester_telegram_id={TEST_USER_B}"
        )
        
        if status == 403:
            self.log_test("Privacy GET - Wrong requester", True, f"Correctly returned 403: {response}")
        else:
            self.log_test("Privacy GET - Wrong requester", False, f"HTTP {status}", "403", str(response))
        
        # Test 2c: GET /api/profile/999001/privacy?requester_telegram_id=999001 → MUST return 200 with settings
        status, response = await self.make_request(
            "GET",
            f"{API_BASE}/profile/{TEST_USER_A}/privacy?requester_telegram_id={TEST_USER_A}"
        )
        
        if status == 200 and isinstance(response, dict):
            self.log_test("Privacy GET - Correct requester", True, f"Privacy settings retrieved: {response}")
        else:
            self.log_test("Privacy GET - Correct requester", False, f"HTTP {status}", "200", str(response))
        
        # Test 2d: PUT /api/profile/999001/privacy?requester_telegram_id=999001 with body → MUST return 200
        privacy_update = {"show_online_status": False}
        status, response = await self.make_request(
            "PUT",
            f"{API_BASE}/profile/{TEST_USER_A}/privacy?requester_telegram_id={TEST_USER_A}",
            json=privacy_update
        )
        
        if status == 200:
            self.log_test("Privacy PUT - Correct requester", True, f"Privacy updated: {response}")
        else:
            self.log_test("Privacy PUT - Correct requester", False, f"HTTP {status}", "200", str(response))
        
        # Test 2e: PUT /api/profile/999001/privacy WITHOUT requester_telegram_id → MUST return 400
        privacy_update = {"show_online_status": True}
        status, response = await self.make_request(
            "PUT",
            f"{API_BASE}/profile/{TEST_USER_A}/privacy",
            json=privacy_update
        )
        
        if status == 400:
            self.log_test("Privacy PUT - Missing requester_telegram_id", True, f"Correctly returned 400: {response}")
        else:
            self.log_test("Privacy PUT - Missing requester_telegram_id", False, f"HTTP {status}", "400", str(response))
    
    # ========== STEP 3: TEST PROFILE ENDPOINT ==========
    
    async def step3_test_profile_endpoint(self):
        """Step 3: Test Profile Endpoint"""
        print("👤 STEP 3: Testing Profile Endpoint...")
        
        # Test 3a: GET /api/profile/999001?viewer_telegram_id=999001 → MUST return 200 with full profile (own profile)
        status, response = await self.make_request(
            "GET",
            f"{API_BASE}/profile/{TEST_USER_A}?viewer_telegram_id={TEST_USER_A}"
        )
        
        if status == 200 and isinstance(response, dict):
            # Check for full profile data
            has_group_id = "group_id" in response and response["group_id"] is not None
            has_created_at = "created_at" in response and response["created_at"] is not None
            if has_group_id and has_created_at:
                self.log_test("Profile GET - Own profile", True, f"Full profile data returned")
            else:
                self.log_test("Profile GET - Own profile", False, "Missing full profile data", "group_id and created_at", str(response))
        else:
            self.log_test("Profile GET - Own profile", False, f"HTTP {status}", "200", str(response))
        
        # Test 3b: GET /api/profile/999001?viewer_telegram_id=999002 → MUST return 200 with privacy-filtered profile
        status, response = await self.make_request(
            "GET",
            f"{API_BASE}/profile/{TEST_USER_A}?viewer_telegram_id={TEST_USER_B}"
        )
        
        if status == 200 and isinstance(response, dict):
            self.log_test("Profile GET - Other user viewing", True, f"Privacy-filtered profile returned")
        else:
            self.log_test("Profile GET - Other user viewing", False, f"HTTP {status}", "200", str(response))
        
        # Test 3c: GET /api/profile/999001 → MUST return 200 with anonymous (limited) data
        status, response = await self.make_request(
            "GET",
            f"{API_BASE}/profile/{TEST_USER_A}"
        )
        
        if status == 200 and isinstance(response, dict):
            # Check that sensitive data is limited for anonymous requests
            group_id = response.get("group_id")
            created_at = response.get("created_at")
            if group_id is None and created_at is None:
                self.log_test("Profile GET - Anonymous", True, f"Limited anonymous data returned")
            else:
                self.log_test("Profile GET - Anonymous", False, "Too much data for anonymous", "limited data", str(response))
        else:
            self.log_test("Profile GET - Anonymous", False, f"HTTP {status}", "200", str(response))
    
    # ========== STEP 4: TEST QR ENDPOINT ==========
    
    async def step4_test_qr_endpoint(self):
        """Step 4: Test QR Endpoint"""
        print("📱 STEP 4: Testing QR Endpoint...")
        
        # Test 4: GET /api/profile/999001/qr → MUST return 200 with qr_data
        status, response = await self.make_request(
            "GET",
            f"{API_BASE}/profile/{TEST_USER_A}/qr"
        )
        
        if status == 200 and isinstance(response, dict):
            qr_data = response.get("qr_data")
            if qr_data and qr_data.startswith("https://t.me/"):
                self.log_test("QR GET", True, f"QR data generated: {qr_data}")
            else:
                self.log_test("QR GET", False, "Invalid QR data format", "https://t.me/ URL", str(response))
        else:
            self.log_test("QR GET", False, f"HTTP {status}", "200", str(response))
    
    # ========== STEP 5: TEST AVATAR ENDPOINTS ==========
    
    async def step5_test_avatar_endpoints(self):
        """Step 5: Test Avatar Endpoints"""
        print("🖼️ STEP 5: Testing Avatar Endpoints...")
        
        valid_avatar_data = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        
        # Test 5a: PUT /api/profile/999001/avatar with correct requester → MUST return 200
        payload = {
            "avatar_data": valid_avatar_data,
            "requester_telegram_id": TEST_USER_A
        }
        
        status, response = await self.make_request(
            "PUT",
            f"{API_BASE}/profile/{TEST_USER_A}/avatar",
            json=payload
        )
        
        if status == 200:
            self.log_test("Avatar PUT - Correct requester", True, f"Avatar saved: {response}")
        else:
            self.log_test("Avatar PUT - Correct requester", False, f"HTTP {status}", "200", str(response))
        
        # Test 5b: GET /api/profile/999001/avatar → MUST return avatar_data and avatar_mode="custom"
        status, response = await self.make_request(
            "GET",
            f"{API_BASE}/profile/{TEST_USER_A}/avatar"
        )
        
        if status == 200 and isinstance(response, dict):
            avatar_data = response.get("avatar_data")
            avatar_mode = response.get("avatar_mode")
            if avatar_data and avatar_mode == "custom":
                self.log_test("Avatar GET - After upload", True, f"Custom avatar retrieved: mode={avatar_mode}")
            else:
                self.log_test("Avatar GET - After upload", False, f"Expected custom avatar", "avatar_mode=custom", str(response))
        else:
            self.log_test("Avatar GET - After upload", False, f"HTTP {status}", "200", str(response))
        
        # Test 5c: PUT /api/profile/999001/avatar WITHOUT requester_telegram_id → MUST return 400
        payload = {
            "avatar_data": valid_avatar_data
        }
        
        status, response = await self.make_request(
            "PUT",
            f"{API_BASE}/profile/{TEST_USER_A}/avatar",
            json=payload
        )
        
        if status == 400:
            self.log_test("Avatar PUT - Missing requester", True, f"Correctly returned 400: {response}")
        else:
            self.log_test("Avatar PUT - Missing requester", False, f"HTTP {status}", "400", str(response))
        
        # Test 5d: PUT /api/profile/999001/avatar with wrong requester → MUST return 403
        payload = {
            "avatar_data": valid_avatar_data,
            "requester_telegram_id": TEST_USER_B  # Wrong user
        }
        
        status, response = await self.make_request(
            "PUT",
            f"{API_BASE}/profile/{TEST_USER_A}/avatar",
            json=payload
        )
        
        if status == 403:
            self.log_test("Avatar PUT - Wrong requester", True, f"Correctly returned 403: {response}")
        else:
            self.log_test("Avatar PUT - Wrong requester", False, f"HTTP {status}", "403", str(response))
        
        # Test 5e: DELETE /api/profile/999001/avatar?requester_telegram_id=999001 → MUST return 200
        status, response = await self.make_request(
            "DELETE",
            f"{API_BASE}/profile/{TEST_USER_A}/avatar?requester_telegram_id={TEST_USER_A}"
        )
        
        if status == 200:
            self.log_test("Avatar DELETE - Correct requester", True, f"Avatar deleted: {response}")
        else:
            self.log_test("Avatar DELETE - Correct requester", False, f"HTTP {status}", "200", str(response))
    
    # ========== STEP 6: TEST GRAFFITI ENDPOINTS ==========
    
    async def step6_test_graffiti_endpoints(self):
        """Step 6: Test Graffiti Endpoints"""
        print("🎨 STEP 6: Testing Graffiti Endpoints...")
        
        valid_graffiti_data = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        
        # Test 6a: PUT /api/profile/999001/graffiti with correct requester → 200
        payload = {
            "graffiti_data": valid_graffiti_data,
            "requester_telegram_id": TEST_USER_A
        }
        
        status, response = await self.make_request(
            "PUT",
            f"{API_BASE}/profile/{TEST_USER_A}/graffiti",
            json=payload
        )
        
        if status == 200:
            self.log_test("Graffiti PUT - Correct requester", True, f"Graffiti saved: {response}")
        else:
            self.log_test("Graffiti PUT - Correct requester", False, f"HTTP {status}", "200", str(response))
        
        # Test 6b: GET /api/profile/999001/graffiti → MUST return graffiti_data
        status, response = await self.make_request(
            "GET",
            f"{API_BASE}/profile/{TEST_USER_A}/graffiti"
        )
        
        if status == 200 and isinstance(response, dict):
            graffiti_data = response.get("graffiti_data")
            if graffiti_data:
                self.log_test("Graffiti GET", True, f"Graffiti data retrieved: {len(graffiti_data)} chars")
            else:
                self.log_test("Graffiti GET", False, "Missing graffiti_data", "graffiti_data field", str(response))
        else:
            self.log_test("Graffiti GET", False, f"HTTP {status}", "200", str(response))
        
        # Test 6c: POST /api/profile/999001/graffiti/clear with correct requester → 200
        payload = {
            "requester_telegram_id": TEST_USER_A
        }
        
        status, response = await self.make_request(
            "POST",
            f"{API_BASE}/profile/{TEST_USER_A}/graffiti/clear",
            json=payload
        )
        
        if status == 200:
            self.log_test("Graffiti CLEAR - Correct requester", True, f"Graffiti cleared: {response}")
        else:
            self.log_test("Graffiti CLEAR - Correct requester", False, f"HTTP {status}", "200", str(response))
        
        # Test 6d: PUT /api/profile/999001/graffiti WITHOUT requester_telegram_id → 400
        payload = {
            "graffiti_data": valid_graffiti_data
        }
        
        status, response = await self.make_request(
            "PUT",
            f"{API_BASE}/profile/{TEST_USER_A}/graffiti",
            json=payload
        )
        
        if status == 400:
            self.log_test("Graffiti PUT - Missing requester", True, f"Correctly returned 400: {response}")
        else:
            self.log_test("Graffiti PUT - Missing requester", False, f"HTTP {status}", "400", str(response))
        
        # Test 6e: PUT /api/profile/999001/graffiti with wrong requester → 403
        payload = {
            "graffiti_data": valid_graffiti_data,
            "requester_telegram_id": TEST_USER_B  # Wrong user
        }
        
        status, response = await self.make_request(
            "PUT",
            f"{API_BASE}/profile/{TEST_USER_A}/graffiti",
            json=payload
        )
        
        if status == 403:
            self.log_test("Graffiti PUT - Wrong requester", True, f"Correctly returned 403: {response}")
        else:
            self.log_test("Graffiti PUT - Wrong requester", False, f"HTTP {status}", "403", str(response))
    
    # ========== STEP 7: TEST BLOCK CHECK IN PROFILE ==========
    
    async def step7_test_block_check_in_profile(self):
        """Step 7: Test Block Check in Profile"""
        print("🚫 STEP 7: Testing Block Check in Profile...")
        
        # First, block user 999002 from 999001's perspective
        block_payload = {
            "telegram_id": TEST_USER_A
        }
        
        status, response = await self.make_request(
            "POST",
            f"{API_BASE}/friends/block/{TEST_USER_B}",
            json=block_payload
        )
        
        if status != 200:
            self.log_test("Block Setup", False, f"Failed to create block: {status} - {response}")
            return
        else:
            self.log_test("Block Setup", True, f"Block created successfully")
        
        # Test 7a: GET /api/profile/999001?viewer_telegram_id=999002 → MUST return 403
        status, response = await self.make_request(
            "GET",
            f"{API_BASE}/profile/{TEST_USER_A}?viewer_telegram_id={TEST_USER_B}"
        )
        
        if status == 403:
            self.log_test("Profile GET - Blocked viewer", True, f"Correctly blocked: {response}")
        else:
            self.log_test("Profile GET - Blocked viewer", False, f"HTTP {status}", "403", str(response))
        
        # Test 7b: GET /api/profile/999002?viewer_telegram_id=999001 → MUST return 403 (bidirectional)
        status, response = await self.make_request(
            "GET",
            f"{API_BASE}/profile/{TEST_USER_B}?viewer_telegram_id={TEST_USER_A}"
        )
        
        if status == 403:
            self.log_test("Profile GET - Bidirectional block", True, f"Correctly blocked bidirectionally: {response}")
        else:
            self.log_test("Profile GET - Bidirectional block", False, f"HTTP {status}", "403", str(response))
        
        # Clean up: unblock the user
        status, response = await self.make_request(
            "DELETE",
            f"{API_BASE}/friends/block/{TEST_USER_B}",
            json=block_payload
        )
        
        if status == 200:
            self.log_test("Block Cleanup", True, f"Block removed successfully")
        else:
            self.log_test("Block Cleanup", False, f"Failed to remove block: {status} - {response}")
    
    async def run_all_tests(self):
        """Run all profile API tests following the review request test plan"""
        print(f"🧪 RUDN Schedule App - Profile API Testing")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test Users: {TEST_USER_A}, {TEST_USER_B}")
        print("=" * 80)
        
        # Execute test steps in order as specified in review request
        test_steps = [
            self.step1_create_test_users,
            self.step2_test_privacy_authorization,
            self.step3_test_profile_endpoint,
            self.step4_test_qr_endpoint,
            self.step5_test_avatar_endpoints,
            self.step6_test_graffiti_endpoints,
            self.step7_test_block_check_in_profile,
        ]
        
        for step_method in test_steps:
            try:
                await step_method()
                print("-" * 40)
            except Exception as e:
                self.log_test(step_method.__name__, False, f"Step exception: {e}")
                print("-" * 40)
        
        # Summary
        print("=" * 80)
        print("📊 FINAL TEST SUMMARY")
        print("=" * 80)
        
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
        
        print("\n" + "=" * 80)
        return passed, total

async def main():
    """Main test runner"""
    async with ProfileAPITester() as tester:
        passed, total = await tester.run_all_tests()
        
        # Exit with error code if any tests failed
        if passed < total:
            print(f"\n❌ {total - passed} tests failed!")
            sys.exit(1)
        else:
            print("\n🎉 All tests passed!")
            sys.exit(0)

if __name__ == "__main__":
    asyncio.run(main())