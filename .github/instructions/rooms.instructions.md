---
description: Step-by-step guide for adding new rooms, encounters, items, and quests to Bashcrawl using the data-driven registry system
applyTo: "**/entrance/**,**/src/help/data/**"
---

# Bashcrawl Room Creation Instructions

This guide explains how to add new rooms, encounters, items, and quests to Bashcrawl. The game uses a **data-driven registry** — all game content is defined in YAML files under `src/help/data/`. Both the Classic (Bash emulator) and TUI (Python Textual) modes read from these same files, so a single set of changes works everywhere.

## Architecture Overview

```
src/help/data/
├── rooms.yaml          ← Room registry (prompts, hints, map, events)
├── encounters.yaml     ← Executable script registry (loot, combat, puzzles)
├── items.yaml          ← Inventory item registry (icons, types, bonuses)
└── quests.yaml         ← Quest definitions (objectives, completion criteria)

entrance/               ← Filesystem tree that players navigate
├── scroll              ← Room documentation (cat scroll)
├── cellar/
│   ├── scroll
│   ├── treasure*       ← Executable encounter
│   └── armoury/
│       └── ...
├── .chapel/            ← Hidden room (dot-prefix, revealed by game event)
└── ...

lib/
├── room_loader.sh      ← Bash loader: parses YAML → shell variables
├── ui.sh               ← Prompt, map, inventory display (reads registry)
├── emulator.sh         ← Command dispatch (dynamic ./* execution)
└── quests.sh           ← Quest evaluator (generic, reads registry)

src/terminal-illness/ti/
├── help_data.py        ← Python loader: load_rooms/encounters/items/quests
└── quests.py           ← Python quest evaluator (reads quests.yaml)
```

## Adding a New Room

### Step 1: Create the Filesystem Directory

Create a directory under `entrance/` (or nested within an existing room). Add a `scroll` file with educational content following the scroll instructions.

```bash
mkdir -p entrance/my_new_room
touch entrance/my_new_room/scroll
```

For **hidden rooms** (revealed by game events), prefix the directory with a dot:

```bash
mkdir -p entrance/.my_secret_room
```

### Step 2: Register the Room in rooms.yaml

Add an entry to `src/help/data/rooms.yaml`. Every field is documented below.

```yaml
rooms:
  my_new_room:
    # ── Display ────────────────────────────────────────────────────
    emoji: "🏔️"                          # Emoji shown in prompt and map
    title: "THE MOUNTAIN PASS"            # Title for help screens (ALL CAPS)
    prompt_label: "mountain trail"        # Short label shown in [brackets] in prompt
    description: "A windswept mountain pass — learn about pipes"  # One-line summary

    # ── Filesystem ─────────────────────────────────────────────────
    path: "entrance/my_new_room"          # Path relative to game root (BASHCRAWL_ROOT)
    hidden: false                         # true = dot-prefixed directory (.my_new_room)
    unlocked_by: null                     # Item or event that reveals this room (or null)

    # ── Hierarchy ──────────────────────────────────────────────────
    parent: entrance                      # Parent room name (must exist in this file)
    children: []                          # Child room names (list, can be empty)

    # ── Events ─────────────────────────────────────────────────────
    on_enter: "Wind howls through the narrow pass..."   # Shown on cd into room (or null)
    on_exit: "The mountain trail fades behind you."     # Shown on cd out of room (or null)
    context_hint: "The mountain pass teaches pipes. Try 'ls | grep scroll'."  # Hint after ls

    # ── Educational ────────────────────────────────────────────────
    teaches:
      - "Piping commands with |"
      - "Filtering output with grep"
    key_files:
      - name: scroll
        description: "pipes tutorial"
    next_steps: "Continue to the summit"
    essential_commands:
      - command: "ls | grep pattern"
        description: "Pipe output to grep"
      - command: "cat scroll | wc -l"
        description: "Count lines in a scroll"
```

### Step 3: Update the Parent Room's Children

Find the parent room entry in `rooms.yaml` and add the new room name to its `children` list:

```yaml
  entrance:
    children: [cellar, workshop, chapel, vault, scrap, rift, my_new_room]
```

### Step 4: Write the Scroll

Create the scroll file following the conventions in `scrolls.instructions.md`. Match the scroll format level to the room's depth:

| Depth | Format | Example Rooms |
|-------|--------|---------------|
| 0-1 | Level 1: Raw ASCII | entrance, cellar |
| 2 | Level 2: Enhanced ASCII + Unicode | armoury, chapel |
| 3+ | Level 3: Full ASCII Art + Color | chamber, library, pit |

### Step 5: Verify

Run the game and navigate to the new room:

```bash
bash main.sh
cd entrance/my_new_room
cat scroll
```

The prompt, map highlighting, context hints, and help system will all pick up the new room automatically from the registry.

## Adding a New Encounter (Executable Script)

Encounters are executable scripts that players run with `./script_name`. They can be loot drops, combat, puzzles, spells, NPCs, traps, merchants, or riddles.

### Step 1: Create the Script

Place an executable bash script in the room directory:

```bash
cat > entrance/my_new_room/guardian << 'SCRIPT'
#!/bin/bash
# Guardian encounter — combat type
echo "A stone guardian blocks your path!"
echo ""

if echo "$I" | grep -q "sword"; then
    echo "Your sword gleams as you strike!"
    echo "The guardian crumbles to dust."
    echo ""
    echo "export I=guardian_gem,$I"
else
    echo "You have no weapon! The guardian pushes you back."
    echo "Find a sword first."
fi
SCRIPT
chmod +x entrance/my_new_room/guardian
```

### Step 2: Register the Encounter in encounters.yaml

Add an entry to `src/help/data/encounters.yaml`:

```yaml
encounters:
  guardian_mountain:
    script: "guardian"                    # Filename of the executable (no ./)
    room: "my_new_room"                  # Room name (must match rooms.yaml key)
    type: "combat"                       # loot | combat | puzzle | spell | npc | trap | merchant | riddle
    description: "A stone guardian blocks the pass"  # Shown in area context
    icon: "🗿"                           # Emoji shown next to the script name
    requires_items: []                   # Items player MUST have to run (empty = none)
    recommended_items: ["sword"]         # Items that help (shown as hints)
    grants_items: ["guardian_gem"]       # Items added to inventory on success
    unlocks_rooms: []                    # Hidden rooms revealed on success
    damage: 5                            # HP damage dealt (0 for non-combat)
```

### Encounter Types Reference

| Type | Purpose | Example |
|------|---------|---------|
| `loot` | Collect items, no challenge | `./treasure` → amulet |
| `combat` | Fight with HP/damage mechanics | `./statue` → roll vs enemy |
| `puzzle` | Solve with specific input | `./padlock` → enter combination |
| `spell` | Cast magic, create portals | `./spell` → `ln -s` portal |
| `npc` | Non-combat interaction | `./penguin` → offer fish |
| `trap` | Damage on entry, avoidable | `./fountain` → cursed damage |
| `merchant` | Trade items | (expansion-ready) |
| `riddle` | Text-based answer validation | (expansion-ready) |

## Adding a New Item

If your encounter grants a new item, register it in `src/help/data/items.yaml`:

```yaml
items:
  guardian_gem:
    icon: "💠"                           # Emoji shown in inventory display
    type: "treasure"                     # weapon | treasure | consumable | armor | quest | key
    combat_bonus: 0                      # Added to combat rolls (weapons/armor only)
    description: "A gem from the fallen guardian"  # Shown in item details
```

### Item Types Reference

| Type | Purpose | combat_bonus |
|------|---------|-------------|
| `weapon` | Combat bonus, used in fights | > 0 (e.g. sword: 10) |
| `armor` | Damage reduction | > 0 (e.g. armour: 5) |
| `treasure` | Collectible, may unlock areas | 0 |
| `consumable` | One-time use (potions) | 0 |
| `quest` | Required for specific encounters | 0 |
| `key` | Unlocks hidden rooms | 0 |

## Adding a New Quest

Quests are tracked objectives with machine-readable completion criteria. Both the Bash and Python engines evaluate them generically.

### Add an Entry to quests.yaml

```yaml
quests:
  - id: 8                               # Sequential integer (next after existing)
    title: "Mountain Mastery"            # Quest name shown in tracker
    description: "The mountain pass holds ancient secrets about pipes."
    objective: "Use a pipe command to filter the guardian's riddle."
    hint: "Try 'cat riddle | grep answer' to find the hidden word."
    required_commands:                   # Commands player must have used at least once
      - grep
    completion:                          # Machine-readable criteria (all must be true)
      command: "grep"                    # Command that triggers completion check
      location: "my_new_room"           # Pipe-separated room names (null = any)
      args: null                         # First arg must match (null = any)
      args_file: null                    # File arg must match (null = any)
      item_check: null                   # Comma-separated required items (null = none)
    reward: "200 XP and the Mountain Seer's eye"
    reward_name: "Mountain Seer's eye"   # Short name for display
    xp: 200                              # Experience points awarded
    prerequisites: null                  # Human-readable prereq description (or null)
    next_quest: null                     # ID of the next quest (null = end of chain)
```

### Completion Criteria Reference

The `completion` block is evaluated generically by both engines. All non-null fields must match:

| Field | Evaluation | Example |
|-------|-----------|---------|
| `command` | `LAST_COMMAND == value` | `"grep"` |
| `location` | Player is in one of the pipe-separated rooms | `"armoury\|cellar"` |
| `args` | First positional argument matches | `"scroll"` |
| `args_file` | File argument matches | `"notes.txt"` |
| `item_check` | All comma-separated items are in `$I` | `"amulet,coins"` |

### Linking Quests into a Chain

Use `next_quest` to create quest chains. Update the previous quest's `next_quest` to point to the new quest ID:

```yaml
  - id: 7
    # ... existing quest ...
    next_quest: 8    # ← chain to the new quest

  - id: 8
    # ... new quest ...
    next_quest: null  # ← end of chain (or next ID)
```

## Hidden Rooms and Unlock Mechanics

Hidden rooms use a dot-prefix directory (e.g. `.chapel`) that is renamed by a game script when the player meets a condition.

### Creating a Hidden Room

1. Create the directory with a dot prefix:

```bash
mkdir -p entrance/.my_secret_room
```

2. In `rooms.yaml`, set `hidden: true` and `unlocked_by`:

```yaml
  my_secret_room:
    path: "entrance/.my_secret_room"
    hidden: true
    unlocked_by: "guardian_gem"          # Item that triggers the reveal
```

3. In the encounter script that reveals it, add the `mv` command:

```bash
# Inside the guardian script, after the player wins:
if [ -d "$(dirname "$0")/../.my_secret_room" ]; then
    mv "$(dirname "$0")/../.my_secret_room" "$(dirname "$0")/../my_secret_room"
fi
```

This follows the same pattern used by `entrance/cellar/treasure` to reveal `.chapel`, `.vault`, and `.scrap`.

## Room Event Hooks

The `on_enter` and `on_exit` fields in `rooms.yaml` are displayed automatically when the player navigates with `cd`:

```yaml
  graveyard:
    on_enter: "A cold wind howls through the tombstones..."
    on_exit: "The iron gate creaks shut behind you."
```

These are fired by `safe_cd()` in `lib/emulator.sh`. Set to `null` for rooms with no atmospheric text.

## Complete Example: Adding a Room End-to-End

Here is a complete example adding a "forge" room inside the armoury.

### 1. Create filesystem

```bash
mkdir -p entrance/cellar/armoury/forge
```

### 2. Create scroll

```
entrance/cellar/armoury/forge/scroll
```

Write educational content about `chmod` and file permissions following scroll conventions.

### 3. Create encounter script

```bash
cat > entrance/cellar/armoury/forge/anvil << 'SCRIPT'
#!/bin/bash
echo "The forge's anvil glows with heat!"
if echo "$I" | grep -q "sword"; then
    echo "You temper your sword in the flames."
    echo "It emerges stronger than before!"
    echo "export I=tempered_sword,$I"
else
    echo "You need a sword to temper. Visit the armoury first."
fi
SCRIPT
chmod +x entrance/cellar/armoury/forge/anvil
```

### 4. Register in rooms.yaml

```yaml
  forge:
    emoji: "🔥"
    title: "THE FORGE"
    path: "entrance/cellar/armoury/forge"
    prompt_label: "smithy"
    context_hint: "The forge teaches file permissions. Use chmod to shape your tools!"
    hidden: false
    unlocked_by: null
    parent: armoury
    children: []
    on_enter: "Waves of heat wash over you as you enter the forge..."
    on_exit: null
    description: "A blazing forge — learn chmod and file permissions"
    teaches:
      - "File permissions with chmod"
      - "Executable vs non-executable files"
    key_files:
      - name: scroll
        description: "permissions tutorial"
      - name: anvil
        description: "forge encounter (executable)"
    next_steps: "Temper your sword, then return to the armoury"
    essential_commands:
      - command: "chmod +x filename"
        description: "Make a file executable"
      - command: "ls -l"
        description: "View file permissions"
```

Update armoury's children:

```yaml
  armoury:
    children: [chamber, forge]
```

### 5. Register encounter in encounters.yaml

```yaml
  anvil_forge:
    script: "anvil"
    room: "forge"
    type: "loot"
    description: "Temper your sword at the forge"
    icon: "🔥"
    requires_items: ["sword"]
    recommended_items: []
    grants_items: ["tempered_sword"]
    unlocks_rooms: []
    damage: 0
```

### 6. Register item in items.yaml

```yaml
  tempered_sword:
    icon: "⚔️"
    type: "weapon"
    combat_bonus: 15
    description: "A sword tempered in the forge — stronger than before"
```

### 7. Verify

```bash
bash main.sh
cd entrance/cellar/armoury/forge
cat scroll
./anvil
```

The prompt shows `🔥 forge [smithy] ⚔️`, the context hint appears after `ls`, the encounter icon shows in area context, and the inventory displays the new item with its registered icon.

## Validation Checklist

Before submitting a new room, verify:

```
FILESYSTEM:
✅ Directory exists under entrance/ (with dot-prefix if hidden)
✅ scroll file present with educational content
✅ Executable scripts have chmod +x
✅ Scripts print "export I=item,$I" for inventory changes
✅ Scripts print "export HP=value" for health changes

ROOMS.YAML:
✅ Entry exists with all required fields
✅ path matches actual filesystem path
✅ parent room exists and lists this room in children
✅ hidden matches whether directory has dot-prefix
✅ emoji is a single emoji character

ENCOUNTERS.YAML:
✅ Entry exists for each executable script in the room
✅ script field matches the filename exactly
✅ room field matches the rooms.yaml key
✅ type is one of: loot, combat, puzzle, spell, npc, trap, merchant, riddle

ITEMS.YAML:
✅ Entry exists for each new item granted by encounters
✅ icon is a single emoji character
✅ type is one of: weapon, treasure, consumable, armor, quest, key

QUESTS.YAML (if adding a quest):
✅ id is sequential (next integer after existing quests)
✅ completion block has valid command and criteria
✅ Previous quest's next_quest points to new quest id

CROSS-MODE COMPATIBILITY:
✅ Game works in Classic mode: bash main.sh
✅ Game works in TUI mode: bash main.sh --tui (if python3 + textual installed)
✅ YAML files parse without errors: python3 -c "import yaml; yaml.safe_load(open('file'))"
✅ Bash scripts parse without errors: bash -n lib/ui.sh lib/quests.sh lib/emulator.sh
```
