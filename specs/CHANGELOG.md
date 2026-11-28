# Changelog

Versions match `.kiro/specs/CHANGELOG.md`. Each folder holds requirement domains only; `v1` is the full baseline and later folders hold only changed domains.

## V1 - Initial Release
- Full requirements baseline in `v1/`, one file per domain (`00-OVERVIEW` to `16-STRETCH`).
- Snapshot of the requirements as generated before the V2 decisions.

## V2 - 2026-11-18
### Changes
- `v2/` holds the domains that changed: `00-OVERVIEW` (decisions log, glossary), `01-AUTH`, `02-ROLES`, `03-BOARDS`, `04-CARDS`, `05-DRAG-AND-DROP`, `06-CATEGORIES`, `07-COMMENTS`, `08-ACTIVITY-LOG`, `09-NOTIFICATIONS`, `10-ANALYTICS`, `11-VISIBILITY`, `12-SEARCH-FILTER`, `13-API-CONVENTIONS`, `15-TESTING`.
- Unchanged from V1: `14-NON-FUNCTIONAL`, `16-STRETCH`.
- Board membership and `Board_Staff_Access` (Decision A), intentional Admin exclusions recorded (Decision B), single `login_identifier` (Decision C), signed and time-limited attachment URLs (Decision D), and the secondary defaults listed in `.kiro/specs/CHANGELOG.md`.

### Reason
- Resolve the product owner's decisions A to D and the gaps found in review of V1.

### Impact
- Breaking: `email_or_username` renamed to `login_identifier`; attachment `file_url` is now signed and expires; a tokenless Guest on a private board gets 401 instead of 403.
- Open: `login_identifier` format validation, the public-board reading of Decision A, and attachment delivery cost.

## V3 - 2026-11-18
### Changes
- `v3/17-API-DOCS.md`: new Requirement 17 (API documentation: OpenAPI, `API.md`, Swagger UI gated by `APP_ENV`). Original V3 wording used a hand-written `openapi.yaml`; V4 supersedes it.

### Reason
- The backend had no written API reference. This folder was added after the fact so every version has a snapshot.

## V4 - 2026-11-18
### Changes
- `v4/` holds the changed domains: `00-OVERVIEW` (Decision E, glossary), `01-AUTH`, `07-COMMENTS`, `10-ANALYTICS` (envelope examples), `13-API-CONVENTIONS` (status/message, flask-smorest), `17-API-DOCS` (generated OpenAPI).

### Reason
- Add `status` and `message` to every response and use flask-smorest for schemas and responses.

### Impact
- Breaking: the response body shape changes from `{ data }` to `{ status, message, data }`; 422 validation errors are mapped to 400.


## V5 - 2026-11-18
### Changes
- `v5/` holds the changed domains: `00-OVERVIEW` (Decision F), `13-API-CONVENTIONS` (relationship and no-`to_dict` rules), `14-NON-FUNCTIONAL` (constant query count), `15-TESTING` (query-count and `lazy="raise"` tests).

### Reason
- Keep list endpoints inside the 300 ms p95 target and keep serialization out of models.

### Impact
- No API or schema change; no migration.

## V6 - 2026-11-18
### Changes
- `v6/` holds the changed domains: `00-OVERVIEW` (Decision G, glossary), `01-AUTH`, `07-COMMENTS`, `10-ANALYTICS` (envelope examples), `13-API-CONVENTIONS` (boolean `status`, single `message`, `error.details`).

### Reason
- Remove the duplicated message on errors and make `status` a success flag.

### Impact
- Breaking: `status` changes from a number to a boolean; `error.message` is removed; validation errors add `error.details`.

## V7 - 2026-11-19
### Changes
- `v7/` holds the changed domains: `00-OVERVIEW` (Decision H, glossary: Design_Tokens and shadcn/ui) and `14-NON-FUNCTIONAL` (criteria 5, 9, 10 reworded; 13 to 15 added: Tailwind CSS and shadcn/ui themed from the design tokens, `lg` = 960px, focus ring from `--ring`).

### Reason
- Style the frontend with Tailwind CSS and the shadcn/ui design system. The visual reference is the product owner's light project-management dashboard (white surfaces, navy brand, pastel tags, icon rail); the prototype stays the reference for behaviour and content.

### Impact
- Frontend only: no API or schema change. The `Base*` components become wrappers over shadcn/ui; direct imports of shadcn/ui elsewhere and arbitrary Tailwind values are forbidden.

## V8 - 2026-11-19
### Changes
- `v8/` holds the changed domains: `00-OVERVIEW` (Decision I, introduction), `03-BOARDS` (criteria 20 to 22: visibility icons, wrapped names, Home page), `04-CARDS` (criteria 20 and 21 reworded; 30 to 38 added: chips and popovers, range calendar, start-not-after-end guard, assignee popover, no column select, footer, two-column attachments, subtasks card, pane scrolling), `05-DRAG-AND-DROP` (criterion 2 reworded; 13 added: HTML5 drag on scrolling column bodies), `07-COMMENTS` (criterion 21: `author_name`), `08-ACTIVITY-LOG` (criterion 8: `actor_name`), `14-NON-FUNCTIONAL` (criteria 7 and 10 reworded; 16 to 19 added: Sidebar collapse with the logo toggle, Inter, viewport-locked board, RevoTask name and small radii).

### Reason
- The product owner asked for the Trello board and card experience.

### Impact
- Frontend only: no API or schema change. The Card modal loses its column select; cards move only by drag-and-drop (HTML5 API). The API gains two additive fields: `actor_name` on activity rows and `author_name` on comments and replies.

### V8 round 3 (same version, uncommitted)
- `v8/04-CARDS` (criteria 20, 35, 36 reworded; 39 and 40 added), `v8/08-ACTIVITY-LOG` (criteria 9 and 10 added: activity metadata and wording), `v8/14-NON-FUNCTIONAL` (criteria 20 to 22 added: control and type scale, tooltip behaviour, board card sizes), `v8/00-OVERVIEW` (Decision I "where applied").
- Impact: additive `metadata` keys on new Activity_Log rows (backend); the rest is frontend.

### V8 round 4 (same version, uncommitted)
- `v8/00-OVERVIEW` (Decision J, Decision I "where applied"), `v8/03-BOARDS` (23 to 25), `v8/04-CARDS` (21 and 35 reworded; 41 to 45), `v8/06-CATEGORIES` (13), `v8/07-COMMENTS` (22), `v8/08-ACTIVITY-LOG` (11, 12), `v8/09-NOTIFICATIONS` (11, 12), `v8/13-API-CONVENTIONS` (19), `v8/14-NON-FUNCTIONAL` (10 and 20 reworded; 23 to 26).
- Impact: paging on three endpoints (additive query parameters, same response shape), a new candidates endpoint, and a frontend visual system pass.

### V8 round 5 (same version, uncommitted)
- `v8/03-BOARDS` (23 reworded; 26 to 29), `v8/04-CARDS` (46 to 50), `v8/06-CATEGORIES` (14), `v8/10-ANALYTICS` (8), `v8/00-OVERVIEW` (Decision I "where applied").
- Impact: a migration for `Board.description` and four computed counts on the board list; the rest is frontend.
- Round 5 amendment: `v8/03-BOARDS` criterion 29 drops the cover band (plain bordered tile).
## V9 - 2026-11-20
### Changes
- `v9/` holds the changed domains: `01-AUTH` (criteria 19 to 38: sign-in and sign-out end-to-end criteria with IDs `AUTH-E2E-SI-01` to `-10` and `AUTH-E2E-SO-01` to `-08`, new Glossary terms, Open Questions 5 to 7), `15-TESTING` (criteria 10 to 15: suite files, environment variables, `.env.example`, no `waitForTimeout`, test isolation).
### Reason
- The product owner asked for Playwright end-to-end specifications for sign-in and sign-out, happy and negative cases.
### Impact
- Specification and test additions only; no behaviour, API, or schema change. Criteria SO-03 and SO-05 are pending Open Question 5 (no Frontend route guard exists; `/boards` is open to Guests).
## V10 - 2026-11-20
### Changes
- `v10/` holds the changed domains: `00-OVERVIEW` (Decisions K to P, new and changed Glossary terms, Open Questions 1, 3, 5, 6 resolved and 7 to 13), `01-AUTH` (criteria 1 to 5, 11, 17, 18 reworded or withdrawn; 19 to 37 updated for the new login form, header sign-out, and route guard; 39 to 54 added), `03-BOARDS` (23, 25), `04-CARDS` (26), `06-CATEGORIES` (6), `07-COMMENTS` (16), `08-ACTIVITY-LOG` (5), `11-VISIBILITY` (4, 5, 7 reworded; 13 added), `12-SEARCH-FILTER` (6, 7), `13-API-CONVENTIONS` (3, 10, 11), `14-NON-FUNCTIONAL` (3, 10, 26 reworded; 27 added), `15-TESTING` (7, 11, 15 reworded; 16 to 19 added), `17-API-DOCS` (1), and the new domains `18-SHARE-LINKS`, `19-APP-HEADER-PROFILE`, `20-RATE-LIMITING`.
### Reason
- Guests no longer browse public Boards (share links instead); one header user menu; separate Username and Email; rate limiting; every signed-in page guarded; V9 e2e criteria brought in line.
### Impact
- Breaking API changes: login field `identifier`; register fields `username` and `email`; `user` shape; Guest requests to board routes return 401 (comment endpoints 401 instead of 403); candidate search fields; 429 `RATE_LIMITED`; `error.details` on a registration 409; Signed_File_URL signature scope. Database revision `b7d2e4f6a801` (reversible in part). Full list in `.kiro/specs/CHANGELOG.md` V10.
- Earlier version folders are unchanged.
### V10 round 2 (same version; V10 is specified but not implemented, so there is no V11)
- `v10/00-OVERVIEW` (Decisions Q to T; Decisions L, M, O, P annotated; Glossary: Avatar_Image, Avatar_URL, Initials_Avatar, Safe_Return_Path; Open Questions 7, 8, 10, 12 resolved, 14 to 16 added), `v10/01-AUTH` (1.6, 1.34, 1.37 reworded; 55 to 62 added: invalid or expired Token on any request, tests AUTH-E2E-SO-11 and -12), `v10/03-BOARDS` (25 reworded; 30 to 32 added: Email to staff), `v10/04-CARDS` (33 reworded: assignee popover with Email), `v10/13-API-CONVENTIONS` (10), `v10/14-NON-FUNCTIONAL` (28), `v10/15-TESTING` (16 reworded; 20 to 24 added), `v10/18-SHARE-LINKS` (24), `v10/19-APP-HEADER-PROFILE` (8 to 10 reworded; 18 to 33 added: avatar upload), `v10/20-RATE-LIMITING` (7 withdrawn; 8, 10, 15 reworded; 18 added: registration not limited).
- Impact: no `RATE_LIMIT_REGISTER_MAX` and no register limiter; avatar upload endpoints and `avatar_path` replace the `https` avatar URL; `GET /api/boards/{id}/candidates` and `GET /api/boards/{id}/members?include=email` return `email` to staff; an unusable Token ends on `/login` with the cookie removed. Full list in `.kiro/specs/CHANGELOG.md`, "Round 2 within V10".
- Open for the owner: the availability limiter was kept by the specifier (Open Question 14); avatar visibility (15); Email exposure through name search (16).
### V10 round 3 (same version; amendment)
- `v10/00-OVERVIEW` (Decisions U to W; Open Questions 9, 11, 13 to 18 resolved), `v10/01-AUTH` (1.6 reworded; 1.52, 1.53 withdrawn; 1.63, 1.64 added), `v10/03-BOARDS`, `v10/04-CARDS`, `v10/07-COMMENTS`, `v10/12-SEARCH-FILTER`, `v10/15-TESTING` (16, 18, 24 reworded; 25 to 27 added), `v10/17-API-DOCS` (11), `v10/18-SHARE-LINKS` (11, 25), `v10/19-APP-HEADER-PROFILE` (avatar routes under `/api/users`; 13, 14 withdrawn; 34 to 40 added), `v10/20-RATE-LIMITING` (change-password limiter, 19 to 23).
- Impact: avatar routes move to `/api/users/me/avatar`; `avatar_url` appears in Comment, member, candidate, and assignee payloads for signed-in viewers (Guests: initials); the V10 migration resets local development data and the seed fills username, email, and full_name; change-password is rate limited; candidate search needs 2 characters.
- Still open: Open Questions 19 to 21 (V11). Details in `.kiro/specs/CHANGELOG.md`, "Round 3 within V10".
## V11 - 2026-11-21
### Changes
- `v11/` holds the changed domains: `00-OVERVIEW` (Decision X, Glossary terms Brand_Assets, Logo_Mark, Logo_Full, BrandLogo, Embedded_Raster, Favicon_File, Open Questions 19 to 21), `14-NON-FUNCTIONAL` (criteria 16, 19, 26 reworded), `15-TESTING` (criterion 28 added), and the new domain `21-BRANDING` (BRAND-01 to BRAND-17: favicon through the Next.js file convention, logos in `public/brand/` shown only through `BrandLogo` with `next/image` and `unoptimized`, alt text, sizes, Sidebar, sign-in pages, header, tests).
### Reason
- The product owner supplied the RevoTask logo and favicon to replace the placeholder mark.
### Impact
- No API, data model, or permission change. Frontend only.
- Finding: both SVG logos wrap a PNG (640 by 640 and 720 by 220 pixels, no alpha), so they are not true vector art (Open Question 19). Only `favicon.ico` is supplied (Open Question 20).
- V10 round 3 is applied separately; `v10/` is unchanged by V11. Full list in `.kiro/specs/CHANGELOG.md`, V11.


## V12 - 2026-11-21
### Changes
- `v12/` holds the changed domains: `00-OVERVIEW` (Decisions Y to AF, the earlier decisions they amend or supersede, Glossary changes, Open Questions 3 and 22 to 28), `01-AUTH` (`/invite/{token}` route guard and Safe_Return_Path, E2E criteria 65 to 72), `02-ROLES` (access summary), `03-BOARDS` (Requirement 22, private-only access model), `04-CARDS` (Requirement 25 Auto_Save, Requirement 27 Subtask matrix and derived progress, labelled criteria of Requirements 4 and 16), `07-COMMENTS` (Requirement 26, comment deletion and Attachment removal confirmation), `08-ACTIVITY-LOG` (new actions), `09-NOTIFICATIONS` (Requirement 28), `11-VISIBILITY` (Requirement 11 superseded in part), `13-API-CONVENTIONS` (breaking changes and new endpoints), `15-TESTING` (criteria 29 to 35, Properties 51 to 58), `18-SHARE-LINKS` (Requirement 23, Public_Link), `19-APP-HEADER-PROFILE` (Requirement 29), and the new domain `22-INVITES-JOIN-REQUESTS` (Requirement 24).
- Breaking: `visibility` removed from the API and data model; the Public_Link is Manager and Admin only; direct member add and candidates are Manager and Admin only; assignee must be owner or Board_Member; Save changes removed; Notification table and types change; local data reset.
### Reason
- The owner approved private-only Boards with a public link and an invite flow, per-field auto-save, comment deletion, derived progress, clickable Inbox rows, and a two-column Profile page.
### Impact
- `v1/` to `v11/` are unchanged. V11 branding (`v11/21-BRANDING`) is untouched. Nothing is implemented; task group 35 carries the work. Contradictions found and open questions: `.kiro/specs/CHANGELOG.md`, V12, "Consistency check (V12)".
### V12 round 2 (same version; V12 is unimplemented, so there is no V13)
- `v12/00-OVERVIEW` (Open Questions 22 to 24 resolved by the owner, 25 to 27 resolved by default, 28 unchanged; labels on Decisions M and S; Decisions Y and AA reworded), `v12/03-BOARDS` (ACC-13 reworded; ACC-19 and ACC-20 added; Requirement 3 criteria 24 and 31 labelled), `v12/04-CARDS` (criterion 33: owner listed first), `v12/13-API-CONVENTIONS` (join-requests rows carry `email`; members endpoint lists the owner once), `v12/15-TESTING` (V12-T2 reworded; V12-T8, V12-T9, V12-M1, V12-D1 added as criteria 36 to 39), `v12/22-INVITES-JOIN-REQUESTS` (INV-13 and INV-19 reworded; INV-27 and INV-28 added).
- Impact: the pending join-request list carries each requester's Email for the owner, a Manager, and an Admin only (the Email now has three staff-only places); the Sidebar Team members list starts with the owner, tagged "Owner", with no remove action; no data-writing Playwright test for the invite flow is scheduled (manual checklist, automated test deferred).
- `v1/` to `v11/` are unchanged (V11 branding untouched). Details and the consistency check: `.kiro/specs/CHANGELOG.md`, "Round 2 within V12".

## V13 - 2026-11-21
### Changes
- `v13/` holds `00-OVERVIEW` (Decisions AG to AI, Open Questions 29 and 30), `04-CARDS` (Requirement 30, role tag), `22-INVITES-JOIN-REQUESTS` (Requirement 31, control sizes), the new domain `23-DOCUMENT-TITLES` (Requirement 32), `13-API-CONVENTIONS` (`role` on members), and `15-TESTING`.
- Requirement 21 criterion BRAND-11 (the suffix "· RevoTask") is superseded by TITLE-01 and TITLE-02.
### Reason
- The owner asked for a role tag in the assignee picker, Invite and Generate controls that match the design system, and titles of the form "RevoTask | name of the open menu".
### Impact
- API: one additive field. No migration. Frontend: new `RoleTag`, `lib/titles.ts`, `generateMetadata` on three routes, control sizes in two components.
- Nothing in V13 is implemented; task group 36 carries the work. `v1/` to `v12/` are unchanged.
- Open for the owner: Open Questions 29 and 30 (both resolved by default).

## V14 - 2026-11-22 (draft, awaiting owner review)
### Changes
- **Specification:** Decisions AJ to AN, Requirements 33 to 37, Open Questions 31 to 37: production deployment, CI/CD, health endpoint, manual demo seed, migrations on start.
- **Design:** "V14 design: production deployment", Properties 61 and 62.
- **Tasks:** group 37 (37.1 to 37.13), waves 104 to 111.
- **Bugs found, not fixed:** the migrations abort on an empty production database; a relative API URL breaks the Frontend; `/session-expired` redirects to localhost behind a proxy; nothing schedules `notify-deadlines`.
- **Proposed amendment, not in force:** USR-13 and ACC-17 (Decision AN).
- **Implementation:** none.
### Reason
- The owner asked to deploy to an Ubuntu server with Docker Compose, host PostgreSQL, Nginx, Gunicorn, GitHub Actions, and start on boot.
### Impact
- Requirements: 33 to 37; proposed labels on USR-13 and ACC-17.
- Design: deployment, API URL resolution, two migrations, `/session-expired`, health endpoint.
- Steering: the two-domain rationale in `backend.md` and `tech.md` is outdated; task 37.12 syncs it.
- Blocking: Open Questions 31 to 33.

### Round 2 within V14 - 2026-11-22
#### Changes
- **Specification:** Decision AN approved (USR-13 and ACC-17 amended); Open Questions 32 to 35 resolved; Open Question 31 records that the server is a container without Docker and stays open.
- **Bug fixes:** safe migrations on an empty production database; origin-independent API and asset URLs; relative `/session-expired` redirect; `flask run-scheduler`.
- **Implementation:** `GET /api/health`. Tasks 37.2, 37.3, 37.4, and 37.14 are done.
- **Breaking:** none. Absolute `NEXT_PUBLIC_API_URL` values keep working; development migrations still reset.
#### Reason
- The owner asked for the blockers to be fixed as recommended and accepted the backup, uploads, and body-limit defaults.
#### Impact
- Requirements 33, 35, 37; Properties 61 and 62. No deployment file is written until Open Question 31 is decided.

### Round 3 within V14 - 2026-11-23
#### Changes
- **Specification:** Open Question 31 resolved: the current server cannot run containers, so it runs in bare mode; Docker mode is kept for a VM or AWS EC2.
- **Implementation:** `deploy/bare/` (setup, deploy with releases and rollback, seed, supervisor config), `compose.yaml`, both Dockerfiles, `deploy/*.sh`, `.github/workflows/deploy.yml` (`DEPLOY_SCRIPT` selects the mode; CI tests on Python 3.12, the server version), repaired `package-lock.json`.
- **Bug fixes:** `package-lock.json` lacked two Linux-only packages, so `npm ci` failed outside macOS; `test_committed_openapi_json_is_current` failed on Python 3.12 because Python 3.13 renamed the HTTP 422 phrase.
- **Not changed:** requirements 33 to 37 still describe Docker mode; bare mode is a recorded variant.
#### Reason
- The owner's server cannot run Docker, and the owner plans to move to AWS EC2 later.
#### Impact
- Task 37.13 (first deployment) and 37.12 (steering) remain open.

## V15 - 2026-11-23
### Changes
- `v15/` holds `00-OVERVIEW` (Decisions AO and AP, Glossary changes) and `21-BRANDING` (BRAND-06, 07, 08, 10, 11 reworded for the new brand).
- Product renamed RevoTask to RevoBoard with a new logo, wordmark, and favicon; `--accent` changed from orange (`#f4a340`) to teal (`#006b5f`).
- Design reference recorded: a Stitch-generated "Kanban Task Management App" design is adopted as a visual/spacing reference only (specs v1-v14 remain the source of truth), with a list of Stitch inventions (estimate field, status dropdown, comment mentions/emoji, mobile Done/bookmark button, Activity "Live Stream"/online-count/export, workspace-wide Categories) explicitly excluded from scope.
### Reason
- The owner reviewed `design/stitch-redesign-report.md` and chose the new brand and a real teal accent over the placeholder mark and the navy-only palette.
### Impact
- Frontend only, no API/data model/permission change. Files: `app/favicon.ico`, `public/brand/logo-revo.svg`, `public/brand/logo-text-revo.svg`, `components/shared/BrandLogo.tsx`, `app/layout.tsx`, `components/shell/{AppHeader,Sidebar}.tsx`, `lib/titles.ts`, `styles/tokens.css`, and three test files (`branding.test.tsx`, `titles.test.ts` including its brand-length constant, `route-titles.test.ts`). `v1/` to `v14/` are unchanged except where `v15/21-BRANDING` supersedes wording.

## V16 - 2026-11-23 (draft, awaiting owner review)
### Changes
- **Specification:** `specs/v16/` holds `00-OVERVIEW` (Decisions AQ to AX, the prototype exclusions list, the supersession map, Glossary changes, Open Questions 38 to 43) and one file per new requirement: `25-DESIGN-SYSTEM` (Requirement 38), `26-APP-SHELL` (39), `27-SCREENS` (40), `28-LANDING-PAGE` (41), `29-HOST-TOPOLOGY` (42), `30-THROUGHPUT-DASHBOARD` (43), and `31-VERIFICATION` (44). `.kiro/specs/requirements.md` carries the same Decisions, Open Questions, Glossary entries, and Requirements 38 to 44, with a "(V16: ...)" note on each earlier criterion they supersede (Requirements 3, 6, 8, 9, 10, 14, 19, 21, and DEP-05 and DEP-13 of 33). Decisions AO and AP of V15 are also added to the Decisions Log there.
- **Design (visual fidelity, round 2 within V16):** the owner asked for the same visual as prototype 2. The 13 prototype pages were rendered in Chrome at 1440 and 390 pixels, their computed styles measured, and the renders saved in `design/reference/v2/` (with a README). Requirements 38 to 40 were rewritten from the measurements: the first draft had taken radii, button heights, colours, and the rail from the prototype's Tailwind configuration and was wrong (flat rail, navy primary buttons, 8 to 12 pixel radii, bordered fields, a `#faf8ff` page colour). The measured system: a `#f3f2ff` canvas and tint, one white rounded app frame, a floating white pill rail, teal pill primary buttons 36 pixels high, compact pills 28, chips 24, fields 40 with no border, radius roles 8, 12, 16, 24, and full, a navy gradient auth panel, and a floating Side_Panel. Requirement 44 gains a browser test of the recipe table (V16-T16) and a screenshot run (V16-T17). Open Questions 44 and 45 record the accessibility risk of fill-only fields and small controls and the rail Home circle and landing announcement bar.
- **Design:** one design system for the app, the sign-in pages, and the landing page, with no separate marketing token layer (Decision AQ); Plus Jakarta Sans headings and Inter body, both self-hosted (AR); a radius role scale and a named shadow scale in place of the 8 pixel limit (AS); the Sidebar replaced by an Icon_Rail, a Top_Nav, a Board_Switcher, and a Team_View in the Side_Panel (AT); a landing page served on the Site_Host by the same Next.js process (AU, AV); `Card.completed_at` and two throughput endpoints with a Dashboard page (AW). `.kiro/specs/design.md` gains "V16 Revision Notes" and Properties 63 to 68; `.kiro/specs/tasks.md` gains group 38 (38.1 to 38.18) and its dependency waves.
- **Implementation:** none. The owner asked to update the specs and not to implement; no source, test, migration, or deployment file changed.
- **Not changed:** the API of Requirements 1 to 37 except the planned `done_delta` meaning (THR-04) and the two new routes; permissions; the data model except the planned `cards.completed_at`; the steering files (task 38.17 syncs them after approval).
- **Excluded from the prototype (not built):** global search and `⌘K`, the welcome hero, workspace chips, the sprint concept, card identifiers and estimates, a second assignee, hour and capacity figures, the register Terms checkbox and entropy meter, rail Settings and Log out, Inbox Mentions and Assignments tabs, Activity filters and live indicators, shared-view tabs and export, invite view counts and role picker, Admin seats, 2FA, and export, the owner select in Create Board, landing pricing and tiers, and dark mode (full list in `specs/v16/00-OVERVIEW.md`).
- **Breaking (when implemented):** the Sidebar and its stored collapse state are removed; `done_delta` changes meaning for Cards edited after completion; the app moves to its own host, so old links on the Site_Host redirect to the App_Host.
### Reason
- The owner supplied `design/kanban-prototype-v2.html` (13 pages, including a landing page) and asked for a rebuild with Tailwind, no magic numbers, and one design system so every component looks balanced; the app moves to `app.<domain>`; the owner chose the prototype shell, host routing in the same Next.js app, a throughput endpoint, and corrected the earlier choice of a marketing token layer; the product name is RevoBoard.
### Impact
- Requirements 38 to 44 added; criteria of Requirements 3, 6, 8, 9, 10, 14, 19, 21, and 33 superseded or amended as the supersession map lists; Open Question 36 resolved; Open Questions 38 to 45 added (38 is open; 39 to 45 carry applied defaults the owner may change).
- Design: tokens and theme, shared components, shell, host routing, landing page, throughput query, Dashboard.
- Tasks: group 38.

### Implementation of V16 - 2026-11-23 (not committed)
#### Changes
- **Implementation (Frontend):** tokens and theme from the measured prototype (`styles/tokens.css`, `styles/globals.css`), Plus Jakarta Sans added, `cn` taught the new scales; shared components restyled to the recipe table (`BaseButton` with primary teal, dark, quiet, and danger variants, `BaseBadge` tones, `BaseChip`, `BaseCard`, inputs, dialogs, popovers, menus) plus `BaseDrawer` and `BaseLinkButton`; new shell (`IconRail`, `TopNav`, `NavDrawer`, `SkipLink`, `BoardSwitcher`, `TeamView`, `navItems.ts`, three-view `SidePanel`) replacing the Sidebar and `useSidebarState`; Board toolbar and filter bar, Columns, Cards, Home tiles, auth pages, Card modal, Inbox, Activity, Categories, Admin users, Shared view, and Profile restyled; Dashboard (`/dashboard`, chart, tiles, Boards table, recent activity, loading and error states); landing page (`app/site`, `components/landing`, `lib/landing-sample.ts`); host routing (`lib/host.ts`, `lib/origins.ts`, `proxy.ts`, host-aware `robots.txt` and `sitemap.xml`); two label text colours darkened to reach 4.5 to 1.
- **Implementation (Backend):** `cards.completed_at` with migration `d4f8b2c6e903` (applied to the local development database), set and cleared in create and move, `done_delta` from `completed_at`, `GET /api/boards/{id}/analytics/throughput` and `GET /api/analytics/throughput`, seed data, regenerated `openapi.json`, `API.md`.
- **Implementation (deployment files, not run on the server):** Nginx site with two hosts, `SITE_URL` and `APP_URL` in the setup scripts, `compose.yaml`, `deploy.sh`, smoke test checks for both hosts, runbook section.
- **Tests:** 177 existing Frontend tests kept (Sidebar tests moved to the new components, none deleted) plus `v16-host`, `v16-tokens`, `v16-shell`, `v16-dashboard`, `v16-landing`; Backend `test_throughput.py`.
- **Not done:** the Playwright checks of V16-T07, T16, and T17 (no Playwright setup in the repository); the Admin users table layout, the Invite modal tabs, the Card modal's attribute-chip row, and the Inbox "All and Unread" switch are restyled but not rebuilt to the prototype layout; the Board toolbar's progress figures come from the live Card list, not the Board payload, so they follow a drag at once; the `brand/v2` logo files were byte-identical to the current ones, so BrandLogo was not changed.
- **Breaking:** the Sidebar and its stored collapse key are gone; `done_delta` changed meaning (Open Question 42, default applied).

## V17 - 2026-11-26 (draft, awaiting owner review)
### Changes
- **Specification:** `specs/v17/` holds `00-OVERVIEW` (Decisions AY to BJ, the supersession table, exclusions, phases, glossary, Open Questions 46 to 67) and one file per requirement group: `32-UI-FIXES` (Requirement 45), `33-PATHS-AND-NAVIGATION` (46, 47), `34-BOARD-SLUG-AND-404` (48), `35-COLUMNS-AND-BOARD-VIEWS` (49, 50), `36-DASHBOARD-AND-MY-TASKS` (51, 52), `37-USERS-AND-PROFILE` (53, 54), `38-SHARE-AND-CARD-MODAL` (55, 56), `39-NOTIFICATIONS` (57, 58), `40-ACCOUNT-ACTIVATION-EMAIL` (59), and `41-VERIFICATION` (the test plan and the owner's visual review checklist, `V17-T01` to `V17-T14`, not a numbered requirement). `.kiro/specs/requirements.md` gets Requirements 45 to 59, Decisions AY to BJ, the glossary terms, Open Questions 46 to 67, and "Superseded by ..., V17" notes in the places they replace (Requirements 1, 2, 3, 9, 19, 23, 24, 26, 29, 33, 39, 42, 43). Earlier text is kept.
- **Design:** `design.md` gets the V17 section: data model changes for four migrations, endpoints and error codes, the one-origin topology and public prefix, navigation components, the dashboard query budget, notification and due-job design, the activation and mail design, the consistency table, risks, and Properties 69 to 80.
- **Tasks:** `tasks.md` gets group 39 (39.1 to 39.52, ten phases, one commit each, every task unticked and linked to its requirement IDs) and dependency waves 121 to 154.
- **Steering:** `frontend.md`, `backend.md`, `api-conventions.md`, and `data-model.md` get a V17 block of the rules that change (paths, navigation, `ConfirmDialog`, slugs, mail, new error details, the Card and Notification columns). `structure.md` and `tech.md` are synced later by task 39.51.
- **Implementation:** none. No source, migration, test, or deploy file changed.
- **Not changed:** the Flask routes outside those listed in the design; the roles and Decision B; the Public_Link and Invite_Link tokens; the V16 design system; everything in `specs/v1/` to `specs/v16/`.
- **Breaking (when implemented):** every app URL moves under `/app` (old paths redirect with 308); the host split of V16 is removed; Column management is for the Board_Owner, Manager, and Admin (Supervisor BoardMembers lose it); a Card in `Done` cannot be archived; archived Cards lose their Column and the Card gains `board_id`; register returns no Token and sign-in needs a verified email; the daily `deadline` job is replaced by `notify-due`; the V12 card notification index is narrowed; the V16 Icon_Rail, Top_Nav, `BaseConfirm`, Invite and Public link buttons are removed.
### Reason
- The owner asked for a path-based topology, a new navigation, board slugs and a 404 page, Column CRUD and board views, a richer Dashboard and My Tasks, user deactivation, a social-style Profile, one Share modal, notification preferences and a due job, email activation, and fixes to seven UI defects (`specs/v17/KIRO-BRIEF.md`). The owner answered Open Questions 46 to 50 in the brief.
### Impact
- Requirements 45 to 59 added; criteria of Requirements 1, 2, 3, 9, 19, 23, 24, 26, 29, 33, 39, 42, and 43 superseded or amended as the supersession table lists; Open Questions 46 to 50 resolved by the owner and 51 to 67 added with defaults applied.
- Design: topology, shell, slug, Columns and archived Cards, due state, dashboard, My Tasks, users and activation, mail, notifications.
- Tasks: group 39.
### Consistency findings (reported, defaults applied; the owner confirms in task 39.1)
- **`cards.board_id` is missing from the brief's migration 2** (Open Question 53): without it an archived Card with a null `column_id` has no Board.
- **The V12 card notification index would refuse a second event the same day** (Open Question 56): migration 4 narrows it.
- **"Every filter applies to every widget" empties Due tomorrow under the default range** (Open Question 54).
- **"Every create and delete" conflicts with the at-once saving of comments, Subtasks, and attachments** (Open Question 51).
- **Column rights** (Open Question 55) resolved by the owner: Board_Owner, Manager, and Admin.
- **Archiving versus THR-03** (Open Question 57, resolved: a Done Card cannot be archived), **status chip versus the V15 exclusion** (58), **deactivation versus "no revocation list"** (60), **slug 403 versus 404** (52).
- **Two things added that the brief did not name:** a link to the Archived page on the Board toolbar, and `CANNOT_DEACTIVATE_SELF`. The brief's "root `CHANGELOG.md`" does not exist; the root changelog of the specs is `specs/CHANGELOG.md`, and it carries the same entry.

### Round 2 within V17 - 2026-11-26 (owner answers to Open Questions; no new version)
- **Open Question 51 (ConfirmDialog scope):** approved as written.
- **Open Question 55 (Column rights):** the Board_Owner, a Manager, and an Admin create, rename, reorder, and delete Columns (COL-01, COL-11; Decision BC; tasks 39.20 and 39.21; Requirement 3 criteria 4 and 5 stay superseded). A Supervisor who is only a BoardMember cannot.
- **Open Question 57 (archiving and `completed_at`):** a Card in `Done` cannot be archived; the new COL-14 refuses it with 409 `CARD_IN_DONE` and the Card modal disables Archive. COL-08, the design, and `data-model.md` are reworded; cards archived before V17 keep their `completed_at`.
- **Open Questions 56, 58 to 65:** agreed as written (defaults stand).
- **Open Questions 54 and 52:** the owner's answer ("make the atomic filter to the widget that use due tomorrow" for 52) does not match the question numbered 52 (slug 403 versus 404). It is read as an answer to the Due tomorrow widget (Open Question 54) but its meaning is not clear, so 54 and 52 stay open and unchanged until the owner clarifies.
- **Open Questions 66 and 67:** no answer yet; defaults stand.

### Round 2 within V17, continued - 2026-11-26
- **Open Question 54 (Dashboard):** the Due tomorrow widget gets its own "Due on" date filter (default tomorrow, `due_on` query parameter), independent of the date range; DASH-12, DASH-15, DASH-19, and the design table are updated. The other widgets keep the table of DASH-12.
- **Open Questions 52, 66, 67:** the defaults are confirmed (slug route 403 for no access; accented letters removed; `robots.txt` does not disallow `/app`).
- **Open Questions 53 and 54:** confirmed ("oke"); the earlier "52. yes" is read as the answer to the Due tomorrow filter question.
- Open Questions 46 to 67 are now all resolved or confirmed.

### Round 3 within V17 - 2026-11-26 (owner review of the specs; no new version)
- **ACT-12 (new):** `next` is kept through register, verification, and sign-in, so a signed-out invite visitor still reaches the Join_Request (Open Question 69; task 39.47).
- **NAV-13 (new):** the Inbox gets an All and Unread switch, and `GET /api/notifications` gets `unread=true` (Open Question 70; new task 39.10a).
- **NAV-01 and TASK-01:** an Admin does not see My Tasks and is redirected from `/app/my-tasks` (Open Question 71).
- **Open Question 51:** confirmed. No ConfirmDialog for creating a comment, reply, Subtask, attachment, or Join_Request.
- **Open Question 55:** confirmed. The Board_Owner, a Manager, and an Admin manage Columns.
- **Open Questions 68, 72, 73 (new, resolved):** unverified accounts are not purged; `email_verified_at` and `is_active` stay two flags; the `Path=/app` cookie ends existing sessions at deploy.
- **Confirmed as written:** COL-14 (a Card in `Done` cannot be archived) and Open Question 59 (`CANNOT_DEACTIVATE_SELF`).

### Implementation of V17 - 2026-11-26 (all phases built; nothing committed; the owner's visual review, task 39.52, is open)
- **Built:** ConfirmDialog and the form fixes (Phase 1); one origin under `/app`, the Sidebar and Top_Menu, the Share modal (Phase 2); board slugs and the 404 page, `API_PUBLIC_PREFIX` (Phase 3); Column CRUD, Column-less archived Cards, List, Calendar, Archived, `due_state` (Phase 4); the Card modal layout (Phase 5); user flags, deactivation rules, pickers, the Users table, the Profile page, mail and email tokens (Phase 6); the Dashboard endpoint and page, My Tasks (Phase 7); notification preferences, the five event types, `flask notify-due` (Phase 8); activation and the verify page (Phase 9). Migrations: `e5a9c3d7f104` slug, `f1b6d8a2c405` cards board and nullable column, `a3d8f1b7c629` users and email tokens, `b8e4c2a9d713` preferences and notification types. Tests: backend 280+ and frontend 339, `next build` and the four-width check (`frontend/e2e/widths.mjs`) pass.
- **Where the build differs from the text (each is a decision for the owner to keep or reverse):**
  1. **Link paths (PATH-04).** `path` of the Invite_Link and Public_Link is always `/app/invite/{token}` and `/app/shared/{token}` (the frontend routes); `API_PUBLIC_PREFIX` only changes the API base in signed file URLs (`/app/api/attachments/...`). A prefix that is empty in development would have given a path with no page.
  2. **Mail backend in production (ACT-08).** `MAIL_BACKEND=console` is accepted in production when chosen on purpose (the smoke test and the setup scripts use it until SMTP is configured); `smtp` is the production default and stops the start-up when a setting is missing. Until SMTP is set, nobody receives an activation link: the link is only in the Backend log.
  3. **Scheduler (DUE-06).** No cron entry. The existing `scheduler` service (Docker) and supervisord program (bare) run `flask run-scheduler`, which now runs `notify-due` every 15 minutes. `app/jobs/deadlines.py` is replaced by `app/jobs/due.py`.
  4. **Board members payload (ADM-01, ADM-08).** `GET /api/boards/{id}/members` also returns `is_active` and `is_available`, because the Members view tags an inactive or unavailable person; no other member, comment, or candidate payload carries them.
  5. **Restore route (VIEW-06).** `POST /api/cards/{id}/unarchive` is the one restore route (the task said to keep an existing reversal route, not add a second).
  6. **404 inside the shell (SLUG-12).** An unknown path under `/app` and an unknown Board slug show the Not_Found_Page without the shell, signed in or not.
  7. **Invite pages and the guard (PATH-05).** `/app/invite/{token}` stays guarded: a signed-out visitor is sent to `/app/login?next=...`, and `next` survives register, confirmation, and sign-in (ACT-12).
  8. **No Board rename screen (SLUG-09).** The frontend has no control that renames a Board, so there is nothing to replace in the URL; the Backend rule (a rename moves the slug and the old one is 404) is built and tested.
  9. **Unverified accounts.** A user with `email_verified_at` null and no Token never reaches a protected route; they are not purged (Open Question 68).
  10. **Playwright (39.50).** The four-width check is a plain script on `playwright-core` and Chrome (`frontend/e2e/widths.mjs`, `shot.mjs`), not a `@playwright/test` suite.
  11. **Card modal (CM-01).** The header (icon tile, Board, Column badge, auto-save state), the card title eyebrow, the chip row order, and the Description, Subtasks, Attachments order follow `04-card-modal-desktop.png`; the right pane keeps "Comments" and "Activity" headings. Further visual matching waits for the owner's review.

## V18 - 2026-11-26 (draft, awaiting owner review)
### Changes
- **Decisions BK to BR:** Toasts (60); design consistency scales, no default option highlight, one combobox, date field, and checkbox (61); Sidebar logo, active subtree, back arrow to the parent (62); Users order, paging, full width (63); Boards search and sort (64); Admin reads the Dashboard, filter card rebuilt (65); My Tasks and assignment closed to Manager and Admin (66); Column drag on the existing drag code (67); Card modal 960 px, no Column chip, Attachments above Subtasks, 5-per-page comments and activity (68); per-item Member rights and the comment rule, `created_by_id` on subtasks and attachments (69); Members panel popover and reset (70); 18-key category palette and shared refresh (71); verification (72).
- **Open Questions 74 to 81** recorded with defaults.
### Reason
- The owner's review of the built V17.
### Impact
- Requirements: 60 to 72 (new); 47, 49, 51, 52, 53, 56 amended (notes added). Decision B amended (Admin Dashboard).
- Design: Properties 81 to 86; V18 revision notes. One migration (`created_by_id`).
- Tasks: group 40 (40.1 to 40.20).

### Implementation of V18 - 2026-11-26 (built; nothing committed; the owner's visual review, task 40.20, is open)
- **Built:** Toasts (central, in `lib/http.ts` and `lib/toast.ts`); the scale tokens and the 18-colour palette; one combobox look, `BaseDateField`, `BaseCheckbox`; Sidebar logo, active subtree, and the back arrow; Users order, paging, and full width; Boards search and sort; Admin Dashboard and the labelled filter card; My Tasks and assignment closed to Manager and Admin; Column drag; Card modal width, order, paging, and permissions; Members popover and reset; palette picker and shared refresh. Backend: migration `c7d2e9f4a118`, `card_policy.py`, comments paging, users paging, boards `q`/`sort`/`order`, palette validation. Tests: backend 316 (30 of them in `test_v18.py`); frontend 354.
- **Where the build differs from the text (each is a decision for the owner to keep or reverse):**
  1. **Token names (DS-01).** The Design_System already had `--size-control` (40), `--size-control-sm` (32), `--size-chip` (24), and `--space-N`. V18 added only `--space-label`, `--space-field`, `--space-section` (aliases of `--space-2`, `-4`, `-6`), `--modal-w-card` 60rem, `--sidebar-w` 256px (the full logo and the toggle need it), and the palette tokens; the other names of DS-01 map to the existing ones. The spacing and size rule of `check-tokens` (DS-06) is not added: the existing `tests/styling.test.ts` still guards the named-token rule.
  2. **Toast wiring (TOAST-01).** Toasts are raised inside `request`, from the envelope `message` of every non-GET call, with a short list of quiet calls (sign-in, auto-save, checks, moves, mark read), not by each component. Inline banners that already existed were left in place, so a few failures show both a Toast and a banner.
  3. **Column drag (COLD-01).** Cards use the browser's native drag events, not pointer code, so no `useDragSort` hook was extracted; the Column grip uses the same native events beside the card code in `Board.tsx`.
  4. **Date range (DASH-27).** The range is two date fields ("From", "To") with the three presets as a segmented control, not one popover range field.
  5. **Users search.** The search box now filters the current page only ("Search this page").
  6. **Back arrow to Boards (NAVB-06).** The Boards page keeps its search and sort in `sessionStorage`, and the arrow restores them.
  7. **Card embeds all comments.** The card response still embeds every top-level comment; the modal shows 5 and pages the rest from that list, then asks `GET /comments?limit=&offset=` for more.
  8. **Admin analytics.** An Admin reads `/analytics/boards` and the per-Board and throughput routes as a Manager does, not only the Dashboard.
  9. **Admin home.** The Sidebar logo links to the Dashboard for Supervisor, Manager, and Admin and to My Tasks for a Member; the login redirect was not changed.

### Round 2 within V18 - 2026-11-26 (owner review of the build; specs only, not built yet)
- **NAVB-01, NAVB-02:** the logo is the Sidebar toggle; the separate expand and collapse icon is removed; `--space-section` below the logo.
- **NAVB-07 (new):** a `--border` line separates the App_Header from the page content.
- **NAVB-08 (new):** the Top_Menu is centred in the App_Header from 960 pixels.
- **DASH-25, DASH-27, DASH-28:** the presets ("Last 7 days", "Last 30 days", "This month") are removed; the range is From and To only; the four filters and Reset sit in one row from 960 pixels. This supersedes deviation 4 of "Implementation of V18".
- **Tasks:** new 40.21; 40.20 (visual review) stays last.
- **DS-14 to DS-17 (new, same round):** each radius token gets one role (form controls `--radius-field`, buttons and chips `--radius-full`, items `--radius-card`, surfaces `--radius-frame`, checkbox `--radius-sm`); every form control shares one class, so a search field and a select match; no magic number anywhere, enforced by `tests/design-system.test.ts`, which replaces the `check-tokens` script (this supersedes deviation 1 of "Implementation of V18" for DS-06). New task 40.22.

### Implementation of round 2 within V18 - 2026-11-26 (built; nothing committed)
- **Built:** the logo is the Sidebar toggle (the separate icon is gone; `--sidebar-w` is back to 240px; `--space-section` below the logo); a `border-b border-line` under the App_Header; the Top_Menu centred between two equal flexible parts; the Dashboard presets removed and the four filters in one row from 960 pixels with Reset after "To"; page content now starts `--space-field` under the header line.
- **Shapes (DS-14, DS-15):** `controlClasses` in `components/ui/input.tsx` is the one look of input, textarea, select, date, and colour triggers; the select trigger is no longer a button pill. Moved to their role: textarea to the field radius; tabs, the Auth switch, submit and verify buttons, the Board "Add Card" and "Add column" buttons, Calendar day buttons, and the Board switcher to the full radius; tooltip to the field radius; Subtask, attachment, and drop-zone tiles, alert banners, and member result rows to the card radius; the toast to the frame radius. Only the checkbox keeps the small radius.
- **Test (DS-16, DS-17):** `tests/design-system.test.ts` (raw px, rgb, hex, literal inline styles, default radius utilities, the small radius, and the shared control look). It replaces the `check-tokens` script, which was never written; this supersedes deviation 1 of "Implementation of V18" for DS-06.
- **Known:** the Board toolbar search keeps a white fill (`bg-surface-raised`) because its section is `--surface` and the shared fill would not show.
- **Checks:** frontend 361 tests, `tsc`, `next build`, and the four-width check pass.

### Round 3 within V18 - 2026-11-26 (owner review; specs and build together; nothing committed)
- **Why:** the Design_System had five radius tokens and components padded with raw steps, so a search field, a progress pill, a select, and a Card had different corners and the spacing drifted screen by screen.
- **DS-18 (new, supersedes DS-14):** two radius tokens only: `--radius-ui` (12 pixels) for every component, `--radius-full` for circles (avatars, dots, switch). `--radius-sm`, `--radius-field`, `--radius-card`, and `--radius-frame` are deleted.
- **DS-19 (new):** `--pad-surface` (24, 32 from 960) and `--pad-item` (16, 20 from 960); page gutter 24 and 40; gutter 16 and 24.
- **DS-20 (new), CMV-02:** form controls use `focus-ring-inset`; the Card modal panes have inner padding; the activity dots sit inside the list. CMV-02 was in the spec but had not been built; it is now.
- **CMV-01:** the Card modal fills the viewport minus the page gutter.
- **NAVB-07:** content starts `--pad-surface` under the header line.
- **Build notes:** the Top_Menu items lost their wider padding from 1280 pixels so the menu fits beside the bell with the larger gutter. `tests/design-system.test.ts` now enforces DS-18 (two tokens, no other radius utility, circles only for avatars, dots, the switch) and DS-19 (no raw padding step on a surface). Old tests that asserted the five radius roles were updated.
- **Checks:** frontend 363 tests and `tsc` pass. The four-width check passes except the 404 page (`/app/does-not-exist`), which failed at three widths on one run and two at a second run with a React development-mode `performance.measure` error. That page was not changed in this round; the error is to be checked against a production build.
- **Task:** 40.23 (done); 40.20 (visual review) stays open.

### Round 4 within V18 - 2026-11-26 (owner review; specs and build together; nothing committed)
- **DS-21 (new):** the Column row pads an inner row, so the last Column ("Done") keeps the same gutter as the first while the row scrolls; Columns, their header, cards, "No cards", and Add Card share `--pad-item` with no extra inset; from 960 pixels Columns share the row (never under 16rem); the Column name is `text-base` semibold and truncates; below 960 pixels the App_Header shows the brand, not the Board name.
- **DS-22 (new):** seven text sizes (`xs`, `sm`, `base`, `page-title`, `title`, `xl`, `display`); `text-2xs`, `text-meta`, and `text-card-*` are removed and their 23 users moved; the Board toolbar chips, progress pill, and search are all `sm`. DS-03 is amended for the chip size.
- **DS-23 (new):** the Board header no longer shows "N Columns · N Total Tasks · description".
- **The 404 page check:** the four-width failure on `/app/does-not-exist` reported in round 3 is a React development-mode `performance.measure` error; against a production build (`next start`) all four widths pass, including the 404 page.
- **Checks:** frontend 365 tests, `tsc`, `next build`, and the four-width check on the production build pass.
- **Task:** 40.24 (done); 40.20 (visual review) stays open.

### Round 5 within V18 - 2026-11-26 (owner review; specs and build together; nothing committed)
- **Archived count (bug):** archiving a Card from the modal added 2 to the toolbar's Archived count, because the count was raised inside a React state updater, which React may run twice. The count now changes outside it. The Archived page was also still on the old frame (no space under the header line, a "Back to board" button, an inline notice); it now uses the page frame and a Toast (DS-25).
- **DS-24 (new):** one size per heading level (`h1` `xl`, `h2` `page-title`, `h3`/`h4` `base` semibold); the `title` size is removed, leaving six sizes; no token added. The Card modal sections are now all the same `h3`, so Details, Description, Attachments, Subtasks, Comments, and Activity match.
- **DS-25 (new):** one page frame for every app page.
- **DS-26 (new):** the sign-in and register pages are on the same scale, with one left edge and the accent submit button.
- **DS-27 (new):** the landing page copy is cut to one short line per idea; Teams, FAQ, and the announcement bar are removed; the header shows the mark below 960 pixels.
- **Tests:** `tests/design-system.test.ts` enforces the heading levels and the six sizes; the landing and Archived tests follow the new copy and the Toast.
- **Checks:** frontend 366 tests and `tsc` pass; the four-width check passes on the development server except the known development-only 404 error.
- **Task:** 40.25 (done); 40.20 (visual review) stays open.

### Round 6 within V18 - 2026-11-27 (owner review; specs and build together; not committed yet)
- **DS-28 (new, amends DS-21):** the Column width is a share of the board row: three Columns and half of the fourth from 960 pixels, one and a peek below; fewer Columns fill the row; the row keeps its gutter on both ends. `--column-w-min` is removed. The public board now uses the Board's frame, header, toolbar, Column row, and tiles, with a Read only badge; no token was added.
- **DS-29 (new):** Board and Card descriptions are TinyMCE rich text, self-hosted (no cloud key). **Licence:** TinyMCE 7 is GPL-2.0-or-later when self-hosted with `licenseKey: "gpl"`; a closed-source deployment needs a commercial licence from Tiny. Every description is sanitised by the Backend (`nh3` allowlist) and again by the Frontend (DOMPurify) before display; previews and search use plain words. Migration `d4a7e1c9b215` makes `boards.description` TEXT and converts existing plain-text descriptions; it was run on the development database.
- **Known:** the Card search matches the stored HTML, so a word that only appears in a tag name (for example "strong") can match.
- **Checks:** backend 324 tests, frontend 369 tests, `tsc`, `next build`, and the four-width check on the production build pass; the editor was exercised in the browser (typed bold text, saved on blur).
- **Task:** 40.26 (done); 40.20 (visual review) stays open.

### Round 7 within V18 - 2026-11-27 (owner review; specs and build together; not committed yet)
- **TinyMCE link dialog (bug, DS-30):** inside the Card modal the dialog could not be used or closed. The Radix modal turns pointer events off outside itself, treats a click outside as "close", and its focus trap pulled focus back from the dialog's fields. Fixed with three guards: the TinyMCE floating UI gets `pointer-events: auto`; the modal ignores outside clicks, focus, and Escape that come from that UI (`insideEditorUi`); focus events from that UI are stopped before they reach the trap. Checked in the browser: typing in URL, Cancel, the close button, Escape, and Save each close only the link dialog, and Save inserts the link.
- **Editor look (DS-30):** the TinyMCE skin is unlayered CSS loaded after ours, so our overrides inside `@layer` lost; they are now unlayered and raised with `:root`. One focus ring on the frame; the inner blue border is off; the dialog uses the one radius, app fonts, and the accent Save.
- **Option rows (DS-31):** list rows are `--control-h` high with `px-3 py-2 gap-3`; the assignee list is wide with `md` avatars.
- **Board right edge (DS-32):** the Column row is now an inset scroll area (`mx-page`), so Columns clip at the toolbar's right edge instead of the frame edge; the Column width formula follows.
- **Checks:** frontend 370 tests and `tsc` pass; the four-width check passes except the known development-only 404 error.

### Round 8 within V18 - 2026-11-28 (owner review; specs and build together)
- **Requirement 73 (new, `specs/v18/47-ROUND-8-OWNER-REVIEW.md`):** R8-01 to R8-14.
- **Mail (R8-01, R8-02):** one HTML layout for every email with the user's name escaped; `smtp` needs a `PUBLIC_BASE_URL` with a scheme (the live site sent `http:///app/verify` links while it was empty).
- **Sign-in and Users (R8-03 to R8-05):** Supervisor, Manager, and Admin land on the Dashboard, a Member on Boards; `next` still wins (TOK-03 superseded). The Users table shows Confirmed or Not confirmed from `email_verified`. The password button no longer jumps 17 pixels when pressed.
- **Dashboard, panels, and shell (R8-06 to R8-08):** "View all" removed (DASH-06 amended); card and activity rows are whole-row links; an "as <Role>" tag follows the Dashboard, My tasks, and Boards titles.
- **Feedback (R8-09, R8-10):** failure Toasts are amber for 403, 409, 429 and red otherwise, one per message (TOAST-05 amended, tokens `--warning-soft` and `--on-warning-soft` added from the amber label pair). The Board's inline error alert and card notice are Toasts now; the Members move refusal shows once.
- **Layout (R8-11, R8-12):** long attachment links wrap in activity rows; today is marked in the Calendar.
- **Demo and repository (R8-13, R8-14):** 6 realistic demo Boards, a private Admin password, `seed.sh --reset`; `design/` and the Docker server scripts removed.
- **Checks:** backend 498 tests, frontend 392 tests, and `tsc` pass; each screen change was checked in Chrome at 1280 and 360 pixels. Playwright was not run.
- **Task:** 40.28 (done); 40.20 (visual review) stays open.
