#!/usr/bin/env python3
"""
Test only the Admin Panel endpoints for RUDN Schedule API
"""

import requests
import json
import time
import sys
from typing import Dict, List, Optional

# Configuration
BACKEND_URL = "http://localhost:8001/api"
TIMEOUT = 30

class AdminEndpointTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.session.timeout = TIMEOUT
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, message: str, details: Optional[Dict] = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details or {}
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details:
            print(f"   Details: {json.dumps(details, indent=2, ensure_ascii=False)}")
        print()

    def test_admin_stats_endpoint(self) -> bool:
        """Test GET /api/admin/stats endpoint"""
        try:
            print("🔍 Testing GET /api/admin/stats...")
            
            # Test with different days parameters
            test_cases = [
                {"days": None, "name": "all time"},
                {"days": 7, "name": "7 days"},
                {"days": 30, "name": "30 days"}
            ]
            
            for case in test_cases:
                params = {}
                if case["days"] is not None:
                    params["days"] = case["days"]
                
                response = self.session.get(f"{self.base_url}/admin/stats", params=params)
                
                if response.status_code != 200:
                    self.log_test(f"GET /api/admin/stats ({case['name']})", False, 
                                f"HTTP {response.status_code}: {response.text}")
                    return False
                
                stats = response.json()
                
                # Validate response structure
                required_fields = [
                    'total_users', 'active_users_today', 'active_users_week', 'active_users_month',
                    'new_users_today', 'new_users_week', 'new_users_month', 'total_tasks',
                    'total_completed_tasks', 'total_achievements_earned', 'total_rooms', 'total_schedule_views'
                ]
                
                for field in required_fields:
                    if field not in stats:
                        self.log_test(f"GET /api/admin/stats ({case['name']})", False, 
                                    f"Missing required field: {field}")
                        return False
                    
                    # Validate numeric values
                    if not isinstance(stats[field], int) or stats[field] < 0:
                        self.log_test(f"GET /api/admin/stats ({case['name']})", False, 
                                    f"Field {field} should be non-negative integer, got {stats[field]}")
                        return False
            
            self.log_test("GET /api/admin/stats", True, 
                        "Successfully retrieved admin statistics for all time periods",
                        {"sample_stats": stats})
            return True
            
        except Exception as e:
            self.log_test("GET /api/admin/stats", False, f"Exception: {str(e)}")
            return False

    def test_admin_users_activity_endpoint(self) -> bool:
        """Test GET /api/admin/users-activity endpoint"""
        try:
            print("🔍 Testing GET /api/admin/users-activity...")
            
            # Test with different days parameters
            test_cases = [7, 30, None]
            
            for days in test_cases:
                params = {}
                if days is not None:
                    params["days"] = days
                
                response = self.session.get(f"{self.base_url}/admin/users-activity", params=params)
                
                if response.status_code != 200:
                    self.log_test(f"GET /api/admin/users-activity (days={days})", False, 
                                f"HTTP {response.status_code}: {response.text}")
                    return False
                
                activity = response.json()
                
                # Validate response structure
                if not isinstance(activity, list):
                    self.log_test(f"GET /api/admin/users-activity (days={days})", False, 
                                "Response should be a list")
                    return False
                
                # Validate each activity point
                for point in activity:
                    if not isinstance(point, dict):
                        self.log_test(f"GET /api/admin/users-activity (days={days})", False, 
                                    "Activity point should be a dictionary")
                        return False
                    
                    required_fields = ['date', 'count']
                    for field in required_fields:
                        if field not in point:
                            self.log_test(f"GET /api/admin/users-activity (days={days})", False, 
                                        f"Activity point missing field: {field}")
                            return False
                    
                    # Validate date format (YYYY-MM-DD)
                    import re
                    if not re.match(r'^\d{4}-\d{2}-\d{2}$', point['date']):
                        self.log_test(f"GET /api/admin/users-activity (days={days})", False, 
                                    f"Invalid date format: {point['date']}")
                        return False
                    
                    # Validate count is non-negative integer
                    if not isinstance(point['count'], int) or point['count'] < 0:
                        self.log_test(f"GET /api/admin/users-activity (days={days})", False, 
                                    f"Count should be non-negative integer, got {point['count']}")
                        return False
            
            self.log_test("GET /api/admin/users-activity", True, 
                        "Successfully retrieved users activity data for all periods",
                        {"sample_data": activity[:3] if activity else []})
            return True
            
        except Exception as e:
            self.log_test("GET /api/admin/users-activity", False, f"Exception: {str(e)}")
            return False

    def test_admin_hourly_activity_endpoint(self) -> bool:
        """Test GET /api/admin/hourly-activity endpoint"""
        try:
            print("🔍 Testing GET /api/admin/hourly-activity...")
            
            # Test with different days parameters
            test_cases = [7, 30, None]
            
            for days in test_cases:
                params = {}
                if days is not None:
                    params["days"] = days
                
                response = self.session.get(f"{self.base_url}/admin/hourly-activity", params=params)
                
                if response.status_code != 200:
                    self.log_test(f"GET /api/admin/hourly-activity (days={days})", False, 
                                f"HTTP {response.status_code}: {response.text}")
                    return False
                
                hourly_activity = response.json()
                
                # Validate response structure
                if not isinstance(hourly_activity, list):
                    self.log_test(f"GET /api/admin/hourly-activity (days={days})", False, 
                                "Response should be a list")
                    return False
                
                # Should have exactly 24 hours (0-23)
                if len(hourly_activity) != 24:
                    self.log_test(f"GET /api/admin/hourly-activity (days={days})", False, 
                                f"Expected 24 hours, got {len(hourly_activity)}")
                    return False
                
                # Validate each hour point
                hours_seen = set()
                for point in hourly_activity:
                    if not isinstance(point, dict):
                        self.log_test(f"GET /api/admin/hourly-activity (days={days})", False, 
                                    "Hour point should be a dictionary")
                        return False
                    
                    required_fields = ['hour', 'count']
                    for field in required_fields:
                        if field not in point:
                            self.log_test(f"GET /api/admin/hourly-activity (days={days})", False, 
                                        f"Hour point missing field: {field}")
                            return False
                    
                    # Validate hour is 0-23
                    if not isinstance(point['hour'], int) or point['hour'] < 0 or point['hour'] > 23:
                        self.log_test(f"GET /api/admin/hourly-activity (days={days})", False, 
                                    f"Hour should be 0-23, got {point['hour']}")
                        return False
                    
                    hours_seen.add(point['hour'])
                    
                    # Validate count is non-negative integer
                    if not isinstance(point['count'], int) or point['count'] < 0:
                        self.log_test(f"GET /api/admin/hourly-activity (days={days})", False, 
                                    f"Count should be non-negative integer, got {point['count']}")
                        return False
                
                # Ensure all hours 0-23 are present
                if hours_seen != set(range(24)):
                    self.log_test(f"GET /api/admin/hourly-activity (days={days})", False, 
                                f"Missing hours: {set(range(24)) - hours_seen}")
                    return False
            
            self.log_test("GET /api/admin/hourly-activity", True, 
                        "Successfully retrieved hourly activity data with all 24 hours",
                        {"sample_hours": hourly_activity[:5] if hourly_activity else []})
            return True
            
        except Exception as e:
            self.log_test("GET /api/admin/hourly-activity", False, f"Exception: {str(e)}")
            return False

    def test_admin_weekly_activity_endpoint(self) -> bool:
        """Test GET /api/admin/weekly-activity endpoint"""
        try:
            print("🔍 Testing GET /api/admin/weekly-activity...")
            
            # Test with different days parameters
            test_cases = [7, 30, None]
            
            for days in test_cases:
                params = {}
                if days is not None:
                    params["days"] = days
                
                response = self.session.get(f"{self.base_url}/admin/weekly-activity", params=params)
                
                if response.status_code != 200:
                    self.log_test(f"GET /api/admin/weekly-activity (days={days})", False, 
                                f"HTTP {response.status_code}: {response.text}")
                    return False
                
                weekly_activity = response.json()
                
                # Validate response structure
                if not isinstance(weekly_activity, list):
                    self.log_test(f"GET /api/admin/weekly-activity (days={days})", False, 
                                "Response should be a list")
                    return False
                
                # Should have exactly 7 days
                if len(weekly_activity) != 7:
                    self.log_test(f"GET /api/admin/weekly-activity (days={days})", False, 
                                f"Expected 7 days, got {len(weekly_activity)}")
                    return False
                
                # Expected day names in Russian
                expected_days = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]
                days_seen = []
                
                # Validate each day point
                for point in weekly_activity:
                    if not isinstance(point, dict):
                        self.log_test(f"GET /api/admin/weekly-activity (days={days})", False, 
                                    "Day point should be a dictionary")
                        return False
                    
                    required_fields = ['day', 'count']
                    for field in required_fields:
                        if field not in point:
                            self.log_test(f"GET /api/admin/weekly-activity (days={days})", False, 
                                        f"Day point missing field: {field}")
                            return False
                    
                    # Validate day name
                    if point['day'] not in expected_days:
                        self.log_test(f"GET /api/admin/weekly-activity (days={days})", False, 
                                    f"Invalid day name: {point['day']}")
                        return False
                    
                    days_seen.append(point['day'])
                    
                    # Validate count is non-negative integer
                    if not isinstance(point['count'], int) or point['count'] < 0:
                        self.log_test(f"GET /api/admin/weekly-activity (days={days})", False, 
                                    f"Count should be non-negative integer, got {point['count']}")
                        return False
                
                # Ensure all days are present
                if set(days_seen) != set(expected_days):
                    self.log_test(f"GET /api/admin/weekly-activity (days={days})", False, 
                                f"Missing days: {set(expected_days) - set(days_seen)}")
                    return False
            
            self.log_test("GET /api/admin/weekly-activity", True, 
                        "Successfully retrieved weekly activity data with all 7 days",
                        {"sample_days": weekly_activity})
            return True
            
        except Exception as e:
            self.log_test("GET /api/admin/weekly-activity", False, f"Exception: {str(e)}")
            return False

    def test_admin_feature_usage_endpoint(self) -> bool:
        """Test GET /api/admin/feature-usage endpoint"""
        try:
            print("🔍 Testing GET /api/admin/feature-usage...")
            
            # Test with different days parameters
            test_cases = [7, 30, None]
            
            for days in test_cases:
                params = {}
                if days is not None:
                    params["days"] = days
                
                response = self.session.get(f"{self.base_url}/admin/feature-usage", params=params)
                
                if response.status_code != 200:
                    self.log_test(f"GET /api/admin/feature-usage (days={days})", False, 
                                f"HTTP {response.status_code}: {response.text}")
                    return False
                
                feature_usage = response.json()
                
                # Validate response structure
                if not isinstance(feature_usage, dict):
                    self.log_test(f"GET /api/admin/feature-usage (days={days})", False, 
                                "Response should be a dictionary")
                    return False
                
                # Check required fields
                required_fields = [
                    'schedule_views', 'analytics_views', 'calendar_opens', 
                    'notifications_configured', 'schedule_shares', 'tasks_created', 'achievements_earned'
                ]
                
                for field in required_fields:
                    if field not in feature_usage:
                        self.log_test(f"GET /api/admin/feature-usage (days={days})", False, 
                                    f"Missing required field: {field}")
                        return False
                    
                    # Validate numeric values
                    if not isinstance(feature_usage[field], int) or feature_usage[field] < 0:
                        self.log_test(f"GET /api/admin/feature-usage (days={days})", False, 
                                    f"Field {field} should be non-negative integer, got {feature_usage[field]}")
                        return False
            
            self.log_test("GET /api/admin/feature-usage", True, 
                        "Successfully retrieved feature usage statistics",
                        {"sample_usage": feature_usage})
            return True
            
        except Exception as e:
            self.log_test("GET /api/admin/feature-usage", False, f"Exception: {str(e)}")
            return False

    def test_admin_top_users_endpoint(self) -> bool:
        """Test GET /api/admin/top-users endpoint"""
        try:
            print("🔍 Testing GET /api/admin/top-users...")
            
            # Test with different metrics and limits
            test_cases = [
                {"metric": "points", "limit": 10},
                {"metric": "achievements", "limit": 5},
                {"metric": "activity", "limit": 15}
            ]
            
            for case in test_cases:
                params = {
                    "metric": case["metric"],
                    "limit": case["limit"]
                }
                
                response = self.session.get(f"{self.base_url}/admin/top-users", params=params)
                
                if response.status_code != 200:
                    self.log_test(f"GET /api/admin/top-users (metric={case['metric']})", False, 
                                f"HTTP {response.status_code}: {response.text}")
                    return False
                
                top_users = response.json()
                
                # Validate response structure
                if not isinstance(top_users, list):
                    self.log_test(f"GET /api/admin/top-users (metric={case['metric']})", False, 
                                "Response should be a list")
                    return False
                
                # Should not exceed the limit
                if len(top_users) > case["limit"]:
                    self.log_test(f"GET /api/admin/top-users (metric={case['metric']})", False, 
                                f"Response exceeds limit: {len(top_users)} > {case['limit']}")
                    return False
                
                # Validate each user
                for user in top_users:
                    if not isinstance(user, dict):
                        self.log_test(f"GET /api/admin/top-users (metric={case['metric']})", False, 
                                    "User should be a dictionary")
                        return False
                    
                    required_fields = ['telegram_id', 'username', 'first_name', 'value', 'group_name']
                    for field in required_fields:
                        if field not in user:
                            self.log_test(f"GET /api/admin/top-users (metric={case['metric']})", False, 
                                        f"User missing field: {field}")
                            return False
                    
                    # Validate telegram_id is integer
                    if not isinstance(user['telegram_id'], int):
                        self.log_test(f"GET /api/admin/top-users (metric={case['metric']})", False, 
                                    f"telegram_id should be integer, got {type(user['telegram_id'])}")
                        return False
                    
                    # Validate value is non-negative integer
                    if not isinstance(user['value'], int) or user['value'] < 0:
                        self.log_test(f"GET /api/admin/top-users (metric={case['metric']})", False, 
                                    f"Value should be non-negative integer, got {user['value']}")
                        return False
            
            self.log_test("GET /api/admin/top-users", True, 
                        "Successfully retrieved top users for all metrics",
                        {"sample_users": top_users[:2] if top_users else []})
            return True
            
        except Exception as e:
            self.log_test("GET /api/admin/top-users", False, f"Exception: {str(e)}")
            return False

    def test_admin_faculty_stats_endpoint(self) -> bool:
        """Test GET /api/admin/faculty-stats endpoint"""
        try:
            print("🔍 Testing GET /api/admin/faculty-stats...")
            
            response = self.session.get(f"{self.base_url}/admin/faculty-stats")
            
            if response.status_code != 200:
                self.log_test("GET /api/admin/faculty-stats", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            faculty_stats = response.json()
            
            # Validate response structure
            if not isinstance(faculty_stats, list):
                self.log_test("GET /api/admin/faculty-stats", False, 
                            "Response should be a list")
                return False
            
            # Validate each faculty stat (if any exist)
            for faculty in faculty_stats:
                if not isinstance(faculty, dict):
                    self.log_test("GET /api/admin/faculty-stats", False, 
                                "Faculty stat should be a dictionary")
                    return False
                
                required_fields = ['faculty_name', 'faculty_id', 'users_count']
                for field in required_fields:
                    if field not in faculty:
                        self.log_test("GET /api/admin/faculty-stats", False, 
                                    f"Faculty stat missing field: {field}")
                        return False
                
                # Validate users_count is positive integer
                if not isinstance(faculty['users_count'], int) or faculty['users_count'] <= 0:
                    self.log_test("GET /api/admin/faculty-stats", False, 
                                f"users_count should be positive integer, got {faculty['users_count']}")
                    return False
                
                # Validate faculty_name is string
                if not isinstance(faculty['faculty_name'], str):
                    self.log_test("GET /api/admin/faculty-stats", False, 
                                f"faculty_name should be string, got {type(faculty['faculty_name'])}")
                    return False
            
            self.log_test("GET /api/admin/faculty-stats", True, 
                        "Successfully retrieved faculty statistics",
                        {"faculties_count": len(faculty_stats), "sample_faculty": faculty_stats[0] if faculty_stats else None})
            return True
            
        except Exception as e:
            self.log_test("GET /api/admin/faculty-stats", False, f"Exception: {str(e)}")
            return False

    def test_admin_course_stats_endpoint(self) -> bool:
        """Test GET /api/admin/course-stats endpoint"""
        try:
            print("🔍 Testing GET /api/admin/course-stats...")
            
            response = self.session.get(f"{self.base_url}/admin/course-stats")
            
            if response.status_code != 200:
                self.log_test("GET /api/admin/course-stats", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            course_stats = response.json()
            
            # Validate response structure
            if not isinstance(course_stats, list):
                self.log_test("GET /api/admin/course-stats", False, 
                            "Response should be a list")
                return False
            
            # Validate each course stat (if any exist)
            for course in course_stats:
                if not isinstance(course, dict):
                    self.log_test("GET /api/admin/course-stats", False, 
                                "Course stat should be a dictionary")
                    return False
                
                required_fields = ['course', 'users_count']
                for field in required_fields:
                    if field not in course:
                        self.log_test("GET /api/admin/course-stats", False, 
                                    f"Course stat missing field: {field}")
                        return False
                
                # Validate users_count is positive integer
                if not isinstance(course['users_count'], int) or course['users_count'] <= 0:
                    self.log_test("GET /api/admin/course-stats", False, 
                                f"users_count should be positive integer, got {course['users_count']}")
                    return False
            
            self.log_test("GET /api/admin/course-stats", True, 
                        "Successfully retrieved course statistics",
                        {"courses_count": len(course_stats), "sample_course": course_stats[0] if course_stats else None})
            return True
            
        except Exception as e:
            self.log_test("GET /api/admin/course-stats", False, f"Exception: {str(e)}")
            return False

    def run_admin_tests(self) -> bool:
        """Run all admin endpoint tests"""
        print("🚀 Starting Admin Panel API Tests...")
        print(f"Backend URL: {self.base_url}")
        print("=" * 80)
        
        # List of admin test methods
        tests = [
            self.test_admin_stats_endpoint,
            self.test_admin_users_activity_endpoint,
            self.test_admin_hourly_activity_endpoint,
            self.test_admin_weekly_activity_endpoint,
            self.test_admin_feature_usage_endpoint,
            self.test_admin_top_users_endpoint,
            self.test_admin_faculty_stats_endpoint,
            self.test_admin_course_stats_endpoint
        ]
        
        passed = 0
        failed = 0
        
        for test in tests:
            try:
                if test():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ EXCEPTION in {test.__name__}: {str(e)}")
                failed += 1
            
            # Small delay between tests
            time.sleep(0.5)
        
        print("=" * 80)
        print(f"🏁 Test Results: {passed} passed, {failed} failed")
        print(f"📊 Success Rate: {(passed / (passed + failed) * 100):.1f}%")
        
        if failed > 0:
            print("\n❌ Failed Tests:")
            for result in self.test_results:
                if not result['success']:
                    print(f"   - {result['test']}: {result['message']}")
        
        return failed == 0

def main():
    """Main test runner"""
    tester = AdminEndpointTester()
    success = tester.run_admin_tests()
    
    # Print summary
    print("\n" + "=" * 80)
    print("📋 DETAILED ADMIN TEST SUMMARY")
    print("=" * 80)
    
    for result in tester.test_results:
        status = "✅" if result['success'] else "❌"
        print(f"{status} {result['test']}: {result['message']}")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())