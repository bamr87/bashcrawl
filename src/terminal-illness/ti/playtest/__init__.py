"""Blank-slate playtest support for Bashcrawl.

This package powers the zero-knowledge playtest harness: a fresh, isolated
copy of the game tree per session (:mod:`ti.playtest.sandbox`) and a JSONL
recorder that turns each MCP action into an auditable session log
(:mod:`ti.playtest.recorder`). It is consumed by the MCP server
(``ti.mcp_server``) so an external agent — e.g. Claude Code — can play the
game using *only* the on-screen content and have every move scored offline.
"""

from .recorder import SessionRecorder, classify_outcome
from .sandbox import create_sandbox, destroy_sandbox, find_game_root, game_env

__all__ = [
    "SessionRecorder",
    "classify_outcome",
    "create_sandbox",
    "destroy_sandbox",
    "find_game_root",
    "game_env",
]
