#!/usr/bin/env bash
#
# Bashcrawl Help System Initialization
# Source this file to enable the help command anywhere in bashcrawl
# Usage: source init_help.sh
#

# Get the directory where this script is located (help dir)
_BC_HELP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASHCRAWL_ROOT="$(cd "$_BC_HELP_DIR/.." 2>/dev/null && pwd)"

# Initialize logging framework
if [ -f "${BASHCRAWL_ROOT}/lib/log.sh" ]; then
    source "${BASHCRAWL_ROOT}/lib/log.sh"
    bc_session_start "help_init"
    bc_install_hooks
fi

# Simple help function that works from anywhere in the bashcrawl directory tree
help() {
    # Find the bashcrawl root by looking upward for the help.sh script
    local current_dir="$(pwd)"
    local help_script=""
    
    # First check if we're in the bashcrawl root
    if [ -f "./help.sh" ]; then
        help_script="./help.sh"
    else
        # Search upward for the help.sh script
        local search_dir="$current_dir"
        while [ "$search_dir" != "/" ]; do
            if [ -f "$search_dir/help.sh" ]; then
                help_script="$search_dir/help.sh"
                break
            fi
            search_dir="$(dirname "$search_dir")"
        done
        
        # If still not found, try the known bashcrawl root path
        if [ -z "$help_script" ] && [ -f "$BASHCRAWL_ROOT/help.sh" ]; then
            help_script="$BASHCRAWL_ROOT/help.sh"
        fi
    fi
    
    if [ -n "$help_script" ] && [ -f "$help_script" ]; then
        "$help_script" "$@"
    else
        echo "❌ Help system not found."
        echo "💡 Make sure you're in the bashcrawl directory and run: source help/init_help.sh"
        return 1
    fi
}

# Export the function so it's available in subshells
export -f help

echo "🎯 Bashcrawl help system activated!"
echo "💡 Type 'help' from anywhere in the bashcrawl adventure to get assistance."
