#!/usr/bin/env python3
"""
Music Artist API Testing
Testing the music artist API `/api/music/artist/{artist_name}` endpoint
Based on review request requirements
"""

import requests
import json
import sys
import urllib.parse
from datetime import datetime

# Configuration - Using production backend URL
BACKEND_URL = "https://rudn-schedule.ru/api"

class MusicArtistTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'Music-Artist-Tester/1.0'
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
    
    def test_basic_artist_request(self):
        """Test basic request: GET /api/music/artist/Metallica?count=5"""
        print("🎸 Testing basic artist request (Metallica, count=5)...")
        
        artist_name = "Metallica"
        count = 5
        
        try:
            # URL encode the artist name
            encoded_artist = urllib.parse.quote(artist_name)
            response = self.session.get(f"{BACKEND_URL}/music/artist/{encoded_artist}?count={count}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check response structure
                required_fields = ["artist", "tracks", "count"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    artist = data.get("artist")
                    tracks = data.get("tracks", [])
                    response_count = data.get("count")
                    
                    # Validate response structure
                    success = True
                    details = []
                    
                    # Check artist field
                    if isinstance(artist, str) and artist:
                        details.append(f"✅ artist: '{artist}'")
                    else:
                        details.append(f"❌ artist: expected non-empty string, got {type(artist)} '{artist}'")
                        success = False
                    
                    # Check tracks array
                    if isinstance(tracks, list):
                        details.append(f"✅ tracks: array with {len(tracks)} items")
                        
                        # Validate each track structure
                        if tracks:
                            track = tracks[0]  # Check first track
                            required_track_fields = ["id", "artist", "title", "duration", "stream_url"]
                            track_missing = [field for field in required_track_fields if field not in track]
                            
                            if not track_missing:
                                details.append("✅ track structure: all required fields present")
                                
                                # Validate track field types
                                if isinstance(track.get("id"), str) and track.get("id"):
                                    details.append(f"✅ track.id: '{track['id']}'")
                                else:
                                    details.append(f"❌ track.id: expected non-empty string")
                                    success = False
                                
                                if isinstance(track.get("artist"), str) and track.get("artist"):
                                    details.append(f"✅ track.artist: '{track['artist']}'")
                                else:
                                    details.append(f"❌ track.artist: expected non-empty string")
                                    success = False
                                
                                if isinstance(track.get("title"), str) and track.get("title"):
                                    details.append(f"✅ track.title: '{track['title']}'")
                                else:
                                    details.append(f"❌ track.title: expected non-empty string")
                                    success = False
                                
                                if isinstance(track.get("duration"), int) and track.get("duration") >= 0:
                                    details.append(f"✅ track.duration: {track['duration']} seconds")
                                else:
                                    details.append(f"❌ track.duration: expected non-negative integer")
                                    success = False
                                
                                if isinstance(track.get("stream_url"), str) and track.get("stream_url"):
                                    details.append(f"✅ track.stream_url: '{track['stream_url']}'")
                                else:
                                    details.append(f"❌ track.stream_url: expected non-empty string")
                                    success = False
                            else:
                                details.append(f"❌ track structure: missing fields {track_missing}")
                                success = False
                        else:
                            details.append("ℹ️  tracks: empty array (no tracks found)")
                    else:
                        details.append(f"❌ tracks: expected array, got {type(tracks)}")
                        success = False
                    
                    # Check count field
                    if isinstance(response_count, int) and response_count >= 0:
                        details.append(f"✅ count: {response_count}")
                        if response_count == len(tracks):
                            details.append("✅ count matches tracks array length")
                        else:
                            details.append(f"⚠️  count ({response_count}) != tracks length ({len(tracks)})")
                    else:
                        details.append(f"❌ count: expected non-negative integer, got {type(response_count)}")
                        success = False
                    
                    self.log_result(
                        "Basic artist request - Metallica",
                        success,
                        "; ".join(details),
                        {"artist": artist, "tracks_count": len(tracks), "count": response_count}
                    )
                else:
                    self.log_result(
                        "Basic artist request - Metallica",
                        False,
                        f"Missing required fields: {missing_fields}",
                        data
                    )
            else:
                try:
                    data = response.json()
                except:
                    data = response.text
                self.log_result(
                    "Basic artist request - Metallica",
                    False,
                    f"Unexpected status code: {response.status_code}",
                    data
                )
                
        except Exception as e:
            self.log_result(
                "Basic artist request - Metallica",
                False,
                f"Request failed: {str(e)}"
            )

    def test_cyrillic_artist_request(self):
        """Test cyrillic request: GET /api/music/artist/Моргенштерн?count=3"""
        print("🎤 Testing cyrillic artist request (Моргенштерн, count=3)...")
        
        artist_name = "Моргенштерн"
        count = 3
        
        try:
            # URL encode the cyrillic artist name
            encoded_artist = urllib.parse.quote(artist_name)
            response = self.session.get(f"{BACKEND_URL}/music/artist/{encoded_artist}?count={count}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check response structure
                required_fields = ["artist", "tracks", "count"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    artist = data.get("artist")
                    tracks = data.get("tracks", [])
                    response_count = data.get("count")
                    
                    # Validate response structure
                    success = True
                    details = []
                    
                    # Check artist field
                    if isinstance(artist, str):
                        details.append(f"✅ artist: '{artist}' (cyrillic handled)")
                    else:
                        details.append(f"❌ artist: expected string, got {type(artist)}")
                        success = False
                    
                    # Check tracks array
                    if isinstance(tracks, list):
                        details.append(f"✅ tracks: array with {len(tracks)} items")
                        
                        # Check if we got some tracks (cyrillic search should work)
                        if tracks:
                            details.append("✅ cyrillic search returned results")
                            
                            # Validate first track structure
                            track = tracks[0]
                            required_track_fields = ["id", "artist", "title", "duration", "stream_url"]
                            track_missing = [field for field in required_track_fields if field not in track]
                            
                            if not track_missing:
                                details.append("✅ track structure: all required fields present")
                            else:
                                details.append(f"❌ track structure: missing fields {track_missing}")
                                success = False
                        else:
                            details.append("ℹ️  tracks: empty array (no tracks found for cyrillic artist)")
                    else:
                        details.append(f"❌ tracks: expected array, got {type(tracks)}")
                        success = False
                    
                    # Check count field
                    if isinstance(response_count, int) and response_count >= 0:
                        details.append(f"✅ count: {response_count}")
                    else:
                        details.append(f"❌ count: expected non-negative integer, got {type(response_count)}")
                        success = False
                    
                    self.log_result(
                        "Cyrillic artist request - Моргенштерн",
                        success,
                        "; ".join(details),
                        {"artist": artist, "tracks_count": len(tracks), "count": response_count}
                    )
                else:
                    self.log_result(
                        "Cyrillic artist request - Моргенштерн",
                        False,
                        f"Missing required fields: {missing_fields}",
                        data
                    )
            else:
                try:
                    data = response.json()
                except:
                    data = response.text
                self.log_result(
                    "Cyrillic artist request - Моргенштерн",
                    False,
                    f"Unexpected status code: {response.status_code}",
                    data
                )
                
        except Exception as e:
            self.log_result(
                "Cyrillic artist request - Моргенштерн",
                False,
                f"Request failed: {str(e)}"
            )

    def test_nonexistent_artist_request(self):
        """Test non-existent artist: GET /api/music/artist/xxxxxxxxxnonexistent?count=5"""
        print("❓ Testing non-existent artist request (xxxxxxxxxnonexistent, count=5)...")
        
        artist_name = "xxxxxxxxxnonexistent"
        count = 5
        
        try:
            # URL encode the artist name
            encoded_artist = urllib.parse.quote(artist_name)
            response = self.session.get(f"{BACKEND_URL}/music/artist/{encoded_artist}?count={count}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check response structure
                required_fields = ["artist", "tracks", "count"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    artist = data.get("artist")
                    tracks = data.get("tracks", [])
                    response_count = data.get("count")
                    
                    # Validate response structure for non-existent artist
                    success = True
                    details = []
                    
                    # Check artist field
                    if isinstance(artist, str):
                        details.append(f"✅ artist: '{artist}'")
                    else:
                        details.append(f"❌ artist: expected string, got {type(artist)}")
                        success = False
                    
                    # Check tracks array - should be empty or very few results
                    if isinstance(tracks, list):
                        if len(tracks) == 0:
                            details.append("✅ tracks: empty array (expected for non-existent artist)")
                        else:
                            details.append(f"ℹ️  tracks: {len(tracks)} items (some results found despite non-existent artist)")
                    else:
                        details.append(f"❌ tracks: expected array, got {type(tracks)}")
                        success = False
                    
                    # Check count field
                    if isinstance(response_count, int) and response_count >= 0:
                        details.append(f"✅ count: {response_count}")
                        if response_count == len(tracks):
                            details.append("✅ count matches tracks array length")
                        else:
                            details.append(f"⚠️  count ({response_count}) != tracks length ({len(tracks)})")
                    else:
                        details.append(f"❌ count: expected non-negative integer, got {type(response_count)}")
                        success = False
                    
                    self.log_result(
                        "Non-existent artist request - xxxxxxxxxnonexistent",
                        success,
                        "; ".join(details),
                        {"artist": artist, "tracks_count": len(tracks), "count": response_count}
                    )
                else:
                    self.log_result(
                        "Non-existent artist request - xxxxxxxxxnonexistent",
                        False,
                        f"Missing required fields: {missing_fields}",
                        data
                    )
            else:
                try:
                    data = response.json()
                except:
                    data = response.text
                self.log_result(
                    "Non-existent artist request - xxxxxxxxxnonexistent",
                    False,
                    f"Unexpected status code: {response.status_code}",
                    data
                )
                
        except Exception as e:
            self.log_result(
                "Non-existent artist request - xxxxxxxxxnonexistent",
                False,
                f"Request failed: {str(e)}"
            )
    
    def run_all_tests(self):
        """Run all music pagination API tests"""
        print("🎵 Music Pagination API Testing Suite")
        print(f"Backend URL: {BACKEND_URL}")
        print("Testing /api/music/my endpoint for Load More functionality")
        print("=" * 60)
        
        # Test all scenarios as specified in review request
        self.test_initial_load()
        self.test_pagination_load()
        self.test_end_of_list()
        self.test_has_more_logic()
        
        # Summary
        total_tests = len(self.results)
        passed_tests = sum(1 for result in self.results if result["success"])
        
        print("=" * 60)
        print(f"📊 Test Summary: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            print("🎉 All music pagination API tests passed!")
            print("✅ The 'Load More' functionality should work correctly!")
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
    tester = MusicPaginationTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)