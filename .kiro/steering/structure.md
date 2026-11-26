---
inclusion: always
---

# Structure Steering — Folder & File Layout

- **Rule:** Every backend domain — `auth, boards, columns, cards, categories,
  comments, notifications, analytics, users, shared, invites` (`invites` added in
  V12 for the invite link and join requests) — is a folder under
  `app/blueprints/` containing `routes.py`, `service.py`, `repository.py`,
  `schema.py`.
  **Rationale:** Routes stay thin, business logic is isolated and
  unit-testable, every raw query lives in exactly one place per domain, and
  (de)serialization/validation has its own home.
  **Example:** `routes.py` calls `card_service.move_card(...)`, which calls
  `card_repository.get_by_id(...)`; `schema.py` defines the marshmallow `CardCreateSchema` and `CardSchema`.

- **Rule:** Shared, reusable frontend primitives live only in
  `components/shared/` (`BaseButton`, `BaseBadge`, `BaseModal`, `BasePopover`, `BaseCalendar`, `BaseTooltip`, `BaseCombobox`, `BaseMenu`, `ConfirmDialog` (V17, replaces `BaseConfirm`), `BaseTabs`, `BaseSwitch`, `BaseSegmented`, `BrandLogo`), implemented as
  thin wrappers over the shadcn/ui primitives in `components/ui/`; feature pages
  import the `Base*` components and never `components/ui/` directly, and never
  define their own buttons/badges/modals.
  **Rationale:** One place to fix styling, accessibility, and behavior across
  the whole app.
  `BrandLogo` is the one renderer of the logo files (V11): feature code never
  writes `/brand/...` or a raw `<img>`. Brand files live in `frontend/public/brand/`
  and the favicon in `frontend/app/favicon.ico`; `frontend/images/` does not exist.
  **Example:** `My Tasks` and `Profile` pages both render `<BaseButton>`, never
  a raw `<button>`.

- **Rule:** Specs live in two places: `.kiro/specs/` holds the current working
  draft **directly** — `requirements.md`, `design.md`, `tasks.md`,
  `CHANGELOG.md` sit right inside it, no per-feature subfolder, since this is
  one product, not a multi-feature spec library. Root `specs/` holds frozen,
  versioned snapshots split by domain file (`specs/v1/00-OVERVIEW.md`,
  `specs/v2/03-CARDS.md`, …).
  **Rationale:** Separates in-progress iteration from the stable record, without
  adding folder ceremony this project doesn't need.
  **Example:** `.kiro/specs/design.md`, not `.kiro/specs/kanban/design.md`.

- **Rule:** Guideline documents (`/guidelines/frontend.md`, `backend.md`,
  `database.md`) are kept separate from steering docs (`.kiro/steering/`):
  steering guides *what gets generated*, guidelines document *coding standards
  the generated code is checked against*.
  **Rationale:** Keeps a later code review meaningful — it checks code against
  one fixed, named rule set, not against evolving design notes that might have
  changed since.
  **Example:** a hard-coded color in a component is a `guidelines/frontend.md`
  issue, not a steering issue.
