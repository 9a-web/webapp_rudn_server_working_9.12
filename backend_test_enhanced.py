#!/usr/bin/env python3
"""
Enhanced testing for B-2026-07: Public profile UID endpoints
Tests privacy scenarios by directly modifying the database.
"""

import asyncio
import aiohttp
import json
import sys
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

# Backend URL and MongoDB
BACKEND_URL = "http://localhost:8001/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

# Test data
TEST_UID = "123456789"
TEST_TELEGRAM_ID = 777000111
NONEXISTENT_UID = "000000000"

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def add_result(self, test_name: str, passed: bool, details: str = ""):
        self.results.append({
            "test": test_name,
            "passed": passed,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
        if passed:
            self.passed += 1
            print(f"✅ {test_name}")
        else:
            self.failed += 1
            print(f"❌ {test_name}: {details}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n📊 Test Summary: {self.passed}/{total} passed ({self.failed} failed)")
        return self.passed, self.failed, total

async def make_request(session, method, endpoint, headers=None, json_data=None):
    """Make HTTP request and return response data"""
    url = f"{BACKEND_URL}{endpoint}"
    try:
        async with session.request(method, url, headers=headers, json=json_data) as response:
            try:
                data = await response.json()
            except:
                data = await response.text()
            return response.status, data
    except Exception as e:
        return None, str(e)

async def update_privacy_direct(db, telegram_id, privacy_settings):
    """Directly update privacy settings in database"""
    try:
        await db.user_settings.update_one(
            {"telegram_id": telegram_id},
            {"$set": {"privacy_settings": privacy_settings}},
            upsert=False
        )
        return True
    except Exception as e:
        print(f"Failed to update privacy: {e}")
        return False

async def test_privacy_scenarios(session, results):
    """Test privacy scenarios by directly modifying database"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # Test 1: Set show_friends_list=false
        privacy_hidden = {
            "show_in_search": True,
            "show_schedule": True,
            "show_friends_list": False,  # Hide friends list
            "show_achievements": True,
            "show_online_status": True,
            "show_last_activity": True,
        }
        
        success = await update_privacy_direct(db, TEST_TELEGRAM_ID, privacy_hidden)
        if success:
            # Test anonymous access to friends list
            status, data = await make_request(session, "GET", f"/u/{TEST_UID}/friends")
            if status == 200 and isinstance(data, dict):
                friends = data.get("friends", [])
                total = data.get("total", 0)
                if len(friends) == 0 and total == 0:
                    results.add_result("Privacy: friends list hidden", True, "Empty friends list returned")
                else:
                    results.add_result("Privacy: friends list hidden", False, f"Expected empty, got {len(friends)} friends")
            else:
                results.add_result("Privacy: friends list hidden", False, f"Status: {status}, Data: {data}")
        else:
            results.add_result("Privacy: friends list setup", False, "Could not update privacy in database")
        
        # Test 2: Set show_achievements=false
        privacy_hidden_achievements = {
            "show_in_search": True,
            "show_schedule": True,
            "show_friends_list": True,
            "show_achievements": False,  # Hide achievements
            "show_online_status": True,
            "show_last_activity": True,
        }
        
        success = await update_privacy_direct(db, TEST_TELEGRAM_ID, privacy_hidden_achievements)
        if success:
            # Test anonymous access to achievements
            status, data = await make_request(session, "GET", f"/u/{TEST_UID}/achievements")
            if status == 200 and isinstance(data, dict):
                hidden = data.get("hidden", False)
                earned = data.get("earned", [])
                if hidden and len(earned) == 0:
                    results.add_result("Privacy: achievements hidden", True, "Achievements properly hidden")
                else:
                    results.add_result("Privacy: achievements hidden", False, f"Expected hidden=true, earned=[], got hidden={hidden}, earned={len(earned)}")
            else:
                results.add_result("Privacy: achievements hidden", False, f"Status: {status}, Data: {data}")
        else:
            results.add_result("Privacy: achievements setup", False, "Could not update privacy in database")
        
        # Test 3: Set show_in_search=false (should hide from strangers)
        privacy_hidden_search = {
            "show_in_search": False,  # Hide from search
            "show_schedule": True,
            "show_friends_list": True,
            "show_achievements": True,
            "show_online_status": True,
            "show_last_activity": True,
        }
        
        success = await update_privacy_direct(db, TEST_TELEGRAM_ID, privacy_hidden_search)
        if success:
            # Test anonymous access to friends and achievements (should be hidden)
            status, data = await make_request(session, "GET", f"/u/{TEST_UID}/friends")
            if status == 200 and isinstance(data, dict):
                friends = data.get("friends", [])
                total = data.get("total", 0)
                if len(friends) == 0 and total == 0:
                    results.add_result("Privacy: show_in_search=false hides friends", True, "Friends hidden from strangers")
                else:
                    results.add_result("Privacy: show_in_search=false hides friends", False, f"Expected empty, got {len(friends)} friends")
            
            status, data = await make_request(session, "GET", f"/u/{TEST_UID}/achievements")
            if status == 200 and isinstance(data, dict):
                hidden = data.get("hidden", False)
                earned = data.get("earned", [])
                if hidden and len(earned) == 0:
                    results.add_result("Privacy: show_in_search=false hides achievements", True, "Achievements hidden from strangers")
                else:
                    results.add_result("Privacy: show_in_search=false hides achievements", False, f"Expected hidden=true, earned=[], got hidden={hidden}, earned={len(earned)}")
        
        # Reset to default (visible) privacy settings
        privacy_visible = {
            "show_in_search": True,
            "show_schedule": True,
            "show_friends_list": True,
            "show_achievements": True,
            "show_online_status": True,
            "show_last_activity": True,
        }
        await update_privacy_direct(db, TEST_TELEGRAM_ID, privacy_visible)
        
    finally:
        client.close()

async def test_basic_functionality(session, results):
    """Test basic functionality of all 5 endpoints"""
    endpoints = [
        "/u/123456789/avatar",
        "/u/123456789/graffiti", 
        "/u/123456789/wall-graffiti",
        "/u/123456789/friends",
        "/u/123456789/achievements"
    ]
    
    for endpoint in endpoints:
        status, data = await make_request(session, "GET", endpoint)
        if status == 200:
            results.add_result(f"Basic functionality {endpoint}", True, f"Status: {status}")
        else:
            results.add_result(f"Basic functionality {endpoint}", False, f"Status: {status}, Data: {data}")

async def test_nonexistent_uid(session, results):
    """Test non-existent UID returns 404"""
    endpoints = [
        "/u/000000000/avatar",
        "/u/000000000/graffiti",
        "/u/000000000/wall-graffiti", 
        "/u/000000000/friends",
        "/u/000000000/achievements"
    ]
    
    for endpoint in endpoints:
        status, data = await make_request(session, "GET", endpoint)
        if status == 404:
            results.add_result(f"404 for nonexistent UID {endpoint}", True, f"Status: {status}")
        else:
            results.add_result(f"404 for nonexistent UID {endpoint}", False, f"Expected 404, got {status}: {data}")

async def test_response_structure(session, results):
    """Test response structure of endpoints"""
    
    # Test friends endpoint structure
    status, data = await make_request(session, "GET", f"/u/{TEST_UID}/friends")
    if status == 200 and isinstance(data, dict):
        if "friends" in data and "total" in data:
            results.add_result("Friends response structure", True, "Has friends and total fields")
        else:
            results.add_result("Friends response structure", False, f"Missing required fields: {data}")
    else:
        results.add_result("Friends response structure", False, f"Status: {status}")
    
    # Test achievements endpoint structure  
    status, data = await make_request(session, "GET", f"/u/{TEST_UID}/achievements")
    if status == 200 and isinstance(data, dict):
        required_fields = ["earned", "all", "hidden", "earned_count", "total_count"]
        missing_fields = [field for field in required_fields if field not in data]
        if not missing_fields:
            results.add_result("Achievements response structure", True, "Has all required fields")
        else:
            results.add_result("Achievements response structure", False, f"Missing fields: {missing_fields}")
    else:
        results.add_result("Achievements response structure", False, f"Status: {status}")

async def test_legacy_endpoints(session, results):
    """Test legacy endpoints still work"""
    legacy_endpoints = [
        (f"/u/{TEST_UID}", "GET"),
        (f"/u/{TEST_UID}/share-link", "GET"), 
        (f"/u/{TEST_UID}/qr", "GET"),
        (f"/u/{TEST_UID}/view", "POST")
    ]
    
    for endpoint, method in legacy_endpoints:
        status, data = await make_request(session, method, endpoint)
        # We expect 200 for most, or specific expected errors
        if status in [200, 401, 422]:  # 401 for auth-required endpoints is OK
            results.add_result(f"Legacy endpoint {method} {endpoint}", True, f"Status: {status}")
        else:
            results.add_result(f"Legacy endpoint {method} {endpoint}", False, f"Status: {status}, Data: {data}")

async def main():
    """Run all tests"""
    print("🧪 Enhanced Testing for B-2026-07: Public Profile UID Endpoints")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test UID: {TEST_UID}")
    print("=" * 70)
    
    results = TestResults()
    
    async with aiohttp.ClientSession() as session:
        # Test 1: Basic functionality
        await test_basic_functionality(session, results)
        
        # Test 2: Non-existent UID returns 404
        await test_nonexistent_uid(session, results)
        
        # Test 3: Privacy scenarios (using direct DB updates)
        await test_privacy_scenarios(session, results)
        
        # Test 4: Response structure validation
        await test_response_structure(session, results)
        
        # Test 5: Legacy endpoints regression
        await test_legacy_endpoints(session, results)
    
    # Print summary
    passed, failed, total = results.summary()
    
    # Save detailed results
    with open("/app/test_results_b2026_07_enhanced.json", "w") as f:
        json.dump({
            "test_suite": "B-2026-07 Public Profile UID Endpoints (Enhanced)",
            "timestamp": datetime.now().isoformat(),
            "summary": {"passed": passed, "failed": failed, "total": total},
            "results": results.results
        }, f, indent=2)
    
    print(f"\n📄 Detailed results saved to /app/test_results_b2026_07_enhanced.json")
    
    if failed > 0:
        print(f"\n⚠️  {failed} tests failed. Check the details above.")
        return 1
    else:
        print(f"\n🎉 All {total} tests passed!")
        return 0

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)