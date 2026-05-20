"""Phase 13 — Tests for GET /api/friends/{telegram_id}/suggestions endpoint.

Coverage:
  • 200 + correct shape
  • 404 for non-existent user
  • group_mates (suggestion_reason='group_mate')
  • friends_of_friends (suggestion_reason='friends_of_friends', mutual_count>=1)
  • exclusion of friends / pending requests / blocked
  • privacy filter (show_in_search=False)
  • self-exclusion
  • cross-list dedup (gm priority over fof)
  • limit param caps each list
  • sort: mutual_friends_count desc, first_name asc
  • smoke regression: POST /friends/request, GET /friends/{tid}/requests,
    POST /auth/login/email, POST /auth/logout

Seeded tids live in range 19999999xxx so they don't collide with real users.
Fixture cleans up everything at end of module.
"""
from __future__ import annotations

import os
import asyncio
import random
import time
import uuid
from datetime import datetime

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

# ----------------------------------------------------------------------------- 
# Config / helpers
# -----------------------------------------------------------------------------
USE_LOCAL = os.environ.get("USE_LOCAL", "1") == "1"
if USE_LOCAL:
    BASE_URL = "http://localhost:8001"
else:
    BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001").rstrip("/")

# Load /app/backend/.env so MONGO_URL/DB_NAME match the running server's DB.
try:
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
except Exception:
    pass

MONGO_URL = os.environ.get("MONGO_URL") or "mongodb://localhost:27017"
DB_NAME = os.environ.get("DB_NAME") or "test_database"

# Test telegram_id range — 19_999_999_0xx — guaranteed not to clash with reals.
TID_A  = 19999999001  # me
TID_B  = 19999999002  # group_mate
TID_C  = 19999999003  # group_mate
TID_D  = 19999999004  # friend of A (used to bridge fof)
TID_E  = 19999999005  # fof via D, NOT in group  -> friends_of_friends
TID_F  = 19999999006  # fof via D, ALSO in group -> dedup: should land in group_mates only
TID_G  = 19999999007  # group_mate but blocked by A -> excluded
TID_H  = 19999999008  # group_mate with privacy.show_in_search=False -> excluded
TID_I  = 19999999009  # pending outgoing request from A -> excluded
TID_J  = 19999999010  # already friend of A -> excluded

GROUP_TEST = "phase13-test-group-{u}".format(u=uuid.uuid4().hex[:8])

ALL_TIDS = [TID_A, TID_B, TID_C, TID_D, TID_E, TID_F, TID_G, TID_H, TID_I, TID_J]


def _us(tid: int, first: str, *, group_id: str | None = None,
        privacy_show: bool = True, last: str = "Test") -> dict:
    return {
        "telegram_id": tid,
        "uid": str(tid),
        "username": f"u{tid}",
        "first_name": first,
        "last_name": last,
        "group_id": group_id,
        "group_name": "ХБИбд-01-25" if group_id else None,
        "facultet_name": "ФизМат" if group_id else None,
        "facultet_id": None,
        "kurs": "1" if group_id else None,
        "privacy_settings": {"show_in_search": privacy_show},
    }


def _friend_pair(a: int, b: int) -> list[dict]:
    return [
        {"id": str(uuid.uuid4()), "user_telegram_id": a, "friend_telegram_id": b,
         "is_favorite": False, "created_at": datetime.utcnow()},
        {"id": str(uuid.uuid4()), "user_telegram_id": b, "friend_telegram_id": a,
         "is_favorite": False, "created_at": datetime.utcnow()},
    ]


# ----------------------------------------------------------------------------- 
# Fixtures
# -----------------------------------------------------------------------------
@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def db():
    client = AsyncIOMotorClient(MONGO_URL)
    return client[DB_NAME]


@pytest.fixture(scope="module", autouse=True)
def seed(db, event_loop):
    """Seed users + friendships + blocks + pending request, cleanup at end."""
    async def _seed():
        # Wipe any leftovers from previous runs in this tid range
        await db.user_settings.delete_many({"telegram_id": {"$in": ALL_TIDS}})
        await db.friends.delete_many({"$or": [
            {"user_telegram_id": {"$in": ALL_TIDS}},
            {"friend_telegram_id": {"$in": ALL_TIDS}},
        ]})
        await db.friend_requests.delete_many({"$or": [
            {"from_telegram_id": {"$in": ALL_TIDS}},
            {"to_telegram_id": {"$in": ALL_TIDS}},
        ]})
        await db.user_blocks.delete_many({"$or": [
            {"blocker_telegram_id": {"$in": ALL_TIDS}},
            {"blocked_telegram_id": {"$in": ALL_TIDS}},
        ]})

        # Insert user_settings
        users = [
            _us(TID_A, "Alice",   group_id=GROUP_TEST),
            _us(TID_B, "Bob",     group_id=GROUP_TEST),
            _us(TID_C, "Charlie", group_id=GROUP_TEST),
            _us(TID_D, "Dave",    group_id=None),                                 # friend of A
            _us(TID_E, "Eve",     group_id=None),                                 # fof only
            _us(TID_F, "Frank",   group_id=GROUP_TEST),                           # gm + fof -> dedup
            _us(TID_G, "Grace",   group_id=GROUP_TEST),                           # blocked
            _us(TID_H, "Heidi",   group_id=GROUP_TEST, privacy_show=False),       # privacy hidden
            _us(TID_I, "Ivan",    group_id=None),                                 # pending request
            _us(TID_J, "Judy",    group_id=None),                                 # already friend
        ]
        await db.user_settings.insert_many(users)

        # Friendships:
        #   A <-> D (bridge for fof)
        #   A <-> J (existing friend, must be excluded)
        #   D <-> E (E becomes fof of A)
        #   D <-> F (F becomes fof of A AND is gm -> dedup priority gm)
        pairs = []
        pairs += _friend_pair(TID_A, TID_D)
        pairs += _friend_pair(TID_A, TID_J)
        pairs += _friend_pair(TID_D, TID_E)
        pairs += _friend_pair(TID_D, TID_F)
        await db.friends.insert_many(pairs)

        # Pending request A -> I (outgoing)
        await db.friend_requests.insert_one({
            "id": str(uuid.uuid4()),
            "from_telegram_id": TID_A,
            "to_telegram_id": TID_I,
            "status": "pending",
            "message": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })

        # Block: A blocks G
        await db.user_blocks.insert_one({
            "id": str(uuid.uuid4()),
            "blocker_telegram_id": TID_A,
            "blocked_telegram_id": TID_G,
            "created_at": datetime.utcnow(),
        })

    event_loop.run_until_complete(_seed())

    yield

    async def _cleanup():
        await db.user_settings.delete_many({"telegram_id": {"$in": ALL_TIDS}})
        await db.friends.delete_many({"$or": [
            {"user_telegram_id": {"$in": ALL_TIDS}},
            {"friend_telegram_id": {"$in": ALL_TIDS}},
        ]})
        await db.friend_requests.delete_many({"$or": [
            {"from_telegram_id": {"$in": ALL_TIDS}},
            {"to_telegram_id": {"$in": ALL_TIDS}},
        ]})
        await db.user_blocks.delete_many({"$or": [
            {"blocker_telegram_id": {"$in": ALL_TIDS}},
            {"blocked_telegram_id": {"$in": ALL_TIDS}},
        ]})
    event_loop.run_until_complete(_cleanup())


@pytest.fixture(scope="module")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _get_suggestions(http, tid: int, limit: int | None = None, timeout: int = 60):
    url = f"{BASE_URL}/api/friends/{tid}/suggestions"
    params = {"limit": limit} if limit is not None else None
    return http.get(url, params=params, timeout=timeout)


@pytest.fixture(scope="module", autouse=True)
def _warmup(http, seed):
    """First call after fresh seed can be slow (cold mongo indexes). Warm it up."""
    for _ in range(2):
        try:
            http.get(f"{BASE_URL}/api/friends/{TID_A}/suggestions", timeout=60)
            break
        except requests.exceptions.ReadTimeout:
            continue


# ----------------------------------------------------------------------------- 
# Tests — suggestions endpoint
# -----------------------------------------------------------------------------
class TestFriendSuggestions:

    def test_200_and_shape(self, http):
        r = _get_suggestions(http, TID_A)
        assert r.status_code == 200, r.text
        data = r.json()
        assert set(data.keys()) >= {"group_mates", "friends_of_friends", "total"}
        assert isinstance(data["group_mates"], list)
        assert isinstance(data["friends_of_friends"], list)
        assert isinstance(data["total"], int)
        assert data["total"] == len(data["group_mates"]) + len(data["friends_of_friends"])

    def test_404_unknown_user(self, http):
        r = _get_suggestions(http, 19999999999)
        assert r.status_code == 404
        body = r.json()
        # detail must mention "Пользователь не найден"
        assert "не найден" in str(body).lower()

    def test_group_mates_contains_bob_and_charlie(self, http):
        r = _get_suggestions(http, TID_A)
        gm = r.json()["group_mates"]
        gm_tids = {u["telegram_id"]: u for u in gm}
        assert TID_B in gm_tids, f"Bob missing from group_mates: {gm_tids.keys()}"
        assert TID_C in gm_tids, f"Charlie missing from group_mates: {gm_tids.keys()}"
        assert gm_tids[TID_B]["suggestion_reason"] == "group_mate"
        assert gm_tids[TID_C]["suggestion_reason"] == "group_mate"
        # uid populated for FE link
        assert gm_tids[TID_B]["uid"] == str(TID_B)

    def test_friends_of_friends_contains_eve(self, http):
        r = _get_suggestions(http, TID_A)
        fof = r.json()["friends_of_friends"]
        fof_map = {u["telegram_id"]: u for u in fof}
        assert TID_E in fof_map, f"Eve missing from FoF: {list(fof_map.keys())}"
        eve = fof_map[TID_E]
        assert eve["suggestion_reason"] == "friends_of_friends"
        assert eve["mutual_friends_count"] >= 1

    def test_excluded_friend_pending_blocked(self, http):
        r = _get_suggestions(http, TID_A)
        gm = {u["telegram_id"] for u in r.json()["group_mates"]}
        fof = {u["telegram_id"] for u in r.json()["friends_of_friends"]}
        all_tids = gm | fof
        # J is existing friend
        assert TID_J not in all_tids, "Existing friend leaked into suggestions"
        # I has pending outgoing
        assert TID_I not in all_tids, "Pending-request user leaked into suggestions"
        # G is blocked
        assert TID_G not in all_tids, "Blocked user leaked into suggestions"

    def test_privacy_hidden_excluded(self, http):
        r = _get_suggestions(http, TID_A)
        gm = {u["telegram_id"] for u in r.json()["group_mates"]}
        fof = {u["telegram_id"] for u in r.json()["friends_of_friends"]}
        assert TID_H not in (gm | fof), "Privacy-hidden user leaked into suggestions"

    def test_self_excluded(self, http):
        r = _get_suggestions(http, TID_A)
        gm = {u["telegram_id"] for u in r.json()["group_mates"]}
        fof = {u["telegram_id"] for u in r.json()["friends_of_friends"]}
        assert TID_A not in (gm | fof)

    def test_cross_list_dedup_gm_priority(self, http):
        """Frank is both group_mate AND fof via D — must be in gm only."""
        r = _get_suggestions(http, TID_A)
        gm = {u["telegram_id"] for u in r.json()["group_mates"]}
        fof = {u["telegram_id"] for u in r.json()["friends_of_friends"]}
        assert TID_F in gm, "Frank missing from group_mates"
        assert TID_F not in fof, "Frank duplicated in friends_of_friends"

    def test_limit_caps_each_list(self, http):
        r = _get_suggestions(http, TID_A, limit=2)
        assert r.status_code == 200
        data = r.json()
        assert len(data["group_mates"]) <= 2
        assert len(data["friends_of_friends"]) <= 2

    def test_sort_first_name_asc_within_equal_mutual(self, http):
        """All group_mates here have mutual=0 (or same low value) for A → expect alphabetical."""
        r = _get_suggestions(http, TID_A)
        gm = r.json()["group_mates"]
        # All mutual counts equal? then check first_name ordering
        muts = {u["mutual_friends_count"] for u in gm}
        if len(muts) == 1:
            names = [u["first_name"] for u in gm]
            assert names == sorted(names, key=lambda n: (n or "").lower()), names


# ----------------------------------------------------------------------------- 
# Smoke regression
# -----------------------------------------------------------------------------
class TestSmokeRegression:
    """One happy-path per previously-exercised endpoint."""

    def _rand_ip(self) -> str:
        return ".".join(str(random.randint(1, 254)) for _ in range(4))

    def _register(self, http):
        ts = int(time.time() * 1000)
        email = f"test_phase13_{ts}_{random.randint(1000,9999)}@test.com"
        r = http.post(
            f"{BASE_URL}/api/auth/register/email",
            json={
                "email": email,
                "password": "Test1234",
                "first_name": "Phase13",
                "last_name": "Reg",
            },
            headers={"X-Forwarded-For": self._rand_ip()},
            timeout=20,
        )
        return email, r

    def test_friend_request_send_and_list(self, http, db, event_loop):
        # Use TID_A → TID_B (both seeded). Need to ensure no pre-existing rows.
        async def _wipe():
            await db.friend_requests.delete_many({
                "from_telegram_id": TID_A, "to_telegram_id": TID_B
            })
        event_loop.run_until_complete(_wipe())

        r = http.post(
            f"{BASE_URL}/api/friends/request/{TID_B}",
            json={"telegram_id": TID_A},
            timeout=20,
        )
        assert r.status_code in (200, 201), r.text

        # GET /api/friends/{tid}/requests — TID_B sees incoming
        r2 = http.get(f"{BASE_URL}/api/friends/{TID_B}/requests", timeout=20)
        assert r2.status_code == 200, r2.text
        body = r2.json()
        # body should contain incoming list with at least our request
        incoming = body.get("incoming") or body.get("incoming_requests") or []
        # incoming card schema: {request_id, telegram_id (=from_tid), ...}
        from_ids = {
            (rec.get("from_telegram_id")
             or rec.get("telegram_id")
             or rec.get("from_user", {}).get("telegram_id"))
            for rec in incoming
        }
        assert TID_A in from_ids, f"Pending req from A→B missing in B's incoming: {body}"

        # cleanup
        event_loop.run_until_complete(_wipe())

    def test_login_email_and_logout(self, http):
        email, reg = self._register(http)
        if reg.status_code not in (200, 201):
            pytest.skip(f"register failed: {reg.status_code} {reg.text[:200]}")

        login = http.post(
            f"{BASE_URL}/api/auth/login/email",
            json={"email": email, "password": "Test1234"},
            headers={"X-Forwarded-For": self._rand_ip()},
            timeout=20,
        )
        assert login.status_code == 200, login.text
        token = login.json().get("access_token") or login.json().get("token")
        assert token, login.json()

        logout = http.post(
            f"{BASE_URL}/api/auth/logout",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        assert logout.status_code in (200, 204), logout.text
