#!/usr/bin/env bash
#
# Bashcrawl AI Learning Engine
# Tracks player progress and adapts help recommendations
#

# Progress tracking file
PROGRESS_FILE="${HOME}/.bashcrawl_progress"
SESSION_FILE="/tmp/.bashcrawl_session_$$"

# Initialize progress tracking
init_progress_tracking() {
    # Create progress file if it doesn't exist
    if [ ! -f "$PROGRESS_FILE" ]; then
        cat > "$PROGRESS_FILE" << 'EOF'
# Bashcrawl Progress Tracking
# Format: timestamp|location|action|context
# This file helps the AI provide better recommendations
EOF
    fi
    
    # Create session file
    echo "session_start|$(date '+%Y-%m-%d %H:%M:%S')|$(pwd)" > "$SESSION_FILE"
}

# Log player actions for AI learning
log_action() {
    local action="$1"
    local context="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local location=$(basename "$(pwd)")
    
    echo "$timestamp|$location|$action|$context" >> "$PROGRESS_FILE"
    echo "$timestamp|$location|$action|$context" >> "$SESSION_FILE"
}

# Analyze player patterns and provide intelligent suggestions
analyze_player_patterns() {
    local current_location="$1"
    
    if [ ! -f "$PROGRESS_FILE" ]; then
        echo "first_time_player"
        return
    fi
    
    # Count visits to current location
    local visit_count=$(grep "|$current_location|" "$PROGRESS_FILE" 2>/dev/null | wc -l)
    
    # Check for recent struggles (multiple visits without progress)
    local recent_visits=$(tail -10 "$PROGRESS_FILE" | grep "|$current_location|" | wc -l)
    
    # Analyze command patterns
    local common_errors=$(grep "|error|" "$PROGRESS_FILE" 2>/dev/null | tail -5)
    
    # Return analysis
    if [ "$visit_count" -gt 5 ] && [ "$recent_visits" -gt 3 ]; then
        echo "struggling_in_area"
    elif [ "$visit_count" -eq 0 ]; then
        echo "new_area"
    elif [ "$visit_count" -lt 3 ]; then
        echo "exploring"
    else
        echo "experienced"
    fi
}

# Get contextual AI suggestions based on analysis
get_ai_recommendations() {
    local location="$1"
    local pattern="$2"
    local inventory_items="$3"
    
    case "$pattern" in
        "struggling_in_area")
            echo "🤖 AI Notice: You've visited this area multiple times. Here are targeted suggestions:"
            echo "   • Try 'help tips' for advanced techniques"
            echo "   • Look for hidden files with 'ls -la'"
            echo "   • Check if you missed any executable files (*)"
            echo "   • Consider reviewing the scroll again: 'cat scroll'"
            ;;
        "new_area")
            echo "🤖 AI Welcome: First time in this area! Recommended approach:"
            echo "   • Start by reading any documentation: 'cat scroll' or 'cat README.md'"
            echo "   • Survey the area: 'ls -F' to see all available options"
            echo "   • Look for interactive elements (files ending with *)"
            ;;
        "exploring")
            echo "🤖 AI Guidance: You're actively exploring. Smart next steps:"
            echo "   • Try different command variations for better results"
            echo "   • Use 'find . -type f' to discover all files"
            echo "   • Check for patterns in filenames and extensions"
            ;;
        "experienced")
            echo "🤖 AI Challenge: You know this area well. Advanced suggestions:"
            echo "   • Look for hidden Easter eggs and secret passages"
            echo "   • Try combining commands with pipes (|) and redirects (>)"
            echo "   • Experiment with advanced shell features"
            ;;
        *)
            echo "🤖 AI Assistant: Analyzing your gameplay style..."
            echo "   • Building personalized recommendations..."
            ;;
    esac
}

# Detect stuck patterns and provide rescue suggestions
detect_stuck_patterns() {
    if [ ! -f "$SESSION_FILE" ]; then
        return
    fi
    
    # Check if player is repeating the same commands
    local recent_commands=$(tail -5 "$SESSION_FILE" | cut -d'|' -f3)
    local unique_commands=$(echo "$recent_commands" | sort -u | wc -l)
    
    if [ "$unique_commands" -le 2 ]; then
        echo "🆘 AI Rescue Mode: Detected repetitive pattern. Try these alternatives:"
        echo "   • 'help commands' for a comprehensive command list"
        echo "   • 'ls -la' to see everything including hidden files"
        echo "   • 'find . -name \"*\" -type f' to locate all files"
        echo "   • Change directories: 'cd ..' or 'cd [directory_name]'"
    fi
}

# Smart file recommendations based on current directory
recommend_files() {
    local current_dir="$1"
    
    echo "📁 Smart File Analysis:"
    
    # Check for documentation
    if [ -f "scroll" ]; then
        echo "   📜 Primary Guide: 'cat scroll' - Essential reading!"
    fi
    
    if [ -f "README.md" ]; then
        echo "   📖 Documentation: 'cat README.md' - Detailed information"
    fi
    
    # Check for executables
    local executables=$(find . -maxdepth 1 -type f -executable 2>/dev/null | grep -v "^\./\." | wc -l)
    if [ "$executables" -gt 0 ]; then
        echo "   ⚡ Interactive Elements Found:"
        find . -maxdepth 1 -type f -executable 2>/dev/null | grep -v "^\./\." | while read -r exe; do
            local name=$(basename "$exe")
            local suggestion=""
            
            case "$name" in
                treasure) suggestion=" - Likely contains collectible items!" ;;
                potion) suggestion=" - May restore health or provide buffs!" ;;
                monster) suggestion=" - Combat encounter (ensure you're prepared!)" ;;
                spell) suggestion=" - Magical ability or special action!" ;;
                *) suggestion=" - Interactive element worth exploring!" ;;
            esac
            
            echo "     • ./$name$suggestion"
        done
    fi
    
    # Check for hidden files
    local hidden_files=$(ls -la | grep "^-.*\s\." | wc -l)
    if [ "$hidden_files" -gt 0 ]; then
        echo "   🔍 Hidden Files Detected: Use 'ls -la' to reveal secrets"
    fi
    
    # Check for directories
    local directories=$(find . -maxdepth 1 -type d ! -name "." | wc -l)
    if [ "$directories" -gt 0 ]; then
        echo "   🚪 Explorable Areas:"
        find . -maxdepth 1 -type d ! -name "." | while read -r dir; do
            local dir_name=$(basename "$dir")
            echo "     • cd $dir_name"
        done
    fi
}

# Export functions for use by main help script
export -f init_progress_tracking log_action analyze_player_patterns get_ai_recommendations detect_stuck_patterns recommend_files
export PROGRESS_FILE SESSION_FILE
