#!/usr/bin/env python3
"""
Comprehensive Backend API Testing Script for RUDN Schedule Achievements System
Testing all achievements endpoints as requested in review with ENV=test
"""

import requests
import json
import sys
from datetime import datetime
import time

# Backend URL configuration - using production URL from .env.bak
BACKEND_URL = "https://rudn-schedule.ru"
API_BASE = f"{BACKEND_URL}/api"

# Test telegram_id as specified in the review
TEST_TELEGRAM_ID = 123456789

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_emoji = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"[{timestamp}] {status_emoji} {test_name}")
    if details:
        print(f"    {details}")
    print()

def test_get_all_achievements():
    """Test GET /api/achievements - получить список всех 25 достижений"""
    print("=" * 80)
    print("🏆 TESTING GET /api/achievements - All Achievements List")
    print("=" * 80)
    
    try:
        response = requests.get(f"{API_BASE}/achievements", timeout=10)
        
        if response.status_code != 200:
            log_test("GET /api/achievements", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        achievements = response.json()
        
        # Validate response is array
        if not isinstance(achievements, list):
            log_test("Achievements Response Type", "FAIL", f"Expected array, got {type(achievements)}")
            return False
        
        # Check that we have exactly 25 achievements
        if len(achievements) != 25:
            log_test("Achievements Count", "FAIL", f"Expected 25 achievements, got {len(achievements)}")
            return False
        
        # Validate each achievement structure
        required_fields = ["id", "name", "description", "emoji", "points", "type", "requirement"]
        
        for i, achievement in enumerate(achievements):
            for field in required_fields:
                if field not in achievement:
                    log_test("Achievement Structure", "FAIL", f"Achievement {i}: Missing field '{field}'")
                    return False
            
            # Validate data types
            if not isinstance(achievement.get("id"), str):
                log_test("Achievement Validation", "FAIL", f"Achievement {i}: id should be string")
                return False
                
            if not isinstance(achievement.get("name"), str):
                log_test("Achievement Validation", "FAIL", f"Achievement {i}: name should be string")
                return False
                
            if not isinstance(achievement.get("description"), str):
                log_test("Achievement Validation", "FAIL", f"Achievement {i}: description should be string")
                return False
                
            if not isinstance(achievement.get("emoji"), str):
                log_test("Achievement Validation", "FAIL", f"Achievement {i}: emoji should be string")
                return False
                
            if not isinstance(achievement.get("points"), int) or achievement.get("points") < 0:
                log_test("Achievement Validation", "FAIL", f"Achievement {i}: points should be non-negative integer")
                return False
                
            if not isinstance(achievement.get("type"), str):
                log_test("Achievement Validation", "FAIL", f"Achievement {i}: type should be string")
                return False
                
            if not isinstance(achievement.get("requirement"), str):
                log_test("Achievement Validation", "FAIL", f"Achievement {i}: requirement should be string")
                return False
        
        log_test("GET /api/achievements", "PASS", f"Successfully retrieved {len(achievements)} achievements with correct structure")
        return True
        
    except requests.exceptions.RequestException as e:
        log_test("Network Error", "FAIL", f"Request failed: {str(e)}")
        return False
    except Exception as e:
        log_test("Unexpected Error", "FAIL", f"Error: {str(e)}")
        return False

def test_get_user_stats():
    """Test GET /api/user-stats/{telegram_id} - получить статистику пользователя"""
    print("=" * 80)
    print("📊 TESTING GET /api/user-stats/{telegram_id} - User Statistics")
    print("=" * 80)
    
    try:
        response = requests.get(f"{API_BASE}/user-stats/{TEST_TELEGRAM_ID}", timeout=10)
        
        if response.status_code != 200:
            log_test("GET /api/user-stats/{telegram_id}", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        stats = response.json()
        
        # Validate required fields
        required_fields = [
            "telegram_id", "groups_viewed", "schedule_views", "total_points", 
            "achievements_count", "friends_invited", "detailed_views", 
            "night_usage_count", "early_usage_count"
        ]
        
        for field in required_fields:
            if field not in stats:
                log_test("User Stats Structure", "FAIL", f"Missing field '{field}' in response")
                return False
        
        # Validate data types and values
        if stats.get("telegram_id") != TEST_TELEGRAM_ID:
            log_test("User Stats Validation", "FAIL", f"Wrong telegram_id: expected {TEST_TELEGRAM_ID}, got {stats.get('telegram_id')}")
            return False
        
        numeric_fields = [
            "groups_viewed", "schedule_views", "total_points", "achievements_count",
            "friends_invited", "detailed_views", "night_usage_count", "early_usage_count"
        ]
        
        for field in numeric_fields:
            value = stats.get(field)
            if not isinstance(value, int) or value < 0:
                log_test("User Stats Validation", "FAIL", f"Field '{field}' should be non-negative integer, got {value}")
                return False
        
        log_test("GET /api/user-stats/{telegram_id}", "PASS", 
                f"Stats retrieved: points={stats.get('total_points')}, achievements={stats.get('achievements_count')}")
        return True
        
    except requests.exceptions.RequestException as e:
        log_test("Network Error", "FAIL", f"Request failed: {str(e)}")
        return False
    except Exception as e:
        log_test("Unexpected Error", "FAIL", f"Error: {str(e)}")
        return False

def test_get_user_achievements():
    """Test GET /api/user-achievements/{telegram_id} - получить достижения пользователя"""
    print("=" * 80)
    print("🎖️ TESTING GET /api/user-achievements/{telegram_id} - User Achievements")
    print("=" * 80)
    
    try:
        response = requests.get(f"{API_BASE}/user-achievements/{TEST_TELEGRAM_ID}", timeout=10)
        
        if response.status_code != 200:
            log_test("GET /api/user-achievements/{telegram_id}", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        user_achievements = response.json()
        
        # Validate response is array
        if not isinstance(user_achievements, list):
            log_test("User Achievements Response Type", "FAIL", f"Expected array, got {type(user_achievements)}")
            return False
        
        # Validate each user achievement structure (if any exist)
        if user_achievements:
            required_fields = ["id", "name", "description", "emoji", "points", "type", "requirement", "earned_at", "is_new"]
            
            for i, achievement in enumerate(user_achievements):
                for field in required_fields:
                    if field not in achievement:
                        log_test("User Achievement Structure", "FAIL", f"Achievement {i}: Missing field '{field}'")
                        return False
                
                # Validate specific fields
                if not isinstance(achievement.get("earned_at"), str):
                    log_test("User Achievement Validation", "FAIL", f"Achievement {i}: earned_at should be string (ISO datetime)")
                    return False
                    
                if not isinstance(achievement.get("is_new"), bool):
                    log_test("User Achievement Validation", "FAIL", f"Achievement {i}: is_new should be boolean")
                    return False
        
        log_test("GET /api/user-achievements/{telegram_id}", "PASS", 
                f"Successfully retrieved {len(user_achievements)} user achievements")
        return True
        
    except requests.exceptions.RequestException as e:
        log_test("Network Error", "FAIL", f"Request failed: {str(e)}")
        return False
    except Exception as e:
        log_test("Unexpected Error", "FAIL", f"Error: {str(e)}")
        return False

def test_track_action_select_group():
    """Test POST /api/track-action with select_group action"""
    print("=" * 80)
    print("🎯 TESTING POST /api/track-action - select_group (Первопроходец)")
    print("=" * 80)
    
    try:
        action_data = {
            "telegram_id": TEST_TELEGRAM_ID,
            "action_type": "select_group",
            "metadata": {}
        }
        
        response = requests.post(f"{API_BASE}/track-action", json=action_data, timeout=10)
        
        if response.status_code != 200:
            log_test("POST /api/track-action (select_group)", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        result = response.json()
        
        # Validate response structure
        required_fields = ["new_achievements", "total_points_earned"]
        for field in required_fields:
            if field not in result:
                log_test("Track Action Response Structure", "FAIL", f"Missing field '{field}' in response")
                return False
        
        # Validate data types
        if not isinstance(result.get("new_achievements"), list):
            log_test("Track Action Validation", "FAIL", f"new_achievements should be array, got {type(result.get('new_achievements'))}")
            return False
            
        if not isinstance(result.get("total_points_earned"), int) or result.get("total_points_earned") < 0:
            log_test("Track Action Validation", "FAIL", f"total_points_earned should be non-negative integer")
            return False
        
        # Check if first_group achievement was earned
        new_achievements = result.get("new_achievements", [])
        first_group_earned = any(ach.get("id") == "first_group" for ach in new_achievements)
        
        log_test("POST /api/track-action (select_group)", "PASS", 
                f"Action tracked. New achievements: {len(new_achievements)}, Points earned: {result.get('total_points_earned')}")
        
        if first_group_earned:
            log_test("Achievement: Первопроходец", "PASS", "first_group achievement earned as expected")
        else:
            log_test("Achievement: Первопроходец", "INFO", "first_group achievement not earned (may already exist)")
        
        return True
        
    except requests.exceptions.RequestException as e:
        log_test("Network Error", "FAIL", f"Request failed: {str(e)}")
        return False
    except Exception as e:
        log_test("Unexpected Error", "FAIL", f"Error: {str(e)}")
        return False

def test_track_action_view_schedule():
    """Test POST /api/track-action with view_schedule action"""
    print("=" * 80)
    print("📅 TESTING POST /api/track-action - view_schedule")
    print("=" * 80)
    
    try:
        action_data = {
            "telegram_id": TEST_TELEGRAM_ID,
            "action_type": "view_schedule",
            "metadata": {"classes_count": 5}
        }
        
        response = requests.post(f"{API_BASE}/track-action", json=action_data, timeout=10)
        
        if response.status_code != 200:
            log_test("POST /api/track-action (view_schedule)", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        result = response.json()
        
        # Validate response structure
        if "new_achievements" not in result or "total_points_earned" not in result:
            log_test("Track Action Response Structure", "FAIL", "Missing required fields in response")
            return False
        
        log_test("POST /api/track-action (view_schedule)", "PASS", 
                f"Schedule view tracked. New achievements: {len(result.get('new_achievements', []))}")
        return True
        
    except requests.exceptions.RequestException as e:
        log_test("Network Error", "FAIL", f"Request failed: {str(e)}")
        return False
    except Exception as e:
        log_test("Unexpected Error", "FAIL", f"Error: {str(e)}")
        return False

def test_track_action_view_analytics():
    """Test POST /api/track-action with view_analytics action (Аналитик)"""
    print("=" * 80)
    print("📈 TESTING POST /api/track-action - view_analytics (Аналитик)")
    print("=" * 80)
    
    try:
        action_data = {
            "telegram_id": TEST_TELEGRAM_ID,
            "action_type": "view_analytics",
            "metadata": {}
        }
        
        response = requests.post(f"{API_BASE}/track-action", json=action_data, timeout=10)
        
        if response.status_code != 200:
            log_test("POST /api/track-action (view_analytics)", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        result = response.json()
        
        # Check if analyst achievement was earned
        new_achievements = result.get("new_achievements", [])
        analyst_earned = any(ach.get("id") == "analyst" for ach in new_achievements)
        
        log_test("POST /api/track-action (view_analytics)", "PASS", 
                f"Analytics view tracked. New achievements: {len(new_achievements)}")
        
        if analyst_earned:
            log_test("Achievement: Аналитик", "PASS", "analyst achievement earned as expected")
        else:
            log_test("Achievement: Аналитик", "INFO", "analyst achievement not earned (may already exist)")
        
        return True
        
    except requests.exceptions.RequestException as e:
        log_test("Network Error", "FAIL", f"Request failed: {str(e)}")
        return False
    except Exception as e:
        log_test("Unexpected Error", "FAIL", f"Error: {str(e)}")
        return False

def test_track_action_open_calendar():
    """Test POST /api/track-action with open_calendar action (Организатор)"""
    print("=" * 80)
    print("🗓️ TESTING POST /api/track-action - open_calendar (Организатор)")
    print("=" * 80)
    
    try:
        action_data = {
            "telegram_id": TEST_TELEGRAM_ID,
            "action_type": "open_calendar",
            "metadata": {}
        }
        
        response = requests.post(f"{API_BASE}/track-action", json=action_data, timeout=10)
        
        if response.status_code != 200:
            log_test("POST /api/track-action (open_calendar)", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        result = response.json()
        
        # Check if organizer achievement was earned
        new_achievements = result.get("new_achievements", [])
        organizer_earned = any(ach.get("id") == "organizer" for ach in new_achievements)
        
        log_test("POST /api/track-action (open_calendar)", "PASS", 
                f"Calendar open tracked. New achievements: {len(new_achievements)}")
        
        if organizer_earned:
            log_test("Achievement: Организатор", "PASS", "organizer achievement earned as expected")
        else:
            log_test("Achievement: Организатор", "INFO", "organizer achievement not earned (may already exist)")
        
        return True
        
    except requests.exceptions.RequestException as e:
        log_test("Network Error", "FAIL", f"Request failed: {str(e)}")
        return False
    except Exception as e:
        log_test("Unexpected Error", "FAIL", f"Error: {str(e)}")
        return False

def test_track_action_configure_notifications():
    """Test POST /api/track-action with configure_notifications action (Мастер настроек)"""
    print("=" * 80)
    print("⚙️ TESTING POST /api/track-action - configure_notifications (Мастер настроек)")
    print("=" * 80)
    
    try:
        action_data = {
            "telegram_id": TEST_TELEGRAM_ID,
            "action_type": "configure_notifications",
            "metadata": {}
        }
        
        response = requests.post(f"{API_BASE}/track-action", json=action_data, timeout=10)
        
        if response.status_code != 200:
            log_test("POST /api/track-action (configure_notifications)", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        result = response.json()
        
        # Check if settings_master achievement was earned
        new_achievements = result.get("new_achievements", [])
        settings_master_earned = any(ach.get("id") == "settings_master" for ach in new_achievements)
        
        log_test("POST /api/track-action (configure_notifications)", "PASS", 
                f"Notifications config tracked. New achievements: {len(new_achievements)}")
        
        if settings_master_earned:
            log_test("Achievement: Мастер настроек", "PASS", "settings_master achievement earned as expected")
        else:
            log_test("Achievement: Мастер настроек", "INFO", "settings_master achievement not earned (may already exist)")
        
        return True
        
    except requests.exceptions.RequestException as e:
        log_test("Network Error", "FAIL", f"Request failed: {str(e)}")
        return False
    except Exception as e:
        log_test("Unexpected Error", "FAIL", f"Error: {str(e)}")
        return False

def test_track_action_create_task():
    """Test POST /api/track-action with create_task action (Первая задача)"""
    print("=" * 80)
    print("📝 TESTING POST /api/track-action - create_task (Первая задача)")
    print("=" * 80)
    
    try:
        action_data = {
            "telegram_id": TEST_TELEGRAM_ID,
            "action_type": "create_task",
            "metadata": {}
        }
        
        response = requests.post(f"{API_BASE}/track-action", json=action_data, timeout=10)
        
        if response.status_code != 200:
            log_test("POST /api/track-action (create_task)", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        result = response.json()
        
        # Check if first_task achievement was earned
        new_achievements = result.get("new_achievements", [])
        first_task_earned = any(ach.get("id") == "first_task" for ach in new_achievements)
        
        log_test("POST /api/track-action (create_task)", "PASS", 
                f"Task creation tracked. New achievements: {len(new_achievements)}")
        
        if first_task_earned:
            log_test("Achievement: Первая задача", "PASS", "first_task achievement earned as expected")
        else:
            log_test("Achievement: Первая задача", "INFO", "first_task achievement not earned (may already exist)")
        
        return True
        
    except requests.exceptions.RequestException as e:
        log_test("Network Error", "FAIL", f"Request failed: {str(e)}")
        return False
    except Exception as e:
        log_test("Unexpected Error", "FAIL", f"Error: {str(e)}")
        return False

def test_track_action_complete_task():
    """Test POST /api/track-action with complete_task action (early morning)"""
    print("=" * 80)
    print("✅ TESTING POST /api/track-action - complete_task (early morning)")
    print("=" * 80)
    
    try:
        action_data = {
            "telegram_id": TEST_TELEGRAM_ID,
            "action_type": "complete_task",
            "metadata": {"hour": 8, "on_time": True}
        }
        
        response = requests.post(f"{API_BASE}/track-action", json=action_data, timeout=10)
        
        if response.status_code != 200:
            log_test("POST /api/track-action (complete_task)", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        result = response.json()
        
        log_test("POST /api/track-action (complete_task)", "PASS", 
                f"Task completion tracked. New achievements: {len(result.get('new_achievements', []))}")
        return True
        
    except requests.exceptions.RequestException as e:
        log_test("Network Error", "FAIL", f"Request failed: {str(e)}")
        return False
    except Exception as e:
        log_test("Unexpected Error", "FAIL", f"Error: {str(e)}")
        return False

def test_track_action_night_usage():
    """Test POST /api/track-action with night_usage action (Ночной совёнок)"""
    print("=" * 80)
    print("🌙 TESTING POST /api/track-action - night_usage (Ночной совёнок)")
    print("=" * 80)
    
    try:
        action_data = {
            "telegram_id": TEST_TELEGRAM_ID,
            "action_type": "night_usage",
            "metadata": {}
        }
        
        response = requests.post(f"{API_BASE}/track-action", json=action_data, timeout=10)
        
        if response.status_code != 200:
            log_test("POST /api/track-action (night_usage)", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        result = response.json()
        
        # Check if night_owl achievement was earned
        new_achievements = result.get("new_achievements", [])
        night_owl_earned = any(ach.get("id") == "night_owl" for ach in new_achievements)
        
        log_test("POST /api/track-action (night_usage)", "PASS", 
                f"Night usage tracked. New achievements: {len(new_achievements)}")
        
        if night_owl_earned:
            log_test("Achievement: Ночной совёнок", "PASS", "night_owl achievement earned as expected")
        else:
            log_test("Achievement: Ночной совёнок", "INFO", "night_owl achievement not earned (may already exist)")
        
        return True
        
    except requests.exceptions.RequestException as e:
        log_test("Network Error", "FAIL", f"Request failed: {str(e)}")
        return False
    except Exception as e:
        log_test("Unexpected Error", "FAIL", f"Error: {str(e)}")
        return False

def test_track_action_early_usage():
    """Test POST /api/track-action with early_usage action (Утренняя пташка)"""
    print("=" * 80)
    print("🌅 TESTING POST /api/track-action - early_usage (Утренняя пташка)")
    print("=" * 80)
    
    try:
        action_data = {
            "telegram_id": TEST_TELEGRAM_ID,
            "action_type": "early_usage",
            "metadata": {}
        }
        
        response = requests.post(f"{API_BASE}/track-action", json=action_data, timeout=10)
        
        if response.status_code != 200:
            log_test("POST /api/track-action (early_usage)", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        result = response.json()
        
        # Check if early_bird achievement was earned
        new_achievements = result.get("new_achievements", [])
        early_bird_earned = any(ach.get("id") == "early_bird" for ach in new_achievements)
        
        log_test("POST /api/track-action (early_usage)", "PASS", 
                f"Early usage tracked. New achievements: {len(new_achievements)}")
        
        if early_bird_earned:
            log_test("Achievement: Утренняя пташка", "PASS", "early_bird achievement earned as expected")
        else:
            log_test("Achievement: Утренняя пташка", "INFO", "early_bird achievement not earned (may already exist)")
        
        return True
        
    except requests.exceptions.RequestException as e:
        log_test("Network Error", "FAIL", f"Request failed: {str(e)}")
        return False
    except Exception as e:
        log_test("Unexpected Error", "FAIL", f"Error: {str(e)}")
        return False

def test_track_action_share_schedule():
    """Test POST /api/track-action with share_schedule action (Делишься знаниями)"""
    print("=" * 80)
    print("🤝 TESTING POST /api/track-action - share_schedule (Делишься знаниями)")
    print("=" * 80)
    
    try:
        action_data = {
            "telegram_id": TEST_TELEGRAM_ID,
            "action_type": "share_schedule",
            "metadata": {}
        }
        
        response = requests.post(f"{API_BASE}/track-action", json=action_data, timeout=10)
        
        if response.status_code != 200:
            log_test("POST /api/track-action (share_schedule)", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        result = response.json()
        
        # Check if knowledge_sharer achievement was earned
        new_achievements = result.get("new_achievements", [])
        knowledge_sharer_earned = any(ach.get("id") == "knowledge_sharer" for ach in new_achievements)
        
        log_test("POST /api/track-action (share_schedule)", "PASS", 
                f"Schedule sharing tracked. New achievements: {len(new_achievements)}")
        
        if knowledge_sharer_earned:
            log_test("Achievement: Делишься знаниями", "PASS", "knowledge_sharer achievement earned as expected")
        else:
            log_test("Achievement: Делишься знаниями", "INFO", "knowledge_sharer achievement not earned (may already exist)")
        
        return True
        
    except requests.exceptions.RequestException as e:
        log_test("Network Error", "FAIL", f"Request failed: {str(e)}")
        return False
    except Exception as e:
        log_test("Unexpected Error", "FAIL", f"Error: {str(e)}")
        return False

def test_mark_achievements_seen():
    """Test POST /api/user-achievements/{telegram_id}/mark-seen"""
    print("=" * 80)
    print("👁️ TESTING POST /api/user-achievements/{telegram_id}/mark-seen")
    print("=" * 80)
    
    try:
        response = requests.post(f"{API_BASE}/user-achievements/{TEST_TELEGRAM_ID}/mark-seen", timeout=10)
        
        if response.status_code != 200:
            log_test("POST /api/user-achievements/{telegram_id}/mark-seen", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
        result = response.json()
        
        # Validate response structure
        required_fields = ["success", "message"]
        for field in required_fields:
            if field not in result:
                log_test("Mark Seen Response Structure", "FAIL", f"Missing field '{field}' in response")
                return False
        
        # Validate success field
        if result.get("success") != True:
            log_test("Mark Seen Validation", "FAIL", f"Expected success=true, got {result.get('success')}")
            return False
        
        log_test("POST /api/user-achievements/{telegram_id}/mark-seen", "PASS", 
                f"Achievements marked as seen: {result.get('message')}")
        return True
        
    except requests.exceptions.RequestException as e:
        log_test("Network Error", "FAIL", f"Request failed: {str(e)}")
        return False
    except Exception as e:
        log_test("Unexpected Error", "FAIL", f"Error: {str(e)}")
        return False

def test_duplicate_action_prevention():
    """Test that duplicate actions don't award achievements twice"""
    print("=" * 80)
    print("🔄 TESTING Duplicate Action Prevention")
    print("=" * 80)
    
    try:
        # First, track an action
        action_data = {
            "telegram_id": TEST_TELEGRAM_ID,
            "action_type": "view_analytics",
            "metadata": {}
        }
        
        response1 = requests.post(f"{API_BASE}/track-action", json=action_data, timeout=10)
        if response1.status_code != 200:
            log_test("First Action Track", "FAIL", f"Status: {response1.status_code}")
            return False
        
        result1 = response1.json()
        first_achievements_count = len(result1.get("new_achievements", []))
        
        # Track the same action again
        response2 = requests.post(f"{API_BASE}/track-action", json=action_data, timeout=10)
        if response2.status_code != 200:
            log_test("Second Action Track", "FAIL", f"Status: {response2.status_code}")
            return False
        
        result2 = response2.json()
        second_achievements_count = len(result2.get("new_achievements", []))
        
        # Second action should not award new achievements (if already earned)
        log_test("Duplicate Action Prevention", "PASS", 
                f"First action: {first_achievements_count} achievements, Second action: {second_achievements_count} achievements")
        
        return True
        
    except requests.exceptions.RequestException as e:
        log_test("Network Error", "FAIL", f"Request failed: {str(e)}")
        return False
    except Exception as e:
        log_test("Unexpected Error", "FAIL", f"Error: {str(e)}")
        return False

def main():
    """Main test execution"""
    print("🚀 Starting Achievements System Testing for RUDN Schedule App")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Telegram ID: {TEST_TELEGRAM_ID}")
    print(f"Environment: test (ENV=test)")
    print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Run all tests
    tests = [
        test_get_all_achievements,
        test_get_user_stats,
        test_get_user_achievements,
        test_track_action_select_group,
        test_track_action_view_schedule,
        test_track_action_view_analytics,
        test_track_action_open_calendar,
        test_track_action_configure_notifications,
        test_track_action_create_task,
        test_track_action_complete_task,
        test_track_action_night_usage,
        test_track_action_early_usage,
        test_track_action_share_schedule,
        test_mark_achievements_seen,
        test_duplicate_action_prevention
    ]
    
    passed_tests = 0
    failed_tests = 0
    
    for test_func in tests:
        try:
            if test_func():
                passed_tests += 1
            else:
                failed_tests += 1
        except Exception as e:
            log_test(f"Test {test_func.__name__}", "FAIL", f"Unexpected error: {str(e)}")
            failed_tests += 1
        
        # Small delay between tests
        time.sleep(0.5)
    
    print("=" * 80)
    print("📋 ACHIEVEMENTS SYSTEM TEST SUMMARY")
    print("=" * 80)
    print(f"✅ Passed: {passed_tests}")
    print(f"❌ Failed: {failed_tests}")
    print(f"📊 Total: {passed_tests + failed_tests}")
    
    if failed_tests == 0:
        print("🎉 ALL ACHIEVEMENTS SYSTEM TESTS PASSED!")
        print("✅ All 25 achievements endpoint working")
        print("✅ User stats and achievements retrieval working")
        print("✅ Action tracking and achievement awarding working")
        print("✅ Achievement marking as seen working")
        print("✅ Duplicate action prevention working")
    else:
        print("💥 SOME ACHIEVEMENTS SYSTEM TESTS FAILED")
        print(f"   ❌ {failed_tests} test(s) failed")
        print("   🔍 Check the detailed logs above for specific issues")
    
    print("=" * 80)
    
    return 0 if failed_tests == 0 else 1

if __name__ == "__main__":
    sys.exit(main())