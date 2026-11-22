# Kanban API Reference

Hand-written guide to the backend API. The generated OpenAPI document (`backend/openapi.json`, produced by `flask export-openapi`) is the source of truth for every field and schema; this file explains the rules around it. All paths are under `/api`, with no version segment.

## Interactive docs (Swagger)

Swagger UI is served only for local work:

```bash
APP_ENV=development flask run     # then open http://localhost:5000/api/docs
```

| `APP_ENV` | `/api/docs` and `/api/openapi.json` |
|---|---|
| `development`, `testing` | served |
| `production`, unset, or any other value | not registered (404 error envelope) |

`APP_ENV` is optional and defaults to `production`, so a missing variable hides the docs. Regenerate the file with `flask export-openapi` after changing any route or schema; a test fails if `backend/openapi.json` is out of date.

## Response envelope

Every response carries a boolean `status` (true exactly when the HTTP status is 2xx) and a `message` string. The numeric HTTP status travels on the HTTP line only, not in the body.

Success (`status: true`):

```json
{ "status": true, "message": "OK", "data": { "id": "…", "title": "Fix login" } }
```

`data` is an object, a list, or `null`. Mutating endpoints send a short descriptive message ("Card moved"); reads send "OK". Create calls return HTTP 201. List endpoints return every row, except the Inbox and the two activity feeds, which are paged (see Paging below).

Error (`status: false`):

```json
{ "status": false, "message": "Validation failed",
  "error": { "code": "VALIDATION_ERROR", "details": { "content": ["content is required"] } } }
```

The message text appears once, at the top level; `error` holds only the machine-readable `code` and, for `VALIDATION_ERROR` from body or query validation, `details` (field name to a list of messages). Branch on `error.code`. The only responses without an envelope are the Swagger page, `/api/openapi.json`, and the successful bytes of `GET /api/attachments/{id}/file`.

| HTTP | `error.code` | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Bad body or query. marshmallow failures are mapped to 400, never 422 |
| 401 | `UNAUTHORIZED` | Missing, invalid or expired Token; bad login; any board route without a Token |
| 403 | `FORBIDDEN` | Valid Token but role, board access or ownership is not enough; bad file signature |
| 404 | `NOT_FOUND` | Unknown or soft-deleted resource, unknown route |
| 405 | `METHOD_NOT_ALLOWED` | Wrong HTTP method |
| 409 | `CONFLICT` | Duplicate username or email (`error.details` names each field), board member or category name |
| 429 | `RATE_LIMITED` | Too many failed logins, wrong current passwords or availability checks. Body `error.details.retry_after` and header `Retry-After` hold the seconds to wait |
| 500 | `INTERNAL_ERROR` | Unhandled error; generic message, details only in server logs |
| 503 | `SERVICE_UNAVAILABLE` | `GET /api/health` only: the database does not answer |

## Authentication

`POST /api/auth/register` and `POST /api/auth/login` return `{ user, token }`. Send the Token on every other call:

```
Authorization: Bearer <token>
```

The Token is a JWT with a fixed 24-hour expiry. It carries the user id and role; the role is read only from the signed Token, never from a request body. `POST /api/auth/logout` revokes nothing: the client discards the Token. Failed logins (5 per identifier and address, 20 per address), wrong current passwords (5 per user) and availability checks (60 per address) are rate limited in a 15-minute window; registration is not limited. Google login is not implemented.

Auth column in the tables below: **Token** = required, **Public** = no Token. There is no Guest access to boards: without a Token every board, card, comment, activity and search route returns 401. A Guest reads a board only through a share link (`/api/shared/{token}`).

## Roles

Roles: `guest` (no Token), `member`, `supervisor`, `manager`, `admin`. Admin is a separate administration track, not a Manager superset.

| Action | Guest | Member | Supervisor | Manager | Admin |
|---|---|---|---|---|---|
| Read a board, cards, categories, search | no (401) | if owner or member of it | if owner or member of it | yes | yes |
| Read comments and activity | no (401) | yes | yes | yes | yes |
| Create, delete, archive card; add column; manage categories | no | no | board owner or member | yes | yes |
| Edit or move a card | no | only when assigned | board owner or member | yes | yes |
| Comment, reply | no | yes | yes | yes | no |
| Toggle comment priority | no | no | no | yes | no |
| Create, archive, delete board | no | no | no | yes | yes |
| Change board owner (must be a supervisor) | no | no | no | yes | yes |
| Add a board member (Members and Supervisors only) | no | no | no | yes | yes |
| Remove a board member | no | no | if owner | yes | yes |
| Public link (`/share`) | no | no | no | yes | yes |
| Invite link and join-request list | no | no | if owner | yes | yes |
| Approve or reject a join request | no | no | no | yes | yes |
| Delete a comment | own only | own only | own only | own only | no |
| Toggle a subtask | no | only when assigned | board owner or member | yes | yes |
| Board analytics | no | no | only as owner | yes | no |
| Cross-board analytics | no | no | no | yes | no |
| Manage users | no | no | no | no | yes |

Every board is private (V12): it is visible only to its owner, its members, Managers and Admins, and `visibility` no longer exists (a posted `visibility` is 400). A request without a Token gets 401, a signed-in user without access gets 403. A Manager or an Admin can enable a read-only Public link; a Manager, an Admin or the board owner can enable an Invite link.

## Behaviours worth knowing

- **Soft delete.** Deleting a board or card sets `deleted_at`; the row stays and is hidden (404). Archive sets `archived_at`.
- **Ordering and move.** `PATCH /api/cards/{id}/move` takes `column_id` plus the neighbour ids `prev` and `next`. The server computes `order` (empty column `1.0`, first `min - 1`, last `max + 1`, otherwise the average) and ignores any client `order`. When two neighbours are closer than `1e-6` the column is renumbered `1.0, 2.0, …` in the same transaction. Moving to a column of another board returns 400. Subtasks reorder with `prev`/`next` or an explicit `order` on `PATCH /api/subtasks/{id}`.
- **Attachments.** Add a link (`{ "url": "https://…" }`) or upload a PDF, Word or RAR file as multipart `file`. Uploaded files are stored privately. A card response carries a fresh signed `file_url` (valid 15 minutes) per uploaded attachment; request a new one with `GET /api/attachments/{id}/url`. `GET /api/attachments/{id}/file?exp=&sig=` needs no Token and returns 403 for a missing, altered or expired signature.
- **Public link.** `POST /api/boards/{id}/share` creates a 256-bit token (Manager, Admin only; the owner gets 403); `POST …/share/regenerate` replaces it and `DELETE …/share` turns it off. `GET /api/shared/{token}` (and `/cards`, `/categories`, `/cards/{id}`, `/attachments/{id}/url`) need no Token, are GET only, never return comments, activity, owner, members, emails or avatars, and answer one 404 for any bad link. Shared file URLs carry a scope that dies with the token. A stale Bearer Token on these routes is ignored. Responses send `Cache-Control: private, no-store`.
- **Avatars in payloads.** Comment and reply authors carry `author_avatar_url`; board members, candidates and user payloads carry `avatar_url`; cards carry `assignee_name` and `assignee_avatar_url` (all null when there is none). Shared routes carry no avatar.
- **Avatars.** `POST /api/users/me/avatar` (multipart `file`, PNG, JPEG or WebP by content, at most 2 MB) and `DELETE /api/users/me/avatar`. `avatar_url` in user payloads is a signed URL (15 minutes) to `GET /api/users/{id}/avatar/file`, or null.
- **Invite link and join requests.** `POST /api/boards/{id}/invite` (owner, Manager, Admin) creates a 256-bit token, `…/invite/regenerate` replaces it, `DELETE` turns it off. A signed-in user opens `GET /api/invite/{token}` (`state`: `staff`, `member`, `pending`, `can_request`) and asks with `POST /api/invite/{token}/requests` (Manager and Admin get 400, a member or a pending requester 409). `GET /api/boards/{id}/join-requests` lists requests with each requester's Email (owner, Manager, Admin only); `PATCH /api/join-requests/{id}` approves or rejects (Manager, Admin only, 409 once decided). One 404 for any bad token; every `/api/invite` response is `Cache-Control: private, no-store`.
- **Board members.** `GET /api/boards/{id}/members` lists the owner first (`is_owner`), once. Adding a member and `GET …/candidates` are Manager and Admin only and accept Member and Supervisor accounts only. A card assignee must be the owner or a board member (400 `details.assignee_id`). Removing a member clears that user's assignments on the board.
- **Derived progress.** Every card carries `progress` (0 to 10, or null), `subtask_done_count` and `subtask_total_count`, computed from its subtasks; a posted `progress` is 400.
- **Deleting a comment.** `DELETE /api/comments/{id}` (author only) returns `{ "deleted": n }`; a top-level comment takes its replies with it, the parent's `reply_count` follows, and the activity row `comment.deleted` keeps no text.
- **Notifications.** Created server-side only: `assigned` when a card is assigned, `deadline` from the daily `flask notify-deadlines` job (dates in `APP_TIMEZONE`), and board types `board_join_requested`, `board_added`, `board_join_rejected` (no card). Each row carries `board_id`, `board_name`, `card_id`, `card_title`, `actor_name`; never an Email.
- **Search.** `GET /api/boards/{id}/cards?search=&filter[priority]=&filter[assignee]=&filter[category]=`. Filters combine with AND; an unsupported `filter[...]` key returns 400.
- **Comments.** `sort=latest|popular`; priority comments first; replies nested oldest first; replies to replies return 400. `can_create_card` is true when the viewer is a Supervisor, Manager or Admin and the author is a Manager. Every comment and reply carries `author_name`, and every activity row carries `actor_name` (the user's display name), so a client needs no user lookup.
- **Activity metadata.** New activity rows keep the names and changes in `metadata`, so a row reads without a lookup: `card_title` on every card event; `changes` on `card.updated` (`{field: {from, to}}` for `title`, `priority`, `start_date`, `end_date`, and `category` by name; a changed `description` is `{}`); `from_column_name` and `to_column_name` on `card.moved`; `assignee_name` on `card.assigned`; `title` on `card.subtask_*` events; `name` on `card.attachment_*` events; a `PATCH` that changes nothing writes no row. Rows written earlier keep their older keys.

## Endpoints


### auth

Register, log in, log out.

| Method | Path | Auth | Success | Errors | Summary |
|---|---|---|---|---|---|
| POST | `/api/auth/register` | Public | 201 | 400, 409, 422 | Register an account |
| POST | `/api/auth/login` | Public | 200 | 400, 401, 422 | Log in (`identifier` is a username or an email) |
| GET | `/api/auth/availability` | Public | 200 | 400 | Check whether a `username` or `email` is free |
| GET | `/api/auth/me` | Token | 200 | 401 | The signed-in user |
| PATCH | `/api/auth/me` | Token | 200 | 400, 401 | Update `full_name` (any other field is a 400) |
| POST | `/api/auth/change-password` | Token | 200 | 400, 401, 429 | Change the password (wrong current password is a 400) |
| POST | `/api/auth/logout` | Public | 200 | - | Log out |

### boards

Boards, archive, members, public link and the board activity feed.

| Method | Path | Auth | Success | Errors | Summary |
|---|---|---|---|---|---|
| POST | `/api/boards` | Token | 201 | 400, 401, 403, 422 | Create a board |
| GET | `/api/boards` | Token | 200 | 401 | List visible boards, each with `card_count`, `done_count`, `overdue_count`, `member_count` |
| GET | `/api/boards/{board_id}` | Token | 200 | 400, 401, 403, 404 | Get a board with its columns |
| PATCH | `/api/boards/{board_id}` | Token | 200 | 400, 401, 403, 404, 422 | Update name, description or owner |
| DELETE | `/api/boards/{board_id}` | Token | 200 | 401, 403, 404 | Soft-delete a board |
| POST | `/api/boards/{board_id}/archive` | Token | 200 | 401, 403, 404 | Archive a board |
| POST | `/api/boards/{board_id}/unarchive` | Token | 200 | 401, 403, 404 | Unarchive a board |
| GET | `/api/boards/{board_id}/members` | Token | 200 | 400, 401, 403, 404 | List board members (`?include=email` for board staff) |
| GET | `/api/boards/{board_id}/share` | Token | 200 | 401, 403, 404 | Public link state (Manager, Admin) |
| POST | `/api/boards/{board_id}/share` | Token | 200 | 401, 403, 404 | Enable the share link |
| POST | `/api/boards/{board_id}/share/regenerate` | Token | 200 | 401, 403, 404 | Replace the share token |
| DELETE | `/api/boards/{board_id}/share` | Token | 200 | 401, 403, 404 | Disable the share link |
| POST | `/api/boards/{board_id}/members` | Token | 201 | 400, 401, 403, 404, 409, 422 | Add a board member |
| DELETE | `/api/boards/{board_id}/members/{user_id}` | Token | 200 | 401, 403, 404 | Remove a board member |
| GET | `/api/boards/{board_id}/activity` | Token | 200 | 400, 401, 403, 404 | Board activity feed (paged) |
| GET | `/api/boards/{board_id}/invite` | Token | 200 | 401, 403, 404 | Invite link state (owner, Manager, Admin) |
| POST | `/api/boards/{board_id}/invite` | Token | 200 | 401, 403, 404 | Enable the invite link |
| POST | `/api/boards/{board_id}/invite/regenerate` | Token | 200 | 401, 403, 404 | Replace the invite token |
| DELETE | `/api/boards/{board_id}/invite` | Token | 200 | 401, 403, 404 | Disable the invite link |
| GET | `/api/boards/{board_id}/join-requests` | Token | 200 | 400, 401, 403, 404 | List join requests with the requester's Email |
| GET | `/api/invite/{token}` | Token | 200 | 401, 404 | Look up an invite |
| POST | `/api/invite/{token}/requests` | Token | 201 | 400, 401, 404, 409 | Ask to join a board |
| PATCH | `/api/join-requests/{request_id}` | Token | 200 | 400, 401, 403, 404, 409 | Approve or reject (Manager, Admin) |
| GET | `/api/boards/{board_id}/candidates` | Token | 200 | 400, 401, 403, 404 | Search users who can be added to a board |

### columns

Add a column to a board.

| Method | Path | Auth | Success | Errors | Summary |
|---|---|---|---|---|---|
| POST | `/api/boards/{board_id}/columns` | Token | 201 | 400, 401, 403, 404, 422 | Add a column |

### cards

Cards, move, subtasks, attachments, signed file URLs, card activity, search and filter.

| Method | Path | Auth | Success | Errors | Summary |
|---|---|---|---|---|---|
| POST | `/api/columns/{column_id}/cards` | Token | 201 | 400, 401, 403, 404, 422 | Create a card |
| GET | `/api/cards/{card_id}` | Token | 200 | 400, 401, 403, 404 | Get a card |
| PATCH | `/api/cards/{card_id}` | Token | 200 | 400, 401, 403, 404, 422 | Update a card |
| DELETE | `/api/cards/{card_id}` | Token | 200 | 401, 403, 404 | Soft-delete a card |
| POST | `/api/cards/{card_id}/archive` | Token | 200 | 401, 403, 404 | Archive a card |
| POST | `/api/cards/{card_id}/unarchive` | Token | 200 | 401, 403, 404 | Unarchive a card |
| PATCH | `/api/cards/{card_id}/move` | Token | 200 | 400, 401, 403, 404, 422 | Move or reorder a card |
| GET | `/api/cards/{card_id}/activity` | Token | 200 | 400, 401, 403, 404 | Card activity (paged) |
| GET | `/api/boards/{board_id}/cards` | Token | 200 | 400, 401, 403, 404, 422 | Search and filter a board's cards |
| POST | `/api/cards/{card_id}/subtasks` | Token | 201 | 400, 401, 403, 404, 422 | Add a subtask |
| PATCH | `/api/subtasks/{subtask_id}` | Token | 200 | 400, 401, 403, 404, 422 | Edit, toggle or reorder a subtask |
| DELETE | `/api/subtasks/{subtask_id}` | Token | 200 | 401, 403, 404 | Delete a subtask |
| POST | `/api/cards/{card_id}/attachments` | Token | 201 | 400, 401, 403, 404 | Add an attachment |
| DELETE | `/api/attachments/{attachment_id}` | Token | 200 | 401, 403, 404 | Delete an attachment |
| GET | `/api/attachments/{attachment_id}/url` | Token | 200 | 400, 401, 403, 404 | Issue a fresh signed file URL |
| GET | `/api/attachments/{attachment_id}/file` | Public | 200 | 403, 404 | Download an uploaded file |

### categories

Board-scoped categories.

| Method | Path | Auth | Success | Errors | Summary |
|---|---|---|---|---|---|
| GET | `/api/boards/{board_id}/categories` | Token | 200 | 400, 401, 403, 404 | List a board's categories |
| POST | `/api/boards/{board_id}/categories` | Token | 201 | 400, 401, 403, 404, 409, 422 | Create a category |
| PATCH | `/api/categories/{category_id}` | Token | 200 | 400, 401, 403, 404, 409, 422 | Rename or recolor a category |
| DELETE | `/api/categories/{category_id}` | Token | 200 | 401, 403, 404 | Delete a category |

### comments

Comments, replies and the priority flag.

| Method | Path | Auth | Success | Errors | Summary |
|---|---|---|---|---|---|
| POST | `/api/cards/{card_id}/comments` | Token | 201 | 400, 401, 403, 404, 422 | Add a comment |
| GET | `/api/cards/{card_id}/comments` | Token | 200 | 400, 401, 403, 404, 422 | List comments |
| POST | `/api/comments/{comment_id}/replies` | Token | 201 | 400, 401, 403, 404, 422 | Reply to a top-level comment |
| PATCH | `/api/comments/{comment_id}/priority` | Token | 200 | 401, 403, 404 | Toggle the priority flag |
| DELETE | `/api/comments/{comment_id}` | Token | 200 | 401, 403, 404 | Delete my comment (author only) |

### notifications

The caller's inbox.

| Method | Path | Auth | Success | Errors | Summary |
|---|---|---|---|---|---|
| GET | `/api/notifications` | Token | 200 | 400, 401 | List my notifications (paged) |
| PATCH | `/api/notifications/read-all` | Token | 200 | 401 | Mark all my notifications read |
| PATCH | `/api/notifications/{notification_id}/read` | Token | 200 | 401, 404 | Mark one notification read |

### analytics

Board and cross-board summaries.

| Method | Path | Auth | Success | Errors | Summary |
|---|---|---|---|---|---|
| GET | `/api/boards/{board_id}/analytics` | Token | 200 | 400, 401, 403, 404 | Board analytics |
| GET | `/api/analytics/boards` | Token | 200 | 401, 403 | Cross-board analytics |

### shared

Read-only board view through a share link. GET only; no Token.

| Method | Path | Auth | Success | Errors | Summary |
|---|---|---|---|---|---|
| GET | `/api/shared/{token}` | Public | 200 | 404 | Shared board |
| GET | `/api/shared/{token}/cards` | Public | 200 | 400, 404 | Shared cards (search and filters) |
| GET | `/api/shared/{token}/categories` | Public | 200 | 404 | Shared categories |
| GET | `/api/shared/{token}/cards/{card_id}` | Public | 200 | 404 | Shared card |
| GET | `/api/shared/{token}/attachments/{attachment_id}/url` | Public | 200 | 404 | Fresh signed file URL |

### users

User administration (Admin only).

| Method | Path | Auth | Success | Errors | Summary |
|---|---|---|---|---|---|
| GET | `/api/users` | Token | 200 | 401, 403 | List users |
| POST | `/api/users` | Token | 201 | 400, 401, 403, 409, 422 | Create a user |
| PATCH | `/api/users/{user_id}` | Token | 200 | 400, 401, 403, 404, 409, 422 | Update a user or assign a role |
| POST | `/api/users/me/avatar` | Token | 200 | 400, 401 | Upload my avatar |
| DELETE | `/api/users/me/avatar` | Token | 200 | 401 | Remove my avatar |
| GET | `/api/users/{user_id}/avatar/file` | Public | 200 | 403, 404 | Avatar image (signed URL) |

### health

For containers and deploys. No Token, no rate limit.

| Method | Path | Auth | Success | Errors | Summary |
|---|---|---|---|---|---|
| GET | `/api/health` | Public | 200 | 503 | Whether the database answers |

## Examples

Register:

```http
POST /api/auth/register
{ "full_name": "Ann", "username": "ann", "email": "ann@example.com", "password": "<at least 8 characters>" }

201 { "status": true, "message": "User registered",
      "data": { "user": { "id": "…", "full_name": "Ann", "username": "ann", "email": "ann@example.com", "avatar_url": null }, "token": "eyJ…" } }
```

Create a board (Manager):

```http
POST /api/boards
{ "name": "Sprint 1", "visibility": "private" }

201 { "status": true, "message": "Board created",
      "data": { "id": "…", "name": "Sprint 1", "visibility": "private", "owner_id": null, "archived_at": null,
                "columns": [ { "id": "…", "name": "Todo", "order": 0.0 }, … ] } }
```

Move a card between two neighbours:

```http
PATCH /api/cards/{id}/move
{ "column_id": "…", "prev": "<card above>", "next": "<card below>" }

200 { "status": true, "message": "Card moved",
      "data": { "id": "…", "column_id": "…", "order": 1.5, … } }
```

Add a comment (blank body is rejected):

```http
POST /api/cards/{id}/comments
{ "content": "   " }

400 { "status": false, "message": "Validation failed",
      "error": { "code": "VALIDATION_ERROR", "details": { "content": ["content is required"] } } }
```

Signed file URL:

```http
GET /api/attachments/{id}/url

200 { "status": true, "message": "OK",
      "data": { "file_url": "/api/attachments/{id}/file?exp=1767225600&sig=…", "expires_at": "2026-01-01T00:00:00+00:00" } }
```

Analytics (Manager):

```http
GET /api/boards/{id}/analytics

200 { "status": true, "message": "OK",
      "data": { "board_id": "…", "name": "Sprint 1", "total": 12, "done": 4, "in_progress": 3, "overdue": 1, "done_delta": 2 } }
```

## Paging

The Inbox (`GET /api/notifications`), the board activity feed, and the card activity list take `limit` (default 20, at most 100) and `before` (the id of the last row already shown). They return the next older rows in the same response shape; a response with fewer rows than `limit` is the last page. A `limit` outside 1 to 100, or a `before` that is not a row of that list, returns 400 `VALIDATION_ERROR`. The Inbox `unread_count` always counts all of the caller's notifications, and `GET /api/cards/{id}` embeds the first 20 activity rows. `GET /api/boards/{id}/candidates?search=` returns at most 20 users who are not members of the board, with `id`, `full_name`, `username`, `email` and `avatar_url` (owner, Manager, Admin). `search` must be at least 2 characters (400 otherwise) and matches the name by substring, the username by prefix, and the email exactly.

## Board description and counts

A board has a nullable `description` (at most 500 characters, trimmed, empty becomes null), accepted on `POST /api/boards` and `PATCH /api/boards/{id}` (name-change rules) and returned on every board response. `GET /api/boards` also returns four computed integers per board: `card_count` (cards not deleted and not archived), `done_count` (of those, in the `Done` column), `overdue_count` (of those, past their end date and not Done), and `member_count`. They come from two grouped queries whatever the number of boards.

