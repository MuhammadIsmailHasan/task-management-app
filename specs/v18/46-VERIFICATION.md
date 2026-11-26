# Verification, V18 (draft)
### Requirement 72: Verification of V18
**User Story:** As the product owner, I want V18 proved by tests and by a visual pass, so that the polish holds.
#### Acceptance Criteria
1. [V18-01] THE Backend tests SHALL cover: the Users order and paging (USRP-02, USRP-03), the Boards `q`, `sort`, `order` (BRDL-02), the Admin Dashboard scope (DASH-23), `/me/cards` 403 and the assignee role refusal (TASK-07, TASK-08), comments paging (CMV-07), every row of the permission matrix (PERM-02 to PERM-05), the palette validation (CATP-02), and the V18 migration up and down.
2. [V18-02] THE Frontend tests SHALL cover: the toast helper and its use in at least one create, update, delete, and error path (TOAST-01 to TOAST-07), no option highlighted on open (DS-07), the Sidebar active rule (NAVB-03), the back arrow table (NAVB-05), the Users pagination bar (USRP-04), the Boards search and sort query string (BRDL-03), the filter card layout and labels in one row with no presets (DASH-25 to DASH-28), the logo toggle (NAVB-01), the header line and the centred Top_Menu (NAVB-07, NAVB-08), My Tasks hidden for Manager and Admin (TASK-06), the Column drag order and the menu fallback (COLD-03, COLD-04), the Card modal order and Load more (CMV-03, CMV-04, CMV-06), the controls hidden by the matrix (PERM-06), the members search reset (MEMP-03), and the categories refresh (CATP-04).
3. [V18-03] `frontend/tests/design-system.test.ts` SHALL pass (DS-14 to DS-17, replacing the `check-tokens` script of DS-06), and `e2e/widths.mjs` SHALL pass at 360, 414, 960, and 1280 pixels on every V18 screen.
4. [V18-04] THE owner's visual review SHALL check every screen against Requirement 61 and `design/reference/v2/`, and SHALL carry over the open V17 review (task 39.52).
5. [V18-05] `backend/openapi.json` and `backend/API.md` SHALL be regenerated for the new parameters, shapes, and codes.

### Correctness Properties (V18)
- **Property 81: Users order and paging.** For any set of users and any `per_page`, concatenating every page gives each user exactly once, in role order then name then id, and `total` equals the count. **Validates: Requirement 63.2, 63.3**
- **Property 82: Boards search.** For any Board names and any `q`, the result is exactly the accessible Boards whose name contains `q` case-insensitively (with `%` and `_` treated as text), in the requested order. **Validates: Requirement 64.2**
- **Property 83: Card permission matrix.** For any role, assignment, and creator, each action of PERM-02 is allowed exactly when the matrix says so, and a refused request changes nothing. **Validates: Requirement 69.2 to 69.5**
- **Property 84: Comments paging.** For any thread and `limit`, the pages from offset 0 cover every top-level comment once in `sort` order, each with all its replies, and `total` is constant across pages. **Validates: Requirement 68.7**
- **Property 85: Palette contrast.** Every `--cat-<key>-fg` on `--cat-<key>-bg` meets 4.5:1 in light and dark. **Validates: Requirement 71.1**
- **Property 86: Column drag order.** For any Column list and any drag from index i to j, the order after the drop equals the order after `PATCH /move` with `position` j, and the Columns are renumbered `0.0, 1.0, ...`. **Validates: Requirement 67.3**
