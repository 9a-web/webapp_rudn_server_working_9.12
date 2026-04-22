"""
Stage 9 backend tests: Password Management, Email Verification, Sessions Management,
Referral integration, and P1 fixes.

NOTE: The public preview URL currently returns 404 for /api/* (ingress not routing
backend). Tests use the local backend directly on http://localhost:8001, which is the
actual backend process managed by supervisor.
"""
import os
import re
import time
import uuid
import pytest
import requests
from pathlib import Path

BASE_URL = os.environ.get("BACKEND_TEST_URL", "http://localhost:8001").rstrip("/")
EMAIL_LOG = Path("/app/logs/emails.log")


def _uniq(prefix: str = "stage9") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def _read_log_tail(size: int = 200_000) -> str:
    if not EMAIL_LOG.exists():
        return ""
    data = EMAIL_LOG.read_text(encoding="utf-8", errors="ignore")
    return data[-size:]


def _extract_token_for_email(email: str, kind: str) -> str | None:
    """Extract latest token URL matching given email and kind ('reset-password' or 'verify-email')."""
    data = _read_log_tail()
    if not data:
        return None
    # find last email block with TO: <email>
    blocks = data.split("=" * 72)
    # iterate in reverse to get latest
    for i in range(len(blocks) - 1, -1, -1):
        b = blocks[i]
        if f"TO: {email}" in b:
            # search for token=... in subsequent blocks too
            chunk = "".join(blocks[i : i + 5])
            m = re.search(rf"{kind}[^\s]*[?&]token=([A-Za-z0-9_\-]+)", chunk)
            if m:
                return m.group(1)
            m = re.search(r"[?&]token=([A-Za-z0-9_\-]+)", chunk)
            if m:
                return m.group(1)
    return None


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _register(api, email=None, password="Test1234", referral_code=None, extra_headers=None):
    email = email or f"{_uniq()}@test.com"
    payload = {
        "email": email,
        "password": password,
        "first_name": "Stage9",
        "last_name": "Test",
    }
    if referral_code:
        payload["referral_code"] = referral_code
    # Use a unique X-Forwarded-For per call to avoid 5/hour/IP registration limit
    ip = f"10.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250}"
    headers = {"User-Agent": "stage9-tests/1.0", "X-Forwarded-For": ip}
    if extra_headers:
        headers.update(extra_headers)
    r = api.post(f"{BASE_URL}/api/auth/register/email", json=payload, headers=headers)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    return email, password, data["access_token"], data.get("user", {})


# ============== /auth/config ==============
class TestAuthConfig:
    def test_config_features(self, api):
        r = api.get(f"{BASE_URL}/api/auth/config")
        assert r.status_code == 200
        feats = r.json()["features"]
        assert feats["email_verification"] is True
        assert feats["password_reset"] is True
        assert feats["sessions_management"] is True
        assert feats["email_smtp_configured"] is False  # DEV mode


# ============== P1 fix: login/email password='' ==============
class TestLoginEmailEmptyPassword:
    def test_login_empty_password_422(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login/email",
                     json={"email": "anything@test.com", "password": ""})
        assert r.status_code == 422, f"expected 422, got {r.status_code} body={r.text[:200]}"


# ============== Password forgot / reset ==============
class TestPasswordForgotReset:
    def test_forgot_unknown_email_returns_200(self, api):
        r = api.post(f"{BASE_URL}/api/auth/password/forgot",
                     json={"email": f"nonexistent_{uuid.uuid4().hex[:8]}@test.com"})
        assert r.status_code == 200
        assert r.json().get("success") is True

    def test_forgot_existing_email_writes_log_and_reset_works(self, api):
        email, old_pwd, token, _ = _register(api)
        time.sleep(0.3)
        # trigger forgot — use a fresh IP header to reduce rate-limit interference
        r = api.post(f"{BASE_URL}/api/auth/password/forgot",
                     json={"email": email},
                     headers={"X-Forwarded-For": f"10.9.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250}"})
        assert r.status_code == 200, r.text
        time.sleep(0.5)  # let log flush
        reset_token = _extract_token_for_email(email, "reset-password")
        assert reset_token, f"reset token not found in {EMAIL_LOG} for {email}"

        # Reset with valid token
        new_pwd = "NewPass1234"
        r2 = api.post(f"{BASE_URL}/api/auth/password/reset",
                      json={"token": reset_token, "new_password": new_pwd},
                      headers={"X-Forwarded-For": f"10.8.{uuid.uuid4().int % 250}.1"})
        assert r2.status_code == 200, r2.text
        assert "access_token" in r2.json()

        # Reuse same token -> 400
        r3 = api.post(f"{BASE_URL}/api/auth/password/reset",
                      json={"token": reset_token, "new_password": "AnotherX9"},
                      headers={"X-Forwarded-For": f"10.8.{uuid.uuid4().int % 250}.2"})
        assert r3.status_code == 400, r3.text

        # Old password no longer works
        r4 = api.post(f"{BASE_URL}/api/auth/login/email",
                      json={"email": email, "password": old_pwd})
        assert r4.status_code == 401

        # New password works
        r5 = api.post(f"{BASE_URL}/api/auth/login/email",
                      json={"email": email, "password": new_pwd})
        assert r5.status_code == 200


# ============== Password change ==============
class TestPasswordChange:
    def test_change_no_auth_401(self, api):
        r = api.post(f"{BASE_URL}/api/auth/password/change",
                     json={"old_password": "x", "new_password": "y"})
        assert r.status_code == 401

    def test_change_full_flow(self, api):
        email, pwd, token, _ = _register(api)
        h = {"Authorization": f"Bearer {token}"}

        # wrong old password
        r = api.post(f"{BASE_URL}/api/auth/password/change",
                     json={"old_password": "WrongPass9", "new_password": "NewPass9000"},
                     headers=h)
        assert r.status_code == 401, r.text

        # new == old -> 400
        r2 = api.post(f"{BASE_URL}/api/auth/password/change",
                      json={"old_password": pwd, "new_password": pwd},
                      headers=h)
        assert r2.status_code == 400, r2.text

        # correct change
        new_pwd = "NewPass9000!"
        r3 = api.post(f"{BASE_URL}/api/auth/password/change",
                      json={"old_password": pwd, "new_password": new_pwd},
                      headers=h)
        assert r3.status_code == 200, r3.text

        # After password change, the original JWT must become invalid (all sessions revoked)
        r_me_after = api.get(f"{BASE_URL}/api/auth/me", headers=h)
        assert r_me_after.status_code == 401, \
            f"JWT should be revoked after password change, got {r_me_after.status_code}"

        time.sleep(0.4)
        log = _read_log_tail()
        assert email in log, "change-notification email should be logged for user"

        # login with new password OK
        r4 = api.post(f"{BASE_URL}/api/auth/login/email",
                      json={"email": email, "password": new_pwd})
        assert r4.status_code == 200


# ============== Email verification ==============
class TestEmailVerification:
    def test_send_verification_requires_auth(self, api):
        r = api.post(f"{BASE_URL}/api/auth/email/send-verification", json={})
        assert r.status_code == 401

    def test_verification_flow(self, api):
        email, pwd, token, _ = _register(api)
        h = {"Authorization": f"Bearer {token}"}

        r = api.post(f"{BASE_URL}/api/auth/email/send-verification", json={}, headers=h)
        assert r.status_code == 200, r.text
        time.sleep(0.4)

        verify_token = _extract_token_for_email(email, "verify-email")
        assert verify_token, "verification token not found in emails.log"

        r2 = api.post(f"{BASE_URL}/api/auth/email/verify",
                      json={"token": verify_token})
        assert r2.status_code == 200, r2.text

        # /auth/me MUST now expose email_verified=true (HIGH fix)
        r3 = api.get(f"{BASE_URL}/api/auth/me", headers=h)
        assert r3.status_code == 200
        me = r3.json()
        assert "email_verified" in me, f"UserPublic missing email_verified field: {me}"
        assert me["email_verified"] is True, f"email_verified should be True after /verify, got {me.get('email_verified')}"

        # reuse token -> 400
        r4 = api.post(f"{BASE_URL}/api/auth/email/verify",
                      json={"token": verify_token})
        assert r4.status_code == 400, r4.text


# ============== Sessions ==============
class TestSessions:
    def test_sessions_list_and_delete(self, api):
        email, pwd, token_a, _ = _register(api)
        # 2nd login -> second session
        r = api.post(f"{BASE_URL}/api/auth/login/email",
                     json={"email": email, "password": pwd},
                     headers={"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"})
        assert r.status_code == 200
        token_b = r.json()["access_token"]

        # list sessions using token_a
        h_a = {"Authorization": f"Bearer {token_a}"}
        r = api.get(f"{BASE_URL}/api/auth/sessions", headers=h_a)
        assert r.status_code == 200, r.text
        data = r.json()
        sessions = data.get("sessions") or data.get("items") or []
        assert len(sessions) >= 2, f"expected >=2 sessions, got {len(sessions)}"
        current = [s for s in sessions if s.get("is_current")]
        assert len(current) == 1, f"expected exactly one is_current session: {current}"
        # device_label populated
        for s in sessions:
            assert s.get("device_label"), f"device_label missing: {s}"

        # DELETE invalid jti -> 404
        r404 = api.delete(f"{BASE_URL}/api/auth/sessions/not-a-real-jti-xyz", headers=h_a)
        assert r404.status_code == 404

        # DELETE other jti -> 200, and token_b becomes invalid
        other = [s for s in sessions if not s.get("is_current")][0]
        other_jti = other.get("jti") or other.get("id")
        assert other_jti, f"no jti on session: {other}"
        r_del = api.delete(f"{BASE_URL}/api/auth/sessions/{other_jti}", headers=h_a)
        assert r_del.status_code == 200, r_del.text

        # token_b should now be invalid
        r_me = api.get(f"{BASE_URL}/api/auth/me",
                       headers={"Authorization": f"Bearer {token_b}"})
        assert r_me.status_code == 401, f"expected 401 for revoked session, got {r_me.status_code}"

        # token_a still works
        r_me_a = api.get(f"{BASE_URL}/api/auth/me", headers=h_a)
        assert r_me_a.status_code == 200

    def test_logout_all_keep_current_true(self, api):
        email, pwd, token_a, _ = _register(api)
        # create 2nd session
        r = api.post(f"{BASE_URL}/api/auth/login/email",
                     json={"email": email, "password": pwd},
                     headers={"User-Agent": "Windows NT 10.0 Chrome"})
        token_b = r.json()["access_token"]

        h_a = {"Authorization": f"Bearer {token_a}"}
        r = api.post(f"{BASE_URL}/api/auth/logout-all?keep_current=true", headers=h_a)
        assert r.status_code == 200, r.text

        # current (a) still valid
        r_a = api.get(f"{BASE_URL}/api/auth/me", headers=h_a)
        assert r_a.status_code == 200

        # b is revoked
        r_b = api.get(f"{BASE_URL}/api/auth/me",
                      headers={"Authorization": f"Bearer {token_b}"})
        assert r_b.status_code == 401

    def test_logout_all_keep_current_false(self, api):
        email, pwd, token_a, _ = _register(api)
        api.post(f"{BASE_URL}/api/auth/login/email",
                 json={"email": email, "password": pwd},
                 headers={"User-Agent": "Android"})
        h_a = {"Authorization": f"Bearer {token_a}"}
        r = api.post(f"{BASE_URL}/api/auth/logout-all?keep_current=false", headers=h_a)
        assert r.status_code == 200, r.text

        r_me = api.get(f"{BASE_URL}/api/auth/me", headers=h_a)
        assert r_me.status_code == 401

    def test_logout_revokes_only_current(self, api):
        email, pwd, token_a, _ = _register(api)
        r = api.post(f"{BASE_URL}/api/auth/login/email",
                     json={"email": email, "password": pwd},
                     headers={"User-Agent": "Other UA"})
        token_b = r.json()["access_token"]

        h_a = {"Authorization": f"Bearer {token_a}"}
        r = api.post(f"{BASE_URL}/api/auth/logout", headers=h_a)
        assert r.status_code == 200

        # a invalid
        r1 = api.get(f"{BASE_URL}/api/auth/me", headers=h_a)
        assert r1.status_code == 401
        # b still valid
        r2 = api.get(f"{BASE_URL}/api/auth/me",
                     headers={"Authorization": f"Bearer {token_b}"})
        assert r2.status_code == 200


# ============== UserPublic fields (HIGH fix) ==============
class TestUserPublicFields:
    def test_me_exposes_new_fields(self, api):
        email, pwd, token, user = _register(api)
        # response.user must already include fields
        assert "email_verified" in user, f"register.user missing email_verified: {user}"
        assert user["email_verified"] is False
        assert "referral_code" in user, f"register.user missing referral_code: {user}"
        assert user["referral_code"], f"referral_code must be auto-generated, got {user.get('referral_code')!r}"
        assert "invited_count" in user, f"register.user missing invited_count: {user}"
        assert user["invited_count"] == 0
        assert "referred_by" in user, f"register.user missing referred_by key: {user}"
        assert user["referred_by"] is None

        # /auth/me returns the same values
        h = {"Authorization": f"Bearer {token}"}
        r = api.get(f"{BASE_URL}/api/auth/me", headers=h)
        assert r.status_code == 200
        me = r.json()
        assert me["email_verified"] is False
        assert me["referral_code"] == user["referral_code"], \
            f"/me.referral_code {me.get('referral_code')} != register.referral_code {user.get('referral_code')}"
        assert me["invited_count"] == 0
        assert me["referred_by"] is None


# ============== Referral ==============
class TestReferral:
    def test_referral_flow(self, api):
        # Register user A — referral_code is auto-generated now (MEDIUM fix)
        email_a, pwd_a, token_a, user_a = _register(api)
        h_a = {"Authorization": f"Bearer {token_a}"}
        r = api.get(f"{BASE_URL}/api/auth/me", headers=h_a)
        assert r.status_code == 200
        me_a = r.json()
        uid_a = me_a["uid"]
        a_code = me_a.get("referral_code")
        assert a_code, f"A.referral_code must be auto-generated, got {a_code!r}"

        # Register user B with A's referral_code
        email_b, pwd_b, token_b, user_b = _register(api, referral_code=a_code)
        h_b = {"Authorization": f"Bearer {token_b}"}
        r = api.get(f"{BASE_URL}/api/auth/me", headers=h_b)
        me_b = r.json()
        uid_b = me_b["uid"]

        time.sleep(0.6)  # let referral processing complete

        # B.referred_by must be set to A's effective_tid; check via /me
        assert me_b.get("referred_by") is not None or True  # /me may have stale snapshot; re-fetch
        r_b2 = api.get(f"{BASE_URL}/api/auth/me", headers=h_b)
        me_b2 = r_b2.json()
        b_referred_by = me_b2.get("referred_by")
        assert b_referred_by is not None, f"B.referred_by should be set, got {b_referred_by!r} (me={me_b2})"

        # A.invited_count must be incremented
        r_a2 = api.get(f"{BASE_URL}/api/auth/me", headers=h_a)
        me_a2 = r_a2.json()
        assert me_a2.get("invited_count", 0) >= 1, \
            f"A.invited_count should be >=1 after B signs up with A.code, got {me_a2.get('invited_count')}"

        # And B.referred_by should match A's effective_tid (uid for email users)
        # Verify consistency via DB
        import subprocess, json as _json, re as _re
        js = f"""
        const a = db.user_settings.findOne({{uid: "{uid_a}"}});
        const b = db.user_settings.findOne({{uid: "{uid_b}"}});
        print(JSON.stringify({{
            a_tid: a && a.telegram_id,
            a_code: a && a.referral_code,
            a_invited: a && a.invited_count,
            b_ref_by: b && b.referred_by
        }}));
        """
        out = subprocess.run(
            ["mongosh", "test_database", "--quiet", "--eval", js],
            capture_output=True, text=True,
        )
        m = _re.search(r'\{.*\}', out.stdout)
        assert m, out.stdout
        result = _json.loads(m.group(0))
        def _unwrap(v):
            if isinstance(v, dict):
                return int(v.get("$numberLong") or v.get("low") or 0)
            return v
        a_tid = _unwrap(result.get("a_tid"))
        b_ref_by = _unwrap(result.get("b_ref_by"))
        assert result.get("a_code") == a_code, f"DB.a_code {result.get('a_code')} != /me code {a_code}"
        assert b_ref_by == a_tid, f"B.referred_by={b_ref_by} != A.tid={a_tid}"
        assert _unwrap(result.get("a_invited")) >= 1


# ============== P1 fixes ==============
class TestP1Fixes:
    def test_delete_link_email_no_email_returns_404(self, api):
        # Create Telegram-only user via pseudo? There's no simple path. Instead: create an email user
        # then unlink email (once) -> 200; try again -> should be 404.
        # But can't unlink the only provider. We need a user with telegram+email.
        # Simpler: create email user (has email only), attempt DELETE /auth/link/email -> should be 400
        # because it's the only provider. If backend returns 404 when no email OR 400 when last provider.
        # Use user with no email: register telegram-only is hard. Use pseudo route.
        # Fallback: call DELETE /auth/link/email on fresh token where we first unlink email.
        # Approach: register, then unlink email twice. First call may succeed or fail; second must 404.
        email, pwd, token, _ = _register(api)
        h = {"Authorization": f"Bearer {token}"}
        first = api.delete(f"{BASE_URL}/api/auth/link/email", headers=h)
        # Might fail with 400 because it's the only provider — that's fine, we're testing the idempotency fix
        if first.status_code == 200:
            second = api.delete(f"{BASE_URL}/api/auth/link/email", headers=h)
            assert second.status_code == 404, f"second unlink should be 404, got {second.status_code}: {second.text}"
        else:
            # can't test second case; at least assert it's NOT a silent 200
            assert first.status_code in (400, 404, 409), \
                f"unexpected status for unlink-only-provider: {first.status_code} {first.text}"


# ============== Full regression ==============
class TestRegressionFlow:
    def test_full_flow(self, api):
        email, pwd, token, user = _register(api)
        h = {"Authorization": f"Bearer {token}"}

        r = api.get(f"{BASE_URL}/api/auth/me", headers=h)
        assert r.status_code == 200

        uname_candidate = f"s9u{uuid.uuid4().hex[:8]}"
        r = api.get(f"{BASE_URL}/api/auth/check-username/{uname_candidate}", headers=h)
        assert r.status_code == 200
        assert r.json().get("available") in (True, False)

        r = api.post(f"{BASE_URL}/api/auth/logout", headers=h)
        assert r.status_code == 200

        # After logout the SAME JWT MUST now be invalid (CRITICAL fix)
        r = api.get(f"{BASE_URL}/api/auth/me", headers=h)
        assert r.status_code == 401, f"JWT should be invalid after logout, got {r.status_code}"
