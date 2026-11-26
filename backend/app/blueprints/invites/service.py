"""Invite_Link and Join_Requests (V12, Decision AA). The token never reaches a log line or Activity_Log metadata; no Email is copied."""
import secrets

from sqlalchemy.exc import IntegrityError

from app.blueprints.activity import repository as activity
from app.blueprints.auth import repository as users
from app.blueprints.boards import repository as boards_repo
from app.blueprints.boards import service as boards
from app.blueprints.invites import repository as repo
from app.blueprints.notifications import repository as notifications
from app.common import clock
from app.common.errors import Conflict, Forbidden, NotFound, ValidationError
from app.common.identities import Identity, avatar_urls
from app.common.ids import to_uuid
from app.extensions import db

PRIVILEGED = boards.PRIVILEGED


def _view(board):
    token = board.invite_token
    return {"enabled": token is not None, "token": token, "path": f"/app/invite/{token}" if token else None}


def _manage(actor, board_id):
    board = boards.load_board(actor, board_id)
    if not (actor.role in PRIVILEGED or boards.is_owner(actor, board)):
        raise Forbidden("Only the board owner, a Manager or an Admin can manage the invite link")
    return board


def get_invite(actor, board_id):
    return _view(_manage(actor, board_id))


def enable(actor, board_id):
    board = _manage(actor, board_id)
    if board.invite_token is None:
        board.invite_token = secrets.token_urlsafe(32)
        activity.add(to_uuid(actor.id), "board.invite_enabled", "board", board.id, {"board_name": board.name})
        db.session.commit()
    return _view(board)


def regenerate(actor, board_id):
    board = _manage(actor, board_id)
    board.invite_token = secrets.token_urlsafe(32)
    activity.add(to_uuid(actor.id), "board.invite_regenerated", "board", board.id, {"board_name": board.name})
    db.session.commit()
    return _view(board)


def disable(actor, board_id):
    board = _manage(actor, board_id)
    if board.invite_token is not None:
        board.invite_token = None
        activity.add(to_uuid(actor.id), "board.invite_disabled", "board", board.id, {"board_name": board.name})
        db.session.commit()
    return _view(board)


def _board(token):
    board = repo.board_by_invite_token(token)
    if board is None:
        raise NotFound("Not found")  # one answer for unknown, disabled, replaced and deleted (INV-07)
    return board


def resolve(actor, token):
    board = _board(token)
    uid = to_uuid(actor.id)
    pending = repo.get_pending(board.id, uid)
    if actor.role in PRIVILEGED:
        state = "staff"
    elif boards.is_owner(actor, board) or boards_repo.is_member(board.id, uid):
        state = "member"
    elif pending is not None:
        state = "pending"
    else:
        state = "can_request"
    return {
        "board": {"id": str(board.id), "slug": board.slug, "name": board.name, "description": board.description},
        "state": state,
        "request": {"id": str(pending.id), "status": pending.status} if pending is not None else None,
    }


def create_request(actor, token):
    board = _board(token)
    if actor.role in PRIVILEGED:
        raise ValidationError("Managers and Admins already have access", details={"role": ["Managers and Admins already have access"]})
    uid = to_uuid(actor.id)
    conflict = Conflict("You already have access or a pending request", details={"board": ["Already a member or pending"]})
    if boards.is_owner(actor, board) or boards_repo.is_member(board.id, uid) or repo.get_pending(board.id, uid):
        raise conflict
    try:
        req = repo.add_request(board.id, uid)
        activity.add(uid, "board.join_requested", "board", board.id, {"board_name": board.name, "join_request_id": str(req.id)})
        recipients = set(repo.staff_ids())
        if board.owner_id is not None:
            recipients.add(board.owner_id)
        for rid in recipients:
            notifications.add_board(rid, board.id, "board_join_requested", actor_id=uid, join_request_id=req.id)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise conflict
    return {"id": str(req.id), "board_id": str(board.id), "status": req.status, "created_at": req.created_at}


def list_requests(actor, board_id, status="pending"):
    board = _manage(actor, board_id)
    rows = repo.list_for_board(board.id, status)
    idents = {r.user_id: Identity(r.full_name, r.avatar_path) for r in rows}
    urls = avatar_urls(idents, clock.now())
    return [
        {
            "id": str(r.id), "status": r.status, "created_at": r.created_at,
            "user": {
                "id": str(r.user_id), "full_name": r.full_name, "username": r.username, "email": r.email,
                "avatar_url": urls[r.user_id],
            },
        }
        for r in rows
    ]


def decide(actor, request_id, status):
    rid = to_uuid(request_id)
    req = repo.get_request_for_update(rid) if rid else None
    if req is None:
        raise NotFound("Join request not found")
    board = boards_repo.get_by_id(req.board_id)
    if board is None:
        raise NotFound("Join request not found")
    if req.status != "pending":
        raise Conflict("This request was already decided")
    requester = users.get_by_id(req.user_id)
    aid = to_uuid(actor.id)
    req.status = status
    req.decided_by = aid
    if status == "approved":
        boards.add_member_row(actor, board, requester, via="join_request")
        db.session.flush()
    else:
        activity.add(aid, "board.join_rejected", "board", board.id, {"board_name": board.name, "join_request_id": str(req.id)})
        notifications.add_board(req.user_id, board.id, "board_join_rejected", actor_id=aid, join_request_id=req.id)
    db.session.commit()
    return {"id": str(req.id), "board_id": str(board.id), "status": req.status, "created_at": req.created_at}
