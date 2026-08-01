"""FastMCP server that lets an agent play the real Bashcrawl dungeon.

Exposes four tools — ``bashcrawl_start`` / ``bashcrawl_observe`` /
``bashcrawl_command`` / ``bashcrawl_report_gap`` — matching the names the
blank-slate prompt (``scripts/blank_slate_prompt.txt``) already drives. The
agent is restricted to these tools, so it must learn the game from on-screen
content: it cannot read scrolls or the walkthrough off disk.

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
def bashcrawl_start(fresh: bool = True) -> str:
    """Begin a new game. Always call this first (with fresh=true)."""
    return _harness.start(fresh)


@mcp.tool()
def bashcrawl_observe() -> str:
    """Look again: report location, health, inventory, and the last output."""
    return _harness.observe()


@mcp.tool()
def bashcrawl_command(line: str) -> str:
    """Run one command line in the game (or answer a prompt the game is showing)."""
    return _harness.command(line)


@mcp.tool()
def bashcrawl_report_gap(note: str) -> str:
    """Report that the screen did not tell you what to do next."""
    return _harness.report_gap(note)


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
