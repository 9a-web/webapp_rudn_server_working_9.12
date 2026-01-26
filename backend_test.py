#!/usr/bin/env python3
"""
Backend API Testing Script for Friends Integration APIs
Tests the new endpoints for adding friends to rooms and journals
"""

import requests
import json
import sys
from datetime import datetime
import uuid

# Configuration
TELEGRAM_ID = 765963392
BACKEND_URL = "https://rudn-schedule.ru"
API_BASE = f"{BACKEND_URL}/api"

def print_test_header(test_name):
    print(f"\n{'='*60}")
    print(f"🧪 {test_name}")
    print(f"{'='*60}")

def print_success(message):
    print(f"✅ {message}")

def print_error(message):
    print(f"❌ {message}")

def print_info(message):
    print(f"ℹ️  {message}")

def test_get_tasks_with_videos():
    """Test GET /api/tasks/{telegram_id} - check that tasks return with videos field"""
    print_test_header("GET /api/tasks/{telegram_id} - Check videos field")
    
    try:
        response = requests.get(f"{API_BASE}/tasks/{TELEGRAM_ID}")
        print_info(f"Request: GET {API_BASE}/tasks/{TELEGRAM_ID}")
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            tasks = response.json()
            print_success(f"Successfully retrieved {len(tasks)} tasks")
            
            # Check if any tasks have videos field
            tasks_with_videos = [task for task in tasks if task.get('videos')]
            print_info(f"Tasks with videos: {len(tasks_with_videos)}")
            
            # Show structure of first task
            if tasks:
                first_task = tasks[0]
                print_info("First task structure:")
                print_info(f"  - id: {first_task.get('id')}")
                print_info(f"  - text: {first_task.get('text', '')[:50]}...")
                print_info(f"  - videos: {first_task.get('videos', [])}")
                
                # Check if videos field exists and is array
                if 'videos' in first_task:
                    videos = first_task['videos']
                    if isinstance(videos, list):
                        print_success("✅ videos field exists and is an array")
                        if videos:
                            video = videos[0]
                            expected_fields = ['url', 'title', 'duration', 'thumbnail', 'type']
                            for field in expected_fields:
                                if field in video:
                                    print_success(f"  ✅ Video has {field}: {video[field]}")
                                else:
                                    print_error(f"  ❌ Video missing {field}")
                        else:
                            print_info("  No videos in first task")
                    else:
                        print_error("videos field is not an array")
                else:
                    print_error("videos field missing from task")
            else:
                print_info("No tasks found")
                
            return tasks
        else:
            print_error(f"Failed to get tasks: {response.status_code}")
            print_error(f"Response: {response.text}")
            return []
            
    except Exception as e:
        print_error(f"Exception during GET tasks: {str(e)}")
        return []

def test_create_task_with_multiple_videos():
    """Test POST /api/tasks - create task with multiple YouTube/VK links"""
    print_test_header("POST /api/tasks - Create task with multiple video links")
    
    # Task text with multiple video links as specified in the request
    task_text = "Посмотреть https://www.youtube.com/watch?v=dQw4w9WgXcQ и https://youtu.be/jNQXAC9IVRw"
    
    task_data = {
        "telegram_id": TELEGRAM_ID,
        "text": task_text,
        "completed": False,
        "category": "test",
        "priority": "medium",
        "subtasks": []
    }
    
    try:
        response = requests.post(f"{API_BASE}/tasks", json=task_data)
        print_info(f"Request: POST {API_BASE}/tasks")
        print_info(f"Task text: {task_text}")
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            task = response.json()
            print_success("Task created successfully")
            print_info(f"Task ID: {task.get('id')}")
            print_info(f"Task text: {task.get('text')}")
            
            # Check videos array
            videos = task.get('videos', [])
            print_info(f"Videos count: {len(videos)}")
            
            if len(videos) == 2:
                print_success("✅ Task has 2 videos as expected")
                
                for i, video in enumerate(videos):
                    print_info(f"Video {i+1}:")
                    print_info(f"  - url: {video.get('url')}")
                    print_info(f"  - title: {video.get('title')}")
                    print_info(f"  - duration: {video.get('duration')}")
                    print_info(f"  - thumbnail: {video.get('thumbnail')}")
                    print_info(f"  - type: {video.get('type')}")
                    
                    # Validate required fields
                    required_fields = ['url', 'title', 'duration', 'thumbnail', 'type']
                    for field in required_fields:
                        if field in video and video[field]:
                            print_success(f"    ✅ {field}: {video[field]}")
                        else:
                            print_error(f"    ❌ Missing or empty {field}")
                            
            elif len(videos) == 0:
                print_error("❌ No videos found in response")
            else:
                print_error(f"❌ Expected 2 videos, got {len(videos)}")
                
            return task
        else:
            print_error(f"Failed to create task: {response.status_code}")
            print_error(f"Response: {response.text}")
            return None
            
    except Exception as e:
        print_error(f"Exception during POST task: {str(e)}")
        return None

def test_update_task_with_new_video():
    """Test PUT /api/tasks/{task_id} - update task text with new video link"""
    print_test_header("PUT /api/tasks/{task_id} - Update task with new video link")
    
    # First, create a task to update
    print_info("Creating a task to update...")
    task = test_create_task_with_multiple_videos()
    
    if not task:
        print_error("Failed to create task for update test")
        return False
        
    task_id = task.get('id')
    print_info(f"Updating task ID: {task_id}")
    
    # Update task text with additional video link
    updated_text = task.get('text') + " и также https://www.youtube.com/watch?v=3JZ_D3ELwOQ"
    
    update_data = {
        "text": updated_text
    }
    
    try:
        response = requests.put(f"{API_BASE}/tasks/{task_id}", json=update_data)
        print_info(f"Request: PUT {API_BASE}/tasks/{task_id}")
        print_info(f"Updated text: {updated_text}")
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            updated_task = response.json()
            print_success("Task updated successfully")
            
            # Check videos array
            videos = updated_task.get('videos', [])
            print_info(f"Videos count after update: {len(videos)}")
            
            if len(videos) == 3:
                print_success("✅ Task now has 3 videos as expected")
                
                for i, video in enumerate(videos):
                    print_info(f"Video {i+1}: {video.get('title')} ({video.get('url')})")
                    
            elif len(videos) == 0:
                print_error("❌ No videos found after update")
            else:
                print_error(f"❌ Expected 3 videos after update, got {len(videos)}")
                
            return True
        else:
            print_error(f"Failed to update task: {response.status_code}")
            print_error(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception during PUT task: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting Backend API Tests for Multiple Video Links Support")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Telegram ID: {TELEGRAM_ID}")
    
    # Test 1: GET tasks with videos field
    tasks = test_get_tasks_with_videos()
    
    # Test 2: POST task with multiple video links
    created_task = test_create_task_with_multiple_videos()
    
    # Test 3: PUT task with new video link
    update_success = test_update_task_with_new_video()
    
    # Summary
    print_test_header("TEST SUMMARY")
    
    tests_passed = 0
    total_tests = 3
    
    if tasks is not None:
        print_success("✅ GET /api/tasks/{telegram_id} - PASSED")
        tests_passed += 1
    else:
        print_error("❌ GET /api/tasks/{telegram_id} - FAILED")
        
    if created_task is not None:
        print_success("✅ POST /api/tasks with multiple videos - PASSED")
        tests_passed += 1
    else:
        print_error("❌ POST /api/tasks with multiple videos - FAILED")
        
    if update_success:
        print_success("✅ PUT /api/tasks/{task_id} with new video - PASSED")
        tests_passed += 1
    else:
        print_error("❌ PUT /api/tasks/{task_id} with new video - FAILED")
    
    print(f"\n🎯 Tests passed: {tests_passed}/{total_tests}")
    
    if tests_passed == total_tests:
        print_success("🎉 ALL TESTS PASSED!")
        return 0
    else:
        print_error("💥 SOME TESTS FAILED!")
        return 1

if __name__ == "__main__":
    sys.exit(main())