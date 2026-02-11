#!/usr/bin/env python3
"""
Listen Together E2E Flow Backend Test Script
Testing the complete "Listen Together" API flow as per review request
"""

import asyncio
import aiohttp
import json
from datetime import datetime
import sys

# Base URL from the review request: "ALL on http://localhost:8001"
BASE_URL = "http://localhost:8001/api"

class ListenTogetherTestRunner:
    def __init__(self):
        self.session = None
        self.test_results = []
        self.room_id = None
        self.invite_code = None
        
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
    
    async def setup_prerequisites(self):
        """Setup prerequisites as per review request"""
        print("🔧 Setting up prerequisites...")
        
        # 1. Create user 77777: POST /api/user-settings
        user1_data = {
            "telegram_id": 77777, 
            "username": "listentest1", 
            "first_name": "ListenTest1", 
            "last_name": "User", 
            "group_id": "G1", 
            "group_name": "Группа1", 
            "facultet_id": "F1", 
            "level_id": "L1", 
            "kurs": "1", 
            "form_code": "ОФО"
        }
        
        # 2. Create user 88888: POST /api/user-settings  
        user2_data = {
            "telegram_id": 88888, 
            "username": "listentest2", 
            "first_name": "ListenTest2", 
            "last_name": "User", 
            "group_id": "G1", 
            "group_name": "Группа1", 
            "facultet_id": "F1", 
            "level_id": "L1", 
            "kurs": "1", 
            "form_code": "ОФО"
        }
        
        # Create/update users
        status1, resp1 = await self.make_request("POST", "/user-settings", user1_data)
        status2, resp2 = await self.make_request("POST", "/user-settings", user2_data)
        
        if status1 == 200 and status2 == 200:
            self.log_test("Create users 77777 and 88888", True, "Users created successfully")
        else:
            self.log_test("Create users 77777 and 88888", False, f"User creation failed: {status1}, {status2}")
            return False
        
        # 3. Make them friends: POST /api/friends/request/88888 with {"telegram_id": 77777}
        status, resp = await self.make_request("POST", "/friends/request/88888", {"telegram_id": 77777})
        
        if status == 200:
            self.log_test("Send friend request", True, "Friend request sent successfully")
        elif status == 400 and ("уже отправлен" in resp.get("detail", "") or "уже друзья" in resp.get("detail", "")):
            self.log_test("Send friend request", True, "Users already have friendship connection")
        else:
            self.log_test("Send friend request", False, f"Friend request failed: {status} - {resp}")
        
        # 4. GET /api/friends/88888/requests (find request_id from "incoming" array, field is "request_id")
        status, requests_resp = await self.make_request("GET", "/friends/88888/requests")
        
        if status == 200 and requests_resp.get("incoming"):
            request_id = requests_resp["incoming"][0]["request_id"]
            self.log_test("Get friend requests", True, f"Found request: {request_id}")
            
            # 5. POST /api/friends/accept/{request_id} with {"telegram_id": 88888}
            status, resp = await self.make_request("POST", f"/friends/accept/{request_id}", {"telegram_id": 88888})
            
            if status == 200:
                self.log_test("Accept friend request", True, "Users are now friends")
            else:
                self.log_test("Accept friend request", False, f"Accept failed: {status} - {resp}")
                return False
        else:
            # Check if they're already friends
            status, friends = await self.make_request("GET", "/friends/77777")
            
            friends_exist = False
            if status == 200 and "friends" in friends:
                for friend in friends["friends"]:
                    if friend.get("telegram_id") == 88888:
                        friends_exist = True
                        break
            
            if friends_exist:
                self.log_test("Check existing friendship", True, "Users were already friends")
            else:
                self.log_test("Get friend requests", False, f"No requests found and not friends: {status}")
                return False
        
        return True

    async def test_create_listening_room(self):
        """Test 1: Create listening room"""
        print("\n🎵 Test 1: Create listening room")
        
        # POST /api/music/rooms with body from review request
        data = {
            "telegram_id": 77777, 
            "first_name": "ListenTest1", 
            "last_name": "User", 
            "username": "listentest1", 
            "name": "🎵 Bohemian Rhapsody — совместное", 
            "control_mode": "everyone"
        }
        
        status, resp = await self.make_request("POST", "/music/rooms", data)
        
        if status != 200:
            self.log_test("Create listening room", False, f"HTTP {status}: {resp}")
            return False
        
        # Validate response structure
        success = True
        details = []
        
        # expect 200, success=true, room_id and invite_code in response
        if not resp.get("success"):
            success = False
            details.append("success is not true")
        
        if "room_id" not in resp:
            success = False
            details.append("room_id not in response")
        else:
            self.room_id = resp["room_id"]
        
        if "invite_code" not in resp:
            success = False
            details.append("invite_code not in response")
        else:
            self.invite_code = resp["invite_code"]
        
        self.log_test("Create listening room", success, 
                     "; ".join(details) if details else f"Room created: {self.room_id}, code: {self.invite_code}")
        return success

    async def test_add_track_to_queue(self):
        """Test 2: Add track to room queue"""
        print("\n🎶 Test 2: Add track to room queue")
        
        if not self.room_id:
            self.log_test("Add track to queue", False, "No room_id available")
            return False
        
        # POST /api/music/rooms/{room_id}/queue/add?telegram_id=77777 with body from review request
        data = {
            "id": "track-123", 
            "title": "Bohemian Rhapsody", 
            "artist": "Queen", 
            "duration": 355, 
            "cover": None
        }
        
        params = {"telegram_id": 77777}
        endpoint = f"/music/rooms/{self.room_id}/queue/add"
        status, resp = await self.make_request("POST", endpoint, data, params)
        
        if status != 200:
            self.log_test("Add track to queue", False, f"HTTP {status}: {resp}")
            return False
        
        # expect 200, success=true, queue_length=1
        success = True
        details = []
        
        if not resp.get("success"):
            success = False
            details.append("success is not true")
        
        if resp.get("queue_length") != 1:
            success = False
            details.append(f"queue_length is {resp.get('queue_length')}, expected 1")
        
        self.log_test("Add track to queue", success, 
                     "; ".join(details) if details else f"Track added, queue length: {resp.get('queue_length')}")
        return success

    async def test_join_room_by_invite(self):
        """Test 3: Join room by invite code"""
        print("\n🚪 Test 3: Join room by invite code")
        
        if not self.invite_code:
            self.log_test("Join room by invite", False, "No invite_code available")
            return False
        
        # POST /api/music/rooms/join/{invite_code} with body from review request
        data = {
            "telegram_id": 88888, 
            "first_name": "ListenTest2", 
            "last_name": "User", 
            "username": "listentest2"
        }
        
        endpoint = f"/music/rooms/join/{self.invite_code}"
        status, resp = await self.make_request("POST", endpoint, data)
        
        if status != 200:
            self.log_test("Join room by invite", False, f"HTTP {status}: {resp}")
            return False
        
        # expect 200, success=true, room object with 2 participants and queue containing the track
        success = True
        details = []
        
        if not resp.get("success"):
            success = False
            details.append("success is not true")
        
        room_data = resp.get("room", {})
        if not room_data:
            success = False
            details.append("room data not found in response")
        else:
            participants = room_data.get("participants", [])
            if len(participants) != 2:
                success = False
                details.append(f"Expected 2 participants, got {len(participants)}")
            
            queue = room_data.get("queue", [])
            if len(queue) != 1:
                success = False
                details.append(f"Expected 1 track in queue, got {len(queue)}")
            elif queue[0].get("title") != "Bohemian Rhapsody":
                success = False
                details.append(f"Expected 'Bohemian Rhapsody' in queue, got {queue[0].get('title')}")
        
        self.log_test("Join room by invite", success, 
                     "; ".join(details) if details else f"Successfully joined room with {len(participants)} participants")
        return success

    async def test_send_room_invite_message(self):
        """Test 4: Send room invite message"""
        print("\n💌 Test 4: Send room invite message")
        
        if not self.room_id or not self.invite_code:
            self.log_test("Send room invite message", False, "Missing room_id or invite_code")
            return False
        
        # POST /api/messages/send with body from review request
        data = {
            "sender_id": 77777, 
            "receiver_id": 88888, 
            "text": "🎧 Приглашение: совместное прослушивание\n🎵 Bohemian Rhapsody — Queen", 
            "message_type": "room_invite", 
            "metadata": {
                "room_id": self.room_id, 
                "invite_code": self.invite_code, 
                "track_title": "Bohemian Rhapsody", 
                "track_artist": "Queen", 
                "track_id": "track-123", 
                "track_duration": 355
            }
        }
        
        status, resp = await self.make_request("POST", "/messages/send", data)
        
        if status != 200:
            self.log_test("Send room invite message", False, f"HTTP {status}: {resp}")
            return False
        
        # expect 200, message_type="room_invite", metadata contains invite_code
        success = True
        details = []
        
        if resp.get("message_type") != "room_invite":
            success = False
            details.append(f"message_type is {resp.get('message_type')}, expected 'room_invite'")
        
        metadata = resp.get("metadata", {})
        if "invite_code" not in metadata:
            success = False
            details.append("invite_code not in metadata")
        elif metadata["invite_code"] != self.invite_code:
            success = False
            details.append(f"invite_code mismatch: {metadata['invite_code']} != {self.invite_code}")
        
        self.log_test("Send room invite message", success, 
                     "; ".join(details) if details else "Room invite message sent successfully")
        return success

    async def test_verify_room_invite_in_conversations(self):
        """Test 5: Verify room_invite in conversations"""
        print("\n📬 Test 5: Verify room_invite in conversations")
        
        # GET /api/messages/conversations/88888 → verify at least 1 conversation, check last_message
        status, resp = await self.make_request("GET", "/messages/conversations/88888")
        
        if status != 200:
            self.log_test("Verify room_invite in conversations", False, f"HTTP {status}: {resp}")
            return False
        
        conversations = resp.get("conversations", [])
        if not conversations:
            self.log_test("Verify room_invite in conversations", False, "No conversations found")
            return False
        
        # Look for room_invite message type
        room_invite_found = False
        for conv in conversations:
            last_message = conv.get("last_message", {})
            if last_message.get("message_type") == "room_invite":
                metadata = last_message.get("metadata", {})
                if metadata.get("invite_code") == self.invite_code:
                    room_invite_found = True
                    break
        
        if room_invite_found:
            self.log_test("Verify room_invite in conversations", True, "Room invite found in conversations")
            return True
        else:
            # Try to get messages from conversation to double-check
            if conversations:
                conv_id = conversations[0]["id"]
                status, messages_resp = await self.make_request("GET", f"/messages/{conv_id}/messages", {"telegram_id": 88888})
                
                if status == 200:
                    messages = messages_resp.get("messages", [])
                    room_invite_messages = [msg for msg in messages if msg.get("message_type") == "room_invite"]
                    
                    if room_invite_messages:
                        self.log_test("Verify room_invite in conversations", True, f"Found {len(room_invite_messages)} room_invite messages")
                        return True
            
            self.log_test("Verify room_invite in conversations", False, "No room_invite message found")
            return False

    async def test_join_with_invalid_code(self):
        """Test 6: Join with invalid code"""
        print("\n🚫 Test 6: Join with invalid code")
        
        # POST /api/music/rooms/join/INVALIDCODE with body from review request
        data = {
            "telegram_id": 88888, 
            "first_name": "Test", 
            "last_name": "User", 
            "username": "test"
        }
        
        endpoint = "/music/rooms/join/INVALIDCODE"
        status, resp = await self.make_request("POST", endpoint, data)
        
        # expect success=false
        if status == 200 and not resp.get("success"):
            self.log_test("Join with invalid code", True, "Correctly returned success=false for invalid code")
            return True
        elif status == 404:
            self.log_test("Join with invalid code", True, "Correctly returned 404 for invalid code")
            return True
        else:
            self.log_test("Join with invalid code", False, f"Expected success=false or 404, got {status}: {resp}")
            return False

    async def test_get_room_info(self):
        """Test 7: Get room info"""
        print("\n📋 Test 7: Get room info")
        
        if not self.room_id:
            self.log_test("Get room info", False, "No room_id available")
            return False
        
        # GET /api/music/rooms/{room_id}?telegram_id=77777 → expect room with 2 participants, queue with 1 track
        params = {"telegram_id": 77777}
        endpoint = f"/music/rooms/{self.room_id}"
        status, resp = await self.make_request("GET", endpoint, params=params)
        
        if status != 200:
            self.log_test("Get room info", False, f"HTTP {status}: {resp}")
            return False
        
        success = True
        details = []
        
        # Validate room structure
        participants = resp.get("participants", [])
        if len(participants) != 2:
            success = False
            details.append(f"Expected 2 participants, got {len(participants)}")
        
        queue = resp.get("queue", [])
        if len(queue) != 1:
            success = False
            details.append(f"Expected 1 track in queue, got {len(queue)}")
        
        self.log_test("Get room info", success, 
                     "; ".join(details) if details else f"Room has {len(participants)} participants and {len(queue)} tracks")
        return success
    
    async def run_all_tests(self):
        """Run all Listen Together E2E flow tests"""
        print("🚀 Starting Listen Together E2E Flow Tests")
        print("=" * 60)
        
        # Prerequisites Setup
        if not await self.setup_prerequisites():
            print("❌ Prerequisites setup failed, aborting tests")
            return
        
        # Run all test cases from review request
        test_results = []
        
        test_results.append(await self.test_create_listening_room())
        test_results.append(await self.test_add_track_to_queue())
        test_results.append(await self.test_join_room_by_invite())
        test_results.append(await self.test_send_room_invite_message())
        test_results.append(await self.test_verify_room_invite_in_conversations())
        test_results.append(await self.test_join_with_invalid_code())
        test_results.append(await self.test_get_room_info())
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 LISTEN TOGETHER E2E TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}")
            if result["details"] and not result["success"]:
                print(f"    ↳ {result['details']}")
        
        print(f"\nResult: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All Listen Together E2E tests passed! API flow is working correctly.")
        else:
            print("⚠️ Some Listen Together tests failed. Please check the details above.")
        
        return passed == total

async def main():
    """Main test runner"""
    async with ListenTogetherTestRunner() as runner:
        success = await runner.run_all_tests()
        sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())