#!/usr/bin/env python3
"""
Backend Test for SSE (Server-Sent Events) Friend Events System
Testing the SSE friend events system on http://localhost:8001
"""
import asyncio
import json
import requests
import time
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any
import urllib3

# Disable SSL warnings for localhost
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class SSEClient:
    """SSE Client for testing Server-Sent Events"""
    
    def __init__(self, url: str):
        self.url = url
        self.events = []
        self.running = False
        self.thread = None
        
    def start_listening(self, timeout: int = 30):
        """Start listening to SSE stream with timeout"""
        self.running = True
        self.thread = threading.Thread(target=self._listen, args=(timeout,))
        self.thread.start()
        # Give a moment for connection to establish
        time.sleep(1)
        
    def _listen(self, timeout: int):
        """Listen to SSE stream"""
        try:
            response = requests.get(
                self.url,
                stream=True,
                timeout=timeout,
                headers={'Accept': 'text/event-stream'}
            )
            
            for line in response.iter_lines(decode_unicode=True):
                if not self.running:
                    break
                    
                if line and line.startswith('data: '):
                    try:
                        data = json.loads(line[6:])  # Remove 'data: ' prefix
                        self.events.append(data)
                        print(f"SSE Event received: {data}")
                    except json.JSONDecodeError as e:
                        print(f"Failed to parse SSE event: {line}, error: {e}")
                        
        except requests.RequestException as e:
            if self.running:  # Only log if we're still supposed to be running
                print(f"SSE Connection error: {e}")
                
    def stop_listening(self):
        """Stop listening to SSE stream"""
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2)
            
    def get_events(self) -> List[Dict[str, Any]]:
        """Get all received events"""
        return self.events.copy()
    
    def wait_for_event(self, event_type: str, timeout: int = 10) -> Dict[str, Any]:
        """Wait for a specific event type"""
        start_time = time.time()
        while time.time() - start_time < timeout:
            for event in self.events:
                if event.get('type') == event_type:
                    return event
            time.sleep(0.1)
        return None

class BackendTester:
    """Backend tester for SSE friend events system"""
    
    def __init__(self):
        self.base_url = "http://localhost:8001/api"
        self.test_results = []
        self.session = requests.Session()
        
    def log_result(self, test_name: str, passed: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASSED" if passed else "❌ FAILED"
        result = f"{status}: {test_name}"
        if details:
            result += f" - {details}"
        print(result)
        self.test_results.append({
            "test": test_name,
            "passed": passed,
            "details": details
        })
        
    def make_request(self, method: str, endpoint: str, data: Dict = None, timeout: int = 10) -> requests.Response:
        """Make HTTP request to backend"""
        url = f"{self.base_url}{endpoint}"
        try:
            if method.upper() == "GET":
                return self.session.get(url, timeout=timeout)
            elif method.upper() == "POST":
                return self.session.post(url, json=data, timeout=timeout)
            elif method.upper() == "DELETE":
                return self.session.delete(url, json=data, timeout=timeout)
            else:
                raise ValueError(f"Unsupported method: {method}")
        except Exception as e:
            print(f"Request error for {method} {url}: {e}")
            raise
            
    def create_test_user(self, telegram_id: int, username: str, first_name: str) -> bool:
        """Create a test user"""
        try:
            response = self.make_request("POST", "/user-settings", {
                "telegram_id": telegram_id,
                "username": username,
                "first_name": first_name,
                "group_id": "G1",
                "group_name": "Группа1",
                "facultet_id": "F1",
                "level_id": "L1",
                "kurs": "1",
                "form_code": "ОФО"
            })
            
            if response.status_code in [200, 201]:
                print(f"✅ User {telegram_id} ({username}) created/updated successfully")
                return True
            else:
                print(f"❌ Failed to create user {telegram_id}: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error creating user {telegram_id}: {e}")
            return False
            
    def test_sse_connection(self):
        """Test 1: SSE Connection - should start with connected event"""
        print("\n=== Test 1: SSE Connection ===")
        
        try:
            # Start SSE client
            sse_client = SSEClient(f"{self.base_url}/friends/events/77777")
            sse_client.start_listening(timeout=5)
            
            # Wait for connected event
            time.sleep(2)
            events = sse_client.get_events()
            sse_client.stop_listening()
            
            # Check if we got the connected event
            if events and len(events) > 0:
                first_event = events[0]
                if first_event.get('type') == 'connected':
                    self.log_result("SSE Connection", True, "Connected event received successfully")
                    return True
                else:
                    self.log_result("SSE Connection", False, f"Expected 'connected' event, got: {first_event}")
                    return False
            else:
                self.log_result("SSE Connection", False, "No events received from SSE stream")
                return False
                
        except Exception as e:
            self.log_result("SSE Connection", False, f"Error: {e}")
            return False
            
    def test_sse_friend_request_events(self):
        """Test 2: SSE events on friend request"""
        print("\n=== Test 2: SSE Friend Request Events ===")
        
        try:
            # Step 1: Create test users
            user1_created = self.create_test_user(333333, "ssetest1", "SSETest1")
            user2_created = self.create_test_user(444444, "ssetest2", "SSETest2")
            
            if not (user1_created and user2_created):
                self.log_result("Friend Request Events Setup", False, "Failed to create test users")
                return False
                
            # Step 2: Start SSE listening for user 444444 (receiver)
            sse_client = SSEClient(f"{self.base_url}/friends/events/444444")
            sse_client.start_listening(timeout=15)
            
            # Wait for connected event
            time.sleep(1)
            
            # Step 3: Send friend request from 333333 to 444444
            response = self.make_request("POST", "/friends/request/444444", {"telegram_id": 333333})
            
            if response.status_code not in [200, 201]:
                sse_client.stop_listening()
                self.log_result("Friend Request Send", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
            # Step 4: Wait for friend_request_received event
            time.sleep(2)
            friend_request_event = sse_client.wait_for_event("friend_request_received", timeout=5)
            sse_client.stop_listening()
            
            if friend_request_event:
                expected_data = friend_request_event.get('data', {})
                if expected_data.get('from_telegram_id') == 333333:
                    self.log_result("Friend Request Events", True, "friend_request_received event received correctly")
                    return True
                else:
                    self.log_result("Friend Request Events", False, f"Event data incorrect: {expected_data}")
                    return False
            else:
                all_events = sse_client.get_events()
                self.log_result("Friend Request Events", False, f"friend_request_received event not received. All events: {all_events}")
                return False
                
        except Exception as e:
            self.log_result("Friend Request Events", False, f"Error: {e}")
            return False
            
    def test_sse_accept_events(self):
        """Test 3: SSE events on accept"""
        print("\n=== Test 3: SSE Accept Events ===")
        
        try:
            # Step 1: Get friend requests for 444444
            response = self.make_request("GET", "/friends/444444/requests")
            
            if response.status_code != 200:
                self.log_result("Get Friend Requests", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
            requests_data = response.json()
            incoming_requests = requests_data.get('incoming', [])
            
            if not incoming_requests:
                self.log_result("Accept Events Setup", False, "No pending friend requests found")
                return False
                
            request_id = incoming_requests[0]['request_id']
            
            # Step 2: Start SSE for user 333333 (the sender)
            sse_client = SSEClient(f"{self.base_url}/friends/events/333333")
            sse_client.start_listening(timeout=15)
            
            # Wait for connected event
            time.sleep(1)
            
            # Step 3: Accept the request
            response = self.make_request("POST", f"/friends/accept/{request_id}", {"telegram_id": 444444})
            
            if response.status_code not in [200, 201]:
                sse_client.stop_listening()
                self.log_result("Friend Request Accept", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
            # Step 4: Wait for friend_request_accepted event
            time.sleep(2)
            accept_event = sse_client.wait_for_event("friend_request_accepted", timeout=5)
            sse_client.stop_listening()
            
            if accept_event:
                expected_data = accept_event.get('data', {})
                if expected_data.get('by_telegram_id') == 444444:
                    self.log_result("Accept Events", True, "friend_request_accepted event received correctly")
                    return True
                else:
                    self.log_result("Accept Events", False, f"Event data incorrect: {expected_data}")
                    return False
            else:
                all_events = sse_client.get_events()
                self.log_result("Accept Events", False, f"friend_request_accepted event not received. All events: {all_events}")
                return False
                
        except Exception as e:
            self.log_result("Accept Events", False, f"Error: {e}")
            return False
            
    def test_sse_remove_friend_events(self):
        """Test 4: SSE events on remove friend"""
        print("\n=== Test 4: SSE Remove Friend Events ===")
        
        try:
            # Step 1: Start SSE for user 444444
            sse_client = SSEClient(f"{self.base_url}/friends/events/444444")
            sse_client.start_listening(timeout=15)
            
            # Wait for connected event
            time.sleep(1)
            
            # Step 2: Remove friend - DELETE /api/friends/444444 with {"telegram_id": 333333}
            response = self.make_request("DELETE", "/friends/444444", {"telegram_id": 333333})
            
            if response.status_code not in [200, 201]:
                sse_client.stop_listening()
                self.log_result("Remove Friend", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
            # Step 3: Wait for friend_removed event
            time.sleep(2)
            remove_event = sse_client.wait_for_event("friend_removed", timeout=5)
            sse_client.stop_listening()
            
            if remove_event:
                expected_data = remove_event.get('data', {})
                if expected_data.get('by_telegram_id') == 333333:
                    self.log_result("Remove Friend Events", True, "friend_removed event received correctly")
                    return True
                else:
                    self.log_result("Remove Friend Events", False, f"Event data incorrect: {expected_data}")
                    return False
            else:
                all_events = sse_client.get_events()
                self.log_result("Remove Friend Events", False, f"friend_removed event not received. All events: {all_events}")
                return False
                
        except Exception as e:
            self.log_result("Remove Friend Events", False, f"Error: {e}")
            return False
            
    def run_all_tests(self):
        """Run all SSE tests"""
        print("🚀 Starting SSE Friend Events System Tests")
        print(f"Backend URL: {self.base_url}")
        
        tests = [
            self.test_sse_connection,
            self.test_sse_friend_request_events,
            self.test_sse_accept_events,
            self.test_sse_remove_friend_events
        ]
        
        passed_tests = 0
        
        for test in tests:
            try:
                if test():
                    passed_tests += 1
                time.sleep(1)  # Brief pause between tests
            except Exception as e:
                print(f"❌ Test failed with exception: {e}")
                
        print(f"\n📊 Test Results: {passed_tests}/{len(tests)} tests passed")
        
        if passed_tests == len(tests):
            print("🎉 ALL TESTS PASSED!")
            return True
        else:
            print("❌ Some tests failed")
            return False
            
    def print_summary(self):
        """Print detailed test summary"""
        print("\n" + "="*50)
        print("📋 DETAILED TEST SUMMARY")
        print("="*50)
        
        for result in self.test_results:
            status = "✅" if result["passed"] else "❌"
            print(f"{status} {result['test']}")
            if result["details"]:
                print(f"   └─ {result['details']}")
                
        passed = sum(1 for r in self.test_results if r["passed"])
        total = len(self.test_results)
        success_rate = (passed / total * 100) if total > 0 else 0
        
        print(f"\n📊 Overall Results: {passed}/{total} ({success_rate:.1f}%)")
        
        return passed == total

def main():
    """Main test execution"""
    print("=" * 60)
    print("🧪 SSE FRIEND EVENTS SYSTEM TEST SUITE")
    print("=" * 60)
    
    tester = BackendTester()
    
    try:
        success = tester.run_all_tests()
        tester.print_summary()
        
        if success:
            print("\n🎉 ALL SSE TESTS COMPLETED SUCCESSFULLY!")
        else:
            print("\n⚠️  SOME SSE TESTS FAILED - CHECK LOGS ABOVE")
            
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
    except Exception as e:
        print(f"\n❌ Critical error during testing: {e}")
        
if __name__ == "__main__":
    main()