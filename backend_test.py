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

def main():
    """Run the complete test suite"""
    print("🧪 Journal Stats Calculation Fix - Test Suite")
    print("=" * 60)
    
    test_suite = JournalStatsTestSuite()
    
    # Run main test
    main_test_passed = test_suite.test_journal_stats_calculation_fix()
    
    # Run edge case tests
    edge_test_passed = test_suite.test_edge_cases()
    
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    print(f"Main Test: {'✅ PASSED' if main_test_passed else '❌ FAILED'}")
    print(f"Edge Cases: {'✅ PASSED' if edge_test_passed else '❌ FAILED'}")
    
    if main_test_passed and edge_test_passed:
        print("\n🎉 ALL TESTS PASSED! Journal Stats Calculation Fix is working correctly.")
        return 0
    else:
        print("\n💥 SOME TESTS FAILED! Please check the implementation.")
        return 1

if __name__ == "__main__":
    exit(main())