# Bashcrawl Audio Assets

This directory contains sound effects and music for the Terminal Illness TUI.

## Directory Structure

```
assets/
├── sfx/           # One-shot sound effects (< 3 seconds)
│   ├── *.wav      # WAV or OGG format
│   └── *.ogg
└── music/         # Looping ambient tracks (30–90 seconds)
    ├── *.wav
    └── *.ogg
```

## Asset Format

- **Preferred format**: WAV (uncompressed, best compatibility) or OGG Vorbis
- **SFX**: Mono or stereo, 44100 Hz, 16-bit, < 3 seconds
- **Music**: Stereo, 44100 Hz, 16-bit, 30–90 seconds, designed to loop seamlessly

## Sound Events (SFX)

| File | Trigger | Description |
|------|---------|-------------|
| `treasure_pickup` | `./treasure` script | Coins jingling, gem sparkle |
| `quest_complete` | Quest advancement | Triumphant fanfare, short and bright |
| `combat_start` | `./statue`, `./monster`, `./ghost` | Sword unsheathing, dramatic sting |
| `combat_hit` | HP damage during combat | Impact, thud |
| `combat_victory` | Enemy defeated | Victory horn, achievement chime |
| `player_death` | HP reaches 0 | Dark, somber tone |
| `potion_drink` | `./potion` script | Liquid gulping, magical shimmer |
| `spell_cast` | `./spell` script | Arcane whoosh, energy crackle |
| `room_enter` | `cd` to new directory | Footsteps on stone, door creak |
| `room_unlock` | Hidden room revealed via `mv` | Stone grinding, mechanical click |
| `scroll_read` | `cat scroll` | Paper unfurling, ancient whisper |
| `command_success` | Successful command | Subtle click/chime |
| `command_error` | Unknown/failed command | Dull thud, buzz |
| `tab_complete` | Tab completion | Soft tick |
| `merlin_speak` | Merlin chat opens | Mystical chime, crystal bell |
| `low_health_warning` | HP drops below 20 | Heartbeat, warning pulse |
| `save_game` | Save progress | Quill scratch, confirmation tone |
| `welcome_fanfare` | Game startup | Dungeon ambience + heroic swell |

## Music Tracks

| File | Area | Mood |
|------|------|------|
| `title_theme` | Welcome screen | Epic, mysterious, inviting |
| `entrance` | `entrance/` | Soft, exploratory, mysterious |
| `cellar` | `cellar/` | Deeper tones, dripping water, echoes |
| `armoury` | `armoury/` | Metallic tension, forge ambience |
| `chamber` | `chamber/` | Ominous, spiritual, ancient |
| `chapel` | `.chapel/` and children | Choral, ethereal, sacred |
| `vault` | `.vault/` and children | Dark industrial, heavy, secretive |
| `rift` | `.rift/` and children | Chaotic, intense, otherworldly |
| `combat` | During combat scripts | Urgent percussion, battle drums |

## Generating Assets with AI

### Sound Effects (ElevenLabs Sound Effects API)

```python
# Example using ElevenLabs Sound Effects API
from elevenlabs.client import ElevenLabs
client = ElevenLabs(api_key="your_key")

result = client.text_to_sound_effects.convert(
    text="fantasy treasure chest opening with coins jingling and gem sparkle",
    duration_seconds=2.0,
)
# Save to assets/sfx/treasure_pickup.wav
```

### Music (Stable Audio / Suno)

Use prompts like:
- *"Dark dungeon ambient music, medieval fantasy, dripping water, echoing stone corridors, low rumbling, 60 seconds, seamless loop"*
- *"Epic battle drums, urgent percussion, fantasy combat music, orchestral tension, 45 seconds, seamless loop"*
- *"Ethereal chapel choir, sacred ambient, crystal bells, holy magic, fantasy game music, 60 seconds, seamless loop"*

### Meta AudioCraft (Open Source)

```python
from audiocraft.models import MusicGen
model = MusicGen.get_pretrained("facebook/musicgen-small")
model.set_generation_params(duration=60)
wav = model.generate(["dark fantasy dungeon ambient, medieval, mysterious"])
```

## License

When generating or sourcing assets:
- AI-generated audio: Check the specific tool's license terms
- OpenGameArt.org: CC0 / CC-BY assets available
- Freesound.org: CC0 / CC-BY assets (check per-file)

Document the source and license for each asset file used.
