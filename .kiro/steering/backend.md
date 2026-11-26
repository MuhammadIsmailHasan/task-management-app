---
inclusion: always
---

# Backend Steering — Architecture Rules

- **Rule:** Every mutating endpoint re-checks the acting user's role
  server-side; the role used for the decision always comes from the
  authenticated session/token, never from the request body.
  **Rationale:** Role is a security boundary — a member must not be able to
  reach a supervisor-only action just by forging a request.
  **Example:** `@require_role("supervisor", "manager")` on
  `POST /api/boards/{id}/columns`.

- **Rule:** Every blueprint's `service.py` talks to the database only through
  its own `repository.py`; no `Model.query` call appears outside a repository
  function.
  **Rationale:** A service that only calls repository functions can be unit
  tested with a fake repository, no real database needed; and every raw query
  for a domain lives in exactly one file.
  **Example:** `card_service.move_card(...)` calls `card_repository.get_by_id(id)`
  — it never calls `Card.query.get(id)` itself.

- **Rule:** CORS is configured once, app-wide, restricted to an explicit
  origin allow-list read from an environment variable — never `*` — and
  credentials are only allowed if the frontend genuinely relies on cookies.
  **Rationale:** The frontend and backend deploy to two different domains; an
  open CORS policy on an app holding board/card data is a real exposure, not
  a formality to silence a browser warning.
  **Example:** `CORS(app, origins=os.environ["ALLOWED_ORIGINS"].split(","), supports_credentials=True)`.

- **Rule:** Notifications are created server-side as a direct side effect of
  the triggering action (card assignment, deadline reached) inside the same
  transaction — never computed or polled client-side.
  **Rationale:** The inbox and unread count must be correct no matter which
  client or device reads them, so they can't depend on a client re-deriving
  them.
  **Example:** assigning a card inserts
  `Notification(user_id=assignee, type="assigned", card_id=...)` in the same
  commit as the assignment.

- **Rule:** Analytics endpoints return pre-aggregated summaries (counts,
  deltas, overdue totals), never a raw dump of every card.
  **Rationale:** A supervisor or manager needs to judge a board's progress
  without opening it — that only works if the payload is small and glanceable.
  **Example:** `GET /api/boards/{id}/analytics` →
  `{ "data": { "done": 12, "in_progress": 4, "overdue": 2 } }`.

- **Rule:** Deadline notifications come from a scheduled job checking
  `end_date`, not from a request-time check.
  **Rationale:** A deadline notification must fire even if nobody opens the
  app that day.
  **Example:** a daily job queries cards where
  `end_date = today AND deleted_at IS NULL` and notifies each assignee once.

- **Rule:** Listing a card's comments always sorts priority-flagged ones
  first (newest priority first), then the rest by the requested
  `?sort=latest|popular` (default `latest`) — `popular` orders by
  `reply_count DESC`, ties broken by `created_at DESC`. Each top-level
  comment's replies come back nested, oldest-first, unaffected by the sort
  toggle. The "create new card" action is a separate flag on each comment,
  `can_create_card = (author.role == "manager" and viewer.role in ("supervisor", "manager", "admin"))` — independent of
  `is_priority`.
  **Rationale:** Computing all of this once in `comment_service` means the
  frontend never has to re-sort, re-derive popularity, or re-implement the
  priority/author rules itself.
  **Example:** `comment_service.list_for_card(card_id, sort="popular")`.

- **Rule:** Creating a reply increments its parent's `reply_count` in the
  same transaction as the insert; there is no like/vote endpoint anywhere in
  the comments domain.
  **Rationale:** `reply_count` is what "Popular" sorts by — it has to stay
  accurate without a separate counting query on every list call.
  **Example:** `parent.reply_count += 1; db.session.add(reply); db.session.commit()`.

- **Rule:** Creating a reply is rejected with `400` if its target comment
  already has a non-null `parent_id` (the target is itself a reply).
  **Rationale:** Enforces the 2-level depth cap even against a direct API
  call, not only against the "Reply" button being hidden in the UI.
  **Example:** `if parent.parent_id is not None: raise ValidationError("cannot reply to a reply")`.

- **Rule:** Subtasks are a sub-resource of `cards` — their own
  repository/service functions, but no separate blueprint. `card_service`
  exposes `add_subtask`, `toggle_subtask`, `reorder_subtasks`, `delete_subtask`.
  **Rationale:** A subtask never exists independently of its card, so it
  doesn't need the full blueprint ceremony a first-class domain gets.
  **Example:** `POST /api/cards/{id}/subtasks` and `PATCH /api/subtasks/{id}`
  are both handled inside the `cards` blueprint.

- **Rule:** Categories get their own `categories` blueprint. Listing a
  board's categories only requires board access (same access rule as its
  columns/cards; a guest gets them only through the public-link route
  `GET /api/shared/{token}/categories`); creating, updating, or deleting one
  requires supervisor, manager, or admin.
  **Rationale:** Categories are CRUD, per-board, and role-gated like columns
  — that's enough to earn a real blueprint instead of being folded into
  `boards`.
  **Example:** `@require_role("supervisor", "manager", "admin")` on
  `POST /api/boards/{id}/categories`, but no role check on the matching `GET`.

- **Rule:** An uploaded attachment's file is served only through a path that
  enforces the same board-access and role checks as its owning card: either an
  authenticated endpoint or a signed, time-limited URL (V2 default: signed URL,
  15-minute lifetime, issued only to a viewer who can see the card). A
  permanently public, unauthenticated file URL is never returned.
  **Rationale:** A permanent public URL bypasses every board-privacy and role
  check the moment it leaks or is guessed. A signed, expiring URL still opens
  in a plain browser tab (`target="_blank"`), which a bearer-token-only
  endpoint cannot.
  **Example:** `GET /api/cards/{id}` returns `attachment.file_url` as
  `/api/attachments/{id}/file?exp=...&sig=...`; `GET /api/attachments/{id}/url`
  re-issues a fresh one after the visibility check.
  A user's avatar image follows the same mechanism: the same signing code with
  its own scope, a 15-minute signature, `avatar_url` issued only in responses
  to signed-in requests, and the file stored by the same file store under a
  generated name; the type is read from the file's leading bytes, not from its
  name or the client's header. The same URL is added to comment authors,
  board members, candidates, and card assignees by the batched name lookup
  (it selects `id, full_name, avatar_path`, never `email`; no extra query per
  row), signed once per distinct user per response; shared routes carry none.
  Avatar routes live in the `users` blueprint under `/api/users/...`.

- **Rule:** Board access is resolved in one place, `board_service.can_access(user, board)`:
  a guest never has board access (401 on every board route outside
  `/api/shared` and `/api/invite`); there are no public boards (V12), so a
  signed-in user has access only as the board's owner, a `BoardMember`, a
  Manager, or an Admin. Every board-scoped read and write (columns, cards,
  categories, comments, activity, search, attachments) calls it. A `BoardMember`
  row is never created for a Manager or an Admin, and a card's assignee must be
  the owner or a `BoardMember`.
  **Rationale:** "Private" has to gate unrelated signed-in users, not just
  guests; one function keeps that from drifting per endpoint.
  **Example:** an unrelated Member requesting a board gets `403`.
- **Rule:** The invite link and join requests live in their own `invites`
  blueprint (routes, service, repository, schema). Creating a request writes the
  activity row and the notifications (owner, every Manager, every Admin) in one
  transaction; deciding one locks the row (`SELECT ... FOR UPDATE`), is
  restricted to Manager and Admin in `routes.py`, and approval creates the
  `BoardMember`, the activity row, and the requester's notification together.
  A duplicate pending request is the partial unique index's `IntegrityError`
  mapped to `409`. The `invite_token` never appears in logs or activity metadata.
  The pending list (`GET /boards/{id}/join-requests`) reads the requester's
  `email` through one join for the owner, Manager, and Admin only (V12 round 2);
  the create and decision responses, notifications, and activity metadata carry
  no email.
  **Rationale:** The owner can invite but not grant; concurrent requests must
  leave one pending row.
  **Example:** `join_request_service.decide(actor, id, "approved")` called by the owner is blocked by `@require_role("manager", "admin")`.
- **Rule:** Deleting a comment (author only) runs in one transaction: a reply
  decrements its parent's `reply_count`, a top-level comment deletes its replies,
  and one `comment.deleted` activity row is written with no comment text. Card
  `progress` is computed by the schema from the already loaded subtasks
  (`(20 * done + total) // (2 * total)`, null with no subtasks), never stored.
  **Rationale:** `reply_count` must always equal the number of replies; the
  activity log must not keep deleted text.
  **Example:** `comment_service.delete(actor, id)` returns `n = 1 + replies`.

- **Rule:** Authentication is stateless JWT with a 24-hour expiry and no
  server-side revocation list; passwords are at least 8 characters and
  hashed with bcrypt or argon2; no token returns `401`, a valid token with
  insufficient access returns `403`, everywhere. Login and the
  availability check (not register, which is deferred) go through one Postgres-backed rate limiter
  (`common/rate_limiter.py`): login blocks after 5 failures per (identifier,
  client IP) or 20 per IP in 15 minutes, a blocked request returns `429`
  `RATE_LIMITED` with `Retry-After`, the failure row is committed before the
  `401` is raised, thresholds come from environment variables, and the client
  IP honours `X-Forwarded-For` only through `TRUSTED_PROXY_COUNT`.
  **Rationale:** One predictable status rule for the frontend; token
  revocation is deferred, rate limiting is not; a table works across workers
  without Redis.
  **Example:** `POST /api/auth/logout` returns `{ "data": null }`; the client
  discards the token.

- **Rule:** Notifications are marked read through
  `PATCH /api/notifications/{id}/read` and `PATCH /api/notifications/read-all`,
  both scoped to the signed-in user's own rows.
  **Rationale:** The unread count in the inbox is only meaningful if it can go
  down.
  **Example:** marking another user's notification read returns `404`.

- **Rule:** Every blueprint is a `flask_smorest.Blueprint` registered on one
  `Api` instance. Request bodies and query strings are validated with
  `@blp.arguments(Schema)`, and every success response is declared with
  `@blp.response(status, EnvelopeSchema)` where the schema is built from the
  blueprint's marshmallow classes in `schema.py` wrapped by the shared
  envelope (boolean `status`, `message`, `data`). The OpenAPI document is generated
  from those declarations, never written by hand. Validation failures map to
  `400 VALIDATION_ERROR` (never smorest's default `422`), and every error
  still renders the shared error envelope.
  **Rationale:** One declaration per endpoint drives validation, serialization,
  and documentation, so the three cannot drift apart.
  **Example:** `@blp.post("/cards")`, `@blp.arguments(CardCreateSchema)`,
  `@blp.response(201, envelope(CardSchema))` on `POST /api/boards/{id}/cards`.

- **Rule:** A repository that returns rows whose related collections will be
  read loads them in the same function with `selectinload` (collections) or
  `joinedload` (many-to-one); services and schemas never trigger a lazy load.
  A list endpoint's query count is constant in the number of rows, not
  proportional to it.
  **Rationale:** Relationships are declared `lazy="raise"`, so the repository
  is the one place that decides what is loaded. This keeps list endpoints
  inside the 300 ms p95 target.
  **Example:** `select(Card).where(...).options(selectinload(Card.subtasks), selectinload(Card.attachments))`
  makes 3 queries for 200 cards, not 201.

- **Rule:** (V12) The public link is managed only by a Manager or an Admin
  (`@require_role("manager", "admin")` on the four `/boards/{id}/share` routes).
  The share-link routes live in their own `shared` blueprint under
  `/api/shared/{token}`: `GET` only, no token required, a null, unknown,
  replaced, or soft-deleted-board token always returns the same `404`, and
  the response schemas contain no `comments`, `activity`, `activity_log`,
  `owner_id`, member list, or `share_token`. A `Signed_File_URL` issued
  through a share token carries a scope that is re-checked against the
  board's current token.
  **Rationale:** Disabling or regenerating a link must cut off every
  outstanding link and file URL immediately, and no visitor, signed in or not,
  must reach the discussion or any write route through it (every mutating
  method under `/api/shared` is `405`).
  **Example:** `GET /api/shared/{token}/cards/{card_id}` returns `404` when the
  card is on another board.

## V17: slugs, Columns, users, notifications, mail (draft until approved; specs/v17/)

- **Rule:** `Board.slug` is derived from the name by `slugify` (lower-case, words joined by `-`, characters outside `a-z0-9` removed, `board` when empty, lowest free `-n` suffix), unique over every row, regenerated on rename, never accepted from a client, and never kept after a rename. `GET /api/boards/slug/{slug}` has the role rules of `GET /api/boards/{id}`; every other endpoint keeps the UUID. When `API_PUBLIC_PREFIX` is set (`/app/api` in production) every absolute path the Backend writes into a response (signed file URLs, link `path`) uses it; the signature does not cover the prefix.
  **Rationale:** Readable URLs; one origin behind nginx.
  **Example:** "Design & Dev" gives `design-dev`, a second one `design-dev-2`.
- **Rule:** The Board_Owner, a Manager, and an Admin create, rename, reorder, and delete Columns. The `Done` Column cannot be renamed or deleted and no other Column can be named `Done` (`COLUMN_LOCKED`). A Column with active Cards cannot be deleted (`COLUMN_NOT_EMPTY`, `details.count`). A Card in `Done` cannot be archived (`CARD_IN_DONE`). Archiving a Card sets `column_id` to null; a Card has its own `board_id`; restoring places it last in the Board's first Column.
  **Rationale:** The owner controls the workflow; finished work is never lost to a delete.
  **Example:** `DELETE /api/columns/{id}` on a Column with 3 open Cards returns 409 `COLUMN_NOT_EMPTY`.
- **Rule:** `due_state` (`overdue`, `due_tomorrow`, or null), the My Tasks groups, and the Dashboard dates are computed on the server in `APP_TIMEZONE` by the functions of `common/due.py` and `common/clock.py`; none is recomputed per endpoint. The dashboard and My Tasks run a constant number of queries.
  **Rationale:** One definition of "overdue" for every screen.
  **Example:** `due_state(end_date, column_name, today)`.
- **Rule:** A user has `is_active`, `is_available`, and `email_verified_at`. There is no user delete. Deactivation is refused with `USER_HAS_OPEN_WORK` while the user has Open_Cards or owns a Board with Open_Cards. Every authenticated request reads `is_active` (`ACCOUNT_DISABLED`, 403); sign-in checks the password first, then `is_active`, then `email_verified_at` (`ACCOUNT_NOT_ACTIVATED`, 403), so neither code reveals an account. Only active and available users appear in the member and assignee pickers and can be assigned. (This is not a revocation list: the flag is read from the user row.)
  **Rationale:** History and assignments stay; deactivation is immediate.
  **Example:** a wrong password for a disabled account is the usual 401.
- **Rule:** Notification preferences are rows `(user_id, type, enabled)`, a missing row means enabled, for `comment_on_assigned`, `due_today`, `due_tomorrow`, `assigned_card_changed`, and `subtask_on_assigned`. A notification of those types is created in the action's transaction only for an assignee who is active, is not the actor, and has the type enabled. `flask notify-due` (every 15 minutes, `APP_TIMEZONE`) creates `due_today` and `due_tomorrow` idempotently on `(user_id, card_id, type, notify_date)` and replaces the daily `deadline` job.
  **Rationale:** Assignees choose what reaches them; reruns insert nothing.
  **Example:** a second run on the same date inserts 0 rows.
- **Rule:** Mail goes through `app/common/mail.py` (`smtp` with Gmail, or `console`), is sent after the commit from a bounded worker, and a failed send is logged (no address, no token) and never fails the request. Email tokens (verify, change email) are stored as SHA-256 hashes in `email_tokens`, single use, 24 hours, and appear only in the email. Credentials are environment variables, empty in `.env.example`. Register returns `token: null`.
  **Rationale:** No credential or token in code, logs, or responses.
  **Example:** `POST /api/auth/verify { "token": "..." }` returns `TOKEN_INVALID` the second time.
