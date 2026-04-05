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
import sys
from pathlib import Path
from typing import Optional

from .game_state import SAVE_FILE_NAME
from .mcp_session import HeadlessSession


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


def _sanitize(s: str) -> str:
    """Sanitize a string for use in a filename."""
    return "".join(c if c.isalnum() or c in "-_" else "_" for c in s)[:40]


async def _run_agent(
    game_root: Path,
    screenshot_dir: Path,
    auto_screenshot: bool = True,
) -> None:
    """Main async loop: drive the Textual app via HeadlessSession (Pilot API)."""
    from datetime import datetime

    # Use unified save (same as HeadlessSession default) so legacy .ti_save.json
    # cannot override .bashcrawl_save.json when both exist locally.
    save_path = game_root / SAVE_FILE_NAME
    hs = HeadlessSession(game_root, save_path=save_path)
    await hs.start()
    state = hs.app.game_state

    screenshot_dir.mkdir(parents=True, exist_ok=True)
    cmd_counter = 0
    manifest_entries: list[dict] = []

    def _record_screenshot(path: Path, trigger: str, command: str = "", room: str = "") -> None:
        size = path.stat().st_size if path.exists() else 0
        manifest_entries.append(
            {
                "name": path.name,
                "path": str(path),
                "trigger": trigger,
                "command": command,
                "room": room,
                "ts": datetime.now().isoformat(timespec="seconds"),
                "size_bytes": size,
            }
        )

    def _write_manifest() -> None:
        total_size = sum(e["size_bytes"] for e in manifest_entries)
        manifest = {
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "screenshot_dir": str(screenshot_dir),
            "total_screenshots": len(manifest_entries),
            "total_size_bytes": total_size,
            "screenshots": manifest_entries,
        }
        manifest_path = screenshot_dir / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, indent=2))

    print("BASHCRAWL AGENT TUI v1.0", flush=True)
    print(f"Game root: {game_root}", flush=True)
    print(f"Screenshots: {screenshot_dir}", flush=True)
    print("Send commands one per line. Meta: SCREENSHOT, STATUS, EXIT", flush=True)

    try:
        if auto_screenshot:
            path = screenshot_dir / "000_initial.svg"
            hs.save_screenshot(path)
            _record_screenshot(path, "agent_auto", command="(startup)")
            print(f"SCREENSHOT: {path}", flush=True)

        print("READY>", flush=True)

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

            if upper == "EXIT" or upper == "QUIT":
                _write_manifest()
                state.save(save_path=save_path)
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
                hs.save_screenshot(str(path))
                _record_screenshot(path, "explicit", command=line)
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

            cmd_counter += 1
            print(f"CMD> {line}", flush=True)

            try:
                await hs.submit_command(line)
            except Exception as exc:
                print(f"ERROR: {exc}", flush=True)

            if auto_screenshot:
                path = screenshot_dir / f"{cmd_counter:03d}_{_sanitize(line)}.svg"
                hs.save_screenshot(str(path))
                _record_screenshot(path, "agent_auto", command=line, room=state.current_location)
                print(f"SCREENSHOT: {path}", flush=True)

            print("READY>", flush=True)

        _write_manifest()
        state.save(save_path=save_path)
    finally:
        await hs.stop()


def main() -> None:
    """CLI entry point."""
    game_root: Optional[Path] = None
    screenshot_dir = Path("./logs/screenshots")
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
