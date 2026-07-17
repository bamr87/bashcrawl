# Bashcrawl Improvement Plan

Based on a full interactive playtest session (2026-02-16), this document catalogs observed bugs, design gaps, and proposed improvements. See `logs/session-20260216.log` for the raw session data.

---

## Priority 1: Game-Breaking Issues

### 1. Rift Never Unlocks

**Problem:** No game mechanic triggers `mv .rift rift`. The `scrap` file hints at `ln -s ../../../../.rift portal`, which creates a symlink but does not rename the hidden directory. Players can only access `.rift` by already knowing `ls -a`.

**Fix:** Add `mv ../../.rift ../../rift 2>/dev/null` to a late-game treasure script (e.g., `vault/stronghold/goblet` or `chapel/courtyard/aviary/hall/monster`), gating it behind an inventory check for 3+ items. This follows the existing pattern used by `cellar/treasure` to unlock `chapel` and `vault`.

**Files to change:**

- `entrance/.chapel/courtyard/aviary/hall/monster` — add unlock after combat victory,
  OR
- `entrance/.vault/stronghold/goblet` — add unlock after goblet collection

---

### 2. Statue Permanently Modifies Tracked Files

**Problem:** `chamber/statue` runs `perl -pe 's/coins/diamonds/' -i ./treasure`, permanently altering the git-tracked `treasure` file. On player loss, it runs `rm treasure` and `rm spell`, deleting game content. These changes persist across sessions and show up in `git diff`.

**Fix options (pick one):**

- **A) Use env vars instead of file mutation:** Replace the `perl` command with
instructions for the player to `export I=diamonds,$I` directly. Remove `rm treasure` / `rm spell` from the loss path — instead set a file-based flag (e.g., `touch .statue_defeated`) and check it on re-entry.

- **B) Copy-on-play:** At session start (in `setup.sh`), snapshot
  mutable game files to a temp directory and restore on reset.

**Files to change:**

- `entrance/cellar/armoury/chamber/statue`
- `entrance/cellar/armoury/chamber/treasure` (if option A)

---

### 3. ~~No Game Reset Script~~ (RESOLVED)

**Status:** Resolved. `lib/reset.sh` provides game state reset.

---

## Priority 2: Content Gaps

### 4. Chamber Scroll Too Sparse

**Problem:** `entrance/cellar/armoury/chamber/scroll` is only 15 lines with minimal educational content — just "turn back" plus `cd ..` and `pwd`. Every other room at this depth has 100+ lines.

**Fix:** Expand the chamber scroll to teach concepts appropriate for its depth: environment variables (`$I`, `$HP`), `echo`, `export`, and `read`. Use the "Level 2: Intermediate" format from `scrolls.instructions.md` with Unicode box-drawing and structured sections.

**Files to change:**

- `entrance/cellar/armoury/chamber/scroll`

---

### 5. No Scroll in Hall

**Problem:** The hall (`chapel/courtyard/aviary/hall/`) has no `scroll` file. Players walk directly into the `monster` combat encounter with zero guidance or educational content.

**Fix:** Add a `scroll` file teaching a concept that helps with the encounter, such as `echo` for checking variables, `test` / `[ ]` for conditionals, or simply providing narrative context about the monster and a hint to check inventory first.

**Files to create:**

- `entrance/.chapel/courtyard/aviary/hall/scroll`

---

### 6. Workshop Has No Content

**Problem:** `entrance/workshop/` exists with empty `notes.txt` files and a nested `workshop/workshop/` directory. No educational content or game purpose.

**Fix options:**

- **A) Remove it:** Delete `entrance/workshop/` entirely — it adds no value and may
  confuse new players.
- **B) Make it a tutorial room:** Add a `scroll` teaching `mkdir`, `touch`, `rm` as
  "workshop tools". Gate it behind a flag so it's optional side-content.

**Files to change:**

- `entrance/workshop/` (remove or add content)

---

## Priority 3: Stale State Bugs

### 7. Potion Reports "Already Checked" on Fresh Sessions

**Problem:** `armoury/potion` checks for a `.potion_used` file flag rather than the `$HP` variable. If a previous session created this flag, new sessions see "already checked" even with fresh `HP=100`.

**Fix:** Either:

- Check `$HP` directly: `if [ "${HP:-0}" -lt 15 ]; then` (assumes potion sets HP=15)
- Delete `.potion_used` in `lib/reset.sh` and document the reset requirement
- Or combine both: check `.potion_used` but reset it when `$HP` is unset or zero

**Files to change:**

- `entrance/cellar/armoury/potion`
- `lib/reset.sh` (add `.potion_used` cleanup)

---

## Priority 4: Polish & Consistency

### 8. Scroll Format Inconsistency

**Problem:** Each room's scroll uses a different format:

| Room      | Format                       | Lines |
|-----------|------------------------------|-------|
| entrance  | ASCII art + `===` dividers   | 238   |
| cellar    | Unicode box-drawing + emoji  | 238   |
| armoury   | Pure Markdown + code blocks  | 178   |
| chamber   | Bare `#` comments            | 15    |
| chapel+   | Bare `#` comments            | 10-15 |

The `scrolls.instructions.md` defines clear standards: Level 1 (entrance) uses ASCII art, Level 2 (intermediate) uses Unicode box-drawing, and hidden areas use `#` comment format. Only `entrance` and `cellar` currently conform.

**Fix:** Progressively reformat scrolls to match the documented standard, starting with the worst offenders:

1. `chamber/scroll` — expand and reformat (see item 4)
2. `armoury/scroll` — convert Markdown code blocks to ASCII-art tables
3. Add `scroll` to `hall` (see item 5)

**Files to change:**

- `entrance/cellar/armoury/scroll`
- `entrance/cellar/armoury/chamber/scroll`

---

### 9. Scrap File Symlink Path Assumes Specific Depth

**Problem:** The `scrap` file (unlocked by cellar treasure) tells players to run `ln -s ../../../../.rift portal` from the chamber. This hard-coded relative path breaks if the player is in any other directory.

**Fix:** Update the `scrap` hint to be location-aware or give both relative and absolute instructions:

```
# From the chamber, create a portal:
# ln -s ../../../../.rift portal
#
# Or from the entrance:
# ln -s .rift portal
```

**Files to change:**

- `entrance/.scrap`

---

## Implementation Order

| Phase | Items | Effort   | Impact   |
|-------|-------|----------|----------|
| 1     | 3, 2  | Small    | Critical — prevents file corruption and enables replay |
| 2     | 1, 7  | Small    | High — fixes broken progression and stale state        |
| 3     | 4, 5  | Medium   | High — fills major content gaps                        |
| 4     | 6, 8, 9 | Medium | Medium — polish and consistency                        |

---

## Testing Checklist

After implementing changes, validate with a clean playthrough:

```bash
bash lib/reset.sh                # Start fresh
bash setup.sh                    # Configure permissions
cd entrance && cat scroll        # Begin game
export I="" HP=100               # Initialize state
# Play through: cellar → armoury → chamber → chapel → vault → rift
# Verify: all rooms accessible, no git-tracked changes, reset works
```
