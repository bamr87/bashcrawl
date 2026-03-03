#!/usr/bin/env bash
# ============================================================================
# Bashcrawl State Management — lib/state.sh
#
# Unified JSON state persistence for Bashcrawl game.
# Both the Bash emulator and the Python TUI read/write the same
# `.bashcrawl_save.json` file so progress carries across modes.
#
# Public functions:
#   state_init     — Create state file with defaults if it doesn't exist
#   state_save     — Write current in-memory state to file
#   state_load     — Load state from file into memory + env
#   state_reset    — Restore all defaults and rewrite the file
#   state_get KEY  — Echo the value of a state field
#   state_set K V  — Set a field and update env if applicable
#
# Dependencies: date, sed, grep (standard POSIX tools, no jq)
# Compatibility: bash ≥ 3.2 (macOS default)
# ============================================================================

# Guard: only load once per shell process
[[ "${_BC_STATE_LOADED:-}" == "$$" ]] && return 0
_BC_STATE_LOADED="$$"

# ============================================================================
# RESOLVE GAME ROOT
# ============================================================================

if [[ -z "${BASHCRAWL_ROOT:-}" ]]; then
    _bc_state_self="${BASH_SOURCE[0]:-$0}"
    if [[ -f "$_bc_state_self" ]]; then
        BASHCRAWL_ROOT="$(cd "$(dirname "$_bc_state_self")/.." 2>/dev/null && pwd)"
    fi
fi

# ============================================================================
# CONFIGURATION
# ============================================================================

# Single canonical save-file name used by both Bash and Python
_BC_STATE_FILE="${BASHCRAWL_ROOT:-.}/.bashcrawl_save.json"

# --- Schema: field names + defaults (bash 3.2 — no associative arrays) -----
# Keep STATE_KEYS in sync with the STATE_DEFAULT_* variables below.
STATE_KEYS="current_quest_id completed_quest_ids learned_commands current_location inventory hp experience_points game_level game_started session_count last_session scrolls_read mode player_name"

STATE_DEFAULT_current_quest_id=0
STATE_DEFAULT_completed_quest_ids=""
STATE_DEFAULT_learned_commands=""
STATE_DEFAULT_current_location="entrance"
STATE_DEFAULT_inventory=""
STATE_DEFAULT_hp=100
STATE_DEFAULT_experience_points=0
STATE_DEFAULT_game_level="novice"
STATE_DEFAULT_game_started="false"
STATE_DEFAULT_session_count=0
STATE_DEFAULT_last_session=""
STATE_DEFAULT_scrolls_read=""
STATE_DEFAULT_mode="classic"
STATE_DEFAULT_player_name=""

# Integer-typed fields (written without JSON quotes)
_BC_STATE_INT_FIELDS=" current_quest_id hp experience_points session_count "

# ============================================================================
# INTERNAL HELPERS
# ============================================================================

# _state_is_int FIELD — return 0 if the field should be written as a number
_state_is_int() {
    [[ "$_BC_STATE_INT_FIELDS" == *" $1 "* ]]
}

# _state_json_escape STRING — escape backslashes and double-quotes
_state_json_escape() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    printf '%s' "$s"
}

# _state_build_json — write pretty-printed JSON for all STATE_* vars to stdout
_state_build_json() {
    local key val escaped first=true
    echo "{"
    for key in $STATE_KEYS; do
        if $first; then first=false; else echo ","; fi
        eval "val=\"\${STATE_$key:-}\""
        if _state_is_int "$key"; then
            # Ensure numeric (fall back to default if empty/non-numeric)
            if ! [[ "$val" =~ ^-?[0-9]+$ ]]; then
                eval "val=\"\${STATE_DEFAULT_$key}\""
            fi
            printf '  "%s": %s' "$key" "$val"
        else
            escaped="$(_state_json_escape "$val")"
            printf '  "%s": "%s"' "$key" "$escaped"
        fi
    done
    echo ""
    echo "}"
}

# _state_extract CONTENT FIELD — extract a field's value from a JSON string
_state_extract() {
    local content="$1" field="$2"
    local result
    # Try quoted string first
    result=$(printf '%s' "$content" | sed -n "s/.*\"${field}\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p")
    if [[ -z "$result" ]]; then
        # Try unquoted number
        result=$(printf '%s' "$content" | sed -n "s/.*\"${field}\"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p")
    fi
    printf '%s' "$result"
}

# _state_sync_env — export game-critical vars to env ($I, $HP, etc.)
_state_sync_env() {
    export I="${STATE_inventory:-}"
    export HP="${STATE_hp:-100}"
    export GAME_LEVEL="${STATE_game_level:-novice}"
    export CURRENT_AREA="${STATE_current_location:-entrance}"
}

# ============================================================================
# MIGRATION: legacy files → .bashcrawl_save.json
# ============================================================================

_state_migrate_legacy_game_state() {
    local legacy="${BASHCRAWL_ROOT:-.}/.game_state"
    [[ -f "$legacy" ]] || return 0
    [[ -f "$_BC_STATE_FILE" ]] && return 0   # already migrated

    # Source the shell-format file (disable strict mode; vars may be unset)
    local _save_u=false
    [[ -o nounset ]] && _save_u=true && set +u
    # shellcheck disable=SC1090
    source "$legacy" 2>/dev/null || true

    # Map both naming conventions (PLAYER_* and emulator names)
    STATE_current_quest_id="${CURRENT_QUEST_ID:-0}"
    STATE_completed_quest_ids="${QUEST_COMPLETED:-}"
    STATE_learned_commands="${LEARNED_COMMANDS:-}"
    STATE_current_location="${CURRENT_AREA:-${CURRENT_PATH:-entrance}}"
    STATE_inventory="${INVENTORY:-${PLAYER_INVENTORY:-${I:-}}}"
    STATE_hp="${HEALTH:-${PLAYER_HEALTH:-${HP:-100}}}"
    STATE_experience_points="${GAME_XP:-0}"
    STATE_game_level="${GAME_LEVEL:-${PLAYER_LEVEL:-novice}}"
    STATE_game_started="${GAME_STARTED:-false}"
    STATE_session_count="${SESSION_COUNT:-0}"
    STATE_last_session="${LAST_SESSION:-}"
    STATE_scrolls_read="${SCROLLS_READ:-}"
    STATE_mode="classic"
    STATE_player_name=""

    $_save_u && set -u
    state_save   # writes _BC_STATE_FILE
    # Leave legacy file — reset.sh cleans it up
}

_state_migrate_legacy_ti_save() {
    local legacy="${BASHCRAWL_ROOT:-.}/.ti_save.json"
    [[ -f "$legacy" ]] || return 0
    [[ -f "$_BC_STATE_FILE" ]] && return 0

    # .ti_save.json is already compatible JSON — just copy it
    cp "$legacy" "$_BC_STATE_FILE"
    # Leave legacy file — reset.sh cleans it up
}

# ============================================================================
# PUBLIC API
# ============================================================================

# state_init — create the save file with defaults if missing.
#              Runs legacy migration first.
state_init() {
    # Try migrations before creating a blank file
    _state_migrate_legacy_game_state
    _state_migrate_legacy_ti_save

    [[ -f "$_BC_STATE_FILE" ]] && return 0

    # Set all STATE_* vars to defaults
    local key
    for key in $STATE_KEYS; do
        eval "STATE_$key=\"\${STATE_DEFAULT_$key}\""
    done

    STATE_last_session="$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')"
    state_save
}

# state_save — write all STATE_* variables to the JSON file
state_save() {
    # Ensure STATE_* vars exist (use defaults for any missing)
    local key
    for key in $STATE_KEYS; do
        eval ": \"\${STATE_$key:=\${STATE_DEFAULT_$key}}\""
    done

    STATE_last_session="$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')"
    _state_build_json > "$_BC_STATE_FILE"
}

# state_load — read the save file into STATE_* variables + export to env.
#              Returns 1 if no save file exists (call state_init first).
state_load() {
    [[ -f "$_BC_STATE_FILE" ]] || return 1

    local content key val
    content="$(cat "$_BC_STATE_FILE")"

    for key in $STATE_KEYS; do
        val="$(_state_extract "$content" "$key")"
        if [[ -z "$val" ]]; then
            eval "val=\"\${STATE_DEFAULT_$key}\""
        fi
        eval "STATE_$key=\"\$val\""
    done

    # Normalise location: strip leading / (Python writes "/entrance", Bash wants "entrance")
    STATE_current_location="${STATE_current_location#/}"
    [[ -z "$STATE_current_location" ]] && STATE_current_location="entrance"

    _state_sync_env
    return 0
}

# state_reset — restore every field to its default and rewrite the file
state_reset() {
    local key
    for key in $STATE_KEYS; do
        eval "STATE_$key=\"\${STATE_DEFAULT_$key}\""
    done
    _state_sync_env
    state_save
}

# state_get KEY — print the current value of a field
state_get() {
    local key="$1"
    eval "echo \"\${STATE_$key:-\${STATE_DEFAULT_$key:-}}\""
}

# state_set KEY VALUE — update a field in memory (call state_save to persist)
state_set() {
    local key="$1" value="$2"
    eval "STATE_$key=\"\$value\""

    # Keep env in sync for the most-used vars
    case "$key" in
        inventory)         export I="$value" ;;
        hp)                export HP="$value" ;;
        game_level)        export GAME_LEVEL="$value" ;;
        current_location)  export CURRENT_AREA="$value" ;;
    esac
}

# state_file — echo the path to the active save file (useful for callers)
state_file() {
    echo "$_BC_STATE_FILE"
}
