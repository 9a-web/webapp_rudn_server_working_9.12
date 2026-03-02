#!/usr/bin/env python3
"""
Backend API Testing Script for Shared Schedule Feature
Tests the specific endpoints and bug fixes mentioned in the review request.
"""

import asyncio
import aiohttp
import json
import uuid
from datetime import datetime

# Base URL - from environment configuration
BASE_URL = "https://live-cards.preview.emergentagent.com/api"

class SharedScheduleTester:
    def __init__(self):
        self.session = None
        self.test_results = []
        self.created_schedules = []  # Track for cleanup
        self.test_schedule_id = None  # Store schedule ID for tests
        self.test_token = None  # Store share token for tests
    
    async def setup(self):
        """Setup HTTP session"""
        self.session = aiohttp.ClientSession()
        print("🔗 HTTP session created")
    
    async def teardown(self):
        """Cleanup resources and test data"""
        print("\n🧹 Cleaning up test data...")
        
        # Clean up created schedules
        cleanup_owners = [999001, 777001]  # Known test owner IDs
        for schedule_id in self.created_schedules:
            for owner_id in cleanup_owners:
                try:
                    async with self.session.delete(f"{BASE_URL}/shared-schedule/{schedule_id}?owner_id={owner_id}") as resp:
                        if resp.status in [200, 404]:
                            print(f"✅ Cleaned up schedule {schedule_id} with owner {owner_id}")
                            break
                except Exception as e:
                    continue
            else:
                print(f"⚠️ Could not cleanup schedule {schedule_id}")
        
        if self.session:
            await self.session.close()
            print("✅ HTTP session closed")
    
    def log_test(self, test_name, passed, details=""):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"    {details}")
        
        self.test_results.append({
            "test": test_name,
            "passed": passed,
            "details": details
        })
    
    async def test_1_create_schedule(self):
        """
        Test 1: POST /api/shared-schedule with body {"owner_id": 999001, "participant_ids": []}
        Expected: 200 with id, owner_id, participants (owner should be first participant with color and group_name fields)
        """
        print("\n🧪 Test 1: Create Shared Schedule")
        
        try:
            payload = {
                "owner_id": 999001,
                "participant_ids": []
            }
            
            async with self.session.post(f"{BASE_URL}/shared-schedule", json=payload) as resp:
                if resp.status != 200:
                    self.log_test("Create Schedule", False, f"POST failed: HTTP {resp.status}, response: {await resp.text()}")
                    return
                
                data = await resp.json()
                schedule_id = data.get("id")
                owner_id = data.get("owner_id")
                participants = data.get("participants", [])
                
                # Validation checks
                if not schedule_id:
                    self.log_test("Create Schedule", False, "No schedule ID returned")
                    return
                
                # Check UUID format
                try:
                    uuid.UUID(schedule_id)
                    uuid_valid = True
                except ValueError:
                    uuid_valid = False
                
                if not uuid_valid:
                    self.log_test("Create Schedule", False, f"Invalid UUID format: {schedule_id}")
                    return
                
                if owner_id != 999001:
                    self.log_test("Create Schedule", False, f"Wrong owner_id: {owner_id}")
                    return
                
                if len(participants) != 1:  # Only owner should be in participants
                    self.log_test("Create Schedule", False, f"Wrong participant count: {len(participants)}, expected 1")
                    return
                
                # Check if owner is first participant and has required fields
                owner_participant = participants[0]
                if owner_participant.get("telegram_id") != 999001:
                    self.log_test("Create Schedule", False, f"Owner not first participant: {owner_participant}")
                    return
                
                # Check required fields
                required_fields = ["telegram_id", "first_name", "color"]
                for field in required_fields:
                    if field not in owner_participant:
                        self.log_test("Create Schedule", False, f"Missing field '{field}' in participant: {owner_participant}")
                        return
                
                # group_name should exist (can be empty string)
                if "group_name" not in owner_participant:
                    self.log_test("Create Schedule", False, f"Missing group_name field in participant: {owner_participant}")
                    return
                
                # Check color is from PARTICIPANT_COLORS list
                expected_colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16']
                if owner_participant["color"] not in expected_colors:
                    self.log_test("Create Schedule", False, f"Invalid color: {owner_participant['color']}")
                    return
                
                self.created_schedules.append(schedule_id)
                self.test_schedule_id = schedule_id  # Store for other tests
                
                self.log_test("Create Schedule", True, f"Schedule created with UUID: {schedule_id}, owner as first participant with all fields")
        
        except Exception as e:
            self.log_test("Create Schedule", False, f"Exception: {e}")
    
    async def test_2_get_schedule_with_week(self):
        """
        Test 2: GET /api/shared-schedule/999001?week=1
        Expected: 200 with exists=true, participants, schedules dict
        """
        print("\n🧪 Test 2: Get Shared Schedule with Week Parameter")
        
        try:
            async with self.session.get(f"{BASE_URL}/shared-schedule/999001?week=1") as resp:
                if resp.status != 200:
                    self.log_test("Get Schedule Week=1", False, f"GET failed: HTTP {resp.status}, response: {await resp.text()}")
                    return
                
                data = await resp.json()
                exists = data.get("exists")
                participants = data.get("participants", [])
                schedules = data.get("schedules", {})
                week = data.get("week")
                
                if not exists:
                    self.log_test("Get Schedule Week=1", False, f"exists=false, expected true")
                    return
                
                if week != 1:
                    self.log_test("Get Schedule Week=1", False, f"week={week}, expected 1")
                    return
                
                # Participants should contain the owner
                if not participants or len(participants) == 0:
                    self.log_test("Get Schedule Week=1", False, f"No participants found")
                    return
                
                # Schedules should be a dict
                if not isinstance(schedules, dict):
                    self.log_test("Get Schedule Week=1", False, f"schedules is not dict: {type(schedules)}")
                    return
                
                self.log_test("Get Schedule Week=1", True, f"exists=true, week=1, participants: {len(participants)}, schedules keys: {len(schedules)}")
        
        except Exception as e:
            self.log_test("Get Schedule Week=1", False, f"Exception: {e}")
    
    async def test_3_add_non_friend_participant(self):
        """
        Test 3: POST /api/shared-schedule/{id}/add-participant with {"participant_id": 999002}
        Note: This may return 403 "Можно добавить только друзей" since 999002 is not a friend. 
        VERIFY this 403 response — this is the CORRECT behavior (friend validation bug fix).
        """
        print("\n🧪 Test 3: Add Non-Friend Participant (Should Return 403)")
        
        try:
            if not self.test_schedule_id:
                self.log_test("Add Non-Friend Participant", False, "No schedule ID available from previous test")
                return
            
            payload = {"participant_id": 999002}
            
            async with self.session.post(f"{BASE_URL}/shared-schedule/{self.test_schedule_id}/add-participant", json=payload) as resp:
                response_text = await resp.text()
                
                if resp.status == 403:
                    # Check for expected Russian message
                    if "Можно добавить только друзей" in response_text:
                        self.log_test("Add Non-Friend Participant", True, f"Correctly returned 403 with friend validation: {response_text}")
                    else:
                        self.log_test("Add Non-Friend Participant", False, f"403 but wrong message: {response_text}")
                else:
                    self.log_test("Add Non-Friend Participant", False, f"Expected HTTP 403 for non-friend, got {resp.status}: {response_text}")
        
        except Exception as e:
            self.log_test("Add Non-Friend Participant", False, f"Exception: {e}")
    
    async def test_4_delete_without_owner_id(self):
        """
        Test 4: DELETE /api/shared-schedule/{id} (without owner_id parameter)
        Expected: 403 with message "Необходимо указать owner_id" — this is the bug fix we implemented
        """
        print("\n🧪 Test 4: Delete Schedule Without owner_id (Security Fix - Should Return 403)")
        
        try:
            if not self.test_schedule_id:
                self.log_test("Delete Without owner_id", False, "No schedule ID available from previous test")
                return
            
            async with self.session.delete(f"{BASE_URL}/shared-schedule/{self.test_schedule_id}") as resp:
                response_text = await resp.text()
                
                if resp.status == 403:
                    # Check for expected Russian message
                    if "Необходимо указать owner_id" in response_text:
                        self.log_test("Delete Without owner_id", True, f"CRITICAL: Security fix working - 403 with correct message: {response_text}")
                    else:
                        self.log_test("Delete Without owner_id", False, f"403 but wrong message: {response_text}")
                else:
                    self.log_test("Delete Without owner_id", False, f"CRITICAL: Expected HTTP 403 for missing owner_id, got {resp.status}: {response_text}")
        
        except Exception as e:
            self.log_test("Delete Without owner_id", False, f"Exception: {e}")
    
    async def test_5_delete_with_correct_owner_id(self):
        """
        Test 5: DELETE /api/shared-schedule/{id}?owner_id=999001
        Expected: 200 success
        """
        print("\n🧪 Test 5: Delete Schedule With Correct owner_id")
        
        try:
            if not self.test_schedule_id:
                self.log_test("Delete With Correct owner_id", False, "No schedule ID available from previous test")
                return
            
            async with self.session.delete(f"{BASE_URL}/shared-schedule/{self.test_schedule_id}?owner_id=999001") as resp:
                response_text = await resp.text()
                
                if resp.status == 200:
                    # Verify schedule was deleted by checking if it still exists
                    async with self.session.get(f"{BASE_URL}/shared-schedule/999001") as get_resp:
                        if get_resp.status == 200:
                            get_data = await get_resp.json()
                            exists = get_data.get("exists", False)
                            
                            if not exists:
                                self.log_test("Delete With Correct owner_id", True, f"Schedule successfully deleted with correct owner_id")
                                # Remove from cleanup list since it's already deleted
                                if self.test_schedule_id in self.created_schedules:
                                    self.created_schedules.remove(self.test_schedule_id)
                            else:
                                self.log_test("Delete With Correct owner_id", False, f"Schedule still exists after deletion")
                        else:
                            self.log_test("Delete With Correct owner_id", False, f"Could not verify deletion: GET failed {get_resp.status}")
                else:
                    self.log_test("Delete With Correct owner_id", False, f"Expected HTTP 200, got {resp.status}: {response_text}")
        
        except Exception as e:
            self.log_test("Delete With Correct owner_id", False, f"Exception: {e}")
    
    async def test_6_create_another_schedule_for_token(self):
        """
        Test 6: Create another schedule for token testing
        POST /api/shared-schedule with body {"owner_id": 999001, "participant_ids": []}
        """
        print("\n🧪 Test 6: Create Another Schedule for Token Testing")
        
        try:
            payload = {
                "owner_id": 999001,
                "participant_ids": []
            }
            
            async with self.session.post(f"{BASE_URL}/shared-schedule", json=payload) as resp:
                if resp.status != 200:
                    self.log_test("Create Schedule for Token", False, f"POST failed: HTTP {resp.status}, response: {await resp.text()}")
                    return
                
                data = await resp.json()
                schedule_id = data.get("id")
                
                if not schedule_id:
                    self.log_test("Create Schedule for Token", False, "No schedule ID returned")
                    return
                
                self.created_schedules.append(schedule_id)
                self.test_schedule_id = schedule_id  # Update for token tests
                
                self.log_test("Create Schedule for Token", True, f"Schedule created for token testing: {schedule_id}")
        
        except Exception as e:
            self.log_test("Create Schedule for Token", False, f"Exception: {e}")
    
    async def test_7_create_share_token(self):
        """
        Test 7: POST /api/shared-schedule/{id}/share-token
        Expected: 200 with token and invite_link
        """
        print("\n🧪 Test 7: Create Share Token")
        
        try:
            if not self.test_schedule_id:
                self.log_test("Create Share Token", False, "No schedule ID available from previous test")
                return
            
            async with self.session.post(f"{BASE_URL}/shared-schedule/{self.test_schedule_id}/share-token") as resp:
                if resp.status != 200:
                    self.log_test("Create Share Token", False, f"POST failed: HTTP {resp.status}, response: {await resp.text()}")
                    return
                
                data = await resp.json()
                token = data.get("token")
                invite_link = data.get("invite_link")
                participant_ids = data.get("participant_ids")
                
                # Validation checks
                if not token:
                    self.log_test("Create Share Token", False, "No token returned")
                    return
                
                if not invite_link or "t.me" not in invite_link:
                    self.log_test("Create Share Token", False, f"Invalid invite_link: {invite_link}")
                    return
                
                if not isinstance(participant_ids, list):
                    self.log_test("Create Share Token", False, f"participant_ids should be list: {type(participant_ids)}")
                    return
                
                self.test_token = token  # Store for next test
                
                self.log_test("Create Share Token", True, f"Share token created: {token}, invite_link: {invite_link}")
        
        except Exception as e:
            self.log_test("Create Share Token", False, f"Exception: {e}")
    
    async def test_8_get_token_data(self):
        """
        Test 8: GET /api/shared-schedule/token/{token}
        Expected: 200 with participant_ids list
        """
        print("\n🧪 Test 8: Get Token Data")
        
        try:
            if not self.test_token:
                self.log_test("Get Token Data", False, "No token available from previous test")
                return
            
            async with self.session.get(f"{BASE_URL}/shared-schedule/token/{self.test_token}") as resp:
                if resp.status != 200:
                    self.log_test("Get Token Data", False, f"GET failed: HTTP {resp.status}, response: {await resp.text()}")
                    return
                
                data = await resp.json()
                token = data.get("token")
                participant_ids = data.get("participant_ids")
                
                # Validation checks
                if token != self.test_token:
                    self.log_test("Get Token Data", False, f"Token mismatch: {token} vs {self.test_token}")
                    return
                
                if not isinstance(participant_ids, list):
                    self.log_test("Get Token Data", False, f"participant_ids should be list: {type(participant_ids)}")
                    return
                
                if 999001 not in participant_ids:
                    self.log_test("Get Token Data", False, f"Owner 999001 not in participant_ids: {participant_ids}")
                    return
                
                self.log_test("Get Token Data", True, f"Token data retrieved: participant_ids={participant_ids}")
        
        except Exception as e:
            self.log_test("Get Token Data", False, f"Exception: {e}")
    
    async def test_9_cleanup_final_schedule(self):
        """
        Test 9: Final cleanup - DELETE /api/shared-schedule/{id}?owner_id=999001
        """
        print("\n🧪 Test 9: Final Cleanup")
        
        try:
            if not self.test_schedule_id:
                self.log_test("Final Cleanup", True, "No schedule to cleanup")
                return
            
            async with self.session.delete(f"{BASE_URL}/shared-schedule/{self.test_schedule_id}?owner_id=999001") as resp:
                if resp.status in [200, 404]:  # 404 is OK if already deleted
                    self.log_test("Final Cleanup", True, f"Schedule cleaned up successfully")
                    # Remove from cleanup list
                    if self.test_schedule_id in self.created_schedules:
                        self.created_schedules.remove(self.test_schedule_id)
                else:
                    self.log_test("Final Cleanup", False, f"Cleanup failed: HTTP {resp.status}")
        
        except Exception as e:
            self.log_test("Final Cleanup", False, f"Exception: {e}")
    
    async def run_all_tests(self):
        """Run all test scenarios as specified in the review request"""
        print("🚀 Starting Shared Schedule Backend API Tests")
        print(f"📡 Base URL: {BASE_URL}")
        print("📝 Testing specific endpoints and bug fixes from review request")
        
        await self.setup()
        
        try:
            # Run tests in the order specified in review request
            await self.test_1_create_schedule()
            await self.test_2_get_schedule_with_week()
            await self.test_3_add_non_friend_participant()
            await self.test_4_delete_without_owner_id()
            await self.test_5_delete_with_correct_owner_id()
            await self.test_6_create_another_schedule_for_token()
            await self.test_7_create_share_token()
            await self.test_8_get_token_data()
            await self.test_9_cleanup_final_schedule()
            
        finally:
            await self.teardown()
        
        # Summary
        print("\n" + "="*80)
        print("📊 SHARED SCHEDULE API TESTS SUMMARY")
        print("="*80)
        
        passed = sum(1 for result in self.test_results if result["passed"])
        total = len(self.test_results)
        
        # Show results with emphasis on critical security fixes
        for result in self.test_results:
            status = "✅" if result["passed"] else "❌"
            marker = "🔐" if "Delete Without owner_id" in result["test"] or "Add Non-Friend Participant" in result["test"] else ""
            print(f"{status} {marker} {result['test']}")
            if result["details"] and ("CRITICAL" in result["details"] or "403" in result["details"]):
                print(f"    🔴 {result['details']}")
        
        print(f"\n🎯 RESULTS: {passed}/{total} tests passed")
        
        # Check critical security fixes
        security_tests = [r for r in self.test_results if "Delete Without owner_id" in r["test"] or "Add Non-Friend Participant" in r["test"]]
        security_passed = sum(1 for r in security_tests if r["passed"])
        
        if security_passed == len(security_tests):
            print("🔒 SECURITY FIXES: All security bug fixes are working correctly!")
        else:
            print(f"⚠️  SECURITY ISSUES: {len(security_tests) - security_passed} security fixes failed!")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED! Shared schedule API is working correctly.")
        else:
            print("⚠️  Some tests failed. Review details above.")
        
        return passed == total


async def main():
    """Main entry point"""
    tester = SharedScheduleTester()
    success = await tester.run_all_tests()
    return 0 if success else 1


if __name__ == "__main__":
    import sys
    exit_code = asyncio.run(main())
    sys.exit(exit_code)