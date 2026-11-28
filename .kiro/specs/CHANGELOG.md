# Changelog

## V1 - Initial Release
- Initial requirements generated from `specs/project-brief.md` and `.kiro/steering/*.md`.
- Initial implementation scope established: auth, roles, boards and columns, cards, drag-and-drop, categories, comments, activity log, notifications and inbox, analytics, board visibility and archiving, search and filter. Google OAuth is out of scope. Progress, views, and decorative tabs are stretch.
- Incorporates five user decisions: `Board.owner_id` (supervisor ownership, guest-only privacy, supervisor analytics scope); members move and edit only assigned cards; create-card action shown to supervisor, manager, and admin on manager-authored comments; board soft delete and archive limited to manager and admin; admin permissions (no commenting or priority flagging).

### Impact
- Requirements: 1 to 16 (new).
- Design: created in `.kiro/specs/design.md` (V1). Adds `Board.owner_id` to the data model, omits `updated_at` on the append-only `ActivityLog`, and adds a `(user_id, card_id, type, notify_date)` unique constraint on `Notification`. `data-model.md` steering needs a sync for these.
- Tasks: not yet created.

## V2 - 2026-11-18
### Changes
- **Decision A (specification):** private boards are gated for unrelated signed-in users. New `BoardMember` entity and `Board_Access` concept; Req 3 gains member add/remove and owner reassign/clear; Req 11.6 replaced; Board_Access wording applied to Req 4, 5, 6, 7, 8, 9, 12.
- **Decision B (specification, no behavior change):** Admin's exclusion from commenting, priority flagging, and analytics (2.5, 10.4) recorded as intentional in a new Decisions Log.
- **Decision C (specification, breaking):** `email_or_username` replaced by one case-insensitive `login_identifier` in the API, the data model, and the glossary.
- **Decision D (specification, breaking):** 4.18 replaced. Attachment files are served through signed, time-limited URLs (15 minutes) that enforce Board_Access; a permanently public URL is no longer allowed.
- **Secondary defaults (specification):** 24h JWT and logout; password minimum and hashing; notification mark-as-read endpoints; order boundary and rebalance rules (5.1 exception); Subtask reorder formula; cross-board move guard; 6.8 cascade dropped; 401 vs 403 standardized (11.5 for a tokenless Guest changes 403 to 401); card unassign; search fields; overdue definition; child-row soft-delete rule; wider pytest coverage (15.5 to 15.7); APP_TIMEZONE for the deadline job.
- **Clarifications after consistency check (specification):** added `Board_Staff_Access` (owner/BoardMember Supervisor, Manager, Admin) for all write actions so an unrelated Supervisor cannot write on a public board; Req 7.14 kept and steering aligned; Req 7.16 Guest status (403 public, 401 private); Req 4.25 signature failures always 403.
- **Other findings (specification):** Decisions 1-5 and A-D labeled in the document; board ownership reassign/clear; case-insensitive unique Category names per board (409).
- **Design:** revised to V2 (BoardMember, `can_access`, signed URLs, new endpoints, properties 1 to 36). **Steering:** `data-model.md`, `backend.md`, `frontend.md`, `api-conventions.md`, `product.md` updated to match.

### Reason
- Resolve the product owner's decisions A to D and the gaps found in review of V1.

### Impact
- Requirements: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15 (all but 14 and 16).
- Design: data model, access control, attachments, ordering, auth, endpoints, correctness properties.
- Tasks: `tasks.md` created from V2 (22 task groups).
- Open: login_identifier format, public-board interpretation of Decision A, and attachment delivery cost (see Open Questions in requirements). Root `specs/v2` created.

## V3 - 2026-11-18
### Changes
- **API documentation (specification):** new Requirement 17. A hand-written `backend/openapi.yaml` and `backend/API.md` document every endpoint. Swagger UI at `/api/docs` is registered only when the new optional `APP_ENV` is `development` or `testing`; it defaults to `production` and is hidden there.
- **Design:** new `APP_ENV` variable, `app/docs.py`, an "API Documentation" section, Properties 37 and 38.
- **Tasks:** new task group 23 (23.1 to 23.4).

### Reason
- The backend has no written API reference; the product owner asked for API.md and a Swagger page that production must not expose.

### Impact
- Requirements: 17 (new). Design: environment variables, backend layout, new section. Tasks: 23 (new). Code: not changed yet.


## V4 - 2026-11-18
### Changes
- **Specification (breaking):** every API response carries top-level `status` (HTTP status code) and `message`. Success is `{ status, message, data }`; error is `{ status, message, error: { code, message } }`. Req 13.2 to 13.4 revised, 13.11 added; examples in 1.1, 1.15, 7.2, 10.5 updated. The Swagger UI HTML, raw OpenAPI document, and successful file bytes are exempt.
- **Specification:** the backend uses flask-smorest with marshmallow schemas (Req 13.12 to 13.15); validation failures return 400 `VALIDATION_ERROR`, never 422. Requirement 17 revised: the OpenAPI document is generated (no hand-written `openapi.yaml`, `flask-swagger-ui`, or `pyyaml`), exported by `flask export-openapi` to `backend/openapi.json`, served only when `APP_ENV` is `development` or `testing`; `API.md` stays hand-written. Decision E recorded.
- **Design:** `app/api.py`, `app/common/envelope.py`, per-blueprint smorest layering, envelope and error tables, Properties 36 to 38 rewritten, V4 migration notes.
- **Tasks:** new group 24 (migrate the implemented backend), group 23 rewritten for generated docs, task 14.4 reworded, dependency graph rebuilt.
- **Steering:** `api-conventions.md`, `backend.md`, `tech.md`, `structure.md` updated.
- **Implementation sweep:** tasks 1 to 13 are implemented and committed (36 pytest tests pass) on plain `flask.Blueprint` with the old `{ "data": ... }` envelope. Checkpoints 6.5 and 14.6, tasks 14.2 to 14.4, all property tests, and the frontend (15 to 22) are not done.

### Reason
- The product owner asked for `status` and `message` on every response and for flask-smorest to define schemas and responses.

### Impact
- Requirements: 1, 7, 10, 13, 17 and the Decisions Log. Design: layout, envelope, errors, API documentation, Properties 36 to 38. Tasks: 14.4, 23, 24 (new).
- Code: group 24 migrated the backend to flask-smorest and the `status`/`message` envelope, and group 23 added generated OpenAPI, `backend/openapi.json` and `backend/API.md`. This breaks the response shape for any client written against V3.
- Open: Swagger UI assets load from a CDN under flask-smorest (Open Question 4).

## V5 - 2026-11-18
### Changes
- **Specification:** Decision F. Models declare SQLAlchemy relationships only for real cross-table reads (`Board.columns`, `Board.members`, `Card.subtasks`, `Card.attachments`, `Comment.replies`) with `back_populates`, `lazy="raise"`, and no delete cascade; models have no `to_dict`. Repositories load related rows with `selectinload`. New criteria: 13.16 to 13.18, 14.12 (constant query count per list endpoint), 15.8 and 15.9 (query-count and `lazy="raise"` tests).
- **Design:** relationship table, repository loading table, no-`to_dict` rationale, Property 39, V5 notes. Component loading choices: no `joinedload` for assignee or category (not allowed relationships); comment author role comes from a joined `select(Comment, User.role)`.
- **Tasks:** new group 25 (relationships, eager loading, optional tests, checkpoint), after group 24 and before frontend group 15.
- **Steering:** `data-model.md` and `backend.md` rules added; `data-model.md` `login_identifier` example corrected to the functional unique index.

### Reason
- Keep list endpoints inside the 300 ms p95 target while allowing cross-table reads, and keep viewer-dependent serialization out of models.

### Impact
- Requirements: 13, 14, 15, Decisions Log. Design: data model, repository loading, Property 39. Tasks: 25 (new). Code: group 25 implemented (relationships and eager loading, 63 tests passing); no migration needed.

## V6 - 2026-11-18
### Changes
- **Specification (breaking, supersedes the envelope part of Decision E):** Decision G. `status` is a boolean, `true` exactly when the HTTP status is 2xx; the numeric HTTP status travels on the HTTP line only. The message text appears once at the top level. Success is `{ status, message, data }`; error is `{ status: false, message, error: { code, details? } }` with no `error.message`. `VALIDATION_ERROR` carries `error.details` (field to list of messages). Mutating endpoints send a descriptive message; reads send "OK". Req 13.2 to 13.4, 13.11, 13.13, 1.1, 1.15, 7.2, 10.5 and the Glossary updated.
- **Design:** envelope, `EnvelopeApi` error rendering, `ok()` default message, error table, `lib/api.ts` `ApiError(httpStatus, code, message, details)`, Property 36 rewritten, V6 notes.
- **Tasks:** 1.2, 3.2, 8.1, 14.4, 15.3, 23.3, 24.1 to 24.3 and Notes updated; no checkbox changed.
- **Steering:** `api-conventions.md` and `backend.md` updated.

### Reason
- The error body repeated the message in two places, and a boolean `status` is a clearer success flag than echoing the HTTP code.

### Impact
- Requirements: 1, 7, 10, 13 and the Decisions Log. Design: envelope and errors. Tasks: see above.
- Code: not changed yet; group 24 targets the V6 shape. Any client written against V4 must change.
- Open: error messages without custom text fall back to the HTTP reason phrase (design choice, not in requirements).

## V7 - 2026-11-19
### Changes
- **Specification (design/UI):** Decision H. The Frontend is styled with Tailwind CSS v4 and shadcn/ui, themed from the prototype's design tokens. Tailwind's theme is mapped to `styles/tokens.css` (default palette and arbitrary values are not used); `BaseButton`, `BaseBadge`, and `BaseModal` stay the only shared primitives and become thin wrappers over shadcn/ui `Button`, `Badge`, and `Dialog`. The look follows the approved prototype and may be refined (spacing, motion, hierarchy). Req 14.5, 14.9, 14.10 reworded; 14.13 to 14.15 added (Tailwind and shadcn/ui, `lg` = 960px, focus ring from `--ring`). Glossary: Design_Tokens, shadcn/ui.
- **Design:** key-decision row, frontend layout (`components/ui/`, `lib/utils.ts`, Tailwind `globals.css`), component table, new "Frontend Styling" section with the token mapping table, V7 notes.
- **Tasks:** new group 26 (26.1 to 26.5) after task 15 and before the app shell tasks; dependency graph rebuilt.
- **Steering and guidelines:** `tech.md`, `frontend.md`, `structure.md`, and `guidelines/frontend.md` updated (Tailwind and shadcn/ui rules, mobile-first and token examples in Tailwind terms, no arbitrary values, focus ring token corrected from `--focus-ring` to `--ring`).

### Reason
- The product owner asked for Tailwind CSS and the shadcn/ui design system while keeping the existing prototype UI as the reference.

### Impact
- Requirements: 14 (5, 9, 10, 13 to 15), Glossary, Decisions Log. Design: frontend layout, components, styling. Tasks: 26 (new).
- Code: frontend only; the backend and API are unchanged. The existing plain-CSS components are restyled in group 26; their props and logic do not change.
- Resolved on request: follow the prototype strictly for palette and layout, refinements allowed; steering and guidelines may be revised.
- **Look refresh (same revision, V7):** on request the visual reference changed from the HTML prototype to a light project-management dashboard (white surfaces, navy brand, pastel tags, icon rail with boards panel, flat columns, bordered cards). Decision H, Design_Tokens, Req 14.13, design ("Look refresh"), steering (`frontend.md`, `tech.md`), `guidelines/frontend.md`, and the `specs/v7` snapshot now name that reference; the prototype stays the reference for behaviour and content. Tasks: 26.7 added. No code outside `frontend/`.
- **Fidelity pass (same revision, V7):** the restyle was checked against the prototype and rebuilt to match it (frosted surfaces, accent bars, card and header layout, two-pane modal). Req 14.9 now also forbids numeric literals for sizes, layers, durations, and opacities (named token utilities only). Design: "Prototype fidelity" and "No magic numbers" notes. Tasks: 26.6 added.

## V8 - 2026-11-19
### Changes
- **Specification (behaviour and UI):** Decision I. The board and the Card modal follow a Trello-style model: a viewport-locked board with scrolling columns, a large Card modal with attribute chips and popovers, one range calendar for dates, a searchable assignee popover, a modal footer, a collapsible Sidebar with visibility icons, a Home page of boards, HTML5 drag-and-drop (a pointer-event rewrite was reverted, see below), and the Inter font.
- **Requirements:** 3.20 to 3.22 added; 4.20 and 4.21 reworded; 4.30 to 4.35 added; 5.2 reworded ("on drop"); 5.13 added; 14.7 and 14.10 reworded; 14.16 to 14.19 added; 4.36 to 4.38, 7.21, and 8.8 added; Decisions Log row I; introduction counts.
- **Design:** component table (Sidebar, BoardsHome, Board, CardModal, CardChips, DateRangePicker, MemberPicker, shared popover and calendar), layout entries, new section "Board and Card Modal Interaction (Decision I)", V8 revision and migration notes.
- **Tasks:** new group 27 (27.1 to 27.9, with 27.6.1 optional); dependency graph rebuilt (waves 32 to 36 are new, later waves renumbered).
- **Steering and guidelines:** `frontend.md`, `tech.md`, `structure.md`, and `guidelines/frontend.md` updated.

### Reason
- The product owner asked for the Trello board experience: a scrolling main panel, a large card modal with Trello-shaped attributes, a calendar range picker, a searchable member picker, a modal footer, no column select, a collapsible Sidebar, visibility icons, and the Trello font.

### Impact
- Requirements: 3, 4, 5, 14 and the Decisions Log. Design: frontend components and interaction. Tasks: 27 (new).
- Code: frontend only; the backend and API are unchanged (the start-not-after-end rule already exists in the Backend, Req 4.3). New packages: `@fontsource-variable/inter`, `@radix-ui/react-popover`, `react-day-picker`.
- Breaking: the Card modal loses its "Move to column" select, so a Card moves only by drag-and-drop; the HTML5 drag API is used, so touch support depends on the browser (open question). The `/boards` route becomes a page instead of a redirect.
- API (additive): activity rows gain `actor_name`; comments and replies gain `author_name` (Req 7.21, 8.8). No existing field changes.
- Resolved on request: all recommendations accepted: Home first and a boards page; Sidebar toggle with tooltips remembered in the browser; wrapped board names; Inter self-hosted (Atlassian Sans is proprietary); lock icons display only; no board background colour (token tint instead); Dutask palette kept; draft edits committed from the footer; date label stays "End date"; popover for the member picker; pointer-event drag for touch.
- **Revision within V8 (owner feedback after the first build):** smaller corner radii (Dutask look, main panel included); the Sidebar toggle is the logo mark and the app is named RevoTask; the pointer-event drag is reverted to the previous HTML5 behaviour; the card modal panes scroll (bug: the pane grid grew to its content); Attachments become a two-column card with a Link or File selector; Subtasks get their own card; comments and activity show real names (bug: names came only from the board-member list). Req 4.20 (three cards), 4.36 to 4.38, 5.13, 7.21, 8.8, 14.16, 14.19, Decision I reworded. Tasks: 27.5 reworded; new group 28 (28.1 to 28.4). Design: new bullets "Drag", "Pane scrolling", "Names", "Brand and radii".
- **Round 3 within V8 (owner feedback on the modal):** a control, type, and spacing scale (40px controls, 32px compact, 14/13/12px text, 24/20/16px spacing) so inputs, buttons, and chips balance; Activity in its own card; Attachments as bordered tiles with type icons; footer Archive, Delete, Save changes (right-aligned, no Close button); header "card title | board name" that follows the title field; the Sidebar tooltip no longer stays open after a click (cause: `focus-within`); larger board cards and fluid columns; an activity log that reads actor, action, object, from to. Requirements: 4.20, 4.35, 4.36 reworded; 4.39, 4.40, 8.9, 8.10, 14.20 to 14.22 added; Decision I "where applied". Design: bullets "Modal header" to "Board card and columns". Tasks: new group 29 (29.1 to 29.6). Steering: `frontend.md`.
- **API (additive, round 3):** new `metadata` keys on new Activity_Log rows (`card_title`, `changes`, `from_column_name`, `to_column_name`, `assignee_name`, subtask `title`, attachment `name`); no field, schema, or migration change; old rows keep their old keys. The V8 impact line "Code: frontend only" is therefore no longer true for round 3.
- **Round 4 within V8 (owner feedback on the visual system):** one type and spacing system (18/14/14/13/12px, 8px grid, 16px card padding) replacing the round 3 values; a Sidebar type hierarchy and a single Team members section with add (member search, popover or modal) and remove; a one-row Board header without Add Member or the settings icon, with a search modal below 960px; bordered Category chips; an avatar tooltip on board Cards; Card modal attributes as plain icon rows, a header with only the title and close icon, staged attachment changes applied on Save with a discard prompt, confirmation popovers for deletes, equal tile and button heights; a threaded comment layout; searchable selects everywhere; button roles (danger, secondary, primary); the Categories screen built now. Decision J: the Inbox and the two activity feeds are paged with `limit` and `before`. Requirements: 3.23 to 3.25, 4.41 to 4.45, 6.13, 7.22, 8.11, 8.12, 9.11, 9.12, 13.19, 14.23 to 14.26 added; 4.21, 4.35, 14.10, 14.20 reworded. Design: section "Round 4". Tasks: new group 30; 19.2 narrowed to the admin users screen. Steering: `frontend.md`, `api-conventions.md`.
- **API (round 4):** `limit` and `before` query parameters on `GET /api/notifications`, `GET /api/boards/{id}/activity`, and `GET /api/cards/{id}/activity` (response shape unchanged); new `GET /api/boards/{id}/candidates`. This reverses the earlier "no pagination" rule for these three lists only. New frontend packages: `@radix-ui/react-tooltip`, `cmdk`.
- **Round 5 within V8 (owner feedback on header, Home, and the modal):** two-row Board header with bordered sections and a sideways-scrolling category strip with arrows; Home tiles with a coloured cover, description, progress, counts, and member avatars; an analytics strip on Home for Supervisors (owned boards) and Managers, Admins still excluded (Decision B); an optional board description; the Card title shown as text with Edit; aligned date rows; a file drop zone; the modal close icon inside the header row; Category and Priority as two badge types; lowercase Category names. Requirements: 3.23 reworded; 3.26 to 3.29, 4.46 to 4.50, 6.14, 10.8 added. Design: section "Round 5". Tasks: new group 31. Steering: `data-model.md`, `frontend.md`.
- **API and schema (round 5):** `Board.description` (nullable, max 500) with a migration; `GET /api/boards` adds `card_count`, `done_count`, `overdue_count`, `member_count`. Additive only.
- **Round 5 amendment (same version):** the Home board tile has no coloured cover band (owner request); Req 3.29 and the design note are reworded and the `--size-tile-cover` token is removed.
## V9 - 2026-11-20
### Changes
- **Specification and test additions (no behaviour change):** end-to-end Playwright specifications for sign-in and sign-out, happy and negative cases.
- **Requirements:** 1.19 to 1.38 added (IDs `AUTH-E2E-SI-01` to `-10`, `AUTH-E2E-SO-01` to `-08`); 15.10 to 15.15 added (suite files, environment variables `E2E_BASE_URL`, `E2E_USER_IDENTIFIER`, `E2E_USER_PASSWORD`, `.env.example`, no `waitForTimeout`, isolation); Glossary terms added; Open Questions 5 to 7 added; introduction names V9.
- **Design:** section "Auth End-to-End Tests (V9)", end-to-end paragraph in the Testing Strategy, V9 revision notes.
- **Tasks:** new group 32 (32.1 to 32.6); no existing task renumbered; dependency graph gains waves 64 to 67.
### Reason
- The product owner asked for Playwright end-to-end specifications covering sign-in and sign-out.
### Impact
- Requirements: 1 and 15. Design: testing sections. Tasks: 32 (new).
- Code: none yet; the tasks add files only under `frontend/tests/e2e/auth/`, `frontend/playwright.config.ts`, and `frontend/.env.example`. Steering is unchanged.
- Findings, open for the product owner: (5) no Frontend route guard exists and `/boards` is open to Guests, so SO-03 and SO-05 are pending; (6) sign-out is the Sidebar "Log out" item, not a header control; (7) an invalid Token on a server render has no specified behaviour. Also: the Token is the `kanban_token` cookie, not browser storage.

## V10 - 2026-11-20
### Changes
**Specification changes**
- **Decision K, share links (specification, breaking):** Guests no longer browse public Boards. A Guest opens a Board only through `/shared/{token}`, read-only (columns, cards, card details, categories, attachment links); never comments or activity. New nullable unique `Board.share_token`; the Board_Owner, a Manager, and an Admin enable, disable, and regenerate it; disabling or regenerating invalidates the old link and its outstanding file URLs at once; private Boards may have a link; no expiry. A signed-in user with Board_Access who opens a link gets the normal view. Without a link, `/boards` needs sign-in. New Requirement 18. Reverses Req 11.4, 11.5, 11.7 as written in V2 to V9 and the Guest half of Decision A; Members can still read public Boards (restated as Req 11.13).
- **Decision L, header user menu and Profile (specification):** one App_Header on every signed-in page with a User_Menu (Profile above Log out); the Sidebar loses both entries. Profile page: full name, avatar (https URL), read-only Username and Email, change password. New Requirement 19. Resolves V9 Open Question 6.
- **Decision M, separate Username and Email (specification, breaking; supersedes Decision C and resolves Open Question 1):** unique case-insensitive `username` (3 to 30, `a-z 0-9 _ .`) and `email`; `login_identifier` dropped; register shows field-level errors and 409 carries `error.details` per field; `GET /api/auth/availability`; migration backfill and a small blocking Email_Prompt for accounts without an email; candidate search by Username prefix and exact Email, returning `id`, `full_name`, `username` only.
- **Decision N, login form (specification, breaking):** one "Username or email" input; request field `identifier`; the Backend classifies it; one generic 401; `user` shape `{ id, full_name, username, email, avatar_url }`.
- **Decision O, rate limiting (specification, breaking for the error shape; reverses Req 1.18):** Postgres-backed Rate_Limiter: login 5 failures per (identifier, IP) and 20 per IP in 15 minutes, reset on success; register and availability have their own limits; 429 `RATE_LIMITED` with `Retry-After` and `details.retry_after`; thresholds from environment variables, test overrides without `APP_ENV`; the Frontend shows a countdown. New Requirement 20. Amends Decision G: `error.details` also appears on a registration `CONFLICT` and on `RATE_LIMITED`.
- **Decision P, route guard (specification; resolves Open Question 5):** every `(app)` page is a Protected_Route, guarded by `frontend/proxy.ts`.
- **V9 Playwright criteria updated:** AUTH-E2E-SI-01 to -10 and SO-01 to -08 now use the "Username or email" form, the User_Menu_Trigger as the signed-in indicator, and the header sign-out; SO-03 and SO-05 are no longer pending; new IDs SI-11 (rate limit, Throwaway_Identifier), SI-12 (email shape), SO-09 (menu order), SO-10 (no Sidebar Log out or Profile). Req 1.19 to 1.42, 15.11, 15.15 to 15.19.

**Design changes**
- New section "V10 Design"; revised access function, role matrix, auth, users, boards, attachments (share scope), data model (User, Board, RateLimitAttempt), error table, testing strategy, and the Auth End-to-End Tests section. Properties 1, 2, 4, 5, 17, 21, 28, 34, 36 revised; 40 to 46 added. Next.js 16 `proxy.ts` is the guard file; `BaseMenu` and `@radix-ui/react-dropdown-menu` are added.

**Implementation changes**
- None yet. Tasks group 33 (33.1 to 33.27) carries the work. 33.26 (steering and guidelines sync) is done in this revision.

**Steering and guidelines (done in this revision)**
- `product.md` (guest and share-link rule, private-board rule, account and rate-limit rule), `data-model.md` (username and email, `share_token`, `RateLimitAttempt`, visibility example), `api-conventions.md` (429, `details` on 409 and 429, auth, share, profile, candidates), `backend.md` (categories, board access, auth and rate limit, `shared` blueprint), `frontend.md` (app header, login and register, route guard, shared view, sidebar), `structure.md` (`shared` domain, `BaseMenu`), `tech.md` (dropdown-menu package, rate-limit variables), `guidelines/backend.md` (envelope example brought to the current shape with 429; this was already out of date since V4), `guidelines/database.md`, `guidelines/frontend.md`.

### Breaking API changes
- `POST /api/auth/login`: request field `login_identifier` renamed to `identifier`; a value that fits neither shape returns 400 `VALIDATION_ERROR`.
- `POST /api/auth/register`: request fields `login_identifier` replaced by `username` and `email`; duplicate returns 409 `CONFLICT` with `error.details` per field.
- Register and login `user`: `login_identifier` removed, `username` and `email` added (`email` may be null for migrated accounts).
- `GET /api/boards` without a Token: 401 (was the public Boards). `GET /api/boards/{id}`, `/cards`, `/categories`, `/columns`, attachment URL, and card routes without a Token: 401 for public Boards too (were readable).
- Comment endpoints for a Guest on a public Board: 401 (was 403). Activity endpoints for a Guest: 401.
- `GET /api/boards/{id}/candidates`: matches Username prefix and exact Email (was `login_identifier`), returns `id`, `full_name`, `username`.
- New status and code: HTTP 429 `RATE_LIMITED` with a `Retry-After` header on login, register, and availability. `error.details` now also appears on a registration 409 and on 429.
- Signed_File_URL signature string gains a scope suffix, so URLs issued before deploy stop verifying (15-minute lifetime; the existing re-issue path covers them).
- Database: `users.login_identifier` dropped; `users.username`, `users.email`, `boards.share_token`, and `rate_limit_attempts` added (revision `b7d2e4f6a801`, reversible, data-losing in part on downgrade).
- Frontend: Log out and the profile entry leave the Sidebar; `/boards` and every `(app)` page redirect to `/login` without the cookie; `/shared/{token}` is new.

### Additive API changes
- `GET /api/auth/availability`, `GET|PATCH /api/auth/me`, `POST /api/auth/change-password`, `GET|POST|DELETE /api/boards/{id}/share`, `POST /api/boards/{id}/share/regenerate`, and the read-only `/api/shared/{token}` routes (board, cards, categories, card, attachment URL).

### Reason
- The product owner asked to stop exposing public Boards to anyone, to give every signed-in page one account menu, to split Username and Email with field-level errors, to rate limit sign-in and registration, and to bring the V9 e2e criteria in line with the result.

### Impact
- Requirements: 1, 3, 4, 6, 7, 8, 11, 12, 13, 14, 15, 17, new 18 to 20, Glossary, Decisions K to P, Open Questions. Design and tasks as above. Root `specs/v10/` holds the changed domains.
- Open (see `requirements.md` Open Questions 7 to 13): invalid Token on a server render; thresholds for register and availability; change-password rate limit; avatar upload; legacy identifiers that fit neither shape; candidate search by name; shared view assignee name and filters. Findings of the consistency check are listed in the V10 reply and in "Consistency check" below.

### Consistency check (V10)
- Resolved by agreed decisions, no action: Req 1.18 (rate limiting deferred) against Decision O; Open Questions 1, 3, 5, 6; Req 11.4 and the V9 Guest user story against Decision K and P.
- Amendment needing confirmation: Decision G said `error.details` appears only for `VALIDATION_ERROR`. Decisions M and O require it on a registration 409 and on 429. Recorded as an amendment in Decision G, Req 13.3, Property 36, and the steering.
- Deviation needing confirmation: the rate-limit e2e test uses a generated Throwaway_Identifier that belongs to no account, not a seeded throwaway account, because Req 1.38 and 15.15 forbid creating accounts in the suite and the limiter counts failures for unknown identifiers.
- Risk: the per-IP limit of 20 can be reached by repeated suite runs from one address inside 15 minutes (task 33.27).
- Old ticked tasks and the V8 to V9 snapshots keep the V9 wording by design.

### Round 2 within V10 - 2026-11-20
This is an amendment of V10, not a new version. V10 is specified but not implemented, so no V11 exists. Where this entry and the V10 entry above disagree, this entry wins; the V10 text is kept as history.

#### Changes
**Specification changes**
- **Decision Q, registration rate limiting deferred (amends Decision O; answers Open Question 8 for register):** `POST /api/auth/register` has no rate limit. The `register` scope and `RATE_LIMIT_REGISTER_MAX` are removed. Login limiting is unchanged. **Kept by the specifier, not ordered by the owner, and reversible:** the limiter on `GET /api/auth/availability` (default 60 per Client_IP per window, `RATE_LIMIT_AVAILABILITY_MAX`) stays because the endpoint is an enumeration vector. Req 20: RL-07 withdrawn (ID kept), RL-08, RL-10, RL-15 reworded, RL-18 added. "Register rate limiting deferred" is recorded as a gap in Decision Q and Open Question 14.
- **Decision R, avatar upload (amends Decision L; resolves Open Question 10):** the `https` avatar URL rule is withdrawn. The user uploads PNG, JPEG, or WebP, at most 2 MB; the type is read from the leading bytes; the file is stored under a generated name; replacing or removing deletes the old file after commit. Endpoints `POST` and `DELETE /api/auth/me/avatar` and the signature-checked `GET /api/auth/avatars/{user_id}/file`. `avatar_url` is a Signed_File_URL (scope `avatar`) built by the Decision D signing code and file store, issued only in responses to signed-in requests; a Guest on a Share_Link sees initials. `User.avatar_url` becomes `avatar_path`; `PATCH /api/auth/me` and the admin user endpoints reject `avatar_url`. Req 19.8 to 19.10 reworded, 19.18 to 19.33 added, 1.6 reworded; Req 15.20 to 15.22 (API tests, component tests, no avatar test in the auth e2e suite).
- **Decision S, Email shown to staff (reverses part of Decision M; resolves Open Question 12; see Decision M):** `GET /api/boards/{id}/candidates` returns `id`, `full_name`, `username`, and `email`, and matches `full_name`, `username` by prefix, and `email` by exact value, case-insensitively; only the Board_Owner, a Manager, and an Admin may call it. The assignee popover lists the Board's members through `GET /api/boards/{id}/members?include=email` (403 without Board_Staff_Access) and stays hidden from a Member. The Email appears in those two places only, never in Comments, Activity_Log rows, Notifications, the Shared_View, the Sidebar, or a Member-visible list. Req 3.25 reworded, 3.30 to 3.32 added, 4.33 reworded, 15.24.
- **Decision T, invalid Token redirects on every request (amends Decision P; resolves Open Question 7):** `frontend/proxy.ts` rejects a cookie that is not a decodable, unexpired Token and removes it on the redirect; a server render that gets a Backend 401 redirects to the route handler `/session-expired`, which removes the cookie and redirects to `/login` with a Safe_Return_Path in `next`; client-side 401 handling is unchanged; `/login`, `/register`, and `/shared/{token}` ignore a stale cookie, and shared routes treat an invalid Bearer Token as no Token. New Playwright criteria AUTH-E2E-SO-11 (cookie `bogus`, visit `/boards`, expect the login page and the cookie removed) and SO-12 (well-formed but forged Token). Req 1.34 and 1.37 reworded, 1.55 to 1.62 added, 14.28, 15.23, 18.24.
- **Open Questions:** 7, 8 (for register), 10, and 12 marked resolved with a pointer; 14 (availability limiter kept), 15 (avatar visibility), and 16 (Email exposure through name search) added; the others are untouched.

**Design changes**
- New section "Round 2 within V10"; revised auth, users, attachments (avatar signing scope), data model (`avatar_path`, no `register` scope), routing (`proxy.ts`, `/session-expired`), testing strategy, and the auth e2e section. Properties 47 to 49 added (avatar image type and size, safe return path and usable Token, Email exposure); Property 46 (profile update rules) now covers the avatar field being rejected on `PATCH`.

**Implementation changes**
- None. Tasks 33.5, 33.16, 33.18, and 33.19 were edited in place; new tasks 33.28 to 33.40 (no existing ID renumbered).

**Steering and guidelines (done in this revision)**
- `product.md` (registration deferred, avatar upload, Email shown to staff), `data-model.md` (`avatar_path`), `api-conventions.md` (candidates with `email`, `include=email`, avatar endpoints), `backend.md` (register not limited, avatar signing), `frontend.md` (Profile avatar, member search and Email, route guard and `/session-expired`), `tech.md` (rate-limit variables without a register value), `guidelines/backend.md` (content-based upload rule), `guidelines/database.md` (`avatar_path`), `guidelines/frontend.md` (Email rendered by two components, safe return path).
- Root `specs/v10/` snapshot files updated: `00-OVERVIEW`, `01-AUTH`, `03-BOARDS`, `04-CARDS`, `13-API-CONVENTIONS`, `14-NON-FUNCTIONAL`, `15-TESTING`, `18-SHARE-LINKS`, `19-APP-HEADER-PROFILE`, `20-RATE-LIMITING`.

#### Breaking changes (relative to the V10 text above; nothing is released)
- `RATE_LIMIT_REGISTER_MAX` and the `register` limiter scope no longer exist; register never returns 429.
- `GET /api/boards/{id}/candidates` now returns `email` (the V10 text said it never would).
- `avatar_url` is no longer accepted on `PATCH /api/auth/me` or on the admin `POST /api/users` and `PATCH /api/users/{id}` (400); the `users.avatar_url` column becomes `avatar_path` (migration part 4 of revision `b7d2e4f6a801`, which drops existing URL values).
- New Token-free route: `GET /api/auth/avatars/{user_id}/file` (signature only).

#### Reason
- The product owner answered Open Questions 7, 8, 10, and 12: do not rate limit registration yet; let users upload an avatar; show full name and Email in the member search and assignee picker; send an invalid Token to `/login` on every request.

#### Impact
- Requirements: 1, 3, 4, 13, 14, 15, 18, 19, 20, Glossary, Decisions Q to T (L, M, O, P annotated), Open Questions 7, 8, 10, 12, 14 to 16. Design: sections above. Tasks: 33.5, 33.16, 33.18, 33.19 edited; 33.28 to 33.40 added; dependency graph waves 79 to 83.

#### Consistency check (round 2)
- Resolved by the owner's answers, no action: Open Questions 7, 8 (register), 10, 12; the V10 statements that register has its own limit, that avatar is an `https` URL, and that candidates never return `email` are superseded and marked "amended in V10 round 2" in the Decisions Log.
- Decision needing confirmation: the availability limiter was kept by the specifier (Open Question 14). Without a register limit, the 409 on `POST /api/auth/register` answers the same question, so the limiter alone does not stop enumeration.
- Decision needing confirmation: avatar images are visible only to their owner and to Admins, because only the `user` shape carries `avatar_url`; Comments, Board members, and Cards show initials (Open Question 15).
- Risk: name search plus Email in the response lets a Board_Owner read the Email of any account by searching short names (Open Question 16; recommendation: minimum search length 2).
- Deviation from the owner's wording: the avatar endpoints sit under `/api/auth/me/avatar` (next to `GET|PATCH /api/auth/me`), not `/api/users/me/avatar`; the owner gave the path as an example.
- Ordering: checkpoint 33.27 sits before the round 2 tasks (33.28 to 33.38) in the file, and 33.40 re-runs the checks; 33.27 also mentions the suite, which gains SO-11 and SO-12 only in 33.38.
- Risk: avatar files keep EXIF data (no re-encoding); Werkzeug buffers the multipart body, so the reverse proxy must cap it near 3 MB. A file URL works for 15 minutes without a Token once issued (the Decision D trade-off).
- Old ticked tasks and the V8 to V9 snapshots keep their earlier wording by design.

### Round 3 within V10 - 2026-11-21
This is an amendment of V10, not a new version. V10 stays unimplemented in the specification sense; where this entry and earlier V10 text disagree, this entry wins.
#### Changes
**Specification changes**
- **Decision U (amends R; resolves Open Question 15):** avatar routes move to `POST` and `DELETE /api/users/me/avatar` and `GET /api/users/{user_id}/avatar/file` (the round 2 `/api/auth/me/avatar` paths are gone from every document). `avatar_url` (signed, 15 minutes, signed-in viewers only) is added as `author_avatar_url` (Comments, Replies), `avatar_url` (members, candidates), and `assignee_avatar_url` plus `assignee_name` (Cards). The Frontend shows the picture or initials from `full_name` in Comments, Sidebar Team members, member search, assignee popover, board Card, and Card modal chip. Shared_View: initials only, because a share-scoped signature would need a new scope, a shared field, and a file-route branch (simpler option chosen). No extra query: the existing batched lookups also select `avatar_path`.
- **Decision V (amends M; resolves Open Question 11):** the app is not deployed, so the V10 migration resets local data (guarded by `APP_ENV`), with no `login_identifier` backfill, no sanitized Username, no Email_Prompt, and no Email save on `PATCH /api/auth/me`. The seed gives every user `username`, `email`, `full_name`. Criteria 1.52, 1.53, 19.13, 19.14 withdrawn (IDs kept); 1.63, 1.64 added; the risk "the migration drops `avatar_url` values" removed.
- **Decision W (amends O and S; resolves Open Questions 9, 13, 14, 16, 17, 18):** `POST /api/auth/change-password` limited under scope `change_password` (`RATE_LIMIT_CHANGE_PASSWORD_MAX`, default 5); candidate search needs at least 2 characters; Shared_View shows the assignee `full_name` only; availability limiter and open registration kept (enumeration through the register 409 is an accepted gap); EXIF retention, multipart buffering, avatar URL churn, and initials-only avatars beside activity rows and Notifications accepted.
**Design changes**
- Design section "Round 3 within V10"; migration section rewritten as a reset; Property 45 (reset) and 44, 46, 49 revised; Property 50 added.
**Task changes**
- 33.1, 33.2, 33.7, 33.18, 33.28 to 33.30 reworded; 33.27 ordering note (its suite run precedes SO-11 and SO-12; the final run is 33.48); new 33.41 to 33.48 in waves 84 to 86. No ID renumbered; V11 (group 34, waves 90 to 94) untouched.
**Steering and guidelines**
- `product.md`, `data-model.md`, `api-conventions.md`, `backend.md`, `frontend.md`, `tech.md`, `guidelines/backend.md`, `guidelines/database.md`, `guidelines/frontend.md`.
**Implementation changes**
- None made in this revision (documentation only).
**Breaking changes**
- Avatar route paths differ from round 2 (nothing implemented, no client affected); `user.email` becomes non-null.
#### Reason
- Owner answers: avatars under `/api/users`, avatars visible where people act, local-only development, and agreement with the recommendations for Open Questions 9, 13, 14 to 18.
#### Impact
- Requirements: 1.6, 1.52, 1.53, 1.63, 1.64, 3.25, 3.30, 3.32, 4.33, 7.21, 7.22, 15.25 to 15.27, 17.11, 18.11, 18.25, 19.11 to 19.16, 19.26, 19.34 to 19.40, 20.10, 20.12, 20.19 to 20.23, Decisions U to W, Open Questions 9, 11, 13 to 18. Snapshots: `specs/v10/` domains 00, 01, 03, 04, 07, 12, 15, 17, 18, 19, 20.
- Still open: Open Questions 19 to 21 (V11).
#### Consistency check (round 3)
- Resolved: the round 2 deviation note (avatar paths under `/api/auth`) is superseded by Decision U; checkpoint 33.27 vs SO-11 and SO-12 ordering (33.27 now says SO-11 and SO-12 are first run in 33.48).
- Open for the owner: tasks 33.1, 33.3, 33.5 and others are ticked `[x]` while design.md says nothing is implemented; if code exists, 33.1 and 33.7 describe a migration and a Profile that the reset and Email changes alter, and 33.2 is still unticked.
- Open for the owner: requirement 19.38 lists Home tile member avatars but Decision U's list does not name them.

## V11 - 2026-11-21
This is a new version: V10 stays as written, and V11 is a separate request. It follows V10 in this file; V10 round 3 is recorded above this heading.

### Changes
**Specification changes**
- **Decision X, RevoTask logo and favicon:** the owner's `favicon.ico`, `logo-revo.svg` (square mark, `viewBox` 480 by 480), and `logo-text-revo.svg` (mark plus wordmark, `viewBox` 540 by 165) replace the placeholder mark. Favicon: `frontend/app/favicon.ico` (Next.js file convention, no manual `<link>`). Logos: `frontend/public/brand/`, referenced as `/brand/...` only inside the new shared `BrandLogo` (variants `mark` and `full`), rendered with `next/image` and `unoptimized` (Next.js does not optimize SVG), alt text `RevoTask` (empty where a labelled control or visible name is beside it), `width` and `height` equal to the `viewBox`, display never above the `viewBox`.
- New Requirement 21 (BRAND-01 to BRAND-17), Glossary terms (Brand_Assets, Logo_Mark, Logo_Full, BrandLogo, Embedded_Raster, Favicon_File), Open Questions 19 to 21. Requirement 14 criteria 16, 19, and 26 reworded (the Sidebar toggle shows Logo_Full expanded and Logo_Mark collapsed; the brand is an image, not a 16 pixel text). Requirement 15 criterion 28 added (branding checks). No requirement renumbered.
- Only `favicon.ico` is supplied, so no `app/icon`, `app/apple-icon`, or `app/manifest` in V11 (Open Question 20, follow-up).
- **Finding recorded (Open Question 19):** both SVG files are rasters: each wraps a base64 PNG (640 by 640 and 720 by 220 pixels, 8-bit RGB, no alpha; about 13 KB per file). They are not scalable beyond their `viewBox`, cannot be recoloured with CSS, and have an opaque background (Open Question 21: shown on a `bg-surface-raised` tile on the brand panel). The owner's note gave the embedded size as 480 and 540 pixels; those are the `viewBox` widths, and the raster is 640 and 720 pixels wide. The cap uses the `viewBox` values (the smaller, safer numbers).

**Design changes**
- New section "V11 Design: Branding, Logo and Favicon (Decision X)": file moves, favicon convention, `BrandLogo`, the `unoptimized` choice and alternatives, where the logo appears, metadata, the raster finding, testing strategy (examples, no new Property), risks. Components table: `BrandLogo` added, `AuthSplitLayout` row updated.

**Implementation changes**
- None. Task group 34 (34.1 to 34.7) carries the work; 34.6 (steering and guidelines sync) is done in this revision. Wave ids 90 to 94 are used so ids 84 to 89 stay free for V10 round 3.
- Nothing is moved yet: the three files are still untracked in `frontend/images/`.

**Steering and guidelines (done in this revision)**
- `.kiro/steering/frontend.md` (brand rule), `structure.md` (`BrandLogo` in `components/shared/`, brand folders), `tech.md` (Next.js 16 favicon, `next/image` with `unoptimized`, no `priority`), `guidelines/frontend.md` (logo only through `BrandLogo`). `product.md`, `data-model.md`, `api-conventions.md`, and `backend.md` are unchanged: nothing there is affected.

### Breaking changes
- None for the API. Visible: the Sidebar text "RevoTask" becomes an image, so any test that looks for that text in the Sidebar changes (task 34.4).

### Reason
- The product owner supplied the real logo and favicon in `frontend/images/` and asked for them to be placed where Next.js expects them.

### Impact
- Requirements: Decision X, Glossary, Open Questions 19 to 21, Requirement 21, 14.16, 14.19, 14.26, 15.28. Design: V11 section and the components table. Tasks: group 34. Root `specs/v11/` holds `00-OVERVIEW`, `14-NON-FUNCTIONAL`, `15-TESTING`, and the new `21-BRANDING`.

### Consistency check (V11)
- Resolved: Req 14.16 and 14.19 (name beside the mark, text name) against Requirement 21; both reworded. Req 14.26 (brand at 16 pixels semibold) no longer applies to an image and is reworded.
- Deviation to confirm: the owner's size note (480 and 540 pixel raster) differs from the measured raster (640 and 720 pixels); the `viewBox` numbers are used as the display cap.
- Risk: the raster is opaque RGB, so the brand panel needs a surface tile (Open Question 21); the tile colour is chosen after the files are viewed in task 34.3.
- Risk: the Sidebar toggle's accessible name stays "Collapse sidebar" or "Expand sidebar" because the image inside is decorative; the product name reaches assistive technology through the header link and the page title.
- Risk: only `favicon.ico` exists, so iOS home-screen and manifest icons are absent (Open Question 20).
- Overlap: group 34 and V10 round 3 may both edit `Sidebar.tsx`, `AuthSplitLayout.tsx`, and `AppHeader.tsx` (round 3 adds avatars to member rows); they touch different parts but merge in landing order.
- Not claimed: nothing in V11 is implemented, and V10 is still unimplemented (group 33).

## V12 - 2026-11-21
This is a new version: V11 stays as written (branding, Decision X, group 34 untouched). V12 is a documentation-only revision: nothing under `frontend/` or `backend/` was edited, and nothing in V12 is implemented.
### Changes
**Specification changes**
- **Decision Y, private-only Boards (reverses Decision A, the Guest-clarification half of Decision K, Requirement 11 criteria 1 to 3, 6, 11 to 13):** `Board.visibility` and every visibility icon, toggle, filter, and listing rule are removed. A Board is visible to its owner, its Board_Members (Member or Supervisor), Managers, and Admins; everyone else gets 403 (401 without a Token). Home lists owned and member Boards; Manager and Admin see all. A Manager or an Admin is never a Board_Member. Direct add and the candidate search are Manager and Admin only and list only Member and Supervisor accounts. A Card's assignee must be the owner or a Board_Member. New Requirement 22 (ACC-01 to ACC-18).
- **Decision Z, Public_Link (amends Decision K; Requirement 18 criteria 2 to 7, 17, 21, 22):** the V10 Share_Link is renamed Public_Link; the column `Board.share_token`, the `/api/boards/{id}/share...` and `/api/shared/...` routes, and the `/shared/{token}` page keep their names (no rename migration). Only a Manager or an Admin manages it (the owner gets 403); read-only for every visitor including signed-in users without access; no comments or activity. New Requirement 23 (PUB-01 to PUB-12) with one test criterion per write action (comment, edit field, attachment, subtask, archive, delete).
- **Decision AA, Invite_Link and Join_Requests:** new nullable unique `Board.invite_token`, new table `BoardJoinRequest`, new endpoints under `/api/boards/{id}/invite`, `/api/invite/{token}`, `/api/boards/{id}/join-requests`, and `/api/join-requests/{id}`; only a Manager or an Admin decides; the owner sees the pending list. New Requirement 24 (INV-01 to INV-26).
- **Decision AB, Card modal Auto_Save (supersedes the draft model of Decision I and the "wait for Save changes" sentence attributed to Decision J; Requirement 4 criteria 21, 30, 32, 35, 43):** no Save changes button; each field, Subtask, and Attachment saves by its own request with a visible state; one `card.updated` row per saved request; footer Archive and Delete; last write wins. New Requirement 25 (SAVE-01 to SAVE-16).
- **Decision AC, deletes:** an author can delete their own Comment or Reply (confirm modal; reply decrements `reply_count`; a top-level Comment takes its Replies; `comment.deleted` row without text); Attachment removal asks in a modal. `BaseConfirm` gets popover and modal forms, with the table of which action uses which. New Requirement 26 (DEL-01 to DEL-11); Requirement 4 criterion 44 amended.
- **Decision AD, Subtasks and progress (clarifies Decision 2):** exact Subtask matrix (Requirement 4 criteria 12 to 14 already allowed the Assigned_Member everything, so no right is added); `progress` becomes derived and read-only (Requirement 16 criteria 1 and 2 amended). New Requirement 27 (SUB-01 to SUB-09).
- **Decision AE, Inbox:** rows are links; three new Notification types; Notification gains `board_id`, `actor_id`, `join_request_id`, nullable `card_id`; three partial unique indexes replace the composite unique constraint. New Requirement 28 (INB-01 to INB-11); Requirement 9 criteria 1 and 6 labelled.
- **Decision AF, Profile layout:** two columns from 960 pixels. New Requirement 29 (PRO-01 to PRO-04).
- Glossary: Guest, Board, Share_Token, Public_Link (replaces Share_Link), Shared_View, Board_Owner, Board_Member (replaces BoardMember), Board_Access, Board_Staff_Access, Notification, Inbox, App_Header, Protected_Route, Safe_Return_Path, Test_Account changed; Invite_Link, Join_Request, Auto_Save, Derived_Progress added; Public Board and Private Board terms removed. Decision T amended (`/invite/{token}` is guarded and a Safe_Return_Path prefix). Open Question 3 obsolete; Open Questions 22 to 28 added.
- E2E: Requirement 1 criteria 65 to 72 (`AUTH-E2E-V12-01` to `-08`) added to the V9 and V10 suite, with labels on criteria 31, 33, 37, 59, and 64; the suite stays read-only. Requirement 15 criteria 29 to 35 added. Requirement 16, 2, 3, 4, 7, 8, 9, 11, 12, 15, 18, and 19 criteria carry V12 labels; no requirement renumbered.
**Design changes**
- New section "V12 Design" in `design.md`: access function and the V12 access matrix (role by action by relationship, plus Public_Link viewer and Invite flow), data model changes, notification deduplication options and the chosen partial indexes, endpoint table with statuses and error codes, join-request algorithms, Public_Link changes, `useFieldSave` and the close handling, `BaseConfirm` variants table, comment deletion and how it fits the "no `deleted_at`" and append-only rules, Subtask matrix and `derive_progress`, Inbox navigation, Invite modal and page, Profile layout, migration and seed, breaking changes, Properties 51 to 58, testing strategy, consistency findings, risks. Older sections labelled "Superseded in V12" (access function, role matrix, Share links, Auth E2E) and three Data Models rows annotated.
**Implementation changes**
- None. New task group 35 (35.1 to 35.30) with explicit rework tasks for ticked groups 2 to 5, 8 to 10, 13, 16 to 18, 26 to 28, and 33; ticked tasks stay ticked. Task 22.1 reworded (no stored `progress`). Wave ids 95 to 101.
**Steering and guidelines (done in this revision)**
- `.kiro/steering/product.md` (guest and access rules rewritten, invite and join request rule, comment delete rule, Subtask and progress rule), `data-model.md` (no `visibility`, `invite_token`, `BoardJoinRequest`, Notification rule restated with partial indexes, BoardMember never Manager or Admin, comment hard delete, `progress` derived), `api-conventions.md` (V12 endpoints, public-link and candidate roles), `backend.md` (access rule, `invites` blueprint, comment delete and progress, Public_Link roles), `frontend.md` (footer, chips, auto-save, Inbox, Subtask, Profile, header, route guard, shared view, Decision J clause), `tech.md` (no new dependency, partial indexes), `structure.md` (`invites` domain, `BaseConfirm`); `guidelines/backend.md`, `database.md`, `frontend.md`.
### Breaking changes
- API: `visibility` removed from Board requests and responses (a posted `visibility` is 400); `GET /api/boards` shrinks for Member and Supervisor; the four `/api/boards/{id}/share` endpoints answer 403 to the Board_Owner; `POST /api/boards/{id}/members` and `GET /api/boards/{id}/candidates` answer 403 to the Board_Owner and reject Manager and Admin accounts (400); `assignee_id` must be the owner or a Board_Member (400); a posted `progress` is 400; `GET /api/notifications` rows and types change.
- Data: `boards.visibility` dropped; `boards.invite_token` and `board_join_requests` added; `notifications.card_id` nullable, three columns and three partial unique indexes added; local data reset (no backfill; aborts outside `development` and `testing`).
- Frontend: no Save changes button, no "unsaved changes" prompt, no visibility icons, "Share" renamed "Public link" and limited to Manager and Admin, new `/invite/{token}` route, `?card=` and `?invite=` parameters, Safe_Return_Path gains `/invite/`.
- Not breaking: routes and column `/shared/{token}`, `share_token`; PATCH body of cards.
### Reason
- The product owner approved private-only Boards with a staff-managed Public_Link and an invite flow, per-field auto-save, comment deletion, derived progress, clickable Inbox rows, and a wider Profile page.
### Impact
- Requirements: Decisions Y to AF; Requirements 22 to 29; Glossary; Open Questions 3 and 22 to 28; labels on Requirements 1, 2, 3, 4, 7, 8, 9, 11, 12, 15, 16, 18, 19; Requirement 1 criteria 65 to 72; Requirement 15 criteria 29 to 35.
- Design: "V12 Design" section and Properties 51 to 58. Tasks: group 35. Root `specs/v12/` holds `00-OVERVIEW`, `01-AUTH`, `02-ROLES`, `03-BOARDS`, `04-CARDS`, `07-COMMENTS`, `08-ACTIVITY-LOG`, `09-NOTIFICATIONS`, `11-VISIBILITY`, `13-API-CONVENTIONS`, `15-TESTING`, `18-SHARE-LINKS`, `19-APP-HEADER-PROFILE`, and the new domain `22-INVITES-JOIN-REQUESTS`.
### Consistency check (V12)
Contradictions and gaps found; none was resolved silently. Each states what V12 kept.
- **Brief versus Requirement 4 criteria 12 to 14:** the brief says Decision 2 is reversed so a Member can toggle Subtasks on assigned Cards; the spec already allowed the Assigned_Member to add, toggle, reorder, and delete Subtasks. Kept: the existing rules, stated as a matrix and tested. If the code is stricter, task 35.15 fixes the code.
- **Rejected requester link:** board notifications open `/boards/{id}`, but a rejected requester has no access; kept `/boards` for `board_join_rejected` (Open Question 27).
- **Owner and removal:** the owner may add only through requests but may still remove members (Open Question 22). **Owner and assignment:** the owner may be assigned but is not a Board_Member, so the members endpoint returns the owner first (Open Question 23).
- **Notification uniqueness:** the V2 unique constraint would stop deduplicating once `card_id` can be null; replaced by three partial unique indexes (design, "Notification deduplication"), with the COALESCE and `NULLS NOT DISTINCT` options recorded.
- **Decision J text:** the "attachment changes wait for Save changes" clause is in the steering and Requirement 4 criterion 43, not in Decision J's table text; both are superseded and Decision J is annotated.
- **Requirement 16 criterion 1** stored `progress` as a stretch column; superseded (derived). No manual progress editing exists in the spec or tasks, so nothing else to remove; task 22.1 reworded.
- **Requirement 4 criterion 44** (popover confirm for every destructive action) conflicts with the modal required for Attachment removal; amended for Attachments and Comments only.
- **Route guard:** Protected_Route and Safe_Return_Path listed `/boards`, `/profile`, `/admin`; `/invite/` added. TOK-04 (public pages ignore a stale cookie) does not include `/invite/{token}`, which is guarded by design.
- **Req 18 criteria 9 and 15** still say "public or private Board"; annotated, harmless.
- **Requirement 11 title and story** still say "Visibility"; kept for stable references, with a V12 note.
- **Test_Account assumption** ("a Member") now also needs membership of a seeded Board; E2E criteria 69 and 70 skip with a named reason if Home lists no Board.
- **Admin cannot comment (Decision B)** so Admin can never delete a Comment; consistent, recorded in the matrix.
- Not claimed: nothing in V12 is implemented; the earlier open items (group 33 partly unticked) are unchanged.
### Open for the owner
- Open Questions 22 to 28 (owner removal, owner in Team members, join request spam and Email for approvers, comment creation activity, role-change cleanup, rejected requester destination, resolved note).
- Whether a data-writing Playwright project for the invite flow is wanted (task 35.28 leaves it as a manual check).
### Round 2 within V12 - 2026-11-21
Same version: V12 is specified but not implemented, so this amends it and creates no V13. Documentation only: nothing under `frontend/` or `backend/` was edited, V11 (group 34, `specs/v11/`) is untouched, and no earlier version folder changed.
#### Changes
**Specification changes**
- **Open Question 22 (owner removing members), resolved by the owner:** the Board_Owner keeps the right to remove members (ACC-10, Requirement 3 criteria 12 and 14 unchanged).
- **Open Question 23 (owner in Team members), resolved by the owner:** the Sidebar Team members list shows the owner first, tagged "Owner", with no remove action on that row. New ACC-19 (Frontend) and ACC-20 (`DELETE` of an owner who is not a BoardMember is 404); ACC-13 says the owner is listed once even when also a BoardMember; Requirement 3 criterion 24 and Requirement 4 criterion 33 carry round 2 labels; the member search keeps excluding the owner (ACC-09) and the assignee popover lists the owner first.
- **Open Question 24 (join request spam and Email), resolved by the owner:** no cooldown and no limit (INV-12 stands). The pending join-request list now shows each requester's Email with the full name and avatar or initials, to the Board_Owner, a Manager, and an Admin. This **reverses** the first V12 choice "no Email in the pending list" and amends Decisions M and S (labels on both rows; Decision S now has three staff-only places) and Decision AA and Y. INV-13 (response `user` gains `email`), INV-19 (modal row), EML-02 (the exposure statement: candidates, assignee popover, pending list; never Comments, Activity_Log rows, the Public_Link and Shared_View, Notification rows or text, Sidebar member rows, or any list a Member can read) reworded; INV-27 (Frontend shows it only there) and INV-28 (create and decision responses, Notifications, and activity metadata carry no Email; the Email is read through a join and not stored on the request) added; V12-T2 reworded.
- **Open Questions 25, 26, 27, resolved by default (the owner did not answer; the recommendation already in the document applies and each question says so):** no `comment.created` Activity_Log row (25); a demoted Manager has no Board access until added or approved (26); a rejected requester's Inbox row opens `/boards` (27). Open Question 28 was already resolved by Decision Z and is unchanged.
- **E2E (owner's answer 4):** no data-writing Playwright test or project for the invite, join, or approve flow in V12. Requirement 1 criteria 65 to 72 and the read-only auth suite stay. New Requirement 15 criteria 36 (`pytest` for round 2), 37 (component tests), 38 (V12-M1, manual verification checklist), and 39 (V12-D1, "automated invite-flow end-to-end test" explicitly deferred).
**Design changes**
- `design.md`: Property 49 extended (join-requests `email` for the three roles, none elsewhere); endpoint rows for members and join-requests; join-request repository note (one join, no copy of the Email); Invite modal row; Sidebar component row; access matrix row; testing strategy (no data-writing Playwright project); new section "Manual verification checklist (V12 invite flow)"; consistency items 15 to 17; risks; "Round 2 within V12 Revision Notes".
**Implementation changes**
- None. `tasks.md`: 35.3, 35.9, 35.10, 35.19, 35.21, 35.28, 35.29, and 35.30 reworded; 35.31 (manual checklist), 35.32 (Backend tests), and 35.33 (component tests) added and put in the wave list (wave 100). Task 35.28 no longer mentions a Playwright project for the invite flow.
**Steering and guidelines**
- `.kiro/steering/product.md` (three places for the Email, owner row), `data-model.md` (no Email copy on `BoardJoinRequest`, owner union in the members list), `api-conventions.md` (join-requests shape, members endpoint, owner delete 404), `backend.md`, `frontend.md` (owner row, Invite modal Email), `tech.md` (read-only Playwright, manual invite checklist); `guidelines/frontend.md`, `database.md`, `backend.md` (the three Email places).
**Root `specs/v12/`**
- `00-OVERVIEW`, `03-BOARDS`, `04-CARDS`, `13-API-CONVENTIONS`, `15-TESTING`, `22-INVITES-JOIN-REQUESTS` updated; every numbered criterion in `specs/v12/` is identical to the line in `requirements.md` (checked by script).
#### Reason
- The owner answered V12 Open Questions 22 to 24 and the question on a data-writing invite test; the unanswered questions take their written recommendations so that nothing stays silently open.
#### Impact
- Requirements: Open Questions 22 to 28; Decisions M, S, Y, AA; Requirements 3 (24, 31), 4 (33), 15 (30, 36 to 39), 22 (13, 19, 20), 24 (13, 19, 27, 28).
- Design: Property 49, V12 endpoints, Invite modal, Sidebar, testing strategy, checklist, consistency check. Tasks: 35.3, 35.9, 35.10, 35.19, 35.21, 35.28, 35.30 to 35.33.
- Breaking (still unimplemented): `GET /api/boards/{id}/join-requests` rows gain `user.email` (additive for a client that ignores it); `DELETE /api/boards/{id}/members/{owner_id}` is 404.
#### Consistency check (round 2)
Contradictions and gaps found; none was resolved silently.
- **Reversal of an earlier V12 choice:** "no Email in the pending list" (Decision S, Open Question 24, INV-13, the first V12 steering text) is reversed by the owner. All places that stated it were amended and are listed above. Side effect to confirm: the Board_Owner (a Supervisor) now reads requesters' Emails, although the owner cannot call the candidate search (ACC-08).
- **Owner who is also a BoardMember:** the owner row has no remove button, so a BoardMember row of the same user cannot be removed from the Sidebar; only the API (Manager or Admin) removes it. Not resolved; reported (design consistency item 16).
- **ACC-20 is new behaviour:** the V12 text did not say what `DELETE /api/boards/{id}/members/{owner_id}` returns for the owner. 404 was chosen because the owner is not a BoardMember; the owner can confirm or ask for 400.
- **Requirement 3 criterion 24 and ACC-16** (written before round 2) still read "each member carries a remove button"; amended by a label pointing to ACC-19, not rewritten.
- **The V12 changelog "Open for the owner" lines** (Open Questions 22 to 28 and the Playwright project) are historical and stay; this entry supersedes them.
- Not claimed: nothing in V12 is implemented.
#### Still open
- Open Questions 19 to 21 (V11 logo files and icons) are unchanged and not part of this round.
- Nothing from 22 to 28 is open; 25 to 27 were resolved by default and can be reversed by the owner.

## V13 - 2026-11-21
### Requirements changes
- New Requirements 30 (role tag), 31 (control sizes), 32 (document titles); Decisions AG to AI; BRAND-11 labelled superseded. Open Questions 29 and 30 (default answers).
### Design changes
- `design.md`: "V13 design" (role in the members payload, `RoleTag`, control sizes, `lib/titles.ts`, `generateMetadata`, panel and Card modal title effects), Properties 59 and 60.
### Implementation changes
- None yet. `tasks.md`: group 36 (36.1 to 36.6) and waves 102 and 103.
### Impact
- One additive API field (`role` on members); no data change. Consistency check: V12 criterion ACC-13 lists the member fields without `role` (amended by ROLE-01, not rewritten); V12 steering says the picker shows "full name, Username, Email" (extended by the tag); PRO-02 and the V12 build use the `lg` class for the 960 pixel breakpoint, which matches.
- Finding: the Activity_Log `metadata` is implemented in the Frontend (`describeActivity`); the Next.js page `metadata` is only a static title with the suffix "· RevoTask" on six pages and has nothing for a Board or a panel (the gap Requirement 32 closes).

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
- **Specification:** Decisions AO (RevoTask renamed to RevoBoard, new logo/favicon from a Stitch-supplied reference image) and AP (`--accent` changed from orange `#f4a340` to teal `#006b5f`), in `specs/v15/00-OVERVIEW.md`. `specs/v15/21-BRANDING.md` reworks BRAND-06, 07, 08, 10, 11 of Requirement 21 for the new brand strings and viewBox sizes (203 by 203 for the mark, 704 by 121 for the full lockup, both up from the V11 sizes).
- **Design reference:** a full-app Stitch design ("Kanban Task Management App") is recorded as a visual/spacing reference only; `specs/v1/` to `specs/v14/` remain authoritative for behaviour, scope, and data. Recorded exclusions (no spec basis, not implemented): card `estimate` field, card `status` dropdown, comment `@mention`/emoji/attachment, mobile modal bookmark/share and "Done" button, Activity panel "Live Stream"/online-user-count/"Export Audit Trail", and a workspace-wide Categories screen with KPI tiles/import/automated rules.
- **Implementation:** new Brand_Assets at the unchanged V11 paths (`frontend/app/favicon.ico`, `frontend/public/brand/logo-revo.svg`, `frontend/public/brand/logo-text-revo.svg`); `RevoTask` to `RevoBoard` string replacement in `frontend/app/layout.tsx`, `frontend/components/shell/AppHeader.tsx`, `frontend/components/shell/Sidebar.tsx`, `frontend/components/shared/BrandLogo.tsx` (also its `width`/`height` literals), `frontend/lib/titles.ts`, and the three branding/titles test files; `--accent` and `--logo-w-mark`/`--logo-w-full` updated in `frontend/styles/tokens.css`.
- **Bug fix (pre-emptive):** `frontend/tests/titles.test.ts`'s property-based length check was hardcoded to `<= 71`, derived from `"RevoTask".length` (8); since `"RevoBoard"` is 9 characters, this is corrected to `<= 72` so the test does not start failing on long names.
### Reason
- The owner reviewed the Stitch redesign gap-analysis report (`design/stitch-redesign-report.md`) and chose to adopt its brand (renamed RevoBoard) and a real teal accent, while keeping the specs as the source of truth for everything Stitch invented without a spec basis.
### Impact
- Frontend only; no API, data model, or permission change. `v1/` to `v14/` are unchanged except where `v15/21-BRANDING` supersedes wording that named "RevoTask" or the old accent value. Full list of touched files in `specs/CHANGELOG.md`, V15.

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
- **Specification:** `specs/v17/` holds `00-OVERVIEW` (Decisions AY to BJ, the supersession table, exclusions, phases, glossary, Open Questions 46 to 73) and one file per requirement group: `32-UI-FIXES` (Requirement 45), `33-PATHS-AND-NAVIGATION` (46, 47), `34-BOARD-SLUG-AND-404` (48), `35-COLUMNS-AND-BOARD-VIEWS` (49, 50), `36-DASHBOARD-AND-MY-TASKS` (51, 52), `37-USERS-AND-PROFILE` (53, 54), `38-SHARE-AND-CARD-MODAL` (55, 56), `39-NOTIFICATIONS` (57, 58), `40-ACCOUNT-ACTIVATION-EMAIL` (59), and `41-VERIFICATION` (the test plan and the owner's visual review checklist, `V17-T01` to `V17-T14`, not a numbered requirement). `.kiro/specs/requirements.md` gets Requirements 45 to 59, Decisions AY to BJ, the glossary terms, Open Questions 46 to 67, and "Superseded by ..., V17" notes in the places they replace (Requirements 1, 2, 3, 9, 19, 23, 24, 26, 29, 33, 39, 42, 43). Earlier text is kept.
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
