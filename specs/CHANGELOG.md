

### Round 9 within V18 - 2026-11-28 (owner request; specs and build together)
- **Requirement 74 (new, `specs/v18/48-KPI.md`):** six KPIs per person and for the team: On-time rate, Throughput, Overdue now, Cycle time, Rework rate, Open workload (KPI-01, KPI-02).
- **API (KPI-03 to KPI-05):** `GET /api/analytics/kpi` (Supervisor, Manager, Admin; the Dashboard scope and range) and `GET /api/me/kpi` (every role). Cycle time and rework read `card.moved` history; four queries whatever the data size.
- **UI (KPI-06 to KPI-08):** "Team performance" on the Dashboard (tiles and a per-person table that stacks on phones); "My performance" on My tasks, so a Member sees their own figures. Existing tile, card, and badge styles only; no token added.
- **Demo data (KPI-09):** the seed writes move history (five demo Cards go through Revision), so every KPI has values.
- **Attachments and invite page (R8-15, R8-16):** one attachment tile with a type icon and host, used in the Card modal and the public board; the invite page is a card with an icon and buttons, and no longer shows the description's HTML tags.
- **Landing page (R8-17):** Workflow is a small inert board made of the real column shell and `CardTile`s, with who acts in each column; Roles is a permission table with the role badge and a check, dash, or scope per ability.
- **Next (KPI-10):** PDF export and live updates (SSE).
- **Checks:** backend 501 tests, frontend 401 tests, and `tsc` pass; both sections checked in Chrome at 1280 and 360 pixels with figures from the demo seed.
- **Task:** 40.29 (done).
