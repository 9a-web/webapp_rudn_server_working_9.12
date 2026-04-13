#!/usr/bin/env python3
"""
Backend API Testing for RUDN GO Level System
Tests the new Level System API endpoints
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "https://rudn-server-4.preview.emergentagent.com/api"
TEST_USER_ID = 123456
TEST_USER_ID_2 = 999999

def log_test(test_name, status, details=""):
    """Log test results"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_emoji = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"[{timestamp}] {status_emoji} {test_name}: {status}")
    if details:
        print(f"    {details}")

def test_get_user_level():
    """Test GET /api/users/{telegram_id}/level endpoint"""
    print("\n=== Testing GET /api/users/{telegram_id}/level ===")
    
    try:
        # Test with new user (should have 0 XP, level 1, tier base)
        url = f"{BACKEND_URL}/users/{TEST_USER_ID}/level"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields
            required_fields = ["status", "level", "tier", "xp", "xp_current_level", "xp_next_level", "xp_in_level", "xp_needed", "progress"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                log_test("Level endpoint structure", "FAIL", f"Missing fields: {missing_fields}")
                return False
            
            # For new user, expect level=1, tier="base", xp=0
            if data.get("level") == 1 and data.get("tier") == "base" and data.get("xp") == 0:
                log_test("New user level info", "PASS", f"Level: {data['level']}, Tier: {data['tier']}, XP: {data['xp']}")
            else:
                log_test("New user level info", "FAIL", f"Expected level=1, tier=base, xp=0. Got level={data.get('level')}, tier={data.get('tier')}, xp={data.get('xp')}")
                
            log_test("Level endpoint response", "PASS", f"All required fields present")
            return True
        else:
            log_test("Level endpoint", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_test("Level endpoint", "FAIL", f"Exception: {str(e)}")
        return False

def test_recalculate_user_xp():
    """Test POST /api/users/{telegram_id}/recalculate-xp endpoint"""
    print("\n=== Testing POST /api/users/{telegram_id}/recalculate-xp ===")
    
    try:
        url = f"{BACKEND_URL}/users/{TEST_USER_ID}/recalculate-xp"
        response = requests.post(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields
            required_fields = ["status", "telegram_id", "xp", "breakdown", "level", "tier"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                log_test("Recalculate XP structure", "FAIL", f"Missing fields: {missing_fields}")
                return False
            
            # Check breakdown structure
            breakdown = data.get("breakdown", {})
            breakdown_fields = ["tasks", "achievements", "visits", "streak_bonuses", "referrals", "group_tasks"]
            missing_breakdown = [field for field in breakdown_fields if field not in breakdown]
            
            if missing_breakdown:
                log_test("XP breakdown structure", "FAIL", f"Missing breakdown fields: {missing_breakdown}")
                return False
            
            log_test("Recalculate XP endpoint", "PASS", f"XP: {data['xp']}, Level: {data['level']}, Tier: {data['tier']}")
            log_test("XP breakdown", "PASS", f"Tasks: {breakdown['tasks']}, Achievements: {breakdown['achievements']}, Visits: {breakdown['visits']}")
            return True
        else:
            log_test("Recalculate XP endpoint", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_test("Recalculate XP endpoint", "FAIL", f"Exception: {str(e)}")
        return False

def test_recalculate_all_xp():
    """Test POST /api/users/recalculate-xp-all endpoint"""
    print("\n=== Testing POST /api/users/recalculate-xp-all ===")
    
    try:
        url = f"{BACKEND_URL}/users/recalculate-xp-all"
        response = requests.post(url, timeout=30)  # Longer timeout for batch operation
        
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields
            required_fields = ["status", "count", "results"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                log_test("Batch recalculate structure", "FAIL", f"Missing fields: {missing_fields}")
                return False
            
            count = data.get("count", 0)
            results = data.get("results", [])
            
            if len(results) == count:
                log_test("Batch recalculate XP", "PASS", f"Processed {count} users")
                
                # Check first result structure if available
                if results:
                    first_result = results[0]
                    result_fields = ["telegram_id", "xp", "level", "tier"]
                    missing_result_fields = [field for field in result_fields if field not in first_result]
                    
                    if missing_result_fields:
                        log_test("Batch result structure", "FAIL", f"Missing result fields: {missing_result_fields}")
                    else:
                        log_test("Batch result structure", "PASS", "All result fields present")
                
                return True
            else:
                log_test("Batch recalculate consistency", "FAIL", f"Count {count} != Results length {len(results)}")
                return False
        else:
            log_test("Batch recalculate XP", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_test("Batch recalculate XP", "FAIL", f"Exception: {str(e)}")
        return False

def test_level_calculation_logic():
    """Test level calculation logic with different XP amounts"""
    print("\n=== Testing Level Calculation Logic ===")
    
    test_cases = [
        (0, 1, "base"),
        (100, 2, "base"),
        (700, 5, "medium"),
        (3200, 10, "rare"),
        (22000, 20, "premium")
    ]
    
    all_passed = True
    
    for xp, expected_level, expected_tier in test_cases:
        try:
            # First, we need to set XP for a test user
            # We'll use the recalculate endpoint to test the logic
            url = f"{BACKEND_URL}/users/{TEST_USER_ID_2}/recalculate-xp"
            response = requests.post(url, timeout=10)
            
            if response.status_code == 200:
                # Now get the level info
                level_url = f"{BACKEND_URL}/users/{TEST_USER_ID_2}/level"
                level_response = requests.get(level_url, timeout=10)
                
                if level_response.status_code == 200:
                    data = level_response.json()
                    actual_level = data.get("level")
                    actual_tier = data.get("tier")
                    actual_xp = data.get("xp")
                    
                    # Note: We can't directly set XP, so we test with whatever XP the user has
                    log_test(f"Level calculation (XP={actual_xp})", "INFO", f"Level: {actual_level}, Tier: {actual_tier}")
                else:
                    log_test(f"Level calculation test (XP={xp})", "FAIL", f"Failed to get level info")
                    all_passed = False
            else:
                log_test(f"Level calculation test (XP={xp})", "FAIL", f"Failed to recalculate XP")
                all_passed = False
                
        except Exception as e:
            log_test(f"Level calculation test (XP={xp})", "FAIL", f"Exception: {str(e)}")
            all_passed = False
    
    # Test the calculation logic directly by importing the module
    try:
        import sys
        sys.path.append('/app/backend')
        from level_system import calculate_level_info
        
        for xp, expected_level, expected_tier in test_cases:
            result = calculate_level_info(xp)
            if result["level"] == expected_level and result["tier"] == expected_tier:
                log_test(f"Direct calculation (XP={xp})", "PASS", f"Level: {result['level']}, Tier: {result['tier']}")
            else:
                log_test(f"Direct calculation (XP={xp})", "FAIL", f"Expected L{expected_level}/{expected_tier}, got L{result['level']}/{result['tier']}")
                all_passed = False
                
    except Exception as e:
        log_test("Direct level calculation", "FAIL", f"Could not import level_system: {str(e)}")
        all_passed = False
    
    return all_passed

def test_profile_integration():
    """Test that profile endpoint includes new XP fields"""
    print("\n=== Testing Profile Integration ===")
    
    try:
        url = f"{BACKEND_URL}/profile/{TEST_USER_ID}?viewer_telegram_id={TEST_USER_ID}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for new XP fields in profile
            xp_fields = ["xp", "level", "tier", "xp_current_level", "xp_next_level", "xp_progress"]
            missing_xp_fields = [field for field in xp_fields if field not in data]
            
            if missing_xp_fields:
                log_test("Profile XP integration", "FAIL", f"Missing XP fields in profile: {missing_xp_fields}")
                return False
            else:
                log_test("Profile XP integration", "PASS", f"All XP fields present in profile")
                log_test("Profile XP values", "INFO", f"XP: {data['xp']}, Level: {data['level']}, Tier: {data['tier']}")
                return True
        else:
            log_test("Profile endpoint", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_test("Profile integration", "FAIL", f"Exception: {str(e)}")
        return False

def test_backend_health():
    """Test backend health and connectivity"""
    print("\n=== Testing Backend Health ===")
    
    try:
        # Test basic connectivity
        health_url = f"{BACKEND_URL.replace('/api', '')}/health"
        response = requests.get(health_url, timeout=10)
        
        if response.status_code == 200:
            log_test("Backend health", "PASS", "Backend is healthy")
        else:
            log_test("Backend health", "WARN", f"Health check returned {response.status_code}")
        
        # Test API root
        root_url = f"{BACKEND_URL}/"
        response = requests.get(root_url, timeout=10)
        
        if response.status_code == 200:
            log_test("API connectivity", "PASS", "API is accessible")
            return True
        else:
            log_test("API connectivity", "FAIL", f"API returned {response.status_code}")
            return False
            
    except Exception as e:
        log_test("Backend connectivity", "FAIL", f"Exception: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting Level System API Tests")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test User ID: {TEST_USER_ID}")
    
    test_results = []
    
    # Run all tests
    test_results.append(("Backend Health", test_backend_health()))
    test_results.append(("Get User Level", test_get_user_level()))
    test_results.append(("Recalculate User XP", test_recalculate_user_xp()))
    test_results.append(("Recalculate All XP", test_recalculate_all_xp()))
    test_results.append(("Level Calculation Logic", test_level_calculation_logic()))
    test_results.append(("Profile Integration", test_profile_integration()))
    
    # Summary
    print("\n" + "="*50)
    print("📊 TEST SUMMARY")
    print("="*50)
    
    passed = 0
    failed = 0
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print(f"\nTotal: {len(test_results)} tests")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    
    if failed == 0:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️ {failed} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())