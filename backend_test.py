#!/usr/bin/env python3
"""
Backend API Testing for Graffiti Endpoints
Tests the graffiti API endpoints as specified in the review request.
"""

import requests
import json
import sys
from typing import Dict, Any

# Backend URL - using local backend since external URL is not accessible
BACKEND_URL = "http://localhost:8001/api"

# Test data
VALID_GRAFFITI_DATA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
TEST_USER_ID = 999001
VISITOR_USER_ID = 888888
UNAUTHORIZED_USER_ID = 999999

class GraffitiTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        self.results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def make_request(self, method: str, endpoint: str, data: Dict[Any, Any] = None) -> tuple:
        """Make HTTP request and return (response, success, error_msg)"""
        try:
            url = f"{BACKEND_URL}{endpoint}"
            if method.upper() == "GET":
                response = self.session.get(url)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data)
            else:
                return None, False, f"Unsupported method: {method}"
                
            return response, True, ""
        except Exception as e:
            return None, False, str(e)
    
    def test_header_graffiti_flow(self):
        """Test Header Graffiti (шапка) endpoints in order"""
        print("\n=== Testing Header Graffiti (шапка) ===")
        
        # 1. GET initial state - expect empty graffiti
        response, success, error = self.make_request("GET", f"/profile/{TEST_USER_ID}/graffiti")
        if not success:
            self.log_test("GET initial header graffiti", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            data = response.json()
            if data.get("graffiti_data") == "" and data.get("graffiti_updated_at") is None:
                self.log_test("GET initial header graffiti", True, "Empty state as expected")
            else:
                self.log_test("GET initial header graffiti", False, f"Expected empty state, got: {data}")
        else:
            self.log_test("GET initial header graffiti", False, f"Status {response.status_code}: {response.text}")
        
        # 2. PUT valid graffiti data
        put_data = {
            "graffiti_data": VALID_GRAFFITI_DATA,
            "requester_telegram_id": TEST_USER_ID
        }
        response, success, error = self.make_request("PUT", f"/profile/{TEST_USER_ID}/graffiti", put_data)
        if not success:
            self.log_test("PUT header graffiti with valid data", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            data = response.json()
            if data.get("success") is True:
                self.log_test("PUT header graffiti with valid data", True, "Successfully saved graffiti")
            else:
                self.log_test("PUT header graffiti with valid data", False, f"Success=False: {data}")
        else:
            self.log_test("PUT header graffiti with valid data", False, f"Status {response.status_code}: {response.text}")
        
        # 3. GET graffiti after saving - expect non-empty
        response, success, error = self.make_request("GET", f"/profile/{TEST_USER_ID}/graffiti")
        if not success:
            self.log_test("GET header graffiti after save", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            data = response.json()
            if data.get("graffiti_data") and data.get("graffiti_data") != "":
                self.log_test("GET header graffiti after save", True, "Graffiti data is non-empty")
            else:
                self.log_test("GET header graffiti after save", False, f"Expected non-empty graffiti_data, got: {data}")
        else:
            self.log_test("GET header graffiti after save", False, f"Status {response.status_code}: {response.text}")
        
        # 4. PUT without requester_telegram_id - expect 400
        put_data_no_requester = {"graffiti_data": "test"}
        response, success, error = self.make_request("PUT", f"/profile/{TEST_USER_ID}/graffiti", put_data_no_requester)
        if not success:
            self.log_test("PUT header graffiti without requester_telegram_id", False, f"Request failed: {error}")
            return
            
        if response.status_code == 400:
            self.log_test("PUT header graffiti without requester_telegram_id", True, "Correctly rejected with 400")
        else:
            self.log_test("PUT header graffiti without requester_telegram_id", False, f"Expected 400, got {response.status_code}: {response.text}")
        
        # 5. PUT with wrong requester_telegram_id - expect 403
        put_data_wrong_requester = {
            "graffiti_data": "test",
            "requester_telegram_id": UNAUTHORIZED_USER_ID
        }
        response, success, error = self.make_request("PUT", f"/profile/{TEST_USER_ID}/graffiti", put_data_wrong_requester)
        if not success:
            self.log_test("PUT header graffiti with wrong requester", False, f"Request failed: {error}")
            return
            
        if response.status_code == 403:
            self.log_test("PUT header graffiti with wrong requester", True, "Correctly rejected with 403")
        else:
            self.log_test("PUT header graffiti with wrong requester", False, f"Expected 403, got {response.status_code}: {response.text}")
        
        # 6. POST clear graffiti
        clear_data = {"requester_telegram_id": TEST_USER_ID}
        response, success, error = self.make_request("POST", f"/profile/{TEST_USER_ID}/graffiti/clear", clear_data)
        if not success:
            self.log_test("POST clear header graffiti", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            data = response.json()
            if data.get("success") is True:
                self.log_test("POST clear header graffiti", True, "Successfully cleared graffiti")
            else:
                self.log_test("POST clear header graffiti", False, f"Success=False: {data}")
        else:
            self.log_test("POST clear header graffiti", False, f"Status {response.status_code}: {response.text}")
    
    def test_wall_graffiti_flow(self):
        """Test Wall Graffiti (стена) endpoints in order"""
        print("\n=== Testing Wall Graffiti (стена) ===")
        
        # 1. GET initial state - expect empty wall graffiti with access=false
        response, success, error = self.make_request("GET", f"/profile/{TEST_USER_ID}/wall-graffiti")
        if not success:
            self.log_test("GET initial wall graffiti", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            data = response.json()
            expected_state = {
                "wall_graffiti_data": "",
                "wall_graffiti_access": False
            }
            if (data.get("wall_graffiti_data") == "" and 
                data.get("wall_graffiti_access") is False):
                self.log_test("GET initial wall graffiti", True, "Empty state with access=false as expected")
            else:
                self.log_test("GET initial wall graffiti", False, f"Expected {expected_state}, got: {data}")
        else:
            self.log_test("GET initial wall graffiti", False, f"Status {response.status_code}: {response.text}")
        
        # 2. PUT wall graffiti as owner - expect 200
        put_data_owner = {
            "wall_graffiti_data": VALID_GRAFFITI_DATA,
            "requester_telegram_id": TEST_USER_ID
        }
        response, success, error = self.make_request("PUT", f"/profile/{TEST_USER_ID}/wall-graffiti", put_data_owner)
        if not success:
            self.log_test("PUT wall graffiti as owner", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            data = response.json()
            if data.get("success") is True:
                self.log_test("PUT wall graffiti as owner", True, "Owner can always draw")
            else:
                self.log_test("PUT wall graffiti as owner", False, f"Success=False: {data}")
        else:
            self.log_test("PUT wall graffiti as owner", False, f"Status {response.status_code}: {response.text}")
        
        # 3. GET wall graffiti after owner save - expect non-empty
        response, success, error = self.make_request("GET", f"/profile/{TEST_USER_ID}/wall-graffiti")
        if not success:
            self.log_test("GET wall graffiti after owner save", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            data = response.json()
            if data.get("wall_graffiti_data") and data.get("wall_graffiti_data") != "":
                self.log_test("GET wall graffiti after owner save", True, "Wall graffiti data is non-empty")
            else:
                self.log_test("GET wall graffiti after owner save", False, f"Expected non-empty wall_graffiti_data, got: {data}")
        else:
            self.log_test("GET wall graffiti after owner save", False, f"Status {response.status_code}: {response.text}")
        
        # 4. PUT wall graffiti as visitor (access=false) - expect 403
        put_data_visitor = {
            "wall_graffiti_data": VALID_GRAFFITI_DATA,
            "requester_telegram_id": VISITOR_USER_ID
        }
        response, success, error = self.make_request("PUT", f"/profile/{TEST_USER_ID}/wall-graffiti", put_data_visitor)
        if not success:
            self.log_test("PUT wall graffiti as visitor (blocked)", False, f"Request failed: {error}")
            return
            
        if response.status_code == 403:
            self.log_test("PUT wall graffiti as visitor (blocked)", True, "Visitor correctly blocked with 403")
        else:
            self.log_test("PUT wall graffiti as visitor (blocked)", False, f"Expected 403, got {response.status_code}: {response.text}")
        
        # 5. PUT toggle access to true
        toggle_data = {"requester_telegram_id": TEST_USER_ID}
        response, success, error = self.make_request("PUT", f"/profile/{TEST_USER_ID}/wall-graffiti/access", toggle_data)
        if not success:
            self.log_test("PUT toggle wall graffiti access", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            data = response.json()
            if data.get("success") is True and data.get("wall_graffiti_access") is True:
                self.log_test("PUT toggle wall graffiti access", True, "Access toggled to true")
            else:
                self.log_test("PUT toggle wall graffiti access", False, f"Expected success=True and access=True, got: {data}")
        else:
            self.log_test("PUT toggle wall graffiti access", False, f"Status {response.status_code}: {response.text}")
        
        # 6. PUT wall graffiti as visitor (access=true) - expect 200
        response, success, error = self.make_request("PUT", f"/profile/{TEST_USER_ID}/wall-graffiti", put_data_visitor)
        if not success:
            self.log_test("PUT wall graffiti as visitor (allowed)", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            data = response.json()
            if data.get("success") is True:
                self.log_test("PUT wall graffiti as visitor (allowed)", True, "Visitor allowed after access toggle")
            else:
                self.log_test("PUT wall graffiti as visitor (allowed)", False, f"Success=False: {data}")
        else:
            self.log_test("PUT wall graffiti as visitor (allowed)", False, f"Status {response.status_code}: {response.text}")
        
        # 7. POST clear wall graffiti as visitor - expect 403
        clear_data_visitor = {"requester_telegram_id": VISITOR_USER_ID}
        response, success, error = self.make_request("POST", f"/profile/{TEST_USER_ID}/wall-graffiti/clear", clear_data_visitor)
        if not success:
            self.log_test("POST clear wall graffiti as visitor", False, f"Request failed: {error}")
            return
            
        if response.status_code == 403:
            self.log_test("POST clear wall graffiti as visitor", True, "Only owner can clear - visitor correctly rejected")
        else:
            self.log_test("POST clear wall graffiti as visitor", False, f"Expected 403, got {response.status_code}: {response.text}")
        
        # 8. POST clear wall graffiti as owner - expect 200
        clear_data_owner = {"requester_telegram_id": TEST_USER_ID}
        response, success, error = self.make_request("POST", f"/profile/{TEST_USER_ID}/wall-graffiti/clear", clear_data_owner)
        if not success:
            self.log_test("POST clear wall graffiti as owner", False, f"Request failed: {error}")
            return
            
        if response.status_code == 200:
            data = response.json()
            if data.get("success") is True:
                self.log_test("POST clear wall graffiti as owner", True, "Owner can clear wall graffiti")
            else:
                self.log_test("POST clear wall graffiti as owner", False, f"Success=False: {data}")
        else:
            self.log_test("POST clear wall graffiti as owner", False, f"Status {response.status_code}: {response.text}")
        
        # 9. PUT toggle access as visitor - expect 403
        toggle_data_visitor = {"requester_telegram_id": VISITOR_USER_ID}
        response, success, error = self.make_request("PUT", f"/profile/{TEST_USER_ID}/wall-graffiti/access", toggle_data_visitor)
        if not success:
            self.log_test("PUT toggle access as visitor", False, f"Request failed: {error}")
            return
            
        if response.status_code == 403:
            self.log_test("PUT toggle access as visitor", True, "Only owner can toggle access - visitor correctly rejected")
        else:
            self.log_test("PUT toggle access as visitor", False, f"Expected 403, got {response.status_code}: {response.text}")
    
    def run_all_tests(self):
        """Run all graffiti tests"""
        print("🧪 Starting Graffiti API Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test User ID: {TEST_USER_ID}")
        print(f"Visitor User ID: {VISITOR_USER_ID}")
        
        # Test header graffiti flow
        self.test_header_graffiti_flow()
        
        # Test wall graffiti flow  
        self.test_wall_graffiti_flow()
        
        # Summary
        print("\n=== Test Summary ===")
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        
        if failed_tests > 0:
            print("\nFailed Tests:")
            for result in self.results:
                if not result["success"]:
                    print(f"  ❌ {result['test']}: {result['details']}")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = GraffitiTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)