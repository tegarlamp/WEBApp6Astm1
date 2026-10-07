#!/usr/bin/env bash
# Encrypted backup of the (gitignored) .env files so a fresh GitHub import can be
# restored in one command instead of reconstructing secrets by hand.
#
# Usage:
#   ./scripts/backup_env.sh                 # uses the default trial passphrase
#   ENV_BACKUP_PASSPHRASE=mysecret ./scripts/backup_env.sh
#
# The encrypted *.enc files ARE safe to commit to git (.env itself stays ignored).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$ROOT_DIR/.env-backup"
PASS="${ENV_BACKUP_PASSPHRASE:-elastech-lab-2026}"

mkdir -p "$BACKUP_DIR"

encrypt_one() {
  local src="$1" dst="$2"
  if [ -f "$src" ]; then
    openssl enc -aes-256-cbc -pbkdf2 -salt -in "$src" -out "$dst" -pass pass:"$PASS"
    echo "  backed up: $src -> $dst"
  else
    echo "  skipped (missing): $src"
  fi
}

echo "Encrypting .env files into $BACKUP_DIR ..."
encrypt_one "$ROOT_DIR/backend/.env"  "$BACKUP_DIR/backend.env.enc"
encrypt_one "$ROOT_DIR/frontend/.env" "$BACKUP_DIR/frontend.env.enc"
echo "Done. Commit the .env-backup/ folder (via 'Save to Github') to persist it."
