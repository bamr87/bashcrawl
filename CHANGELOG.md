# Changelog

All notable changes to Bashcrawl are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
