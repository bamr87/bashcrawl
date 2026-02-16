#!/usr/bin/env bash
# ============================================================================
# Bashcrawl Shared Color Constants — lib/colors.sh
#
# Source this file from any infrastructure script to get consistent colors.
# Game executables (treasure, potion, etc.) should NOT source this —
# they use plain text output by convention.
#
# Usage:
#   source "${BASHCRAWL_ROOT}/lib/colors.sh"
#   echo -e "${COLOR_SUCCESS}Done!${COLOR_RESET}"
# ============================================================================

# Guard: only define once per shell
[[ "${_BC_COLORS_LOADED:-}" == "true" ]] && return 0
_BC_COLORS_LOADED="true"

# Primary palette — use $'...' so variables hold real escape bytes
# Works with echo, printf, cat heredocs, etc. (no need for echo -e)
readonly COLOR_PRIMARY=$'\033[0;36m'     # Cyan
readonly COLOR_SECONDARY=$'\033[0;35m'   # Purple
readonly COLOR_SUCCESS=$'\033[0;32m'     # Green
readonly COLOR_WARNING=$'\033[0;33m'     # Yellow
readonly COLOR_ERROR=$'\033[0;31m'       # Red
readonly COLOR_INFO=$'\033[0;34m'        # Blue
readonly COLOR_BOLD=$'\033[1m'           # Bold
readonly COLOR_DIM=$'\033[2m'            # Dim
readonly COLOR_RESET=$'\033[0m'          # Reset
