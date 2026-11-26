# Overview, V17 changes (draft, awaiting owner review)
V17 is a specification change only. No application code, migration, test, or deploy file is written until the owner approves this version. It follows the brief `specs/v17/KIRO-BRIEF.md`.
V17 does three things. It moves the product from two hosts to one origin with the path topology `/` (landing) and `/app/...` (app), and replaces the V16 Icon_Rail and Top_Nav with a left Sidebar and a board-only Top_Menu. It adds product features the owner asked for: board slugs and a 404 page, Column CRUD, List, Calendar, and Archived views, due badges, a richer Dashboard, My Tasks, user active and availability flags, a social-style Profile, a single Share modal, notification preferences with a due-date job, and email activation. It also fixes a list of UI defects (Requirement 45).
Everything in `specs/v1/` to `specs/v16/` stands except where this file or a V17 file supersedes it. Superseded criteria stay in place with a note "Superseded by Requirement N, V17"; none is deleted. Decision B (an Admin has no Board access by default, no analytics, no comments) stays in force.
V17 introduces no visual language of its own. Every visual requirement uses Design_System tokens only (no magic numbers, no arbitrary Tailwind values) and the references in `design/reference/v2/`. Screens with no reference image (Profile, 404, List, Calendar, Archived, My Tasks, Users table at mobile) are built from the Component_Recipes and checked in the owner's visual review (`41-VERIFICATION.md`).
## What the owner decided (this round, from the brief)
| Question | Answer |
|---|---|
| Hosts | One origin. Landing at `/`, app at `/app/...`, API at `/app/api/...` (Decision AZ). |
| Navigation | Left Sidebar for global items; board-only Top_Menu; notifications only from the bell. |
| Old Board slug | Not redirected; 404 with the 404 page (OQ46). |
| Restored archived Card | Goes to the first Column (OQ47). |
| Sidebar default | Expanded, stored per browser (OQ48). |
| Dashboard date range | Last 30 days by default (OQ49). |
| Due job | Every 15 minutes, in `APP_TIMEZONE` (OQ50). |
| Mail | Gmail SMTP with an app password; console backend in development and tests. |
| User delete | Removed. Deactivate only. |
| Scope | Specs only. |
## Decisions Log (added)
| ID | Decision | Rationale | Where applied |
|----|----------|-----------|---------------|
| AY | **UI fixes and one confirmation dialog (V17).** Auth pages use the same canvas and surface tokens as Boards, a transparent logo, per-field error clearing, and whole-form validation on submit. Select highlights follow the pointer. The Team panel gets a spacing token. One shared `ConfirmDialog` over `BaseModal` asks before every create and delete listed in FIX-07. It replaces the `BaseConfirm` popover and modal variants (amends Decision AC). | The owner listed seven defects; one confirmation component keeps destructive and creating actions consistent. | Requirement 45 |
| AZ | **Path topology (V17; supersedes Decision AV and Requirement 42).** One Next.js app serves `/` and `/app/...`. nginx maps `/app/api/*` to Flask `/api/*`; Flask routes do not change. Host routing is removed. | The owner wants one origin and one deploy without a second DNS name or certificate. | Requirement 46 |
| BA | **Sidebar, Top_Menu, and bell (V17; supersedes Decision AT and Requirement 39 except the App_Header, Board_Switcher, Board_Toolbar progress pill, Skip link, and Side_Panel look).** A Sidebar holds global items; a Top_Menu holds board items; notifications are reached from the bell only; Categories and Members are Side_Panel views. | Global and board navigation were mixed in one list; the owner wants them apart. | Requirement 47 |
| BB | **Board slug and the 404 page (V17).** A Board has a unique `slug` generated from its name and regenerated on rename; the old slug is not kept. The frontend Board URL is `/app/b/{slug}`; every other endpoint keeps the Board UUID. | Readable URLs. A kept old slug would need a redirect table the owner declined (OQ46). | Requirement 48 |
| BC | **Column CRUD and Column-less archived Cards (V17; amends Requirement 3 criteria 4 and 5 and Requirement 2 criterion 6).** The Board_Owner, a Manager, and an Admin create, rename, reorder, and delete Columns; a Card in `Done` cannot be archived. `Done` is locked. Archiving sets `cards.column_id` to null and a Card carries its own `board_id`. | The owner wants Board_Owner, Manager, and Admin control of Columns and archived Cards that never block a Column delete. | Requirement 49 |
| BD | **Board views and due badges (V17).** List, Calendar, and Archived views under `/app/b/{slug}/...`. The Card payload carries a read-only `due_state` computed in `APP_TIMEZONE`. | Different ways to read the same Cards; one server-side rule for "overdue" and "due tomorrow". | Requirement 50 |
| BE | **Dashboard and My Tasks (V17; supersedes DASH-08 and DASH-09, amends Requirement 43).** The Dashboard gets a greeting, filters, and new widgets from one endpoint. My Tasks lists a user's assigned Cards in time groups. | The owner wants a working overview and a personal task list. | Requirements 51 and 52 |
| BF | **Users: active, available, no delete (V17; supersedes the Admin user delete and amends Requirement 1 criteria on users and Decision B only in that an inactive user is refused).** Two flags, a table screen, and a deactivation rule that protects open work. | Deleting a user breaks history and assignments; deactivation keeps them. | Requirement 53 |
| BG | **Profile (V17; supersedes Requirement 29 and Decision AF).** A social-style page with About, Security, and Notifications tabs; username and email become editable; an email change is confirmed by link. | The owner wants a fuller account page and safe email change. | Requirement 54 |
| BH | **One Share modal and a rebuilt Card modal (V17; supersedes SHELL-17 and the two-modal split of Requirements 23, 24, and 31 for layout only).** Behaviour, permissions, and payloads are unchanged. | One entry point for sharing; the owner supplied new references. | Requirements 55 and 56 |
| BI | **Notification preferences and the due job (V17; supersedes Requirement 9 criteria 2 and 3).** Five preference types; the daily `deadline` job is replaced by `flask notify-due` every 15 minutes. | Assignees choose what reaches them; the day-level job could not catch changes made during the day. | Requirements 57 and 58 |
| BJ | **Account activation and mail (V17; amends Requirement 1 and Requirement 19).** Registration sends a verification link; sign-in needs a verified email; mail goes through Gmail SMTP behind a small transport. | The owner wants verified addresses and a safe email-change flow. | Requirement 59 |
## Supersession map
V17 does not delete earlier text. Each earlier place gets the note "Superseded by Requirement N, V17" and this table says what replaces it.
| Earlier criterion | What V17 changes |
|---|---|
| Requirement 42, HOST-01 to HOST-15 (two hosts) | Path topology: PATH-01 to PATH-12. |
| Requirement 39, SHELL-01 to SHELL-03 (Icon_Rail and Top_Nav, same items) | NAV-01 to NAV-08: Sidebar plus Top_Menu. |
| SHELL-05 (item visibility by role) | NAV-01 and NAV-04. |
| SHELL-06 (Categories opens a screen) | NAV-07: Categories is a Side_Panel view. |
| SHELL-07 and Requirement 9 criterion 6 (Inbox item in the navigation) | NAV-06: the bell only. |
| SHELL-08 (Activity or Team from the rail or Top_Nav) | NAV-04: Activity and Members from the Top_Menu. |
| SHELL-17 (separate Public link and Invite buttons) | SHR-01: one Share item and modal. |
| SHELL-19 to SHELL-21 (Team_View; Admin's Team goes to `/admin/users`) | Members view of NAV-04; an Admin opens the Members view of the open Board like everyone else (Open Question 61). |
| SHELL-22 (no Sidebar) | NAV-08: the V16 components are removed; the Sidebar is back with new meaning. |
| DASH-01 (`/dashboard`), DASH-08 and DASH-09 (no greeting, limited widgets) | `/app/dashboard`; DASH-10 to DASH-22. |
| Requirement 3 criteria 4 and 5, Requirement 2 criterion 6 (Columns created by Manager, Admin, or Supervisor with access) | COL-01: Board_Owner, Manager, and Admin. |
| THR-03 (`completed_at` is not null exactly when the Column is `Done`) | COL-08: the invariant holds for Cards that have a Column; an archived Card keeps its value. |
| Requirement 9 criteria 2 and 3 (daily `deadline` job) | DUE-01 to DUE-06 (Open Question 56). |
| Requirement 19 (profile: username and email read-only; two-column layout) and Requirement 29, Decision AF | PRF-01 to PRF-10. |
| Requirement 26 (popover `BaseConfirm` forms) and V12 Decision AC | FIX-07: `ConfirmDialog`. |
| Requirement 1 and api-conventions (register returns `user` and `token`) | ACT-02: register returns `token: null`. |
| Requirement 33 DEP-05 and DEP-13 (hosts, one origin by IP) | PATH-01, PATH-02, PATH-11. |
| Admin user delete (if present) | ADM-03: removed. |
## Exclusions (V17 does not build these)
Carried: every exclusion of `specs/v16/00-OVERVIEW.md` (prototype features with no spec basis) stays in force.
Added in V17:
1. Email notifications for card events, due dates, comments, or subtasks. Mail is sent only for activation, email change, and password change.
2. User deletion, in the API and the UI.
3. Redirects from an old Board slug.
4. Slug history or a custom slug typed by the user.
5. A card `status` dropdown in the Card modal chip row. The `status` chip shows the Column and is read-only; a Card changes Column only by drag-and-drop.
6. Google OAuth, social login, and two-factor sign-in.
7. A notice to the old address when an email change is requested (not in the brief).
8. Revoking a password-changed user's other sessions (tokens stay stateless, Requirement 1).
9. Any feature the API does not support.
## Phases (task group 39)
One commit per phase. Each phase ends with: backend tests pass, frontend tests pass, `next build` passes, and `backend/openapi.json` and `backend/API.md` regenerated when the API changed.
| Phase | Scope | Requirements |
|---|---|---|
| 1 | UI fixes | 45 |
| 2 | Path topology and navigation | 46, 47 |
| 3 | Board slug and 404 page | 48 |
| 4 | Column CRUD and board views | 49, 50 |
| 5 | Card modal and Share modal | 55, 56 |
| 6 | Users, availability, and profile | 53, 54 |
| 7 | Dashboard and My Tasks | 51, 52 |
| 8 | Notification preferences and due job | 57, 58 |
| 9 | Account activation and email | 59 |
| 10 | Verification at 360, 414, 960, and 1280 pixels and the owner's visual review | all |
## Migrations (all reversible, each in its own file)
1. `boards.slug` with backfill.
2. `cards.column_id` nullable, archived Cards set to null, and `cards.board_id` added and backfilled (Open Question 53).
3. `users.is_active`, `users.is_available`, `users.email_verified_at` (backfilled), `users.pending_email`, and the `email_tokens` table.
4. `notification_preferences`, the new Notification types, and the unique dedupe index for the due job (which narrows the V12 card index, Open Question 56).
## Glossary (added)
- **Path_Topology**: The V17 layout of one origin: the Landing_Page at `/`, every app page under `/app`, and the API at `/app/api`.
- **App_Base**: The path prefix `/app`. Every Protected_Route and every sign-in page lives under it.
- **API_Base**: The path prefix `/app/api` the browser uses for every Backend call in production; nginx removes `/app` before Flask sees the request. Configured in the Frontend as `NEXT_PUBLIC_API_URL`.
- **Sidebar**: The left navigation panel of V17 with the global items (Dashboard, My Tasks, Boards, Users). It is not the V1 to V15 Sidebar (Boards list, Team members, Log out).
- **Top_Menu**: The menu in the App_Header, shown only while a Board is open, with the items Board, List, Calendar, Activity, Members, Categories, and Share.
- **Board_Slug**: The lowercase ASCII text in `boards.slug` that names a Board in its URL.
- **Not_Found_Page**: The on-brand page of `not-found.tsx` for unknown paths and unknown Board slugs.
- **Done_Column**: The Column named `Done` of a Board. It cannot be renamed or deleted.
- **Archived_Card**: A Card with `archived_at` set. It has a null `column_id` and keeps its `board_id`.
- **Due_State**: The read-only Card field `due_state`: `overdue`, `due_tomorrow`, or null, computed by the Backend in `APP_TIMEZONE`.
- **Open_Card**: A Card that is not soft-deleted, not archived, and not in the Done_Column.
- **Active_User**: A user with `is_active` true. An inactive user cannot sign in.
- **Available_User**: A user with `is_available` true. Only users who are both active and available appear in the member picker and the assignee picker.
- **Verified_User**: A user with `email_verified_at` set.
- **Share_Modal**: The one modal opened from the Share item of the Top_Menu, holding the Invite_Link, the pending Join_Requests, and the Public_Link.
- **ConfirmDialog**: The shared modal `components/shared/ConfirmDialog.tsx`, built on `BaseModal`, that asks before the creates and deletes of FIX-07.
- **Notification_Preference**: A row `(user_id, type, enabled)`; a missing row means enabled.
- **Due_Job**: The CLI command `flask notify-due`, run every 15 minutes.
- **Email_Token**: A single-use, hashed, expiring token for email verification or an email change, stored in `email_tokens`.
- **Mail_Backend**: The transport behind `app/common/mail.py`: `smtp` (Gmail) or `console`.
## Glossary (changed)
- **Icon_Rail**, **Top_Nav**, **Team_View**, **Board_Switcher** (V16): the Icon_Rail and Top_Nav are removed (NAV-08). The Team_View becomes the Members view of the Side_Panel. The Board_Switcher stays.
- **Side_Panel**: now shows one of four views: Inbox, Activity, Members, Categories.
- **App_Header**: holds the menu button (below 960 pixels), `BrandLogo`, the Top_Menu (only on a Board), the bell, and the User_Menu trigger.
- **Protected_Route**: every page under `/app` except the pages NAV and PATH-05 name as open.
- **Site_Host** and **App_Host**: removed with Requirement 42 (V17); they survive only as historical terms in `specs/v16/`.
- **Envelope**: `error.details` is now also allowed for `COLUMN_NOT_EMPTY` and `USER_HAS_OPEN_WORK` (a small object, listed in the design).
## Open Questions (added; 46 to 50 are the owner's answers, 51 to 67 defaults applied while writing and later answered, 68 to 73 from the owner's round 3 review)
46. **Old Board slug (RESOLVED by the owner):** not redirected; it returns 404 with the Not_Found_Page.
47. **Restored archived Card (RESOLVED by the owner):** goes to the first Column by position.
48. **Sidebar toggle (RESOLVED by the owner):** stored per browser; default expanded, labels shown.
49. **Dashboard date range (RESOLVED by the owner):** last 30 days by default.
50. **Due job (RESOLVED by the owner):** every 15 minutes, using `APP_TIMEZONE`.
51. **Scope of ConfirmDialog (V17, RESOLVED by the owner in round 3):** the brief says "every create and every delete". FIX-07 lists the creates that open a dialog: Board, Column, Category, Card, user, Invite_Link, and Public_Link. A comment, a reply, a Subtask, an attachment, and a Join_Request are one-step actions with their own submit button, so a second dialog would only slow them (Requirement 25 saves them at once). Every delete, remove, disable, and regenerate opens a ConfirmDialog. The owner confirmed: no ConfirmDialog for creating a comment, a reply, a Subtask, an attachment, or a Join_Request.
52. **403 versus 404 for a slug (V17, RESOLVED by the owner in round 2 within V17):** the default stands: `GET /api/boards/slug/{slug}` returns 403 to a signed-in user without Board_Access, like the UUID route. The probing risk (a name can be tested) is accepted.
53. **`cards.board_id` (V17, applied by necessity):** a Card reaches its Board only through its Column. With `column_id` null (BC), an archived Card would lose its Board and the Archived view could not list it. V17 adds `cards.board_id` (not null, backfilled). The brief's migration 2 names only `column_id`; this column is added to it.
54. **Dashboard date range (V17, RESOLVED by the owner in round 2 within V17):** the Board and Member filters apply to every widget; the date range applies to Overdue, Finished on time, Finished overdue, and the throughput chart (by their dates); Overview and Top 5 priority are not limited by it; **Due tomorrow has its own "Due on" date filter**, default tomorrow, independent of the range (DASH-15).
55. **Who manages Columns (V17, RESOLVED by the owner in rounds 2 and 3):** the Board_Owner, a Manager, and an Admin (COL-01). A Supervisor who is only a BoardMember cannot. A Board with a null `owner_id` is managed by a Manager or an Admin, so no Board is left without a manager.
56. **`deadline` notifications and the daily job (V17, default applied):** `due_today` replaces `deadline`. The daily job and its scheduler are removed; new `deadline` rows are no longer created, and old rows still display. The V12 card dedupe index covered every card type, so a second comment on the same day would have been refused; migration 4 narrows it to `assigned`, `deadline`, `due_today`, and `due_tomorrow`. Cron may not run in the unprivileged server container (Open Question 31); the deploy scripts fall back to a `supervisord` loop that runs the same command every 15 minutes.
57. **`completed_at` and archiving (V17, RESOLVED by the owner in round 2 within V17):** a Card in `Done` cannot be archived (COL-14, `CARD_IN_DONE`), so finished work stays visible in `Done` and throughput (THR-06) keeps counting it. A Card archived before V17 keeps its `completed_at`. Restoring treats the Card as entering the first Column: `completed_at` is cleared, or set to now when that Column is the Done_Column (a `Done` Column may be reordered to first).
58. **Status chip in the Card modal (V17, default applied):** V15 excluded a card `status` dropdown. The chip row of the new reference shows the Column as a read-only chip.
59. **An Admin cannot deactivate themselves (V17, default applied):** refused with HTTP 409 `CANNOT_DEACTIVATE_SELF`, so the last Admin cannot lock everyone out. Not in the brief.
60. **Deactivation and "no revocation list" (V17, default applied):** Requirement 1 says tokens are stateless with no revocation list. Deactivation takes effect at once because the Backend reads `is_active` from the user row on every authenticated request (the row is already loaded to check the role). No list of revoked tokens exists.
61. **Admin and Members (V17, default applied):** SHELL-21 sent an Admin's Team item to `/admin/users`. In V17 Members is a Top_Menu item shown while a Board is open, and an Admin has Board_Access (Requirement 22), so it opens the Members view like for everyone. The Users page is in the Sidebar.
62. **Toggles and the Update button (V17, default applied):** in the Users table a toggle or role change is staged in the row; the row's Update button opens a ConfirmDialog that lists each change and saves them in one `PATCH` on confirm. A user's own availability toggle on the Profile opens a ConfirmDialog at once.
63. **Screens without a reference image (V17, open):** Profile, Not_Found_Page, List, Calendar, Archived, My Tasks, and the Users table at 360 pixels have no image in `design/reference/v2/`. They use the Component_Recipes and are checked in the owner's visual review (`41-VERIFICATION.md`).
64. **Gmail SMTP limits (V17, open, risk):** Gmail needs 2-step verification and an app password, rewrites a `From` that is not the account, and limits a personal account to about 500 messages a day. This is enough for a demo. The transport is behind `mail.py`, so a service such as SES can replace it without a spec change.
65. **Old `/boards/{id}` links (V17, default applied):** permanent redirects cannot turn a UUID into a slug in the proxy. `/boards/{id}` redirects to `/app/boards/{id}`, a redirect-only route that reads the Board and redirects to `/app/b/{slug}` (Not_Found_Page when it does not exist).
66. **Slug normalisation (V17, RESOLVED by the owner in round 2 within V17):** the default stands: characters outside `a-z0-9` are removed, not folded ("Café Board" gives `caf-board`).
67. **Robots (V17, RESOLVED by the owner in round 2 within V17):** the default stands: `robots.txt` does not disallow `/app`, so the `noindex` header can be read; the sitemap lists `/` only.
68. **Unverified accounts (V17, RESOLVED by the owner in round 3):** an account that never confirms its email is not purged; it keeps its username and email, and the owner can resend the link (ACT-04) or an Admin can review it. The risk of a reserved username or address is accepted.
69. **Destination through activation (V17, RESOLVED by the owner in round 3):** `next` is kept through register, verification, and sign-in in the same browser (ACT-12), so an invite link still leads to its Join_Request.
70. **Inbox All and Unread switch (V17, RESOLVED by the owner in round 3):** built as NAV-13, with the Backend filter `unread=true`.
71. **My Tasks and the Admin (V17, RESOLVED by the owner in round 3):** an Admin does not see My Tasks (NAV-01, TASK-01).
72. **Two account flags (V17, RESOLVED by the owner in round 3):** `email_verified_at` (activation) and `is_active` (Admin switch) stay separate, with `ACCOUNT_NOT_ACTIVATED` and `ACCOUNT_DISABLED` (ACT-01, ADM-07).
73. **Session cookie path (V17, RESOLVED by the owner in round 3):** `Path=/app` (PATH-06) is accepted; every existing session ends at the V17 deploy and users sign in again. `deploy/README.md` SHALL say so in the release notes.
