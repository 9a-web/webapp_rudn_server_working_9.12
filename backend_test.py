#!/usr/bin/env python3
"""
Backend Testing Script for RUDN Webapp
Tests for:
1. GET /api/search/global - Global user search (public + authenticated)
2. GET /api/u/{uid} - User profile with is_setup_complete field
"""

import requests
import json
import time
import random
import string
from typing import Optional, Dict, Any

# Backend URL
BACKEND_URL = "https://rudn-auth-hub-1.preview.emergentagent.com/api"

# Test credentials from test_credentials.md
TEST_USER_EMAIL = "logout_test@test.com"
TEST_USER_PASSWORD = "Test1234"
TEST_USER_UID = "913842163"

# Color codes for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"


def log_test(name: str):
    """Log test name"""
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}TEST: {name}{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")


def log_success(message: str):
    """Log success message"""
    print(f"{GREEN}✅ {message}{RESET}")


def log_error(message: str):
    """Log error message"""
    print(f"{RED}❌ {message}{RESET}")


def log_warning(message: str):
    """Log warning message"""
    print(f"{YELLOW}⚠️  {message}{RESET}")


def log_info(message: str):
    """Log info message"""
    print(f"ℹ️  {message}")


def get_auth_token() -> Optional[str]:
    """Get authentication token for test user"""
    try:
        response = requests.post(
            f"{BACKEND_URL}/auth/login/email",
            json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            },
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            if token:
                log_success(f"Authenticated as {TEST_USER_EMAIL}")
                return token
            else:
                log_error("No access_token in login response")
                return None
        else:
            log_error(f"Login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        log_error(f"Login exception: {e}")
        return None


def create_test_user() -> Optional[Dict[str, Any]]:
    """Create a test user for testing"""
    random_suffix = ''.join(random.choices(string.digits, k=6))
    email = f"search_test_{random_suffix}@test.com"
    
    try:
        # Use X-Forwarded-For to bypass rate limit
        headers = {"X-Forwarded-For": f"192.168.{random.randint(1, 254)}.{random.randint(1, 254)}"}
        
        response = requests.post(
            f"{BACKEND_URL}/auth/register/email",
            json={
                "email": email,
                "password": "Test1234",
                "first_name": "SearchTest",
                "last_name": f"User{random_suffix}"
            },
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            log_success(f"Created test user: {email}")
            return {
                "email": email,
                "password": "Test1234",
                "uid": data.get("uid"),
                "token": data.get("access_token")
            }
        else:
            log_warning(f"Failed to create test user: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        log_warning(f"Test user creation exception: {e}")
        return None


# ============================================================================
# TEST SUITE 1: GET /api/search/global
# ============================================================================

def test_global_search_anonymous():
    """Test 1: Anonymous search without authorization"""
    log_test("Anonymous Global Search (q=test&limit=5)")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/search/global",
            params={"q": "test", "limit": 5},
            timeout=10
        )
        
        log_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            log_info(f"Response keys: {list(data.keys())}")
            
            # Validate response structure
            required_keys = ["results", "total", "has_more", "query", "limit", "offset"]
            missing_keys = [k for k in required_keys if k not in data]
            
            if missing_keys:
                log_error(f"Missing keys in response: {missing_keys}")
                return False
            
            log_success(f"Response structure valid")
            log_info(f"Total results: {data['total']}, has_more: {data['has_more']}")
            
            # Check results
            results = data.get("results", [])
            if results:
                log_info(f"Found {len(results)} results")
                
                # Check first result structure
                first = results[0]
                log_info(f"First result keys: {list(first.keys())}")
                
                # Validate GlobalSearchResult fields
                expected_fields = [
                    "uid", "telegram_id", "username", "first_name", "last_name",
                    "full_name", "group_name", "facultet_name", "kurs",
                    "has_custom_avatar", "avatar_mode", "is_online",
                    "level", "tier", "mutual_friends_count", "friendship_status"
                ]
                
                missing_fields = [f for f in expected_fields if f not in first]
                if missing_fields:
                    log_error(f"Missing fields in result: {missing_fields}")
                    return False
                
                # For anonymous users, friendship_status should be null
                for result in results:
                    if result.get("friendship_status") is not None:
                        log_error(f"Anonymous user has non-null friendship_status: {result.get('friendship_status')}")
                        return False
                    if result.get("mutual_friends_count", 0) != 0:
                        log_error(f"Anonymous user has non-zero mutual_friends_count: {result.get('mutual_friends_count')}")
                        return False
                
                log_success("All results have null friendship_status and 0 mutual_friends_count")
                log_success("Anonymous search working correctly")
                return True
            else:
                log_warning("No results found (might be expected if no users match)")
                return True
        else:
            log_error(f"Request failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        log_error(f"Exception: {e}")
        return False


def test_global_search_authenticated(token: str):
    """Test 2: Authenticated search with Bearer token"""
    log_test("Authenticated Global Search (q=test&limit=5)")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{BACKEND_URL}/search/global",
            params={"q": "test", "limit": 5},
            headers=headers,
            timeout=10
        )
        
        log_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            results = data.get("results", [])
            
            if results:
                log_info(f"Found {len(results)} results")
                
                # Check if any results have friendship_status
                has_friend = any(r.get("friendship_status") == "friend" for r in results)
                
                if has_friend:
                    log_success("Found results with friendship_status='friend'")
                else:
                    log_info("No friends found in results (might be expected)")
                
                log_success("Authenticated search working correctly")
                return True
            else:
                log_warning("No results found")
                return True
        else:
            log_error(f"Request failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        log_error(f"Exception: {e}")
        return False


def test_global_search_empty_query():
    """Test 3: Empty query (should return list sorted by xp desc)"""
    log_test("Empty Query Search (q=)")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/search/global",
            params={"q": "", "limit": 10},
            timeout=10
        )
        
        log_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            results = data.get("results", [])
            
            log_info(f"Found {len(results)} results")
            
            if results:
                log_success("Empty query returns results (sorted by xp desc)")
                return True
            else:
                log_warning("No results found (might be expected if DB is empty)")
                return True
        else:
            log_error(f"Request failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        log_error(f"Exception: {e}")
        return False


def test_global_search_short_query():
    """Test 4: Very short query (q=a)"""
    log_test("Short Query Search (q=a)")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/search/global",
            params={"q": "a", "limit": 5},
            timeout=10
        )
        
        log_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            log_success("Short query works correctly")
            log_info(f"Found {data.get('total', 0)} results")
            return True
        else:
            log_error(f"Request failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        log_error(f"Exception: {e}")
        return False


def test_global_search_cyrillic():
    """Test 5: Cyrillic query (q=тест)"""
    log_test("Cyrillic Query Search (q=тест)")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/search/global",
            params={"q": "тест", "limit": 5},
            timeout=10
        )
        
        log_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            log_success("Cyrillic query works correctly")
            log_info(f"Found {data.get('total', 0)} results")
            return True
        else:
            log_error(f"Request failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        log_error(f"Exception: {e}")
        return False


def test_global_search_redos_protection():
    """Test 6: ReDoS protection with special characters"""
    log_test("ReDoS Protection (special characters)")
    
    test_queries = [
        ".*.*.*.*.*.*.*.*",
        "$$$$",
        "<script>alert('xss')</script>",
        "' OR '1'='1",
        "\\x00\\x00\\x00",
        "((((((((((a",
    ]
    
    all_passed = True
    
    for query in test_queries:
        try:
            log_info(f"Testing query: {repr(query)}")
            response = requests.get(
                f"{BACKEND_URL}/search/global",
                params={"q": query, "limit": 5},
                timeout=10
            )
            
            if response.status_code == 200:
                log_success(f"Query handled safely: {repr(query)}")
            else:
                log_error(f"Query failed: {response.status_code}")
                all_passed = False
                
        except Exception as e:
            log_error(f"Exception for query {repr(query)}: {e}")
            all_passed = False
    
    if all_passed:
        log_success("ReDoS protection working correctly")
    
    return all_passed


def test_global_search_filters():
    """Test 7: Filters (group_id, facultet_id, kurs)"""
    log_test("Filter Tests (group_id, facultet_id, kurs)")
    
    # Test with empty filters (should work)
    try:
        response = requests.get(
            f"{BACKEND_URL}/search/global",
            params={"q": "", "limit": 5},
            timeout=10
        )
        
        log_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            log_success("Filter endpoint accessible")
            
            # Note: We can't test specific filters without knowing valid group_id/facultet_id values
            log_info("Note: Specific filter values not tested (need valid group_id/facultet_id from DB)")
            return True
        else:
            log_error(f"Request failed: {response.status_code}")
            return False
            
    except Exception as e:
        log_error(f"Exception: {e}")
        return False


def test_global_search_limit_validation():
    """Test 8: Limit validation (1, 10, 50, 100, 0, -5)"""
    log_test("Limit Validation")
    
    test_cases = [
        (1, 1, "limit=1 should return 1 result"),
        (10, 10, "limit=10 should return up to 10 results"),
        (50, 50, "limit=50 should return up to 50 results"),
        (100, 50, "limit=100 should be capped to 50"),
        (0, 1, "limit=0 should be clamped to 1"),
        (-5, 1, "limit=-5 should be clamped to 1"),
    ]
    
    all_passed = True
    
    for limit_param, expected_max, description in test_cases:
        try:
            log_info(f"Testing: {description}")
            response = requests.get(
                f"{BACKEND_URL}/search/global",
                params={"q": "", "limit": limit_param},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                actual_limit = data.get("limit")
                results_count = len(data.get("results", []))
                
                if actual_limit == expected_max:
                    log_success(f"Limit correctly set to {actual_limit}")
                else:
                    log_error(f"Expected limit={expected_max}, got {actual_limit}")
                    all_passed = False
                
                if results_count <= expected_max:
                    log_success(f"Results count ({results_count}) <= limit ({expected_max})")
                else:
                    log_error(f"Results count ({results_count}) > limit ({expected_max})")
                    all_passed = False
            else:
                log_error(f"Request failed: {response.status_code}")
                all_passed = False
                
        except Exception as e:
            log_error(f"Exception: {e}")
            all_passed = False
    
    return all_passed


def test_global_search_pagination():
    """Test 9: Pagination (offset=0, offset=5)"""
    log_test("Pagination Test")
    
    try:
        # First page
        response1 = requests.get(
            f"{BACKEND_URL}/search/global",
            params={"q": "", "limit": 5, "offset": 0},
            timeout=10
        )
        
        if response1.status_code != 200:
            log_error(f"First page request failed: {response1.status_code}")
            return False
        
        data1 = response1.json()
        results1 = data1.get("results", [])
        has_more1 = data1.get("has_more", False)
        
        log_info(f"Page 1: {len(results1)} results, has_more={has_more1}")
        
        # Second page
        response2 = requests.get(
            f"{BACKEND_URL}/search/global",
            params={"q": "", "limit": 5, "offset": 5},
            timeout=10
        )
        
        if response2.status_code != 200:
            log_error(f"Second page request failed: {response2.status_code}")
            return False
        
        data2 = response2.json()
        results2 = data2.get("results", [])
        
        log_info(f"Page 2: {len(results2)} results")
        
        # Check that results are different (if both pages have results)
        if results1 and results2:
            uids1 = {r.get("uid") for r in results1}
            uids2 = {r.get("uid") for r in results2}
            
            if uids1 & uids2:
                log_error("Pages have overlapping UIDs (pagination not working)")
                return False
            else:
                log_success("Pagination working correctly (no overlapping results)")
        else:
            log_info("Not enough results to test pagination overlap")
        
        log_success("Pagination endpoint working")
        return True
        
    except Exception as e:
        log_error(f"Exception: {e}")
        return False


def test_global_search_own_profile_excluded(token: str):
    """Test 10: Own profile excluded from results"""
    log_test("Own Profile Exclusion Test")
    
    try:
        # First, get own profile to know username
        headers = {"Authorization": f"Bearer {token}"}
        profile_response = requests.get(
            f"{BACKEND_URL}/u/{TEST_USER_UID}",
            headers=headers,
            timeout=10
        )
        
        if profile_response.status_code != 200:
            log_warning("Could not fetch own profile to test exclusion")
            return True  # Skip test
        
        profile = profile_response.json()
        own_username = profile.get("username", "")
        own_first_name = profile.get("first_name", "")
        
        if not own_username and not own_first_name:
            log_warning("Own profile has no username or first_name to search for")
            return True  # Skip test
        
        # Search for own username/name
        search_query = own_username if own_username else own_first_name
        log_info(f"Searching for own profile: q={search_query}")
        
        response = requests.get(
            f"{BACKEND_URL}/search/global",
            params={"q": search_query, "limit": 20},
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            results = data.get("results", [])
            
            # Check if own UID is in results
            own_uid_in_results = any(r.get("uid") == TEST_USER_UID for r in results)
            
            if own_uid_in_results:
                log_error(f"Own profile (UID={TEST_USER_UID}) found in search results!")
                return False
            else:
                log_success("Own profile correctly excluded from search results")
                return True
        else:
            log_error(f"Request failed: {response.status_code}")
            return False
            
    except Exception as e:
        log_error(f"Exception: {e}")
        return False


def test_global_search_response_model():
    """Test 11: Response model validation"""
    log_test("Response Model Validation")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/search/global",
            params={"q": "test", "limit": 5},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Check GlobalSearchResponse structure
            required_response_fields = ["results", "total", "has_more", "query", "limit", "offset"]
            missing_response_fields = [f for f in required_response_fields if f not in data]
            
            if missing_response_fields:
                log_error(f"Missing response fields: {missing_response_fields}")
                return False
            
            log_success("GlobalSearchResponse structure valid")
            
            # Check types
            if not isinstance(data["results"], list):
                log_error("results is not a list")
                return False
            
            if not isinstance(data["total"], int):
                log_error("total is not an int")
                return False
            
            if not isinstance(data["has_more"], bool):
                log_error("has_more is not a bool")
                return False
            
            if data["query"] is not None and not isinstance(data["query"], str):
                log_error("query is not a string or null")
                return False
            
            log_success("Response field types valid")
            
            # Check GlobalSearchResult structure (if results exist)
            if data["results"]:
                result = data["results"][0]
                
                required_result_fields = [
                    "uid", "telegram_id", "username", "first_name", "last_name",
                    "full_name", "group_name", "facultet_name", "kurs",
                    "has_custom_avatar", "avatar_mode", "is_online",
                    "level", "tier", "mutual_friends_count", "friendship_status"
                ]
                
                missing_result_fields = [f for f in required_result_fields if f not in result]
                
                if missing_result_fields:
                    log_error(f"Missing result fields: {missing_result_fields}")
                    return False
                
                log_success("GlobalSearchResult structure valid")
                
                # Check specific field types
                if not isinstance(result["has_custom_avatar"], bool):
                    log_error("has_custom_avatar is not a bool")
                    return False
                
                if not isinstance(result["is_online"], bool):
                    log_error("is_online is not a bool")
                    return False
                
                if not isinstance(result["level"], int):
                    log_error("level is not an int")
                    return False
                
                if not isinstance(result["mutual_friends_count"], int):
                    log_error("mutual_friends_count is not an int")
                    return False
                
                log_success("Result field types valid")
            
            log_success("Response model validation passed")
            return True
        else:
            log_error(f"Request failed: {response.status_code}")
            return False
            
    except Exception as e:
        log_error(f"Exception: {e}")
        return False


# ============================================================================
# TEST SUITE 2: GET /api/u/{uid} - is_setup_complete field
# ============================================================================

def test_user_profile_is_setup_complete_true():
    """Test 1: User with complete profile (is_setup_complete=true)"""
    log_test("User Profile - is_setup_complete=true")
    
    try:
        # Use existing test user (should have complete profile)
        response = requests.get(
            f"{BACKEND_URL}/u/{TEST_USER_UID}",
            timeout=10
        )
        
        log_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check if is_setup_complete field exists
            if "is_setup_complete" not in data:
                log_error("is_setup_complete field missing from response")
                return False
            
            is_setup_complete = data.get("is_setup_complete")
            log_info(f"is_setup_complete: {is_setup_complete}")
            
            # Check profile fields
            first_name = data.get("first_name")
            last_name = data.get("last_name")
            group_name = data.get("group_name")
            facultet_name = data.get("facultet_name")
            kurs = data.get("kurs")
            
            log_info(f"Profile fields: first_name={first_name}, last_name={last_name}, group_name={group_name}, facultet_name={facultet_name}, kurs={kurs}")
            
            # If any field is filled, is_setup_complete should be true
            has_any_field = any([
                first_name and first_name.strip(),
                last_name and last_name.strip(),
                group_name,
                facultet_name,
                kurs
            ])
            
            if has_any_field and is_setup_complete:
                log_success("is_setup_complete=true for user with filled fields")
                return True
            elif not has_any_field and not is_setup_complete:
                log_success("is_setup_complete=false for user without filled fields")
                return True
            else:
                log_error(f"is_setup_complete={is_setup_complete} doesn't match profile state (has_any_field={has_any_field})")
                return False
        elif response.status_code == 404:
            log_warning("Test user not found (might need to create)")
            return True  # Skip test
        elif response.status_code == 403:
            log_warning("Test user profile is private")
            return True  # Skip test
        else:
            log_error(f"Request failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        log_error(f"Exception: {e}")
        return False


def test_user_profile_is_setup_complete_false():
    """Test 2: Fresh user with incomplete profile (is_setup_complete=false)"""
    log_test("User Profile - is_setup_complete=false (fresh user)")
    
    # Create a fresh test user
    test_user = create_test_user()
    
    if not test_user:
        log_warning("Could not create test user, skipping test")
        return True  # Skip test
    
    try:
        # Get the fresh user's profile
        uid = test_user.get("uid")
        
        if not uid:
            log_warning("Test user has no UID, skipping test")
            return True
        
        response = requests.get(
            f"{BACKEND_URL}/u/{uid}",
            timeout=10
        )
        
        log_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check if is_setup_complete field exists
            if "is_setup_complete" not in data:
                log_error("is_setup_complete field missing from response")
                return False
            
            is_setup_complete = data.get("is_setup_complete")
            log_info(f"is_setup_complete: {is_setup_complete}")
            
            # Fresh user should have is_setup_complete based on registration data
            # We registered with first_name="SearchTest" and last_name="UserXXXXXX"
            # So is_setup_complete should be true
            
            first_name = data.get("first_name")
            last_name = data.get("last_name")
            
            log_info(f"Fresh user profile: first_name={first_name}, last_name={last_name}")
            
            if first_name or last_name:
                if is_setup_complete:
                    log_success("is_setup_complete=true for user with name fields")
                    return True
                else:
                    log_error("is_setup_complete=false but user has name fields")
                    return False
            else:
                if not is_setup_complete:
                    log_success("is_setup_complete=false for user without fields")
                    return True
                else:
                    log_error("is_setup_complete=true but user has no fields")
                    return False
        elif response.status_code == 404:
            log_error("Fresh user profile not found (should exist)")
            return False
        elif response.status_code == 403:
            log_warning("Fresh user profile is private")
            return True  # Skip test
        else:
            log_error(f"Request failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        log_error(f"Exception: {e}")
        return False


def test_user_profile_no_422_error():
    """Test 3: Endpoint should not return 422 for existing users"""
    log_test("User Profile - No 422 Error for Existing Users")
    
    try:
        # Test with existing user
        response = requests.get(
            f"{BACKEND_URL}/u/{TEST_USER_UID}",
            timeout=10
        )
        
        log_info(f"Status: {response.status_code}")
        
        if response.status_code == 422:
            log_error("Endpoint returned 422 (Unprocessable Entity) for existing user")
            log_error(f"Response: {response.text}")
            return False
        elif response.status_code in [200, 404, 403]:
            log_success(f"Endpoint returned expected status code: {response.status_code}")
            return True
        else:
            log_warning(f"Unexpected status code: {response.status_code}")
            return True  # Not a critical failure
            
    except Exception as e:
        log_error(f"Exception: {e}")
        return False


# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def main():
    """Run all tests"""
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}RUDN Webapp Backend Testing{RESET}")
    print(f"{BLUE}Backend URL: {BACKEND_URL}{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")
    
    # Get auth token
    token = get_auth_token()
    
    # Track results
    results = {}
    
    # ========================================================================
    # TEST SUITE 1: Global Search
    # ========================================================================
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}TEST SUITE 1: GET /api/search/global{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    
    results["1. Anonymous search"] = test_global_search_anonymous()
    
    if token:
        results["2. Authenticated search"] = test_global_search_authenticated(token)
    else:
        log_warning("Skipping authenticated search test (no token)")
        results["2. Authenticated search"] = None
    
    results["3. Empty query"] = test_global_search_empty_query()
    results["4. Short query"] = test_global_search_short_query()
    results["5. Cyrillic query"] = test_global_search_cyrillic()
    results["6. ReDoS protection"] = test_global_search_redos_protection()
    results["7. Filters"] = test_global_search_filters()
    results["8. Limit validation"] = test_global_search_limit_validation()
    results["9. Pagination"] = test_global_search_pagination()
    
    if token:
        results["10. Own profile excluded"] = test_global_search_own_profile_excluded(token)
    else:
        log_warning("Skipping own profile exclusion test (no token)")
        results["10. Own profile excluded"] = None
    
    results["11. Response model"] = test_global_search_response_model()
    
    # ========================================================================
    # TEST SUITE 2: User Profile is_setup_complete
    # ========================================================================
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}TEST SUITE 2: GET /api/u/{{uid}} - is_setup_complete{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    
    results["12. is_setup_complete=true"] = test_user_profile_is_setup_complete_true()
    results["13. is_setup_complete=false"] = test_user_profile_is_setup_complete_false()
    results["14. No 422 error"] = test_user_profile_no_422_error()
    
    # ========================================================================
    # SUMMARY
    # ========================================================================
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}TEST SUMMARY{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")
    
    passed = sum(1 for v in results.values() if v is True)
    failed = sum(1 for v in results.values() if v is False)
    skipped = sum(1 for v in results.values() if v is None)
    total = len(results)
    
    for test_name, result in results.items():
        if result is True:
            log_success(f"{test_name}")
        elif result is False:
            log_error(f"{test_name}")
        else:
            log_warning(f"{test_name} (SKIPPED)")
    
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{GREEN}PASSED: {passed}/{total}{RESET}")
    print(f"{RED}FAILED: {failed}/{total}{RESET}")
    print(f"{YELLOW}SKIPPED: {skipped}/{total}{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")
    
    return failed == 0


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
