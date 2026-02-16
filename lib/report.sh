#!/usr/bin/env bash
# ============================================================================
# Bashcrawl Session Report Generator — lib/report.sh
#
# Generates a Markdown summary from a single JSONL session file.
#
# Usage:
#   bash lib/report.sh                            # latest session
#   bash lib/report.sh logs/sessions/FILE.jsonl   # specific session
#   bash lib/report.sh --all                      # all sessions
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASHCRAWL_ROOT="${SCRIPT_DIR}/.."
SESSION_DIR="${BASHCRAWL_ROOT}/logs/sessions"
FEEDBACK_DIR="${BASHCRAWL_ROOT}/logs/feedback"

# ---------------------------------------------------------------------------
# Find the session file to report on
# ---------------------------------------------------------------------------
resolve_session_file() {
    if [[ "${1:-}" == "--all" ]]; then
        echo "ALL"
        return
    fi

    if [[ -n "${1:-}" && -f "$1" ]]; then
        echo "$1"
        return
    fi

    # Find most recent session file
    local latest
    latest=$(ls -t "$SESSION_DIR"/*.jsonl 2>/dev/null | head -1)
    if [[ -z "$latest" ]]; then
        echo "ERROR: No session files found in $SESSION_DIR" >&2
        exit 1
    fi
    echo "$latest"
}

# ---------------------------------------------------------------------------
# Count events by type in a session file
# ---------------------------------------------------------------------------
count_events() {
    local file="$1"
    local event_type="$2"
    local count
    count=$(grep -c "\"event\":\"${event_type}\"" "$file" 2>/dev/null) || count=0
    echo "$count"
}

# ---------------------------------------------------------------------------
# Extract field value from a JSON line (simple pattern matching, no jq)
# ---------------------------------------------------------------------------
extract_field() {
    local line="$1"
    local field="$2"
    echo "$line" | sed -n "s/.*\"${field}\":\"\{0,1\}\([^\"},{]*\)\"\{0,1\}.*/\1/p"
}

# ---------------------------------------------------------------------------
# Generate report for one session file
# ---------------------------------------------------------------------------
generate_report() {
    local session_file="$1"
    local basename
    basename="$(basename "$session_file" .jsonl)"

    # Read session metadata
    local start_line
    start_line=$(grep '"event":"session_start"' "$session_file" 2>/dev/null | head -1)
    local end_line
    end_line=$(grep '"event":"session_end"' "$session_file" 2>/dev/null | tail -1)

    local sid="" mode="" shell_info="" os="" start_ts="" duration=""
    if [[ -n "$start_line" ]]; then
        sid=$(extract_field "$start_line" "sid")
        mode=$(extract_field "$start_line" "mode")
        shell_info=$(extract_field "$start_line" "shell")
        os=$(extract_field "$start_line" "os")
        start_ts=$(extract_field "$start_line" "ts")
    fi

    if [[ -n "$end_line" ]]; then
        duration=$(extract_field "$end_line" "duration_sec")
    fi

    # Count events
    local rooms encounters deaths helps treasures unlocks
    rooms=$(count_events "$session_file" "room_enter")
    encounters=$(count_events "$session_file" "encounter")
    deaths=$(count_events "$session_file" "death")
    helps=$(count_events "$session_file" "help_request")
    treasures=$(grep -c '"type":"treasure"' "$session_file" 2>/dev/null || echo 0)
    unlocks=$(count_events "$session_file" "unlock")

    # Extract unique rooms visited
    local unique_rooms
    unique_rooms=$(grep '"event":"room_enter"' "$session_file" 2>/dev/null | \
        sed -n 's/.*"room":"\([^"]*\)".*/\1/p' | sort -u | wc -l | tr -d ' ')

    # Format duration
    local dur_display="unknown"
    if [[ -n "$duration" && "$duration" -gt 0 ]] 2>/dev/null; then
        local mins=$((duration / 60))
        local secs=$((duration % 60))
        dur_display="${mins}m ${secs}s"
    fi

    # Build Markdown report
    cat << REPORT
# Bashcrawl Session Report

**Session ID:** ${sid:-unknown}
**Date:** ${start_ts:-unknown}
**Mode:** ${mode:-unknown}
**Shell:** ${shell_info:-unknown}
**OS:** ${os:-unknown}
**Duration:** ${dur_display}

## Summary

| Metric | Count |
|--------|-------|
| Rooms Visited | ${rooms} |
| Unique Rooms | ${unique_rooms} |
| Encounters | ${encounters} |
| Treasures Found | ${treasures} |
| Rooms Unlocked | ${unlocks} |
| Deaths | ${deaths} |
| Help Requests | ${helps} |

## Room Path

$(grep '"event":"room_enter"' "$session_file" 2>/dev/null | \
    sed -n 's/.*"room":"\([^"]*\)".*/\1/p' | \
    awk '{printf "%d. %s\n", NR, $0}')

## Encounters

$(grep '"event":"encounter"' "$session_file" 2>/dev/null | while IFS= read -r eline; do
    local etype eoutcome eitem ets
    ets=$(echo "$eline" | sed -n 's/.*"ts":"\([^"]*\)".*/\1/p')
    etype=$(echo "$eline" | sed -n 's/.*"type":"\([^"]*\)".*/\1/p')
    eoutcome=$(echo "$eline" | sed -n 's/.*"outcome":"\([^"]*\)".*/\1/p')
    eitem=$(echo "$eline" | sed -n 's/.*"item":"\([^"]*\)".*/\1/p')
    if [[ -n "$eitem" ]]; then
        echo "- **${etype}** [${ets}] ${eoutcome} (item: ${eitem})"
    else
        echo "- **${etype}** [${ets}] ${eoutcome}"
    fi
done)

## Deaths

$(if [[ "$deaths" -gt 0 ]]; then
    grep '"event":"death"' "$session_file" 2>/dev/null | while IFS= read -r dline; do
        local dtype dcause dts
        dts=$(echo "$dline" | sed -n 's/.*"ts":"\([^"]*\)".*/\1/p')
        dtype=$(echo "$dline" | sed -n 's/.*"type":"\([^"]*\)".*/\1/p')
        dcause=$(echo "$dline" | sed -n 's/.*"cause":"\([^"]*\)".*/\1/p')
        echo "- **${dtype}** [${dts}] cause: ${dcause}"
    done
else
    echo "No deaths this session."
fi)

---
*Generated by bashcrawl logging framework*
*Source: ${session_file}*
REPORT
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
    local target
    target=$(resolve_session_file "${1:-}")

    mkdir -p "$FEEDBACK_DIR" 2>/dev/null

    if [[ "$target" == "ALL" ]]; then
        for f in "$SESSION_DIR"/*.jsonl; do
            [[ -f "$f" ]] || continue
            local report_name
            report_name="$(basename "$f" .jsonl).md"
            echo "Generating report: ${FEEDBACK_DIR}/${report_name}"
            generate_report "$f" > "${FEEDBACK_DIR}/${report_name}"
        done
        echo "Done. Reports saved to ${FEEDBACK_DIR}/"
    else
        local report_name
        report_name="$(basename "$target" .jsonl).md"
        generate_report "$target" | tee "${FEEDBACK_DIR}/${report_name}"
        echo ""
        echo "Report saved to: ${FEEDBACK_DIR}/${report_name}"
    fi
}

main "$@"
