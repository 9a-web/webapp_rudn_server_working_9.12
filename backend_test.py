#!/usr/bin/env python3
"""
Backend Testing Script for RUDN Schedule Level System v3.0
Tests Level System v3.0 endpoints including new features:
- Stars system (1-5)
- Level titles
- XP history endpoint
- Daily XP endpoint
- Legend tier verification
- Referral XP increase (50→100)
"""

import asyncio
import aiohttp
import json
import sys
from typing import Dict, Any, List

# Backend URL - using the configured external URL from frontend/.env
BACKEND_URL = "http://localhost:8001/api"

# Admin IDs (allowed)
ADMIN_IDS = [765963392, 1311283832]
# Non-admin ID (should get 403)
NON_ADMIN_ID = 123456

class LevelSystemTester:
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

    async def test_user_level_endpoint(self):
        """Test GET /api/users/{id}/level - should return stars and title"""
        print("\n=== Testing GET /api/users/{id}/level ===")
        
        test_user_id = 123456
        response = await self.make_request("GET", f"/users/{test_user_id}/level")
        
        if response["status_code"] == 200 and response["data"].get("status") == "ok":
            data = response["data"]
            required_fields = ["level", "tier", "xp", "xp_current_level", "xp_next_level", 
                             "xp_in_level", "xp_needed", "progress", "stars", "title"]
            
            missing_fields = [field for field in required_fields if field not in data]
            
            if not missing_fields:
                stars = data.get("stars", 0)
                title = data.get("title", "")
                level = data.get("level", 0)
                tier = data.get("tier", "")
                
                # Validate stars are 1-5
                stars_valid = 1 <= stars <= 5
                # Validate title is not empty
                title_valid = len(title) > 0
                
                self.log_test("User level endpoint - all fields", True, 
                            f"Level {level}, Tier {tier}, Stars {stars}, Title '{title}'")
                self.log_test("User level endpoint - stars range", stars_valid, 
                            f"Stars: {stars} (should be 1-5)")
                self.log_test("User level endpoint - title present", title_valid, 
                            f"Title: '{title}'")
            else:
                self.log_test("User level endpoint - missing fields", False, 
                            f"Missing: {missing_fields}")
        else:
            self.log_test("User level endpoint", False, 
                        f"Status: {response['status_code']}, Data: {response['data']}")

    async def test_xp_rewards_info_endpoint(self):
        """Test GET /api/xp-rewards-info - referral XP should be 100"""
        print("\n=== Testing GET /api/xp-rewards-info ===")
        
        response = await self.make_request("GET", "/xp-rewards-info")
        
        if response["status_code"] == 200:
            data = response["data"]
            rewards = data.get("rewards", [])
            
            if rewards:
                # Find referral reward
                referral_reward = None
                for reward in rewards:
                    if reward.get("action") == "referral":
                        referral_reward = reward
                        break
                
                if referral_reward:
                    referral_xp = referral_reward.get("xp", 0)
                    self.log_test("XP rewards info - referral XP", referral_xp == 100, 
                                f"Referral XP: {referral_xp} (should be 100)")
                    
                    # Check all required fields
                    required_fields = ["action", "xp", "label", "emoji", "limit"]
                    all_rewards_valid = all(
                        all(field in reward for field in required_fields) 
                        for reward in rewards
                    )
                    self.log_test("XP rewards info - all fields", all_rewards_valid, 
                                f"Found {len(rewards)} rewards with all required fields")
                else:
                    self.log_test("XP rewards info - referral not found", False, 
                                "Referral reward not found in rewards list")
            else:
                self.log_test("XP rewards info - empty rewards", False, 
                            "No rewards returned")
        else:
            self.log_test("XP rewards info endpoint", False, 
                        f"Status: {response['status_code']}, Data: {response['data']}")

    async def test_xp_breakdown_endpoint(self):
        """Test GET /api/users/{id}/xp-breakdown - should include new fields"""
        print("\n=== Testing GET /api/users/{id}/xp-breakdown ===")
        
        test_user_id = 123456
        response = await self.make_request("GET", f"/users/{test_user_id}/xp-breakdown")
        
        if response["status_code"] == 200 and response["data"].get("status") == "ok":
            data = response["data"]
            required_fields = ["xp", "breakdown", "level", "tier", "xp_current_level", 
                             "xp_next_level", "xp_in_level", "xp_needed", "progress", 
                             "stars", "title"]
            
            missing_fields = [field for field in required_fields if field not in data]
            
            if not missing_fields:
                breakdown = data.get("breakdown", {})
                expected_breakdown_keys = ["tasks", "task_on_time_bonus", "achievements", 
                                         "visits", "streak_bonuses", "referrals", 
                                         "group_tasks", "messages", "schedule_views", "bonus"]
                
                missing_breakdown = [key for key in expected_breakdown_keys if key not in breakdown]
                
                if not missing_breakdown:
                    stars = data.get("stars", 0)
                    title = data.get("title", "")
                    xp_in_level = data.get("xp_in_level", 0)
                    xp_needed = data.get("xp_needed", 0)
                    
                    self.log_test("XP breakdown - all fields", True, 
                                f"Stars: {stars}, Title: '{title}', XP in level: {xp_in_level}")
                    self.log_test("XP breakdown - breakdown structure", True, 
                                f"All {len(expected_breakdown_keys)} breakdown categories present")
                else:
                    self.log_test("XP breakdown - missing breakdown keys", False, 
                                f"Missing breakdown keys: {missing_breakdown}")
            else:
                self.log_test("XP breakdown - missing fields", False, 
                            f"Missing: {missing_fields}")
        else:
            self.log_test("XP breakdown endpoint", False, 
                        f"Status: {response['status_code']}, Data: {response['data']}")

    async def test_xp_history_endpoint(self):
        """Test GET /api/users/{id}/xp-history - NEW ENDPOINT"""
        print("\n=== Testing GET /api/users/{id}/xp-history ===")
        
        test_user_id = 123456
        days = 14
        response = await self.make_request("GET", f"/users/{test_user_id}/xp-history?days={days}")
        
        if response["status_code"] == 200 and response["data"].get("status") == "ok":
            data = response["data"]
            required_fields = ["history", "days"]
            
            missing_fields = [field for field in required_fields if field not in data]
            
            if not missing_fields:
                history = data.get("history", [])
                returned_days = data.get("days", 0)
                
                # Validate history structure
                history_valid = True
                if history:
                    for entry in history:
                        required_entry_fields = ["date", "xp_earned", "events_count", "total_xp"]
                        if not all(field in entry for field in required_entry_fields):
                            history_valid = False
                            break
                
                self.log_test("XP history endpoint - structure", True, 
                            f"Days: {returned_days}, History entries: {len(history)}")
                self.log_test("XP history endpoint - entry format", history_valid, 
                            "All history entries have required fields")
            else:
                self.log_test("XP history endpoint - missing fields", False, 
                            f"Missing: {missing_fields}")
        else:
            self.log_test("XP history endpoint", False, 
                        f"Status: {response['status_code']}, Data: {response['data']}")

    async def test_daily_xp_endpoint(self):
        """Test GET /api/users/{id}/daily-xp - NEW ENDPOINT"""
        print("\n=== Testing GET /api/users/{id}/daily-xp ===")
        
        test_user_id = 123456
        response = await self.make_request("GET", f"/users/{test_user_id}/daily-xp")
        
        if response["status_code"] == 200 and response["data"].get("status") == "ok":
            data = response["data"]
            required_fields = ["date", "total_xp_today", "by_action"]
            
            missing_fields = [field for field in required_fields if field not in data]
            
            if not missing_fields:
                date = data.get("date", "")
                total_xp_today = data.get("total_xp_today", 0)
                by_action = data.get("by_action", {})
                
                # Validate date format (YYYY-MM-DD)
                date_valid = len(date) == 10 and date.count("-") == 2
                
                self.log_test("Daily XP endpoint - structure", True, 
                            f"Date: {date}, Total XP today: {total_xp_today}")
                self.log_test("Daily XP endpoint - date format", date_valid, 
                            f"Date format: {date}")
                self.log_test("Daily XP endpoint - by_action", isinstance(by_action, dict), 
                            f"By action breakdown: {len(by_action)} categories")
            else:
                self.log_test("Daily XP endpoint - missing fields", False, 
                            f"Missing: {missing_fields}")
        else:
            self.log_test("Daily XP endpoint", False, 
                        f"Status: {response['status_code']}, Data: {response['data']}")

    async def test_recalculate_xp_endpoint(self):
        """Test POST /api/users/{id}/recalculate-xp - should include stars, title"""
        print("\n=== Testing POST /api/users/{id}/recalculate-xp ===")
        
        test_user_id = 123456
        response = await self.make_request("POST", f"/users/{test_user_id}/recalculate-xp")
        
        if response["status_code"] == 200 and response["data"].get("status") == "ok":
            data = response["data"]
            required_fields = ["xp", "breakdown", "level", "tier", "xp_current_level", 
                             "xp_next_level", "xp_in_level", "xp_needed", "progress", 
                             "stars", "title"]
            
            missing_fields = [field for field in required_fields if field not in data]
            
            if not missing_fields:
                stars = data.get("stars", 0)
                title = data.get("title", "")
                level = data.get("level", 0)
                tier = data.get("tier", "")
                
                self.log_test("Recalculate XP - all fields", True, 
                            f"Level {level}, Tier {tier}, Stars {stars}, Title '{title}'")
                self.log_test("Recalculate XP - stars range", 1 <= stars <= 5, 
                            f"Stars: {stars}")
                self.log_test("Recalculate XP - title present", len(title) > 0, 
                            f"Title: '{title}'")
            else:
                self.log_test("Recalculate XP - missing fields", False, 
                            f"Missing: {missing_fields}")
        else:
            self.log_test("Recalculate XP endpoint", False, 
                        f"Status: {response['status_code']}, Data: {response['data']}")

    async def test_legend_tier_verification(self):
        """Test Legend tier with admin ID 765963392 and 92000 XP"""
        print("\n=== Testing Legend Tier Verification ===")
        
        admin_id = 765963392
        legend_xp = 92000
        
        # Set XP to legend tier threshold
        data = {"telegram_id": admin_id, "amount": legend_xp}
        response = await self.make_request("POST", "/dev/set-xp", data)
        
        if response["status_code"] == 200:
            # Get level info to verify legend tier
            response = await self.make_request("GET", f"/users/{admin_id}/level")
            
            if response["status_code"] == 200 and response["data"].get("status") == "ok":
                data = response["data"]
                tier = data.get("tier", "")
                level = data.get("level", 0)
                stars = data.get("stars", 0)
                title = data.get("title", "")
                
                legend_tier_correct = tier == "legend"
                level_30_or_higher = level >= 30
                stars_valid = 1 <= stars <= 5
                title_legend = "легенда" in title.lower() or "legend" in title.lower()
                
                self.log_test("Legend tier - tier correct", legend_tier_correct, 
                            f"Tier: {tier} (should be 'legend')")
                self.log_test("Legend tier - level 30+", level_30_or_higher, 
                            f"Level: {level} (should be 30+)")
                self.log_test("Legend tier - stars", stars_valid, 
                            f"Stars: {stars}")
                self.log_test("Legend tier - title", title_legend, 
                            f"Title: '{title}'")
            else:
                self.log_test("Legend tier verification", False, 
                            f"Failed to get level after setting XP: {response['data']}")
        else:
            self.log_test("Legend tier verification", False, 
                        f"Failed to set XP: {response['data']}")

    async def test_stars_system_verification(self):
        """Test Stars system with different XP levels"""
        print("\n=== Testing Stars System Verification ===")
        
        admin_id = 765963392
        
        # Test different XP levels and expected stars
        test_cases = [
            {"xp": 500, "expected_level": 4, "expected_tier": "base", "expected_stars_range": (4, 5)},
            {"xp": 1500, "expected_level": 7, "expected_tier": "medium", "expected_stars_range": (2, 4)},
            {"xp": 5000, "expected_level": 12, "expected_tier": "rare", "expected_stars_range": (1, 3)},
        ]
        
        for i, test_case in enumerate(test_cases):
            xp = test_case["xp"]
            expected_level = test_case["expected_level"]
            expected_tier = test_case["expected_tier"]
            expected_stars_range = test_case["expected_stars_range"]
            
            # Set XP
            data = {"telegram_id": admin_id, "amount": xp}
            response = await self.make_request("POST", "/dev/set-xp", data)
            
            if response["status_code"] == 200:
                # Get level info
                response = await self.make_request("GET", f"/users/{admin_id}/level")
                
                if response["status_code"] == 200 and response["data"].get("status") == "ok":
                    data = response["data"]
                    level = data.get("level", 0)
                    tier = data.get("tier", "")
                    stars = data.get("stars", 0)
                    
                    level_correct = level == expected_level
                    tier_correct = tier == expected_tier
                    stars_in_range = expected_stars_range[0] <= stars <= expected_stars_range[1]
                    
                    self.log_test(f"Stars test {i+1} - level", level_correct, 
                                f"XP {xp} → Level {level} (expected {expected_level})")
                    self.log_test(f"Stars test {i+1} - tier", tier_correct, 
                                f"XP {xp} → Tier {tier} (expected {expected_tier})")
                    self.log_test(f"Stars test {i+1} - stars", stars_in_range, 
                                f"XP {xp} → Stars {stars} (expected {expected_stars_range[0]}-{expected_stars_range[1]})")
                else:
                    self.log_test(f"Stars test {i+1}", False, 
                                f"Failed to get level for XP {xp}")
            else:
                self.log_test(f"Stars test {i+1}", False, 
                            f"Failed to set XP to {xp}")

    async def run_all_tests(self):
        """Run all Level System v3.0 tests"""
        print("🚀 Starting RUDN Schedule Level System v3.0 Backend Testing")
        print(f"Backend URL: {BACKEND_URL}")
        
        # Run all test methods
        await self.test_user_level_endpoint()
        await self.test_xp_rewards_info_endpoint()
        await self.test_xp_breakdown_endpoint()
        await self.test_xp_history_endpoint()
        await self.test_daily_xp_endpoint()
        await self.test_recalculate_xp_endpoint()
        await self.test_legend_tier_verification()
        await self.test_stars_system_verification()
        
        # Print summary
        print(f"\n{'='*60}")
        print(f"🏁 LEVEL SYSTEM v3.0 TEST SUMMARY")
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
    async with LevelSystemTester() as tester:
        success = await tester.run_all_tests()
        return 0 if success else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)