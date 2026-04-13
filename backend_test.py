#!/usr/bin/env python3
"""
Backend Test Suite for RUDN Schedule App
Testing task completion flow with XP info
"""

import asyncio
import aiohttp
import json
import sys
from datetime import datetime
from typing import Dict, Any, Optional

# Backend URL from environment
BACKEND_URL = "http://localhost:8001/api"

class BackendTester:
    def __init__(self):
        self.session = None
        self.test_results = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
        if details:
            print(f"    {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
    
    async def test_task_completion_xp_flow(self):
        """Test the complete task completion flow with XP info"""
        print("🧪 Testing Task Completion Flow with XP Info")
        print("=" * 60)
        
        test_telegram_id = 999999
        task_id = None
        
        try:
            # Step 1: Create a test task
            print("\n📝 Step 1: Creating test task...")
            create_payload = {
                "telegram_id": test_telegram_id,
                "text": "Test task for XP banner"
            }
            
            async with self.session.post(
                f"{BACKEND_URL}/tasks",
                json=create_payload,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    task_data = await response.json()
                    task_id = task_data.get("id")
                    self.log_test(
                        "Create test task", 
                        True, 
                        f"Task created with ID: {task_id}"
                    )
                    
                    # Verify task structure
                    required_fields = ["id", "telegram_id", "text", "completed"]
                    missing_fields = [f for f in required_fields if f not in task_data]
                    if missing_fields:
                        self.log_test(
                            "Task creation response structure",
                            False,
                            f"Missing fields: {missing_fields}"
                        )
                    else:
                        self.log_test("Task creation response structure", True)
                        
                    # Verify initial XP fields are null (not completing)
                    if task_data.get("xp_awarded") is None and task_data.get("xp_info") is None:
                        self.log_test("Initial XP fields are null", True)
                    else:
                        self.log_test(
                            "Initial XP fields are null", 
                            False,
                            f"xp_awarded: {task_data.get('xp_awarded')}, xp_info: {task_data.get('xp_info')}"
                        )
                else:
                    error_text = await response.text()
                    self.log_test(
                        "Create test task", 
                        False, 
                        f"HTTP {response.status}: {error_text}"
                    )
                    return
            
            # Step 2: Test text update (should not award XP)
            print("\n✏️ Step 2: Testing text update (no XP)...")
            update_payload = {
                "text": "Updated test task for XP banner"
            }
            
            async with self.session.put(
                f"{BACKEND_URL}/tasks/{task_id}",
                json=update_payload,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    task_data = await response.json()
                    self.log_test("Update task text", True)
                    
                    # Verify XP fields are still null (not completing)
                    if task_data.get("xp_awarded") is None and task_data.get("xp_info") is None:
                        self.log_test("XP fields remain null on text update", True)
                    else:
                        self.log_test(
                            "XP fields remain null on text update", 
                            False,
                            f"xp_awarded: {task_data.get('xp_awarded')}, xp_info: {task_data.get('xp_info')}"
                        )
                else:
                    error_text = await response.text()
                    self.log_test(
                        "Update task text", 
                        False, 
                        f"HTTP {response.status}: {error_text}"
                    )
            
            # Step 3: Complete the task (should award XP)
            print("\n🎯 Step 3: Completing task (should award XP)...")
            complete_payload = {
                "completed": True
            }
            
            async with self.session.put(
                f"{BACKEND_URL}/tasks/{task_id}",
                json=complete_payload,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    task_data = await response.json()
                    self.log_test("Complete task", True)
                    
                    # Verify task is marked as completed
                    if task_data.get("completed") is True:
                        self.log_test("Task marked as completed", True)
                    else:
                        self.log_test(
                            "Task marked as completed", 
                            False,
                            f"completed: {task_data.get('completed')}"
                        )
                    
                    # Verify XP awarded field
                    xp_awarded = task_data.get("xp_awarded")
                    if xp_awarded is not None and isinstance(xp_awarded, int) and xp_awarded > 0:
                        expected_xp = [5, 8]  # Base task completion XP values
                        if xp_awarded in expected_xp:
                            self.log_test(
                                "XP awarded field", 
                                True, 
                                f"Awarded {xp_awarded} XP"
                            )
                        else:
                            self.log_test(
                                "XP awarded field", 
                                True, 
                                f"Awarded {xp_awarded} XP (different from expected {expected_xp})"
                            )
                    else:
                        self.log_test(
                            "XP awarded field", 
                            False,
                            f"xp_awarded: {xp_awarded} (expected positive integer)"
                        )
                    
                    # Verify XP info structure
                    xp_info = task_data.get("xp_info")
                    if xp_info is not None and isinstance(xp_info, dict):
                        required_xp_fields = [
                            "xp", "level", "tier", "progress", 
                            "xp_current_level", "xp_next_level", 
                            "leveled_up", "old_level", "new_level", 
                            "old_tier", "new_tier"
                        ]
                        missing_xp_fields = [f for f in required_xp_fields if f not in xp_info]
                        
                        if missing_xp_fields:
                            self.log_test(
                                "XP info structure", 
                                False,
                                f"Missing fields: {missing_xp_fields}"
                            )
                        else:
                            self.log_test("XP info structure", True, "All required fields present")
                            
                            # Verify tier value
                            tier = xp_info.get("tier")
                            valid_tiers = ["base", "medium", "rare", "premium"]
                            if tier in valid_tiers:
                                self.log_test("XP info tier value", True, f"tier: {tier}")
                            else:
                                self.log_test(
                                    "XP info tier value", 
                                    False,
                                    f"tier: {tier} (expected one of {valid_tiers})"
                                )
                            
                            # Verify level value
                            level = xp_info.get("level")
                            if isinstance(level, int) and level >= 1:
                                self.log_test("XP info level value", True, f"level: {level}")
                            else:
                                self.log_test(
                                    "XP info level value", 
                                    False,
                                    f"level: {level} (expected integer >= 1)"
                                )
                    else:
                        self.log_test(
                            "XP info structure", 
                            False,
                            f"xp_info: {xp_info} (expected dict)"
                        )
                else:
                    error_text = await response.text()
                    self.log_test(
                        "Complete task", 
                        False, 
                        f"HTTP {response.status}: {error_text}"
                    )
            
            # Step 4: Test uncompleting task (should not award XP)
            print("\n↩️ Step 4: Uncompleting task (no XP)...")
            uncomplete_payload = {
                "completed": False
            }
            
            async with self.session.put(
                f"{BACKEND_URL}/tasks/{task_id}",
                json=uncomplete_payload,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    task_data = await response.json()
                    self.log_test("Uncomplete task", True)
                    
                    # Verify task is marked as not completed
                    if task_data.get("completed") is False:
                        self.log_test("Task marked as not completed", True)
                    else:
                        self.log_test(
                            "Task marked as not completed", 
                            False,
                            f"completed: {task_data.get('completed')}"
                        )
                    
                    # Verify XP fields are null (not completing)
                    if task_data.get("xp_awarded") is None and task_data.get("xp_info") is None:
                        self.log_test("XP fields null on uncomplete", True)
                    else:
                        self.log_test(
                            "XP fields null on uncomplete", 
                            False,
                            f"xp_awarded: {task_data.get('xp_awarded')}, xp_info: {task_data.get('xp_info')}"
                        )
                else:
                    error_text = await response.text()
                    self.log_test(
                        "Uncomplete task", 
                        False, 
                        f"HTTP {response.status}: {error_text}"
                    )
            
            # Step 5: Complete again to test XP consistency
            print("\n🔄 Step 5: Completing task again (XP consistency)...")
            complete_payload = {
                "completed": True
            }
            
            async with self.session.put(
                f"{BACKEND_URL}/tasks/{task_id}",
                json=complete_payload,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    task_data = await response.json()
                    self.log_test("Complete task again", True)
                    
                    # Verify XP is awarded again
                    xp_awarded = task_data.get("xp_awarded")
                    if xp_awarded is not None and isinstance(xp_awarded, int) and xp_awarded > 0:
                        self.log_test("XP awarded on re-completion", True, f"Awarded {xp_awarded} XP")
                    else:
                        self.log_test(
                            "XP awarded on re-completion", 
                            False,
                            f"xp_awarded: {xp_awarded}"
                        )
                else:
                    error_text = await response.text()
                    self.log_test(
                        "Complete task again", 
                        False, 
                        f"HTTP {response.status}: {error_text}"
                    )
            
        except Exception as e:
            self.log_test("Task completion XP flow", False, f"Exception: {str(e)}")
        
        finally:
            # Cleanup: Delete the test task
            if task_id:
                print("\n🧹 Cleanup: Deleting test task...")
                try:
                    async with self.session.delete(f"{BACKEND_URL}/tasks/{task_id}") as response:
                        if response.status == 200:
                            self.log_test("Cleanup test task", True)
                        else:
                            error_text = await response.text()
                            self.log_test(
                                "Cleanup test task", 
                                False, 
                                f"HTTP {response.status}: {error_text}"
                            )
                except Exception as e:
                    self.log_test("Cleanup test task", False, f"Exception: {str(e)}")
    
    async def test_backend_health(self):
        """Test backend health endpoint"""
        print("\n🏥 Testing Backend Health...")
        try:
            async with self.session.get(f"{BACKEND_URL}/health") as response:
                if response.status == 200:
                    health_data = await response.json()
                    self.log_test("Backend health check", True, f"Status: {health_data.get('status')}")
                else:
                    self.log_test("Backend health check", False, f"HTTP {response.status}")
        except Exception as e:
            self.log_test("Backend health check", False, f"Exception: {str(e)}")
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%" if total_tests > 0 else "No tests run")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  • {result['test']}: {result['details']}")
        
        return failed_tests == 0

async def main():
    """Main test runner"""
    print("🚀 Starting Backend Tests for RUDN Schedule App")
    print(f"🔗 Backend URL: {BACKEND_URL}")
    
    async with BackendTester() as tester:
        # Test backend health first
        await tester.test_backend_health()
        
        # Test task completion XP flow
        await tester.test_task_completion_xp_flow()
        
        # Print summary
        success = tester.print_summary()
        
        if success:
            print("\n🎉 All tests passed!")
            sys.exit(0)
        else:
            print("\n💥 Some tests failed!")
            sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())