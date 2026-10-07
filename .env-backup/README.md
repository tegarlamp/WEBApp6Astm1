# .env encrypted backups

These `*.enc` files are AES-256 encrypted copies of the gitignored `.env` files
(`backend/.env`, `frontend/.env`). They are safe to commit so that a fresh
GitHub import can be restored in one step.

## Restore after a fresh import

```bash
./scripts/restore_env.sh            # default trial passphrase
sudo supervisorctl restart backend frontend
```

## Re-create the backup after changing any secret

```bash
./scripts/backup_env.sh
```

Use a custom passphrase by setting `ENV_BACKUP_PASSPHRASE` before either command.
The default trial passphrase is `elastech-lab-2026`.
