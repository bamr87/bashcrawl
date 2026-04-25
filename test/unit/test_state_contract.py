"""Contract tests for unified Bash/Python save-state schema."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from fixtures.skips import requires_bash

pytestmark = pytest.mark.unit

SCHEMA_PATH = Path(__file__).resolve().parents[2] / "docs" / "schemas" / "save-state.v1.json"


def _validate_min_schema(data: dict, schema: dict) -> None:
    required = schema.get("required", [])
    properties = schema.get("properties", {})
    for key in required:
        assert key in data, f"missing required key: {key}"
        expected = properties[key]["type"]
        if expected == "integer":
            assert isinstance(data[key], int), f"{key} must be integer, got {type(data[key])}"
        elif expected == "string":
            assert isinstance(data[key], str), f"{key} must be string, got {type(data[key])}"


def test_python_state_matches_schema(tmp_path):
    from ti.game_state import GameState

    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    save_path = tmp_path / ".bashcrawl_save.json"

    gs = GameState(
        current_quest_id=2,
        completed_quest_ids=[0, 1],
        learned_commands=["pwd", "ls"],
        current_location="entrance/cellar",
        inventory="amulet,sword,",
        hp=15,
        experience_points=120,
        game_level="novice",
        game_started="true",
        mode="classic",
        player_name="Agent",
    )
    gs.save(save_path=save_path)
    data = json.loads(save_path.read_text(encoding="utf-8"))
    _validate_min_schema(data, schema)


@requires_bash
def test_shell_state_matches_schema(sandbox):
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    script = f"""
set -euo pipefail
export BASHCRAWL_ROOT="{sandbox}"
source "{sandbox}/lib/state.sh"
state_init
state_set current_location "entrance/cellar"
state_set inventory "amulet,sword,"
state_set hp "15"
state_set current_quest_id "2"
state_save
"""
    subprocess.run(["bash", "-c", script], check=True, capture_output=True, text=True, timeout=15)
    data = json.loads((sandbox / ".bashcrawl_save.json").read_text(encoding="utf-8"))
    _validate_min_schema(data, schema)


@requires_bash
def test_shell_python_state_roundtrip_compatible(sandbox):
    from ti.game_state import GameState

    save_path = sandbox / ".bashcrawl_save.json"
    gs = GameState(
        current_quest_id=3,
        completed_quest_ids=[0, 1, 2],
        learned_commands=["pwd", "ls", "cd"],
        current_location="entrance/cellar",
        inventory="amulet,",
        hp=14,
        experience_points=180,
        mode="classic",
        player_name="Agent",
    )
    gs.save(save_path=save_path)

    script = f"""
set -euo pipefail
export BASHCRAWL_ROOT="{sandbox}"
source "{sandbox}/lib/state.sh"
state_load
echo "${{STATE_current_quest_id}}|${{STATE_current_location}}|${{STATE_hp}}|${{STATE_inventory}}"
"""
    result = subprocess.run(
        ["bash", "-c", script],
        check=True,
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert "3|entrance/cellar|14|amulet," in result.stdout.strip()
