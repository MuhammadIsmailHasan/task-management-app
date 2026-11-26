from app.extensions import db
from app.models import Board, Card, Column, User

LIMIT = 50


def _open_cards():
    """Cards that count as open work: in a Column other than Done, not archived, not deleted, on a Board that is not deleted."""
    return db.and_(Card.deleted_at.is_(None), Card.archived_at.is_(None), Column.name != "Done", Board.deleted_at.is_(None))


def open_assigned(user_id):
    """(total, rows) of the Cards assigned to this user that are still open, up to 50 rows."""
    base = db.select(Card).join(Column, Card.column_id == Column.id).join(Board, Board.id == Card.board_id).where(Card.assignee_id == user_id, _open_cards())
    total = db.session.scalar(db.select(db.func.count()).select_from(base.subquery()))
    rows = db.session.execute(
        db.select(Card.id, Card.title, Card.board_id, Board.slug, Board.name)
        .join(Column, Card.column_id == Column.id)
        .join(Board, Board.id == Card.board_id)
        .where(Card.assignee_id == user_id, _open_cards())
        .order_by(Board.name, Card.title, Card.id)
        .limit(LIMIT)
    ).all()
    return total, rows


def open_owned_boards(user_id):
    """(total, rows) of the Boards this user owns that still have open Cards (any assignee), up to 50 rows."""
    grouped = (
        db.select(Board.id, Board.slug, Board.name, db.func.count(Card.id).label("open"))
        .join(Column, Column.board_id == Board.id)
        .join(Card, Card.column_id == Column.id)
        .where(Board.owner_id == user_id, _open_cards())
        .group_by(Board.id, Board.slug, Board.name)
    )
    total = db.session.scalar(db.select(db.func.count()).select_from(grouped.subquery()))
    return total, db.session.execute(grouped.order_by(Board.name, Board.id).limit(LIMIT)).all()


def list_all():
    return User.query.order_by(User.full_name, User.id).all()
