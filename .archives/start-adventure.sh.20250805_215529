#!/usr/bin/env bash
#
# Bashcrawl Quick Launcher
# Provides multiple ways to start the terminal adventure
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

show_launcher_menu() {
    clear
    cat << 'EOF'
╔═══════════════════════════════════════════════════════════════════════════╗
║                          ⚔️  BASHCRAWL LAUNCHER ⚔️                        ║
║                                                                           ║
║                     Choose Your Adventure Experience:                     ║
╚═══════════════════════════════════════════════════════════════════════════╝

🎮 GAME MODES:

  1) Interactive Terminal Emulator (Recommended for beginners)
     • Safe, contained environment within the game
     • Guided experience with built-in help
     • Perfect for learning without fear of breaking anything
     
  2) Native Terminal Experience (For experienced users)
     • Uses your actual terminal environment
     • Full access to your system commands
     • Traditional bashcrawl experience

  3) Help & Tutorial
     • Learn about bashcrawl commands
     • View game documentation
     • Get started guide

  4) Exit

EOF

    echo -n "Choose an option (1-4): "
    read -r choice

    case "$choice" in
        1)
            echo ""
            echo "🎮 Starting Interactive Terminal Emulator..."
            echo "This provides a safe, contained environment for learning."
            echo ""
            exec "$SCRIPT_DIR/bashcrawl-terminal.sh"
            ;;
        2)
            echo ""
            echo "🏠 Starting Native Terminal Experience..."
            echo "Make sure you understand terminal basics before proceeding."
            echo ""
            echo "Run these commands to begin:"
            echo "  cd $SCRIPT_DIR/entrance"
            echo "  cat scroll"
            echo ""
            echo "Type 'source $SCRIPT_DIR/help/init_help.sh' to enable the help system."
            ;;
        3)
            show_help_info
            ;;
        4)
            echo "Goodbye, brave adventurer!"
            exit 0
            ;;
        *)
            echo "Invalid choice. Please select 1-4."
            sleep 2
            show_launcher_menu
            ;;
    esac
}

show_help_info() {
    clear
    cat << 'EOF'
╔═══════════════════════════════════════════════════════════════════════════╗
║                      📚 BASHCRAWL HELP & TUTORIAL 📚                      ║
╚═══════════════════════════════════════════════════════════════════════════╝

🎯 WHAT IS BASHCRAWL?

Bashcrawl is an immersive text-based adventure game that teaches you
terminal/command-line skills through engaging gameplay. You'll learn real
terminal commands while exploring mystical catacombs!

🎮 TWO WAYS TO PLAY:

1. INTERACTIVE TERMINAL EMULATOR (Recommended for beginners)
   • Safe, sandboxed environment
   • Guided learning experience
   • Built-in help and tutorials
   • Cannot accidentally harm your system

2. NATIVE TERMINAL EXPERIENCE (For experienced users)
   • Uses your actual terminal
   • Full bash/shell environment
   • Traditional unix learning experience

🚀 BASIC COMMANDS TO LEARN:

   ls           - List files and directories
   cd <dir>     - Change directory (move between rooms)
   cat <file>   - View file contents
   pwd          - Show current location
   less <file>  - View file with pagination

🎓 LEARNING PATH:

   Entrance → Cellar → Armoury → Chamber → Advanced Areas

   Each area teaches specific terminal skills that build upon each other.

🆘 GETTING HELP:

   • In Interactive Mode: Type 'help' for context-aware assistance
   • In Native Mode: Source the help system with:
     source help/init_help.sh

📖 DOCUMENTATION:

   • README.md - Complete project documentation
   • entrance/scroll - Your first instructions
   • Each area has its own 'scroll' file with guidance

🌐 MORE RESOURCES:

   • GitHub: https://github.com/bamr87/bashcrawl
   • IT-Journey: Progressive quests and advanced challenges

EOF

    echo ""
    echo -n "Press Enter to return to the main menu..."
    read -r
    show_launcher_menu
}

# Main execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    show_launcher_menu
fi
