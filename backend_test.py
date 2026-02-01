#!/usr/bin/env python3
"""
Backend Testing Suite for Listening Rooms API (Совместное прослушивание музыки)
Tests the music listening rooms functionality as specified in the review request
"""

import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Backend URL from environment - using localhost for testing in container environment
BACKEND_URL = "http://localhost:8001"
API_BASE = f"{BACKEND_URL}/api"

class BackendTester:
    def __init__(self):
        self.room_id: Optional[str] = None
        self.invite_code: Optional[str] = None
        self.test_results = []
        self.host_telegram_id = 765963392  # Host user ID from review request
        self.friend_telegram_id = 123456789  # Friend user ID from review request
        
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
        """Test POST /api/music/rooms - создание комнаты совместного прослушивания"""
        try:
            print("🧪 Testing: Create Listening Room")
            
            # Test data from review request
            room_data = {
                "telegram_id": self.host_telegram_id,
                "first_name": "Test",
                "username": "test_user",
                "name": "Тестовая комната",
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
            
            # Validate success is True
            if not data.get("success"):
                self.log_test(
                    "Create Listening Room", 
                    False, 
                    f"Room creation failed. Response: {data}",
                    data
                )
                return False
            
            # Store room data for subsequent tests
            self.room_id = data["room_id"]
            self.invite_code = data["invite_code"]
            
            self.log_test(
                "Create Listening Room", 
                True, 
                f"Room created successfully. ID: {self.room_id[:8]}..., Code: {self.invite_code}",
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
    
    def test_join_room_by_code(self) -> bool:
        """Test POST /api/music/rooms/join/{invite_code} - присоединение по коду"""
        if not self.invite_code:
            self.log_test(
                "Join Room by Code", 
                False, 
                "No invite code available from previous test"
            )
            return False
        
        try:
            print("🧪 Testing: Join Room by Code")
            
            # Test data from review request
            join_data = {
                "telegram_id": self.friend_telegram_id,
                "first_name": "Friend",
                "username": "friend_user"
            }
            
            response = requests.post(
                f"{API_BASE}/music/rooms/join/{self.invite_code}",
                json=join_data,
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test(
                    "Join Room by Code", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate success response
            if not data.get("success"):
                self.log_test(
                    "Join Room by Code", 
                    False, 
                    f"Join failed. Response: {data}",
                    data
                )
                return False
            
            # Validate room data is present
            if "room" not in data:
                self.log_test(
                    "Join Room by Code", 
                    False, 
                    f"Room data missing from response",
                    data
                )
                return False
            
            room = data["room"]
            
            # Validate participants
            if "participants" not in room:
                self.log_test(
                    "Join Room by Code", 
                    False, 
                    f"Participants data missing from room",
                    room
                )
                return False
            
            # Should have 2 participants now (host + friend)
            participants = room["participants"]
            if len(participants) < 2:
                self.log_test(
                    "Join Room by Code", 
                    False, 
                    f"Expected at least 2 participants, got {len(participants)}",
                    participants
                )
                return False
            
            # Check if friend is in participants
            friend_found = any(p.get("telegram_id") == self.friend_telegram_id for p in participants)
            if not friend_found:
                self.log_test(
                    "Join Room by Code", 
                    False, 
                    f"Friend (ID: {self.friend_telegram_id}) not found in participants",
                    participants
                )
                return False
            
            self.log_test(
                "Join Room by Code", 
                True, 
                f"Friend successfully joined room. Participants: {len(participants)}",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Join Room by Code", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Join Room by Code", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    def test_get_room_info(self) -> bool:
        """Test GET /api/music/rooms/{room_id}?telegram_id={telegram_id} - получение информации о комнате"""
        if not self.room_id:
            self.log_test(
                "Get Room Info", 
                False, 
                "No room ID available from previous test"
            )
            return False
        
        try:
            print("🧪 Testing: Get Room Info")
            
            response = requests.get(
                f"{API_BASE}/music/rooms/{self.room_id}?telegram_id={self.host_telegram_id}",
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
            required_fields = ["room", "is_host", "can_control"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test(
                    "Get Room Info", 
                    False, 
                    f"Missing required fields: {missing_fields}",
                    data
                )
                return False
            
            # Validate is_host is True for host user
            if not data.get("is_host"):
                self.log_test(
                    "Get Room Info", 
                    False, 
                    f"Expected is_host=true for host user, got {data.get('is_host')}",
                    data
                )
                return False
            
            # Validate can_control is True (control_mode is "everyone")
            if not data.get("can_control"):
                self.log_test(
                    "Get Room Info", 
                    False, 
                    f"Expected can_control=true for everyone control mode, got {data.get('can_control')}",
                    data
                )
                return False
            
            room = data["room"]
            
            # Validate room data
            if room.get("id") != self.room_id:
                self.log_test(
                    "Get Room Info", 
                    False, 
                    f"Room ID mismatch. Expected: {self.room_id}, got: {room.get('id')}",
                    room
                )
                return False
            
            self.log_test(
                "Get Room Info", 
                True, 
                f"Room info retrieved successfully. Host: {data['is_host']}, Can control: {data['can_control']}",
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
    
    def test_get_user_rooms(self) -> bool:
        """Test GET /api/music/rooms/user/{telegram_id} - получение комнат пользователя"""
        try:
            print("🧪 Testing: Get User Rooms")
            
            response = requests.get(f"{API_BASE}/music/rooms/user/{self.host_telegram_id}", timeout=10)
            
            if response.status_code != 200:
                self.log_test(
                    "Get User Rooms", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate response structure
            required_fields = ["rooms", "count"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test(
                    "Get User Rooms", 
                    False, 
                    f"Missing required fields: {missing_fields}",
                    data
                )
                return False
            
            rooms = data["rooms"]
            count = data["count"]
            
            # Should have at least one room (our test room)
            if count == 0 or len(rooms) == 0:
                self.log_test(
                    "Get User Rooms", 
                    False, 
                    f"No rooms found for user {self.host_telegram_id}. Expected at least 1 room.",
                    data
                )
                return False
            
            # Find our test room
            test_room = None
            for room in rooms:
                if room.get("id") == self.room_id:
                    test_room = room
                    break
            
            if not test_room:
                self.log_test(
                    "Get User Rooms", 
                    False, 
                    f"Test room {self.room_id[:8]}... not found in user's rooms list",
                    data
                )
                return False
            
            # Validate test room data
            if not test_room.get("is_host"):
                self.log_test(
                    "Get User Rooms", 
                    False, 
                    f"Expected is_host=true for test room, got {test_room.get('is_host')}",
                    test_room
                )
                return False
            
            self.log_test(
                "Get User Rooms", 
                True, 
                f"Found {count} rooms for user. Test room present with is_host=true",
                {"total_rooms": count, "test_room_found": True}
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
    
    def test_leave_room_non_host(self) -> bool:
        """Test POST /api/music/rooms/{room_id}/leave?telegram_id={telegram_id} - выход из комнаты (не хост)"""
        if not self.room_id:
            self.log_test(
                "Leave Room (Non-Host)", 
                False, 
                "No room ID available from previous test"
            )
            return False
        
        try:
            print("🧪 Testing: Leave Room (Non-Host)")
            
            response = requests.post(
                f"{API_BASE}/music/rooms/{self.room_id}/leave?telegram_id={self.friend_telegram_id}",
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test(
                    "Leave Room (Non-Host)", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate success response
            if not data.get("success"):
                self.log_test(
                    "Leave Room (Non-Host)", 
                    False, 
                    f"Leave failed. Response: {data}",
                    data
                )
                return False
            
            self.log_test(
                "Leave Room (Non-Host)", 
                True, 
                f"Friend successfully left room. Message: {data.get('message', 'N/A')}",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Leave Room (Non-Host)", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Leave Room (Non-Host)", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    def test_delete_room_host(self) -> bool:
        """Test DELETE /api/music/rooms/{room_id}?telegram_id={telegram_id} - удаление комнаты (хост)"""
        if not self.room_id:
            self.log_test(
                "Delete Room (Host)", 
                False, 
                "No room ID available from previous test"
            )
            return False
        
        try:
            print("🧪 Testing: Delete Room (Host)")
            
            response = requests.delete(
                f"{API_BASE}/music/rooms/{self.room_id}?telegram_id={self.host_telegram_id}",
                timeout=10
            )
            
            if response.status_code != 200:
                self.log_test(
                    "Delete Room (Host)", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    response.text
                )
                return False
            
            data = response.json()
            
            # Validate success response
            if not data.get("success"):
                self.log_test(
                    "Delete Room (Host)", 
                    False, 
                    f"Delete failed. Response: {data}",
                    data
                )
                return False
            
            self.log_test(
                "Delete Room (Host)", 
                True, 
                f"Room successfully deleted by host. Message: {data.get('message', 'N/A')}",
                data
            )
            return True
            
        except requests.exceptions.RequestException as e:
            self.log_test(
                "Delete Room (Host)", 
                False, 
                f"Network error: {str(e)}"
            )
            return False
        except Exception as e:
            self.log_test(
                "Delete Room (Host)", 
                False, 
                f"Unexpected error: {str(e)}"
            )
            return False
    
    
    def run_all_tests(self):
        """Run all Listening Rooms API tests in sequence"""
        print("🚀 Starting Listening Rooms API Testing")
        print("=" * 50)
        
        # Listening Rooms API Tests (from review request scenarios)
        listening_rooms_tests = [
            self.test_create_listening_room,        # 1. Create room
            self.test_join_room_by_code,           # 2. Join by code
            self.test_get_room_info,               # 3. Get room info
            self.test_get_user_rooms,              # 4. Get user rooms
            self.test_leave_room_non_host,         # 5. Leave room (non-host)
            self.test_delete_room_host             # 6. Delete room (host)
        ]
        
        all_tests = listening_rooms_tests
        
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
            print("🎉 All Listening Rooms API tests PASSED!")
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
    """Main test execution for Listening Rooms API"""
    print("🎵 Listening Rooms API Testing")
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