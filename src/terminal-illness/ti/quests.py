from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, List
from .game_state import GameState


@dataclass
class Quest:
    id: int
    title: str
    description: str
    objective: str
    required_commands: List[str]
    reward: str


def _has_used(gs: GameState, command: str) -> bool:
    return command in gs.learned_commands


def quest_list() -> List[Quest]:
    return [
        Quest(
            id=0,
            title="Awakening: Know Thy Place",
            description="You awaken in a strange realm. The ground hums with arcane paths.",
            objective="Cast the 'pwd' spell to reveal your place in the realm.",
            required_commands=["pwd"],
            reward="50 XP and the 'Navigation Novice' ribbon",
        ),
        Quest(
            id=1,
            title="Eyes to See",
            description="The trees whisper: see what lies around you.",
            objective="Use 'ls' to reveal nearby paths and scrolls.",
            required_commands=["ls"],
            reward="50 XP and a glimmering lens",
        ),
        Quest(
            id=2,
            title="First Steps",
            description="A trail leads to your home grove.",
            objective="Use 'cd' to travel to /home/hero.",
            required_commands=["cd"],
            reward="100 XP and the Pathwalker's charm",
        ),
        Quest(
            id=3,
            title="Shape the World",
            description="With focus, you can conjure new places.",
            objective="Use 'mkdir workshop' inside /home/hero.",
            required_commands=["mkdir"],
            reward="100 XP and a builder's sigil",
        ),
        Quest(
            id=4,
            title="Spark of Creation",
            description="Your workshop yearns for a first artifact.",
            objective="Use 'touch notes.txt' inside /home/hero/workshop.",
            required_commands=["touch"],
            reward="100 XP and a scribe's quill",
        ),
        Quest(
            id=5,
            title="Read the Signs",
            description="The artifact holds knowledge. Learn to unveil it.",
            objective="Use 'cat' to read 'notes.txt'.",
            required_commands=["cat"],
            reward="100 XP and a reader's sigil",
        ),
        Quest(
            id=6,
            title="Seek the Whisper",
            description="Hidden phrases linger in old scrolls.",
            objective="Use 'grep Whisper scroll.txt' in /forest.",
            required_commands=["grep"],
            reward="150 XP and the Whisperer's token",
        ),
    ]


def check_quest_completion(gs: GameState, current_location: str) -> bool:
    quests = quest_list()
    if gs.current_quest_id >= len(quests):
        return False
    q = quests[gs.current_quest_id]

    # Basic completion criteria for this MVP
    all_required_used = all(cmd in gs.learned_commands for cmd in q.required_commands)

    if q.id == 2:  # cd to /home/hero
        all_required_used = all_required_used and (current_location == "/home/hero")
    if q.id == 3:  # mkdir workshop in /home/hero
        all_required_used = all_required_used and (current_location == "/home/hero")
    if q.id == 4:  # touch notes.txt in /home/hero/workshop
        all_required_used = all_required_used and (current_location == "/home/hero/workshop")
    if q.id == 6:  # grep in /forest
        all_required_used = all_required_used and (current_location == "/forest")

    return all_required_used

