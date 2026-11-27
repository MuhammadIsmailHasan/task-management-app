import sqlalchemy as sa
from alembic import op

revision = "f1b6d8a2c405"
down_revision = "e5a9c3d7f104"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("cards") as batch:
        batch.add_column(sa.Column("board_id", sa.UUID(), nullable=True))
    op.execute("UPDATE cards SET board_id = (SELECT columns.board_id FROM columns WHERE columns.id = cards.column_id)")
    with op.batch_alter_table("cards") as batch:
        batch.alter_column("board_id", existing_type=sa.UUID(), nullable=False)
        batch.create_foreign_key("fk_cards_board_id_boards", "boards", ["board_id"], ["id"])
        batch.alter_column("column_id", existing_type=sa.UUID(), nullable=True)
    op.create_index("ix_cards_board_id", "cards", ["board_id"])
    op.execute("UPDATE cards SET column_id = NULL WHERE archived_at IS NOT NULL")


def downgrade():
    op.execute(
        "UPDATE cards SET column_id = ("
        "SELECT columns.id FROM columns WHERE columns.board_id = cards.board_id ORDER BY columns.\"order\", columns.id LIMIT 1"
        ") WHERE column_id IS NULL"
    )
    op.drop_index("ix_cards_board_id", table_name="cards")
    with op.batch_alter_table("cards") as batch:
        batch.alter_column("column_id", existing_type=sa.UUID(), nullable=False)
        batch.drop_constraint("fk_cards_board_id_boards", type_="foreignkey")
        batch.drop_column("board_id")
