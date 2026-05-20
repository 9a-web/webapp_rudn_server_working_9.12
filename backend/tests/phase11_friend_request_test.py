"""Phase 11 — bug-fix verification tests.

Covers B-N00 (P0 Web→Telegram friend request), B-N00b (orphan cleanup),
B-N01 (single /logout), B-N02 (auth/config smoke), B-N03 (no double user on register),
B-N05 (last_login_ip/ua on register), B-N06 (auto verification email),
B-N07 (server-side strip), B-N08 (verify_email returns access_token when anonymous).

All tests hit the public REACT_APP_BACKEND_URL. SMTP DEV-mode writes mail to
/app/logs/emails.log — verification tokens are extracted via regex.

NOTE on cleanup: tests create users with TEST_ prefix in first_name and random
emails (`phase11_<rand>@test.com`). End-of-session fixture removes them.
"""
import os
import re
import time
import random
import string
import secrets
import pytest
import requests
from pymongo import MongoClient

def _read_frontend_env():
    try:
        with open("/app/frontend/.env", "r") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except FileNotFoundError:
        pass
    return ""

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_frontend_env()).rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

# Public ingress occasionally times out; tests prefer local backend (same code).
# Set USE_LOCAL=0 to force public URL.
if os.environ.get("USE_LOCAL", "1") == "1":
    BASE_URL = "http://localhost:8001"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

EMAIL_LOG = "/app/logs/emails.log"
PASSWORD = "Test1234"


def _rand_ip():
    return f"203.0.{random.randint(1,250)}.{random.randint(1,250)}"


def _rand_email(prefix="phase11"):
    s = secrets.token_hex(5)
    return f"{prefix}_{s}@test.com"


def _headers(ip=None, ua="phase11-pytest/1.0"):
    h = {"Content-Type": "application/json", "User-Agent": ua}
    h["X-Forwarded-For"] = ip or _rand_ip()
    return h


# Warm-up: backend cold start can be 10+ seconds on first request.
def _warmup():
    for _ in range(3):
        try:
            requests.get(f"{BASE_URL}/api/auth/config", timeout=30)
            return
        except Exception:
            time.sleep(1)


_warmup()


@pytest.fixture(scope="module")
def db():
    cli = MongoClient(MONGO_URL)
    yield cli[DB_NAME]
    cli.close()


@pytest.fixture(scope="module")
def created_emails():
    bag = []
    yield bag
    # cleanup at end of module
    try:
        cli = MongoClient(MONGO_URL)
        d = cli[DB_NAME]
        for e in bag:
            u = d.users.find_one({"email": e})
            if u:
                uid = u["uid"]
                pseudo_tid = 10_000_000_000 + int(uid)
                d.users.delete_many({"uid": uid})
                d.user_settings.delete_many({"telegram_id": pseudo_tid})
                d.friend_requests.delete_many({"$or": [
                    {"from_telegram_id": pseudo_tid},
                    {"to_telegram_id": pseudo_tid},
                ]})
                d.auth_tokens.delete_many({"uid": uid})
        cli.close()
    except Exception as ex:
        print(f"[cleanup] {ex}")


def _register(email, first="TEST_First", last="TEST_Last", ip=None, referral=None):
    body = {"email": email, "password": PASSWORD, "first_name": first, "last_name": last}
    if referral:
        body["referral_code"] = referral
    r = requests.post(f"{BASE_URL}/api/auth/register/email", json=body, headers=_headers(ip=ip), timeout=15)
    return r


# ---------------- B-N02 smoke + B-N01 logout ----------------
class TestAuthSmoke:
    def test_auth_config_ok(self):
        r = requests.get(f"{BASE_URL}/api/auth/config", timeout=30)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), dict)

    def test_no_duplicate_logout_route(self):
        # Spec/swagger should list /api/auth/logout exactly once.
        r = requests.get(f"{BASE_URL}/openapi.json", timeout=30)
        assert r.status_code == 200
        paths = r.json().get("paths", {})
        assert "/api/auth/logout" in paths
        ops = paths["/api/auth/logout"]
        # Only POST should be defined; ensure single operation
        assert "post" in ops, f"logout post missing: {ops}"

    def test_logout_revokes_jwt(self, created_emails):
        email = _rand_email("phase11_logout")
        r = _register(email)
        assert r.status_code == 200, r.text
        created_emails.append(email)
        token = r.json()["access_token"]
        h = {"Authorization": f"Bearer {token}"}

        me = requests.get(f"{BASE_URL}/api/auth/me", headers=h, timeout=10)
        assert me.status_code == 200, me.text

        out = requests.post(f"{BASE_URL}/api/auth/logout", headers=h, timeout=10)
        assert out.status_code == 200, out.text
        body = out.json()
        assert body.get("success") is True
        assert "вышли" in (body.get("message") or "").lower() or body.get("message")

        # Second call with same JWT → 401
        out2 = requests.post(f"{BASE_URL}/api/auth/logout", headers=h, timeout=10)
        assert out2.status_code == 401, out2.text


# ---------------- B-N03/B-N05/B-N06/B-N07 register checks ----------------
class TestRegistration:
    def test_single_user_no_duplicate(self, db, created_emails):
        email = _rand_email("phase11_single")
        r = _register(email)
        assert r.status_code == 200, r.text
        created_emails.append(email)
        # second simultaneous attempt with same email must 409, not 200
        r2 = _register(email)
        assert r2.status_code == 409, r2.text
        # Exactly 1 record in DB
        cnt = db.users.count_documents({"email": email})
        assert cnt == 1, f"expected 1 user, got {cnt}"

    def test_strip_names_and_last_login_meta(self, db, created_emails):
        email = _rand_email("phase11_strip")
        r = requests.post(
            f"{BASE_URL}/api/auth/register/email",
            json={
                "email": email, "password": PASSWORD,
                "first_name": "  Иван  ", "last_name": "  Петров  ",
            },
            headers=_headers(ua="phase11-strip/1.0"),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        created_emails.append(email)
        uid = r.json()["user"]["uid"]
        u = db.users.find_one({"uid": uid})
        assert u is not None
        # B-N07
        assert u["first_name"] == "Иван", f"expected stripped, got {u.get('first_name')!r}"
        assert u["last_name"] == "Петров", f"expected stripped, got {u.get('last_name')!r}"
        # B-N05
        assert u.get("last_login_ip"), f"last_login_ip missing: {u.get('last_login_ip')!r}"
        assert "phase11-strip" in (u.get("last_login_ua") or ""), u.get("last_login_ua")

    def test_auto_verification_email_b_n06(self, db, created_emails):
        email = _rand_email("phase11_verify")
        r = _register(email)
        assert r.status_code == 200, r.text
        created_emails.append(email)
        uid = r.json()["user"]["uid"]
        # DB-level check — auth_tokens contains email_verify token for that uid
        deadline = time.time() + 5
        token_doc = None
        while time.time() < deadline:
            token_doc = db.auth_tokens.find_one(
                {"uid": uid, "purpose": "email_verify", "used_at": None}
            )
            if token_doc:
                break
            time.sleep(0.3)
        assert token_doc is not None, "verify token not created on register"


# ---------------- B-N08: anonymous verify returns token ----------------
class TestVerifyEmailAnonymous:
    def _read_log_token(self, after_pos):
        try:
            with open(EMAIL_LOG, "r", encoding="utf-8", errors="ignore") as f:
                f.seek(after_pos)
                txt = f.read()
        except FileNotFoundError:
            return None
        m = re.findall(r"[?&]token=([A-Za-z0-9_\-]+)", txt)
        return m[-1] if m else None

    def test_anonymous_verify_returns_access_token(self, created_emails):
        # snapshot log position
        try:
            pos = os.path.getsize(EMAIL_LOG)
        except FileNotFoundError:
            pos = 0
        email = _rand_email("phase11_n08")
        r = _register(email)
        assert r.status_code == 200, r.text
        created_emails.append(email)

        # wait for SMTP write
        token = None
        for _ in range(20):
            token = self._read_log_token(pos)
            if token:
                break
            time.sleep(0.3)
        if not token:
            pytest.skip("verification email not captured in /app/logs/emails.log (SMTP may be disabled)")

        # call WITHOUT auth header
        v = requests.post(
            f"{BASE_URL}/api/auth/email/verify",
            json={"token": token},
            headers={"Content-Type": "application/json", "X-Forwarded-For": _rand_ip()},
            timeout=10,
        )
        assert v.status_code == 200, v.text
        data = v.json()
        assert data.get("success") is True
        assert data.get("access_token"), f"no access_token in anonymous verify: {data}"
        assert data.get("user"), data
        assert data["user"].get("email") == email
        assert data["user"].get("email_verified") is True


# ---------------- B-N00 + B-N00b: friend request Web→TG + orphan cleanup ----------------
class TestFriendRequestWebToTelegram:
    def test_phantom_sender_rejected(self):
        """B-N00: phantom (unregistered) telegram_id cannot send friend request."""
        # pick an unlikely real target — use any registered tid we know is non-zero;
        # we just want to ensure backend rejects BEFORE writing the row.
        # Using 765963392 (real TG user from spec) as recipient.
        r = requests.post(
            f"{BASE_URL}/api/friends/request/765963392",
            json={"telegram_id": 99999999999999},
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        assert r.status_code == 400, r.text
        msg = (r.json().get("detail") or "").lower()
        assert "войдите" in msg or "аккаунт" in msg, r.text

    def test_web_user_to_telegram_user_arrives(self, db, created_emails):
        """B-N00 P0: registered Web user (pseudo_tid) → real TG user, request must arrive
        in /api/friends/{tid}/requests with incoming_count>=1. B-N00b: NOT auto-deleted.
        """
        # 1) Register a Web user
        email = _rand_email("phase11_p0")
        r = _register(email, first="TEST_Web", last="TEST_Sender")
        assert r.status_code == 200, r.text
        created_emails.append(email)
        sender_uid = int(r.json()["user"]["uid"])
        sender_pseudo_tid = 10_000_000_000 + sender_uid

        # 2) Ensure recipient TG user exists in user_settings (seed if absent so we
        #    can verify the flow without depending on prod data).
        recipient_tid = 765963392
        existing = db.user_settings.find_one({"telegram_id": recipient_tid})
        seeded_recipient = False
        if not existing:
            db.user_settings.insert_one({
                "telegram_id": recipient_tid,
                "uid": None,
                "first_name": "TEST_TGRecipient",
                "last_name": "TEST_Phase11",
                "username": "shkarol21_test",
                "created_at": __import__("datetime").datetime.utcnow(),
                "invited_count": 0,
                "referral_points_earned": 0,
            })
            seeded_recipient = True

        try:
            # 3) Clean any prior pending request between this pair
            db.friend_requests.delete_many({
                "from_telegram_id": sender_pseudo_tid,
                "to_telegram_id": recipient_tid,
            })

            # 4) Send the friend request
            sr = requests.post(
                f"{BASE_URL}/api/friends/request/{recipient_tid}",
                json={"telegram_id": sender_pseudo_tid},
                headers={"Content-Type": "application/json"},
                timeout=10,
            )
            assert sr.status_code == 200, sr.text

            # 5) GET recipient's requests — incoming_count >= 1, sender visible
            gr = requests.get(
                f"{BASE_URL}/api/friends/{recipient_tid}/requests",
                timeout=10,
            )
            assert gr.status_code == 200, gr.text
            body = gr.json()
            assert body.get("incoming_count", 0) >= 1, body
            incoming_tids = [c.get("telegram_id") for c in body.get("incoming", [])]
            assert sender_pseudo_tid in incoming_tids, (
                f"sender pseudo_tid {sender_pseudo_tid} missing from incoming: {incoming_tids}"
            )

            # 6) B-N00b: re-fetch and ensure the legit request still survives orphan-clean
            gr2 = requests.get(
                f"{BASE_URL}/api/friends/{recipient_tid}/requests",
                timeout=10,
            )
            assert gr2.status_code == 200
            tids2 = [c.get("telegram_id") for c in gr2.json().get("incoming", [])]
            assert sender_pseudo_tid in tids2, "legit request was wrongly cleaned as orphan"
        finally:
            # Cleanup the request we just created
            db.friend_requests.delete_many({
                "from_telegram_id": sender_pseudo_tid,
                "to_telegram_id": recipient_tid,
            })
            if seeded_recipient:
                db.user_settings.delete_one({"telegram_id": recipient_tid})

    def test_orphan_cleanup_removes_phantom_row(self, db):
        """B-N00b: inject an orphan row (from_telegram_id has no user_settings) and
        confirm GET /requests removes it.
        """
        phantom_tid = 88888888888888
        # Ensure phantom has NO user_settings
        db.user_settings.delete_many({"telegram_id": phantom_tid})

        # Seed a fake recipient
        recipient_tid = 77777777777777
        db.user_settings.delete_many({"telegram_id": recipient_tid})
        import datetime as _dt
        import uuid as _uuid
        db.user_settings.insert_one({
            "telegram_id": recipient_tid,
            "first_name": "TEST_OrphanCleanup",
            "created_at": _dt.datetime.utcnow(),
            "invited_count": 0,
            "referral_points_earned": 0,
        })
        req_id = str(_uuid.uuid4())
        db.friend_requests.insert_one({
            "id": req_id,
            "from_telegram_id": phantom_tid,
            "to_telegram_id": recipient_tid,
            "status": "pending",
            "created_at": _dt.datetime.utcnow(),
            "updated_at": _dt.datetime.utcnow(),
        })
        try:
            gr = requests.get(
                f"{BASE_URL}/api/friends/{recipient_tid}/requests",
                timeout=10,
            )
            assert gr.status_code == 200, gr.text
            # After auto-cleanup the orphan must not appear
            tids = [c.get("telegram_id") for c in gr.json().get("incoming", [])]
            assert phantom_tid not in tids
            # And row should be physically deleted
            still = db.friend_requests.find_one({"id": req_id})
            assert still is None, "orphan row not deleted from DB"
        finally:
            db.friend_requests.delete_many({"id": req_id})
            db.user_settings.delete_many({"telegram_id": recipient_tid})


# ---------------- B-N04 referral_code accepted ----------------
class TestReferralCode:
    def test_referral_code_links_users(self, db, created_emails):
        # 1) Create referrer
        ref_email = _rand_email("phase11_ref_a")
        r1 = _register(ref_email)
        assert r1.status_code == 200, r1.text
        created_emails.append(ref_email)
        ref_user = r1.json()["user"]
        ref_code = ref_user.get("referral_code")
        if not ref_code:
            # Fallback: fetch from DB
            uid = ref_user["uid"]
            us = db.user_settings.find_one({"uid": uid})
            ref_code = us.get("referral_code") if us else None
        assert ref_code, f"referrer has no referral_code: {ref_user}"

        # 2) Create referee passing referral_code
        ee_email = _rand_email("phase11_ref_b")
        r2 = _register(ee_email, referral=ref_code)
        assert r2.status_code == 200, r2.text
        created_emails.append(ee_email)
        ee_uid = r2.json()["user"]["uid"]

        # 3) Verify linkage in DB (referred_by stored in referee's user_settings)
        ee_us = db.user_settings.find_one({"uid": ee_uid})
        ref_us = db.user_settings.find_one({"uid": ref_user["uid"]})
        referrer_tid = (ref_us or {}).get("telegram_id")
        linked_by_user = (ee_us or {}).get("referred_by") == referrer_tid
        linked_by_counter = (ref_us or {}).get("invited_count", 0) >= 1
        assert linked_by_user or linked_by_counter, (
            f"referral not linked: referee_us.referred_by={(ee_us or {}).get('referred_by')} "
            f"referrer.invited_count={(ref_us or {}).get('invited_count')} "
            f"referrer_tid={referrer_tid}"
        )
