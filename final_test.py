#!/usr/bin/env python3
"""
Final idempotency test - handles case where user already claimed today.
"""
import asyncio
import aiohttp
from datetime import datetime, timedelta

# Backend URL - using localhost:8001 as requested
BACKEND_URL = "http://localhost:8001"
API_BASE = f"{BACKEND_URL}/api"
TEST_USER_ID = 999998  # Using different user to avoid previous state

async def test_fresh_user_streak_claim():
    """
    Test with a fresh user to ensure clean state
    """
    print("🧪 Testing streak-claim endpoint idempotency with fresh user...")
    
    async with aiohttp.ClientSession() as session:
        
        # Step 1: Call visit to create user and ensure they have a streak but haven't claimed
        print(f"\n1️⃣ Calling POST /api/users/{TEST_USER_ID}/visit...")
        async with session.post(f"{API_BASE}/users/{TEST_USER_ID}/visit") as resp:
            if resp.status != 200:
                print(f"❌ Visit endpoint failed: HTTP {resp.status}")
                text = await resp.text()
                print(f"Response: {text}")
                return False
            
            visit_data = await resp.json()
            print(f"✅ Visit successful: is_new_day={visit_data.get('is_new_day')}, streak={visit_data.get('visit_streak_current')}")
        
        # Check user stats after visit
        async with session.get(f"{API_BASE}/user-stats/{TEST_USER_ID}") as resp:
            if resp.status == 200:
                stats_data = await resp.json()
                claimed_status = stats_data.get('streak_claimed_today', 'unknown')
                print(f"   streak_claimed_today after visit: {claimed_status}")
                
                # If already claimed, this user was used before, but we'll continue the test
                if claimed_status == True:
                    print(f"   ⚠️ User already claimed today - test will show idempotency from 'already claimed' state")
            else:
                print(f"   ⚠️ Could not get user stats: HTTP {resp.status}")
        
        # Step 2: First streak-claim call
        print(f"\n2️⃣ First streak-claim call...")
        async with session.post(f"{API_BASE}/users/{TEST_USER_ID}/streak-claim") as resp:
            if resp.status != 200:
                print(f"❌ First streak-claim failed: HTTP {resp.status}")
                text = await resp.text()
                print(f"Response: {text}")
                return False
            
            first_claim = await resp.json()
            first_message = first_claim.get('message', '')
            print(f"✅ First claim response: {first_message}")
        
        # Step 3: Second streak-claim call immediately
        print(f"\n3️⃣ Second streak-claim call (idempotency test)...")
        async with session.post(f"{API_BASE}/users/{TEST_USER_ID}/streak-claim") as resp:
            if resp.status != 200:
                print(f"❌ Second streak-claim failed: HTTP {resp.status}")
                text = await resp.text()
                print(f"Response: {text}")
                return False
            
            second_claim = await resp.json()
            second_message = second_claim.get('message', '')
            print(f"✅ Second claim response: {second_message}")
        
        # Analysis: Both calls should return "Награда уже была получена" if user already claimed
        # OR first should return "Награда за стрик получена" and second "Награда уже была получена"
        print(f"\n🔍 Analysis:")
        print(f"   First call:  '{first_message}'")
        print(f"   Second call: '{second_message}'")
        
        # Check for idempotency
        if first_message == "Награда за стрик получена" and second_message == "Награда уже была получена":
            print(f"   ✅ PERFECT: Fresh claim + idempotency working correctly")
            return True
        elif first_message == "Награда уже была получена" and second_message == "Награда уже была получена":
            print(f"   ✅ IDEMPOTENCY: Both calls correctly return 'already claimed' (user already claimed today)")
            return True
        elif first_message == second_message and first_message == "Награда за стрик получена":
            print(f"   ❌ BUG: Both calls return 'reward claimed' - idempotency broken")
            return False
        else:
            print(f"   ⚠️ UNEXPECTED: Response pattern not recognized")
            return False

async def main():
    print(f"🎯 Testing backend at: {BACKEND_URL}")
    print(f"📋 Test user ID: {TEST_USER_ID}")
    print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        success = await test_fresh_user_streak_claim()
        
        if success:
            print(f"\n🎉 IDEMPOTENCY TEST PASSED")
            return 0
        else:
            print(f"\n💥 IDEMPOTENCY TEST FAILED")
            return 1
            
    except Exception as e:
        print(f"\n💥 TEST ERROR: {e}")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)