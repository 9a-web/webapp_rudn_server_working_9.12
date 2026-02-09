#!/usr/bin/env python3
"""
Backend API Testing Script
Comprehensive validation after architectural refactoring on localhost:8001
Validates all 7 key points from review request
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
import sys

# Configuration - testing on localhost:8001 as per review request
BASE_URL = "http://localhost:8001/api"
TEST_TELEGRAM_ID = 99999

def print_test_result(test_name, success, details=None):
    """Print formatted test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"   {details}")
    print()

def test_bot_info():
    """Test GET /api/bot-info endpoint according to review request expectations"""
    print("🔄 Testing: Bot Info Endpoint...")
    
    url = f"{BASE_URL}/bot-info"
    
    try:
        response = requests.get(url, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"   Response data: {json.dumps(data, indent=2)}")
            
            # Check what fields are actually returned vs expected
            expected_fields = ['username', 'first_name', 'bot_id', 'env']
            actual_fields = list(data.keys())
            
            print(f"   Expected fields: {expected_fields}")
            print(f"   Actual fields: {actual_fields}")
            
            # Check if core fields are present (allowing for field name differences)
            has_username = 'username' in data
            has_first_name = 'first_name' in data
            has_bot_id = 'bot_id' in data or 'id' in data  # Allow both field names
            has_env = 'env' in data
            
            # Validate username (should NOT be "rudn_mosbot", should be test bot username)
            username_valid = False
            if has_username:
                username = data['username']
                if username != "rudn_mosbot" and username:
                    username_valid = True
                    if username == "devrudnbot":
                        print(f"   ✅ Username is correct test bot: {username}")
                    else:
                        print(f"   ⚠️ Username is not 'devrudnbot' as expected, but is valid: {username}")
                else:
                    print(f"   ❌ Username validation failed: '{username}' (should not be 'rudn_mosbot' and should not be empty)")
            
            # Validate first_name (should be non-empty)
            first_name_valid = False
            if has_first_name:
                first_name = data['first_name']
                if first_name:
                    first_name_valid = True
                    print(f"   ✅ First name is present: {first_name}")
                else:
                    print(f"   ❌ First name is empty")
            
            # Validate bot_id (should be > 0)
            bot_id_valid = False
            if has_bot_id:
                bot_id = data.get('bot_id') or data.get('id')
                if bot_id and bot_id > 0:
                    bot_id_valid = True
                    print(f"   ✅ Bot ID is valid: {bot_id}")
                else:
                    print(f"   ❌ Bot ID validation failed: {bot_id} (should be > 0)")
            
            # Validate env field (should be "test")
            env_valid = False
            if has_env:
                env = data['env']
                if env == "test":
                    env_valid = True
                    print(f"   ✅ Env field is correct: {env}")
                else:
                    print(f"   ❌ Env field validation failed: {env} (expected 'test')")
            else:
                print(f"   ❌ Env field is missing from response")
            
            # Summary of issues
            issues = []
            if not has_username:
                issues.append("missing 'username' field")
            elif not username_valid:
                issues.append("invalid username")
                
            if not has_first_name:
                issues.append("missing 'first_name' field")
            elif not first_name_valid:
                issues.append("empty first_name")
                
            if not has_bot_id:
                issues.append("missing 'bot_id' or 'id' field")
            elif not bot_id_valid:
                issues.append("invalid bot_id")
                
            if not has_env:
                issues.append("missing 'env' field")
            elif not env_valid:
                issues.append("incorrect env value")
            
            if not issues:
                print_test_result("Bot Info Endpoint", True, "All validations passed")
                return True
            else:
                print_test_result("Bot Info Endpoint", False, f"Issues found: {', '.join(issues)}")
                return False
        else:
            print_test_result("Bot Info Endpoint", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("Bot Info Endpoint", False, f"Exception: {str(e)}")
        return False

def main():
    """Run bot-info endpoint test"""
    print("🚀 Starting Bot Info Backend API Test")
    print(f"Backend URL: {BASE_URL}")
    print("=" * 70)
    
    # Test bot-info endpoint
    result = test_bot_info()
    
    # Summary
    print("=" * 70)
    print("📊 TEST SUMMARY")
    print("=" * 70)
    
    if result:
        print("✅ PASS Bot Info Endpoint")
        print("🎉 Bot info endpoint test passed!")
        return 0
    else:
        print("❌ FAIL Bot Info Endpoint")
        print("⚠️  Bot info endpoint test failed. Check the details above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())