from __future__ import annotations

import uuid
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_DOWN
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    SuitcaseExpense,
    SuitcaseExpenseShare,
    SuitcaseGoal,
    SuitcaseSettlement,
    SuitcaseTrip,
    SuitcaseTripMember,
    SuitcaseTripMemberInvite,
)

DEFAULT_SUITCASE_GOALS: list[dict[str, Any]] = [
    {"title": "Стран посещено", "current": 0, "total": 30, "color": "#007AFF"},
    {"title": "Чудес света", "current": 0, "total": 7, "color": "#FF9500"},
    {"title": "Фотографий в коллекции", "current": 0, "total": 1000, "color": "#AF52DE"},
    {"title": "Часов в полёте", "current": 0, "total": 200, "color": "#34C759"},
]


class StaleWriteError(ValueError):
    """The client edited a version that has changed on another device."""


class InvalidExpenseSplitError(ValueError):
    """The payer or shares do not describe an exact valid trip split."""


class InvalidSettlementError(ValueError):
    """A settlement would not reduce the sender's current trip debt."""


INVITE_LIFETIME = timedelta(days=7)
MONEY_QUANTUM = Decimal("0.0001")


def _invite_token_hash(invite_code: str) -> str:
    return hashlib.sha256(invite_code.encode("utf-8")).hexdigest()


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def trip_out(t: SuitcaseTrip, membership_role: str | None = None) -> dict[str, Any]:
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
        "completed_at": _iso(t.completed_at),
        "created_at": _iso(t.created_at),
        "updated_at": _iso(t.updated_at),
        "membership_role": membership_role,
    }


def expense_out(e: SuitcaseExpense, shares: list[SuitcaseExpenseShare] | None = None) -> dict[str, Any]:
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
        "paid_by_user_id": e.paid_by_user_id,
        "created_by_user_id": e.created_by_user_id,
        "shares": [
            {"user_id": share.user_id, "amount": format(share.amount, "f")}
            for share in (shares or [])
        ],
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


def trip_member_out(member: SuitcaseTripMember) -> dict[str, str]:
    return {
        "user_id": member.user_id,
        "role": member.role,
        "joined_at": _iso(member.joined_at) or "",
    }


async def get_trip_owned(db: AsyncSession, trip_id: str, user_id: str) -> SuitcaseTrip | None:
    trip = (await db.execute(select(SuitcaseTrip).where(SuitcaseTrip.id == trip_id))).scalar_one_or_none()
    if not trip or trip.user_id != user_id:
        return None
    return trip


async def get_trip_membership(db: AsyncSession, trip_id: str, user_id: str) -> SuitcaseTripMember | None:
    return await db.get(SuitcaseTripMember, {"trip_id": trip_id, "user_id": user_id})


async def _trip_member_ids(db: AsyncSession, trip_id: str) -> set[str]:
    return set(
        (await db.scalars(
            select(SuitcaseTripMember.user_id).where(SuitcaseTripMember.trip_id == trip_id)
        )).all()
    )


def _equal_shares(amount: Decimal, user_ids: list[str]) -> list[tuple[str, Decimal]]:
    base = (amount / len(user_ids)).quantize(MONEY_QUANTUM, rounding=ROUND_DOWN)
    remainder = amount - base * len(user_ids)
    return [
        (user_id, base + remainder if index == 0 else base)
        for index, user_id in enumerate(user_ids)
    ]


def _normalized_expense_shares(
    amount: Decimal,
    payer_id: str,
    data: dict[str, Any],
    member_ids: set[str],
) -> list[tuple[str, Decimal]]:
    custom_shares = data.get("shares")
    split_member_ids = data.get("split_member_ids")
    if custom_shares is not None and split_member_ids is not None:
        raise InvalidExpenseSplitError("choose either equal or custom shares")
    if custom_shares is not None:
        values = [(item["user_id"], Decimal(str(item["amount"]))) for item in custom_shares]
        if len({user_id for user_id, _ in values}) != len(values):
            raise InvalidExpenseSplitError("a participant can have only one share")
        if any(share <= 0 for _, share in values) or sum(share for _, share in values) != amount:
            raise InvalidExpenseSplitError("shares must exactly match the expense amount")
    elif split_member_ids is not None:
        if len(set(split_member_ids)) != len(split_member_ids):
            raise InvalidExpenseSplitError("a participant can have only one share")
        values = _equal_shares(amount, list(split_member_ids))
    else:
        values = [(payer_id, amount)]
    participant_ids = {user_id for user_id, _ in values}
    if payer_id not in member_ids or not participant_ids.issubset(member_ids):
        raise InvalidExpenseSplitError("expense participants must belong to the trip")
    return values


def _decimal_text(amount: Decimal) -> str:
    return format(amount, "f")


def _suggest_settlements(balances: dict[str, Decimal]) -> list[dict[str, str]]:
    debtors = [[user_id, -amount] for user_id, amount in sorted(balances.items()) if amount < 0]
    creditors = [[user_id, amount] for user_id, amount in sorted(balances.items()) if amount > 0]
    suggestions: list[dict[str, str]] = []
    debtor_index = creditor_index = 0
    while debtor_index < len(debtors) and creditor_index < len(creditors):
        debtor_id, debt = debtors[debtor_index]
        creditor_id, credit = creditors[creditor_index]
        settled = min(debt, credit)
        suggestions.append({
            "from_user_id": debtor_id,
            "to_user_id": creditor_id,
            "amount": _decimal_text(settled),
        })
        debtors[debtor_index][1] -= settled
        creditors[creditor_index][1] -= settled
        if debtors[debtor_index][1] == 0:
            debtor_index += 1
        if creditors[creditor_index][1] == 0:
            creditor_index += 1
    return suggestions


async def list_trip_members(db: AsyncSession, trip_id: str, user_id: str) -> list[dict[str, str]] | None:
    if not await get_trip_membership(db, trip_id, user_id):
        return None
    members = list(
        (
            await db.execute(
                select(SuitcaseTripMember)
                .where(SuitcaseTripMember.trip_id == trip_id)
                .order_by(SuitcaseTripMember.joined_at.asc())
            )
        ).scalars().all()
    )
    return [trip_member_out(member) for member in members]


async def trip_split_summary(db: AsyncSession, trip_id: str, user_id: str) -> dict[str, Any] | None:
    if not await get_trip_membership(db, trip_id, user_id):
        return None
    member_ids = await _trip_member_ids(db, trip_id)
    balances_by_currency: dict[str, dict[str, Decimal]] = {}
    expenses = list(
        (await db.scalars(select(SuitcaseExpense).where(SuitcaseExpense.trip_id == trip_id))).all()
    )
    expense_ids = [expense.id for expense in expenses]
    shares_by_expense: dict[str, list[SuitcaseExpenseShare]] = {}
    if expense_ids:
        for share in (
            await db.scalars(select(SuitcaseExpenseShare).where(SuitcaseExpenseShare.expense_id.in_(expense_ids)))
        ).all():
            shares_by_expense.setdefault(share.expense_id, []).append(share)
    for expense in expenses:
        currency = expense.currency or "RUB"
        balances = balances_by_currency.setdefault(currency, {member_id: Decimal("0") for member_id in member_ids})
        balances[expense.paid_by_user_id] = balances.get(expense.paid_by_user_id, Decimal("0")) + Decimal(str(expense.amount))
        for share in shares_by_expense.get(expense.id, []):
            balances[share.user_id] = balances.get(share.user_id, Decimal("0")) - Decimal(str(share.amount))
    settlements = list(
        (await db.scalars(select(SuitcaseSettlement).where(SuitcaseSettlement.trip_id == trip_id))).all()
    )
    for settlement in settlements:
        balances = balances_by_currency.setdefault(
            settlement.currency, {member_id: Decimal("0") for member_id in member_ids},
        )
        amount = Decimal(str(settlement.amount))
        balances[settlement.from_user_id] = balances.get(settlement.from_user_id, Decimal("0")) + amount
        balances[settlement.to_user_id] = balances.get(settlement.to_user_id, Decimal("0")) - amount
    return {
        "currencies": [
            {
                "currency": currency,
                "balances": [
                    {"user_id": member_id, "amount": _decimal_text(amount)}
                    for member_id, amount in sorted(balances.items())
                ],
                "suggested_settlements": _suggest_settlements(balances),
            }
            for currency, balances in sorted(balances_by_currency.items())
        ],
    }


async def create_settlement(
    db: AsyncSession, trip_id: str, from_user_id: str, data: dict[str, Any],
) -> dict[str, str] | None:
    if not await get_trip_membership(db, trip_id, from_user_id):
        return None
    # Serialize debt reductions per trip so concurrent confirmations cannot
    # settle the same outstanding balance twice.
    trip = await db.scalar(
        select(SuitcaseTrip).where(SuitcaseTrip.id == trip_id).with_for_update()
    )
    if trip is None:
        return None
    to_user_id = data["to_user_id"]
    amount = Decimal(str(data["amount"]))
    currency = data["currency"].upper()
    if to_user_id == from_user_id or to_user_id not in await _trip_member_ids(db, trip_id):
        raise InvalidSettlementError("settlement participants must belong to the trip")
    summary = await trip_split_summary(db, trip_id, from_user_id)
    assert summary is not None
    currency_summary = next((item for item in summary["currencies"] if item["currency"] == currency), None)
    current_balances = {
        item["user_id"]: Decimal(item["amount"])
        for item in (currency_summary or {"balances": []})["balances"]
    }
    if current_balances.get(from_user_id, Decimal("0")) + amount > 0:
        raise InvalidSettlementError("settlement exceeds the sender's outstanding debt")
    if current_balances.get(to_user_id, Decimal("0")) - amount < 0:
        raise InvalidSettlementError("settlement exceeds the recipient's credit")
    now = datetime.now(timezone.utc)
    settlement = SuitcaseSettlement(
        id=uuid.uuid4().hex,
        trip_id=trip_id,
        from_user_id=from_user_id,
        to_user_id=to_user_id,
        amount=amount,
        currency=currency,
        created_by_user_id=from_user_id,
        settled_at=now,
    )
    db.add(settlement)
    await db.commit()
    return {
        "id": settlement.id,
        "from_user_id": settlement.from_user_id,
        "to_user_id": settlement.to_user_id,
        "amount": _decimal_text(settlement.amount),
        "currency": settlement.currency,
        "settled_at": settlement.settled_at.isoformat(),
    }


async def create_trip_member_invite(
    db: AsyncSession, trip_id: str, owner_id: str,
) -> dict[str, str] | None:
    if not await get_trip_owned(db, trip_id, owner_id):
        return None
    now = datetime.now(timezone.utc)
    invite_code = secrets.token_urlsafe(32)
    invite = SuitcaseTripMemberInvite(
        id=uuid.uuid4().hex,
        trip_id=trip_id,
        token_hash=_invite_token_hash(invite_code),
        created_by_user_id=owner_id,
        created_at=now,
        expires_at=now + INVITE_LIFETIME,
    )
    db.add(invite)
    await db.commit()
    return {
        "id": invite.id,
        "invite_code": invite_code,
        "expires_at": invite.expires_at.isoformat(),
    }


async def accept_trip_member_invite(
    db: AsyncSession, user_id: str, invite_code: str,
) -> dict[str, Any] | None:
    invite = await db.scalar(
        select(SuitcaseTripMemberInvite)
        .where(SuitcaseTripMemberInvite.token_hash == _invite_token_hash(invite_code))
        .with_for_update()
    )
    now = datetime.now(timezone.utc)
    if (
        invite is None
        or invite.revoked_at is not None
        or invite.expires_at <= now
        or invite.created_by_user_id == user_id
        or (invite.accepted_at is not None and invite.accepted_by_user_id != user_id)
    ):
        return None
    if invite.accepted_at is not None:
        return {"trip_id": invite.trip_id, "created": False}

    member = await get_trip_membership(db, invite.trip_id, user_id)
    if member is None:
        db.add(SuitcaseTripMember(
            trip_id=invite.trip_id,
            user_id=user_id,
            role="member",
            joined_at=now,
        ))
    invite.accepted_at = now
    invite.accepted_by_user_id = user_id
    await db.commit()
    return {"trip_id": invite.trip_id, "created": member is None}


async def revoke_trip_member_invite(
    db: AsyncSession, trip_id: str, invite_id: str, owner_id: str,
) -> bool:
    if not await get_trip_owned(db, trip_id, owner_id):
        return False
    invite = await db.scalar(
        select(SuitcaseTripMemberInvite).where(
            SuitcaseTripMemberInvite.id == invite_id,
            SuitcaseTripMemberInvite.trip_id == trip_id,
        ).with_for_update()
    )
    if invite is None or invite.accepted_at is not None:
        return False
    if invite.revoked_at is None:
        invite.revoked_at = datetime.now(timezone.utc)
        await db.commit()
    return True


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
    trip_rows = list(
        (
            await db.execute(
                select(SuitcaseTrip, SuitcaseTripMember.role)
                .join(SuitcaseTripMember, SuitcaseTripMember.trip_id == SuitcaseTrip.id)
                .where(SuitcaseTripMember.user_id == user_id)
                .order_by(SuitcaseTrip.start_date.desc())
            )
        ).all()
    )
    trips = [trip for trip, _ in trip_rows]
    trip_ids = [t.id for t in trips]
    expenses: list[SuitcaseExpense] = []
    if trip_ids:
        expenses = list(
            (await db.execute(select(SuitcaseExpense).where(SuitcaseExpense.trip_id.in_(trip_ids)))).scalars().all()
        )
    expense_ids = [expense.id for expense in expenses]
    shares_by_expense: dict[str, list[SuitcaseExpenseShare]] = {}
    if expense_ids:
        for share in (
            await db.scalars(select(SuitcaseExpenseShare).where(SuitcaseExpenseShare.expense_id.in_(expense_ids)))
        ).all():
            shares_by_expense.setdefault(share.expense_id, []).append(share)
    goals = list(
        (
            await db.execute(
                select(SuitcaseGoal).where(SuitcaseGoal.user_id == user_id).order_by(SuitcaseGoal.created_at.asc())
            )
        ).scalars().all()
    )
    return {
        "trips": [trip_out(trip, role) for trip, role in trip_rows],
        "expenses": [expense_out(expense, shares_by_expense.get(expense.id)) for expense in expenses],
        "goals": [goal_out(g) for g in goals],
    }


async def create_trip(db: AsyncSession, user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    client_request_id = data.pop("client_request_id", None)
    if client_request_id:
        existing = await db.get(SuitcaseTrip, client_request_id)
        if existing:
            if existing.user_id != user_id:
                raise ValueError("client request ID already belongs to another account")
            return trip_out(existing)
    now = datetime.now(timezone.utc)
    trip = SuitcaseTrip(
        id=client_request_id or uuid.uuid4().hex,
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
    db.add(SuitcaseTripMember(
        trip_id=trip.id,
        user_id=user_id,
        role="owner",
        joined_at=now,
    ))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        if not client_request_id:
            raise
        existing = await db.get(SuitcaseTrip, client_request_id)
        if existing and existing.user_id == user_id:
            return trip_out(existing)
        raise ValueError("client request ID already belongs to another account")
    await db.refresh(trip)
    return trip_out(trip)


async def update_trip(db: AsyncSession, trip_id: str, user_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    trip = await get_trip_owned(db, trip_id, user_id)
    if not trip:
        return None
    expected_updated_at = data.pop("base_updated_at", None)
    if expected_updated_at is not None and expected_updated_at != _iso(trip.updated_at):
        raise StaleWriteError
    for key, value in data.items():
        setattr(trip, key, value)
    trip.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(trip)
    return trip_out(trip)


async def delete_trip(
    db: AsyncSession,
    trip_id: str,
    user_id: str,
    expected_updated_at: str | None = None,
) -> bool:
    trip = await get_trip_owned(db, trip_id, user_id)
    if not trip:
        return False
    if expected_updated_at is not None and expected_updated_at != _iso(trip.updated_at):
        raise StaleWriteError
    await db.execute(delete(SuitcaseTrip).where(SuitcaseTrip.id == trip_id))
    await db.commit()
    return True


async def create_expense(db: AsyncSession, user_id: str, trip_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    if not await get_trip_membership(db, trip_id, user_id):
        return None
    client_request_id = data.pop("client_request_id", None)
    if client_request_id:
        existing = await db.get(SuitcaseExpense, client_request_id)
        if existing:
            if existing.trip_id != trip_id:
                raise ValueError("client request ID already belongs to another expense")
            shares = list(
                (await db.scalars(
                    select(SuitcaseExpenseShare).where(SuitcaseExpenseShare.expense_id == existing.id)
                )).all()
            )
            return expense_out(existing, shares)
    amount = Decimal(str(data["amount"]))
    payer_id = data.get("paid_by_user_id") or user_id
    shares = _normalized_expense_shares(amount, payer_id, data, await _trip_member_ids(db, trip_id))
    now = datetime.now(timezone.utc)
    expense = SuitcaseExpense(
        id=client_request_id or uuid.uuid4().hex,
        trip_id=trip_id,
        amount=amount,
        category=data["category"],
        title=data["title"],
        date=data["date"],
        currency=data.get("currency"),
        paid_by_user_id=payer_id,
        created_by_user_id=user_id,
        created_at=now,
        updated_at=now,
    )
    db.add(expense)
    for participant_id, share_amount in shares:
        db.add(SuitcaseExpenseShare(
            expense_id=expense.id,
            user_id=participant_id,
            amount=share_amount,
        ))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        if not client_request_id:
            raise
        existing = await db.get(SuitcaseExpense, client_request_id)
        if existing and existing.trip_id == trip_id:
            existing_shares = list(
                (await db.scalars(
                    select(SuitcaseExpenseShare).where(SuitcaseExpenseShare.expense_id == existing.id)
                )).all()
            )
            return expense_out(existing, existing_shares)
        raise ValueError("client request ID already belongs to another expense")
    await db.refresh(expense)
    return expense_out(expense, list((await db.scalars(
        select(SuitcaseExpenseShare).where(SuitcaseExpenseShare.expense_id == expense.id)
    )).all()))


async def update_expense(db: AsyncSession, expense_id: str, user_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    expense = (await db.execute(select(SuitcaseExpense).where(SuitcaseExpense.id == expense_id))).scalar_one_or_none()
    if not expense:
        return None
    if not await get_trip_membership(db, expense.trip_id, user_id):
        return None
    expected_updated_at = data.pop("base_updated_at", None)
    if expected_updated_at is not None and expected_updated_at != _iso(expense.updated_at):
        raise StaleWriteError
    shares = list(
        (await db.scalars(
            select(SuitcaseExpenseShare).where(SuitcaseExpenseShare.expense_id == expense.id)
        )).all()
    )
    if "amount" in data:
        updated_amount = Decimal(str(data["amount"]))
        if len(shares) != 1 or shares[0].user_id != expense.paid_by_user_id:
            raise InvalidExpenseSplitError("update the split together with a shared expense amount")
        shares[0].amount = updated_amount
    for key, value in data.items():
        setattr(expense, key, Decimal(str(value)) if key == "amount" else value)
    expense.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(expense)
    return expense_out(expense, shares)


async def delete_expense(
    db: AsyncSession,
    expense_id: str,
    user_id: str,
    expected_updated_at: str | None = None,
) -> bool:
    expense = (await db.execute(select(SuitcaseExpense).where(SuitcaseExpense.id == expense_id))).scalar_one_or_none()
    if not expense:
        return False
    if not await get_trip_membership(db, expense.trip_id, user_id):
        return False
    if expected_updated_at is not None and expected_updated_at != _iso(expense.updated_at):
        raise StaleWriteError
    await db.execute(delete(SuitcaseExpense).where(SuitcaseExpense.id == expense_id))
    await db.commit()
    return True


async def create_goal(db: AsyncSession, user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    client_request_id = data.pop("client_request_id", None)
    if client_request_id:
        existing = await db.get(SuitcaseGoal, client_request_id)
        if existing:
            if existing.user_id != user_id:
                raise ValueError("client request ID already belongs to another account")
            return goal_out(existing)
    now = datetime.now(timezone.utc)
    goal = SuitcaseGoal(
        id=client_request_id or uuid.uuid4().hex,
        user_id=user_id,
        created_at=now,
        updated_at=now,
        **data,
    )
    db.add(goal)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        if not client_request_id:
            raise
        existing = await db.get(SuitcaseGoal, client_request_id)
        if existing and existing.user_id == user_id:
            return goal_out(existing)
        raise ValueError("client request ID already belongs to another account")
    await db.refresh(goal)
    return goal_out(goal)


async def update_goal(db: AsyncSession, goal_id: str, user_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    goal = (await db.execute(select(SuitcaseGoal).where(SuitcaseGoal.id == goal_id))).scalar_one_or_none()
    if not goal or goal.user_id != user_id:
        return None
    expected_updated_at = data.pop("base_updated_at", None)
    if expected_updated_at is not None and expected_updated_at != _iso(goal.updated_at):
        raise StaleWriteError
    for key, value in data.items():
        setattr(goal, key, value)
    goal.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(goal)
    return goal_out(goal)


async def delete_goal(
    db: AsyncSession,
    goal_id: str,
    user_id: str,
    expected_updated_at: str | None = None,
) -> bool:
    goal = (await db.execute(select(SuitcaseGoal).where(SuitcaseGoal.id == goal_id))).scalar_one_or_none()
    if not goal or goal.user_id != user_id:
        return False
    if expected_updated_at is not None and expected_updated_at != _iso(goal.updated_at):
        raise StaleWriteError
    await db.execute(delete(SuitcaseGoal).where(SuitcaseGoal.id == goal_id))
    await db.commit()
    return True
