#!/usr/bin/env python3
"""
Messaging Bug Fixes Testing Script
Tests all 16 messaging API endpoints according to the Backend Test Plan

Usage: python backend_test.py
"""

import requests
import json
import sys
from typing import Optional, Dict, Any
import time
import uuid

# Base URL as specified in the review request
BASE_URL = "http://localhost:8001/api"

class MessageTester:
    def __init__(self):
        self.session = requests.Session()
        self.user1_id = 77777
        self.user2_id = 88888
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
    
    def setup_users(self) -> bool:
        """Setup prerequisite users and friendship"""
        print("\n=== PREREQUISITES SETUP ===")
        
        # Create user 77777
        user1_data = {
            "telegram_id": self.user1_id,
            "username": "bugtest1", 
            "first_name": "BugTest1",
            "group_id": "G1",
            "group_name": "Группа1",
            "facultet_id": "F1", 
            "level_id": "L1",
            "kurs": "1",
            "form_code": "ОФО"
        }
        
        result1 = self.test_request("POST", "/user-settings", user1_data, 200, "Create User 77777")
        if not result1:
            return False
            
        # Create user 88888
        user2_data = {
            "telegram_id": self.user2_id,
            "username": "bugtest2",
            "first_name": "BugTest2", 
            "group_id": "G1",
            "group_name": "Группа1",
            "facultet_id": "F1",
            "level_id": "L1", 
            "kurs": "1",
            "form_code": "ОФО"
        }
        
        result2 = self.test_request("POST", "/user-settings", user2_data, 200, "Create User 88888")
        if not result2:
            return False
            
        # Check if they're already friends
        friends_check = self.test_request("GET", f"/friends/{self.user1_id}", None, 200, "Check Friendship Status")
        if friends_check and friends_check.get("friends"):
            # Check if user2 is in friends list
            is_friend = any(f["telegram_id"] == self.user2_id for f in friends_check["friends"])
            if is_friend:
                self.log("✅ Users are already friends - skipping friend request")
                return True
        
        # Send friend request
        friend_req_data = {"telegram_id": self.user1_id}
        result3 = self.test_request("POST", f"/friends/request/{self.user2_id}", friend_req_data, 200, "Send Friend Request")
        if not result3:
            # Maybe they're already friends, check the error
            return False
            
        # Get friend requests to find request_id
        result4 = self.test_request("GET", f"/friends/{self.user2_id}/requests", None, 200, "Get Friend Requests")
        if not result4 or not result4.get("incoming"):
            self.log("No friend requests found", False)
            return False
            
        self.request_id = result4["incoming"][0]["request_id"]
        self.log(f"Found request_id: {self.request_id}")
        
        # Accept friend request  
        accept_data = {"telegram_id": self.user2_id}
        result5 = self.test_request("POST", f"/friends/accept/{self.request_id}", accept_data, 200, "Accept Friend Request")
        if not result5:
            return False
            
        self.log("✅ Users setup complete - 77777 and 88888 are now friends")
        return True
        
    def run_messaging_tests(self) -> bool:
        """Run all 16 messaging tests from the test plan"""
        print("\n=== MESSAGING TESTS (16 Tests) ===")
        
        # Test 1: Blank text validation (text with only spaces should return 422)
        blank_text_data = {
            "sender_id": self.user1_id,
            "receiver_id": self.user2_id, 
            "text": "   "  # Only spaces
        }
        result1 = self.test_request("POST", "/messages/send", blank_text_data, 422, "1. Blank Text Validation")
        if not result1:
            return False
            
        # Test 2: Send normal message
        normal_msg_data = {
            "sender_id": self.user1_id,
            "receiver_id": self.user2_id,
            "text": "Test message"
        }
        result2 = self.test_request("POST", "/messages/send", normal_msg_data, 200, "2. Send Test Message")
        if not result2:
            return False
        self.message_ids.append(result2.get("id"))
        
        # Get conversation_id from first message
        if not self.conversation_id and result2:
            self.conversation_id = result2.get("conversation_id")
            self.log(f"Got conversation_id: {self.conversation_id}")
            
        # Test 3: Send reply message
        reply_msg_data = {
            "sender_id": self.user2_id,
            "receiver_id": self.user1_id,
            "text": "Reply test"
        }
        result3 = self.test_request("POST", "/messages/send", reply_msg_data, 200, "3. Send Reply Message")
        if not result3:
            return False
        self.message_ids.append(result3.get("message_id"))
        
        if not self.conversation_id:
            self.log("No conversation_id available for subsequent tests", False)
            return False
            
        # Test 4: Get conversation messages
        result4 = self.test_request("GET", f"/messages/{self.conversation_id}/messages?telegram_id={self.user1_id}&limit=50", 
                                   None, 200, "4. Get Conversation Messages")
        if not result4:
            return False
            
        # Test 5: Cursor pagination test  
        if self.message_ids and len(self.message_ids) > 0:
            first_msg_id = self.message_ids[0]
            result5 = self.test_request("GET", f"/messages/{self.conversation_id}/messages?telegram_id={self.user1_id}&before={first_msg_id}&limit=10", 
                                       None, 200, "5. Cursor Pagination Test")
        else:
            self.log("Test 5: No message ID for pagination test", False)
            result5 = None
            
        # Test 6: Search messages (normal query)
        result6 = self.test_request("GET", f"/messages/{self.conversation_id}/search?q=test&telegram_id={self.user1_id}",
                                   None, 200, "6. Search Messages (Normal)")
        if not result6:
            return False
            
        # Test 7: Regex injection test (query with parentheses should NOT crash)
        result7 = self.test_request("GET", f"/messages/{self.conversation_id}/search?q=(test)&telegram_id={self.user1_id}",
                                   None, 200, "7. Regex Injection Test (Parentheses)")
        if not result7:
            return False
            
        # Test 8: Delete message (soft delete)
        if self.message_ids and len(self.message_ids) > 0:
            delete_msg_id = self.message_ids[0]
            delete_data = {"telegram_id": self.user1_id}
            result8 = self.test_request("DELETE", f"/messages/{delete_msg_id}", delete_data, 200, "8. Delete Message (Soft Delete)")
            
            # Test 9: Pin deleted message should return 400
            pin_deleted_data = {"telegram_id": self.user1_id, "is_pinned": True}
            result9 = self.test_request("PUT", f"/messages/{delete_msg_id}/pin", pin_deleted_data, 400, "9. Pin Deleted Message (Should Fail)")
            
        else:
            self.log("Test 8 & 9: No message ID for delete/pin tests", False)
            result8 = result9 = None
            
        # Test 10: Pin normal message
        if self.message_ids and len(self.message_ids) > 1:
            normal_msg_id = self.message_ids[1] 
            pin_normal_data = {"telegram_id": self.user1_id, "is_pinned": True}
            result10 = self.test_request("PUT", f"/messages/{normal_msg_id}/pin", pin_normal_data, 200, "10. Pin Normal Message")
        else:
            self.log("Test 10: No normal message ID for pin test", False) 
            result10 = None
            
        # Test 11: create-task with non-participant should return 403
        if self.message_ids and len(self.message_ids) > 0:
            non_participant_data = {"telegram_id": 99999, "message_id": self.message_ids[0]}
            result11 = self.test_request("POST", "/messages/create-task", non_participant_data, 403, "11. Create Task (Non-Participant)")
        else:
            self.log("Test 11: No message ID for create-task test", False)
            result11 = None
            
        # Test 12: create-task with valid participant  
        if self.message_ids and len(self.message_ids) > 0:
            participant_data = {"telegram_id": self.user1_id, "message_id": self.message_ids[0]}
            result12 = self.test_request("POST", "/messages/create-task", participant_data, 200, "12. Create Task (Valid Participant)")
        else:
            self.log("Test 12: No message ID for create-task test", False)
            result12 = None
            
        # Test 13: Unread count via aggregation
        result13 = self.test_request("GET", f"/messages/unread/{self.user1_id}", None, 200, "13. Unread Count (Aggregation)")
        if not result13:
            return False
            
        # Test 14: Forward message should create in_app_notification
        if self.message_ids and len(self.message_ids) > 0:
            forward_data = {
                "sender_id": self.user1_id,
                "receiver_id": self.user2_id, 
                "original_message_id": self.message_ids[0]
            }
            result14 = self.test_request("POST", "/messages/forward", forward_data, 200, "14. Forward Message")
            if result14:
                # Check in_app_notifications collection (we'll just log that it should be checked)
                self.log("  → Should check in_app_notifications collection for new notification")
        else:
            self.log("Test 14: No message ID for forward test", False)
            result14 = None
            
        # Test 15: Set typing indicator
        typing_data = {"telegram_id": self.user1_id}
        result15 = self.test_request("POST", f"/messages/{self.conversation_id}/typing", typing_data, 200, "15. Set Typing Indicator")
        
        # Test 16: Get typing users
        result16 = self.test_request("GET", f"/messages/{self.conversation_id}/typing?telegram_id={self.user2_id}", 
                                    None, 200, "16. Get Typing Users")
        
        return True
        
    def cleanup(self):
        """Clean up test data"""
        print("\n=== CLEANUP ===")
        
        # Delete test users
        try:
            self.test_request("DELETE", f"/user-settings/{self.user1_id}", None, 200, "Delete User 77777")
            self.test_request("DELETE", f"/user-settings/{self.user2_id}", None, 200, "Delete User 88888") 
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
    print("🧪 MESSAGING BUG FIXES TESTING")
    print("=" * 50)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Users: 77777, 88888")
    
    tester = MessageTester()
    
    try:
        # Setup users and friendship
        if not tester.setup_users():
            print("❌ Prerequisites setup failed!")
            return False
            
        # Run all messaging tests  
        if not tester.run_messaging_tests():
            print("❌ Messaging tests failed!")
            return False
            
        # Print summary
        success = tester.print_summary()
        
        if success:
            print("\n🎉 ALL TESTS PASSED!")
        else:
            print("\n💥 SOME TESTS FAILED!")
            
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