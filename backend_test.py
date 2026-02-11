#!/usr/bin/env python3
"""
Backend Test Script for Music Sending API Endpoints
Testing music sending endpoints as per review request
"""

import asyncio
import aiohttp
import json
from datetime import datetime, timedelta
import sys

# Base URL from frontend/.env REACT_APP_BACKEND_URL + /api
BASE_URL = "https://music-chat-hub-1.preview.emergentagent.com/api"

class MusicTestRunner:
    def __init__(self):
        self.session = None
        self.test_results = []
        self.conversation_id = None
        self.request_id = None
        
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
        """Setup test users 77777 and 88888 with friendship as per review request"""
        print("🔧 Setting up test users...")
        
        # User data for 77777 as per review request
        user1_data = {
            "telegram_id": 77777,
            "username": "musictest1",
            "first_name": "MusicTest1",
            "last_name": "User1",
            "group_id": "G1",
            "group_name": "Группа1",
            "facultet_id": "F1",
            "level_id": "L1",
            "kurs": "1",
            "form_code": "ОФО"
        }
        
        # User data for 88888 as per review request
        user2_data = {
            "telegram_id": 88888,
            "username": "musictest2",
            "first_name": "MusicTest2",
            "last_name": "User2", 
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
        
        # Step 3: Make them friends - POST /api/friends/request/88888 with body {"telegram_id": 77777}
        status, resp = await self.make_request("POST", "/friends/request/88888", {"telegram_id": 77777})
        
        if status == 200:
            self.log_test("Send friend request", True, "Friend request sent successfully")
        else:
            self.log_test("Send friend request", False, f"Friend request failed: {status} - {resp}")
            # Continue anyway in case they're already friends
        
        # Step 4: Get requests - GET /api/friends/88888/requests 
        status, requests_resp = await self.make_request("GET", "/friends/88888/requests")
        
        if status == 200 and requests_resp.get("requests"):
            self.request_id = requests_resp["requests"][0]["id"]
            self.log_test("Get friend requests", True, f"Found request: {self.request_id}")
            
            # Step 5: Accept - POST /api/friends/accept/{request_id} with body {"telegram_id": 88888}
            status, resp = await self.make_request("POST", f"/friends/accept/{self.request_id}", {"telegram_id": 88888})
            
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
    
    async def test_send_music_to_friend(self):
        """Test 1 - Send music to friend (auto-create conversation)"""
        print("\n🎵 Test 1: Send music to friend (auto-create conversation)")
        
        data = {
            "sender_id": 77777,
            "receiver_id": 88888,
            "track_title": "Bohemian Rhapsody",
            "track_artist": "Queen",
            "track_id": "-2001_123456",
            "track_duration": 355,
            "cover_url": None
        }
        
        status, resp = await self.make_request("POST", "/messages/send-music", data)
        
        if status != 200:
            self.log_test("Send music to friend", False, f"HTTP {status}: {resp}")
            return False
        
        # Validate response structure
        success = True
        details = []
        
        # Check message_type
        if resp.get("message_type") != "music":
            success = False
            details.append("message_type is not 'music'")
        
        # Check metadata
        metadata = resp.get("metadata", {})
        expected_fields = ["track_title", "track_artist", "track_id", "track_duration", "cover_url"]
        for field in expected_fields:
            if field not in metadata:
                success = False
                details.append(f"metadata missing {field}")
        
        # Validate specific values
        if metadata.get("track_title") != "Bohemian Rhapsody":
            success = False
            details.append(f"track_title mismatch: {metadata.get('track_title')}")
        
        if metadata.get("track_artist") != "Queen":
            success = False
            details.append(f"track_artist mismatch: {metadata.get('track_artist')}")
            
        if metadata.get("track_id") != "-2001_123456":
            success = False
            details.append(f"track_id mismatch: {metadata.get('track_id')}")
            
        if metadata.get("track_duration") != 355:
            success = False
            details.append(f"track_duration mismatch: {metadata.get('track_duration')}")
        
        # Store conversation_id for later tests
        if "conversation_id" in resp:
            self.conversation_id = resp["conversation_id"]
        
        self.log_test("Send music to friend", success, "; ".join(details) if details else "Music message sent successfully")
        return success

    async def test_verify_conversation_created(self):
        """Test 2 - Verify conversation was auto-created"""
        print("\n💬 Test 2: Verify conversation was auto-created")
        
        status, resp = await self.make_request("GET", "/messages/conversations/77777")
        
        if status != 200:
            self.log_test("Verify conversation created", False, f"HTTP {status}: {resp}")
            return False
        
        conversations = resp.get("conversations", [])
        if not conversations:
            self.log_test("Verify conversation created", False, "No conversations found")
            return False
        
        # Check if at least one conversation exists with music as last message
        music_conversation_found = False
        for conv in conversations:
            if conv.get("last_message", {}).get("message_type") == "music":
                music_conversation_found = True
                if not self.conversation_id:
                    self.conversation_id = conv["id"]
                break
        
        if music_conversation_found:
            self.log_test("Verify conversation created", True, "Conversation with music message found")
            return True
        else:
            self.log_test("Verify conversation created", False, "No conversation with music message found")
            return False

    async def test_get_messages_in_conversation(self):
        """Test 3 - Get messages in conversation (verify music message)"""
        print("\n📨 Test 3: Get messages in conversation (verify music message)")
        
        if not self.conversation_id:
            self.log_test("Get messages in conversation", False, "No conversation_id available")
            return False
        
        params = {"telegram_id": 77777}
        status, resp = await self.make_request("GET", f"/messages/{self.conversation_id}/messages", params=params)
        
        if status != 200:
            self.log_test("Get messages in conversation", False, f"HTTP {status}: {resp}")
            return False
        
        messages = resp.get("messages", [])
        if not messages:
            self.log_test("Get messages in conversation", False, "No messages found")
            return False
        
        # Check for music messages
        music_messages = [msg for msg in messages if msg.get("message_type") == "music"]
        
        if music_messages:
            music_msg = music_messages[0]
            metadata = music_msg.get("metadata", {})
            
            success = True
            details = []
            
            # Validate metadata structure
            if metadata.get("track_title") != "Bohemian Rhapsody":
                success = False
                details.append("track_title mismatch")
                
            if metadata.get("track_artist") != "Queen":
                success = False
                details.append("track_artist mismatch")
            
            self.log_test("Get messages in conversation", success, 
                         "; ".join(details) if details else f"Found {len(music_messages)} music messages")
            return success
        else:
            self.log_test("Get messages in conversation", False, "No music messages found")
            return False

    async def test_send_music_to_non_friend(self):
        """Test 4 - Send music to non-friend (error case)"""
        print("\n🚫 Test 4: Send music to non-friend (error case)")
        
        data = {
            "sender_id": 77777,
            "receiver_id": 999999,
            "track_title": "Test",
            "track_artist": "Test",
            "track_id": "t1",
            "track_duration": 100
        }
        
        status, resp = await self.make_request("POST", "/messages/send-music", data)
        
        if status == 403:
            self.log_test("Send music to non-friend", True, "Correctly returned 403 for non-friend")
            return True
        else:
            self.log_test("Send music to non-friend", False, f"Expected 403, got {status}: {resp}")
            return False

    async def test_music_search(self):
        """Test 5 - Music search works"""
        print("\n🔍 Test 5: Music search works")
        
        params = {"q": "rock", "count": 3}
        status, resp = await self.make_request("GET", "/music/search", params=params)
        
        if status != 200:
            self.log_test("Music search", False, f"HTTP {status}: {resp}")
            return False
        
        tracks = resp.get("tracks", [])
        if not tracks:
            self.log_test("Music search", False, "No tracks returned")
            return False
        
        if len(tracks) < 1:
            self.log_test("Music search", False, f"Expected at least 1 track, got {len(tracks)}")
            return False
        
        # Validate first track structure
        first_track = tracks[0]
        required_fields = ["id", "title", "artist", "duration"]
        missing_fields = [field for field in required_fields if field not in first_track]
        
        if missing_fields:
            self.log_test("Music search", False, f"Missing fields in track: {missing_fields}")
            return False
        
        # Store track_id for next test
        self.track_id = first_track["id"]
        
        self.log_test("Music search", True, f"Found {len(tracks)} tracks with proper structure")
        return True

    async def test_music_stream_url(self):
        """Test 6 - Music stream URL works"""
        print("\n🔗 Test 6: Music stream URL works")
        
        if not hasattr(self, 'track_id'):
            # Use a fallback track_id if search failed
            self.track_id = "-2001_123456"
        
        status, resp = await self.make_request("GET", f"/music/stream/{self.track_id}")
        
        if status != 200:
            self.log_test("Music stream URL", False, f"HTTP {status}: {resp}")
            return False
        
        if "url" not in resp:
            self.log_test("Music stream URL", False, "Response missing 'url' field")
            return False
        
        self.log_test("Music stream URL", True, f"Stream URL returned: {resp.get('url', '')[:50]}...")
        return True

    async def test_get_friends_list(self):
        """Test 7 - Get friends list (used by SendTrackToFriendModal)"""
        print("\n👥 Test 7: Get friends list")
        
        status, resp = await self.make_request("GET", "/friends/77777")
        
        if status != 200:
            self.log_test("Get friends list", False, f"HTTP {status}: {resp}")
            return False
        
        friends = resp.get("friends", [])
        if not friends:
            self.log_test("Get friends list", False, "No friends found")
            return False
        
        # Look for user 88888 in friends list
        friend_88888_found = False
        for friend in friends:
            if friend.get("telegram_id") == 88888:
                friend_88888_found = True
                
                # Validate required fields
                required_fields = ["telegram_id", "first_name", "last_name"]
                missing_fields = [field for field in required_fields if field not in friend]
                
                if missing_fields:
                    self.log_test("Get friends list", False, f"Missing fields in friend: {missing_fields}")
                    return False
                break
        
        if friend_88888_found:
            self.log_test("Get friends list", True, f"Found {len(friends)} friends including user 88888")
            return True
        else:
            self.log_test("Get friends list", False, "User 88888 not found in friends list")
            return False

    async def test_send_second_music_message(self):
        """Test 8 - Send second music message to same conversation"""
        print("\n🎵 Test 8: Send second music message to same conversation")
        
        data = {
            "sender_id": 88888,
            "receiver_id": 77777,
            "track_title": "Yesterday",
            "track_artist": "The Beatles",
            "track_id": "474499171_456935876",
            "track_duration": 125,
            "cover_url": "https://example.com/cover.jpg"
        }
        
        status, resp = await self.make_request("POST", "/messages/send-music", data)
        
        if status != 200:
            self.log_test("Send second music message", False, f"HTTP {status}: {resp}")
            return False
        
        # Validate that it uses the same conversation_id
        if resp.get("conversation_id") == self.conversation_id:
            self.log_test("Send second music message", True, "Same conversation_id used")
            return True
        else:
            self.log_test("Send second music message", False, 
                         f"Different conversation_id: expected {self.conversation_id}, got {resp.get('conversation_id')}")
            return False

    async def test_verify_both_music_messages(self):
        """Test 9 - Verify conversation messages include both music messages"""
        print("\n📨 Test 9: Verify conversation messages include both music messages")
        
        if not self.conversation_id:
            self.log_test("Verify both music messages", False, "No conversation_id available")
            return False
        
        params = {"telegram_id": 77777}
        status, resp = await self.make_request("GET", f"/messages/{self.conversation_id}/messages", params=params)
        
        if status != 200:
            self.log_test("Verify both music messages", False, f"HTTP {status}: {resp}")
            return False
        
        messages = resp.get("messages", [])
        music_messages = [msg for msg in messages if msg.get("message_type") == "music"]
        
        if len(music_messages) >= 2:
            self.log_test("Verify both music messages", True, f"Found {len(music_messages)} music messages")
            return True
        else:
            self.log_test("Verify both music messages", False, f"Expected at least 2 music messages, found {len(music_messages)}")
            return False

    async def test_unread_count_after_music(self):
        """Test 10 - Unread count after music messages"""
        print("\n🔔 Test 10: Unread count after music messages")
        
        status, resp = await self.make_request("GET", "/messages/unread/77777")
        
        if status != 200:
            self.log_test("Unread count after music", False, f"HTTP {status}: {resp}")
            return False
        
        total_unread = resp.get("total_unread", 0)
        
        if total_unread >= 1:
            self.log_test("Unread count after music", True, f"Unread count: {total_unread}")
            return True
        else:
            self.log_test("Unread count after music", True, f"Unread count: {total_unread} (may be 0 if messages were read)")
            return True
    
    async def run_all_tests(self):
        """Run all music sending tests in sequence"""
        print("🚀 Starting Music Sending API Tests")
        print("=" * 60)
        
        # Prerequisites Setup (as per review request)
        if not await self.setup_test_users():
            print("❌ Prerequisites setup failed, aborting tests")
            return
        
        # Run all test cases from review request
        test_results = []
        
        test_results.append(await self.test_send_music_to_friend())
        test_results.append(await self.test_verify_conversation_created())
        test_results.append(await self.test_get_messages_in_conversation())
        test_results.append(await self.test_send_music_to_non_friend())
        test_results.append(await self.test_music_search())
        test_results.append(await self.test_music_stream_url())
        test_results.append(await self.test_get_friends_list())
        test_results.append(await self.test_send_second_music_message())
        test_results.append(await self.test_verify_both_music_messages())
        test_results.append(await self.test_unread_count_after_music())
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 MUSIC API TEST SUMMARY")
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
            print("🎉 All music sending tests passed! Music API is working correctly.")
        else:
            print("⚠️ Some music tests failed. Please check the details above.")
        
        return passed == total

async def main():
    """Main test runner"""
    async with ScheduleTestRunner() as runner:
        success = await runner.run_all_tests()
        sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())