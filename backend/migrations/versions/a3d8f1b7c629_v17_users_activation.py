"""v17: users.is_active, is_available, email_verified_at, pending_email, and email_tokens

Revision ID: a3d8f1b7c629
Revises: f1b6d8a2c405
Create Date: 2026-11-26 12:00:00

Every existing user stays active, available, and verified (email_verified_at is set to the migration time), so
nobody is locked out. Nothing is deleted.
"""
import sqlalchemy as sa
from alembic import op

revision = "a3d8f1b7c629"
down_revision = "f1b6d8a2c405"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))
        batch.add_column(sa.Column("is_available", sa.Boolean(), nullable=False, server_default=sa.true()))
        batch.add_column(sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("pending_email", sa.String(length=255), nullable=True))
    op.execute("UPDATE users SET email_verified_at = CURRENT_TIMESTAMP")
    purpose = sa.Enum("verify_email", "change_email", name="email_token_purpose")
    op.create_table(
        "email_tokens",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("purpose", purpose, nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("uq_email_tokens_hash", "email_tokens", ["token_hash"], unique=True)
    op.create_index("ix_email_tokens_user_purpose", "email_tokens", ["user_id", "purpose"])


def downgrade():
    op.drop_index("ix_email_tokens_user_purpose", table_name="email_tokens")
    op.drop_index("uq_email_tokens_hash", table_name="email_tokens")
    op.drop_table("email_tokens")
    sa.Enum(name="email_token_purpose").drop(op.get_bind(), checkfirst=True)
    with op.batch_alter_table("users") as batch:
        batch.drop_column("pending_email")
        batch.drop_column("email_verified_at")
        batch.drop_column("is_available")
        batch.drop_column("is_active")
