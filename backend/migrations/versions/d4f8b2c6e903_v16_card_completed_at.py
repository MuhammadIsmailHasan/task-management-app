"""v16: cards.completed_at

Revision ID: d4f8b2c6e903
Revises: c9e1a5b7d302
Create Date: 2026-11-23 20:00:00

Adds the nullable completion time and backfills it from updated_at for every live Card that sits in a
Column named Done. Nothing is deleted or truncated, so it is safe on a production database with data.
"""
import sqlalchemy as sa
from alembic import op

revision = "d4f8b2c6e903"
down_revision = "c9e1a5b7d302"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("cards") as batch:
        batch.add_column(sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.execute(
        "UPDATE cards SET completed_at = updated_at "
        "WHERE deleted_at IS NULL AND column_id IN (SELECT id FROM columns WHERE name = 'Done')"
    )


def downgrade():
    with op.batch_alter_table("cards") as batch:
        batch.drop_column("completed_at")
