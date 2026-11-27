from datetime import timedelta

from app.extensions import db
from app.models import Board, Card, Column, User


def summaries(today, week_ago, board_id=None):
    has_card = Card.id.isnot(None)
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
    lo, hi = boundaries[0], boundaries[-1]
    bucket = db.case(
        *[(db.and_(Card.completed_at >= boundaries[i], Card.completed_at < boundaries[i + 1]), i) for i in range(len(boundaries) - 1)],
        else_=None,
    )
    q = (
        db.select(Board.id, Board.name, bucket, db.func.count(Card.id))
        .select_from(Board)
        .outerjoin(
            Card,
            db.and_(Card.board_id == Board.id, Card.deleted_at.is_(None), Card.completed_at >= lo, Card.completed_at < hi),
        )
        .where(Board.deleted_at.is_(None))
        .group_by(Board.id, Board.name, bucket)
        .order_by(Board.name, Board.id)
    )
    if board_id is not None:
        q = q.where(Board.id == board_id)
    return db.session.execute(q).all()


PRIORITY_RANK = db.case((Card.priority == "high", 0), (Card.priority == "medium", 1), else_=2)


def _live_cards(board_ids, member_id):
    conds = [Card.board_id.in_(board_ids), Card.deleted_at.is_(None), Card.archived_at.is_(None)]
    if member_id is not None:
        conds.append(Card.assignee_id == member_id)
    return conds


def overview(board_ids, member_id, today):
    q = (
        db.select(
            db.func.count(Card.id),
            db.func.coalesce(db.func.sum(db.case((Column.name == "Done", 1), else_=0)), 0),
            db.func.coalesce(db.func.sum(db.case((Column.name == "In Progress", 1), else_=0)), 0),
            db.func.coalesce(db.func.sum(db.case((db.and_(Card.end_date < today, Column.name != "Done"), 1), else_=0)), 0),
        )
        .select_from(Card)
        .join(Column, Card.column_id == Column.id)
        .where(*_live_cards(board_ids, member_id))
    )
    return [int(x or 0) for x in db.session.execute(q).one()]


def _open(board_ids, member_id):
    return [*_live_cards(board_ids, member_id), Column.name != "Done"]


def _card_rows(where, order, limit):
    return db.session.execute(
        db.select(Card.id, Card.title, Card.board_id, Board.slug, Board.name.label("board_name"), Card.priority, Card.end_date, User.full_name.label("assignee_name"))
        .select_from(Card)
        .join(Column, Card.column_id == Column.id)
        .join(Board, Board.id == Card.board_id)
        .outerjoin(User, User.id == Card.assignee_id)
        .where(*where)
        .order_by(*order)
        .limit(limit)
    ).all()


def _count(where):
    return db.session.scalar(db.select(db.func.count(Card.id)).select_from(Card).join(Column, Card.column_id == Column.id).where(*where)) or 0


def overdue_cards(board_ids, member_id, today, lo, hi, limit):
    where = [*_open(board_ids, member_id), Card.end_date < today, Card.end_date >= lo, Card.end_date <= hi]
    return _count(where), _card_rows(where, (Card.end_date, PRIORITY_RANK, Card.id), limit)


def due_on_cards(board_ids, member_id, due_on, limit):
    where = [*_open(board_ids, member_id), Card.end_date == due_on]
    return _count(where), _card_rows(where, (PRIORITY_RANK, Card.id), limit)


def top_priority(board_ids, member_id, limit):
    where = _open(board_ids, member_id)
    nulls_last = db.case((Card.end_date.is_(None), 1), else_=0)
    return _card_rows(where, (PRIORITY_RANK, nulls_last, Card.end_date, Card.id), limit)


def finished_pairs(board_ids, member_id, lo_dt, hi_dt):
    q = db.select(Card.completed_at, Card.end_date).where(
        Card.board_id.in_(board_ids),
        Card.deleted_at.is_(None),
        Card.completed_at.isnot(None),
        Card.completed_at >= lo_dt,
        Card.completed_at < hi_dt,
        Card.end_date.isnot(None),
    )
    if member_id is not None:
        q = q.where(Card.assignee_id == member_id)
    return db.session.execute(q).all()


def weekly_done(boundaries, board_ids, member_id):
    lo, hi = boundaries[0], boundaries[-1]
    bucket = db.case(*[(db.and_(Card.completed_at >= boundaries[i], Card.completed_at < boundaries[i + 1]), i) for i in range(len(boundaries) - 1)], else_=None)
    q = (
        db.select(bucket, db.func.count(Card.id))
        .where(Card.board_id.in_(board_ids), Card.deleted_at.is_(None), Card.completed_at >= lo, Card.completed_at < hi)
        .group_by(bucket)
    )
    if member_id is not None:
        q = q.where(Card.assignee_id == member_id)
    return {int(i): int(n) for i, n in db.session.execute(q).all() if i is not None}


def people(board_ids):
    from app.models import BoardMember

    ids = db.union(
        db.select(Board.owner_id).where(Board.id.in_(board_ids), Board.owner_id.isnot(None)),
        db.select(BoardMember.user_id).where(BoardMember.board_id.in_(board_ids)),
    ).subquery()
    return db.session.execute(db.select(User.id, User.full_name, User.avatar_path).where(User.id.in_(db.select(ids.c[0]))).order_by(User.full_name, User.id)).all()


def boards_in_scope(owner_id=None, board_id=None):
    q = db.select(Board.id, Board.name).where(Board.deleted_at.is_(None))
    if owner_id is not None:
        q = q.where(Board.owner_id == owner_id)
    if board_id is not None:
        q = q.where(Board.id == board_id)
    return db.session.execute(q.order_by(Board.name, Board.id)).all()
