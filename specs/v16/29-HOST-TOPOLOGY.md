# Host Topology, V16 (draft)

### Requirement 42: Site Host and App Host

**User Story:** As the product owner, I want the landing page on the main domain and the app on `app.` under it, so that visitors meet the promotion page first and the app has its own address.

This requirement amends Requirement 33 (DEP-05 and DEP-13) and Requirement 34 (the smoke test). One Next.js process serves both hosts; the `Host` header chooses the page. The Backend, the database, the scheduler, and the Compose or `supervisord` layout do not change. Open Question 38 holds the planned names.

#### Acceptance Criteria

**Hosts and routing**

1. [HOST-01] THE System SHALL serve two hosts from one Frontend process: the Site_Host, which serves the Landing_Page, and the App_Host, which serves the app, the sign-in pages, the shared and invite pages, and `/api` (through Nginx). The planned names are `revoboard.belajardeploy.web.id` (Site_Host) and `app.revoboard.belajardeploy.web.id` (App_Host) (Decision AV).
2. [HOST-02] THE Frontend SHALL route a request by its host and path as follows, in `frontend/proxy.ts` (Requirement 14 criterion 27 and Decision P):

| Host | Path | Result |
|---|---|---|
| Site_Host | `/` | serve the Landing_Page (an internal rewrite to `/site`; the address bar keeps `/`) |
| Site_Host | `/robots.txt`, `/sitemap.xml`, `/favicon.ico`, `/brand/*`, `/_next/*` | serve as usual |
| Site_Host | `/site` | HTTP 404 (the internal path is not public) |
| Site_Host | any other path | HTTP 308 to `{APP_URL}` plus the same path and query |
| App_Host | `/` | redirect to `/boards`, as today |
| App_Host | `/site` | HTTP 404 |
| App_Host | `/robots.txt` | disallow all (LAND-14) |
| App_Host | any other path | as today: Protected_Route guard, sign-in pages, shared and invite pages |

3. [HOST-03] THE Frontend SHALL read the request host from `x-forwarded-host` and, when that is absent, from `host`; compare its hostname only (case-insensitively, without the port and without a trailing dot) with the hostname of `SITE_URL`; and treat an absent, malformed, or non-matching host as the App_Host. THE Frontend SHALL build every redirect target from `APP_URL` or from a relative path, and SHALL NOT copy the request host into a redirect (Requirement 33, DEP-07).
4. [HOST-04] THE Frontend SHALL extend the `proxy.ts` matcher so that it runs for every page request except static assets, and SHALL keep the existing guard for the Protected_Routes `/boards`, `/profile`, `/admin`, and `/invite` on the App_Host unchanged. No Protected_Route page SHALL be reachable through the Site_Host.
5. [HOST-05] WHILE `SITE_URL` is not set, THE Frontend SHALL treat every host as the App_Host, which keeps access by the server IP and port 8082 and by `localhost` working (DEP-13); in that state `/site` SHALL answer HTTP 404 when `NODE_ENV` is `production`, and SHALL serve the Landing_Page for local preview otherwise.

**Configuration**

6. [HOST-06] THE Frontend SHALL read two server environment variables: `SITE_URL`, the Site_Host origin (for example `https://revoboard.belajardeploy.web.id`), and `APP_URL`, the App_Host origin (for example `https://app.revoboard.belajardeploy.web.id`). Each is an absolute origin (scheme, host, optional port) with no path; THE Frontend SHALL refuse to start with a clear message when one is set and the other is not, or when a value is not an absolute origin.
7. [HOST-07] THE Frontend SHALL read both variables at request time on the server and SHALL NOT inline them into the build (no `NEXT_PUBLIC_` prefix), so that one build serves the IP address and any domain, and the origin independence of Requirement 33 criterion 6 holds. WHILE `APP_URL` is not set, THE Landing_Page links SHALL be the relative paths `/login` and `/register`.
8. [HOST-08] THE Session_Cookie SHALL stay a host-only cookie of the App_Host: THE Frontend SHALL NOT set a `Domain` attribute, so that the Site_Host and any other subdomain never receive it. WHEN TLS is enabled, THE Frontend SHALL add `Secure` to the cookie (DEP-13).
9. [HOST-09] THE Backend SHALL stay reachable only through the App_Host. The browser calls `/api` on the current origin, so no cross-origin request exists: `ALLOWED_ORIGINS` SHALL list the App_Host origin only, and the Landing_Page SHALL make no browser request to the Backend (LAND-01). Public links, invite links, and every absolute URL the app builds SHALL use the App_Host origin.

**Nginx, TLS, and DNS**

10. [HOST-10] THE Nginx site file SHALL name both hosts in `server_name` and keep a `default_server` for the server IP; SHALL send `/api/` to the Backend and every other path to the Frontend for the App_Host and the default server; SHALL answer HTTP 404 for `/api/` on the Site_Host; SHALL preserve the request host in `Host` and `X-Forwarded-Host` (DEP-05); and SHALL keep the 3 MB body limit.
11. [HOST-11] WHEN TLS is configured, THE certificate SHALL cover both names (two names or a wildcard), plain HTTP SHALL redirect to HTTPS on both, and DNS SHALL have address records for both names. THIS requirement does not automate certificate issue; the runbook records the steps.
12. [HOST-12] THE deploy runbook (`deploy/README.md`), the server environment file template, the Compose file, and the `supervisord` configuration SHALL document and pass `SITE_URL` and `APP_URL` to the Frontend only, and SHALL record the DNS, Nginx, and certificate steps of criteria 10 and 11.

**Verification**

13. [HOST-13] THE smoke test (`deploy/smoke.mjs`) SHALL check, by sending `Host` headers to the Nginx port, that: the Site_Host `/` returns the Landing_Page containing the text "RevoBoard" and "Get started"; the Site_Host `/login` answers 308 to `{APP_URL}/login`; the Site_Host `/api/health` answers 404; the Site_Host `/site` answers 404; the App_Host `/` redirects to `/boards`; the App_Host `/site` answers 404; the App_Host `/robots.txt` disallows all; the App_Host `/api/health` is healthy; and a request by the server IP behaves as the App_Host.
14. [HOST-14] THE Frontend SHALL cover the table of criterion 2 with a property test (Property 64): for any host, path, and query, the result is exactly one row of the table, no redirect target is built from the request host, and a malformed host never reaches the Site_Host rows.

**Amendments**

15. [HOST-15] THIS requirement amends DEP-05 ("serves one origin") to "serves the Site_Host and the App_Host by name and the server IP as the App_Host", and DEP-13 so that the planned domain is the Site_Host and `app.` under it is the App_Host; the rest of Requirements 33 and 34 stands.
