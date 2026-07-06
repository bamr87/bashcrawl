# Getting Started

## Prerequisites

- A terminal (bash or zsh on macOS/Linux, or WSL on Windows)
- Git (for cloning)
- No other dependencies for the bash game
- Python 3.10+ (optional — only for developer tooling and the playtest harness)

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

### Web Trainer (browser)

A static, dependency-free web app with the same rooms, scrolls, and encounters:

```bash
make web-preview      # serves web/ at http://127.0.0.1:8000
```

Or simply open `web/index.html` in a browser. Rebuild the bundle from the game
content with `make web-build`.

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

## Playtest Harness (AI agents)

A lean MCP server lets AI agents play the game headlessly in a sandbox:

```bash
PYTHONPATH=src python3 -m playtest.mcp_server    # start the MCP server
PYTHONPATH=src python3 -m playtest.scorer        # score a recorded session
```

## Next Steps

Read the [Gameplay Guide](gameplay.md) for mechanics, or just `cat scroll` and follow
the instructions. The game teaches you as you play.
