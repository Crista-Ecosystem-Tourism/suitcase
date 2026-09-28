"""Add trip memberships and one-use invitations for group expenses."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004_trip_membership_invites"
down_revision: Union[str, Sequence[str], None] = "0003_trip_completion_draft"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "suitcase_trip_member",
        sa.Column("trip_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("role IN ('owner', 'member')", name="role_allowed"),
        sa.ForeignKeyConstraint(["trip_id"], ["suitcase_trip.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["app_user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("trip_id", "user_id"),
    )
    op.create_index("ix_suitcase_trip_member_user_id", "suitcase_trip_member", ["user_id"])
    op.execute(
        """
        INSERT INTO suitcase_trip_member (trip_id, user_id, role, joined_at)
        SELECT id, user_id, 'owner', created_at FROM suitcase_trip
        ON CONFLICT (trip_id, user_id) DO NOTHING
        """
    )

    op.create_table(
        "suitcase_trip_member_invite",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("trip_id", sa.String(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("created_by_user_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("accepted_by_user_id", sa.String(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["trip_id"], ["suitcase_trip.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["app_user.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["accepted_by_user_id"], ["app_user.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_suitcase_trip_member_invite_trip_id", "suitcase_trip_member_invite", ["trip_id"])
    op.create_index("ix_suitcase_trip_member_invite_expires_at", "suitcase_trip_member_invite", ["expires_at"])


def downgrade() -> None:
    bind = op.get_bind()
    invite_count = bind.execute(sa.text("SELECT count(*) FROM suitcase_trip_member_invite")).scalar_one()
    if invite_count:
        raise RuntimeError("Cannot downgrade while trip member invitations exist")
    shared_member_count = bind.execute(
        sa.text(
            """
            SELECT count(*)
            FROM suitcase_trip_member member
            JOIN suitcase_trip trip ON trip.id = member.trip_id
            WHERE member.role <> 'owner' OR member.user_id <> trip.user_id
            """
        )
    ).scalar_one()
    if shared_member_count:
        raise RuntimeError("Cannot downgrade while shared trip memberships exist")
    op.drop_index("ix_suitcase_trip_member_invite_expires_at", table_name="suitcase_trip_member_invite")
    op.drop_index("ix_suitcase_trip_member_invite_trip_id", table_name="suitcase_trip_member_invite")
    op.drop_table("suitcase_trip_member_invite")
    op.drop_index("ix_suitcase_trip_member_user_id", table_name="suitcase_trip_member")
    op.drop_table("suitcase_trip_member")
