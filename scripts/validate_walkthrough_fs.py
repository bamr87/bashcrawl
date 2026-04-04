#!/usr/bin/env python3
"""Validate test/datasets/walkthrough.json against the repo filesystem.

Walkthrough uses logical paths (e.g. entrance/chapel/...) while the shipped
tree uses hidden directories until unlock (e.g. entrance/.chapel/...). This
script resolves each path segment by trying ``name`` then ``.name`` when the
directory or file is missing.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
_TEST_ROOT = _REPO_ROOT / "test"
if str(_TEST_ROOT) not in sys.path:
    sys.path.insert(0, str(_TEST_ROOT))

from fixtures.logical_paths import resolve_logical_path  # noqa: E402


def main() -> int:
    root = Path.cwd()
    wt_path = root / "test" / "datasets" / "walkthrough.json"
    if not wt_path.is_file():
        print("ERROR: test/datasets/walkthrough.json not found", file=sys.stderr)
        return 1

    data = json.loads(wt_path.read_text(encoding="utf-8"))
    errors = 0

    print("=== Room directories ===")
    for room in data["rooms"]:
        resolved = resolve_logical_path(root, room)
        if resolved is None or not resolved.is_dir():
            print(f"ERROR: Room directory missing: {room}")
            errors += 1
        else:
            try:
                rel = resolved.relative_to(root)
            except ValueError:
                rel = resolved
            print(f"OK: {room}/ -> {rel}")

    print("")
    print("=== Scroll files (scroll=true) ===")
    for room, spec in data["rooms"].items():
        if not spec.get("scroll"):
            continue
        base = resolve_logical_path(root, room)
        if base is None or not base.is_dir():
            print(f"ERROR: No directory for scroll check: {room}")
            errors += 1
            continue
        scroll = base / "scroll"
        if not scroll.is_file():
            print(f"ERROR: Missing scroll in {room}/")
            errors += 1
        else:
            print(f"OK: {scroll.relative_to(root)}")

    print("")
    print("=== Encounter scripts ===")
    for script_path in data["encounters"]:
        resolved = resolve_logical_path(root, script_path)
        if resolved is None or not resolved.is_file():
            print(f"ERROR: Encounter script missing: {script_path}")
            errors += 1
        else:
            print(f"OK: {resolved.relative_to(root)}")

    print("")
    if errors:
        print(f"walkthrough.json validation FAILED with {errors} error(s).", file=sys.stderr)
        return 1
    print("walkthrough.json validation passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
