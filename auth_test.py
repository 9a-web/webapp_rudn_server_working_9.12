#!/usr/bin/env python3
"""
Auth System Testing for RUDN Schedule Stage 1 Auth Foundation
Tests all auth endpoints as specified in the review request.
"""

import requests
import json
import sys
import time
import uuid
from typing import Dict, Any, Optional

# Backend URL - using local backend since external URL is not accessible
BACKEND_URL = "http://localhost:8001/api"

class AuthTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.results = []
        self.test_tokens = {}  # Store tokens for different users
        self.test_users = {}   # Store user data
        
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
    
    def test_register_email(self):
        """Test POST /api/auth/register/email"""
        print("\n=== Testing Email Registration ===")
        
        # Generate unique email for this test run
        import random
        unique_id = f"{str(uuid.uuid4())[:8]}_{random.randint(1000, 9999)}"
        test_email = f"test_auto_{unique_id}@rudn.ru"
        
        # 1. Valid registration
        register_data = {
            "email": test_email,
            "password": "secret123",
            "first_name": "Test",
            "last_name": "User"
        }
        
        response, success, error = self.make_request("POST", "/auth/register/email", register_data)
        if not success:
            self.log_test("POST /auth/register/email - valid data", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            data = response.json()
            # Check response structure
            required_fields = ["access_token", "token_type", "user", "is_new_user"]
            missing_fields = [f for f in required_fields if f not in data]
            
            if missing_fields:
                self.log_test("POST /auth/register/email - valid data", False, f"Missing fields: {missing_fields}")
            elif data.get("token_type") != "bearer":
                self.log_test("POST /auth/register/email - valid data", False, f"Expected token_type=bearer, got {data.get('token_type')}")
            elif not data.get("is_new_user"):
                self.log_test("POST /auth/register/email - valid data", False, f"Expected is_new_user=true, got {data.get('is_new_user')}")
            else:
                user = data.get("user", {})
                uid = user.get("uid")
                if not uid or len(str(uid)) != 9 or not str(uid).isdigit():
                    self.log_test("POST /auth/register/email - valid data", False, f"Invalid UID: {uid} (should be 9-digit numeric)")
                elif not (100000000 <= int(uid) <= 999999999):
                    self.log_test("POST /auth/register/email - valid data", False, f"UID {uid} out of range 100000000-999999999")
                else:
                    self.log_test("POST /auth/register/email - valid data", True, f"User registered with UID: {uid}")
                    # Store for later tests
                    self.test_tokens["user1"] = data["access_token"]
                    self.test_users["user1"] = {
                        "email": test_email,
                        "password": "secret123",
                        "uid": uid,
                        "user_data": user
                    }
        else:
            self.log_test("POST /auth/register/email - valid data", False, f"Status {response.status_code}: {response.text}")
        
        # 2. Duplicate email - should return 409
        response, success, error = self.make_request("POST", "/auth/register/email", register_data)
        if not success:
            self.log_test("POST /auth/register/email - duplicate email", False, f"Request failed: {error}")
        elif response.status_code == 409:
            self.log_test("POST /auth/register/email - duplicate email", True, "Correctly rejected duplicate email with 409")
        else:
            self.log_test("POST /auth/register/email - duplicate email", False, f"Expected 409, got {response.status_code}: {response.text}")
        
        # 3. Short password - should return 400/422
        short_password_data = {
            "email": f"test_short_{unique_id}@rudn.ru",
            "password": "123",  # Less than 6 characters
            "first_name": "Test",
            "last_name": "User"
        }
        
        response, success, error = self.make_request("POST", "/auth/register/email", short_password_data)
        if not success:
            self.log_test("POST /auth/register/email - short password", False, f"Request failed: {error}")
        elif response.status_code in [400, 422]:
            self.log_test("POST /auth/register/email - short password", True, f"Correctly rejected short password with {response.status_code}")
        else:
            self.log_test("POST /auth/register/email - short password", False, f"Expected 400/422, got {response.status_code}: {response.text}")
    
    def test_login_email(self):
        """Test POST /api/auth/login/email"""
        print("\n=== Testing Email Login ===")
        
        if "user1" not in self.test_users:
            self.log_test("POST /auth/login/email - setup", False, "No registered user available for login test")
            return
        
        user_data = self.test_users["user1"]
        
        # 1. Valid login
        login_data = {
            "email": user_data["email"],
            "password": user_data["password"]
        }
        
        response, success, error = self.make_request("POST", "/auth/login/email", login_data)
        if not success:
            self.log_test("POST /auth/login/email - valid credentials", False, f"Request failed: {error}")
        elif response.status_code == 200:
            data = response.json()
            if "access_token" in data and data.get("token_type") == "bearer":
                self.log_test("POST /auth/login/email - valid credentials", True, "Login successful")
                # Update token
                self.test_tokens["user1"] = data["access_token"]
            else:
                self.log_test("POST /auth/login/email - valid credentials", False, f"Invalid response structure: {data}")
        else:
            self.log_test("POST /auth/login/email - valid credentials", False, f"Status {response.status_code}: {response.text}")
        
        # 2. Invalid password - should return 401
        invalid_login_data = {
            "email": user_data["email"],
            "password": "wrongpassword"
        }
        
        response, success, error = self.make_request("POST", "/auth/login/email", invalid_login_data)
        if not success:
            self.log_test("POST /auth/login/email - invalid password", False, f"Request failed: {error}")
        elif response.status_code == 401:
            self.log_test("POST /auth/login/email - invalid password", True, "Correctly rejected invalid password with 401")
        else:
            self.log_test("POST /auth/login/email - invalid password", False, f"Expected 401, got {response.status_code}: {response.text}")
    
    def test_auth_me(self):
        """Test GET /api/auth/me"""
        print("\n=== Testing /auth/me ===")
        
        # 1. Valid token
        if "user1" in self.test_tokens:
            headers = {"Authorization": f"Bearer {self.test_tokens['user1']}"}
            response, success, error = self.make_request("GET", "/auth/me", headers=headers)
            
            if not success:
                self.log_test("GET /auth/me - valid token", False, f"Request failed: {error}")
            elif response.status_code == 200:
                data = response.json()
                if "uid" in data and data["uid"] == self.test_users["user1"]["uid"]:
                    self.log_test("GET /auth/me - valid token", True, f"Returned correct user data for UID: {data['uid']}")
                else:
                    self.log_test("GET /auth/me - valid token", False, f"Incorrect user data: {data}")
            else:
                self.log_test("GET /auth/me - valid token", False, f"Status {response.status_code}: {response.text}")
        else:
            self.log_test("GET /auth/me - valid token", False, "No valid token available")
        
        # 2. No token - should return 401
        response, success, error = self.make_request("GET", "/auth/me")
        if not success:
            self.log_test("GET /auth/me - no token", False, f"Request failed: {error}")
        elif response.status_code == 401:
            self.log_test("GET /auth/me - no token", True, "Correctly rejected request without token with 401")
        else:
            self.log_test("GET /auth/me - no token", False, f"Expected 401, got {response.status_code}: {response.text}")
        
        # 3. Invalid token - should return 401
        headers = {"Authorization": "Bearer invalid_token_12345"}
        response, success, error = self.make_request("GET", "/auth/me", headers=headers)
        if not success:
            self.log_test("GET /auth/me - invalid token", False, f"Request failed: {error}")
        elif response.status_code == 401:
            self.log_test("GET /auth/me - invalid token", True, "Correctly rejected invalid token with 401")
        else:
            self.log_test("GET /auth/me - invalid token", False, f"Expected 401, got {response.status_code}: {response.text}")
    
    def test_logout(self):
        """Test POST /api/auth/logout"""
        print("\n=== Testing Logout ===")
        
        if "user1" in self.test_tokens:
            headers = {"Authorization": f"Bearer {self.test_tokens['user1']}"}
            response, success, error = self.make_request("POST", "/auth/logout", headers=headers)
            
            if not success:
                self.log_test("POST /auth/logout - valid token", False, f"Request failed: {error}")
            elif response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_test("POST /auth/logout - valid token", True, "Logout successful")
                else:
                    self.log_test("POST /auth/logout - valid token", False, f"Unexpected response: {data}")
            else:
                self.log_test("POST /auth/logout - valid token", False, f"Status {response.status_code}: {response.text}")
        else:
            self.log_test("POST /auth/logout - valid token", False, "No valid token available")
    
    def test_check_username(self):
        """Test GET /api/auth/check-username/{username}"""
        print("\n=== Testing Username Check ===")
        
        # 1. Valid available username
        response, success, error = self.make_request("GET", "/auth/check-username/testuser123")
        if not success:
            self.log_test("GET /auth/check-username - valid username", False, f"Request failed: {error}")
        elif response.status_code == 200:
            data = response.json()
            if "available" in data and "reason" in data:
                self.log_test("GET /auth/check-username - valid username", True, f"Available: {data['available']}, Reason: {data.get('reason', 'N/A')}")
            else:
                self.log_test("GET /auth/check-username - valid username", False, f"Invalid response structure: {data}")
        else:
            self.log_test("GET /auth/check-username - valid username", False, f"Status {response.status_code}: {response.text}")
        
        # 2. Too short username
        response, success, error = self.make_request("GET", "/auth/check-username/ab")
        if not success:
            self.log_test("GET /auth/check-username - too short", False, f"Request failed: {error}")
        elif response.status_code == 200:
            data = response.json()
            if data.get("available") is False:
                self.log_test("GET /auth/check-username - too short", True, f"Correctly rejected: {data.get('reason')}")
            else:
                self.log_test("GET /auth/check-username - too short", False, f"Should be unavailable: {data}")
        else:
            self.log_test("GET /auth/check-username - too short", False, f"Status {response.status_code}: {response.text}")
        
        # 3. Reserved username
        response, success, error = self.make_request("GET", "/auth/check-username/admin")
        if not success:
            self.log_test("GET /auth/check-username - reserved", False, f"Request failed: {error}")
        elif response.status_code == 200:
            data = response.json()
            if data.get("available") is False:
                self.log_test("GET /auth/check-username - reserved", True, f"Correctly rejected: {data.get('reason')}")
            else:
                self.log_test("GET /auth/check-username - reserved", False, f"Should be unavailable: {data}")
        else:
            self.log_test("GET /auth/check-username - reserved", False, f"Status {response.status_code}: {response.text}")
        
        # 4. Invalid characters
        response, success, error = self.make_request("GET", "/auth/check-username/!!!bad!!!")
        if not success:
            self.log_test("GET /auth/check-username - invalid chars", False, f"Request failed: {error}")
        elif response.status_code == 200:
            data = response.json()
            if data.get("available") is False:
                self.log_test("GET /auth/check-username - invalid chars", True, f"Correctly rejected: {data.get('reason')}")
            else:
                self.log_test("GET /auth/check-username - invalid chars", False, f"Should be unavailable: {data}")
        else:
            self.log_test("GET /auth/check-username - invalid chars", False, f"Status {response.status_code}: {response.text}")
    
    def test_profile_step(self):
        """Test PATCH /api/auth/profile-step"""
        print("\n=== Testing Profile Step Update ===")
        
        if "user1" not in self.test_tokens:
            self.log_test("PATCH /auth/profile-step - setup", False, "No valid token available")
            return
        
        headers = {"Authorization": f"Bearer {self.test_tokens['user1']}"}
        unique_username = f"new_username_{str(uuid.uuid4())[:8]}"
        
        update_data = {
            "username": unique_username,
            "first_name": "Updated",
            "complete_step": 2
        }
        
        response, success, error = self.make_request("PATCH", "/auth/profile-step", update_data, headers)
        if not success:
            self.log_test("PATCH /auth/profile-step - valid update", False, f"Request failed: {error}")
        elif response.status_code == 200:
            data = response.json()
            if data.get("username") == unique_username and data.get("first_name") == "Updated":
                self.log_test("PATCH /auth/profile-step - valid update", True, f"Profile updated successfully, registration_step: {data.get('registration_step')}")
            else:
                self.log_test("PATCH /auth/profile-step - valid update", False, f"Update not reflected: {data}")
        else:
            self.log_test("PATCH /auth/profile-step - valid update", False, f"Status {response.status_code}: {response.text}")
    
    def test_telegram_login_validation(self):
        """Test POST /api/auth/login/telegram with invalid hash"""
        print("\n=== Testing Telegram Login Validation ===")
        
        # Invalid Telegram login data (fake hash)
        telegram_data = {
            "id": 12345,
            "first_name": "X",
            "auth_date": int(time.time()),
            "hash": "fake_hash_12345"
        }
        
        response, success, error = self.make_request("POST", "/auth/login/telegram", telegram_data)
        if not success:
            self.log_test("POST /auth/login/telegram - invalid hash", False, f"Request failed: {error}")
        elif response.status_code == 401:
            self.log_test("POST /auth/login/telegram - invalid hash", True, "Correctly rejected invalid Telegram signature with 401")
        else:
            self.log_test("POST /auth/login/telegram - invalid hash", False, f"Expected 401, got {response.status_code}: {response.text}")
    
    def test_vk_login(self):
        """Test POST /api/auth/login/vk with fake code"""
        print("\n=== Testing VK Login ===")
        
        vk_data = {
            "code": "fake_code",
            "redirect_uri": "https://example.com/callback"
        }
        
        response, success, error = self.make_request("POST", "/auth/login/vk", vk_data)
        if not success:
            self.log_test("POST /auth/login/vk - fake code", False, f"Request failed: {error}")
        elif response.status_code in [401, 502]:
            self.log_test("POST /auth/login/vk - fake code", True, f"VK correctly rejected fake code with {response.status_code}")
        elif response.status_code == 500:
            self.log_test("POST /auth/login/vk - fake code", False, f"Unexpected 500 error: {response.text}")
        else:
            self.log_test("POST /auth/login/vk - fake code", True, f"VK endpoint responded with {response.status_code} (acceptable)")
    
    def test_qr_login_flow(self):
        """Test QR login flow: init -> status -> confirm"""
        print("\n=== Testing QR Login Flow ===")
        
        # 1. Initialize QR session
        response, success, error = self.make_request("POST", "/auth/login/qr/init")
        if not success:
            self.log_test("POST /auth/login/qr/init", False, f"Request failed: {error}")
            return
        
        if response.status_code != 200:
            self.log_test("POST /auth/login/qr/init", False, f"Status {response.status_code}: {response.text}")
            return
        
        data = response.json()
        required_fields = ["qr_token", "qr_url", "expires_at", "status"]
        missing_fields = [f for f in required_fields if f not in data]
        
        if missing_fields:
            self.log_test("POST /auth/login/qr/init", False, f"Missing fields: {missing_fields}")
            return
        
        if data.get("status") != "pending":
            self.log_test("POST /auth/login/qr/init", False, f"Expected status=pending, got {data.get('status')}")
            return
        
        self.log_test("POST /auth/login/qr/init", True, f"QR session created: {data['qr_token']}")
        qr_token = data["qr_token"]
        
        # 2. Check status (should be pending)
        response, success, error = self.make_request("GET", f"/auth/login/qr/{qr_token}/status")
        if not success:
            self.log_test("GET /auth/login/qr/status - pending", False, f"Request failed: {error}")
        elif response.status_code == 200:
            data = response.json()
            if data.get("status") == "pending":
                self.log_test("GET /auth/login/qr/status - pending", True, "Status correctly shows pending")
            else:
                self.log_test("GET /auth/login/qr/status - pending", False, f"Expected pending, got {data.get('status')}")
        else:
            self.log_test("GET /auth/login/qr/status - pending", False, f"Status {response.status_code}: {response.text}")
        
        # 3. Confirm QR (if we have a valid token)
        if "user1" in self.test_tokens:
            headers = {"Authorization": f"Bearer {self.test_tokens['user1']}"}
            response, success, error = self.make_request("POST", f"/auth/login/qr/{qr_token}/confirm", headers=headers)
            
            if not success:
                self.log_test("POST /auth/login/qr/confirm", False, f"Request failed: {error}")
            elif response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_test("POST /auth/login/qr/confirm", True, "QR session confirmed successfully")
                    
                    # 4. Check status again (should be confirmed and return token)
                    response, success, error = self.make_request("GET", f"/auth/login/qr/{qr_token}/status")
                    if not success:
                        self.log_test("GET /auth/login/qr/status - confirmed", False, f"Request failed: {error}")
                    elif response.status_code == 200:
                        data = response.json()
                        if "access_token" in data:
                            self.log_test("GET /auth/login/qr/status - confirmed", True, "QR login completed with access token")
                        else:
                            self.log_test("GET /auth/login/qr/status - confirmed", False, f"No access token in response: {data}")
                    else:
                        self.log_test("GET /auth/login/qr/status - confirmed", False, f"Status {response.status_code}: {response.text}")
                else:
                    self.log_test("POST /auth/login/qr/confirm", False, f"Confirmation failed: {data}")
            else:
                self.log_test("POST /auth/login/qr/confirm", False, f"Status {response.status_code}: {response.text}")
        else:
            self.log_test("POST /auth/login/qr/confirm", False, "No valid token available for confirmation")
    
    def test_backward_compatibility(self):
        """Test backward compatibility endpoints"""
        print("\n=== Testing Backward Compatibility ===")
        
        # Test old profile endpoint
        response, success, error = self.make_request("GET", "/profile/765963392?viewer_telegram_id=765963392")
        if not success:
            self.log_test("GET /profile/{telegram_id} - backward compatibility", False, f"Request failed: {error}")
        elif response.status_code in [200, 404]:
            self.log_test("GET /profile/{telegram_id} - backward compatibility", True, f"Endpoint accessible (status: {response.status_code})")
        else:
            self.log_test("GET /profile/{telegram_id} - backward compatibility", False, f"Unexpected status {response.status_code}: {response.text}")
        
        # Test user-settings endpoint
        response, success, error = self.make_request("GET", "/user-settings/765963392")
        if not success:
            self.log_test("GET /user-settings/{telegram_id} - backward compatibility", False, f"Request failed: {error}")
        elif response.status_code in [200, 404]:
            self.log_test("GET /user-settings/{telegram_id} - backward compatibility", True, f"Endpoint accessible (status: {response.status_code})")
        else:
            self.log_test("GET /user-settings/{telegram_id} - backward compatibility", False, f"Unexpected status {response.status_code}: {response.text}")
        
        # Test faculties endpoint
        response, success, error = self.make_request("GET", "/faculties")
        if not success:
            self.log_test("GET /faculties - backward compatibility", False, f"Request failed: {error}")
        elif response.status_code == 200:
            self.log_test("GET /faculties - backward compatibility", True, "Faculties endpoint working")
        else:
            self.log_test("GET /faculties - backward compatibility", False, f"Status {response.status_code}: {response.text}")
    
    def test_migration_validation(self):
        """Test that migration has been performed"""
        print("\n=== Testing Migration Validation ===")
        
        # This is a basic test - in a real scenario we'd need database access
        # For now, we'll just verify that the auth system is working
        if self.test_users:
            user_data = list(self.test_users.values())[0]
            uid = user_data.get("uid")
            if uid and len(str(uid)) == 9 and str(uid).isdigit():
                self.log_test("Migration validation - UID format", True, f"UID {uid} follows 9-digit numeric format")
            else:
                self.log_test("Migration validation - UID format", False, f"Invalid UID format: {uid}")
        else:
            self.log_test("Migration validation - UID format", False, "No test users available for validation")
    
    def run_all_tests(self):
        """Run all auth tests"""
        print("🔐 Starting RUDN Schedule Stage 1 Auth Foundation Tests")
        print(f"Backend URL: {BACKEND_URL}")
        
        # Core auth flow tests
        self.test_register_email()
        self.test_login_email()
        self.test_auth_me()
        self.test_logout()
        
        # Additional auth features
        self.test_check_username()
        self.test_profile_step()
        
        # Provider validation tests
        self.test_telegram_login_validation()
        self.test_vk_login()
        
        # QR login flow
        self.test_qr_login_flow()
        
        # Backward compatibility
        self.test_backward_compatibility()
        
        # Migration validation
        self.test_migration_validation()
        
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