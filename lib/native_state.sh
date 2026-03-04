#!/usr/bin/env bash
# ============================================================================
# Bashcrawl Native-Play State Helper — lib/native_state.sh
#
# Opt-in state persistence for native play (cd entrance && cat scroll).
# Source this file to enable save/load in your current shell:
#
#   source lib/native_state.sh
#
# Provides:
#   save_game   — persist current I, HP and location to .bashcrawl_save.json
#   load_game   — restore state from .bashcrawl_save.json
#   game_status — show current inventory, HP, and quest progress
#
# This is entirely optional. The game works without it — env vars set by
# game scripts (export I=..., export HP=...) are sufficient within a
# single shell session.
# ============================================================================

# Locate game root (from this script or the current directory)
if [[ -z "${BASHCRAWL_ROOT:-}" ]]; then
    _ns_self="${BASH_SOURCE[0]:-$0}"
    if [[ -f "$_ns_self" ]]; then
        BASHCRAWL_ROOT="$(cd "$(dirname "$_ns_self")/.." 2>/dev/null && pwd)"
    else
        # Walk up from cwd
        _ns_d="$PWD"
        while [[ "$_ns_d" != "/" ]]; do
            if [[ -d "$_ns_d/entrance" && -f "$_ns_d/main.sh" ]]; then
                BASHCRAWL_ROOT="$_ns_d"
                break
            fi
            _ns_d="$(dirname "$_ns_d")"
        done
    fi
fi
export BASHCRAWL_ROOT

# Load the state library
if [[ ! -f "${BASHCRAWL_ROOT}/lib/state.sh" ]]; then
    echo "[native_state] ERROR: Cannot find lib/state.sh in $BASHCRAWL_ROOT" >&2
    # shellcheck disable=SC2317  # exit 1 is reachable when not sourced inside a function
    return 1 2>/dev/null || exit 1
fi
# shellcheck source=lib/state.sh
source "${BASHCRAWL_ROOT}/lib/state.sh"

# Initialise + load (creates file with defaults if first time)
state_init
state_load || true

# ---- Public functions ---------------------------------------------------

save_game() {
    # Snapshot current location relative to game root
    local loc="$PWD"
    if [[ "$loc" == "$BASHCRAWL_ROOT"* ]]; then
        loc="${loc#"$BASHCRAWL_ROOT"/}"
        [[ -z "$loc" || "$loc" == "$BASHCRAWL_ROOT" ]] && loc="entrance"
    fi
    state_set current_location "$loc"
    state_set inventory "${I:-}"
    state_set hp "${HP:-100}"
    state_save
    echo "Game saved. ($(state_file))"
}

load_game() {
    if state_load; then
        echo "Game loaded: HP=$HP  Inventory=${I:-<empty>}  Location=$(state_get current_location)"
    else
        echo "No saved game found. Starting fresh."
        state_init
        state_load || true
    fi
}

game_status() {
    echo "──────────────── Game Status ────────────────"
    echo "  HP:        ${HP:-100}"
    echo "  Inventory: ${I:-<empty>}"
    echo "  Location:  $(state_get current_location)"
    echo "  Quest:     #$(state_get current_quest_id)"
    echo "  XP:        $(state_get experience_points)"
    echo "─────────────────────────────────────────────"
}

echo "Native state helper loaded. Commands: save_game, load_game, game_status"
