# Overview, V18 changes (draft, awaiting owner review)
V18 is a specification change only. No application code, migration, test, or deploy file is written until the owner approves this version (task 40.1).

V18 is a polish and permissions round on top of V17. It does four things:
1. **One feedback channel and one visual rhythm.** Every action result is a toast at the bottom right; one spacing, control-size, and chip-size scale is applied to the whole project; list options no longer look selected on open (Requirements 60 and 61).
2. **Shell and lists.** The logo moves into the Sidebar, a Sidebar item is active on its whole subtree, every page that is not a Sidebar destination gets a back arrow to its parent, the Users page is sorted, paged, and full width, and the Boards page gets search and sort (Requirements 62, 63, 64).
3. **Dashboard and My Tasks.** An Admin may open the Dashboard (every Board, like a Manager); the filter bar is rebuilt from the Design_System; My Tasks and assignment are closed to a Manager (Requirements 65 and 66).
4. **Board and Card.** Columns can be dragged; the Card modal is wider and reordered, pages its comments and activity, and stops clipping its focus ring; a Member's rights on an assigned Card are narrowed and made per-item; the Members and Categories panels are fixed (Requirements 67 to 71).

Everything in `specs/v1/` to `specs/v17/` stands except where a V18 file supersedes it. Superseded criteria stay in place with a note "Superseded by Requirement N, V18". Decision B changes in one point only: an Admin reads the Dashboard (Decision BM). An Admin still cannot comment, flag a priority comment, or be an assignee.

V18 introduces no visual language of its own: every visual rule uses Design_System tokens and the references in `design/reference/v2/`. Requirement 61 adds tokens to the Design_System (a spacing scale, control heights, chip heights, a category palette); it does not add colours outside the palette.

## What the owner decided (this round)
| Question | Answer |
|---|---|
| Toasts | Bottom right, every success and error of an action, app-wide; field errors stay next to the field. Library `sonner`. |
| Users page order | Role (Admin, Manager, Supervisor, Member), then name A to Z; 20 rows per page, paged by the Backend. |
| "Board page" search and sort | The Boards list page: search by name, sort by `created_at` or `updated_at`, both directions. |
| Back arrow | Goes to the parent page (not browser history). Sidebar destinations have none. |
| Admin Dashboard | Yes; an Admin sees every Board, like a Manager. |
| Supervisor Dashboard | Unchanged: only the Boards the Supervisor owns. |
| My Tasks and Manager | Hidden for Manager and Admin; the Backend refuses a Manager or Admin as assignee. |
| Who comments | A Manager, a Supervisor with Board_Staff_Access (owner or BoardMember), and a Member on a Card assigned to them. No one else (Admin included). |
| Member on an assigned Card | Edits description; adds subtasks, attachments, comments; edits and deletes only their own subtasks, attachments, comments; checks or unchecks any subtask; still moves the Card. |
| Comments page size | 5 first, then 5 more per "Load more"; activity the same. |
| Card modal width | 960 pixels on desktop. |
| Category colours | A fixed palette of 18 tested swatches, not a free picker. |
| Spacing scale | Label to input 8px, between fields 16px, between sections 24px, page padding 24px (32px from 960px), control height 40px. |
| Column drag | Reuse the existing card drag code in `Board.tsx`; no new library. |
| Process | Specs first; owner reviews before any build. |
| Sidebar toggle (round 2) | The logo is the toggle; no separate expand icon; `--space-section` below the logo. |
| Header (round 2) | A border line under the App_Header; the Top_Menu centred. |
| Shapes and magic numbers (round 2) | One radius per role; every form control shares one look; no magic number anywhere, enforced by a test. |
| Type, auth, landing (round 5) | Six text sizes, one size per heading level; one page frame; auth and landing on the same scale; landing copy cut. |
| Board and type (round 4) | Column padding from the inner row, the last Column keeps its gutter, Columns share the row from 960 px; seven text sizes; no Board meta line. |
| One radius (round 3) | `--radius-ui` for every component, `--radius-full` for circles only; `--pad-surface` and `--pad-item` for padding; a larger page gutter; a full-size Card modal; inset focus rings. |
| Dashboard range (round 2) | No presets; From and To only; the four filters in one row. |

## Files
| File | Requirements |
|---|---|
| `42-FEEDBACK-AND-DESIGN-CONSISTENCY.md` | 60 Toasts, 61 Design consistency |
| `43-SHELL-AND-LISTS.md` | 62 Sidebar logo, active state, back arrow; 63 Users page; 64 Boards list search and sort |
| `44-DASHBOARD-AND-MY-TASKS.md` | 65 Dashboard access and filter bar; 66 My Tasks and assignee roles |
| `45-BOARD-AND-CARD.md` | 67 Column drag; 68 Card modal layout and paging; 69 Card permissions; 70 Members panel; 71 Categories palette and refresh |
| `46-VERIFICATION.md` | 72 Verification of V18 |

## Decisions (V18)
| ID | Decision | Requirement |
|---|---|---|
| BK | One toast channel for action results (supersedes inline success and non-field error banners). | 60 |
| BL | One spacing, control, and chip scale; no default option highlight in lists. | 61 |
| BM | An Admin reads the Dashboard over every Board (amends Decision B and Requirement 10 criterion 4 and DASH-19). | 65 |
| BN | Manager and Admin are never assignees; My Tasks is for Member and Supervisor. | 66 |
| BO | Column reorder by drag, on the existing drag code and `PATCH /api/columns/{id}/move`. | 67 |
| BP | Member rights on an assigned Card are per field and per item; subtasks and attachments record their creator. | 69 |
| BQ | Comment rights follow Board_Staff_Access for staff and assignment for a Member. | 69 |
| BR | Category colour is one of 18 palette keys, validated by the Backend. | 71 |

## Open Questions (V18)
74. **Old subtasks and attachments without a creator (default applied):** rows created before V18 get `created_by_id` null. A Member cannot edit or delete them (only check a subtask); staff can. Backfilling from the activity log is possible but not exact, so it is not done.
75. **Description only (default applied):** a Member's `PATCH /api/cards/{id}` may carry `description` only; title, priority, dates, category, and assignee are refused with 403. The Member still moves the Card through the move route.
76. **Comment editing (default applied):** comments have no edit route today; V18 adds none. "Own comments" means delete.
77. **Admin and comments (default applied):** Decision B stands; an Admin reads comments and never writes them.
78. **Page size of activity (default applied):** the owner set 5 for comments; activity uses the same 5 so the two panes match.
79. **Board list sort default (default applied):** `updated_at` descending (the most recently changed Board first).
80. **Toast and ConfirmDialog (default applied):** an error raised by a ConfirmDialog action stays in the dialog's error area (FIX-07, COL-05) because the dialog is still open; a success closes the dialog and shows a toast.
81. **Back arrow parents (default applied):** the table in NAVB-05. The Card modal has a close control, not a back arrow.
