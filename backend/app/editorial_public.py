"""Fetch only published public editorial records for server-rendered pages."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

import httpx

from app.config import get_public_editorial_api_url


class EditorialUnavailableError(RuntimeError):
    pass


async def fetch_published_wiki(slug: str, language: str) -> dict[str, Any] | None:
    return await _fetch(f"/wiki/articles/{quote(slug, safe='')}?language={quote(language, safe='')}")


async def fetch_published_star_route(route_id: str) -> dict[str, Any] | None:
    return await _fetch(f"/star-routes/{quote(route_id, safe='')}")


async def _fetch(path: str) -> dict[str, Any] | None:
    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=False) as client:
            response = await client.get(f"{get_public_editorial_api_url()}{path}")
    except (httpx.HTTPError, ValueError) as error:
        raise EditorialUnavailableError from error
    if response.status_code == 404:
        return None
    if response.status_code != 200:
        raise EditorialUnavailableError
    try:
        payload = response.json()
    except ValueError as error:
        raise EditorialUnavailableError from error
    if not isinstance(payload, dict):
        raise EditorialUnavailableError
    return payload
