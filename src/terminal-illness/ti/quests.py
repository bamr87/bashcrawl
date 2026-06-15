from __future__ import annotations

from typing import List, Optional
from .game_state import GameState
from .help_data import Quest, QuestCompletion, load_quests


def _hardcoded_quests() -> List[Quest]:
    """Return the hardcoded fallback quest list (8 quests).

    Canonical source of truth: ``src/help/data/quests.yaml``.
    This fallback is used only when the YAML file is unavailable (e.g., in
    isolated unit tests or offline environments).  Keep values in sync with
    quests.yaml whenever that file changes.
    """
    return [
        Quest(id=0, title="Awakening: Know Thy Place",
              description="You awaken in a strange dungeon.",
              objective="Cast the 'pwd' spell to reveal your place.",
              hint="Type 'pwd' and press Enter.",
              required_commands=["pwd"],
              completion=QuestCompletion(command="pwd"),
              reward="50 XP and the 'Navigation Novice' ribbon",
              xp=50),
        Quest(id=1, title="Eyes to See",
              description="The walls whisper: see what lies around you.",
              objective="Use 'ls' to reveal nearby rooms and scrolls.",
              hint="Try 'ls' to survey the room.",
              required_commands=["ls"],
              completion=QuestCompletion(command="ls"),
              reward="50 XP and a glimmering lens",
              xp=50),
        Quest(id=2, title="First Steps",
              description="A dark passage leads deeper into the dungeon.",
              objective="Use 'cd cellar' to descend.",
              hint="Use 'cd cellar'.",
              required_commands=["cd"],
              completion=QuestCompletion(command="cd", location="cellar"),
              reward="100 XP and the Pathwalker's charm",
              xp=100, location_check="cellar"),
        Quest(id=3, title="Ancient Knowledge",
              description="A dusty scroll rests on a stone pedestal.",
              objective="Use 'cat scroll' to read the ancient knowledge.",
              hint="Try 'cat scroll'.",
              required_commands=["cat"],
              completion=QuestCompletion(command="cat", args="scroll"),
              reward="100 XP and a reader's sigil",
              xp=100),
        Quest(id=4, title="Shape the World",
              description="The workshop calls — create something new.",
              objective="Return to the entrance with 'cd ..', then use "
                        "'mkdir workshop' to conjure a new room.",
              hint="From the cellar, 'cd ..' returns to the entrance; then "
                   "'mkdir workshop', then 'cd workshop' to enter.",
              required_commands=["mkdir"],
              completion=QuestCompletion(command="mkdir"),
              reward="100 XP and a builder's sigil",
              xp=100),
        Quest(id=5, title="Spark of Creation",
              description="Your workspace yearns for a first artifact.",
              objective="Use 'touch' to create a new file, for example "
                        "'touch notes.md'.",
              hint="Use 'touch notes.txt'.",
              required_commands=["touch"],
              completion=QuestCompletion(command="touch"),
              reward="100 XP and a scribe's quill",
              xp=100),
        Quest(id=6, title="Seek the Whisper",
              description="Hidden phrases linger in old scrolls.",
              objective="In a room that has a scroll (like the cellar), use "
                        "'grep' to search it, e.g. 'grep magic scroll'.",
              hint="Run 'grep catacombs scroll'.",
              required_commands=["grep"],
              completion=QuestCompletion(command="grep",
                                         location="armoury|cellar"),
              reward="150 XP and the Whisperer's token",
              xp=150, location_check="armoury|cellar"),
        Quest(id=7, title="The Bashcrawl Grimoire",
              description="Deep in the chapel library, a tome guards a secret.",
              objective="Find the hidden study, run the grimoire.",
              hint="Find the library, read the tome, then source the grimoire.",
              required_commands=["source"],
              completion=QuestCompletion(command="source",
                                         location="study|help",
                                         item_check="amulet,coins"),
              reward="200 XP and the Scriptorium Key",
              xp=200, location_check="study|help"),
    ]


def quest_list() -> List[Quest]:
    """Load quests from shared YAML data (single source of truth)."""
    return load_quests()


def check_quest_completion(gs: GameState, current_location: str) -> bool:
    """Check if the current quest's completion criteria are met.

    Uses the structured ``completion`` block from quests.yaml when available,
    falling back to the legacy ``required_commands`` + ``location_check``
    approach for backward compatibility.
    """
    quests = quest_list()
    if gs.current_quest_id >= len(quests):
        return False
    q = quests[gs.current_quest_id]

    # All required commands must have been used at least once
    all_required_used = all(cmd in gs.learned_commands for cmd in q.required_commands)
    if not all_required_used:
        return False

    # Structured completion criteria (preferred path)
    if q.completion:
        comp = q.completion

        # Location check from completion block
        if comp.location:
            allowed = [loc.strip() for loc in comp.location.split("|")]
            if not any(loc in current_location for loc in allowed):
                return False

        # Item check from completion block
        if comp.item_check:
            required_items = [i.strip() for i in comp.item_check.split(",")]
            inv = gs.inventory.split(",") if gs.inventory else []
            if not all(item in inv for item in required_items):
                return False

        return True

    # Legacy fallback: location_check field
    if q.location_check:
        allowed = [loc.strip() for loc in q.location_check.split("|")]
        if not any(loc in current_location for loc in allowed):
            return False

    return True
