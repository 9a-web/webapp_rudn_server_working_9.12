import asyncio
import httpx
import json

async def debug_tests():
    async with httpx.AsyncClient(timeout=30.0) as client:
        
        # Debug typing status
        print("=== DEBUG TYPING STATUS ===")
        response = await client.get(
            "https://social-messaging-hub.preview.emergentagent.com/api/messages/51f1f801-21c0-4714-befa-6510b98662e8/typing?telegram_id=66666"
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        print("\n=== DEBUG MUSIC MESSAGE ===")
        # Debug music message
        response = await client.post(
            "https://social-messaging-hub.preview.emergentagent.com/api/messages/send-music",
            json={
                "sender_id": 55555,
                "receiver_id": 66666,
                "track_title": "Bohemian Rhapsody",
                "track_artist": "Queen",
                "track_duration": 355
            }
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")

asyncio.run(debug_tests())
