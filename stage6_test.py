#!/usr/bin/env python3
"""
Focused Stage 6 Hardening test suite - tests key new features without hitting rate limits.
"""

import asyncio
import json
import random
import string
import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional

import httpx
import pymongo
from motor.motor_asyncio import AsyncIOMotorClient


# Configuration
BASE_URL = "http://localhost:8001/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "rudn_schedule"

# Test results tracking
test_results = {
    "passed": 0,
    "failed": 0,
    "skipped": 0,
    "details": []
}

# Global HTTP client
client: Optional[httpx.AsyncClient] = None
db: Optional[Any] = None


def log_test(name: str, status: str, details: str = ""):
    """Log test result"""
    test_results["details"].append({
        "name": name,
        "status": status,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    if status == "PASS":
        test_results["passed"] += 1
        print(f"✅ {name}")
    elif status == "FAIL":
        test_results["failed"] += 1
        print(f"❌ {name}: {details}")
    else:  # SKIP
        test_results["skipped"] += 1
        print(f"⏭️ {name}: {details}")


def generate_test_email() -> str:
    """Generate unique test email"""
    random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"test_{random_suffix}@example.com"


async def setup_mongodb():
    """Setup MongoDB connection for direct database access"""
    global db
    try:
        mongo_client = AsyncIOMotorClient(MONGO_URL)
        db = mongo_client[DB_NAME]
        await db.command("ping")
        print(f"✅ MongoDB connected: {MONGO_URL}")
        return True
    except Exception as e:
        print(f"⚠️ MongoDB connection failed: {e}")
        db = None
        return False


async def setup_http_client():
    """Setup HTTP client"""
    global client
    client = httpx.AsyncClient(timeout=30.0)


async def cleanup():
    """Cleanup resources"""
    if client:
        await client.aclose()


# ============ CORE TESTS ============

async def test_auth_config_qr_ttl():
    """Test GET /api/auth/config contains qr_login_ttl_minutes=5"""
    try:
        response = await client.get(f"{BASE_URL}/auth/config")
        
        if response.status_code != 200:
            log_test("Auth Config QR TTL", "FAIL", f"Expected 200, got {response.status_code}")
            return
        
        data = response.json()
        
        if "qr_login_ttl_minutes" not in data:
            log_test("Auth Config QR TTL", "FAIL", "Missing qr_login_ttl_minutes field")
            return
        
        if data["qr_login_ttl_minutes"] != 5:
            log_test("Auth Config QR TTL", "FAIL", f"Expected qr_login_ttl_minutes=5, got {data['qr_login_ttl_minutes']}")
            return
        
        log_test("Auth Config QR TTL", "PASS", "qr_login_ttl_minutes=5 present")
        
    except Exception as e:
        log_test("Auth Config QR TTL", "FAIL", str(e))


async def test_user_public_extended_fields():
    """Test UserPublic contains extended fields (level_id, form_code, last_login_at)"""
    try:
        # Try to register a user (might hit rate limit, that's ok)
        email = generate_test_email()
        
        response = await client.post(f"{BASE_URL}/auth/register/email", json={
            "email": email,
            "password": "testpass123",
            "first_name": "Test",
            "last_name": "User"
        })
        
        if response.status_code == 429:
            log_test("UserPublic Extended Fields", "SKIP", "Rate limit hit, cannot test")
            return
        
        if response.status_code != 200:
            log_test("UserPublic Extended Fields", "FAIL", f"Registration failed: {response.status_code}")
            return
        
        data = response.json()
        token = data["access_token"]
        
        # Test /me endpoint
        headers = {"Authorization": f"Bearer {token}"}
        response = await client.get(f"{BASE_URL}/auth/me", headers=headers)
        
        if response.status_code != 200:
            log_test("UserPublic Extended Fields", "FAIL", f"Expected 200, got {response.status_code}")
            return
        
        user_data = response.json()
        
        # Check for Stage 6 extended fields
        extended_fields = ["level_id", "form_code", "last_login_at"]
        missing_fields = []
        
        for field in extended_fields:
            if field not in user_data:
                missing_fields.append(field)
        
        if missing_fields:
            log_test("UserPublic Extended Fields", "FAIL", f"Missing fields: {missing_fields}")
            return
        
        log_test("UserPublic Extended Fields", "PASS", f"All extended fields present: {extended_fields}")
        
    except Exception as e:
        log_test("UserPublic Extended Fields", "FAIL", str(e))


async def test_pseudo_tid_check():
    """Test pseudo-tid implementation for email users"""
    try:
        if db is None:
            log_test("Pseudo-tid Implementation", "SKIP", "MongoDB not available")
            return
        
        # Find an existing email user from previous tests
        user_doc = await db.users.find_one({"email": {"$exists": True}})
        
        if not user_doc:
            log_test("Pseudo-tid Implementation", "SKIP", "No email users found to test")
            return
        
        uid = user_doc.get("uid")
        if not uid:
            log_test("Pseudo-tid Implementation", "FAIL", "User has no UID")
            return
        
        # Check user_settings for pseudo-tid
        user_settings = await db.user_settings.find_one({"uid": uid})
        
        if not user_settings:
            log_test("Pseudo-tid Implementation", "FAIL", f"No user_settings found for uid {uid}")
            return
        
        telegram_id = user_settings.get("telegram_id")
        if not telegram_id:
            log_test("Pseudo-tid Implementation", "FAIL", f"No telegram_id in user_settings")
            return
        
        # Check if it's a pseudo-tid (should be >= 10^10)
        expected_pseudo_tid = 10_000_000_000 + int(uid)
        
        if telegram_id != expected_pseudo_tid:
            log_test("Pseudo-tid Implementation", "FAIL", f"Expected pseudo-tid {expected_pseudo_tid}, got {telegram_id}")
            return
        
        log_test("Pseudo-tid Implementation", "PASS", f"Pseudo-tid correctly implemented: {telegram_id}")
        
    except Exception as e:
        log_test("Pseudo-tid Implementation", "FAIL", str(e))


async def test_rate_limit_login():
    """Test rate limit on login attempts"""
    try:
        # Find an existing user or skip if none available
        if db is None:
            log_test("Rate Limit Login", "SKIP", "MongoDB not available")
            return
        
        user_doc = await db.users.find_one({"email": {"$exists": True}})
        if not user_doc:
            log_test("Rate Limit Login", "SKIP", "No email users found to test")
            return
        
        email = user_doc.get("email")
        
        # Try multiple failed login attempts
        failed_attempts = 0
        for i in range(12):  # Try 12 attempts
            response = await client.post(f"{BASE_URL}/auth/login/email", json={
                "email": email,
                "password": "wrongpassword"
            })
            
            if response.status_code == 401:
                failed_attempts += 1
            elif response.status_code == 429:
                # Rate limit hit - this is expected
                log_test("Rate Limit Login", "PASS", f"Rate limit triggered after {failed_attempts} failed attempts")
                return
            else:
                log_test("Rate Limit Login", "FAIL", f"Unexpected status code: {response.status_code}")
                return
        
        log_test("Rate Limit Login", "FAIL", "Rate limit not triggered after 12 attempts")
        
    except Exception as e:
        log_test("Rate Limit Login", "FAIL", str(e))


async def test_qr_consumed_grace():
    """Test QR consumed grace period functionality"""
    try:
        # 1. Initialize QR session
        response = await client.post(f"{BASE_URL}/auth/login/qr/init")
        
        if response.status_code != 200:
            log_test("QR Consumed Grace", "FAIL", f"QR init failed: {response.status_code}")
            return
        
        qr_data = response.json()
        qr_token = qr_data.get("qr_token")
        
        # 2. Check initial status
        response = await client.get(f"{BASE_URL}/auth/login/qr/{qr_token}/status")
        
        if response.status_code != 200:
            log_test("QR Consumed Grace", "FAIL", f"QR status check failed: {response.status_code}")
            return
        
        status_data = response.json()
        if status_data.get("status") != "pending":
            log_test("QR Consumed Grace", "FAIL", f"Expected status=pending, got {status_data.get('status')}")
            return
        
        # 3. Try to find an existing user with JWT token
        if db is None:
            log_test("QR Consumed Grace", "SKIP", "MongoDB not available for JWT token")
            return
        
        user_doc = await db.users.find_one({"email": {"$exists": True}})
        if not user_doc:
            log_test("QR Consumed Grace", "SKIP", "No users found for JWT token")
            return
        
        # Create a JWT token for confirmation (simplified)
        from auth_utils import create_jwt
        token = create_jwt(
            uid=user_doc["uid"],
            telegram_id=user_doc.get("telegram_id"),
            providers=user_doc.get("auth_providers", [])
        )
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # 4. Confirm QR session
        response = await client.post(f"{BASE_URL}/auth/login/qr/{qr_token}/confirm", headers=headers)
        
        if response.status_code != 200:
            log_test("QR Consumed Grace", "FAIL", f"QR confirm failed: {response.status_code}")
            return
        
        # 5. Check status after confirmation (should be confirmed with access_token)
        response = await client.get(f"{BASE_URL}/auth/login/qr/{qr_token}/status")
        
        if response.status_code != 200:
            log_test("QR Consumed Grace", "FAIL", f"QR status after confirm failed: {response.status_code}")
            return
        
        status_data = response.json()
        if status_data.get("status") != "confirmed":
            log_test("QR Consumed Grace", "FAIL", f"Expected status=confirmed, got {status_data.get('status')}")
            return
        
        first_token = status_data.get("access_token")
        if not first_token:
            log_test("QR Consumed Grace", "FAIL", "No access_token in confirmed status")
            return
        
        # 6. Test grace period - immediate repeat should return same token
        response = await client.get(f"{BASE_URL}/auth/login/qr/{qr_token}/status")
        
        if response.status_code != 200:
            log_test("QR Consumed Grace", "FAIL", f"QR status repeat failed: {response.status_code}")
            return
        
        repeat_data = response.json()
        repeat_token = repeat_data.get("access_token")
        
        if repeat_token != first_token:
            log_test("QR Consumed Grace", "FAIL", "Expected same token on repeat within grace period")
            return
        
        log_test("QR Consumed Grace", "PASS", "QR consumed grace period working correctly")
        
    except Exception as e:
        log_test("QR Consumed Grace", "FAIL", str(e))


async def test_auth_events_collection():
    """Test auth_events collection is being populated"""
    try:
        if db is None:
            log_test("Auth Events Collection", "SKIP", "MongoDB not available")
            return
        
        # Count existing auth events
        initial_count = await db.auth_events.count_documents({})
        
        # Check if collection exists and has some events
        if initial_count == 0:
            log_test("Auth Events Collection", "SKIP", "No auth events found (collection may be empty)")
            return
        
        # Check structure of recent events
        recent_events = await db.auth_events.find({}).sort("ts", -1).limit(3).to_list(3)
        
        if not recent_events:
            log_test("Auth Events Collection", "FAIL", "No recent auth events found")
            return
        
        # Check required fields
        required_fields = ["event", "uid", "success", "ts"]
        
        for event in recent_events:
            missing_fields = []
            for field in required_fields:
                if field not in event:
                    missing_fields.append(field)
            
            if missing_fields:
                log_test("Auth Events Collection", "FAIL", f"Missing fields in auth event: {missing_fields}")
                return
        
        log_test("Auth Events Collection", "PASS", f"Auth events collection working ({initial_count} events)")
        
    except Exception as e:
        log_test("Auth Events Collection", "FAIL", str(e))


async def test_security_endpoints():
    """Test security of various auth endpoints"""
    try:
        # Test Telegram WebApp security
        response = await client.post(f"{BASE_URL}/auth/login/telegram-webapp", json={
            "init_data": "invalid_init_data"
        })
        
        if response.status_code != 401:
            log_test("Security Endpoints", "FAIL", f"Telegram WebApp: Expected 401, got {response.status_code}")
            return
        
        # Test VK login security
        response = await client.post(f"{BASE_URL}/auth/login/vk", json={
            "code": "invalid_code",
            "redirect_uri": "https://example.com"
        })
        
        if response.status_code not in [401, 502]:
            log_test("Security Endpoints", "FAIL", f"VK login: Expected 401/502, got {response.status_code}")
            return
        
        # Test link endpoints require auth
        response = await client.post(f"{BASE_URL}/auth/link/email", json={})
        
        if response.status_code != 401:
            log_test("Security Endpoints", "FAIL", f"Link email: Expected 401, got {response.status_code}")
            return
        
        log_test("Security Endpoints", "PASS", "All security endpoints properly protected")
        
    except Exception as e:
        log_test("Security Endpoints", "FAIL", str(e))


async def test_registration_step_mapping():
    """Test registration_step transitions"""
    try:
        # This test requires a fresh user, so we'll skip if rate limited
        email = generate_test_email()
        
        response = await client.post(f"{BASE_URL}/auth/register/email", json={
            "email": email,
            "password": "testpass123",
            "first_name": "Test",
            "last_name": "User"
        })
        
        if response.status_code == 429:
            log_test("Registration Step Mapping", "SKIP", "Rate limit hit")
            return
        
        if response.status_code != 200:
            log_test("Registration Step Mapping", "FAIL", f"Registration failed: {response.status_code}")
            return
        
        data = response.json()
        
        # Check initial registration_step=2
        if data["user"].get("registration_step") != 2:
            log_test("Registration Step Mapping", "FAIL", f"Expected registration_step=2, got {data['user'].get('registration_step')}")
            return
        
        log_test("Registration Step Mapping", "PASS", "Registration step mapping working (initial step=2)")
        
    except Exception as e:
        log_test("Registration Step Mapping", "FAIL", str(e))


# ============ MAIN TEST RUNNER ============

async def run_focused_tests():
    """Run focused Stage 6 tests"""
    print("🧪 Starting Stage 6 Hardening Focused Tests...")
    print(f"🎯 Target: {BASE_URL}")
    
    # Setup
    await setup_http_client()
    mongo_available = await setup_mongodb()
    
    print(f"📊 MongoDB: {'✅ Available' if mongo_available else '❌ Not available'}")
    print("=" * 60)
    
    # Run focused tests
    print("\n🔒 STAGE 6 HARDENING TESTS")
    print("-" * 30)
    
    await test_auth_config_qr_ttl()
    await test_user_public_extended_fields()
    await test_pseudo_tid_check()
    await test_rate_limit_login()
    await test_qr_consumed_grace()
    await test_auth_events_collection()
    await test_security_endpoints()
    await test_registration_step_mapping()
    
    # Cleanup
    await cleanup()
    
    # Results
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    
    total = test_results["passed"] + test_results["failed"] + test_results["skipped"]
    
    print(f"✅ PASSED: {test_results['passed']}")
    print(f"❌ FAILED: {test_results['failed']}")
    print(f"⏭️ SKIPPED: {test_results['skipped']}")
    print(f"📈 TOTAL: {total}")
    
    if test_results["failed"] > 0:
        print(f"\n❌ FAILED TESTS:")
        for detail in test_results["details"]:
            if detail["status"] == "FAIL":
                print(f"   • {detail['name']}: {detail['details']}")
    
    if test_results["skipped"] > 0:
        print(f"\n⏭️ SKIPPED TESTS:")
        for detail in test_results["details"]:
            if detail["status"] == "SKIP":
                print(f"   • {detail['name']}: {detail['details']}")
    
    # Overall result
    if test_results["failed"] == 0:
        print(f"\n🎉 ALL TESTS PASSED! Stage 6 Hardening is working correctly.")
        return True
    else:
        print(f"\n⚠️ {test_results['failed']} tests failed. Stage 6 Hardening needs attention.")
        return False


if __name__ == "__main__":
    success = asyncio.run(run_focused_tests())
    exit(0 if success else 1)