#!/usr/bin/env python3
"""
Schedule Sending Fix Testing Script
Tests the schedule sending fix and z-index changes

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

class ScheduleTester:
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
        
    def run_schedule_tests(self) -> bool:
        """Run schedule sending fix tests from the review request"""
        print("\n=== SCHEDULE SENDING FIX TESTS ===")
        
        # Test 1: POST /api/messages/send-schedule with date: "2025-07-14"
        schedule_test1_data = {
            "sender_id": self.user1_id,
            "receiver_id": self.user2_id,
            "date": "2025-07-14"
        }
        result1 = self.test_request("POST", "/messages/send-schedule", schedule_test1_data, 200, "1. Send Schedule (2025-07-14)")
        if not result1:
            return False
            
        # Verify response has message_type = "schedule"
        if result1.get("message_type") != "schedule":
            self.log(f"  Expected message_type='schedule', got '{result1.get('message_type')}'", False)
            return False
        else:
            self.log("  ✓ message_type = 'schedule'")
            
        # Verify metadata contains ALL required fields
        metadata = result1.get("metadata", {})
        required_fields = ["date", "group_name", "sender_name", "items", "week_number", "day_name"]
        missing_fields = []
        
        for field in required_fields:
            if field not in metadata:
                missing_fields.append(field)
                
        if missing_fields:
            self.log(f"  Missing metadata fields: {missing_fields}", False)
            return False
        else:
            self.log(f"  ✓ All metadata fields present: {list(metadata.keys())}")
            
        # Log all metadata field values for verification
        for field, value in metadata.items():
            self.log(f"  metadata.{field} = {value}")
            
        # Verify items is an array
        if not isinstance(metadata.get("items"), list):
            self.log(f"  Expected items to be array, got {type(metadata.get('items'))}", False)
            return False
        else:
            self.log(f"  ✓ items is array with {len(metadata['items'])} items")
            
        # Verify week_number is a number
        if not isinstance(metadata.get("week_number"), (int, float)):
            self.log(f"  Expected week_number to be number, got {type(metadata.get('week_number'))}", False)
            return False
        else:
            self.log(f"  ✓ week_number is number: {metadata['week_number']}")
            
        # Verify day_name is a string
        if not isinstance(metadata.get("day_name"), str):
            self.log(f"  Expected day_name to be string, got {type(metadata.get('day_name'))}", False)
            return False
        else:
            self.log(f"  ✓ day_name is string: '{metadata['day_name']}'")
            
        # Test 2: POST /api/messages/send-schedule with date: "2025-09-15" (Monday)
        schedule_test2_data = {
            "sender_id": self.user1_id,
            "receiver_id": self.user2_id,
            "date": "2025-09-15"  # Sept 15 2025 is Monday
        }
        result2 = self.test_request("POST", "/messages/send-schedule", schedule_test2_data, 200, "2. Send Schedule (2025-09-15 Monday)")
        if not result2:
            return False
            
        # Verify metadata.day_name = "Понедельник" (Sept 15 2025 is Monday)
        metadata2 = result2.get("metadata", {})
        expected_day_name = "Понедельник"
        actual_day_name = metadata2.get("day_name", "")
        
        if actual_day_name != expected_day_name:
            self.log(f"  Expected day_name='{expected_day_name}', got '{actual_day_name}'", False)
            return False
        else:
            self.log(f"  ✓ day_name = '{actual_day_name}' (correct for Monday)")
            
        # Verify metadata.week_number = 2 (ISO week 38, even = 2)
        expected_week_number = 2  # ISO week 38 is even, so should be 2
        actual_week_number = metadata2.get("week_number")
        
        if actual_week_number != expected_week_number:
            self.log(f"  Expected week_number={expected_week_number}, got {actual_week_number}", False)
            return False
        else:
            self.log(f"  ✓ week_number = {actual_week_number} (correct for ISO week 38)")
            
        # Log all metadata for this test
        for field, value in metadata2.items():
            self.log(f"  metadata.{field} = {value}")
            
        # Test 3: POST /api/messages/send-schedule without date (defaults to today)
        schedule_test3_data = {
            "sender_id": self.user1_id,
            "receiver_id": self.user2_id
        }
        result3 = self.test_request("POST", "/messages/send-schedule", schedule_test3_data, 200, "3. Send Schedule (no date - defaults to today)")
        if not result3:
            return False
            
        # Verify metadata.date is today's date
        metadata3 = result3.get("metadata", {})
        today_date = datetime.utcnow().strftime("%Y-%m-%d")
        actual_date = metadata3.get("date", "")
        
        if actual_date != today_date:
            self.log(f"  Expected date='{today_date}', got '{actual_date}'", False)
            return False
        else:
            self.log(f"  ✓ date = '{actual_date}' (correct for today)")
            
        # Log all metadata for this test
        for field, value in metadata3.items():
            self.log(f"  metadata.{field} = {value}")
            
        # Test 4: POST /api/messages/send with basic text (sanity check)
        basic_msg_data = {
            "sender_id": self.user1_id,
            "receiver_id": self.user2_id,
            "text": "test for z-index"
        }
        result4 = self.test_request("POST", "/messages/send", basic_msg_data, 200, "4. Send Basic Message (Sanity Check)")
        if not result4:
            return False
            
        self.log("  ✓ Basic messaging functionality working")
        
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