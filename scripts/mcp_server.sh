#!/usr/bin/env bash
# Launch the Bashcrawl MCP server with PYTHONPATH set to this repo.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PYTHONPATH="$ROOT_DIR/src${PYTHONPATH:+:$PYTHONPATH}"
exec python3 -m playtest.mcp_server "$@"
