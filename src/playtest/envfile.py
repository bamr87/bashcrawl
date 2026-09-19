"""Load a local ``.env`` without adding a dotenv dependency.

Existing process env wins (``setdefault``), so CI secrets and explicit exports
are not overwritten. Never logs values.
"""

from __future__ import annotations

import os
from pathlib import Path

from .sandbox import find_game_root


def load_envfile(path: Path | None = None) -> Path | None:
    """Parse KEY=VALUE lines into ``os.environ`` if the file exists."""
    if path is None:
        try:
            path = find_game_root() / ".env"
        except FileNotFoundError:
            path = Path.cwd() / ".env"
    if not path.is_file():
        return None
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if not key or key.startswith("export "):
            key = key.removeprefix("export ").strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        if key:
            os.environ.setdefault(key, value)
    return path


def xai_api_key() -> str:
    """xAI's documented name is ``XAI_API_KEY``; ``XAI_TOKEN`` is accepted too."""
    load_envfile()
    return (os.environ.get("XAI_API_KEY") or os.environ.get("XAI_TOKEN") or "").strip()
