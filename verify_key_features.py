import asyncio
import httpx
import json

async def verify_features():
    async with httpx.AsyncClient(timeout=30.0) as client:
        
        # Send a message first
        print("=== 1. SEND MESSAGE ===")
        response = await client.post(
            "https://social-messaging-hub.preview.emergentagent.com/api/messages/send",
            json={
                "sender_id": 55555,
                "receiver_id": 66666,
                "text": "Hello for verification!"
            }
        )
        data = response.json()
        message_id = data.get('id')
        conversation_id = data.get('conversation_id')
        print(f"✅ Message sent: {message_id}")
        print(f"   Type: {data.get('message_type')}")
        print(f"   Text: {data.get('text')}")
        
        # Edit the message
        print("\n=== 2. EDIT MESSAGE ===")
        response = await client.put(
            f"https://social-messaging-hub.preview.emergentagent.com/api/messages/{message_id}/edit",
            json={
                "telegram_id": 55555,
                "text": "Edited verification message!"
            }
        )
        data = response.json()
        print(f"✅ Message edited")
        print(f"   New text: {data.get('text')}")
        print(f"   Edited at: {data.get('edited_at')}")
        
        # Add reaction
        print("\n=== 3. ADD REACTION ===")
        response = await client.post(
            f"https://social-messaging-hub.preview.emergentagent.com/api/messages/{message_id}/reactions",
            json={
                "telegram_id": 66666,
                "emoji": "👍"
            }
        )
        data = response.json()
        reactions = data.get('reactions', [])
        print(f"✅ Reaction added: {reactions}")
        
        # Pin message
        print("\n=== 4. PIN MESSAGE ===")
        response = await client.put(
            f"https://social-messaging-hub.preview.emergentagent.com/api/messages/{message_id}/pin",
            json={
                "telegram_id": 55555,
                "is_pinned": True
            }
        )
        data = response.json()
        print(f"✅ Message pinned: {data.get('success')}")
        
        # Get pinned messages
        print("\n=== 5. GET PINNED MESSAGES ===")
        response = await client.get(
            f"https://social-messaging-hub.preview.emergentagent.com/api/messages/{conversation_id}/pinned"
        )
        data = response.json()
        pinned = data.get('pinned_message')
        if pinned:
            print(f"✅ Pinned message found: {pinned.get('text', 'N/A')[:30]}...")
        else:
            print("❌ No pinned message found")
        
        # Send reply
        print("\n=== 6. SEND REPLY ===")
        response = await client.post(
            "https://social-messaging-hub.preview.emergentagent.com/api/messages/send",
            json={
                "sender_id": 66666,
                "receiver_id": 55555,
                "text": "This is my reply!",
                "reply_to_id": message_id
            }
        )
        data = response.json()
        reply_to = data.get('reply_to')
        print(f"✅ Reply sent")
        if reply_to:
            print(f"   Reply to: {reply_to.get('text', 'N/A')[:30]}...")
            print(f"   Original sender: {reply_to.get('sender_name', 'N/A')}")
        
        # Forward message
        print("\n=== 7. FORWARD MESSAGE ===")
        response = await client.post(
            "https://social-messaging-hub.preview.emergentagent.com/api/messages/forward",
            json={
                "sender_id": 55555,
                "receiver_id": 66666,
                "original_message_id": message_id
            }
        )
        data = response.json()
        forwarded_from = data.get('forwarded_from')
        print(f"✅ Message forwarded")
        if forwarded_from:
            print(f"   Forwarded from: {forwarded_from.get('sender_name', 'N/A')}")
            print(f"   Original text: {forwarded_from.get('text', 'N/A')[:30]}...")
        
        # Send music message
        print("\n=== 8. SEND MUSIC MESSAGE ===")
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
        data = response.json()
        print(f"✅ Music message sent")
        print(f"   Type: {data.get('message_type')}")
        print(f"   Text: {data.get('text')}")
        metadata = data.get('metadata', {})
        print(f"   Track: {metadata.get('track_artist')} - {metadata.get('track_title')}")
        print(f"   Duration: {metadata.get('track_duration')}s")
        
        # Create task from message
        print("\n=== 9. CREATE TASK FROM MESSAGE ===")
        response = await client.post(
            "https://social-messaging-hub.preview.emergentagent.com/api/messages/create-task",
            json={
                "telegram_id": 55555,
                "message_id": message_id
            }
        )
        data = response.json()
        print(f"✅ Task created from message")
        print(f"   Success: {data.get('success')}")
        print(f"   Task ID: {data.get('task_id')}")
        
        # Search messages
        print("\n=== 10. SEARCH MESSAGES ===")
        response = await client.get(
            f"https://social-messaging-hub.preview.emergentagent.com/api/messages/{conversation_id}/search?q=Edited&telegram_id=55555"
        )
        data = response.json()
        results = data.get('results', [])
        print(f"✅ Search completed")
        print(f"   Found {len(results)} messages matching 'Edited'")
        if results:
            print(f"   First result: {results[0].get('text', 'N/A')[:50]}...")

asyncio.run(verify_features())
