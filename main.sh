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

SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"
readonly SCRIPT_NAME
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
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

# Source unified state management (sets I, HP, GAME_LEVEL, CURRENT_AREA)
if [[ -f "${BASHCRAWL_ROOT}/lib/state.sh" ]]; then
    source "${BASHCRAWL_ROOT}/lib/state.sh"
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
# QUEST PROGRESSION DATA
# ============================================================================

declare -a QUEST_REQUIRED_COMMAND
declare -a QUEST_HINTS
declare -a QUEST_TARGET_CONTEXT
declare -a QUEST_REWARDS
declare -a QUEST_REWARD_XP

# Quest data aligned with src/help/data/quests.yaml (single source of truth).
# To add/change quests, edit quests.yaml — the Python TUI reads from there too.

QUEST_TITLES=(
    "Awakening: Know Thy Place"
    "Eyes to See"
    "First Steps"
    "Ancient Knowledge"
    "Shape the World"
    "Spark of Creation"
    "Seek the Whisper"
    "The Bashcrawl Grimoire"
)

QUEST_OBJECTIVES=(
    "Cast the 'pwd' spell to reveal your place in the dungeon."
    "Use 'ls' to reveal nearby rooms and scrolls."
    "Use 'cd cellar' to descend into the cellar."
    "Use 'cat scroll' to read the ancient knowledge."
    "Navigate to the workshop and use 'mkdir' to create a directory."
    "Use 'touch' to create a new file."
    "Use 'grep' to search for a word within a scroll."
    "Find the hidden study, run the grimoire, and define the 'bc' command."
)

QUEST_REQUIRED_COMMAND=(pwd ls cd cat mkdir touch grep source)

QUEST_HINTS=(
    "Type 'pwd' and press Enter to see your current chamber."
    "Try 'ls' to survey the room's contents."
    "Use 'cd cellar' to descend into the cellar."
    "Try 'cat scroll' to read the ancient knowledge on the pedestal."
    "Use 'mkdir' to shape a new workspace."
    "Use 'touch notes.txt' to conjure a new file."
    "Run 'grep catacombs scroll' to uncover the hidden clue."
    "Find the library, read the tome, then source the grimoire."
)

# location_check — pipe-separated room names (empty = any location)
QUEST_TARGET_CONTEXT=(
    ""
    ""
    "cellar"
    ""
    ""
    ""
    "armoury|cellar"
    "study|help"
)

QUEST_REWARDS=(
    "Navigation Novice ribbon"
    "Glimmering lens"
    "Pathwalker's charm"
    "Reader's sigil"
    "Builder's sigil"
    "Scribe's quill"
    "Whisperer's token"
    "Scriptorium Key"
)

QUEST_REWARD_XP=(50 50 100 100 100 100 150 200)

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
    state_init   # creates .bashcrawl_save.json if missing (with migration)
    state_load || true   # load into memory + export I, HP, etc.
    # Map state fields to main.sh variables used by the quest system
    CURRENT_QUEST_ID="$(state_get current_quest_id)"
    QUEST_COMPLETED="$(state_get completed_quest_ids)"
    LEARNED_COMMANDS="$(state_get learned_commands)"
    GAME_XP="$(state_get experience_points)"
    SCROLLS_READ="$(state_get scrolls_read)"
    CURRENT_PATH="$(state_get current_location)"
    log_event "SUCCESS" "Game state loaded" "state"
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
            echo "${abs#"${root}"/}"
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
    GAME_XP=$((GAME_XP + QUEST_REWARD_XP[qid]))
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
            local dirname=""
            if [[ "${__last_args[0]:-}" == "-p" ]]; then
                dirname="${__last_args[1]:-}"
            else
                dirname="${__last_args[0]:-}"
            fi
            # Accept workshop or workshop/ (from mkdir -p)
            [[ "${dirname%%/*}" == "workshop" ]] || return
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
╔═══════════════════════════════════════════════════════════════╗
║                ⚔️  BASHCRAWL TERMINAL EMULATOR ⚔️              ║
║                                                               ║
║   Learn real terminal commands by exploring ancient catacombs ║
║   Safe environment — you cannot break anything outside game   ║
╚═══════════════════════════════════════════════════════════════╝
EOF

    echo ""
    echo -e "${COLOR_PRIMARY}QUICK START:${COLOR_RESET}"
    echo -e "   ${COLOR_BOLD}start${COLOR_RESET}          Begin your adventure"
    echo -e "   ${COLOR_BOLD}ls${COLOR_RESET}             Look around"
    echo -e "   ${COLOR_BOLD}cd entrance${COLOR_RESET}    Enter the catacombs"
    echo -e "   ${COLOR_BOLD}help${COLOR_RESET}           Context-aware assistance"
    echo -e "   ${COLOR_BOLD}quest${COLOR_RESET}          See current objective"
    echo -e "   ${COLOR_BOLD}exit${COLOR_RESET}           Leave the game"
    echo ""
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
        "workshop")
            echo -e "${PROMPT_COLOR}🔧 workshop${RESET_COLOR} ${DIRECTORY_COLOR}[creation tutorial]${RESET_COLOR} ⚔️  "
            ;;
        "cellar")
            echo -e "${PROMPT_COLOR}🏰 cellar${RESET_COLOR} ${DIRECTORY_COLOR}[underground]${RESET_COLOR} ⚔️  "
            ;;
        "armoury")
            echo -e "${PROMPT_COLOR}🗡️ armoury${RESET_COLOR} ${DIRECTORY_COLOR}[weapons hall]${RESET_COLOR} ⚔️  "
            ;;
        "chamber")
            echo -e "${PROMPT_COLOR}💎 chamber${RESET_COLOR} ${DIRECTORY_COLOR}[treasure room]${RESET_COLOR} ⚔️  "
            ;;
        ".chapel")
            echo -e "${PROMPT_COLOR}⛪ chapel${RESET_COLOR} ${DIRECTORY_COLOR}[hidden sanctuary]${RESET_COLOR} ⚔️  "
            ;;
        "courtyard")
            echo -e "${PROMPT_COLOR}🌿 courtyard${RESET_COLOR} ${DIRECTORY_COLOR}[chapel grounds]${RESET_COLOR} ⚔️  "
            ;;
        "aviary")
            echo -e "${PROMPT_COLOR}🦅 aviary${RESET_COLOR} ${DIRECTORY_COLOR}[bird sanctuary]${RESET_COLOR} ⚔️  "
            ;;
        "hall")
            echo -e "${PROMPT_COLOR}🏛️ hall${RESET_COLOR} ${DIRECTORY_COLOR}[grand chamber]${RESET_COLOR} ⚔️  "
            ;;
        "library")
            echo -e "${PROMPT_COLOR}📚 library${RESET_COLOR} ${DIRECTORY_COLOR}[ancient tomes]${RESET_COLOR} ⚔️  "
            ;;
        "graveyard")
            echo -e "${PROMPT_COLOR}🪦 graveyard${RESET_COLOR} ${DIRECTORY_COLOR}[resting place]${RESET_COLOR} ⚔️  "
            ;;
        ".vault")
            echo -e "${PROMPT_COLOR}💰 vault${RESET_COLOR} ${DIRECTORY_COLOR}[treasure hold]${RESET_COLOR} ⚔️  "
            ;;
        "stronghold")
            echo -e "${PROMPT_COLOR}🏰 stronghold${RESET_COLOR} ${DIRECTORY_COLOR}[vault heart]${RESET_COLOR} ⚔️  "
            ;;
        "nursery")
            echo -e "${PROMPT_COLOR}🌱 nursery${RESET_COLOR} ${DIRECTORY_COLOR}[vault garden]${RESET_COLOR} ⚔️  "
            ;;
        "lab")
            echo -e "${PROMPT_COLOR}🧪 lab${RESET_COLOR} ${DIRECTORY_COLOR}[alchemy room]${RESET_COLOR} ⚔️  "
            ;;
        ".scrap")
            echo -e "${PROMPT_COLOR}🔗 scrap${RESET_COLOR} ${DIRECTORY_COLOR}[symlink portal]${RESET_COLOR} ⚔️  "
            ;;
        ".rift")
            echo -e "${PROMPT_COLOR}🌀 rift${RESET_COLOR} ${DIRECTORY_COLOR}[advanced realm]${RESET_COLOR} ⚔️  "
            ;;
        "arena")
            echo -e "${PROMPT_COLOR}⚔️ arena${RESET_COLOR} ${DIRECTORY_COLOR}[combat pit]${RESET_COLOR} ⚔️  "
            ;;
        "pit")
            echo -e "${PROMPT_COLOR}🕳️ pit${RESET_COLOR} ${DIRECTORY_COLOR}[boss lair]${RESET_COLOR} ⚔️  "
            ;;
        "spire")
            echo -e "${PROMPT_COLOR}🗼 spire${RESET_COLOR} ${DIRECTORY_COLOR}[tower ascent]${RESET_COLOR} ⚔️  "
            ;;
        "mezzanine")
            echo -e "${PROMPT_COLOR}🪜 mezzanine${RESET_COLOR} ${DIRECTORY_COLOR}[elevator access]${RESET_COLOR} ⚔️  "
            ;;
        *)
            echo -e "${PROMPT_COLOR}📍 $current_dir${RESET_COLOR} ${DIRECTORY_COLOR}[exploring]${RESET_COLOR} ⚔️  "
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
    local pre_command_dir
    pre_command_dir="$(pwd)"

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
        "./treasure"|"./potion"|"./spell"|"./monster"|"./ghost"|"./statue"|"./altar"|"./rags"|"./fountain"|"./penguin"|"./crystal"|"./goblet"|"./glass"|"./padlock"|"./statues"|"./open"|"./nyarlathotep"|"./drummer"|"./wizard-light"|"./button"|"./loot"|"./box"|"./tome"|"./grimoire"|"./pieces"|"./armour"|"./platinum"|"./display"|"./robot"|"./end"|"./carcass"|"./king"|"./window")
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
            expanded_args="${expanded_args//\$I/$I}"
            expanded_args="${expanded_args//\$HP/$HP}"
            expanded_args="${expanded_args//\$GAME_LEVEL/$GAME_LEVEL}"
            expanded_args="${expanded_args//\$CURRENT_AREA/$CURRENT_AREA}"
            expanded_args="${expanded_args//\$USER/$USER}"
            expanded_args="${expanded_args//\$HOME/$HOME}"
            expanded_args="${expanded_args//\$PWD/$PWD}"
            expanded_args="${expanded_args//\$BASHCRAWL_ROOT/$BASHCRAWL_ROOT}"
            expanded_args="${expanded_args//\$OLDPWD/${OLDPWD:-}}"
            echo "$expanded_args"
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
            ;;

        # Shell builtins: export, let, alias, unset, source
        "export")
            handled=true
            if [[ -n "$args" ]]; then
                # Handle export -f (export shell function)
                if [[ "$args" == -f\ * ]]; then
                    local func_name="${args#-f }"
                    if declare -f "$func_name" &>/dev/null; then
                        # shellcheck disable=SC2163  # Intentional: exporting function named by variable
                        export -f "$func_name" 2>/dev/null
                        status=$?
                        if [[ $status -eq 0 ]]; then
                            echo -e "${SUCCESS_COLOR}Function '$func_name' exported.${RESET_COLOR}"
                        fi
                    else
                        echo -e "${ERROR_COLOR}Function not found: $func_name${RESET_COLOR}"
                        status=1
                    fi
                # Validate: only allow safe variable assignments (NAME=VALUE)
                elif [[ "$args" =~ ^[A-Za-z_][A-Za-z_0-9]*= ]]; then
                    eval "export $args" 2>/dev/null
                    status=$?
                    if [[ $status -eq 0 ]]; then
                        # Provide feedback for inventory and HP changes
                        if [[ "$args" == I=* ]]; then
                            echo -e "${SUCCESS_COLOR}🎒 Inventory updated: $I${RESET_COLOR}"
                        elif [[ "$args" == HP=* ]]; then
                            echo -e "${SUCCESS_COLOR}❤️  Health set to: $HP${RESET_COLOR}"
                        fi
                    fi
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
        "file")
            handled=true
            if (( ${#original_args[@]} )); then
                file "${original_args[@]}" 2>&1
            else
                echo -e "${ERROR_COLOR}Usage: file <filename>${RESET_COLOR}"
            fi
            status=$?
            ;;
        "uniq")
            handled=true
            if (( ${#original_args[@]} )); then
                uniq "${original_args[@]}" 2>&1
            else
                echo -e "${ERROR_COLOR}Usage: uniq <filename>${RESET_COLOR}"
            fi
            status=$?
            ;;
        "man")
            handled=true
            if (( ${#original_args[@]} )); then
                # Show a brief help instead of launching the pager
                local man_cmd="${original_args[0]}"
                echo "Manual page for: $man_cmd"
                echo "─────────────────────────────"
                "$man_cmd" --help 2>&1 | head -30 || echo "(no help available for $man_cmd)"
            else
                echo -e "${ERROR_COLOR}Usage: man <command>${RESET_COLOR}"
            fi
            status=$?
            ;;
        "unalias")
            handled=true
            if (( ${#original_args[@]} )); then
                unalias "${original_args[@]}" 2>/dev/null || echo "No such alias: ${original_args[0]}"
            else
                echo -e "${ERROR_COLOR}Usage: unalias <name>${RESET_COLOR}"
            fi
            status=$?
            ;;
        "unset")
            handled=true
            if (( ${#original_args[@]} )); then
                local var_name="${original_args[0]}"
                # Only allow unsetting game-related variables
                if [[ "$var_name" =~ ^[A-Za-z_][A-Za-z_0-9]*$ ]]; then
                    unset "$var_name" 2>/dev/null
                    status=$?
                    echo -e "${SUCCESS_COLOR}Variable '$var_name' unset.${RESET_COLOR}"
                else
                    echo -e "${ERROR_COLOR}Invalid variable name: $var_name${RESET_COLOR}"
                    status=1
                fi
            else
                echo -e "${ERROR_COLOR}Usage: unset <variable>${RESET_COLOR}"
                status=1
            fi
            ;;
        "source"|".")
            handled=true
            if (( ${#original_args[@]} )); then
                local src_file="${original_args[0]}"
                if [[ -f "$src_file" ]]; then
                    # shellcheck disable=SC1090
                    source "$src_file" 2>&1
                    status=$?
                else
                    echo -e "${ERROR_COLOR}File not found: $src_file${RESET_COLOR}"
                    status=1
                fi
            else
                echo -e "${ERROR_COLOR}Usage: source <filename>${RESET_COLOR}"
                status=1
            fi
            ;;
        "readlink")
            handled=true
            if (( ${#original_args[@]} )); then
                readlink "${original_args[@]}" 2>&1
                status=$?
            else
                echo -e "${ERROR_COLOR}Usage: readlink <symlink>${RESET_COLOR}"
                status=1
            fi
            ;;
        "dirname")
            handled=true
            if (( ${#original_args[@]} )); then
                dirname "${original_args[@]}" 2>&1
                status=$?
            else
                echo -e "${ERROR_COLOR}Usage: dirname <path>${RESET_COLOR}"
                status=1
            fi
            ;;
        "basename")
            handled=true
            if (( ${#original_args[@]} )); then
                basename "${original_args[@]}" 2>&1
                status=$?
            else
                echo -e "${ERROR_COLOR}Usage: basename <path>${RESET_COLOR}"
                status=1
            fi
            ;;
        "type")
            handled=true
            if (( ${#original_args[@]} )); then
                type "${original_args[@]}" 2>&1
                status=$?
            else
                echo -e "${ERROR_COLOR}Usage: type <command>${RESET_COLOR}"
                status=1
            fi
            ;;
        "declare")
            handled=true
            if (( ${#original_args[@]} )); then
                declare "${original_args[@]}" 2>&1
                status=$?
            else
                echo -e "${ERROR_COLOR}Usage: declare [-f] [name]${RESET_COLOR}"
                status=1
            fi
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
            # Handle both bare names (cmd) and dot-slash prefixed (./cmd)
            local exec_path="$cmd"
            [[ "$cmd" != ./* ]] && exec_path="./$cmd"
            if [[ -x "$exec_path" ]]; then
                handled=true
                if (( ${#original_args[@]} )); then
                    "$exec_path" "${original_args[@]}"
                else
                    "$exec_path"
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
            if [[ "$target" == "~" ]]; then
                echo -e "${COLOR_INFO}In the game, ~ takes you to the bashcrawl lobby.${RESET_COLOR}"
            fi
            ;;
        "-")
            # cd - : go to previous directory (OLDPWD)
            if [[ -n "${OLDPWD:-}" ]]; then
                local prev="$OLDPWD"
                # Ensure previous dir is within game boundary
                if [[ "$prev" == "$BASHCRAWL_ROOT"* ]]; then
                    cd "$prev" || status=$?
                    pwd
                    update_current_area
                else
                    echo -e "${ERROR_COLOR}Previous directory is outside the game realm.${RESET_COLOR}"
                    status=1
                fi
            else
                echo -e "${ERROR_COLOR}No previous directory.${RESET_COLOR}"
                status=1
            fi
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
        "$"*)
            # Handle variable paths like $BASHCRAWL_ROOT/entrance
            local expanded
            eval "expanded=$target" 2>/dev/null || expanded=""
            if [[ -n "$expanded" && -d "$expanded" ]]; then
                cd "$expanded" || status=$?
                update_current_area
            else
                echo -e "${ERROR_COLOR}Directory not found: $target${RESET_COLOR}"
                status=1
            fi
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
        echo -e "${ERROR_COLOR}Usage: mkdir <dirname> or mkdir -p <dirname>${RESET_COLOR}"
        return 1
    fi
    local -a dirs=()
    local use_parents=false

    if [[ "$1" == "-p" ]]; then
        use_parents=true
        shift
    fi

    if [[ $# -eq 0 ]]; then
        echo -e "${ERROR_COLOR}Usage: mkdir <dirname> or mkdir -p <dirname>${RESET_COLOR}"
        return 1
    fi

    for name in "$@"; do
        if [[ "$name" == /* || "$name" == *"../"* || "$name" == *"/.."* ]]; then
            echo -e "${ERROR_COLOR}Absolute paths and parent directory references are not allowed.${RESET_COLOR}"
            return 1
        fi
        if [[ "$name" == */* ]]; then
            if [[ "$use_parents" != true ]]; then
                echo -e "${ERROR_COLOR}Use 'mkdir -p' to create nested directories.${RESET_COLOR}"
                return 1
            fi
            if [[ ! "$name" =~ ^[a-zA-Z0-9_./-]+$ ]]; then
                echo -e "${ERROR_COLOR}Invalid path. Use letters, numbers, dots, dashes, slashes, and underscores only.${RESET_COLOR}"
                return 1
            fi
        elif [[ ! "$name" =~ ^[a-zA-Z0-9_.-]+$ ]]; then
            echo -e "${ERROR_COLOR}Invalid directory name. Use letters, numbers, dots, dashes, and underscores only.${RESET_COLOR}"
            return 1
        fi
        dirs+=("$name")
    done

    for name in "${dirs[@]}"; do
        if [[ -d "$name" ]]; then
            echo -e "${SUCCESS_COLOR}Directory already exists: $name${RESET_COLOR}"
        else
            if [[ "$use_parents" == true ]]; then
                mkdir -p "$name" || return $?
            else
                mkdir "$name" || return $?
            fi
        fi
    done
    return 0
}

safe_grep() {
    if [[ $# -lt 2 ]]; then
        echo -e "${ERROR_COLOR}Usage: grep [options] <pattern> <file>${RESET_COLOR}"
        return 1
    fi

    # Separate flags from positional args (pattern + file)
    local -a flags=()
    local -a positional=()
    for arg in "$@"; do
        if [[ "$arg" == -* ]]; then
            flags+=("$arg")
        else
            positional+=("$arg")
        fi
    done

    if [[ ${#positional[@]} -lt 2 ]]; then
        echo -e "${ERROR_COLOR}Usage: grep [options] <pattern> <file>${RESET_COLOR}"
        return 1
    fi

    local pattern="${positional[0]}"
    local file="${positional[1]}"

    if [[ -z "$pattern" ]]; then
        echo -e "${ERROR_COLOR}Pattern cannot be empty.${RESET_COLOR}"
        return 1
    fi
    if [[ ! -f "$file" ]]; then
        echo -e "${ERROR_COLOR}File not found: $file${RESET_COLOR}"
        return 1
    fi
    if [[ ${#flags[@]} -gt 0 ]]; then
        grep --color=auto "${flags[@]}" "$pattern" "$file"
    else
        grep --color=auto "$pattern" "$file"
    fi
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
        local item
        IFS=',' read -ra items <<< "$I"
        local count=0
        for item in "${items[@]}"; do
            [[ -z "$item" ]] && continue
            local icon
            case "$item" in
                sword)    icon="🗡️" ;;
                amulet)   icon="📿" ;;
                coins)    icon="🪙" ;;
                diamonds) icon="💎" ;;
                goblet)   icon="🏆" ;;
                *)        icon="✦" ;;
            esac
            echo "   $icon $item"
            ((count++))
        done
        echo "   ─────────────"
        echo "   Total: $count item(s)"
    else
        echo "   (empty) — Find treasures to collect items!"
    fi
}

show_health() {
    echo -e "${SUCCESS_COLOR}❤️  HEALTH STATUS:${RESET_COLOR}"
    if [[ -n "$HP" ]]; then
        local bar_width=20
        local filled=$(( HP * bar_width / 100 ))
        (( filled > bar_width )) && filled=$bar_width
        (( filled < 0 )) && filled=0
        local empty=$(( bar_width - filled ))

        local bar_color
        if [[ $HP -gt 60 ]]; then
            bar_color="${COLOR_SUCCESS}"
        elif [[ $HP -gt 30 ]]; then
            bar_color="${COLOR_WARNING}"
        else
            bar_color="${COLOR_ERROR}"
        fi

        local bar="${bar_color}"
        local i
        for (( i=0; i<filled; i++ )); do bar+="█"; done
        for (( i=0; i<empty; i++ )); do bar+="░"; done
        bar+="${RESET_COLOR}"

        echo -e "   HP: ${bar} ${HP}/100"

        if [[ $HP -gt 80 ]]; then
            echo "   Status: Excellent condition!"
        elif [[ $HP -gt 60 ]]; then
            echo "   Status: Good condition"
        elif [[ $HP -gt 40 ]]; then
            echo "   Status: Wounded — seek potions"
        elif [[ $HP -gt 20 ]]; then
            echo -e "   Status: ${COLOR_WARNING}Badly wounded — danger!${RESET_COLOR}"
        else
            echo -e "   Status: ${COLOR_ERROR}Critical — find healing immediately!${RESET_COLOR}"
        fi
    else
        echo "   Health not initialized"
    fi
}

show_game_status() {
    echo -e "${SUCCESS_COLOR}📊 ADVENTURE STATUS${RESET_COLOR}"
    echo "─────────────────────────────────────────"
    echo -e "   ${COLOR_INFO}Location:${RESET_COLOR} $(relative_path "$(pwd)")"
    echo -e "   ${COLOR_INFO}Area:${RESET_COLOR}     $CURRENT_AREA"
    echo -e "   ${COLOR_INFO}Level:${RESET_COLOR}    $GAME_LEVEL"
    echo -e "   ${COLOR_INFO}XP:${RESET_COLOR}       $GAME_XP"
    if [[ -n "$LEARNED_COMMANDS" ]]; then
        echo -e "   ${COLOR_INFO}Skills:${RESET_COLOR}   $LEARNED_COMMANDS"
    fi
    if [[ -n "$SCROLLS_READ" ]]; then
        echo -e "   ${COLOR_INFO}Scrolls:${RESET_COLOR}  $SCROLLS_READ"
    fi
    echo ""
    show_inventory
    echo ""
    show_health
    echo ""
    render_quest_status
    echo "─────────────────────────────────────────"
}

show_map() {
    local loc
    loc=$(relative_path "$(pwd)")
    local here="${COLOR_BOLD}${COLOR_SUCCESS}"
    local r="${RESET_COLOR}"

    echo -e "${SUCCESS_COLOR}🗺️  CATACOMBS MAP${RESET_COLOR}"
    echo "─────────────────────────────────────────────────────────────────"
    echo ""

    local lob="" ent="" cel="" arm="" chm="" wks=""
    local chp="" crt="" avi="" hal="" lib="" gvy=""
    local vlt="" str="" nur="" lab="" scp="" rft=""
    local are="" pit="" spi="" mez=""

    case "$loc" in
        bashcrawl)                lob="${here}" ;;
        entrance)                 ent="${here}" ;;
        entrance/cellar)          cel="${here}" ;;
        entrance/cellar/armoury)  arm="${here}" ;;
        entrance/cellar/armoury/chamber) chm="${here}" ;;
        entrance/workshop)        wks="${here}" ;;
        entrance/chapel)          chp="${here}" ;;
        entrance/chapel/courtyard) crt="${here}" ;;
        entrance/chapel/courtyard/aviary) avi="${here}" ;;
        entrance/chapel/courtyard/aviary/hall) hal="${here}" ;;
        entrance/chapel/courtyard/aviary/hall/library) lib="${here}" ;;
        entrance/chapel/graveyard) gvy="${here}" ;;
        entrance/vault)           vlt="${here}" ;;
        entrance/vault/stronghold) str="${here}" ;;
        entrance/vault/stronghold/nursery) nur="${here}" ;;
        entrance/vault/stronghold/nursery/lab) lab="${here}" ;;
        entrance/scrap)           scp="${here}" ;;
        entrance/.rift)           rft="${here}" ;;
        entrance/.rift/arena)     are="${here}" ;;
        entrance/.rift/arena/pit) pit="${here}" ;;
        entrance/.rift/spire)     spi="${here}" ;;
        entrance/.rift/spire/mezzanine) mez="${here}" ;;
    esac

    echo -e "    ${lob}🏠 bashcrawl${r} (lobby)"
    echo -e "        └── ${ent}🚪 entrance${r}"
    echo -e "                ├── ${cel}🏰 cellar${r} → ${arm}armoury${r} → ${chm}💎 chamber${r}"
    echo -e "                ├── ${wks}🔧 workshop${r}"
    echo -e "                ├── ${chp}⛪ chapel${r} → ${crt}courtyard${r} → ${avi}aviary${r} → ${hal}hall${r} → ${lib}📚 library${r}"
    echo -e "                │       └── ${gvy}🪦 graveyard${r} → columbarium, royal-tombs"
    echo -e "                ├── ${vlt}💰 vault${r} → ${str}stronghold${r} → ${nur}nursery${r} → ${lab}lab${r}"
    echo -e "                ├── ${scp}🔗 scrap${r} (symlinks)"
    echo -e "                └── ${rft}🌀 rift${r} → ${are}arena${r} → ${pit}pit${r} | ${spi}spire${r} → ${mez}mezzanine${r}"
    echo ""
    echo -e "You are here: ${COLOR_BOLD}${loc}${RESET_COLOR}"
    echo ""
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
        "workshop")
            echo ""
            echo -e "${SUCCESS_COLOR}🔧 The workshop teaches creation: mkdir, touch, rm, echo >. Practice shaping the world!${RESET_COLOR}"
            ;;
        "cellar")
            echo ""
            echo -e "${SUCCESS_COLOR}🏰 You are in the underground cellar. Use ls -F to distinguish file types. Find the emerald!${RESET_COLOR}"
            ;;
        "armoury")
            echo ""
            echo -e "${SUCCESS_COLOR}🗡️ You have entered the armoury. Master chmod and ./script for combat!${RESET_COLOR}"
            ;;
        "chamber")
            echo ""
            echo -e "${SUCCESS_COLOR}💎 The treasure chamber! Run ./treasure, ./statue, or ./spell for rewards.${RESET_COLOR}"
            ;;
        ".chapel"|"courtyard"|"aviary"|"hall"|"library")
            echo ""
            echo -e "${SUCCESS_COLOR}⛪ Chapel path: Discover hidden commands and the ancient library tome.${RESET_COLOR}"
            ;;
        "graveyard")
            echo ""
            echo -e "${SUCCESS_COLOR}🪦 The graveyard holds secrets. Use ls -a to find the hidden mausoleum.${RESET_COLOR}"
            ;;
        ".vault"|"stronghold"|"nursery"|"lab")
            echo ""
            echo -e "${SUCCESS_COLOR}💰 Vault path: Master variables, collect the goblet to unlock the Rift!${RESET_COLOR}"
            ;;
        ".scrap")
            echo ""
            echo -e "${SUCCESS_COLOR}🔗 The Scrap teaches symlinks: ln -s creates portals. Find the path to the Rift!${RESET_COLOR}"
            ;;
        ".rift"|"arena"|"pit"|"spire"|"mezzanine")
            echo ""
            echo -e "${SUCCESS_COLOR}🌀 The Rift: Advanced challenges. Boss encounters in the Pit, secrets in the Spire!${RESET_COLOR}"
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
   cd <dir>      Change directory (move between rooms)
   ls             List contents of current room
   pwd            Show current location

FILE VIEWING:
   cat <file>     Display entire file content
   less <file>    View file with pagination
   head <file>    Show first 10 lines
   tail <file>    Show last 10 lines
   wc <file>      Count lines, words, characters
   grep <p> <f>   Search for words in scrolls

FILE OPERATIONS:
   touch <file>   Create or update a file
   mkdir <dir>    Create a new directory

GAME COMMANDS:
   inventory      Show your collected items (alias: i)
   health         Show your health status (alias: hp)
   status         Show complete game status
   map            Display catacombs map
   quest          Show current quest progress
   merlin         Receive a contextual hint
   save           Save your progress
   load           Load your saved progress
   start          Begin the adventure
   look           Examine current area
   explore        Detailed area exploration

HELP & LEARNING:
   help           Context-aware help system
   tutorial       Interactive tutorial
   commands       Show this command list

SYSTEM:
   clear          Clear the terminal screen
   history        Show command history
   reset          Reset game state
   exit           Leave the terminal emulator

GAME INTERACTIONS:
   ./treasure     Interact with treasure chests
   ./potion       Use healing potions
   ./spell        Cast magical spells
   ./monster      Engage in combat

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
    # Sync main.sh quest variables into the unified state before saving
    state_set current_location "$CURRENT_PATH"
    state_set inventory "$I"
    state_set hp "$HP"
    state_set game_level "$GAME_LEVEL"
    state_set current_quest_id "$CURRENT_QUEST_ID"
    state_set completed_quest_ids "$QUEST_COMPLETED"
    state_set learned_commands "$LEARNED_COMMANDS"
    state_set experience_points "$GAME_XP"
    state_set scrolls_read "$SCROLLS_READ"
    state_set game_started "true"
    local sc
    sc="$(state_get session_count)"
    state_set session_count "${sc:-0}"
    state_save
}

load_game_state() {
    if state_load; then
        # Map state fields to main.sh quest variables
        CURRENT_QUEST_ID="$(state_get current_quest_id)"
        QUEST_COMPLETED="$(state_get completed_quest_ids)"
        LEARNED_COMMANDS="$(state_get learned_commands)"
        GAME_XP="$(state_get experience_points)"
        SCROLLS_READ="$(state_get scrolls_read)"
        CURRENT_PATH="$(state_get current_location)"
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
    
    # Reset all state to defaults
    state_reset   # sets I, HP, GAME_LEVEL, CURRENT_AREA + writes file

    # Sync reset values back to main.sh quest variables
    CURRENT_PATH="$(state_get current_location)"
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
    
    # Clear history
    rm -f "$HISTORY_FILE"
    
    # Return to root
    cd "$BASHCRAWL_ROOT"
    
    echo "Game state has been reset. Type 'start' to begin a new adventure."
}

exit_terminal() {
    save_game_state

    echo ""
    echo -e "${SUCCESS_COLOR}╔═══════════════════════════════════════════════════════════╗${RESET_COLOR}"
    echo -e "${SUCCESS_COLOR}║              👋 Thanks for playing Bashcrawl!            ║${RESET_COLOR}"
    echo -e "${SUCCESS_COLOR}╚═══════════════════════════════════════════════════════════╝${RESET_COLOR}"
    echo ""

    echo -e "${COLOR_INFO}SESSION SUMMARY:${RESET_COLOR}"
    echo "─────────────────────────────────────────"
    echo -e "   Area reached:    ${CURRENT_AREA:-unknown}"
    echo -e "   XP earned:       ${GAME_XP:-0}"
    local quest_done=0
    if [[ -n "$QUEST_COMPLETED" ]]; then
        quest_done=$(echo "$QUEST_COMPLETED" | tr ',' '\n' | grep -c '[0-9]' || true)
    fi
    echo -e "   Quests done:     ${quest_done}/${QUEST_TOTAL}"
    if [[ -n "$I" ]]; then
        echo -e "   Inventory:       $I"
    else
        echo -e "   Inventory:       (empty)"
    fi
    echo ""

    if [[ -f "$HISTORY_FILE" ]]; then
        local cmd_count
        cmd_count=$(wc -l < "$HISTORY_FILE" | tr -d ' ')
        echo -e "${COLOR_INFO}COMMANDS USED (${cmd_count} total):${RESET_COLOR}"
        awk '{print $4}' "$HISTORY_FILE" | sort | uniq -c | sort -nr | head -10
        echo ""
    fi

    if [[ -n "$LEARNED_COMMANDS" ]]; then
        echo -e "${COLOR_INFO}SKILLS LEARNED:${RESET_COLOR}"
        echo "   $LEARNED_COMMANDS"
        echo ""
    fi

    echo "Remember: These skills work in real terminals too!"
    echo -e "Continue your journey: ${COLOR_PRIMARY}https://github.com/bamr87/bashcrawl${RESET_COLOR}"
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

    # Handle piped / redirected / compound commands via eval
    # Covers: pipes (|), redirects (> < >>>), logical operators (&& ||),
    # semicolons (;), here-strings (<<<), and function definitions
    if [[ "$input" == *"|"* ]] || [[ "$input" == *">"* ]] \
       || [[ "$input" == *"&&"* ]] || [[ "$input" == *"||"* ]] \
       || [[ "$input" == *";"* ]] || [[ "$input" == *"<<<"* ]] \
       || [[ "$input" == *" () {"* ]] || [[ "$input" == *"function "* ]]; then
        local status=0
        set +e
        eval "$input" 2>&1
        status=$?
        set -e
        save_game_state
        return $status
    fi

    # Alias expansion: check if the first word has an alias and expand it
    local -a cmd_array
    read -ra cmd_array <<< "$input"
    local first_word="${cmd_array[0]}"
    local alias_def
    alias_def=$(alias "$first_word" 2>/dev/null) || true
    if [[ -n "$alias_def" && "$alias_def" == *"='"* ]]; then
        # Extract the alias value between single quotes: alias name='value'
        local alias_value
        alias_value="${alias_def#*=\'}"
        alias_value="${alias_value%\'}"
        # Replace the first word with the expanded alias
        local rest="${input#"$first_word"}"
        input="${alias_value}${rest}"
        # Re-parse after expansion
        read -ra cmd_array <<< "$input"
    fi

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
        _dispatch_input "$input" || true   # don't let set -e kill the loop
        echo
    done
}

# ============================================================================
# GAME MODE IMPLEMENTATIONS
# ============================================================================

# ----------------------------------------------------------------------------
# Textual TUI helpers
# ----------------------------------------------------------------------------

# Returns 0 if Python 3 and the textual package are both available.
_check_tui_available() {
    command -v python3 >/dev/null 2>&1 || return 1
    python3 -c "import textual" >/dev/null 2>&1 || return 1
    local ti_dir="${BASHCRAWL_ROOT}/src/terminal-illness"
    [[ -d "$ti_dir" ]] || return 1
    return 0
}

# Launch the Textual TUI (Python). Falls back to classic mode if unavailable.
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

    # Increment session count via unified state
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

# ----------------------------------------------------------------------------
# Interactive mode — now delegates to the Textual TUI (with classic fallback).
# ----------------------------------------------------------------------------

launch_interactive_mode() {
    launch_tui_mode
}

# ----------------------------------------------------------------------------
# Classic bash-emulator interactive mode (legacy / fallback).
# ----------------------------------------------------------------------------

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

    # Increment session count via unified state
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

        _dispatch_input "$input" || true   # don't let set -e kill the loop
        echo
    done
}
# ----------------------------------------------------------------------------
# Agent mode — launches the Textual TUI headlessly with screenshot support.
# Falls back to the bash REPL agent if Python/textual are unavailable.
#   bash main.sh --agent                          # Textual TUI agent (preferred)
#   bash main.sh --agent --screenshot-dir ./shots  # custom screenshot dir
#   bash main.sh --agent-bash                      # bash-only agent REPL
# Protocol:
#   After startup and after every command, the line  READY>  is printed.
#   Send one command per line.  Meta: SCREENSHOT, STATUS, EXIT.
# ----------------------------------------------------------------------------

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

# ----------------------------------------------------------------------------
# Bash-only agent REPL (no TUI, no screenshots, line-buffered I/O).
# Designed for programmatic interaction when Python is not available.
#   bash main.sh --agent-bash           # read from stdin, write to stdout
# Protocol:
#   After startup and after every command, the line  READY>  is printed.
#   Send one command per line.  Send "exit" to quit.
# ----------------------------------------------------------------------------

launch_agent_bash_mode() {
    log_event "INFO" "Starting Bash Agent REPL mode..." "agent"

    export BASHCRAWL_MODE="agent_repl"

    cd "$BASHCRAWL_ROOT"
    touch "$HISTORY_FILE"
    load_game_state
    restore_saved_location

    # Minimal banner (no clear, no color escapes so output is easy to parse)
    echo "BASHCRAWL AGENT REPL v${VERSION}"
    echo "Location: $(pwd)"
    echo "Inventory: ${I:-<empty>}"
    echo "HP: ${HP:-100}"
    echo "Send commands one per line. Type 'exit' to quit."
    echo "READY>"

    while IFS= read -r input || [[ -n "$input" ]]; do
        # Skip blank lines
        [[ -z "$input" ]] && { echo "READY>"; continue; }

        # Exit sentinel
        if [[ "$input" == "exit" || "$input" == "quit" || "$input" == "q" ]]; then
            save_game_state
            echo "SESSION ENDED"
            echo "READY>"
            break
        fi

        # Execute command and capture output
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
    echo "   • Quest progress and XP"
    echo "   • Session history and statistics"
    echo "   • Unlocked hidden rooms (re-hidden)"
    echo "   • Combat artifacts (corpses, statue pieces)"
    echo ""
    echo -n "Are you sure you want to reset? [y/N]: "
    read -r confirmation
    
    if [[ "$confirmation" =~ ^[Yy]$ ]]; then
        # Use lib/reset.sh for comprehensive filesystem + state reset
        if [[ -f "${BASHCRAWL_ROOT}/lib/reset.sh" ]]; then
            bash "${BASHCRAWL_ROOT}/lib/reset.sh"
            log_event "SUCCESS" "Game state has been reset via lib/reset.sh" "reset"
        else
            # Fallback: basic reset via state library
            log_event "WARNING" "lib/reset.sh not found, performing basic reset" "reset"
            state_reset
        fi
        
        # Reinitialize from the freshly-reset (or newly-created) state file
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
        # shellcheck source=/dev/null

        # shellcheck source=/dev/null
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
        echo -e "  ${COLOR_DIM}8)${COLOR_RESET} Exit"
        echo ""
        echo -n "Choose an option (1-8): "

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
            *)
                echo -e "${COLOR_ERROR}Invalid choice. Please select 1-8.${COLOR_RESET}"
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
    $SCRIPT_NAME --agent                       # Agent mode with Textual + screenshots
    $SCRIPT_NAME --agent-bash                  # Bash-only agent REPL (no Python)

${COLOR_PRIMARY}GAME MODES:${COLOR_RESET}
    ${COLOR_SUCCESS}Textual TUI:${COLOR_RESET}      Visual panels, quest tracker, tab completion (Python 3 + textual)
    ${COLOR_INFO}Classic Mode:${COLOR_RESET}    Safe bash emulator — no Python required
    ${COLOR_WARNING}Native Mode:${COLOR_RESET}     Uses your actual terminal (requires experience)
    ${COLOR_INFO}Agent Mode:${COLOR_RESET}      Headless Textual TUI with screenshots for AI agents
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
    
    if [[ -f "$GAME_STATE_FILE" ]]; then
        # shellcheck source=/dev/null

        # shellcheck source=/dev/null
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
