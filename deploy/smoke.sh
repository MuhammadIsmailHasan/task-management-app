#!/usr/bin/env bash
# The production stack against a throwaway PostgreSQL, behind Nginx. For CI and laptops, never for the server.
set -euo pipefail
cd "$(dirname "$0")/.."
[ ! -e /srv/revoboard/.env ] || { echo "This looks like the server; refusing"; exit 1; }
TMP=$(mktemp -d)
export TAG=smoke ENV_FILE="$TMP/env" UPLOADS="$TMP/uploads" COMPOSE_PROJECT_NAME=revoboard-smoke
mkdir -m 777 "$UPLOADS"
PASSWORD=$(openssl rand -hex 12)
cat > "$ENV_FILE" <<EOF
DATABASE_URL=postgresql+psycopg://revou:$PASSWORD@127.0.0.1:5432/revoboard_db
ALLOWED_ORIGINS=http://127.0.0.1:8082
JWT_SECRET=$(openssl rand -hex 32)
FILE_URL_SECRET=$(openssl rand -hex 32)
APP_TIMEZONE=Asia/Jakarta
EOF
cleanup() {
  status=$?
  [ "$status" = 0 ] || docker compose logs --tail 40 || true
  docker compose down --remove-orphans >/dev/null 2>&1 || true
  docker rm -f -v revoboard-smoke-db revoboard-smoke-nginx >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT

docker compose build
docker run -d --name revoboard-smoke-db --network host -e POSTGRES_PASSWORD="$PASSWORD" postgres:16-alpine -c listen_addresses=127.0.0.1 >/dev/null
for _ in $(seq 1 60); do
  docker exec revoboard-smoke-db pg_isready -q -h 127.0.0.1 && break
  sleep 1
done
for _ in 1 2; do # twice: the setup is idempotent
  { echo "\\set password '$PASSWORD'"; cat deploy/setup.sql; } | docker exec -i revoboard-smoke-db psql -qX -U postgres
done

echo "== empty database, then a second start"
docker compose up -d --wait --wait-timeout 180
docker compose restart backend
docker compose up -d --wait --wait-timeout 180
export SEED_PASSWORD="$PASSWORD"
docker compose run --rm --no-deps -T -e APP_ENV=development -e SEED_PASSWORD --entrypoint flask backend seed-data </dev/null

sed 's/listen 80 default_server/listen 127.0.0.1:8082 default_server/' deploy/nginx/revoboard.conf > "$TMP/site.conf"
chmod 755 "$TMP"; chmod 644 "$TMP/site.conf"
docker run -d --name revoboard-smoke-nginx --network host -v "$TMP/site.conf:/etc/nginx/conf.d/default.conf:ro" nginx:stable-alpine >/dev/null

echo "== through nginx"
docker compose exec -T -e SEED_PASSWORD frontend node --input-type=module < deploy/smoke.mjs
