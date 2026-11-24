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

Nginx (port 80, published as 8082) proxies `/api/` to Gunicorn on `127.0.0.1:5001` and everything else to Next.js on `127.0.0.1:3000`. Both run in Docker Compose on the host network, next to a scheduler, and use the server's PostgreSQL.

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
| Boot check | Restart the server, do not log in, then open `/api/health` |

A migration must stay compatible with the previous release, because a rollback does not downgrade the schema.

## Two hosts: landing page and app (V16)

One Next.js process serves both. The **Site_Host** (`revoboard.belajardeploy.web.id`) shows the landing page and sends every other path to the **App_Host** (`app.revoboard.belajardeploy.web.id`), which is the app and `/api`. Anything else (the server IP and port 8082, `localhost`) is the app too, so the IP keeps working before the domain exists.

1. DNS: an address record for each name, pointing at the server.
2. Nginx: `deploy/nginx/revoboard.conf` already names both hosts and returns 404 for `/api/` on the Site_Host. Change the names there if the domain changes, then reload Nginx.
3. Environment: put `SITE_URL=https://revoboard.belajardeploy.web.id` and `APP_URL=https://app.revoboard.belajardeploy.web.id` in `/srv/revoboard/.env` (or run the setup script with them in the environment). Both or neither; the Frontend refuses to start with only one. Only the Frontend reads them (bare mode through `run.sh`, Docker mode through `compose.yaml`). `ALLOWED_ORIGINS` is the App_Host origin only.
4. Cookie: the session cookie stays host-only on the App_Host (no `Domain`), so the landing page never sees it.
5. Restart: `sudo supervisorctl restart revoboard:` (bare) or deploy again (Docker).

## Domain and TLS, later

Have ports 80 and 443 published and add one certificate that covers both names (two names or a wildcard) to Nginx, redirect plain HTTP to HTTPS on both, add `Secure` to the session cookie in `frontend/lib/session.ts`, switch `SITE_URL`, `APP_URL`, and `ALLOWED_ORIGINS` to `https://` values, then run `setup-server.sh https://<app host>` and deploy again. Setup overwrites the Nginx site, so put the TLS change in `deploy/nginx/revoboard.conf`.

## Smoke test

`bash deploy/smoke.sh` runs the whole stack against a throwaway database. CI runs it before every deploy.
