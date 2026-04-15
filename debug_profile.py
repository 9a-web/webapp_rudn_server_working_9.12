#!/usr/bin/env python3
"""
Debug profile endpoint
"""

import requests
import json

# Test profile endpoint directly
url = "http://localhost:8001/api/profile/765963392"
params = {"viewer_telegram_id": 765963392}

print(f"Testing URL: {url}")
print(f"Params: {params}")

response = requests.get(url, params=params)
print(f"Status: {response.status_code}")
print(f"Response: {response.text}")

# Also test without viewer_telegram_id
print("\n--- Testing without viewer_telegram_id ---")
response2 = requests.get(url)
print(f"Status: {response2.status_code}")
print(f"Response: {response2.text}")