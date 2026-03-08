from __future__ import annotations

from typing import List, Optional
from .game_state import GameState
from .help_data import Quest, QuestCompletion, load_quests


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
