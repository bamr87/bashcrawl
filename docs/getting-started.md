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
curl -L https://github.com/bamr87/bashcrawl/archive/master.zip -o bashcrawl.zip
unzip bashcrawl.zip
cd bashcrawl-master
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
source help/init_help.sh

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

## Next Steps

Read the [Gameplay Guide](gameplay.md) for mechanics, or just `cat scroll` and follow
the instructions. The game teaches you as you play.
