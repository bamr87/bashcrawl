#!/usr/bin/env python3
"""Validate command parity against src/help/data/runtime_commands.yaml."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parent.parent


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _load_manifest() -> list[dict[str, Any]]:
    path = ROOT / "src/help/data/runtime_commands.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    commands = data.get("commands", [])
    if not isinstance(commands, list):
        raise ValueError("runtime_commands.yaml: 'commands' must be a list")
    return [c for c in commands if isinstance(c, dict)]


def _python_commands() -> set[str]:
    text = _read(ROOT / "src/terminal-illness/ti/engine/command_table.py")
    return set(re.findall(r'\(\s*"([a-z0-9_-]+)"\s*,\s*"_cmd_', text))


def _bash_commands() -> set[str]:
    text = _read(ROOT / "lib/emulator.sh")
    commands = set(re.findall(r"\n([a-z0-9_-]+)\s+[a-zA-Z0-9_]+\n", text))
    table = re.search(r"_BC_COMMAND_TABLE=\$'(.*?)'", text, re.DOTALL)
    if table:
        for line in table.group(1).replace("\\n", "\n").splitlines():
            parts = line.split()
            if parts:
                commands.add(parts[0])
    for case_expr in re.findall(r'^\s*([|"a-z0-9_-]+)\)\s*$', text, re.MULTILINE):
        for name in re.findall(r'"([a-z0-9_-]+)"', case_expr):
            commands.add(name)
    return commands


def _ai_commands() -> set[str]:
    text = _read(ROOT / "test/ai/session_runner.py")
    return set(re.findall(r"def _cmd_([a-z0-9_]+)\(", text))


def _demo_commands() -> set[str]:
    text = _read(ROOT / "web/assets/js/runtime.js")
    m = re.search(r"this\.handlers\s*=\s*\{(.*?)\};", text, re.DOTALL)
    if not m:
        return set()
    keys = set(re.findall(r"^\s*([a-z][a-z0-9_-]*):", m.group(1), re.MULTILINE))
    keys.update(re.findall(r'^\s*"([a-z][a-z0-9_-]*)":', m.group(1), re.MULTILINE))
    return keys


def validate() -> dict[str, Any]:
    manifest = _load_manifest()
    runtime_sets = {
        "python": _python_commands(),
        "bash": _bash_commands(),
        "ai": _ai_commands(),
        "demo": _demo_commands(),
    }

    errors: list[str] = []
    details: dict[str, Any] = {}

    for runtime, available in runtime_sets.items():
        missing: list[str] = []
        for cmd in manifest:
            runtimes = cmd.get("runtimes", {})
            if not isinstance(runtimes, dict) or not bool(runtimes.get(runtime, False)):
                continue
            name = str(cmd.get("name", "")).strip()
            if name and name not in available:
                missing.append(name)
        if missing:
            errors.append(f"{runtime}: missing commands: {', '.join(sorted(missing))}")
        details[runtime] = {
            "available_count": len(available),
            "missing_from_manifest_requirements": sorted(missing),
        }

    return {
        "ok": not errors,
        "error_count": len(errors),
        "errors": errors,
        "details": details,
    }


def main() -> int:
    result = validate()
    print(json.dumps(result, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
