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

        workspace = client.get("/suitcase/workspace", headers=headers)
        workspace.raise_for_status()
        body = workspace.json()

    if not any(item["id"] == trip.json()["id"] for item in body["trips"]):
        raise AssertionError("created trip was not returned by the authenticated workspace")
    if len(body["goals"]) != 4:
        raise AssertionError("new Suitcase account did not receive the four default goals")


if __name__ == "__main__":
    main()
