import secrets

from app.blueprints.activity import repository as activity
from app.blueprints.auth import repository as users
from app.blueprints.boards import repository as repo
from app.blueprints.notifications import repository as notifications
from app.blueprints.boards.dto import DEFAULT_COLUMNS, clean_description, clean_name
from app.common import clock
from app.common.slug import is_valid_slug
from app.models.board import unique_slug
from app.common.errors import Forbidden, NotFound, Unauthorized, ValidationError
from app.common.ids import to_uuid
from flask import current_app

from app.extensions import db

PRIVILEGED = ("manager", "admin")


def is_owner(actor, board):
    return actor is not None and board.owner_id is not None and str(board.owner_id) == actor.id


def is_board_member(actor, board):
    return actor is not None and repo.is_member(board.id, to_uuid(actor.id))


def can_access(actor, board):
    if board is None or board.deleted_at is not None:
        return False
    if actor is None:
        return False
    return actor.role in PRIVILEGED or is_owner(actor, board) or is_board_member(actor, board)


def can_write_staff(actor, board):
    if actor is None or not can_access(actor, board):
        return False
    if actor.role in PRIVILEGED:
        return True
    return actor.role == "supervisor" and (is_owner(actor, board) or is_board_member(actor, board))


def require_access(actor, board):
    if actor is None:
        raise Unauthorized("Authentication required")
    if board is None or board.deleted_at is not None:
        raise NotFound("Board not found")
    if not can_access(actor, board):
        raise Forbidden("No access to this board")
    return board


def require_staff(actor, board):
    require_access(actor, board)
    if not can_write_staff(actor, board):
        raise Forbidden("Staff access required")


def load_board(actor, board_id):
    bid = to_uuid(board_id)
    board = repo.get_by_id(bid) if bid else None
    return require_access(actor, board)


def board_detail_by_slug(actor, slug):
    if actor is None:
        raise Unauthorized("Authentication required")
    board = repo.get_by_slug(slug) if is_valid_slug(slug) else None
    if board is None:
        raise NotFound("Board not found")
    require_access(actor, board)
    return repo.get_detail(board.id)


def board_detail(actor, board_id):
    bid = to_uuid(board_id)
    board = repo.get_detail(bid) if bid else None
    return require_access(actor, board)


def reload_detail(board):
    return repo.get_detail(board.id)


def create_board(actor, data):
    name = clean_name(data.get("name"))
    board = repo.create_board(name, description=clean_description(data.get("description")))
    for i, col_name in enumerate(DEFAULT_COLUMNS):
        repo.add_column(board.id, col_name, float(i))
    activity.add(to_uuid(actor.id), "board.created", "board", board.id, {"name": name})
    db.session.commit()
    return board


def update_board(actor, board_id, data):
    board = load_board(actor, board_id)
    meta = {}
    privileged = actor.role in PRIVILEGED
    if "owner_id" in data:
        if not privileged:
            raise Forbidden("Only Manager or Admin can change the owner")
        new_owner = data["owner_id"]
        if new_owner is None:
            board.owner_id = None
        else:
            uid = to_uuid(new_owner)
            user = users.get_by_id(uid) if uid else None
            if user is None or user.role != "supervisor":
                raise ValidationError("owner_id must reference a user with role supervisor")
            if board.owner_id != user.id:
                _owner_changed(actor, board, user)
            board.owner_id = user.id
        meta["owner_id"] = str(board.owner_id) if board.owner_id else None
        activity.add(to_uuid(actor.id), "board.owner_changed", "board", board.id, {"owner_id": meta["owner_id"]})
    if "name" in data or "description" in data:
        if not (privileged or is_owner(actor, board)):
            raise Forbidden("Not allowed to rename the board")
    if "name" in data:
        board.name = clean_name(data["name"])
        board.slug = unique_slug(db.session.connection(), board.name, exclude_id=board.id)
        activity.add(to_uuid(actor.id), "board.updated", "board", board.id, {"name": board.name})
    if "description" in data:
        board.description = clean_description(data["description"])
        activity.add(to_uuid(actor.id), "board.updated", "board", board.id, {"name": board.name, "description_changed": True})
    db.session.commit()
    return board


def _unassign_cards(actor, board, user_id):
    for card in repo.assigned_cards(board.id, user_id):
        card.assignee_id = None
        activity.add(to_uuid(actor.id), "card.unassigned", "card", card.id, {"card_title": card.title, "board_id": str(board.id)})


def _owner_changed(actor, board, new_owner):
    previous = board.owner_id
    if previous is not None and repo.get_member(board.id, previous) is None:
        _unassign_cards(actor, board, previous)
    notifications.add_board(new_owner.id, board.id, "board_added", actor_id=to_uuid(actor.id))


def _manager_only(actor, board_id, include_deleted=False):
    if actor.role not in PRIVILEGED:
        raise Forbidden("Manager or Admin only")
    bid = to_uuid(board_id)
    board = repo.get_by_id(bid) if bid else None
    if board is None:
        raise NotFound("Board not found")
    return board


def set_archived(actor, board_id, archived):
    board = _manager_only(actor, board_id)
    board.archived_at = clock.now() if archived else None
    activity.add(to_uuid(actor.id), "board.archived" if archived else "board.unarchived", "board", board.id)
    db.session.commit()
    return board


def soft_delete(actor, board_id):
    board = _manager_only(actor, board_id)
    board.deleted_at = clock.now()
    activity.add(to_uuid(actor.id), "board.deleted", "board", board.id)
    db.session.commit()


def list_boards(actor, q=None, sort="updated_at", order="desc"):
    boards = repo.list_visible(actor, (q or "").strip() or None, sort, order)
    counts = repo.counts_for([b.id for b in boards], clock.today(current_app.config["APP_TIMEZONE"]))
    return boards, counts


def require_manage_members(actor, board):
    if not (actor.role in PRIVILEGED or is_owner(actor, board)):
        raise Forbidden("Owner, Manager or Admin only")


def list_members(actor, board_id, with_email=False, assignable=False):
    board = load_board(actor, board_id)
    if with_email and not can_write_staff(actor, board):
        raise Forbidden("Staff access required")
    return repo.list_members(board, assignable=assignable)


def member_candidates(actor, board_id, search):
    board = load_board(actor, board_id)
    if len((search or "").strip()) < 2:
        raise ValidationError("search must be at least 2 characters", details={"search": ["search must be at least 2 characters"]})
    return repo.candidates(board, search, 20)


def add_member(actor, board_id, data):
    board = load_board(actor, board_id)
    uid = to_uuid(data.get("user_id"))
    user = users.get_by_id(uid) if uid else None
    if user is None:
        raise NotFound("User not found")
    if user.role not in ("member", "supervisor"):
        raise ValidationError(
            "Only Member and Supervisor accounts can be added", details={"user_id": ["Managers and Admins already see every board"]}
        )
    if not (user.is_active and user.is_available):
        raise ValidationError("This person is not available to be added", details={"user_id": ["The user is inactive or unavailable"]})
    if repo.get_member(board.id, user.id):
        from app.common.errors import Conflict

        raise Conflict("User is already a member")
    add_member_row(actor, board, user)
    db.session.commit()
    return user


def add_member_row(actor, board, user, via=None):
    if repo.get_member(board.id, user.id) is None:
        repo.add_member(board.id, user.id)
        meta = {"user_id": str(user.id)}
        if via:
            meta["via"] = via
        activity.add(to_uuid(actor.id), "board.member_added", "board", board.id, meta)
    notifications.add_board(user.id, board.id, "board_added", actor_id=to_uuid(actor.id))


def remove_member(actor, board_id, user_id):
    board = load_board(actor, board_id)
    require_manage_members(actor, board)
    uid = to_uuid(user_id)
    member = repo.get_member(board.id, uid) if uid else None
    if member is None:
        raise NotFound("Member not found")
    repo.delete_member(member)
    _unassign_cards(actor, board, uid)
    activity.add(to_uuid(actor.id), "board.member_removed", "board", board.id, {"user_id": str(uid)})
    db.session.commit()


def _share_manager(actor, board_id):
    board = load_board(actor, board_id)
    if actor.role not in PRIVILEGED:
        raise Forbidden("Only a Manager or an Admin can manage the Public link")
    return board


def _share_view(board):
    token = board.share_token
    return {"enabled": token is not None, "token": token, "path": f"/app/shared/{token}" if token else None}


def get_share(actor, board_id):
    return _share_view(_share_manager(actor, board_id))


def enable_share(actor, board_id):
    board = _share_manager(actor, board_id)
    if board.share_token is None:
        board.share_token = secrets.token_urlsafe(32)
        activity.add(to_uuid(actor.id), "board.share_enabled", "board", board.id, {"board_name": board.name})
        db.session.commit()
    return _share_view(board)


def regenerate_share(actor, board_id):
    board = _share_manager(actor, board_id)
    board.share_token = secrets.token_urlsafe(32)
    activity.add(to_uuid(actor.id), "board.share_regenerated", "board", board.id, {"board_name": board.name})
    db.session.commit()
    return _share_view(board)


def disable_share(actor, board_id):
    board = _share_manager(actor, board_id)
    if board.share_token is not None:
        board.share_token = None
        activity.add(to_uuid(actor.id), "board.share_disabled", "board", board.id, {"board_name": board.name})
        db.session.commit()
    return _share_view(board)
