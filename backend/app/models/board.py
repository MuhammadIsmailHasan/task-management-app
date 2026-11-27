from sqlalchemy import event

from app.common.slug import pick_free, slugify
from app.extensions import db
from app.models.base import TimestampMixin, uuid_fk, uuid_pk


class Board(TimestampMixin, db.Model):
    __tablename__ = "boards"

    id = uuid_pk()
    name = db.Column(db.String(255), nullable=False)
    slug = db.Column(db.String(300), nullable=False)
    description = db.Column(db.Text, nullable=True)
    share_token = db.Column(db.String(64), nullable=True)
    invite_token = db.Column(db.String(64), nullable=True)
    owner_id = uuid_fk("users.id", nullable=True)
    deleted_at = db.Column(db.DateTime(timezone=True), nullable=True)
    archived_at = db.Column(db.DateTime(timezone=True), nullable=True)

    columns = db.relationship("Column", back_populates="board", lazy="raise", order_by="Column.order")
    members = db.relationship(
        "BoardMember", back_populates="board", lazy="raise", order_by="BoardMember.created_at"
    )


class BoardMember(TimestampMixin, db.Model):
    __tablename__ = "board_members"
    __table_args__ = (db.UniqueConstraint("board_id", "user_id", name="uq_board_members_board_user"),)

    id = uuid_pk()
    board_id = uuid_fk("boards.id", nullable=False)
    user_id = uuid_fk("users.id", nullable=False)

    board = db.relationship("Board", back_populates="members", lazy="raise")


class BoardJoinRequest(TimestampMixin, db.Model):
    __tablename__ = "board_join_requests"

    id = uuid_pk()
    board_id = uuid_fk("boards.id", nullable=False)
    user_id = uuid_fk("users.id", nullable=False)
    status = db.Column(
        db.Enum("pending", "approved", "rejected", name="join_request_status"),
        nullable=False,
        default="pending",
        server_default="pending",
    )
    decided_by = uuid_fk("users.id", nullable=True)


class Column(TimestampMixin, db.Model):
    __tablename__ = "columns"

    id = uuid_pk()
    board_id = uuid_fk("boards.id", nullable=False)
    name = db.Column(db.String(255), nullable=False)
    order = db.Column(db.Float, nullable=False)
    board = db.relationship("Board", back_populates="columns", lazy="raise")


db.Index("uq_boards_share_token", Board.share_token, unique=True, postgresql_where=Board.share_token.isnot(None), sqlite_where=Board.share_token.isnot(None))
db.Index("uq_boards_invite_token", Board.invite_token, unique=True, postgresql_where=Board.invite_token.isnot(None), sqlite_where=Board.invite_token.isnot(None))
db.Index(
    "uq_join_requests_pending", BoardJoinRequest.board_id, BoardJoinRequest.user_id, unique=True,
    postgresql_where=BoardJoinRequest.status == "pending", sqlite_where=BoardJoinRequest.status == "pending",
)
db.Index("ix_join_requests_board_status_created", BoardJoinRequest.board_id, BoardJoinRequest.status, BoardJoinRequest.created_at)

db.Index("uq_boards_slug", Board.slug, unique=True)


def taken_slugs(connection, base, exclude_id=None):
    query = db.select(Board.slug).where(db.or_(Board.slug == base, Board.slug.like(f"{base}-%")))
    if exclude_id is not None:
        query = query.where(Board.id != exclude_id)
    return set(connection.scalars(query))


def unique_slug(connection, name, exclude_id=None):
    base = slugify(name)
    return pick_free(base, taken_slugs(connection, base, exclude_id))


@event.listens_for(Board, "before_insert")
def _set_slug(mapper, connection, target):
    if not target.slug:
        target.slug = unique_slug(connection, target.name)
