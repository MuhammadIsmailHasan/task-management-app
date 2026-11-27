# Shell and Lists, V18 (draft)
### Requirement 62: Sidebar Logo, Active State, and Back Arrow
**User Story:** As a user, I want the brand in the Sidebar, to see where I am, and to go up one level with one click, so that I never get lost.
This requirement amends Requirement 47 (NAV) and the App_Header of Requirement 39.
#### Acceptance Criteria
1. [NAVB-01] THE Sidebar SHALL show the RevoBoard logo at its top, and THE logo SHALL be the Sidebar toggle (round 2 within V18): a `button` with `aria-expanded` and the name "Collapse sidebar" or "Expand sidebar" that shows the logo with the word mark while the Sidebar is expanded and the logo mark only while it is collapsed. THE separate expand and collapse icon button SHALL be removed. THE logo SHALL be separated from the first Sidebar item by `--space-section`. BELOW 960 pixels, where the Sidebar is a drawer, THE drawer SHALL show the logo with the word mark (not a toggle), and the App_Header SHALL show the logo mark beside the menu button, linking to the role's home page (Dashboard for Supervisor, Manager, Admin; My Tasks for Member). THE App_Header SHALL no longer show a logo from 960 pixels.
2. [NAVB-02] THE logo SHALL use the existing transparent assets (`public/brand/`) at the `sm` logo height, with empty `alt` text inside the toggle (the button carries the name); the mark-only logo in the App_Header link SHALL have the accessible name "RevoBoard home".
3. [NAVB-03] A Sidebar item SHALL be active WHEN the current path equals its `href` or starts with its `href` followed by `/`, and THE Boards item SHALL also be active on every Board path (`/app/b/...` and `/app/boards/...`). THE active item SHALL carry `aria-current="page"` and the existing active recipe. AT most one Sidebar item SHALL be active.
4. [NAVB-04] A Top_Menu item that is a route SHALL follow the same rule within the open Board (Board is active on `/app/b/{slug}` only; List, Calendar on their path; Archived activates no Top_Menu item and shows the toolbar "Archived" control as pressed).
5. [NAVB-05] THE App_Header SHALL show, at its top left, a back arrow (`ArrowLeft`, `BaseIconButton`, name "Back to <parent>") on every page that is not a Sidebar destination, linking to the parent page in this table (Open Question 81). IT SHALL NOT use browser history.
| Page | Parent |
|---|---|
| `/app/b/{slug}`, `/list`, `/calendar`, `/archived` | `/app/boards` ("Boards") |
| `/app/profile` | the role's home page |
| `/app/invite/{token}` | `/app/boards` |
| `/app/dashboard`, `/app/my-tasks`, `/app/boards`, `/app/users` | none (Sidebar destinations) |
6. [NAVB-06] THE back arrow SHALL keep the parent's query string when the parent is the page the user came from inside the app in this tab (for example `/app/boards?q=sales&sort=updated_at`), read from a `sessionStorage` key set by the parent page; otherwise it SHALL link to the bare parent path.
7. [NAVB-07] THE App_Header SHALL be separated from the page content below it by a 1 pixel `--border` line across the full width of the app frame (`border-b border-line`), at every width (round 2 within V18).
8. [NAVB-08] FROM 960 pixels, THE Top_Menu SHALL be centred in the App_Header between the back arrow on the left and the bell and User_Menu on the right (a three-part row: left and right parts of equal flexible width, the Top_Menu in the middle), and SHALL stay centred whether or not the back arrow shows. BELOW 960 pixels the Top_Menu stays in the drawer (NAV-03).

### Requirement 63: Users Page
**User Story:** As an Admin, I want the Users page to use the whole page, list people in a fixed order, and page through them, so that a long list stays readable.
This requirement amends Requirement 53.
#### Acceptance Criteria
1. [USRP-01] THE Users page SHALL use the full page content width (the shell content area minus `--space-page` on each side), with no narrower `max-width`; the table SHALL scroll inside its card, not the page, below 960 pixels.
2. [USRP-02] THE Backend SHALL return `GET /api/users` sorted by role in the order `admin`, `manager`, `supervisor`, `member`, then by `full_name` ascending (case-insensitive), then by `id`.
3. [USRP-03] `GET /api/users` SHALL accept `page` (integer from 1, default 1) and `per_page` (integer 1 to 100, default 10) and SHALL return `data` of `{ "items": [...], "page", "per_page", "total" }`. A `page` beyond the last page SHALL return an empty `items` with the real `total`. An invalid value SHALL be HTTP 400 `VALIDATION_ERROR` with `details`. THE number of queries SHALL not depend on the number of users (one count, one page).
4. [USRP-04] THE Frontend SHALL show, below the table, a pagination bar: "Showing 21 to 40 of 57", Previous and Next buttons (disabled at the ends), and page numbers with an ellipsis when there are more than 7 pages; the page SHALL be kept in the query string (`?page=`). AFTER a save, THE table SHALL reload the same page.
5. [USRP-05] EVERY save, error, and refusal of the Users page (role change, active and available toggles, create) SHALL use the Toasts of Requirement 60; `USER_HAS_OPEN_WORK` keeps its list in the ConfirmDialog (TOAST-06).

### Requirement 64: Boards List Search and Sort
**User Story:** As a user with many Boards, I want to search and sort the Boards page, so that I find a Board fast.
#### Acceptance Criteria
1. [BRDL-01] THE Boards page SHALL have, in its title block, a search field (`--control-h`, placeholder "Search boards", name "Search boards") that matches the Board name case-insensitively as the user types (debounced 250 ms), and a sort `BaseCombobox` with "Last updated", "First updated", "Newest", "Oldest" (`updated_at` desc, `updated_at` asc, `created_at` desc, `created_at` asc). THE default SHALL be "Last updated" (Open Question 79).
2. [BRDL-02] THE Backend SHALL accept on `GET /api/boards` the parameters `q` (string, trimmed, at most 100 characters; matched with `ILIKE` on `name`, with `%` and `_` escaped) and `sort` (`updated_at` or `created_at`) and `order` (`asc` or `desc`), with ties broken by `name` then `id`. An invalid `sort` or `order` SHALL be HTTP 400 `VALIDATION_ERROR`. THE access rules of Requirement 11 and Requirement 22 SHALL not change.
3. [BRDL-03] THE search and sort SHALL be kept in the query string (`?q=&sort=&order=`) so a link and the back arrow (NAVB-06) restore them. WHEN no Board matches, THE page SHALL show "No boards match \"<q>\"" with a "Clear search" button.
4. [BRDL-04] A Board's `updated_at` SHALL change on a rename, a description, visibility, or owner change, and a Column create, rename, move, or delete; it SHALL NOT change on a Card change (so the sort reflects the Board, not its traffic).
