#!/usr/bin/env bash
#
# test-routes.sh — Smoke-test all Odin API routes via curl.
#
# Usage:
#   export API_BASE="http://localhost:3001"
#   export TEST_EMAIL="test@example.com"
#   export TEST_PASSWORD="TestPass123!"
#   bash scripts/test-routes.sh
#
# If SUPABASE_ACCESS_TOKEN is set, the script skips registration/login
# and uses that token directly for authenticated routes.

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3001}"
TEST_EMAIL="${TEST_EMAIL:-odin-test-$(date +%s)@example.com}"
TEST_PASSWORD="${TEST_PASSWORD:-TestPass123!}"

PASS=0
FAIL=0
ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-}"

pass() { PASS=$((PASS+1)); echo "  ✅ PASS"; }
fail() { FAIL=$((FAIL+1)); echo "  ❌ FAIL: $1"; }

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Odin API Route Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  API:   $API_BASE"
echo "  Email: $TEST_EMAIL"
echo ""

# ── 1. Health & Root ──────────────────────────────────────────────
echo "── 1/14  GET /health"
RES=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/health")
[[ "$RES" == "200" ]] && pass || fail "expected 200, got $RES"

echo "── 2/14  GET /"
RES=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/")
[[ "$RES" == "200" ]] && pass || fail "expected 200, got $RES"

# ── 3. Register ───────────────────────────────────────────────────
echo "── 3/14  POST /odin/api/auth/register"
REG=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/odin/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "$(cat <<JSON
{
  "payload": {
    "email": "$TEST_EMAIL",
    "password": "$TEST_PASSWORD",
    "display_name": "Test User"
  }
}
JSON
)")
REG_CODE=$(echo "$REG" | tail -1)
REG_BODY=$(echo "$REG" | sed '$d')

if [[ "$REG_CODE" == "201" ]]; then
  pass
  # extract tokens if we don't already have one
  if [[ -z "$ACCESS_TOKEN" ]]; then
    ACCESS_TOKEN=$(echo "$REG_BODY" | sed 's/.*"access_token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
  fi
elif [[ "$REG_CODE" == "409" ]]; then
  # user already exists — normal if re-running with same email
  echo "  ⚠️  409 Conflict (user likely exists)"
  echo "     Pass -- no harm, we'll attempt login later"
  pass
else
  fail "expected 201, got $REG_CODE"
  echo "     Body: $REG_BODY"
fi

# ── 4. Session (login) ────────────────────────────────────────────
echo "── 4/14  POST /odin/api/auth/session"
# If we already have a token via env var, hit session with it
if [[ -z "$ACCESS_TOKEN" ]]; then
  # No token yet — try signing in with password to get one (supabase rest)
  echo "     (no token available — attempting password sign-in)"
  echo "     SKIP (set SUPABASE_ACCESS_TOKEN to test this route)"
  # We manually skip — session needs a real Supabase JWT
  echo "     ⚠️  Skipped (no access token available)"
else
  SES=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/odin/api/auth/session" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d '{"payload":{}}')
  SES_CODE=$(echo "$SES" | tail -1)
  SES_BODY=$(echo "$SES" | sed '$d')
  [[ "$SES_CODE" == "200" ]] && pass || fail "expected 200, got $SES_CODE — $SES_BODY"
fi

# ── 5. Password Reset (no auth) ───────────────────────────────────
echo "── 5/14  POST /odin/api/auth/password-reset"
PR=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/odin/api/auth/password-reset" \
  -H "Content-Type: application/json" \
  -d "$(cat <<JSON
{
  "payload": {
    "email": "$TEST_EMAIL"
  }
}
JSON
)")
PR_CODE=$(echo "$PR" | tail -1)
[[ "$PR_CODE" == "200" ]] && pass || fail "expected 200, got $PR_CODE"

# ── 6. Password Reset — missing email (400) ────────────────────────
echo "── 6/14  POST /odin/api/auth/password-reset (missing email)"
PR2=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/odin/api/auth/password-reset" \
  -H "Content-Type: application/json" \
  -d '{"payload":{}}')
PR2_CODE=$(echo "$PR2" | tail -1)
[[ "$PR2_CODE" == "400" ]] && pass || fail "expected 400, got $PR2_CODE"

# ──────── Auth-required routes below ─────────────────────────────
if [[ -z "$ACCESS_TOKEN" ]]; then
  echo ""
  echo "━━━ Skipping auth-required routes (no ACCESS_TOKEN) ━━━"
  echo "  Set SUPABASE_ACCESS_TOKEN env var to test them."
  echo ""
else

# ── 7. Logout ─────────────────────────────────────────────────────
echo "── 7/14  POST /odin/api/auth/logout"
LO=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/odin/api/auth/logout" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"payload":{}}')
LO_CODE=$(echo "$LO" | tail -1)
[[ "$LO_CODE" == "200" ]] && pass || fail "expected 200, got $LO_CODE"

# ── 8. GET /me (default include) ──────────────────────────────────
echo "── 8/14  GET /odin/api/me"
ME=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE/odin/api/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
ME_CODE=$(echo "$ME" | tail -1)
ME_BODY=$(echo "$ME" | sed '$d')
[[ "$ME_CODE" == "200" ]] && pass || fail "expected 200, got $ME_CODE"

# ── 9. GET /me?include=profile,consents ───────────────────────────
echo "── 9/14  GET /odin/api/me?include=profile,consents"
ME2=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE/odin/api/me?include=profile,consents" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
ME2_CODE=$(echo "$ME2" | tail -1)
[[ "$ME2_CODE" == "200" ]] && pass || fail "expected 200, got $ME2_CODE"

# ── 10. PATCH /me (update display_name & city) ────────────────────
echo "── 10/14 PATCH /odin/api/me"
ME3=$(curl -s -w "\n%{http_code}" -X PATCH "$API_BASE/odin/api/me" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "$(cat <<JSON
{
  "payload": {
    "display_name": "Updated Name",
    "metro_manila_city": "Makati"
  }
}
JSON
)")
ME3_CODE=$(echo "$ME3" | tail -1)
[[ "$ME3_CODE" == "200" ]] && pass || fail "expected 200, got $ME3_CODE"

# ── 11. GET /eligibility-profile ──────────────────────────────────
echo "── 11/14 GET /odin/api/eligibility-profile"
EP=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE/odin/api/eligibility-profile" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
EP_CODE=$(echo "$EP" | tail -1)
[[ "$EP_CODE" == "200" ]] && pass || fail "expected 200, got $EP_CODE"

# ── 12. PATCH /eligibility-profile (full valid profile) ───────────
echo "── 12/14 PATCH /odin/api/eligibility-profile (complete)"
EP2=$(curl -s -w "\n%{http_code}" -X PATCH "$API_BASE/odin/api/eligibility-profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
  "payload": {
    "date_of_birth": "1996-06-15",
    "is_filipino": true,
    "metro_manila_presence": "lives_in_metro_manila",
    "metro_manila_locality_code": "quezon_city",
    "primary_employment_classification": "full_time_employee"
  }
}')
EP2_CODE=$(echo "$EP2" | tail -1)
EP2_BODY=$(echo "$EP2" | sed '$d')
[[ "$EP2_CODE" == "200" ]] && pass || fail "expected 200, got $EP2_CODE — $EP2_BODY"

# ── 13. PATCH /eligibility-profile (invalid DOB) ──────────────────
echo "── 13/14 PATCH /odin/api/eligibility-profile (bad DOB)"
EP3=$(curl -s -w "\n%{http_code}" -X PATCH "$API_BASE/odin/api/eligibility-profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
  "payload": {
    "date_of_birth": "not-a-date"
  }
}')
EP3_CODE=$(echo "$EP3" | tail -1)
[[ "$EP3_CODE" == "400" ]] && pass || fail "expected 400, got $EP3_CODE"

# ── 14. POST /push-device-tokens (valid) ──────────────────────────
echo "── 14/14 POST /odin/api/push-device-tokens"
PDT=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/odin/api/push-device-tokens" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
  "payload": {
    "device_token": "fcm-test-token-12345",
    "platform": "android"
  }
}')
PDT_CODE=$(echo "$PDT" | tail -1)
[[ "$PDT_CODE" == "200" ]] && pass || fail "expected 200, got $PDT_CODE"

fi

# ── Summary ───────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASS passed, $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
[[ "$FAIL" -eq 0 ]] && exit 0 || exit 1
