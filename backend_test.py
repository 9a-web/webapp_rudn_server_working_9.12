#!/usr/bin/env python3
"""
Backend Testing Script for Admin Referral Links Feature
Tests all CRUD operations, analytics, and click tracking endpoints.
"""

import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Backend URL - using localhost since external URL is not working
BACKEND_URL = "http://localhost:8001/api"

# Test data
TEST_LINK_1 = {
    "name": "Test Link VK",
    "source": "vk", 
    "medium": "ad",
    "campaign": "test_campaign",
    "description": "Test description"
}

TEST_LINK_2 = {
    "name": "Telegram Channel",
    "code": "TESTCODE",
    "source": "telegram",
    "medium": "post"
}

def log_test(test_name: str, status: str, message: str = "", data: Any = None):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {test_name}: {status}")
    if message:
        print(f"    {message}")
    if data and isinstance(data, dict):
        print(f"    Data: {json.dumps(data, indent=2)}")
    print()

def make_request(method: str, endpoint: str, data: Optional[Dict] = None) -> Dict[str, Any]:
    """Make HTTP request and return parsed response"""
    url = f"{BACKEND_URL}{endpoint}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url)
        elif method.upper() == "POST":
            response = requests.post(url, json=data)
        elif method.upper() == "PUT":
            response = requests.put(url, json=data)
        elif method.upper() == "DELETE":
            response = requests.delete(url)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
            
        return {
            "status_code": response.status_code,
            "success": 200 <= response.status_code < 300,
            "data": response.json() if response.content else {},
            "error": None,
            "raw_response": response.text[:500] if hasattr(response, 'text') else ""
        }
    except requests.exceptions.RequestException as e:
        return {
            "status_code": 0,
            "success": False,
            "data": {},
            "error": str(e)
        }
    except json.JSONDecodeError as e:
        return {
            "status_code": response.status_code,
            "success": False,
            "data": {"raw_content": response.text[:500]},
            "error": f"JSON decode error: {str(e)}",
            "raw_response": response.text[:500]
        }

def test_create_referral_link_auto_code():
    """Test 1: Create referral link with auto-generated code"""
    log_test("Test 1", "STARTING", "Create referral link with auto-generated code")
    
    result = make_request("POST", "/admin/referral-links", TEST_LINK_1)
    
    if not result["success"]:
        log_test("Test 1", "FAILED", f"HTTP {result['status_code']}: {result.get('error', 'Unknown error')}")
        if result.get("raw_response"):
            print(f"    Raw response: {result['raw_response']}")
        return None
    
    data = result["data"]
    
    # Validate response structure
    required_fields = ["id", "name", "code", "full_url", "source", "medium", "campaign", "description"]
    missing_fields = [field for field in required_fields if field not in data]
    
    if missing_fields:
        log_test("Test 1", "FAILED", f"Missing fields in response: {missing_fields}", data)
        return None
    
    # Validate field values
    if data["name"] != TEST_LINK_1["name"]:
        log_test("Test 1", "FAILED", f"Name mismatch: expected '{TEST_LINK_1['name']}', got '{data['name']}'")
        return None
        
    if not data["code"] or len(data["code"]) < 4:
        log_test("Test 1", "FAILED", f"Invalid auto-generated code: '{data['code']}'")
        return None
        
    if not data["full_url"] or "t.me" not in data["full_url"]:
        log_test("Test 1", "FAILED", f"Invalid full_url: '{data['full_url']}'")
        return None
    
    log_test("Test 1", "PASSED", f"Created link with auto-generated code: {data['code']}", {
        "id": data["id"],
        "name": data["name"], 
        "code": data["code"],
        "full_url": data["full_url"]
    })
    return data

def test_create_referral_link_custom_code():
    """Test 2: Create referral link with custom code"""
    log_test("Test 2", "STARTING", "Create referral link with custom code")
    
    result = make_request("POST", "/admin/referral-links", TEST_LINK_2)
    
    if not result["success"]:
        log_test("Test 2", "FAILED", f"HTTP {result['status_code']}: {result.get('error', 'Unknown error')}")
        return None
    
    data = result["data"]
    
    # Validate custom code
    if data["code"] != TEST_LINK_2["code"]:
        log_test("Test 2", "FAILED", f"Code mismatch: expected '{TEST_LINK_2['code']}', got '{data['code']}'")
        return None
    
    if data["name"] != TEST_LINK_2["name"]:
        log_test("Test 2", "FAILED", f"Name mismatch: expected '{TEST_LINK_2['name']}', got '{data['name']}'")
        return None
    
    log_test("Test 2", "PASSED", f"Created link with custom code: {data['code']}", {
        "id": data["id"],
        "name": data["name"],
        "code": data["code"]
    })
    return data

def test_list_referral_links():
    """Test 3: List all referral links"""
    log_test("Test 3", "STARTING", "List all referral links")
    
    result = make_request("GET", "/admin/referral-links")
    
    if not result["success"]:
        log_test("Test 3", "FAILED", f"HTTP {result['status_code']}: {result.get('error', 'Unknown error')}")
        return False
    
    data = result["data"]
    
    # Validate response structure
    if "links" not in data or "total" not in data:
        log_test("Test 3", "FAILED", "Response missing 'links' or 'total' field", data)
        return False
    
    if not isinstance(data["links"], list):
        log_test("Test 3", "FAILED", f"'links' should be a list, got {type(data['links'])}")
        return False
    
    if data["total"] < 2:
        log_test("Test 3", "FAILED", f"Expected at least 2 links, got {data['total']}")
        return False
    
    # Check that each link has required stats fields
    for link in data["links"]:
        required_stats = ["clicks_today", "clicks_week", "clicks_month"]
        missing_stats = [stat for stat in required_stats if stat not in link]
        if missing_stats:
            log_test("Test 3", "FAILED", f"Link missing stats fields: {missing_stats}", link)
            return False
    
    log_test("Test 3", "PASSED", f"Retrieved {data['total']} links with proper stats", {
        "total": data["total"],
        "links_count": len(data["links"])
    })
    return True

def test_track_click_first_time():
    """Test 4: Track click (first time - should be unique)"""
    log_test("Test 4", "STARTING", "Track click (first time)")
    
    result = make_request("POST", "/referral-track/TESTCODE", {})
    
    if not result["success"]:
        log_test("Test 4", "FAILED", f"HTTP {result['status_code']}: {result.get('error', 'Unknown error')}")
        return False
    
    data = result["data"]
    
    # Validate response
    if not data.get("success"):
        log_test("Test 4", "FAILED", f"Track response success=False: {data}")
        return False
    
    if not data.get("is_unique"):
        log_test("Test 4", "FAILED", f"First click should be unique, got is_unique=False")
        return False
    
    log_test("Test 4", "PASSED", "First click tracked as unique", {
        "success": data["success"],
        "is_unique": data["is_unique"]
    })
    return True

def test_track_click_second_time():
    """Test 5: Track click (second time - should not be unique)"""
    log_test("Test 5", "STARTING", "Track click (second time)")
    
    # Wait a moment to ensure different timestamp
    time.sleep(1)
    
    result = make_request("POST", "/referral-track/TESTCODE", {})
    
    if not result["success"]:
        log_test("Test 5", "FAILED", f"HTTP {result['status_code']}: {result.get('error', 'Unknown error')}")
        return False
    
    data = result["data"]
    
    if not data.get("success"):
        log_test("Test 5", "FAILED", f"Track response success=False: {data}")
        return False
    
    if data.get("is_unique"):
        log_test("Test 5", "FAILED", f"Second click should not be unique, got is_unique=True")
        return False
    
    log_test("Test 5", "PASSED", "Second click tracked as non-unique", {
        "success": data["success"],
        "is_unique": data["is_unique"]
    })
    return True

def test_analytics():
    """Test 6: Get referral links analytics"""
    log_test("Test 6", "STARTING", "Get analytics")
    
    result = make_request("GET", "/admin/referral-links/analytics?days=30")
    
    if not result["success"]:
        log_test("Test 6", "FAILED", f"HTTP {result['status_code']}: {result.get('error', 'Unknown error')}")
        return False
    
    data = result["data"]
    
    # Validate analytics structure
    required_fields = [
        "total_links", "total_clicks", "clicks_by_day", 
        "top_links", "clicks_by_source"
    ]
    missing_fields = [field for field in required_fields if field not in data]
    
    if missing_fields:
        log_test("Test 6", "FAILED", f"Missing fields in analytics: {missing_fields}", data)
        return False
    
    # Validate we have some data
    if data["total_links"] < 2:
        log_test("Test 6", "FAILED", f"Expected at least 2 links, got {data['total_links']}")
        return False
    
    if data["total_clicks"] < 2:
        log_test("Test 6", "FAILED", f"Expected at least 2 clicks from our tests, got {data['total_clicks']}")
        return False
    
    log_test("Test 6", "PASSED", "Analytics retrieved successfully", {
        "total_links": data["total_links"],
        "total_clicks": data["total_clicks"],
        "top_links_count": len(data["top_links"]),
        "clicks_by_source_count": len(data["clicks_by_source"])
    })
    return True

def test_get_link_details(link_id: str):
    """Test 7: Get single link details"""
    log_test("Test 7", "STARTING", f"Get link details for {link_id}")
    
    result = make_request("GET", f"/admin/referral-links/{link_id}")
    
    if not result["success"]:
        log_test("Test 7", "FAILED", f"HTTP {result['status_code']}: {result.get('error', 'Unknown error')}")
        return False
    
    data = result["data"]
    
    # Validate detailed response
    required_fields = ["id", "name", "code", "clicks_today", "clicks_week", "clicks_month",
                      "clicks_by_day", "clicks_by_device", "recent_clicks"]
    missing_fields = [field for field in required_fields if field not in data]
    
    if missing_fields:
        log_test("Test 7", "FAILED", f"Missing fields in link details: {missing_fields}", data)
        return False
    
    if data["id"] != link_id:
        log_test("Test 7", "FAILED", f"ID mismatch: expected {link_id}, got {data['id']}")
        return False
    
    log_test("Test 7", "PASSED", f"Retrieved detailed info for link {link_id}", {
        "id": data["id"],
        "name": data["name"],
        "code": data["code"],
        "clicks_today": data["clicks_today"],
        "recent_clicks_count": len(data["recent_clicks"])
    })
    return True

def test_update_link(link_id: str):
    """Test 8: Update link (deactivate)"""
    log_test("Test 8", "STARTING", f"Update link {link_id} - deactivate")
    
    update_data = {"is_active": False}
    result = make_request("PUT", f"/admin/referral-links/{link_id}", update_data)
    
    if not result["success"]:
        log_test("Test 8", "FAILED", f"HTTP {result['status_code']}: {result.get('error', 'Unknown error')}")
        return False
    
    data = result["data"]
    
    if data.get("is_active") != False:
        log_test("Test 8", "FAILED", f"Expected is_active=False, got {data.get('is_active')}")
        return False
    
    log_test("Test 8", "PASSED", f"Successfully deactivated link {link_id}", {
        "id": data["id"],
        "is_active": data["is_active"]
    })
    return True

def test_track_click_inactive_link():
    """Test 9: Track click on inactive link (should return 404)"""
    log_test("Test 9", "STARTING", "Track click on inactive link")
    
    result = make_request("POST", "/referral-track/TESTCODE", {})
    
    if result["status_code"] != 404:
        log_test("Test 9", "FAILED", f"Expected 404 for inactive link, got {result['status_code']}")
        return False
    
    log_test("Test 9", "PASSED", "Inactive link correctly returns 404", {
        "status_code": result["status_code"]
    })
    return True

def test_delete_link(link_id: str):
    """Test 10: Delete link"""
    log_test("Test 10", "STARTING", f"Delete link {link_id}")
    
    result = make_request("DELETE", f"/admin/referral-links/{link_id}")
    
    if not result["success"]:
        log_test("Test 10", "FAILED", f"HTTP {result['status_code']}: {result.get('error', 'Unknown error')}")
        return False
    
    data = result["data"]
    
    if not data.get("success"):
        log_test("Test 10", "FAILED", f"Delete response success=False: {data}")
        return False
    
    if "deleted_clicks" not in data:
        log_test("Test 10", "FAILED", "Response missing 'deleted_clicks' field", data)
        return False
    
    log_test("Test 10", "PASSED", f"Successfully deleted link {link_id}", {
        "success": data["success"],
        "deleted_clicks": data["deleted_clicks"]
    })
    return True

def test_redirect_endpoint(code: str):
    """Test 11: Test redirect endpoint"""
    log_test("Test 11", "STARTING", f"Test redirect endpoint for code {code}")
    
    # For redirect test, we use requests with allow_redirects=False to check the redirect response
    url = f"{BACKEND_URL}/r/{code}"
    try:
        response = requests.get(url, allow_redirects=False)
        
        if response.status_code not in [302, 301]:
            log_test("Test 11", "FAILED", f"Expected redirect (301/302), got {response.status_code}")
            return False
        
        location = response.headers.get('Location', '')
        if not location or 't.me' not in location:
            log_test("Test 11", "FAILED", f"Invalid redirect location: {location}")
            return False
        
        log_test("Test 11", "PASSED", f"Redirect works correctly", {
            "status_code": response.status_code,
            "location": location
        })
        return True
        
    except requests.exceptions.RequestException as e:
        log_test("Test 11", "FAILED", f"Request error: {str(e)}")
        return False

def run_all_tests():
    """Run all tests in sequence"""
    print("=" * 60)
    print("ADMIN REFERRAL LINKS - BACKEND TESTING")
    print("=" * 60)
    print()
    
    # Store created links for later use
    link1_data = None
    link2_data = None
    
    # Test 1: Create link with auto-generated code
    link1_data = test_create_referral_link_auto_code()
    if not link1_data:
        print("❌ Test 1 failed - aborting remaining tests")
        return False
    
    # Test 2: Create link with custom code
    link2_data = test_create_referral_link_custom_code()
    if not link2_data:
        print("❌ Test 2 failed - continuing with remaining tests")
    
    # Test 3: List links
    if not test_list_referral_links():
        print("❌ Test 3 failed")
    
    # Test 4 & 5: Track clicks (if we have TESTCODE link)
    if link2_data and link2_data.get("code") == "TESTCODE":
        test_track_click_first_time()
        test_track_click_second_time()
    
    # Test 6: Analytics
    test_analytics()
    
    # Test 7: Get link details (use link2 if available)
    if link2_data and link2_data.get("id"):
        test_get_link_details(link2_data["id"])
    
    # Test 8: Update link (deactivate link2)
    if link2_data and link2_data.get("id"):
        test_update_link(link2_data["id"])
    
    # Test 9: Track click on inactive link
    test_track_click_inactive_link()
    
    # Test 10: Delete link
    if link2_data and link2_data.get("id"):
        test_delete_link(link2_data["id"])
    
    # Test 11: Redirect endpoint (use link1 if available)
    if link1_data and link1_data.get("code"):
        test_redirect_endpoint(link1_data["code"])
    
    print("=" * 60)
    print("TESTING COMPLETED")
    print("=" * 60)
    return True

if __name__ == "__main__":
    run_all_tests()