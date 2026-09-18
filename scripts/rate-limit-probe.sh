#!/usr/bin/env bash
# Spam the login action with a wrong password to watch the rate limit kick in.
# The action id changes on every build, so it is scraped from the page each run.
#
#   scripts/rate-limit-probe.sh [base-url] [tries]
#
# HTTP is 200 throughout — a server action puts its outcome in the body, not the
# status. Look at the "error" field: "invalid" while the bucket has tokens,
# "rate_limited" once it is empty (eight tries per key).
set -euo pipefail

BASE="${1:-http://localhost:3000}"
TRIES="${2:-10}"

ACTION=$(curl -s "$BASE/login" | grep -oE '[0-9a-f]{40,42}' | head -1)
[ -n "$ACTION" ] || { echo "could not find the login action id — is the server up?"; exit 1; }
echo "login action: $ACTION"

for i in $(seq 1 "$TRIES"); do
  out=$(curl -s -w '|%{http_code}' -X POST "$BASE/login" \
    -H 'Accept: text/x-component' \
    -H "next-action: $ACTION" \
    -F "_1_\$ACTION_REF_1=" \
    -F "_1_\$ACTION_1:0={\"id\":\"$ACTION\",\"bound\":\"\$@1\"}" \
    -F "_1_\$ACTION_1:1=[{\"error\":null}]" \
    -F "_1_\$ACTION_KEY=kprobe" \
    -F '_1_next=' \
    -F '_1_username=me' \
    -F '_1_password=definitely-wrong' \
    -F '0=[{"error":null},"$K1"]')
  code=${out##*|}
  err=$(printf '%s' "${out%|*}" | grep -oE '"error":"[a-z_]*"' | tail -1)
  echo "req $i -> HTTP $code  ${err:-<no error field: body malformed>}"
done
