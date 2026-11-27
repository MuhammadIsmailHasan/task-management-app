import os

import sqlalchemy as sa
from alembic import op

revision = "b7d2e4f6a801"
down_revision = "a1c3f7e9b204"
branch_labels = None
depends_on = None

_SCOPES = ("login_pair", "login_ip", "availability", "change_password")


def upgrade():
    if (os.environ.get("APP_ENV") or "production").strip().lower() in ("development", "testing"):
        op.execute("TRUNCATE TABLE users CASCADE")
        print("Local data was reset. Run `flask seed-users` or `flask seed-data`.")
    elif op.get_bind().execute(sa.text("SELECT 1 FROM users LIMIT 1")).first():
        raise RuntimeError("This migration cannot keep existing users and the users table is not empty; nothing was changed")

    op.add_column("users", sa.Column("username", sa.String(length=30), nullable=False))
    op.add_column("users", sa.Column("email", sa.String(length=255), nullable=False))
    op.execute("CREATE UNIQUE INDEX uq_users_username_lower ON users (lower(username))")
    op.execute("CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email))")
    op.execute("DROP INDEX uq_users_login_identifier_lower")
    op.drop_column("users", "login_identifier")
    op.add_column("users", sa.Column("avatar_path", sa.String(length=64), nullable=True))
    op.drop_column("users", "avatar_url")

    op.add_column("boards", sa.Column("share_token", sa.String(length=64), nullable=True))
    op.create_index(
        "uq_boards_share_token", "boards", ["share_token"], unique=True, postgresql_where=sa.text("share_token IS NOT NULL")
    )

    op.create_table(
        "rate_limit_attempts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("scope", sa.Enum(*_SCOPES, name="rate_limit_scope"), nullable=False),
        sa.Column("key_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_rate_limit_scope_key_created", "rate_limit_attempts", ["scope", "key_hash", "created_at"])


def downgrade():
    op.drop_index("ix_rate_limit_scope_key_created", table_name="rate_limit_attempts")
    op.drop_table("rate_limit_attempts")
    sa.Enum(name="rate_limit_scope").drop(op.get_bind(), checkfirst=True)

    op.drop_index("uq_boards_share_token", table_name="boards")
    op.drop_column("boards", "share_token")

    op.add_column("users", sa.Column("avatar_url", sa.String(length=1024), nullable=True))
    op.drop_column("users", "avatar_path")
    op.add_column("users", sa.Column("login_identifier", sa.String(length=255), nullable=True))
    op.execute("UPDATE users SET login_identifier = email")
    op.alter_column("users", "login_identifier", nullable=False)
    op.execute("CREATE UNIQUE INDEX uq_users_login_identifier_lower ON users (lower(login_identifier))")
    op.execute("DROP INDEX uq_users_username_lower")
    op.execute("DROP INDEX uq_users_email_lower")
    op.drop_column("users", "email")
    op.drop_column("users", "username")
