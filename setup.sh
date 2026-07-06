#!/usr/bin/env bash
# ============================================================================
# Bashcrawl setup — make the dungeon playable.
#
# The reduced game is the filesystem itself: rooms are directories, scrolls are
# files, and encounters are executable scripts. All this does is ensure those
# encounter scripts are executable, then point you at the entrance. No launcher,
# no dependencies — just bash.
#
# Usage:
#   ./setup.sh           # set permissions and print how to start
#   ./setup.sh --quick   # set permissions only (quiet; used by tooling/tests)
#   ./setup.sh --verify  # check the dungeon is playable; exit 0 OK / 1 FAIL
# ============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QUIET=false
[[ "${1:-}" == "--quick" || "${1:-}" == "-q" ]] && QUIET=true

# Executable encounter scripts scattered through the dungeon.
ENCOUNTERS=(
    treasure potion spell statue monster ghost goblet
    padlock loot glass box drummer penguin rags crystal
    open statues nyarlathotep altar fountain wizard-light button
    drum end platinum orb1 sign niches gravestones royals tome grimoire
    display
)

chmod_encounters() {
    local name f
    for name in "${ENCOUNTERS[@]}"; do
        while IFS= read -r -d '' f; do
            chmod +x "$f" 2>/dev/null || true
        done < <(find "${ROOT_DIR}/entrance" -type f -name "$name" -print0 2>/dev/null)
    done
    chmod +x "${ROOT_DIR}/help.sh" "${ROOT_DIR}/setup.sh" 2>/dev/null || true
}

# --verify: check the dungeon is playable without changing anything.
verify_setup() {
    local fail=0

    check() {
        # $1 = label; remaining args = test command to run
        local label="$1"
        shift
        if "$@"; then
            echo "  OK   ${label}"
        else
            echo "  FAIL ${label}"
            fail=1
        fi
    }

    echo "Bashcrawl setup verification:"

    check "entrance/ directory exists" test -d "${ROOT_DIR}/entrance"
    check "entrance/scroll exists" test -f "${ROOT_DIR}/entrance/scroll"
    check "help.sh exists" test -f "${ROOT_DIR}/help.sh"

    local sample
    for sample in \
        "entrance/cellar/treasure" \
        "entrance/cellar/armoury/treasure" \
        "entrance/cellar/armoury/potion" \
        "entrance/cellar/armoury/chamber/statue" \
        "entrance/cellar/armoury/chamber/spell"; do
        check "${sample} is executable" test -x "${ROOT_DIR}/${sample}"
    done

    if [[ "$fail" -eq 0 ]]; then
        echo "Result: OK — the dungeon is playable. Start with: cd entrance && cat scroll"
        return 0
    else
        echo "Result: FAIL — run ./setup.sh to fix permissions, or bash lib/reset.sh to restore state."
        return 1
    fi
}

if [[ "${1:-}" == "--verify" ]]; then
    verify_setup
    exit $?
fi

chmod_encounters

if ! $QUIET; then
    cat <<'EOF'

  ⚔  Bashcrawl is ready.

  Begin your descent with real terminal commands:

      cd entrance
      cat scroll

  Read every scroll you find, and let the dungeon teach you bash.
  Stuck? Run:  bash help.sh

  Prefer a browser? Open web/index.html, or run:  make web-preview

EOF
fi
