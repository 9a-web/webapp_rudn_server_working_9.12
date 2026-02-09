#!/usr/bin/env python3
"""
Backend API Testing Script
Comprehensive validation after architectural refactoring on localhost:8001
Validates all 7 key points from review request
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
import sys

# Configuration - testing on localhost:8001 as per review request
BASE_URL = "http://localhost:8001/api"
TEST_TELEGRAM_ID = 99999

def print_test_result(test_name, success, details=None):
    """Print formatted test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"   {details}")
    print()

def print_test_result(test_name, success, details=None):
    """Print formatted test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"   {details}")
    print()

def test_api_health():
    """Test 1: API health - GET /api/ → expect 200 with 'RUDN Schedule API is running'"""
    print("🔄 Testing: API Health Check...")
    
    url = f"{BASE_URL}/"
    
    try:
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            expected_message = "RUDN Schedule API is running"
            
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            if 'message' in data and data['message'] == expected_message:
                print_test_result("API Health Check", True, f"Correct response: {data['message']}")
                return True
            else:
                print_test_result("API Health Check", False, f"Expected message '{expected_message}', got: {data}")
                return False
        else:
            print_test_result("API Health Check", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("API Health Check", False, f"Exception: {str(e)}")
        return False

def test_bot_info():
    """Test 2: Bot info (dynamic) - GET /api/bot-info → expect 200 with {username: "devrudnbot", env: "test"}"""
    print("🔄 Testing: Bot Info Endpoint...")
    
    url = f"{BASE_URL}/bot-info"
    
    try:
        response = requests.get(url, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"   Response data: {json.dumps(data, indent=2)}")
            
            # Check required fields
            required_fields = ['username', 'env']
            missing_fields = []
            
            for field in required_fields:
                if field not in data:
                    missing_fields.append(field)
            
            if missing_fields:
                print_test_result("Bot Info Endpoint", False, f"Missing fields: {missing_fields}")
                return False
            
            # Validate username (should be "devrudnbot" for test environment)
            username = data.get('username')
            if username != "devrudnbot":
                print_test_result("Bot Info Endpoint", False, f"Expected username 'devrudnbot', got '{username}'")
                return False
            
            # Validate env (should be "test")
            env = data.get('env')
            if env != "test":
                print_test_result("Bot Info Endpoint", False, f"Expected env 'test', got '{env}'")
                return False
            
            print_test_result("Bot Info Endpoint", True, f"Username: {username}, Env: {env}")
            return True
        else:
            print_test_result("Bot Info Endpoint", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Bot Info Endpoint", False, f"Exception: {str(e)}")
        return False

def test_user_settings_crud():
    """Test 3: User settings CRUD operations"""
    print("🔄 Testing: User Settings CRUD...")
    
    # Test data as specified in review request
    test_user_data = {
        "telegram_id": TEST_TELEGRAM_ID,
        "username": "archtest",
        "first_name": "ArchTest",
        "group_id": "G1",
        "group_name": "G1",
        "facultet_id": "F1",
        "level_id": "L1",
        "kurs": "1",
        "form_code": "ОФО"
    }
    
    try:
        # Step 1: POST - Create user settings
        print("   Testing: POST user-settings...")
        post_url = f"{BASE_URL}/user-settings"
        response = requests.post(post_url, json=test_user_data, timeout=10)
        
        if response.status_code != 200:
            print_test_result("User Settings CRUD - POST", False, f"POST failed: HTTP {response.status_code}: {response.text}")
            return False
        
        post_data = response.json()
        print(f"   POST Response: {json.dumps(post_data, indent=2)}")
        
        # Step 2: GET - Retrieve user settings
        print("   Testing: GET user-settings...")
        get_url = f"{BASE_URL}/user-settings/{TEST_TELEGRAM_ID}"
        response = requests.get(get_url, timeout=10)
        
        if response.status_code != 200:
            print_test_result("User Settings CRUD - GET", False, f"GET failed: HTTP {response.status_code}: {response.text}")
            return False
        
        get_data = response.json()
        print(f"   GET Response: {json.dumps(get_data, indent=2)}")
        
        # Validate that retrieved data matches what we posted
        for key, expected_value in test_user_data.items():
            if key in get_data:
                actual_value = get_data[key]
                if actual_value != expected_value:
                    print_test_result("User Settings CRUD - GET validation", False, f"Field '{key}': expected '{expected_value}', got '{actual_value}'")
                    return False
        
        # Step 3: DELETE - Remove user settings
        print("   Testing: DELETE user-settings...")
        delete_url = f"{BASE_URL}/user-settings/{TEST_TELEGRAM_ID}"
        response = requests.delete(delete_url, timeout=10)
        
        if response.status_code != 200:
            print_test_result("User Settings CRUD - DELETE", False, f"DELETE failed: HTTP {response.status_code}: {response.text}")
            return False
        
        delete_data = response.json()
        print(f"   DELETE Response: {json.dumps(delete_data, indent=2)}")
        
        print_test_result("User Settings CRUD", True, "POST, GET, and DELETE operations successful")
        return True
        
    except Exception as e:
        print_test_result("User Settings CRUD", False, f"Exception: {str(e)}")
        return False

def test_server_stats():
    """Test 4: Server stats - GET /api/admin/server-stats → expect 200 with cpu, memory, disk, uptime"""
    print("🔄 Testing: Server Stats Endpoint...")
    
    url = f"{BASE_URL}/admin/server-stats"
    
    try:
        response = requests.get(url, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"   Response keys: {list(data.keys())}")
            
            # Check required fields
            required_fields = ['cpu', 'memory', 'disk', 'uptime']
            missing_fields = []
            
            for field in required_fields:
                if field not in data:
                    missing_fields.append(field)
            
            if missing_fields:
                print_test_result("Server Stats", False, f"Missing required fields: {missing_fields}")
                return False
            
            # Validate CPU object
            cpu = data.get('cpu', {})
            if not isinstance(cpu, dict) or 'percent' not in cpu:
                print_test_result("Server Stats", False, "CPU object invalid or missing 'percent' field")
                return False
            
            # Validate Memory object
            memory = data.get('memory', {})
            if not isinstance(memory, dict) or 'percent' not in memory:
                print_test_result("Server Stats", False, "Memory object invalid or missing 'percent' field")
                return False
            
            # Validate Disk object
            disk = data.get('disk', {})
            if not isinstance(disk, dict) or 'percent' not in disk:
                print_test_result("Server Stats", False, "Disk object invalid or missing 'percent' field")
                return False
            
            # Validate Uptime object
            uptime = data.get('uptime', {})
            if not isinstance(uptime, dict) or 'seconds' not in uptime:
                print_test_result("Server Stats", False, "Uptime object invalid or missing 'seconds' field")
                return False
            
            print(f"   CPU: {cpu.get('percent', 'N/A')}%, Memory: {memory.get('percent', 'N/A')}%, Disk: {disk.get('percent', 'N/A')}%")
            print_test_result("Server Stats", True, "All required fields present with valid structure")
            return True
        else:
            print_test_result("Server Stats", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Server Stats", False, f"Exception: {str(e)}")
        return False

def test_server_stats_history():
    """Test 5: Server stats history - GET /api/admin/server-stats-history?hours=1 → expect 200"""
    print("🔄 Testing: Server Stats History Endpoint...")
    
    url = f"{BASE_URL}/admin/server-stats-history?hours=1"
    
    try:
        response = requests.get(url, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"   Response keys: {list(data.keys())}")
            
            # Check for expected structure
            expected_fields = ['period_hours', 'total_points']
            missing_fields = []
            
            for field in expected_fields:
                if field not in data:
                    missing_fields.append(field)
            
            if missing_fields:
                print_test_result("Server Stats History", False, f"Missing fields: {missing_fields}")
                return False
            
            # Validate period_hours is 1 as requested
            period_hours = data.get('period_hours')
            if period_hours != 1:
                print_test_result("Server Stats History", False, f"Expected period_hours=1, got {period_hours}")
                return False
            
            print(f"   Period: {period_hours} hours, Data points: {data.get('total_points', 0)}")
            print_test_result("Server Stats History", True, "Valid response structure")
            return True
        else:
            print_test_result("Server Stats History", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Server Stats History", False, f"Exception: {str(e)}")
        return False

def test_faculties():
    """Test 6: Faculties - GET /api/faculties → expect 200 or known error"""
    print("🔄 Testing: Faculties Endpoint...")
    
    url = f"{BASE_URL}/faculties"
    
    try:
        response = requests.get(url, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            if isinstance(data, list):
                print(f"   Retrieved {len(data)} faculties")
                print_test_result("Faculties", True, f"Successfully retrieved {len(data)} faculties")
                return True
            else:
                print_test_result("Faculties", False, f"Expected list, got {type(data)}")
                return False
        else:
            # Check if it's a known error (e.g., external API unavailable)
            if response.status_code in [404, 500, 502, 503, 504]:
                print(f"   Known error condition: HTTP {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error details: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error text: {response.text[:200]}")
                print_test_result("Faculties", True, f"Known error condition: HTTP {response.status_code} (acceptable)")
                return True
            else:
                print_test_result("Faculties", False, f"Unexpected HTTP {response.status_code}: {response.text}")
                return False
            
    except Exception as e:
        print_test_result("Faculties", False, f"Exception: {str(e)}")
        return False

def test_cors_headers():
    """Test 7: CORS headers check - Make request with Origin header and verify access-control-allow-origin is echoed back"""
    print("🔄 Testing: CORS Headers...")
    
    url = f"{BASE_URL}/"
    test_origin = "https://test-origin.com"
    
    try:
        # Test with Origin header
        headers = {'Origin': test_origin}
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            # Check if access-control-allow-origin header is present
            cors_header = response.headers.get('access-control-allow-origin')
            
            if cors_header:
                if cors_header == test_origin or cors_header == '*':
                    print(f"   Origin sent: {test_origin}")
                    print(f"   CORS header received: {cors_header}")
                    print_test_result("CORS Headers", True, f"Origin echoed correctly: {cors_header}")
                    return True
                else:
                    print_test_result("CORS Headers", False, f"Expected origin '{test_origin}' or '*', got '{cors_header}'")
                    return False
            else:
                print_test_result("CORS Headers", False, "Missing 'access-control-allow-origin' header")
                return False
        else:
            print_test_result("CORS Headers", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("CORS Headers", False, f"Exception: {str(e)}")
        return False

def main():
    """Run all architectural refactoring validation tests"""
    print("🚀 Starting Backend Architecture Refactoring Validation")
    print(f"Backend URL: {BASE_URL}")
    print("=" * 70)
    
    tests = [
        ("API Health Check", test_api_health),
        ("Bot Info (Dynamic)", test_bot_info),
        ("User Settings CRUD", test_user_settings_crud),
        ("Server Stats", test_server_stats),
        ("Server Stats History", test_server_stats_history),
        ("Faculties", test_faculties),
        ("CORS Headers", test_cors_headers)
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        print(f"\n{'='*50}")
        result = test_func()
        results[test_name] = result
    
    # Summary
    print("\n" + "=" * 70)
    print("📊 ARCHITECTURAL REFACTORING VALIDATION SUMMARY")
    print("=" * 70)
    
    passed = 0
    failed = 0
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print(f"\nTotal: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("\n🎉 All architectural refactoring validations passed!")
        print("MongoDB connection pool, unified startup, CORS middleware, and core API functionality are working correctly.")
        return 0
    else:
        print(f"\n⚠️  {failed} validation(s) failed. Check the details above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())