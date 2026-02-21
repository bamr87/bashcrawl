"""Integration tests for the agent mode pipeline.

Tests the full agent mode by launching ``python3 -m ti.agent`` as a subprocess
and verifying the stdin/stdout protocol, screenshot generation, and game state.

Screenshots are persisted under ``logs/screenshots/`` for post-test review.
"""

import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

import pytest

pytestmark = [pytest.mark.integration]

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
TI_DIR = REPO_ROOT / "src" / "terminal-illness"
SCREENSHOTS_ROOT = REPO_ROOT / "logs" / "screenshots"


def _has_textual() -> bool:
    """Check if textual is importable."""
    try:
        import textual  # noqa: F401
        return True
    except ImportError:
        return False


def _make_shot_dir(name: str) -> Path:
    """Create a timestamped screenshot directory under ``logs/screenshots/``."""
    ts = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    d = SCREENSHOTS_ROOT / f"{ts}_{name}"
    d.mkdir(parents=True, exist_ok=True)
    return d


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

    def test_ready_sentinel_on_startup(self):
        """Agent emits READY> after startup."""
        output = _run_agent(["EXIT"], _make_shot_dir("ready_sentinel"))
        assert "READY>" in output

    def test_session_ended_on_exit(self):
        """Agent emits SESSION ENDED when EXIT is sent."""
        output = _run_agent(["EXIT"], _make_shot_dir("session_ended"))
        assert "SESSION ENDED" in output

    def test_cmd_echo(self):
        """Agent echoes commands with CMD> prefix."""
        output = _run_agent(["pwd", "EXIT"], _make_shot_dir("cmd_echo"))
        assert "CMD> pwd" in output

    def test_status_returns_json(self):
        """STATUS command returns valid JSON."""
        output = _run_agent(["STATUS", "EXIT"], _make_shot_dir("status_json"))
        status_line = [l for l in output.splitlines() if l.startswith("STATUS:")]
        assert len(status_line) >= 1
        json_str = status_line[0].split("STATUS: ", 1)[1]
        data = json.loads(json_str)
        assert "location" in data
        assert "inventory" in data
        assert "hp" in data
        assert "xp" in data
        assert "quest_id" in data

    def test_status_player_name(self):
        """STATUS shows player_name as 'Agent'."""
        output = _run_agent(["STATUS", "EXIT"], _make_shot_dir("status_name"))
        status_line = [l for l in output.splitlines() if l.startswith("STATUS:")]
        data = json.loads(status_line[0].split("STATUS: ", 1)[1])
        assert data["player_name"] == "Agent"

    def test_multiple_ready_sentinels(self):
        """Each command produces a READY> sentinel."""
        output = _run_agent(["pwd", "ls", "EXIT"], _make_shot_dir("multi_ready"))
        # Startup + pwd + ls + EXIT = at least 4 READY>
        ready_count = output.count("READY>")
        assert ready_count >= 3

    def test_banner_on_startup(self):
        """Agent prints banner with version info."""
        output = _run_agent(["EXIT"], _make_shot_dir("banner"))
        assert "BASHCRAWL AGENT TUI" in output

    def test_quit_also_works(self):
        """QUIT is an alias for EXIT."""
        output = _run_agent(["QUIT"], _make_shot_dir("quit_alias"))
        assert "SESSION ENDED" in output


@pytest.mark.skipif(not _has_textual(), reason="textual not installed")
class TestAgentScreenshots:
    """Tests for SVG screenshot generation."""

    def test_initial_screenshot_created(self):
        """Auto-screenshot creates 000_initial.svg on startup."""
        shot_dir = _make_shot_dir("initial_screenshot")
        _run_agent(["EXIT"], shot_dir)
        initial = shot_dir / "000_initial.svg"
        assert initial.exists(), f"Missing initial screenshot in {list(shot_dir.iterdir())}"
        assert initial.stat().st_size > 1000  # SVG should be >1KB

    def test_command_screenshot_created(self):
        """Auto-screenshot after a command creates numbered SVG."""
        shot_dir = _make_shot_dir("command_screenshot")
        _run_agent(["pwd", "EXIT"], shot_dir)
        svgs = list(shot_dir.glob("*.svg"))
        # Should have at least 000_initial.svg + 001_pwd.svg
        assert len(svgs) >= 2

    def test_explicit_screenshot(self):
        """SCREENSHOT meta-command creates named SVG."""
        shot_dir = _make_shot_dir("explicit_screenshot")
        output = _run_agent(["SCREENSHOT my_test_shot", "EXIT"], shot_dir)
        assert "SCREENSHOT:" in output
        target = shot_dir / "my_test_shot.svg"
        assert target.exists()

    def test_screenshot_is_valid_svg(self):
        """Generated screenshots are valid SVG files."""
        shot_dir = _make_shot_dir("valid_svg")
        _run_agent(["EXIT"], shot_dir)
        initial = shot_dir / "000_initial.svg"
        content = initial.read_text()
        assert content.strip().startswith("<"), "SVG should start with <"
        assert "svg" in content.lower(), "File should contain svg element"

    def test_screenshot_dir_created(self):
        """Screenshot directory is created if it doesn't exist."""
        shot_dir = SCREENSHOTS_ROOT / "nonexistent_deep_dir"
        try:
            _run_agent(["EXIT"], shot_dir)
            assert shot_dir.is_dir()
        finally:
            # Clean up the deep directory
            import shutil
            if shot_dir.exists():
                shutil.rmtree(shot_dir)


@pytest.mark.skipif(not _has_textual(), reason="textual not installed")
class TestAgentGameplay:
    """Tests for game command execution through the agent."""

    def test_cd_changes_location(self):
        """cd command changes location in STATUS output."""
        output = _run_agent(
            ["cd entrance", "STATUS", "EXIT"],
            _make_shot_dir("cd_location"),
        )
        status_line = [l for l in output.splitlines() if l.startswith("STATUS:")]
        data = json.loads(status_line[0].split("STATUS: ", 1)[1])
        assert "entrance" in data["location"]

    def test_cat_scroll_produces_output(self):
        """cat scroll produces game content output."""
        output = _run_agent(
            ["cd entrance", "cat scroll", "EXIT"],
            _make_shot_dir("cat_scroll"),
        )
        assert "CMD> cat scroll" in output

    def test_export_updates_inventory(self):
        """export I=amulet,$I updates inventory in STATUS."""
        output = _run_agent(
            ["export I=amulet,", "STATUS", "EXIT"],
            _make_shot_dir("export_inventory"),
        )
        status_line = [l for l in output.splitlines() if l.startswith("STATUS:")]
        data = json.loads(status_line[0].split("STATUS: ", 1)[1])
        assert "amulet" in data["inventory"]

    def test_empty_lines_produce_ready(self):
        """Blank lines still produce READY> sentinel."""
        output = _run_agent(["", "", "EXIT"], _make_shot_dir("empty_lines"))
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


@pytest.mark.skipif(not _has_textual(), reason="textual not installed")
class TestAgentScreenshotLogging:
    """Tests that screenshots are logged via ScreenshotCapture and TestLogCapture."""

    def test_screenshot_capture_records_agent_output(self):
        """ScreenshotCapture.take_from_agent_output parses SCREENSHOT: lines."""
        from fixtures.screenshot_capture import ScreenshotCapture
        from fixtures.log_capture import TestLogCapture

        log_dir = REPO_ROOT / "logs" / "sessions"
        log_dir.mkdir(parents=True, exist_ok=True)
        lc = TestLogCapture(log_dir, scenario="integration")
        lc.start()

        shot_dir = _make_shot_dir("capture_agent_output")
        cap = ScreenshotCapture(screenshot_dir=shot_dir, log_capture=lc)

        # Run agent and capture output
        output = _run_agent(["pwd", "EXIT"], shot_dir)

        # Use ScreenshotCapture to parse the output
        paths = cap.take_from_agent_output(output)
        lc.end()

        # Write manifest for review
        cap.write_manifest()

        # Should find at least the initial screenshot
        assert len(paths) >= 1
        assert cap.count >= 1

        # Verify log events were written
        screenshots = lc.get_screenshots()
        assert len(screenshots) >= 1
        assert screenshots[0]["trigger"] == "agent_auto"

    def test_session_end_counts_screenshots(self):
        """session_end event includes screenshots_captured from agent run."""
        from fixtures.screenshot_capture import ScreenshotCapture
        from fixtures.log_capture import TestLogCapture

        log_dir = REPO_ROOT / "logs" / "sessions"
        log_dir.mkdir(parents=True, exist_ok=True)
        lc = TestLogCapture(log_dir, scenario="integration")
        lc.start()

        shot_dir = _make_shot_dir("session_end_counts")
        cap = ScreenshotCapture(screenshot_dir=shot_dir, log_capture=lc)

        output = _run_agent(["pwd", "ls", "EXIT"], shot_dir)
        cap.take_from_agent_output(output)
        lc.end()
        cap.write_manifest()

        end_event = lc.events[-1]
        assert end_event.event == "session_end"
        assert end_event.extra["screenshots_captured"] >= 1

    def test_screenshot_events_in_jsonl_file(self):
        """Screenshot events persist to the JSONL log file."""
        from fixtures.screenshot_capture import ScreenshotCapture
        from fixtures.log_capture import TestLogCapture

        log_dir = REPO_ROOT / "logs" / "sessions"
        log_dir.mkdir(parents=True, exist_ok=True)
        lc = TestLogCapture(log_dir, scenario="integration")
        lc.start()

        shot_dir = _make_shot_dir("jsonl_events")
        cap = ScreenshotCapture(screenshot_dir=shot_dir, log_capture=lc)

        output = _run_agent(["pwd", "EXIT"], shot_dir)
        cap.take_from_agent_output(output)
        lc.end()
        cap.write_manifest()

        # Read JSONL file and verify screenshot events
        content = lc.file_path.read_text()
        events = [json.loads(l) for l in content.strip().splitlines() if l.strip()]
        screenshot_events = [e for e in events if e.get("event") == "screenshot"]
        assert len(screenshot_events) >= 1
        assert "screenshot_path" in screenshot_events[0]
