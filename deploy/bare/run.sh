#!/bin/sh
# Started by supervisord: run.sh backend | scheduler | frontend. Reads /srv/revoboard/.env, runs the current release.
set -e
set -a; . /srv/revoboard/.env; set +a
APP=/srv/revoboard/current
case "$1" in
  backend)
    cd "$APP/backend"
    export APP_ENV=production TRUSTED_PROXY_COUNT=1 UPLOAD_DIR=/var/lib/revoboard/uploads FLASK_APP=app
    exec /srv/revoboard/venv/bin/gunicorn --workers 3 --bind 127.0.0.1:5001 'app:create_app()' ;;
  scheduler)
    cd "$APP/backend"
    export APP_ENV=production UPLOAD_DIR=/var/lib/revoboard/uploads FLASK_APP=app
    exec /srv/revoboard/venv/bin/flask run-scheduler ;;
  frontend)
    cd "$APP/frontend"
    export NODE_ENV=production HOSTNAME=127.0.0.1 PORT=3000 INTERNAL_API_URL=http://127.0.0.1:5001/api
    exec node server.js ;;
  *) echo "usage: run.sh backend|scheduler|frontend" >&2; exit 2 ;;
esac
