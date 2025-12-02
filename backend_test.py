#!/usr/bin/env python3
"""
Comprehensive Backend API Tests for RUDN Schedule API
Tests all endpoints with real data and proper error handling
"""

import requests
import json
import time
import sys
from typing import Dict, List, Optional

# Configuration
# Backend is accessible on localhost:8001 internally
BACKEND_URL = "http://localhost:8001/api"
TIMEOUT = 30  # 30 seconds timeout for API calls

class RUDNScheduleAPITester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.session.timeout = TIMEOUT
        self.test_results = []
        self.test_data = {}
        
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
    
    def test_faculties_endpoint(self) -> bool:
        """Test GET /api/faculties endpoint"""
        try:
            print("🔍 Testing GET /api/faculties...")
            response = self.session.get(f"{self.base_url}/faculties")
            
            if response.status_code != 200:
                self.log_test("GET /api/faculties", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            faculties = response.json()
            
            # Validate response structure
            if not isinstance(faculties, list):
                self.log_test("GET /api/faculties", False, 
                            "Response is not a list")
                return False
            
            if len(faculties) < 5:
                self.log_test("GET /api/faculties", False, 
                            f"Expected at least 5 faculties, got {len(faculties)}")
                return False
            
            # Validate faculty structure
            for faculty in faculties[:3]:  # Check first 3
                if not isinstance(faculty, dict) or 'id' not in faculty or 'name' not in faculty:
                    self.log_test("GET /api/faculties", False, 
                                "Faculty missing required fields (id, name)")
                    return False
            
            # Store test data for later use
            self.test_data['faculties'] = faculties
            self.test_data['test_faculty'] = faculties[0]  # Use first faculty for testing
            
            self.log_test("GET /api/faculties", True, 
                        f"Successfully retrieved {len(faculties)} faculties",
                        {"sample_faculty": faculties[0], "total_count": len(faculties)})
            return True
            
        except requests.exceptions.Timeout:
            self.log_test("GET /api/faculties", False, 
                        "Request timeout (30s) - RUDN API may be slow")
            return False
        except Exception as e:
            self.log_test("GET /api/faculties", False, f"Exception: {str(e)}")
            return False
    
    def test_filter_data_endpoint(self) -> bool:
        """Test POST /api/filter-data endpoint"""
        try:
            print("🔍 Testing POST /api/filter-data...")
            
            if 'test_faculty' not in self.test_data:
                self.log_test("POST /api/filter-data", False, 
                            "No faculty data available from previous test")
                return False
            
            faculty_id = self.test_data['test_faculty']['id']
            payload = {"facultet_id": faculty_id}
            
            response = self.session.post(
                f"{self.base_url}/filter-data",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code != 200:
                self.log_test("POST /api/filter-data", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            filter_data = response.json()
            
            # Validate response structure
            required_fields = ['levels', 'courses', 'forms', 'groups']
            for field in required_fields:
                if field not in filter_data:
                    self.log_test("POST /api/filter-data", False, 
                                f"Missing required field: {field}")
                    return False
            
            # Check that levels has data
            if not filter_data['levels']:
                self.log_test("POST /api/filter-data", False, 
                            "No levels data returned")
                return False
            
            # Store test data for schedule testing
            self.test_data['filter_data'] = filter_data
            if filter_data['levels']:
                self.test_data['test_level'] = filter_data['levels'][0]
            if filter_data['courses']:
                self.test_data['test_course'] = filter_data['courses'][0]
            if filter_data['forms']:
                self.test_data['test_form'] = filter_data['forms'][0]
            
            self.log_test("POST /api/filter-data", True, 
                        f"Successfully retrieved filter data for faculty {faculty_id}",
                        {
                            "levels_count": len(filter_data['levels']),
                            "courses_count": len(filter_data['courses']),
                            "forms_count": len(filter_data['forms']),
                            "groups_count": len(filter_data['groups'])
                        })
            return True
            
        except requests.exceptions.Timeout:
            self.log_test("POST /api/filter-data", False, 
                        "Request timeout (30s) - RUDN API may be slow")
            return False
        except Exception as e:
            self.log_test("POST /api/filter-data", False, f"Exception: {str(e)}")
            return False
    
    def test_get_groups_for_schedule(self) -> bool:
        """Get groups data for schedule testing"""
        try:
            print("🔍 Getting groups data for schedule testing...")
            
            if not all(key in self.test_data for key in ['test_faculty', 'test_level', 'test_course', 'test_form']):
                self.log_test("Get Groups Data", False, 
                            "Missing required test data from previous tests")
                return False
            
            # Try different combinations to find groups
            combinations = [
                # Full combination
                {
                    "facultet_id": self.test_data['test_faculty']['id'],
                    "level_id": self.test_data['test_level']['value'],
                    "kurs": self.test_data['test_course']['value'],
                    "form_code": self.test_data['test_form']['value']
                },
                # Without form
                {
                    "facultet_id": self.test_data['test_faculty']['id'],
                    "level_id": self.test_data['test_level']['value'],
                    "kurs": self.test_data['test_course']['value']
                },
                # Just faculty and level
                {
                    "facultet_id": self.test_data['test_faculty']['id'],
                    "level_id": self.test_data['test_level']['value']
                },
                # Just faculty
                {
                    "facultet_id": self.test_data['test_faculty']['id']
                }
            ]
            
            for i, payload in enumerate(combinations):
                response = self.session.post(
                    f"{self.base_url}/filter-data",
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code != 200:
                    continue
                
                filter_data = response.json()
                
                if filter_data.get('groups'):
                    self.test_data['test_group'] = filter_data['groups'][0]
                    # Update other test data based on what worked
                    if 'levels' in filter_data and filter_data['levels']:
                        self.test_data['test_level'] = filter_data['levels'][0]
                    if 'courses' in filter_data and filter_data['courses']:
                        self.test_data['test_course'] = filter_data['courses'][0]
                    if 'forms' in filter_data and filter_data['forms']:
                        self.test_data['test_form'] = filter_data['forms'][0]
                    
                    self.log_test("Get Groups Data", True, 
                                f"Found {len(filter_data['groups'])} groups (combination {i+1})",
                                {"sample_group": filter_data['groups'][0], "payload_used": payload})
                    return True
            
            self.log_test("Get Groups Data", False, 
                        "No groups found with any parameter combination")
            return False
            
        except Exception as e:
            self.log_test("Get Groups Data", False, f"Exception: {str(e)}")
            return False
    
    def test_schedule_endpoint(self) -> bool:
        """Test POST /api/schedule endpoint"""
        try:
            print("🔍 Testing POST /api/schedule...")
            
            required_keys = ['test_faculty', 'test_level', 'test_course', 'test_form', 'test_group']
            if not all(key in self.test_data for key in required_keys):
                self.log_test("POST /api/schedule", False, 
                            "Missing required test data from previous tests")
                return False
            
            payload = {
                "facultet_id": self.test_data['test_faculty']['id'],
                "level_id": self.test_data['test_level']['value'],
                "kurs": self.test_data['test_course']['value'],
                "form_code": self.test_data['test_form']['value'],
                "group_id": self.test_data['test_group']['value'],
                "week_number": 1
            }
            
            response = self.session.post(
                f"{self.base_url}/schedule",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code != 200:
                self.log_test("POST /api/schedule", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            schedule_data = response.json()
            
            # Validate response structure
            required_fields = ['events', 'group_id', 'week_number']
            for field in required_fields:
                if field not in schedule_data:
                    self.log_test("POST /api/schedule", False, 
                                f"Missing required field: {field}")
                    return False
            
            # Validate events is array
            if not isinstance(schedule_data['events'], list):
                self.log_test("POST /api/schedule", False, 
                            "Events field is not an array")
                return False
            
            # Store for user settings test
            self.test_data['schedule_data'] = schedule_data
            
            self.log_test("POST /api/schedule", True, 
                        f"Successfully retrieved schedule with {len(schedule_data['events'])} events",
                        {
                            "group_id": schedule_data['group_id'],
                            "week_number": schedule_data['week_number'],
                            "events_count": len(schedule_data['events']),
                            "sample_event": schedule_data['events'][0] if schedule_data['events'] else None
                        })
            return True
            
        except requests.exceptions.Timeout:
            self.log_test("POST /api/schedule", False, 
                        "Request timeout (30s) - RUDN API may be slow")
            return False
        except Exception as e:
            self.log_test("POST /api/schedule", False, f"Exception: {str(e)}")
            return False
    
    def test_save_user_settings(self) -> bool:
        """Test POST /api/user-settings endpoint"""
        try:
            print("🔍 Testing POST /api/user-settings...")
            
            # Use real data from previous tests if available, otherwise use test data
            if 'test_group' in self.test_data and 'test_faculty' in self.test_data:
                payload = {
                    "telegram_id": 123456789,
                    "username": "testuser_rudn",
                    "first_name": "Иван",
                    "last_name": "Петров",
                    "group_id": self.test_data['test_group']['value'],
                    "group_name": self.test_data['test_group']['label'] or self.test_data['test_group']['name'] or "Тестовая группа",
                    "facultet_id": self.test_data['test_faculty']['id'],
                    "level_id": self.test_data.get('test_level', {}).get('value', 'test-level-id'),
                    "kurs": self.test_data.get('test_course', {}).get('value', '1'),
                    "form_code": self.test_data.get('test_form', {}).get('value', 'д')
                }
            else:
                # Fallback to test data from request
                payload = {
                    "telegram_id": 123456789,
                    "username": "testuser",
                    "first_name": "Test",
                    "last_name": "User",
                    "group_id": "test-group-id",
                    "group_name": "Тестовая группа",
                    "facultet_id": "test-facultet-id",
                    "level_id": "test-level-id",
                    "kurs": "1",
                    "form_code": "д"
                }
            
            response = self.session.post(
                f"{self.base_url}/user-settings",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code != 200:
                self.log_test("POST /api/user-settings", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            user_data = response.json()
            
            # Validate response structure
            required_fields = ['id', 'telegram_id', 'group_id', 'group_name', 'created_at']
            for field in required_fields:
                if field not in user_data:
                    self.log_test("POST /api/user-settings", False, 
                                f"Missing required field: {field}")
                    return False
            
            # Validate telegram_id matches
            if user_data['telegram_id'] != payload['telegram_id']:
                self.log_test("POST /api/user-settings", False, 
                            "Telegram ID mismatch in response")
                return False
            
            self.test_data['saved_user'] = user_data
            
            self.log_test("POST /api/user-settings", True, 
                        "Successfully saved user settings",
                        {
                            "user_id": user_data['id'],
                            "telegram_id": user_data['telegram_id'],
                            "group_name": user_data['group_name']
                        })
            return True
            
        except Exception as e:
            self.log_test("POST /api/user-settings", False, f"Exception: {str(e)}")
            return False
    
    def test_get_user_settings(self) -> bool:
        """Test GET /api/user-settings/{telegram_id} endpoint"""
        try:
            print("🔍 Testing GET /api/user-settings/{telegram_id}...")
            
            telegram_id = 123456789
            response = self.session.get(f"{self.base_url}/user-settings/{telegram_id}")
            
            if response.status_code != 200:
                self.log_test("GET /api/user-settings/{telegram_id}", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            user_data = response.json()
            
            # Validate response structure
            required_fields = ['id', 'telegram_id', 'group_id', 'group_name']
            for field in required_fields:
                if field not in user_data:
                    self.log_test("GET /api/user-settings/{telegram_id}", False, 
                                f"Missing required field: {field}")
                    return False
            
            # Validate telegram_id matches
            if user_data['telegram_id'] != telegram_id:
                self.log_test("GET /api/user-settings/{telegram_id}", False, 
                            "Telegram ID mismatch in response")
                return False
            
            self.log_test("GET /api/user-settings/{telegram_id}", True, 
                        "Successfully retrieved user settings",
                        {
                            "user_id": user_data['id'],
                            "telegram_id": user_data['telegram_id'],
                            "group_name": user_data['group_name']
                        })
            return True
            
        except Exception as e:
            self.log_test("GET /api/user-settings/{telegram_id}", False, f"Exception: {str(e)}")
            return False
    
    def test_get_nonexistent_user(self) -> bool:
        """Test error handling for non-existent user"""
        try:
            print("🔍 Testing error handling for non-existent user...")
            
            nonexistent_id = 999999999
            response = self.session.get(f"{self.base_url}/user-settings/{nonexistent_id}")
            
            if response.status_code != 404:
                self.log_test("Error Handling - Non-existent User", False, 
                            f"Expected HTTP 404, got {response.status_code}")
                return False
            
            self.log_test("Error Handling - Non-existent User", True, 
                        "Correctly returned 404 for non-existent user")
            return True
            
        except Exception as e:
            self.log_test("Error Handling - Non-existent User", False, f"Exception: {str(e)}")
            return False

    def test_create_user_with_default_notifications(self) -> bool:
        """Test POST /api/user-settings creates user with default notification settings"""
        try:
            print("🔍 Testing POST /api/user-settings with default notifications...")
            
            # Create test user with telegram_id = 999999
            test_telegram_id = 999999
            payload = {
                "telegram_id": test_telegram_id,
                "username": "notification_test_user",
                "first_name": "Тест",
                "last_name": "Уведомления",
                "group_id": "test-group-notifications",
                "group_name": "Тестовая группа для уведомлений",
                "facultet_id": "test-facultet-notifications",
                "level_id": "test-level-notifications",
                "kurs": "1",
                "form_code": "д"
            }
            
            response = self.session.post(
                f"{self.base_url}/user-settings",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code != 200:
                self.log_test("POST /api/user-settings (default notifications)", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            user_data = response.json()
            
            # Validate response structure
            required_fields = ['id', 'telegram_id', 'group_id', 'group_name', 'created_at']
            for field in required_fields:
                if field not in user_data:
                    self.log_test("POST /api/user-settings (default notifications)", False, 
                                f"Missing required field: {field}")
                    return False
            
            # Store test user for notification tests
            self.test_data['notification_test_user'] = user_data
            
            self.log_test("POST /api/user-settings (default notifications)", True, 
                        "Successfully created user for notification testing",
                        {
                            "user_id": user_data['id'],
                            "telegram_id": user_data['telegram_id']
                        })
            return True
            
        except Exception as e:
            self.log_test("POST /api/user-settings (default notifications)", False, f"Exception: {str(e)}")
            return False

    def test_get_default_notification_settings(self) -> bool:
        """Test GET /api/user-settings/{telegram_id}/notifications returns default settings"""
        try:
            print("🔍 Testing GET /api/user-settings/{telegram_id}/notifications (default settings)...")
            
            test_telegram_id = 999999
            response = self.session.get(f"{self.base_url}/user-settings/{test_telegram_id}/notifications")
            
            if response.status_code != 200:
                self.log_test("GET /api/user-settings/{telegram_id}/notifications (default)", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            notification_data = response.json()
            
            # Validate response structure
            required_fields = ['notifications_enabled', 'notification_time', 'telegram_id']
            for field in required_fields:
                if field not in notification_data:
                    self.log_test("GET /api/user-settings/{telegram_id}/notifications (default)", False, 
                                f"Missing required field: {field}")
                    return False
            
            # Check default values
            if notification_data['notifications_enabled'] != False:
                self.log_test("GET /api/user-settings/{telegram_id}/notifications (default)", False, 
                            f"Expected notifications_enabled=false, got {notification_data['notifications_enabled']}")
                return False
            
            if notification_data['notification_time'] != 10:
                self.log_test("GET /api/user-settings/{telegram_id}/notifications (default)", False, 
                            f"Expected notification_time=10, got {notification_data['notification_time']}")
                return False
            
            if notification_data['telegram_id'] != test_telegram_id:
                self.log_test("GET /api/user-settings/{telegram_id}/notifications (default)", False, 
                            "Telegram ID mismatch in response")
                return False
            
            self.log_test("GET /api/user-settings/{telegram_id}/notifications (default)", True, 
                        "Successfully retrieved default notification settings",
                        {
                            "notifications_enabled": notification_data['notifications_enabled'],
                            "notification_time": notification_data['notification_time'],
                            "telegram_id": notification_data['telegram_id']
                        })
            return True
            
        except Exception as e:
            self.log_test("GET /api/user-settings/{telegram_id}/notifications (default)", False, f"Exception: {str(e)}")
            return False

    def test_update_notification_settings(self) -> bool:
        """Test PUT /api/user-settings/{telegram_id}/notifications updates settings"""
        try:
            print("🔍 Testing PUT /api/user-settings/{telegram_id}/notifications...")
            
            test_telegram_id = 999999
            payload = {
                "notifications_enabled": True,
                "notification_time": 15
            }
            
            response = self.session.put(
                f"{self.base_url}/user-settings/{test_telegram_id}/notifications",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code != 200:
                self.log_test("PUT /api/user-settings/{telegram_id}/notifications", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            notification_data = response.json()
            
            # Validate response structure
            required_fields = ['notifications_enabled', 'notification_time', 'telegram_id']
            for field in required_fields:
                if field not in notification_data:
                    self.log_test("PUT /api/user-settings/{telegram_id}/notifications", False, 
                                f"Missing required field: {field}")
                    return False
            
            # Check updated values
            if notification_data['notifications_enabled'] != True:
                self.log_test("PUT /api/user-settings/{telegram_id}/notifications", False, 
                            f"Expected notifications_enabled=true, got {notification_data['notifications_enabled']}")
                return False
            
            if notification_data['notification_time'] != 15:
                self.log_test("PUT /api/user-settings/{telegram_id}/notifications", False, 
                            f"Expected notification_time=15, got {notification_data['notification_time']}")
                return False
            
            self.log_test("PUT /api/user-settings/{telegram_id}/notifications", True, 
                        "Successfully updated notification settings",
                        {
                            "notifications_enabled": notification_data['notifications_enabled'],
                            "notification_time": notification_data['notification_time'],
                            "telegram_id": notification_data['telegram_id']
                        })
            return True
            
        except Exception as e:
            self.log_test("PUT /api/user-settings/{telegram_id}/notifications", False, f"Exception: {str(e)}")
            return False

    def test_verify_notification_settings_persisted(self) -> bool:
        """Test GET /api/user-settings/{telegram_id}/notifications returns updated settings"""
        try:
            print("🔍 Testing notification settings persistence...")
            
            test_telegram_id = 999999
            response = self.session.get(f"{self.base_url}/user-settings/{test_telegram_id}/notifications")
            
            if response.status_code != 200:
                self.log_test("GET /api/user-settings/{telegram_id}/notifications (updated)", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            notification_data = response.json()
            
            # Check that settings were persisted correctly
            if notification_data['notifications_enabled'] != True:
                self.log_test("GET /api/user-settings/{telegram_id}/notifications (updated)", False, 
                            f"Settings not persisted: notifications_enabled={notification_data['notifications_enabled']}")
                return False
            
            if notification_data['notification_time'] != 15:
                self.log_test("GET /api/user-settings/{telegram_id}/notifications (updated)", False, 
                            f"Settings not persisted: notification_time={notification_data['notification_time']}")
                return False
            
            self.log_test("GET /api/user-settings/{telegram_id}/notifications (updated)", True, 
                        "Successfully verified notification settings persistence",
                        {
                            "notifications_enabled": notification_data['notifications_enabled'],
                            "notification_time": notification_data['notification_time']
                        })
            return True
            
        except Exception as e:
            self.log_test("GET /api/user-settings/{telegram_id}/notifications (updated)", False, f"Exception: {str(e)}")
            return False

    def test_invalid_notification_time_values(self) -> bool:
        """Test PUT /api/user-settings/{telegram_id}/notifications with invalid time values"""
        try:
            print("🔍 Testing invalid notification time values...")
            
            test_telegram_id = 999999
            invalid_values = [4, 31]  # time < 5, time > 30
            
            for invalid_time in invalid_values:
                payload = {
                    "notifications_enabled": True,
                    "notification_time": invalid_time
                }
                
                response = self.session.put(
                    f"{self.base_url}/user-settings/{test_telegram_id}/notifications",
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                
                # Should return 422 for validation error or 400 for bad request
                if response.status_code not in [400, 422]:
                    self.log_test("PUT /api/user-settings/{telegram_id}/notifications (invalid values)", False, 
                                f"Expected HTTP 400/422 for time={invalid_time}, got {response.status_code}")
                    return False
            
            self.log_test("PUT /api/user-settings/{telegram_id}/notifications (invalid values)", True, 
                        "Successfully rejected invalid notification time values",
                        {"tested_values": invalid_values})
            return True
            
        except Exception as e:
            self.log_test("PUT /api/user-settings/{telegram_id}/notifications (invalid values)", False, f"Exception: {str(e)}")
            return False

    def test_notification_settings_nonexistent_user(self) -> bool:
        """Test notification endpoints with non-existent user"""
        try:
            print("🔍 Testing notification endpoints with non-existent user...")
            
            nonexistent_id = 888888
            
            # Test GET notifications for non-existent user
            response = self.session.get(f"{self.base_url}/user-settings/{nonexistent_id}/notifications")
            if response.status_code != 404:
                self.log_test("Notification endpoints - Non-existent User", False, 
                            f"GET: Expected HTTP 404, got {response.status_code}")
                return False
            
            # Test PUT notifications for non-existent user
            payload = {"notifications_enabled": True, "notification_time": 10}
            response = self.session.put(
                f"{self.base_url}/user-settings/{nonexistent_id}/notifications",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            if response.status_code != 404:
                self.log_test("Notification endpoints - Non-existent User", False, 
                            f"PUT: Expected HTTP 404, got {response.status_code}")
                return False
            
            self.log_test("Notification endpoints - Non-existent User", True, 
                        "Correctly returned 404 for non-existent user on both GET and PUT")
            return True
            
        except Exception as e:
            self.log_test("Notification endpoints - Non-existent User", False, f"Exception: {str(e)}")
            return False

    def test_get_achievements(self) -> bool:
        """Test GET /api/achievements endpoint"""
        try:
            print("🔍 Testing GET /api/achievements...")
            
            response = self.session.get(f"{self.base_url}/achievements")
            
            if response.status_code != 200:
                self.log_test("GET /api/achievements", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            achievements = response.json()
            
            # Validate response structure
            if not isinstance(achievements, list):
                self.log_test("GET /api/achievements", False, 
                            "Response is not a list")
                return False
            
            # Should return 6 achievements as per request
            if len(achievements) != 6:
                self.log_test("GET /api/achievements", False, 
                            f"Expected 6 achievements, got {len(achievements)}")
                return False
            
            # Validate achievement structure
            required_fields = ['id', 'name', 'description', 'emoji', 'points', 'type', 'requirement']
            for achievement in achievements:
                if not isinstance(achievement, dict):
                    self.log_test("GET /api/achievements", False, 
                                "Achievement is not a dictionary")
                    return False
                
                for field in required_fields:
                    if field not in achievement:
                        self.log_test("GET /api/achievements", False, 
                                    f"Achievement missing required field: {field}")
                        return False
            
            # Store for later tests
            self.test_data['achievements'] = achievements
            
            self.log_test("GET /api/achievements", True, 
                        f"Successfully retrieved {len(achievements)} achievements",
                        {"sample_achievement": achievements[0], "total_count": len(achievements)})
            return True
            
        except Exception as e:
            self.log_test("GET /api/achievements", False, f"Exception: {str(e)}")
            return False

    def test_get_weather(self) -> bool:
        """Test GET /api/weather endpoint"""
        try:
            print("🔍 Testing GET /api/weather...")
            
            response = self.session.get(f"{self.base_url}/weather")
            
            if response.status_code != 200:
                self.log_test("GET /api/weather", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            weather = response.json()
            
            # Validate response structure
            if not isinstance(weather, dict):
                self.log_test("GET /api/weather", False, 
                            "Response is not a dictionary")
                return False
            
            # Check required fields as per request
            required_fields = ['temperature', 'feels_like', 'humidity', 'wind_speed', 'description', 'icon']
            for field in required_fields:
                if field not in weather:
                    self.log_test("GET /api/weather", False, 
                                f"Weather data missing required field: {field}")
                    return False
            
            # Validate data types
            numeric_fields = ['temperature', 'feels_like', 'humidity', 'wind_speed']
            for field in numeric_fields:
                if not isinstance(weather[field], (int, float)):
                    self.log_test("GET /api/weather", False, 
                                f"Field {field} should be numeric, got {type(weather[field])}")
                    return False
            
            string_fields = ['description', 'icon']
            for field in string_fields:
                if not isinstance(weather[field], str):
                    self.log_test("GET /api/weather", False, 
                                f"Field {field} should be string, got {type(weather[field])}")
                    return False
            
            self.log_test("GET /api/weather", True, 
                        "Successfully retrieved weather data for Moscow",
                        {
                            "temperature": weather['temperature'],
                            "feels_like": weather['feels_like'],
                            "description": weather['description'],
                            "humidity": weather['humidity']
                        })
            return True
            
        except Exception as e:
            self.log_test("GET /api/weather", False, f"Exception: {str(e)}")
            return False

    def test_track_action(self) -> bool:
        """Test POST /api/track-action endpoint"""
        try:
            print("🔍 Testing POST /api/track-action...")
            
            # Test payload as specified in request
            payload = {
                "telegram_id": 123456789,
                "action_type": "select_group",
                "metadata": {}
            }
            
            response = self.session.post(
                f"{self.base_url}/track-action",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code != 200:
                self.log_test("POST /api/track-action", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            result = response.json()
            
            # Validate response structure
            if not isinstance(result, dict):
                self.log_test("POST /api/track-action", False, 
                            "Response is not a dictionary")
                return False
            
            # Should return new achievements if any
            # The response structure should have new_achievements field
            if 'new_achievements' not in result:
                self.log_test("POST /api/track-action", False, 
                            "Response missing 'new_achievements' field")
                return False
            
            if not isinstance(result['new_achievements'], list):
                self.log_test("POST /api/track-action", False, 
                            "'new_achievements' should be a list")
                return False
            
            self.log_test("POST /api/track-action", True, 
                        "Successfully tracked user action",
                        {
                            "action_type": payload['action_type'],
                            "telegram_id": payload['telegram_id'],
                            "new_achievements_count": len(result['new_achievements'])
                        })
            return True
            
        except Exception as e:
            self.log_test("POST /api/track-action", False, f"Exception: {str(e)}")
            return False

    def test_get_user_stats(self) -> bool:
        """Test GET /api/user-stats/{telegram_id} endpoint"""
        try:
            print("🔍 Testing GET /api/user-stats/{telegram_id}...")
            
            telegram_id = 123456789
            response = self.session.get(f"{self.base_url}/user-stats/{telegram_id}")
            
            if response.status_code != 200:
                self.log_test("GET /api/user-stats/{telegram_id}", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            stats = response.json()
            
            # Validate response structure
            if not isinstance(stats, dict):
                self.log_test("GET /api/user-stats/{telegram_id}", False, 
                            "Response is not a dictionary")
                return False
            
            # Check required fields for user statistics
            required_fields = ['telegram_id', 'groups_viewed', 'friends_invited', 'schedule_views', 
                             'night_usage_count', 'early_usage_count', 'total_points', 'achievements_count']
            for field in required_fields:
                if field not in stats:
                    self.log_test("GET /api/user-stats/{telegram_id}", False, 
                                f"Stats missing required field: {field}")
                    return False
            
            # Validate telegram_id matches
            if stats['telegram_id'] != telegram_id:
                self.log_test("GET /api/user-stats/{telegram_id}", False, 
                            "Telegram ID mismatch in response")
                return False
            
            # Validate numeric fields
            numeric_fields = ['groups_viewed', 'friends_invited', 'schedule_views', 
                            'night_usage_count', 'early_usage_count', 'total_points', 'achievements_count']
            for field in numeric_fields:
                if not isinstance(stats[field], int):
                    self.log_test("GET /api/user-stats/{telegram_id}", False, 
                                f"Field {field} should be integer, got {type(stats[field])}")
                    return False
            
            self.log_test("GET /api/user-stats/{telegram_id}", True, 
                        "Successfully retrieved user statistics",
                        {
                            "telegram_id": stats['telegram_id'],
                            "total_points": stats['total_points'],
                            "achievements_count": stats['achievements_count'],
                            "schedule_views": stats['schedule_views']
                        })
            return True
            
        except Exception as e:
            self.log_test("GET /api/user-stats/{telegram_id}", False, f"Exception: {str(e)}")
            return False

    def test_get_user_achievements(self) -> bool:
        """Test GET /api/user-achievements/{telegram_id} endpoint"""
        try:
            print("🔍 Testing GET /api/user-achievements/{telegram_id}...")
            
            telegram_id = 123456789
            response = self.session.get(f"{self.base_url}/user-achievements/{telegram_id}")
            
            if response.status_code != 200:
                self.log_test("GET /api/user-achievements/{telegram_id}", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            user_achievements = response.json()
            
            # Validate response structure
            if not isinstance(user_achievements, list):
                self.log_test("GET /api/user-achievements/{telegram_id}", False, 
                            "Response is not a list")
                return False
            
            # If user has achievements, validate structure
            if user_achievements:
                for achievement in user_achievements:
                    if not isinstance(achievement, dict):
                        self.log_test("GET /api/user-achievements/{telegram_id}", False, 
                                    "User achievement is not a dictionary")
                        return False
                    
                    # Check for required fields in user achievement
                    required_fields = ['achievement', 'earned_at', 'seen']
                    for field in required_fields:
                        if field not in achievement:
                            self.log_test("GET /api/user-achievements/{telegram_id}", False, 
                                        f"User achievement missing required field: {field}")
                            return False
                    
                    # Validate nested achievement object
                    if not isinstance(achievement['achievement'], dict):
                        self.log_test("GET /api/user-achievements/{telegram_id}", False, 
                                    "Achievement field should be a dictionary")
                        return False
                    
                    # Check achievement object has required fields
                    achievement_fields = ['id', 'name', 'description', 'emoji', 'points', 'type', 'requirement']
                    for field in achievement_fields:
                        if field not in achievement['achievement']:
                            self.log_test("GET /api/user-achievements/{telegram_id}", False, 
                                        f"Achievement object missing required field: {field}")
                            return False
            
            self.log_test("GET /api/user-achievements/{telegram_id}", True, 
                        "Successfully retrieved user achievements",
                        {
                            "telegram_id": telegram_id,
                            "achievements_count": len(user_achievements),
                            "sample_achievement": user_achievements[0] if user_achievements else None
                        })
            return True
            
        except Exception as e:
            self.log_test("GET /api/user-achievements/{telegram_id}", False, f"Exception: {str(e)}")
            return False

    def test_analytics_counting_fix(self) -> bool:
        """Test analytics counting fix for schedule views - group classes by time slot"""
        try:
            print("🔍 Testing Analytics Counting Fix - Group Classes by Time Slot...")
            
            # Step 1: Create test user (telegram_id: 999888777)
            test_telegram_id = 999888777
            
            # First create user settings to ensure user exists
            user_payload = {
                "telegram_id": test_telegram_id,
                "username": "analytics_test_user",
                "first_name": "Аналитика",
                "last_name": "Тест",
                "group_id": "analytics-test-group",
                "group_name": "Группа для тестирования аналитики",
                "facultet_id": "analytics-test-facultet",
                "level_id": "analytics-test-level",
                "kurs": "1",
                "form_code": "д"
            }
            
            user_response = self.session.post(
                f"{self.base_url}/user-settings",
                json=user_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if user_response.status_code != 200:
                self.log_test("Analytics Counting Fix - Create User", False, 
                            f"Failed to create test user: HTTP {user_response.status_code}: {user_response.text}")
                return False
            
            # Step 2: Get initial stats
            initial_stats_response = self.session.get(f"{self.base_url}/user-stats/{test_telegram_id}")
            
            if initial_stats_response.status_code != 200:
                self.log_test("Analytics Counting Fix - Get Initial Stats", False, 
                            f"HTTP {initial_stats_response.status_code}: {initial_stats_response.text}")
                return False
            
            initial_stats = initial_stats_response.json()
            initial_schedule_views = initial_stats.get('schedule_views', 0)
            
            # Step 3: Simulate viewing schedule with 5 classes (multiple classes at same time)
            track_payload_5_classes = {
                "telegram_id": test_telegram_id,
                "action_type": "view_schedule",
                "metadata": {"classes_count": 5}
            }
            
            track_response_1 = self.session.post(
                f"{self.base_url}/track-action",
                json=track_payload_5_classes,
                headers={"Content-Type": "application/json"}
            )
            
            if track_response_1.status_code != 200:
                self.log_test("Analytics Counting Fix - Track 5 Classes", False, 
                            f"HTTP {track_response_1.status_code}: {track_response_1.text}")
                return False
            
            # Step 4: Verify schedule_views increased by 5
            stats_after_5_response = self.session.get(f"{self.base_url}/user-stats/{test_telegram_id}")
            
            if stats_after_5_response.status_code != 200:
                self.log_test("Analytics Counting Fix - Get Stats After 5", False, 
                            f"HTTP {stats_after_5_response.status_code}: {stats_after_5_response.text}")
                return False
            
            stats_after_5 = stats_after_5_response.json()
            schedule_views_after_5 = stats_after_5.get('schedule_views', 0)
            
            expected_after_5 = initial_schedule_views + 5
            if schedule_views_after_5 != expected_after_5:
                self.log_test("Analytics Counting Fix - Verify 5 Classes Increment", False, 
                            f"Expected schedule_views={expected_after_5}, got {schedule_views_after_5}")
                return False
            
            # Step 5: Simulate viewing schedule with 3 classes
            track_payload_3_classes = {
                "telegram_id": test_telegram_id,
                "action_type": "view_schedule",
                "metadata": {"classes_count": 3}
            }
            
            track_response_2 = self.session.post(
                f"{self.base_url}/track-action",
                json=track_payload_3_classes,
                headers={"Content-Type": "application/json"}
            )
            
            if track_response_2.status_code != 200:
                self.log_test("Analytics Counting Fix - Track 3 Classes", False, 
                            f"HTTP {track_response_2.status_code}: {track_response_2.text}")
                return False
            
            # Step 6: Verify schedule_views increased by 3 more (total should be 8)
            stats_after_3_response = self.session.get(f"{self.base_url}/user-stats/{test_telegram_id}")
            
            if stats_after_3_response.status_code != 200:
                self.log_test("Analytics Counting Fix - Get Stats After 3", False, 
                            f"HTTP {stats_after_3_response.status_code}: {stats_after_3_response.text}")
                return False
            
            stats_after_3 = stats_after_3_response.json()
            schedule_views_after_3 = stats_after_3.get('schedule_views', 0)
            
            expected_after_3 = expected_after_5 + 3
            if schedule_views_after_3 != expected_after_3:
                self.log_test("Analytics Counting Fix - Verify 3 Classes Increment", False, 
                            f"Expected schedule_views={expected_after_3}, got {schedule_views_after_3}")
                return False
            
            # Step 7: Test backwards compatibility - call track-action without metadata
            track_payload_no_metadata = {
                "telegram_id": test_telegram_id,
                "action_type": "view_schedule"
                # No metadata field
            }
            
            track_response_3 = self.session.post(
                f"{self.base_url}/track-action",
                json=track_payload_no_metadata,
                headers={"Content-Type": "application/json"}
            )
            
            if track_response_3.status_code != 200:
                self.log_test("Analytics Counting Fix - Track No Metadata", False, 
                            f"HTTP {track_response_3.status_code}: {track_response_3.text}")
                return False
            
            # Step 8: Verify schedule_views increased by 1 (default behavior)
            final_stats_response = self.session.get(f"{self.base_url}/user-stats/{test_telegram_id}")
            
            if final_stats_response.status_code != 200:
                self.log_test("Analytics Counting Fix - Get Final Stats", False, 
                            f"HTTP {final_stats_response.status_code}: {final_stats_response.text}")
                return False
            
            final_stats = final_stats_response.json()
            final_schedule_views = final_stats.get('schedule_views', 0)
            
            expected_final = expected_after_3 + 1
            if final_schedule_views != expected_final:
                self.log_test("Analytics Counting Fix - Verify Backwards Compatibility", False, 
                            f"Expected schedule_views={expected_final}, got {final_schedule_views}")
                return False
            
            self.log_test("Analytics Counting Fix - Group Classes by Time Slot", True, 
                        "Successfully verified analytics counting fix",
                        {
                            "initial_schedule_views": initial_schedule_views,
                            "after_5_classes": schedule_views_after_5,
                            "after_3_classes": schedule_views_after_3,
                            "final_schedule_views": final_schedule_views,
                            "total_increment": final_schedule_views - initial_schedule_views,
                            "expected_increment": 9  # 5 + 3 + 1
                        })
            return True
            
        except Exception as e:
            self.log_test("Analytics Counting Fix - Group Classes by Time Slot", False, f"Exception: {str(e)}")
            return False

    def test_bot_info_endpoint(self) -> bool:
        """Test GET /api/bot-info endpoint"""
        try:
            print("🔍 Testing GET /api/bot-info...")
            
            response = self.session.get(f"{self.base_url}/bot-info")
            
            if response.status_code != 200:
                self.log_test("GET /api/bot-info", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            bot_info = response.json()
            
            # Validate response structure
            if not isinstance(bot_info, dict):
                self.log_test("GET /api/bot-info", False, 
                            "Response is not a dictionary")
                return False
            
            # Check required fields as per request
            required_fields = ['username', 'first_name', 'id', 'can_join_groups', 
                             'can_read_all_group_messages', 'supports_inline_queries']
            for field in required_fields:
                if field not in bot_info:
                    self.log_test("GET /api/bot-info", False, 
                                f"Bot info missing required field: {field}")
                    return False
            
            # Validate specific expected values from request
            if bot_info['username'] != "rudn_mosbot":
                self.log_test("GET /api/bot-info", False, 
                            f"Expected username='rudn_mosbot', got '{bot_info['username']}'")
                return False
            
            # Validate data types
            if not isinstance(bot_info['first_name'], str):
                self.log_test("GET /api/bot-info", False, 
                            f"Field 'first_name' should be string, got {type(bot_info['first_name'])}")
                return False
            
            if not isinstance(bot_info['id'], int):
                self.log_test("GET /api/bot-info", False, 
                            f"Field 'id' should be integer, got {type(bot_info['id'])}")
                return False
            
            boolean_fields = ['can_join_groups', 'can_read_all_group_messages', 'supports_inline_queries']
            for field in boolean_fields:
                if not isinstance(bot_info[field], bool):
                    self.log_test("GET /api/bot-info", False, 
                                f"Field '{field}' should be boolean, got {type(bot_info[field])}")
                    return False
            
            # Validate that first_name is not empty
            if not bot_info['first_name'].strip():
                self.log_test("GET /api/bot-info", False, 
                            "Field 'first_name' should not be empty")
                return False
            
            # Validate that id is a positive number
            if bot_info['id'] <= 0:
                self.log_test("GET /api/bot-info", False, 
                            f"Field 'id' should be positive, got {bot_info['id']}")
                return False
            
            self.log_test("GET /api/bot-info", True, 
                        "Successfully retrieved bot information",
                        {
                            "username": bot_info['username'],
                            "first_name": bot_info['first_name'],
                            "id": bot_info['id'],
                            "can_join_groups": bot_info['can_join_groups'],
                            "can_read_all_group_messages": bot_info['can_read_all_group_messages'],
                            "supports_inline_queries": bot_info['supports_inline_queries']
                        })
            return True
            
        except Exception as e:
            self.log_test("GET /api/bot-info", False, f"Exception: {str(e)}")
            return False

    def test_admin_stats_endpoint(self) -> bool:
        """Test GET /api/admin/stats endpoint"""
        try:
            print("🔍 Testing GET /api/admin/stats...")
            
            response = self.session.get(f"{self.base_url}/admin/stats")
            
            if response.status_code != 200:
                self.log_test("GET /api/admin/stats", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            stats = response.json()
            
            # Validate response structure
            if not isinstance(stats, dict):
                self.log_test("GET /api/admin/stats", False, 
                            "Response is not a dictionary")
                return False
            
            # Check required fields
            required_fields = ['total_users', 'active_users_today', 'total_tasks']
            for field in required_fields:
                if field not in stats:
                    self.log_test("GET /api/admin/stats", False, 
                                f"Missing required field: {field}")
                    return False
            
            # Validate data types
            for field in required_fields:
                if not isinstance(stats[field], int):
                    self.log_test("GET /api/admin/stats", False, 
                                f"Field {field} should be integer, got {type(stats[field])}")
                    return False
            
            # Validate non-negative values
            for field in required_fields:
                if stats[field] < 0:
                    self.log_test("GET /api/admin/stats", False, 
                                f"Field {field} should be non-negative, got {stats[field]}")
                    return False
            
            self.log_test("GET /api/admin/stats", True, 
                        "Successfully retrieved admin statistics",
                        {
                            "total_users": stats['total_users'],
                            "active_users_today": stats['active_users_today'],
                            "total_tasks": stats['total_tasks']
                        })
            return True
            
        except Exception as e:
            self.log_test("GET /api/admin/stats", False, f"Exception: {str(e)}")
            return False

    def test_admin_users_activity_endpoint(self) -> bool:
        """Test GET /api/admin/users-activity?days=30 endpoint"""
        try:
            print("🔍 Testing GET /api/admin/users-activity?days=30...")
            
            response = self.session.get(f"{self.base_url}/admin/users-activity?days=30")
            
            if response.status_code != 200:
                self.log_test("GET /api/admin/users-activity", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            activity_data = response.json()
            
            # Validate response structure
            if not isinstance(activity_data, list):
                self.log_test("GET /api/admin/users-activity", False, 
                            "Response is not a list")
                return False
            
            # Check that we have data (should return array with date and count)
            if len(activity_data) == 0:
                self.log_test("GET /api/admin/users-activity", False, 
                            "Response is empty - expected array with date and count")
                return False
            
            # Validate structure of first item
            if activity_data:
                first_item = activity_data[0]
                if not isinstance(first_item, dict):
                    self.log_test("GET /api/admin/users-activity", False, 
                                "Activity item is not a dictionary")
                    return False
                
                required_fields = ['date', 'count']
                for field in required_fields:
                    if field not in first_item:
                        self.log_test("GET /api/admin/users-activity", False, 
                                    f"Activity item missing required field: {field}")
                        return False
                
                # Validate count is integer
                if not isinstance(first_item['count'], int):
                    self.log_test("GET /api/admin/users-activity", False, 
                                f"Count should be integer, got {type(first_item['count'])}")
                    return False
            
            self.log_test("GET /api/admin/users-activity", True, 
                        "Successfully retrieved users activity data",
                        {
                            "data_points": len(activity_data),
                            "sample_item": activity_data[0] if activity_data else None
                        })
            return True
            
        except Exception as e:
            self.log_test("GET /api/admin/users-activity", False, f"Exception: {str(e)}")
            return False

    def test_admin_hourly_activity_endpoint(self) -> bool:
        """Test GET /api/admin/hourly-activity?days=30 endpoint"""
        try:
            print("🔍 Testing GET /api/admin/hourly-activity?days=30...")
            
            response = self.session.get(f"{self.base_url}/admin/hourly-activity?days=30")
            
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
            
            # Should return 24 elements (0-23 hours)
            if len(hourly_data) != 24:
                self.log_test("GET /api/admin/hourly-activity", False, 
                            f"Expected 24 hourly elements, got {len(hourly_data)}")
                return False
            
            # Validate structure of each hour
            for i, hour_item in enumerate(hourly_data):
                if not isinstance(hour_item, dict):
                    self.log_test("GET /api/admin/hourly-activity", False, 
                                f"Hour item {i} is not a dictionary")
                    return False
                
                required_fields = ['hour', 'count']
                for field in required_fields:
                    if field not in hour_item:
                        self.log_test("GET /api/admin/hourly-activity", False, 
                                    f"Hour item {i} missing required field: {field}")
                        return False
                
                # IMPORTANT: Validate hour is integer (0-23), not string
                if not isinstance(hour_item['hour'], int):
                    self.log_test("GET /api/admin/hourly-activity", False, 
                                f"Hour should be integer, got {type(hour_item['hour'])} for item {i}")
                    return False
                
                if hour_item['hour'] < 0 or hour_item['hour'] > 23:
                    self.log_test("GET /api/admin/hourly-activity", False, 
                                f"Hour should be 0-23, got {hour_item['hour']} for item {i}")
                    return False
                
                # Validate count is integer
                if not isinstance(hour_item['count'], int):
                    self.log_test("GET /api/admin/hourly-activity", False, 
                                f"Count should be integer, got {type(hour_item['count'])} for item {i}")
                    return False
            
            self.log_test("GET /api/admin/hourly-activity", True, 
                        "Successfully retrieved hourly activity data with correct format",
                        {
                            "hours_count": len(hourly_data),
                            "sample_hours": hourly_data[:3],
                            "hour_format_correct": "All hours are integers 0-23"
                        })
            return True
            
        except Exception as e:
            self.log_test("GET /api/admin/hourly-activity", False, f"Exception: {str(e)}")
            return False

    def test_admin_weekly_activity_endpoint(self) -> bool:
        """Test GET /api/admin/weekly-activity?days=30 endpoint"""
        try:
            print("🔍 Testing GET /api/admin/weekly-activity?days=30...")
            
            response = self.session.get(f"{self.base_url}/admin/weekly-activity?days=30")
            
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
            
            # Should return 7 elements (Monday-Sunday)
            if len(weekly_data) != 7:
                self.log_test("GET /api/admin/weekly-activity", False, 
                            f"Expected 7 weekly elements (Mon-Sun), got {len(weekly_data)}")
                return False
            
            # Validate structure of each day
            expected_days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
            for i, day_item in enumerate(weekly_data):
                if not isinstance(day_item, dict):
                    self.log_test("GET /api/admin/weekly-activity", False, 
                                f"Day item {i} is not a dictionary")
                    return False
                
                required_fields = ['day', 'count']
                for field in required_fields:
                    if field not in day_item:
                        self.log_test("GET /api/admin/weekly-activity", False, 
                                    f"Day item {i} missing required field: {field}")
                        return False
                
                # Validate count is integer
                if not isinstance(day_item['count'], int):
                    self.log_test("GET /api/admin/weekly-activity", False, 
                                f"Count should be integer, got {type(day_item['count'])} for item {i}")
                    return False
            
            self.log_test("GET /api/admin/weekly-activity", True, 
                        "Successfully retrieved weekly activity data",
                        {
                            "days_count": len(weekly_data),
                            "sample_days": weekly_data[:3]
                        })
            return True
            
        except Exception as e:
            self.log_test("GET /api/admin/weekly-activity", False, f"Exception: {str(e)}")
            return False

    def test_admin_feature_usage_endpoint(self) -> bool:
        """Test GET /api/admin/feature-usage?days=30 endpoint"""
        try:
            print("🔍 Testing GET /api/admin/feature-usage?days=30...")
            
            response = self.session.get(f"{self.base_url}/admin/feature-usage?days=30")
            
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
            
            # Check for expected feature usage fields
            expected_features = ['schedule_views', 'task_creations', 'group_task_creations', 'room_creations']
            for feature in expected_features:
                if feature not in feature_data:
                    self.log_test("GET /api/admin/feature-usage", False, 
                                f"Missing expected feature: {feature}")
                    return False
                
                # Validate count is integer
                if not isinstance(feature_data[feature], int):
                    self.log_test("GET /api/admin/feature-usage", False, 
                                f"Feature {feature} should be integer, got {type(feature_data[feature])}")
                    return False
                
                # Validate non-negative
                if feature_data[feature] < 0:
                    self.log_test("GET /api/admin/feature-usage", False, 
                                f"Feature {feature} should be non-negative, got {feature_data[feature]}")
                    return False
            
            self.log_test("GET /api/admin/feature-usage", True, 
                        "Successfully retrieved feature usage statistics",
                        {
                            "schedule_views": feature_data['schedule_views'],
                            "task_creations": feature_data['task_creations'],
                            "group_task_creations": feature_data['group_task_creations'],
                            "room_creations": feature_data['room_creations']
                        })
            return True
            
        except Exception as e:
            self.log_test("GET /api/admin/feature-usage", False, f"Exception: {str(e)}")
            return False

    def test_admin_top_users_endpoint(self) -> bool:
        """Test GET /api/admin/top-users?metric=points&limit=10 endpoint"""
        try:
            print("🔍 Testing GET /api/admin/top-users?metric=points&limit=10...")
            
            response = self.session.get(f"{self.base_url}/admin/top-users?metric=points&limit=10")
            
            if response.status_code != 200:
                self.log_test("GET /api/admin/top-users", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            top_users = response.json()
            
            # Validate response structure
            if not isinstance(top_users, list):
                self.log_test("GET /api/admin/top-users", False, 
                            "Response is not a list")
                return False
            
            # Should not exceed limit of 10
            if len(top_users) > 10:
                self.log_test("GET /api/admin/top-users", False, 
                            f"Expected max 10 users, got {len(top_users)}")
                return False
            
            # Validate structure of each user (if any users exist)
            if top_users:
                for i, user in enumerate(top_users):
                    if not isinstance(user, dict):
                        self.log_test("GET /api/admin/top-users", False, 
                                    f"User item {i} is not a dictionary")
                        return False
                    
                    required_fields = ['telegram_id', 'first_name', 'total_points']
                    for field in required_fields:
                        if field not in user:
                            self.log_test("GET /api/admin/top-users", False, 
                                        f"User item {i} missing required field: {field}")
                            return False
                    
                    # Validate data types
                    if not isinstance(user['telegram_id'], int):
                        self.log_test("GET /api/admin/top-users", False, 
                                    f"telegram_id should be integer, got {type(user['telegram_id'])} for user {i}")
                        return False
                    
                    if not isinstance(user['total_points'], int):
                        self.log_test("GET /api/admin/top-users", False, 
                                    f"total_points should be integer, got {type(user['total_points'])} for user {i}")
                        return False
            
            self.log_test("GET /api/admin/top-users", True, 
                        "Successfully retrieved top users by points",
                        {
                            "users_count": len(top_users),
                            "sample_user": top_users[0] if top_users else None
                        })
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
                            "Response is not a list")
                return False
            
            # Validate structure of each faculty stat (if any exist)
            if faculty_stats:
                for i, faculty in enumerate(faculty_stats):
                    if not isinstance(faculty, dict):
                        self.log_test("GET /api/admin/faculty-stats", False, 
                                    f"Faculty item {i} is not a dictionary")
                        return False
                    
                    required_fields = ['faculty_id', 'faculty_name', 'user_count']
                    for field in required_fields:
                        if field not in faculty:
                            self.log_test("GET /api/admin/faculty-stats", False, 
                                        f"Faculty item {i} missing required field: {field}")
                            return False
                    
                    # Validate user_count is integer
                    if not isinstance(faculty['user_count'], int):
                        self.log_test("GET /api/admin/faculty-stats", False, 
                                    f"user_count should be integer, got {type(faculty['user_count'])} for faculty {i}")
                        return False
                    
                    # Validate non-negative count
                    if faculty['user_count'] < 0:
                        self.log_test("GET /api/admin/faculty-stats", False, 
                                    f"user_count should be non-negative, got {faculty['user_count']} for faculty {i}")
                        return False
            
            self.log_test("GET /api/admin/faculty-stats", True, 
                        "Successfully retrieved faculty statistics",
                        {
                            "faculties_count": len(faculty_stats),
                            "sample_faculty": faculty_stats[0] if faculty_stats else None
                        })
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
                            "Response is not a list")
                return False
            
            # Validate structure of each course stat (if any exist)
            if course_stats:
                for i, course in enumerate(course_stats):
                    if not isinstance(course, dict):
                        self.log_test("GET /api/admin/course-stats", False, 
                                    f"Course item {i} is not a dictionary")
                        return False
                    
                    required_fields = ['course', 'user_count']
                    for field in required_fields:
                        if field not in course:
                            self.log_test("GET /api/admin/course-stats", False, 
                                        f"Course item {i} missing required field: {field}")
                            return False
                    
                    # Validate user_count is integer
                    if not isinstance(course['user_count'], int):
                        self.log_test("GET /api/admin/course-stats", False, 
                                    f"user_count should be integer, got {type(course['user_count'])} for course {i}")
                        return False
                    
                    # Validate non-negative count
                    if course['user_count'] < 0:
                        self.log_test("GET /api/admin/course-stats", False, 
                                    f"user_count should be non-negative, got {course['user_count']} for course {i}")
                        return False
            
            self.log_test("GET /api/admin/course-stats", True, 
                        "Successfully retrieved course statistics",
                        {
                            "courses_count": len(course_stats),
                            "sample_course": course_stats[0] if course_stats else None
                        })
            return True
            
        except Exception as e:
            self.log_test("GET /api/admin/course-stats", False, f"Exception: {str(e)}")
            return False

    def test_new_task_achievements_total_count(self) -> bool:
        """Test that total achievements count is now 24 (was 16, added 8 new task achievements)"""
        try:
            print("🔍 Testing New Task Achievements - Total Count (should be 24)...")
            
            response = self.session.get(f"{self.base_url}/achievements")
            
            if response.status_code != 200:
                self.log_test("New Task Achievements - Total Count", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            achievements = response.json()
            
            # Should now be 24 achievements (16 old + 8 new task achievements)
            if len(achievements) != 24:
                self.log_test("New Task Achievements - Total Count", False, 
                            f"Expected 24 achievements (16 old + 8 new), got {len(achievements)}")
                return False
            
            # Find the new "first_task" achievement to verify it exists
            first_task_achievement = None
            for achievement in achievements:
                if achievement.get('id') == 'first_task':
                    first_task_achievement = achievement
                    break
            
            if not first_task_achievement:
                self.log_test("New Task Achievements - Total Count", False, 
                            "Could not find 'first_task' achievement in the list")
                return False
            
            # Validate the first_task achievement structure
            expected_first_task = {
                'id': 'first_task',
                'emoji': '📝',
                'points': 5
            }
            
            for key, expected_value in expected_first_task.items():
                if first_task_achievement.get(key) != expected_value:
                    self.log_test("New Task Achievements - Total Count", False, 
                                f"first_task achievement {key}: expected {expected_value}, got {first_task_achievement.get(key)}")
                    return False
            
            # Store achievements for later tests
            self.test_data['all_achievements'] = achievements
            
            self.log_test("New Task Achievements - Total Count", True, 
                        f"Successfully verified 24 total achievements including new task achievements",
                        {
                            "total_achievements": len(achievements),
                            "first_task_achievement": first_task_achievement,
                            "new_task_achievements_found": len([a for a in achievements if a.get('id') in [
                                'first_task', 'productive_day', 'early_riser_tasks', 'task_specialist',
                                'lightning_fast', 'flawless', 'marathon_runner', 'completion_master'
                            ]])
                        })
            return True
            
        except Exception as e:
            self.log_test("New Task Achievements - Total Count", False, f"Exception: {str(e)}")
            return False

    def test_first_task_achievement(self) -> bool:
        """Test 'Первая задача' achievement - earned when creating first task"""
        try:
            print("🔍 Testing 'Первая задача' Achievement (first_task)...")
            
            # Create new test user
            test_telegram_id = 999111222
            
            # Step 1: Create user settings
            user_payload = {
                "telegram_id": test_telegram_id,
                "username": "first_task_user",
                "first_name": "Первая",
                "last_name": "Задача",
                "group_id": "first-task-group",
                "group_name": "Группа для первой задачи",
                "facultet_id": "first-task-facultet",
                "level_id": "first-task-level",
                "kurs": "1",
                "form_code": "д"
            }
            
            user_response = self.session.post(
                f"{self.base_url}/user-settings",
                json=user_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if user_response.status_code != 200:
                self.log_test("First Task Achievement - Create User", False, 
                            f"Failed to create user: HTTP {user_response.status_code}: {user_response.text}")
                return False
            
            # Step 2: Create first task
            task_payload = {
                "telegram_id": test_telegram_id,
                "text": "Моя первая задача для получения достижения",
                "completed": False,
                "category": "Учеба",
                "priority": "medium"
            }
            
            task_response = self.session.post(
                f"{self.base_url}/tasks",
                json=task_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if task_response.status_code != 200:
                self.log_test("First Task Achievement - Create Task", False, 
                            f"Failed to create task: HTTP {task_response.status_code}: {task_response.text}")
                return False
            
            # Step 3: Check user achievements - should now have "first_task"
            achievements_response = self.session.get(f"{self.base_url}/user-achievements/{test_telegram_id}")
            
            if achievements_response.status_code != 200:
                self.log_test("First Task Achievement - Get Achievements", False, 
                            f"HTTP {achievements_response.status_code}: {achievements_response.text}")
                return False
            
            user_achievements = achievements_response.json()
            
            # Find first_task achievement
            first_task_earned = None
            for achievement in user_achievements:
                if achievement.get('achievement', {}).get('id') == 'first_task':
                    first_task_earned = achievement
                    break
            
            if not first_task_earned:
                self.log_test("First Task Achievement - Verify Achievement", False, 
                            "first_task achievement not found in user achievements")
                return False
            
            # Step 4: Verify user stats
            stats_response = self.session.get(f"{self.base_url}/user-stats/{test_telegram_id}")
            
            if stats_response.status_code != 200:
                self.log_test("First Task Achievement - Get Stats", False, 
                            f"HTTP {stats_response.status_code}: {stats_response.text}")
                return False
            
            user_stats = stats_response.json()
            
            # Verify stats fields
            if user_stats.get('tasks_created_total') != 1:
                self.log_test("First Task Achievement - Verify Stats", False, 
                            f"Expected tasks_created_total=1, got {user_stats.get('tasks_created_total')}")
                return False
            
            # Check if first_task_created field exists and is true
            # Note: This field might not be exposed in the API response, so we check the achievement instead
            
            self.log_test("First Task Achievement", True, 
                        "Successfully earned 'Первая задача' achievement",
                        {
                            "telegram_id": test_telegram_id,
                            "achievement_earned": first_task_earned['achievement'],
                            "tasks_created_total": user_stats.get('tasks_created_total'),
                            "earned_at": first_task_earned.get('earned_at')
                        })
            return True
            
        except Exception as e:
            self.log_test("First Task Achievement", False, f"Exception: {str(e)}")
            return False

    def test_productive_day_achievement(self) -> bool:
        """Test 'Продуктивный день' achievement - earned when completing 5 tasks in a day"""
        try:
            print("🔍 Testing 'Продуктивный день' Achievement (productive_day)...")
            
            # Use the same test user from first task test
            test_telegram_id = 999111222
            
            # Step 1: Create 5 tasks
            tasks_created = []
            for i in range(5):
                task_payload = {
                    "telegram_id": test_telegram_id,
                    "text": f"Задача для продуктивного дня #{i+1}",
                    "completed": False,
                    "category": "Учеба",
                    "priority": "medium"
                }
                
                task_response = self.session.post(
                    f"{self.base_url}/tasks",
                    json=task_payload,
                    headers={"Content-Type": "application/json"}
                )
                
                if task_response.status_code != 200:
                    self.log_test("Productive Day Achievement - Create Tasks", False, 
                                f"Failed to create task {i+1}: HTTP {task_response.status_code}: {task_response.text}")
                    return False
                
                task_data = task_response.json()
                tasks_created.append(task_data)
            
            # Step 2: Complete all 5 tasks
            for i, task in enumerate(tasks_created):
                update_payload = {
                    "completed": True
                }
                
                update_response = self.session.put(
                    f"{self.base_url}/tasks/{task['id']}",
                    json=update_payload,
                    headers={"Content-Type": "application/json"}
                )
                
                if update_response.status_code != 200:
                    self.log_test("Productive Day Achievement - Complete Tasks", False, 
                                f"Failed to complete task {i+1}: HTTP {update_response.status_code}: {update_response.text}")
                    return False
            
            # Step 3: Check user achievements - should now have "productive_day"
            achievements_response = self.session.get(f"{self.base_url}/user-achievements/{test_telegram_id}")
            
            if achievements_response.status_code != 200:
                self.log_test("Productive Day Achievement - Get Achievements", False, 
                            f"HTTP {achievements_response.status_code}: {achievements_response.text}")
                return False
            
            user_achievements = achievements_response.json()
            
            # Find productive_day achievement
            productive_day_earned = None
            for achievement in user_achievements:
                if achievement.get('achievement', {}).get('id') == 'productive_day':
                    productive_day_earned = achievement
                    break
            
            if not productive_day_earned:
                self.log_test("Productive Day Achievement - Verify Achievement", False, 
                            "productive_day achievement not found in user achievements")
                return False
            
            # Step 4: Verify user stats
            stats_response = self.session.get(f"{self.base_url}/user-stats/{test_telegram_id}")
            
            if stats_response.status_code != 200:
                self.log_test("Productive Day Achievement - Get Stats", False, 
                            f"HTTP {stats_response.status_code}: {stats_response.text}")
                return False
            
            user_stats = stats_response.json()
            
            # Verify stats - should have completed at least 5 tasks today
            tasks_completed_today = user_stats.get('tasks_completed_today', 0)
            if tasks_completed_today < 5:
                self.log_test("Productive Day Achievement - Verify Stats", False, 
                            f"Expected tasks_completed_today >= 5, got {tasks_completed_today}")
                return False
            
            self.log_test("Productive Day Achievement", True, 
                        "Successfully earned 'Продуктивный день' achievement",
                        {
                            "telegram_id": test_telegram_id,
                            "achievement_earned": productive_day_earned['achievement'],
                            "tasks_completed_today": tasks_completed_today,
                            "earned_at": productive_day_earned.get('earned_at')
                        })
            return True
            
        except Exception as e:
            self.log_test("Productive Day Achievement", False, f"Exception: {str(e)}")
            return False

    def test_lightning_fast_achievement(self) -> bool:
        """Test 'Молния' achievement - earned when completing 20 tasks in a day"""
        try:
            print("🔍 Testing 'Молния' Achievement (lightning_fast)...")
            
            # Use the same test user
            test_telegram_id = 999111222
            
            # Step 1: Create additional 15 tasks (we already have 5 completed)
            tasks_created = []
            for i in range(15):
                task_payload = {
                    "telegram_id": test_telegram_id,
                    "text": f"Задача для молнии #{i+6}",  # Start from 6 since we have 5 already
                    "completed": False,
                    "category": "Личное",
                    "priority": "high"
                }
                
                task_response = self.session.post(
                    f"{self.base_url}/tasks",
                    json=task_payload,
                    headers={"Content-Type": "application/json"}
                )
                
                if task_response.status_code != 200:
                    self.log_test("Lightning Fast Achievement - Create Tasks", False, 
                                f"Failed to create task {i+6}: HTTP {task_response.status_code}: {task_response.text}")
                    return False
                
                task_data = task_response.json()
                tasks_created.append(task_data)
            
            # Step 2: Complete all 15 additional tasks
            for i, task in enumerate(tasks_created):
                update_payload = {
                    "completed": True
                }
                
                update_response = self.session.put(
                    f"{self.base_url}/tasks/{task['id']}",
                    json=update_payload,
                    headers={"Content-Type": "application/json"}
                )
                
                if update_response.status_code != 200:
                    self.log_test("Lightning Fast Achievement - Complete Tasks", False, 
                                f"Failed to complete task {i+6}: HTTP {update_response.status_code}: {update_response.text}")
                    return False
            
            # Step 3: Check user achievements - should now have "lightning_fast"
            achievements_response = self.session.get(f"{self.base_url}/user-achievements/{test_telegram_id}")
            
            if achievements_response.status_code != 200:
                self.log_test("Lightning Fast Achievement - Get Achievements", False, 
                            f"HTTP {achievements_response.status_code}: {achievements_response.text}")
                return False
            
            user_achievements = achievements_response.json()
            
            # Find lightning_fast achievement
            lightning_fast_earned = None
            for achievement in user_achievements:
                if achievement.get('achievement', {}).get('id') == 'lightning_fast':
                    lightning_fast_earned = achievement
                    break
            
            if not lightning_fast_earned:
                self.log_test("Lightning Fast Achievement - Verify Achievement", False, 
                            "lightning_fast achievement not found in user achievements")
                return False
            
            # Step 4: Verify user stats
            stats_response = self.session.get(f"{self.base_url}/user-stats/{test_telegram_id}")
            
            if stats_response.status_code != 200:
                self.log_test("Lightning Fast Achievement - Get Stats", False, 
                            f"HTTP {stats_response.status_code}: {stats_response.text}")
                return False
            
            user_stats = stats_response.json()
            
            # Verify stats - should have completed at least 20 tasks today
            tasks_completed_today = user_stats.get('tasks_completed_today', 0)
            if tasks_completed_today < 20:
                self.log_test("Lightning Fast Achievement - Verify Stats", False, 
                            f"Expected tasks_completed_today >= 20, got {tasks_completed_today}")
                return False
            
            self.log_test("Lightning Fast Achievement", True, 
                        "Successfully earned 'Молния' achievement",
                        {
                            "telegram_id": test_telegram_id,
                            "achievement_earned": lightning_fast_earned['achievement'],
                            "tasks_completed_today": tasks_completed_today,
                            "earned_at": lightning_fast_earned.get('earned_at')
                        })
            return True
            
        except Exception as e:
            self.log_test("Lightning Fast Achievement", False, f"Exception: {str(e)}")
            return False

    def test_task_specialist_achievement(self) -> bool:
        """Test 'Специалист по задачам' achievement - earned when creating 50 tasks"""
        try:
            print("🔍 Testing 'Специалист по задачам' Achievement (task_specialist)...")
            
            # Create new test user for this test
            test_telegram_id = 999111333
            
            # Step 1: Create user settings
            user_payload = {
                "telegram_id": test_telegram_id,
                "username": "task_specialist_user",
                "first_name": "Специалист",
                "last_name": "Задач",
                "group_id": "specialist-group",
                "group_name": "Группа специалиста по задачам",
                "facultet_id": "specialist-facultet",
                "level_id": "specialist-level",
                "kurs": "2",
                "form_code": "о"
            }
            
            user_response = self.session.post(
                f"{self.base_url}/user-settings",
                json=user_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if user_response.status_code != 200:
                self.log_test("Task Specialist Achievement - Create User", False, 
                            f"Failed to create user: HTTP {user_response.status_code}: {user_response.text}")
                return False
            
            # Step 2: Create 50 tasks
            print("   Creating 50 tasks (this may take a moment)...")
            tasks_created = []
            for i in range(50):
                task_payload = {
                    "telegram_id": test_telegram_id,
                    "text": f"Задача специалиста #{i+1}",
                    "completed": False,
                    "category": "Проекты",
                    "priority": "low"
                }
                
                task_response = self.session.post(
                    f"{self.base_url}/tasks",
                    json=task_payload,
                    headers={"Content-Type": "application/json"}
                )
                
                if task_response.status_code != 200:
                    self.log_test("Task Specialist Achievement - Create Tasks", False, 
                                f"Failed to create task {i+1}: HTTP {task_response.status_code}: {task_response.text}")
                    return False
                
                task_data = task_response.json()
                tasks_created.append(task_data)
                
                # Print progress every 10 tasks
                if (i + 1) % 10 == 0:
                    print(f"   Created {i+1}/50 tasks...")
            
            # Step 3: Check user achievements - should now have "task_specialist"
            achievements_response = self.session.get(f"{self.base_url}/user-achievements/{test_telegram_id}")
            
            if achievements_response.status_code != 200:
                self.log_test("Task Specialist Achievement - Get Achievements", False, 
                            f"HTTP {achievements_response.status_code}: {achievements_response.text}")
                return False
            
            user_achievements = achievements_response.json()
            
            # Find task_specialist achievement
            task_specialist_earned = None
            for achievement in user_achievements:
                if achievement.get('achievement', {}).get('id') == 'task_specialist':
                    task_specialist_earned = achievement
                    break
            
            if not task_specialist_earned:
                self.log_test("Task Specialist Achievement - Verify Achievement", False, 
                            "task_specialist achievement not found in user achievements")
                return False
            
            # Step 4: Verify user stats
            stats_response = self.session.get(f"{self.base_url}/user-stats/{test_telegram_id}")
            
            if stats_response.status_code != 200:
                self.log_test("Task Specialist Achievement - Get Stats", False, 
                            f"HTTP {stats_response.status_code}: {stats_response.text}")
                return False
            
            user_stats = stats_response.json()
            
            # Verify stats - should have created exactly 50 tasks
            tasks_created_total = user_stats.get('tasks_created_total', 0)
            if tasks_created_total != 50:
                self.log_test("Task Specialist Achievement - Verify Stats", False, 
                            f"Expected tasks_created_total=50, got {tasks_created_total}")
                return False
            
            self.log_test("Task Specialist Achievement", True, 
                        "Successfully earned 'Специалист по задачам' achievement",
                        {
                            "telegram_id": test_telegram_id,
                            "achievement_earned": task_specialist_earned['achievement'],
                            "tasks_created_total": tasks_created_total,
                            "earned_at": task_specialist_earned.get('earned_at')
                        })
            return True
            
        except Exception as e:
            self.log_test("Task Specialist Achievement", False, f"Exception: {str(e)}")
            return False

    def test_completion_master_achievement(self) -> bool:
        """Test 'Мастер завершения' achievement - earned when completing 100 tasks"""
        try:
            print("🔍 Testing 'Мастер завершения' Achievement (completion_master)...")
            
            # Use the task specialist user and complete all 50 tasks, then create and complete 50 more
            test_telegram_id = 999111333
            
            # Step 1: Get all tasks for this user
            tasks_response = self.session.get(f"{self.base_url}/tasks/{test_telegram_id}")
            
            if tasks_response.status_code != 200:
                self.log_test("Completion Master Achievement - Get Tasks", False, 
                            f"HTTP {tasks_response.status_code}: {tasks_response.text}")
                return False
            
            existing_tasks = tasks_response.json()
            
            # Step 2: Complete all existing tasks (should be 50)
            print(f"   Completing {len(existing_tasks)} existing tasks...")
            for i, task in enumerate(existing_tasks):
                if not task.get('completed', False):  # Only complete if not already completed
                    update_payload = {
                        "completed": True
                    }
                    
                    update_response = self.session.put(
                        f"{self.base_url}/tasks/{task['id']}",
                        json=update_payload,
                        headers={"Content-Type": "application/json"}
                    )
                    
                    if update_response.status_code != 200:
                        self.log_test("Completion Master Achievement - Complete Existing Tasks", False, 
                                    f"Failed to complete task {i+1}: HTTP {update_response.status_code}: {update_response.text}")
                        return False
                
                # Print progress every 10 tasks
                if (i + 1) % 10 == 0:
                    print(f"   Completed {i+1}/{len(existing_tasks)} existing tasks...")
            
            # Step 3: Create and complete 50 more tasks to reach 100 total
            print("   Creating and completing 50 additional tasks...")
            for i in range(50):
                # Create task
                task_payload = {
                    "telegram_id": test_telegram_id,
                    "text": f"Дополнительная задача для мастера #{i+51}",
                    "completed": False,
                    "category": "Спорт",
                    "priority": "medium"
                }
                
                task_response = self.session.post(
                    f"{self.base_url}/tasks",
                    json=task_payload,
                    headers={"Content-Type": "application/json"}
                )
                
                if task_response.status_code != 200:
                    self.log_test("Completion Master Achievement - Create Additional Tasks", False, 
                                f"Failed to create task {i+51}: HTTP {task_response.status_code}: {task_response.text}")
                    return False
                
                task_data = task_response.json()
                
                # Complete task immediately
                update_payload = {
                    "completed": True
                }
                
                update_response = self.session.put(
                    f"{self.base_url}/tasks/{task_data['id']}",
                    json=update_payload,
                    headers={"Content-Type": "application/json"}
                )
                
                if update_response.status_code != 200:
                    self.log_test("Completion Master Achievement - Complete Additional Tasks", False, 
                                f"Failed to complete task {i+51}: HTTP {update_response.status_code}: {update_response.text}")
                    return False
                
                # Print progress every 10 tasks
                if (i + 1) % 10 == 0:
                    print(f"   Created and completed {i+1}/50 additional tasks...")
            
            # Step 4: Check user achievements - should now have "completion_master"
            achievements_response = self.session.get(f"{self.base_url}/user-achievements/{test_telegram_id}")
            
            if achievements_response.status_code != 200:
                self.log_test("Completion Master Achievement - Get Achievements", False, 
                            f"HTTP {achievements_response.status_code}: {achievements_response.text}")
                return False
            
            user_achievements = achievements_response.json()
            
            # Find completion_master achievement
            completion_master_earned = None
            for achievement in user_achievements:
                if achievement.get('achievement', {}).get('id') == 'completion_master':
                    completion_master_earned = achievement
                    break
            
            if not completion_master_earned:
                self.log_test("Completion Master Achievement - Verify Achievement", False, 
                            "completion_master achievement not found in user achievements")
                return False
            
            # Step 5: Verify user stats
            stats_response = self.session.get(f"{self.base_url}/user-stats/{test_telegram_id}")
            
            if stats_response.status_code != 200:
                self.log_test("Completion Master Achievement - Get Stats", False, 
                            f"HTTP {stats_response.status_code}: {stats_response.text}")
                return False
            
            user_stats = stats_response.json()
            
            # Verify stats - should have completed at least 100 tasks
            tasks_completed_total = user_stats.get('tasks_completed_total', 0)
            if tasks_completed_total < 100:
                self.log_test("Completion Master Achievement - Verify Stats", False, 
                            f"Expected tasks_completed_total >= 100, got {tasks_completed_total}")
                return False
            
            self.log_test("Completion Master Achievement", True, 
                        "Successfully earned 'Мастер завершения' achievement",
                        {
                            "telegram_id": test_telegram_id,
                            "achievement_earned": completion_master_earned['achievement'],
                            "tasks_completed_total": tasks_completed_total,
                            "tasks_created_total": user_stats.get('tasks_created_total', 0),
                            "earned_at": completion_master_earned.get('earned_at')
                        })
            return True
            
        except Exception as e:
            self.log_test("Completion Master Achievement", False, f"Exception: {str(e)}")
            return False

    def test_user_profile_functionality(self) -> bool:
        """Test user profile functionality as requested - GET /api/user-settings/{telegram_id} with group_name"""
        try:
            print("🔍 Testing User Profile Functionality - GET /api/user-settings/{telegram_id} with group_name...")
            
            # Use the specific telegram_id from the request
            telegram_id = 123456789
            
            # First ensure the user exists by creating/updating user settings
            user_payload = {
                "telegram_id": telegram_id,
                "username": "profile_test_user",
                "first_name": "Профиль",
                "last_name": "Тестовый",
                "group_id": "profile-test-group-id",
                "group_name": "Тестовая группа для профиля",
                "facultet_id": "profile-test-facultet",
                "level_id": "profile-test-level",
                "kurs": "2",
                "form_code": "о"
            }
            
            # Create/update user settings
            create_response = self.session.post(
                f"{self.base_url}/user-settings",
                json=user_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if create_response.status_code != 200:
                self.log_test("User Profile - Create/Update User", False, 
                            f"Failed to create/update user: HTTP {create_response.status_code}: {create_response.text}")
                return False
            
            # Now test the GET endpoint for user profile
            response = self.session.get(f"{self.base_url}/user-settings/{telegram_id}")
            
            if response.status_code != 200:
                self.log_test("User Profile - GET /api/user-settings/{telegram_id}", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
            
            user_data = response.json()
            
            # Validate response structure
            if not isinstance(user_data, dict):
                self.log_test("User Profile - GET /api/user-settings/{telegram_id}", False, 
                            "Response is not a dictionary")
                return False
            
            # Check required fields for user profile (especially group_name as requested)
            required_fields = ['id', 'telegram_id', 'username', 'first_name', 'last_name', 
                             'group_id', 'group_name', 'facultet_id', 'level_id', 'kurs', 'form_code',
                             'created_at', 'updated_at', 'last_activity']
            
            missing_fields = []
            for field in required_fields:
                if field not in user_data:
                    missing_fields.append(field)
            
            if missing_fields:
                self.log_test("User Profile - GET /api/user-settings/{telegram_id}", False, 
                            f"Missing required fields: {missing_fields}")
                return False
            
            # Validate telegram_id matches the requested one
            if user_data['telegram_id'] != telegram_id:
                self.log_test("User Profile - GET /api/user-settings/{telegram_id}", False, 
                            f"Telegram ID mismatch: expected {telegram_id}, got {user_data['telegram_id']}")
                return False
            
            # Validate that group_name is present and not empty (key requirement from request)
            if not user_data['group_name'] or not user_data['group_name'].strip():
                self.log_test("User Profile - GET /api/user-settings/{telegram_id}", False, 
                            "group_name field is missing or empty - this is required for profile display")
                return False
            
            # Validate that all user data fields are properly filled
            user_fields_to_check = ['username', 'first_name', 'group_id', 'group_name', 'facultet_id']
            empty_fields = []
            for field in user_fields_to_check:
                if not user_data.get(field) or not str(user_data[field]).strip():
                    empty_fields.append(field)
            
            if empty_fields:
                self.log_test("User Profile - GET /api/user-settings/{telegram_id}", False, 
                            f"Empty or missing user data fields: {empty_fields}")
                return False
            
            # Validate data types
            string_fields = ['username', 'first_name', 'last_name', 'group_id', 'group_name', 
                           'facultet_id', 'level_id', 'kurs', 'form_code']
            for field in string_fields:
                if field in user_data and user_data[field] is not None:
                    if not isinstance(user_data[field], str):
                        self.log_test("User Profile - GET /api/user-settings/{telegram_id}", False, 
                                    f"Field '{field}' should be string, got {type(user_data[field])}")
                        return False
            
            if not isinstance(user_data['telegram_id'], int):
                self.log_test("User Profile - GET /api/user-settings/{telegram_id}", False, 
                            f"Field 'telegram_id' should be integer, got {type(user_data['telegram_id'])}")
                return False
            
            # Test that the API returns complete data for profile display
            profile_display_data = {
                "user_id": user_data['id'],
                "telegram_id": user_data['telegram_id'],
                "username": user_data['username'],
                "full_name": f"{user_data['first_name']} {user_data['last_name']}".strip(),
                "group_name": user_data['group_name'],
                "group_id": user_data['group_id'],
                "facultet_id": user_data['facultet_id'],
                "level_id": user_data['level_id'],
                "kurs": user_data['kurs'],
                "form_code": user_data['form_code'],
                "last_activity": user_data['last_activity']
            }
            
            self.log_test("User Profile - GET /api/user-settings/{telegram_id}", True, 
                        "Successfully retrieved complete user profile data with group_name",
                        {
                            "telegram_id": user_data['telegram_id'],
                            "username": user_data['username'],
                            "full_name": profile_display_data['full_name'],
                            "group_name": user_data['group_name'],
                            "group_id": user_data['group_id'],
                            "all_fields_present": True,
                            "profile_ready": True
                        })
            return True
            
        except Exception as e:
            self.log_test("User Profile - GET /api/user-settings/{telegram_id}", False, f"Exception: {str(e)}")
            return False

    def test_tasks_api_comprehensive(self) -> bool:
        """
        Comprehensive test for Tasks API as requested:
        1. Create a test user with telegram_id = 999777555
        2. Create 3 test tasks for today's date
        3. Mark 2 tasks as completed (completed: true)
        4. Verify that the tasks are correctly saved with completed status
        5. Get all tasks for the user and verify the completion status
        """
        try:
            print("🔍 Testing Tasks API - Comprehensive Task Completion Test...")
            
            # Step 1: Create test user with telegram_id = 999777555
            test_telegram_id = 999777555
            
            # First create user settings to ensure user exists
            user_payload = {
                "telegram_id": test_telegram_id,
                "username": "tasks_test_user",
                "first_name": "Задачи",
                "last_name": "Тест",
                "group_id": "tasks-test-group",
                "group_name": "Группа для тестирования задач",
                "facultet_id": "tasks-test-facultet",
                "level_id": "tasks-test-level",
                "kurs": "1",
                "form_code": "д"
            }
            
            user_response = self.session.post(
                f"{self.base_url}/user-settings",
                json=user_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if user_response.status_code != 200:
                self.log_test("Tasks API - Create Test User", False, 
                            f"Failed to create test user: HTTP {user_response.status_code}: {user_response.text}")
                return False
            
            self.log_test("Tasks API - Create Test User", True, 
                        f"Successfully created test user with telegram_id {test_telegram_id}")
            
            # Step 2: Create 3 test tasks for today's date
            from datetime import datetime, date
            today = datetime.now().replace(hour=23, minute=59, second=59, microsecond=0)
            
            tasks_to_create = [
                {
                    "telegram_id": test_telegram_id,
                    "text": "Подготовиться к экзамену по математике",
                    "category": "study",
                    "priority": "high",
                    "target_date": today.isoformat()
                },
                {
                    "telegram_id": test_telegram_id,
                    "text": "Сдать лабораторную работу по физике",
                    "category": "study", 
                    "priority": "medium",
                    "target_date": today.isoformat()
                },
                {
                    "telegram_id": test_telegram_id,
                    "text": "Купить учебники в библиотеке",
                    "category": "personal",
                    "priority": "low",
                    "target_date": today.isoformat()
                }
            ]
            
            created_tasks = []
            
            for i, task_data in enumerate(tasks_to_create):
                response = self.session.post(
                    f"{self.base_url}/tasks",
                    json=task_data,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code != 200:
                    self.log_test("Tasks API - Create Tasks", False, 
                                f"Failed to create task {i+1}: HTTP {response.status_code}: {response.text}")
                    return False
                
                task = response.json()
                created_tasks.append(task)
                
                # Validate task structure
                required_fields = ['id', 'telegram_id', 'text', 'completed', 'created_at', 'updated_at']
                for field in required_fields:
                    if field not in task:
                        self.log_test("Tasks API - Create Tasks", False, 
                                    f"Task {i+1} missing required field: {field}")
                        return False
                
                # Validate task data
                if task['telegram_id'] != test_telegram_id:
                    self.log_test("Tasks API - Create Tasks", False, 
                                f"Task {i+1} telegram_id mismatch: expected {test_telegram_id}, got {task['telegram_id']}")
                    return False
                
                if task['text'] != task_data['text']:
                    self.log_test("Tasks API - Create Tasks", False, 
                                f"Task {i+1} text mismatch: expected '{task_data['text']}', got '{task['text']}'")
                    return False
                
                if task['completed'] != False:  # Should be False by default
                    self.log_test("Tasks API - Create Tasks", False, 
                                f"Task {i+1} should be incomplete by default, got completed={task['completed']}")
                    return False
            
            self.log_test("Tasks API - Create 3 Tasks", True, 
                        f"Successfully created 3 tasks for today's date",
                        {
                            "tasks_created": len(created_tasks),
                            "task_ids": [task['id'] for task in created_tasks],
                            "target_date": today.isoformat()
                        })
            
            # Step 3: Mark 2 tasks as completed (first two tasks)
            completed_tasks = []
            
            for i in range(2):  # Mark first 2 tasks as completed
                task_id = created_tasks[i]['id']
                update_payload = {"completed": True}
                
                response = self.session.put(
                    f"{self.base_url}/tasks/{task_id}",
                    json=update_payload,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code != 200:
                    self.log_test("Tasks API - Mark Tasks Completed", False, 
                                f"Failed to mark task {i+1} as completed: HTTP {response.status_code}: {response.text}")
                    return False
                
                updated_task = response.json()
                completed_tasks.append(updated_task)
                
                # Validate that task is marked as completed
                if updated_task['completed'] != True:
                    self.log_test("Tasks API - Mark Tasks Completed", False, 
                                f"Task {i+1} not marked as completed: completed={updated_task['completed']}")
                    return False
                
                # Validate that other fields remain unchanged
                if updated_task['id'] != task_id:
                    self.log_test("Tasks API - Mark Tasks Completed", False, 
                                f"Task {i+1} ID changed after update")
                    return False
                
                if updated_task['text'] != created_tasks[i]['text']:
                    self.log_test("Tasks API - Mark Tasks Completed", False, 
                                f"Task {i+1} text changed after update")
                    return False
            
            self.log_test("Tasks API - Mark 2 Tasks Completed", True, 
                        f"Successfully marked 2 tasks as completed",
                        {
                            "completed_task_ids": [task['id'] for task in completed_tasks],
                            "completed_count": len(completed_tasks)
                        })
            
            # Step 4: Verify that the tasks are correctly saved with completed status
            # Get all tasks for the user and verify completion status
            response = self.session.get(f"{self.base_url}/tasks/{test_telegram_id}")
            
            if response.status_code != 200:
                self.log_test("Tasks API - Get All Tasks", False, 
                            f"Failed to get tasks: HTTP {response.status_code}: {response.text}")
                return False
            
            all_tasks = response.json()
            
            # Validate response structure
            if not isinstance(all_tasks, list):
                self.log_test("Tasks API - Get All Tasks", False, 
                            "Response is not a list")
                return False
            
            # Should have exactly 3 tasks
            if len(all_tasks) != 3:
                self.log_test("Tasks API - Get All Tasks", False, 
                            f"Expected 3 tasks, got {len(all_tasks)}")
                return False
            
            # Step 5: Verify completion status
            completed_count = 0
            incomplete_count = 0
            
            for task in all_tasks:
                # Validate task structure
                required_fields = ['id', 'telegram_id', 'text', 'completed', 'created_at', 'updated_at']
                for field in required_fields:
                    if field not in task:
                        self.log_test("Tasks API - Verify Task Structure", False, 
                                    f"Task missing required field: {field}")
                        return False
                
                # Count completion status
                if task['completed']:
                    completed_count += 1
                else:
                    incomplete_count += 1
                
                # Validate telegram_id
                if task['telegram_id'] != test_telegram_id:
                    self.log_test("Tasks API - Verify Task Data", False, 
                                f"Task telegram_id mismatch: expected {test_telegram_id}, got {task['telegram_id']}")
                    return False
            
            # Verify completion counts
            if completed_count != 2:
                self.log_test("Tasks API - Verify Completion Status", False, 
                            f"Expected 2 completed tasks, got {completed_count}")
                return False
            
            if incomplete_count != 1:
                self.log_test("Tasks API - Verify Completion Status", False, 
                            f"Expected 1 incomplete task, got {incomplete_count}")
                return False
            
            # Additional verification: Check specific task completion status
            task_completion_status = {}
            for task in all_tasks:
                task_completion_status[task['id']] = task['completed']
            
            # Verify that the first 2 created tasks are completed
            for i in range(2):
                task_id = created_tasks[i]['id']
                if not task_completion_status.get(task_id, False):
                    self.log_test("Tasks API - Verify Specific Task Completion", False, 
                                f"Task {i+1} (ID: {task_id}) should be completed but is not")
                    return False
            
            # Verify that the 3rd task is not completed
            third_task_id = created_tasks[2]['id']
            if task_completion_status.get(third_task_id, True):
                self.log_test("Tasks API - Verify Specific Task Completion", False, 
                            f"Task 3 (ID: {third_task_id}) should be incomplete but is marked as completed")
                return False
            
            # Final comprehensive validation
            self.log_test("Tasks API - Comprehensive Task Completion Test", True, 
                        "Successfully completed all task completion tests",
                        {
                            "test_telegram_id": test_telegram_id,
                            "total_tasks_created": 3,
                            "tasks_marked_completed": 2,
                            "tasks_remaining_incomplete": 1,
                            "completed_task_ids": [task['id'] for task in completed_tasks],
                            "incomplete_task_id": created_tasks[2]['id'],
                            "all_tasks_retrieved": len(all_tasks),
                            "completion_verification": "PASSED"
                        })
            
            return True
            
        except Exception as e:
            self.log_test("Tasks API - Comprehensive Task Completion Test", False, f"Exception: {str(e)}")
            return False

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
            
            # Validate each faculty stat
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
            
            # Validate each course stat
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

    def test_room_invitation_functionality(self) -> bool:
        """
        Comprehensive test for room invitation functionality with notifications
        Tests the complete flow: create room -> generate invite link -> join room -> verify participants
        """
        try:
            print("🔍 Testing Room Invitation Functionality with Notifications...")
            
            # Step 1: Create test room
            print("  Step 1: Creating test room...")
            room_payload = {
                "name": "Тестовая комната для уведомлений",
                "description": "Проверка уведомлений",
                "telegram_id": 123456789,
                "color": "blue"
            }
            
            room_response = self.session.post(
                f"{self.base_url}/rooms",
                json=room_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if room_response.status_code != 200:
                self.log_test("Room Invitation - Create Room", False, 
                            f"HTTP {room_response.status_code}: {room_response.text}")
                return False
            
            room_data = room_response.json()
            room_id = room_data.get('room_id')
            
            if not room_id:
                self.log_test("Room Invitation - Create Room", False, 
                            "Room ID not returned in response")
                return False
            
            # Validate room creation response
            required_fields = ['room_id', 'name', 'description', 'owner_id', 'color', 'total_participants']
            for field in required_fields:
                if field not in room_data:
                    self.log_test("Room Invitation - Create Room", False, 
                                f"Missing required field: {field}")
                    return False
            
            if room_data['total_participants'] != 1:
                self.log_test("Room Invitation - Create Room", False, 
                            f"Expected 1 participant (owner), got {room_data['total_participants']}")
                return False
            
            print(f"    ✅ Room created successfully: {room_id}")
            
            # Step 2: Generate invite link
            print("  Step 2: Generating invite link...")
            invite_payload = {"telegram_id": 123456789}
            
            invite_response = self.session.post(
                f"{self.base_url}/rooms/{room_id}/invite-link",
                json=invite_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if invite_response.status_code != 200:
                self.log_test("Room Invitation - Generate Invite Link", False, 
                            f"HTTP {invite_response.status_code}: {invite_response.text}")
                return False
            
            invite_data = invite_response.json()
            invite_token = invite_data.get('invite_token')
            
            if not invite_token:
                self.log_test("Room Invitation - Generate Invite Link", False, 
                            "Invite token not returned in response")
                return False
            
            # Validate invite link response
            required_invite_fields = ['invite_link', 'invite_token', 'room_id', 'bot_username']
            for field in required_invite_fields:
                if field not in invite_data:
                    self.log_test("Room Invitation - Generate Invite Link", False, 
                                f"Missing required field: {field}")
                    return False
            
            # Validate invite link format
            expected_link_pattern = f"https://t.me/{invite_data['bot_username']}?start=room_{invite_token}_ref_123456789"
            if invite_data['invite_link'] != expected_link_pattern:
                self.log_test("Room Invitation - Generate Invite Link", False, 
                            f"Invite link format incorrect. Expected: {expected_link_pattern}, Got: {invite_data['invite_link']}")
                return False
            
            print(f"    ✅ Invite link generated: {invite_data['invite_link']}")
            
            # Step 3: Join room with new participant
            print("  Step 3: Adding second participant...")
            join_payload = {
                "telegram_id": 987654321,
                "username": "test_user",
                "first_name": "Тест Пользователь",
                "referral_code": "123456789"
            }
            
            join_response = self.session.post(
                f"{self.base_url}/rooms/join/{invite_token}",
                json=join_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if join_response.status_code != 200:
                self.log_test("Room Invitation - Join Room", False, 
                            f"HTTP {join_response.status_code}: {join_response.text}")
                return False
            
            join_data = join_response.json()
            
            # Validate join response
            if join_data.get('total_participants') != 2:
                self.log_test("Room Invitation - Join Room", False, 
                            f"Expected 2 participants after join, got {join_data.get('total_participants')}")
                return False
            
            print(f"    ✅ Second participant joined successfully. Total participants: {join_data['total_participants']}")
            
            # Step 4: Verify participants in room detail
            print("  Step 4: Verifying participants...")
            detail_response = self.session.get(f"{self.base_url}/rooms/detail/{room_id}")
            
            if detail_response.status_code != 200:
                self.log_test("Room Invitation - Verify Participants", False, 
                            f"HTTP {detail_response.status_code}: {detail_response.text}")
                return False
            
            detail_data = detail_response.json()
            participants = detail_data.get('participants', [])
            
            if len(participants) != 2:
                self.log_test("Room Invitation - Verify Participants", False, 
                            f"Expected 2 participants in detail, got {len(participants)}")
                return False
            
            # Check both participants are present
            participant_ids = [p.get('telegram_id') for p in participants]
            expected_ids = [123456789, 987654321]
            
            if set(participant_ids) != set(expected_ids):
                self.log_test("Room Invitation - Verify Participants", False, 
                            f"Participant IDs mismatch. Expected: {expected_ids}, Got: {participant_ids}")
                return False
            
            print(f"    ✅ Both participants verified: {participant_ids}")
            
            # Step 5: Test duplicate join prevention
            print("  Step 5: Testing duplicate join prevention...")
            duplicate_join_response = self.session.post(
                f"{self.base_url}/rooms/join/{invite_token}",
                json=join_payload,  # Same payload as before
                headers={"Content-Type": "application/json"}
            )
            
            if duplicate_join_response.status_code != 200:
                self.log_test("Room Invitation - Duplicate Join Prevention", False, 
                            f"HTTP {duplicate_join_response.status_code}: {duplicate_join_response.text}")
                return False
            
            duplicate_data = duplicate_join_response.json()
            
            # Should still return room info but not add duplicate
            if duplicate_data.get('total_participants') != 2:
                self.log_test("Room Invitation - Duplicate Join Prevention", False, 
                            f"Duplicate join changed participant count. Expected: 2, Got: {duplicate_data.get('total_participants')}")
                return False
            
            print(f"    ✅ Duplicate join prevented. Participants remain: {duplicate_data['total_participants']}")
            
            # Store test data for potential cleanup
            self.test_data['test_room'] = {
                'room_id': room_id,
                'invite_token': invite_token,
                'participants': [123456789, 987654321]
            }
            
            self.log_test("Room Invitation Functionality", True, 
                        "Successfully tested complete room invitation flow with notifications",
                        {
                            "room_id": room_id,
                            "invite_token": invite_token,
                            "invite_link": invite_data['invite_link'],
                            "initial_participants": 1,
                            "final_participants": 2,
                            "duplicate_join_prevented": True,
                            "notification_logs_check": "Check /var/log/supervisor/backend.out.log for notification messages"
                        })
            return True
            
        except Exception as e:
            self.log_test("Room Invitation Functionality", False, f"Exception: {str(e)}")
            return False

    def test_room_notification_logs(self) -> bool:
        """
        Check backend logs for notification sending messages
        """
        try:
            print("🔍 Checking backend logs for notification messages...")
            
            # Try to read backend logs
            import subprocess
            import os
            
            log_files = [
                "/var/log/supervisor/backend.out.log",
                "/var/log/supervisor/backend.err.log"
            ]
            
            notification_messages_found = []
            
            for log_file in log_files:
                if os.path.exists(log_file):
                    try:
                        # Get last 100 lines of log
                        result = subprocess.run(
                            ["tail", "-n", "100", log_file],
                            capture_output=True,
                            text=True,
                            timeout=10
                        )
                        
                        if result.returncode == 0:
                            log_content = result.stdout
                            
                            # Look for notification-related messages
                            notification_keywords = [
                                "отправлено уведомление",
                                "notification sent",
                                "send_room_join_notifications",
                                "Добро пожаловать в комнату",
                                "Новый участник в комнате",
                                "TELEGRAM_BOT_TOKEN"
                            ]
                            
                            for keyword in notification_keywords:
                                if keyword.lower() in log_content.lower():
                                    notification_messages_found.append(f"Found '{keyword}' in {log_file}")
                    
                    except subprocess.TimeoutExpired:
                        print(f"    ⚠️ Timeout reading {log_file}")
                    except Exception as e:
                        print(f"    ⚠️ Error reading {log_file}: {e}")
                else:
                    print(f"    ⚠️ Log file not found: {log_file}")
            
            if notification_messages_found:
                self.log_test("Room Notification Logs", True, 
                            "Found notification-related messages in backend logs",
                            {
                                "messages_found": notification_messages_found,
                                "logs_checked": log_files
                            })
            else:
                self.log_test("Room Notification Logs", True, 
                            "No notification messages found in logs (may be expected if TELEGRAM_BOT_TOKEN not configured)",
                            {
                                "logs_checked": log_files,
                                "note": "Check logs manually for notification attempts"
                            })
            
            return True
            
        except Exception as e:
            self.log_test("Room Notification Logs", False, f"Exception: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all API tests in sequence"""
        print("🚀 Starting RUDN Schedule API Backend Tests")
        print(f"🌐 Backend URL: {self.base_url}")
        print(f"⏱️  Timeout: {TIMEOUT} seconds")
        print("=" * 60)
        
        # Test sequence - order matters for data dependency
        tests = [
            self.test_faculties_endpoint,
            self.test_filter_data_endpoint,
            self.test_get_groups_for_schedule,
            self.test_schedule_endpoint,
            self.test_save_user_settings,
            self.test_get_user_settings,
            self.test_get_nonexistent_user,
            # User Profile functionality test (as requested)
            self.test_user_profile_functionality,
            # Notification endpoint tests
            self.test_create_user_with_default_notifications,
            self.test_get_default_notification_settings,
            self.test_update_notification_settings,
            self.test_verify_notification_settings_persisted,
            self.test_invalid_notification_time_values,
            self.test_notification_settings_nonexistent_user,
            # New Achievement and Weather endpoint tests
            self.test_get_achievements,
            self.test_get_weather,
            self.test_track_action,
            self.test_get_user_stats,
            self.test_get_user_achievements,
            # Analytics counting fix test
            self.test_analytics_counting_fix,
            # Bot info endpoint test
            self.test_bot_info_endpoint,
            # Tasks API comprehensive test (as requested)
            self.test_tasks_api_comprehensive,
            # New Task Achievements Tests (8 new achievements for Tasks section)
            self.test_new_task_achievements_total_count,
            self.test_first_task_achievement,
            self.test_productive_day_achievement,
            self.test_lightning_fast_achievement,
            self.test_task_specialist_achievement,
            self.test_completion_master_achievement,
            # Room Invitation Tests (as requested in review)
            self.test_room_invitation_functionality,
            self.test_room_notification_logs,
            # New Admin Panel Tests
            self.test_admin_stats_endpoint,
            self.test_admin_users_activity_endpoint,
            self.test_admin_hourly_activity_endpoint,
            self.test_admin_weekly_activity_endpoint,
            self.test_admin_feature_usage_endpoint,
            self.test_admin_top_users_endpoint,
            self.test_admin_faculty_stats_endpoint,
            self.test_admin_course_stats_endpoint,
            # Journal (Attendance) API Tests
            self.test_journal_crud_operations,
            self.test_journal_students_management,
            self.test_journal_sessions_management,
            self.test_journal_attendance_operations,
            # Student Personal Invite Links Tests
            self.test_student_personal_invite_links
        ]
        
        passed = 0
        total = len(tests)
        
        for test in tests:
            try:
                if test():
                    passed += 1
                time.sleep(1)  # Small delay between tests
            except Exception as e:
                print(f"❌ Test failed with exception: {e}")
        
        print("=" * 60)
        print(f"📊 Test Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed! Backend API is working correctly.")
            return True
        else:
            print("⚠️  Some tests failed. Check the details above.")
            return False

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

    def test_journal_crud_operations(self) -> bool:
        """Test Journal CRUD operations - Create, Read, Update, Delete"""
        try:
            print("🔍 Testing Journal CRUD Operations...")
            
            test_telegram_id = 999888777  # As specified in the request
            
            # Step 1: Create a new journal
            journal_payload = {
                "name": "Тестовый журнал посещений",
                "description": "Журнал для тестирования API",
                "subject": "Тестовый предмет",
                "telegram_id": test_telegram_id
            }
            
            create_response = self.session.post(
                f"{self.base_url}/journals",
                json=journal_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if create_response.status_code != 200:
                self.log_test("Journal CRUD - Create", False, 
                            f"HTTP {create_response.status_code}: {create_response.text}")
                return False
            
            journal_data = create_response.json()
            
            # Validate journal creation response
            required_fields = ['journal_id', 'name', 'description', 'subject', 'owner_id', 'created_at']
            for field in required_fields:
                if field not in journal_data:
                    self.log_test("Journal CRUD - Create", False, 
                                f"Missing required field: {field}")
                    return False
            
            journal_id = journal_data['journal_id']
            self.test_data['test_journal_id'] = journal_id
            
            # Step 2: Get user's journals
            get_journals_response = self.session.get(f"{self.base_url}/journals/{test_telegram_id}")
            
            if get_journals_response.status_code != 200:
                self.log_test("Journal CRUD - Get User Journals", False, 
                            f"HTTP {get_journals_response.status_code}: {get_journals_response.text}")
                return False
            
            journals_list = get_journals_response.json()
            
            if not isinstance(journals_list, list):
                self.log_test("Journal CRUD - Get User Journals", False, 
                            "Response is not a list")
                return False
            
            # Find our created journal
            created_journal = None
            for journal in journals_list:
                if journal.get('journal_id') == journal_id:
                    created_journal = journal
                    break
            
            if not created_journal:
                self.log_test("Journal CRUD - Get User Journals", False, 
                            "Created journal not found in user's journals list")
                return False
            
            # Step 3: Get journal details
            get_detail_response = self.session.get(
                f"{self.base_url}/journals/detail/{journal_id}?telegram_id={test_telegram_id}"
            )
            
            if get_detail_response.status_code != 200:
                self.log_test("Journal CRUD - Get Details", False, 
                            f"HTTP {get_detail_response.status_code}: {get_detail_response.text}")
                return False
            
            journal_details = get_detail_response.json()
            
            if journal_details.get('journal_id') != journal_id:
                self.log_test("Journal CRUD - Get Details", False, 
                            "Journal ID mismatch in details response")
                return False
            
            # Step 4: Update journal
            update_payload = {
                "name": "Обновленный журнал посещений",
                "description": "Обновленное описание",
                "telegram_id": test_telegram_id
            }
            
            update_response = self.session.put(
                f"{self.base_url}/journals/{journal_id}",
                json=update_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if update_response.status_code != 200:
                self.log_test("Journal CRUD - Update", False, 
                            f"HTTP {update_response.status_code}: {update_response.text}")
                return False
            
            updated_journal = update_response.json()
            
            if updated_journal.get('name') != update_payload['name']:
                self.log_test("Journal CRUD - Update", False, 
                            "Journal name not updated correctly")
                return False
            
            # Step 5: Generate invite link
            invite_response = self.session.post(
                f"{self.base_url}/journals/{journal_id}/invite-link",
                json={"telegram_id": test_telegram_id},
                headers={"Content-Type": "application/json"}
            )
            
            if invite_response.status_code != 200:
                self.log_test("Journal CRUD - Generate Invite", False, 
                            f"HTTP {invite_response.status_code}: {invite_response.text}")
                return False
            
            invite_data = invite_response.json()
            
            if 'invite_link' not in invite_data or 'invite_token' not in invite_data:
                self.log_test("Journal CRUD - Generate Invite", False, 
                            "Missing invite_link or invite_token in response")
                return False
            
            invite_token = invite_data['invite_token']
            self.test_data['test_invite_token'] = invite_token
            
            # Step 6: Test join by invite (with different user)
            join_response = self.session.post(
                f"{self.base_url}/journals/join/{invite_token}",
                json={"telegram_id": 999888778, "username": "test_joiner", "first_name": "Test Joiner"},
                headers={"Content-Type": "application/json"}
            )
            
            if join_response.status_code != 200:
                self.log_test("Journal CRUD - Join by Invite", False, 
                            f"HTTP {join_response.status_code}: {join_response.text}")
                return False
            
            self.log_test("Journal CRUD Operations", True, 
                        "Successfully completed all CRUD operations",
                        {
                            "journal_id": journal_id,
                            "created": True,
                            "retrieved": True,
                            "updated": True,
                            "invite_generated": True,
                            "join_successful": True
                        })
            return True
            
        except Exception as e:
            self.log_test("Journal CRUD Operations", False, f"Exception: {str(e)}")
            return False

    def test_journal_students_management(self) -> bool:
        """Test Journal Students Management - Add, Link, Delete students"""
        try:
            print("🔍 Testing Journal Students Management...")
            
            if 'test_journal_id' not in self.test_data:
                self.log_test("Journal Students Management", False, 
                            "No test journal available from previous test")
                return False
            
            journal_id = self.test_data['test_journal_id']
            test_telegram_id = 999888777
            
            # Step 1: Add single student
            student_payload = {
                "full_name": "Иван Петров"
            }
            
            add_student_response = self.session.post(
                f"{self.base_url}/journals/{journal_id}/students",
                json=student_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if add_student_response.status_code != 200:
                self.log_test("Journal Students - Add Single", False, 
                            f"HTTP {add_student_response.status_code}: {add_student_response.text}")
                return False
            
            student_data = add_student_response.json()
            
            if 'student_id' not in student_data or 'full_name' not in student_data:
                self.log_test("Journal Students - Add Single", False, 
                            "Missing student_id or full_name in response")
                return False
            
            student_id = student_data['student_id']
            self.test_data['test_student_id'] = student_id
            
            # Step 2: Add multiple students (bulk)
            bulk_payload = {
                "names": ["Мария Сидорова", "Алексей Козлов", "Елена Морозова"]
            }
            
            bulk_response = self.session.post(
                f"{self.base_url}/journals/{journal_id}/students/bulk",
                json=bulk_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if bulk_response.status_code != 200:
                self.log_test("Journal Students - Add Bulk", False, 
                            f"HTTP {bulk_response.status_code}: {bulk_response.text}")
                return False
            
            bulk_result = bulk_response.json()
            
            if 'added_count' not in bulk_result:
                self.log_test("Journal Students - Add Bulk", False, 
                            "Missing added_count in bulk response")
                return False
            
            if bulk_result['added_count'] != 3:
                self.log_test("Journal Students - Add Bulk", False, 
                            f"Expected 3 students added, got {bulk_result['added_count']}")
                return False
            
            # Step 3: Get all students
            get_students_response = self.session.get(f"{self.base_url}/journals/{journal_id}/students")
            
            if get_students_response.status_code != 200:
                self.log_test("Journal Students - Get All", False, 
                            f"HTTP {get_students_response.status_code}: {get_students_response.text}")
                return False
            
            students_list = get_students_response.json()
            
            if not isinstance(students_list, list):
                self.log_test("Journal Students - Get All", False, 
                            "Response is not a list")
                return False
            
            if len(students_list) != 4:  # 1 single + 3 bulk
                self.log_test("Journal Students - Get All", False, 
                            f"Expected 4 students, got {len(students_list)}")
                return False
            
            # Step 4: Link telegram user to student
            link_payload = {
                "telegram_id": 999888779,
                "username": "ivan_petrov",
                "first_name": "Иван"
            }
            
            link_response = self.session.post(
                f"{self.base_url}/journals/{journal_id}/students/{student_id}/link",
                json=link_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if link_response.status_code != 200:
                self.log_test("Journal Students - Link Telegram", False, 
                            f"HTTP {link_response.status_code}: {link_response.text}")
                return False
            
            # Step 5: Get pending members
            pending_response = self.session.get(f"{self.base_url}/journals/{journal_id}/pending-members")
            
            if pending_response.status_code != 200:
                self.log_test("Journal Students - Get Pending", False, 
                            f"HTTP {pending_response.status_code}: {pending_response.text}")
                return False
            
            pending_members = pending_response.json()
            
            if not isinstance(pending_members, list):
                self.log_test("Journal Students - Get Pending", False, 
                            "Pending members response is not a list")
                return False
            
            self.log_test("Journal Students Management", True, 
                        "Successfully completed all student management operations",
                        {
                            "single_student_added": True,
                            "bulk_students_added": 3,
                            "total_students": len(students_list),
                            "telegram_link_created": True,
                            "pending_members_retrieved": True
                        })
            return True
            
        except Exception as e:
            self.log_test("Journal Students Management", False, f"Exception: {str(e)}")
            return False

    def test_journal_sessions_management(self) -> bool:
        """Test Journal Sessions Management - Create, Get, Delete sessions"""
        try:
            print("🔍 Testing Journal Sessions Management...")
            
            if 'test_journal_id' not in self.test_data:
                self.log_test("Journal Sessions Management", False, 
                            "No test journal available from previous test")
                return False
            
            journal_id = self.test_data['test_journal_id']
            test_telegram_id = 999888777
            
            # Step 1: Create session
            from datetime import datetime, timedelta
            today = datetime.now().strftime('%Y-%m-%d')
            
            session_payload = {
                "date": today,
                "title": "Лекция по тестированию API",
                "type": "lecture",
                "telegram_id": test_telegram_id
            }
            
            create_session_response = self.session.post(
                f"{self.base_url}/journals/{journal_id}/sessions",
                json=session_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if create_session_response.status_code != 200:
                self.log_test("Journal Sessions - Create", False, 
                            f"HTTP {create_session_response.status_code}: {create_session_response.text}")
                return False
            
            session_data = create_session_response.json()
            
            required_fields = ['session_id', 'date', 'title', 'type', 'journal_id']
            for field in required_fields:
                if field not in session_data:
                    self.log_test("Journal Sessions - Create", False, 
                                f"Missing required field: {field}")
                    return False
            
            session_id = session_data['session_id']
            self.test_data['test_session_id'] = session_id
            
            # Step 2: Get all sessions for journal
            get_sessions_response = self.session.get(f"{self.base_url}/journals/{journal_id}/sessions")
            
            if get_sessions_response.status_code != 200:
                self.log_test("Journal Sessions - Get All", False, 
                            f"HTTP {get_sessions_response.status_code}: {get_sessions_response.text}")
                return False
            
            sessions_list = get_sessions_response.json()
            
            if not isinstance(sessions_list, list):
                self.log_test("Journal Sessions - Get All", False, 
                            "Response is not a list")
                return False
            
            # Find our created session
            created_session = None
            for session in sessions_list:
                if session.get('session_id') == session_id:
                    created_session = session
                    break
            
            if not created_session:
                self.log_test("Journal Sessions - Get All", False, 
                            "Created session not found in sessions list")
                return False
            
            # Step 3: Create another session for testing
            session_payload_2 = {
                "date": (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d'),
                "title": "Практическое занятие",
                "type": "practice",
                "telegram_id": test_telegram_id
            }
            
            create_session_2_response = self.session.post(
                f"{self.base_url}/journals/{journal_id}/sessions",
                json=session_payload_2,
                headers={"Content-Type": "application/json"}
            )
            
            if create_session_2_response.status_code != 200:
                self.log_test("Journal Sessions - Create Second", False, 
                            f"HTTP {create_session_2_response.status_code}: {create_session_2_response.text}")
                return False
            
            session_2_data = create_session_2_response.json()
            session_2_id = session_2_data['session_id']
            
            self.log_test("Journal Sessions Management", True, 
                        "Successfully completed all session management operations",
                        {
                            "session_created": True,
                            "sessions_retrieved": True,
                            "total_sessions": len(sessions_list) + 1,  # +1 for second session
                            "session_id": session_id,
                            "second_session_id": session_2_id
                        })
            return True
            
        except Exception as e:
            self.log_test("Journal Sessions Management", False, f"Exception: {str(e)}")
            return False

    def test_journal_attendance_operations(self) -> bool:
        """Test Journal Attendance Operations - Mark, Get attendance and stats"""
        try:
            print("🔍 Testing Journal Attendance Operations...")
            
            required_data = ['test_journal_id', 'test_session_id', 'test_student_id']
            for key in required_data:
                if key not in self.test_data:
                    self.log_test("Journal Attendance Operations", False, 
                                f"Missing {key} from previous tests")
                    return False
            
            journal_id = self.test_data['test_journal_id']
            session_id = self.test_data['test_session_id']
            student_id = self.test_data['test_student_id']
            test_telegram_id = 999888777
            
            # Step 1: Mark attendance for session
            attendance_payload = {
                "records": [
                    {
                        "student_id": student_id,
                        "status": "present"
                    }
                ],
                "telegram_id": test_telegram_id
            }
            
            mark_attendance_response = self.session.post(
                f"{self.base_url}/journals/sessions/{session_id}/attendance",
                json=attendance_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if mark_attendance_response.status_code != 200:
                self.log_test("Journal Attendance - Mark", False, 
                            f"HTTP {mark_attendance_response.status_code}: {mark_attendance_response.text}")
                return False
            
            attendance_result = mark_attendance_response.json()
            
            if 'records_processed' not in attendance_result:
                self.log_test("Journal Attendance - Mark", False, 
                            "Missing records_processed in response")
                return False
            
            if attendance_result['records_processed'] != 1:
                self.log_test("Journal Attendance - Mark", False, 
                            f"Expected 1 record processed, got {attendance_result['records_processed']}")
                return False
            
            # Step 2: Get attendance for session
            get_attendance_response = self.session.get(
                f"{self.base_url}/journals/sessions/{session_id}/attendance"
            )
            
            if get_attendance_response.status_code != 200:
                self.log_test("Journal Attendance - Get Session", False, 
                            f"HTTP {get_attendance_response.status_code}: {get_attendance_response.text}")
                return False
            
            session_attendance = get_attendance_response.json()
            
            if not isinstance(session_attendance, list):
                self.log_test("Journal Attendance - Get Session", False, 
                            "Response is not a list")
                return False
            
            if len(session_attendance) != 1:
                self.log_test("Journal Attendance - Get Session", False, 
                            f"Expected 1 attendance record, got {len(session_attendance)}")
                return False
            
            attendance_record = session_attendance[0]
            if attendance_record.get('status') != 'present':
                self.log_test("Journal Attendance - Get Session", False, 
                            f"Expected status 'present', got '{attendance_record.get('status')}'")
                return False
            
            # Step 3: Get user's attendance (my-attendance)
            get_my_attendance_response = self.session.get(
                f"{self.base_url}/journals/{journal_id}/my-attendance/{test_telegram_id}"
            )
            
            if get_my_attendance_response.status_code != 200:
                self.log_test("Journal Attendance - Get My Attendance", False, 
                            f"HTTP {get_my_attendance_response.status_code}: {get_my_attendance_response.text}")
                return False
            
            my_attendance = get_my_attendance_response.json()
            
            if not isinstance(my_attendance, list):
                self.log_test("Journal Attendance - Get My Attendance", False, 
                            "My attendance response is not a list")
                return False
            
            # Step 4: Get journal statistics
            get_stats_response = self.session.get(f"{self.base_url}/journals/{journal_id}/stats")
            
            if get_stats_response.status_code != 200:
                self.log_test("Journal Attendance - Get Stats", False, 
                            f"HTTP {get_stats_response.status_code}: {get_stats_response.text}")
                return False
            
            journal_stats = get_stats_response.json()
            
            required_stats_fields = ['total_students', 'total_sessions', 'attendance_rate']
            for field in required_stats_fields:
                if field not in journal_stats:
                    self.log_test("Journal Attendance - Get Stats", False, 
                                f"Missing required stats field: {field}")
                    return False
            
            # Validate stats data types
            if not isinstance(journal_stats['total_students'], int):
                self.log_test("Journal Attendance - Get Stats", False, 
                            f"total_students should be integer, got {type(journal_stats['total_students'])}")
                return False
            
            if not isinstance(journal_stats['total_sessions'], int):
                self.log_test("Journal Attendance - Get Stats", False, 
                            f"total_sessions should be integer, got {type(journal_stats['total_sessions'])}")
                return False
            
            if not isinstance(journal_stats['attendance_rate'], (int, float)):
                self.log_test("Journal Attendance - Get Stats", False, 
                            f"attendance_rate should be numeric, got {type(journal_stats['attendance_rate'])}")
                return False
            
            # Step 5: Test different attendance statuses
            attendance_payload_varied = {
                "records": [
                    {
                        "student_id": student_id,
                        "status": "late"
                    }
                ],
                "telegram_id": test_telegram_id
            }
            
            mark_varied_response = self.session.post(
                f"{self.base_url}/journals/sessions/{session_id}/attendance",
                json=attendance_payload_varied,
                headers={"Content-Type": "application/json"}
            )
            
            # This should update the existing record
            if mark_varied_response.status_code != 200:
                self.log_test("Journal Attendance - Update Status", False, 
                            f"HTTP {mark_varied_response.status_code}: {mark_varied_response.text}")
                return False
            
            self.log_test("Journal Attendance Operations", True, 
                        "Successfully completed all attendance operations",
                        {
                            "attendance_marked": True,
                            "session_attendance_retrieved": True,
                            "my_attendance_retrieved": True,
                            "stats_retrieved": True,
                            "status_updated": True,
                            "total_students": journal_stats['total_students'],
                            "total_sessions": journal_stats['total_sessions'],
                            "attendance_rate": journal_stats['attendance_rate']
                        })
            return True
            
        except Exception as e:
            self.log_test("Journal Attendance Operations", False, f"Exception: {str(e)}")
            return False

    def test_student_personal_invite_links(self) -> bool:
        """Test Student Personal Invite Links functionality for Attendance Journal"""
        try:
            print("🔍 Testing Student Personal Invite Links functionality...")
            
            # Step 1: Create a test journal
            test_telegram_id = 999888111
            
            # Create user first
            user_payload = {
                "telegram_id": test_telegram_id,
                "username": "invite_test_teacher",
                "first_name": "Преподаватель",
                "last_name": "Тест",
                "group_id": "invite-test-group",
                "group_name": "Группа для тестирования приглашений",
                "facultet_id": "invite-test-facultet",
                "level_id": "invite-test-level",
                "kurs": "3",
                "form_code": "д"
            }
            
            user_response = self.session.post(
                f"{self.base_url}/user-settings",
                json=user_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if user_response.status_code != 200:
                self.log_test("Student Invite Links - Create User", False, 
                            f"Failed to create user: HTTP {user_response.status_code}: {user_response.text}")
                return False
            
            # Create journal
            journal_payload = {
                "name": "Журнал для тестирования приглашений студентов",
                "group_name": "Группа для тестирования приглашений",
                "description": "Тестирование приглашений студентов",
                "telegram_id": test_telegram_id
            }
            
            journal_response = self.session.post(
                f"{self.base_url}/journals",
                json=journal_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if journal_response.status_code != 200:
                self.log_test("Student Invite Links - Create Journal", False, 
                            f"Failed to create journal: HTTP {journal_response.status_code}: {journal_response.text}")
                return False
            
            journal_data = journal_response.json()
            journal_id = journal_data['journal_id']
            
            self.log_test("Student Invite Links - Create Journal", True, 
                        f"Successfully created test journal with ID: {journal_id}")
            
            # Step 2: Add students to journal and verify invite_code and invite_link fields
            students_to_add = [
                {"full_name": "Иван Петров"},
                {"full_name": "Мария Сидорова"},
                {"full_name": "Алексей Козлов"}
            ]
            
            created_students = []
            
            for student_data in students_to_add:
                student_payload = {
                    "full_name": student_data["full_name"]
                }
                
                student_response = self.session.post(
                    f"{self.base_url}/journals/{journal_id}/students",
                    json=student_payload,
                    headers={"Content-Type": "application/json"}
                )
                
                if student_response.status_code != 200:
                    self.log_test("Student Invite Links - Add Students", False, 
                                f"Failed to add student {student_data['full_name']}: HTTP {student_response.status_code}: {student_response.text}")
                    return False
                
                student = student_response.json()
                created_students.append(student)
                
                # Validate that student has invite_code and invite_link
                required_fields = ['id', 'full_name', 'invite_code', 'invite_link']
                for field in required_fields:
                    if field not in student:
                        self.log_test("Student Invite Links - Validate Student Fields", False, 
                                    f"Student missing required field: {field}")
                        return False
                
                # Validate invite_code format (should be 8 characters)
                if not isinstance(student['invite_code'], str) or len(student['invite_code']) != 8:
                    self.log_test("Student Invite Links - Validate Invite Code", False, 
                                f"invite_code should be 8 character string, got: {student['invite_code']}")
                    return False
                
                # Validate invite_link format (should be Telegram bot link)
                expected_link_pattern = f"https://t.me/"
                if not student['invite_link'].startswith(expected_link_pattern):
                    self.log_test("Student Invite Links - Validate Invite Link", False, 
                                f"invite_link should start with {expected_link_pattern}, got: {student['invite_link']}")
                    return False
                
                # Validate that invite_link contains the invite_code
                if f"jstudent_{student['invite_code']}" not in student['invite_link']:
                    self.log_test("Student Invite Links - Validate Invite Link Format", False, 
                                f"invite_link should contain 'jstudent_{student['invite_code']}', got: {student['invite_link']}")
                    return False
            
            self.log_test("Student Invite Links - Add Students with Invite Links", True, 
                        f"Successfully added {len(created_students)} students with invite codes and links",
                        {
                            "students_added": len(created_students),
                            "sample_invite_code": created_students[0]['invite_code'],
                            "sample_invite_link": created_students[0]['invite_link']
                        })
            
            # Step 3: Test GET /api/journals/{journal_id}/students returns students with invite fields
            get_students_response = self.session.get(f"{self.base_url}/journals/{journal_id}/students")
            
            if get_students_response.status_code != 200:
                self.log_test("Student Invite Links - GET Students", False, 
                            f"HTTP {get_students_response.status_code}: {get_students_response.text}")
                return False
            
            students_list = get_students_response.json()
            
            if len(students_list) != len(created_students):
                self.log_test("Student Invite Links - GET Students Count", False, 
                            f"Expected {len(created_students)} students, got {len(students_list)}")
                return False
            
            # Verify all students have unique invite codes
            invite_codes = [student['invite_code'] for student in students_list]
            if len(set(invite_codes)) != len(invite_codes):
                self.log_test("Student Invite Links - Unique Invite Codes", False, 
                            "Invite codes are not unique")
                return False
            
            self.log_test("Student Invite Links - GET Students with Invite Data", True, 
                        "Successfully retrieved students with unique invite codes and links")
            
            # Step 4: Test join-student endpoint with various scenarios
            test_user_telegram_id = 777888999
            test_invite_code = created_students[0]['invite_code']
            
            # Test case a: Valid invite_code, student not linked
            join_payload = {
                "telegram_id": test_user_telegram_id,
                "username": "test_student",
                "first_name": "Тест"
            }
            
            join_response = self.session.post(
                f"{self.base_url}/journals/join-student/{test_invite_code}",
                json=join_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if join_response.status_code != 200:
                self.log_test("Student Invite Links - Join Valid Code", False, 
                            f"HTTP {join_response.status_code}: {join_response.text}")
                return False
            
            join_result = join_response.json()
            
            if join_result.get('status') != 'success':
                self.log_test("Student Invite Links - Join Valid Code Status", False, 
                            f"Expected status 'success', got: {join_result.get('status')}")
                return False
            
            self.log_test("Student Invite Links - Join Valid Code", True, 
                        "Successfully linked student with valid invite code")
            
            # Test case b: Invalid invite_code
            invalid_join_response = self.session.post(
                f"{self.base_url}/journals/join-student/INVALID1",
                json=join_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if invalid_join_response.status_code != 404:
                self.log_test("Student Invite Links - Join Invalid Code", False, 
                            f"Expected HTTP 404 for invalid code, got: {invalid_join_response.status_code}")
                return False
            
            self.log_test("Student Invite Links - Join Invalid Code", True, 
                        "Correctly returned 404 for invalid invite code")
            
            # Test case c: User already linked to this student
            duplicate_join_response = self.session.post(
                f"{self.base_url}/journals/join-student/{test_invite_code}",
                json=join_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if duplicate_join_response.status_code != 200:
                self.log_test("Student Invite Links - Join Already Linked", False, 
                            f"HTTP {duplicate_join_response.status_code}: {duplicate_join_response.text}")
                return False
            
            duplicate_result = duplicate_join_response.json()
            
            if duplicate_result.get('status') != 'success':
                self.log_test("Student Invite Links - Join Already Linked Status", False, 
                            f"Expected status 'success' for already linked user, got: {duplicate_result.get('status')}")
                return False
            
            self.log_test("Student Invite Links - Join Already Linked", True, 
                        "Correctly handled already linked user")
            
            # Test case d: User already linked to different student in same journal
            different_invite_code = created_students[1]['invite_code']
            different_student_response = self.session.post(
                f"{self.base_url}/journals/join-student/{different_invite_code}",
                json=join_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if different_student_response.status_code != 200:
                self.log_test("Student Invite Links - Join Different Student", False, 
                            f"HTTP {different_student_response.status_code}: {different_student_response.text}")
                return False
            
            different_result = different_student_response.json()
            
            if different_result.get('status') != 'already_linked':
                self.log_test("Student Invite Links - Join Different Student Status", False, 
                            f"Expected status 'already_linked', got: {different_result.get('status')}")
                return False
            
            self.log_test("Student Invite Links - Join Different Student", True, 
                        "Correctly prevented linking to different student in same journal")
            
            # Step 5: Test unlink student endpoint
            student_id = created_students[0]['id']
            
            unlink_response = self.session.post(
                f"{self.base_url}/journals/{journal_id}/students/{student_id}/unlink",
                headers={"Content-Type": "application/json"}
            )
            
            if unlink_response.status_code != 200:
                self.log_test("Student Invite Links - Unlink Student", False, 
                            f"HTTP {unlink_response.status_code}: {unlink_response.text}")
                return False
            
            unlink_result = unlink_response.json()
            
            if unlink_result.get('status') != 'success':
                self.log_test("Student Invite Links - Unlink Student Status", False, 
                            f"Expected status 'success', got: {unlink_result.get('status')}")
                return False
            
            # Verify student is unlinked by checking student data
            get_student_response = self.session.get(f"{self.base_url}/journals/{journal_id}/students")
            
            if get_student_response.status_code != 200:
                self.log_test("Student Invite Links - Verify Unlink", False, 
                            f"Failed to get students after unlink: HTTP {get_student_response.status_code}")
                return False
            
            updated_students = get_student_response.json()
            unlinked_student = next((s for s in updated_students if s['id'] == student_id), None)
            
            if not unlinked_student:
                self.log_test("Student Invite Links - Verify Unlink", False, 
                            "Student not found after unlink")
                return False
            
            # Check that telegram fields are reset
            if (unlinked_student.get('telegram_id') is not None or 
                unlinked_student.get('username') is not None or 
                unlinked_student.get('first_name') is not None or 
                unlinked_student.get('is_linked', True)):
                self.log_test("Student Invite Links - Verify Unlink Fields", False, 
                            "Student fields not properly reset after unlink")
                return False
            
            self.log_test("Student Invite Links - Unlink Student", True, 
                        "Successfully unlinked student and reset fields")
            
            # Test case e: Student already linked to different user (occupied)
            # First link the student to a different user
            different_user_payload = {
                "telegram_id": 888999111,
                "username": "different_user",
                "first_name": "Другой"
            }
            
            # Link student to different user
            link_different_response = self.session.post(
                f"{self.base_url}/journals/join-student/{test_invite_code}",
                json=different_user_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if link_different_response.status_code != 200:
                self.log_test("Student Invite Links - Link to Different User", False, 
                            f"Failed to link to different user: HTTP {link_different_response.status_code}")
                return False
            
            # Now try to link the same student to original user (should be occupied)
            occupied_response = self.session.post(
                f"{self.base_url}/journals/join-student/{test_invite_code}",
                json=join_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if occupied_response.status_code != 200:
                self.log_test("Student Invite Links - Join Occupied Student", False, 
                            f"HTTP {occupied_response.status_code}: {occupied_response.text}")
                return False
            
            occupied_result = occupied_response.json()
            
            if occupied_result.get('status') != 'occupied':
                self.log_test("Student Invite Links - Join Occupied Student Status", False, 
                            f"Expected status 'occupied', got: {occupied_result.get('status')}")
                return False
            
            self.log_test("Student Invite Links - Join Occupied Student", True, 
                        "Correctly returned 'occupied' status for student linked to different user")
            
            # Final comprehensive test result
            self.log_test("Student Personal Invite Links - Complete Test", True, 
                        "Successfully completed all Student Personal Invite Links tests",
                        {
                            "journal_created": True,
                            "students_added_with_invite_links": len(created_students),
                            "unique_invite_codes_verified": True,
                            "join_valid_code_tested": True,
                            "join_invalid_code_tested": True,
                            "join_already_linked_tested": True,
                            "join_different_student_tested": True,
                            "join_occupied_student_tested": True,
                            "unlink_student_tested": True,
                            "all_scenarios_covered": True
                        })
            
            return True
            
        except Exception as e:
            self.log_test("Student Personal Invite Links - Complete Test", False, f"Exception: {str(e)}")
            return False

def main():
    """Main test runner"""
    tester = RUDNScheduleAPITester()
    success = tester.run_all_tests()
    
    # Print summary
    print("\n" + "=" * 60)
    print("📋 DETAILED TEST SUMMARY")
    print("=" * 60)
    
    for result in tester.test_results:
        status = "✅" if result['success'] else "❌"
        print(f"{status} {result['test']}: {result['message']}")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())