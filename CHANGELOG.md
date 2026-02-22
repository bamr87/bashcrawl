# Changelog

All notable changes to Bashcrawl are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
