#!/usr/bin/env bash
#
# Grok playtest: xAI drives the sandboxed dungeon through in-process harness
# tools (start/observe/command/state/stop), then the same scorer as the Claude
# blank-slate run.
#
# Usage:   bash scripts/playtest_grok.sh [seeds]
# Env:     OpenCode SuperGrok OAuth (~/.local/share/opencode/auth.json)
#          or XAI_ACCESS_TOKEN / XAI_API_KEY
#          GROK_MODEL                 (default grok-4.6)
#          BLANK_SLATE_MAX_TURNS      (default 80)
#          BLANK_SLATE_GATE_ROOMS     (default 3)
#          BLANK_SLATE_GATE_SCROLLS   (default 1)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SEEDS="${1:-${BLANK_SLATE_SEEDS:-1}}"
GATE_ROOMS="${BLANK_SLATE_GATE_ROOMS:-3}"
GATE_SCROLLS="${BLANK_SLATE_GATE_SCROLLS:-1}"

LOG_DIR="$ROOT_DIR/logs/sessions/blank_slate"
REPORT_DIR="$ROOT_DIR/test/reports/blank_slate"
mkdir -p "$LOG_DIR" "$REPORT_DIR"

export PYTHONPATH="$ROOT_DIR/src:$ROOT_DIR/test"
export BASHCRAWL_PLAYTEST_LOG_DIR="$LOG_DIR"

rm -f "${LOG_DIR:?}"/*.jsonl 2>/dev/null || true

python3 -m playtest.grok_runner --seeds "$SEEDS"

shopt -s nullglob
logs=("$LOG_DIR"/*.jsonl)
if [ "${#logs[@]}" -eq 0 ]; then
    echo "[playtest-grok] No session logs produced — Grok never started a game (or no API key)." >&2
    exit 0
fi

python3 -m playtest.scorer --log-dir "$LOG_DIR" \
    --gate-rooms "$GATE_ROOMS" --gate-scrolls "$GATE_SCROLLS" --json \
    >"$REPORT_DIR/report.json" || true
echo "[playtest-grok] Wrote $REPORT_DIR/report.json"

python3 -m playtest.scorer --log-dir "$LOG_DIR" \
    --gate-rooms "$GATE_ROOMS" --gate-scrolls "$GATE_SCROLLS"
