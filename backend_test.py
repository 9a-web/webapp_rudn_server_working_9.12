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
        Critical Test 1: POST /api/shared-schedule with body {"owner_id": 999001, "participant_ids": [999002]} 
        → should create schedule with valid UUID, return participants array
        """
        print("\n🧪 Critical Test 1: Create Shared Schedule")
        
        try:
            payload = {
                "owner_id": 999001,
                "participant_ids": [999002]
            }
            
            async with self.session.post(f"{BASE_URL}/shared-schedule", json=payload) as resp:
                if resp.status != 200:
                    self.log_test("Create Schedule", False, f"POST failed: HTTP {resp.status}")
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
                
                if len(participants) != 2:  # Owner + 1 participant
                    self.log_test("Create Schedule", False, f"Wrong participant count: {len(participants)}")
                    return
                
                # Check if participants array contains both users
                participant_ids = [p["telegram_id"] for p in participants]
                if 999001 not in participant_ids or 999002 not in participant_ids:
                    self.log_test("Create Schedule", False, f"Missing participants: {participant_ids}")
                    return
                
                self.created_schedules.append(schedule_id)
                self.test_schedule_id = schedule_id  # Store for other tests
                
                self.log_test("Create Schedule", True, f"Schedule created with valid UUID: {schedule_id}, participants: {len(participants)}")
        
        except Exception as e:
            self.log_test("Create Schedule", False, f"Exception: {e}")
    
    async def test_2_get_schedule_with_week(self):
        """
        Critical Test 2: GET /api/shared-schedule/999001?week=1 
        → should return exists=true, schedules, free_windows
        """
        print("\n🧪 Critical Test 2: Get Schedule with Week Parameter")
        
        try:
            async with self.session.get(f"{BASE_URL}/shared-schedule/999001?week=1") as resp:
                if resp.status != 200:
                    self.log_test("Get Schedule Week=1", False, f"GET failed: HTTP {resp.status}")
                    return
                
                data = await resp.json()
                exists = data.get("exists")
                schedules = data.get("schedules", {})
                free_windows = data.get("free_windows", [])
                week = data.get("week")
                
                if not exists:
                    self.log_test("Get Schedule Week=1", False, f"exists=false, expected true")
                    return
                
                if week != 1:
                    self.log_test("Get Schedule Week=1", False, f"week={week}, expected 1")
                    return
                
                # Schedules should be a dict, free_windows should be a list
                if not isinstance(schedules, dict):
                    self.log_test("Get Schedule Week=1", False, f"schedules is not dict: {type(schedules)}")
                    return
                
                if not isinstance(free_windows, list):
                    self.log_test("Get Schedule Week=1", False, f"free_windows is not list: {type(free_windows)}")
                    return
                
                self.log_test("Get Schedule Week=1", True, f"exists=true, week=1, schedules keys: {len(schedules)}, free_windows: {len(free_windows)}")
        
        except Exception as e:
            self.log_test("Get Schedule Week=1", False, f"Exception: {e}")
    
    async def test_3_add_participant(self):
        """
        Critical Test 3: POST /api/shared-schedule/{id}/add-participant with {"participant_id": 999003} 
        → should add participant
        """
        print("\n🧪 Critical Test 3: Add Participant")
        
        try:
            if not hasattr(self, 'test_schedule_id') or not self.test_schedule_id:
                self.log_test("Add Participant", False, "No schedule ID available from previous test")
                return
            
            payload = {"participant_id": 999003}
            
            async with self.session.post(f"{BASE_URL}/shared-schedule/{self.test_schedule_id}/add-participant", json=payload) as resp:
                if resp.status != 200:
                    self.log_test("Add Participant", False, f"POST failed: HTTP {resp.status}")
                    return
                
                data = await resp.json()
                success = data.get("success")
                
                if not success:
                    self.log_test("Add Participant", False, f"success=false in response")
                    return
                
                # Verify participant was added by getting the schedule
                async with self.session.get(f"{BASE_URL}/shared-schedule/999001") as get_resp:
                    if get_resp.status == 200:
                        get_data = await get_resp.json()
                        participants = get_data.get("participants", [])
                        participant_ids = [p["telegram_id"] for p in participants]
                        
                        if 999003 in participant_ids:
                            self.log_test("Add Participant", True, f"Participant 999003 successfully added. Total participants: {len(participants)}")
                        else:
                            self.log_test("Add Participant", False, f"Participant 999003 not found in participants: {participant_ids}")
                    else:
                        self.log_test("Add Participant", False, f"Could not verify participant addition: GET failed {get_resp.status}")
        
        except Exception as e:
            self.log_test("Add Participant", False, f"Exception: {e}")
    
    async def test_4_remove_participant(self):
        """
        Critical Test 4: DELETE /api/shared-schedule/{id}/remove-participant/999003 
        → should remove participant
        """
        print("\n🧪 Critical Test 4: Remove Participant")
        
        try:
            if not hasattr(self, 'test_schedule_id') or not self.test_schedule_id:
                self.log_test("Remove Participant", False, "No schedule ID available from previous test")
                return
            
            async with self.session.delete(f"{BASE_URL}/shared-schedule/{self.test_schedule_id}/remove-participant/999003") as resp:
                if resp.status != 200:
                    self.log_test("Remove Participant", False, f"DELETE failed: HTTP {resp.status}")
                    return
                
                data = await resp.json()
                success = data.get("success")
                
                if not success:
                    self.log_test("Remove Participant", False, f"success=false in response")
                    return
                
                # Verify participant was removed by getting the schedule
                async with self.session.get(f"{BASE_URL}/shared-schedule/999001") as get_resp:
                    if get_resp.status == 200:
                        get_data = await get_resp.json()
                        participants = get_data.get("participants", [])
                        participant_ids = [p["telegram_id"] for p in participants]
                        
                        if 999003 not in participant_ids:
                            self.log_test("Remove Participant", True, f"Participant 999003 successfully removed. Remaining participants: {len(participants)}")
                        else:
                            self.log_test("Remove Participant", False, f"Participant 999003 still found in participants: {participant_ids}")
                    else:
                        self.log_test("Remove Participant", False, f"Could not verify participant removal: GET failed {get_resp.status}")
        
        except Exception as e:
            self.log_test("Remove Participant", False, f"Exception: {e}")
    
    async def test_5_owner_protection(self):
        """
        Critical Test 5: Owner protection: DELETE /api/shared-schedule/{id}/remove-participant/999001 
        → should return 400 (can't remove owner)
        """
        print("\n🧪 Critical Test 5: Owner Protection Test")
        
        try:
            if not hasattr(self, 'test_schedule_id') or not self.test_schedule_id:
                self.log_test("Owner Protection", False, "No schedule ID available from previous test")
                return
            
            # Try to remove the owner (999001)
            async with self.session.delete(f"{BASE_URL}/shared-schedule/{self.test_schedule_id}/remove-participant/999001") as resp:
                if resp.status == 400:
                    response_text = await resp.text()
                    # Check for owner protection message in English or Russian
                    if ("owner" in response_text.lower() or 
                        "владелец" in response_text.lower() or 
                        "cannot remove" in response_text.lower() or
                        "нельзя удалить" in response_text.lower()):
                        self.log_test("Owner Protection", True, f"Owner removal correctly blocked with HTTP 400: {response_text}")
                    else:
                        self.log_test("Owner Protection", False, f"HTTP 400 but wrong message: {response_text}")
                else:
                    self.log_test("Owner Protection", False, f"Expected HTTP 400, got {resp.status}")
        
        except Exception as e:
            self.log_test("Owner Protection", False, f"Exception: {e}")
    
    async def test_6_delete_schedule(self):
        """
        Critical Test 6: DELETE /api/shared-schedule/{id} → should delete schedule
        """
        print("\n🧪 Critical Test 6: Delete Schedule")
        
        try:
            if not hasattr(self, 'test_schedule_id') or not self.test_schedule_id:
                self.log_test("Delete Schedule", False, "No schedule ID available from previous test")
                return
            
            async with self.session.delete(f"{BASE_URL}/shared-schedule/{self.test_schedule_id}?owner_id=999001") as resp:
                if resp.status != 200:
                    self.log_test("Delete Schedule", False, f"DELETE failed: HTTP {resp.status}")
                    return
                
                data = await resp.json()
                success = data.get("success")
                
                if not success:
                    self.log_test("Delete Schedule", False, f"success=false in response")
                    return
                
                # Verify schedule was deleted by trying to get it
                async with self.session.get(f"{BASE_URL}/shared-schedule/999001") as get_resp:
                    if get_resp.status == 200:
                        get_data = await get_resp.json()
                        exists = get_data.get("exists")
                        
                        if not exists:
                            self.log_test("Delete Schedule", True, f"Schedule successfully deleted. exists=false")
                            # Remove from cleanup list since it's already deleted
                            if self.test_schedule_id in self.created_schedules:
                                self.created_schedules.remove(self.test_schedule_id)
                        else:
                            self.log_test("Delete Schedule", False, f"Schedule still exists after deletion")
                    else:
                        self.log_test("Delete Schedule", False, f"Could not verify deletion: GET failed {get_resp.status}")
        
        except Exception as e:
            self.log_test("Delete Schedule", False, f"Exception: {e}")
    
    async def test_7_deduplication(self):
        """
        Critical Test 7: Deduplication: POST /api/shared-schedule twice with same owner_id=999001 
        → should return SAME schedule ID
        """
        print("\n🧪 Critical Test 7: Deduplication Test")
        
        try:
            # First POST
            payload1 = {
                "owner_id": 999001,
                "participant_ids": [888001]
            }
            
            async with self.session.post(f"{BASE_URL}/shared-schedule", json=payload1) as resp1:
                if resp1.status != 200:
                    self.log_test("Deduplication Test", False, f"First POST failed: {resp1.status}")
                    return
                
                data1 = await resp1.json()
                schedule_id_1 = data1.get("id")
                
                if schedule_id_1:
                    self.created_schedules.append(schedule_id_1)
            
            # Second POST with same owner_id but different participants
            payload2 = {
                "owner_id": 999001,
                "participant_ids": [888002]  # Different participants
            }
            
            async with self.session.post(f"{BASE_URL}/shared-schedule", json=payload2) as resp2:
                if resp2.status != 200:
                    self.log_test("Deduplication Test", False, f"Second POST failed: {resp2.status}")
                    return
                
                data2 = await resp2.json()
                schedule_id_2 = data2.get("id")
            
            # Check if IDs are the same (deduplication working)
            if schedule_id_1 and schedule_id_2 and schedule_id_1 == schedule_id_2:
                self.log_test("Deduplication Test", True, f"SAME ID returned both times: {schedule_id_1}")
                self.dedup_schedule_id = schedule_id_1
            else:
                self.log_test("Deduplication Test", False, f"Different IDs returned: {schedule_id_1} vs {schedule_id_2}")
        
        except Exception as e:
            self.log_test("Deduplication Test", False, f"Exception: {e}")
    
    async def test_8_participant_limit(self):
        """
        Critical Test 8: Participant limit: add 7 participants, then 8th should fail with 400
        """
        print("\n🧪 Critical Test 8: Participant Limit Test")
        
        try:
            # Create new schedule for this test
            payload = {
                "owner_id": 777001,
                "participant_ids": []
            }
            
            async with self.session.post(f"{BASE_URL}/shared-schedule", json=payload) as resp:
                if resp.status != 200:
                    self.log_test("Participant Limit Test", False, f"Schedule creation failed: {resp.status}")
                    return
                
                data = await resp.json()
                schedule_id = data.get("id")
                
                if schedule_id:
                    self.created_schedules.append(schedule_id)
            
            # Add 7 participants (owner counts as 1, so we can add 7 more for total of 8)
            success_count = 0
            for i in range(1, 8):  # 777101 to 777107 (7 participants)
                participant_id = 777100 + i
                add_payload = {"participant_id": participant_id}
                
                async with self.session.post(f"{BASE_URL}/shared-schedule/{schedule_id}/add-participant", json=add_payload) as add_resp:
                    if add_resp.status == 200:
                        success_count += 1
                        print(f"    ✅ Added participant {participant_id} (#{success_count})")
                    else:
                        print(f"    ❌ Failed to add participant {participant_id}: {add_resp.status}")
                        break
            
            if success_count != 7:
                self.log_test("Participant Limit Test", False, f"Could not add 7 participants, only added {success_count}")
                return
            
            # Try to add 8th participant (should fail with 400)
            participant_8 = 777108
            add_payload = {"participant_id": participant_8}
            
            async with self.session.post(f"{BASE_URL}/shared-schedule/{schedule_id}/add-participant", json=add_payload) as add_resp:
                if add_resp.status == 400:
                    response_text = await add_resp.text()
                    self.log_test("Participant Limit Test", True, f"8th participant correctly rejected with HTTP 400: {response_text}")
                else:
                    self.log_test("Participant Limit Test", False, f"8th participant returned HTTP {add_resp.status}, expected 400")
        
        except Exception as e:
            self.log_test("Participant Limit Test", False, f"Exception: {e}")
    
    async def run_all_tests(self):
        """Run all critical test scenarios in sequence"""
        print("🚀 Starting Shared Schedule Backend API Critical Tests")
        print(f"📡 Base URL: {BASE_URL}")
        
        await self.setup()
        
        try:
            # Run critical tests in sequence (as requested in review)
            await self.test_1_create_schedule()
            await self.test_2_get_schedule_with_week()
            await self.test_3_add_participant() 
            await self.test_4_remove_participant()
            await self.test_5_owner_protection()
            await self.test_6_delete_schedule()
            await self.test_7_deduplication()
            await self.test_8_participant_limit()
            
        finally:
            await self.teardown()
        
        # Summary
        print("\n" + "="*70)
        print("📊 CRITICAL TESTS SUMMARY")
        print("="*70)
        
        passed = sum(1 for result in self.test_results if result["passed"])
        total = len(self.test_results)
        
        for result in self.test_results:
            status = "✅" if result["passed"] else "❌"
            print(f"{status} {result['test']}")
        
        print(f"\n🎯 RESULTS: {passed}/{total} critical tests passed")
        
        if passed == total:
            print("🎉 ALL CRITICAL TESTS PASSED! Shared schedule endpoints working correctly.")
        else:
            print("⚠️  Some critical tests failed. Check details above.")
        
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