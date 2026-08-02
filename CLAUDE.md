# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bashcrawl (v3.2) is an educational text-based adventure game that teaches POSIX terminal commands through fantasy dungeon-crawl gameplay. The core game is **the filesystem itself**: directories are rooms, files named `scroll` are educational content, and executable scripts (`treasure`, `potion`, `spell`, `statue`, `ghost`, `monster`, `goblet`) are interactive encounters.

The repo has **two player surfaces, one harness, and one embedded framework**:

- **Terminal-core** (`entrance/`, `help.sh` + `src/help/`, minimal `lib/`) — pure POSIX shell,
  no dependencies, no launcher. Played with real `cd`/`ls`/`cat`: `cd entrance && cat scroll`.
- **Web trainer** (`web/`) — a static, framework-free browser app with three modes:
**Story** (the dungeon on an in-browser bash emulator), **Practice Arcade** (four mini-games on the same emulator: Path Navigator, grep/find Hunt, Pipe Puzzle, Command Flash), and **Reference** (searchable cheatsheets + concept spotlight). Generated from the game content by `scripts/export_static_web.py`; deployed to GitHub Pages by `pages.yml`.
- **Playtest harness** (`src/playtest/`) — a lean MCP server that lets an AI agent play the
*real* bash game in a sandboxed PTY session (`bashcrawl_start/observe/command/report_gap`), with a JSONL recorder and scorer for content-gap audits. Python 3.10+, deps: `pyyaml` + `mcp`.
- **TermForge** (`termforge/`) — the universal terminal framework extracted from the web
emulator (v3.2): an environment-agnostic kernel (parser, VFS with providers, Shell + hook spine, Line protocol, TerminalView + DOM/ANSI sinks) as dual-mode files (classic script and CJS, zero deps, no build step), plus node hosts (`host-tty.js`, `host-telnet.js`) and apps (`bashcrawl.js`, `procwatch/`). Docs: `docs/termforge/architecture.md`, `docs/termforge/authoring-apps.md`, `docs/termforge/telnet-host.md`, `docs/schemas/terminal-protocol.v1.md`. Core is vendored into `web/assets/js/vendor/termforge/` by `make web-build` — **edit `termforge/core/`, never the vendor mirror** (byte-verified by `make web-test`).

The removed Textual TUI, Flask viewer, and Docker tooling live only in git history (pre-3.1).

## Commands

The `Makefile` is the canonical task runner (exports `BASHCRAWL_ROOT` and `PYTHONPATH=src:test`).

```bash
make setup             # chmod encounters + print how to start
make web-build         # export entrance/ + YAML registries -> web/data/*.json
make web-test          # web-build + validate bundle + runtime-command parity
make web-preview       # serve web/ at http://127.0.0.1:8000
make validate-contracts# registries <-> filesystem <-> runtime parity
make generate-contract-docs
make test              # unit + integration (pytest)
make test-unit / test-integration
make test-js           # TermForge framework tests (node --test, zero deps)
make test-mcp          # playtest-harness smoke tests in a local .venv
make playtest          # blank-slate agent playtest (needs claude CLI + OAuth token)
make lint              # shellcheck + yamllint + markdownlint + ruff
make lint-js           # node --check over every tracked JS file
make tty-demo          # play bashcrawl in this terminal (JS emulator on node)
make telnet-demo       # serve bashcrawl at telnet://127.0.0.1:2323 (ARGS="--raw" for nc)
make agentwatch        # AI-agent task dashboard (ARGS="--data-dir logs/sessions" for real logs)
make clean             # bash lib/reset.sh — reset game state
```

### Running a single test

Tests run from `test/` (where `pytest.ini` lives). Markers: `unit`, `integration`, `slow`, `bash`.

```bash
cd test
export PYTHONPATH="$PWD/../src:$PWD"
export BASHCRAWL_ROOT="$PWD/.."
python3 -m pytest unit/test_static_web.py -v
python3 -m pytest integration/test_mcp_server.py -v    # playtest harness smoke
```

### Playing / inspecting the game directly

```bash
cd entrance && cat scroll          # the game — that's it
bash help.sh                       # contextual help; also: help.sh commands | map
bash lib/reset.sh --dry            # preview a game-state reset (always dry-run first)
PYTHONPATH=src python3 -m playtest.mcp_server   # MCP playtest server (agents)
```

## Architecture

### Directory-as-Room map

Main path: `entrance/` → `cellar/` → `armoury/` → `chamber/`.

Hidden areas (all rooted under `entrance/`) are unlocked by collecting treasures, which `mv` a dotted directory to its visible name:
- `.chapel/` → `graveyard/`, `courtyard/{aviary,hall,library}/` — `grep`, `find`, pipes
- `.vault/` → `stronghold/{nursery,lab}/` — variables, env, process substitution
- `.scrap/` — a **directory** (not a file) whose scroll teaches `ln -s`
- `.rift/` → `arena/pit/`, `spire/mezzanine/` — advanced scripting, checksums
- `entrance/workshop/` — does not exist until the player runs `mkdir` (player-created room)

### Key components

| Component | Purpose |
|-----------|---------|
| `entrance/.functions` | Defines `gameover()` and `help()`; each encounter script sources it itself. |
| `help.sh` | Root shim that `exec`s `src/help.sh` (sources `src/help/bashcrawl_help.sh`). |
| `src/help/` | Bash help engine; YAML **content registries** in `src/help/data/`. |
| `lib/` | Minimal shared shell libs: `colors.sh`, `log.sh` (JSONL), `yaml_reader.sh`, `reset.sh`. |
| `setup.sh` | chmods encounter scripts (`--quick` for tooling/tests). |
| `termforge/core/` | The TermForge kernel (source of truth): `parser`, `vfs` (+ read-only providers), `shell` (hook spine, injectable clock/rng), `packs/{posix,flavour}`, `protocol`, `view`, `sinks/{dom,ansi}`, `input`. Dual-mode files, vendored to `web/assets/js/vendor/termforge/`. |
| `termforge/node/` | Node hosts: `host-tty.js`, `host-telnet.js` + `telnet-codec.js` (RFC 854 subset), `index.js` (framework namespace for require()). |
| `termforge/apps/` | `bashcrawl.js` (the game as an App descriptor for the hosts), `procwatch/` (custom-tool reference: live metrics as provider files), `agentwatch/` (AI-agent task dashboard: TaskSource → board/feed + live files; JSONL adapter for `logs/sessions/`). |
| `termforge/test/` | `node --test` suites incl. golden transcripts (pixel-identity contract; regenerate only via `record-goldens.js --update`) and the telnet loopback integration. |
| `web/assets/js/runtime.js` | The **bashcrawl game assembly** over TermForge: `class Runtime extends TermForge.Shell`, the full 74-entry `this.handlers` literal (the `validate_runtime_commands.py` regex contract — one `key: ref,` per line, bare references only), and `installGameHooks()` (quests/achievements/daily/trainer/pathfind/encounters). |
| `web/assets/js/game.js` | Story mode: quests, XP, map, hero, effects (log via the shared TerminalView). |
| `web/assets/js/arcade.js` | Practice Arcade framework + the 4 mini-games (scoped bare Runtime per game). |
| `web/assets/js/reference.js` | Cheatsheet library, concept spotlight, inline syntax hints. |
| `web/assets/js/shell.js` | Mode router (Story·Arcade·Reference), landing overlay, XP bridge, toasts. |
| `src/playtest/` | `bash_session.py` (PTY bash REPL + sentinel prompt), `sandbox.py`, `recorder.py`, `harness.py`, `mcp_server.py`, `scorer.py`. |
| `scripts/` | `export_static_web.py`, `vendor_termforge.py`, `validate_*`, `generate_*`, `playtest.sh`, `lint.sh`, `run_tests.sh`. |

### Game encounter files

All game executables share a structure: `#!/usr/bin/env bash` shebang, the 14-line "wandered out of bounds" boilerplate comment, game-state checks (grep inventory / test `$HP`), story output via `cat << EOF` heredocs (plain text, no ANSI), then instructions telling the **player** to run `export`/`mv` commands. Game executables must **NEVER mutate git-tracked files** and do not use strict mode.

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
- **Infrastructure** scripts (`setup.sh`, `help.sh`, `lib/*.sh`) use `set -euo pipefail`,
  shared color constants from `lib/colors.sh`, structured logging via `lib/log.sh`.
- **Game executables** use no strict mode, emit plain text, never modify tracked files.
- macOS compatibility: use `sed -i.bak` (not bare `sed -i`); auto-detect `ls` color flags.
- `.shellcheckrc` disables a number of checks; the lint job shellchecks all `*.sh` plus
  executable game files under `entrance/` (severity=error for the latter).

### Scroll content (depth-graded — see `.github/instructions/scrolls.instructions.md`)
- **Level 1** (`entrance`): pure ASCII, `===` dividers, 80-char width, no Unicode/ANSI.
- **Level 2** (`cellar`/`armoury`): Unicode box-drawing and emojis OK, `####` headers.
- **Level 3** (hidden areas): Markdown features allowed.

### Adding a new room
1. Create the directory under the appropriate parent; add a depth-appropriate `scroll`;
   add executable encounters (`chmod +x`); wire the unlock in a prerequisite `treasure`.
2. Update `src/help/data/rooms.yaml` (+ `encounters.yaml` etc.).
3. `make validate-contracts && make web-build` — the web app must pick the room up.
   See `.github/instructions/rooms.instructions.md`.

### Web JS
- Framework-free app code, IIFE modules, classic scripts. Load order: the 13 vendored
TermForge core files (`protocol → parser → state → vfs → hooks → registry → shell → packs/posix → packs/flavour → view → sinks/dom → sinks/ansi → input`), then `storage → runtime → docs → reference → arcade → game → shell`. `validate_static_web.py` enforces that every vendor file loads before `runtime.js`. New features plug into `shell.js` (mode router) or an arcade game descriptor.
- A mini-game = *(seed world + goal predicate + scoring)* over a scoped bare `Runtime` —
  never reimplement command behavior outside `termforge/core/` + `runtime.js`.
- Framework changes go in `termforge/core/` (then `make web-build` re-vendors); game-only
changes go in `runtime.js`. The `this.handlers = {…}` literal in `runtime.js` must stay a single static literal (validator regex contract).
- `localStorage` keys: story save `bashcrawl-web-state-v1`, arcade `bashcrawl-web-arcade-v1`,
shell prefs `bashcrawl-web-shell-v1` (additive keys; never break the story save — `termforge/test/game-save.test.js` locks the shape).

## Content Contracts

Game content is described by shared, version-controlled registries (`src/help/data/*.yaml`: `rooms.yaml`, `quests.yaml`, `commands.yaml`, `encounters.yaml`, `runtime_commands.yaml`, `tutorials.yaml`, `arcade.yaml`, etc.). They are the single source of truth for the help system, the web export, and the docs. When changing game content or registries:
- `make validate-contracts` — registries vs. the real filesystem.
- `make web-test` — regenerates `web/data/*.json`, re-vendors `termforge/core/`, and
validates the bundle (`test_static_web.py` fails CI if committed data or the vendor mirror is stale).
- `scripts/validate_runtime_commands.py` — every `runtime_commands.yaml` entry flagged
  `demo: true` must appear in the `this.handlers` literal in `web/assets/js/runtime.js`.
- `make test-js` — the TermForge suite; the golden transcripts are the emulator's
  behavior contract (a fixture diff is a claimed behavior change).
- Regenerate docs with `make generate-contract-docs` (writes `docs/generated/*.md`).

## Integration Points

- **CI** (`.github/workflows/`, three workflows): `ci.yml` is the PR/push gate — `lint`
(shellcheck/yamllint/markdownlint/ruff via `scripts/lint.sh`, plus `make lint-js`), `test` (`make validate-contracts` + the full pytest suite via `make test` + the TermForge suite via `make test-js`; node 20 via setup-node), and `macos-smoke` (real gameplay on stock macOS bash 3.2). `pages.yml` builds + deploys `web/` on main. `blank-slate-audit.yml` is the weekly agent playtest. Every CI check mirrors a local `make` target; content rules (shebangs/scrolls/unlocks) live in `validate_content_contracts.py`, not inline in workflows. Dependabot owns all dependency updates (`.github/dependabot.yml`).
- **MCP server**: `playtest.mcp_server`, configured in `.mcp.json` / `.cursor/mcp.json` with
  `PYTHONPATH=src`; smoke-tested via `make test-mcp`.
- **Logging**: JSONL session logs in `logs/sessions/` (playtest recorder + test log capture).
- **Docs**: human docs in `docs/`; generated docs in `docs/generated/` (do not hand-edit).
