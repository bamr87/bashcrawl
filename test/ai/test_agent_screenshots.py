"""AI agent test driving the actual Textual TUI with screenshot capture.

Two-phase approach:
  1. Use Claude (TestAgent) + NonInteractiveEngine to generate a command
     sequence while playing the game.
  2. Replay those commands through the Textual TUI agent (``ti.agent``)
     subprocess to capture real SVG screenshots of the rendered UI.

Session JSONL logs and screenshots are written to ``logs/`` for the
Flask viewer.

Requires ANTHROPIC_API_KEY.  Marked ``@pytest.mark.ai``.
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
from pathlib import Path

import pytest

from ai.agent import TestAgent, AgentExhausted, AgentTimeout
from ai.session_runner import NonInteractiveEngine
from ai.scenarios import SCENARIO_NEW_PLAYER
from fixtures.log_capture import TestLogCapture
from fixtures.screenshot_capture import ScreenshotCapture

logger = logging.getLogger(__name__)

pytestmark = [pytest.mark.ai]

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
TI_DIR = REPO_ROOT / "src" / "terminal-illness"


def _has_textual() -> bool:
    try:
        import textual  # noqa: F401
        return True
    except ImportError:
        return False


def _run_tui_agent(commands: list[str], screenshot_dir: Path, timeout: int = 60) -> str:
    """Run the TUI agent subprocess with a list of commands.

    Launches ``python -m ti.agent`` with the commands piped to stdin.
    The agent auto-captures an SVG screenshot after every command.

    Returns the full stdout from the agent.
    """
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
class TestAIAgentTUI:
    """AI agent plays the game through the real Textual TUI with screenshots."""

    @pytest.mark.timeout(300)
    def test_new_player_tui_screenshots(
        self,
        sandbox,
        ai_agent,
        log_capture,
        screenshot_capture,
    ):
        """AI explores entrance + cellar, then replays via TUI for screenshots.

        Phase 1: Claude generates commands using NonInteractiveEngine.
        Phase 2: Commands are replayed through the Textual TUI subprocess
                 (``ti.agent``), which captures a real SVG screenshot of
                 the rendered interface after every command.

        Produces:
        - Real TUI SVG screenshots in ``logs/screenshots/``
        - JSONL session log in ``logs/sessions/``
        - manifest.json for the viewer screenshot gallery

        Viewable at ``/sessions/<sid>`` and ``/screenshots/<dir_name>``.
        """
        scenario = SCENARIO_NEW_PLAYER
        ai_agent.set_scenario(
            goal=scenario.goal,
            max_turns=scenario.max_turns,
        )

        # ── Phase 1: AI generates commands ──────────────────────────────
        engine = NonInteractiveEngine(sandbox, log_capture=log_capture)
        collected_commands: list[str] = []

        def on_command(result):
            ai_agent.update_state(
                location=result.location,
                inventory=result.inventory,
                hp=result.hp,
            )
            log_capture.log_command(
                command=result.command,
                output=result.output[:200],
                room=result.location,
            )
            if result.quest_completed:
                log_capture.log_event(
                    "quest_complete",
                    quest=result.quest_completed,
                )

        def recording_source(prev_output: str) -> str:
            try:
                cmd = ai_agent.next_command(prev_output)
            except (AgentExhausted, AgentTimeout):
                return "exit"
            collected_commands.append(cmd)
            return cmd

        try:
            session = engine.run_session(
                recording_source,
                max_commands=scenario.max_turns,
                max_elapsed_seconds=150,
                on_command=on_command,
                feedback_agent=ai_agent,
            )
        except (AgentExhausted, AgentTimeout):
            session = None

        assert session is not None, "AI session should complete"
        assert len(collected_commands) > 0, "AI should have generated commands"

        logger.info(
            "Phase 1 done: %d commands generated, rooms=%s",
            len(collected_commands),
            session.rooms_visited,
        )
        logger.info("Commands: %s", collected_commands)

        # ── Phase 2: Replay through TUI for screenshots ────────────────
        shot_dir = screenshot_capture.screenshot_dir

        # Add STATUS and EXIT at the end
        tui_commands = list(collected_commands) + ["STATUS", "EXIT"]

        logger.info(
            "Phase 2: replaying %d commands through TUI agent",
            len(tui_commands),
        )

        stdout = _run_tui_agent(tui_commands, shot_dir, timeout=60)

        # Parse SCREENSHOT: lines from agent output and register them
        new_shots = screenshot_capture.take_from_agent_output(stdout)

        logger.info("Phase 2 done: captured %d TUI screenshots", len(new_shots))

        # ── Assertions ──────────────────────────────────────────────────
        assert screenshot_capture.count > 0, "Should have captured TUI screenshots"

        # Verify screenshots are real Textual SVG renders
        for p in screenshot_capture.screenshots:
            assert p.is_file(), f"Screenshot missing: {p}"
            content = p.read_text()
            assert "<svg" in content.lower(), f"Not a valid SVG: {p}"
            assert p.stat().st_size > 1000, (
                f"Screenshot too small for a TUI render: {p}"
            )

        # Check rooms visited in the AI phase
        rooms_str = " ".join(session.rooms_visited)
        assert "entrance" in rooms_str, (
            f"Should visit entrance, visited: {session.rooms_visited}"
        )

        logger.info(
            "AI TUI session: %d AI turns, %d TUI screenshots, rooms=%s",
            session.total_turns,
            screenshot_capture.count,
            session.rooms_visited,
        )
        logger.info("Session JSONL: %s", log_capture.file_path)
        logger.info("Screenshots dir: %s", shot_dir)
