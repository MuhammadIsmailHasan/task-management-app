---
inclusion: always
---

# Frontend Steering — App Shell & Interaction Rules

This reflects the approved HTML prototype (`design/kanban-prototype.html`) — its
layout and interaction patterns are the real source of truth for the frontend,
overriding any looser prose description elsewhere.

> **V16 (approved and implemented, 2026-11-23):** the look follows `design/kanban-prototype-v2.html`, measured
> from its renders in `design/reference/v2/` (Requirements 38 to 44, `specs/v16/`). Where a rule below names the
> Sidebar, the 8 pixel radius limit, or the 40 and 32 pixel control sizes, the V16 rule at the end of this file
> wins. The prototype is the visual source of truth; behaviour, scope, and data still come from the specs.

- **Rule:** Build mobile-first: write the base (no media query) styles for a
  ~360–414px screen first, then use `min-width` media queries to add or adjust
  for tablet/desktop — never the reverse (a `max-width` query stripping a
  desktop layout down for mobile).
  **Rationale:** The primary device is a phone; a layout that was designed for
  desktop and then "made responsive" tends to leave desktop-only assumptions
  (fixed widths, hover-only affordances) baked in.
  **Example:** the prototype's own sidebar already does this —
  `.sidebar { transform: translateX(-100%); }` is the mobile default, and
  `@media (min-width: 960px) { .sidebar { position: static; transform: none; } }`
  is the desktop enhancement, not the other way around.

- **Rule:** On mobile, every primary action (add a card, open the inbox,
  switch board, open settings) sits within one thumb-reach zone — bottom
  third of the screen or a persistent header — never only at the top of a
  scrolled-away header.
  **Rationale:** A board can be tall; an action that's only reachable by
  scrolling back to the top isn't actually easy to reach on a phone.
  **Example:** the sidebar's off-canvas toggle sits in the mobile header, not
  buried at the bottom of a long scroll; the "+ Add a card" affordance per
  column follows the same rule.

- **Rule (V16 replaces the Sidebar):** the app shell is a `--surface-100` canvas with a floating white
  `IconRail` (from 960px: the Home circle, Board, Dashboard, Inbox, Activity, Categories, Team) and one white
  rounded app frame holding the `AppHeader` (BrandLogo, `TopNav`, bell, user menu) and the page. Below 960px the
  rail and the top nav become a `NavDrawer` (`BaseDrawer`). The items come from one list, `shell/navItems.ts`.
  Inbox, Activity, and Team share one floating **side panel** on the right. The Board's name is a `BoardSwitcher`
  dropdown in the `BoardHeader` (Board toolbar and filter bar). No Log out or Profile item outside the user menu.
  **Example:** clicking "Inbox" in the rail, the top nav, or the header bell calls `toggleSidePanel("inbox")`.

- **Rule:** A card drag-and-drop move inserts a placeholder element at the
  drop target, animates siblings into place with a FLIP transform, and on
  drop calls the backend to persist the new column/order — reconciling
  local state with the response.
  **Rationale:** This is the exact pattern already proven in the prototype
  (`makePlaceholder`, `flipBoard`, `syncDataFromDOM`), and it's the only way
  the new position survives a page refresh.
  **Example:** on drop, `PATCH /api/cards/{id}/move` with the computed
  `Float` order, then re-render from the server response.

- **Rule:** All colors, spacing, radii, and shadows are the CSS custom
  properties defined in `styles/tokens.css` (`--brand`, `--surface-*`, `--ink*`,
  `--space-*`, `--radius-*`, `--shadow-*`, the `--label-*` pairs), kept in
  `styles/tokens.css` and exposed to Tailwind through its `@theme` block.
  Components use the token-backed utilities (`bg-brand`, `p-4`, `rounded-md`),
  never Tailwind's default palette, an arbitrary value, or a hard-coded hex or
  pixel value. The look follows the product owner's visual reference (light
  surfaces, navy brand, pastel tags, icon rail, flat columns); spacing, motion,
  and hierarchy may be refined without changing that palette or layout.
  **Rationale:** One token set behind `BaseButton`/`BaseBadge`/`BaseModal`
  keeps the whole look in one file while Tailwind and
  shadcn/ui supply the utilities and accessible primitives.
  **Example:** `<BaseBadge tone="red">High</BaseBadge>` renders
  `bg-label-red text-label-red-fg`; `bg-[#f6dada]` is a violation.

- **Rule:** The card detail view is one large two-pane modal (the viewport
  minus a margin) used for **both** viewing and editing, with a fixed header,
  two panes that scroll on their own, and a fixed footer. The header reads
  "card title | board name" and follows the title field live, with the column as
  a badge. The left pane has three cards: **Details** (title, attribute chips,
  description), **Attachments** (bordered tiles with a type icon and a small file
  name), and **Subtasks**; the right pane has two cards: **Comments** (composer,
  thread) and **Activity** below it — never a separate screen or a second modal
  for comments. The footer holds every action, right-aligned: Archive and Delete
  (a confirm popover); there is no Save changes button (V12, Decision AB: every
  change saves by itself) and no Close button (the header icon and Escape close). There is no column select; a card changes column only
  by drag-and-drop.
  **Rationale:** Editing a card and discussing it are the same moment for the
  person doing it; one card per kind of content keeps the modal scannable, and
  one footer means one place to look for actions.
  **Example:** (V12) there is no `Save changes`; the title input sends one
  `PATCH { title }` on blur or Enter; the comment composer posts independently.

- **Rule:** Controls share one scale: inputs, selects, buttons, and chips are 40px
  high (compact buttons 32px); body and control text is 14px, secondary text 13px,
  labels and tags 12px; cards in the modal are 24px apart with 20px padding and 16px
  between elements. All of it comes from tokens.
  **Rationale:** An input beside a button must have the same height, and text sizes
  picked case by case make a form look unbalanced.
  **Example:** the "Add link" row uses `min-h-control` on both the input and the button.

- **Rule:** An activity row reads actor, action, object, and where it went: "**Manager**
  moved “Card title” from [Todo] to [In Progress]". The backend stores the names in
  `metadata` so the row needs no lookup; rows written before that fall back to generic
  wording. Sidebar tooltips show on hover and keyboard focus only, never after a click.
  **Rationale:** A log that says "someone updated a card" cannot be trusted or used.
  **Example:** `describeActivity(entry)` returns `{ actor, verb, object, detail }`.

- **Rule:** Category, priority, dates, and assignee show in the card modal as
  chips (label pill, flag chip, one date-range chip with a red Overdue state,
  avatar with an add button); each opens a popover that saves its own field when
  the value is confirmed or the popover closes (V12, Decision AB: no draft, one
  `PATCH` with one field, the two dates together). Dates use one range calendar with
  optional Start date and End date fields and the range shown as a block; a
  start later than the end is never accepted (days before the start are disabled
  while the end is picked; moving the start past the end clears the end). The
  assignee popover has a search box, the board's members, a single choice, and
  Remove, and is hidden from a Member.
  **Rationale:** The Trello-style chip and popover model keeps the card face of
  the modal compact, and one field per save gives one clear activity row each.
  **Example:** `normalizeRange(start, end, picked)` in `lib/dates.ts` holds the
  date rules so they are tested without a browser.

- **Rule:** The board page does not scroll: the header stays fixed, columns
  scroll sideways, each column scrolls vertically inside itself, and its "Add a
  card" action stays pinned at the bottom. Card drag-and-drop uses the HTML5
  drag-and-drop API (draggable cards, `dragover` and `drop` on each column body);
  a pointer-event rewrite was tried and reverted at the product owner's request.
  **Rationale:** The first, simpler drag behaved the way the product owner wants;
  the column bodies only gained their own scrolling.
  **Example:** `onDragOver` on a column body finds the target index and shows the
  placeholder; `onDrop` calls the move once.

- **Rule:** Every card modal pane scrolls vertically on its own when its content
  is taller than the space between the header and the footer (the pane grid has
  one row as tall as the body: `lg:grid-rows-1`).
  **Rationale:** A fixed-height modal that clips its content hides fields.
  **Example:** a card with many subtasks scrolls inside the left pane.

- **Rule:** The application is named RevoBoard. The Sidebar's toggle is the logo:
  expanded it shows the full logo (mark with the RevoBoard wordmark); collapsed it
  shows the mark alone with the tooltip "RevoBoard". The logo and the favicon are
  the files the product owner supplied (V11, Decision X): `app/favicon.ico` (file
  convention, no manual `<link>`) and `public/brand/logo-revo.svg` and
  `public/brand/logo-text-revo.svg`, shown only through `BrandLogo`
  (`components/shared/BrandLogo`, variants `mark` and `full`, `next/image` with
  `unoptimized` because Next.js does not optimize SVG). Alt text is "RevoBoard", or
  empty where a labelled control or the visible name sits beside it; `width` and
  `height` are the `viewBox` (203 by 203, 704 by 121) and the display never
  exceeds them. Both SVG files wrap a raster PNG (203 by 203 and 704 by 121, with
  alpha transparency), cropped from a supplied reference image, so they sit on a token surface tile on the
  brand panel. Corner radii stay small (Cards, columns,
  buttons, popovers, modal: 8px or less) through the radius tokens.
  **Rationale:** The product owner wants the calmer, less rounded look of the
  reference.
  **Example:** `--radius-card: 6px` in `styles/tokens.css`; `<BrandLogo variant="mark" decorative />`
  inside the collapsed toggle, never a raw `<img src="/brand/logo-revo.svg">`.

- **Rule:** Comments and activity rows show the name the API sends
  (`author_name`, `actor_name`); the board-member map is only a fallback, and
  "Someone" appears only when no name arrived.
  **Rationale:** A manager or supervisor who is not a board member is not in the
  member map, so a map-only lookup showed "Someone" for known people.
  **Example:** `describeActivity(entry)` reads `entry.actor_name` first.

- **Rule:** The font is Inter, self-hosted through `@fontsource-variable/inter`
  and the `--font-stack` token; no request goes to a third-party font service.
  **Rationale:** Atlassian Sans (Trello's font) is proprietary; Inter is the
  nearest open font and ships with the app.
  **Example:** `app/layout.tsx` imports `@fontsource-variable/inter` once.

- **Rule:** The comment thread renders priority comments first (with a
  priority indicator), then the remaining top-level comments under a
  visible **Latest / Popular** toggle — "Popular" shown as a reply-count
  badge, not a like count — each with its (max one level of) replies nested
  underneath. A "Reply" action appears only on top-level comments, never on
  a reply. There is no like button anywhere in the thread.
  **Rationale:** Matches the agreed comment model exactly — the UI shouldn't
  offer an action (liking, or replying to a reply) that the backend doesn't
  support or will reject.
  **Example:** `<CommentThread sort={sort} onSortChange={setSort}/>` renders
  the toggle; clicking "Reply" only shows on `comment.parentId === null`.

- **Rule:** The **"create new card"** action renders only where the API
  sets `can_create_card` (author is a manager and the viewer is a supervisor,
  manager, or admin) — it does not depend on `is_priority`.
  **Rationale:** Keeps the two signals visually and logically separate: a
  priority badge can appear on anyone's comment, the create-card button only
  on a manager's.
  **Example:** `{comment.canCreateCard && <BaseButton size="sm">Create card</BaseButton>}`.

- **Rule:** The board's filter row renders category chips fetched from
  `GET /api/boards/{id}/categories` — never a hard-coded chip list. For
  supervisor/manager/admin, the sidebar has a **Categories** entry that opens
  a small CRUD screen (add/rename/recolor/delete) scoped to the current board.
  **Rationale:** Categories are now a real per-board feature, not the
  prototype's fixed Design/Dev/Bug/Research chips — the UI has to reflect
  whatever categories that specific board actually has.
  **Example:** switching boards re-fetches and re-renders a different chip
  set in the filter row.

- **Rule:** Clicking an attachment (link or file) opens it with
  `target="_blank" rel="noopener noreferrer"` — there is no in-app preview
  or viewer modal. A file attachment's `href` is the short-lived signed
  `file_url` from the API; if it has expired, the client calls
  `GET /api/attachments/{id}/url` for a fresh one before opening.
  **Rationale:** Matches the agreed behavior, and keeps file access behind the
  same board-visibility checks as the card.
  **Example:** `<a href={attachment.url} target="_blank" rel="noopener noreferrer">{attachment.name}</a>`.

- **Rule:** The subtask checklist renders as a flat list of checkboxes with
  inline-editable titles and a drag handle for reordering — no nested modal,
  no per-subtask detail screen.
  **Rationale:** A subtask is meant to be checked off in passing, not opened.
  **Example:** clicking a subtask's checkbox calls
  `api.subtasks.update(id, { isDone: true })` directly from the list row.

- **Rule:** Default every component to a Server Component; make it a Client
  Component (`"use client"`) only when it needs state, an event handler, or a
  browser API (drag-and-drop, the modal, the comment composer, the sort
  toggle, the search input).
  **Rationale:** Most of a card's content (description, dates, activity text)
  never changes without a page re-fetch — shipping it as a Server Component
  means less JavaScript sent to a phone on a slow connection.
  **Example:** `CardDescription` and `ActivityList` are Server Components;
  `CardModal`, `CommentComposer`, and the drag-and-drop `Board` are Client
  Components.

- **Rule:** The login and register pages follow a modern split-panel SaaS
  auth layout — a brand/illustration panel alongside a form panel, an
  elevated rounded form card, generous whitespace — in the direction of the
  referenced design (a Dribbble HRIS dashboard login shot). I couldn't load
  that page's actual visuals here, so this is the general pattern to build
  toward, not a pixel-exact spec; send a screenshot if closer fidelity matters.
  **Rationale:** Names a concrete visual direction for the two pages that
  otherwise have no design reference at all, without inventing detail that
  wasn't actually seen.
  **Example:** desktop: two columns, illustration/brand side + form side;
  mobile: the illustration panel collapses away and only the form remains.

- **Rule:** The prototype's per-card 0–10 `progress` meter, `views` counter,
  and decorative Overview/Notes/Questions tabs are **stretch** features —
  build the required fields (priority, dates, attachments, subtasks,
  categories, assignment, comments, activity, notifications) first; only
  then layer these in, kept visually as-is. (Category chips are a required
  feature now, not stretch — see the category filter-row rule above.)
  **Rationale:** `progress`/`views`/the extra tabs weren't in the original
  feature list; they stay in scope by request, but shouldn't delay or crowd
  out the core paths.
  **Example:** ship `Card.priority`/`start_date`/`end_date`/subtasks/category
  end-to-end before adding `Card.progress`/`Card.views_count`.

- **Rule:** Comments/activity-log sections and the Inbox panel render only
  when the API response includes that data — the UI never decides on its own
  to hide them for a role; absence of the field *is* the access control.
  **Rationale:** Keeps "guests never see comments/activity" enforced in one
  place (the backend), so the frontend can't drift out of sync with it.
  **Example:** `{card.comments && <CommentThread items={card.comments}/>}` —
  a guest's API response simply omits `comments`/`activity`.

- **Rule:** One visual system: page and modal titles 18px semibold, section
  headings 14px semibold, body 14px, secondary 13px muted, labels 12px medium
  muted; an 8px grid with 16px padding in every card, 12px between rows, 24px
  between sections. Every select is a searchable `BaseCombobox` (search shown from
  six options); every tooltip is a `BaseTooltip`; every destructive action asks in
  a `BaseConfirm` popover. Buttons: danger to delete or remove, secondary to
  archive or cancel, primary to submit, save, or add.
  **Rationale:** Mixed sizes, ad-hoc selects, and unconfirmed deletes made the UI
  feel unbalanced and risky.
  **Example:** the attachment type picker is `<BaseCombobox options={[Link, File]} />`.

- **Rule:** The Sidebar has one Team members section (no separate Members entry);
  Managers and Admins add members from its heading (V12: the owner no longer
  adds directly; the owner uses the Invite button) and the owner, Managers, and
  Admins remove them per row. The list starts with the owner, tagged "Owner",
  and the owner row has no remove button (V12 round 2). The Board header is one row with no Add Member button and no settings icon.
  **Rationale:** One place per feature, and more height for the board.
  **Example:** the add button opens `MemberSearch` over `GET /boards/{id}/candidates`;
  each result shows the full name, then the username and email. The sidebar's own
  member rows show no email. The Invite modal's pending list shows each
  requester's avatar or initials, full name, username, and email (V12 round 2,
  owner, Manager, and Admin only); no Inbox row shows an email.

- **Rule:** The Inbox and the activity lists load one screen of rows and a Load
  more action (Decision J). V12 (Decision AB) replaces the old clause that
  attachment changes wait for Save changes: attachments, subtasks, and comments
  save at once, and closing the modal waits for a save in flight, or asks only
  when a field is in a failed state.
  **Rationale:** Long lists stay fast, and the modal never holds changes the
  user thinks are saved.
  **Example:** `api.notifications.inbox({ limit, before })`.
- **Rule:** Card modal auto-save (V12): title and description save on blur or
  Enter (Ctrl or Cmd+Enter in the description) only when the value changed and
  the title is not empty; each field shows Saving, Saved, or an inline error with
  Retry in an `aria-live="polite"` region; a response merges only the keys that
  request sent; concurrent edits are last write wins. Subtask checkboxes and
  titles, attachment adds, and comments save at once. Removing an attachment and
  deleting a comment use the **modal** form of `BaseConfirm`; delete card,
  delete subtask, remove member, regenerate or disable a link, and remove
  profile picture use the **popover** form.
  **Rationale:** Per-field saves match how people edit and give per-field history.
  **Example:** `useFieldSave({ saved, send, apply }).commit(value)` returns without a request when `value === saved`.
- **Rule:** Each Inbox row is a link (`next/link`) to `/boards/{id}?card={card_id}`
  (assigned, deadline), `/boards/{id}?invite=1` (join requested, for owner, Manager,
  Admin), `/boards/{id}` (added), or `/boards` (join rejected); activating it marks
  the notification read and closes the panel. An archived, deleted, or
  inaccessible target shows a short message in place, never a blank page.
  **Rationale:** A notification should open what it is about.
  **Example:** `hrefFor(n)` in `lib/notifications.ts` is a pure function with tests.
- **Rule:** The Subtask checkboxes are enabled for staff and for a Member only on
  a card assigned to them, disabled elsewhere and in the shared view; the card
  face and the Subtasks card show the derived progress meter ("done of total",
  no meter without subtasks). Progress has no input anywhere.
  **Rationale:** The checklist is the one source of progress.
  **Example:** `progress` and `subtask_done_count` come from the API; the client never computes them.
- **Rule:** The `/profile` page is a full-width container: one column below 960px
  and two equal columns from 960px (avatar and account left, change password
  right), with 16px card padding, 24px between cards, and 40px controls.
  **Rationale:** Wide screens should show both tasks at once.
  **Example:** `grid grid-cols-1 gap-6 min-[960px]:grid-cols-2`.

- **Rule:** Category and Priority look different on every card: the Category is a
  soft-filled pill with a dot, the Priority an outlined badge with a flag; both
  in lowercase. Category names always display in lowercase (styling only).
  **Rationale:** Two pills of the same shape read as one kind of information.
  **Example:** `<BaseBadge shape="outline" tone="red"><Flag/> high</BaseBadge>`.

- **Rule:** Every signed-in page sits under one persistent `AppHeader`: the
  sidebar toggle below 960px, the page context (on a board: the name, the "Public link" button for a Manager
  and an Admin, and the "Invite" button for the owner, Manager, and Admin; there
  is no visibility icon in V12), the Inbox
  bell, and a user-icon menu (`BaseMenu`, trigger named "User menu") whose items
  are **Profile** above **Log out**. Log out calls `POST /api/auth/logout` and
  clears the cookie even when the call fails. The `/profile` page edits full
  name and avatar (choose an image, preview it, upload, remove; PNG, JPEG, or
  WebP up to 2 MB, with initials as the fallback; `BaseAvatar` draws every avatar: comments,
  member lists, board cards, and the card modal), shows username and email
  read-only, and changes the password (current and new, at least 8).
  **Rationale:** One entry point for account actions, reachable on a phone.
  **Example:** `<UserMenu />` renders `Profile` then `Log out`; the Sidebar has neither.
- **Rule:** The login form is one "Username or email" field plus a password: a
  value containing `@` is validated as an email, any other value as a username
  (3 to 30 of `a-z 0-9 _ .`). The register form has full name, username, email,
  and password, checks availability on blur, and shows `error.details` beside
  each field. On a `429` the form shows a mm:ss countdown from
  `error.details.retry_after` and disables submit until it ends.
  **Rationale:** The server decides the identifier type; the client only avoids
  sending a value that cannot match.
  **Example:** `classifyIdentifier("ada@x.io")` is `"email"`; `classifyIdentifier("ada")` is `"username"`.
- **Rule:** Every page of the `(app)` route group is guarded by
  `frontend/proxy.ts`: a request without the `kanban_token` cookie, or with one
  that is malformed or expired, is redirected to `/login?next=<safe path>` and
  the cookie is removed. A server render that gets a Backend `401` redirects to
  `/session-expired`, which removes the cookie and redirects to `/login`. The
  `next` value is used only when it is a local path under `/boards`, `/profile`,
  `/admin`, or `/invite/`; `/invite/{token}` is guarded too (V12). `/login`, `/register`, and `/shared/{token}` are not guarded and
  ignore a stale cookie.
  **Rationale:** Guests no longer browse boards; the Backend 401 stays the
  authority, and a stale cookie must not leave a user on an error page.
  **Example:** `GET /boards` with the cookie `bogus` answers a redirect to
  `/login?next=%2Fboards` and clears `kanban_token`.
- **Rule:** `/shared/{token}` (the public link) renders a read-only board and
  card modal with a "Shared view, read only" banner and a Sign in link ("Go to
  Home" when signed in): no drag-and-drop, add, edit, assign, comments, activity,
  inbox, sidebar, user menu, Invite, or Public link button, and no enabled
  checkbox, for any visitor. A signed-in user with board access is redirected to
  the normal board. The page sends
  `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex`. An invalid link
  shows one "link is not valid" page.
  **Rationale:** A guest gets status only, and the token must not leak.
  **Example:** `GET /api/shared/{token}` returns `has_board_access`; when true the page redirects.

## V13: titles, role tag, control sizes
- **Rule:** every document title is `RevoBoard | <name>` (root `title.template`); a Board uses `generateMetadata`; an open Inbox or Activity panel (and an open Card) sets and restores `document.title`. Cut at 60 characters; never put a token or Email in a title.
- **Rule:** assignee options and Team members rows carry a role tag (`BaseBadge`, "Supervisor" or "Member"); the members endpoint returns `role`.
- **Rule:** header and modal buttons are 40 pixels (`md`); compact 32 pixels only inside a dense row; a field and its button share one height.

## V16: design system, landing page, two hosts

- **Rule:** one token file (`styles/tokens.css`), no marketing layer. Radius roles `sm` 8, `field` 12, `card` 16,
  `frame` 24, `full`; primary actions are teal pills 36px high, compact pills 28, chips 24, fields 40 with no
  border; headings in Plus Jakarta Sans, the rest in Inter, both self-hosted. Controls shorter than 44px keep a
  44px hit area below 960px (`touch-target`). Every recipe is in Requirement 38, criterion 18.
- **Rule:** the landing page is `app/site/page.tsx` plus `components/landing/`, served at `/` on the Site_Host
  through a rewrite in `proxy.ts`; it calls no API and reads no cookie. `lib/host.ts` is the pure routing table
  and `lib/origins.ts` reads `SITE_URL` and `APP_URL` at request time. The App_Host sends `X-Robots-Tag: noindex`.
- **Rule:** the Dashboard (`/dashboard`, Supervisor and Manager) reads `GET /analytics/throughput` and the
  existing analytics; the throughput comes from `cards.completed_at`.

## V17: paths, navigation, confirmation, slugs (draft until approved; specs/v17/)

- **Rule:** One origin. The landing page is `app/page.tsx` at `/`; every other page lives under `app/app/` and is served at `/app/...`. The browser calls the API at `NEXT_PUBLIC_API_URL` (`/app/api` in production; nginx strips `/app`). `lib/host.ts`, `lib/origins.ts`, `SITE_URL`, and `APP_URL` are gone. The session cookie is `Path=/app`. Old paths (`/boards`, `/login`, ...) answer 308 to their `/app` equivalent.
  **Rationale:** One domain, one certificate, one deploy; the landing page never receives the cookie.
  **Example:** `/app/b/q3-launch-plan/list`.
- **Rule:** Every internal link and `router.push` is built by a helper of `lib/routes.ts` (`boardPath(slug)`, `cardPath(slug, id)`, ...); no component writes `/app/...` by hand. The Board URL is `/app/b/{slug}`; after a rename the page replaces the URL with the new slug; an old slug is a 404, never a redirect.
  **Rationale:** One place changes when a path changes.
  **Example:** `hrefFor(n)` returns `cardPath(n.board_slug, n.card_id)`.
- **Rule:** Navigation is a left **Sidebar** (global: Dashboard for Supervisor and Manager, My Tasks, Boards, Users for Admin; expanded by default, state kept per browser, read safely) and a board-only **Top_Menu** in the App_Header (Board, List, Calendar, Activity, Members, Categories, Share). Notifications open only from the bell. The Side_Panel shows `inbox | activity | members | categories`. Both lists come from `shell/navItems.ts`, and no item is in both. The V16 Icon_Rail and Top_Nav are removed. (V17 supersedes the V16 shell rule at the top of this file for the navigation items.)
  **Rationale:** Global places and the open Board's places were mixed in one list.
  **Example:** `sidebarItems` and `topMenuItems` have disjoint ids.
- **Rule:** One `ConfirmDialog` (`components/shared/ConfirmDialog.tsx`, over `BaseModal`) asks before creating a Board, Column, Category, Card, user, Invite_Link, or Public_Link and before every delete, remove, disable, or regenerate. `BaseConfirm` is removed. Comments, replies, Subtasks, attachments, and Join_Requests are not confirmed.
  **Rationale:** One component, one wording and focus behaviour.
  **Example:** `<ConfirmDialog tone="danger" title="Delete column “Review”?" confirmLabel="Delete" />`.
- **Rule:** Forms clear a field's error when that field changes, validate every field on submit, and show every error at once. Select options show the pointer highlight only while the pointer is over them.
  **Rationale:** Stale errors and sticky highlights read as bugs.
  **Example:** typing in a failed email field removes its error at once.
- **Rule:** Due state ("Overdue", "Due tomorrow") comes from the API's `due_state`, never from the browser date. Dashboard greeting and Calendar "today" use the browser's local time.
  **Rationale:** `APP_TIMEZONE` is the one source of "today" for data.
  **Example:** `<BaseBadge tone="danger">Overdue</BaseBadge>` only when `card.due_state === "overdue"`.
- **Rule:** The Share modal is the one place for the Invite_Link, pending Join_Requests, and the Public_Link; the Public link section shows to a Manager and an Admin only. The Profile has About, Security, and Notifications tabs (`BaseTabs`, adds `@radix-ui/react-tabs`). A 404 uses `app/not-found.tsx` and shows no slug.
  **Rationale:** One entry per feature.
  **Example:** `?invite=1` opens the Share modal.
