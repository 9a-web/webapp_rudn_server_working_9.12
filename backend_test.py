#!/usr/bin/env python3
"""
Backend Test Suite for Admin Referral Links System (Reworked)
Tests 3 event types: click, registration, login
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any

# Backend URL from frontend .env
BACKEND_URL = "https://ref-tracker-admin.preview.emergentagent.com/api"

class TestResults:
    def __init__(self):
        self.results = []
        self.passed = 0
        self.failed = 0
        
    def add_result(self, test_name: str, success: bool, message: str, details: str = ""):
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": datetime.utcnow().isoformat()
        }
        self.results.append(result)
        if success:
            self.passed += 1
            print(f"✅ {test_name}: {message}")
        else:
            self.failed += 1
            print(f"❌ {test_name}: {message}")
            if details:
                print(f"   Details: {details}")
                
    def print_summary(self):
        print(f"\n{'='*80}")
        print(f"TEST SUMMARY: {self.passed} passed, {self.failed} failed")
        print(f"{'='*80}")
        if self.failed > 0:
            print("\nFAILED TESTS:")
            for result in self.results:
                if not result["success"]:
                    print(f"- {result['test']}: {result['message']}")

def make_request(method: str, endpoint: str, data: Dict[Any, Any] = None, expected_status: int = 200) -> Dict[Any, Any]:
    """Make HTTP request with error handling"""
    url = f"{BACKEND_URL}{endpoint}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, timeout=10)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, timeout=10)
        elif method.upper() == "PUT":
            response = requests.put(url, json=data, timeout=10)
        elif method.upper() == "DELETE":
            response = requests.delete(url, timeout=10)
        else:
            raise ValueError(f"Unsupported method: {method}")
            
        print(f"{method} {endpoint} -> {response.status_code}")
        
        if response.status_code != expected_status:
            print(f"Expected {expected_status}, got {response.status_code}")
            print(f"Response: {response.text}")
            
        return {
            "status_code": response.status_code,
            "data": response.json() if response.text else {},
            "success": response.status_code == expected_status
        }
    except requests.exceptions.Timeout:
        return {"status_code": 0, "data": {}, "success": False, "error": "Request timeout"}
    except requests.exceptions.RequestException as e:
        return {"status_code": 0, "data": {}, "success": False, "error": str(e)}
    except json.JSONDecodeError:
        return {
            "status_code": response.status_code if 'response' in locals() else 0,
            "data": {"raw_response": response.text if 'response' in locals() else ""},
            "success": False,
            "error": "Invalid JSON response"
        }

def test_admin_referral_system():
    """Test the complete Admin Referral Links system with 3 event types"""
    results = TestResults()
    link_id = None  # Will store the created link ID
    
    print(f"Testing Admin Referral Links System at {BACKEND_URL}")
    print("="*80)
    
    # Test 1: Create referral link
    print("\n1. Testing Create Referral Link...")
    create_data = {
        "name": "Test Link",
        "code": "TESTCODE",
        "source": "vk",
        "medium": "ad"
    }
    
    response = make_request("POST", "/admin/referral-links", create_data)
    if response["success"] and response["data"]:
        data = response["data"]
        link_id = data.get("id")
        if (data.get("code") == "TESTCODE" and 
            data.get("registrations", 0) == 0 and 
            data.get("logins", 0) == 0):
            results.add_result(
                "Create Link", True, 
                f"Link created successfully with ID: {link_id}",
                f"Response: {json.dumps(data, indent=2)}"
            )
        else:
            results.add_result(
                "Create Link", False,
                "Link created but with incorrect initial values",
                f"Expected registrations=0, logins=0, got {data}"
            )
    else:
        results.add_result(
            "Create Link", False, 
            "Failed to create referral link",
            f"Response: {response}"
        )
        return results  # Can't continue without link
    
    # Test 2: Track 3 clicks (should have uniqueness detection)
    print("\n2. Testing Click Tracking (3 clicks)...")
    click_data = {
        "code": "TESTCODE",
        "event_type": "click"
    }
    
    click_results = []
    for i in range(3):
        response = make_request("POST", "/admin/referral-track", click_data)
        if response["success"]:
            click_results.append(response["data"])
        time.sleep(0.5)  # Small delay between clicks
    
    if len(click_results) == 3:
        first_unique = click_results[0].get("is_unique")
        second_unique = click_results[1].get("is_unique") 
        third_unique = click_results[2].get("is_unique")
        
        if first_unique == True and second_unique == False and third_unique == False:
            results.add_result(
                "Click Tracking", True,
                "Click tracking working correctly (first unique, rest not unique)",
                f"Results: {click_results}"
            )
        else:
            results.add_result(
                "Click Tracking", False,
                f"Incorrect uniqueness detection: {first_unique}, {second_unique}, {third_unique}",
                f"Expected: True, False, False. Got results: {click_results}"
            )
    else:
        results.add_result(
            "Click Tracking", False,
            f"Failed to track all 3 clicks, only got {len(click_results)}",
            f"Responses: {click_results}"
        )
    
    # Test 3: Track 2 registrations (different telegram_ids)
    print("\n3. Testing Registration Tracking (2 users)...")
    reg1_data = {
        "code": "TESTCODE",
        "event_type": "registration",
        "telegram_id": 111,
        "telegram_username": "user1",
        "telegram_name": "User One"
    }
    
    reg2_data = {
        "code": "TESTCODE", 
        "event_type": "registration",
        "telegram_id": 222,
        "telegram_username": "user2",
        "telegram_name": "User Two"
    }
    
    reg1_response = make_request("POST", "/admin/referral-track", reg1_data)
    reg2_response = make_request("POST", "/admin/referral-track", reg2_data)
    
    if (reg1_response["success"] and reg2_response["success"] and
        reg1_response["data"].get("is_unique") == True and
        reg2_response["data"].get("is_unique") == True):
        results.add_result(
            "Registration Tracking", True,
            "Both registrations tracked as unique",
            f"Reg1: {reg1_response['data']}, Reg2: {reg2_response['data']}"
        )
    else:
        results.add_result(
            "Registration Tracking", False,
            "Registration tracking failed or incorrect uniqueness",
            f"Reg1 response: {reg1_response}, Reg2 response: {reg2_response}"
        )
    
    # Test 4: Test duplicate registration (same telegram_id)
    print("\n4. Testing Duplicate Registration...")
    duplicate_data = {
        "code": "TESTCODE",
        "event_type": "registration", 
        "telegram_id": 111,  # Same as first registration
        "telegram_username": "user1",
        "telegram_name": "User One"
    }
    
    dup_response = make_request("POST", "/admin/referral-track", duplicate_data)
    if (dup_response["success"] and 
        dup_response["data"].get("is_unique") == False and
        "уже зарегистрирован" in dup_response["data"].get("message", "").lower()):
        results.add_result(
            "Duplicate Registration", True,
            "Duplicate registration correctly detected",
            f"Response: {dup_response['data']}"
        )
    else:
        results.add_result(
            "Duplicate Registration", False,
            "Duplicate registration not handled correctly",
            f"Response: {dup_response}"
        )
    
    # Test 5: Track 1 login
    print("\n5. Testing Login Tracking...")
    login_data = {
        "code": "TESTCODE",
        "event_type": "login",
        "telegram_id": 333,
        "telegram_username": "user3", 
        "telegram_name": "User Three"
    }
    
    login_response = make_request("POST", "/admin/referral-track", login_data)
    if (login_response["success"] and 
        login_response["data"].get("event_type") == "login"):
        results.add_result(
            "Login Tracking", True,
            "Login event tracked successfully",
            f"Response: {login_response['data']}"
        )
    else:
        results.add_result(
            "Login Tracking", False,
            "Login tracking failed",
            f"Response: {login_response}"
        )
    
    # Test 6: Test invalid event_type
    print("\n6. Testing Invalid Event Type...")
    invalid_data = {
        "code": "TESTCODE",
        "event_type": "invalid"
    }
    
    invalid_response = make_request("POST", "/admin/referral-track", invalid_data, expected_status=400)
    if invalid_response["status_code"] == 400:
        results.add_result(
            "Invalid Event Type", True,
            "Invalid event_type correctly returned 400",
            f"Response: {invalid_response['data']}"
        )
    else:
        results.add_result(
            "Invalid Event Type", False,
            f"Expected 400, got {invalid_response['status_code']}",
            f"Response: {invalid_response}"
        )
    
    # Test 7: Check analytics
    print("\n7. Testing Analytics Endpoint...")
    analytics_response = make_request("GET", "/admin/referral-links/analytics")
    if analytics_response["success"]:
        analytics = analytics_response["data"]
        total_clicks = analytics.get("total_clicks", 0)
        total_registrations = analytics.get("total_registrations", 0)
        total_logins = analytics.get("total_logins", 0)
        
        if (total_clicks >= 3 and total_registrations >= 2 and total_logins >= 1):
            results.add_result(
                "Analytics", True,
                f"Analytics correct: clicks={total_clicks}, registrations={total_registrations}, logins={total_logins}",
                f"Full analytics: {json.dumps(analytics, indent=2, default=str)}"
            )
        else:
            results.add_result(
                "Analytics", False,
                f"Analytics incorrect: clicks={total_clicks}, registrations={total_registrations}, logins={total_logins}",
                f"Expected at least: clicks=3, registrations=2, logins=1. Full response: {analytics}"
            )
    else:
        results.add_result(
            "Analytics", False,
            "Failed to get analytics",
            f"Response: {analytics_response}"
        )
    
    # Test 8: Get link details
    print(f"\n8. Testing Link Details (ID: {link_id})...")
    if link_id:
        details_response = make_request("GET", f"/admin/referral-links/{link_id}")
        if details_response["success"]:
            details = details_response["data"]
            total_clicks = details.get("total_clicks", 0)
            registrations = details.get("registrations", 0)
            logins = details.get("logins", 0)
            registered_users = details.get("registered_users", [])
            
            if (total_clicks >= 3 and registrations >= 2 and logins >= 1 and len(registered_users) >= 2):
                results.add_result(
                    "Link Details", True,
                    f"Link details correct: clicks={total_clicks}, registrations={registrations}, logins={logins}, users={len(registered_users)}",
                    f"Registered users: {registered_users}"
                )
            else:
                results.add_result(
                    "Link Details", False,
                    f"Link details incorrect: clicks={total_clicks}, registrations={registrations}, logins={logins}, users={len(registered_users)}",
                    f"Expected: clicks>=3, registrations>=2, logins>=1, users>=2. Full response: {details}"
                )
        else:
            results.add_result(
                "Link Details", False,
                "Failed to get link details",
                f"Response: {details_response}"
            )
    
    # Test 9: Deactivate link and test tracking
    print(f"\n9. Testing Link Deactivation...")
    if link_id:
        deactivate_data = {"is_active": False}
        deactivate_response = make_request("PUT", f"/admin/referral-links/{link_id}", deactivate_data)
        
        if deactivate_response["success"]:
            # Try to track on deactivated link
            inactive_track_data = {
                "code": "TESTCODE",
                "event_type": "click"
            }
            inactive_response = make_request("POST", "/admin/referral-track", inactive_track_data)
            
            if (inactive_response["success"] and 
                inactive_response["data"].get("success") == False and
                "неактивна" in inactive_response["data"].get("message", "").lower()):
                results.add_result(
                    "Link Deactivation", True,
                    "Deactivated link correctly blocks tracking",
                    f"Inactive response: {inactive_response['data']}"
                )
            else:
                results.add_result(
                    "Link Deactivation", False,
                    "Deactivated link does not block tracking correctly",
                    f"Inactive response: {inactive_response}"
                )
        else:
            results.add_result(
                "Link Deactivation", False,
                "Failed to deactivate link",
                f"Response: {deactivate_response}"
            )
    
    # Test 10: Delete link
    print(f"\n10. Testing Link Deletion...")
    if link_id:
        delete_response = make_request("DELETE", f"/admin/referral-links/{link_id}")
        if delete_response["success"]:
            results.add_result(
                "Link Deletion", True,
                "Link deleted successfully",
                f"Response: {delete_response['data']}"
            )
        else:
            results.add_result(
                "Link Deletion", False,
                "Failed to delete link",
                f"Response: {delete_response}"
            )
    
    # Test 11: Test redirect endpoint
    print(f"\n11. Testing Redirect Endpoint...")
    # Create a new link for redirect testing
    redirect_link_data = {
        "name": "Redirect Test Link",
        "code": "REDIRECTTEST",
        "source": "test",
        "medium": "redirect"
    }
    
    redirect_create_response = make_request("POST", "/admin/referral-links", redirect_link_data)
    if redirect_create_response["success"]:
        redirect_link_id = redirect_create_response["data"].get("id")
        
        # Test redirect
        redirect_response = make_request("GET", "/r/REDIRECTTEST", expected_status=302)
        if redirect_response["status_code"] == 302:
            results.add_result(
                "Redirect Endpoint", True,
                "Redirect endpoint returns 302 as expected",
                f"Status: {redirect_response['status_code']}"
            )
        else:
            results.add_result(
                "Redirect Endpoint", False,
                f"Expected 302 redirect, got {redirect_response['status_code']}",
                f"Response: {redirect_response}"
            )
        
        # Clean up redirect test link
        if redirect_link_id:
            make_request("DELETE", f"/admin/referral-links/{redirect_link_id}")
    else:
        results.add_result(
            "Redirect Endpoint", False,
            "Could not create link for redirect testing",
            f"Response: {redirect_create_response}"
        )
    
    return results

if __name__ == "__main__":
    print("Starting Admin Referral Links Backend Test Suite")
    print(f"Backend URL: {BACKEND_URL}")
    print("="*80)
    
    test_results = test_admin_referral_system()
    test_results.print_summary()
    
    # Return exit code based on results
    exit_code = 1 if test_results.failed > 0 else 0
    print(f"\nTest completed with exit code: {exit_code}")
    exit(exit_code)