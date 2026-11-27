#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
STATE=${STATE:-/srv/revoboard}
BACKUPS=${BACKUPS:-/var/backups/revoboard}
exec 9>"$STATE/deploy.lock"
flock 9

TAG=$(git rev-parse HEAD)
PREVIOUS=$(cat "$STATE/current" 2>/dev/null || true)
export TAG
for v in PUBLIC_BASE_URL; do val=$(sed -n "s/^$v=//p" "$STATE/.env" 2>/dev/null || true); [ -z "$val" ] || export "$v=$val"; done

echo "== backup"
DUMP="$BACKUPS/$(date -u +%Y%m%dT%H%M%SZ).dump"
(umask 077; PGPASSFILE="$STATE/.pgpass" pg_dump -w -h 127.0.0.1 -U revou -Fc -f "$DUMP" revoboard_db)
find "$BACKUPS" -maxdepth 1 -name '*.dump' | sort -r | tail -n +8 | xargs -r rm -f

echo "== build $TAG"
docker compose build

echo "== start"
if SKIP_MIGRATIONS=0 docker compose up -d --remove-orphans --wait --wait-timeout 180; then
  echo "$TAG" > "$STATE/current"
  for repo in revoboard-backend revoboard-frontend; do
    for t in $(docker image ls "$repo" --format '{{.Tag}}'); do
      [ "$t" = "$TAG" ] || [ "$t" = "$PREVIOUS" ] || docker image rm "$repo:$t" >/dev/null 2>&1 || true
    done
  done
  echo "Deployed $TAG"
  exit 0
fi

echo "== failed"
docker compose logs --tail 40 || true
if [ -n "$PREVIOUS" ]; then
  echo "== rollback to $PREVIOUS"
  if TAG=$PREVIOUS SKIP_MIGRATIONS=1 docker compose up -d --no-build --wait --wait-timeout 120; then
    echo "Rolled back to $PREVIOUS; the schema was not changed back"
  else
    echo "Rollback failed as well"
  fi
fi
exit 1
