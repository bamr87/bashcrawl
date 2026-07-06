#!/usr/bin/env python3
"""Validate shared Bashcrawl content contracts.

Checks:
- YAML data files are readable and structurally sane
- room/quest/encounter references line up across YAML and walkthrough data
- walkthrough paths resolve on disk (supports hidden-room logical paths)
- required room scrolls and encounter scripts exist
- walkthrough.json stays in sync with the on-disk room/scroll/encounter layout
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import yaml

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
        help="Emit machine-readable JSON report instead of plain text",
    )
    return parser.parse_args()


def _load_yaml(path: Path) -> dict[str, Any]:
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        raise ValueError(f"{path.name} must contain a YAML object at top-level")
    return data


def _add_error(errors: list[str], message: str) -> None:
    errors.append(message)


def _add_warning(warnings: list[str], message: str) -> None:
    warnings.append(message)


def _normalize_logical(path: str) -> str:
    parts = [p for p in path.replace("\\", "/").strip("/").split("/") if p]
    out = []
    for part in parts:
        out.append(part[1:] if part.startswith(".") else part)
    return "/".join(out)


def _validate_required_files(root: Path, errors: list[str], report: dict[str, Any]) -> dict[str, Any]:
    files = {
        "rooms_yaml": root / "src/help/data/rooms.yaml",
        "quests_yaml": root / "src/help/data/quests.yaml",
        "encounters_yaml": root / "src/help/data/encounters.yaml",
        "walkthrough_json": root / "test/datasets/walkthrough.json",
    }
    out: dict[str, Any] = {}
    for key, path in files.items():
        exists = path.is_file()
        out[key] = {"path": str(path.relative_to(root)), "exists": exists}
        if not exists:
            _add_error(errors, f"Missing required file: {path.relative_to(root)}")
    report["required_files"] = out
    return out


def _validate_rooms_and_walkthrough(
    root: Path,
    rooms_data: dict[str, Any],
    walkthrough: dict[str, Any],
    errors: list[str],
    warnings: list[str],
    report: dict[str, Any],
) -> None:
    rooms_map = rooms_data.get("rooms", {})
    wt_rooms = walkthrough.get("rooms", {})
    if not isinstance(rooms_map, dict):
        _add_error(errors, "rooms.yaml: 'rooms' must be an object")
        rooms_map = {}
    if not isinstance(wt_rooms, dict):
        _add_error(errors, "walkthrough.json: 'rooms' must be an object")
        wt_rooms = {}

    yaml_paths: dict[str, str] = {}
    for room_name, spec in rooms_map.items():
        if not isinstance(spec, dict):
            _add_error(errors, f"rooms.yaml: room '{room_name}' must be an object")
            continue
        room_path = str(spec.get("path", "")).strip()
        if room_name == "unknown":
            continue
        if not room_path:
            _add_error(errors, f"rooms.yaml: room '{room_name}' is missing 'path'")
            continue
        if room_path == "bashcrawl":
            continue
        yaml_paths[room_path] = room_name

    wt_paths = set(str(p) for p in wt_rooms.keys())
    yaml_path_set = set(yaml_paths.keys())
    wt_norm = {_normalize_logical(p) for p in wt_paths}
    yaml_norm = {_normalize_logical(p) for p in yaml_path_set}
    missing_in_walkthrough = sorted(yaml_norm - wt_norm)
    missing_in_rooms_yaml = sorted(wt_norm - yaml_norm)

    for p in missing_in_walkthrough:
        _add_warning(warnings, f"rooms.yaml path not represented in walkthrough.json: {p}")
    for p in missing_in_rooms_yaml:
        _add_warning(warnings, f"walkthrough room not represented in rooms.yaml: {p}")

    resolved_rooms: list[dict[str, Any]] = []
    missing_paths: list[str] = []
    missing_scrolls: list[str] = []
    for logical_path, spec in wt_rooms.items():
        # Player-created rooms (conjured at runtime with 'mkdir', gitignored) do
        # not exist in a clean checkout, so they are exempt from the on-disk check.
        player_created = bool(isinstance(spec, dict) and spec.get("player_created"))
        resolved = resolve_logical_path(root, logical_path)
        exists = bool(resolved and resolved.is_dir())
        if not exists and not player_created:
            missing_paths.append(logical_path)
            _add_error(errors, f"Walkthrough room path missing on disk: {logical_path}")
        has_scroll = bool(isinstance(spec, dict) and spec.get("scroll"))
        scroll_ok = True
        resolved_scroll = None
        if has_scroll:
            scroll_candidate = (resolved / "scroll") if resolved else None
            scroll_ok = bool(scroll_candidate and scroll_candidate.is_file())
            resolved_scroll = (
                str(scroll_candidate.relative_to(root))
                if scroll_candidate and scroll_candidate.exists()
                else None
            )
            if not scroll_ok:
                missing_scrolls.append(f"{logical_path}/scroll")
                _add_error(errors, f"Walkthrough room missing scroll file: {logical_path}/scroll")

        resolved_rooms.append(
            {
                "logical": logical_path,
                "resolved": str(resolved.relative_to(root)) if resolved and resolved.exists() else None,
                "exists": exists,
                "requires_scroll": has_scroll,
                "scroll_ok": scroll_ok,
                "resolved_scroll": resolved_scroll,
            }
        )

    report["rooms"] = {
        "yaml_count": len(yaml_path_set),
        "walkthrough_count": len(wt_paths),
        "missing_in_walkthrough": missing_in_walkthrough,
        "missing_in_rooms_yaml": missing_in_rooms_yaml,
        "missing_paths_on_disk": missing_paths,
        "missing_scrolls_on_disk": missing_scrolls,
        "resolved": resolved_rooms,
    }


def _validate_quests(
    quests_data: dict[str, Any],
    walkthrough: dict[str, Any],
    errors: list[str],
    warnings: list[str],
    report: dict[str, Any],
) -> None:
    yaml_quests = quests_data.get("quests", [])
    wt_quests = walkthrough.get("quests", [])
    if not isinstance(yaml_quests, list):
        _add_error(errors, "quests.yaml: 'quests' must be a list")
        yaml_quests = []
    if not isinstance(wt_quests, list):
        _add_error(errors, "walkthrough.json: 'quests' must be a list")
        wt_quests = []

    yaml_by_id: dict[int, dict[str, Any]] = {}
    for q in yaml_quests:
        if not isinstance(q, dict):
            _add_error(errors, "quests.yaml: each quest entry must be an object")
            continue
        qid = q.get("id")
        if not isinstance(qid, int):
            _add_error(errors, f"quests.yaml: quest id must be int, got {qid!r}")
            continue
        yaml_by_id[qid] = q

    wt_by_id: dict[int, dict[str, Any]] = {}
    for q in wt_quests:
        if not isinstance(q, dict):
            _add_error(errors, "walkthrough.json: each quest entry must be an object")
            continue
        qid = q.get("id")
        if not isinstance(qid, int):
            _add_error(errors, f"walkthrough.json: quest id must be int, got {qid!r}")
            continue
        wt_by_id[qid] = q

    missing_in_walkthrough = sorted(set(yaml_by_id) - set(wt_by_id))
    missing_in_yaml = sorted(set(wt_by_id) - set(yaml_by_id))
    for qid in missing_in_walkthrough:
        _add_warning(warnings, f"Quest id {qid} exists in quests.yaml but not walkthrough.json")
    for qid in missing_in_yaml:
        _add_warning(warnings, f"Quest id {qid} exists in walkthrough.json but not quests.yaml")

    field_mismatches: list[dict[str, Any]] = []
    for qid in sorted(set(yaml_by_id) & set(wt_by_id)):
        yq = yaml_by_id[qid]
        wq = wt_by_id[qid]
        ycmd = str((yq.get("completion") or {}).get("command") or "").strip()
        wcmd = str(wq.get("command") or "").strip()
        if ycmd and wcmd and ycmd != wcmd:
            field_mismatches.append({"id": qid, "field": "command", "yaml": ycmd, "walkthrough": wcmd})
            _add_warning(warnings, f"Quest {qid} command mismatch (yaml={ycmd}, walkthrough={wcmd})")

        yxp = yq.get("xp")
        wxp = wq.get("xp")
        if isinstance(yxp, int) and isinstance(wxp, int) and yxp != wxp:
            field_mismatches.append({"id": qid, "field": "xp", "yaml": yxp, "walkthrough": wxp})
            _add_warning(warnings, f"Quest {qid} XP mismatch (yaml={yxp}, walkthrough={wxp})")

    report["quests"] = {
        "yaml_count": len(yaml_by_id),
        "walkthrough_count": len(wt_by_id),
        "missing_in_walkthrough": missing_in_walkthrough,
        "missing_in_yaml": missing_in_yaml,
        "mismatches": field_mismatches,
    }


def _validate_encounters(
    root: Path,
    encounters_data: dict[str, Any],
    walkthrough: dict[str, Any],
    errors: list[str],
    warnings: list[str],
    report: dict[str, Any],
) -> None:
    entries = encounters_data.get("encounters", {})
    wt_rooms = walkthrough.get("rooms", {})
    if not isinstance(entries, dict):
        _add_error(errors, "encounters.yaml: 'encounters' must be an object")
        entries = {}
    if not isinstance(wt_rooms, dict):
        wt_rooms = {}

    room_by_slug: dict[str, str] = {}
    rooms_yaml = _load_yaml(root / "src/help/data/rooms.yaml").get("rooms", {})
    if isinstance(rooms_yaml, dict):
        for slug, spec in rooms_yaml.items():
            if isinstance(spec, dict):
                room_by_slug[slug] = str(spec.get("path", ""))

    expected_paths: set[str] = set()
    for room_path, spec in wt_rooms.items():
        if not isinstance(spec, dict):
            continue
        for script in spec.get("scripts", []):
            expected_paths.add(_normalize_logical(f"{room_path}/{script}"))

    missing_on_disk: list[str] = []
    missing_in_walkthrough: list[str] = []
    checked: list[dict[str, Any]] = []
    for key, spec in entries.items():
        if not isinstance(spec, dict):
            _add_error(errors, f"encounters.yaml: encounter '{key}' must be an object")
            continue
        room_slug = str(spec.get("room", ""))
        script = str(spec.get("script", ""))
        if not room_slug or not script:
            _add_error(errors, f"encounters.yaml: encounter '{key}' missing room/script")
            continue
        room_path = room_by_slug.get(room_slug, "")
        logical = f"{room_path}/{script}" if room_path else script
        resolved = resolve_logical_path(root, logical) if room_path else None
        on_disk = bool(resolved and resolved.is_file())
        if not on_disk:
            missing_on_disk.append(logical)
            _add_warning(warnings, f"Encounter script missing on disk: {logical}")
        logical_norm = _normalize_logical(logical)
        if room_path and logical_norm not in expected_paths:
            missing_in_walkthrough.append(logical)
            _add_warning(warnings, f"Encounter path not present in walkthrough.json: {logical_norm}")
        checked.append(
            {
                "key": key,
                "logical": logical,
                "resolved": str(resolved.relative_to(root)) if resolved and resolved.exists() else None,
                "on_disk": on_disk,
                "in_walkthrough": logical_norm in expected_paths if room_path else False,
            }
        )

    report["encounters"] = {
        "yaml_count": len(entries),
        "walkthrough_script_count": len(expected_paths),
        "missing_on_disk": sorted(set(missing_on_disk)),
        "missing_in_walkthrough": sorted(set(missing_in_walkthrough)),
        "checked": checked,
    }


# Encounter scripts the shebang/boilerplate contract applies to (the classic
# interactive executables; data files like `roster`/`gravestones` are exempt).
_SCRIPT_NAMES = ("treasure", "potion", "spell", "statue", "monster", "ghost", "goblet")

# Hidden areas that treasures unlock via `mv .name name` — one of the two forms
# must exist on disk or the unlock instruction printed to the player is a lie.
_UNLOCK_DIRS = (".chapel", ".vault", ".rift", ".scrap")

# Main-path rooms every new player walks through; their scrolls carry the core
# lessons and should stay substantial.
_MAIN_PATH_ROOMS = (
    "entrance",
    "entrance/cellar",
    "entrance/cellar/armoury",
    "entrance/cellar/armoury/chamber",
)


def _validate_game_scripts(
    root: Path,
    errors: list[str],
    warnings: list[str],
    report: dict[str, Any],
) -> None:
    """Filesystem conventions for game executables and unlock wiring.

    Folded in from the retired game-tests workflow so the checks run locally
    (`make validate-contracts`) and in CI from a single source of truth.
    """
    entrance = root / "entrance"
    bad_shebangs: list[str] = []
    missing_boilerplate: list[str] = []
    script_count = 0

    for name in _SCRIPT_NAMES:
        for script in sorted(entrance.rglob(name)):
            if not script.is_file():
                continue
            script_count += 1
            rel = script.relative_to(root).as_posix()
            text = script.read_text(encoding="utf-8", errors="replace")
            first_line = text.splitlines()[0] if text else ""
            if first_line not in ("#!/usr/bin/env bash", "#!/bin/bash"):
                bad_shebangs.append(rel)
                _add_error(errors, f"Game script missing bash shebang: {rel} (got: {first_line!r})")
            if "wandered out of bounds" not in text:
                missing_boilerplate.append(rel)
                _add_warning(warnings, f"Game script missing standard boilerplate comment: {rel}")

    missing_unlocks: list[str] = []
    for hidden in _UNLOCK_DIRS:
        visible = hidden.lstrip(".")
        if not (entrance / hidden).is_dir() and not (entrance / visible).is_dir():
            missing_unlocks.append(hidden)
            _add_error(errors, f"Unlock target missing on disk: entrance/{hidden} (or entrance/{visible})")

    thin_scrolls: list[str] = []
    for room in _MAIN_PATH_ROOMS:
        scroll = root / room / "scroll"
        if scroll.is_file():
            lines = len(scroll.read_text(encoding="utf-8", errors="replace").splitlines())
            if lines < 30:
                thin_scrolls.append(f"{room}/scroll ({lines} lines)")
                _add_warning(warnings, f"Main-path scroll unusually short: {room}/scroll has {lines} lines (expected 30+)")
        else:
            _add_error(errors, f"Main-path scroll missing: {room}/scroll")

    report["game_scripts"] = {
        "script_count": script_count,
        "bad_shebangs": bad_shebangs,
        "missing_boilerplate": missing_boilerplate,
        "missing_unlock_targets": missing_unlocks,
        "thin_main_path_scrolls": thin_scrolls,
    }


def validate(root: Path) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    report: dict[str, Any] = {}
    _validate_required_files(root, errors, report)

    files = report.get("required_files", {})
    required_ok = all(v.get("exists") for v in files.values()) if files else False
    if not required_ok:
        return {
            "ok": False,
            "error_count": len(errors),
            "errors": errors,
            **report,
        }

    rooms_data = _load_yaml(root / "src/help/data/rooms.yaml")
    quests_data = _load_yaml(root / "src/help/data/quests.yaml")
    encounters_data = _load_yaml(root / "src/help/data/encounters.yaml")
    walkthrough = json.loads((root / "test/datasets/walkthrough.json").read_text(encoding="utf-8"))

    _validate_rooms_and_walkthrough(root, rooms_data, walkthrough, errors, warnings, report)
    _validate_quests(quests_data, walkthrough, errors, warnings, report)
    _validate_encounters(root, encounters_data, walkthrough, errors, warnings, report)
    _validate_game_scripts(root, errors, warnings, report)

    return {
        "ok": not errors,
        "error_count": len(errors),
        "warning_count": len(warnings),
        "errors": errors,
        "warnings": warnings,
        **report,
    }


def _emit_text(result: dict[str, Any]) -> None:
    rooms = result.get("rooms", {})
    quests = result.get("quests", {})
    enc = result.get("encounters", {})

    print("=== Contract Validation Summary ===")
    print(f"Rooms: yaml={rooms.get('yaml_count', 0)} walkthrough={rooms.get('walkthrough_count', 0)}")
    print(f"Quests: yaml={quests.get('yaml_count', 0)} walkthrough={quests.get('walkthrough_count', 0)}")
    print(
        "Encounters: "
        f"yaml={enc.get('yaml_count', 0)} walkthrough_scripts={enc.get('walkthrough_script_count', 0)}"
    )
    print(f"Warnings: {result.get('warning_count', 0)}")
    print("")

    if result.get("ok"):
        for warning in result.get("warnings", []):
            print(f"WARNING: {warning}")
        print("content contracts validation passed.")
        return

    print(f"content contracts validation FAILED with {result.get('error_count', 0)} error(s):")
    for err in result.get("errors", []):
        print(f"- {err}")
    if result.get("warnings"):
        print("\nWarnings:")
        for warning in result.get("warnings", []):
            print(f"- {warning}")


def main() -> int:
    args = parse_args()
    result = validate(Path.cwd())
    if args.json_mode:
        print(json.dumps(result, indent=2))
    else:
        _emit_text(result)
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
