import sqlalchemy as sa
from alembic import op

revision = "b8e4c2a9d713"
down_revision = "a3d8f1b7c629"
branch_labels = None
depends_on = None

_OLD = ("assigned", "deadline", "board_join_requested", "board_added", "board_join_rejected")
_CARD_NEW = ("comment_on_assigned", "due_today", "due_tomorrow", "assigned_card_changed", "subtask_on_assigned")
_NEW = _OLD + _CARD_NEW
_DEDUPED = ("assigned", "deadline", "due_today", "due_tomorrow")


def _in(values):
    return ", ".join(f"'{v}'" for v in values)


def _check(card_types):
    return (
        f"(type IN ({_in(card_types)}) AND card_id IS NOT NULL) OR "
        "(type IN ('board_join_requested','board_added','board_join_rejected') AND card_id IS NULL AND board_id IS NOT NULL)"
    )


def _retype(values):
    op.execute("ALTER TYPE notification_type RENAME TO notification_type_old")
    op.execute(f"CREATE TYPE notification_type AS ENUM ({_in(values)})")
    op.execute("ALTER TABLE notifications ALTER COLUMN type TYPE notification_type USING type::text::notification_type")
    op.execute("DROP TYPE notification_type_old")


def upgrade():
    op.drop_index("uq_notifications_card", table_name="notifications")
    op.drop_constraint("notifications_scope", "notifications", type_="check")
    _retype(_NEW)
    op.add_column("notifications", sa.Column("action", sa.String(length=20), nullable=True))
    op.create_check_constraint("notifications_scope", "notifications", _check(("assigned", "deadline") + _CARD_NEW))
    op.create_index(
        "uq_notifications_card", "notifications", ["user_id", "card_id", "type", "notify_date"], unique=True,
        postgresql_where=sa.text(f"card_id IS NOT NULL AND type IN ({_in(_DEDUPED)})"),
    )
    op.create_table(
        "notification_preferences",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("type", sa.String(length=40), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("uq_notification_preferences_user_type", "notification_preferences", ["user_id", "type"], unique=True)


def downgrade():
    op.drop_index("uq_notification_preferences_user_type", table_name="notification_preferences")
    op.drop_table("notification_preferences")
    op.drop_index("uq_notifications_card", table_name="notifications")
    op.drop_constraint("notifications_scope", "notifications", type_="check")
    op.execute(f"DELETE FROM notifications WHERE type IN ({_in(_CARD_NEW)})")
    op.drop_column("notifications", "action")
    _retype(_OLD)
    op.create_check_constraint("notifications_scope", "notifications", _check(("assigned", "deadline")))
    op.create_index(
        "uq_notifications_card", "notifications", ["user_id", "card_id", "type", "notify_date"], unique=True,
        postgresql_where=sa.text("card_id IS NOT NULL"),
    )
