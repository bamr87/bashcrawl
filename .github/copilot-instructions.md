# Bashcrawl Copilot Instructions

## Project Overview

Bashcrawl is an educational text-based adventure game that teaches terminal/shell commands through immersive fantasy gameplay. Directories are game rooms, files named `scroll` are educational content, and executable scripts (`treasure`, `potion`, `spell`, etc.) are interactive encounters. The repo has two player surfaces plus one harness: the pure-bash game under `entrance/` (played with a real shell), the static web trainer in `web/` (built by `scripts/export_static_web.py`), and the MCP playtest harness in `src/playtest/`. Runtime dependencies: standard POSIX shell tools. Python 3.10+ required only for the web export/validation tooling (`scripts/`) and the playtest harness (`src/playtest/`).

## Architecture

### Directory-as-Room Structure

Main progression path: `entrance/` → `cellar/` → `armoury/` → `chamber/`

Hidden areas unlocked by collecting treasures (all rooted at `entrance/`):
- `.chapel/` → `graveyard/`, `courtyard/aviary/hall/library/` — teaches `grep`, `find`, pipes
- `.vault/` → `stronghold/nursery/lab/` — teaches variables, env, process substitution
- `.scrap/` — **directory** (not a file) containing a scroll that teaches `ln -s`
- `.rift/` → `arena/pit/`, `spire/mezzanine/` — advanced scripting, checksums
- `entrance/workshop/` — player-created room (does not exist until player runs `mkdir`)

Each room teaches 1-3 related terminal concepts with progressive difficulty.

### Key Components

| Component | Purpose |
|-----------|---------|
| `setup.sh` | Permissions setup, system checks, makes game files executable. Sources `lib/colors.sh` |
| `help.sh` | Root-level shim delegating to `src/help/bashcrawl_help.sh`. Context-aware: detects player location, tracks progress patterns, suggests next commands |
| `src/help/` | `bashcrawl_help.sh`, `ai_engine.sh`, `command_suggester.sh`, `init_help.sh`. YAML data in `src/help/data/` |
| `lib/` | `colors.sh` (color constants), `log.sh` (JSONL session logging), `yaml_reader.sh` (YAML parsing helpers), `reset.sh` (game-state reset) |
| `entrance/.functions` | Defines `gameover()` (combat death) and `help()` (delegates to `$BASHCRAWL_ROOT/help.sh`) |
| `web/` | Static web trainer (GitHub Pages bundle). Data built from the YAML registries by `scripts/export_static_web.py` (`make web-build`); preview with `make web-preview` |
| `src/playtest/` | Lean MCP playtest harness: `python3 -m playtest.mcp_server` with `PYTHONPATH=src`; sessions scored by `python3 -m playtest.scorer` |

### Game Content Files
- **`scroll`** — Plain-text educational content (NOT a directory). Format varies by depth; see `.github/instructions/scrolls.instructions.md`
- **`treasure`** — Bash scripts: add inventory items, unlock hidden rooms via `mv`
- **`potion`** — Interactive y/n prompts teaching `read`, `export`. Checks `${HP:-0} -gt 0` (not just `-n "$HP"`)
- **`spell`** — Teaches `ln -s`; creates symlink portals between areas
- **`statue`** — Combat teaching `let`/arithmetic. Uses `.statue_defeated` flag — does NOT modify tracked files
- **`ghost`, `monster`** — Enemy encounters in hidden areas
- **`goblet`** — In `.vault/stronghold/`, checks for `orb1` in inventory, unlocks `.rift`

### Game Mechanics

**Inventory** — comma-separated env var:
```bash
export I=amulet,$I           # Add item
grep --quiet amulet <<< "$I" # Check for item
```

**Room unlocking** — rename hidden dirs (may be 2+ levels up):
```bash
mv ../../.chapel ../../chapel 2>/dev/null
```

**Health** — numeric env var:
```bash
export HP=15      # Set by potions
let "HP=HP-5"     # Combat damage
```

**Combat flags** — touch files, never destructive:
```bash
touch .statue_defeated   # Checked on re-entry to skip encounter
```

**All game executables** follow this structure:
1. `#!/usr/bin/env bash` shebang
2. 14-line "wandered out of bounds" boilerplate comment
3. Game state checks (`grep` inventory, test `$HP`)
4. Story output via `cat << EOF` heredocs (plain text, no ANSI colors)
5. Instruct player to run `export` commands (never mutate git-tracked files)
6. Unlock hidden rooms via `mv`

## Build and Test

```bash
# Setup
bash setup.sh              # Make game files executable, validate system

# Play
cd entrance && cat scroll  # Play the game — the filesystem IS the game
make web-preview           # Serve the static web trainer at http://127.0.0.1:8000

# Help
bash help.sh               # Contextual help
bash help.sh commands      # Command reference
bash help.sh map           # Dungeon map
source src/help/init_help.sh  # Enable help() shell function

# Lint
shellcheck *.sh src/help/*.sh lib/*.sh
# .shellcheckrc disables: SC2034 (unused vars), SC2086 (quoting), SC1091 (sourced files), SC2154 (BASHCRAWL_ROOT)
# CI also runs: yamllint (-c .yamllint.yml) and markdownlint (.markdownlint.json)

# Python tests (run from test/)
cd test && pip install -r requirements.txt
pytest -m "unit"                        # Fast deterministic tests
pytest -m "integration"                 # Real filesystem + bash scripts
pytest                                  # Default: unit + integration

# Test game content manually
cd entrance && export I="" && export HP=100
./treasure && ls -F

# Reset game state
bash lib/reset.sh --dry    # Preview
bash lib/reset.sh          # Execute
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
- Infrastructure scripts (`setup.sh`, `help.sh`, `lib/*.sh`) use `set -euo pipefail`, `readonly` vars, shared color constants from `lib/colors.sh`, structured logging via `lib/log.sh`
- Game executables: no strict mode, plain text output, **NEVER modify git-tracked files**
- macOS compatibility: `sed -i.bak` instead of `sed -i`, avoid GNU-specific flags
- Auto-detect `ls` color: `${LS_COLOR_FLAGS[@]}` array set at script init (GNU `--color=auto` vs macOS `-G`)
- Shared code goes in `lib/` — never duplicate color constants or logging helpers

### Scroll Content Standards
- Level 1 (entrance): Pure ASCII, `===` dividers, 80-char width, `cat`-readable — no Unicode, no ANSI
- Level 2 (cellar/armoury): Unicode box-drawing (`┌─┐`), emojis OK, `####` headers
- Level 3 (hidden areas): Markdown features allowed (players know `cat` and pagers by then)
- See [.github/instructions/scrolls.instructions.md](.github/instructions/scrolls.instructions.md) for the full standard
- Emoji conventions: 🗡️ executables, 🏰 directories, 💰 treasures, 📜 scrolls

### Adding New Rooms
1. Create directory under appropriate parent
2. Add `scroll` file matching depth-appropriate format
3. Create executable encounters with `chmod +x`
4. Wire unlock in a prerequisite room's `treasure` script: `mv ../../.newroom ../../newroom`
5. Verify with `bash lib/reset.sh --dry` and test from `entrance/`

## Integration Points

- **GitHub CI** (`.github/workflows/`) — `ci.yml` (shellcheck, yamllint, markdownlint), `game-tests.yml` (scroll/shebang/unlock validation), `pages.yml` (static web build + deploy), `dependency-update.yml`, `blank-slate-audit.yml`
- **Game state** — environment variables (`$I`, `$HP`) plus untracked flag files (e.g. `.statue_defeated`); `~/.bashcrawl_progress` (created by help system)
- **Logging** — JSONL session logs in `logs/sessions/` via `lib/log.sh`
- **Static web trainer** (`web/`) — data exported from the YAML registries by `scripts/export_static_web.py` (`make web-build`), validated with `make web-test`, deployed via `pages.yml`
- **MCP playtest harness** (`src/playtest/`) — run with `PYTHONPATH=src python3 -m playtest.mcp_server`; score sessions with `python3 -m playtest.scorer`; tested via `make test-mcp`
- **Test suite** (`test/`) — pytest with markers: `unit` (fast, no deps), `integration` (real bash), `slow` (>30s), `bash` (needs bash-capable environment). Default run covers unit + integration
