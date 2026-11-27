import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "c7d2e9f4a118"
down_revision = "b8e4c2a9d713"
branch_labels = None
depends_on = None


def upgrade():
    for table in ("subtasks", "attachments"):
        op.add_column(table, sa.Column("created_by_id", UUID(as_uuid=True), nullable=True))
        op.create_foreign_key(f"fk_{table}_created_by_id_users", table, "users", ["created_by_id"], ["id"], ondelete="SET NULL")
    stale = op.get_bind().execute(
        sa.text("SELECT count(*) FROM cards c JOIN users u ON u.id = c.assignee_id WHERE u.role IN ('manager', 'admin') AND c.deleted_at IS NULL")
    ).scalar()
    if stale:
        print(f"v18: {stale} card(s) are still assigned to a manager or admin; staff can reassign them.")


def downgrade():
    for table in ("attachments", "subtasks"):
        op.drop_constraint(f"fk_{table}_created_by_id_users", table, type_="foreignkey")
        op.drop_column(table, "created_by_id")
