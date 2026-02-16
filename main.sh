#!/usr/bin/env bash
#
# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                          ⚔️  BASHCRAWL MAIN ⚔️                           ║
# ║                                                                           ║
# ║                    Terminal Adventure Game Entry Point                    ║
# ╚═══════════════════════════════════════════════════════════════════════════╝
#
# @file main.sh
# @description Main entry point for the Bashcrawl terminal adventure game
# @author Bashcrawl Development Team <team@bashcrawl.org>
# @created 2025-08-05
# @lastModified 2025-08-05
# @version 2.0.0
# @license MIT
#
# @pathContext
#   - incomingPaths: [setup.sh, user terminal]
#   - outgoingPaths: [bashcrawl-terminal.sh, help system, game areas]
#   - parallelPaths: [help/*.sh, entrance/*, logs/*]
#
# @relatedFiles
#   - setup.sh: Installation and configuration
#   - bashcrawl-terminal.sh: Interactive terminal emulator
#   - help/: Comprehensive help system
#   - entrance/: Game starting point
#
# Path: Main Entry Point → Game Mode Selection → Adventure Experience
#
# USAGE:
#   ./main.sh                    # Interactive launcher menu
#   ./main.sh --interactive      # Start interactive terminal emulator
#   ./main.sh --native          # Start native terminal experience
#   ./main.sh --help            # Show help information
#   ./main.sh --tutorial        # Launch tutorial mode
#   ./main.sh --demo            # Run demonstration
#   ./main.sh --status          # Show game status
#   ./main.sh --reset           # Reset game state
#

set -euo pipefail

# ============================================================================
# GLOBAL CONFIGURATION AND INITIALIZATION
# ============================================================================

# Path: Environment Variable Setup
readonly SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly BASHCRAWL_ROOT="$SCRIPT_DIR"
readonly VERSION="2.0.0"
readonly BUILD_DATE="2025-08-05"

# Path: Game State Management
readonly GAME_STATE_FILE="${BASHCRAWL_ROOT}/.game_state"
readonly GAME_HISTORY_FILE="${BASHCRAWL_ROOT}/.game_history"
readonly GAME_DATA_DIR="${BASHCRAWL_ROOT}/.game_data"
readonly LOG_DIR="${BASHCRAWL_ROOT}/logs"

# Path: Color Configuration for Enhanced UX
readonly COLOR_PRIMARY='\033[0;36m'     # Cyan
readonly COLOR_SECONDARY='\033[0;35m'   # Purple  
readonly COLOR_SUCCESS='\033[0;32m'     # Green
readonly COLOR_WARNING='\033[0;33m'     # Yellow
readonly COLOR_ERROR='\033[0;31m'       # Red
readonly COLOR_INFO='\033[0;34m'        # Blue
readonly COLOR_BOLD='\033[1m'           # Bold
readonly COLOR_RESET='\033[0m'          # Reset

# Path: Game Environment Variables
export BASHCRAWL_MODE="main_launcher"
export BASHCRAWL_ROOT
export BASHCRAWL_VERSION="$VERSION"

# Path: Initialize Session Logging
if [[ -f "${BASHCRAWL_ROOT}/lib/log.sh" ]]; then
    source "${BASHCRAWL_ROOT}/lib/log.sh"
    bc_session_start "launcher"
fi

# ============================================================================
# CORE UTILITY FUNCTIONS - PATH: FOUNDATION SERVICES
# ============================================================================

# Path: Logging System with Enhanced Context
log_event() {
    local level="$1"
    local message="$2"
    local context="${3:-main}"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Ensure log directory exists
    mkdir -p "$LOG_DIR"
    
    # Log to file with structured format
    echo "[$timestamp] [$level] [$context] $message" >> "${LOG_DIR}/bashcrawl.log"
    
    # Display to user with appropriate colors
    case "$level" in
        "INFO")  echo -e "${COLOR_INFO}ℹ️  $message${COLOR_RESET}" ;;
        "SUCCESS") echo -e "${COLOR_SUCCESS}✅ $message${COLOR_RESET}" ;;
        "WARNING") echo -e "${COLOR_WARNING}⚠️  $message${COLOR_RESET}" ;;
        "ERROR") echo -e "${COLOR_ERROR}❌ $message${COLOR_RESET}" ;;
        "DEBUG") [[ "${BASHCRAWL_DEBUG:-}" == "true" ]] && echo -e "${COLOR_INFO}🔍 $message${COLOR_RESET}" ;;
    esac
}

# Path: Environment Validation with Comprehensive Checks
validate_environment() {
    log_event "INFO" "Validating Bashcrawl environment..." "validation"
    
    # Check required directories exist
    local required_dirs=("entrance" "help")
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "${BASHCRAWL_ROOT}/$dir" ]]; then
            log_event "ERROR" "Required directory missing: $dir" "validation"
            log_event "INFO" "Run './setup.sh' to initialize the game environment" "validation"
            return 1
        fi
    done
    
    # Check critical files exist
    local required_files=("bashcrawl-terminal.sh" "help/bashcrawl_help.sh")
    for file in "${required_files[@]}"; do
        if [[ ! -f "${BASHCRAWL_ROOT}/$file" ]]; then
            log_event "ERROR" "Required file missing: $file" "validation"
            return 1
        fi
    done
    
    # Ensure executable permissions
    chmod +x "${BASHCRAWL_ROOT}/bashcrawl-terminal.sh" 2>/dev/null || true
    
    # Create necessary directories
    mkdir -p "$GAME_DATA_DIR" "$LOG_DIR"
    
    log_event "SUCCESS" "Environment validation completed" "validation"
    return 0
}

# Path: Game State Management with Persistence
initialize_game_state() {
    log_event "INFO" "Initializing game state..." "state"
    
    # Create default game state if it doesn't exist
    if [[ ! -f "$GAME_STATE_FILE" ]]; then
        cat > "$GAME_STATE_FILE" << EOF
# Bashcrawl Initial Game State
PLAYER_INVENTORY=""
PLAYER_HEALTH=100
PLAYER_LEVEL="novice"
CURRENT_AREA="pre-entrance"
GAME_STARTED="false"
TUTORIAL_COMPLETED="false"
AREAS_VISITED=""
TREASURES_FOUND=""
LAST_SESSION="$(date -Iseconds)"
SESSION_COUNT=0
TOTAL_PLAYTIME=0
# Terminal-emulator state (populated on first interactive session)
INVENTORY=""
HEALTH=100
GAME_LEVEL="novice"
CURRENT_QUEST_ID=0
QUEST_COMPLETED=""
LEARNED_COMMANDS=""
GAME_XP=0
SCROLLS_READ=""
CURRENT_PATH="bashcrawl"
EOF
        log_event "SUCCESS" "Game state initialized" "state"
    else
        log_event "INFO" "Loading existing game state" "state"
        # Update last session time
        sed -i.bak "s/LAST_SESSION=.*/LAST_SESSION=\"$(date -Iseconds)\"/" "$GAME_STATE_FILE"
    fi
    
    # Source the game state with error handling
    if [[ -f "$GAME_STATE_FILE" ]]; then
        # Temporarily disable strict mode for sourcing
        set +u
        source "$GAME_STATE_FILE"
        set -u
    fi
}

# Path: Display System with Rich Formatting
show_banner() {
    clear
    cat << 'EOF'
╔═══════════════════════════════════════════════════════════════════════════╗
║                          ⚔️  BASHCRAWL LAUNCHER ⚔️                        ║
║                                                                           ║
║                    Master the Terminal Through Adventure                  ║
║                                                                           ║
║  Transform from terminal novice to command-line champion by exploring     ║
║  mystical catacombs, solving puzzles, and learning real UNIX commands!   ║
╚═══════════════════════════════════════════════════════════════════════════╝
EOF
    
    echo -e "${COLOR_INFO}🎮 Version: $VERSION | Build: $BUILD_DATE${COLOR_RESET}"
    echo ""
}

# Path: Status Display with Game Progress
show_game_status() {
    echo -e "${COLOR_PRIMARY}📊 ADVENTURE STATUS${COLOR_RESET}"
    echo "─────────────────────────────────────────────────────────────────────"
    
    if [[ -f "$GAME_STATE_FILE" ]]; then
        # Temporarily disable strict mode for sourcing
        set +u
        source "$GAME_STATE_FILE"
        set -u
        
        echo -e "${COLOR_SUCCESS}🏠 Current Area:${COLOR_RESET} ${CURRENT_AREA:-unknown}"
        echo -e "${COLOR_SUCCESS}🎯 Player Level:${COLOR_RESET} ${PLAYER_LEVEL:-novice}"
        echo -e "${COLOR_SUCCESS}❤️  Health:${COLOR_RESET} ${PLAYER_HEALTH:-100}"
        echo -e "${COLOR_SUCCESS}🎒 Inventory:${COLOR_RESET} ${PLAYER_INVENTORY:-"Empty"}"
        echo -e "${COLOR_SUCCESS}🏆 Areas Visited:${COLOR_RESET} ${AREAS_VISITED:-"None"}"
        echo -e "${COLOR_SUCCESS}💰 Treasures Found:${COLOR_RESET} ${TREASURES_FOUND:-"None"}"
        echo -e "${COLOR_SUCCESS}📅 Last Session:${COLOR_RESET} ${LAST_SESSION:-"Never"}"
        echo -e "${COLOR_SUCCESS}🔢 Session Count:${COLOR_RESET} ${SESSION_COUNT:-0}"
        
        if [[ "${TUTORIAL_COMPLETED:-false}" == "true" ]]; then
            echo -e "${COLOR_SUCCESS}📚 Tutorial:${COLOR_RESET} ✅ Completed"
        else
            echo -e "${COLOR_WARNING}📚 Tutorial:${COLOR_RESET} ⏳ Not completed"
        fi
    else
        echo -e "${COLOR_WARNING}No game state found. Start a new adventure!${COLOR_RESET}"
    fi
    echo ""
}

# ============================================================================
# GAME MODE IMPLEMENTATIONS - PATH: ADVENTURE EXPERIENCES
# ============================================================================

# Path: Interactive Terminal Launcher with Safety Features
launch_interactive_mode() {
    log_event "INFO" "Starting Interactive Terminal Emulator..." "interactive"
    
    echo -e "${COLOR_PRIMARY}🎮 INTERACTIVE TERMINAL EMULATOR${COLOR_RESET}"
    echo "─────────────────────────────────────────────────────────────────────"
    echo -e "${COLOR_SUCCESS}✅ Safe, contained environment${COLOR_RESET}"
    echo -e "${COLOR_SUCCESS}✅ Built-in help and tutorials${COLOR_RESET}"
    echo -e "${COLOR_SUCCESS}✅ Perfect for learning without fear${COLOR_RESET}"
    echo -e "${COLOR_SUCCESS}✅ All real terminal commands work within game bounds${COLOR_RESET}"
    echo ""
    echo -e "${COLOR_INFO}Launching terminal emulator...${COLOR_RESET}"
    echo ""
    
    # Update game state
    if [[ -f "$GAME_STATE_FILE" ]]; then
        sed -i.bak "s/GAME_STARTED=.*/GAME_STARTED=\"true\"/" "$GAME_STATE_FILE"
        # Increment session count
        local current_count
        current_count=$(grep "SESSION_COUNT=" "$GAME_STATE_FILE" | cut -d= -f2 || echo "0")
        sed -i.bak "s/SESSION_COUNT=.*/SESSION_COUNT=$((current_count + 1))/" "$GAME_STATE_FILE"
    fi
    
    # Launch the interactive terminal emulator
    exec "${BASHCRAWL_ROOT}/bashcrawl-terminal.sh"
}

# Path: Native Terminal Experience with Guidance
launch_native_mode() {
    log_event "INFO" "Starting Native Terminal Experience..." "native"
    
    echo -e "${COLOR_PRIMARY}🏠 NATIVE TERMINAL EXPERIENCE${COLOR_RESET}"
    echo "─────────────────────────────────────────────────────────────────────"
    echo -e "${COLOR_WARNING}⚡ Uses your actual terminal environment${COLOR_RESET}"
    echo -e "${COLOR_WARNING}⚡ Full access to your system commands${COLOR_RESET}"  
    echo -e "${COLOR_WARNING}⚡ Traditional bashcrawl experience${COLOR_RESET}"
    echo ""
    echo -e "${COLOR_INFO}📋 TO BEGIN YOUR ADVENTURE:${COLOR_RESET}"
    echo ""
    echo -e "${COLOR_PRIMARY}1. Navigate to the entrance:${COLOR_RESET}"
    echo "   cd ${BASHCRAWL_ROOT}/entrance"
    echo ""
    echo -e "${COLOR_PRIMARY}2. Read your first scroll:${COLOR_RESET}"
    echo "   cat scroll"
    echo ""
    echo -e "${COLOR_PRIMARY}3. Enable the help system (optional):${COLOR_RESET}"
    echo "   source ${BASHCRAWL_ROOT}/help/init_help.sh"
    echo ""
    echo -e "${COLOR_PRIMARY}4. Enable session logging (optional):${COLOR_RESET}"
    echo "   source ${BASHCRAWL_ROOT}/lib/log.sh && bc_session_start native && bc_install_hooks"
    echo ""
    echo -e "${COLOR_INFO}💡 Type 'help' anytime for context-aware assistance${COLOR_RESET}"
    echo -e "${COLOR_INFO}💡 Type 'map' to see available areas${COLOR_RESET}"
    echo ""
    
    # Update game state
    if [[ -f "$GAME_STATE_FILE" ]]; then
        sed -i.bak "s/GAME_STARTED=.*/GAME_STARTED=\"true\"/" "$GAME_STATE_FILE"
    fi
}

# Path: Tutorial System with Progressive Learning
launch_tutorial() {
    log_event "INFO" "Starting Tutorial Mode..." "tutorial"
    
    echo -e "${COLOR_PRIMARY}📚 BASHCRAWL TUTORIAL${COLOR_RESET}"
    echo "─────────────────────────────────────────────────────────────────────"
    echo ""
    echo -e "${COLOR_INFO}🎯 WHAT IS BASHCRAWL?${COLOR_RESET}"
    echo ""
    echo "Bashcrawl is an immersive text-based adventure game that teaches you"
    echo "terminal/command-line skills through engaging gameplay. You'll learn real"
    echo "terminal commands while exploring mystical catacombs!"
    echo ""
    echo -e "${COLOR_INFO}🚀 BASIC COMMANDS TO LEARN:${COLOR_RESET}"
    echo ""
    echo "   ls           - List files and directories"
    echo "   cd <dir>     - Change directory (move between rooms)"
    echo "   cat <file>   - View file contents"
    echo "   pwd          - Show current location"
    echo "   less <file>  - View file with pagination"
    echo ""
    echo -e "${COLOR_INFO}🎓 LEARNING PATH:${COLOR_RESET}"
    echo ""
    echo "   Entrance → Cellar → Armoury → Chamber → Advanced Areas"
    echo ""
    echo "   Each area teaches specific terminal skills that build upon each other."
    echo ""
    echo -e "${COLOR_INFO}🆘 GETTING HELP:${COLOR_RESET}"
    echo ""
    echo "   • In Interactive Mode: Type 'help' for context-aware assistance"
    echo "   • In Native Mode: Source the help system"
    echo "   • Use './main.sh --help' for launcher options"
    echo ""
    echo -e "${COLOR_INFO}📖 DOCUMENTATION:${COLOR_RESET}"
    echo ""
    echo "   • README.md - Complete project documentation"
    echo "   • entrance/scroll - Your first instructions"
    echo "   • Each area has its own 'scroll' file with guidance"
    echo ""
    echo -e "${COLOR_SUCCESS}Ready to begin? Choose a game mode from the main menu!${COLOR_RESET}"
    echo ""
    
    # Mark tutorial as viewed
    if [[ -f "$GAME_STATE_FILE" ]]; then
        sed -i.bak "s/TUTORIAL_COMPLETED=.*/TUTORIAL_COMPLETED=\"true\"/" "$GAME_STATE_FILE"
    fi
    
    echo -n "Press Enter to return to main menu..."
    read -r
}

# Path: Demonstration Mode with Examples
launch_demo() {
    log_event "INFO" "Starting Demo Mode..." "demo"
    
    echo -e "${COLOR_PRIMARY}🎮 BASHCRAWL DEMO${COLOR_RESET}"
    echo "─────────────────────────────────────────────────────────────────────"
    echo ""
    echo "This demonstrates the interactive terminal environment:"
    echo ""
    echo -e "${COLOR_INFO}Example prompts in different areas:${COLOR_RESET}"
    echo -e "${COLOR_PRIMARY}🏠 bashcrawl [lobby] ⚔️${COLOR_RESET}  ls"
    echo -e "${COLOR_PRIMARY}🚪 entrance [starting hall] ⚔️${COLOR_RESET}  cat scroll"  
    echo -e "${COLOR_PRIMARY}🏰 cellar [underground] ⚔️${COLOR_RESET}  ./treasure"
    echo -e "${COLOR_PRIMARY}🗡️ armoury [weapons hall] ⚔️${COLOR_RESET}  help"
    echo ""
    echo -e "${COLOR_SUCCESS}Key features:${COLOR_RESET}"
    echo "✅ Safe environment - cannot access files outside game"
    echo "✅ Built-in help system with 'help' command"
    echo "✅ Game state tracking (inventory, health, progress)"
    echo "✅ Context-aware assistance based on your location"
    echo "✅ Interactive tutorials and command reference"
    echo "✅ All real terminal commands work within game bounds"
    echo ""
    echo -e "${COLOR_INFO}The terminal emulator teaches the same commands as a real terminal,${COLOR_RESET}"
    echo -e "${COLOR_INFO}but in a safe, guided environment perfect for learning!${COLOR_RESET}"
    echo ""
    
    echo -n "Press Enter to return to main menu..."
    read -r
}

# Path: Game State Reset with Confirmation
reset_game_state() {
    log_event "INFO" "Game state reset requested..." "reset"
    
    echo -e "${COLOR_WARNING}🔄 RESET GAME STATE${COLOR_RESET}"
    echo "─────────────────────────────────────────────────────────────────────"
    echo ""
    echo -e "${COLOR_WARNING}⚠️  This will permanently delete your current game progress:${COLOR_RESET}"
    echo "   • Player inventory and health"
    echo "   • Areas visited and treasures found"
    echo "   • Session history and statistics"
    echo "   • Tutorial completion status"
    echo ""
    echo -n "Are you sure you want to reset? [y/N]: "
    read -r confirmation
    
    if [[ "$confirmation" =~ ^[Yy]$ ]]; then
        # Backup current state
        if [[ -f "$GAME_STATE_FILE" ]]; then
            cp "$GAME_STATE_FILE" "${GAME_STATE_FILE}.backup.$(date +%s)"
            log_event "INFO" "Game state backed up before reset" "reset"
        fi
        
        # Remove game state files
        rm -f "$GAME_STATE_FILE"
        rm -rf "$GAME_DATA_DIR"
        
        # Reinitialize
        initialize_game_state
        
        log_event "SUCCESS" "Game state has been reset successfully" "reset"
        echo -e "${COLOR_SUCCESS}✅ Game state reset complete! You can start fresh.${COLOR_RESET}"
    else
        log_event "INFO" "Game state reset cancelled by user" "reset"
        echo -e "${COLOR_INFO}Reset cancelled. Your progress is safe.${COLOR_RESET}"
    fi
    echo ""
    echo -n "Press Enter to continue..."
    read -r
}

# ============================================================================
# MAIN MENU SYSTEM - PATH: USER INTERFACE
# ============================================================================

# Path: Interactive Menu with Enhanced Options
show_main_menu() {
    while true; do
        show_banner
        
        echo -e "${COLOR_PRIMARY}🎮 GAME MODES:${COLOR_RESET}"
        echo ""
        echo "  1) Interactive Terminal Emulator (Recommended for beginners)"
        echo "     • Safe, contained environment within the game"
        echo "     • Guided experience with built-in help"
        echo "     • Perfect for learning without fear of breaking anything"
        echo ""
        echo "  2) Native Terminal Experience (For experienced users)"
        echo "     • Uses your actual terminal environment"
        echo "     • Full access to your system commands"
        echo "     • Traditional bashcrawl experience"
        echo ""
        echo "  3) Tutorial & Help"
        echo "     • Learn about bashcrawl commands"
        echo "     • View game documentation"
        echo "     • Get started guide"
        echo ""
        echo "  4) Demo & Examples"
        echo "     • See the terminal emulator in action"
        echo "     • View example gameplay"
        echo "     • Understand game features"
        echo ""
        echo "  5) Game Status"
        echo "     • View current progress"
        echo "     • Check player statistics"
        echo "     • See session history"
        echo ""
        echo "  6) Reset Game State"
        echo "     • Start completely fresh"
        echo "     • Clear all progress"
        echo "     • Reinitialize game data"
        echo ""
        echo "  7) Exit"
        echo ""
        echo -n "Choose an option (1-7): "
        
        read -r choice
        echo ""
        
        case "$choice" in
            1)
                launch_interactive_mode
                ;;
            2)
                launch_native_mode
                return 0
                ;;
            3)
                launch_tutorial
                ;;
            4)
                launch_demo
                ;;
            5)
                show_game_status
                echo -n "Press Enter to continue..."
                read -r
                ;;
            6)
                reset_game_state
                ;;
            7)
                echo -e "${COLOR_SUCCESS}Goodbye, brave adventurer! May your terminal skills serve you well! ⚔️${COLOR_RESET}"
                log_event "INFO" "User exited launcher normally" "exit"
                exit 0
                ;;
            *)
                echo -e "${COLOR_ERROR}Invalid choice. Please select 1-7.${COLOR_RESET}"
                sleep 2
                ;;
        esac
    done
}

# ============================================================================
# COMMAND LINE ARGUMENT PROCESSING - PATH: CLI INTERFACE
# ============================================================================

# Path: Help Display with Comprehensive Information
show_help() {
    cat << EOF
${COLOR_BOLD}⚔️  BASHCRAWL - Terminal Adventure Game${COLOR_RESET}

${COLOR_PRIMARY}USAGE:${COLOR_RESET}
    $SCRIPT_NAME [OPTION]

${COLOR_PRIMARY}OPTIONS:${COLOR_RESET}
    -i, --interactive      Start interactive terminal emulator (safe mode)
    -n, --native          Start native terminal experience (advanced mode)
    -t, --tutorial        Launch tutorial and learning guide
    -d, --demo            Run demonstration mode
    -s, --status          Show current game status and progress
    -r, --reset           Reset game state (with confirmation)
    -h, --help            Show this help message
    -v, --version         Show version information
    --debug               Enable debug logging

${COLOR_PRIMARY}EXAMPLES:${COLOR_RESET}
    $SCRIPT_NAME                    # Launch interactive menu
    $SCRIPT_NAME --interactive      # Start safe terminal emulator
    $SCRIPT_NAME --native          # Start traditional experience
    $SCRIPT_NAME --tutorial        # Learn how to play
    $SCRIPT_NAME --status          # Check progress

${COLOR_PRIMARY}GAME MODES:${COLOR_RESET}
    ${COLOR_SUCCESS}Interactive Mode:${COLOR_RESET} Safe, contained environment perfect for beginners
    ${COLOR_WARNING}Native Mode:${COLOR_RESET}     Uses your actual terminal (requires experience)

${COLOR_PRIMARY}LEARNING PATH:${COLOR_RESET}
    Entrance → Cellar → Armoury → Chamber → Advanced Areas
    Each area teaches progressive terminal skills

${COLOR_PRIMARY}FILES:${COLOR_RESET}
    ./setup.sh           Run first-time setup and installation
    ./entrance/scroll    Your first adventure instructions
    ./help/              Comprehensive help system
    ~/.bashcrawl/        Game state and configuration

${COLOR_PRIMARY}DOCUMENTATION:${COLOR_RESET}
    README.md           Complete project documentation
    docs/               Additional guides and references
    GitHub: https://github.com/bamr87/bashcrawl

Version: $VERSION | Build: $BUILD_DATE
EOF
}

# Path: Version Information Display
show_version() {
    echo -e "${COLOR_BOLD}⚔️  Bashcrawl Terminal Adventure Game${COLOR_RESET}"
    echo -e "${COLOR_PRIMARY}Version:${COLOR_RESET} $VERSION"
    echo -e "${COLOR_PRIMARY}Build Date:${COLOR_RESET} $BUILD_DATE"
    echo -e "${COLOR_PRIMARY}Shell:${COLOR_RESET} $BASH_VERSION"
    echo -e "${COLOR_PRIMARY}Platform:${COLOR_RESET} $(uname -s) $(uname -m)"
    echo -e "${COLOR_PRIMARY}Install Path:${COLOR_RESET} $BASHCRAWL_ROOT"
    
    if [[ -f "$GAME_STATE_FILE" ]]; then
        source "$GAME_STATE_FILE"
        echo -e "${COLOR_PRIMARY}Game Status:${COLOR_RESET} Initialized (Level: $PLAYER_LEVEL)"
        echo -e "${COLOR_PRIMARY}Sessions:${COLOR_RESET} $SESSION_COUNT"
    else
        echo -e "${COLOR_PRIMARY}Game Status:${COLOR_RESET} Not initialized"
    fi
}

# Path: Argument Processing with Comprehensive Options
process_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -i|--interactive)
                export BASHCRAWL_AUTO_MODE="interactive"
                shift
                ;;
            -n|--native)
                export BASHCRAWL_AUTO_MODE="native"
                shift
                ;;
            -t|--tutorial)
                export BASHCRAWL_AUTO_MODE="tutorial"
                shift
                ;;
            -d|--demo)
                export BASHCRAWL_AUTO_MODE="demo"
                shift
                ;;
            -s|--status)
                export BASHCRAWL_AUTO_MODE="status"
                shift
                ;;
            -r|--reset)
                export BASHCRAWL_AUTO_MODE="reset"
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            -v|--version)
                show_version
                exit 0
                ;;
            --debug)
                export BASHCRAWL_DEBUG="true"
                shift
                ;;
            *)
                echo -e "${COLOR_ERROR}Unknown option: $1${COLOR_RESET}" >&2
                echo "Use '$SCRIPT_NAME --help' for usage information." >&2
                exit 1
                ;;
        esac
    done
}

# ============================================================================
# MAIN EXECUTION FLOW - PATH: APPLICATION ENTRY POINT
# ============================================================================

# Path: Application Initialization and Startup
main() {
    # Path: Startup Logging
    log_event "INFO" "Bashcrawl launcher started (v$VERSION)" "startup"
    
    # Path: Environment Validation
    if ! validate_environment; then
        log_event "ERROR" "Environment validation failed" "startup"
        echo -e "${COLOR_ERROR}❌ Environment validation failed!${COLOR_RESET}"
        echo -e "${COLOR_INFO}💡 Try running './setup.sh' to fix common issues${COLOR_RESET}"
        exit 1
    fi
    
    # Path: Game State Initialization
    initialize_game_state
    
    # Path: Argument Processing
    process_arguments "$@"
    
    # Path: Auto-mode Execution (from command line arguments)
    if [[ -n "${BASHCRAWL_AUTO_MODE:-}" ]]; then
        case "$BASHCRAWL_AUTO_MODE" in
            "interactive")
                launch_interactive_mode
                ;;
            "native")
                launch_native_mode
                ;;
            "tutorial")
                launch_tutorial
                exit 0
                ;;
            "demo")
                launch_demo
                exit 0
                ;;
            "status")
                show_game_status
                exit 0
                ;;
            "reset")
                reset_game_state
                exit 0
                ;;
        esac
    else
        # Path: Interactive Menu Mode (default)
        show_main_menu
    fi
}

# ============================================================================
# ERROR HANDLING AND CLEANUP - PATH: RELIABILITY SYSTEM
# ============================================================================

# Path: Signal Handling for Graceful Shutdown
cleanup_on_exit() {
    log_event "INFO" "Bashcrawl launcher shutting down gracefully" "shutdown"
    exit 0
}

# Path: Error Handler with Context
handle_error() {
    local exit_code=$?
    local line_number=${BASH_LINENO[0]}
    
    log_event "ERROR" "Script error at line $line_number (exit code: $exit_code)" "error"
    echo -e "${COLOR_ERROR}❌ An unexpected error occurred. Check logs for details.${COLOR_RESET}" >&2
    
    exit $exit_code
}

# Set up signal handlers
trap cleanup_on_exit EXIT
trap handle_error ERR

# ============================================================================
# SCRIPT ENTRY POINT - PATH: EXECUTION CONTROL
# ============================================================================

# Execute main function if script is run directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

# ============================================================================
# END OF MAIN.SH - BASHCRAWL TERMINAL ADVENTURE GAME
# ============================================================================
