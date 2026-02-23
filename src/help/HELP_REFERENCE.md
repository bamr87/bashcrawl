# 🎯 Bashcrawl Help System Quick Reference

## Activation

The intelligent help system can be activated in several ways:

### Method 1: Direct Execution
```bash
./help                  # From bashcrawl root directory
../help                 # From any subdirectory
```

### Method 2: Source the Alias
```bash
source .help_alias      # Enables 'help' command for the session
help                    # Now you can use the help command
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
help tips                 # Advanced tips and tricks
help merlin <question>    # Ask Merlin (AI wizard) via the terminal
help ask <question>       # Alias for 'help merlin'
```

### Merlin AI Bridge (terminal-only)

Ask the Merlin AI guide directly from your bash shell (no TUI needed):

```bash
bash help.sh merlin "how do I find hidden files?"
bash help.sh ask "what does ls -F do?"
```

Requires `ANTHROPIC_API_KEY` in your environment. Falls back to contextual
static hints if the key is absent.

## Features

- **Context-Aware**: Adapts help content based on your current location
- **Progress-Aware**: Provides different guidance based on your experience level
- **AI-Enhanced**: Intelligent suggestions based on game state
- **Merlin Chat Panel**: Real-time AI chat guide in the TUI (press F3)
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

## Merlin AI Chat Panel (TUI)

When using the Terminal Illness Textual TUI (`python -m ti`):

| Key / Command | Action |
|---|---|
| `F3` | Toggle the Merlin chat panel open/closed |
| `merlin <question>` | Open panel and ask Merlin in one step |
| `Escape` (in chat input) | Return focus to the game terminal |

Merlin responds in character as a wizard guide, offering Socratic hints
rather than direct answers. He proactively nudges you when you move to a
new room, take damage, complete a quest, or appear stuck.

## Integration

The help system integrates seamlessly with bashcrawl's existing mechanics:
- Uses the same color scheme and theming
- Respects game variables and state
- Provides guidance that enhances rather than spoils gameplay
- Encourages exploration and learning

Enjoy your enhanced terminal adventure! ⚔️
