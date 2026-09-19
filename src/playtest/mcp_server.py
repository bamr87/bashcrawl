"""FastMCP server that lets an agent play the real Bashcrawl dungeon.

Tools:

* ``bashcrawl_start`` / ``bashcrawl_observe`` / ``bashcrawl_command`` /
  ``bashcrawl_report_gap`` / ``bashcrawl_stop`` — play like a human at a
  terminal (blank-slate prompt in ``scripts/blank_slate_prompt.txt``).
* ``bashcrawl_state`` — compact JSON turn context (room, listing, scroll,
  inventory, HP). Opt-in; blank-slate agents simply never call it.

Pass ``context=true`` to ``bashcrawl_start`` to attach a room HUD to every
observe/command reply without dumping the full scroll each turn.

Run it as::

    PYTHONPATH=src python3 -m playtest.mcp_server

All session logic lives in :class:`playtest.harness.PlaytestHarness` (no ``mcp``
dependency); this module is only the FastMCP transport shell.
"""

from __future__ import annotations

import atexit

try:  # mcp 1.x
    from mcp.server.fastmcp import FastMCP
except ModuleNotFoundError:  # mcp >= 2.0 renamed FastMCP to MCPServer
    from mcp.server import MCPServer as FastMCP

from .harness import PlaytestHarness

mcp = FastMCP("bashcrawl")
_harness = PlaytestHarness()
atexit.register(_harness.close)


@mcp.tool()
def bashcrawl_start(fresh: bool = True, context: bool = False) -> str:
    """Begin a new game in a throwaway sandbox. Always call this first.

    Set context=true to include a room HUD (listing, teaches, next steps) on
    every observe/command reply. Full scroll text is still via bashcrawl_state
    or by running `cat scroll`.
    """
    return _harness.start(fresh, context=context)


@mcp.tool()
def bashcrawl_observe() -> str:
    """Look again: location, health, inventory, and the last output.

    In context mode this also lists the current room (exits, files, encounters).
    """
    return _harness.observe()


@mcp.tool()
def bashcrawl_command(line: str) -> str:
    """Run one command line in the game (or answer a prompt the game is showing)."""
    return _harness.command(line)


@mcp.tool()
def bashcrawl_state() -> str:
    """JSON snapshot of this turn: room, listing, scroll, inventory, HP, last output.

    Use this when you need efficient context without guessing from the screen.
    Hidden dotfiles are included. Does not change the game.
    """
    return _harness.state_json(include_scroll=True)


@mcp.tool()
def bashcrawl_report_gap(note: str) -> str:
    """Report that the screen did not tell you what to do next."""
    return _harness.report_gap(note)


@mcp.tool()
def bashcrawl_stop() -> str:
    """End the session and destroy the sandbox."""
    _harness.close()
    return "Session closed. Call bashcrawl_start to play again."


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
