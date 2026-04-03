#!/usr/bin/env python3
"""
Backend API Testing for RUDN Schedule Telegram Web App - Graffiti Feature
Tests the graffiti endpoints as specified in the review request.
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend/.env
BACKEND_URL = "https://rudn-server-2.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

# Test user IDs
TEST_USER_ID = 12345
NON_EXISTENT_USER_ID = 9999999
WRONG_REQUESTER_ID = 99999

# Test data
VALID_GRAFFITI_DATA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
INVALID_GRAFFITI_DATA = "not_a_data_url"

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def add_pass(self, test_name):
        self.passed += 1
        print(f"✅ {test_name}")
    
    def add_fail(self, test_name, error):
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
        print(f"❌ {test_name}: {error}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n📊 Test Summary: {self.passed}/{total} passed")
        if self.errors:
            print("\n🔍 Failed Tests:")
            for error in self.errors:
                print(f"  - {error}")
        return self.failed == 0

def make_request(method, endpoint, data=None, expected_status=200):
    """Make HTTP request and return response"""
    url = f"{API_BASE}{endpoint}"
    headers = {"Content-Type": "application/json"}
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, timeout=30)
        elif method == "PUT":
            response = requests.put(url, json=data, headers=headers, timeout=30)
        elif method == "DELETE":
            response = requests.delete(url, json=data, headers=headers, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return response
    except requests.exceptions.RequestException as e:
        raise Exception(f"Request failed: {e}")

def test_graffiti_endpoints():
    """Test all graffiti endpoints according to review request"""
    results = TestResults()
    
    print("🧪 Testing Graffiti Feature API Endpoints")
    print("=" * 50)
    
    # Test 1: Valid graffiti save
    print("\n1️⃣ Testing PUT /api/profile/{telegram_id}/graffiti - Valid save")
    try:
        data = {
            "graffiti_data": VALID_GRAFFITI_DATA,
            "requester_telegram_id": TEST_USER_ID
        }
        response = make_request("PUT", f"/profile/{TEST_USER_ID}/graffiti", data, 200)
        
        if response.status_code == 200:
            response_data = response.json()
            if response_data.get("success") and "graffiti_updated_at" in response_data:
                results.add_pass("Valid graffiti save")
            else:
                results.add_fail("Valid graffiti save", f"Invalid response format: {response_data}")
        else:
            results.add_fail("Valid graffiti save", f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        results.add_fail("Valid graffiti save", str(e))
    
    # Test 2: GET graffiti for existing user
    print("\n2️⃣ Testing GET /api/profile/{telegram_id}/graffiti - Existing user")
    try:
        response = make_request("GET", f"/profile/{TEST_USER_ID}/graffiti")
        
        if response.status_code == 200:
            response_data = response.json()
            if ("graffiti_data" in response_data and 
                "graffiti_updated_at" in response_data and
                response_data["graffiti_data"] == VALID_GRAFFITI_DATA):
                results.add_pass("GET graffiti for existing user")
            else:
                results.add_fail("GET graffiti for existing user", f"Invalid response: {response_data}")
        else:
            results.add_fail("GET graffiti for existing user", f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        results.add_fail("GET graffiti for existing user", str(e))
    
    # Test 3: Missing requester_telegram_id
    print("\n3️⃣ Testing PUT /api/profile/{telegram_id}/graffiti - Missing requester")
    try:
        data = {"graffiti_data": VALID_GRAFFITI_DATA}  # No requester_telegram_id
        response = make_request("PUT", f"/profile/{TEST_USER_ID}/graffiti", data)
        
        if response.status_code == 400:
            results.add_pass("Missing requester validation")
        else:
            results.add_fail("Missing requester validation", f"Expected 400, got {response.status_code}: {response.text}")
    except Exception as e:
        results.add_fail("Missing requester validation", str(e))
    
    # Test 4: Wrong requester_telegram_id
    print("\n4️⃣ Testing PUT /api/profile/{telegram_id}/graffiti - Wrong requester")
    try:
        data = {
            "graffiti_data": VALID_GRAFFITI_DATA,
            "requester_telegram_id": WRONG_REQUESTER_ID
        }
        response = make_request("PUT", f"/profile/{TEST_USER_ID}/graffiti", data)
        
        if response.status_code == 403:
            results.add_pass("Wrong requester authorization")
        else:
            results.add_fail("Wrong requester authorization", f"Expected 403, got {response.status_code}: {response.text}")
    except Exception as e:
        results.add_fail("Wrong requester authorization", str(e))
    
    # Test 5: Invalid graffiti format
    print("\n5️⃣ Testing PUT /api/profile/{telegram_id}/graffiti - Invalid format")
    try:
        data = {
            "graffiti_data": INVALID_GRAFFITI_DATA,
            "requester_telegram_id": TEST_USER_ID
        }
        response = make_request("PUT", f"/profile/{TEST_USER_ID}/graffiti", data)
        
        if response.status_code == 400:
            results.add_pass("Invalid format validation")
        else:
            results.add_fail("Invalid format validation", f"Expected 400, got {response.status_code}: {response.text}")
    except Exception as e:
        results.add_fail("Invalid format validation", str(e))
    
    # Test 6: Empty graffiti (should be allowed for clearing)
    print("\n6️⃣ Testing PUT /api/profile/{telegram_id}/graffiti - Empty graffiti")
    try:
        data = {
            "graffiti_data": "",
            "requester_telegram_id": TEST_USER_ID
        }
        response = make_request("PUT", f"/profile/{TEST_USER_ID}/graffiti", data, 200)
        
        if response.status_code == 200:
            response_data = response.json()
            if response_data.get("success"):
                results.add_pass("Empty graffiti allowed")
            else:
                results.add_fail("Empty graffiti allowed", f"Invalid response: {response_data}")
        else:
            results.add_fail("Empty graffiti allowed", f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        results.add_fail("Empty graffiti allowed", str(e))
    
    # Test 7: GET graffiti after clearing (should return empty)
    print("\n7️⃣ Testing GET /api/profile/{telegram_id}/graffiti - After clearing")
    try:
        response = make_request("GET", f"/profile/{TEST_USER_ID}/graffiti")
        
        if response.status_code == 200:
            response_data = response.json()
            if (response_data.get("graffiti_data") == "" and 
                "graffiti_updated_at" in response_data):
                results.add_pass("GET graffiti after clearing")
            else:
                results.add_fail("GET graffiti after clearing", f"Expected empty graffiti: {response_data}")
        else:
            results.add_fail("GET graffiti after clearing", f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        results.add_fail("GET graffiti after clearing", str(e))
    
    # Test 8: GET graffiti for non-existent user
    print("\n8️⃣ Testing GET /api/profile/{telegram_id}/graffiti - Non-existent user")
    try:
        response = make_request("GET", f"/profile/{NON_EXISTENT_USER_ID}/graffiti")
        
        if response.status_code == 200:
            response_data = response.json()
            if (response_data.get("graffiti_data") == "" and 
                response_data.get("graffiti_updated_at") is None):
                results.add_pass("GET graffiti for non-existent user")
            else:
                results.add_fail("GET graffiti for non-existent user", f"Expected empty response: {response_data}")
        else:
            results.add_fail("GET graffiti for non-existent user", f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        results.add_fail("GET graffiti for non-existent user", str(e))
    
    # Test 9: Set up graffiti for DELETE tests
    print("\n9️⃣ Setting up graffiti for DELETE tests")
    try:
        data = {
            "graffiti_data": VALID_GRAFFITI_DATA,
            "requester_telegram_id": TEST_USER_ID
        }
        response = make_request("PUT", f"/profile/{TEST_USER_ID}/graffiti", data, 200)
        
        if response.status_code == 200:
            results.add_pass("Setup graffiti for DELETE tests")
        else:
            results.add_fail("Setup graffiti for DELETE tests", f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        results.add_fail("Setup graffiti for DELETE tests", str(e))
    
    # Test 10: DELETE graffiti - Missing requester
    print("\n🔟 Testing DELETE /api/profile/{telegram_id}/graffiti - Missing requester")
    try:
        data = {}  # No requester_telegram_id
        response = make_request("DELETE", f"/profile/{TEST_USER_ID}/graffiti", data)
        
        if response.status_code == 400:
            results.add_pass("DELETE missing requester validation")
        else:
            results.add_fail("DELETE missing requester validation", f"Expected 400, got {response.status_code}: {response.text}")
    except Exception as e:
        results.add_fail("DELETE missing requester validation", str(e))
    
    # Test 11: DELETE graffiti - Wrong requester
    print("\n1️⃣1️⃣ Testing DELETE /api/profile/{telegram_id}/graffiti - Wrong requester")
    try:
        data = {"requester_telegram_id": WRONG_REQUESTER_ID}
        response = make_request("DELETE", f"/profile/{TEST_USER_ID}/graffiti", data)
        
        if response.status_code == 403:
            results.add_pass("DELETE wrong requester authorization")
        else:
            results.add_fail("DELETE wrong requester authorization", f"Expected 403, got {response.status_code}: {response.text}")
    except Exception as e:
        results.add_fail("DELETE wrong requester authorization", str(e))
    
    # Test 12: DELETE graffiti - Valid delete
    print("\n1️⃣2️⃣ Testing DELETE /api/profile/{telegram_id}/graffiti - Valid delete")
    try:
        data = {"requester_telegram_id": TEST_USER_ID}
        response = make_request("DELETE", f"/profile/{TEST_USER_ID}/graffiti", data)
        
        if response.status_code == 200:
            response_data = response.json()
            if response_data.get("success"):
                results.add_pass("Valid DELETE graffiti")
            else:
                results.add_fail("Valid DELETE graffiti", f"Invalid response: {response_data}")
        else:
            results.add_fail("Valid DELETE graffiti", f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        results.add_fail("Valid DELETE graffiti", str(e))
    
    # Test 13: GET graffiti after DELETE (should return empty)
    print("\n1️⃣3️⃣ Testing GET /api/profile/{telegram_id}/graffiti - After DELETE")
    try:
        response = make_request("GET", f"/profile/{TEST_USER_ID}/graffiti")
        
        if response.status_code == 200:
            response_data = response.json()
            if (response_data.get("graffiti_data") == "" and 
                response_data.get("graffiti_updated_at") is None):
                results.add_pass("GET graffiti after DELETE")
            else:
                results.add_fail("GET graffiti after DELETE", f"Expected empty graffiti: {response_data}")
        else:
            results.add_fail("GET graffiti after DELETE", f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        results.add_fail("GET graffiti after DELETE", str(e))
    
    return results.summary()

if __name__ == "__main__":
    print(f"🚀 Starting Graffiti API Tests")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test User ID: {TEST_USER_ID}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    success = test_graffiti_endpoints()
    
    if success:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Some tests failed!")
        sys.exit(1)