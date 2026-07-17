# 🎯 Bashcrawl Help System Quick Reference

## Activation

The intelligent help system can be activated in several ways:

### Method 1: Direct Execution
```bash
bash help.sh            # From the bashcrawl root directory
bash ../help.sh         # From a subdirectory (adjust ../ for depth)
```

### Method 2: Source the Init Script
```bash
source src/help/init_help.sh  # Enables 'help' command for the session
help                          # Now you can use the help command
```

### Method 3: Automatic (if .functions is sourced)
```bash
source entrance/.functions  # Loads all game functions including help
help                       # Help command is now available
```

## Usage Options

```bash
help                      # Show context-aware help for current location
help commands             # Detailed command reference
help map                  # Dungeon map
help reset                # How to reset the game
help merlin <question>    # Ask Merlin (the wizard hint engine)
help ask <question>       # Alias for 'help merlin'
```

### Merlin Hints (terminal-only)

Ask Merlin, the wizard hint engine, directly from your bash shell:

```bash
bash help.sh merlin "how do I find hidden files?"
bash help.sh ask "what does ls -F do?"
```

Merlin is a pure-bash hint engine driven by the YAML registries in `src/help/data/` — no API key, no Python, no network access required.

## Features

- **Context-Aware**: Adapts help content based on your current location
- **Progress-Aware**: Provides different guidance based on your experience level
- **Merlin Hints**: YAML-driven wizard hints via `help merlin <question>`
- **Location-Specific**: Tailored advice for each dungeon area
- **Interactive**: Responds to your current inventory and progress

## Smart Detection

The help system automatically detects:
- Your current location in the dungeon
- Items in your inventory ($I)
- Your health points ($HP)
- Areas you've explored
- Available files and executables in current area
- Whether you appear to be stuck (repeated commands)

## Integration

The help system integrates seamlessly with bashcrawl's existing mechanics:
- Uses the same color scheme and theming
- Respects game variables and state
- Provides guidance that enhances rather than spoils gameplay
- Encourages exploration and learning

Enjoy your enhanced terminal adventure! ⚔️
