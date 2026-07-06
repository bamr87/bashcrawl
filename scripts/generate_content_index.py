#!/usr/bin/env python3
"""Generate a normalized content index and validate content invariants."""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

import yaml


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=None, help="write index JSON to this path")
    parser.add_argument(
        "--check", action="store_true", help="exit non-zero if mismatches are detected"
    )
    return parser.parse_args()


def normalize_logical_path(path: str) -> str:
    parts = [p for p in path.split("/") if p]
    normalized = [p[1:] if p.startswith(".") else p for p in parts]
    return "/".join(normalized)


def load_yaml_map(path: Path) -> dict:
    if not path.exists():
        return {}
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return data if isinstance(data, dict) else {}


def build_disk_index(root: Path) -> tuple[set[str], set[str], list[str]]:
    entrance = root / "entrance"
    rooms: set[str] = {"entrance"}
    encounters: set[str] = set()
    errors: list[str] = []

    for d in entrance.rglob("*"):
        if d.is_dir():
            logical = normalize_logical_path(str(d.relative_to(root)).replace("\\", "/"))
            if logical.startswith("entrance"):
                rooms.add(logical)

            name = d.name
            if name.startswith("..") or name == ".":
                errors.append(f"Invalid hidden naming: {d.relative_to(root)}")

        elif d.is_file() and d.suffix == "":
            rel = str(d.relative_to(root)).replace("\\", "/")
            if "/scroll" in rel:
                continue
            encounters.add(normalize_logical_path(rel))

    return rooms, encounters, errors


def main() -> int:
    args = parse_args()
    root = Path.cwd()

    walkthrough_path = root / "test" / "datasets" / "walkthrough.json"
    walkthrough = json.loads(walkthrough_path.read_text(encoding="utf-8"))
    # Player-created rooms (e.g. the workshop conjured with 'mkdir workshop') are
    # gitignored and absent on a clean checkout, so they are not expected on disk.
    wt_rooms = {
        normalize_logical_path(p)
        for p, spec in walkthrough["rooms"].items()
        if not (isinstance(spec, dict) and spec.get("player_created"))
    }
    wt_encounters = {normalize_logical_path(p) for p in walkthrough["encounters"].keys()}

    rooms_yaml = load_yaml_map(root / "src" / "help" / "data" / "rooms.yaml")
    encounters_yaml = load_yaml_map(root / "src" / "help" / "data" / "encounters.yaml")
    room_entries = rooms_yaml.get("rooms", {}) if isinstance(rooms_yaml, dict) else {}
    encounter_entries = (
        encounters_yaml.get("encounters", {}) if isinstance(encounters_yaml, dict) else {}
    )
    reg_rooms = {
        normalize_logical_path(spec.get("path", ""))
        for spec in room_entries.values()
        if isinstance(spec, dict) and spec.get("path")
    }
    reg_rooms.discard("bashcrawl")
    room_slug_to_path = {
        slug: normalize_logical_path(spec.get("path", ""))
        for slug, spec in room_entries.items()
        if isinstance(spec, dict) and spec.get("path")
    }
    reg_encounters = {
        normalize_logical_path(
            f"{room_slug_to_path.get(spec.get('room', ''), 'entrance')}/{spec.get('script', '')}"
        )
        for spec in encounter_entries.values()
        if isinstance(spec, dict) and spec.get("script")
    }

    disk_rooms, disk_encounters, naming_errors = build_disk_index(root)

    report = {
        "generated_at": datetime.now().isoformat(),
        "rooms": {
            "disk_count": len(disk_rooms),
            "walkthrough_count": len(wt_rooms),
            "registry_count": len(reg_rooms),
            "missing_in_walkthrough": sorted(disk_rooms - wt_rooms),
            "missing_in_registry": sorted(disk_rooms - reg_rooms),
            "walkthrough_missing_on_disk": sorted(wt_rooms - disk_rooms),
            "registry_missing_on_disk": sorted(reg_rooms - disk_rooms),
        },
        "encounters": {
            "disk_count": len(disk_encounters),
            "walkthrough_count": len(wt_encounters),
            "registry_count": len(reg_encounters),
            "missing_in_walkthrough": sorted(disk_encounters - wt_encounters),
            "missing_in_registry": sorted(disk_encounters - reg_encounters),
            "walkthrough_missing_on_disk": sorted(wt_encounters - disk_encounters),
            "registry_missing_on_disk": sorted(reg_encounters - disk_encounters),
        },
        "hidden_naming_errors": naming_errors,
    }

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    else:
        print(json.dumps(report, indent=2))

    has_errors = any(
        (
            report["rooms"]["walkthrough_missing_on_disk"],
            report["encounters"]["walkthrough_missing_on_disk"],
            report["hidden_naming_errors"],
        )
    )
    return 1 if args.check and has_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
