"""Shared command table for TerminalEngine registration.

Primary source of truth is ``src/help/data/runtime_commands.yaml``.
Falls back to the in-file defaults if YAML is unavailable.
"""

from __future__ import annotations

from pathlib import Path
from typing import Final

import yaml

_DEFAULT_COMMAND_TABLE: Final[list[tuple[str, str, str]]] = [
    ("help", "_cmd_help", "Show available commands"),
    ("pwd", "_cmd_pwd", "Print working directory"),
    ("ls", "_cmd_ls", "List directory contents"),
    ("cd", "_cmd_cd", "Change directory"),
    ("mkdir", "_cmd_mkdir", "Create directory"),
    ("touch", "_cmd_touch", "Create empty file"),
    ("cat", "_cmd_cat", "Print file contents"),
    ("grep", "_cmd_grep", "Search for text in a file"),
    ("rm", "_cmd_rm", "Remove a file"),
    ("cp", "_cmd_cp", "Copy a file"),
    ("mv", "_cmd_mv", "Move/rename file or directory"),
    ("export", "_cmd_export", "Set a game variable"),
    ("echo", "_cmd_echo", "Print text or variable value"),
    ("save", "_cmd_save", "Save your progress"),
    ("load", "_cmd_load", "Load your progress"),
    ("merlin", "_cmd_merlin", "Ask Merlin for a hint"),
    ("exit", "_cmd_exit", "Exit the game"),
    ("volume", "_cmd_volume", "Set audio volume (0-100)"),
    ("mute", "_cmd_mute", "Toggle audio mute"),
]


def _runtime_commands_path() -> Path:
    # .../src/terminal-illness/ti/engine/command_table.py -> repo root
    repo_root = Path(__file__).resolve().parents[4]
    return repo_root / "src/help/data/runtime_commands.yaml"


def _load_command_table() -> list[tuple[str, str, str]]:
    path = _runtime_commands_path()
    if not path.is_file():
        return list(_DEFAULT_COMMAND_TABLE)

    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except Exception:
        return list(_DEFAULT_COMMAND_TABLE)

    commands = data.get("commands", [])
    loaded: list[tuple[str, str, str]] = []
    if not isinstance(commands, list):
        return list(_DEFAULT_COMMAND_TABLE)

    for item in commands:
        if not isinstance(item, dict):
            continue
        runtimes = item.get("runtimes", {})
        if isinstance(runtimes, dict) and not bool(runtimes.get("python", False)):
            continue
        name = str(item.get("name", "")).strip()
        handler = str(item.get("python_handler", "")).strip()
        help_text = str(item.get("help", "")).strip()
        if name and handler and help_text:
            loaded.append((name, handler, help_text))

    return loaded or list(_DEFAULT_COMMAND_TABLE)


COMMAND_TABLE: Final[list[tuple[str, str, str]]] = _load_command_table()
