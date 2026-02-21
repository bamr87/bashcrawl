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

# Bash-only agent REPL (no Python required, no screenshots)
./main.sh --agent-bash
```

Or invoke the Python module directly:

```bash
PYTHONPATH=src/terminal-illness python3 -m ti.agent \
    --game-root /path/to/bashcrawl \
    --screenshot-dir ./screenshots
```

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
| `--screenshot-dir PATH` | Directory for SVG screenshot output (default: `./screenshots`) |

### `python3 -m ti.agent` Flags

| Flag | Description |
|------|-------------|
| `--game-root PATH` | Path to the bashcrawl repository root |
| `--screenshot-dir PATH` | Directory for SVG screenshot output (default: `./screenshots`) |
| `--no-auto-screenshot` | Disable automatic screenshots after each command |

---

## Screenshots

Screenshots are saved as SVG files using Textual's `App.save_screenshot()` method.
Each SVG is a complete rendering of the TUI at that moment, including the sidebar
(quests, inventory, room info) and the main terminal output area.

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
| ./main.sh --agent --screenshot-dir ./playthrough_screenshots 2>/dev/null
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
