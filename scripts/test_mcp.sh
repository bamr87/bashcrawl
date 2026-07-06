#!/usr/bin/env bash
set -euo pipefail

# Run MCP integration tests in an isolated local virtualenv.
# This avoids Homebrew/PEP-668 system pip restrictions on macOS.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="${ROOT_DIR}/.venv"
PYTHON_BIN="${VENV_DIR}/bin/python"
PIP_BIN="${VENV_DIR}/bin/pip"

cd "$ROOT_DIR"

if [[ ! -x "$PYTHON_BIN" ]]; then
    echo "[mcp-test] Creating virtualenv at .venv"
    python3 -m venv "$VENV_DIR"
fi

echo "[mcp-test] Installing/updating dependencies in .venv"
"$PIP_BIN" install --upgrade pip >/dev/null
"$PIP_BIN" install -r requirements.txt -r test/requirements.txt >/dev/null

echo "[mcp-test] Running playtest-harness smoke tests"
PYTHONPATH="${ROOT_DIR}/src:${ROOT_DIR}/test" \
    "$PYTHON_BIN" -m pytest -q test/integration/test_mcp_server.py
