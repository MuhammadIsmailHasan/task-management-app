#!/usr/bin/env bash
# One-time server setup; safe to run again. Usage: bash deploy/setup-server.sh http://<server-ip>:8082
set -euo pipefail
PUBLIC_URL=${1:?usage: setup-server.sh <public url>}
PUBLIC_URL=${PUBLIC_URL%/}
HERE=$(cd "$(dirname "$0")" && pwd)
HOME_DIR=/srv/revoboard
ME=$(id -un)

read -rsp "Password for the PostgreSQL role revou: " DB_PASSWORD; echo
[ -n "$DB_PASSWORD" ] || { echo "The password is empty"; exit 1; }

echo "== directories"
sudo install -d -o "$ME" -g "$(id -gn)" "$HOME_DIR"
sudo install -d -o 1000 -g 1000 /var/lib/revoboard/uploads
sudo install -d -m 700 -o "$ME" -g "$(id -gn)" /var/backups/revoboard

echo "== database"
sudo service postgresql start
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

echo "== nginx"
sudo install -m 644 "$HERE/nginx/revoboard.conf" /etc/nginx/sites-available/revoboard
sudo find /etc/nginx/sites-enabled -mindepth 1 -maxdepth 1 -type l -delete # unlinks other sites; their files stay
sudo ln -s /etc/nginx/sites-available/revoboard /etc/nginx/sites-enabled/revoboard
sudo nginx -t
sudo service nginx start
sudo nginx -s reload

echo "== docker and start on boot"
sudo install -d /etc/docker
echo '{ "iptables": false, "bridge": "none" }' | sudo tee /etc/docker/daemon.json >/dev/null
sudo usermod -aG docker "$ME"
if [ -f ~/.bashrc ]; then sed -i.bak '/^if ! pgrep -x dockerd/,/^fi$/d' ~/.bashrc; fi
sudo install -m 644 "$HERE/supervisor/revoboard.conf" /etc/supervisor/conf.d/revoboard.conf
sudo supervisorctl stop dockerd >/dev/null 2>&1 || true
sudo pkill -x dockerd || true
for _ in $(seq 1 20); do pgrep -x dockerd >/dev/null || break; sleep 1; done
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start dockerd >/dev/null 2>&1 || true
for _ in $(seq 1 30); do
  if sudo docker info >/dev/null 2>&1; then
    echo "Setup done. Log out and in again (docker group), then run: bash deploy/deploy.sh"
    exit 0
  fi
  sleep 1
done
echo "dockerd did not start: sudo tail -n 30 /var/log/dockerd.log"
exit 1
