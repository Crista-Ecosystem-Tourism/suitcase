"""Small server-rendered public page for crawlers and no-JavaScript clients."""

from __future__ import annotations

from html import escape
import math
from typing import Any
from urllib.parse import urlsplit, urlunsplit


def _text(value: Any, limit: int = 4000) -> str:
    if isinstance(value, str):
        value = value.strip()[:limit]
    elif isinstance(value, (int, float)) and not isinstance(value, bool):
        if isinstance(value, float) and not math.isfinite(value):
            return ""
        value = str(value)
    else:
        return ""
    return escape(value, quote=True)


def _https_url(value: Any) -> str | None:
    if not isinstance(value, str) or len(value) > 2048:
        return None
    try:
        parsed = urlsplit(value.strip())
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            return None
    except ValueError:
        return None
    return urlunsplit(("https", parsed.netloc, parsed.path, "", ""))


def _route_svg(points: list[dict[str, Any]]) -> str:
    if not points:
        return ""
    coordinates = []
    for point in points:
        try:
            lon, lat = float(point["longitude"]), float(point["latitude"])
        except (KeyError, TypeError, ValueError):
            continue
        if math.isfinite(lon) and math.isfinite(lat) and -180 <= lon <= 180 and -90 <= lat <= 90:
            coordinates.append((lon, lat))
    if not coordinates:
        return ""
    min_lon = min(point[0] for point in coordinates)
    max_lon = max(point[0] for point in coordinates)
    min_lat = min(point[1] for point in coordinates)
    max_lat = max(point[1] for point in coordinates)
    lon_span = max(max_lon - min_lon, 0.01)
    lat_span = max(max_lat - min_lat, 0.01)
    projected = [
        (24 + (lon - min_lon) / lon_span * 592, 24 + (max_lat - lat) / lat_span * 212)
        for lon, lat in coordinates
    ]
    path = " ".join(f"{x:.1f},{y:.1f}" for x, y in projected)
    markers = "".join(
        f'<circle cx="{x:.1f}" cy="{y:.1f}" r="7"><title>Точка {index}</title></circle>'
        for index, (x, y) in enumerate(projected, start=1)
    )
    return (
        '<svg class="route-map" viewBox="0 0 640 260" role="img" aria-labelledby="map-title map-desc">'
        '<title id="map-title">Маршрут поездки</title>'
        '<desc id="map-desc">Схема опубликованных точек маршрута без географической подложки.</desc>'
        '<rect width="640" height="260" rx="16" fill="#eef2f5"/>'
        f'<polyline points="{path}" fill="none" stroke="#1769aa" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
        f'<g fill="#fff" stroke="#1769aa" stroke-width="3">{markers}</g></svg>'
    )


def render_public_mini_site_html(
    publication: dict[str, Any],
    canonical_url: str | None = None,
) -> str:
    """Render only an already-consented public snapshot; escape every inserted value."""
    snapshot = publication["snapshot"]
    visibility = publication.get("visibility")
    title_text = snapshot.get("title") if isinstance(snapshot.get("title"), str) else "Поездка"
    city = _text(snapshot.get("city"), 200)
    country = _text(snapshot.get("country"), 200)
    summary_text = snapshot.get("summary") if isinstance(snapshot.get("summary"), str) else ""
    summary = _text(" ".join(summary_text.split()) or f"Маршрут поездки: {city}, {country}.", 240)
    title = _text(title_text, 400)
    dates = f'{_text(snapshot.get("start_date"), 32)} — {_text(snapshot.get("end_date"), 32)}'
    stats = snapshot.get("stats") if isinstance(snapshot.get("stats"), dict) else {}
    points = snapshot.get("points") if isinstance(snapshot.get("points"), list) else []
    photos = snapshot.get("photos") if isinstance(snapshot.get("photos"), list) else []
    stamps = snapshot.get("game_stamps") if isinstance(snapshot.get("game_stamps"), list) else []
    cover = _https_url(snapshot.get("cover"))
    robots = '<meta name="robots" content="noindex, nofollow">' if visibility == "link" else ""
    canonical = (
        f'<link rel="canonical" href="{_text(canonical_url, 2048)}">'
        if visibility == "public" and canonical_url and _https_url(canonical_url)
        else ""
    )
    og_url = (
        f'<meta property="og:url" content="{_text(canonical_url, 2048)}">'
        if visibility == "public" and canonical_url and _https_url(canonical_url)
        else ""
    )
    cover_meta = f'<meta property="og:image" content="{_text(cover, 2048)}"><meta name="twitter:image" content="{_text(cover, 2048)}">' if cover else ""

    point_items = []
    for index, point in enumerate(points[:100], start=1):
        if not isinstance(point, dict):
            continue
        name = _text(point.get("name"), 180) or f"Точка {index}"
        note = _text(point.get("note"), 500)
        point_photos = point.get("photos") if isinstance(point.get("photos"), list) else []
        photo_markup = "".join(
            f'<img loading="lazy" src="{_text(url, 2048)}" alt="Фото: {name}">'
            for item in point_photos[:10] if (url := _https_url(item))
        )
        point_items.append(f'<li><h3>{name}</h3>{f"<p>{note}</p>" if note else ""}{photo_markup}</li>')

    photo_items = "".join(
        f'<img loading="lazy" src="{_text(url, 2048)}" alt="Фото поездки {index}">'
        for index, item in enumerate(photos[:40], start=1) if (url := _https_url(item))
    )
    stamp_items = []
    for stamp in stamps[:20]:
        if not isinstance(stamp, dict):
            continue
        stamp_title = _text(stamp.get("title"), 200)
        stamp_date = _text(stamp.get("earned_at"), 64)
        fact = _text(stamp.get("fact"), 800)
        source_url = _https_url(stamp.get("source_url"))
        source = (
            f'<a href="{_text(source_url, 512)}" target="_blank" rel="noopener noreferrer">'
            f'{_text(stamp.get("source_label"), 160) or "Источник факта"}</a>'
            if source_url else ""
        )
        stamp_items.append(f'<li><h3>{stamp_title}</h3><p>Получено: {stamp_date}</p><p>{fact}</p>{source}</li>')

    map_svg = _route_svg([point for point in points[:100] if isinstance(point, dict)])
    page_title = f"{title_text} — Crista"
    return f'''<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{_text(page_title, 420)}</title><meta name="description" content="{summary}">
<meta property="og:type" content="article"><meta property="og:title" content="{_text(page_title, 420)}">
<meta property="og:description" content="{summary}"><meta name="twitter:card" content="{'summary_large_image' if cover else 'summary'}">
<meta name="twitter:title" content="{_text(page_title, 420)}"><meta name="twitter:description" content="{summary}">
{robots}{canonical}{og_url}{cover_meta}
<style>body{{margin:0;background:#f5f7f8;color:#1d2830;font:16px/1.6 system-ui,sans-serif}}main{{max-width:880px;margin:auto;padding:24px}}article{{display:grid;gap:24px}}header,section,footer{{background:white;border:1px solid #dce3e8;border-radius:18px;padding:20px}}h1{{font-size:clamp(2rem,7vw,3.5rem);line-height:1.1;margin:.35em 0}}h2{{margin:0 0 12px}}h3{{margin:.3em 0}}a{{color:#075d9c}}img{{max-width:100%;height:auto;border-radius:12px}}.cover{{width:100%;max-height:420px;object-fit:cover}}.photos{{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}}.route-map{{width:100%;height:auto;margin:12px 0}}.route-map circle{{vector-effect:non-scaling-stroke}}.stats{{display:flex;gap:24px;flex-wrap:wrap}}.stats strong{{display:block;font-size:1.35rem}}ol,ul{{padding-left:24px}}li+li{{margin-top:14px}}footer{{font-size:.85rem;color:#58656d}}</style>
</head><body><main><article>
<header>{f'<img class="cover" src="{_text(cover, 2048)}" alt="{title}">' if cover else ''}
<p>{city}, {country}</p><h1>{title}</h1><p>{summary}</p><p>{dates}</p></header>
<section aria-label="Статистика поездки"><h2>Поездка</h2><div class="stats"><div><strong>{_text(stats.get("days", 0), 20)}</strong>дней</div><div><strong>{_text(stats.get("places_visited", len(points)), 20)}</strong>мест</div><div><strong>{_text(stats.get("distance_km", 0), 20)} км</strong>по прямой между точками</div></div></section>
{f'<section><h2>Маршрут</h2>{map_svg}<ol>{"".join(point_items)}</ol></section>' if points else ''}
{f'<section><h2>Фотографии</h2><div class="photos">{photo_items}</div></section>' if photo_items else ''}
{f'<section><h2>Игровые отметки</h2><ul>{"".join(stamp_items)}</ul></section>' if stamp_items else ''}
<footer>Опубликовано владельцем поездки через Crista. Изображения загружаются с исходных HTTPS-сайтов.</footer>
</article></main></body></html>'''


def render_missing_mini_site_html() -> str:
    return (
        '<!doctype html><html lang="ru"><head><meta charset="utf-8">'
        '<meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>Страница поездки недоступна — Crista</title></head>'
        '<body><main><h1>Страница поездки недоступна</h1>'
        '<p>Владелец мог отозвать доступ или ссылка неверна.</p></main></body></html>'
    )
