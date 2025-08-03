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
help                    # Show context-aware help for current location
help commands          # Detailed command reference
help tips              # Advanced tips and tricks
```

## Features

- **Context-Aware**: Adapts help content based on your current location
- **Progress-Aware**: Provides different guidance based on your experience level
- **AI-Enhanced**: Intelligent suggestions based on game state
- **Location-Specific**: Tailored advice for each dungeon area
- **Interactive**: Responds to your current inventory and progress

## Smart Detection

The help system automatically detects:
- Your current location in the dungeon
- Items in your inventory ($I)
- Your health points ($HP)
- Areas you've explored
- Available files and executables in current area

## Integration

The help system integrates seamlessly with bashcrawl's existing mechanics:
- Uses the same color scheme and theming
- Respects game variables and state
- Provides guidance that enhances rather than spoils gameplay
- Encourages exploration and learning

Enjoy your enhanced terminal adventure! ⚔️
