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

# Helper: re-hide a dir (mv visible → hidden), handle duplicates
_rehide() {
    local visible="$1" hidden="$2" label="$3"
    if [[ -d "$visible" && ! -d "$hidden" ]]; then
        log "Re-hiding: $label"
        $DRY_RUN || mv "$visible" "$hidden"
    elif [[ -d "$visible" && -d "$hidden" ]]; then
        log "Removing duplicate visible $(basename "$visible") (hidden copy exists)"
        $DRY_RUN || rm -rf "$visible"
    fi
}

if [[ ! -d "$ENTRANCE" ]]; then
    echo "ERROR: Cannot find entrance/ at $ENTRANCE"
    exit 1
fi

echo "=== Bashcrawl Game Reset ==="
echo

# ---- § 1  Re-hide unlocked top-level rooms --------------------------------
for dir in chapel vault scrap rift; do
    _rehide "$ENTRANCE/$dir" "$ENTRANCE/.$dir" "$dir → .$dir"
done

# ---- § 1a  Remove nested hidden duplicates (.chapel/.chapel/ etc.) ---------
# These appear when the repo accidentally contains a nested copy, or when
# a treasure script runs mv .X X while a .$X copy already exists inside.
for dir in chapel vault scrap rift; do
    nested="$ENTRANCE/.$dir/.$dir"
    nested_pre_move="$ENTRANCE/$dir/.$dir"
    if [[ -d "$nested" ]]; then
        log "Removing nested duplicate: .$dir/.$dir"
        $DRY_RUN || rm -rf "$nested"
    elif [[ -d "$nested_pre_move" ]]; then
        log "Removing nested duplicate: $dir/.$dir (will be .$dir/.$dir after re-hide)"
        $DRY_RUN || rm -rf "$nested_pre_move"
    fi
done

# ---- § 2  Graveyard: re-hide mausoleum (unlocked by padlock) ---------------
# padlock runs:  mv .mausoleum mausoleum
# Must check both chapel and .chapel paths (room may or may not be hidden).
for _base in "$ENTRANCE/.chapel/graveyard" "$ENTRANCE/chapel/graveyard"; do
    _rehide "$_base/mausoleum" "$_base/.mausoleum" "graveyard/mausoleum → .mausoleum"
done

# ---- § 2a  Royal-tombs: restore statues (renamed to king by statues script) -
# statues runs:  mv statues king
for _base in "$ENTRANCE/.chapel/graveyard/royal-tombs" "$ENTRANCE/chapel/graveyard/royal-tombs"; do
    king="$_base/king"
    statues="$_base/statues"
    if [[ -f "$king" && ! -f "$statues" ]]; then
        log "Restoring statues from king (royal-tombs)"
        $DRY_RUN || mv "$king" "$statues"
    elif [[ -f "$king" && -f "$statues" ]]; then
        log "Removing duplicate king file (statues exists)"
        $DRY_RUN || rm -f "$king"
    fi
done

# ---- § 3  Remove generated artifacts (corpses, symlinks, renamed files) -----
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

# Remove portal symlinks anywhere under entrance/
while IFS= read -r -d '' f; do
    log "Removing portal symlink: ${f#$GAME_ROOT/}"
    $DRY_RUN || rm -f "$f"
done < <(find "$ENTRANCE" -name 'portal' -type l -print0 2>/dev/null)

# Remove orphaned 'door' symlinks (created by button/display scripts in rift;
# normally auto-deleted after 10s, but persist if shell is killed mid-timer)
while IFS= read -r -d '' f; do
    log "Removing orphaned door symlink: ${f#$GAME_ROOT/}"
    $DRY_RUN || rm -f "$f"
done < <(find "$ENTRANCE" -name 'door' -type l -print0 2>/dev/null)

# ---- § 4  Re-hide the study in the library (unlocked by tome) --------------
study_visible="$ENTRANCE/.chapel/courtyard/aviary/hall/library/study"
study_hidden="$ENTRANCE/.chapel/courtyard/aviary/hall/library/.study"
_rehide "$study_visible" "$study_hidden" "library/study → library/.study"

# ---- § 5  Restore statue (remove .statue_defeated flag) --------------------
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

# ---- § 6  Restore monster (if renamed to 'carcass') ------------------------
carcass="$ENTRANCE/.chapel/courtyard/aviary/hall/carcass"
monster="$ENTRANCE/.chapel/courtyard/aviary/hall/monster"
if [[ -f "$carcass" && ! -f "$monster" ]]; then
    log "Restoring monster from carcass"
    $DRY_RUN || mv "$carcass" "$monster"
fi

# ---- § 7  Remove dynamically-created treasure files (monster/ghost kills) ---
hall_treasure="$ENTRANCE/.chapel/courtyard/aviary/hall/treasure"
if [[ -f "$hall_treasure" ]]; then
    log "Removing generated treasure in hall"
    $DRY_RUN || rm -f "$hall_treasure"
fi

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

# ---- § 8  Remove game state flag files (.bless, .curse, .armour, 15) -------
while IFS= read -r -d '' f; do
    log "Removing game state file: ${f#$GAME_ROOT/}"
    $DRY_RUN || rm -f "$f"
done < <(find "$ENTRANCE" \( -name '.bless' -o -name '.curse' -o -name '.armour' \) -type f -print0 2>/dev/null)

# Remove touch-created '15' files (columbarium puzzle artifact)
while IFS= read -r -d '' f; do
    log "Removing touch artifact: ${f#$GAME_ROOT/}"
    $DRY_RUN || rm -f "$f"
done < <(find "$ENTRANCE" -name '15' -type f -empty -print0 2>/dev/null)

# Remove armour file created by rift ./box script
for _armour in "$ENTRANCE/.rift/armour" "$ENTRANCE/rift/armour"; do
    if [[ -f "$_armour" ]]; then
        log "Removing generated armour: ${_armour#$GAME_ROOT/}"
        $DRY_RUN || rm -f "$_armour"
    fi
done

# ---- § 9  Restore orbs in stronghold (remove player-created copies) --------
for orb in "$ENTRANCE/.vault/stronghold/orb2" "$ENTRANCE/.vault/stronghold/orb3"; do
    if [[ -f "$orb" ]]; then
        log "Removing copied orb: $(basename "$orb")"
        $DRY_RUN || rm -f "$orb"
    fi
done

# ---- § 10  Rift arena pit: restore renamed files ---------------------------
# wizard-light: player may run  mv wizard-light wizard-dark
pit_dir="$ENTRANCE/.rift/arena/pit"
if [[ -f "$pit_dir/wizard-dark" && ! -f "$pit_dir/wizard-light" ]]; then
    log "Restoring wizard-light from wizard-dark"
    $DRY_RUN || mv "$pit_dir/wizard-dark" "$pit_dir/wizard-light"
fi

# drum: player may rename to disable drums (mv drum .drum, mv drum nodrum, etc.)
if [[ ! -f "$pit_dir/drum" ]]; then
    # Look for likely renamed copies
    for _candidate in "$pit_dir/.drum" "$pit_dir/nodrum" "$pit_dir/drum.bak"; do
        if [[ -f "$_candidate" ]]; then
            log "Restoring drum from $(basename "$_candidate")"
            $DRY_RUN || mv "$_candidate" "$pit_dir/drum"
            break
        fi
    done
    # If still missing, restore from git (drum is a tracked file)
    if [[ ! -f "$pit_dir/drum" ]] && command -v git >/dev/null 2>&1; then
        local_path="entrance/.rift/arena/pit/drum"
        if git -C "$GAME_ROOT" cat-file -e "HEAD:$local_path" 2>/dev/null; then
            log "Restoring drum from git HEAD"
            $DRY_RUN || git -C "$GAME_ROOT" show "HEAD:$local_path" > "$pit_dir/drum"
        fi
    fi
fi

# ---- § 11  Remove stray potion copies (player-created during nursery/spell) -
# The real potion lives at cellar/armoury/potion — remove copies elsewhere
while IFS= read -r -d '' f; do
    log "Removing stray potion copy: ${f#$GAME_ROOT/}"
    $DRY_RUN || rm -f "$f"
done < <(find "$ENTRANCE" -name 'potion' -not -path '*/armoury/potion' -type f -print0 2>/dev/null)

# ---- § 12  Restore elevator direction to initial state (UP) ----------------
direction_file="$ENTRANCE/.rift/spire/mezzanine/.elevator/.direction"
if [[ -f "$direction_file" ]]; then
    current_dir=$(cat "$direction_file" 2>/dev/null)
    if [[ "$current_dir" != "UP" ]]; then
        log "Restoring elevator direction to UP (was: $current_dir)"
        $DRY_RUN || printf 'UP\n' > "$direction_file"
    fi
fi

# ---- § 13  Undo coin→diamond replacement in chamber/treasure ---------------
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

# ---- § 14  Restore any git-tracked files overwritten by gameplay ------------
# Some scripts (nyarlathotep) overwrite tracked files with generated content.
# Use git checkout to restore them if they differ from the index.
# Only checks unstaged working-tree changes (not staged changes like git rm).
if command -v git >/dev/null 2>&1 && git -C "$GAME_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    while IFS= read -r dirty_file; do
        # Only restore entrance/ content files (not scripts we may have edited)
        if [[ "$dirty_file" == entrance/* ]]; then
            log "Restoring modified tracked file: $dirty_file"
            $DRY_RUN || git -C "$GAME_ROOT" checkout -- "$dirty_file"
        fi
    done < <(git -C "$GAME_ROOT" diff --name-only -- entrance/ 2>/dev/null)
fi

# ---- § 15  Remove save files -----------------------------------------------
# Unified save file
unified_save="$GAME_ROOT/.bashcrawl_save.json"
if [[ -f "$unified_save" ]]; then
    log "Removing .bashcrawl_save.json (unified save)"
    $DRY_RUN || rm -f "$unified_save"
fi

# Legacy bash TUI game-state files
for state_file in "$GAME_ROOT/.game_state" "$GAME_ROOT/.game_history"; do
    if [[ -f "$state_file" ]]; then
        log "Removing legacy $(basename "$state_file")"
        $DRY_RUN || rm -f "$state_file"
    fi
done

# Legacy Python TUI save file
ti_save="$GAME_ROOT/.ti_save.json"
if [[ -f "$ti_save" ]]; then
    log "Removing legacy .ti_save.json"
    $DRY_RUN || rm -f "$ti_save"
fi

# Clean stray save files in sub-directories
while IFS= read -r -d '' f; do
    log "Removing stray save: ${f#$GAME_ROOT/}"
    $DRY_RUN || rm -f "$f"
done < <(find "$GAME_ROOT" -maxdepth 3 \( -name '.ti_save.json' -o -name '.bashcrawl_save.json' \) -not -path "$ti_save" -not -path "$unified_save" -print0 2>/dev/null)

# ---- § 16  Remove player-created tutorial directories ----------------------
# Primary location is entrance/workshop (in-game). Also clean a mistakenly
# created top-level workshop/ directory if commands were run outside the game.
for target in "$ENTRANCE/workshop" "$GAME_ROOT/workshop"; do
    if [[ -d "$target" ]]; then
        log "Removing player-created directory: ${target#$GAME_ROOT/}"
        $DRY_RUN || rm -rf "$target"
    fi
done

# Some test/tool flows create workshop/ at the repo root; this is also
# runtime player state and should be removed on reset.
root_workshop="$GAME_ROOT/workshop"
if [[ -d "$root_workshop" ]]; then
    log "Removing player-created directory: workshop/"
    $DRY_RUN || rm -rf "$root_workshop"
fi

# ---- § 17  Unset game environment variables --------------------------------
log "Unsetting game env vars (I, HP, GAME_LEVEL, CURRENT_AREA)"
if ! $DRY_RUN; then
    unset I 2>/dev/null || true
    unset HP 2>/dev/null || true
    unset GAME_LEVEL 2>/dev/null || true
    unset CURRENT_AREA 2>/dev/null || true
fi

echo
if $DRY_RUN; then
    echo "=== Dry run complete (no changes made) ==="
else
    echo "=== Game state reset! ==="
    echo "Start a new game:  cd entrance && cat scroll"
fi
