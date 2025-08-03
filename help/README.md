# 🎯 Bashcrawl Help System

This directory contains the intelligent help system components for Bashcrawl.

## Structure

- `init_help.sh` - Simple initialization script to enable the help system
- `bashcrawl_help.sh` - Main help system script with context-aware assistance
- `ai_engine.sh` - AI learning engine that tracks player progress
- `command_suggester.sh` - Intelligent command recommendations
- `tutorial_engine.sh` - Interactive tutorial system
- `quick_ref.sh` - Quick reference cards and cheat sheets
- `setup_help.sh` - Advanced setup script (legacy)
- `demo_help.sh` - Help system demonstration
- `HELP_REFERENCE.md` - Complete help system documentation

## Usage

The help system is activated by sourcing the `init_help.sh` script in this directory:

```bash
source help/init_help.sh
```

After activation, use `help` from anywhere in the bashcrawl adventure:

```bash
help                    # Context-aware help for current location
help commands          # Detailed command reference
help tips              # Advanced tips and tricks
help tutorial          # Interactive tutorial mode
```

## Features

- **Context-Aware**: Adapts help content based on your current location
- **Progress-Aware**: Provides different guidance based on your experience level
- **AI-Enhanced**: Intelligent suggestions based on game state
- **Location-Specific**: Tailored advice for each dungeon area
- **Interactive**: Responds to your current inventory and progress

## Integration

The help system integrates seamlessly with bashcrawl's existing mechanics:
- Uses the same color scheme and theming
- Respects game variables and state
- Provides guidance that enhances rather than spoils gameplay
- Encourages exploration and learning
