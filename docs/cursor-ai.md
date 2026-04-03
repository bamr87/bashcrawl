# Cursor AI and automation

Bashcrawl supports several complementary ways for tools (including Cursor’s AI and browser automation) to drive the game without fragile keystrokes.

## 1. JSON stdio bridge (recommended for Cursor terminal)

Runs the same `TerminalEngine` as the TUI, but with **one JSON object per line** on stdout and **one command per line** on stdin. No Textual UI, no browser.

```bash
cd /path/to/bashcrawl
PYTHONPATH=src/terminal-illness python3 -m ti --ai-stdio --game-root "$PWD"
```

Or:

```bash
./main.sh --ai-stdio
```

First line is always a `ready` message. For each command you send, you get a `result` object with engine output and a small **state snapshot** (cwd, HP, XP, quest text, room listing).

Send `EXIT` or `QUIT` on its own line to save and end.

This is the most reliable option for scripted agents and for Cursor’s **Run in terminal** workflows.

## 2. MCP server (Cursor / Claude tools)

The **bashcrawl** MCP server exposes tools such as `bashcrawl_start`, `bashcrawl_command`, `bashcrawl_state`, `bashcrawl_room`, `bashcrawl_completions`, `bashcrawl_screenshot` (headless sessions only), and `bashcrawl_stop`. It uses stdio transport (Model Context Protocol).

```bash
cd /path/to/bashcrawl
PYTHONPATH=src/terminal-illness python3 -m ti.mcp_server
```

- **`mode=engine`** when starting a session: fast, same `TerminalEngine` as the TUI; no screenshots.
- **`mode=headless`**: full Textual app under `run_test`; use `bashcrawl_screenshot` for SVG captures.

Cursor can load the server via [`.cursor/mcp.json`](../.cursor/mcp.json) in this repo (`PYTHONPATH` points at `src/terminal-illness`).

**Resources:** `bashcrawl://help` (command summary), `bashcrawl://map` (exploration hints).

### MCP test command

Run the MCP integration tests with an isolated project virtualenv:

```bash
make test-mcp
```

This avoids system-level `pip` issues on macOS/Homebrew Python (PEP 668).

## 3. Existing agent mode (Textual + SVG screenshots)

For visual grounding and screenshot-based agents, use the protocol in [agent-protocol.md](agent-protocol.md):

```bash
./main.sh --agent
```

## 4. Browser + automation styling

When you serve the Textual web UI, enable **automation mode** so the command bar is visually obvious and welcome/load modals are skipped (same as normal web sessions):

```bash
PYTHONPATH=src/terminal-illness python3 -m ti --web --automation --game-root "$PWD"
```

Or use `./main.sh --web`, which passes `--automation` for you.

This sets `BASHCRAWL_BROWSER_AUTOMATION=1` in the server process so child sessions inherit clearer styling. The hidden browser textarea used by Textual may still limit some automation tools; prefer **JSON stdio** for fully programmatic control.

## Environment variables

| Variable | Effect |
|----------|--------|
| `BASHCRAWL_WEB_MODE=1` | Set by `textual-serve`; per-session saves under `.game_data/sessions/web-<pid>/`. |
| `BASHCRAWL_BROWSER_AUTOMATION=1` | Stronger command-bar CSS; skip startup modals. |

## Resetting game state

To restore the repo to a fresh playable state (re-hide unlocked rooms, remove
runtime artifacts, and clear save files), run:

```bash
bash lib/reset.sh
```

Preview only:

```bash
bash lib/reset.sh --dry
```

## Space key in the browser

Some browser / automation drivers do not deliver **Space** reliably to Textual’s hidden input, so lines like `cd cellar` arrive as **`cdcellar`**. The game engine now normalizes **`cd` + path** when the whole line is a single token (for example `cdcellar` → `cd cellar`). Prefer **`--ai-stdio`** or **`./main.sh --agent`** when you need perfect input fidelity.
