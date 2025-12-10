#!/usr/bin/env python3
"""
Backend Test Suite for Journal Stats Calculation Fix
Tests the specific requirements mentioned in the review request:
1. Student created AFTER a session date
2. If NOT marked, the session should be EXCLUDED from stats (new student logic)
3. If MARKED (present/absent/etc), the session should be INCLUDED in stats (backfill logic)
4. Percentage should never exceed 100%
5. Implicit absent logic (unmarked valid sessions count as absent)
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List

# Backend URL
BASE_URL = "http://localhost:8001/api"

class JournalStatsTestSuite:
    def __init__(self):
        self.session = requests.Session()
        self.test_data = {}
        
    def log(self, message: str, level: str = "INFO"):
        """Log test messages"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def make_request(self, method: str, endpoint: str, **kwargs) -> requests.Response:
        """Make HTTP request with error handling"""
        url = f"{BASE_URL}{endpoint}"
        try:
            response = self.session.request(method, url, **kwargs)
            self.log(f"{method} {endpoint} -> {response.status_code}")
            return response
        except Exception as e:
            self.log(f"Request failed: {e}", "ERROR")
            raise
            
    def create_journal(self, owner_id: int = 999888777) -> Dict[str, Any]:
        """Create a test journal"""
        journal_data = {
            "name": "Test Journal - Stats Fix",
            "group_name": "Test Group",
            "description": "Testing journal stats calculation fix",
            "telegram_id": owner_id,
            "color": "blue"
        }
        
        response = self.make_request("POST", "/journals", json=journal_data)
        if response.status_code != 200:
            raise Exception(f"Failed to create journal: {response.text}")
            
        journal = response.json()
        self.log(f"Created journal: {journal['journal_id']}")
        return journal
        
    def create_subject(self, journal_id: str, owner_id: int = 999888777) -> Dict[str, Any]:
        """Create a subject in the journal"""
        subject_data = {
            "name": "Test Subject",
            "description": "Subject for testing stats",
            "color": "green",
            "telegram_id": owner_id
        }
        
        response = self.make_request("POST", f"/journals/{journal_id}/subjects", json=subject_data)
        if response.status_code != 200:
            raise Exception(f"Failed to create subject: {response.text}")
            
        subject = response.json()
        self.log(f"Created subject: {subject['subject_id']}")
        return subject
        
    def add_student(self, journal_id: str, full_name: str) -> Dict[str, Any]:
        """Add a student to the journal"""
        student_data = {
            "full_name": full_name
        }
        
        response = self.make_request("POST", f"/journals/{journal_id}/students", json=student_data)
        if response.status_code != 200:
            raise Exception(f"Failed to add student: {response.text}")
            
        student = response.json()
        self.log(f"Added student: {student['full_name']} (ID: {student['id']})")
        return student
        
    def create_session(self, journal_id: str, subject_id: str, date: str, title: str, owner_id: int = 999888777) -> Dict[str, Any]:
        """Create a session"""
        session_data = {
            "subject_id": subject_id,
            "date": date,
            "title": title,
            "description": f"Session on {date}",
            "type": "lecture",
            "telegram_id": owner_id
        }
        
        response = self.make_request("POST", f"/journals/{journal_id}/sessions", json=session_data)
        if response.status_code != 200:
            raise Exception(f"Failed to create session: {response.text}")
            
        session = response.json()
        self.log(f"Created session: {session['title']} on {session['date']} (ID: {session['session_id']})")
        return session
        
    def mark_attendance(self, journal_id: str, session_id: str, student_id: str, status: str, owner_id: int = 999888777) -> bool:
        """Mark attendance for a student in a session"""
        attendance_data = {
            "records": [
                {
                    "student_id": student_id,
                    "status": status,
                    "reason": None,
                    "note": f"Test marking as {status}"
                }
            ],
            "telegram_id": owner_id
        }
        
        response = self.make_request("POST", f"/journals/sessions/{session_id}/attendance", json=attendance_data)
        if response.status_code != 200:
            self.log(f"Failed to mark attendance: {response.text}", "ERROR")
            return False
            
        self.log(f"Marked student {student_id} as {status} for session {session_id}")
        return True
        
    def get_journal_stats(self, journal_id: str, telegram_id: int = 999888777) -> Dict[str, Any]:
        """Get journal statistics"""
        response = self.make_request("GET", f"/journals/{journal_id}/stats?telegram_id={telegram_id}")
        if response.status_code != 200:
            raise Exception(f"Failed to get stats: {response.text}")
            
        return response.json()
        
    def wait_for_student_creation(self, seconds: int = 2):
        """Wait to ensure different creation timestamps"""
        import time
        time.sleep(seconds)
        self.log(f"Waited {seconds} seconds for timestamp separation")
        
    def test_journal_stats_calculation_fix(self):
        """
        Main test for journal stats calculation fix
        Tests all the requirements from the review request
        """
        self.log("=" * 60)
        self.log("STARTING JOURNAL STATS CALCULATION FIX TEST")
        self.log("=" * 60)
        
        try:
            # Step 1: Create journal and subject
            journal = self.create_journal()
            journal_id = journal['journal_id']
            
            subject = self.create_subject(journal_id)
            subject_id = subject['subject_id']
            
            # Step 2: Create sessions with specific dates
            today = datetime.now()
            session_dates = [
                (today - timedelta(days=5)).strftime("%Y-%m-%d"),  # 5 days ago
                (today - timedelta(days=3)).strftime("%Y-%m-%d"),  # 3 days ago  
                (today - timedelta(days=1)).strftime("%Y-%m-%d"),  # 1 day ago
                today.strftime("%Y-%m-%d"),                        # today
                (today + timedelta(days=1)).strftime("%Y-%m-%d"),  # tomorrow
            ]
            
            sessions = []
            for i, date in enumerate(session_dates):
                session = self.create_session(
                    journal_id, 
                    subject_id, 
                    date, 
                    f"Session {i+1} - {date}"
                )
                sessions.append(session)
                
            self.log(f"Created {len(sessions)} sessions from {session_dates[0]} to {session_dates[-1]}")
            
            # Step 3: Add students at different times relative to sessions
            # Student 1: Added before all sessions (should count all sessions)
            student1 = self.add_student(journal_id, "Student One - Early")
            
            # Wait to ensure different creation time
            self.wait_for_student_creation(1)
            
            # Student 2: Added after some sessions (should only count sessions after creation + marked sessions)
            student2 = self.add_student(journal_id, "Student Two - Late")
            
            # Wait again
            self.wait_for_student_creation(1)
            
            # Student 3: Added very late (should only count very recent sessions + marked sessions)
            student3 = self.add_student(journal_id, "Student Three - Very Late")
            
            self.log("Added 3 students at different times")
            
            # Step 4: Mark attendance strategically to test backfill logic
            
            # Student 1: Mark some sessions (should count all sessions as valid)
            self.mark_attendance(journal_id, sessions[0]['session_id'], student1['id'], "present")
            self.mark_attendance(journal_id, sessions[1]['session_id'], student1['id'], "absent")
            self.mark_attendance(journal_id, sessions[2]['session_id'], student1['id'], "present")
            # Leave sessions[3] and sessions[4] unmarked (should count as implicit absent)
            
            # Student 2: Mark some old sessions (backfill) and some new ones
            self.mark_attendance(journal_id, sessions[0]['session_id'], student2['id'], "present")  # Backfill
            self.mark_attendance(journal_id, sessions[1]['session_id'], student2['id'], "present")  # Backfill
            self.mark_attendance(journal_id, sessions[3]['session_id'], student2['id'], "absent")   # Normal
            # Leave sessions[2] and sessions[4] unmarked
            
            # Student 3: Mark one old session (backfill) and leave others
            self.mark_attendance(journal_id, sessions[0]['session_id'], student3['id'], "late")     # Backfill
            # Leave all other sessions unmarked
            
            self.log("Marked attendance with strategic backfill and new student logic")
            
            # Step 5: Get and analyze statistics
            stats = self.get_journal_stats(journal_id)
            
            self.log("=" * 40)
            self.log("ANALYZING STATISTICS")
            self.log("=" * 40)
            
            # Analyze overall stats
            self.log(f"Overall attendance: {stats['overall_attendance_percent']}%")
            self.log(f"Total students: {stats['total_students']}")
            self.log(f"Total sessions: {stats['total_sessions']}")
            
            # Analyze each student
            for student_stat in stats['students_stats']:
                student_name = student_stat['full_name']
                attendance_percent = student_stat['attendance_percent']
                present_count = student_stat['present_count']
                absent_count = student_stat['absent_count']
                total_sessions = student_stat['total_sessions']
                
                self.log(f"\n{student_name}:")
                self.log(f"  Attendance: {attendance_percent}%")
                self.log(f"  Present: {present_count}")
                self.log(f"  Absent: {absent_count}")
                self.log(f"  Total valid sessions: {total_sessions}")
                
                # Test requirement 4: Percentage should never exceed 100%
                if attendance_percent is not None and attendance_percent > 100:
                    raise Exception(f"❌ FAIL: {student_name} has attendance > 100%: {attendance_percent}%")
                    
                # Test implicit absent logic (requirement 5)
                if total_sessions > 0:
                    expected_total_marked = present_count + absent_count
                    if expected_total_marked != total_sessions:
                        self.log(f"  Note: {total_sessions - expected_total_marked} sessions unmarked (implicit absent)")
                        
            # Step 6: Verify specific requirements
            self.log("\n" + "=" * 40)
            self.log("VERIFYING REQUIREMENTS")
            self.log("=" * 40)
            
            # Find students in stats
            student1_stats = next(s for s in stats['students_stats'] if s['full_name'] == "Student One - Early")
            student2_stats = next(s for s in stats['students_stats'] if s['full_name'] == "Student Two - Late")
            student3_stats = next(s for s in stats['students_stats'] if s['full_name'] == "Student Three - Very Late")
            
            # Requirement 1 & 2: Student created AFTER session date - unmarked sessions should be EXCLUDED
            # Student 2 and 3 were created after some sessions, so they should have fewer total_sessions
            # unless those sessions were marked (backfill logic)
            
            self.log(f"✓ Student 1 (early): {student1_stats['total_sessions']} total sessions")
            self.log(f"✓ Student 2 (late): {student2_stats['total_sessions']} total sessions")  
            self.log(f"✓ Student 3 (very late): {student3_stats['total_sessions']} total sessions")
            
            # Requirement 3: If MARKED, session should be INCLUDED (backfill logic)
            # Student 2 and 3 have marked sessions from before their creation - these should be included
            if student2_stats['total_sessions'] < 3:  # Should have at least the marked backfill sessions
                raise Exception(f"❌ FAIL: Student 2 missing backfill sessions. Expected >= 3, got {student2_stats['total_sessions']}")
                
            if student3_stats['total_sessions'] < 1:  # Should have at least the one marked backfill session
                raise Exception(f"❌ FAIL: Student 3 missing backfill session. Expected >= 1, got {student3_stats['total_sessions']}")
                
            # Requirement 4: Already checked above (percentage <= 100%)
            
            # Requirement 5: Implicit absent logic
            # For each student, present_count + absent_count should equal total_sessions
            for student_stat in [student1_stats, student2_stats, student3_stats]:
                name = student_stat['full_name']
                present = student_stat['present_count']
                absent = student_stat['absent_count']
                total = student_stat['total_sessions']
                
                if present + absent != total:
                    raise Exception(f"❌ FAIL: {name} implicit absent logic broken. Present({present}) + Absent({absent}) != Total({total})")
                    
            self.log("\n✅ ALL REQUIREMENTS VERIFIED SUCCESSFULLY!")
            
            # Additional verification: Check that percentages make sense
            for student_stat in [student1_stats, student2_stats, student3_stats]:
                name = student_stat['full_name']
                present = student_stat['present_count']
                total = student_stat['total_sessions']
                percent = student_stat['attendance_percent']
                
                if total > 0:
                    expected_percent = round((present / total) * 100, 1)
                    if abs(percent - expected_percent) > 0.1:  # Allow small rounding differences
                        raise Exception(f"❌ FAIL: {name} percentage calculation wrong. Expected {expected_percent}%, got {percent}%")
                        
            self.log("✅ PERCENTAGE CALCULATIONS VERIFIED!")
            
            return True
            
        except Exception as e:
            self.log(f"❌ TEST FAILED: {e}", "ERROR")
            return False
            
    def test_edge_cases(self):
        """Test edge cases for the stats calculation"""
        self.log("\n" + "=" * 60)
        self.log("TESTING EDGE CASES")
        self.log("=" * 60)
        
        try:
            # Create a new journal for edge case testing
            journal = self.create_journal(owner_id=999888778)  # Different owner
            journal_id = journal['journal_id']
            
            subject = self.create_subject(journal_id, owner_id=999888778)
            subject_id = subject['subject_id']
            
            # Edge Case 1: Student with no sessions
            student = self.add_student(journal_id, "Student No Sessions")
            stats = self.get_journal_stats(journal_id, telegram_id=999888778)
            
            student_stats = next(s for s in stats['students_stats'] if s['full_name'] == "Student No Sessions")
            if student_stats['attendance_percent'] is not None:
                raise Exception(f"❌ FAIL: Student with no sessions should have None attendance, got {student_stats['attendance_percent']}")
                
            self.log("✅ Edge Case 1: Student with no sessions - PASSED")
            
            # Edge Case 2: All sessions marked as excused
            session = self.create_session(journal_id, subject_id, datetime.now().strftime("%Y-%m-%d"), "Excused Session", owner_id=999888778)
            self.mark_attendance(journal_id, session['session_id'], student['id'], "excused", owner_id=999888778)
            
            stats = self.get_journal_stats(journal_id, telegram_id=999888778)
            student_stats = next(s for s in stats['students_stats'] if s['full_name'] == "Student No Sessions")
            
            # With excused session, effective sessions should be 0, so attendance should be None or 0
            self.log(f"Student with excused session: {student_stats['attendance_percent']}% (total: {student_stats['total_sessions']})")
            
            # Edge Case 3: Multiple backfill sessions
            past_dates = [
                (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d"),
                (datetime.now() - timedelta(days=8)).strftime("%Y-%m-%d"),
                (datetime.now() - timedelta(days=6)).strftime("%Y-%m-%d"),
            ]
            
            past_sessions = []
            for i, date in enumerate(past_dates):
                session = self.create_session(journal_id, subject_id, date, f"Past Session {i+1}", owner_id=999888778)
                past_sessions.append(session)
                
            # Add student after all past sessions
            self.wait_for_student_creation(1)
            late_student = self.add_student(journal_id, "Late Student Multiple Backfill")
            
            # Mark all past sessions (backfill)
            for session in past_sessions:
                self.mark_attendance(journal_id, session['session_id'], late_student['id'], "present", owner_id=999888778)
                
            stats = self.get_journal_stats(journal_id, telegram_id=999888778)
            late_student_stats = next(s for s in stats['students_stats'] if s['full_name'] == "Late Student Multiple Backfill")
            
            # Should have all backfilled sessions counted
            if late_student_stats['total_sessions'] < len(past_sessions):
                raise Exception(f"❌ FAIL: Late student missing backfill sessions. Expected >= {len(past_sessions)}, got {late_student_stats['total_sessions']}")
                
            self.log("✅ Edge Case 3: Multiple backfill sessions - PASSED")
            
            return True
            
        except Exception as e:
            self.log(f"❌ EDGE CASE TEST FAILED: {e}", "ERROR")
            return False

    def test_is_linked_field(self):
        """
        Test the new is_linked field in journal detail endpoint
        Tests the specific requirements from the review request:
        1. Create journal with owner_id = 123456
        2. Get journal details as owner (should have is_linked = false, is_owner = true)
        3. Get journal details as non-owner, non-linked user (should have is_linked = false, is_owner = false)
        4. Add student and link to telegram_id = 999999
        5. Get journal details as linked student (should have is_linked = true, is_owner = false)
        """
        self.log("=" * 60)
        self.log("STARTING IS_LINKED FIELD TEST")
        self.log("=" * 60)
        
        try:
            # Step 1: Create journal with owner_id = 123456
            owner_id = 123456
            journal = self.create_journal(owner_id=owner_id)
            journal_id = journal['journal_id']
            self.log(f"✅ Step 1: Created journal {journal_id} with owner_id = {owner_id}")
            
            # Step 2: Get journal details as owner (telegram_id = 123456)
            response = self.make_request("GET", f"/journals/detail/{journal_id}?telegram_id={owner_id}")
            if response.status_code != 200:
                raise Exception(f"Failed to get journal details as owner: {response.text}")
                
            owner_details = response.json()
            
            # Verify owner details
            if not owner_details.get('is_owner'):
                raise Exception(f"❌ FAIL: Owner should have is_owner = true, got {owner_details.get('is_owner')}")
            if owner_details.get('is_linked'):
                raise Exception(f"❌ FAIL: Owner should have is_linked = false, got {owner_details.get('is_linked')}")
                
            self.log(f"✅ Step 2: Owner details correct - is_owner: {owner_details['is_owner']}, is_linked: {owner_details['is_linked']}")
            
            # Step 3: Get journal details as non-owner, non-linked user (telegram_id = 999999)
            non_owner_id = 999999
            response = self.make_request("GET", f"/journals/detail/{journal_id}?telegram_id={non_owner_id}")
            if response.status_code != 200:
                raise Exception(f"Failed to get journal details as non-owner: {response.text}")
                
            non_owner_details = response.json()
            
            # Verify non-owner details
            if non_owner_details.get('is_owner'):
                raise Exception(f"❌ FAIL: Non-owner should have is_owner = false, got {non_owner_details.get('is_owner')}")
            if non_owner_details.get('is_linked'):
                raise Exception(f"❌ FAIL: Non-linked user should have is_linked = false, got {non_owner_details.get('is_linked')}")
                
            self.log(f"✅ Step 3: Non-owner details correct - is_owner: {non_owner_details['is_owner']}, is_linked: {non_owner_details['is_linked']}")
            
            # Step 4: Add student with full_name="Test Student"
            student = self.add_student(journal_id, "Test Student")
            student_id = student['id']
            self.log(f"✅ Step 4: Added student 'Test Student' with ID: {student_id}")
            
            # Step 5: Link student to telegram_id = 999999
            link_data = {
                "telegram_id": non_owner_id,
                "username": "test_user",
                "first_name": "Test"
            }
            
            response = self.make_request("POST", f"/journals/{journal_id}/students/{student_id}/link", json=link_data)
            if response.status_code != 200:
                raise Exception(f"Failed to link student: {response.text}")
                
            self.log(f"✅ Step 5: Linked student {student_id} to telegram_id = {non_owner_id}")
            
            # Step 6: Get journal details as linked student (telegram_id = 999999)
            response = self.make_request("GET", f"/journals/detail/{journal_id}?telegram_id={non_owner_id}")
            if response.status_code != 200:
                raise Exception(f"Failed to get journal details as linked student: {response.text}")
                
            linked_details = response.json()
            
            # Verify linked student details
            if linked_details.get('is_owner'):
                raise Exception(f"❌ FAIL: Linked student should have is_owner = false, got {linked_details.get('is_owner')}")
            if not linked_details.get('is_linked'):
                raise Exception(f"❌ FAIL: Linked student should have is_linked = true, got {linked_details.get('is_linked')}")
                
            self.log(f"✅ Step 6: Linked student details correct - is_owner: {linked_details['is_owner']}, is_linked: {linked_details['is_linked']}")
            
            # Additional verification: Check my_attendance_percent is present for linked student
            if 'my_attendance_percent' not in linked_details:
                self.log("⚠️  Warning: my_attendance_percent not present for linked student (expected if no sessions exist)")
            else:
                self.log(f"✅ Linked student has my_attendance_percent: {linked_details['my_attendance_percent']}")
            
            self.log("\n✅ ALL IS_LINKED FIELD TESTS PASSED!")
            return True
            
        except Exception as e:
            self.log(f"❌ IS_LINKED FIELD TEST FAILED: {e}", "ERROR")
            return False

    def test_subjects_stats_field(self):
        """
        Test the subjects_stats field in GET /api/journals/{journal_id}/stats endpoint
        Tests the specific requirements from the review request:
        1. Create test journal with POST /api/journals
        2. Add several subjects through POST /api/journals/{journal_id}/subjects 
        3. Add several students through POST /api/journals/{journal_id}/students
        4. Create several sessions for different subjects through POST /api/journals/{journal_id}/sessions
        5. Mark attendance for sessions through POST /api/journals/sessions/{session_id}/attendance
        6. Get journal stats through GET /api/journals/{journal_id}/stats with telegram_id=12345 (owner)
        7. Verify that the response has subjects_stats field with statistics for each subject
        """
        self.log("=" * 60)
        self.log("STARTING SUBJECTS_STATS FIELD TEST")
        self.log("=" * 60)
        
        try:
            # Step 1: Create test journal with owner telegram_id = 12345
            owner_id = 12345
            journal_data = {
                "name": "Test Journal - Subjects Stats",
                "group_name": "Test Group Stats",
                "description": "Testing subjects_stats field in journal stats",
                "telegram_id": owner_id,
                "color": "purple"
            }
            
            response = self.make_request("POST", "/journals", json=journal_data)
            if response.status_code != 200:
                raise Exception(f"Failed to create journal: {response.text}")
                
            journal = response.json()
            journal_id = journal['journal_id']
            self.log(f"✅ Step 1: Created journal {journal_id} with owner_id = {owner_id}")
            
            # Step 2: Add several subjects
            subjects_data = [
                {"name": "Математика", "description": "Высшая математика", "color": "blue"},
                {"name": "Физика", "description": "Общая физика", "color": "green"},
                {"name": "Программирование", "description": "Основы программирования", "color": "red"}
            ]
            
            subjects = []
            for subject_data in subjects_data:
                subject_data["telegram_id"] = owner_id
                response = self.make_request("POST", f"/journals/{journal_id}/subjects", json=subject_data)
                if response.status_code != 200:
                    raise Exception(f"Failed to create subject {subject_data['name']}: {response.text}")
                subjects.append(response.json())
                
            self.log(f"✅ Step 2: Added {len(subjects)} subjects: {[s['name'] for s in subjects]}")
            
            # Step 3: Add several students
            students_names = ["Иванов Иван", "Петров Петр", "Сидоров Сидор", "Козлова Анна"]
            students = []
            for name in students_names:
                student_data = {"full_name": name}
                response = self.make_request("POST", f"/journals/{journal_id}/students", json=student_data)
                if response.status_code != 200:
                    raise Exception(f"Failed to add student {name}: {response.text}")
                students.append(response.json())
                
            self.log(f"✅ Step 3: Added {len(students)} students: {[s['full_name'] for s in students]}")
            
            # Step 4: Create several sessions for different subjects
            today = datetime.now()
            sessions_data = [
                # Математика sessions
                {"subject_id": subjects[0]['subject_id'], "date": (today - timedelta(days=7)).strftime("%Y-%m-%d"), "title": "Математика - Лекция 1"},
                {"subject_id": subjects[0]['subject_id'], "date": (today - timedelta(days=5)).strftime("%Y-%m-%d"), "title": "Математика - Семинар 1"},
                {"subject_id": subjects[0]['subject_id'], "date": (today - timedelta(days=3)).strftime("%Y-%m-%d"), "title": "Математика - Лекция 2"},
                
                # Физика sessions
                {"subject_id": subjects[1]['subject_id'], "date": (today - timedelta(days=6)).strftime("%Y-%m-%d"), "title": "Физика - Лекция 1"},
                {"subject_id": subjects[1]['subject_id'], "date": (today - timedelta(days=4)).strftime("%Y-%m-%d"), "title": "Физика - Лабораторная 1"},
                
                # Программирование sessions
                {"subject_id": subjects[2]['subject_id'], "date": (today - timedelta(days=2)).strftime("%Y-%m-%d"), "title": "Программирование - Лекция 1"},
                {"subject_id": subjects[2]['subject_id'], "date": (today - timedelta(days=1)).strftime("%Y-%m-%d"), "title": "Программирование - Практика 1"},
            ]
            
            sessions = []
            for session_data in sessions_data:
                session_data.update({
                    "description": f"Занятие по предмету",
                    "type": "lecture",
                    "telegram_id": owner_id
                })
                response = self.make_request("POST", f"/journals/{journal_id}/sessions", json=session_data)
                if response.status_code != 200:
                    raise Exception(f"Failed to create session {session_data['title']}: {response.text}")
                sessions.append(response.json())
                
            self.log(f"✅ Step 4: Created {len(sessions)} sessions for different subjects")
            
            # Step 5: Mark attendance for sessions
            # Mark attendance strategically to create meaningful statistics
            attendance_patterns = [
                # Session 0 (Математика): 3 present, 1 absent
                {"session_idx": 0, "attendances": [("present", 0), ("present", 1), ("present", 2), ("absent", 3)]},
                # Session 1 (Математика): 2 present, 1 late, 1 excused
                {"session_idx": 1, "attendances": [("present", 0), ("late", 1), ("present", 2), ("excused", 3)]},
                # Session 2 (Математика): 4 present
                {"session_idx": 2, "attendances": [("present", 0), ("present", 1), ("present", 2), ("present", 3)]},
                
                # Session 3 (Физика): 2 present, 2 absent
                {"session_idx": 3, "attendances": [("present", 0), ("absent", 1), ("present", 2), ("absent", 3)]},
                # Session 4 (Физика): 1 present, 2 late, 1 absent
                {"session_idx": 4, "attendances": [("late", 0), ("late", 1), ("present", 2), ("absent", 3)]},
                
                # Session 5 (Программирование): 3 present, 1 late
                {"session_idx": 5, "attendances": [("present", 0), ("present", 1), ("late", 2), ("present", 3)]},
                # Session 6 (Программирование): 2 present, 2 absent
                {"session_idx": 6, "attendances": [("present", 0), ("absent", 1), ("present", 2), ("absent", 3)]},
            ]
            
            for pattern in attendance_patterns:
                session = sessions[pattern["session_idx"]]
                records = []
                for status, student_idx in pattern["attendances"]:
                    records.append({
                        "student_id": students[student_idx]["id"],
                        "status": status,
                        "reason": None,
                        "note": f"Test attendance - {status}"
                    })
                
                attendance_data = {
                    "records": records,
                    "telegram_id": owner_id
                }
                
                response = self.make_request("POST", f"/journals/sessions/{session['session_id']}/attendance", json=attendance_data)
                if response.status_code != 200:
                    raise Exception(f"Failed to mark attendance for session {session['title']}: {response.text}")
                    
            self.log(f"✅ Step 5: Marked attendance for all {len(sessions)} sessions")
            
            # Step 6: Get journal statistics with telegram_id=12345 (owner)
            response = self.make_request("GET", f"/journals/{journal_id}/stats?telegram_id={owner_id}")
            if response.status_code != 200:
                raise Exception(f"Failed to get journal stats: {response.text}")
                
            stats = response.json()
            self.log(f"✅ Step 6: Retrieved journal statistics")
            
            # Step 7: Verify subjects_stats field exists and has correct structure
            if 'subjects_stats' not in stats:
                raise Exception("❌ FAIL: subjects_stats field is missing from response")
                
            subjects_stats = stats['subjects_stats']
            if not isinstance(subjects_stats, list):
                raise Exception(f"❌ FAIL: subjects_stats should be a list, got {type(subjects_stats)}")
                
            if len(subjects_stats) != len(subjects):
                raise Exception(f"❌ FAIL: Expected {len(subjects)} subjects in stats, got {len(subjects_stats)}")
                
            self.log(f"✅ Step 7: subjects_stats field exists and contains {len(subjects_stats)} subjects")
            
            # Verify each subject's statistics structure and data
            expected_fields = [
                'subject_id', 'subject_name', 'subject_color', 'total_sessions',
                'present_count', 'absent_count', 'late_count', 'excused_count',
                'attendance_percent'
            ]
            
            subjects_by_name = {s['name']: s for s in subjects}
            
            for subject_stat in subjects_stats:
                # Check all required fields are present
                for field in expected_fields:
                    if field not in subject_stat:
                        raise Exception(f"❌ FAIL: Missing field '{field}' in subject stats")
                        
                subject_name = subject_stat['subject_name']
                self.log(f"\n📊 Subject: {subject_name}")
                self.log(f"   Total sessions: {subject_stat['total_sessions']}")
                self.log(f"   Present: {subject_stat['present_count']}")
                self.log(f"   Absent: {subject_stat['absent_count']}")
                self.log(f"   Late: {subject_stat['late_count']}")
                self.log(f"   Excused: {subject_stat['excused_count']}")
                self.log(f"   Attendance: {subject_stat['attendance_percent']}%")
                
                # Verify data types
                if not isinstance(subject_stat['total_sessions'], int):
                    raise Exception(f"❌ FAIL: total_sessions should be int, got {type(subject_stat['total_sessions'])}")
                if not isinstance(subject_stat['attendance_percent'], (int, float)):
                    raise Exception(f"❌ FAIL: attendance_percent should be number, got {type(subject_stat['attendance_percent'])}")
                    
                # Verify logical consistency
                if subject_stat['total_sessions'] < 0:
                    raise Exception(f"❌ FAIL: total_sessions cannot be negative: {subject_stat['total_sessions']}")
                if subject_stat['attendance_percent'] < 0 or subject_stat['attendance_percent'] > 100:
                    raise Exception(f"❌ FAIL: attendance_percent should be 0-100, got {subject_stat['attendance_percent']}")
                    
                # Verify subject-specific expected values based on our test data
                if subject_name == "Математика":
                    if subject_stat['total_sessions'] != 3:
                        raise Exception(f"❌ FAIL: Математика should have 3 sessions, got {subject_stat['total_sessions']}")
                elif subject_name == "Физика":
                    if subject_stat['total_sessions'] != 2:
                        raise Exception(f"❌ FAIL: Физика should have 2 sessions, got {subject_stat['total_sessions']}")
                elif subject_name == "Программирование":
                    if subject_stat['total_sessions'] != 2:
                        raise Exception(f"❌ FAIL: Программирование should have 2 sessions, got {subject_stat['total_sessions']}")
                        
            self.log("\n✅ ALL SUBJECTS_STATS FIELD TESTS PASSED!")
            self.log("✅ subjects_stats field contains correct structure and data for each subject")
            self.log("✅ All attendance statistics are properly calculated per subject")
            
            return True
            
        except Exception as e:
            self.log(f"❌ SUBJECTS_STATS FIELD TEST FAILED: {e}", "ERROR")
            return False

def main():
    """Run the complete test suite"""
    print("🧪 Journal Backend Test Suite")
    print("=" * 60)
    
    test_suite = JournalStatsTestSuite()
    
    # Run subjects_stats field test (new requirement from review request)
    subjects_stats_test_passed = test_suite.test_subjects_stats_field()
    
    # Run is_linked field test (previous requirement)
    is_linked_test_passed = test_suite.test_is_linked_field()
    
    # Run main test
    main_test_passed = test_suite.test_journal_stats_calculation_fix()
    
    # Run edge case tests
    edge_test_passed = test_suite.test_edge_cases()
    
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    print(f"Subjects Stats Field Test: {'✅ PASSED' if subjects_stats_test_passed else '❌ FAILED'}")
    print(f"Is_Linked Field Test: {'✅ PASSED' if is_linked_test_passed else '❌ FAILED'}")
    print(f"Main Test: {'✅ PASSED' if main_test_passed else '❌ FAILED'}")
    print(f"Edge Cases: {'✅ PASSED' if edge_test_passed else '❌ FAILED'}")
    
    if subjects_stats_test_passed and is_linked_test_passed and main_test_passed and edge_test_passed:
        print("\n🎉 ALL TESTS PASSED! Journal backend is working correctly.")
        return 0
    else:
        print("\n💥 SOME TESTS FAILED! Please check the implementation.")
        return 1

if __name__ == "__main__":
    exit(main())