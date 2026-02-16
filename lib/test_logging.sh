#!/usr/bin/env bash
# Integration test for bashcrawl logging framework
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "=== Bashcrawl Logging Framework Integration Test ==="
echo ""

# Source the logging library
source lib/log.sh
echo "✅ lib/log.sh sourced successfully"

# Start a session
bc_session_start "integration_test"
echo "✅ Session started: $_BC_SESSION_FILE"

# Simulate gameplay
export I=""
export HP=15

bc_log room_enter room=entrance
bc_log room_enter room=cellar
bc_log encounter type=treasure item=amulet outcome=collected
export I="amulet,$I"

bc_log room_enter room=cellar/armoury
bc_log encounter type=potion outcome=drank hp=15
bc_log unlock room=chapel
bc_log unlock room=vault

bc_log room_enter room=cellar/armoury/chamber
bc_log encounter type=treasure item=coins outcome=collected
export I="coins,$I"
bc_log encounter type=statue outcome=victory

bc_log room_enter room=chapel/courtyard/aviary/hall
bc_log encounter type=monster outcome=victory item=crown

bc_log death type=ghost cause=combat

echo "✅ Logged $(wc -l < "$_BC_SESSION_FILE") events"

# End session
sleep 1
bc_session_end
echo "✅ Session ended"

echo ""
echo "=== JSONL Contents ==="
cat "$_BC_SESSION_FILE"

echo ""
echo ""
echo "=== Running Report Generator ==="
bash lib/report.sh "$_BC_SESSION_FILE"

echo ""
echo "=== Running Analytics ==="
bash lib/analyze.sh --summary

echo ""
echo "=== All Tests Passed ==="
