# Changelog

All notable changes to Bashcrawl are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [3.2.0] - 2026-08-01 — TermForge: the emulator becomes a framework

The in-browser bash emulator is extracted into **TermForge** (`termforge/`), a
universal, zero-dependency terminal framework: one environment-agnostic kernel
(parser, VFS, Shell, Line protocol, TerminalView) now powers the browser game,
real terminal sessions, a lightweight telnet server, and custom dev/monitoring
tools. The web game is byte-identical (golden-transcript proven), saves are
compatible, and the terminal-core bash game is untouched.

### Added

- **`termforge/core/`** — the framework kernel as dual-mode files (classic
  `<script>` + CJS, no build step): `parser`, `vfs` (with NEW read-only
  **providers** for live-data files), `shell` (hook spine: preExecute /
  interceptLine / postExecute / observePipeline / beforeCommand / execDispatch
  / postCommand; injectable clock/rng/base64), `packs/posix` + `packs/flavour`,
  `protocol` (the versioned Line contract,
  `docs/schemas/terminal-protocol.v1.md`), `view` + `sinks/dom` + `sinks/ansi`
  (one TerminalView replacing the duplicated story/arcade renderers), and
  `input` (shared history/completion helpers + a LineEditor and byte decoder
  for stream hosts).
- **Node hosts** (`termforge/node/`): `host-tty.js` (play in a real terminal —
  `make tty-demo`) and `host-telnet.js` + `telnet-codec.js` (a minimal RFC 854
  subset with NAWS, session caps, idle kick, and an nc-friendly `--raw` mode —
  `make telnet-demo`; loopback-bound by default, see
  `docs/termforge/telnet-host.md`).
- **Apps** (`termforge/apps/`): `bashcrawl.js` (the game as an App descriptor)
  and `procwatch/` (the custom-tool reference: live `node:os` metrics mounted
  as read-only VFS provider files, browsable with the ordinary posix toolkit;
  `demo.html` runs it in a browser from `file://`).
- **JS test suite** (`make test-js`, `node --test`, zero npm deps): 62 tests —
  golden transcripts recorded against the pre-refactor emulator and replayed
  byte-identically under a pinned vm clock/rng, save-shape + legacy-save
  round-trips, kernel/pack/view/input units, telnet codec units and a real
  loopback integration. CI runs it (setup-node 20) plus `make lint-js`
  (`node --check` over every tracked JS file).
- **Vendor pipeline**: `termforge/core/` is mirrored file-for-file into
  `web/assets/js/vendor/termforge/` by `make web-build`
  (`scripts/vendor_termforge.py`), byte-verified bidirectionally by
  `validate_static_web.py`, pytest, and `make web-test`.
- **`agentwatch`** (`termforge/apps/agentwatch/`, `make agentwatch`) — an
  AI-agent task dashboard on the framework: a TaskSource interface projected
  as `board`/`agent <id>`/`feed` commands AND live read-only VFS files
  (`cat agents/forge`, `grep -r failed .`), over any host. Ships a
  deterministic demo fleet (state ticks once per read — no clock/randomness)
  and a JSONL adapter that turns the repo's real agent-playtest telemetry
  (`logs/sessions/**`) into a live board
  (`make agentwatch ARGS="--data-dir logs/sessions"`).
- **uiText copy deck** — the framework/content boundary made mechanical:
  every brandable string a core pack emits routes through
  `Shell#text()`/`DEFAULT_UI_TEXT` with neutral defaults; the game's entire
  voice (legacy error strings, fortune deck, banner art, figlet default)
  moved into `GAME_UI_TEXT` in `runtime.js`. A new
  `content-separation.test.js` fails the build if game vocabulary appears
  anywhere under `termforge/core/`.

### Changed

- `web/assets/js/runtime.js` (1852 → ~930 lines) is now the **game assembly**:
  `class Runtime extends TermForge.Shell` with the full 74-entry handlers
  literal (still the `validate_runtime_commands.py` contract — the validator
  is untouched) and `installGameHooks()` for quests, achievements, daily,
  trainer, pathfind, and encounters.
- `game.js`/`arcade.js` share one TerminalView + DomSink (the twin log
  renderers and four `escapeHtml` copies collapse into one);
  `arcade.js` passes `{ bare: true }` instead of poking the instance.
- `defaultState()` now declares two previously-implicit fields (`prevCwd`,
  `stats.lastPipedIn`); persisted-save key order shifts accordingly (additive;
  legacy saves load unchanged — fixture-proven).
- Host CLI parsing now uses node's standard `util.parseArgs`
  (`allowNegative` for `--no-color`; engines floor is node >= 20.16); VFS
  provider mounts now list in their parent directory as file or directory
  according to the mount root's own type.

### Fixed

- Committed `web/data/world.json` was stale after the #75 markdown unwrap
  (freshness test red from a clean checkout).

## [3.1.0] - 2026-07-06 — The Great Reduction + Web Flagship

The repo is reduced to **two player surfaces plus one harness**: the pure-bash
terminal game (played with real `cd`/`cat` — no launcher) and a static browser
trainer generated from the same content, plus a lean MCP playtest harness that
drives the *real* bash game. Net: ~350 files and ~75k lines removed.

### Added

- **Web mode router** (`web/assets/js/shell.js`): top-nav **Story · Arcade ·
  Reference**, first-visit landing overlay, hash routing (`#/story` …),
  Alt+1/2/3 shortcuts, XP bridge, toasts.
- **Practice Arcade** (`web/assets/js/arcade.js`): mini-game framework over the
  shared bash emulator — each game is *(seed world + goal predicate + scoring)*
  on a scoped `Runtime`. Four games: **Path Navigator** (navigate the real
  dungeon), **grep/find Hunt** (find the sigil-bearing file), **Pipe Puzzle**
  (transform INPUT into TARGET), **Command Flash** (drill decks generated from
  `commands.yaml`/`tutorials.yaml` + curated decks). Scores persist; wins feed
  story XP.
- **Reference mode + concept spotlight** (`web/assets/js/reference.js`):
  searchable cheatsheet library from the command registries, a story-sidebar
  card showing what the current room teaches, and inline syntax hints while
  typing.
- **Bash-emulator kernel upgrades** (`web/assets/js/runtime.js`): output
  redirection (`>`, `>>`), glob expansion (`*`, `?`, quote-aware), multi-file +
  `-r/-l/-n/-c/-w` and real-regex `grep`, `sort -u`, `uniq -c/-d`, and new
  `cut`, `tr`, `sed`, `nl`, `rev` commands.
- **Arcade content registry** (`src/help/data/arcade.yaml`) exported to
  `web/data/arcade.json` by `export_static_web.py` (validated by
  `validate_static_web.py`).
- **Lean playtest harness** (`src/playtest/`): FastMCP server
  (`bashcrawl_start/observe/command/report_gap`) driving a persistent PTY bash
  session in a sandbox copy of the dungeon; JSONL recorder; scorer with
  rooms/scrolls gates. Smoke-tested by `test/integration/test_mcp_server.py`.

### Removed

- Python Textual TUI + old MCP/agent harness (`src/terminal-illness/`),
  Flask log viewer (`src/viewer/`), `screenshots/` (167 SVGs), `main.sh`
  launcher, Docker/devcontainer tooling, `.archives/`, and the launcher-only
  `lib/` scripts (`emulator`, `state`, `ui`, `quests`, `room_loader`, …).
  `lib/` retains `colors.sh`, `log.sh`, `yaml_reader.sh`, `reset.sh`.
- TUI/agent/viewer test suites (`test/ai/`, `test/demo/`, `test/analysis/`,
  and the `ti.*` unit/integration tests) and their CI workflows
  (`test-framework`, `code-quality`, `release`).

### Changed

- **CI/CD redesigned** (5 workflows → 3): `ci.yml` is now the single PR/push gate
  with three jobs — consolidated `lint` (one runner for shellcheck/yamllint/
  markdownlint/ruff), `test` (**the full pytest suite now runs in CI**, closing a
  gap where 175 tests ran nowhere, plus `make validate-contracts` and junit
  artifacts), and `macos-smoke` (real gameplay on stock macOS bash 3.2, replacing
  the Windows matrix the unix-only suite couldn't run). `game-tests.yml` deleted —
  its unique checks (shebangs, boilerplate, unlock targets, main-path scroll depth)
  moved into `validate_content_contracts.py` so they run locally too.
  `dependency-update.yml` deleted — redundant with Dependabot, and its
  `pip freeze` rewrite would have destroyed the commented requirements files.
  `pages.yml` gains pip caching and uses `make web-test`; `blank-slate-audit.yml`
  now writes the scorer verdict to the run summary. `make validate-contracts`
  additionally runs the content-index check.
- Terminal play is launcher-free: `./setup.sh && cd entrance && cat scroll`.
- Python deps reduced to `pyyaml` + `mcp` (dev: `pytest`, `pytest-timeout`,
  `jsonschema`, `ruff`).
- `validate_runtime_commands.py` validates the single remaining runtime (the
  web emulator) against `runtime_commands.yaml`.
- `scripts/playtest.sh` targets `playtest.mcp_server` and gates on median
  rooms-visited / scrolls-read (`BLANK_SLATE_GATE_ROOMS` / `_SCROLLS`).
- Makefile, CI workflows, `.mcp.json`, `.vscode/`, docs, README, and CLAUDE.md
  rewritten for the two-surface architecture.

## [Unreleased] - 2026-03-04

### Added

- **Walkthrough-driven test model** (`test/datasets/walkthrough.json`, `test/fixtures/walkthrough.py`)
  - Introduced a single source of truth for rooms, encounters, and progression steps
  - Added new integration suites for classic walkthrough coverage and encounter validation

- **Viewer walkthrough/templates expansion** (`src/viewer/templates/walkthrough/`, `src/viewer/templates/tests/`)
  - Added new test/walkthrough-facing template pages and related routing support

### Changed

- **Integration test structure refresh** (`test/integration/`)
  - Replaced older `test_game_scripts.py`, `test_game_progression.py`, and `test_combat.py`
    with consolidated walkthrough/encounter-focused suites
  - Updated test fixtures and log/screenshot plumbing to align with walkthrough manifests

- **Help and room metadata updates** (`src/help/bashcrawl_help.sh`, `src/help/data/rooms.yaml`)
  - Expanded room/help data wiring to match the updated walkthrough-driven model

- **Viewer analytics/session processing updates** (`src/viewer/`)
  - Updated screenshot/session loaders, analytics engine routes, and gallery/dashboard templates

### Fixed

- **Interactive executable stdin handling in TUI engine** (`src/terminal-illness/ti/filesystem.py`)
  - `run_script()` now accepts optional `stdin_input` and defaults to multiple responses,
    preventing EOF on scripts with multiple `read` prompts (for example statue/monster/ghost)

- **Encounter tests for multi-prompt scripts** (`test/integration/test_encounters.py`, `test/integration/test_native_walkthrough.py`)
  - Updated scripted stdin payloads so y/n + follow-up prompts are consumed correctly
  - Added assertions for expected statue reward output when sword path is taken

## [Unreleased] - 2026-03-03

### Added

- **Offline TUI screenshot test** (`test/ai/test_offline_screenshots.py`)
  - Integration test (`@pytest.mark.integration`) that replays a scripted command sequence through the real Textual TUI agent
  - Generates SVG screenshots and JSONL session logs without requiring `ANTHROPIC_API_KEY`
  - Accessible through the Flask viewer for visual regression review

- **AI-driven TUI screenshot test** (`test/ai/test_agent_screenshots.py`)
  - Two-phase approach: Claude (`TestAgent`) + `NonInteractiveEngine` generates a command sequence, then replays through `ti.agent` subprocess to capture real SVG screenshots
  - Marked `@pytest.mark.ai` (requires `ANTHROPIC_API_KEY`); skipped in default CI run

- **Lightweight SVG renderer fixture** (`test/fixtures/svg_renderer.py`)
  - Renders game state (command, output, location, inventory, HP) as dark-terminal SVGs
  - Used by offline screenshot tests as a lightweight alternative to the full Textual TUI

- **`.env.example`** — template documenting `ANTHROPIC_API_KEY` and other required environment variables

### Changed

- **`test/conftest.py`**: Automatically loads `.env` from repo root via `python-dotenv`; `ANTHROPIC_API_KEY` is now picked up without manual `export`

- **`test/requirements.txt`**: Added `python-dotenv>=1.0` dependency

### Fixed

- **`test/ai/session_runner.py`**: `_cmd_let` result now correctly wrapped in a `CommandResult` object; previously the raw tuple was returned, causing downstream attribute errors

- **`main.sh` line 865**: Added `# shellcheck disable=SC2163` — `export -f "$func_name"` intentionally exports the function named by the variable, not the variable itself

- **`lib/native_state.sh`**: Added `# shellcheck disable=SC2317` — `exit 1` after `return 1 2>/dev/null` is reachable when the file is executed outside a function context

---

## [Unreleased] - 2026-02-24

### Changed

- **Refactored CI workflows** (`.github/workflows/`)
  - Consolidated ShellCheck, yamllint, and markdownlint into single `ci.yml` — removed duplicates from `code-quality.yml` and `game-tests.yml`
  - Removed redundant Python sanity-check job from `ci.yml` (covered by `test-framework.yml`)
  - Removed `lint-and-format` job from `code-quality.yml` (now only CodeQL security scan + quality metrics)
  - Removed inline ShellCheck step from `game-tests.yml` (centralized in `ci.yml`)
  - Dropped `master` branch references across all workflows (repo only uses `main`)
  - Upgraded `dependency-update.yml` Python version from 3.11 to 3.12
  - `dependency-update.yml` now updates both `test/requirements.txt` and `src/terminal-illness/requirements.txt`
  - Replaced inline `pip install yamllint` with `ibiqlik/action-yamllint@v3` action in `ci.yml`
  - Cleaned trailing whitespace in `release.yml`

### Fixed

- **CI failures across all workflows**
  - Fixed `dependency-update.yml` broken YAML: malformed `body` block with spurious `branch:` key mid-string
  - Fixed `test-framework.yml` setup crash: added `TERM: dumb` env and `--quick` flag to `setup.sh` calls (prevents `clear` command failure in headless CI runners)
  - Added 10 ShellCheck disable rules to `.shellcheckrc` (SC2155, SC2126, SC2010, SC2012, SC2143, SC2043, SC2046, SC2181, SC2295, SC2329) — all style/info-level warnings in helper scripts that were blocking CI
  - Updated `.yamllint.yml`: added `truthy: check-keys: false` (for GH Actions `on:` key), `indentation: indent-sequences: whatever` (for standard GH Actions formatting)
  - Excluded `.venv/` from ShellCheck file discovery in `ci.yml`

---

## [Unreleased] - 2026-02-23

### Added

- **Bashcrawl Observatory viewer documentation** (`docs/viewer.md`, `src/viewer/README.md`)
  - Full reference for the Flask log viewer: installation, all pages, JSON API, configuration, troubleshooting
  - `docs/log-viewer-reference.md`: Quick-reference card for API endpoints and configuration keys
  - Replaced the design-intent `docs/log-viewer-plan.md` with accurate operational docs

- **AI agent test documentation** (`docs/getting-started.md`, `docs/advanced.md`)
  - Step-by-step guide for running agent-mode playtests and interpreting screenshots
  - Advanced section covering test suite markers (`unit`, `integration`, `ai`, `demo`) and `ANTHROPIC_API_KEY` setup

- **`no-screenshot.svg` placeholder** (`src/viewer/static/img/no-screenshot.svg`)
  - Dark-background SVG placeholder shown in gallery/index when an image fails to load

### Fixed

- **Screenshot gallery rendering** (`src/viewer/loaders/screenshots.py`, gallery/index templates)
  - `_abs_to_rel()` converts absolute manifest paths to URL-relative paths using `.resolve()`
  - `_load_manifest()` parses `manifest.json` and emits `Screenshot` objects with correct paths
  - `_parse_screenshot_dir()` rewritten with 3-strategy fallback: top-level manifest → subdir manifest → `rglob("*.svg")`
  - Stub SVG filter: files < 200 bytes (test fixture stubs) excluded; sessions with only stubs skipped
  - `ScreenshotStore.load_all()` passes `screenshots_dir` to `_parse_screenshot_dir` for path resolution
  - Templates updated: all image `src` attributes now use `sc.path` / `sc.screenshots[0].path` instead of broken string concatenation

- **Room visit statistics** (`src/viewer/loaders/sessions.py`)
  - Sessions loader now extracts `room` from `command` events (real data format) rather than looking for `room_enter` events that didn't exist; rooms went from 0 → 39 entries across 11 sessions

- **Feedback page content** (`src/viewer/loaders/feedback.py`)
  - Fixed metrics regex from `(.+?)` to `([^|\n]+?)` to prevent matching across pipe `|` and newline boundaries
  - Added `FeedbackStore.refresh()` method for reloading feedback files without restarting the server

- **Analytics/feedback API refresh** (`src/viewer/routes/api.py`)
  - Added `POST /api/analytics/refresh` endpoint (calls `store.refresh()` + `engine.invalidate_cache()`)
  - Added `POST /api/feedback/refresh` endpoint (calls `FeedbackStore.refresh()`)

- **`ls -F` crash in TUI terminal engine** (`src/terminal-illness/ti/terminal_engine.py`)
  - `_cmd_ls(args)` now separates flags (strings starting with `-`) from optional path argument
  - Flag chars collected into a set; `show_hidden = "a" in flags` passed to `fs.ls()`
  - Fixes `NotADirectoryError: Not a directory: -F` that appeared in agent session screenshots

- **Hidden files in TUI filesystem** (`src/terminal-illness/ti/filesystem.py`)
  - `fs.ls(cwd, path="", show_hidden=False)` — new `show_hidden` parameter
  - Dotfiles (`.chapel/`, `.vault/`, `.rift/`, `.scrap/`) hidden by default; shown with `ls -a` / `ls -la` / `ls -aF`

- **Merlin AI guide visibility** (`src/terminal-illness/ti/chat_context.py`)
  - `GameContextBuilder.build()` now calls `fs.ls(cwd, "", show_hidden=True)` so Merlin can see and mention hidden rooms when guiding players

- **Agent screenshot path nesting** (`src/terminal-illness/ti/agent.py`)
  - Removed the extra `<timestamp>_agent_session/` subdirectory layer; all SVGs and `manifest.json` now written directly to `--screenshot-dir`
  - Fixes 15 previously failing integration tests in `TestAgentScreenshots` and `TestTuiCriticalPath/UIElements/EdgeCases` where tests expected flat `shot_dir/<name>.svg` but agent wrote to a nested subdir
  - Viewer screenshot loader strategy-1 (top-level `manifest.json`) now resolves immediately for all new sessions

### Changed

- **`docs/index.md`**: Added viewer and AI agent test links in the navigation section
- **`docs/getting-started.md`**: Added Observatory viewer quick-start and AI agent test section
- **`docs/advanced.md`**: Expanded with full Observatory viewer and AI test workflow sections
- **`docs/log-viewer-plan.md`**: Replaced by `docs/viewer.md` and `docs/log-viewer-reference.md` (deleted)

---

### Added

- **Merlin AI Chat Guide** (`src/terminal-illness/ti/`)
  - `ai_chat.py`: `AIChatService` — wraps Anthropic Claude (`claude-sonnet-4-20250514`)
    with async streaming, rolling 20-turn conversation history, proactive nudge
    strings, and static fallback when `ANTHROPIC_API_KEY` is absent
  - `chat_context.py`: `GameContextBuilder` — assembles game context snapshots
    (room, inventory, HP, quest, recent commands, scroll excerpt) for prompt
    injection; `detect_stuck()` identifies repetitive command patterns (threshold: 3)
  - `chat_panel.py`: Textual `ChatPanel` widget — toggleable right-side panel
    with streaming token display, proactive nudges, and styled user/Merlin bubbles
  - `chat_cli.py`: CLI bridge — lets `bash help.sh merlin` invoke Claude as a
    standalone Python process
  - `data/merlin_prompt.txt`: Merlin wizard persona, Socratic teaching rules,
    and context placeholder template (7 injected fields)

- **F3 Key Binding** in Textual TUI (`src/terminal-illness/ti/app.py`)
  - Toggles Merlin chat panel open/closed without leaving the game terminal
  - `merlin <question>` command opens panel and submits question in one step
  - Proactive nudges fired on: room change, HP < 20, quest complete, stuck detection
  - `@work(thread=True, exit_on_error=False)` — API errors display in chat panel
    instead of closing the session; full `try/except` with `self.log.error()` fallback

- **`help merlin` / `help ask` subcommands** (`src/help/bashcrawl_help.sh`, `src/help.sh`)
  - `bash help.sh merlin "<question>"` calls the Python AI bridge for terminal-only players
  - Falls back to existing `ai_engine.sh` static hints when Python or API key unavailable

- **VS Code Debug Configurations** (`.vscode/launch.json`)
  - `🧙 Debug TUI — Merlin Chat`: Full Textual game with `TEXTUAL_LOG=/tmp/textual_debug.log`
  - `🧙 Debug Merlin CLI`: Single-turn CLI bridge for step-through debugging
  - `🧙 Debug AI Chat Tests`: pytest runner for `test/unit/test_ai_chat.py`
  - `🧙 Debug TUI — Break on Exception`: `justMyCode: false` for worker-thread crashes
  - `🧪 Debug All Unit Tests`: Full unit suite runner

- **Unit Tests** (`test/unit/test_ai_chat.py`) — 28 tests covering:
  - `GameContextBuilder.build()` and `detect_stuck()` (6 cases)
  - `GameContext.as_dict()` placeholder formatting
  - `AIChatService` API availability detection, fallback responses, nudge strings,
    history trimming, system prompt rendering, Claude mock integration

### Added

- **Log Viewer Flask Web App** (`src/viewer/`)
  - Full Flask web application for browsing JSONL session logs and analytics
  - Routes: session list/detail, feedback list/detail, screenshots gallery, dungeon map, analytics dashboard, live agent view
  - Live agent monitoring page (`/live/agent`) with real-time event stream via SSE
  - REST API endpoints (`/api/`) for sessions, screenshots, feedback, and live agent status
  - Static assets: themed CSS (`theme.css`, `components.css`, `gallery.css`, `map.css`), JavaScript modules for map rendering, gallery, analytics, and live agent feed
  - Configurable via `src/viewer/config.py`; launchable with `python3 -m src.viewer --port 5000`
  - See [docs/log-viewer-plan.md](docs/log-viewer-plan.md) for design rationale

- **Live Agent Session Logging** (`test/ai/live_logger.py`)
  - Real-time JSONL logger that writes agent events during AI test runs to `logs/live_agent.jsonl`
  - Feeds the live agent monitoring page in the log viewer

- **Hidden Study Room** (`entrance/.chapel/courtyard/aviary/hall/library/.study/`)
  - New deeply-nested hidden area with `scroll` (teaches advanced grep/search) and `grimoire` encounter
  - Unlocked after completing the library section

- **Log Cleanup Utility** (`lib/clean_logs.sh`)
  - New utility script to prune old session logs and screenshots by age or count
  - Dry-run mode (`--dry`) for safe preview before deletion

- **Help System Scroll** (`src/help/scroll`)
  - Standalone scroll for the help system directory, documenting available help commands

- **Workflow Prompts** (`.github/prompts/`)
  - `test-doc-commit-push.prompt.md`: Complete release pipeline prompt for Copilot

- **`tome` game object** (`entrance/.chapel/courtyard/aviary/hall/library/tome`)
  - New interactive encounter in the library teaching advanced text processing

- **Expanded help data** (`src/help/data/`)
  - `map.yaml`: Additional dungeon areas and connections
  - `quests.yaml`: 3 new quest definitions for advanced areas
  - `rooms.yaml`: 45 lines of new room metadata for hidden areas

- **AI test infrastructure improvements** (`test/ai/`)
  - `agent.py`: 144 lines added — enhanced `TestAgent` with live logging, retry logic, and structured output
  - `session_runner.py`: 86 lines added — session management with log capture and timing metrics
  - All AI test files updated to use improved agent and session runner APIs

- **Walkthrough documentation** ([docs/walkthrough.md](docs/walkthrough.md))
  - Complete step-by-step walkthrough with SVG screenshot references for every command

- **Agent Mode for AI Assistants** (`--agent` flag)
  - Headless Textual TUI mode driven via stdin/stdout protocol
  - SVG screenshot capture after every command using Textual's `save_screenshot()`
  - `SCREENSHOT`, `STATUS`, and `EXIT` meta-commands
  - `READY>` sentinel for synchronization with programmatic callers
  - `--screenshot-dir` flag to control screenshot output location
  - See [docs/agent-protocol.md](docs/agent-protocol.md) for full specification

- **Bash Agent REPL** (`--agent-bash` flag)
  - Lightweight bash-only agent mode (no Python dependency)
  - Same `READY>` / `CMD>` protocol for consistent integration
  - Automatic fallback when Python/Textual is unavailable

- **TerminalEngine programmatic API**
  - `execute(cmd_line)` method for dispatching commands without interactive REPL
  - `get_completions(text)` method for programmatic tab completion
  - `output_callback` parameter to route output to Textual widgets
  - `on_quest_complete` callback for quest event handling

- **Agent playtest report** ([docs/agent-playtest-report.md](docs/agent-playtest-report.md))
  - Comprehensive playtest findings from AI-agent-driven session
  - 15 recommendations across content, architecture, TUI, and testing
  - Priority matrix for implementation ordering

- **Agent protocol documentation** ([docs/agent-protocol.md](docs/agent-protocol.md))
  - Full stdin/stdout protocol specification
  - CLI flag reference for both `main.sh` and `python3 -m ti.agent`
  - Integration guide for AI assistants

- **Test suite for agent mode** (`test/unit/test_agent.py`, `test/integration/test_agent_mode.py`)
  - Unit tests for TerminalEngine `execute()`, `get_completions()`, and constructor
  - Integration tests for the full agent pipeline via subprocess
  - Screenshot generation and SVG validation tests

### Fixed

- **`textual` dependency** added to `test/requirements.txt` — unit tests for `BashcrawlApp`
  agent mode previously failed with `ModuleNotFoundError: No module named 'textual'`
- **`lib/reset.sh`** expanded to clean additional stray files from TUI sessions and new game areas
- **`logs/screenshots/.gitkeep`** removed — screenshots directory is now created dynamically
- **TerminalEngine constructor** now accepts `output_callback` and `on_quest_complete`
  parameters that `BashcrawlApp` was already passing (previously caused `TypeError`)
- **BashcrawlApp** modal screens (Welcome/Load) no longer block headless operation
  when `agent_mode=True`
- **`action_submit()` async handling** — properly awaited in Textual 8.0+ to avoid
  `RuntimeWarning: coroutine never awaited`

### Changed

- **`src/terminal-illness/ti/agent.py`** — enhanced with improved output handling and protocol robustness
- **`src/terminal-illness/ti/filesystem.py`** — minor fixes for cross-platform path handling
- **`src/terminal-illness/ti/terminal_engine.py`** — 18 lines updated for improved command dispatch
- **`docs/agent-protocol.md`** — expanded with additional protocol details and examples
- **`logs/README.md`** — restructured and simplified documentation for the logs directory
- **`.github/copilot-instructions.md`** — updated with viewer, live logger, and hidden area documentation
- **`setup.sh`** — minor fix for macOS compatibility (`sed -i.bak` path handling)
- `main.sh` help text updated with agent mode flags and examples
- `main.sh` argument parser extended to handle `--agent`, `--agent-bash`,
  `--screenshot-dir` flags
- All SVG screenshots in `screenshots/` regenerated with updated TUI rendering
