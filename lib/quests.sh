#!/usr/bin/env bash
# ============================================================================
# Bashcrawl Quest System — lib/quests.sh
#
# Quest progression data, state helpers, and persistence functions.
# Extracted from main.sh to keep the launcher thin.
#
# Expects the following to be set before sourcing:
#   BASHCRAWL_ROOT, SUCCESS_COLOR, ERROR_COLOR, RESET_COLOR, COLOR_INFO,
#   PROMPT_COLOR, HISTORY_FILE, and lib/state.sh already sourced.
# ============================================================================

[[ "${_BC_QUESTS_LOADED:-}" == "$$" ]] && return 0
_BC_QUESTS_LOADED="$$"

# ============================================================================
# QUEST PROGRESSION DATA (loaded from registry or hardcoded fallback)
# ============================================================================

declare -a QUEST_TITLES QUEST_OBJECTIVES QUEST_HINTS
declare -a QUEST_REQUIRED_COMMAND QUEST_TARGET_CONTEXT
declare -a QUEST_REWARDS QUEST_REWARD_XP

_load_quest_arrays() {
    # Prefer YAML-loaded registry data (from room_loader.sh)
    # Uses _reg_get accessor (bash 3.2 compatible) instead of associative arrays
    if [[ ${#QUEST_IDS[@]} -gt 0 ]] && type -t _reg_get &>/dev/null; then
        local _test_title
        _test_title=$(_reg_get "_REG_QUEST_0_title")
        if [[ -n "$_test_title" ]]; then
            local qid
            QUEST_TITLES=()
            QUEST_OBJECTIVES=()
            QUEST_HINTS=()
            QUEST_REQUIRED_COMMAND=()
            QUEST_TARGET_CONTEXT=()
            QUEST_REWARDS=()
            QUEST_REWARD_XP=()
            for qid in "${QUEST_IDS[@]}"; do
                QUEST_TITLES+=("$(_reg_get "_REG_QUEST_${qid}_title")")
                QUEST_OBJECTIVES+=("$(_reg_get "_REG_QUEST_${qid}_obj")")
                QUEST_HINTS+=("$(_reg_get "_REG_QUEST_${qid}_hint")")
                local cmd_csv
                cmd_csv=$(_reg_get "_REG_QUEST_${qid}_cmds")
                QUEST_REQUIRED_COMMAND+=("${cmd_csv%%,*}")
                QUEST_TARGET_CONTEXT+=("$(_reg_get "_REG_QUEST_${qid}_comp_loc")")
                QUEST_REWARDS+=("$(_reg_get "_REG_QUEST_${qid}_reward")")
                QUEST_REWARD_XP+=("$(_reg_get "_REG_QUEST_${qid}_xp")")
            done
            return 0
        fi
    fi

    # Hardcoded fallback if registry not loaded
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
    QUEST_TARGET_CONTEXT=("" "" "cellar" "" "" "" "armoury|cellar" "study|help")
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
}

_load_quest_arrays

QUEST_TOTAL=${#QUEST_TITLES[@]}

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
# CSV HELPERS
# ============================================================================

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

# ============================================================================
# QUEST STATUS AND PROGRESSION
# ============================================================================

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

    # ── Generic data-driven evaluator ──────────────────────────────────
    # Uses quest_comp_* accessor functions from room_loader.sh when
    # available, otherwise falls back to QUEST_TARGET_CONTEXT parallel array.

    local comp_cmd="" comp_loc="" comp_args="" comp_item=""
    if type -t quest_comp_cmd &>/dev/null; then
        comp_cmd="$(quest_comp_cmd "$qid")"
        comp_loc="$(quest_comp_loc "$qid")"
        comp_args="$(quest_comp_args "$qid")"
        comp_item="$(quest_comp_item "$qid")"
    fi
    # Fall back to parallel array for location if accessor returned empty
    if [[ -z "$comp_loc" ]]; then
        comp_loc="${QUEST_TARGET_CONTEXT[$qid]:-}"
    fi

    # 1. Command must match
    if [[ -n "$comp_cmd" ]]; then
        [[ "$LAST_COMMAND" == "$comp_cmd" ]] || return
    fi

    # 2. Location check (pipe-separated list — match any)
    if [[ -n "$comp_loc" ]]; then
        local current_rel
        current_rel="$(relative_path "$LAST_RESULT_DIR")"
        local loc_match=false
        local _loc
        IFS='|' read -ra _locs <<< "$comp_loc"
        for _loc in "${_locs[@]}"; do
            if [[ "$current_rel" == *"$_loc"* ]]; then
                loc_match=true
                break
            fi
        done
        [[ "$loc_match" == true ]] || return
    fi

    # 3. Args check (first positional argument must match)
    if [[ -n "$comp_args" ]]; then
        local -a __last_args
        read -ra __last_args <<< "$LAST_ARGS"
        local first_arg="${__last_args[0]:-}"
        # Skip flags like -p
        if [[ "$first_arg" == -* && ${#__last_args[@]} -gt 1 ]]; then
            first_arg="${__last_args[1]:-}"
        fi
        [[ "$first_arg" == "$comp_args" ]] || return
    fi

    # 4. Item check (comma-separated items that must be in inventory)
    if [[ -n "$comp_item" ]]; then
        local _item
        IFS=',' read -ra _items <<< "$comp_item"
        for _item in "${_items[@]}"; do
            csv_contains "$I" "$_item" || return
        done
    fi

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
    if ! type -t state_get &>/dev/null; then
        echo -e "${ERROR_COLOR}No saved progress found.${RESET_COLOR}"
        return 1
    fi
    load_game_state
    restore_saved_location
    echo -e "${SUCCESS_COLOR}📂 Progress loaded.${RESET_COLOR}"
    render_quest_status
}

# ============================================================================
# GAME STATE PERSISTENCE
# ============================================================================

initialize_game_state() {
    state_init
    state_load || true
    CURRENT_QUEST_ID="$(state_get current_quest_id)"
    QUEST_COMPLETED="$(state_get completed_quest_ids)"
    LEARNED_COMMANDS="$(state_get learned_commands)"
    GAME_XP="$(state_get experience_points)"
    SCROLLS_READ="$(state_get scrolls_read)"
    CURRENT_PATH="$(state_get current_location)"
}

save_game_state() {
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
        CURRENT_QUEST_ID="$(state_get current_quest_id)"
        QUEST_COMPLETED="$(state_get completed_quest_ids)"
        LEARNED_COMMANDS="$(state_get learned_commands)"
        GAME_XP="$(state_get experience_points)"
        SCROLLS_READ="$(state_get scrolls_read)"
        CURRENT_PATH="$(state_get current_location)"
    fi
}

update_current_area() {
    local current_dir
    current_dir=$(basename "$(pwd)")
    CURRENT_AREA="$current_dir"
    CURRENT_PATH="$(relative_path "$(pwd)")"
    save_game_state
}

mark_scroll_read() {
    local area
    area=$(basename "$(pwd)")
    SCROLLS_READ="$(csv_add "$SCROLLS_READ" "$area")"
    save_game_state
}

restore_saved_location() {
    local rel="${CURRENT_PATH:-bashcrawl}"
    if [[ "$rel" == "bashcrawl" ]]; then
        cd "$BASHCRAWL_ROOT" || return
    elif [[ -d "$BASHCRAWL_ROOT/$rel" ]]; then
        cd "$BASHCRAWL_ROOT/$rel" || return
    else
        cd "$BASHCRAWL_ROOT" || return
        rel="bashcrawl"
    fi
    CURRENT_PATH="$rel"
    update_current_area
}

reset_terminal_state() {
    echo -e "${SUCCESS_COLOR}🔄 RESETTING GAME STATE...${RESET_COLOR}"

    state_reset

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

    rm -f "$HISTORY_FILE"

    cd "$BASHCRAWL_ROOT" || return

    echo "Game state has been reset. Type 'start' to begin a new adventure."
}
