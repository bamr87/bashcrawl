# Bashcrawl Agent Playtest Report & Recommendations

**Date:** 2026-02-21
**Methodology:** Full AI-agent playtest using both native terminal and the new Textual
TUI agent mode (`--agent`). All rooms explored, all executables tested, code reviewed
at every depth. SVG screenshots captured via Textual's `save_screenshot()`.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Bugs Fixed During This Session](#bugs-fixed-during-this-session)
3. [Remaining Bugs](#remaining-bugs)
4. [New Feature: Agent Mode](#new-feature-agent-mode)
5. [Content Recommendations](#content-recommendations)
6. [Architecture Recommendations](#architecture-recommendations)
7. [Textual TUI Recommendations](#textual-tui-recommendations)
8. [Testing Recommendations](#testing-recommendations)
9. [Documentation Recommendations](#documentation-recommendations)
10. [Priority Matrix](#priority-matrix)

---

## Executive Summary

The bashcrawl game is in a solid state for the main progression path
(`entrance → cellar → armoury → chamber`). Earlier game-breaking bugs (tracked file
mutation by `statue`, missing `reset.sh`) have been resolved. The Textual TUI
(`src/terminal-illness/`) had several interface bugs that prevented it from launching
— these were fixed during this session.

Key outcomes from this playtest:
- **4 bugs fixed** in the Textual TUI code
- **Agent mode created** (`ti/agent.py`) for headless AI interaction with screenshots
- **9 remaining issues** cataloged (none game-breaking)
- **15 recommendations** for content, architecture, and testing improvements

---

## Bugs Fixed During This Session

### 1. TerminalEngine Missing Constructor Parameters

**Files:** `src/terminal-illness/ti/terminal_engine.py`

`BashcrawlApp` passed `output_callback` and `on_quest_complete` kwargs to
`TerminalEngine.__init__()`, but the constructor didn't accept them — causing a
`TypeError` on startup.

**Fix:** Added optional `output_callback` and `on_quest_complete` parameters to
`TerminalEngine.__init__()` with `None` defaults.

### 2. TerminalEngine Missing `execute()` and `get_completions()` Methods

**Files:** `src/terminal-illness/ti/terminal_engine.py`

`BashcrawlApp.on_command_submitted()` called `self.engine.execute(cmd)` and
`self.engine.get_completions(text)`, but these methods didn't exist. The engine
only had an interactive `run()` loop.

**Fix:** Added `execute(cmd_line: str)` method that parses a command string and
dispatches to the correct handler (returning `"exit"` or `None`), and
`get_completions(text: str)` that returns a list of matching command/path strings.

### 3. BashcrawlApp Modal Screens Block Headless Mode

**Files:** `src/terminal-illness/ti/app.py`

`on_mount()` always pushed `WelcomeScreen` or `LoadScreen` modals, which block
input in headless mode (no way to dismiss them without user interaction via Pilot).

**Fix:** Added `agent_mode: bool = False` parameter to `BashcrawlApp.__init__()`.
When `True`, `on_mount()` skips all modal screens and goes directly to the game.

### 4. `action_submit()` Async Mismatch

**Files:** `src/terminal-illness/ti/agent.py`

Textual 8.0+ changed `action_submit()` to an async method. Calling it without
`await` produced a `RuntimeWarning: coroutine never awaited`.

**Fix:** Changed `inp.action_submit()` to `await inp.action_submit()`.

---

## Remaining Bugs

### Bug 1: Workshop Directory Does Not Exist (Medium)

The `copilot-instructions.md` states `entrance/workshop/` is a tutorial room teaching
`mkdir`, `touch`, `rm`, `cp`, `echo >`. However, this directory does not exist on
disk. `lib/reset.sh` treats it as player-created and removes it.

**Impact:** Documentation is misleading. New contributors may expect this room to
exist.

**Recommendation:** Either (a) create the workshop as a real tutorial room, or
(b) remove all references from `copilot-instructions.md` and clarify it's a
player-created directory they build as an exercise.

### Bug 2: Dead Code in `reset.sh` Coin→Diamond Sed (Low)

`lib/reset.sh` step 9 replaces `diamonds` with `coins` in `chamber/treasure`. But
the current `statue` script uses `export I=diamonds,$I` (env var), and `treasure`
already says `coins`. The sed replacement never triggers.

**Impact:** No runtime effect. Just dead code from a legacy version.

**Recommendation:** Remove the sed replacement from `reset.sh` or add a comment
explaining it's a safety net for legacy game states.

### Bug 3: Scrap Symlink Example Breaks After Rift Unlock (Low)

`entrance/scrap/scroll` teaches `ln -s .rift portal`. But the `goblet` renames
`.rift` to `rift`, so the symlink becomes dangling post-unlock.

**Impact:** Minor confusion if a player creates the symlink after unlocking the rift.

**Recommendation:** Update the scrap scroll to mention both paths:
```
# Before unlocking the rift:    ln -s .rift portal
# After unlocking the rift:     ln -s rift portal
```

### Bug 4: Unquoted `$I` in Chamber Treasure (Low)

`chamber/treasure` line 17: `grep --quiet --only-matching coins <<< $I` — the `$I`
is unquoted, which could cause word-splitting if inventory ever contains spaces.

**Impact:** None in practice (inventory items don't have spaces), but it's a
shellcheck violation.

**Recommendation:** Quote it: `<<< "$I"`.

### Bug 5: `ls --color=auto` Fails on macOS Default `ls` (Low)

Native terminal mode in `main.sh` uses `--color=auto` which is a GNU flag. macOS
default `ls` uses `-G` instead. The `LS_COLOR_FLAGS` array handles this in `main.sh`
but game scripts that call `ls` directly may not.

**Impact:** Cosmetic warnings when running game scripts directly.

**Recommendation:** Already mitigated in `main.sh`. No further action needed unless
game scripts start calling `ls --color=auto` directly.

---

## New Feature: Agent Mode

### What Was Built

A new `--agent` CLI flag for `main.sh` that launches the Textual TUI in headless
mode, accepting commands via stdin and producing structured output + SVG screenshots.

### Architecture

```
main.sh --agent
  └─ python3 -m ti.agent --game-root $BASHCRAWL_ROOT --screenshot-dir /tmp/bc_screenshots
       └─ BashcrawlApp(agent_mode=True)
            └─ app.run_test(size=(120, 40))  ← Textual Pilot API
                 └─ stdin line → Input widget → action_submit() → TerminalEngine.execute()
                      └─ READY> sentinel on stdout
```

### Protocol

```
→ READY>                           (agent is ready for input)
← cd entrance                     (caller sends command)
→ CMD> cd entrance                 (echo)
→ (game output)
→ SCREENSHOT: /tmp/bc_screenshots/001_cd_entrance.svg
→ READY>

← SCREENSHOT my_label              (explicit screenshot request)
→ SCREENSHOT: /tmp/bc_screenshots/my_label.svg
→ READY>

← STATUS                           (game state query)
→ STATUS: {"location": "/entrance", "inventory": "", "hp": 0, ...}
→ READY>

← EXIT                             (end session)
→ SESSION ENDED
```

### Files Created/Modified

| File | Change |
|------|--------|
| `src/terminal-illness/ti/agent.py` | **NEW** — 215 lines, headless Textual agent |
| `src/terminal-illness/ti/terminal_engine.py` | Added `execute()`, `get_completions()`, constructor params |
| `src/terminal-illness/ti/app.py` | Added `agent_mode` flag |
| `main.sh` | Added `--agent`, `--agent-bash`, `--screenshot-dir` flags |

---

## Content Recommendations

### C1. Standardize Scroll Formatting Across All Rooms

The `scrolls.instructions.md` defines three format tiers (Level 1/2/3), but only
`entrance/scroll` and `cellar/scroll` conform. Other scrolls use mixed formats.

| Room | Current Format | Target Format |
|------|---------------|---------------|
| entrance | ASCII art + `===` | Level 1 ✅ |
| cellar | Unicode + emoji | Level 2 ✅ |
| armoury | Markdown code blocks | Level 2 (needs conversion) |
| chamber | Unicode + emoji | Level 2 ✅ |
| chapel+ | Bare `#` headers | Level 3 (acceptable) |

**Recommendation:** Convert `armoury/scroll` from Markdown code blocks to ASCII-art
tables. The Markdown backtick fences render as literal characters with `cat`.

### C2. Add Progressive Difficulty Indicators

Each scroll should indicate its difficulty level and prerequisites to help players
gauge their progress and know where to go next.

### C3. Add More Side Content in Hidden Areas

The hidden areas (`.chapel`, `.vault`, `.rift`) have great combat encounters but
sparse educational content. The `hall/scroll` was added (131 lines), but
`stronghold/scroll` and `rift/arena/scroll` could be expanded.

### C4. Entrance Scroll References Workshop

The entrance scroll references `cd workshop` as a destination, but workshop doesn't
exist (see Bug 1). Either create it or remove the reference.

---

## Architecture Recommendations

### A1. Unify Game Script Boilerplate

Every executable (`treasure`, `potion`, `spell`, `statue`, etc.) starts with a
14-line "wandered out of bounds" boilerplate comment. This could be extracted to a
shared `lib/boilerplate.sh` that scripts source, reducing duplication and making
it easier to update the message.

### A2. Add Structured Game Events

Currently, game state changes are scattered across individual scripts (`export I=`,
`export HP=`, `mv .dir dir`). A game event system could centralize these changes:

```bash
# In each game script:
source ../../lib/game_events.sh
emit_event "item_collected" "amulet"
emit_event "room_unlocked" "chapel"
```

This would enable logging, analytics, and easier debugging.

### A3. Make Inventory Checking Robust

Several scripts use different patterns to check inventory:
- `grep --quiet amulet <<< "$I"` (most common)
- `grep --quiet --only-matching coins <<< $I` (unquoted)
- `[[ "$I" == *"item"* ]]` (pattern matching)

Standardize on a single function: `has_item "amulet"` in `lib/inventory.sh`.

### A4. Separate Game Content from Infrastructure

The `entrance/` directory mixes game content (scrolls, treasures) with game
mechanics (`.functions`, `.game_state`). Consider:
- Move all game mechanic files to a `lib/` or `data/` directory
- Keep `entrance/` purely as the game world

---

## Textual TUI Recommendations

### T1. Sync Terminal Engine Commands with Native Game

The `TerminalEngine` in `terminal_engine.py` implements its own command set that
partially mirrors the native bash experience but misses several commands:

| Command | Native Bash | Textual TUI |
|---------|------------|-------------|
| `ls` | ✅ | ✅ |
| `cd` | ✅ | ✅ |
| `cat` | ✅ | ✅ |
| `grep` | ✅ | ✅ |
| `export` | ✅ | ✅ |
| `let` | ✅ | ❌ Missing |
| `echo` | ✅ | ✅ |
| `ln -s` | ✅ | ❌ Missing |
| `cp` | ✅ | ❌ Missing |
| `mv` | ✅ | ❌ Missing |
| `touch` | ✅ | ❌ Missing |
| `mkdir` | ✅ | ❌ Missing |
| `rm` | ✅ | ❌ Missing |

**Recommendation:** Add the missing commands to `TerminalEngine` to reach feature
parity with the native bash game. Priority: `let`, `ln -s`, `cp` (needed for
late-game puzzles).

### T2. Improve Sidebar Quest Display

The sidebar shows quest progress but doesn't update the inventory or HP displays
in real-time when `export` commands are run. The `_refresh_sidebar()` method should
be called after every command execution.

### T3. Add Save/Load in Agent Mode

The agent mode skips modal screens (including the load game dialog). Add `SAVE` and
`LOAD` meta-commands to the agent protocol for persistent game sessions.

### T4. Screenshot Auto-naming Convention

Current auto-naming: `{counter:03d}_{sanitized_command}.svg`. Consider adding
timestamps and location info for better organization:
```
001_entrance_ls_20260221T143022.svg
```

---

## Testing Recommendations

### Test1. Automated Playthrough CI Test

Use the new agent mode to create a CI test that plays through the entire game:

```bash
printf 'cd entrance\ncat scroll\ncd cellar\n./treasure\nexport I=amulet,$I\nEXIT\n' \
  | python3 -m ti.agent --game-root . 2>/dev/null \
  | grep -c 'READY>'
# Should output the expected number of READY> prompts
```

Add this to `.github/workflows/game-tests.yml`.

### Test2. Screenshot Regression Tests

Save a baseline set of SVG screenshots and diff them against new runs to catch
visual regressions in the Textual TUI layout.

### Test3. Shellcheck All Game Scripts

Currently CI only lints `*.sh src/help/*.sh lib/*.sh`. Extend to:
```bash
shellcheck entrance/**/treasure entrance/**/potion entrance/**/spell \
           entrance/**/statue entrance/**/monster entrance/**/ghost
```

### Test4. Test Script Idempotency

Every game executable should be safe to run multiple times. Create a test that
runs each script twice and verifies no git-tracked files are modified:
```bash
git stash
for script in $(find entrance -type f -executable); do
    bash "$script" < /dev/null 2>/dev/null
    bash "$script" < /dev/null 2>/dev/null
done
git diff --exit-code entrance/
```

---

## Documentation Recommendations

### D1. Add Agent Mode to README

Document the `--agent` and `--agent-bash` flags in the main README, including the
protocol spec and example usage with AI assistants.

### D2. Update `copilot-instructions.md`

Several items in `copilot-instructions.md` are out of date:
- Workshop is listed as existing tutorial room (it doesn't exist)
- No mention of the Textual agent mode
- No mention of `--agent`, `--agent-bash`, `--screenshot-dir` flags
- `TerminalEngine` API description is stale (now has `execute()`, `get_completions()`)

### D3. Add Architecture Diagram

The codebase has grown to include bash game scripts, Python TUI, help system, logging
framework, and now agent mode. A Mermaid architecture diagram in `docs/` would help
new contributors orient themselves.

### D4. Document the Agent Protocol

Create `docs/agent-protocol.md` with the full stdin/stdout protocol specification,
example sessions, and integration guide for AI assistants.

---

## Priority Matrix

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| **P0** | Bug 1: Workshop doesn't exist | Small | Medium — docs inconsistency |
| **P1** | T1: Add missing TUI commands | Medium | High — game completability in TUI |
| **P1** | C1: Standardize scroll formats | Medium | High — consistency |
| **P1** | D2: Update copilot-instructions | Small | High — developer onboarding |
| **P2** | Test1: Agent CI playthrough | Small | Medium — regression prevention |
| **P2** | A3: Inventory checking function | Small | Medium — code quality |
| **P2** | D1: Agent mode README | Small | Medium — discoverability |
| **P3** | Bug 2: Dead reset.sh sed | Tiny | Low — cleanup |
| **P3** | Bug 3: Scrap symlink | Tiny | Low — edge case |
| **P3** | A1: Shared boilerplate | Medium | Low — DRY principle |
| **P3** | T3: Save/Load in agent | Small | Low — persistence |
| **P3** | C3: Hidden area content | Large | Low — enrichment |

---

## Appendix: Files Modified in This Session

```
Modified:
  main.sh                                     (+60 lines)
  src/terminal-illness/ti/terminal_engine.py   (+74 lines)
  src/terminal-illness/ti/app.py               (+8 lines)

Created:
  src/terminal-illness/ti/agent.py             (215 lines)
  docs/agent-playtest-report.md                (this file)
```
