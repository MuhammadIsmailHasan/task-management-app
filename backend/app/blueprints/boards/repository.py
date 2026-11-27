from sqlalchemy.orm import selectinload

from app.common.ids import to_uuid
from app.extensions import db
from app.models import Board, BoardMember, Card, Column, User


def get_by_id(board_id, include_deleted=False):
    board = db.session.get(Board, board_id)
    if board is None or (board.deleted_at is not None and not include_deleted):
        return None
    return board


def get_by_slug(slug):
    if not slug:
        return None
    return db.session.scalars(db.select(Board).where(Board.slug == slug, Board.deleted_at.is_(None))).first()


def get_by_share_token(token):
    if not token:
        return None
    return db.session.scalars(
        db.select(Board).where(Board.share_token == token, Board.deleted_at.is_(None)).options(selectinload(Board.columns))
    ).first()


def get_detail(board_id):
    board = db.session.scalars(
        db.select(Board)
        .where(Board.id == board_id, Board.deleted_at.is_(None))
        .options(selectinload(Board.columns))
        .execution_options(populate_existing=True)
    ).first()
    return board


def is_member(board_id, user_id):
    return BoardMember.query.filter_by(board_id=board_id, user_id=user_id).first() is not None


def _escape_like(text):
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def list_visible(actor, q_text=None, sort="updated_at", order="desc"):
    q = Board.query.filter(Board.deleted_at.is_(None))
    if q_text:
        q = q.filter(Board.name.ilike(f"%{_escape_like(q_text)}%", escape="\\"))
    if actor.role not in ("manager", "admin"):
        uid = to_uuid(actor.id)
        member_ids = db.select(BoardMember.board_id).where(BoardMember.user_id == uid)
        q = q.filter(db.or_(Board.owner_id == uid, Board.id.in_(member_ids)))
    column = Board.created_at if sort == "created_at" else Board.updated_at
    return q.order_by(column.asc() if order == "asc" else column.desc(), Board.name, Board.id).all()


def counts_for(board_ids, today):
    if not board_ids:
        return {}
    has_card = Card.id.isnot(None)
    live = db.and_(Card.deleted_at.is_(None), Card.archived_at.is_(None))
    rows = db.session.execute(
        db.select(
            Column.board_id,
            db.func.count(Card.id),
            db.func.coalesce(db.func.sum(db.case((db.and_(has_card, Column.name == "Done"), 1), else_=0)), 0),
            db.func.coalesce(
                db.func.sum(db.case((db.and_(has_card, Card.end_date < today, Column.name != "Done"), 1), else_=0)), 0
            ),
        )
        .select_from(Column)
        .outerjoin(Card, db.and_(Card.column_id == Column.id, live))
        .where(Column.board_id.in_(board_ids))
        .group_by(Column.board_id)
    ).all()
    members = dict(
        db.session.execute(
            db.select(BoardMember.board_id, db.func.count(BoardMember.id))
            .where(BoardMember.board_id.in_(board_ids))
            .group_by(BoardMember.board_id)
        ).all()
    )
    out = {bid: {"card_count": 0, "done_count": 0, "overdue_count": 0, "member_count": members.get(bid, 0)} for bid in board_ids}
    for bid, total, done, overdue in rows:
        out[bid].update(card_count=int(total), done_count=int(done), overdue_count=int(overdue))
    return out


def create_board(name, owner_id=None, description=None):
    board = Board(name=name, owner_id=owner_id, description=description)
    db.session.add(board)
    db.session.flush()
    return board


def add_column(board_id, name, order):
    col = Column(board_id=board_id, name=name, order=order)
    db.session.add(col)
    db.session.flush()
    return col


def max_column_order(board_id):
    return db.session.scalar(db.select(db.func.max(Column.order)).where(Column.board_id == board_id))


def list_columns(board_id):
    return Column.query.filter_by(board_id=board_id).order_by(Column.order).all()


def get_column(column_id):
    return db.session.get(Column, column_id)


def get_member(board_id, user_id):
    return BoardMember.query.filter_by(board_id=board_id, user_id=user_id).first()


def add_member(board_id, user_id):
    m = BoardMember(board_id=board_id, user_id=user_id)
    db.session.add(m)
    db.session.flush()
    return m


def delete_member(member):
    db.session.delete(member)


def list_members(board, with_owner=True, assignable=False):
    rows = (
        User.query.join(BoardMember, BoardMember.user_id == User.id)
        .filter(BoardMember.board_id == board.id)
        .order_by(db.case((User.role == "supervisor", 0), else_=1), User.full_name)
        .all()
    )
    out = []
    if with_owner and board.owner_id is not None:
        owner = db.session.get(User, board.owner_id)
        if owner is not None:
            out.append((owner, True))
    out += [(u, False) for u in rows if not (with_owner and board.owner_id == u.id)]
    if assignable:
        out = [(u, owner) for u, owner in out if u.is_active and u.is_available]
    return out


def candidates(board, search, limit):
    member_ids = db.select(BoardMember.user_id).where(BoardMember.board_id == board.id)
    query = User.query.filter(User.id.notin_(member_ids), User.role.in_(("member", "supervisor")), User.is_active.is_(True), User.is_available.is_(True))
    if board.owner_id is not None:
        query = query.filter(User.id != board.owner_id)
    text = (search or "").strip().lower()
    if text:
        escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        query = query.filter(
            db.or_(
                db.func.lower(User.full_name).like(f"%{escaped}%", escape="\\"),
                db.func.lower(User.username).like(f"{escaped}%", escape="\\"),
                db.func.lower(User.email) == text,
            )
        )
    return query.order_by(User.full_name).limit(limit).all()


def assigned_cards(board_id, user_id):
    return (
        Card.query.filter(Card.board_id == board_id, Card.assignee_id == user_id, Card.deleted_at.is_(None)).all()
    )


def memberships_of(user_id):
    return BoardMember.query.filter_by(user_id=user_id).all()
