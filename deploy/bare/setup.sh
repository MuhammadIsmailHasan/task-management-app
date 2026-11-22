#!/usr/bin/env bash
# One-time server setup without Docker; safe to run again. Usage: bash deploy/bare/setup.sh http://<server-ip>:8082
set -euo pipefail
PUBLIC_URL=${1:?usage: setup.sh <public url>}
PUBLIC_URL=${PUBLIC_URL%/}
HERE=$(cd "$(dirname "$0")/.." && pwd)
HOME_DIR=/srv/revoboard
ME=$(id -un)

if [ -z "${DB_PASSWORD:-}" ]; then
  read -rsp "Password for the PostgreSQL role revou: " DB_PASSWORD; echo
fi
[ -n "$DB_PASSWORD" ] || { echo "The password is empty"; exit 1; }

echo "== packages"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq python3-venv python3-pip curl git ca-certificates >/dev/null
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$NODE_MAJOR" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - >/dev/null
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs >/dev/null
fi
node -v; python3 --version

echo "== directories"
sudo install -d -o "$ME" -g "$(id -gn)" "$HOME_DIR" "$HOME_DIR/releases"
sudo install -d -o "$ME" -g "$(id -gn)" /var/lib/revoboard/uploads
sudo install -d -m 700 -o "$ME" -g "$(id -gn)" /var/backups/revoboard

echo "== database"
sudo service postgresql start
for _ in $(seq 1 30); do sudo -u postgres pg_isready -q && break; sleep 1; done
{ printf "\\set password '%s'\n" "$(printf %s "$DB_PASSWORD" | sed "s/\\\\/\\\\\\\\/g; s/'/\\\\'/g")"; cat "$HERE/setup.sql"; } |
  (cd / && sudo -u postgres psql -qX)

echo "== configuration"
umask 077
ENCODED=$(printf %s "$DB_PASSWORD" | python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.stdin.read(),safe=""))')
old() { sed -n "s/^$1=//p" "$HOME_DIR/.env" 2>/dev/null || true; }
JWT=$(old JWT_SECRET); FILES=$(old FILE_URL_SECRET)
cat > "$HOME_DIR/.env" <<EOF
DATABASE_URL=postgresql+psycopg://revou:$ENCODED@127.0.0.1:5432/revoboard_db
ALLOWED_ORIGINS=$PUBLIC_URL
JWT_SECRET=${JWT:-$(python3 -c 'import secrets; print(secrets.token_hex(32))')}
FILE_URL_SECRET=${FILES:-$(python3 -c 'import secrets; print(secrets.token_hex(32))')}
APP_TIMEZONE=Asia/Jakarta
EOF
printf '127.0.0.1:5432:revoboard_db:revou:%s\n' "$(printf %s "$DB_PASSWORD" | sed 's/\\/\\\\/g; s/:/\\:/g')" > "$HOME_DIR/.pgpass"
chmod 600 "$HOME_DIR/.env" "$HOME_DIR/.pgpass"
umask 022
chmod +x "$HERE"/bare/*.sh

echo "== nginx"
sudo install -m 644 "$HERE/nginx/revoboard.conf" /etc/nginx/sites-available/revoboard
sudo find /etc/nginx/sites-enabled -mindepth 1 -maxdepth 1 -type l -delete # unlinks other sites; their files stay
sudo ln -s /etc/nginx/sites-available/revoboard /etc/nginx/sites-enabled/revoboard
sudo nginx -t
sudo service nginx start
sudo nginx -s reload

echo "== supervisor (start on boot)"
if [ -f ~/.bashrc ]; then sed -i.bak '/^if ! pgrep -x dockerd/,/^fi$/d' ~/.bashrc; fi
sudo install -m 644 "$HERE/bare/supervisor.conf" /etc/supervisor/conf.d/revoboard.conf
sudo supervisorctl reread >/dev/null
sudo supervisorctl update >/dev/null
echo "Setup done. Next: bash deploy/bare/deploy.sh"
