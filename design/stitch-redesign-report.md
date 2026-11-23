# Stitch Redesign Report — RevoTask

Project: Stitch "Kanban Task Management App" (`projects/4453997251229387917`, TEXT_TO_UI_PRO, last updated 2026-11-23).
Compared against: `specs/project-brief.md`, the tail of `specs/CHANGELOG.md` (V10–V14), `guidelines/frontend.md`, `.kiro/steering/{frontend,product}.md`, and the highest-numbered version of each domain spec (01-AUTH v12, 03-BOARDS v12, 04-CARDS v13, 07-COMMENTS v12, 09-NOTIFICATIONS v12, 11-VISIBILITY v12, 19-APP-HEADER-PROFILE v12, 21-BRANDING v11, 22-INVITES-JOIN-REQUESTS v13).

**Method and limits.** The screen list and design theme came from the Stitch MCP. I opened the screenshots of nine screens: Mobile Task Modal, Web Kanban (the card modal sits over it), Web Auth, Categories, Invite & Public Link, Inbox drawer, Activity drawer, and the Kanban template. I classified the other screens from their titles only and did not open their screenshots or HTML. Any claim about those is marked *(title only)*. I did not read `.kiro/steering/data-model.md` or `design/kanban-prototype.html`: the first is not needed for a visual comparison, and the prototype's behaviour is already restated in `.kiro/steering/frontend.md`, which calls the prototype the source of truth. `rtk bulk-read` could not run (`GEMINI_API_KEY` is not set), so I read the files directly.

---

## 1. What Stitch generated (screen inventory)

### Design theme
- Colour: seed `#1c3f6e` (navy), mode LIGHT, variant FIDELITY. Primary `#002954`, secondary teal `#006b5f`, tertiary cyan `#16bac5`, background `#faf8ff`, error `#ba1a1a`.
- Fonts: Plus Jakarta Sans for headlines, Inter for body and labels. Roundness `ROUND_EIGHT`. Spacing 4/8/12/16/24/32/48 px, page margin 16 px (mobile) and 32 px (desktop).
- Type scale: body 15/14 px, card title 15 px semibold, labels 14/13/12/11 px.

### Screens (22 entries: 19 generated designs, 2 uploaded reference images, 1 duplicate-purpose template)

| # | Title | Device | Layout / components / states observed |
|---|---|---|---|
| 1 | RevoTask Web Auth (Login & Register) | Desktop | Split panel. Navy brand panel (K tile, "Work in flow, scale with clarity.") plus white form card. Sign In / Create Account tab switch, "Workspace Ready" chip. Register form: full name, "Username or work email", password with eye toggle, Terms checkbox, security note. *Shown state is Register only.* |
| 2 | RevoTask Mobile Auth (Login & Register) | Mobile 780w | Mobile form version *(title only)* |
| 3 | RevoTask Mobile Auth (Create Account) | Mobile | Mobile register state *(title only)* |
| 4 | RevoTask Web Landing Page | Desktop | Marketing page, 7220 px tall *(title only)* |
| 5 | RevoTask Web Dashboard (Template Layout) | Desktop | Dashboard *(title only; likely stats)* |
| 6 | RevoTask Kanban Board (Template Layout) | Desktop | Icon rail, header (logo, search, bell, user), "Welcome Back, Alex" with "Add New Card". Filter row: All Tasks plus category chips, a "14 of 22 done (64%)" meter, search. Five columns (Todo, In Progress, Review, Revision, Done) with counts and a "…" menu. Cards: category label, priority flag badge, title, description, progress bar, subtask count, date, attachment/comment count, assignee avatar; "Re-opened" and "Completed" states. "Add Card" pinned per column. |
| 7 | RevoTask Web Kanban Board (Modernized Template Layout) | Desktop | Same board. Header carries top pills (Boards / Inbox / Activity / Categories / Team) and a search box. **The card modal is shown on this screen.** |
| 8 | Card modal (on #7) | Desktop | Two panes. Header: board name / status badge / "Auto-saved just now" chip / close. Left: title, chips (category, High Priority, date range, assignee "Supervisor + Dev"), Description (auto-saves on blur or ⌘+Enter), Subtasks "3 of 4 done (75%)" with progress bar, drag handles, Add subtask, Attachments (2 files) with delete and Upload file. Right: Discussion (4 comments), a Pinned comment with a "Supervisor" tag, a reply nested one level, composer, Activity log at the bottom. Footer: "Created … by …", Archive, Delete Card. |
| 9 | RevoTask Mobile Task Modal Detail | Mobile 780w | Full-screen sheet. Status dropdown, "Auto-saved" chip, title with edit pencil, property card (assignee, priority, due date with "3d left", **estimate 14 hrs (3 pts)**), Description with code block and Collapse, "Acceptance criteria" 3 of 4 checklist, Add subtask, comments with composer (@, attach, emoji, Send), sticky bottom bar (share, bookmark, **Done**). |
| 10 | RevoBoard Mobile Kanban (Light) | Mobile | Mobile board *(title only; note the name "RevoBoard")* |
| 11 | RevoTask Mobile Create Board Modal | Mobile | *(title only)* |
| 12 | RevoTask Create New Board Modal | Desktop | *(title only)* |
| 13 | RevoTask Board Switcher Dropdown Open | Desktop | *(title only)* |
| 14 | RevoTask Inbox & Notifications Drawer | Desktop | Centered floating popover (not a right panel) over a blurred board. Tabs All 12 / Unread 3 / **Mentions 2** / Assignments 1, "Mark read", "TODAY" group, mention row, footer "Notification Settings" / "Clear Read". |
| 15 | RevoTask Activity Log Drawer | Desktop | Right-anchored floating panel. "Live Stream" chip, stat tiles (Events 148, Active Users 9 Online, System State 100%), filter box, All Actions / All Members / Critical Only chips, timeline row "Moved REV-305 In Progress → Review", **Export Audit Trail (CSV)**, "Retention: 90 days rolling". |
| 16 | RevoTask Categories Management (Modernized) | Desktop | Header with Board selector and Import Taxonomy; "New Category"; three KPI tiles (Total Categories, Tagged Tasks, Board Coverage); search, Board filter, Active/Archived toggle, quick-filter chips; table with name and swatch, hex token, associated boards, active tasks, **automated rules**, row actions, pagination. |
| 17 | RevoTask Invite & Public Link Management | Desktop | Modal "Board Access & Sharing". Tabs "Invite Link & Join Requests (3)" and "Public Read-Only Link". Invite link with Copy Link / Regenerate / Disable. Pending Join Requests list: avatar, name, @username, **department tag**, email, time, Approve / Reject. Note "Manager / Admin Decision Required". |
| 18 | RevoTask Mobile Public Share Link & Invites | Mobile | *(title only)* |
| 19 | RevoTask Public Board (Template Layout) | Desktop | Read-only shared board *(title only)* |
| 20 | RevoTask User Management (Modernized) | Desktop 3400w | Admin user list *(title only)* |
| 21 | web ui template.jpg | Image | Uploaded reference |
| 22 | Gemini_Generated_Image…jpeg | Image | Uploaded reference |

### Shell seen in the screenshots
- Left icon rail (logo toggle, 4–5 icons, settings, **logout icon at the bottom**).
- Top pill nav (Boards / Inbox / Activity / Categories / Team) plus search, bell and a user chip with a dropdown.
- Content sits on a rounded white "app card" over a tinted page.

### Not generated at all
Analytics (supervisor or manager), Home / boards list, Profile page, `/invite/{token}` landing page, invalid-link page, session-expired, desktop shell with a Team members list, board-visibility or archive UI, archived boards or cards, card modal as a guest/member/read-only variant, empty, loading and error states, confirm popovers, assignee / date / priority popovers, the comment sort toggle, and any 360 px screen of the board.

---

## 2. Coverage vs spec, screen by screen

Legend: **C** covered, **P** partial, **M** missing.

### App shell (Req: Sidebar nav Home/Inbox/Activity, Boards list = switcher, Team members, header with bell and user menu)
- **P** — There is an icon rail and a top nav, but the spec shell is a labelled expandable sidebar (expanded with labels, collapsed to rail with tooltips, state remembered, logo as the toggle). Stitch only shows the collapsed rail.
- **M** — Sidebar Boards list as board switcher and the Team members section (owner first, "Owner" tag, role tag, remove action).
- **M** — Home as the first nav item. Stitch shows "Boards".
- **P** — A board switcher dropdown screen exists (#13, *title only*); the spec puts the switcher in the sidebar.
- **P** — Header has bell, search and a user chip. The spec header is: sidebar toggle below 960 px, board name, "Public link" (Manager/Admin), "Invite" (owner/Manager/Admin), bell, a `User menu` with Profile above Log out. Stitch puts Logout on the rail and has no Profile entry.
- **C** — Off-canvas drawer on mobile is not shown; see Mobile below.

### Card detail modal (the one two-pane modal for view and edit)
- **C** — Two-pane desktop layout; left has title, chips, description, subtasks, attachments; right has comments and activity log.
- **C** — No Save button; "Auto-saved" indicator; Archive and Delete in the footer.
- **C** — Category, priority and date-range chips; assignee chip; nested reply one level deep; priority/pinned comment at the top.
- **P** — Auto-save state is a single global chip. The spec wants per-field Saving / Saved / error with Retry in an `aria-live` region.
- **P** — Header "Platform Sprint Alpha / In Progress" matches "title | board" plus column badge in intent. The spec title is `card title | board name` and follows the title field live.
- **P** — Subtasks: checkboxes, drag handle and progress are there. Missing: inline-editable titles, delete-subtask confirm, disabled state for Members on cards not assigned to them, no meter without subtasks.
- **P** — Attachments: tile grid with type icon and delete matches. Missing: Link vs File picker (spec: `BaseCombobox` Link/File), "Add link" row, new-tab link behaviour is not visible, and removal must use the modal confirm.
- **M** — Comment **Latest / Popular toggle** and reply-count badge. Not in any screenshot.
- **M** — **Mark as priority** action for a manager, and the **Create card** action on a manager-authored comment (shown to supervisor/manager/admin only).
- **M** — Comment delete (author only, with confirm), Reply action restricted to top-level comments.
- **P** — Activity log has two rows. The spec wants "**Manager** moved "Title" from [Todo] to [In Progress]" with named, bracketed columns.
- **M** — Popovers: assignee (search, board members, role tag, Remove, hidden from Member), range calendar with the start-not-after-end rule.
- **M** — Role variants: Guest/shared view with comments and activity absent, Member view (no assignee popover, restricted subtask checkboxes).
- **M** — Overdue red state on the date chip.
- **P** — Mobile modal exists (#9) and is a good sheet, but see conflicts.

### Board (columns, cards, filter row, search)
- **C** — Five default columns in the right order with counts and per-column "Add Card".
- **C** — Category chips in the filter row, search, priority badge on cards, assignee avatar, subtask count and date on the card.
- **P** — Card face: progress bar is shown. Spec says progress is derived and has no meter without subtasks. Also the spec wants outlined priority badge with a flag and a soft-filled category pill with a dot, both lowercase. Stitch shows category as uppercase text and priority as a pastel flag pill.
- **P** — Filter row filters by category and text; spec also expects filter by priority and assignee.
- **M** — Viewport-locked layout (columns scroll sideways, each scrolls vertically, header fixed). The template is a long page (2,064 px).
- **M** — Drag placeholder and drop states.
- **M** — Archived card state, column add for supervisor/manager.
- **P** — "Add New Card" at page level. The spec forbids a header-only entry for mobile primary actions; per-column Add card satisfies it, so this is fine if kept.

### Categories management
- **P** — A dedicated screen exists and is board-scoped via a board selector.
- **P** — Name, colour swatch, colour token and row actions match the CRUD (add/rename/recolor/delete).
- **M** — Role gating (supervisor/manager/admin only; hidden for others).
- **Extra, not in spec** — KPI tiles, Import Taxonomy, "Automated rules", quick-filter groups, Active/Archived toggle, "associated boards" (spec says categories are not shared across boards), table pagination.

### Analytics
- **M** — No screen at all. Supervisor (own board) and manager (all boards) views are both missing. The Dashboard screen (#5, *title only*) may partly cover it but is called "Template Layout" and I did not inspect it. The Categories KPI tiles are not analytics.

### Auth (login/register)
- **C** — Split panel, brand/illustration side, elevated rounded form card, whitespace. Matches the spec direction.
- **P** — Register has full name, "Username or work email", password. The spec has **four fields**: full name, username, email, password, with blur availability checks, field errors from `error.details`, and a 429 countdown.
- **P** — Login form is not shown on desktop (only the register state), no 429 state, no field error states.
- **P** — Mobile auth screens exist (#2, #3, *title only*).
- **M** — Safe return path / session-expired behaviour (not a visual concern, but there is no `/session-expired` screen).

### Inbox and Activity (shared right-side panel)
- **P** — Both exist as panels with good content (grouping by day, filters).
- **M** — Rows are not links with the target hints (assigned/deadline → card, join requested → invite, added → board, rejected → boards). Empty/archived-target message not shown.
- **M** — "Load more" paging; Stitch uses a long list with footers.
- **P** — Inbox only has assignment and deadline notifications in scope; join-requested, added and rejected are also in V12. Stitch adds Mentions.

### Invites and join requests
- **C** — Invite link with Copy / Regenerate / Disable, pending list with avatar, full name, username, email, time, Approve / Reject. Matches the V12 round 2 spec for the pending list.
- **C** — Public link tab matches the Manager/Admin-only public link concept in intent.
- **P** — The "Manager / Admin Decision Required" copy matches, but the owner must see the list and cannot approve. The screen does not show a role-dependent state (Approve/Reject disabled or hidden for the owner).
- **M** — `/invite/{token}` landing page (send join request, rejected state) and the guest-facing "link is not valid" page.

### Visibility and archiving
- **M** — No visibility UI is expected after V12 (every board is private), and Stitch correctly has none. A "Private Workspace" chip appears in the header of #14 and #15; see conflicts.
- **M** — Archive board and archive card flows are not visible (the card modal has Archive; board archive has no screen).

### Public / shared board
- **P** — Public Board screen exists (#19, *title only*). I did not verify the banner ("Shared view, read only", Sign in link), the absence of the sidebar, user menu, Invite, comments and activity, or disabled checkboxes.

### Admin
- **P** — User Management exists (#20, *title only*). Not part of the supplied spec list, so no further comparison.

### Branding (BrandLogo)
- **P** — "RevoTask" wordmark is used in headers. But the mark is a **lightning bolt in a teal tile** (#14, #15), a **trend line** (#16), and a **"K" tile** on the auth page. None of these is the supplied RevoTask logo. The mobile board is called "RevoBoard".
- **M** — No use of `logo-revo.svg` / `logo-text-revo.svg`, no favicon, no logo as sidebar toggle.

### Mobile-first down to 360 px
- **P** — Five mobile screens exist at 780 px wide (390 CSS px at 2x), so they fit 360–414 px. Auth, board, task modal, create board and share link are covered.
- **M** — No 360 px check; the mobile modal's primary action is bottom-sticky (good) but the shell has no off-canvas drawer screen, no mobile Inbox/Activity panel, no mobile categories screen.
- **P** — The desktop screens are 2560 px wide at 2x scale (1280 CSS px) and the shell is the pill nav, which will not collapse into a drawer without a design decision.

---

## 3. Conflicts or mismatches with the spec's decisions

1. **Logo and name.** Spec Decision X (V11): only the supplied files through `BrandLogo`. Stitch invents three different marks and one different product name (RevoBoard). Do not copy any of them.
2. **"Private Workspace" chip** (#14/#15) and "Workspace Ready" (#1) imply a visibility concept. V12 removed visibility icons entirely. Drop these chips.
3. **Mobile card modal has an Estimate field "14 hrs (3 pts)".** No estimate exists in the data model or spec. Remove.
4. **Mobile modal "Status" dropdown** (In Progress ▾) lets the user change column. Spec: no column select; cards change column only by drag-and-drop (Req 4, V8).
5. **Mobile modal "Done" button** as the primary action and a **bookmark/share** pair. Spec: no Save/Close/Done button; closing is the header icon and Escape; there is no bookmark feature. Primary mobile actions should be Archive and Delete in the footer.
6. **Mobile "Acceptance criteria"** is a rename of Subtasks. Keep the term "Subtasks".
7. **Mobile composer: @mention, attach, emoji.** The spec has no mentions, attachments on comments, or emoji. The Inbox "Mentions 2" tab and the "mentioned you" row depend on this and have no backend (notifications are assignment, deadline, join-requested, added, rejected).
8. **Inbox is a centered popover, Activity is a floating right panel.** The spec says one shared panel that slides in from the right. Use one panel with two tabs or views.
9. **Activity panel extras:** "Live Stream", online-user count, system state %, Critical Only, Export Audit Trail (CSV), 90-day retention. None exist; the log is append-only per card plus a board feed. "Active Users 9 Online" would need presence tracking. Drop.
10. **Pinned comment** uses a pin icon and the word "Pinned". Spec word is **priority** and it is set by a manager on any comment. Also the example shows a *Supervisor* with the pinned comment; priority is a manager's action. The "Supervisor" tag on a comment author is fine, but a "Supervisor + Dev" assignee chip (two avatars) breaks the **single assignee** rule.
11. **Categories screen scope.** Spec: a small CRUD per board, categories not shared across boards. Stitch: workspace-wide taxonomy, "All Boards (5)" default, "associated boards" per category, automated rules, import, archive. Conflicts with per-board ownership and adds unspecified features.
12. **Auth:** one "Username or work email" field on register conflicts with separate unique `username` and `email` fields. Terms checkbox is not in the spec.
13. **Register tab and sign-in as tabs** on one page; spec has separate `/login` and `/register` routes. Acceptable only if the routes still exist and the tab is a link.
14. **Header nav pills (Boards/Inbox/Activity/Categories/Team)** replace the sidebar nav and put Categories and Team in a global nav for every role. Spec: Categories is a sidebar entry for supervisor/manager/admin only; Team members is a sidebar section, not a page.
15. **Logout on the rail** conflicts with "no Log out item in the Sidebar" (it belongs in the header user menu).
16. **Fonts:** the Stitch theme uses Plus Jakarta Sans for headings. The spec (V8) fixes Inter, self-hosted, no third-party font service. Also the auth screenshot renders in a serif font, which is a generation artifact and must not be copied.
17. **Radius and colour tokens.** Spec says corner radii of 8 px or less (cards 6 px) and tokens from `styles/tokens.css`. Stitch's rounded containers (the app card, pill nav, 20 px+ radii on modals and the auth card) exceed that. The Stitch palette (`#1c3f6e` navy, teal secondary) is close to the navy brand but the teal green and mint accents are a different pastel system from the `--label-*` pairs.
18. **Control sizes.** Spec: inputs, selects, buttons and chips 40 px, compact 32 px. Stitch text is 15 px body; spec is 14 px body, 13 px secondary, 12 px labels, 18 px page titles. Stitch's "display-hero" 34 px has no place in the app (landing page only).
19. **Board page length.** The Stitch board is a scrolling page with a "Welcome Back, Alex" hero. The spec board never scrolls the page and has no welcome hero.
20. **Progress bar on every card** conflicts with "no meter without subtasks". Stitch also shows a "14 of 22 done (64%)" board meter; this is not specified (closest is board analytics).
21. **Landing page** is out of scope: there is no landing page in the spec (the root redirects into the guarded app).
22. **Role tag.** V13 requires a role tag beside each person in the assignee picker and Team members rows. Not drawn anywhere.
23. **Email visibility.** Email appears on the pending join-request rows (allowed) and the Stitch mobile share screen was not inspected *(title only)*. Verify it does not show email anywhere else.

---

## 4. Recommended next steps (prioritized)

**P0 — decide before coding**
1. **Treat Stitch as a visual reference, not a layout source.** The spec's frontend steering is authoritative; settle the 23 conflicts above with a short decision list (keep Inter, 8 px max radii, no mentions/estimate/status select/Done button/online users/export).
2. **Fix the tokens first.** Map the Stitch palette to `styles/tokens.css`, keep `--brand` navy, and decide if teal becomes an accent or stays within the existing `--label-*` pairs. Do not import Stitch's `namedColors` wholesale.
3. **Regenerate or hand-draw the missing high-risk screens** (in Stitch, or directly in code from the spec): Analytics (supervisor and manager), card modal desktop in Member and Guest/shared variants with the Latest/Popular toggle, priority and create-card actions, and a 360 px board with the off-canvas drawer. These are the places where the spec carries the most rules and Stitch has the least evidence.

**P1 — build the app shell and the core flow**
4. Build the shell from the spec: labelled sidebar (expanded / collapsed, remembered), `BrandLogo` toggle with the supplied assets, Boards list as switcher, Team members, header with Invite / Public link / bell / `User menu`. Use Stitch only for spacing and visual weight.
5. Build the board page (viewport-locked columns, HTML5 drag-and-drop with placeholder, category filter row from `GET /api/boards/{id}/categories`, cards without a progress bar unless subtasks exist).
6. Build the card modal on the Stitch desktop layout, which is the closest match to the spec of any screen. Add what is missing: per-field save states with Retry, popovers (assignee, calendar with start-not-after-end, priority, category), comment sort toggle, priority flag, create-card action, delete confirm, role-gated rendering based on field absence.
7. Auth pages: take the split-panel layout, add the separate username and email fields, blur availability checks, 429 countdown, and the `next` handling. Drop the Terms checkbox unless the owner wants it.

**P2 — secondary screens**
8. Inbox and Activity as one right-side panel with link rows, Load more, and the five notification types; skip Mentions.
9. Invite modal from Stitch #17 almost as drawn; add the owner-vs-manager state for Approve/Reject and build the `/invite/{token}` and shared-view pages from the spec.
10. Categories screen reduced to per-board CRUD (name, colour, delete) with role gating; remove the KPI tiles, rules, import and archive toggle.
11. Profile page (two columns from 960 px) and the `RevoTask | name` document titles; neither is in Stitch.

**P3 — polish and verification**
12. Run the 360 px and 414 px pass on every screen, with 40 px touch targets and no horizontal scroll.
13. Accessibility pass: focus rings from `--ring`, `aria-live` save states, tooltips on hover and focus only.
14. Ask the owner whether the User Management and Landing screens should be implemented. Neither is in the brief; User Management may map to the Admin track, but the Landing page has no route.

**Open questions for the owner**
- Is teal a new accent colour, or should the app stay navy-only with pastel tags?
- Should the Dashboard / Analytics views follow the Stitch "dashboard" screen, and should I inspect it before the analytics screens are written?
- Do you want the screens I only classified by title (#2–#5, #10–#13, #18–#20) inspected in detail before implementation starts?
