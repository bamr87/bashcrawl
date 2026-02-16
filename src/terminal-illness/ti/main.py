from __future__ import annotations

import sys
from pathlib import Path

from prompt_toolkit import PromptSession
from rich.console import Console

from .game_state import GameState
from .terminal_engine import TerminalEngine
from .filesystem import GameFileSystem


def _find_game_root() -> Path:
    """Auto-detect the bashcrawl game root directory.

    Searches upward from this file's location for a directory containing
    ``entrance/``. Falls back to current working directory.
    """
    # Walk up from src/terminal-illness/ti/ → src/terminal-illness/ → src/ → repo root
    candidate = Path(__file__).resolve().parent
    for _ in range(5):
        candidate = candidate.parent
        if (candidate / "entrance").is_dir():
            return candidate
    # Fallback: check cwd
    cwd = Path.cwd()
    if (cwd / "entrance").is_dir():
        return cwd
    raise FileNotFoundError(
        "Cannot find bashcrawl game root. Run from the repo directory "
        "or pass --game-root PATH."
    )


def run() -> None:
    console = Console()

    # Parse optional --game-root argument
    game_root = None
    args = sys.argv[1:]
    if "--game-root" in args:
        idx = args.index("--game-root")
        if idx + 1 < len(args):
            game_root = Path(args[idx + 1])
        else:
            console.print("[red]--game-root requires a path argument[/]")
            sys.exit(1)

    if game_root is None:
        try:
            game_root = _find_game_root()
        except FileNotFoundError as e:
            console.print(f"[red]{e}[/]")
            sys.exit(1)

    fs = GameFileSystem(game_root)
    console.print(f"[dim]Game root: {game_root}[/]")

    saved = GameState.load()
    session = PromptSession()

    if saved.player_name or saved.experience_points > 0 or saved.completed_quest_ids:
        console.print("Save found.")
        choice = session.prompt("Load game? (y/n): ").strip().lower()
        if choice.startswith("y"):
            state = saved
        else:
            state = GameState()
    else:
        state = saved  # new state by default

    if not state.player_name:
        name = session.prompt("Enter your adventurer name (or leave blank): ").strip()
        state.player_name = name or None

    mode_choice = session.prompt("Choose mode [classic/dynamic] (default classic): ").strip().lower()
    state.mode = "dynamic" if mode_choice == "dynamic" else "classic"

    engine = TerminalEngine(state, fs)
    engine.run_loop()

