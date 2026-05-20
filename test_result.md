# RUDN Webapp — Test Result Log

## Testing Protocol
- Read this file BEFORE invoking any testing agent.
- For BACKEND changes → use `deep_testing_backend_v2`.
- For FRONTEND changes → ask user first.
- NEVER modify "Testing Protocol" section.
- After each agent run, summarize their findings here.

## Incorporate User Feedback
- Always re-read user requirements before retesting.
- Don't re-fix what testing agent already fixed.

---

## Current Task: Username conflict (TG ↔ email registration) — fix + edit-anywhere

### User Request
> Если человек, зарегистрировавшийся через почту, выбрал ник `@shkarol`, другой — кто регистрируется через Telegram-аккаунт (с TG-username `@shkarol`) — не может получить этот ник. Исправь и добавь возможность редактировать сразу.

### Implementation Summary

**Backend (`/app/backend/auth_routes.py`, `/app/backend/models.py`):**
1. ✅ NEW endpoint `GET /api/auth/suggest-username?base=<raw>&count=5`
   - Public (no auth required), IP rate-limited (60/min).
   - Normalizes `base` → `[a-z0-9_]`, ≥3 chars.
   - Generates 30-50 candidates (base+digit, base+_rudn/_2026/_ru, base+random).
   - Checks each against DB in 1 bulk query; returns N free in priority order.
   - For empty/short base → generic `user_<random>` / `rudn_<random>`.
2. ✅ Added `UsernameSuggestionsResponse` model.

**Frontend:**
1. ✅ `services/authAPI.js` → added `suggestUsername(base, count, opts)` with AbortController.
2. ✅ `components/auth/UsernameField.jsx` — full rewrite:
   - `suggestBase` prop: auto-load suggestions when value empty.
   - On `status === 'taken'` → automatically fetch & show suggestion chips.
   - Clickable chips → fill the field on click.
   - Race-safe (AbortController shared idempotency via `lastFetchedBaseRef`).
3. ✅ `pages/RegisterWizard.jsx` Step 2:
   - Improved conflict banner (clearer UX, semantic hierarchy).
   - Passes `suggestBase={conflictHint}` to UsernameField → user sees free alternatives immediately.
4. ✅ NEW `components/auth/EditUsernameModal.jsx`:
   - Modal for editing username from anywhere in the app (not only during onboarding).
   - Uses the same UsernameField (with suggestions baked-in).
   - Validates, calls `updateProfile({ username })`, shows success animation.
5. ✅ `components/ProfileScreen.jsx`:
   - Username display is now **clickable** (with pen icon) → opens EditUsernameModal.
   - `suggestBase = current username` so user can see variants of their existing ник.

### Files Changed
- `backend/auth_routes.py`: +rate-limit bucket, +endpoint `suggest-username` (~110 LOC).
- `backend/models.py`: +`UsernameSuggestionsResponse` (4 LOC).
- `frontend/src/services/authAPI.js`: +`suggestUsername` (7 LOC).
- `frontend/src/components/auth/UsernameField.jsx`: full rewrite (~240 LOC).
- `frontend/src/components/auth/EditUsernameModal.jsx`: NEW (~190 LOC).
- `frontend/src/pages/RegisterWizard.jsx`: improved banner + `suggestBase` prop (~10 LOC diff).
- `frontend/src/components/ProfileScreen.jsx`: +import, +state, +clickable handler, +modal render (~30 LOC).

### Manual Sanity Check (curl)
```bash
$ curl 'http://localhost:8001/api/auth/suggest-username?base=shkarol&count=5'
{"base":"shkarol","suggestions":["shkarol1","shkarol2","shkarol3","shkarol4","shkarol5"]}

$ curl 'http://localhost:8001/api/auth/suggest-username?base=&count=3'
{"base":null,"suggestions":["user_152827","rudn_152827","user_112848"]}

$ curl 'http://localhost:8001/api/auth/suggest-username?base=admin&count=3'
{"base":"admin","suggestions":["admin1","admin2","admin3"]}

$ curl 'http://localhost:8001/api/auth/suggest-username?base=verylongusernametotruncate12345&count=3'
{"base":"verylongusernametotruncate12345","suggestions":["verylongusernametotrunca1",...]}
```

All scenarios verified manually.

---

## Test Credentials
See `/app/memory/test_credentials.md`.


## Testing Agent Report (2026-05-20)

### Backend Testing: `/api/auth/suggest-username` Endpoint

**Test Environment:**
- Backend URL: `http://localhost:8001/api` (internal)
- External URL: `https://rudn-server-3.preview.emergentagent.com/api` (routing issue - endpoint not accessible)

**Test Results Summary:**

✅ **PASSED (10/12 scenarios):**

1. ✅ **Basic case** (`base=shkarol&count=5`): Returns 5 valid suggestions starting with "shkarol", all matching pattern `^[a-z0-9_]{3,32}$`
2. ✅ **Empty base**: Triggers generic mode, returns `base=null` with suggestions like `user_<random>`, `rudn_<random>`
3. ✅ **Short base** (`base=ab`): Correctly triggers generic mode (< 3 chars after normalization)
4. ✅ **Invalid chars** (`base=@!shkarol#$%`): Normalizes to "shkarol", suggestions start with normalized base
5. ✅ **Cyrillic base** (`base=привет`): All cyrillic chars replaced with `_`, stripped to empty → generic mode
6. ✅ **Count validation**: 
   - `count=1` → 1 suggestion
   - `count=10` → up to 10 suggestions
   - `count=15` → capped to 10
   - `count=0` → clamped to ≥1
   - `count=-5` → clamped to ≥1
7. ✅ **Reserved word** (`base=admin`): "admin" itself filtered out, but "admin1", "admin2" allowed
8. ✅ **Rate limit**: Correctly enforces 60 requests/min per IP, returns 429 with message "Слишком много запросов подсказок"
9. ✅ **Existing username filtering**: Created test user with username "testuser999", verified it's excluded from suggestions for `base=testuser`
10. ✅ **Response model**: Correct structure `{base: string|null, suggestions: string[]}`, no extra fields

⚠️ **MINOR ISSUE (1 scenario):**

11. ⚠️ **Long base truncation** (`base=verylongusernamethatshouldbetruncated123456`):
   - **Issue**: Response returns full `base` (43 chars) instead of truncated version (24 chars)
   - **Expected**: `{"base": "verylongusernamethatshou", ...}` (24 chars)
   - **Actual**: `{"base": "verylongusernamethatshouldbetruncated123456", ...}` (43 chars)
   - **Impact**: Suggestions are correctly truncated and valid (≤32 chars), so functionality works
   - **Root cause**: Line 2164 in `auth_routes.py` returns `cleaned` instead of `base_norm`
   - **Severity**: Minor - doesn't break functionality, just response model inconsistency

⏭️ **SKIPPED (1 scenario):**

12. ⏭️ **Telegram login conflict integration**: Requires valid Telegram login hash (cannot test without real TG credentials)

---

### Critical Findings:

1. **✅ Core functionality working**: All username suggestion logic, normalization, filtering, and rate limiting work correctly
2. **✅ Database filtering working**: Existing usernames are correctly excluded from suggestions
3. **✅ Rate limiting working**: IP-based rate limit (60/min) enforced correctly
4. **⚠️ External URL routing issue**: Endpoint returns 404 on external URL but works on localhost:8001
   - This is likely a Kubernetes ingress/nginx routing configuration issue
   - Does not affect backend functionality
5. **⚠️ Response model bug**: `base` field not truncated in response (minor, doesn't affect functionality)

---

### Recommendations:

1. **Fix response model bug**: Update line 2164 in `/app/backend/auth_routes.py`:
   ```python
   # Current (incorrect):
   base=(cleaned or None) if not is_generic else None,
   
   # Should be:
   base=(base_norm or None) if not is_generic else None,
   ```

2. **Investigate external URL routing**: The endpoint works locally but returns 404 on the external URL. Check Kubernetes ingress rules or nginx configuration.

3. **Telegram integration testing**: Once Telegram login flow is available, test the `suggested_username_taken` field in the login response.

---

### Test Artifacts:
- Test script: `/app/backend_test.py`
- Test execution: All tests automated and repeatable
