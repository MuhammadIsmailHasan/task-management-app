#!/usr/bin/env bash
set -euo pipefail
STATE=${STATE:-/srv/revoboard}
BACKUPS=${BACKUPS:-/var/backups/revoboard}
MIN_LENGTH=8

case "${1:-}" in
  "") RESET= ;;
  --reset) RESET=1 ;;
  *) echo "usage: seed.sh [--reset]" >&2; exit 2 ;;
esac

read -rsp "Password for the demo accounts (at least $MIN_LENGTH characters): " SEED_PASSWORD; echo
[ "${#SEED_PASSWORD}" -ge "$MIN_LENGTH" ] || { echo "Too short"; exit 1; }
read -rsp "Private password for the Admin account (not the demo password): " SEED_ADMIN_PASSWORD; echo
[ "${#SEED_ADMIN_PASSWORD}" -ge "$MIN_LENGTH" ] || { echo "Too short"; exit 1; }
[ "$SEED_ADMIN_PASSWORD" != "$SEED_PASSWORD" ] || { echo "The Admin password must differ from the demo password"; exit 1; }

exec 9>"$STATE/deploy.lock"
flock 9
cd "$STATE/current/backend"
set -a; . "$STATE/.env"; set +a

if [ -n "$RESET" ]; then
  echo "This ERASES every user, board and card in revoboard_db."
  read -rp "Type erase to continue: " ANSWER
  [ "$ANSWER" = erase ] || { echo "Cancelled"; exit 1; }
  BACKUP="$BACKUPS/$(date -u +%Y%m%dT%H%M%SZ)-before-reset.dump"
  (umask 077; PGPASSFILE="$STATE/.pgpass" pg_dump -w -h 127.0.0.1 -U revou -Fc -f "$BACKUP" revoboard_db)
  echo "Backup: $BACKUP"
  trap 'sudo supervisorctl start revoboard: >/dev/null || true' EXIT
  sudo supervisorctl stop revoboard: >/dev/null
  (cd / && sudo -u postgres dropdb --force revoboard_db && sudo -u postgres createdb -O revou revoboard_db)
  APP_ENV=production FLASK_APP=app "$STATE/venv/bin/flask" db upgrade
fi

SEED_PASSWORD=$SEED_PASSWORD SEED_ADMIN_PASSWORD=$SEED_ADMIN_PASSWORD APP_ENV=development FLASK_APP=app "$STATE/venv/bin/flask" seed-data
