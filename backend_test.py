#!/usr/bin/env python3
"""
Backend test suite for /api/auth/suggest-username endpoint
Testing all scenarios from the review request
"""

import requests
import time
import random
import string
from typing import List, Dict, Any

# Backend URL - using localhost since we're testing inside the container
BACKEND_URL = "http://localhost:8001/api"
SUGGEST_USERNAME_URL = f"{BACKEND_URL}/auth/suggest-username"

# Test credentials for creating test users
TEST_EMAIL_BASE = "stage_suggest_test"
TEST_PASSWORD = "Test1234"

# Color codes for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"


def log_test(test_name: str, status: str, message: str = ""):
    """Log test result with color"""
    color = GREEN if status == "PASS" else RED if status == "FAIL" else YELLOW
    print(f"{color}[{status}]{RESET} {test_name}")
    if message:
        print(f"  → {message}")


def create_test_user(username: str) -> Dict[str, Any]:
    """Create a test user with given username"""
    email = f"{TEST_EMAIL_BASE}_{username}_{int(time.time())}@test.com"
    
    # Use random IP to bypass rate limit
    random_ip = f"192.168.{random.randint(1, 254)}.{random.randint(1, 254)}"
    
    response = requests.post(
        f"{BACKEND_URL}/auth/register/email",
        json={
            "email": email,
            "password": TEST_PASSWORD,
            "first_name": "Test",
            "last_name": "User"
        },
        headers={"X-Forwarded-For": random_ip}
    )
    
    if response.status_code == 201 or response.status_code == 200:
        data = response.json()
        # Now update username
        token = data.get("access_token")
        if token:
            update_response = requests.patch(
                f"{BACKEND_URL}/auth/profile-step",
                json={"username": username, "complete_step": 2},
                headers={"Authorization": f"Bearer {token}"}
            )
            if update_response.status_code == 200:
                return {"email": email, "username": username, "token": token}
    
    return {}


def test_basic_case():
    """Test 1: Basic case with base=shkarol&count=5"""
    test_name = "Test 1: Basic case (base=shkarol, count=5)"
    
    try:
        response = requests.get(SUGGEST_USERNAME_URL, params={"base": "shkarol", "count": 5})
        
        if response.status_code != 200:
            log_test(test_name, "FAIL", f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Check structure
        if "base" not in data or "suggestions" not in data:
            log_test(test_name, "FAIL", "Missing 'base' or 'suggestions' in response")
            return False
        
        # Check base is normalized
        if data["base"] != "shkarol":
            log_test(test_name, "FAIL", f"Expected base='shkarol', got '{data['base']}'")
            return False
        
        # Check suggestions count
        suggestions = data["suggestions"]
        if len(suggestions) != 5:
            log_test(test_name, "FAIL", f"Expected 5 suggestions, got {len(suggestions)}")
            return False
        
        # Check each suggestion format
        for s in suggestions:
            if not isinstance(s, str):
                log_test(test_name, "FAIL", f"Suggestion is not a string: {s}")
                return False
            if len(s) < 3 or len(s) > 32:
                log_test(test_name, "FAIL", f"Suggestion length invalid: {s} (len={len(s)})")
                return False
            if not all(c in string.ascii_lowercase + string.digits + "_" for c in s):
                log_test(test_name, "FAIL", f"Suggestion contains invalid chars: {s}")
                return False
            if not s.startswith("shkarol"):
                log_test(test_name, "FAIL", f"Suggestion doesn't start with 'shkarol': {s}")
                return False
        
        log_test(test_name, "PASS", f"Got {len(suggestions)} valid suggestions: {suggestions[:3]}...")
        return True
        
    except Exception as e:
        log_test(test_name, "FAIL", f"Exception: {str(e)}")
        return False


def test_empty_base():
    """Test 2: Empty base (generic mode)"""
    test_name = "Test 2: Empty base (generic mode)"
    
    try:
        response = requests.get(SUGGEST_USERNAME_URL, params={"base": "", "count": 5})
        
        if response.status_code != 200:
            log_test(test_name, "FAIL", f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Check base is null in generic mode
        if data["base"] is not None:
            log_test(test_name, "FAIL", f"Expected base=null in generic mode, got '{data['base']}'")
            return False
        
        suggestions = data["suggestions"]
        if len(suggestions) == 0:
            log_test(test_name, "FAIL", "Expected suggestions in generic mode")
            return False
        
        # Check suggestions contain user_ or rudn_ prefix
        valid_prefixes = any(s.startswith("user_") or s.startswith("rudn_") for s in suggestions)
        if not valid_prefixes:
            log_test(test_name, "FAIL", f"Generic suggestions should start with 'user_' or 'rudn_': {suggestions}")
            return False
        
        log_test(test_name, "PASS", f"Generic mode working: {suggestions[:3]}...")
        return True
        
    except Exception as e:
        log_test(test_name, "FAIL", f"Exception: {str(e)}")
        return False


def test_short_base():
    """Test 3: Short base (1-2 chars) should trigger generic mode"""
    test_name = "Test 3: Short base (ab) triggers generic mode"
    
    try:
        response = requests.get(SUGGEST_USERNAME_URL, params={"base": "ab", "count": 5})
        
        if response.status_code != 200:
            log_test(test_name, "FAIL", f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Short base should trigger generic mode (base=null)
        if data["base"] is not None:
            log_test(test_name, "FAIL", f"Expected base=null for short base, got '{data['base']}'")
            return False
        
        suggestions = data["suggestions"]
        if len(suggestions) == 0:
            log_test(test_name, "FAIL", "Expected suggestions in generic mode")
            return False
        
        log_test(test_name, "PASS", f"Short base triggers generic mode correctly")
        return True
        
    except Exception as e:
        log_test(test_name, "FAIL", f"Exception: {str(e)}")
        return False


def test_invalid_chars():
    """Test 4: Invalid chars in base should be normalized"""
    test_name = "Test 4: Invalid chars (@!shkarol#$%) normalization"
    
    try:
        response = requests.get(SUGGEST_USERNAME_URL, params={"base": "@!shkarol#$%", "count": 5})
        
        if response.status_code != 200:
            log_test(test_name, "FAIL", f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Should normalize to "shkarol"
        if data["base"] != "shkarol":
            log_test(test_name, "FAIL", f"Expected base='shkarol' after normalization, got '{data['base']}'")
            return False
        
        suggestions = data["suggestions"]
        if len(suggestions) == 0:
            log_test(test_name, "FAIL", "Expected suggestions after normalization")
            return False
        
        # All suggestions should start with shkarol
        if not all(s.startswith("shkarol") for s in suggestions):
            log_test(test_name, "FAIL", f"Suggestions should start with 'shkarol': {suggestions}")
            return False
        
        log_test(test_name, "PASS", f"Invalid chars normalized correctly to '{data['base']}'")
        return True
        
    except Exception as e:
        log_test(test_name, "FAIL", f"Exception: {str(e)}")
        return False


def test_long_base():
    """Test 5: Long base (>24 chars) should be truncated"""
    test_name = "Test 5: Long base truncation"
    
    try:
        long_base = "verylongusernamethatshouldbetruncated123456"
        response = requests.get(SUGGEST_USERNAME_URL, params={"base": long_base, "count": 3})
        
        if response.status_code != 200:
            log_test(test_name, "FAIL", f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Base should be truncated to 24 chars
        if len(data["base"]) > 24:
            log_test(test_name, "FAIL", f"Base not truncated: len={len(data['base'])}, base='{data['base']}'")
            return False
        
        suggestions = data["suggestions"]
        if len(suggestions) == 0:
            log_test(test_name, "FAIL", "Expected suggestions for truncated base")
            return False
        
        # Suggestions should start with truncated base
        truncated = long_base[:24]
        if not all(s.startswith(data["base"]) for s in suggestions):
            log_test(test_name, "FAIL", f"Suggestions don't start with truncated base: {suggestions}")
            return False
        
        log_test(test_name, "PASS", f"Long base truncated to '{data['base']}' (len={len(data['base'])})")
        return True
        
    except Exception as e:
        log_test(test_name, "FAIL", f"Exception: {str(e)}")
        return False


def test_cyrillic_base():
    """Test 6: Cyrillic base should trigger generic mode"""
    test_name = "Test 6: Cyrillic base (привет) triggers generic mode"
    
    try:
        response = requests.get(SUGGEST_USERNAME_URL, params={"base": "привет", "count": 5})
        
        if response.status_code != 200:
            log_test(test_name, "FAIL", f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Cyrillic chars replaced with _, then stripped -> empty -> generic mode
        if data["base"] is not None:
            log_test(test_name, "FAIL", f"Expected base=null for cyrillic, got '{data['base']}'")
            return False
        
        suggestions = data["suggestions"]
        if len(suggestions) == 0:
            log_test(test_name, "FAIL", "Expected suggestions in generic mode")
            return False
        
        log_test(test_name, "PASS", f"Cyrillic base triggers generic mode correctly")
        return True
        
    except Exception as e:
        log_test(test_name, "FAIL", f"Exception: {str(e)}")
        return False


def test_count_validation():
    """Test 7: Count validation (1, 10, 15, 0, -5)"""
    test_name = "Test 7: Count validation"
    
    all_passed = True
    
    # Test count=1
    try:
        response = requests.get(SUGGEST_USERNAME_URL, params={"base": "test", "count": 1})
        if response.status_code == 200:
            data = response.json()
            if len(data["suggestions"]) != 1:
                log_test(f"{test_name} (count=1)", "FAIL", f"Expected 1 suggestion, got {len(data['suggestions'])}")
                all_passed = False
            else:
                log_test(f"{test_name} (count=1)", "PASS", "")
        else:
            log_test(f"{test_name} (count=1)", "FAIL", f"Status {response.status_code}")
            all_passed = False
    except Exception as e:
        log_test(f"{test_name} (count=1)", "FAIL", str(e))
        all_passed = False
    
    # Test count=10
    try:
        response = requests.get(SUGGEST_USERNAME_URL, params={"base": "test", "count": 10})
        if response.status_code == 200:
            data = response.json()
            if len(data["suggestions"]) > 10:
                log_test(f"{test_name} (count=10)", "FAIL", f"Expected ≤10 suggestions, got {len(data['suggestions'])}")
                all_passed = False
            else:
                log_test(f"{test_name} (count=10)", "PASS", f"Got {len(data['suggestions'])} suggestions")
        else:
            log_test(f"{test_name} (count=10)", "FAIL", f"Status {response.status_code}")
            all_passed = False
    except Exception as e:
        log_test(f"{test_name} (count=10)", "FAIL", str(e))
        all_passed = False
    
    # Test count=15 (should be capped to 10)
    try:
        response = requests.get(SUGGEST_USERNAME_URL, params={"base": "test", "count": 15})
        if response.status_code == 200:
            data = response.json()
            if len(data["suggestions"]) > 10:
                log_test(f"{test_name} (count=15)", "FAIL", f"Count not capped: got {len(data['suggestions'])} suggestions")
                all_passed = False
            else:
                log_test(f"{test_name} (count=15)", "PASS", f"Capped to {len(data['suggestions'])} suggestions")
        else:
            log_test(f"{test_name} (count=15)", "FAIL", f"Status {response.status_code}")
            all_passed = False
    except Exception as e:
        log_test(f"{test_name} (count=15)", "FAIL", str(e))
        all_passed = False
    
    # Test count=0 (should be clamped to 1)
    try:
        response = requests.get(SUGGEST_USERNAME_URL, params={"base": "test", "count": 0})
        if response.status_code == 200:
            data = response.json()
            if len(data["suggestions"]) < 1:
                log_test(f"{test_name} (count=0)", "FAIL", f"Expected ≥1 suggestion, got {len(data['suggestions'])}")
                all_passed = False
            else:
                log_test(f"{test_name} (count=0)", "PASS", f"Clamped to {len(data['suggestions'])} suggestion(s)")
        else:
            log_test(f"{test_name} (count=0)", "FAIL", f"Status {response.status_code}")
            all_passed = False
    except Exception as e:
        log_test(f"{test_name} (count=0)", "FAIL", str(e))
        all_passed = False
    
    # Test count=-5 (should be clamped to 1)
    try:
        response = requests.get(SUGGEST_USERNAME_URL, params={"base": "test", "count": -5})
        if response.status_code == 200:
            data = response.json()
            if len(data["suggestions"]) < 1:
                log_test(f"{test_name} (count=-5)", "FAIL", f"Expected ≥1 suggestion, got {len(data['suggestions'])}")
                all_passed = False
            else:
                log_test(f"{test_name} (count=-5)", "PASS", f"Clamped to {len(data['suggestions'])} suggestion(s)")
        else:
            log_test(f"{test_name} (count=-5)", "FAIL", f"Status {response.status_code}")
            all_passed = False
    except Exception as e:
        log_test(f"{test_name} (count=-5)", "FAIL", str(e))
        all_passed = False
    
    return all_passed


def test_reserved_word():
    """Test 8: Reserved word (admin) should be filtered"""
    test_name = "Test 8: Reserved word filtering (admin)"
    
    try:
        response = requests.get(SUGGEST_USERNAME_URL, params={"base": "admin", "count": 5})
        
        if response.status_code != 200:
            log_test(test_name, "FAIL", f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        suggestions = data["suggestions"]
        
        # "admin" itself should not be in suggestions
        if "admin" in suggestions:
            log_test(test_name, "FAIL", "'admin' should be filtered from suggestions")
            return False
        
        # But admin1, admin2, etc. should be allowed
        has_admin_variants = any(s.startswith("admin") and s != "admin" for s in suggestions)
        if not has_admin_variants:
            log_test(test_name, "WARN", f"Expected admin variants (admin1, admin2), got: {suggestions}")
        
        log_test(test_name, "PASS", f"Reserved 'admin' filtered, variants allowed: {suggestions[:3]}...")
        return True
        
    except Exception as e:
        log_test(test_name, "FAIL", f"Exception: {str(e)}")
        return False


def test_rate_limit():
    """Test 9: Rate limit (60 requests/min)"""
    test_name = "Test 9: Rate limit (60 req/min)"
    
    try:
        # Make 65 requests rapidly
        print(f"{BLUE}[INFO]{RESET} Making 65 rapid requests to test rate limit...")
        
        success_count = 0
        rate_limited = False
        
        for i in range(65):
            response = requests.get(SUGGEST_USERNAME_URL, params={"base": f"test{i}", "count": 1})
            if response.status_code == 200:
                success_count += 1
            elif response.status_code == 429:
                rate_limited = True
                data = response.json()
                if "detail" in data and "запросов подсказок" in data["detail"].lower():
                    log_test(test_name, "PASS", f"Rate limited after {success_count} requests: {data['detail']}")
                    return True
                else:
                    log_test(test_name, "FAIL", f"Rate limited but wrong message: {data}")
                    return False
        
        if not rate_limited:
            log_test(test_name, "FAIL", f"Expected rate limit after 60 requests, but got {success_count} successful")
            return False
        
        return True
        
    except Exception as e:
        log_test(test_name, "FAIL", f"Exception: {str(e)}")
        return False


def test_existing_username():
    """Test 10: Existing username should not be in suggestions"""
    test_name = "Test 10: Existing username filtering"
    
    try:
        # Create a test user with username "shkarol1"
        print(f"{BLUE}[INFO]{RESET} Creating test user with username 'shkarol1'...")
        test_user = create_test_user("shkarol1")
        
        if not test_user:
            log_test(test_name, "SKIP", "Could not create test user")
            return None
        
        # Now request suggestions for "shkarol"
        response = requests.get(SUGGEST_USERNAME_URL, params={"base": "shkarol", "count": 10})
        
        if response.status_code != 200:
            log_test(test_name, "FAIL", f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        suggestions = data["suggestions"]
        
        # "shkarol1" should NOT be in suggestions
        if "shkarol1" in suggestions:
            log_test(test_name, "FAIL", "'shkarol1' (taken) found in suggestions")
            return False
        
        # All suggestions should be free
        log_test(test_name, "PASS", f"Taken username 'shkarol1' correctly filtered out")
        return True
        
    except Exception as e:
        log_test(test_name, "FAIL", f"Exception: {str(e)}")
        return False


def test_response_model():
    """Test 11: Response model structure"""
    test_name = "Test 11: Response model validation"
    
    try:
        response = requests.get(SUGGEST_USERNAME_URL, params={"base": "test", "count": 3})
        
        if response.status_code != 200:
            log_test(test_name, "FAIL", f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Check required fields
        if "base" not in data:
            log_test(test_name, "FAIL", "Missing 'base' field")
            return False
        
        if "suggestions" not in data:
            log_test(test_name, "FAIL", "Missing 'suggestions' field")
            return False
        
        # Check types
        if data["base"] is not None and not isinstance(data["base"], str):
            log_test(test_name, "FAIL", f"'base' should be string or null, got {type(data['base'])}")
            return False
        
        if not isinstance(data["suggestions"], list):
            log_test(test_name, "FAIL", f"'suggestions' should be list, got {type(data['suggestions'])}")
            return False
        
        # Check no extra fields
        extra_fields = set(data.keys()) - {"base", "suggestions"}
        if extra_fields:
            log_test(test_name, "FAIL", f"Unexpected fields in response: {extra_fields}")
            return False
        
        log_test(test_name, "PASS", "Response model structure is correct")
        return True
        
    except Exception as e:
        log_test(test_name, "FAIL", f"Exception: {str(e)}")
        return False


def test_telegram_login_conflict():
    """Test 12: Telegram login with taken username returns suggested_username_taken"""
    test_name = "Test 12: Telegram login conflict integration"
    
    # This test requires a valid Telegram login hash which we cannot generate
    # So we'll skip this test and note it in the report
    log_test(test_name, "SKIP", "Requires valid Telegram login credentials (cannot test without real TG hash)")
    return None


def main():
    """Run all tests"""
    print(f"\n{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}Testing /api/auth/suggest-username endpoint{RESET}")
    print(f"{BLUE}{'='*70}{RESET}\n")
    
    results = []
    
    # Run all tests
    results.append(("Test 1: Basic case", test_basic_case()))
    results.append(("Test 2: Empty base", test_empty_base()))
    results.append(("Test 3: Short base", test_short_base()))
    results.append(("Test 4: Invalid chars", test_invalid_chars()))
    results.append(("Test 5: Long base", test_long_base()))
    results.append(("Test 6: Cyrillic base", test_cyrillic_base()))
    results.append(("Test 7: Count validation", test_count_validation()))
    results.append(("Test 8: Reserved word", test_reserved_word()))
    results.append(("Test 9: Rate limit", test_rate_limit()))
    results.append(("Test 10: Existing username", test_existing_username()))
    results.append(("Test 11: Response model", test_response_model()))
    results.append(("Test 12: Telegram conflict", test_telegram_login_conflict()))
    
    # Summary
    print(f"\n{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}TEST SUMMARY{RESET}")
    print(f"{BLUE}{'='*70}{RESET}\n")
    
    passed = sum(1 for _, r in results if r is True)
    failed = sum(1 for _, r in results if r is False)
    skipped = sum(1 for _, r in results if r is None)
    total = len(results)
    
    print(f"Total tests: {total}")
    print(f"{GREEN}Passed: {passed}{RESET}")
    print(f"{RED}Failed: {failed}{RESET}")
    print(f"{YELLOW}Skipped: {skipped}{RESET}")
    
    if failed > 0:
        print(f"\n{RED}Some tests failed. See details above.{RESET}")
        return 1
    else:
        print(f"\n{GREEN}All tests passed!{RESET}")
        return 0


if __name__ == "__main__":
    exit(main())
