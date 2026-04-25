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

import argparse
import os
import sys
from pathlib import Path


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Bashcrawl Textual TUI entrypoint")
    parser.add_argument(
        "--game-root",
        type=Path,
        default=None,
        help="Bashcrawl repo root (directory containing entrance/)",
    )
    parser.add_argument(
        "--web",
        action="store_true",
        help="Serve TUI in the browser (textual-serve)",
    )
    parser.add_argument(
        "--host",
        default="0.0.0.0",
        help="Bind address for --web (default: 0.0.0.0)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8080,
        help="Port for --web (default: 8080)",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Debug logging for --web",
    )
    parser.add_argument(
        "--automation",
        action="store_true",
        help="Browser-friendly command bar (with --web)",
    )
    parser.add_argument(
        "--ai-stdio",
        action="store_true",
        help="JSON lines on stdin/stdout (no Textual UI)",
    )
    return parser


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


def _parse_args() -> argparse.Namespace:
    return _build_parser().parse_args()


def run() -> None:
    opts = _parse_args()

    if opts.automation:
        os.environ["BASHCRAWL_BROWSER_AUTOMATION"] = "1"

    # ── Resolve game root ───────────────────────────────────────────────
    game_root: Path | None = opts.game_root
    if game_root is None:
        try:
            game_root = _find_game_root()
        except FileNotFoundError as exc:
            print(f"Error: {exc}", file=sys.stderr)
            sys.exit(1)

    # ── AI / automation: JSON lines on stdin/stdout (no Textual) ────────
    if opts.ai_stdio:
        from .stdio_bridge import run_json_stdio

        run_json_stdio(game_root)
        return

    # ── Web mode: delegate to textual-serve ─────────────────────────────
    if opts.web:
        from .web import serve
        serve(
            host=opts.host,
            port=opts.port,
            game_root=str(game_root),
            debug=opts.debug,
            automation=opts.automation,
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
