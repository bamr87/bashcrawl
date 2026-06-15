"""Integration tests for the Bashcrawl MCP tool layer (in-process, no stdio server)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

from fixtures.skips import (
    requires_mcp,
    requires_textual,
    skip_textual_on_windows,
)

pytestmark = [pytest.mark.integration]

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
TI_DIR = REPO_ROOT / "src" / "terminal-illness"


@requires_mcp
class TestMcpEngineTools:
    """Exercise MCP tool functions against engine-mode sessions."""

    @pytest.mark.asyncio
    async def test_start_command_state_stop(self) -> None:
        sys.path.insert(0, str(TI_DIR))
        from ti.mcp_server import (
            bashcrawl_command,
            bashcrawl_completions,
            bashcrawl_room,
            bashcrawl_start,
            bashcrawl_state,
            bashcrawl_stop,
            bashcrawl_screenshot,
        )

        start = await bashcrawl_start(game_root=str(REPO_ROOT), mode="engine")
        assert "error" not in start, start
        sid = start["session_id"]

        pwd = await bashcrawl_command(sid, "pwd")
        assert "error" not in pwd, pwd
        assert pwd["exit"] is False
        assert any(o.get("kind") for o in pwd["outputs"])
        assert "cwd" in pwd["state"]

        st = await bashcrawl_state(sid)
        assert "state" in st and "cwd" in st["state"]

        room = await bashcrawl_room(sid)
        assert "cwd" in room and "items" in room

        comp = await bashcrawl_completions(sid, "c")
        assert "candidates" in comp
        assert isinstance(comp["candidates"], list)

        shot = await bashcrawl_screenshot(sid)
        assert "error" in shot

        done = await bashcrawl_stop(sid)
        assert done.get("ok") is True


@requires_mcp
@requires_textual
@skip_textual_on_windows
@pytest.mark.textual
class TestMcpHeadlessTools:
    """Headless mode: screenshots + commands."""

    @pytest.mark.asyncio
    async def test_headless_screenshot_and_stop(self) -> None:
        sys.path.insert(0, str(TI_DIR))
        from ti.mcp_server import bashcrawl_command, bashcrawl_screenshot, bashcrawl_start, bashcrawl_stop

        start = await bashcrawl_start(game_root=str(REPO_ROOT), mode="headless")
        assert "error" not in start, start
        sid = start["session_id"]

        out = await bashcrawl_command(sid, "pwd")
        assert "error" not in out, out
        assert isinstance(out["outputs"], list)

        svg = await bashcrawl_screenshot(sid, max_chars=50_000)
        assert "error" not in svg, svg
        assert "svg" in svg
        assert "<" in svg["svg"] or "svg" in svg["svg"].lower()

        done = await bashcrawl_stop(sid)
        assert done.get("ok") is True


@requires_mcp
class TestMcpBlankSlate:
    """Fresh, isolated, instrumented playtest sessions (blank-slate mode)."""

    @pytest.mark.asyncio
    async def test_fresh_session_isolated_and_clean(self) -> None:
        """A fresh session starts at quest 0 and never mutates the real repo."""
        import subprocess

        sys.path.insert(0, str(TI_DIR))
        from ti.mcp_server import (
            bashcrawl_command,
            bashcrawl_start,
            bashcrawl_state,
            bashcrawl_stop,
        )

        def repo_dirty_entrance() -> str:
            return subprocess.run(
                ["git", "status", "--porcelain", "entrance"],
                cwd=str(REPO_ROOT), capture_output=True, text=True,
            ).stdout.strip()

        before = repo_dirty_entrance()

        start = await bashcrawl_start(game_root=str(REPO_ROOT), fresh=True)
        assert "error" not in start, start
        assert start.get("fresh") is True
        sid = start["session_id"]

        st = await bashcrawl_state(sid)
        assert st["state"]["current_quest_id"] == 0
        assert st["state"]["inventory"] in ("", None)

        # Drive an unlock (cellar treasure renames .chapel -> chapel) in the sandbox.
        await bashcrawl_command(sid, "cd cellar")
        treasure = await bashcrawl_command(sid, "./treasure")
        assert "error" not in treasure, treasure

        done = await bashcrawl_stop(sid)
        assert done.get("ok") is True
        assert done.get("fresh") is True
        assert "content_gap" in done["events"] or "command" in done["events"]

        # The real repo's entrance/ tree is untouched by the sandboxed unlock.
        assert repo_dirty_entrance() == before

    @pytest.mark.asyncio
    async def test_observe_is_player_only(self) -> None:
        """bashcrawl_observe exposes the HUD but no solution metadata."""
        sys.path.insert(0, str(TI_DIR))
        from ti.mcp_server import (
            bashcrawl_command,
            bashcrawl_observe,
            bashcrawl_start,
            bashcrawl_stop,
        )

        start = await bashcrawl_start(game_root=str(REPO_ROOT), fresh=True)
        sid = start["session_id"]

        obs0 = await bashcrawl_observe(sid)
        assert set(obs0.keys()) == {"screen", "hud"}
        hud = obs0["hud"]
        assert "cwd" in hud and "quest_objective" in hud
        # No leakage of the solution / engine internals.
        leaky = {"completed_quest_ids", "current_quest_id", "quest_total",
                 "learned_commands", "mode", "player_name"}
        assert leaky.isdisjoint(hud.keys()), hud.keys()

        await bashcrawl_command(sid, "pwd")
        obs1 = await bashcrawl_observe(sid)
        assert obs1["screen"]  # the last command's output is now visible

        await bashcrawl_stop(sid)

    @pytest.mark.asyncio
    async def test_report_gap_logged(self) -> None:
        """report_gap writes a self-reported content_gap; rejects non-fresh sessions."""
        import json

        sys.path.insert(0, str(TI_DIR))
        from ti.mcp_server import (
            bashcrawl_report_gap,
            bashcrawl_start,
            bashcrawl_stop,
        )

        start = await bashcrawl_start(game_root=str(REPO_ROOT), fresh=True)
        sid = start["session_id"]
        log_path = Path(start["log_path"])

        gap = await bashcrawl_report_gap(sid, reason="The scroll never said how to dig.")
        assert gap.get("ok") is True

        events = [json.loads(line) for line in log_path.read_text().splitlines()]
        gaps = [e for e in events if e["event"] == "content_gap"]
        assert gaps and gaps[-1]["self_reported"] is True
        assert "dig" in gaps[-1]["reason"]

        await bashcrawl_stop(sid)

        # Non-fresh engine sessions have no recorder -> gap reporting is refused.
        plain = await bashcrawl_start(game_root=str(REPO_ROOT), mode="engine")
        refused = await bashcrawl_report_gap(plain["session_id"], reason="x")
        assert "error" in refused
        await bashcrawl_stop(plain["session_id"])

    @pytest.mark.asyncio
    async def test_feedback_logged_with_category(self) -> None:
        """bashcrawl_feedback records categorized feedback; bad category -> note."""
        import json

        sys.path.insert(0, str(TI_DIR))
        from ti.mcp_server import (
            bashcrawl_feedback,
            bashcrawl_start,
            bashcrawl_stop,
        )

        start = await bashcrawl_start(game_root=str(REPO_ROOT), fresh=True)
        sid = start["session_id"]
        log_path = Path(start["log_path"])

        ok = await bashcrawl_feedback(sid, category="enhancement",
                                      message="Show the quest objective in a sticky header.")
        assert ok.get("ok") is True and ok.get("category") == "enhancement"
        weird = await bashcrawl_feedback(sid, category="frobnicate", message="x")
        assert weird.get("category") == "note"  # unknown category normalizes

        events = [json.loads(line) for line in log_path.read_text().splitlines()]
        fb = [e for e in events if e["event"] == "feedback"]
        assert {e["category"] for e in fb} == {"enhancement", "note"}
        assert any("sticky header" in e["message"] for e in fb)

        await bashcrawl_stop(sid)


def test_game_session_fixture_executes(mcp_session) -> None:
    """``mcp_session`` fixture: basic command execution."""
    result, outputs = mcp_session.execute_line("pwd")
    assert result != "exit"
    assert isinstance(outputs, list)
