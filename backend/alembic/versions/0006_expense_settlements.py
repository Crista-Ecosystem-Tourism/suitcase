"""Record settled group-expense debts without currency conversion."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0006_expense_settlements"
down_revision: Union[str, Sequence[str], None] = "0005_expense_split_foundation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "suitcase_settlement",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("trip_id", sa.String(), nullable=False),
        sa.Column("from_user_id", sa.String(), nullable=False),
        sa.Column("to_user_id", sa.String(), nullable=False),
        sa.Column("amount", sa.Numeric(18, 4), nullable=False),
        sa.Column("currency", sa.String(length=8), nullable=False),
        sa.Column("created_by_user_id", sa.String(), nullable=False),
        sa.Column("settled_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("amount > 0", name="amount_positive"),
        sa.CheckConstraint("from_user_id <> to_user_id", name="different_participants"),
        sa.ForeignKeyConstraint(["trip_id"], ["suitcase_trip.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["from_user_id"], ["app_user.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["to_user_id"], ["app_user.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["app_user.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_suitcase_settlement_trip_id", "suitcase_settlement", ["trip_id"])


def downgrade() -> None:
    settlement_count = op.get_bind().execute(sa.text("SELECT count(*) FROM suitcase_settlement")).scalar_one()
    if settlement_count:
        raise RuntimeError("Cannot downgrade while group expense settlements exist")
    op.drop_index("ix_suitcase_settlement_trip_id", table_name="suitcase_settlement")
    op.drop_table("suitcase_settlement")
