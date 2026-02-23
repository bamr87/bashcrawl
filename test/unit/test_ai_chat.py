"""Unit tests for the Merlin AI chat system.

Tests AIChatService, GameContextBuilder, and GameContext
without requiring an Anthropic API key or a real filesystem.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import List
from unittest.mock import MagicMock, patch

import pytest

pytestmark = pytest.mark.unit

# Ensure ti package is importable
_TI_DIR = Path(__file__).resolve().parents[2] / "src" / "terminal-illness"
if str(_TI_DIR) not in sys.path:
    sys.path.insert(0, str(_TI_DIR))


# ---------------------------------------------------------------------------
# GameContextBuilder tests
# ---------------------------------------------------------------------------

class TestGameContextBuilder:
    """Tests for GameContextBuilder.build() and detect_stuck()."""

    def _make_state(self, location="/entrance", inventory="", hp=100, name="TestPlayer"):
        from ti.game_state import GameState
        state = GameState()
        state.current_location = location
        state.inventory = inventory
        state.hp = hp
        state.player_name = name
        return state

    def _make_fs(self, ls_return=None):
        fs = MagicMock()
        fs.ls.return_value = ls_return or ["scroll", "cellar/"]
        fs._game_root = "/fake/root"
        return fs

    def test_build_returns_game_context(self):
        from ti.chat_context import GameContextBuilder, GameContext
        builder = GameContextBuilder()
        state = self._make_state()
        fs = self._make_fs()
        ctx = builder.build(state, fs, ["ls", "cat scroll"])
        assert isinstance(ctx, GameContext)

    def test_context_captures_location(self):
        from ti.chat_context import GameContextBuilder
        builder = GameContextBuilder()
        state = self._make_state(location="/entrance/cellar")
        fs = self._make_fs()
        ctx = builder.build(state, fs, [])
        assert ctx.room == "/entrance/cellar"

    def test_context_captures_inventory(self):
        from ti.chat_context import GameContextBuilder
        builder = GameContextBuilder()
        state = self._make_state(inventory="amulet,sword")
        fs = self._make_fs()
        ctx = builder.build(state, fs, [])
        assert ctx.inventory == "amulet,sword"

    def test_context_captures_hp(self):
        from ti.chat_context import GameContextBuilder
        builder = GameContextBuilder()
        state = self._make_state(hp=42)
        fs = self._make_fs()
        ctx = builder.build(state, fs, [])
        assert ctx.hp == 42

    def test_context_captures_recent_commands(self):
        from ti.chat_context import GameContextBuilder
        builder = GameContextBuilder()
        state = self._make_state()
        fs = self._make_fs()
        cmds = ["ls", "cat scroll", "cd cellar"]
        ctx = builder.build(state, fs, cmds)
        assert ctx.recent_commands == cmds

    def test_context_as_dict_format_keys(self):
        from ti.chat_context import GameContextBuilder
        builder = GameContextBuilder()
        state = self._make_state()
        fs = self._make_fs()
        ctx = builder.build(state, fs, ["ls"])
        d = ctx.as_dict()
        for key in ("room", "inventory", "hp", "quest", "recent_commands", "room_contents", "scroll_excerpt"):
            assert key in d, f"Missing key: {key}"

    def test_as_dict_empty_inventory_placeholder(self):
        from ti.chat_context import GameContextBuilder
        builder = GameContextBuilder()
        state = self._make_state(inventory="")
        fs = self._make_fs()
        ctx = builder.build(state, fs, [])
        assert ctx.as_dict()["inventory"] == "(empty)"

    def test_as_dict_no_commands_placeholder(self):
        from ti.chat_context import GameContextBuilder
        builder = GameContextBuilder()
        state = self._make_state()
        fs = self._make_fs()
        ctx = builder.build(state, fs, [])
        assert ctx.as_dict()["recent_commands"] == "(none)"

    # ------------------------------------------------------------------
    # detect_stuck
    # ------------------------------------------------------------------

    def test_detect_stuck_identical_commands(self):
        from ti.chat_context import GameContextBuilder
        cmds = ["ls", "ls", "ls"]
        assert GameContextBuilder.detect_stuck(cmds, threshold=3) is True

    def test_detect_stuck_two_distinct_in_six(self):
        from ti.chat_context import GameContextBuilder
        cmds = ["ls", "cd ..", "ls", "cd ..", "ls", "cd .."]
        assert GameContextBuilder.detect_stuck(cmds, threshold=3) is True

    def test_detect_stuck_not_triggered_varied(self):
        from ti.chat_context import GameContextBuilder
        cmds = ["ls", "cat scroll", "cd cellar", "ls", "cat scroll"]
        assert GameContextBuilder.detect_stuck(cmds, threshold=3) is False

    def test_detect_stuck_short_history(self):
        from ti.chat_context import GameContextBuilder
        cmds = ["ls", "ls"]  # fewer than threshold
        assert GameContextBuilder.detect_stuck(cmds, threshold=3) is False

    def test_detect_stuck_empty_history(self):
        from ti.chat_context import GameContextBuilder
        assert GameContextBuilder.detect_stuck([]) is False

    def test_detect_stuck_different_threshold(self):
        from ti.chat_context import GameContextBuilder
        cmds = ["pwd", "pwd", "pwd", "pwd", "pwd"]
        assert GameContextBuilder.detect_stuck(cmds, threshold=5) is True


# ---------------------------------------------------------------------------
# AIChatService tests
# ---------------------------------------------------------------------------

class TestAIChatService:
    """Tests for AIChatService without hitting the real API."""

    def _make_context(self, room="/entrance", inventory="", hp=100):
        from ti.chat_context import GameContext
        return GameContext(
            room=room,
            inventory=inventory,
            hp=hp,
            quest="Find the scroll: cat scroll",
            recent_commands=["ls"],
            room_contents=["scroll", "cellar/"],
            scroll_excerpt="Welcome, brave adventurer…",
            player_name="Tester",
        )

    def test_is_available_false_without_key(self):
        from ti.ai_chat import AIChatService
        with patch.dict(os.environ, {}, clear=True):
            os.environ.pop("ANTHROPIC_API_KEY", None)
            svc = AIChatService()
            svc._api_available = None  # reset cache
            assert svc.is_available() is False

    def test_is_available_true_with_key_and_library(self):
        from ti.ai_chat import AIChatService
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "sk-test-123"}):
            svc = AIChatService()
            svc._api_available = None
            # anthropic should be importable in test env
            try:
                import anthropic  # noqa: F401
                assert svc.is_available() is True
            except ImportError:
                pytest.skip("anthropic not installed")

    def test_fallback_response_contains_room_name(self):
        from ti.ai_chat import AIChatService
        svc = AIChatService()
        ctx = self._make_context(room="/entrance/cellar")
        response = svc._fallback_response("how do I open a door?", ctx)
        assert "cellar" in response

    def test_fallback_response_for_how_question(self):
        from ti.ai_chat import AIChatService
        svc = AIChatService()
        ctx = self._make_context()
        response = svc._fallback_response("how do I list files?", ctx)
        assert "ls" in response.lower() or "scroll" in response.lower()

    def test_nudge_returns_string_for_known_events(self):
        from ti.ai_chat import AIChatService
        svc = AIChatService()
        for event in ("new_room", "low_health", "stuck", "quest_complete", "combat"):
            nudge = svc.nudge(event)
            assert isinstance(nudge, str)
            assert len(nudge) > 0, f"Empty nudge for event: {event}"

    def test_nudge_returns_empty_for_unknown_event(self):
        from ti.ai_chat import AIChatService
        svc = AIChatService()
        assert svc.nudge("nonexistent_event") == ""

    def test_clear_history(self):
        from ti.ai_chat import AIChatService
        svc = AIChatService()
        svc._history = [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}]
        svc.clear_history()
        assert svc._history == []

    def test_trim_history_caps_at_max_turns(self):
        from ti.ai_chat import AIChatService
        svc = AIChatService()
        # Fill history beyond limit (20 turns = 40 messages)
        for i in range(50):
            svc._history.append({"role": "user", "content": f"q{i}"})
            svc._history.append({"role": "assistant", "content": f"a{i}"})
        svc._trim_history()
        assert len(svc._history) <= 40

    def test_build_system_prompt_includes_context_fields(self):
        from ti.ai_chat import AIChatService
        svc = AIChatService()
        ctx = self._make_context(room="/entrance", inventory="amulet")
        prompt = svc._build_system_prompt(ctx)
        assert "/entrance" in prompt
        assert "amulet" in prompt

    @patch("ti.ai_chat.AIChatService.is_available", return_value=False)
    def test_ask_sync_falls_back_when_no_key(self, _):
        from ti.ai_chat import AIChatService
        svc = AIChatService()
        ctx = self._make_context()
        response = svc.ask_sync("help me", ctx)
        assert isinstance(response, str)
        assert len(response) > 0

    def test_ask_sync_calls_claude_when_available(self):
        from ti.ai_chat import AIChatService
        try:
            import anthropic  # noqa: F401
        except ImportError:
            pytest.skip("anthropic not installed")

        svc = AIChatService()
        ctx = self._make_context()

        # Mock the Anthropic client
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="Ah, brave adventurer! Try ls.")]
        mock_client.messages.create.return_value = mock_response
        svc._client = mock_client
        svc._api_available = True

        result = svc.ask_sync("how do I start?", ctx)
        assert "adventurer" in result or "ls" in result
        mock_client.messages.create.assert_called_once()


# ---------------------------------------------------------------------------
# Integration: system prompt template
# ---------------------------------------------------------------------------

class TestMerlinPrompt:
    """Verify the Merlin system prompt file exists and is well-formed."""

    def test_prompt_file_exists(self):
        prompt_path = _TI_DIR / "ti" / "data" / "merlin_prompt.txt"
        assert prompt_path.exists(), f"Merlin prompt file not found: {prompt_path}"

    def test_prompt_contains_required_placeholders(self):
        prompt_path = _TI_DIR / "ti" / "data" / "merlin_prompt.txt"
        text = prompt_path.read_text()
        for placeholder in ("{room}", "{inventory}", "{hp}", "{quest}", "{recent_commands}",
                            "{room_contents}", "{scroll_excerpt}"):
            assert placeholder in text, f"Missing placeholder: {placeholder}"

    def test_prompt_mentions_merlin(self):
        prompt_path = _TI_DIR / "ti" / "data" / "merlin_prompt.txt"
        text = prompt_path.read_text()
        assert "Merlin" in text
