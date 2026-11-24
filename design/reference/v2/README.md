# Reference renders of `design/kanban-prototype-v2.html`

Rendered in Chrome (headless, `playwright-core`) with the network available so the Tailwind CDN,
Inter, and Plus Jakarta Sans load. Desktop is 1440 pixels wide, mobile is 390 pixels wide.
These are the visual reference of V16 (Requirement 38, DS-25). Values in `specs/v16/25-DESIGN-SYSTEM.md`
were measured from these pages; where an image and the spec differ in a detail, the spec wins.

| Files | Prototype page | Screen |
|---|---|---|
| `01-board-*` | 1 Kanban Board (Template Layout) | Board page (canonical) |
| `02-landing-*` | 2 Web Landing Page | Landing page (desktop in three slices) |
| `03-dashboard-*` | 3 Web Dashboard | Dashboard |
| `04-card-modal-*` | 4 Web Kanban Board (Modernized) | Card modal over the board |
| `05-auth-*` | 5 Web Auth | Sign in and register (canonical) |
| `06-invite-public-link-*` | 6 Invite and Public Link | Invite and Public link modal |
| `07-public-board-*` | 7 Public Board | Shared view |
| `08-user-management-*` | 8 User Management | Admin users |
| `09-categories-*` | 9 Categories Management | Categories (the icon font failed to load in this render; icon names show as text) |
| `10-create-board-*` | 10 Create New Board Modal | New Board modal (canonical) |
| `11-inbox-*` | 11 Inbox and Notifications Drawer | Inbox (canonical) |
| `12-board-switcher-*` | 12 Board Switcher | Board_Switcher (canonical) |
| `13-activity-*` | 13 Activity Log Drawer | Activity (canonical) |

Canonical pages (1, 5, 10, 11, 12, 13) share one template. Pages 3, 4, 6, 7, 8, and 9 use a different
colour set and radii and are redrawn with the canonical recipes (DS-26).

Every image shows things V16 does not build: the name RevoTask, "Welcome Back", "Private Workspace",
sprints, card identifiers, estimates, global search, rail Settings and Log out, and the other items in
exclusions 1 to 17 of `specs/v16/00-OVERVIEW.md`. The mobile renders keep the rail and scroll sideways;
V16 does not copy that (SCR-03).
