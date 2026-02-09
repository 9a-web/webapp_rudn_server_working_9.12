#!/usr/bin/env python3
"""
Journal Editing API Test Script
Testing specific journal editing endpoints as requested in the review
"""

import requests
import json
import sys

def print_test_result(test_name, success, details=None):
    """Print formatted test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"   {details}")
    print()

def test_health_check():
    """Test: GET /api/ - health check should return 200"""
    print("🔄 Testing: Health Check (GET /api/)...")
    
    # Test both localhost and production URL to see which is working
    urls_to_test = [
        "http://localhost:8001/api",
        "https://rudn-webapp.preview.emergentagent.com/api"
    ]
    
    for base_url in urls_to_test:
        url = f"{base_url}/"
        print(f"   Trying URL: {url}")
        
        try:
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                print(f"   Response: {json.dumps(data, indent=2)}")
                print_test_result(f"Health Check ({base_url})", True, f"HTTP 200 - {data.get('message', 'Success')}")
                return True, base_url  # Return success and working URL
            else:
                print(f"   HTTP {response.status_code}: {response.text[:200]}")
                
        except Exception as e:
            print(f"   Exception: {str(e)}")
    
    print_test_result("Health Check", False, "No working URLs found")
    return False, None

def test_journal_edit_endpoints(base_url):
    """Test the 3 journal editing PUT endpoints with fake IDs"""
    print(f"🔄 Testing Journal Edit Endpoints on: {base_url}")
    
    # Test data for each endpoint
    test_cases = [
        {
            "name": "Edit Journal",
            "method": "PUT",
            "endpoint": f"{base_url}/journals/test-edit-123",
            "data": {"name": "Test Updated", "color": "blue"}
        },
        {
            "name": "Edit Subject", 
            "method": "PUT",
            "endpoint": f"{base_url}/journals/subjects/test-subj-123",
            "data": {"name": "Updated Subject", "color": "green"}
        },
        {
            "name": "Edit Session",
            "method": "PUT", 
            "endpoint": f"{base_url}/journals/sessions/test-sess-123",
            "data": {"title": "Updated Session", "type": "seminar", "date": "2025-07-01"}
        }
    ]
    
    results = []
    
    for test_case in test_cases:
        print(f"\n   Testing: {test_case['name']}")
        print(f"   URL: {test_case['endpoint']}")
        print(f"   Data: {json.dumps(test_case['data'], indent=2)}")
        
        try:
            response = requests.put(
                test_case['endpoint'], 
                json=test_case['data'], 
                timeout=10
            )
            
            print(f"   Status Code: {response.status_code}")
            
            # According to review request, expect either 404 (not found) or 200 (success)
            if response.status_code in [200, 404]:
                try:
                    data = response.json()
                    print(f"   Response: {json.dumps(data, indent=2)}")
                except:
                    print(f"   Response (text): {response.text}")
                
                if response.status_code == 404:
                    detail = "404 Not Found (expected - fake ID)"
                else:
                    detail = "200 Success (routing works)"
                    
                print_test_result(test_case['name'], True, detail)
                results.append(True)
                
            elif response.status_code == 500:
                # 500 errors indicate routing/implementation problems
                print(f"   ERROR Response: {response.text}")
                print_test_result(test_case['name'], False, "500 Internal Server Error - endpoint has issues")
                results.append(False)
                
            else:
                # Other status codes
                print(f"   Response: {response.text[:200]}")
                print_test_result(test_case['name'], False, f"Unexpected status code: {response.status_code}")
                results.append(False)
                
        except Exception as e:
            print_test_result(test_case['name'], False, f"Exception: {str(e)}")
            results.append(False)
    
    return results

def main():
    """Run journal editing API tests"""
    print("🚀 Starting Journal Editing API Tests")
    print("Testing endpoints: PUT /api/journals/{id}, PUT /api/journals/subjects/{id}, PUT /api/journals/sessions/{id}")
    print("=" * 80)
    
    # Step 1: Health check to find working URL
    health_success, working_url = test_health_check()
    
    if not health_success:
        print("❌ Cannot proceed - no working backend URL found")
        return 1
    
    print("\n" + "=" * 50)
    
    # Step 2: Test journal editing endpoints
    edit_results = test_journal_edit_endpoints(working_url)
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 JOURNAL EDITING API TEST SUMMARY")
    print("=" * 80)
    
    total_tests = len(edit_results) + 1  # +1 for health check
    passed_tests = sum(edit_results) + (1 if health_success else 0)
    failed_tests = total_tests - passed_tests
    
    print(f"Health Check: {'✅ PASS' if health_success else '❌ FAIL'}")
    
    endpoint_names = ["Edit Journal", "Edit Subject", "Edit Session"]
    for i, result in enumerate(edit_results):
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{endpoint_names[i]}: {status}")
    
    print(f"\nTotal: {passed_tests}/{total_tests} tests passed")
    
    if failed_tests == 0:
        print("\n🎉 All journal editing endpoint tests passed!")
        print("All PUT routes respond correctly - no 500 errors detected.")
        return 0
    else:
        print(f"\n⚠️  {failed_tests} test(s) failed. Check the details above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())