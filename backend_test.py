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
BACKEND_URL = "https://project-review-25.preview.emergentagent.com/api"
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
            if bot_info['username'] != "rudn_pro_bot":
                self.log_test("GET /api/bot-info", False, 
                            f"Expected username='rudn_pro_bot', got '{bot_info['username']}'")
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
            self.test_bot_info_endpoint
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