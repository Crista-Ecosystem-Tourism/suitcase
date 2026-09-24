"""Smoke the public boundary: ai_agent auth token -> Suitcase persistence.

The services both expose a top-level ``app`` package, so auth is executed in a
separate Python process.  The short-lived token is passed through a temporary
file rather than process output to keep it out of CI logs.
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


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
        trip = client.post(
            "/suitcase/trips",
            headers=headers,
            json={
                "country": "Россия",
                "city": "Москва",
                "start_date": "2026-09-18",
                "end_date": "2026-09-20",
            },
        )
        trip.raise_for_status()

        expense = client.post(
            f"/suitcase/trips/{trip.json()['id']}/expenses",
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
