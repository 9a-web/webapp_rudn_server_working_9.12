#!/usr/bin/env python3
"""
Backend API Testing Script for Friends System
Tests the Friends System API endpoints as specified in the review request.
"""

import requests
import json
import sys
from urllib.parse import urlparse, parse_qs

# Backend URL from frontend .env.production
BACKEND_URL = "https://rudn-schedule.ru"
API_BASE = f"{BACKEND_URL}/api"

# Test users as specified in the review request
TEST_USER_1 = 123456789  # тестовый
TEST_USER_2 = 765963392  # существующий в БД

def test_vk_oauth_config():
    """
    Test GET /api/music/auth/config endpoint
    Should return VK OAuth configuration with:
    - auth_url containing client_id=2685278, redirect_uri=https://api.vk.com/blank.html, response_type=token
    - app_id should be 2685278 (Kate Mobile)
    - redirect_uri should be https://api.vk.com/blank.html
    """
    print("🔍 Testing VK OAuth Config API...")
    
    try:
        url = f"{API_BASE}/music/auth/config"
        print(f"📡 Making request to: {url}")
        
        response = requests.get(url, timeout=10)
        print(f"📊 Response Status: {response.status_code}")
        print(f"📋 Response Headers: {dict(response.headers)}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            print(f"📄 Response body: {response.text}")
            return False
        
        try:
            data = response.json()
            print(f"📄 Response JSON: {json.dumps(data, indent=2, ensure_ascii=False)}")
        except json.JSONDecodeError:
            print(f"❌ FAILED: Response is not valid JSON")
            print(f"📄 Response body: {response.text}")
            return False
        
        # Validate response structure
        required_fields = ['auth_url', 'app_id', 'redirect_uri']
        for field in required_fields:
            if field not in data:
                print(f"❌ FAILED: Missing required field '{field}' in response")
                return False
        
        # Validate app_id
        if data['app_id'] != 2685278:
            print(f"❌ FAILED: Expected app_id=2685278, got {data['app_id']}")
            return False
        
        # Validate redirect_uri
        expected_redirect = "https://api.vk.com/blank.html"
        if data['redirect_uri'] != expected_redirect:
            print(f"❌ FAILED: Expected redirect_uri='{expected_redirect}', got '{data['redirect_uri']}'")
            return False
        
        # Validate auth_url format and parameters
        auth_url = data['auth_url']
        print(f"🔗 Analyzing auth_url: {auth_url}")
        
        # Parse URL
        parsed_url = urlparse(auth_url)
        if not auth_url.startswith('https://oauth.vk.com/authorize'):
            print(f"❌ FAILED: auth_url should start with 'https://oauth.vk.com/authorize', got: {auth_url}")
            return False
        
        # Parse query parameters
        query_params = parse_qs(parsed_url.query)
        print(f"🔍 URL Parameters: {query_params}")
        
        # Check required parameters
        required_params = {
            'client_id': ['2685278'],
            'redirect_uri': ['https://api.vk.com/blank.html'],
            'response_type': ['token']
        }
        
        for param, expected_values in required_params.items():
            if param not in query_params:
                print(f"❌ FAILED: Missing required parameter '{param}' in auth_url")
                return False
            
            if query_params[param] != expected_values:
                print(f"❌ FAILED: Parameter '{param}' expected {expected_values}, got {query_params[param]}")
                return False
        
        # Check for scope parameter (should contain audio permissions)
        if 'scope' in query_params:
            scope = query_params['scope'][0]
            print(f"🔐 Scope: {scope}")
            if 'audio' not in scope:
                print(f"⚠️  WARNING: Scope doesn't contain 'audio' permissions: {scope}")
        else:
            print(f"⚠️  WARNING: No 'scope' parameter found in auth_url")
        
        # Check display parameter
        if 'display' in query_params:
            display = query_params['display'][0]
            print(f"📱 Display: {display}")
            if display != 'page':
                print(f"⚠️  WARNING: Expected display=page, got display={display}")
        else:
            print(f"⚠️  WARNING: No 'display' parameter found in auth_url")
        
        print("✅ VK OAuth Config API test PASSED")
        print("✅ All required fields present and valid")
        print("✅ auth_url format matches vkserv.ru style (oauth.vk.com)")
        print("✅ response_type=token (Implicit Grant, not Authorization Code)")
        print("✅ Kate Mobile app_id (2685278) configured correctly")
        
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Network error - {e}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {e}")
        return False

def test_with_curl():
    """Test using curl command as requested in the review"""
    print("\n🔧 Testing with curl command...")
    
    import subprocess
    
    try:
        curl_cmd = [
            'curl', '-s', '-w', '\\nHTTP_CODE:%{http_code}\\n',
            f'{API_BASE}/music/auth/config'
        ]
        
        print(f"🔧 Running: {' '.join(curl_cmd)}")
        
        result = subprocess.run(curl_cmd, capture_output=True, text=True, timeout=10)
        
        print(f"📤 curl stdout:")
        print(result.stdout)
        
        if result.stderr:
            print(f"📤 curl stderr:")
            print(result.stderr)
        
        print(f"📤 curl return code: {result.returncode}")
        
        # Parse the output to extract HTTP code
        lines = result.stdout.strip().split('\n')
        http_code_line = [line for line in lines if line.startswith('HTTP_CODE:')]
        
        if http_code_line:
            http_code = http_code_line[0].replace('HTTP_CODE:', '')
            print(f"📊 HTTP Status Code: {http_code}")
            
            if http_code == '200':
                print("✅ curl test PASSED - HTTP 200 received")
                return True
            else:
                print(f"❌ curl test FAILED - Expected HTTP 200, got {http_code}")
                return False
        else:
            print("⚠️  Could not extract HTTP status code from curl output")
            return False
            
    except subprocess.TimeoutExpired:
        print("❌ curl test FAILED - Request timed out")
        return False
    except Exception as e:
        print(f"❌ curl test FAILED - Error: {e}")
        return False

def main():
    """Run all VK OAuth API tests"""
    print("🚀 Starting VK OAuth API Tests")
    print("=" * 50)
    
    # Test VK OAuth Config
    config_test_passed = test_vk_oauth_config()
    
    # Test with curl as requested
    curl_test_passed = test_with_curl()
    
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    if config_test_passed:
        print("✅ VK OAuth Config API: PASSED")
    else:
        print("❌ VK OAuth Config API: FAILED")
    
    if curl_test_passed:
        print("✅ curl test: PASSED")
    else:
        print("❌ curl test: FAILED")
    
    if config_test_passed and curl_test_passed:
        print("\n🎉 All tests PASSED!")
        return 0
    else:
        print("\n💥 Some tests FAILED!")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)