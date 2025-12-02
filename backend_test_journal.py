
import asyncio
import aiohttp
import uuid

BASE_URL = "http://localhost:8001/api"

async def test_journal_flow():
    async with aiohttp.ClientSession() as session:
        # 1. Create User
        telegram_id = 123456789
        user_data = {
            "telegram_id": telegram_id,
            "username": "testuser",
            "first_name": "Test",
            "last_name": "User",
            "group_id": "test_group",
            "group_name": "TEST-01",
            "facultet_id": "test_fac",
            "facultet_name": "Test Faculty",
            "level_id": "bachelor",
            "kurs": 1,
            "form_code": "full-time",
            "notifications_enabled": False,
            "notification_time": 10
        }
        async with session.post(f"{BASE_URL}/user-settings", json=user_data) as resp:
            print(f"Create User: {resp.status}")
            print(await resp.text())

        # 2. Create Journal
        journal_data = {
            "name": "Test Journal",
            "group_name": "TEST-01",
            "description": "Test Description",
            "telegram_id": telegram_id,
            "color": "blue"
        }
        async with session.post(f"{BASE_URL}/journals", json=journal_data) as resp:
            print(f"Create Journal: {resp.status}")
            result = await resp.json()
            print(result)
            journal_id = result["journal_id"]

        # 3. Generate Invite Link
        async with session.post(f"{BASE_URL}/journals/{journal_id}/invite-link") as resp:
            print(f"Invite Link: {resp.status}")
            invite_result = await resp.json()
            print(invite_result)
            invite_token = invite_result["invite_token"]
            invite_link = invite_result["invite_link"]
            print(f"Token: {invite_token}")
            print(f"Link: {invite_link}")

        # 4. Check Stats
        async with session.get(f"{BASE_URL}/journals/{journal_id}/stats") as resp:
             print(f"Stats: {resp.status}")
             print(await resp.json())

if __name__ == "__main__":
    asyncio.run(test_journal_flow())
