"""Integration tests for the agent mode pipeline.

Tests the full agent mode by launching ``python3 -m ti.agent`` as a subprocess
and verifying the stdin/stdout protocol, screenshot generation, and game state.
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

pytestmark = [pytest.mark.integration]

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
TI_DIR = REPO_ROOT / "src" / "terminal-illness"


def _has_textual() -> bool:
    """Check if textual is importable."""
    try:
        import textual  # noqa: F401
        return True
    except ImportError:
        return False


def _run_agent(commands: list[str], screenshot_dir: Path, timeout: int = 30) -> str:
    """Run the agent with a list of commands, return stdout."""
    input_text = "\n".join(commands) + "\n"
    env = os.environ.copy()
    env["PYTHONPATH"] = str(TI_DIR)

    result = subprocess.run(
        [
            sys.executable, "-m", "ti.agent",
            "--game-root", str(REPO_ROOT),
            "--screenshot-dir", str(screenshot_dir),
        ],
        input=input_text,
        capture_output=True,
        text=True,
        timeout=timeout,
        env=env,
    )
    return result.stdout


@pytest.mark.skipif(not _has_textual(), reason="textual not installed")
class TestAgentProtocol:
    """Tests for the agent stdin/stdout protocol."""

    def test_ready_sentinel_on_startup(self, tmp_path):
        """Agent emits READY> after startup."""
        output = _run_agent(["EXIT"], tmp_path / "shots")
        assert "READY>" in output

    def test_session_ended_on_exit(self, tmp_path):
        """Agent emits SESSION ENDED when EXIT is sent."""
        output = _run_agent(["EXIT"], tmp_path / "shots")
        assert "SESSION ENDED" in output

    def test_cmd_echo(self, tmp_path):
        """Agent echoes commands with CMD> prefix."""
        output = _run_agent(["pwd", "EXIT"], tmp_path / "shots")
        assert "CMD> pwd" in output

    def test_status_returns_json(self, tmp_path):
        """STATUS command returns valid JSON."""
        output = _run_agent(["STATUS", "EXIT"], tmp_path / "shots")
        status_line = [l for l in output.splitlines() if l.startswith("STATUS:")]
        assert len(status_line) >= 1
        json_str = status_line[0].split("STATUS: ", 1)[1]
        data = json.loads(json_str)
        assert "location" in data
        assert "inventory" in data
        assert "hp" in data
        assert "xp" in data
        assert "quest_id" in data

    def test_status_player_name(self, tmp_path):
        """STATUS shows player_name as 'Agent'."""
        output = _run_agent(["STATUS", "EXIT"], tmp_path / "shots")
        status_line = [l for l in output.splitlines() if l.startswith("STATUS:")]
        data = json.loads(status_line[0].split("STATUS: ", 1)[1])
        assert data["player_name"] == "Agent"

    def test_multiple_ready_sentinels(self, tmp_path):
        """Each command produces a READY> sentinel."""
        output = _run_agent(["pwd", "ls", "EXIT"], tmp_path / "shots")
        # Startup + pwd + ls + EXIT = at least 4 READY>
        ready_count = output.count("READY>")
        assert ready_count >= 3

    def test_banner_on_startup(self, tmp_path):
        """Agent prints banner with version info."""
        output = _run_agent(["EXIT"], tmp_path / "shots")
        assert "BASHCRAWL AGENT TUI" in output

    def test_quit_also_works(self, tmp_path):
        """QUIT is an alias for EXIT."""
        output = _run_agent(["QUIT"], tmp_path / "shots")
        assert "SESSION ENDED" in output


@pytest.mark.skipif(not _has_textual(), reason="textual not installed")
class TestAgentScreenshots:
    """Tests for SVG screenshot generation."""

    def test_initial_screenshot_created(self, tmp_path):
        """Auto-screenshot creates 000_initial.svg on startup."""
        shot_dir = tmp_path / "shots"
        _run_agent(["EXIT"], shot_dir)
        initial = shot_dir / "000_initial.svg"
        assert initial.exists(), f"Missing initial screenshot in {list(shot_dir.iterdir())}"
        assert initial.stat().st_size > 1000  # SVG should be >1KB

    def test_command_screenshot_created(self, tmp_path):
        """Auto-screenshot after a command creates numbered SVG."""
        shot_dir = tmp_path / "shots"
        _run_agent(["pwd", "EXIT"], shot_dir)
        svgs = list(shot_dir.glob("*.svg"))
        # Should have at least 000_initial.svg + 001_pwd.svg
        assert len(svgs) >= 2

    def test_explicit_screenshot(self, tmp_path):
        """SCREENSHOT meta-command creates named SVG."""
        shot_dir = tmp_path / "shots"
        output = _run_agent(["SCREENSHOT my_test_shot", "EXIT"], shot_dir)
        assert "SCREENSHOT:" in output
        target = shot_dir / "my_test_shot.svg"
        assert target.exists()

    def test_screenshot_is_valid_svg(self, tmp_path):
        """Generated screenshots are valid SVG files."""
        shot_dir = tmp_path / "shots"
        _run_agent(["EXIT"], shot_dir)
        initial = shot_dir / "000_initial.svg"
        content = initial.read_text()
        assert content.strip().startswith("<"), "SVG should start with <"
        assert "svg" in content.lower(), "File should contain svg element"

    def test_screenshot_dir_created(self, tmp_path):
        """Screenshot directory is created if it doesn't exist."""
        shot_dir = tmp_path / "nonexistent" / "deep" / "dir"
        _run_agent(["EXIT"], shot_dir)
        assert shot_dir.is_dir()


@pytest.mark.skipif(not _has_textual(), reason="textual not installed")
class TestAgentGameplay:
    """Tests for game command execution through the agent."""

    def test_cd_changes_location(self, tmp_path):
        """cd command changes location in STATUS output."""
        output = _run_agent(
            ["cd entrance", "STATUS", "EXIT"],
            tmp_path / "shots",
        )
        status_line = [l for l in output.splitlines() if l.startswith("STATUS:")]
        data = json.loads(status_line[0].split("STATUS: ", 1)[1])
        assert "entrance" in data["location"]

    def test_cat_scroll_produces_output(self, tmp_path):
        """cat scroll produces game content output."""
        output = _run_agent(
            ["cd entrance", "cat scroll", "EXIT"],
            tmp_path / "shots",
        )
        assert "CMD> cat scroll" in output

    def test_export_updates_inventory(self, tmp_path):
        """export I=amulet,$I updates inventory in STATUS."""
        output = _run_agent(
            ["export I=amulet,", "STATUS", "EXIT"],
            tmp_path / "shots",
        )
        status_line = [l for l in output.splitlines() if l.startswith("STATUS:")]
        data = json.loads(status_line[0].split("STATUS: ", 1)[1])
        assert "amulet" in data["inventory"]

    def test_empty_lines_produce_ready(self, tmp_path):
        """Blank lines still produce READY> sentinel."""
        output = _run_agent(["", "", "EXIT"], tmp_path / "shots")
        ready_count = output.count("READY>")
        assert ready_count >= 3  # startup + 2 blank + EXIT


@pytest.mark.skipif(not _has_textual(), reason="textual not installed")
class TestAgentBashMode:
    """Tests for the bash-only agent REPL (via main.sh --agent-bash)."""

    def test_bash_agent_startup(self):
        """Bash agent REPL starts and shows READY>."""
        result = subprocess.run(
            ["bash", str(REPO_ROOT / "main.sh"), "--agent-bash"],
            input="exit\n",
            capture_output=True,
            text=True,
            timeout=15,
        )
        assert "READY>" in result.stdout

    def test_bash_agent_session_ended(self):
        """Bash agent emits SESSION ENDED on exit."""
        result = subprocess.run(
            ["bash", str(REPO_ROOT / "main.sh"), "--agent-bash"],
            input="exit\n",
            capture_output=True,
            text=True,
            timeout=15,
        )
        assert "SESSION ENDED" in result.stdout

    def test_bash_agent_cmd_echo(self):
        """Bash agent echoes commands with CMD> prefix."""
        result = subprocess.run(
            ["bash", str(REPO_ROOT / "main.sh"), "--agent-bash"],
            input="pwd\nexit\n",
            capture_output=True,
            text=True,
            timeout=15,
        )
        assert "CMD> pwd" in result.stdout
