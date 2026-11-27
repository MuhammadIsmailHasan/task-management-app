from app.extensions import db
from app.models.base import TimestampMixin, uuid_fk, uuid_pk


class Comment(TimestampMixin, db.Model):
    __tablename__ = "comments"

    id = uuid_pk()
    card_id = uuid_fk("cards.id", nullable=False)
    author_id = uuid_fk("users.id", nullable=False)
    parent_id = uuid_fk("comments.id", nullable=True)
    content = db.Column(db.Text, nullable=False)
    is_priority = db.Column(db.Boolean, nullable=False, default=False, server_default=db.false())
    reply_count = db.Column(db.Integer, nullable=False, default=0, server_default="0")

    replies = db.relationship(
        "Comment", back_populates="parent", lazy="raise", order_by="Comment.created_at"
    )
    parent = db.relationship("Comment", back_populates="replies", remote_side="Comment.id", lazy="raise")


class ActivityLog(db.Model):
    __tablename__ = "activity_logs"

    id = uuid_pk()
    actor_id = uuid_fk("users.id", nullable=False)
    action = db.Column(db.String(100), nullable=False)
    target_type = db.Column(db.String(50), nullable=False)
    target_id = db.Column(db.UUID(as_uuid=True), nullable=False)
    metadata_ = db.Column("metadata", db.JSON, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)


PREFERENCE_TYPES = ("comment_on_assigned", "due_today", "due_tomorrow", "assigned_card_changed", "subtask_on_assigned")
CARD_NOTIFICATIONS = ("assigned", "deadline", *PREFERENCE_TYPES)
DEDUPED_NOTIFICATIONS = ("assigned", "deadline", "due_today", "due_tomorrow")
BOARD_NOTIFICATIONS = ("board_join_requested", "board_added", "board_join_rejected")


class Notification(TimestampMixin, db.Model):
    __tablename__ = "notifications"
    __table_args__ = (
        db.CheckConstraint(
            "(type IN ('assigned','deadline','comment_on_assigned','due_today','due_tomorrow','assigned_card_changed','subtask_on_assigned') AND card_id IS NOT NULL) OR "
            "(type IN ('board_join_requested','board_added','board_join_rejected') AND card_id IS NULL AND board_id IS NOT NULL)",
            name="notifications_scope",
        ),
    )

    id = uuid_pk()
    user_id = uuid_fk("users.id", nullable=False)
    type = db.Column(
        db.Enum(*CARD_NOTIFICATIONS, *BOARD_NOTIFICATIONS, name="notification_type"), nullable=False
    )
    card_id = uuid_fk("cards.id", nullable=True)
    board_id = uuid_fk("boards.id", nullable=True)
    actor_id = uuid_fk("users.id", nullable=True)
    join_request_id = uuid_fk("board_join_requests.id", nullable=True)
    is_read = db.Column(db.Boolean, nullable=False, default=False, server_default=db.false())
    notify_date = db.Column(db.Date, nullable=False)
    action = db.Column(db.String(20), nullable=True)


def _partial(name, cols, where):
    return db.Index(name, *cols, unique=True, postgresql_where=where, sqlite_where=where)


_N = Notification
_partial("uq_notifications_card", (_N.user_id, _N.card_id, _N.type, _N.notify_date), db.and_(_N.card_id.isnot(None), _N.type.in_(DEDUPED_NOTIFICATIONS)))
_partial("uq_notifications_join_request", (_N.user_id, _N.type, _N.join_request_id), _N.join_request_id.isnot(None))
_partial(
    "uq_notifications_board", (_N.user_id, _N.type, _N.board_id, _N.notify_date),
    db.and_(_N.card_id.is_(None), _N.join_request_id.is_(None)),
)


class NotificationPreference(TimestampMixin, db.Model):
    __tablename__ = "notification_preferences"

    id = uuid_pk()
    user_id = uuid_fk("users.id", nullable=False)
    type = db.Column(db.String(40), nullable=False)
    enabled = db.Column(db.Boolean, nullable=False)


db.Index("uq_notification_preferences_user_type", NotificationPreference.user_id, NotificationPreference.type, unique=True)
