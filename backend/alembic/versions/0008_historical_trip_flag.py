"""mark past trip imports as historical records

Revision ID: 0008_historical_trip_flag
Revises: 0007_push_devices
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0008_historical_trip_flag"
down_revision: Union[str, Sequence[str], None] = "0007_push_devices"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "suitcase_trip",
        sa.Column("is_historical", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("suitcase_trip", "is_historical")
