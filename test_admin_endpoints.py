#!/usr/bin/env python3
"""
Comprehensive Admin Endpoints Testing for RUDN Schedule API
Tests all 8 admin endpoints as requested by the user
"""

import requests
import json
import sys
from typing import Dict, List, Optional

# Configuration - Backend works on localhost:8001
BACKEND_URL = "http://localhost:8001/api"
TIMEOUT = 30

class AdminEndpointsTester:
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
        """Test GET /api/admin/stats endpoint with different parameters"""
        try:
            print("🔍 Testing GET /api/admin/stats...")
            
            # Test 1: No parameters (all time)
            response = self.session.get(f"{self.base_url}/admin/stats")
            
            if response.status_code != 200:
                self.log_test("GET /api/admin/stats (no params)", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            stats_all = response.json()
            
            # Validate response structure
            required_fields = [
                'total_users', 'active_users_today', 'active_users_week', 'active_users_month',
                'new_users_today', 'new_users_week', 'new_users_month',
                'total_tasks', 'total_completed_tasks', 'total_achievements_earned',
                'total_rooms', 'total_schedule_views'
            ]
            
            for field in required_fields:
                if field not in stats_all:
                    self.log_test("GET /api/admin/stats (no params)", False, 
                                f"Missing required field: {field}")
                    return False
                
                if not isinstance(stats_all[field], int):
                    self.log_test("GET /api/admin/stats (no params)", False, 
                                f"Field {field} should be integer, got {type(stats_all[field])}")
                    return False
            
            # Test 2: With days=7
            response_7 = self.session.get(f"{self.base_url}/admin/stats?days=7")
            
            if response_7.status_code != 200:
                self.log_test("GET /api/admin/stats (days=7)", False, 
                            f"HTTP {response_7.status_code}: {response_7.text}")
                return False
            
            stats_7 = response_7.json()
            
            # Validate same structure
            for field in required_fields:
                if field not in stats_7:
                    self.log_test("GET /api/admin/stats (days=7)", False, 
                                f"Missing required field: {field}")
                    return False
            
            # Test 3: With days=30
            response_30 = self.session.get(f"{self.base_url}/admin/stats?days=30")
            
            if response_30.status_code != 200:
                self.log_test("GET /api/admin/stats (days=30)", False, 
                            f"HTTP {response_30.status_code}: {response_30.text}")
                return False
            
            stats_30 = response_30.json()
            
            # Validate same structure
            for field in required_fields:
                if field not in stats_30:
                    self.log_test("GET /api/admin/stats (days=30)", False, 
                                f"Missing required field: {field}")
                    return False
            
            self.log_test("GET /api/admin/stats", True, 
                        "Successfully tested admin stats endpoint with all parameter variations",
                        {
                            "all_time_total_users": stats_all['total_users'],
                            "7_days_total_tasks": stats_7['total_tasks'],
                            "30_days_total_schedule_views": stats_30['total_schedule_views'],
                            "all_parameters_tested": True
                        })
            return True
            
        except Exception as e:
            self.log_test("GET /api/admin/stats", False, f"Exception: {str(e)}")
            return False

    def test_admin_users_activity_endpoint(self) -> bool:
        """Test GET /api/admin/users-activity endpoint with different days values"""
        try:
            print("🔍 Testing GET /api/admin/users-activity...")
            
            # Test with different days values
            days_values = [7, 30, None]  # None means all time
            
            for days in days_values:
                if days is None:
                    url = f"{self.base_url}/admin/users-activity"
                    test_name = "all time"
                else:
                    url = f"{self.base_url}/admin/users-activity?days={days}"
                    test_name = f"days={days}"
                
                response = self.session.get(url)
                
                if response.status_code != 200:
                    self.log_test(f"GET /api/admin/users-activity ({test_name})", False, 
                                f"HTTP {response.status_code}: {response.text}")
                    return False
                
                activity_data = response.json()
                
                # Validate response structure
                if not isinstance(activity_data, list):
                    self.log_test(f"GET /api/admin/users-activity ({test_name})", False, 
                                "Response is not a list")
                    return False
                
                # Validate each activity point
                for point in activity_data:
                    if not isinstance(point, dict):
                        self.log_test(f"GET /api/admin/users-activity ({test_name})", False, 
                                    "Activity point is not a dictionary")
                        return False
                    
                    required_fields = ['date', 'count']
                    for field in required_fields:
                        if field not in point:
                            self.log_test(f"GET /api/admin/users-activity ({test_name})", False, 
                                        f"Activity point missing required field: {field}")
                            return False
                    
                    # Validate date format (YYYY-MM-DD)
                    if not isinstance(point['date'], str) or len(point['date']) != 10:
                        self.log_test(f"GET /api/admin/users-activity ({test_name})", False, 
                                    f"Invalid date format: {point['date']}")
                        return False
                    
                    # Validate count is integer
                    if not isinstance(point['count'], int):
                        self.log_test(f"GET /api/admin/users-activity ({test_name})", False, 
                                    f"Count should be integer, got {type(point['count'])}")
                        return False
            
            self.log_test("GET /api/admin/users-activity", True, 
                        "Successfully tested users activity endpoint with different days values",
                        {
                            "tested_days_values": days_values,
                            "all_responses_valid": True
                        })
            return True
            
        except Exception as e:
            self.log_test("GET /api/admin/users-activity", False, f"Exception: {str(e)}")
            return False

    def test_admin_hourly_activity_endpoint(self) -> bool:
        """Test GET /api/admin/hourly-activity endpoint - check all 24 hours (0-23)"""
        try:
            print("🔍 Testing GET /api/admin/hourly-activity...")
            
            response = self.session.get(f"{self.base_url}/admin/hourly-activity")
            
            if response.status_code != 200:
                self.log_test("GET /api/admin/hourly-activity", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            hourly_data = response.json()
            
            # Validate response structure
            if not isinstance(hourly_data, list):
                self.log_test("GET /api/admin/hourly-activity", False, 
                            "Response is not a list")
                return False
            
            # Should return exactly 24 hours (0-23)
            if len(hourly_data) != 24:
                self.log_test("GET /api/admin/hourly-activity", False, 
                            f"Expected 24 hours, got {len(hourly_data)}")
                return False
            
            # Validate each hour
            hours_present = set()
            for hour_data in hourly_data:
                if not isinstance(hour_data, dict):
                    self.log_test("GET /api/admin/hourly-activity", False, 
                                "Hour data is not a dictionary")
                    return False
                
                required_fields = ['hour', 'count']
                for field in required_fields:
                    if field not in hour_data:
                        self.log_test("GET /api/admin/hourly-activity", False, 
                                    f"Hour data missing required field: {field}")
                        return False
                
                # Validate hour is in range 0-23
                hour = hour_data['hour']
                if not isinstance(hour, int) or hour < 0 or hour > 23:
                    self.log_test("GET /api/admin/hourly-activity", False, 
                                f"Invalid hour value: {hour}")
                    return False
                
                hours_present.add(hour)
                
                # Validate count is integer
                if not isinstance(hour_data['count'], int):
                    self.log_test("GET /api/admin/hourly-activity", False, 
                                f"Count should be integer, got {type(hour_data['count'])}")
                    return False
            
            # Check all hours 0-23 are present
            expected_hours = set(range(24))
            if hours_present != expected_hours:
                missing_hours = expected_hours - hours_present
                self.log_test("GET /api/admin/hourly-activity", False, 
                            f"Missing hours: {sorted(missing_hours)}")
                return False
            
            self.log_test("GET /api/admin/hourly-activity", True, 
                        "Successfully verified all 24 hours (0-23) are present",
                        {
                            "total_hours": len(hourly_data),
                            "hours_range": f"0-{max(h['hour'] for h in hourly_data)}",
                            "all_hours_present": True
                        })
            return True
            
        except Exception as e:
            self.log_test("GET /api/admin/hourly-activity", False, f"Exception: {str(e)}")
            return False

    def test_admin_weekly_activity_endpoint(self) -> bool:
        """Test GET /api/admin/weekly-activity endpoint - check all 7 days in Russian"""
        try:
            print("🔍 Testing GET /api/admin/weekly-activity...")
            
            response = self.session.get(f"{self.base_url}/admin/weekly-activity")
            
            if response.status_code != 200:
                self.log_test("GET /api/admin/weekly-activity", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            weekly_data = response.json()
            
            # Validate response structure
            if not isinstance(weekly_data, list):
                self.log_test("GET /api/admin/weekly-activity", False, 
                            "Response is not a list")
                return False
            
            # Should return exactly 7 days
            if len(weekly_data) != 7:
                self.log_test("GET /api/admin/weekly-activity", False, 
                            f"Expected 7 days, got {len(weekly_data)}")
                return False
            
            # Expected Russian day names
            expected_days = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]
            days_present = []
            
            # Validate each day
            for day_data in weekly_data:
                if not isinstance(day_data, dict):
                    self.log_test("GET /api/admin/weekly-activity", False, 
                                "Day data is not a dictionary")
                    return False
                
                required_fields = ['day', 'count']
                for field in required_fields:
                    if field not in day_data:
                        self.log_test("GET /api/admin/weekly-activity", False, 
                                    f"Day data missing required field: {field}")
                        return False
                
                # Validate day name is in Russian
                day = day_data['day']
                if not isinstance(day, str):
                    self.log_test("GET /api/admin/weekly-activity", False, 
                                f"Day should be string, got {type(day)}")
                    return False
                
                days_present.append(day)
                
                # Validate count is integer
                if not isinstance(day_data['count'], int):
                    self.log_test("GET /api/admin/weekly-activity", False, 
                                f"Count should be integer, got {type(day_data['count'])}")
                    return False
            
            # Check all expected Russian days are present
            if set(days_present) != set(expected_days):
                missing_days = set(expected_days) - set(days_present)
                extra_days = set(days_present) - set(expected_days)
                self.log_test("GET /api/admin/weekly-activity", False, 
                            f"Day names mismatch. Missing: {missing_days}, Extra: {extra_days}")
                return False
            
            self.log_test("GET /api/admin/weekly-activity", True, 
                        "Successfully verified all 7 days in Russian",
                        {
                            "total_days": len(weekly_data),
                            "days_present": days_present,
                            "expected_days": expected_days,
                            "all_russian_days_present": True
                        })
            return True
            
        except Exception as e:
            self.log_test("GET /api/admin/weekly-activity", False, f"Exception: {str(e)}")
            return False

    def test_admin_feature_usage_endpoint(self) -> bool:
        """Test GET /api/admin/feature-usage endpoint - test all metrics"""
        try:
            print("🔍 Testing GET /api/admin/feature-usage...")
            
            response = self.session.get(f"{self.base_url}/admin/feature-usage")
            
            if response.status_code != 200:
                self.log_test("GET /api/admin/feature-usage", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            feature_data = response.json()
            
            # Validate response structure
            if not isinstance(feature_data, dict):
                self.log_test("GET /api/admin/feature-usage", False, 
                            "Response is not a dictionary")
                return False
            
            # Expected metrics
            expected_metrics = [
                'schedule_views', 'analytics_views', 'calendar_opens',
                'notifications_configured', 'schedule_shares', 'tasks_created',
                'achievements_earned'
            ]
            
            # Validate all metrics are present
            for metric in expected_metrics:
                if metric not in feature_data:
                    self.log_test("GET /api/admin/feature-usage", False, 
                                f"Missing required metric: {metric}")
                    return False
                
                # Validate metric value is integer
                if not isinstance(feature_data[metric], int):
                    self.log_test("GET /api/admin/feature-usage", False, 
                                f"Metric {metric} should be integer, got {type(feature_data[metric])}")
                    return False
                
                # Validate metric value is non-negative
                if feature_data[metric] < 0:
                    self.log_test("GET /api/admin/feature-usage", False, 
                                f"Metric {metric} should be non-negative, got {feature_data[metric]}")
                    return False
            
            # Test with days parameter
            response_filtered = self.session.get(f"{self.base_url}/admin/feature-usage?days=7")
            
            if response_filtered.status_code != 200:
                self.log_test("GET /api/admin/feature-usage (days=7)", False, 
                            f"HTTP {response_filtered.status_code}: {response_filtered.text}")
                return False
            
            feature_data_filtered = response_filtered.json()
            
            # Validate same structure for filtered data
            for metric in expected_metrics:
                if metric not in feature_data_filtered:
                    self.log_test("GET /api/admin/feature-usage (days=7)", False, 
                                f"Missing required metric in filtered data: {metric}")
                    return False
            
            self.log_test("GET /api/admin/feature-usage", True, 
                        "Successfully tested all feature usage metrics",
                        {
                            "metrics_tested": expected_metrics,
                            "all_time_schedule_views": feature_data['schedule_views'],
                            "all_time_tasks_created": feature_data['tasks_created'],
                            "filtered_data_valid": True,
                            "all_metrics_present": True
                        })
            return True
            
        except Exception as e:
            self.log_test("GET /api/admin/feature-usage", False, f"Exception: {str(e)}")
            return False

    def test_admin_top_users_endpoint(self) -> bool:
        """Test GET /api/admin/top-users endpoint with different metrics and limits"""
        try:
            print("🔍 Testing GET /api/admin/top-users...")
            
            # Test different metrics
            metrics = ['points', 'achievements', 'activity']
            limits = [5, 10, 15]
            
            for metric in metrics:
                for limit in limits:
                    url = f"{self.base_url}/admin/top-users?metric={metric}&limit={limit}"
                    response = self.session.get(url)
                    
                    if response.status_code != 200:
                        self.log_test(f"GET /api/admin/top-users (metric={metric}, limit={limit})", False, 
                                    f"HTTP {response.status_code}: {response.text}")
                        return False
                    
                    top_users = response.json()
                    
                    # Validate response structure
                    if not isinstance(top_users, list):
                        self.log_test(f"GET /api/admin/top-users (metric={metric})", False, 
                                    "Response is not a list")
                        return False
                    
                    # Should not exceed the limit
                    if len(top_users) > limit:
                        self.log_test(f"GET /api/admin/top-users (limit={limit})", False, 
                                    f"Response exceeds limit: got {len(top_users)}, expected max {limit}")
                        return False
                    
                    # Validate each user
                    for user in top_users:
                        if not isinstance(user, dict):
                            self.log_test(f"GET /api/admin/top-users (metric={metric})", False, 
                                        "User data is not a dictionary")
                            return False
                        
                        required_fields = ['telegram_id', 'username', 'first_name', 'value', 'group_name']
                        for field in required_fields:
                            if field not in user:
                                self.log_test(f"GET /api/admin/top-users (metric={metric})", False, 
                                            f"User missing required field: {field}")
                                return False
                        
                        # Validate telegram_id is integer
                        if not isinstance(user['telegram_id'], int):
                            self.log_test(f"GET /api/admin/top-users (metric={metric})", False, 
                                        f"telegram_id should be integer, got {type(user['telegram_id'])}")
                            return False
                        
                        # Validate value is integer
                        if not isinstance(user['value'], int):
                            self.log_test(f"GET /api/admin/top-users (metric={metric})", False, 
                                        f"value should be integer, got {type(user['value'])}")
                            return False
            
            # Test default parameters
            response_default = self.session.get(f"{self.base_url}/admin/top-users")
            
            if response_default.status_code != 200:
                self.log_test("GET /api/admin/top-users (default)", False, 
                            f"HTTP {response_default.status_code}: {response_default.text}")
                return False
            
            default_users = response_default.json()
            
            # Should default to limit=10
            if len(default_users) > 10:
                self.log_test("GET /api/admin/top-users (default)", False, 
                            f"Default limit exceeded: got {len(default_users)}")
                return False
            
            self.log_test("GET /api/admin/top-users", True, 
                        "Successfully tested top users endpoint with all metrics and limits",
                        {
                            "metrics_tested": metrics,
                            "limits_tested": limits,
                            "default_response_valid": True,
                            "all_combinations_tested": len(metrics) * len(limits)
                        })
            return True
            
        except Exception as e:
            self.log_test("GET /api/admin/top-users", False, f"Exception: {str(e)}")
            return False

    def test_admin_faculty_stats_endpoint(self) -> bool:
        """Test GET /api/admin/faculty-stats endpoint - check data structure"""
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
                            "Response is not a list")
                return False
            
            # Validate each faculty stat
            for faculty in faculty_stats:
                if not isinstance(faculty, dict):
                    self.log_test("GET /api/admin/faculty-stats", False, 
                                "Faculty data is not a dictionary")
                    return False
                
                required_fields = ['faculty_name', 'faculty_id', 'users_count']
                for field in required_fields:
                    if field not in faculty:
                        self.log_test("GET /api/admin/faculty-stats", False, 
                                    f"Faculty missing required field: {field}")
                        return False
                
                # Validate faculty_name is string
                if not isinstance(faculty['faculty_name'], str):
                    self.log_test("GET /api/admin/faculty-stats", False, 
                                f"faculty_name should be string, got {type(faculty['faculty_name'])}")
                    return False
                
                # Validate faculty_id is string (can be None but if present should be string)
                if faculty['faculty_id'] is not None and not isinstance(faculty['faculty_id'], str):
                    self.log_test("GET /api/admin/faculty-stats", False, 
                                f"faculty_id should be string or None, got {type(faculty['faculty_id'])}")
                    return False
                
                # Validate users_count is integer
                if not isinstance(faculty['users_count'], int):
                    self.log_test("GET /api/admin/faculty-stats", False, 
                                f"users_count should be integer, got {type(faculty['users_count'])}")
                    return False
                
                # Validate users_count is positive
                if faculty['users_count'] <= 0:
                    self.log_test("GET /api/admin/faculty-stats", False, 
                                f"users_count should be positive, got {faculty['users_count']}")
                    return False
            
            # Check that data is sorted by count (descending)
            if len(faculty_stats) > 1:
                for i in range(len(faculty_stats) - 1):
                    if faculty_stats[i]['users_count'] < faculty_stats[i + 1]['users_count']:
                        self.log_test("GET /api/admin/faculty-stats", False, 
                                    "Faculty stats not sorted by users_count in descending order")
                        return False
            
            self.log_test("GET /api/admin/faculty-stats", True, 
                        "Successfully validated faculty stats data structure",
                        {
                            "total_faculties": len(faculty_stats),
                            "sample_faculty": faculty_stats[0] if faculty_stats else None,
                            "data_structure_valid": True,
                            "sorted_by_count": True
                        })
            return True
            
        except Exception as e:
            self.log_test("GET /api/admin/faculty-stats", False, f"Exception: {str(e)}")
            return False

    def test_admin_course_stats_endpoint(self) -> bool:
        """Test GET /api/admin/course-stats endpoint - check data structure"""
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
                            "Response is not a list")
                return False
            
            # Validate each course stat
            for course in course_stats:
                if not isinstance(course, dict):
                    self.log_test("GET /api/admin/course-stats", False, 
                                "Course data is not a dictionary")
                    return False
                
                required_fields = ['course', 'users_count']
                for field in required_fields:
                    if field not in course:
                        self.log_test("GET /api/admin/course-stats", False, 
                                    f"Course missing required field: {field}")
                        return False
                
                # Validate course is string (can be None but if present should be string)
                if course['course'] is not None and not isinstance(course['course'], str):
                    self.log_test("GET /api/admin/course-stats", False, 
                                f"course should be string or None, got {type(course['course'])}")
                    return False
                
                # Validate users_count is integer
                if not isinstance(course['users_count'], int):
                    self.log_test("GET /api/admin/course-stats", False, 
                                f"users_count should be integer, got {type(course['users_count'])}")
                    return False
                
                # Validate users_count is positive
                if course['users_count'] <= 0:
                    self.log_test("GET /api/admin/course-stats", False, 
                                f"users_count should be positive, got {course['users_count']}")
                    return False
            
            # Check that data is sorted by course (ascending)
            if len(course_stats) > 1:
                course_values = [c['course'] for c in course_stats if c['course'] is not None]
                if course_values != sorted(course_values):
                    self.log_test("GET /api/admin/course-stats", False, 
                                "Course stats not sorted by course in ascending order")
                    return False
            
            self.log_test("GET /api/admin/course-stats", True, 
                        "Successfully validated course stats data structure",
                        {
                            "total_courses": len(course_stats),
                            "sample_course": course_stats[0] if course_stats else None,
                            "data_structure_valid": True,
                            "sorted_by_course": True
                        })
            return True
            
        except Exception as e:
            self.log_test("GET /api/admin/course-stats", False, f"Exception: {str(e)}")
            return False

    def run_admin_tests(self) -> bool:
        """Run all admin endpoint tests"""
        print("🚀 Starting Comprehensive Admin Endpoints Testing")
        print(f"🌐 Backend URL: {self.base_url}")
        print("=" * 80)
        
        # All 8 admin endpoint tests as requested
        admin_tests = [
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
        total = len(admin_tests)
        
        for test in admin_tests:
            try:
                if test():
                    passed += 1
            except Exception as e:
                print(f"❌ Test failed with exception: {e}")
        
        print("=" * 80)
        print(f"📊 Admin Endpoints Test Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All admin endpoint tests passed! Admin panel is working correctly.")
            return True
        else:
            print("⚠️  Some admin endpoint tests failed. Check the details above.")
            return False

def main():
    """Main test runner for admin endpoints"""
    tester = AdminEndpointsTester()
    success = tester.run_admin_tests()
    
    # Print detailed summary
    print("\n" + "=" * 80)
    print("📋 DETAILED ADMIN ENDPOINTS TEST SUMMARY")
    print("=" * 80)
    
    for result in tester.test_results:
        status = "✅" if result['success'] else "❌"
        print(f"{status} {result['test']}: {result['message']}")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())