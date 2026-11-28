# Implementation Plan

## Overview

Version V12. Derived from `requirements.md` and `design.md` in this folder. Backend first (Flask + SQLAlchemy blueprints), then the Next.js frontend, then end-to-end tests and stretch features.

V12 adds group 35 (Decisions Y to AF): private-only Boards and the access model, the Public_Link, the Invite_Link and Join_Requests, Card modal Auto_Save, comment deletion, Subtask toggles and derived progress, clickable Inbox rows, and the Profile layout. Ticked tasks stay ticked even where V12 supersedes what they built; each affected one has an explicit rework task in group 35. Group 34 (V11 branding) is untouched.
V11 adds group 34 (Decision X): the RevoTask logo and favicon. It moves the three files from `frontend/images/` to `frontend/app/favicon.ico` and `frontend/public/brand/`, adds the shared `BrandLogo`, and uses it in the Sidebar, the sign-in pages, and the App_Header. It changes no Backend code.
V10 round 3 (Decisions U to W, an amendment, no new version) changes the avatar routes to `/api/users/me/avatar`, adds avatars to Comment, member, candidate, and assignee payloads, replaces the legacy backfill with a local-development reset, adds the change-password limiter and the 2-character candidate search minimum. It edits 33.1 to 33.3, 33.7, 33.18, 33.28 to 33.30, 33.27, and adds 33.41 to 33.48 (waves 84 to 89); IDs of existing tasks do not change.
V10 adds group 33 (Decisions K to P): the V10 migration (username, email, share token, rate-limit table), identity changes, the Rate_Limiter, share links and the shared routes, the Guest change (no public browsing), the profile endpoints, the App_Header with the User_Menu, the Profile_Page (the Email_Prompt was withdrawn in round 3), the route guard `proxy.ts`, the Share button and Shared_View, and the update of the V9 Playwright suite. No existing task is renumbered, and no ticked box changes: ticked tasks describe what was built under V9 (for example `login_identifier`, Guest access to public Boards, the Sidebar Log out item) and group 33 changes that behaviour.
V6 applies Decision G to the envelope. `status` is a boolean, true exactly when the HTTP status is 2xx; the numeric HTTP status travels on the HTTP line only. A success body is `{ "status": true, "message", "data" }`. An error body is `{ "status": false, "message", "error": { "code", "details"? } }`: the message text appears once at the top level, `error` has no `message` field, and `error.details` (field name to list of messages) appears only for `VALIDATION_ERROR`. Mutating endpoints pass a short descriptive message (for example "Card moved"); reads default to "OK". V6 edits tasks 1.2, 3.2, 8.1, 14.4, 15.3, 23.3, 24.1, 24.2, and 24.3 and the Notes. Existing checkbox states are unchanged; tasks already ticked that quote the old envelope are brought to the V6 shape by group 24.

V5 adds group 25, which adds the five SQLAlchemy relationships with `lazy="raise"` and moves related-row loading into the repositories with `selectinload` (Decision F). Group 25 runs after group 24 (the marshmallow schemas replace the DTO functions) and before the checkpoint 14.6 and the frontend group 15. It needs no database migration. Existing checkbox states are unchanged.

V4 adds group 24, which migrates the already-implemented backend (tasks 1 to 13, plain `flask.Blueprint`, `{ "data": ... }` bodies) to flask-smorest with marshmallow schemas and the `status`/`message` envelope (Decision E). Group 24 runs before the envelope property test 14.4, before the frontend (group 15 onward), and before the API documentation group 23. Group 23 is rewritten to document the generated OpenAPI instead of a hand-written `openapi.yaml`. Existing checkbox states are unchanged.

V14 (draft) adds group 37, production deployment. 37.1 blocks the deployment tasks 37.5 to 37.13; the code fixes do not depend on it.

## Tasks

- [x] 1. Backend scaffold, app factory, config, envelope, error handling, CORS, auth decorators
  - [x] 1.1 Create the Flask app factory and configuration
    - Add `backend/requirements.txt` (flask, flask-sqlalchemy, flask-migrate, flask-cors, flask-jwt-extended, argon2-cffi, psycopg, pytest, hypothesis) and `backend/app/__init__.py` with `create_app()`, `backend/app/extensions.py` (`db`, `migrate`).
    - Read `DATABASE_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS`, `FILE_URL_SECRET`, `APP_TIMEZONE`, `UPLOAD_DIR` from the environment; refuse to start when `ALLOWED_ORIGINS`, `JWT_SECRET`, `FILE_URL_SECRET`, or `APP_TIMEZONE` is missing, when `ALLOWED_ORIGINS` contains `*`, or when `APP_TIMEZONE` is not a valid IANA name.
    - Configure CORS once, app-wide, from the allow-list, with `supports_credentials` off.
    - Confirm `backend/.env.example` lists all six variables with empty or placeholder values.
    - _Requirements: 13.1, 13.8, 13.9_
  - [x] 1.2 Add the response envelope and error classes
    - Create `app/common/responses.py` (`ok(data, message=None, status=200)`, returning `{ "status": true, "message", "data" }`; `message` defaults to "OK"; the integer `status` only sets the HTTP status) and `app/common/errors.py` (`ValidationError` 400, `Unauthorized` 401, `Forbidden` 403, `NotFound` 404, `Conflict` 409, generic 500 handler) rendering `{ "status": false, "message", "error": { "code", "details"? } }` with no `error.message` (Decision G; group 24 brings the originally built shape to this one).
    - Register one error handler in the factory; routes contain no try/except.
    - _Requirements: 13.2, 13.3, 13.4, 13.11_
  - [x] 1.3 Add auth helpers, clock, and blueprint skeletons
    - Create `app/common/auth.py` with `ROLE_RANK`, `Actor(id, role)`, `current_actor()` (None for Guest), and `require_role(*roles)` that reads role only from JWT claims (401 without a valid Token, 403 when the role is not listed).
    - Create `app/common/clock.py` (injectable `now()` and `today(tz)` using `APP_TIMEZONE`).
    - Create `routes.py`, `service.py`, `repository.py`, `schema.py` stubs in each of `auth, boards, columns, cards, categories, comments, notifications, analytics, users` and register every blueprint under `/api`.
    - Set up `backend/tests/conftest.py` with an app fixture and fake-repository helpers.
    - _Requirements: 2.7, 2.8, 2.9, 13.1, 13.7_
  - [x]* 1.4 Write unit tests for configuration and CORS
    - Assert startup fails for each missing variable, for `*` in `ALLOWED_ORIGINS`, and for a bad `APP_TIMEZONE`; assert origins are parsed from the comma-separated list.
    - _Requirements: 13.8, 13.9_

- [x] 2. Data models and migrations
  - [x] 2.1 Create shared model base and the User, Board, BoardMember, Column models
    - Add `app/models/` modules with UUID primary keys (`default=uuid.uuid4`) and a `TimestampMixin` (`created_at`, `updated_at`).
    - `User`: `full_name`, `login_identifier` String(255) with a unique index on `lower(login_identifier)`, `password_hash`, `role` enum (member, supervisor, manager, admin), nullable `avatar_url`.
    - `Board`: `name`, `visibility` enum (public, private; default private), nullable `owner_id` FK User, `deleted_at`, `archived_at`. (V8 round 5 adds a nullable `description`, task 31.1.)
    - `BoardMember`: `board_id`, `user_id`, unique `(board_id, user_id)`.
    - `Column`: `board_id`, `name`, Float `order`.
    - _Requirements: 1.6, 3.8, 11.1, 13.5, 13.6_
  - [x] 2.2 Create Card, Category, Subtask, Attachment models
    - `Card`: `column_id`, nullable `category_id` (`ON DELETE SET NULL`), nullable `assignee_id`, `title`, `description`, `priority` enum (high, medium, low), nullable `start_date`/`end_date` Dates, Float `order`, `deleted_at`, `archived_at`; check constraint `end_date >= start_date` when both set.
    - `Category`: `board_id`, `name`, nullable `color`, unique index on `(board_id, lower(name))`.
    - `Subtask`: `card_id`, `title`, `is_done` default false, Float `order`; no assignee, dates, or `deleted_at`.
    - `Attachment`: `card_id`, `name`, nullable `url`, `file_path`, `mime_type`; check `url IS NOT NULL OR file_path IS NOT NULL`; no `deleted_at`.
    - _Requirements: 4.1, 4.2, 4.3, 4.12, 4.15, 4.16, 4.23, 4.29, 6.1, 13.5, 13.6_
  - [x] 2.3 Create Comment, ActivityLog, Notification models
    - `Comment`: `card_id`, `author_id`, nullable self-FK `parent_id`, `content`, `is_priority` default false, `reply_count` default 0; no `deleted_at`.
    - `ActivityLog`: `actor_id`, `action`, `target_type`, `target_id`, JSON `metadata`, `created_at` only.
    - `Notification`: `user_id`, `type` enum (assigned, deadline), `card_id`, `is_read` default false, `notify_date` Date, unique `(user_id, card_id, type, notify_date)`.
    - Use default `RESTRICT` foreign keys; no `ON DELETE CASCADE`.
    - _Requirements: 7.4, 8.1, 8.2, 9.1, 9.3, 13.5_
  - [x] 2.4 Generate the initial migration and a seed helper
    - Create the Flask-Migrate migration for all tables, functional indexes, and check constraints; leave `progress` and `views_count` out of it.
    - Add a CLI or fixture helper that creates users of each role for tests.
    - _Requirements: 13.5, 13.6, 16.3_
  - [x]* 2.5 Write integration tests for database constraints
    - Test case-insensitive uniqueness on `login_identifier` and `(board_id, name)`, the attachment check, the date check, the notification unique constraint, and `SET NULL` on category deletion.
    - _Requirements: 1.4, 4.3, 4.16, 6.12, 9.3_

- [x] 3. Authentication
  - [x] 3.1 Implement auth repository, schema, and service
    - `auth_repository` (`get_by_login`, `create_user`), `schema.py` validation (trim, non-empty full name, identifier at most 255 characters, password at least 8 characters), `auth_service.register` (argon2 hash, role `member`, 409 on case-insensitive duplicate) and `login` (case-insensitive match, 401 on bad credentials).
    - Apply no identifier format validation beyond trimming, non-empty, 255 maximum, and uniqueness.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.12, 1.13, 1.17_
  - [x] 3.2 Implement routes, JWT issuing, and logout
    - `POST /api/auth/register` and `POST /api/auth/login` return `{ user: {id, full_name, login_identifier, avatar_url}, token }`; Token carries user id and role, fixed 24-hour expiry, no revocation list.
    - `POST /api/auth/logout` returns `{ "status": true, "message": "Logged out", "data": null }` and revokes nothing.
    - Defer rate limiting; add no Google OAuth route.
    - _Requirements: 1.1, 1.2, 1.14, 1.15, 1.16, 1.18, 1.11_
  - [x]* 3.3 Write property test for registration and login round trip
    - **Property 1: Registration and login round trip**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.13**
  - [x]* 3.4 Write property test for registration validation and unique identifier
    - **Property 2: Registration validation and unique login identifier**
    - **Validates: Requirements 1.4, 1.5, 1.12, 1.17**
  - [x]* 3.5 Write unit tests for Token expiry and logout
    - Token expires 24 hours after issue; after logout the Token still validates until expiry.
    - _Requirements: 1.14, 1.15, 1.16_

- [x] 4. Board access, boards, columns, members, visibility, archive
  - [x] 4.1 Implement board access functions
    - In `board_service`, add `can_access(user, board)`, `can_write_staff(user, board)`, `is_owner(user, board)`, and `require_access(user, board)` (404 for soft-deleted, 401 for Guest on private, 403 for signed-in without access).
    - Add `board_repository` functions `get_by_id`, `is_member`, `list_visible(user)`; all queries exclude `deleted_at IS NOT NULL` by default.
    - _Requirements: 2.2, 3.4, 3.5, 11.5, 11.6, 11.11, 13.10_
  - [x]* 4.2 Write property test for Board_Access
    - **Property 4: Board_Access function**
    - **Validates: Requirements 3.4, 6.5, 7.1, 8.3, 8.4, 11.6, 11.11, 12.1, 12.7**
  - [x]* 4.3 Write property test for the permission matrix
    - **Property 3: Permission matrix and role source**
    - **Validates: Requirements 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.3, 3.4, 3.5, 3.7, 4.1, 4.4, 4.7, 6.1, 6.4, 7.3, 7.8, 10.4, 11.3, 11.9**
  - [x] 4.4 Implement board creation, listing, and retrieval
    - `POST /api/boards` (manager, admin) inserts the Board and five Default_Columns (`Todo, In Progress, Review, Revision, Done`, `order` 0 to 4) in one transaction.
    - `GET /api/boards` uses `list_visible` (Guest: public non-deleted; signed-in: public plus accessible); `GET /api/boards/{id}` calls `require_access` and `serialize_board` omits `comments` and `activity_log` for a Guest.
    - _Requirements: 2.1, 3.1, 3.3, 3.9, 3.10, 11.4, 11.7, 11.12_
  - [x]* 4.5 Write property test for default column seeding
    - **Property 6: Board creation seeds default columns**
    - **Validates: Requirements 3.1**
  - [x]* 4.6 Write property test for board list visibility
    - **Property 34: Board list visibility**
    - **Validates: Requirements 11.4, 11.6, 11.12**
  - [x] 4.7 Implement board update, owner reassignment, visibility, archive, soft delete
    - `PATCH /api/boards/{id}`: `owner_id` change by Manager or Admin only, new owner must have role `supervisor` (400 otherwise), `null` clears; visibility change by Manager, Admin, or owner/BoardMember Supervisor; log `board.owner_changed` and visibility changes in the same transaction.
    - `POST /api/boards/{id}/archive`, `POST /api/boards/{id}/unarchive`, `DELETE /api/boards/{id}` (soft, sets `deleted_at`), all Manager and Admin only; never hard-delete a Board.
    - _Requirements: 3.2, 3.6, 3.7, 3.8, 3.16, 3.17, 3.18, 3.19, 11.2, 11.3, 11.8, 11.9_
  - [x]* 4.8 Write property test for owner reassignment
    - **Property 19: Owner reassignment validation**
    - **Validates: Requirements 3.2, 3.16, 3.17, 3.18, 3.19**
  - [x]* 4.9 Write property test for soft delete and archive round trip
    - **Property 8: Soft delete hides without removing** (Board part; the card children part is completed in task 5.7)
    - **Property 9: Archive round trip** (Board part)
    - **Validates: Requirements 3.6, 3.8, 11.8, 11.10**
  - [x] 4.10 Implement board members endpoints
    - `GET /api/boards/{id}/members` (requires `can_access`), `POST /api/boards/{id}/members` body `{ "user_id" }` (owner, Manager, Admin; 409 when the pair exists; 404 when the user does not exist), `DELETE /api/boards/{id}/members/{user_id}` (404 when the pair does not exist); write one `board.member_added` or `board.member_removed` Activity_Log row in the same transaction.
    - _Requirements: 3.11, 3.12, 3.13, 3.14, 3.15_
  - [x]* 4.11 Write property test for BoardMember add and remove
    - **Property 18: BoardMember add and remove**
    - **Validates: Requirements 3.11, 3.12, 3.13, 3.14, 3.15**
  - [x] 4.12 Implement column creation
    - `POST /api/boards/{board_id}/columns` guarded by `require_access` then `can_write_staff`; new Column gets `order = max + 1`.
    - _Requirements: 2.6, 3.4, 3.5_
  - [x]* 4.13 Write property test for column append order
    - **Property 7: Column append order**
    - **Validates: Requirements 3.4**

- [x] 5. Cards, subtasks, attachments, assignment
  - [x] 5.1 Implement signing and clock-injectable file URL helpers
    - `app/common/signing.py`: `sign_file_url(attachment_id, now)` returns `/api/attachments/{id}/file?exp=&sig=` with `exp = now + 900 s` and HMAC-SHA256 over `"{id}.{exp}"` using `FILE_URL_SECRET`; `verify_file_signature(...)` uses `hmac.compare_digest` and rejects missing, tampered, or expired values.
    - _Requirements: 4.18, 4.24, 4.25_
  - [x]* 5.2 Write property test for signed URL validity and expiry
    - **Property 20: Signed file URL validity and expiry**
    - **Validates: Requirements 4.18, 4.24, 4.25**
  - [x] 5.3 Implement card CRUD, archive, soft delete
    - `card_repository` and `card_service`: `POST /api/columns/{column_id}/cards`, `GET /api/cards/{id}`, `PATCH /api/cards/{id}`, `DELETE /api/cards/{id}` (soft), `POST /api/cards/{id}/archive`, `POST /api/cards/{id}/unarchive`.
    - Validate priority (high, medium, low) and `end_date >= start_date` (400 `VALIDATION_ERROR`); creation, delete, and archive need `require_access` then `can_write_staff` (Members get 403); edits by a Member only when `assignee_id` equals the Member, by Supervisor/Manager/Admin only with Board_Staff_Access; write one Activity_Log row per change.
    - Child rows (subtasks, attachments, comments) are hidden by joining `Card.deleted_at`; never hard-delete a Card.
    - _Requirements: 2.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.23, 4.29, 11.10_
  - [x]* 5.4 Write property tests for card validation and edit scope
    - **Property 10: Card field validation**
    - **Validates: Requirements 4.1, 4.2, 4.3**
    - **Property 11: Member edit and move scope** (edit part; move part is completed in task 6.4)
    - **Validates: Requirements 4.8, 4.9, 4.10**
  - [x]* 5.5 Write property tests for soft delete of cards and archive round trip
    - **Property 8: Soft delete hides without removing** (card and children part)
    - **Validates: Requirements 4.5, 4.23, 4.29, 12.3**
    - **Property 9: Archive round trip** (card part)
    - **Validates: Requirements 4.6, 11.10**
  - [x] 5.6 Implement assignment and unassignment
    - `card_service.assign_card`: non-null `assignee_id` inserts an `assigned` Notification (`notify_date` = today in `APP_TIMEZONE`, conflict ignored) and a `card.assigned` Activity_Log row in the same commit; `null` clears the assignee, writes `card.unassigned`, creates no Notification.
    - _Requirements: 4.11, 4.28, 9.1_
  - [x]* 5.7 Write property test for assignment effects
    - **Property 12: Assignment and unassignment effects**
    - **Validates: Requirements 4.11, 4.28, 9.1**
  - [x] 5.8 Implement subtasks
    - `card_service.add_subtask`, `toggle_subtask`, `reorder_subtasks`, `delete_subtask` with `POST /api/cards/{id}/subtasks`, `PATCH /api/subtasks/{id}` (`title`, `is_done`, `order`), `DELETE /api/subtasks/{id}`; `is_done` defaults to false; edit rights as in task 5.3. Reorder uses `app/common/ordering.py` (created in task 6.1; stub the import here with the same interface or implement 6.1 first).
    - _Requirements: 4.12, 4.13, 4.14_
  - [x]* 5.9 Write property test for subtasks
    - **Property 13: Subtask toggle round trip and deletion**
    - **Validates: Requirements 4.12, 4.13, 4.14**
  - [x] 5.10 Implement attachments and signed file URL endpoints
    - `POST /api/cards/{id}/attachments` (JSON link or multipart upload; accept only PDF, Word, RAR; 400 for neither `url` nor file or a disallowed type before writing storage), `DELETE /api/attachments/{id}`.
    - Store uploads under the private `UPLOAD_DIR`, not mounted as a static route.
    - `GET /api/attachments/{id}/url` (open to Guests on public boards) re-runs `require_access` and returns `{ file_url, expires_at }`; `GET /api/attachments/{id}/file?exp=&sig=` takes no Token and returns 403 for a bad, tampered, missing, or expired signature, and 404 when the card or board is soft-deleted.
    - `serialize_card(card, viewer)` embeds a fresh signed `file_url` per uploaded attachment, returns link `url` as stored, and omits `comments` and `activity` for a Guest.
    - _Requirements: 4.15, 4.16, 4.17, 4.18, 4.24, 4.25, 4.26, 4.27, 8.5_
  - [x]* 5.11 Write property tests for attachments
    - **Property 14: Attachment validity**
    - **Validates: Requirements 4.15, 4.16, 4.17, 4.27**
    - **Property 21: Attachment access gating**
    - **Validates: Requirements 4.18, 4.26, 15.7**
  - [x]* 5.12 Write pytest tests for attachment access
    - Cover a permitted viewer, an unrelated Member (403), a Guest on a private board (401), a Guest on a public board (URL issued), an expired signature (403), and a modified `sig` or `exp` (403).
    - _Requirements: 15.7_

- [x] 6. Ordering and card move
  - [x] 6.1 Implement ordering helpers
    - `app/common/ordering.py`: `position_for(prev, next, siblings)` (empty list `1.0`, first `min - 1`, last `max + 1`, otherwise average), `needs_rebalance(prev, next)` (gap below `1e-6`), `rebalance(siblings)` renumbering `1.0, 2.0, ...` preserving order.
    - _Requirements: 4.13, 5.1, 5.10, 5.11_
  - [x]* 6.2 Write property test for ordering and rebalance
    - **Property 15: Drop order and rebalance (cards and subtasks)**
    - **Validates: Requirements 4.13, 5.1, 5.10, 5.11**
  - [x] 6.3 Implement move card
    - `PATCH /api/cards/{id}/move` with `column_id`, `prev`, `next` neighbour ids; `card_service.move_card`: `require_access`; Member only when assigned; Supervisor, Manager, Admin only with `can_write_staff`; 400 when the target column belongs to another board; recompute order server-side (ignore client `order`), renumber the column in the same transaction when the gap is below `1e-6`; write exactly one `card.moved` row with source and target column; commit once.
    - Return 401 without a Token.
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6, 5.7, 5.8, 5.10, 5.11, 5.12_
  - [x]* 6.4 Write property tests for move
    - **Property 16: Move persists, logs once, and stays on the board**
    - **Validates: Requirements 5.2, 5.8, 5.9, 5.12**
    - **Property 11: Member edit and move scope** (move part)
    - **Validates: Requirements 4.8, 4.9, 4.10, 5.4, 5.5, 5.6**
  - [x] 6.5 Checkpoint - Ensure all tests pass, ask the user if questions arise

- [x] 7. Categories
  - [x] 7.1 Implement the categories blueprint
    - `GET /api/boards/{board_id}/categories` (`require_access` only, no role check, Guests on public boards allowed, only that board's categories), `POST /api/boards/{board_id}/categories`, `PATCH /api/categories/{id}`, `DELETE /api/categories/{id}` (the last three need `can_write_staff`).
    - Case-insensitive duplicate name on a board returns 409 `CONFLICT` on create and rename; deleting a category nulls `Card.category_id`; categories of a soft-deleted board stay stored and are unreachable.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.12_
  - [x]* 7.2 Write property test for categories
    - **Property 17: Categories are board-scoped and name-unique**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.12**

- [x] 8. Comments
  - [x] 8.1 Implement comment creation and replies
    - `POST /api/cards/{id}/comments` (Member, Supervisor, Manager with `can_access`; Admin 403; blank body 400 `VALIDATION_ERROR` with `error.details.content` as a list whose first string is `content is required`) and `POST /api/comments/{id}/replies` (400 when the target has a non-null `parent_id`; increments the parent's `reply_count` in the same transaction). Provide no like or vote endpoint.
    - A Guest calling any comment endpoint gets 403 on a public board and 401 on a private board, with no `comments` field.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.16, 14.3_
  - [x]* 8.2 Write property tests for comment creation
    - **Property 22: Blank comments rejected**
    - **Validates: Requirements 7.1, 7.2**
    - **Property 23: Reply count invariant and depth cap**
    - **Validates: Requirements 7.4, 7.5**
  - [x] 8.3 Implement priority flag and listing
    - `PATCH /api/comments/{id}/priority` (Manager only toggles `is_priority`; others 403, no Token 401).
    - `GET /api/cards/{id}/comments?sort=latest|popular`: priority comments first (newest first), then others by `created_at DESC` (latest or omitted) or `(reply_count DESC, created_at DESC)` (popular); replies nested oldest-first regardless of sort; each comment has `reply_count`, `is_priority`, `can_create_card = viewer.role in (supervisor, manager, admin) and author.role == "manager"`.
    - _Requirements: 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.14, 7.15_
  - [x]* 8.4 Write property tests for comment listing
    - **Property 24: Priority flag toggle round trip**
    - **Validates: Requirements 7.7, 7.8**
    - **Property 25: Top-level comment ordering**
    - **Validates: Requirements 7.9, 7.10, 7.11**
    - **Property 26: Reply ordering independent of sort**
    - **Validates: Requirements 7.12**
    - **Property 27: Comment flags**
    - **Validates: Requirements 7.13, 7.14, 7.15**
  - [x]* 8.5 Write pytest tests for comment creation
    - Cover success, validation failure (blank body), unauthenticated (401), and unauthorized (Guest and Admin) cases against the Flask test client.
    - _Requirements: 15.1_

- [x] 9. Activity log
  - [x] 9.1 Implement the activity repository and read endpoints
    - `activity_repository.add(...)` is the only write function (no update or delete); each service calls it inside its own transaction, and a failed call inserts no row.
    - `GET /api/cards/{id}/activity` returns rows with `target_type = card` and that id; `GET /api/boards/{id}/activity` returns rows for the board's cards, columns, and board-level actions; both require `can_access` and return no `activity`/`activity_log` field to a Guest, even when requested explicitly.
    - Log user management actions (`user.created`, `user.updated`, `user.role_changed`) through the same repository (wired in task 13.1).
    - _Requirements: 1.7, 8.1, 8.2, 8.3, 8.4, 8.5_
  - [x]* 9.2 Write property tests for activity
    - **Property 29: One activity row per state change**
    - **Validates: Requirements 1.7, 8.1, 8.2**
    - **Property 30: Activity queries return the right rows**
    - **Validates: Requirements 8.3, 8.4**
  - [x]* 9.3 Write property test for guest privacy
    - **Property 28: Guest responses never include comments or activity**
    - **Validates: Requirements 7.16, 8.5, 11.7, 12.6, 14.3**

- [x] 10. Notifications and deadline job
  - [x] 10.1 Implement inbox and read endpoints
    - `GET /api/notifications` returns `{ items, unread_count }` for the caller only; `PATCH /api/notifications/{id}/read` and `PATCH /api/notifications/read-all` act only on the caller's rows; a foreign or unknown id returns 404.
    - Notifications are created server-side only.
    - _Requirements: 9.4, 9.5, 9.8, 9.9, 9.10_
  - [x] 10.2 Implement the deadline job
    - `app/jobs/deadlines.py` `run(now)`: compute `today` in `APP_TIMEZONE`, select cards with `end_date == today`, `deleted_at IS NULL`, and an assignee, insert `deadline` notifications with `INSERT ... ON CONFLICT DO NOTHING`; expose it as `flask notify-deadlines` and a daily schedule.
    - _Requirements: 9.2, 9.3_
  - [x]* 10.3 Write property tests for notifications
    - **Property 31: Deadline job notifies once, in APP_TIMEZONE**
    - **Validates: Requirements 9.2, 9.3**
    - **Property 32: Inbox isolation and read marking**
    - **Validates: Requirements 9.5, 9.8, 9.9, 9.10**

- [x] 11. Analytics
  - [x] 11.1 Implement analytics endpoints
    - `GET /api/boards/{id}/analytics`: Manager any board; Supervisor only when `owner_id == actor.id` (BoardMember Supervisor 403); Member and Admin 403; no Token 401.
    - `GET /api/analytics/boards` (Manager only) returns one summary per board in one response.
    - Use one grouped query per board returning `done`, `in_progress`, `overdue`, `total`, `done_delta` for the previous 7 days; overdue is a non-deleted card with `end_date < today` (in `APP_TIMEZONE`) not in the `Done` column; no per-card data in the payload.
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_
  - [x]* 11.2 Write property test for analytics
    - **Property 33: Analytics access and correctness**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.7**

- [x] 12. Card search and filter
  - [x] 12.1 Implement the board cards list
    - `GET /api/boards/{id}/cards?search=&filter[priority]=&filter[assignee]=&filter[category]=`: `require_access` first (403 signed-in, 401 Guest on private); case-insensitive substring match on `title` or `description`; filters combine with AND; unsupported filter key returns 400 `VALIDATION_ERROR`; always exclude soft-deleted cards; Guest results contain card data only.
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.6, 12.7_
  - [x]* 12.2 Write property test for search and filter
    - **Property 35: Search and filter correctness**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4**

- [x] 13. User administration
  - [x] 13.1 Implement admin user management
    - `GET /api/users`, `POST /api/users`, `PATCH /api/users/{id}` (edit, assign role), Admin only; each mutation writes `user.created`, `user.updated`, or `user.role_changed` to the Activity_Log in the same transaction; non-Admin gets 403, no Token 401.
    - _Requirements: 1.7, 1.8, 2.4_
  - [x]* 13.2 Write unit tests for user administration
    - Cover Admin success, Member, Supervisor, and Manager 403, no Token 401, and the activity row.
    - _Requirements: 1.7, 1.8_

- [x] 14. Backend checkpoint and cross-cutting tests
  - [x]* 14.1 Write the 401/403 sweep test for every mutating endpoint
    - Enumerate registered POST, PATCH, PUT, DELETE routes; assert 401 with no Token and 403 with an insufficient-role Token, excluding the public auth routes and the signature-gated file route; fail when a mutating route is missing from the list.
    - _Requirements: 2.8, 2.9, 2.10, 15.5_
  - [x]* 14.2 Write property test for 401 versus 403 versus 404
    - **Property 5: 401 versus 403 versus 404**
    - **Validates: Requirements 2.8, 2.9, 11.5, 12.7, 13.10**
  - [x]* 14.3 Write the Board_Access matrix and private board tests
    - Cover {guest, member, supervisor owner, supervisor BoardMember, supervisor unrelated, manager, admin} against {public, private} for columns, cards, categories, comments, activity, search, and attachments, including an unrelated Supervisor getting 403 on public-board writes and an unrelated Member getting 403 on a private board.
    - _Requirements: 15.4, 15.6_
  - [x]* 14.4 Write property test for the response envelope
    - Run against the Flask test client for every registered `/api` route (excluding the documentation routes and the successful bytes of the signed file route), including unknown routes and wrong methods; requires group 24.
    - Assert success bodies are exactly `{ status: true, message, data }` and error bodies are exactly `{ status: false, message, error: { code, details? } }`, with `status` a boolean that is true exactly when the HTTP status is 2xx (never a number), `message` a non-empty string, no `error.message` field, and `error.details` present only for validation failures, which return 400 `VALIDATION_ERROR` (never 422) with every failing field mapped to a non-empty list of strings.
    - **Property 36: Response envelope**
    - **Validates: Requirements 13.2, 13.3, 13.4, 13.11, 13.13**
  - [x]* 14.5 Write static checks
    - Assert no `.query` call outside a `repository.py` file, and that `.env.example` files list the required variables and no real `.env` is tracked.
    - _Requirements: 13.7, 13.9, 15.4_
  - [x] 14.6 Checkpoint - Ensure all tests pass, ask the user if questions arise

- [x] 15. Frontend scaffold, tokens, shared components, API client, auth pages
  - [x] 15.1 Scaffold the Next.js app and design tokens
    - Initialize Next.js (App Router, TypeScript) in `frontend/`; confirm `frontend/.env.example` lists `NEXT_PUBLIC_API_URL`.
    - Create `styles/tokens.css` copying the prototype's `:root` custom properties (`--brand`, `--surface-*`, `--ink*`, `--space-*`, `--radius-*`, `--label-*`) from `design/kanban-prototype.html`; use only these variables for colors, spacing, and radii, with mobile-first base styles and `min-width` queries (960px breakpoint).
    - _Requirements: 14.5, 14.9_
  - [x] 15.2 Create shared components
    - `BaseButton`, `BaseBadge`, `BaseModal` in `frontend/components/shared/`, styled only from `tokens.css`; all pages import these instead of raw `<button>`, badges, or modals.
    - _Requirements: 14.9, 14.10_
  - [x] 15.3 Create the API client and session handling
    - `lib/api.ts`: adds the Bearer token, reads the boolean `status` of `{ status, message, data }` and returns `data` when it is true; when it is false, throws a typed `ApiError(httpStatus, code, message, details)` where `httpStatus` comes from the `Response`, `code` from `error.code`, `message` from the top-level `message`, and `details` from `error.details` (field to list of messages, present for `VALIDATION_ERROR`; forms map it onto their fields). A 401 clears the stored Token and redirects to login; logout calls `POST /api/auth/logout` then discards the Token.
    - _Requirements: 1.15, 1.16, 13.2, 13.3, 13.13_
  - [x] 15.4 Build login and register pages
    - `app/(auth)/login/page.tsx` and `register/page.tsx` using an `AuthSplitLayout` Server Component: brand panel beside an elevated rounded form card on desktop; brand panel hidden at mobile width.
    - Forms submit `login_identifier` and password through the API client and store the returned Token.
    - _Requirements: 1.1, 1.2, 1.9, 1.10, 14.4, 14.5_
  - [x]* 15.5 Write component tests for shared components and auth pages
    - Test that the auth form renders and shows server errors; test `BaseButton`, `BaseBadge`, `BaseModal` basics with React Testing Library.
    - _Requirements: 1.9, 14.10_

- [x] 16. App shell, sidebar, side panel
  - [x] 16.1 Build the app shell
    - `app/(app)/layout.tsx` (Server Component) with `Sidebar` (Client): brand, nav with Inbox and Activity links, Boards list from `GET /api/boards` as the board switcher, team members, profile; Categories entry only for supervisor, manager, admin.
    - Below 960px the sidebar is an off-canvas drawer behind a scrim with its toggle in a persistent header; at 960px and above it stays visible.
    - Place primary actions (add card, open Inbox, switch Board) in the persistent header or bottom third on mobile.
    - _Requirements: 3.9, 6.11, 14.6, 14.7, 14.8, 14.11_
  - [x] 16.2 Build the side panel host
    - `SidePanel` (Client) sliding in from the right with one shared `toggleSidePanel("inbox" | "activity")` called by the sidebar items and the header bell; render a view only when the API returned its data.
    - _Requirements: 8.6, 9.6, 9.7_

- [x] 17. Board view, filters, drag-and-drop
  - [x] 17.1 Build the board page and filter row
    - `app/(app)/boards/[id]/page.tsx` (Server Component) fetches columns and cards; `FilterRow` (Client) renders category chips from `GET /api/boards/{id}/categories` (no hard-coded list), re-fetches on board switch, and a search input; chip selection and search call `GET /api/boards/{id}/cards`.
    - _Requirements: 3.10, 6.9, 6.10, 12.5_
  - [x] 17.2 Implement drag-and-drop
    - `lib/ordering.ts` with pure `computeDropOrder` mirroring the backend rules (first `min - 1`, last `max + 1`, empty `1.0`, average otherwise).
    - `Board` (Client): placeholder at the drop target, FLIP animation of siblings, `PATCH /api/cards/{id}/move` on `dragend`, reconcile with the response, revert the card on failure; after refresh the card renders at its moved position.
    - Add a per-column "+ Add a card" action inside the thumb-reach rule.
    - _Requirements: 5.2, 5.3, 5.9, 14.8_
  - [x]* 17.3 Write fast-check test for drop order
    - Mirror Property 15 for `computeDropOrder`.
    - **Property 15: Drop order and rebalance (cards and subtasks)**
    - **Validates: Requirements 4.13, 5.1, 5.10, 5.11**

- [x] 18. Card modal, subtasks, attachments, comments
  - [x] 18.1 Build the two-pane card modal
    - `CardModal` (Client) using `BaseModal`: left pane has title, description (`CardDescription` Server Component), priority, dates, attachments, subtask checklist, and `ActivityList` (Server Component); right pane has the comment thread and composer.
    - "Save changes" commits the left pane without closing the modal or affecting the composer; omit the activity section and comment thread when the response omits `activity` or `comments`.
    - _Requirements: 4.20, 4.21, 7.20, 8.7, 14.11_
  - [x] 18.2 Build the subtask checklist and attachment list
    - `SubtaskChecklist` (Client): flat checkbox list, inline-editable titles, drag handle reorder, one-click toggle calling `PATCH /api/subtasks/{id}`.
    - `AttachmentList` (Client): links open with `target="_blank" rel="noopener noreferrer"`, no in-app preview; before opening, request a fresh URL from `GET /api/attachments/{id}/url` when the `exp` query value has passed or a request returns 403.
    - _Requirements: 4.14, 4.19, 4.22_
  - [x] 18.3 Build the comment thread and composer
    - `CommentThread` (Client): priority comments first with a priority indicator, remaining top-level comments under a Latest/Popular toggle with a reply-count badge, replies nested, Reply action only where `parentId === null`, no like button, "Create card" button only where `comment.canCreateCard`, a Manager-only "Mark as priority" action.
    - `CommentComposer` posts independently without closing the modal.
    - _Requirements: 7.17, 7.18, 7.19, 7.20_
  - [x]* 18.4 Write component tests for card modal pieces
    - Reply only on top-level comments; create-card button only when `canCreateCard`; thread, activity, and inbox omitted when the data is absent; `AttachmentList` renders `target="_blank" rel="noopener noreferrer"` and requests a fresh URL when expired.
    - _Requirements: 4.19, 7.18, 7.19, 7.20, 8.7, 9.7_

- [ ] 19. Inbox, activity panel, categories screen, members screen
  - [x] 19.1 Build inbox and activity panel contents
    - Inbox view lists `GET /api/notifications` with unread count and mark-read / read-all actions; Activity view lists the board feed from `GET /api/boards/{id}/activity`; neither polls or computes notifications client-side.
    - _Requirements: 8.6, 9.4, 9.5, 9.6, 9.8, 9.9_
  - [x] 19.2 Build the admin users screen
    - `app/(app)/admin/users/page.tsx` for Admin user management. (V8 round 4: the Categories screen moved to task 30.8; the board members screen is replaced by the Sidebar Team members section, task 30.3.)
    - _Requirements: 1.7, 3.11, 3.14, 6.11_
  - [ ] 19.3 Checkpoint - Ensure all tests pass, ask the user if questions arise

- [ ] 20. End-to-end test
  - [ ] 20.1 Write the Playwright Kanban journey
    - Against the deployed URL: register, log in, open a board, add and drag a card, reload and confirm position, open the card modal, comment, reply, toggle Latest and Popular.
    - Use web-first assertions such as `expect(locator).toBeVisible()`; never use `waitForTimeout`.
    - _Requirements: 15.2, 15.3_
  - [ ]* 20.2 Write viewport and static checks
    - Playwright viewport tests at 360, 414, and 960 pixels (no horizontal scroll, drawer below 960, sidebar visible at 960); a CI grep step that fails if `waitForTimeout` appears in any Playwright test file.
    - _Requirements: 14.4, 14.6, 14.7, 15.3_

- [ ] 21. Final checkpoint
  - [ ] 21.1 Ensure all tests pass, ask the user if questions arise
    - Run backend `pytest` and frontend tests; confirm no `.env` file is committed and the 401/403 sweep passes.
    - _Requirements: 13.9, 15.1, 15.4, 15.5_

- [ ] 22. Stretch features (build only after tasks 1 to 21 work end-to-end)
  - [ ] 22.1 Add progress and views_count to the backend
    - V12 (Decision AD): `progress` is no longer stored; it is derived from Subtasks in task 35.15. Add only `Card.views_count` (integer, default 0) in a later migration; expose it in card serialization; increment `views_count` on card open.
    - _Requirements: 16.1, 16.3_
  - [ ] 22.2 Add the progress meter, views counter, and decorative tabs
    - Render the per-card progress meter, views counter, and Overview, Notes, Questions tabs in `CardModal` as in the prototype, behind a feature flag, using only token variables.
    - _Requirements: 16.2, 16.3_

- [x] 23. API documentation (generated OpenAPI, Swagger UI, API.md)
  - [x] 23.1 Finish the `APP_ENV` gating and remove the hand-written documentation stack
    - Confirm `APP_ENV=` is listed in `backend/.env.example` and that `create_app()` defaults it to `production` without failing when it is missing.
    - Confirm `OPENAPI_URL_PREFIX`, `OPENAPI_JSON_PATH`, `OPENAPI_SWAGGER_UI_PATH`, and `OPENAPI_SWAGGER_UI_URL` are set only when `APP_ENV` is `development` or `testing`, so `/api/docs` and `/api/openapi.json` return the 404 envelope otherwise; use `APP_ENV=testing` in the default test app and `production` in the production test.
    - Ensure `backend/requirements.txt` has no `flask-swagger-ui` or `pyyaml`, and that no `backend/app/docs.py` or `backend/openapi.yaml` exists.
    - Exclude the documentation routes from the 401/403 sweep in task 14.1 (they are read-only, public, and carry no secrets).
    - _Requirements: 17.4, 17.5, 17.6, 17.7, 17.10_
  - [x] 23.2 Complete the generated OpenAPI metadata and export it
    - On every endpoint add `@blp.doc` summary and description (roles allowed, access rule), a tag per blueprint, request and response examples where useful, `security=[{"bearerAuth": []}]` on protected operations, and the 400/401/403/404/409 error responses (`@blp.alt_response` or `Api.ERROR_SCHEMA`); give every marshmallow field a description so the generated document is complete.
    - Run `flask export-openapi` and commit the generated `backend/openapi.json`; never edit it by hand.
    - _Requirements: 17.1, 17.3_
  - [x] 23.3 Write `backend/API.md`
    - Cover the envelope (boolean `status`, one top-level `message`, `data`; errors as `error: { code, details? }` with no `error.message`), error codes, authentication, the role matrix, signed file URLs, ordering and move semantics, then one table plus an example request and response per blueprint group. Examples show `{ "status": true, "message": "Card moved", "data": {...} }` for a mutating call, `"message": "OK"` for a read, and a 400 example `{ "status": false, "message": "Validation failed", "error": { "code": "VALIDATION_ERROR", "details": { "content": ["Missing data for required field."] } } }`; state that the generated `openapi.json` is the source of truth and how to enable Swagger locally (`APP_ENV=development`), and that it is off in production.
    - _Requirements: 17.2_
  - [x]* 23.4 Write the drift and production-gate tests
    - **Property 37: Every route is documented** (iterate `app.url_map` under `/api`, excluding `static` and the documentation routes, and assert each method and path has an operation in `api.spec.to_dict()["paths"]`, and the reverse)
    - **Property 38: Documentation hidden outside development and testing** (`/api/docs` and `/api/openapi.json` return 200 for `development` and `testing`, and the 404 envelope for `production`, unset, or any other value)
    - **Validates: Requirements 17.1, 17.4, 17.5, 17.6, 17.8, 17.9**

- [x] 24. Migrate the implemented backend to flask-smorest and the status/message envelope
  - [x] 24.1 Add flask-smorest, the envelope, and the error mapping
    - Add `flask-smorest` and `marshmallow` to `backend/requirements.txt`.
    - Create `backend/app/api.py` with `EnvelopeApi(flask_smorest.Api)`: register every blueprint on it, declare the `bearerAuth` scheme once, and map errors to `{ status: false, message, error: { code, details? } }` (no `error.message`; the text appears once at the top level, defaulting to the HTTP reason phrase when an error has no custom text): `AppError` to its status and code, smorest/webargs 422 to 400 `VALIDATION_ERROR` with top-level message "Validation failed" and `error.details` mapping each field to the list of marshmallow messages (location keys such as `json` or `query` unwrapped), 404 `NOT_FOUND`, 405 `METHOD_NOT_ALLOWED`, any other exception to 500 `INTERNAL_ERROR` with a generic message, and the JWT missing, invalid, and expired callbacks to the 401 envelope. Set `Api.ERROR_SCHEMA` to the error envelope schema. Remove the old app-level error handler.
    - In `api.py`, set `API_TITLE`, `API_VERSION`, `OPENAPI_VERSION`, and, only when `APP_ENV` is `development` or `testing`, the `OPENAPI_*` keys for `/api/openapi.json` and `/api/docs`; add the `flask export-openapi` command that writes `backend/openapi.json` from `api.spec.to_dict()` under any `APP_ENV`.
    - Create `backend/app/common/envelope.py` with `envelope(DataSchema, many=False)` (cached `<Name>Envelope` / `<Name>ListEnvelope` schema with `status` as a `Boolean`, `message`, `data`), `NullEnvelopeSchema`, and `ErrorEnvelopeSchema` (`status`, `message`, `error` with `code` and optional `details`, and no `error.message`).
    - Change `ok(data, message=None, status=200)` in `app/common/responses.py` to return `{ "status": true, "message", "data" }` with "OK" as the default message; the integer argument only sets the HTTP status and is not placed in the body. Update error rendering in `app/common/errors.py` and `EnvelopeApi` to emit `status: false`, the top-level `message`, and `error: { code, details? }`.
    - Keep `AppError` classes free of Flask imports; keep all URLs, status codes, and role rules unchanged.
    - _Requirements: 13.2, 13.3, 13.4, 13.11, 13.12, 13.13, 13.15, 17.3, 17.4, 17.5, 17.6, 17.10_
  - [x] 24.2 Convert each blueprint to flask-smorest with marshmallow schemas
    - For each of `auth, boards (including members), columns, cards (including subtasks, attachments, and the board cards search/filter), categories, comments, notifications, analytics, users, activity (card and board activity reads)`: replace `flask.Blueprint` with `flask_smorest.Blueprint`; turn `schema.py` into marshmallow request, query, and payload schemas; validate with `@blp.arguments(Schema)` or `@blp.arguments(Schema, location="query")`; declare each success response with `@blp.response(status, envelope(PayloadSchema))` (`NullEnvelopeSchema` for logout); mark protected operations with `@blp.doc(security=[{"bearerAuth": []}])`; return `ok(dto, "<descriptive message>", status)` with the same status as the declaration. Each mutating route (POST, PATCH, PUT, DELETE) passes its own short descriptive message (for example "Card created", "Card moved", "Logged out"); read routes pass none and get "OK".
    - Keep data-dependent rules (uniqueness, access, ordering, ownership) in the service; `service.py` and `repository.py` import none of `flask`, `flask_smorest`, or `marshmallow`. Keep `filter[<field>]` parsing and the `400` for an unsupported filter key, and the signed file route returning raw bytes on success and the error envelope on failure.
    - Keep every URL, HTTP status code, and role rule unchanged.
    - _Requirements: 13.2, 13.3, 13.12, 13.13, 13.14, 13.15_
  - [x] 24.3 Update the existing tests and add envelope tests
    - Update the 36 existing pytest tests that assert `{ "data": ... }`, `{ "error": ... }`, a numeric `body["status"]`, or `body["error"]["message"]` to the V6 shapes `{ status: true, message, data }` and `{ status: false, message, error: { code, details? } }`; read the HTTP status from `response.status_code` and the text from `body["message"]`; change no expected HTTP status.
    - Add tests that: every success body has boolean `status` `true` (never the number 200) and a non-empty `message`, with mutating endpoints returning a descriptive message and reads returning "OK"; every error body has boolean `status` `false`, a single non-empty top-level `message`, an `error.code`, and no `error.message`; `error.details` is absent on every error except `VALIDATION_ERROR`; body and query validation failures return 400 `VALIDATION_ERROR`, never 422, with `error.details` mapping every failing field to a non-empty list of strings (for example a blank comment gives `error.details.content`); an unknown route returns the 404 envelope, a wrong method returns the 405 envelope, a forced unhandled exception returns the 500 envelope with a generic message, and a missing or invalid JWT returns the 401 envelope; the signed file route returns the error envelope on failure.
    - _Requirements: 13.2, 13.3, 13.4, 13.11, 13.13_
  - [x] 24.4 Checkpoint - Run the full pytest suite
    - Run the full backend `pytest` suite and ensure all tests pass, ask the user if questions arise.

- [x] 25. Add model relationships and eager loading
  - [x] 25.1 Add the five relationships to the models
    - Declare `Board.columns`, `Board.members`, `Card.subtasks`, `Card.attachments`, and `Comment.replies`, each with its inverse (`Column.board`, `BoardMember.board`, `Subtask.card`, `Attachment.card`, `Comment.parent` with `remote_side`) through `back_populates` (never `backref`), `lazy="raise"`, the `order_by` from the design's relationship table, and no `cascade`.
    - Declare no other relationships; `Card.assignee_id`, `Card.category_id`, `Comment.author_id`, `Board.owner_id`, and `Card.column_id` stay plain foreign-key columns.
    - Remove any `to_dict` or other serialization method still on a model; serialization stays in the marshmallow schemas.
    - Add no migration: this is a mapper-level change only.
    - _Requirements: 13.16, 13.17_
  - [x] 25.2 Load related rows in the repositories
    - Per the design's repository loading table: `board_repository.get_detail` uses `selectinload(Board.columns)`; `card_repository.list_for_board` and `get_detail` use `selectinload(Card.subtasks)` and `selectinload(Card.attachments)`; `comment_repository.list_for_card` uses `selectinload(Comment.replies)` and selects the author role in the same joined query.
    - Fix every service, schema, and route that now raises because it read an unloaded relationship; services and schemas must trigger no lazy load, and the board cards list must run a constant number of queries.
    - _Requirements: 13.18, 14.12_
  - [x]* 25.3 Write tests for relationships and constant query count
    - **Property 39: Constant query count for list endpoints**: count SQL statements with a `before_cursor_execute` listener for a board with 5 cards and a board with 50 cards (each with subtasks and attachments), and assert the counts are equal; repeat for the comment listing.
    - Add the `lazy="raise"` test: access an unloaded `Card.subtasks`, `Board.columns`, `Board.members`, `Card.attachments`, and `Comment.replies` and assert `sqlalchemy.exc.InvalidRequestError`, then assert the access succeeds when the repository loads it.
    - Add a static check: no model defines `to_dict`, and each of the five relationships has `lazy="raise"`, `back_populates`, and no `cascade`.
    - **Validates: Requirements 13.16, 13.17, 13.18, 14.12, 15.8, 15.9**
  - [x] 25.4 Checkpoint - Run the full pytest suite
    - Run the full backend `pytest` suite and ensure all tests pass, ask the user if questions arise.

- [x] 26. Migrate the frontend styling to Tailwind CSS and shadcn/ui (Decision H)
  - [x] 26.1 Install Tailwind CSS v4 and map the theme to the design tokens
    - Install `tailwindcss`, `@tailwindcss/postcss`, `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-dialog`, `@radix-ui/react-slot`, `tw-animate-css`; add `postcss.config.mjs` and `lib/utils.ts` (`cn`).
    - Rewrite `styles/globals.css`: `@import "tailwindcss"`, an `@theme` block that clears the default palette and maps utilities to the tokens in `styles/tokens.css` (colors, `--space-*`, `--radius-*`, `--shadow-*`, `--breakpoint-lg: 60rem`), and shadcn variable aliases. Keep `tokens.css` as the single source; delete `shell.css`.
    - _Requirements: 14.5, 14.9, 14.13, 14.14_
  - [x] 26.2 Add the shadcn/ui primitives and rewrite the Base components as wrappers
    - Add `components/ui/button.tsx`, `badge.tsx`, `dialog.tsx` themed from the tokens; rewrite `BaseButton`, `BaseBadge`, `BaseModal` as thin wrappers with unchanged props. Nothing outside `components/shared/` imports `components/ui/`.
    - _Requirements: 14.10, 14.13, 14.15_
  - [x] 26.3 Restyle the app with Tailwind utilities, following the prototype
    - Replace the hand-written class names in the auth pages, app shell, sidebar, side panel, board, card tile, card modal, subtask checklist, attachment list, and comment thread. Keep the prototype's palette, layout, and interaction patterns; refine type scale, elevation, spacing rhythm, and motion (honoring `prefers-reduced-motion`).
    - Base styles target 360 to 414 px; `lg:` adds the desktop layout; no `max-*` layout variants, no arbitrary values, no hex colors.
    - _Requirements: 14.4, 14.5, 14.6, 14.7, 14.9, 14.13_
  - [x] 26.4 Update tests and add the static styling check
    - Update component tests to assert roles, names, and attributes instead of class names; add a test that scans `components/**` and `app/**` for hex colors, arbitrary-value utilities, and imports of `components/ui/` outside `components/shared/`.
    - _Requirements: 14.9, 14.10_
  - [x] 26.5 Checkpoint - Run typecheck, tests, and `next build`
    - Ensure `tsc --noEmit`, `vitest run`, and `next build` pass, ask the user if questions arise.
  - [x] 26.6 Prototype fidelity pass and removal of magic numbers
    - Restyle the shell, header, columns, cards, side panel, and card modal to match `design/kanban-prototype.html` (frosted surfaces, accent bars, card layout, four-row board header, avatar stack); add `BaseAvatar` and `BaseChip` to `components/shared/`; move every size, layer, duration, and opacity into named tokens.
    - Add a static test that rejects `z-`, `duration-`, `opacity-`, `ring-`, `outline-`, and `border-` utilities with numeric suffixes and colour opacity modifiers.
    - _Requirements: 14.9, 14.13_
  - [x] 26.7 Look refresh to the product owner's reference
    - Retheme `styles/tokens.css` (white surfaces, navy brand, pastel tags, `--tone-*` hues); rebuild the sidebar as an icon rail plus boards panel; flatten the columns; restyle `CardTile`, `BoardHeader`, `BaseChip`, and `BaseBadge`; remove `BackgroundScene` and the `--glass-*`, glow, and column blur tokens.
    - Keep the static styling test green (no hex, no arbitrary values, no magic numbers).
    - _Requirements: 14.9, 14.13_

- [x] 27. Trello-style board and card modal (Decision I)
  - [x] 27.1 Install the new dependencies, set the font, and add the tokens
    - Install `@fontsource-variable/inter`, `@radix-ui/react-popover`, and `react-day-picker`; import the Inter font once in `app/layout.tsx` and put it first in `--font-stack`.
    - Add the tokens the new layout needs (modal margin, popover widths, calendar cell size, tooltip offset) and expose them in `globals.css`; keep the static styling test green.
    - _Requirements: 14.9, 14.17_
  - [x] 27.2 Add `BasePopover`, `BaseCalendar`, and the `BaseModal` footer slot
    - Add `components/ui/{popover,calendar}.tsx` and the thin wrappers `BasePopover` and `BaseCalendar`; give `BaseModal` a `footer` prop (bordered bar under a scrolling body) and a `full` size that fills the viewport minus a margin; use the footer in `NewBoardModal` (Cancel, Create).
    - Add shared-component tests (popover opens and closes with Escape; the footer renders its buttons).
    - _Requirements: 14.10, 4.35_
  - [x] 27.3 Rebuild the Sidebar and add the Home page
    - Remove the logo tile; make Home the first entry and the post-sign-in destination; add `hooks/useSidebarState.ts` and the collapse toggle (expanded with labels, collapsed with tooltips, kept in `localStorage`); show the lock or open lock on each board row with an accessible label; wrap long names with a title tooltip.
    - Replace the `/boards` redirect with a page that lists every visible board.
    - _Requirements: 3.20, 3.21, 3.22, 14.7, 14.16_
  - [x] 27.4 Rework the main panel and the card face
    - Lock the shell to the viewport; fixed `BoardHeader` with the visibility icon and a wrapping title; columns scroll sideways, each column scrolls inside itself, "Add a card" pinned at the column bottom; slimmer `CardTile` (label chips, a badge row, assignee avatar).
    - _Requirements: 3.20, 3.21, 14.18_
  - [x] 27.5 Keep HTML5 drag-and-drop in the scrolling columns
    - A pointer-event rewrite (`lib/drag.ts`, `hooks/useCardDrag.ts`) was built and then reverted at the product owner's request; `Board` and `CardTile` use the HTML5 API (draggable cards, `dragover` and `drop` on each column body, placeholder, FLIP, one `onMove` call on drop). `lib/ordering.ts` is unchanged.
    - _Requirements: 5.2, 5.13_
  - [x] 27.6 Add the date rules and `DateRangePicker`
    - Add `lib/dates.ts` (`normalizeRange`, `isRangeValid`) and `components/card/DateRangePicker.tsx`: one range calendar, optional Start date and End date fields with checkboxes, the range highlighted as a block, days before the start disabled while picking the end, an inline error for a typed invalid pair.
    - _Requirements: 4.31, 4.32_
  - [x]* 27.6.1 Write property tests for the date rules
    - Property: for any sequence of picks, `normalizeRange` returns a pair where the end is empty or not before the start; a start moved past the end clears the end; equal dates are valid.
    - _Requirements: 4.32_
  - [x] 27.7 Add `MemberPicker`
    - A popover with a search box (case-insensitive over name and login identifier), the board's members with avatars, single choice, and Remove; hidden for a Member.
    - Test search filtering, choosing, and removing by role and name.
    - _Requirements: 4.33_
  - [x] 27.8 Rebuild `CardModal`
    - Large modal; left pane: three cards, Details (title, `CardChips`, description with an Edit toggle), Attachments, and Subtasks; right pane: one card with the composer, the thread, and the Activity list below; a footer with Delete (second click confirms), Archive, Close, Save changes (disabled while the dates are invalid).
    - Delete the column select and `moveTo` from the modal.
    - `CardChips`: category pill, Priority flag chip, date-range chip with a red Overdue state, assignee avatar with an add button, each in a `BasePopover` that edits the draft.
    - _Requirements: 4.20, 4.21, 4.30, 4.31, 4.32, 4.33, 4.34, 4.35_
  - [x] 27.9 Checkpoint - Run typecheck, tests, and `next build`
    - Ensure `tsc --noEmit`, `vitest run`, and `next build` pass, then check the board, the modal, the dates popover, and the member popover in a browser at 1563px and 390px; ask the user if questions arise.

- [x] 28. Owner feedback on the Trello-style UI (Decision I)
  - [x] 28.1 Return author and actor names from the API
    - `activity_repository.serialize_many` and `comments_repository.author_names` load `User.full_name` in one query each, whatever the row count; add `actor_name` to `ActivitySchema` and every activity response, and `author_name` to `ReplySchema` and every comment response (list, create, reply, priority); no new relationship on a model.
    - Add a test that a manager who is not a board member shows by name (`test_comment_and_activity_names`), and update `backend/API.md` and `backend/openapi.json`.
    - _Requirements: 7.21, 8.8_
  - [x] 28.2 Frontend: names, brand, radii, and the logo toggle
    - Read `actor_name` and `author_name` before the member map; rename the app to RevoTask (Sidebar, page titles, sign-in layout); make the logo mark the Sidebar toggle (name beside it when expanded, tooltip when collapsed); set the radius tokens to 4 (small), 6 (medium and card), and 8 (large) pixels and flatten the column and card rounding.
    - _Requirements: 7.21, 8.8, 14.16, 14.19_
  - [x] 28.3 Frontend: modal scrolling, attachments, and subtasks
    - Add `lg:grid-rows-1` so each pane scrolls; split the Attachments and Subtasks cards; show the Attachments card in two columns with a Link or File selector; add a test for the selector and for the two cards.
    - _Requirements: 4.36, 4.37, 4.38_
  - [ ] 28.4 Checkpoint - Run backend and frontend tests and `next build`
    - Ensure `pytest`, `tsc --noEmit`, `vitest run`, and `next build` pass, then check the modal scroll, the logo toggle, drag-and-drop, and the names in a browser; ask the user if questions arise.

- [ ] 29. Modal balance, activity clarity, and board card sizes (Decision I)
  - [x] 29.1 Record names and changes in the Activity_Log metadata
    - In `cards/service.py` and `comments/service.py` pass the extra `metadata` keys of Req 8.9 to `activity.add`: `card_title` on every card event, `changes` (`{field: {from, to}}`) on `card.updated`, `from_column_name` and `to_column_name` on `card.moved`, `assignee_name` on `card.assigned`, subtask `title`, and attachment `name`.
    - Add tests that each action writes its keys (move, update with a priority and a date change, assign, subtask add, attachment add); update `backend/API.md` and regenerate `backend/openapi.json`.
    - _Requirements: 8.9_
  - [x] 29.2 Add the control, type, and spacing scale
    - Add the tokens of the design bullet "Control and type scale" and expose them in `globals.css`; apply `min-h-control` to `Input`, `NativeSelect`, `Button` default, `BaseChip`, and `CardChips`; set the card modal spacing; keep the static styling test green.
    - _Requirements: 14.20, 4.40_
  - [x] 29.3 Rework the card modal header, footer, attachments, and cards
    - Header "card title | board name" that follows the draft title, column badge beside it; footer Archive, Delete, Save changes (right-aligned, no Close); Attachments as bordered tiles with type icons and a small remove icon; Activity in its own card under Comments.
    - Update the modal tests (header text follows the title field, no Close button in the footer, an Activity region, attachment icons).
    - _Requirements: 4.20, 4.35, 4.36, 4.39_
  - [x] 29.4 Rewrite the activity wording
    - `describeActivity` returns parts; `ActivityList` and the side panel render the actor, action, object, and from-to with badges; generic fallback for old rows. Unit tests for move, change, assign, subtask, attachment, and a legacy row.
    - _Requirements: 8.10_
  - [x] 29.5 Fix the tooltip and size the board cards
    - Tooltip on hover and keyboard focus only; fluid column width; card padding and text tokens; two-line description; wide-screen step.
    - _Requirements: 14.21, 14.22_
  - [ ] 29.6 Checkpoint - Run backend and frontend tests and `next build`
    - Ensure `pytest`, `tsc --noEmit`, `vitest run`, and `next build` pass, then check the modal, the activity log, the tooltip, and the board cards in a browser; ask the user if questions arise.

- [ ] 30. Visual system, searchable selects, and paging (Decisions I and J)
  - [x] 30.1 Backend: paging and member candidates
    - `limit` and `before` on `GET /api/notifications`, `GET /api/boards/{id}/activity`, and `GET /api/cards/{id}/activity` (default 20, cap 100, 400 for a bad `limit` or a `before` outside the feed); `GET /api/boards/{id}/candidates?search=` (owner, Manager, Admin; at most 20 non-members; `id` and `full_name` only).
    - Tests for page sizes, the cursor, the last page, the 400 cases, the candidates filter, and the 403/401 cases; update `backend/API.md` (replace "There is no pagination") and regenerate `backend/openapi.json`.
    - _Requirements: 3.25, 8.11, 9.11, 13.19_
  - [x] 30.2 Shared components and tokens
    - Add `@radix-ui/react-tooltip` and `cmdk`; add `components/ui/{tooltip,command}.tsx`, `BaseTooltip`, `BaseCombobox`, and `BaseConfirm`; add the type and spacing tokens of the design section "Round 4"; tests for the combobox (search shown from six options, keyboard choice) and the confirmation popover.
    - _Requirements: 14.10, 14.20, 14.23, 14.24, 14.25_
  - [x] 30.3 Sidebar hierarchy and the Team members section
    - One `NavItem` for every entry; the type hierarchy; remove the Members nav entry; Team members add button with `MemberSearch` (popover, modal below 960px) and a remove button with confirmation; tooltips through `BaseTooltip`.
    - _Requirements: 3.24, 14.26_
  - [x] 30.4 Board header and board cards
    - One-row header without Add Member and the settings gear; search modal below 960px; bordered filter chips; avatar tooltip on the board Card.
    - _Requirements: 3.23, 6.13, 14.24_
  - [x] 30.5 Card modal
    - Attribute rows with icons and comboboxes; header with the title and close icon only; staged attachment additions and removals applied on Save with uploads at that moment and a "Discard changes?" prompt; confirmation popovers for Subtask, Attachment, and Card deletes; equal tile and button heights; button roles.
    - Update the modal tests (attribute rows, staged removal not sent before Save, discard prompt, confirmation before delete).
    - _Requirements: 4.21, 4.35, 4.41, 4.42, 4.43, 4.44, 4.45, 14.25_
  - [x] 30.6 Comment thread layout
    - Avatar, name and time, text, small text actions; replies indented with a vertical line; no box per comment.
    - _Requirements: 7.22_
  - [x] 30.7 Load more for the Inbox and the activity lists
    - First page sized to the visible area; Load more with `before`; hide on the last page; tests with a mocked API.
    - _Requirements: 8.12, 9.12_
  - [x] 30.8 Categories screen
    - `app/(app)/boards/[id]/categories/page.tsx` with `CategoriesScreen` (add, rename, recolor, delete) for Supervisor, Manager, Admin, scoped to the current board, using the round 4 components.
    - _Requirements: 6.11_
  - [ ] 30.9 Checkpoint - Run backend and frontend tests and `next build`
    - Ensure `pytest`, `tsc --noEmit`, `vitest run`, and `next build` pass, then check the sidebar, header, modal, comments, selects, and Load more in a browser at desktop and phone width; ask the user if questions arise.

- [ ] 31. Header, Home, and badges (Decision I)
  - [x] 31.1 Backend: board counts and description
    - `Board.description` (nullable `Text`, max 500 through the schemas) with an Alembic migration; accept it on `POST /boards` and `PATCH /boards/{id}`; return it on every board response.
    - `GET /boards` adds `card_count`, `done_count`, `overdue_count`, `member_count` with aggregate queries (one per count kind, independent of the number of boards).
    - Tests: counts with soft-deleted, archived, Done, and overdue cards; the description round trip and the 400 for 501 characters; the constant query count for the board list. Update `backend/API.md` and regenerate `backend/openapi.json`.
    - _Requirements: 3.26, 3.27_
  - [x] 31.2 Two-row board header
    - Row 1 title and lock, bell and user; row 2 bordered progress, `ChipStrip` with arrow buttons shown only on overflow, and search (modal below 960px).
    - Tests: the arrows appear only when the strip overflows (mock the sizes) and scroll it.
    - _Requirements: 3.23_
  - [x] 31.3 Card modal fixes and badges
    - Title as text with Edit; date rows on one grid; `FileDropZone` (drag and click) staging the file; close icon inside the header row; `BaseBadge` `outline` shape for Priority with a flag; lowercase Category names everywhere.
    - Tests: title Edit toggle; a dropped file is staged and not sent before Save; the two badge types render with different shapes.
    - _Requirements: 4.46, 4.47, 4.48, 4.49, 4.50, 6.14_
  - [x] 31.4 Home page tiles and the analytics strip
    - `BoardTile` (plain bordered tile, no cover band) with description, progress, counts, and avatars; the optional Description field in `NewBoardModal`; the analytics strip for Supervisor (owned boards) and Manager, absent for Member and Admin.
    - Tests: tile content from a board with counts; the strip renders for a Manager and not for an Admin or a Member.
    - _Requirements: 3.28, 3.29, 10.8_
  - [ ] 31.5 Checkpoint - Run backend and frontend tests and `next build`
    - Ensure `pytest`, `tsc --noEmit`, `vitest run`, and `next build` pass, run the migration on the dev database, then check the header, Home, and the card modal in a browser at desktop and phone width; ask the user if questions arise.

- [ ] 32. Auth end-to-end tests: sign-in and sign-out (V9)
  - [ ] 32.1 Set up Playwright for the deployed URL
    - Add `@playwright/test` as a dev dependency (skip if task 20.1 already did), `frontend/playwright.config.ts` (`testDir: "tests/e2e"`, `baseURL` from `E2E_BASE_URL`, no `webServer`), and a `test:e2e` script.
    - Add `E2E_BASE_URL=`, `E2E_USER_IDENTIFIER=`, and `E2E_USER_PASSWORD=` to `frontend/.env.example`; confirm no real `.env` is tracked.
    - _Requirements: 15.10, 15.11, 15.13_
  - [ ] 32.2 Write the Auth_Page_Object and the environment helper (V9 form; V10 revises it in 33.22)
    - `frontend/tests/e2e/auth/pages/AuthPage.ts` (locators and actions; `signOut()` opens the drawer below 960 pixels) and `frontend/tests/e2e/auth/env.ts` (throws an error naming the missing variable).
    - _Requirements: 15.10, 15.11, 15.12, 15.15_
  - [ ] 32.3 Write `signin.spec.ts` (V9 form; V10 revises it in 33.23)
    - One test per ID: SI-01 to SI-05 (happy) and SI-06 to SI-10 (negative), titles starting with the ID; the 256-character identifier and the password-hygiene checks included.
    - _Requirements: 1.19, 1.20, 1.21, 1.22, 1.23, 1.24, 1.25, 1.26, 1.27, 1.28, 1.37, 15.14_
  - [ ] 32.4 Write `signout.spec.ts` (V9 form; V10 revises it in 33.24)
    - One test per ID: SO-01, SO-02, SO-04 (happy), SO-06, SO-07, SO-08 (negative, with `page.route`), and SO-03, SO-05 as `test.fixme` until Open Question 5 is decided.
    - _Requirements: 1.29, 1.30, 1.31, 1.32, 1.33, 1.34, 1.35, 1.36, 1.37, 1.38, 15.14_
  - [ ]* 32.5 Write static checks for the suite
    - A CI step that fails when `waitForTimeout` appears under `frontend/tests/e2e/`, when a credential-like literal appears in `tests/e2e/auth/`, or when a criterion ID in Req 1.19 to 1.36 has no test title (extends 20.2).
    - _Requirements: 1.37, 15.3, 15.11, 15.14_
  - [ ] 32.6 Checkpoint - Run the suite against the deployed URL
    - Run `npm run test:e2e` with the three variables set; confirm all non-fixme tests pass and report the two `fixme` tests.
- [ ] 33. Share links, username and email, header menu, rate limiting, route guard (Decisions K to P, V10)
  - [x] 33.1 Update the models and write the V10 migration
    - Models: `User` gets `username` (String(30), lower-case) and `email` (String(255), lower-case, NOT NULL) and loses `login_identifier`; `Board` gets nullable `share_token` (String(64)); new `RateLimitAttempt` (`scope` in `login_pair`, `login_ip`, `availability`, with no `register` value; `key_hash`; `created_at`; index `(scope, key_hash, created_at)`). The avatar column change is part 4 of the same revision, written in 33.28.
    - One Alembic revision `b7d2e4f6a801` in parts (round 3, Decision V): a local-development reset, not a data-preserving migration. It aborts unless `APP_ENV` is `development` or `testing`, deletes the rows of `users` and of every table that references it, adds `username` and `email` as NOT NULL with the unique lower-case indexes, adds `boards.share_token` plus a partial unique index and `rate_limit_attempts`, drops `login_identifier` and its index. No backfill, no `derive_username`, no printout. `downgrade()` as in the design. After it, re-run `flask seed-users` or `flask seed-data` (33.41).
    - Run it only on the local development database; no dump or copy is needed because the data is disposable.
    - _Requirements: 1.43, 1.63, 18.1, 20.9, 20.12_
  - [ ]* 33.2 Write the migration and constraint tests
    - **Property 45: Migration reset**
    - Generated user and referencing rows; assert `upgrade` with `APP_ENV` `development` or `testing` leaves every listed table empty and the new schema in place, aborts for any other `APP_ENV` and leaves the data untouched, and that `downgrade` restores a `login_identifier` column; integration tests for the two functional unique indexes (case-insensitive, NOT NULL) and the unique `share_token`.
    - **Validates: Requirements 1.43, 1.63, 15.18**
  - [x] 33.3 Implement the identity changes in the auth and users blueprints
    - `common/validation.py`: `normalize_username`, `normalize_email`, `is_email_shape`, `classify_identifier`, `USERNAME_RE`.
    - `auth`: register with `username` and `email` (field-level 400, 409 with `details` per field, `IntegrityError` mapped to the same 409), login with `identifier` (classification, one generic 401, dummy hash for unknown users), `GET /auth/availability`, the `{ id, full_name, username, email, avatar_url }` user shape; `users` create and edit accept the two fields (Email required, never null); `GET /boards/{id}/candidates` matches `full_name`, `username` prefix, `email` exact (the response carries `email` from round 2, built in 33.35); update `app/seed.py`.
    - Update the existing backend tests that used `login_identifier`.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.44, 1.45, 1.46, 1.47, 1.48, 1.49, 1.54, 3.25_
    - The 2-character candidate search minimum is built in 33.44; the seed in 33.41.
  - [ ]* 33.4 Write the identity property tests
    - **Property 1: Registration and login round trip** (revised), **Property 2: Registration validation and unique username and email** (revised), **Property 42: Login identifier classification**, **Property 43: Username and Email normalisation and uniqueness**
    - **Validates: Requirements 1.1 to 1.5, 1.43 to 1.49**
  - [x] 33.5 Implement the Rate_Limiter and wire it into login and availability (not register, Decision Q)
    - `common/rate_limiter.py` (pure `blocked_until`, store with advisory lock and separate-commit failure record, `check_login`, `record_login_failure`, `reset_pair`, `hit` for availability only), `RateLimited` (429, `RATE_LIMITED`, `details.retry_after`), `Retry-After` header in `EnvelopeApi`, CORS `expose_headers`, `ProxyFix` from `TRUSTED_PROXY_COUNT`, the five settings in config (`RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_LOGIN_PAIR_MAX`, `RATE_LIMIT_LOGIN_IP_MAX`, `RATE_LIMIT_AVAILABILITY_MAX`, `TRUSTED_PROXY_COUNT`; no `RATE_LIMIT_REGISTER_MAX`), `create_app(config_overrides)`, and `backend/.env.example` placeholders. `auth_service.register` makes no limiter call (Req 20.18).
    - Routes pass `client_ip` to the service; services stay free of Flask imports.
    - _Requirements: 20.1 to 20.14, 20.17, 13.3, 13.11_
  - [x]* 33.6 Write the Rate_Limiter tests
    - **Property 44: Rate limit window** (fake clock, small thresholds through `create_app`, PostgreSQL, two app instances on one table); example tests for the 429 body and header, a blocked correct password, success reset, independent pairs, and that register is never answered with 429 (Req 20.18).
    - **Validates: Requirements 20.1 to 20.14, 15.16**
  - [x] 33.7 Implement the profile endpoints
    - `GET /auth/me`, `PATCH /auth/me` (`full_name` only, `unknown=RAISE`, so `avatar_url` and `email` return 400; round 3 withdrew the Email save and its 409), `POST /auth/change-password` (400 `details.current_password`), one Activity_Log row per success with no secret in `metadata`.
    - _Requirements: 19.8 to 19.16_
  - [ ]* 33.8 Write the profile property test
    - **Property 46: Profile update rules**
    - **Validates: Requirements 19.9 to 19.16**
  - [x] 33.9 Remove Guest access to Boards
    - `can_access(None, board)` returns false; `GET /boards` without a Token returns 401; remove the Guest branches in board, card, column, category, comment, activity, search, and attachment services and serializers (a Guest gets 401 everywhere outside `/api/shared`; the comment endpoints return 401 instead of 403 on a public Board); update `list_visible`.
    - Update the existing tests that expected Guest access (tasks 4, 5, 7, 8, 9, 12, 14.1 fixtures).
    - _Requirements: 7.16, 8.5, 11.4, 11.5, 11.7, 11.12, 11.13, 12.6, 12.7, 13.10, 14.3_
  - [x] 33.10 Implement the share endpoints
    - `board_service.get_share`, `enable_share`, `regenerate_share`, `disable_share`; routes `GET`, `POST`, `POST .../regenerate`, `DELETE` under `/boards/{id}/share`; owner, Manager, Admin only; one activity row per change, no token in `metadata`.
    - _Requirements: 18.1 to 18.8_
  - [x] 33.11 Implement the `shared` blueprint and token-scoped file URLs
    - `blueprints/shared/` with `routes.py`, `service.py`, `repository.py`, `schema.py` (board, cards, categories, card detail, attachment URL; GET only; shared schemas without comments, activity, owner, members, token; `has_board_access` from an optional Bearer; `Cache-Control: private, no-store`); extend `common/signing.py` with the `scope` and `st` parameter and the file route check against the Board's current token.
    - _Requirements: 18.9 to 18.19, 12.6, 6.6, 4.26_
  - [x]* 33.12 Write the share and guest tests
    - **Property 40: Share_Token lifecycle**, **Property 41: Shared routes stay inside the token's board**, **Property 28: Guest responses never include comments or activity** (revised), **Property 34: Board list visibility** (revised), **Property 4** and **Property 5** (revised); a static test that `/api/shared` has no non-GET route and no comment or activity route.
    - **Validates: Requirements 18.1 to 18.17, 7.16, 8.5, 11.4 to 11.7, 11.13, 15.17**
  - [x] 33.13 Update the generated OpenAPI document and `backend/API.md`
    - Document the new and changed endpoints, the 429 response, the `identifier` field, and the user shape; run `flask export-openapi`; keep the "every route is documented" test (Property 37) green.
    - _Requirements: 17.1, 17.2, 17.3_
  - [x] 33.14 Update the Frontend API client and helpers
    - `lib/api.ts`: `ApiError.retryAfter`, no redirect on a 401 from `POST /auth/login`, `api.auth` (`login` with `identifier`, `register`, `availability`, `me`, `updateMe`, `changePassword`, `logout` that always clears the cookie and navigates), `api.shared`; `lib/validation.ts` (`classifyIdentifier`, `isUsername`, `isEmail`); `hooks/useCountdown.ts`; update the `User` type.
    - _Requirements: 1.50, 1.51, 19.4, 20.15_
  - [x]* 33.15 Write the helper tests
    - fast-check parity of `classifyIdentifier` with the Backend cases (Property 42); `useCountdown` ticks to zero with fake timers.
    - **Validates: Requirements 1.51, 20.15**
  - [x] 33.16 Rebuild the login and register forms
    - Login: one "Username or email" field, email-or-username validation by `@`, Generic_Login_Error, countdown and disabled submit on 429. Register: full name, Username, Email, password; availability on blur (silent when blocked); field errors from `error.details`; no 429 handling for register (Decision Q), and a 429 on the availability check silently stops the on-blur checks.
    - _Requirements: 1.50, 1.51, 20.15, 20.16, 1.9, 1.10_
  - [x] 33.17 Build `BaseMenu`, the App_Header, and the User_Menu
    - Add `@radix-ui/react-dropdown-menu`, `components/ui/dropdown-menu.tsx`, and `components/shared/BaseMenu.tsx`; `AppHeader` and `UserMenu` in `(app)/layout.tsx`; move the Board header's first row into the App_Header slot; remove the profile entry and Log out item from the Sidebar; keep the Inbox bell and the Sidebar toggle.
    - _Requirements: 19.1 to 19.7, 14.10, 3.23_
  - [x] 33.18 Build the Profile_Page (the Email_Prompt is withdrawn in round 3)
    - `(app)/profile/page.tsx` with the full name field, the avatar section (`AvatarUploader`, built in 33.31), the read-only fields, and the change-password form; no `EmailPrompt` (withdrawn in round 3, Decision V: no account has a null Email).
    - _Requirements: 19.8 to 19.17_
  - [x] 33.19 Add the route guard
    - `frontend/proxy.ts` with the matcher for `/boards`, `/profile`, `/admin`; leave `/login`, `/register`, `/shared` open; a unit test per path. Round 2 extends this file in 33.33 (unusable cookie, cookie removal, `x-return-path`).
    - _Requirements: 14.27_
  - [x] 33.20 Build the Share button and the Shared_View
    - `ShareButton` popover (enable, link and Copy, Regenerate and Disable behind `BaseConfirm`); `app/shared/[token]/page.tsx` with `SharedBoard` and `SharedCardModal` (read-only, banner, Sign in link, invalid-link page); redirect when `has_board_access`; `no-referrer` and `noindex` headers in `next.config.ts`; remove any Guest-facing board browsing from `/boards`.
    - _Requirements: 18.19 to 18.23, 3.23_
  - [ ]* 33.21 Write the component tests
    - The V10 component tests listed in the design's Frontend tests section.
    - **Validates: Requirements 14.27, 18.21, 18.22, 19.2, 19.5, 19.13**
  - [ ] 33.22 Update the Auth_Page_Object and the environment helper for V10
    - New locators (`Username or email`, `User menu`, Profile and Log out menu items, Sidebar), `openUserMenu()`, `signOut()` through the menu with no drawer step, `waitTimeText`; `env.ts` unchanged apart from comments.
    - _Requirements: 15.10, 15.11, 15.12, 15.15_
  - [ ] 33.23 Update `signin.spec.ts` for V10
    - Signed-in indicator is the User_Menu_Trigger; SI-07 uses a Throwaway_Identifier; SI-08, SI-09 assert no request is sent; add SI-11 (rate limit, up to 10 attempts, Throwaway_Identifier, never the Test_Account) and SI-12 (email shape).
    - _Requirements: 1.19 to 1.28, 1.39, 1.40, 1.37, 15.14, 15.19_
  - [ ] 33.24 Update `signout.spec.ts` for V10
    - Sign-out through the menu; SO-03 and SO-05 become real tests (no `test.fixme`); SO-04 ends on `/login`; add SO-09 (menu order) and SO-10 (no Sidebar Log out or Profile).
    - _Requirements: 1.29 to 1.36, 1.41, 1.42, 1.37, 1.38, 15.14_
  - [ ]* 33.25 Update the static checks for the suite
    - The CI step covers IDs in criteria 19 to 36, 39 to 42, 55, and 56, no `waitForTimeout`, no credential-like literal, and no `test.fixme` left in `tests/e2e/auth/`.
    - _Requirements: 1.37, 15.3, 15.11, 15.14_
  - [x] 33.26 Sync steering and guidelines to V10
    - Updated in this revision: `product.md`, `data-model.md`, `api-conventions.md`, `backend.md`, `frontend.md`, `structure.md`, `tech.md`, and `guidelines/` where they contradicted V10 (see CHANGELOG V10, "Steering and guidelines").
    - _Requirements: 14.10, 13.3, 11.4_
  - [ ] 33.27 Checkpoint - Run backend and frontend tests, the build, and the suite
    - Ensure `pytest`, `tsc --noEmit`, `vitest run`, and `next build` pass, run the reset migration on the local development database, run `npm run test:e2e` against the deployed URL with the three variables set (the suite then has no SO-11 and SO-12 yet; they arrive in 33.38 and run in 33.48, the final checkpoint, round 3 ordering fix), and check the risk recorded for SI-11: set `RATE_LIMIT_LOGIN_IP_MAX` above 20 on the test environment or run the suite once per window. Ask the user if questions arise.
- [x] 33.28 Extract the file store, add `detect_image_type`, and write migration part 4 (avatar) (Decision R)
  - `common/file_store.py` (`FileStore(upload_dir)`: `save`, `delete`, `path`, bare-name check) extracted from the inline code in `cards/service.py` (write, `os.remove`, file route path); attachments call it with `subdir=""`, behaviour unchanged. `common/images.py` with `MAX_AVATAR_BYTES` and `detect_image_type`. `common/signing.py` takes `scope` and a route name (shared with 33.11) so the avatar scope reuses the one signing and verification code. `User.avatar_path` (String(64), nullable) replaces `avatar_url`; part 4 of revision `b7d2e4f6a801` adds `avatar_path` and drops `avatar_url` (round 3: no values are printed or preserved, there is no data; `downgrade()` re-adds `avatar_url` empty). Create `UPLOAD_DIR/avatars/` on first write.
  - Accepted risks to record in the PR (Decision W): Werkzeug buffers the multipart body (cap the body at the reverse proxy, about 3 MB); the file keeps EXIF data and no image library re-encodes it. Both are accepted for V10.
  - _Requirements: 19.21, 19.24, 13.14, 1.6_
- [x] 33.29 Implement the avatar endpoints (Decision R)
  - `user_service.set_avatar`, `clear_avatar`, `open_avatar` in `blueprints/users/` (round 3, Decision U); routes `POST` and `DELETE /users/me/avatar` and `GET /users/{user_id}/avatar/file` (the two mutating routes for any signed-in user, the file route signature-only); nothing at `/auth/me/avatar`; `user_repository.get_for_update`; write-commit-delete order with cleanup on failure; `UserSchema.avatar_url` as a signed-URL method that is null without a file; one `user.profile_updated` row with `{ "fields": ["avatar"] }`; remove `avatar_url` from the `PATCH /auth/me` and admin `POST|PATCH /users` schemas (400); response headers `nosniff`, `inline`, `Cache-Control: private, max-age=300`; update the OpenAPI document and `backend/API.md`.
  - _Requirements: 19.18, 19.19, 19.20, 19.21, 19.22, 19.23, 19.24, 19.25, 19.26, 19.27, 19.32, 19.33, 13.10, 17.11_
- [x]* 33.30 Write the avatar tests
  - **Property 47: Avatar image type and size**
  - API tests of Req 15.20 against `/api/users/me/avatar` (happy: PNG, JPEG, WebP, renamed extension, replace, delete, idempotent delete; negative: no Token, text renamed `.png`, SVG, GIF, empty, 2,097,153 bytes, missing part, traversal name, bad or expired or cross-user signature, no avatar 404, `avatar_url` in PATCH, no `avatar_url` in shared payloads); a test that two parallel uploads leave one file.
  - **Validates: Requirements 19.19, 19.20, 19.21, 19.22, 19.25, 19.26, 19.27, 19.33, 15.20**
- [x] 33.31 Build the avatar section of the Profile_Page
  - `AvatarUploader` (choose, preview with a revoked object URL, Upload, Cancel, Remove behind `BaseConfirm`, client-side type and size messages, `details.file` and network messages), `api.auth.uploadAvatar` (existing `form` option) and `removeAvatar`, `BaseAvatar` initials fallback with one refresh through `api.auth.me()`, header and stored-user update without reload.
  - _Requirements: 19.28, 19.29, 19.30, 19.31_
- [ ]* 33.32 Write the avatar component tests
  - The tests of Req 15.21 (preview, Upload, Remove with confirmation, wrong type, too large, server `details.file`, initials fallback after one refresh). Add the manual smoke check (upload, preview, replace, remove) to the release checklist; the auth e2e suite has no avatar test (Req 15.22).
  - **Validates: Requirements 15.21, 15.22, 19.28, 19.29, 19.30**
- [x] 33.33 Implement the invalid-Token redirect (Decision T)
  - `lib/session-token.ts` (`isUsableToken`), `lib/return-path.ts` (`safeReturnPath`), `frontend/proxy.ts` (redirect with `next`, cookie removal, `x-return-path` request header), `serverGet` redirecting to `/session-expired`, `app/session-expired/route.ts` (delete the cookie, redirect only to `/login`), `LoginForm` reading `next`. Backend: the shared routes use optional JWT verification that treats any JWT error as a Guest (never 401).
  - _Requirements: 1.57, 1.58, 1.59, 1.60, 1.61, 14.28, 18.24_
- [x]* 33.34 Write the invalid-Token tests
  - **Property 48: Safe return path and usable Token** (fast-check); vitest for `proxy.ts` (no cookie, malformed, expired, valid, public paths, cookie removed on redirect); pytest that a malformed or expired Bearer Token on each shared route returns the Guest response.
  - **Validates: Requirements 1.57, 1.59, 1.60, 15.23, 18.24**
- [x] 33.35 Return the Email to staff in candidates and in the members list (Decision S)
  - `CandidateSchema` gains `email`; `GET /boards/{id}/members` accepts `include=email` (403 without Board_Staff_Access, 401 without a Token) and the default path never reads `User.email`; confirm no Comment, activity, Notification, shared, or default member schema declares `email`; update the OpenAPI document.
  - _Requirements: 3.25, 3.30, 3.31_
- [x] 33.36 Show the Email in `MemberSearch` and `MemberPicker`
  - `MemberSearch` rows show full name with the Username and Email beneath; `MemberPicker` loads `?include=email`, shows full name and Email, and searches all three fields; the Sidebar member rows and every other component keep showing no Email; the picker stays hidden from a Member.
  - _Requirements: 3.31, 3.32, 4.33_
- [ ]* 33.37 Write the Email exposure tests
  - **Property 49: Email exposure**
  - The tests of Req 15.24, and component tests that `MemberSearch` and `MemberPicker` render the Email and the Sidebar and `CommentThread` render none.
  - **Validates: Requirements 3.25, 3.30, 3.31, 3.32, 15.24**
- [ ] 33.38 Add SO-11 and SO-12 to `signout.spec.ts`
  - `AuthPage.setSessionCookie(value)` and `buildForgedToken()` (header, payload with `exp` one hour ahead, the text `invalid` as signature; no secret); SO-11 uses the value `bogus`; both assert the URL path `/login`, the login form, and no `kanban_token` cookie, and neither touches the Test_Account.
  - _Requirements: 1.55, 1.56, 1.62, 15.14_
- [x] 33.39 Sync steering and guidelines to round 2
  - Updated in this revision: `product.md`, `data-model.md`, `api-conventions.md`, `backend.md`, `frontend.md`, `tech.md`, `guidelines/backend.md`, `guidelines/database.md`, and `guidelines/frontend.md` (see CHANGELOG V10, "Round 2 within V10").
  - _Requirements: 20.18, 19.24, 3.31, 1.57_
- [ ] 33.40 Checkpoint - Run the round 2 checks
  - Ensure `pytest`, `tsc --noEmit`, `vitest run`, and `next build` pass with 33.28 to 33.38 in place; run migration part 4 on the local development database; run the suite against the deployed URL, including SO-11 and SO-12; do the manual avatar smoke check. Ask the user if questions arise.
- [x] 33.41 Seed every user with username, email, and full_name (Decision V)
  - `backend/app/seed.py`: `flask seed-users` (Member, Supervisor, Manager, Admin) and `flask seed-data` (adds `member2`, `supervisor2`) set `username` `<key>`, `email` `<key>@example.com`, and a two-word `full_name` on every user; `member` stays the Test_Account (`E2E_USER_IDENTIFIER=member`); the commands are idempotent. Update `SEED_PASSWORD` use and the README note: after `alembic upgrade head`, re-run the seed.
  - _Requirements: 1.64, 15.27_
- [x] 33.42 Rate limit `POST /auth/change-password` (Decision W)
  - `rate_limiter.check_change_password`, `record_change_password_failure` (own short transaction), `reset_change_password`; scope `change_password` keyed by user id; setting `RATE_LIMIT_CHANGE_PASSWORD_MAX` (default 5) in config and both `.env.example` files; 429 `RATE_LIMITED` with `Retry-After`; the Profile password form shows the countdown through `ApiError.retryAfter` and `useCountdown`, and a 429 does not redirect.
  - _Requirements: 20.10, 20.12, 20.19, 20.20, 20.21, 20.22, 20.23, 19.16_
- [ ]* 33.43 Write the change-password limiter tests
  - Extend **Property 44: Rate limit window** with the `change_password` scope (fake clock, per user, reset on success, a short new password counts nothing); a component test of the countdown on the Profile form.
  - **Validates: Requirements 20.19 to 20.23, 15.16**
- [x] 33.44 Add the candidate search minimum (Decision W)
  - `candidate_service.search`: `can_manage_members` check first (403), then 400 `details.search` under 2 characters after trimming, then the query; `MemberSearch` debounces, shows "Type at least 2 characters.", and sends nothing below that length; no per-user request limit.
  - _Requirements: 3.25, 3.32_
- [x] 33.45 Add avatars and names to Comment, member, candidate, and assignee payloads (Decision U)
  - `common/identities.py` (`Identity`, `avatar_urls`), `user_repository.identities(ids)` selecting `id, full_name, avatar_path` (never `email`); replace `comments_repository.author_names` and the shared assignee lookup; add `author_avatar_url` (Comments, Replies), `avatar_url` (members with and without `include=email`, candidates), `assignee_name` and `assignee_avatar_url` (Card list, Card detail, create, update, move, assign responses); signed only for signed-in requests; shared schemas get `assignee_name` only (no avatar, no Username, no Email); update the OpenAPI document and `backend/API.md`.
  - _Requirements: 19.34, 19.35, 19.36, 19.37, 7.21, 7.22, 3.30, 4.33, 18.11, 18.25, 17.11, 14.12_
- [x]* 33.46 Write the avatar payload tests
  - **Property 50: Avatar exposure and query count**; **Property 49: Email exposure** (revised); pytest of Req 15.25 (fields present or null, no avatar on any shared route, query count constant in the number of distinct authors and assignees).
  - **Validates: Requirements 19.34 to 19.37, 15.25, 15.24**
- [x] 33.47 Show avatars in the Frontend (Decision U)
  - `lib/initials.ts` (`initialsOf`), `BaseAvatar` `{ src, name, size }` with the full name as tooltip and `alt` and initials on null or after one `api.auth.me()` refresh; use it in `CommentThread` (`author_avatar_url`), Sidebar Team members, `MemberSearch`, `MemberPicker`, board Card tile and Card modal assignee chip (`assignee_avatar_url`, then the member map), and Home tiles; `SharedBoard` and `SharedCardModal` show initials and the assignee full name only; no Email in any tooltip or `alt`; update the `User` type (`email: string`) and the types of the new fields.
  - Component tests of Req 15.26 (image when set, initials otherwise, one-word and blank names, no Email in tooltip or `alt`).
  - _Requirements: 19.38, 19.39, 19.40, 18.11, 15.26_
- [ ] 33.48 Sync steering and guidelines to round 3, then final checkpoint
  - Steering and guidelines sync: `product.md`, `data-model.md`, `api-conventions.md`, `backend.md`, `frontend.md`, `guidelines/backend.md`, `guidelines/database.md`, `guidelines/frontend.md` (done in this revision; see CHANGELOG V10, "Round 3 within V10").
  - Checkpoint: ensure `pytest`, `tsc --noEmit`, `vitest run`, and `next build` pass with 33.41 to 33.47 in place; re-run `alembic upgrade head` and the seed on the local database; run the e2e suite including SO-11 and SO-12 against the target URL; do the manual avatar smoke check (upload, comment, member list, assignee). Ask the user if questions arise.
  - _Requirements: 1.63, 1.64, 19.34, 20.19_
- [ ] 34. RevoTask logo and favicon (Decision X, V11)
  - [x] 34.1 Move the Brand_Assets into place
    - Read `frontend/AGENTS.md` and `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md` first.
    - The three files are untracked, so use a plain move, not `git mv`: `mv frontend/images/favicon.ico frontend/app/favicon.ico`; `mkdir -p frontend/public/brand`; `mv frontend/images/logo-revo.svg frontend/images/logo-text-revo.svg frontend/public/brand/`; `rmdir frontend/images`; then `git add` the three new paths. No copy stays behind.
    - Confirm `grep` finds no reference to `frontend/images`. Do not add an `icons` field to `metadata` and no manual `<link>`.
    - _Requirements: 21.1, 21.2, 21.3, 21.14_
  - [x] 34.2 Write `components/shared/BrandLogo.tsx`
    - Variants `mark` (`/brand/logo-revo.svg`, 480 by 480) and `full` (`/brand/logo-text-revo.svg`, 540 by 165); `next/image` with `unoptimized` and `loading="eager"`; alt `RevoTask`, `alt=""` with `decorative`; `size` maps to token height classes; add `--logo-lg` to `styles/tokens.css` and its `@theme` entry if the brand panel needs it; a `max-w` token class keeps the display at or under the `viewBox` width. No `priority`, no hex, no arbitrary value, no `"use client"`.
    - _Requirements: 21.3, 21.4, 21.5, 21.6, 21.7, 21.12, 21.15_
  - [x] 34.3 Use `BrandLogo` in the Sidebar, the sign-in pages, and the App_Header
    - First open both SVG files in the browser at the planned sizes and note the background colour of each raster; pick the tile token for the brand panel (Open Question 21). Check that `full` at 40 px high fits the expanded Sidebar button.
    - `Sidebar.tsx`: expanded toggle shows `full` (decorative, inside the labelled button, the text span removed); collapsed shows `mark` with the tooltip `RevoTask`; the drawer top below 960px shows `full` with alt `RevoTask`; remove the `LayoutGrid` tile.
    - `AuthSplitLayout.tsx`: brand panel `full` on a `bg-surface-raised` tile; form card header below 960px `full`; remove both "R" tiles and the text.
    - `AppHeader.tsx`: below 960px on non-board pages the `/boards` link holds `mark` (decorative) and the text RevoTask. Root and page titles stay "RevoTask" and "... · RevoTask".
    - _Requirements: 21.8, 21.9, 21.10, 21.11, 21.12, 14.16, 14.19_
  - [x]* 34.4 Write the branding component tests
    - `frontend/tests/branding.test.tsx` as in the design "Testing strategy": variants, alt text and `decorative`, Sidebar expanded and collapsed, the source scan (`/brand/` and `<img` only in `BrandLogo.tsx`, no hex), the file checks (`frontend/images/` absent or empty, `public/brand/` with both files, `app/favicon.ico` with the ICO header). Update any existing test that looks for the Sidebar text "RevoTask".
    - _Requirements: 21.4, 21.12, 21.14, 21.17_
  - [ ]* 34.5 Write the Playwright branding spec
    - `frontend/tests/e2e/branding.spec.ts`: favicon request 200 with an icon content type and one `link[rel="icon"]`; logo alt text and `naturalWidth` above 0 on `/login` at 1280 and 360 pixels; no request to a third-party host on `/login` and on `/boards`; web-first assertions and `expect.poll`, no `waitForTimeout`.
    - _Requirements: 21.1, 21.2, 21.7, 21.13, 21.17, 15.28_
  - [x] 34.6 Sync steering and guidelines to V11
    - Done in this revision: `.kiro/steering/frontend.md`, `structure.md`, `tech.md`, and `guidelines/frontend.md`.
    - _Requirements: 21.4, 21.5_
  - [ ] 34.7 Checkpoint - Run the V11 checks
    - Ensure `tsc --noEmit`, `vitest run`, and `next build` pass; start the app and check `/favicon.ico`, `/brand/logo-revo.svg`, `/brand/logo-text-revo.svg`, `/login` at 360 and 1280 pixels, and the Sidebar in both states; confirm `ls frontend/images` fails. Ask the owner for true vector SVGs and other icon sizes (Open Questions 19 and 20).
    - _Requirements: 21.17_
- [ ] 35. Private Boards, Public_Link, invites, auto-save, deletes, derived progress, Inbox links, Profile layout (Decisions Y to AF, V12)
  - [x] 35.1 Write the V12 migration and update the models
    - Rework of ticked 2.1 to 2.3 (models), 4.x (Board and BoardMember) and 33.1 (V10 migration): the ticked work stays ticked; this task changes what it built.
    - One new Alembic revision after `b7d2e4f6a801`: local-development reset (aborts unless `APP_ENV` is `development` or `testing`), drop `boards.visibility` and its enum, add `boards.invite_token` with the unique index, create `board_join_requests` (enum, partial unique `uq_join_requests_pending`, lookup index), alter `notifications` (nullable `card_id`, `board_id`, `actor_id`, `join_request_id`, type enum extended, old unique constraint dropped, three partial unique indexes, CHECK `notifications_scope`), print the reset line, working `downgrade`.
    - Models: remove `Board.visibility`; add `Board.invite_token`, `BoardJoinRequest`, and the `Notification` columns; no relationship other than the five of Decision F, `lazy="raise"`, no `to_dict`.
    - _Requirements: 22.1, 22.17, 24.1, 24.26, 28.1, 28.2_
  - [ ]* 35.2 Write the migration and constraint tests
    - Assert the abort for any other `APP_ENV`, the empty tables and new schema after `upgrade`, a working `downgrade`, the partial unique index on pending requests, the three notification indexes, and the CHECK.
    - _Requirements: 22.17, 24.11, 28.1, 28.2, 15.29_
  - [x] 35.3 Implement the private-only access model in the Backend
    - Rework of ticked 4.1 to 4.13 and 33.9: `can_access` without a public branch, `require_access`, `board_repository.list_for_user` (owner or member, all for Manager and Admin, constant query count), remove `visibility` from schemas, `PATCH /boards`, the create-board body, serializers, and the activity code; a posted `visibility` is 400.
    - `GET /boards/{id}/members` returns the owner first, once, with `is_owner` (also when the owner is a BoardMember); `DELETE /boards/{id}/members/{owner_id}` returns 404 when the owner is not a BoardMember (round 2 within V12, Open Question 23).
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.13, 22.20, 3.26_
  - [x]* 35.4 Write the access property test
    - **Property 51: Board access and the missing visibility**
    - Generated Boards, users, and relationships; assert `can_access`, the Board list, 401 and 403, and that no payload has `visibility`.
    - **Validates: Requirements 22.1, 22.2, 22.3, 22.4**
  - [x] 35.5 Restrict member add, candidates, and assignment
    - Rework of ticked 4.x (members), 5.x (assign), 13.x (users), 33.35: `POST /boards/{id}/members` and `GET /boards/{id}/candidates` for Manager and Admin only, Member and Supervisor accounts only (400 `details.user_id` otherwise); assignee must be owner or Board_Member (400 `details.assignee_id`); `remove_member` and owner reassignment clear assignments with one `card.unassigned` row each and no Notification; `user_service.change_role` removes memberships and pending requests for a new Manager or Admin; owner reassignment sends `board_added`.
    - _Requirements: 22.5, 22.6, 22.7, 22.8, 22.9, 22.10, 22.11, 22.12_
  - [x]* 35.6 Write the membership property test
    - **Property 52: Manager and Admin are never Board_Members**
    - Random sequences of adds, approvals, role changes, and owner reassignments; assert the invariant and the assignee rule.
    - **Validates: Requirements 22.5, 22.6, 22.10, 22.11, 22.12**
  - [x] 35.7 Move the Public_Link to Manager and Admin
    - Rework of ticked 33.10 and 33.11: re-guard `get_share`, `enable_share`, `regenerate_share`, `disable_share` with `@require_role("manager", "admin")`; the Board_Owner gets 403; shared routes stay `GET` only with 405 for every other method; `has_board_access` uses the new `can_access`.
    - _Requirements: 23.1, 23.2, 23.3, 23.5, 23.6, 23.12_
  - [x]* 35.8 Write the Public_Link tests
    - **Property 54: A Public_Link grants no write**
    - One test per write endpoint (comment, edit field, attachment, Subtask, archive, delete) as a Guest (401) and as a signed-in user without access (403); the 405 route listing; the roles of the link endpoints.
    - **Validates: Requirements 23.5, 23.6, 23.10, 23.11, 23.12**
  - [x] 35.9 Build the `invites` blueprint (Invite_Link and Join_Requests)
    - New folder `app/blueprints/invites/` with `routes.py`, `service.py`, `repository.py`, `schema.py`, registered on the `Api`: the invite management endpoints, `GET /invite/{token}`, `POST /invite/{token}/requests`, `GET /boards/{id}/join-requests` (each `user` carries `email`, read through one join and never copied into the table, round 2 within V12), `PATCH /join-requests/{id}`; `SELECT ... FOR UPDATE` in `decide`; the partial-index `IntegrityError` mapped to 409; Activity_Log rows and Notifications as Requirement 24 states; `Cache-Control: private, no-store`; token never logged or stored in metadata.
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7, 24.8, 24.9, 24.10, 24.11, 24.12, 24.13, 24.14, 24.15, 24.16, 24.17, 24.18, 24.28_
  - [x]* 35.10 Write the invite and join-request tests
    - **Property 55: Join request lifecycle**
    - Include the simultaneous-request case with two threads, reject then request again, approval by Manager and Admin, 403 for the owner, the Manager and Admin 400, and the absence of Email and tokens in the create and decision responses and in Notification bodies; the pending list is the one response that carries an Email (round 2 within V12, Property 49).
    - **Validates: Requirements 24.8, 24.10, 24.11, 24.12, 24.14, 24.15, 24.16, 24.28**
  - [x] 35.11 Rework Notifications: types, deduplication, payload
    - Rework of ticked 10.1 and 10.2 (the deadline job and inbox): `notification_repository.add_board` and the card insert use `ON CONFLICT DO NOTHING` against the partial indexes; the deadline job keeps its V2 behaviour; `GET /notifications` returns the V12 fields with batched name lookups (constant query count) and no Email.
    - _Requirements: 28.1, 28.2, 28.3, 28.4, 9.1, 9.2, 9.3_
  - [x]* 35.12 Write the notification tests
    - **Property 56: Notification deduplication with a null card**
    - Include the constant query count at 5 and 50 rows and the CHECK constraint.
    - **Validates: Requirements 28.1, 28.2, 28.3**
  - [x] 35.13 Implement comment deletion
    - Rework of ticked 8.x: `DELETE /comments/{id}` (author only, 404, 403, 401), reply decrement or reply deletion in one transaction, `comment.deleted` row with no text, `{ deleted: n }`. Decide in this task between deleting replies first and `ON DELETE CASCADE` on `parent_id`, and record it in the migration notes.
    - _Requirements: 26.4, 26.5, 26.6, 26.7, 26.8, 26.9_
  - [x]* 35.14 Write the comment deletion property test
    - **Property 53: Reply count consistency under delete**
    - Random interleavings of create and delete by authors; non-author delete for every role.
    - **Validates: Requirements 26.4, 26.5, 26.6, 26.7, 26.8**
  - [x] 35.15 Subtask matrix and derived progress in the Backend
    - Rework of ticked 5.x (subtasks): confirm `can_edit_card` gives the matrix of Requirement 27 criterion 1 (fix the code if it does not); add `derive_progress`, `progress`, `subtask_done_count`, and `subtask_total_count` to `CardSchema` and `SharedCardSchema` from the loaded Subtasks (no extra query); reject a posted `progress`.
    - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.5, 27.9_
  - [x]* 35.16 Write the Subtask and progress tests
    - **Property 57: Derived progress**
    - One matrix test per role and relationship; the query count of the Card list is unchanged.
    - **Validates: Requirements 27.4, 27.5**
  - [x] 35.17 Make `PATCH /cards` a no-op when nothing changed and log Subtask and Attachment actions
    - Rework of ticked 5.x and 9.x: no `card.updated` row when `changes` is empty; add the five `card.subtask_*` and `card.attachment_*` actions with metadata in the same transaction; `describeActivity` sentences are in 35.22.
    - _Requirements: 25.10, 25.11, 25.12, 27.2_
  - [x] 35.18 Update the seed
    - Rework of ticked 33.41: `flask seed-data` creates the users, Boards, Board_Members, Card with Subtasks, and no membership for Manager or Admin of Requirement 22 criterion 18; idempotent.
    - _Requirements: 22.18, 1.64_
  - [x] 35.19 Remove visibility from the Frontend and restrict the member controls
    - Rework of ticked 16.x, 17.x, 31.x, 33.14 to 33.20: delete the lock icons, the toggle, and filters (Sidebar, Board header, Home tiles, new-board modal); Home empty-state message; the Sidebar add-member button for Manager and Admin only; the Team members list starts with the owner row tagged "Owner" with no remove button (round 2 within V12); the assignee picker lists `GET /boards/{id}/members` with the owner first.
    - _Requirements: 22.14, 22.15, 22.16, 22.19, 3.20, 3.22, 3.24, 3.29, 4.33_
  - [x] 35.20 Public link button, Shared_View, and the route guard
    - Rework of ticked 33.14 to 33.20: rename the Share button to "Public link" and show it to Manager and Admin only; Shared_View banner link "Sign in" or "Go to Home"; no write control; extend `proxy.ts` to `/invite/:path*`; Safe_Return_Path accepts `/invite/`; headers for `/invite/:token*`.
    - _Requirements: 23.4, 23.7, 23.8, 23.9, 24.18, 24.22, 15.35_
  - [x] 35.21 Build the Invite modal and the `/invite/{token}` page
    - `InviteModal` (generate, click-to-copy, regenerate and disable behind popover `BaseConfirm`, pending list with each requester's avatar or initials, full name, Username, and Email, Approve and Reject for Manager and Admin, the note for the owner, the count badge) and the page with its four states and the not-valid page.
    - _Requirements: 24.19, 24.20, 24.21, 24.22, 24.23, 24.24, 24.25, 24.27_
  - [x] 35.22 Replace the draft model with Auto_Save in the Card modal
    - Rework of ticked 18.x, 27.x, 28.x, and unticked 29.x: remove `useCardDraft`, the Save changes button, the staged attachments, and the unsaved-changes prompt; add `useFieldSave`, the per-field state and `aria-live` regions, the close handling, and the new `describeActivity` sentences.
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7, 25.8, 25.9, 25.13, 25.14, 25.15, 25.16, 4.21, 4.30, 4.32, 4.35, 4.43_
  - [x]* 35.23 Write the Auto_Save tests
    - **Property 58: Auto-save sends only what changed**
    - `fast-check` over a pure model of `useFieldSave` and the merge function, plus the component tests of Requirement 15 criterion 33.
    - **Validates: Requirements 25.2, 25.3, 25.4, 25.5, 25.9**
  - [x] 35.24 `BaseConfirm` variants, Attachment removal, and Comment deletion in the Frontend
    - Rework of ticked 26.x and 28.x: add `variant="popover" | "modal"`; Attachment removal and Comment delete use the modal with the texts of Requirement 26; the Delete action only on the viewer's own Comments.
    - _Requirements: 26.1, 26.2, 26.10, 26.11, 4.44_
  - [x] 35.25 Member Subtask toggles and the progress meter in the Frontend
    - Enabled checkboxes for the Assigned_Member, disabled for others and in the Shared_View; the meter on the board Card and in the Subtasks card; "No subtasks yet".
    - _Requirements: 27.6, 27.7, 27.8_
  - [x] 35.26 Clickable Inbox, Board page parameters, and notices
    - `InboxRow` as a link, `hrefFor`, mark read, `?card=` and `?invite=` on the Board page, `CardNotice`, `BoardUnavailable`, the three new sentences.
    - _Requirements: 28.5, 28.6, 28.7, 28.8, 28.9, 28.10, 28.11_
  - [x] 35.27 Profile page two-column layout
    - Full-width container, `grid-cols-1` with `min-[960px]:grid-cols-2`, existing tokens only.
    - _Requirements: 29.1, 29.2, 29.3, 29.4_
  - [ ]* 35.28 Write the V12 Playwright tests and the component tests
    - Add `AUTH-E2E-V12-01` to `-08` to the auth suite (Requirement 1 criteria 65 to 72), the `vitest` tests for `proxy.ts` and the Safe_Return_Path (Requirement 15 criterion 35), and the component tests of Requirement 15 criteria 33 and 34. The suite stays read-only. No data-writing invite-flow Playwright test or project is scheduled: the invite flow is verified by hand (task 35.31) and "automated invite-flow end-to-end test" is an explicitly deferred item (Requirement 15 criteria 38 and 39, round 2 within V12).
    - _Requirements: 1.65, 1.66, 1.67, 1.68, 1.69, 1.70, 1.71, 1.72, 15.33, 15.34, 15.35, 15.39_
  - [ ] 35.31 Run the manual verification checklist for the invite flow
    - Follow "Manual verification checklist (V12 invite flow)" in `design.md` with two browser profiles on a local or scratch database after `flask seed-data`; write down each result. Data-writing, so it is never part of the Playwright suite.
    - Deferred (explicit): automated invite-flow end-to-end test. Do not add a Playwright project for it in V12.
    - _Requirements: 15.38, 15.39, 24.8, 24.13, 24.14, 24.15, 24.19, 22.19_
  - [x]* 35.32 Write the round 2 Backend tests (owner row and pending-list Email)
    - `pytest` per Requirement 15 criterion 36: members endpoint (owner first, once, `is_owner`, Email only with `include=email` for staff, 403 for a Member), candidates exclude the owner, `DELETE` of the owner row is 404, `GET /boards/{id}/join-requests` has `email` for owner, Manager, and Admin and 403 or 401 otherwise, and no Email in the create and decision responses, Notification bodies, Activity_Log `metadata`, Comment bodies, or any `/api/shared` payload.
    - _Requirements: 22.13, 22.20, 24.13, 24.28, 15.36_
  - [ ]* 35.33 Write the round 2 Frontend component tests (owner row and pending-list Email)
    - `vitest` per Requirement 15 criterion 37: Team members owner row with the "Owner" tag and no remove button, `MemberSearch` without the owner, the assignee popover with the owner first, the Invite modal row with the Email, and no Email in an Inbox row or a Sidebar member row.
    - _Requirements: 22.19, 24.19, 24.27, 15.37_
  - [x] 35.29 Sync steering and guidelines to V12
    - Done in this revision: `.kiro/steering/product.md`, `data-model.md`, `api-conventions.md`, `backend.md`, `frontend.md`, `tech.md`, `structure.md`, and `guidelines/backend.md`, `database.md`, `frontend.md`. Round 2 within V12 updated `product.md`, `data-model.md`, `api-conventions.md`, `backend.md`, `frontend.md`, `tech.md`, and `guidelines/backend.md`, `database.md`, `frontend.md` again (Email in the pending list, owner row, manual invite checklist).
    - _Requirements: 22.1, 23.1, 24.1, 25.1_
  - [ ] 35.30 Checkpoint - Run the V12 checks
    - Ensure `pytest`, `tsc --noEmit`, `vitest run`, and `next build` pass; run the migration on a scratch database; run `flask seed-data`; check Home as `member` (only Alpha Board), the invite flow by the manual checklist of task 35.31, a card edit with the network throttled, and the Profile page at 360 and 1280 pixels. Ask the user if questions arise.
    - _Requirements: 15.29, 15.30, 15.31, 15.32, 15.33, 15.34, 15.35_
- [x] 36. Role tag, control sizes, and document titles (Decisions AG to AI, V13)
  - [x] 36.1 Return `role` from the members endpoint and add the Frontend `RoleTag`
    - Rework of ticked 35.3 (members list), 35.19 (assignee picker, Sidebar), and 16.x: `role` on `BoardMemberSchema`; `Member.role`; `RoleTag`; assignee option text, keywords, and Sidebar rows; no role in `/api/shared`.
    - _Requirements: 30.1, 30.2, 30.3, 30.4, 30.5_
  - [x]* 36.2 Write the role tests
    - **Property 60: Role tag follows the list** (`vitest`, fast-check) and a `pytest` check that the members rows carry `role` and never `manager` or `admin`, and that the query count is unchanged.
    - **Validates: Requirements 30.1, 30.2**
  - [x] 36.3 Bring the Invite and Public link controls to the control scale
    - Rework of ticked 35.20 and 35.21: header buttons at `md`, modal buttons at `md`, link field and Copy in one row at 40 pixels, titled sections, compact Approve and Reject with a 44 pixel target below 960 pixels, icon-only header labels when narrow; run `styling.test.ts`.
    - _Requirements: 31.1, 31.2, 31.3, 31.4, 31.5, 31.6_
  - [x] 36.4 Build `lib/titles.ts` and set every document title
    - Root `title.template`, page `metadata`, `generateMetadata` for the Board, Categories, and Shared pages, `AppShell` and Card modal title effects, the 60 character cut.
    - _Requirements: 32.1, 32.2, 32.3, 32.4, 32.5, 32.6, 32.7_
  - [x]* 36.5 Write the title tests
    - **Property 59: Title builder**, one render test per route title, and `document.title` of `/login` and `/register` in the auth e2e suite.
    - **Validates: Requirements 32.1, 32.4, 32.6, 32.8**
  - [x] 36.6 Sync steering and guidelines to V13, then checkpoint
    - `.kiro/steering/frontend.md` and `guidelines/frontend.md` (titles, role tag, header control size); ensure `pytest`, `tsc --noEmit`, `vitest run`, and `next build` pass and check the three changes in Chrome at 360 and 1280 pixels.
    - _Requirements: 30.2, 31.1, 32.1_
- [ ] 37. Production deployment (Decisions AJ to AN, V14)
  - [x] 37.1 Resolve the blocking questions
    - Open Questions 31 to 33: server type, reset-migration amendment, Nginx port.
    - _Requirements: 33.3, 33.5, 33.8, 37.2, 37.3_
  - [x] 37.2 Make the reset migrations safe on an empty production database
    - Test on PostgreSQL: empty production, non-empty production, unchanged development (Property 61).
    - _Requirements: 37.2, 37.3_
  - [x] 37.3 Add `GET /api/health`
    - Layers, bounded database wait, 200 and 503 tests, regenerate `openapi.json`, update `API.md`.
    - _Requirements: 35.1, 35.2, 35.3_
  - [x] 37.4 Make the Frontend origin-independent
    - URL resolver, relative asset paths, relative `/session-expired` redirect, tests (Property 62).
    - _Requirements: 33.6, 33.7_
  - [x] 37.5 Build the Backend image
    - Add Gunicorn, non-root Dockerfile, entrypoint with upgrade and rollback switch.
    - _Requirements: 33.1, 33.4, 37.1_
  - [x] 37.6 Build the Frontend image
    - Standalone output, non-root multi-stage Dockerfile.
    - _Requirements: 33.1_
  - [x] 37.7 Write the Compose file
    - Host network, loopback binds, scheduler, uploads, restart policy, log rotation, health checks.
    - _Requirements: 33.1, 33.3, 33.8, 33.9, 33.10, 33.12_
  - [x] 37.8 Write the Nginx site and the setup SQL
    - New site file, forwarded headers, body limit; idempotent SQL with the password given at run time.
    - _Requirements: 33.2, 33.5, 33.11_
  - [x] 37.9 Write the deploy and rollback script
    - Backup, build by SHA, health check, rollback without migration.
    - _Requirements: 34.4, 34.6, 34.7_
  - [x] 37.10 Write the GitHub Actions workflow
    - `test`, `smoke` in an isolated environment, then `deploy` on `master`.
    - _Requirements: 34.1, 34.2, 34.3, 34.4, 34.5_
  - [x] 37.11 Write the runbook
    - Install, secrets, GitHub setup, one-time seed, rollback, later domain and TLS, migration compatibility rule.
    - _Requirements: 33.11, 33.13, 34.8, 36.1, 36.2, 36.3_
  - [ ] 37.12 Sync steering and guidelines to V14
    - Replace the two-domain rationale; record topology, health endpoint, and the migration rule.
    - _Requirements: 33.1, 34.8, 35.3_
  - [x] 37.14 Add the `flask run-scheduler` command
    - Runs at start and hourly, survives a failed run, stops on SIGTERM. The service that hosts it is 37.7.
    - _Requirements: 33.9_
  - [ ] 37.13 Checkpoint: first deployment
    - Green CI, first deploy, seed, forced rollback, server reboot, then a check from the internet. Ask the owner before any action on the server.
    - _Requirements: 33.8, 34.7, 36.1_
- [ ] 38. Design system, app shell, landing page, host split, and throughput (Decisions AQ to AX, V16)
  - [x] 38.1 Owner review of V16
    - The owner approves Requirements 38 to 44 and answers Open Questions 38 to 45 (domain names; rail and Top_Nav both kept; Team destination; Plus Jakarta Sans; `done_delta` meaning; pill nav on the landing page; filled fields and small controls; rail Home circle and landing announcement bar). No code task below starts before this is ticked.
    - _Requirements: 38.10, 39.21, 42.1, 43.4_
  - [x] 38.2 Tokens, theme alias, and fonts
    - New measured values and names in `styles/tokens.css` (canvas and tint, radius roles, button and chip sizes, gradients, shadows); aliases in `styles/globals.css`; the `touch-target` utility; retire the old text, radius, and `--surface-hover` tokens; two `@fontsource-variable` packages; remove every third-party font reference. Tests: V16-T01 and the contrast test V16-T02 (Property 67).
    - _Requirements: 38.1, 38.2, 38.3, 38.4, 38.5, 38.6, 38.7, 38.8, 38.9, 38.10, 38.11, 38.12, 38.14, 38.15, 38.16, 38.17, 38.21, 38.22, 38.23, 44.1, 44.2_
  - [x] 38.3 Restyle the shared components to the recipe table
    - `BaseButton`, `BaseBadge`, `BaseChip`, `BaseCard`, `BaseField`, `BaseModal`, `BasePopover`, `BaseMenu`, `BaseCombobox`, `BaseTooltip`, `BaseAvatar`, `ProgressMeter`, `RoleTag`, and the `components/ui` variants; add `BaseDrawer`; map prototype icons to `lucide-react`; build a recipe test page and the browser test V16-T16 (Property 63, V16-T03). Compare each component with `design/reference/v2/` before ticking.
    - _Requirements: 38.13, 38.18, 38.19, 38.20, 38.24, 44.3, 39.4_
  - [x] 38.4 Backend: `completed_at`, its lifecycle, and `done_delta`
    - Migration with backfill and downgrade; set and clear in create and move; `done_delta` from `completed_at`; tests on PostgreSQL where migration tests use it (Properties 66).
    - _Requirements: 43.1, 43.2, 43.3, 43.4, 44.11_
  - [x] 38.5 Backend: throughput endpoints
    - Board and cross-board routes, `weeks` validation, portable weekly bucketing, constant query count, role rules, regenerate `openapi.json`, update `API.md` (Property 65).
    - _Requirements: 43.5, 43.6, 43.7, 43.8, 43.9, 43.10, 44.11, 44.12_
  - [x] 38.6 App shell: header, Icon_Rail, Top_Nav, Nav_Drawer, Skip link
    - `navItems.ts` as the single list; new `AppShell` and `AppHeader`; remove `Sidebar.tsx`, `useSidebarState.ts`, and the stored collapse key.
    - _Requirements: 39.1, 39.2, 39.3, 39.4, 39.5, 39.6, 39.9, 39.10, 39.11, 39.22, 39.23, 39.24, 39.25, 44.4_
  - [x] 38.7 Board_Switcher, Board_Toolbar, Team_View, and the three Side_Panel views
    - Switcher with search, role tag, percentage, and create action; toolbar with progress meter, Public link, and Invite; Team_View with the member search and remove; Admin's Team goes to `/admin/users`; Inbox and Activity open from the rail and the Top_Nav.
    - _Requirements: 39.7, 39.8, 39.12, 39.13, 39.14, 39.15, 39.16, 39.17, 39.18, 39.19, 39.20, 39.21, 39.26, 44.4_
  - [x] 38.8 Restyle Home, the Board page, Cards, Columns, and the Card modal
    - No hero, no board-level Add Task, no card identifier or estimate, "Priority" label, drag shadow and radius.
    - _Requirements: 40.1, 40.2, 40.3, 40.7, 40.8, 40.9, 40.10, 40.11, 40.12, 44.6_
  - [x] 38.9 Restyle sign-in, register, invite, and the error pages
    - Split layout, link switch between the two routes, separate Username and Email fields, no Terms or entropy meter, auth form card recipe.
    - _Requirements: 40.4, 40.5, 40.6, 40.21, 44.6_
  - [x] 38.10 Restyle Inbox, Activity, Categories, Invite and Public link modals, New Board, Admin users, Profile, and the Shared view
    - Remove nothing that exists; add none of the excluded items.
    - _Requirements: 40.13, 40.14, 40.15, 40.16, 40.17, 40.18, 40.19, 40.20, 40.22, 44.6_
  - [x] 38.11 Dashboard page
    - `/dashboard`, guard, selector, KPI tiles, throughput chart with hidden table, Boards table for a Manager, recent activity, loading, error, and empty states (Requirement 32 title).
    - _Requirements: 43.11, 43.12, 43.13, 43.14, 43.15, 43.16, 43.17, 43.18, 43.19, 44.13_
  - [x] 38.12 Host routing and origins
    - `lib/host.ts`, `lib/origins.ts`, `proxy.ts` matcher and result, `X-Robots-Tag: noindex` on the App_Host, startup validation of `SITE_URL` and `APP_URL`, host-aware `robots.txt` and `sitemap.xml` (Property 64).
    - _Requirements: 42.1, 42.2, 42.3, 42.4, 42.5, 42.6, 42.7, 42.8, 42.9, 42.14, 41.14, 44.9_
  - [x] 38.13 Landing page
    - `app/site/page.tsx`, `components/landing/`, `lib/landing-sample.ts`, metadata, anchors, drawer; truthfulness test (Property 68).
    - _Requirements: 41.1, 41.2, 41.3, 41.4, 41.5, 41.6, 41.7, 41.8, 41.9, 41.10, 41.11, 41.12, 41.13, 41.14, 41.15, 41.16, 41.17, 41.18, 44.8_
  - [x] 38.14 Deployment for two hosts
    - Nginx `server_name` for both hosts and `default_server` for the IP, `/api/` 404 on the Site_Host, env template, `compose.yaml`, `deploy/bare/supervisor.conf`, runbook (DNS, certificate, `Secure` cookie), smoke checks, and CI. Does not change the server; ask the owner before any server action.
    - _Requirements: 42.8, 42.10, 42.11, 42.12, 42.13, 42.15, 44.10_
  - [x] 38.15 Update the existing tests that query the Sidebar
    - AUTH-E2E-SO, the V12 Team members tests, the route tests, and any Playwright selector; none is deleted.
    - _Requirements: 44.5_
  - [ ] 38.16 Responsive and keyboard pass
    - Playwright at 360, 414, 960, and 1280 pixels for the pages of V16-T07; focus order; drawer focus trap.
    - _Requirements: 40.3, 39.25, 44.7_
  - [x] 38.17 Sync steering and guidelines to V16
    - `.kiro/steering/frontend.md`, `tech.md`, `product.md`, `structure.md`, and the frontend guideline: shell, radius and font rules, the prototype reference, the two hosts, the new folders.
    - _Requirements: 38.1, 39.22, 42.1_
  - [ ] 38.18 Checkpoint: side-by-side review
    - Full `pytest`, `tsc --noEmit`, `vitest run`, `next build`; the screenshots of V16-T17 beside the 13 reference renders in `design/reference/v2/` at 1440 and 390 pixels with the owner; record each decision in `specs/CHANGELOG.md`.
    - _Requirements: 44.14, 44.15, 44.16, 44.17, 38.25, 38.27_

- [ ] 39. UI fixes, paths and navigation, slugs, Columns and views, users, profile, dashboard, notifications, activation (Decisions AY to BJ, V17)
  - Built on 2026-11-26. A phase gate is ticked when its tests and `next build` pass; **no commit was made** (the owner said not to commit yet), so the whole of V17 is one uncommitted change. Only 39.52 (the owner's visual review) is open. Differences between the text and the build are listed in the changelog entry "Implementation of V17".
  - Every task lists the files it changes, the tests it adds, and its requirement IDs. One commit per phase. Each phase gate (the last task of a phase) runs `pytest`, `vitest run`, `tsc --noEmit`, and `next build`, and regenerates `backend/openapi.json` and `backend/API.md` when the API changed. Nothing here is built until 39.1 is ticked.
  - [x] 39.1 Owner review of V17
    - Answered in round 2 within V17 (see the changelog); only the formal approval remains. The owner approves Requirements 45 to 59 and answers Open Questions 51 to 67 (in particular 51 ConfirmDialog scope, 52 slug 403 versus 404, 53 `cards.board_id`, 54 dashboard range, 55 Column rights, 56 the due job and cron, 57 `completed_at`, 58 status chip, 63 screens without a reference, 64 Gmail limits). No code changes before this is ticked.
    - _Requirements: 45 to 59_
  - **Phase 1: UI fixes (Requirement 45)**
  - [x] 39.2 `ConfirmDialog` and its callers
    - New `frontend/components/shared/ConfirmDialog.tsx` over `BaseModal`; replace every `BaseConfirm` use (card modal, subtasks, attachments, comments, members, links, avatar, Board and Column and Category actions); delete `BaseConfirm.tsx` when unused; confirm before the creates of FIX-07. Tests: `confirm-dialog.test.tsx` (names, Escape, Cancel, focus return, busy, error kept) and one request-after-confirm test per action; update `tests/shared-ui.test.tsx` and `tests/card-modal.test.tsx` without deleting cases.
    - _Requirements: FIX-07, FIX-08, FIX-09, FIX-10, FIX-11_
  - [x] 39.3 Sign-in and register fixes
    - `components/AuthSplitLayout.tsx`, `components/AuthForm.tsx`, `lib/validation.ts`, `components/shared/BrandLogo.tsx`, `public/brand/*` (ask the owner for a transparent file if the PNG is opaque). Transparent logo, shared canvas tokens, clear a field's error on edit, validate every field on submit with focus on the first invalid one. Tests: `tests/auth.test.tsx` (cases for FIX-03 and FIX-04), `tests/branding.test.tsx` (alpha pixel check), a token-equality test for FIX-02.
    - _Requirements: FIX-01, FIX-02, FIX-03, FIX-04_
  - [x] 39.4 Option hover highlight
    - `components/shared/BaseCombobox.tsx`, `BaseMenu.tsx`, and the `components/ui` primitives behind them: the highlight follows the pointer and clears on `pointerleave`; the keyboard highlight is unchanged. Tests: `tests/shared-ui.test.tsx` (pointer move, leave, then arrow keys).
    - _Requirements: FIX-05_
  - [x] 39.5 Members panel spacing
    - `components/shell/TeamView.tsx`: `--space-4` between the header and the search input (the view is renamed in 39.11). Test: class assertion in `tests/v16-shell.test.tsx`.
    - _Requirements: FIX-06_
  - [x] 39.6 Phase 1 gate (the commit waits for the owner: "dont commit yet")
    - Backend tests, frontend tests, `next build`. One commit: `feat(ui): V17 phase 1 UI fixes and ConfirmDialog`.
    - _Requirements: V17-T08_
  - **Phase 2: Path topology and navigation (Requirements 46 and 47)**
  - [x] 39.7 Frontend path topology
    - Move `app/(app)/*` and `app/(auth)/*`, `app/shared`, `app/session-expired` under `app/app/`; move the Landing_Page from `app/site/page.tsx` to `app/page.tsx`; delete `lib/host.ts`, `lib/origins.ts`, `app/site/`, and the host branch of `proxy.ts`; `proxy.ts` matcher `/app/:path*`, guard list, `X-Robots-Tag: noindex`, cookie `Path=/app`; new `lib/routes.ts`; the 308 table and `app/app/boards/[id]/page.tsx` redirect route; `next.config.ts` development rewrite; `robots.txt` and `sitemap.xml` for `/`; `NEXT_PUBLIC_API_URL`. Tests: replace `tests/origin.test.ts` and `v16-host` with `routes.test.ts`, `proxy.test.ts` (guard, `next` whitelist, legacy 308s with query), and the no-hand-written-route scan.
    - _Requirements: PATH-01, PATH-02, PATH-05, PATH-06, PATH-07, PATH-08, PATH-09, PATH-10, PATH-12_
  - [x] 39.8 Backend public prefix
    - `app/config.py` (`API_PUBLIC_PREFIX`), `app/common/signing.py` and the schemas that build `file_url`, `avatar_url`, and the Invite and Public link `path`; `backend/.env.example`. Tests: `test_share.py`, `test_invites.py`, `test_avatar.py` assert the prefix in the paths and that an old signature still verifies after a prefix change.
    - _Requirements: PATH-04_
  - [x] 39.9 Deploy files for one origin
    - `deploy/nginx/revoboard.conf`, `compose.yaml`, `deploy/bare/supervisor.conf`, `deploy/supervisor/revoboard.conf`, `deploy/deploy.sh`, `deploy/seed.sh`, `deploy/setup-server.sh`, `deploy/bare/*.sh`, `deploy/smoke.sh`, `deploy/smoke.mjs`, `deploy/README.md` (topology, 308 table, cookie path, rollback to V16). Does not touch the server; ask the owner before any server action.
    - _Requirements: PATH-03, PATH-11, V17-T09, V17-T14_
  - [x] 39.10 Sidebar, Top_Menu, and App_Header
    - New `components/shell/Sidebar.tsx`, `TopMenu.tsx`, `useSidebarState.ts` (safe `localStorage` read); rewrite `navItems.ts` (`sidebarItems`, `topMenuItems`); `AppHeader.tsx`, `AppShell.tsx`, `NavDrawer.tsx` (the "This board" group); delete `IconRail.tsx` and `TopNav.tsx`; new tokens `--sidebar-w` and `--sidebar-w-collapsed` in `styles/tokens.css` and `styles/globals.css`; the bell stays the only way to the Inbox. Tests: `v17-nav.test.tsx` (items per role and Board state, no id in both lists, toggle state and tooltips, Nav_Drawer focus trap).
    - _Requirements: NAV-01, NAV-02, NAV-03, NAV-04, NAV-05, NAV-06, NAV-08, NAV-09, NAV-10, NAV-11, NAV-12_
  - [x] 39.10a Inbox All and Unread switch
    - Backend `notifications/routes.py`, `service.py`, `repository.py`, `schema.py`: `unread=true` filter on `GET /api/notifications`; frontend `InboxView.tsx` segmented switch, `lib/api.ts`; regenerate `openapi.json` and `API.md`. Tests: `test_notifications.py` (filter, paging, `unread_count` unchanged), `v17-inbox.test.tsx` (switch, keyboard, row stays until reload, empty state).
    - _Requirements: NAV-13_
  - [x] 39.11 Side_Panel views: Members and Categories
    - `ShellContext.tsx` (`"inbox" | "activity" | "members" | "categories" | null`), `SidePanel.tsx`, rename `TeamView.tsx` to `MembersView.tsx`, new `CategoriesView.tsx` from `components/board/CategoriesScreen.tsx` (remove the Categories route), titles restored on close. Tests: update the Team and Categories tests; Escape and focus return.
    - _Requirements: NAV-07, FIX-06_
  - [x] 39.12 Update the existing tests that query the V16 navigation and the old popovers
    - Every Playwright and `vitest` test that queries the Icon_Rail, Top_Nav, `BaseConfirm`, the Public link and Invite buttons, or the old routes now queries the new components and paths; none is deleted. AUTH-E2E-SO selectors move to the User_Menu on `/app` paths.
    - _Requirements: NAV-08, PATH-08, CM-05_
  - [x] 39.13 Phase 2 gate and commit
    - Full test run, `next build`, a manual walk at 360 and 1280 pixels. Commit: `feat(shell): V17 phase 2 path topology and navigation`.
    - _Requirements: V17-T08_
  - **Phase 3: Board slug and 404 page (Requirement 48)**
  - [x] 39.14 Migration 1, `slugify`, model
    - New `backend/migrations/versions/<rev>_v17_board_slug.py` (reversible, backfill by `created_at`, `id`), `backend/app/models/board.py` (`slug`, unique index), new `backend/app/common/slug.py`. Tests: `test_slug.py` (unit and `hypothesis`, Property 69), migration test in `test_migrations.py`.
    - _Requirements: SLUG-01, SLUG-02, SLUG-03, V17-T06_
  - [x] 39.15 Slug in the API
    - `boards/service.py` and `repository.py` (set on create, regenerate on rename in one transaction, retry on `IntegrityError`), `GET /api/boards/slug/{slug}` in `boards/routes.py` with `schema.py`, `slug` in the Board, Notification (`board_slug`), and invite payloads, `slug` rejected in bodies, OpenAPI and `API.md`. Tests: `test_api.py` (200, 401, 403, 404, old slug, rename), Property 69.
    - _Requirements: SLUG-04, SLUG-05, SLUG-06, SLUG-07, SLUG-10, SLUG-14_
  - [x] 39.16 Frontend Board route and rename
    - `app/app/b/[slug]/page.tsx` (and later `list`, `calendar`, `archived`), `lib/api.ts` (`boards.bySlug`), `lib/routes.ts`, rename handler that replaces the URL and the document title, `hrefFor` in `lib/inbox.ts` with `board_slug`, Board_Switcher and Board tiles use the slug. Tests: `tests/route-titles.test.ts`, inbox tests, rename test.
    - _Requirements: SLUG-08, SLUG-09, PATH-10_
  - [x] 39.17 Not_Found_Page
    - `app/not-found.tsx`, `components/shared/NotFound.tsx` (token-only illustration), used by `notFound()` calls and the `/app/boards/{id}` route. Tests: content, no slug shown, 404 status, noindex header, title.
    - _Requirements: SLUG-11, SLUG-12, SLUG-13_
  - [x] 39.18 Phase 3 gate and commit
    - Full test run; regenerate OpenAPI. Commit: `feat(boards): V17 phase 3 board slug and not found page`.
    - _Requirements: V17-T08_
  - **Phase 4: Column CRUD and board views (Requirements 49 and 50)**
  - [x] 39.19 Migration 2, archive and restore
    - New `<rev>_v17_cards_nullable_column.py` (`cards.board_id` added and backfilled, `column_id` nullable, archived Cards nulled, downgrade restores them to the first Column), `models/card.py`, `cards/service.py` and `repository.py` (archive nulls `column_id`, `POST /api/cards/{id}/restore`, `archived=true` list, `CARD_ARCHIVED`, `CARD_NOT_ARCHIVED`, `CARD_IN_DONE` on archiving a Done Card), `completion_stamp` update, every board query reads `Card.board_id` where it joined through the Column. Tests: migration test, `test_throughput.py` (archive keeps `completed_at`), Property 72.
    - _Requirements: COL-07, COL-08, COL-09, COL-14, VIEW-05, VIEW-06, VIEW-07, VIEW-10, V17-T06_
  - [x] 39.20 Column CRUD backend
    - `columns/routes.py`, `service.py`, `repository.py`, `schema.py`; activity rows; Board_Owner, Manager, and Admin check; `COLUMN_NOT_EMPTY` and `COLUMN_LOCKED`; renumber on move; OpenAPI. Tests: `test_columns.py` (every role and code), Properties 70 and 71.
    - _Requirements: COL-01, COL-02, COL-03, COL-04, COL-05, COL-06, COL-10_
  - [x] 39.21 Column CRUD frontend
    - `components/board/Board.tsx`, new `ColumnMenu.tsx`, `AddColumn.tsx`, `lib/api.ts`; the owner-only controls; ConfirmDialog for create and delete; locked Done tooltip. Tests: `tests/columns.test.tsx`.
    - _Requirements: COL-11, COL-12, COL-13, COL-14_
  - [x] 39.22 `due_state` on every Card payload
    - `cards/schema.py`, `shared/schema.py`, new `app/common/due.py` (`due_state`), `lib/types.ts`, `CardTile.tsx`, `BaseBadge` tones. Tests: `test_due.py` (Property 79), tile test.
    - _Requirements: VIEW-08, VIEW-09_
  - [x] 39.23 List view
    - `app/app/b/[slug]/list/page.tsx`, `components/board/ListView.tsx`, shared filter bar reuse. Tests: grouping, filters, stacked rows.
    - _Requirements: VIEW-01, VIEW-02_
  - [x] 39.24 Calendar view
    - `app/app/b/[slug]/calendar/page.tsx`, `components/board/CalendarView.tsx` (month grid, "+N more" popover), `lib/dates.ts` month helpers. Tests: month grid, no `end_date` hidden, mobile layout.
    - _Requirements: VIEW-03, VIEW-04_
  - [x] 39.25 Archived page
    - `app/app/b/[slug]/archived/page.tsx`, `components/board/ArchivedView.tsx`, the "Archived" toolbar link with count, Restore action. Tests: rows, restore, message.
    - _Requirements: VIEW-05, VIEW-06, VIEW-07_
  - [x] 39.26 Phase 4 gate and commit
    - Full test run; regenerate OpenAPI. Commit: `feat(boards): V17 phase 4 column CRUD, list, calendar, archived, due badges`.
    - _Requirements: V17-T08_
  - **Phase 5: Card modal and Share modal (Requirements 55 and 56)**
  - [x] 39.27 Share modal
    - New `components/board/ShareModal.tsx` replacing `InviteModal.tsx`, `InviteButton.tsx`, `PublicLinkButton.tsx`; the Share item opens it; `?invite=1`; ConfirmDialog for create, regenerate, disable. Tests: sections per role (owner, Manager, Admin), counts, links, focus return.
    - _Requirements: SHR-01, SHR-02, SHR-03, SHR-04, SHR-05_
  - [x] 39.28 Card modal rebuild
    - `components/card/CardModal.tsx`, `CardAttributes.tsx` (chip row with the read-only status chip), layout to `04-card-modal-*`; no behaviour change. Tests: update `tests/card-modal.test.tsx` and `card-parts.test.tsx` without deleting cases; chip row order and the read-only status.
    - _Requirements: CM-01, CM-02, CM-03, CM-04, CM-05_
  - [x] 39.29 Phase 5 gate and commit
    - Full test run. Commit: `feat(card): V17 phase 5 share modal and card modal`.
    - _Requirements: V17-T08_
  - **Phase 6: Users, availability, and profile (Requirements 53 and 54)**
  - [x] 39.30 Migration 3 and the mail foundation
    - New `<rev>_v17_users_activation.py` (`is_active`, `is_available`, `email_verified_at` backfilled, `pending_email`, `email_tokens`), `models/user.py`, new `app/common/mail.py` (smtp and console backends, bounded worker, outbox for tests), new `app/common/email_tokens.py` (create, hash, verify, invalidate), `app/config.py` mail settings, `backend/.env.example`. Built here because the email change (54) needs it; Phase 9 reuses it. Tests: `test_mail.py`, `test_email_tokens.py`, migration test.
    - _Requirements: ADM-01, ACT-01, ACT-05, ACT-06, ACT-08, ACT-09, V17-T06_
  - [x] 39.31 Backend users: flags, deactivation, pickers
    - `users/service.py`, `repository.py`, `routes.py`, `schema.py` (no `DELETE`, `is_active` and `is_available` in `PATCH`, `USER_HAS_OPEN_WORK`, `CANNOT_DEACTIVATE_SELF`), `common/auth.py` (read `is_active` per request, `ACCOUNT_DISABLED`), `auth/service.py` login order, `boards` candidates and `members?assignable=true`, `cards` assignment check, `assignee_is_active` and `assignee_is_available` in the Card schema, `api-conventions` error details. Tests: `test_users.py`, Properties 73 and 74.
    - _Requirements: ADM-03, ADM-05, ADM-06, ADM-07, ADM-08, ADM-09, ADM-10_
  - [x] 39.32 Admin Users page
    - `app/app/users/page.tsx`, `components/admin/UsersScreen.tsx` (table, staged changes, Update ConfirmDialog, New user, stacked cards), `BlockedModal` for `USER_HAS_OPEN_WORK`, `BaseAvatar` markers, remove any delete control. Tests: update `tests/admin.test.tsx`; the new cases of V17-T02.
    - _Requirements: ADM-02, ADM-03, ADM-04, ADM-05, ADM-09_
  - [x] 39.33 Profile backend
    - `auth/routes.py`, `service.py`, `schema.py`: `PATCH /api/auth/me` (name, username, email, availability), `pending_email`, resend and cancel routes, `POST /api/auth/verify` for `change_email`, change-password mail, availability check excluding the caller. Tests: `test_profile.py`.
    - _Requirements: PRF-02, PRF-03, PRF-04, PRF-05, PRF-08, PRF-09, PRF-10_
  - [x] 39.34 Profile frontend and `BaseTabs`
    - `components/shared/BaseTabs.tsx` (add `@radix-ui/react-tabs`, `components/ui/tabs.tsx`), `app/app/profile/page.tsx`, `components/profile/*` (cover band, About, Security, Notifications placeholder until 39.44), token `--size-avatar-xl`. Tests: tabs, pending-email state, password form.
    - _Requirements: PRF-01, PRF-02, PRF-03, PRF-04, PRF-05, PRF-07_
  - [x] 39.35 Phase 6 gate and commit
    - Full test run; regenerate OpenAPI. Commit: `feat(users): V17 phase 6 users, availability, profile`.
    - _Requirements: V17-T08_
  - **Phase 7: Dashboard and My Tasks (Requirements 51 and 52)**
  - [x] 39.36 Dashboard backend
    - `analytics/routes.py`, `service.py`, `repository.py`, `schema.py`: `GET /api/analytics/dashboard` (with `due_on`); reuse `due_state` and the throughput bucketing; constant query budget; OpenAPI. Tests: `test_dashboard.py` with an oracle over generated Cards (Property 78) and the query counter.
    - _Requirements: DASH-12, DASH-17, DASH-19, DASH-20, DASH-21_
  - [x] 39.37 Dashboard frontend
    - `components/dashboard/*` (greeting, filters, the new widgets, stacked bar), `lib/dashboard.ts`, query-string state, states. Tests: `v16-dashboard` updated; greeting boundaries; filter note text.
    - _Requirements: DASH-10, DASH-11, DASH-13, DASH-14, DASH-15, DASH-16, DASH-17, DASH-18, DASH-22_
  - [x] 39.38 My Tasks backend
    - `GET /api/me/cards` in the `cards` blueprint (design: no `me` blueprint), the grouping function in `app/common/due.py`. Tests: `test_my_cards.py`, Property 80.
    - _Requirements: TASK-04_
  - [x] 39.39 My Tasks page
    - `app/app/my-tasks/page.tsx`, `components/tasks/MyTasks.tsx`. Tests: groups from the API, order, empty and error states.
    - _Requirements: TASK-01, TASK-02, TASK-03, TASK-05_
  - [x] 39.40 Phase 7 gate and commit
    - Full test run; regenerate OpenAPI. Commit: `feat(analytics): V17 phase 7 dashboard and my tasks`.
    - _Requirements: V17-T08_
  - **Phase 8: Notification preferences and the due job (Requirements 57 and 58)**
  - [x] 39.41 Migration 4 and preference endpoints
    - New `<rev>_v17_notification_preferences.py` (table, types, `action` column, narrowed `uq_notifications_card`), `models/activity.py`, `notifications/*` (`GET` and `PUT /api/me/notification-preferences`). Tests: `test_notification_prefs.py`, migration test (index replaced and restored).
    - _Requirements: NPF-01, NPF-02, NPF-06, NPF-07, NPF-09, V17-T06_
  - [x] 39.42 Event producers
    - `comments/service.py`, `cards/service.py` (move, archive, delete), subtask functions: create the notification in the same transaction, respecting preferences, the actor, and an inactive recipient. Tests: `test_notification_events.py`, Property 75.
    - _Requirements: NPF-03, NPF-04, NPF-05_
  - [x] 39.43 `flask notify-due` and the schedule
    - New `app/jobs/due.py` (replaces `deadlines.py`), registration, advisory lock, bulk insert; deploy: cron entry, supervisord loop, Compose `scheduler`, `deploy/README.md`. Tests: `test_due_job.py`, update `test_scheduler.py` (Property 76).
    - _Requirements: DUE-01, DUE-02, DUE-03, DUE-04, DUE-05, DUE-06, DUE-07, V17-T07_
  - [x] 39.44 Frontend: switches and Inbox rows
    - `components/profile/NotificationPrefs.tsx`, `lib/inbox.ts` (`describeNotification`, `hrefFor`), `lib/types.ts`. Tests: switch save and rollback, row text and links for the five types.
    - _Requirements: PRF-06, NPF-08_
  - [x] 39.45 Phase 8 gate and commit
    - Full test run; regenerate OpenAPI. Commit: `feat(notifications): V17 phase 8 preferences and due job`.
    - _Requirements: V17-T08_
  - **Phase 9: Account activation and email (Requirement 59)**
  - [x] 39.46 Activation backend
    - `auth/routes.py`, `service.py`, `schema.py`: register with `token: null` and the verification mail, `POST /api/auth/verify`, `POST /api/auth/resend-verification` with the `resend_verification` limiter scope, login gating, `common/rate_limiter.py`, env settings. Tests: `test_activation.py`, Property 77.
    - _Requirements: ACT-01, ACT-02, ACT-03, ACT-04, ACT-11_
  - [x] 39.47 Activation frontend
    - `app/app/verify/page.tsx`, `components/auth/VerifyView.tsx`, register redirect, `next` kept through register, verify, and login (`lib/return-path.ts`, the invite page links), login form handling of the two codes, `lib/api.ts`. Tests: the states of V17-T02.
    - _Requirements: ACT-07, ACT-12_
  - [x] 39.48 Admin-created users, seed, and deploy settings
    - `POST /api/users` verified at creation, `seed.py`, `flask purge-email-tokens` (optional), `.env.example` files, `compose.yaml`, `deploy/bare/supervisor.conf`, server env template, `deploy/README.md`.
    - _Requirements: ACT-05, ACT-10, PATH-11_
  - [x] 39.49 Phase 9 gate and commit
    - Full test run; regenerate OpenAPI. Commit: `feat(auth): V17 phase 9 account activation and email`.
    - _Requirements: V17-T08_
  - **Phase 10: Verification (all requirements)**
  - [x] 39.50 Playwright setup and four-width checks
    - `frontend/playwright.config.ts`, `frontend/e2e/*.spec.ts` for the pages of V17-T10 and the checks of V17-T11 and V17-T12; add the CI job. No `waitForTimeout`.
    - _Requirements: V17-T10, V17-T11, V17-T12_
  - [x] 39.51 Sync steering, guidelines, and API docs
    - `.kiro/steering/frontend.md`, `backend.md`, `api-conventions.md`, `data-model.md`, `structure.md`, `tech.md`, and the guidelines: paths, navigation, `ConfirmDialog`, slugs, mail, new error details, `BaseTabs`.
    - _Requirements: FIX-10, PATH-01, NAV-05_
  - [ ] 39.52 Checkpoint: owner's visual review
    - The side-by-side review of V17-T13 at 1440 and 390 pixels; record each decision in `specs/CHANGELOG.md`; ask the owner before any server action (V17-T14).
    - _Requirements: V17-T13, V17-T14_
- [x] 40. Toasts, design consistency, shell and lists, Dashboard access, Column drag, Card modal, Card permissions, Members and Categories panels (Decisions BK to BR, V18)
  - Built on 2026-11-26; no commit was made. Only 40.20 (the owner's visual review) is open. Differences between the text and the build are in the changelog entry "Implementation of V18". Each phase ends with a gate (`pytest`, `vitest run`, `tsc --noEmit`, `next build`, `check-tokens`, and `openapi.json`/`API.md` regenerated when the API changed).
  - [x] 40.1 Owner review of V18
    - The owner approves Requirements 60 to 72 and the defaults of Open Questions 74 to 81.
    - _Requirements: 60 to 72_
  - **Phase 1: Design_System and Toasts**
  - [x] 40.2 Scale tokens and the token check
    - `styles/tokens.css`, `styles/globals.css` (`@theme`), `scripts/check-tokens.mjs`. Tests: the token check fails on `gap-[12px]`.
    - _Requirements: 61.1, 61.6_
  - [x] 40.3 `BaseToaster`, `lib/toast.ts`, `toastError`
    - Add `sonner`; mount in the root layout; tests for success, error, validation skip, and the ConfirmDialog rule.
    - _Requirements: 60.1 to 60.7_
  - [x] 40.4 Lists: no default highlight, check mark, every select a `BaseCombobox`
    - `components/ui/command.tsx`, `BaseCombobox`, every `BaseSelect` caller. Tests: nothing highlighted on open; hover and arrow key highlight; check on the chosen value.
    - _Requirements: 61.7, 61.8_
  - [x] 40.5 `BaseDateField` single and range modes, `BaseCheckbox`, inset focus ring
    - _Requirements: 61.9, 61.10, 61.12_
  - [x] 40.6 Apply the scales to every screen and replace inline results with Toasts
    - Auth pages, Boards, Board and its views, Card modal, Dashboard, My Tasks, Users, Profile, panels, Share modal, 404. Chips, progress pill, toolbar search.
    - _Requirements: 60.1, 61.2 to 61.5, 61.11_
  - **Phase 2: Shell and lists**
  - [x] 40.7 Sidebar logo, active subtree rule, back arrow (`parentOf`)
    - `Sidebar.tsx`, `NavDrawer.tsx`, `AppHeader.tsx`, `navItems.ts`, `lib/routes.ts`. Tests: NAVB-03 table, NAVB-05 table.
    - _Requirements: 62.1 to 62.6_
  - [x] 40.8 Users order and paging (Backend) and the pagination bar (Frontend)
    - `users/repository.py`, `service.py`, `schema.py`, `routes.py`; `UsersScreen`; Property 81.
    - _Requirements: 63.1 to 63.5_
  - [x] 40.9 Boards `q`, `sort`, `order` and the search and sort controls
    - `boards/repository.py`, `schema.py`, `routes.py`; Column service touches `boards.updated_at`; Boards page; Property 82.
    - _Requirements: 64.1 to 64.4_
  - **Phase 3: Dashboard and My Tasks**
  - [x] 40.10 Admin analytics scope, Sidebar, home page
    - _Requirements: 65.1, 65.2_
  - [x] 40.11 Dashboard filter card
    - `DashboardView`, `DashboardWidgets`; labels, grid, range field, Reset filters, Due on field.
    - _Requirements: 65.3 to 65.7_
  - [x] 40.12 My Tasks for Member and Supervisor; assignee role refusal
    - `cards/service._assign`, `/me/cards` role rule, `navItems.ts`, the `/app/my-tasks` redirect.
    - _Requirements: 66.1 to 66.4_
  - **Phase 4: Board and Card**
  - [x] 40.13 `useDragSort` extraction and Column drag
    - `hooks/useDragSort.ts`, `Board.tsx`, `ColumnHeader.tsx`; Property 86.
    - _Requirements: 67.1 to 67.5_
  - [x] 40.14 Migration `created_by_id` and `card_policy`
    - `app/common/card_policy.py`, cards and comments services, DTOs (`can_edit`), tests for every matrix row (Property 83).
    - _Requirements: 69.1 to 69.5, 69.7_
  - [x] 40.15 Comments paging (Backend)
    - `comments/repository.py`, `schema.py`, `routes.py`; Property 84.
    - _Requirements: 68.7_
  - [x] 40.16 Card modal: width, no Column chip, order, dates, Load more, permission-driven controls
    - `CardModal`, `CardAttributes`, comments and activity panes.
    - _Requirements: 68.1 to 68.6, 68.8, 69.6_
  - [x] 40.17 Members panel popover and reset
    - _Requirements: 70.1 to 70.3_
  - [x] 40.18 Category palette, validation, swatch grid, shared refresh
    - `lib/categories.ts`, tokens, `categories/schema.py`, `CategoriesView`, `ShellContext`; Property 85.
    - _Requirements: 71.1 to 71.4_
  - **Phase 5: Verification**
  - [x] 40.21 Round 2 within V18: logo toggle, header line, centred Top_Menu, one-row Dashboard filters
    - `Sidebar.tsx` (logo button replaces the toggle icon, `--space-section` below it), `AppHeader.tsx` (`border-b border-line`, three-part row with the Top_Menu centred), `DashboardView.tsx` (presets removed, four filters and Reset in one row). Tests: NAVB-01, NAVB-07, NAVB-08, DASH-27, DASH-28; the four-width check.
    - _Requirements: 62.1, 62.2, 62.7, 62.8, 65.3, 65.5, 65.6_
  - [x] 40.22 Round 2 within V18: one radius per role, one control look, no magic numbers
    - `components/ui/input.tsx` (`controlClasses`), `BaseCombobox` trigger, `BaseDateField`, `ColorSwatchPicker`, `command.tsx`, every component whose radius breaks the DS-14 table; new `tests/design-system.test.ts` (DS-16, DS-17). Tests: the new test; the four-width check.
    - _Requirements: 61.14, 61.15, 61.16, 61.17_
  - [x] 40.23 Round 3 within V18: one radius, two paddings, full Card modal, inset focus ring
    - `tokens.css` (`--radius-ui`, `--pad-surface`, `--pad-item`, `--space-10`, page gutter), every component's radius and surface padding, `dialog.tsx` (card size fills the viewport), `input.tsx` (`focus-ring-inset`), `CardModal.tsx` pane padding, `ActivityList.tsx`, `AppHeader.tsx`, `TopMenu.tsx`; `tests/design-system.test.ts` (DS-18, DS-19).
    - _Requirements: 61.18, 61.19, 61.20, 62.7, 68.1, 68.2_
  - [x] 40.24 Round 4 within V18: Column padding and gutter, seven text sizes, no Board meta line
    - `Board.tsx` (inner padded row, Columns share the row from 960 px), `ColumnHeader.tsx`, `AddColumn.tsx`, `BoardHeader.tsx` (meta line removed, toolbar `text-sm`), `BaseChip.tsx`, `AppHeader.tsx` (brand below 960 px), `tokens.css` and `globals.css` (`--column-w-min`; `2xs`, `meta`, `card-*` text sizes removed), 23 components moved to the seven sizes; `tests/design-system.test.ts` (DS-22).
    - _Requirements: 61.21, 61.22, 61.23_
  - [x] 40.25 Round 5 within V18: Archived count, one heading scale, page frame, auth and landing
    - `BoardView.tsx` (Archived count +1 outside the state updater), `ArchivedView.tsx` (page frame, Toast), every heading to its level (DS-24), `text-title` removed, page wrappers (DS-25), `AuthSplitLayout.tsx` and `AuthForm.tsx` (DS-26), `landing/sections.tsx`, `LandingHeader.tsx`, `app/page.tsx` (DS-27); `tests/design-system.test.ts` (DS-24), `v16-landing`, `v17-boards` tests.
    - _Requirements: 61.24, 61.25, 61.26, 61.27_
  - [x] 40.26 Round 6 within V18: Column width, public board, TinyMCE descriptions
    - `tokens.css` (`--column-w` from the row container), `Board.tsx`, `AddColumn.tsx`, `SharedBoard.tsx`, `SharedCardModal.tsx`; `RichTextEditor.tsx`, `RichText.tsx`, `lib/rich-text.ts`, `scripts/copy-tinymce.mjs`, `CardModal.tsx`, `NewBoardModal.tsx`, `CardTile.tsx`, `BoardTile.tsx`, `globals.css`; Backend `app/common/rich_text.py`, `boards/dto.py`, `cards/dto.py`, `seed.py`, migration `d4a7e1c9b215`; tests `test_rich_text.py`, `rich-text.test.tsx`.
    - _Requirements: 61.28, 61.29_
  - [x] 40.27 Round 7 within V18: TinyMCE dialogs in the Card modal, one editor focus ring, option rows, board right edge
    - `components/ui/dialog.tsx` (`insideEditorUi`, outside-interaction guards, focusout shield), `RichTextEditor.tsx` (focus shield on the floating UI), `globals.css` (unlayered `:root .tox` overrides), `command.tsx`, `CardAttributes.tsx`, `Board.tsx`, `SharedBoard.tsx`, `tokens.css`; `tests/rich-text.test.tsx`.
    - _Requirements: 61.30, 61.31, 61.32_
  - [x] 40.28 Round 8 within V18: mail layout, login destination, confirmed badge, clickable rows, role tags, toast tones, calendar today, demo seed
    - Backend `common/mail.py`, `auth/dto.py`, `auth/schema.py`, `seed.py`, `seed_projects.py`; `deploy/bare/seed.sh`; Frontend `AuthForm.tsx`, `lib/return-path.ts`, `UsersScreen.tsx`, `LinkRow.tsx`, `DashboardView.tsx`, `DashboardWidgets.tsx`, `ActivityView.tsx`, `ActivityLine.tsx`, `RoleTag.tsx`, `MyTasksView.tsx`, `BoardView.tsx`, `CalendarView.tsx`, `BaseToaster.tsx`, `lib/toast.ts`, `tokens.css`, `globals.css`; tests `test_users.py`, `test_seed.py`, `test_common.py`, `auth.test.tsx`, `v17-dashboard.test.tsx`, `v18.test.tsx`, `calendar-today.test.tsx`.
    - _Requirements: 73.1 to 73.14_
  - [x] 40.29 Round 9 within V18: KPIs on the Dashboard and My tasks
    - Backend `analytics/repository.py`, `service.py`, `schema.py`, `routes.py`, `seed.py`, `seed_projects.py`, `API.md`, `openapi.json`; Frontend `KpiPanels.tsx`, `lib/kpi.ts`, `lib/api.ts`, `lib/types.ts`, `DashboardView.tsx`, `MyTasksView.tsx`; tests `test_kpi.py`, `kpi.test.tsx`, `v17-dashboard.test.tsx`, `v17-tasks.test.tsx`.
    - _Requirements: 74.1 to 74.9_
  - [x] 40.30 Round 9 within V18: attachment tiles, invite card, landing Workflow and Roles
    - `AttachmentLink.tsx`, `AttachmentList.tsx`, `SharedCardModal.tsx`, `InviteCard.tsx`, `InviteJoin.tsx`, `invite/[token]/page.tsx`, `landing/sections.tsx`; tests `attachment-link.test.tsx`, `v12.test.tsx`, `v16-landing.test.tsx`.
    - _Requirements: 73.15 to 73.17_
  - [x] 40.19 Tests, width check, documents
    - _Requirements: 72.1 to 72.3, 72.5_
  - [ ] 40.20 Checkpoint: owner's visual review (includes 39.52)
    - _Requirements: 72.4_
## Notes
- Group 40 (V18) is a draft: nothing in it is built until 40.1 is ticked. Phase 1 comes first because every later screen task uses its tokens, Toasts, and controls; 40.14 must come before 40.16; 40.15 before 40.16; 40.13 needs only Phase 1.
- Group 39 (V17) is a draft: nothing in it is built until 39.1 is ticked. Phases run in order and each ends with a gate and one commit. 39.7 to 39.9 are one move (frontend routes, backend prefix, deploy files) and must ship together. 39.30 (migration 3 and the mail module) comes in Phase 6 because the email change needs it; Phase 9 reuses it. 39.19 adds `cards.board_id` (Open Question 53), which 39.36 and 39.38 read. 39.22 (`due_state`) comes before 39.23 to 39.25 and 39.36 to 39.38. Group 39 reworks ticked tasks of groups 16 to 19, 27, 33, 35, and 38; their checkboxes stay ticked and each task names what it reworks.
- Group 38 progress (2026-11-23): implemented and tested on a laptop except 38.16 (the Playwright pass at 360, 414, 960, and 1280 pixels; the repository has no Playwright setup yet, so the width checks were done by eye in Chrome) and 38.18 (the owner's side-by-side review, `V16-T15`, and the browser recipe test `V16-T16` and screenshot run `V16-T17`, which need Playwright). 38.14 changed the deployment files only; nothing was run on the server.
- Group 38 (V16) is a draft: nothing in it is built until 38.1 is ticked. 38.2 comes first for the Frontend and 38.4 for the Backend; 38.3 needs 38.2; 38.5 needs 38.4; 38.6 needs 38.3; 38.7 needs 38.6; 38.8 to 38.10 need 38.3 and 38.7; 38.11 needs 38.5 and 38.7; 38.12 needs 38.2; 38.13 needs 38.3 and 38.12; 38.14 needs 38.13. Group 38 reworks ticked groups 16 to 19, 26 to 31, 35, and 36; their checkboxes stay ticked and each 38.x task names what it replaces. The tasks of V16 do not touch the API of Requirements 1 to 37 except `done_delta` (38.4) and the two new routes (38.5).
- Group 37 (V14): the code fixes and the deployment files (Docker mode and bare mode) are done and tested on a laptop and in a simulated server; the first real deployment (37.13) and the steering sync (37.12) are open. 37.1 is resolved (bare mode on the current server); 37.13 comes last and touches production.
- Group 36 (V13) is Frontend work plus one field (`role`) on the members endpoint; 36.1 and 36.3 and 36.4 are independent, and 36.6 comes last. It reworks ticked 35.x tasks; their checkboxes stay ticked.
- Round 2 within V12 (no new version) adds 35.31 to 35.33 (placed before 35.29 so that the checkpoint 35.30 stays last) and rewords 35.3, 35.9, 35.10, 35.19, 35.21, 35.28, and 35.30. Explicitly deferred: automated invite-flow end-to-end test; the invite flow is a manual checklist (35.31).
- Group 35 (V12) is the only group that changes behaviour built by ticked groups 2 to 5, 8 to 10, 13, 16 to 18, 26 to 28, and 33; their checkboxes stay ticked and each 35.x task names what it reworks. 35.1 comes first; 35.3 and 35.11 need 35.1; 35.5, 35.7, 35.9, 35.13, 35.15, and 35.17 need 35.3 (and 35.9 needs 35.11); the Frontend tasks 35.19 to 35.27 need the Backend tasks they call. Task 22.1 (stored `progress`) is superseded by 35.15: build only `views_count` there. The Backend and the Frontend deploy together.
- Group 34 (V11, Decision X) changes only the Frontend and moves three files; 34.2 needs 34.1, 34.3 needs 34.2, and 34.4 and 34.5 need 34.3. V10 round 3 (Decisions U to W) is applied separately; group 34 touches `Sidebar.tsx`, `AuthSplitLayout.tsx`, and `AppHeader.tsx`, which round 3 tasks may also edit, so merge in whichever order they land.
- Round 2 within V10 (33.28 to 33.40, Decisions Q to T) amends unimplemented V10 work and is not a new version; 33.5, 33.16, 33.18, and 33.19 were edited in place for it. 33.35 builds on 33.3, 33.28 on 33.1 and 33.11, and 33.33 on 33.11 and 33.19.
- Group 33 (V10) must deploy the Backend and the Frontend together: the login request field, the `user` shape, and Guest access change on both sides. 33.9 (Guest access) and 33.10 to 33.11 (share links) land before the Frontend tasks 33.14 to 33.20, and the e2e update 33.22 to 33.25 runs last. If group 33 reaches the Frontend before group 32 is executed, write 32.2 to 32.4 directly in their V10 form (33.22 to 33.24) and skip the V9 variants.
- The ticked tasks of groups 1 to 19 that mention `login_identifier`, Guest access to public Boards, or the Sidebar Log out item describe the V9 build; group 33 supersedes those behaviours.
- Group 32 (V9, auth end-to-end tests) adds tests only and changes no application code. It needs the login page (15.4) and the Sidebar Log out item (16.1), and shares the Playwright setup with 20.1. Tests SO-03 and SO-05 wait for Open Question 5.

- Group 27 (Trello-style board and card modal, Decision I) runs after 26.7 and before the remaining frontend tasks; it changes components built in tasks 16 to 18 without changing the API client. Task 18.4 tests the new modal, and 19.2 adds the Categories, Members, and Users screens on the new shell.
- Group 26 (Tailwind CSS and shadcn/ui restyle, Decision H) runs after task 15 and before the app shell tasks 16 to 19; the components written before it are restyled in 26.3, with their props, logic, `lib/`, and API client unchanged. It touches no backend code.
- Google OAuth is out of scope and has no task.
- Group 24 (flask-smorest and envelope migration) must be done before the frontend group 15, before group 23 (generated documentation), and before test 14.4 (envelope property test). The frontend `lib/api.ts` (task 15.3) reads the boolean `status` and unwraps `data` from the V6 envelope `{ status, message, data }`, and throws `ApiError(httpStatus, code, message, details)` from `{ status: false, message, error: { code, details? } }`.
- V6 (Decision G) envelope rule for every task: `status` is a boolean true exactly when the HTTP status is 2xx; the message text appears once at the top level; `error` has only `code` and, for `VALIDATION_ERROR`, `details`; mutating endpoints send a descriptive message and reads send "OK".
- Tasks 1 to 13 were built as plain `flask.Blueprint` code with `{ "data": ... }` bodies; their checkboxes stay ticked, and group 24 changes the implementation without changing URLs, status codes, or role rules.
- Group 25 (relationships and eager loading) runs after group 24, because the marshmallow schemas replace the DTO functions, and before the checkpoint 14.6 and the frontend group 15. It needs no migration. The cross-cutting tests in group 14 run after it.
- Property 39 (constant query count) is covered by optional task 25.3; Properties 1 to 38 keep their existing tasks.
- Task 23 depends on group 24 (it documents the generated OpenAPI); it is listed last only for numbering.
- Tasks marked with `*` are optional test tasks.
- Services are tested against fake repositories; no `Model.query` call appears outside a `repository.py`.
- Task 5.8 uses `app/common/ordering.py`, which task 6.1 creates; implement 6.1 before 5.8.
- Property 8, 9, and 11 are split across two tasks each (board/card, edit/move); both parts reference the same property.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4"] },
    { "id": 2, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4", "2.5"] },
    { "id": 4, "tasks": ["3.1", "6.1", "5.1"] },
    { "id": 5, "tasks": ["3.2", "3.3", "3.4", "6.2", "5.2"] },
    { "id": 6, "tasks": ["3.5", "4.1"] },
    { "id": 7, "tasks": ["4.2", "4.3", "4.4", "4.7", "4.10", "4.12"] },
    { "id": 8, "tasks": ["4.5", "4.6", "4.8", "4.9", "4.11", "4.13", "5.3", "7.1"] },
    { "id": 9, "tasks": ["5.4", "5.5", "5.6", "5.8", "5.10", "6.3", "7.2", "8.1", "9.1", "12.1"] },
    { "id": 10, "tasks": ["5.7", "5.9", "5.11", "5.12", "6.4", "8.2", "8.3", "9.2", "9.3", "10.1", "10.2", "11.1", "12.2", "13.1"] },
    { "id": 11, "tasks": ["6.5", "8.4", "8.5", "10.3", "11.2", "13.2"] },
    { "id": 12, "tasks": ["24.1"] },
    { "id": 13, "tasks": ["24.2"] },
    { "id": 14, "tasks": ["24.3"] },
    { "id": 15, "tasks": ["24.4"] },
    { "id": 16, "tasks": ["25.1"] },
    { "id": 17, "tasks": ["25.2"] },
    { "id": 18, "tasks": ["25.3"] },
    { "id": 19, "tasks": ["25.4"] },
    { "id": 20, "tasks": ["14.1", "14.2", "14.3", "14.4", "14.5"] },
    { "id": 21, "tasks": ["14.6"] },
    { "id": 22, "tasks": ["15.1"] },
    { "id": 23, "tasks": ["15.2", "15.3"] },
    { "id": 24, "tasks": ["15.4", "15.5"] },
    { "id": 25, "tasks": ["26.1"] },
    { "id": 26, "tasks": ["26.2"] },
    { "id": 27, "tasks": ["26.3"] },
    { "id": 28, "tasks": ["26.4"] },
    { "id": 29, "tasks": ["26.5"] },
    { "id": 30, "tasks": ["26.6"] },
    { "id": 31, "tasks": ["26.7"] },
    { "id": 32, "tasks": ["27.1"] },
    { "id": 33, "tasks": ["27.2", "27.3", "27.6"] },
    { "id": 34, "tasks": ["27.4", "27.6.1", "27.7"] },
    { "id": 35, "tasks": ["27.5", "27.8"] },
    { "id": 36, "tasks": ["27.9"] },
    { "id": 37, "tasks": ["28.1"] },
    { "id": 38, "tasks": ["28.2", "28.3"] },
    { "id": 39, "tasks": ["28.4"] },
    { "id": 40, "tasks": ["29.1", "29.2"] },
    { "id": 41, "tasks": ["29.3", "29.4", "29.5"] },
    { "id": 42, "tasks": ["29.6"] },
    { "id": 43, "tasks": ["30.1", "30.2"] },
    { "id": 44, "tasks": ["30.3", "30.4", "30.6", "30.7", "30.8"] },
    { "id": 45, "tasks": ["30.5"] },
    { "id": 46, "tasks": ["30.9"] },
    { "id": 47, "tasks": ["31.1"] },
    { "id": 48, "tasks": ["31.2", "31.3", "31.4"] },
    { "id": 49, "tasks": ["31.5"] },
    { "id": 50, "tasks": ["16.1"] },
    { "id": 51, "tasks": ["16.2", "17.1"] },
    { "id": 52, "tasks": ["17.2"] },
    { "id": 53, "tasks": ["17.3", "18.1"] },
    { "id": 54, "tasks": ["18.2", "18.3"] },
    { "id": 55, "tasks": ["18.4", "19.1", "19.2"] },
    { "id": 56, "tasks": ["19.3"] },
    { "id": 57, "tasks": ["20.1", "20.2"] },
    { "id": 58, "tasks": ["21.1"] },
    { "id": 59, "tasks": ["22.1"] },
    { "id": 60, "tasks": ["22.2"] },
    { "id": 61, "tasks": ["23.1"] },
    { "id": 62, "tasks": ["23.2"] },
    { "id": 63, "tasks": ["23.3", "23.4"] },
    { "id": 64, "tasks": ["32.1"] },
    { "id": 65, "tasks": ["32.2"] },
    { "id": 66, "tasks": ["32.3", "32.4", "32.5"] },
    { "id": 67, "tasks": ["32.6"] },
    { "id": 68, "tasks": ["33.1", "33.26"] },
    { "id": 69, "tasks": ["33.2", "33.3", "33.9"] },
    { "id": 70, "tasks": ["33.4", "33.5", "33.7", "33.10"] },
    { "id": 71, "tasks": ["33.6", "33.8", "33.11"] },
    { "id": 72, "tasks": ["33.12", "33.13"] },
    { "id": 73, "tasks": ["33.14"] },
    { "id": 74, "tasks": ["33.15", "33.16", "33.17", "33.19"] },
    { "id": 75, "tasks": ["33.18", "33.20"] },
    { "id": 76, "tasks": ["33.21", "33.22"] },
    { "id": 77, "tasks": ["33.23", "33.24", "33.25"] },
    { "id": 78, "tasks": ["33.27"] },
    { "id": 79, "tasks": ["33.28", "33.33", "33.35", "33.39"] },
    { "id": 80, "tasks": ["33.29", "33.34", "33.36"] },
    { "id": 81, "tasks": ["33.30", "33.31", "33.37"] },
    { "id": 82, "tasks": ["33.32", "33.38"] },
    { "id": 83, "tasks": ["33.40"] },
    { "id": 84, "tasks": ["33.41", "33.42", "33.45"] },
    { "id": 85, "tasks": ["33.43", "33.44", "33.46", "33.47"] },
    { "id": 86, "tasks": ["33.48"] },
    { "id": 90, "tasks": ["34.1", "34.6"] },
    { "id": 91, "tasks": ["34.2"] },
    { "id": 92, "tasks": ["34.3"] },
    { "id": 93, "tasks": ["34.4", "34.5"] },
    { "id": 94, "tasks": ["34.7"] },
    { "id": 95, "tasks": ["35.1", "35.29"] },
    { "id": 96, "tasks": ["35.2", "35.3", "35.11"] },
    { "id": 97, "tasks": ["35.4", "35.5", "35.7", "35.9", "35.12", "35.13", "35.15", "35.17"] },
    { "id": 98, "tasks": ["35.6", "35.8", "35.10", "35.14", "35.16", "35.18", "35.19"] },
    { "id": 99, "tasks": ["35.20", "35.21", "35.22", "35.24", "35.25", "35.26", "35.27"] },
    { "id": 100, "tasks": ["35.23", "35.28", "35.31", "35.32", "35.33"] },
    { "id": 101, "tasks": ["35.30"] },
    { "id": 102, "tasks": ["36.1", "36.3", "36.4"] },
    { "id": 103, "tasks": ["36.2", "36.5", "36.6"] },
    { "id": 104, "tasks": ["37.1"] },
    { "id": 105, "tasks": ["37.2", "37.3", "37.4", "37.14"] },
    { "id": 106, "tasks": ["37.5", "37.6", "37.8"] },
    { "id": 107, "tasks": ["37.7"] },
    { "id": 108, "tasks": ["37.9"] },
    { "id": 109, "tasks": ["37.10"] },
    { "id": 110, "tasks": ["37.11", "37.12"] },
    { "id": 111, "tasks": ["37.13"] },
    { "id": 112, "tasks": ["38.1"] },
    { "id": 113, "tasks": ["38.2", "38.4"] },
    { "id": 114, "tasks": ["38.3", "38.5", "38.12"] },
    { "id": 115, "tasks": ["38.6", "38.9", "38.13"] },
    { "id": 116, "tasks": ["38.7", "38.14"] },
    { "id": 117, "tasks": ["38.8", "38.10", "38.11"] },
    { "id": 118, "tasks": ["38.15", "38.16"] },
    { "id": 119, "tasks": ["38.17"] },
    { "id": 120, "tasks": ["38.18"] },
    { "id": 121, "tasks": ["39.1"] },
    { "id": 122, "tasks": ["39.2", "39.3", "39.4", "39.5"] },
    { "id": 123, "tasks": ["39.6"] },
    { "id": 124, "tasks": ["39.7", "39.8"] },
    { "id": 125, "tasks": ["39.9", "39.10"] },
    { "id": 126, "tasks": ["39.11"] },
    { "id": 127, "tasks": ["39.12"] },
    { "id": 128, "tasks": ["39.13"] },
    { "id": 129, "tasks": ["39.14"] },
    { "id": 130, "tasks": ["39.15"] },
    { "id": 131, "tasks": ["39.16", "39.17"] },
    { "id": 132, "tasks": ["39.18"] },
    { "id": 133, "tasks": ["39.19"] },
    { "id": 134, "tasks": ["39.20", "39.22"] },
    { "id": 135, "tasks": ["39.21", "39.23", "39.24", "39.25"] },
    { "id": 136, "tasks": ["39.26"] },
    { "id": 137, "tasks": ["39.27", "39.28"] },
    { "id": 138, "tasks": ["39.29"] },
    { "id": 139, "tasks": ["39.30"] },
    { "id": 140, "tasks": ["39.31", "39.33"] },
    { "id": 141, "tasks": ["39.32", "39.34"] },
    { "id": 142, "tasks": ["39.35"] },
    { "id": 143, "tasks": ["39.36", "39.38"] },
    { "id": 144, "tasks": ["39.37", "39.39"] },
    { "id": 145, "tasks": ["39.40"] },
    { "id": 146, "tasks": ["39.41"] },
    { "id": 147, "tasks": ["39.42", "39.43"] },
    { "id": 148, "tasks": ["39.44"] },
    { "id": 149, "tasks": ["39.45"] },
    { "id": 150, "tasks": ["39.46"] },
    { "id": 151, "tasks": ["39.47", "39.48"] },
    { "id": 152, "tasks": ["39.49"] },
    { "id": 153, "tasks": ["39.50", "39.51"] },
    { "id": 154, "tasks": ["39.52"] },
    { "id": 155, "tasks": ["40.1"] },
    { "id": 156, "tasks": ["40.2", "40.3", "40.4", "40.5"] },
    { "id": 157, "tasks": ["40.6", "40.8", "40.9", "40.10", "40.12", "40.14", "40.15"] },
    { "id": 158, "tasks": ["40.7", "40.11", "40.13", "40.16", "40.17", "40.18"] },
    { "id": 159, "tasks": ["40.19"] },
    { "id": 160, "tasks": ["40.21", "40.22"] },
    { "id": 161, "tasks": ["40.20"] }
  ]
}
```
