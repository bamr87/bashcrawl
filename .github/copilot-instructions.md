# Bashcrawl Copilot Instructions

## Project Overview

Bashcrawl is an educational text-based adventure game that teaches terminal/shell commands through immersive gameplay. The codebase is structured as an interactive learning environment where directories represent game rooms and executable files are interactive encounters.

## Core Architecture Patterns

### Front Matter: Educational Metadata for Game Development

Front matter in Bashcrawl serves as educational context that enables AI agents to understand the learning objectives, game mechanics, and terminal concepts being taught. Each file uses structured metadata to communicate its role in the overall learning journey.

#### Educational Front Matter Elements

- **Learning Objectives**: Clear statements of what terminal skills the content teaches
- **Game Mechanics**: How the content integrates with inventory, progression, and discovery systems
- **Skill Prerequisites**: What knowledge players need before engaging with this content
- **Terminal Commands**: Specific commands and concepts being demonstrated
- **Fantasy Context**: How the content fits within the adventure theme and narrative

#### Front Matter Structure for Educational Content

```markdown
---
# Educational Front Matter for Bashcrawl
title: "The Ancient Scroll of Directory Navigation"
description: "Learn directory traversal commands through magical exploration"
learning_objectives:
  - "Master cd command for directory navigation"
  - "Understand relative vs absolute paths"
  - "Use ls command with various flags"
game_mechanics:
  - type: "scroll"
  - unlocks: ["hidden_chamber"]
  - requires_items: []
  - teaches_commands: ["cd", "ls", "pwd"]
skill_level: "beginner"
prerequisites: 
  - "Basic terminal access"
  - "Understanding of file systems"
fantasy_theme:
  role: "Ancient knowledge repository"
  setting: "Mystical library chamber"
  narrative: "Discovers secrets of magical navigation"
ai_teaching_notes:
  - "Emphasize hands-on practice"
  - "Use progressive difficulty"
  - "Connect commands to real-world usage"
---
```

### Directory-as-Room Structure
- Each directory represents a game room/chamber with specific learning objectives
- `entrance/` → `cellar/` → `armoury/` → `chamber/` represents progressive skill building
- Hidden directories (`.vault`, `.chapel`, `.rift`) unlock after collecting specific treasures
- Use descriptive directory names that reinforce the fantasy theme while teaching file navigation

### Educational Content Files with Front Matter
- **`scroll` files**: Markdown documentation with educational front matter teaching specific terminal concepts
- **Executable files** (`treasure`, `potion`, etc.): Interactive bash scripts with embedded front matter demonstrating commands
- **`README.md` files**: Comprehensive guides with front matter outlining learning paths for each major area
- All content follows fantasy/RPG metaphors enhanced by front matter narrative context

#### Front Matter for Interactive Scripts

```bash
#!/usr/bin/env bash
# Educational Front Matter for Interactive Bashcrawl Script
#
# Title: The Mystical Treasure of File Permissions
# Description: Interactive script teaching chmod and file permission concepts
# Learning Objectives:
#   - Understand octal permission notation
#   - Practice chmod command with various flags
#   - Learn about user, group, and other permissions
# Game Mechanics:
#   - Type: treasure
#   - Adds to inventory: "permission_knowledge"
#   - Unlocks: [".vault", "advanced_permissions_scroll"]
#   - Requires: ["basic_navigation"]
# Terminal Commands: ["chmod", "ls -l", "stat"]
# Skill Level: intermediate
# Fantasy Context:
#   - Role: "Ancient artifact containing permission magic"
#   - Setting: "Hidden treasure chamber"
#   - Narrative: "Grants power to control file access"
# AI Teaching Notes:
#   - Use visual examples with ls -l output
#   - Practice with different permission combinations
#   - Connect to real-world security concepts
```

#### Front Matter for Learning Documentation

```markdown
---
# Educational Front Matter for Bashcrawl Documentation
title: "The Scroll of Advanced Text Processing"
description: "Master grep, sed, and awk through ancient text manipulation"
learning_objectives:
  - "Use grep for pattern matching and search"
  - "Apply sed for stream editing and text transformation"
  - "Implement awk for advanced text processing"
game_mechanics:
  type: "scroll"
  unlocks: ["text_wizard_chamber", "advanced_scripting_area"]
  requires_items: ["basic_commands_knowledge", "file_navigation_mastery"]
  teaches_commands: ["grep", "sed", "awk", "cut", "sort"]
skill_level: "advanced"
prerequisites:
  - "Comfortable with basic file operations"
  - "Understanding of regular expressions helpful"
  - "Experience with pipes and redirection"
fantasy_theme:
  role: "Ancient tome of text magic"
  setting: "Scholar's chamber in the tower"
  narrative: "Unlocks the secrets of text manipulation sorcery"
progression_path:
  previous: ["file_operations_scroll", "basic_commands_scroll"]
  next: ["shell_scripting_grimoire", "automation_spells"]
ai_teaching_notes:
  - "Start with simple grep examples"
  - "Build complexity gradually with sed"
  - "Use practical, relatable text examples"
  - "Emphasize real-world applications"
---
```

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

### Front Matter Enhanced Educational Guidelines

#### Scroll (Documentation) Guidelines with Front Matter
- Begin with comprehensive front matter defining learning objectives and fantasy context
- Start content with fantasy-themed introduction using emojis and rich formatting guided by front matter narrative
- Explain the "why" behind each command using educational objectives from front matter
- Include progressive challenges following skill level specified in front matter: Basic → Intermediate → Advanced
- End with practical applications connecting game skills to real development as outlined in AI teaching notes
- Use consistent emoji language: 🗡️ for executables, 🏰 for directories, 💰 for treasures, 📜 for scrolls

#### AI-Enhanced Content Creation Process
- **Front Matter First**: Define educational goals, game mechanics, and fantasy context before writing content
- **Learning Objective Alignment**: Ensure all content directly supports the learning objectives specified in front matter
- **Progressive Skill Building**: Use prerequisite information to create appropriate difficulty progression
- **Fantasy Integration**: Weave narrative elements from front matter fantasy context throughout the content
- **Command Practice**: Incorporate hands-on practice for all commands listed in front matter

### Front Matter Enhanced Interactive Script Patterns
- Begin with comprehensive front matter defining script's educational purpose and game mechanics
- Check game state (inventory, previous actions) based on requirements specified in front matter
- Provide educational comments explaining commands, referencing learning objectives from front matter
- Use `cat << EOF` for multi-line output with embedded variables, incorporating fantasy narrative from front matter
- Include safety checks and error handling as teaching opportunities aligned with skill level
- Update inventory with items specified in front matter game mechanics section

#### AI-Guided Script Development
- **Educational Alignment**: Use front matter learning objectives to guide script functionality
- **Fantasy Integration**: Incorporate narrative elements from front matter into all user interactions
- **Skill Assessment**: Validate prerequisites from front matter before allowing script execution
- **Progressive Teaching**: Adjust complexity based on skill level specified in front matter
- **Command Demonstration**: Ensure all commands listed in front matter are properly demonstrated

### Front Matter Guided Room Progression Logic
- Each room should teach 1-3 related terminal concepts as specified in front matter learning objectives
- Build on previous knowledge using progression paths defined in front matter
- Provide multiple paths through content guided by different skill levels in front matter
- Include "easter eggs" for curious learners, documented in front matter AI teaching notes
- Use front matter prerequisites to ensure proper skill building sequence

#### AI-Enhanced Learning Path Design
- **Skill Progression**: Use front matter progression paths to create logical learning sequences
- **Adaptive Difficulty**: Adjust content complexity based on front matter skill level specifications  
- **Learning Style Support**: Incorporate different teaching approaches suggested in front matter AI notes
- **Knowledge Validation**: Check front matter prerequisites before allowing access to advanced content

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

When modifying this codebase, maintain the educational integrity while enhancing the adventure experience through comprehensive front matter documentation. Every change should teach something valuable about terminal/shell usage and be guided by clear learning objectives, game mechanics, and fantasy context defined in front matter.

## AI-Enhanced Educational Development

### Front Matter Benefits for Educational Content
- **Learning Objective Clarity**: AI agents understand exactly what terminal skills to teach
- **Skill Progression Tracking**: Prerequisites and progression paths ensure logical learning sequences  
- **Fantasy Theme Consistency**: Narrative context maintains immersive adventure experience
- **Educational Quality**: AI teaching notes guide content creation for maximum learning effectiveness
- **Game Mechanic Integration**: Clear specification of how content integrates with inventory and unlocking systems

### AI Agent Integration for Educational Games
- **Content Generation**: AI uses front matter learning objectives to create appropriate terminal exercises
- **Difficulty Scaling**: AI adjusts complexity based on skill level and prerequisites in front matter
- **Fantasy Integration**: AI weaves narrative elements throughout content using front matter fantasy context
- **Assessment Creation**: AI generates practice exercises based on terminal commands specified in front matter
- **Progress Validation**: AI ensures content meets educational goals defined in front matter

The future of educational gaming lies in this structured approach where front matter provides the educational blueprint and AI agents enhance the learning experience while maintaining both technical accuracy and engaging fantasy narrative.
