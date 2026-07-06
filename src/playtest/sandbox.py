"""Throwaway copy of the game tree for isolated, parallel-safe playtests.

The game mutates the real filesystem during play — collecting treasure runs
``mv ../.chapel ../chapel`` and combat writes flag files. Running a playthrough
against the live repo would therefore churn tracked directories and make
parallel runs interfere. :func:`create_sandbox` copies the playable tree into a
tempdir so each session starts clean and is discarded afterwards.

Ported from the retired ``ti.playtest.sandbox``; the only change is that
:func:`find_game_root` now keys on ``help.sh`` (the launcher ``main.sh`` was
removed when the repo was reduced to terminal-core + web).
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

# Directories/files to exclude from the sandbox copy (not needed for gameplay).
_EXCLUDE = {
    ".git",
    "node_modules",
    "__pycache__",
    "logs",
    "test",
    ".venv",
    "venv",
}

# Executable encounter scripts (used by the chmod fallback when setup.sh fails).
_SCRIPT_NAMES = {
    "treasure", "potion", "spell", "statue",
    "monster", "ghost", "goblet",
    "padlock", "loot", "glass", "box", "drummer",
    "penguin", "rags", "crystal", "open", "statues",
    "nyarlathotep", "altar", "fountain", "wizard-light", "button",
}

# Files created dynamically during gameplay that must NOT exist in a fresh
# sandbox — their presence would skip encounters or short-circuit unlock logic.
_GAME_STATE_FILES = [
    ".statue_defeated",
    "carcass",
    "end",
    "platinum",
    "orb2",
    "orb3",
    "king",
    ".game_state",
    # Saved progress must not leak into a fresh blank-slate run, so drop any
    # save the source repo carried in.
    ".bashcrawl_save.json",
    ".ti_save.json",
]


def find_game_root(start: Path | None = None) -> Path:
    """Locate the bashcrawl repo root by walking up from ``start``.

    The root is the directory containing both ``entrance/`` and ``help.sh``.
    """
    candidate = (start or Path(__file__)).resolve()
    for _ in range(8):
        candidate = candidate.parent
        if (candidate / "entrance").is_dir() and (candidate / "help.sh").is_file():
            return candidate
    raise FileNotFoundError("Cannot find bashcrawl game root from playtest sandbox")


def create_sandbox(game_root: Path | None = None) -> Path:
    """Create a temporary copy of the game tree.

    Returns the sandbox parent directory; the playable tree lives at
    ``<sandbox>/game`` (see :func:`sandbox_game_dir`). The caller owns cleanup
    via :func:`destroy_sandbox`.
    """
    if game_root is None:
        game_root = find_game_root()

    sandbox = Path(tempfile.mkdtemp(prefix="bashcrawl_play_"))
    game_dir = sandbox / "game"
    _populate_sandbox(game_root, game_dir)

    _clean_game_state(game_dir)
    (game_dir / "logs" / "sessions").mkdir(parents=True, exist_ok=True)

    setup_script = game_dir / "setup.sh"
    if setup_script.is_file():
        try:
            subprocess.run(
                ["bash", str(setup_script), "--quick"],
                cwd=str(game_dir),
                capture_output=True,
                timeout=15,
            )
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError, OSError):
            _chmod_game_files(game_dir)
    else:
        _chmod_game_files(game_dir)

    return sandbox


def _tracked_files(src: Path) -> list[str] | None:
    """git-tracked paths under ``src`` (relative), or ``None`` if not a git repo.

    Using tracked files makes the sandbox reflect a *clean checkout*: gitignored
    local artifacts (e.g. a previously player-created ``entrance/workshop``, combat
    flag files, unlocked-room copies) are excluded, so a playtest sees the game a
    fresh player would. Working-tree content is used, so uncommitted edits to
    tracked files are still honored.
    """
    try:
        result = subprocess.run(
            ["git", "-C", str(src), "ls-files", "-z"],
            capture_output=True,
            timeout=20,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0:
        return None
    return [p for p in result.stdout.decode("utf-8", "replace").split("\0") if p]


def _populate_sandbox(src: Path, dst: Path) -> None:
    """Copy the game tree into ``dst`` — tracked files only when ``src`` is a repo."""
    tracked = _tracked_files(src)
    if tracked is None:
        # Not a git checkout: fall back to a full copy minus build/test dirs.
        def _ignore(_directory: str, contents: list[str]) -> set[str]:
            return {c for c in contents if c in _EXCLUDE}

        shutil.copytree(src, dst, ignore=_ignore)
        return

    dst.mkdir(parents=True, exist_ok=True)
    for rel in tracked:
        if rel.split("/", 1)[0] in _EXCLUDE:
            continue
        source = src / rel
        if not source.is_file():  # submodule pointers / odd entries
            continue
        target = dst / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)


def sandbox_game_dir(sandbox: Path) -> Path:
    """The playable game root inside a sandbox created by :func:`create_sandbox`."""
    return sandbox / "game"


def destroy_sandbox(sandbox: Path) -> None:
    """Remove a sandbox directory tree (only if it is under the temp dir)."""
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


def _chmod_game_files(game_dir: Path) -> None:
    """Make game script files executable (fallback if setup.sh is unavailable)."""
    for script_name in _SCRIPT_NAMES:
        for path in game_dir.rglob(script_name):
            if path.is_file():
                path.chmod(path.stat().st_mode | 0o755)


def _clean_game_state(game_dir: Path) -> None:
    """Remove dynamically-generated game-state files from a fresh sandbox."""
    for pattern in _GAME_STATE_FILES:
        for path in game_dir.rglob(pattern):
            if path.is_file():
                path.unlink(missing_ok=True)

    # Remove dynamically-created 'treasure'/'platinum' drops in combat rooms
    # (generated by monster/ghost/nyarlathotep on victory). Must NOT touch the
    # legitimate treasure scripts in cellar/ and armoury/.
    combat_rooms = [
        game_dir / "entrance" / ".chapel" / "courtyard" / "aviary" / "hall",
        game_dir / "entrance" / "chapel" / "courtyard" / "aviary" / "hall",
        game_dir / "entrance" / ".vault" / "stronghold" / "nursery" / "lab",
        game_dir / "entrance" / "vault" / "stronghold" / "nursery" / "lab",
        game_dir / "entrance" / ".rift" / "arena" / "pit",
        game_dir / "entrance" / "rift" / "arena" / "pit",
    ]
    for room in combat_rooms:
        for fname in ("treasure", "platinum"):
            f = room / fname
            if f.is_file():
                f.unlink(missing_ok=True)
