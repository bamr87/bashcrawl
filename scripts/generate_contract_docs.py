#!/usr/bin/env python3
"""Generate docs from shared content contracts."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "src/help/data"
OUT_DIR = ROOT / "docs/generated"


def _load_yaml(name: str) -> dict[str, Any]:
    path = DATA_DIR / name
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        raise ValueError(f"{name} must contain a top-level object")
    return data


def _render_rooms(data: dict[str, Any]) -> str:
    rooms = data.get("rooms", {})
    lines = ["# Rooms Index", "", "Generated from `src/help/data/rooms.yaml`.", ""]
    for key, spec in sorted(rooms.items()):
        if not isinstance(spec, dict):
            continue
        title = spec.get("title", key)
        path = spec.get("path", "")
        hint = spec.get("context_hint", "")
        lines.append(f"## {key}")
        lines.append(f"- Title: {title}")
        lines.append(f"- Path: `{path}`")
        lines.append(f"- Hidden: `{bool(spec.get('hidden', False))}`")
        if hint:
            lines.append(f"- Hint: {hint}")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def _render_quests(data: dict[str, Any]) -> str:
    quests = data.get("quests", [])
    lines = ["# Quest Index", "", "Generated from `src/help/data/quests.yaml`.", ""]
    for quest in quests:
        if not isinstance(quest, dict):
            continue
        qid = quest.get("id", "?")
        lines.append(f"## Quest {qid}: {quest.get('title', '')}")
        lines.append(f"- Objective: {quest.get('objective', '')}")
        lines.append(f"- XP: `{quest.get('xp', 0)}`")
        completion = quest.get("completion", {}) or {}
        if isinstance(completion, dict):
            lines.append(f"- Completion command: `{completion.get('command', '')}`")
            lines.append(f"- Completion location: `{completion.get('location', '')}`")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def _render_runtime_commands(data: dict[str, Any]) -> str:
    commands = data.get("commands", [])
    lines = [
        "# Runtime Commands",
        "",
        "Generated from `src/help/data/runtime_commands.yaml`.",
        "",
        "| Command | Python | Bash | AI | Demo |",
        "|---|---:|---:|---:|---:|",
    ]
    for cmd in commands:
        if not isinstance(cmd, dict):
            continue
        runtimes = cmd.get("runtimes", {}) or {}
        lines.append(
            "| {name} | {python} | {bash} | {ai} | {demo} |".format(
                name=cmd.get("name", ""),
                python="yes" if runtimes.get("python") else "no",
                bash="yes" if runtimes.get("bash") else "no",
                ai="yes" if runtimes.get("ai") else "no",
                demo="yes" if runtimes.get("demo") else "no",
            )
        )
    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    rooms = _load_yaml("rooms.yaml")
    quests = _load_yaml("quests.yaml")
    runtime_commands = _load_yaml("runtime_commands.yaml")

    (OUT_DIR / "rooms.md").write_text(_render_rooms(rooms), encoding="utf-8")
    (OUT_DIR / "quests.md").write_text(_render_quests(quests), encoding="utf-8")
    (OUT_DIR / "runtime-commands.md").write_text(
        _render_runtime_commands(runtime_commands),
        encoding="utf-8",
    )

    print("✅ Generated docs:")
    print("- docs/generated/rooms.md")
    print("- docs/generated/quests.md")
    print("- docs/generated/runtime-commands.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
