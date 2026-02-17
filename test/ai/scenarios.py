"""AI test scenario definitions.

Each scenario describes a test goal, constraints, and expected outcomes
that the AI agent should achieve during a playthrough.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ExpectedEvent:
    """An event that must appear in the session log."""

    event_type: str
    required_fields: dict[str, Any] = field(default_factory=dict)
    description: str = ""


@dataclass
class Scenario:
    """Defines an AI test playthrough scenario."""

    name: str
    goal: str
    max_turns: int
    description: str = ""
    initial_location: str = "/entrance"
    initial_inventory: str = ""
    initial_hp: int = 0
    expected_events: list[ExpectedEvent] = field(default_factory=list)
    expected_rooms: list[str] = field(default_factory=list)
    expected_items: list[str] = field(default_factory=list)
    expected_quests_completed: int = 0
    min_rooms_visited: int = 0
    max_deaths: int = -1  # -1 = no limit
    tags: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Predefined scenarios
# ---------------------------------------------------------------------------


SCENARIO_NEW_PLAYER = Scenario(
    name="new_player",
    goal=(
        "You are a brand-new player. Learn the basics: use pwd to see where you are, "
        "ls to look around, cat scroll to read the scroll, then cd cellar to go deeper. "
        "In the cellar, read the scroll and run ./treasure."
    ),
    max_turns=30,
    description="A beginner learning pwd, ls, cd, cat in entrance and cellar",
    expected_rooms=["entrance", "cellar"],
    expected_items=["amulet"],
    expected_quests_completed=4,
    min_rooms_visited=2,
    max_deaths=0,
    tags=["quick", "beginner"],
    expected_events=[
        ExpectedEvent("room_enter", {"room": "entrance"}, "Visited entrance"),
        ExpectedEvent("room_enter", {"room": "cellar"}, "Descended to cellar"),
        ExpectedEvent("encounter", {"type": "treasure"}, "Found treasure"),
    ],
)


SCENARIO_CRITICAL_PATH = Scenario(
    name="critical_path",
    goal=(
        "Follow the main game path: entrance → cellar (collect amulet via ./treasure) "
        "→ armoury (collect sword via ./treasure, drink potion via ./potion answering 'y') "
        "→ chamber (defeat statue via ./statue answering 'y', collect treasure via ./treasure). "
        "After each script, follow its instructions to export variables."
    ),
    max_turns=60,
    description="Main progression path through the critical dungeon rooms",
    expected_rooms=["entrance", "cellar", "armoury", "chamber"],
    expected_items=["amulet", "sword"],
    min_rooms_visited=4,
    tags=["medium", "progression"],
    expected_events=[
        ExpectedEvent("encounter", {"type": "treasure", "item": "amulet"}),
        ExpectedEvent("encounter", {"type": "treasure", "item": "sword"}),
        ExpectedEvent("encounter", {"type": "potion"}),
    ],
)


SCENARIO_FULL_PLAYTHROUGH = Scenario(
    name="full_playthrough",
    goal=(
        "Complete the entire game. Path: entrance → cellar (./treasure for amulet) → "
        "armoury (./treasure for sword, ./potion answering 'y' for HP) → chamber "
        "(./statue answering 'y' to fight, ./treasure for coins). "
        "Then explore hidden rooms: chapel, vault, scrap. "
        "In vault/stronghold, copy orb1 to orb2 and orb3, then run ./goblet. "
        "Finally explore .rift to find the pit treasure. "
        "Always read scrolls and follow export instructions from scripts."
    ),
    max_turns=150,
    description="Full game completion from entrance to .rift endgame",
    expected_rooms=[
        "entrance", "cellar", "armoury", "chamber",
        "chapel", "vault", "stronghold", "rift",
    ],
    expected_items=["amulet", "sword"],
    min_rooms_visited=8,
    tags=["slow", "full"],
    expected_events=[
        ExpectedEvent("encounter", {"type": "treasure", "item": "amulet"}),
        ExpectedEvent("encounter", {"type": "potion"}),
        ExpectedEvent("encounter", {"type": "statue"}),
    ],
)


SCENARIO_STUCK_PLAYER = Scenario(
    name="stuck_player",
    goal=(
        "You are confused and don't know what to do. Try various commands, "
        "get lost, make mistakes. Use the help command frequently. "
        "Eventually find your way to the cellar."
    ),
    max_turns=50,
    description="Tests help system usage when player is struggling",
    min_rooms_visited=1,
    tags=["medium", "help"],
    expected_events=[
        ExpectedEvent("help_request", {}, "Used help system at least once"),
    ],
)


SCENARIO_COMBAT_STRESS = Scenario(
    name="combat_stress",
    goal=(
        "Navigate to the chamber and fight the statue. If you die, "
        "restart from armoury: drink potion (export HP=15), export your sword "
        "(export I=sword), then try ./statue again answering 'y'. "
        "After defeating the statue, explore chapel → courtyard → aviary → hall "
        "and fight the monster."
    ),
    max_turns=80,
    description="Stress-test combat encounters with death and retry",
    initial_inventory="amulet,sword,",
    initial_hp=15,
    initial_location="/entrance/cellar/armoury",
    expected_rooms=["armoury", "chamber"],
    min_rooms_visited=2,
    tags=["medium", "combat"],
    expected_events=[
        ExpectedEvent("encounter", {"type": "statue"}),
    ],
)


SCENARIO_SPEED_RUN = Scenario(
    name="speed_run",
    goal=(
        "Complete the game as fast as possible with minimum commands. "
        "Skip reading scrolls unless needed. Go straight: "
        "cd cellar → ./treasure → export I=amulet,$I → cd armoury → "
        "./treasure → export I=sword,$I → ./potion (y) → export HP=15 → "
        "cd chamber → ./statue (y) → ./treasure. "
        "Do not explore optional rooms."
    ),
    max_turns=40,
    description="Minimum-command completion of core path",
    expected_rooms=["cellar", "armoury", "chamber"],
    expected_items=["amulet"],
    min_rooms_visited=3,
    max_deaths=0,
    tags=["quick", "speed"],
)


# Registry of all scenarios
ALL_SCENARIOS: dict[str, Scenario] = {
    s.name: s
    for s in [
        SCENARIO_NEW_PLAYER,
        SCENARIO_CRITICAL_PATH,
        SCENARIO_FULL_PLAYTHROUGH,
        SCENARIO_STUCK_PLAYER,
        SCENARIO_COMBAT_STRESS,
        SCENARIO_SPEED_RUN,
    ]
}


def get_scenario(name: str) -> Scenario:
    """Get a scenario by name."""
    if name not in ALL_SCENARIOS:
        available = ", ".join(ALL_SCENARIOS.keys())
        raise KeyError(f"Unknown scenario '{name}'. Available: {available}")
    return ALL_SCENARIOS[name]
