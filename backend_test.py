#!/usr/bin/env python3
"""
Comprehensive Backend API Testing Script for РУДН Schedule App
Testing referral event tracking system as requested in review
"""

import requests
import json
import sys
from datetime import datetime
import time

# Backend URL configuration
BACKEND_URL = "http://localhost:8001"
API_BASE = f"{BACKEND_URL}/api"

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_emoji = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"[{timestamp}] {status_emoji} {test_name}")
    if details:
        print(f"    {details}")
    print()
def test_referral_event_tracking():
    """Test the new referral event tracking system as requested in review"""
    print("=" * 80)
    print("🔍 TESTING REFERRAL EVENT TRACKING SYSTEM")
    print("=" * 80)
    
    # Test data as specified in review request
    creator_telegram_id = 123456789
    creator_name = "Тестер"
    room_name = "Тестовая комната"
    
    joiner_telegram_id = 987654321
    joiner_name = "Новый участник"
    
    try:
        # Step 1: Create room (POST /api/rooms)
        log_test("Step 1: Creating room", "INFO", f"Creating room with telegram_id={creator_telegram_id}")
        
        room_data = {
            "telegram_id": creator_telegram_id,
            "name": room_name,
            "first_name": creator_name
        }
        
        response = requests.post(f"{API_BASE}/rooms", json=room_data, timeout=10)
        
        if response.status_code != 200:
            log_test("POST /api/rooms", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        room_response = response.json()
        room_id = room_response.get("room_id")
        
        if not room_id:
            log_test("POST /api/rooms", "FAIL", "No room_id in response")
            return False
            
        log_test("POST /api/rooms", "PASS", f"Room created successfully. ID: {room_id}")
        
        # Step 2: Generate invite link (POST /api/rooms/{room_id}/invite-link)
        log_test("Step 2: Generating invite link", "INFO", f"Generating invite link for room {room_id}")
        
        invite_data = {
            "telegram_id": creator_telegram_id
        }
        
        response = requests.post(f"{API_BASE}/rooms/{room_id}/invite-link", json=invite_data, timeout=10)
        
        if response.status_code != 200:
            log_test("POST /api/rooms/{room_id}/invite-link", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        invite_response = response.json()
        invite_token = invite_response.get("invite_token")
        invite_link = invite_response.get("invite_link")
        
        if not invite_token:
            log_test("POST /api/rooms/{room_id}/invite-link", "FAIL", "No invite_token in response")
            return False
            
        log_test("POST /api/rooms/{room_id}/invite-link", "PASS", f"Invite link generated. Token: {invite_token}")
        print(f"    Invite link: {invite_link}")
        
        # Step 3: Join by link with referral tracking (POST /api/rooms/join/{invite_token})
        log_test("Step 3: Joining room via invite link", "INFO", f"User {joiner_telegram_id} joining via token {invite_token}")
        
        join_data = {
            "telegram_id": joiner_telegram_id,
            "first_name": joiner_name,
            "referral_code": creator_telegram_id  # ID of the inviter as specified in review
        }
        
        response = requests.post(f"{API_BASE}/rooms/join/{invite_token}", json=join_data, timeout=10)
        
        if response.status_code != 200:
            log_test("POST /api/rooms/join/{invite_token}", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        join_response = response.json()
        
        # Check if the user was successfully added to participants
        participants = join_response.get("participants", [])
        user_found = False
        for participant in participants:
            if participant.get("telegram_id") == joiner_telegram_id:
                user_found = True
                break
        
        if not user_found:
            log_test("POST /api/rooms/join/{invite_token}", "FAIL", f"User not found in participants: {join_response}")
            return False
            
        log_test("POST /api/rooms/join/{invite_token}", "PASS", f"Successfully joined room. User added to participants.")
        
        # Wait a moment for the referral event to be processed
        time.sleep(1)
        
        # Step 4: Check general stats (GET /api/admin/stats)
        log_test("Step 4: Checking general admin stats", "INFO", "Verifying room join statistics")
        
        response = requests.get(f"{API_BASE}/admin/stats", timeout=10)
        
        if response.status_code != 200:
            log_test("GET /api/admin/stats", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        stats_response = response.json()
        
        total_room_joins = stats_response.get("total_room_joins", 0)
        room_joins_today = stats_response.get("room_joins_today", 0)
        
        log_test("GET /api/admin/stats", "PASS", f"Stats retrieved successfully")
        print(f"    Total room joins: {total_room_joins}")
        print(f"    Room joins today: {room_joins_today}")
        
        # Verify expected values
        if total_room_joins < 1:
            log_test("Admin Stats Validation", "FAIL", f"Expected total_room_joins >= 1, got {total_room_joins}")
            return False
            
        if room_joins_today < 1:
            log_test("Admin Stats Validation", "FAIL", f"Expected room_joins_today >= 1, got {room_joins_today}")
            return False
            
        log_test("Admin Stats Validation", "PASS", "Room join statistics are correct")
        
        # Step 5: Check detailed referral stats (GET /api/admin/referral-stats)
        log_test("Step 5: Checking detailed referral stats", "INFO", "Verifying referral event tracking")
        
        response = requests.get(f"{API_BASE}/admin/referral-stats", timeout=10)
        
        if response.status_code != 200:
            log_test("GET /api/admin/referral-stats", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        referral_stats = response.json()
        
        total_events = referral_stats.get("total_events", 0)
        recent_events = referral_stats.get("recent_events", [])
        top_referrers = referral_stats.get("top_referrers", [])
        
        log_test("GET /api/admin/referral-stats", "PASS", f"Referral stats retrieved successfully")
        print(f"    Total events: {total_events}")
        print(f"    Recent events count: {len(recent_events)}")
        print(f"    Top referrers count: {len(top_referrers)}")
        
        # Verify expected values
        if total_events < 1:
            log_test("Referral Stats Validation", "FAIL", f"Expected total_events >= 1, got {total_events}")
            return False
            
        # Check for room_join event in recent events
        room_join_found = False
        for event in recent_events:
            if (event.get("event_type") == "room_join" and 
                event.get("telegram_id") == joiner_telegram_id and
                event.get("referrer_id") == creator_telegram_id):
                room_join_found = True
                log_test("Recent Events Validation", "PASS", f"Found room_join event: {event}")
                break
        
        if not room_join_found:
            log_test("Recent Events Validation", "FAIL", "No matching room_join event found in recent_events")
            print(f"    Recent events: {recent_events}")
            return False
        
        # Check for referrer in top_referrers
        referrer_found = False
        for referrer in top_referrers:
            if referrer.get("referrer_id") == creator_telegram_id:
                referrer_found = True
                log_test("Top Referrers Validation", "PASS", f"Found referrer {creator_telegram_id} in top_referrers: {referrer}")
                break
        
        if not referrer_found:
            log_test("Top Referrers Validation", "FAIL", f"Referrer {creator_telegram_id} not found in top_referrers")
            print(f"    Top referrers: {top_referrers}")
            return False
        
        log_test("Referral Event Tracking System", "PASS", "All referral tracking functionality working correctly!")
        
        return True
        
    except requests.exceptions.RequestException as e:
        log_test("Network Error", "FAIL", f"Request failed: {str(e)}")
        return False
    except Exception as e:
        log_test("Unexpected Error", "FAIL", f"Error: {str(e)}")
        return False
def main():
    """Main test execution"""
    print("🚀 Starting Backend API Testing for Referral Event Tracking System")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Test referral event tracking system
    success = test_referral_event_tracking()
    
    print("=" * 80)
    if success:
        print("🎉 ALL TESTS PASSED - Referral Event Tracking System Working Correctly!")
    else:
        print("💥 TESTS FAILED - Issues found in Referral Event Tracking System")
    print("=" * 80)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
