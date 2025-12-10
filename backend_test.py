#!/usr/bin/env python3
"""
Comprehensive test for journal statistics calculation
Tests the accuracy of GET /api/journals/{journal_id}/stats endpoint
"""

import asyncio
import aiohttp
import json
from datetime import datetime, timedelta
import sys
import os

# Backend URL from CORS_ORIGINS
BACKEND_URL = "https://rudn-schedule.ru/api"

class JournalStatsTest:
    def __init__(self):
        self.session = None
        self.test_results = []
        self.errors = []
        
    async def setup_session(self):
        """Setup HTTP session"""
        self.session = aiohttp.ClientSession()
        
    async def cleanup_session(self):
        """Cleanup HTTP session"""
        if self.session:
            await self.session.close()
            
    async def make_request(self, method, endpoint, **kwargs):
        """Make HTTP request with error handling"""
        url = f"{BACKEND_URL}{endpoint}"
        try:
            async with self.session.request(method, url, **kwargs) as response:
                if response.content_type == 'application/json':
                    data = await response.json()
                else:
                    data = await response.text()
                return response.status, data
        except Exception as e:
            return None, str(e)
            
    async def get_journals_for_user(self, telegram_id):
        """Get list of journals for a user"""
        print(f"📋 Getting journals for user {telegram_id}...")
        status, data = await self.make_request('GET', f'/journals/{telegram_id}')
        
        if status == 200 and isinstance(data, list):
            print(f"✅ Found {len(data)} journals for user {telegram_id}")
            return data
        else:
            print(f"❌ Failed to get journals: {status} - {data}")
            return []
            
    async def get_journal_stats(self, journal_id, telegram_id):
        """Get journal statistics"""
        print(f"📊 Getting stats for journal {journal_id}...")
        status, data = await self.make_request('GET', f'/journals/{journal_id}/stats', 
                                               params={'telegram_id': telegram_id})
        
        if status == 200:
            print(f"✅ Successfully retrieved journal stats")
            return data
        else:
            print(f"❌ Failed to get journal stats: {status} - {data}")
            return None
            
    async def get_journal_students(self, journal_id):
        """Get list of students in journal"""
        print(f"👥 Getting students for journal {journal_id}...")
        status, data = await self.make_request('GET', f'/journals/{journal_id}/students')
        
        if status == 200 and isinstance(data, list):
            print(f"✅ Found {len(data)} students")
            return data
        else:
            print(f"❌ Failed to get students: {status} - {data}")
            return []
            
    async def get_journal_sessions(self, journal_id):
        """Get list of sessions in journal"""
        print(f"📅 Getting sessions for journal {journal_id}...")
        status, data = await self.make_request('GET', f'/journals/{journal_id}/sessions')
        
        if status == 200 and isinstance(data, list):
            print(f"✅ Found {len(data)} sessions")
            return data
        else:
            print(f"❌ Failed to get sessions: {status} - {data}")
            return []
            
    async def get_session_attendance(self, session_id):
        """Get attendance records for a session"""
        print(f"📝 Getting attendance for session {session_id}...")
        status, data = await self.make_request('GET', f'/journals/sessions/{session_id}/attendance')
        
        if status == 200 and isinstance(data, list):
            print(f"✅ Found {len(data)} attendance records")
            return data
        else:
            print(f"❌ Failed to get attendance: {status} - {data}")
            return []
            
    def calculate_expected_stats(self, students, sessions, all_attendance):
        """Calculate expected statistics manually"""
        print("🧮 Calculating expected statistics...")
        
        # Group attendance by student
        student_attendance = {}
        for record in all_attendance:
            student_id = record['student_id']
            if student_id not in student_attendance:
                student_attendance[student_id] = []
            student_attendance[student_id].append(record)
            
        # Calculate stats for each student
        expected_students_stats = []
        total_numerator = 0
        total_denominator = 0
        
        for student in students:
            student_id = student['id']
            attendance_records = student_attendance.get(student_id, [])
            
            # Count by status
            present_count = sum(1 for r in attendance_records if r['status'] == 'present')
            late_count = sum(1 for r in attendance_records if r['status'] == 'late')
            absent_count = sum(1 for r in attendance_records if r['status'] == 'absent')
            excused_count = sum(1 for r in attendance_records if r['status'] == 'excused')
            
            # Calculate attendance percentage
            # According to the backend logic: numerator = present + late, denominator = total_sessions - excused
            numerator = present_count + late_count
            denominator = len(sessions) - excused_count
            
            if denominator > 0:
                attendance_percent = round((numerator / denominator) * 100, 1)
                total_numerator += numerator
                total_denominator += denominator
            else:
                attendance_percent = None
                
            expected_students_stats.append({
                'student_id': student_id,
                'full_name': student['full_name'],
                'present_count': numerator,  # Backend returns present + late as present_count
                'absent_count': denominator - numerator,  # Implicit absent calculation
                'excused_count': excused_count,
                'late_count': late_count,
                'attendance_percent': attendance_percent,
                'total_sessions': len(sessions)
            })
            
        # Calculate overall attendance percentage
        if total_denominator > 0:
            overall_attendance_percent = round((total_numerator / total_denominator) * 100, 1)
        else:
            overall_attendance_percent = 0
            
        # Calculate session stats
        expected_sessions_stats = []
        for session in sessions:
            session_id = session['session_id']
            session_records = [r for r in all_attendance if r['session_id'] == session_id]
            
            present_count = sum(1 for r in session_records if r['status'] in ['present', 'late'])
            absent_count = sum(1 for r in session_records if r['status'] == 'absent')
            
            expected_sessions_stats.append({
                'session_id': session_id,
                'present_count': present_count,
                'absent_count': absent_count
            })
            
        return {
            'overall_attendance_percent': overall_attendance_percent,
            'students_stats': expected_students_stats,
            'sessions_stats': expected_sessions_stats
        }
        
    def compare_stats(self, actual_stats, expected_stats):
        """Compare actual vs expected statistics"""
        print("🔍 Comparing actual vs expected statistics...")
        
        discrepancies = []
        
        # Compare overall attendance percentage
        actual_overall = actual_stats.get('overall_attendance_percent', 0)
        expected_overall = expected_stats['overall_attendance_percent']
        
        if actual_overall != expected_overall:
            discrepancies.append({
                'type': 'overall_attendance_percent',
                'actual': actual_overall,
                'expected': expected_overall,
                'difference': abs(actual_overall - expected_overall)
            })
            
        # Compare student statistics
        actual_students = {s['id']: s for s in actual_stats.get('students_stats', [])}
        expected_students = {s['student_id']: s for s in expected_stats['students_stats']}
        
        for student_id, expected in expected_students.items():
            actual = actual_students.get(student_id)
            if not actual:
                discrepancies.append({
                    'type': 'missing_student',
                    'student_id': student_id,
                    'student_name': expected['full_name']
                })
                continue
                
            # Compare each field
            fields_to_compare = ['present_count', 'absent_count', 'excused_count', 'late_count', 'attendance_percent']
            for field in fields_to_compare:
                actual_val = actual.get(field)
                expected_val = expected.get(field)
                
                if actual_val != expected_val:
                    discrepancies.append({
                        'type': 'student_stat_mismatch',
                        'student_id': student_id,
                        'student_name': expected['full_name'],
                        'field': field,
                        'actual': actual_val,
                        'expected': expected_val
                    })
                    
        # Compare session statistics
        actual_sessions = {s['session_id']: s for s in actual_stats.get('sessions_stats', [])}
        expected_sessions = {s['session_id']: s for s in expected_stats['sessions_stats']}
        
        for session_id, expected in expected_sessions.items():
            actual = actual_sessions.get(session_id)
            if not actual:
                discrepancies.append({
                    'type': 'missing_session',
                    'session_id': session_id
                })
                continue
                
            # Compare session fields
            for field in ['present_count', 'absent_count']:
                actual_val = actual.get(field)
                expected_val = expected.get(field)
                
                if actual_val != expected_val:
                    discrepancies.append({
                        'type': 'session_stat_mismatch',
                        'session_id': session_id,
                        'field': field,
                        'actual': actual_val,
                        'expected': expected_val
                    })
                    
        return discrepancies
        
    async def test_journal_stats(self, journal_id, owner_id):
        """Test statistics calculation for a specific journal"""
        print(f"\n🧪 Testing journal {journal_id} statistics...")
        
        # Get journal statistics
        stats = await self.get_journal_stats(journal_id, owner_id)
        if not stats:
            self.errors.append(f"Failed to get stats for journal {journal_id}")
            return False
            
        # Get raw data
        students = await self.get_journal_students(journal_id)
        sessions = await self.get_journal_sessions(journal_id)
        
        if not students or not sessions:
            print("⚠️ No students or sessions found, skipping detailed validation")
            return True
            
        # Get attendance for all sessions
        all_attendance = []
        for session in sessions:
            session_attendance = await self.get_session_attendance(session['session_id'])
            all_attendance.extend(session_attendance)
            
        # Calculate expected statistics
        expected_stats = self.calculate_expected_stats(students, sessions, all_attendance)
        
        # Compare actual vs expected
        discrepancies = self.compare_stats(stats, expected_stats)
        
        if discrepancies:
            print(f"❌ Found {len(discrepancies)} discrepancies:")
            for disc in discrepancies:
                print(f"   • {disc}")
            self.errors.extend(discrepancies)
            return False
        else:
            print("✅ All statistics calculations are correct!")
            return True
            
    async def run_tests(self):
        """Run all journal statistics tests"""
        print("🚀 Starting Journal Statistics Tests")
        print("=" * 50)
        
        await self.setup_session()
        
        try:
            # Test with the known journal from database
            journal_id = "fcb249a4-d1d7-447b-bd34-d275b776adf2"
            owner_id = 999888777
            
            print(f"\n📚 Testing journal: {journal_id}")
            print(f"👤 Owner: {owner_id}")
            
            # Test the journal
            success = await self.test_journal_stats(journal_id, owner_id)
                    
            # Print summary
            print("\n" + "=" * 50)
            print("📊 TEST SUMMARY")
            print("=" * 50)
            
            if self.errors:
                print(f"❌ Found {len(self.errors)} issues:")
                for error in self.errors:
                    print(f"   • {error}")
            else:
                print("✅ All journal statistics calculations are working correctly!")
                
            print(f"📈 Success Rate: {'1/1' if success else '0/1'} journals tested successfully")
            
            return len(self.errors) == 0
            
        finally:
            await self.cleanup_session()

async def main():
    """Main test function"""
    tester = JournalStatsTest()
    success = await tester.run_tests()
    
    if success:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Some tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())