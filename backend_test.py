#!/usr/bin/env python3
"""
Backend Test Script for NEW Messaging API Endpoints
Tests advanced messaging features: editing, reactions, pinning, replies, forwarding, typing, search, music, tasks
"""

import asyncio
import httpx
import json
from datetime import datetime
from typing import Dict, Any, Optional

# Backend URL from review request
BASE_URL = "https://social-messaging-hub.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

class TestResults:
    def __init__(self):
        self.results = []
        self.passed = 0
        self.failed = 0
    
    def add_result(self, test_name: str, passed: bool, status_code: Optional[int] = None, 
                  response_data: Any = None, error: Optional[str] = None):
        result = {
            'test': test_name,
            'passed': passed,
            'status_code': status_code,
            'response': response_data,
            'error': error,
            'timestamp': datetime.utcnow().isoformat()
        }
        self.results.append(result)
        if passed:
            self.passed += 1
            print(f"✅ {test_name} - Status: {status_code}")
        else:
            self.failed += 1
            print(f"❌ {test_name} - Status: {status_code} - Error: {error}")
        
        # Print key response data for successful tests
        if passed and response_data:
            if isinstance(response_data, dict):
                if 'message_id' in response_data:
                    print(f"   → message_id: {response_data['message_id']}")
                if 'conversation_id' in response_data:
                    print(f"   → conversation_id: {response_data['conversation_id']}")
                if 'edited_at' in response_data:
                    print(f"   → edited_at: {response_data['edited_at']}")
                if 'reactions' in response_data:
                    print(f"   → reactions: {response_data['reactions']}")
                if 'success' in response_data:
                    print(f"   → success: {response_data['success']}")
                if 'task_id' in response_data:
                    print(f"   → task_id: {response_data['task_id']}")
    
    def get_summary(self):
        return {
            'total': len(self.results),
            'passed': self.passed,
            'failed': self.failed,
            'success_rate': f"{(self.passed / len(self.results) * 100):.1f}%" if self.results else "0%"
        }

async def test_new_messaging_endpoints():
    """Test all NEW messaging API endpoints as per review request"""
    print("🚀 Starting NEW Messaging API Endpoints Testing")
    print(f"Backend URL: {API_BASE}")
    print("-" * 60)
    
    results = TestResults()
    
    # Test data storage
    message_id = None
    conversation_id = None
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        
        # Test 1: Send a new message first
        print("\n1. 📤 Testing: Send Message")
        try:
            response = await client.post(
                f"{API_BASE}/messages/send",
                json={
                    "sender_id": 55555,
                    "receiver_id": 66666,
                    "text": "Hello for testing new features!"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                message_id = data.get('id')  # Message ID is returned as 'id'
                conversation_id = data.get('conversation_id')
                results.add_result("Send Message", True, response.status_code, data)
            else:
                results.add_result("Send Message", False, response.status_code, error=response.text)
                
        except Exception as e:
            results.add_result("Send Message", False, error=str(e))
        
        # Test 2: Edit message (requires message_id from Test 1)
        if message_id:
            print(f"\n2. ✏️ Testing: Edit Message (ID: {message_id})")
            try:
                response = await client.put(
                    f"{API_BASE}/messages/{message_id}/edit",
                    json={
                        "telegram_id": 55555,
                        "text": "Edited message text!"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    # Check if edited_at is not null
                    if data.get('edited_at') is not None:
                        results.add_result("Edit Message", True, response.status_code, data)
                    else:
                        results.add_result("Edit Message", False, response.status_code, 
                                         error="edited_at should not be null")
                else:
                    results.add_result("Edit Message", False, response.status_code, error=response.text)
                    
            except Exception as e:
                results.add_result("Edit Message", False, error=str(e))
        else:
            results.add_result("Edit Message", False, error="No message_id from previous test")
        
        # Test 3: Add Reaction
        if message_id:
            print(f"\n3. ❤️ Testing: Add Reaction (ID: {message_id})")
            try:
                response = await client.post(
                    f"{API_BASE}/messages/{message_id}/reactions",
                    json={
                        "telegram_id": 66666,
                        "emoji": "❤️"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    # Check if reactions array contains heart with user 66666
                    reactions = data.get('reactions', [])
                    heart_found = any(r.get('emoji') == '❤️' and 66666 in r.get('users', []) 
                                    for r in reactions)
                    if heart_found:
                        results.add_result("Add Reaction", True, response.status_code, data)
                    else:
                        results.add_result("Add Reaction", False, response.status_code,
                                         error="Heart reaction with user 66666 not found in response")
                else:
                    results.add_result("Add Reaction", False, response.status_code, error=response.text)
                    
            except Exception as e:
                results.add_result("Add Reaction", False, error=str(e))
        else:
            results.add_result("Add Reaction", False, error="No message_id from previous test")
        
        # Test 4: Toggle Reaction Off (same reaction again)
        if message_id:
            print(f"\n4. 💔 Testing: Toggle Reaction Off (ID: {message_id})")
            try:
                response = await client.post(
                    f"{API_BASE}/messages/{message_id}/reactions",
                    json={
                        "telegram_id": 66666,
                        "emoji": "❤️"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    # Check if reactions array is empty (toggled off)
                    reactions = data.get('reactions', [])
                    if len(reactions) == 0:
                        results.add_result("Toggle Reaction Off", True, response.status_code, data)
                    else:
                        results.add_result("Toggle Reaction Off", False, response.status_code,
                                         error="Reactions should be empty after toggle off")
                else:
                    results.add_result("Toggle Reaction Off", False, response.status_code, error=response.text)
                    
            except Exception as e:
                results.add_result("Toggle Reaction Off", False, error=str(e))
        else:
            results.add_result("Toggle Reaction Off", False, error="No message_id from previous test")
        
        # Test 5: Pin Message
        if message_id:
            print(f"\n5. 📌 Testing: Pin Message (ID: {message_id})")
            try:
                response = await client.put(
                    f"{API_BASE}/messages/{message_id}/pin",
                    json={
                        "telegram_id": 55555,
                        "is_pinned": True
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('success') is True:
                        results.add_result("Pin Message", True, response.status_code, data)
                    else:
                        results.add_result("Pin Message", False, response.status_code,
                                         error="success should be true")
                else:
                    results.add_result("Pin Message", False, response.status_code, error=response.text)
                    
            except Exception as e:
                results.add_result("Pin Message", False, error=str(e))
        else:
            results.add_result("Pin Message", False, error="No message_id from previous test")
        
        # Test 6: Get Pinned Messages
        if conversation_id:
            print(f"\n6. 📍 Testing: Get Pinned Messages (Conversation: {conversation_id})")
            try:
                response = await client.get(f"{API_BASE}/messages/{conversation_id}/pinned")
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('pinned_message') is not None:
                        results.add_result("Get Pinned Messages", True, response.status_code, data)
                    else:
                        results.add_result("Get Pinned Messages", False, response.status_code,
                                         error="pinned_message should not be null")
                else:
                    results.add_result("Get Pinned Messages", False, response.status_code, error=response.text)
                    
            except Exception as e:
                results.add_result("Get Pinned Messages", False, error=str(e))
        else:
            results.add_result("Get Pinned Messages", False, error="No conversation_id from previous test")
        
        # Test 7: Send Reply
        if message_id:
            print(f"\n7. 💬 Testing: Send Reply (Reply to: {message_id})")
            try:
                response = await client.post(
                    f"{API_BASE}/messages/send",
                    json={
                        "sender_id": 66666,
                        "receiver_id": 55555,
                        "text": "This is a reply!",
                        "reply_to_id": message_id
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    reply_to = data.get('reply_to')
                    if reply_to and reply_to.get('sender_name') and reply_to.get('text'):
                        results.add_result("Send Reply", True, response.status_code, data)
                    else:
                        results.add_result("Send Reply", False, response.status_code,
                                         error="reply_to should contain sender_name and text")
                else:
                    results.add_result("Send Reply", False, response.status_code, error=response.text)
                    
            except Exception as e:
                results.add_result("Send Reply", False, error=str(e))
        else:
            results.add_result("Send Reply", False, error="No message_id from previous test")
        
        # Test 8: Forward Message
        if message_id:
            print(f"\n8. ↩️ Testing: Forward Message (Original: {message_id})")
            try:
                response = await client.post(
                    f"{API_BASE}/messages/forward",
                    json={
                        "sender_id": 55555,
                        "receiver_id": 66666,
                        "original_message_id": message_id
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    forwarded_from = data.get('forwarded_from')
                    if forwarded_from:
                        results.add_result("Forward Message", True, response.status_code, data)
                    else:
                        results.add_result("Forward Message", False, response.status_code,
                                         error="forwarded_from data should be present")
                else:
                    results.add_result("Forward Message", False, response.status_code, error=response.text)
                    
            except Exception as e:
                results.add_result("Forward Message", False, error=str(e))
        else:
            results.add_result("Forward Message", False, error="No message_id from previous test")
        
        # Test 9: Set Typing Indicator
        if conversation_id:
            print(f"\n9. ⌨️ Testing: Set Typing Indicator (Conversation: {conversation_id})")
            try:
                response = await client.post(
                    f"{API_BASE}/messages/{conversation_id}/typing",
                    json={
                        "telegram_id": 55555
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('success') is True:
                        results.add_result("Set Typing Indicator", True, response.status_code, data)
                    else:
                        results.add_result("Set Typing Indicator", False, response.status_code,
                                         error="success should be true")
                else:
                    results.add_result("Set Typing Indicator", False, response.status_code, error=response.text)
                    
            except Exception as e:
                results.add_result("Set Typing Indicator", False, error=str(e))
        else:
            results.add_result("Set Typing Indicator", False, error="No conversation_id from previous test")
        
        # Test 10: Get Typing Status
        if conversation_id:
            print(f"\n10. 👀 Testing: Get Typing Status (Conversation: {conversation_id})")
            try:
                response = await client.get(
                    f"{API_BASE}/messages/{conversation_id}/typing?telegram_id=66666"
                )
                
                if response.status_code == 200:
                    data = response.json()
                    typing_users = data.get('typing_users', [])
                    if 55555 in typing_users:
                        results.add_result("Get Typing Status", True, response.status_code, data)
                    else:
                        results.add_result("Get Typing Status", False, response.status_code,
                                         error="User 55555 should be in typing_users array")
                else:
                    results.add_result("Get Typing Status", False, response.status_code, error=response.text)
                    
            except Exception as e:
                results.add_result("Get Typing Status", False, error=str(e))
        else:
            results.add_result("Get Typing Status", False, error="No conversation_id from previous test")
        
        # Test 11: Search Messages
        if conversation_id:
            print(f"\n11. 🔍 Testing: Search Messages (Conversation: {conversation_id})")
            try:
                response = await client.get(
                    f"{API_BASE}/messages/{conversation_id}/search?q=Edited&telegram_id=55555"
                )
                
                if response.status_code == 200:
                    data = response.json()
                    results_array = data.get('results', [])
                    if len(results_array) >= 1:
                        results.add_result("Search Messages", True, response.status_code, data)
                    else:
                        results.add_result("Search Messages", False, response.status_code,
                                         error="Should find at least 1 message with 'Edited' text")
                else:
                    results.add_result("Search Messages", False, response.status_code, error=response.text)
                    
            except Exception as e:
                results.add_result("Search Messages", False, error=str(e))
        else:
            results.add_result("Search Messages", False, error="No conversation_id from previous test")
        
        # Test 12: Send Music Message
        print(f"\n12. 🎵 Testing: Send Music Message")
        try:
            response = await client.post(
                f"{API_BASE}/messages/send-music",
                json={
                    "sender_id": 55555,
                    "receiver_id": 66666,
                    "track_title": "Bohemian Rhapsody",
                    "track_artist": "Queen",
                    "track_duration": 355
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                # Check if it's a music message with metadata
                if data.get('type') == 'music' or 'track_title' in data:
                    results.add_result("Send Music Message", True, response.status_code, data)
                else:
                    results.add_result("Send Music Message", False, response.status_code,
                                     error="Should be music message with metadata")
            else:
                results.add_result("Send Music Message", False, response.status_code, error=response.text)
                
        except Exception as e:
            results.add_result("Send Music Message", False, error=str(e))
        
        # Test 13: Create Task from Message
        if message_id:
            print(f"\n13. ✅ Testing: Create Task from Message (ID: {message_id})")
            try:
                response = await client.post(
                    f"{API_BASE}/messages/create-task",
                    json={
                        "telegram_id": 55555,
                        "message_id": message_id
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('success') is True and data.get('task_id'):
                        results.add_result("Create Task from Message", True, response.status_code, data)
                    else:
                        results.add_result("Create Task from Message", False, response.status_code,
                                         error="Should return success=true and task_id")
                else:
                    results.add_result("Create Task from Message", False, response.status_code, error=response.text)
                    
            except Exception as e:
                results.add_result("Create Task from Message", False, error=str(e))
        else:
            results.add_result("Create Task from Message", False, error="No message_id from previous test")
        
        # Test 14: Check Old Endpoints
        print(f"\n14. 🔄 Testing: Old Endpoints Check")
        
        # Test 14a: Unread messages
        try:
            response = await client.get(f"{API_BASE}/messages/unread/55555")
            
            if response.status_code == 200:
                data = response.json()
                if 'total_unread' in data:
                    results.add_result("Old Endpoint - Unread Messages", True, response.status_code, data)
                else:
                    results.add_result("Old Endpoint - Unread Messages", False, response.status_code,
                                     error="Should contain total_unread field")
            else:
                results.add_result("Old Endpoint - Unread Messages", False, response.status_code, error=response.text)
                
        except Exception as e:
            results.add_result("Old Endpoint - Unread Messages", False, error=str(e))
        
        # Test 14b: Conversations list
        try:
            response = await client.get(f"{API_BASE}/messages/conversations/55555")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, dict) and 'conversations' in data:
                    results.add_result("Old Endpoint - Conversations List", True, response.status_code, data)
                else:
                    results.add_result("Old Endpoint - Conversations List", False, response.status_code,
                                     error="Should contain conversations field")
            else:
                results.add_result("Old Endpoint - Conversations List", False, response.status_code, error=response.text)
                
        except Exception as e:
            results.add_result("Old Endpoint - Conversations List", False, error=str(e))
    
    # Print Summary
    print("\n" + "=" * 60)
    print("🏁 NEW MESSAGING API ENDPOINTS TEST SUMMARY")
    print("=" * 60)
    
    summary = results.get_summary()
    print(f"Total Tests: {summary['total']}")
    print(f"Passed: {summary['passed']} ✅")
    print(f"Failed: {summary['failed']} ❌")
    print(f"Success Rate: {summary['success_rate']}")
    
    # Print failed tests details
    if results.failed > 0:
        print(f"\n❌ FAILED TESTS DETAILS:")
        for result in results.results:
            if not result['passed']:
                print(f"  • {result['test']}: {result['error']} (Status: {result['status_code']})")
    
    return results

if __name__ == "__main__":
    asyncio.run(test_new_messaging_endpoints())