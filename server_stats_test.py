#!/usr/bin/env python3
"""
Server Stats Endpoint Test
Tests the GET /api/admin/server-stats endpoint specifically
"""

import requests
import json
from datetime import datetime
import time

# Backend URL from frontend .env
BACKEND_URL = "https://schedule-app-32.preview.emergentagent.com"
SERVER_STATS_URL = f"{BACKEND_URL}/api/admin/server-stats"

def test_server_stats_endpoint():
    """Test the GET /api/admin/server-stats endpoint"""
    
    print("🧪 Testing Server Stats Endpoint")
    print(f"URL: {SERVER_STATS_URL}")
    print("=" * 60)
    
    # Test 1: Basic GET request
    print("Test 1: Basic GET request")
    try:
        response = requests.get(SERVER_STATS_URL, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
        # Parse JSON response
        try:
            data = response.json()
        except json.JSONDecodeError as e:
            print(f"❌ Failed to parse JSON: {e}")
            print(f"Response text: {response.text}")
            return False
            
        print("✅ Got 200 response with valid JSON")
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return False
    
    # Test 2: Validate required fields structure
    print("\nTest 2: Validate JSON structure")
    
    required_fields = {
        'timestamp': str,
        'system': dict,
        'cpu': dict, 
        'memory': dict,
        'disk': dict,
        'network': dict,
        'uptime': dict,
        'process': dict,
        'mongodb': dict,
        'top_processes': list
    }
    
    missing_fields = []
    invalid_types = []
    
    for field, expected_type in required_fields.items():
        if field not in data:
            missing_fields.append(field)
        elif not isinstance(data[field], expected_type):
            invalid_types.append(f"{field}: expected {expected_type.__name__}, got {type(data[field]).__name__}")
    
    if missing_fields:
        print(f"❌ Missing fields: {missing_fields}")
        return False
        
    if invalid_types:
        print(f"❌ Invalid field types: {invalid_types}")
        return False
        
    print("✅ All required fields present with correct types")
    
    # Test 3: Validate system object fields
    print("\nTest 3: Validate 'system' object")
    system_fields = ['platform', 'architecture', 'hostname', 'python_version']
    system_obj = data['system']
    
    missing_system_fields = [f for f in system_fields if f not in system_obj]
    if missing_system_fields:
        print(f"❌ Missing system fields: {missing_system_fields}")
        return False
    
    print("✅ System object has required fields")
    
    # Test 4: Validate CPU object fields
    print("\nTest 4: Validate 'cpu' object") 
    cpu_obj = data['cpu']
    cpu_required = ['percent', 'count_logical', 'per_core']
    
    missing_cpu_fields = [f for f in cpu_required if f not in cpu_obj]
    if missing_cpu_fields:
        print(f"❌ Missing CPU fields: {missing_cpu_fields}")
        return False
    
    # Validate CPU percent is 0-100
    cpu_percent = cpu_obj['percent']
    if not (0 <= cpu_percent <= 100):
        print(f"❌ CPU percent out of range: {cpu_percent} (should be 0-100)")
        return False
        
    # Validate per_core is array
    if not isinstance(cpu_obj['per_core'], list):
        print(f"❌ per_core should be array, got {type(cpu_obj['per_core'])}")
        return False
        
    print("✅ CPU object valid")
    
    # Test 5: Validate memory object
    print("\nTest 5: Validate 'memory' object")
    memory_obj = data['memory']
    memory_required = ['total_gb', 'used_gb', 'percent']
    
    missing_memory_fields = [f for f in memory_required if f not in memory_obj]
    if missing_memory_fields:
        print(f"❌ Missing memory fields: {missing_memory_fields}")
        return False
        
    # Validate memory percent is 0-100
    memory_percent = memory_obj['percent']
    if not (0 <= memory_percent <= 100):
        print(f"❌ Memory percent out of range: {memory_percent}")
        return False
        
    print("✅ Memory object valid")
    
    # Test 6: Validate disk object
    print("\nTest 6: Validate 'disk' object")
    disk_obj = data['disk']
    disk_required = ['total_gb', 'used_gb', 'percent']
    
    missing_disk_fields = [f for f in disk_required if f not in disk_obj]
    if missing_disk_fields:
        print(f"❌ Missing disk fields: {missing_disk_fields}")
        return False
        
    print("✅ Disk object valid")
    
    # Test 7: Validate network object
    print("\nTest 7: Validate 'network' object")
    network_obj = data['network']
    if network_obj is not None:  # Network stats might be None on some systems
        network_required = ['bytes_sent', 'bytes_recv']
        missing_network_fields = [f for f in network_required if f not in network_obj]
        if missing_network_fields:
            print(f"❌ Missing network fields: {missing_network_fields}")
            return False
    
    print("✅ Network object valid")
    
    # Test 8: Validate uptime object
    print("\nTest 8: Validate 'uptime' object")
    uptime_obj = data['uptime']
    uptime_required = ['seconds', 'days', 'hours', 'minutes']
    
    missing_uptime_fields = [f for f in uptime_required if f not in uptime_obj]
    if missing_uptime_fields:
        print(f"❌ Missing uptime fields: {missing_uptime_fields}")
        return False
        
    print("✅ Uptime object valid")
    
    # Test 9: Validate process object
    print("\nTest 9: Validate 'process' object")
    process_obj = data['process']
    process_required = ['pid', 'memory_rss_mb', 'threads']
    
    missing_process_fields = [f for f in process_required if f not in process_obj]
    if missing_process_fields:
        print(f"❌ Missing process fields: {missing_process_fields}")
        return False
        
    print("✅ Process object valid")
    
    # Test 10: Validate mongodb object
    print("\nTest 10: Validate 'mongodb' object")
    mongodb_obj = data['mongodb']
    
    # MongoDB object might have error field if connection failed
    if 'error' in mongodb_obj:
        print(f"⚠️  MongoDB connection error: {mongodb_obj['error']}")
    else:
        # If no error, should have collections and connections_current
        if 'collections' not in mongodb_obj or 'connections_current' not in mongodb_obj:
            print("❌ MongoDB object missing required fields (collections, connections_current)")
            return False
            
    print("✅ MongoDB object valid")
    
    # Test 11: Validate top_processes array
    print("\nTest 11: Validate 'top_processes' array")
    top_processes = data['top_processes']
    
    if not isinstance(top_processes, list):
        print(f"❌ top_processes should be array, got {type(top_processes)}")
        return False
        
    print("✅ Top processes array valid")
    
    # Store first response for consistency test
    first_response = data
    
    # Test 12: Consistency test (call endpoint twice)
    print("\nTest 12: Consistency test (second call)")
    time.sleep(1)  # Small delay between calls
    
    try:
        response2 = requests.get(SERVER_STATS_URL, timeout=30)
        
        if response2.status_code != 200:
            print(f"❌ Second call failed with status {response2.status_code}")
            return False
            
        data2 = response2.json()
        
        # Check that structure is consistent
        for field in required_fields:
            if field not in data2:
                print(f"❌ Second response missing field: {field}")
                return False
                
        print("✅ Second call successful with consistent structure")
        
        # Compare some values that should be different (timestamps) and similar (system info)
        if data2['timestamp'] == first_response['timestamp']:
            print("⚠️  Timestamps are identical (may be cached)")
        else:
            print("✅ Timestamps are different as expected")
            
        # System info should be identical
        if data2['system'] != first_response['system']:
            print("⚠️  System info changed between calls")
        else:
            print("✅ System info consistent between calls")
            
    except Exception as e:
        print(f"❌ Second call failed: {e}")
        return False
    
    # Test 13: Print sample data for verification
    print("\nTest 13: Sample Response Data")
    print("=" * 40)
    print(f"Timestamp: {data['timestamp']}")
    print(f"Platform: {data['system']['platform']} {data['system']['architecture']}")
    print(f"Python: {data['system']['python_version']}")
    print(f"CPU Usage: {data['cpu']['percent']}%")
    print(f"Memory Usage: {data['memory']['percent']}% ({data['memory']['used_gb']:.1f}GB / {data['memory']['total_gb']:.1f}GB)")
    print(f"Disk Usage: {data['disk']['percent']}% ({data['disk']['used_gb']:.1f}GB / {data['disk']['total_gb']:.1f}GB)")
    print(f"Uptime: {data['uptime']['days']} days, {data['uptime']['hours']} hours")
    print(f"Process PID: {data['process']['pid']}, Memory: {data['process']['memory_rss_mb']}MB, Threads: {data['process']['threads']}")
    
    if 'error' not in data['mongodb']:
        print(f"MongoDB: {data['mongodb']['collections']} collections, {data['mongodb']['connections_current']} active connections")
    else:
        print(f"MongoDB: Connection error - {data['mongodb']['error']}")
        
    print(f"Top Processes: {len(data['top_processes'])} processes listed")
    print("=" * 40)
    
    return True

def main():
    """Run all server stats tests"""
    print("🚀 Starting Server Stats Endpoint Tests")
    print(f"Testing URL: {SERVER_STATS_URL}")
    print("=" * 80)
    
    success = test_server_stats_endpoint()
    
    print("\n" + "=" * 80)
    if success:
        print("✅ ALL TESTS PASSED - Server stats endpoint working correctly")
    else:
        print("❌ TESTS FAILED - Server stats endpoint has issues")
        
    print("=" * 80)
    return success

if __name__ == "__main__":
    main()