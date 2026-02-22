"""AI-driven quest completion tests.

Tests that the AI agent can complete each quest in the quest system.
"""

import logging
import pytest

from ai.agent import TestAgent, AgentExhausted, AgentTimeout
from ai.session_runner import NonInteractiveEngine
from ai.scenarios import SCENARIO_NEW_PLAYER
from fixtures.log_capture import TestLogCapture

logger = logging.getLogger(__name__)

pytestmark = pytest.mark.ai


class TestQuestCompletion:
    """AI agent completes the quest progression."""

    @pytest.mark.timeout(120)
    def test_new_player_quests(self, sandbox, ai_agent, log_capture):
        """AI learns pwd, ls, cd, cat as a new player."""
        scenario = SCENARIO_NEW_PLAYER
        ai_agent.set_scenario(
            goal=scenario.goal,
            max_turns=scenario.max_turns,
        )

        engine = NonInteractiveEngine(sandbox)

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
        assert session.total_turns > 0

        # Verify commands were learned
        used = ai_agent.commands_used
        expected = {"pwd", "ls", "cd", "cat"}
        learned = expected & used
        logger.info("Commands learned: %s (expected: %s)", learned, expected)

        # Should learn at least 3 of 4 basic commands
        assert len(learned) >= 3, \
            f"Should learn at least 3 basic commands, learned: {learned}"

    @pytest.mark.timeout(120)
    def test_agent_reads_scrolls(self, sandbox, ai_agent, log_capture):
        """AI reads scroll files to learn about rooms."""
        ai_agent.set_scenario(
            goal="Read the scroll in the entrance by typing 'cat scroll'. "
                 "Then go to the cellar with 'cd cellar' and read its scroll too.",
            max_turns=15,
        )

        engine = NonInteractiveEngine(sandbox)
        scroll_reads = []

        def on_command(result):
            ai_agent.update_state(location=result.location)
            if result.command.startswith("cat") and "scroll" in result.command:
                scroll_reads.append(result.location)

        try:
            session = engine.run_session(
                ai_agent.next_command,
                max_commands=15,
                max_elapsed_seconds=90,
                on_command=on_command,
                feedback_agent=ai_agent,
            )
        except (AgentExhausted, AgentTimeout):
            pass

        assert len(scroll_reads) >= 1, \
            f"AI should read at least 1 scroll, read: {scroll_reads}"
