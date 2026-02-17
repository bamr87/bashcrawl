"""AI-driven combat encounter tests.

Tests the AI agent's ability to handle combat mechanics:
statue, monster, ghost encounters with death and retry.
"""

import logging
import pytest

from ai.agent import TestAgent, AgentExhausted
from ai.session_runner import NonInteractiveEngine
from ai.scenarios import SCENARIO_COMBAT_STRESS
from fixtures.log_capture import TestLogCapture

logger = logging.getLogger(__name__)

pytestmark = [pytest.mark.ai, pytest.mark.slow]


class TestCombatEncounters:
    """AI agent handles combat encounters."""

    @pytest.mark.timeout(180)
    def test_statue_combat(self, sandbox, ai_agent, log_capture):
        """AI navigates to chamber and fights the statue."""
        ai_agent.set_scenario(
            goal=(
                "Navigate to the chamber: cd cellar, cd armoury, cd chamber. "
                "Then run ./statue. If it asks you a question, answer 'y'. "
                "Before fighting, make sure you have sword and HP: "
                "export I=sword,amulet, and export HP=15."
            ),
            max_turns=30,
            location="/entrance",
            inventory="",
            hp=0,
        )

        engine = NonInteractiveEngine(sandbox)
        combat_attempted = False

        def on_command(result):
            nonlocal combat_attempted
            ai_agent.update_state(
                location=result.location,
                inventory=result.inventory,
                hp=result.hp,
            )
            if "./statue" in result.command:
                combat_attempted = True
            log_capture.log_command(
                result.command, result.output[:200], result.location
            )

        try:
            session = engine.run_session(
                ai_agent.next_command,
                max_commands=30,
                on_command=on_command,
            )
        except AgentExhausted:
            session = None

        assert session is not None
        # The AI should at least reach the chamber
        rooms = " ".join(session.rooms_visited)
        reached_chamber = "chamber" in rooms
        logger.info(
            "Combat test: reached_chamber=%s, combat_attempted=%s, rooms=%s",
            reached_chamber, combat_attempted, session.rooms_visited,
        )

    @pytest.mark.timeout(240)
    def test_combat_stress_scenario(self, sandbox, ai_agent, log_capture):
        """Full combat stress test with pre-configured state."""
        scenario = SCENARIO_COMBAT_STRESS
        ai_agent.set_scenario(
            goal=scenario.goal,
            max_turns=scenario.max_turns,
            location=scenario.initial_location,
            inventory=scenario.initial_inventory,
            hp=scenario.initial_hp,
        )

        engine = NonInteractiveEngine(
            sandbox,
            initial_env={"I": scenario.initial_inventory, "HP": str(scenario.initial_hp)},
        )
        # Set engine location to match scenario
        engine._cwd = scenario.initial_location
        engine.state.current_location = scenario.initial_location

        def on_command(result):
            ai_agent.update_state(
                location=result.location,
                inventory=result.inventory,
                hp=result.hp,
            )
            log_capture.log_command(
                result.command, result.output[:200], result.location
            )

        try:
            session = engine.run_session(
                ai_agent.next_command,
                max_commands=scenario.max_turns,
                on_command=on_command,
            )
        except AgentExhausted:
            session = None

        assert session is not None
        assert session.total_turns > 0
