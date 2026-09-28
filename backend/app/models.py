from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, MetaData, Numeric, String, Text
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


class SuitcaseTrip(Base, TimestampMixin):
    __tablename__ = "suitcase_trip"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    # ``app_user`` belongs to ai_agent. Its database foreign key is declared in
    # the Suitcase migration, while this independent ORM metadata keeps only the
    # external identity so it does not try to own or resolve the auth table.
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
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
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class SuitcaseTripPublication(Base, TimestampMixin):
    __tablename__ = "suitcase_trip_publication"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    trip_id: Mapped[str] = mapped_column(
        ForeignKey("suitcase_trip.id", ondelete="CASCADE"), nullable=False, unique=True,
    )
    slug: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, unique=True)
    visibility: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    consent_version: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    consented_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint("visibility IN ('public', 'link')", name="visibility_allowed"),
    )


class SuitcaseTripMember(Base):
    __tablename__ = "suitcase_trip_member"

    trip_id: Mapped[str] = mapped_column(
        ForeignKey("suitcase_trip.id", ondelete="CASCADE"), primary_key=True,
    )
    # Identity is owned by ai_agent; its foreign key is retained in the
    # migration without coupling this standalone ORM to the auth metadata.
    user_id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    __table_args__ = (
        CheckConstraint("role IN ('owner', 'member')", name="role_allowed"),
    )


class SuitcaseTripMemberInvite(Base):
    __tablename__ = "suitcase_trip_member_invite"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    trip_id: Mapped[str] = mapped_column(
        ForeignKey("suitcase_trip.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    created_by_user_id: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    accepted_by_user_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


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
    paid_by_user_id: Mapped[str] = mapped_column(String, nullable=False)
    created_by_user_id: Mapped[str] = mapped_column(String, nullable=False)


class SuitcaseExpenseShare(Base):
    __tablename__ = "suitcase_expense_share"

    expense_id: Mapped[str] = mapped_column(
        ForeignKey("suitcase_expense.id", ondelete="CASCADE"), primary_key=True,
    )
    # Identity is owned by ai_agent; the migration provides the database FK.
    user_id: Mapped[str] = mapped_column(String, primary_key=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)

    __table_args__ = (
        CheckConstraint("amount > 0", name="amount_positive"),
    )


class SuitcaseSettlement(Base):
    __tablename__ = "suitcase_settlement"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    trip_id: Mapped[str] = mapped_column(
        ForeignKey("suitcase_trip.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    from_user_id: Mapped[str] = mapped_column(String, nullable=False)
    to_user_id: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), nullable=False)
    created_by_user_id: Mapped[str] = mapped_column(String, nullable=False)
    settled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    __table_args__ = (
        CheckConstraint("amount > 0", name="amount_positive"),
        CheckConstraint("from_user_id <> to_user_id", name="different_participants"),
    )


class SuitcaseGoal(Base, TimestampMixin):
    __tablename__ = "suitcase_goal"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    current: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    color: Mapped[str] = mapped_column(String(32), nullable=False, default="#007AFF")


class SuitcasePushDevice(Base, TimestampMixin):
    __tablename__ = "suitcase_push_device"

    expo_push_token: Mapped[str] = mapped_column(String(255), primary_key=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    platform: Mapped[str] = mapped_column(String(16), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        CheckConstraint("platform IN ('ios', 'android')", name="platform_allowed"),
    )
