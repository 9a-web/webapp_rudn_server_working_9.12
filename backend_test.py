#!/usr/bin/env python3
"""
Backend Test Script for Schedule Sending in Messages
Testing schedule sending endpoints on http://localhost:8001
"""

import asyncio
import aiohttp
import json
from datetime import datetime, timedelta
import sys

# Base URL from the review request
BASE_URL = "http://localhost:8001/api"

class ScheduleTestRunner:
    def __init__(self):
        self.session = None
        self.test_results = []
        self.conversation_id = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test results"""
        status = "✅ PASSED" if success else "❌ FAILED"
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"  Details: {details}")
    
    async def make_request(self, method: str, endpoint: str, data: dict = None, params: dict = None):
        """Make HTTP request and return response"""
        url = f"{BASE_URL}{endpoint}"
        try:
            if method.upper() == "GET":
                async with self.session.get(url, params=params) as resp:
                    return resp.status, await resp.json()
            elif method.upper() == "POST":
                async with self.session.post(url, json=data) as resp:
                    return resp.status, await resp.json()
            elif method.upper() == "PUT":
                async with self.session.put(url, json=data) as resp:
                    return resp.status, await resp.json()
            elif method.upper() == "DELETE":
                async with self.session.delete(url, json=data) as resp:
                    return resp.status, await resp.json()
        except Exception as e:
            return 500, {"error": str(e)}
    
    async def setup_test_users(self):
        """Setup test users 77777 and 88888 with friendship"""
        print("🔧 Setting up test users...")
        
        # User data for 77777
        user1_data = {
            "telegram_id": 77777,
            "username": "testuser1",
            "first_name": "Test1", 
            "last_name": "User1",
            "group_id": "14966",
            "group_name": "ИВБОп-ИВТ-11",
            "facultet_id": "41",
            "level_id": "1",
            "kurs": "1",
            "form_code": "ОФО"
        }
        
        # User data for 88888
        user2_data = {
            "telegram_id": 88888,
            "username": "testuser2", 
            "first_name": "Test2",
            "last_name": "User2",
            "group_id": "14966",
            "group_name": "ИВБОп-ИВТ-11",
            "facultet_id": "41",
            "level_id": "1",
            "kurs": "1",
            "form_code": "ОФО"
        }
        
        # Create/update users
        status1, resp1 = await self.make_request("POST", "/user-settings", user1_data)
        status2, resp2 = await self.make_request("POST", "/user-settings", user2_data)
        
        if status1 == 200 and status2 == 200:
            self.log_test("Setup Users", True, "Users 77777 and 88888 created/updated")
        else:
            self.log_test("Setup Users", False, f"User creation failed: {status1}, {status2}")
            return False
        
        # Check if they are already friends
        status, friends = await self.make_request("GET", "/friends/77777")
        
        friends_exist = False
        if status == 200 and "friends" in friends:
            for friend in friends["friends"]:
                if friend.get("telegram_id") == 88888:
                    friends_exist = True
                    break
        
        if not friends_exist:
            # Send friend request from 77777 to 88888
            status, resp = await self.make_request("POST", "/friends/request/88888", {"telegram_id": 77777})
            
            if status != 200:
                self.log_test("Friend Request", False, f"Friend request failed: {status}")
                return False
            
            # Get friend requests for 88888
            status, requests = await self.make_request("GET", "/friends/88888/requests")
            
            if status != 200 or not requests.get("requests"):
                self.log_test("Get Friend Requests", False, f"Failed to get requests: {status}")
                return False
            
            # Accept the request
            request_id = requests["requests"][0]["id"]
            status, resp = await self.make_request("POST", f"/friends/accept/{request_id}", {"telegram_id": 88888})
            
            if status == 200:
                self.log_test("Establish Friendship", True, "Users are now friends")
            else:
                self.log_test("Establish Friendship", False, f"Accept request failed: {status}")
                return False
        else:
            self.log_test("Establish Friendship", True, "Users were already friends")
        
        return True
    
    async def test_schedule_for_today(self):
        """Test 1: Send schedule for today (date: null)"""
        print("\n📅 Test 1: Send schedule for today")
        
        data = {
            "sender_id": 77777,
            "receiver_id": 88888,
            "date": None  # Should default to today
        }
        
        status, resp = await self.make_request("POST", "/messages/send-schedule", data)
        
        if status != 200:
            self.log_test("Send Schedule Today", False, f"HTTP {status}: {resp}")
            return False
        
        # Validate response structure
        success = True
        details = []
        
        # Check message_type
        if resp.get("message_type") != "schedule":
            success = False
            details.append("message_type is not 'schedule'")
        
        # Check metadata
        metadata = resp.get("metadata", {})
        if not isinstance(metadata.get("items"), list):
            success = False
            details.append("metadata.items is not an array")
        
        # Check date is today
        today = datetime.now().strftime("%Y-%m-%d")
        if metadata.get("date") != today:
            success = False
            details.append(f"metadata.date is not today ({today})")
        
        # Check week_number is 1 (current week)
        if metadata.get("week_number") != 1:
            success = False
            details.append(f"metadata.week_number is not 1 (got {metadata.get('week_number')})")
        
        self.log_test("Send Schedule Today", success, "; ".join(details) if details else "All validations passed")
        
        # Store conversation_id for later tests
        if "conversation_id" in resp:
            self.conversation_id = resp["conversation_id"]
        
        return success
    
    async def test_schedule_for_this_week(self):
        """Test 2: Send schedule for a specific date (this week)"""
        print("\n📅 Test 2: Send schedule for this week")
        
        # Calculate a date from this week (e.g., Monday)
        today = datetime.now()
        days_since_monday = today.weekday()  # Monday is 0
        this_monday = today - timedelta(days=days_since_monday)
        test_date = this_monday.strftime("%Y-%m-%d")
        
        data = {
            "sender_id": 77777,
            "receiver_id": 88888,
            "date": test_date
        }
        
        status, resp = await self.make_request("POST", "/messages/send-schedule", data)
        
        if status != 200:
            self.log_test("Send Schedule This Week", False, f"HTTP {status}: {resp}")
            return False
        
        # Validate response structure
        success = True
        details = []
        
        # Check message_type
        if resp.get("message_type") != "schedule":
            success = False
            details.append("message_type is not 'schedule'")
        
        # Check metadata
        metadata = resp.get("metadata", {})
        if metadata.get("date") != test_date:
            success = False
            details.append(f"metadata.date is not {test_date}")
        
        # Check week_number is 1 (current week)
        if metadata.get("week_number") != 1:
            success = False
            details.append(f"metadata.week_number is not 1 (got {metadata.get('week_number')})")
        
        self.log_test("Send Schedule This Week", success, "; ".join(details) if details else f"Schedule sent for {test_date}")
        return success
    
    async def test_schedule_for_next_week(self):
        """Test 3: Send schedule for next week"""
        print("\n📅 Test 3: Send schedule for next week")
        
        # Calculate a date from next week
        today = datetime.now()
        next_week_date = today + timedelta(days=7)
        test_date = next_week_date.strftime("%Y-%m-%d")
        
        data = {
            "sender_id": 77777,
            "receiver_id": 88888,
            "date": test_date
        }
        
        status, resp = await self.make_request("POST", "/messages/send-schedule", data)
        
        if status != 200:
            self.log_test("Send Schedule Next Week", False, f"HTTP {status}: {resp}")
            return False
        
        # Validate response structure
        success = True
        details = []
        
        # Check message_type
        if resp.get("message_type") != "schedule":
            success = False
            details.append("message_type is not 'schedule'")
        
        # Check metadata
        metadata = resp.get("metadata", {})
        if metadata.get("date") != test_date:
            success = False
            details.append(f"metadata.date is not {test_date}")
        
        # Check week_number is 2 (next week)
        if metadata.get("week_number") != 2:
            success = False
            details.append(f"metadata.week_number is not 2 (got {metadata.get('week_number')})")
        
        self.log_test("Send Schedule Next Week", success, "; ".join(details) if details else f"Schedule sent for {test_date}")
        return success
    
    async def test_conversation_messages(self):
        """Test 4: Verify the message appears in conversation"""
        print("\n💬 Test 4: Verify messages in conversation")
        
        # Get conversations for user 77777
        status, resp = await self.make_request("GET", "/messages/conversations/77777")
        
        if status != 200:
            self.log_test("Get Conversations", False, f"HTTP {status}: {resp}")
            return False
        
        conversations = resp.get("conversations", [])
        if not conversations:
            self.log_test("Get Conversations", False, "No conversations found")
            return False
        
        # Get the first conversation ID
        conversation_id = conversations[0]["id"]
        self.log_test("Get Conversations", True, f"Found conversation: {conversation_id}")
        
        # Get messages in the conversation
        params = {"telegram_id": 77777}
        status, resp = await self.make_request("GET", f"/messages/{conversation_id}/messages", params=params)
        
        if status != 200:
            self.log_test("Get Conversation Messages", False, f"HTTP {status}: {resp}")
            return False
        
        messages = resp.get("messages", [])
        if not messages:
            self.log_test("Get Conversation Messages", False, "No messages found")
            return False
        
        # Check for schedule messages
        schedule_messages = [msg for msg in messages if msg.get("message_type") == "schedule"]
        
        if schedule_messages:
            self.log_test("Verify Schedule Messages", True, f"Found {len(schedule_messages)} schedule messages")
            
            # Validate structure of the first schedule message
            schedule_msg = schedule_messages[0]
            metadata = schedule_msg.get("metadata", {})
            
            required_fields = ["date", "group_name", "sender_name", "items", "week_number", "day_name"]
            missing_fields = [field for field in required_fields if field not in metadata]
            
            if not missing_fields:
                self.log_test("Schedule Message Structure", True, "All required metadata fields present")
            else:
                self.log_test("Schedule Message Structure", False, f"Missing fields: {missing_fields}")
        else:
            self.log_test("Verify Schedule Messages", False, "No schedule messages found in conversation")
            return False
        
        return True
    
    async def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Schedule Sending Tests")
        print("=" * 60)
        
        # Setup
        if not await self.setup_test_users():
            print("❌ Setup failed, aborting tests")
            return
        
        # Run tests
        await self.test_schedule_for_today()
        await self.test_schedule_for_this_week()
        await self.test_schedule_for_next_week()
        await self.test_conversation_messages()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}")
        
        print(f"\nResult: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed! Schedule sending is working correctly.")
        else:
            print("⚠️ Some tests failed. Please check the details above.")
        
        return passed == total

async def main():
    """Main test runner"""
    async with ScheduleTestRunner() as runner:
        success = await runner.run_all_tests()
        sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())