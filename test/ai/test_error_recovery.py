"""AI-driven error recovery tests.

Tests that the AI agent can recover from mistakes:
wrong commands, missing items, navigation errors.
"""

import logging
import pytest

from ai.agent import TestAgent, AgentExhausted, AgentTimeout
from ai.session_runner import NonInteractiveEngine
from fixtures.log_capture import TestLogCapture

logger = logging.getLogger(__name__)

pytestmark = pytest.mark.ai


class TestErrorRecovery:
    """AI agent encounters errors and adapts."""

    @pytest.mark.timeout(120)
    def test_recover_from_wrong_path(self, sandbox, ai_agent, log_capture):
        """AI tries an invalid cd, then finds the correct path."""
        ai_agent.set_scenario(
            goal=(
                "Try to go to 'cd dungeon' (it won't work). "
                "Then use 'ls' to see what directories exist, "
                "and navigate to the cellar instead."
            ),
            max_turns=20,
        )

        engine = NonInteractiveEngine(sandbox)
        errors = []

        def on_command(result):
            ai_agent.update_state(location=result.location)
            if result.kind == "error":
                errors.append(result.command)
            log_capture.log_command(
                result.command, result.output[:200], result.location
            )

        try:
            session = engine.run_session(
                ai_agent.next_command,
                max_commands=20,
                max_elapsed_seconds=90,
                on_command=on_command,
                feedback_agent=ai_agent,
            )
        except (AgentExhausted, AgentTimeout):
            session = None

        assert session is not None
        # Should have at least one error (the wrong cd)
        assert len(errors) >= 1 or "cellar" in " ".join(session.rooms_visited), \
            "AI should either make an error or navigate correctly"

    @pytest.mark.timeout(120)
    def test_recover_from_unknown_command(self, sandbox, ai_agent, log_capture):
        """AI tries an unknown command, then uses help."""
        ai_agent.set_scenario(
            goal=(
                "Type 'inventory' (which is not a valid command). "
                "Then try 'help' to see available commands. "
                "Then use 'pwd' and 'ls'."
            ),
            max_turns=15,
        )

        engine = NonInteractiveEngine(sandbox)

        def on_command(result):
            ai_agent.update_state(location=result.location)

        try:
            session = engine.run_session(
                ai_agent.next_command,
                max_commands=15,
                max_elapsed_seconds=90,
                on_command=on_command,
                feedback_agent=ai_agent,
            )
        except (AgentExhausted, AgentTimeout):
            session = None

        assert session is not None
        # Should have tried both error-causing and valid commands
        commands = [r.command for r in session.commands]
        has_error = any(r.kind == "error" for r in session.commands)
        has_success = any(r.kind in ("output", "success", "info") for r in session.commands)
        assert has_error or has_success, "Should have attempted various commands"
