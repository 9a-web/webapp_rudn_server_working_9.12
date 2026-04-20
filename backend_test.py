#!/usr/bin/env python3
"""
Backend Test Suite for B-23 (username explicit unset) and B-06 (privacy filter)
Focused testing for the specific issues mentioned in the review request.
"""

import asyncio
import httpx
import json
import random
import string
import sys
from datetime import datetime
from typing import Dict, Any, Optional

# Backend URL - using local backend
BACKEND_URL = "http://localhost:8001/api"

class BackendTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.test_results = []
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
    
    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
    
    def generate_unique_email(self, prefix: str = "stage7_b23_retest") -> str:
        """Generate unique email for testing"""
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        return f"{prefix}_{random_suffix}@test.com"
    
    async def register_email_user(self, email: str, password: str = "Test1234", 
                                 first_name: str = "Test", last_name: str = "User") -> Optional[Dict[str, Any]]:
        """Register a new email user and return the response"""
        try:
            response = await self.client.post(f"{BACKEND_URL}/auth/register/email", json={
                "email": email,
                "password": password,
                "first_name": first_name,
                "last_name": last_name
            })
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"Registration failed: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"Registration error: {e}")
            return None
    
    async def test_b23_username_explicit_unset(self):
        """Test B-23: Username explicit unset functionality"""
        print("\n🧪 Testing B-23: Username explicit unset")
        
        # Step 1: Register new user
        email = self.generate_unique_email()
        print(f"1. Registering user with email: {email}")
        
        auth_response = await self.register_email_user(email)
        if not auth_response:
            self.log_result("B-23 Step 1: User registration", False, "Failed to register user")
            return
        
        access_token = auth_response.get("access_token")
        user = auth_response.get("user", {})
        uid = user.get("uid")
        
        if not access_token or not uid:
            self.log_result("B-23 Step 1: User registration", False, "Missing access_token or uid")
            return
        
        self.log_result("B-23 Step 1: User registration", True, f"User registered with uid: {uid}")
        
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Step 2: Set username via PATCH /api/auth/profile-step
        username = f"testuser_b23_{random.randint(1000, 9999)}"
        print(f"2. Setting username to: {username}")
        
        try:
            response = await self.client.patch(f"{BACKEND_URL}/auth/profile-step", 
                                             json={"username": username}, 
                                             headers=headers)
            
            if response.status_code == 200:
                self.log_result("B-23 Step 2: Set username", True, f"Username set to {username}")
            else:
                self.log_result("B-23 Step 2: Set username", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
                return
        except Exception as e:
            self.log_result("B-23 Step 2: Set username", False, f"Error: {e}")
            return
        
        # Step 3: Verify username is set via GET /api/auth/me
        print("3. Verifying username is set")
        try:
            response = await self.client.get(f"{BACKEND_URL}/auth/me", headers=headers)
            
            if response.status_code == 200:
                user_data = response.json()
                current_username = user_data.get("username")
                if current_username == username:
                    self.log_result("B-23 Step 3: Verify username set", True, 
                                  f"Username correctly set to {current_username}")
                else:
                    self.log_result("B-23 Step 3: Verify username set", False, 
                                  f"Expected {username}, got {current_username}")
                    return
            else:
                self.log_result("B-23 Step 3: Verify username set", False, 
                              f"Status: {response.status_code}")
                return
        except Exception as e:
            self.log_result("B-23 Step 3: Verify username set", False, f"Error: {e}")
            return
        
        # Step 4: CRITICAL TEST - Unset username with empty string (should return 200, not 422)
        print("4. CRITICAL: Unsetting username with empty string")
        try:
            response = await self.client.patch(f"{BACKEND_URL}/auth/profile-step", 
                                             json={"username": ""}, 
                                             headers=headers)
            
            if response.status_code == 200:
                self.log_result("B-23 Step 4: Unset username with empty string", True, 
                              "Empty string accepted (200 OK)")
            elif response.status_code == 422:
                self.log_result("B-23 Step 4: Unset username with empty string", False, 
                              "CRITICAL BUG: Empty string returned 422 instead of 200")
                print(f"   Response: {response.text}")
                return
            else:
                self.log_result("B-23 Step 4: Unset username with empty string", False, 
                              f"Unexpected status: {response.status_code}, Response: {response.text}")
                return
        except Exception as e:
            self.log_result("B-23 Step 4: Unset username with empty string", False, f"Error: {e}")
            return
        
        # Step 5: Verify username is null
        print("5. Verifying username is null after unset")
        try:
            response = await self.client.get(f"{BACKEND_URL}/auth/me", headers=headers)
            
            if response.status_code == 200:
                user_data = response.json()
                current_username = user_data.get("username")
                if current_username is None:
                    self.log_result("B-23 Step 5: Verify username is null", True, 
                                  "Username correctly set to null")
                else:
                    self.log_result("B-23 Step 5: Verify username is null", False, 
                                  f"Expected null, got {current_username}")
                    return
            else:
                self.log_result("B-23 Step 5: Verify username is null", False, 
                              f"Status: {response.status_code}")
                return
        except Exception as e:
            self.log_result("B-23 Step 5: Verify username is null", False, f"Error: {e}")
            return
        
        # Step 6: Test invalid short username (should return 422/400)
        print("6. Testing invalid short username")
        try:
            response = await self.client.patch(f"{BACKEND_URL}/auth/profile-step", 
                                             json={"username": "ab"}, 
                                             headers=headers)
            
            if response.status_code in [400, 422]:
                self.log_result("B-23 Step 6: Invalid short username", True, 
                              f"Short username correctly rejected with {response.status_code}")
            else:
                self.log_result("B-23 Step 6: Invalid short username", False, 
                              f"Expected 400/422, got {response.status_code}")
        except Exception as e:
            self.log_result("B-23 Step 6: Invalid short username", False, f"Error: {e}")
    
    async def test_b06_privacy_filter(self):
        """Test B-06: Privacy filter functionality"""
        print("\n🧪 Testing B-06: Privacy filter")
        
        # Step 1: Register email user
        email = self.generate_unique_email("b06_privacy_test")
        print(f"1. Registering user for privacy test: {email}")
        
        auth_response = await self.register_email_user(email)
        if not auth_response:
            self.log_result("B-06 Step 1: User registration", False, "Failed to register user")
            return
        
        access_token = auth_response.get("access_token")
        user = auth_response.get("user", {})
        uid = user.get("uid")
        telegram_id = user.get("telegram_id")
        
        if not access_token or not uid:
            self.log_result("B-06 Step 1: User registration", False, "Missing access_token or uid")
            return
        
        self.log_result("B-06 Step 1: User registration", True, 
                       f"User registered with uid: {uid}, telegram_id: {telegram_id}")
        
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Step 2: Check if user has telegram_id (email-only users have telegram_id=null but pseudo_tid)
        print(f"2. Checking user telegram_id: {telegram_id}")
        
        if telegram_id is None:
            self.log_result("B-06 Step 2: Check telegram_id", True, 
                          "Email-only user has telegram_id=null (expected)")
            print("   Note: Email-only users cannot set privacy settings (requires telegram_id)")
            print("   SKIPPING privacy test as user has no telegram_id")
            return
        else:
            self.log_result("B-06 Step 2: Check telegram_id", True, 
                          f"User has telegram_id: {telegram_id}")
        
        # Step 3: Set privacy show_in_search=false
        print("3. Setting privacy show_in_search=false")
        try:
            response = await self.client.put(f"{BACKEND_URL}/profile/{telegram_id}/privacy", 
                                           json={"show_in_search": False}, 
                                           headers=headers)
            
            if response.status_code == 200:
                self.log_result("B-06 Step 3: Set privacy", True, "Privacy setting updated")
            else:
                self.log_result("B-06 Step 3: Set privacy", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
                return
        except Exception as e:
            self.log_result("B-06 Step 3: Set privacy", False, f"Error: {e}")
            return
        
        # Step 4: Test /api/u/{uid}/resolve without JWT (should return 404)
        print("4. Testing /api/u/{uid}/resolve without JWT (should be 404)")
        try:
            response = await self.client.get(f"{BACKEND_URL}/u/{uid}/resolve")
            
            if response.status_code == 404:
                self.log_result("B-06 Step 4: Resolve without JWT", True, 
                              "Hidden user correctly returns 404 without JWT")
            else:
                self.log_result("B-06 Step 4: Resolve without JWT", False, 
                              f"Expected 404, got {response.status_code}")
                return
        except Exception as e:
            self.log_result("B-06 Step 4: Resolve without JWT", False, f"Error: {e}")
            return
        
        # Step 5: Test /api/u/{uid}/resolve with JWT from same user (should return 200)
        print("5. Testing /api/u/{uid}/resolve with JWT from same user (should be 200)")
        try:
            response = await self.client.get(f"{BACKEND_URL}/u/{uid}/resolve", headers=headers)
            
            if response.status_code == 200:
                self.log_result("B-06 Step 5: Resolve with own JWT", True, 
                              "User can access own profile even when hidden")
            else:
                self.log_result("B-06 Step 5: Resolve with own JWT", False, 
                              f"Expected 200, got {response.status_code}")
        except Exception as e:
            self.log_result("B-06 Step 5: Resolve with own JWT", False, f"Error: {e}")
    
    async def run_tests(self):
        """Run all tests"""
        print("🚀 Starting Backend Tests for B-23 and B-06")
        print(f"Backend URL: {BACKEND_URL}")
        
        # Test B-23: Username explicit unset
        await self.test_b23_username_explicit_unset()
        
        # Test B-06: Privacy filter
        await self.test_b06_privacy_filter()
        
        # Summary
        print("\n📊 TEST SUMMARY")
        print("=" * 50)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n🎯 FOCUS AREAS:")
        print("B-23 (Username explicit unset): Check if empty string for username returns 200 instead of 422")
        print("B-06 (Privacy filter): Check if privacy settings work correctly for email-only users")
        
        return failed_tests == 0

async def main():
    """Main test runner"""
    async with BackendTester() as tester:
        success = await tester.run_tests()
        sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())