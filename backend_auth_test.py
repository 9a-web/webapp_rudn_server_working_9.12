#!/usr/bin/env python3
"""
Backend Auth API Testing for Stage 3 Changes
Tests the auth API endpoints as specified in the review request.
"""

import requests
import json
import sys
import time
import random
import string
from typing import Dict, Any, Optional

# Backend URL - using localhost as specified in review request
BACKEND_URL = "http://localhost:8001/api"

class AuthTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.results = []
        self.test_users = []  # Store created test users
        self.access_tokens = {}  # Store tokens for users
        
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
        
    def make_request(self, method: str, endpoint: str, data: Dict[Any, Any] = None, headers: Dict[str, str] = None) -> tuple:
        """Make HTTP request and return (response, success, error_msg)"""
        try:
            url = f"{BACKEND_URL}{endpoint}"
            req_headers = self.session.headers.copy()
            if headers:
                req_headers.update(headers)
                
            if method.upper() == "GET":
                response = self.session.get(url, headers=req_headers)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data, headers=req_headers)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, headers=req_headers)
            elif method.upper() == "PATCH":
                response = self.session.patch(url, json=data, headers=req_headers)
            else:
                return None, False, f"Unsupported method: {method}"
                
            return response, True, ""
        except Exception as e:
            return None, False, str(e)
    
    def generate_test_email(self) -> str:
        """Generate unique test email"""
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        return f"test_stage3_{random_suffix}@test.com"
    
    def generate_test_username(self) -> str:
        """Generate unique test username"""
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        return f"testuser_{random_suffix}"
    
    def test_auth_config(self):
        """Test GET /api/auth/config - новый endpoint, не требует auth"""
        print("\n=== Testing GET /api/auth/config ===")
        
        response, success, error = self.make_request("GET", "/auth/config")
        if not success:
            self.log_test("GET /api/auth/config", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            try:
                data = response.json()
                required_fields = ["telegram_bot_username", "vk_app_id", "vk_redirect_uri_default", "env", "features"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test("GET /api/auth/config", False, f"Missing fields: {missing_fields}")
                    return
                
                # Check features structure
                features = data.get("features", {})
                required_feature_keys = ["email_verification", "qr_login", "vk_login", "telegram_login"]
                missing_feature_keys = [key for key in required_feature_keys if key not in features]
                
                if missing_feature_keys:
                    self.log_test("GET /api/auth/config", False, f"Missing feature keys: {missing_feature_keys}")
                    return
                
                # Check that telegram_bot_username is not placeholder "bot"
                telegram_username = data.get("telegram_bot_username", "")
                if telegram_username == "bot":
                    self.log_test("GET /api/auth/config", False, "telegram_bot_username returns placeholder 'bot', should be real username from env")
                    return
                
                # Check that all feature values are boolean
                for key, value in features.items():
                    if not isinstance(value, bool):
                        self.log_test("GET /api/auth/config", False, f"Feature {key} should be boolean, got {type(value)}")
                        return
                
                self.log_test("GET /api/auth/config", True, f"Config returned correctly: env={data.get('env')}, telegram_username={telegram_username}")
                
            except json.JSONDecodeError:
                self.log_test("GET /api/auth/config", False, "Response is not valid JSON")
        else:
            self.log_test("GET /api/auth/config", False, f"Status {response.status_code}: {response.text}")
    
    def test_rate_limit_register_email(self):
        """Test rate limit на POST /api/auth/register/email - 5 per hour per IP"""
        print("\n=== Testing Rate Limit on POST /api/auth/register/email ===")
        
        successful_registrations = 0
        
        # Try to register 6 users quickly
        for i in range(6):
            email = self.generate_test_email()
            register_data = {
                "email": email,
                "password": "test123456",
                "first_name": "Test",
                "last_name": f"User{i+1}"
            }
            
            response, success, error = self.make_request("POST", "/auth/register/email", register_data)
            if not success:
                self.log_test(f"Rate limit test - registration {i+1}", False, f"Request failed: {error}")
                continue
            
            if response.status_code in [200, 201]:
                successful_registrations += 1
                # Store user info for later tests
                try:
                    data = response.json()
                    if "access_token" in data:
                        self.test_users.append({
                            "email": email,
                            "password": "test123456",
                            "access_token": data["access_token"],
                            "user": data.get("user", {})
                        })
                        self.access_tokens[email] = data["access_token"]
                except:
                    pass
                self.log_test(f"Rate limit test - registration {i+1}", True, f"Registration successful")
            elif response.status_code == 429:
                self.log_test(f"Rate limit test - registration {i+1}", True, f"Rate limit triggered at registration {i+1} (expected after 5)")
                break
            else:
                self.log_test(f"Rate limit test - registration {i+1}", False, f"Unexpected status {response.status_code}: {response.text}")
        
        # Verify that we got exactly 5 successful registrations and then rate limit
        if successful_registrations == 5:
            self.log_test("Rate limit enforcement", True, "Exactly 5 registrations allowed before rate limit")
        elif successful_registrations < 5:
            self.log_test("Rate limit enforcement", False, f"Rate limit triggered too early at {successful_registrations} registrations")
        else:
            self.log_test("Rate limit enforcement", False, f"Rate limit not working - {successful_registrations} registrations succeeded")
    
    def test_email_registration(self):
        """Test POST /api/auth/register/email basic functionality"""
        print("\n=== Testing POST /api/auth/register/email ===")
        
        # Use a user created during rate limit test if available, otherwise create new
        if self.test_users:
            test_user = self.test_users[0]
            self.log_test("Email registration basic", True, f"Using user from rate limit test: {test_user['email']}")
            return test_user
        
        email = self.generate_test_email()
        register_data = {
            "email": email,
            "password": "test123456",
            "first_name": "Test",
            "last_name": "User"
        }
        
        response, success, error = self.make_request("POST", "/auth/register/email", register_data)
        if not success:
            self.log_test("Email registration basic", False, f"Request failed: {error}")
            return None
            
        if response.status_code in [200, 201]:
            try:
                data = response.json()
                required_fields = ["access_token", "token_type", "user"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test("Email registration basic", False, f"Missing fields: {missing_fields}")
                    return None
                
                user = data.get("user", {})
                uid = user.get("uid")
                registration_step = user.get("registration_step")
                
                # Check UID is 9-digit numeric string
                if not uid or not uid.isdigit() or len(uid) != 9:
                    self.log_test("Email registration basic", False, f"UID should be 9-digit numeric string, got: {uid}")
                    return None
                
                # Check registration_step = 2 after email registration
                if registration_step != 2:
                    self.log_test("Email registration basic", False, f"registration_step should be 2 after email registration, got: {registration_step}")
                    return None
                
                test_user = {
                    "email": email,
                    "password": "test123456",
                    "access_token": data["access_token"],
                    "user": user
                }
                self.test_users.append(test_user)
                self.access_tokens[email] = data["access_token"]
                
                self.log_test("Email registration basic", True, f"Registration successful: uid={uid}, step={registration_step}")
                return test_user
                
            except json.JSONDecodeError:
                self.log_test("Email registration basic", False, "Response is not valid JSON")
                return None
        else:
            self.log_test("Email registration basic", False, f"Status {response.status_code}: {response.text}")
            return None
    
    def test_email_login(self, test_user: Dict[str, Any]):
        """Test POST /api/auth/login/email"""
        print("\n=== Testing POST /api/auth/login/email ===")
        
        if not test_user:
            self.log_test("Email login - no test user", False, "No test user available")
            return
        
        # Test successful login
        login_data = {
            "email": test_user["email"],
            "password": test_user["password"]
        }
        
        response, success, error = self.make_request("POST", "/auth/login/email", login_data)
        if not success:
            self.log_test("Email login successful", False, f"Request failed: {error}")
        elif response.status_code == 200:
            try:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.log_test("Email login successful", True, "Login successful with new token")
                    # Update token
                    self.access_tokens[test_user["email"]] = data["access_token"]
                else:
                    self.log_test("Email login successful", False, f"Missing access_token or user in response")
            except json.JSONDecodeError:
                self.log_test("Email login successful", False, "Response is not valid JSON")
        else:
            self.log_test("Email login successful", False, f"Status {response.status_code}: {response.text}")
        
        # Test login with wrong password
        wrong_login_data = {
            "email": test_user["email"],
            "password": "wrongpassword"
        }
        
        response, success, error = self.make_request("POST", "/auth/login/email", wrong_login_data)
        if not success:
            self.log_test("Email login wrong password", False, f"Request failed: {error}")
        elif response.status_code == 401:
            self.log_test("Email login wrong password", True, "Correctly rejected wrong password with 401")
        else:
            self.log_test("Email login wrong password", False, f"Expected 401, got {response.status_code}: {response.text}")
    
    def test_auth_me(self, test_user: Dict[str, Any]):
        """Test GET /api/auth/me с JWT"""
        print("\n=== Testing GET /api/auth/me ===")
        
        if not test_user:
            self.log_test("Auth me - no test user", False, "No test user available")
            return
        
        # Test with valid JWT
        token = self.access_tokens.get(test_user["email"])
        if not token:
            self.log_test("Auth me with JWT", False, "No access token available")
            return
        
        headers = {"Authorization": f"Bearer {token}"}
        response, success, error = self.make_request("GET", "/auth/me", headers=headers)
        
        if not success:
            self.log_test("Auth me with JWT", False, f"Request failed: {error}")
        elif response.status_code == 200:
            try:
                data = response.json()
                if "uid" in data and "email" in data:
                    self.log_test("Auth me with JWT", True, f"User data returned: uid={data.get('uid')}")
                else:
                    self.log_test("Auth me with JWT", False, "Missing uid or email in response")
            except json.JSONDecodeError:
                self.log_test("Auth me with JWT", False, "Response is not valid JSON")
        else:
            self.log_test("Auth me with JWT", False, f"Status {response.status_code}: {response.text}")
        
        # Test without Authorization header
        response, success, error = self.make_request("GET", "/auth/me")
        if not success:
            self.log_test("Auth me without JWT", False, f"Request failed: {error}")
        elif response.status_code == 401:
            self.log_test("Auth me without JWT", True, "Correctly rejected request without JWT with 401")
        else:
            self.log_test("Auth me without JWT", False, f"Expected 401, got {response.status_code}: {response.text}")
    
    def test_check_username(self, test_user: Dict[str, Any]):
        """Test GET /api/auth/check-username/{username}"""
        print("\n=== Testing GET /api/auth/check-username ===")
        
        # Test too short username
        response, success, error = self.make_request("GET", "/auth/check-username/ab")
        if not success:
            self.log_test("Check username too short", False, f"Request failed: {error}")
        elif response.status_code == 200:
            try:
                data = response.json()
                if data.get("available") is False and "reason" in data:
                    self.log_test("Check username too short", True, f"Correctly rejected short username: {data.get('reason')}")
                else:
                    self.log_test("Check username too short", False, f"Expected available=false with reason, got: {data}")
            except json.JSONDecodeError:
                self.log_test("Check username too short", False, "Response is not valid JSON")
        else:
            self.log_test("Check username too short", False, f"Status {response.status_code}: {response.text}")
        
        # Test valid unused username
        valid_username = self.generate_test_username()
        response, success, error = self.make_request("GET", f"/auth/check-username/{valid_username}")
        if not success:
            self.log_test("Check username valid unused", False, f"Request failed: {error}")
        elif response.status_code == 200:
            try:
                data = response.json()
                if data.get("available") is True:
                    self.log_test("Check username valid unused", True, "Valid unused username marked as available")
                else:
                    self.log_test("Check username valid unused", False, f"Expected available=true, got: {data}")
            except json.JSONDecodeError:
                self.log_test("Check username valid unused", False, "Response is not valid JSON")
        else:
            self.log_test("Check username valid unused", False, f"Status {response.status_code}: {response.text}")
        
        return valid_username
    
    def test_profile_step(self, test_user: Dict[str, Any], valid_username: str):
        """Test PATCH /api/auth/profile-step"""
        print("\n=== Testing PATCH /api/auth/profile-step ===")
        
        if not test_user or not valid_username:
            self.log_test("Profile step - missing data", False, "No test user or valid username available")
            return
        
        token = self.access_tokens.get(test_user["email"])
        if not token:
            self.log_test("Profile step - no token", False, "No access token available")
            return
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Step 2: Set username and complete step 2
        step2_data = {
            "username": valid_username,
            "first_name": "Test",
            "complete_step": 2
        }
        
        response, success, error = self.make_request("PATCH", "/auth/profile-step", step2_data, headers)
        if not success:
            self.log_test("Profile step 2", False, f"Request failed: {error}")
            return
        elif response.status_code == 200:
            try:
                data = response.json()
                if data.get("registration_step") == 3:
                    self.log_test("Profile step 2", True, f"Step 2 completed, now at step 3")
                else:
                    self.log_test("Profile step 2", False, f"Expected registration_step=3, got: {data.get('registration_step')}")
                    return
            except json.JSONDecodeError:
                self.log_test("Profile step 2", False, "Response is not valid JSON")
                return
        else:
            self.log_test("Profile step 2", False, f"Status {response.status_code}: {response.text}")
            return
        
        # Step 3: Complete academic info
        step3_data = {
            "facultet_id": "TEST_FAC",
            "level_id": "TEST_LEVEL", 
            "kurs": "1",
            "group_id": "TEST_GROUP",
            "group_name": "EP-01",
            "complete_step": 3
        }
        
        response, success, error = self.make_request("PATCH", "/auth/profile-step", step3_data, headers)
        if not success:
            self.log_test("Profile step 3", False, f"Request failed: {error}")
        elif response.status_code == 200:
            try:
                data = response.json()
                if data.get("registration_step") == 0:
                    self.log_test("Profile step 3", True, f"Step 3 completed, registration finished (step=0)")
                else:
                    self.log_test("Profile step 3", False, f"Expected registration_step=0, got: {data.get('registration_step')}")
            except json.JSONDecodeError:
                self.log_test("Profile step 3", False, "Response is not valid JSON")
        else:
            self.log_test("Profile step 3", False, f"Status {response.status_code}: {response.text}")
        
        # Test that username is now taken
        response, success, error = self.make_request("GET", f"/auth/check-username/{valid_username}")
        if success and response.status_code == 200:
            try:
                data = response.json()
                if data.get("available") is False:
                    self.log_test("Check username now taken", True, "Username correctly marked as taken after profile update")
                else:
                    self.log_test("Check username now taken", False, f"Username should be taken now, got: {data}")
            except:
                self.log_test("Check username now taken", False, "Failed to parse response")
        else:
            self.log_test("Check username now taken", False, "Failed to check username availability")
    
    def test_qr_login_flow(self):
        """Test QR login flow"""
        print("\n=== Testing QR Login Flow ===")
        
        # 1. Initialize QR session
        response, success, error = self.make_request("POST", "/auth/login/qr/init")
        if not success:
            self.log_test("QR init", False, f"Request failed: {error}")
            return
        
        if response.status_code != 200:
            self.log_test("QR init", False, f"Status {response.status_code}: {response.text}")
            return
        
        try:
            data = response.json()
            required_fields = ["qr_token", "expires_at", "status"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test("QR init", False, f"Missing fields: {missing_fields}")
                return
            
            if data.get("status") != "pending":
                self.log_test("QR init", False, f"Expected status=pending, got: {data.get('status')}")
                return
            
            qr_token = data["qr_token"]
            self.log_test("QR init", True, f"QR session initialized: {qr_token}")
            
        except json.JSONDecodeError:
            self.log_test("QR init", False, "Response is not valid JSON")
            return
        
        # 2. Check status (should be pending)
        response, success, error = self.make_request("GET", f"/auth/login/qr/{qr_token}/status")
        if not success:
            self.log_test("QR status check", False, f"Request failed: {error}")
            return
        
        if response.status_code == 200:
            try:
                data = response.json()
                if data.get("status") == "pending":
                    self.log_test("QR status check", True, "Status correctly shows pending")
                else:
                    self.log_test("QR status check", False, f"Expected status=pending, got: {data.get('status')}")
            except json.JSONDecodeError:
                self.log_test("QR status check", False, "Response is not valid JSON")
        else:
            self.log_test("QR status check", False, f"Status {response.status_code}: {response.text}")
        
        # 3. Confirm QR with JWT (if we have a test user)
        if self.test_users:
            test_user = self.test_users[0]
            token = self.access_tokens.get(test_user["email"])
            if token:
                headers = {"Authorization": f"Bearer {token}"}
                response, success, error = self.make_request("POST", f"/auth/login/qr/{qr_token}/confirm", headers=headers)
                
                if not success:
                    self.log_test("QR confirm", False, f"Request failed: {error}")
                elif response.status_code == 200:
                    try:
                        data = response.json()
                        if data.get("success") is True:
                            self.log_test("QR confirm", True, "QR session confirmed successfully")
                            
                            # 4. Check status after confirm (should be confirmed with access_token)
                            response, success, error = self.make_request("GET", f"/auth/login/qr/{qr_token}/status")
                            if success and response.status_code == 200:
                                try:
                                    data = response.json()
                                    if data.get("status") == "confirmed" and "access_token" in data:
                                        self.log_test("QR status after confirm", True, "Status shows confirmed with access_token")
                                    else:
                                        self.log_test("QR status after confirm", False, f"Expected confirmed status with token, got: {data}")
                                except:
                                    self.log_test("QR status after confirm", False, "Failed to parse status response")
                            else:
                                self.log_test("QR status after confirm", False, "Failed to check status after confirm")
                        else:
                            self.log_test("QR confirm", False, f"Expected success=true, got: {data}")
                    except json.JSONDecodeError:
                        self.log_test("QR confirm", False, "Response is not valid JSON")
                else:
                    self.log_test("QR confirm", False, f"Status {response.status_code}: {response.text}")
            else:
                self.log_test("QR confirm", False, "No access token available for confirmation")
        else:
            self.log_test("QR confirm", False, "No test user available for QR confirmation")
    
    def test_logout(self, test_user: Dict[str, Any]):
        """Test POST /api/auth/logout"""
        print("\n=== Testing POST /api/auth/logout ===")
        
        if not test_user:
            self.log_test("Logout - no test user", False, "No test user available")
            return
        
        token = self.access_tokens.get(test_user["email"])
        if not token:
            self.log_test("Logout - no token", False, "No access token available")
            return
        
        headers = {"Authorization": f"Bearer {token}"}
        response, success, error = self.make_request("POST", "/auth/logout", headers=headers)
        
        if not success:
            self.log_test("Logout", False, f"Request failed: {error}")
        elif response.status_code == 200:
            try:
                data = response.json()
                if data.get("success") is True:
                    self.log_test("Logout", True, "Logout successful")
                else:
                    self.log_test("Logout", False, f"Expected success=true, got: {data}")
            except json.JSONDecodeError:
                self.log_test("Logout", False, "Response is not valid JSON")
        else:
            self.log_test("Logout", False, f"Status {response.status_code}: {response.text}")
    
    def run_all_tests(self):
        """Run all auth tests in order"""
        print("🧪 Starting Auth API Tests (Stage 3)")
        print(f"Backend URL: {BACKEND_URL}")
        
        # Stage 3 high priority tests
        self.test_auth_config()
        self.test_rate_limit_register_email()
        
        # Stage 1 regression tests
        test_user = self.test_email_registration()
        self.test_email_login(test_user)
        self.test_auth_me(test_user)
        valid_username = self.test_check_username(test_user)
        self.test_profile_step(test_user, valid_username)
        self.test_qr_login_flow()
        self.test_logout(test_user)
        
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
    tester = AuthTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)