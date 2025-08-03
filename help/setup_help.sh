#!/usr/bin/env bash
#
# Bashcrawl Environment Setup
# This script configures the intelligent help system and other enhancements
#

# Get the absolute path of the bashcrawl directory
BASHCRAWL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to set up the help system
setup_help_system() {
    echo "🔧 Setting up Bashcrawl intelligent help system..."
    
    # Create help alias for the current session
    alias help="${BASHCRAWL_ROOT}/help"
    
    # Add to bash functions for persistent access
    if [ -f "${BASHCRAWL_ROOT}/entrance/.functions" ]; then
        # Check if help function already exists
        if ! grep -q "^help()" "${BASHCRAWL_ROOT}/entrance/.functions"; then
            cat >> "${BASHCRAWL_ROOT}/entrance/.functions" << 'EOF'

# Intelligent Help System Function
help() {
    local help_script_path
    
    # Try to find the help script in the bashcrawl root
    if [ -f "$(dirname "$(pwd)")/help" ]; then
        help_script_path="$(dirname "$(pwd)")/help"
    elif [ -f "../help" ]; then
        help_script_path="../help"
    elif [ -f "../../help" ]; then
        help_script_path="../../help"
    elif [ -f "./help" ]; then
        help_script_path="./help"
    else
        # Fallback: try to find it anywhere in the bashcrawl directory tree
        help_script_path=$(find . -name "help" -type f -executable 2>/dev/null | head -1)
        if [ -z "$help_script_path" ]; then
            echo "❌ Help system not found. Make sure you're in the bashcrawl directory."
            return 1
        fi
    fi
    
    # Execute the help script with any arguments passed
    "$help_script_path" "$@"
}
EOF
            echo "✅ Help function added to .functions"
        else
            echo "✅ Help function already exists in .functions"
        fi
    fi
}

# Function to create a help alias file for easy sourcing
create_help_alias() {
    cat > "${BASHCRAWL_ROOT}/.help_alias" << EOF
#!/usr/bin/env bash
# Bashcrawl Help System Alias
# Source this file to enable the help command: source .help_alias

alias help='${BASHCRAWL_ROOT}/help'
export BASHCRAWL_HELP_ENABLED=1

echo "🎯 Bashcrawl help system activated! Type 'help' for assistance."
EOF
    
    echo "✅ Help alias file created at .help_alias"
}

# Function to update game areas with help hints
update_game_areas() {
    echo "🗺️ Adding help hints to game areas..."
    
    # Add help hints to entrance scroll
    local entrance_scroll="${BASHCRAWL_ROOT}/entrance/scroll"
    if [ -f "$entrance_scroll" ] && ! grep -q "help command" "$entrance_scroll"; then
        # We'll add a subtle hint at the end of the scroll
        echo "" >> "$entrance_scroll"
        echo "💡 **New Adventurer Tip**: Type \`help\` at any time for intelligent assistance!" >> "$entrance_scroll"
        echo "✅ Added help hint to entrance scroll"
    fi
}

# Function to create a quick reference card
create_quick_reference() {
    cat > "${BASHCRAWL_ROOT}/HELP_REFERENCE.md" << 'EOF'
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
EOF
    
    echo "✅ Quick reference guide created: HELP_REFERENCE.md"
}

# Main setup function
main() {
    echo "🚀 Initializing Bashcrawl Enhanced Help System..."
    echo "   Location: $BASHCRAWL_ROOT"
    echo
    
    setup_help_system
    create_help_alias
    update_game_areas
    create_quick_reference
    
    echo
    echo "🎉 Setup complete! To activate the help system:"
    echo
    echo "   Option 1: source .help_alias && help"
    echo "   Option 2: ./help"
    echo "   Option 3: source entrance/.functions && help"
    echo
    echo "💡 The help command will now provide intelligent, context-aware assistance!"
    echo "   Try 'help', 'help commands', or 'help tips' for different levels of detail."
    echo
}

# Run setup if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
