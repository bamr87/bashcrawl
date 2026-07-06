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
        "assets/js/reference.js",
        "assets/js/arcade.js",
        "assets/js/game.js",
        "assets/js/shell.js",
        "data/world.json",
        "data/quests.json",
        "data/commands.json",
        "data/docs.json",
        "data/arcade.json",
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

    if (WEB / "data/arcade.json").is_file():
        arcade = json.loads(_read(WEB / "data/arcade.json"))
        for key in ("pipe_puzzles", "hunt_scenarios", "flash_decks"):
            if not arcade.get(key):
                errors.append(f"arcade.json missing or empty: {key}")
        for puzzle in arcade.get("pipe_puzzles", []):
            for field in ("id", "title", "brief", "file", "input", "target", "hint"):
                if not puzzle.get(field):
                    errors.append(f"pipe puzzle {puzzle.get('id', '?')} missing {field}")
        for hunt in arcade.get("hunt_scenarios", []):
            for field in ("id", "title", "brief", "sigil", "tree", "files", "hint"):
                if not hunt.get(field):
                    errors.append(f"hunt {hunt.get('id', '?')} missing {field}")
            sigil = str(hunt.get("sigil", ""))
            carriers = [c for c in (hunt.get("files") or {}).values() if sigil and sigil in c]
            if len(carriers) != 1:
                errors.append(f"hunt {hunt.get('id', '?')}: sigil must appear in exactly one file")
        for deck in arcade.get("flash_decks", []):
            if not deck.get("cards"):
                errors.append(f"flash deck {deck.get('id', '?')} has no cards")
            for card in deck.get("cards", []):
                if not card.get("q") or not card.get("a"):
                    errors.append(f"flash deck {deck.get('id', '?')} has a card missing q/a")

    return {"ok": not errors, "error_count": len(errors), "errors": errors}


def main() -> int:
    result = validate()
    print(json.dumps(result, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
