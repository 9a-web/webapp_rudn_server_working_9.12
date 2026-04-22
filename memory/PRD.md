# PRD — RUDN Schedule (Auth/Registration/Profile Hardening)

## Original Problem Statement
GitHub: https://github.com/9a-web/webapp_rudn_server_working_9.12.git

Глубокий аудит и максимальное улучшение функции **Регистрация / Авторизация / Профиль**:
1. Найти и исправить ВСЕ критические и минорные баги в auth/registration/profile-модулях.
2. Реализовать Password Management (forgot/reset/change с SMTP).
3. Реализовать Email Verification.
4. Реализовать Sessions/Devices management (list + revoke).
5. Полностью интегрировать referral-логику во все регистрационные endpoints.

## Language
Russian UI + code comments + Pydantic messages.

## Stack
- Backend: FastAPI + MongoDB (motor) + aiosmtplib
- Frontend: React (Vite) + Tailwind + shadcn
- Auth: JWT (HS256, с `jti` для отзыва) + bcrypt + SMTP

## Architecture
```
/app/backend/
  auth_routes.py   # /auth/* endpoints
  auth_utils.py    # JWT, bcrypt, sessions, rate-limit
  email_service.py # SMTP + DEV fallback → /app/logs/emails.log
  models.py        # Pydantic
  server.py        # app + db + app.state.db
/app/frontend/src/
  pages/ForgotPasswordPage.jsx, ResetPasswordPage.jsx, VerifyEmailPage.jsx
  components/SessionsModal.jsx, ChangePasswordModal.jsx, EmailVerificationBanner.jsx
  contexts/AuthContext.jsx, services/authAPI.js
```

## DB Collections (key)
- `users` — _id, uid, email, username (lowercase, unique), password_hash, telegram_id, vk_id, photo_url, photo_url_custom, email_verified, primary_auth, auth_providers[]
- `user_settings` — telegram_id (primary), uid, referral_code (auto-gen), referred_by, invited_count, group_id, facultet_id, …
- `auth_sessions` — uid, jti (unique), expires_at (TTL), revoked, device_label, ip, user_agent
- `auth_tokens` — token_hash (sha256), purpose (password_reset|email_verify), used, expires_at (TTL)
- `auth_events` — event, uid, provider, success, ts, ip, ua, extra (hashed email)

## What's been implemented

### Stage 9 — Full hardening (2026-04-22)
- [x] **Package 1 (P0 critical):** lowercase username migration; unique indexes on `username`/`email`; rate-limit hardening (12 buckets); `photo_url_custom` sync; `LoginEmailRequest.password min_length=1`; `DELETE /link/email` returns 404 if email absent; `choose_primary_auth` safe fallback; `is_real_telegram_user` guard.
- [x] **Package 2 — Password Management:**
  - `POST /auth/password/forgot` — privacy-aware (always 200 to prevent enumeration), rate-limited (5/hr/IP + 3/hr/email), SHA-256 hashed tokens.
  - `POST /auth/password/reset` — token validation + auto-login via `_issue_token` + revoke other sessions + email notification.
  - `POST /auth/password/change` — auth-required, wrong old → 401, new==old → 400, revokes other sessions (keeps current by design, industry-standard UX), email notification.
- [x] **Package 3 — Email Verification:**
  - `POST /auth/email/send-verification` — 5/hr/uid rate-limit.
  - `POST /auth/email/verify` — token valid, not-reused, email-not-changed check.
- [x] **Package 4 — Sessions + Referral:**
  - JWT with `jti`; `auth_sessions` collection; `register_session` on every `_issue_token`.
  - `GET /auth/sessions` with `is_current` + device_label parsing (UA).
  - `DELETE /auth/sessions/{jti}` — 404 if missing.
  - `POST /auth/logout` — revokes current session (jti) — **FIXED (was no-op)**.
  - `POST /auth/logout-all?keep_current=true|false`.
  - **Session-revocation enforcement in `get_current_user_required`** via `request.app.state.db` (FIXED 2026-04-22 — was CRITICAL bug).
  - Referral integration in `register_email`, `login_telegram`, `login_telegram_webapp`, `login_vk` — fail-soft.
  - `referral_code` auto-generated on user creation in `_create_new_user` (no more lazy).
- [x] **UserPublic extended** (2026-04-22): `email_verified`, `referral_code`, `invited_count`, `referred_by` — visible on `/auth/me` and register/login responses.
- [x] **Frontend:** ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage, SessionsModal, ChangePasswordModal, EmailVerificationBanner, AuthContext methods, authAPI methods, routes in App.jsx.

## Testing status (2026-04-22)
- **Backend iteration_1:** 11/15 pass. Found 3 issues (session revocation, UserPublic fields, referral_code lazy).
- **Backend iteration_2 (after fixes):** 15/16 pass (94%). All critical/high/medium bugs fixed and re-verified.
- **Frontend:** Not tested (user will test manually after SMTP setup).

## Pending items

### P0 (needs user input)
- **SMTP credentials** — currently DEV-mode (emails → /app/logs/emails.log). User intends to configure real SMTP (Yandex/Gmail/Mail.ru) — instructions provided.

### P1 (next up)
- RegisterWizard UX polish — better per-step validation and feedback (agent noted weak validation on steps 2/3, empty first_name accepted).
- Frontend E2E testing via testing agent (requires user approval, currently skipped per user request).

### P2 (backlog)
- Split `auth_routes.py` (~2500 lines) into `routes/email_auth.py`, `routes/oauth.py`, `routes/sessions.py`, `routes/password.py`.
- Profile UX polish and design review (if needed).

## Integrations status
- Telegram Login Widget + WebApp: configured (TEST_TELEGRAM_BOT_TOKEN).
- VK ID OAuth: configured (VK_APP_ID + VK_CLIENT_SECRET).
- SMTP: DEV-mode working; real-mode requires user SMTP credentials.

## Test credentials
See `/app/memory/test_credentials.md`.
