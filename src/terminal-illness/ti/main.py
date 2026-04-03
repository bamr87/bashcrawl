"""Entry point for the Bashcrawl Textual TUI.

Usage
-----
    python -m ti                        # auto-detect game root
    python -m ti --game-root /path/to   # explicit root
    python -m ti --web                  # serve in browser via textual-serve
    python -m ti --web --port 9000      # custom port
    python -m ti --ai-stdio             # JSON lines on stdin/stdout (AI / automation)
    python -m ti --automation           # browser-friendly command bar (with --web)

The interactive Textual app is started directly; prompt_toolkit is no
longer used.  All startup prompts (name, mode, load/new) are handled
by the in-app welcome/load screens.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def _find_game_root() -> Path:
    """Walk up from this file's location looking for ``entrance/``."""
    candidate = Path(__file__).resolve().parent
    for _ in range(5):
        candidate = candidate.parent
        if (candidate / "entrance").is_dir():
            return candidate
    cwd = Path.cwd()
    if (cwd / "entrance").is_dir():
        return cwd
    raise FileNotFoundError(
        "Cannot find bashcrawl game root (no 'entrance/' directory found).\n"
        "Run from the repo root or pass --game-root PATH."
    )


def _parse_args() -> dict:
    """Parse CLI arguments into a dict of options."""
    args = sys.argv[1:]
    opts: dict = {
        "game_root": None,
        "web": False,
        "host": "0.0.0.0",
        "port": 8080,
        "debug": False,
        "automation": False,
        "ai_stdio": False,
    }

    i = 0
    while i < len(args):
        if args[i] == "--game-root" and i + 1 < len(args):
            opts["game_root"] = Path(args[i + 1])
            i += 2
        elif args[i] == "--web":
            opts["web"] = True
            i += 1
        elif args[i] == "--host" and i + 1 < len(args):
            opts["host"] = args[i + 1]
            i += 2
        elif args[i] == "--port" and i + 1 < len(args):
            opts["port"] = int(args[i + 1])
            i += 2
        elif args[i] == "--debug":
            opts["debug"] = True
            i += 1
        elif args[i] == "--automation":
            opts["automation"] = True
            i += 1
        elif args[i] == "--ai-stdio":
            opts["ai_stdio"] = True
            i += 1
        else:
            i += 1

    return opts


def run() -> None:
    opts = _parse_args()

    if opts["automation"]:
        os.environ["BASHCRAWL_BROWSER_AUTOMATION"] = "1"

    # ── Resolve game root ───────────────────────────────────────────────
    game_root: Path | None = opts["game_root"]
    if game_root is None:
        try:
            game_root = _find_game_root()
        except FileNotFoundError as exc:
            print(f"Error: {exc}", file=sys.stderr)
            sys.exit(1)

    # ── AI / automation: JSON lines on stdin/stdout (no Textual) ────────
    if opts["ai_stdio"]:
        from .stdio_bridge import run_json_stdio

        run_json_stdio(game_root)
        return

    # ── Web mode: delegate to textual-serve ─────────────────────────────
    if opts["web"]:
        from .web import serve
        serve(
            host=opts["host"],
            port=opts["port"],
            game_root=str(game_root),
            debug=opts["debug"],
            automation=opts["automation"],
        )
        return

    # ── Set up filesystem and game state ────────────────────────────────
    from .app import BashcrawlApp
    from .session import GameSession, resolve_web_session_save_path

    save_path = resolve_web_session_save_path(game_root)
    gs = GameSession.load(game_root, save_path=save_path, ensure_web_save_path=False)

    # ── Launch the Textual TUI ──────────────────────────────────────────
    app = BashcrawlApp(state=gs.state, fs=gs.fs)
    app.run()
