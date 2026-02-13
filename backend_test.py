#!/usr/bin/env python3
"""
Backend API Testing Script for MongoDB Resilience and Health-Check Features
Tests the MongoDB resilience features and health check endpoints.
"""

import httpx
import asyncio
import json
from typing import Dict, Any, Optional

# Backend URL - using localhost as external URL is not available
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
    
    async def test_health_check_mongodb_running(self):
        """Test 1: Health Check (MongoDB running) - GET /api/health"""
        try:
            response = await self.client.get(f"{BASE_URL}/health")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify required fields
                if (data.get("status") == "healthy" and 
                    data.get("mongodb", {}).get("connected") is True and
                    isinstance(data.get("mongodb", {}).get("latency_ms"), (int, float))):
                    self.log_test("Health Check (MongoDB Running)", True, 
                                f"Status: {data['status']}, MongoDB connected: {data['mongodb']['connected']}, "
                                f"Latency: {data['mongodb']['latency_ms']}ms")
                else:
                    self.log_test("Health Check (MongoDB Running)", False, 
                                f"Unexpected response structure: {data}")
            else:
                self.log_test("Health Check (MongoDB Running)", False, 
                            f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Health Check (MongoDB Running)", False, f"Exception: {str(e)}")
    
    async def test_root_endpoint(self):
        """Test 2: Root endpoint still works - GET /api/"""
        try:
            response = await self.client.get(f"{BASE_URL}/")
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("message") == "RUDN Schedule API is running":
                    self.log_test("Root Endpoint", True, f"Root endpoint working: {data}")
                else:
                    self.log_test("Root Endpoint", False, f"Unexpected message: {data}")
            else:
                self.log_test("Root Endpoint", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Root Endpoint", False, f"Exception: {str(e)}")
    
    async def test_bot_info_endpoint(self):
        """Test 3: Bot info endpoint - GET /api/bot-info"""
        try:
            response = await self.client.get(f"{BASE_URL}/bot-info")
            
            if response.status_code == 200:
                data = response.json()
                
                if "username" in data and "env" in data:
                    self.log_test("Bot Info Endpoint", True, 
                                f"Bot info: username={data.get('username')}, env={data.get('env')}")
                else:
                    self.log_test("Bot Info Endpoint", False, 
                                f"Missing username or env fields: {data}")
            else:
                self.log_test("Bot Info Endpoint", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Bot Info Endpoint", False, f"Exception: {str(e)}")
    
    async def test_faculties_endpoint(self):
        """Test 4: Faculties endpoint (external API, no DB) - GET /api/faculties"""
        try:
            response = await self.client.get(f"{BASE_URL}/faculties")
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list):
                    self.log_test("Faculties Endpoint", True, 
                                f"Faculties endpoint working, returned {len(data)} faculties")
                else:
                    self.log_test("Faculties Endpoint", False, 
                                f"Expected array, got: {type(data).__name__}")
            else:
                self.log_test("Faculties Endpoint", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Faculties Endpoint", False, f"Exception: {str(e)}")
    
    async def test_status_endpoint(self):
        """Test 5: Status endpoint (DB-dependent) - GET /api/status"""
        try:
            response = await self.client.get(f"{BASE_URL}/status")
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list):
                    self.log_test("Status Endpoint", True, 
                                f"Status endpoint working, returned {len(data)} status checks")
                else:
                    self.log_test("Status Endpoint", False, 
                                f"Expected array, got: {type(data).__name__}")
            else:
                self.log_test("Status Endpoint", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Status Endpoint", False, f"Exception: {str(e)}")
    
    async def test_health_check_response_structure(self):
        """Test 6: Health check response structure verification"""
        try:
            response = await self.client.get(f"{BASE_URL}/health")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check main keys
                required_keys = ["status", "timestamp", "mongodb", "watchdog"]
                missing_keys = [key for key in required_keys if key not in data]
                
                # Check mongodb sub-keys
                mongodb_keys = ["connected", "latency_ms", "error", "url_host"]
                mongodb_data = data.get("mongodb", {})
                missing_mongodb_keys = [key for key in mongodb_keys if key not in mongodb_data]
                
                # Check watchdog sub-keys
                watchdog_keys = ["healthy", "last_error", "last_check_ago_s"]
                watchdog_data = data.get("watchdog", {})
                missing_watchdog_keys = [key for key in watchdog_keys if key not in watchdog_data]
                
                if not missing_keys and not missing_mongodb_keys and not missing_watchdog_keys:
                    self.log_test("Health Check Response Structure", True, 
                                "All required fields present in health check response")
                else:
                    missing_info = []
                    if missing_keys:
                        missing_info.append(f"main keys: {missing_keys}")
                    if missing_mongodb_keys:
                        missing_info.append(f"mongodb keys: {missing_mongodb_keys}")
                    if missing_watchdog_keys:
                        missing_info.append(f"watchdog keys: {missing_watchdog_keys}")
                    
                    self.log_test("Health Check Response Structure", False, 
                                f"Missing fields: {', '.join(missing_info)}")
            else:
                self.log_test("Health Check Response Structure", False, 
                            f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Health Check Response Structure", False, f"Exception: {str(e)}")
    
    async def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting MongoDB Resilience and Health-Check Backend Tests")
        print("=" * 70)
        
        # Test in order specified in review request
        await self.test_health_check_mongodb_running()
        await self.test_root_endpoint()
        await self.test_bot_info_endpoint()
        await self.test_faculties_endpoint()
        await self.test_status_endpoint()
        await self.test_health_check_response_structure()
        
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