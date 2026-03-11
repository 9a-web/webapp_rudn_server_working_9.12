#!/usr/bin/env python3
"""
Backend API test script for RUDN Schedule Telegram Web App - Streak feature testing.
Tests only the streak-related endpoints as specified in the review request.
"""

import requests
import json
import sys
from datetime import datetime

# Get backend URL from frontend/.env
BACKEND_URL = "https://rudn-schedule.ru"
API_BASE_URL = f"{BACKEND_URL}/api"
TEST_USER_ID = 999999

def test_streak_endpoints():
    """Test streak feature endpoints with proper flow"""
    print("=" * 60)
    print("RUDN Schedule - Streak Feature Backend Testing")
    print("=" * 60)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test User ID: {TEST_USER_ID}")
    print()
    
    # Test 1: First visit call
    print("1. Testing POST /api/users/999999/visit (First call)")
    print("-" * 50)
    
    try:
        response = requests.post(f"{API_BASE_URL}/users/{TEST_USER_ID}/visit", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
            
            # Validate required fields
            required_fields = ['visit_streak_current', 'visit_streak_max', 'freeze_shields', 
                             'is_new_day', 'week_days', 'milestone_reached']
            
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                print(f"❌ MISSING FIELDS: {missing_fields}")
                return False
            
            # Validate week_days array
            if not isinstance(data['week_days'], list) or len(data['week_days']) != 7:
                print(f"❌ INVALID week_days: Expected array of 7 elements, got {len(data.get('week_days', []))}")
                return False
                
            # Check if streak is at least 1 on first call
            if data['visit_streak_current'] < 1:
                print(f"❌ INVALID streak: Expected streak >= 1, got {data['visit_streak_current']}")
                return False
            
            print("✅ First visit call - PASSED")
            first_call_is_new_day = data['is_new_day']
            first_call_streak = data['visit_streak_current']
            
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False
    
    print()
    
    # Test 2: Second visit call (same day)
    print("2. Testing POST /api/users/999999/visit (Second call - same day)")
    print("-" * 50)
    
    try:
        response = requests.post(f"{API_BASE_URL}/users/{TEST_USER_ID}/visit", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
            
            # Validate is_new_day should be false on same day
            if data['is_new_day'] != False:
                print(f"❌ INVALID is_new_day: Expected False on same day, got {data['is_new_day']}")
                return False
                
            # Streak should remain the same
            if data['visit_streak_current'] != first_call_streak:
                print(f"❌ STREAK CHANGED: Expected {first_call_streak}, got {data['visit_streak_current']}")
                return False
            
            print("✅ Second visit call - PASSED")
            
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False
    
    print()
    
    # Test 3: First streak claim
    print("3. Testing POST /api/users/999999/streak-claim (First call)")
    print("-" * 50)
    
    try:
        response = requests.post(f"{API_BASE_URL}/users/{TEST_USER_ID}/streak-claim", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
            
            # Validate required fields for success response
            if 'success' not in data or 'message' not in data:
                print("❌ MISSING FIELDS: Expected 'success' and 'message' fields")
                return False
                
            if data['success'] != True:
                print(f"❌ INVALID success: Expected True, got {data['success']}")
                return False
            
            print("✅ First streak claim - PASSED")
            
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False
    
    print()
    
    # Test 4: Second streak claim (idempotency test)
    print("4. Testing POST /api/users/999999/streak-claim (Second call - idempotency)")
    print("-" * 50)
    
    try:
        response = requests.post(f"{API_BASE_URL}/users/{TEST_USER_ID}/streak-claim", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
            
            # Should still return success but with already claimed message
            if data['success'] != True:
                print(f"❌ INVALID success: Expected True, got {data['success']}")
                return False
                
            # Check for already claimed message
            if "уже была получена" not in data['message']:
                print(f"❌ INVALID message: Expected 'уже была получена' in message, got '{data['message']}'")
                return False
            
            print("✅ Second streak claim (idempotency) - PASSED")
            
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False
    
    print()
    
    # Test 5: Get user stats
    print("5. Testing GET /api/user-stats/999999")
    print("-" * 50)
    
    try:
        response = requests.get(f"{API_BASE_URL}/user-stats/{TEST_USER_ID}", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
            
            # Validate required streak fields
            streak_fields = ['visit_streak_current', 'visit_streak_max', 'last_visit_date', 
                           'freeze_shields', 'streak_claimed_today']
            
            missing_fields = [field for field in streak_fields if field not in data]
            if missing_fields:
                print(f"❌ MISSING STREAK FIELDS: {missing_fields}")
                return False
            
            # Check that streak_claimed_today is True after claiming
            if data['streak_claimed_today'] != True:
                print(f"❌ INVALID streak_claimed_today: Expected True after claiming, got {data['streak_claimed_today']}")
                return False
            
            print("✅ Get user stats - PASSED")
            
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False
    
    print()
    print("=" * 60)
    print("✅ ALL STREAK ENDPOINT TESTS COMPLETED SUCCESSFULLY")
    print("=" * 60)
    return True

def main():
    """Main test runner"""
    try:
        success = test_streak_endpoints()
        if success:
            print("\n🎉 All streak tests passed!")
            sys.exit(0)
        else:
            print("\n💥 Some streak tests failed!")
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()