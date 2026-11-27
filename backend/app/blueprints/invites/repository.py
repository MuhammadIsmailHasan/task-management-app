from sqlalchemy.orm import selectinload

from app.extensions import db
from app.models import Board, BoardJoinRequest, User


def board_by_invite_token(token):
    if not token:
        return None
    return db.session.scalars(db.select(Board).where(Board.invite_token == token, Board.deleted_at.is_(None))).first()


def get_pending(board_id, user_id):
    return db.session.scalars(
        db.select(BoardJoinRequest).where(
            BoardJoinRequest.board_id == board_id, BoardJoinRequest.user_id == user_id, BoardJoinRequest.status == "pending"
        )
    ).first()


def add_request(board_id, user_id):
    req = BoardJoinRequest(board_id=board_id, user_id=user_id, status="pending")
    db.session.add(req)
    db.session.flush()
    return req


def get_request_for_update(request_id):
    return db.session.scalars(
        db.select(BoardJoinRequest).where(BoardJoinRequest.id == request_id).with_for_update()
    ).first()


def list_for_board(board_id, status):
    q = (
        db.select(
            BoardJoinRequest.id, BoardJoinRequest.status, BoardJoinRequest.created_at,
            User.id.label("user_id"), User.full_name, User.username, User.email, User.avatar_path,
        )
        .join(User, User.id == BoardJoinRequest.user_id)
        .where(BoardJoinRequest.board_id == board_id)
        .order_by(BoardJoinRequest.created_at, BoardJoinRequest.id)
    )
    if status != "all":
        q = q.where(BoardJoinRequest.status == status)
    return db.session.execute(q).all()


def pending_counts(board_ids):
    if not board_ids:
        return {}
    rows = db.session.execute(
        db.select(BoardJoinRequest.board_id, db.func.count(BoardJoinRequest.id))
        .where(BoardJoinRequest.board_id.in_(board_ids), BoardJoinRequest.status == "pending")
        .group_by(BoardJoinRequest.board_id)
    ).all()
    return dict(rows)


def staff_ids():
    return list(db.session.scalars(db.select(User.id).where(User.role.in_(("manager", "admin")))))


def delete_pending_of_user(user_id):
    from app.models import Notification

    ids = list(db.session.scalars(db.select(BoardJoinRequest.id).where(BoardJoinRequest.user_id == user_id, BoardJoinRequest.status == "pending")))
    if ids:
        db.session.execute(db.delete(Notification).where(Notification.join_request_id.in_(ids)))
        db.session.execute(db.delete(BoardJoinRequest).where(BoardJoinRequest.id.in_(ids)))
