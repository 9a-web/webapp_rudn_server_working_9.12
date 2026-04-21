#!/usr/bin/env python3
"""
Stage 8 Deep Profile Audit Security Testing - Simplified
Testing key security scenarios for authorization bypass fixes
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime
from typing import Dict, Any, Optional, Tuple

import httpx

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Backend URL - use localhost for testing
BACKEND_URL = "http://localhost:8001"
API_BASE = f"{BACKEND_URL}/api"

class SecurityTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.test_results = []
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
        
    def log_test(self, test_name: str, passed: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        logger.info(f"{status}: {test_name}")
        if details:
            logger.info(f"  Details: {details}")
        self.test_results.append({
            "test": test_name,
            "passed": passed,
            "details": details
        })

    async def test_legacy_endpoints_no_jwt(self):
        """Test that legacy profile endpoints require JWT and return 401 without it"""
        logger.info("\n=== Testing legacy profile endpoints without JWT ===")
        
        # Use a dummy telegram_id for testing
        dummy_tid = 123456789
        
        endpoints = [
            ("PUT", f"/profile/{dummy_tid}/privacy?requester_telegram_id={dummy_tid}", {"show_online_status": True}),
            ("GET", f"/profile/{dummy_tid}/privacy?requester_telegram_id={dummy_tid}", None),
            ("PUT", f"/profile/{dummy_tid}/avatar", {"avatar_data": "", "requester_telegram_id": dummy_tid}),
            ("DELETE", f"/profile/{dummy_tid}/avatar?requester_telegram_id={dummy_tid}", None),
            ("PUT", f"/profile/{dummy_tid}/graffiti", {"graffiti_data": "", "requester_telegram_id": dummy_tid}),
            ("POST", f"/profile/{dummy_tid}/graffiti/clear", {"requester_telegram_id": dummy_tid}),
            ("PUT", f"/profile/{dummy_tid}/wall-graffiti", {"wall_graffiti_data": "", "requester_telegram_id": dummy_tid}),
            ("POST", f"/profile/{dummy_tid}/wall-graffiti/clear", {"requester_telegram_id": dummy_tid}),
            ("PUT", f"/profile/{dummy_tid}/wall-graffiti/access", {"requester_telegram_id": dummy_tid}),
            ("POST", "/profile/activity-ping", {"telegram_id": dummy_tid}),
            ("POST", f"/profile/{dummy_tid}/view", {"viewer_telegram_id": dummy_tid + 1})
        ]
        
        for i, (method, endpoint, body) in enumerate(endpoints, 1):
            try:
                if method == "GET":
                    resp = await self.client.get(f"{API_BASE}{endpoint}")
                elif method == "POST":
                    resp = await self.client.post(f"{API_BASE}{endpoint}", json=body)
                elif method == "PUT":
                    resp = await self.client.put(f"{API_BASE}{endpoint}", json=body)
                elif method == "DELETE":
                    resp = await self.client.delete(f"{API_BASE}{endpoint}")
                    
                # These endpoints should now require JWT and return 401
                expected_status = 401
                passed = resp.status_code == expected_status
                self.log_test(f"Legacy-{i}: {method} {endpoint} without JWT → {expected_status}", 
                             passed, f"Got {resp.status_code}")
                             
            except Exception as e:
                self.log_test(f"Legacy-{i}: {method} {endpoint} without JWT → 401", False, f"Exception: {e}")

    async def test_auth_regression(self):
        """Test basic auth endpoints still work"""
        logger.info("\n=== Testing auth regression ===")
        
        # Test auth config endpoint
        try:
            resp = await self.client.get(f"{API_BASE}/auth/config")
            passed = False
            if resp.status_code == 200:
                data = resp.json()
                passed = "qr_login_ttl_minutes" in data and data["qr_login_ttl_minutes"] == 5
            self.log_test("Auth config contains qr_login_ttl_minutes=5", passed, 
                         f"Got {resp.status_code}, qr_ttl={data.get('qr_login_ttl_minutes') if resp.status_code == 200 else 'N/A'}")
        except Exception as e:
            self.log_test("Auth config contains qr_login_ttl_minutes=5", False, f"Exception: {e}")
            
        # Test that auth endpoints don't require JWT
        try:
            resp = await self.client.get(f"{API_BASE}/auth/check-username/testuser")
            passed = resp.status_code in [200, 422]  # Should work without JWT
            self.log_test("Username check works without JWT", passed, f"Got {resp.status_code}")
        except Exception as e:
            self.log_test("Username check works without JWT", False, f"Exception: {e}")

    async def test_new_u_uid_endpoints(self):
        """Test that new /u/{uid} endpoints work correctly"""
        logger.info("\n=== Testing /u/{uid} endpoints ===")
        
        # Use a dummy uid for testing
        dummy_uid = "123456789"
        
        # Test that /u/{uid} endpoint works without JWT (public profile)
        try:
            resp = await self.client.get(f"{API_BASE}/u/{dummy_uid}")
            # Should return 404 for non-existent user, not 401
            passed = resp.status_code in [200, 404, 422]
            self.log_test("GET /u/{uid} without JWT works", passed, f"Got {resp.status_code}")
        except Exception as e:
            self.log_test("GET /u/{uid} without JWT works", False, f"Exception: {e}")
            
        # Test that /u/{uid}/resolve works without JWT
        try:
            resp = await self.client.get(f"{API_BASE}/u/{dummy_uid}/resolve")
            # Should return 404 for non-existent user, not 401
            passed = resp.status_code in [200, 404, 422]
            self.log_test("GET /u/{uid}/resolve without JWT works", passed, f"Got {resp.status_code}")
        except Exception as e:
            self.log_test("GET /u/{uid}/resolve without JWT works", False, f"Exception: {e}")
            
        # Test that /u/{uid}/schedule requires JWT
        try:
            resp = await self.client.get(f"{API_BASE}/u/{dummy_uid}/schedule")
            # Should require JWT
            passed = resp.status_code == 401
            self.log_test("GET /u/{uid}/schedule without JWT → 401", passed, f"Got {resp.status_code}")
        except Exception as e:
            self.log_test("GET /u/{uid}/schedule without JWT → 401", False, f"Exception: {e}")
            
        # Test that /u/{uid}/privacy requires JWT
        try:
            resp = await self.client.get(f"{API_BASE}/u/{dummy_uid}/privacy")
            # Should require JWT
            passed = resp.status_code == 401
            self.log_test("GET /u/{uid}/privacy without JWT → 401", passed, f"Got {resp.status_code}")
        except Exception as e:
            self.log_test("GET /u/{uid}/privacy without JWT → 401", False, f"Exception: {e}")

    async def test_health_and_basic_endpoints(self):
        """Test that basic endpoints still work"""
        logger.info("\n=== Testing basic endpoints ===")
        
        # Test health endpoint
        try:
            resp = await self.client.get(f"{API_BASE}/health")
            passed = resp.status_code == 200
            self.log_test("Health endpoint works", passed, f"Got {resp.status_code}")
        except Exception as e:
            self.log_test("Health endpoint works", False, f"Exception: {e}")
            
        # Test root endpoint
        try:
            resp = await self.client.get(f"{API_BASE}/")
            passed = resp.status_code == 200
            self.log_test("Root API endpoint works", passed, f"Got {resp.status_code}")
        except Exception as e:
            self.log_test("Root API endpoint works", False, f"Exception: {e}")

    async def run_all_tests(self):
        """Run all security tests"""
        logger.info("🛡️ Starting Stage 8 Deep Profile Audit Security Tests (Simplified)")
        logger.info(f"Backend URL: {BACKEND_URL}")
        
        try:
            # Run test groups
            await self.test_legacy_endpoints_no_jwt()
            await self.test_auth_regression()
            await self.test_new_u_uid_endpoints()
            await self.test_health_and_basic_endpoints()
            
        except Exception as e:
            logger.error(f"Test execution failed: {e}")
            
        # Summary
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["passed"])
        failed_tests = total_tests - passed_tests
        
        logger.info(f"\n🎯 TEST SUMMARY:")
        logger.info(f"Total tests: {total_tests}")
        logger.info(f"Passed: {passed_tests} ✅")
        logger.info(f"Failed: {failed_tests} ❌")
        if total_tests > 0:
            logger.info(f"Success rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            logger.info(f"\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["passed"]:
                    logger.info(f"  - {result['test']}: {result['details']}")
                    
        return passed_tests, failed_tests, self.test_results

async def main():
    """Main test runner"""
    async with SecurityTester() as tester:
        passed, failed, results = await tester.run_all_tests()
        
        # Exit with error code if tests failed
        if failed > 0:
            sys.exit(1)
        else:
            logger.info("🎉 All tests passed!")
            sys.exit(0)

if __name__ == "__main__":
    asyncio.run(main())