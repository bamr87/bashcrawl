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

    case "$current_dir" in
        "bashcrawl")
            echo -e "${PROMPT_COLOR}🏠 bashcrawl${RESET_COLOR} ${DIRECTORY_COLOR}[lobby]${RESET_COLOR} ⚔️  "
            ;;
        "entrance")
            echo -e "${PROMPT_COLOR}🚪 entrance${RESET_COLOR} ${DIRECTORY_COLOR}[starting hall]${RESET_COLOR} ⚔️  "
            ;;
        "workshop")
            echo -e "${PROMPT_COLOR}🔧 workshop${RESET_COLOR} ${DIRECTORY_COLOR}[creation tutorial]${RESET_COLOR} ⚔️  "
            ;;
        "cellar")
            echo -e "${PROMPT_COLOR}🏰 cellar${RESET_COLOR} ${DIRECTORY_COLOR}[underground]${RESET_COLOR} ⚔️  "
            ;;
        "armoury")
            echo -e "${PROMPT_COLOR}🗡️ armoury${RESET_COLOR} ${DIRECTORY_COLOR}[weapons hall]${RESET_COLOR} ⚔️  "
            ;;
        "chamber")
            echo -e "${PROMPT_COLOR}💎 chamber${RESET_COLOR} ${DIRECTORY_COLOR}[treasure room]${RESET_COLOR} ⚔️  "
            ;;
        ".chapel")
            echo -e "${PROMPT_COLOR}⛪ chapel${RESET_COLOR} ${DIRECTORY_COLOR}[hidden sanctuary]${RESET_COLOR} ⚔️  "
            ;;
        "courtyard")
            echo -e "${PROMPT_COLOR}🌿 courtyard${RESET_COLOR} ${DIRECTORY_COLOR}[chapel grounds]${RESET_COLOR} ⚔️  "
            ;;
        "aviary")
            echo -e "${PROMPT_COLOR}🦅 aviary${RESET_COLOR} ${DIRECTORY_COLOR}[bird sanctuary]${RESET_COLOR} ⚔️  "
            ;;
        "hall")
            echo -e "${PROMPT_COLOR}🏛️ hall${RESET_COLOR} ${DIRECTORY_COLOR}[grand chamber]${RESET_COLOR} ⚔️  "
            ;;
        "library")
            echo -e "${PROMPT_COLOR}📚 library${RESET_COLOR} ${DIRECTORY_COLOR}[ancient tomes]${RESET_COLOR} ⚔️  "
            ;;
        "graveyard")
            echo -e "${PROMPT_COLOR}🪦 graveyard${RESET_COLOR} ${DIRECTORY_COLOR}[resting place]${RESET_COLOR} ⚔️  "
            ;;
        ".vault")
            echo -e "${PROMPT_COLOR}💰 vault${RESET_COLOR} ${DIRECTORY_COLOR}[treasure hold]${RESET_COLOR} ⚔️  "
            ;;
        "stronghold")
            echo -e "${PROMPT_COLOR}🏰 stronghold${RESET_COLOR} ${DIRECTORY_COLOR}[vault heart]${RESET_COLOR} ⚔️  "
            ;;
        "nursery")
            echo -e "${PROMPT_COLOR}🌱 nursery${RESET_COLOR} ${DIRECTORY_COLOR}[vault garden]${RESET_COLOR} ⚔️  "
            ;;
        "lab")
            echo -e "${PROMPT_COLOR}🧪 lab${RESET_COLOR} ${DIRECTORY_COLOR}[alchemy room]${RESET_COLOR} ⚔️  "
            ;;
        ".scrap")
            echo -e "${PROMPT_COLOR}🔗 scrap${RESET_COLOR} ${DIRECTORY_COLOR}[symlink portal]${RESET_COLOR} ⚔️  "
            ;;
        ".rift")
            echo -e "${PROMPT_COLOR}🌀 rift${RESET_COLOR} ${DIRECTORY_COLOR}[advanced realm]${RESET_COLOR} ⚔️  "
            ;;
        "arena")
            echo -e "${PROMPT_COLOR}⚔️ arena${RESET_COLOR} ${DIRECTORY_COLOR}[combat pit]${RESET_COLOR} ⚔️  "
            ;;
        "pit")
            echo -e "${PROMPT_COLOR}🕳️ pit${RESET_COLOR} ${DIRECTORY_COLOR}[boss lair]${RESET_COLOR} ⚔️  "
            ;;
        "spire")
            echo -e "${PROMPT_COLOR}🗼 spire${RESET_COLOR} ${DIRECTORY_COLOR}[tower ascent]${RESET_COLOR} ⚔️  "
            ;;
        "mezzanine")
            echo -e "${PROMPT_COLOR}🪜 mezzanine${RESET_COLOR} ${DIRECTORY_COLOR}[elevator access]${RESET_COLOR} ⚔️  "
            ;;
        *)
            echo -e "${PROMPT_COLOR}📍 $current_dir${RESET_COLOR} ${DIRECTORY_COLOR}[exploring]${RESET_COLOR} ⚔️  "
            ;;
    esac
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
            case "$item" in
                sword)    icon="🗡️" ;;
                amulet)   icon="📿" ;;
                coins)    icon="🪙" ;;
                diamonds) icon="💎" ;;
                goblet)   icon="🏆" ;;
                *)        icon="✦" ;;
            esac
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

    local lob="" ent="" cel="" arm="" chm="" wks=""
    local chp="" crt="" avi="" hal="" lib="" gvy=""
    local vlt="" str="" nur="" lab="" scp="" rft=""
    local are="" pit="" spi="" mez=""

    case "$loc" in
        bashcrawl)                lob="${here}" ;;
        entrance)                 ent="${here}" ;;
        entrance/cellar)          cel="${here}" ;;
        entrance/cellar/armoury)  arm="${here}" ;;
        entrance/cellar/armoury/chamber) chm="${here}" ;;
        entrance/workshop)        wks="${here}" ;;
        entrance/chapel)          chp="${here}" ;;
        entrance/chapel/courtyard) crt="${here}" ;;
        entrance/chapel/courtyard/aviary) avi="${here}" ;;
        entrance/chapel/courtyard/aviary/hall) hal="${here}" ;;
        entrance/chapel/courtyard/aviary/hall/library) lib="${here}" ;;
        entrance/chapel/graveyard) gvy="${here}" ;;
        entrance/vault)           vlt="${here}" ;;
        entrance/vault/stronghold) str="${here}" ;;
        entrance/vault/stronghold/nursery) nur="${here}" ;;
        entrance/vault/stronghold/nursery/lab) lab="${here}" ;;
        entrance/scrap)           scp="${here}" ;;
        entrance/.rift)           rft="${here}" ;;
        entrance/.rift/arena)     are="${here}" ;;
        entrance/.rift/arena/pit) pit="${here}" ;;
        entrance/.rift/spire)     spi="${here}" ;;
        entrance/.rift/spire/mezzanine) mez="${here}" ;;
    esac

    echo -e "    ${lob}🏠 bashcrawl${r} (lobby)"
    echo -e "        └── ${ent}🚪 entrance${r}"
    echo -e "                ├── ${cel}🏰 cellar${r} → ${arm}armoury${r} → ${chm}💎 chamber${r}"
    echo -e "                ├── ${wks}🔧 workshop${r}"
    echo -e "                ├── ${chp}⛪ chapel${r} → ${crt}courtyard${r} → ${avi}aviary${r} → ${hal}hall${r} → ${lib}📚 library${r}"
    echo -e "                │       └── ${gvy}🪦 graveyard${r} → columbarium, royal-tombs"
    echo -e "                ├── ${vlt}💰 vault${r} → ${str}stronghold${r} → ${nur}nursery${r} → ${lab}lab${r}"
    echo -e "                ├── ${scp}🔗 scrap${r} (symlinks)"
    echo -e "                └── ${rft}🌀 rift${r} → ${are}arena${r} → ${pit}pit${r} | ${spi}spire${r} → ${mez}mezzanine${r}"
    echo ""
    echo -e "You are here: ${COLOR_BOLD}${loc}${RESET_COLOR}"
    echo ""
}

# ============================================================================
# AREA CONTEXT
# ============================================================================

add_area_context() {
    local current_dir
    current_dir=$(basename "$(pwd)")

    case "$current_dir" in
        "bashcrawl")
            echo ""
            echo -e "${SUCCESS_COLOR}🏠 You are in the main lobby. Type 'cd entrance' to begin your adventure.${RESET_COLOR}"
            ;;
        "entrance")
            echo ""
            echo -e "${SUCCESS_COLOR}🚪 You stand at the entrance to the catacombs. Read the 'scroll' for guidance.${RESET_COLOR}"
            ;;
        "workshop")
            echo ""
            echo -e "${SUCCESS_COLOR}🔧 The workshop teaches creation: mkdir, touch, rm, echo >. Practice shaping the world!${RESET_COLOR}"
            ;;
        "cellar")
            echo ""
            echo -e "${SUCCESS_COLOR}🏰 You are in the underground cellar. Use ls -F to distinguish file types. Find the emerald!${RESET_COLOR}"
            ;;
        "armoury")
            echo ""
            echo -e "${SUCCESS_COLOR}🗡️ You have entered the armoury. Master chmod and ./script for combat!${RESET_COLOR}"
            ;;
        "chamber")
            echo ""
            echo -e "${SUCCESS_COLOR}💎 The treasure chamber! Run ./treasure, ./statue, or ./spell for rewards.${RESET_COLOR}"
            ;;
        ".chapel"|"courtyard"|"aviary"|"hall"|"library")
            echo ""
            echo -e "${SUCCESS_COLOR}⛪ Chapel path: Discover hidden commands and the ancient library tome.${RESET_COLOR}"
            ;;
        "graveyard")
            echo ""
            echo -e "${SUCCESS_COLOR}🪦 The graveyard holds secrets. Use ls -a to find the hidden mausoleum.${RESET_COLOR}"
            ;;
        ".vault"|"stronghold"|"nursery"|"lab")
            echo ""
            echo -e "${SUCCESS_COLOR}💰 Vault path: Master variables, collect the goblet to unlock the Rift!${RESET_COLOR}"
            ;;
        ".scrap")
            echo ""
            echo -e "${SUCCESS_COLOR}🔗 The Scrap teaches symlinks: ln -s creates portals. Find the path to the Rift!${RESET_COLOR}"
            ;;
        ".rift"|"arena"|"pit"|"spire"|"mezzanine")
            echo ""
            echo -e "${SUCCESS_COLOR}🌀 The Rift: Advanced challenges. Boss encounters in the Pit, secrets in the Spire!${RESET_COLOR}"
            ;;
    esac

    if [[ -f "scroll" ]]; then
        echo -e "📜 There is a scroll here. Read it with: ${PROMPT_COLOR}cat scroll${RESET_COLOR}"
    fi

    local executables
    executables=$({ find . -maxdepth 1 -type f -perm -111 2>/dev/null | head -3; } || true)
    if [[ -n "$executables" ]]; then
        echo -e "⚡ Interactive elements found:"
        echo "$executables" | while read -r exe; do
            local name
            name=$(basename "$exe")
            case "$name" in
                "treasure") echo -e "   💰 $name - Collect treasures" ;;
                "potion") echo -e "   🧪 $name - Restore health" ;;
                "spell") echo -e "   📜 $name - Cast magic spells" ;;
                "monster") echo -e "   👹 $name - Combat encounter" ;;
                *) echo -e "   ⚡ $name - Interactive element" ;;
            esac
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

        local current_dir
        current_dir=$(basename "$(pwd)")
        case "$current_dir" in
            "bashcrawl")
                echo "🏠 LOBBY HELP:"
                echo "   • Type 'start' to begin your adventure"
                echo "   • Type 'cd entrance' to enter the catacombs"
                echo "   • Type 'ls' to see available areas"
                ;;
            "entrance")
                echo "🚪 ENTRANCE HELP:"
                echo "   • Read the scroll: cat scroll"
                echo "   • Look around: ls -F"
                echo "   • Move deeper: cd cellar"
                ;;
            *)
                echo "📍 GENERAL HELP:"
                echo "   • Look around: ls"
                echo "   • Read documentation: cat scroll"
                echo "   • Check your status: status"
                ;;
        esac

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
