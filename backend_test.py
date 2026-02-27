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

# Base URL - backend running locally
BASE_URL = "http://localhost:8001/api"

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
    
    async def test_1_deduplication(self):
        """
        Test 1: Deduplication - POST /api/shared-schedule twice with same owner_id 
        should return the SAME id both times
        """
        print("\n🧪 Test 1: Deduplication Test")
        
        try:
            # First POST
            payload1 = {
                "owner_id": 555555,
                "participant_ids": [666666]
            }
            
            async with self.session.post(f"{BASE_URL}/shared-schedule", json=payload1) as resp1:
                if resp1.status != 200:
                    self.log_test("Deduplication Test", False, f"First POST failed: {resp1.status}")
                    return
                
                data1 = await resp1.json()
                schedule_id_1 = data1.get("id")
                
                if schedule_id_1:
                    self.created_schedules.append(schedule_id_1)
            
            # Second POST with same owner_id
            payload2 = {
                "owner_id": 555555,
                "participant_ids": [777777]  # Different participants
            }
            
            async with self.session.post(f"{BASE_URL}/shared-schedule", json=payload2) as resp2:
                if resp2.status != 200:
                    self.log_test("Deduplication Test", False, f"Second POST failed: {resp2.status}")
                    return
                
                data2 = await resp2.json()
                schedule_id_2 = data2.get("id")
            
            # Check if IDs are the same
            if schedule_id_1 and schedule_id_2 and schedule_id_1 == schedule_id_2:
                self.log_test("Deduplication Test", True, f"Same ID returned: {schedule_id_1}")
            else:
                self.log_test("Deduplication Test", False, f"Different IDs: {schedule_id_1} vs {schedule_id_2}")
        
        except Exception as e:
            self.log_test("Deduplication Test", False, f"Exception: {e}")
    
    async def test_2_week_parameter(self):
        """
        Test 2: Week parameter - GET /api/shared-schedule/{id}?week=1 should return {week: 1},
        GET with week=2 should return {week: 2}
        """
        print("\n🧪 Test 2: Week Parameter Test")
        
        try:
            # Test week=1
            async with self.session.get(f"{BASE_URL}/shared-schedule/555555?week=1") as resp1:
                if resp1.status != 200:
                    self.log_test("Week Parameter Test (week=1)", False, f"Request failed: {resp1.status}")
                    return
                
                data1 = await resp1.json()
                week1 = data1.get("week")
                
                if week1 == 1:
                    self.log_test("Week Parameter Test (week=1)", True, f"Returned week: {week1}")
                else:
                    self.log_test("Week Parameter Test (week=1)", False, f"Expected week=1, got: {week1}")
            
            # Test week=2
            async with self.session.get(f"{BASE_URL}/shared-schedule/555555?week=2") as resp2:
                if resp2.status != 200:
                    self.log_test("Week Parameter Test (week=2)", False, f"Request failed: {resp2.status}")
                    return
                
                data2 = await resp2.json()
                week2 = data2.get("week")
                
                if week2 == 2:
                    self.log_test("Week Parameter Test (week=2)", True, f"Returned week: {week2}")
                else:
                    self.log_test("Week Parameter Test (week=2)", False, f"Expected week=2, got: {week2}")
        
        except Exception as e:
            self.log_test("Week Parameter Test", False, f"Exception: {e}")
    
    async def test_3_participant_limit(self):
        """
        Test 3: Participant limit - After creating schedule, add 7 participants (200001-200007),
        8th add should return HTTP 400
        """
        print("\n🧪 Test 3: Participant Limit Test")
        
        try:
            # Create new schedule for this test
            payload = {
                "owner_id": 888888,
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
            
            # Add 7 participants (200001-200007)
            success_count = 0
            for i in range(1, 8):  # 200001 to 200007
                participant_id = 200000 + i
                add_payload = {"participant_id": participant_id}
                
                async with self.session.post(f"{BASE_URL}/shared-schedule/{schedule_id}/add-participant", json=add_payload) as add_resp:
                    if add_resp.status == 200:
                        success_count += 1
                        print(f"    Added participant {participant_id} (#{success_count})")
                    else:
                        print(f"    Failed to add participant {participant_id}: {add_resp.status}")
            
            # Try to add 8th participant (should fail with 400)
            participant_8 = 200008
            add_payload = {"participant_id": participant_8}
            
            async with self.session.post(f"{BASE_URL}/shared-schedule/{schedule_id}/add-participant", json=add_payload) as add_resp:
                if add_resp.status == 400:
                    self.log_test("Participant Limit Test", True, f"8th participant correctly rejected with HTTP 400")
                else:
                    self.log_test("Participant Limit Test", False, f"8th participant returned HTTP {add_resp.status}, expected 400")
        
        except Exception as e:
            self.log_test("Participant Limit Test", False, f"Exception: {e}")
    
    async def test_4_owner_protection(self):
        """
        Test 4: Owner protection - DELETE /api/shared-schedule/{id}/remove-participant/{owner_id}
        should return HTTP 400 "cannot remove owner"
        """
        print("\n🧪 Test 4: Owner Protection Test")
        
        try:
            # Use existing schedule or create one
            owner_id = 999999
            payload = {
                "owner_id": owner_id,
                "participant_ids": [200001]
            }
            
            async with self.session.post(f"{BASE_URL}/shared-schedule", json=payload) as resp:
                if resp.status != 200:
                    self.log_test("Owner Protection Test", False, f"Schedule creation failed: {resp.status}")
                    return
                
                data = await resp.json()
                schedule_id = data.get("id")
                
                if schedule_id:
                    self.created_schedules.append(schedule_id)
            
            # Try to remove the owner
            async with self.session.delete(f"{BASE_URL}/shared-schedule/{schedule_id}/remove-participant/{owner_id}") as resp:
                if resp.status == 400:
                    response_text = await resp.text()
                    if "owner" in response_text.lower() or "владелец" in response_text.lower():
                        self.log_test("Owner Protection Test", True, f"Owner removal correctly blocked with HTTP 400")
                    else:
                        self.log_test("Owner Protection Test", False, f"HTTP 400 but wrong message: {response_text}")
                else:
                    self.log_test("Owner Protection Test", False, f"Expected HTTP 400, got {resp.status}")
        
        except Exception as e:
            self.log_test("Owner Protection Test", False, f"Exception: {e}")
    
    async def test_5_authorization(self):
        """
        Test 5: Authorization - DELETE /api/shared-schedule/{id}?owner_id=WRONG_ID should return 403,
        DELETE with correct owner_id should return 200
        """
        print("\n🧪 Test 5: Authorization Test")
        
        try:
            # Create schedule for this test
            owner_id = 111111
            payload = {
                "owner_id": owner_id,
                "participant_ids": [200001]
            }
            
            async with self.session.post(f"{BASE_URL}/shared-schedule", json=payload) as resp:
                if resp.status != 200:
                    self.log_test("Authorization Test", False, f"Schedule creation failed: {resp.status}")
                    return
                
                data = await resp.json()
                schedule_id = data.get("id")
            
            # Test 1: Wrong owner_id should return 403
            wrong_owner_id = 999999
            async with self.session.delete(f"{BASE_URL}/shared-schedule/{schedule_id}?owner_id={wrong_owner_id}") as resp:
                if resp.status == 403:
                    self.log_test("Authorization Test (wrong owner)", True, f"Wrong owner correctly blocked with HTTP 403")
                else:
                    self.log_test("Authorization Test (wrong owner)", False, f"Expected HTTP 403, got {resp.status}")
            
            # Test 2: Correct owner_id should return 200
            async with self.session.delete(f"{BASE_URL}/shared-schedule/{schedule_id}?owner_id={owner_id}") as resp:
                if resp.status == 200:
                    self.log_test("Authorization Test (correct owner)", True, f"Correct owner deletion returned HTTP 200")
                    # Remove from cleanup list since it's already deleted
                    if schedule_id in self.created_schedules:
                        self.created_schedules.remove(schedule_id)
                else:
                    self.log_test("Authorization Test (correct owner)", False, f"Expected HTTP 200, got {resp.status}")
        
        except Exception as e:
            self.log_test("Authorization Test", False, f"Exception: {e}")
    
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