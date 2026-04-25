from __future__ import annotations

from pathlib import Path

import pytest

pytest.importorskip("flask")
from viewer.app import create_app

pytestmark = pytest.mark.unit


def test_intro_demo_route_renders(tmp_path: Path) -> None:
    game_root = tmp_path
    (game_root / "logs" / "sessions").mkdir(parents=True)
    (game_root / "logs" / "screenshots").mkdir(parents=True)
    (game_root / "logs" / "feedback").mkdir(parents=True)

    app = create_app(str(game_root))
    client = app.test_client()

    resp = client.get("/demo/intro")
    assert resp.status_code == 200
    body = resp.get_data(as_text=True)
    assert "Bashcrawl Lite Demo" in body
    assert "intro_terminal.js" in body
