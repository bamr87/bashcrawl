#!/usr/bin/env bash
# ============================================================================
# Bashcrawl Terminal Emulator — lib/emulator.sh
#
# Command dispatch, safe command wrappers, and input processing.
# Extracted from main.sh to keep the launcher thin.
#
# Expects the following to be set before sourcing:
#   BASHCRAWL_ROOT, COLOR_*, ERROR_COLOR, SUCCESS_COLOR, RESET_COLOR,
#   LS_COLOR_FLAGS, HISTORY_FILE, and lib/quests.sh + lib/ui.sh sourced.
# Runtime ownership: classic shell gameplay runtime (command semantics).
# See docs/architecture-runtime.md for boundaries.
# ============================================================================

[[ "${_BC_EMULATOR_LOADED:-}" == "$$" ]] && return 0
_BC_EMULATOR_LOADED="$$"

# Table-driven handlers for simple zero-argument builtins.
# Format: "<command> <handler_function>"
_BC_COMMAND_TABLE=$'inventory show_inventory\ni show_inventory\nhealth show_health\nhp show_health\nstatus show_game_status\nmap show_map\nquest show_quest_command\nquests show_quest_command\ntutorial show_emulator_tutorial\ncommands show_available_commands\nmerlin merlin_hint\nstart start_adventure\nlook look_around\nexplore explore_area\nwhoami _cmd_whoami\ndate _cmd_date\n'

_cmd_whoami() { echo "bashcrawl_adventurer"; }
_cmd_date() { date; }

_dispatch_table_command() {
    local cmd="$1"
    shift || true
    local name handler
    while read -r name handler; do
        [[ -n "$name" ]] || continue
        [[ "$name" == "$cmd" ]] || continue
        "$handler" "$@"
        return $?
    done <<< "$_BC_COMMAND_TABLE"
    return 127
}

# ============================================================================
# COMMAND DISPATCH
# ============================================================================

execute_command() {
    local cmd="$1"
    shift
    local -a original_args=()
    if (( $# )); then
        original_args=("$@")
    fi
    local args="${original_args[*]:-}"
    local pre_command_dir
    pre_command_dir="$(pwd)"

    if [[ -n "$args" ]]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') - $cmd $args" >> "$HISTORY_FILE"
    else
        echo "$(date '+%Y-%m-%d %H:%M:%S') - $cmd" >> "$HISTORY_FILE"
    fi

    local handled=false
    local status=0

    local dispatch_status=127
    _dispatch_table_command "$cmd" "${original_args[@]}"
    dispatch_status=$?
    if [[ $dispatch_status -ne 127 ]]; then
        handled=true
        status=$dispatch_status
    fi

    if ! $handled; then
    case "$cmd" in
        "cd")
            handled=true
            safe_cd "${original_args[0]:-}"
            status=$?
            ;;
        "ls")
            handled=true
            if (( ${#original_args[@]} )); then
                safe_ls "${original_args[@]}"
            else
                safe_ls
            fi
            status=$?
            ;;
        "pwd")
            handled=true
            pwd
            status=$?
            ;;
        "cat")
            handled=true
            if (( ${#original_args[@]} )); then
                safe_cat "${original_args[@]}"
            else
                safe_cat
            fi
            status=$?
            ;;
        "less"|"more")
            handled=true
            if (( ${#original_args[@]} )); then
                safe_pager "$cmd" "${original_args[@]}"
            else
                safe_pager "$cmd"
            fi
            status=$?
            ;;
        "head")
            handled=true
            if (( ${#original_args[@]} )); then
                safe_head "${original_args[@]}"
            else
                safe_head
            fi
            status=$?
            ;;
        "tail")
            handled=true
            if (( ${#original_args[@]} )); then
                safe_tail "${original_args[@]}"
            else
                safe_tail
            fi
            status=$?
            ;;
        "wc")
            handled=true
            if (( ${#original_args[@]} )); then
                safe_wc "${original_args[@]}"
            else
                safe_wc
            fi
            status=$?
            ;;
        "touch")
            handled=true
            if (( ${#original_args[@]} )); then
                safe_touch "${original_args[@]}"
            else
                safe_touch
            fi
            status=$?
            ;;
        "mkdir")
            handled=true
            if (( ${#original_args[@]} )); then
                safe_mkdir "${original_args[@]}"
            else
                safe_mkdir
            fi
            status=$?
            ;;
        "grep")
            handled=true
            if (( ${#original_args[@]} )); then
                safe_grep "${original_args[@]}"
            else
                safe_grep
            fi
            status=$?
            ;;
        "inventory"|"i")
            handled=true
            show_inventory
            status=$?
            ;;
        "health"|"hp")
            handled=true
            show_health
            status=$?
            ;;
        "status")
            handled=true
            show_game_status
            status=$?
            ;;
        "map")
            handled=true
            show_map
            status=$?
            ;;
        "quest"|"quests")
            handled=true
            show_quest_command
            status=$?
            ;;
        "help")
            handled=true
            show_contextual_help "$args"
            status=$?
            ;;
        "tutorial")
            handled=true
            show_emulator_tutorial
            status=$?
            ;;
        "commands")
            handled=true
            show_available_commands
            status=$?
            ;;
        "merlin")
            handled=true
            merlin_hint
            status=$?
            ;;
        "start")
            handled=true
            start_adventure
            status=$?
            ;;
        "look")
            handled=true
            look_around
            status=$?
            ;;
        "explore")
            handled=true
            explore_area
            status=$?
            ;;
        ./*) # Dynamic game script execution — no hardcoded list needed
            if [[ -x "$cmd" ]]; then
                handled=true
                if (( ${#original_args[@]} )); then
                    "$cmd" "${original_args[@]}"
                else
                    "$cmd"
                fi
                status=$?
            else
                status=1
                echo -e "${ERROR_COLOR}Error: $cmd not found or not executable${RESET_COLOR}"
            fi
            ;;
        "whoami")
            handled=true
            echo "bashcrawl_adventurer"
            ;;
        "date")
            handled=true
            date
            status=$?
            ;;
        "echo")
            handled=true
            local expanded_args="$args"
            expanded_args="${expanded_args//\$I/$I}"
            expanded_args="${expanded_args//\$HP/$HP}"
            expanded_args="${expanded_args//\$GAME_LEVEL/$GAME_LEVEL}"
            expanded_args="${expanded_args//\$CURRENT_AREA/$CURRENT_AREA}"
            expanded_args="${expanded_args//\$USER/$USER}"
            expanded_args="${expanded_args//\$HOME/$HOME}"
            expanded_args="${expanded_args//\$PWD/$PWD}"
            expanded_args="${expanded_args//\$BASHCRAWL_ROOT/$BASHCRAWL_ROOT}"
            expanded_args="${expanded_args//\$OLDPWD/${OLDPWD:-}}"
            echo "$expanded_args"
            ;;
        "clear")
            handled=true
            clear
            status=$?
            ;;
        "history")
            handled=true
            show_command_history
            status=$?
            ;;
        "reset")
            handled=true
            reset_terminal_state
            status=$?
            ;;
        "save")
            handled=true
            manual_save
            status=$?
            ;;
        "load")
            handled=true
            manual_load
            status=$?
            ;;
        "exit"|"quit"|"q")
            exit_terminal
            ;;
        "export")
            handled=true
            if [[ -n "$args" ]]; then
                if [[ "$args" == -f\ * ]]; then
                    local func_name="${args#-f }"
                    if declare -f "$func_name" &>/dev/null; then
                        # shellcheck disable=SC2163
                        export -f "$func_name" 2>/dev/null
                        status=$?
                        if [[ $status -eq 0 ]]; then
                            echo -e "${SUCCESS_COLOR}Function '$func_name' exported.${RESET_COLOR}"
                        fi
                    else
                        echo -e "${ERROR_COLOR}Function not found: $func_name${RESET_COLOR}"
                        status=1
                    fi
                elif [[ "$args" =~ ^[A-Za-z_][A-Za-z_0-9]*= ]]; then
                    eval "export $args" 2>/dev/null
                    status=$?
                    if [[ $status -eq 0 ]]; then
                        if [[ "$args" == I=* ]]; then
                            echo -e "${SUCCESS_COLOR}🎒 Inventory updated: $I${RESET_COLOR}"
                        elif [[ "$args" == HP=* ]]; then
                            echo -e "${SUCCESS_COLOR}❤️  Health set to: $HP${RESET_COLOR}"
                        fi
                    fi
                else
                    echo -e "${ERROR_COLOR}Invalid export syntax. Use: export VAR=value${RESET_COLOR}"
                    status=1
                fi
            else
                echo -e "${ERROR_COLOR}Usage: export VAR=value${RESET_COLOR}"
                status=1
            fi
            ;;
        "let")
            handled=true
            if [[ -n "$args" ]]; then
                local let_pattern='^[A-Za-z_0-9=+*/% "'"'"'-]+$'
                if [[ "$args" =~ $let_pattern ]]; then
                    eval "let $args" 2>/dev/null
                    status=$?
                else
                    echo -e "${ERROR_COLOR}Invalid let syntax. Use: let \"HP=HP-5\"${RESET_COLOR}"
                    status=1
                fi
            else
                echo -e "${ERROR_COLOR}Usage: let \"expression\"${RESET_COLOR}"
                status=1
            fi
            ;;
        "alias")
            handled=true
            if [[ -n "$args" ]]; then
                eval "alias $args" 2>/dev/null
                status=$?
            else
                alias
                status=$?
            fi
            ;;
        "ln")
            handled=true
            if (( ${#original_args[@]} )); then
                ln "${original_args[@]}" 2>&1
            else
                echo -e "${ERROR_COLOR}Usage: ln -fs target linkname${RESET_COLOR}"
            fi
            status=$?
            ;;
        "cp")
            handled=true
            if (( ${#original_args[@]} )); then
                cp "${original_args[@]}" 2>&1
            else
                echo -e "${ERROR_COLOR}Usage: cp source dest${RESET_COLOR}"
            fi
            status=$?
            ;;
        "mv")
            handled=true
            if (( ${#original_args[@]} )); then
                mv "${original_args[@]}" 2>&1
            else
                echo -e "${ERROR_COLOR}Usage: mv source dest${RESET_COLOR}"
            fi
            status=$?
            ;;
        "rm")
            handled=true
            if (( ${#original_args[@]} )); then
                rm "${original_args[@]}" 2>&1
            else
                echo -e "${ERROR_COLOR}Usage: rm filename${RESET_COLOR}"
            fi
            status=$?
            ;;
        "sort")
            handled=true
            if (( ${#original_args[@]} )); then
                sort "${original_args[@]}" 2>&1
            else
                echo -e "${ERROR_COLOR}Usage: sort filename${RESET_COLOR}"
            fi
            status=$?
            ;;
        "find")
            handled=true
            if (( ${#original_args[@]} )); then
                find "${original_args[@]}" 2>&1
            else
                echo -e "${ERROR_COLOR}Usage: find . -name \"pattern\"${RESET_COLOR}"
            fi
            status=$?
            ;;
        "chmod")
            handled=true
            if (( ${#original_args[@]} )); then
                chmod "${original_args[@]}" 2>&1
            else
                echo -e "${ERROR_COLOR}Usage: chmod +x filename${RESET_COLOR}"
            fi
            status=$?
            ;;
        "file")
            handled=true
            if (( ${#original_args[@]} )); then
                file "${original_args[@]}" 2>&1
            else
                echo -e "${ERROR_COLOR}Usage: file <filename>${RESET_COLOR}"
            fi
            status=$?
            ;;
        "uniq")
            handled=true
            if (( ${#original_args[@]} )); then
                uniq "${original_args[@]}" 2>&1
            else
                echo -e "${ERROR_COLOR}Usage: uniq <filename>${RESET_COLOR}"
            fi
            status=$?
            ;;
        "man")
            handled=true
            if (( ${#original_args[@]} )); then
                local man_cmd="${original_args[0]}"
                echo "Manual page for: $man_cmd"
                echo "─────────────────────────────"
                "$man_cmd" --help 2>&1 | head -30 || echo "(no help available for $man_cmd)"
            else
                echo -e "${ERROR_COLOR}Usage: man <command>${RESET_COLOR}"
            fi
            status=$?
            ;;
        "unalias")
            handled=true
            if (( ${#original_args[@]} )); then
                unalias "${original_args[@]}" 2>/dev/null || echo "No such alias: ${original_args[0]}"
            else
                echo -e "${ERROR_COLOR}Usage: unalias <name>${RESET_COLOR}"
            fi
            status=$?
            ;;
        "unset")
            handled=true
            if (( ${#original_args[@]} )); then
                local var_name="${original_args[0]}"
                if [[ "$var_name" =~ ^[A-Za-z_][A-Za-z_0-9]*$ ]]; then
                    unset "$var_name" 2>/dev/null
                    status=$?
                    echo -e "${SUCCESS_COLOR}Variable '$var_name' unset.${RESET_COLOR}"
                else
                    echo -e "${ERROR_COLOR}Invalid variable name: $var_name${RESET_COLOR}"
                    status=1
                fi
            else
                echo -e "${ERROR_COLOR}Usage: unset <variable>${RESET_COLOR}"
                status=1
            fi
            ;;
        "source"|".")
            handled=true
            if (( ${#original_args[@]} )); then
                local src_file="${original_args[0]}"
                if [[ -f "$src_file" ]]; then
                    # shellcheck disable=SC1090
                    source "$src_file" 2>&1
                    status=$?
                else
                    echo -e "${ERROR_COLOR}File not found: $src_file${RESET_COLOR}"
                    status=1
                fi
            else
                echo -e "${ERROR_COLOR}Usage: source <filename>${RESET_COLOR}"
                status=1
            fi
            ;;
        "readlink")
            handled=true
            if (( ${#original_args[@]} )); then
                readlink "${original_args[@]}" 2>&1
                status=$?
            else
                echo -e "${ERROR_COLOR}Usage: readlink <symlink>${RESET_COLOR}"
                status=1
            fi
            ;;
        "dirname")
            handled=true
            if (( ${#original_args[@]} )); then
                dirname "${original_args[@]}" 2>&1
                status=$?
            else
                echo -e "${ERROR_COLOR}Usage: dirname <path>${RESET_COLOR}"
                status=1
            fi
            ;;
        "basename")
            handled=true
            if (( ${#original_args[@]} )); then
                basename "${original_args[@]}" 2>&1
                status=$?
            else
                echo -e "${ERROR_COLOR}Usage: basename <path>${RESET_COLOR}"
                status=1
            fi
            ;;
        "type")
            handled=true
            if (( ${#original_args[@]} )); then
                type "${original_args[@]}" 2>&1
                status=$?
            else
                echo -e "${ERROR_COLOR}Usage: type <command>${RESET_COLOR}"
                status=1
            fi
            ;;
        "declare")
            handled=true
            if (( ${#original_args[@]} )); then
                declare "${original_args[@]}" 2>&1
                status=$?
            else
                echo -e "${ERROR_COLOR}Usage: declare [-f] [name]${RESET_COLOR}"
                status=1
            fi
            ;;
        "sed")
            handled=true
            if (( ${#original_args[@]} )); then
                eval "sed $args" 2>&1
            else
                echo -e "${ERROR_COLOR}Usage: sed 's/old/new/' file${RESET_COLOR}"
            fi
            status=$?
            ;;
        *)
            local exec_path="$cmd"
            [[ "$cmd" != ./* ]] && exec_path="./$cmd"
            if [[ -x "$exec_path" ]]; then
                handled=true
                if (( ${#original_args[@]} )); then
                    "$exec_path" "${original_args[@]}"
                else
                    "$exec_path"
                fi
                status=$?
            else
                status=1
                echo -e "${ERROR_COLOR}Command not recognized: $cmd${RESET_COLOR}"
                echo -e "Type 'commands' to see available commands, or 'help' for assistance."
            fi
            ;;
    esac
    fi

    if [[ "$handled" == true ]]; then
        LAST_COMMAND="$cmd"
        LAST_ARGS="$args"
        LAST_COMMAND_DIR="$pre_command_dir"
        LAST_RESULT_DIR="$(pwd)"
        LAST_COMMAND_EXIT_CODE=$status
        if [[ $status -eq 0 ]]; then
            register_command_use "$cmd"
            check_quest_progress
        fi
    fi

    return $status
}

# ============================================================================
# SAFE COMMAND IMPLEMENTATIONS
# ============================================================================

safe_cd() {
    local target="$1"
    local status=0

    # Capture the room we're leaving for on_exit hook
    local _prev_room
    _prev_room=$(basename "$(pwd)")
    [[ "$_prev_room" == .* ]] && _prev_room="${_prev_room#.}"

    case "$target" in
        ""|"~")
            cd "$BASHCRAWL_ROOT" || status=$?
            update_current_area
            if [[ "$target" == "~" ]]; then
                echo -e "${COLOR_INFO}In the game, ~ takes you to the bashcrawl lobby.${RESET_COLOR}"
            fi
            ;;
        "-")
            if [[ -n "${OLDPWD:-}" ]]; then
                local prev="$OLDPWD"
                if [[ "$prev" == "$BASHCRAWL_ROOT"* ]]; then
                    cd "$prev" || status=$?
                    pwd
                    update_current_area
                else
                    echo -e "${ERROR_COLOR}Previous directory is outside the game realm.${RESET_COLOR}"
                    status=1
                fi
            else
                echo -e "${ERROR_COLOR}No previous directory.${RESET_COLOR}"
                status=1
            fi
            ;;
        "..")
            if [[ "$(pwd)" != "$BASHCRAWL_ROOT" ]]; then
                cd .. || status=$?
                update_current_area
            else
                echo -e "${ERROR_COLOR}You cannot leave the bashcrawl realm!${RESET_COLOR}"
                status=1
            fi
            ;;
        "/"*)
            echo -e "${ERROR_COLOR}Absolute paths are not allowed in the game environment.${RESET_COLOR}"
            status=1
            ;;
        "$"*)
            local expanded
            eval "expanded=$target" 2>/dev/null || expanded=""
            if [[ -n "$expanded" && -d "$expanded" ]]; then
                cd "$expanded" || status=$?
                update_current_area
            else
                echo -e "${ERROR_COLOR}Directory not found: $target${RESET_COLOR}"
                status=1
            fi
            ;;
        *)
            if [[ -d "$target" ]]; then
                cd "$target" || status=$?
                update_current_area
            else
                echo -e "${ERROR_COLOR}Directory not found: $target${RESET_COLOR}"
                status=1
            fi
            ;;
    esac

    # Fire room event hooks on successful navigation
    if [[ $status -eq 0 ]]; then
        local _exit_msg _enter_msg _new_room
        _exit_msg="$(room_on_exit "$_prev_room" 2>/dev/null)" || true
        [[ -n "$_exit_msg" ]] && echo -e "${COLOR_INFO}${_exit_msg}${RESET_COLOR}"

        _new_room=$(basename "$(pwd)")
        [[ "$_new_room" == .* ]] && _new_room="${_new_room#.}"
        _enter_msg="$(room_on_enter "$_new_room" 2>/dev/null)" || true
        [[ -n "$_enter_msg" ]] && echo -e "${COLOR_INFO}${_enter_msg}${RESET_COLOR}"
    fi

    return $status
}

safe_ls() {
    local -a flags=("-F")
    local status=0

    if (( ${#LS_COLOR_FLAGS[@]} )); then
        flags+=("${LS_COLOR_FLAGS[@]}")
    fi

    if [[ $# -eq 0 ]]; then
        command ls "${flags[@]}" || status=$?
    else
        command ls "${flags[@]}" "$@" || status=$?
    fi

    add_area_context
    return $status
}

safe_cat() {
    if [[ $# -eq 0 ]]; then
        echo -e "${ERROR_COLOR}Usage: cat <filename>${RESET_COLOR}"
        return 1
    fi
    local status=0
    local file
    for file in "$@"; do
        if [[ -f "$file" ]]; then
            if [[ ! -s "$file" ]]; then
                echo "(empty file)"
            else
                cat "$file"
            fi
            if [[ "$file" == "scroll" ]]; then
                mark_scroll_read
            fi
        else
            echo -e "${ERROR_COLOR}File not found: $file${RESET_COLOR}"
            status=1
        fi
    done
    return $status
}

safe_pager() {
    local cmd="$1"
    shift
    local file="$1"

    if [[ -z "$file" ]]; then
        echo -e "${ERROR_COLOR}Usage: $cmd <filename>${RESET_COLOR}"
        return 1
    fi

    if [[ -f "$file" ]]; then
        case "$cmd" in
            "less") less "$file" ;;
            "more") more "$file" ;;
        esac
        if [[ "$file" == "scroll" ]]; then
            mark_scroll_read
        fi
        return 0
    else
        echo -e "${ERROR_COLOR}File not found: $file${RESET_COLOR}"
        return 1
    fi
}

safe_head() {
    local file="$1"
    if [[ -z "$file" ]]; then
        echo -e "${ERROR_COLOR}Usage: head <filename>${RESET_COLOR}"
        return 1
    fi
    if [[ -f "$file" ]]; then
        head "$file"
    else
        echo -e "${ERROR_COLOR}File not found: $file${RESET_COLOR}"
        return 1
    fi
}

safe_tail() {
    local file="$1"
    if [[ -z "$file" ]]; then
        echo -e "${ERROR_COLOR}Usage: tail <filename>${RESET_COLOR}"
        return 1
    fi
    if [[ -f "$file" ]]; then
        tail "$file"
    else
        echo -e "${ERROR_COLOR}File not found: $file${RESET_COLOR}"
        return 1
    fi
}

safe_wc() {
    local file="$1"
    if [[ -z "$file" ]]; then
        echo -e "${ERROR_COLOR}Usage: wc <filename>${RESET_COLOR}"
        return 1
    fi
    if [[ -f "$file" ]]; then
        wc "$file"
    else
        echo -e "${ERROR_COLOR}File not found: $file${RESET_COLOR}"
        return 1
    fi
}

safe_touch() {
    if [[ $# -eq 0 ]]; then
        echo -e "${ERROR_COLOR}Usage: touch <filename>${RESET_COLOR}"
        return 1
    fi
    local name="$1"
    if [[ "$name" == /* || "$name" == *"../"* || "$name" == *"/.."* ]]; then
        echo -e "${ERROR_COLOR}Absolute paths and parent directory references are not allowed.${RESET_COLOR}"
        return 1
    fi
    if [[ ! "$name" =~ ^[a-zA-Z0-9_.-/]+$ ]]; then
        echo -e "${ERROR_COLOR}Invalid filename. Use letters, numbers, dots, dashes, underscores, and slashes only.${RESET_COLOR}"
        return 1
    fi
    touch "$name"
    return $?
}

safe_mkdir() {
    if [[ $# -eq 0 ]]; then
        echo -e "${ERROR_COLOR}Usage: mkdir <dirname> or mkdir -p <dirname>${RESET_COLOR}"
        return 1
    fi
    local -a dirs=()
    local use_parents=false

    if [[ "$1" == "-p" ]]; then
        use_parents=true
        shift
    fi

    if [[ $# -eq 0 ]]; then
        echo -e "${ERROR_COLOR}Usage: mkdir <dirname> or mkdir -p <dirname>${RESET_COLOR}"
        return 1
    fi

    for name in "$@"; do
        if [[ "$name" == /* || "$name" == *"../"* || "$name" == *"/.."* ]]; then
            echo -e "${ERROR_COLOR}Absolute paths and parent directory references are not allowed.${RESET_COLOR}"
            return 1
        fi
        if [[ "$name" == */* ]]; then
            if [[ "$use_parents" != true ]]; then
                echo -e "${ERROR_COLOR}Use 'mkdir -p' to create nested directories.${RESET_COLOR}"
                return 1
            fi
            if [[ ! "$name" =~ ^[a-zA-Z0-9_./-]+$ ]]; then
                echo -e "${ERROR_COLOR}Invalid path. Use letters, numbers, dots, dashes, slashes, and underscores only.${RESET_COLOR}"
                return 1
            fi
        elif [[ ! "$name" =~ ^[a-zA-Z0-9_.-]+$ ]]; then
            echo -e "${ERROR_COLOR}Invalid directory name. Use letters, numbers, dots, dashes, and underscores only.${RESET_COLOR}"
            return 1
        fi
        dirs+=("$name")
    done

    for name in "${dirs[@]}"; do
        if [[ -d "$name" ]]; then
            echo -e "${SUCCESS_COLOR}Directory already exists: $name${RESET_COLOR}"
        else
            if [[ "$use_parents" == true ]]; then
                mkdir -p "$name" || return $?
            else
                mkdir "$name" || return $?
            fi
        fi
    done
    return 0
}

safe_grep() {
    if [[ $# -lt 2 ]]; then
        echo -e "${ERROR_COLOR}Usage: grep [options] <pattern> <file>${RESET_COLOR}"
        return 1
    fi

    local -a flags=()
    local -a positional=()
    for arg in "$@"; do
        if [[ "$arg" == -* ]]; then
            flags+=("$arg")
        else
            positional+=("$arg")
        fi
    done

    if [[ ${#positional[@]} -lt 2 ]]; then
        echo -e "${ERROR_COLOR}Usage: grep [options] <pattern> <file>${RESET_COLOR}"
        return 1
    fi

    local pattern="${positional[0]}"
    local file="${positional[1]}"

    if [[ -z "$pattern" ]]; then
        echo -e "${ERROR_COLOR}Pattern cannot be empty.${RESET_COLOR}"
        return 1
    fi
    if [[ ! -f "$file" ]]; then
        echo -e "${ERROR_COLOR}File not found: $file${RESET_COLOR}"
        return 1
    fi
    if [[ ${#flags[@]} -gt 0 ]]; then
        grep --color=auto "${flags[@]}" "$pattern" "$file"
    else
        grep --color=auto "$pattern" "$file"
    fi
    return $?
}

# ============================================================================
# INPUT PROCESSING
# ============================================================================

_dispatch_input() {
    local input="$1"
    [[ -z "$input" ]] && return 0
    [[ "$input" == \#* ]] && return 0

    if [[ "$input" == *"|"* ]] || [[ "$input" == *">"* ]] \
       || [[ "$input" == *"&&"* ]] || [[ "$input" == *"||"* ]] \
       || [[ "$input" == *";"* ]] || [[ "$input" == *"<<<"* ]] \
       || [[ "$input" == *" () {"* ]] || [[ "$input" == *"function "* ]]; then
        local status=0
        set +e
        eval "$input" 2>&1
        status=$?
        set -e
        save_game_state
        return $status
    fi

    local -a cmd_array
    read -ra cmd_array <<< "$input"
    local first_word="${cmd_array[0]}"
    local alias_def
    alias_def=$(alias "$first_word" 2>/dev/null) || true
    if [[ -n "$alias_def" && "$alias_def" == *"='"* ]]; then
        local alias_value
        alias_value="${alias_def#*=\'}"
        alias_value="${alias_value%\'}"
        local rest="${input#"$first_word"}"
        input="${alias_value}${rest}"
        read -ra cmd_array <<< "$input"
    fi

    local command="${cmd_array[0]}"
    local -a cmd_args=()
    if (( ${#cmd_array[@]} > 1 )); then
        cmd_args=("${cmd_array[@]:1}")
    fi

    local status=0
    set +e
    if (( ${#cmd_args[@]} )); then
        execute_command "$command" "${cmd_args[@]}"
        status=$?
    else
        execute_command "$command"
        status=$?
    fi
    set -e

    save_game_state
    return $status
}

run_single_command() {
    cd "$BASHCRAWL_ROOT"
    touch "$HISTORY_FILE"
    load_game_state
    restore_saved_location
    _dispatch_input "$*"
}

run_batch() {
    cd "$BASHCRAWL_ROOT"
    touch "$HISTORY_FILE"
    load_game_state
    restore_saved_location

    while IFS= read -r input || [[ -n "$input" ]]; do
        echo -e "$(generate_prompt)${input}"
        _dispatch_input "$input" || true
        echo
    done
}
