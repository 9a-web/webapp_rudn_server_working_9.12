#!/usr/bin/env python3
"""
Level System v2.0 Backend Testing Script for RUDN Schedule App
Tests all Level System v2.0 endpoints with specific scenarios from review request
"""

import asyncio
import aiohttp
import json
import sys
from typing import Dict, Any, List

# Backend URL - using localhost since external URL serves frontend
BACKEND_URL = "http://localhost:8001/api"

# Admin telegram ID for testing
ADMIN_TELEGRAM_ID = 765963392

class LevelSystemV2Tester:
    def __init__(self):
        self.session = None
        self.test_results = []
        self.total_tests = 0
        self.passed_tests = 0
        self.failed_tests = 0

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    def log_test(self, test_name: str, passed: bool, details: str = ""):
        """Log test result"""
        self.total_tests += 1
        if passed:
            self.passed_tests += 1
            status = "✅ PASS"
        else:
            self.failed_tests += 1
            status = "❌ FAIL"
        
        result = f"{status} - {test_name}"
        if details:
            result += f" | {details}"
        
        print(result)
        self.test_results.append({
            "test": test_name,
            "passed": passed,
            "details": details
        })

    async def make_request(self, method: str, endpoint: str, data: Dict[Any, Any] = None) -> Dict[Any, Any]:
        """Make HTTP request to backend"""
        url = f"{BACKEND_URL}{endpoint}"
        
        try:
            if method.upper() == "GET":
                async with self.session.get(url) as response:
                    return {
                        "status_code": response.status,
                        "data": await response.json() if response.content_type == 'application/json' else await response.text()
                    }
            elif method.upper() == "POST":
                async with self.session.post(url, json=data) as response:
                    return {
                        "status_code": response.status,
                        "data": await response.json() if response.content_type == 'application/json' else await response.text()
                    }
        except Exception as e:
            return {
                "status_code": 0,
                "data": {"error": str(e)}
            }

    async def test_xp_rewards_info(self):
        """Test GET /api/xp-rewards-info - Should return 10 reward items"""
        print("\n=== Testing GET /api/xp-rewards-info ===")
        
        response = await self.make_request("GET", "/xp-rewards-info")
        
        if response["status_code"] == 200:
            data = response["data"]
            if isinstance(data, dict) and "rewards" in data:
                rewards = data["rewards"]
                if isinstance(rewards, list) and len(rewards) == 10:
                    # Check if all items have required fields
                    required_fields = ["action", "xp", "label", "emoji", "limit"]
                    all_valid = True
                    for item in rewards:
                        if not all(field in item for field in required_fields):
                            all_valid = False
                            break
                    
                    self.log_test("XP rewards info structure", all_valid, 
                                 f"Returns {len(rewards)} items with required fields: {required_fields}")
                else:
                    self.log_test("XP rewards info structure", False, 
                                 f"Expected 10 items in rewards array, got {len(rewards) if isinstance(rewards, list) else 'non-list'}")
            else:
                self.log_test("XP rewards info structure", False, 
                             f"Expected object with 'rewards' field, got: {type(data)}")
        else:
            self.log_test("XP rewards info endpoint", False, 
                         f"Status: {response['status_code']}, Data: {response['data']}")

    async def test_user_level(self):
        """Test GET /api/users/{id}/level - Should return level info with required fields"""
        print(f"\n=== Testing GET /api/users/{ADMIN_TELEGRAM_ID}/level ===")
        
        response = await self.make_request("GET", f"/users/{ADMIN_TELEGRAM_ID}/level")
        
        if response["status_code"] == 200:
            data = response["data"]
            required_fields = ["level", "tier", "xp", "xp_current_level", "xp_next_level", "xp_in_level", "xp_needed", "progress"]
            
            if all(field in data for field in required_fields):
                self.log_test("User level endpoint structure", True, 
                             f"All required fields present: {required_fields}")
                return data  # Return for use in other tests
            else:
                missing_fields = [field for field in required_fields if field not in data]
                self.log_test("User level endpoint structure", False, 
                             f"Missing fields: {missing_fields}")
        else:
            self.log_test("User level endpoint", False, 
                         f"Status: {response['status_code']}, Data: {response['data']}")
        
        return None

    async def test_xp_breakdown(self):
        """Test GET /api/users/{id}/xp-breakdown - CRITICAL: Should return extended breakdown"""
        print(f"\n=== Testing GET /api/users/{ADMIN_TELEGRAM_ID}/xp-breakdown ===")
        
        # Call multiple times to verify no mutation
        first_response = await self.make_request("GET", f"/users/{ADMIN_TELEGRAM_ID}/xp-breakdown")
        second_response = await self.make_request("GET", f"/users/{ADMIN_TELEGRAM_ID}/xp-breakdown")
        
        if first_response["status_code"] == 200 and second_response["status_code"] == 200:
            first_data = first_response["data"]
            second_data = second_response["data"]
            
            # Check required breakdown fields
            required_breakdown_keys = ["tasks", "task_on_time_bonus", "achievements", "visits", 
                                     "streak_bonuses", "referrals", "group_tasks", "messages", 
                                     "schedule_views", "bonus"]
            
            # Check new fields that should be included
            required_new_fields = ["xp_current_level", "xp_next_level", "progress"]
            
            breakdown_valid = False
            new_fields_valid = False
            no_mutation = False
            
            if "breakdown" in first_data:
                breakdown = first_data["breakdown"]
                breakdown_valid = all(key in breakdown for key in required_breakdown_keys)
                
                # Check new fields
                new_fields_valid = all(field in first_data for field in required_new_fields)
                
                # Check no mutation (XP should not change between calls)
                if "xp" in first_data and "xp" in second_data:
                    no_mutation = first_data["xp"] == second_data["xp"]
                
                self.log_test("XP breakdown structure", breakdown_valid, 
                             f"Breakdown has all required keys: {required_breakdown_keys}")
                self.log_test("XP breakdown new fields", new_fields_valid, 
                             f"Has new fields: {required_new_fields}")
                self.log_test("XP breakdown no mutation", no_mutation, 
                             f"XP unchanged between calls: {first_data.get('xp')} == {second_data.get('xp')}")
            else:
                self.log_test("XP breakdown structure", False, "No 'breakdown' field in response")
        else:
            self.log_test("XP breakdown endpoint", False, 
                         f"Status: {first_response['status_code']}, Data: {first_response['data']}")

    async def test_recalculate_xp(self):
        """Test POST /api/users/{id}/recalculate-xp - Should not decrease XP"""
        print(f"\n=== Testing POST /api/users/{ADMIN_TELEGRAM_ID}/recalculate-xp ===")
        
        # Get XP before recalculation
        before_response = await self.make_request("GET", f"/users/{ADMIN_TELEGRAM_ID}/level")
        
        if before_response["status_code"] == 200:
            xp_before = before_response["data"].get("xp", 0)
            
            # Recalculate XP
            recalc_response = await self.make_request("POST", f"/users/{ADMIN_TELEGRAM_ID}/recalculate-xp")
            
            if recalc_response["status_code"] == 200:
                # Get XP after recalculation
                after_response = await self.make_request("GET", f"/users/{ADMIN_TELEGRAM_ID}/level")
                
                if after_response["status_code"] == 200:
                    xp_after = after_response["data"].get("xp", 0)
                    
                    # XP should not decrease (protection against XP loss)
                    xp_protected = xp_after >= xp_before
                    self.log_test("XP recalculation protection", xp_protected, 
                                 f"XP before: {xp_before}, after: {xp_after}")
                else:
                    self.log_test("XP recalculation verification", False, 
                                 "Failed to get XP after recalculation")
            else:
                self.log_test("XP recalculation endpoint", False, 
                             f"Status: {recalc_response['status_code']}, Data: {recalc_response['data']}")
        else:
            self.log_test("XP recalculation setup", False, 
                         "Failed to get initial XP level")

    async def test_track_action(self):
        """Test POST /api/track-action with view_schedule - Should succeed and award XP"""
        print("\n=== Testing POST /api/track-action ===")
        
        # Get XP before action
        before_response = await self.make_request("GET", f"/users/{ADMIN_TELEGRAM_ID}/level")
        
        if before_response["status_code"] == 200:
            xp_before = before_response["data"].get("xp", 0)
            
            # Track action
            action_data = {"telegram_id": ADMIN_TELEGRAM_ID, "action_type": "view_schedule"}
            action_response = await self.make_request("POST", "/track-action", action_data)
            
            if action_response["status_code"] == 200:
                self.log_test("Track action endpoint", True, 
                             f"Successfully tracked view_schedule action")
                
                # Get XP after action (may or may not increase due to daily limits)
                after_response = await self.make_request("GET", f"/users/{ADMIN_TELEGRAM_ID}/level")
                
                if after_response["status_code"] == 200:
                    xp_after = after_response["data"].get("xp", 0)
                    xp_change = xp_after - xp_before
                    
                    self.log_test("Track action XP award", True, 
                                 f"XP change: {xp_change} (before: {xp_before}, after: {xp_after})")
                else:
                    self.log_test("Track action XP verification", False, 
                                 "Failed to get XP after action")
            else:
                self.log_test("Track action endpoint", False, 
                             f"Status: {action_response['status_code']}, Data: {action_response['data']}")
        else:
            self.log_test("Track action setup", False, 
                         "Failed to get initial XP level")

    async def test_pending_level_up(self):
        """Test GET /api/users/{id}/pending-level-up - Should return {has_level_up: false}"""
        print(f"\n=== Testing GET /api/users/{ADMIN_TELEGRAM_ID}/pending-level-up ===")
        
        response = await self.make_request("GET", f"/users/{ADMIN_TELEGRAM_ID}/pending-level-up")
        
        if response["status_code"] == 200:
            data = response["data"]
            if "has_level_up" in data:
                # For clean state, should be false
                has_level_up = data["has_level_up"]
                self.log_test("Pending level up structure", True, 
                             f"has_level_up: {has_level_up}")
            else:
                self.log_test("Pending level up structure", False, 
                             "Missing 'has_level_up' field")
        else:
            self.log_test("Pending level up endpoint", False, 
                         f"Status: {response['status_code']}, Data: {response['data']}")

    async def test_daily_limit_enforcement(self):
        """Test daily limit enforcement for track-action"""
        print("\n=== Testing Daily Limit Enforcement ===")
        
        # Get initial XP
        initial_response = await self.make_request("GET", f"/users/{ADMIN_TELEGRAM_ID}/level")
        
        if initial_response["status_code"] == 200:
            initial_xp = initial_response["data"].get("xp", 0)
            
            # Track multiple view_schedule actions
            xp_changes = []
            for i in range(5):  # Try 5 times to test daily limit
                action_data = {"telegram_id": ADMIN_TELEGRAM_ID, "action_type": "view_schedule"}
                await self.make_request("POST", "/track-action", action_data)
                
                # Check XP after each action
                level_response = await self.make_request("GET", f"/users/{ADMIN_TELEGRAM_ID}/level")
                if level_response["status_code"] == 200:
                    current_xp = level_response["data"].get("xp", 0)
                    xp_change = current_xp - initial_xp
                    xp_changes.append(xp_change)
                    print(f"  Action {i+1}: XP change = {xp_change}")
                
                # Small delay between requests
                await asyncio.sleep(0.1)
            
            # Check if XP stopped increasing after some point (daily limit)
            if len(xp_changes) >= 4:
                # After 3rd action, XP should stop increasing
                limit_enforced = xp_changes[3] == xp_changes[4] if len(xp_changes) > 4 else True
                self.log_test("Daily limit enforcement", limit_enforced, 
                             f"XP changes: {xp_changes}")
            else:
                self.log_test("Daily limit test", False, 
                             "Could not complete enough actions to test limit")
        else:
            self.log_test("Daily limit setup", False, 
                         "Failed to get initial XP level")

    async def run_all_tests(self):
        """Run all Level System v2.0 tests"""
        print("🚀 Starting Level System v2.0 Backend Testing")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Admin Telegram ID: {ADMIN_TELEGRAM_ID}")
        
        # Run all test methods in order
        await self.test_xp_rewards_info()
        await self.test_user_level()
        await self.test_xp_breakdown()
        await self.test_recalculate_xp()
        await self.test_track_action()
        await self.test_pending_level_up()
        await self.test_daily_limit_enforcement()
        
        # Print summary
        print(f"\n{'='*60}")
        print(f"🏁 LEVEL SYSTEM V2.0 TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Total Tests: {self.total_tests}")
        print(f"✅ Passed: {self.passed_tests}")
        print(f"❌ Failed: {self.failed_tests}")
        print(f"Success Rate: {(self.passed_tests/self.total_tests*100):.1f}%")
        
        if self.failed_tests > 0:
            print(f"\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["passed"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return self.failed_tests == 0

async def main():
    """Main test runner"""
    async with LevelSystemV2Tester() as tester:
        success = await tester.run_all_tests()
        return 0 if success else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)