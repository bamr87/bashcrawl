# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bashcrawl (v3.0.0) is an educational text-based adventure game that teaches POSIX terminal
commands through fantasy dungeon-crawl gameplay. The core game is **the filesystem itself**:
directories are rooms, files named `scroll` are educational content, and executable scripts
(`treasure`, `potion`, `spell`, `statue`, `ghost`, `monster`, `goblet`) are interactive encounters.

Two layers coexist:
- **The bash game** (`entrance/`, `lib/`, root `*.sh`) — pure POSIX shell, no dependencies beyond
  standard tools. This is what players navigate with real `cd`/`ls`/`cat`/`grep`.
- **The Python tooling** (`src/terminal-illness/`, `src/viewer/`, `scripts/`, `test/`) — a Textual
  TUI, Flask log viewer, MCP server, and pytest suite that wrap and validate the bash game.
  Requires Python 3.10+.

## Commands

The `Makefile` is the canonical task runner. It exports `BASHCRAWL_ROOT` and the correct
`PYTHONPATH` automatically — prefer `make` targets over invoking tools directly.

```bash
make help              # List all targets
make setup             # First-time game setup (bash setup.sh --quick)
make install-deps      # pip install requirements.txt + requirements-dev.txt
                       # (or: python3 -m pip install -e ".[dev]")

# Testing — runs pytest from within test/ with markers
make test              # unit + integration (the default suite; skips ai + demo)
make test-unit         # unit only (fast, no LLM, no subprocess)
make test-integration  # integration only (real bash + filesystem)
make test-ai           # AI playthrough tests — requires ANTHROPIC_API_KEY
make test-demo         # demo walkthroughs that regenerate doc artifacts
make test-mcp          # MCP integration tests in a local .venv
make test-all          # everything including ai + demo

# Linting
make lint              # shellcheck + yamllint + markdownlint (+ ruff if installed)
make lint-shell        # shellcheck only

# Content contracts & generated docs (see Content Contracts below)
make validate-contracts    # validate registries, walkthrough FS, runtime commands
make generate-contract-docs

# Static web bundle (GitHub Pages)
make web-build         # export_static_web.py -> web/ data
make web-test          # build + validate static bundle
make web-preview       # serve web/ at http://127.0.0.1:8000

# Maintenance
make clean             # reset game state to defaults
make clean-all         # also remove logs/sessions, screenshots, save files

# Docker (docker compose)
make docker-build docker-game docker-tui docker-viewer docker-web docker-test docker-lint
```

### Running a single test

Tests must run from the `test/` directory (that's where `pytest.ini` lives and how
`scripts/run_tests.sh` invokes them). Set `PYTHONPATH` if not using `make`:

```bash
cd test
export PYTHONPATH="$PWD/../src/terminal-illness:$PWD/../src:$PWD"
export BASHCRAWL_ROOT="$PWD/.."
python3 -m pytest unit/test_quests.py -v                 # one file
python3 -m pytest unit/test_quests.py::test_name -v      # one test
python3 -m pytest -m "unit and not slow" -v              # by marker
```

Markers (declared in `test/pytest.ini`): `unit`, `integration`, `ai` (needs `ANTHROPIC_API_KEY`),
`demo`, `slow` (>30s), `textual` (needs TUI runtime), `bash`. The default `addopts` is
`-m "not ai and not demo" --timeout=60`. Test tree mirrors markers: `test/unit/`,
`test/integration/`, `test/ai/`, `test/demo/`, with shared helpers in `test/fixtures/`.

### Playing / inspecting the game directly

```bash
bash main.sh                       # Interactive launcher (menu, multiple modes)
cd entrance && cat scroll          # Classic native play
bash help.sh                       # Contextual help; also: help.sh commands | map
bash main.sh --agent               # Headless Textual TUI, READY> protocol + SVG screenshots
bash main.sh --agent-bash          # Bash-only REPL for agents
bash lib/reset.sh --dry            # Preview a game-state reset (always dry-run first)
```

`main.sh` modes include `-c <cmd>`, `--batch`, `--interactive`, `--agent`, `--agent-bash`.
See `docs/agent-protocol.md` for the agent prompt protocol.

## Architecture

### Directory-as-Room map

Main path: `entrance/` → `cellar/` → `armoury/` → `chamber/`.

Hidden areas (all rooted under `entrance/`) are unlocked by collecting treasures, which `mv`
a dotted directory to its visible name:
- `.chapel/` → `graveyard/`, `courtyard/{aviary,hall,library}/` — `grep`, `find`, pipes
- `.vault/` → `stronghold/{nursery,lab}/` — variables, env, process substitution
- `.scrap/` — a **directory** (not a file) whose scroll teaches `ln -s`
- `.rift/` → `arena/pit/`, `spire/mezzanine/` — advanced scripting, checksums
- `entrance/workshop/` — does not exist until the player runs `mkdir` (player-created room)

### Key components

| Component | Purpose |
|-----------|---------|
| `main.sh` | Launcher + embedded quest flow (pwd→ls→cd→mkdir→touch→cat→grep). Sources `lib/colors.sh`, `lib/log.sh`. |
| `setup.sh` | Permissions/system checks; makes game files executable. |
| `help.sh` | Root shim that `exec`s `src/help.sh` (which sources `src/help/bashcrawl_help.sh`); context-aware (detects location, tracks progress). |
| `src/help/` | Help engine (`bashcrawl_help.sh`, `ai_engine.sh`, `command_suggester.sh`, `init_help.sh`); YAML data in `src/help/data/`. |
| `lib/` | Shared shell libs: `colors.sh`, `log.sh` (JSONL logging), `reset.sh`, `state.sh`, `quests.sh`, `room_loader.sh`, `analyze.sh`, `report.sh`, etc. |
| `entrance/.functions` | Defines `gameover()` (combat death) and `help()` (delegates to `$BASHCRAWL_ROOT/help.sh`). |
| `src/terminal-illness/ti/` | Python Textual TUI. `app.py`/`BashcrawlApp`, `terminal_engine.py` (`execute()`, `get_completions()`), `agent.py` (headless), `mcp_server.py`, `web.py`. |
| `src/viewer/` | Flask app browsing JSONL session logs in `logs/sessions/`. |
| `scripts/` | Validators (`validate_*`), generators (`generate_*`, `export_static_web.py`, `scaffold_content.py`), and `run_tests.sh` / `lint.sh` wrappers. |

### Game encounter files

All game executables share a structure: `#!/usr/bin/env bash` shebang, the 14-line "wandered
out of bounds" boilerplate comment, game-state checks (grep inventory / test `$HP`), story output
via `cat << EOF` heredocs (plain text, no ANSI), then instructions telling the **player** to run
`export`/`mv` commands. Game executables must **NEVER mutate git-tracked files** and do not use
strict mode.

State is held entirely in environment variables and untracked flag files:
```bash
export I=amulet,$I              # Inventory: comma-separated env var
grep --quiet amulet <<< "$I"    # Check for an item
export HP=15                    # Health (set by potions)
let "HP=HP-5"                   # Combat damage
touch .statue_defeated          # Non-destructive "defeated" flag, checked on re-entry
mv ../../.chapel ../../chapel   # Unlock a hidden room (target may be 2+ levels up)
```

## Conventions

### Shell scripts
- All executables use `#!/usr/bin/env bash`.
- **Infrastructure** scripts (`main.sh`, `setup.sh`, `help.sh`, `lib/*.sh`) use `set -euo pipefail`,
  `readonly` vars, shared color constants from `lib/colors.sh`, and structured logging via
  `lib/log.sh`. Never duplicate color/logging helpers — put shared code in `lib/`.
- **Game executables** use no strict mode, emit plain text, and never modify tracked files.
- macOS compatibility: use `sed -i.bak` (not bare `sed -i`); auto-detect `ls` color flags
  (`--color=auto` vs `-G`) rather than hardcoding GNU options.
- `.shellcheckrc` disables a number of checks (a non-exhaustive subset: SC2034, SC2086, SC1091,
  SC2154, SC2155, SC2126; see the file for the full list). The lint job shellchecks all `*.sh`
  plus executable game files under `entrance/` (severity=error for the latter).

### Scroll content (depth-graded — see `.github/instructions/scrolls.instructions.md`)
- **Level 1** (`entrance`): pure ASCII, `===` dividers, 80-char width, no Unicode/ANSI.
- **Level 2** (`cellar`/`armoury`): Unicode box-drawing and emojis OK, `####` headers.
- **Level 3** (hidden areas): Markdown features allowed.
- Emoji conventions: 🗡️ executables, 🏰 directories, 💰 treasures, 📜 scrolls.

### Adding a new room
1. Create the directory under the appropriate parent.
2. Add a depth-appropriate `scroll`.
3. Add executable encounters (`chmod +x`).
4. Wire the unlock in a prerequisite room's `treasure`: `mv ../../.newroom ../../newroom`.
5. Verify with `bash lib/reset.sh --dry` and play-test from `entrance/`.
   See `.github/instructions/rooms.instructions.md`.

## Content Contracts

Game content is described by shared, version-controlled registries (`src/help/data/*.yaml`:
`rooms.yaml`, `quests.yaml`, `commands.yaml`, `encounters.yaml`, `runtime_commands.yaml`, etc.).
These are the single source of truth consumed by the help system, the Python engine, the static
web export, and the docs. When you change game content or these registries:
- Run `make validate-contracts` — checks registries against the real filesystem
  (`validate_content_contracts.py`, `validate_walkthrough_fs.py`, `validate_runtime_commands.py`).
- Regenerate docs with `make generate-contract-docs` (writes `docs/generated/*.md`).
- Schemas live in `docs/schemas/`.

Keep the YAML registries, the on-disk room layout, and the runtime command behavior in sync —
CI (`game-tests.yml`) and the unit suite (`test_runtime_command_parity.py`,
`test_state_contract.py`) enforce parity.

## Integration Points

- **CI** (`.github/workflows/`): `ci.yml` (shellcheck/yamllint/markdownlint),
  `code-quality.yml` (CodeQL, Python), `game-tests.yml` (scroll/shebang/unlock validation),
  `test-framework.yml` (pytest), `pages.yml` (static web), `release.yml`, `dependency-update.yml`.
  `.markdownlint.json` disables MD013 (no line-length cap) plus several other rules.
- **MCP server**: `ti.mcp_server`, configured in `.cursor/mcp.json` with
  `PYTHONPATH=src/terminal-illness`; tested via `make test-mcp`.
- **Game state**: canonical save is `.bashcrawl_save.json` at repo root (shared by bash and
  Python via `lib/state.sh`); a legacy `.game_state` is auto-migrated and removed. Help-system
  progress lives in `~/.bashcrawl_progress`.
- **Logging**: JSONL session logs in `logs/sessions/` via `lib/log.sh`; browsed with the
  `src/viewer/` Flask app (`make docker-viewer`).
- **Docs**: human docs in `docs/`; generated docs in `docs/generated/` (do not hand-edit).
