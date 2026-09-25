"""Verify AI-agent attestations before game stamps enter a public trip snapshot."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from urllib.parse import urlsplit, urlunsplit


MAX_TICKET_LENGTH = 65_536
MAX_ATTESTED_STAMPS = 20


def stamps_from_verified_claims(claims: dict[str, Any], user_id: str) -> list[dict[str, str | None]]:
    """Validate the signed claims' domain and allow-list their public fields."""
    if (
        claims.get("sub") != user_id
        or claims.get("iss") != "crista-ai-agent"
        or claims.get("aud") != "crista-suitcase-mini-site"
        or claims.get("purpose") != "trip-mini-site-stamps"
    ):
        raise ValueError("Game stamp ticket is not valid for this account")

    stamps = claims.get("stamps")
    if not isinstance(stamps, list) or not 1 <= len(stamps) <= MAX_ATTESTED_STAMPS:
        raise ValueError("Game stamp ticket has an invalid stamp list")

    result = []
    seen: set[str] = set()
    for stamp in stamps:
        if not isinstance(stamp, dict):
            raise ValueError("Game stamp ticket has an invalid entry")
        key = stamp.get("key")
        title = stamp.get("title")
        earned_at = stamp.get("earned_at")
        if not isinstance(key, str) or not key.strip() or len(key) > 120 or key in seen:
            raise ValueError("Game stamp ticket has an invalid key")
        if not isinstance(title, str) or not title.strip() or len(title) > 200:
            raise ValueError("Game stamp ticket has an invalid title")
        if not isinstance(earned_at, str) or len(earned_at) > 64:
            raise ValueError("Game stamp ticket has an invalid earned date")
        try:
            parsed_date = datetime.fromisoformat(earned_at.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError("Game stamp ticket has an invalid earned date") from exc
        if parsed_date.tzinfo is None:
            raise ValueError("Game stamp ticket dates must include a timezone")

        fact = stamp.get("fact")
        source_label = stamp.get("source_label")
        source_url = stamp.get("source_url")
        if fact is not None and (not isinstance(fact, str) or len(fact) > 800):
            raise ValueError("Game stamp ticket has an invalid fact")
        if source_label is not None and (not isinstance(source_label, str) or len(source_label) > 160):
            raise ValueError("Game stamp ticket has an invalid source label")
        if source_url is not None:
            if not isinstance(source_url, str) or len(source_url) > 512:
                raise ValueError("Game stamp ticket has an invalid source URL")
            try:
                parsed_url = urlsplit(source_url)
                if parsed_url.scheme != "https" or not parsed_url.hostname or parsed_url.username or parsed_url.password:
                    raise ValueError("Game stamp ticket source must use HTTPS")
                source_url = urlunsplit(("https", parsed_url.netloc, parsed_url.path, "", ""))
            except ValueError as exc:
                raise ValueError("Game stamp ticket has an invalid source URL") from exc

        result.append({
            "key": key.strip(),
            "title": title.strip(),
            "earned_at": parsed_date.isoformat(),
            "fact": fact.strip() if isinstance(fact, str) and fact.strip() else None,
            "source_label": source_label.strip() if isinstance(source_label, str) and source_label.strip() else None,
            "source_url": source_url,
        })
        seen.add(key)
    return result


def verify_game_stamp_ticket(token: str | None, user_id: str) -> list[dict[str, str | None]]:
    if not token:
        return []
    if len(token) > MAX_TICKET_LENGTH:
        raise ValueError("Game stamp ticket is too large")

    import jwt

    from app.security import JWT_ALG, JWT_SECRET

    try:
        claims = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALG],
            audience="crista-suitcase-mini-site",
            issuer="crista-ai-agent",
        )
    except jwt.PyJWTError as exc:
        raise ValueError("Game stamp ticket signature is invalid or expired") from exc
    return stamps_from_verified_claims(claims, user_id)
