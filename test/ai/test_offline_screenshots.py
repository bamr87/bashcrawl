"""Offline TUI screenshot test (no API key required).

Uses a scripted command sequence replayed through the real Textual TUI
agent (``ti.agent``).  Generates SVG screenshots of the rendered TUI
and JSONL session logs, all accessible through the Flask viewer.

Marked as integration (not ai), so it runs without ANTHROPIC_API_KEY.
"""

import logging
import os
import subprocess
import sys
import pytest
from pathlib import Path

from fixtures.log_capture import TestLogCapture
from fixtures.screenshot_capture import ScreenshotCapture

logger = logging.getLogger(__name__)

pytestmark = [pytest.mark.integration]

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
TI_DIR = REPO_ROOT / "src" / "terminal-illness"

# A scripted command sequence that mimics a new player exploring the game.
SCRIPTED_COMMANDS = [
    "pwd",
    "ls",
    "cat scroll",
    "cd cellar",
    "pwd",
    "ls",
    "cat scroll",
    "./treasure",
    "export I=amulet,$I",
    "ls",
    "cd armoury",
    "pwd",
    "ls",
    "cat scroll",
    "./treasure",
    "export I=sword,$I",
    "./potion",
    "export HP=15",
    "ls",
    "cd chamber",
    "pwd",
    "ls",
    "cat scroll",
    "STATUS",
    "EXIT",
]


def _has_textual() -> bool:
    try:
        import textual  # noqa: F401
        return True
    except ImportError:
        return False


def _run_tui_agent(commands: list[str], screenshot_dir: Path, timeout: int = 60) -> str:
    """Run the TUI agent subprocess with a list of commands."""
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
    if result.returncode != 0:
        logger.warning("TUI agent stderr: %s", result.stderr[:500])
    return result.stdout


@pytest.mark.skipif(not _has_textual(), reason="textual not installed")
class TestOfflineTUIScreenshots:
    """Scripted walkthrough captured through the real Textual TUI."""

    def test_scripted_tui_walkthrough(
        self,
        log_capture,
        screenshot_capture,
    ):
        """Replay scripted commands through the TUI agent for real screenshots.

        Produces:
        - Real Textual SVG screenshots in ``logs/screenshots/``
        - JSONL session in ``logs/sessions/``
        - manifest.json for the viewer screenshot gallery
        """
        shot_dir = screenshot_capture.screenshot_dir

        stdout = _run_tui_agent(SCRIPTED_COMMANDS, shot_dir, timeout=60)

        # Parse SCREENSHOT: lines and register with capture system
        new_shots = screenshot_capture.take_from_agent_output(stdout)

        # Also log each command to the JSONL session
        for line in stdout.splitlines():
            if line.startswith("CMD> "):
                cmd = line[5:].strip()
                log_capture.log_command(command=cmd, room="")

        # ---- Assertions ----
        assert len(new_shots) > 0, "Should have captured TUI screenshots"

        # Verify screenshots are real Textual SVG renders
        for p in new_shots:
            assert p.is_file(), f"Screenshot missing: {p}"
            content = p.read_text()
            assert "<svg" in content.lower(), f"Not a valid SVG: {p}"
            assert p.stat().st_size > 1000, (
                f"Too small for a real TUI render: {p}"
            )

        # Verify JSONL has screenshot events
        sc_events = log_capture.get_events_by_type("screenshot")
        assert len(sc_events) > 0, "Should have screenshot log events"

        logger.info(
            "TUI walkthrough: %d screenshots captured", len(new_shots),
        )
        logger.info("Session JSONL: %s", log_capture.file_path)
        logger.info("Screenshots dir: %s", shot_dir)
