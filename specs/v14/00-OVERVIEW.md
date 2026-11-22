# Overview, V14 changes (draft)

V14 adds production deployment and awaits owner review. Everything in `specs/v1/` to `specs/v13/` stands. The amendment of USR-13 and ACC-17 (Decision AN) was approved in round 2 and is in force.

## Decisions Log (added)

| ID | Decision | Rationale | Where applied |
|----|----------|-----------|---------------|
| AJ | **Production topology (V14).** One Ubuntu 24 server, Docker Compose for the apps, host PostgreSQL and host Nginx, one origin, `network_mode: host`. | The owner's deployment brief. One origin replaces the two-domain assumption. | Requirement 33 |
| AK | **Build on the server, test first in CI (V14).** GitHub Actions tests and smoke-tests a separate environment; only then does a push to `master` deploy over SSH, with rollback. | The owner has no registry account and wants a tested build before production. | Requirement 34 |
| AL | **Health endpoint (V14).** A public `GET /api/health` reports whether the database answers. | Container, smoke, and deploy checks need one signal. | Requirement 35 |
| AM | **Manual demo seed (V14).** `seed-data` runs once by hand in a one-off container with `APP_ENV=development`; the running app stays `production`. | The owner wants demo data and keeps the seed guard (option A). | Requirement 36 |
| AN | **Migrations on an empty production database (V14, approved in round 2; amends Decisions V and Y).** The V10 and V12 reset migrations may run outside development only when `users` is empty, and then truncate nothing. | Both migrations abort in production today, so upgrade on start cannot create the database. | Requirement 37; amends USR-13 and ACC-17 |

## Open Questions (added)

31. **Server type (V14, finding confirmed, decision open, blocking):** the server is a Docker container: `/.dockerenv` exists, PID 1 is `sshd`, there is no Docker binary or socket and no systemd. Requirement 33 criteria 1, 3, and 8 cannot be met there as written. The owner chooses: (A) a VM, or access to the outer host, with Docker, keeping V14 as written; or (B) this container without Docker (virtualenv, Node, a process supervisor), which amends Decisions AJ and AK and needs the provider to start the supervisor with the container.
32. **Reset migrations (V14, RESOLVED by the owner in round 2):** Decision AN is approved and implemented.
33. **Nginx port (V14, RESOLVED by inspection in round 2):** Nginx listens on port 80 inside the server and public port 8082 is forwarded to it (inferred: nothing inside listens on 8082). Port 8000 on loopback is already used by another process and must not be reused.
34. **Uploads and backups (V14, RESOLVED by the owner in round 2):** `/var/lib/revoboard/uploads`, and a `pg_dump` before each deploy with the last 7 kept. Off-server backup is not specified.
35. **Request body limit (V14, RESOLVED by the owner in round 2):** 3 MB, which also caps attachments at about 3 MB.
36. **Landing page (V14, open; not in V14 scope):** proposed a public route group in the same Next.js app at `/`, with signed-in visitors sent to `/boards`. It gets its own version when its content is known.
37. **Directory layout (V14, open):** proposed the whole monorepo at `/srv/revoboard/app`, configuration at `/srv/revoboard/.env`, and only mutable data under `/var`.
