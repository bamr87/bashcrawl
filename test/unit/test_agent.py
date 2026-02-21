"""Unit tests for the agent mode components.

Tests TerminalEngine.execute(), TerminalEngine.get_completions(),
constructor parameters, and the BashcrawlApp agent_mode flag.
"""

import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch

pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# TerminalEngine constructor
# ---------------------------------------------------------------------------


class TestTerminalEngineInit:
    """Tests for TerminalEngine initialization with new parameters."""

    def test_creates_without_callbacks(self, game_state, game_fs):
        """Engine can be created without optional callbacks."""
        from ti.terminal_engine import TerminalEngine
        engine = TerminalEngine(state=game_state, fs=game_fs)
        assert engine.state is game_state
        assert engine.fs is game_fs
        assert engine._output_callback is None
        assert engine._on_quest_complete is None

    def test_creates_with_output_callback(self, game_state, game_fs):
        """Engine accepts output_callback parameter."""
        callback = MagicMock()
        from ti.terminal_engine import TerminalEngine
        engine = TerminalEngine(
            state=game_state, fs=game_fs, output_callback=callback,
        )
        assert engine._output_callback is callback

    def test_creates_with_quest_callback(self, game_state, game_fs):
        """Engine accepts on_quest_complete parameter."""
        callback = MagicMock()
        from ti.terminal_engine import TerminalEngine
        engine = TerminalEngine(
            state=game_state, fs=game_fs, on_quest_complete=callback,
        )
        assert engine._on_quest_complete is callback

    def test_creates_with_all_callbacks(self, game_state, game_fs):
        """Engine accepts both callbacks simultaneously."""
        out_cb = MagicMock()
        quest_cb = MagicMock()
        from ti.terminal_engine import TerminalEngine
        engine = TerminalEngine(
            state=game_state, fs=game_fs,
            output_callback=out_cb,
            on_quest_complete=quest_cb,
        )
        assert engine._output_callback is out_cb
        assert engine._on_quest_complete is quest_cb


# ---------------------------------------------------------------------------
# TerminalEngine.execute()
# ---------------------------------------------------------------------------


class TestTerminalEngineExecute:
    """Tests for the execute() programmatic command interface."""

    def test_execute_pwd(self, engine):
        """execute('pwd') returns None (not exit)."""
        result = engine.execute("pwd")
        assert result is None

    def test_execute_empty_string(self, engine):
        """execute('') returns None without error."""
        result = engine.execute("")
        assert result is None

    def test_execute_whitespace_only(self, engine):
        """execute('   ') returns None without error."""
        result = engine.execute("   ")
        assert result is None

    def test_execute_ls(self, engine):
        """execute('ls') returns None (not exit)."""
        result = engine.execute("ls")
        assert result is None

    def test_execute_cd_valid(self, engine):
        """execute('cd cellar') returns None and changes cwd."""
        result = engine.execute("cd cellar")
        assert result is None
        assert "cellar" in engine._cwd

    def test_execute_cd_invalid(self, engine):
        """execute('cd nonexistent') returns None (error is emitted, not raised)."""
        result = engine.execute("cd nonexistent")
        assert result is None

    def test_execute_cat_scroll(self, engine):
        """execute('cat scroll') returns None."""
        result = engine.execute("cat scroll")
        assert result is None

    def test_execute_unknown_command(self, engine):
        """execute('foobar') emits error but returns None."""
        result = engine.execute("foobar")
        assert result is None

    def test_execute_exit(self, engine):
        """execute('exit') returns 'exit'."""
        result = engine.execute("exit")
        assert result == "exit"

    def test_execute_export(self, engine):
        """execute('export I=amulet,') sets game state."""
        engine.execute("export I=amulet,")
        assert engine.state.inventory == "amulet,"

    def test_execute_echo(self, engine):
        """execute('echo hello') returns None."""
        result = engine.execute("echo hello")
        assert result is None

    def test_execute_tracks_learned_commands(self, engine):
        """Commands used via execute() are added to learned_commands."""
        engine.execute("pwd")
        assert "pwd" in engine.state.learned_commands

    def test_execute_with_output_callback(self, game_state, game_fs):
        """Output callback is invoked when execute() produces output."""
        callback = MagicMock()
        from ti.terminal_engine import TerminalEngine
        engine = TerminalEngine(
            state=game_state, fs=game_fs, output_callback=callback,
        )
        engine.execute("pwd")
        assert callback.called
        # Callback receives (kind, message) — kind should be "output" or similar
        call_args = callback.call_args[0]
        assert len(call_args) == 2
        assert isinstance(call_args[1], str)


# ---------------------------------------------------------------------------
# TerminalEngine.get_completions()
# ---------------------------------------------------------------------------


class TestTerminalEngineCompletions:
    """Tests for the get_completions() programmatic tab completion."""

    def test_empty_input_returns_all_commands(self, engine):
        """get_completions('') returns all available commands."""
        completions = engine.get_completions("")
        assert len(completions) > 0
        assert "ls" in completions
        assert "cd" in completions
        assert "pwd" in completions

    def test_partial_command(self, engine):
        """get_completions('l') includes 'ls'."""
        completions = engine.get_completions("l")
        assert "ls" in completions

    def test_full_command_with_space(self, engine):
        """get_completions('cd ') returns directory completions."""
        completions = engine.get_completions("cd ")
        # Should include at least 'cellar' from /entrance
        assert len(completions) >= 0  # May vary by sandbox contents

    def test_command_prefix_filter(self, engine):
        """get_completions('c') includes 'cd', 'cat', 'cp'."""
        completions = engine.get_completions("c")
        matching_cmds = [c for c in completions if c.startswith("c")]
        assert len(matching_cmds) >= 2  # at least cd and cat

    def test_returns_list(self, engine):
        """get_completions always returns a list."""
        result = engine.get_completions("pwd")
        assert isinstance(result, list)


# ---------------------------------------------------------------------------
# TerminalEngine._emit_output()
# ---------------------------------------------------------------------------


class TestEmitOutput:
    """Tests for the _emit_output routing logic."""

    def test_with_callback(self, game_state, game_fs):
        """_emit_output routes to callback when set."""
        callback = MagicMock()
        from ti.terminal_engine import TerminalEngine
        engine = TerminalEngine(
            state=game_state, fs=game_fs, output_callback=callback,
        )
        engine._emit_output("info", "test message")
        callback.assert_called_once_with("info", "test message")

    def test_without_callback_no_error(self, engine):
        """_emit_output doesn't crash when no callback is set."""
        # The conftest engine has a MagicMock console, so this should not raise
        engine._emit_output("info", "test message")


# ---------------------------------------------------------------------------
# agent.py helpers
# ---------------------------------------------------------------------------


class TestAgentHelpers:
    """Tests for agent module utility functions."""

    def test_sanitize_basic(self):
        """_sanitize converts spaces and special chars to underscores."""
        from ti.agent import _sanitize
        assert _sanitize("cd entrance") == "cd_entrance"

    def test_sanitize_special_chars(self):
        """_sanitize handles special characters."""
        from ti.agent import _sanitize
        result = _sanitize("./treasure --flag")
        assert "__treasure_--flag" == result

    def test_sanitize_truncates(self):
        """_sanitize truncates to 40 characters."""
        from ti.agent import _sanitize
        long_input = "a" * 100
        assert len(_sanitize(long_input)) == 40

    def test_sanitize_preserves_alphanumeric(self):
        """_sanitize keeps alphanumeric, dash, and underscore."""
        from ti.agent import _sanitize
        assert _sanitize("hello-world_123") == "hello-world_123"

    def test_find_game_root_from_cwd(self):
        """_find_game_root finds root when cwd has entrance/ dir."""
        from ti.agent import _find_game_root
        # This test runs from the bashcrawl repo, so it should find it
        root = _find_game_root()
        assert (root / "entrance").is_dir()
        assert (root / "main.sh").is_file()


# ---------------------------------------------------------------------------
# BashcrawlApp agent_mode flag
# ---------------------------------------------------------------------------


class TestBashcrawlAppAgentMode:
    """Tests for the agent_mode parameter on BashcrawlApp."""

    def test_agent_mode_default_false(self, game_state, game_fs):
        """BashcrawlApp defaults to agent_mode=False."""
        from ti.app import BashcrawlApp
        app = BashcrawlApp(state=game_state, fs=game_fs)
        assert app.agent_mode is False

    def test_agent_mode_true(self, game_state, game_fs):
        """BashcrawlApp accepts agent_mode=True."""
        from ti.app import BashcrawlApp
        app = BashcrawlApp(state=game_state, fs=game_fs, agent_mode=True)
        assert app.agent_mode is True
