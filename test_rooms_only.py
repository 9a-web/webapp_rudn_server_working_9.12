#!/usr/bin/env python3
"""
Test only the Rooms API endpoints
"""

import requests
import json
import sys
from typing import Dict, List, Optional

# Configuration
BACKEND_URL = "https://class-progress-1.preview.emergentagent.com/api"
TIMEOUT = 30

class RoomsAPITester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.session.timeout = TIMEOUT
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, message: str, details: Optional[Dict] = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details or {}
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details:
            print(f"   Details: {json.dumps(details, indent=2, ensure_ascii=False)}")
        print()

    def test_rooms_api_comprehensive(self) -> bool:
        """Test Rooms API endpoints as requested in review"""
        try:
            print("🔍 Testing Rooms API - Create, Invite Link, Join by Token...")
            
            # Test data from review request
            test_telegram_id = 123456789
            test_username = "test_user"
            test_first_name = "Test"
            
            # Step 1: Create a room (POST /api/rooms)
            print("📝 Step 1: Creating room...")
            room_payload = {
                "name": "Test Room for API Testing",
                "description": "Room created for testing invite functionality",
                "telegram_id": test_telegram_id,
                "color": "blue"
            }
            
            create_response = self.session.post(
                f"{self.base_url}/rooms",
                json=room_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if create_response.status_code != 200:
                self.log_test("POST /api/rooms - Create Room", False, 
                            f"HTTP {create_response.status_code}: {create_response.text}")
                return False
            
            room_data = create_response.json()
            
            # Validate room creation response
            required_fields = ['room_id', 'name', 'description', 'owner_id', 'participants', 'invite_token']
            for field in required_fields:
                if field not in room_data:
                    self.log_test("POST /api/rooms - Create Room", False, 
                                f"Missing required field: {field}")
                    return False
            
            # Validate owner is in participants
            if not room_data['participants'] or room_data['participants'][0]['telegram_id'] != test_telegram_id:
                self.log_test("POST /api/rooms - Create Room", False, 
                            "Owner not properly added to participants")
                return False
            
            room_id = room_data['room_id']
            invite_token = room_data['invite_token']
            
            self.log_test("POST /api/rooms - Create Room", True, 
                        "Successfully created room",
                        {
                            "room_id": room_id,
                            "name": room_data['name'],
                            "owner_id": room_data['owner_id'],
                            "participants_count": len(room_data['participants']),
                            "invite_token": invite_token
                        })
            
            # Step 2: Generate invite link (POST /api/rooms/{room_id}/invite-link)
            print("🔗 Step 2: Generating invite link...")
            invite_link_payload = {
                "telegram_id": test_telegram_id
            }
            
            invite_link_response = self.session.post(
                f"{self.base_url}/rooms/{room_id}/invite-link",
                json=invite_link_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if invite_link_response.status_code != 200:
                self.log_test("POST /api/rooms/{room_id}/invite-link - Generate Link", False, 
                            f"HTTP {invite_link_response.status_code}: {invite_link_response.text}")
                return False
            
            invite_link_data = invite_link_response.json()
            
            # Validate invite link response
            required_fields = ['invite_link', 'invite_token', 'room_id', 'bot_username']
            for field in required_fields:
                if field not in invite_link_data:
                    self.log_test("POST /api/rooms/{room_id}/invite-link - Generate Link", False, 
                                f"Missing required field: {field}")
                    return False
            
            # Validate invite link format: https://t.me/{bot}/app?startapp=room_*_ref_*
            invite_link = invite_link_data['invite_link']
            expected_pattern = f"https://t.me/{invite_link_data['bot_username']}/app?startapp=room_{invite_token}_ref_{test_telegram_id}"
            
            if invite_link != expected_pattern:
                self.log_test("POST /api/rooms/{room_id}/invite-link - Generate Link", False, 
                            f"Invite link format incorrect. Expected: {expected_pattern}, Got: {invite_link}")
                return False
            
            self.log_test("POST /api/rooms/{room_id}/invite-link - Generate Link", True, 
                        "Successfully generated invite link with correct format",
                        {
                            "invite_link": invite_link,
                            "bot_username": invite_link_data['bot_username'],
                            "room_id": invite_link_data['room_id'],
                            "invite_token": invite_link_data['invite_token']
                        })
            
            # Step 3: Join room by token (POST /api/rooms/join/{invite_token})
            print("👥 Step 3: Joining room by token...")
            
            # Use different user to join
            join_telegram_id = 987654321
            join_username = "joining_user"
            join_first_name = "Joining"
            
            join_payload = {
                "telegram_id": join_telegram_id,
                "username": join_username,
                "first_name": join_first_name,
                "referral_code": f"ref_{test_telegram_id}"
            }
            
            join_response = self.session.post(
                f"{self.base_url}/rooms/join/{invite_token}",
                json=join_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if join_response.status_code != 200:
                self.log_test("POST /api/rooms/join/{invite_token} - Join Room", False, 
                            f"HTTP {join_response.status_code}: {join_response.text}")
                return False
            
            joined_room_data = join_response.json()
            
            # Validate join response
            required_fields = ['room_id', 'name', 'participants', 'total_participants']
            for field in required_fields:
                if field not in joined_room_data:
                    self.log_test("POST /api/rooms/join/{invite_token} - Join Room", False, 
                                f"Missing required field: {field}")
                    return False
            
            # Validate that new user was added to participants
            if len(joined_room_data['participants']) != 2:
                self.log_test("POST /api/rooms/join/{invite_token} - Join Room", False, 
                            f"Expected 2 participants after join, got {len(joined_room_data['participants'])}")
                return False
            
            # Find the new participant
            new_participant = None
            for participant in joined_room_data['participants']:
                if participant['telegram_id'] == join_telegram_id:
                    new_participant = participant
                    break
            
            if not new_participant:
                self.log_test("POST /api/rooms/join/{invite_token} - Join Room", False, 
                            "New participant not found in room participants")
                return False
            
            # Validate participant data
            if (new_participant['username'] != join_username or 
                new_participant['first_name'] != join_first_name or
                new_participant['role'] != 'member'):
                self.log_test("POST /api/rooms/join/{invite_token} - Join Room", False, 
                            "Participant data incorrect")
                return False
            
            self.log_test("POST /api/rooms/join/{invite_token} - Join Room", True, 
                        "Successfully joined room by token",
                        {
                            "room_id": joined_room_data['room_id'],
                            "total_participants": joined_room_data['total_participants'],
                            "new_participant": {
                                "telegram_id": new_participant['telegram_id'],
                                "username": new_participant['username'],
                                "first_name": new_participant['first_name'],
                                "role": new_participant['role']
                            }
                        })
            
            # Step 4: Test joining with same user (should return existing room data)
            print("🔄 Step 4: Testing duplicate join...")
            
            duplicate_join_response = self.session.post(
                f"{self.base_url}/rooms/join/{invite_token}",
                json=join_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if duplicate_join_response.status_code != 200:
                self.log_test("POST /api/rooms/join/{invite_token} - Duplicate Join", False, 
                            f"HTTP {duplicate_join_response.status_code}: {duplicate_join_response.text}")
                return False
            
            duplicate_room_data = duplicate_join_response.json()
            
            # Should still have 2 participants (no duplicate)
            if len(duplicate_room_data['participants']) != 2:
                self.log_test("POST /api/rooms/join/{invite_token} - Duplicate Join", False, 
                            f"Expected 2 participants after duplicate join, got {len(duplicate_room_data['participants'])}")
                return False
            
            self.log_test("POST /api/rooms/join/{invite_token} - Duplicate Join", True, 
                        "Successfully handled duplicate join (no duplicate participant created)",
                        {"participants_count": len(duplicate_room_data['participants'])})
            
            # Step 5: Test invalid token
            print("❌ Step 5: Testing invalid token...")
            
            invalid_token = "invalid_token_12345"
            invalid_join_response = self.session.post(
                f"{self.base_url}/rooms/join/{invalid_token}",
                json=join_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if invalid_join_response.status_code != 404:
                self.log_test("POST /api/rooms/join/{invite_token} - Invalid Token", False, 
                            f"Expected HTTP 404 for invalid token, got {invalid_join_response.status_code}")
                return False
            
            self.log_test("POST /api/rooms/join/{invite_token} - Invalid Token", True, 
                        "Successfully returned 404 for invalid token")
            
            # Final comprehensive test result
            self.log_test("Rooms API - Complete Test", True, 
                        "Successfully completed all Rooms API tests",
                        {
                            "room_created": True,
                            "invite_link_generated": True,
                            "invite_link_format_correct": True,
                            "user_joined_successfully": True,
                            "duplicate_join_handled": True,
                            "invalid_token_handled": True,
                            "all_required_fields_present": True
                        })
            
            return True
            
        except Exception as e:
            self.log_test("Rooms API - Complete Test", False, f"Exception: {str(e)}")
            return False

def main():
    """Main test runner"""
    tester = RoomsAPITester()
    
    print("🚀 Starting Rooms API Tests")
    print(f"🌐 Backend URL: {tester.base_url}")
    print(f"⏱️  Timeout: {TIMEOUT} seconds")
    print("=" * 60)
    
    success = tester.test_rooms_api_comprehensive()
    
    # Print summary
    print("\n" + "=" * 60)
    print("📋 ROOMS API TEST SUMMARY")
    print("=" * 60)
    
    for result in tester.test_results:
        status = "✅" if result['success'] else "❌"
        print(f"{status} {result['test']}: {result['message']}")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())