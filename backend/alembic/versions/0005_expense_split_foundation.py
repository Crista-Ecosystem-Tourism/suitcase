"""Add payer and exact split shares to Suitcase expenses."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0005_expense_split_foundation"
down_revision: Union[str, Sequence[str], None] = "0004_trip_membership_invites"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("suitcase_expense", sa.Column("paid_by_user_id", sa.String(), nullable=True))
    op.add_column("suitcase_expense", sa.Column("created_by_user_id", sa.String(), nullable=True))
    op.execute(
        """
        UPDATE suitcase_expense expense
        SET paid_by_user_id = trip.user_id, created_by_user_id = trip.user_id
        FROM suitcase_trip trip
        WHERE trip.id = expense.trip_id
        """
    )
    op.alter_column("suitcase_expense", "paid_by_user_id", existing_type=sa.String(), nullable=False)
    op.alter_column("suitcase_expense", "created_by_user_id", existing_type=sa.String(), nullable=False)
    op.create_foreign_key(
        "fk_suitcase_expense_paid_by_user_id_app_user",
        "suitcase_expense", "app_user", ["paid_by_user_id"], ["id"], ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_suitcase_expense_created_by_user_id_app_user",
        "suitcase_expense", "app_user", ["created_by_user_id"], ["id"], ondelete="RESTRICT",
    )
    op.create_table(
        "suitcase_expense_share",
        sa.Column("expense_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("amount", sa.Numeric(18, 4), nullable=False),
        sa.CheckConstraint("amount > 0", name="amount_positive"),
        sa.ForeignKeyConstraint(["expense_id"], ["suitcase_expense.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["app_user.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("expense_id", "user_id"),
    )
    op.execute(
        """
        INSERT INTO suitcase_expense_share (expense_id, user_id, amount)
        SELECT id, paid_by_user_id, amount FROM suitcase_expense
        WHERE amount > 0
        """
    )


def downgrade() -> None:
    split_count = op.get_bind().execute(
        sa.text("SELECT count(*) FROM suitcase_expense_share")
    ).scalar_one()
    if split_count:
        raise RuntimeError("Cannot downgrade while expense split shares exist")
    op.drop_table("suitcase_expense_share")
    op.drop_constraint("fk_suitcase_expense_created_by_user_id_app_user", "suitcase_expense", type_="foreignkey")
    op.drop_constraint("fk_suitcase_expense_paid_by_user_id_app_user", "suitcase_expense", type_="foreignkey")
    op.drop_column("suitcase_expense", "created_by_user_id")
    op.drop_column("suitcase_expense", "paid_by_user_id")
