"""Real filesystem wrapper for the bashcrawl game.

Replaces the in-memory VirtualFileSystem with operations on the real
bashcrawl game directory tree. All paths are sandboxed to the game root
to prevent players from navigating outside the game.
"""

from __future__ import annotations

import os
import stat
import subprocess
from pathlib import Path
from typing import Sequence


class GameFileSystem:
    """Wraps real filesystem operations, sandboxed to the game root."""

    def __init__(self, game_root: str | Path) -> None:
        self.root = Path(game_root).resolve()
        if not (self.root / "entrance").is_dir():
            raise FileNotFoundError(
                f"Invalid game root: {self.root} (no entrance/ directory found)"
            )

    # ------------------------------------------------------------------
    # Path helpers
    # ------------------------------------------------------------------

    def _resolve(self, cwd: str, path: str) -> Path:
        """Resolve *path* relative to *cwd* and return an absolute Path.

        Both *cwd* and the result are validated to be within the game root.
        """
        if path.startswith("/"):
            # "/entrance/cellar" → treat as relative to game root
            target = self.root / path.lstrip("/")
        else:
            target = (self.root / cwd.lstrip("/")) / path
        resolved = target.resolve()
        # Sandbox check
        try:
            resolved.relative_to(self.root)
        except ValueError:
            raise PermissionError(
                "You cannot venture beyond the boundaries of the dungeon."
            )
        return resolved

    def relpath(self, abspath: Path | str) -> str:
        """Return a game-relative path string like ``entrance/cellar``.

        Returns an empty string for the root directory itself rather than
        ``'.'`` so that callers can compose ``'/' + relpath`` consistently.
        """
        rel = str(Path(abspath).relative_to(self.root))
        return "" if rel == "." else rel

    def abspath(self, cwd: str, path: str = "") -> str:
        """Return the absolute game-relative path."""
        resolved = self._resolve(cwd, path or ".")
        return "/" + self.relpath(resolved)

    # ------------------------------------------------------------------
    # Directory operations
    # ------------------------------------------------------------------

    def ls(self, cwd: str, path: str = "") -> list[str]:
        """List directory contents, annotated with ``/`` for dirs."""
        target = self._resolve(cwd, path or ".")
        if not target.is_dir():
            raise NotADirectoryError(f"Not a directory: {path or cwd}")
        entries: list[str] = []
        for child in sorted(target.iterdir()):
            name = child.name
            if child.is_dir():
                name += "/"
            elif child.is_file() and os.access(child, os.X_OK):
                name += "*"
            entries.append(name)
        return entries

    def cd(self, cwd: str, path: str) -> str:
        """Validate *path* as a directory and return the new game-relative cwd."""
        target = self._resolve(cwd, path)
        if not target.is_dir():
            raise NotADirectoryError(f"Not a directory: {path}")
        return "/" + self.relpath(target)

    def mkdir(self, cwd: str, name: str) -> None:
        """Create a directory."""
        target = self._resolve(cwd, name)
        target.mkdir(parents=False, exist_ok=False)

    # ------------------------------------------------------------------
    # File operations
    # ------------------------------------------------------------------

    def touch(self, cwd: str, name: str) -> None:
        """Create an empty file."""
        target = self._resolve(cwd, name)
        target.touch()

    def read_file(self, cwd: str, path: str) -> str:
        """Read a file's text content."""
        target = self._resolve(cwd, path)
        if not target.is_file():
            raise FileNotFoundError(f"No such file: {path}")
        return target.read_text(errors="replace")

    def write_file(self, cwd: str, path: str, content: str) -> None:
        """Write text content to a file."""
        target = self._resolve(cwd, path)
        target.write_text(content)

    def rm(self, cwd: str, path: str) -> None:
        """Remove a file (not directories)."""
        target = self._resolve(cwd, path)
        if not target.is_file():
            raise FileNotFoundError(f"No such file: {path}")
        target.unlink()

    def cp(self, cwd: str, src: str, dst: str) -> None:
        """Copy a file."""
        import shutil

        src_path = self._resolve(cwd, src)
        dst_path = self._resolve(cwd, dst)
        if not src_path.is_file():
            raise FileNotFoundError(f"No such file: {src}")
        shutil.copy2(src_path, dst_path)

    def mv(self, cwd: str, src: str, dst: str) -> None:
        """Move/rename a file or directory (used for room unlocking)."""
        src_path = self._resolve(cwd, src)
        dst_path = self._resolve(cwd, dst)
        if not src_path.exists():
            raise FileNotFoundError(f"No such file or directory: {src}")
        src_path.rename(dst_path)

    def ln_s(self, cwd: str, target: str, link_name: str) -> None:
        """Create a symbolic link."""
        link_path = self._resolve(cwd, link_name)
        target_path = self._resolve(cwd, target)
        link_path.symlink_to(target_path)

    # ------------------------------------------------------------------
    # Query helpers
    # ------------------------------------------------------------------

    def exists(self, cwd: str, path: str) -> bool:
        """Check if a path exists within the game root."""
        try:
            target = self._resolve(cwd, path)
            return target.exists()
        except PermissionError:
            return False

    def is_executable(self, cwd: str, path: str) -> bool:
        """Check if a file is executable (game script)."""
        try:
            target = self._resolve(cwd, path)
            return target.is_file() and os.access(target, os.X_OK)
        except (PermissionError, FileNotFoundError):
            return False

    def is_dir(self, cwd: str, path: str) -> bool:
        """Check if path is a directory."""
        try:
            target = self._resolve(cwd, path)
            return target.is_dir()
        except PermissionError:
            return False

    def match_paths(self, cwd: str, prefix: str) -> list[str]:
        """Return paths matching *prefix* for tab completion."""
        if "/" in prefix:
            parent_part = prefix.rsplit("/", 1)[0]
            name_prefix = prefix.rsplit("/", 1)[1]
        else:
            parent_part = ""
            name_prefix = prefix

        try:
            target_dir = self._resolve(cwd, parent_part or ".")
        except (PermissionError, FileNotFoundError):
            return []

        if not target_dir.is_dir():
            return []

        results: list[str] = []
        for child in sorted(target_dir.iterdir()):
            if child.name.startswith(name_prefix):
                rel = (parent_part + "/" + child.name) if parent_part else child.name
                if child.is_dir():
                    rel += "/"
                results.append(rel)
        return results

    # ------------------------------------------------------------------
    # Game script execution
    # ------------------------------------------------------------------

    def run_script(
        self,
        cwd: str,
        script: str,
        env_vars: dict[str, str] | None = None,
    ) -> tuple[str, int, dict[str, str]]:
        """Execute a bash game script and return (output, exit_code, env_updates).

        The script is run in a bash subprocess with the given environment
        variables. After execution, we parse any ``export VAR=VALUE``
        instructions from the output so the Python-side game state can
        be updated.
        """
        script_path = self._resolve(cwd, script)
        if not script_path.is_file():
            raise FileNotFoundError(f"No such file: {script}")
        if not os.access(script_path, os.X_OK):
            raise PermissionError(f"Permission denied: {script}")

        env = os.environ.copy()
        if env_vars:
            env.update(env_vars)

        result = subprocess.run(
            ["bash", str(script_path)],
            capture_output=True,
            text=True,
            cwd=str(self._resolve(cwd, ".")),
            env=env,
            timeout=10,
        )

        output = result.stdout
        if result.stderr:
            output += result.stderr

        return output, result.returncode, {}
