#!/usr/bin/env bash
#
# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                             BASHCRAWL MAIN                                ║
# ║                                                                           ║
# ║                    Terminal Adventure Game Entry Point                    ║
# ╚═══════════════════════════════════════════════════════════════════════════╝
#
# @file main.sh
# @description Main entry point for the Bashcrawl terminal adventure game.
#              Includes the interactive terminal emulator (formerly
#              bashcrawl-terminal.sh), native mode launcher, tutorial,
#              demo, and game-state management.
# @author Bashcrawl Development Team <team@bashcrawl.org>
# @created 2025-08-05
# @lastModified 2025-08-06
# @version 3.0.0
# @license MIT
#
# @pathContext
#   - incomingPaths: [setup.sh, user terminal]
#   - outgoingPaths: [help system, game areas]
#   - parallelPaths: [src/help/*.sh, entrance/*, logs/*]
#
# @relatedFiles
#   - setup.sh: Installation and configuration
#   - src/help/: Comprehensive help system
#   - entrance/: Game starting point
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
#   ./main.sh -c "command"      # Execute a single command (non-interactive)
#   ./main.sh --batch           # Read commands from stdin, one per line
#

set -euo pipefail

# ============================================================================
# GLOBAL CONFIGURATION AND INITIALIZATION
# ============================================================================

SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"
readonly SCRIPT_NAME
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
readonly BASHCRAWL_ROOT="$SCRIPT_DIR"
readonly BUILD_DATE="2025-08-06"

# Source shared configuration (paths, version)
if [[ -f "${BASHCRAWL_ROOT}/lib/config.sh" ]]; then
    source "${BASHCRAWL_ROOT}/lib/config.sh"
fi
VERSION="${BASHCRAWL_VERSION:-3.0.0}"
readonly VERSION
HISTORY_FILE="${COMMAND_HISTORY_FILE:-${BASHCRAWL_ROOT}/.game_data/command_history}"

# Source shared color constants
if [[ -f "${BASHCRAWL_ROOT}/lib/colors.sh" ]]; then
    source "${BASHCRAWL_ROOT}/lib/colors.sh"
else
    readonly COLOR_PRIMARY=$'\033[0;36m'
    readonly COLOR_SECONDARY=$'\033[0;35m'
    readonly COLOR_SUCCESS=$'\033[0;32m'
    readonly COLOR_WARNING=$'\033[0;33m'
    readonly COLOR_ERROR=$'\033[0;31m'
    readonly COLOR_INFO=$'\033[0;34m'
    readonly COLOR_BOLD=$'\033[1m'
    readonly COLOR_RESET=$'\033[0m'
fi

# Terminal appearance aliases (used by emulator functions)
PROMPT_COLOR="${COLOR_PRIMARY}"
DIRECTORY_COLOR="${COLOR_SECONDARY}"
ERROR_COLOR="${COLOR_ERROR}"
SUCCESS_COLOR="${COLOR_SUCCESS}"
RESET_COLOR="${COLOR_RESET}"

export BASHCRAWL_MODE="main_launcher"
export BASHCRAWL_ROOT
export BASHCRAWL_VERSION="$VERSION"

# Source unified state management (sets I, HP, GAME_LEVEL, CURRENT_AREA)
if [[ -f "${BASHCRAWL_ROOT}/lib/state.sh" ]]; then
    source "${BASHCRAWL_ROOT}/lib/state.sh"
fi

# Source room/encounter/item registry loader (must come before quests.sh)
if [[ -f "${BASHCRAWL_ROOT}/lib/room_loader.sh" ]]; then
    source "${BASHCRAWL_ROOT}/lib/room_loader.sh"
    load_registries || true
fi

# Source quest system (quest data, helpers, persistence)
if [[ -f "${BASHCRAWL_ROOT}/lib/quests.sh" ]]; then
    source "${BASHCRAWL_ROOT}/lib/quests.sh"
fi

# Source UI functions (banners, prompts, help screens)
if [[ -f "${BASHCRAWL_ROOT}/lib/ui.sh" ]]; then
    source "${BASHCRAWL_ROOT}/lib/ui.sh"
fi

# Source terminal emulator (command dispatch, safe wrappers)
if [[ -f "${BASHCRAWL_ROOT}/lib/emulator.sh" ]]; then
    source "${BASHCRAWL_ROOT}/lib/emulator.sh"
fi

# Provide sensible defaults if state.sh was not loaded
export I="${I:-}"
export HP="${HP:-100}"
export GAME_LEVEL="${GAME_LEVEL:-novice}"
export CURRENT_AREA="${CURRENT_AREA:-entrance}"

RESTRICTED_MODE=true

# Determine the appropriate color flag for ls in a portable way
declare -a LS_COLOR_FLAGS=()
if command ls --color=auto /dev/null >/dev/null 2>&1; then
    LS_COLOR_FLAGS=(--color=auto)
elif command ls -G /dev/null >/dev/null 2>&1; then
    LS_COLOR_FLAGS=(-G)
fi

# Initialize Session Logging
if [[ -f "${BASHCRAWL_ROOT}/lib/log.sh" ]]; then
    source "${BASHCRAWL_ROOT}/lib/log.sh"
    bc_session_start "launcher"
fi

# ============================================================================
# CORE UTILITY FUNCTIONS
# ============================================================================

log_event() {
    local level="$1"
    local message="$2"
    local context="${3:-main}"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    mkdir -p "$LOG_DIR"

    echo "[$timestamp] [$level] [$context] $message" >> "${LOG_DIR}/bashcrawl.log"

    if declare -f bc_log &>/dev/null; then
        local level_lower
        level_lower=$(printf '%s' "$level" | tr '[:upper:]' '[:lower:]')
        bc_log "launcher_${level_lower}" "context=${context}" "message=${message}"
    fi

    case "$level" in
        "INFO")  echo -e "${COLOR_INFO}ℹ️  $message${COLOR_RESET}" ;;
        "SUCCESS") echo -e "${COLOR_SUCCESS}✅ $message${COLOR_RESET}" ;;
        "WARNING") echo -e "${COLOR_WARNING}⚠️  $message${COLOR_RESET}" ;;
        "ERROR") echo -e "${COLOR_ERROR}❌ $message${COLOR_RESET}" ;;
        "DEBUG") [[ "${BASHCRAWL_DEBUG:-}" == "true" ]] && echo -e "${COLOR_INFO}🔍 $message${COLOR_RESET}" ;;
    esac
}

validate_environment() {
    log_event "INFO" "Validating Bashcrawl environment..." "validation"

    local required_dirs=("entrance" "src/help")
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "${BASHCRAWL_ROOT}/$dir" ]]; then
            log_event "ERROR" "Required directory missing: $dir" "validation"
            log_event "INFO" "Run './setup.sh' to initialize the game environment" "validation"
            return 1
        fi
    done

    local required_files=("src/help/bashcrawl_help.sh")
    for file in "${required_files[@]}"; do
        if [[ ! -f "${BASHCRAWL_ROOT}/$file" ]]; then
            log_event "ERROR" "Required file missing: $file" "validation"
            return 1
        fi
    done

    mkdir -p "$GAME_DATA_DIR" "$LOG_DIR"
    log_event "SUCCESS" "Environment validation completed" "validation"
    return 0
}

relative_path() {
    local abs="${1%/}"
    local root="${BASHCRAWL_ROOT%/}"
    if [[ -z "$abs" ]]; then
        echo "bashcrawl"
        return
    fi
    if [[ "$abs" == "$root" ]]; then
        echo "bashcrawl"
        return
    fi
    case "$abs" in
        "$root"/*)
            echo "${abs#"${root}"/}"
            ;;
        *)
            echo "$abs"
            ;;
    esac
}

# ============================================================================
# GAME MODE IMPLEMENTATIONS
# ============================================================================

_check_tui_available() {
    command -v python3 >/dev/null 2>&1 || return 1
    python3 -c "import textual" >/dev/null 2>&1 || return 1
    local ti_dir="${BASHCRAWL_ROOT}/src/terminal-illness"
    [[ -d "$ti_dir" ]] || return 1
    return 0
}

launch_tui_mode() {
    log_event "INFO" "Starting Textual TUI..." "tui"

    if ! _check_tui_available; then
        echo -e "${COLOR_WARNING}⚠️  Textual TUI unavailable (Python 3 + textual package required).${COLOR_RESET}"
        echo ""
        echo -e "${COLOR_INFO}To install:  pip3 install textual${COLOR_RESET}"
        echo -e "${COLOR_INFO}Or:          pip3 install --break-system-packages textual${COLOR_RESET}"
        echo ""
        echo -e "${COLOR_INFO}Falling back to classic interactive mode...${COLOR_RESET}"
        echo ""
        sleep 2
        launch_classic_mode
        return
    fi

    export BASHCRAWL_MODE="textual_tui"

    local sc
    sc="$(state_get session_count)"
    state_set session_count "$((sc + 1))"
    state_set game_started "true"
    state_save

    local ti_dir="${BASHCRAWL_ROOT}/src/terminal-illness"
    log_event "INFO" "Launching Textual TUI from $ti_dir" "tui"

    PYTHONPATH="$ti_dir" python3 -m ti --game-root "$BASHCRAWL_ROOT"

    log_event "INFO" "Textual TUI session ended" "tui"
}

launch_web_mode() {
    log_event "INFO" "Starting Web Browser TUI..." "web"

    if ! _check_tui_available; then
        echo -e "${COLOR_WARNING}⚠️  Web mode unavailable (Python 3 + textual package required).${COLOR_RESET}"
        echo -e "${COLOR_INFO}To install:  pip3 install textual textual-serve${COLOR_RESET}"
        echo ""
        sleep 2
        return
    fi

    if ! python3 -c "import textual_serve" >/dev/null 2>&1; then
        echo -e "${COLOR_WARNING}⚠️  textual-serve package not installed.${COLOR_RESET}"
        echo -e "${COLOR_INFO}To install:  pip3 install textual-serve${COLOR_RESET}"
        echo ""
        sleep 2
        return
    fi

    local ti_dir="${BASHCRAWL_ROOT}/src/terminal-illness"
    log_event "INFO" "Launching Web TUI server from $ti_dir" "web"

    echo -e "${COLOR_SUCCESS}🌐 Starting Bashcrawl web server...${COLOR_RESET}"
    echo -e "${COLOR_INFO}Open your browser to http://localhost:8080${COLOR_RESET}"
    echo -e "${COLOR_DIM}Press Ctrl+C to stop the server.${COLOR_RESET}"
    echo ""

    PYTHONPATH="$ti_dir" python3 -m ti --web --automation --game-root "$BASHCRAWL_ROOT"

    log_event "INFO" "Web TUI server stopped" "web"
}

launch_ai_stdio_mode() {
    log_event "INFO" "Starting AI JSON stdio mode..." "ai_stdio"

    if ! command -v python3 >/dev/null 2>&1; then
        echo -e "${COLOR_ERROR}python3 is required for --ai-stdio.${COLOR_RESET}" >&2
        return 1
    fi

    local ti_dir="${BASHCRAWL_ROOT}/src/terminal-illness"
    log_event "INFO" "Launching JSON stdio bridge from $ti_dir" "ai_stdio"

    PYTHONPATH="$ti_dir" python3 -m ti --ai-stdio --game-root "$BASHCRAWL_ROOT"

    log_event "INFO" "AI stdio session ended" "ai_stdio"
}

launch_interactive_mode() {
    launch_tui_mode
}

launch_classic_mode() {
    log_event "INFO" "Starting Classic Terminal Emulator..." "interactive"

    echo -e "${COLOR_PRIMARY}🎮 CLASSIC TERMINAL EMULATOR${COLOR_RESET}"
    echo "─────────────────────────────────────────────────────────────────────"
    echo -e "${COLOR_SUCCESS}✅ Safe, contained environment${COLOR_RESET}"
    echo -e "${COLOR_SUCCESS}✅ Built-in help and tutorials${COLOR_RESET}"
    echo -e "${COLOR_SUCCESS}✅ Perfect for learning without fear${COLOR_RESET}"
    echo -e "${COLOR_SUCCESS}✅ All real terminal commands work within game bounds${COLOR_RESET}"
    echo ""
    echo -e "${COLOR_INFO}Launching classic terminal emulator...${COLOR_RESET}"
    echo ""

    export BASHCRAWL_MODE="terminal_emulator"

    local sc
    sc="$(state_get session_count)"
    state_set session_count "$((sc + 1))"
    state_set game_started "true"
    state_save

    cd "$BASHCRAWL_ROOT"
    load_game_state
    restore_saved_location
    show_welcome_banner
    touch "$HISTORY_FILE"

    while true; do
        echo -n "$(generate_prompt)"
        read -r -e input

        if [[ -z "$input" ]]; then
            continue
        fi

        _dispatch_input "$input" || true
        echo
    done
}

launch_agent_mode() {
    local screenshot_dir="${1:-./logs/screenshots}"
    log_event "INFO" "Starting Agent mode (Textual TUI)..." "agent"

    if _check_tui_available; then
        local ti_dir="${BASHCRAWL_ROOT}/src/terminal-illness"
        export BASHCRAWL_MODE="agent_textual"

        PYTHONPATH="$ti_dir" python3 -m ti.agent \
            --game-root "$BASHCRAWL_ROOT" \
            --screenshot-dir "$screenshot_dir"
        return $?
    else
        echo -e "${COLOR_WARNING}⚠️  Textual unavailable, falling back to bash agent REPL.${COLOR_RESET}" >&2
        echo "Install with: pip3 install textual" >&2
        launch_agent_bash_mode
        return $?
    fi
}

launch_agent_bash_mode() {
    log_event "INFO" "Starting Bash Agent REPL mode..." "agent"

    export BASHCRAWL_MODE="agent_repl"

    cd "$BASHCRAWL_ROOT"
    touch "$HISTORY_FILE"
    load_game_state
    restore_saved_location

    echo "BASHCRAWL AGENT REPL v${VERSION}"
    echo "Location: $(pwd)"
    echo "Inventory: ${I:-<empty>}"
    echo "HP: ${HP:-100}"
    echo "Send commands one per line. Type 'exit' to quit."
    echo "READY>"

    while IFS= read -r input || [[ -n "$input" ]]; do
        [[ -z "$input" ]] && { echo "READY>"; continue; }

        if [[ "$input" == "exit" || "$input" == "quit" || "$input" == "q" ]]; then
            save_game_state
            echo "SESSION ENDED"
            echo "READY>"
            break
        fi

        echo "CMD> $input"
        _dispatch_input "$input" || true
        echo ""
        echo "READY>"
    done
}

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
    echo "   source ${BASHCRAWL_ROOT}/src/help/init_help.sh"
    echo ""
    echo -e "${COLOR_PRIMARY}4. Enable session logging (optional):${COLOR_RESET}"
    echo "   source ${BASHCRAWL_ROOT}/lib/log.sh && bc_session_start native && bc_install_hooks"
    echo ""
    echo -e "${COLOR_INFO}💡 Type 'help' anytime for context-aware assistance${COLOR_RESET}"
    echo -e "${COLOR_INFO}💡 Type 'map' to see available areas${COLOR_RESET}"
    echo ""

    if type -t state_set &>/dev/null; then
        state_set game_started "true"
        state_save
    fi
}

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

    echo -n "Press Enter to return to main menu..."
    read -r
}

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

reset_game_state() {
    log_event "INFO" "Game state reset requested..." "reset"

    echo -e "${COLOR_WARNING}🔄 RESET GAME STATE${COLOR_RESET}"
    echo "─────────────────────────────────────────────────────────────────────"
    echo ""
    echo -e "${COLOR_WARNING}⚠️  This will permanently delete your current game progress:${COLOR_RESET}"
    echo "   • Player inventory and health"
    echo "   • Quest progress and XP"
    echo "   • Session history and statistics"
    echo "   • Unlocked hidden rooms (re-hidden)"
    echo "   • Combat artifacts (corpses, statue pieces)"
    echo ""
    echo -n "Are you sure you want to reset? [y/N]: "
    read -r confirmation

    if [[ "$confirmation" =~ ^[Yy]$ ]]; then
        if [[ -f "${BASHCRAWL_ROOT}/lib/reset.sh" ]]; then
            bash "${BASHCRAWL_ROOT}/lib/reset.sh"
            log_event "SUCCESS" "Game state has been reset via lib/reset.sh" "reset"
        else
            log_event "WARNING" "lib/reset.sh not found, performing basic reset" "reset"
            state_reset
        fi

        initialize_game_state

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
# LAUNCHER DISPLAY
# ============================================================================

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

show_launcher_status() {
    echo -e "${COLOR_PRIMARY}📊 ADVENTURE STATUS${COLOR_RESET}"
    echo "─────────────────────────────────────────────────────────────────────"

    if type -t state_get &>/dev/null; then
        local area level hp inv sessions last_sess started
        area="$(state_get current_location)"
        level="$(state_get game_level)"
        hp="$(state_get hp)"
        inv="$(state_get inventory)"
        sessions="$(state_get session_count)"
        last_sess="$(state_get last_session)"
        started="$(state_get game_started)"

        if [[ "$started" == "true" || "${sessions:-0}" -gt 0 ]]; then
            echo -e "${COLOR_SUCCESS}🏠 Current Area:${COLOR_RESET} ${area:-entrance}"
            echo -e "${COLOR_SUCCESS}🎯 Player Level:${COLOR_RESET} ${level:-novice}"
            echo -e "${COLOR_SUCCESS}❤️  Health:${COLOR_RESET} ${hp:-100}"
            echo -e "${COLOR_SUCCESS}🎒 Inventory:${COLOR_RESET} ${inv:-"Empty"}"
            echo -e "${COLOR_SUCCESS}📅 Last Session:${COLOR_RESET} ${last_sess:-"Never"}"
            echo -e "${COLOR_SUCCESS}🔢 Session Count:${COLOR_RESET} ${sessions:-0}"
        else
            echo -e "${COLOR_WARNING}No game state found. Start a new adventure!${COLOR_RESET}"
        fi
    else
        echo -e "${COLOR_WARNING}No game state found. Start a new adventure!${COLOR_RESET}"
    fi
    echo ""
}

# ============================================================================
# MAIN MENU
# ============================================================================

show_main_menu() {
    while true; do
        show_banner

        echo -e "${COLOR_PRIMARY}🎮 CHOOSE YOUR PATH:${COLOR_RESET}"
        echo ""
        echo -e "  ${COLOR_SUCCESS}1)${COLOR_RESET} ${COLOR_BOLD}Interactive TUI${COLOR_RESET}  ${COLOR_DIM}(recommended — Textual visual interface)${COLOR_RESET}"
        echo "     Beautiful panel layout, quest tracker, tab completion, command history"
        echo ""
        echo -e "  ${COLOR_INFO}2)${COLOR_RESET} ${COLOR_BOLD}Classic Interactive${COLOR_RESET}  ${COLOR_DIM}(bash emulator — no Python required)${COLOR_RESET}"
        echo "     Safe sandbox with built-in help — plain terminal experience"
        echo ""
        echo -e "  ${COLOR_WARNING}3)${COLOR_RESET} ${COLOR_BOLD}Native Terminal${COLOR_RESET}"
        echo "     Use your real shell — for experienced adventurers"
        echo ""
        echo -e "  ${COLOR_INFO}4)${COLOR_RESET} Tutorial          Learn the basics step by step"
        echo -e "  ${COLOR_INFO}5)${COLOR_RESET} Demo              See example gameplay"
        echo -e "  ${COLOR_INFO}6)${COLOR_RESET} Game Status       View progress and statistics"
        echo -e "  ${COLOR_INFO}7)${COLOR_RESET} Reset             Start fresh"
        echo ""
        echo -e "  ${COLOR_SUCCESS}9)${COLOR_RESET} ${COLOR_BOLD}Web Browser Mode${COLOR_RESET}  ${COLOR_DIM}(play in your browser via textual-serve)${COLOR_RESET}"
        echo "     Opens the TUI in any web browser at http://localhost:8080"
        echo ""
        echo -e "  ${COLOR_DIM}8)${COLOR_RESET} Exit"
        echo ""
        echo -n "Choose an option (1-9): "

        read -r choice
        echo ""

        case "$choice" in
            1)
                launch_tui_mode
                ;;
            2)
                launch_classic_mode
                ;;
            3)
                launch_native_mode
                return 0
                ;;
            4)
                launch_tutorial
                ;;
            5)
                launch_demo
                ;;
            6)
                show_launcher_status
                echo -n "Press Enter to continue..."
                read -r
                ;;
            7)
                reset_game_state
                ;;
            8)
                echo -e "${COLOR_SUCCESS}Goodbye, brave adventurer! May your terminal skills serve you well!${COLOR_RESET}"
                log_event "INFO" "User exited launcher normally" "exit"
                exit 0
                ;;
            9)
                launch_web_mode
                ;;
            *)
                echo -e "${COLOR_ERROR}Invalid choice. Please select 1-9.${COLOR_RESET}"
                sleep 2
                ;;
        esac
    done
}

# ============================================================================
# CLI ARGUMENT PROCESSING
# ============================================================================

show_help() {
    cat << EOF
${COLOR_BOLD}⚔️  BASHCRAWL - Terminal Adventure Game${COLOR_RESET}

${COLOR_PRIMARY}USAGE:${COLOR_RESET}
    $SCRIPT_NAME [OPTION]

${COLOR_PRIMARY}OPTIONS:${COLOR_RESET}
    -i, --interactive      Start Textual TUI (recommended, requires Python 3 + textual)
        --tui              Alias for --interactive
        --classic          Start classic bash terminal emulator (no Python required)
        --interactive-classic  Alias for --classic
    -n, --native          Start native terminal experience (advanced mode)
    -t, --tutorial        Launch tutorial and learning guide
    -d, --demo            Run demonstration mode
    -s, --status          Show current game status and progress
    -r, --reset           Reset game state (with confirmation)
    -c, --command "CMD"   Execute a single emulator command, then exit
        --batch           Read commands from stdin (one per line)
        --agent           Agent mode: Textual TUI with screenshots (recommended)
        --agent-bash      Agent mode: bash-only REPL (no screenshots, no Python)
        --screenshot-dir PATH  Screenshot output directory (default: ./logs/screenshots)
    -w, --web             Start browser TUI (serves at http://localhost:8080)
        --ai-stdio        JSON line protocol on stdin/stdout for AI tools (no Textual UI)
    -h, --help            Show this help message
    -v, --version         Show version information
    --debug               Enable debug logging

${COLOR_PRIMARY}EXAMPLES:${COLOR_RESET}
    $SCRIPT_NAME                        # Launch interactive menu
    $SCRIPT_NAME --interactive          # Start Textual TUI (recommended)
    $SCRIPT_NAME --tui                  # Same as --interactive
    $SCRIPT_NAME --classic              # Start classic bash emulator
    $SCRIPT_NAME --native              # Start traditional experience
    $SCRIPT_NAME --tutorial            # Learn how to play
    $SCRIPT_NAME --status              # Check progress
    $SCRIPT_NAME -c "cd entrance"      # Run one command
    $SCRIPT_NAME -c "cat scroll"       # Run another (state persists)
    echo -e "pwd\nls" | $SCRIPT_NAME --batch  # Batch mode
    $SCRIPT_NAME --web                         # Play in browser at http://localhost:8080
    $SCRIPT_NAME --ai-stdio                  # Drive game via JSON lines (Cursor / automation)
    $SCRIPT_NAME --agent                       # Agent mode with Textual + screenshots
    $SCRIPT_NAME --agent-bash                  # Bash-only agent REPL (no Python)

${COLOR_PRIMARY}GAME MODES:${COLOR_RESET}
    ${COLOR_SUCCESS}Textual TUI:${COLOR_RESET}      Visual panels, quest tracker, tab completion (Python 3 + textual)
    ${COLOR_INFO}Classic Mode:${COLOR_RESET}    Safe bash emulator — no Python required
    ${COLOR_WARNING}Native Mode:${COLOR_RESET}     Uses your actual terminal (requires experience)
    ${COLOR_SUCCESS}Web Browser:${COLOR_RESET}     Play in your browser via textual-serve (Python 3 + textual-serve)
    ${COLOR_INFO}Agent Mode:${COLOR_RESET}      Headless Textual TUI with screenshots for AI agents
    ${COLOR_INFO}AI stdio:${COLOR_RESET}        JSON lines on stdin/stdout (see docs/cursor-ai.md)
    ${COLOR_INFO}Agent Bash:${COLOR_RESET}      Line-buffered bash REPL for agents (no Python needed)

${COLOR_PRIMARY}LEARNING PATH:${COLOR_RESET}
    Entrance → Cellar → Armoury → Chamber → Advanced Areas
    Each area teaches progressive terminal skills

${COLOR_PRIMARY}FILES:${COLOR_RESET}
    ./setup.sh           Run first-time setup and installation
    ./entrance/scroll    Your first adventure instructions
    ./src/help/          Comprehensive help system

${COLOR_PRIMARY}DOCUMENTATION:${COLOR_RESET}
    README.md           Complete project documentation
    docs/               Additional guides and references
    GitHub: https://github.com/bamr87/bashcrawl

Version: $VERSION | Build: $BUILD_DATE
EOF
}

show_version() {
    echo -e "${COLOR_BOLD}⚔️  Bashcrawl Terminal Adventure Game${COLOR_RESET}"
    echo -e "${COLOR_PRIMARY}Version:${COLOR_RESET} $VERSION"
    echo -e "${COLOR_PRIMARY}Build Date:${COLOR_RESET} $BUILD_DATE"
    echo -e "${COLOR_PRIMARY}Shell:${COLOR_RESET} $BASH_VERSION"
    echo -e "${COLOR_PRIMARY}Platform:${COLOR_RESET} $(uname -s) $(uname -m)"
    echo -e "${COLOR_PRIMARY}Install Path:${COLOR_RESET} $BASHCRAWL_ROOT"

    if type -t state_get &>/dev/null; then
        local level sessions
        level="$(state_get game_level)"
        sessions="$(state_get session_count)"
        if [[ -n "$level" ]]; then
            echo -e "${COLOR_PRIMARY}Game Status:${COLOR_RESET} Initialized (Level: $level)"
            echo -e "${COLOR_PRIMARY}Sessions:${COLOR_RESET} ${sessions:-0}"
        else
            echo -e "${COLOR_PRIMARY}Game Status:${COLOR_RESET} Not initialized"
        fi
    else
        echo -e "${COLOR_PRIMARY}Game Status:${COLOR_RESET} Not initialized"
    fi
}

process_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -i|--interactive|--tui)
                export BASHCRAWL_AUTO_MODE="tui"
                shift
                ;;
            --classic|--interactive-classic)
                export BASHCRAWL_AUTO_MODE="classic"
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
            -c|--command)
                shift
                export BASHCRAWL_AUTO_MODE="single_command"
                export BASHCRAWL_SINGLE_CMD="$1"
                shift
                ;;
            --batch)
                export BASHCRAWL_AUTO_MODE="batch"
                shift
                ;;
            -w|--web)
                export BASHCRAWL_AUTO_MODE="web"
                shift
                ;;
            --ai-stdio)
                export BASHCRAWL_AUTO_MODE="ai_stdio"
                shift
                ;;
            --agent)
                export BASHCRAWL_AUTO_MODE="agent"
                shift
                ;;
            --agent-bash)
                export BASHCRAWL_AUTO_MODE="agent_bash"
                shift
                ;;
            --screenshot-dir)
                shift
                export BASHCRAWL_SCREENSHOT_DIR="$1"
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
# MAIN EXECUTION FLOW
# ============================================================================

main() {
    log_event "INFO" "Bashcrawl launcher started (v$VERSION)" "startup"

    if ! validate_environment; then
        log_event "ERROR" "Environment validation failed" "startup"
        echo -e "${COLOR_ERROR}❌ Environment validation failed!${COLOR_RESET}"
        echo -e "${COLOR_INFO}💡 Try running './setup.sh' to fix common issues${COLOR_RESET}"
        exit 1
    fi

    initialize_game_state
    process_arguments "$@"

    if [[ -n "${BASHCRAWL_AUTO_MODE:-}" ]]; then
        case "$BASHCRAWL_AUTO_MODE" in
            "tui")           launch_tui_mode ;;
            "interactive")   launch_tui_mode ;;
            "classic")       launch_classic_mode ;;
            "native")        launch_native_mode ;;
            "tutorial")      launch_tutorial; exit 0 ;;
            "demo")          launch_demo; exit 0 ;;
            "status")        show_launcher_status; exit 0 ;;
            "reset")         reset_game_state; exit 0 ;;
            "single_command") run_single_command "$BASHCRAWL_SINGLE_CMD"; exit $? ;;
            "batch")         run_batch; exit $? ;;
            "web")           launch_web_mode; exit $? ;;
            "ai_stdio")      launch_ai_stdio_mode; exit $? ;;
            "agent")         launch_agent_mode "${BASHCRAWL_SCREENSHOT_DIR:-./logs/screenshots}"; exit $? ;;
            "agent_bash")    launch_agent_bash_mode; exit $? ;;
        esac
    else
        if [[ ! -t 0 ]]; then
            run_batch
            exit $?
        fi
        show_main_menu
    fi
}

# ============================================================================
# ERROR HANDLING AND CLEANUP
# ============================================================================

cleanup_on_exit() {
    log_event "INFO" "Bashcrawl launcher shutting down gracefully" "shutdown"
    exit 0
}

handle_error() {
    local exit_code=$?
    local line_number=${BASH_LINENO[0]}
    log_event "ERROR" "Script error at line $line_number (exit code: $exit_code)" "error"
    echo -e "${COLOR_ERROR}❌ An unexpected error occurred. Check logs for details.${COLOR_RESET}" >&2
    exit $exit_code
}

trap cleanup_on_exit EXIT
trap handle_error ERR

# ============================================================================
# SCRIPT ENTRY POINT
# ============================================================================

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
