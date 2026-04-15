#!/usr/bin/env python3
"""
RUDN Schedule Backend API Testing
Tests the specific bug fixes for the Profile Level System.
"""

import requests
import json
import sys
from typing import Dict, Any

# Backend URL - test local first, then external
BACKEND_URL = "http://localhost:8001/api"

# Test user ID (admin user as specified)
TEST_USER_ID = 765963392

class RUDNScheduleTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        self.results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def make_request(self, method: str, endpoint: str, params: Dict[str, Any] = None) -> tuple:
        """Make HTTP request and return (response, success, error_msg)"""
        try:
            url = f"{BACKEND_URL}{endpoint}"
            if method.upper() == "GET":
                response = self.session.get(url, params=params)
            else:
                return None, False, f"Unsupported method: {method}"
                
            return response, True, ""
        except Exception as e:
            return None, False, str(e)
    
    def test_stars_calculation_fix(self):
        """Test 1: Stars calculation fix in level endpoint"""
        print("\n=== Testing Stars Calculation Fix ===")
        
        response, success, error = self.make_request("GET", f"/users/{TEST_USER_ID}/level")
        if not success:
            self.log_test("Stars calculation - API call", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            try:
                data = response.json()
                
                # Check if stars field exists
                if "stars" not in data:
                    self.log_test("Stars calculation - stars field exists", False, "Missing 'stars' field in response")
                    return
                
                stars = data["stars"]
                
                # Check if stars is in valid range (1-5)
                if isinstance(stars, int) and 1 <= stars <= 5:
                    self.log_test("Stars calculation - valid range", True, f"Stars value: {stars} (valid range 1-5)")
                else:
                    self.log_test("Stars calculation - valid range", False, f"Stars value: {stars} (should be 1-5)")
                
                # Log full response for debugging
                print(f"    Full level response: {json.dumps(data, indent=2)}")
                
            except json.JSONDecodeError:
                self.log_test("Stars calculation - JSON parsing", False, "Invalid JSON response")
        else:
            self.log_test("Stars calculation - API call", False, f"Status {response.status_code}: {response.text}")
    
    def test_xp_rewards_info_achievements(self):
        """Test 2: XP Rewards Info with achievements"""
        print("\n=== Testing XP Rewards Info with Achievements ===")
        
        response, success, error = self.make_request("GET", "/xp-rewards-info")
        if not success:
            self.log_test("XP Rewards Info - API call", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            try:
                data = response.json()
                
                # Look for achievement_earned action in rewards array
                achievement_found = False
                if "rewards" in data:
                    for reward in data["rewards"]:
                        if reward.get("action") == "achievement_earned":
                            achievement_found = True
                            
                            # Check if xp field exists and is string "5–50"
                            if "xp" in reward:
                                xp_value = reward["xp"]
                                if xp_value == "5–50":
                                    self.log_test("XP Rewards Info - achievement_earned XP", True, f"XP value: '{xp_value}' (correct string format)")
                                else:
                                    self.log_test("XP Rewards Info - achievement_earned XP", False, f"XP value: '{xp_value}' (should be '5–50')")
                            else:
                                self.log_test("XP Rewards Info - achievement_earned XP", False, "Missing 'xp' field in achievement_earned")
                            break
                
                if not achievement_found:
                    self.log_test("XP Rewards Info - achievement_earned exists", False, "Missing 'achievement_earned' action in response")
                
                # Log full response for debugging
                print(f"    Full XP rewards response: {json.dumps(data, indent=2)}")
                
            except json.JSONDecodeError:
                self.log_test("XP Rewards Info - JSON parsing", False, "Invalid JSON response")
        else:
            self.log_test("XP Rewards Info - API call", False, f"Status {response.status_code}: {response.text}")
    
    def test_xp_breakdown_endpoint(self):
        """Test 3: XP Breakdown endpoint"""
        print("\n=== Testing XP Breakdown Endpoint ===")
        
        response, success, error = self.make_request("GET", f"/users/{TEST_USER_ID}/xp-breakdown")
        if not success:
            self.log_test("XP Breakdown - API call", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            try:
                data = response.json()
                
                # Check if breakdown object exists
                if "breakdown" not in data:
                    self.log_test("XP Breakdown - breakdown object exists", False, "Missing 'breakdown' object in response")
                    return
                
                breakdown = data["breakdown"]
                
                # Check for required fields in breakdown
                required_fields = ["tasks", "task_on_time_bonus", "group_tasks"]
                missing_fields = []
                
                for field in required_fields:
                    if field not in breakdown:
                        missing_fields.append(field)
                
                if missing_fields:
                    self.log_test("XP Breakdown - required fields", False, f"Missing fields: {missing_fields}")
                else:
                    self.log_test("XP Breakdown - required fields", True, f"All required fields present: {required_fields}")
                
                # Log breakdown details
                print(f"    Breakdown details: {json.dumps(breakdown, indent=2)}")
                
            except json.JSONDecodeError:
                self.log_test("XP Breakdown - JSON parsing", False, "Invalid JSON response")
        else:
            self.log_test("XP Breakdown - API call", False, f"Status {response.status_code}: {response.text}")
    
    def test_level_endpoint_basics(self):
        """Test 4: Level endpoint basic fields"""
        print("\n=== Testing Level Endpoint Basic Fields ===")
        
        response, success, error = self.make_request("GET", f"/users/{TEST_USER_ID}/level")
        if not success:
            self.log_test("Level Endpoint - API call", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            try:
                data = response.json()
                
                # Check for required fields
                required_fields = ["level", "tier", "stars", "title", "xp", "progress", "xp_current_level", "xp_next_level"]
                missing_fields = []
                present_fields = []
                
                for field in required_fields:
                    if field not in data:
                        missing_fields.append(field)
                    else:
                        present_fields.append(field)
                
                if missing_fields:
                    self.log_test("Level Endpoint - required fields", False, f"Missing fields: {missing_fields}")
                else:
                    self.log_test("Level Endpoint - required fields", True, f"All required fields present: {required_fields}")
                
                # Log field values for debugging
                for field in present_fields:
                    print(f"    {field}: {data[field]}")
                
            except json.JSONDecodeError:
                self.log_test("Level Endpoint - JSON parsing", False, "Invalid JSON response")
        else:
            self.log_test("Level Endpoint - API call", False, f"Status {response.status_code}: {response.text}")
    
    def test_daily_xp_endpoint(self):
        """Test 5: Daily XP endpoint"""
        print("\n=== Testing Daily XP Endpoint ===")
        
        response, success, error = self.make_request("GET", f"/users/{TEST_USER_ID}/daily-xp")
        if not success:
            self.log_test("Daily XP - API call", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            try:
                data = response.json()
                
                # Check if response contains daily progress data
                if data:
                    self.log_test("Daily XP - returns data", True, "Daily XP endpoint returns data")
                    print(f"    Daily XP response: {json.dumps(data, indent=2)}")
                else:
                    self.log_test("Daily XP - returns data", False, "Daily XP endpoint returns empty response")
                
            except json.JSONDecodeError:
                self.log_test("Daily XP - JSON parsing", False, "Invalid JSON response")
        else:
            self.log_test("Daily XP - API call", False, f"Status {response.status_code}: {response.text}")
    
    def test_profile_endpoint(self):
        """Test 6: Profile endpoint with level fields"""
        print("\n=== Testing Profile Endpoint ===")
        
        params = {"viewer_telegram_id": TEST_USER_ID}
        response, success, error = self.make_request("GET", f"/profile/{TEST_USER_ID}", params)
        if not success:
            self.log_test("Profile Endpoint - API call", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            try:
                data = response.json()
                
                # Check for required level-related fields
                required_fields = ["level", "tier", "stars", "level_title", "xp_progress"]
                missing_fields = []
                present_fields = []
                
                for field in required_fields:
                    if field not in data:
                        missing_fields.append(field)
                    else:
                        present_fields.append(field)
                
                if missing_fields:
                    self.log_test("Profile Endpoint - level fields", False, f"Missing fields: {missing_fields}")
                else:
                    self.log_test("Profile Endpoint - level fields", True, f"All level fields present: {required_fields}")
                
                # Log field values for debugging
                for field in present_fields:
                    print(f"    {field}: {data[field]}")
                
            except json.JSONDecodeError:
                self.log_test("Profile Endpoint - JSON parsing", False, "Invalid JSON response")
        else:
            self.log_test("Profile Endpoint - API call", False, f"Status {response.status_code}: {response.text}")
    
    def run_all_tests(self):
        """Run all RUDN Schedule tests"""
        print("🧪 Starting RUDN Schedule API Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test User ID: {TEST_USER_ID}")
        
        # Test all bug fixes
        self.test_stars_calculation_fix()
        self.test_xp_rewards_info_achievements()
        self.test_xp_breakdown_endpoint()
        self.test_level_endpoint_basics()
        self.test_daily_xp_endpoint()
        self.test_profile_endpoint()
        
        # Summary
        print("\n=== Test Summary ===")
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        
        if failed_tests > 0:
            print("\nFailed Tests:")
            for result in self.results:
                if not result["success"]:
                    print(f"  ❌ {result['test']}: {result['details']}")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = RUDNScheduleTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)