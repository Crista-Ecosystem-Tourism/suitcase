"""Store user-owned Expo push device tokens."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0007_push_devices"
down_revision: Union[str, Sequence[str], None] = "0006_expense_settlements"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "suitcase_push_device",
        sa.Column("expo_push_token", sa.String(length=255), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("platform", sa.String(length=16), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("platform IN ('ios', 'android')", name="platform_allowed"),
        sa.ForeignKeyConstraint(["user_id"], ["app_user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("expo_push_token"),
    )
    op.create_index("ix_suitcase_push_device_user_id", "suitcase_push_device", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_suitcase_push_device_user_id", table_name="suitcase_push_device")
    op.drop_table("suitcase_push_device")
