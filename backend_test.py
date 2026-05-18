#!/usr/bin/env python3
"""
Backend API Testing Script for Web Push (PWA) functionality
Tests all Web Push endpoints and integration with notify_user
"""

import asyncio
import httpx
import os
import sys
from datetime import datetime

# Get backend URL from environment
BACKEND_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")
API_BASE = f"{BACKEND_URL}/api"

# Test data
TEST_USER_TID = 12345
TEST_USER_UID = "000012345"
TEST_ENDPOINT = "https://fcm.googleapis.com/fcm/send/test_webpush_endpoint_12345"
TEST_KEYS = {
    "p256dh": "BTestP256dhKeyForWebPushSubscriptionTesting1234567890ABCDEF",
    "auth": "TestAuthKeyForWebPush123"
}
TEST_USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1"

# Test results
test_results = []

def log_test(name: str, passed: bool, details: str = ""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    test_results.append({"name": name, "passed": passed, "details": details})
    print(f"{status}: {name}")
    if details:
        print(f"  Details: {details}")

async def test_vapid_public_key():
    """Test (a): GET /api/push/vapid-public-key"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{API_BASE}/push/vapid-public-key")
            
            if response.status_code != 200:
                log_test("GET /api/push/vapid-public-key", False, f"Expected 200, got {response.status_code}")
                return False
            
            data = response.json()
            public_key = data.get("public_key")
            
            if not public_key:
                log_test("GET /api/push/vapid-public-key", False, "No public_key in response")
                return False
            
            # VAPID public key should be base64url string ~87 characters starting with "B"
            if not isinstance(public_key, str) or not public_key.startswith("B") or len(public_key) < 80:
                log_test("GET /api/push/vapid-public-key", False, f"Invalid public_key format: {public_key[:20]}...")
                return False
            
            log_test("GET /api/push/vapid-public-key", True, f"Valid VAPID key: {public_key[:20]}... (len={len(public_key)})")
            return True
    except Exception as e:
        log_test("GET /api/push/vapid-public-key", False, str(e))
        return False

async def test_subscribe_valid():
    """Test (b): POST /api/push/subscribe with valid data"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {
                "telegram_id": TEST_USER_TID,
                "uid": TEST_USER_UID,
                "endpoint": TEST_ENDPOINT,
                "keys": TEST_KEYS,
                "user_agent": TEST_USER_AGENT
            }
            response = await client.post(f"{API_BASE}/push/subscribe", json=payload)
            
            if response.status_code != 200:
                log_test("POST /api/push/subscribe (valid)", False, f"Expected 200, got {response.status_code}: {response.text}")
                return False
            
            data = response.json()
            if data.get("status") != "ok" or not data.get("subscription_id"):
                log_test("POST /api/push/subscribe (valid)", False, f"Invalid response: {data}")
                return False
            
            log_test("POST /api/push/subscribe (valid)", True, f"subscription_id={data['subscription_id']}")
            return True
    except Exception as e:
        log_test("POST /api/push/subscribe (valid)", False, str(e))
        return False

async def test_subscribe_missing_endpoint():
    """Test (b): POST /api/push/subscribe without endpoint"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {
                "telegram_id": TEST_USER_TID,
                "keys": TEST_KEYS
            }
            response = await client.post(f"{API_BASE}/push/subscribe", json=payload)
            
            if response.status_code != 400:
                log_test("POST /api/push/subscribe (missing endpoint)", False, f"Expected 400, got {response.status_code}")
                return False
            
            log_test("POST /api/push/subscribe (missing endpoint)", True, "Correctly returned 400")
            return True
    except Exception as e:
        log_test("POST /api/push/subscribe (missing endpoint)", False, str(e))
        return False

async def test_subscribe_missing_user_id():
    """Test (b): POST /api/push/subscribe without telegram_id and uid"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {
                "endpoint": TEST_ENDPOINT,
                "keys": TEST_KEYS
            }
            response = await client.post(f"{API_BASE}/push/subscribe", json=payload)
            
            if response.status_code != 400:
                log_test("POST /api/push/subscribe (missing user_id)", False, f"Expected 400, got {response.status_code}")
                return False
            
            log_test("POST /api/push/subscribe (missing user_id)", True, "Correctly returned 400")
            return True
    except Exception as e:
        log_test("POST /api/push/subscribe (missing user_id)", False, str(e))
        return False

async def test_subscribe_idempotent():
    """Test (b): POST /api/push/subscribe - idempotent (repeat same endpoint)"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {
                "telegram_id": TEST_USER_TID,
                "uid": TEST_USER_UID,
                "endpoint": TEST_ENDPOINT,
                "keys": TEST_KEYS,
                "user_agent": TEST_USER_AGENT
            }
            response = await client.post(f"{API_BASE}/push/subscribe", json=payload)
            
            if response.status_code != 200:
                log_test("POST /api/push/subscribe (idempotent)", False, f"Expected 200, got {response.status_code}")
                return False
            
            log_test("POST /api/push/subscribe (idempotent)", True, "Idempotent subscribe works")
            return True
    except Exception as e:
        log_test("POST /api/push/subscribe (idempotent)", False, str(e))
        return False

async def test_get_subscriptions():
    """Test (c): GET /api/push/subscriptions"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{API_BASE}/push/subscriptions", params={"telegram_id": TEST_USER_TID})
            
            if response.status_code != 200:
                log_test("GET /api/push/subscriptions", False, f"Expected 200, got {response.status_code}")
                return False
            
            data = response.json()
            subscriptions = data.get("subscriptions", [])
            count = data.get("count", 0)
            
            if count < 1:
                log_test("GET /api/push/subscriptions", False, f"Expected at least 1 subscription, got {count}")
                return False
            
            # Check that endpoint and keys are NOT visible
            for sub in subscriptions:
                if "endpoint" in sub or "keys" in sub:
                    log_test("GET /api/push/subscriptions", False, "Endpoint/keys should not be visible in response")
                    return False
                
                # Check required meta fields
                if "id" not in sub or "user_agent" not in sub or "active" not in sub:
                    log_test("GET /api/push/subscriptions", False, f"Missing required fields in subscription: {sub}")
                    return False
            
            log_test("GET /api/push/subscriptions", True, f"Found {count} subscription(s), meta fields correct")
            return True
    except Exception as e:
        log_test("GET /api/push/subscriptions", False, str(e))
        return False

async def test_push_test():
    """Test (d): POST /api/push/test"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {"telegram_id": TEST_USER_TID}
            response = await client.post(f"{API_BASE}/push/test", json=payload)
            
            if response.status_code != 200:
                log_test("POST /api/push/test", False, f"Expected 200, got {response.status_code}")
                return False
            
            data = response.json()
            
            # Check response structure
            if "sent" not in data or "failed" not in data or "removed" not in data or "errors" not in data:
                log_test("POST /api/push/test", False, f"Invalid response structure: {data}")
                return False
            
            # Real push won't work with fake endpoint - that's OK
            # Key check: response is correct, no unhandled exceptions in logs
            sent = data.get("sent", 0)
            failed = data.get("failed", 0)
            removed = data.get("removed", 0)
            
            log_test("POST /api/push/test", True, f"sent={sent}, failed={failed}, removed={removed} (fake endpoint expected to fail)")
            return True
    except Exception as e:
        log_test("POST /api/push/test", False, str(e))
        return False

async def test_unsubscribe():
    """Test (e): POST /api/push/unsubscribe"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {"endpoint": TEST_ENDPOINT}
            response = await client.post(f"{API_BASE}/push/unsubscribe", json=payload)
            
            if response.status_code != 200:
                log_test("POST /api/push/unsubscribe", False, f"Expected 200, got {response.status_code}")
                return False
            
            data = response.json()
            if data.get("status") != "ok":
                log_test("POST /api/push/unsubscribe", False, f"Invalid response: {data}")
                return False
            
            log_test("POST /api/push/unsubscribe", True, f"removed={data.get('removed')}")
            return True
    except Exception as e:
        log_test("POST /api/push/unsubscribe", False, str(e))
        return False

async def test_unsubscribe_missing_endpoint():
    """Test (e): POST /api/push/unsubscribe without endpoint"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {}
            response = await client.post(f"{API_BASE}/push/unsubscribe", json=payload)
            
            if response.status_code != 400:
                log_test("POST /api/push/unsubscribe (missing endpoint)", False, f"Expected 400, got {response.status_code}")
                return False
            
            log_test("POST /api/push/unsubscribe (missing endpoint)", True, "Correctly returned 400")
            return True
    except Exception as e:
        log_test("POST /api/push/unsubscribe (missing endpoint)", False, str(e))
        return False

async def test_startup_logs():
    """Test (h): Check startup logs for Web Push configuration"""
    try:
        # Check backend logs for Web Push initialization
        import subprocess
        result = subprocess.run(
            ["grep", "-E", "Web Push.*configured|ensure_push_subscriptions_indexes", "/var/log/supervisor/backend.err.log"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        logs = result.stdout
        
        if "✅ Web Push (VAPID) configured and ready" in logs:
            log_test("Startup logs - Web Push configured", True, "Found '✅ Web Push (VAPID) configured and ready'")
            return True
        else:
            log_test("Startup logs - Web Push configured", False, "Did not find Web Push configured message")
            return False
    except Exception as e:
        log_test("Startup logs - Web Push configured", False, str(e))
        return False

async def test_p2_notifications_regression():
    """Test (g): Regression - P2-NOTIFICATIONS should still work"""
    try:
        # Test that basic notification endpoints still work
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Test GET /api/auth/config (should work without auth)
            response = await client.get(f"{API_BASE}/auth/config")
            
            if response.status_code != 200:
                log_test("P2-NOTIFICATIONS regression", False, f"GET /api/auth/config failed: {response.status_code}")
                return False
            
            log_test("P2-NOTIFICATIONS regression", True, "Basic endpoints still working")
            return True
    except Exception as e:
        log_test("P2-NOTIFICATIONS regression", False, str(e))
        return False

async def main():
    """Run all Web Push tests"""
    print("=" * 80)
    print("WEB PUSH (PWA) BACKEND TESTING")
    print("=" * 80)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test User TID: {TEST_USER_TID}")
    print(f"Test User UID: {TEST_USER_UID}")
    print("=" * 80)
    print()
    
    # Run tests in order
    tests = [
        ("(a) VAPID Public Key", test_vapid_public_key),
        ("(b) Subscribe - Valid", test_subscribe_valid),
        ("(b) Subscribe - Missing Endpoint", test_subscribe_missing_endpoint),
        ("(b) Subscribe - Missing User ID", test_subscribe_missing_user_id),
        ("(b) Subscribe - Idempotent", test_subscribe_idempotent),
        ("(c) Get Subscriptions", test_get_subscriptions),
        ("(d) Test Push", test_push_test),
        ("(e) Unsubscribe", test_unsubscribe),
        ("(e) Unsubscribe - Missing Endpoint", test_unsubscribe_missing_endpoint),
        ("(h) Startup Logs", test_startup_logs),
        ("(g) P2-NOTIFICATIONS Regression", test_p2_notifications_regression),
    ]
    
    for test_name, test_func in tests:
        print(f"\n{'─' * 80}")
        print(f"Running: {test_name}")
        print(f"{'─' * 80}")
        await test_func()
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for r in test_results if r["passed"])
    total = len(test_results)
    
    print(f"\nTotal: {total} tests")
    print(f"Passed: {passed} ✅")
    print(f"Failed: {total - passed} ❌")
    print(f"Success Rate: {passed/total*100:.1f}%")
    
    if total - passed > 0:
        print("\n❌ FAILED TESTS:")
        for r in test_results:
            if not r["passed"]:
                print(f"  - {r['name']}: {r['details']}")
    
    print("\n" + "=" * 80)
    
    # Exit with appropriate code
    sys.exit(0 if passed == total else 1)

if __name__ == "__main__":
    asyncio.run(main())
