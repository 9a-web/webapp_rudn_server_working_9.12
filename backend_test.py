#!/usr/bin/env python3
"""
Backend API Testing Script for Shared Schedule Feature
Tests the specific bugs mentioned in the review request.
"""

import asyncio
import aiohttp
import json
import uuid
from datetime import datetime

# Base URL - from environment configuration
BASE_URL = "https://shared-timetable.preview.emergentagent.com/api"

class SharedScheduleTester:
    def __init__(self):
        self.session = None
        self.test_results = []
        self.created_schedules = []  # Track for cleanup
    
    async def setup(self):
        """Setup HTTP session"""
        self.session = aiohttp.ClientSession()
        print("🔗 HTTP session created")
    
    async def teardown(self):
        """Cleanup resources and test data"""
        print("\n🧹 Cleaning up test data...")
        
        # Clean up created schedules
        for schedule_id in self.created_schedules:
            try:
                async with self.session.delete(f"{BASE_URL}/shared-schedule/{schedule_id}?owner_id=555555") as resp:
                    if resp.status in [200, 404]:
                        print(f"✅ Cleaned up schedule {schedule_id}")
            except Exception as e:
                print(f"⚠️ Failed to cleanup schedule {schedule_id}: {e}")
        
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
    
    async def test_6_free_windows_single_participant(self):
        """
        Test 6: Free windows with 1 participant - Schedule with only 1 participant should not crash,
        _compute_free_windows should return []
        """
        print("\n🧪 Test 6: Free Windows Single Participant Test")
        
        try:
            # Create schedule with only owner (no participants)
            owner_id = 333333
            payload = {
                "owner_id": owner_id,
                "participant_ids": []  # No additional participants
            }
            
            async with self.session.post(f"{BASE_URL}/shared-schedule", json=payload) as resp:
                if resp.status != 200:
                    self.log_test("Free Windows Single Participant", False, f"Schedule creation failed: {resp.status}")
                    return
                
                data = await resp.json()
                schedule_id = data.get("id")
                
                if schedule_id:
                    self.created_schedules.append(schedule_id)
            
            # Get the schedule (should not crash)
            async with self.session.get(f"{BASE_URL}/shared-schedule/{owner_id}") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    participants = data.get("participants", [])
                    free_windows = data.get("free_windows", [])
                    
                    # Should have only 1 participant (the owner)
                    if len(participants) == 1:
                        self.log_test("Free Windows Single Participant", True, f"Single participant schedule works, free_windows: {len(free_windows)} items")
                    else:
                        self.log_test("Free Windows Single Participant", False, f"Expected 1 participant, got {len(participants)}")
                else:
                    self.log_test("Free Windows Single Participant", False, f"GET request failed: {resp.status}")
        
        except Exception as e:
            self.log_test("Free Windows Single Participant", False, f"Exception: {e}")
    
    async def test_7_existing_functionality(self):
        """
        Test 7: Existing schedule tests - All basic operations should still work
        """
        print("\n🧪 Test 7: Existing Functionality Test")
        
        try:
            owner_id = 444444
            
            # Test 1: POST /api/shared-schedule creates schedule
            payload = {
                "owner_id": owner_id,
                "participant_ids": [500001]
            }
            
            async with self.session.post(f"{BASE_URL}/shared-schedule", json=payload) as resp:
                if resp.status != 200:
                    self.log_test("Existing Functionality (CREATE)", False, f"Creation failed: {resp.status}")
                    return
                
                data = await resp.json()
                schedule_id = data.get("id")
                
                if schedule_id:
                    self.created_schedules.append(schedule_id)
                    self.log_test("Existing Functionality (CREATE)", True, f"Schedule created: {schedule_id}")
                else:
                    self.log_test("Existing Functionality (CREATE)", False, "No schedule ID returned")
                    return
            
            # Test 2: GET /api/shared-schedule/{telegram_id} returns exists=true
            async with self.session.get(f"{BASE_URL}/shared-schedule/{owner_id}") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    exists = data.get("exists", False)
                    
                    if exists and data.get("id") == schedule_id:
                        self.log_test("Existing Functionality (GET)", True, "Schedule retrieved successfully")
                    else:
                        self.log_test("Existing Functionality (GET)", False, f"exists={exists}, id mismatch")
                else:
                    self.log_test("Existing Functionality (GET)", False, f"GET failed: {resp.status}")
            
            # Test 3: POST add-participant
            new_participant = 500002
            add_payload = {"participant_id": new_participant}
            
            async with self.session.post(f"{BASE_URL}/shared-schedule/{schedule_id}/add-participant", json=add_payload) as resp:
                if resp.status == 200:
                    self.log_test("Existing Functionality (ADD)", True, f"Participant {new_participant} added")
                else:
                    self.log_test("Existing Functionality (ADD)", False, f"Add participant failed: {resp.status}")
            
            # Test 4: DELETE remove-participant (non-owner)
            async with self.session.delete(f"{BASE_URL}/shared-schedule/{schedule_id}/remove-participant/{new_participant}") as resp:
                if resp.status == 200:
                    self.log_test("Existing Functionality (REMOVE)", True, f"Participant {new_participant} removed")
                else:
                    self.log_test("Existing Functionality (REMOVE)", False, f"Remove participant failed: {resp.status}")
        
        except Exception as e:
            self.log_test("Existing Functionality", False, f"Exception: {e}")
    
    async def run_all_tests(self):
        """Run all test scenarios in sequence"""
        print("🚀 Starting Shared Schedule Backend API Tests")
        print(f"📡 Base URL: {BASE_URL}")
        
        await self.setup()
        
        try:
            # Run tests in sequence
            await self.test_1_deduplication()
            await self.test_2_week_parameter()
            await self.test_3_participant_limit()
            await self.test_4_owner_protection()
            await self.test_5_authorization()
            await self.test_6_free_windows_single_participant()
            await self.test_7_existing_functionality()
            
        finally:
            await self.teardown()
        
        # Summary
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        
        passed = sum(1 for result in self.test_results if result["passed"])
        total = len(self.test_results)
        
        for result in self.test_results:
            status = "✅" if result["passed"] else "❌"
            print(f"{status} {result['test']}")
        
        print(f"\n🎯 RESULTS: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED!")
        else:
            print("⚠️  Some tests failed. Check details above.")
        
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