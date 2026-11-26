---
inclusion: always
---

# API Conventions Steering

- **Rule:** All endpoints are versionless, under `/api/...`, and resource-nested
  for creation (`POST /api/boards/{board_id}/columns`), flat for direct access
  (`GET /api/cards/{id}`).
  **Rationale:** One predictable routing shape across every blueprint, instead
  of each domain inventing its own.
  **Example:** `PATCH /api/cards/{id}/move` for a drag-and-drop position change.

- **Rule:** Every response carries a top-level boolean `status` (`true` exactly
  when the HTTP status is 2xx, otherwise `false`) and a human-readable
  `message`. A success is `{ "status": true, "message": "...", "data": <payload> }`
  where the payload is a single object, a list, or `null`. An error is
  `{ "status": false, "message": "...", "error": { "code": string, "details"?: object } }`
  with a matching HTTP status (`400`, `401`, `403`, `404`, `405`, `409`, `429`, `500`).
  The message text appears once, at the top level; `error` holds only the
  machine-readable `code` and a `details` object only for `VALIDATION_ERROR`
  (each field to a list of messages), for the `CONFLICT` of a registration or
  email save (each duplicate field to a list of messages), and for
  `RATE_LIMITED` (`{ "retry_after": seconds }`, also sent as the `Retry-After`
  header). The HTTP status code travels on
  the HTTP line only. Mutating endpoints send a short descriptive `message`
  ("Card moved"); reads default to "OK".
  **Rationale:** One envelope on both paths means the frontend's API client has
  exactly one place that unwraps a response or throws. Putting the text once
  avoids two messages drifting apart, and `error.code` is what code branches on.
  **Example:** `GET /api/cards/{id}` → `200 { "status": true, "message": "OK", "data": { "id": "...", "title": "..." } }`;
  a missing comment body → `400 { "status": false, "message": "Validation failed", "error": { "code": "VALIDATION_ERROR", "details": { "content": ["Missing data for required field."] } } }`.

- **Rule:** List endpoints that back a search/filter UI accept `?search=` and
  `?filter[<field>]=` query params.
  **Rationale:** One documented, reusable convention for "search and filter
  cards on the active board" instead of a bespoke query shape per list.
  **Example:** `GET /api/boards/{id}/cards?search=login&filter[priority]=high`.

- **Rule:** `POST /api/auth/register` (`full_name`, `username`, `email`,
  `password`) and `POST /api/auth/login` (`identifier`, `password`) both return
  `{ "data": { "user": { id, full_name, username, email, avatar_url }, "token": "..." } }`.
  `GET /api/auth/availability?username=&email=` answers
  `{ "username": { "available": bool }, "email": { "available": bool } }`.
  **Rationale:** One shared user shape from both endpoints keeps the frontend
  auth client simple — it never branches on which endpoint it just called.
  **Example:** register and login responses are interchangeable as far as the
  client's session storage is concerned.

- **Rule:** `GET /api/cards/{id}/comments?sort=latest|popular` (default
  `latest`; `popular` orders by reply count, ties broken by newest) returns
  priority-flagged top-level comments first, then the rest in the requested
  order, each with its replies nested inline and always ordered oldest-first.
  `POST /api/cards/{id}/comments` creates a top-level comment;
  `POST /api/comments/{id}/replies` creates a reply (`400` if the target is
  itself a reply); `PATCH /api/comments/{id}/priority` (manager-only) toggles
  the priority flag. There is no like endpoint.
  **Rationale:** One documented set of endpoints for every comment
  interaction, instead of ad hoc routes invented per feature as comments grow.
  **Example:** each comment in the response carries
  `{ "reply_count": 3, "is_priority": false, "can_create_card": true }`.

- **Rule:** `GET /api/boards/{board_id}/categories` lists a board's
  categories (open to anyone with board access); `POST` creates one,
  `PATCH /api/categories/{id}` renames/recolors it, `DELETE /api/categories/{id}`
  removes it — the last three are supervisor/manager/admin-only.
  **Rationale:** Categories are scoped per board and filtered on the same
  board page, so a nested-under-`boards` + flat-by-id shape matches every
  other board sub-resource.
  **Example:** `POST /api/boards/b_1/categories { "name": "Design", "color": "purple" }`
  → `{ "data": { "id": "cat_1", "board_id": "b_1", "name": "Design", "color": "purple" } }`.

- **Rule:** `POST /api/cards/{id}/subtasks` creates a subtask;
  `PATCH /api/subtasks/{id}` updates `title` / `is_done` / `order`;
  `DELETE /api/subtasks/{id}` removes it.
  **Rationale:** Subtasks are simple enough that a dedicated small CRUD under
  the card resource is clearer than overloading the card's own `PATCH` body
  with a nested array every time one checkbox changes.
  **Example:** `PATCH /api/subtasks/st_1 { "is_done": true }` →
  `{ "data": { "id": "st_1", "is_done": true } }`.

- **Rule:** The login `identifier` is a username (no `@`) or an email (has `@`);
  the server decides the type and answers `400 VALIDATION_ERROR` when it fits
  neither shape. Unknown user and wrong password return the same `401`.
  Profile endpoints: `GET|PATCH /api/auth/me`, `POST /api/auth/change-password`
  (a wrong current password is `400`, never `401`). Public-link endpoints
  (V12: the V10 share link, same paths):
  `GET|POST|DELETE /api/boards/{id}/share`, `POST /api/boards/{id}/share/regenerate`
  (**manager and admin only**; the owner gets `403`); the token-free read-only routes are
  `GET /api/shared/{token}`, `/cards`, `/categories`, `/cards/{card_id}`,
  `/attachments/{id}/url` — there is no comment, activity, or mutating route
  under `/api/shared`. Additional auth and
  membership endpoints: `POST /api/auth/logout` (returns `{ "data": null }`),
  `PATCH /api/notifications/{id}/read`, `PATCH /api/notifications/read-all`,
  `GET|POST /api/boards/{id}/members`, `DELETE /api/boards/{id}/members/{user_id}`,
  `GET /api/attachments/{id}/url`, and `GET /api/boards/{id}/candidates` (matches
  `full_name`, `username` by prefix, `email` by exact match, case-insensitively;
  **manager and admin only** in V12, member and supervisor accounts only;
  returns `id`, `full_name`, `username`, `email`). `POST /api/boards/{id}/members`
  is manager and admin only and answers `400` for a manager or admin account.
  `GET /api/boards/{id}/members` returns `id`, `full_name`, `username`, and adds
  `email` only with `?include=email`, which needs write access to the board
  (otherwise `403`); the owner is listed first, once, with `is_owner` (V12 round 2),
  and `DELETE /api/boards/{id}/members/{user_id}` for an owner who is not a
  `BoardMember` is `404`. Avatar endpoints: `POST` (multipart, field `file`) and
  `DELETE /api/users/me/avatar`, and the signature-checked, token-free
  `GET /api/users/{user_id}/avatar/file`; `avatar_url` in a `user` payload is a
  signed URL or `null`. Signed-in responses also carry it as `author_avatar_url`
  (comments, replies), `avatar_url` (members, candidates), and
  `assignee_avatar_url` beside `assignee_name` (cards); no `/api/shared` payload
  carries any avatar, and the shared card carries `assignee_name` only.
  `candidates` needs a search of at least 2 characters (`400 details.search`).
  `POST /api/auth/change-password` is rate limited (`429 RATE_LIMITED`).
  A malformed, expired, or invalid Bearer Token on a `/api/shared` route is
  ignored (the caller is a guest, never `401`).
  **Rationale:** One identifier column keeps register/login matching simple;
  the other endpoints close gaps the first version left open.
  **Example:** `POST /api/boards/b_1/members { "user_id": "u_2" }` →
  `{ "data": { "board_id": "b_1", "user_id": "u_2" } }`.

- **Rule:** V12 endpoints. Invite link (owner, manager, admin):
  `GET|POST|DELETE /api/boards/{id}/invite` and `POST /api/boards/{id}/invite/regenerate`,
  each answering `{ "enabled", "token", "path" }`. For any signed-in user:
  `GET /api/invite/{token}` returns `{ board: {id, name, description}, state, request }`
  with `state` one of `can_request | pending | member | staff`, and
  `POST /api/invite/{token}/requests` (member or supervisor) creates a pending
  join request (`201`; `400` for a manager or admin; `409` for a member or an
  existing pending request; `404` for any bad token). `GET /api/boards/{id}/join-requests?status=`
  (owner, manager, admin) lists requests, each with `user: { id, full_name,
  username, email, avatar_url }` (V12 round 2: the one join-request response
  that carries an email, to those three roles only); `PATCH /api/join-requests/{id}`
  with `{ "status": "approved" | "rejected" }` is manager and admin only (`403` for
  the owner, `409` when already decided). `DELETE /api/comments/{id}` is the
  author only (`403` for anyone else, `404` unknown). Card payloads carry the
  read-only `progress` (0 to 10 or null), `subtask_done_count`, and
  `subtask_total_count`; a posted `progress` is `400`. `visibility` no longer
  exists on any board request or response. Notifications carry `type`,
  `board_id`, `board_name`, `card_id`, `card_title`, `actor_name`, and `is_read`.
  `PATCH /api/cards/{id}` that changes nothing returns `200` and writes no
  activity row; each saved field is its own request.
  **Rationale:** One place lists the V12 contract; the public-link and invite
  tokens are separate credentials.
  **Example:** `PATCH /api/join-requests/jr_1 { "status": "approved" }` as the board owner → `403`.
- **Rule:** Lists are unpaged, except the Inbox and the two activity feeds, which
  take `limit` (default 20, at most 100) and `before` (the id of the last row the
  client has) and keep their response shape (Decision J).
  **Rationale:** Only these lists grow without bound; a row-id cursor adds paging
  without changing what existing clients read.
  **Example:** `GET /api/boards/{id}/activity?limit=20&before=<activity id>`.


## V17 additions (draft until approved; specs/v17/)

- **Rule:** `error.details` is also allowed for `COLUMN_NOT_EMPTY` (`{ "count" }`) and `USER_HAS_OPEN_WORK` (`{ "cards", "boards", "cards_total", "boards_total" }`, 50 entries at most each). New error codes: `COLUMN_NOT_EMPTY`, `COLUMN_LOCKED`, `CARD_ARCHIVED`, `CARD_NOT_ARCHIVED`, `CARD_IN_DONE`, `USER_HAS_OPEN_WORK`, `CANNOT_DEACTIVATE_SELF` (409); `ACCOUNT_DISABLED`, `ACCOUNT_NOT_ACTIVATED` (403); `TOKEN_INVALID`, `TOKEN_EXPIRED` (400).
  **Rationale:** The frontend must list what blocks a delete or a deactivation.
  **Example:** `409 { "status": false, "message": "...", "error": { "code": "COLUMN_NOT_EMPTY", "details": { "count": 3 } } }`.
- **Rule:** New endpoints: `GET /api/boards/slug/{slug}`, `PATCH /api/columns/{id}`, `PATCH /api/columns/{id}/move`, `DELETE /api/columns/{id}`, `POST /api/cards/{id}/restore`, `GET /api/boards/{id}/cards?archived=true`, `GET /api/analytics/dashboard?board=&member=&from=&to=`, `GET /api/me/cards`, `GET|PUT /api/me/notification-preferences`, `POST /api/auth/verify`, `POST /api/auth/resend-verification`, `POST /api/auth/me/email/resend`, `DELETE /api/auth/me/email/pending`. `DELETE /api/users/{id}` is 405. Card payloads carry `due_state`, `assignee_is_active`, and `assignee_is_available`; Board payloads carry `slug`; notifications carry `board_slug` and `action`; `POST /api/auth/register` returns `{ user, token: null }` (this amends the shared register and login shape above).
  **Rationale:** One list of the V17 contract.
  **Example:** `GET /api/boards/slug/design-dev`.
