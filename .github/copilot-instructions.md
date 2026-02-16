# Bashcrawl Copilot Instructions

## Project Overview

Bashcrawl is an educational text-based adventure game that teaches terminal/shell commands through immersive fantasy gameplay. Directories are game rooms, files named `scroll` are educational content, and executable scripts (`treasure`, `potion`, `spell`, etc.) are interactive encounters. No external dependencies beyond standard POSIX shell tools.

## Architecture

### Directory-as-Room Structure
- `entrance/` → `cellar/` → `armoury/` → `chamber/` is the main progression path
- Hidden directories (`.chapel`, `.vault`, `.rift`) at `entrance/` level unlock after treasure collection
- Deep hidden areas: `.chapel/courtyard/aviary/`, `.vault/stronghold/`, `.rift/arena/`, `.rift/spire/`
- Each room teaches 1-3 related terminal concepts with progressive difficulty

### Key Components
| Component | Purpose |
|-----------|---------|
| `main.sh` | Launcher with 7-option interactive menu, CLI args (`--interactive`, `--native`, `--help`) |
| `setup.sh` | Permissions setup, system checks, makes game files executable |
| `bashcrawl-terminal.sh` | Self-contained terminal emulator with quest system (pwd→ls→cd→mkdir→touch→cat→grep) |
| `help/` | Context-aware help system: `bashcrawl_help.sh` detects player location, `ai_engine.sh` tracks progress patterns, `command_suggester.sh` analyzes directory contents |
| `entrance/.functions` | Defines `gameover()` — combat death handler |
| `src/terminal-illness/` | Python reimagining using `prompt_toolkit`/`rich` with in-memory VFS (separate from bash game) |

### Game Content Files
- **`scroll`** — Plain-text educational content (NOT a directory). Format varies by room depth; see `.github/instructions/scrolls.instructions.md` for the target standard
- **`treasure`** — Bash scripts that add items to inventory and unlock hidden rooms
- **`potion`** — Interactive y/n prompts teaching `read`, `export`, variable assignment
- **`spell`** — Teaches `ln -s` (symlinks), creates portals between areas
- **`statue`** — Combat encounter teaching `let`, arithmetic, `rm`, `mv`
- **`ghost`, `monster`** — Enemy encounters in hidden areas

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

**All executables** follow this structure:
1. `#!/usr/bin/env bash` shebang
2. 14-line "wandered out of bounds" boilerplate comment
3. Game state checks (`grep` inventory, test `$HP`)
4. Story output via `cat << EOF` heredocs (plain text, no ANSI colors)
5. Instruct player to run `export` commands
6. Unlock hidden rooms via `mv`

## Build and Test

```bash
# Setup — makes game files executable, validates system
bash setup.sh

# Play via launcher
bash main.sh

# Play directly (native terminal)
cd entrance && cat scroll

# Lint
shellcheck *.sh help/*.sh        # Shell linting (.shellcheckrc disables SC2034, SC2086, SC1091)
# CI also runs: yamllint, markdownlint (max line 120), CodeQL

# Test new content
cd entrance && export I="" && export HP=100
./treasure                       # Test executable
ls -F                            # Verify file type indicators (+x shows *)

# Reset game state
rm -f .game_state logs/bashcrawl.log
```

## Project Conventions

### File Naming
- `scroll` — educational content (plain text, read with `cat`)
- `treasure` — inventory/progression scripts
- `potion`, `spell`, `ghost`, `monster`, `statue` — themed encounters
- Hidden files (`.filename`) for game state and unlockable content
- Fantasy-themed names that hint at functionality

### Shell Script Standards
- `#!/usr/bin/env bash` shebang for all executables
- Infrastructure scripts (`main.sh`, `setup.sh`) use `set -euo pipefail`, `readonly` vars, ANSI color constants, structured logging
- Game executables are simpler — no strict mode, plain text output
- macOS compatibility: `sed -i.bak` instead of `sed -i`, avoid GNU-specific flags
- Auto-detect `ls` color: GNU `--color=auto` vs macOS `-G`

### Scroll Content Standards
- Entrance level: Pure ASCII art with `===` dividers, 80-char width, `cat`-readable
- Intermediate: Unicode box-drawing (`┌─┐`), emojis, `####` headers
- Advanced: Can use Markdown features since players know `cat` by then
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
- **GitHub CI** (`.github/workflows/`) — shellcheck, yamllint, markdownlint, CodeQL on push/PR
- **Game state** — `.game_state` file at root (created by `main.sh`), `~/.bashcrawl_progress` (created by help system)
- **Logging** — `logs/bashcrawl.log` (created by `main.sh`)
- **Terminal Illness** (`src/terminal-illness/`) — Python 3.10+, `pip install -r requirements.txt`, independent quest system with virtual filesystem
