#!/usr/bin/env python3
"""
Admin Panel Backend Test Suite
Tests the admin panel endpoints according to the review request.

CRITICAL: Testing the bug fix that total_users should be SAME regardless of days param.
"""

import requests
import json
from datetime import datetime
from typing import Dict, Any, List

# Get backend URL from frontend .env
import os

def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip() + '/api'
        raise ValueError("REACT_APP_BACKEND_URL not found in frontend/.env")
    except Exception as e:
        print(f"Error reading frontend .env: {e}")
        return "http://localhost:8001/api"  # fallback

BASE_URL = get_backend_url()

print(f"Using backend URL: {BASE_URL}")

class AdminPanelTestSuite:
    def __init__(self):
        self.session = requests.Session()
        self.session.timeout = 30
        
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
            
    def test_admin_stats_basic(self):
        """Test GET /api/admin/stats without params"""
        self.log("=" * 60)
        self.log("TESTING GET /api/admin/stats (basic)")
        self.log("=" * 60)
        
        try:
            response = self.make_request("GET", "/admin/stats")
            if response.status_code != 200:
                raise Exception(f"Failed: {response.status_code} - {response.text}")
                
            stats = response.json()
            self.log(f"✅ Basic admin stats retrieved")
            
            # Check required fields
            required_fields = [
                'total_users', 'active_users_today', 'new_users_week', 'total_tasks',
                'total_completed_tasks', 'total_achievements_earned', 'total_rooms'
            ]
            
            for field in required_fields:
                if field not in stats:
                    raise Exception(f"❌ Missing field: {field}")
                if not isinstance(stats[field], int):
                    raise Exception(f"❌ {field} should be int, got {type(stats[field])}")
                if stats[field] < 0:
                    raise Exception(f"❌ {field} should be >= 0, got {stats[field]}")
                    
            self.log(f"📊 Basic Stats Summary:")
            self.log(f"   Total Users: {stats['total_users']}")
            self.log(f"   Active Users Today: {stats['active_users_today']}")
            self.log(f"   New Users Week: {stats['new_users_week']}")
            self.log(f"   Total Tasks: {stats['total_tasks']}")
            
            return stats
            
        except Exception as e:
            self.log(f"❌ BASIC STATS TEST FAILED: {e}", "ERROR")
            return None
            
    def test_admin_stats_with_days_param(self):
        """Test GET /api/admin/stats with days parameter - CRITICAL BUG FIX TEST"""
        self.log("=" * 60)
        self.log("TESTING GET /api/admin/stats with days parameter")
        self.log("CRITICAL: total_users should be SAME regardless of days param")
        self.log("=" * 60)
        
        try:
            # Get basic stats first (no days param)
            basic_response = self.make_request("GET", "/admin/stats")
            if basic_response.status_code != 200:
                raise Exception(f"Basic stats failed: {basic_response.status_code}")
            basic_stats = basic_response.json()
            basic_total_users = basic_stats['total_users']
            
            # Test with days=7
            response_7 = self.make_request("GET", "/admin/stats?days=7")
            if response_7.status_code != 200:
                raise Exception(f"Stats with days=7 failed: {response_7.status_code} - {response_7.text}")
            stats_7 = response_7.json()
            
            # Test with days=30
            response_30 = self.make_request("GET", "/admin/stats?days=30")
            if response_30.status_code != 200:
                raise Exception(f"Stats with days=30 failed: {response_30.status_code} - {response_30.text}")
            stats_30 = response_30.json()
            
            self.log(f"✅ Retrieved stats with all days parameters")
            
            # CRITICAL CHECK: total_users should be SAME in all cases
            self.log(f"🔍 CRITICAL BUG FIX VERIFICATION:")
            self.log(f"   total_users (no days): {basic_total_users}")
            self.log(f"   total_users (days=7):  {stats_7['total_users']}")
            self.log(f"   total_users (days=30): {stats_30['total_users']}")
            
            if basic_total_users != stats_7['total_users']:
                raise Exception(f"❌ BUG: total_users differs with days=7: {basic_total_users} vs {stats_7['total_users']}")
                
            if basic_total_users != stats_30['total_users']:
                raise Exception(f"❌ BUG: total_users differs with days=30: {basic_total_users} vs {stats_30['total_users']}")
                
            self.log(f"✅ CRITICAL BUG FIX VERIFIED: total_users is consistent across all calls")
            
            return True
            
        except Exception as e:
            self.log(f"❌ DAYS PARAMETER TEST FAILED: {e}", "ERROR")
            return False
            
    def test_faculty_stats(self):
        """Test GET /api/admin/faculty-stats"""
        self.log("=" * 60)
        self.log("TESTING GET /api/admin/faculty-stats")
        self.log("=" * 60)
        
        try:
            # Test basic endpoint
            response = self.make_request("GET", "/admin/faculty-stats")
            if response.status_code != 200:
                raise Exception(f"Faculty stats failed: {response.status_code} - {response.text}")
                
            faculty_stats = response.json()
            self.log(f"✅ Faculty stats retrieved")
            
            # Should return a list
            if not isinstance(faculty_stats, list):
                raise Exception(f"❌ Faculty stats should be list, got {type(faculty_stats)}")
                
            self.log(f"📊 Faculty Stats: {len(faculty_stats)} faculties")
            
            # Test with days parameter
            response_days = self.make_request("GET", "/admin/faculty-stats?days=7")
            if response_days.status_code != 200:
                raise Exception(f"Faculty stats with days=7 failed: {response_days.status_code} - {response_days.text}")
                
            self.log(f"✅ Faculty stats with days=7 retrieved")
            
            return True
            
        except Exception as e:
            self.log(f"❌ FACULTY STATS TEST FAILED: {e}", "ERROR")
            return False
            
    def test_course_stats(self):
        """Test GET /api/admin/course-stats"""
        self.log("=" * 60)
        self.log("TESTING GET /api/admin/course-stats")
        self.log("=" * 60)
        
        try:
            # Test basic endpoint
            response = self.make_request("GET", "/admin/course-stats")
            if response.status_code != 200:
                raise Exception(f"Course stats failed: {response.status_code} - {response.text}")
                
            course_stats = response.json()
            self.log(f"✅ Course stats retrieved")
            
            # Should return a list
            if not isinstance(course_stats, list):
                raise Exception(f"❌ Course stats should be list, got {type(course_stats)}")
                
            self.log(f"📊 Course Stats: {len(course_stats)} courses")
            
            # Test with days parameter
            response_days = self.make_request("GET", "/admin/course-stats?days=30")
            if response_days.status_code != 200:
                raise Exception(f"Course stats with days=30 failed: {response_days.status_code} - {response_days.text}")
                
            self.log(f"✅ Course stats with days=30 retrieved")
            
            return True
            
        except Exception as e:
            self.log(f"❌ COURSE STATS TEST FAILED: {e}", "ERROR")
            return False
            
    def test_hourly_activity(self):
        """Test GET /api/admin/hourly-activity"""
        self.log("=" * 60)
        self.log("TESTING GET /api/admin/hourly-activity")
        self.log("=" * 60)
        
        try:
            response = self.make_request("GET", "/admin/hourly-activity")
            if response.status_code != 200:
                raise Exception(f"Hourly activity failed: {response.status_code} - {response.text}")
                
            hourly_activity = response.json()
            self.log(f"✅ Hourly activity retrieved")
            
            # Should return a list
            if not isinstance(hourly_activity, list):
                raise Exception(f"❌ Hourly activity should be list, got {type(hourly_activity)}")
                
            self.log(f"📊 Hourly Activity: {len(hourly_activity)} data points")
            
            return True
            
        except Exception as e:
            self.log(f"❌ HOURLY ACTIVITY TEST FAILED: {e}", "ERROR")
            return False
            
    def test_weekly_activity(self):
        """Test GET /api/admin/weekly-activity"""
        self.log("=" * 60)
        self.log("TESTING GET /api/admin/weekly-activity")
        self.log("=" * 60)
        
        try:
            response = self.make_request("GET", "/admin/weekly-activity")
            if response.status_code != 200:
                raise Exception(f"Weekly activity failed: {response.status_code} - {response.text}")
                
            weekly_activity = response.json()
            self.log(f"✅ Weekly activity retrieved")
            
            # Should return a list
            if not isinstance(weekly_activity, list):
                raise Exception(f"❌ Weekly activity should be list, got {type(weekly_activity)}")
                
            self.log(f"📊 Weekly Activity: {len(weekly_activity)} data points")
            
            return True
            
        except Exception as e:
            self.log(f"❌ WEEKLY ACTIVITY TEST FAILED: {e}", "ERROR")
            return False
            
    def test_admin_users(self):
        """Test GET /api/admin/users"""
        self.log("=" * 60)
        self.log("TESTING GET /api/admin/users")
        self.log("=" * 60)
        
        try:
            # Test basic endpoint
            response = self.make_request("GET", "/admin/users")
            if response.status_code != 200:
                raise Exception(f"Admin users failed: {response.status_code} - {response.text}")
                
            users = response.json()
            self.log(f"✅ Admin users retrieved")
            
            # Should return a list
            if not isinstance(users, list):
                raise Exception(f"❌ Admin users should be list, got {type(users)}")
                
            self.log(f"📊 Admin Users: {len(users)} users")
            
            # Test with limit parameter
            response_limit = self.make_request("GET", "/admin/users?limit=10")
            if response_limit.status_code != 200:
                raise Exception(f"Admin users with limit failed: {response_limit.status_code} - {response_limit.text}")
                
            limited_users = response_limit.json()
            if len(limited_users) > 10:
                raise Exception(f"❌ Limit=10 but got {len(limited_users)} users")
                
            self.log(f"✅ Admin users with limit=10 retrieved ({len(limited_users)} users)")
            
            return True
            
        except Exception as e:
            self.log(f"❌ ADMIN USERS TEST FAILED: {e}", "ERROR")
            return False

def main():
    """Run the complete admin panel test suite"""
    print("🧪 Admin Panel Backend Test Suite")
    print("=" * 60)
    
    test_suite = AdminPanelTestSuite()
    
    # Run all tests as specified in the review request
    results = {}
    
    results['basic_stats'] = test_suite.test_admin_stats_basic()
    results['stats_days_param'] = test_suite.test_admin_stats_with_days_param()  # CRITICAL BUG FIX
    results['faculty_stats'] = test_suite.test_faculty_stats()
    results['course_stats'] = test_suite.test_course_stats()
    results['hourly_activity'] = test_suite.test_hourly_activity()
    results['weekly_activity'] = test_suite.test_weekly_activity()
    results['admin_users'] = test_suite.test_admin_users()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 ADMIN PANEL BACKEND TEST SUMMARY")
    print("=" * 60)
    
    passed_count = sum(1 for result in results.values() if result)
    total_count = len(results)
    
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    print(f"\nOverall: {passed_count}/{total_count} tests passed")
    
    if all(results.values()):
        print("\n🎉 ALL ADMIN PANEL TESTS PASSED!")
        print("✅ All admin endpoints are working correctly")
        print("✅ CRITICAL BUG FIX VERIFIED: total_users consistent across all calls")
        return 0
    else:
        print("\n💥 SOME ADMIN PANEL TESTS FAILED!")
        print("Please check the implementation and error messages above.")
        return 1

if __name__ == "__main__":
    exit(main())