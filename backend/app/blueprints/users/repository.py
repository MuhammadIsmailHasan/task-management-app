from app.extensions import db
from app.models import Board, Card, Column, User

LIMIT = 50


def _open_cards():
    return db.and_(Card.deleted_at.is_(None), Card.archived_at.is_(None), Column.name != "Done", Board.deleted_at.is_(None))


def open_assigned(user_id):
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
    grouped = (
        db.select(Board.id, Board.slug, Board.name, db.func.count(Card.id).label("open"))
        .join(Column, Column.board_id == Board.id)
        .join(Card, Card.column_id == Column.id)
        .where(Board.owner_id == user_id, _open_cards())
        .group_by(Board.id, Board.slug, Board.name)
    )
    total = db.session.scalar(db.select(db.func.count()).select_from(grouped.subquery()))
    return total, db.session.execute(grouped.order_by(Board.name, Board.id).limit(LIMIT)).all()


_ROLE_ORDER = db.case((User.role == "admin", 0), (User.role == "manager", 1), (User.role == "supervisor", 2), else_=3)


def list_all():
    return User.query.order_by(_ROLE_ORDER, db.func.lower(User.full_name), User.id).all()


def list_page(page, per_page):
    total = db.session.scalar(db.select(db.func.count(User.id)))
    rows = (
        User.query.order_by(_ROLE_ORDER, db.func.lower(User.full_name), User.id)
        .limit(per_page)
        .offset((page - 1) * per_page)
        .all()
    )
    return rows, total
