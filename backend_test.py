#!/usr/bin/env python3
"""
Backend API Testing Script for NEW Phase 1 Endpoints
Tests the newly implemented streak, shared-schedule, and admin notification endpoints
"""

import asyncio
import aiohttp
import json
import sys
from datetime import datetime
import uuid

# Backend URL - using local port since external URL is not accessible
BACKEND_URL = "http://localhost:8001/api"

class BackendTester:
    def __init__(self):
        self.session = None
        self.results = []
        self.test_data = {}
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_result(self, test_name: str, success: bool, details: str):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {details}")
        self.results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    async def test_endpoint(self, method: str, path: str, data=None, expected_status=200, test_name=""):
        """Generic endpoint tester"""
        url = f"{BACKEND_URL}{path}"
        try:
            if method == "GET":
                async with self.session.get(url) as resp:
                    response_data = await resp.json()
                    success = resp.status == expected_status
                    return success, resp.status, response_data
            elif method == "POST":
                headers = {"Content-Type": "application/json"}
                async with self.session.post(url, json=data, headers=headers) as resp:
                    response_data = await resp.json()
                    success = resp.status == expected_status
                    return success, resp.status, response_data
            elif method == "DELETE":
                async with self.session.delete(url) as resp:
                    response_data = await resp.json()
                    success = resp.status == expected_status
                    return success, resp.status, response_data
        except Exception as e:
            return False, 0, {"error": str(e)}
    
    async def test_streak_visit_recording(self):
        """Test 1: POST /api/users/{telegram_id}/visit - Streak visit recording"""
        test_user_id = 555555
        
        # First visit
        success, status, data = await self.test_endpoint(
            "POST", f"/users/{test_user_id}/visit", 
            test_name="Streak Visit Recording"
        )
        
        if success:
            required_fields = ['visit_streak_current', 'visit_streak_max', 'freeze_shields', 
                             'streak_continued', 'streak_reset', 'freeze_used', 
                             'milestone_reached', 'is_new_day', 'week_days']
            
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                self.log_result("Streak Visit - Response Fields", False, 
                              f"Missing fields: {missing_fields}")
            else:
                self.log_result("Streak Visit - Response Fields", True, 
                              f"All required fields present")
                
            # Verify week_days structure
            week_days = data.get('week_days', [])
            if len(week_days) == 7:
                week_day_valid = True
                for day in week_days:
                    if not all(key in day for key in ['label', 'dateNum', 'done']):
                        week_day_valid = False
                        break
                
                if week_day_valid:
                    self.log_result("Streak Visit - Week Days Structure", True, 
                                  "Week days array has correct structure (7 items with label, dateNum, done)")
                else:
                    self.log_result("Streak Visit - Week Days Structure", False, 
                                  "Week days items missing required fields")
            else:
                self.log_result("Streak Visit - Week Days Structure", False, 
                              f"Expected 7 week days, got {len(week_days)}")
        
        self.log_result("Streak Visit Recording", success, 
                      f"Status: {status}, Response keys: {list(data.keys()) if isinstance(data, dict) else 'Invalid'}")
        
        # Second visit (same day) - should NOT increment streak
        success2, status2, data2 = await self.test_endpoint(
            "POST", f"/users/{test_user_id}/visit", 
            test_name="Same Day Visit"
        )
        
        if success and success2:
            streak_unchanged = (data.get('visit_streak_current') == data2.get('visit_streak_current'))
            self.log_result("Same Day Visit - No Increment", streak_unchanged, 
                          f"Streak remained same: {data2.get('visit_streak_current')}")
        else:
            self.log_result("Same Day Visit", False, f"Failed to test same day visit")
    
    async def test_streak_claim(self):
        """Test 2: POST /api/users/{telegram_id}/streak-claim - Claim streak reward"""
        test_user_id = 555555
        
        success, status, data = await self.test_endpoint(
            "POST", f"/users/{test_user_id}/streak-claim", 
            test_name="Streak Claim"
        )
        
        if success:
            has_success = data.get('success') is True
            has_message = 'message' in data
            self.log_result("Streak Claim Response", has_success and has_message, 
                          f"success={data.get('success')}, message='{data.get('message')}'")
        
        self.log_result("Streak Claim", success, 
                      f"Status: {status}, Response: {data}")
    
    async def test_shared_schedule_create(self):
        """Test 3: POST /api/shared-schedule - Create shared schedule"""
        payload = {
            "owner_id": 555555,
            "participant_ids": [666666]
        }
        
        success, status, data = await self.test_endpoint(
            "POST", "/shared-schedule", payload,
            test_name="Create Shared Schedule"
        )
        
        if success:
            required_fields = ['id', 'owner_id', 'participants', 'schedules', 'free_windows']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_result("Shared Schedule Create - Fields", False, 
                              f"Missing fields: {missing_fields}")
            else:
                # Store schedule ID for later tests
                self.test_data['schedule_id'] = data.get('id')
                
                # Verify ID is UUID format
                try:
                    uuid.UUID(data.get('id'))
                    self.log_result("Shared Schedule - UUID Format", True, 
                                  f"Valid UUID: {data.get('id')}")
                except:
                    self.log_result("Shared Schedule - UUID Format", False, 
                                  f"Invalid UUID: {data.get('id')}")
                
                # Check participants array
                participants = data.get('participants', [])
                expected_participants = 2  # owner + 1 participant
                self.log_result("Shared Schedule - Participants", len(participants) == expected_participants,
                              f"Expected {expected_participants}, got {len(participants)} participants")
        
        self.log_result("Create Shared Schedule", success, 
                      f"Status: {status}, Response keys: {list(data.keys()) if isinstance(data, dict) else 'Invalid'}")
    
    async def test_shared_schedule_get(self):
        """Test 4: GET /api/shared-schedule/{telegram_id} - Get shared schedule"""
        test_user_id = 555555
        
        success, status, data = await self.test_endpoint(
            "GET", f"/shared-schedule/{test_user_id}",
            test_name="Get Shared Schedule"
        )
        
        if success:
            required_fields = ['exists', 'id', 'participants', 'schedules', 'free_windows']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_result("Get Shared Schedule - Fields", False, 
                              f"Missing fields: {missing_fields}")
            else:
                exists = data.get('exists', False)
                self.log_result("Get Shared Schedule - Exists", exists, 
                              f"Schedule exists: {exists}, ID: {data.get('id')}")
        
        self.log_result("Get Shared Schedule", success, 
                      f"Status: {status}, Response keys: {list(data.keys()) if isinstance(data, dict) else 'Invalid'}")
    
    async def test_shared_schedule_add_participant(self):
        """Test 5: POST /api/shared-schedule/{id}/add-participant"""
        if 'schedule_id' not in self.test_data:
            self.log_result("Add Participant", False, "No schedule_id available from create test")
            return
        
        schedule_id = self.test_data['schedule_id']
        payload = {"participant_id": 777777}
        
        success, status, data = await self.test_endpoint(
            "POST", f"/shared-schedule/{schedule_id}/add-participant", payload,
            test_name="Add Participant"
        )
        
        if success:
            has_success = data.get('success') is True
            self.log_result("Add Participant Response", has_success, 
                          f"success={data.get('success')}, message='{data.get('message', '')}'")
        
        self.log_result("Add Participant", success, 
                      f"Status: {status}, Response: {data}")
    
    async def test_shared_schedule_remove_participant(self):
        """Test 6: DELETE /api/shared-schedule/{id}/remove-participant/{pid}"""
        if 'schedule_id' not in self.test_data:
            self.log_result("Remove Participant", False, "No schedule_id available from create test")
            return
        
        schedule_id = self.test_data['schedule_id']
        participant_id = 777777
        
        success, status, data = await self.test_endpoint(
            "DELETE", f"/shared-schedule/{schedule_id}/remove-participant/{participant_id}",
            test_name="Remove Participant"
        )
        
        if success:
            has_success = data.get('success') is True
            self.log_result("Remove Participant Response", has_success, 
                          f"success={data.get('success')}, message='{data.get('message', '')}'")
        
        self.log_result("Remove Participant", success, 
                      f"Status: {status}, Response: {data}")
    
    async def test_telegram_parse(self):
        """Test 7: POST /api/admin/notifications/parse-telegram - Parse TG post"""
        # Valid Telegram URL test
        payload = {"telegram_url": "https://t.me/durov/342"}
        
        success, status, data = await self.test_endpoint(
            "POST", "/admin/notifications/parse-telegram", payload,
            test_name="Parse Telegram Post"
        )
        
        if success:
            required_fields = ['success', 'title', 'description', 'channel', 'post_id']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_result("Parse Telegram - Fields", False, 
                              f"Missing fields: {missing_fields}")
            else:
                # Verify parsed data
                channel = data.get('channel')
                post_id = data.get('post_id')
                
                self.log_result("Parse Telegram - Channel", channel == "durov", 
                              f"Expected 'durov', got '{channel}'")
                self.log_result("Parse Telegram - Post ID", post_id == "342", 
                              f"Expected '342', got '{post_id}'")
        
        self.log_result("Parse Telegram Post", success, 
                      f"Status: {status}, Response keys: {list(data.keys()) if isinstance(data, dict) else 'Invalid'}")
        
        # Invalid URL test
        invalid_payload = {"telegram_url": "https://invalid-url"}
        success_invalid, status_invalid, data_invalid = await self.test_endpoint(
            "POST", "/admin/notifications/parse-telegram", invalid_payload,
            expected_status=400,
            test_name="Parse Telegram Invalid URL"
        )
        
        self.log_result("Parse Telegram - Invalid URL", success_invalid, 
                      f"Correctly returned 400 for invalid URL")
    
    async def test_notification_send(self):
        """Test 8: POST /api/admin/notifications/send-from-post - Send notification"""
        payload = {
            "title": "Test Notification",
            "description": "Test notification from API testing",
            "image_url": "",
            "recipients": "all"
        }
        
        success, status, data = await self.test_endpoint(
            "POST", "/admin/notifications/send-from-post", payload,
            test_name="Send Notification"
        )
        
        if success:
            has_success = 'success' in data
            self.log_result("Send Notification Response", has_success, 
                          f"Response contains success field: {data.get('success')}")
        
        self.log_result("Send Notification", success, 
                      f"Status: {status}, Response: {data}")
    
    async def test_user_stats_streak_fields(self):
        """Test 9: GET /api/user-stats/555555 - Verify stats include streak fields"""
        test_user_id = 555555
        
        success, status, data = await self.test_endpoint(
            "GET", f"/user-stats/{test_user_id}",
            test_name="User Stats Streak Fields"
        )
        
        if success:
            streak_fields = ['visit_streak_current', 'visit_streak_max', 'last_visit_date', 
                           'freeze_shields', 'streak_claimed_today']
            missing_fields = [field for field in streak_fields if field not in data]
            
            if missing_fields:
                self.log_result("User Stats - Streak Fields", False, 
                              f"Missing streak fields: {missing_fields}")
            else:
                self.log_result("User Stats - Streak Fields", True, 
                              "All streak fields present in user stats")
        
        self.log_result("User Stats Streak Fields", success, 
                      f"Status: {status}, Response keys: {list(data.keys()) if isinstance(data, dict) else 'Invalid'}")
    
    async def run_all_tests(self):
        """Run all test cases"""
        print(f"🚀 Starting Backend API Tests for NEW Phase 1 Endpoints")
        print(f"📡 Backend URL: {BACKEND_URL}")
        print(f"⏰ Started at: {datetime.utcnow().isoformat()}")
        print("=" * 80)
        
        # Test sequence
        await self.test_streak_visit_recording()
        await self.test_streak_claim()
        await self.test_shared_schedule_create()
        await self.test_shared_schedule_get()
        await self.test_shared_schedule_add_participant()
        await self.test_shared_schedule_remove_participant()
        await self.test_telegram_parse()
        await self.test_notification_send()
        await self.test_user_stats_streak_fields()
        
        # Summary
        print("=" * 80)
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"📊 TEST SUMMARY:")
        print(f"   Total Tests: {total_tests}")
        print(f"   ✅ Passed: {passed_tests}")
        print(f"   ❌ Failed: {failed_tests}")
        print(f"   Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS:")
            for result in self.results:
                if not result['success']:
                    print(f"   • {result['test']}: {result['details']}")
        
        return failed_tests == 0

async def main():
    """Main test runner"""
    async with BackendTester() as tester:
        success = await tester.run_all_tests()
        sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())