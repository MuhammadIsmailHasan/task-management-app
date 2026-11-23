# Overview, V15 changes

V15 replaces Decision X's RevoTask mark with a new "RevoBoard" brand (logo,
favicon, name) commissioned from Stitch, and adds Decision AP (teal as a real
accent colour). Everything in `specs/v1/` to `specs/v14/` stands except where
this file or `specs/v15/21-BRANDING.md` supersedes wording that names
"RevoTask" or the old `--accent` value.

## Decisions Log (added)

| ID | Decision | Rationale | Where applied |
|----|----------|-----------|---------------|
| AO | **Product renamed RevoTask to RevoBoard, new logo (V15; supersedes Decision X's asset content, not its file paths).** New `logo-revo.svg` (mark, viewBox 203 by 203) and `logo-text-revo.svg` (full, viewBox 704 by 121) replace the V11 files at the same paths; both still wrap a raster PNG, now with real alpha transparency, cropped from a reference image the owner supplied via Stitch. `favicon.ico` is regenerated (16/32/48 px) from the same mark. Every visible string "RevoTask" (alt text, Sidebar tooltip, header text, the document-title brand, root metadata title and description) becomes "RevoBoard". | The owner commissioned a "Kanban Task Management App" design in Stitch and chose its brand over the placeholder mark. | Requirement 21 (BRAND-03, 06, 07, 10, 11), Requirement 32 (document titles), Glossary |
| AP | **Teal becomes a real accent colour (V15).** `--accent` changes from `#f4a340` (orange) to `#006b5f` (teal), matching the Stitch design's secondary colour. The token stays the single named accent; no `--accent-2` token is added, and no other token changes. | The owner reviewed the Stitch redesign report and chose a real teal accent over staying navy-only with pastel tags. | Requirement 14 (design tokens); `styles/tokens.css` |

## Glossary (changed)

- **Brand_Assets**: the three files the product owner supplied in V15, replacing the V11 files at the same paths: `frontend/app/favicon.ico`, `frontend/public/brand/logo-revo.svg`, `frontend/public/brand/logo-text-revo.svg`.
- **Logo_Mark**: `logo-revo.svg`, the square mark, `viewBox` 203 by 203 (was 480 by 480 in V11).
- **Logo_Full**: `logo-text-revo.svg`, the mark with the "RevoBoard" wordmark, `viewBox` 704 by 121 (was 540 by 165 in V11).
- **Embedded_Raster**: measured in V15: 203 by 203 pixels in `logo-revo.svg` and 704 by 121 pixels in `logo-text-revo.svg`, RGBA with real alpha transparency (the V11 raster was opaque, 8-bit RGB with none).

## Design reference, not a requirement change

The owner also had Stitch generate a full-app visual design ("Kanban Task
Management App", Stitch `projects/4453997251229387917`) and, after reviewing
the gap analysis in `design/stitch-redesign-report.md`, confirmed it is used
as a visual and spacing reference only: the specs in `specs/v1/` to
`specs/v14/` stay the source of truth for behaviour, scope, and data. The
owner confirmed these Stitch inventions, which have no basis in any version's
spec, are not implemented:

- A card `estimate` field (hours/points).
- A card `status` dropdown — cards still change column by drag-and-drop only.
- Comment-composer `@mention`, emoji, and attachment.
- The mobile card modal's bookmark/share action and "Done" primary button —
  closing stays the header icon and Escape; the modal has no Save/Done button.
- The Activity panel's "Live Stream" chip, online-user count, system-state
  percentage, and "Export Audit Trail (CSV)".
- A workspace-wide (cross-board) Categories screen with KPI tiles, Import
  Taxonomy, "associated boards", and automated rules — Categories stays a
  simple per-board CRUD screen (Requirement 6).

Where Stitch's shell (a top pill-nav plus icon rail), its centered Inbox
popover, and its Categories screen conflict with the sidebar-nav,
shared-right-panel, and per-board-CRUD decisions already in force, the
existing specs govern; Stitch's spacing, type scale, and card-modal layout
remain useful references for the still-unbuilt screens.

## Open Questions (none added)

Both decisions above were resolved directly by the owner; no new open
question is recorded.
