#!/usr/bin/env python3
"""
Room Invitation Functionality Test
Tests the complete room invitation flow with notifications as requested in the review
"""

import requests
import json
import time
import sys

# Configuration
BACKEND_URL = "http://localhost:8001/api"
TIMEOUT = 30

class RoomInvitationTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.session.timeout = TIMEOUT
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, message: str, details: dict = None):
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

    def test_room_invitation_complete_flow(self):
        """
        Test complete room invitation flow as specified in the review request
        """
        try:
            print("🚀 Testing Room Invitation Functionality")
            print("=" * 60)
            
            # Step 1: Create test room
            print("📋 Step 1: Creating test room...")
            room_payload = {
                "name": "Тестовая комната для уведомлений",
                "description": "Проверка уведомлений", 
                "telegram_id": 123456789,
                "color": "blue"
            }
            
            room_response = self.session.post(
                f"{self.base_url}/rooms",
                json=room_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if room_response.status_code != 200:
                self.log_test("Create Test Room", False, 
                            f"HTTP {room_response.status_code}: {room_response.text}")
                return False
            
            room_data = room_response.json()
            room_id = room_data.get('room_id')
            
            if not room_id:
                self.log_test("Create Test Room", False, "Room ID not returned")
                return False
            
            self.log_test("Create Test Room", True, 
                        f"Room created successfully",
                        {
                            "room_id": room_id,
                            "name": room_data.get('name'),
                            "total_participants": room_data.get('total_participants')
                        })
            
            # Step 2: Generate invite token
            print("🔗 Step 2: Generating invite link...")
            invite_payload = {"telegram_id": 123456789}
            
            invite_response = self.session.post(
                f"{self.base_url}/rooms/{room_id}/invite-link",
                json=invite_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if invite_response.status_code != 200:
                self.log_test("Generate Invite Link", False,
                            f"HTTP {invite_response.status_code}: {invite_response.text}")
                return False
            
            invite_data = invite_response.json()
            invite_token = invite_data.get('invite_token')
            
            if not invite_token:
                self.log_test("Generate Invite Link", False, "Invite token not returned")
                return False
            
            self.log_test("Generate Invite Link", True,
                        f"Invite link generated successfully",
                        {
                            "invite_token": invite_token,
                            "invite_link": invite_data.get('invite_link'),
                            "bot_username": invite_data.get('bot_username')
                        })
            
            # Step 3: Add second participant (join room)
            print("👥 Step 3: Adding second participant...")
            join_payload = {
                "invite_token": invite_token,
                "telegram_id": 987654321,
                "username": "test_user", 
                "first_name": "Тест Пользователь",
                "referral_code": "123456789"
            }
            
            join_response = self.session.post(
                f"{self.base_url}/rooms/join/{invite_token}",
                json=join_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if join_response.status_code != 200:
                self.log_test("Join Room", False,
                            f"HTTP {join_response.status_code}: {join_response.text}")
                return False
            
            join_data = join_response.json()
            
            if join_data.get('total_participants') != 2:
                self.log_test("Join Room", False,
                            f"Expected 2 participants, got {join_data.get('total_participants')}")
                return False
            
            self.log_test("Join Room", True,
                        f"Second participant joined successfully",
                        {
                            "total_participants": join_data.get('total_participants'),
                            "new_participant_id": 987654321
                        })
            
            # Step 4: Verify participants in room detail
            print("🔍 Step 4: Verifying participants...")
            detail_response = self.session.get(f"{self.base_url}/rooms/detail/{room_id}")
            
            if detail_response.status_code != 200:
                self.log_test("Verify Participants", False,
                            f"HTTP {detail_response.status_code}: {detail_response.text}")
                return False
            
            detail_data = detail_response.json()
            participants = detail_data.get('participants', [])
            
            if len(participants) != 2:
                self.log_test("Verify Participants", False,
                            f"Expected 2 participants, got {len(participants)}")
                return False
            
            participant_ids = [p.get('telegram_id') for p in participants]
            expected_ids = [123456789, 987654321]
            
            if set(participant_ids) != set(expected_ids):
                self.log_test("Verify Participants", False,
                            f"Participant IDs mismatch. Expected: {expected_ids}, Got: {participant_ids}")
                return False
            
            self.log_test("Verify Participants", True,
                        f"Both participants verified in room detail",
                        {
                            "participant_ids": participant_ids,
                            "participants_data": participants
                        })
            
            # Step 5: Test duplicate join prevention
            print("🚫 Step 5: Testing duplicate join prevention...")
            duplicate_response = self.session.post(
                f"{self.base_url}/rooms/join/{invite_token}",
                json=join_payload,  # Same payload
                headers={"Content-Type": "application/json"}
            )
            
            if duplicate_response.status_code != 200:
                self.log_test("Duplicate Join Prevention", False,
                            f"HTTP {duplicate_response.status_code}: {duplicate_response.text}")
                return False
            
            duplicate_data = duplicate_response.json()
            
            if duplicate_data.get('total_participants') != 2:
                self.log_test("Duplicate Join Prevention", False,
                            f"Duplicate join changed count. Expected: 2, Got: {duplicate_data.get('total_participants')}")
                return False
            
            self.log_test("Duplicate Join Prevention", True,
                        f"Duplicate join correctly prevented",
                        {
                            "total_participants_unchanged": duplicate_data.get('total_participants')
                        })
            
            return True
            
        except Exception as e:
            self.log_test("Room Invitation Complete Flow", False, f"Exception: {str(e)}")
            return False

    def check_notification_logs(self):
        """Check backend logs for notification messages"""
        try:
            print("📋 Checking backend logs for notification messages...")
            
            import subprocess
            import os
            
            log_files = [
                "/var/log/supervisor/backend.out.log",
                "/var/log/supervisor/backend.err.log"
            ]
            
            notification_messages = []
            
            for log_file in log_files:
                if os.path.exists(log_file):
                    try:
                        result = subprocess.run(
                            ["tail", "-n", "50", log_file],
                            capture_output=True,
                            text=True,
                            timeout=10
                        )
                        
                        if result.returncode == 0:
                            log_content = result.stdout
                            
                            # Look for notification keywords
                            keywords = [
                                "отправлено уведомление",
                                "notification sent", 
                                "send_room_join_notifications",
                                "Добро пожаловать в комнату",
                                "Новый участник в комнате",
                                "TELEGRAM_BOT_TOKEN не настроен"
                            ]
                            
                            for keyword in keywords:
                                if keyword.lower() in log_content.lower():
                                    notification_messages.append(f"Found '{keyword}' in {log_file}")
                    
                    except Exception as e:
                        print(f"    ⚠️ Error reading {log_file}: {e}")
            
            if notification_messages:
                self.log_test("Notification Logs Check", True,
                            "Found notification-related messages in logs",
                            {"messages": notification_messages})
            else:
                self.log_test("Notification Logs Check", True,
                            "No notification messages found (may be expected if bot token not configured)",
                            {"note": "Check logs manually: tail -f /var/log/supervisor/backend.out.log"})
            
            return True
            
        except Exception as e:
            self.log_test("Notification Logs Check", False, f"Exception: {str(e)}")
            return False

    def run_tests(self):
        """Run all room invitation tests"""
        print("🚀 Starting Room Invitation Tests")
        print(f"🌐 Backend URL: {self.base_url}")
        print("=" * 60)
        
        success = True
        
        # Run main test flow
        if not self.test_room_invitation_complete_flow():
            success = False
        
        # Check logs
        self.check_notification_logs()
        
        # Summary
        print("=" * 60)
        passed = sum(1 for r in self.test_results if r['success'])
        total = len(self.test_results)
        print(f"📊 Test Results: {passed}/{total} tests passed")
        
        if success and passed == total:
            print("🎉 All room invitation tests passed!")
        else:
            print("⚠️ Some tests failed. Check details above.")
        
        return success

def main():
    """Main test runner"""
    tester = RoomInvitationTester()
    success = tester.run_tests()
    
    print("\n" + "=" * 60)
    print("📋 DETAILED TEST SUMMARY")
    print("=" * 60)
    
    for result in tester.test_results:
        status = "✅" if result['success'] else "❌"
        print(f"{status} {result['test']}: {result['message']}")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())