"""Agent mode for the Bashcrawl Textual TUI.

Runs the Textual app headlessly and accepts commands via stdin,
producing output + SVG screenshots after each command.

Usage
-----
    python -m ti.agent                          # stdin/stdout REPL
    python -m ti.agent --game-root /path/to     # explicit game root
    python -m ti.agent --screenshot-dir ./shots  # where to save SVGs

Protocol
--------
After startup and after every command, the agent prints::

    READY>

The caller sends one command per line.  Special meta-commands:

    SCREENSHOT [filename]   — save an SVG screenshot (default: auto-named)
    STATUS                  — print JSON game state summary
    EXIT / QUIT             — quit the session

SVG screenshots are saved to ``--screenshot-dir`` (default: ``./screenshots``).
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Optional


def _find_game_root() -> Path:
    """Walk up looking for ``entrance/``."""
    candidate = Path(__file__).resolve().parent
    for _ in range(5):
        candidate = candidate.parent
        if (candidate / "entrance").is_dir():
            return candidate
    cwd = Path.cwd()
    if (cwd / "entrance").is_dir():
        return cwd
    raise FileNotFoundError("Cannot find bashcrawl game root.")


async def _run_agent(
    game_root: Path,
    screenshot_dir: Path,
    auto_screenshot: bool = True,
) -> None:
    """Main async loop: drive the Textual app via its Pilot API."""
    from .filesystem import GameFileSystem
    from .game_state import GameState
    from .app import BashcrawlApp

    fs = GameFileSystem(game_root)
    state = GameState.load(save_path=game_root / ".ti_save.json")

    # Set a player name so the app doesn't think it's a fresh game
    state.player_name = state.player_name or "Agent"

    app = BashcrawlApp(state=state, fs=fs, agent_mode=True)

    screenshot_dir.mkdir(parents=True, exist_ok=True)
    cmd_counter = 0

    print(f"BASHCRAWL AGENT TUI v1.0", flush=True)
    print(f"Game root: {game_root}", flush=True)
    print(f"Screenshots: {screenshot_dir}", flush=True)
    print(f"Send commands one per line. Meta: SCREENSHOT, STATUS, EXIT", flush=True)

    async with app.run_test(size=(120, 40)) as pilot:
        # Wait for mount to complete
        await pilot.pause()
        await asyncio.sleep(0.1)
        await pilot.pause()

        # Take initial screenshot
        if auto_screenshot:
            path = screenshot_dir / "000_initial.svg"
            app.save_screenshot(str(path))
            print(f"SCREENSHOT: {path}", flush=True)

        print("READY>", flush=True)

        # Read commands from stdin line by line
        loop = asyncio.get_event_loop()
        reader = asyncio.StreamReader()
        protocol = asyncio.StreamReaderProtocol(reader)
        await loop.connect_read_pipe(lambda: protocol, sys.stdin)

        while True:
            try:
                line_bytes = await reader.readline()
            except Exception:
                break

            if not line_bytes:
                break

            line = line_bytes.decode("utf-8", errors="replace").strip()
            if not line:
                print("READY>", flush=True)
                continue

            upper = line.upper().strip()

            # Meta-commands
            if upper == "EXIT" or upper == "QUIT":
                state.save(save_path=game_root / ".ti_save.json")
                print("SESSION ENDED", flush=True)
                print("READY>", flush=True)
                break

            if upper.startswith("SCREENSHOT"):
                parts = line.split(maxsplit=1)
                filename = parts[1] if len(parts) > 1 else None
                if not filename:
                    cmd_counter += 1
                    filename = f"{cmd_counter:03d}_screenshot.svg"
                if not filename.endswith(".svg"):
                    filename += ".svg"
                path = screenshot_dir / filename
                app.save_screenshot(str(path))
                print(f"SCREENSHOT: {path}", flush=True)
                print("READY>", flush=True)
                continue

            if upper == "STATUS":
                status = {
                    "location": state.current_location,
                    "inventory": state.inventory,
                    "hp": state.hp,
                    "xp": state.experience_points,
                    "quest_id": state.current_quest_id,
                    "completed_quests": state.completed_quest_ids,
                    "learned_commands": state.learned_commands,
                    "player_name": state.player_name,
                    "mode": state.mode,
                }
                print(f"STATUS: {json.dumps(status)}", flush=True)
                print("READY>", flush=True)
                continue

            # Regular game command — type it into the Input widget and submit
            cmd_counter += 1
            print(f"CMD> {line}", flush=True)

            try:
                inp = app.query_one("#command-input")
                inp.value = line
                # In Textual 8+, action_submit is async
                await inp.action_submit()
                # Give the app time to process
                await pilot.pause()
                await asyncio.sleep(0.05)
                await pilot.pause()
            except Exception as exc:
                print(f"ERROR: {exc}", flush=True)

            # Auto-screenshot after each command
            if auto_screenshot:
                path = screenshot_dir / f"{cmd_counter:03d}_{_sanitize(line)}.svg"
                app.save_screenshot(str(path))
                print(f"SCREENSHOT: {path}", flush=True)

            print("READY>", flush=True)

        # Final save
        state.save(save_path=game_root / ".ti_save.json")


def _sanitize(s: str) -> str:
    """Sanitize a string for use in a filename."""
    return "".join(c if c.isalnum() or c in "-_" else "_" for c in s)[:40]


def main() -> None:
    """CLI entry point."""
    game_root: Optional[Path] = None
    screenshot_dir = Path("./screenshots")
    auto_screenshot = True

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--game-root" and i + 1 < len(args):
            game_root = Path(args[i + 1])
            i += 2
        elif args[i] == "--screenshot-dir" and i + 1 < len(args):
            screenshot_dir = Path(args[i + 1])
            i += 2
        elif args[i] == "--no-auto-screenshot":
            auto_screenshot = False
            i += 1
        else:
            i += 1

    if game_root is None:
        try:
            game_root = _find_game_root()
        except FileNotFoundError as exc:
            print(f"Error: {exc}", file=sys.stderr)
            sys.exit(1)

    asyncio.run(_run_agent(game_root, screenshot_dir, auto_screenshot))


if __name__ == "__main__":
    main()
