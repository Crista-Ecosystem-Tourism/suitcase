"""Create consent-gated trip publication snapshots."""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0002_trip_mini_site"
down_revision: Union[str, Sequence[str], None] = "0001_suitcase"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "suitcase_trip_publication",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("trip_id", sa.String(), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("visibility", sa.String(length=16), nullable=False),
        sa.Column("consent_version", sa.String(length=32), nullable=False),
        sa.Column("snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("consented_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("visibility IN ('public', 'link')", name="ck_suitcase_trip_publication_visibility_allowed"),
        sa.ForeignKeyConstraint(["trip_id"], ["suitcase_trip.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_suitcase_trip_publication"),
        sa.UniqueConstraint("trip_id", name="uq_suitcase_trip_publication_trip_id"),
        sa.UniqueConstraint("slug", name="uq_suitcase_trip_publication_slug"),
    )
def downgrade() -> None:
    op.drop_table("suitcase_trip_publication")
