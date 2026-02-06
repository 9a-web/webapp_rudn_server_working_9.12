#!/usr/bin/env python3
"""
RUDN Schedule Web Session Backend API Tests

Tests all web session synchronization endpoints according to the test plan.
"""

import requests
import json
import time
import sys
from datetime import datetime
from typing import Optional, Dict, Any

# Backend URL from environment
BACKEND_URL = "https://d8cc5781-41cf-497a-8d0d-1a5844d54640.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class WebSessionTester:
    def __init__(self):
        self.session = requests.Session()
        self.session_tokens = []
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, response_time: float, details: str = ""):
        """Log test result with timing information"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name} ({response_time:.3f}s)")
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "response_time": response_time,
            "details": details
        })
        
    def make_request(self, method: str, url: str, **kwargs) -> tuple[requests.Response, float]:
        """Make HTTP request and measure response time"""
        start_time = time.time()
        response = self.session.request(method, url, **kwargs)
        response_time = time.time() - start_time
        return response, response_time
        
    def test_1_create_web_session(self) -> Optional[str]:
        """Test 1: Create Web Session (POST /api/web-sessions)"""
        print("\n=== Test 1: Create Web Session ===")
        
        url = f"{API_BASE}/web-sessions"
        response, response_time = self.make_request("POST", url, json={})
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ["session_token", "status", "qr_url", "expires_at"]
            
            if all(field in data for field in required_fields):
                if data["status"] == "pending":
                    session_token = data["session_token"]
                    self.session_tokens.append(session_token)
                    
                    self.log_test(
                        "Create Web Session", 
                        True, 
                        response_time,
                        f"Token: {session_token[:8]}..., Status: {data['status']}"
                    )
                    return session_token
                else:
                    self.log_test("Create Web Session", False, response_time, f"Status not pending: {data['status']}")
            else:
                missing = [f for f in required_fields if f not in data]
                self.log_test("Create Web Session", False, response_time, f"Missing fields: {missing}")
        else:
            self.log_test("Create Web Session", False, response_time, f"HTTP {response.status_code}: {response.text}")
            
        return None
        
    def test_2_get_session_status(self, session_token: str) -> bool:
        """Test 2: Get Session Status (GET /api/web-sessions/{token}/status)"""
        print("\n=== Test 2: Get Session Status ===")
        
        url = f"{API_BASE}/web-sessions/{session_token}/status"
        response, response_time = self.make_request("GET", url)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "pending" and "qr_url" in data:
                self.log_test(
                    "Get Session Status (Pending)", 
                    True, 
                    response_time,
                    f"Status: {data['status']}, Has QR URL: {'qr_url' in data}"
                )
                return True
            else:
                self.log_test(
                    "Get Session Status (Pending)", 
                    False, 
                    response_time, 
                    f"Status: {data.get('status')}, Has QR URL: {'qr_url' in data}"
                )
        else:
            self.log_test("Get Session Status (Pending)", False, response_time, f"HTTP {response.status_code}: {response.text}")
            
        return False
        
    def test_3_notify_session_scanned(self, session_token: str) -> bool:
        """Test 3: Notify Session Scanned (POST /api/web-sessions/{token}/scanned)"""
        print("\n=== Test 3: Notify Session Scanned ===")
        
        url = f"{API_BASE}/web-sessions/{session_token}/scanned"
        payload = {
            "telegram_id": 999888,
            "first_name": "TestUser",
            "photo_url": None
        }
        
        response, response_time = self.make_request("POST", url, json=payload)
        
        if response.status_code == 200:
            self.log_test(
                "Notify Session Scanned", 
                True, 
                response_time,
                f"Scanned by telegram_id: {payload['telegram_id']}"
            )
            return True
        else:
            self.log_test("Notify Session Scanned", False, response_time, f"HTTP {response.status_code}: {response.text}")
            
        return False
        
    def test_4_verify_scanned_data(self, session_token: str) -> bool:
        """Test 4: Verify scanned data in status (GET /api/web-sessions/{token}/status)"""
        print("\n=== Test 4: Verify Scanned Data in Status ===")
        
        url = f"{API_BASE}/web-sessions/{session_token}/status"
        response, response_time = self.make_request("GET", url)
        
        if response.status_code == 200:
            data = response.json()
            if (data.get("telegram_id") == 999888 and 
                data.get("first_name") == "TestUser" and
                data.get("status") == "pending"):
                self.log_test(
                    "Verify Scanned Data", 
                    True, 
                    response_time,
                    f"telegram_id: {data.get('telegram_id')}, first_name: {data.get('first_name')}"
                )
                return True
            else:
                self.log_test(
                    "Verify Scanned Data", 
                    False, 
                    response_time,
                    f"telegram_id: {data.get('telegram_id')}, first_name: {data.get('first_name')}, status: {data.get('status')}"
                )
        else:
            self.log_test("Verify Scanned Data", False, response_time, f"HTTP {response.status_code}: {response.text}")
            
        return False
        
    def test_5_link_session(self, session_token: str) -> bool:
        """Test 5: Link Session (POST /api/web-sessions/{token}/link)"""
        print("\n=== Test 5: Link Session ===")
        
        url = f"{API_BASE}/web-sessions/{session_token}/link"
        payload = {
            "telegram_id": 999888,
            "first_name": "TestUser",
            "last_name": "Bot",
            "username": "testbot",
            "photo_url": None
        }
        
        response, response_time = self.make_request("POST", url, json=payload)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") is True:
                self.log_test(
                    "Link Session", 
                    True, 
                    response_time,
                    f"Success: {data.get('success')}, Message: {data.get('message', '')}"
                )
                return True
            else:
                self.log_test(
                    "Link Session", 
                    False, 
                    response_time,
                    f"Success: {data.get('success')}, Message: {data.get('message', '')}"
                )
        else:
            self.log_test("Link Session", False, response_time, f"HTTP {response.status_code}: {response.text}")
            
        return False
        
    def test_6_verify_linked_status(self, session_token: str) -> bool:
        """Test 6: Verify Linked Status (GET /api/web-sessions/{token}/status)"""
        print("\n=== Test 6: Verify Linked Status ===")
        
        url = f"{API_BASE}/web-sessions/{session_token}/status"
        response, response_time = self.make_request("GET", url)
        
        if response.status_code == 200:
            data = response.json()
            expected_fields = {
                "status": "linked",
                "telegram_id": 999888,
                "first_name": "TestUser",
                "last_name": "Bot",
                "username": "testbot"
            }
            
            success = all(data.get(key) == value for key, value in expected_fields.items())
            
            if success:
                self.log_test(
                    "Verify Linked Status", 
                    True, 
                    response_time,
                    f"Status: {data.get('status')}, User: {data.get('first_name')} {data.get('last_name')}"
                )
                return True
            else:
                mismatches = {k: f"expected {v}, got {data.get(k)}" for k, v in expected_fields.items() if data.get(k) != v}
                self.log_test(
                    "Verify Linked Status", 
                    False, 
                    response_time,
                    f"Mismatches: {mismatches}"
                )
        else:
            self.log_test("Verify Linked Status", False, response_time, f"HTTP {response.status_code}: {response.text}")
            
        return False
        
    def test_7_heartbeat(self, session_token: str) -> bool:
        """Test 7: Heartbeat (POST /api/web-sessions/{token}/heartbeat)"""
        print("\n=== Test 7: Heartbeat ===")
        
        url = f"{API_BASE}/web-sessions/{session_token}/heartbeat"
        response, response_time = self.make_request("POST", url, json={})
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") is True:
                self.log_test(
                    "Heartbeat", 
                    True, 
                    response_time,
                    f"Success: {data.get('success')}"
                )
                return True
            else:
                self.log_test(
                    "Heartbeat", 
                    False, 
                    response_time,
                    f"Success: {data.get('success')}, Message: {data.get('message', '')}"
                )
        else:
            self.log_test("Heartbeat", False, response_time, f"HTTP {response.status_code}: {response.text}")
            
        return False
        
    def test_8_get_user_devices(self) -> bool:
        """Test 8: Get User Devices (GET /api/web-sessions/user/999888/devices)"""
        print("\n=== Test 8: Get User Devices ===")
        
        url = f"{API_BASE}/web-sessions/user/999888/devices"
        response, response_time = self.make_request("GET", url)
        
        if response.status_code == 200:
            data = response.json()
            devices = data.get("devices", [])
            
            # Check if our linked session appears in devices list
            session_found = any(
                device.get("session_token") in self.session_tokens 
                for device in devices
            )
            
            if session_found and len(devices) > 0:
                self.log_test(
                    "Get User Devices", 
                    True, 
                    response_time,
                    f"Found {len(devices)} devices, linked session present"
                )
                return True
            else:
                self.log_test(
                    "Get User Devices", 
                    False, 
                    response_time,
                    f"Found {len(devices)} devices, linked session present: {session_found}"
                )
        else:
            self.log_test("Get User Devices", False, response_time, f"HTTP {response.status_code}: {response.text}")
            
        return False
        
    def test_9_race_condition(self) -> bool:
        """Test 9: Race Condition Test - Try linking ALREADY linked session"""
        print("\n=== Test 9: Race Condition Test ===")
        
        # Create a NEW session
        print("Creating new session for race condition test...")
        new_token = self.test_1_create_web_session()
        if not new_token:
            return False
            
        # Link the new session
        print("Linking new session...")
        if not self.test_5_link_session(new_token):
            return False
            
        # Try to link the FIRST session again (should fail)
        print("Attempting to link old session (should fail)...")
        if len(self.session_tokens) >= 2:
            old_token = self.session_tokens[0]  # First session token
            
            url = f"{API_BASE}/web-sessions/{old_token}/link"
            payload = {
                "telegram_id": 999888,
                "first_name": "TestUser",
                "last_name": "Bot",
                "username": "testbot",
                "photo_url": None
            }
            
            response, response_time = self.make_request("POST", url, json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") is False:
                    self.log_test(
                        "Race Condition Test", 
                        True, 
                        response_time,
                        f"Correctly prevented double linking: {data.get('message', '')}"
                    )
                    return True
                else:
                    self.log_test(
                        "Race Condition Test", 
                        False, 
                        response_time,
                        "Should have failed but returned success=true"
                    )
            else:
                self.log_test("Race Condition Test", False, response_time, f"HTTP {response.status_code}: {response.text}")
        else:
            self.log_test("Race Condition Test", False, 0, "Not enough session tokens for race condition test")
            
        return False
        
    def test_10_reject_session(self) -> bool:
        """Test 10: Reject Test"""
        print("\n=== Test 10: Reject Session Test ===")
        
        # Create another session
        reject_token = self.test_1_create_web_session()
        if not reject_token:
            return False
            
        # Reject the session
        url = f"{API_BASE}/web-sessions/{reject_token}/rejected"
        response, response_time = self.make_request("POST", url, json={})
        
        if response.status_code == 200:
            # Check if status becomes "expired"
            time.sleep(0.1)  # Small delay to ensure update is processed
            
            status_url = f"{API_BASE}/web-sessions/{reject_token}/status"
            status_response, status_time = self.make_request("GET", status_url)
            
            if status_response.status_code == 200:
                status_data = status_response.json()
                if status_data.get("status") == "expired":
                    self.log_test(
                        "Reject Session", 
                        True, 
                        response_time + status_time,
                        f"Session correctly marked as expired after rejection"
                    )
                    return True
                else:
                    self.log_test(
                        "Reject Session", 
                        False, 
                        response_time + status_time,
                        f"Status after rejection: {status_data.get('status')}, expected 'expired'"
                    )
            else:
                self.log_test("Reject Session", False, response_time, "Failed to check status after rejection")
        else:
            self.log_test("Reject Session", False, response_time, f"HTTP {response.status_code}: {response.text}")
            
        return False
        
    def test_11_revoke_single_device(self) -> bool:
        """Test 11: Revoke Single Device (DELETE /api/web-sessions/{token}?telegram_id=999888)"""
        print("\n=== Test 11: Revoke Single Device ===")
        
        if not self.session_tokens:
            self.log_test("Revoke Single Device", False, 0, "No session tokens available")
            return False
            
        # Use one of the linked session tokens
        session_token = self.session_tokens[0]
        
        url = f"{API_BASE}/web-sessions/{session_token}"
        params = {"telegram_id": 999888}
        response, response_time = self.make_request("DELETE", url, params=params)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") is True:
                self.log_test(
                    "Revoke Single Device", 
                    True, 
                    response_time,
                    f"Success: {data.get('success')}, Message: {data.get('message', '')}"
                )
                return True
            else:
                self.log_test(
                    "Revoke Single Device", 
                    False, 
                    response_time,
                    f"Success: {data.get('success')}, Message: {data.get('message', '')}"
                )
        else:
            self.log_test("Revoke Single Device", False, response_time, f"HTTP {response.status_code}: {response.text}")
            
        return False
        
    def test_12_revoke_all_devices(self) -> bool:
        """Test 12: Revoke All Devices (DELETE /api/web-sessions/user/999888/all)"""
        print("\n=== Test 12: Revoke All Devices ===")
        
        url = f"{API_BASE}/web-sessions/user/999888/all"
        response, response_time = self.make_request("DELETE", url)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") is True and "deleted_count" in data:
                self.log_test(
                    "Revoke All Devices", 
                    True, 
                    response_time,
                    f"Success: {data.get('success')}, Deleted: {data.get('deleted_count')} devices"
                )
                return True
            else:
                self.log_test(
                    "Revoke All Devices", 
                    False, 
                    response_time,
                    f"Success: {data.get('success')}, Deleted: {data.get('deleted_count', 'N/A')}"
                )
        else:
            self.log_test("Revoke All Devices", False, response_time, f"HTTP {response.status_code}: {response.text}")
            
        return False
        
    def test_13_heartbeat_on_deleted_session(self) -> bool:
        """Test 13: Heartbeat on deleted session (should return 404)"""
        print("\n=== Test 13: Heartbeat on Deleted Session ===")
        
        if not self.session_tokens:
            self.log_test("Heartbeat on Deleted Session", False, 0, "No session tokens available")
            return False
            
        # Use a revoked session token
        session_token = self.session_tokens[0]
        
        url = f"{API_BASE}/web-sessions/{session_token}/heartbeat"
        response, response_time = self.make_request("POST", url, json={})
        
        if response.status_code == 404:
            self.log_test(
                "Heartbeat on Deleted Session", 
                True, 
                response_time,
                f"Correctly returned 404 for deleted session"
            )
            return True
        else:
            self.log_test(
                "Heartbeat on Deleted Session", 
                False, 
                response_time,
                f"Expected 404, got HTTP {response.status_code}: {response.text}"
            )
            
        return False
        
    def run_all_tests(self):
        """Run complete web session lifecycle test suite"""
        print(f"🚀 Starting RUDN Schedule Web Session API Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"API Base: {API_BASE}")
        print("="*70)
        
        # Test 1: Create Web Session
        session_token = self.test_1_create_web_session()
        if not session_token:
            print("❌ Failed to create web session. Aborting test suite.")
            return False
            
        # Test 2: Get Session Status (pending)
        self.test_2_get_session_status(session_token)
        
        # Test 3: Notify Session Scanned
        self.test_3_notify_session_scanned(session_token)
        
        # Test 4: Verify scanned data in status
        self.test_4_verify_scanned_data(session_token)
        
        # Test 5: Link Session
        self.test_5_link_session(session_token)
        
        # Test 6: Verify Linked Status
        self.test_6_verify_linked_status(session_token)
        
        # Test 7: Heartbeat
        self.test_7_heartbeat(session_token)
        
        # Test 8: Get User Devices
        self.test_8_get_user_devices()
        
        # Test 9: Race Condition Test
        self.test_9_race_condition()
        
        # Test 10: Reject Test
        self.test_10_reject_session()
        
        # Test 11: Revoke Single Device
        self.test_11_revoke_single_device()
        
        # Test 12: Revoke All Devices
        self.test_12_revoke_all_devices()
        
        # Test 13: Heartbeat on deleted session
        self.test_13_heartbeat_on_deleted_session()
        
        # Print summary
        self.print_summary()
        
        return all(result["success"] for result in self.test_results)
        
    def print_summary(self):
        """Print test results summary"""
        print("\n" + "="*70)
        print("🏁 TEST RESULTS SUMMARY")
        print("="*70)
        
        passed = sum(1 for result in self.test_results if result["success"])
        failed = len(self.test_results) - passed
        total_time = sum(result["response_time"] for result in self.test_results)
        
        print(f"Total Tests: {len(self.test_results)}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Total Response Time: {total_time:.3f}s")
        print(f"Average Response Time: {total_time/len(self.test_results):.3f}s")
        
        if failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   • {result['test']}: {result['details']}")
        
        print(f"\n🎯 Overall Result: {'✅ ALL TESTS PASSED' if failed == 0 else f'❌ {failed} TESTS FAILED'}")


if __name__ == "__main__":
    tester = WebSessionTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code for CI/automation
    sys.exit(0 if success else 1)