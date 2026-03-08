"""Sound event and music track enums with area-to-track mapping."""

from __future__ import annotations

from enum import Enum


class SoundEvent(Enum):
    """One-shot sound effects triggered by game events."""

    # Exploration
    ROOM_ENTER = "room_enter"
    ROOM_UNLOCK = "room_unlock"
    SCROLL_READ = "scroll_read"

    # Treasure & inventory
    TREASURE_PICKUP = "treasure_pickup"

    # Combat
    COMBAT_START = "combat_start"
    COMBAT_HIT = "combat_hit"
    COMBAT_VICTORY = "combat_victory"
    PLAYER_DEATH = "player_death"

    # Consumables & magic
    POTION_DRINK = "potion_drink"
    SPELL_CAST = "spell_cast"

    # Quest system
    QUEST_COMPLETE = "quest_complete"

    # Command feedback
    COMMAND_SUCCESS = "command_success"
    COMMAND_ERROR = "command_error"
    TAB_COMPLETE = "tab_complete"

    # Merlin
    MERLIN_SPEAK = "merlin_speak"

    # Status
    LOW_HEALTH_WARNING = "low_health_warning"

    # Meta
    SAVE_GAME = "save_game"
    WELCOME_FANFARE = "welcome_fanfare"


class MusicTrack(Enum):
    """Looping background music tracks for dungeon areas."""

    TITLE_THEME = "title_theme"
    ENTRANCE = "entrance"
    CELLAR = "cellar"
    ARMOURY = "armoury"
    CHAMBER = "chamber"
    CHAPEL = "chapel"
    VAULT = "vault"
    RIFT = "rift"
    COMBAT = "combat"


# Maps path fragments (matched with `in`) to ambient music tracks.
# Checked in order — first match wins, so more specific paths come first.
AREA_MUSIC: list[tuple[str, MusicTrack]] = [
    ("rift", MusicTrack.RIFT),
    ("vault", MusicTrack.VAULT),
    ("chapel", MusicTrack.CHAPEL),
    ("chamber", MusicTrack.CHAMBER),
    ("armoury", MusicTrack.ARMOURY),
    ("cellar", MusicTrack.CELLAR),
    ("entrance", MusicTrack.ENTRANCE),
]


def area_track_for(cwd: str) -> MusicTrack:
    """Resolve a game-relative path to the appropriate music track."""
    path_lower = cwd.lower()
    for fragment, track in AREA_MUSIC:
        if fragment in path_lower:
            return track
    return MusicTrack.ENTRANCE


# Maps game script basenames to the sound event(s) they should trigger.
SCRIPT_SOUNDS: dict[str, SoundEvent] = {
    "treasure": SoundEvent.TREASURE_PICKUP,
    "potion": SoundEvent.POTION_DRINK,
    "spell": SoundEvent.SPELL_CAST,
    "goblet": SoundEvent.TREASURE_PICKUP,
}

# Scripts that trigger combat — combat start plays immediately, then
# victory or death is determined by HP after the script completes.
COMBAT_SCRIPTS: set[str] = {"statue", "monster", "ghost"}
