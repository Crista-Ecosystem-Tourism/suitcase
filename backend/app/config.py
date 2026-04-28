from __future__ import annotations

import os
from urllib.parse import quote_plus


def get_database_url() -> str:
    raw = os.getenv("DATABASE_URL")
    if raw and raw.strip():
        return raw.strip()

    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "")
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    database = os.getenv("POSTGRES_DB", "crs_agent")

    u = quote_plus(user)
    p = quote_plus(password)
    auth = f"{u}:{p}@{host}" if password else f"{u}@{host}"
    return f"postgresql+asyncpg://{auth}:{port}/{database}"


def get_cors_origins() -> list[str]:
    default = (
        "http://localhost:3333,http://localhost:5173,http://127.0.0.1:5173,"
        "https://crista.online,https://www.crista.online,https://api.crista.online"
    )
    raw = (os.getenv("CORS_ORIGINS") or default).strip()
    seen: set[str] = set()
    origins: list[str] = []
    for item in raw.split(","):
        value = item.strip()
        if value and value not in seen:
            seen.add(value)
            origins.append(value)
    return origins
