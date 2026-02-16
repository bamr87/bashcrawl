#!/usr/bin/env bash
#
# Bashcrawl AI Learning Engine
# Tracks player progress and adapts help recommendations
#
# Refactored to:
#   - Use lib/log.sh JSONL logging instead of custom pipe-delimited files
#   - Read recommendation data from src/help/data/recommendations.yaml
#

# Resolve BASHCRAWL_ROOT if not already set
if [[ -z "${BASHCRAWL_ROOT:-}" ]]; then
    _AI_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    BASHCRAWL_ROOT="$(cd "$_AI_SCRIPT_DIR/../.." 2>/dev/null && pwd)"
fi

# Source logging framework (provides bc_log, bc_session_start)
if [[ -f "${BASHCRAWL_ROOT}/lib/log.sh" ]]; then
    source "${BASHCRAWL_ROOT}/lib/log.sh"
fi

# Source YAML reader for data-driven recommendations
if [[ -f "${BASHCRAWL_ROOT}/lib/yaml_reader.sh" ]]; then
    source "${BASHCRAWL_ROOT}/lib/yaml_reader.sh"
fi

_BC_RECO_FILE="src/help/data/recommendations.yaml"

# ---------------------------------------------------------------------------
# Initialize progress tracking (delegates to lib/log.sh)
# ---------------------------------------------------------------------------
init_progress_tracking() {
    if declare -f bc_session_start &>/dev/null; then
        bc_session_start "help_ai" 2>/dev/null
    fi
}

# ---------------------------------------------------------------------------
# Log player actions (delegates to lib/log.sh JSONL)
# ---------------------------------------------------------------------------
log_action() {
    local action="$1"
    local context="${2:-}"
    if declare -f bc_log &>/dev/null; then
        bc_log "help_action" "action=$action" "context=$context"
    fi
}

# ---------------------------------------------------------------------------
# Analyze player patterns from JSONL session logs
# ---------------------------------------------------------------------------
analyze_player_patterns() {
    local current_location="$1"
    local log_dir="${BASHCRAWL_ROOT}/logs/sessions"

    if [[ ! -d "$log_dir" ]] || [[ -z "$(ls -A "$log_dir" 2>/dev/null)" ]]; then
        echo "first_time_player"
        return
    fi

    # Count visits to current location across all session logs
    local visit_count
    visit_count=$(grep -l "\"room\"" "$log_dir"/*.jsonl 2>/dev/null | head -5 | \
                  xargs grep -c "\"room\":\"$current_location\"" 2>/dev/null | \
                  awk -F: '{s+=$2}END{print s+0}')

    # Check recent activity (last 10 events mentioning this location)
    local recent_visits
    recent_visits=$(cat "$log_dir"/*.jsonl 2>/dev/null | tail -20 | \
                    grep -c "\"room\":\"$current_location\"" 2>/dev/null || echo 0)

    # Return analysis
    if [[ "$visit_count" -gt 5 ]] && [[ "$recent_visits" -gt 3 ]]; then
        echo "struggling_in_area"
    elif [[ "$visit_count" -eq 0 ]]; then
        echo "new_area"
    elif [[ "$visit_count" -lt 3 ]]; then
        echo "exploring"
    else
        echo "experienced"
    fi
}

# ---------------------------------------------------------------------------
# Get contextual AI recommendations (reads from YAML data)
# ---------------------------------------------------------------------------
get_ai_recommendations() {
    local location="$1"
    local pattern="$2"
    local inventory_items="${3:-}"

    # Try to read from YAML data
    local emoji label message
    emoji=$(yaml_get "$_BC_RECO_FILE" "patterns.${pattern}.emoji" 2>/dev/null)
    label=$(yaml_get "$_BC_RECO_FILE" "patterns.${pattern}.label" 2>/dev/null)
    message=$(yaml_get "$_BC_RECO_FILE" "patterns.${pattern}.message" 2>/dev/null)

    if [[ -n "$emoji" && -n "$message" ]]; then
        echo "$emoji $label: $message"
        yaml_list "$_BC_RECO_FILE" "patterns.${pattern}.tips" 2>/dev/null | while IFS= read -r tip; do
            echo "   • $tip"
        done
    else
        # Fallback to hardcoded recommendations
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
    fi
}

# ---------------------------------------------------------------------------
# Detect stuck patterns from JSONL session logs
# ---------------------------------------------------------------------------
detect_stuck_patterns() {
    local log_dir="${BASHCRAWL_ROOT}/logs/sessions"

    if [[ ! -d "$log_dir" ]] || [[ -z "$(ls -A "$log_dir" 2>/dev/null)" ]]; then
        return
    fi

    # Check recent commands from the most recent session file
    local latest_log
    latest_log=$(ls -t "$log_dir"/*.jsonl 2>/dev/null | head -1)
    [[ -z "$latest_log" ]] && return

    local recent_events
    recent_events=$(tail -5 "$latest_log" | grep -o '"event":"[^"]*"' | sort -u | wc -l)

    if [[ "$recent_events" -le 2 ]]; then
        # Try YAML-driven rescue message
        local rescue_msg
        rescue_msg=$(yaml_get "$_BC_RECO_FILE" "rescue.message" 2>/dev/null)
        if [[ -n "$rescue_msg" ]]; then
            local rescue_emoji
            rescue_emoji=$(yaml_get "$_BC_RECO_FILE" "rescue.emoji" 2>/dev/null || echo "🆘")
            echo "$rescue_emoji AI Rescue Mode: $rescue_msg"
            yaml_list "$_BC_RECO_FILE" "rescue.tips" 2>/dev/null | while IFS= read -r tip; do
                echo "   • $tip"
            done
        else
            echo "🆘 AI Rescue Mode: Detected repetitive pattern. Try these alternatives:"
            echo "   • 'help commands' for a comprehensive command list"
            echo "   • 'ls -la' to see everything including hidden files"
            echo "   • 'find . -name \"*\" -type f' to locate all files"
            echo "   • Change directories: 'cd ..' or 'cd [directory_name]'"
        fi
    fi
}

# ---------------------------------------------------------------------------
# Smart file recommendations (reads file type descriptions from YAML)
# ---------------------------------------------------------------------------
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
    local executables
    executables=$(find . -maxdepth 1 -type f -executable 2>/dev/null | grep -v "^\./\." | wc -l)
    if [ "$executables" -gt 0 ]; then
        echo "   ⚡ Interactive Elements Found:"
        find . -maxdepth 1 -type f -executable 2>/dev/null | grep -v "^\./\." | while read -r exe; do
            local name
            name=$(basename "$exe")
            local desc

            # Try YAML data for file type description
            desc=$(yaml_get "$_BC_RECO_FILE" "file_types.${name}.description" 2>/dev/null)
            if [[ -z "$desc" ]]; then
                desc=$(yaml_get "$_BC_RECO_FILE" "file_types.default.description" 2>/dev/null)
                desc="${desc:-Interactive element worth exploring!}"
            fi

            echo "     • ./$name - $desc"
        done
    fi

    # Check for hidden files
    local hidden_files
    hidden_files=$(ls -la | grep "^-.*\s\." | wc -l)
    if [ "$hidden_files" -gt 0 ]; then
        echo "   🔍 Hidden Files Detected: Use 'ls -la' to reveal secrets"
    fi

    # Check for directories
    local directories
    directories=$(find . -maxdepth 1 -type d ! -name "." | wc -l)
    if [ "$directories" -gt 0 ]; then
        echo "   🚪 Explorable Areas:"
        find . -maxdepth 1 -type d ! -name "." | while read -r dir; do
            local dir_name
            dir_name=$(basename "$dir")
            echo "     • cd $dir_name"
        done
    fi
}

# Export functions for use by main help script
export -f init_progress_tracking log_action analyze_player_patterns get_ai_recommendations detect_stuck_patterns recommend_files
