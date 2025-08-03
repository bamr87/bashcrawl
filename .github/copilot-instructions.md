# Bashcrawl Copilot Instructions

## Project Overview

Bashcrawl is an educational text-based adventure game that teaches terminal/shell commands through immersive gameplay. The codebase is structured as an interactive learning environment where directories represent game rooms and executable files are interactive encounters.

## Core Architecture Patterns

### Directory-as-Room Structure
- Each directory represents a game room/chamber with specific learning objectives
- `entrance/` → `cellar/` → `armoury/` → `chamber/` represents progressive skill building
- Hidden directories (`.vault`, `.chapel`, `.rift`) unlock after collecting specific treasures
- Use descriptive directory names that reinforce the fantasy theme while teaching file navigation

### Educational Content Files
- **`scroll` files**: Markdown documentation teaching specific terminal concepts
- **Executable files** (`treasure`, `potion`, etc.): Interactive bash scripts that demonstrate commands
- **`README.md` files**: Comprehensive guides for each major area
- All content follows fantasy/RPG metaphors to make learning engaging

### Game Mechanics Implementation

#### Inventory System
```bash
export I=item,\$I           # Add item to comma-separated inventory
echo \$I                    # Display current inventory
grep item <<< \$I           # Check if item exists in inventory
```

#### Room Unlocking Pattern
```bash
mv ../hidden_room ../visible_room 2>/dev/null
```
Hidden directories (prefixed with `.`) become visible after treasure collection.

#### Interactive Executables
All executable files follow this pattern:
```bash
#!/usr/bin/env bash
# Educational comment explaining the concept
# Game logic checking prerequisites
# Output teaching specific terminal skills
```

## Content Creation Standards

### Scroll (Documentation) Guidelines
- Start with fantasy-themed introduction using emojis and rich formatting
- Explain the "why" behind each command, not just syntax
- Include progressive challenges: Basic → Intermediate → Advanced
- End with practical applications connecting game skills to real development
- Use consistent emoji language: 🗡️ for executables, 🏰 for directories, 💰 for treasures

### Interactive Script Patterns
- Check game state (inventory, previous actions) before proceeding
- Provide educational comments explaining what each command does
- Use `cat << EOF` for multi-line output with embedded variables
- Include safety checks and error handling as teaching opportunities

### Room Progression Logic
- Each room should teach 1-3 related terminal concepts
- Build on previous knowledge while introducing new skills
- Provide multiple paths through content (different learning styles)
- Include "easter eggs" for curious learners who explore the source code

## Development Workflows

### Testing New Content
```bash
cd entrance                 # Start at game beginning
export I=""                # Reset inventory
./treasure                 # Test executable interactions
ls -F                      # Verify file type indicators
```

### Adding New Rooms
1. Create directory structure following existing patterns
2. Add `scroll` file with educational content
3. Create interactive executables with proper permissions (`chmod +x`)
4. Add unlock mechanism in prerequisite rooms
5. Test complete learning path

### Content Validation
- Verify all markdown follows game formatting conventions
- Test executable scripts work in different shell environments
- Ensure progressive difficulty curve is maintained
- Check that real terminal skills map to fantasy metaphors

## Project-Specific Conventions

### File Naming
- `scroll`: Primary educational content (markdown)
- `treasure`: Inventory/progression mechanics
- `potion`, `spell`, `ghost`: Themed interactive encounters
- Avoid generic names; use fantasy terms that hint at functionality

### Permission Management
- Executables must have `+x` permissions for game mechanics
- Use `ls -F` patterns throughout to teach file type recognition
- Hidden files (`.filename`) used for game state and unlockable content

### Cross-Platform Compatibility
- Use POSIX-compatible commands (avoid GNU-specific flags)
- Test on macOS and Linux environments
- Provide alternative command examples when platform differences exist

## Integration Points

### External Dependencies
- Git for distribution (GitHub/GitLab hosting)
- Standard POSIX shell tools (no exotic dependencies)
- Binder for online play without installation

### Learning Path Integration
- Game maps to real-world development workflows
- Each room teaches transferable terminal skills
- Scaffolds from basic navigation to advanced shell scripting
- Connects to broader IT education goals

When modifying this codebase, maintain the educational integrity while enhancing the adventure experience. Every change should teach something valuable about terminal/shell usage.
