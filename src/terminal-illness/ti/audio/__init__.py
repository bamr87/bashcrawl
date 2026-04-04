"""Bashcrawl audio subsystem — SFX and background music.

Usage::

    from ti.audio import SoundManager, SoundEvent, MusicTrack

    audio = SoundManager()          # no-op if miniaudio unavailable
    audio.play_sfx(SoundEvent.TREASURE_PICKUP)
    audio.play_music(MusicTrack.CELLAR)
"""

from .events import AREA_MUSIC, COMBAT_SCRIPTS, SCRIPT_SOUNDS, MusicTrack, SoundEvent, area_track_for
from .manager import SoundManager

__all__ = [
    "SoundManager",
    "SoundEvent",
    "MusicTrack",
    "AREA_MUSIC",
    "COMBAT_SCRIPTS",
    "SCRIPT_SOUNDS",
    "area_track_for",
]
