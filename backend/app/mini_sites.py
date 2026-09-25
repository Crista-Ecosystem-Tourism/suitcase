from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.mini_site_policy import build_trip_snapshot
from app.game_stamp_ticket import verify_game_stamp_ticket
from app.models import SuitcaseTrip, SuitcaseTripPublication

CONSENT_VERSION = "trip-mini-site-v2-game-stamps"


def _owner_payload(
    publication: SuitcaseTripPublication | None, trip: SuitcaseTrip,
    preview_snapshot: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if publication is None or publication.revoked_at is not None:
        return {
            "published": False,
            "draft_ready": False,
            "slug": None,
            "visibility": None,
            "consented_at": None,
            "completed_at": trip.completed_at.isoformat() if trip.completed_at else None,
            "draft_snapshot": None,
            "preview_snapshot": preview_snapshot or build_trip_snapshot(trip),
            "published_snapshot": None,
        }
    published = publication.slug is not None and publication.consented_at is not None
    return {
        "published": published,
        "draft_ready": not published,
        "slug": publication.slug,
        "visibility": publication.visibility,
        "consented_at": publication.consented_at.isoformat() if publication.consented_at else None,
        "completed_at": trip.completed_at.isoformat() if trip.completed_at else None,
        "draft_snapshot": publication.snapshot if not published else None,
        "published_snapshot": publication.snapshot if published else None,
        # Active links can be refreshed against current trip data after a new
        # review/consent; keep the current link live until that write commits.
        "preview_snapshot": preview_snapshot or (build_trip_snapshot(trip) if published else publication.snapshot),
    }


async def get_mini_site(db: AsyncSession, trip_id: str, user_id: str) -> dict[str, Any] | None:
    trip = await db.scalar(select(SuitcaseTrip).where(
        SuitcaseTrip.id == trip_id, SuitcaseTrip.user_id == user_id,
    ))
    if trip is None:
        return None
    publication = await db.scalar(select(SuitcaseTripPublication).where(
        SuitcaseTripPublication.trip_id == trip_id,
    ))
    return _owner_payload(publication, trip)


async def complete_trip(
    db: AsyncSession,
    trip_id: str,
    user_id: str,
    game_stamp_ticket: str | None = None,
) -> dict[str, Any] | None:
    """Mark a trip complete and prepare a private draft without granting publication consent."""
    game_stamps = verify_game_stamp_ticket(game_stamp_ticket, user_id)
    trip = await db.scalar(select(SuitcaseTrip).where(
        SuitcaseTrip.id == trip_id, SuitcaseTrip.user_id == user_id,
    ).with_for_update())
    if trip is None:
        return None

    now = datetime.now(timezone.utc)
    if trip.completed_at is None:
        trip.completed_at = now
        trip.updated_at = now
    publication = await db.scalar(select(SuitcaseTripPublication).where(
        SuitcaseTripPublication.trip_id == trip_id,
    ).with_for_update())
    if publication is None:
        publication = SuitcaseTripPublication(
            id=uuid.uuid4().hex,
            trip_id=trip_id,
            slug=None,
            visibility=None,
            consent_version=None,
            snapshot=build_trip_snapshot(trip, game_stamps),
            consented_at=None,
            revoked_at=None,
            created_at=now,
            updated_at=now,
        )
        db.add(publication)
    elif publication.slug is None and publication.revoked_at is None:
        # A repeated completion refreshes only an unpublished draft. Published or
        # revoked snapshots are deliberately left untouched.
        publication.snapshot = build_trip_snapshot(trip, game_stamps)
        publication.updated_at = now
    elif publication.slug is not None and publication.revoked_at is None:
        # Preview a refreshed, attested selection without changing the live URL
        # or the currently published point-in-time snapshot.
        await db.commit()
        await db.refresh(publication)
        return _owner_payload(
            publication, trip, preview_snapshot=build_trip_snapshot(trip, game_stamps),
        )
    elif publication.revoked_at is not None:
        await db.commit()
        await db.refresh(publication)
        return _owner_payload(
            publication, trip, preview_snapshot=build_trip_snapshot(trip, game_stamps),
        )
    await db.commit()
    await db.refresh(publication)
    return _owner_payload(publication, trip)


async def publish_mini_site(
    db: AsyncSession,
    trip_id: str,
    user_id: str,
    visibility: str,
    game_stamp_ticket: str | None = None,
) -> dict[str, Any] | None:
    game_stamps = verify_game_stamp_ticket(game_stamp_ticket, user_id)
    trip = await db.scalar(select(SuitcaseTrip).where(
        SuitcaseTrip.id == trip_id, SuitcaseTrip.user_id == user_id,
    ).with_for_update())
    if trip is None:
        return None
    publication = await db.scalar(select(SuitcaseTripPublication).where(
        SuitcaseTripPublication.trip_id == trip_id,
    ).with_for_update())
    now = datetime.now(timezone.utc)
    if publication is None:
        publication = SuitcaseTripPublication(
            id=uuid.uuid4().hex,
            trip_id=trip_id,
            slug=secrets.token_urlsafe(24),
            visibility=visibility,
            consent_version=CONSENT_VERSION,
            snapshot=build_trip_snapshot(trip, game_stamps),
            consented_at=now,
            created_at=now,
            updated_at=now,
        )
        db.add(publication)
    else:
        publication.slug = secrets.token_urlsafe(24)
        publication.visibility = visibility
        publication.consent_version = CONSENT_VERSION
        publication.snapshot = build_trip_snapshot(trip, game_stamps)
        publication.consented_at = now
        publication.revoked_at = None
        publication.updated_at = now
    await db.commit()
    await db.refresh(publication)
    return _owner_payload(publication, trip)


async def revoke_mini_site(db: AsyncSession, trip_id: str, user_id: str) -> bool | None:
    trip = await db.scalar(select(SuitcaseTrip).where(
        SuitcaseTrip.id == trip_id, SuitcaseTrip.user_id == user_id,
    ).with_for_update())
    if trip is None:
        return None
    publication = await db.scalar(select(SuitcaseTripPublication).where(
        SuitcaseTripPublication.trip_id == trip_id,
    ).with_for_update())
    if publication is not None and publication.revoked_at is None:
        publication.revoked_at = datetime.now(timezone.utc)
        publication.updated_at = publication.revoked_at
        await db.commit()
    return True


async def read_public_mini_site(db: AsyncSession, slug: str) -> dict[str, Any] | None:
    publication = await db.scalar(select(SuitcaseTripPublication).where(
        SuitcaseTripPublication.slug == slug,
        SuitcaseTripPublication.visibility.in_(("public", "link")),
        SuitcaseTripPublication.consented_at.is_not(None),
        SuitcaseTripPublication.revoked_at.is_(None),
    ))
    if publication is None:
        return None
    return {"visibility": publication.visibility, "snapshot": publication.snapshot}
