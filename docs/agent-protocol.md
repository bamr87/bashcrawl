# Agent Mode Protocol Specification

Bashcrawl provides a headless **agent mode** that lets AI assistants (or any
programmatic caller) drive the Textual TUI via stdin/stdout, with SVG screenshot
capture after every command.

---

## Quick Start

```bash
# Textual TUI agent (recommended — includes screenshots)
./main.sh --agent

# With a custom screenshot directory
./main.sh --agent --screenshot-dir /tmp/shots

# Screenshots default to logs/screenshots/<timestamp>_agent_session/

# Bash-only agent REPL (no Python required, no screenshots)
./main.sh --agent-bash
```

Or invoke the Python module directly:

```bash
PYTHONPATH=src/terminal-illness python3 -m ti.agent \
    --game-root /path/to/bashcrawl \
    --screenshot-dir ./logs/screenshots
```

For **JSON stdin/stdout** without Textual or screenshots (e.g. Cursor terminal automation), see [cursor-ai.md](cursor-ai.md).

For **MCP tools** (`bashcrawl_start`, `bashcrawl_command`, `bashcrawl_screenshot`, …) usable from Cursor and other MCP clients, run `python3 -m ti.mcp_server` with `PYTHONPATH=src/terminal-illness`; see [cursor-ai.md](cursor-ai.md) § MCP server.

---

## Protocol Overview

```
Agent (caller)                    Bashcrawl (server)
     │                                  │
     │   ←── BASHCRAWL AGENT TUI v1.0   │   banner
     │   ←── SCREENSHOT: 000_initial.svg │   initial screenshot
     │   ←── READY>                      │   ready for input
     │                                  │
     │   ──► cd entrance                 │   game command
     │   ←── CMD> cd entrance            │   echo
     │   ←── SCREENSHOT: 001_cd_entrance │   auto screenshot
     │   ←── READY>                      │   ready for next
     │                                  │
     │   ──► SCREENSHOT my_label         │   explicit screenshot
     │   ←── SCREENSHOT: my_label.svg    │   saved
     │   ←── READY>                      │
     │                                  │
     │   ──► STATUS                      │   state query
     │   ←── STATUS: {"location":...}    │   JSON response
     │   ←── READY>                      │
     │                                  │
     │   ──► EXIT                        │   end session
     │   ←── SESSION ENDED               │
     │   ←── READY>                      │   final sentinel
```

### Sentinel

After startup and after every command, the agent emits:

```
READY>
```

Callers should wait for `READY>` before sending the next command.

### Command Echo

When a game command is processed, the agent echoes it:

```
CMD> <original_input>
```

---

## Meta-Commands

| Command | Description |
|---------|-------------|
| `SCREENSHOT [name]` | Save an SVG screenshot. If `name` is omitted, auto-generates a sequential filename. `.svg` extension is appended if missing. |
| `STATUS` | Print a JSON object with current game state. |
| `EXIT` or `QUIT` | Save game state and end the session. |

### STATUS Response Format

```json
{
  "location": "/entrance/cellar",
  "inventory": "amulet,sword,",
  "hp": 15,
  "xp": 300,
  "quest_id": 4,
  "completed_quests": [0, 1, 2, 3],
  "learned_commands": ["pwd", "ls", "cat", "cd", "export"],
  "player_name": "Agent",
  "mode": "classic"
}
```

---

## CLI Options

### `main.sh` Flags

| Flag | Description |
|------|-------------|
| `--agent` | Launch Textual TUI agent mode (falls back to bash REPL if Python/Textual unavailable) |
| `--agent-bash` | Launch bash-only agent REPL (no Python, no screenshots) |
| `--screenshot-dir PATH` | Base directory for SVG screenshot output (default: `./logs/screenshots`) |

### `python3 -m ti.agent` Flags

| Flag | Description |
|------|-------------|
| `--game-root PATH` | Path to the bashcrawl repository root |
| `--screenshot-dir PATH` | Base directory for SVG screenshot output (default: `./logs/screenshots`) |
| `--no-auto-screenshot` | Disable automatic screenshots after each command |

---

## Screenshots

Screenshots are saved as SVG files using Textual's `App.save_screenshot()` method.
Each SVG is a complete rendering of the TUI at that moment, including the sidebar
(quests, inventory, room info) and the main terminal output area.

### Session Directory Structure

Each agent session creates a timestamped subdirectory under the screenshot dir:

```text
logs/screenshots/
└── 2026-02-21_155703_agent_session/
    ├── 000_initial.svg
    ├── 001_pwd.svg
    ├── 002_ls.svg
    ├── 003_cd_entrance.svg
    ├── entrance_scroll.svg          # explicit SCREENSHOT
    ├── ...
    └── manifest.json                # structured index
```

This format is compatible with the Bashcrawl Observatory viewer
(`python3 -m src.viewer`), which discovers screenshot sessions by scanning
subdirectories under `logs/screenshots/`.

### Manifest

A `manifest.json` is generated at the end of each session:

```json
{
  "generated_at": "2026-02-21T15:57:06",
  "screenshot_dir": "logs/screenshots/2026-02-21_155703_agent_session",
  "total_screenshots": 26,
  "total_size_bytes": 1922923,
  "screenshots": [
    {
      "name": "001_pwd.svg",
      "trigger": "agent_auto",
      "command": "pwd",
      "room": "/entrance",
      "ts": "2026-02-21T15:57:03",
      "size_bytes": 71751
    }
  ]
}
```

### Auto-Screenshots

By default, a screenshot is taken:
- Once at startup (`000_initial.svg`)
- After every game command (`001_cd_entrance.svg`, `002_cat_scroll.svg`, etc.)

Disable with `--no-auto-screenshot`.

### Naming Convention

Auto-named screenshots use the format:
```
{counter:03d}_{sanitized_command}.svg
```

Where `sanitized_command` replaces non-alphanumeric characters with underscores
and truncates to 40 characters.

---

## Bash-Only Agent Mode

When Python or Textual is unavailable, `--agent` automatically falls back to a
bash-only REPL. You can also request it explicitly with `--agent-bash`.

This mode provides the same `READY>` / `CMD>` protocol but without:
- SVG screenshots
- Textual TUI rendering
- Visual sidebar

### Bash Agent Banner

```
BASHCRAWL AGENT REPL v<version>
Location: /Users/.../bashcrawl
Inventory: <empty>
HP: 100
Send commands one per line. Type 'exit' to quit.
READY>
```

---

## Example: Full Playthrough Script

```bash
#!/bin/bash
# Play through the main path and capture screenshots
printf '%s\n' \
  'cd entrance'             \
  'cat scroll'              \
  'ls -F'                   \
  'cd cellar'               \
  'cat scroll'              \
  './treasure'              \
  'export I=amulet,$I'      \
  'SCREENSHOT after_cellar' \
  'cd armoury'              \
  'cat scroll'              \
  './potion'                \
  'export HP=15'            \
  'STATUS'                  \
  'EXIT'                    \
| ./main.sh --agent --screenshot-dir ./logs/screenshots 2>/dev/null
```

---

## Integration with AI Assistants

The agent mode is designed for AI coding assistants (e.g., GitHub Copilot, Claude)
that can run terminal commands but cannot interact with full-screen TUI applications.

### Key Design Decisions

1. **Line-buffered I/O**: All output is line-buffered with explicit `flush=True`
   so callers receive output immediately.
2. **`READY>` sentinel**: Unambiguous signal that the agent is ready for the next
   command, making it safe for automated parsing.
3. **No alternate buffer**: The Textual app runs via `run_test()` (headless), so
   it never enters the terminal's alternate screen buffer.
4. **JSON status**: Machine-readable game state for programmatic decision-making.
5. **SVG screenshots**: Visual snapshots for documentation, debugging, and
   screenshot regression testing.

## Blank-Slate Playtest Mode

A second protocol turns the MCP server into a **content validator**: an agent
that assumes *no* terminal skills and *no* game knowledge plays a fresh game
using only what a real new player sees on screen. Where it gets stuck pinpoints
which scroll/quest/encounter fails to teach the next step. It is the basis of the
`Blank-Slate Audit` CI job and `make playtest`.

### MCP tools (`ti.mcp_server`)

| Tool | Purpose |
|------|---------|
| `bashcrawl_start(fresh=true)` | Start a brand-new game in a throwaway **sandbox copy** of the game tree (quest 0, empty inventory) and begin recording. The real repo is never mutated. |
| `bashcrawl_observe(session_id)` | Return **only** what a player sees: `screen` (the last command's output) + `hud` (location, HP, XP, inventory, current quest title/objective, room items). No command list, completion criteria, or walkthrough. |
| `bashcrawl_command(session_id, command)` | Run one command. Each turn is classified (progress / error / repeat) and logged. |
| `bashcrawl_report_gap(session_id, reason)` | The agent calls this — instead of guessing from outside knowledge — when the on-screen content doesn't say what to do next. Logged as a self-reported `content_gap`. |
| `bashcrawl_stop(session_id)` | Finalize the JSONL log and discard the sandbox. |

The session log (durable, under `logs/sessions/blank_slate/`, gitignored) records
`discovery` / `struggle` / `content_gap` / `quest_complete` events for offline
scoring.

### The no-cheat guarantee

When Claude Code is the player, it is launched with the bashcrawl MCP server as
its **only** tools (`--allowedTools "mcp__bashcrawl__*"`, built-ins denied), so it
cannot `cat` scroll files off disk or read the walkthrough — it must play through
the game. `scripts/playtest.sh` adds a transcript cheat-guard that fails the run
if any built-in tool call appears.

### Running it

```bash
# One-time (maintainer): create a subscription token and add it as the
# CLAUDE_CODE_OAUTH_TOKEN repo secret for CI.
claude setup-token

# Locally (needs the claude CLI + an OAuth token or ANTHROPIC_API_KEY):
make playtest            # N sessions -> test/reports/blank_slate/report.md

# Deterministic, no API (the same runner + scorer, scripted command path):
make test                # includes test/integration/test_blank_slate.py
```

Scoring (`python -m analysis.blank_slate_report <session.jsonl>`) reports a
**self-teaching completeness %** and a severity-ranked content-gap list tying each
stall to the room/quest, the command the walkthrough expected, and what that
room's scroll is supposed to teach.
