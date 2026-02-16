from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional
from .game_state import GameState


@dataclass
class Quest:
    id: int
    title: str
    description: str
    objective: str
    required_commands: List[str]
    reward: str
    xp: int = 0
    location_check: str = ""


def _has_used(gs: GameState, command: str) -> bool:
    return command in gs.learned_commands


def quest_list() -> List[Quest]:
    """Load quests from shared YAML data, with hardcoded fallback."""
    try:
        from .help_data import load_quests
        yaml_quests = load_quests()
        return [
            Quest(
                id=q.id,
                title=q.title,
                description=q.description,
                objective=q.objective,
                required_commands=q.required_commands,
                reward=q.reward,
                xp=q.xp,
                location_check=q.location_check,
            )
            for q in yaml_quests
        ]
    except Exception:
        # Fallback to hardcoded quests if YAML fails
        return _hardcoded_quests()


def _hardcoded_quests() -> List[Quest]:
    """Hardcoded quest fallback — kept for resilience."""
    return [
        Quest(
            id=0,
            title="Awakening: Know Thy Place",
            description="You awaken in a strange dungeon. The air hums with arcane energy.",
            objective="Cast the 'pwd' spell to reveal your place in the dungeon.",
            required_commands=["pwd"],
            reward="50 XP and the 'Navigation Novice' ribbon",
            xp=50,
        ),
        Quest(
            id=1,
            title="Eyes to See",
            description="The walls whisper: see what lies around you.",
            objective="Use 'ls' to reveal nearby rooms and scrolls.",
            required_commands=["ls"],
            reward="50 XP and a glimmering lens",
            xp=50,
        ),
        Quest(
            id=2,
            title="First Steps",
            description="A dark passage leads deeper into the dungeon.",
            objective="Use 'cd cellar' to descend into the cellar.",
            required_commands=["cd"],
            reward="100 XP and the Pathwalker's charm",
            xp=100,
            location_check="cellar",
        ),
        Quest(
            id=3,
            title="Ancient Knowledge",
            description="A dusty scroll rests on a stone pedestal.",
            objective="Use 'cat scroll' to read the ancient knowledge.",
            required_commands=["cat"],
            reward="100 XP and a reader's sigil",
            xp=100,
        ),
        Quest(
            id=4,
            title="Shape the World",
            description="The workshop calls — create something new.",
            objective="Navigate to the workshop and use 'mkdir' to create a directory.",
            required_commands=["mkdir"],
            reward="100 XP and a builder's sigil",
            xp=100,
        ),
        Quest(
            id=5,
            title="Spark of Creation",
            description="Your workspace yearns for a first artifact.",
            objective="Use 'touch' to create a new file.",
            required_commands=["touch"],
            reward="100 XP and a scribe's quill",
            xp=100,
        ),
        Quest(
            id=6,
            title="Seek the Whisper",
            description="Hidden phrases linger in old scrolls.",
            objective="Use 'grep' to search for a word within a scroll.",
            required_commands=["grep"],
            reward="150 XP and the Whisperer's token",
            xp=150,
            location_check="armoury|cellar",
        ),
    ]


def check_quest_completion(gs: GameState, current_location: str) -> bool:
    """Check if the current quest's completion criteria are met."""
    quests = quest_list()
    if gs.current_quest_id >= len(quests):
        return False
    q = quests[gs.current_quest_id]

    all_required_used = all(cmd in gs.learned_commands for cmd in q.required_commands)

    # Data-driven location check from YAML location_check field
    if q.location_check and all_required_used:
        # location_check is a pipe-separated list e.g. "armoury|cellar"
        allowed = [loc.strip() for loc in q.location_check.split("|")]
        all_required_used = any(loc in current_location for loc in allowed)

    return all_required_used

