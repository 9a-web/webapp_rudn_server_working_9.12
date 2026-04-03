#!/usr/bin/env python3
"""
Profile Endpoints Testing for RUDN Schedule Telegram Web App
Tests all profile endpoints as specified in the review request
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Optional

# Configuration - using local backend URL for testing
BASE_URL = "http://localhost:8001/api"
TEST_USER_ID = 123456789
OTHER_USER_ID = 999999
NON_EXISTENT_USER_ID = 999999999

class ProfileEndpointsTester:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        
    def log(self, message: str, level: str = "INFO"):
        """Log test messages"""
        print(f"[{level}] {message}")
        
    def make_request(self, method: str, endpoint: str, **kwargs) -> requests.Response:
        """Make HTTP request with error handling"""
        url = f"{self.base_url}{endpoint}"
        try:
            response = self.session.request(method, url, **kwargs)
            self.log(f"{method} {endpoint} -> {response.status_code}")
            if response.status_code >= 400:
                self.log(f"Response body: {response.text[:500]}", "DEBUG")
            return response
        except Exception as e:
            self.log(f"Request failed: {e}", "ERROR")
            raise
            
    def test_create_test_user(self) -> bool:
        """Create test user for profile testing"""
        self.log("=== Creating Test User ===")
        
        user_data = {
            "telegram_id": TEST_USER_ID,
            "username": "testuser",
            "first_name": "Test",
            "last_name": "User",
            "group_id": "test-group-1",
            "group_name": "ИВТ-101",
            "facultet_id": "test-faculty",
            "level_id": "test-level",
            "kurs": "1",
            "form_code": "test-form"
        }
        
        response = self.make_request("POST", "/user-settings", json=user_data)
        
        if response.status_code in [200, 201]:
            self.log("✅ Test user created successfully")
            return True
        else:
            self.log(f"❌ Failed to create test user: {response.status_code} - {response.text}", "ERROR")
            return False
            
    def test_profile_endpoints(self) -> Dict[str, bool]:
        """Test all profile endpoints as specified in review request"""
        self.log("=== Testing Profile Endpoints ===")
        results = {}
        
        # Test 1: GET /api/profile/{telegram_id}?viewer_telegram_id={id} — Should return full profile with privacy settings (owner view)
        self.log("Test 1: GET profile with viewer_telegram_id (owner view)")
        response = self.make_request("GET", f"/profile/{TEST_USER_ID}?viewer_telegram_id={TEST_USER_ID}")
        results["owner_profile_view"] = response.status_code == 200
        
        if results["owner_profile_view"]:
            data = response.json()
            # Verify that privacy settings are included for owner
            if data.get("privacy") is not None:
                self.log("✅ Owner can see privacy settings")
                # Verify new fields are present
                required_fields = ["visit_streak_current", "visit_streak_max", "avatar_mode", "has_custom_avatar"]
                missing_fields = [field for field in required_fields if field not in data]
                if not missing_fields:
                    self.log("✅ All new fields present in owner profile view")
                else:
                    self.log(f"❌ Missing fields in owner profile: {missing_fields}", "ERROR")
                    results["owner_profile_view"] = False
                
                # Verify that friends_count, achievements_count are NOT filtered for owner
                if "friends_count" in data and "achievements_count" in data:
                    self.log("✅ Owner sees unfiltered data (friends_count, achievements_count)")
                else:
                    self.log("❌ Owner profile missing friends_count or achievements_count", "ERROR")
                    results["owner_profile_view"] = False
            else:
                self.log("❌ Owner cannot see privacy settings", "ERROR")
                results["owner_profile_view"] = False
        else:
            self.log(f"❌ Failed to get owner profile: {response.status_code} - {response.text}", "ERROR")
            
        # Test 2: GET /api/profile/{telegram_id} — Without viewer should return profile without privacy field
        self.log("Test 2: GET profile without viewer_telegram_id")
        response = self.make_request("GET", f"/profile/{TEST_USER_ID}")
        results["anonymous_profile_view"] = response.status_code == 200
        
        if results["anonymous_profile_view"]:
            data = response.json()
            if data.get("privacy") is None:
                self.log("✅ Anonymous viewer cannot see privacy settings")
            else:
                self.log("❌ Anonymous viewer can see privacy settings (PRIVACY LEAK!)", "ERROR")
                results["anonymous_profile_view"] = False
        else:
            self.log(f"❌ Failed to get anonymous profile: {response.status_code} - {response.text}", "ERROR")
            
        # Test 3: PUT /api/profile/{telegram_id}/privacy?requester_telegram_id={id} — Update privacy settings
        self.log("Test 3: PUT privacy settings with correct requester")
        privacy_data = {"show_online_status": False}
        response = self.make_request("PUT", f"/profile/{TEST_USER_ID}/privacy?requester_telegram_id={TEST_USER_ID}", json=privacy_data)
        results["privacy_update_success"] = response.status_code == 200
        
        if results["privacy_update_success"]:
            self.log("✅ Privacy settings updated successfully")
        else:
            self.log(f"❌ Failed to update privacy settings: {response.status_code} - {response.text}", "ERROR")
            
        # Test 4: PUT /api/profile/{telegram_id}/privacy?requester_telegram_id={wrong_id} — Wrong requester should return 403
        self.log("Test 4: PUT privacy settings with wrong requester")
        response = self.make_request("PUT", f"/profile/{TEST_USER_ID}/privacy?requester_telegram_id={OTHER_USER_ID}", json=privacy_data)
        results["privacy_update_forbidden"] = response.status_code == 403
        
        if results["privacy_update_forbidden"]:
            self.log("✅ Wrong requester correctly forbidden from updating privacy")
        else:
            self.log(f"❌ Expected 403 for wrong requester, got {response.status_code}", "ERROR")
            
        # Test 5: GET /api/profile/{telegram_id}/privacy — Should return current privacy settings
        self.log("Test 5: GET privacy settings")
        response = self.make_request("GET", f"/profile/{TEST_USER_ID}/privacy")
        results["privacy_get"] = response.status_code == 200
        
        if results["privacy_get"]:
            data = response.json()
            if data.get("show_online_status") == False:  # Should reflect our update from test 3
                self.log("✅ Privacy settings retrieved correctly")
            else:
                self.log(f"❌ Privacy settings not updated correctly: {data}", "ERROR")
                results["privacy_get"] = False
        else:
            self.log(f"❌ Failed to get privacy settings: {response.status_code} - {response.text}", "ERROR")
            
        # Test 6: PUT /api/profile/{telegram_id}/graffiti — Save graffiti with requester_telegram_id
        self.log("Test 6: PUT graffiti with correct requester")
        graffiti_data = {
            "graffiti_data": "test-data",
            "requester_telegram_id": TEST_USER_ID
        }
        response = self.make_request("PUT", f"/profile/{TEST_USER_ID}/graffiti", json=graffiti_data)
        results["graffiti_save_success"] = response.status_code == 200
        
        if results["graffiti_save_success"]:
            self.log("✅ Graffiti saved successfully")
        else:
            self.log(f"❌ Failed to save graffiti: {response.status_code} - {response.text}", "ERROR")
            
        # Test 7: PUT /api/profile/{telegram_id}/graffiti — Save graffiti WITHOUT requester_telegram_id should return 400
        self.log("Test 7: PUT graffiti without requester_telegram_id")
        graffiti_data_no_requester = {"graffiti_data": "test"}
        response = self.make_request("PUT", f"/profile/{TEST_USER_ID}/graffiti", json=graffiti_data_no_requester)
        results["graffiti_no_requester"] = response.status_code == 400
        
        if results["graffiti_no_requester"]:
            self.log("✅ Graffiti save correctly requires requester_telegram_id")
        else:
            self.log(f"❌ Expected 400 for missing requester_telegram_id, got {response.status_code}", "ERROR")
            
        # Test 8: PUT /api/profile/{telegram_id}/graffiti — Wrong requester should return 403
        self.log("Test 8: PUT graffiti with wrong requester")
        graffiti_data_wrong_requester = {
            "graffiti_data": "test",
            "requester_telegram_id": OTHER_USER_ID
        }
        response = self.make_request("PUT", f"/profile/{TEST_USER_ID}/graffiti", json=graffiti_data_wrong_requester)
        results["graffiti_wrong_requester"] = response.status_code == 403
        
        if results["graffiti_wrong_requester"]:
            self.log("✅ Wrong requester correctly forbidden from saving graffiti")
        else:
            self.log(f"❌ Expected 403 for wrong requester, got {response.status_code}", "ERROR")
            
        # Test 9: DELETE /api/profile/{telegram_id}/avatar?requester_telegram_id={id} — Should succeed
        self.log("Test 9: DELETE avatar with correct requester")
        response = self.make_request("DELETE", f"/profile/{TEST_USER_ID}/avatar?requester_telegram_id={TEST_USER_ID}")
        results["avatar_delete_success"] = response.status_code == 200
        
        if results["avatar_delete_success"]:
            self.log("✅ Avatar deleted successfully")
        else:
            self.log(f"❌ Failed to delete avatar: {response.status_code} - {response.text}", "ERROR")
            
        # Test 10: DELETE /api/profile/{telegram_id}/avatar?requester_telegram_id={wrong_id} — Wrong requester should return 403
        self.log("Test 10: DELETE avatar with wrong requester")
        response = self.make_request("DELETE", f"/profile/{TEST_USER_ID}/avatar?requester_telegram_id={OTHER_USER_ID}")
        results["avatar_delete_forbidden"] = response.status_code == 403
        
        if results["avatar_delete_forbidden"]:
            self.log("✅ Wrong requester correctly forbidden from deleting avatar")
        else:
            self.log(f"❌ Expected 403 for wrong requester, got {response.status_code}", "ERROR")
            
        # Test 11: GET /api/profile/{telegram_id}/qr — Should return QR data
        self.log("Test 11: GET profile QR data")
        response = self.make_request("GET", f"/profile/{TEST_USER_ID}/qr")
        results["qr_data"] = response.status_code == 200
        
        if results["qr_data"]:
            data = response.json()
            if "qr_data" in data and "telegram_id" in data:
                self.log("✅ QR data retrieved successfully")
            else:
                self.log(f"❌ QR data missing required fields: {data}", "ERROR")
                results["qr_data"] = False
        else:
            self.log(f"❌ Failed to get QR data: {response.status_code} - {response.text}", "ERROR")
            
        # Test 12: GET /api/profile/{non_existent_id} — Non-existing user should return 404
        self.log("Test 12: GET profile for non-existent user")
        response = self.make_request("GET", f"/profile/{NON_EXISTENT_USER_ID}")
        results["non_existent_user"] = response.status_code == 404
        
        if results["non_existent_user"]:
            self.log("✅ Non-existent user correctly returns 404")
        else:
            self.log(f"❌ Expected 404 for non-existent user, got {response.status_code}", "ERROR")
            
        return results
        
    def cleanup_test_user(self) -> bool:
        """Clean up test user"""
        self.log("=== Cleaning Up Test User ===")
        
        response = self.make_request("DELETE", f"/user-settings/{TEST_USER_ID}")
        
        if response.status_code == 200:
            self.log("✅ Test user cleaned up successfully")
            return True
        else:
            self.log(f"❌ Failed to clean up test user: {response.status_code} - {response.text}", "ERROR")
            return False
            
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all profile endpoint tests"""
        self.log("🚀 Starting Profile Endpoints Backend Tests")
        self.log(f"Base URL: {self.base_url}")
        
        all_results = {}
        
        # Setup
        if not self.test_create_test_user():
            self.log("❌ Failed to create test user, aborting tests", "ERROR")
            return {"error": "Failed to create test user"}
            
        try:
            # Run all test suites
            all_results["profile_endpoint_tests"] = self.test_profile_endpoints()
            
        finally:
            # Cleanup
            self.cleanup_test_user()
            
        return all_results
        
    def print_summary(self, results: Dict[str, Any]):
        """Print test results summary"""
        self.log("\n" + "="*60)
        self.log("📊 PROFILE ENDPOINTS TEST RESULTS SUMMARY")
        self.log("="*60)
        
        if "error" in results:
            self.log(f"❌ CRITICAL ERROR: {results['error']}", "ERROR")
            return False
            
        total_tests = 0
        passed_tests = 0
        
        for suite_name, suite_results in results.items():
            if isinstance(suite_results, dict):
                self.log(f"\n📋 {suite_name.upper()}:")
                for test_name, passed in suite_results.items():
                    status = "✅ PASS" if passed else "❌ FAIL"
                    self.log(f"  {test_name}: {status}")
                    total_tests += 1
                    if passed:
                        passed_tests += 1
                        
        self.log(f"\n🎯 OVERALL RESULTS: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            self.log("🎉 ALL TESTS PASSED!", "SUCCESS")
            return True
        else:
            failed = total_tests - passed_tests
            self.log(f"⚠️  {failed} TESTS FAILED", "ERROR")
            return False

def main():
    """Main test execution"""
    tester = ProfileEndpointsTester(BASE_URL)
    
    try:
        results = tester.run_all_tests()
        success = tester.print_summary(results)
        
        # Exit with appropriate code
        sys.exit(0 if success else 1)
        
    except Exception as e:
        tester.log(f"💥 CRITICAL ERROR: {e}", "ERROR")
        sys.exit(1)

if __name__ == "__main__":
    main()