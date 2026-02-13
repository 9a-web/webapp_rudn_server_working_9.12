#!/usr/bin/env python3
"""
Backend API Testing Script for Admin Panel Statistics Features
Tests the admin panel online statistics history and server metrics features on RUDN Schedule backend.
"""

import httpx
import asyncio
import json
from typing import Dict, Any, Optional, List

# Backend URL - using the external URL from frontend/.env
BASE_URL = "https://db-reconnect-1.preview.emergentagent.com/api"

class AdminPanelStatsTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.test_results = []
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
    
    def log_test(self, test_name: str, success: bool, details: str):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
        if not success:
            print(f"   Details: {details}")
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details
        })
    
    async def test_1_health_check(self):
        """Test 1: Health Check - GET /api/health → HTTP 200, status 'healthy'"""
        try:
            response = await self.client.get(f"{BASE_URL}/health")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    self.log_test("Health Check", True, 
                                f"Status: {data['status']}, healthy endpoint working")
                else:
                    self.log_test("Health Check", False, 
                                f"Expected status 'healthy', got: {data.get('status')}")
            else:
                self.log_test("Health Check", False, 
                            f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Health Check", False, f"Exception: {str(e)}")
    
    async def test_2_notification_settings_include_social_messages(self):
        """Test 2: Notification Settings include social_messages - GET /api/notifications/12345/settings"""
        try:
            test_user_id = 12345
            response = await self.client.get(f"{BASE_URL}/notifications/{test_user_id}/settings")
            
            if response.status_code == 200:
                data = response.json()
                if "social_messages" in data and isinstance(data["social_messages"], bool):
                    self.log_test("Notification Settings Include social_messages", True, 
                                f"social_messages field present with value: {data['social_messages']}")
                else:
                    self.log_test("Notification Settings Include social_messages", False, 
                                f"social_messages field missing or not boolean. Response: {data}")
            else:
                self.log_test("Notification Settings Include social_messages", False, 
                            f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Notification Settings Include social_messages", False, f"Exception: {str(e)}")
    
    async def test_3_update_notification_settings_social_messages(self):
        """Test 3: Update notification settings with social_messages"""
        try:
            test_user_id = 12345
            
            # Step 1: Set social_messages to false
            update_response = await self.client.put(
                f"{BASE_URL}/notifications/{test_user_id}/settings",
                json={"social_messages": False}
            )
            
            if update_response.status_code != 200:
                self.log_test("Update Notification Settings (social_messages)", False, 
                            f"Failed to update settings: HTTP {update_response.status_code}: {update_response.text}")
                return
            
            # Step 2: Verify the setting was updated
            get_response = await self.client.get(f"{BASE_URL}/notifications/{test_user_id}/settings")
            
            if get_response.status_code != 200:
                self.log_test("Update Notification Settings (social_messages)", False, 
                            f"Failed to get updated settings: HTTP {get_response.status_code}: {get_response.text}")
                return
                
            data = get_response.json()
            if data.get("social_messages") == False:
                # Step 3: Restore to true
                restore_response = await self.client.put(
                    f"{BASE_URL}/notifications/{test_user_id}/settings",
                    json={"social_messages": True}
                )
                
                if restore_response.status_code == 200:
                    self.log_test("Update Notification Settings (social_messages)", True, 
                                "Successfully updated social_messages to false and restored to true")
                else:
                    self.log_test("Update Notification Settings (social_messages)", False, 
                                f"Failed to restore setting: HTTP {restore_response.status_code}")
            else:
                self.log_test("Update Notification Settings (social_messages)", False, 
                            f"Setting not updated correctly. Expected false, got: {data.get('social_messages')}")
                
        except Exception as e:
            self.log_test("Update Notification Settings (social_messages)", False, f"Exception: {str(e)}")
    
    async def test_4_setup_test_users_and_friendship(self):
        """Test 4: Setup test users and establish friendship"""
        try:
            # Step 1: Create user settings for sender (with required fields)
            sender_data = {
                "telegram_id": self.test_user_sender, 
                "first_name": "TestSender",
                "group_id": "test_group_111",
                "group_name": "Тест группа 111", 
                "facultet_id": "test_faculty",
                "facultet_name": "Тестовый факультет",
                "level_id": "test_level",
                "kurs": "1",
                "form_code": "test_form",
                "notifications_enabled": True
            }
            sender_response = await self.client.post(f"{BASE_URL}/user-settings", json=sender_data)
            
            # Step 2: Create user settings for receiver  
            receiver_data = {
                "telegram_id": self.test_user_receiver, 
                "first_name": "TestReceiver",
                "group_id": "test_group_222",
                "group_name": "Тест группа 222", 
                "facultet_id": "test_faculty",
                "facultet_name": "Тестовый факультет",
                "level_id": "test_level",
                "kurs": "1",
                "form_code": "test_form",
                "notifications_enabled": True
            }
            receiver_response = await self.client.post(f"{BASE_URL}/user-settings", json=receiver_data)
            
            # Both should succeed or already exist (409 is ok)
            if sender_response.status_code not in [200, 201, 409]:
                self.log_test("Setup Test Users and Friendship", False, 
                            f"Failed to create sender user: HTTP {sender_response.status_code}: {sender_response.text}")
                return
                
            if receiver_response.status_code not in [200, 201, 409]:
                self.log_test("Setup Test Users and Friendship", False, 
                            f"Failed to create receiver user: HTTP {receiver_response.status_code}: {receiver_response.text}")
                return
            
            # Step 3: Send friend request from sender to receiver
            request_response = await self.client.post(
                f"{BASE_URL}/friends/request/{self.test_user_receiver}", 
                json={"telegram_id": self.test_user_sender}
            )
            
            # Step 4: Get the request ID and accept it (handle existing request)
            if request_response.status_code in [200, 201, 400]:  # 400 = already sent
                # Get friend requests for receiver to find the request ID
                requests_response = await self.client.get(f"{BASE_URL}/friends/{self.test_user_receiver}/requests")
                
                if requests_response.status_code == 200:
                    requests_data = requests_response.json()
                    pending_requests = requests_data.get("incoming", [])
                    
                    # Find the request from our test sender
                    request_id = None
                    for req in pending_requests:
                        if req.get("telegram_id") == self.test_user_sender:  # Changed from "sender" nested field to direct field
                            request_id = req.get("request_id")  # Changed from "id" to "request_id"
                            break
                    
                    if request_id:
                        # Accept the friend request
                        accept_response = await self.client.post(
                            f"{BASE_URL}/friends/accept/{request_id}", 
                            json={"telegram_id": self.test_user_receiver}
                        )
                        
                        if accept_response.status_code in [200, 201]:
                            self.log_test("Setup Test Users and Friendship", True, 
                                        f"Test users created and friendship established successfully")
                        else:
                            self.log_test("Setup Test Users and Friendship", False, 
                                        f"Failed to accept friend request: HTTP {accept_response.status_code}: {accept_response.text}")
                    else:
                        # Maybe they are already friends? Check friends list
                        friends_response = await self.client.get(f"{BASE_URL}/friends/{self.test_user_sender}")
                        if friends_response.status_code == 200:
                            friends_data = friends_response.json()
                            friends_list = friends_data.get("friends", [])
                            already_friends = any(friend.get("telegram_id") == self.test_user_receiver for friend in friends_list)
                            
                            if already_friends:
                                self.log_test("Setup Test Users and Friendship", True, 
                                            f"Test users are already friends")
                            else:
                                self.log_test("Setup Test Users and Friendship", False, 
                                            f"Could not find friend request to accept and users are not friends. Requests: {requests_data}")
                        else:
                            self.log_test("Setup Test Users and Friendship", False, 
                                        f"Could not find friend request to accept in: {requests_data}")
                else:
                    self.log_test("Setup Test Users and Friendship", False, 
                                f"Failed to get friend requests: HTTP {requests_response.status_code}: {requests_response.text}")
            else:
                self.log_test("Setup Test Users and Friendship", False, 
                            f"Failed to send friend request: HTTP {request_response.status_code}: {request_response.text}")
                
        except Exception as e:
            self.log_test("Setup Test Users and Friendship", False, f"Exception: {str(e)}")
    
    async def test_5_send_message_creates_notification(self):
        """Test 5: Send message creates notification"""
        try:
            # Step 1: Send message from sender to receiver
            message_data = {
                "sender_id": self.test_user_sender,
                "receiver_id": self.test_user_receiver, 
                "text": "Привет! Тестовое сообщение"
            }
            
            message_response = await self.client.post(f"{BASE_URL}/messages/send", json=message_data)
            
            if message_response.status_code not in [200, 201]:
                self.log_test("Send Message Creates Notification", False, 
                            f"Failed to send message: HTTP {message_response.status_code}: {message_response.text}")
                return
            
            # Step 2: Check if notification was created for receiver
            # Wait a bit for notification to be processed
            await asyncio.sleep(2)
            
            notifications_response = await self.client.get(f"{BASE_URL}/notifications/{self.test_user_receiver}?limit=5")
            
            if notifications_response.status_code != 200:
                self.log_test("Send Message Creates Notification", False, 
                            f"Failed to get notifications: HTTP {notifications_response.status_code}: {notifications_response.text}")
                return
            
            notifications_data = notifications_response.json()
            
            # Look for new_message notification
            new_message_notifications = []
            if isinstance(notifications_data, dict) and "notifications" in notifications_data:
                notifications = notifications_data["notifications"]
            elif isinstance(notifications_data, list):
                notifications = notifications_data
            else:
                notifications = []
            
            for notification in notifications:
                if notification.get("type") == "new_message":
                    new_message_notifications.append(notification)
            
            if new_message_notifications:
                # Check if notification contains sender name
                notification = new_message_notifications[0]
                title = notification.get("title", "")
                has_sender_name = "TestSender" in title
                
                if has_sender_name:
                    self.log_test("Send Message Creates Notification", True, 
                                f"Message sent successfully and notification created with sender name in title: '{title}'")
                else:
                    self.log_test("Send Message Creates Notification", False, 
                                f"Notification created but doesn't contain sender name. Title: '{title}'")
            else:
                self.log_test("Send Message Creates Notification", False, 
                            f"Message sent but no new_message notification found. Found {len(notifications)} notifications total")
                
        except Exception as e:
            self.log_test("Send Message Creates Notification", False, f"Exception: {str(e)}")
    
    async def test_6_notification_structure(self):
        """Test 6: Verify notification structure for new_message type"""
        try:
            # Get recent notifications for receiver
            notifications_response = await self.client.get(f"{BASE_URL}/notifications/{self.test_user_receiver}?limit=10")
            
            if notifications_response.status_code != 200:
                self.log_test("Notification Structure Verification", False, 
                            f"Failed to get notifications: HTTP {notifications_response.status_code}: {notifications_response.text}")
                return
            
            notifications_data = notifications_response.json()
            
            # Find new_message notification
            if isinstance(notifications_data, dict) and "notifications" in notifications_data:
                notifications = notifications_data["notifications"]
            elif isinstance(notifications_data, list):
                notifications = notifications_data
            else:
                notifications = []
            
            new_message_notification = None
            for notification in notifications:
                if notification.get("type") == "new_message":
                    new_message_notification = notification
                    break
            
            if not new_message_notification:
                self.log_test("Notification Structure Verification", False, 
                            "No new_message notification found to verify structure")
                return
            
            # Verify required fields
            required_fields = {
                "type": "new_message",
                "category": "social", 
                "emoji": "💬"
            }
            
            structure_issues = []
            
            for field, expected_value in required_fields.items():
                actual_value = new_message_notification.get(field)
                if actual_value != expected_value:
                    structure_issues.append(f"{field}: expected '{expected_value}', got '{actual_value}'")
            
            # Check data field structure
            data = new_message_notification.get("data", {})
            required_data_fields = ["conversation_id", "sender_id", "sender_name", "message_id"]
            
            for field in required_data_fields:
                if field not in data:
                    structure_issues.append(f"data.{field}: missing")
            
            if not structure_issues:
                self.log_test("Notification Structure Verification", True, 
                            f"Notification structure is correct: type={new_message_notification['type']}, category={new_message_notification['category']}, emoji={new_message_notification['emoji']}")
            else:
                self.log_test("Notification Structure Verification", False, 
                            f"Structure issues: {'; '.join(structure_issues)}. Full notification: {json.dumps(new_message_notification, indent=2)}")
                
        except Exception as e:
            self.log_test("Notification Structure Verification", False, f"Exception: {str(e)}")
    
    async def run_all_tests(self):
        """Run all message notification tests"""
        print("🚀 Starting Message Notification Feature Backend Tests")
        print("=" * 70)
        print(f"Backend URL: {BASE_URL}")
        print(f"Environment: test (using test bot, test database)")
        print("=" * 70)
        
        # Run tests in sequence as specified in review request
        await self.test_1_health_check()
        await self.test_2_notification_settings_include_social_messages()
        await self.test_3_update_notification_settings_social_messages()
        await self.test_4_setup_test_users_and_friendship()
        await self.test_5_send_message_creates_notification()
        await self.test_6_notification_structure()
        
        print("\n" + "=" * 70)
        print("📊 TEST SUMMARY")
        print("=" * 70)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        print(f"Tests Passed: {passed}/{total}")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED!")
        else:
            print("⚠️  Some tests failed. Check details above.")
        
        print("\nDetailed Results:")
        for result in self.test_results:
            status = "✅" if result['success'] else "❌"
            print(f"{status} {result['test']}")
            if not result['success'] and result['details']:
                print(f"   -> {result['details']}")
        
        return passed == total

async def main():
    """Main test runner"""
    async with MessageNotificationTester() as tester:
        success = await tester.run_all_tests()
        return success

if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n🛑 Tests interrupted by user")
        exit(1)
    except Exception as e:
        print(f"\n💥 Test runner crashed: {e}")
        exit(1)