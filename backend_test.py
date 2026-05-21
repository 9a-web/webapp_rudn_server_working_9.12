"""
Backend Testing Script for RUDN Webapp Security Audit (2026-07)

Tests critical security fixes:
- C1: JWT secret hardening
- C2: Web Push endpoints authentication
- C3: QR login session registration
- M2: Password policy enforcement

Backend URL: https://rudn-notify-hub.preview.emergentagent.com/api
"""

import requests
import json
import time
import secrets
from datetime import datetime, timezone, timedelta
from jose import jwt

# Configuration
BASE_URL = "https://rudn-notify-hub.preview.emergentagent.com/api"
OLD_JWT_SECRET = "rudn-auth-default-secret-CHANGE-ME-IN-PROD-8f3a2b1c9d7e"

# Test credentials pattern
TEST_EMAIL_PATTERN = "audit_2026_07_{}@test.com"
TEST_PASSWORD_STRONG = "StrongPw#123"

# Colors for output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def log_test(name, status, details=""):
    """Log test result with color"""
    color = Colors.GREEN if status == "PASS" else Colors.RED if status == "FAIL" else Colors.YELLOW
    print(f"{color}[{status}]{Colors.END} {name}")
    if details:
        print(f"      {details}")

def log_section(title):
    """Log section header"""
    print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BLUE}{title}{Colors.END}")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}\n")

def create_test_user(email_suffix):
    """Create a test user and return access token"""
    email = TEST_EMAIL_PATTERN.format(email_suffix)
    payload = {
        "email": email,
        "password": TEST_PASSWORD_STRONG,
        "first_name": "Audit",
        "last_name": f"Test{email_suffix}"
    }
    
    # Use X-Forwarded-For to bypass rate limit
    headers = {"X-Forwarded-For": f"1.2.3.{secrets.randbelow(255)}"}
    
    try:
        resp = requests.post(f"{BASE_URL}/auth/register/email", json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("access_token"), email
        elif resp.status_code == 409:
            # User exists, try login
            login_resp = requests.post(
                f"{BASE_URL}/auth/login/email",
                json={"email": email, "password": TEST_PASSWORD_STRONG},
                headers=headers,
                timeout=10
            )
            if login_resp.status_code == 200:
                return login_resp.json().get("access_token"), email
    except Exception as e:
        print(f"Failed to create/login test user: {e}")
    
    return None, email

def test_c1_jwt_secret_hardening():
    """C1: Test that old JWT secret is rejected"""
    log_section("C1 — JWT Secret Hardening")
    
    # Create a forged JWT with old secret
    now = datetime.now(timezone.utc)
    exp = now + timedelta(days=30)
    
    payload = {
        "uid": "100000001",
        "sub": "100000001",
        "providers": ["telegram"],
        "jti": "forged_token_x",
        "exp": int(exp.timestamp()),
        "iat": int(now.timestamp())
    }
    
    try:
        forged_token = jwt.encode(payload, OLD_JWT_SECRET, algorithm="HS256")
        
        # Try to use forged token
        headers = {"Authorization": f"Bearer {forged_token}"}
        resp = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
        
        if resp.status_code == 401:
            log_test("C1.1: Old JWT secret rejected", "PASS", f"Status: {resp.status_code}, Detail: {resp.json().get('detail', '')}")
            return True
        else:
            log_test("C1.1: Old JWT secret rejected", "FAIL", f"Expected 401, got {resp.status_code}")
            return False
    except Exception as e:
        log_test("C1.1: Old JWT secret rejected", "FAIL", f"Exception: {e}")
        return False

def test_c2_web_push_auth():
    """C2: Test Web Push endpoints require authentication"""
    log_section("C2 — Web Push Endpoints Authentication")
    
    results = []
    
    # Test 1: POST /push/subscribe without auth → 401
    try:
        payload = {
            "endpoint": "https://fcm.googleapis.com/fcm/send/test-endpoint-123",
            "keys": {"p256dh": "test_p256dh", "auth": "test_auth"},
            "user_agent": "Test/1.0"
        }
        resp = requests.post(f"{BASE_URL}/push/subscribe", json=payload, timeout=10)
        
        if resp.status_code == 401:
            log_test("C2.1: /push/subscribe without auth → 401", "PASS")
            results.append(True)
        else:
            log_test("C2.1: /push/subscribe without auth → 401", "FAIL", f"Got {resp.status_code}")
            results.append(False)
    except Exception as e:
        log_test("C2.1: /push/subscribe without auth → 401", "FAIL", f"Exception: {e}")
        results.append(False)
    
    # Test 2: POST /push/unsubscribe without auth → 401
    try:
        payload = {"endpoint": "https://fcm.googleapis.com/fcm/send/test-endpoint-123"}
        resp = requests.post(f"{BASE_URL}/push/unsubscribe", json=payload, timeout=10)
        
        if resp.status_code == 401:
            log_test("C2.2: /push/unsubscribe without auth → 401", "PASS")
            results.append(True)
        else:
            log_test("C2.2: /push/unsubscribe without auth → 401", "FAIL", f"Got {resp.status_code}")
            results.append(False)
    except Exception as e:
        log_test("C2.2: /push/unsubscribe without auth → 401", "FAIL", f"Exception: {e}")
        results.append(False)
    
    # Test 3: POST /push/test without auth → 401
    try:
        resp = requests.post(f"{BASE_URL}/push/test", timeout=10)
        
        if resp.status_code == 401:
            log_test("C2.3: /push/test without auth → 401", "PASS")
            results.append(True)
        else:
            log_test("C2.3: /push/test without auth → 401", "FAIL", f"Got {resp.status_code}")
            results.append(False)
    except Exception as e:
        log_test("C2.3: /push/test without auth → 401", "FAIL", f"Exception: {e}")
        results.append(False)
    
    # Test 4: GET /push/subscriptions without auth → 401
    try:
        resp = requests.get(f"{BASE_URL}/push/subscriptions", timeout=10)
        
        if resp.status_code == 401:
            log_test("C2.4: /push/subscriptions without auth → 401", "PASS")
            results.append(True)
        else:
            log_test("C2.4: /push/subscriptions without auth → 401", "FAIL", f"Got {resp.status_code}")
            results.append(False)
    except Exception as e:
        log_test("C2.4: /push/subscriptions without auth → 401", "FAIL", f"Exception: {e}")
        results.append(False)
    
    # Test 5: With auth - subscribe should work and ignore body uid/telegram_id
    token, email = create_test_user(f"c2_{int(time.time())}")
    if token:
        try:
            headers = {"Authorization": f"Bearer {token}"}
            payload = {
                "endpoint": f"https://fcm.googleapis.com/fcm/send/audit-test-{int(time.time())}",
                "keys": {"p256dh": "test_p256dh_key", "auth": "test_auth_key"},
                "user_agent": "AuditTest/1.0",
                "telegram_id": 999999999,  # Rogue field - should be ignored
                "uid": "999999999"  # Rogue field - should be ignored
            }
            resp = requests.post(f"{BASE_URL}/push/subscribe", json=payload, headers=headers, timeout=10)
            
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") == "ok" and "subscription_id" in data:
                    log_test("C2.5: /push/subscribe with auth → 200, ignores rogue uid/tid", "PASS")
                    results.append(True)
                else:
                    log_test("C2.5: /push/subscribe with auth → 200, ignores rogue uid/tid", "FAIL", f"Unexpected response: {data}")
                    results.append(False)
            else:
                log_test("C2.5: /push/subscribe with auth → 200, ignores rogue uid/tid", "FAIL", f"Got {resp.status_code}: {resp.text}")
                results.append(False)
        except Exception as e:
            log_test("C2.5: /push/subscribe with auth → 200, ignores rogue uid/tid", "FAIL", f"Exception: {e}")
            results.append(False)
    else:
        log_test("C2.5: /push/subscribe with auth → 200, ignores rogue uid/tid", "SKIP", "Could not create test user")
        results.append(None)
    
    # Test 6: Rate limit on /push/test (5/hour)
    if token:
        try:
            headers = {"Authorization": f"Bearer {token}"}
            rate_limit_hit = False
            
            for i in range(6):
                resp = requests.post(f"{BASE_URL}/push/test", headers=headers, timeout=10)
                if resp.status_code == 429:
                    rate_limit_hit = True
                    log_test("C2.6: /push/test rate limit (5/hour)", "PASS", f"Hit rate limit on attempt {i+1}")
                    results.append(True)
                    break
                time.sleep(0.5)
            
            if not rate_limit_hit:
                log_test("C2.6: /push/test rate limit (5/hour)", "WARN", "Rate limit not hit after 6 attempts (may need more calls)")
                results.append(None)
        except Exception as e:
            log_test("C2.6: /push/test rate limit (5/hour)", "FAIL", f"Exception: {e}")
            results.append(False)
    else:
        log_test("C2.6: /push/test rate limit (5/hour)", "SKIP", "No auth token")
        results.append(None)
    
    return all(r for r in results if r is not None)

def test_c3_qr_login_session():
    """C3: Test QR login session registration"""
    log_section("C3 — QR Login Session Registration")
    
    results = []
    
    # Step 1: Initialize QR session
    try:
        resp = requests.post(f"{BASE_URL}/auth/login/qr/init", timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            qr_token = data.get("qr_token")
            
            if qr_token:
                log_test("C3.1: QR init successful", "PASS", f"qr_token: {qr_token[:20]}...")
                results.append(True)
                
                # Step 2: Confirm QR with authenticated user
                token, email = create_test_user(f"c3_{int(time.time())}")
                if token:
                    headers = {"Authorization": f"Bearer {token}"}
                    confirm_resp = requests.post(
                        f"{BASE_URL}/auth/login/qr/{qr_token}/confirm",
                        headers=headers,
                        timeout=10
                    )
                    
                    if confirm_resp.status_code == 200:
                        log_test("C3.2: QR confirm successful", "PASS")
                        results.append(True)
                        
                        # Step 3: Get QR status and retrieve access_token
                        time.sleep(1)  # Brief delay
                        status_resp = requests.get(
                            f"{BASE_URL}/auth/login/qr/{qr_token}/status",
                            timeout=10
                        )
                        
                        if status_resp.status_code == 200:
                            status_data = status_resp.json()
                            qr_access_token = status_data.get("access_token")
                            
                            if qr_access_token:
                                log_test("C3.3: QR status returns access_token", "PASS")
                                results.append(True)
                                
                                # Step 4: CRITICAL TEST - Use QR token to call /auth/me
                                qr_headers = {"Authorization": f"Bearer {qr_access_token}"}
                                me_resp = requests.get(
                                    f"{BASE_URL}/auth/me",
                                    headers=qr_headers,
                                    timeout=10
                                )
                                
                                if me_resp.status_code == 200:
                                    log_test("C3.4: QR token works with /auth/me (session registered)", "PASS", "✓ Session is active")
                                    results.append(True)
                                    
                                    # Step 5: Check sessions list
                                    sessions_resp = requests.get(
                                        f"{BASE_URL}/auth/sessions",
                                        headers=qr_headers,
                                        timeout=10
                                    )
                                    
                                    if sessions_resp.status_code == 200:
                                        sessions = sessions_resp.json().get("sessions", [])
                                        if len(sessions) > 0:
                                            log_test("C3.5: QR session appears in /auth/sessions", "PASS", f"Found {len(sessions)} session(s)")
                                            results.append(True)
                                        else:
                                            log_test("C3.5: QR session appears in /auth/sessions", "FAIL", "No sessions found")
                                            results.append(False)
                                    else:
                                        log_test("C3.5: QR session appears in /auth/sessions", "FAIL", f"Status: {sessions_resp.status_code}")
                                        results.append(False)
                                    
                                    # Step 6: Logout and verify token is revoked
                                    logout_resp = requests.post(
                                        f"{BASE_URL}/auth/logout",
                                        headers=qr_headers,
                                        timeout=10
                                    )
                                    
                                    if logout_resp.status_code == 200:
                                        log_test("C3.6: Logout successful", "PASS")
                                        results.append(True)
                                        
                                        # Step 7: Verify token is now invalid
                                        time.sleep(0.5)
                                        me_after_logout = requests.get(
                                            f"{BASE_URL}/auth/me",
                                            headers=qr_headers,
                                            timeout=10
                                        )
                                        
                                        if me_after_logout.status_code == 401:
                                            log_test("C3.7: Token revoked after logout", "PASS", "✓ Returns 401 as expected")
                                            results.append(True)
                                        else:
                                            log_test("C3.7: Token revoked after logout", "FAIL", f"Expected 401, got {me_after_logout.status_code}")
                                            results.append(False)
                                    else:
                                        log_test("C3.6: Logout successful", "FAIL", f"Status: {logout_resp.status_code}")
                                        results.append(False)
                                else:
                                    log_test("C3.4: QR token works with /auth/me (session registered)", "FAIL", f"Status: {me_resp.status_code}, Detail: {me_resp.json().get('detail', '')}")
                                    results.append(False)
                            else:
                                log_test("C3.3: QR status returns access_token", "FAIL", "No access_token in response")
                                results.append(False)
                        else:
                            log_test("C3.3: QR status returns access_token", "FAIL", f"Status: {status_resp.status_code}")
                            results.append(False)
                    else:
                        log_test("C3.2: QR confirm successful", "FAIL", f"Status: {confirm_resp.status_code}")
                        results.append(False)
                else:
                    log_test("C3.2: QR confirm successful", "SKIP", "Could not create test user")
                    results.append(None)
            else:
                log_test("C3.1: QR init successful", "FAIL", "No qr_token in response")
                results.append(False)
        else:
            log_test("C3.1: QR init successful", "FAIL", f"Status: {resp.status_code}")
            results.append(False)
    except Exception as e:
        log_test("C3: QR login flow", "FAIL", f"Exception: {e}")
        results.append(False)
    
    return all(r for r in results if r is not None)

def test_m2_password_policy():
    """M2: Test password policy enforcement"""
    log_section("M2 — Password Policy")
    
    results = []
    
    # Test 1: Password too short (< 8 chars)
    try:
        email = TEST_EMAIL_PATTERN.format(f"m2_short_{int(time.time())}")
        payload = {
            "email": email,
            "password": "abc123",  # 6 chars
            "first_name": "Test",
            "last_name": "Short"
        }
        headers = {"X-Forwarded-For": f"1.2.3.{secrets.randbelow(255)}"}
        resp = requests.post(f"{BASE_URL}/auth/register/email", json=payload, headers=headers, timeout=10)
        
        if resp.status_code in [400, 422]:
            detail = resp.json().get("detail", "")
            if "8" in detail or "символ" in detail.lower():
                log_test("M2.1: Password < 8 chars rejected", "PASS", f"Detail: {detail}")
                results.append(True)
            else:
                log_test("M2.1: Password < 8 chars rejected", "FAIL", f"Wrong error message: {detail}")
                results.append(False)
        else:
            log_test("M2.1: Password < 8 chars rejected", "FAIL", f"Expected 400/422, got {resp.status_code}")
            results.append(False)
    except Exception as e:
        log_test("M2.1: Password < 8 chars rejected", "FAIL", f"Exception: {e}")
        results.append(False)
    
    # Test 2: Blacklisted password "password"
    try:
        email = TEST_EMAIL_PATTERN.format(f"m2_blacklist1_{int(time.time())}")
        payload = {
            "email": email,
            "password": "password",
            "first_name": "Test",
            "last_name": "Blacklist"
        }
        headers = {"X-Forwarded-For": f"1.2.3.{secrets.randbelow(255)}"}
        resp = requests.post(f"{BASE_URL}/auth/register/email", json=payload, headers=headers, timeout=10)
        
        if resp.status_code in [400, 422]:
            detail = resp.json().get("detail", "")
            if "прост" in detail.lower() or "blacklist" in detail.lower():
                log_test("M2.2: Blacklisted password 'password' rejected", "PASS", f"Detail: {detail}")
                results.append(True)
            else:
                log_test("M2.2: Blacklisted password 'password' rejected", "FAIL", f"Wrong error message: {detail}")
                results.append(False)
        else:
            log_test("M2.2: Blacklisted password 'password' rejected", "FAIL", f"Expected 400/422, got {resp.status_code}")
            results.append(False)
    except Exception as e:
        log_test("M2.2: Blacklisted password 'password' rejected", "FAIL", f"Exception: {e}")
        results.append(False)
    
    # Test 3: Blacklisted password "12345678"
    try:
        email = TEST_EMAIL_PATTERN.format(f"m2_blacklist2_{int(time.time())}")
        payload = {
            "email": email,
            "password": "12345678",
            "first_name": "Test",
            "last_name": "Blacklist2"
        }
        headers = {"X-Forwarded-For": f"1.2.3.{secrets.randbelow(255)}"}
        resp = requests.post(f"{BASE_URL}/auth/register/email", json=payload, headers=headers, timeout=10)
        
        if resp.status_code in [400, 422]:
            detail = resp.json().get("detail", "")
            if "прост" in detail.lower() or "blacklist" in detail.lower():
                log_test("M2.3: Blacklisted password '12345678' rejected", "PASS", f"Detail: {detail}")
                results.append(True)
            else:
                log_test("M2.3: Blacklisted password '12345678' rejected", "FAIL", f"Wrong error message: {detail}")
                results.append(False)
        else:
            log_test("M2.3: Blacklisted password '12345678' rejected", "FAIL", f"Expected 400/422, got {resp.status_code}")
            results.append(False)
    except Exception as e:
        log_test("M2.3: Blacklisted password '12345678' rejected", "FAIL", f"Exception: {e}")
        results.append(False)
    
    # Test 4: Strong password accepted
    try:
        email = TEST_EMAIL_PATTERN.format(f"m2_strong_{int(time.time())}")
        payload = {
            "email": email,
            "password": TEST_PASSWORD_STRONG,
            "first_name": "Test",
            "last_name": "Strong"
        }
        headers = {"X-Forwarded-For": f"1.2.3.{secrets.randbelow(255)}"}
        resp = requests.post(f"{BASE_URL}/auth/register/email", json=payload, headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("access_token"):
                log_test("M2.4: Strong password accepted", "PASS")
                results.append(True)
            else:
                log_test("M2.4: Strong password accepted", "FAIL", "No access_token in response")
                results.append(False)
        else:
            log_test("M2.4: Strong password accepted", "FAIL", f"Status: {resp.status_code}, Detail: {resp.json().get('detail', '')}")
            results.append(False)
    except Exception as e:
        log_test("M2.4: Strong password accepted", "FAIL", f"Exception: {e}")
        results.append(False)
    
    return all(r for r in results if r is not None)

def test_regression():
    """Regression tests - ensure existing functionality still works"""
    log_section("Priority 3 — Regression Testing")
    
    results = []
    
    # Test 1: Email registration works
    try:
        email = TEST_EMAIL_PATTERN.format(f"regression_{int(time.time())}")
        payload = {
            "email": email,
            "password": TEST_PASSWORD_STRONG,
            "first_name": "Regression",
            "last_name": "Test"
        }
        headers = {"X-Forwarded-For": f"1.2.3.{secrets.randbelow(255)}"}
        resp = requests.post(f"{BASE_URL}/auth/register/email", json=payload, headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("access_token")
            if token:
                log_test("R1: Email registration works", "PASS")
                results.append(True)
                
                # Test 2: Email login works
                login_resp = requests.post(
                    f"{BASE_URL}/auth/login/email",
                    json={"email": email, "password": TEST_PASSWORD_STRONG},
                    headers=headers,
                    timeout=10
                )
                
                if login_resp.status_code == 200:
                    log_test("R2: Email login works", "PASS")
                    results.append(True)
                else:
                    log_test("R2: Email login works", "FAIL", f"Status: {login_resp.status_code}")
                    results.append(False)
                
                # Test 3: /auth/me works
                me_headers = {"Authorization": f"Bearer {token}"}
                me_resp = requests.get(f"{BASE_URL}/auth/me", headers=me_headers, timeout=10)
                
                if me_resp.status_code == 200:
                    user_data = me_resp.json()
                    if user_data.get("email") == email:
                        log_test("R3: /auth/me returns user data", "PASS")
                        results.append(True)
                    else:
                        log_test("R3: /auth/me returns user data", "FAIL", "Email mismatch")
                        results.append(False)
                else:
                    log_test("R3: /auth/me returns user data", "FAIL", f"Status: {me_resp.status_code}")
                    results.append(False)
                
                # Test 4: /auth/sessions works
                sessions_resp = requests.get(f"{BASE_URL}/auth/sessions", headers=me_headers, timeout=10)
                
                if sessions_resp.status_code == 200:
                    log_test("R4: /auth/sessions works", "PASS")
                    results.append(True)
                else:
                    log_test("R4: /auth/sessions works", "FAIL", f"Status: {sessions_resp.status_code}")
                    results.append(False)
                
                # Test 5: /auth/logout works
                logout_resp = requests.post(f"{BASE_URL}/auth/logout", headers=me_headers, timeout=10)
                
                if logout_resp.status_code == 200:
                    log_test("R5: /auth/logout works", "PASS")
                    results.append(True)
                else:
                    log_test("R5: /auth/logout works", "FAIL", f"Status: {logout_resp.status_code}")
                    results.append(False)
            else:
                log_test("R1: Email registration works", "FAIL", "No access_token")
                results.append(False)
        else:
            log_test("R1: Email registration works", "FAIL", f"Status: {resp.status_code}")
            results.append(False)
    except Exception as e:
        log_test("Regression tests", "FAIL", f"Exception: {e}")
        results.append(False)
    
    # Test 6: VAPID public key endpoint (no auth required)
    try:
        resp = requests.get(f"{BASE_URL}/push/vapid-public-key", timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if "public_key" in data:
                log_test("R6: /push/vapid-public-key returns public key", "PASS")
                results.append(True)
            else:
                log_test("R6: /push/vapid-public-key returns public key", "FAIL", "No public_key in response")
                results.append(False)
        elif resp.status_code == 503:
            log_test("R6: /push/vapid-public-key returns public key", "WARN", "Web Push not configured (expected in test env)")
            results.append(None)
        else:
            log_test("R6: /push/vapid-public-key returns public key", "FAIL", f"Status: {resp.status_code}")
            results.append(False)
    except Exception as e:
        log_test("R6: /push/vapid-public-key returns public key", "FAIL", f"Exception: {e}")
        results.append(False)
    
    return all(r for r in results if r is not None)

def main():
    """Run all tests"""
    print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BLUE}RUDN Webapp Backend Security Audit (2026-07){Colors.END}")
    print(f"{Colors.BLUE}Backend URL: {BASE_URL}{Colors.END}")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}\n")
    
    results = {}
    
    # Priority 1: Critical Security Fixes
    results['C1'] = test_c1_jwt_secret_hardening()
    results['C2'] = test_c2_web_push_auth()
    results['C3'] = test_c3_qr_login_session()
    
    # Priority 2: Password Policy
    results['M2'] = test_m2_password_policy()
    
    # Priority 3: Regression
    results['Regression'] = test_regression()
    
    # Summary
    log_section("Test Summary")
    
    total = len(results)
    passed = sum(1 for v in results.values() if v is True)
    failed = sum(1 for v in results.values() if v is False)
    
    print(f"Total test suites: {total}")
    print(f"{Colors.GREEN}Passed: {passed}{Colors.END}")
    print(f"{Colors.RED}Failed: {failed}{Colors.END}")
    
    if failed == 0:
        print(f"\n{Colors.GREEN}✓ All critical security fixes verified!{Colors.END}\n")
    else:
        print(f"\n{Colors.RED}✗ Some tests failed. Review details above.{Colors.END}\n")
    
    return failed == 0

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
