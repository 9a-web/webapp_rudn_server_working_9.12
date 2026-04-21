#!/usr/bin/env python3
"""
Team Tasks Backend API Testing Script
Tests all new Team Tasks endpoints according to the review request specifications
"""

import requests
import json
import sys
import os
from pymongo import MongoClient

# Get backend URL from environment 
BACKEND_URL = "https://server-preview.preview.emergentagent.com/api"

# MongoDB connection for direct database access
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"

def print_test_result(test_name, success, details=None):
    """Print formatted test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"   {details}")
    print()

class TeamTasksTester:
    def __init__(self):
        self.owner_id = 11111
        self.member_id = 22222
        self.room_id = None
        self.invite_token = None
        self.task1_id = None
        self.task2_id = None
        self.comment_id = None
        
    def setup_users(self):
        """Setup: Create owner and member users"""
        print("🔄 Setup: Creating users...")
        
        # Create owner user
        owner_payload = {
            "telegram_id": self.owner_id,
            "username": "testowner",
            "first_name": "Owner",
            "group_id": "G1",
            "group_name": "G1",
            "facultet_id": "F1",
            "level_id": "L1",
            "kurs": "1",
            "form_code": "ОФО"
        }
        
        try:
            response = requests.post(f"{BACKEND_URL}/user-settings", json=owner_payload, timeout=30)
            if response.status_code != 200:
                print_test_result("Create Owner User", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
            # Create member user  
            member_payload = {
                "telegram_id": self.member_id,
                "username": "testmember",
                "first_name": "Member",
                "group_id": "G1",
                "group_name": "G1",
                "facultet_id": "F1",
                "level_id": "L1",
                "kurs": "1",
                "form_code": "ОФО"
            }
            
            response = requests.post(f"{BACKEND_URL}/user-settings", json=member_payload, timeout=30)
            if response.status_code != 200:
                print_test_result("Create Member User", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
            print_test_result("Create Users", True, "Owner and member users created")
            return True
            
        except Exception as e:
            print_test_result("Create Users", False, f"Exception: {str(e)}")
            return False
    
    def setup_room(self):
        """Setup: Create room and join member"""
        print("🔄 Setup: Creating room...")
        
        # Create room
        room_payload = {
            "name": "Test Room",
            "telegram_id": self.owner_id
        }
        
        try:
            response = requests.post(f"{BACKEND_URL}/rooms", json=room_payload, timeout=30)
            if response.status_code != 200:
                print_test_result("Create Room", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
            room_data = response.json()
            self.room_id = room_data.get("room_id")
            
            if not self.room_id:
                print_test_result("Create Room", False, "No room_id in response")
                return False
            
            # Get invite token from MongoDB
            try:
                client = MongoClient(MONGO_URL)
                db = client[DB_NAME]
                room_doc = db.rooms.find_one({"room_id": self.room_id})
                if room_doc:
                    self.invite_token = room_doc.get("invite_token")
                client.close()
            except Exception as e:
                print_test_result("Get Invite Token", False, f"MongoDB error: {str(e)}")
                return False
                
            if not self.invite_token:
                print_test_result("Get Invite Token", False, "No invite_token found in MongoDB")
                return False
                
            # Join member to room
            join_payload = {
                "telegram_id": self.member_id,
                "first_name": "Member",
                "username": "testmember"
            }
            
            response = requests.post(f"{BACKEND_URL}/rooms/join/{self.invite_token}", json=join_payload, timeout=30)
            if response.status_code != 200:
                print_test_result("Join Room", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
            print_test_result("Setup Room", True, f"Room created (ID: {self.room_id}) and member joined")
            return True
            
        except Exception as e:
            print_test_result("Setup Room", False, f"Exception: {str(e)}")
            return False
    
    def setup_tasks(self):
        """Setup: Create high and low priority tasks"""
        print("🔄 Setup: Creating tasks...")
        
        # Create high priority task
        task1_payload = {
            "title": "Important Task",
            "telegram_id": self.owner_id,
            "room_id": self.room_id,
            "priority": "high"
        }
        
        try:
            response = requests.post(f"{BACKEND_URL}/group-tasks", json=task1_payload, timeout=30)
            if response.status_code != 200:
                print_test_result("Create High Priority Task", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
            task1_data = response.json()
            self.task1_id = task1_data.get("task_id")
            
            # Create low priority task
            task2_payload = {
                "title": "Simple Task",
                "telegram_id": self.owner_id,
                "room_id": self.room_id,
                "priority": "low"
            }
            
            response = requests.post(f"{BACKEND_URL}/group-tasks", json=task2_payload, timeout=30)
            if response.status_code != 200:
                print_test_result("Create Low Priority Task", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
            task2_data = response.json()
            self.task2_id = task2_data.get("task_id")
            
            print_test_result("Setup Tasks", True, f"Created 2 tasks (IDs: {self.task1_id}, {self.task2_id})")
            return True
            
        except Exception as e:
            print_test_result("Setup Tasks", False, f"Exception: {str(e)}")
            return False
    
    def test_pin_task(self):
        """Test 7: Pin task"""
        print("🔄 Testing: Pin Task...")
        
        pin_payload = {
            "telegram_id": self.owner_id,
            "pinned": True
        }
        
        try:
            response = requests.put(f"{BACKEND_URL}/group-tasks/{self.task1_id}/pin", json=pin_payload, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("pinned") is True:
                    print_test_result("Pin Task", True, "Task pinned successfully")
                    return True
                else:
                    print_test_result("Pin Task", False, f"Expected pinned=true, got: {data.get('pinned')}")
                    return False
            else:
                print_test_result("Pin Task", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            print_test_result("Pin Task", False, f"Exception: {str(e)}")
            return False
    
    def test_pin_unauthorized(self):
        """Test 8: Pin by non-participant (should fail)"""
        print("🔄 Testing: Pin by Non-Participant...")
        
        pin_payload = {
            "telegram_id": 99999,
            "pinned": True
        }
        
        try:
            response = requests.put(f"{BACKEND_URL}/group-tasks/{self.task1_id}/pin", json=pin_payload, timeout=30)
            
            if response.status_code == 403:
                print_test_result("Pin by Non-Participant", True, "Correctly returned 403 error")
                return True
            else:
                print_test_result("Pin by Non-Participant", False, f"Expected 403, got HTTP {response.status_code}")
                return False
                
        except Exception as e:
            print_test_result("Pin by Non-Participant", False, f"Exception: {str(e)}")
            return False
    
    def test_get_tasks_pinned_first(self):
        """Test 9: Verify pinned task appears first"""
        print("🔄 Testing: Pinned Task First...")
        
        try:
            response = requests.get(f"{BACKEND_URL}/rooms/{self.room_id}/tasks", timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) >= 2:
                    # First task should be pinned
                    if data[0].get("pinned") is True and data[0].get("title") == "Important Task":
                        print_test_result("Pinned Task First", True, "Pinned task appears first")
                        return True
                    else:
                        print_test_result("Pinned Task First", False, f"First task not pinned: {data[0]}")
                        return False
                else:
                    print_test_result("Pinned Task First", False, f"Expected at least 2 tasks, got: {len(data) if isinstance(data, list) else 'not list'}")
                    return False
            else:
                print_test_result("Pinned Task First", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            print_test_result("Pinned Task First", False, f"Exception: {str(e)}")
            return False
    
    def test_filter_high_priority(self):
        """Test 10: Filter by high priority"""
        print("🔄 Testing: Filter High Priority...")
        
        try:
            response = requests.get(f"{BACKEND_URL}/rooms/{self.room_id}/tasks?priority=high", timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) == 1:
                    if data[0].get("priority") == "high" and data[0].get("title") == "Important Task":
                        print_test_result("Filter High Priority", True, "Correctly filtered 1 high priority task")
                        return True
                    else:
                        print_test_result("Filter High Priority", False, f"Wrong task returned: {data[0]}")
                        return False
                else:
                    print_test_result("Filter High Priority", False, f"Expected 1 task, got: {len(data) if isinstance(data, list) else 'not list'}")
                    return False
            else:
                print_test_result("Filter High Priority", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            print_test_result("Filter High Priority", False, f"Exception: {str(e)}")
            return False
    
    def test_filter_created_status(self):
        """Test 11: Filter by status=created"""
        print("🔄 Testing: Filter Created Status...")
        
        try:
            response = requests.get(f"{BACKEND_URL}/rooms/{self.room_id}/tasks?status=created", timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) == 2:
                    print_test_result("Filter Created Status", True, "Correctly returned 2 tasks with created status")
                    return True
                else:
                    print_test_result("Filter Created Status", False, f"Expected 2 tasks, got: {len(data) if isinstance(data, list) else 'not list'}")
                    return False
            else:
                print_test_result("Filter Created Status", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            print_test_result("Filter Created Status", False, f"Exception: {str(e)}")
            return False
    
    def test_sort_by_priority(self):
        """Test 12: Sort by priority"""
        print("🔄 Testing: Sort by Priority...")
        
        try:
            response = requests.get(f"{BACKEND_URL}/rooms/{self.room_id}/tasks?sort_by=priority", timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) >= 2:
                    # High priority should come first
                    if data[0].get("priority") == "high" and data[0].get("title") == "Important Task":
                        print_test_result("Sort by Priority", True, "High priority task first")
                        return True
                    else:
                        print_test_result("Sort by Priority", False, f"Wrong order: {[t.get('priority') for t in data]}")
                        return False
                else:
                    print_test_result("Sort by Priority", False, f"Expected at least 2 tasks, got: {len(data) if isinstance(data, list) else 'not list'}")
                    return False
            else:
                print_test_result("Sort by Priority", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            print_test_result("Sort by Priority", False, f"Exception: {str(e)}")
            return False
    
    def test_add_comment(self):
        """Test 13: Add comment"""
        print("🔄 Testing: Add Comment...")
        
        comment_payload = {
            "task_id": self.task1_id,
            "telegram_id": self.member_id,
            "text": "Test comment"
        }
        
        try:
            response = requests.post(f"{BACKEND_URL}/group-tasks/{self.task1_id}/comments", json=comment_payload, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                self.comment_id = data.get("comment_id")
                if self.comment_id and data.get("text") == "Test comment":
                    print_test_result("Add Comment", True, f"Comment added with ID: {self.comment_id}")
                    return True
                else:
                    print_test_result("Add Comment", False, f"Missing comment_id or wrong text: {data}")
                    return False
            else:
                print_test_result("Add Comment", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            print_test_result("Add Comment", False, f"Exception: {str(e)}")
            return False
    
    def test_edit_comment(self):
        """Test 14: Edit comment"""
        print("🔄 Testing: Edit Comment...")
        
        if not self.comment_id:
            print_test_result("Edit Comment", False, "No comment_id from previous test")
            return False
        
        edit_payload = {
            "telegram_id": self.member_id,
            "text": "Edited comment"
        }
        
        try:
            response = requests.put(f"{BACKEND_URL}/group-tasks/{self.task1_id}/comments/{self.comment_id}", json=edit_payload, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("text") == "Edited comment" and data.get("edited") is True:
                    print_test_result("Edit Comment", True, "Comment edited successfully")
                    return True
                else:
                    print_test_result("Edit Comment", False, f"Wrong text or edited flag: {data}")
                    return False
            else:
                print_test_result("Edit Comment", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            print_test_result("Edit Comment", False, f"Exception: {str(e)}")
            return False
    
    def test_edit_comment_unauthorized(self):
        """Test 15: Edit comment by wrong user (should fail)"""
        print("🔄 Testing: Edit Comment by Wrong User...")
        
        if not self.comment_id:
            print_test_result("Edit Comment by Wrong User", False, "No comment_id from previous test")
            return False
        
        edit_payload = {
            "telegram_id": self.owner_id,
            "text": "Hack attempt"
        }
        
        try:
            response = requests.put(f"{BACKEND_URL}/group-tasks/{self.task1_id}/comments/{self.comment_id}", json=edit_payload, timeout=30)
            
            if response.status_code == 403:
                print_test_result("Edit Comment by Wrong User", True, "Correctly returned 403 error")
                return True
            else:
                print_test_result("Edit Comment by Wrong User", False, f"Expected 403, got HTTP {response.status_code}")
                return False
                
        except Exception as e:
            print_test_result("Edit Comment by Wrong User", False, f"Exception: {str(e)}")
            return False
    
    def test_delete_comment(self):
        """Test 16: Delete comment"""
        print("🔄 Testing: Delete Comment...")
        
        if not self.comment_id:
            print_test_result("Delete Comment", False, "No comment_id from previous test")
            return False
        
        delete_payload = {
            "telegram_id": self.member_id
        }
        
        try:
            response = requests.delete(f"{BACKEND_URL}/group-tasks/{self.task1_id}/comments/{self.comment_id}", json=delete_payload, timeout=30)
            
            if response.status_code == 200:
                print_test_result("Delete Comment", True, "Comment deleted successfully")
                return True
            else:
                print_test_result("Delete Comment", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            print_test_result("Delete Comment", False, f"Exception: {str(e)}")
            return False
    
    def test_transfer_ownership(self):
        """Test 17: Transfer ownership"""
        print("🔄 Testing: Transfer Ownership...")
        
        transfer_payload = {
            "current_owner": self.owner_id,
            "new_owner": self.member_id
        }
        
        try:
            response = requests.put(f"{BACKEND_URL}/rooms/{self.room_id}/transfer-ownership", json=transfer_payload, timeout=30)
            
            if response.status_code == 200:
                print_test_result("Transfer Ownership", True, "Ownership transferred successfully")
                return True
            else:
                print_test_result("Transfer Ownership", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            print_test_result("Transfer Ownership", False, f"Exception: {str(e)}")
            return False
    
    def test_kick_participant(self):
        """Test 18: Kick participant (by new owner)"""
        print("🔄 Testing: Kick Participant...")
        
        kick_payload = {
            "kicked_by": self.member_id  # member is now owner
        }
        
        try:
            response = requests.delete(f"{BACKEND_URL}/rooms/{self.room_id}/participants/{self.owner_id}", json=kick_payload, timeout=30)
            
            if response.status_code == 200:
                print_test_result("Kick Participant", True, "Participant kicked successfully")
                return True
            else:
                print_test_result("Kick Participant", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            print_test_result("Kick Participant", False, f"Exception: {str(e)}")
            return False
    
    def test_verify_single_participant(self):
        """Test 19: Verify room has only 1 participant left"""
        print("🔄 Testing: Verify Single Participant...")
        
        try:
            client = MongoClient(MONGO_URL)
            db = client[DB_NAME]
            room_doc = db.rooms.find_one({"room_id": self.room_id})
            client.close()
            
            if room_doc:
                participants = room_doc.get("participants", [])
                if len(participants) == 1 and participants[0].get("telegram_id") == self.member_id:
                    print_test_result("Verify Single Participant", True, "Room has 1 participant (new owner)")
                    return True
                else:
                    print_test_result("Verify Single Participant", False, f"Expected 1 participant (member), got: {participants}")
                    return False
            else:
                print_test_result("Verify Single Participant", False, "Room not found in MongoDB")
                return False
                
        except Exception as e:
            print_test_result("Verify Single Participant", False, f"Exception: {str(e)}")
            return False
    
    def cleanup(self):
        """Cleanup test data"""
        print("🔄 Cleanup: Removing test data...")
        
        try:
            client = MongoClient(MONGO_URL)
            db = client[DB_NAME]
            
            # Remove test users
            db.user_settings.delete_many({"telegram_id": {"$in": [self.owner_id, self.member_id]}})
            
            # Remove test room and tasks
            if self.room_id:
                db.rooms.delete_one({"room_id": self.room_id})
                db.group_tasks.delete_many({"room_id": self.room_id})
            
            client.close()
            print_test_result("Cleanup", True, "Test data removed")
            return True
            
        except Exception as e:
            print_test_result("Cleanup", False, f"Exception: {str(e)}")
            return False

def main():
    """Run all tests"""
    print("🚀 Starting Team Tasks Backend API Tests")
    print(f"Backend URL: {BACKEND_URL}")
    print("=" * 60)
    
    tester = TeamTasksTester()
    results = {}
    
    # Setup phase
    results['setup_users'] = tester.setup_users()
    if not results['setup_users']:
        print("❌ Cannot proceed without users. Exiting.")
        return 1
        
    results['setup_room'] = tester.setup_room()
    if not results['setup_room']:
        print("❌ Cannot proceed without room. Exiting.")
        return 1
        
    results['setup_tasks'] = tester.setup_tasks()
    if not results['setup_tasks']:
        print("❌ Cannot proceed without tasks. Exiting.")
        return 1
    
    # Feature tests
    results['pin_task'] = tester.test_pin_task()
    results['pin_unauthorized'] = tester.test_pin_unauthorized()
    results['pinned_first'] = tester.test_get_tasks_pinned_first()
    results['filter_high_priority'] = tester.test_filter_high_priority()
    results['filter_created_status'] = tester.test_filter_created_status()
    results['sort_by_priority'] = tester.test_sort_by_priority()
    results['add_comment'] = tester.test_add_comment()
    results['edit_comment'] = tester.test_edit_comment()
    results['edit_comment_unauthorized'] = tester.test_edit_comment_unauthorized()
    results['delete_comment'] = tester.test_delete_comment()
    results['transfer_ownership'] = tester.test_transfer_ownership()
    results['kick_participant'] = tester.test_kick_participant()
    results['verify_single_participant'] = tester.test_verify_single_participant()
    
    # Cleanup
    results['cleanup'] = tester.cleanup()
    
    # Summary
    print("=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name.replace('_', ' ').title()}")
    
    print()
    print(f"Overall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed. Check the details above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())