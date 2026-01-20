#!/usr/bin/env python3
"""
Comprehensive Backend API Testing Script for Journal Owner Linking
Tests various scenarios for journal owner linking functionality.
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
TEST_OWNER_ID = 987654321  # Different owner ID for comprehensive test
TEST_USERNAME = "comprehensive_owner"
TEST_FIRST_NAME = "Comprehensive"
TEST_LAST_NAME = "Owner"

def create_test_journal():
    """Create a test journal for comprehensive testing"""
    print("🏗️  Creating comprehensive test journal...")
    
    try:
        journal_data = {
            "name": f"Comprehensive Test Journal {datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "group_name": "ИКБО-02-21",
            "description": "Comprehensive test journal for owner linking scenarios",
            "telegram_id": TEST_OWNER_ID,
            "color": "green"
        }
        
        url = f"{API_BASE}/journals"
        print(f"📡 Making request to: {url}")
        
        response = requests.post(url, json=journal_data, timeout=10)
        print(f"📊 Response Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            print(f"📄 Response body: {response.text}")
            return None
        
        data = response.json()
        journal_id = data.get('journal_id')
        print(f"✅ Comprehensive test journal created with ID: {journal_id}")
        return journal_id
        
    except Exception as e:
        print(f"❌ FAILED: Error creating comprehensive test journal - {e}")
        return None

def add_multiple_test_students(journal_id):
    """Add multiple test students to the journal"""
    print("👥 Adding multiple test students to journal...")
    
    students = [
        {"full_name": "Owner Student", "group_number": "ИКБО-02-21"},
        {"full_name": "Regular Student 1", "group_number": "ИКБО-02-21"},
        {"full_name": "Regular Student 2", "group_number": "ИКБО-02-21"}
    ]
    
    created_students = []
    
    for i, student_data in enumerate(students):
        try:
            url = f"{API_BASE}/journals/{journal_id}/students"
            response = requests.post(url, json=student_data, timeout=10)
            
            if response.status_code != 200:
                print(f"❌ FAILED: Could not create student {i+1}")
                continue
            
            data = response.json()
            student_id = data.get('id')
            invite_code = data.get('invite_code')
            
            created_students.append({
                'name': student_data['full_name'],
                'id': student_id,
                'invite_code': invite_code
            })
            
            print(f"✅ Student '{student_data['full_name']}' added with invite_code: {invite_code}")
            
        except Exception as e:
            print(f"❌ FAILED: Error adding student {i+1} - {e}")
    
    return created_students

def test_owner_linking_to_first_student(invite_code):
    """Test owner linking to the first student (should succeed)"""
    print("🔗 Testing owner linking to first student...")
    
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
        response = requests.post(url, json=request_data, timeout=10)
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Should succeed
        if not data.get('success'):
            print(f"❌ FAILED: Expected success=true, got {data}")
            return False
        
        status = data.get('status')
        if status not in ['linked', 'success']:
            print(f"❌ FAILED: Expected status 'linked' or 'success', got '{status}'")
            return False
        
        print("✅ Owner successfully linked to first student")
        return True
        
    except Exception as e:
        print(f"❌ FAILED: Error in owner linking test - {e}")
        return False

def test_owner_linking_to_second_student(invite_code):
    """Test owner trying to link to second student (should fail - already linked)"""
    print("🚫 Testing owner linking to second student (should fail)...")
    
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
        response = requests.post(url, json=request_data, timeout=10)
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Should fail because already linked to another student
        if data.get('success'):
            status = data.get('status')
            if status == 'already_linked_other':
                print("✅ Correctly rejected - owner already linked to another student")
                return True
            else:
                print(f"❌ FAILED: Expected rejection, but got success with status '{status}'")
                return False
        else:
            status = data.get('status')
            if status == 'already_linked_other':
                print("✅ Correctly rejected - owner already linked to another student")
                return True
            else:
                print(f"❌ FAILED: Unexpected failure status: {status}")
                return False
        
    except Exception as e:
        print(f"❌ FAILED: Error in second linking test - {e}")
        return False

def test_different_user_linking_to_occupied_student(invite_code):
    """Test different user trying to link to already occupied student"""
    print("👤 Testing different user linking to occupied student...")
    
    try:
        request_data = {
            "telegram_id": 555666777,  # Different user
            "username": "different_user",
            "first_name": "Different",
            "last_name": "User",
            "invite_type": "jstudent",
            "invite_code": invite_code
        }
        
        url = f"{API_BASE}/journals/process-webapp-invite"
        response = requests.post(url, json=request_data, timeout=10)
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Should fail because student is already occupied
        if data.get('success'):
            print(f"❌ FAILED: Expected failure, but got success: {data}")
            return False
        
        status = data.get('status')
        if status == 'occupied':
            print("✅ Correctly rejected - student already occupied by another user")
            return True
        else:
            print(f"❌ FAILED: Expected 'occupied' status, got '{status}'")
            return False
        
    except Exception as e:
        print(f"❌ FAILED: Error in occupied student test - {e}")
        return False

def test_owner_relinking_to_same_student(invite_code):
    """Test owner trying to link again to the same student (should show already linked)"""
    print("🔄 Testing owner relinking to same student...")
    
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
        response = requests.post(url, json=request_data, timeout=10)
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Should succeed with already_linked status
        if not data.get('success'):
            print(f"❌ FAILED: Expected success=true, got {data}")
            return False
        
        status = data.get('status')
        if status == 'already_linked':
            print("✅ Correctly shows already linked to same student")
            return True
        else:
            print(f"❌ FAILED: Expected 'already_linked' status, got '{status}'")
            return False
        
    except Exception as e:
        print(f"❌ FAILED: Error in relinking test - {e}")
        return False

def cleanup_test_journal(journal_id):
    """Clean up the comprehensive test journal"""
    print(f"🧹 Cleaning up comprehensive test journal {journal_id}...")
    
    try:
        url = f"{API_BASE}/journals/{journal_id}"
        response = requests.delete(url, timeout=10)
        
        if response.status_code == 200:
            print("✅ Comprehensive test journal cleaned up successfully")
        else:
            print(f"⚠️  Warning: Could not clean up comprehensive test journal (status: {response.status_code})")
            
    except Exception as e:
        print(f"⚠️  Warning: Error cleaning up comprehensive test journal - {e}")

def main():
    """Run comprehensive journal owner linking tests"""
    print("🚀 Starting Comprehensive Journal Owner Linking Tests")
    print("=" * 70)
    
    # Step 1: Create test journal
    journal_id = create_test_journal()
    if not journal_id:
        print("💥 Cannot proceed without test journal")
        return 1
    
    try:
        # Step 2: Add multiple test students
        students = add_multiple_test_students(journal_id)
        if len(students) < 3:
            print("💥 Cannot proceed without sufficient test students")
            return 1
        
        owner_student = students[0]  # "Owner Student"
        regular_student1 = students[1]  # "Regular Student 1"
        regular_student2 = students[2]  # "Regular Student 2"
        
        # Step 3: Test owner linking to first student (should succeed)
        test1_passed = test_owner_linking_to_first_student(owner_student['invite_code'])
        
        # Step 4: Test owner trying to link to second student (should fail)
        test2_passed = test_owner_linking_to_second_student(regular_student1['invite_code'])
        
        # Step 5: Test different user trying to link to occupied student (should fail)
        test3_passed = test_different_user_linking_to_occupied_student(owner_student['invite_code'])
        
        # Step 6: Test owner relinking to same student (should show already linked)
        test4_passed = test_owner_relinking_to_same_student(owner_student['invite_code'])
        
        print("\n" + "=" * 70)
        print("📊 COMPREHENSIVE TEST SUMMARY")
        print("=" * 70)
        
        tests = [
            ("Owner Links to First Student", test1_passed),
            ("Owner Rejected for Second Student", test2_passed),
            ("Different User Rejected for Occupied Student", test3_passed),
            ("Owner Relinking Shows Already Linked", test4_passed)
        ]
        
        for test_name, passed in tests:
            if passed:
                print(f"✅ {test_name}: PASSED")
            else:
                print(f"❌ {test_name}: FAILED")
        
        all_passed = all(passed for _, passed in tests)
        
        if all_passed:
            print("\n🎉 All comprehensive tests PASSED!")
            print("✅ Journal owner linking functionality works correctly")
            print("✅ Proper validation for multiple linking scenarios")
            print("✅ No rejection with 'owner' status message")
            return 0
        else:
            print("\n💥 Some comprehensive tests FAILED!")
            return 1
            
    finally:
        # Always clean up
        cleanup_test_journal(journal_id)

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)