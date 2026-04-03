"""Integration tests for the Bashcrawl MCP tool layer (in-process, no stdio server)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

pytestmark = [pytest.mark.integration]

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
TI_DIR = REPO_ROOT / "src" / "terminal-illness"


def _has_mcp() -> bool:
    try:
        import mcp  # noqa: F401

        return True
    except ImportError:
        return False


def _has_textual() -> bool:
    try:
        import textual  # noqa: F401

        return True
    except ImportError:
        return False


@pytest.mark.skipif(not _has_mcp(), reason="mcp package not installed")
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


@pytest.mark.skipif(not _has_mcp(), reason="mcp package not installed")
@pytest.mark.skipif(not _has_textual(), reason="textual not installed")
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


def test_game_session_fixture_executes(mcp_session) -> None:
    """``mcp_session`` fixture: basic command execution."""
    result, outputs = mcp_session.execute_line("pwd")
    assert result != "exit"
    assert isinstance(outputs, list)
