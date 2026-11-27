from app.blueprints.activity import repository as activity
from app.blueprints.boards import repository as boards_repo
from app.blueprints.boards import service as boards
from app.blueprints.boards.dto import clean_name
from app.blueprints.columns import repository as repo
from app.common import clock
from app.common.errors import Conflict, ColumnLocked, ColumnNotEmpty, Forbidden, NotFound, Unauthorized, ValidationError
from app.common.ids import to_uuid
from app.extensions import db

DONE = "Done"


def _is_done(name):
    return name.strip().lower() == DONE.lower()


def _manager(actor, board):
    if actor is None:
        raise Unauthorized("Authentication required")
    boards.require_access(actor, board)
    if actor.role in boards.PRIVILEGED or boards.is_owner(actor, board):
        return
    raise Forbidden("Only the board owner, a Manager or an Admin can manage columns")


def _column(actor, column_id):
    cid = to_uuid(column_id)
    column = repo.get(cid) if cid else None
    board = boards_repo.get_by_id(column.board_id) if column is not None else None
    if column is None or board is None:
        raise NotFound("Column not found")
    _manager(actor, board)
    return column, board


def _check_name(board, name, exclude_id=None):
    if _is_done(name):
        raise ColumnLocked("The Done column is locked: it cannot be created again or renamed to")
    for other in repo.siblings(board.id):
        if other.id != exclude_id and other.name.strip().lower() == name.strip().lower():
            raise Conflict("A column with this name already exists", details={"name": ["A column with this name already exists"]})


def create(actor, board_id, data):
    board = boards.load_board(actor, board_id)
    _manager(actor, board)
    name = clean_name(data.get("name"))
    _check_name(board, name)
    current = boards_repo.max_column_order(board.id)
    col = boards_repo.add_column(board.id, name, 0.0 if current is None else current + 1)
    activity.add(to_uuid(actor.id), "column.created", "column", col.id, {"board_id": str(board.id), "name": name})
    board.updated_at = clock.now()
    db.session.commit()
    return col


def rename(actor, column_id, data):
    column, board = _column(actor, column_id)
    name = clean_name(data.get("name"))
    if _is_done(column.name):
        raise ColumnLocked("The Done column is locked")
    _check_name(board, name, exclude_id=column.id)
    if name != column.name:
        activity.add(to_uuid(actor.id), "column.renamed", "column", column.id, {"board_id": str(board.id), "from": column.name, "to": name})
        column.name = name
        board.updated_at = clock.now()
    db.session.commit()
    return column


def move(actor, column_id, data):
    column, board = _column(actor, column_id)
    ordered = list(repo.siblings(board.id))
    position = data.get("position")
    if not isinstance(position, int) or isinstance(position, bool) or not 0 <= position < len(ordered):
        raise ValidationError("position must be between 0 and the number of columns minus 1", details={"position": ["out of range"]})
    old = ordered.index(column)
    ordered.remove(column)
    ordered.insert(position, column)
    for i, col in enumerate(ordered):
        col.order = float(i)
    if old != position:
        activity.add(to_uuid(actor.id), "column.moved", "column", column.id, {"board_id": str(board.id), "name": column.name, "from": old, "to": position})
        board.updated_at = clock.now()
    db.session.commit()
    return column


def delete(actor, column_id):
    column, board = _column(actor, column_id)
    if _is_done(column.name):
        raise ColumnLocked("The Done column is locked")
    count = repo.active_card_count(column.id)
    if count:
        raise ColumnNotEmpty(f"Move or archive its {count} card{'s' if count != 1 else ''} first.", details={"count": count})
    repo.detach_deleted_cards(column.id)
    activity.add(to_uuid(actor.id), "column.deleted", "board", board.id, {"board_id": str(board.id), "name": column.name})
    repo.delete(column)
    board.updated_at = clock.now()
    db.session.commit()
