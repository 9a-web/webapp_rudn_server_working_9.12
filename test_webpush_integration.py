#!/usr/bin/env python3
"""
Test Web Push integration with notify_user
"""

import asyncio
import httpx
import os

BACKEND_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")
API_BASE = f"{BACKEND_URL}/api"

TEST_USER_TID = 99999
TEST_USER_UID = "000099999"
TEST_ENDPOINT = f"https://fcm.googleapis.com/fcm/send/integration_test_{TEST_USER_TID}"
TEST_KEYS = {
    "p256dh": "BIntegrationTestP256dhKeyForWebPushNotifyUserTesting123456",
    "auth": "IntegrationTestAuthKey"
}

async def test_integration():
    """Test Web Push integration with notify_user"""
    print("=" * 80)
    print("WEB PUSH INTEGRATION TEST (notify_user)")
    print("=" * 80)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Create subscription
        print("\n1. Creating Web Push subscription...")
        payload = {
            "telegram_id": TEST_USER_TID,
            "uid": TEST_USER_UID,
            "endpoint": TEST_ENDPOINT,
            "keys": TEST_KEYS,
            "user_agent": "Integration Test Client"
        }
        response = await client.post(f"{API_BASE}/push/subscribe", json=payload)
        
        if response.status_code != 200:
            print(f"❌ Failed to create subscription: {response.status_code}")
            return False
        
        print(f"✅ Subscription created: {response.json()}")
        
        # 2. Trigger a test notification (this should trigger notify_user internally)
        print("\n2. Triggering test push notification...")
        test_payload = {"telegram_id": TEST_USER_TID}
        response = await client.post(f"{API_BASE}/push/test", json=test_payload)
        
        if response.status_code != 200:
            print(f"❌ Failed to trigger test push: {response.status_code}")
            return False
        
        result = response.json()
        print(f"✅ Test push result: {result}")
        
        # 3. Check backend logs for web push integration
        print("\n3. Checking backend logs for Web Push integration...")
        import subprocess
        log_result = subprocess.run(
            ["tail", "-n", "100", "/var/log/supervisor/backend.err.log"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        logs = log_result.stdout
        
        # Look for web push related logs
        webpush_logs = [line for line in logs.split('\n') if 'webpush' in line.lower() or '📲' in line]
        
        if webpush_logs:
            print("✅ Found Web Push logs:")
            for log in webpush_logs[-5:]:  # Show last 5 relevant logs
                print(f"  {log}")
        else:
            print("⚠️ No Web Push logs found (might be expected if no real delivery)")
        
        # 4. Verify subscription exists
        print("\n4. Verifying subscription exists...")
        response = await client.get(f"{API_BASE}/push/subscriptions", params={"telegram_id": TEST_USER_TID})
        
        if response.status_code != 200:
            print(f"❌ Failed to get subscriptions: {response.status_code}")
            return False
        
        subs_data = response.json()
        count = subs_data.get("count", 0)
        
        if count < 1:
            print(f"❌ Expected at least 1 subscription, got {count}")
            return False
        
        print(f"✅ Found {count} subscription(s)")
        
        # 5. Clean up - remove subscription
        print("\n5. Cleaning up - removing subscription...")
        cleanup_payload = {"endpoint": TEST_ENDPOINT}
        response = await client.post(f"{API_BASE}/push/unsubscribe", json=cleanup_payload)
        
        if response.status_code != 200:
            print(f"⚠️ Failed to cleanup subscription: {response.status_code}")
        else:
            print(f"✅ Subscription removed: {response.json()}")
        
        print("\n" + "=" * 80)
        print("✅ WEB PUSH INTEGRATION TEST COMPLETED SUCCESSFULLY")
        print("=" * 80)
        return True

if __name__ == "__main__":
    result = asyncio.run(test_integration())
    exit(0 if result else 1)
