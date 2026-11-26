# Dashboard and My Tasks, V18 (draft)
### Requirement 65: Dashboard Access and Filter Bar
**User Story:** As an Admin, Manager, or Supervisor, I want a clear filter bar, so that I can narrow the Dashboard without guessing what each control does.
This requirement amends Requirement 51 (DASH-11, DASH-19) and Decision B (Decision BM).
#### Acceptance Criteria
**Access**
1. [DASH-23] THE Backend SHALL allow an Admin to call `GET /api/analytics/dashboard` with the scope of a Manager (every Board; any `board`). A Supervisor SHALL keep the scope of DASH-19 (only the Boards it owns, as the owner confirmed). A Member SHALL still receive 403. THE other analytics routes of Requirement 10 SHALL follow the same rule.
2. [DASH-24] THE Sidebar SHALL show Dashboard to Supervisor, Manager, and Admin (NAV-01 amended), and the role's home page of an Admin SHALL be `/app/dashboard`.
**Filter bar**
3. [DASH-25] THE filters SHALL sit in one filter card under the greeting (`--surface-raised`, `--border`, `--radius-frame`, padding `--space-section`), not inline with the title. EVERY filter SHALL have a visible label above it (`text-xs`, `font-medium`, `--ink-muted`, `--space-label` gap): "Board", "Member", "From", "To". THE controls SHALL be `--control-h` high and use `--surface`, so they never match the card background.
4. [DASH-26] Board and Member SHALL be searchable `BaseCombobox` controls (DS-08) with "All boards" and "Anyone" as their first option, which is the default and is shown as the value, not as a highlighted row (DS-07).
5. [DASH-27] THE date range SHALL be two `BaseDateField` controls, "From" and "To" (DS-09), defaulting to the last 30 days (DASH-11). THE preset controls ("Last 7 days", "Last 30 days", "This month") SHALL be removed (round 2 within V18): the two date fields are the only way to set the range.
6. [DASH-28] THE filter card SHALL lay out its four filters in one row from 960 pixels (four equal columns, `--space-field` gaps), two columns from 600 to 959 pixels, and one column below 600 pixels. A "Reset filters" text button SHALL appear at the end of the row, after "To", when any filter differs from its default, and SHALL NOT add a second row from 960 pixels.
7. [DASH-29] THE "Due on" date of the Due tomorrow widget (DASH-15) SHALL use `BaseDateField` in single mode, `--control-h-sm`, in the widget header, with the label "Due on" visually hidden.

### Requirement 66: My Tasks and Assignee Roles
**User Story:** As a Manager, I do not hold Cards myself, so that My Tasks does not show me an empty page that can never fill.
This requirement amends TASK-01, NAV-01, and the assignment rules of Requirement 4 and Requirement 22 (Decision BN).
#### Acceptance Criteria
1. [TASK-06] THE Sidebar SHALL show My Tasks to a Member and a Supervisor only. A Manager or an Admin who opens `/app/my-tasks` SHALL be redirected to `/app/dashboard`.
2. [TASK-07] `GET /api/me/cards` SHALL return HTTP 403 for a Manager and an Admin.
3. [TASK-08] THE Backend SHALL refuse a Manager or an Admin as `assignee_id` on create and update with HTTP 400 `VALIDATION_ERROR` and `details.assignee_id` "Managers and admins cannot be assigned". THE assignee pickers SHALL list Members and Supervisors only (already true for Board members; V18 makes it a rule, not a side effect).
4. [TASK-09] THE migration of V18 SHALL leave any existing Card assigned to a Manager or Admin as it is (no data change) and SHALL report the count in the deploy log; such a Card can be reassigned by staff. A Card cannot be newly assigned to them.
