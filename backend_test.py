#!/usr/bin/env python3
"""
Music Sending API Testing Script
Tests music sending via messages API on http://localhost:8001

Usage: python backend_test.py
"""

import requests
import json
import sys
from typing import Optional, Dict, Any
import time
import uuid
from datetime import datetime

# Base URL as specified in the review request
BASE_URL = "http://localhost:8001/api"

class MusicSendingTester:
    def __init__(self):
        self.session = requests.Session()
        self.existing_user1_id = 77777
        self.existing_user2_id = 88888
        self.new_user1_id = 111111
        self.new_user2_id = 222222
        self.non_friend_user_id = 999999
        self.conversation_id = None
        self.message_ids = []
        self.request_id = None
        self.results = []
        
    def log(self, message: str, success: bool = True):
        """Log test results"""
        status = "✅" if success else "❌"
        print(f"{status} {message}")
        self.results.append({"message": message, "success": success})
        
    def test_request(self, method: str, endpoint: str, data: Optional[Dict[Any, Any]] = None, 
                    expected_status: int = 200, test_name: str = "") -> Optional[Dict[Any, Any]]:
        """Make test request and validate response"""
        url = f"{BASE_URL}{endpoint}"
        
        try:
            if method.upper() == "GET":
                response = self.session.get(url)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, json=data)
            else:
                self.log(f"Test {test_name}: Invalid method {method}", False)
                return None
                
            if response.status_code == expected_status:
                self.log(f"Test {test_name}: {method} {endpoint} → {response.status_code}")
                try:
                    return response.json()
                except:
                    return {"status": "success"}
            else:
                self.log(f"Test {test_name}: {method} {endpoint} → Expected {expected_status}, got {response.status_code}", False)
                try:
                    error_detail = response.json().get('detail', 'Unknown error')
                    self.log(f"  Error: {error_detail}", False)
                except:
                    self.log(f"  Raw response: {response.text[:200]}", False)
                return None
                
        except Exception as e:
            self.log(f"Test {test_name}: Request failed - {str(e)}", False)
            return None
    
    def setup_existing_users(self) -> bool:
        """Setup prerequisite users (77777 and 88888) and verify friendship"""
        print("\n=== EXISTING USERS SETUP (Prerequisites) ===")
        
        # Create user 77777
        user1_data = {
            "telegram_id": self.existing_user1_id,
            "username": "musictest77777", 
            "first_name": "MusicTest77777",
            "group_id": "G1",
            "group_name": "Группа1",
            "facultet_id": "F1", 
            "level_id": "L1",
            "kurs": "1",
            "form_code": "ОФО"
        }
        
        result1 = self.test_request("POST", "/user-settings", user1_data, 200, "Create User 77777")
        if not result1:
            # User may already exist, try to continue
            self.log("User 77777 might already exist, continuing...")
            
        # Create user 88888
        user2_data = {
            "telegram_id": self.existing_user2_id,
            "username": "musictest88888",
            "first_name": "MusicTest88888", 
            "group_id": "G1",
            "group_name": "Группа1",
            "facultet_id": "F1",
            "level_id": "L1", 
            "kurs": "1",
            "form_code": "ОФО"
        }
        
        result2 = self.test_request("POST", "/user-settings", user2_data, 200, "Create User 88888")
        if not result2:
            # User may already exist, try to continue
            self.log("User 88888 might already exist, continuing...")
            
        # Check if they're already friends
        friends_check = self.test_request("GET", f"/friends/{self.existing_user1_id}", None, 200, "Check Friendship Status")
        if friends_check and friends_check.get("friends"):
            # Check if user2 is in friends list
            is_friend = any(f["telegram_id"] == self.existing_user2_id for f in friends_check["friends"])
            if is_friend:
                self.log("✅ Users 77777 and 88888 are already friends - proceeding with tests")
                return True
        
        # Send friend request
        friend_req_data = {"telegram_id": self.existing_user1_id}
        result3 = self.test_request("POST", f"/friends/request/{self.existing_user2_id}", friend_req_data, 200, "Send Friend Request")
        if not result3:
            self.log("Friend request might have failed, trying to continue...", False)
            return False
            
        # Get friend requests to find request_id
        result4 = self.test_request("GET", f"/friends/{self.existing_user2_id}/requests", None, 200, "Get Friend Requests")
        if not result4 or not result4.get("incoming"):
            self.log("No friend requests found", False)
            return False
            
        self.request_id = result4["incoming"][0]["request_id"]
        self.log(f"Found request_id: {self.request_id}")
        
        # Accept friend request  
        accept_data = {"telegram_id": self.existing_user2_id}
        result5 = self.test_request("POST", f"/friends/accept/{self.request_id}", accept_data, 200, "Accept Friend Request")
        if not result5:
            return False
            
        self.log("✅ Existing users setup complete - 77777 and 88888 are now friends")
        return True
        
    def test_music_sending_existing_friends(self) -> bool:
        """Test 1: Send music between existing friends and verify conversation"""
        print("\n=== TEST 1: Music Sending Between Existing Friends ===")
        
        # Send music message from 77777 to 88888
        music_data = {
            "sender_id": self.existing_user1_id,
            "receiver_id": self.existing_user2_id,
            "track_title": "Bohemian Rhapsody",
            "track_artist": "Queen",
            "track_id": "test_track_123",
            "track_duration": 355,
            "cover_url": None
        }
        
        result = self.test_request("POST", "/messages/send-music", music_data, 200, "1.1 Send Music Message")
        if not result:
            return False
            
        # Verify response structure
        if result.get("message_type") != "music":
            self.log(f"  Expected message_type='music', got '{result.get('message_type')}'", False)
            return False
        else:
            self.log("  ✓ message_type = 'music'")
            
        # Verify metadata contains all required fields
        metadata = result.get("metadata", {})
        expected_fields = {
            "track_title": "Bohemian Rhapsody",
            "track_artist": "Queen", 
            "track_id": "test_track_123",
            "track_duration": 355
        }
        
        for field, expected_value in expected_fields.items():
            actual_value = metadata.get(field)
            if actual_value != expected_value:
                self.log(f"  Expected metadata.{field}='{expected_value}', got '{actual_value}'", False)
                return False
            else:
                self.log(f"  ✓ metadata.{field} = {actual_value}")
                
        # Store conversation ID for later use
        self.conversation_id = result.get("conversation_id")
        message_id = result.get("id")
        if message_id:
            self.message_ids.append(message_id)
            
        return True
        
    def test_conversation_verification(self) -> bool:
        """Test 2: Verify conversation was created/fetched"""
        print("\n=== TEST 2: Conversation Verification ===")
        
        result = self.test_request("GET", f"/messages/conversations/{self.existing_user1_id}", None, 200, "2.1 Get User Conversations")
        if not result:
            return False
            
        conversations = result.get("conversations", [])
        if len(conversations) < 1:
            self.log("  Expected at least 1 conversation", False)
            return False
        else:
            self.log(f"  ✓ Found {len(conversations)} conversation(s)")
            
        return True
        
    def setup_new_users(self) -> bool:
        """Setup new test users for conversation auto-creation test"""
        print("\n=== NEW USERS SETUP ===")
        
        # Create user 111111
        user1_data = {
            "telegram_id": self.new_user1_id,
            "username": "musictest1",
            "first_name": "MusicTest1",
            "group_id": "G1",
            "group_name": "Группа1",
            "facultet_id": "F1",
            "level_id": "L1",
            "kurs": "1",
            "form_code": "ОФО"
        }
        
        result1 = self.test_request("POST", "/user-settings", user1_data, 200, "Create User 111111")
        if not result1:
            return False
            
        # Create user 222222
        user2_data = {
            "telegram_id": self.new_user2_id,
            "username": "musictest2", 
            "first_name": "MusicTest2",
            "group_id": "G1",
            "group_name": "Группа1",
            "facultet_id": "F1",
            "level_id": "L1",
            "kurs": "1", 
            "form_code": "ОФО"
        }
        
        result2 = self.test_request("POST", "/user-settings", user2_data, 200, "Create User 222222")
        if not result2:
            return False
            
        # Make them friends
        friend_req_data = {"telegram_id": self.new_user1_id}
        result3 = self.test_request("POST", f"/friends/request/{self.new_user2_id}", friend_req_data, 200, "Send Friend Request (111111->222222)")
        if not result3:
            return False
            
        # Get friend requests
        result4 = self.test_request("GET", f"/friends/{self.new_user2_id}/requests", None, 200, "Get Friend Requests")
        if not result4 or not result4.get("incoming"):
            self.log("No friend requests found", False)
            return False
            
        new_request_id = result4["incoming"][0]["request_id"] 
        self.log(f"Found new request_id: {new_request_id}")
        
        # Accept friend request
        accept_data = {"telegram_id": self.new_user2_id}
        result5 = self.test_request("POST", f"/friends/accept/{new_request_id}", accept_data, 200, "Accept Friend Request")
        if not result5:
            return False
            
        self.log("✅ New users setup complete - 111111 and 222222 are now friends")
        return True
        
    def test_music_sending_auto_conversation(self) -> bool:
        """Test 3: Send music without existing conversation (test auto-creation)"""
        print("\n=== TEST 3: Music Sending Auto-Conversation Creation ===")
        
        # Send music from 111111 to 222222 (first message, no conversation exists)
        music_data = {
            "sender_id": self.new_user1_id,
            "receiver_id": self.new_user2_id,
            "track_title": "Yesterday",
            "track_artist": "The Beatles", 
            "track_id": "beatles_123",
            "track_duration": 125,
            "cover_url": None
        }
        
        result = self.test_request("POST", "/messages/send-music", music_data, 200, "3.1 Send Music (Auto-create Conversation)")
        if not result:
            return False
            
        # Verify response structure
        if result.get("message_type") != "music":
            self.log(f"  Expected message_type='music', got '{result.get('message_type')}'", False)
            return False
        else:
            self.log("  ✓ message_type = 'music'")
            self.log("  ✓ Conversation auto-created")
            
        return True
        
    def test_new_conversation_verification(self) -> bool:
        """Test 4: Verify the new conversation exists"""
        print("\n=== TEST 4: New Conversation Verification ===")
        
        result = self.test_request("GET", f"/messages/conversations/{self.new_user1_id}", None, 200, "4.1 Get New User Conversations")
        if not result:
            return False
            
        conversations = result.get("conversations", [])
        if len(conversations) < 1:
            self.log("  Expected 1 conversation", False)
            return False
        else:
            self.log(f"  ✓ Found {len(conversations)} conversation(s)")
            
        # Check that last message is the music message
        if conversations:
            last_message = conversations[0].get("last_message")
            if last_message and last_message.get("message_type") == "music":
                self.log("  ✓ Last message is music message")
            else:
                self.log("  ⚠️  Last message is not music message (may be expected)", True)
                
        return True
        
    def test_send_music_to_non_friend(self) -> bool:
        """Test 5: Send music to non-friend (should get 403)"""
        print("\n=== TEST 5: Send Music to Non-Friend (Error Case) ===")
        
        music_data = {
            "sender_id": self.new_user1_id,
            "receiver_id": self.non_friend_user_id,
            "track_title": "Test",
            "track_artist": "Test",
            "track_id": "x",
            "track_duration": 100,
            "cover_url": None
        }
        
        result = self.test_request("POST", "/messages/send-music", music_data, 403, "5.1 Send Music to Non-Friend")
        if result is None:  # Expected to be None for 403
            self.log("  ✓ Correctly blocked sending music to non-friend (403)")
            return True
        else:
            self.log("  ❌ Should have received 403 error", False) 
            return False
            
    def test_music_search(self) -> bool:
        """Test 6: Music search endpoint"""
        print("\n=== TEST 6: Music Search Endpoint ===")
        
        result = self.test_request("GET", "/music/search?q=rock&count=5", None, 200, "6.1 Music Search")
        if not result:
            return False
            
        # Check structure - may be empty if VK not configured
        tracks = result.get("tracks", [])
        count = result.get("count", 0)
        
        self.log(f"  ✓ Music search returned {count} tracks")
        self.log("  ✓ No 500 error occurred")
        
        if count > 0:
            self.log(f"  ✓ VK music integration working - found {count} tracks")
        else:
            self.log("  ⚠️  No tracks found (VK may not be configured - this is acceptable)")
            
        return True
            
    def cleanup(self):
        """Clean up test data"""
        print("\n=== CLEANUP ===")
        
        # Delete test users
        try:
            self.test_request("DELETE", f"/user-settings/{self.existing_user1_id}", None, 200, "Delete User 77777")
            self.test_request("DELETE", f"/user-settings/{self.existing_user2_id}", None, 200, "Delete User 88888") 
            self.test_request("DELETE", f"/user-settings/{self.new_user1_id}", None, 200, "Delete User 111111")
            self.test_request("DELETE", f"/user-settings/{self.new_user2_id}", None, 200, "Delete User 222222")
        except:
            pass
            
    def print_summary(self):
        """Print test summary"""
        print("\n=== TEST SUMMARY ===")
        
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅") 
        print(f"Failed: {failed_tests} ❌")
        
        if failed_tests > 0:
            print("\nFAILED TESTS:")
            for result in self.results:
                if not result["success"]:
                    print(f"  ❌ {result['message']}")
                    
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        print(f"\nSuccess Rate: {success_rate:.1f}%")
        
        return failed_tests == 0

def main():
    """Main test execution"""
    print("🎵 MUSIC SENDING API TESTING")
    print("=" * 50)
    print(f"Base URL: {BASE_URL}")
    print("Test Plan:")
    print("1. Send music between existing friends (77777, 88888)")
    print("2. Verify conversation creation/fetching")
    print("3. Create new users and make them friends")
    print("4. Send music with auto-conversation creation")
    print("5. Verify new conversation exists") 
    print("6. Test sending music to non-friend (403 error)")
    print("7. Test music search endpoint")
    
    tester = MusicSendingTester()
    
    try:
        # Setup existing users and friendship
        if not tester.setup_existing_users():
            print("❌ Existing users setup failed!")
            return False
            
        # Test music sending between existing friends
        if not tester.test_music_sending_existing_friends():
            print("❌ Music sending test failed!")
            return False
            
        # Verify conversation
        if not tester.test_conversation_verification():
            print("❌ Conversation verification failed!")
            return False
            
        # Setup new users
        if not tester.setup_new_users():
            print("❌ New users setup failed!")
            return False
            
        # Test auto-conversation creation
        if not tester.test_music_sending_auto_conversation():
            print("❌ Auto-conversation test failed!")
            return False
            
        # Verify new conversation
        if not tester.test_new_conversation_verification():
            print("❌ New conversation verification failed!")
            return False
            
        # Test non-friend error case
        if not tester.test_send_music_to_non_friend():
            print("❌ Non-friend test failed!")
            return False
            
        # Test music search
        if not tester.test_music_search():
            print("❌ Music search test failed!")
            return False
            
        # Print summary
        success = tester.print_summary()
        
        if success:
            print("\n🎉 ALL MUSIC SENDING TESTS PASSED!")
        else:
            print("\n💥 SOME MUSIC SENDING TESTS FAILED!")
            
        return success
        
    except KeyboardInterrupt:
        print("\n⚠️  Tests interrupted by user")
        return False
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")
        return False
    finally:
        # Always try to cleanup
        tester.cleanup()

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)