from app.extensions import db
from app.models import Card, Column


def get(column_id):
    return db.session.get(Column, column_id)


def siblings(board_id):
    """The Board's Columns in order."""
    return db.session.scalars(db.select(Column).where(Column.board_id == board_id).order_by(Column.order, Column.id)).all()


def active_card_count(column_id):
    """Cards that are neither archived nor soft-deleted (an archived Card has no Column anyway)."""
    return db.session.scalar(
        db.select(db.func.count(Card.id)).where(Card.column_id == column_id, Card.deleted_at.is_(None), Card.archived_at.is_(None))
    )


def detach_deleted_cards(column_id):
    """Soft-deleted Cards of a Column that is going away keep their row and lose the Column (COL-06)."""
    db.session.execute(db.update(Card).where(Card.column_id == column_id).values(column_id=None))


def delete(column):
    db.session.delete(column)
