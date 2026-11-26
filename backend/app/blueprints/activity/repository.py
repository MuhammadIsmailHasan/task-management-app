"""Append-only: `add` is the only write function."""
from app.common import clock
from app.extensions import db
from app.models import ActivityLog, Card, Column, User


def add(actor_id, action, target_type, target_id, metadata=None):
    row = ActivityLog(
        actor_id=actor_id, action=action, target_type=target_type, target_id=target_id, metadata_=metadata,
        created_at=clock.now(),
    )
    db.session.add(row)
    return row


def _page(query, limit, before):
    """Newest first, then id. `before` is a row of this feed; rows strictly after it in that order are returned."""
    from app.common.errors import ValidationError

    query = query.order_by(ActivityLog.created_at.desc(), ActivityLog.id)
    if before is not None:
        anchor = query.filter(ActivityLog.id == before).first()
        if anchor is None:
            raise ValidationError("before must be a row of this activity feed")
        query = query.filter(
            db.or_(
                ActivityLog.created_at < anchor.created_at,
                db.and_(ActivityLog.created_at == anchor.created_at, ActivityLog.id > anchor.id),
            )
        )
    return query.limit(limit).all() if limit else query.all()


def for_card(card_id, limit=None, before=None):
    return _page(ActivityLog.query.filter_by(target_type="card", target_id=card_id), limit, before)


def for_board(board_id, limit=None, before=None):
    column_ids = db.select(Column.id).where(Column.board_id == board_id)
    card_ids = db.select(Card.id).where(Card.board_id == board_id)
    cond = db.or_(
        db.and_(ActivityLog.target_type == "board", ActivityLog.target_id == board_id),
        db.and_(ActivityLog.target_type == "column", ActivityLog.target_id.in_(column_ids)),
        db.and_(ActivityLog.target_type == "card", ActivityLog.target_id.in_(card_ids)),
    )
    return _page(ActivityLog.query.filter(cond), limit, before)


def actor_names(rows):
    """Display names of the actors of these rows: one query whatever the row count."""
    ids = {r.actor_id for r in rows}
    if not ids:
        return {}
    return dict(db.session.execute(db.select(User.id, User.full_name).where(User.id.in_(ids))).all())


def serialize_many(rows):
    names = actor_names(rows)
    return [serialize(r, names) for r in rows]


def serialize(row, names=None):
    return {
        "id": str(row.id),
        "actor_id": str(row.actor_id),
        "actor_name": (names or {}).get(row.actor_id),
        "action": row.action,
        "target_type": row.target_type,
        "target_id": str(row.target_id),
        "metadata": row.metadata_,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }
