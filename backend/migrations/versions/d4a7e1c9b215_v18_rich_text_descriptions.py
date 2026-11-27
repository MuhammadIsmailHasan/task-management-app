import sqlalchemy as sa
from alembic import op

from app.common.rich_text import from_plain_text, to_text

revision = "d4a7e1c9b215"
down_revision = "c7d2e9f4a118"
branch_labels = None
depends_on = None


def _rewrite(table, convert):
    bind = op.get_bind()
    rows = bind.execute(sa.text(f"SELECT id, description FROM {table} WHERE description IS NOT NULL")).all()
    for row_id, value in rows:
        bind.execute(sa.text(f"UPDATE {table} SET description = :d WHERE id = :i"), {"d": convert(value), "i": row_id})


def upgrade():
    op.alter_column("boards", "description", type_=sa.Text(), existing_nullable=True)
    for table in ("boards", "cards"):
        _rewrite(table, lambda v: v if v.lstrip().startswith("<") else from_plain_text(v))


def downgrade():
    for table in ("boards", "cards"):
        _rewrite(table, lambda v: to_text(v)[:500] if table == "boards" else to_text(v))
    op.alter_column("boards", "description", type_=sa.String(500), existing_nullable=True)
