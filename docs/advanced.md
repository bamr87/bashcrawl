# Advanced Topics

## Hidden Area Map

After unlocking hidden rooms, the full dungeon structure looks like this:

```
entrance/
├── cellar/armoury/chamber/        Main path (4 rooms)
├── workshop/                      Side room: mkdir, touch, rm, redirection
├── chapel/                        Hidden area 1
│   └── courtyard/
│       └── aviary/
│           └── hall/              Monster combat (dice-roll system)
│               └── library/       Contains a tome
├── vault/                         Hidden area 2
│   ├── stronghold/
│   │   ├── orb1                   Copy this to make orb2 and orb3
│   │   └── goblet                 Requires all 3 orbs; unlocks rift
│   └── stronghold/nursery/
│       └── lab/                   Ghost encounter
├── scrap/                         Hidden area 3: symlink tutorial
└── rift/                          Hidden area 4 (unlocked by goblet)
    ├── arena/pit/                 Advanced combat
    └── spire/mezzanine/           Elevator puzzle
```

## Adding New Rooms

1. Create a directory under the appropriate parent
2. Add a `scroll` file with educational content (see format below)
3. Create executable encounters with `chmod +x`
4. Wire the unlock in a prerequisite room's treasure: `mv ../../.newroom ../../newroom`
5. Add reset logic in `lib/reset.sh`
6. Test from entrance: `bash lib/reset.sh && cd entrance && cat scroll`

## Scroll Format Standards

Scrolls follow a depth-based format hierarchy defined in
`.github/instructions/scrolls.instructions.md`:

### Level 1 — Entrance (Pure ASCII)

```
================================================================================
                           SCROLL TITLE
================================================================================

Content uses === dividers, 80-char width, plain ASCII only.
No Markdown, no Unicode. Must be readable with cat.

COMMAND            PURPOSE
--------           --------
ls                 See room contents

================================================================================
```

### Level 2 — Intermediate (Unicode + Emoji)

```
################################################################################
#                         CHAMBER NAME                                        #
################################################################################

Content uses Unicode box-drawing (┌─┐), emoji, and
structured tables. Players know cat by this point.

┌───────────┬──────────────────────┐
│ COMMAND   │ PURPOSE              │
│ chmod +x  │ Make executable      │
└───────────┴──────────────────────┘
```

### Level 3 — Advanced (Full formatting)

Complex layouts, ANSI color hints, nested structures. Used for deep hidden areas.

## Executable Encounter Template

All game executables follow this structure:

```bash
#!/usr/bin/env bash
#
# If you are reading this, you have wandered out of bounds
# and are reading the code that drives the game.
#
#                    Congratulations!
#
# Learning Linux is all about curiosity, so read this code and see
# if you can figure out what it does.
#
# When you're ready to continue playing the game, though, stick to
# the scrolls. If you're stuck, go to Gitlab and create an issue.
# We're happy to provide hints.
#

# Game state checks (grep inventory, test $HP)
# Story output via cat << EOF heredocs
# Instruct player to run export commands
# Unlock hidden rooms via mv
```

Key rules:
- Use `cat << EOF` heredocs for story text — no ANSI colors
- Check inventory with `grep --quiet --only-matching 'item' <<< "$I"`
- Use `touch .flag_name` for state flags instead of renaming/deleting files
- Unlock rooms with `mv ../../.hidden ../../visible 2>/dev/null`

## Architecture

| Component | Purpose |
|-----------|---------|
| `main.sh` | Interactive launcher with menu system and integrated terminal emulator |
| `setup.sh` | Permissions setup, system validation |
| `help.sh` | Context-aware help entry point |
| `help/` | Help shim that delegates to `src/help.sh` |
| `src/help/` | Help engine components (AI tracking, tutorials, shared YAML data) |
| `lib/colors.sh` | Shared ANSI color constants |
| `lib/log.sh` | JSONL gameplay telemetry |
| `lib/reset.sh` | Comprehensive game state reset |
| `entrance/.functions` | Defines `gameover()` and `help()` functions |
| `src/terminal-illness/` | Python wrapper with Rich UI and quest system |

## Python Wrapper (terminal-illness)

The Python project at `src/terminal-illness/` wraps the real bash game with:
- Rich terminal panels and colorful output
- Quest progression tracking (pwd → ls → cd → mkdir → touch → cat → grep)
- Tab completion for game files and directories
- Persistent save/load via JSON

```bash
cd src/terminal-illness
pip install -r requirements.txt
python -m ti
```


## AI Agent Tests

The test suite ships an **AI-driven agent** (powered by Claude via the
Anthropic API) that plays through the game autonomously. It validates
progression, combat mechanics, error recovery, and help system usage without
human input.

### Prerequisites

```bash
# Install test dependencies
cd test && pip install -r requirements.txt

# Anthropic API key — required for all ai-marked tests
export ANTHROPIC_API_KEY="sk-ant-..."
```

### Running the tests

AI tests are skipped by default (`pytest.ini` excludes the `ai` marker).
Pass `-m ai` to opt in:

```bash
cd test

# All AI tests (may take several minutes)
pytest -m ai --timeout=120

# Individual test files
pytest -m ai test/ai/test_quest_completion.py     # Quest progression
pytest -m ai test/ai/test_full_playthrough.py     # Full + critical path
pytest -m ai test/ai/test_combat_encounters.py    # Combat with death/retry
pytest -m ai test/ai/test_error_recovery.py       # Navigation mistakes
pytest -m ai test/ai/test_help_usage.py           # Help system usage

# Verbose — see live commands printed to terminal
pytest -m ai -s -v test/ai/test_full_playthrough.py
```

### Available scenarios

Each test class uses a predefined **scenario** from `test/ai/scenarios.py`:

| Scenario | Max turns | Tags | Description |
|----------|-----------|------|-------------|
| `new_player` | 30 | quick, beginner | Learns `pwd`, `ls`, `cd`, `cat` in entrance and cellar |
| `critical_path` | 60 | medium, progression | Full main path: entrance → cellar → armoury → chamber |
| `full_playthrough` | 150 | slow, full | All rooms including hidden areas and endgame |
| `stuck_player` | 50 | medium, help | Stress-tests the help system with a confused agent |
| `combat_stress` | 80 | medium, combat | Combat encounters with death, retry, and recovery |
| `speed_run` | 40 | quick, speed | Minimum-command critical path, no detours |

**Cost guidance** — one agent turn makes one Anthropic API call. A
`new_player` or `speed_run` scenario (≤40 turns) is inexpensive. A
`full_playthrough` at 150 turns costs proportionally more. Check
[Anthropic pricing](https://www.anthropic.com/pricing) for current rates.

### Watching a test live in the Observatory Viewer

The agent writes every event to `logs/live_agent.jsonl` in real time. The
Observatory Viewer tails this file and streams it to the browser via SSE.

Open two terminals before starting a test run:

```bash
# Terminal A — start the viewer
python3 -m src.viewer

# Terminal B — run the AI tests
cd test && pytest -m ai -s
```

Then open **http://127.0.0.1:5000/live/agent** in your browser. The page
connects via SSE and displays each agent command, its output, the agent's
current room, inventory, and HP as the test progresses — no manual refresh.

The `/live/agent` page shows:

- Session header (test name, goal, max turns)
- Color-coded event feed (commands, API calls, rate-limit pauses, session end)
- Current room, inventory, and HP — updated after every command
- Session end summary (exit reason, rooms visited, total turns, elapsed time)

See [docs/viewer.md](viewer.md) for the full element reference and all live
API endpoints (`/api/live/agent/stream`, `/api/live/agent/status`,
`/api/live/agent/events`).

### Viewing completed test results

Closed sessions are retained in the JSONL log files and appear immediately in
the viewer:

| Page | URL | What to look for |
|------|-----|------------------|
| Session list | `/sessions` | Filter by mode `ai_test` |
| Session detail | `/sessions/<sid>` | Full event timeline, room path, HP graph |
| Screenshots | `/screenshots` | SVG captures linked to the session |
| Feedback | `/feedback` | AI self-evaluation reports |
| Analytics | `/analytics` | AI sessions included in all aggregate charts |

### Test artifacts

| Artifact | Location | Description |
|----------|----------|-------------|
| Live event log | `logs/live_agent.jsonl` | Truncated at session start; not persisted across runs |
| Session JSONL | `logs/sessions/<sid>.jsonl` | Persistent record written by `lib/log.sh` |
| Screenshots | `logs/screenshots/<dir>/` | SVG captures (if agent takes screenshots) |
| Feedback reports | `logs/feedback/<sid>.md` | AI self-evaluation Markdown |

### Agent internals (`test/ai/agent.py`)

- Uses the **Anthropic Messages API** with rolling conversation history.
- Default model: `claude-sonnet-4-20250514` — change `DEFAULT_MODEL` to swap.
- Hard limits per session: `DEFAULT_MAX_TURNS = 30` turns and
  `DEFAULT_MAX_ELAPSED_SECONDS = 90` seconds (overridable per scenario).
- Rate-limited to `DEFAULT_REQUESTS_PER_MINUTE = 20` to avoid throttling.
- Raises `AgentExhausted` (turn budget spent) or `AgentTimeout` (wall-clock
  exceeded) — both are caught in test assertions and treated as graceful stops.
