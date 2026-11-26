from sqlalchemy import event
from sqlalchemy.dialects.postgresql import UUID

from app.extensions import db
from app.models.base import TimestampMixin, uuid_fk, uuid_pk


class Category(TimestampMixin, db.Model):
    __tablename__ = "categories"

    id = uuid_pk()
    board_id = uuid_fk("boards.id", nullable=False)
    name = db.Column(db.String(255), nullable=False)
    color = db.Column(db.String(64), nullable=True)


# Unique by case-insensitive name within a board.
db.Index("uq_categories_board_name_lower", Category.board_id, db.func.lower(Category.name), unique=True)


class Card(TimestampMixin, db.Model):
    __tablename__ = "cards"
    __table_args__ = (
        db.CheckConstraint(
            "start_date IS NULL OR end_date IS NULL OR end_date >= start_date",
            name="ck_cards_end_after_start",
        ),
    )

    id = uuid_pk()
    # An archived Card has no Column (V17, Requirement 49) but keeps its Board, so a Card reaches its Board without one.
    board_id = uuid_fk("boards.id", nullable=False)
    column_id = uuid_fk("columns.id", nullable=True)
    category_id = db.Column(
        db.UUID(as_uuid=True), db.ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    assignee_id = uuid_fk("users.id", nullable=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    priority = db.Column(
        db.Enum("high", "medium", "low", name="card_priority"),
        nullable=False,
        default="medium",
    )
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    order = db.Column(db.Float, nullable=False)
    deleted_at = db.Column(db.DateTime(timezone=True), nullable=True)
    archived_at = db.Column(db.DateTime(timezone=True), nullable=True)
    # Set when the Card enters a Column named Done, cleared when it leaves (V16, Requirement 43).
    completed_at = db.Column(db.DateTime(timezone=True), nullable=True)
    # Stretch columns (progress, views_count) are intentionally left for a later migration.

    subtasks = db.relationship("Subtask", back_populates="card", lazy="raise", order_by="Subtask.order")
    attachments = db.relationship(
        "Attachment", back_populates="card", lazy="raise", order_by="Attachment.created_at"
    )


class Subtask(TimestampMixin, db.Model):
    __tablename__ = "subtasks"

    id = uuid_pk()
    card_id = uuid_fk("cards.id", nullable=False)
    title = db.Column(db.String(255), nullable=False)
    is_done = db.Column(db.Boolean, nullable=False, default=False, server_default=db.false())
    order = db.Column(db.Float, nullable=False)
    created_by_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    card = db.relationship("Card", back_populates="subtasks", lazy="raise")


class Attachment(TimestampMixin, db.Model):
    __tablename__ = "attachments"
    __table_args__ = (
        db.CheckConstraint("url IS NOT NULL OR file_path IS NOT NULL", name="ck_attachments_url_or_file"),
    )

    id = uuid_pk()
    card_id = uuid_fk("cards.id", nullable=False)
    name = db.Column(db.String(255), nullable=False)
    url = db.Column(db.String(2048), nullable=True)
    file_path = db.Column(db.String(1024), nullable=True)
    mime_type = db.Column(db.String(255), nullable=True)
    created_by_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    card = db.relationship("Card", back_populates="attachments", lazy="raise")


db.Index("ix_cards_board_id", Card.board_id)


@event.listens_for(Card, "before_insert")
def _set_board(mapper, connection, target):
    """A Card made with a Column (the API, the seed, a test) takes that Column's Board without naming it."""
    if target.board_id is None and target.column_id is not None:
        from app.models.board import Column

        target.board_id = connection.scalar(db.select(Column.board_id).where(Column.id == target.column_id))
