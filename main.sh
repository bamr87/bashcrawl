#!/usr/bin/env bash
#
# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                          ⚔️  BASHCRAWL MAIN ⚔️                           ║
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

readonly SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly BASHCRAWL_ROOT="$SCRIPT_DIR"
readonly VERSION="3.0.0"
readonly BUILD_DATE="2025-08-06"

readonly GAME_STATE_FILE="${BASHCRAWL_ROOT}/.game_state"
readonly GAME_HISTORY_FILE="${BASHCRAWL_ROOT}/.game_history"
HISTORY_FILE="$GAME_HISTORY_FILE"
readonly GAME_DATA_DIR="${BASHCRAWL_ROOT}/.game_data"
readonly LOG_DIR="${BASHCRAWL_ROOT}/logs"

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

export I=""          # Inventory
export HP=100        # Health Points
export GAME_LEVEL="novice"
export CURRENT_AREA="pre-entrance"

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
# QUEST PROGRESSION DATA
# ============================================================================

declare -a QUEST_REQUIRED_COMMAND
declare -a QUEST_HINTS
declare -a QUEST_TARGET_CONTEXT
declare -a QUEST_REWARDS
declare -a QUEST_REWARD_XP

QUEST_TITLES=(
    "Awakening: Know Thy Place"
    "Eyes to See"
    "First Steps"
    "Shape the World"
    "Spark of Creation"
    "Read the Signs"
    "Seek the Whisper"
)

QUEST_OBJECTIVES=(
    "Cast the 'pwd' spell to learn where you stand."
    "Use 'ls' to reveal what surrounds you."
    "Travel to the entrance with 'cd entrance'."
    "Create a new space by running 'mkdir workshop' while in the entrance."
    "Enter the workshop and conjure 'notes.txt' with 'touch notes.txt'."
    "Read your freshly created notes with 'cat notes.txt'."
    "Within the entrance, seek the word 'catacombs' in the scroll using 'grep'."
)

QUEST_REQUIRED_COMMAND=(pwd ls cd mkdir touch cat grep)

QUEST_HINTS=(
    "Type 'pwd' and press Enter to see your current chamber."
    "Try 'ls' to survey the room's contents."
    "Use 'cd entrance' to step into the dungeon proper."
    "While standing in the entrance, run 'mkdir workshop' to shape a new workspace."
    "Move into the workshop with 'cd workshop' and create notes via 'touch notes.txt'."
    "Inside the workshop, read what you've made: 'cat notes.txt'."
    "Back in the entrance, run 'grep catacombs scroll' to uncover the hidden clue."
)

QUEST_TARGET_CONTEXT=(
    "bashcrawl"
    "bashcrawl"
    "entrance"
    "entrance"
    "entrance/workshop"
    "entrance/workshop"
    "entrance"
)

QUEST_REWARDS=(
    "Navigation Novice ribbon"
    "Glimmering lens"
    "Pathwalker's charm"
    "Builder's sigil"
    "Scribe's quill"
    "Reader's sigil"
    "Whisperer's token"
)

QUEST_REWARD_XP=(50 50 100 100 100 100 150)

readonly QUEST_TOTAL=${#QUEST_TITLES[@]}

CURRENT_QUEST_ID=0
QUEST_COMPLETED=""
LEARNED_COMMANDS=""
GAME_XP=0
SCROLLS_READ=""
LAST_COMMAND=""
LAST_ARGS=""
LAST_COMMAND_DIR=""
LAST_RESULT_DIR=""
LAST_COMMAND_EXIT_CODE=0
CURRENT_PATH="bashcrawl"

# ============================================================================
# QUEST AND STATE HELPERS

# ============================================================================
# CORE UTILITY FUNCTIONS
# ============================================================================

# Path: Logging System — Delegates to lib/log.sh (bc_log) with legacy file fallback
log_event() {
    local level="$1"
    local message="$2"
    local context="${3:-main}"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Ensure log directory exists
    mkdir -p "$LOG_DIR"
    
    # Log to legacy file for backward compatibility
    echo "[$timestamp] [$level] [$context] $message" >> "${LOG_DIR}/bashcrawl.log"
    
    # Also log to structured JSONL via bc_log if available
    if declare -f bc_log &>/dev/null; then
        local level_lower
        level_lower=$(printf '%s' "$level" | tr '[:upper:]' '[:lower:]')
        bc_log "launcher_${level_lower}" "context=${context}" "message=${message}"
    fi
    
    # Display to user with appropriate colors
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
        rm -f "${GAME_STATE_FILE}.bak"
    fi
    
    # Source the game state with error handling
    if [[ -f "$GAME_STATE_FILE" ]]; then
        # Temporarily disable strict mode for sourcing
        set +u
        source "$GAME_STATE_FILE"
        set -u
    fi
}


# ============================================================================
# QUEST AND STATE HELPERS
# ============================================================================

# ============================================================================

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
            echo "${abs#${root}/}"
            ;;
        *)
            echo "$abs"
            ;;
    esac
}

csv_contains() {
    local list="$1"
    local item="$2"
    [[ ",$list," == *",$item,"* ]]
}

csv_add() {
    local list="$1"
    local item="$2"
    if [[ -z "$item" ]]; then
        echo "$list"
        return
    fi
    if csv_contains "$list" "$item"; then
        echo "$list"
    elif [[ -z "$list" ]]; then
        echo "$item"
    else
        echo "$list,$item"
    fi
}

register_command_use() {
    local cmd="$1"
    LEARNED_COMMANDS="$(csv_add "$LEARNED_COMMANDS" "$cmd")"
}

render_quest_status() {
    local qid=${CURRENT_QUEST_ID:-0}
    echo -e "${SUCCESS_COLOR}🎯 QUEST TRACKER:${RESET_COLOR}"
    if (( qid >= QUEST_TOTAL )); then
        echo "   All quests complete! Explore freely."
        return
    fi
    echo "   Quest $((qid + 1))/${QUEST_TOTAL}: ${QUEST_TITLES[$qid]}"
    echo "   Objective: ${QUEST_OBJECTIVES[$qid]}"
    echo "   Reward: ${QUEST_REWARDS[$qid]} (+${QUEST_REWARD_XP[$qid]} XP)"
}

complete_current_quest() {
    local qid="$1"
    QUEST_COMPLETED="$(csv_add "$QUEST_COMPLETED" "$qid")"
    GAME_XP=$((GAME_XP + QUEST_REWARD_XP[$qid]))
    echo -e "${SUCCESS_COLOR}✨ Quest complete: ${QUEST_TITLES[$qid]}!${RESET_COLOR}"
    echo "   Reward: ${QUEST_REWARDS[$qid]} (+${QUEST_REWARD_XP[$qid]} XP)"
    CURRENT_QUEST_ID=$((qid + 1))
    save_game_state
    if (( CURRENT_QUEST_ID >= QUEST_TOTAL )); then
        echo -e "${SUCCESS_COLOR}🏆 All quests complete! Continue exploring the catacombs.${RESET_COLOR}"
    else
        render_quest_status
    fi
}

check_quest_progress() {
    local qid=${CURRENT_QUEST_ID:-0}
    (( qid < QUEST_TOTAL )) || return

    local required="${QUEST_REQUIRED_COMMAND[$qid]}"
    if [[ -n "$required" ]] && ! csv_contains "$LEARNED_COMMANDS" "$required"; then
        return
    fi

    case "$qid" in
        0)
            [[ "$LAST_COMMAND" == "pwd" ]] || return
            ;;
        1)
            [[ "$LAST_COMMAND" == "ls" ]] || return
            ;;
        2)
            [[ "$LAST_COMMAND" == "cd" ]] || return
            if [[ "$(relative_path "$LAST_RESULT_DIR")" != "${QUEST_TARGET_CONTEXT[$qid]}" ]]; then
                return
            fi
            ;;
        3)
            [[ "$LAST_COMMAND" == "mkdir" ]] || return
            if [[ "$(relative_path "$LAST_COMMAND_DIR")" != "${QUEST_TARGET_CONTEXT[$qid]}" ]]; then
                return
            fi
            local -a __last_args
            read -ra __last_args <<< "$LAST_ARGS"
            if [[ "${__last_args[0]:-}" != "workshop" ]]; then
                return
            fi
            ;;
        4)
            [[ "$LAST_COMMAND" == "touch" ]] || return
            if [[ "$(relative_path "$LAST_COMMAND_DIR")" != "${QUEST_TARGET_CONTEXT[$qid]}" ]]; then
                return
            fi
            local -a __last_args
            read -ra __last_args <<< "$LAST_ARGS"
            if [[ "${__last_args[0]:-}" != "notes.txt" ]]; then
                return
            fi
            ;;
        5)
            [[ "$LAST_COMMAND" == "cat" ]] || return
            if [[ "$(relative_path "$LAST_COMMAND_DIR")" != "${QUEST_TARGET_CONTEXT[$qid]}" ]]; then
                return
            fi
            local -a __last_args
            read -ra __last_args <<< "$LAST_ARGS"
            if [[ "${__last_args[0]:-}" != "notes.txt" ]]; then
                return
            fi
            ;;
        6)
            [[ "$LAST_COMMAND" == "grep" ]] || return
            (( LAST_COMMAND_EXIT_CODE == 0 )) || return
            if [[ "$(relative_path "$LAST_COMMAND_DIR")" != "${QUEST_TARGET_CONTEXT[$qid]}" ]]; then
                return
            fi
            local -a __last_args
            read -ra __last_args <<< "$LAST_ARGS"
            if [[ "${__last_args[0]:-}" != "catacombs" ]]; then
                return
            fi
            local target="${__last_args[1]:-}"
            case "$target" in
                "scroll"|"./scroll"|"entrance/scroll") ;;
                *) return ;;
            esac
            ;;
    esac

    complete_current_quest "$qid"
}

merlin_hint() {
    local qid=${CURRENT_QUEST_ID:-0}
    if (( qid >= QUEST_TOTAL )); then
        echo -e "${SUCCESS_COLOR}Merlin whispers:${RESET_COLOR} Your quests are complete. Explore and experiment!"
        return
    fi
    echo -e "${SUCCESS_COLOR}Merlin whispers:${RESET_COLOR} ${QUEST_HINTS[$qid]}"
}

show_quest_command() {
    render_quest_status
    if [[ -n "$QUEST_COMPLETED" ]]; then
        echo "   Completed:"
        local id
        IFS=',' read -ra id <<< "$QUEST_COMPLETED"
        for entry in "${id[@]}"; do
            [[ -z "$entry" ]] && continue
            echo "     • ${QUEST_TITLES[$entry]}"
        done
    else
        echo "   Completed: none yet."
    fi
    echo "   Total XP: $GAME_XP"
}

manual_save() {
    save_game_state
    echo -e "${SUCCESS_COLOR}💾 Progress saved.${RESET_COLOR}"
}

manual_load() {
    if [[ ! -f "$GAME_STATE_FILE" ]]; then
        echo -e "${ERROR_COLOR}No saved progress found.${RESET_COLOR}"
        return 1
    fi
    load_game_state
    restore_saved_location
    echo -e "${SUCCESS_COLOR}📂 Progress loaded.${RESET_COLOR}"
    render_quest_status
}

# ============================================================================
# TERMINAL EMULATOR FUNCTIONS
# ============================================================================


# ============================================================================
# TERMINAL EMULATOR DISPLAY
# ============================================================================

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

# ============================================================================
# COMMAND DISPATCH
# ============================================================================

execute_command() {
    local cmd="$1"
    shift
    local -a original_args=()
    if (( $# )); then
        original_args=("$@")
    fi
    local args="${original_args[*]:-}"
    local pre_command_dir="$(pwd)"

    # Log command to history
    if [[ -n "$args" ]]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') - $cmd $args" >> "$HISTORY_FILE"
    else
        echo "$(date '+%Y-%m-%d %H:%M:%S') - $cmd" >> "$HISTORY_FILE"
    fi

    local handled=false
    local status=0

    case "$cmd" in
        # Navigation commands
        "cd")
            handled=true
            safe_cd "${original_args[0]:-}"
            status=$?
            ;;
        "ls")
            handled=true
            if (( ${#original_args[@]} )); then
                safe_ls "${original_args[@]}"
            else
                safe_ls
            fi
            status=$?
            ;;
        "pwd")
            handled=true
            pwd
            status=$?
            ;;

        # File viewing commands
        "cat")
            handled=true
            if (( ${#original_args[@]} )); then
                safe_cat "${original_args[@]}"
            else
                safe_cat
            fi
            status=$?
            ;;
        "less"|"more")
            handled=true
            if (( ${#original_args[@]} )); then
                safe_pager "$cmd" "${original_args[@]}"
            else
                safe_pager "$cmd"
            fi
            status=$?
            ;;
        "head")
            handled=true
            if (( ${#original_args[@]} )); then
                safe_head "${original_args[@]}"
            else
                safe_head
            fi
            status=$?
            ;;
        "tail")
            handled=true
            if (( ${#original_args[@]} )); then
                safe_tail "${original_args[@]}"
            else
                safe_tail
            fi
            status=$?
            ;;
        "wc")
            handled=true
            if (( ${#original_args[@]} )); then
                safe_wc "${original_args[@]}"
            else
                safe_wc
            fi
            status=$?
            ;;

        # File operations (limited)
        "touch")
            handled=true
            if (( ${#original_args[@]} )); then
                safe_touch "${original_args[@]}"
            else
                safe_touch
            fi
            status=$?
            ;;
        "mkdir")
            handled=true
            if (( ${#original_args[@]} )); then
                safe_mkdir "${original_args[@]}"
            else
                safe_mkdir
            fi
            status=$?
            ;;
        "grep")
            handled=true
            if (( ${#original_args[@]} )); then
                safe_grep "${original_args[@]}"
            else
                safe_grep
            fi
            status=$?
            ;;

        # Game-specific commands
        "inventory"|"i")
            handled=true
            show_inventory
            status=$?
            ;;
        "health"|"hp")
            handled=true
            show_health
            status=$?
            ;;
        "status")
            handled=true
            show_game_status
            status=$?
            ;;
        "map")
            handled=true
            show_map
            status=$?
            ;;
        "quest"|"quests")
            handled=true
            show_quest_command
            status=$?
            ;;

        # Help and information
        "help")
            handled=true
            show_contextual_help "$args"
            status=$?
            ;;
        "tutorial")
            handled=true
            show_emulator_tutorial
            status=$?
            ;;
        "commands")
            handled=true
            show_available_commands
            status=$?
            ;;
        "merlin")
            handled=true
            merlin_hint
            status=$?
            ;;

        # Adventure commands
        "start")
            handled=true
            start_adventure
            status=$?
            ;;
        "look")
            handled=true
            look_around
            status=$?
            ;;
        "explore")
            handled=true
            explore_area
            status=$?
            ;;

        # Executable files (game content)
        "./treasure"|"./potion"|"./spell"|"./monster"|"./ghost"|"./statue"|"./altar"|"./rags"|"./fountain"|"./penguin"|"./crystal"|"./goblet"|"./glass"|"./padlock"|"./statues"|"./open"|"./nyarlathotep"|"./drummer"|"./wizard-light"|"./button"|"./loot"|"./box"|"./tome"|"./pieces"|"./armour"|"./platinum"|"./display"|"./robot"|"./end"|"./carcass"|"./king"|"./window")
            if [[ -x "$cmd" ]]; then
                handled=true
                if (( ${#original_args[@]} )); then
                    "$cmd" "${original_args[@]}"
                else
                    "$cmd"
                fi
                status=$?
            else
                status=1
                echo -e "${ERROR_COLOR}Error: $cmd not found or not executable${RESET_COLOR}"
            fi
            ;;

        # System info (safe subset)
        "whoami")
            handled=true
            echo "bashcrawl_adventurer"
            status=$?
            ;;
        "date")
            handled=true
            date
            status=$?
            ;;
        "echo")
            handled=true
            # Safe echo: expand $VAR references without eval
            local expanded_args="$args"
            # Expand known game variables safely
            expanded_args="${expanded_args//\$I/$I}"
            expanded_args="${expanded_args//\$HP/$HP}"
            expanded_args="${expanded_args//\$GAME_LEVEL/$GAME_LEVEL}"
            expanded_args="${expanded_args//\$CURRENT_AREA/$CURRENT_AREA}"
            expanded_args="${expanded_args//\$USER/$USER}"
            expanded_args="${expanded_args//\$HOME/$HOME}"
            expanded_args="${expanded_args//\$PWD/$PWD}"
            echo "$expanded_args"
            status=$?
            ;;

        # Terminal control
        "clear")
            handled=true
            clear
            status=$?
            ;;
        "history")
            handled=true
            show_command_history
            status=$?
            ;;
        "reset")
            handled=true
            reset_terminal_state
            status=$?
            ;;
        "save")
            handled=true
            manual_save
            status=$?
            ;;
        "load")
            handled=true
            manual_load
            status=$?
            ;;

        # Exit commands
        "exit"|"quit"|"q")
            exit_terminal
            return
            ;;

        # Shell builtins: export, let, alias
        "export")
            handled=true
            if [[ -n "$args" ]]; then
                # Validate: only allow safe variable assignments (NAME=VALUE)
                if [[ "$args" =~ ^[A-Za-z_][A-Za-z_0-9]*= ]]; then
                    eval "export $args" 2>/dev/null
                    status=$?
                else
                    echo -e "${ERROR_COLOR}Invalid export syntax. Use: export VAR=value${RESET_COLOR}"
                    status=1
                fi
            else
                echo -e "${ERROR_COLOR}Usage: export VAR=value${RESET_COLOR}"
                status=1
            fi
            ;;
        "let")
            handled=true
            if [[ -n "$args" ]]; then
                # Validate: only allow arithmetic expressions with known vars
                local let_pattern='^[A-Za-z_0-9=+*/% "'"'"'-]+$'
                if [[ "$args" =~ $let_pattern ]]; then
                    eval "let $args" 2>/dev/null
                    status=$?
                else
                    echo -e "${ERROR_COLOR}Invalid let syntax. Use: let \"HP=HP-5\"${RESET_COLOR}"
                    status=1
                fi
            else
                echo -e "${ERROR_COLOR}Usage: let \"expression\"${RESET_COLOR}"
                status=1
            fi
            ;;
        "alias")
            handled=true
            if [[ -n "$args" ]]; then
                eval "alias $args" 2>/dev/null
                status=$?
            else
                alias
                status=$?
            fi
            ;;
        "ln")
            handled=true
            if (( ${#original_args[@]} )); then
                ln "${original_args[@]}" 2>&1
            else
                echo -e "${ERROR_COLOR}Usage: ln -fs target linkname${RESET_COLOR}"
            fi
            status=$?
            ;;
        "cp")
            handled=true
            if (( ${#original_args[@]} )); then
                cp "${original_args[@]}" 2>&1
            else
                echo -e "${ERROR_COLOR}Usage: cp source dest${RESET_COLOR}"
            fi
            status=$?
            ;;
        "mv")
            handled=true
            if (( ${#original_args[@]} )); then
                mv "${original_args[@]}" 2>&1
            else
                echo -e "${ERROR_COLOR}Usage: mv source dest${RESET_COLOR}"
            fi
            status=$?
            ;;
        "rm")
            handled=true
            if (( ${#original_args[@]} )); then
                rm "${original_args[@]}" 2>&1
            else
                echo -e "${ERROR_COLOR}Usage: rm filename${RESET_COLOR}"
            fi
            status=$?
            ;;
        "sort")
            handled=true
            if (( ${#original_args[@]} )); then
                sort "${original_args[@]}" 2>&1
            else
                echo -e "${ERROR_COLOR}Usage: sort filename${RESET_COLOR}"
            fi
            status=$?
            ;;
        "find")
            handled=true
            if (( ${#original_args[@]} )); then
                find "${original_args[@]}" 2>&1
            else
                echo -e "${ERROR_COLOR}Usage: find . -name \"pattern\"${RESET_COLOR}"
            fi
            status=$?
            ;;
        "chmod")
            handled=true
            if (( ${#original_args[@]} )); then
                chmod "${original_args[@]}" 2>&1
            else
                echo -e "${ERROR_COLOR}Usage: chmod +x filename${RESET_COLOR}"
            fi
            status=$?
            ;;
        "sed")
            handled=true
            if (( ${#original_args[@]} )); then
                eval "sed $args" 2>&1
            else
                echo -e "${ERROR_COLOR}Usage: sed 's/old/new/' file${RESET_COLOR}"
            fi
            status=$?
            ;;

        # Catch-all for unknown commands
        *)
            if [[ -x "./$cmd" ]]; then
                handled=true
                if (( ${#original_args[@]} )); then
                    "./$cmd" "${original_args[@]}"
                else
                    "./$cmd"
                fi
                status=$?
            else
                status=1
                echo -e "${ERROR_COLOR}Command not recognized: $cmd${RESET_COLOR}"
                echo -e "Type 'commands' to see available commands, or 'help' for assistance."
            fi
            ;;
    esac

    if [[ "$handled" == true ]]; then
        LAST_COMMAND="$cmd"
        LAST_ARGS="$args"
        LAST_COMMAND_DIR="$pre_command_dir"
        LAST_RESULT_DIR="$(pwd)"
        LAST_COMMAND_EXIT_CODE=$status
        if [[ $status -eq 0 ]]; then
            register_command_use "$cmd"
            check_quest_progress
        fi
    fi

    return $status
}

# ============================================================================
# SAFE COMMAND IMPLEMENTATIONS
# ============================================================================

safe_cd() {
    local target="$1"
    local status=0
    
    # Handle special cases
    case "$target" in
        ""|"~")
            cd "$BASHCRAWL_ROOT" || status=$?
            update_current_area
            ;;
        "..")
            # Only allow going up within the game directory
            if [[ "$(pwd)" != "$BASHCRAWL_ROOT" ]]; then
                cd .. || status=$?
                update_current_area
            else
                echo -e "${ERROR_COLOR}You cannot leave the bashcrawl realm!${RESET_COLOR}"
                status=1
            fi
            ;;
        "/"*)
            echo -e "${ERROR_COLOR}Absolute paths are not allowed in the game environment.${RESET_COLOR}"
            status=1
            ;;
        *)
            if [[ -d "$target" ]]; then
                cd "$target" || status=$?
                update_current_area
            else
                echo -e "${ERROR_COLOR}Directory not found: $target${RESET_COLOR}"
                status=1
            fi
            ;;
    esac
    return $status
}

safe_ls() {
    local -a flags=("-F")
    local status=0

    if (( ${#LS_COLOR_FLAGS[@]} )); then
        flags+=("${LS_COLOR_FLAGS[@]}")
    fi

    if [[ $# -eq 0 ]]; then
        command ls "${flags[@]}" || status=$?
    else
        command ls "${flags[@]}" "$@" || status=$?
    fi

    add_area_context
    return $status
}

safe_cat() {
    if [[ $# -eq 0 ]]; then
        echo -e "${ERROR_COLOR}Usage: cat <filename>${RESET_COLOR}"
        return 1
    fi
    local status=0
    local file
    for file in "$@"; do
        if [[ -f "$file" ]]; then
            if [[ ! -s "$file" ]]; then
                echo "(empty file)"
            else
                cat "$file"
            fi
            if [[ "$file" == "scroll" ]]; then
                mark_scroll_read
            fi
        else
            echo -e "${ERROR_COLOR}File not found: $file${RESET_COLOR}"
            status=1
        fi
    done
    return $status
}

safe_pager() {
    local cmd="$1"
    shift
    local file="$1"
    
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
        return 0
    else
        echo -e "${ERROR_COLOR}File not found: $file${RESET_COLOR}"
        return 1
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
        return 1
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
        return 1
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
        return 1
    fi
}

safe_touch() {
    if [[ $# -eq 0 ]]; then
        echo -e "${ERROR_COLOR}Usage: touch <filename>${RESET_COLOR}"
        return 1
    fi
    local name="$1"
    if [[ "$name" == /* || "$name" == *"../"* || "$name" == *"/.."* ]]; then
        echo -e "${ERROR_COLOR}Absolute paths and parent directory references are not allowed.${RESET_COLOR}"
        return 1
    fi
    if [[ ! "$name" =~ ^[a-zA-Z0-9_.-/]+$ ]]; then
        echo -e "${ERROR_COLOR}Invalid filename. Use letters, numbers, dots, dashes, underscores, and slashes only.${RESET_COLOR}"
        return 1
    fi
    touch "$name"
    return $?
}

safe_mkdir() {
    if [[ $# -eq 0 ]]; then
        echo -e "${ERROR_COLOR}Usage: mkdir <dirname>${RESET_COLOR}"
        return 1
    fi
    local name="$1"
    if [[ "$name" == /* || "$name" == *"../"* || "$name" == *"/.."* ]]; then
        echo -e "${ERROR_COLOR}Absolute paths and parent directory references are not allowed.${RESET_COLOR}"
        return 1
    fi
    if [[ ! "$name" =~ ^[a-zA-Z0-9_.-]+$ ]]; then
        echo -e "${ERROR_COLOR}Invalid directory name. Use letters, numbers, dots, dashes, and underscores only.${RESET_COLOR}"
        return 1
    fi
    if [[ -d "$name" ]]; then
        echo -e "${SUCCESS_COLOR}Directory already exists: $name${RESET_COLOR}"
        return 0
    fi
    mkdir "$name"
    return $?
}

safe_grep() {
    if [[ $# -lt 2 ]]; then
        echo -e "${ERROR_COLOR}Usage: grep <pattern> <file>${RESET_COLOR}"
        return 1
    fi
    local pattern="$1"
    shift
    local file="$1"
    if [[ -z "$pattern" ]]; then
        echo -e "${ERROR_COLOR}Pattern cannot be empty.${RESET_COLOR}"
        return 1
    fi
    if [[ -z "$file" ]]; then
        echo -e "${ERROR_COLOR}Specify a file to search.${RESET_COLOR}"
        return 1
    fi
    if [[ ! -f "$file" ]]; then
        echo -e "${ERROR_COLOR}File not found: $file${RESET_COLOR}"
        return 1
    fi
    grep --color=auto "$pattern" "$file"
    return $?
}

# ============================================================================
# GAME-SPECIFIC FUNCTIONS

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
    echo "   XP: $GAME_XP"
    echo ""
    show_inventory
    echo ""
    show_health
    echo ""
    render_quest_status
}

show_map() {
    echo -e "${SUCCESS_COLOR}🗺️  CATACOMBS MAP:${RESET_COLOR}"
    cat << EOF

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
  
Current location: $(relative_path "$(pwd)")

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
    executables=$({ find . -maxdepth 1 -type f -perm -111 2>/dev/null | head -3; } || true)
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

show_navigation_help() {
    echo -e "${SUCCESS_COLOR}🧭 NAVIGATION HELP:${RESET_COLOR}"
    cat << 'EOF'

MOVING AROUND:
   cd <dir>      Move into a directory (room)
   cd ..         Go back to the previous room
   cd ~          Return to the bashcrawl lobby
   pwd           Show your current location
   ls            List contents of current room
   ls -a         Show hidden files and directories
   ls -la        Detailed listing with permissions

TIPS:
   • Directories are rooms — use 'cd' to explore them
   • Hidden rooms start with '.' (use 'ls -a' to find them)
   • You cannot leave the bashcrawl realm
   • Use 'map' to see the dungeon layout

EOF
}

show_game_help() {
    echo -e "${SUCCESS_COLOR}🎮 GAME HELP:${RESET_COLOR}"
    cat << 'EOF'

GAME INTERACTIONS:
   ./treasure    Open treasure chests (adds items to inventory)
   ./potion      Drink potions (restores health)
   ./spell       Cast spells (creates symlink portals)
   ./statue      Combat encounters (uses arithmetic)
   ./monster     Fight monsters in hidden areas

GAME STATE:
   inventory     Check your collected items
   health        Check your health points
   status        Full game status overview
   quest         View current quest objective
   merlin        Get a contextual hint
   save          Save your progress
   load          Restore saved progress

KEY CONCEPTS:
   • Run executables with './' prefix (e.g., ./treasure)
   • Use 'export' to set variables (export I=item,$I)
   • Use 'let' for arithmetic (let "HP=HP-5")
   • Read scrolls with 'cat scroll' for instructions

EOF
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
        echo "Type 'merlin' for a hint or 'quest' for objectives"
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
    grep <p> <f> Search for words in scrolls

FILE OPERATIONS:
    touch <file> Create or update a file
    mkdir <dir>  Create a new directory

GAME COMMANDS:
   inventory    Show your collected items (alias: i)
   health       Show your health status (alias: hp)
   status       Show complete game status
   map          Display catacombs map
   start        Begin the adventure
   look         Examine current area
    explore      Detailed area exploration
    quest        Show current quest progress
    merlin       Receive a contextual hint
    save         Save your progress
    load         Load your saved progress

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
show_emulator_tutorial() {
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

STEP 7: Track Your Quest
    Use 'quest' to see your current objective or 'merlin' for a hint.

PRACTICE SEQUENCE:
   1. Type: pwd
   2. Type: ls
   3. Type: cd entrance
   4. Type: cat scroll
    5. Type: status
    6. Type: quest

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
    CURRENT_PATH="bashcrawl"
    CURRENT_QUEST_ID=0
    QUEST_COMPLETED=""
    LEARNED_COMMANDS=""
    GAME_XP=0
    SCROLLS_READ=""
    LAST_COMMAND=""
    LAST_ARGS=""
    LAST_COMMAND_DIR=""
    LAST_RESULT_DIR=""
    LAST_COMMAND_EXIT_CODE=0
    
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
    render_quest_status
}

look_around() {
    echo -e "${SUCCESS_COLOR}👁️  LOOKING AROUND:${RESET_COLOR}"
    echo ""
    echo "Current location: $(pwd)"
    echo ""
    
    # Enhanced ls with game context
    ls -F "${LS_COLOR_FLAGS[@]}"
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
    ls -la "${LS_COLOR_FLAGS[@]}"
    echo ""
    
    echo "=== AREA ANALYSIS ==="
    local file_count dir_count exec_count
    file_count=$(find . -maxdepth 1 -type f | wc -l)
    dir_count=$(find . -maxdepth 1 -type d | wc -l)
    exec_count=$({ find . -maxdepth 1 -type f -perm -111 2>/dev/null | wc -l; } || true)
    
    echo "   Files: $file_count"
    echo "   Directories: $((dir_count - 1))"  # Subtract current directory
    echo "   Executables: $exec_count"
    echo ""
    
    add_area_context
}

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

# ============================================================================
# GAME STATE PERSISTENCE AND UTILITIES
# ============================================================================

update_current_area() {
    local current_dir
    current_dir=$(basename "$(pwd)")
    CURRENT_AREA="$current_dir"
    CURRENT_PATH="$(relative_path "$(pwd)")"
    
    # Save game state
    save_game_state
}

mark_scroll_read() {
    local area
    area=$(basename "$(pwd)")
    SCROLLS_READ="$(csv_add "$SCROLLS_READ" "$area")"
    save_game_state
}

save_game_state() {
    cat > "$GAME_STATE_FILE" << EOF
# Bashcrawl Game State (terminal-emulator format)
CURRENT_AREA="$CURRENT_AREA"
INVENTORY="$I"
HEALTH="$HP"
GAME_LEVEL="$GAME_LEVEL"
LAST_UPDATED="$(date)"
CURRENT_QUEST_ID="$CURRENT_QUEST_ID"
QUEST_COMPLETED="$QUEST_COMPLETED"
LEARNED_COMMANDS="$LEARNED_COMMANDS"
GAME_XP="$GAME_XP"
SCROLLS_READ="$SCROLLS_READ"
CURRENT_PATH="$CURRENT_PATH"
# Aliases for main.sh compatibility
PLAYER_INVENTORY="$I"
PLAYER_HEALTH="$HP"
PLAYER_LEVEL="$GAME_LEVEL"
GAME_STARTED="true"
SESSION_COUNT="${SESSION_COUNT:-0}"
LAST_SESSION="$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')"
EOF
}

load_game_state() {
    if [[ -f "$GAME_STATE_FILE" ]]; then
        # Temporarily disable strict mode — the state file may come from
        # main.sh (PLAYER_* vars) or from a previous terminal-emulator
        # session (INVENTORY, HEALTH, etc.).  Accept either format.
        set +u
        source "$GAME_STATE_FILE"

        # Map main.sh variable names to terminal-emulator names
        INVENTORY="${INVENTORY:-${PLAYER_INVENTORY:-}}"
        HEALTH="${HEALTH:-${PLAYER_HEALTH:-100}}"
        GAME_LEVEL="${GAME_LEVEL:-${PLAYER_LEVEL:-novice}}"

        export I="${INVENTORY:-}"
        export HP="${HEALTH:-100}"
        export CURRENT_AREA="${CURRENT_AREA:-pre-entrance}"
        export GAME_LEVEL="${GAME_LEVEL:-novice}"
        CURRENT_QUEST_ID="${CURRENT_QUEST_ID:-0}"
        QUEST_COMPLETED="${QUEST_COMPLETED:-}"
        LEARNED_COMMANDS="${LEARNED_COMMANDS:-}"
        GAME_XP="${GAME_XP:-0}"
        SCROLLS_READ="${SCROLLS_READ:-}"
        CURRENT_PATH="${CURRENT_PATH:-bashcrawl}"
        set -u
    fi
}

restore_saved_location() {
    local rel="${CURRENT_PATH:-bashcrawl}"
    if [[ "$rel" == "bashcrawl" ]]; then
        cd "$BASHCRAWL_ROOT"
    elif [[ -d "$BASHCRAWL_ROOT/$rel" ]]; then
        cd "$BASHCRAWL_ROOT/$rel"
    else
        cd "$BASHCRAWL_ROOT"
        rel="bashcrawl"
    fi
    CURRENT_PATH="$rel"
    update_current_area
}

show_command_history() {
    if [[ -f "$HISTORY_FILE" ]]; then
        echo -e "${SUCCESS_COLOR}📜 COMMAND HISTORY:${RESET_COLOR}"
        tail -20 "$HISTORY_FILE"
    else
        echo "No command history available."
    fi
}

reset_terminal_state() {
    echo -e "${SUCCESS_COLOR}🔄 RESETTING GAME STATE...${RESET_COLOR}"
    
    # Reset variables
    export I=""
    export HP=100
    export GAME_LEVEL="novice"
    export CURRENT_AREA="pre-entrance"
    CURRENT_PATH="bashcrawl"
    CURRENT_QUEST_ID=0
    QUEST_COMPLETED=""
    LEARNED_COMMANDS=""
    GAME_XP=0
    SCROLLS_READ=""
    LAST_COMMAND=""
    LAST_ARGS=""
    LAST_COMMAND_DIR=""
    LAST_RESULT_DIR=""
    LAST_COMMAND_EXIT_CODE=0
    
    # Clear state files
    rm -f "$GAME_STATE_FILE"
    rm -f "$HISTORY_FILE"
    
    # Return to root
    cd "$BASHCRAWL_ROOT"
    save_game_state
    
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
# NON-INTERACTIVE MODES
# ============================================================================

_dispatch_input() {
    local input="$1"
    [[ -z "$input" ]] && return 0
    [[ "$input" == \#* ]] && return 0  # skip comments

    # Handle piped / redirected commands via eval
    if [[ "$input" == *"|"* ]] || [[ "$input" == *">"* ]]; then
        local status=0
        set +e
        eval "$input" 2>&1
        status=$?
        set -e
        save_game_state
        return $status
    fi

    # Parse command and arguments
    local -a cmd_array
    read -ra cmd_array <<< "$input"
    local command="${cmd_array[0]}"
    local -a cmd_args=()
    if (( ${#cmd_array[@]} > 1 )); then
        cmd_args=("${cmd_array[@]:1}")
    fi

    local status=0
    set +e
    if (( ${#cmd_args[@]} )); then
        execute_command "$command" "${cmd_args[@]}"
        status=$?
    else
        execute_command "$command"
        status=$?
    fi
    set -e

    save_game_state
    return $status
}

# Run a single command then exit.  State is loaded/saved automatically so
# successive invocations (e.g. from Copilot) build on each other.
#   bash main.sh -c "cd entrance"
#   bash main.sh -c "cat scroll"
run_single_command() {
    cd "$BASHCRAWL_ROOT"
    touch "$HISTORY_FILE"
    load_game_state
    restore_saved_location
    _dispatch_input "$*"
}

# Run commands from stdin (one per line).  Useful for piping a script:
#   echo -e "pwd\nls\ncd entrance\ncat scroll" | bash main.sh --batch
run_batch() {
    cd "$BASHCRAWL_ROOT"
    touch "$HISTORY_FILE"
    load_game_state
    restore_saved_location

    while IFS= read -r input || [[ -n "$input" ]]; do
        echo -e "$(generate_prompt)${input}"
        _dispatch_input "$input"
        echo
    done
}

# ============================================================================
# GAME MODE IMPLEMENTATIONS
# ============================================================================

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

    export BASHCRAWL_MODE="terminal_emulator"

    if [[ -f "$GAME_STATE_FILE" ]]; then
        sed -i.bak "s/GAME_STARTED=.*/GAME_STARTED=\"true\"/" "$GAME_STATE_FILE"
        local current_count
        current_count=$(grep "SESSION_COUNT=" "$GAME_STATE_FILE" | cut -d= -f2 || echo "0")
        sed -i.bak "s/SESSION_COUNT=.*/SESSION_COUNT=$((current_count + 1))/" "$GAME_STATE_FILE"
        rm -f "${GAME_STATE_FILE}.bak"
    fi

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

        _dispatch_input "$input"
        echo
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
    
    # Update game state
    if [[ -f "$GAME_STATE_FILE" ]]; then
        sed -i.bak "s/GAME_STARTED=.*/GAME_STARTED=\"true\"/" "$GAME_STATE_FILE"
        rm -f "${GAME_STATE_FILE}.bak"
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
    
    # Mark tutorial as viewed
    if [[ -f "$GAME_STATE_FILE" ]]; then
        sed -i.bak "s/TUTORIAL_COMPLETED=.*/TUTORIAL_COMPLETED=\"true\"/" "$GAME_STATE_FILE"
        rm -f "${GAME_STATE_FILE}.bak"
    fi
    
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
    echo "   • Areas visited and treasures found"
    echo "   • Session history and statistics"
    echo "   • Tutorial completion status"
    echo "   • Unlocked hidden rooms (re-hidden)"
    echo "   • Combat artifacts (corpses, statue pieces)"
    echo ""
    echo -n "Are you sure you want to reset? [y/N]: "
    read -r confirmation
    
    if [[ "$confirmation" =~ ^[Yy]$ ]]; then
        # Use lib/reset.sh for comprehensive game state reset
        if [[ -f "${BASHCRAWL_ROOT}/lib/reset.sh" ]]; then
            bash "${BASHCRAWL_ROOT}/lib/reset.sh"
            log_event "SUCCESS" "Game state has been reset via lib/reset.sh" "reset"
        else
            # Fallback: basic reset
            log_event "WARNING" "lib/reset.sh not found, performing basic reset" "reset"
            rm -f "$GAME_STATE_FILE"
            rm -rf "$GAME_DATA_DIR"
        fi
        
        # Reinitialize
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
show_launcher_status() {
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
# MAIN MENU
# ============================================================================

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
                show_launcher_status
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
# CLI ARGUMENT PROCESSING
# ============================================================================

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
    -c, --command "CMD"   Execute a single emulator command, then exit
        --batch           Read commands from stdin (one per line)
    -h, --help            Show this help message
    -v, --version         Show version information
    --debug               Enable debug logging

${COLOR_PRIMARY}EXAMPLES:${COLOR_RESET}
    $SCRIPT_NAME                        # Launch interactive menu
    $SCRIPT_NAME --interactive          # Start safe terminal emulator
    $SCRIPT_NAME --native              # Start traditional experience
    $SCRIPT_NAME --tutorial            # Learn how to play
    $SCRIPT_NAME --status              # Check progress
    $SCRIPT_NAME -c "cd entrance"      # Run one command
    $SCRIPT_NAME -c "cat scroll"       # Run another (state persists)
    echo -e "pwd\nls" | $SCRIPT_NAME --batch  # Batch mode

${COLOR_PRIMARY}GAME MODES:${COLOR_RESET}
    ${COLOR_SUCCESS}Interactive Mode:${COLOR_RESET} Safe, contained environment perfect for beginners
    ${COLOR_WARNING}Native Mode:${COLOR_RESET}     Uses your actual terminal (requires experience)

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
    
    if [[ -f "$GAME_STATE_FILE" ]]; then
        source "$GAME_STATE_FILE"
        echo -e "${COLOR_PRIMARY}Game Status:${COLOR_RESET} Initialized (Level: $PLAYER_LEVEL)"
        echo -e "${COLOR_PRIMARY}Sessions:${COLOR_RESET} $SESSION_COUNT"
    else
        echo -e "${COLOR_PRIMARY}Game Status:${COLOR_RESET} Not initialized"
    fi
}

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
            "interactive")   launch_interactive_mode ;;
            "native")        launch_native_mode ;;
            "tutorial")      launch_tutorial; exit 0 ;;
            "demo")          launch_demo; exit 0 ;;
            "status")        show_launcher_status; exit 0 ;;
            "reset")         reset_game_state; exit 0 ;;
            "single_command") run_single_command "$BASHCRAWL_SINGLE_CMD"; exit $? ;;
            "batch")         run_batch; exit $? ;;
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
