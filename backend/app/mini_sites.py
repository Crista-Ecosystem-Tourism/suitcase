from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.mini_site_policy import build_trip_snapshot
from app.models import SuitcaseTrip, SuitcaseTripPublication

CONSENT_VERSION = "trip-mini-site-v1"


def _owner_payload(publication: SuitcaseTripPublication | None) -> dict[str, Any]:
    if publication is None or publication.revoked_at is not None:
        return {"published": False, "slug": None, "visibility": None, "consented_at": None}
    return {
        "published": True,
        "slug": publication.slug,
        "visibility": publication.visibility,
        "consented_at": publication.consented_at.isoformat(),
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
    return _owner_payload(publication)


async def publish_mini_site(
    db: AsyncSession, trip_id: str, user_id: str, visibility: str,
) -> dict[str, Any] | None:
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
            snapshot=build_trip_snapshot(trip),
            consented_at=now,
            created_at=now,
            updated_at=now,
        )
        db.add(publication)
    else:
        publication.slug = secrets.token_urlsafe(24)
        publication.visibility = visibility
        publication.consent_version = CONSENT_VERSION
        publication.snapshot = build_trip_snapshot(trip)
        publication.consented_at = now
        publication.revoked_at = None
        publication.updated_at = now
    await db.commit()
    await db.refresh(publication)
    return _owner_payload(publication)


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
        SuitcaseTripPublication.revoked_at.is_(None),
    ))
    if publication is None:
        return None
    return {"visibility": publication.visibility, "snapshot": publication.snapshot}
