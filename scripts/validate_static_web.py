#!/usr/bin/env python3
"""Validate the static GitHub Pages web bundle."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"

# index.html is allowed to link to the project repo; other absolute URLs are rejected.
ALLOWED_INDEX_ABSOLUTE_HREFS = frozenset(
    {
        "https://github.com/bamr87/bashcrawl",
    }
)


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def validate() -> dict:
    errors: list[str] = []
    required = [
        "index.html",
        "assets/css/theme.css",
        "assets/css/terminal.css",
        "assets/js/storage.js",
        "assets/js/runtime.js",
        "assets/js/docs.js",
        "assets/js/game.js",
        "data/world.json",
        "data/quests.json",
        "data/commands.json",
        "data/docs.json",
    ]
    for rel in required:
        if not (WEB / rel).is_file():
            errors.append(f"Missing static web file: web/{rel}")

    index = _read(WEB / "index.html") if (WEB / "index.html").is_file() else ""
    if "url_for(" in index or "{{" in index:
        errors.append("web/index.html must not contain Jinja syntax")
    for src in re.findall(r'(?:src|href)="([^"]+)"', index):
        if src in ALLOWED_INDEX_ABSOLUTE_HREFS:
            continue
        if src.startswith("/") or src.startswith("http://") or src.startswith("https://"):
            errors.append(f"Static asset URL must be relative: {src}")

    if (WEB / "data/world.json").is_file():
        world = json.loads(_read(WEB / "data/world.json"))
        if world.get("root") != "/entrance":
            errors.append("world.json root must be /entrance")
        if "/entrance" not in world.get("directories", {}):
            errors.append("world.json must include /entrance directory")
        if "/entrance/scroll" not in world.get("files", {}):
            errors.append("world.json must include /entrance/scroll content")

    if (WEB / "data/docs.json").is_file():
        docs = json.loads(_read(WEB / "data/docs.json"))
        for key in ("quick_start", "commands", "rooms", "quests", "glossary"):
            if key not in docs:
                errors.append(f"docs.json missing {key}")

    return {"ok": not errors, "error_count": len(errors), "errors": errors}


def main() -> int:
    result = validate()
    print(json.dumps(result, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
