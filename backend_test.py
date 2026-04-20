#!/usr/bin/env python3
"""
Backend test for user_settings auto-upsert bug fix verification.

Tests the fix where email/VK/QR registrations now auto-create user_settings
documents with effective_tid = telegram_id OR int(uid).
"""

import requests
import json
import time
from datetime import datetime

# Backend base URL
BASE_URL = "http://localhost:8001/api"

def log_test(test_name, status, details=""):
    """Log test results with timestamp."""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_emoji = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"[{timestamp}] {status_emoji} {test_name}: {status}")
    if details:
        print(f"    {details}")

def test_email_registration_creates_user_settings():
    """Test 1: Email registration creates user_settings with telegram_id = int(uid)"""
    print("\n=== TEST 1: Email registration creates user_settings ===")
    
    # Create unique email to avoid conflicts
    timestamp = int(time.time())
    email = f"fixbug_{timestamp}@example.com"
    
    # Register new user
    register_data = {
        "email": email,
        "password": "testpass123",
        "first_name": "Test"
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/auth/register/email", json=register_data, timeout=10)
        
        if resp.status_code != 200:
            log_test("Email Registration", "FAIL", f"Status {resp.status_code}: {resp.text}")
            return None, None
            
        data = resp.json()
        uid = data["user"]["uid"]
        access_token = data["access_token"]
        
        log_test("Email Registration", "PASS", f"UID: {uid}, Token received")
        
        # Immediately check user_settings
        settings_resp = requests.get(f"{BASE_URL}/user-settings/{uid}", timeout=10)
        
        if settings_resp.status_code == 404:
            log_test("User Settings Creation", "FAIL", "GET /user-settings/{uid} returned 404 - bug not fixed!")
            return uid, access_token
        elif settings_resp.status_code != 200:
            log_test("User Settings Creation", "FAIL", f"Status {settings_resp.status_code}: {settings_resp.text}")
            return uid, access_token
            
        settings_data = settings_resp.json()
        expected_tid = int(uid)
        actual_tid = settings_data.get("telegram_id")
        
        if actual_tid == expected_tid:
            log_test("User Settings Creation", "PASS", f"telegram_id = {actual_tid} (matches int(uid))")
        else:
            log_test("User Settings Creation", "FAIL", f"telegram_id = {actual_tid}, expected {expected_tid}")
            
        # Check that group_id/facultet_id are null initially
        if settings_data.get("group_id") is None and settings_data.get("facultet_id") is None:
            log_test("Initial Settings State", "PASS", "group_id and facultet_id are null as expected")
        else:
            log_test("Initial Settings State", "FAIL", f"group_id={settings_data.get('group_id')}, facultet_id={settings_data.get('facultet_id')}")
            
        return uid, access_token
        
    except requests.RequestException as e:
        log_test("Email Registration", "FAIL", f"Request error: {e}")
        return None, None

def test_step3_mirrors_to_user_settings(uid, access_token):
    """Test 2: Step 3 (academic) mirrors into user_settings"""
    print("\n=== TEST 2: Step 3 academic data mirrors to user_settings ===")
    
    if not uid or not access_token:
        log_test("Step 3 Test", "SKIP", "No valid UID/token from previous test")
        return
        
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Update profile step 3 with academic data
    step3_data = {
        "facultet_id": "F1",
        "facultet_name": "Test Faculty", 
        "level_id": "L1",
        "form_code": "ochnaya",
        "kurs": "1",
        "group_id": "G1",
        "group_name": "TEST-01",
        "complete_step": 3
    }
    
    try:
        resp = requests.patch(f"{BASE_URL}/auth/profile-step", json=step3_data, headers=headers, timeout=10)
        
        if resp.status_code != 200:
            log_test("Profile Step 3", "FAIL", f"Status {resp.status_code}: {resp.text}")
            return
            
        data = resp.json()
        if data.get("registration_step") == 0:
            log_test("Profile Step 3", "PASS", "registration_step = 0 (completed)")
        else:
            log_test("Profile Step 3", "FAIL", f"registration_step = {data.get('registration_step')}, expected 0")
            
        # Check user_settings reflects the changes
        settings_resp = requests.get(f"{BASE_URL}/user-settings/{uid}", timeout=10)
        
        if settings_resp.status_code != 200:
            log_test("Settings Mirror Check", "FAIL", f"Status {settings_resp.status_code}: {settings_resp.text}")
            return
            
        settings_data = settings_resp.json()
        
        # Verify academic data is mirrored
        checks = [
            ("group_id", "G1"),
            ("facultet_id", "F1"), 
            ("group_name", "TEST-01"),
            ("kurs", "1")
        ]
        
        all_passed = True
        for field, expected in checks:
            actual = settings_data.get(field)
            if actual == expected:
                log_test(f"Settings {field}", "PASS", f"{field} = {actual}")
            else:
                log_test(f"Settings {field}", "FAIL", f"{field} = {actual}, expected {expected}")
                all_passed = False
                
        if all_passed:
            log_test("Academic Data Mirror", "PASS", "All academic fields correctly mirrored")
            
    except requests.RequestException as e:
        log_test("Step 3 Test", "FAIL", f"Request error: {e}")

def test_step2_profile_upserts_username():
    """Test 3: Step 2 (profile: username/first_name) upserts username into user_settings"""
    print("\n=== TEST 3: Step 2 profile data upserts username ===")
    
    # Create another fresh user for this test
    timestamp = int(time.time())
    email = f"testfix_{timestamp}@example.com"
    
    register_data = {
        "email": email,
        "password": "testpass123",
        "first_name": "Initial"
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/auth/register/email", json=register_data, timeout=10)
        
        if resp.status_code != 200:
            log_test("Second Registration", "FAIL", f"Status {resp.status_code}: {resp.text}")
            return
            
        data = resp.json()
        uid = data["user"]["uid"]
        access_token = data["access_token"]
        
        log_test("Second Registration", "PASS", f"UID: {uid}")
        
        # Update with step 2 data
        headers = {"Authorization": f"Bearer {access_token}"}
        step2_data = {
            "username": f"testfix_{timestamp}",
            "first_name": "Ivan",
            "last_name": "Petrov", 
            "complete_step": 2
        }
        
        resp = requests.patch(f"{BASE_URL}/auth/profile-step", json=step2_data, headers=headers, timeout=10)
        
        if resp.status_code != 200:
            log_test("Profile Step 2", "FAIL", f"Status {resp.status_code}: {resp.text}")
            return
            
        log_test("Profile Step 2", "PASS", "Step 2 completed successfully")
        
        # Check user_settings has the profile data
        settings_resp = requests.get(f"{BASE_URL}/user-settings/{uid}", timeout=10)
        
        if settings_resp.status_code != 200:
            log_test("Settings Profile Check", "FAIL", f"Status {settings_resp.status_code}: {settings_resp.text}")
            return
            
        settings_data = settings_resp.json()
        
        # Verify profile data is mirrored
        checks = [
            ("username", f"testfix_{timestamp}"),
            ("first_name", "Ivan"),
            ("last_name", "Petrov")
        ]
        
        all_passed = True
        for field, expected in checks:
            actual = settings_data.get(field)
            if actual == expected:
                log_test(f"Settings {field}", "PASS", f"{field} = {actual}")
            else:
                log_test(f"Settings {field}", "FAIL", f"{field} = {actual}, expected {expected}")
                all_passed = False
                
        if all_passed:
            log_test("Profile Data Mirror", "PASS", "All profile fields correctly mirrored")
            
    except requests.RequestException as e:
        log_test("Step 2 Test", "FAIL", f"Request error: {e}")

def test_regression_existing_flows():
    """Test 4: Regression - existing Stage 1 flow unchanged"""
    print("\n=== TEST 4: Regression testing existing flows ===")
    
    # Use existing test user to avoid rate limits
    existing_email = "testbug1776698837@example.com"
    existing_password = "testpass123"
    
    try:
        # Test login
        login_data = {"email": existing_email, "password": existing_password}
        resp = requests.post(f"{BASE_URL}/auth/login/email", json=login_data, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            access_token = data["access_token"]
            log_test("Email Login", "PASS", "Login successful")
            
            # Test /me endpoint
            headers = {"Authorization": f"Bearer {access_token}"}
            me_resp = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
            
            if me_resp.status_code == 200:
                log_test("GET /auth/me", "PASS", "Me endpoint working")
            else:
                log_test("GET /auth/me", "FAIL", f"Status {me_resp.status_code}: {me_resp.text}")
                
        else:
            log_test("Email Login", "FAIL", f"Status {resp.status_code}: {resp.text}")
            
        # Test username check
        test_username = f"testcheck_{int(time.time())}"
        resp = requests.get(f"{BASE_URL}/auth/check-username/{test_username}", timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("available") is True:
                log_test("Username Check", "PASS", f"Username {test_username} available")
            else:
                log_test("Username Check", "FAIL", f"Unexpected response: {data}")
        else:
            log_test("Username Check", "FAIL", f"Status {resp.status_code}: {resp.text}")
            
        # Test QR init
        resp = requests.post(f"{BASE_URL}/auth/login/qr/init", timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            qr_token = data.get("qr_token")
            if qr_token and data.get("status") == "pending":
                log_test("QR Init", "PASS", f"QR token: {qr_token[:8]}...")
                
                # Test QR status
                status_resp = requests.get(f"{BASE_URL}/auth/login/qr/{qr_token}/status", timeout=10)
                if status_resp.status_code == 200 and status_resp.json().get("status") == "pending":
                    log_test("QR Status", "PASS", "QR status endpoint working")
                else:
                    log_test("QR Status", "FAIL", f"Status {status_resp.status_code}: {status_resp.text}")
            else:
                log_test("QR Init", "FAIL", f"Unexpected response: {data}")
        else:
            log_test("QR Init", "FAIL", f"Status {resp.status_code}: {resp.text}")
            
    except requests.RequestException as e:
        log_test("Regression Tests", "FAIL", f"Request error: {e}")

def test_telegram_webapp_endpoint():
    """Test 5: Telegram WebApp endpoint returns proper error (not 500)"""
    print("\n=== TEST 5: Telegram WebApp endpoint error handling ===")
    
    # Test with synthetic/invalid init_data
    fake_data = {"init_data": "invalid_hmac_data"}
    
    try:
        resp = requests.post(f"{BASE_URL}/auth/login/telegram-webapp", json=fake_data, timeout=10)
        
        # Should return 400/401, not 500
        if resp.status_code in [400, 401]:
            log_test("Telegram WebApp Error", "PASS", f"Proper error code {resp.status_code} (not 500)")
        elif resp.status_code == 500:
            log_test("Telegram WebApp Error", "FAIL", "Returns 500 instead of 400/401")
        else:
            log_test("Telegram WebApp Error", "WARN", f"Unexpected status {resp.status_code}")
            
    except requests.RequestException as e:
        log_test("Telegram WebApp Test", "FAIL", f"Request error: {e}")

def test_idempotency():
    """Test 6: Idempotency checks"""
    print("\n=== TEST 6: Idempotency tests ===")
    
    # Test duplicate email registration
    existing_email = "testbug1776698837@example.com"
    duplicate_data = {
        "email": existing_email,
        "password": "testpass123",
        "first_name": "Duplicate"
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/auth/register/email", json=duplicate_data, timeout=10)
        
        if resp.status_code == 409:
            log_test("Duplicate Email Registration", "PASS", "Returns 409 Conflict as expected")
        else:
            log_test("Duplicate Email Registration", "FAIL", f"Status {resp.status_code}, expected 409")
            
    except requests.RequestException as e:
        log_test("Duplicate Registration Test", "FAIL", f"Request error: {e}")

def main():
    """Run all tests"""
    print("🧪 BACKEND TESTING: user_settings auto-upsert bug fix verification")
    print("=" * 70)
    
    # Test 1: Email registration creates user_settings
    uid, access_token = test_email_registration_creates_user_settings()
    
    # Test 2: Step 3 mirrors to user_settings
    test_step3_mirrors_to_user_settings(uid, access_token)
    
    # Test 3: Step 2 profile upserts username
    test_step2_profile_upserts_username()
    
    # Test 4: Regression testing
    test_regression_existing_flows()
    
    # Test 5: Telegram WebApp error handling
    test_telegram_webapp_endpoint()
    
    # Test 6: Idempotency
    test_idempotency()
    
    print("\n" + "=" * 70)
    print("🏁 TESTING COMPLETE")

if __name__ == "__main__":
    main()