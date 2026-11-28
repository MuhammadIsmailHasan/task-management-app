# Key Performance Indicators, V18
### Requirement 74: Key Performance Indicators
**User Story:** As a Supervisor or a Manager, I want a few figures per person for a date range, so that I can see delivery, delays, and load at a glance; as a Member, I want the same figures for myself.

#### Acceptance Criteria
1. [KPI-01] THE KPIs SHALL be computed for the Dashboard date range (`from`, `to`, the Dashboard defaults and the 182-day limit) in `APP_TIMEZONE`:

| KPI | Definition |
|---|---|
| Finished | Cards with `completed_at` inside the range (archived Cards count, deleted ones do not) |
| On-time rate | Finished Cards whose local completion date is on or before `end_date`, divided by Finished Cards that have an `end_date` |
| Throughput | Finished divided by the number of weeks in the range (days / 7), one decimal |
| Overdue now | Open Cards (not deleted, not archived, not in Done) with `end_date` before today, and the days since the oldest such `end_date`. Not limited by the range |
| Cycle time | Average days, one decimal, from the first `card.moved` whose `from_column_name` is "Todo" to `completed_at`, over Finished Cards that have such a move |
| Rework rate | Finished Cards with any `card.moved` whose `to_column_name` is "Revision", divided by Finished |
| Open workload | Open Cards assigned now. Not limited by the range |

2. [KPI-02] A rate (On-time, Rework) SHALL be `null` when its divisor is below 3, and Cycle time SHALL be `null` when no Card qualifies; THE Frontend SHALL show "–" for `null`.
3. [KPI-03] THE Backend SHALL provide `GET /api/analytics/kpi?board=&from=&to=` for a Supervisor (the Boards it owns), a Manager, and an Admin (every Board or one), with the access rules and errors of the Dashboard (Member 403). IT SHALL return `range`, `team` (the KPIs over every Card of the scope), and `people` (one row per person of the scope from the Dashboard `members`, with `id`, `full_name`, `avatar_url`, and the KPIs over the Cards assigned to them).
4. [KPI-04] THE Backend SHALL provide `GET /api/me/kpi?from=&to=` for every role, returning `range` and the caller's own KPIs over the Cards assigned to them on Boards that are not deleted.
5. [KPI-05] THE number of queries SHALL not depend on the number of Cards, people, or activity rows.
6. [KPI-06] THE Dashboard SHALL show, after the widgets, a "Team performance" card: six KPI tiles for `team` and a table with one row per person (Person, Finished, On-time, Throughput, Overdue, Cycle, Rework, Open); below 960 pixels each row stacks with its labels. THE On-time value SHALL be a `BaseBadge`: `accent` from 80%, `amber` from 50%, `danger` below.
7. [KPI-07] My tasks SHALL show, under its title, a "My performance" card with the same six tiles from `/api/me/kpi` for the last 30 days. A Member sees only this; a Member has no Dashboard.
8. [KPI-08] THE KPI UI SHALL use Design_System parts only (the section card, the `rounded-ui bg-surface p-item` tile, `BaseBadge`), no new token.
9. [KPI-09] `flask seed-data` SHALL write `card.moved` history with column names for the demo Cards (Todo to In Progress at the start date, through Review, some through Revision, to Done at `completed_at`), so every KPI has data.
10. [KPI-10] Out of scope now, next steps: PDF export of the KPIs and live updates (SSE).
