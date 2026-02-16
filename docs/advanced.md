# Advanced Topics

## Hidden Area Map

After unlocking hidden rooms, the full dungeon structure looks like this:

```
entrance/
├── cellar/armoury/chamber/        Main path (4 rooms)
├── workshop/                      Side room: mkdir, touch, rm, redirection
├── chapel/                        Hidden area 1
│   └── courtyard/
│       └── aviary/
│           └── hall/              Monster combat (dice-roll system)
│               └── library/       Contains a tome
├── vault/                         Hidden area 2
│   ├── stronghold/
│   │   ├── orb1                   Copy this to make orb2 and orb3
│   │   └── goblet                 Requires all 3 orbs; unlocks rift
│   └── stronghold/nursery/
│       └── lab/                   Ghost encounter
├── scrap/                         Hidden area 3: symlink tutorial
└── rift/                          Hidden area 4 (unlocked by goblet)
    ├── arena/pit/                 Advanced combat
    └── spire/mezzanine/           Elevator puzzle
```

## Adding New Rooms

1. Create a directory under the appropriate parent
2. Add a `scroll` file with educational content (see format below)
3. Create executable encounters with `chmod +x`
4. Wire the unlock in a prerequisite room's treasure: `mv ../../.newroom ../../newroom`
5. Add reset logic in `lib/reset.sh`
6. Test from entrance: `bash lib/reset.sh && cd entrance && cat scroll`

## Scroll Format Standards

Scrolls follow a depth-based format hierarchy defined in
`.github/instructions/scrolls.instructions.md`:

### Level 1 — Entrance (Pure ASCII)

```
================================================================================
                           SCROLL TITLE
================================================================================

Content uses === dividers, 80-char width, plain ASCII only.
No Markdown, no Unicode. Must be readable with cat.

COMMAND            PURPOSE
--------           --------
ls                 See room contents

================================================================================
```

### Level 2 — Intermediate (Unicode + Emoji)

```
################################################################################
#                         CHAMBER NAME                                        #
################################################################################

Content uses Unicode box-drawing (┌─┐), emoji, and
structured tables. Players know cat by this point.

┌───────────┬──────────────────────┐
│ COMMAND   │ PURPOSE              │
│ chmod +x  │ Make executable      │
└───────────┴──────────────────────┘
```

### Level 3 — Advanced (Full formatting)

Complex layouts, ANSI color hints, nested structures. Used for deep hidden areas.

## Executable Encounter Template

All game executables follow this structure:

```bash
#!/usr/bin/env bash
#
# If you are reading this, you have wandered out of bounds
# and are reading the code that drives the game.
#
#                    Congratulations!
#
# Learning Linux is all about curiosity, so read this code and see
# if you can figure out what it does.
#
# When you're ready to continue playing the game, though, stick to
# the scrolls. If you're stuck, go to Gitlab and create an issue.
# We're happy to provide hints.
#

# Game state checks (grep inventory, test $HP)
# Story output via cat << EOF heredocs
# Instruct player to run export commands
# Unlock hidden rooms via mv
```

Key rules:
- Use `cat << EOF` heredocs for story text — no ANSI colors
- Check inventory with `grep --quiet --only-matching 'item' <<< "$I"`
- Use `touch .flag_name` for state flags instead of renaming/deleting files
- Unlock rooms with `mv ../../.hidden ../../visible 2>/dev/null`

## Architecture

| Component | Purpose |
|-----------|---------|
| `main.sh` | Interactive launcher with menu system and integrated terminal emulator |
| `setup.sh` | Permissions setup, system validation |
| `help.sh` | Context-aware help entry point |
| `help/` | Help shim that delegates to `src/help.sh` |
| `src/help/` | Help engine components (AI tracking, tutorials, shared YAML data) |
| `lib/colors.sh` | Shared ANSI color constants |
| `lib/log.sh` | JSONL gameplay telemetry |
| `lib/reset.sh` | Comprehensive game state reset |
| `entrance/.functions` | Defines `gameover()` and `help()` functions |
| `src/terminal-illness/` | Python wrapper with Rich UI and quest system |

## Python Wrapper (terminal-illness)

The Python project at `src/terminal-illness/` wraps the real bash game with:
- Rich terminal panels and colorful output
- Quest progression tracking (pwd → ls → cd → mkdir → touch → cat → grep)
- Tab completion for game files and directories
- Persistent save/load via JSON

```bash
cd src/terminal-illness
pip install -r requirements.txt
python -m ti
```
