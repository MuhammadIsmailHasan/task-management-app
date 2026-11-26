from flask_smorest import Blueprint

from app.blueprints.comments import service
from app.blueprints.comments.schema import CommentListQuerySchema, CommentPageSchema, CommentSchema, DeletedSchema, CreateCommentSchema, ReplySchema
from app.common.auth import current_actor, require_role
from app.common.docs import endpoint
from app.common.envelope import envelope
from app.common.responses import ok

USERS = ("member", "supervisor", "manager", "admin")
bp = Blueprint("comments", __name__, description="Comments, replies and the priority flag")


@bp.route("/cards/<card_id>/comments", methods=["POST"])
@endpoint(bp, "Add a comment", "Member, Supervisor, Manager with board access. Admin 403. No Token: 401.")
@require_role(*USERS)
@bp.arguments(CreateCommentSchema)
@bp.response(201, envelope(ReplySchema))
def create(data, card_id):
    c = service.create_comment(current_actor(), card_id, data)
    return ok(service.serialize_one(c, current_actor().role), "Comment created", 201)


@bp.route("/comments/<comment_id>/replies", methods=["POST"])
@endpoint(bp, "Reply to a top-level comment", "400 when the target is itself a reply. Increments the parent's reply_count.")
@require_role(*USERS)
@bp.arguments(CreateCommentSchema)
@bp.response(201, envelope(ReplySchema))
def reply(data, comment_id):
    c = service.reply(current_actor(), comment_id, data)
    return ok(service.serialize_one(c, current_actor().role), "Reply created", 201)


@bp.route("/comments/<comment_id>/priority", methods=["PATCH"])
@endpoint(bp, "Toggle the priority flag", "Manager only.", errors=(401, 403, 404))
@require_role("manager")
@bp.response(200, envelope(ReplySchema))
def priority(comment_id):
    c = service.toggle_priority(current_actor(), comment_id)
    return ok(service.serialize_one(c, "manager"), "Priority toggled")


@bp.route("/comments/<comment_id>", methods=["DELETE"])
@endpoint(bp, "Delete my comment", "Author only (403 for everyone else, Manager and Admin included). A top-level comment takes its replies with it; the log row keeps no text.", errors=(401, 403, 404))
@require_role(*USERS)
@bp.response(200, envelope(DeletedSchema))
def delete_comment(comment_id):
    return ok(service.delete_comment(current_actor(), comment_id), "Comment deleted")


@bp.route("/cards/<card_id>/comments", methods=["GET"])
@endpoint(bp, "List comments", "Priority comments first, then latest or popular; replies oldest first. Paged with `limit` and `offset` (all when `limit` is absent). Requires board access.")
@require_role(*USERS)
@bp.arguments(CommentListQuerySchema, location="query")
@bp.response(200, envelope(CommentPageSchema))
def list_comments(args, card_id):
    return ok(service.list_for_request(current_actor(), card_id, args.get("sort"), args.get("limit"), args["offset"]))
