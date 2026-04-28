"""create suitcase tables

Revision ID: 0001_suitcase
Revises:
Create Date: 2026-04-28

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0001_suitcase"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS suitcase_trip (
            id VARCHAR PRIMARY KEY,
            user_id VARCHAR NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
            country VARCHAR(200) NOT NULL,
            city VARCHAR(200) NOT NULL,
            start_date VARCHAR(32) NOT NULL,
            end_date VARCHAR(32) NOT NULL,
            image VARCHAR(1024),
            mood VARCHAR(100),
            route_json TEXT,
            impressions TEXT,
            photos JSONB,
            is_archived BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_suitcase_trip_user_id ON suitcase_trip (user_id)")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS suitcase_expense (
            id VARCHAR PRIMARY KEY,
            trip_id VARCHAR NOT NULL REFERENCES suitcase_trip(id) ON DELETE CASCADE,
            amount NUMERIC(18, 4) NOT NULL,
            category VARCHAR(64) NOT NULL,
            title VARCHAR(500) NOT NULL,
            date VARCHAR(32) NOT NULL,
            currency VARCHAR(8),
            created_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_suitcase_expense_trip_id ON suitcase_expense (trip_id)")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS suitcase_goal (
            id VARCHAR PRIMARY KEY,
            user_id VARCHAR NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
            title VARCHAR(300) NOT NULL,
            current INTEGER NOT NULL DEFAULT 0,
            total INTEGER NOT NULL DEFAULT 1,
            color VARCHAR(32) NOT NULL DEFAULT '#007AFF',
            created_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_suitcase_goal_user_id ON suitcase_goal (user_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS suitcase_goal")
    op.execute("DROP TABLE IF EXISTS suitcase_expense")
    op.execute("DROP TABLE IF EXISTS suitcase_trip")
