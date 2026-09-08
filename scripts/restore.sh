#!/usr/bin/env bash
# Restores a dump into TARGET_DATABASE_URL. Defaults to a scratch database so a
# restore drill can never overwrite live data by accident.
set -euo pipefail

DUMP_FILE="${1:-}"
if [[ -z "$DUMP_FILE" ]]; then
  echo "usage: scripts/restore.sh <dump-file> [--force]" >&2
  exit 1
fi
if [[ ! -f "$DUMP_FILE" ]]; then
  echo "no such dump: $DUMP_FILE" >&2
  exit 1
fi

: "${TARGET_DATABASE_URL:?TARGET_DATABASE_URL is required (use a scratch database)}"

if [[ "${2:-}" != "--force" ]]; then
  echo "About to restore ${DUMP_FILE} into:"
  echo "  ${TARGET_DATABASE_URL%%\?*}"
  read -r -p "This replaces matching objects. Continue? [y/N] " reply
  [[ "$reply" == "y" || "$reply" == "Y" ]] || { echo "aborted"; exit 1; }
fi

echo "→ restoring"
pg_restore --clean --if-exists --no-owner --no-privileges \
  --dbname="$TARGET_DATABASE_URL" "$DUMP_FILE"

echo "✓ restore complete — verify with: curl -s localhost:3000/api/health"
