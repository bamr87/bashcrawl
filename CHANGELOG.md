# Changelog

All notable changes to Bashcrawl are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

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

- **TerminalEngine constructor** now accepts `output_callback` and `on_quest_complete`
  parameters that `BashcrawlApp` was already passing (previously caused `TypeError`)
- **BashcrawlApp** modal screens (Welcome/Load) no longer block headless operation
  when `agent_mode=True`
- **`action_submit()` async handling** — properly awaited in Textual 8.0+ to avoid
  `RuntimeWarning: coroutine never awaited`

### Changed

- `main.sh` help text updated with agent mode flags and examples
- `main.sh` argument parser extended to handle `--agent`, `--agent-bash`,
  `--screenshot-dir` flags
- `.github/copilot-instructions.md` updated with agent mode documentation
