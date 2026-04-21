#!/usr/bin/env python3
"""
Detailed investigation of the streak-claim idempotency bug.
"""
import asyncio
import aiohttp
import json
from datetime import datetime

# Backend URL - using the production URL as configured
BACKEND_URL = "https://rudn-schedule.ru"
API_BASE = f"{BACKEND_URL}/api"
TEST_USER_ID = 999999

async def investigate_streak_claim_bug():
    """
    Detailed investigation of the bug
    """
    print("🔬 Investigating streak-claim idempotency bug...")
    
    async with aiohttp.ClientSession() as session:
        
        # Step 1: Check initial user stats
        print(f"\n1️⃣ Checking initial user stats...")
        async with session.get(f"{API_BASE}/user-stats/{TEST_USER_ID}") as resp:
            if resp.status == 200:
                initial_stats = await resp.json()
                print(f"   Initial streak_claimed_today: {initial_stats.get('streak_claimed_today')}")
                print(f"   Initial visit_streak_current: {initial_stats.get('visit_streak_current')}")
                print(f"   Initial last_visit_date: {initial_stats.get('last_visit_date')}")
            else:
                print(f"   ❌ Could not get initial stats: HTTP {resp.status}")
                return False
        
        # Step 2: Call visit (to reset or not reset streak_claimed_today)
        print(f"\n2️⃣ Calling visit...")
        async with session.post(f"{API_BASE}/users/{TEST_USER_ID}/visit") as resp:
            if resp.status != 200:
                print(f"❌ Visit failed: HTTP {resp.status}")
                text = await resp.text()
                print(f"Response: {text}")
                return False
            
            visit_data = await resp.json()
            print(f"   Visit response: is_new_day={visit_data.get('is_new_day')}, streak={visit_data.get('visit_streak_current')}")
        
        # Step 3: Check user stats after visit
        print(f"\n3️⃣ Checking user stats after visit...")
        async with session.get(f"{API_BASE}/user-stats/{TEST_USER_ID}") as resp:
            if resp.status == 200:
                after_visit_stats = await resp.json()
                print(f"   After visit streak_claimed_today: {after_visit_stats.get('streak_claimed_today')}")
            else:
                print(f"   ❌ Could not get stats after visit: HTTP {resp.status}")
                return False
        
        # If streak_claimed_today is True, we need to reset it manually for the test
        if after_visit_stats.get('streak_claimed_today') == True:
            print(f"\n⚠️ streak_claimed_today is True after visit (same day). Manually resetting for test...")
            
            # This is a test-only operation - in real app, visit would reset on new day
            # We need to manually reset to test the idempotency
            import pymongo
            from motor.motor_asyncio import AsyncIOMotorClient
            
            # Use local MongoDB for this test reset
            local_mongo_client = AsyncIOMotorClient("mongodb://localhost:27017")
            local_db = local_mongo_client["test_database"]
            
            # Reset the flag manually for testing
            await local_db.user_stats.update_one(
                {"telegram_id": TEST_USER_ID},
                {"$set": {"streak_claimed_today": False}}
            )
            print(f"   ✅ Manually reset streak_claimed_today to False")
            
            local_mongo_client.close()
            
            # Verify the reset
            async with session.get(f"{API_BASE}/user-stats/{TEST_USER_ID}") as resp:
                if resp.status == 200:
                    reset_stats = await resp.json()
                    print(f"   Verified streak_claimed_today: {reset_stats.get('streak_claimed_today')}")
        
        # Step 4: First streak-claim call
        print(f"\n4️⃣ First streak-claim call...")
        async with session.post(f"{API_BASE}/users/{TEST_USER_ID}/streak-claim") as resp:
            if resp.status != 200:
                print(f"❌ First claim failed: HTTP {resp.status}")
                text = await resp.text()
                print(f"Response: {text}")
                return False
            
            first_claim = await resp.json()
            first_message = first_claim.get('message', '')
            print(f"   First claim response: '{first_message}'")
        
        # Step 5: Check stats after first claim
        print(f"\n5️⃣ Checking stats after first claim...")
        async with session.get(f"{API_BASE}/user-stats/{TEST_USER_ID}") as resp:
            if resp.status == 200:
                after_first_stats = await resp.json()
                print(f"   After first claim streak_claimed_today: {after_first_stats.get('streak_claimed_today')}")
            else:
                print(f"   ❌ Could not get stats after first claim: HTTP {resp.status}")
        
        # Step 6: Second streak-claim call (idempotency test)
        print(f"\n6️⃣ Second streak-claim call...")
        async with session.post(f"{API_BASE}/users/{TEST_USER_ID}/streak-claim") as resp:
            if resp.status != 200:
                print(f"❌ Second claim failed: HTTP {resp.status}")
                text = await resp.text()
                print(f"Response: {text}")
                return False
            
            second_claim = await resp.json()
            second_message = second_claim.get('message', '')
            print(f"   Second claim response: '{second_message}'")
        
        # Step 7: Analysis
        print(f"\n7️⃣ Analysis:")
        print(f"   First response:  '{first_message}'")
        print(f"   Second response: '{second_message}'")
        
        expected_first = "Награда за стрик получена"
        expected_second = "Награда уже была получена"
        
        if first_message == expected_first and second_message == expected_second:
            print(f"   ✅ IDEMPOTENCY WORKING CORRECTLY")
            return True
        elif first_message == second_message:
            print(f"   ❌ IDEMPOTENCY BUG: Both responses are identical")
            print(f"   🔍 This suggests the database update logic is not working properly")
            return False
        else:
            print(f"   ⚠️ UNEXPECTED RESPONSE PATTERN")
            print(f"   Expected: first='{expected_first}', second='{expected_second}'")
            return False

async def main():
    """Run the detailed investigation"""
    print(f"🎯 Testing backend at: {BACKEND_URL}")
    print(f"📋 Test user ID: {TEST_USER_ID}")
    print(f"⏰ Investigation started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        success = await investigate_streak_claim_bug()
        
        if success:
            print(f"\n🎉 IDEMPOTENCY IS WORKING")
            return 0
        else:
            print(f"\n💥 IDEMPOTENCY BUG CONFIRMED")
            return 1
            
    except Exception as e:
        print(f"\n💥 INVESTIGATION ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)