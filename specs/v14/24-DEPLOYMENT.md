# Deployment, V14 (draft)

### Requirement 33: Production Topology

**User Story:** As the product owner, I want RevoTask to run on my server behind Nginx and return after a reboot, so that people can use it from the internet.

#### Acceptance Criteria

1. [DEP-01] THE System SHALL run the Backend, the Frontend, and a deadline scheduler as Docker Compose services built from the monorepo, each as a non-root user.
2. [DEP-02] THE System SHALL use the PostgreSQL installed on the server at `localhost:5432`, database `revoboard_db`, owned by the non-superuser role `revou`, and SHALL provide idempotent setup SQL that takes the password at run time.
3. [DEP-03] THE System SHALL run every service with `network_mode: host`, binding the Backend to `127.0.0.1:5001` and the Frontend to `127.0.0.1:3000`.
4. [DEP-04] THE Backend SHALL be served by Gunicorn with 3 workers.
5. [DEP-05] THE System SHALL provide a new Nginx site file that serves one origin, sends `/api/` to the Backend and every other path to the Frontend, preserves the public host and port, overwrites `X-Forwarded-For` with the client address, and limits the request body (Open Question 35). THE Backend SHALL run with `TRUSTED_PROXY_COUNT=1`.
6. [DEP-06] THE Frontend SHALL call `/api` on the current origin from the browser and SHALL read an absolute loopback Backend URL from `INTERNAL_API_URL` on the server, so that one build works on the IP address and on the domain.
7. [DEP-07] THE Frontend SHALL send every redirect, `/session-expired` included, to the public origin or as a relative path, and never to `localhost` or a container address.
8. [DEP-08] WHEN the server boots, THE System SHALL start PostgreSQL, Nginx, and Docker through their enabled system services, and every Compose service through `restart: unless-stopped`.
9. [DEP-09] THE System SHALL run `flask notify-deadlines` at least hourly from the scheduler service; a repeated run SHALL create no duplicate Notification.
10. [DEP-10] THE System SHALL keep uploads outside the checkout and the images, so that they survive a deploy and a reboot.
11. [DEP-11] THE System SHALL keep every secret and password out of the repository, the images, and the CI logs; application secrets SHALL live only in a server file with mode 600.
12. [DEP-12] THE System SHALL rotate container logs with the `json-file` driver, `max-size` 10 MB and `max-file` 3.
13. [DEP-13] UNTIL the domain and TLS are configured, THE System SHALL accept plain HTTP on the server IP and port 8082. The later TLS change SHALL add `Secure` to the Session_Cookie and update `ALLOWED_ORIGINS`. The planned domain is `revoboard.belajardeploy.web.id`.

### Requirement 34: Continuous Integration and Deployment

**User Story:** As the product owner, I want a push to master to be tested in a separate environment and then deployed, so that a broken build does not reach production.

#### Acceptance Criteria

1. [CICD-01] WHEN a pull request targets `master` or a commit is pushed to `master`, THE System SHALL run `pytest`, `tsc --noEmit`, `vitest run`, and `next build` in GitHub Actions.
2. [CICD-02] WHEN those checks pass, THE System SHALL build both images and start the production Compose stack in the CI runner against a throwaway PostgreSQL with throwaway secrets, starting from an empty database.
3. [CICD-03] THE smoke test SHALL verify the migrations, a second start, `/api/health`, login with a seeded test user, a server-rendered Board page, and the redirect target of `/session-expired`, all through Nginx.
4. [CICD-04] WHEN both jobs pass on a push to `master`, and only then, THE System SHALL deploy that exact commit over SSH with a pinned host key and build the images on the server, tagged with the commit SHA.
5. [CICD-05] THE System SHALL run one deployment at a time and SHALL NOT cancel a running deployment.
6. [CICD-06] BEFORE it replaces the running services, THE System SHALL back up the database (Open Question 34).
7. [CICD-07] IF the health check fails after a deploy, THEN THE System SHALL restart the previous images without running migrations, SHALL leave the schema as it is, and SHALL report the job as failed.
8. [CICD-08] THE System SHALL require each later migration to stay compatible with the previous release, because a rollback does not downgrade the schema.

### Requirement 35: Health Endpoint

**User Story:** As the operator, I want one endpoint that says whether the Backend works, so that deploys and health checks can decide automatically.

#### Acceptance Criteria

1. [HLT-01] WHEN `GET /api/health` is called without a Token and the database answers `SELECT 1`, THE Backend SHALL return 200 in the standard Envelope.
2. [HLT-02] IF the database does not answer, THEN THE Backend SHALL return 503 in the standard error Envelope within 5 seconds, without exception text, host, user, or connection string.
3. [HLT-03] THE Backend SHALL apply no rate limit to this endpoint, SHALL follow the routes, service, and repository layers, and SHALL list it in `openapi.json` and `API.md`.

### Requirement 36: Demo Seed

**User Story:** As the product owner, I want demo data in the deployed app, so that I can show it working.

#### Acceptance Criteria

1. [SEED-01] THE System SHALL document a manual, one-time `flask seed-data` command in a one-off container that alone receives `APP_ENV=development`, after the first migration.
2. [SEED-02] THE System SHALL take the seed password at run time and SHALL NOT write it to the repository, the server environment file, or the shell history.
3. [SEED-03] THE running Backend SHALL keep `APP_ENV=production`, the API documentation SHALL stay hidden, and no start or deploy step SHALL run a seed.

### Requirement 37: Migrations on Start

**User Story:** As the operator, I want the Backend to migrate on start without risk to data, so that a deploy needs no manual step.

#### Acceptance Criteria

1. [MIG-01] WHEN the Backend container starts normally, THE System SHALL run `flask db upgrade` once before Gunicorn starts and SHALL NOT start Gunicorn if it fails; a rollback start SHALL skip this step.
2. [MIG-02] WHEN the V10 or V12 migration runs outside development and testing and `users` is empty, THE migration SHALL apply its schema changes without `TRUNCATE`.
3. [MIG-03] IF either migration runs outside development and testing and `users` has rows, THEN THE migration SHALL abort with no change. Behaviour in development and testing SHALL NOT change.
