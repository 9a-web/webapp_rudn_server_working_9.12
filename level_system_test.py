#!/usr/bin/env python3
"""
RUDN Level System v4.0 Backend Testing
Tests the redesigned level system endpoints as specified in the review request.
"""

import requests
import json
import sys
from typing import Dict, Any

# Backend URL - using the production URL from frontend/.env
BACKEND_URL = "https://rudn-webapp-2.preview.emergentagent.com/api"

# Test user ID from the review request
TEST_USER_ID = 765963392

class LevelSystemTester:
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
        
    def make_request(self, method: str, endpoint: str, data: Dict[Any, Any] = None) -> tuple:
        """Make HTTP request and return (response, success, error_msg)"""
        try:
            url = f"{BACKEND_URL}{endpoint}"
            if method.upper() == "GET":
                response = self.session.get(url)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data)
            else:
                return None, False, f"Unsupported method: {method}"
                
            return response, True, ""
        except Exception as e:
            return None, False, str(e)
    
    def test_user_level_endpoint(self):
        """Test GET /api/users/{user_id}/level endpoint"""
        print("\n=== Testing User Level Endpoint ===")
        
        response, success, error = self.make_request("GET", f"/users/{TEST_USER_ID}/level")
        if not success:
            self.log_test("GET user level", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            try:
                data = response.json()
                
                # Check required fields exist
                required_fields = ['level', 'tier', 'stars', 'title', 'xp', 'progress']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test("GET user level - required fields", False, f"Missing fields: {missing_fields}")
                    return
                
                # Check stars is between 1-4 (NOT 5, max is 4 now)
                stars = data.get('stars')
                if not isinstance(stars, int) or stars < 1 or stars > 4:
                    self.log_test("GET user level - stars validation", False, f"Stars should be 1-4, got: {stars}")
                    return
                
                # Check tier is one of: base, medium, rare, premium, legend
                tier = data.get('tier')
                valid_tiers = ['base', 'medium', 'rare', 'premium', 'legend']
                if tier not in valid_tiers:
                    self.log_test("GET user level - tier validation", False, f"Invalid tier: {tier}, expected one of {valid_tiers}")
                    return
                
                # Check other field types
                level = data.get('level')
                if not isinstance(level, int) or level < 1:
                    self.log_test("GET user level - level validation", False, f"Level should be positive integer, got: {level}")
                    return
                
                xp = data.get('xp')
                if not isinstance(xp, (int, float)) or xp < 0:
                    self.log_test("GET user level - xp validation", False, f"XP should be non-negative number, got: {xp}")
                    return
                
                progress = data.get('progress')
                if not isinstance(progress, (int, float)) or progress < 0 or progress > 1:
                    self.log_test("GET user level - progress validation", False, f"Progress should be 0-1, got: {progress}")
                    return
                
                title = data.get('title')
                if not isinstance(title, str) or not title:
                    self.log_test("GET user level - title validation", False, f"Title should be non-empty string, got: {title}")
                    return
                
                self.log_test("GET user level", True, f"Level: {level}, Tier: {tier}, Stars: {stars}, XP: {xp}, Title: {title}")
                
            except json.JSONDecodeError:
                self.log_test("GET user level", False, f"Invalid JSON response: {response.text}")
        else:
            self.log_test("GET user level", False, f"Status {response.status_code}: {response.text}")
    
    def test_xp_rewards_info_endpoint(self):
        """Test GET /api/xp-rewards-info endpoint"""
        print("\n=== Testing XP Rewards Info Endpoint ===")
        
        response, success, error = self.make_request("GET", "/xp-rewards-info")
        if not success:
            self.log_test("GET xp-rewards-info", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            try:
                data = response.json()
                
                # Check that response has rewards array
                if 'rewards' not in data:
                    self.log_test("GET xp-rewards-info - structure", False, "Missing 'rewards' field")
                    return
                
                rewards = data['rewards']
                if not isinstance(rewards, list):
                    self.log_test("GET xp-rewards-info - structure", False, "Rewards should be an array")
                    return
                
                if len(rewards) == 0:
                    self.log_test("GET xp-rewards-info - structure", False, "Rewards array is empty")
                    return
                
                # Check each reward object has required fields
                required_fields = ['action', 'xp', 'label', 'limit']
                achievement_earned_found = False
                
                for i, reward in enumerate(rewards):
                    missing_fields = [field for field in required_fields if field not in reward]
                    if missing_fields:
                        self.log_test("GET xp-rewards-info - reward fields", False, f"Reward {i} missing fields: {missing_fields}")
                        return
                    
                    # Check for achievement_earned with xp as string "5–50"
                    if reward.get('action') == 'achievement_earned':
                        achievement_earned_found = True
                        xp_value = reward.get('xp')
                        if xp_value != "5–50":
                            self.log_test("GET xp-rewards-info - achievement_earned xp", False, f"achievement_earned should have xp='5–50', got: {xp_value}")
                            return
                
                if not achievement_earned_found:
                    self.log_test("GET xp-rewards-info - achievement_earned", False, "achievement_earned reward not found")
                    return
                
                self.log_test("GET xp-rewards-info", True, f"Found {len(rewards)} rewards with correct structure")
                
            except json.JSONDecodeError:
                self.log_test("GET xp-rewards-info", False, f"Invalid JSON response: {response.text}")
        else:
            self.log_test("GET xp-rewards-info", False, f"Status {response.status_code}: {response.text}")
    
    def test_xp_breakdown_endpoint(self):
        """Test GET /api/users/{user_id}/xp-breakdown endpoint"""
        print("\n=== Testing XP Breakdown Endpoint ===")
        
        response, success, error = self.make_request("GET", f"/users/{TEST_USER_ID}/xp-breakdown")
        if not success:
            self.log_test("GET xp-breakdown", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            try:
                data = response.json()
                
                # Check that response has breakdown object
                if 'breakdown' not in data:
                    self.log_test("GET xp-breakdown - structure", False, "Missing 'breakdown' field")
                    return
                
                breakdown = data['breakdown']
                if not isinstance(breakdown, dict):
                    self.log_test("GET xp-breakdown - structure", False, "Breakdown should be an object")
                    return
                
                # Check for common breakdown fields
                expected_fields = ['tasks', 'achievements', 'visits', 'referrals']
                found_fields = [field for field in expected_fields if field in breakdown]
                
                if len(found_fields) == 0:
                    self.log_test("GET xp-breakdown - fields", False, f"No expected breakdown fields found. Available: {list(breakdown.keys())}")
                    return
                
                # Check that breakdown values are numbers
                for field, value in breakdown.items():
                    if not isinstance(value, (int, float)):
                        self.log_test("GET xp-breakdown - field types", False, f"Field '{field}' should be a number, got: {type(value)}")
                        return
                
                self.log_test("GET xp-breakdown", True, f"Breakdown has {len(breakdown)} fields: {list(breakdown.keys())}")
                
            except json.JSONDecodeError:
                self.log_test("GET xp-breakdown", False, f"Invalid JSON response: {response.text}")
        else:
            self.log_test("GET xp-breakdown", False, f"Status {response.status_code}: {response.text}")
    
    def test_daily_xp_endpoint(self):
        """Test GET /api/users/{user_id}/daily-xp endpoint"""
        print("\n=== Testing Daily XP Endpoint ===")
        
        response, success, error = self.make_request("GET", f"/users/{TEST_USER_ID}/daily-xp")
        if not success:
            self.log_test("GET daily-xp", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            try:
                data = response.json()
                
                # Check that response has daily progress data
                expected_fields = ['date', 'total_xp_today']
                missing_fields = [field for field in expected_fields if field not in data]
                
                if missing_fields:
                    self.log_test("GET daily-xp - required fields", False, f"Missing fields: {missing_fields}")
                    return
                
                # Check field types
                date = data.get('date')
                if not isinstance(date, str):
                    self.log_test("GET daily-xp - date type", False, f"Date should be string, got: {type(date)}")
                    return
                
                total_xp_today = data.get('total_xp_today')
                if not isinstance(total_xp_today, (int, float)):
                    self.log_test("GET daily-xp - total_xp_today type", False, f"total_xp_today should be number, got: {type(total_xp_today)}")
                    return
                
                # Check optional by_action field if present
                if 'by_action' in data:
                    by_action = data['by_action']
                    if not isinstance(by_action, dict):
                        self.log_test("GET daily-xp - by_action type", False, f"by_action should be object, got: {type(by_action)}")
                        return
                
                self.log_test("GET daily-xp", True, f"Date: {date}, Total XP today: {total_xp_today}")
                
            except json.JSONDecodeError:
                self.log_test("GET daily-xp", False, f"Invalid JSON response: {response.text}")
        else:
            self.log_test("GET daily-xp", False, f"Status {response.status_code}: {response.text}")
    
    def run_all_tests(self):
        """Run all level system tests"""
        print("🧪 Starting RUDN Level System v4.0 Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test User ID: {TEST_USER_ID}")
        
        # Test all endpoints
        self.test_user_level_endpoint()
        self.test_xp_rewards_info_endpoint()
        self.test_xp_breakdown_endpoint()
        self.test_daily_xp_endpoint()
        
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
    tester = LevelSystemTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)