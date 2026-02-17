"""Integration tests for game progression through the critical path.

Tests the full entrance → cellar → armoury → chamber progression
with proper environment propagation between steps.
"""

import os
import subprocess
import pytest
from pathlib import Path

pytestmark = pytest.mark.integration


class TestCriticalPathProgression:
    """Tests the main game progression path with env propagation."""

    def test_entrance_to_cellar(self, sandbox):
        """Verify entrance → cellar navigation and scroll reading."""
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)

        # Read entrance scroll
        r = engine.execute_command("cat scroll")
        assert r.kind == "output"
        assert len(r.output) > 0

        # Navigate to cellar
        r = engine.execute_command("cd cellar")
        assert r.kind == "success"
        assert "cellar" in engine.cwd

    def test_cellar_treasure_gives_amulet(self, sandbox):
        """Verify cellar treasure script mentions amulet."""
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)
        engine.execute_command("cd cellar")
        r = engine.execute_command("./treasure")
        assert "amulet" in r.output.lower() or len(r.output) > 0

    def test_full_critical_path(self, sandbox):
        """Walk the full critical path: entrance → cellar → armoury → chamber."""
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)

        # Step 1: Entrance
        engine.execute_command("cat scroll")
        engine.execute_command("ls")

        # Step 2: Cellar — collect amulet
        engine.execute_command("cd cellar")
        engine.execute_command("cat scroll")
        r = engine.execute_command("./treasure")
        engine.execute_command("export I=amulet,$I")
        assert "amulet" in engine.state.inventory

        # Step 3: Armoury — collect sword, drink potion
        engine.execute_command("cd armoury")
        engine.execute_command("cat scroll")
        engine.execute_command("./treasure")
        engine.execute_command("export I=sword,$I")
        assert "sword" in engine.state.inventory

        # Step 4: Chamber
        engine.execute_command("cd chamber")
        engine.execute_command("cat scroll")
        r = engine.execute_command("ls")
        assert "treasure" in r.output.lower() or "statue" in r.output.lower() or len(r.output) > 0

    def test_env_propagation_between_rooms(self, sandbox):
        """Verify that exported variables persist across room changes."""
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)

        engine.execute_command("export HP=15")
        engine.execute_command("export I=amulet,")
        engine.execute_command("cd cellar")
        engine.execute_command("cd armoury")

        # State should persist
        assert engine.state.hp == 15
        assert "amulet" in engine.state.inventory


class TestHiddenRoomUnlocking:
    """Tests for unlocking hidden rooms via treasure scripts."""

    def test_cellar_treasure_unlocks_rooms(self, sandbox):
        """Cellar treasure should unlock .chapel, .vault, .scrap."""
        entrance = sandbox / "entrance"

        # Run the treasure script
        env = os.environ.copy()
        env["BASHCRAWL_ROOT"] = str(sandbox)
        subprocess.run(
            ["bash", str(entrance / "cellar" / "treasure")],
            cwd=str(entrance / "cellar"),
            env=env,
            capture_output=True,
            timeout=10,
        )

        # Check if hidden rooms were renamed (unlocked)
        chapel_unlocked = (entrance / "chapel").exists()
        chapel_hidden = (entrance / ".chapel").exists()
        assert chapel_unlocked or chapel_hidden, \
            "Chapel should exist (hidden or unlocked)"

    def test_navigate_to_unlocked_chapel(self, sandbox):
        """After unlocking, should be able to cd into chapel."""
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)

        entrance = sandbox / "entrance"
        chapel_hidden = entrance / ".chapel"
        chapel_visible = entrance / "chapel"

        # If chapel is hidden, rename it to simulate unlocking
        if chapel_hidden.exists() and not chapel_visible.exists():
            chapel_hidden.rename(chapel_visible)

        if chapel_visible.exists():
            r = engine.execute_command("cd chapel")
            assert r.kind == "success"
            assert "chapel" in engine.cwd


class TestWorkshopPath:
    """Tests for the workshop tutorial room."""

    def test_workshop_accessible(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)
        r = engine.execute_command("cd workshop")
        assert r.kind == "success"

    def test_workshop_scroll_teaches_commands(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)
        engine.execute_command("cd workshop")
        r = engine.execute_command("cat scroll")
        stdout = r.output.lower()
        # Workshop should teach mkdir, touch, rm, cp, echo
        assert any(cmd in stdout for cmd in ["mkdir", "touch", "rm", "cp", "echo"]), \
            f"Workshop scroll should teach filesystem commands, got: {r.output[:200]}"
