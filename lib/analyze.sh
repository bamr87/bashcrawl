#!/usr/bin/env bash
# ============================================================================
# Bashcrawl Cross-Session Analytics — lib/analyze.sh
#
# Aggregates data across all JSONL session files for insights.
#
# Usage:
#   bash lib/analyze.sh              # full analytics dashboard
#   bash lib/analyze.sh --summary    # brief overview only
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASHCRAWL_ROOT="${SCRIPT_DIR}/.."
SESSION_DIR="${BASHCRAWL_ROOT}/logs/sessions"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
count_in_all() {
    local pattern="$1"
    local count
    count=$(grep -rh "$pattern" "$SESSION_DIR"/*.jsonl 2>/dev/null | wc -l | tr -d ' ') || count=0
    echo "$count"
}

# ---------------------------------------------------------------------------
# Main analytics
# ---------------------------------------------------------------------------
main() {
    local mode="${1:---full}"

    if ! ls "$SESSION_DIR"/*.jsonl &>/dev/null; then
        echo "No session data found in $SESSION_DIR"
        exit 0
    fi

    local total_sessions
    total_sessions=$(ls "$SESSION_DIR"/*.jsonl 2>/dev/null | wc -l | tr -d ' ')

    local total_rooms total_encounters total_deaths total_unlocks total_treasures
    total_rooms=$(count_in_all '"event":"room_enter"')
    total_encounters=$(count_in_all '"event":"encounter"')
    total_deaths=$(count_in_all '"event":"death"')
    total_unlocks=$(count_in_all '"event":"unlock"')
    total_treasures=$(count_in_all '"type":"treasure"')

    # Compute total play time from session_end events
    local total_duration=0
    while IFS= read -r line; do
        local dur
        dur=$(echo "$line" | sed -n 's/.*"duration_sec":\([0-9]*\).*/\1/p')
        [[ -n "$dur" ]] && total_duration=$((total_duration + dur))
    done < <(grep -rh '"event":"session_end"' "$SESSION_DIR"/*.jsonl 2>/dev/null)

    local total_mins=$((total_duration / 60))

    echo "============================================="
    echo "  BASHCRAWL ANALYTICS DASHBOARD"
    echo "============================================="
    echo ""
    echo "  Total Sessions:    $total_sessions"
    echo "  Total Play Time:   ${total_mins} minutes"
    echo "  Room Navigations:  $total_rooms"
    echo "  Encounters:        $total_encounters"
    echo "  Treasures Found:   $total_treasures"
    echo "  Rooms Unlocked:    $total_unlocks"
    echo "  Deaths:            $total_deaths"
    echo ""

    if [[ "$mode" == "--summary" ]]; then
        return
    fi

    # Most visited rooms
    echo "─────────────────────────────────────────────"
    echo "  TOP ROOMS (by visit count)"
    echo "─────────────────────────────────────────────"
    grep -rh '"event":"room_enter"' "$SESSION_DIR"/*.jsonl 2>/dev/null | \
        sed -n 's/.*"room":"\([^"]*\)".*/\1/p' | \
        sort | uniq -c | sort -rn | head -10 | \
        awk '{printf "  %3d  %s\n", $1, $2}'
    echo ""

    # Encounter outcomes
    echo "─────────────────────────────────────────────"
    echo "  ENCOUNTER OUTCOMES"
    echo "─────────────────────────────────────────────"
    grep -rh '"event":"encounter"' "$SESSION_DIR"/*.jsonl 2>/dev/null | \
        sed -n 's/.*"type":"\([^"]*\)".*"outcome":"\([^"]*\)".*/\1 → \2/p' | \
        sort | uniq -c | sort -rn | \
        awk '{printf "  %3d  %s\n", $1, $2" "$3" "$4}'
    echo ""

    # Death causes
    if [[ "$total_deaths" -gt 0 ]]; then
        echo "─────────────────────────────────────────────"
        echo "  DEATH CAUSES"
        echo "─────────────────────────────────────────────"
        grep -rh '"event":"death"' "$SESSION_DIR"/*.jsonl 2>/dev/null | \
            sed -n 's/.*"type":"\([^"]*\)".*/\1/p' | \
            sort | uniq -c | sort -rn | \
            awk '{printf "  %3d  %s\n", $1, $2}'
        echo ""
    fi

    # Items collected
    echo "─────────────────────────────────────────────"
    echo "  ITEMS COLLECTED"
    echo "─────────────────────────────────────────────"
    grep -rh '"outcome":"collected\|"outcome":"victory\|"outcome":"solved' "$SESSION_DIR"/*.jsonl 2>/dev/null | \
        sed -n 's/.*"item":"\([^"]*\)".*/\1/p' | \
        sort | uniq -c | sort -rn | \
        awk '{printf "  %3d  %s\n", $1, $2}'
    echo ""

    # Session durations
    echo "─────────────────────────────────────────────"
    echo "  SESSION DURATIONS"
    echo "─────────────────────────────────────────────"
    grep -rh '"event":"session_end"' "$SESSION_DIR"/*.jsonl 2>/dev/null | \
        sed -n 's/.*"duration_sec":\([0-9]*\).*/\1/p' | \
        awk 'BEGIN{min=99999;max=0;sum=0;n=0}
             {sum+=$1; n++; if($1<min)min=$1; if($1>max)max=$1}
             END{if(n>0) printf "  Sessions: %d\n  Avg: %dm %ds\n  Min: %dm %ds\n  Max: %dm %ds\n",
                 n, sum/n/60, (sum/n)%60, min/60, min%60, max/60, max%60}'
    echo ""

    echo "============================================="
    echo "  Data from: $SESSION_DIR"
    echo "============================================="
}

main "$@"
