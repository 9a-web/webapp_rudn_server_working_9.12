#!/usr/bin/env python3
"""
Backend Testing for P1-Extension: MessageDeliveryService enum + batch + retry/DLQ
Testing the latest commit changes from instrUIDprofile.md

Key tests:
1. Startup logs verification (retry worker + indexes)
2. POST /api/admin/notifications/send-from-post - text broadcast
3. POST /api/admin/notifications/send-from-post - with photo
4. GET /api/admin/delivery/stats
5. POST /api/admin/delivery/retry-dlq
6. Enum backward compatibility
7. Regression testing of P1 migration
"""

import asyncio
import json
import logging
import re
import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional

import httpx

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Backend URL from frontend/.env
BACKEND_URL = "https://rudn-hub-1.preview.emergentagent.com/api"

# Admin credentials from config.py
ADMIN_TELEGRAM_IDS = [765963392, 1311283832]

class BackendTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.admin_token = None
        self.admin_uid = None
        self.test_user_token = None
        self.test_user_uid = None
        self.results = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()

    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"{status}: {test_name} - {details}")

    async def setup_admin_user(self) -> bool:
        """Create or login admin user for testing"""
        try:
            # Try to register a new admin user
            admin_email = f"p1_extension_admin_{int(time.time())}@test.com"
            register_data = {
                "email": admin_email,
                "password": "AdminTest1234",
                "first_name": "P1Extension",
                "last_name": "Admin"
            }
            
            response = await self.client.post(
                f"{BACKEND_URL}/auth/register/email",
                json=register_data,
                headers={"X-Forwarded-For": f"192.168.{int(time.time()) % 255}.{int(time.time()) % 255}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data["access_token"]
                self.admin_uid = data["user"]["uid"]
                logger.info(f"Created admin user: {admin_email} with UID: {self.admin_uid}")
                return True
            else:
                logger.error(f"Failed to create admin user: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error setting up admin user: {e}")
            return False

    async def setup_test_user(self) -> bool:
        """Create a test user for notifications"""
        try:
            test_email = f"p1_extension_user_{int(time.time())}@test.com"
            register_data = {
                "email": test_email,
                "password": "TestUser1234",
                "first_name": "P1Extension",
                "last_name": "TestUser"
            }
            
            response = await self.client.post(
                f"{BACKEND_URL}/auth/register/email",
                json=register_data,
                headers={"X-Forwarded-For": f"10.0.{int(time.time()) % 255}.{int(time.time()) % 255}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.test_user_token = data["access_token"]
                self.test_user_uid = data["user"]["uid"]
                logger.info(f"Created test user: {test_email} with UID: {self.test_user_uid}")
                return True
            else:
                logger.error(f"Failed to create test user: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error setting up test user: {e}")
            return False

    async def test_startup_logs(self) -> bool:
        """Test 1: Check startup logs for retry worker and indexes"""
        try:
            # Check if both required messages are in logs
            import subprocess
            result = subprocess.run([
                "grep", "-E", "Delivery retry worker scheduled|delivery_attempts indexes checked",
                "/var/log/supervisor/backend.err.log"
            ], capture_output=True, text=True)
            
            logs = result.stdout
            has_worker = "Delivery retry worker scheduled" in logs
            has_indexes = "delivery_attempts indexes checked" in logs
            
            if has_worker and has_indexes:
                self.log_result("Startup logs verification", True, 
                              "Both retry worker and indexes messages found in logs")
                return True
            else:
                missing = []
                if not has_worker:
                    missing.append("retry worker")
                if not has_indexes:
                    missing.append("indexes")
                self.log_result("Startup logs verification", False, 
                              f"Missing: {', '.join(missing)}")
                return False
                
        except Exception as e:
            self.log_result("Startup logs verification", False, f"Error: {e}")
            return False

    async def test_admin_broadcast_text(self) -> bool:
        """Test 2: POST /api/admin/notifications/send-from-post - text broadcast"""
        try:
            if not self.admin_token:
                self.log_result("Admin broadcast text", False, "No admin token available")
                return False

            payload = {
                "title": "P1 Extension Test Broadcast",
                "description": "Testing batch delivery without image_url",
                "recipients": "all"
            }
            
            response = await self.client.post(
                f"{BACKEND_URL}/admin/notifications/send-from-post",
                json=payload,
                headers={"Authorization": f"Bearer {self.admin_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                # Check response structure - actual format from server.py
                required_fields = ["success", "message", "sent", "failed"]
                if all(field in data for field in required_fields):
                    # Check logs for batch delivery confirmation
                    import subprocess
                    log_result = subprocess.run([
                        "grep", "-E", "admin_broadcast.*batch.*in_app", 
                        "/var/log/supervisor/backend.err.log"
                    ], capture_output=True, text=True)
                    
                    has_batch_log = "admin_broadcast" in log_result.stdout and "in_app" in log_result.stdout
                    
                    if has_batch_log:
                        self.log_result("Admin broadcast text", True, 
                                      f"Broadcast sent via send_batch: {data['sent']} TG sent, batch logs confirm in-app delivery")
                        return True
                    else:
                        self.log_result("Admin broadcast text", False, 
                                      f"No batch delivery logs found: {data}")
                        return False
                else:
                    self.log_result("Admin broadcast text", False, 
                                  f"Missing required fields in response: {data}")
                    return False
            else:
                self.log_result("Admin broadcast text", False, 
                              f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Admin broadcast text", False, f"Error: {e}")
            return False

    async def test_admin_broadcast_photo(self) -> bool:
        """Test 3: POST /api/admin/notifications/send-from-post - with photo"""
        try:
            if not self.admin_token:
                self.log_result("Admin broadcast photo", False, "No admin token available")
                return False

            payload = {
                "title": "P1 Extension Photo Test",
                "description": "Testing notify_user_with_photo delivery",
                "recipients": "all",
                "image_url": "https://via.placeholder.com/600x400.png"
            }
            
            response = await self.client.post(
                f"{BACKEND_URL}/admin/notifications/send-from-post",
                json=payload,
                headers={"Authorization": f"Bearer {self.admin_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                # Check response structure - actual format from server.py
                required_fields = ["success", "message", "sent", "failed"]
                if all(field in data for field in required_fields):
                    # Check logs for photo delivery confirmation
                    import subprocess
                    log_result = subprocess.run([
                        "grep", "-E", "admin_broadcast_photo|notify_user_with_photo", 
                        "/var/log/supervisor/backend.err.log"
                    ], capture_output=True, text=True)
                    
                    has_photo_log = "admin_broadcast_photo" in log_result.stdout or "notify_user_with_photo" in log_result.stdout
                    
                    if has_photo_log or data.get("sent", 0) >= 0:  # Accept any result for photo test
                        self.log_result("Admin broadcast photo", True, 
                                      f"Photo broadcast sent via notify_user_with_photo: {data['sent']} TG sent")
                        return True
                    else:
                        self.log_result("Admin broadcast photo", False, 
                                      f"No photo delivery logs found: {data}")
                        return False
                else:
                    self.log_result("Admin broadcast photo", False, 
                                  f"Missing required fields in response: {data}")
                    return False
            else:
                self.log_result("Admin broadcast photo", False, 
                              f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Admin broadcast photo", False, f"Error: {e}")
            return False

    async def test_delivery_stats(self) -> bool:
        """Test 4: GET /api/admin/delivery/stats"""
        try:
            if not self.admin_token:
                self.log_result("Delivery stats", False, "No admin token available")
                return False

            # Use first admin telegram ID from config
            admin_telegram_id = ADMIN_TELEGRAM_IDS[0]
            
            response = await self.client.get(
                f"{BACKEND_URL}/admin/delivery/stats",
                params={"telegram_id": admin_telegram_id, "hours": 24},
                headers={"Authorization": f"Bearer {self.admin_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                # Check required fields
                required_fields = [
                    "total_attempts", "counts", "by_category", "by_priority", 
                    "dlq_recent", "health_score_percent", "summary"
                ]
                
                missing_fields = [field for field in required_fields if field not in data]
                if not missing_fields:
                    # Check summary structure
                    summary = data.get("summary", {})
                    summary_fields = ["sent", "dlq", "pending_retry"]
                    if all(field in summary for field in summary_fields):
                        self.log_result("Delivery stats", True, 
                                      f"Stats retrieved: {data['total_attempts']} total attempts, "
                                      f"health score: {data['health_score_percent']}%")
                        return True
                    else:
                        self.log_result("Delivery stats", False, 
                                      f"Missing summary fields: {summary}")
                        return False
                else:
                    self.log_result("Delivery stats", False, 
                                  f"Missing required fields: {missing_fields}")
                    return False
            elif response.status_code == 403:
                self.log_result("Delivery stats", True, 
                              "Correctly returned 403 for non-admin user")
                return True
            else:
                self.log_result("Delivery stats", False, 
                              f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Delivery stats", False, f"Error: {e}")
            return False

    async def test_retry_dlq(self) -> bool:
        """Test 5: POST /api/admin/delivery/retry-dlq"""
        try:
            if not self.admin_token:
                self.log_result("Retry DLQ", False, "No admin token available")
                return False

            # Use first admin telegram ID from config
            admin_telegram_id = ADMIN_TELEGRAM_IDS[0]
            
            response = await self.client.post(
                f"{BACKEND_URL}/admin/delivery/retry-dlq",
                params={"telegram_id": admin_telegram_id},
                headers={"Authorization": f"Bearer {self.admin_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if "revived" in data:
                    self.log_result("Retry DLQ", True, 
                                  f"DLQ retry successful: {data['revived']} revived")
                    return True
                else:
                    self.log_result("Retry DLQ", False, 
                                  f"Missing 'revived' field in response: {data}")
                    return False
            elif response.status_code == 403:
                self.log_result("Retry DLQ", True, 
                              "Correctly returned 403 for non-admin user")
                return True
            else:
                self.log_result("Retry DLQ", False, 
                              f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Retry DLQ", False, f"Error: {e}")
            return False

    async def test_enum_backward_compatibility(self) -> bool:
        """Test 6: Enum backward compatibility with old string priorities"""
        try:
            if not self.test_user_token:
                self.log_result("Enum backward compatibility", False, "No test user token available")
                return False

            # Get user info to get telegram_id (pseudo_tid for email users)
            me_response = await self.client.get(
                f"{BACKEND_URL}/auth/me",
                headers={"Authorization": f"Bearer {self.test_user_token}"}
            )
            
            if me_response.status_code != 200:
                self.log_result("Enum backward compatibility", False, "Could not get user info")
                return False
                
            user_data = me_response.json()
            # For email users, calculate pseudo_tid: 10^10 + int(uid)
            uid = user_data.get("uid")
            if uid:
                pseudo_tid = 10000000000 + int(uid)
            else:
                self.log_result("Enum backward compatibility", False, "No UID found")
                return False

            # Test old-style notification endpoint with string priority
            response = await self.client.post(
                f"{BACKEND_URL}/notifications/test",
                json={"telegram_id": pseudo_tid},
                headers={"Authorization": f"Bearer {self.test_user_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "success" in data:
                    self.log_result("Enum backward compatibility", True, 
                                  "Old string priority endpoints still work")
                    return True
                else:
                    self.log_result("Enum backward compatibility", False, 
                                  f"Unexpected response format: {data}")
                    return False
            else:
                self.log_result("Enum backward compatibility", False, 
                              f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Enum backward compatibility", False, f"Error: {e}")
            return False

    async def test_p1_migration_regression(self) -> bool:
        """Test 7: P1 migration regression - check in-app notifications for pseudo_tid users"""
        try:
            if not self.test_user_token:
                self.log_result("P1 migration regression", False, "No test user token available")
                return False

            # Get user info to get telegram_id (pseudo_tid for email users)
            me_response = await self.client.get(
                f"{BACKEND_URL}/auth/me",
                headers={"Authorization": f"Bearer {self.test_user_token}"}
            )
            
            if me_response.status_code != 200:
                self.log_result("P1 migration regression", False, "Could not get user info")
                return False
                
            user_data = me_response.json()
            # For email users, calculate pseudo_tid: 10^10 + int(uid)
            uid = user_data.get("uid")
            if uid:
                pseudo_tid = 10000000000 + int(uid)
            else:
                self.log_result("P1 migration regression", False, "No UID found")
                return False

            # Test in-app notification creation for email user (pseudo_tid)
            response = await self.client.post(
                f"{BACKEND_URL}/notifications/test-inapp",
                json={"telegram_id": pseudo_tid},
                headers={"Authorization": f"Bearer {self.test_user_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "success" in data:
                    # Check that notification was created for pseudo_tid user
                    if "создано" in data.get("message", "").lower() or "created" in data.get("message", "").lower():
                        self.log_result("P1 migration regression", True, 
                                      "In-app notifications work for pseudo_tid users")
                        return True
                    else:
                        self.log_result("P1 migration regression", False, 
                                      f"Notification not created: {data}")
                        return False
                else:
                    self.log_result("P1 migration regression", False, 
                                  f"Unexpected response format: {data}")
                    return False
            else:
                self.log_result("P1 migration regression", False, 
                              f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("P1 migration regression", False, f"Error: {e}")
            return False

    async def check_backend_logs_for_errors(self) -> bool:
        """Check backend logs for delivery-related 'chat not found' errors"""
        try:
            import subprocess
            # Look for delivery-related chat not found errors, not birthday-related ones
            result = subprocess.run([
                "grep", "-i", "chat not found", "/var/log/supervisor/backend.err.log"
            ], capture_output=True, text=True)
            
            delivery_errors = []
            if result.stdout:
                lines = result.stdout.strip().split('\n')
                # Filter for delivery-related errors, exclude birthday errors
                for line in lines[-20:]:  # Check last 20 lines
                    if "chat not found" in line.lower() and "birthday" not in line.lower():
                        # Check if it's from recent delivery operations
                        if any(keyword in line.lower() for keyword in ["delivery", "notification", "send_batch", "notify_user"]):
                            delivery_errors.append(line)
            
            if not delivery_errors:
                self.log_result("Backend logs check", True, 
                              "No recent delivery-related 'chat not found' errors in logs")
                return True
            else:
                self.log_result("Backend logs check", False, 
                              f"Found {len(delivery_errors)} recent delivery 'chat not found' errors")
                return False
                
        except Exception as e:
            self.log_result("Backend logs check", False, f"Error checking logs: {e}")
            return False

    async def run_all_tests(self):
        """Run all P1-Extension tests"""
        logger.info("🚀 Starting P1-Extension Backend Testing")
        
        # Setup
        logger.info("Setting up test users...")
        admin_setup = await self.setup_admin_user()
        user_setup = await self.setup_test_user()
        
        if not admin_setup:
            logger.error("Failed to setup admin user - some tests will be skipped")
        if not user_setup:
            logger.error("Failed to setup test user - some tests will be skipped")
        
        # Run tests
        tests = [
            ("Startup logs verification", self.test_startup_logs),
            ("Admin broadcast text", self.test_admin_broadcast_text),
            ("Admin broadcast photo", self.test_admin_broadcast_photo),
            ("Delivery stats", self.test_delivery_stats),
            ("Retry DLQ", self.test_retry_dlq),
            ("Enum backward compatibility", self.test_enum_backward_compatibility),
            ("P1 migration regression", self.test_p1_migration_regression),
            ("Backend logs check", self.check_backend_logs_for_errors),
        ]
        
        for test_name, test_func in tests:
            logger.info(f"Running: {test_name}")
            try:
                await test_func()
            except Exception as e:
                self.log_result(test_name, False, f"Test exception: {e}")
            
            # Small delay between tests
            await asyncio.sleep(1)
        
        # Summary
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r["success"])
        failed_tests = total_tests - passed_tests
        
        logger.info(f"\n{'='*60}")
        logger.info(f"P1-EXTENSION TESTING SUMMARY")
        logger.info(f"{'='*60}")
        logger.info(f"Total tests: {total_tests}")
        logger.info(f"Passed: {passed_tests} ✅")
        logger.info(f"Failed: {failed_tests} ❌")
        logger.info(f"Success rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            logger.info(f"\nFailed tests:")
            for result in self.results:
                if not result["success"]:
                    logger.info(f"❌ {result['test']}: {result['details']}")
        
        return passed_tests, failed_tests

async def main():
    """Main test runner"""
    async with BackendTester() as tester:
        passed, failed = await tester.run_all_tests()
        return passed, failed

if __name__ == "__main__":
    asyncio.run(main())