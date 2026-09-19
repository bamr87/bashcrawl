"""Lean, bash-native playtest harness for Bashcrawl.

An external agent drives the *real* filesystem game either:

* directly — ``python3 -m playtest.agent`` (HUD / JSONL / raw PTY sandbox)
* over MCP — ``python3 -m playtest.mcp_server`` (tools including
  ``bashcrawl_state`` for a structured turn snapshot)

Unlike the retired Textual-TUI harness, nothing here reimplements the game.

Public surface:

* :func:`playtest.sandbox.create_sandbox` — throwaway copy of the game tree.
* :class:`playtest.recorder.SessionRecorder` — JSONL audit log + gap detector.
* :class:`playtest.bash_session.BashGameSession` — a PTY-backed bash REPL.
* :class:`playtest.harness.PlaytestHarness` — session + HUD / context packets.
* :mod:`playtest.context` — room listing + scroll + registry turn builder.
* :mod:`playtest.mcp_server` — FastMCP transport.
* :mod:`playtest.xai_auth` — SuperGrok OAuth (OpenCode auth.json) + API-key fallback.
* :mod:`playtest.scorer` — aggregate session logs into pass/fail gate metrics.
"""

from __future__ import annotations

from .context import build_turn, inspect_room, load_room_index, norm_room_path
from .harness import PlaytestHarness
from .recorder import SessionRecorder, classify_outcome
from .sandbox import create_sandbox, destroy_sandbox, find_game_root, sandbox_game_dir

__all__ = [
    "PlaytestHarness",
    "SessionRecorder",
    "build_turn",
    "classify_outcome",
    "create_sandbox",
    "destroy_sandbox",
    "find_game_root",
    "inspect_room",
    "load_room_index",
    "norm_room_path",
    "sandbox_game_dir",
]
