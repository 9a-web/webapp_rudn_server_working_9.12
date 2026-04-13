#!/usr/bin/env python3
"""
Backend API Testing for RUDN Schedule Level System
Tests the new Level System and Profile endpoints
"""

import asyncio
import aiohttp
import json
import sys
from typing import Dict, Any, Optional

# Backend URL - using localhost since service is running locally
BACKEND_URL = "http://localhost:8001"

class LevelSystemTester:
    def __init__(self):
        self.session = None
        self.test_results = []
        self.test_user_id = 123456  # Non-existent user for testing
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_test(self, test_name: str, success: bool, details: str, response_data: Optional[Dict] = None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        print(f"   Details: {details}")
        if response_data:
            print(f"   Response: {json.dumps(response_data, indent=2)}")
        print()
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response": response_data
        })
    
    async def test_endpoint(self, method: str, endpoint: str, expected_status: int = 200, 
                          expected_fields: list = None, data: dict = None) -> Dict[str, Any]:
        """Generic endpoint testing method"""
        url = f"{BACKEND_URL}{endpoint}"
        
        try:
            if method.upper() == "GET":
                async with self.session.get(url) as response:
                    status = response.status
                    try:
                        response_data = await response.json()
                    except:
                        response_data = {"error": "Invalid JSON response"}
            elif method.upper() == "POST":
                async with self.session.post(url, json=data) as response:
                    status = response.status
                    try:
                        response_data = await response.json()
                    except:
                        response_data = {"error": "Invalid JSON response"}
            else:
                return {"error": f"Unsupported method: {method}"}
            
            # Check status code
            status_ok = status == expected_status
            
            # Check expected fields if provided
            fields_ok = True
            missing_fields = []
            if expected_fields and isinstance(response_data, dict):
                for field in expected_fields:
                    if field not in response_data:
                        fields_ok = False
                        missing_fields.append(field)
            
            return {
                "status": status,
                "status_ok": status_ok,
                "response_data": response_data,
                "fields_ok": fields_ok,
                "missing_fields": missing_fields,
                "success": status_ok and fields_ok
            }
            
        except Exception as e:
            return {
                "error": str(e),
                "success": False,
                "status": None,
                "response_data": None
            }
    
    async def test_xp_rewards_info(self):
        """Test GET /api/xp-rewards-info endpoint"""
        print("🧪 Testing GET /api/xp-rewards-info")
        
        result = await self.test_endpoint(
            "GET", 
            "/api/xp-rewards-info",
            expected_fields=["rewards"]
        )
        
        if result["success"]:
            response_data = result["response_data"]
            rewards = response_data.get("rewards", [])
            
            # Validate rewards structure
            if isinstance(rewards, list) and len(rewards) > 0:
                # Check first reward has required fields
                first_reward = rewards[0]
                required_reward_fields = ["action", "xp", "label", "emoji", "limit"]
                missing_reward_fields = [f for f in required_reward_fields if f not in first_reward]
                
                if not missing_reward_fields:
                    self.log_test(
                        "GET /api/xp-rewards-info",
                        True,
                        f"Returns valid rewards array with {len(rewards)} items",
                        response_data
                    )
                else:
                    self.log_test(
                        "GET /api/xp-rewards-info",
                        False,
                        f"Reward items missing fields: {missing_reward_fields}",
                        response_data
                    )
            else:
                self.log_test(
                    "GET /api/xp-rewards-info",
                    False,
                    "Rewards array is empty or not a list",
                    response_data
                )
        else:
            self.log_test(
                "GET /api/xp-rewards-info",
                False,
                f"Request failed: {result.get('error', 'Unknown error')}",
                result.get("response_data")
            )
    
    async def test_pending_level_up(self):
        """Test GET /api/users/{id}/pending-level-up endpoint"""
        print(f"🧪 Testing GET /api/users/{self.test_user_id}/pending-level-up")
        
        result = await self.test_endpoint(
            "GET",
            f"/api/users/{self.test_user_id}/pending-level-up",
            expected_fields=["has_level_up"]
        )
        
        if result["success"]:
            response_data = result["response_data"]
            has_level_up = response_data.get("has_level_up")
            
            # For non-existent user, should return has_level_up: false
            if has_level_up is False:
                self.log_test(
                    "GET /api/users/{id}/pending-level-up",
                    True,
                    "Returns has_level_up: false for non-existent user",
                    response_data
                )
            else:
                self.log_test(
                    "GET /api/users/{id}/pending-level-up",
                    False,
                    f"Expected has_level_up: false, got: {has_level_up}",
                    response_data
                )
        else:
            self.log_test(
                "GET /api/users/{id}/pending-level-up",
                False,
                f"Request failed: {result.get('error', 'Unknown error')}",
                result.get("response_data")
            )
    
    async def test_xp_breakdown(self):
        """Test GET /api/users/{id}/xp-breakdown endpoint"""
        print(f"🧪 Testing GET /api/users/{self.test_user_id}/xp-breakdown")
        
        result = await self.test_endpoint(
            "GET",
            f"/api/users/{self.test_user_id}/xp-breakdown",
            expected_fields=["status", "xp", "breakdown", "level", "tier"]
        )
        
        if result["success"]:
            response_data = result["response_data"]
            
            # Validate response structure
            status = response_data.get("status")
            xp = response_data.get("xp")
            breakdown = response_data.get("breakdown")
            level = response_data.get("level")
            tier = response_data.get("tier")
            
            validation_errors = []
            
            if status != "ok":
                validation_errors.append(f"status should be 'ok', got: {status}")
            
            if not isinstance(xp, int) or xp < 0:
                validation_errors.append(f"xp should be non-negative integer, got: {xp}")
            
            if not isinstance(breakdown, dict):
                validation_errors.append(f"breakdown should be object, got: {type(breakdown)}")
            else:
                # Check breakdown has expected keys
                expected_breakdown_keys = ["tasks", "achievements", "visits", "streak_bonuses", "referrals", "group_tasks", "messages"]
                missing_breakdown_keys = [k for k in expected_breakdown_keys if k not in breakdown]
                if missing_breakdown_keys:
                    validation_errors.append(f"breakdown missing keys: {missing_breakdown_keys}")
            
            if not isinstance(level, int) or level < 1:
                validation_errors.append(f"level should be positive integer, got: {level}")
            
            if not isinstance(tier, str) or tier not in ["base", "medium", "rare", "premium"]:
                validation_errors.append(f"tier should be valid tier string, got: {tier}")
            
            if not validation_errors:
                self.log_test(
                    "GET /api/users/{id}/xp-breakdown",
                    True,
                    "Returns valid XP breakdown with correct structure",
                    response_data
                )
            else:
                self.log_test(
                    "GET /api/users/{id}/xp-breakdown",
                    False,
                    f"Validation errors: {'; '.join(validation_errors)}",
                    response_data
                )
        else:
            self.log_test(
                "GET /api/users/{id}/xp-breakdown",
                False,
                f"Request failed: {result.get('error', 'Unknown error')}",
                result.get("response_data")
            )
    
    async def test_user_level(self):
        """Test GET /api/users/{id}/level endpoint (existing)"""
        print(f"🧪 Testing GET /api/users/{self.test_user_id}/level")
        
        result = await self.test_endpoint(
            "GET",
            f"/api/users/{self.test_user_id}/level",
            expected_fields=["status"]
        )
        
        if result["success"]:
            response_data = result["response_data"]
            status = response_data.get("status")
            
            if status == "ok":
                # Should have level info fields
                level_fields = ["level", "tier", "xp", "xp_current_level", "xp_next_level", "progress"]
                missing_level_fields = [f for f in level_fields if f not in response_data]
                
                if not missing_level_fields:
                    self.log_test(
                        "GET /api/users/{id}/level",
                        True,
                        "Returns valid level info with all required fields",
                        response_data
                    )
                else:
                    self.log_test(
                        "GET /api/users/{id}/level",
                        False,
                        f"Missing level fields: {missing_level_fields}",
                        response_data
                    )
            else:
                self.log_test(
                    "GET /api/users/{id}/level",
                    False,
                    f"Expected status: 'ok', got: {status}",
                    response_data
                )
        else:
            self.log_test(
                "GET /api/users/{id}/level",
                False,
                f"Request failed: {result.get('error', 'Unknown error')}",
                result.get("response_data")
            )
    
    async def test_recalculate_xp(self):
        """Test POST /api/users/{id}/recalculate-xp endpoint"""
        print(f"🧪 Testing POST /api/users/{self.test_user_id}/recalculate-xp")
        
        result = await self.test_endpoint(
            "POST",
            f"/api/users/{self.test_user_id}/recalculate-xp",
            expected_fields=["status"]
        )
        
        if result["success"]:
            response_data = result["response_data"]
            status = response_data.get("status")
            
            if status == "ok":
                # Should have recalculated XP data
                expected_fields = ["telegram_id", "xp", "breakdown", "level", "tier"]
                missing_fields = [f for f in expected_fields if f not in response_data]
                
                if not missing_fields:
                    self.log_test(
                        "POST /api/users/{id}/recalculate-xp",
                        True,
                        "Returns recalculated XP data with all required fields",
                        response_data
                    )
                else:
                    self.log_test(
                        "POST /api/users/{id}/recalculate-xp",
                        False,
                        f"Missing fields in recalculated data: {missing_fields}",
                        response_data
                    )
            else:
                self.log_test(
                    "POST /api/users/{id}/recalculate-xp",
                    False,
                    f"Expected status: 'ok', got: {status}",
                    response_data
                )
        else:
            self.log_test(
                "POST /api/users/{id}/recalculate-xp",
                False,
                f"Request failed: {result.get('error', 'Unknown error')}",
                result.get("response_data")
            )
    
    async def run_all_tests(self):
        """Run all Level System endpoint tests"""
        print("🚀 Starting Level System Backend API Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test User ID: {self.test_user_id}")
        print("=" * 60)
        
        # Test all endpoints
        await self.test_xp_rewards_info()
        await self.test_pending_level_up()
        await self.test_xp_breakdown()
        await self.test_user_level()
        await self.test_recalculate_xp()
        
        # Summary
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return {
            "total": total_tests,
            "passed": passed_tests,
            "failed": failed_tests,
            "success_rate": (passed_tests/total_tests)*100,
            "results": self.test_results
        }

async def main():
    """Main test runner"""
    async with LevelSystemTester() as tester:
        summary = await tester.run_all_tests()
        
        # Exit with error code if tests failed
        if summary["failed"] > 0:
            sys.exit(1)
        else:
            print("\n🎉 All tests passed!")
            sys.exit(0)

if __name__ == "__main__":
    asyncio.run(main())