import sqlalchemy as sa
from alembic import op

revision = "a1c3f7e9b204"
down_revision = "532f2dabeba9"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("boards") as batch:
        batch.add_column(sa.Column("description", sa.String(length=500), nullable=True))


def downgrade():
    with op.batch_alter_table("boards") as batch:
        batch.drop_column("description")
