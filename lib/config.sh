#!/usr/bin/env bash
# ============================================================================
# Bashcrawl Shared Configuration — lib/config.sh
#
# Centralizes path definitions and project-wide constants used by both
# main.sh and setup.sh (and any other infrastructure scripts).
#
# Usage:
#   source "${BASHCRAWL_ROOT}/lib/config.sh"
# ============================================================================

# Guard: only load once per shell process
[[ "${_BC_CONFIG_LOADED:-}" == "$$" ]] && return 0
_BC_CONFIG_LOADED="$$"

# ============================================================================
# RESOLVE GAME ROOT
# ============================================================================

if [[ -z "${BASHCRAWL_ROOT:-}" ]]; then
    _bc_config_self="${BASH_SOURCE[0]:-$0}"
    if [[ -f "$_bc_config_self" ]]; then
        BASHCRAWL_ROOT="$(cd "$(dirname "$_bc_config_self")/.." 2>/dev/null && pwd)"
    fi
fi

# ============================================================================
# VERSION
# ============================================================================

if [[ -f "${BASHCRAWL_ROOT}/VERSION" ]]; then
    BASHCRAWL_VERSION="$(< "${BASHCRAWL_ROOT}/VERSION")"
    BASHCRAWL_VERSION="${BASHCRAWL_VERSION%$'\n'}"
else
    BASHCRAWL_VERSION="0.0.0-unknown"
fi

# ============================================================================
# DIRECTORY PATHS
# ============================================================================

GAME_DATA_DIR="${BASHCRAWL_ROOT}/.game_data"
LOG_DIR="${BASHCRAWL_ROOT}/logs"
SESSION_LOG_DIR="${LOG_DIR}/sessions"
SCREENSHOT_DIR="${LOG_DIR}/screenshots"
HELP_DIR="${BASHCRAWL_ROOT}/src/help"
TI_DIR="${BASHCRAWL_ROOT}/src/terminal-illness"
ENTRANCE_DIR="${BASHCRAWL_ROOT}/entrance"

# ============================================================================
# FILE PATHS
# ============================================================================

STATE_FILE="${BASHCRAWL_ROOT}/.bashcrawl_save.json"
COMMAND_HISTORY_FILE="${GAME_DATA_DIR}/command_history"
SETUP_LOG_FILE="${LOG_DIR}/setup.log"
SETUP_MARKER="${BASHCRAWL_ROOT}/.setup_complete"
