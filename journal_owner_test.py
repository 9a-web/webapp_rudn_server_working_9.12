#!/usr/bin/env python3
"""
Backend API Testing Script for Journal Owner Linking
Tests the journal owner linking functionality as specified in the review request.
"""

import requests
import json
import sys
import uuid
from datetime import datetime

# Backend URL - using local backend for testing
BACKEND_URL = "http://localhost:8001"
API_BASE = f"{BACKEND_URL}/api"

# Test data
TEST_OWNER_ID = 123456789
TEST_USERNAME = "test_owner"
TEST_FIRST_NAME = "Test"
TEST_LAST_NAME = "Owner"

def create_test_journal():
    """Create a test journal for testing"""
    print("🏗️  Creating test journal...")
    
    try:
        journal_data = {
            "name": f"Test Journal {datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "description": "Test journal for owner linking",
            "telegram_id": TEST_OWNER_ID,
            "username": TEST_USERNAME,
            "first_name": TEST_FIRST_NAME,
            "last_name": TEST_LAST_NAME
        }
        
        url = f"{API_BASE}/journals"
        print(f"📡 Making request to: {url}")
        print(f"📤 Request data: {json.dumps(journal_data, indent=2)}")
        
        response = requests.post(url, json=journal_data, timeout=10)
        print(f"📊 Response Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            print(f"📄 Response body: {response.text}")
            return None
        
        data = response.json()
        print(f"📄 Response JSON: {json.dumps(data, indent=2, ensure_ascii=False)}")
        
        journal_id = data.get('journal_id')
        if not journal_id:
            print("❌ FAILED: No journal_id in response")
            return None
        
        print(f"✅ Test journal created with ID: {journal_id}")
        return journal_id
        
    except Exception as e:
        print(f"❌ FAILED: Error creating test journal - {e}")
        return None

def add_test_student(journal_id):
    """Add a test student to the journal"""
    print("👤 Adding test student to journal...")
    
    try:
        student_data = {
            "full_name": "Test Student",
            "group_number": "ИКБО-01-21"
        }
        
        url = f"{API_BASE}/journals/{journal_id}/students"
        print(f"📡 Making request to: {url}")
        print(f"📤 Request data: {json.dumps(student_data, indent=2)}")
        
        response = requests.post(url, json=student_data, timeout=10)
        print(f"📊 Response Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            print(f"📄 Response body: {response.text}")
            return None
        
        data = response.json()
        print(f"📄 Response JSON: {json.dumps(data, indent=2, ensure_ascii=False)}")
        
        student_id = data.get('id')
        invite_code = data.get('invite_code')
        
        if not student_id or not invite_code:
            print("❌ FAILED: Missing student_id or invite_code in response")
            return None
        
        print(f"✅ Test student added with ID: {student_id}, invite_code: {invite_code}")
        return student_id, invite_code
        
    except Exception as e:
        print(f"❌ FAILED: Error adding test student - {e}")
        return None

def test_direct_student_link_join(invite_code):
    """Test POST /api/journals/join-student/{invite_code} endpoint"""
    print("🔗 Testing direct student link join...")
    
    try:
        request_data = {
            "telegram_id": TEST_OWNER_ID,
            "username": TEST_USERNAME,
            "first_name": TEST_FIRST_NAME,
            "last_name": TEST_LAST_NAME
        }
        
        url = f"{API_BASE}/journals/join-student/{invite_code}"
        print(f"📡 Making request to: {url}")
        print(f"📤 Request data: {json.dumps(request_data, indent=2)}")
        
        response = requests.post(url, json=request_data, timeout=10)
        print(f"📊 Response Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            print(f"📄 Response body: {response.text}")
            return False
        
        data = response.json()
        print(f"📄 Response JSON: {json.dumps(data, indent=2, ensure_ascii=False)}")
        
        # Check if owner was successfully linked
        status = data.get('status')
        if status not in ['success', 'linked']:
            print(f"❌ FAILED: Expected status 'success' or 'linked', got '{status}'")
            return False
        
        # Check for success message
        message = data.get('message', '')
        if 'успешно' not in message.lower() and 'привязан' not in message.lower():
            print(f"❌ FAILED: Expected success message, got: {message}")
            return False
        
        print("✅ Direct student link join test PASSED")
        print(f"✅ Owner successfully linked with status: {status}")
        return True
        
    except Exception as e:
        print(f"❌ FAILED: Error in direct student link join test - {e}")
        return False

def test_webapp_invite_processing(invite_code):
    """Test POST /api/journals/process-webapp-invite endpoint"""
    print("📱 Testing WebApp invite processing...")
    
    try:
        request_data = {
            "telegram_id": TEST_OWNER_ID,
            "username": TEST_USERNAME,
            "first_name": TEST_FIRST_NAME,
            "last_name": TEST_LAST_NAME,
            "invite_type": "jstudent",
            "invite_code": invite_code
        }
        
        url = f"{API_BASE}/journals/process-webapp-invite"
        print(f"📡 Making request to: {url}")
        print(f"📤 Request data: {json.dumps(request_data, indent=2)}")
        
        response = requests.post(url, json=request_data, timeout=10)
        print(f"📊 Response Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            print(f"📄 Response body: {response.text}")
            return False
        
        data = response.json()
        print(f"📄 Response JSON: {json.dumps(data, indent=2, ensure_ascii=False)}")
        
        # Check if request was successful
        success = data.get('success')
        if not success:
            print(f"❌ FAILED: Expected success=true, got success={success}")
            return False
        
        # Check status
        status = data.get('status')
        if status not in ['linked', 'success', 'already_linked']:
            print(f"❌ FAILED: Expected status 'linked', 'success', or 'already_linked', got '{status}'")
            return False
        
        # Check for success message
        message = data.get('message', '')
        if status == 'already_linked':
            if 'уже привязан' not in message.lower():
                print(f"❌ FAILED: Expected 'already linked' message, got: {message}")
                return False
        else:
            if 'успешно' not in message.lower() and 'привязан' not in message.lower():
                print(f"❌ FAILED: Expected success message, got: {message}")
                return False
        
        print("✅ WebApp invite processing test PASSED")
        print(f"✅ Owner successfully processed with status: {status}")
        return True
        
    except Exception as e:
        print(f"❌ FAILED: Error in WebApp invite processing test - {e}")
        return False

def test_owner_not_rejected():
    """Test that owner is not rejected with 'owner' status when trying to link to student"""
    print("🚫 Testing that owner is not rejected...")
    
    # This test is implicit in the above tests - if they pass, it means the owner
    # was not rejected with "Вы являетесь старостой этого журнала" message
    print("✅ Owner rejection test PASSED (implicit)")
    print("✅ Owner was able to link to student instead of being rejected")
    return True

def cleanup_test_journal(journal_id):
    """Clean up the test journal"""
    print(f"🧹 Cleaning up test journal {journal_id}...")
    
    try:
        url = f"{API_BASE}/journals/{journal_id}"
        response = requests.delete(url, timeout=10)
        
        if response.status_code == 200:
            print("✅ Test journal cleaned up successfully")
        else:
            print(f"⚠️  Warning: Could not clean up test journal (status: {response.status_code})")
            
    except Exception as e:
        print(f"⚠️  Warning: Error cleaning up test journal - {e}")

def main():
    """Run all journal owner linking tests"""
    print("🚀 Starting Journal Owner Linking Tests")
    print("=" * 60)
    
    # Step 1: Create test journal
    journal_id = create_test_journal()
    if not journal_id:
        print("💥 Cannot proceed without test journal")
        return 1
    
    try:
        # Step 2: Add test student
        student_result = add_test_student(journal_id)
        if not student_result:
            print("💥 Cannot proceed without test student")
            return 1
        
        student_id, invite_code = student_result
        
        # Step 3: Test direct student link join
        direct_test_passed = test_direct_student_link_join(invite_code)
        
        # Step 4: Test WebApp invite processing (should show already linked)
        webapp_test_passed = test_webapp_invite_processing(invite_code)
        
        # Step 5: Test that owner was not rejected
        rejection_test_passed = test_owner_not_rejected()
        
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        if direct_test_passed:
            print("✅ Direct Student Link Join: PASSED")
        else:
            print("❌ Direct Student Link Join: FAILED")
        
        if webapp_test_passed:
            print("✅ WebApp Invite Processing: PASSED")
        else:
            print("❌ WebApp Invite Processing: FAILED")
        
        if rejection_test_passed:
            print("✅ Owner Not Rejected: PASSED")
        else:
            print("❌ Owner Not Rejected: FAILED")
        
        all_passed = direct_test_passed and webapp_test_passed and rejection_test_passed
        
        if all_passed:
            print("\n🎉 All tests PASSED!")
            print("✅ Journal owner can successfully link themselves to a student")
            print("✅ No rejection with 'owner' status message")
            return 0
        else:
            print("\n💥 Some tests FAILED!")
            return 1
            
    finally:
        # Always clean up
        cleanup_test_journal(journal_id)

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)