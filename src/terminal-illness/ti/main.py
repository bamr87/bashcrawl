from __future__ import annotations

from prompt_toolkit import PromptSession
from prompt_toolkit.shortcuts import yes_no_dialog
from rich.console import Console

from .game_state import GameState
from .terminal_engine import TerminalEngine
from .vfs import VirtualFileSystem


def run() -> None:
    console = Console()
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

    vfs = VirtualFileSystem()
    engine = TerminalEngine(state, vfs)
    engine.run_loop()

