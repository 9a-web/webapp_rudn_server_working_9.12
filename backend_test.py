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

class MusicPaginationTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'Music-Pagination-Tester/1.0'
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
    
    def test_initial_load(self):
        """Test initial load: GET /api/music/my?count=30&offset=0"""
        print("🎵 Testing initial load (count=30, offset=0)...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/music/my?count=30&offset=0")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check response structure
                required_fields = ["tracks", "has_more", "count"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    tracks = data.get("tracks", [])
                    has_more = data.get("has_more")
                    count = data.get("count")
                    
                    # Validate response structure
                    success = True
                    details = []
                    
                    # Check tracks array
                    if isinstance(tracks, list):
                        details.append(f"✅ tracks: array with {len(tracks)} items")
                    else:
                        details.append(f"❌ tracks: expected array, got {type(tracks)}")
                        success = False
                    
                    # Check has_more boolean
                    if isinstance(has_more, bool):
                        details.append(f"✅ has_more: {has_more}")
                        # If we have tracks and there are more than 30 total, has_more should be true
                        if len(tracks) == 30 and has_more:
                            details.append("✅ has_more=true indicates more tracks available")
                        elif len(tracks) < 30 and not has_more:
                            details.append("✅ has_more=false indicates no more tracks")
                        elif len(tracks) > 0:
                            details.append(f"ℹ️  has_more={has_more} with {len(tracks)} tracks returned")
                    else:
                        details.append(f"❌ has_more: expected boolean, got {type(has_more)}")
                        success = False
                    
                    # Check count field
                    if isinstance(count, int):
                        details.append(f"✅ count: {count}")
                        if count == len(tracks):
                            details.append("✅ count matches tracks array length")
                        else:
                            details.append(f"⚠️  count ({count}) != tracks length ({len(tracks)})")
                    else:
                        details.append(f"❌ count: expected integer, got {type(count)}")
                        success = False
                    
                    self.log_result(
                        "Initial load - Response structure",
                        success,
                        "; ".join(details),
                        {"tracks_count": len(tracks), "has_more": has_more, "count": count}
                    )
                else:
                    self.log_result(
                        "Initial load - Response structure",
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
                    "Initial load - HTTP Response",
                    False,
                    f"Unexpected status code: {response.status_code}",
                    data
                )
                
        except Exception as e:
            self.log_result(
                "Initial load - Request",
                False,
                f"Request failed: {str(e)}"
            )

    def test_pagination_load(self):
        """Test pagination: GET /api/music/my?count=30&offset=28"""
        print("📄 Testing pagination load (count=30, offset=28)...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/music/my?count=30&offset=28")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check response structure
                required_fields = ["tracks", "has_more", "count"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    tracks = data.get("tracks", [])
                    has_more = data.get("has_more")
                    count = data.get("count")
                    offset = data.get("offset", 28)
                    
                    # Validate response structure
                    success = True
                    details = []
                    
                    # Check tracks array
                    if isinstance(tracks, list):
                        details.append(f"✅ tracks: array with {len(tracks)} items")
                    else:
                        details.append(f"❌ tracks: expected array, got {type(tracks)}")
                        success = False
                    
                    # Check has_more boolean
                    if isinstance(has_more, bool):
                        details.append(f"✅ has_more: {has_more}")
                    else:
                        details.append(f"❌ has_more: expected boolean, got {type(has_more)}")
                        success = False
                    
                    # Check count field
                    if isinstance(count, int):
                        details.append(f"✅ count: {count}")
                    else:
                        details.append(f"❌ count: expected integer, got {type(count)}")
                        success = False
                    
                    # Check offset
                    if offset == 28:
                        details.append(f"✅ offset: {offset}")
                    else:
                        details.append(f"ℹ️  offset: {offset} (expected 28)")
                    
                    self.log_result(
                        "Pagination load - Response structure",
                        success,
                        "; ".join(details),
                        {"tracks_count": len(tracks), "has_more": has_more, "count": count, "offset": offset}
                    )
                else:
                    self.log_result(
                        "Pagination load - Response structure",
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
                    "Pagination load - HTTP Response",
                    False,
                    f"Unexpected status code: {response.status_code}",
                    data
                )
                
        except Exception as e:
            self.log_result(
                "Pagination load - Request",
                False,
                f"Request failed: {str(e)}"
            )
    
    def test_end_of_list(self):
        """Test end of list: GET /api/music/my?count=30&offset=500"""
        print("🔚 Testing end of list (count=30, offset=500)...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/music/my?count=30&offset=500")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check response structure
                required_fields = ["tracks", "has_more", "count"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    tracks = data.get("tracks", [])
                    has_more = data.get("has_more")
                    count = data.get("count")
                    
                    # Validate end of list behavior
                    success = True
                    details = []
                    
                    # Check tracks array - should be empty or very small
                    if isinstance(tracks, list):
                        if len(tracks) == 0:
                            details.append("✅ tracks: empty array (expected for high offset)")
                        else:
                            details.append(f"ℹ️  tracks: {len(tracks)} items (may have some tracks at high offset)")
                    else:
                        details.append(f"❌ tracks: expected array, got {type(tracks)}")
                        success = False
                    
                    # Check has_more - should be false for high offset
                    if isinstance(has_more, bool):
                        if not has_more:
                            details.append("✅ has_more: false (expected for high offset)")
                        else:
                            details.append("ℹ️  has_more: true (may still have more tracks)")
                    else:
                        details.append(f"❌ has_more: expected boolean, got {type(has_more)}")
                        success = False
                    
                    # Check count field
                    if isinstance(count, int):
                        details.append(f"✅ count: {count}")
                        if count == len(tracks):
                            details.append("✅ count matches tracks array length")
                    else:
                        details.append(f"❌ count: expected integer, got {type(count)}")
                        success = False
                    
                    self.log_result(
                        "End of list - Response structure",
                        success,
                        "; ".join(details),
                        {"tracks_count": len(tracks), "has_more": has_more, "count": count}
                    )
                else:
                    self.log_result(
                        "End of list - Response structure",
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
                    "End of list - HTTP Response",
                    False,
                    f"Unexpected status code: {response.status_code}",
                    data
                )
                
        except Exception as e:
            self.log_result(
                "End of list - Request",
                False,
                f"Request failed: {str(e)}"
            )
    
    def test_has_more_logic(self):
        """Test has_more field logic by making sequential requests"""
        print("🔄 Testing has_more field logic with sequential requests...")
        
        try:
            # Test multiple offsets to understand has_more behavior
            offsets_to_test = [0, 30, 60, 90, 120]
            results = []
            
            for offset in offsets_to_test:
                response = self.session.get(f"{BACKEND_URL}/music/my?count=30&offset={offset}")
                
                if response.status_code == 200:
                    data = response.json()
                    tracks = data.get("tracks", [])
                    has_more = data.get("has_more")
                    count = data.get("count")
                    
                    results.append({
                        "offset": offset,
                        "tracks_count": len(tracks),
                        "has_more": has_more,
                        "count": count
                    })
                else:
                    results.append({
                        "offset": offset,
                        "error": f"HTTP {response.status_code}"
                    })
            
            # Analyze results
            success = True
            details = []
            
            for i, result in enumerate(results):
                if "error" in result:
                    details.append(f"❌ Offset {result['offset']}: {result['error']}")
                    success = False
                else:
                    offset = result["offset"]
                    tracks_count = result["tracks_count"]
                    has_more = result["has_more"]
                    count = result["count"]
                    
                    # Check logic: if we got fewer tracks than requested and has_more is false, that's correct
                    # If we got the full amount requested and has_more is true, that's also correct
                    if tracks_count < 30 and not has_more:
                        details.append(f"✅ Offset {offset}: {tracks_count} tracks, has_more=false (correct - end reached)")
                    elif tracks_count == 30 and has_more:
                        details.append(f"✅ Offset {offset}: {tracks_count} tracks, has_more=true (correct - more available)")
                    elif tracks_count == 30 and not has_more:
                        details.append(f"✅ Offset {offset}: {tracks_count} tracks, has_more=false (correct - exactly at end)")
                    elif tracks_count == 0 and not has_more:
                        details.append(f"✅ Offset {offset}: {tracks_count} tracks, has_more=false (correct - beyond end)")
                    else:
                        details.append(f"ℹ️  Offset {offset}: {tracks_count} tracks, has_more={has_more}")
            
            self.log_result(
                "has_more logic - Sequential requests",
                success,
                "; ".join(details),
                results
            )
                
        except Exception as e:
            self.log_result(
                "has_more logic - Sequential requests",
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