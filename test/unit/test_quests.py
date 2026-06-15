"""Unit tests for the quest system.

Validates quest loading, completion logic, and YAML fallback behavior.
"""

import pytest

pytestmark = pytest.mark.unit


class TestQuestList:
    """Tests for quest_list() loading."""

    def test_quest_list_returns_quests(self):
        from ti.quests import quest_list
        quests = quest_list()
        assert len(quests) >= 7, "Should have at least 7 quests"

    def test_quest_ids_sequential(self):
        from ti.quests import quest_list
        quests = quest_list()
        for i, q in enumerate(quests):
            assert q.id == i, f"Quest {i} has id {q.id}"

    def test_quest_has_required_fields(self):
        from ti.quests import quest_list
        quests = quest_list()
        for q in quests:
            assert q.title, f"Quest {q.id} missing title"
            assert q.objective, f"Quest {q.id} missing objective"
            assert q.required_commands, f"Quest {q.id} missing required_commands"
            assert q.reward, f"Quest {q.id} missing reward"

    def test_first_quest_is_pwd(self):
        from ti.quests import quest_list
        quests = quest_list()
        assert "pwd" in quests[0].required_commands

    def test_quest_progression_order(self):
        from ti.quests import quest_list
        quests = quest_list()
        expected = ["pwd", "ls", "cd", "cat", "mkdir", "touch", "grep"]
        for q, expected_cmd in zip(quests, expected):
            assert expected_cmd in q.required_commands, \
                f"Quest {q.id} should require {expected_cmd}"


class TestHardcodedFallback:
    """Tests for _hardcoded_quests() fallback."""

    def test_fallback_returns_10_quests(self):
        from ti.quests import _hardcoded_quests
        quests = _hardcoded_quests()
        assert len(quests) == 10

    def test_fallback_quests_have_xp(self):
        from ti.quests import _hardcoded_quests
        quests = _hardcoded_quests()
        for q in quests:
            assert q.xp > 0, f"Quest {q.id} should have positive XP"


class TestQuestCompletion:
    """Tests for check_quest_completion()."""

    def test_pwd_quest_completed(self):
        from ti.quests import check_quest_completion
        from ti.game_state import GameState
        state = GameState()
        state.learned_commands = ["pwd"]
        state.current_quest_id = 0
        assert check_quest_completion(state, "/entrance")

    def test_ls_quest_completed(self):
        from ti.quests import check_quest_completion
        from ti.game_state import GameState
        state = GameState()
        state.learned_commands = ["pwd", "ls"]
        state.current_quest_id = 1
        assert check_quest_completion(state, "/entrance")

    def test_cd_quest_requires_location(self):
        from ti.quests import check_quest_completion
        from ti.game_state import GameState
        state = GameState()
        state.learned_commands = ["pwd", "ls", "cd"]
        state.current_quest_id = 2
        # cd quest requires being in cellar
        result = check_quest_completion(state, "/entrance/cellar")
        assert result, "cd quest should complete when in cellar"

    def test_incomplete_quest(self):
        from ti.quests import check_quest_completion
        from ti.game_state import GameState
        state = GameState()
        state.current_quest_id = 0
        # No commands learned yet
        assert not check_quest_completion(state, "/entrance")

    def test_all_quests_done(self):
        from ti.quests import check_quest_completion
        from ti.game_state import GameState
        state = GameState()
        state.current_quest_id = 99  # Beyond all quests
        assert not check_quest_completion(state, "/entrance")
