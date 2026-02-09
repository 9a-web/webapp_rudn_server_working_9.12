#!/usr/bin/env python3
"""
Backend API Testing Script
Tests bot-info endpoint according to review request
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
import sys

# Configuration - using external URL as per environment setup
BASE_URL = "https://rudn-webapp.preview.emergentagent.com/api"
TEST_TELEGRAM_ID = 12345

def print_test_result(test_name, success, details=None):
    """Print formatted test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"   {details}")
    print()

def test_server_stats():
    """Test 1: GET /api/admin/server-stats - should return 200 with JSON containing cpu, memory, disk, uptime, mongodb, top_processes"""
    print("🔄 Testing: Server Stats...")
    
    url = f"{BASE_URL}/admin/server-stats"
    
    try:
        response = requests.get(url, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify required top-level fields
            required_fields = ['cpu', 'memory', 'disk', 'uptime', 'mongodb', 'top_processes']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print_test_result("Server Stats", False, f"Missing top-level fields: {missing_fields}")
                return False
            
            # Verify CPU object structure
            cpu_required = ['percent', 'count_logical', 'per_core', 'load_average']
            cpu_missing = [field for field in cpu_required if field not in data['cpu']]
            if cpu_missing:
                print_test_result("Server Stats", False, f"Missing CPU fields: {cpu_missing}")
                return False
                
            # Verify Memory object structure
            memory_required = ['total_gb', 'used_gb', 'percent']
            memory_missing = [field for field in memory_required if field not in data['memory']]
            if memory_missing:
                print_test_result("Server Stats", False, f"Missing memory fields: {memory_missing}")
                return False
                
            # Verify Disk object structure
            disk_required = ['total_gb', 'used_gb', 'percent']
            disk_missing = [field for field in disk_required if field not in data['disk']]
            if disk_missing:
                print_test_result("Server Stats", False, f"Missing disk fields: {disk_missing}")
                return False
                
            # Verify Uptime object structure
            uptime_required = ['seconds', 'days', 'hours', 'minutes']
            uptime_missing = [field for field in uptime_required if field not in data['uptime']]
            if uptime_missing:
                print_test_result("Server Stats", False, f"Missing uptime fields: {uptime_missing}")
                return False
                
            # Verify Process object structure
            process_required = ['pid', 'memory_rss_mb', 'threads']
            process_missing = [field for field in process_required if field not in data.get('process', {})]
            if process_missing:
                print_test_result("Server Stats", False, f"Missing process fields: {process_missing}")
                return False
                
            # Verify MongoDB object exists (can have error field if connection fails)
            if 'mongodb' not in data:
                print_test_result("Server Stats", False, "Missing mongodb field")
                return False
                
            # Verify top_processes is array
            if not isinstance(data['top_processes'], list):
                print_test_result("Server Stats", False, f"top_processes should be array, got: {type(data['top_processes'])}")
                return False
            
            # Verify data ranges are reasonable
            cpu_percent = data['cpu']['percent']
            if not (0 <= cpu_percent <= 100):
                print_test_result("Server Stats", False, f"CPU percent out of range: {cpu_percent}")
                return False
                
            memory_percent = data['memory']['percent'] 
            if not (0 <= memory_percent <= 100):
                print_test_result("Server Stats", False, f"Memory percent out of range: {memory_percent}")
                return False
            
            print_test_result("Server Stats", True, f"All required fields present with valid data ranges")
            return True
        else:
            print_test_result("Server Stats", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Server Stats", False, f"Exception: {str(e)}")
        return False

def test_server_stats_history_1h():
    """Test 2: GET /api/admin/server-stats-history?hours=1 - should return proper structure"""
    print("🔄 Testing: Server Stats History (1 hour)...")
    
    url = f"{BASE_URL}/admin/server-stats-history?hours=1"
    
    try:
        response = requests.get(url, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify required fields
            required_fields = ['period_hours', 'total_points', 'interval_minutes', 'metrics', 'peaks', 'averages']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print_test_result("Server Stats History (1h)", False, f"Missing fields: {missing_fields}")
                return False
            
            # Verify period_hours is correct
            if data['period_hours'] != 1:
                print_test_result("Server Stats History (1h)", False, f"Expected period_hours=1, got: {data['period_hours']}")
                return False
                
            # Verify total_points is number >= 0
            if not isinstance(data['total_points'], int) or data['total_points'] < 0:
                print_test_result("Server Stats History (1h)", False, f"Invalid total_points: {data['total_points']}")
                return False
                
            # Verify interval_minutes is number
            if not isinstance(data['interval_minutes'], int):
                print_test_result("Server Stats History (1h)", False, f"Invalid interval_minutes: {data['interval_minutes']}")
                return False
                
            # Verify metrics is array of objects
            if not isinstance(data['metrics'], list):
                print_test_result("Server Stats History (1h)", False, f"metrics should be array, got: {type(data['metrics'])}")
                return False
                
            # If we have metrics, verify structure
            if data['metrics']:
                metric_required = ['cpu_percent', 'ram_percent', 'disk_percent', 'load_1', 'process_rss_mb', 'timestamp']
                first_metric = data['metrics'][0]
                metric_missing = [field for field in metric_required if field not in first_metric]
                if metric_missing:
                    print_test_result("Server Stats History (1h)", False, f"Missing metric fields: {metric_missing}")
                    return False
                    
            # Verify peaks structure
            if 'peaks' in data and data['peaks']:
                peaks_required = ['cpu', 'ram', 'disk', 'load']
                peaks_missing = [field for field in peaks_required if field not in data['peaks']]
                if peaks_missing:
                    print_test_result("Server Stats History (1h)", False, f"Missing peaks fields: {peaks_missing}")
                    return False
                    
                # Each peak should have value and timestamp
                for peak_name, peak_data in data['peaks'].items():
                    if not isinstance(peak_data, dict) or 'value' not in peak_data or 'timestamp' not in peak_data:
                        print_test_result("Server Stats History (1h)", False, f"Invalid peak structure for {peak_name}")
                        return False
                        
            # Verify averages structure  
            if 'averages' in data and data['averages']:
                averages_required = ['cpu', 'ram', 'disk']
                averages_missing = [field for field in averages_required if field not in data['averages']]
                if averages_missing:
                    print_test_result("Server Stats History (1h)", False, f"Missing averages fields: {averages_missing}")
                    return False
            
            print_test_result("Server Stats History (1h)", True, f"Valid structure with {data['total_points']} data points")
            return True
        else:
            print_test_result("Server Stats History (1h)", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Server Stats History (1h)", False, f"Exception: {str(e)}")
        return False

def test_server_stats_history_24h():
    """Test 3: GET /api/admin/server-stats-history?hours=24 - verify period_hours=24"""
    print("🔄 Testing: Server Stats History (24 hours)...")
    
    url = f"{BASE_URL}/admin/server-stats-history?hours=24"
    
    try:
        response = requests.get(url, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify period_hours is correct
            if data.get('period_hours') != 24:
                print_test_result("Server Stats History (24h)", False, f"Expected period_hours=24, got: {data.get('period_hours')}")
                return False
                
            # Same structure validation as 1h test
            required_fields = ['period_hours', 'total_points', 'interval_minutes', 'metrics', 'peaks', 'averages']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print_test_result("Server Stats History (24h)", False, f"Missing fields: {missing_fields}")
                return False
            
            print_test_result("Server Stats History (24h)", True, f"Valid 24h structure with {data.get('total_points', 0)} data points")
            return True
        else:
            print_test_result("Server Stats History (24h)", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Server Stats History (24h)", False, f"Exception: {str(e)}")
        return False

def test_server_stats_history_168h():
    """Test 4: GET /api/admin/server-stats-history?hours=168 - verify it caps at 168 hours"""
    print("🔄 Testing: Server Stats History (168 hours - cap limit)...")
    
    url = f"{BASE_URL}/admin/server-stats-history?hours=168"
    
    try:
        response = requests.get(url, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify period_hours is capped at 168
            if data.get('period_hours') != 168:
                print_test_result("Server Stats History (168h)", False, f"Expected period_hours=168 (capped), got: {data.get('period_hours')}")
                return False
                
            # Same structure validation
            required_fields = ['period_hours', 'total_points', 'interval_minutes', 'metrics', 'peaks', 'averages']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print_test_result("Server Stats History (168h)", False, f"Missing fields: {missing_fields}")
                return False
            
            print_test_result("Server Stats History (168h)", True, f"Valid 168h structure (properly capped) with {data.get('total_points', 0)} data points")
            return True
        else:
            print_test_result("Server Stats History (168h)", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Server Stats History (168h)", False, f"Exception: {str(e)}")
        return False

def test_server_stats_history_over_limit():
    """Test 5: GET /api/admin/server-stats-history?hours=200 - verify it caps at 168 hours even with higher input"""
    print("🔄 Testing: Server Stats History (200 hours - over limit)...")
    
    url = f"{BASE_URL}/admin/server-stats-history?hours=200"
    
    try:
        response = requests.get(url, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            # Should be capped at 168 even when requesting 200
            if data.get('period_hours') != 168:
                print_test_result("Server Stats History (over limit)", False, f"Expected period_hours=168 (capped from 200), got: {data.get('period_hours')}")
                return False
            
            print_test_result("Server Stats History (over limit)", True, f"Properly capped at 168h when requesting 200h")
            return True
        else:
            print_test_result("Server Stats History (over limit)", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Server Stats History (over limit)", False, f"Exception: {str(e)}")
        return False

def main():
    """Run all server stats tests"""
    print("🚀 Starting Server Stats Backend API Tests")
    print(f"Backend URL: {BASE_URL}")
    print("=" * 70)
    
    results = {}
    
    # Test 1: Server Stats
    results['server_stats'] = test_server_stats()
    
    # Test 2: Server Stats History (1 hour)
    results['server_stats_history_1h'] = test_server_stats_history_1h()
    
    # Test 3: Server Stats History (24 hours)
    results['server_stats_history_24h'] = test_server_stats_history_24h()
    
    # Test 4: Server Stats History (168 hours - limit)
    results['server_stats_history_168h'] = test_server_stats_history_168h()
    
    # Test 5: Server Stats History (over limit)
    results['server_stats_history_over_limit'] = test_server_stats_history_over_limit()
    
    # Summary
    print("=" * 70)
    print("📊 TEST SUMMARY")
    print("=" * 70)
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name.replace('_', ' ').title()}")
    
    print()
    print(f"Overall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 All server stats endpoint tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed. Check the details above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())