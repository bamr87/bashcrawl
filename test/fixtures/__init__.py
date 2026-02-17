"""Sandbox fixture for isolated game testing.

Creates a temporary copy of the entire bashcrawl game tree so tests
can mutate files (unlock rooms, create flag files, etc.) without
affecting the real repo.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Generator

# Directories/files to exclude from the sandbox copy (not needed for gameplay)
_EXCLUDE = {
    ".git",
    "node_modules",
    "__pycache__",
    "logs",
    "test",
    ".venv",
    "venv",
}


def find_game_root() -> Path:
    """Locate the bashcrawl repo root by walking up from this file."""
    candidate = Path(__file__).resolve().parent
    for _ in range(6):
        candidate = candidate.parent
        if (candidate / "entrance").is_dir() and (candidate / "main.sh").is_file():
            return candidate
    raise FileNotFoundError("Cannot find bashcrawl game root from test fixtures")


def create_sandbox(game_root: Path | None = None) -> Path:
    """Create a temporary copy of the game tree.

    Returns the Path to the sandbox root. Caller is responsible for
    cleanup (or use :func:`sandbox_context`).
    """
    if game_root is None:
        game_root = find_game_root()

    sandbox = Path(tempfile.mkdtemp(prefix="bashcrawl_test_"))

    def _ignore(directory: str, contents: list[str]) -> set[str]:
        return {c for c in contents if c in _EXCLUDE}

    shutil.copytree(game_root, sandbox / "game", ignore=_ignore)
    game_dir = sandbox / "game"

    # Create logs directory inside sandbox
    (game_dir / "logs" / "sessions").mkdir(parents=True, exist_ok=True)
    (game_dir / "logs" / "feedback").mkdir(parents=True, exist_ok=True)

    # Run setup.sh --quick to make game files executable
    setup_script = game_dir / "setup.sh"
    if setup_script.is_file():
        try:
            subprocess.run(
                ["bash", str(setup_script), "--quick"],
                cwd=str(game_dir),
                capture_output=True,
                timeout=15,
            )
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError):
            # Non-fatal — tests can still work with manual chmod
            _chmod_game_files(game_dir)

    return sandbox


def _chmod_game_files(game_dir: Path) -> None:
    """Make game script files executable (fallback if setup.sh fails)."""
    script_names = {
        "treasure", "potion", "spell", "statue",
        "monster", "ghost", "goblet",
    }
    for script_name in script_names:
        for path in game_dir.rglob(script_name):
            if path.is_file():
                path.chmod(path.stat().st_mode | 0o755)


def destroy_sandbox(sandbox: Path) -> None:
    """Remove a sandbox directory tree."""
    if sandbox.exists() and str(sandbox).startswith(tempfile.gettempdir()):
        shutil.rmtree(sandbox, ignore_errors=True)


def game_env(game_dir: Path, inventory: str = "", hp: int = 0) -> dict[str, str]:
    """Build an environment dict for running game scripts in the sandbox."""
    env = os.environ.copy()
    env["BASHCRAWL_ROOT"] = str(game_dir)
    env["HOME"] = str(game_dir)
    if inventory:
        env["I"] = inventory
    elif "I" in env:
        del env["I"]
    if hp > 0:
        env["HP"] = str(hp)
    elif "HP" in env:
        del env["HP"]
    return env
