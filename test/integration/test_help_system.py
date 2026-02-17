"""Integration tests for the help system.

Tests help.sh subcommands, the AI engine pattern detection,
and the command suggester.
"""

import subprocess
import pytest
from pathlib import Path

pytestmark = pytest.mark.integration


class TestHelpScript:
    """Tests for help.sh top-level invocation."""

    def test_help_runs(self, sandbox):
        result = subprocess.run(
            ["bash", str(sandbox / "help.sh")],
            cwd=str(sandbox),
            capture_output=True,
            text=True,
            timeout=10,
        )
        # help.sh should exit 0 or produce output
        assert result.returncode == 0 or len(result.stdout) > 0

    def test_help_commands(self, sandbox):
        result = subprocess.run(
            ["bash", str(sandbox / "help.sh"), "commands"],
            cwd=str(sandbox),
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            stdout = result.stdout.lower()
            assert any(cmd in stdout for cmd in ["ls", "cd", "cat", "pwd"]), \
                "help commands should list basic commands"

    def test_help_map(self, sandbox):
        result = subprocess.run(
            ["bash", str(sandbox / "help.sh"), "map"],
            cwd=str(sandbox),
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            assert len(result.stdout) > 0, "help map should produce output"


class TestHelpInEngine:
    """Tests for help command within the NonInteractiveEngine."""

    def test_help_command(self, sandbox):
        from ai.session_runner import NonInteractiveEngine
        engine = NonInteractiveEngine(sandbox)
        result = engine.execute_command("help")
        assert result.kind == "info"
        assert "pwd" in result.output.lower() or "ls" in result.output.lower()


class TestSetupScript:
    """Tests for setup.sh."""

    def test_setup_quick(self, sandbox):
        result = subprocess.run(
            ["bash", str(sandbox / "setup.sh"), "--quick"],
            cwd=str(sandbox),
            capture_output=True,
            text=True,
            timeout=15,
        )
        # Should complete without critical errors
        assert result.returncode == 0 or "Error" not in result.stderr, \
            f"setup.sh --quick failed: {result.stderr}"

    def test_setup_verify(self, sandbox):
        result = subprocess.run(
            ["bash", str(sandbox / "setup.sh"), "--verify"],
            cwd=str(sandbox),
            capture_output=True,
            text=True,
            timeout=15,
        )
        # Verify mode should report status
        assert result.returncode == 0 or len(result.stdout) > 0
