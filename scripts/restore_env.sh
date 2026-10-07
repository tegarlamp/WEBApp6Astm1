#!/usr/bin/env bash
# Restore .env files from the encrypted backups created by backup_env.sh.
# Run this right after a fresh GitHub import if backend/.env is missing.
#
# Usage:
#   ./scripts/restore_env.sh                 # uses the default trial passphrase
#   ENV_BACKUP_PASSPHRASE=mysecret ./scripts/restore_env.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$ROOT_DIR/.env-backup"
PASS="${ENV_BACKUP_PASSPHRASE:-elastech-lab-2026}"

decrypt_one() {
  local src="$1" dst="$2"
  if [ -f "$src" ]; then
    openssl enc -d -aes-256-cbc -pbkdf2 -in "$src" -out "$dst" -pass pass:"$PASS"
    echo "  restored: $src -> $dst"
  else
    echo "  skipped (missing backup): $src"
  fi
}

if [ ! -d "$BACKUP_DIR" ]; then
  echo "No backup folder found at $BACKUP_DIR — nothing to restore." >&2
  exit 1
fi

echo "Decrypting .env files from $BACKUP_DIR ..."
decrypt_one "$BACKUP_DIR/backend.env.enc"  "$ROOT_DIR/backend/.env"
decrypt_one "$BACKUP_DIR/frontend.env.enc" "$ROOT_DIR/frontend/.env"
echo "Done. Restart services:  sudo supervisorctl restart backend frontend"
