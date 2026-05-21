#!/usr/bin/env python3
"""
Backend Testing for Notification System (Release 3)
Tests the major audit/refactor of the notification system.
"""

import asyncio
import sys
import requests
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Backend URL from environment
BACKEND_URL = "http://localhost:8001/api"

# Test credentials
TEST_EMAIL = "test_notif_r3@test.com"
TEST_PASSWORD = "Test1234"
TEST_UID = "915128176"

# Colors for output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def log_test(name: str):
    print(f"\n{Colors.BLUE}{'='*60}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST: {name}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*60}{Colors.RESET}")

def log_success(msg: str):
    print(f"{Colors.GREEN}✓ {msg}{Colors.RESET}")

def log_error(msg: str):
    print(f"{Colors.RED}✗ {msg}{Colors.RESET}")

def log_warning(msg: str):
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.RESET}")

def log_info(msg: str):
    print(f"{Colors.BLUE}ℹ {msg}{Colors.RESET}")


class TestSession:
    """Manages authentication and session for tests"""
    
    def __init__(self):
        self.session = requests.Session()
        self.token: Optional[str] = None
        self.telegram_id: Optional[int] = None
        self.uid: Optional[str] = None
        
    def login(self, email: str, password: str) -> bool:
        """Login and get JWT token"""
        try:
            response = self.session.post(
                f"{BACKEND_URL}/auth/login/email",
                json={"email": email, "password": password}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                
                # Extract from user object if present
                user = data.get("user", {})
                self.telegram_id = user.get("telegram_id") or data.get("telegram_id")
                self.uid = user.get("uid") or data.get("uid")
                
                if self.token:
                    self.session.headers.update({
                        "Authorization": f"Bearer {self.token}"
                    })
                    log_success(f"Logged in as {email} (tid={self.telegram_id}, uid={self.uid})")
                    return True
            
            log_error(f"Login failed: {response.status_code} - {response.text}")
            return False
            
        except Exception as e:
            log_error(f"Login exception: {e}")
            return False
    
    def get(self, endpoint: str, **kwargs) -> requests.Response:
        """GET request with auth"""
        return self.session.get(f"{BACKEND_URL}{endpoint}", **kwargs)
    
    def post(self, endpoint: str, **kwargs) -> requests.Response:
        """POST request with auth"""
        return self.session.post(f"{BACKEND_URL}{endpoint}", **kwargs)
    
    def put(self, endpoint: str, **kwargs) -> requests.Response:
        """PUT request with auth"""
        return self.session.put(f"{BACKEND_URL}{endpoint}", **kwargs)
    
    def patch(self, endpoint: str, **kwargs) -> requests.Response:
        """PATCH request with auth"""
        return self.session.patch(f"{BACKEND_URL}{endpoint}", **kwargs)
    
    def delete(self, endpoint: str, **kwargs) -> requests.Response:
        """DELETE request with auth"""
        return self.session.delete(f"{BACKEND_URL}{endpoint}", **kwargs)


def test_health_endpoint(session: TestSession) -> bool:
    """Test 1: New health endpoint with different parameters"""
    log_test("Health Endpoint - GET /api/admin/notifications/health")
    
    all_passed = True
    
    # Test 1.1: Default (24 hours)
    try:
        response = session.get("/admin/notifications/health")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields
            required_fields = [
                "window_hours", "since_utc", "now_utc",
                "delivery_attempts", "scheduled_notifications",
                "push_subscriptions", "dlq_size", "in_app", "platforms"
            ]
            
            missing = [f for f in required_fields if f not in data]
            if missing:
                log_error(f"Missing fields: {missing}")
                all_passed = False
            else:
                log_success(f"Default (24h): All required fields present")
                log_info(f"  window_hours: {data['window_hours']}")
                log_info(f"  push_subscriptions: active={data['push_subscriptions']['active']}, inactive={data['push_subscriptions']['inactive']}")
                log_info(f"  dlq_size: {data['dlq_size']}")
                log_info(f"  platforms: real_telegram={data['platforms']['real_telegram']}, pseudo={data['platforms']['pseudo_tid_vk_or_email']}")
        else:
            log_error(f"Default request failed: {response.status_code}")
            all_passed = False
            
    except Exception as e:
        log_error(f"Default test exception: {e}")
        all_passed = False
    
    # Test 1.2: hours=1
    try:
        response = session.get("/admin/notifications/health?hours=1")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("window_hours") == 1:
                log_success("hours=1: Correct window")
            else:
                log_error(f"hours=1: Expected window_hours=1, got {data.get('window_hours')}")
                all_passed = False
        else:
            log_error(f"hours=1 failed: {response.status_code}")
            all_passed = False
            
    except Exception as e:
        log_error(f"hours=1 exception: {e}")
        all_passed = False
    
    # Test 1.3: hours=720 (max)
    try:
        response = session.get("/admin/notifications/health?hours=720")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("window_hours") == 720:
                log_success("hours=720: Max window accepted")
            else:
                log_error(f"hours=720: Expected 720, got {data.get('window_hours')}")
                all_passed = False
        else:
            log_error(f"hours=720 failed: {response.status_code}")
            all_passed = False
            
    except Exception as e:
        log_error(f"hours=720 exception: {e}")
        all_passed = False
    
    # Test 1.4: hours=0 (should default to 24, not clamp to 1)
    try:
        response = session.get("/admin/notifications/health?hours=0")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("window_hours") == 24:
                log_success("hours=0: Correctly defaults to 24")
            else:
                log_error(f"hours=0: Expected default to 24, got {data.get('window_hours')}")
                all_passed = False
        else:
            log_error(f"hours=0 failed: {response.status_code}")
            all_passed = False
            
    except Exception as e:
        log_error(f"hours=0 exception: {e}")
        all_passed = False
    
    return all_passed


def test_existing_notification_endpoints(session: TestSession) -> bool:
    """Test 2: Existing notification endpoints still work"""
    log_test("Existing Notification Endpoints")
    
    all_passed = True
    tid = session.telegram_id
    
    # Use pseudo_tid if no real telegram_id
    if not tid and session.uid:
        PSEUDO_TID_OFFSET = 2_000_000_000
        tid = PSEUDO_TID_OFFSET + int(session.uid)
        log_info(f"Using pseudo_tid: {tid}")
    
    if not tid:
        log_error("No telegram_id or uid available, skipping")
        return False
    
    # Test 2.1: GET /api/notifications/{telegram_id}
    try:
        response = session.get(f"/notifications/{tid}")
        
        if response.status_code == 200:
            data = response.json()
            log_success(f"GET /notifications/{tid}: {response.status_code}")
            log_info(f"  Notifications count: {len(data.get('notifications', []))}")
        else:
            log_error(f"GET /notifications/{tid} failed: {response.status_code}")
            all_passed = False
            
    except Exception as e:
        log_error(f"GET notifications exception: {e}")
        all_passed = False
    
    # Test 2.2: GET /api/notifications/{telegram_id}/unread-count
    try:
        response = session.get(f"/notifications/{tid}/unread-count")
        
        if response.status_code == 200:
            data = response.json()
            log_success(f"GET /notifications/{tid}/unread-count: {data.get('count', 0)}")
        else:
            log_error(f"GET unread-count failed: {response.status_code}")
            all_passed = False
            
    except Exception as e:
        log_error(f"GET unread-count exception: {e}")
        all_passed = False
    
    # Test 2.3: GET /api/user-settings/{telegram_id}/notifications
    try:
        response = session.get(f"/user-settings/{tid}/notifications")
        
        if response.status_code == 200:
            data = response.json()
            log_success(f"GET /user-settings/{tid}/notifications: {response.status_code}")
            log_info(f"  notifications_enabled: {data.get('notifications_enabled')}")
            log_info(f"  notification_time: {data.get('notification_time')}")
        else:
            log_error(f"GET notification settings failed: {response.status_code}")
            all_passed = False
            
    except Exception as e:
        log_error(f"GET notification settings exception: {e}")
        all_passed = False
    
    return all_passed


def test_should_send_notification_gating(session: TestSession) -> bool:
    """Test 3: Bug C - should_send_notification unified gating"""
    log_test("Bug C: should_send_notification Unified Gating")
    
    all_passed = True
    tid = session.telegram_id
    
    # Use pseudo_tid if no real telegram_id
    if not tid and session.uid:
        PSEUDO_TID_OFFSET = 2_000_000_000
        tid = PSEUDO_TID_OFFSET + int(session.uid)
        log_info(f"Using pseudo_tid: {tid}")
    
    if not tid:
        log_error("No telegram_id or uid available, skipping")
        return False
    
    # Get current settings
    try:
        response = session.get(f"/user-settings/{tid}/notifications")
        if response.status_code != 200:
            log_error(f"Failed to get current settings: {response.status_code}")
            return False
        
        original_settings = response.json()
        log_info(f"Original settings retrieved")
        
    except Exception as e:
        log_error(f"Failed to get settings: {e}")
        return False
    
    # Test 3.1: Disable social_friend_requests
    try:
        # Update extended notification settings
        update_payload = {
            "social_friend_requests": False
        }
        
        update_response = session.put(
            f"/notifications/{tid}/settings",
            json=update_payload
        )
        
        if update_response.status_code == 200:
            log_success("Disabled social_friend_requests")
            
            # Verify it was saved
            verify_response = session.get(f"/notifications/{tid}/settings")
            if verify_response.status_code == 200:
                verify_data = verify_response.json()
                
                if verify_data.get("social_friend_requests") == False:
                    log_success("Setting verified: social_friend_requests=False")
                else:
                    log_error(f"Setting not saved correctly: {verify_data.get('social_friend_requests')}")
                    all_passed = False
            else:
                log_error(f"Verification failed: {verify_response.status_code}")
                all_passed = False
        else:
            log_error(f"Failed to update settings: {update_response.status_code} - {update_response.text}")
            all_passed = False
            
    except Exception as e:
        log_error(f"social_friend_requests test exception: {e}")
        all_passed = False
    
    # Restore original settings
    try:
        restore_response = session.put(
            f"/user-settings/{tid}/notifications",
            json=original_settings
        )
        if restore_response.status_code == 200:
            log_info("Original settings restored")
        else:
            log_warning(f"Failed to restore settings: {restore_response.status_code}")
            
    except Exception as e:
        log_warning(f"Failed to restore settings: {e}")
    
    return all_passed


def test_web_push_endpoints(session: TestSession) -> bool:
    """Test 5: Web Push subscribe/unsubscribe endpoints"""
    log_test("Web Push Endpoints")
    
    all_passed = True
    tid = session.telegram_id
    
    # Use pseudo_tid if no real telegram_id
    if not tid and session.uid:
        PSEUDO_TID_OFFSET = 2_000_000_000
        tid = PSEUDO_TID_OFFSET + int(session.uid)
        log_info(f"Using pseudo_tid: {tid}")
    
    if not tid:
        log_error("No telegram_id or uid available, skipping")
        return False
    
    # Test subscription payload (mock data)
    subscription_data = {
        "telegram_id": tid,
        "endpoint": f"https://fcm.googleapis.com/fcm/send/test-endpoint-{tid}",
        "keys": {
            "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=",
            "auth": "tBHItJI5svbpez7KI4CCXg=="
        }
    }
    
    # Test 5.1: POST /api/push/subscribe
    try:
        response = session.post("/push/subscribe", json=subscription_data)
        
        if response.status_code in [200, 201]:
            log_success(f"POST /push/subscribe: {response.status_code}")
            data = response.json()
            log_info(f"  Response: {data.get('message', 'OK')}")
        else:
            log_error(f"POST /push/subscribe failed: {response.status_code} - {response.text}")
            all_passed = False
            
    except Exception as e:
        log_error(f"POST /push/subscribe exception: {e}")
        all_passed = False
    
    # Test 5.2: POST /api/push/unsubscribe
    try:
        unsubscribe_data = {
            "telegram_id": tid,
            "endpoint": subscription_data["endpoint"]
        }
        
        response = session.post("/push/unsubscribe", json=unsubscribe_data)
        
        if response.status_code == 200:
            log_success(f"POST /push/unsubscribe: {response.status_code}")
        else:
            log_error(f"POST /push/unsubscribe failed: {response.status_code} - {response.text}")
            all_passed = False
            
    except Exception as e:
        log_error(f"POST /push/unsubscribe exception: {e}")
        all_passed = False
    
    return all_passed


def test_cross_platform_endpoints(session: TestSession) -> bool:
    """Test 6: Cross-platform support (pseudo-tid)"""
    log_test("Cross-Platform Support (pseudo-tid)")
    
    all_passed = True
    
    # Calculate pseudo_tid from uid
    PSEUDO_TID_OFFSET = 2_000_000_000
    
    if session.uid:
        try:
            uid_int = int(session.uid)
            pseudo_tid = PSEUDO_TID_OFFSET + uid_int
            
            log_info(f"Testing with pseudo_tid: {pseudo_tid} (from uid={session.uid})")
            
            # Test 6.1: GET /api/notifications/{pseudo_tid}
            try:
                response = session.get(f"/notifications/{pseudo_tid}")
                
                if response.status_code == 200:
                    data = response.json()
                    log_success(f"GET /notifications/{pseudo_tid}: {response.status_code}")
                    log_info(f"  Notifications: {len(data.get('notifications', []))}")
                else:
                    log_error(f"GET /notifications/{pseudo_tid} failed: {response.status_code}")
                    all_passed = False
                    
            except Exception as e:
                log_error(f"GET notifications (pseudo) exception: {e}")
                all_passed = False
            
            # Test 6.2: GET /api/user-settings/{pseudo_tid}/notifications
            try:
                response = session.get(f"/user-settings/{pseudo_tid}/notifications")
                
                if response.status_code == 200:
                    data = response.json()
                    log_success(f"GET /user-settings/{pseudo_tid}/notifications: {response.status_code}")
                else:
                    # 404 is acceptable if user doesn't have settings yet
                    if response.status_code == 404:
                        log_info(f"GET /user-settings/{pseudo_tid}/notifications: 404 (no settings yet)")
                    else:
                        log_error(f"GET notification settings (pseudo) failed: {response.status_code}")
                        all_passed = False
                    
            except Exception as e:
                log_error(f"GET notification settings (pseudo) exception: {e}")
                all_passed = False
                
        except ValueError:
            log_error(f"Invalid uid format: {session.uid}")
            all_passed = False
    else:
        log_warning("No uid available, skipping pseudo-tid tests")
    
    return all_passed


def main():
    """Main test runner"""
    print(f"\n{Colors.BLUE}{'='*60}{Colors.RESET}")
    print(f"{Colors.BLUE}RUDN Notification System Backend Tests (Release 3){Colors.RESET}")
    print(f"{Colors.BLUE}Backend: {BACKEND_URL}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*60}{Colors.RESET}\n")
    
    # Create session and login
    session = TestSession()
    
    if not session.login(TEST_EMAIL, TEST_PASSWORD):
        log_error("Failed to login, cannot continue tests")
        sys.exit(1)
    
    # Run tests
    results = {}
    
    results["Health Endpoint"] = test_health_endpoint(session)
    results["Existing Endpoints"] = test_existing_notification_endpoints(session)
    results["Bug C: Gating"] = test_should_send_notification_gating(session)
    results["Web Push"] = test_web_push_endpoints(session)
    results["Cross-Platform"] = test_cross_platform_endpoints(session)
    
    # Summary
    print(f"\n{Colors.BLUE}{'='*60}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST SUMMARY{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*60}{Colors.RESET}\n")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = f"{Colors.GREEN}PASS{Colors.RESET}" if result else f"{Colors.RED}FAIL{Colors.RESET}"
        print(f"  {test_name}: {status}")
    
    print(f"\n{Colors.BLUE}Total: {passed}/{total} tests passed{Colors.RESET}\n")
    
    if passed == total:
        print(f"{Colors.GREEN}✓ All tests passed!{Colors.RESET}\n")
        sys.exit(0)
    else:
        print(f"{Colors.RED}✗ Some tests failed{Colors.RESET}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
