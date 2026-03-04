"""Unit tests for GameState.

Tests the game state dataclass: save/load, inventory management,
HP tracking, environment variables, and session history.
"""

import json
import pytest
from pathlib import Path

pytestmark = pytest.mark.unit


class TestGameStateInit:
    """Tests for default GameState initialization."""

    def test_default_values(self):
        from ti.game_state import GameState
        state = GameState()
        assert state.current_quest_id == 0
        assert state.completed_quest_ids == []
        assert state.learned_commands == []
        assert state.current_location == "entrance"
        assert state.inventory == ""
        assert state.hp == 100
        assert state.env_vars == {}
        assert state.experience_points == 0

    def test_player_name_default(self):
        from ti.game_state import GameState
        state = GameState()
        assert state.player_name is None


class TestEnvironmentVariables:
    """Tests for set_env and game_env."""

    def test_set_inventory(self):
        from ti.game_state import GameState
        state = GameState()
        state.set_env("I", "amulet,sword,")
        assert state.inventory == "amulet,sword,"

    def test_set_hp(self):
        from ti.game_state import GameState
        state = GameState()
        state.set_env("HP", "15")
        assert state.hp == 15

    def test_set_hp_invalid(self):
        from ti.game_state import GameState
        state = GameState()
        state.set_env("HP", "not_a_number")
        assert state.hp == 100  # Should not crash, keep default

    def test_set_custom_var(self):
        from ti.game_state import GameState
        state = GameState()
        state.set_env("CUSTOM", "value")
        assert state.env_vars["CUSTOM"] == "value"

    def test_game_env_includes_inventory(self):
        from ti.game_state import GameState
        state = GameState()
        state.inventory = "amulet,"
        state.set_env("HP", "15")
        env = state.game_env
        assert env["I"] == "amulet,"
        assert env["HP"] == "15"

    def test_game_env_empty_inventory_excluded(self):
        from ti.game_state import GameState
        state = GameState()
        state.hp = 0  # set to 0 explicitly to test exclusion
        state.inventory = ""  # ensure empty
        env = state.game_env
        assert "I" not in env
        assert "HP" not in env  # hp=0, so excluded


class TestSaveLoad:
    """Tests for save/load persistence."""

    def test_save_creates_file(self, tmp_path):
        from ti.game_state import GameState
        save_path = tmp_path / ".ti_save.json"
        state = GameState(player_name="TestHero", inventory="amulet,", hp=15)
        state.save(save_path)
        assert save_path.exists()

    def test_load_restores_state(self, tmp_path):
        from ti.game_state import GameState
        save_path = tmp_path / ".ti_save.json"
        original = GameState(
            player_name="TestHero",
            inventory="amulet,sword,",
            hp=15,
            current_location="entrance/cellar",
            current_quest_id=3,
            completed_quest_ids=[0, 1, 2],
            learned_commands=["pwd", "ls", "cd"],
            experience_points=200,
        )
        original.save(save_path)
        loaded = GameState.load(save_path)
        assert loaded.player_name == "TestHero"
        assert loaded.inventory == "amulet,sword,"
        assert loaded.hp == 15
        assert loaded.current_location == "entrance/cellar"
        assert loaded.current_quest_id == 3
        assert loaded.completed_quest_ids == [0, 1, 2]
        assert loaded.experience_points == 200

    def test_load_missing_returns_default(self, tmp_path):
        from ti.game_state import GameState
        save_path = tmp_path / "nonexistent.json"
        state = GameState.load(save_path)
        assert state.current_quest_id == 0
        assert state.player_name is None

    def test_load_corrupt_returns_default(self, tmp_path):
        from ti.game_state import GameState
        save_path = tmp_path / "corrupt.json"
        save_path.write_text("not valid json {{{{")
        state = GameState.load(save_path)
        assert state.current_quest_id == 0

    def test_save_load_roundtrip_with_env_vars(self, tmp_path):
        from ti.game_state import GameState
        save_path = tmp_path / ".ti_save.json"
        state = GameState()
        state.set_env("CUSTOM_VAR", "custom_value")
        state.set_env("I", "coin,")
        state.save(save_path)
        loaded = GameState.load(save_path)
        assert loaded.env_vars["CUSTOM_VAR"] == "custom_value"
        assert loaded.inventory == "coin,"


class TestSessionHistory:
    """Tests for logging to session history."""

    def test_log_appends(self):
        from ti.game_state import GameState
        state = GameState()
        state.log("command", "ls")
        state.log("output", "scroll  cellar/")
        assert len(state.session_history) == 2
        assert state.session_history[0]["kind"] == "command"
        assert state.session_history[0]["text"] == "ls"

    def test_log_trims_at_1000(self):
        from ti.game_state import GameState
        state = GameState()
        for i in range(1100):
            state.log("command", f"cmd_{i}")
        assert len(state.session_history) == 1000
        # Most recent should be preserved
        assert state.session_history[-1]["text"] == "cmd_1099"
