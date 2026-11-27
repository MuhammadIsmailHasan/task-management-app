import re

import sqlalchemy as sa
from alembic import op

revision = "e5a9c3d7f104"
down_revision = "d4f8b2c6e903"
branch_labels = None
depends_on = None

_STRIP = re.compile(r"[^a-z0-9]")


def _slugify(name):
    words = (_STRIP.sub("", w) for w in (name or "").lower().split())
    return "-".join(w for w in words if w) or "board"


def upgrade():
    with op.batch_alter_table("boards") as batch:
        batch.add_column(sa.Column("slug", sa.String(length=300), nullable=True))
    bind = op.get_bind()
    boards = sa.table("boards", sa.column("id"), sa.column("name"), sa.column("slug"), sa.column("created_at"))
    rows = bind.execute(sa.select(boards.c.id, boards.c.name).order_by(boards.c.created_at, boards.c.id)).all()
    taken = set()
    for board_id, name in rows:
        base = _slugify(name)
        slug, n = base, 2
        while slug in taken:
            slug = f"{base}-{n}"
            n += 1
        taken.add(slug)
        bind.execute(boards.update().where(boards.c.id == board_id).values(slug=slug))
    with op.batch_alter_table("boards") as batch:
        batch.alter_column("slug", existing_type=sa.String(length=300), nullable=False)
    op.create_index("uq_boards_slug", "boards", ["slug"], unique=True)


def downgrade():
    op.drop_index("uq_boards_slug", table_name="boards")
    with op.batch_alter_table("boards") as batch:
        batch.drop_column("slug")
