#!/usr/bin/env bash
#
# Bashcrawl Intelligent Help System v2.0
# Context-aware assistance with AI learning and interactive tutorials
#
# This script provides dynamic, location-aware help that adapts to
# the player's progress and current situation in the game.
#

# Source additional engines if available
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Resolve BASHCRAWL_ROOT (src/help/ is two levels below root)
if [[ -z "${BASHCRAWL_ROOT:-}" ]]; then
    BASHCRAWL_ROOT="$(cd "$SCRIPT_DIR/../.." 2>/dev/null && pwd)"
fi

# Source shared color constants from lib/colors.sh
if [[ -f "${BASHCRAWL_ROOT}/lib/colors.sh" ]]; then
    source "${BASHCRAWL_ROOT}/lib/colors.sh"
fi

# Source YAML reader for data-driven help
if [[ -f "${BASHCRAWL_ROOT}/lib/yaml_reader.sh" ]]; then
    source "${BASHCRAWL_ROOT}/lib/yaml_reader.sh"
fi

# Try to source AI engine
if [ -f "$SCRIPT_DIR/ai_engine.sh" ]; then
    source "$SCRIPT_DIR/ai_engine.sh"
    AI_ENGINE_AVAILABLE=true
else
    AI_ENGINE_AVAILABLE=false
fi

# Try to source tutorial engine
if [ -f "$SCRIPT_DIR/tutorial_engine.sh" ]; then
    source "$SCRIPT_DIR/tutorial_engine.sh"
    TUTORIAL_ENGINE_AVAILABLE=true
else
    TUTORIAL_ENGINE_AVAILABLE=false
fi

# Try to source command suggester
if [ -f "$SCRIPT_DIR/command_suggester.sh" ]; then
    source "$SCRIPT_DIR/command_suggester.sh"
    SUGGESTER_AVAILABLE=true
else
    SUGGESTER_AVAILABLE=false
fi

# Try to source quick reference cards
if [ -f "$SCRIPT_DIR/quick_ref.sh" ]; then
    source "$SCRIPT_DIR/quick_ref.sh"
    QUICK_REF_AVAILABLE=true
else
    QUICK_REF_AVAILABLE=false
fi

# Color aliases for backward compatibility with help scripts
# These map old HELP_* names to shared COLOR_* from lib/colors.sh
HELP_RED="${COLOR_RED:-}"
HELP_GREEN="${COLOR_GREEN:-}"
HELP_YELLOW="${COLOR_YELLOW:-}"
HELP_BLUE="${COLOR_BLUE:-}"
HELP_PURPLE="${COLOR_PURPLE:-}"
HELP_CYAN="${COLOR_CYAN:-}"
HELP_WHITE="${COLOR_WHITE:-}"
HELP_BOLD="${COLOR_BOLD:-}"
HELP_NC="${COLOR_NC:-}"

export HELP_RED HELP_GREEN HELP_YELLOW HELP_BLUE HELP_PURPLE HELP_CYAN HELP_WHITE HELP_BOLD HELP_NC

# Function to detect current game area
detect_location() {
    local current_dir=$(basename "$PWD")
    local parent_dir=$(basename "$(dirname "$PWD")")
    
    case "$current_dir" in
        entrance) echo "entrance" ;;
        cellar) echo "cellar" ;;
        armoury) echo "armoury" ;;
        chamber) echo "chamber" ;;
        *) 
            # Check if we're in a subdirectory of a known area
            case "$parent_dir" in
                entrance|cellar|armoury|chamber) echo "$parent_dir" ;;
                *) echo "unknown" ;;
            esac
            ;;
    esac
}

# Function to analyze player progress
analyze_progress() {
    local location="$1"
    local progress_level="novice"
    local areas_visited=0
    
    # Count inventory items
    local item_count=0
    if [ -n "${I:-}" ]; then
        item_count=$(echo "${I:-}" | tr ',' '\n' | grep -v '^$' | wc -l | tr -d ' ')
    fi
    
    # Check areas visited (based on directory existence and navigation patterns)
    [ -d "entrance" ] && ((areas_visited++))
    [ -d "cellar" ] && ((areas_visited++))
    [ -d "armoury" ] && ((areas_visited++))
    
    # Determine experience level
    if [ "$item_count" -ge 3 ] && [ "$areas_visited" -ge 2 ]; then
        progress_level="advanced"
    elif [ "$item_count" -ge 1 ] || [ "$areas_visited" -ge 1 ]; then
        progress_level="intermediate"
    fi
    
    echo "$progress_level:$item_count:$areas_visited"
}

# Function to provide AI-enhanced contextual suggestions
get_ai_suggestions() {
    local location="$1"
    local progress="$2"
    
    IFS=':' read -r level items areas <<< "$progress"
    
    echo -e "${HELP_BOLD}${HELP_CYAN}🤖 AI Assistant Suggestions:${HELP_NC}"
    
    # Initialize AI tracking if available
    if [ "$AI_ENGINE_AVAILABLE" = true ]; then
        init_progress_tracking
        local pattern=$(analyze_player_patterns "$location")
        get_ai_recommendations "$location" "$pattern" "${I:-}"
        
        # Check for stuck patterns
        detect_stuck_patterns
        
        # Smart file recommendations
        recommend_files "$location"
    else
        # Fallback to basic suggestions
        case "$location" in
            entrance)
                if [ "$level" = "novice" ]; then
                    echo -e "   • Start by reading the ${HELP_YELLOW}scroll${HELP_NC} to understand your quest"
                    echo -e "   • Use ${HELP_GREEN}ls -F${HELP_NC} to see what's available in this area"
                    echo -e "   • Look for directories marked with ${HELP_BLUE}/${HELP_NC} to explore"
                else
                    echo -e "   • You seem experienced! Try exploring hidden areas with ${HELP_GREEN}ls -la${HELP_NC}"
                    echo -e "   • Consider revisiting areas with new knowledge"
                fi
                ;;
            cellar)
                echo -e "   • This area teaches file type recognition"
                echo -e "   • Try the ${HELP_GREEN}treasure${HELP_NC} executable to learn inventory management"
                if [ "$items" -eq 0 ]; then
                    echo -e "   • ${HELP_RED}Priority${HELP_NC}: Collect your first treasure here!"
                fi
                ;;
            armoury)
                echo -e "   • Focus on file permissions and executable scripts here"
                echo -e "   • Use ${HELP_GREEN}chmod +x${HELP_NC} if you encounter permission issues"
                echo -e "   • Combat mechanics teach process management"
                ;;
            *)
                echo -e "   • Use ${HELP_GREEN}pwd${HELP_NC} to confirm your exact location"
                echo -e "   • Look for ${HELP_YELLOW}scroll${HELP_NC} files for area-specific guidance"
                echo -e "   • Try ${HELP_GREEN}find . -name scroll${HELP_NC} to locate documentation"
                ;;
        esac
    fi
}

# Function to show location-specific help
show_location_help() {
    local location="$1"
    
    echo -e "${HELP_BOLD}${HELP_BLUE}📍 Location-Specific Guidance:${HELP_NC}"
    
    case "$location" in
        entrance)
            cat << EOF
   ${HELP_YELLOW}🚪 THE ENTRANCE HALL${HELP_NC}
   • This is your starting point - learn basic navigation here
   • Key files: ${HELP_GREEN}scroll${HELP_NC} (documentation), ${HELP_GREEN}README.md${HELP_NC} (overview)
   • Next steps: Explore the ${HELP_CYAN}cellar/${HELP_NC} directory
   • Essential commands:
     - ${HELP_GREEN}cat scroll${HELP_NC}      # Read the area documentation
     - ${HELP_GREEN}ls -F${HELP_NC}           # List files with type indicators
     - ${HELP_GREEN}cd cellar${HELP_NC}       # Move to the next area

EOF
            ;;
        cellar)
            cat << EOF
   ${HELP_YELLOW}🏰 THE CELLAR${HELP_NC}
   • Learn file types and basic interaction here
   • Key executable: ${HELP_GREEN}treasure${HELP_NC} (inventory system)
   • Important: Collect your first amulet here!
   • Essential commands:
     - ${HELP_GREEN}./treasure${HELP_NC}      # Run the treasure script
     - ${HELP_GREEN}export I=amulet,\$I${HELP_NC}  # Add items to inventory
     - ${HELP_GREEN}echo \$I${HELP_NC}        # Check your inventory

EOF
            ;;
        armoury)
            cat << EOF
   ${HELP_YELLOW}🗡️ THE ARMOURY${HELP_NC}
   • Advanced area focusing on file permissions and combat
   • Key executables: Various weapons and combat scripts
   • Essential commands:
     - ${HELP_GREEN}chmod +x filename${HELP_NC}  # Make files executable
     - ${HELP_GREEN}./weapon${HELP_NC}           # Use weapons (if available)
     - ${HELP_GREEN}ls -l${HELP_NC}              # Check file permissions

EOF
            ;;
        chamber)
            cat << EOF
   ${HELP_YELLOW}💎 THE CHAMBER${HELP_NC}
   • Advanced challenges and complex interactions
   • Multiple paths and hidden secrets
   • Essential commands:
     - ${HELP_GREEN}find . -type f${HELP_NC}     # Find all files
     - ${HELP_GREEN}grep -r pattern${HELP_NC}    # Search for patterns
     - ${HELP_GREEN}history${HELP_NC}            # Review your commands

EOF
            ;;
        *)
            cat << EOF
   ${HELP_YELLOW}🗺️ UNKNOWN TERRITORY${HELP_NC}
   • You're in an uncharted area!
   • Use navigation commands to orient yourself
   • Essential commands:
     - ${HELP_GREEN}pwd${HELP_NC}                # Show current location
     - ${HELP_GREEN}ls -la${HELP_NC}             # List all files including hidden
     - ${HELP_GREEN}cd ..${HELP_NC}              # Go back to parent directory

EOF
            ;;
    esac
}

# Function to show universal terminal commands
show_universal_commands() {
    echo -e "${HELP_BOLD}${HELP_GREEN}⚡ Universal Terminal Commands:${HELP_NC}"
    cat << EOF

   ${HELP_BOLD}Navigation:${HELP_NC}
   • ${HELP_GREEN}pwd${HELP_NC}                 # Print current directory path
   • ${HELP_GREEN}ls${HELP_NC}                  # List files and directories
   • ${HELP_GREEN}ls -F${HELP_NC}               # List with type indicators (* = executable, / = directory)
   • ${HELP_GREEN}ls -la${HELP_NC}              # List all files including hidden, with details
   • ${HELP_GREEN}cd <directory>${HELP_NC}      # Change to specified directory
   • ${HELP_GREEN}cd ..${HELP_NC}               # Go up one directory level
   • ${HELP_GREEN}cd ~${HELP_NC}                # Go to home directory

   ${HELP_BOLD}File Operations:${HELP_NC}
   • ${HELP_GREEN}cat <file>${HELP_NC}          # Display entire file contents
   • ${HELP_GREEN}less <file>${HELP_NC}         # View file page by page (press 'q' to quit)
   • ${HELP_GREEN}head <file>${HELP_NC}         # Show first 10 lines
   • ${HELP_GREEN}tail <file>${HELP_NC}         # Show last 10 lines
   • ${HELP_GREEN}wc <file>${HELP_NC}           # Count lines, words, characters

   ${HELP_BOLD}Game-Specific:${HELP_NC}
   • ${HELP_GREEN}echo \$I${HELP_NC}            # Check your inventory
   • ${HELP_GREEN}echo \$HP${HELP_NC}           # Check your health points
   • ${HELP_GREEN}export I=item,\$I${HELP_NC}   # Add item to inventory
   • ${HELP_GREEN}./executable${HELP_NC}        # Run executable files (treasures, potions, etc.)

   ${HELP_BOLD}Getting Help:${HELP_NC}
   • ${HELP_GREEN}help${HELP_NC}                # Show this help system
   • ${HELP_GREEN}help commands${HELP_NC}       # Show detailed command reference
   • ${HELP_GREEN}help tips${HELP_NC}           # Show advanced tips and tricks
   • ${HELP_GREEN}man <command>${HELP_NC}       # Manual page for any command
   • ${HELP_GREEN}<command> --help${HELP_NC}    # Quick help for most commands

EOF
}

# Function to show player status
show_player_status() {
    local progress="$1"
    IFS=':' read -r level items areas <<< "$progress"
    
    echo -e "${HELP_BOLD}${HELP_PURPLE}🎯 Your Adventure Status:${HELP_NC}"
    cat << EOF

   ${HELP_BOLD}Experience Level:${HELP_NC} ${HELP_CYAN}$level${HELP_NC}
   ${HELP_BOLD}Items Collected:${HELP_NC}  ${HELP_GREEN}$items${HELP_NC}
   ${HELP_BOLD}Areas Explored:${HELP_NC}   ${HELP_GREEN}$areas${HELP_NC}
   ${HELP_BOLD}Current Location:${HELP_NC} ${HELP_YELLOW}$(pwd)${HELP_NC}

EOF

    if [ -n "${I:-}" ]; then
        echo -e "   ${HELP_BOLD}Inventory:${HELP_NC} ${HELP_GREEN}${I:-}${HELP_NC}"
    else
        echo -e "   ${HELP_BOLD}Inventory:${HELP_NC} ${HELP_RED}Empty - find treasures to collect!${HELP_NC}"
    fi
    
    if [ -n "${HP:-}" ]; then
        echo -e "   ${HELP_BOLD}Health:${HELP_NC} ${HELP_GREEN}${HP:-} HP${HELP_NC}"
    else
        echo -e "   ${HELP_BOLD}Health:${HELP_NC} ${HELP_YELLOW}Not initialized${HELP_NC}"
    fi
    echo
}

# Function to show quick tips based on context
show_contextual_tips() {
    local location="$1"
    local progress="$2"
    
    echo -e "${HELP_BOLD}${HELP_YELLOW}💡 Smart Tips:${HELP_NC}"
    
    # Check if in root bashcrawl directory
    if [ -f "README.md" ] && [ -d "entrance" ]; then
        echo -e "   • You're in the main bashcrawl directory. Start with: ${HELP_GREEN}cd entrance${HELP_NC}"
        return
    fi
    
    # Check if scroll exists
    if [ -f "scroll" ]; then
        echo -e "   • There's a ${HELP_GREEN}scroll${HELP_NC} here with important information!"
    fi
    
    # Check for executables
    local executables=$(find . -maxdepth 1 -type f -executable 2>/dev/null | wc -l)
    if [ "$executables" -gt 0 ]; then
        echo -e "   • Found $executables executable file(s). Try running them with ${HELP_GREEN}./<filename>${HELP_NC}"
    fi
    
    # Check for README
    if [ -f "README.md" ]; then
        echo -e "   • ${HELP_GREEN}README.md${HELP_NC} contains detailed information about this area"
    fi
    
    # Progress-based tips
    IFS=':' read -r level items areas <<< "$progress"
    case "$level" in
        novice)
            echo -e "   • New to terminals? Use ${HELP_GREEN}Tab${HELP_NC} key for auto-completion"
            echo -e "   • Stuck? The ${HELP_GREEN}scroll${HELP_NC} file usually has guidance"
            ;;
        intermediate)
            echo -e "   • Try ${HELP_GREEN}ls -la${HELP_NC} to see hidden files (starting with .)"
            echo -e "   • Use ${HELP_GREEN}history${HELP_NC} to see your recent commands"
            ;;
        advanced)
            echo -e "   • Explore hidden areas and secret passages"
            echo -e "   • Try advanced commands like ${HELP_GREEN}find${HELP_NC} and ${HELP_GREEN}grep${HELP_NC}"
            ;;
    esac
}

# Function to show advanced help options
show_advanced_help() {
    local topic="$1"
    
    case "$topic" in
        tutorial)
            if [ "$TUTORIAL_ENGINE_AVAILABLE" = true ]; then
                local subtopic="$2"
                case "$subtopic" in
                    "")
                        init_tutorial
                        show_tutorial_menu
                        suggest_tutorial_lesson "$(detect_location)" "${I:-}" ""
                        ;;
                    "progress")
                        show_tutorial_progress
                        show_achievements
                        ;;
                    "next")
                        echo "🎓 Moving to next tutorial lesson..."
                        echo "Feature under development - check back soon!"
                        ;;
                    *)
                        run_interactive_lesson "$subtopic"
                        ;;
                esac
            else
                echo -e "${HELP_RED}Tutorial engine not available. Basic help only.${HELP_NC}"
            fi
            ;;
        ai)
            if [ "$AI_ENGINE_AVAILABLE" = true ]; then
                echo -e "${HELP_BOLD}${HELP_CYAN}🤖 AI Learning System Status:${HELP_NC}"
                echo
                echo "✅ AI Engine: Active and learning from your gameplay"
                echo "📊 Progress Tracking: Monitoring your exploration patterns"
                echo "🎯 Smart Recommendations: Adapting to your skill level"
                echo "🔍 Pattern Detection: Identifying when you need extra help"
                echo
                echo "🎮 AI Features Available:"
                echo "   • Personalized suggestions based on your history"
                echo "   • Automatic detection of struggling patterns"
                echo "   • Smart file and command recommendations"
                echo "   • Contextual learning paths"
                echo
                echo "📁 Your AI data is stored locally for privacy"
                echo "   Location: $PROGRESS_FILE"
            else
                echo -e "${HELP_RED}AI engine not available. Using basic recommendations.${HELP_NC}"
            fi
            ;;
        suggest)
            if [ "$SUGGESTER_AVAILABLE" = true ]; then
                local suggestion_type="$2"
                local location=$(detect_location)
                local progress=$(analyze_progress "$location")
                IFS=':' read -r level items areas <<< "$progress"
                
                case "$suggestion_type" in
                    "")
                        suggest_commands "$location" "general" "$level"
                        ;;
                    "workflow")
                        suggest_workflows "$3"
                        ;;
                    "error")
                        suggest_error_solutions "$3"
                        ;;
                    *)
                        suggest_workflows "$suggestion_type"
                        ;;
                esac
            else
                echo -e "${HELP_RED}Command suggester not available.${HELP_NC}"
            fi
            ;;
        qref|ref|reference)
            if [ "$QUICK_REF_AVAILABLE" = true ]; then
                show_quick_ref "$2"
            else
                echo -e "${HELP_RED}Quick reference cards not available.${HELP_NC}"
            fi
            ;;
        commands)
            echo -e "${HELP_BOLD}${HELP_CYAN}📚 Detailed Command Reference:${HELP_NC}"
            cat << EOF

${HELP_BOLD}File System Navigation:${HELP_NC}
• ${HELP_GREEN}pwd${HELP_NC}                    Print Working Directory - shows your exact location
• ${HELP_GREEN}ls${HELP_NC}                     List files and directories in current location
• ${HELP_GREEN}ls -F${HELP_NC}                  List with type indicators: * = executable, / = directory, @ = link
• ${HELP_GREEN}ls -la${HELP_NC}                 List ALL files including hidden (.), with permissions and details
• ${HELP_GREEN}ls -lh${HELP_NC}                 List with human-readable file sizes
• ${HELP_GREEN}cd <path>${HELP_NC}              Change directory to specified path
• ${HELP_GREEN}cd ..${HELP_NC}                  Move up one directory level
• ${HELP_GREEN}cd ~${HELP_NC}                   Go to home directory
• ${HELP_GREEN}cd -${HELP_NC}                   Go back to previous directory

${HELP_BOLD}File Content Viewing:${HELP_NC}
• ${HELP_GREEN}cat <file>${HELP_NC}             Display entire file contents at once
• ${HELP_GREEN}less <file>${HELP_NC}            View file page by page (Space=next page, b=previous, q=quit)
• ${HELP_GREEN}head <file>${HELP_NC}            Show first 10 lines of file
• ${HELP_GREEN}head -n 20 <file>${HELP_NC}     Show first 20 lines of file
• ${HELP_GREEN}tail <file>${HELP_NC}            Show last 10 lines of file
• ${HELP_GREEN}tail -f <file>${HELP_NC}         Follow file changes in real-time
• ${HELP_GREEN}wc <file>${HELP_NC}              Count lines, words, and characters

${HELP_BOLD}File Operations:${HELP_NC}
• ${HELP_GREEN}cp <source> <dest>${HELP_NC}     Copy file or directory
• ${HELP_GREEN}mv <source> <dest>${HELP_NC}     Move/rename file or directory
• ${HELP_GREEN}rm <file>${HELP_NC}              Delete file (CAREFUL - no undo!)
• ${HELP_GREEN}mkdir <name>${HELP_NC}           Create new directory
• ${HELP_GREEN}rmdir <name>${HELP_NC}           Remove empty directory
• ${HELP_GREEN}chmod +x <file>${HELP_NC}        Make file executable
• ${HELP_GREEN}chmod -x <file>${HELP_NC}        Remove executable permission

${HELP_BOLD}Search and Find:${HELP_NC}
• ${HELP_GREEN}find . -name "*pattern*"${HELP_NC}  Find files/directories by name pattern
• ${HELP_GREEN}find . -type f${HELP_NC}            Find only files
• ${HELP_GREEN}find . -type d${HELP_NC}            Find only directories
• ${HELP_GREEN}grep "pattern" <file>${HELP_NC}     Search for pattern within file
• ${HELP_GREEN}grep -r "pattern" .${HELP_NC}       Search for pattern in all files recursively
• ${HELP_GREEN}which <command>${HELP_NC}           Show location of command executable

${HELP_BOLD}System Information:${HELP_NC}
• ${HELP_GREEN}whoami${HELP_NC}                    Show current username
• ${HELP_GREEN}date${HELP_NC}                      Show current date and time
• ${HELP_GREEN}uptime${HELP_NC}                    Show system uptime and load
• ${HELP_GREEN}df -h${HELP_NC}                     Show disk space usage (human-readable)
• ${HELP_GREEN}du -sh *${HELP_NC}                  Show directory sizes
• ${HELP_GREEN}ps aux${HELP_NC}                    Show running processes

${HELP_BOLD}Command History and Shortcuts:${HELP_NC}
• ${HELP_GREEN}history${HELP_NC}                   Show command history
• ${HELP_GREEN}!!${HELP_NC}                       Repeat last command
• ${HELP_GREEN}!<number>${HELP_NC}                 Repeat command number from history
• ${HELP_GREEN}Ctrl+R${HELP_NC}                    Search command history interactively
• ${HELP_GREEN}Tab${HELP_NC}                       Auto-complete file/directory names
• ${HELP_GREEN}Ctrl+C${HELP_NC}                    Stop/cancel current command
• ${HELP_GREEN}Ctrl+L${HELP_NC}                    Clear terminal screen

EOF
            ;;
        tips)
            echo -e "${HELP_BOLD}${HELP_CYAN}🎯 Advanced Tips & Tricks:${HELP_NC}"
            cat << EOF

${HELP_BOLD}Terminal Mastery:${HELP_NC}
• Use ${HELP_GREEN}Tab${HELP_NC} completion extensively - it saves time and prevents typos
• ${HELP_GREEN}Ctrl+R${HELP_NC} for reverse search through command history is incredibly powerful
• Use ${HELP_GREEN}alias${HELP_NC} to create shortcuts: ${HELP_GREEN}alias ll='ls -la'${HELP_NC}
• ${HELP_GREEN}!!${HELP_NC} repeats last command - useful for adding sudo: ${HELP_GREEN}sudo !!${HELP_NC}
• Use ${HELP_GREEN}&&${HELP_NC} to chain commands: ${HELP_GREEN}cd directory && ls${HELP_NC}

${HELP_BOLD}Bashcrawl-Specific Tips:${HELP_NC}
• Always ${HELP_GREEN}cat scroll${HELP_NC} when entering a new area
• Inventory is crucial - use ${HELP_GREEN}export I=item,\$I${HELP_NC} to collect treasures
• Hidden files (starting with .) often contain important game mechanics
• Executables (*) are interactive - run them with ${HELP_GREEN}./<filename>${HELP_NC}
• Some areas unlock only after collecting specific treasures

${HELP_BOLD}File System Navigation Pro Tips:${HELP_NC}
• ${HELP_GREEN}cd -${HELP_NC} toggles between current and previous directories
• ${HELP_GREEN}pushd${HELP_NC} and ${HELP_GREEN}popd${HELP_NC} maintain a directory stack
• Use ${HELP_GREEN}find . -name "*.txt"${HELP_NC} to locate specific file types
• ${HELP_GREEN}ls -la | grep "^d"${HELP_NC} shows only directories

${HELP_BOLD}Safety and Best Practices:${HELP_NC}
• Always know where you are: use ${HELP_GREEN}pwd${HELP_NC} frequently
• Be careful with ${HELP_GREEN}rm${HELP_NC} command - there's no recycle bin!
• Use ${HELP_GREEN}ls -la${HELP_NC} before operating in a new directory
• Test commands on non-critical files first
• When in doubt, read the manual: ${HELP_GREEN}man <command>${HELP_NC}

${HELP_BOLD}Advanced Exploration:${HELP_NC}
• Look for hidden directories and files: ${HELP_GREEN}ls -la${HELP_NC}
• Some areas have multiple paths - explore thoroughly
• Easter eggs and secrets reward curious players
• Game source code is educational - study it when stuck

${HELP_BOLD}Troubleshooting:${HELP_NC}
• "Permission denied" → try ${HELP_GREEN}chmod +x <file>${HELP_NC}
• "No such file or directory" → check spelling and use ${HELP_GREEN}ls${HELP_NC}
• "Command not found" → ensure you're in the right directory
• Stuck? Check ${HELP_GREEN}scroll${HELP_NC} files or ${HELP_GREEN}README.md${HELP_NC}

EOF
            ;;
        *)
            echo -e "${HELP_RED}Unknown help topic: $topic${HELP_NC}"
            echo -e "Available topics: ${HELP_GREEN}commands${HELP_NC}, ${HELP_GREEN}tips${HELP_NC}"
            ;;
    esac
}

# Main help function
main() {
    local help_topic="${1:-}"
    local help_subtopic="${2:-}"
    
    # Handle specific help topics first
    case "$help_topic" in
        tutorial)
            show_advanced_help "tutorial" "$help_subtopic"
            return
            ;;
        ai)
            show_advanced_help "ai"
            return
            ;;
        merlin|ask)
            # Bridge to the Python AI chat CLI
            shift  # remove 'merlin'/'ask' from args
            local question="${*:-}"
            local ti_dir="${BASHCRAWL_ROOT}/src/terminal-illness"
            local python_bin
            python_bin="$(command -v python3 2>/dev/null || command -v python 2>/dev/null || echo "")"

            if [[ -z "$question" ]]; then
                echo "Usage: help merlin <question>"
                echo "       help ask <question>"
                echo "Example: help merlin \"how do I find hidden files?\""
                return 0
            fi

            if [[ -n "$python_bin" ]] && [[ -d "$ti_dir" ]]; then
                # Run the Python chat CLI bridge
                (cd "$ti_dir" && PYTHONPATH="$ti_dir" "$python_bin" -m ti.chat_cli "$question") \
                    || echo "🧙 Merlin: (Set ANTHROPIC_API_KEY for full AI guidance)"
            else
                # Fallback: use existing bash AI engine
                echo "🧙 Merlin says: Try 'ls -F' to survey your surroundings, then 'cat scroll' to read the wisdom within."
                if [[ "$AI_ENGINE_AVAILABLE" = true ]]; then
                    local location="${PWD##*/}"
                    get_ai_recommendations "$location" "new_area"
                fi
            fi
            return
            ;;
        suggest)
            show_advanced_help "suggest" "$help_subtopic" "${3:-}"
            return
            ;;
        qref|ref|reference)
            show_advanced_help "qref" "$help_subtopic"
            return
            ;;
        commands)
            show_advanced_help "commands"
            return
            ;;
        tips)
            show_advanced_help "tips"
            return
            ;;
        version)
            echo -e "${HELP_BOLD}${HELP_PURPLE}⚔️ Bashcrawl Help System v2.0${HELP_NC}"
            echo
            echo "🎯 Core Features:"
            echo "   • Context-aware location guidance"
            echo "   • Progress-based recommendations"
            echo "   • Universal terminal command reference"
            echo
            echo "🚀 Enhanced Features:"
            if [ "$AI_ENGINE_AVAILABLE" = true ]; then
                echo "   ✅ AI Learning Engine - Tracks and adapts to your progress"
            else
                echo "   ❌ AI Learning Engine - Not available"
            fi
            
            if [ "$TUTORIAL_ENGINE_AVAILABLE" = true ]; then
                echo "   ✅ Interactive Tutorial Mode - Guided learning experience"
            else
                echo "   ❌ Interactive Tutorial Mode - Not available"
            fi
            
            if [ "$SUGGESTER_AVAILABLE" = true ]; then
                echo "   ✅ Smart Command Suggester - Context-aware recommendations"
            else
                echo "   ❌ Smart Command Suggester - Not available"
            fi
            
            if [ "$QUICK_REF_AVAILABLE" = true ]; then
                echo "   ✅ Quick Reference Cards - Instant command cheat sheets"
            else
                echo "   ❌ Quick Reference Cards - Not available"
            fi
            
            echo
            echo "💡 Try: help tutorial, help ai, help suggest, help qref, help commands, help tips"
            return
            ;;
    esac
    
    # Clear screen for better presentation
    clear
    
    # Show header
    echo -e "${HELP_BOLD}${HELP_PURPLE}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║              ⚔️  BASHCRAWL HELP SYSTEM ⚔️                ║"
    echo "║           Intelligent Terminal Adventure Guide            ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${HELP_NC}"
    
    # Detect context
    local location=$(detect_location)
    local progress=$(analyze_progress "$location")
    
    # Log this help request for AI learning
    if [ "$AI_ENGINE_AVAILABLE" = true ]; then
        log_action "help_request" "$location"
    fi
    
    # Show comprehensive help
    show_player_status "$progress"
    show_location_help "$location"
    get_ai_suggestions "$location" "$progress"
    echo
    show_contextual_tips "$location" "$progress"
    echo
    show_universal_commands
    
    # Enhanced footer with new options
    echo -e "${HELP_BOLD}${HELP_PURPLE}═══════════════════════════════════════════════════════════${HELP_NC}"
    echo -e "${HELP_BOLD}${HELP_WHITE}🎯 Extended Help:${HELP_NC}"
    echo -e "   ${HELP_GREEN}help qref${HELP_NC} - Quick reference cards for instant command lookup"
    echo -e "   ${HELP_GREEN}help suggest${HELP_NC} - Smart command recommendations for current situation"
    echo -e "   ${HELP_GREEN}help tutorial${HELP_NC} - Interactive learning mode with guided lessons"
    echo -e "   ${HELP_GREEN}help ai${HELP_NC} - AI system status and intelligent features"
    echo -e "   ${HELP_GREEN}help commands${HELP_NC} - Detailed command reference with examples"
    echo -e "   ${HELP_GREEN}help tips${HELP_NC} - Advanced tips and power-user techniques"
    echo -e "   ${HELP_GREEN}help version${HELP_NC} - System information and available features"
    echo -e "${HELP_BOLD}${HELP_PURPLE}═══════════════════════════════════════════════════════════${HELP_NC}"
    echo -e "${HELP_BOLD}${HELP_WHITE}May your commands be swift and your exit codes be zero! ⚔️${HELP_NC}"
    echo
}

# Run main only when executed directly (not when sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
