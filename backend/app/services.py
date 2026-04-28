from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import delete, func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SuitcaseExpense, SuitcaseGoal, SuitcaseTrip, User
from app.security import hash_password, verify_password

DEFAULT_SUITCASE_GOALS: list[dict[str, Any]] = [
    {"title": "Стран посещено", "current": 0, "total": 30, "color": "#007AFF"},
    {"title": "Чудес света", "current": 0, "total": 7, "color": "#FF9500"},
    {"title": "Фотографий в коллекции", "current": 0, "total": 1000, "color": "#AF52DE"},
    {"title": "Часов в полёте", "current": 0, "total": 200, "color": "#34C759"},
]


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    return (
        await db.execute(select(User).where(func.lower(User.email) == email.lower()))
    ).scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    return (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()


async def create_user(db: AsyncSession, email: str, password: str, name: str) -> User:
    now = datetime.now(timezone.utc)
    user_id = uuid.uuid4().hex
    await db.execute(
        insert(User).values(
            id=user_id,
            email=email.lower(),
            name=name,
            hashed_password=hash_password(password),
            auth_provider="password",
            is_active=True,
            created_at=now,
            updated_at=now,
        )
    )
    await db.commit()
    user = await get_user_by_id(db, user_id)
    if not user:
        raise RuntimeError("User was not created")
    return user


def can_login(user: User | None, password: str) -> bool:
    return bool(user and user.hashed_password and user.is_active and verify_password(password, user.hashed_password))


def trip_out(t: SuitcaseTrip) -> dict[str, Any]:
    return {
        "id": t.id,
        "country": t.country,
        "city": t.city,
        "start_date": t.start_date,
        "end_date": t.end_date,
        "image": t.image,
        "mood": t.mood,
        "route_json": t.route_json,
        "impressions": t.impressions,
        "photos": t.photos,
        "is_archived": t.is_archived,
        "created_at": _iso(t.created_at),
        "updated_at": _iso(t.updated_at),
    }


def expense_out(e: SuitcaseExpense) -> dict[str, Any]:
    amount = e.amount
    if isinstance(amount, Decimal):
        amount = float(amount)
    return {
        "id": e.id,
        "trip_id": e.trip_id,
        "amount": amount,
        "category": e.category,
        "title": e.title,
        "date": e.date,
        "currency": e.currency,
        "created_at": _iso(e.created_at),
        "updated_at": _iso(e.updated_at),
    }


def goal_out(g: SuitcaseGoal) -> dict[str, Any]:
    return {
        "id": g.id,
        "title": g.title,
        "current": g.current,
        "total": g.total,
        "color": g.color,
        "created_at": _iso(g.created_at),
        "updated_at": _iso(g.updated_at),
    }


async def get_trip_owned(db: AsyncSession, trip_id: str, user_id: str) -> SuitcaseTrip | None:
    trip = (await db.execute(select(SuitcaseTrip).where(SuitcaseTrip.id == trip_id))).scalar_one_or_none()
    if not trip or trip.user_id != user_id:
        return None
    return trip


async def ensure_default_goals(db: AsyncSession, user_id: str) -> None:
    count = (
        await db.execute(select(func.count()).select_from(SuitcaseGoal).where(SuitcaseGoal.user_id == user_id))
    ).scalar_one()
    if count:
        return
    now = datetime.now(timezone.utc)
    for item in DEFAULT_SUITCASE_GOALS:
        db.add(SuitcaseGoal(id=uuid.uuid4().hex, user_id=user_id, created_at=now, updated_at=now, **item))
    await db.commit()


async def workspace(db: AsyncSession, user_id: str) -> dict[str, Any]:
    await ensure_default_goals(db, user_id)
    trips = list(
        (
            await db.execute(
                select(SuitcaseTrip).where(SuitcaseTrip.user_id == user_id).order_by(SuitcaseTrip.start_date.desc())
            )
        ).scalars().all()
    )
    trip_ids = [t.id for t in trips]
    expenses: list[SuitcaseExpense] = []
    if trip_ids:
        expenses = list(
            (await db.execute(select(SuitcaseExpense).where(SuitcaseExpense.trip_id.in_(trip_ids)))).scalars().all()
        )
    goals = list(
        (
            await db.execute(
                select(SuitcaseGoal).where(SuitcaseGoal.user_id == user_id).order_by(SuitcaseGoal.created_at.asc())
            )
        ).scalars().all()
    )
    return {
        "trips": [trip_out(t) for t in trips],
        "expenses": [expense_out(e) for e in expenses],
        "goals": [goal_out(g) for g in goals],
    }


async def create_trip(db: AsyncSession, user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    trip = SuitcaseTrip(
        id=uuid.uuid4().hex,
        user_id=user_id,
        country=data["country"],
        city=data["city"],
        start_date=data["start_date"],
        end_date=data["end_date"],
        image=data.get("image"),
        mood=data.get("mood"),
        route_json=data.get("route_json"),
        impressions=data.get("impressions"),
        photos=data.get("photos"),
        is_archived=bool(data.get("is_archived", False)),
        created_at=now,
        updated_at=now,
    )
    db.add(trip)
    await db.commit()
    await db.refresh(trip)
    return trip_out(trip)


async def update_trip(db: AsyncSession, trip_id: str, user_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    trip = await get_trip_owned(db, trip_id, user_id)
    if not trip:
        return None
    for key, value in data.items():
        setattr(trip, key, value)
    trip.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(trip)
    return trip_out(trip)


async def delete_trip(db: AsyncSession, trip_id: str, user_id: str) -> bool:
    trip = await get_trip_owned(db, trip_id, user_id)
    if not trip:
        return False
    await db.execute(delete(SuitcaseTrip).where(SuitcaseTrip.id == trip_id))
    await db.commit()
    return True


async def create_expense(db: AsyncSession, user_id: str, trip_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    if not await get_trip_owned(db, trip_id, user_id):
        return None
    now = datetime.now(timezone.utc)
    expense = SuitcaseExpense(
        id=uuid.uuid4().hex,
        trip_id=trip_id,
        amount=float(data["amount"]),
        category=data["category"],
        title=data["title"],
        date=data["date"],
        currency=data.get("currency"),
        created_at=now,
        updated_at=now,
    )
    db.add(expense)
    await db.commit()
    await db.refresh(expense)
    return expense_out(expense)


async def update_expense(db: AsyncSession, expense_id: str, user_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    expense = (await db.execute(select(SuitcaseExpense).where(SuitcaseExpense.id == expense_id))).scalar_one_or_none()
    if not expense:
        return None
    trip = await get_trip_owned(db, expense.trip_id, user_id)
    if not trip:
        return None
    for key, value in data.items():
        setattr(expense, key, float(value) if key == "amount" else value)
    expense.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(expense)
    return expense_out(expense)


async def delete_expense(db: AsyncSession, expense_id: str, user_id: str) -> bool:
    expense = (await db.execute(select(SuitcaseExpense).where(SuitcaseExpense.id == expense_id))).scalar_one_or_none()
    if not expense:
        return False
    if not await get_trip_owned(db, expense.trip_id, user_id):
        return False
    await db.execute(delete(SuitcaseExpense).where(SuitcaseExpense.id == expense_id))
    await db.commit()
    return True


async def create_goal(db: AsyncSession, user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    goal = SuitcaseGoal(id=uuid.uuid4().hex, user_id=user_id, created_at=now, updated_at=now, **data)
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return goal_out(goal)


async def update_goal(db: AsyncSession, goal_id: str, user_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    goal = (await db.execute(select(SuitcaseGoal).where(SuitcaseGoal.id == goal_id))).scalar_one_or_none()
    if not goal or goal.user_id != user_id:
        return None
    for key, value in data.items():
        setattr(goal, key, value)
    goal.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(goal)
    return goal_out(goal)


async def delete_goal(db: AsyncSession, goal_id: str, user_id: str) -> bool:
    goal = (await db.execute(select(SuitcaseGoal).where(SuitcaseGoal.id == goal_id))).scalar_one_or_none()
    if not goal or goal.user_id != user_id:
        return False
    await db.execute(delete(SuitcaseGoal).where(SuitcaseGoal.id == goal_id))
    await db.commit()
    return True
