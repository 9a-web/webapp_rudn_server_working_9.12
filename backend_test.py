#!/usr/bin/env python3
"""
Backend API Testing for RUDN WebApp Profile Module
Tests all profile endpoints including avatar, privacy, and graffiti functionality
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://rudn-deploy.preview.emergentagent.com/api"
TEST_USER_ID = 999999
OTHER_USER_ID = 888888
NON_EXISTENT_USER_ID = 111111111

class ProfileAPITester:
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
            return response
        except Exception as e:
            self.log(f"Request failed: {e}", "ERROR")
            raise
            
    def test_create_test_user(self) -> bool:
        """Create test user for profile testing"""
        self.log("=== Creating Test User ===")
        
        user_data = {
            "telegram_id": TEST_USER_ID,
            "first_name": "Test",
            "last_name": "User", 
            "username": "testuser",
            "group_id": "test_group",
            "group_name": "Test Group",
            "facultet_id": "test_faculty",
            "level_id": "test_level",
            "kurs": "1",
            "form_code": "test_form"
        }
        
        response = self.make_request("POST", "/user-settings", json=user_data)
        
        if response.status_code in [200, 201]:
            self.log("✅ Test user created successfully")
            return True
        else:
            self.log(f"❌ Failed to create test user: {response.status_code} - {response.text}", "ERROR")
            return False
            
    def test_avatar_endpoints(self) -> Dict[str, bool]:
        """Test avatar CRUD operations"""
        self.log("=== Testing Avatar Endpoints ===")
        results = {}
        
        # Test 1: Save custom avatar
        self.log("Testing PUT /profile/{telegram_id}/avatar")
        avatar_data = {
            "avatar_data": "data:image/png;base64,iVBORw0KGgo=",
            "requester_telegram_id": TEST_USER_ID
        }
        
        response = self.make_request("PUT", f"/profile/{TEST_USER_ID}/avatar", json=avatar_data)
        results["save_avatar"] = response.status_code == 200
        
        if results["save_avatar"]:
            self.log("✅ Avatar saved successfully")
        else:
            self.log(f"❌ Failed to save avatar: {response.status_code} - {response.text}", "ERROR")
            
        # Test 2: Get custom avatar
        self.log("Testing GET /profile/{telegram_id}/avatar")
        response = self.make_request("GET", f"/profile/{TEST_USER_ID}/avatar")
        results["get_avatar"] = response.status_code == 200
        
        if results["get_avatar"]:
            data = response.json()
            if data.get("avatar_data") == "data:image/png;base64,iVBORw0KGgo=" and data.get("avatar_mode") == "custom":
                self.log("✅ Avatar retrieved correctly with custom mode")
            else:
                self.log(f"❌ Avatar data mismatch: {data}", "ERROR")
                results["get_avatar"] = False
        else:
            self.log(f"❌ Failed to get avatar: {response.status_code} - {response.text}", "ERROR")
            
        # Test 3: Delete custom avatar
        self.log("Testing DELETE /profile/{telegram_id}/avatar")
        response = self.make_request("DELETE", f"/profile/{TEST_USER_ID}/avatar")
        results["delete_avatar"] = response.status_code == 200
        
        if results["delete_avatar"]:
            self.log("✅ Avatar deleted successfully")
            
            # Verify avatar is reset to telegram mode
            response = self.make_request("GET", f"/profile/{TEST_USER_ID}/avatar")
            if response.status_code == 200:
                data = response.json()
                if data.get("avatar_data") == "" and data.get("avatar_mode") == "telegram":
                    self.log("✅ Avatar reset to telegram mode correctly")
                else:
                    self.log(f"❌ Avatar not reset properly: {data}", "ERROR")
                    results["delete_avatar"] = False
        else:
            self.log(f"❌ Failed to delete avatar: {response.status_code} - {response.text}", "ERROR")
            
        # Test 4: Avatar for non-existent user should return 404
        self.log("Testing avatar for non-existent user")
        response = self.make_request("GET", f"/profile/{NON_EXISTENT_USER_ID}/avatar")
        results["avatar_404"] = response.status_code == 404
        
        if results["avatar_404"]:
            self.log("✅ Non-existent user avatar returns 404 correctly")
        else:
            self.log(f"❌ Expected 404 for non-existent user, got {response.status_code}", "ERROR")
            
        return results
        
    def test_privacy_leak_fix(self) -> Dict[str, bool]:
        """Test privacy settings leak fix"""
        self.log("=== Testing Privacy Leak Fix ===")
        results = {}
        
        # Test 1: Owner viewing own profile should see privacy settings
        self.log("Testing owner viewing own profile")
        response = self.make_request("GET", f"/profile/{TEST_USER_ID}?viewer_telegram_id={TEST_USER_ID}")
        results["owner_sees_privacy"] = False
        
        if response.status_code == 200:
            data = response.json()
            if data.get("privacy") is not None:
                self.log("✅ Owner can see privacy settings")
                results["owner_sees_privacy"] = True
            else:
                self.log("❌ Owner cannot see privacy settings", "ERROR")
        else:
            self.log(f"❌ Failed to get profile: {response.status_code} - {response.text}", "ERROR")
            
        # Test 2: Anonymous viewer should NOT see privacy settings
        self.log("Testing anonymous viewer")
        response = self.make_request("GET", f"/profile/{TEST_USER_ID}")
        results["anonymous_no_privacy"] = False
        
        if response.status_code == 200:
            data = response.json()
            if data.get("privacy") is None:
                self.log("✅ Anonymous viewer cannot see privacy settings")
                results["anonymous_no_privacy"] = True
            else:
                self.log("❌ Anonymous viewer can see privacy settings (PRIVACY LEAK!)", "ERROR")
        else:
            self.log(f"❌ Failed to get profile: {response.status_code} - {response.text}", "ERROR")
            
        # Test 3: Different user should NOT see privacy settings
        self.log("Testing different user viewer")
        response = self.make_request("GET", f"/profile/{TEST_USER_ID}?viewer_telegram_id={OTHER_USER_ID}")
        results["other_user_no_privacy"] = False
        
        if response.status_code == 200:
            data = response.json()
            if data.get("privacy") is None:
                self.log("✅ Different user cannot see privacy settings")
                results["other_user_no_privacy"] = True
            else:
                self.log("❌ Different user can see privacy settings (PRIVACY LEAK!)", "ERROR")
        else:
            self.log(f"❌ Failed to get profile: {response.status_code} - {response.text}", "ERROR")
            
        return results
        
    def test_graffiti_authorization(self) -> Dict[str, bool]:
        """Test graffiti authorization"""
        self.log("=== Testing Graffiti Authorization ===")
        results = {}
        
        # Test 1: Owner can save graffiti
        self.log("Testing owner saving graffiti")
        graffiti_data = {
            "graffiti_data": "test_graffiti_data",
            "requester_telegram_id": TEST_USER_ID
        }
        
        response = self.make_request("PUT", f"/profile/{TEST_USER_ID}/graffiti", json=graffiti_data)
        results["owner_can_save"] = response.status_code == 200
        
        if results["owner_can_save"]:
            self.log("✅ Owner can save graffiti")
        else:
            self.log(f"❌ Owner cannot save graffiti: {response.status_code} - {response.text}", "ERROR")
            
        # Test 2: Different user cannot save graffiti (should get 403)
        self.log("Testing different user saving graffiti")
        graffiti_data = {
            "graffiti_data": "malicious_graffiti",
            "requester_telegram_id": OTHER_USER_ID
        }
        
        response = self.make_request("PUT", f"/profile/{TEST_USER_ID}/graffiti", json=graffiti_data)
        results["other_user_forbidden"] = response.status_code == 403
        
        if results["other_user_forbidden"]:
            self.log("✅ Different user correctly forbidden from saving graffiti")
        else:
            self.log(f"❌ Expected 403 for different user, got {response.status_code}", "ERROR")
            
        return results
        
    def test_privacy_update_nonexistent_user(self) -> Dict[str, bool]:
        """Test privacy update with non-existent user"""
        self.log("=== Testing Privacy Update for Non-existent User ===")
        results = {}
        
        privacy_data = {
            "show_online_status": False
        }
        
        response = self.make_request("PUT", f"/profile/{NON_EXISTENT_USER_ID}/privacy", json=privacy_data)
        results["nonexistent_user_404"] = response.status_code == 404
        
        if results["nonexistent_user_404"]:
            self.log("✅ Privacy update for non-existent user returns 404")
        else:
            self.log(f"❌ Expected 404 for non-existent user, got {response.status_code}", "ERROR")
            
        return results
        
    def test_avatar_persistence(self) -> Dict[str, bool]:
        """Test avatar persistence through save/get/delete cycle"""
        self.log("=== Testing Avatar Persistence ===")
        results = {}
        
        # Step 1: Save avatar
        self.log("Step 1: Saving avatar")
        avatar_data = {
            "avatar_data": "data:image/png;base64,iVBORw0KGgo=",
            "requester_telegram_id": TEST_USER_ID
        }
        
        response = self.make_request("PUT", f"/profile/{TEST_USER_ID}/avatar", json=avatar_data)
        results["save_step"] = response.status_code == 200
        
        # Step 2: Verify saved avatar
        self.log("Step 2: Verifying saved avatar")
        response = self.make_request("GET", f"/profile/{TEST_USER_ID}/avatar")
        results["get_step"] = False
        
        if response.status_code == 200:
            data = response.json()
            if (data.get("avatar_data") == "data:image/png;base64,iVBORw0KGgo=" and 
                data.get("avatar_mode") == "custom"):
                self.log("✅ Avatar persisted correctly")
                results["get_step"] = True
            else:
                self.log(f"❌ Avatar data mismatch: {data}", "ERROR")
        else:
            self.log(f"❌ Failed to get avatar: {response.status_code}", "ERROR")
            
        # Step 3: Delete avatar
        self.log("Step 3: Deleting avatar")
        response = self.make_request("DELETE", f"/profile/{TEST_USER_ID}/avatar")
        results["delete_step"] = response.status_code == 200
        
        # Step 4: Verify deletion
        self.log("Step 4: Verifying deletion")
        response = self.make_request("GET", f"/profile/{TEST_USER_ID}/avatar")
        results["verify_delete"] = False
        
        if response.status_code == 200:
            data = response.json()
            if (data.get("avatar_data") == "" and 
                data.get("avatar_mode") == "telegram"):
                self.log("✅ Avatar deletion verified")
                results["verify_delete"] = True
            else:
                self.log(f"❌ Avatar not properly deleted: {data}", "ERROR")
        else:
            self.log(f"❌ Failed to verify deletion: {response.status_code}", "ERROR")
            
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
        """Run all profile module tests"""
        self.log("🚀 Starting Profile Module Backend Tests")
        self.log(f"Base URL: {self.base_url}")
        
        all_results = {}
        
        # Setup
        if not self.test_create_test_user():
            self.log("❌ Failed to create test user, aborting tests", "ERROR")
            return {"error": "Failed to create test user"}
            
        try:
            # Run all test suites
            all_results["avatar_tests"] = self.test_avatar_endpoints()
            all_results["privacy_leak_tests"] = self.test_privacy_leak_fix()
            all_results["graffiti_auth_tests"] = self.test_graffiti_authorization()
            all_results["privacy_nonexistent_tests"] = self.test_privacy_update_nonexistent_user()
            all_results["avatar_persistence_tests"] = self.test_avatar_persistence()
            
        finally:
            # Cleanup
            self.cleanup_test_user()
            
        return all_results
        
    def print_summary(self, results: Dict[str, Any]):
        """Print test results summary"""
        self.log("\n" + "="*60)
        self.log("📊 TEST RESULTS SUMMARY")
        self.log("="*60)
        
        if "error" in results:
            self.log(f"❌ CRITICAL ERROR: {results['error']}", "ERROR")
            return
            
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
        else:
            failed = total_tests - passed_tests
            self.log(f"⚠️  {failed} TESTS FAILED", "ERROR")
            
        return passed_tests == total_tests

def main():
    """Main test execution"""
    tester = ProfileAPITester(BASE_URL)
    
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