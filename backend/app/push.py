from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import select, update

from app.db import SessionFactory
from app.models import SuitcasePushDevice

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_push_to_users(
    user_ids: Iterable[str], *, title: str, body: str, data: dict[str, Any],
) -> None:
    recipients = sorted(set(user_ids))
    if not recipients:
        return
    async with SessionFactory() as db:
        devices = list((await db.scalars(
            select(SuitcasePushDevice).where(
                SuitcasePushDevice.user_id.in_(recipients),
                SuitcasePushDevice.enabled.is_(True),
            )
        )).all())
        tokens = [device.expo_push_token for device in devices]
    if not tokens:
        return

    messages = [
        {"to": token, "title": title, "body": body, "data": data, "sound": "default"}
        for token in tokens
    ]
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post(EXPO_PUSH_URL, json=messages)
            response.raise_for_status()
            tickets = response.json().get("data", [])
    except (httpx.HTTPError, ValueError):
        return

    invalid_tokens = {
        token
        for token, ticket in zip(tokens, tickets)
        if ticket.get("status") == "error"
        and ticket.get("details", {}).get("error") == "DeviceNotRegistered"
    }
    if not invalid_tokens:
        return
    async with SessionFactory.begin() as db:
        await db.execute(
            update(SuitcasePushDevice)
            .where(SuitcasePushDevice.expo_push_token.in_(invalid_tokens))
            .values(enabled=False, updated_at=datetime.now(timezone.utc))
        )
