#!/usr/bin/env python3
"""
Messaging API Testing Script
Tests the new messaging API endpoints as specified in the review request
"""

import requests
import json
import time
from datetime import datetime
import sys

# Configuration - using localhost:8001 as specified in review request
BASE_URL = "http://localhost:8001/api"

# Test users as specified in the review request
USER1_ID = 55555
USER2_ID = 66666
USER1_DATA = {
    "telegram_id": USER1_ID,
    "username": "testuser1", 
    "first_name": "Alice",
    "last_name": "Test",
    "group_id": "G1",
    "group_name": "Test Group",
    "facultet_id": "F1",
    "level_id": "L1",
    "kurs": "1",
    "form_code": "ОФО"
}

USER2_DATA = {
    "telegram_id": USER2_ID,
    "username": "testuser2",
    "first_name": "Bob", 
    "last_name": "Test",
    "group_id": "G1",
    "group_name": "Test Group",
    "facultet_id": "F1", 
    "level_id": "L1",
    "kurs": "1",
    "form_code": "ОФО"
}

def print_test_result(test_name, success, details=None):
    """Print formatted test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"   {details}")
    print()

def print_step(step_num, description):
    """Print test step"""
    print(f"\n{step_num}. {description}")

def setup_test_data():
    """Set up test data as specified in the review request"""
    print("🔧 Setting up test data...")
    
    # Create user 55555
    print_step(1, f"Creating user {USER1_ID}")
    try:
        response = requests.post(f"{BASE_URL}/user-settings", json=USER1_DATA, timeout=10)
        if response.status_code == 200:
            print(f"   ✅ User {USER1_ID} created successfully")
        else:
            print(f"   ⚠️ User {USER1_ID} creation status: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Failed to create user {USER1_ID}: {e}")
        return False
    
    # Create user 66666  
    print_step(2, f"Creating user {USER2_ID}")
    try:
        response = requests.post(f"{BASE_URL}/user-settings", json=USER2_DATA, timeout=10)
        if response.status_code == 200:
            print(f"   ✅ User {USER2_ID} created successfully")
        else:
            print(f"   ⚠️ User {USER2_ID} creation status: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Failed to create user {USER2_ID}: {e}")
        return False
    
    # Send friend request
    print_step(3, f"Sending friend request from {USER1_ID} to {USER2_ID}")
    try:
        friend_request_data = {"telegram_id": USER1_ID}
        response = requests.post(f"{BASE_URL}/friends/request/{USER2_ID}", json=friend_request_data, timeout=10)
        if response.status_code == 200:
            print(f"   ✅ Friend request sent successfully")
        else:
            print(f"   ⚠️ Friend request status: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"   ❌ Failed to send friend request: {e}")
        return False
    
    # Get friend requests to capture request_id
    print_step(4, f"Getting friend requests for user {USER2_ID}")
    try:
        response = requests.get(f"{BASE_URL}/friends/{USER2_ID}/requests", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)[:200]}...")
            
            # Look for incoming requests
            incoming = data.get('incoming', [])
            if incoming:
                request_id = incoming[0].get('request_id')
                print(f"   ✅ Found request_id: {request_id}")
                
                # Accept friend request
                print_step(5, f"Accepting friend request {request_id}")
                accept_data = {"telegram_id": USER2_ID}
                response = requests.post(f"{BASE_URL}/friends/accept/{request_id}", json=accept_data, timeout=10)
                if response.status_code == 200:
                    print(f"   ✅ Friend request accepted successfully")
                    return True
                else:
                    print(f"   ❌ Failed to accept friend request: {response.status_code} - {response.text}")
                    return False
            else:
                print(f"   ❌ No incoming friend requests found")
                return False
        else:
            print(f"   ❌ Failed to get friend requests: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Failed to get friend requests: {e}")
        return False

def test_messaging_endpoints():
    """Test messaging endpoints in the specified order"""
    print("\n🔄 Testing messaging endpoints...")
    
    conversation_id = None
    first_message_id = None
    test_results = []
    
    # Test 1: GET unread messages (should be 0 initially)
    print_step(1, "GET unread messages for user 55555 (expect total_unread: 0)")
    try:
        response = requests.get(f"{BASE_URL}/messages/unread/{USER1_ID}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            total_unread = data.get('total_unread', -1)
            if total_unread == 0:
                print_test_result("Initial unread count", True, "total_unread is 0 as expected")
                test_results.append(True)
            else:
                print_test_result("Initial unread count", False, f"Expected 0, got {total_unread}")
                test_results.append(False)
        else:
            print_test_result("Initial unread count", False, f"HTTP {response.status_code}: {response.text}")
            test_results.append(False)
    except Exception as e:
        print_test_result("Initial unread count", False, f"Exception: {e}")
        test_results.append(False)
    
    # Test 2: Create conversation
    print_step(2, "POST create/get conversation between users 55555 and 66666")
    try:
        conv_data = {"user1_id": USER1_ID, "user2_id": USER2_ID}
        response = requests.post(f"{BASE_URL}/messages/conversations", json=conv_data, timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            conversation_id = data.get('id')
            if conversation_id:
                print_test_result("Create conversation", True, f"Conversation created with ID: {conversation_id}")
                test_results.append(True)
            else:
                print_test_result("Create conversation", False, "No conversation ID in response")
                test_results.append(False)
        else:
            print_test_result("Create conversation", False, f"HTTP {response.status_code}: {response.text}")
            test_results.append(False)
    except Exception as e:
        print_test_result("Create conversation", False, f"Exception: {e}")
        test_results.append(False)
    
    if not conversation_id:
        print("❌ Cannot continue without conversation_id")
        return test_results
    
    # Test 3: Send first message
    print_step(3, "POST send message from 55555 to 66666: 'Привет!'")
    try:
        msg_data = {
            "sender_id": USER1_ID,
            "receiver_id": USER2_ID, 
            "text": "Привет!"
        }
        response = requests.post(f"{BASE_URL}/messages/send", json=msg_data, timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            first_message_id = data.get('id')
            if first_message_id:
                print_test_result("Send first message", True, f"Message sent with ID: {first_message_id}")
                test_results.append(True)
            else:
                print_test_result("Send first message", False, "No message ID in response")
                test_results.append(False)
        else:
            print_test_result("Send first message", False, f"HTTP {response.status_code}: {response.text}")
            test_results.append(False)
    except Exception as e:
        print_test_result("Send first message", False, f"Exception: {e}")
        test_results.append(False)
    
    # Test 4: Send second message
    print_step(4, "POST send message from 66666 to 55555: 'Привет! Как дела?'")
    try:
        msg_data = {
            "sender_id": USER2_ID,
            "receiver_id": USER1_ID,
            "text": "Привет! Как дела?"
        }
        response = requests.post(f"{BASE_URL}/messages/send", json=msg_data, timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            print_test_result("Send second message", True, "Message sent successfully")
            test_results.append(True)
        else:
            print_test_result("Send second message", False, f"HTTP {response.status_code}: {response.text}")
            test_results.append(False)
    except Exception as e:
        print_test_result("Send second message", False, f"Exception: {e}")
        test_results.append(False)
    
    # Test 5: Get conversation messages
    print_step(5, f"GET messages in conversation {conversation_id} for user 55555 (expect 2 messages)")
    try:
        response = requests.get(f"{BASE_URL}/messages/{conversation_id}/messages?telegram_id={USER1_ID}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            messages = data.get('messages', [])
            message_count = len(messages)
            if message_count == 2:
                print_test_result("Get conversation messages", True, f"Found {message_count} messages as expected")
                test_results.append(True)
            else:
                print_test_result("Get conversation messages", False, f"Expected 2 messages, got {message_count}")
                test_results.append(False)
        else:
            print_test_result("Get conversation messages", False, f"HTTP {response.status_code}: {response.text}")
            test_results.append(False)
    except Exception as e:
        print_test_result("Get conversation messages", False, f"Exception: {e}")
        test_results.append(False)
    
    # Test 6: Check unread count (should be 1 now)
    print_step(6, "GET unread messages for user 55555 (expect total_unread: 1)")
    try:
        response = requests.get(f"{BASE_URL}/messages/unread/{USER1_ID}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            total_unread = data.get('total_unread', -1)
            if total_unread == 1:
                print_test_result("Unread count after messages", True, "total_unread is 1 as expected")
                test_results.append(True)
            else:
                print_test_result("Unread count after messages", False, f"Expected 1, got {total_unread}")
                test_results.append(False)
        else:
            print_test_result("Unread count after messages", False, f"HTTP {response.status_code}: {response.text}")
            test_results.append(False)
    except Exception as e:
        print_test_result("Unread count after messages", False, f"Exception: {e}")
        test_results.append(False)
    
    # Test 7: Mark messages as read
    print_step(7, f"PUT mark messages as read in conversation {conversation_id} by user 55555")
    try:
        read_data = {"telegram_id": USER1_ID}
        response = requests.put(f"{BASE_URL}/messages/{conversation_id}/read", json=read_data, timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            print_test_result("Mark messages as read", True, "Messages marked as read successfully")
            test_results.append(True)
        else:
            print_test_result("Mark messages as read", False, f"HTTP {response.status_code}: {response.text}")
            test_results.append(False)
    except Exception as e:
        print_test_result("Mark messages as read", False, f"Exception: {e}")
        test_results.append(False)
    
    # Test 8: Check unread count again (should be 0)
    print_step(8, "GET unread messages for user 55555 (expect total_unread: 0)")
    try:
        response = requests.get(f"{BASE_URL}/messages/unread/{USER1_ID}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            total_unread = data.get('total_unread', -1)
            if total_unread == 0:
                print_test_result("Unread count after read", True, "total_unread is 0 as expected")
                test_results.append(True)
            else:
                print_test_result("Unread count after read", False, f"Expected 0, got {total_unread}")
                test_results.append(False)
        else:
            print_test_result("Unread count after read", False, f"HTTP {response.status_code}: {response.text}")
            test_results.append(False)
    except Exception as e:
        print_test_result("Unread count after read", False, f"Exception: {e}")
        test_results.append(False)
    
    # Test 9: Delete message
    if first_message_id:
        print_step(9, f"DELETE message {first_message_id} by user 55555")
        try:
            delete_data = {"telegram_id": USER1_ID}
            response = requests.delete(f"{BASE_URL}/messages/{first_message_id}", json=delete_data, timeout=10)
            if response.status_code == 200:
                data = response.json()
                print(f"   Response: {json.dumps(data, indent=2)}")
                print_test_result("Delete message", True, "Message deleted successfully")
                test_results.append(True)
            else:
                print_test_result("Delete message", False, f"HTTP {response.status_code}: {response.text}")
                test_results.append(False)
        except Exception as e:
            print_test_result("Delete message", False, f"Exception: {e}")
            test_results.append(False)
    else:
        print_step(9, "DELETE message (skipped - no message ID)")
        test_results.append(False)
    
    # Test 10: Get conversations list
    print_step(10, f"GET conversations for user {USER1_ID} (expect 1 conversation)")
    try:
        response = requests.get(f"{BASE_URL}/messages/conversations/{USER1_ID}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            conversations = data.get('conversations', [])
            conv_count = len(conversations)
            if conv_count == 1:
                print_test_result("Get conversations", True, f"Found {conv_count} conversation as expected")
                test_results.append(True)
            else:
                print_test_result("Get conversations", False, f"Expected 1 conversation, got {conv_count}")
                test_results.append(False)
        else:
            print_test_result("Get conversations", False, f"HTTP {response.status_code}: {response.text}")
            test_results.append(False)
    except Exception as e:
        print_test_result("Get conversations", False, f"Exception: {e}")
        test_results.append(False)
    
    # Test 11: Try to send message to non-friend (expect 403)
    print_step(11, "POST send message to non-friend user 99999 (expect 403)")
    try:
        msg_data = {
            "sender_id": USER1_ID,
            "receiver_id": 99999,
            "text": "test"
        }
        response = requests.post(f"{BASE_URL}/messages/send", json=msg_data, timeout=10)
        if response.status_code == 403:
            print(f"   Response: HTTP 403 (expected)")
            print_test_result("Send to non-friend", True, "Got 403 as expected")
            test_results.append(True)
        else:
            print(f"   Response: HTTP {response.status_code}: {response.text}")
            print_test_result("Send to non-friend", False, f"Expected 403, got {response.status_code}")
            test_results.append(False)
    except Exception as e:
        print_test_result("Send to non-friend", False, f"Exception: {e}")
        test_results.append(False)
    
    # Test 12: Try to create conversation with self (expect 400)
    print_step(12, "POST create conversation with self (expect 400)")
    try:
        conv_data = {"user1_id": USER1_ID, "user2_id": USER1_ID}
        response = requests.post(f"{BASE_URL}/messages/conversations", json=conv_data, timeout=10)
        if response.status_code == 400:
            print(f"   Response: HTTP 400 (expected)")
            print_test_result("Create conversation with self", True, "Got 400 as expected")
            test_results.append(True)
        else:
            print(f"   Response: HTTP {response.status_code}: {response.text}")
            print_test_result("Create conversation with self", False, f"Expected 400, got {response.status_code}")
            test_results.append(False)
    except Exception as e:
        print_test_result("Create conversation with self", False, f"Exception: {e}")
        test_results.append(False)
    
    return test_results

def main():
    """Main test execution"""
    print("🚀 Starting Messaging API Testing")
    print(f"Backend URL: {BASE_URL}")
    print("=" * 70)
    
    # Setup test data
    setup_success = setup_test_data()
    if not setup_success:
        print("\n❌ Failed to set up test data. Cannot proceed with messaging tests.")
        return 1
    
    # Test messaging endpoints
    test_results = test_messaging_endpoints()
    
    # Summary
    print("\n" + "=" * 70)
    print("📊 MESSAGING API TEST SUMMARY")
    print("=" * 70)
    
    test_names = [
        "1. Initial unread count (0)",
        "2. Create conversation", 
        "3. Send first message",
        "4. Send second message",
        "5. Get conversation messages (2)",
        "6. Unread count after messages (1)",
        "7. Mark messages as read",
        "8. Unread count after read (0)", 
        "9. Delete message",
        "10. Get conversations (1)",
        "11. Send to non-friend (403)",
        "12. Create conversation with self (400)"
    ]
    
    passed = sum(test_results)
    failed = len(test_results) - passed
    
    for i, (test_name, result) in enumerate(zip(test_names, test_results)):
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print(f"\nTotal: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("\n🎉 All messaging API tests passed!")
        print("Messaging system is working correctly.")
        return 0
    else:
        print(f"\n⚠️  {failed} test(s) failed. Check the details above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())