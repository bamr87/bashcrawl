# Web Frontend API Design (Phase 2 Proposal)

Design specification for a future custom browser-based Bashcrawl frontend,
decoupled from Textual. This is a proposal that would replace the current
`textual-serve` proxy with a purpose-built WebSocket API and xterm.js frontend.

---

## Current Implementation (Phase 1)

```bash
# Current web mode (Textual served in browser)
./main.sh --web

# Or directly via Python module
PYTHONPATH=src/terminal-illness python3 -m ti --web --game-root "$PWD"
```

Open `http://localhost:8080` in any browser to play.

---

## Target Architecture (Phase 2)

## Architecture

```text
Browser                          Server
  │                                │
  │  ── ws://host:port/ws ──────> │  WebSocket connection
  │                                │  Creates TerminalEngine + GameState
  │  <── { type: "init", ... } ── │  Initial state payload
  │                                │
  │  ── { type: "cmd", ... } ──> │  Player command
  │  <── { type: "output", ... }  │  Command output
  │  <── { type: "state", ... }   │  Updated game state
  │                                │
  │  ── { type: "tab", ... } ──> │  Tab completion request
  │  <── { type: "completions" }  │  Completion candidates
  │                                │
  │  ── { type: "close" } ──────> │  Disconnect
  │                                │
```

---

## WebSocket Protocol

All messages are JSON objects with a `type` field.

### Client -> Server

#### `cmd` — Execute a command

```json
{
  "type": "cmd",
  "command": "cd cellar"
}
```

#### `tab` — Request tab completions

```json
{
  "type": "tab",
  "text": "cd cel"
}
```

#### `close` — Graceful disconnect (triggers save)

```json
{
  "type": "close"
}
```

### Server -> Client

#### `init` — Sent on connection, initial game state

```json
{
  "type": "init",
  "state": {
    "player_name": "Anonymous",
    "hp": 100,
    "xp": 0,
    "inventory": "",
    "current_location": "/entrance",
    "current_quest_id": 0,
    "completed_quest_ids": [],
    "mode": "classic"
  },
  "room": {
    "cwd": "/entrance",
    "items": ["cellar/", "scroll", "treasure*"]
  },
  "quest": {
    "title": "First Steps",
    "objective": "Use pwd to find your location",
    "total": 8,
    "done": 0
  },
  "welcome": "Welcome to BASHCRAWL..."
}
```

#### `output` — Command execution result

```json
{
  "type": "output",
  "kind": "success",
  "message": "Moved to /entrance/cellar"
}
```

`kind` is one of: `output`, `success`, `error`, `info`, `magic`.

#### `state` — Updated game state (sent after every command)

```json
{
  "type": "state",
  "state": { "hp": 100, "xp": 50, "inventory": "amulet", "..." : "..." },
  "room": { "cwd": "/entrance/cellar", "items": ["armoury/", "scroll", "treasure*"] },
  "quest": { "title": "...", "objective": "...", "total": 8, "done": 1 }
}
```

#### `quest_complete` — Quest completion notification

```json
{
  "type": "quest_complete",
  "quest_title": "First Steps",
  "reward": "+100 XP"
}
```

#### `completions` — Tab completion results

```json
{
  "type": "completions",
  "candidates": ["cellar/", "scroll", "treasure*"]
}
```

#### `error` — Protocol-level error

```json
{
  "type": "error",
  "message": "Invalid message format"
}
```

---

## REST Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/` | Serve the frontend SPA |
| `GET` | `/api/health` | Server health check |
| `GET` | `/api/session/:id` | Get session metadata |
| `POST` | `/api/session/new` | Create new session, returns session ID |
| `WS` | `/ws?session=:id` | WebSocket game connection |

---

## Backend Implementation

Located at `src/web/`:

```text
src/web/
  __init__.py
  __main__.py          # Entry point
  server.py            # FastAPI/Flask app + WebSocket handler
  session_manager.py   # Session lifecycle, per-session TerminalEngine
  static/
    index.html         # SPA entry point
    css/
      game.css         # Game layout styles
    js/
      app.js           # Main application
      terminal.js      # xterm.js wrapper
      sidebar.js       # Quest/inventory/room panels
      websocket.js     # WebSocket client
```

### Session Manager

Each WebSocket connection creates a `Session` with:

- Unique session ID (UUID4)
- `TerminalEngine` instance
- `GameState` with per-session save path
- `GameFileSystem` (shared read-only game root, writable session dir)

```python
class Session:
    id: str
    engine: TerminalEngine
    state: GameState
    fs: GameFileSystem
    created_at: datetime
    last_active: datetime
```

Sessions are cleaned up after 30 minutes of inactivity.

---

## Frontend Design

### Layout

Mirrors the Textual TUI layout:

```text
┌─────────────────────────────────────────────────────────────┐
│  Header: BASHCRAWL  •  player  •  HP bar  •  XP            │
├────────────────┬────────────────────────────────────────────┤
│  Quest Panel   │                                            │
│  ────────────  │  xterm.js terminal                         │
│  Inventory     │  (command output area)                     │
│  ────────────  │                                            │
│  Room Panel    │                                            │
│  /path         │                                            │
│  📁 dirs       │                                            │
│  📄 files      │                                            │
├────────────────┴────────────────────────────────────────────┤
│  /path $  [command input]                                   │
└─────────────────────────────────────────────────────────────┘
```

### Technologies

- **xterm.js** for the terminal output area (ANSI color support, scrollback)
- Vanilla JS or lightweight framework (Preact) for sidebar panels
- CSS Grid/Flexbox for layout
- WebSocket API for real-time communication

### Key Behaviors

- **Tab completion**: On Tab keypress, send `tab` message, display candidates
  inline or as a popup
- **Command history**: Maintained client-side, Up/Down arrow navigation
- **Responsive**: Sidebar collapses on narrow viewports
- **Mobile**: Touch-friendly command input, virtual keyboard support

---

## Security Considerations

- All filesystem operations sandboxed by `GameFileSystem`
- Game script execution (`subprocess.run`) only within container
- WebSocket rate limiting: max 10 commands/second per session
- Session token required for WebSocket connections
- No shell escape — only commands registered in `TerminalEngine`
- Container runs as non-root user

---

## Migration Path from Phase 1

Current behavior is:

```bash
./main.sh --web              # Phase 1 textual-serve
```

When Phase 2 is implemented, introduce a distinct opt-in flag first (for example
`--web-api`) and keep `--web` mapped to the current behavior until the new
frontend is stable.
