#!/usr/bin/env bash
# Spec 30 — a backup procedure that has never been restored is not a backup
# procedure. Pair every change here with a scripts/restore.sh run.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="${BACKUP_DIR}/personal-os-${STAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "→ dumping to ${TARGET}"
pg_dump --format=custom --no-owner --no-privileges --dbname="$DATABASE_URL" --file="$TARGET"

echo "→ pruning dumps older than ${RETENTION_DAYS} days"
find "$BACKUP_DIR" -name 'personal-os-*.dump' -type f -mtime "+${RETENTION_DAYS}" -delete

echo "✓ backup complete: $(du -h "$TARGET" | cut -f1)"
