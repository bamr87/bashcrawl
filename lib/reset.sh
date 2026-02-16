#!/usr/bin/env bash
# ============================================================================
# Bashcrawl Game Reset — lib/reset.sh
#
# Resets game STATE without touching source code or logging instrumentation.
# Use this instead of `git checkout -- entrance/` which wipes everything.
#
# Usage:
#   bash lib/reset.sh          # reset game state
#   bash lib/reset.sh --dry    # show what would be reset (no changes)
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GAME_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENTRANCE="$GAME_ROOT/entrance"

DRY_RUN=false
[[ "${1:-}" == "--dry" ]] && DRY_RUN=true

log() { echo "  [reset] $*"; }

if [[ ! -d "$ENTRANCE" ]]; then
    echo "ERROR: Cannot find entrance/ at $ENTRANCE"
    exit 1
fi

echo "=== Bashcrawl Game Reset ==="
echo

# 1. Re-hide unlocked rooms by renaming visible dirs back to hidden
for dir in chapel vault scrap rift; do
    visible="$ENTRANCE/$dir"
    hidden="$ENTRANCE/.$dir"
    if [[ -d "$visible" && ! -d "$hidden" ]]; then
        log "Re-hiding: $dir → .$dir"
        $DRY_RUN || mv "$visible" "$hidden"
    fi
done

# 2. Remove generated artifacts (corpses, symlinks, renamed files)
# Remove corpse files (created by gameover())
while IFS= read -r -d '' f; do
    log "Removing corpse: ${f#$GAME_ROOT/}"
    $DRY_RUN || rm -f "$f"
done < <(find "$ENTRANCE" -name 'corpse.*' -print0 2>/dev/null)

# Remove .looted markers
while IFS= read -r -d '' f; do
    log "Removing looted marker: ${f#$GAME_ROOT/}"
    $DRY_RUN || rm -f "$f"
done < <(find "$ENTRANCE" -name '.corpse.*.looted' -print0 2>/dev/null)

# Remove portal symlink in chamber
portal="$ENTRANCE/cellar/armoury/chamber/portal"
if [[ -L "$portal" ]]; then
    log "Removing portal symlink"
    $DRY_RUN || rm -f "$portal"
fi

# 3. Restore statue (remove .statue_defeated flag)
statue_flag="$ENTRANCE/cellar/armoury/chamber/.statue_defeated"
if [[ -f "$statue_flag" ]]; then
    log "Removing .statue_defeated flag"
    $DRY_RUN || rm -f "$statue_flag"
fi

# Also restore legacy pieces→statue rename if present
pieces="$ENTRANCE/cellar/armoury/chamber/pieces"
statue="$ENTRANCE/cellar/armoury/chamber/statue"
if [[ -f "$pieces" && ! -f "$statue" ]]; then
    log "Restoring statue from pieces (legacy)"
    $DRY_RUN || mv "$pieces" "$statue"
fi

# 4. Restore monster (if renamed to 'carcass')
carcass="$ENTRANCE/.chapel/courtyard/aviary/hall/carcass"
monster="$ENTRANCE/.chapel/courtyard/aviary/hall/monster"
if [[ -f "$carcass" && ! -f "$monster" ]]; then
    log "Restoring monster from carcass"
    $DRY_RUN || mv "$carcass" "$monster"
fi

# 5. Remove dynamically-created treasure files (from monster/ghost kills)
# The monster creates a treasure file when killed
hall_treasure="$ENTRANCE/.chapel/courtyard/aviary/hall/treasure"
if [[ -f "$hall_treasure" ]]; then
    log "Removing generated treasure in hall"
    $DRY_RUN || rm -f "$hall_treasure"
fi

# The ghost creates treasure + platinum files when killed
lab_treasure="$ENTRANCE/.vault/stronghold/nursery/lab/treasure"
lab_platinum="$ENTRANCE/.vault/stronghold/nursery/lab/platinum"
if [[ -f "$lab_treasure" ]]; then
    log "Removing generated treasure in lab"
    $DRY_RUN || rm -f "$lab_treasure"
fi
if [[ -f "$lab_platinum" ]]; then
    log "Removing generated platinum in lab"
    $DRY_RUN || rm -f "$lab_platinum"
fi

# 6. Restore orbs in stronghold (remove copies)
for orb in "$ENTRANCE/.vault/stronghold/orb2" "$ENTRANCE/.vault/stronghold/orb3"; do
    if [[ -f "$orb" ]]; then
        log "Removing copied orb: $(basename "$orb")"
        $DRY_RUN || rm -f "$orb"
    fi
done

# 7. Undo coin→diamond replacement in chamber/treasure
chamber_treasure="$ENTRANCE/cellar/armoury/chamber/treasure"
if [[ -f "$chamber_treasure" ]] && grep -q 'diamonds' "$chamber_treasure" 2>/dev/null; then
    log "Restoring coins (undoing diamond replacement)"
    if ! $DRY_RUN; then
        if [[ "$(uname)" == "Darwin" ]]; then
            sed -i.bak 's/diamonds/coins/g' "$chamber_treasure" && rm -f "$chamber_treasure.bak"
        else
            sed -i 's/diamonds/coins/g' "$chamber_treasure"
        fi
    fi
fi

# 8. Remove game-state file
if [[ -f "$GAME_ROOT/.game_state" ]]; then
    log "Removing .game_state"
    $DRY_RUN || rm -f "$GAME_ROOT/.game_state"
fi

# 9. Unset game environment variables
log "Unsetting game env vars (I, HP)"
if ! $DRY_RUN; then
    unset I 2>/dev/null || true
    unset HP 2>/dev/null || true
fi

echo
if $DRY_RUN; then
    echo "=== Dry run complete (no changes made) ==="
else
    echo "=== Game state reset! ==="
    echo "Start a new game:  cd entrance && cat scroll"
fi
