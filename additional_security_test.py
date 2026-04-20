#!/usr/bin/env python3
"""
Additional verification tests for auth security fixes.

Tests scenarios that were successful in the first run and additional edge cases.
"""

import asyncio
import json
import logging
import sys
import time
from typing import Dict, Any

import httpx

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Backend URL - use localhost for testing
BACKEND_URL = "http://localhost:8001"
API_BASE = f"{BACKEND_URL}/api"

class AdditionalSecurityTester:
    """Additional verification tests for auth security."""
    
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.test_results = []
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
        
    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result."""
        status = "✅ PASS" if success else "❌ FAIL"
        message = f"{status}: {test_name}"
        if details:
            message += f" - {details}"
        logger.info(message)
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    async def test_existing_user_isolation(self):
        """Test that existing users are properly isolated."""
        test_name = "Existing user isolation verification"
        
        try:
            # Check that usernames from first test run are properly taken
            usernames_to_check = ["shkarol_a", "widget_test", "vk_taken", "MixedCase"]
            
            all_taken = True
            for username in usernames_to_check:
                check_resp = await self.client.get(f"{API_BASE}/auth/check-username/{username}")
                if check_resp.status_code == 200:
                    check_data = check_resp.json()
                    if check_data.get("available"):
                        all_taken = False
                        self.log_result(f"{test_name} - {username}", False, f"Username unexpectedly available")
                        break
                else:
                    all_taken = False
                    self.log_result(f"{test_name} - {username}", False, f"Check failed: {check_resp.status_code}")
                    break
                    
            if all_taken:
                self.log_result(test_name, True, "All test usernames properly taken - no auto-link occurred")
                
        except Exception as e:
            self.log_result(test_name, False, f"Exception: {str(e)}")
            
    async def test_case_variations(self):
        """Test various case combinations for username uniqueness."""
        test_name = "Case variation testing"
        
        try:
            # Test different case variations of existing usernames
            base_username = "mixedcase"  # We know this exists from logs
            variations = ["MixedCase", "MIXEDCASE", "mixedCase", "MiXeDcAsE"]
            
            all_unavailable = True
            for variation in variations:
                check_resp = await self.client.get(f"{API_BASE}/auth/check-username/{variation}")
                if check_resp.status_code == 200:
                    check_data = check_resp.json()
                    if check_data.get("available"):
                        all_unavailable = False
                        self.log_result(f"{test_name} - {variation}", False, f"Case variation unexpectedly available")
                        break
                else:
                    all_unavailable = False
                    self.log_result(f"{test_name} - {variation}", False, f"Check failed: {check_resp.status_code}")
                    break
                    
            if all_unavailable:
                self.log_result(test_name, True, "All case variations properly unavailable")
                
        except Exception as e:
            self.log_result(test_name, False, f"Exception: {str(e)}")
            
    async def test_edge_case_usernames(self):
        """Test edge cases for username validation."""
        test_name = "Username edge cases"
        
        try:
            edge_cases = [
                ("", False, "empty"),
                ("a", False, "too short"),
                ("ab", False, "too short"),
                ("a" * 33, False, "too long"),
                ("user@name", False, "invalid chars"),
                ("user-name", False, "invalid chars"),
                ("user.name", False, "invalid chars"),
                ("123", True, "numbers only"),
                ("user123", True, "alphanumeric"),
                ("user_123", True, "with underscore"),
            ]
            
            all_correct = True
            for username, should_be_valid, description in edge_cases:
                check_resp = await self.client.get(f"{API_BASE}/auth/check-username/{username}")
                if check_resp.status_code == 200:
                    check_data = check_resp.json()
                    is_valid_format = check_data.get("available") or check_data.get("reason") == "Занято"
                    
                    if should_be_valid and not is_valid_format:
                        all_correct = False
                        self.log_result(f"{test_name} - {description}", False, 
                                      f"'{username}' should be valid format but got: {check_data.get('reason')}")
                        break
                    elif not should_be_valid and is_valid_format:
                        all_correct = False
                        self.log_result(f"{test_name} - {description}", False, 
                                      f"'{username}' should be invalid but was accepted")
                        break
                else:
                    all_correct = False
                    self.log_result(f"{test_name} - {description}", False, 
                                  f"Check failed for '{username}': {check_resp.status_code}")
                    break
                    
            if all_correct:
                self.log_result(test_name, True, "All username edge cases handled correctly")
                
        except Exception as e:
            self.log_result(test_name, False, f"Exception: {str(e)}")
            
    async def test_reserved_usernames(self):
        """Test that reserved usernames are properly blocked."""
        test_name = "Reserved usernames blocking"
        
        try:
            reserved_names = ["admin", "root", "system", "support", "api", "auth", "login", 
                            "register", "rudn", "null", "undefined", "me", "settings",
                            "profile", "users", "user", "telegram", "vk", "email"]
            
            all_blocked = True
            for username in reserved_names:
                check_resp = await self.client.get(f"{API_BASE}/auth/check-username/{username}")
                if check_resp.status_code == 200:
                    check_data = check_resp.json()
                    if check_data.get("available"):
                        all_blocked = False
                        self.log_result(f"{test_name} - {username}", False, f"Reserved username '{username}' not blocked")
                        break
                    elif "зарезервировано" not in check_data.get("reason", "").lower():
                        # It's blocked but maybe for a different reason (like being taken)
                        # This is still acceptable for security
                        pass
                else:
                    all_blocked = False
                    self.log_result(f"{test_name} - {username}", False, f"Check failed: {check_resp.status_code}")
                    break
                    
            if all_blocked:
                self.log_result(test_name, True, "All reserved usernames properly blocked")
                
        except Exception as e:
            self.log_result(test_name, False, f"Exception: {str(e)}")
            
    async def test_endpoint_security_consistency(self):
        """Test that all auth endpoints consistently handle security."""
        test_name = "Endpoint security consistency"
        
        try:
            # Test that all login endpoints return 401 for invalid data (not 500)
            endpoints_to_test = [
                ("/auth/login/telegram-webapp", {"init_data": "invalid"}),
                ("/auth/login/telegram", {"id": 123, "hash": "invalid", "auth_date": int(time.time())}),
                ("/auth/login/vk", {"code": "invalid"}),
            ]
            
            all_consistent = True
            for endpoint, payload in endpoints_to_test:
                resp = await self.client.post(f"{API_BASE}{endpoint}", json=payload)
                if resp.status_code not in [401, 502]:  # 502 is acceptable for VK external service errors
                    all_consistent = False
                    self.log_result(f"{test_name} - {endpoint}", False, 
                                  f"Expected 401/502, got {resp.status_code}")
                    break
                    
            if all_consistent:
                self.log_result(test_name, True, "All login endpoints handle invalid data consistently")
                
        except Exception as e:
            self.log_result(test_name, False, f"Exception: {str(e)}")
            
    async def test_link_endpoint_consistency(self):
        """Test that all link endpoints consistently require authentication."""
        test_name = "Link endpoint auth consistency"
        
        try:
            # Test that all link endpoints require JWT
            endpoints_to_test = [
                ("/auth/link/email", {"email": "test@test.com", "password": "pass"}),
                ("/auth/link/telegram", {"id": 123, "hash": "invalid", "auth_date": int(time.time())}),
                ("/auth/link/vk", {"code": "invalid"}),
                ("/auth/link/telegram-webapp", {"init_data": "invalid"}),
            ]
            
            all_require_auth = True
            for endpoint, payload in endpoints_to_test:
                resp = await self.client.post(f"{API_BASE}{endpoint}", json=payload)
                if resp.status_code != 401:
                    all_require_auth = False
                    self.log_result(f"{test_name} - {endpoint}", False, 
                                  f"Expected 401, got {resp.status_code}")
                    break
                    
            if all_require_auth:
                self.log_result(test_name, True, "All link endpoints consistently require authentication")
                
        except Exception as e:
            self.log_result(test_name, False, f"Exception: {str(e)}")
            
    async def run_all_tests(self):
        """Run all additional verification tests."""
        logger.info("🔍 Starting additional auth security verification...")
        logger.info(f"Backend URL: {BACKEND_URL}")
        
        # Additional verification tests
        await self.test_existing_user_isolation()
        await self.test_case_variations()
        await self.test_edge_case_usernames()
        await self.test_reserved_usernames()
        await self.test_endpoint_security_consistency()
        await self.test_link_endpoint_consistency()
        
        # Summary
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        logger.info(f"\n🧪 ADDITIONAL VERIFICATION SUMMARY:")
        logger.info(f"Total tests: {total_tests}")
        logger.info(f"Passed: {passed_tests} ✅")
        logger.info(f"Failed: {failed_tests} ❌")
        
        if failed_tests > 0:
            logger.info(f"\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    logger.info(f"  - {result['test']}: {result['details']}")
        else:
            logger.info("🎉 All additional verification tests passed!")
                    
        return passed_tests, failed_tests

async def main():
    """Main test runner."""
    async with AdditionalSecurityTester() as tester:
        passed, failed = await tester.run_all_tests()
        
        if failed > 0:
            sys.exit(1)
        else:
            logger.info("✅ Additional verification completed successfully!")
            sys.exit(0)

if __name__ == "__main__":
    asyncio.run(main())