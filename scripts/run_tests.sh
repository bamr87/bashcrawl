#!/usr/bin/env bash
set -euo pipefail

SUITE="${1:-default}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_DIR="$ROOT_DIR/test"

export PYTHONPATH="${PYTHONPATH:-$ROOT_DIR/src:$ROOT_DIR/test}"
export BASHCRAWL_ROOT="${BASHCRAWL_ROOT:-$ROOT_DIR}"
export PYTHONUTF8="${PYTHONUTF8:-1}"
export PYTHONIOENCODING="${PYTHONIOENCODING:-utf-8}"

mkdir -p "$TEST_DIR/reports"

run_pytest() {
    local junit_file="$1"
    shift
    (
        cd "$TEST_DIR"
        python3 -m pytest "$@" --junitxml="$junit_file"
    )
}

case "$SUITE" in
    unit)
        run_pytest "reports/unit-results.xml" unit/ -v --tb=short
        ;;
    integration)
        run_pytest "reports/integration-results.xml" integration/ -v --tb=short
        ;;
    test|default)
        run_pytest "reports/unit-results.xml" unit/ -v --tb=short
        run_pytest "reports/integration-results.xml" integration/ -v --tb=short
        ;;
    all)
        (
            cd "$TEST_DIR"
            python3 -m pytest -v --tb=short --timeout=120 --junitxml=reports/all-results.xml
        )
        ;;
    *)
        echo "Unknown test suite: $SUITE" >&2
        echo "Usage: scripts/run_tests.sh [default|unit|integration|all]" >&2
        exit 2
        ;;
esac

echo "✅ Test suite passed ($SUITE)"
