"""Build a small, explicitly shareable snapshot without private account data."""

from __future__ import annotations

from datetime import date, datetime
import json
import math
from typing import Any
from urllib.parse import urlsplit, urlunsplit


def _safe_image_url(value: Any) -> str | None:
    if not isinstance(value, str) or len(value) > 2048:
        return None
    try:
        parsed = urlsplit(value.strip())
    except ValueError:
        return None
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        return None
    # Query strings frequently contain signed storage credentials or tracking IDs.
    return urlunsplit(("https", parsed.netloc, parsed.path, "", ""))


def _trip_date(value: str) -> date | None:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except (AttributeError, TypeError, ValueError):
        try:
            return date.fromisoformat(value)
        except (TypeError, ValueError):
            return None


def _route_points(route_json: str | None) -> list[dict[str, Any]]:
    if not isinstance(route_json, str) or len(route_json) > 100_000:
        return []
    try:
        raw = json.loads(route_json)
    except (TypeError, ValueError):
        return []
    if not isinstance(raw, list):
        return []
    points = []
    for item in raw[:100]:
        if not isinstance(item, dict):
            continue
        try:
            lat = float(item.get("latitude"))
            lng = float(item.get("longitude"))
        except (TypeError, ValueError):
            continue
        if not math.isfinite(lat) or not math.isfinite(lng) or not -90 <= lat <= 90 or not -180 <= lng <= 180:
            continue
        name = item.get("name")
        note = item.get("note")
        point: dict[str, Any] = {"latitude": lat, "longitude": lng}
        if isinstance(name, str) and name.strip():
            point["name"] = name.strip()[:180]
        if isinstance(note, str) and note.strip():
            point["note"] = note.strip()[:500]
        point_photos = item.get("photos")
        if isinstance(point_photos, list):
            photos = [url for photo in point_photos[:10] if (url := _safe_image_url(photo))]
            if photos:
                point["photos"] = photos
        points.append(point)
    return points


def _distance_km(points: list[dict[str, Any]]) -> int:
    distance = 0.0
    for previous, current in zip(points, points[1:]):
        lat1, lon1 = math.radians(previous["latitude"]), math.radians(previous["longitude"])
        lat2, lon2 = math.radians(current["latitude"]), math.radians(current["longitude"])
        dlat, dlon = lat2 - lat1, lon2 - lon1
        arc = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        distance += 6371.0 * 2 * math.atan2(math.sqrt(arc), math.sqrt(max(0, 1 - arc)))
    return round(distance)


def build_trip_snapshot(
    trip: Any,
    verified_game_stamps: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Allow-list trip content and server-attested stamps; exclude private account data."""
    points = _route_points(trip.route_json)
    start = _trip_date(trip.start_date)
    end = _trip_date(trip.end_date)
    days = (end - start).days + 1 if start and end and end >= start else 0
    photo_values = trip.photos if isinstance(trip.photos, list) else []
    photos = [url for item in photo_values[:40] if (url := _safe_image_url(item))]
    cover = _safe_image_url(trip.image) or (photos[0] if photos else None)
    impressions = trip.impressions.strip()[:4000] if isinstance(trip.impressions, str) else ""
    return {
        "title": f"{trip.city}, {trip.country}"[:400],
        "city": trip.city[:200],
        "country": trip.country[:200],
        "start_date": trip.start_date[:32],
        "end_date": trip.end_date[:32],
        "cover": cover,
        "summary": impressions,
        "photos": list(dict.fromkeys(photos)),
        "points": points,
        "game_stamps": verified_game_stamps[:20] if isinstance(verified_game_stamps, list) else [],
        "stats": {
            "days": days,
            "places_visited": len(points),
            "distance_km": _distance_km(points),
        },
    }
