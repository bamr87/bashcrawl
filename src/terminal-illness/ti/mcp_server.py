"""MCP server for Bashcrawl — programmatic play, state inspection, SVG screenshots.

Run (stdio transport)::

    PYTHONPATH=src/terminal-illness python3 -m ti.mcp_server

Sessions
--------
* ``mode=engine`` — fast ``GameSession`` (no Textual UI); no screenshots.
* ``mode=headless`` — full ``BashcrawlApp`` under ``run_test``; supports
  ``bashcrawl_screenshot``.
"""

from __future__ import annotations

import asyncio
import uuid
from pathlib import Path
from typing import Any, Dict

from mcp.server.fastmcp import FastMCP

from .main import _find_game_root
from .mcp_session import HeadlessSession
from .session import GameSession, commands_help_text

mcp = FastMCP("bashcrawl")

_engines: Dict[str, GameSession] = {}
_headless: Dict[str, HeadlessSession] = {}
_lock = asyncio.Lock()


@mcp.tool()
async def bashcrawl_start(
    game_root: str | None = None,
    mode: str = "engine",
) -> dict[str, Any]:
    """Start a Bashcrawl session.

    Args:
        game_root: Repository root containing ``entrance/``. Default: auto-detect.
        mode: ``engine`` (fast, no UI) or ``headless`` (Textual Pilot + screenshots).
    """
    root = Path(game_root).resolve() if game_root else _find_game_root()
    m = mode.strip().lower()
    if m not in ("engine", "headless"):
        return {"error": f"Invalid mode {mode!r}; use 'engine' or 'headless'."}

    sid = str(uuid.uuid4())
    if m == "engine":
        session = GameSession.load(root, ensure_web_save_path=False)
        async with _lock:
            _engines[sid] = session
    else:
        hs = HeadlessSession(root)
        await hs.start()
        async with _lock:
            _headless[sid] = hs

    return {
        "session_id": sid,
        "mode": m,
        "game_root": str(root),
    }


@mcp.tool()
async def bashcrawl_command(session_id: str, command: str) -> dict[str, Any]:
    """Execute one game command (e.g. ``cd cellar``, ``ls``, ``cat scroll``)."""
    async with _lock:
        eng_session = _engines.get(session_id)
        hs = _headless.get(session_id)

    if eng_session is not None:
        result, outputs = eng_session.execute_line(command)
        return {
            "exit": result == "exit",
            "outputs": outputs,
            "state": eng_session.snapshot(),
            "room": eng_session.get_room(),
        }

    if hs is not None:
        low = command.strip().lower()
        if low in ("exit", "quit"):
            return {
                "error": "Do not use exit/quit here; call bashcrawl_stop to end the session.",
                "outputs": [],
                "state": hs.snapshot(),
                "room": hs.get_room(),
            }
        outputs = await hs.submit_command_with_outputs(command)
        return {
            "exit": False,
            "outputs": outputs,
            "state": hs.snapshot(),
            "room": hs.get_room(),
        }

    return {"error": f"Unknown session_id: {session_id}"}


@mcp.tool()
async def bashcrawl_screenshot(
    session_id: str,
    max_chars: int = 500_000,
) -> dict[str, Any]:
    """Return the current TUI screen as SVG text (headless sessions only)."""
    async with _lock:
        hs = _headless.get(session_id)

    if hs is None:
        return {
            "error": "Screenshots require a headless session (bashcrawl_start with mode=headless).",
        }

    svg = hs.export_screenshot_svg()
    truncated = len(svg) > max_chars
    if truncated:
        svg = svg[:max_chars]
    return {"svg": svg, "truncated": truncated, "length": len(svg)}


@mcp.tool()
async def bashcrawl_state(session_id: str) -> dict[str, Any]:
    """Return structured game state (location, HP, XP, quest, inventory, …)."""
    async with _lock:
        eng_session = _engines.get(session_id)
        hs = _headless.get(session_id)

    if eng_session is not None:
        return {"state": eng_session.snapshot()}
    if hs is not None:
        return {"state": hs.snapshot()}
    return {"error": f"Unknown session_id: {session_id}"}


@mcp.tool()
async def bashcrawl_completions(session_id: str, text: str) -> dict[str, Any]:
    """Tab-completion candidates for partial command input."""
    async with _lock:
        eng_session = _engines.get(session_id)
        hs = _headless.get(session_id)

    if eng_session is not None:
        return {"candidates": eng_session.get_completions(text)}
    if hs is not None:
        return {"candidates": hs.get_completions(text)}
    return {"error": f"Unknown session_id: {session_id}"}


@mcp.tool()
async def bashcrawl_room(session_id: str) -> dict[str, Any]:
    """Current working directory and room listing."""
    async with _lock:
        eng_session = _engines.get(session_id)
        hs = _headless.get(session_id)

    if eng_session is not None:
        return eng_session.get_room()
    if hs is not None:
        return hs.get_room()
    return {"error": f"Unknown session_id: {session_id}"}


@mcp.tool()
async def bashcrawl_stop(session_id: str) -> dict[str, Any]:
    """Save progress and tear down a session."""
    async with _lock:
        eng_session = _engines.pop(session_id, None)
        hs = _headless.pop(session_id, None)

    if eng_session is not None:
        eng_session.save()
        return {"ok": True, "mode": "engine"}

    if hs is not None:
        await hs.stop()
        return {"ok": True, "mode": "headless"}

    return {"ok": False, "error": f"Unknown session_id: {session_id}"}


@mcp.resource("bashcrawl://help")
def bashcrawl_help_resource() -> str:
    """Built-in command summary for Bashcrawl."""
    return commands_help_text()


@mcp.resource("bashcrawl://map")
def bashcrawl_map_resource() -> str:
    """High-level map / exploration hints."""
    return (
        "Bashcrawl is a directory-based dungeon under the game root. "
        "You usually start in /entrance. Use pwd, ls, and cd to move. "
        "Read scroll files with cat. Executable story scripts often end with *."
    )


def main() -> None:
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
