#!/usr/bin/env bash
# Build the checked-out commit into releases/<sha>, switch to it, restart; on failure switch back (never the schema).
set -euo pipefail
cd "$(dirname "$0")/../.."
REPO=$PWD
STATE=${STATE:-/srv/revoboard}
BACKUPS=${BACKUPS:-/var/backups/revoboard}
exec 9>"$STATE/deploy.lock"
flock 9

SHA=$(git rev-parse HEAD)
PREVIOUS=$(basename "$(readlink "$STATE/current" 2>/dev/null)" 2>/dev/null || true)
REL=$STATE/releases/$SHA
TMP=$STATE/releases/.tmp-$SHA

echo "== backup"
(umask 077; PGPASSFILE="$STATE/.pgpass" pg_dump -w -h 127.0.0.1 -U revou -Fc -f "$BACKUPS/$(date -u +%Y%m%dT%H%M%SZ).dump" revoboard_db)
find "$BACKUPS" -maxdepth 1 -name '*.dump' | sort -r | tail -n +8 | xargs -r rm -f

echo "== build $SHA"
rm -rf "$TMP"; mkdir -p "$TMP"
git archive "$SHA" backend | tar -x -C "$TMP"
[ -d "$STATE/venv" ] || python3 -m venv "$STATE/venv"
"$STATE/venv/bin/pip" install -q -r "$TMP/backend/requirements.txt"
(
  cd frontend
  npm ci --no-audit --no-fund --loglevel=error
  NEXT_PUBLIC_API_URL=/app/api NEXT_TELEMETRY_DISABLED=1 npm run build
)
mkdir -p "$TMP/frontend"
cp -R frontend/.next/standalone/. "$TMP/frontend/"
mkdir -p "$TMP/frontend/.next" && cp -R frontend/.next/static "$TMP/frontend/.next/static"
cp -R frontend/public "$TMP/frontend/public"

echo "== migrate"
(
  cd "$TMP/backend"
  set -a; . "$STATE/.env"; set +a
  APP_ENV=production FLASK_APP=app "$STATE/venv/bin/flask" db upgrade
)

echo "== switch"
rm -rf "$REL.old"; [ ! -e "$REL" ] || mv "$REL" "$REL.old" # the same commit may already be live
mv "$TMP" "$REL"
switch() { ln -sfn "$STATE/releases/$1" "$STATE/current.new" && mv -T "$STATE/current.new" "$STATE/current"; }
switch "$SHA"
sudo supervisorctl restart revoboard: >/dev/null || true

healthy() {
  for _ in $(seq 1 45); do
    curl -fsS -o /dev/null --max-time 5 http://127.0.0.1:5001/api/health &&
      curl -fsS -o /dev/null --max-time 5 http://127.0.0.1:3000/app/login && return 0
    sleep 2
  done
  return 1
}
if healthy; then
  find "$STATE/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn | tail -n +4 | cut -d' ' -f2- |
    while read -r old; do [ "$(basename "$old")" = "$PREVIOUS" ] || rm -rf "$old"; done
  rm -rf "$REL.old"
  echo "Deployed $SHA"
  exit 0
fi

echo "== failed"
tail -n 20 /var/log/revoboard-backend.log /var/log/revoboard-frontend.log 2>/dev/null || true
if [ -n "$PREVIOUS" ] && [ -d "$STATE/releases/$PREVIOUS" ]; then
  echo "== rollback to $PREVIOUS"
  switch "$PREVIOUS"
  sudo supervisorctl restart revoboard: >/dev/null || true
  if healthy; then echo "Rolled back to $PREVIOUS; the schema was not changed back"; else echo "Rollback failed as well"; fi
fi
exit 1
