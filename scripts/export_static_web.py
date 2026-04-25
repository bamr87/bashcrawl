#!/usr/bin/env python3
"""Export Bashcrawl content into static JSON for the browser game."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = ROOT / "web" / "data"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUT)
    return parser.parse_args()


def _load_yaml(path: Path) -> dict[str, Any]:
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain a top-level YAML object")
    return data


def _web_path(path: Path) -> str:
    rel = path.relative_to(ROOT).as_posix()
    return "/" + rel


def _is_text_file(path: Path) -> bool:
    try:
        path.read_text(encoding="utf-8")
        return True
    except UnicodeDecodeError:
        return False
    except OSError:
        return False


def _entry_type(path: Path, encounter_paths: set[str]) -> str:
    if path.is_dir():
        return "dir"
    if _web_path(path) in encounter_paths:
        return "exec"
    return "file"


def build_world() -> dict[str, Any]:
    entrance = ROOT / "entrance"
    rooms_yaml = _load_yaml(ROOT / "src/help/data/rooms.yaml").get("rooms", {})
    encounters_yaml = _load_yaml(ROOT / "src/help/data/encounters.yaml").get("encounters", {})

    room_meta_by_path: dict[str, dict[str, Any]] = {}
    slug_to_path: dict[str, str] = {}
    for slug, meta in rooms_yaml.items():
        if not isinstance(meta, dict):
            continue
        path = str(meta.get("path") or "")
        if not path or path == "bashcrawl":
            continue
        full_path = "/" + path.strip("/")
        slug_to_path[slug] = full_path
        room_meta_by_path[full_path] = {
            "slug": slug,
            "title": meta.get("title", slug),
            "emoji": meta.get("emoji", ""),
            "hint": meta.get("context_hint", ""),
            "description": meta.get("description", ""),
            "teaches": meta.get("teaches", []),
            "hidden": bool(meta.get("hidden", False)),
            "next_steps": meta.get("next_steps", ""),
            "essential_commands": meta.get("essential_commands", []),
        }

    encounters_by_path: dict[str, dict[str, Any]] = {}
    for key, spec in encounters_yaml.items():
        if not isinstance(spec, dict):
            continue
        room_path = slug_to_path.get(str(spec.get("room", "")))
        script = str(spec.get("script", ""))
        if not room_path or not script:
            continue
        encounters_by_path[f"{room_path}/{script}"] = {
            "key": key,
            "script": script,
            "type": spec.get("type", ""),
            "description": spec.get("description", ""),
            "icon": spec.get("icon", "⚡"),
            "requires_items": spec.get("requires_items", []),
            "recommended_items": spec.get("recommended_items", []),
            "grants_items": spec.get("grants_items", []),
            "unlocks_rooms": spec.get("unlocks_rooms", []),
            "damage": spec.get("damage", 0),
            "heals": spec.get("heals", 0),
        }

    dirs: dict[str, list[dict[str, Any]]] = {}
    files: dict[str, str] = {}

    for dir_path in [entrance, *[p for p in entrance.rglob("*") if p.is_dir()]]:
        web_dir = _web_path(dir_path)
        children: list[dict[str, Any]] = []
        for child in sorted(dir_path.iterdir(), key=lambda p: (p.name.startswith("."), p.name)):
            typ = _entry_type(child, set(encounters_by_path))
            children.append(
                {
                    "name": child.name,
                    "type": typ,
                    "hidden": child.name.startswith("."),
                }
            )
            if child.is_file() and _is_text_file(child):
                files[_web_path(child)] = child.read_text(encoding="utf-8", errors="replace")
        dirs[web_dir] = children

    return {
        "root": "/entrance",
        "directories": dirs,
        "files": files,
        "rooms": room_meta_by_path,
        "encounters": encounters_by_path,
    }


def build_quests() -> dict[str, Any]:
    data = _load_yaml(ROOT / "src/help/data/quests.yaml")
    return {"quests": data.get("quests", [])}


def build_commands() -> dict[str, Any]:
    reference = _load_yaml(ROOT / "src/help/data/commands.yaml")
    runtime = _load_yaml(ROOT / "src/help/data/runtime_commands.yaml")
    return {
        "categories": reference.get("categories", {}),
        "quick_ref": reference.get("quick_ref", {}),
        "runtime": runtime.get("commands", []),
    }


def build_docs() -> dict[str, Any]:
    rooms = _load_yaml(ROOT / "src/help/data/rooms.yaml").get("rooms", {})
    commands = _load_yaml(ROOT / "src/help/data/commands.yaml")
    quests = _load_yaml(ROOT / "src/help/data/quests.yaml").get("quests", [])
    return {
        "quick_start": [
            "Run pwd to see where you are.",
            "Run ls or ls -F to inspect the room.",
            "Run cat scroll to read room instructions.",
            "Use cd <room> to move through the dungeon.",
        ],
        "rooms": rooms,
        "commands": commands,
        "quests": quests,
        "glossary": [
            {
                "term": "directory",
                "definition": "A folder that can contain files and other directories.",
            },
            {"term": "path", "definition": "A text address for a file or directory."},
            {
                "term": "hidden file",
                "definition": "A file or directory whose name starts with a dot.",
            },
            {
                "term": "executable",
                "definition": "A file you can run as a program, often shown with *.",
            },
            {
                "term": "environment variable",
                "definition": "A named value available to commands, like I or HP.",
            },
        ],
    }


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    out = args.output_dir
    out.mkdir(parents=True, exist_ok=True)
    write_json(out / "world.json", build_world())
    write_json(out / "quests.json", build_quests())
    write_json(out / "commands.json", build_commands())
    write_json(out / "docs.json", build_docs())
    print(f"Exported static web data to {out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
