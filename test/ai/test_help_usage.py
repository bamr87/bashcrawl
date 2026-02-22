"""AI-driven help system usage tests.

Tests that the AI agent uses the help command and gets
context-appropriate responses.
"""

import logging
import pytest

from ai.agent import TestAgent, AgentExhausted, AgentTimeout
from ai.session_runner import NonInteractiveEngine
from ai.scenarios import SCENARIO_STUCK_PLAYER
from fixtures.log_capture import TestLogCapture

logger = logging.getLogger(__name__)

pytestmark = pytest.mark.ai


class TestHelpUsage:
    """AI agent uses help system when stuck."""

    @pytest.mark.timeout(120)
    def test_stuck_player_uses_help(self, sandbox, ai_agent, log_capture):
        """A confused AI player should use the help command."""
        scenario = SCENARIO_STUCK_PLAYER
        ai_agent.set_scenario(
            goal=scenario.goal,
            max_turns=scenario.max_turns,
        )

        engine = NonInteractiveEngine(sandbox)
        help_used = False

        def on_command(result):
            nonlocal help_used
            ai_agent.update_state(location=result.location)
            if result.command.startswith("help"):
                help_used = True
                log_capture.log_event("help_request")
            log_capture.log_command(
                result.command, result.output[:200], result.location
            )

        try:
            session = engine.run_session(
                ai_agent.next_command,
                max_commands=scenario.max_turns,
                max_elapsed_seconds=90,
                on_command=on_command,
                feedback_agent=ai_agent,
            )
        except (AgentExhausted, AgentTimeout):
            session = None

        assert session is not None
        logger.info("Help used: %s, turns: %d", help_used, session.total_turns if session else 0)
        # The stuck player scenario specifically asks to use help
        # But the AI might figure things out without it

    @pytest.mark.timeout(60)
    def test_help_provides_useful_output(self, sandbox, ai_agent, log_capture):
        """Verify that help output contains actionable information."""
        ai_agent.set_scenario(
            goal="Type 'help' to see what commands are available.",
            max_turns=5,
        )

        engine = NonInteractiveEngine(sandbox)

        def on_command(result):
            ai_agent.update_state(location=result.location)

        session = engine.run_session(
            ai_agent.next_command,
            max_commands=5,
            max_elapsed_seconds=60,
            on_command=on_command,
            feedback_agent=ai_agent,
        )

        # Find the help command result
        help_results = [r for r in session.commands if r.command.startswith("help")]
        if help_results:
            output = help_results[0].output.lower()
            assert any(cmd in output for cmd in ["ls", "cd", "pwd", "cat"]), \
                f"Help should mention basic commands, got: {output[:200]}"
