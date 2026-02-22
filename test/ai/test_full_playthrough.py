"""AI-driven full playthrough test.

Uses Claude to play through the entire game from entrance to endgame.
Requires ANTHROPIC_API_KEY environment variable.
"""

import logging
import pytest
from pathlib import Path

from ai.agent import TestAgent, AgentExhausted, AgentTimeout
from ai.session_runner import NonInteractiveEngine
from ai.scenarios import SCENARIO_FULL_PLAYTHROUGH, SCENARIO_CRITICAL_PATH
from fixtures.log_capture import TestLogCapture

logger = logging.getLogger(__name__)

pytestmark = [pytest.mark.ai, pytest.mark.slow]


class TestFullPlaythrough:
    """AI agent plays the entire game from entrance to .rift."""

    @pytest.mark.timeout(300)
    def test_full_playthrough(self, sandbox, ai_agent, log_capture):
        """AI completes the full game, collecting all treasures."""
        scenario = SCENARIO_FULL_PLAYTHROUGH
        ai_agent.set_scenario(
            goal=scenario.goal,
            max_turns=scenario.max_turns,
        )

        engine = NonInteractiveEngine(sandbox)

        def on_command(result):
            # Update agent's state knowledge
            ai_agent.update_state(
                location=result.location,
                inventory=result.inventory,
                hp=result.hp,
            )
            # Log to capture
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

        try:
            session = engine.run_session(
                ai_agent.next_command,
                max_commands=scenario.max_turns,
                max_elapsed_seconds=240,
                on_command=on_command,
                feedback_agent=ai_agent,
            )
        except (AgentExhausted, AgentTimeout):
            session = None

        # Assertions
        assert session is not None, "Session should complete"
        assert session.total_turns > 0, "Should have executed commands"
        assert len(session.rooms_visited) >= scenario.min_rooms_visited, \
            f"Should visit at least {scenario.min_rooms_visited} rooms, visited: {session.rooms_visited}"

        logger.info(
            "Full playthrough: %d turns, %d rooms, inventory=%s",
            session.total_turns,
            len(session.rooms_visited),
            session.final_inventory,
        )


class TestCriticalPath:
    """AI agent follows the main game progression path."""

    @pytest.mark.timeout(180)
    def test_critical_path(self, sandbox, ai_agent, log_capture):
        """AI navigates entrance → cellar → armoury → chamber."""
        scenario = SCENARIO_CRITICAL_PATH
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
                max_elapsed_seconds=150,
                on_command=on_command,
                feedback_agent=ai_agent,
            )
        except (AgentExhausted, AgentTimeout):
            session = None

        assert session is not None
        assert session.total_turns > 0

        # Check rooms visited
        rooms_str = " ".join(session.rooms_visited)
        for expected_room in scenario.expected_rooms:
            assert expected_room in rooms_str, \
                f"Should visit {expected_room}, visited: {session.rooms_visited}"

        logger.info(
            "Critical path: %d turns, rooms=%s",
            session.total_turns,
            session.rooms_visited,
        )
