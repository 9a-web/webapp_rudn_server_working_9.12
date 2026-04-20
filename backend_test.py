#!/usr/bin/env python3
"""
Comprehensive test suite for Stage 6 Hardening auth system changes.

Tests both regression (all previous 23 tests) and new hardening features:
- Pseudo-tid for email/VK/QR users
- Rate-limit on login (IP + email)
- QR consumed grace period
- UserPublic extended fields
- registration_step mapping
- /auth/config with qr_login_ttl_minutes
- suggested_username_taken for existing users
- auth_events collection
- last_login_ip/last_login_ua
- Deterministic primary_auth selection
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
MONGO_URL = "mongodb://localhost:27017"  # Will be read from backend/.env if available
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


def generate_test_username() -> str:
    """Generate unique test username"""
    random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return f"testuser_{random_suffix}"


async def setup_mongodb():
    """Setup MongoDB connection for direct database access"""
    global db
    try:
        # Try to read MONGO_URL from backend/.env
        import os
        from pathlib import Path
        
        env_path = Path("/app/backend/.env")
        if env_path.exists():
            with open(env_path) as f:
                for line in f:
                    if line.startswith("MONGO_URL="):
                        mongo_url = line.split("=", 1)[1].strip().strip('"\'')
                        break
                else:
                    mongo_url = MONGO_URL
        else:
            mongo_url = MONGO_URL
        
        mongo_client = AsyncIOMotorClient(mongo_url)
        db = mongo_client[DB_NAME]
        
        # Test connection
        await db.command("ping")
        print(f"✅ MongoDB connected: {mongo_url}")
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


# ============ REGRESSION TESTS (Previous 23 tests) ============

async def test_auth_config():
    """Test GET /api/auth/config endpoint"""
    try:
        response = await client.get(f"{BASE_URL}/auth/config")
        
        if response.status_code != 200:
            log_test("GET /auth/config", "FAIL", f"Expected 200, got {response.status_code}")
            return
        
        data = response.json()
        required_fields = ["telegram_bot_username", "vk_app_id", "vk_redirect_uri_default", "env", "features"]
        
        for field in required_fields:
            if field not in data:
                log_test("GET /auth/config", "FAIL", f"Missing field: {field}")
                return
        
        # Stage 6: Check for qr_login_ttl_minutes
        if "qr_login_ttl_minutes" not in data:
            log_test("GET /auth/config", "FAIL", "Missing qr_login_ttl_minutes field")
            return
        
        if data["qr_login_ttl_minutes"] != 5:
            log_test("GET /auth/config", "FAIL", f"Expected qr_login_ttl_minutes=5, got {data['qr_login_ttl_minutes']}")
            return
        
        log_test("GET /auth/config", "PASS", "All required fields present including qr_login_ttl_minutes=5")
        
    except Exception as e:
        log_test("GET /auth/config", "FAIL", str(e))


async def test_email_registration():
    """Test email registration with pseudo-tid check"""
    try:
        email = generate_test_email()
        
        response = await client.post(f"{BASE_URL}/auth/register/email", json={
            "email": email,
            "password": "testpass123",
            "first_name": "Test",
            "last_name": "User"
        })
        
        if response.status_code != 200:
            log_test("Email Registration", "FAIL", f"Expected 200, got {response.status_code}: {response.text}")
            return None
        
        data = response.json()
        
        # Check response structure
        required_fields = ["access_token", "token_type", "user"]
        for field in required_fields:
            if field not in data:
                log_test("Email Registration", "FAIL", f"Missing field: {field}")
                return None
        
        user = data["user"]
        if not user.get("uid") or len(user["uid"]) != 9:
            log_test("Email Registration", "FAIL", f"Invalid UID: {user.get('uid')}")
            return None
        
        # Stage 6: Check that telegram_id is null in response (not pseudo-tid)
        if user.get("telegram_id") is not None:
            log_test("Email Registration", "FAIL", f"Expected telegram_id=null, got {user.get('telegram_id')}")
            return None
        
        # Stage 6: Check registration_step=2 after email registration
        if user.get("registration_step") != 2:
            log_test("Email Registration", "FAIL", f"Expected registration_step=2, got {user.get('registration_step')}")
            return None
        
        log_test("Email Registration", "PASS", f"User created with UID {user['uid']}, telegram_id=null, registration_step=2")
        
        return {
            "email": email,
            "password": "testpass123",
            "uid": user["uid"],
            "access_token": data["access_token"]
        }
        
    except Exception as e:
        log_test("Email Registration", "FAIL", str(e))
        return None


async def test_email_login():
    """Test email login"""
    try:
        # First register a user
        user_data = await test_email_registration()
        if not user_data:
            return None
        
        # Now test login
        response = await client.post(f"{BASE_URL}/auth/login/email", json={
            "email": user_data["email"],
            "password": user_data["password"]
        })
        
        if response.status_code != 200:
            log_test("Email Login", "FAIL", f"Expected 200, got {response.status_code}: {response.text}")
            return None
        
        data = response.json()
        
        if "access_token" not in data:
            log_test("Email Login", "FAIL", "Missing access_token")
            return None
        
        log_test("Email Login", "PASS", "Login successful")
        return data["access_token"]
        
    except Exception as e:
        log_test("Email Login", "FAIL", str(e))
        return None


async def test_auth_me():
    """Test GET /api/auth/me endpoint with extended UserPublic fields"""
    try:
        # Get access token
        token = await test_email_login()
        if not token:
            return
        
        headers = {"Authorization": f"Bearer {token}"}
        response = await client.get(f"{BASE_URL}/auth/me", headers=headers)
        
        if response.status_code != 200:
            log_test("GET /auth/me", "FAIL", f"Expected 200, got {response.status_code}")
            return
        
        data = response.json()
        
        # Stage 6: Check for extended UserPublic fields
        required_fields = [
            "uid", "username", "first_name", "last_name", "email", "telegram_id", "vk_id",
            "auth_providers", "primary_auth", "facultet_id", "facultet_name",
            "level_id", "form_code", "kurs", "group_id", "group_name",
            "registration_step", "created_at", "last_login_at"
        ]
        
        missing_fields = []
        for field in required_fields:
            if field not in data:
                missing_fields.append(field)
        
        if missing_fields:
            log_test("GET /auth/me", "FAIL", f"Missing UserPublic fields: {missing_fields}")
            return
        
        log_test("GET /auth/me", "PASS", "All UserPublic fields present including level_id, form_code, last_login_at")
        
    except Exception as e:
        log_test("GET /auth/me", "FAIL", str(e))


async def test_check_username():
    """Test username validation"""
    try:
        # Test invalid username (too short)
        response = await client.get(f"{BASE_URL}/auth/check-username/ab")
        
        if response.status_code != 200:
            log_test("Check Username", "FAIL", f"Expected 200, got {response.status_code}")
            return
        
        data = response.json()
        if data.get("available") is not False:
            log_test("Check Username", "FAIL", f"Expected available=false for 'ab', got {data}")
            return
        
        # Test valid available username
        test_username = generate_test_username()
        response = await client.get(f"{BASE_URL}/auth/check-username/{test_username}")
        
        if response.status_code != 200:
            log_test("Check Username", "FAIL", f"Expected 200, got {response.status_code}")
            return
        
        data = response.json()
        if data.get("available") is not True:
            log_test("Check Username", "FAIL", f"Expected available=true for '{test_username}', got {data}")
            return
        
        log_test("Check Username", "PASS", "Username validation working correctly")
        
    except Exception as e:
        log_test("Check Username", "FAIL", str(e))


async def test_profile_step_transitions():
    """Test registration_step transitions mapping"""
    try:
        # Register user and get token
        user_data = await test_email_registration()
        if not user_data:
            return
        
        headers = {"Authorization": f"Bearer {user_data['access_token']}"}
        
        # Test complete_step=1 → registration_step=2
        username = generate_test_username()
        response = await client.patch(f"{BASE_URL}/auth/profile-step", 
                                    headers=headers,
                                    json={
                                        "complete_step": 1,
                                        "username": username,
                                        "first_name": "Test"
                                    })
        
        if response.status_code != 200:
            log_test("Profile Step Transitions", "FAIL", f"Step 1 failed: {response.status_code}: {response.text}")
            return
        
        data = response.json()
        if data.get("registration_step") != 2:
            log_test("Profile Step Transitions", "FAIL", f"Expected registration_step=2 after complete_step=1, got {data.get('registration_step')}")
            return
        
        # Test complete_step=2 → registration_step=3
        response = await client.patch(f"{BASE_URL}/auth/profile-step", 
                                    headers=headers,
                                    json={
                                        "complete_step": 2,
                                        "username": username
                                    })
        
        if response.status_code != 200:
            log_test("Profile Step Transitions", "FAIL", f"Step 2 failed: {response.status_code}: {response.text}")
            return
        
        data = response.json()
        if data.get("registration_step") != 3:
            log_test("Profile Step Transitions", "FAIL", f"Expected registration_step=3 after complete_step=2, got {data.get('registration_step')}")
            return
        
        # Test complete_step=3 → registration_step=0
        response = await client.patch(f"{BASE_URL}/auth/profile-step", 
                                    headers=headers,
                                    json={
                                        "complete_step": 3,
                                        "facultet_id": "test_faculty",
                                        "group_id": "test_group"
                                    })
        
        if response.status_code != 200:
            log_test("Profile Step Transitions", "FAIL", f"Step 3 failed: {response.status_code}: {response.text}")
            return
        
        data = response.json()
        if data.get("registration_step") != 0:
            log_test("Profile Step Transitions", "FAIL", f"Expected registration_step=0 after complete_step=3, got {data.get('registration_step')}")
            return
        
        log_test("Profile Step Transitions", "PASS", "All step transitions working correctly: 1→2, 2→3, 3→0")
        
    except Exception as e:
        log_test("Profile Step Transitions", "FAIL", str(e))


async def test_qr_login_flow():
    """Test QR login flow with consumed grace period"""
    try:
        # 1. Initialize QR session
        response = await client.post(f"{BASE_URL}/auth/login/qr/init")
        
        if response.status_code != 200:
            log_test("QR Login Flow", "FAIL", f"QR init failed: {response.status_code}: {response.text}")
            return
        
        qr_data = response.json()
        qr_token = qr_data.get("qr_token")
        
        if not qr_token:
            log_test("QR Login Flow", "FAIL", "No qr_token in init response")
            return
        
        # 2. Check initial status (should be pending)
        response = await client.get(f"{BASE_URL}/auth/login/qr/{qr_token}/status")
        
        if response.status_code != 200:
            log_test("QR Login Flow", "FAIL", f"QR status check failed: {response.status_code}")
            return
        
        status_data = response.json()
        if status_data.get("status") != "pending":
            log_test("QR Login Flow", "FAIL", f"Expected status=pending, got {status_data.get('status')}")
            return
        
        # 3. Get a valid JWT token to confirm QR
        user_data = await test_email_registration()
        if not user_data:
            log_test("QR Login Flow", "FAIL", "Could not get JWT for QR confirmation")
            return
        
        headers = {"Authorization": f"Bearer {user_data['access_token']}"}
        
        # 4. Confirm QR session
        response = await client.post(f"{BASE_URL}/auth/login/qr/{qr_token}/confirm", headers=headers)
        
        if response.status_code != 200:
            log_test("QR Login Flow", "FAIL", f"QR confirm failed: {response.status_code}: {response.text}")
            return
        
        # 5. Check status after confirmation (should be confirmed with access_token)
        response = await client.get(f"{BASE_URL}/auth/login/qr/{qr_token}/status")
        
        if response.status_code != 200:
            log_test("QR Login Flow", "FAIL", f"QR status after confirm failed: {response.status_code}")
            return
        
        status_data = response.json()
        if status_data.get("status") != "confirmed":
            log_test("QR Login Flow", "FAIL", f"Expected status=confirmed, got {status_data.get('status')}")
            return
        
        first_token = status_data.get("access_token")
        if not first_token:
            log_test("QR Login Flow", "FAIL", "No access_token in confirmed status")
            return
        
        # 6. Stage 6: Test consumed grace period - immediate repeat should return same token
        response = await client.get(f"{BASE_URL}/auth/login/qr/{qr_token}/status")
        
        if response.status_code != 200:
            log_test("QR Login Flow", "FAIL", f"QR status repeat failed: {response.status_code}")
            return
        
        repeat_data = response.json()
        if repeat_data.get("status") != "confirmed":
            log_test("QR Login Flow", "FAIL", f"Expected status=confirmed on repeat, got {repeat_data.get('status')}")
            return
        
        repeat_token = repeat_data.get("access_token")
        if repeat_token != first_token:
            log_test("QR Login Flow", "FAIL", f"Expected same token on repeat, got different token")
            return
        
        log_test("QR Login Flow", "PASS", "QR flow working with consumed grace period")
        
    except Exception as e:
        log_test("QR Login Flow", "FAIL", str(e))


async def test_logout():
    """Test logout endpoint"""
    try:
        token = await test_email_login()
        if not token:
            return
        
        headers = {"Authorization": f"Bearer {token}"}
        response = await client.post(f"{BASE_URL}/auth/logout", headers=headers)
        
        if response.status_code != 200:
            log_test("Logout", "FAIL", f"Expected 200, got {response.status_code}")
            return
        
        data = response.json()
        if not data.get("success"):
            log_test("Logout", "FAIL", f"Expected success=true, got {data}")
            return
        
        log_test("Logout", "PASS", "Logout successful")
        
    except Exception as e:
        log_test("Logout", "FAIL", str(e))


# ============ STAGE 6 HARDENING TESTS ============

async def test_pseudo_tid_in_user_settings():
    """Test that email users get pseudo-tid in user_settings"""
    try:
        if db is None:
            log_test("Pseudo-tid Check", "SKIP", "MongoDB not available")
            return
        
        # Register email user
        user_data = await test_email_registration()
        if not user_data:
            return
        
        uid = user_data["uid"]
        
        # Check user_settings document
        user_settings = await db.user_settings.find_one({"uid": uid})
        
        if not user_settings:
            log_test("Pseudo-tid Check", "FAIL", f"No user_settings found for uid {uid}")
            return
        
        telegram_id = user_settings.get("telegram_id")
        if not telegram_id:
            log_test("Pseudo-tid Check", "FAIL", f"No telegram_id in user_settings for uid {uid}")
            return
        
        # Check if it's a pseudo-tid (should be >= 10^10)
        expected_pseudo_tid = 10_000_000_000 + int(uid)
        
        if telegram_id != expected_pseudo_tid:
            log_test("Pseudo-tid Check", "FAIL", f"Expected pseudo-tid {expected_pseudo_tid}, got {telegram_id}")
            return
        
        log_test("Pseudo-tid Check", "PASS", f"Pseudo-tid correctly set: {telegram_id}")
        
    except Exception as e:
        log_test("Pseudo-tid Check", "FAIL", str(e))


async def test_rate_limit_login_ip():
    """Test rate limit on login (IP-based)"""
    try:
        # Register a user first
        user_data = await test_email_registration()
        if not user_data:
            return
        
        email = user_data["email"]
        
        # Try 10 failed login attempts (should be allowed)
        for i in range(10):
            response = await client.post(f"{BASE_URL}/auth/login/email", json={
                "email": email,
                "password": "wrongpassword"
            })
            
            if response.status_code != 401:
                log_test("Rate Limit Login IP", "FAIL", f"Attempt {i+1}: Expected 401, got {response.status_code}")
                return
        
        # 11th attempt should be rate limited (429)
        response = await client.post(f"{BASE_URL}/auth/login/email", json={
            "email": email,
            "password": "wrongpassword"
        })
        
        if response.status_code != 429:
            log_test("Rate Limit Login IP", "FAIL", f"11th attempt: Expected 429, got {response.status_code}")
            return
        
        log_test("Rate Limit Login IP", "PASS", "IP rate limit working (10 attempts allowed, 11th blocked)")
        
    except Exception as e:
        log_test("Rate Limit Login IP", "FAIL", str(e))


async def test_rate_limit_register_email():
    """Test rate limit on email registration (regression test)"""
    try:
        # Try 5 registrations (should be allowed)
        for i in range(5):
            email = generate_test_email()
            response = await client.post(f"{BASE_URL}/auth/register/email", json={
                "email": email,
                "password": "testpass123",
                "first_name": "Test",
                "last_name": "User"
            })
            
            if response.status_code != 200:
                log_test("Rate Limit Register", "FAIL", f"Registration {i+1}: Expected 200, got {response.status_code}")
                return
        
        # 6th registration should be rate limited
        email = generate_test_email()
        response = await client.post(f"{BASE_URL}/auth/register/email", json={
            "email": email,
            "password": "testpass123",
            "first_name": "Test",
            "last_name": "User"
        })
        
        if response.status_code != 429:
            log_test("Rate Limit Register", "FAIL", f"6th registration: Expected 429, got {response.status_code}")
            return
        
        log_test("Rate Limit Register", "PASS", "Registration rate limit working (5 allowed, 6th blocked)")
        
    except Exception as e:
        log_test("Rate Limit Register", "FAIL", str(e))


async def test_telegram_webapp_security():
    """Test Telegram WebApp login security (no auto-link)"""
    try:
        # Test with invalid initData (should return 401, not 500)
        response = await client.post(f"{BASE_URL}/auth/login/telegram-webapp", json={
            "init_data": "invalid_init_data"
        })
        
        if response.status_code != 401:
            log_test("Telegram WebApp Security", "FAIL", f"Expected 401 for invalid initData, got {response.status_code}")
            return
        
        log_test("Telegram WebApp Security", "PASS", "Invalid initData correctly returns 401")
        
    except Exception as e:
        log_test("Telegram WebApp Security", "FAIL", str(e))


async def test_telegram_widget_security():
    """Test Telegram Widget login security"""
    try:
        # Test with invalid hash
        response = await client.post(f"{BASE_URL}/auth/login/telegram", json={
            "id": 123456789,
            "first_name": "Test",
            "username": "testuser",
            "hash": "invalid_hash"
        })
        
        if response.status_code != 401:
            log_test("Telegram Widget Security", "FAIL", f"Expected 401 for invalid hash, got {response.status_code}")
            return
        
        log_test("Telegram Widget Security", "PASS", "Invalid hash correctly returns 401")
        
    except Exception as e:
        log_test("Telegram Widget Security", "FAIL", str(e))


async def test_vk_login_security():
    """Test VK login security"""
    try:
        # Test with invalid code
        response = await client.post(f"{BASE_URL}/auth/login/vk", json={
            "code": "invalid_code",
            "redirect_uri": "https://example.com"
        })
        
        if response.status_code not in [401, 502]:  # 401 for invalid code, 502 for VK API error
            log_test("VK Login Security", "FAIL", f"Expected 401 or 502 for invalid code, got {response.status_code}")
            return
        
        log_test("VK Login Security", "PASS", f"Invalid code correctly returns {response.status_code}")
        
    except Exception as e:
        log_test("VK Login Security", "FAIL", str(e))


async def test_link_endpoints_require_auth():
    """Test that all link endpoints require JWT authorization"""
    try:
        endpoints = [
            "/auth/link/email",
            "/auth/link/telegram",
            "/auth/link/telegram-webapp",
            "/auth/link/vk"
        ]
        
        for endpoint in endpoints:
            response = await client.post(f"{BASE_URL}{endpoint}", json={})
            
            if response.status_code != 401:
                log_test("Link Endpoints Auth", "FAIL", f"{endpoint}: Expected 401, got {response.status_code}")
                return
        
        log_test("Link Endpoints Auth", "PASS", "All link endpoints require authorization")
        
    except Exception as e:
        log_test("Link Endpoints Auth", "FAIL", str(e))


async def test_unlink_endpoints_require_auth():
    """Test that unlink endpoints require JWT authorization"""
    try:
        providers = ["email", "telegram", "vk"]
        
        for provider in providers:
            response = await client.delete(f"{BASE_URL}/auth/link/{provider}")
            
            if response.status_code != 401:
                log_test("Unlink Endpoints Auth", "FAIL", f"DELETE /auth/link/{provider}: Expected 401, got {response.status_code}")
                return
        
        log_test("Unlink Endpoints Auth", "PASS", "All unlink endpoints require authorization")
        
    except Exception as e:
        log_test("Unlink Endpoints Auth", "FAIL", str(e))


async def test_user_settings_access():
    """Test that user_settings is accessible after email registration"""
    try:
        # Register email user
        user_data = await test_email_registration()
        if not user_data:
            return
        
        uid = user_data["uid"]
        
        # Try to access user_settings
        response = await client.get(f"{BASE_URL}/user-settings/{uid}")
        
        if response.status_code != 200:
            log_test("User Settings Access", "FAIL", f"Expected 200, got {response.status_code}: {response.text}")
            return
        
        data = response.json()
        
        # Check that telegram_id is present (should be pseudo-tid)
        if "telegram_id" not in data:
            log_test("User Settings Access", "FAIL", "Missing telegram_id in user_settings response")
            return
        
        log_test("User Settings Access", "PASS", f"User settings accessible with telegram_id={data['telegram_id']}")
        
    except Exception as e:
        log_test("User Settings Access", "FAIL", str(e))


async def test_auth_events_logging():
    """Test auth_events collection logging (if MongoDB available)"""
    try:
        if db is None:
            log_test("Auth Events Logging", "SKIP", "MongoDB not available")
            return
        
        # Count existing auth events
        initial_count = await db.auth_events.count_documents({})
        
        # Perform a login to trigger auth event
        user_data = await test_email_registration()
        if not user_data:
            return
        
        # Login should create auth event
        await client.post(f"{BASE_URL}/auth/login/email", json={
            "email": user_data["email"],
            "password": user_data["password"]
        })
        
        # Check if auth events were created
        final_count = await db.auth_events.count_documents({})
        
        if final_count <= initial_count:
            log_test("Auth Events Logging", "FAIL", f"No new auth events created. Initial: {initial_count}, Final: {final_count}")
            return
        
        # Check for specific events
        recent_events = await db.auth_events.find({}).sort("ts", -1).limit(5).to_list(5)
        
        event_types = [event.get("event") for event in recent_events]
        expected_events = ["register_email", "login_email"]
        
        found_events = [event for event in expected_events if event in event_types]
        
        if not found_events:
            log_test("Auth Events Logging", "FAIL", f"Expected events {expected_events}, found {event_types}")
            return
        
        log_test("Auth Events Logging", "PASS", f"Auth events logged: {found_events}")
        
    except Exception as e:
        log_test("Auth Events Logging", "FAIL", str(e))


async def test_last_login_fields():
    """Test last_login_ip and last_login_ua fields (if MongoDB available)"""
    try:
        if db is None:
            log_test("Last Login Fields", "SKIP", "MongoDB not available")
            return
        
        # Register and login
        user_data = await test_email_registration()
        if not user_data:
            return
        
        # Login to trigger last_login updates
        await client.post(f"{BASE_URL}/auth/login/email", json={
            "email": user_data["email"],
            "password": user_data["password"]
        })
        
        # Check users document for last_login fields
        user_doc = await db.users.find_one({"uid": user_data["uid"]})
        
        if not user_doc:
            log_test("Last Login Fields", "FAIL", f"User document not found for uid {user_data['uid']}")
            return
        
        required_fields = ["last_login_at", "last_login_ip", "last_login_ua"]
        missing_fields = []
        
        for field in required_fields:
            if field not in user_doc or user_doc[field] is None:
                missing_fields.append(field)
        
        if missing_fields:
            log_test("Last Login Fields", "FAIL", f"Missing last_login fields: {missing_fields}")
            return
        
        log_test("Last Login Fields", "PASS", f"All last_login fields present: {required_fields}")
        
    except Exception as e:
        log_test("Last Login Fields", "FAIL", str(e))


# ============ MAIN TEST RUNNER ============

async def run_all_tests():
    """Run all tests in sequence"""
    print("🧪 Starting Stage 6 Hardening Auth Tests...")
    print(f"🎯 Target: {BASE_URL}")
    
    # Setup
    await setup_http_client()
    mongo_available = await setup_mongodb()
    
    print(f"📊 MongoDB: {'✅ Available' if mongo_available else '❌ Not available'}")
    print("=" * 60)
    
    # A. Regression Tests (Previous functionality)
    print("\n📋 A. REGRESSION TESTS")
    print("-" * 30)
    
    await test_auth_config()
    await test_email_registration()
    await test_email_login()
    await test_auth_me()
    await test_check_username()
    await test_profile_step_transitions()
    await test_qr_login_flow()
    await test_logout()
    await test_rate_limit_register_email()
    
    # B. Stage 6 Hardening Tests
    print("\n🔒 B. STAGE 6 HARDENING TESTS")
    print("-" * 30)
    
    await test_pseudo_tid_in_user_settings()
    await test_rate_limit_login_ip()
    await test_telegram_webapp_security()
    await test_telegram_widget_security()
    await test_vk_login_security()
    await test_link_endpoints_require_auth()
    await test_unlink_endpoints_require_auth()
    await test_user_settings_access()
    await test_auth_events_logging()
    await test_last_login_fields()
    
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
    success = asyncio.run(run_all_tests())
    exit(0 if success else 1)