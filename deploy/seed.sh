#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
TAG=$(cat "${STATE:-/srv/revoboard}/current")
read -rsp "Password for the demo accounts (at least 8 characters): " SEED_PASSWORD; echo
[ "${#SEED_PASSWORD}" -ge 8 ] || { echo "Too short"; exit 1; }
export TAG SEED_PASSWORD
docker compose run --rm --no-deps -T -e APP_ENV=development -e SEED_PASSWORD --entrypoint flask backend seed-data
