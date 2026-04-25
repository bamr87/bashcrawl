#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-all}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

run_shellcheck() {
    echo "=== ShellCheck: .sh files ==="
    find . -name "*.sh" -not -path "./.git/*" -not -path "./.venv/*" \
        -exec shellcheck {} +

    echo "=== ShellCheck: game executables ==="
    while IFS= read -r f; do
        if [[ -f "$f" ]] && [[ "$(sed -n '1p' "$f")" == *bash* ]]; then
            shellcheck --severity=error "$f"
        fi
    done < <(find entrance/ -type f -executable 2>/dev/null)
}

run_yamllint() {
    echo "=== yamllint ==="
    yamllint -c .yamllint.yml .
}

run_markdownlint() {
    echo "=== markdownlint ==="
    markdownlint "**/*.md" --config .markdownlint.json
}

run_ruff() {
    if ! command -v ruff >/dev/null 2>&1; then
        echo "=== ruff ==="
        echo "ruff not installed; skipping Python static checks."
        return
    fi
    echo "=== ruff ==="
    ruff check \
        scripts/export_static_web.py \
        scripts/generate_contract_docs.py \
        scripts/scaffold_content.py \
        scripts/validate_runtime_commands.py \
        scripts/validate_static_web.py \
        test/unit/test_runtime_command_parity.py \
        test/unit/test_static_web.py \
        test/unit/test_viewer_intro_demo.py \
        src/terminal-illness/ti/engine/command_table.py \
        src/terminal-illness/ti/main.py
}

case "$MODE" in
    all)
        run_shellcheck
        run_yamllint
        run_markdownlint
        run_ruff
        ;;
    shell)
        run_shellcheck
        ;;
    yaml)
        run_yamllint
        ;;
    markdown)
        run_markdownlint
        ;;
    python)
        run_ruff
        ;;
    *)
        echo "Unknown lint mode: $MODE" >&2
        echo "Usage: scripts/lint.sh [all|shell|yaml|markdown|python]" >&2
        exit 2
        ;;
esac

echo "✅ Lint checks passed ($MODE)"
