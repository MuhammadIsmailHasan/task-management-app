# Brief for Kiro: write the V17 specs

## Your task

Write the V17 specification for RevoBoard. Write specs only: do not change application code, migrations, tests, or deploy files.

Follow the conventions of the existing specs exactly:

- Read first: `.kiro/specs/requirements.md`, `.kiro/specs/design.md`, `.kiro/specs/tasks.md`, `.kiro/specs/CHANGELOG.md`, `.kiro/steering/*.md`, and every file in `specs/v16/`.
- Use EARS acceptance criteria ("WHEN … THE Backend SHALL …"), criterion IDs in brackets (e.g. `[NAV-01]`), and the glossary terms already defined (Board_Owner, Protected_Route, Envelope, Side_Panel, Design_System, etc.).
- Continue the numbering: Decisions from **AY**, Requirements from **45**, Correctness Properties from **69**, task group **39**, Open Questions from **46**.
- Where V17 replaces an earlier requirement or criterion, add a supersession note in the old place ("Superseded by Requirement N, V17") instead of deleting it.
- Every visual requirement uses Design_System tokens only (no magic numbers, no arbitrary Tailwind values) and the references in `design/reference/v2/`.

## Files to create or update

Create:

- `specs/v17/00-OVERVIEW.md`: scope, decisions AY onward, supersession table, exclusions, phase list.
- `specs/v17/32-UI-FIXES.md`: Requirement 45.
- `specs/v17/33-PATHS-AND-NAVIGATION.md`: Requirements 46 and 47.
- `specs/v17/34-BOARD-SLUG-AND-404.md`: Requirement 48.
- `specs/v17/35-COLUMNS-AND-BOARD-VIEWS.md`: Requirements 49 and 50.
- `specs/v17/36-DASHBOARD-AND-MY-TASKS.md`: Requirements 51 and 52.
- `specs/v17/37-USERS-AND-PROFILE.md`: Requirements 53 and 54.
- `specs/v17/38-SHARE-AND-CARD-MODAL.md`: Requirements 55 and 56.
- `specs/v17/39-NOTIFICATIONS.md`: Requirements 57 and 58.
- `specs/v17/40-ACCOUNT-ACTIVATION-EMAIL.md`: Requirement 59.
- `specs/v17/41-VERIFICATION.md`: test plan (unit, property, integration, Playwright at 360, 414, 960, 1280 pixels) and the owner's visual review checklist.

Update:

- `.kiro/specs/requirements.md`: add Requirements 45–59 and supersession notes.
- `.kiro/specs/design.md`: V17 design notes (data model, endpoints, error codes, migrations, components) and Properties 69 onward.
- `.kiro/specs/tasks.md`: task group 39, ordered by the phases below, every task unticked and linked to its requirement IDs.
- `.kiro/specs/CHANGELOG.md` and the root `CHANGELOG.md`: a V17 (specs) entry.
- `.kiro/steering/frontend.md` and `.kiro/steering/backend.md`: rules that change (paths, navigation, confirm modals, slugs, mail).
- `.kiro/specs/requirements.md` Open Questions: add 46–50 as resolved decisions (see the end of this brief).

## What V17 replaces

| Earlier | V17 |
|---|---|
| Requirement 42 (V16 host split, `app.<domain>`) | Path topology: landing at `/`, app at `/app/...`, API at `/app/api/...` (Req 46) |
| Requirement 39 (Icon_Rail and Top_Nav with the same items) | Left Sidebar for global items and a board-only Top_Menu (Req 47) |
| SHELL-07, Inbox item in the navigation | Notifications reached from the bell only (Req 47) |
| SHELL-17, separate Public link and Invite buttons | One Share modal (Req 55) |
| DASH-08 and DASH-09 (no greeting, limited widgets) | Greeting, filters, and new widgets (Req 51) |
| Admin user delete | No delete; deactivate only (Req 53) |

Decision B (an Admin has no Board access by default) stays in force.

## Requirements

### Requirement 45: UI fixes

1. The logo on the login and register pages has a transparent background.
2. The login and register pages use the same canvas and surface tokens as the Boards page.
3. A field's error clears as soon as the user edits that field; it does not persist after the value changes.
4. WHEN the user submits the login or register form, every field is validated, and every invalid field shows its error at once.
5. In every select, combobox, and dropdown, an option shows its hover highlight while the pointer is over it and loses it when the pointer leaves. Keyboard highlighting still works.
6. The Team panel has spacing (a token) between its header and the member search input.
7. A shared `ConfirmDialog` (built on `BaseModal`) asks for confirmation before every create and every delete action in the product. The dialog names the item and the action, has a primary action and Cancel, closes on Escape, and returns focus to the trigger.

### Requirement 46: Path topology

1. One Next.js app serves the landing page at `/` and every Protected_Route under `/app`: `/app/boards`, `/app/b/{slug}`, `/app/b/{slug}/list`, `/app/b/{slug}/calendar`, `/app/b/{slug}/archived`, `/app/dashboard`, `/app/my-tasks`, `/app/users`, `/app/profile`, `/app/login`, `/app/register`, `/app/verify`, and the invite and shared-view routes under `/app`.
2. nginx proxies `/app/api/*` to the Flask `/api/*` routes. The Flask routes do not change. `NEXT_PUBLIC_API_URL` is `/app/api` in production.
3. The V16 host routing is removed: `lib/host.ts`, `lib/origins.ts`, the host branch of `proxy.ts`, the `SITE_URL` and `APP_URL` variables, and the two-host nginx server blocks.
4. `robots.txt` and `sitemap.xml` list `/` only; every response under `/app` carries `X-Robots-Tag: noindex`.
5. The `proxy.ts` guard protects every path under `/app` except login, register, verify, the invite pages' signed-out states, and the shared view.
6. The old V16 paths (`/boards`, `/boards/{id}`, `/dashboard`, `/admin/users`, `/profile`, `/login`, `/register`) redirect permanently to their `/app` equivalents.
7. The deploy files (`deploy/nginx/revoboard.conf`, `compose.yaml`, `deploy/*.sh`, `deploy/smoke.*`, `deploy/README.md`) are listed as files to change in the tasks.

### Requirement 47: Navigation

1. **Sidebar (global).** On every Protected_Route page, a left Sidebar shows Dashboard (Supervisor, Manager), My Tasks (every signed-in user), Boards (every signed-in user), and Users (Admin only).
2. The Sidebar has a toggle. Expanded shows icon and label; collapsed shows icons only, with a tooltip on hover and keyboard focus. **The default is expanded.** The state is stored per browser, and the stored value is read safely (falls back to expanded).
3. Below 960 pixels the Sidebar becomes a Nav_Drawer opened from the App_Header menu button (focus trap, Escape, scrim, return focus).
4. **Top_Menu (board only).** The Top_Menu appears in the App_Header only while a Board is open. Its items are Board, List, Calendar, Activity, Members, Categories, and Share. Board, List, and Calendar are routes; Activity, Members, and Categories open the right Side_Panel; Share opens the Share modal (Req 55). Which roles see which item follows the existing rules.
5. The Top_Menu is the main menu of a Board; the Sidebar never repeats a Top_Menu item.
6. **Bell.** Notifications are reached only from the bell in the App_Header. The bell opens the notifications panel drawn as `design/reference/v2/11-inbox-desktop.png`. There is no Inbox item in the Sidebar or the Top_Menu.
7. **Categories** become a right Side_Panel view (like Members), not a separate screen.
8. The V16 Icon_Rail and Top_Nav are removed; there is no second navigation component.

### Requirement 48: Board slug and 404 page

1. Add `boards.slug` (text, not null, unique) in a reversible migration that backfills every Board from its name.
2. A slug is the name in lowercase ASCII, with words joined by `-`, with other characters removed. When the slug is taken, append `-2`, `-3`, and so on, using the lowest free number. A name that gives an empty slug uses `board`.
3. Renaming a Board regenerates its slug. **The old slug is not kept:** a request for an old or unknown slug returns 404.
4. Add `GET /api/boards/slug/{slug}`, with the same role rules and payload as `GET /api/boards/{id}`, plus `slug` in the Board payload. Every other endpoint keeps using the Board UUID.
5. The frontend Board URL is `/app/b/{slug}`. After a rename, the frontend replaces the URL with the new slug.
6. Public share links and invite links use their tokens and keep working after a rename.
7. **404 page.** Add an attractive, on-brand 404 page (`not-found.tsx`) for unknown paths and unknown or old Board slugs, with the BrandLogo, a short message, an illustration or decorative element from Design_System tokens, and buttons to Boards and Home. It works at 360 to 1280 pixels and is used both under `/app` and on the landing page.

### Requirement 49: Column CRUD

1. The Board_Owner can create, rename, reorder, and delete Columns. Other roles cannot (HTTP 403).
2. Deleting a Column that holds active (non-archived) Cards is refused with HTTP 409 `COLUMN_NOT_EMPTY` and the count; the UI explains "Move or archive its N cards first."
3. Archived Cards have no Column: archiving sets `cards.column_id` to null. A migration makes `column_id` nullable and sets it to null for already-archived Cards. Archived Cards never block a Column delete.
4. The Column named `Done` is locked: renaming it or deleting it is refused with HTTP 409 `COLUMN_LOCKED`. It can still be reordered. No other Column can be renamed to `Done`.
5. Every create and delete goes through `ConfirmDialog` (Req 45.7).
6. The `completed_at` invariant of THR-03 holds for every Column change.

### Requirement 50: Board views and due badges

1. **List view** (`/app/b/{slug}/list`): the Board's Cards grouped by Column as table rows (title, assignee, priority, category, due date), with the same filters as the Board view; rows stack as cards below 960 pixels.
2. **Calendar view** (`/app/b/{slug}/calendar`): a month grid with each Card on its `end_date`; Cards without `end_date` are not shown; previous and next month controls; selecting a Card opens the Card modal.
3. **Archived cards** (`/app/b/{slug}/archived`): the Board's archived Cards with a Restore action. A restored Card goes to the first Column (by position) of the Board.
4. **Due badges** on Card tiles, List rows, and Calendar items: "Overdue" (danger tone) when `end_date` is before today, and "Due tomorrow" (warning tone) when `end_date` is tomorrow, both in `APP_TIMEZONE`. Cards in `Done` show no due badge.

### Requirement 51: Dashboard

1. A greeting at the top: "Good morning", "Good afternoon", or "Good evening" by local time, followed by the signed-in user's first name.
2. Filters: Board (existing selector), member, and date range. **The date range defaults to the last 30 days.** Every filter applies to every widget.
3. Keep the existing widgets (overview and throughput chart).
4. Add widgets:
   - Overdue cards: count and list (`end_date` before today, not in `Done`).
   - Due tomorrow (H-1): list.
   - Top 5 priority cards: not in `Done`, sorted by priority (highest first), then the nearest `end_date`.
   - Finished on time: Cards whose `completed_at` is on or before their `end_date`.
   - Finished overdue: Cards whose `completed_at` is after their `end_date`.
   - Cards without `end_date` are excluded from the on-time and overdue figures.
5. Backend: `GET /api/analytics/dashboard?board=&member=&from=&to=`, with the role rules of Requirement 10, one pre-aggregated response, and a number of queries that does not depend on the number of Cards or Boards.
6. Loading, error with Retry, and empty states as in DASH-07. Charts follow the existing chart rules (token colours, accessible name, hidden data table).

### Requirement 52: My Tasks

1. `/app/my-tasks` lists the Cards assigned to the signed-in user, on every Board the user can see, not in `Done` and not archived.
2. Groups: Overdue, Today, Tomorrow, This week, Later, No due date (in `APP_TIMEZONE`).
3. Each row shows the Card title, the Board name, priority, and due badge; selecting it opens the Card.
4. Backend: `GET /api/me/cards`.

### Requirement 53: Users, active, and availability

1. Add `users.is_active` (boolean, default true) and `users.is_available` (boolean, default true).
2. The admin Users page (`/app/users`) is a table: name, username, email, role select, Active toggle, Available toggle, and an Update button per row. A "New user" button sits above the table. Below 960 pixels, rows stack as cards.
3. **There is no user delete.** Remove the delete endpoint and UI if they exist.
4. Deactivating a user is refused with HTTP 409 `USER_HAS_OPEN_WORK` while the user has assigned Cards that are not in `Done`, or owns a Board that has Cards outside `Done`. The response lists the blocking Boards and Cards, and the UI shows them in a modal with links.
5. Deactivation revokes every session of that user at once. An inactive user cannot sign in (HTTP 403 `ACCOUNT_DISABLED`).
6. Only users who are both active and available appear in the member picker and the assignee picker.
7. A Card in `Done` keeps its assignee after that user is deactivated; the avatar shows an "Inactive" marker. An assignee who is unavailable shows an "Unavailable" marker.
8. An Admin can set both toggles; a user can set their own availability from the profile (Req 54). Every toggle change goes through `ConfirmDialog`.

### Requirement 54: Profile

1. The profile page has a profile layout like a social profile page: a cover band, a large avatar overlapping it, the full name and username, and tabs: About, Security, Notifications.
2. **About:** edit full name, username (with the live availability check), and email; set own availability.
3. **Email change:** the new address is stored as `users.pending_email`, and a confirmation link is emailed to it. The old email stays in use until the link is confirmed. The user can resend the link. A confirmed change replaces the email and clears `pending_email`.
4. **Security:** change password. **The current password is required.** After a change, an email "Your password was changed" goes to the account's email.
5. **Notifications:** the preference switches of Requirement 57.

### Requirement 55: Share modal

1. One Share modal replaces the separate Public link and Invite buttons and modals, drawn as `design/reference/v2/06-invite-public-link-desktop.png`.
2. It holds the invite link (enable, copy, regenerate, disable), the pending join requests (approve, reject), and the public link (enable, copy, regenerate, disable).
3. Behaviour, permissions, and visibility rules stay as in Requirements 23, 24, and 31.

### Requirement 56: Card modal

1. Rebuild the Card modal to match `design/reference/v2/04-card-modal-desktop.png`, including the attribute chip row (status, priority, assignee, dates, category).
2. Behaviour, permissions, and payloads do not change.

### Requirement 57: Notification preferences

1. Add the table `notification_preferences(user_id, type, enabled)`. A missing row means enabled.
2. Types:
   - `comment_on_assigned`: another user comments on a Card assigned to me.
   - `due_today`: a Card assigned to me is due today.
   - `due_tomorrow`: a Card assigned to me is due tomorrow (H-1).
   - `assigned_card_changed`: a Card assigned to me is moved, archived, or deleted.
   - `subtask_on_assigned`: a subtask on a Card assigned to me is created, updated, or deleted.
3. A notification is created only when the recipient has that type enabled. The actor never notifies themselves.
4. Endpoints: `GET /api/me/notification-preferences` and `PUT /api/me/notification-preferences`.
5. In-app notifications only. Email notifications are out of scope for V17.

### Requirement 58: Due-date job

1. Add the CLI command `flask notify-due`, run by cron every 15 minutes, using `APP_TIMEZONE` for "today" and "tomorrow".
2. It creates `due_today` and `due_tomorrow` notifications for assigned Cards not in `Done` and not archived, respecting preferences.
3. It is idempotent: a unique key on (card, type, date) prevents duplicates when it runs again.
4. The deploy scripts install the cron entry; `deploy/README.md` documents it.

### Requirement 59: Account activation and email

1. Add `users.email_verified_at` (nullable). A user with null cannot sign in (HTTP 403 `ACCOUNT_NOT_ACTIVATED`). This is separate from `is_active` (Req 53), and the two have different error codes and messages.
2. Registration sends a verification email with a single-use token that expires after 24 hours. Add `POST /api/auth/verify` and a rate-limited `POST /api/auth/resend-verification`, and the frontend pages `/app/verify` and "check your email" after registering.
3. The migration sets `email_verified_at = now()` for every existing user. Users created by an Admin are verified at creation.
4. Tokens for verification and email change are stored hashed in an `email_tokens` table (user, purpose, token hash, expires, used).
5. **Mail transport:** Gmail SMTP (`smtp.gmail.com`, port 587, STARTTLS, app password), configured by `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`. Development and tests use a console mail backend. No credential in code or committed files; `.env.example` lists the variables empty.
6. Email is sent after the database commit; a failed send is logged and does not fail the request.

## Migrations

All reversible, each in its own file:

1. `boards.slug` (with backfill).
2. `cards.column_id` nullable, with archived Cards set to null.
3. `users.is_active`, `users.is_available`, `users.email_verified_at` (backfilled), `users.pending_email`, and the `email_tokens` table.
4. `notification_preferences`, and the unique dedupe key on notifications for the due job.

## Correctness Properties (69 onward)

Write each as a property-based test target (hypothesis for backend, fast-check for frontend):

- Board slugs are unique, follow the slug rules, and change on rename; an old slug returns 404.
- The `Done` Column can never be renamed or deleted.
- A Column with active Cards can never be deleted.
- Archived Cards always have a null `column_id`.
- Pickers only ever list users who are both active and available.
- A user with open work can never be deactivated.
- No notification is ever created for a type the recipient disabled.
- Running `notify-due` twice creates no duplicate notifications.
- An unverified or inactive user can never obtain a Token.
- Dashboard figures equal the counts computed from Card rows for any filter combination.

## Task phases (group 39)

One commit per phase:

1. UI fixes (Req 45).
2. Path topology and navigation (Reqs 46, 47).
3. Board slug and 404 page (Req 48).
4. Column CRUD and board views (Reqs 49, 50).
5. Card modal and Share modal (Reqs 55, 56).
6. Users, availability, and profile (Reqs 53, 54).
7. Dashboard and My Tasks (Reqs 51, 52).
8. Notification preferences and due job (Reqs 57, 58).
9. Account activation and email (Req 59).
10. Verification at 360, 414, 960, and 1280 pixels and the owner's visual review.

Each task lists the files it changes, the tests it adds, and its requirement IDs. Each phase ends with: backend tests pass, frontend tests pass, `next build` passes, `openapi.json` and `API.md` regenerated when the API changed.

## Open Questions, resolved

- **OQ46:** An old Board slug is not redirected; it returns 404 with the attractive 404 page.
- **OQ47:** A restored archived Card goes to the first Column.
- **OQ48:** The Sidebar toggle is stored per browser; the default is expanded (labels shown).
- **OQ49:** The Dashboard date range defaults to the last 30 days.
- **OQ50:** The due job runs every 15 minutes and uses `APP_TIMEZONE`.

## Out of scope for V17

Email notifications (beyond activation, email change, and password-changed notices), user deletion, slug redirects, and any feature the API does not support.
