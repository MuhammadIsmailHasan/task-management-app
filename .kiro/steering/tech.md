---
inclusion: always
---

# Tech Steering — Stack & Conventions

- **Rule:** Backend = Flask + SQLAlchemy + flask-smorest (marshmallow schemas, generated OpenAPI), organized by blueprint; frontend =
  Next.js (App Router) + TypeScript, styled with Tailwind CSS v4 and shadcn/ui.
  **Rationale:** One domain, one blueprint, one set of pages — a consistent
  shape that stays easy to navigate as more domains get added.
  **Example:** `app/blueprints/cards/routes.py`, `frontend/app/boards/[id]/page.tsx`.

- **Rule:** Every model's primary key is a UUID, never an auto-increment integer.
  **Rationale:** Board/card IDs shouldn't be guessable or reveal how many
  records exist by their number.
  **Example:** `id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)`.

- **Rule:** `Card.order` (and `Subtask.order`) is a `db.Column(db.Float)`, not an
  integer index.
  **Rationale:** A float lets drag-and-drop reposition an item between two
  others by averaging, without rewriting every sibling row's position.
  **Example:** dropping between order `1.0` and `2.0` sets the moved item's
  order to `1.5`.

- **Rule:** Boards and cards are soft-deleted (`deleted_at`) and separately
  archivable (`archived_at`); nothing is hard-deleted from these two tables.
  **Rationale:** A board or card is a record of real work — losing its history
  because someone clicked delete is worse than keeping a hidden row around.
  **Example:** default queries add `WHERE deleted_at IS NULL`.

- **Rule:** Backend tests run on `pytest`; end-to-end tests run on Playwright
  against the deployed URL, with no `waitForTimeout` anywhere in the test files.
  **Rationale:** A flow that only passes "most of the time" because of a sleep
  isn't actually verified — it's just not failing yet.
  **Example:** use `expect(locator).toBeVisible()` instead of a fixed sleep.
  The Playwright suite is read-only. The invite and join-request flow needs two
  accounts and writes data, so it is a manual checklist (design.md) and an
  explicitly deferred automated test (V12 round 2).

- **Rule:** Both apps ship a `.env.example`; no real `.env` file is ever committed.
  The backend's lists the rate-limit settings (`RATE_LIMIT_WINDOW_SECONDS`,
  `RATE_LIMIT_LOGIN_PAIR_MAX`, `RATE_LIMIT_LOGIN_IP_MAX`,
  `RATE_LIMIT_AVAILABILITY_MAX`, `RATE_LIMIT_CHANGE_PASSWORD_MAX`) and `TRUSTED_PROXY_COUNT`.
  **Rationale:** A leaked database URL or JWT secret in a public repo is a real
  incident, not a hypothetical.
  **Example:** `.env.example` lists `DATABASE_URL=`, `JWT_SECRET=`,
  `ALLOWED_ORIGINS=` with empty/placeholder values.

- **Rule:** Every backend blueprint is layered `routes.py → service.py →
  repository.py → model`, and CORS is restricted to an explicit origin
  allow-list from an environment variable — never `*`.
  **Rationale:** The repository layer is what makes `service.py` testable with
  a fake instead of a real database; a wide-open CORS policy on a multi-tenant
  board app is a real exposure once the frontend and backend live on different
  domains.
  **Example:** `CORS(app, origins=os.environ["ALLOWED_ORIGINS"].split(","))`.
  See `backend.md` for the full rule.

- **Rule:** The Next.js app defaults to Server Components; a component becomes
  a Client Component only when it actually needs state, an event handler, or a
  browser API.
  **Rationale:** Most of this app (card descriptions, activity text, analytics
  numbers) never needs to run in the browser — shipping it as a Server
  Component means less JavaScript on a phone over a slow connection.
  **Example:** the card's description and activity list render server-side;
  the drag-and-drop board and the comment composer are Client Components.
  See `frontend.md` for the full rule.

- **Rule:** The frontend is styled with Tailwind CSS and shadcn/ui primitives,
  themed from the design tokens (`styles/tokens.css`) through the
  Tailwind `@theme` block. Tailwind's default palette and arbitrary values
  (`bg-[#fff]`, `p-[13px]`) are not used.
  **Rationale:** Tailwind and Radix-based shadcn/ui give consistent utilities and
  accessible behaviour, while one token file keeps the whole look in one place.
  **Example:** `bg-brand text-white rounded-md` resolves to `var(--brand)` and
  `var(--radius-md)`; `bg-[#2b5748]` is a violation.

- **Rule:** The frontend adds `@radix-ui/react-popover` and `react-day-picker`
  (as shadcn/ui `Popover` and `Calendar`) for the card modal's chips and date
  range, `@radix-ui/react-dropdown-menu` (as shadcn/ui `DropdownMenu`, behind
  `BaseMenu`) for the header user menu, and `@fontsource-variable/inter` for
  the self-hosted Inter font.
  **Rationale:** Radix gives accessible popovers; react-day-picker is the
  calendar shadcn/ui uses and supports range selection; a bundled font avoids a
  third-party request.
  **Example:** `BasePopover` wraps the shadcn `Popover`; feature code never
  imports `components/ui/popover` directly.

- **Rule:** V12 adds no dependency. `BaseConfirm` gains a `modal` variant over
  the existing shadcn/ui `Dialog` (the one `BaseModal` already wraps); the card
  modal's auto-save uses `fetch` through `lib/api.ts` with no extra library.
  Notification deduplication uses PostgreSQL partial unique indexes
  (`postgresql_where`), which work on every supported PostgreSQL version.
  **Rationale:** The V12 features fit the current stack, and the indexes avoid a
  PostgreSQL 15 requirement.
  **Example:** `<BaseConfirm variant="modal" title="Remove attachment?" ... />`.
- **Rule:** The logo and favicon follow the Next.js 16 conventions: the favicon is
  `app/favicon.ico` (no manual `<link>`, no `metadata.icons`), logos are static
  files in `public/brand/` referenced by absolute `/brand/...` paths and rendered
  with `next/image` plus `unoptimized` (SVG is not optimized; `dangerouslyAllowSVG`
  stays off); `priority` is deprecated, so a logo uses `loading="eager"`. `app/icon`,
  `app/apple-icon`, and `app/manifest` wait until the owner supplies PNG icons.
  **Rationale:** File conventions need no code, and `unoptimized` avoids the
  SVG injection risk the optimizer's opt-in carries.
  **Example:** `<Image src="/brand/logo-revo.svg" width={203} height={203} alt="RevoBoard" unoptimized />`
  inside `BrandLogo`.
