from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, MetaData, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class User(Base, TimestampMixin):
    """Shared Crista account table owned by the main auth service."""

    __tablename__ = "app_user"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    email: Mapped[Optional[str]] = mapped_column(String, unique=True, nullable=True, index=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    auth_provider: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    hashed_password: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    __table_args__ = (Index("idx_user_email", "email"),)


class SuitcaseTrip(Base, TimestampMixin):
    __tablename__ = "suitcase_trip"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("app_user.id", ondelete="CASCADE"), nullable=False, index=True)
    country: Mapped[str] = mapped_column(String(200), nullable=False)
    city: Mapped[str] = mapped_column(String(200), nullable=False)
    start_date: Mapped[str] = mapped_column(String(32), nullable=False)
    end_date: Mapped[str] = mapped_column(String(32), nullable=False)
    image: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    mood: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    route_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    impressions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    photos: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class SuitcaseExpense(Base, TimestampMixin):
    __tablename__ = "suitcase_expense"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    trip_id: Mapped[str] = mapped_column(
        ForeignKey("suitcase_trip.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    amount: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    date: Mapped[str] = mapped_column(String(32), nullable=False)
    currency: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)


class SuitcaseGoal(Base, TimestampMixin):
    __tablename__ = "suitcase_goal"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("app_user.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    current: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    color: Mapped[str] = mapped_column(String(32), nullable=False, default="#007AFF")
