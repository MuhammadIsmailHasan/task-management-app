"""V12: private boards, invite token, join requests, notification types

Local-development reset (Decision Y): upgrade() empties every user-linked table when APP_ENV is development
or testing. Anywhere else it never deletes: it runs only on an empty `users` table (Decision AN). After it, run `flask seed-data`.

Revision ID: c9e1a5b7d302
Revises: b7d2e4f6a801
Create Date: 2026-11-21 10:00:00
"""
import os

import sqlalchemy as sa
from alembic import op

revision = "c9e1a5b7d302"
down_revision = "b7d2e4f6a801"
branch_labels = None
depends_on = None

_OLD = ("assigned", "deadline")
_NEW = ("assigned", "deadline", "board_join_requested", "board_added", "board_join_rejected")
_CHECK = (
    "(type IN ('assigned','deadline') AND card_id IS NOT NULL) OR "
    "(type IN ('board_join_requested','board_added','board_join_rejected') AND card_id IS NULL AND board_id IS NOT NULL)"
)


def _retype(values):
    quoted = ", ".join(f"'{v}'" for v in values)
    op.execute("ALTER TYPE notification_type RENAME TO notification_type_old")
    op.execute(f"CREATE TYPE notification_type AS ENUM ({quoted})")
    op.execute("ALTER TABLE notifications ALTER COLUMN type TYPE notification_type USING type::text::notification_type")
    op.execute("DROP TYPE notification_type_old")


def upgrade():
    if (os.environ.get("APP_ENV") or "production").strip().lower() in ("development", "testing"):
        op.execute("TRUNCATE TABLE users CASCADE")
        print("Local data was reset. Run `flask seed-data`.")
    elif op.get_bind().execute(sa.text("SELECT 1 FROM users LIMIT 1")).first():
        raise RuntimeError("This migration cannot keep existing users and the users table is not empty; nothing was changed")

    op.drop_column("boards", "visibility")
    sa.Enum(name="board_visibility").drop(op.get_bind(), checkfirst=True)
    op.add_column("boards", sa.Column("invite_token", sa.String(length=64), nullable=True))
    op.create_index(
        "uq_boards_invite_token", "boards", ["invite_token"], unique=True, postgresql_where=sa.text("invite_token IS NOT NULL")
    )

    op.create_table(
        "board_join_requests",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("board_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column(
            "status", sa.Enum("pending", "approved", "rejected", name="join_request_status"),
            server_default="pending", nullable=False,
        ),
        sa.Column("decided_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["board_id"], ["boards.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["decided_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_join_requests_pending", "board_join_requests", ["board_id", "user_id"], unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )
    op.create_index("ix_join_requests_board_status_created", "board_join_requests", ["board_id", "status", "created_at"])

    op.drop_constraint("uq_notifications_user_card_type_date", "notifications", type_="unique")
    _retype(_NEW)
    op.alter_column("notifications", "card_id", nullable=True)
    op.add_column("notifications", sa.Column("board_id", sa.UUID(), sa.ForeignKey("boards.id"), nullable=True))
    op.add_column("notifications", sa.Column("actor_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=True))
    op.add_column("notifications", sa.Column("join_request_id", sa.UUID(), sa.ForeignKey("board_join_requests.id"), nullable=True))
    op.create_check_constraint("notifications_scope", "notifications", _CHECK)
    op.create_index(
        "uq_notifications_card", "notifications", ["user_id", "card_id", "type", "notify_date"], unique=True,
        postgresql_where=sa.text("card_id IS NOT NULL"),
    )
    op.create_index(
        "uq_notifications_join_request", "notifications", ["user_id", "type", "join_request_id"], unique=True,
        postgresql_where=sa.text("join_request_id IS NOT NULL"),
    )
    op.create_index(
        "uq_notifications_board", "notifications", ["user_id", "type", "board_id", "notify_date"], unique=True,
        postgresql_where=sa.text("card_id IS NULL AND join_request_id IS NULL"),
    )


def downgrade():
    op.execute("DELETE FROM notifications WHERE card_id IS NULL")
    op.drop_index("uq_notifications_board", table_name="notifications")
    op.drop_index("uq_notifications_join_request", table_name="notifications")
    op.drop_index("uq_notifications_card", table_name="notifications")
    op.drop_constraint("notifications_scope", "notifications", type_="check")
    op.drop_column("notifications", "join_request_id")
    op.drop_column("notifications", "actor_id")
    op.drop_column("notifications", "board_id")
    op.alter_column("notifications", "card_id", nullable=False)
    _retype(_OLD)
    op.create_unique_constraint(
        "uq_notifications_user_card_type_date", "notifications", ["user_id", "card_id", "type", "notify_date"]
    )

    op.drop_index("ix_join_requests_board_status_created", table_name="board_join_requests")
    op.drop_index("uq_join_requests_pending", table_name="board_join_requests")
    op.drop_table("board_join_requests")
    sa.Enum(name="join_request_status").drop(op.get_bind(), checkfirst=True)

    op.drop_index("uq_boards_invite_token", table_name="boards")
    op.drop_column("boards", "invite_token")
    visibility = sa.Enum("public", "private", name="board_visibility")
    visibility.create(op.get_bind(), checkfirst=True)
    op.add_column("boards", sa.Column("visibility", visibility, server_default="private", nullable=False))
