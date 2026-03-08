#!/usr/bin/env bash
# ============================================================================
# Bashcrawl UI Functions — lib/ui.sh
#
# Banners, prompts, help screens, and display functions.
# Extracted from main.sh to keep the launcher thin.
#
# Expects the following to be set before sourcing:
#   BASHCRAWL_ROOT, COLOR_*, PROMPT_COLOR, DIRECTORY_COLOR, ERROR_COLOR,
#   SUCCESS_COLOR, RESET_COLOR, LS_COLOR_FLAGS, and lib/quests.sh sourced.
# ============================================================================

[[ "${_BC_UI_LOADED:-}" == "$$" ]] && return 0
_BC_UI_LOADED="$$"

# ============================================================================
# WELCOME BANNER
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

# ============================================================================
# PROMPT GENERATION
# ============================================================================

generate_prompt() {
    local current_dir
    current_dir=$(basename "$(pwd)")

    # Strip leading dot for hidden room lookup (e.g. .chapel -> chapel)
    local lookup_dir="$current_dir"
    [[ "$lookup_dir" == .* ]] && lookup_dir="${lookup_dir#.}"

    local emoji label display_name
    emoji="$(room_emoji "$lookup_dir")"
    label="$(room_label "$lookup_dir")"
    display_name="${lookup_dir}"

    echo -e "${PROMPT_COLOR}${emoji} ${display_name}${RESET_COLOR} ${DIRECTORY_COLOR}[${label}]${RESET_COLOR} ⚔️  "
}

# ============================================================================
# GAME STATUS DISPLAYS
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
            icon="$(item_icon "$item")"
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

    # Highlight helper: emits bold+green if the room's registry path matches current location
    _h() {
        local room_path
        room_path="$(room_path "$1" 2>/dev/null)" || true
        if [[ -n "$room_path" && "$room_path" == "$loc" ]]; then
            echo -n "${here}"
        fi
    }

    echo -e "    $(_h bashcrawl)$(room_emoji bashcrawl) bashcrawl${r} (lobby)"
    echo -e "        └── $(_h entrance)$(room_emoji entrance) entrance${r}"
    echo -e "                ├── $(_h cellar)$(room_emoji cellar) cellar${r} → $(_h armoury)armoury${r} → $(_h chamber)$(room_emoji chamber) chamber${r}"
    echo -e "                ├── $(_h workshop)$(room_emoji workshop) workshop${r}"
    echo -e "                ├── $(_h chapel)$(room_emoji chapel) chapel${r} → $(_h courtyard)courtyard${r} → $(_h aviary)aviary${r} → $(_h hall)hall${r} → $(_h library)$(room_emoji library) library${r}"
    echo -e "                │       └── $(_h graveyard)$(room_emoji graveyard) graveyard${r} → columbarium, royal-tombs"
    echo -e "                ├── $(_h vault)$(room_emoji vault) vault${r} → $(_h stronghold)stronghold${r} → $(_h nursery)nursery${r} → $(_h lab)lab${r}"
    echo -e "                ├── $(_h scrap)$(room_emoji scrap) scrap${r} (symlinks)"
    echo -e "                └── $(_h rift)$(room_emoji rift) rift${r} → $(_h arena)arena${r} → $(_h pit)pit${r} | $(_h spire)spire${r} → $(_h mezzanine)mezzanine${r}"
    echo ""
    echo -e "You are here: ${COLOR_BOLD}${loc}${RESET_COLOR}"
    echo ""

    unset -f _h
}

# ============================================================================
# AREA CONTEXT
# ============================================================================

add_area_context() {
    local current_dir
    current_dir=$(basename "$(pwd)")

    # Strip leading dot for registry lookup
    local lookup_dir="$current_dir"
    [[ "$lookup_dir" == .* ]] && lookup_dir="${lookup_dir#.}"

    local hint emoji
    hint="$(room_hint "$lookup_dir")"
    emoji="$(room_emoji "$lookup_dir")"

    if [[ -n "$hint" ]]; then
        echo ""
        echo -e "${SUCCESS_COLOR}${emoji} ${hint}${RESET_COLOR}"
    fi

    # Show on_enter message if present
    local enter_msg
    enter_msg="$(room_on_enter "$lookup_dir")"
    if [[ -n "$enter_msg" ]]; then
        echo -e "${COLOR_INFO}${enter_msg}${RESET_COLOR}"
    fi

    if [[ -f "scroll" ]]; then
        echo -e "📜 There is a scroll here. Read it with: ${PROMPT_COLOR}cat scroll${RESET_COLOR}"
    fi

    local executables
    executables=$({ find . -maxdepth 1 -type f -perm -111 2>/dev/null | head -5; } || true)
    if [[ -n "$executables" ]]; then
        echo -e "⚡ Interactive elements found:"
        local room_name
        room_name="$lookup_dir"
        echo "$executables" | while read -r exe; do
            local name enc_key icon desc
            name=$(basename "$exe")
            enc_key=$(enc_lookup_by_script "$name" "$room_name" 2>/dev/null) || enc_key=""
            if [[ -n "$enc_key" ]]; then
                icon="$(enc_icon "$enc_key")"
                desc="$(enc_desc "$enc_key")"
            else
                icon="⚡"
                desc="Interactive element"
            fi
            echo -e "   ${icon} ${name} - ${desc}"
        done
    fi
}

# ============================================================================
# HELP SCREENS
# ============================================================================

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
        echo -e "${SUCCESS_COLOR}🎯 CONTEXTUAL HELP:${RESET_COLOR}"
        echo ""
        echo "You are currently in: $(pwd)"
        echo "Area: $CURRENT_AREA"
        echo ""

        local current_dir lookup_dir
        current_dir=$(basename "$(pwd)")
        lookup_dir="$current_dir"
        [[ "$lookup_dir" == .* ]] && lookup_dir="${lookup_dir#.}"

        local emoji hint
        emoji="$(room_emoji "$lookup_dir")"
        hint="$(room_hint "$lookup_dir")"

        if [[ -n "$hint" ]]; then
            local room_title
            room_title=$(_reg_get "_REG_ROOM_${lookup_dir}_title" 2>/dev/null) || room_title=""
            echo "${emoji} ${room_title:-AREA} HELP:"
            echo "   • ${hint}"
        else
            echo "📍 GENERAL HELP:"
            echo "   • Look around: ls"
            echo "   • Read documentation: cat scroll"
            echo "   • Check your status: status"
        fi

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

# ============================================================================
# ADVENTURE ACTIONS
# ============================================================================

start_adventure() {
    echo -e "${SUCCESS_COLOR}🎮 STARTING YOUR ADVENTURE...${RESET_COLOR}"
    echo ""
    echo "Preparing to enter the mystical catacombs..."
    echo ""

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
    echo "   Directories: $((dir_count - 1))"
    echo "   Executables: $exec_count"
    echo ""

    add_area_context
}

# ============================================================================
# SESSION EXIT
# ============================================================================

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

show_command_history() {
    if [[ -f "$HISTORY_FILE" ]]; then
        echo -e "${SUCCESS_COLOR}📜 COMMAND HISTORY:${RESET_COLOR}"
        tail -20 "$HISTORY_FILE"
    else
        echo "No command history available."
    fi
}
