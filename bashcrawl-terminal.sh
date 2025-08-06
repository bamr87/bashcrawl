#!/usr/bin/env bash
#
# Bashcrawl Interactive Terminal Emulator
# A contained shell environment for the terminal adventure game
#
# Author: Bashcrawl Development Team
# Version: 1.0.0
# Description: Self-contained terminal emulator that provides a safe, 
#              game-focused environment for learning terminal commands
#

set -euo pipefail

# ============================================================================
# CONFIGURATION AND INITIALIZATION
# ============================================================================

# Get the absolute path to the bashcrawl directory
BASHCRAWL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GAME_STATE_FILE="${BASHCRAWL_ROOT}/.game_state"
HISTORY_FILE="${BASHCRAWL_ROOT}/.game_history"

# Game environment variables
export BASHCRAWL_MODE="terminal_emulator"
export BASHCRAWL_ROOT
export I=""  # Inventory
export HP=100  # Health Points
export GAME_LEVEL="novice"
export CURRENT_AREA="pre-entrance"

# Terminal appearance settings
PROMPT_COLOR='\033[0;36m'  # Cyan
DIRECTORY_COLOR='\033[0;35m'  # Purple
ERROR_COLOR='\033[0;31m'  # Red
SUCCESS_COLOR='\033[0;32m'  # Green
RESET_COLOR='\033[0m'  # Reset

# Restricted command mode - only allow safe game commands
RESTRICTED_MODE=true

# ============================================================================
# TERMINAL EMULATOR FUNCTIONS
# ============================================================================

# Display the game's welcome banner
show_welcome_banner() {
    clear
    cat << 'EOF'
╔═══════════════════════════════════════════════════════════════════════════╗
║                    ⚔️  BASHCRAWL TERMINAL EMULATOR ⚔️                      ║
║                                                                           ║
║        Welcome to the contained terminal environment for learning!       ║
║                                                                           ║
║  This is a safe, game-focused terminal that teaches you real commands    ║
║  while protecting your system. All commands work exactly like in a       ║
║  real terminal, but within the boundaries of this adventure game.        ║
║                                                                           ║
║  Type 'help' for assistance, 'tutorial' for guidance, or 'exit' to quit  ║
╚═══════════════════════════════════════════════════════════════════════════╝

🎯 QUICK START:
   • Type 'start' to begin your adventure
   • Type 'ls' to see what's available
   • Type 'cd entrance' to enter the catacombs
   • Type 'help' for context-aware assistance

🔐 SAFETY NOTICE:
   This terminal is contained within the game directory.
   You cannot access or modify files outside the game.

EOF
}

# Generate the command prompt
generate_prompt() {
    local current_dir
    current_dir=$(basename "$(pwd)")
    
    # Show different prompts based on location
    case "$current_dir" in
        "bashcrawl")
            echo -e "${PROMPT_COLOR}🏠 bashcrawl${RESET_COLOR} ${DIRECTORY_COLOR}[lobby]${RESET_COLOR} ⚔️  "
            ;;
        "entrance")
            echo -e "${PROMPT_COLOR}🚪 entrance${RESET_COLOR} ${DIRECTORY_COLOR}[starting hall]${RESET_COLOR} ⚔️  "
            ;;
        "cellar")
            echo -e "${PROMPT_COLOR}🏰 cellar${RESET_COLOR} ${DIRECTORY_COLOR}[underground]${RESET_COLOR} ⚔️  "
            ;;
        "armoury")
            echo -e "${PROMPT_COLOR}🗡️ armoury${RESET_COLOR} ${DIRECTORY_COLOR}[weapons hall]${RESET_COLOR} ⚔️  "
            ;;
        *)
            echo -e "${PROMPT_COLOR}📍 $current_dir${RESET_COLOR} ${DIRECTORY_COLOR}[unknown]${RESET_COLOR} ⚔️  "
            ;;
    esac
}

# Safe command execution with restrictions
execute_command() {
    local cmd="$1"
    shift
    local args="$@"
    
    # Log command to history
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $cmd $args" >> "$HISTORY_FILE"
    
    case "$cmd" in
        # Navigation commands
        "cd")
            safe_cd "$args"
            ;;
        "ls")
            safe_ls "$args"
            ;;
        "pwd")
            pwd
            ;;
        
        # File viewing commands
        "cat")
            safe_cat "$args"
            ;;
        "less"|"more")
            safe_pager "$cmd" "$args"
            ;;
        "head")
            safe_head "$args"
            ;;
        "tail")
            safe_tail "$args"
            ;;
        "wc")
            safe_wc "$args"
            ;;
        
        # Game-specific commands
        "inventory"|"i")
            show_inventory
            ;;
        "health"|"hp")
            show_health
            ;;
        "status")
            show_game_status
            ;;
        "map")
            show_map
            ;;
        
        # Help and information
        "help")
            show_contextual_help "$args"
            ;;
        "tutorial")
            show_tutorial
            ;;
        "commands")
            show_available_commands
            ;;
        
        # Adventure commands
        "start")
            start_adventure
            ;;
        "look")
            look_around
            ;;
        "explore")
            explore_area
            ;;
        
        # File operations (limited)
        "touch")
            if [[ "$args" =~ ^[a-zA-Z0-9_.-]+$ ]]; then
                touch "$args"
            else
                echo -e "${ERROR_COLOR}Error: Invalid filename. Only alphanumeric characters, dots, dashes, and underscores allowed.${RESET_COLOR}"
            fi
            ;;
        
        # Executable files (game content)
        "./treasure"|"./potion"|"./spell"|"./monster"|"./ghost")
            if [[ -x "$cmd" ]]; then
                "$cmd" $args
            else
                echo -e "${ERROR_COLOR}Error: $cmd not found or not executable${RESET_COLOR}"
            fi
            ;;
        
        # System info (safe subset)
        "whoami")
            echo "bashcrawl_adventurer"
            ;;
        "date")
            date
            ;;
        "echo")
            echo "$args"
            ;;
        
        # Terminal control
        "clear")
            clear
            ;;
        "history")
            show_command_history
            ;;
        "reset")
            reset_game_state
            ;;
        
        # Exit commands
        "exit"|"quit"|"q")
            exit_terminal
            ;;
        
        # Catch-all for unknown commands
        *)
            if [[ -x "./$cmd" ]]; then
                "./$cmd" $args
            else
                echo -e "${ERROR_COLOR}Command not recognized: $cmd${RESET_COLOR}"
                echo -e "Type 'commands' to see available commands, or 'help' for assistance."
            fi
            ;;
    esac
}

# ============================================================================
# SAFE COMMAND IMPLEMENTATIONS
# ============================================================================

safe_cd() {
    local target="$1"
    
    # Handle special cases
    case "$target" in
        ""|"~")
            cd "$BASHCRAWL_ROOT"
            ;;
        "..")
            # Only allow going up within the game directory
            if [[ "$(pwd)" != "$BASHCRAWL_ROOT" ]]; then
                cd ..
            else
                echo -e "${ERROR_COLOR}You cannot leave the bashcrawl realm!${RESET_COLOR}"
            fi
            ;;
        "/"*)
            echo -e "${ERROR_COLOR}Absolute paths are not allowed in the game environment.${RESET_COLOR}"
            ;;
        *)
            if [[ -d "$target" ]]; then
                cd "$target"
                # Update current area for game state
                update_current_area
            else
                echo -e "${ERROR_COLOR}Directory not found: $target${RESET_COLOR}"
            fi
            ;;
    esac
}

safe_ls() {
    local args="$@"
    
    # Enhance ls output with game context
    if [[ -z "$args" ]]; then
        ls -F --color=auto
    else
        ls -F --color=auto "$args"
    fi
    
    # Add game-specific information
    add_area_context
}

safe_cat() {
    local file="$1"
    
    if [[ -z "$file" ]]; then
        echo -e "${ERROR_COLOR}Usage: cat <filename>${RESET_COLOR}"
        return 1
    fi
    
    if [[ -f "$file" ]]; then
        cat "$file"
        # Update game state if reading important files
        if [[ "$file" == "scroll" ]]; then
            mark_scroll_read
        fi
    else
        echo -e "${ERROR_COLOR}File not found: $file${RESET_COLOR}"
    fi
}

safe_pager() {
    local cmd="$1"
    local file="$2"
    
    if [[ -z "$file" ]]; then
        echo -e "${ERROR_COLOR}Usage: $cmd <filename>${RESET_COLOR}"
        return 1
    fi
    
    if [[ -f "$file" ]]; then
        case "$cmd" in
            "less")
                less "$file"
                ;;
            "more")
                more "$file"
                ;;
        esac
        
        # Update game state
        if [[ "$file" == "scroll" ]]; then
            mark_scroll_read
        fi
    else
        echo -e "${ERROR_COLOR}File not found: $file${RESET_COLOR}"
    fi
}

safe_head() {
    local file="$1"
    
    if [[ -z "$file" ]]; then
        echo -e "${ERROR_COLOR}Usage: head <filename>${RESET_COLOR}"
        return 1
    fi
    
    if [[ -f "$file" ]]; then
        head "$file"
    else
        echo -e "${ERROR_COLOR}File not found: $file${RESET_COLOR}"
    fi
}

safe_tail() {
    local file="$1"
    
    if [[ -z "$file" ]]; then
        echo -e "${ERROR_COLOR}Usage: tail <filename>${RESET_COLOR}"
        return 1
    fi
    
    if [[ -f "$file" ]]; then
        tail "$file"
    else
        echo -e "${ERROR_COLOR}File not found: $file${RESET_COLOR}"
    fi
}

safe_wc() {
    local file="$1"
    
    if [[ -z "$file" ]]; then
        echo -e "${ERROR_COLOR}Usage: wc <filename>${RESET_COLOR}"
        return 1
    fi
    
    if [[ -f "$file" ]]; then
        wc "$file"
    else
        echo -e "${ERROR_COLOR}File not found: $file${RESET_COLOR}"
    fi
}

# ============================================================================
# GAME-SPECIFIC FUNCTIONS
# ============================================================================

show_inventory() {
    echo -e "${SUCCESS_COLOR}🎒 INVENTORY:${RESET_COLOR}"
    if [[ -n "$I" ]]; then
        echo "   Items: $I"
        local item_count
        item_count=$(echo "$I" | tr ',' '\n' | wc -l | tr -d ' ')
        echo "   Total Items: $item_count"
    else
        echo "   Your inventory is empty. Find treasures to collect items!"
    fi
}

show_health() {
    echo -e "${SUCCESS_COLOR}❤️  HEALTH STATUS:${RESET_COLOR}"
    if [[ -n "$HP" ]]; then
        echo "   Health Points: $HP"
        if [[ $HP -gt 80 ]]; then
            echo "   Status: Excellent condition!"
        elif [[ $HP -gt 60 ]]; then
            echo "   Status: Good condition"
        elif [[ $HP -gt 40 ]]; then
            echo "   Status: Wounded"
        elif [[ $HP -gt 20 ]]; then
            echo "   Status: Badly wounded"
        else
            echo "   Status: Critical condition!"
        fi
    else
        echo "   Health not initialized"
    fi
}

show_game_status() {
    echo -e "${SUCCESS_COLOR}📊 ADVENTURE STATUS:${RESET_COLOR}"
    echo "   Location: $(pwd)"
    echo "   Area: $CURRENT_AREA"
    echo "   Level: $GAME_LEVEL"
    echo ""
    show_inventory
    echo ""
    show_health
}

show_map() {
    echo -e "${SUCCESS_COLOR}🗺️  CATACOMBS MAP:${RESET_COLOR}"
    cat << 'EOF'

    🏠 bashcrawl (lobby)
        ↓
    🚪 entrance (starting hall)
        ↓
    🏰 cellar (underground chambers)
        ↓
    🗡️ armoury (weapons hall)
        ↓
    💎 chamber (treasure room)

Legend:
  🏠 = Main lobby area
  🚪 = Starting entrance
  🏰 = Underground areas  
  🗡️ = Combat areas
  💎 = Treasure areas
  
Current location: $(basename "$(pwd)")

EOF
}

add_area_context() {
    local current_dir
    current_dir=$(basename "$(pwd)")
    
    case "$current_dir" in
        "bashcrawl")
            echo ""
            echo -e "${SUCCESS_COLOR}🏠 You are in the main lobby. Type 'cd entrance' to begin your adventure.${RESET_COLOR}"
            ;;
        "entrance")
            echo ""
            echo -e "${SUCCESS_COLOR}🚪 You stand at the entrance to the catacombs. Read the 'scroll' for guidance.${RESET_COLOR}"
            ;;
        "cellar")
            echo ""
            echo -e "${SUCCESS_COLOR}🏰 You are in the underground cellar. Explore carefully!${RESET_COLOR}"
            ;;
        "armoury")
            echo ""
            echo -e "${SUCCESS_COLOR}🗡️ You have entered the armoury. Weapons and combat await!${RESET_COLOR}"
            ;;
    esac
    
    # Show available scrolls and executables
    if [[ -f "scroll" ]]; then
        echo -e "📜 There is a scroll here. Read it with: ${PROMPT_COLOR}cat scroll${RESET_COLOR}"
    fi
    
    local executables
    executables=$(find . -maxdepth 1 -type f -executable 2>/dev/null | head -3)
    if [[ -n "$executables" ]]; then
        echo -e "⚡ Interactive elements found:"
        echo "$executables" | while read -r exe; do
            local name
            name=$(basename "$exe")
            case "$name" in
                "treasure") echo -e "   💰 $name - Collect treasures" ;;
                "potion") echo -e "   🧪 $name - Restore health" ;;
                "spell") echo -e "   📜 $name - Cast magic spells" ;;
                "monster") echo -e "   👹 $name - Combat encounter" ;;
                *) echo -e "   ⚡ $name - Interactive element" ;;
            esac
        done
    fi
}

show_contextual_help() {
    local topic="$1"
    
    if [[ -n "$topic" ]]; then
        case "$topic" in
            "commands")
                show_available_commands
                ;;
            "navigation")
                show_navigation_help
                ;;
            "game")
                show_game_help
                ;;
            *)
                echo -e "${ERROR_COLOR}Help topic not found: $topic${RESET_COLOR}"
                echo "Available topics: commands, navigation, game"
                ;;
        esac
    else
        # Context-aware help based on current location
        echo -e "${SUCCESS_COLOR}🎯 CONTEXTUAL HELP:${RESET_COLOR}"
        echo ""
        echo "You are currently in: $(pwd)"
        echo "Area: $CURRENT_AREA"
        echo ""
        
        # Location-specific help
        local current_dir
        current_dir=$(basename "$(pwd)")
        case "$current_dir" in
            "bashcrawl")
                echo "🏠 LOBBY HELP:"
                echo "   • Type 'start' to begin your adventure"
                echo "   • Type 'cd entrance' to enter the catacombs"
                echo "   • Type 'ls' to see available areas"
                ;;
            "entrance")
                echo "🚪 ENTRANCE HELP:"
                echo "   • Read the scroll: cat scroll"
                echo "   • Look around: ls -F"
                echo "   • Move deeper: cd cellar"
                ;;
            *)
                echo "📍 GENERAL HELP:"
                echo "   • Look around: ls"
                echo "   • Read documentation: cat scroll"
                echo "   • Check your status: status"
                ;;
        esac
        
        echo ""
        echo "Type 'help commands' for a full command list"
        echo "Type 'tutorial' for step-by-step guidance"
    fi
}

show_available_commands() {
    echo -e "${SUCCESS_COLOR}🎯 AVAILABLE COMMANDS:${RESET_COLOR}"
    cat << 'EOF'

NAVIGATION:
   cd <dir>     Change directory (move between rooms)
   ls           List contents of current room
   pwd          Show current location

FILE VIEWING:
   cat <file>   Display entire file content
   less <file>  View file with pagination
   head <file>  Show first 10 lines
   tail <file>  Show last 10 lines
   wc <file>    Count lines, words, characters

GAME COMMANDS:
   inventory    Show your collected items (alias: i)
   health       Show your health status (alias: hp)
   status       Show complete game status
   map          Display catacombs map
   start        Begin the adventure
   look         Examine current area
   explore      Detailed area exploration

HELP & LEARNING:
   help         Context-aware help system
   tutorial     Interactive tutorial
   commands     Show this command list

SYSTEM:
   clear        Clear the terminal screen
   history      Show command history
   reset        Reset game state
   exit         Leave the terminal emulator

GAME INTERACTIONS:
   ./treasure   Interact with treasure chests
   ./potion     Use healing potions
   ./spell      Cast magical spells
   ./monster    Engage in combat

EOF
}

show_tutorial() {
    echo -e "${SUCCESS_COLOR}📚 BASHCRAWL TUTORIAL:${RESET_COLOR}"
    cat << 'EOF'

Welcome to the Bashcrawl Tutorial! This will guide you through the basics.

STEP 1: Understanding Your Environment
   You are in a contained terminal environment. Type 'pwd' to see where you are.

STEP 2: Looking Around
   Type 'ls' to see what's available in your current location.

STEP 3: Moving Around
   Use 'cd <directory>' to move between rooms. Try 'cd entrance' to start.

STEP 4: Reading Information
   Use 'cat scroll' to read documentation in each area.

STEP 5: Checking Your Status
   Type 'status' to see your health, inventory, and current location.

STEP 6: Getting Help
   Type 'help' for context-specific assistance anywhere in the game.

PRACTICE SEQUENCE:
   1. Type: pwd
   2. Type: ls
   3. Type: cd entrance
   4. Type: cat scroll
   5. Type: status

Ready to begin? Type 'start' to enter the adventure!

EOF
}

start_adventure() {
    echo -e "${SUCCESS_COLOR}🎮 STARTING YOUR ADVENTURE...${RESET_COLOR}"
    echo ""
    echo "Preparing to enter the mystical catacombs..."
    echo ""
    
    # Initialize game state
    export I=""
    export HP=100
    export GAME_LEVEL="novice"
    
    # Move to entrance if not already there
    if [[ "$(basename "$(pwd)")" != "entrance" ]]; then
        cd "$BASHCRAWL_ROOT/entrance"
    fi
    
    echo -e "${SUCCESS_COLOR}✨ Adventure initialized!${RESET_COLOR}"
    echo ""
    echo "You stand before the entrance to the ancient catacombs..."
    echo "Type 'cat scroll' to read your first instructions."
    echo "Type 'ls' to look around."
    echo ""
    
    update_current_area
}

look_around() {
    echo -e "${SUCCESS_COLOR}👁️  LOOKING AROUND:${RESET_COLOR}"
    echo ""
    echo "Current location: $(pwd)"
    echo ""
    
    # Enhanced ls with game context
    ls -F --color=auto
    echo ""
    
    add_area_context
}

explore_area() {
    echo -e "${SUCCESS_COLOR}🔍 EXPLORING AREA:${RESET_COLOR}"
    echo ""
    echo "=== CURRENT LOCATION ==="
    pwd
    echo ""
    
    echo "=== VISIBLE CONTENTS ==="
    ls -la --color=auto
    echo ""
    
    echo "=== AREA ANALYSIS ==="
    local file_count dir_count exec_count
    file_count=$(find . -maxdepth 1 -type f | wc -l)
    dir_count=$(find . -maxdepth 1 -type d | wc -l)
    exec_count=$(find . -maxdepth 1 -type f -executable | wc -l)
    
    echo "   Files: $file_count"
    echo "   Directories: $((dir_count - 1))"  # Subtract current directory
    echo "   Executables: $exec_count"
    echo ""
    
    add_area_context
}

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

update_current_area() {
    local current_dir
    current_dir=$(basename "$(pwd)")
    CURRENT_AREA="$current_dir"
    
    # Save game state
    save_game_state
}

mark_scroll_read() {
    local area
    area=$(basename "$(pwd)")
    echo "scroll_read:$area:$(date)" >> "$GAME_STATE_FILE"
}

save_game_state() {
    cat > "$GAME_STATE_FILE" << EOF
CURRENT_AREA="$CURRENT_AREA"
INVENTORY="$I"
HEALTH="$HP"
GAME_LEVEL="$GAME_LEVEL"
LAST_UPDATED="$(date)"
EOF
}

load_game_state() {
    if [[ -f "$GAME_STATE_FILE" ]]; then
        source "$GAME_STATE_FILE"
        export I="$INVENTORY"
        export HP="$HEALTH"
        export CURRENT_AREA
        export GAME_LEVEL
    fi
}

show_command_history() {
    if [[ -f "$HISTORY_FILE" ]]; then
        echo -e "${SUCCESS_COLOR}📜 COMMAND HISTORY:${RESET_COLOR}"
        tail -20 "$HISTORY_FILE"
    else
        echo "No command history available."
    fi
}

reset_game_state() {
    echo -e "${SUCCESS_COLOR}🔄 RESETTING GAME STATE...${RESET_COLOR}"
    
    # Reset variables
    export I=""
    export HP=100
    export GAME_LEVEL="novice"
    export CURRENT_AREA="pre-entrance"
    
    # Clear state files
    rm -f "$GAME_STATE_FILE"
    rm -f "$HISTORY_FILE"
    
    # Return to root
    cd "$BASHCRAWL_ROOT"
    
    echo "Game state has been reset. Type 'start' to begin a new adventure."
}

exit_terminal() {
    echo -e "${SUCCESS_COLOR}👋 Thanks for playing Bashcrawl!${RESET_COLOR}"
    echo ""
    echo "You learned these commands during your adventure:"
    if [[ -f "$HISTORY_FILE" ]]; then
        awk '{print $4}' "$HISTORY_FILE" | sort | uniq -c | sort -nr | head -10
    fi
    echo ""
    echo "Remember: These skills work in real terminals too!"
    echo "Continue your journey at: https://github.com/bamr87/bashcrawl"
    echo ""
    exit 0
}

# ============================================================================
# MAIN TERMINAL LOOP
# ============================================================================

main() {
    # Initialize environment
    cd "$BASHCRAWL_ROOT"
    
    # Load existing game state if available
    load_game_state
    
    # Show welcome banner
    show_welcome_banner
    
    # Create history file if it doesn't exist
    touch "$HISTORY_FILE"
    
    # Main command loop
    while true; do
        # Display prompt and read command
        echo -n "$(generate_prompt)"
        read -r -e input
        
        # Skip empty input
        if [[ -z "$input" ]]; then
            continue
        fi
        
        # Parse command and arguments
        read -ra cmd_array <<< "$input"
        local command="${cmd_array[0]}"
        local args="${cmd_array[@]:1}"
        
        # Execute command
        execute_command "$command" $args
        
        # Save state after each command
        save_game_state
        
        echo  # Add spacing between commands
    done
}

# ============================================================================
# SCRIPT ENTRY POINT
# ============================================================================

# Check if running directly or being sourced
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
