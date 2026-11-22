#!/usr/bin/env bash
# One time, by hand: demo data. Only this command gets APP_ENV=development.
set -euo pipefail
STATE=${STATE:-/srv/revoboard}
read -rsp "Password for the demo accounts (at least 8 characters): " SEED_PASSWORD; echo
[ "${#SEED_PASSWORD}" -ge 8 ] || { echo "Too short"; exit 1; }
cd "$STATE/current/backend"
set -a; . "$STATE/.env"; set +a
SEED_PASSWORD=$SEED_PASSWORD APP_ENV=development FLASK_APP=app "$STATE/venv/bin/flask" seed-data
