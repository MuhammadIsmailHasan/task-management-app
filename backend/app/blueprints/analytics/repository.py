from datetime import timedelta

from app.extensions import db
from app.models import Board, Card, Column


def summaries(today, week_ago, board_id=None):
    """One grouped query: per-board counts, no per-card data."""
    has_card = Card.id.isnot(None)  # the outer join yields NULL card rows for empty columns
    done = db.and_(has_card, Column.name == "Done")
    q = (
        db.select(
            Board.id,
            Board.name,
            db.func.count(Card.id),
            db.func.coalesce(db.func.sum(db.case((done, 1), else_=0)), 0),
            db.func.coalesce(db.func.sum(db.case((db.and_(has_card, Column.name == "In Progress"), 1), else_=0)), 0),
            db.func.coalesce(
                db.func.sum(db.case((db.and_(has_card, Card.end_date < today, Column.name != "Done"), 1), else_=0)), 0
            ),
            db.func.coalesce(db.func.sum(db.case((db.and_(done, Card.completed_at >= week_ago), 1), else_=0)), 0),
        )
        .select_from(Board)
        .outerjoin(Column, Column.board_id == Board.id)
        .outerjoin(Card, db.and_(Card.column_id == Column.id, Card.deleted_at.is_(None)))
        .where(Board.deleted_at.is_(None))
        .group_by(Board.id, Board.name)
        .order_by(Board.name, Board.id)
    )
    if board_id is not None:
        q = q.where(Board.id == board_id)
    return db.session.execute(q).all()


def throughput(boundaries, board_id=None):
    """Completed Cards per week: one grouped query, rows of (board id, name, week index or None, count).

    `boundaries` are the weeks' start instants plus the end of the last week, ascending. Weeks are bucketed with one
    CASE arm each, so the SQL is the same on SQLite and PostgreSQL. A Board with no completion yields one row with a
    None index and a count of 0.
    """
    lo, hi = boundaries[0], boundaries[-1]
    bucket = db.case(
        *[(db.and_(Card.completed_at >= boundaries[i], Card.completed_at < boundaries[i + 1]), i) for i in range(len(boundaries) - 1)],
        else_=None,
    )
    q = (
        db.select(Board.id, Board.name, bucket, db.func.count(Card.id))
        .select_from(Board)
        .outerjoin(Column, Column.board_id == Board.id)
        .outerjoin(
            Card,
            db.and_(Card.column_id == Column.id, Card.deleted_at.is_(None), Card.completed_at >= lo, Card.completed_at < hi),
        )
        .where(Board.deleted_at.is_(None))
        .group_by(Board.id, Board.name, bucket)
        .order_by(Board.name, Board.id)
    )
    if board_id is not None:
        q = q.where(Board.id == board_id)
    return db.session.execute(q).all()
