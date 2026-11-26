from flask_smorest import Blueprint

from app.blueprints.activity import repository as activity
from app.blueprints.activity.schema import ActivitySchema
from app.blueprints.auth.dto import serialize_candidate, serialize_member
from app.blueprints.auth.schema import MemberSchema
from app.blueprints.boards import service
from app.blueprints.boards.dto import serialize_board
from app.blueprints.boards.schema import (
    AddMemberSchema,
    BoardMemberWithEmailSchema,
    CandidateQuerySchema,
    CandidateSchema,
    MembersQuerySchema,
    ShareSchema,
    BoardListQuerySchema,
    BoardSchema,
    CreateBoardSchema,
    UpdateBoardSchema,
)
from app.common.auth import current_actor, require_role
from app.common.docs import endpoint
from app.common.paging import PageQuerySchema
from app.common.envelope import NullEnvelopeSchema, envelope
from app.common.errors import Forbidden
from app.common.responses import ok

USERS = ("member", "supervisor", "manager", "admin")
bp = Blueprint("boards", __name__, description="Boards, archive and members")
ANY_USER = ("member", "supervisor", "manager", "admin")


@bp.route("/boards", methods=["POST"])
@endpoint(bp, "Create a board", "Manager or Admin. Seeds Todo, In Progress, Review, Revision, Done.", errors=(400, 401, 403))
@require_role("manager", "admin")
@bp.arguments(CreateBoardSchema)
@bp.response(201, envelope(BoardSchema))
def create_board(data):
    board = service.reload_detail(service.create_board(current_actor(), data))
    return ok(serialize_board(board, board.columns), "Board created", 201)


@bp.route("/boards", methods=["GET"])
@endpoint(bp, "List my boards", "Owner or member Boards for Member and Supervisor; every Board for Manager and Admin. No Token: 401.", errors=(401,))
@require_role(*USERS)
@bp.arguments(BoardListQuerySchema, location="query")
@bp.response(200, envelope(BoardSchema, many=True))
def list_boards(args):
    boards, counts = service.list_boards(current_actor(), args.get("q"), args["sort"], args["order"])
    return ok([serialize_board(b, counts=counts.get(b.id)) for b in boards])


@bp.route("/boards/<board_id>", methods=["GET"])
@endpoint(bp, "Get a board with its columns", "Requires board access: 401 without a Token, 403 without access.")
@require_role(*USERS)
@bp.response(200, envelope(BoardSchema))
def get_board(board_id):
    board = service.board_detail(current_actor(), board_id)
    return ok(serialize_board(board, board.columns, current_actor()))


@bp.route("/boards/slug/<slug>", methods=["GET"])
@endpoint(bp, "Get a board by its slug", "Same payload and rules as GET /boards/{id}. 401 without a Token, 403 without access, 404 for an unknown, former, or deleted slug.")
@require_role(*USERS)
@bp.response(200, envelope(BoardSchema))
def get_board_by_slug(slug):
    board = service.board_detail_by_slug(current_actor(), slug)
    return ok(serialize_board(board, board.columns, current_actor()))


@bp.route("/boards/<board_id>", methods=["PATCH"])
@endpoint(bp, "Update name, description or owner", "owner_id: Manager or Admin, new owner must be a supervisor. name and description: Manager, Admin or owner.", errors=(400, 401, 403, 404))
@require_role(*ANY_USER)
@bp.arguments(UpdateBoardSchema)
@bp.response(200, envelope(BoardSchema))
def update_board(data, board_id):
    board = service.reload_detail(service.update_board(current_actor(), board_id, data))
    return ok(serialize_board(board, board.columns), "Board updated")


@bp.route("/boards/<board_id>/archive", methods=["POST"])
@endpoint(bp, "Archive a board", "Manager or Admin.", errors=(401, 403, 404))
@require_role("manager", "admin")
@bp.response(200, envelope(BoardSchema))
def archive(board_id):
    return ok(serialize_board(service.set_archived(current_actor(), board_id, True)), "Board archived")


@bp.route("/boards/<board_id>/unarchive", methods=["POST"])
@endpoint(bp, "Unarchive a board", "Manager or Admin.", errors=(401, 403, 404))
@require_role("manager", "admin")
@bp.response(200, envelope(BoardSchema))
def unarchive(board_id):
    return ok(serialize_board(service.set_archived(current_actor(), board_id, False)), "Board unarchived")


@bp.route("/boards/<board_id>", methods=["DELETE"])
@endpoint(bp, "Soft-delete a board", "Manager or Admin. Sets deleted_at; nothing is removed.", errors=(401, 403, 404))
@require_role("manager", "admin")
@bp.response(200, NullEnvelopeSchema)
def delete_board(board_id):
    service.soft_delete(current_actor(), board_id)
    return ok(None, "Board deleted")


@bp.route("/boards/<board_id>/members", methods=["GET"])
@endpoint(bp, "List board members", "Owner first, once, with `is_owner`. Requires board access. `?include=email` adds emails and needs board staff access (403 otherwise). `?assignable=true` lists only active and available people.")
@require_role(*USERS)
@bp.arguments(MembersQuerySchema, location="query")
@bp.response(200, envelope(BoardMemberWithEmailSchema, many=True))
def members(args, board_id):
    with_email = args.get("include") == "email"
    users = service.list_members(current_actor(), board_id, with_email, args.get("assignable") == "true")
    return ok([{**(serialize_candidate(u) if with_email else serialize_member(u)), "is_owner": owner, "role": u.role, "is_active": u.is_active, "is_available": u.is_available} for u, owner in users])


@bp.route("/boards/<board_id>/candidates", methods=["GET"])
@endpoint(bp, "Search users who can be added to a board", "Manager or Admin. Member and Supervisor accounts only, at most 20 non-members matching `search` (at least 2 characters) on name, username prefix or exact email.")
@require_role("manager", "admin")
@bp.arguments(CandidateQuerySchema, location="query")
@bp.response(200, envelope(CandidateSchema, many=True))
def candidates(query, board_id):
    users = service.member_candidates(current_actor(), board_id, query.get("search"))
    return ok([serialize_candidate(u) for u in users])


@bp.route("/boards/<board_id>/members", methods=["POST"])
@endpoint(bp, "Add a board member", "Manager or Admin, Member and Supervisor accounts only (400 otherwise). 409 when already a member. Notifies the user.", errors=(400, 401, 403, 404, 409))
@require_role("manager", "admin")
@bp.arguments(AddMemberSchema)
@bp.response(201, envelope(MemberSchema))
def add_member(data, board_id):
    return ok(serialize_member(service.add_member(current_actor(), board_id, data)), "Member added", 201)


@bp.route("/boards/<board_id>/members/<user_id>", methods=["DELETE"])
@endpoint(bp, "Remove a board member", "Owner, Manager or Admin.", errors=(401, 403, 404))
@require_role(*ANY_USER)
@bp.response(200, NullEnvelopeSchema)
def remove_member(board_id, user_id):
    service.remove_member(current_actor(), board_id, user_id)
    return ok(None, "Member removed")


@bp.route("/boards/<board_id>/activity", methods=["GET"])
@endpoint(bp, "Board activity feed", "Requires board access. Paged with `limit` and `before`.")
@require_role(*USERS)
@bp.arguments(PageQuerySchema, location="query")
@bp.response(200, envelope(ActivitySchema, many=True))
def board_activity(page, board_id):
    actor = current_actor()
    board = service.load_board(actor, board_id)
    return ok(activity.serialize_many(activity.for_board(board.id, page["limit"], page.get("before"))))


_SHARE_ERRORS = (401, 403, 404)


@bp.route("/boards/<board_id>/share", methods=["GET"])
@endpoint(bp, "Get the Public link state", "Manager or Admin only.", errors=_SHARE_ERRORS)
@require_role("manager", "admin")
@bp.response(200, envelope(ShareSchema))
def get_share(board_id):
    return ok(service.get_share(current_actor(), board_id))


@bp.route("/boards/<board_id>/share", methods=["POST"])
@endpoint(bp, "Enable the share link", "Creates a 256-bit token when sharing is off; returns the existing one otherwise.", errors=_SHARE_ERRORS)
@require_role("manager", "admin")
@bp.response(200, envelope(ShareSchema))
def enable_share(board_id):
    return ok(service.enable_share(current_actor(), board_id), "Share link enabled")


@bp.route("/boards/<board_id>/share/regenerate", methods=["POST"])
@endpoint(bp, "Replace the share token", "The previous link stops working at once.", errors=_SHARE_ERRORS)
@require_role("manager", "admin")
@bp.response(200, envelope(ShareSchema))
def regenerate_share(board_id):
    return ok(service.regenerate_share(current_actor(), board_id), "Share link replaced")


@bp.route("/boards/<board_id>/share", methods=["DELETE"])
@endpoint(bp, "Disable the share link", "Idempotent: 200 when sharing is already off.", errors=_SHARE_ERRORS)
@require_role("manager", "admin")
@bp.response(200, envelope(ShareSchema))
def disable_share(board_id):
    return ok(service.disable_share(current_actor(), board_id), "Share link disabled")
