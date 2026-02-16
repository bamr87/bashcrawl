# Bashcrawl Help System

Context-aware assistance for players navigating the bashcrawl adventure.

## Architecture

```
help.sh                  ← Main entry point (project root)
help/
├── init_help.sh         ← Source to enable 'help' shell function
├── bashcrawl_help.sh    ← Context-aware help engine
├── ai_engine.sh         ← Player progress tracking & pattern analysis
├── command_suggester.sh ← Directory-aware command recommendations
├── tutorial_engine.sh   ← Interactive tutorial system
├── quick_ref.sh         ← Quick reference cards
├── HELP_REFERENCE.md    ← Help system documentation
└── README.md            ← This file
```

## Quick Start

```bash
# Option 1: Run directly
bash help.sh              # Context-aware help
bash help.sh commands     # Command quick reference
bash help.sh map          # Dungeon map
bash help.sh reset        # Reset instructions

# Option 2: Enable as shell function (persistent)
source src/help/init_help.sh
help                      # Then use from anywhere
```

## How It Works

1. `help.sh` is the single entry point — all other scripts reference it
2. It sources `src/help/bashcrawl_help.sh` which detects the player's location
3. `ai_engine.sh` tracks progress patterns and detects when players are stuck
4. `command_suggester.sh` analyzes current directory contents for relevant tips
5. `init_help.sh` registers `help` as a shell function for seamless gameplay

## Integration

- Uses `lib/colors.sh` for consistent theming
- Logs help usage via `lib/log.sh` when available
- Reads game variables (`$I`, `$HP`) for progress-aware guidance
- Works from any directory within the bashcrawl game tree
