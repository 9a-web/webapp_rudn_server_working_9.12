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
def test_journal_statistics_api():
    """Test the Journal Statistics API as requested in review"""
    print("=" * 80)
    print("🔍 TESTING JOURNAL STATISTICS API")
    print("=" * 80)
    
    # Test data as specified in review request
    telegram_id = 123456789
    
    try:
        # Step 1: Create test journal (POST /api/journals)
        log_test("Step 1: Creating test journal", "INFO", f"Creating journal with telegram_id={telegram_id}")
        
        journal_data = {
            "telegram_id": telegram_id,
            "name": "Тестовый журнал статистики",
            "group_name": "ИВТ-102"
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
        
        # Step 2: Add students in bulk (POST /api/journals/{journal_id}/students/bulk)
        log_test("Step 2: Adding students in bulk", "INFO", f"Adding 5 students to journal {journal_id}")
        
        students_data = {
            "names": ["Иванов Иван", "Петров Петр", "Сидорова Анна", "Козлов Дмитрий", "Николаева Мария"]
        }
        
        response = requests.post(f"{API_BASE}/journals/{journal_id}/students/bulk", json=students_data, timeout=10)
        
        if response.status_code != 200:
            log_test("POST /api/journals/{journal_id}/students/bulk", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        students_response = response.json()
        students = students_response.get("students", [])
        
        if len(students) != 5:
            log_test("Students Bulk Create Validation", "FAIL", f"Expected 5 students, got {len(students)}")
            return False
            
        student_ids = [student["id"] for student in students]
        log_test("POST /api/journals/{journal_id}/students/bulk", "PASS", f"5 students added successfully. IDs: {student_ids}")
        
        # Step 3: Create subject (POST /api/journals/{journal_id}/subjects)
        log_test("Step 3: Creating subject", "INFO", f"Creating subject for journal {journal_id}")
        
        subject_data = {
            "name": "Математика",
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
        
        # Step 4: Create several sessions (POST /api/journals/{journal_id}/sessions)
        log_test("Step 4: Creating multiple sessions", "INFO", f"Creating 4 sessions for journal {journal_id}")
        
        session_dates = ["2025-01-20", "2025-01-21", "2025-01-22", "2025-01-23"]
        session_titles = ["Лекция 1", "Лекция 2", "Семинар 1", "Лабораторная 1"]
        session_types = ["lecture", "lecture", "seminar", "lab"]
        session_ids = []
        
        for i, (date, title, session_type) in enumerate(zip(session_dates, session_titles, session_types)):
            session_data = {
                "title": title,
                "type": session_type,
                "date": date,
                "subject_id": subject_id,
                "telegram_id": telegram_id
            }
            
            response = requests.post(f"{API_BASE}/journals/{journal_id}/sessions", json=session_data, timeout=10)
            
            if response.status_code != 200:
                log_test(f"POST /api/journals/{journal_id}/sessions (Session {i+1})", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                return False
                
            session_response = response.json()
            session_id = session_response.get("session_id")
            
            if not session_id:
                log_test(f"Session {i+1} Creation", "FAIL", "No session_id in response")
                return False
                
            session_ids.append(session_id)
            
        log_test("POST /api/journals/{journal_id}/sessions", "PASS", f"4 sessions created successfully. IDs: {session_ids}")
        
        # Step 5: Mark attendance on sessions (POST /api/journals/sessions/{session_id}/attendance)
        log_test("Step 5: Marking attendance on sessions", "INFO", f"Setting attendance for all sessions")
        
        # Different attendance patterns for each session
        attendance_patterns = [
            # Session 1: Most present
            [{"student_id": student_ids[0], "status": "present"},
             {"student_id": student_ids[1], "status": "present"},
             {"student_id": student_ids[2], "status": "present"},
             {"student_id": student_ids[3], "status": "late"},
             {"student_id": student_ids[4], "status": "absent"}],
            
            # Session 2: Mixed attendance
            [{"student_id": student_ids[0], "status": "present"},
             {"student_id": student_ids[1], "status": "absent"},
             {"student_id": student_ids[2], "status": "present"},
             {"student_id": student_ids[3], "status": "present"},
             {"student_id": student_ids[4], "status": "late"}],
            
            # Session 3: Some absences
            [{"student_id": student_ids[0], "status": "absent"},
             {"student_id": student_ids[1], "status": "present"},
             {"student_id": student_ids[2], "status": "absent"},
             {"student_id": student_ids[3], "status": "present"},
             {"student_id": student_ids[4], "status": "present"}],
            
            # Session 4: Mixed with excused
            [{"student_id": student_ids[0], "status": "present"},
             {"student_id": student_ids[1], "status": "present"},
             {"student_id": student_ids[2], "status": "excused"},
             {"student_id": student_ids[3], "status": "absent"},
             {"student_id": student_ids[4], "status": "late"}]
        ]
        
        for i, (session_id, records) in enumerate(zip(session_ids, attendance_patterns)):
            attendance_data = {
                "records": records,
                "telegram_id": telegram_id
            }
            
            response = requests.post(f"{API_BASE}/journals/sessions/{session_id}/attendance", json=attendance_data, timeout=10)
            
            if response.status_code != 200:
                log_test(f"POST /api/journals/sessions/{session_id}/attendance (Session {i+1})", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        log_test("POST /api/journals/sessions/{session_id}/attendance", "PASS", f"Attendance marked for all 4 sessions")
        
        # Step 6: Check statistics API (GET /api/journals/{journal_id}/stats)
        log_test("Step 6: Testing statistics API", "INFO", f"Getting statistics for journal {journal_id}")
        
        response = requests.get(f"{API_BASE}/journals/{journal_id}/stats", timeout=10)
        
        if response.status_code != 200:
            log_test("GET /api/journals/{journal_id}/stats", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        stats_response = response.json()
        
        # Validate response structure and data
        log_test("Step 6.1: Validating basic statistics", "INFO", "Checking journal_id, total_students, total_sessions")
        
        # Check journal_id
        if stats_response.get("journal_id") != journal_id:
            log_test("Journal ID Validation", "FAIL", f"Expected journal_id={journal_id}, got {stats_response.get('journal_id')}")
            return False
            
        # Check total_students
        if stats_response.get("total_students") != 5:
            log_test("Total Students Validation", "FAIL", f"Expected total_students=5, got {stats_response.get('total_students')}")
            return False
            
        # Check linked_students
        linked_students = stats_response.get("linked_students")
        if linked_students is None or not isinstance(linked_students, int):
            log_test("Linked Students Validation", "FAIL", f"Expected linked_students as integer, got {linked_students}")
            return False
            
        # Check total_sessions
        if stats_response.get("total_sessions") != 4:
            log_test("Total Sessions Validation", "FAIL", f"Expected total_sessions=4, got {stats_response.get('total_sessions')}")
            return False
            
        # Check overall_attendance_percent
        overall_percent = stats_response.get("overall_attendance_percent")
        if overall_percent is None or not isinstance(overall_percent, (int, float)):
            log_test("Overall Attendance Percent Validation", "FAIL", f"Expected overall_attendance_percent as number, got {overall_percent}")
            return False
            
        log_test("Basic Statistics Validation", "PASS", f"journal_id={journal_id}, total_students=5, linked_students={linked_students}, total_sessions=4, overall_attendance_percent={overall_percent}")
        
        # Validate students_stats array
        log_test("Step 6.2: Validating students statistics", "INFO", "Checking students_stats array")
        
        students_stats = stats_response.get("students_stats", [])
        if len(students_stats) != 5:
            log_test("Students Stats Array Validation", "FAIL", f"Expected 5 students in stats, got {len(students_stats)}")
            return False
            
        required_student_fields = ["id", "full_name", "attendance_percent", "present_count", "absent_count", "excused_count", "late_count", "total_sessions"]
        
        for i, student_stat in enumerate(students_stats):
            for field in required_student_fields:
                if field not in student_stat:
                    log_test("Student Stats Field Validation", "FAIL", f"Student {i}: Missing field '{field}'")
                    return False
                    
            # Validate data types
            if not isinstance(student_stat.get("present_count"), int):
                log_test("Student Stats Type Validation", "FAIL", f"Student {i}: present_count should be integer")
                return False
                
            if not isinstance(student_stat.get("absent_count"), int):
                log_test("Student Stats Type Validation", "FAIL", f"Student {i}: absent_count should be integer")
                return False
                
            if not isinstance(student_stat.get("excused_count"), int):
                log_test("Student Stats Type Validation", "FAIL", f"Student {i}: excused_count should be integer")
                return False
                
            if not isinstance(student_stat.get("late_count"), int):
                log_test("Student Stats Type Validation", "FAIL", f"Student {i}: late_count should be integer")
                return False
                
            if student_stat.get("total_sessions") != 4:
                log_test("Student Stats Sessions Validation", "FAIL", f"Student {i}: Expected total_sessions=4, got {student_stat.get('total_sessions')}")
                return False
                
        log_test("Students Statistics Validation", "PASS", f"All 5 students have correct stats structure and data types")
        
        # Validate sessions_stats array
        log_test("Step 6.3: Validating sessions statistics", "INFO", "Checking sessions_stats array")
        
        sessions_stats = stats_response.get("sessions_stats", [])
        if len(sessions_stats) != 4:
            log_test("Sessions Stats Array Validation", "FAIL", f"Expected 4 sessions in stats, got {len(sessions_stats)}")
            return False
            
        required_session_fields = ["session_id", "date", "title", "type", "present_count", "absent_count", "attendance_filled", "total_students"]
        
        for i, session_stat in enumerate(sessions_stats):
            for field in required_session_fields:
                if field not in session_stat:
                    log_test("Session Stats Field Validation", "FAIL", f"Session {i}: Missing field '{field}'")
                    return False
                    
            # Validate data types and values
            if not isinstance(session_stat.get("present_count"), int):
                log_test("Session Stats Type Validation", "FAIL", f"Session {i}: present_count should be integer")
                return False
                
            if not isinstance(session_stat.get("absent_count"), int):
                log_test("Session Stats Type Validation", "FAIL", f"Session {i}: absent_count should be integer")
                return False
                
            if not isinstance(session_stat.get("attendance_filled"), int):
                log_test("Session Stats Type Validation", "FAIL", f"Session {i}: attendance_filled should be integer")
                return False
                
            if session_stat.get("total_students") != 5:
                log_test("Session Stats Students Validation", "FAIL", f"Session {i}: Expected total_students=5, got {session_stat.get('total_students')}")
                return False
                
        log_test("Sessions Statistics Validation", "PASS", f"All 4 sessions have correct stats structure and data types")
        
        # Validate attendance calculations
        log_test("Step 6.4: Validating attendance calculations", "INFO", "Checking attendance math")
        
        # Calculate expected values based on our attendance patterns
        expected_student_stats = {
            student_ids[0]: {"present": 3, "absent": 1, "late": 0, "excused": 0},  # Иванов Иван
            student_ids[1]: {"present": 3, "absent": 1, "late": 0, "excused": 0},  # Петров Петр  
            student_ids[2]: {"present": 2, "absent": 1, "late": 0, "excused": 1},  # Сидорова Анна
            student_ids[3]: {"present": 2, "absent": 1, "late": 1, "excused": 0},  # Козлов Дмитрий
            student_ids[4]: {"present": 2, "absent": 1, "late": 2, "excused": 0},  # Николаева Мария
        }
        
        for student_stat in students_stats:
            student_id = student_stat["id"]
            if student_id in expected_student_stats:
                expected = expected_student_stats[student_id]
                
                # Check present count (including late as present for attendance percentage)
                expected_present_total = expected["present"] + expected["late"]
                actual_present = student_stat["present_count"]
                
                if actual_present != expected_present_total:
                    log_test("Attendance Calculation Validation", "FAIL", f"Student {student_id}: Expected present_count={expected_present_total}, got {actual_present}")
                    return False
                    
                if student_stat["absent_count"] != expected["absent"]:
                    log_test("Attendance Calculation Validation", "FAIL", f"Student {student_id}: Expected absent_count={expected['absent']}, got {student_stat['absent_count']}")
                    return False
                    
                if student_stat["late_count"] != expected["late"]:
                    log_test("Attendance Calculation Validation", "FAIL", f"Student {student_id}: Expected late_count={expected['late']}, got {student_stat['late_count']}")
                    return False
                    
                if student_stat["excused_count"] != expected["excused"]:
                    log_test("Attendance Calculation Validation", "FAIL", f"Student {student_id}: Expected excused_count={expected['excused']}, got {student_stat['excused_count']}")
                    return False
                    
        log_test("Attendance Calculations Validation", "PASS", "All attendance counts match expected values")
        
        log_test("Journal Statistics API", "PASS", "All functionality working correctly!")
        
        return True
        
    except requests.exceptions.RequestException as e:
        log_test("Network Error", "FAIL", f"Request failed: {str(e)}")
        return False
    except Exception as e:
        log_test("Unexpected Error", "FAIL", f"Error: {str(e)}")
        return False
def main():
    """Main test execution"""
    print("🚀 Starting Backend API Testing for Journal Statistics API")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Test journal statistics API
    success = test_journal_statistics_api()
    
    print("=" * 80)
    if success:
        print("🎉 ALL TESTS PASSED - Journal Statistics API Working Correctly!")
    else:
        print("💥 TESTS FAILED - Issues found in Journal Statistics API")
    print("=" * 80)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
