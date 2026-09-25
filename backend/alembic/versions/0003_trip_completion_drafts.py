"""Prepare a private mini-site draft when an owner completes a trip."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003_trip_completion_draft"
down_revision: Union[str, Sequence[str], None] = "0002_trip_mini_site"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("suitcase_trip", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.alter_column("suitcase_trip_publication", "slug", existing_type=sa.String(length=64), nullable=True)
    op.alter_column("suitcase_trip_publication", "visibility", existing_type=sa.String(length=16), nullable=True)
    op.alter_column("suitcase_trip_publication", "consent_version", existing_type=sa.String(length=32), nullable=True)
    op.alter_column("suitcase_trip_publication", "consented_at", existing_type=sa.DateTime(timezone=True), nullable=True)


def downgrade() -> None:
    # Never silently discard owner-created drafts during a schema downgrade.
    draft_count = op.get_bind().execute(
        sa.text("SELECT count(*) FROM suitcase_trip_publication WHERE slug IS NULL")
    ).scalar_one()
    if draft_count:
        raise RuntimeError("Cannot downgrade while private trip mini-site drafts exist")
    op.alter_column("suitcase_trip_publication", "consented_at", existing_type=sa.DateTime(timezone=True), nullable=False)
    op.alter_column("suitcase_trip_publication", "consent_version", existing_type=sa.String(length=32), nullable=False)
    op.alter_column("suitcase_trip_publication", "visibility", existing_type=sa.String(length=16), nullable=False)
    op.alter_column("suitcase_trip_publication", "slug", existing_type=sa.String(length=64), nullable=False)
    op.drop_column("suitcase_trip", "completed_at")
