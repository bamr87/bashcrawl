# Bashcrawl Logging Framework Plan

Automatic gameplay telemetry to replace manual session logging and generate
actionable improvement data.

---

## Current State

Three disconnected logging systems exist, each with a different format and scope:

| System | Format | Scope | Gap |
|--------|--------|-------|-----|
| `main.sh` `log_event()` | `[ts] [LEVEL] [ctx] msg` → `logs/bashcrawl.log` | Launcher lifecycle only | Stops at game launch |
| `ai_engine.sh` `log_action()` | `ts\|location\|action\|ctx` → `~/.bashcrawl_progress` | Help requests only | Only fires when player asks for help |
| `main.sh` (emulator) | `ts - command [args]` → `.game_history` | Emulator commands | Only in emulator mode, not native |

**Native play** (`cd entrance && cat scroll`) — the most common mode — has **zero
instrumentation**. Game executables (`treasure`, `statue`, `monster`, etc.) perform
critical state mutations (room unlocks, item destruction, deaths) without logging
anything.

The `.gitignore` already reserves filenames for planned-but-never-built logs:
`room-visits.log`, `command-history.log`, `treasure-collection.log`, `session-*.log`.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Player Shell (native mode)                             │
│                                                         │
│  ┌───────────────────────────────────────────┐          │
│  │  PROMPT_COMMAND / chpwd hook              │──────┐   │
│  │  Detects room changes, logs navigation    │      │   │
│  └───────────────────────────────────────────┘      │   │
│                                                      │   │
│  ┌───────────────────────────────────────────┐      │   │
│  │  Game executables (treasure, statue, etc.) │      │   │
│  │  Call bc_log() for encounters/outcomes     │──┐   │   │
│  └───────────────────────────────────────────┘  │   │   │
│                                                  │   │   │
│  ┌───────────────────────────────────────────┐  │   │   │
│  │  help system (bashcrawl_help.sh)          │  │   │   │
│  │  Calls bc_log() for help requests         │──┤   │   │
│  └───────────────────────────────────────────┘  │   │   │
│                                                  ▼   ▼   │
│  ┌───────────────────────────────────────────────────┐   │
│  │  lib/log.sh                                       │   │
│  │  bc_log() — single entry point                    │   │
│  │  bc_session_start() / bc_session_end()            │   │
│  │  Writes JSONL to logs/sessions/<id>.jsonl         │   │
│  └──────────────────────┬────────────────────────────┘   │
│                         │                                 │
└─────────────────────────┼─────────────────────────────────┘
                          ▼
              logs/sessions/<session-id>.jsonl
              logs/feedback/<date>-summary.md
```

---

## Components

### 1. `lib/log.sh` — Unified Logging Library

Single sourceable file that every component uses. Replaces the three existing
log functions with one consistent interface.

**Key functions:**

```bash
# Source: source lib/log.sh

bc_log <event_type> <key=value pairs...>
# Appends one JSONL line to the active session log.
# All events auto-include: timestamp, session_id, pwd, $I, $HP

bc_session_start
# Creates logs/sessions/<session_id>.jsonl
# Records start time, entry mode, shell version, OS

bc_session_end
# Appends session_end event with duration, rooms visited count,
# treasures collected, commands learned

bc_install_hooks
# Sets PROMPT_COMMAND (bash) or chpwd (zsh) to detect room changes.
# Detects game-directory vs non-game directory to avoid noise.
```

**Log format — JSONL (one JSON object per line):**

```json
{"ts":"2026-02-16T10:23:01","sid":"a1b2c3","event":"room_enter","room":"cellar","path":"entrance/cellar","inventory":"amulet,","hp":100}
{"ts":"2026-02-16T10:23:20","sid":"a1b2c3","event":"encounter","type":"treasure","room":"cellar","outcome":"collected","item":"amulet"}
{"ts":"2026-02-16T10:23:21","sid":"a1b2c3","event":"room_unlock","room":"chapel","trigger":"cellar/treasure"}
{"ts":"2026-02-16T10:24:30","sid":"a1b2c3","event":"encounter","type":"statue","room":"chamber","outcome":"won","hp_before":15,"hp_after":10}
{"ts":"2026-02-16T10:25:41","sid":"a1b2c3","event":"encounter","type":"monster","room":"hall","outcome":"won","rolls":2,"hp_before":10,"hp_after":5}
{"ts":"2026-02-16T10:25:43","sid":"a1b2c3","event":"death","room":"hall","cause":"monster","hp":0}
```

**Why JSONL:**
- One line per event — `grep`, `jq`, `wc -l` all work naturally
- Machine-parseable for analysis scripts
- Teaches `jq` as an advanced command (potential future scroll content)
- Append-only — no file corruption from concurrent writes
- `cat` still readable enough for curious players

**Implementation notes:**
- Pure bash, no external deps beyond `date` (avoid `jq` for writing)
- Each line constructed via string interpolation, not a JSON library
- Session ID: first 8 chars of `$(date +%s | shasum | head -c 8)` or `$$`
- Detect game root via `BASHCRAWL_ROOT` or by walking up to find `entrance/`
- Guard clause: if `BASHCRAWL_LOG=off`, all functions become no-ops

---

### 2. Room Navigation Tracking

**Mechanism:** `PROMPT_COMMAND` (bash) / `chpwd` (zsh) hook.

```bash
_bc_track_room() {
    local current_dir="$PWD"
    # Only track if inside the game tree
    [[ "$current_dir" == *"/entrance"* ]] || return
    # Only log if directory actually changed
    [[ "$current_dir" == "$_BC_LAST_DIR" ]] && return
    _BC_LAST_DIR="$current_dir"
    # Extract relative room path
    local room="${current_dir##*entrance/}"
    [[ -z "$room" ]] && room="entrance"
    bc_log room_enter room="$room" path="$current_dir"
}
```

**Installed by:** `bc_install_hooks` (called from `init_help.sh` or `main.sh
--native`). Also available manually: `source lib/log.sh && bc_install_hooks`.

**Data captured:**
- Every `cd` into a game directory
- Timestamp per room → enables time-in-room calculation (diff between entries)
- Room visit counts (from log analysis, not runtime tracking)

---

### 3. Game Executable Instrumentation

Add `bc_log` calls to each game executable. Minimal changes — 2-4 lines per file.

**Pattern for all executables:**

```bash
#!/usr/bin/env bash
# ... existing boilerplate ...

# Source logging (fail silently if not available)
_BC_LIB="$(cd "$(dirname "$0")" && pwd)"
_BC_LIB="${_BC_LIB%entrance*}lib/log.sh"
[ -f "$_BC_LIB" ] && . "$_BC_LIB"
```

Then add `bc_log` at key decision points:

| File | Events to Log |
|------|---------------|
| `cellar/treasure` | `encounter type=treasure outcome=collected item=amulet` |
| | `room_unlock room=chapel trigger=cellar/treasure` |
| | `room_unlock room=vault trigger=cellar/treasure` |
| `armoury/potion` | `encounter type=potion outcome=used\|stale hp_after=$HP` |
| `armoury/treasure` | `encounter type=treasure outcome=collected item=sword` |
| `chamber/treasure` | `encounter type=treasure outcome=collected item=coins` |
| `chamber/spell` | `encounter type=spell outcome=read\|cast cmd=ln` |
| `chamber/statue` | `encounter type=statue outcome=won\|fled\|died hp_before hp_after` |
| | `side_effect action=mv target=statue→pieces` |
| | `side_effect action=perl target=treasure` |
| `hall/monster` | `encounter type=monster outcome=won\|fled\|died rolls=N hp_before hp_after` |
| | `side_effect action=mv target=monster→carcass` |
| `lab/ghost` | `encounter type=ghost outcome=won\|fled\|died hp_before hp_after` |
| `stronghold/goblet` | `encounter type=puzzle outcome=solved\|hint item=goblet` |
| `.functions` `gameover()` | `death room=$(basename $PWD) cause=$_BC_ENCOUNTER` |

**Graceful degradation:** If `lib/log.sh` isn't sourced (player ran game without
setup), `bc_log` is undefined and the `[ -f "$_BC_LIB" ] && . "$_BC_LIB"` guard
means the executable works identically to today.

---

### 4. Session Lifecycle

**Start:** Triggered by any of:
- `main.sh` launch (any mode)
- `source lib/log.sh && bc_session_start` (manual)
- `source src/help/init_help.sh` (which will source `lib/log.sh`)
- First `bc_log` call auto-starts a session if none exists

**End:** Triggered by:
- `trap bc_session_end EXIT` set during `bc_session_start`
- Shell exit / terminal close

**Session file:** `logs/sessions/<YYYY-MM-DD>_<session_id>.jsonl`

**Session metadata (first and last lines):**

```json
{"ts":"...","event":"session_start","sid":"a1b2c3","mode":"native","shell":"bash-5.2","os":"darwin","term":"xterm-256color"}
...events...
{"ts":"...","event":"session_end","sid":"a1b2c3","duration_sec":300,"rooms_visited":8,"treasures":3,"deaths":0,"help_requests":2}
```

---

### 5. Feedback Report Generator — `lib/report.sh`

Reads JSONL session logs and produces a human-readable Markdown summary.

**Usage:** `bash lib/report.sh [session_file|all|latest]`

**Output:** `logs/feedback/<date>-summary.md`

**Report sections:**

```markdown
# Bashcrawl Session Report — 2026-02-16

## Session Overview
- Duration: 12m 30s
- Rooms visited: 8 / 16 total
- Treasures collected: 3 (amulet, sword, coins)
- Deaths: 1 (statue in chamber)
- Help requests: 2

## Room Flow
entrance → cellar (2m) → armoury (1m) → chamber (3m) → chapel (30s) → ...

## Encounter Outcomes
| Encounter | Room     | Result | HP Change |
|-----------|----------|--------|-----------|
| treasure  | cellar   | won    | 0         |
| potion    | armoury  | stale  | 0         |
| statue    | chamber  | died   | -15       |

## Stuck Points
- Spent 3m in chamber before engaging statue (possible confusion)
- Visited armoury 4 times (backtracking)

## Commands Learned (by room)
- entrance: ls, cd, cat
- cellar: ls -F, alias
- armoury: ./executable, chmod
- chamber: cd .., pwd

## Suggestions
- Chamber scroll is too sparse (15 lines) — player may not understand encounters
- Player never visited: vault, stronghold, .rift, nursery, lab
- Potion showed stale state — reset mechanism needed
```

**Implementation:** Pure bash + `awk`/`sed`/`sort`/`uniq`. No external deps.
Optionally supports `jq` for faster parsing if available.

---

### 6. Aggregate Analytics — `lib/analyze.sh`

Reads ALL session files and produces cross-session metrics for developers.

**Usage:** `bash lib/analyze.sh`

**Output:** `logs/feedback/analytics.md`

**Metrics:**

| Metric | How Computed |
|--------|-------------|
| **Room drop-off** | % of sessions that reach each room — identifies where players quit |
| **Average time-in-room** | Median seconds between `room_enter` events per room |
| **Encounter success rate** | Win/loss/flee ratio per encounter type |
| **Most common stuck points** | Rooms with >3 visits and >2 help requests |
| **Death hotspots** | Rooms ranked by death count |
| **Command coverage** | Which rooms' scroll commands are actually used |
| **Session completion rate** | % of sessions reaching final rooms |
| **Help dependency** | Correlation between help requests and progress |

---

## File Layout

```
lib/
    log.sh              # Core logging library (source this)
    report.sh           # Single-session feedback generator
    analyze.sh          # Cross-session analytics
logs/
    sessions/           # JSONL session files (gitignored)
        2026-02-16_a1b2c3.jsonl
        2026-02-16_d4e5f6.jsonl
    feedback/           # Generated reports (gitignored)
        2026-02-16-summary.md
        analytics.md
    bashcrawl.log       # Existing launcher log (unchanged)
    setup.log           # Existing setup log (unchanged)
```

---

## Integration Points

### `main.sh` — Launcher

```bash
# At launch, after environment validation:
source "${BASHCRAWL_ROOT}/lib/log.sh"
bc_session_start

# In launch_native_mode(), add to player instructions:
echo "   source ${BASHCRAWL_ROOT}/lib/log.sh && bc_install_hooks"

# Replace existing log_event() calls with bc_log for new events, but keep
# log_event() for backward compatibility — it still writes bashcrawl.log
```

### `src/help/init_help.sh` — Help System Init

```bash
# Source logging alongside help functions:
source "${BASHCRAWL_ROOT}/lib/log.sh"
bc_install_hooks  # Start tracking room navigation
```

### `src/help/ai_engine.sh` — AI Engine

Replace `log_action()` internals to delegate to `bc_log`:

```bash
log_action() {
    local action="$1" context="$2"
    # Maintain backward-compatible pipe-delimited file
    echo "$(date '+%Y-%m-%d %H:%M:%S')|$(basename $(pwd))|$action|$context" >> "$PROGRESS_FILE"
    # Also log via unified system
    type bc_log &>/dev/null && bc_log "$action" context="$context"
}
```

### `main.sh` — Terminal Emulator (integrated)

Add to the command execution loop:

```bash
# After execute_command(), before prompt:
type bc_log &>/dev/null && bc_log command cmd="$user_input" room="$(basename $PWD)"
```

### Game Executables — Batch Instrumentation

Add sourcing block + event logging to each executable. Template:

```bash
# After the 14-line boilerplate comment, before game logic:
_BC_LIB="${0%entrance*}lib/log.sh"
[ -f "$_BC_LIB" ] 2>/dev/null && . "$_BC_LIB"
```

---

## Implementation Phases

### Phase 1: Core Library + Session Management
**Effort:** ~150 lines of bash
**Files:** Create `lib/log.sh`
**Delivers:** `bc_log`, `bc_session_start`, `bc_session_end`, JSONL output

### Phase 2: Room Navigation Hooks
**Effort:** ~30 lines added to `lib/log.sh`
**Files:** Modify `src/help/init_help.sh`, `main.sh`
**Delivers:** Automatic `room_enter` events via `PROMPT_COMMAND`/`chpwd`

### Phase 3: Executable Instrumentation
**Effort:** 2-6 lines per file, ~12 files
**Files:** All executables under `entrance/`
**Delivers:** Encounter/outcome/unlock/death events

### Phase 4: Report Generator
**Effort:** ~200 lines of bash
**Files:** Create `lib/report.sh`
**Delivers:** Per-session Markdown feedback from `bash lib/report.sh latest`

### Phase 5: Aggregate Analytics
**Effort:** ~150 lines of bash
**Files:** Create `lib/analyze.sh`
**Delivers:** Cross-session metrics for game development

### Phase 6: Retrofit Existing Systems
**Effort:** Small edits
**Files:** `main.sh`, `src/help/ai_engine.sh`
**Delivers:** Unified logging across all entry points

---

## Privacy & Opt-out

- All logs are local-only (`.gitignore` covers `logs/sessions/`, `logs/feedback/`)
- `export BASHCRAWL_LOG=off` disables all logging (checked in `bc_log`)
- No PII captured — only game state, room paths, and timestamps
- `bash lib/report.sh --purge` deletes all session data
- Logged paths are relative to game root, not absolute filesystem paths

---

## .gitignore Additions

```gitignore
# Session telemetry (local only)
logs/sessions/
logs/feedback/
```

---

## Testing

```bash
# Unit test: verify log output format
source lib/log.sh
bc_session_start
bc_log room_enter room=cellar hp=100
bc_log encounter type=treasure outcome=collected item=amulet
bc_session_end
cat logs/sessions/*.jsonl | head -5  # Inspect format

# Integration test: play through with logging
source lib/log.sh && bc_install_hooks
cd entrance && cat scroll
cd cellar && ./treasure
# Check logs/sessions/*.jsonl for room_enter + encounter events

# Report test
bash lib/report.sh latest
cat logs/feedback/*-summary.md
```
