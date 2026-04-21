import asyncio
import httpx
import json

async def debug_send_message():
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://social-messaging-hub.preview.emergentagent.com/api/messages/send",
            json={
                "sender_id": 55555,
                "receiver_id": 66666,
                "text": "Debug test message"
            }
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")

asyncio.run(debug_send_message())
