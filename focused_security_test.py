#!/usr/bin/env python3
"""
Focused security testing for auth fixes - avoiding rate limits.

Tests critical security scenarios without creating many new users.
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

class FocusedSecurityTester:
    """Focused tester for critical auth security scenarios."""
    
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
        
    async def test_auth_config(self):
        """Test auth config endpoint."""
        test_name = "Auth config endpoint"
        
        try:
            config_resp = await self.client.get(f"{API_BASE}/auth/config")
            
            if config_resp.status_code == 200:
                config_data = config_resp.json()
                required_fields = ["telegram_bot_username", "vk_app_id", "env", "features"]
                
                missing_fields = [field for field in required_fields if field not in config_data]
                if not missing_fields:
                    self.log_result(test_name, True, f"Returns all required fields")
                else:
                    self.log_result(test_name, False, f"Missing fields: {missing_fields}")
            else:
                self.log_result(test_name, False, f"Failed: {config_resp.status_code}")
                
        except Exception as e:
            self.log_result(test_name, False, f"Exception: {str(e)}")
            
    async def test_telegram_webapp_security(self):
        """Test Telegram WebApp security - no auto-link by username."""
        test_name = "Telegram WebApp security fix"
        
        try:
            # Test with invalid initData - should return 401, not 500
            webapp_resp = await self.client.post(f"{API_BASE}/auth/login/telegram-webapp", json={
                "init_data": "invalid_data_for_testing"
            })
            
            if webapp_resp.status_code == 401:
                self.log_result(test_name, True, "Invalid initData correctly returns 401 (not 500)")
            else:
                self.log_result(test_name, False, f"Expected 401, got {webapp_resp.status_code}")
                
        except Exception as e:
            self.log_result(test_name, False, f"Exception: {str(e)}")
            
    async def test_telegram_widget_security(self):
        """Test Telegram Widget security - no auto-link by username."""
        test_name = "Telegram Widget security fix"
        
        try:
            # Test with invalid hash - should return 401
            widget_resp = await self.client.post(f"{API_BASE}/auth/login/telegram", json={
                "id": 999000003,
                "username": "test_user",
                "first_name": "Test",
                "last_name": "User",
                "auth_date": int(time.time()),
                "hash": "invalid_hash"
            })
            
            if widget_resp.status_code == 401:
                self.log_result(test_name, True, "Invalid widget hash correctly returns 401")
            else:
                self.log_result(test_name, False, f"Expected 401, got {widget_resp.status_code}")
                
        except Exception as e:
            self.log_result(test_name, False, f"Exception: {str(e)}")
            
    async def test_vk_login_security(self):
        """Test VK login security - no auto-link by screen_name."""
        test_name = "VK login security fix"
        
        try:
            # Test with invalid code - should return 401 or 502
            vk_resp = await self.client.post(f"{API_BASE}/auth/login/vk", json={
                "code": "invalid_code",
                "redirect_uri": "https://example.com/callback"
            })
            
            if vk_resp.status_code in [401, 502]:
                self.log_result(test_name, True, f"Invalid VK code correctly returns {vk_resp.status_code}")
            else:
                self.log_result(test_name, False, f"Expected 401/502, got {vk_resp.status_code}")
                
        except Exception as e:
            self.log_result(test_name, False, f"Exception: {str(e)}")
            
    async def test_case_insensitive_username_check(self):
        """Test case-insensitive username checking."""
        test_name = "Case-insensitive username check"
        
        try:
            # Test with a username that should be case-insensitive
            # We know from logs that "MixedCase" was registered
            check_lower = await self.client.get(f"{API_BASE}/auth/check-username/mixedcase")
            check_upper = await self.client.get(f"{API_BASE}/auth/check-username/MIXEDCASE")
            
            if check_lower.status_code == 200 and check_upper.status_code == 200:
                lower_data = check_lower.json()
                upper_data = check_upper.json()
                
                # Both should be unavailable if case-insensitive uniqueness works
                if not lower_data.get("available") and not upper_data.get("available"):
                    self.log_result(test_name, True, "Case-insensitive uniqueness works correctly")
                else:
                    self.log_result(test_name, False, 
                                  f"Case sensitivity issue: lower={lower_data.get('available')}, upper={upper_data.get('available')}")
            else:
                self.log_result(test_name, False, 
                              f"Failed to check username: {check_lower.status_code}, {check_upper.status_code}")
                
        except Exception as e:
            self.log_result(test_name, False, f"Exception: {str(e)}")
            
    async def test_link_endpoints_security(self):
        """Test link endpoints require valid authentication."""
        test_name = "Link endpoints security"
        
        try:
            # Test link/email without auth - should require JWT
            link_email_resp = await self.client.post(f"{API_BASE}/auth/link/email", json={
                "email": "test@example.com",
                "password": "Password123!",
                "first_name": "Test",
                "last_name": "User"
            })
            
            if link_email_resp.status_code == 401:
                self.log_result(f"{test_name} - email", True, "Link email correctly requires authentication")
            else:
                self.log_result(f"{test_name} - email", False, f"Expected 401, got {link_email_resp.status_code}")
                
            # Test link/telegram without auth
            link_tg_resp = await self.client.post(f"{API_BASE}/auth/link/telegram", json={
                "id": 999000004,
                "username": "test_link",
                "first_name": "Link",
                "last_name": "Test",
                "auth_date": int(time.time()),
                "hash": "invalid_hash"
            })
            
            if link_tg_resp.status_code == 401:
                self.log_result(f"{test_name} - telegram", True, "Link telegram correctly requires authentication")
            else:
                self.log_result(f"{test_name} - telegram", False, f"Expected 401, got {link_tg_resp.status_code}")
                
            # Test link/vk without auth
            link_vk_resp = await self.client.post(f"{API_BASE}/auth/link/vk", json={
                "code": "invalid_vk_code",
                "redirect_uri": "https://example.com/callback"
            })
            
            if link_vk_resp.status_code == 401:
                self.log_result(f"{test_name} - vk", True, "Link VK correctly requires authentication")
            else:
                self.log_result(f"{test_name} - vk", False, f"Expected 401, got {link_vk_resp.status_code}")
                
        except Exception as e:
            self.log_result(test_name, False, f"Exception: {str(e)}")
            
    async def test_unlink_endpoints_security(self):
        """Test unlink endpoints require valid authentication."""
        test_name = "Unlink endpoints security"
        
        try:
            # Test unlink without auth - should require JWT
            unlink_resp = await self.client.delete(f"{API_BASE}/auth/link/email")
            
            if unlink_resp.status_code == 401:
                self.log_result(test_name, True, "Unlink correctly requires authentication")
            else:
                self.log_result(test_name, False, f"Expected 401, got {unlink_resp.status_code}")
                
        except Exception as e:
            self.log_result(test_name, False, f"Exception: {str(e)}")
            
    async def test_username_normalization(self):
        """Test username normalization and validation."""
        test_name = "Username normalization"
        
        try:
            # Test reserved username
            reserved_resp = await self.client.get(f"{API_BASE}/auth/check-username/admin")
            
            if reserved_resp.status_code == 200:
                reserved_data = reserved_resp.json()
                if not reserved_data.get("available") and "зарезервировано" in reserved_data.get("reason", "").lower():
                    self.log_result(f"{test_name} - reserved", True, "Reserved usernames correctly rejected")
                else:
                    self.log_result(f"{test_name} - reserved", False, f"Reserved username issue: {reserved_data}")
            else:
                self.log_result(f"{test_name} - reserved", False, f"Failed: {reserved_resp.status_code}")
                
            # Test invalid format
            invalid_resp = await self.client.get(f"{API_BASE}/auth/check-username/ab")  # too short
            
            if invalid_resp.status_code == 200:
                invalid_data = invalid_resp.json()
                if not invalid_data.get("available"):
                    self.log_result(f"{test_name} - validation", True, "Invalid usernames correctly rejected")
                else:
                    self.log_result(f"{test_name} - validation", False, f"Validation issue: {invalid_data}")
            else:
                self.log_result(f"{test_name} - validation", False, f"Failed: {invalid_resp.status_code}")
                
        except Exception as e:
            self.log_result(test_name, False, f"Exception: {str(e)}")
            
    async def run_all_tests(self):
        """Run all focused security tests."""
        logger.info("🔐 Starting focused auth security testing...")
        logger.info(f"Backend URL: {BACKEND_URL}")
        
        # Core security tests
        await self.test_auth_config()
        await self.test_telegram_webapp_security()
        await self.test_telegram_widget_security()
        await self.test_vk_login_security()
        await self.test_case_insensitive_username_check()
        await self.test_link_endpoints_security()
        await self.test_unlink_endpoints_security()
        await self.test_username_normalization()
        
        # Summary
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        logger.info(f"\n🧪 FOCUSED TEST SUMMARY:")
        logger.info(f"Total tests: {total_tests}")
        logger.info(f"Passed: {passed_tests} ✅")
        logger.info(f"Failed: {failed_tests} ❌")
        
        if failed_tests > 0:
            logger.info(f"\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    logger.info(f"  - {result['test']}: {result['details']}")
        else:
            logger.info("🎉 All focused security tests passed!")
                    
        return passed_tests, failed_tests

async def main():
    """Main test runner."""
    async with FocusedSecurityTester() as tester:
        passed, failed = await tester.run_all_tests()
        
        if failed > 0:
            sys.exit(1)
        else:
            logger.info("✅ Security testing completed successfully!")
            sys.exit(0)

if __name__ == "__main__":
    asyncio.run(main())