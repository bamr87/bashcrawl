#!/usr/bin/env bash
#
# Blank-slate playtest: drive N fresh games with Claude Code (authenticated via
# the CLAUDE_CODE_OAUTH_TOKEN subscription token) through the Bashcrawl MCP
# server, then score the sessions for content gaps.
#
# The agent is restricted to ONLY the bashcrawl MCP tools, so it must learn the
# game from on-screen content and cannot cheat by reading scrolls/walkthrough
# files directly. A transcript cheat-guard backstops the tool allowlist.
#
# Usage:   bash scripts/playtest.sh [seeds]
# Env:     CLAUDE_CODE_OAUTH_TOKEN   subscription token (`claude setup-token`)
#          BLANK_SLATE_MODEL         model id (default claude-sonnet-4-6)
#          BLANK_SLATE_MAX_TURNS     per-session turn cap (default 80)
#          BLANK_SLATE_GATE_QUEST    median furthest quest must be >= this (default 3)
#          BLANK_SLATE_GATE_SCROLL   median scroll-read %% must be >= this (default 0)
#          BLANK_SLATE_PERMISSION_MODE  claude --permission-mode (default bypassPermissions)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SEEDS="${1:-${BLANK_SLATE_SEEDS:-3}}"
MODEL="${BLANK_SLATE_MODEL:-claude-sonnet-4-6}"
MAX_TURNS="${BLANK_SLATE_MAX_TURNS:-80}"
PERMISSION_MODE="${BLANK_SLATE_PERMISSION_MODE:-bypassPermissions}"
GATE_QUEST="${BLANK_SLATE_GATE_QUEST:-3}"
GATE_SCROLL="${BLANK_SLATE_GATE_SCROLL:-0}"

LOG_DIR="$ROOT_DIR/logs/sessions/blank_slate"
TRANSCRIPT_DIR="$ROOT_DIR/logs/blank_slate_transcripts"
REPORT_DIR="$ROOT_DIR/test/reports/blank_slate"
mkdir -p "$LOG_DIR" "$TRANSCRIPT_DIR" "$REPORT_DIR"

export PYTHONPATH="$ROOT_DIR/src/terminal-illness:$ROOT_DIR/src:$ROOT_DIR/test"
export BASHCRAWL_PLAYTEST_LOG_DIR="$LOG_DIR"

# ── Guards: degrade gracefully when unconfigured (so `make` never hard-fails) ──
if ! command -v claude >/dev/null 2>&1; then
    echo "[playtest] 'claude' CLI not found — install Claude Code to run live playtests. Skipping." >&2
    exit 0
fi
if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    echo "[playtest] No CLAUDE_CODE_OAUTH_TOKEN (or ANTHROPIC_API_KEY) set." >&2
    echo "[playtest] A headless 'claude -p' subprocess does NOT inherit an interactive" >&2
    echo "[playtest] Claude Code login — it needs an explicit credential. Generate one with" >&2
    echo "[playtest] 'claude setup-token' and 'export CLAUDE_CODE_OAUTH_TOKEN=...'. Skipping." >&2
    exit 0
fi

# The MCP server needs the 'mcp' package + the 'ti' module importable. CI installs
# those into the runner's python, so the committed .mcp.json ('python3') works there.
# Locally they usually live only in .venv, so prefer that interpreter when present.
MCP_CONFIG="$ROOT_DIR/.mcp.json"
if [ -x "$ROOT_DIR/.venv/bin/python" ]; then
    MCP_CONFIG="$(mktemp -t bashcrawl_mcp.XXXXXX)"
    cat >"$MCP_CONFIG" <<JSON
{
  "mcpServers": {
    "bashcrawl": {
      "type": "stdio",
      "command": "$ROOT_DIR/.venv/bin/python",
      "args": ["-m", "ti.mcp_server"],
      "env": { "PYTHONPATH": "$ROOT_DIR/src/terminal-illness" }
    }
  }
}
JSON
    echo "[playtest] Using .venv python for the MCP server."
fi

rm -f "${LOG_DIR:?}"/*.jsonl 2>/dev/null || true
PROMPT="$(cat "$ROOT_DIR/scripts/blank_slate_prompt.txt")"

echo "[playtest] $SEEDS session(s), model=$MODEL, max-turns=$MAX_TURNS"
seed=1
while [ "$seed" -le "$SEEDS" ]; do
    echo "[playtest] --- seed $seed/$SEEDS ---"
    claude -p "${PROMPT}

(This is playtest run #${seed}. Begin now.)" \
        --mcp-config "$MCP_CONFIG" \
        --allowedTools "mcp__bashcrawl__*" \
        --disallowedTools "Bash,Read,Edit,Write,Grep,Glob,WebFetch,WebSearch,NotebookEdit,Task" \
        --permission-mode "$PERMISSION_MODE" \
        --max-turns "$MAX_TURNS" \
        --model "$MODEL" \
        --output-format stream-json --verbose \
        >"$TRANSCRIPT_DIR/seed_${seed}.jsonl" 2>"$TRANSCRIPT_DIR/seed_${seed}.err" ||
        echo "[playtest] seed $seed exited non-zero (continuing)"
    seed=$((seed + 1))
done

# ── Cheat guard: the agent must never have used a built-in tool ──
if grep -lE '"name"[[:space:]]*:[[:space:]]*"(Bash|Read|Grep|Edit|Write|Glob|WebFetch|WebSearch)"' \
    "$TRANSCRIPT_DIR"/seed_*.jsonl >/dev/null 2>&1; then
    echo "[playtest] ERROR: a built-in tool call appeared in a transcript — blank-slate guarantee broken." >&2
    exit 2
fi

shopt -s nullglob
logs=("$LOG_DIR"/*.jsonl)
if [ "${#logs[@]}" -eq 0 ]; then
    echo "[playtest] No session logs produced — the agent never started a game." >&2
    exit 3
fi

python3 -m analysis.blank_slate_report "${logs[@]}" --json --out "$REPORT_DIR/report.json"
python3 -m analysis.blank_slate_report "${logs[@]}" --out "$REPORT_DIR/report.md"
echo "[playtest] Wrote $REPORT_DIR/report.md"

# ── Gate: median furthest quest + median scroll coverage ──
python3 - "$REPORT_DIR/report.json" "$GATE_QUEST" "$GATE_SCROLL" <<'PY'
import json, sys, statistics
report = json.load(open(sys.argv[1]))
gate_quest, gate_scroll = int(sys.argv[2]), float(sys.argv[3])
sessions = report.get("sessions", [])
agg = report.get("aggregate")
if agg:
    furthest = agg["furthest_quest_median"]
else:
    furthest = sessions[0]["completeness"]["quests"]["furthest"]
scroll = statistics.median(s["completeness"]["scrolls"]["pct"] for s in sessions)
print(f"[playtest] median furthest quest={furthest} (gate >= {gate_quest}); "
      f"median scroll%={scroll} (gate >= {gate_scroll})")
sys.exit(0 if (furthest >= gate_quest and scroll >= gate_scroll) else 1)
PY
