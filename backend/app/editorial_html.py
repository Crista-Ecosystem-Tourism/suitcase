"""Safe, server-rendered public HTML for immutable editorial records."""

from __future__ import annotations

from html import escape
from typing import Any
from urllib.parse import urlsplit, urlunsplit


STYLE = "body{margin:0;background:#f5f7f8;color:#1d2830;font:16px/1.6 system-ui,sans-serif}main{max-width:880px;margin:auto;padding:24px}article{display:grid;gap:24px}header,section,footer{background:white;border:1px solid #dce3e8;border-radius:18px;padding:20px}h1{font-size:clamp(2rem,7vw,3.5rem);line-height:1.1;margin:.35em 0}h2{margin:0 0 12px}h3{margin:.3em 0}a{color:#075d9c}.meta{color:#58656d;font-size:.9rem}ol,ul{padding-left:24px}li+li{margin-top:14px}dl{display:grid;grid-template-columns:max-content 1fr;gap:8px 16px}dt{font-weight:600}"


def _text(value: Any, limit: int = 4000) -> str:
    return escape(value.strip()[:limit], quote=True) if isinstance(value, str) else ""


def _https_url(value: Any) -> str | None:
    if not isinstance(value, str) or len(value) > 2048:
        return None
    try:
        parsed = urlsplit(value.strip())
    except ValueError:
        return None
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        return None
    return urlunsplit(("https", parsed.netloc, parsed.path, parsed.query, ""))


def _head(title: str, description: str, language: str, canonical_url: str | None) -> str:
    canonical = _https_url(canonical_url)
    canonical_markup = f'<link rel="canonical" href="{_text(canonical, 2048)}"><meta property="og:url" content="{_text(canonical, 2048)}">' if canonical else ""
    return f'''<!doctype html><html lang="{_text(language, 8) or "ru"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{_text(title, 420)}</title><meta name="description" content="{_text(description, 240)}"><meta property="og:type" content="article"><meta property="og:title" content="{_text(title, 420)}"><meta property="og:description" content="{_text(description, 240)}"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="{_text(title, 420)}"><meta name="twitter:description" content="{_text(description, 240)}">{canonical_markup}<style>{STYLE}</style></head><body><main><article>'''


def render_missing_editorial_html(kind: str) -> str:
    label = "Звёздный маршрут" if kind == "route" else "Статья Wiki"
    return f'<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>{label} недоступен — Crista</title></head><body><main><h1>{label} недоступен</h1><p>Ссылка неверна, запись не опубликована или была отозвана.</p></main></body></html>'


def render_public_wiki_html(article: dict[str, Any], canonical_url: str | None = None) -> str:
    title_raw = article.get("title") if isinstance(article.get("title"), str) else "Crista Wiki"
    body = article.get("body") if isinstance(article.get("body"), dict) else {}
    summary_raw = body.get("summary") if isinstance(body.get("summary"), str) else "Опубликованная редакционная статья Crista."
    language = article.get("content_language") if article.get("content_language") in {"ru", "en"} else "ru"
    section_markup = ""
    sections = body.get("sections") if isinstance(body.get("sections"), list) else []
    for section in sections[:40]:
        if isinstance(section, dict):
            heading, paragraph = _text(section.get("title"), 200), _text(section.get("text"), 4000)
            if heading or paragraph:
                section_markup += f"<section>{f'<h2>{heading}</h2>' if heading else ''}{f'<p>{paragraph}</p>' if paragraph else ''}</section>"
    for key, label in (("history", "История"), ("cuisine", "Кухня"), ("traditions", "Традиции")):
        value = _text(body.get(key), 4000)
        if value:
            section_markup += f"<section><h2>{label}</h2><p>{value}</p></section>"
    practical = body.get("practical") if isinstance(body.get("practical"), list) else []
    practical_rows = "".join(f"<dt>{_text(item.get('label'), 160)}</dt><dd>{_text(item.get('value'), 500)}</dd>" for item in practical[:40] if isinstance(item, dict) and _text(item.get("label"), 160))
    practical_markup = f"<section><h2>Практическая информация</h2><dl>{practical_rows}</dl></section>" if practical_rows else ""
    sources = article.get("sources") if isinstance(article.get("sources"), list) else []
    source_items = []
    for source in sources[:50]:
        if isinstance(source, dict):
            url, label = _https_url(source.get("url")), _text(source.get("label"), 240)
            if url and label:
                source_items.append(f'<li><a href="{_text(url, 2048)}" target="_blank" rel="noopener noreferrer">{label}</a></li>')
    sources_markup = f"<section><h2>Источники</h2><ul>{''.join(source_items)}</ul></section>" if source_items else ""
    license_name, published_at = _text(article.get("license"), 160), _text(article.get("published_at"), 64)
    html = _head(f"{title_raw} — Crista Wiki", summary_raw, language, canonical_url)
    footer = f'Лицензия: {license_name}. ' if license_name else ''
    footer += f'Опубликовано: {published_at}.' if published_at else 'Опубликовано редакцией Crista.'
    return f'''{html}<header><p class="meta">Crista Wiki</p><h1>{_text(title_raw, 400)}</h1><p>{_text(summary_raw, 240)}</p></header>{section_markup}{practical_markup}{sources_markup}<footer>{footer}</footer></article></main></body></html>'''


def render_public_star_route_html(route: dict[str, Any], canonical_url: str | None = None) -> str:
    title_raw = route.get("title") if isinstance(route.get("title"), str) else "Звёздный маршрут"
    destination = _text(route.get("destination"), 200)
    point_items = []
    pois = route.get("pois") if isinstance(route.get("pois"), list) else []
    for point in pois[:40]:
        if not isinstance(point, dict):
            continue
        name = _text(point.get("name"), 200)
        timecode = point.get("timecode") if isinstance(point.get("timecode"), dict) else {}
        excerpt, source_url = _text(timecode.get("excerpt"), 2000), _https_url(point.get("source_url"))
        seconds = timecode.get("start_seconds")
        stamp = f"#{seconds}" if isinstance(seconds, int) and seconds >= 0 else ""
        source = f' <a href="{_text(source_url, 2048)}" target="_blank" rel="noopener noreferrer">Источник точки</a>' if source_url else ""
        if name:
            point_items.append(f"<li><h3>{name}</h3>{f'<p>{excerpt}</p>' if excerpt else ''}<p class=\"meta\">{stamp}{source}</p></li>")
    source_url, source_title = _https_url(route.get("source_url")), _text(route.get("source_title"), 240)
    source_markup = f'<a href="{_text(source_url, 2048)}" target="_blank" rel="noopener noreferrer">{source_title or "Исходный материал"}</a>' if source_url else source_title
    description = f"Редакционно опубликованный маршрут по {destination}." if destination else "Редакционно опубликованный маршрут Crista."
    html = _head(f"{title_raw} — Crista", description, "ru", canonical_url)
    points_markup = f'<section><h2>Точки маршрута</h2><ol>{"".join(point_items)}</ol></section>' if point_items else ""
    return f'''{html}<header><p class="meta">Звёздный маршрут{f' · {destination}' if destination else ''}</p><h1>{_text(title_raw, 400)}</h1><p>{description}</p></header><section><h2>Источник</h2><p>{source_markup}</p><p class="meta">Основание прав: {_text(route.get("rights_basis"), 80) or "не указано"}</p></section>{points_markup}<footer>Опубликовано редакцией Crista.</footer></article></main></body></html>'''
