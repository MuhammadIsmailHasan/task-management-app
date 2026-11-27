from sqlalchemy.orm import selectinload

from app.extensions import db
from app.models import Attachment, Card, Category, Column, Subtask


def get_card(card_id, include_deleted=False):
    card = db.session.get(Card, card_id)
    if card is None or (card.deleted_at is not None and not include_deleted):
        return None
    return card


def get_column(column_id):
    return db.session.get(Column, column_id)


def board_id_of_card(card):
    return card.board_id


def max_order(column_id):
    return db.session.scalar(
        db.select(db.func.max(Card.order)).where(Card.column_id == column_id, Card.deleted_at.is_(None))
    )


def first_column(board_id):
    return db.session.scalars(db.select(Column).where(Column.board_id == board_id).order_by(Column.order, Column.id).limit(1)).first()


def column_cards(column_id, exclude_id=None):
    q = Card.query.filter(Card.column_id == column_id, Card.deleted_at.is_(None))
    if exclude_id is not None:
        q = q.filter(Card.id != exclude_id)
    return q.order_by(Card.order).all()


def add_card(**fields):
    card = Card(**fields)
    db.session.add(card)
    db.session.flush()
    return card


def get_category(category_id):
    return db.session.get(Category, category_id)


def subtasks_of(card_id):
    return Subtask.query.filter_by(card_id=card_id).order_by(Subtask.order).all()


def max_subtask_order(card_id):
    return db.session.scalar(db.select(db.func.max(Subtask.order)).where(Subtask.card_id == card_id))


def add_subtask(card_id, title, order, created_by_id=None):
    s = Subtask(card_id=card_id, title=title, order=order, is_done=False, created_by_id=created_by_id)
    db.session.add(s)
    db.session.flush()
    return s


def get_subtask(subtask_id):
    sub = db.session.get(Subtask, subtask_id)
    if sub is None:
        return None
    card = db.session.get(Card, sub.card_id)
    return sub if card is not None and card.deleted_at is None else None


def delete_subtask(sub):
    db.session.delete(sub)


def add_attachment(**fields):
    a = Attachment(**fields)
    db.session.add(a)
    db.session.flush()
    return a


def get_attachment(attachment_id):
    return db.session.get(Attachment, attachment_id)


def delete_attachment(att):
    db.session.delete(att)


def _with_children(stmt):
    return stmt.options(selectinload(Card.subtasks), selectinload(Card.attachments))


def get_detail(card_id):
    return db.session.scalars(
        _with_children(
            db.select(Card).where(Card.id == card_id, Card.deleted_at.is_(None))
        ).execution_options(populate_existing=True)
    ).first()


def assigned_open(user_id):
    from app.models import Board

    return db.session.execute(
        db.select(Card.id, Card.title, Card.board_id, Board.slug, Board.name.label("board_name"), Card.priority, Card.end_date, Category.id.label("category_id"), Category.name.label("category_name"), Category.color)
        .select_from(Card)
        .join(Column, Card.column_id == Column.id)
        .join(Board, Board.id == Card.board_id)
        .outerjoin(Category, Category.id == Card.category_id)
        .where(Card.assignee_id == user_id, Card.deleted_at.is_(None), Card.archived_at.is_(None), Column.name != "Done", Board.deleted_at.is_(None))
    ).all()


def list_for_board(board_id, filters, archived=False):
    stmt = (
        db.select(Card)
        .outerjoin(Column, Card.column_id == Column.id)
        .where(
            Card.board_id == board_id,
            Card.deleted_at.is_(None),
            Card.archived_at.isnot(None) if archived else Card.archived_at.is_(None),
        )
    )
    if filters.get("search"):
        like = f"%{filters['search'].lower()}%"
        stmt = stmt.where(db.or_(db.func.lower(Card.title).like(like), db.func.lower(Card.description).like(like)))
    if filters.get("priority"):
        stmt = stmt.where(Card.priority == filters["priority"])
    if filters.get("assignee"):
        stmt = stmt.where(Card.assignee_id == filters["assignee"])
    if filters.get("category"):
        stmt = stmt.where(Card.category_id == filters["category"])
    order = (Card.archived_at.desc(), Card.id) if archived else (Column.order, Card.order)
    stmt = _with_children(stmt).order_by(*order).execution_options(populate_existing=True)
    return db.session.scalars(stmt).all()
