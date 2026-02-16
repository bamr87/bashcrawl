#!/usr/bin/env bash
# ============================================================================
# Bashcrawl Help System — help.sh
#
# Context-aware help for players navigating the bashcrawl adventure.
# This is the main entry point that 6+ scripts reference.
#
# Usage:
#   bash help.sh              # Show context-aware help for current location
#   bash help.sh commands     # Show command quick reference
#   bash help.sh map          # Show dungeon map
#   bash help.sh reset        # Show how to reset the game
#   source help/init_help.sh  # Make 'help' available as a shell function
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASHCRAWL_ROOT="$SCRIPT_DIR"

# Source shared colors
if [[ -f "${BASHCRAWL_ROOT}/lib/colors.sh" ]]; then
    source "${BASHCRAWL_ROOT}/lib/colors.sh"
fi

# Source the main help engine
if [[ -f "${BASHCRAWL_ROOT}/help/bashcrawl_help.sh" ]]; then
    source "${BASHCRAWL_ROOT}/help/bashcrawl_help.sh"
fi

# ============================================================================
# HELP SUBCOMMANDS
# ============================================================================

show_commands() {
    cat << 'EOF'
================================================================================
                    BASHCRAWL COMMAND REFERENCE
================================================================================

NAVIGATION:                         VIEWING:
    cd DIRECTORY  Move to room          cat FILE    Read a scroll
    cd ..         Go back               ls          List room contents
    pwd           Show location         ls -F       Show file types
                                        ls -la      Show hidden items

GAME ACTIONS:                       VARIABLES:
    ./treasure    Run an encounter      export I=item,$I    Add to inventory
    ./potion      Drink a potion        echo $I             Check inventory
    ./spell       Cast a spell          export HP=15        Set health
    ./statue      Face the statue       echo $HP            Check health
                                        let "HP=HP-5"       Adjust health

FILE OPERATIONS:                    ADVANCED:
    chmod +x FILE  Make executable      grep WORD FILE   Search for text
    cp SRC DEST    Copy a file          ln -s TGT LINK   Create portal
    mv OLD NEW     Rename/move          find . -name X   Find files

================================================================================
EOF
}

show_map() {
    cat << 'EOF'
================================================================================
                        DUNGEON MAP
================================================================================

    entrance/
    ├── scroll              ← Start here! (cat scroll)
    ├── cellar/
    │   ├── scroll          ← Learn file types
    │   ├── treasure*       ← Collect amulet
    │   └── armoury/
    │       ├── scroll      ← Learn permissions
    │       ├── treasure*   ← Collect sword
    │       ├── potion*     ← Gain health
    │       └── chamber/
    │           ├── scroll  ← Learn variables
    │           ├── statue* ← Boss fight!
    │           ├── treasure*
    │           └── spell*  ← Create portal
    │
    ├── [chapel/]           ← Hidden! Unlocked by treasures
    │   └── courtyard/aviary/hall/
    │
    ├── [vault/]            ← Hidden! Learn file copying
    │   └── stronghold/nursery/lab/
    │
    ├── [scrap/]            ← Hidden! Learn symlinks
    │
    └── [rift/]             ← Hidden! Unlocked by vault goblet
        ├── arena/pit/
        └── spire/mezzanine/

    [brackets] = Hidden rooms (unlocked by game progress)
    *          = Executable encounter (run with ./)

================================================================================
EOF
}

show_reset_info() {
    cat << 'EOF'
================================================================================
                       RESET YOUR GAME
================================================================================

Option 1 — Use the reset script:
    bash lib/reset.sh           # Smart reset (re-hides rooms, clears state)
    bash lib/reset.sh --dry     # Preview what would be reset

Option 2 — Full git reset (nuclear option):
    git checkout -- entrance/   # Restore all game files
    git clean -fd entrance/     # Remove generated files
    rm -f .game_state           # Remove game state

Option 3 — Via the launcher:
    bash main.sh                # Choose "Reset Game" from menu

================================================================================
EOF
}

# ============================================================================
# CONTEXT-AWARE MAIN HELP
# ============================================================================

show_contextual_help() {
    local current_dir
    current_dir="$(basename "$PWD")"
    
    echo -e "${COLOR_BOLD:-}${COLOR_PRIMARY:-}"
    echo "================================================================================"
    echo "                    BASHCRAWL HELP SYSTEM"
    echo "================================================================================"
    echo -e "${COLOR_RESET:-}"
    echo ""
    
    # If bashcrawl_help.sh was sourced, use its context-aware help
    if declare -f detect_location &>/dev/null; then
        local location
        location="$(detect_location)"
        local progress
        progress="$(analyze_progress "$location")"
        
        show_location_help "$location"
        echo ""
        get_ai_suggestions "$location" "$progress"
        echo ""
    else
        # Fallback: basic location-based hints
        echo "  Current location: $PWD"
        echo ""
        case "$current_dir" in
            entrance)
                echo "  You are at the entrance. Start by reading: cat scroll"
                echo "  Then explore the cellar: cd cellar"
                ;;
            cellar)
                echo "  Read the scroll, then run: ./treasure"
                echo "  Continue deeper: cd armoury"
                ;;
            armoury)
                echo "  Try the potion: ./potion"
                echo "  Collect the sword: ./treasure"
                echo "  Go deeper: cd chamber"
                ;;
            chamber)
                echo "  Face the statue: ./statue"
                echo "  Create a portal: ./spell"
                ;;
            *)
                echo "  Look around: ls -F"
                echo "  Read scrolls: cat scroll"
                echo "  Go back: cd .."
                ;;
        esac
    fi
    
    echo ""
    echo "  Subcommands:"
    echo "    help commands   — Quick command reference"
    echo "    help map        — Dungeon map"
    echo "    help reset      — How to reset the game"
    echo ""
}

# ============================================================================
# MAIN DISPATCH
# ============================================================================

case "${1:-}" in
    commands|cmd|cmds)
        show_commands
        ;;
    map)
        show_map
        ;;
    reset)
        show_reset_info
        ;;
    *)
        show_contextual_help
        ;;
esac
