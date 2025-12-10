#!/usr/bin/env python3
"""
Admin Endpoints Test Suite
Tests the specific admin endpoints mentioned in the review request:
1. GET /api/admin/stats - general statistics (already tested, retest for verification)
2. GET /api/admin/referral-stats - referral statistics 
3. GET /api/admin/users - list of users for admin panel
4. GET /api/admin/journals - list of journals for admin panel

Note: DB might be empty so empty lists are expected.
"""

import requests
import json
from datetime import datetime
from typing import Dict, Any, List

# Backend URL
BASE_URL = "http://localhost:8001/api"

class AdminEndpointsTestSuite:
    def __init__(self):
        self.session = requests.Session()
        
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
            
    def test_admin_stats_endpoint(self):
        """Test GET /api/admin/stats endpoint"""
        self.log("=" * 60)
        self.log("TESTING GET /api/admin/stats")
        self.log("=" * 60)
        
        try:
            # Test without parameters
            response = self.make_request("GET", "/admin/stats")
            if response.status_code != 200:
                raise Exception(f"Failed to get admin stats: {response.status_code} - {response.text}")
                
            stats = response.json()
            self.log(f"✅ Admin stats retrieved successfully")
            
            # Verify required fields exist
            required_fields = [
                'total_users', 'active_users_today', 'active_users_week', 'active_users_month',
                'new_users_today', 'new_users_week', 'new_users_month',
                'total_tasks', 'total_completed_tasks', 'total_achievements_earned',
                'total_rooms', 'total_schedule_views', 'total_room_joins',
                'room_joins_today', 'room_joins_week',
                'total_journal_joins', 'journal_joins_today', 'journal_joins_week',
                'total_journals'
            ]
            
            for field in required_fields:
                if field not in stats:
                    raise Exception(f"❌ FAIL: Missing required field '{field}' in admin stats")
                if not isinstance(stats[field], int):
                    raise Exception(f"❌ FAIL: Field '{field}' should be integer, got {type(stats[field])}")
                if stats[field] < 0:
                    raise Exception(f"❌ FAIL: Field '{field}' should be non-negative, got {stats[field]}")
                    
            self.log(f"📊 Admin Stats Summary:")
            self.log(f"   Total Users: {stats['total_users']}")
            self.log(f"   Active Users Today: {stats['active_users_today']}")
            self.log(f"   Total Tasks: {stats['total_tasks']}")
            self.log(f"   Total Journals: {stats['total_journals']}")
            
            # Test with days parameter
            response = self.make_request("GET", "/admin/stats?days=30")
            if response.status_code != 200:
                raise Exception(f"Failed to get admin stats with days parameter: {response.status_code} - {response.text}")
                
            stats_30_days = response.json()
            self.log(f"✅ Admin stats with days=30 retrieved successfully")
            
            # Test with different days parameter
            response = self.make_request("GET", "/admin/stats?days=7")
            if response.status_code != 200:
                raise Exception(f"Failed to get admin stats with days=7: {response.status_code} - {response.text}")
                
            self.log(f"✅ Admin stats with days=7 retrieved successfully")
            
            return True
            
        except Exception as e:
            self.log(f"❌ ADMIN STATS TEST FAILED: {e}", "ERROR")
            return False
            
    def test_admin_referral_stats_endpoint(self):
        """Test GET /api/admin/referral-stats endpoint"""
        self.log("=" * 60)
        self.log("TESTING GET /api/admin/referral-stats")
        self.log("=" * 60)
        
        try:
            # Test without parameters (should use defaults: days=30, limit=10)
            response = self.make_request("GET", "/admin/referral-stats")
            if response.status_code != 200:
                raise Exception(f"Failed to get referral stats: {response.status_code} - {response.text}")
                
            referral_stats = response.json()
            self.log(f"✅ Referral stats retrieved successfully")
            
            # Verify required fields exist
            required_fields = [
                'total_events', 'events_today', 'events_week', 'events_month',
                'room_joins_total', 'room_joins_today', 'room_joins_week',
                'journal_joins_total', 'journal_joins_today', 'journal_joins_week',
                'top_referrers', 'recent_events'
            ]
            
            for field in required_fields:
                if field not in referral_stats:
                    raise Exception(f"❌ FAIL: Missing required field '{field}' in referral stats")
                    
            # Verify data types
            numeric_fields = [
                'total_events', 'events_today', 'events_week', 'events_month',
                'room_joins_total', 'room_joins_today', 'room_joins_week',
                'journal_joins_total', 'journal_joins_today', 'journal_joins_week'
            ]
            
            for field in numeric_fields:
                if not isinstance(referral_stats[field], int):
                    raise Exception(f"❌ FAIL: Field '{field}' should be integer, got {type(referral_stats[field])}")
                if referral_stats[field] < 0:
                    raise Exception(f"❌ FAIL: Field '{field}' should be non-negative, got {referral_stats[field]}")
                    
            # Verify list fields
            if not isinstance(referral_stats['top_referrers'], list):
                raise Exception(f"❌ FAIL: 'top_referrers' should be list, got {type(referral_stats['top_referrers'])}")
            if not isinstance(referral_stats['recent_events'], list):
                raise Exception(f"❌ FAIL: 'recent_events' should be list, got {type(referral_stats['recent_events'])}")
                
            self.log(f"📊 Referral Stats Summary:")
            self.log(f"   Total Events: {referral_stats['total_events']}")
            self.log(f"   Events Today: {referral_stats['events_today']}")
            self.log(f"   Room Joins Total: {referral_stats['room_joins_total']}")
            self.log(f"   Journal Joins Total: {referral_stats['journal_joins_total']}")
            self.log(f"   Top Referrers Count: {len(referral_stats['top_referrers'])}")
            self.log(f"   Recent Events Count: {len(referral_stats['recent_events'])}")
            
            # Test with custom parameters
            response = self.make_request("GET", "/admin/referral-stats?days=7&limit=5")
            if response.status_code != 200:
                raise Exception(f"Failed to get referral stats with custom params: {response.status_code} - {response.text}")
                
            self.log(f"✅ Referral stats with custom parameters retrieved successfully")
            
            return True
            
        except Exception as e:
            self.log(f"❌ REFERRAL STATS TEST FAILED: {e}", "ERROR")
            return False
            
    def test_admin_users_endpoint(self):
        """Test GET /api/admin/users endpoint"""
        self.log("=" * 60)
        self.log("TESTING GET /api/admin/users")
        self.log("=" * 60)
        
        try:
            # Test without parameters (should use defaults: limit=50, skip=0)
            response = self.make_request("GET", "/admin/users")
            if response.status_code != 200:
                raise Exception(f"Failed to get admin users: {response.status_code} - {response.text}")
                
            users = response.json()
            self.log(f"✅ Admin users retrieved successfully")
            
            # Verify response is a list
            if not isinstance(users, list):
                raise Exception(f"❌ FAIL: Response should be list, got {type(users)}")
                
            self.log(f"📊 Users Summary:")
            self.log(f"   Total Users Retrieved: {len(users)}")
            
            # If users exist, verify structure
            if len(users) > 0:
                user = users[0]
                required_user_fields = ['telegram_id', 'username', 'first_name']
                
                for field in required_user_fields:
                    if field not in user:
                        self.log(f"⚠️  Warning: User missing field '{field}' (may be optional)")
                        
                self.log(f"   Sample User: telegram_id={user.get('telegram_id')}, username={user.get('username')}")
            else:
                self.log(f"   No users found (empty database expected)")
                
            # Test with limit parameter
            response = self.make_request("GET", "/admin/users?limit=10")
            if response.status_code != 200:
                raise Exception(f"Failed to get admin users with limit: {response.status_code} - {response.text}")
                
            limited_users = response.json()
            if len(limited_users) > 10:
                raise Exception(f"❌ FAIL: Limit=10 but got {len(limited_users)} users")
                
            self.log(f"✅ Admin users with limit=10 retrieved successfully ({len(limited_users)} users)")
            
            # Test with skip parameter
            response = self.make_request("GET", "/admin/users?skip=0&limit=5")
            if response.status_code != 200:
                raise Exception(f"Failed to get admin users with skip: {response.status_code} - {response.text}")
                
            self.log(f"✅ Admin users with pagination retrieved successfully")
            
            # Test with search parameter (should work even if no results)
            response = self.make_request("GET", "/admin/users?search=test")
            if response.status_code != 200:
                raise Exception(f"Failed to get admin users with search: {response.status_code} - {response.text}")
                
            search_users = response.json()
            self.log(f"✅ Admin users with search='test' retrieved successfully ({len(search_users)} users)")
            
            return True
            
        except Exception as e:
            self.log(f"❌ ADMIN USERS TEST FAILED: {e}", "ERROR")
            return False
            
    def test_admin_journals_endpoint(self):
        """Test GET /api/admin/journals endpoint"""
        self.log("=" * 60)
        self.log("TESTING GET /api/admin/journals")
        self.log("=" * 60)
        
        try:
            # Test without parameters (should use defaults: limit=50, skip=0)
            response = self.make_request("GET", "/admin/journals")
            if response.status_code != 200:
                raise Exception(f"Failed to get admin journals: {response.status_code} - {response.text}")
                
            journals = response.json()
            self.log(f"✅ Admin journals retrieved successfully")
            
            # Verify response is a list
            if not isinstance(journals, list):
                raise Exception(f"❌ FAIL: Response should be list, got {type(journals)}")
                
            self.log(f"📊 Journals Summary:")
            self.log(f"   Total Journals Retrieved: {len(journals)}")
            
            # If journals exist, verify structure
            if len(journals) > 0:
                journal = journals[0]
                required_journal_fields = ['journal_id', 'name', 'owner_id']
                
                for field in required_journal_fields:
                    if field not in journal:
                        self.log(f"⚠️  Warning: Journal missing field '{field}' (may be optional)")
                        
                # Check calculated fields that should be added by the endpoint
                calculated_fields = ['total_students', 'total_sessions']
                for field in calculated_fields:
                    if field not in journal:
                        raise Exception(f"❌ FAIL: Journal missing calculated field '{field}'")
                    if not isinstance(journal[field], int):
                        raise Exception(f"❌ FAIL: Field '{field}' should be integer, got {type(journal[field])}")
                    if journal[field] < 0:
                        raise Exception(f"❌ FAIL: Field '{field}' should be non-negative, got {journal[field]}")
                        
                self.log(f"   Sample Journal: {journal.get('name')} (ID: {journal.get('journal_id')})")
                self.log(f"   Students: {journal.get('total_students')}, Sessions: {journal.get('total_sessions')}")
            else:
                self.log(f"   No journals found (empty database expected)")
                
            # Test with limit parameter
            response = self.make_request("GET", "/admin/journals?limit=10")
            if response.status_code != 200:
                raise Exception(f"Failed to get admin journals with limit: {response.status_code} - {response.text}")
                
            limited_journals = response.json()
            if len(limited_journals) > 10:
                raise Exception(f"❌ FAIL: Limit=10 but got {len(limited_journals)} journals")
                
            self.log(f"✅ Admin journals with limit=10 retrieved successfully ({len(limited_journals)} journals)")
            
            # Test with skip parameter
            response = self.make_request("GET", "/admin/journals?skip=0&limit=5")
            if response.status_code != 200:
                raise Exception(f"Failed to get admin journals with skip: {response.status_code} - {response.text}")
                
            self.log(f"✅ Admin journals with pagination retrieved successfully")
            
            # Test with search parameter (should work even if no results)
            response = self.make_request("GET", "/admin/journals?search=test")
            if response.status_code != 200:
                raise Exception(f"Failed to get admin journals with search: {response.status_code} - {response.text}")
                
            search_journals = response.json()
            self.log(f"✅ Admin journals with search='test' retrieved successfully ({len(search_journals)} journals)")
            
            return True
            
        except Exception as e:
            self.log(f"❌ ADMIN JOURNALS TEST FAILED: {e}", "ERROR")
            return False

def main():
    """Run the complete admin endpoints test suite"""
    print("🧪 Admin Endpoints Test Suite")
    print("=" * 60)
    
    test_suite = AdminEndpointsTestSuite()
    
    # Test all admin endpoints mentioned in the review request
    admin_stats_passed = test_suite.test_admin_stats_endpoint()
    referral_stats_passed = test_suite.test_admin_referral_stats_endpoint()
    admin_users_passed = test_suite.test_admin_users_endpoint()
    admin_journals_passed = test_suite.test_admin_journals_endpoint()
    
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    print(f"GET /api/admin/stats: {'✅ PASSED' if admin_stats_passed else '❌ FAILED'}")
    print(f"GET /api/admin/referral-stats: {'✅ PASSED' if referral_stats_passed else '❌ FAILED'}")
    print(f"GET /api/admin/users: {'✅ PASSED' if admin_users_passed else '❌ FAILED'}")
    print(f"GET /api/admin/journals: {'✅ PASSED' if admin_journals_passed else '❌ FAILED'}")
    
    if admin_stats_passed and referral_stats_passed and admin_users_passed and admin_journals_passed:
        print("\n🎉 ALL ADMIN ENDPOINTS TESTS PASSED!")
        print("✅ All admin endpoints are working correctly")
        print("✅ Empty lists are handled properly (expected for empty DB)")
        print("✅ All required fields and data types are correct")
        print("✅ Pagination and search parameters work correctly")
        return 0
    else:
        print("\n💥 SOME ADMIN ENDPOINTS TESTS FAILED!")
        print("Please check the implementation and error messages above.")
        return 1

if __name__ == "__main__":
    exit(main())