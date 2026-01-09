#!/usr/bin/env python3
"""
Comprehensive Backend Testing for LK RUDN API
Testing LK RUDN (Личный Кабинет РУДН) API endpoints with ENV=test
"""

import requests
import json
import sys
from datetime import datetime

# Configuration - Using production URL as specified in review request
BACKEND_URL = "https://rudn-schedule.ru/api"
TEST_TELEGRAM_ID = 123456789  # Non-existent user for testing as specified

class LKRUDNTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'LK-RUDN-API-Tester/1.0'
        })
        self.results = []
        
    def log_result(self, test_name, success, details="", response_data=None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        if not success and response_data:
            print(f"    Response: {response_data}")
        print()
    
    def test_music_search(self):
        """Test GET /api/music/search endpoint"""
        print("🎵 Testing Music Search API...")
        
        # Test 1: Valid search with q="test", count=5
        try:
            response = self.session.get(f"{BACKEND_URL}/music/search", params={"q": "test", "count": 5})
            
            if response.status_code == 200:
                data = response.json()
                
                # Check response structure
                if "tracks" in data and "count" in data:
                    tracks = data["tracks"]
                    count = data["count"]
                    
                    # Validate track structure
                    if tracks and len(tracks) > 0:
                        track = tracks[0]
                        required_fields = ["id", "owner_id", "song_id", "artist", "title", "duration", "url"]
                        missing_fields = [field for field in required_fields if field not in track]
                        
                        if not missing_fields:
                            # Check URL validity
                            if track["url"] and track["url"].startswith("https://"):
                                # Check duration is positive number
                                if isinstance(track["duration"], (int, float)) and track["duration"] > 0:
                                    self.log_result(
                                        "Music Search - Valid query (q=test, count=5)",
                                        True,
                                        f"Found {count} tracks, all required fields present, valid URLs and duration"
                                    )
                                else:
                                    self.log_result(
                                        "Music Search - Valid query (q=test, count=5)",
                                        False,
                                        f"Invalid duration: {track['duration']}"
                                    )
                            else:
                                self.log_result(
                                    "Music Search - Valid query (q=test, count=5)",
                                    False,
                                    f"Invalid URL format: {track['url']}"
                                )
                        else:
                            self.log_result(
                                "Music Search - Valid query (q=test, count=5)",
                                False,
                                f"Missing required fields: {missing_fields}"
                            )
                    else:
                        self.log_result(
                            "Music Search - Valid query (q=test, count=5)",
                            True,
                            "No tracks found (acceptable for test query)"
                        )
                else:
                    self.log_result(
                        "Music Search - Valid query (q=test, count=5)",
                        False,
                        "Missing 'tracks' or 'count' in response",
                        data
                    )
            else:
                self.log_result(
                    "Music Search - Valid query (q=test, count=5)",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.log_result(
                "Music Search - Valid query (q=test, count=5)",
                False,
                f"Exception: {str(e)}"
            )
        
        # Test 2: Russian search query
        try:
            response = self.session.get(f"{BACKEND_URL}/music/search", params={"q": "музыка", "count": 3})
            
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    "Music Search - Russian query (q=музыка)",
                    True,
                    f"Found {data.get('count', 0)} tracks for Russian query"
                )
            else:
                self.log_result(
                    "Music Search - Russian query (q=музыка)",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.log_result(
                "Music Search - Russian query (q=музыка)",
                False,
                f"Exception: {str(e)}"
            )
        
        # Test 3: Edge cases - count=0 and count=100
        for count_val in [0, 100]:
            try:
                response = self.session.get(f"{BACKEND_URL}/music/search", params={"q": "test", "count": count_val})
                
                if response.status_code == 200:
                    data = response.json()
                    actual_count = len(data.get("tracks", []))
                    
                    if count_val == 0:
                        expected = actual_count == 0
                        msg = "Returns empty list for count=0" if expected else f"Expected 0 tracks, got {actual_count}"
                    else:
                        expected = actual_count <= count_val
                        msg = f"Returns {actual_count} tracks (≤ {count_val})" if expected else f"Returned more than {count_val} tracks"
                    
                    self.log_result(
                        f"Music Search - Edge case (count={count_val})",
                        expected,
                        msg
                    )
                else:
                    self.log_result(
                        f"Music Search - Edge case (count={count_val})",
                        False,
                        f"HTTP {response.status_code}: {response.text}"
                    )
            except Exception as e:
                self.log_result(
                    f"Music Search - Edge case (count={count_val})",
                    False,
                    f"Exception: {str(e)}"
                )
    
    def test_music_my_audio(self):
        """Test GET /api/music/my endpoint"""
        print("🎵 Testing My Audio API...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/music/my", params={"count": 10})
            
            if response.status_code == 200:
                data = response.json()
                
                if "tracks" in data and "count" in data:
                    tracks = data["tracks"]
                    
                    if tracks:
                        # Validate track structure
                        track = tracks[0]
                        required_fields = ["id", "owner_id", "song_id", "artist", "title", "duration", "url"]
                        missing_fields = [field for field in required_fields if field not in track]
                        
                        if not missing_fields:
                            self.log_result(
                                "My Audio - Structure validation",
                                True,
                                f"Found {len(tracks)} tracks with correct structure"
                            )
                        else:
                            self.log_result(
                                "My Audio - Structure validation",
                                False,
                                f"Missing fields: {missing_fields}"
                            )
                    else:
                        self.log_result(
                            "My Audio - Structure validation",
                            True,
                            "No tracks found (user may have empty library)"
                        )
                else:
                    self.log_result(
                        "My Audio - Structure validation",
                        False,
                        "Missing 'tracks' or 'count' in response",
                        data
                    )
            else:
                self.log_result(
                    "My Audio - Structure validation",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.log_result(
                "My Audio - Structure validation",
                False,
                f"Exception: {str(e)}"
            )
    
    def test_music_popular(self):
        """Test GET /api/music/popular endpoint"""
        print("🎵 Testing Popular Music API...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/music/popular", params={"count": 5})
            
            if response.status_code == 200:
                data = response.json()
                
                if "tracks" in data and "count" in data:
                    tracks = data["tracks"]
                    
                    if tracks:
                        # Validate track structure
                        track = tracks[0]
                        required_fields = ["id", "owner_id", "song_id", "artist", "title", "duration", "url"]
                        missing_fields = [field for field in required_fields if field not in track]
                        
                        if not missing_fields:
                            self.log_result(
                                "Popular Music - Structure validation",
                                True,
                                f"Found {len(tracks)} popular tracks with correct structure"
                            )
                        else:
                            self.log_result(
                                "Popular Music - Structure validation",
                                False,
                                f"Missing fields: {missing_fields}"
                            )
                    else:
                        self.log_result(
                            "Popular Music - Structure validation",
                            True,
                            "No popular tracks found (API may be empty)"
                        )
                else:
                    self.log_result(
                        "Popular Music - Structure validation",
                        False,
                        "Missing 'tracks' or 'count' in response",
                        data
                    )
            else:
                self.log_result(
                    "Popular Music - Structure validation",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.log_result(
                "Popular Music - Structure validation",
                False,
                f"Exception: {str(e)}"
            )
    
    def test_music_playlists(self):
        """Test GET /api/music/playlists endpoint"""
        print("🎵 Testing Playlists API...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/music/playlists")
            
            if response.status_code == 200:
                data = response.json()
                
                if "playlists" in data:
                    playlists = data["playlists"]
                    
                    if playlists:
                        # Validate playlist structure
                        playlist = playlists[0]
                        required_fields = ["id", "owner_id", "title", "count", "access_key"]
                        missing_fields = [field for field in required_fields if field not in playlist]
                        
                        if not missing_fields:
                            self.log_result(
                                "Playlists - Structure validation",
                                True,
                                f"Found {len(playlists)} playlists with correct structure"
                            )
                            
                            # Store first playlist for next test
                            self.first_playlist = playlist
                        else:
                            self.log_result(
                                "Playlists - Structure validation",
                                False,
                                f"Missing fields: {missing_fields}"
                            )
                    else:
                        self.log_result(
                            "Playlists - Structure validation",
                            True,
                            "No playlists found (user may have no playlists)"
                        )
                        self.first_playlist = None
                else:
                    self.log_result(
                        "Playlists - Structure validation",
                        False,
                        "Missing 'playlists' in response",
                        data
                    )
            else:
                self.log_result(
                    "Playlists - Structure validation",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.log_result(
                "Playlists - Structure validation",
                False,
                f"Exception: {str(e)}"
            )
    
    def test_music_playlist_tracks(self):
        """Test GET /api/music/playlist/{owner_id}/{playlist_id} endpoint"""
        print("🎵 Testing Playlist Tracks API...")
        
        if not hasattr(self, 'first_playlist') or not self.first_playlist:
            self.log_result(
                "Playlist Tracks - No playlist available",
                False,
                "Cannot test playlist tracks - no playlists found in previous test"
            )
            return
        
        playlist = self.first_playlist
        owner_id = playlist["owner_id"]
        playlist_id = playlist["id"]
        access_key = playlist["access_key"]
        
        try:
            params = {"access_key": access_key, "count": 5}
            response = self.session.get(
                f"{BACKEND_URL}/music/playlist/{owner_id}/{playlist_id}",
                params=params
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if "tracks" in data and "count" in data:
                    tracks = data["tracks"]
                    
                    if tracks:
                        # Validate track structure
                        track = tracks[0]
                        required_fields = ["id", "owner_id", "song_id", "artist", "title", "duration", "url"]
                        missing_fields = [field for field in required_fields if field not in track]
                        
                        if not missing_fields:
                            self.log_result(
                                "Playlist Tracks - Structure validation",
                                True,
                                f"Found {len(tracks)} tracks in playlist with correct structure"
                            )
                        else:
                            self.log_result(
                                "Playlist Tracks - Structure validation",
                                False,
                                f"Missing fields: {missing_fields}"
                            )
                    else:
                        self.log_result(
                            "Playlist Tracks - Structure validation",
                            True,
                            "Playlist is empty (acceptable)"
                        )
                else:
                    self.log_result(
                        "Playlist Tracks - Structure validation",
                        False,
                        "Missing 'tracks' or 'count' in response",
                        data
                    )
            else:
                self.log_result(
                    "Playlist Tracks - Structure validation",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.log_result(
                "Playlist Tracks - Structure validation",
                False,
                f"Exception: {str(e)}"
            )
    
    def test_music_favorites_crud(self):
        """Test Music Favorites CRUD operations"""
        print("🎵 Testing Music Favorites CRUD...")
        
        # Test 1: Get favorites for new user (should be empty)
        try:
            response = self.session.get(f"{BACKEND_URL}/music/favorites/{TEST_TELEGRAM_ID}")
            
            if response.status_code == 200:
                data = response.json()
                
                if "tracks" in data and "count" in data:
                    initial_count = data["count"]
                    self.log_result(
                        "Favorites - Get initial favorites",
                        True,
                        f"Retrieved favorites list with {initial_count} tracks"
                    )
                else:
                    self.log_result(
                        "Favorites - Get initial favorites",
                        False,
                        "Missing 'tracks' or 'count' in response",
                        data
                    )
                    return
            else:
                self.log_result(
                    "Favorites - Get initial favorites",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                return
        except Exception as e:
            self.log_result(
                "Favorites - Get initial favorites",
                False,
                f"Exception: {str(e)}"
            )
            return
        
        # Test 2: Add track to favorites
        test_track = {
            "id": "test123",
            "artist": "Test Artist",
            "title": "Test Song",
            "duration": 180,
            "url": "https://test.mp3"
        }
        
        try:
            response = self.session.post(
                f"{BACKEND_URL}/music/favorites/{TEST_TELEGRAM_ID}",
                json=test_track
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("success"):
                    self.log_result(
                        "Favorites - Add track",
                        True,
                        "Successfully added track to favorites"
                    )
                else:
                    self.log_result(
                        "Favorites - Add track",
                        False,
                        f"Failed to add track: {data.get('message', 'Unknown error')}"
                    )
                    return
            else:
                self.log_result(
                    "Favorites - Add track",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                return
        except Exception as e:
            self.log_result(
                "Favorites - Add track",
                False,
                f"Exception: {str(e)}"
            )
            return
        
        # Test 3: Verify track was added
        try:
            response = self.session.get(f"{BACKEND_URL}/music/favorites/{TEST_TELEGRAM_ID}")
            
            if response.status_code == 200:
                data = response.json()
                tracks = data.get("tracks", [])
                
                # Check if our test track is in the list
                found_track = None
                for track in tracks:
                    if track.get("id") == "test123":
                        found_track = track
                        break
                
                if found_track:
                    self.log_result(
                        "Favorites - Verify track added",
                        True,
                        f"Track found in favorites: {found_track['artist']} - {found_track['title']}"
                    )
                else:
                    self.log_result(
                        "Favorites - Verify track added",
                        False,
                        "Track not found in favorites after adding"
                    )
                    return
            else:
                self.log_result(
                    "Favorites - Verify track added",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                return
        except Exception as e:
            self.log_result(
                "Favorites - Verify track added",
                False,
                f"Exception: {str(e)}"
            )
            return
        
        # Test 4: Try to add same track again (should return exists: true)
        try:
            response = self.session.post(
                f"{BACKEND_URL}/music/favorites/{TEST_TELEGRAM_ID}",
                json=test_track
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if not data.get("success") and "already" in data.get("message", "").lower():
                    self.log_result(
                        "Favorites - Duplicate prevention",
                        True,
                        "Correctly prevented duplicate track addition"
                    )
                else:
                    self.log_result(
                        "Favorites - Duplicate prevention",
                        False,
                        f"Expected duplicate prevention, got: {data}"
                    )
            else:
                self.log_result(
                    "Favorites - Duplicate prevention",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.log_result(
                "Favorites - Duplicate prevention",
                False,
                f"Exception: {str(e)}"
            )
        
        # Test 5: Delete track from favorites
        try:
            response = self.session.delete(f"{BACKEND_URL}/music/favorites/{TEST_TELEGRAM_ID}/test123")
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("success"):
                    self.log_result(
                        "Favorites - Delete track",
                        True,
                        "Successfully deleted track from favorites"
                    )
                else:
                    self.log_result(
                        "Favorites - Delete track",
                        False,
                        "Failed to delete track from favorites"
                    )
                    return
            else:
                self.log_result(
                    "Favorites - Delete track",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                return
        except Exception as e:
            self.log_result(
                "Favorites - Delete track",
                False,
                f"Exception: {str(e)}"
            )
            return
        
        # Test 6: Verify track was deleted
        try:
            response = self.session.get(f"{BACKEND_URL}/music/favorites/{TEST_TELEGRAM_ID}")
            
            if response.status_code == 200:
                data = response.json()
                tracks = data.get("tracks", [])
                
                # Check if our test track is still in the list
                found_track = None
                for track in tracks:
                    if track.get("id") == "test123":
                        found_track = track
                        break
                
                if not found_track:
                    self.log_result(
                        "Favorites - Verify track deleted",
                        True,
                        "Track successfully removed from favorites"
                    )
                else:
                    self.log_result(
                        "Favorites - Verify track deleted",
                        False,
                        "Track still found in favorites after deletion"
                    )
            else:
                self.log_result(
                    "Favorites - Verify track deleted",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.log_result(
                "Favorites - Verify track deleted",
                False,
                f"Exception: {str(e)}"
            )
    
    def run_all_tests(self):
        """Run all Music API tests"""
        print("🚀 Starting Music API Testing...")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test Telegram ID: {TEST_TELEGRAM_ID}")
        print("=" * 60)
        
        # Run all tests
        self.test_music_search()
        self.test_music_my_audio()
        self.test_music_popular()
        self.test_music_playlists()
        self.test_music_playlist_tracks()
        self.test_music_favorites_crud()
        
        # Summary
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n" + "=" * 60)
        return failed_tests == 0

if __name__ == "__main__":
    tester = MusicAPITester()
    success = tester.run_all_tests()
    
    if success:
        print("🎉 All tests passed!")
        sys.exit(0)
    else:
        print("💥 Some tests failed!")
        sys.exit(1)