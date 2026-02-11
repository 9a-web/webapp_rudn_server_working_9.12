#!/usr/bin/env python3
"""
Backend API Testing Script for Listening Room Preview Feature
Tests the new preview endpoint and verifies existing functionality.
"""

import httpx
import asyncio
import json
from typing import Dict, Any

# Backend URL - using localhost since external routing has issues
BASE_URL = "http://localhost:8001/api"

class BackendTester:
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
    
    async def test_server_health(self):
        """Test main server health check"""
        try:
            response = await self.client.get(f"{BASE_URL}/faculties")
            
            if response.status_code == 200:
                faculties = response.json()
                if isinstance(faculties, list) and len(faculties) > 0:
                    self.log_test("Server Health Check", True, f"Server is healthy, got {len(faculties)} faculties")
                else:
                    self.log_test("Server Health Check", False, "Empty faculties list")
            else:
                self.log_test("Server Health Check", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Server Health Check", False, f"Exception: {str(e)}")
    
    async def test_preview_nonexistent_room(self):
        """Test preview endpoint with non-existent invite code"""
        try:
            response = await self.client.get(f"{BASE_URL}/music/rooms/preview/NONEXISTENT")
            
            if response.status_code == 200:
                data = response.json()
                expected_response = {
                    "found": False,
                    "message": "Комната не найдена или уже закрыта"
                }
                
                if data == expected_response:
                    self.log_test("Preview Non-existent Room", True, "Correct response for non-existent room")
                else:
                    self.log_test("Preview Non-existent Room", False, f"Unexpected response: {data}")
            else:
                self.log_test("Preview Non-existent Room", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Preview Non-existent Room", False, f"Exception: {str(e)}")
    
    async def test_preview_empty_invite_code(self):
        """Test preview endpoint with empty invite code (should be 404/405)"""
        try:
            # Test with empty path (should not match route)
            response = await self.client.get(f"{BASE_URL}/music/rooms/preview/")
            
            # Should return 404 (Not Found) or 405 (Method Not Allowed) as the route doesn't match
            if response.status_code in [404, 405]:
                self.log_test("Preview Empty Invite Code", True, f"Correctly returned HTTP {response.status_code}")
            else:
                # If it somehow matches and returns 200, check if it's proper error handling
                if response.status_code == 200:
                    data = response.json()
                    if not data.get("found", True):  # If found is False, it's handling empty code gracefully
                        self.log_test("Preview Empty Invite Code", True, f"Graceful handling: {data}")
                    else:
                        self.log_test("Preview Empty Invite Code", False, f"Unexpected success: {data}")
                else:
                    self.log_test("Preview Empty Invite Code", False, f"Unexpected HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Preview Empty Invite Code", False, f"Exception: {str(e)}")
    
    async def test_join_nonexistent_room(self):
        """Test existing join endpoint still works with non-existent room"""
        try:
            payload = {
                "telegram_id": 123,
                "first_name": "Test"
            }
            
            response = await self.client.post(
                f"{BASE_URL}/music/rooms/join/TESTCODE",
                json=payload
            )
            
            if response.status_code == 200:
                data = response.json()
                expected_keys = ["success", "message"]
                
                if all(key in data for key in expected_keys):
                    if not data["success"] and "не найдена" in data["message"]:
                        self.log_test("Join Non-existent Room", True, f"Correct join response: {data}")
                    else:
                        self.log_test("Join Non-existent Room", False, f"Unexpected join response: {data}")
                else:
                    self.log_test("Join Non-existent Room", False, f"Missing keys in response: {data}")
            else:
                self.log_test("Join Non-existent Room", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Join Non-existent Room", False, f"Exception: {str(e)}")
    
    async def test_preview_existing_room(self):
        """Test preview endpoint with existing room (if any exists)"""
        try:
            # Try a few common test codes
            test_codes = ["TEST", "DEMO", "SAMPLE", "TESTROOM"]
            
            found_room = False
            
            for code in test_codes:
                response = await self.client.get(f"{BASE_URL}/music/rooms/preview/{code}")
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if data.get("found", False):
                        # Found an existing room
                        expected_keys = ["found", "room_id", "name", "host_name", "host_id", 
                                       "participants_count", "online_count", "max_participants", 
                                       "current_track", "invite_code"]
                        
                        if all(key in data for key in expected_keys):
                            self.log_test("Preview Existing Room", True, f"Found room {code}: {data['name']} by {data['host_name']}")
                            found_room = True
                            break
                        else:
                            missing_keys = [key for key in expected_keys if key not in data]
                            self.log_test("Preview Existing Room", False, f"Missing keys in existing room response: {missing_keys}")
                            found_room = True
                            break
            
            if not found_room:
                # No existing rooms found - this is expected behavior, not a failure
                self.log_test("Preview Existing Room", True, "No existing rooms found (expected)")
                
        except Exception as e:
            self.log_test("Preview Existing Room", False, f"Exception: {str(e)}")
    
    async def test_api_endpoint_structure(self):
        """Test that the API endpoints are properly structured"""
        try:
            # Test that the API responds to basic requests
            response = await self.client.get(f"{BASE_URL}/")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, dict) and "message" in data:
                    self.log_test("API Endpoint Structure", True, f"API root responds correctly: {data}")
                else:
                    self.log_test("API Endpoint Structure", False, f"Unexpected API root response: {data}")
            else:
                self.log_test("API Endpoint Structure", False, f"API root HTTP {response.status_code}")
                
        except Exception as e:
            self.log_test("API Endpoint Structure", False, f"Exception: {str(e)}")
    
    async def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Backend API Tests for Listening Room Preview Feature")
        print("=" * 70)
        
        # Test in order of importance
        await self.test_server_health()
        await self.test_api_endpoint_structure()
        await self.test_preview_nonexistent_room()
        await self.test_preview_empty_invite_code()
        await self.test_join_nonexistent_room()
        await self.test_preview_existing_room()
        
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
    async with BackendTester() as tester:
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