# Getting Started

## Prerequisites

- A terminal (bash or zsh on macOS/Linux, or WSL on Windows)
- Git (for cloning)
- No other dependencies for the bash game
- Python 3.10+ for the Python wrapper mode (optional)

## Installation

### Option 1: Clone and Play (Recommended)

```bash
git clone https://github.com/bamr87/bashcrawl.git
cd bashcrawl
bash setup.sh     # Sets permissions and validates environment
cd entrance
cat scroll        # Begin your adventure!
```

### Option 2: Play Online via Binder

[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/bamr87/bashcrawl/HEAD)

No installation required — opens in your browser.

### Option 3: Download ZIP (macOS)

macOS's Archive Utility may strip execute permissions. Use the terminal instead:

```bash
curl -L https://github.com/bamr87/bashcrawl/archive/main.zip -o bashcrawl.zip
unzip bashcrawl.zip
cd bashcrawl-main
bash setup.sh
cd entrance && cat scroll
```

## Play Modes

### Native Terminal (default)

Navigate the real filesystem. Directories are rooms, files are objects.

```bash
cd entrance && cat scroll
```

### Launcher Menu

Interactive menu with options for tutorials, settings, and game management:

```bash
bash main.sh
```

### Terminal Emulator

Self-contained terminal with quest tracking, XP, and guided progression:

```bash
bash main.sh --interactive
```

### Python Wrapper

Rich terminal UI with quest bars, colorful panels, and tab completion:

```bash
cd src/terminal-illness
pip install -r requirements.txt
python -m ti
```

## Help System

Activate context-aware help from anywhere in the game:

```bash
# One-time activation (persists in current shell)
source src/help/init_help.sh

# Then use from any room
help              # Context-aware tips for current location
help commands     # Command quick reference
help map          # Dungeon map
help reset        # How to reset the game
```

Or run directly:

```bash
bash help.sh
```

## Resetting the Game

```bash
bash lib/reset.sh          # Smart reset — re-hides rooms, clears state
bash lib/reset.sh --dry    # Preview what would be reset
```

## Observatory Viewer

The **Bashcrawl Observatory** is a web portal for browsing session logs,
screenshots, and analytics collected while playing.

```bash
# Install viewer dependencies (once)
pip install -r src/viewer/requirements.txt

# Launch
python3 -m src.viewer
# Opens at http://127.0.0.1:5000/
```

See [docs/viewer.md](viewer.md) for the full user guide.

## AI Agent Tests

The test suite includes an **AI agent** (powered by Claude) that plays through
the game autonomously, checking progression, combat, error recovery, and help
usage. You need an [Anthropic API key](https://console.anthropic.com/) to run
these tests.

### Setup

```bash
# Install test dependencies (once)
cd test && pip install -r requirements.txt && cd ..

# Set your API key
export ANTHROPIC_API_KEY="sk-ant-..."
```

### Run AI tests

```bash
cd test

# Quick new-player scenario (~30 turns, ~30s)
pytest -m ai test/ai/test_quest_completion.py

# Main critical path (entrance → cellar → armoury → chamber)
pytest -m ai test/ai/test_full_playthrough.py::TestCriticalPath

# Full playthrough including hidden rooms (~150 turns, up to 5 min)
pytest -m ai test/ai/test_full_playthrough.py --timeout=300

# All AI tests
pytest -m ai --timeout=120
```

### Watch progress live

While AI tests run, open the Observatory Viewer in a second terminal to watch
the agent play in real time:

```bash
# Terminal 1 — start the viewer
python3 -m src.viewer

# Terminal 2 — run the AI tests
cd test && pytest -m ai -s
```

Then open **http://127.0.0.1:5000/live/agent** in your browser. The page
tails `logs/live_agent.jsonl` via SSE and displays each command, its output,
the agent's current room, inventory, and HP as the test progresses.

After the tests finish, completed sessions appear in
**http://127.0.0.1:5000/sessions** (filter by mode `ai_test`) and any
captured screenshots are in **http://127.0.0.1:5000/screenshots**.

See [Advanced Topics](advanced.md#ai-agent-tests) for the full list of
scenarios, cost estimates, and tips.

## Next Steps

Read the [Gameplay Guide](gameplay.md) for mechanics, or just `cat scroll` and follow
the instructions. The game teaches you as you play.
