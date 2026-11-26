# Board and Card, V18 (draft)
### Requirement 67: Column Drag and Drop
**User Story:** As a Board_Owner, Manager, or Admin, I want to drag a Column to a new place, so that I reorder the workflow the same way I move Cards.
This requirement amends COL-11 (Decision BO). The rights of COL-01 do not change.
#### Acceptance Criteria
1. [COLD-01] THE Frontend SHALL let the Board_Owner, a Manager, and an Admin drag a Column by a grip handle in its header (`GripVertical`, name "Reorder column <name>") to a new position in the Column row. Dragging SHALL reuse the pointer drag code that moves Cards in `components/board/Board.tsx` (extracted into one hook, `hooks/useDragSort.ts`, used by both), and SHALL NOT add a drag library.
2. [COLD-02] WHILE a Column is dragged, THE Board SHALL show a drop indicator between Columns (`--accent`, `--border-width-focus`), SHALL scroll the board area sideways near its edges, and SHALL NOT start a Card drag. Escape SHALL cancel and put the Column back.
3. [COLD-03] ON drop at a new index, THE Frontend SHALL move the Column at once (optimistic), call `PATCH /api/columns/{id}/move` with the 0-based `position`, reconcile with the response, and on an error put the Column back and show an error Toast. A drop at the same index SHALL send nothing.
4. [COLD-04] THE "Move left" and "Move right" items of the Column menu SHALL stay, as the keyboard way to reorder (WCAG 2.5.7), and SHALL be disabled at the ends. THE Done_Column MAY be dragged (COL-10).
5. [COLD-05] A user without Column rights SHALL see no grip and SHALL NOT be able to start a Column drag.

### Requirement 68: Card Modal Layout and Paging
**User Story:** As a user, I want a roomier Card modal with the parts in a sensible order and long threads cut short, so that I read and edit a Card comfortably.
This requirement amends Requirement 56 (CM).
#### Acceptance Criteria
1. [CMV-01] THE Card modal SHALL be 960 pixels wide from 1024 pixels (a new token `--modal-w-lg`), keep its V17 split (main pane and right pane), and stay full screen below 960 pixels.
2. [CMV-02] THE Card modal SHALL NOT clip any border or focus ring of its controls (DS-12): the main and right panes SHALL have inner padding `--space-section` and the title input SHALL use the inset focus ring.
3. [CMV-03] THE chip row SHALL NOT show the Column chip, because the Column is already in the modal header. Every remaining chip SHALL follow DS-03.
4. [CMV-04] THE main pane order SHALL be Description, Attachments, Subtasks (Attachments moved above Subtasks), so the "Add attachment" popover has room below it.
5. [CMV-05] THE start and end date fields SHALL be `BaseDateField` with a `BaseCheckbox` to enable each (DS-09, DS-10).
6. [CMV-06] THE right pane SHALL show the 5 newest top-level comments first, each with its replies, and a "Load more comments" button at the bottom that adds the next 5, until none is left (then the button is gone). THE activity tab SHALL do the same with "Load more activity" and 5 entries per page (Open Question 78). A posted comment SHALL be added at the top without a reload; the count in the tab SHALL show the total.
7. [CMV-07] THE Backend SHALL accept on `GET /api/cards/{id}/comments` the parameters `limit` (1 to 50) and `offset` (from 0) besides `sort`, and SHALL return `data` of `{ "items": [...], "total": n }` where `total` counts top-level comments and each item carries its replies. WHEN `limit` is absent, THE Backend SHALL return every comment in the same shape. THE number of queries SHALL not depend on the number of comments. THE card activity route keeps its `limit` and `before` paging.
8. [CMV-08] THE select controls of the modal (assignee, priority, category) SHALL follow DS-07 and DS-08.

### Requirement 69: Card Permissions
**User Story:** As a Board_Owner, I want Members to work on their Cards without changing what others wrote, and only the right people to comment, so that a Card stays trustworthy.
This requirement supersedes the "Member edits an assigned Card" rule of Requirement 4 and Requirement 7 criterion on who comments (Decisions BP and BQ). Staff rights (a Supervisor with Board_Staff_Access, a Manager, an Admin) on Cards, subtasks, and attachments do not change; Decision B still keeps an Admin from commenting.
#### Acceptance Criteria
**Data**
1. [PERM-01] THE migration of V18 SHALL add `created_by_id` (UUID, nullable, foreign key to `users.id`, `ON DELETE SET NULL`) to `subtasks` and `attachments`, leave it null for existing rows (Open Question 74), and set it to the actor on every new row. THE subtask and attachment payloads SHALL add `created_by_id` and `can_edit` (boolean, computed for the viewer).
**Matrix**
2. [PERM-02] THE Backend SHALL apply this matrix in the service layer (403 `FORBIDDEN` otherwise). "Assigned Member" is a Member who is the Card's assignee; "Other Member" is any other Member with Board_Access; "Staff" is a Supervisor with Board_Staff_Access, a Manager, or an Admin.
| Action | Staff | Assigned Member | Other Member |
|---|---|---|---|
| Read the Card | yes | yes | yes |
| Edit title, priority, dates, category, assignee | yes | no | no |
| Edit description | yes | yes | no |
| Move the Card (move route) | yes | yes | no |
| Archive, restore, delete the Card | yes (Card_Creator rules stay) | no | no |
| Add a subtask | yes | yes | no |
| Rename, reorder, delete a subtask | yes | only `created_by_id` = self | no |
| Check or uncheck a subtask | yes | yes, any subtask | no |
| Add an attachment | yes | yes | no |
| Delete an attachment | yes | only `created_by_id` = self | no |
| Add a comment or reply | Manager; Supervisor with Board_Staff_Access; not Admin | yes | no |
| Delete a comment | its author only (unchanged) | its author only | its author only |
| Flag a priority comment | unchanged (Requirement 27) | unchanged | no |
3. [PERM-03] `PATCH /api/cards/{id}` from an Assigned Member SHALL accept only `description`; any other field in the body SHALL make the whole request HTTP 403 with the message "Members can only edit the description" and change nothing (Open Question 75).
4. [PERM-04] `PATCH /api/subtasks/{id}` from an Assigned Member who is not the creator SHALL accept only `is_done`; `title`, `order`, `prev`, or `next` SHALL be HTTP 403. `DELETE` SHALL be HTTP 403 unless the Member is the creator.
5. [PERM-05] `POST /api/cards/{id}/comments` and the reply route SHALL return HTTP 403 "You cannot comment on this card" for an Admin, a Supervisor without Board_Staff_Access, and a Member who is not the assignee. Guests keep their V10 rules.
**Frontend**
6. [PERM-06] THE Card modal SHALL show only the controls the viewer may use: an Assigned Member sees the title, chips, and dates as read-only text; edit and delete controls of a subtask or attachment appear only when `can_edit` is true; a subtask checkbox is enabled for any Assigned Member. A viewer who may not comment SHALL see no composer and the line "Only the assignee and board staff can comment." THE Backend still enforces every rule.
7. [PERM-07] THE seed data and the tests SHALL cover each row of the matrix (Property 83).

### Requirement 70: Board Members Panel
**User Story:** As a Board_Owner, I want to tell the people I can add from the people already on the Board, so that I do not add the wrong person.
This requirement amends the Members view of Requirement 47 (NAV-08).
#### Acceptance Criteria
1. [MEMP-01] THE "Add people" search SHALL show its results in a popover under the search field (`--surface-raised`, `--shadow-lg`, the heading "Add to board"), never inline in the members list. EACH result row SHALL show the avatar, the name, the role badge, and an "Add" button; the current members list SHALL show "Remove" (owner only) and no "Add".
2. [MEMP-02] THE members list SHALL sit below the search under the heading "Members (N)", separated by `--space-section`.
3. [MEMP-03] AFTER a person is added, THE search field SHALL be cleared, the popover closed, focus returned to the search field, the list refreshed, and a success Toast "<Name> added" shown. AN error SHALL show an error Toast and keep the search text.

### Requirement 71: Categories Palette and Refresh
**User Story:** As a Board_Owner, I want more colours for categories and to see my changes on the Board at once, so that categories are useful.
This requirement amends the Categories view of Requirement 47 and the category rules of Requirement 8 (Decision BR).
#### Acceptance Criteria
1. [CATP-01] THE Design_System SHALL define 18 category palette keys: `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `emerald`, `teal`, `cyan`, `sky`, `blue`, `indigo`, `violet`, `purple`, `fuchsia`, `pink`, `rose`, `slate`, each as `--cat-<key>-bg` and `--cat-<key>-fg` in light and dark themes, where the `fg` on `bg` contrast is at least 4.5:1 in both themes (Property 85). THE five V17 keys (`green`, `blue`, `red`, `purple`, `orange`) SHALL keep their names, so no data migration is needed.
2. [CATP-02] THE Backend SHALL accept on category create and update only `color` in the palette keys or null, and SHALL return HTTP 400 `VALIDATION_ERROR` with `details.color` otherwise.
3. [CATP-03] THE Categories view SHALL pick a colour with a swatch grid (6 by 3, each swatch a 32 pixel button with the colour name as its accessible name, the chosen one with a check and `aria-pressed="true"`), in a `BasePopover` from a swatch trigger beside the name field.
4. [CATP-04] AFTER a category is created, renamed, recoloured, or deleted, THE open Board, List, Calendar, and Archived views and an open Card modal SHALL show the change without a reload: the Categories view SHALL update the shared Board state (`ShellContext` board categories and the Cards' `category` objects), and a deleted category SHALL be removed from every Card that had it. A success Toast SHALL confirm each change.
