#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Graffiti API Endpoints
Testing all scenarios as specified in the review request
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL - using localhost since external URL is not accessible
BACKEND_URL = "http://localhost:8001/api"

# Test data
TEST_TELEGRAM_ID = 999001
VALID_BASE64_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
INVALID_REQUESTER_ID = 99999

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_symbol = "✅" if status == "PASS" else "❌"
    print(f"[{timestamp}] {status_symbol} {test_name}")
    if details:
        print(f"    {details}")

def test_graffiti_endpoints():
    """Test all Graffiti API endpoints comprehensively"""
    print("🧪 STARTING GRAFFITI API COMPREHENSIVE TESTING")
    print("=" * 60)
    
    total_tests = 0
    passed_tests = 0
    failed_tests = []
    
    # Test 1: Valid save - PUT with valid data
    print("\n📝 TEST 1: Valid graffiti save")
    total_tests += 1
    try:
        response = requests.put(
            f"{BACKEND_URL}/profile/{TEST_TELEGRAM_ID}/graffiti",
            json={
                "graffiti_data": VALID_BASE64_IMAGE,
                "requester_telegram_id": TEST_TELEGRAM_ID
            },
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") and "graffiti_updated_at" in data:
                log_test("Valid save", "PASS", f"Status: {response.status_code}, Response: {data}")
                passed_tests += 1
            else:
                log_test("Valid save", "FAIL", f"Missing required fields in response: {data}")
                failed_tests.append("Valid save - missing fields")
        else:
            log_test("Valid save", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            failed_tests.append("Valid save - wrong status code")
    except Exception as e:
        log_test("Valid save", "FAIL", f"Exception: {e}")
        failed_tests.append("Valid save - exception")
    
    # Test 2: Empty data clear - PUT with empty string
    print("\n🧹 TEST 2: Empty data clear")
    total_tests += 1
    try:
        response = requests.put(
            f"{BACKEND_URL}/profile/{TEST_TELEGRAM_ID}/graffiti",
            json={
                "graffiti_data": "",
                "requester_telegram_id": TEST_TELEGRAM_ID
            },
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") and data.get("cleared"):
                log_test("Empty data clear", "PASS", f"Status: {response.status_code}, Response: {data}")
                passed_tests += 1
            else:
                log_test("Empty data clear", "FAIL", f"Missing cleared=true in response: {data}")
                failed_tests.append("Empty data clear - missing cleared field")
        else:
            log_test("Empty data clear", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            failed_tests.append("Empty data clear - wrong status code")
    except Exception as e:
        log_test("Empty data clear", "FAIL", f"Exception: {e}")
        failed_tests.append("Empty data clear - exception")
    
    # Test 3: Invalid JSON body
    print("\n🚫 TEST 3: Invalid JSON body")
    total_tests += 1
    try:
        response = requests.put(
            f"{BACKEND_URL}/profile/{TEST_TELEGRAM_ID}/graffiti",
            data="not-json",  # Invalid JSON
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 400:
            data = response.json()
            if "JSON" in data.get("detail", "").upper() or "json" in data.get("detail", ""):
                log_test("Invalid JSON body", "PASS", f"Status: {response.status_code}, Response: {data}")
                passed_tests += 1
            else:
                log_test("Invalid JSON body", "FAIL", f"Wrong error message: {data}")
                failed_tests.append("Invalid JSON body - wrong error message")
        else:
            log_test("Invalid JSON body", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            failed_tests.append("Invalid JSON body - wrong status code")
    except Exception as e:
        log_test("Invalid JSON body", "FAIL", f"Exception: {e}")
        failed_tests.append("Invalid JSON body - exception")
    
    # Test 4: Non-numeric requester
    print("\n🔢 TEST 4: Non-numeric requester")
    total_tests += 1
    try:
        response = requests.put(
            f"{BACKEND_URL}/profile/{TEST_TELEGRAM_ID}/graffiti",
            json={
                "graffiti_data": VALID_BASE64_IMAGE,
                "requester_telegram_id": "abc"  # Non-numeric
            },
            timeout=10
        )
        
        if response.status_code == 400:
            data = response.json()
            if "числом" in data.get("detail", ""):
                log_test("Non-numeric requester", "PASS", f"Status: {response.status_code}, Response: {data}")
                passed_tests += 1
            else:
                log_test("Non-numeric requester", "FAIL", f"Wrong error message: {data}")
                failed_tests.append("Non-numeric requester - wrong error message")
        else:
            log_test("Non-numeric requester", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            failed_tests.append("Non-numeric requester - wrong status code")
    except Exception as e:
        log_test("Non-numeric requester", "FAIL", f"Exception: {e}")
        failed_tests.append("Non-numeric requester - exception")
    
    # Test 5: Missing requester
    print("\n❓ TEST 5: Missing requester")
    total_tests += 1
    try:
        response = requests.put(
            f"{BACKEND_URL}/profile/{TEST_TELEGRAM_ID}/graffiti",
            json={
                "graffiti_data": VALID_BASE64_IMAGE
                # Missing requester_telegram_id
            },
            timeout=10
        )
        
        if response.status_code == 400:
            data = response.json()
            if "обязателен" in data.get("detail", ""):
                log_test("Missing requester", "PASS", f"Status: {response.status_code}, Response: {data}")
                passed_tests += 1
            else:
                log_test("Missing requester", "FAIL", f"Wrong error message: {data}")
                failed_tests.append("Missing requester - wrong error message")
        else:
            log_test("Missing requester", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            failed_tests.append("Missing requester - wrong status code")
    except Exception as e:
        log_test("Missing requester", "FAIL", f"Exception: {e}")
        failed_tests.append("Missing requester - exception")
    
    # Test 6: Wrong requester (authorization)
    print("\n🔒 TEST 6: Wrong requester (authorization)")
    total_tests += 1
    try:
        response = requests.put(
            f"{BACKEND_URL}/profile/{TEST_TELEGRAM_ID}/graffiti",
            json={
                "graffiti_data": VALID_BASE64_IMAGE,
                "requester_telegram_id": INVALID_REQUESTER_ID  # Wrong requester
            },
            timeout=10
        )
        
        if response.status_code == 403:
            log_test("Wrong requester", "PASS", f"Status: {response.status_code}, Response: {response.json()}")
            passed_tests += 1
        else:
            log_test("Wrong requester", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            failed_tests.append("Wrong requester - wrong status code")
    except Exception as e:
        log_test("Wrong requester", "FAIL", f"Exception: {e}")
        failed_tests.append("Wrong requester - exception")
    
    # Test 7: Invalid format
    print("\n🖼️ TEST 7: Invalid format")
    total_tests += 1
    try:
        response = requests.put(
            f"{BACKEND_URL}/profile/{TEST_TELEGRAM_ID}/graffiti",
            json={
                "graffiti_data": "not-a-data-url",
                "requester_telegram_id": TEST_TELEGRAM_ID
            },
            timeout=10
        )
        
        if response.status_code == 400:
            data = response.json()
            if "формат" in data.get("detail", "").lower() or "data:image" in data.get("detail", ""):
                log_test("Invalid format", "PASS", f"Status: {response.status_code}, Response: {data}")
                passed_tests += 1
            else:
                log_test("Invalid format", "FAIL", f"Wrong error message: {data}")
                failed_tests.append("Invalid format - wrong error message")
        else:
            log_test("Invalid format", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            failed_tests.append("Invalid format - wrong status code")
    except Exception as e:
        log_test("Invalid format", "FAIL", f"Exception: {e}")
        failed_tests.append("Invalid format - exception")
    
    # Test 8: Get graffiti for non-existent user
    print("\n👤 TEST 8: Get graffiti for non-existent user")
    total_tests += 1
    try:
        non_existent_id = 999999
        response = requests.get(
            f"{BACKEND_URL}/profile/{non_existent_id}/graffiti",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("graffiti_data") == "" and data.get("graffiti_updated_at") is None:
                log_test("Get non-existent user", "PASS", f"Status: {response.status_code}, Response: {data}")
                passed_tests += 1
            else:
                log_test("Get non-existent user", "FAIL", f"Wrong default values: {data}")
                failed_tests.append("Get non-existent user - wrong default values")
        else:
            log_test("Get non-existent user", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            failed_tests.append("Get non-existent user - wrong status code")
    except Exception as e:
        log_test("Get non-existent user", "FAIL", f"Exception: {e}")
        failed_tests.append("Get non-existent user - exception")
    
    # Test 9: Save valid data and then GET (sequence test)
    print("\n🔄 TEST 9: Save and GET sequence")
    total_tests += 1
    try:
        # First save
        save_response = requests.put(
            f"{BACKEND_URL}/profile/{TEST_TELEGRAM_ID}/graffiti",
            json={
                "graffiti_data": VALID_BASE64_IMAGE,
                "requester_telegram_id": TEST_TELEGRAM_ID
            },
            timeout=10
        )
        
        if save_response.status_code == 200:
            # Then get
            get_response = requests.get(
                f"{BACKEND_URL}/profile/{TEST_TELEGRAM_ID}/graffiti",
                timeout=10
            )
            
            if get_response.status_code == 200:
                data = get_response.json()
                if data.get("graffiti_data") == VALID_BASE64_IMAGE and data.get("graffiti_updated_at"):
                    log_test("Save and GET sequence", "PASS", f"GET Status: {get_response.status_code}, Data matches")
                    passed_tests += 1
                else:
                    log_test("Save and GET sequence", "FAIL", f"Data mismatch: {data}")
                    failed_tests.append("Save and GET sequence - data mismatch")
            else:
                log_test("Save and GET sequence", "FAIL", f"GET failed: {get_response.status_code}")
                failed_tests.append("Save and GET sequence - GET failed")
        else:
            log_test("Save and GET sequence", "FAIL", f"Save failed: {save_response.status_code}")
            failed_tests.append("Save and GET sequence - save failed")
    except Exception as e:
        log_test("Save and GET sequence", "FAIL", f"Exception: {e}")
        failed_tests.append("Save and GET sequence - exception")
    
    # Test 10: Clear with valid requester
    print("\n🧹 TEST 10: Clear with valid requester")
    total_tests += 1
    try:
        response = requests.post(
            f"{BACKEND_URL}/profile/{TEST_TELEGRAM_ID}/graffiti/clear",
            json={
                "requester_telegram_id": TEST_TELEGRAM_ID
            },
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") and "had_graffiti" in data:
                log_test("Clear with valid requester", "PASS", f"Status: {response.status_code}, Response: {data}")
                passed_tests += 1
            else:
                log_test("Clear with valid requester", "FAIL", f"Missing had_graffiti field: {data}")
                failed_tests.append("Clear with valid requester - missing had_graffiti")
        else:
            log_test("Clear with valid requester", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            failed_tests.append("Clear with valid requester - wrong status code")
    except Exception as e:
        log_test("Clear with valid requester", "FAIL", f"Exception: {e}")
        failed_tests.append("Clear with valid requester - exception")
    
    # Test 11: Clear invalid JSON body
    print("\n🚫 TEST 11: Clear invalid JSON body")
    total_tests += 1
    try:
        response = requests.post(
            f"{BACKEND_URL}/profile/{TEST_TELEGRAM_ID}/graffiti/clear",
            data="not-json",  # Invalid JSON
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 400:
            data = response.json()
            if "JSON" in data.get("detail", "").upper() or "json" in data.get("detail", ""):
                log_test("Clear invalid JSON", "PASS", f"Status: {response.status_code}, Response: {data}")
                passed_tests += 1
            else:
                log_test("Clear invalid JSON", "FAIL", f"Wrong error message: {data}")
                failed_tests.append("Clear invalid JSON - wrong error message")
        else:
            log_test("Clear invalid JSON", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            failed_tests.append("Clear invalid JSON - wrong status code")
    except Exception as e:
        log_test("Clear invalid JSON", "FAIL", f"Exception: {e}")
        failed_tests.append("Clear invalid JSON - exception")
    
    # Test 12: Clear with wrong requester
    print("\n🔒 TEST 12: Clear with wrong requester")
    total_tests += 1
    try:
        response = requests.post(
            f"{BACKEND_URL}/profile/{TEST_TELEGRAM_ID}/graffiti/clear",
            json={
                "requester_telegram_id": INVALID_REQUESTER_ID  # Wrong requester
            },
            timeout=10
        )
        
        if response.status_code == 403:
            log_test("Clear with wrong requester", "PASS", f"Status: {response.status_code}, Response: {response.json()}")
            passed_tests += 1
        else:
            log_test("Clear with wrong requester", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            failed_tests.append("Clear with wrong requester - wrong status code")
    except Exception as e:
        log_test("Clear with wrong requester", "FAIL", f"Exception: {e}")
        failed_tests.append("Clear with wrong requester - exception")
    
    # Test 13: Clear non-existent graffiti
    print("\n❌ TEST 13: Clear non-existent graffiti")
    total_tests += 1
    try:
        # First ensure no graffiti exists
        clear_response = requests.post(
            f"{BACKEND_URL}/profile/{TEST_TELEGRAM_ID}/graffiti/clear",
            json={
                "requester_telegram_id": TEST_TELEGRAM_ID
            },
            timeout=10
        )
        
        # Then try to clear again
        response = requests.post(
            f"{BACKEND_URL}/profile/{TEST_TELEGRAM_ID}/graffiti/clear",
            json={
                "requester_telegram_id": TEST_TELEGRAM_ID
            },
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") and data.get("had_graffiti") == False:
                log_test("Clear non-existent", "PASS", f"Status: {response.status_code}, had_graffiti: {data.get('had_graffiti')}")
                passed_tests += 1
            else:
                log_test("Clear non-existent", "FAIL", f"Wrong had_graffiti value: {data}")
                failed_tests.append("Clear non-existent - wrong had_graffiti value")
        else:
            log_test("Clear non-existent", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            failed_tests.append("Clear non-existent - wrong status code")
    except Exception as e:
        log_test("Clear non-existent", "FAIL", f"Exception: {e}")
        failed_tests.append("Clear non-existent - exception")
    
    # Test 14: Full sequence - Save, Get, Clear, Get again
    print("\n🔄 TEST 14: Full sequence (Save → Get → Clear → Get)")
    total_tests += 1
    try:
        # Step 1: Save
        save_response = requests.put(
            f"{BACKEND_URL}/profile/{TEST_TELEGRAM_ID}/graffiti",
            json={
                "graffiti_data": VALID_BASE64_IMAGE,
                "requester_telegram_id": TEST_TELEGRAM_ID
            },
            timeout=10
        )
        
        # Step 2: Get (should have data)
        get1_response = requests.get(
            f"{BACKEND_URL}/profile/{TEST_TELEGRAM_ID}/graffiti",
            timeout=10
        )
        
        # Step 3: Clear
        clear_response = requests.post(
            f"{BACKEND_URL}/profile/{TEST_TELEGRAM_ID}/graffiti/clear",
            json={
                "requester_telegram_id": TEST_TELEGRAM_ID
            },
            timeout=10
        )
        
        # Step 4: Get again (should be empty)
        get2_response = requests.get(
            f"{BACKEND_URL}/profile/{TEST_TELEGRAM_ID}/graffiti",
            timeout=10
        )
        
        # Validate sequence
        if (save_response.status_code == 200 and 
            get1_response.status_code == 200 and 
            clear_response.status_code == 200 and 
            get2_response.status_code == 200):
            
            get1_data = get1_response.json()
            clear_data = clear_response.json()
            get2_data = get2_response.json()
            
            if (get1_data.get("graffiti_data") == VALID_BASE64_IMAGE and
                clear_data.get("had_graffiti") == True and
                get2_data.get("graffiti_data") == "" and
                get2_data.get("graffiti_updated_at") is None):
                
                log_test("Full sequence", "PASS", "Save → Get (has data) → Clear (had_graffiti=true) → Get (empty)")
                passed_tests += 1
            else:
                log_test("Full sequence", "FAIL", f"Data validation failed. Get1: {get1_data}, Clear: {clear_data}, Get2: {get2_data}")
                failed_tests.append("Full sequence - data validation failed")
        else:
            log_test("Full sequence", "FAIL", f"HTTP errors: Save={save_response.status_code}, Get1={get1_response.status_code}, Clear={clear_response.status_code}, Get2={get2_response.status_code}")
            failed_tests.append("Full sequence - HTTP errors")
    except Exception as e:
        log_test("Full sequence", "FAIL", f"Exception: {e}")
        failed_tests.append("Full sequence - exception")
    
    # Summary
    print("\n" + "=" * 60)
    print("🏁 GRAFFITI API TESTING SUMMARY")
    print("=" * 60)
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {len(failed_tests)}")
    print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
    
    if failed_tests:
        print("\n❌ FAILED TESTS:")
        for i, test in enumerate(failed_tests, 1):
            print(f"  {i}. {test}")
    else:
        print("\n✅ ALL TESTS PASSED!")
    
    return passed_tests, total_tests, failed_tests

if __name__ == "__main__":
    print("🚀 Starting Graffiti API Comprehensive Testing")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Telegram ID: {TEST_TELEGRAM_ID}")
    print()
    
    passed, total, failed = test_graffiti_endpoints()
    
    # Exit with appropriate code
    if len(failed) == 0:
        print("\n🎉 All tests passed successfully!")
        sys.exit(0)
    else:
        print(f"\n💥 {len(failed)} tests failed!")
        sys.exit(1)