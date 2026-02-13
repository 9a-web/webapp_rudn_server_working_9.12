#!/usr/bin/env python3
"""
Backend API Testing Script for Admin Panel Statistics Features
Tests the admin panel online statistics history and server metrics features on RUDN Schedule backend.
"""

import httpx
import asyncio
import json
from typing import Dict, Any, Optional, List

# Backend URL - using the external URL from frontend/.env
BASE_URL = "https://db-reconnect-1.preview.emergentagent.com/api"

class AdminPanelStatsTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.test_results = []
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
    
    def log_test(self, test_name: str, success: bool, details: str):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
        if not success:
            print(f"   Details: {details}")
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details
        })
    
    async def test_1_health_check(self):
        """Test 1: Health Check - GET /api/health → HTTP 200"""
        try:
            response = await self.client.get(f"{BASE_URL}/health")
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Health Check", True, 
                            f"Status: {data.get('status', 'N/A')}, MongoDB connected: {data.get('mongodb', {}).get('connected', 'N/A')}")
            else:
                self.log_test("Health Check", False, 
                            f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Health Check", False, f"Exception: {str(e)}")

    async def test_2_online_stats_history_1h(self):
        """Test 2: Online Stats History (1 hour) - GET /api/admin/online-stats-history?hours=1 → HTTP 200"""
        try:
            response = await self.client.get(f"{BASE_URL}/admin/online-stats-history?hours=1")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields
                required_fields = ['period_hours', 'total_points', 'metrics']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test("Online Stats History (1h)", False, 
                                f"Missing required fields: {missing_fields}. Response keys: {list(data.keys())}")
                    return
                
                # Check metrics array structure
                metrics = data.get('metrics', [])
                if not isinstance(metrics, list):
                    self.log_test("Online Stats History (1h)", False, 
                                f"Metrics should be an array, got: {type(metrics)}")
                    return
                
                # Check metric structure if we have any metrics
                if metrics:
                    sample_metric = metrics[0]
                    required_metric_fields = ['timestamp', 'online_now', 'online_1h', 'online_24h', 'web_online', 'telegram_online', 'peak_online']
                    missing_metric_fields = [field for field in required_metric_fields if field not in sample_metric]
                    
                    if missing_metric_fields:
                        self.log_test("Online Stats History (1h)", False, 
                                    f"Sample metric missing fields: {missing_metric_fields}. Available: {list(sample_metric.keys())}")
                        return
                
                self.log_test("Online Stats History (1h)", True, 
                            f"Period: {data['period_hours']}h, Total points: {data['total_points']}, Metrics count: {len(metrics)}")
            else:
                self.log_test("Online Stats History (1h)", False, 
                            f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Online Stats History (1h)", False, f"Exception: {str(e)}")

    async def test_3_online_stats_history_all_time(self):
        """Test 3: Online Stats History (all time) - GET /api/admin/online-stats-history?hours=0 → HTTP 200"""
        try:
            response = await self.client.get(f"{BASE_URL}/admin/online-stats-history?hours=0")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields
                required_fields = ['period_hours', 'total_points', 'metrics']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test("Online Stats History (all time)", False, 
                                f"Missing required fields: {missing_fields}. Response keys: {list(data.keys())}")
                    return
                
                # For all time, period_hours should be 0
                if data.get('period_hours') != 0:
                    self.log_test("Online Stats History (all time)", False, 
                                f"Expected period_hours=0 for all time data, got: {data.get('period_hours')}")
                    return
                
                metrics = data.get('metrics', [])
                self.log_test("Online Stats History (all time)", True, 
                            f"Period: all time, Total points: {data['total_points']}, Metrics count: {len(metrics)}")
            else:
                self.log_test("Online Stats History (all time)", False, 
                            f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Online Stats History (all time)", False, f"Exception: {str(e)}")

    async def test_4_server_stats_history_no_limit(self):
        """Test 4: Server Stats History (no limit) - GET /api/admin/server-stats-history?hours=0 → HTTP 200"""
        try:
            response = await self.client.get(f"{BASE_URL}/admin/server-stats-history?hours=0")
            
            if response.status_code == 200:
                data = response.json()
                
                # Should be an array or object with metrics
                if isinstance(data, list):
                    metrics_count = len(data)
                elif isinstance(data, dict) and 'metrics' in data:
                    metrics_count = len(data.get('metrics', []))
                else:
                    self.log_test("Server Stats History (no limit)", False, 
                                f"Unexpected response format: {type(data)}")
                    return
                
                self.log_test("Server Stats History (no limit)", True, 
                            f"Retrieved server metrics without 168h limit. Metrics count: {metrics_count}")
            else:
                self.log_test("Server Stats History (no limit)", False, 
                            f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Server Stats History (no limit)", False, f"Exception: {str(e)}")

    async def test_5_server_stats_history_30_days(self):
        """Test 5: Server Stats History (30 days) - GET /api/admin/server-stats-history?hours=720 → HTTP 200"""
        try:
            response = await self.client.get(f"{BASE_URL}/admin/server-stats-history?hours=720")
            
            if response.status_code == 200:
                data = response.json()
                
                # Should be an array or object with metrics
                if isinstance(data, list):
                    metrics_count = len(data)
                elif isinstance(data, dict) and 'metrics' in data:
                    metrics_count = len(data.get('metrics', []))
                else:
                    self.log_test("Server Stats History (30 days)", False, 
                                f"Unexpected response format: {type(data)}")
                    return
                
                self.log_test("Server Stats History (30 days)", True, 
                            f"Retrieved 30 days (720h) server metrics. Metrics count: {metrics_count}")
            else:
                self.log_test("Server Stats History (30 days)", False, 
                            f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Server Stats History (30 days)", False, f"Exception: {str(e)}")

    async def test_6_hourly_activity_moscow_timezone(self):
        """Test 6: Hourly Activity (Moscow timezone) - GET /api/admin/hourly-activity → HTTP 200"""
        try:
            response = await self.client.get(f"{BASE_URL}/admin/hourly-activity")
            
            if response.status_code == 200:
                data = response.json()
                
                # Should be an array of 24 hours
                if not isinstance(data, list):
                    self.log_test("Hourly Activity (Moscow timezone)", False, 
                                f"Expected array, got: {type(data)}")
                    return
                
                if len(data) != 24:
                    self.log_test("Hourly Activity (Moscow timezone)", False, 
                                f"Expected 24 hours, got: {len(data)}")
                    return
                
                # Check structure of first item
                if data:
                    sample = data[0]
                    if 'hour' not in sample or 'count' not in sample:
                        self.log_test("Hourly Activity (Moscow timezone)", False, 
                                    f"Missing hour/count fields. Sample: {sample}")
                        return
                    
                    # Check hour range (0-23)
                    hours = [item.get('hour') for item in data]
                    expected_hours = list(range(24))
                    if set(hours) != set(expected_hours):
                        self.log_test("Hourly Activity (Moscow timezone)", False, 
                                    f"Hours should be 0-23, got: {sorted(hours)}")
                        return
                
                self.log_test("Hourly Activity (Moscow timezone)", True, 
                            f"24 hours data returned with proper hour (0-23) and count structure")
            else:
                self.log_test("Hourly Activity (Moscow timezone)", False, 
                            f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Hourly Activity (Moscow timezone)", False, f"Exception: {str(e)}")

    async def test_7_weekly_activity(self):
        """Test 7: Weekly Activity - GET /api/admin/weekly-activity → HTTP 200"""
        try:
            response = await self.client.get(f"{BASE_URL}/admin/weekly-activity")
            
            if response.status_code == 200:
                data = response.json()
                
                # Should be an array of 7 days
                if not isinstance(data, list):
                    self.log_test("Weekly Activity", False, 
                                f"Expected array, got: {type(data)}")
                    return
                
                if len(data) != 7:
                    self.log_test("Weekly Activity", False, 
                                f"Expected 7 days, got: {len(data)}")
                    return
                
                # Check structure
                if data:
                    sample = data[0]
                    required_fields = ['day', 'count']  # or similar structure
                    available_fields = list(sample.keys())
                    
                    # Accept flexible field names for day data
                    has_day_field = any(field in available_fields for field in ['day', 'day_name', 'weekday', '_id'])
                    has_count_field = any(field in available_fields for field in ['count', 'total', 'activities'])
                    
                    if not (has_day_field and has_count_field):
                        self.log_test("Weekly Activity", False, 
                                    f"Missing day/count-like fields. Available: {available_fields}")
                        return
                
                self.log_test("Weekly Activity", True, 
                            f"7 days data returned (Пн-Вс). Sample structure: {list(data[0].keys()) if data else 'empty'}")
            else:
                self.log_test("Weekly Activity", False, 
                            f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Weekly Activity", False, f"Exception: {str(e)}")

    async def test_8_online_users_current(self):
        """Test 8: Online users current - GET /api/admin/online-users → HTTP 200"""
        try:
            response = await self.client.get(f"{BASE_URL}/admin/online-users")
            
            if response.status_code == 200:
                data = response.json()
                
                # Should return some online user data structure
                # Accept various formats as long as it's valid JSON
                if isinstance(data, (dict, list)):
                    self.log_test("Online Users Current", True, 
                                f"Online users data returned. Type: {type(data)}, Keys/Length: {list(data.keys()) if isinstance(data, dict) else len(data)}")
                else:
                    self.log_test("Online Users Current", False, 
                                f"Unexpected data type: {type(data)}")
            else:
                self.log_test("Online Users Current", False, 
                            f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Online Users Current", False, f"Exception: {str(e)}")
    
    async def run_all_tests(self):
        """Run all message notification tests"""
        print("🚀 Starting Message Notification Feature Backend Tests")
        print("=" * 70)
        print(f"Backend URL: {BASE_URL}")
        print(f"Environment: test (using test bot, test database)")
        print("=" * 70)
        
        # Run tests in sequence as specified in review request
        await self.test_1_health_check()
        await self.test_2_notification_settings_include_social_messages()
        await self.test_3_update_notification_settings_social_messages()
        await self.test_4_setup_test_users_and_friendship()
        await self.test_5_send_message_creates_notification()
        await self.test_6_notification_structure()
        
        print("\n" + "=" * 70)
        print("📊 TEST SUMMARY")
        print("=" * 70)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        print(f"Tests Passed: {passed}/{total}")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED!")
        else:
            print("⚠️  Some tests failed. Check details above.")
        
        print("\nDetailed Results:")
        for result in self.test_results:
            status = "✅" if result['success'] else "❌"
            print(f"{status} {result['test']}")
            if not result['success'] and result['details']:
                print(f"   -> {result['details']}")
        
        return passed == total

async def main():
    """Main test runner"""
    async with MessageNotificationTester() as tester:
        success = await tester.run_all_tests()
        return success

if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n🛑 Tests interrupted by user")
        exit(1)
    except Exception as e:
        print(f"\n💥 Test runner crashed: {e}")
        exit(1)