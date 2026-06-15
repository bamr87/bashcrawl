#!/usr/bin/env python3
"""Validate test/datasets/walkthrough.json against the repo filesystem.

Walkthrough uses logical paths (e.g. entrance/chapel/...) while the shipped
tree uses hidden directories until unlock (e.g. entrance/.chapel/...). This
script resolves each path segment by trying ``name`` then ``.name`` when the
directory or file is missing.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
_TEST_ROOT = _REPO_ROOT / "test"
if str(_TEST_ROOT) not in sys.path:
    sys.path.insert(0, str(_TEST_ROOT))

from fixtures.logical_paths import resolve_logical_path  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--json",
        action="store_true",
        dest="json_mode",
        help="emit machine-readable JSON report instead of plain text",
    )
    return parser.parse_args()


def _emit_text_report(result: dict) -> None:
    print("=== Room directories ===")
    for item in result["rooms"]:
        status = "OK" if item["ok"] else "ERROR"
        print(f"{status}: {item['logical']} -> {item['resolved']}")

    print("")
    print("=== Scroll files (scroll=true) ===")
    for item in result["scrolls"]:
        status = "OK" if item["ok"] else "ERROR"
        print(f"{status}: {item['logical']} ({item['resolved']})")

    print("")
    print("=== Encounter scripts ===")
    for item in result["encounters"]:
        status = "OK" if item["ok"] else "ERROR"
        print(f"{status}: {item['logical']} -> {item['resolved']}")


def validate(root: Path) -> dict:
    wt_path = root / "test" / "datasets" / "walkthrough.json"
    if not wt_path.is_file():
        return {
            "ok": False,
            "errors": ["test/datasets/walkthrough.json not found"],
            "rooms": [],
            "scrolls": [],
            "encounters": [],
        }

    data = json.loads(wt_path.read_text(encoding="utf-8"))
    errors: list[str] = []
    report = {"rooms": [], "scrolls": [], "encounters": []}

    for room, spec in data["rooms"].items():
        # Player-created rooms (e.g. the workshop the player conjures with
        # 'mkdir workshop') are gitignored and absent on a fresh clone, so skip
        # the on-disk existence requirement for them.
        if isinstance(spec, dict) and spec.get("player_created"):
            report["rooms"].append(
                {"logical": room, "resolved": None, "ok": True, "player_created": True}
            )
            continue
        resolved = resolve_logical_path(root, room)
        ok = resolved is not None and resolved.is_dir()
        if not ok:
            errors.append(f"Room directory missing: {room}")
        report["rooms"].append(
            {
                "logical": room,
                "resolved": str(resolved.relative_to(root)) if resolved and resolved.exists() else None,
                "ok": ok,
            }
        )

    for room, spec in data["rooms"].items():
        if not spec.get("scroll"):
            continue
        base = resolve_logical_path(root, room)
        scroll = (base / "scroll") if base else None
        exists = bool(scroll and scroll.is_file())
        non_empty = bool(scroll and scroll.is_file() and scroll.stat().st_size > 0)
        ok = exists and non_empty
        if not ok:
            if not exists:
                errors.append(f"Missing scroll in {room}/")
            else:
                errors.append(f"Empty scroll in {room}/")
        report["scrolls"].append(
            {
                "logical": f"{room}/scroll",
                "resolved": str(scroll.relative_to(root)) if scroll and scroll.exists() else None,
                "exists": exists,
                "non_empty": non_empty,
                "ok": ok,
            }
        )

    for script_path in data["encounters"]:
        resolved = resolve_logical_path(root, script_path)
        ok = resolved is not None and resolved.is_file()
        if not ok:
            errors.append(f"Encounter script missing: {script_path}")
        report["encounters"].append(
            {
                "logical": script_path,
                "resolved": str(resolved.relative_to(root)) if resolved and resolved.exists() else None,
                "ok": ok,
            }
        )

    return {
        "ok": not errors,
        "error_count": len(errors),
        "errors": errors,
        **report,
    }


def main() -> int:
    args = parse_args()
    result = validate(Path.cwd())
    if args.json_mode:
        print(json.dumps(result, indent=2))
    else:
        _emit_text_report(result)
        print("")
        if result["ok"]:
            print("walkthrough.json validation passed.")
        else:
            print(
                f"walkthrough.json validation FAILED with {result['error_count']} error(s).",
                file=sys.stderr,
            )
            for err in result["errors"]:
                print(f"- {err}", file=sys.stderr)
    if not result["ok"]:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
