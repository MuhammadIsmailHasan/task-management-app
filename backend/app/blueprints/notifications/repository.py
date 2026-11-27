from flask import current_app

from app.common import clock
from app.extensions import db
from app.models import Board, Card, Column, Notification, NotificationPreference, User


def _insert():
    if db.engine.dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    return insert


def insert_ignore(user_id, card_id, type_, notify_date):
    import uuid

    stmt = (
        _insert()(Notification)
        .values(id=uuid.uuid4(), user_id=user_id, card_id=card_id, type=type_, notify_date=notify_date, is_read=False, created_at=clock.now())
        .on_conflict_do_nothing()
    )
    db.session.execute(stmt)


def preference_enabled(user_id, type_):
    return db.session.scalar(db.select(NotificationPreference.enabled).where(NotificationPreference.user_id == user_id, NotificationPreference.type == type_)) is not False


def notify_assignee(card, type_, actor_id, action=None):
    import uuid

    uid = card.assignee_id
    if uid is None or (actor_id is not None and uid == actor_id):
        return None
    recipient = db.session.get(User, uid)
    if recipient is None or not recipient.is_active or not preference_enabled(uid, type_):
        return None
    row = Notification(
        id=uuid.uuid4(), user_id=uid, type=type_, card_id=card.id, board_id=card.board_id, actor_id=actor_id, action=action,
        notify_date=clock.today(current_app.config["APP_TIMEZONE"]), is_read=False,
    )
    db.session.add(row)
    return row


def add_board(user_id, board_id, type_, actor_id=None, join_request_id=None):
    import uuid

    stmt = (
        _insert()(Notification)
        .values(
            id=uuid.uuid4(), user_id=user_id, type=type_, card_id=None, board_id=board_id, actor_id=actor_id,
            join_request_id=join_request_id, notify_date=clock.today(current_app.config["APP_TIMEZONE"]), is_read=False, created_at=clock.now(),
        )
        .on_conflict_do_nothing()
    )
    db.session.execute(stmt)


def cards_due(today):
    return Card.query.filter(Card.end_date == today, Card.deleted_at.is_(None), Card.assignee_id.isnot(None)).all()


def list_for_user(user_id, limit=None, before=None, unread=False):
    from app.common.errors import ValidationError

    base = Notification.query.filter_by(user_id=user_id)
    query = base.order_by(Notification.created_at.desc(), Notification.id)
    if unread:
        query = query.filter(Notification.is_read.is_(False))
    if before is not None:
        anchor = base.filter(Notification.id == before).first()
        if anchor is None:
            raise ValidationError("before must be one of your notifications")
        query = query.filter(
            db.or_(
                Notification.created_at < anchor.created_at,
                db.and_(Notification.created_at == anchor.created_at, Notification.id > anchor.id),
            )
        )
    return query.limit(limit).all() if limit else query.all()


def unread_count(user_id):
    return Notification.query.filter_by(user_id=user_id, is_read=False).count()


def get_for_user(notification_id, user_id):
    return Notification.query.filter_by(id=notification_id, user_id=user_id).first()


def mark_all_read(user_id):
    Notification.query.filter_by(user_id=user_id, is_read=False).update({"is_read": True})


def card_context(card_ids):
    if not card_ids:
        return {}
    rows = db.session.execute(
        db.select(Card.id, Card.title, Card.board_id).where(Card.id.in_(card_ids))
    ).all()
    return {r.id: (r.title, r.board_id) for r in rows}


def board_slugs(board_ids):
    if not board_ids:
        return {}
    return dict(db.session.execute(db.select(Board.id, Board.slug).where(Board.id.in_(board_ids))).all())


def board_names(board_ids):
    if not board_ids:
        return {}
    return dict(db.session.execute(db.select(Board.id, Board.name).where(Board.id.in_(board_ids))).all())


def user_names(user_ids):
    if not user_ids:
        return {}
    return dict(db.session.execute(db.select(User.id, User.full_name).where(User.id.in_(user_ids))).all())
