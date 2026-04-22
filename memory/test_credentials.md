# Test credentials

## Stage 9 testing (2026-04-22)

Test users created on-the-fly by testing agent:
- Pattern: `stage9_*@test.com` / `Test1234`
- Pattern: `stage9_retest_*@test.com` / `Test1234`

SMTP DEV-mode: emails land in `/app/logs/emails.log`. Reset/verification tokens extracted by regex `[?&]token=...`.

Rate-limit: register email is 5/hr/IP — use `X-Forwarded-For` header with randomized IPs during tests to bypass.

## Stage 7 testing (2026-04-20)

Test users created by testing agent during Stage 7 verification:
- Pattern: `stage7_*@test.com` / `Test1234`
- Pattern: `stage7_b23_retest_*@test.com` / `Test1234`

Used for: B-23 username explicit unset regression test, B-06 privacy filter.

## Default test credentials for manual QA

Working test account:
- Email: `logout_test@test.com`
- Password: `Test1234`
- UID: 913842163

Register new users on-the-fly via:
```
POST /api/auth/register/email
{
  "email": "manual_qa_{random}@test.com",
  "password": "Test1234",
  "first_name": "Manual",
  "last_name": "QA"
}
```
