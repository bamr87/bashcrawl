"""Shared command table for TerminalEngine registration."""

from __future__ import annotations

from typing import Final

COMMAND_TABLE: Final[list[tuple[str, str, str]]] = [
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
