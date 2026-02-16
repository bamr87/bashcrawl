#!/usr/bin/env bash
#
# Bashcrawl Help System Initialization
# Source this file to enable the help command anywhere in bashcrawl
# Usage: source help/init_help.sh
#

# Get the directory where this script is located (help dir)
# Use BASH_SOURCE in bash, fall back to $0 for zsh compatibility
_BC_HELP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
BASHCRAWL_ROOT="$(cd "$_BC_HELP_DIR/.." 2>/dev/null && pwd)"

# Initialize logging framework
if [ -f "${BASHCRAWL_ROOT}/lib/log.sh" ]; then
    source "${BASHCRAWL_ROOT}/lib/log.sh"
    bc_session_start "help_init"
    bc_install_hooks
fi

# Simple help function that works from anywhere in the bashcrawl directory tree
help() {
    if [ -f "${BASHCRAWL_ROOT}/help.sh" ]; then
        bash "${BASHCRAWL_ROOT}/help.sh" "$@"
    else
        echo "Help system not found at ${BASHCRAWL_ROOT}/help.sh"
        echo "Try: cat scroll"
        return 1
    fi
}

# Export the function so it's available in subshells
export -f help
export BASHCRAWL_ROOT

echo "🎯 Bashcrawl help system activated!"
echo "💡 Type 'help' from anywhere in the bashcrawl adventure to get assistance."
