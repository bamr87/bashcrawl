"""Entry point for the Bashcrawl Textual TUI.

Usage
-----
    python -m ti                        # auto-detect game root
    python -m ti --game-root /path/to   # explicit root

The interactive Textual app is started directly; prompt_toolkit is no
longer used.  All startup prompts (name, mode, load/new) are handled
by the in-app welcome/load screens.
"""

from __future__ import annotations

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


def run() -> None:
    # ── Parse --game-root argument ──────────────────────────────────────
    game_root: Path | None = None
    args = sys.argv[1:]
    if "--game-root" in args:
        idx = args.index("--game-root")
        if idx + 1 < len(args):
            game_root = Path(args[idx + 1])
        else:
            print("Error: --game-root requires a path argument", file=sys.stderr)
            sys.exit(1)

    if game_root is None:
        try:
            game_root = _find_game_root()
        except FileNotFoundError as exc:
            print(f"Error: {exc}", file=sys.stderr)
            sys.exit(1)

    # ── Set up filesystem and game state ────────────────────────────────
    from .filesystem import GameFileSystem
    from .game_state import GameState
    from .app import BashcrawlApp

    fs = GameFileSystem(game_root)

    # Load any existing save; the app will prompt the user to keep or discard it.
    state = GameState.load()

    # ── Launch the Textual TUI ──────────────────────────────────────────
    app = BashcrawlApp(state=state, fs=fs)
    app.run()
