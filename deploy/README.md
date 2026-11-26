# Deployment

There are two ways to run the same code. Pick one per server.

| Mode | When | Scripts |
|------|------|---------|
| **Bare** (no Docker) | The current learning server, an unprivileged container where Docker cannot run containers | `deploy/bare/` |
| **Docker** | A VM or an AWS EC2 instance | `deploy/*.sh`, `compose.yaml` |

CI builds and smoke-tests the Docker images in both cases.

## Bare mode (current server)

Gunicorn, Next.js and the deadline scheduler run under `supervisord`, which the server container already starts at boot. Releases live in `/srv/revoboard/releases/<sha>`, `/srv/revoboard/current` points at the live one, and the last 3 are kept.

```bash
# 1. stop the old trial app first (sudo supervisorctl status, then stop it)
sudo install -d -o "$(id -un)" /srv/revoboard
git clone https://github.com/MuhammadIsmailHasan/module-4-MuhammadIsmailHasan.git /srv/revoboard/app
cd /srv/revoboard/app
bash deploy/bare/setup.sh http://<server-ip>:8082
bash deploy/bare/deploy.sh
bash deploy/bare/seed.sh
```

`setup.sh` installs Python venv support and Node 24 when Node is older than 22, creates the database role and `/srv/revoboard/.env`, replaces the enabled Nginx sites, and registers the programs with supervisord. For CI set the repository variable `DEPLOY_SCRIPT` to nothing (the default is `deploy/bare/deploy.sh`).

| Task | Command |
|------|---------|
| Status | `sudo supervisorctl status` |
| Logs | `tail -n 100 /var/log/revoboard-backend.log` (also `-frontend`, `-scheduler`) |
| Restart | `sudo supervisorctl restart revoboard:` |
| Rollback | `ln -sfn /srv/revoboard/releases/<sha> /srv/revoboard/current && sudo supervisorctl restart revoboard:` |

## Moving to AWS EC2 (Docker mode)

Everything except the scripts in `deploy/bare/` carries over. On Ubuntu with systemd:

1. Install Docker Engine and the Compose plugin, install PostgreSQL and Nginx, and `systemctl enable --now docker postgresql nginx`. That replaces supervisord for start on boot; `restart: unless-stopped` brings the containers back.
2. Run the steps of "Docker mode" below, but skip the "docker and start on boot" part of `deploy/setup-server.sh` (its `bridge: none` Docker config and supervisord program are only for a restricted server).
3. Open ports 80 and 443 in the security group; port 8082 is only the published port of this server.
4. Set the repository variable `DEPLOY_SCRIPT=deploy/deploy.sh`, and update the SSH secrets.
5. Copy the data once: `pg_dump -Fc` on the old server, `pg_restore` on the new one, and the uploads folder.
6. Better on AWS: RDS for PostgreSQL (change `DATABASE_URL` and drop `setup.sql`) and S3 for uploads (needs a code change; uploads are local files today).

## Docker mode

Nginx (port 80, published as 8082) proxies `/app/api/` (as `/api/`) to Gunicorn on `127.0.0.1:5001` and everything else to Next.js on `127.0.0.1:3000`. Both run in Docker Compose on the host network, next to a scheduler, and use the server's PostgreSQL.

On Docker mode the server must be able to run containers: `docker run --rm --network host hello-world` has to work. A running `dockerd` is not enough; an unprivileged container fails with `mount ... operation not permitted` and has to be recreated by its provider (privileged or Sysbox).

## First deploy

```bash
sudo install -d -o "$(id -un)" /srv/revoboard
git clone https://github.com/MuhammadIsmailHasan/module-4-MuhammadIsmailHasan.git /srv/revoboard/app
cd /srv/revoboard/app
bash deploy/setup-server.sh http://<server-ip>:8082
# log out and in again
cd /srv/revoboard/app
bash deploy/deploy.sh
bash deploy/seed.sh
```

`setup-server.sh` replaces the enabled Nginx sites, restarts `dockerd` under supervisord, and writes `/srv/revoboard/.env`.

## Automatic deploy

1. On your computer: `ssh-keygen -t ed25519 -N "" -f revoboard-deploy`, outside the repository.
2. Add `revoboard-deploy.pub` to `~/.ssh/authorized_keys` on the server.
3. In GitHub, add the secrets `SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSH_KEY` (the private key), and `SSH_KNOWN_HOSTS` (output of `ssh-keyscan -p <port> <host>`).
4. Add the repository variable `DEPLOY_ENABLED` with the value `true`.

The key belongs to a user in the `docker` group, so it is equivalent to root on the server.

## Operations

| Task | Command |
|------|---------|
| Status | `docker ps` |
| Logs | `docker logs --tail 100 revoboard-backend-1` |
| Docker log | `sudo tail -n 50 /var/log/dockerd.log` |
| Manual rollback | `cd /srv/revoboard/app && TAG=<older sha> SKIP_MIGRATIONS=1 docker compose up -d --no-build` |
| Restore a backup | `sudo -u postgres pg_restore --clean --if-exists -d revoboard_db < /var/backups/revoboard/<file>.dump` |
| Boot check | Restart the server, do not log in, then open `/app/api/health` |

A migration must stay compatible with the previous release, because a rollback does not downgrade the schema.

## One origin: landing page, app, and API (V17)

One Next.js process serves the landing page at `/` and every app page under `/app`. The API is `/app/api/...`: Nginx replaces that prefix with the Backend's own `/api/`. The bare `/api/` answers 404 on the public side, so the Backend is reachable at one path only. The server IP and port 8082 work like any host name.

| Path | Goes to |
|---|---|
| `/` | Frontend: the landing page |
| `/app/...` | Frontend: the app, the sign-in pages, the shared view |
| `/app/api/...` | Backend, as `/api/...` |
| `/api/...` | 404 |
| `/boards`, `/dashboard`, `/admin/users`, `/profile`, `/login`, `/register`, `/invite/...`, `/shared/...`, `/session-expired` | Frontend answers 308 to the same page under `/app` (`/admin/users` becomes `/app/users`) |

1. Nginx: `deploy/nginx/revoboard.conf` is one server block. Change `server_name` if the domain changes, then reload Nginx.
2. Environment (`/srv/revoboard/.env`): `ALLOWED_ORIGINS` and `PUBLIC_BASE_URL` are the one public origin; `API_PUBLIC_PREFIX=/app/api` makes the Backend write `/app/api/...` in signed file URLs. The setup scripts write all three. The Frontend is built with `NEXT_PUBLIC_API_URL=/app/api` (the `Dockerfile` and `deploy/bare/deploy.sh` set it).
3. Cookie: the session cookie is host-only and `Path=/app`, so the landing page and every other path never receive it. **Every existing session ends at this release**: a V16 cookie was set on `/` and the app now reads the new one, so everyone signs in again.
4. Restart: `sudo supervisorctl restart revoboard:` (bare) or deploy again (Docker).
5. Rollback to V16 needs the V16 nginx file and the V16 `.env` (it needs `SITE_URL` and `APP_URL`); the database schema stays, because a migration never goes back.

## Domain and TLS, later

Publish ports 80 and 443, add one certificate to Nginx and redirect plain HTTP to HTTPS, switch `ALLOWED_ORIGINS` and `PUBLIC_BASE_URL` to the `https://` origin (the session cookie turns `Secure` by itself on an `https:` page), then run `setup-server.sh https://<host>` and deploy again. Setup overwrites the Nginx site, so put the TLS change in `deploy/nginx/revoboard.conf`.

## Smoke test

`bash deploy/smoke.sh` runs the whole stack against a throwaway database. CI runs it before every deploy.

## Mail and the due-date reminders (V17)

- **Mail.** Registration, an email change, and a password change send mail through `MAIL_BACKEND`. `smtp` sends through Gmail (`SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER`, `SMTP_PASSWORD` = an app password from an account with 2-step verification, `MAIL_FROM`); `console` only writes the message to the Backend log. The setup scripts write `MAIL_BACKEND=console` until you set the SMTP values and run them again, so the Backend starts, but **nobody receives an activation link then**: a new user can only be confirmed from the log until SMTP is configured. A personal Gmail account sends about 500 messages a day, which is enough for a demo.
- **Existing accounts.** The V17 migration marks every existing user as confirmed, so nobody is locked out.
- **Due-date reminders.** `flask notify-due` creates the day's `due_today` and `due_tomorrow` notifications. The existing `scheduler` service (Docker) and `revoboard-scheduler` program (bare, supervisord) now run it every 15 minutes with `flask run-scheduler`; no cron entry is needed, and a second run on the same date creates nothing. Run it by hand with `docker compose run --rm --no-deps backend notify-due` or `flask notify-due`.
