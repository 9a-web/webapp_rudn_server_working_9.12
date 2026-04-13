#!/usr/bin/env python3
"""
Backend Testing Script for RUDN Schedule Dev Commands
Tests all dev command endpoints with admin and non-admin access
"""

import asyncio
import aiohttp
import json
import sys
from typing import Dict, Any, List

# Backend URL - using localhost since dev endpoints are internal
BACKEND_URL = "http://localhost:8001/api"

# Admin IDs (allowed)
ADMIN_IDS = [765963392, 1311283832]
# Non-admin ID (should get 403)
NON_ADMIN_ID = 123456

class DevCommandTester:
    def __init__(self):
        self.session = None
        self.test_results = []
        self.total_tests = 0
        self.passed_tests = 0
        self.failed_tests = 0

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    def log_test(self, test_name: str, passed: bool, details: str = ""):
        """Log test result"""
        self.total_tests += 1
        if passed:
            self.passed_tests += 1
            status = "✅ PASS"
        else:
            self.failed_tests += 1
            status = "❌ FAIL"
        
        result = f"{status} - {test_name}"
        if details:
            result += f" | {details}"
        
        print(result)
        self.test_results.append({
            "test": test_name,
            "passed": passed,
            "details": details
        })

    async def make_request(self, method: str, endpoint: str, data: Dict[Any, Any] = None) -> Dict[Any, Any]:
        """Make HTTP request to backend"""
        url = f"{BACKEND_URL}{endpoint}"
        
        try:
            if method.upper() == "GET":
                async with self.session.get(url) as response:
                    return {
                        "status_code": response.status,
                        "data": await response.json() if response.content_type == 'application/json' else await response.text()
                    }
            elif method.upper() == "POST":
                async with self.session.post(url, json=data) as response:
                    return {
                        "status_code": response.status,
                        "data": await response.json() if response.content_type == 'application/json' else await response.text()
                    }
        except Exception as e:
            return {
                "status_code": 0,
                "data": {"error": str(e)}
            }

    async def test_dev_execute_help(self):
        """Test POST /api/dev/execute with help command"""
        print("\n=== Testing POST /api/dev/execute - help command ===")
        
        # Test with admin ID
        data = {"telegram_id": ADMIN_IDS[0], "command": "help", "args": []}
        response = await self.make_request("POST", "/dev/execute", data)
        
        if response["status_code"] == 200 and response["data"].get("status") == "ok":
            commands = response["data"].get("result", {}).get("commands", [])
            self.log_test("Admin help command", len(commands) > 0, f"Returned {len(commands)} commands")
        else:
            self.log_test("Admin help command", False, f"Status: {response['status_code']}, Data: {response['data']}")

        # Test with non-admin ID (should get 403)
        data = {"telegram_id": NON_ADMIN_ID, "command": "help", "args": []}
        response = await self.make_request("POST", "/dev/execute", data)
        
        self.log_test("Non-admin help command (403 expected)", 
                     response["status_code"] == 403, 
                     f"Status: {response['status_code']}")

    async def test_dev_add_xp(self):
        """Test POST /api/dev/add-xp"""
        print("\n=== Testing POST /api/dev/add-xp ===")
        
        # Test with admin ID
        data = {"telegram_id": ADMIN_IDS[0], "amount": 100}
        response = await self.make_request("POST", "/dev/add-xp", data)
        
        if response["status_code"] == 200 and response["data"].get("status") == "ok":
            result_data = response["data"]
            has_xp_info = all(key in result_data for key in ["xp", "level", "tier"])
            self.log_test("Admin add XP", has_xp_info, f"Added 100 XP, got level info")
        else:
            self.log_test("Admin add XP", False, f"Status: {response['status_code']}, Data: {response['data']}")

        # Test with non-admin ID (should get 403)
        data = {"telegram_id": NON_ADMIN_ID, "amount": 100}
        response = await self.make_request("POST", "/dev/add-xp", data)
        
        self.log_test("Non-admin add XP (403 expected)", 
                     response["status_code"] == 403, 
                     f"Status: {response['status_code']}")

    async def test_dev_set_xp(self):
        """Test POST /api/dev/set-xp"""
        print("\n=== Testing POST /api/dev/set-xp ===")
        
        # Test with admin ID
        data = {"telegram_id": ADMIN_IDS[0], "amount": 1000}
        response = await self.make_request("POST", "/dev/set-xp", data)
        
        if response["status_code"] == 200 and response["data"].get("status") == "ok":
            result_data = response["data"]
            has_level_info = all(key in result_data for key in ["level", "tier", "xp"])
            self.log_test("Admin set XP", has_level_info, f"Set XP to 1000, got level info")
        else:
            self.log_test("Admin set XP", False, f"Status: {response['status_code']}, Data: {response['data']}")

        # Test with non-admin ID (should get 403)
        data = {"telegram_id": NON_ADMIN_ID, "amount": 1000}
        response = await self.make_request("POST", "/dev/set-xp", data)
        
        self.log_test("Non-admin set XP (403 expected)", 
                     response["status_code"] == 403, 
                     f"Status: {response['status_code']}")

    async def test_dev_get_level(self):
        """Test GET /api/dev/get-level/{id}"""
        print("\n=== Testing GET /api/dev/get-level/{id} ===")
        
        # Test with admin ID
        response = await self.make_request("GET", f"/dev/get-level/{ADMIN_IDS[0]}")
        
        if response["status_code"] == 200 and response["data"].get("status") == "ok":
            result_data = response["data"]
            has_level_info = all(key in result_data for key in ["level", "tier", "xp", "streak"])
            self.log_test("Admin get level", has_level_info, f"Got level info with streak data")
        else:
            self.log_test("Admin get level", False, f"Status: {response['status_code']}, Data: {response['data']}")

        # Test with non-admin ID (should get 403)
        response = await self.make_request("GET", f"/dev/get-level/{NON_ADMIN_ID}")
        
        self.log_test("Non-admin get level (403 expected)", 
                     response["status_code"] == 403, 
                     f"Status: {response['status_code']}")

    async def test_dev_reset_streak(self):
        """Test POST /api/dev/reset-streak"""
        print("\n=== Testing POST /api/dev/reset-streak ===")
        
        # Test with admin ID
        data = {"telegram_id": ADMIN_IDS[0]}
        response = await self.make_request("POST", "/dev/reset-streak", data)
        
        if response["status_code"] == 200 and response["data"].get("status") == "ok":
            message = response["data"].get("message", "")
            self.log_test("Admin reset streak", "сброшен" in message.lower(), f"Message: {message}")
        else:
            self.log_test("Admin reset streak", False, f"Status: {response['status_code']}, Data: {response['data']}")

        # Test with non-admin ID (should get 403)
        data = {"telegram_id": NON_ADMIN_ID}
        response = await self.make_request("POST", "/dev/reset-streak", data)
        
        self.log_test("Non-admin reset streak (403 expected)", 
                     response["status_code"] == 403, 
                     f"Status: {response['status_code']}")

    async def test_dev_execute_commands(self):
        """Test various commands through POST /api/dev/execute"""
        print("\n=== Testing Various Dev Execute Commands ===")
        
        commands_to_test = [
            {"command": "getlevel", "args": [], "expected_keys": ["level", "tier", "xp", "streak"]},
            {"command": "addxp", "args": [200], "expected_keys": ["xp", "level", "tier"]},
            {"command": "setxp", "args": [5000], "expected_keys": ["level", "tier", "xp"]},
            {"command": "resetstreak", "args": [], "check_message": True},
            {"command": "getuser", "args": [], "allow_null_result": True},
            {"command": "listtasks", "args": [], "expected_keys": ["count"]},
            {"command": "listfriends", "args": [], "expected_keys": ["count"]},
            {"command": "listrequests", "args": [], "expected_keys": ["incoming", "outgoing"]},
            {"command": "recordvisit", "args": [], "check_message": True},
            {"command": "addtask", "args": ["Test Task"], "expected_keys": ["id", "text"]},
        ]
        
        for cmd_test in commands_to_test:
            data = {
                "telegram_id": ADMIN_IDS[0], 
                "command": cmd_test["command"], 
                "args": cmd_test["args"]
            }
            response = await self.make_request("POST", "/dev/execute", data)
            
            if response["status_code"] == 200 and response["data"].get("status") == "ok":
                if cmd_test.get("check_message"):
                    # Check for message field
                    has_message = "message" in response["data"]
                    self.log_test(f"Execute {cmd_test['command']}", has_message, 
                                f"Message: {response['data'].get('message', 'None')}")
                elif cmd_test.get("allow_null_result"):
                    # Allow null result (e.g., getuser for non-existent user)
                    result = response["data"].get("result")
                    self.log_test(f"Execute {cmd_test['command']}", True, 
                                f"Result: {result}")
                else:
                    # Check for expected keys in result
                    result = response["data"].get("result", {})
                    expected_keys = cmd_test.get("expected_keys", [])
                    if result is not None:
                        has_keys = all(key in result for key in expected_keys)
                        self.log_test(f"Execute {cmd_test['command']}", has_keys, 
                                    f"Has keys: {expected_keys}")
                    else:
                        self.log_test(f"Execute {cmd_test['command']}", False, 
                                    f"No result data returned")
            else:
                self.log_test(f"Execute {cmd_test['command']}", False, 
                            f"Status: {response['status_code']}, Data: {response['data']}")

    async def test_dev_execute_invalid_command(self):
        """Test invalid command through POST /api/dev/execute"""
        print("\n=== Testing Invalid Dev Execute Command ===")
        
        data = {"telegram_id": ADMIN_IDS[0], "command": "unknown_cmd", "args": []}
        response = await self.make_request("POST", "/dev/execute", data)
        
        if response["status_code"] == 200 and response["data"].get("status") == "error":
            message = response["data"].get("message", "")
            self.log_test("Invalid command error", "неизвестная команда" in message.lower(), 
                         f"Error message: {message}")
        else:
            self.log_test("Invalid command error", False, 
                         f"Status: {response['status_code']}, Data: {response['data']}")

    async def test_data_modification_verification(self):
        """Verify that commands actually modify data correctly"""
        print("\n=== Testing Data Modification Verification ===")
        
        # 1. Set XP to a known value
        data = {"telegram_id": ADMIN_IDS[0], "amount": 2500}
        response = await self.make_request("POST", "/dev/set-xp", data)
        
        if response["status_code"] == 200:
            # 2. Get level to verify XP was set
            response = await self.make_request("GET", f"/dev/get-level/{ADMIN_IDS[0]}")
            if response["status_code"] == 200:
                xp = response["data"].get("xp", 0)
                self.log_test("XP modification verification", xp == 2500, f"XP set to 2500, got {xp}")
            else:
                self.log_test("XP modification verification", False, "Failed to get level after setting XP")
        else:
            self.log_test("XP modification verification", False, "Failed to set XP")

        # 3. Reset streak and verify
        data = {"telegram_id": ADMIN_IDS[0]}
        response = await self.make_request("POST", "/dev/reset-streak", data)
        
        if response["status_code"] == 200:
            # 4. Get level to verify streak was reset
            response = await self.make_request("GET", f"/dev/get-level/{ADMIN_IDS[0]}")
            if response["status_code"] == 200:
                streak = response["data"].get("streak", -1)
                self.log_test("Streak reset verification", streak == 0, f"Streak reset to 0, got {streak}")
            else:
                self.log_test("Streak reset verification", False, "Failed to get level after resetting streak")
        else:
            self.log_test("Streak reset verification", False, "Failed to reset streak")

    async def run_all_tests(self):
        """Run all dev command tests"""
        print("🚀 Starting RUDN Schedule Dev Commands Backend Testing")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Admin IDs: {ADMIN_IDS}")
        print(f"Non-admin ID: {NON_ADMIN_ID}")
        
        # Run all test methods
        await self.test_dev_execute_help()
        await self.test_dev_add_xp()
        await self.test_dev_set_xp()
        await self.test_dev_get_level()
        await self.test_dev_reset_streak()
        await self.test_dev_execute_commands()
        await self.test_dev_execute_invalid_command()
        await self.test_data_modification_verification()
        
        # Print summary
        print(f"\n{'='*60}")
        print(f"🏁 TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Total Tests: {self.total_tests}")
        print(f"✅ Passed: {self.passed_tests}")
        print(f"❌ Failed: {self.failed_tests}")
        print(f"Success Rate: {(self.passed_tests/self.total_tests*100):.1f}%")
        
        if self.failed_tests > 0:
            print(f"\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["passed"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return self.failed_tests == 0

async def main():
    """Main test runner"""
    async with DevCommandTester() as tester:
        success = await tester.run_all_tests()
        return 0 if success else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)