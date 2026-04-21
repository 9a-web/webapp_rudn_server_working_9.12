#!/usr/bin/env python3
"""
Music API Testing - GET /api/music/search endpoint
Testing specific requirements from review request:
1. Endpoint GET /api/music/search?q=test&count=3 returns correct structure with is_blocked field
2. is_blocked field should be boolean (true/false)
3. Track with is_blocked=true should have url=null
4. Test search with different queries (q=Metallica, q=русская музыка)
5. Verify all required fields: id, owner_id, song_id, artist, title, duration, url, is_blocked, stream_url
"""

import requests
import json
import sys
from datetime import datetime

# Configuration - Testing on localhost:8001 with ENV=test as requested
BACKEND_URL = "http://localhost:8001/api"

class MusicAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'Music-API-Tester/1.0'
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
    
    def validate_track_structure(self, track, track_index=None):
        """Validate individual track structure"""
        required_fields = [
            "id", "owner_id", "song_id", "artist", "title", 
            "duration", "url", "is_blocked", "stream_url"
        ]
        
        issues = []
        
        # Check all required fields exist
        missing_fields = [field for field in required_fields if field not in track]
        if missing_fields:
            issues.append(f"Missing fields: {missing_fields}")
        
        # Check is_blocked field type
        if "is_blocked" in track:
            if not isinstance(track["is_blocked"], bool):
                issues.append(f"is_blocked should be boolean, got {type(track['is_blocked'])}: {track['is_blocked']}")
        
        # Check if is_blocked=true tracks have url=null
        if track.get("is_blocked") is True:
            if track.get("url") is not None:
                issues.append(f"Track with is_blocked=true should have url=null, got: {track.get('url')}")
        
        # Check data types
        if "owner_id" in track and not isinstance(track["owner_id"], int):
            issues.append(f"owner_id should be integer, got {type(track['owner_id'])}")
        
        if "song_id" in track and not isinstance(track["song_id"], int):
            issues.append(f"song_id should be integer, got {type(track['song_id'])}")
        
        if "duration" in track and not isinstance(track["duration"], (int, float)):
            issues.append(f"duration should be number, got {type(track['duration'])}")
        
        # Check stream_url format
        if "stream_url" in track:
            expected_prefix = "/api/music/stream/"
            if not track["stream_url"].startswith(expected_prefix):
                issues.append(f"stream_url should start with '{expected_prefix}', got: {track['stream_url']}")
        
        return issues
    
    def test_music_search_basic(self):
        """Test GET /api/music/search?q=test&count=3"""
        print("🎵 Testing GET /api/music/search?q=test&count=3...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/music/search", params={
                "q": "test",
                "count": 3
            })
            
            if response.status_code == 200:
                data = response.json()
                
                # Check response structure
                if "tracks" not in data:
                    self.log_result(
                        "Music Search - Response structure",
                        False,
                        "Missing 'tracks' field in response",
                        data
                    )
                    return
                
                tracks = data["tracks"]
                
                if not isinstance(tracks, list):
                    self.log_result(
                        "Music Search - Tracks type",
                        False,
                        f"'tracks' should be list, got {type(tracks)}",
                        data
                    )
                    return
                
                # Validate each track
                all_valid = True
                validation_details = []
                
                for i, track in enumerate(tracks):
                    issues = self.validate_track_structure(track, i)
                    if issues:
                        all_valid = False
                        validation_details.extend([f"Track {i}: {issue}" for issue in issues])
                    else:
                        validation_details.append(f"Track {i}: ✅ Valid structure")
                
                # Check if we have tracks with is_blocked=true and is_blocked=false
                blocked_tracks = [t for t in tracks if t.get("is_blocked") is True]
                unblocked_tracks = [t for t in tracks if t.get("is_blocked") is False]
                
                validation_details.append(f"Found {len(blocked_tracks)} blocked tracks, {len(unblocked_tracks)} unblocked tracks")
                
                self.log_result(
                    "Music Search - Basic test (q=test, count=3)",
                    all_valid,
                    "; ".join(validation_details),
                    {"tracks_count": len(tracks), "sample_track": tracks[0] if tracks else None}
                )
                
            else:
                try:
                    data = response.json()
                except:
                    data = response.text
                self.log_result(
                    "Music Search - Basic test",
                    False,
                    f"Unexpected status code: {response.status_code}",
                    data
                )
                
        except Exception as e:
            self.log_result(
                "Music Search - Basic test",
                False,
                f"Request failed: {str(e)}"
            )
    
    def test_music_search_metallica(self):
        """Test GET /api/music/search?q=Metallica"""
        print("🎸 Testing GET /api/music/search?q=Metallica...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/music/search", params={
                "q": "Metallica",
                "count": 5
            })
            
            if response.status_code == 200:
                data = response.json()
                tracks = data.get("tracks", [])
                
                # Validate structure
                all_valid = True
                validation_details = []
                
                for i, track in enumerate(tracks[:3]):  # Check first 3 tracks
                    issues = self.validate_track_structure(track, i)
                    if issues:
                        all_valid = False
                        validation_details.extend([f"Track {i}: {issue}" for issue in issues])
                
                # Check if artist names contain "Metallica" (case insensitive)
                metallica_tracks = [t for t in tracks if "metallica" in t.get("artist", "").lower()]
                validation_details.append(f"Found {len(metallica_tracks)} tracks with 'Metallica' in artist name")
                
                self.log_result(
                    "Music Search - Metallica query",
                    all_valid and len(tracks) > 0,
                    "; ".join(validation_details),
                    {"tracks_count": len(tracks), "first_artist": tracks[0].get("artist") if tracks else None}
                )
                
            else:
                try:
                    data = response.json()
                except:
                    data = response.text
                self.log_result(
                    "Music Search - Metallica query",
                    False,
                    f"Unexpected status code: {response.status_code}",
                    data
                )
                
        except Exception as e:
            self.log_result(
                "Music Search - Metallica query",
                False,
                f"Request failed: {str(e)}"
            )
    
    def test_music_search_russian(self):
        """Test GET /api/music/search?q=русская музыка"""
        print("🎼 Testing GET /api/music/search?q=русская музыка...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/music/search", params={
                "q": "русская музыка",
                "count": 5
            })
            
            if response.status_code == 200:
                data = response.json()
                tracks = data.get("tracks", [])
                
                # Validate structure
                all_valid = True
                validation_details = []
                
                for i, track in enumerate(tracks[:3]):  # Check first 3 tracks
                    issues = self.validate_track_structure(track, i)
                    if issues:
                        all_valid = False
                        validation_details.extend([f"Track {i}: {issue}" for issue in issues])
                
                validation_details.append(f"Russian query returned {len(tracks)} tracks")
                
                # Check for Cyrillic characters in results
                cyrillic_tracks = 0
                for track in tracks:
                    artist = track.get("artist", "")
                    title = track.get("title", "")
                    if any(ord(char) >= 0x0400 and ord(char) <= 0x04FF for char in artist + title):
                        cyrillic_tracks += 1
                
                validation_details.append(f"Found {cyrillic_tracks} tracks with Cyrillic characters")
                
                self.log_result(
                    "Music Search - Russian query",
                    all_valid and len(tracks) > 0,
                    "; ".join(validation_details),
                    {"tracks_count": len(tracks), "cyrillic_tracks": cyrillic_tracks}
                )
                
            else:
                try:
                    data = response.json()
                except:
                    data = response.text
                self.log_result(
                    "Music Search - Russian query",
                    False,
                    f"Unexpected status code: {response.status_code}",
                    data
                )
                
        except Exception as e:
            self.log_result(
                "Music Search - Russian query",
                False,
                f"Request failed: {str(e)}"
            )
    
    def test_blocked_tracks_validation(self):
        """Test specific validation of blocked tracks (is_blocked=true should have url=null)"""
        print("🚫 Testing blocked tracks validation...")
        
        try:
            # Search for a query that might return blocked tracks
            response = self.session.get(f"{BACKEND_URL}/music/search", params={
                "q": "популярная музыка",
                "count": 10
            })
            
            if response.status_code == 200:
                data = response.json()
                tracks = data.get("tracks", [])
                
                blocked_tracks = [t for t in tracks if t.get("is_blocked") is True]
                unblocked_tracks = [t for t in tracks if t.get("is_blocked") is False]
                
                validation_details = []
                all_valid = True
                
                # Check blocked tracks have url=null
                for i, track in enumerate(blocked_tracks):
                    if track.get("url") is not None:
                        all_valid = False
                        validation_details.append(f"Blocked track {i} has non-null url: {track.get('url')}")
                    else:
                        validation_details.append(f"Blocked track {i}: ✅ url=null")
                
                # Check unblocked tracks might have url (not required to have it)
                unblocked_with_url = [t for t in unblocked_tracks if t.get("url") is not None]
                validation_details.append(f"Found {len(blocked_tracks)} blocked tracks, {len(unblocked_tracks)} unblocked tracks")
                validation_details.append(f"{len(unblocked_with_url)} unblocked tracks have direct URLs")
                
                self.log_result(
                    "Music Search - Blocked tracks validation",
                    all_valid,
                    "; ".join(validation_details),
                    {
                        "total_tracks": len(tracks),
                        "blocked_count": len(blocked_tracks),
                        "unblocked_count": len(unblocked_tracks)
                    }
                )
                
            else:
                try:
                    data = response.json()
                except:
                    data = response.text
                self.log_result(
                    "Music Search - Blocked tracks validation",
                    False,
                    f"Unexpected status code: {response.status_code}",
                    data
                )
                
        except Exception as e:
            self.log_result(
                "Music Search - Blocked tracks validation",
                False,
                f"Request failed: {str(e)}"
            )
    
    def test_edge_cases(self):
        """Test edge cases for music search"""
        print("🔍 Testing edge cases...")
        
        # Test count=0
        try:
            response = self.session.get(f"{BACKEND_URL}/music/search", params={
                "q": "test",
                "count": 0
            })
            
            if response.status_code == 200:
                data = response.json()
                tracks = data.get("tracks", [])
                
                self.log_result(
                    "Music Search - Edge case (count=0)",
                    len(tracks) == 0,
                    f"count=0 returned {len(tracks)} tracks (expected 0)",
                    {"tracks_count": len(tracks)}
                )
            else:
                self.log_result(
                    "Music Search - Edge case (count=0)",
                    False,
                    f"Unexpected status code: {response.status_code}"
                )
        except Exception as e:
            self.log_result(
                "Music Search - Edge case (count=0)",
                False,
                f"Request failed: {str(e)}"
            )
        
        # Test empty query
        try:
            response = self.session.get(f"{BACKEND_URL}/music/search", params={
                "q": "",
                "count": 5
            })
            
            if response.status_code == 200:
                data = response.json()
                tracks = data.get("tracks", [])
                
                self.log_result(
                    "Music Search - Edge case (empty query)",
                    True,  # Any response is acceptable for empty query
                    f"Empty query returned {len(tracks)} tracks",
                    {"tracks_count": len(tracks)}
                )
            else:
                self.log_result(
                    "Music Search - Edge case (empty query)",
                    True,  # Error response is also acceptable
                    f"Empty query returned status: {response.status_code}"
                )
        except Exception as e:
            self.log_result(
                "Music Search - Edge case (empty query)",
                False,
                f"Request failed: {str(e)}"
            )
    
    def run_all_tests(self):
        """Run all Music API tests"""
        print("🎵 Music API Testing Suite")
        print(f"Backend URL: {BACKEND_URL}")
        print("Testing GET /api/music/search endpoint")
        print("=" * 60)
        
        # Test all scenarios
        self.test_music_search_basic()
        self.test_music_search_metallica()
        self.test_music_search_russian()
        self.test_blocked_tracks_validation()
        self.test_edge_cases()
        
        # Summary
        total_tests = len(self.results)
        passed_tests = sum(1 for result in self.results if result["success"])
        
        print("=" * 60)
        print(f"📊 Test Summary: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            print("🎉 All Music API tests passed!")
            return True
        else:
            print("⚠️  Some tests failed. Check the details above.")
            
            # Show failed tests
            failed_tests = [result for result in self.results if not result["success"]]
            if failed_tests:
                print("\n❌ Failed Tests:")
                for test in failed_tests:
                    print(f"  - {test['test']}: {test['details']}")
            
            return False

def main():
    """Main test runner"""
    tester = MusicAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)