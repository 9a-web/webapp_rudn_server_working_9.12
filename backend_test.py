#!/usr/bin/env python3
"""
Backend test for Profile module endpoints of RUDN Schedule Telegram Web App.
Tests all critical profile functionality including birthday validation, privacy settings, QR codes, and account deletion.
"""
import asyncio
import aiohttp
import json
from datetime import datetime

# Backend URL - using localhost:8001 for internal testing
BACKEND_URL = "http://localhost:8001"
API_BASE = f"{BACKEND_URL}/api"

# Test user IDs
TEST_USER_ID = 999999999
TEST_EXTERNAL_USER_ID = 888888888
TEST_DELETE_USER_ID = 999999998

async def create_test_user(session, telegram_id, username="testuser", first_name="Test"):
    """Create a test user via POST /api/user-settings"""
    print(f"📝 Creating test user {telegram_id}...")
    
    user_data = {
        "telegram_id": telegram_id,
        "username": username,
        "first_name": first_name,
        "group_id": "test_group_123",
        "group_name": "Тестовая группа",
        "facultet_id": "test_faculty",
        "level_id": "test_level",
        "kurs": "1",
        "form_code": "test_form"
    }
    
    async with session.post(f"{API_BASE}/user-settings", json=user_data) as resp:
        if resp.status == 200:
            data = await resp.json()
            print(f"✅ Test user {telegram_id} created successfully")
            return True
        else:
            text = await resp.text()
            print(f"❌ Failed to create test user {telegram_id}: HTTP {resp.status}")
            print(f"Response: {text}")
            return False

async def test_birthday_validation(session):
    """Test birthday validation endpoint - PUT /api/user-settings/{telegram_id}/birthday"""
    print(f"\n🎂 Testing birthday validation...")
    
    test_cases = [
        # Valid cases
        {"birth_date": "15.06.2000", "expected_status": 200, "description": "Valid date"},
        
        # Invalid cases
        {"birth_date": "15.13.2000", "expected_status": 400, "description": "Invalid month (13)"},
        {"birth_date": "32.06.2000", "expected_status": 400, "description": "Invalid day (32)"},
        {"birth_date": "15.06.1900", "expected_status": 400, "description": "Invalid year (1900)"},
        {"birth_date": "2000-06-15", "expected_status": 400, "description": "Invalid format (YYYY-MM-DD)"},
        {"birth_date": "31.02.2000", "expected_status": 400, "description": "Invalid day for February"},
    ]
    
    results = []
    
    for test_case in test_cases:
        birth_date = test_case["birth_date"]
        expected_status = test_case["expected_status"]
        description = test_case["description"]
        
        print(f"  Testing: {description} - {birth_date}")
        
        async with session.put(
            f"{API_BASE}/user-settings/{TEST_USER_ID}/birthday",
            json={"birth_date": birth_date}
        ) as resp:
            actual_status = resp.status
            response_text = await resp.text()
            
            if actual_status == expected_status:
                print(f"    ✅ PASS: Expected {expected_status}, got {actual_status}")
                results.append(True)
            else:
                print(f"    ❌ FAIL: Expected {expected_status}, got {actual_status}")
                print(f"    Response: {response_text}")
                results.append(False)
    
    success_rate = sum(results) / len(results) * 100
    print(f"  Birthday validation: {sum(results)}/{len(results)} tests passed ({success_rate:.1f}%)")
    return all(results)

async def test_profile_endpoint(session):
    """Test profile endpoint - GET /api/profile/{telegram_id}"""
    print(f"\n👤 Testing profile endpoint...")
    
    results = []
    
    # Test 1: Get own profile
    print(f"  Testing: Get own profile")
    async with session.get(f"{API_BASE}/profile/{TEST_USER_ID}") as resp:
        if resp.status == 200:
            data = await resp.json()
            print(f"    ✅ PASS: Own profile retrieved successfully")
            print(f"    Profile data keys: {list(data.keys())}")
            results.append(True)
        else:
            text = await resp.text()
            print(f"    ❌ FAIL: HTTP {resp.status} - {text}")
            results.append(False)
    
    # Test 2: Get profile as viewer (should include privacy object)
    print(f"  Testing: Get profile as viewer (same user)")
    async with session.get(f"{API_BASE}/profile/{TEST_USER_ID}?viewer_telegram_id={TEST_USER_ID}") as resp:
        if resp.status == 200:
            data = await resp.json()
            if "privacy" in data and data["privacy"] is not None:
                print(f"    ✅ PASS: Profile with privacy object retrieved")
                results.append(True)
            else:
                print(f"    ❌ FAIL: Privacy object missing or null for owner")
                results.append(False)
        else:
            text = await resp.text()
            print(f"    ❌ FAIL: HTTP {resp.status} - {text}")
            results.append(False)
    
    # Test 3: Get profile as external viewer (privacy should be null)
    print(f"  Testing: Get profile as external viewer")
    async with session.get(f"{API_BASE}/profile/{TEST_USER_ID}?viewer_telegram_id={TEST_EXTERNAL_USER_ID}") as resp:
        if resp.status == 200:
            data = await resp.json()
            if "privacy" not in data or data["privacy"] is None:
                print(f"    ✅ PASS: Privacy object correctly hidden from external viewer")
                results.append(True)
            else:
                print(f"    ❌ FAIL: Privacy object exposed to external viewer")
                results.append(False)
        else:
            text = await resp.text()
            print(f"    ❌ FAIL: HTTP {resp.status} - {text}")
            results.append(False)
    
    success_rate = sum(results) / len(results) * 100
    print(f"  Profile endpoint: {sum(results)}/{len(results)} tests passed ({success_rate:.1f}%)")
    return all(results)

async def test_privacy_settings(session):
    """Test privacy settings endpoints"""
    print(f"\n🔒 Testing privacy settings...")
    
    results = []
    
    # Test 1: Update privacy settings
    print(f"  Testing: Update privacy settings")
    privacy_data = {"show_online_status": False}
    
    async with session.put(f"{API_BASE}/profile/{TEST_USER_ID}/privacy", json=privacy_data) as resp:
        if resp.status == 200:
            data = await resp.json()
            print(f"    ✅ PASS: Privacy settings updated successfully")
            results.append(True)
        else:
            text = await resp.text()
            print(f"    ❌ FAIL: HTTP {resp.status} - {text}")
            results.append(False)
    
    # Test 2: Read back privacy settings
    print(f"  Testing: Read privacy settings")
    async with session.get(f"{API_BASE}/profile/{TEST_USER_ID}/privacy") as resp:
        if resp.status == 200:
            data = await resp.json()
            if data.get("show_online_status") == False:
                print(f"    ✅ PASS: Privacy settings read correctly")
                results.append(True)
            else:
                print(f"    ❌ FAIL: Privacy settings not saved correctly")
                print(f"    Expected show_online_status=False, got: {data}")
                results.append(False)
        else:
            text = await resp.text()
            print(f"    ❌ FAIL: HTTP {resp.status} - {text}")
            results.append(False)
    
    success_rate = sum(results) / len(results) * 100
    print(f"  Privacy settings: {sum(results)}/{len(results)} tests passed ({success_rate:.1f}%)")
    return all(results)

async def test_qr_code_endpoint(session):
    """Test QR code endpoint - GET /api/profile/{telegram_id}/qr"""
    print(f"\n📱 Testing QR code endpoint...")
    
    async with session.get(f"{API_BASE}/profile/{TEST_USER_ID}/qr") as resp:
        if resp.status == 200:
            data = await resp.json()
            required_fields = ["qr_data", "telegram_id", "display_name"]
            
            missing_fields = [field for field in required_fields if field not in data]
            
            if not missing_fields:
                print(f"    ✅ PASS: QR code data retrieved with all required fields")
                print(f"    QR data keys: {list(data.keys())}")
                return True
            else:
                print(f"    ❌ FAIL: Missing required fields: {missing_fields}")
                print(f"    Response: {data}")
                return False
        else:
            text = await resp.text()
            print(f"    ❌ FAIL: HTTP {resp.status} - {text}")
            return False

async def test_account_deletion(session):
    """Test account deletion completeness - DELETE /api/user/{telegram_id}"""
    print(f"\n🗑️ Testing account deletion...")
    
    results = []
    
    # First create a user to delete
    if await create_test_user(session, TEST_DELETE_USER_ID, "deleteuser", "Delete"):
        results.append(True)
    else:
        print(f"    ❌ FAIL: Could not create user for deletion test")
        return False
    
    # Test deletion
    print(f"  Testing: Delete user {TEST_DELETE_USER_ID}")
    async with session.delete(f"{API_BASE}/user/{TEST_DELETE_USER_ID}") as resp:
        if resp.status == 200:
            data = await resp.json()
            if data.get("success") == True:
                print(f"    ✅ PASS: User deletion successful")
                print(f"    Response: {data.get('message', 'No message')}")
                results.append(True)
            else:
                print(f"    ❌ FAIL: Deletion response indicates failure")
                print(f"    Response: {data}")
                results.append(False)
        else:
            text = await resp.text()
            print(f"    ❌ FAIL: HTTP {resp.status} - {text}")
            results.append(False)
    
    # Verify user is actually deleted by trying to get their settings
    print(f"  Verifying: User {TEST_DELETE_USER_ID} is actually deleted")
    async with session.get(f"{API_BASE}/user-settings/{TEST_DELETE_USER_ID}") as resp:
        if resp.status == 404:
            print(f"    ✅ PASS: User correctly deleted (404 when trying to access)")
            results.append(True)
        else:
            print(f"    ❌ FAIL: User still exists after deletion (HTTP {resp.status})")
            results.append(False)
    
    success_rate = sum(results) / len(results) * 100
    print(f"  Account deletion: {sum(results)}/{len(results)} tests passed ({success_rate:.1f}%)")
    return all(results)

async def cleanup_test_user(session, telegram_id):
    """Clean up test user"""
    print(f"🧹 Cleaning up test user {telegram_id}...")
    
    async with session.delete(f"{API_BASE}/user/{telegram_id}") as resp:
        if resp.status == 200:
            print(f"✅ Test user {telegram_id} cleaned up successfully")
            return True
        else:
            text = await resp.text()
            print(f"⚠️ Failed to clean up test user {telegram_id}: HTTP {resp.status}")
            print(f"Response: {text}")
            return False

async def main():
    """Run all Profile module tests"""
    print(f"🎯 Testing Profile module backend at: {BACKEND_URL}")
    print(f"📋 Test user ID: {TEST_USER_ID}")
    print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    test_results = []
    
    try:
        async with aiohttp.ClientSession() as session:
            
            # Create test user first
            if not await create_test_user(session, TEST_USER_ID):
                print(f"\n💥 CRITICAL: Could not create test user. Aborting tests.")
                return 1
            
            # Run all tests
            print(f"\n" + "="*60)
            print(f"🧪 RUNNING PROFILE MODULE TESTS")
            print(f"="*60)
            
            # Test 1: Birthday validation
            birthday_result = await test_birthday_validation(session)
            test_results.append(("Birthday Validation", birthday_result))
            
            # Test 2: Profile endpoint
            profile_result = await test_profile_endpoint(session)
            test_results.append(("Profile Endpoint", profile_result))
            
            # Test 3: Privacy settings
            privacy_result = await test_privacy_settings(session)
            test_results.append(("Privacy Settings", privacy_result))
            
            # Test 4: QR code
            qr_result = await test_qr_code_endpoint(session)
            test_results.append(("QR Code Endpoint", qr_result))
            
            # Test 5: Account deletion
            deletion_result = await test_account_deletion(session)
            test_results.append(("Account Deletion", deletion_result))
            
            # Clean up main test user
            await cleanup_test_user(session, TEST_USER_ID)
            
            # Print summary
            print(f"\n" + "="*60)
            print(f"📊 TEST RESULTS SUMMARY")
            print(f"="*60)
            
            passed_tests = 0
            total_tests = len(test_results)
            
            for test_name, result in test_results:
                status = "✅ PASS" if result else "❌ FAIL"
                print(f"{status} {test_name}")
                if result:
                    passed_tests += 1
            
            success_rate = passed_tests / total_tests * 100
            print(f"\n🎯 Overall: {passed_tests}/{total_tests} tests passed ({success_rate:.1f}%)")
            
            if passed_tests == total_tests:
                print(f"🎉 ALL PROFILE MODULE TESTS PASSED!")
                return 0
            else:
                print(f"💥 SOME TESTS FAILED - Profile module has issues")
                return 1
                
    except Exception as e:
        print(f"\n💥 TEST ERROR: {e}")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)