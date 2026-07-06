#!/usr/bin/env bash
# ============================================================================
# Bashcrawl Logging Framework — lib/log.sh
# Unified telemetry for gameplay sessions.
#
# Usage:
#   source lib/log.sh              # from game root
#   source lib/log.sh && bc_install_hooks   # enable room tracking
#
# All functions are no-ops when BASHCRAWL_LOG=off.
# Designed for graceful degradation — game works without this file.
# ============================================================================

# Guard: only load once per shell (not exported, so child shells re-source)
[[ "${_BC_LOG_LOADED:-}" == "$$" ]] && return 0
_BC_LOG_LOADED="$$"

# ---------------------------------------------------------------------------
# Resolve game root (works from any depth inside the game tree)
# ---------------------------------------------------------------------------
if [[ -z "$BASHCRAWL_ROOT" ]]; then
    # Try relative to this script
    _bc_self="${BASH_SOURCE[0]:-$0}"
    if [[ -f "$_bc_self" ]]; then
        BASHCRAWL_ROOT="$(cd "$(dirname "$_bc_self")/.." 2>/dev/null && pwd)"
    fi
    # Fallback: walk up from cwd looking for entrance/
    if [[ ! -d "${BASHCRAWL_ROOT}/entrance" ]]; then
        _bc_d="$PWD"
        while [[ "$_bc_d" != "/" ]]; do
            if [[ -d "$_bc_d/entrance" && -f "$_bc_d/help.sh" ]]; then
                BASHCRAWL_ROOT="$_bc_d"
                break
            fi
            _bc_d="$(dirname "$_bc_d")"
        done
    fi
fi

_BC_LOG_DIR="${BASHCRAWL_ROOT}/logs/sessions"
_BC_SESSION_ID=""
_BC_SESSION_FILE=""
_BC_SESSION_START=""
_BC_LAST_DIR=""
_BC_ROOMS_VISITED=0
_BC_ENCOUNTER_COUNT=0
_BC_DEATH_COUNT=0
_BC_HELP_COUNT=0
_BC_SCREENSHOT_COUNT=0

# ---------------------------------------------------------------------------
# bc_log <event_type> [key=value ...]
#
# Appends one JSONL line. Auto-includes: ts, sid, event, room, inventory, hp.
# Extra key=value args become additional JSON fields.
# ---------------------------------------------------------------------------
bc_log() {
    # Opt-out check
    [[ "${BASHCRAWL_LOG:-}" == "off" ]] && return 0

    # Auto-start session if needed
    if [[ -z "$_BC_SESSION_ID" ]]; then
        bc_session_start "auto"
    fi

    local event_type="$1"; shift
    local ts
    ts="$(date '+%Y-%m-%dT%H:%M:%S' 2>/dev/null || date '+%Y-%m-%d %H:%M:%S')"

    # Extract room from cwd
    local room=""
    if [[ "$PWD" == *"/entrance"* ]]; then
        room="${PWD##*entrance}"
        room="${room#/}"
        [[ -z "$room" ]] && room="entrance"
    elif [[ "$PWD" == *"/entrance" ]]; then
        room="entrance"
    fi

    # Build JSON line via string concatenation (no jq dependency)
    local line="{\"ts\":\"${ts}\",\"sid\":\"${_BC_SESSION_ID}\",\"event\":\"${event_type}\""

    # Add room if available
    [[ -n "$room" ]] && line="${line},\"room\":\"${room}\""

    # Add inventory and hp snapshots
    [[ -n "${I:-}" ]] && line="${line},\"inventory\":\"${I}\""
    [[ -n "${HP:-}" ]] && line="${line},\"hp\":${HP}"

    # Append extra key=value pairs
    local kv
    for kv in "$@"; do
        local key="${kv%%=*}"
        local val="${kv#*=}"
        # Try to detect numeric values
        if [[ "$val" =~ ^-?[0-9]+$ ]]; then
            line="${line},\"${key}\":${val}"
        else
            # Escape quotes in value
            val="${val//\"/\\\"}"
            line="${line},\"${key}\":\"${val}\""
        fi
    done

    line="${line}}"

    # Write to session file
    echo "$line" >> "$_BC_SESSION_FILE" 2>/dev/null

    # Track counters
    case "$event_type" in
        room_enter) _BC_ROOMS_VISITED=$((_BC_ROOMS_VISITED + 1)) ;;
        encounter)  _BC_ENCOUNTER_COUNT=$((_BC_ENCOUNTER_COUNT + 1)) ;;
        death)      _BC_DEATH_COUNT=$((_BC_DEATH_COUNT + 1)) ;;
        help_request) _BC_HELP_COUNT=$((_BC_HELP_COUNT + 1)) ;;
        screenshot) _BC_SCREENSHOT_COUNT=$((_BC_SCREENSHOT_COUNT + 1)) ;;
    esac
}

# ---------------------------------------------------------------------------
# bc_session_start [mode]
# Creates session file, writes session_start event.
# ---------------------------------------------------------------------------
bc_session_start() {
    [[ "${BASHCRAWL_LOG:-}" == "off" ]] && return 0
    [[ -n "$_BC_SESSION_ID" ]] && return 0  # already started

    local mode="${1:-manual}"

    # Generate session ID from PID + timestamp
    _BC_SESSION_ID="$$$(date +%s 2>/dev/null || echo 0)"
    _BC_SESSION_ID="${_BC_SESSION_ID: -8}"

    _BC_SESSION_START="$(date +%s 2>/dev/null || echo 0)"

    # Ensure directory exists
    mkdir -p "$_BC_LOG_DIR" 2>/dev/null

    local datestamp
    datestamp="$(date '+%Y-%m-%d' 2>/dev/null || echo 'unknown')"
    _BC_SESSION_FILE="${_BC_LOG_DIR}/${datestamp}_${_BC_SESSION_ID}.jsonl"

    # Reset counters
    _BC_ROOMS_VISITED=0
    _BC_ENCOUNTER_COUNT=0
    _BC_DEATH_COUNT=0
    _BC_HELP_COUNT=0
    _BC_SCREENSHOT_COUNT=0

    local ts
    ts="$(date '+%Y-%m-%dT%H:%M:%S' 2>/dev/null || date '+%Y-%m-%d %H:%M:%S')"

    local shell_ver="${BASH_VERSION:-unknown}"
    local os_name="$(uname -s 2>/dev/null || echo unknown)"
    local term_type="${TERM:-unknown}"

    echo "{\"ts\":\"${ts}\",\"sid\":\"${_BC_SESSION_ID}\",\"event\":\"session_start\",\"mode\":\"${mode}\",\"shell\":\"bash-${shell_ver}\",\"os\":\"${os_name}\",\"term\":\"${term_type}\"}" \
        >> "$_BC_SESSION_FILE" 2>/dev/null

    # Install exit trap for session_end (preserve existing traps)
    trap '_bc_on_exit' EXIT
}

# ---------------------------------------------------------------------------
# bc_session_end
# Writes session_end event with summary metrics.
# ---------------------------------------------------------------------------
bc_session_end() {
    [[ -z "$_BC_SESSION_ID" ]] && return 0
    [[ "${BASHCRAWL_LOG:-}" == "off" ]] && return 0

    local ts
    ts="$(date '+%Y-%m-%dT%H:%M:%S' 2>/dev/null || date '+%Y-%m-%d %H:%M:%S')"

    local duration=0
    local now
    now="$(date +%s 2>/dev/null || echo 0)"
    if [[ "$_BC_SESSION_START" -gt 0 && "$now" -gt 0 ]]; then
        duration=$(( now - _BC_SESSION_START ))
    fi

    echo "{\"ts\":\"${ts}\",\"sid\":\"${_BC_SESSION_ID}\",\"event\":\"session_end\",\"duration_sec\":${duration},\"rooms_visited\":${_BC_ROOMS_VISITED},\"encounters\":${_BC_ENCOUNTER_COUNT},\"deaths\":${_BC_DEATH_COUNT},\"help_requests\":${_BC_HELP_COUNT},\"screenshots_captured\":${_BC_SCREENSHOT_COUNT}}" \
        >> "$_BC_SESSION_FILE" 2>/dev/null

    _BC_SESSION_ID=""
}

# Internal exit handler
_bc_on_exit() {
    bc_session_end
}

# ---------------------------------------------------------------------------
# bc_log_screenshot <path> [trigger=auto] [command=...]
#
# Logs a screenshot event with the file path, trigger type, and optional
# command context.  Also records file size if the file exists.
# ---------------------------------------------------------------------------
bc_log_screenshot() {
    [[ "${BASHCRAWL_LOG:-}" == "off" ]] && return 0

    local path="${1:?bc_log_screenshot requires a path}"
    local trigger="${2:-auto}"
    local command="${3:-}"

    local extra_args=("screenshot_path=${path}" "trigger=${trigger}")
    [[ -n "$command" ]] && extra_args+=("command=${command}")

    # Record file size if the file exists
    if [[ -f "$path" ]]; then
        local size
        # macOS stat vs GNU stat
        if stat -f%z "$path" >/dev/null 2>&1; then
            size="$(stat -f%z "$path")"
        else
            size="$(stat --printf='%s' "$path" 2>/dev/null || echo 0)"
        fi
        extra_args+=("size_bytes=${size}")
    fi

    bc_log screenshot "${extra_args[@]}"
}

# ---------------------------------------------------------------------------
# bc_install_hooks
# Sets up PROMPT_COMMAND (bash) or chpwd (zsh) to track room navigation.
# ---------------------------------------------------------------------------
bc_install_hooks() {
    [[ "${BASHCRAWL_LOG:-}" == "off" ]] && return 0

    _BC_LAST_DIR=""

    if [[ -n "${ZSH_VERSION:-}" ]]; then
        # Zsh: use chpwd hook
        _bc_track_room() {
            _bc_check_room_change
        }
        autoload -Uz add-zsh-hook 2>/dev/null
        add-zsh-hook chpwd _bc_track_room 2>/dev/null || {
            # Fallback if add-zsh-hook unavailable
            chpwd_functions=("${chpwd_functions[@]}" "_bc_track_room")
        }
    else
        # Bash: use PROMPT_COMMAND
        if [[ -z "$PROMPT_COMMAND" ]]; then
            PROMPT_COMMAND="_bc_check_room_change"
        elif [[ "$PROMPT_COMMAND" != *"_bc_check_room_change"* ]]; then
            PROMPT_COMMAND="_bc_check_room_change;${PROMPT_COMMAND}"
        fi
    fi
}

# Room change detector (called by hook)
_bc_check_room_change() {
    local current_dir="$PWD"

    # Only track inside the game tree
    [[ "$current_dir" == *"/entrance"* || "$current_dir" == *"/entrance" ]] || return 0

    # Only log if directory actually changed
    [[ "$current_dir" == "$_BC_LAST_DIR" ]] && return 0
    _BC_LAST_DIR="$current_dir"

    # Extract relative room path
    local room="${current_dir##*entrance}"
    room="${room#/}"
    [[ -z "$room" ]] && room="entrance"

    bc_log room_enter room="$room"
}

# ---------------------------------------------------------------------------
# Export functions so subshells and game executables can use them
# ---------------------------------------------------------------------------
export -f bc_log bc_log_screenshot bc_session_start bc_session_end bc_install_hooks _bc_check_room_change _bc_on_exit 2>/dev/null

# Export state variables
export _BC_LOG_DIR _BC_SESSION_ID _BC_SESSION_FILE _BC_SESSION_START
export _BC_LAST_DIR _BC_ROOMS_VISITED _BC_ENCOUNTER_COUNT _BC_DEATH_COUNT _BC_HELP_COUNT _BC_SCREENSHOT_COUNT
export BASHCRAWL_ROOT
