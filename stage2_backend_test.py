#!/usr/bin/env python3
"""
Stage 2 Backend API Testing for /api/u/{uid}/* endpoints and bug fixes
Tests the new public profile endpoints and bug fixes as specified in the review request.
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Optional

# Backend URL from frontend/.env
BACKEND_URL = "https://rudn-server-3.preview.emergentagent.com/api"

# Test data - existing user in database
TEST_UID = "777000111"
TEST_TELEGRAM_ID = 7777001
TEST_USER_NAME = "Иван Петров"
TEST_USERNAME = "ivan_p"

class Stage2Tester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.results = []
        self.email_user_token = None  # For BUG-2 testing
        
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
        
    def make_request(self, method: str, endpoint: str, data: Dict[Any, Any] = None, 
                    headers: Dict[str, str] = None, params: Dict[str, Any] = None) -> tuple:
        """Make HTTP request and return (response, success, error_msg)"""
        try:
            url = f"{BACKEND_URL}{endpoint}"
            request_headers = self.session.headers.copy()
            if headers:
                request_headers.update(headers)
                
            if method.upper() == "GET":
                response = self.session.get(url, headers=request_headers, params=params)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data, headers=request_headers, params=params)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, headers=request_headers, params=params)
            else:
                return None, False, f"Unsupported method: {method}"
                
            return response, True, ""
        except Exception as e:
            return None, False, str(e)
    
    def test_uid_resolve_endpoint(self):
        """Test 1: GET /api/u/{uid}/resolve"""
        print("\n=== Test 1: GET /api/u/{uid}/resolve ===")
        
        # Test valid UID
        response, success, error = self.make_request("GET", f"/u/{TEST_UID}/resolve")
        if not success:
            self.log_test("GET /u/{uid}/resolve - valid UID", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            data = response.json()
            expected_fields = ["uid", "telegram_id", "display_name", "username", "has_telegram", "auth_providers"]
            
            # Check all required fields are present
            missing_fields = [field for field in expected_fields if field not in data]
            if missing_fields:
                self.log_test("GET /u/{uid}/resolve - valid UID", False, f"Missing fields: {missing_fields}")
                return
                
            # Check specific values
            if (data.get("uid") == TEST_UID and 
                data.get("telegram_id") == TEST_TELEGRAM_ID and
                data.get("display_name") == TEST_USER_NAME and
                data.get("username") == TEST_USERNAME and
                data.get("has_telegram") is True and
                "telegram" in data.get("auth_providers", [])):
                self.log_test("GET /u/{uid}/resolve - valid UID", True, f"Correct data returned: {data}")
            else:
                self.log_test("GET /u/{uid}/resolve - valid UID", False, f"Incorrect data: {data}")
        else:
            self.log_test("GET /u/{uid}/resolve - valid UID", False, f"Status {response.status_code}: {response.text}")
    
    def test_uid_profile_endpoint(self):
        """Test 2: GET /api/u/{uid} - public profile"""
        print("\n=== Test 2: GET /api/u/{uid} - Public Profile ===")
        
        # Test valid UID (anonymous)
        response, success, error = self.make_request("GET", f"/u/{TEST_UID}")
        if not success:
            self.log_test("GET /u/{uid} - anonymous", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields for UserProfilePublic
            required_fields = ["uid", "telegram_id", "first_name", "is_online", "created_at"]
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                self.log_test("GET /u/{uid} - anonymous", False, f"Missing fields: {missing_fields}")
                return
                
            # Check specific values
            checks = []
            checks.append(("uid", data.get("uid") == TEST_UID, f"Expected {TEST_UID}, got {data.get('uid')}"))
            checks.append(("telegram_id", data.get("telegram_id") == TEST_TELEGRAM_ID, f"Expected {TEST_TELEGRAM_ID}, got {data.get('telegram_id')}"))
            checks.append(("first_name", data.get("first_name") == "Иван", f"Expected 'Иван', got {data.get('first_name')}"))
            checks.append(("is_online", isinstance(data.get("is_online"), bool), f"is_online should be boolean, got {type(data.get('is_online'))}"))
            checks.append(("created_at", data.get("created_at") is not None, "created_at should not be null"))
            checks.append(("privacy", data.get("privacy") is None, f"privacy should be null for non-owner, got {data.get('privacy')}"))
            checks.append(("friendship_status", data.get("friendship_status") is None, f"friendship_status should be null for anonymous, got {data.get('friendship_status')}"))
            
            failed_checks = [check for check in checks if not check[1]]
            if failed_checks:
                details = "; ".join([check[2] for check in failed_checks])
                self.log_test("GET /u/{uid} - anonymous", False, f"Failed checks: {details}")
            else:
                self.log_test("GET /u/{uid} - anonymous", True, "All required fields correct")
        else:
            self.log_test("GET /u/{uid} - anonymous", False, f"Status {response.status_code}: {response.text}")
    
    def test_uid_not_found(self):
        """Test 3: GET /api/u/000000000 - non-existent UID"""
        print("\n=== Test 3: GET /api/u/000000000 - Non-existent UID ===")
        
        response, success, error = self.make_request("GET", "/u/000000000")
        if not success:
            self.log_test("GET /u/000000000 - not found", False, f"Request failed: {error}")
            return
            
        if response.status_code == 404:
            self.log_test("GET /u/000000000 - not found", True, "Correctly returns 404 for non-existent UID")
        else:
            self.log_test("GET /u/000000000 - not found", False, f"Expected 404, got {response.status_code}: {response.text}")
    
    def test_uid_invalid_format(self):
        """Test 4: GET /api/u/invalid - invalid UID format"""
        print("\n=== Test 4: GET /api/u/invalid - Invalid UID Format ===")
        
        invalid_uids = ["invalid", "abc", "12345", "12345678901"]  # non-numeric, too short, too long
        
        for invalid_uid in invalid_uids:
            response, success, error = self.make_request("GET", f"/u/{invalid_uid}")
            if not success:
                self.log_test(f"GET /u/{invalid_uid} - invalid format", False, f"Request failed: {error}")
                continue
                
            if response.status_code == 404:
                self.log_test(f"GET /u/{invalid_uid} - invalid format", True, f"Correctly returns 404 for invalid UID: {invalid_uid}")
            else:
                self.log_test(f"GET /u/{invalid_uid} - invalid format", False, f"Expected 404 for {invalid_uid}, got {response.status_code}: {response.text}")
    
    def test_uid_share_link(self):
        """Test 5: GET /api/u/{uid}/share-link"""
        print("\n=== Test 5: GET /api/u/{uid}/share-link ===")
        
        response, success, error = self.make_request("GET", f"/u/{TEST_UID}/share-link")
        if not success:
            self.log_test("GET /u/{uid}/share-link - anonymous", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields
            required_fields = ["link", "telegram_link", "public_link", "uid", "display_name"]
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                self.log_test("GET /u/{uid}/share-link - anonymous", False, f"Missing fields: {missing_fields}")
                return
                
            # Check specific values
            checks = []
            checks.append(("uid", data.get("uid") == TEST_UID, f"Expected {TEST_UID}, got {data.get('uid')}"))
            checks.append(("display_name", data.get("display_name") == TEST_USER_NAME, f"Expected {TEST_USER_NAME}, got {data.get('display_name')}"))
            
            # Check link formats
            expected_telegram_link = f"https://t.me/{{bot}}/app?startapp=friend_{TEST_TELEGRAM_ID}"
            expected_public_link = f"https://rudn-server-3.preview.emergentagent.com/u/{TEST_UID}"
            
            # For telegram_link, we just check it contains the friend parameter
            if f"friend_{TEST_TELEGRAM_ID}" in data.get("telegram_link", ""):
                checks.append(("telegram_link", True, "Telegram link format correct"))
            else:
                checks.append(("telegram_link", False, f"Expected telegram link with friend_{TEST_TELEGRAM_ID}, got {data.get('telegram_link')}"))
                
            checks.append(("public_link", data.get("public_link") == expected_public_link, f"Expected {expected_public_link}, got {data.get('public_link')}"))
            
            failed_checks = [check for check in checks if not check[1]]
            if failed_checks:
                details = "; ".join([check[2] for check in failed_checks])
                self.log_test("GET /u/{uid}/share-link - anonymous", False, f"Failed checks: {details}")
            else:
                self.log_test("GET /u/{uid}/share-link - anonymous", True, "All link fields correct")
        else:
            self.log_test("GET /u/{uid}/share-link - anonymous", False, f"Status {response.status_code}: {response.text}")
    
    def test_bug1_share_link_owner(self):
        """Test 6: BUG-1 - Owner with show_in_search=false can get share-link"""
        print("\n=== Test 6: BUG-1 - Share-link for owner with show_in_search=false ===")
        
        # Step a) Set show_in_search=false for the test user
        privacy_data = {"show_in_search": False}
        response, success, error = self.make_request("PUT", f"/profile/{TEST_TELEGRAM_ID}/privacy", 
                                                   privacy_data, params={"requester_telegram_id": TEST_TELEGRAM_ID})
        if not success:
            self.log_test("BUG-1 Step a) Set show_in_search=false", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            self.log_test("BUG-1 Step a) Set show_in_search=false", True, "Privacy setting updated")
        else:
            self.log_test("BUG-1 Step a) Set show_in_search=false", False, f"Status {response.status_code}: {response.text}")
            return
        
        # Step b) Try to get share-link without JWT and without viewer_telegram_id (should be 403)
        response, success, error = self.make_request("GET", f"/profile/{TEST_TELEGRAM_ID}/share-link")
        if not success:
            self.log_test("BUG-1 Step b) Get share-link without viewer (hidden profile)", False, f"Request failed: {error}")
        elif response.status_code == 403:
            self.log_test("BUG-1 Step b) Get share-link without viewer (hidden profile)", True, "Correctly blocked with 403")
        else:
            self.log_test("BUG-1 Step b) Get share-link without viewer (hidden profile)", False, f"Expected 403, got {response.status_code}: {response.text}")
        
        # Step c) Get share-link with viewer_telegram_id as owner (should be 200)
        response, success, error = self.make_request("GET", f"/profile/{TEST_TELEGRAM_ID}/share-link", 
                                                   params={"viewer_telegram_id": TEST_TELEGRAM_ID})
        if not success:
            self.log_test("BUG-1 Step c) Get share-link as owner (hidden profile)", False, f"Request failed: {error}")
        elif response.status_code == 200:
            self.log_test("BUG-1 Step c) Get share-link as owner (hidden profile)", True, "Owner can see own share-link")
        else:
            self.log_test("BUG-1 Step c) Get share-link as owner (hidden profile)", False, f"Expected 200, got {response.status_code}: {response.text}")
        
        # Step d) Restore show_in_search=true
        privacy_data = {"show_in_search": True}
        response, success, error = self.make_request("PUT", f"/profile/{TEST_TELEGRAM_ID}/privacy", 
                                                   privacy_data, params={"requester_telegram_id": TEST_TELEGRAM_ID})
        if response and response.status_code == 200:
            self.log_test("BUG-1 Step d) Restore show_in_search=true", True, "Privacy setting restored")
        else:
            self.log_test("BUG-1 Step d) Restore show_in_search=true", False, "Failed to restore privacy setting")
    
    def register_email_user_for_bug2(self):
        """Register a new email user for BUG-2 testing"""
        timestamp = int(time.time())
        email = f"bug2_{timestamp}@rudn.ru"
        password = "sec12345"
        
        register_data = {
            "email": email,
            "password": password
        }
        
        response, success, error = self.make_request("POST", "/auth/register/email", register_data)
        if not success:
            return None, f"Registration request failed: {error}"
            
        if response.status_code == 201:
            data = response.json()
            token = data.get("access_token")
            if token:
                return token, None
            else:
                return None, f"No access_token in response: {data}"
        else:
            return None, f"Registration failed with status {response.status_code}: {response.text}"
    
    def test_bug2_activity_ping_jwt(self):
        """Test 7: BUG-2 - activity-ping with foreign JWT should return 403"""
        print("\n=== Test 7: BUG-2 - Activity-ping with foreign JWT ===")
        
        # Step a) Register new email user
        token, error = self.register_email_user_for_bug2()
        if error:
            self.log_test("BUG-2 Step a) Register email user", False, error)
            return
        else:
            self.log_test("BUG-2 Step a) Register email user", True, "Email user registered successfully")
            self.email_user_token = token
        
        # Step b) Try to ping TEST_TELEGRAM_ID with the new user's token (should be 403)
        ping_data = {"telegram_id": TEST_TELEGRAM_ID}
        headers = {"Authorization": f"Bearer {token}"}
        
        response, success, error = self.make_request("POST", "/auth/activity-ping", ping_data, headers=headers)
        if not success:
            self.log_test("BUG-2 Step b) Activity-ping with foreign JWT", False, f"Request failed: {error}")
            return
            
        if response.status_code == 403:
            self.log_test("BUG-2 Step b) Activity-ping with foreign JWT", True, "Correctly blocked with 403")
        else:
            self.log_test("BUG-2 Step b) Activity-ping with foreign JWT", False, f"Expected 403, got {response.status_code}: {response.text}")
        
        # Step c) Try without JWT (legacy mode, should be 200)
        response, success, error = self.make_request("POST", "/auth/activity-ping", ping_data)
        if not success:
            self.log_test("BUG-2 Step c) Activity-ping without JWT (legacy)", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            self.log_test("BUG-2 Step c) Activity-ping without JWT (legacy)", True, "Legacy mode works correctly")
        else:
            self.log_test("BUG-2 Step c) Activity-ping without JWT (legacy)", False, f"Expected 200, got {response.status_code}: {response.text}")
    
    def test_bug7_uid_in_profile(self):
        """Test 8: BUG-7 - uid field present in UserProfilePublic"""
        print("\n=== Test 8: BUG-7 - UID field in UserProfilePublic ===")
        
        # Test new /api/u/{uid} endpoint
        response, success, error = self.make_request("GET", f"/u/{TEST_UID}")
        if not success:
            self.log_test("BUG-7 GET /u/{uid} - uid field", False, f"Request failed: {error}")
        elif response.status_code == 200:
            data = response.json()
            if data.get("uid") == TEST_UID:
                self.log_test("BUG-7 GET /u/{uid} - uid field", True, f"UID field present: {data.get('uid')}")
            else:
                self.log_test("BUG-7 GET /u/{uid} - uid field", False, f"Expected uid={TEST_UID}, got {data.get('uid')}")
        else:
            self.log_test("BUG-7 GET /u/{uid} - uid field", False, f"Status {response.status_code}: {response.text}")
        
        # Test legacy /api/profile/{telegram_id} endpoint
        response, success, error = self.make_request("GET", f"/profile/{TEST_TELEGRAM_ID}")
        if not success:
            self.log_test("BUG-7 GET /profile/{telegram_id} - uid field", False, f"Request failed: {error}")
        elif response.status_code == 200:
            data = response.json()
            if data.get("uid") == TEST_UID:
                self.log_test("BUG-7 GET /profile/{telegram_id} - uid field", True, f"UID field present in legacy endpoint: {data.get('uid')}")
            else:
                self.log_test("BUG-7 GET /profile/{telegram_id} - uid field", False, f"Expected uid={TEST_UID}, got {data.get('uid')}")
        else:
            self.log_test("BUG-7 GET /profile/{telegram_id} - uid field", False, f"Status {response.status_code}: {response.text}")
    
    def test_uid_privacy_endpoint(self):
        """Test 9: GET /api/u/{uid}/privacy"""
        print("\n=== Test 9: GET /api/u/{uid}/privacy ===")
        
        # Test without JWT (should be 401)
        response, success, error = self.make_request("GET", f"/u/{TEST_UID}/privacy")
        if not success:
            self.log_test("GET /u/{uid}/privacy - no JWT", False, f"Request failed: {error}")
        elif response.status_code == 401:
            self.log_test("GET /u/{uid}/privacy - no JWT", True, "Correctly returns 401 without JWT")
        else:
            self.log_test("GET /u/{uid}/privacy - no JWT", False, f"Expected 401, got {response.status_code}: {response.text}")
        
        # Test with foreign JWT (should be 403)
        if self.email_user_token:
            headers = {"Authorization": f"Bearer {self.email_user_token}"}
            response, success, error = self.make_request("GET", f"/u/{TEST_UID}/privacy", headers=headers)
            if not success:
                self.log_test("GET /u/{uid}/privacy - foreign JWT", False, f"Request failed: {error}")
            elif response.status_code == 403:
                self.log_test("GET /u/{uid}/privacy - foreign JWT", True, "Correctly returns 403 with foreign JWT")
            else:
                self.log_test("GET /u/{uid}/privacy - foreign JWT", False, f"Expected 403, got {response.status_code}: {response.text}")
    
    def test_uid_view_endpoint(self):
        """Test 10: POST /api/u/{uid}/view"""
        print("\n=== Test 10: POST /api/u/{uid}/view ===")
        
        # Test without JWT (anonymous)
        response, success, error = self.make_request("POST", f"/u/{TEST_UID}/view")
        if not success:
            self.log_test("POST /u/{uid}/view - anonymous", False, f"Request failed: {error}")
        elif response.status_code == 200:
            data = response.json()
            if (data.get("success") is True and 
                data.get("counted") is False and 
                data.get("reason") == "anonymous"):
                self.log_test("POST /u/{uid}/view - anonymous", True, "Anonymous view correctly not counted")
            else:
                self.log_test("POST /u/{uid}/view - anonymous", False, f"Expected success=true, counted=false, reason=anonymous, got: {data}")
        else:
            self.log_test("POST /u/{uid}/view - anonymous", False, f"Status {response.status_code}: {response.text}")
        
        # Test with email user JWT (no telegram_id)
        if self.email_user_token:
            headers = {"Authorization": f"Bearer {self.email_user_token}"}
            response, success, error = self.make_request("POST", f"/u/{TEST_UID}/view", headers=headers)
            if not success:
                self.log_test("POST /u/{uid}/view - email user JWT", False, f"Request failed: {error}")
            elif response.status_code == 200:
                data = response.json()
                if data.get("reason") == "anonymous":
                    self.log_test("POST /u/{uid}/view - email user JWT", True, "Email user (no telegram_id) treated as anonymous")
                else:
                    self.log_test("POST /u/{uid}/view - email user JWT", False, f"Expected reason=anonymous for email user, got: {data}")
            else:
                self.log_test("POST /u/{uid}/view - email user JWT", False, f"Status {response.status_code}: {response.text}")
    
    def test_backward_compatibility(self):
        """Test 11: Backward compatibility"""
        print("\n=== Test 11: Backward Compatibility ===")
        
        # Test legacy profile endpoint with viewer_telegram_id
        response, success, error = self.make_request("GET", f"/profile/{TEST_TELEGRAM_ID}", 
                                                   params={"viewer_telegram_id": TEST_TELEGRAM_ID})
        if not success:
            self.log_test("Backward compatibility - /profile/{telegram_id}", False, f"Request failed: {error}")
        elif response.status_code == 200:
            data = response.json()
            if data.get("uid") == TEST_UID:
                self.log_test("Backward compatibility - /profile/{telegram_id}", True, f"Legacy endpoint works with uid: {data.get('uid')}")
            else:
                self.log_test("Backward compatibility - /profile/{telegram_id}", False, f"Expected uid={TEST_UID}, got {data.get('uid')}")
        else:
            self.log_test("Backward compatibility - /profile/{telegram_id}", False, f"Status {response.status_code}: {response.text}")
        
        # Test legacy share-link endpoint
        response, success, error = self.make_request("GET", f"/profile/{TEST_TELEGRAM_ID}/share-link")
        if not success:
            self.log_test("Backward compatibility - /profile/{telegram_id}/share-link", False, f"Request failed: {error}")
        elif response.status_code == 200:
            self.log_test("Backward compatibility - /profile/{telegram_id}/share-link", True, "Legacy share-link endpoint works")
        else:
            self.log_test("Backward compatibility - /profile/{telegram_id}/share-link", False, f"Status {response.status_code}: {response.text}")
        
        # Test faculties endpoint
        response, success, error = self.make_request("GET", "/faculties")
        if not success:
            self.log_test("Backward compatibility - /faculties", False, f"Request failed: {error}")
        elif response.status_code == 200:
            self.log_test("Backward compatibility - /faculties", True, "Faculties endpoint works")
        else:
            self.log_test("Backward compatibility - /faculties", False, f"Status {response.status_code}: {response.text}")
    
    def test_uid_validation(self):
        """Test 12: UID format validation"""
        print("\n=== Test 12: UID Format Validation ===")
        
        invalid_uids = [
            ("abc", "non-numeric"),
            ("12345", "5 digits (too short)"),
            ("12345678901", "11 digits (too long)")
        ]
        
        for invalid_uid, description in invalid_uids:
            # Test resolve endpoint
            response, success, error = self.make_request("GET", f"/u/{invalid_uid}/resolve")
            if not success:
                self.log_test(f"UID validation /u/{invalid_uid}/resolve - {description}", False, f"Request failed: {error}")
            elif response.status_code == 404:
                self.log_test(f"UID validation /u/{invalid_uid}/resolve - {description}", True, f"Correctly returns 404 for {description}")
            else:
                self.log_test(f"UID validation /u/{invalid_uid}/resolve - {description}", False, f"Expected 404, got {response.status_code}")
    
    def run_all_tests(self):
        """Run all Stage 2 tests"""
        print("🧪 Starting Stage 2 Backend API Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test UID: {TEST_UID}")
        print(f"Test Telegram ID: {TEST_TELEGRAM_ID}")
        print(f"Test User: {TEST_USER_NAME} (@{TEST_USERNAME})")
        
        # Run all tests
        self.test_uid_resolve_endpoint()
        self.test_uid_profile_endpoint()
        self.test_uid_not_found()
        self.test_uid_invalid_format()
        self.test_uid_share_link()
        self.test_bug1_share_link_owner()
        self.test_bug2_activity_ping_jwt()
        self.test_bug7_uid_in_profile()
        self.test_uid_privacy_endpoint()
        self.test_uid_view_endpoint()
        self.test_backward_compatibility()
        self.test_uid_validation()
        
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
    tester = Stage2Tester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)