#!/usr/bin/env python3
"""
Backend Testing Suite for Listening Rooms API
Tests the listening rooms endpoints as specified in the review request
"""

import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Backend URL from environment - using production URL for testing
BACKEND_URL = "https://rudn-schedule.ru"
API_BASE = f"{BACKEND_URL}/api"

class BackendTester:
    def __init__(self):
        self.test_results = []
        # Test user data as specified in review request
        self.telegram_id = 765963392
        self.first_name = "Test"
        self.last_name = "User"
        self.username = "testuser"
        self.photo_url = None
        
        # Test room data
        self.test_room_id = None
        self.test_invite_code = None
        self.test_invite_link = None
        
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        if not success and response_data:
            print(f"   Response: {response_data}")
        print()
    
    # ============ Listening Rooms API Tests ============
    
    def test_create_listening_room(self) -> bool:
        """Test POST /api/music/rooms - Create listening room"""
        try:
            print("🧪 Testing: Create Listening Room")
            
            room_data = {
                "telegram_id": self.telegram_id,
                "first_name": self.first_name,
                "last_name": self.last_name,
                "username": self.username,
                "photo_url": self.photo_url,
                "name": "Test Room",
                "control_mode": "everyone"
            }
            
            response = requests.post(f"{API_BASE}/music/rooms", json=room_data, timeout=10)
            
            if response.status_code != 200:
                self.log_test(
                    "Create Listening Room", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate required fields
            required_fields = ["success", "room_id", "invite_code", "invite_link"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test(
                    "Create Listening Room", 
                    False, 
                    f"Missing required fields: {missing_fields}",
                    data
                )
                return False
            
            # Validate success is true
            if not data.get("success"):
                self.log_test(
                    "Create Listening Room", 
                    False, 
                    f"Success field is false: {data}",
                    data
                )
                return False
            
            # Store room data for subsequent tests
            self.test_room_id = data["room_id"]
            self.test_invite_code = data["invite_code"]
            self.test_invite_link = data["invite_link"]
            
            self.log_test(
                "Create Listening Room", 
                True, 
                f"Room created successfully. Room ID: {self.test_room_id}, Invite Code: {self.test_invite_code}",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Create Listening Room", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Create Listening Room", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    
    def test_get_room_info(self) -> bool:
        """Test GET /api/music/rooms/{room_id}?telegram_id={id} - Get room info"""
        if not self.test_room_id:
            self.log_test(
                "Get Room Info", 
                False, 
                "No test room available"
            )
            return False
        
        try:
            print("🧪 Testing: Get Room Info")
            
            response = requests.get(
                f"{API_BASE}/music/rooms/{self.test_room_id}",
                params={"telegram_id": self.telegram_id},
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test(
                    "Get Room Info", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate required fields
            required_fields = ["room"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test(
                    "Get Room Info", 
                    False, 
                    f"Missing required fields: {missing_fields}",
                    data
                )
                return False
            
            room = data["room"]
            
            # Check for new fields: queue, history, state with initiated_by fields
            room_required_fields = ["queue", "history", "state"]
            room_missing_fields = [field for field in room_required_fields if field not in room]
            
            if room_missing_fields:
                self.log_test(
                    "Get Room Info", 
                    False, 
                    f"Missing room fields: {room_missing_fields}",
                    room
                )
                return False
            
            # Check state has initiated_by fields
            state = room["state"]
            state_required_fields = ["initiated_by", "initiated_by_name"]
            state_missing_fields = [field for field in state_required_fields if field not in state]
            
            if state_missing_fields:
                self.log_test(
                    "Get Room Info", 
                    False, 
                    f"Missing state fields: {state_missing_fields}",
                    state
                )
                return False
            
            self.log_test(
                "Get Room Info", 
                True, 
                f"Room info retrieved successfully with all required fields",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Get Room Info", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Get Room Info", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    
    def test_join_room_by_invite_code(self) -> bool:
        """Test POST /api/music/rooms/join/{invite_code} - Join room by invite code"""
        if not self.test_invite_code:
            self.log_test(
                "Join Room by Invite Code", 
                False, 
                "No test invite code available"
            )
            return False
        
        try:
            print("🧪 Testing: Join Room by Invite Code")
            
            join_data = {
                "telegram_id": self.telegram_id,
                "first_name": self.first_name,
                "last_name": self.last_name,
                "username": self.username,
                "photo_url": self.photo_url
            }
            
            response = requests.post(
                f"{API_BASE}/music/rooms/join/{self.test_invite_code}",
                json=join_data,
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test(
                    "Join Room by Invite Code", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate required fields
            required_fields = ["success", "room"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test(
                    "Join Room by Invite Code", 
                    False, 
                    f"Missing required fields: {missing_fields}",
                    data
                )
                return False
            
            # Validate success is true
            if not data.get("success"):
                self.log_test(
                    "Join Room by Invite Code", 
                    False, 
                    f"Success field is false: {data}",
                    data
                )
                return False
            
            self.log_test(
                "Join Room by Invite Code", 
                True, 
                f"Successfully joined room by invite code",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Join Room by Invite Code", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Join Room by Invite Code", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    
    def test_get_room_queue(self) -> bool:
        """Test GET /api/music/rooms/{room_id}/queue?telegram_id={id} - Get queue"""
        if not self.test_room_id:
            self.log_test(
                "Get Room Queue", 
                False, 
                "No test room available"
            )
            return False
        
        try:
            print("🧪 Testing: Get Room Queue")
            
            response = requests.get(
                f"{API_BASE}/music/rooms/{self.test_room_id}/queue",
                params={"telegram_id": self.telegram_id},
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test(
                    "Get Room Queue", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate required fields
            required_fields = ["queue", "count"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test(
                    "Get Room Queue", 
                    False, 
                    f"Missing required fields: {missing_fields}",
                    data
                )
                return False
            
            # Validate queue is array and count is number
            if not isinstance(data["queue"], list):
                self.log_test(
                    "Get Room Queue", 
                    False, 
                    f"Queue should be array, got: {type(data['queue'])}",
                    data
                )
                return False
            
            if not isinstance(data["count"], int):
                self.log_test(
                    "Get Room Queue", 
                    False, 
                    f"Count should be integer, got: {type(data['count'])}",
                    data
                )
                return False
            
            self.log_test(
                "Get Room Queue", 
                True, 
                f"Queue retrieved successfully. Count: {data['count']}",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Get Room Queue", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Get Room Queue", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    
    def test_get_room_history(self) -> bool:
        """Test GET /api/music/rooms/{room_id}/history?telegram_id={id} - Get history"""
        if not self.test_room_id:
            self.log_test(
                "Get Room History", 
                False, 
                "No test room available"
            )
            return False
        
        try:
            print("🧪 Testing: Get Room History")
            
            response = requests.get(
                f"{API_BASE}/music/rooms/{self.test_room_id}/history",
                params={"telegram_id": self.telegram_id},
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test(
                    "Get Room History", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate required fields
            required_fields = ["history", "count"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test(
                    "Get Room History", 
                    False, 
                    f"Missing required fields: {missing_fields}",
                    data
                )
                return False
            
            # Validate history is array and count is number
            if not isinstance(data["history"], list):
                self.log_test(
                    "Get Room History", 
                    False, 
                    f"History should be array, got: {type(data['history'])}",
                    data
                )
                return False
            
            if not isinstance(data["count"], int):
                self.log_test(
                    "Get Room History", 
                    False, 
                    f"Count should be integer, got: {type(data['count'])}",
                    data
                )
                return False
            
            self.log_test(
                "Get Room History", 
                True, 
                f"History retrieved successfully. Count: {data['count']}",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Get Room History", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Get Room History", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    
    def test_get_room_state(self) -> bool:
        """Test GET /api/music/rooms/{room_id}/state - Get room state"""
        if not self.test_room_id:
            self.log_test(
                "Get Room State", 
                False, 
                "No test room available"
            )
            return False
        
        try:
            print("🧪 Testing: Get Room State")
            
            response = requests.get(
                f"{API_BASE}/music/rooms/{self.test_room_id}/state",
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test(
                    "Get Room State", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate required fields including new ones
            required_fields = ["is_playing", "current_track", "position"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test(
                    "Get Room State", 
                    False, 
                    f"Missing required fields: {missing_fields}",
                    data
                )
                return False
            
            # Validate field types
            if not isinstance(data["is_playing"], bool):
                self.log_test(
                    "Get Room State", 
                    False, 
                    f"is_playing should be boolean, got: {type(data['is_playing'])}",
                    data
                )
                return False
            
            if not isinstance(data["position"], (int, float)):
                self.log_test(
                    "Get Room State", 
                    False, 
                    f"position should be number, got: {type(data['position'])}",
                    data
                )
                return False
            
            self.log_test(
                "Get Room State", 
                True, 
                f"Room state retrieved successfully. Playing: {data['is_playing']}, Position: {data['position']}",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Get Room State", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Get Room State", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    
    def test_get_user_rooms(self) -> bool:
        """Test GET /api/music/rooms/user/{telegram_id} - Get user's rooms"""
        try:
            print("🧪 Testing: Get User Rooms")
            
            response = requests.get(
                f"{API_BASE}/music/rooms/user/{self.telegram_id}",
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test(
                    "Get User Rooms", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate required fields
            required_fields = ["rooms"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test(
                    "Get User Rooms", 
                    False, 
                    f"Missing required fields: {missing_fields}",
                    data
                )
                return False
            
            # Validate rooms is array
            if not isinstance(data["rooms"], list):
                self.log_test(
                    "Get User Rooms", 
                    False, 
                    f"Rooms should be array, got: {type(data['rooms'])}",
                    data
                )
                return False
            
            # Check if our test room is in the list
            room_found = False
            if self.test_room_id:
                for room in data["rooms"]:
                    if room.get("id") == self.test_room_id:
                        room_found = True
                        break
            
            self.log_test(
                "Get User Rooms", 
                True, 
                f"User rooms retrieved successfully. Count: {len(data['rooms'])}, Test room found: {room_found}",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Get User Rooms", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Get User Rooms", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    
    def test_leave_room(self) -> bool:
        """Test POST /api/music/rooms/{room_id}/leave?telegram_id={id} - Leave room (cleanup)"""
        if not self.test_room_id:
            self.log_test(
                "Leave Room", 
                False, 
                "No test room available"
            )
            return False
        
        try:
            print("🧪 Testing: Leave Room")
            
            response = requests.post(
                f"{API_BASE}/music/rooms/{self.test_room_id}/leave",
                params={"telegram_id": self.telegram_id},
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test(
                    "Leave Room", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate required fields
            required_fields = ["success"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test(
                    "Leave Room", 
                    False, 
                    f"Missing required fields: {missing_fields}",
                    data
                )
                return False
            
            # Validate success is true
            if not data.get("success"):
                self.log_test(
                    "Leave Room", 
                    False, 
                    f"Success field is false: {data}",
                    data
                )
                return False
            
            self.log_test(
                "Leave Room", 
                True, 
                f"Successfully left room (room closed as host)",
                data
            )
            
            # Clear room data since we left/closed it
            self.test_room_id = None
            self.test_invite_code = None
            self.test_invite_link = None
            
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Leave Room", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Leave Room", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    
    def run_all_tests(self):
        """Run all Journal API tests in sequence"""
        print("🚀 Starting Journal API Testing")
        print("=" * 50)
        
        # Journal API Tests (from review request)
        journal_tests = [
            self.test_create_test_journal,                  # 1. Create test journal
            self.test_leave_journal_as_owner_should_fail,   # 2. POST /api/journals/{journal_id}/leave as owner (should fail with 403)
            self.test_delete_journal_as_owner,              # 3. DELETE /api/journals/{journal_id}?telegram_id=XXX as owner (should succeed)
            self.test_verify_journal_deleted                # 4. Verify journal was deleted
        ]
        
        all_tests = journal_tests
        
        passed = 0
        total = len(all_tests)
        
        for test in all_tests:
            try:
                if test():
                    passed += 1
                time.sleep(0.5)  # Small delay between tests
            except Exception as e:
                print(f"❌ Test failed with exception: {e}")
        
        print("=" * 50)
        print(f"📊 Test Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All Journal API tests PASSED!")
            return True
        else:
            print(f"⚠️  {total - passed} tests FAILED")
            return False
    
    def print_detailed_results(self):
        """Print detailed test results"""
        print("\n📋 Detailed Test Results:")
        print("-" * 50)
        
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}")
            if result["details"]:
                print(f"   {result['details']}")
            print()


def main():
    """Main test execution for Journal API"""
    print("📚 Journal API Testing")
    print(f"Backend URL: {BACKEND_URL}")
    print()
    
    tester = BackendTester()
    
    # Run all tests
    success = tester.run_all_tests()
    
    # Print detailed results
    tester.print_detailed_results()
    
    return success


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)