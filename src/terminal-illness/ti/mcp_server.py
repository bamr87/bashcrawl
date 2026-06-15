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
import os
import uuid
from pathlib import Path
from typing import Any, Dict

from mcp.server.fastmcp import FastMCP

from .main import _find_game_root
from .mcp_session import HeadlessSession
from .playtest.recorder import SessionRecorder
from .playtest.sandbox import create_sandbox, destroy_sandbox, sandbox_game_dir
from .session import GameSession, commands_help_text

mcp = FastMCP("bashcrawl")

_engines: Dict[str, GameSession] = {}
_headless: Dict[str, HeadlessSession] = {}
# Per-session blank-slate bookkeeping (only populated for fresh playtest
# sessions): sandbox dir to clean up, the JSONL recorder, and the last
# command's outputs so bashcrawl_observe can replay the player-visible screen.
_meta: Dict[str, Dict[str, Any]] = {}
_lock = asyncio.Lock()


def _player_hud(state: Dict[str, Any]) -> Dict[str, Any]:
    """Only the fields a real player sees on the HUD — no solution metadata."""
    return {
        "cwd": state.get("cwd"),
        "hp": state.get("hp"),
        "xp": state.get("xp"),
        "inventory": state.get("inventory"),
        "quest_title": state.get("quest_title"),
        "quest_objective": state.get("quest_objective"),
        "room_items": state.get("room_items"),
    }


@mcp.tool()
async def bashcrawl_start(
    game_root: str | None = None,
    mode: str = "engine",
    fresh: bool = False,
) -> dict[str, Any]:
    """Start a Bashcrawl session.

    Args:
        game_root: Repository root containing ``entrance/``. Default: auto-detect.
        mode: ``engine`` (fast, no UI) or ``headless`` (Textual Pilot + screenshots).
        fresh: Start a brand-new game in an isolated throwaway copy of the game
            tree (quest 0, empty inventory) and record the session to JSONL for
            blank-slate playtesting. The real repo is never mutated. ``fresh``
            implies ``engine`` mode. Pair with ``bashcrawl_observe`` /
            ``bashcrawl_report_gap``.
    """
    m = mode.strip().lower()
    if fresh:
        m = "engine"
    if m not in ("engine", "headless"):
        return {"error": f"Invalid mode {mode!r}; use 'engine' or 'headless'."}

    sid = str(uuid.uuid4())

    if fresh:
        source_root = Path(game_root).resolve() if game_root else _find_game_root()
        sandbox = create_sandbox(source_root)
        game_dir = sandbox_game_dir(sandbox)
        save_path = game_dir / ".playtest_save.json"  # nonexistent -> fresh state
        session = GameSession.load(game_dir, save_path=save_path)
        # Write the log to a DURABLE location outside the sandbox so it survives
        # bashcrawl_stop (which discards the sandbox) for the offline scorer.
        # logs/sessions/ is gitignored, so this never churns the repo.
        log_dir = Path(
            os.environ.get("BASHCRAWL_PLAYTEST_LOG_DIR")
            or (source_root / "logs" / "sessions" / "blank_slate")
        )
        log_path = log_dir / f"{sid}.jsonl"
        recorder = SessionRecorder(sid, log_path)
        recorder.start(session.snapshot())
        async with _lock:
            _engines[sid] = session
            _meta[sid] = {
                "sandbox": sandbox,
                "recorder": recorder,
                "log_path": log_path,
                "last_outputs": [],
                "started": True,
            }
        return {
            "session_id": sid,
            "mode": "engine",
            "fresh": True,
            "game_root": str(game_dir),
            "log_path": str(log_path),
        }

    root = Path(game_root).resolve() if game_root else _find_game_root()
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
        meta = _meta.get(session_id)

    if eng_session is not None:
        before = eng_session.snapshot()
        result, outputs = eng_session.execute_line(command)
        after = eng_session.snapshot()
        if meta is not None:
            recorder: SessionRecorder = meta["recorder"]
            recorder.record_command(command, outputs, before, after)
            meta["last_outputs"] = outputs
        return {
            "exit": result == "exit",
            "outputs": outputs,
            "state": after,
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
async def bashcrawl_observe(session_id: str) -> dict[str, Any]:
    """Return only what a player can see — the blank-slate observation surface.

    ``screen`` is the text output of the last command (empty before the first
    command); ``hud`` is the player's heads-up display (location, HP, XP,
    inventory, current quest title/objective, and the items in the room).
    Deliberately omits any solution metadata (command lists, completion
    criteria, walkthrough). Use this instead of ``bashcrawl_state`` when
    playing with no prior knowledge.
    """
    async with _lock:
        eng_session = _engines.get(session_id)
        hs = _headless.get(session_id)
        meta = _meta.get(session_id)

    if eng_session is not None:
        state = eng_session.snapshot()
        last = (meta or {}).get("last_outputs") or []
        screen = "\n".join((o or {}).get("text", "") for o in last)
        return {"screen": screen, "hud": _player_hud(state)}
    if hs is not None:
        return {"screen": "", "hud": _player_hud(hs.snapshot())}
    return {"error": f"Unknown session_id: {session_id}"}


@mcp.tool()
async def bashcrawl_report_gap(
    session_id: str,
    reason: str,
    attempted: list[str] | None = None,
) -> dict[str, Any]:
    """Report that the on-screen content did not say what to do next.

    Call this — instead of guessing from outside knowledge — whenever the
    scrolls, quest text, and encounter output fail to tell you the next step.
    Recorded as a self-reported ``content_gap`` event for the playtest report.

    Args:
        reason: What you were trying to figure out and why you were stuck.
        attempted: Commands you tried that did not help (optional).
    """
    async with _lock:
        eng_session = _engines.get(session_id)
        meta = _meta.get(session_id)

    if meta is None:
        return {
            "error": "bashcrawl_report_gap is only available for fresh playtest "
            "sessions (bashcrawl_start with fresh=true).",
        }
    state = eng_session.snapshot() if eng_session is not None else {}
    recorder: SessionRecorder = meta["recorder"]
    recorder.record_gap(reason, attempted, state)
    return {"ok": True, "logged": "content_gap"}


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
    """Save progress (or finalize a playtest) and tear down a session."""
    async with _lock:
        eng_session = _engines.pop(session_id, None)
        hs = _headless.pop(session_id, None)
        meta = _meta.pop(session_id, None)

    if eng_session is not None:
        if meta is not None:
            # Fresh playtest session: finalize the log and discard the sandbox
            # (never persist save state into the throwaway tree).
            recorder: SessionRecorder = meta["recorder"]
            recorder.end(eng_session.snapshot(), reason="stop")
            destroy_sandbox(meta["sandbox"])
            return {
                "ok": True,
                "mode": "engine",
                "fresh": True,
                "log_path": str(meta["log_path"]),
                "events": recorder.counts,
            }
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
