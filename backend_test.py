#!/usr/bin/env python3
"""
Comprehensive Backend API Testing Script for РУДН Schedule App
Testing Journal Statistics API as requested in review
"""

import requests
import json
import sys
from datetime import datetime
import time

# Backend URL configuration
BACKEND_URL = "http://localhost:8001"
API_BASE = f"{BACKEND_URL}/api"

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_emoji = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"[{timestamp}] {status_emoji} {test_name}")
    if details:
        print(f"    {details}")
    print()
def test_sessions_from_schedule():
    """Test the new sessions/from-schedule endpoint as requested in review"""
    print("=" * 80)
    print("🔍 TESTING SESSIONS FROM SCHEDULE ENDPOINT")
    print("=" * 80)
    
    # Test data as specified in review request
    telegram_id = 123456789
    
    try:
        # Step 1: Create test journal (POST /api/journals)
        log_test("Step 1: Creating test journal", "INFO", f"Creating journal with telegram_id={telegram_id}")
        
        journal_data = {
            "telegram_id": telegram_id,
            "name": "Тестовый журнал",
            "group_name": "ИВТ-101"
        }
        
        response = requests.post(f"{API_BASE}/journals", json=journal_data, timeout=10)
        
        if response.status_code != 200:
            log_test("POST /api/journals", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        journal_response = response.json()
        journal_id = journal_response.get("journal_id")
        
        if not journal_id:
            log_test("POST /api/journals", "FAIL", "No journal_id in response")
            return False
            
        log_test("POST /api/journals", "PASS", f"Journal created successfully. ID: {journal_id}")
        
        # Step 2: Create subject in journal (POST /api/journals/{journal_id}/subjects)
        log_test("Step 2: Creating subject in journal", "INFO", f"Creating subject for journal {journal_id}")
        
        subject_data = {
            "name": "Математический анализ",
            "description": "Тестовый предмет",
            "color": "blue",
            "telegram_id": telegram_id
        }
        
        response = requests.post(f"{API_BASE}/journals/{journal_id}/subjects", json=subject_data, timeout=10)
        
        if response.status_code != 200:
            log_test("POST /api/journals/{journal_id}/subjects", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        subject_response = response.json()
        subject_id = subject_response.get("subject_id")
        
        if not subject_id:
            log_test("POST /api/journals/{journal_id}/subjects", "FAIL", "No subject_id in response")
            return False
            
        log_test("POST /api/journals/{journal_id}/subjects", "PASS", f"Subject created successfully. ID: {subject_id}")
        
        # Step 3: Test sessions/from-schedule endpoint with 3 different lesson types
        log_test("Step 3: Testing sessions/from-schedule endpoint", "INFO", f"Creating sessions from schedule")
        
        sessions_data = {
            "subject_id": subject_id,
            "telegram_id": telegram_id,
            "sessions": [
                {
                    "date": "2025-01-20",
                    "time": "09:00-10:30",
                    "discipline": "Математика",
                    "lesson_type": "Лекция",
                    "teacher": "Иванов И.И.",
                    "auditory": "101"
                },
                {
                    "date": "2025-01-21",
                    "time": "11:00-12:30",
                    "discipline": "Математика",
                    "lesson_type": "Семинар",
                    "teacher": "Петров П.П.",
                    "auditory": "102"
                },
                {
                    "date": "2025-01-22",
                    "time": "14:00-15:30",
                    "discipline": "Математика",
                    "lesson_type": "Лабораторная",
                    "teacher": "Сидоров С.С.",
                    "auditory": "103"
                }
            ]
        }
        
        response = requests.post(f"{API_BASE}/journals/{journal_id}/sessions/from-schedule", json=sessions_data, timeout=10)
        
        if response.status_code != 200:
            log_test("POST /api/journals/{journal_id}/sessions/from-schedule", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        sessions_response = response.json()
        
        # Verify response structure
        if sessions_response.get("status") != "success":
            log_test("Sessions Response Validation", "FAIL", f"Expected status=success, got {sessions_response.get('status')}")
            return False
            
        created_count = sessions_response.get("created_count", 0)
        skipped_count = sessions_response.get("skipped_count", 0)
        created_sessions = sessions_response.get("sessions", [])
        
        if created_count != 3:
            log_test("Sessions Count Validation", "FAIL", f"Expected created_count=3, got {created_count}")
            return False
            
        if len(created_sessions) != 3:
            log_test("Sessions Array Validation", "FAIL", f"Expected 3 sessions in array, got {len(created_sessions)}")
            return False
            
        log_test("POST /api/journals/{journal_id}/sessions/from-schedule", "PASS", f"Sessions created successfully. Count: {created_count}, Skipped: {skipped_count}")
        
        # Step 4: Verify session types and content
        log_test("Step 4: Verifying session types and content", "INFO", "Checking session details")
        
        expected_types = ["lecture", "seminar", "lab"]
        expected_times = ["09:00-10:30", "11:00-12:30", "14:00-15:30"]
        expected_teachers = ["Иванов И.И.", "Петров П.П.", "Сидоров С.С."]
        expected_auditories = ["101", "102", "103"]
        
        for i, session in enumerate(created_sessions):
            # Check session type mapping
            if session.get("type") != expected_types[i]:
                log_test("Session Type Validation", "FAIL", f"Session {i}: Expected type={expected_types[i]}, got {session.get('type')}")
                return False
                
            # Check title contains time and type
            title = session.get("title", "")
            if expected_times[i] not in title:
                log_test("Session Title Validation", "FAIL", f"Session {i}: Time {expected_times[i]} not found in title: {title}")
                return False
                
            # Check description contains teacher and auditory
            description = session.get("description", "")
            if expected_teachers[i] not in description:
                log_test("Session Description Validation", "FAIL", f"Session {i}: Teacher {expected_teachers[i]} not found in description: {description}")
                return False
                
            if expected_auditories[i] not in description:
                log_test("Session Description Validation", "FAIL", f"Session {i}: Auditory {expected_auditories[i]} not found in description: {description}")
                return False
                
        log_test("Session Content Validation", "PASS", "All sessions have correct types, titles, and descriptions")
        
        # Step 5: Test duplicate prevention
        log_test("Step 5: Testing duplicate prevention", "INFO", "Sending same sessions again")
        
        response = requests.post(f"{API_BASE}/journals/{journal_id}/sessions/from-schedule", json=sessions_data, timeout=10)
        
        if response.status_code != 200:
            log_test("Duplicate Prevention Test", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        duplicate_response = response.json()
        
        duplicate_created = duplicate_response.get("created_count", 0)
        duplicate_skipped = duplicate_response.get("skipped_count", 0)
        
        if duplicate_created != 0:
            log_test("Duplicate Prevention Validation", "FAIL", f"Expected created_count=0 for duplicates, got {duplicate_created}")
            return False
            
        if duplicate_skipped != 3:
            log_test("Duplicate Prevention Validation", "FAIL", f"Expected skipped_count=3 for duplicates, got {duplicate_skipped}")
            return False
            
        log_test("Duplicate Prevention Test", "PASS", f"Duplicates correctly prevented. Skipped: {duplicate_skipped}")
        
        # Step 6: Verify sessions via GET endpoint
        log_test("Step 6: Verifying sessions via GET endpoint", "INFO", f"Getting sessions for journal {journal_id}")
        
        response = requests.get(f"{API_BASE}/journals/{journal_id}/sessions", timeout=10)
        
        if response.status_code != 200:
            log_test("GET /api/journals/{journal_id}/sessions", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        get_sessions_response = response.json()
        
        if len(get_sessions_response) < 3:
            log_test("GET Sessions Validation", "FAIL", f"Expected at least 3 sessions, got {len(get_sessions_response)}")
            return False
            
        # Verify that our created sessions are in the list
        our_session_ids = {session.get("session_id") for session in created_sessions}
        retrieved_session_ids = {session.get("session_id") for session in get_sessions_response}
        
        if not our_session_ids.issubset(retrieved_session_ids):
            log_test("GET Sessions Validation", "FAIL", "Not all created sessions found in GET response")
            return False
            
        log_test("GET /api/journals/{journal_id}/sessions", "PASS", f"All sessions retrieved successfully. Total: {len(get_sessions_response)}")
        
        log_test("Sessions From Schedule Endpoint", "PASS", "All functionality working correctly!")
        
        return True
        
    except requests.exceptions.RequestException as e:
        log_test("Network Error", "FAIL", f"Request failed: {str(e)}")
        return False
    except Exception as e:
        log_test("Unexpected Error", "FAIL", f"Error: {str(e)}")
        return False
def main():
    """Main test execution"""
    print("🚀 Starting Backend API Testing for Sessions From Schedule Endpoint")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Test sessions from schedule endpoint
    success = test_sessions_from_schedule()
    
    print("=" * 80)
    if success:
        print("🎉 ALL TESTS PASSED - Sessions From Schedule Endpoint Working Correctly!")
    else:
        print("💥 TESTS FAILED - Issues found in Sessions From Schedule Endpoint")
    print("=" * 80)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
