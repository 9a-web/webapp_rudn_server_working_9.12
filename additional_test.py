#!/usr/bin/env python3
"""
Additional test for profile-step idempotency verification.
"""

import requests
import time
from datetime import datetime

BASE_URL = "http://localhost:8001/api"

def log_test(test_name, status, details=""):
    """Log test results with timestamp."""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_emoji = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"[{timestamp}] {status_emoji} {test_name}: {status}")
    if details:
        print(f"    {details}")

def test_profile_step_idempotency():
    """Test that repeating PATCH profile-step with complete_step=3 twice works without issues"""
    print("\n=== IDEMPOTENCY TEST: Repeat profile-step complete_step=3 ===")
    
    # Create fresh user
    timestamp = int(time.time())
    email = f"idempotent_{timestamp}@example.com"
    
    register_data = {
        "email": email,
        "password": "testpass123",
        "first_name": "Idempotent"
    }
    
    try:
        # Register
        resp = requests.post(f"{BASE_URL}/auth/register/email", json=register_data, timeout=10)
        if resp.status_code != 200:
            log_test("Registration", "FAIL", f"Status {resp.status_code}: {resp.text}")
            return
            
        data = resp.json()
        uid = data["user"]["uid"]
        access_token = data["access_token"]
        headers = {"Authorization": f"Bearer {access_token}"}
        
        log_test("Registration", "PASS", f"UID: {uid}")
        
        # First profile-step call with complete_step=3
        step3_data = {
            "facultet_id": "F2",
            "facultet_name": "Idempotent Faculty", 
            "level_id": "L2",
            "form_code": "zaochnaya",
            "kurs": "2",
            "group_id": "G2",
            "group_name": "IDEM-02",
            "complete_step": 3
        }
        
        resp1 = requests.patch(f"{BASE_URL}/auth/profile-step", json=step3_data, headers=headers, timeout=10)
        
        if resp1.status_code != 200:
            log_test("First Profile Step 3", "FAIL", f"Status {resp1.status_code}: {resp1.text}")
            return
            
        data1 = resp1.json()
        log_test("First Profile Step 3", "PASS", f"registration_step = {data1.get('registration_step')}")
        
        # Second identical call (should be idempotent)
        resp2 = requests.patch(f"{BASE_URL}/auth/profile-step", json=step3_data, headers=headers, timeout=10)
        
        if resp2.status_code != 200:
            log_test("Second Profile Step 3", "FAIL", f"Status {resp2.status_code}: {resp2.text}")
            return
            
        data2 = resp2.json()
        log_test("Second Profile Step 3", "PASS", f"registration_step = {data2.get('registration_step')}")
        
        # Verify user_settings still exists and has correct data
        settings_resp = requests.get(f"{BASE_URL}/user-settings/{uid}", timeout=10)
        
        if settings_resp.status_code != 200:
            log_test("Settings After Idempotent Call", "FAIL", f"Status {settings_resp.status_code}: {settings_resp.text}")
            return
            
        settings_data = settings_resp.json()
        
        # Check key fields
        if (settings_data.get("group_id") == "G2" and 
            settings_data.get("facultet_id") == "F2" and
            settings_data.get("telegram_id") == int(uid)):
            log_test("Settings After Idempotent Call", "PASS", "All fields preserved correctly")
        else:
            log_test("Settings After Idempotent Call", "FAIL", f"Data mismatch: {settings_data}")
            
    except requests.RequestException as e:
        log_test("Idempotency Test", "FAIL", f"Request error: {e}")

def test_existing_user_settings_lookup():
    """Test that existing user can still access their settings"""
    print("\n=== EXISTING USER TEST: Settings lookup ===")
    
    existing_email = "testbug1776698837@example.com"
    existing_password = "testpass123"
    existing_uid = "790850027"
    
    try:
        # Login
        login_data = {"email": existing_email, "password": existing_password}
        resp = requests.post(f"{BASE_URL}/auth/login/email", json=login_data, timeout=10)
        
        if resp.status_code != 200:
            log_test("Existing User Login", "FAIL", f"Status {resp.status_code}: {resp.text}")
            return
            
        log_test("Existing User Login", "PASS", "Login successful")
        
        # Check user_settings
        settings_resp = requests.get(f"{BASE_URL}/user-settings/{existing_uid}", timeout=10)
        
        if settings_resp.status_code == 200:
            settings_data = settings_resp.json()
            log_test("Existing User Settings", "PASS", f"telegram_id = {settings_data.get('telegram_id')}")
        else:
            log_test("Existing User Settings", "FAIL", f"Status {settings_resp.status_code}: {settings_resp.text}")
            
    except requests.RequestException as e:
        log_test("Existing User Test", "FAIL", f"Request error: {e}")

def main():
    """Run additional tests"""
    print("🧪 ADDITIONAL TESTING: Idempotency and edge cases")
    print("=" * 60)
    
    test_profile_step_idempotency()
    test_existing_user_settings_lookup()
    
    print("\n" + "=" * 60)
    print("🏁 ADDITIONAL TESTING COMPLETE")

if __name__ == "__main__":
    main()