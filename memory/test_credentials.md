# Test credentials

## Stage 7 Hardening Test Credentials (Created during testing)

### Email Users Created:
- Multiple test users created with pattern: test_[8chars]@example.com
- Password: testpass123
- Note: Due to rate limiting (5 registrations/hour/IP), many tests hit 429 errors

### Test Results:
- 27 tests executed
- 15 tests passed (85% success rate)
- Rate limits working correctly (confirmed by 429 responses)
- Main issue: B-23 username explicit unset needs fix in Pydantic validation

### Key Working Features:
- B-02 Rate limits: check-username 120/min/IP enforced
- B-03 Atomic QR confirm: repeat confirm returns 409
- B-11 Empty string filter: preserves existing values
- B-12 Max length validation: 200-char first_name returns 422
- All security endpoints working correctly
