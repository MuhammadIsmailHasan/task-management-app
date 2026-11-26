from flask_smorest import Blueprint

from app.blueprints.boards.dto import serialize_column
from app.blueprints.boards.schema import ColumnSchema, CreateColumnSchema
from app.blueprints.columns import service
from app.blueprints.columns.schema import MoveColumnSchema, RenameColumnSchema
from app.common.auth import current_actor, require_role
from app.common.docs import endpoint
from app.common.envelope import NullEnvelopeSchema, envelope
from app.common.responses import ok

bp = Blueprint("columns", __name__, description="Board columns")
USERS = ("member", "supervisor", "manager", "admin")
WHO = "Board owner, Manager or Admin."


@bp.route("/boards/<board_id>/columns", methods=["POST"])
@endpoint(bp, "Add a column", f"{WHO} Appended with order = max + 1. A name is unique on the board (409 CONFLICT) and never `Done` (409 COLUMN_LOCKED).", errors=(400, 401, 403, 404, 409))
@require_role(*USERS)
@bp.arguments(CreateColumnSchema)
@bp.response(201, envelope(ColumnSchema))
def create_column(data, board_id):
    return ok(serialize_column(service.create(current_actor(), board_id, data)), "Column created", 201)


@bp.route("/columns/<column_id>", methods=["PATCH"])
@endpoint(bp, "Rename a column", f"{WHO} The Done column cannot be renamed and no column can be renamed to Done: 409 COLUMN_LOCKED.", errors=(400, 401, 403, 404, 409))
@require_role(*USERS)
@bp.arguments(RenameColumnSchema)
@bp.response(200, envelope(ColumnSchema))
def rename_column(data, column_id):
    return ok(serialize_column(service.rename(current_actor(), column_id, data)), "Column renamed")


@bp.route("/columns/<column_id>/move", methods=["PATCH"])
@endpoint(bp, "Reorder a column", f"{WHO} Moves the column to a 0-based position and renumbers the board's columns. The Done column may move.", errors=(400, 401, 403, 404))
@require_role(*USERS)
@bp.arguments(MoveColumnSchema)
@bp.response(200, envelope(ColumnSchema))
def move_column(data, column_id):
    return ok(serialize_column(service.move(current_actor(), column_id, data)), "Column moved")


@bp.route("/columns/<column_id>", methods=["DELETE"])
@endpoint(bp, "Delete a column", f"{WHO} 409 COLUMN_NOT_EMPTY (with details.count) while it holds cards that are not archived; 409 COLUMN_LOCKED for Done. Archived cards have no column and never block.", errors=(401, 403, 404, 409))
@require_role(*USERS)
@bp.response(200, NullEnvelopeSchema)
def delete_column(column_id):
    service.delete(current_actor(), column_id)
    return ok(None, "Column deleted")
