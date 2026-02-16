#!/usr/bin/env bash
#
# Bashcrawl Quick Reference Cards
# Instant access to command cheat sheets and reminders
#

# Show a quick reference card
show_quick_ref() {
    local card_type="$1"
    
    case "$card_type" in
        "basic"|"basics"|"")
            echo -e "${HELP_BOLD}${HELP_CYAN}📋 Quick Reference: Basic Commands${HELP_NC}"
            cat << 'EOF'

╭─ NAVIGATION ─────────────────────────────────────╮
│ pwd                    Show current location     │
│ ls                     List files               │
│ ls -F                  List with type indicators │
│ ls -la                 List all including hidden │
│ cd <dir>               Change directory          │
│ cd ..                  Go up one level          │
╰──────────────────────────────────────────────────╯

╭─ FILE VIEWING ───────────────────────────────────╮
│ cat <file>             Show entire file         │
│ less <file>            View file page by page   │
│ head <file>            Show first 10 lines      │
│ tail <file>            Show last 10 lines       │
╰──────────────────────────────────────────────────╯

╭─ BASHCRAWL SPECIFIC ─────────────────────────────╮
│ echo $I                Check inventory          │
│ export I=item,$I       Add item to inventory    │
│ ./treasure             Run interactive elements │
│ cat scroll             Read area documentation  │
╰──────────────────────────────────────────────────╯

EOF
            ;;
        "advanced")
            echo -e "${HELP_BOLD}${HELP_CYAN}📋 Quick Reference: Advanced Commands${HELP_NC}"
            cat << 'EOF'

╭─ SEARCH & FIND ──────────────────────────────────╮
│ find . -name "pattern"   Find files by name     │
│ find . -type f           Find files only        │
│ find . -type d           Find directories only  │
│ grep "text" <file>       Search within file     │
│ grep -r "text" .         Search all files       │
╰──────────────────────────────────────────────────╯

╭─ FILE OPERATIONS ────────────────────────────────╮
│ chmod +x <file>          Make file executable   │
│ cp <src> <dest>          Copy file/directory    │
│ mv <src> <dest>          Move/rename            │
│ mkdir <name>             Create directory       │
│ which <command>          Find command location  │
╰──────────────────────────────────────────────────╯

╭─ SYSTEM INFO ────────────────────────────────────╮
│ ps aux                   Show running processes │
│ df -h                    Show disk usage        │
│ history                  Show command history   │
│ man <command>            Show manual page       │
╰──────────────────────────────────────────────────╯

EOF
            ;;
        "shortcuts")
            echo -e "${HELP_BOLD}${HELP_CYAN}📋 Quick Reference: Keyboard Shortcuts${HELP_NC}"
            cat << 'EOF'

╭─ ESSENTIAL SHORTCUTS ────────────────────────────╮
│ Tab                      Auto-complete names    │
│ Ctrl+C                   Stop current command   │
│ Ctrl+L                   Clear screen          │
│ Ctrl+R                   Search command history │
│ ↑/↓ arrows              Navigate command history│
╰──────────────────────────────────────────────────╯

╭─ CURSOR MOVEMENT ────────────────────────────────╮
│ Ctrl+A                   Start of line         │
│ Ctrl+E                   End of line           │
│ Ctrl+U                   Delete to start       │
│ Ctrl+K                   Delete to end         │
│ Alt+← / Alt+→            Move by word           │
╰──────────────────────────────────────────────────╯

╭─ COMMAND TRICKS ─────────────────────────────────╮
│ !!                       Repeat last command    │
│ !<number>                Repeat command by #    │
│ command1 && command2     Run if first succeeds  │
│ command1 || command2     Run if first fails     │
╰──────────────────────────────────────────────────╯

EOF
            ;;
        "bashcrawl")
            echo -e "${HELP_BOLD}${HELP_CYAN}📋 Quick Reference: Bashcrawl Game${HELP_NC}"
            cat << 'EOF'

╭─ GETTING STARTED ────────────────────────────────╮
│ cat scroll               Read area instructions  │
│ ls -F                    See interactive elements│
│ ./treasure               Collect items          │
│ export I=item,$I         Add to inventory       │
│ echo $I                  Check inventory        │
╰──────────────────────────────────────────────────╯

╭─ EXPLORATION ────────────────────────────────────╮
│ cd entrance              Start the game         │
│ cd cellar                Basic challenges       │
│ cd armoury               Combat training        │
│ cd ..                    Go back               │
│ ls -la                   Find hidden secrets    │
╰──────────────────────────────────────────────────╯

╭─ HELP SYSTEM ────────────────────────────────────╮
│ help                     Context-aware help     │
│ help suggest             Smart recommendations  │
│ help tutorial            Interactive learning   │
│ help ai                  AI system status       │
│ help qref basic          This reference card    │
╰──────────────────────────────────────────────────╯

╭─ TROUBLESHOOTING ────────────────────────────────╮
│ pwd                      Where am I?           │
│ ls -la                   What's actually here?  │
│ chmod +x <file>          Fix permission errors  │
│ help suggest error       Get error solutions    │
╰──────────────────────────────────────────────────╯

EOF
            ;;
        "permissions")
            echo -e "${HELP_BOLD}${HELP_CYAN}📋 Quick Reference: File Permissions${HELP_NC}"
            cat << 'EOF'

╭─ UNDERSTANDING PERMISSIONS ──────────────────────╮
│ drwxrwxrwx               d=dir, rwx=read/write/exec│
│ -rwxr-xr-x               -=file, 755 permissions │
│ First rwx: owner         Second rwx: group       │
│ Third rwx: others        *=executable in ls -F   │
╰──────────────────────────────────────────────────╯

╭─ COMMON PERMISSION FIXES ────────────────────────╮
│ chmod +x <file>          Make executable        │
│ chmod -x <file>          Remove execute         │
│ chmod 755 <file>         rwxr-xr-x              │
│ chmod 644 <file>         rw-r--r--              │
│ ls -la <file>            Check current perms     │
╰──────────────────────────────────────────────────╯

╭─ PERMISSION NUMBERS ─────────────────────────────╮
│ 4 = read (r)             2 = write (w)          │
│ 1 = execute (x)          0 = no permission      │
│ 7 = 4+2+1 = rwx          5 = 4+1 = r-x          │
│ 6 = 4+2 = rw-            3 = 2+1 = -wx          │
╰──────────────────────────────────────────────────╯

EOF
            ;;
        *)
            echo -e "${HELP_BOLD}${HELP_YELLOW}📋 Available Quick Reference Cards:${HELP_NC}"
            echo
            echo "   📚 help qref basic      - Essential commands for beginners"
            echo "   🚀 help qref advanced   - Power-user commands and techniques"  
            echo "   ⌨️  help qref shortcuts - Keyboard shortcuts and tricks"
            echo "   🎮 help qref bashcrawl  - Game-specific commands and tips"
            echo "   🔐 help qref permissions - File permissions guide"
            echo
            echo "   💡 Usage: help qref <card_name>"
            ;;
    esac
}

# Export quick reference function
export -f show_quick_ref
