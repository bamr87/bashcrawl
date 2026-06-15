"""Integration tests for the NonInteractiveEngine.

Tests command dispatch, game state propagation, and script execution
through the programmatic engine interface used by AI agents.
"""

import pytest
from pathlib import Path

pytestmark = pytest.mark.integration


class TestNonInteractiveEngineInit:
    """Tests for engine initialization."""

    def test_engine_creates_with_sandbox(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)
        assert engine.cwd == "entrance"

    def test_engine_with_initial_env(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(
            sandbox,
            initial_env={"I": "amulet,", "HP": "15"},
        )
        assert engine.state.inventory == "amulet,"
        assert engine.state.hp == 15


class TestBasicCommands:
    """Tests for basic command execution."""

    def test_pwd(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)
        result = engine.execute_command("pwd")
        assert result.kind == "output"
        assert "entrance" in result.output

    def test_ls(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)
        result = engine.execute_command("ls")
        assert result.kind == "output"
        assert "scroll" in result.output or "cellar" in result.output

    def test_cd_cellar(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)
        result = engine.execute_command("cd cellar")
        assert result.kind == "success"
        assert "cellar" in engine.cwd

    def test_cd_invalid(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)
        result = engine.execute_command("cd nonexistent")
        assert result.kind == "error"

    def test_cat_scroll(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)
        result = engine.execute_command("cat scroll")
        assert result.kind == "output"
        assert len(result.output) > 10

    def test_mkdir(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)
        result = engine.execute_command("mkdir test_room")
        assert result.kind == "success"
        assert (sandbox / "entrance" / "test_room").is_dir()

    def test_touch(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)
        result = engine.execute_command("touch test_file")
        assert result.kind == "success"
        assert (sandbox / "entrance" / "test_file").is_file()

    def test_echo(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)
        result = engine.execute_command("echo hello world")
        assert result.output == "hello world"

    def test_echo_variable_expansion(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)
        engine.state.inventory = "amulet,"
        result = engine.execute_command("echo $I")
        assert result.output == "amulet,"

    def test_unknown_command(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)
        result = engine.execute_command("foobar")
        assert result.kind == "error"
        assert "Unknown command" in result.output

    def test_empty_command(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)
        result = engine.execute_command("")
        assert result.kind == "info"


class TestExportCommand:
    """Tests for the export command and state propagation."""

    def test_export_inventory(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)
        # The engine stores literal $I, it doesn't expand shell variables
        result = engine.execute_command("export I=amulet,")
        assert result.kind == "success"
        assert engine.state.inventory == "amulet,"

    def test_export_hp(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)
        result = engine.execute_command("export HP=15")
        assert result.kind == "success"
        assert engine.state.hp == 15

    def test_export_custom_var(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)
        engine.execute_command("export CUSTOM=value")
        assert engine.state.env_vars["CUSTOM"] == "value"


class TestScriptExecution:
    """Tests for running game scripts via ./script."""

    def test_run_treasure(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)
        engine.execute_command("cd cellar")
        result = engine.execute_command("./treasure")
        assert result.kind in ("output", "error")
        assert len(result.output) > 0

    def test_nonexistent_script(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)
        result = engine.execute_command("./nonexistent")
        assert result.kind == "error"


class TestQuestProgression:
    """Tests for quest completion tracking."""

    def test_pwd_completes_quest(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)
        result = engine.execute_command("pwd")
        # pwd is quest 0
        assert engine.state.current_quest_id >= 1 or \
            result.quest_completed is not None

    def test_quest_xp_awarded(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)
        initial_xp = engine.state.experience_points
        engine.execute_command("pwd")
        assert engine.state.experience_points > initial_xp

    def test_python_engine_awards_full_quest_xp(self, sandbox):
        """GameSession awards the quest's defined xp, not a reward-string guess.

        Regression: quests 6/7/9 (150/200/150 XP) were under-paid to 50 by
        `100 if "100" in q.reward else 50`.
        """
        from ti.quests import quest_list
        from ti.session import GameSession

        # Fresh save path so we get a clean state starting in the entrance
        # (which has a scroll to grep), not a stale on-disk save.
        session = GameSession.load(sandbox, save_path=sandbox / ".xp_regress_save.json")
        session.state.current_quest_id = 6  # 'grep', xp=150
        before = session.state.experience_points
        session.execute_line("grep magic scroll")
        assert session.state.experience_points - before == quest_list()[6].xp == 150


class TestRoomTracking:
    """Tests for room visit tracking."""

    def test_initial_room_tracked(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)
        assert len(engine.rooms_visited) >= 1

    def test_cd_tracks_new_room(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)
        initial_count = len(engine.rooms_visited)
        engine.execute_command("cd cellar")
        assert len(engine.rooms_visited) > initial_count


class TestSessionRunner:
    """Tests for run_session() with a scripted command source."""

    def test_scripted_session(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)

        commands = iter(["pwd", "ls", "cat scroll", "cd cellar", "ls", "exit"])

        def command_source(output: str) -> str:
            return next(commands, "exit")

        session = engine.run_session(command_source, max_commands=10)
        assert session.success
        assert session.total_turns >= 5
        assert any("cellar" in r for r in session.rooms_visited)

    def test_max_commands_limit(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)

        def infinite_ls(output: str) -> str:
            return "ls"

        session = engine.run_session(infinite_ls, max_commands=5)
        assert session.total_turns == 5
        assert session.exit_reason == "max_commands"

    def test_session_with_callback(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)

        results = []
        commands = iter(["pwd", "ls", "exit"])

        def source(output: str) -> str:
            return next(commands, "exit")

        session = engine.run_session(
            source,
            max_commands=10,
            on_command=lambda r: results.append(r),
        )
        assert len(results) >= 2
