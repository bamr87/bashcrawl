"""Lean, bash-native playtest harness for Bashcrawl.

An external agent (e.g. Claude Code) drives the *real* filesystem game through
the MCP server in :mod:`playtest.mcp_server`. Unlike the retired Textual-TUI
harness, nothing here reimplements the game or depends on ``textual`` — the
agent plays the actual ``entrance/`` dungeon in an isolated bash subprocess.

Public surface:

* :func:`playtest.sandbox.create_sandbox` — throwaway copy of the game tree.
* :class:`playtest.recorder.SessionRecorder` — JSONL audit log + gap detector.
* :class:`playtest.bash_session.BashGameSession` — a PTY-backed bash REPL that
  runs the sandboxed game and snapshots ``pwd`` / ``$I`` / ``$HP``.
* :mod:`playtest.mcp_server` — the FastMCP server exposing the agent tools.
* :mod:`playtest.scorer` — aggregate session logs into pass/fail gate metrics.
"""

from __future__ import annotations

from .recorder import SessionRecorder, classify_outcome
from .sandbox import create_sandbox, destroy_sandbox, find_game_root, sandbox_game_dir

__all__ = [
    "SessionRecorder",
    "classify_outcome",
    "create_sandbox",
    "destroy_sandbox",
    "find_game_root",
    "sandbox_game_dir",
]
