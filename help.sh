#!/usr/bin/env bash
# ============================================================================
# Bashcrawl Help System — Root Compatibility Shim
#
# Delegates to src/help.sh which is the actual implementation.
# This shim exists so that existing documentation and muscle memory
# (bash help.sh) continue to work after the move to src/.
# ============================================================================
exec bash "$(dirname "${BASH_SOURCE[0]}")/src/help.sh" "$@"
