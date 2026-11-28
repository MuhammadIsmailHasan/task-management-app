# Deployment

The server runs the app without Docker, using the scripts in `deploy/bare/`. Docker (`compose.yaml` and both Dockerfiles) is used only by the CI smoke test.

## Server setup

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

`setup.sh` installs Python venv support and Node 24 when Node is older than 22, creates the database role and `/srv/revoboard/.env`, installs the Nginx site on the first run only (see below), and registers the programs with supervisord.

| Task | Command |
|------|---------|
| Status | `sudo supervisorctl status` |
| Logs | `tail -n 100 /var/log/revoboard-backend.log` (also `-frontend`, `-scheduler`) |
| Restart | `sudo supervisorctl restart revoboard:` |
| Rollback | `ln -sfn /srv/revoboard/releases/<sha> /srv/revoboard/current && sudo supervisorctl restart revoboard:` |

## Automatic deploy

1. On your computer: `ssh-keygen -t ed25519 -N "" -f revoboard-deploy`, outside the repository.
2. Add `revoboard-deploy.pub` to `~/.ssh/authorized_keys` on the server.
3. In GitHub, add the secrets `SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSH_KEY` (the private key), and `SSH_KNOWN_HOSTS` (output of `ssh-keyscan -p <port> <host>`).
4. Add the repository variable `DEPLOY_ENABLED` with the value `true`.

The deploy user can run `sudo`, so treat the private key as root access to the server.

## Operations

| Task | Command |
|------|---------|
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

1. Nginx: `deploy/nginx/revoboard.conf` is one server block. Change `server_name` if the domain changes. Setup does not overwrite an existing `/etc/nginx/sites-available/revoboard`, so apply a later change to that file on the server, then reload Nginx.
2. Environment (`/srv/revoboard/.env`): `ALLOWED_ORIGINS` and `PUBLIC_BASE_URL` are the one public origin; `API_PUBLIC_PREFIX=/app/api` makes the Backend write `/app/api/...` in signed file URLs. The setup scripts write all three. The Frontend is built with `NEXT_PUBLIC_API_URL=/app/api` (`deploy/bare/deploy.sh` and the `Dockerfile` set it).
3. Cookie: the session cookie is host-only and `Path=/app`, so the landing page and every other path never receive it. **Every existing session ends at this release**: a V16 cookie was set on `/` and the app now reads the new one, so everyone signs in again.
4. Restart: `sudo supervisorctl restart revoboard:`.
5. Rollback to V16 needs the V16 nginx file and the V16 `.env` (it needs `SITE_URL` and `APP_URL`); the database schema stays, because a migration never goes back.

## Domain and TLS, later

Publish ports 80 and 443, add one certificate to Nginx and redirect plain HTTP to HTTPS, switch `ALLOWED_ORIGINS` and `PUBLIC_BASE_URL` to the `https://` origin (the session cookie turns `Secure` by itself on an `https:` page), then run `bash deploy/bare/setup.sh https://<host>` and deploy again. Setup keeps an existing Nginx site, so TLS settings added on the server (for example by Certbot) stay. When the site file does not exist yet, setup copies `deploy/nginx/revoboard.conf` and disables the other enabled sites.

## Smoke test

`bash deploy/smoke.sh` runs the whole stack against a throwaway database. CI runs it before every deploy.

## Mail and the due-date reminders (V17)

- **Mail.** Registration, an email change, and a password change send mail through `MAIL_BACKEND`. `smtp` sends through Gmail (`SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER`, `SMTP_PASSWORD` = an app password from an account with 2-step verification, `MAIL_FROM`); `smtp` also needs `PUBLIC_BASE_URL` with `http://` or `https://`, because the links in the mail start with it; without it the Backend does not start. `console` only writes the message to the Backend log. The setup scripts write `MAIL_BACKEND=console` until you set the SMTP values and run them again, so the Backend starts, but **nobody receives an activation link then**: a new user can only be confirmed from the log until SMTP is configured. A personal Gmail account sends about 500 messages a day, which is enough for a demo.
- **Existing accounts.** The V17 migration marks every existing user as confirmed, so nobody is locked out.
- **Due-date reminders.** `flask notify-due` creates the day's `due_today` and `due_tomorrow` notifications. The `revoboard:scheduler` program (supervisord) runs it every 15 minutes with `flask run-scheduler`; no cron entry is needed, and a second run on the same date creates nothing. Run it by hand with `flask notify-due`.
