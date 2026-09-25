"""Smoke the public boundary: ai_agent auth token -> Suitcase persistence.

The services both expose a top-level ``app`` package, so auth is executed in a
separate Python process.  The short-lived token is passed through a temporary
file rather than process output to keep it out of CI logs.
"""

from __future__ import annotations

import os
import secrets
import subprocess
import sys
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from fastapi.testclient import TestClient

from app.main import app
from app.security import JWT_ALG, JWT_SECRET


AGENT_AUTH_SCRIPT = """
import os
import uuid
from pathlib import Path

from fastapi.testclient import TestClient
from app.main import app

payload = {
    "email": f"suitcase-smoke-{uuid.uuid4().hex}@example.test",
    "password": "CrossService123",
    "name": "Suitcase CI smoke",
}
with TestClient(app) as client:
    response = client.post("/auth/register", json=payload)
    response.raise_for_status()
Path(os.environ["SMOKE_TOKEN_FILE"]).write_text(response.json()["access_token"], encoding="utf-8")
"""


def main() -> None:
    agent_dir = Path(os.environ["AI_AGENT_DIR"]).resolve()
    if not (agent_dir / "app" / "main.py").is_file():
        raise RuntimeError(f"AI_AGENT_DIR does not contain ai_agent: {agent_dir}")

    with tempfile.TemporaryDirectory(prefix="crista-auth-smoke-") as directory:
        token_file = Path(directory) / "access-token"
        agent_env = {
            **os.environ,
            "PYTHONPATH": str(agent_dir),
            "SMOKE_TOKEN_FILE": str(token_file),
        }
        subprocess.run(
            [sys.executable, "-c", AGENT_AUTH_SCRIPT],
            cwd=agent_dir,
            env=agent_env,
            check=True,
        )
        token = token_file.read_text(encoding="utf-8")

    with TestClient(app) as client:
        headers = {"Authorization": f"Bearer {token}"}
        owner_id = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])["sub"]
        now = datetime.now(timezone.utc)
        stamp_ticket_claims = {
            "sub": owner_id,
            "iss": "crista-ai-agent",
            "aud": "crista-suitcase-mini-site",
            "purpose": "trip-mini-site-stamps",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=5)).timestamp()),
            "stamps": [{
                "key": "smoke-earned-stamp",
                "title": "Проверенный штамп",
                "earned_at": now.isoformat(),
                "fact": "Факт из опубликованной ревизии.",
                "source_label": "Официальный источник",
                "source_url": "https://example.test/fact?tracking=remove#section",
            }],
        }
        stamp_ticket = jwt.encode(stamp_ticket_claims, JWT_SECRET, algorithm=JWT_ALG)
        trip = client.post(
            "/suitcase/trips",
            headers=headers,
            json={
                "country": "Россия",
                "city": "Москва",
                "start_date": "2026-09-18",
                "end_date": "2026-09-20",
                "impressions": "Секретная заметка для snapshot",
                "photos": ["https://images.example/moscow.jpg", "file:///private/photo.jpg"],
                "route_json": '[{"latitude":55.75,"longitude":37.62,"name":"Красная площадь","note":"Вечером"}]',
            },
        )
        trip.raise_for_status()
        trip_id = trip.json()["id"]

        expense = client.post(
            f"/suitcase/trips/{trip_id}/expenses",
            headers=headers,
            json={
                "amount": 1250,
                "category": "transport",
                "title": "Аэроэкспресс",
                "date": "2026-09-18",
                "currency": "RUB",
            },
        )
        expense.raise_for_status()

        goal = client.post(
            "/suitcase/goals",
            headers=headers,
            json={
                "title": "Посетить три музея",
                "current": 0,
                "total": 3,
                "color": "#336699",
            },
        )
        goal.raise_for_status()
        goal_id = goal.json()["id"]

        updated_goal = client.patch(
            f"/suitcase/goals/{goal_id}",
            headers=headers,
            json={"current": 1},
        )
        updated_goal.raise_for_status()
        if updated_goal.json()["current"] != 1:
            raise AssertionError("goal progress update was not returned by the API")

        wrong_owner_claims = {**stamp_ticket_claims, "sub": uuid.uuid4().hex}
        wrong_owner_ticket = jwt.encode(wrong_owner_claims, JWT_SECRET, algorithm=JWT_ALG)
        rejected_ticket = client.post(
            f"/suitcase/trips/{trip_id}/complete", headers=headers,
            json={"game_stamp_ticket": wrong_owner_ticket},
        )
        if rejected_ticket.status_code != 400:
            raise AssertionError("Suitcase must reject a stamp ticket issued for another owner")

        completion = client.post(
            f"/suitcase/trips/{trip_id}/complete", headers=headers,
            json={"game_stamp_ticket": stamp_ticket},
        )
        completion.raise_for_status()
        draft = completion.json()
        if draft["published"] or not draft["draft_ready"] or draft["slug"] is not None:
            raise AssertionError("trip completion must create a private draft without publication")
        draft_snapshot = draft["draft_snapshot"]
        if draft_snapshot["summary"] != "Секретная заметка для snapshot":
            raise AssertionError("owner draft is missing the trip summary")
        if draft_snapshot["photos"] != ["https://images.example/moscow.jpg"]:
            raise AssertionError("owner draft did not filter unsafe photo URLs")
        if draft_snapshot["points"][0]["name"] != "Красная площадь":
            raise AssertionError("owner draft is missing the allow-listed route point")
        if "user_id" in draft_snapshot or "expenses" in draft_snapshot:
            raise AssertionError("owner draft contains private account or expense data")
        shared_stamps = draft_snapshot["game_stamps"]
        if len(shared_stamps) != 1 or shared_stamps[0]["fact"] != "Факт из опубликованной ревизии.":
            raise AssertionError("owner draft did not persist the verified game stamp")
        if shared_stamps[0]["source_url"] != "https://example.test/fact":
            raise AssertionError("shared fact source URL was not sanitized")

        owner_preview = client.get(f"/suitcase/trips/{trip_id}/mini-site", headers=headers)
        owner_preview.raise_for_status()
        if owner_preview.json()["draft_snapshot"] != draft_snapshot:
            raise AssertionError("owner preview differs from the persisted private draft")

        invalid_consent = client.post(
            f"/suitcase/trips/{trip_id}/mini-site",
            headers=headers,
            json={"visibility": "link", "consent_to_publish": False},
        )
        if invalid_consent.status_code != 422:
            raise AssertionError("publication must reject missing explicit consent")
        if client.get(f"/t/{secrets.token_urlsafe(24)}").status_code != 404:
            raise AssertionError("a private draft must not be reachable by an unissued URL")

        published = client.post(
            f"/suitcase/trips/{trip_id}/mini-site",
            headers=headers,
            json={"visibility": "link", "consent_to_publish": True, "game_stamp_ticket": stamp_ticket},
        )
        published.raise_for_status()
        publication = published.json()
        if not publication["published"] or publication["draft_ready"] or not publication["slug"]:
            raise AssertionError("explicit consent did not create the public link")
        public_page = client.get(f"/t/{publication['slug']}")
        public_page.raise_for_status()
        if "no-store" not in public_page.headers.get("cache-control", ""):
            raise AssertionError("public snapshot response must not be cached")
        if public_page.json()["snapshot"] != draft_snapshot:
            raise AssertionError("published page differs from the reviewed owner snapshot")
        if "expenses" in public_page.json()["snapshot"] or "user_id" in public_page.json()["snapshot"]:
            raise AssertionError("public snapshot contains private account or expense data")
        server_rendered = client.get(f"/public-mini-site/{publication['slug']}/html")
        server_rendered.raise_for_status()
        if "text/html" not in server_rendered.headers.get("content-type", ""):
            raise AssertionError("crawler route did not return HTML")
        if 'name="robots" content="noindex, nofollow"' not in server_rendered.text:
            raise AssertionError("link-only HTML must be marked noindex")
        if "Факт из опубликованной ревизии." not in server_rendered.text:
            raise AssertionError("server-rendered HTML is missing the consented game fact")

        updated_trip = client.patch(
            f"/suitcase/trips/{trip_id}", headers=headers,
            json={"impressions": "Обновлённый owner snapshot"},
        )
        updated_trip.raise_for_status()
        refreshed_preview = client.get(f"/suitcase/trips/{trip_id}/mini-site", headers=headers)
        refreshed_preview.raise_for_status()
        if refreshed_preview.json()["preview_snapshot"]["summary"] != "Обновлённый owner snapshot":
            raise AssertionError("owner refresh preview does not reflect current trip data")
        refreshed = client.post(
            f"/suitcase/trips/{trip_id}/mini-site",
            headers=headers,
            json={"visibility": "link", "consent_to_publish": True},
        )
        refreshed.raise_for_status()
        refreshed_slug = refreshed.json()["slug"]
        if refreshed_slug == publication["slug"]:
            raise AssertionError("refreshing a published snapshot must rotate its public URL")
        if client.get(f"/t/{publication['slug']}").status_code != 404:
            raise AssertionError("refreshing a snapshot left the old public URL active")
        refreshed_page = client.get(f"/t/{refreshed_slug}")
        refreshed_page.raise_for_status()
        if refreshed_page.json()["snapshot"]["summary"] != "Обновлённый owner snapshot":
            raise AssertionError("refreshed public page does not match the owner preview")

        repeated_completion = client.post(f"/suitcase/trips/{trip_id}/complete", headers=headers)
        repeated_completion.raise_for_status()
        if repeated_completion.json()["slug"] != refreshed_slug:
            raise AssertionError("re-completion changed an already published URL")
        revoked = client.delete(f"/suitcase/trips/{trip_id}/mini-site", headers=headers)
        revoked.raise_for_status()
        if client.get(f"/t/{refreshed_slug}").status_code != 404:
            raise AssertionError("revocation did not immediately close the public page")
        revoked_html = client.get(f"/public-mini-site/{refreshed_slug}/html")
        if revoked_html.status_code != 404 or 'name="robots"' not in revoked_html.text:
            raise AssertionError("revoked HTML page must return a noindex 404")

        workspace = client.get("/suitcase/workspace", headers=headers)
        workspace.raise_for_status()
        body = workspace.json()

    if not any(item["id"] == trip.json()["id"] for item in body["trips"]):
        raise AssertionError("created trip was not returned by the authenticated workspace")
    if not any(item["id"] == expense.json()["id"] for item in body["expenses"]):
        raise AssertionError("created expense was not returned by the authenticated workspace")
    if len(body["goals"]) != 5:
        raise AssertionError("workspace must contain four default goals plus the newly created goal")
    saved_goal = next((item for item in body["goals"] if item["id"] == goal_id), None)
    if not saved_goal or saved_goal["current"] != 1 or saved_goal["total"] != 3:
        raise AssertionError("created and updated goal was not persisted in the authenticated workspace")

    with TestClient(app) as client:
        removed = client.delete(f"/suitcase/goals/{goal_id}", headers=headers)
        removed.raise_for_status()
        remaining = client.get("/suitcase/workspace", headers=headers)
        remaining.raise_for_status()
        remaining_goals = remaining.json()["goals"]

    if any(item["id"] == goal_id for item in remaining_goals):
        raise AssertionError("deleted goal remained in the authenticated workspace")
    if len(remaining_goals) != 4:
        raise AssertionError("deleting a custom goal changed the four default goals")


if __name__ == "__main__":
    main()
