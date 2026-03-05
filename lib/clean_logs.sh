#!/usr/bin/env bash
# ============================================================================
# Bashcrawl Log Cleanup — lib/clean_logs.sh
#
# Removes generated session logs, screenshots, feedback reports, and other
# runtime artifacts from the logs/ directory.  Only gitignored files are
# removed — tracked files (README.md, github-builder.log, .gitkeep) are
# preserved.
#
# Usage:
#   bash lib/clean_logs.sh              # clean all logs
#   bash lib/clean_logs.sh --dry        # show what would be removed
#   bash lib/clean_logs.sh --sessions   # clean only session JSONL files
#   bash lib/clean_logs.sh --screenshots # clean only screenshot dirs
#   bash lib/clean_logs.sh --keep 10    # keep the 10 most recent sessions
#   bash lib/clean_logs.sh --retain-policy  # keep last-passing + current-run only
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GAME_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOGS_DIR="$GAME_ROOT/logs"

# Source shared colors
source "$GAME_ROOT/lib/colors.sh"

# --- Defaults ----------------------------------------------------------------
DRY_RUN=false
CLEAN_SESSIONS=true
CLEAN_SCREENSHOTS=true
CLEAN_FEEDBACK=true
CLEAN_RUNTIME=true         # bashcrawl.log, setup.log, session-*.log, .DS_Store
KEEP_RECENT=0              # 0 = remove all; N = keep N most recent sessions
SELECTIVE=false            # true when user picks specific targets
RETAIN_POLICY=false        # true = use .last_passing_run.json + .last_run_meta.json

# --- Argument parsing --------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry)       DRY_RUN=true ;;
        --sessions)  SELECTIVE=true; CLEAN_SESSIONS=true; CLEAN_SCREENSHOTS=false;
                     CLEAN_FEEDBACK=false; CLEAN_RUNTIME=false ;;
        --screenshots) SELECTIVE=true; CLEAN_SESSIONS=false; CLEAN_SCREENSHOTS=true;
                       CLEAN_FEEDBACK=false; CLEAN_RUNTIME=false ;;
        --feedback)  SELECTIVE=true; CLEAN_SESSIONS=false; CLEAN_SCREENSHOTS=false;
                     CLEAN_FEEDBACK=true; CLEAN_RUNTIME=false ;;
        --runtime)   SELECTIVE=true; CLEAN_SESSIONS=false; CLEAN_SCREENSHOTS=false;
                     CLEAN_FEEDBACK=false; CLEAN_RUNTIME=true ;;
        --keep)      shift; KEEP_RECENT="${1:-0}" ;;
        --retain-policy) RETAIN_POLICY=true ;;
        --help|-h)
            echo "Usage: bash lib/clean_logs.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dry          Show what would be removed (no changes)"
            echo "  --sessions     Clean only session JSONL files"
            echo "  --screenshots  Clean only screenshot directories"
            echo "  --feedback     Clean only feedback reports"
            echo "  --runtime      Clean only runtime logs (bashcrawl.log, setup.log, etc.)"
            echo "  --keep N       Keep the N most recent session files"
            echo "  --retain-policy Keep only last-passing + current-run data (reads .last_passing_run.json)"
            echo "  -h, --help     Show this help message"
            exit 0
            ;;
        *)  echo "${COLOR_ERROR}Unknown option: $1${COLOR_RESET}"; exit 1 ;;
    esac
    shift
done

# --- Helpers -----------------------------------------------------------------
total_removed=0
total_bytes=0

log_remove() {
    local label="$1"
    echo "  ${COLOR_DIM}[clean]${COLOR_RESET} $label"
}

remove_file() {
    local f="$1"
    local label="${f#$GAME_ROOT/}"
    if [[ -f "$f" || -L "$f" ]]; then
        local sz
        sz=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f" 2>/dev/null || echo 0)
        total_bytes=$((total_bytes + sz))
        total_removed=$((total_removed + 1))
        log_remove "$label"
        $DRY_RUN || rm -f "$f"
    fi
}

remove_dir() {
    local d="$1"
    local label="${d#$GAME_ROOT/}"
    if [[ -d "$d" ]]; then
        local sz
        sz=$(du -sk "$d" 2>/dev/null | awk '{print $1 * 1024}')
        total_bytes=$((total_bytes + sz))
        total_removed=$((total_removed + 1))
        log_remove "$label/"
        $DRY_RUN || rm -rf "$d"
    fi
}

human_size() {
    local bytes=$1
    if   (( bytes >= 1073741824 )); then echo "$(( bytes / 1073741824 ))GB"
    elif (( bytes >= 1048576 ));    then echo "$(( bytes / 1048576 ))MB"
    elif (( bytes >= 1024 ));       then echo "$(( bytes / 1024 ))KB"
    else echo "${bytes}B"
    fi
}

# --- Validation --------------------------------------------------------------
if [[ ! -d "$LOGS_DIR" ]]; then
    echo "${COLOR_ERROR}ERROR: Cannot find logs/ at $LOGS_DIR${COLOR_RESET}"
    exit 1
fi

# --- Banner ------------------------------------------------------------------
echo "${COLOR_PRIMARY}=== Bashcrawl Log Cleanup ===${COLOR_RESET}"
$DRY_RUN && echo "${COLOR_WARNING}(dry run — no files will be removed)${COLOR_RESET}"
echo

# --- Retain-policy mode ------------------------------------------------------
# When --retain-policy is set, we read .last_passing_run.json and
# .last_run_meta.json to figure out which session files and screenshot dirs
# should be kept.  Everything else is removed.
if $RETAIN_POLICY; then
    echo "${COLOR_INFO}Retain-policy mode: keeping last-passing + current-run data${COLOR_RESET}"

    # Collect paths to keep into a temp file (one per line)
    keep_list=$(mktemp)
    trap 'rm -f "$keep_list"' EXIT

    for metafile in "$LOGS_DIR/.last_passing_run.json" "$LOGS_DIR/.last_run_meta.json"; do
        if [[ -f "$metafile" ]]; then
            python3 -c "
import json, sys
meta = json.load(open('$metafile'))
for p in meta.get('session_files', []):
    print(p)
for p in meta.get('screenshot_dirs', []):
    print(p)
" >> "$keep_list" 2>/dev/null
        fi
    done

    # Remove stale sessions
    if [[ -d "$LOGS_DIR/sessions" ]]; then
        while IFS= read -r -d '' f; do
            if ! grep -qxF "$f" "$keep_list" 2>/dev/null; then
                remove_file "$f"
            fi
        done < <(find "$LOGS_DIR/sessions" -maxdepth 1 -name '*.jsonl' -print0 2>/dev/null)
    fi

    # Remove stale screenshot dirs
    if [[ -d "$LOGS_DIR/screenshots" ]]; then
        while IFS= read -r -d '' d; do
            if ! grep -qxF "$d" "$keep_list" 2>/dev/null; then
                remove_dir "$d"
            fi
        done < <(find "$LOGS_DIR/screenshots" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null)
    fi

    # Summary and exit (retain-policy doesn't apply the normal sections)
    echo
    if (( total_removed == 0 )); then
        echo "${COLOR_SUCCESS}Nothing to clean — only last-passing/current-run data present.${COLOR_RESET}"
    else
        freed="$(human_size $total_bytes)"
        if $DRY_RUN; then
            echo "${COLOR_WARNING}Would remove $total_removed items (~$freed)${COLOR_RESET}"
            echo "Run without --dry to execute."
        else
            echo "${COLOR_SUCCESS}Removed $total_removed stale items (~$freed freed)${COLOR_RESET}"
        fi
    fi
    exit 0
fi

# --- 1. Session JSONL files --------------------------------------------------
if $CLEAN_SESSIONS && [[ -d "$LOGS_DIR/sessions" ]]; then
    session_files=()
    while IFS= read -r -d '' f; do
        session_files+=("$f")
    done < <(find "$LOGS_DIR/sessions" -maxdepth 1 -name '*.jsonl' -print0 2>/dev/null | sort -z)

    if (( ${#session_files[@]} > 0 )); then
        if (( KEEP_RECENT > 0 && ${#session_files[@]} > KEEP_RECENT )); then
            # Remove oldest, keep KEEP_RECENT newest
            remove_count=$(( ${#session_files[@]} - KEEP_RECENT ))
            echo "${COLOR_INFO}Sessions: removing $remove_count of ${#session_files[@]} (keeping $KEEP_RECENT newest)${COLOR_RESET}"
            for (( i=0; i<remove_count; i++ )); do
                remove_file "${session_files[$i]}"
            done
        else
            echo "${COLOR_INFO}Sessions: removing ${#session_files[@]} JSONL files${COLOR_RESET}"
            for f in "${session_files[@]}"; do
                remove_file "$f"
            done
        fi
    else
        echo "${COLOR_DIM}Sessions: nothing to clean${COLOR_RESET}"
    fi
fi

# --- 2. Screenshot directories -----------------------------------------------
if $CLEAN_SCREENSHOTS && [[ -d "$LOGS_DIR/screenshots" ]]; then
    screenshot_dirs=()
    while IFS= read -r -d '' d; do
        screenshot_dirs+=("$d")
    done < <(find "$LOGS_DIR/screenshots" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null | sort -z)

    if (( ${#screenshot_dirs[@]} > 0 )); then
        echo "${COLOR_INFO}Screenshots: removing ${#screenshot_dirs[@]} directories${COLOR_RESET}"
        for d in "${screenshot_dirs[@]}"; do
            remove_dir "$d"
        done
    else
        echo "${COLOR_DIM}Screenshots: nothing to clean${COLOR_RESET}"
    fi
    # Remove stray .DS_Store inside screenshots/
    remove_file "$LOGS_DIR/screenshots/.DS_Store"
fi

# --- 3. Feedback reports -----------------------------------------------------
if $CLEAN_FEEDBACK && [[ -d "$LOGS_DIR/feedback" ]]; then
    feedback_files=()
    while IFS= read -r -d '' f; do
        feedback_files+=("$f")
    done < <(find "$LOGS_DIR/feedback" -maxdepth 1 -name '*.md' -print0 2>/dev/null)

    if (( ${#feedback_files[@]} > 0 )); then
        echo "${COLOR_INFO}Feedback: removing ${#feedback_files[@]} reports${COLOR_RESET}"
        for f in "${feedback_files[@]}"; do
            remove_file "$f"
        done
    else
        echo "${COLOR_DIM}Feedback: nothing to clean${COLOR_RESET}"
    fi
fi

# --- 4. Runtime log files -----------------------------------------------------
if $CLEAN_RUNTIME; then
    echo "${COLOR_INFO}Runtime logs:${COLOR_RESET}"
    # Plain-text logs generated by main.sh and setup.sh
    for logfile in bashcrawl.log setup.log; do
        remove_file "$LOGS_DIR/$logfile"
    done
    # Legacy session-*.log files
    while IFS= read -r -d '' f; do
        remove_file "$f"
    done < <(find "$LOGS_DIR" -maxdepth 1 -name 'session-*.log' -print0 2>/dev/null)
    # .DS_Store at logs root
    remove_file "$LOGS_DIR/.DS_Store"
fi

# --- Summary -----------------------------------------------------------------
echo
if (( total_removed == 0 )); then
    echo "${COLOR_SUCCESS}Nothing to clean — logs directory is already tidy.${COLOR_RESET}"
else
    freed="$(human_size $total_bytes)"
    if $DRY_RUN; then
        echo "${COLOR_WARNING}Would remove $total_removed items (~$freed)${COLOR_RESET}"
        echo "Run without --dry to execute."
    else
        echo "${COLOR_SUCCESS}Removed $total_removed items (~$freed freed)${COLOR_RESET}"
    fi
fi
