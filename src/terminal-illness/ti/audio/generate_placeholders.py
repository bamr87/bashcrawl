#!/usr/bin/env python3
"""Generate placeholder WAV files for all sound events and music tracks.

These are simple sine-wave tones so the audio system can be tested
without real assets.  Replace them with proper sounds later.

Usage:
    python -m ti.audio.generate_placeholders
"""

from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

ASSETS_DIR = Path(__file__).resolve().parent / "assets"
SFX_DIR = ASSETS_DIR / "sfx"
MUSIC_DIR = ASSETS_DIR / "music"

SAMPLE_RATE = 44100
NCHANNELS = 1
SAMPLE_WIDTH = 2  # 16-bit


def _generate_tone(path: Path, freq: float, duration: float, volume: float = 0.3) -> None:
    """Write a sine-wave WAV file."""
    n_frames = int(SAMPLE_RATE * duration)
    max_amp = int(32767 * volume)

    with wave.open(str(path), "w") as wf:
        wf.setnchannels(NCHANNELS)
        wf.setsampwidth(SAMPLE_WIDTH)
        wf.setframerate(SAMPLE_RATE)
        for i in range(n_frames):
            t = i / SAMPLE_RATE
            # Apply a simple envelope (fade in/out)
            env = 1.0
            fade = 0.05 * SAMPLE_RATE
            if i < fade:
                env = i / fade
            elif i > n_frames - fade:
                env = (n_frames - i) / fade
            sample = int(max_amp * env * math.sin(2 * math.pi * freq * t))
            wf.writeframes(struct.pack("<h", sample))


# SFX: short tones at different pitches to distinguish events
SFX_SPECS: dict[str, tuple[float, float]] = {
    "room_enter":         (330, 0.3),
    "room_unlock":        (440, 0.8),
    "scroll_read":        (294, 0.4),
    "treasure_pickup":    (523, 0.5),
    "combat_start":       (220, 0.6),
    "combat_hit":         (185, 0.2),
    "combat_victory":     (587, 0.7),
    "player_death":       (147, 1.0),
    "potion_drink":       (392, 0.5),
    "spell_cast":         (659, 0.6),
    "quest_complete":     (698, 0.8),
    "command_success":    (880, 0.1),
    "command_error":      (165, 0.2),
    "tab_complete":       (1047, 0.08),
    "merlin_speak":       (784, 0.4),
    "low_health_warning": (200, 0.6),
    "save_game":          (440, 0.3),
    "welcome_fanfare":    (523, 1.2),
}

# Music: longer tones (5 seconds — short placeholders for testing loops)
MUSIC_SPECS: dict[str, float] = {
    "title_theme": 262,
    "entrance":    294,
    "cellar":      220,
    "armoury":     247,
    "chamber":     196,
    "chapel":      330,
    "vault":       185,
    "rift":        175,
    "combat":      349,
}


def main() -> None:
    SFX_DIR.mkdir(parents=True, exist_ok=True)
    MUSIC_DIR.mkdir(parents=True, exist_ok=True)

    print("Generating placeholder SFX…")
    for name, (freq, dur) in SFX_SPECS.items():
        path = SFX_DIR / f"{name}.wav"
        _generate_tone(path, freq, dur)
        print(f"  {path.name}")

    print("Generating placeholder music loops…")
    for name, freq in MUSIC_SPECS.items():
        path = MUSIC_DIR / f"{name}.wav"
        _generate_tone(path, freq, 5.0, volume=0.15)
        print(f"  {path.name}")

    print("Done! Replace these with real assets when ready.")


if __name__ == "__main__":
    main()
