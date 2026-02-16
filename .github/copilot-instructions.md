# Bashcrawl Copilot Instructions

## Project Overview

Bashcrawl is an educational text-based adventure game that teaches terminal/shell commands through immersive fantasy gameplay. Directories are game rooms, files named `scroll` are educational content, and executable scripts (`treasure`, `potion`, `spell`, etc.) are interactive encounters. Runtime dependencies: standard POSIX shell tools. Python 3.10+ required only for `src/terminal-illness/`.

## Architecture

### Directory-as-Room Structure
- `entrance/` → `cellar/` → `armoury/` → `chamber/` is the main progression path
- Hidden directories (`.chapel`, `.vault`, `.scrap`, `.rift`) at `entrance/` level unlock after treasure collection
- `.scrap` is a **directory** (not a file) containing a scroll that teaches symlinks (`ln -s`)
- Deep hidden areas: `.chapel/courtyard/aviary/hall/`, `.vault/stronghold/`, `.rift/arena/`, `.rift/spire/`
- `entrance/workshop/` is a tutorial room teaching `mkdir`, `touch`, `rm`, `cp`, `echo >`
- Each room teaches 1-3 related terminal concepts with progressive difficulty

### Key Components
| Component | Purpose |
|-----------|---------|
| `main.sh` | Launcher with interactive menu, CLI args, and integrated terminal emulator with quest system (pwd→ls→cd→mkdir→touch→cat→grep). Sources `lib/colors.sh` and `lib/log.sh`. Supports `-c`, `--batch`, `--interactive` modes |
| `setup.sh` | Permissions setup, system checks, makes game files executable. Sources `lib/colors.sh` |
| `help.sh` | Root-level help shim that delegates to `src/help.sh`. Sources `src/help/bashcrawl_help.sh` and `lib/colors.sh` |
| `src/help/` | Context-aware help system: `bashcrawl_help.sh` detects player location, `ai_engine.sh` tracks progress patterns, `command_suggester.sh` analyzes directory contents, `init_help.sh` defines `help()` shell function. Shared YAML data in `src/help/data/` |
| `lib/` | Shared libraries: `colors.sh` (color constants), `log.sh` (JSONL session logging), `reset.sh` (game reset), `analyze.sh`/`report.sh` (session analysis) |
| `entrance/.functions` | Defines `gameover()` — combat death handler, `help()` — delegates to `$BASHCRAWL_ROOT/help.sh` |
| `src/terminal-illness/` | Python wrapper using `prompt_toolkit`/`rich` — intended to wrap real bash game directories (refactor in progress) |

### Game Content Files
- **`scroll`** — Plain-text educational content (NOT a directory). Format varies by room depth; see `.github/instructions/scrolls.instructions.md` for the target standard
- **`treasure`** — Bash scripts that add items to inventory and unlock hidden rooms
- **`potion`** — Interactive y/n prompts teaching `read`, `export`, variable assignment. Checks `${HP:-0} -gt 0` (not just `-n "$HP"`)
- **`spell`** — Teaches `ln -s` (symlinks), creates portals between areas
- **`statue`** — Combat encounter teaching `let`, arithmetic. Uses `.statue_defeated` flag file — does NOT modify tracked files (no `rm`, `mv`, or `perl -i`)
- **`ghost`, `monster`** — Enemy encounters in hidden areas
- **`goblet`** — In `.vault/stronghold/`, checks for orb, unlocks `.rift`

### Game Mechanics

**Inventory** — comma-separated env var:
```bash
export I=amulet,$I          # Add item
grep --quiet amulet <<< "$I" # Check for item
```

**Room unlocking** — rename hidden dirs (note: may go 2+ levels up):
```bash
mv ../../.chapel ../../chapel 2>/dev/null
```

**Health** — numeric env var:
```bash
export HP=15                 # Set by potions
let "HP=HP-5"               # Combat damage
```

**Combat flags** — touch files instead of destructive operations:
```bash
touch .statue_defeated       # Flag file, checked on re-entry
```

**All executables** follow this structure:
1. `#!/usr/bin/env bash` shebang
2. 14-line "wandered out of bounds" boilerplate comment
3. Game state checks (`grep` inventory, test `$HP`)
4. Story output via `cat << EOF` heredocs (plain text, no ANSI colors)
5. Instruct player to run `export` commands (never mutate git-tracked files)
6. Unlock hidden rooms via `mv`

## Build and Test

```bash
# Setup — makes game files executable, validates system
bash setup.sh

# Play via launcher
bash main.sh

# Play directly (native terminal)
cd entrance && cat scroll

# Help system
bash help.sh                    # Show help
bash help.sh commands           # Command reference
bash help.sh map                # Dungeon map
source src/help/init_help.sh     # Enable help() shell function

# Lint
shellcheck *.sh src/help/*.sh lib/*.sh   # Shell linting (.shellcheckrc disables SC2034, SC2086, SC1091)
# CI also runs: yamllint, markdownlint (max line 120), CodeQL (Python only)

# Test new content
cd entrance && export I="" && export HP=100
./treasure                       # Test executable
ls -F                            # Verify file type indicators (+x shows *)

# Reset game state
bash lib/reset.sh --dry          # Preview reset actions
bash lib/reset.sh                # Execute reset
```

## Project Conventions

### File Naming
- `scroll` — educational content (plain text, read with `cat`)
- `treasure` — inventory/progression scripts
- `potion`, `spell`, `ghost`, `monster`, `statue`, `goblet` — themed encounters
- Hidden files/directories (`.filename`) for game state and unlockable content
- Fantasy-themed names that hint at functionality

### Shell Script Standards
- `#!/usr/bin/env bash` shebang for all executables
- Infrastructure scripts (`main.sh`, `setup.sh`, `help.sh`) use `set -euo pipefail`, `readonly` vars, shared color constants from `lib/colors.sh`, structured logging via `lib/log.sh`
- Game executables are simpler — no strict mode, plain text output, NEVER modify git-tracked files
- macOS compatibility: `sed -i.bak` instead of `sed -i`, avoid GNU-specific flags
- Auto-detect `ls` color: `${LS_COLOR_FLAGS[@]}` array set at script init (GNU `--color=auto` vs macOS `-G`)
- Shared code goes in `lib/` — do not duplicate color constants or utility functions

### Scroll Content Standards
- Entrance level (Level 1): Pure ASCII art with `===` dividers, 80-char width, `cat`-readable
- Intermediate (Level 2): Unicode box-drawing (`┌─┐`), emojis, `####` headers
- Advanced (Level 3): Can use Markdown features since players know `cat` by then
- See `.github/instructions/scrolls.instructions.md` for comprehensive formatting guide
- Emoji conventions: 🗡️ executables, 🏰 directories, 💰 treasures, 📜 scrolls

### Adding New Rooms
1. Create directory under appropriate parent
2. Add `scroll` file with educational content matching depth-appropriate format
3. Create executable encounters with `chmod +x`
4. Wire unlock mechanism in a prerequisite room's treasure script (`mv ../../.newroom ../../newroom`)
5. Test the full path from `entrance/`

## Integration Points

- **Binder** (`.binder/`) — online play without local install
- **GitHub CI** (`.github/workflows/`) — `ci.yml` (shellcheck, yamllint, markdownlint), `code-quality.yml` (CodeQL Python), `game-tests.yml` (scroll/shebang/unlock validation), `release.yml`, `dependency-update.yml`
- **Game state** — `.game_state` file at root (created by `main.sh`), `~/.bashcrawl_progress` (created by help system)
- **Logging** — JSONL session logs in `logs/sessions/` (created by `lib/log.sh`), feedback in `logs/feedback/`
- **Terminal Illness** (`src/terminal-illness/`) — Python 3.10+, `pip install -r requirements.txt`, being refactored from in-memory VFS to real-filesystem wrapper around bash game directories
