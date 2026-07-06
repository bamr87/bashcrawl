"""Smoke tests for the lean, bash-driven playtest harness.

Replaces the retired Textual-TUI MCP tests. The harness plays the *real*
``entrance/`` dungeon in a sandbox, so these tests exercise navigation,
interactive encounters, the audit recorder, and the scorer end to end without
needing the ``mcp`` transport installed. A final test imports the FastMCP shell
only when ``mcp`` is available.
"""

from __future__ import annotations

import json

import pytest

from playtest import scorer
from playtest.bash_session import BashGameSession
from playtest.harness import PlaytestHarness
from playtest.recorder import SessionRecorder
from playtest.sandbox import create_sandbox, destroy_sandbox, sandbox_game_dir

pytestmark = pytest.mark.integration


@pytest.fixture
def game_session():
    sandbox = create_sandbox()
    session = BashGameSession(sandbox_game_dir(sandbox))
    session.start()
    try:
        yield session
    finally:
        session.close()
        destroy_sandbox(sandbox)


def test_navigation_tracks_cwd(game_session):
    assert game_session.snapshot()["cwd"] == "entrance"
    game_session.run("cd cellar")
    assert game_session.snapshot()["cwd"] == "entrance/cellar"
    out = game_session.run("cat scroll")
    text = " ".join(o["text"] for o in out)
    assert len(text) > 200 and ("===" in text or "###" in text), "scroll content should be shown"


def test_interactive_encounter_prompt(game_session):
    game_session.run("cd cellar/armoury/chamber")
    out = game_session.run("./statue")
    assert "y/n" in " ".join(o["text"] for o in out).lower()
    assert game_session.snapshot()["awaiting_input"] is True
    game_session.run("n")  # decline
    assert game_session.snapshot()["awaiting_input"] is False


def test_recorder_and_scorer(tmp_path, game_session):
    rec = SessionRecorder("testsid", tmp_path / "s.jsonl")
    rec.start(game_session.snapshot())
    for cmd in ["ls", "cat scroll", "cd cellar", "cat scroll"]:
        before = game_session.snapshot()
        outputs = game_session.run(cmd)
        after = game_session.snapshot()
        rec.record_command(cmd, outputs, before, after)
    rec.end(game_session.snapshot())

    lines = (tmp_path / "s.jsonl").read_text(encoding="utf-8").splitlines()
    assert lines and all(json.loads(ln) for ln in lines), "log must be valid JSONL"

    report = scorer.score(tmp_path, gate_rooms=1, gate_scrolls=1)
    assert report["count"] == 1
    assert report["median_scrolls"] >= 1
    assert report["passed"] is True


def test_harness_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setenv("BASHCRAWL_PLAYTEST_LOG_DIR", str(tmp_path))
    harness = PlaytestHarness()
    try:
        screen = harness.start(fresh=True)
        assert "Location : entrance" in screen
        moved = harness.command("cd cellar")
        assert "Location : entrance/cellar" in moved
        scroll = harness.command("cat scroll")
        assert len(scroll) > 200 and ("===" in scroll or "###" in scroll)
        harness.report_gap("just checking the gap path")
    finally:
        harness.close()
    assert list(tmp_path.glob("*.jsonl")), "a session log should have been written"


def test_sentinel_not_forgeable_via_env(game_session):
    """`env`/`set`/`echo $PS1` print PS1's raw value — it must NOT desync us.

    Regression: the sentinel used to be forgeable because PS1's literal text
    matched the prompt regex, shifting every later reply by one turn.
    """
    game_session.run("env | head -40")
    out = game_session.run("echo MARKER42")
    assert any("MARKER42" in o["text"] for o in out), out
    snap = game_session.snapshot()
    assert snap["cwd"] == "entrance"
    assert "scroll" in snap["room_items"], snap["room_items"]

    game_session.run("echo $PS1")
    out = game_session.run("echo MARKER43")
    assert any("MARKER43" in o["text"] for o in out), out


def test_slow_output_not_misread_as_prompt(game_session):
    """A mid-output pause (sleep) must not truncate output or desync turns."""
    out = game_session.run("echo part1; sleep 1; echo part2")
    text = "\n".join(o["text"] for o in out)
    assert "part1" in text and "part2" in text, text
    assert game_session.snapshot()["awaiting_input"] is False
    out = game_session.run("echo NEXT")
    assert any("NEXT" in o["text"] for o in out), out


def test_multiline_input_collapses_to_one_turn(game_session):
    """A multi-line payload must yield exactly one reply, not a shifted queue."""
    out = game_session.run("echo A\necho B")
    text = "\n".join(o["text"] for o in out)
    assert "A" in text and "B" in text, text
    out = game_session.run("echo C")
    assert any("C" in o["text"] for o in out), out


def test_mcp_transport_imports():
    pytest.importorskip("mcp")
    from playtest import mcp_server

    assert mcp_server.mcp is not None
    assert callable(mcp_server.main)
