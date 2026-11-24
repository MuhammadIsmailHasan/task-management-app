# Overview, V16 changes (draft, awaiting owner review)

V16 rebuilds the look of RevoBoard from the owner's prototype `design/kanban-prototype-v2.html` (13 pages) and splits the public site from the app. It is a specification change only: no code is written until the owner approves this version.

The look is specified from the rendered prototype, not from its source: the 13 pages were rendered in Chrome at 1440 and 390 pixels wide, their computed styles were measured, and the renders are kept in `design/reference/v2/` (Requirement 38, DS-25). The first draft of V16 took its radii, button heights, and colours from the prototype's Tailwind configuration and class names and was wrong in several places (flat rail, navy primary buttons, 8 to 12 pixel radii, bordered inputs); this version replaces those values with the measured ones.

Everything in `specs/v1/` to `specs/v15/` stands except where this file or a V16 file below supersedes it. The V15 rule "the Stitch design is a visual and spacing reference only" is narrowed: for look and for the app shell the prototype is now the source of truth (Decisions AQ to AT); behaviour, scope, data, and permissions still come from the specs, and the exclusions list below stays in force.

The prototype names the product RevoTask. The product name is RevoBoard (Decision AO, V15) and every V16 page uses `BrandLogo` and the name RevoBoard.

## What the owner decided (this round)

| Question | Answer |
|---|---|
| Shell | Adopt the prototype's icon rail plus top pill nav (reverses part of V15 and Decision I). |
| Landing host | Same Next.js app, routed by host. |
| Landing style | One design system for the whole product. **No separate marketing token layer** (the owner corrected the earlier "marketing token layer" choice): landing, auth, and app share the same tokens and components, so every component looks balanced next to the others. |
| Dashboard | Add a throughput endpoint. |
| Name | RevoBoard. |
| Scope of this round | Update the specs only; do not implement. |

## Decisions Log (added)

| ID | Decision | Rationale | Where applied |
|----|----------|-----------|---------------|
| AQ | **One design system, measured from the prototype (V16; amends Decisions H and I).** `frontend/styles/tokens.css` stays the single source of every colour, type, spacing, radius, shadow, size, layer, duration, and opacity value. It is extended with the prototype's palette, type scale, and radius scale. No second token set exists for the landing page. Every component follows one component recipe table (height, radius, padding, type, fill, shadow) whose values were measured on the prototype's canonical pages (1, 5, 10, 11, 12, 13); pages 3, 4, 6, 7, 8, and 9 are redrawn with the same recipes because they use a different colour set and radii. | The owner wants every component to look balanced next to the others, and a marketing-only layer would let the landing page drift from the app. | Requirement 38 |
| AR | **Typography (V16; amends Decision I, Requirement 14 criterion 17).** Headings use Plus Jakarta Sans and everything else uses Inter, both self-hosted with `@fontsource-variable` and no third-party font request. The prototype's type scale is the scale. | The prototype sets headings in Plus Jakarta Sans. Two self-hosted families keep the no-third-party-request rule. | Requirement 38 |
| AS | **Radius, size, and elevation (V16; supersedes the 8 and 10 pixel radius limit of Requirement 14 criterion 19, the 40 and 32 pixel control sizes of Requirement 14 criterion 20 and V13, and Decision I).** Radius is a role scale measured on the prototype: sm 8, field 12, card 16, frame 24 pixels, and full (pills and circles). Primary actions are teal pills, 36 pixels high; compact pills are 28; chips are 24; fields are 40. Shadows are a named scale of seven. | The prototype uses larger radii and pills. A role scale keeps them consistent instead of per-component. | Requirement 38 |
| AT | **App shell (V16; supersedes the Sidebar of Decisions I and L, Requirement 14 criteria 6, 7, 16, 21, 24, and 26, and the Sidebar parts of Requirements 3, 6, 8, 9, 19, 21).** The Sidebar is replaced by an Icon_Rail, a Top_Nav of pills, a Board_Switcher dropdown, and a Team view in the Side_Panel. Log out and Profile stay in the User_Menu. | The owner chose the prototype shell. | Requirement 39 |
| AU | **Landing page (V16; resolves Open Question 36).** A public, static, server-rendered page on the site host, built from the shared components, with no API call and no session read. | The owner wants a promotion page and wants the app on its own host. | Requirement 41 |
| AV | **Two hosts (V16; amends DEP-05 and DEP-13).** The site host serves the landing page; the app host serves the app and `/api`. One Next.js process serves both and chooses by the `Host` header. The Session_Cookie stays host-only on the app host. | The owner wants the front end moved to `app.<domain>`. One process keeps the deploy as it is. | Requirement 42 |
| AW | **Throughput and the Dashboard (V16; amends Requirement 10).** A Card records `completed_at`, set when it enters a Column named `Done` and cleared when it leaves. Two read-only endpoints return completed Cards per week. A Dashboard page shows them for Supervisors and Managers. | The owner wants the prototype's throughput chart. The current `done_delta` guesses from `updated_at`, which any edit changes. | Requirement 43 |
| AX | **Prototype exclusions (V16; extends the V15 list).** Features the prototype draws that have no spec basis stay unbuilt (the list below). | Keeps scope to the existing features, as the owner asked. | Requirements 39 to 43 |

## Exclusions (the prototype draws these; V16 does not build them)

Carried from V15: card `estimate`; card `status` dropdown; comment `@mention`, emoji, and comment attachments; bookmark, share, and "Done" buttons in the mobile card modal; Activity "Live Stream" chip, online count, system-state percentage, and "Export Audit Trail (CSV)"; a workspace-wide Categories screen with KPI tiles, import, associated boards, and automation rules.

Added in V16:

1. Global search and the `⌘K` hint in the header. Search stays the Board's own search field (Requirement 12).
2. The "Welcome Back" hero, the "Private Workspace" chip, and the "Workspace Ready" chip. Boards have no visibility concept after V12.
3. The sprint concept: "Active Sprint", sprint dates, and "Sprint Velocity". No sprint entity exists.
4. Card identifiers such as `REV-312`, and card text such as "Re-opened", "Needs QA redo", "Verified by", and "PR #842".
5. A second assignee on a card (the prototype shows "Supervisor + Dev"). A card has one assignee.
6. Hour estimates, capacity points, "velocity" percentages, and "+N Tasks" throughput claims on the Dashboard. Only counts the API can compute are shown.
7. On the register page: the Terms checkbox, the "Entropy score" meter, the single "Username or work email" field, and the "Workspace Ready" chip. The form keeps separate Username and Email fields with the availability check (Requirement 1).
8. On the rail: Settings and Log out. Profile and Log out stay in the User_Menu (HDR-02 to HDR-05).
9. Inbox: the Mentions tab, the Assignments tab, "Clear Read", and "Notification Settings".
10. Activity: the keyword, member, and "Critical Only" filters; "Policy Automation" and "Webhook Dispatcher" rows.
11. Shared view: the Overview, Roadmap, and Team header tabs; PDF and CSV export; "Live synced"; "Request Access".
12. Invite and Public link modal: "142 anonymous views", "CDN Cached", domain restrictions, and a role picker for the invite link.
13. Admin user screen: seat quota, "Upgrade License", 2FA, Suspended and Invited states, "Last active", the "Board access" column, "Export Directory", multi-email invitations, and the role radio group. The screen keeps list, create, edit, and role change (Requirement 1 criteria on Admin users).
14. The owner select in the Create Board modal. A Board's owner changes through `PATCH /api/boards/{id}` with `owner_id` (Requirement 3).
15. Landing page: pricing, an "Enterprise" or "PRO" tier, customer logos, testimonials, invented usage numbers, the "NEW" chip, the "Web App Operational" status, the sample card that claims a role checklist and Revision triggers, and any feature the product does not have (for example automated Revision triggers or domain restrictions).
16. Dark mode. The prototype enables `darkMode: "class"` but defines no dark palette.
17. A board-level "Add Task" button. Cards are added at the foot of each Column (Requirement 4).

## Visual decisions taken from the renders

| What the prototype shows | V16 rule |
|---|---|
| The page is a tinted canvas with one large white rounded app frame, and a white pill-shaped icon rail floats outside it | SHELL-01, SHELL-11 |
| Primary actions are teal (`--accent`) pill buttons; dark navy pills are the second kind; quiet tinted pills the third | DS-18 |
| Active filter chip is navy; active Top_Nav item is a tinted pill (page 1) or navy (pages 8 and 9) | page 1 wins (DS-18) |
| Columns, the filter bar, fields, and the Top_Nav track share one tint (`#f3f2ff`); hover and active use `#ebedff`; count badges `#dce1ff` | DS-03 |
| Fields have no border | DS-04 (Open Question 44) |
| Controls are 24, 28, 32, 36, and 40 pixels high, smaller than the 40 and 32 pixel rule of V13 | DS-17, with a 44 pixel hit area below 960 pixels |
| Modals and the Side_Panel are `frame` radius with a blurred scrim; the Side_Panel floats with an inset | DS-18, SHELL-26 |
| The auth card has a navy gradient brand panel with soft teal glows | DS-06, SCR-04 |
| The prototype's mobile renders keep the rail and scroll sideways | not copied (SCR-03) |

## Supersession map

V16 does not edit earlier version files. Where a V16 requirement replaces wording, the earlier criterion stays as history and the table says what replaces it.

| Earlier criterion | What V16 changes |
|---|---|
| Req 3, criterion 9 (Boards list in the Sidebar is the Board switcher) | The Board_Switcher dropdown is the switcher (SHELL-12 to SHELL-15). |
| Req 3, criteria 21 and 23 (long Board names wrap in the Sidebar; two-row Board header) | The name wraps in the Board_Switcher and the Board_Toolbar (SHELL-14, SHELL-18). |
| Req 3, criterion 24 (Team members section in the Sidebar) | The Team_View of the Side_Panel (SHELL-19 to SHELL-21). |
| Req 6, criterion 11 (Categories entry in the Sidebar) | The Categories item of the Top_Nav and Icon_Rail, same roles (SHELL-06). |
| Req 8, criterion 6 and Req 9, criterion 6 (open from the Sidebar) | Open from the Top_Nav or Icon_Rail item (SHELL-07, SHELL-08). |
| Req 14, criteria 6, 7, 16, 21, 24, 26 (Sidebar drawer, collapse, tooltips, type) | The Icon_Rail, the Top_Nav, the mobile drawer, and rail tooltips (SHELL-01 to SHELL-04, SHELL-22). |
| Req 14, criterion 13 (look: navy brand, pastel tags, icon rail, flat columns) | The design system of Requirement 38. |
| Req 14, criterion 17 (Inter only) | Plus Jakarta Sans headings and Inter body (DS-10, DS-11). |
| Req 14, criterion 19 (radius of 10 pixels or less) | The radius role scale (DS-12 to DS-14). |
| Req 14, criterion 20 and Req 31 (type, control, and spacing scale; control sizes of the Invite and Public link controls) | The 8 pixel grid stands; type sizes come from DS-08 and DS-09 and control sizes from DS-17 and DS-18 (primary 36, compact 28, chip 24, field 40). |
| Req 19, HDR-01 (one App_Header) | Kept; the header now carries BrandLogo, Top_Nav, bell, and User_Menu (SHELL-09). HDR-02 to HDR-07 stand. |
| Req 21, BRAND-08 and BRAND-10 (Sidebar toggle logo) | The header shows `BrandLogo` `full` at 960 pixels and wider and `mark` below; the Icon_Rail shows no logo (SHELL-09, SHELL-10). |
| Req 10, criterion 5 (`done_delta` from `updated_at`) | `done_delta` counts Cards whose `completed_at` is in the last 7 days (THR-04). |
| DEP-05 (one origin) and DEP-13 (IP and port 8082 until the domain exists) | Two hosts; the IP and port still work as the app host (HOST-01 to HOST-05, HOST-10, HOST-15). |
| Open Question 36 (landing page) | Resolved by Requirement 41. |

## Glossary (added)

- **Design_System**: `frontend/styles/tokens.css`, the Tailwind theme alias in `frontend/styles/globals.css`, and the Component_Recipes of Requirement 38. It serves the app, the auth pages, and the landing page alike.
- **Component_Recipes**: The table in Requirement 38 criterion 18 that gives each shared component its height, radius role, padding, type token, and shadow.
- **Icon_Rail**: The white pill-shaped bar that floats at the left of every Protected_Route page at 960 pixels and wider, holding the Home circle and icon buttons with tooltips and no logo.
- **App_Frame**: The large white rounded panel on the page canvas that holds the App_Header and the page content.
- **Canvas**: The `--surface-100` page background around the App_Frame and the Icon_Rail.
- **Top_Nav**: The pill-shaped navigation group in the App_Header at 960 pixels and wider.
- **Board_Switcher**: The dropdown in the Board_Toolbar that lists the Boards the viewer may see and replaces the Sidebar Boards list.
- **Board_Toolbar**: The row under the App_Header on a Board page: the Board_Switcher, the progress meter, "Public link", and "Invite".
- **Team_View**: The third view of the Side_Panel (after Inbox and Activity) listing the active Board's members.
- **Site_Host**: The host that serves the landing page (planned `revoboard.belajardeploy.web.id`).
- **App_Host**: The host that serves the app and `/api` (planned `app.revoboard.belajardeploy.web.id`). Requests with any other host, such as the server IP and port 8082 or `localhost`, are treated as the App_Host.
- **Landing_Page**: The public page served at `/` on the Site_Host.
- **Completed_At**: The nullable `completed_at` timestamp on a Card (Decision AW).
- **Throughput_Series**: A list of weekly counts of Cards that were completed in that week.

## Glossary (changed)

- **Sidebar**: removed from the product by Decision AT. It survives only as a historical term in `specs/v1/` to `specs/v15/`.
- **App_Header**: now holds `BrandLogo`, the Top_Nav, the Inbox bell, and the User_Menu trigger (at 960 pixels and wider), or the menu button, `BrandLogo` mark, bell, and User_Menu trigger below 960 pixels.
- **Side_Panel**: the right-side sliding panel shared by Inbox, Activity, and Team (was Inbox and Activity).

## Open Questions (added)

38. **Domain names (V16, open, not blocking the spec):** the planned domain in DEP-13 is `revoboard.belajardeploy.web.id`. V16 assumes the Site_Host is that name and the App_Host is `app.` followed by it. Both come from environment variables (`SITE_URL`, `APP_URL`), so the owner can change them without a code change. The certificate must cover both names.
39. **Rail and Top_Nav carry the same destinations (V16, default applied):** the prototype draws both. V16 keeps both because the owner chose the prototype shell: the rail is the icon-only shortcut and the Top_Nav is the labelled one. The owner may drop one later; only SHELL-01 to SHELL-08 change.
40. **Team destination (V16, default applied):** for a Member, Supervisor, or Manager the Team item opens the Team_View for the active Board. For an Admin it opens `/admin/users`, because an Admin has no Board access by default (Decision B). The owner may change this.
41. **Plus Jakarta Sans (V16, default applied):** adopted for headings in the whole product, not only the landing page, so the system stays one set. The owner may revert to Inter-only by changing DS-10; the scale stays the same.
42. **`done_delta` meaning (V16, default applied):** switching `done_delta` from `updated_at` to `completed_at` changes the number a Supervisor or Manager sees for edits made after completion. The owner may keep the old definition for `done_delta` and use `completed_at` only for the throughput; THR-04 is the only criterion that changes.
43. **Pill-shaped nav on the marketing page (V16, default applied):** the landing header uses the same Top_Nav pill component as the app, with anchor links instead of routes.
44. **Filled fields and small controls (V16, default applied, accessibility risk):** the prototype draws form fields without a border (a tinted fill) and pill buttons 24 to 36 pixels high. V16 copies both because the owner asked for the same visual. A fill-only field has about 1.1 to 1 contrast against white, below the 3 to 1 that WCAG 2.1 asks for a control boundary; the focus ring, the label, and the fill are the cue. Controls below 44 pixels keep a 44 pixel hit area on small screens. The owner may switch to a bordered field by adding a `--border-input` token and changing the Input row of DS-18.
45. **Rail Home circle and announcement bar (V16, default applied):** the rail's first item is the teal Home circle to `/boards`, and a "Board" item appears while a Board is open; the landing page keeps the prototype's navy announcement bar with true copy. The owner may remove either.
