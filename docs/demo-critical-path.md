# Bashcrawl: Complete Game Walkthrough

> **Auto-generated** from a recorded playthrough on 2026-02-16 22:23
>
> Duration: 2.2s | Steps: 28 | Rooms: 4 | Errors: 0

---

Bashcrawl is an educational text-based adventure game that teaches terminal (shell) commands through immersive fantasy gameplay. Directories are rooms, files named `scroll` are lessons, and executable scripts are interactive encounters with treasures, potions, monsters, and spells.

This walkthrough demonstrates a complete playthrough — every command a player would type, the terminal output they would see, and an explanation of what each command teaches.

The output was captured from an instrumented playthrough, so prompts, area context, quest completions, and game-script output appear exactly as a real player would see them.


## Table of Contents

1. [Chapter 1: The Entrance](#the-entrance)
2. [Chapter 2: The Cellar](#the-cellar)
3. [Chapter 3: The Armoury](#the-armoury)
4. [Chapter 4: The Chamber of Spirits](#the-chamber-of-spirits)
5. [Command Reference](#command-reference)
6. [Session Summary](#session-summary)

---

## Prerequisites

Before playing Bashcrawl, ensure you have:

1. **A terminal** — Terminal.app (macOS), GNOME Terminal (Linux),
   or Windows Subsystem for Linux (WSL)
2. **Bash shell** — Most systems include it by default
3. **Git** — To clone the repository

```bash
# Clone the game
git clone https://github.com/bashcrawl/bashcrawl.git
cd bashcrawl

# Make game files executable
bash setup.sh

# Start playing
cd entrance
cat scroll
```

---


## Chapter 1: The Entrance

The adventure begins at the dungeon entrance. Here you learn the three most fundamental terminal commands: ``pwd`` (where am I?), ``ls`` (what's here?), and ``cat`` (read a file). These three commands form the foundation of all terminal navigation.

### Entering the Dungeon

Every adventure begins with a single step. In the terminal, ``cd`` (change directory) moves you into a new directory — think of it as walking through a door. We step into the ``entrance/`` directory to begin the game.

```bash
📍 game [exploring] ⚔️cd entrance
```

> **Concepts:** `cd`, `directory navigation`

### Where Am I?

The ``pwd`` command (print working directory) shows your current location in the filesystem. In the game, this is like checking a map — it tells you which room you're standing in.

```bash
🚪 entrance [starting hall] ⚔️pwd
~/entrance
✨ Quest complete: Awakening: Know Thy Place!
   Reward: Navigation Novice ribbon (+50 XP)
🎯 QUEST TRACKER:
   Quest 2/7: Eyes to See
   Objective: Use 'ls' to reveal what surrounds you.
   Reward: Glimmering lens (+50 XP)
```

> **Concepts:** `pwd`, `working directory`

### Looking Around

The ``ls`` command lists the contents of the current directory. In the dungeon, this is like looking around the room to see what's here — files, directories, scrolls, and treasures.

```bash
🚪 entrance [starting hall] ⚔️ls
README.md
cellar/
scroll
workshop/

🚪 You stand at the entrance to the catacombs. Read the 'scroll' for guidance.
📜 There is a scroll here. Read it with: cat scroll
✨ Quest complete: Eyes to See!
   Reward: Glimmering lens (+50 XP)
🎯 QUEST TRACKER:
   Quest 3/7: First Steps
   Objective: Travel to the entrance with 'cd entrance'.
   Reward: Pathwalker's charm (+100 XP)
```

> **Concepts:** `ls`, `listing files`

### Reading Your First Scroll

The ``cat`` command displays the contents of a file. Scrolls are the game's tutorial texts — they teach you new terminal commands as you progress deeper into the dungeon. This first scroll introduces the basic commands you'll need to navigate: ``ls``, ``cd``, and ``cat``.

```bash
🚪 entrance [starting hall] ⚔️cat scroll

================================================================================
                           ANCIENT SCROLL OF SIGHT
================================================================================

It is pitch black in these catacombs.
You have a magickal spell that lists all items in a room.

BASIC MOVEMENT INCANTATIONS:
    To see in the dark:       ls
    To move around:           cd directory

================================================================================
                         MAGICKAL VIEWING SPELLS
================================================================================

COMMAND            PURPOSE                      DESCRIPTION
--------           --------                     -----------
ls                 See room contents            List all items in current room
cat filename       View scrolls fully           Display entire scroll content
less filename      Read long scrolls            Page through text (q to quit)
head filename      Peek at scroll start         See first 10 lines only
tail filename      Check scroll ending          See last 10 lines only
wc filename        Count scroll contents        Count lines, words, characters

Try looking around this room, then move into one of the next rooms.

================================================================================
                          EXAMPLE INCANTATIONS
================================================================================

    $ ls
    $ cat scroll
    $ less scroll
    $ head scroll
    $ tail scroll
    $ wc scroll
    $ cd cellar

Remember to cast these spells when you discover new scrolls and treasures!

================================================================================
                           THE FIRST CHALLENGE
================================================================================

Before you venture deeper into the catacombs, you must prove your mastery
of the viewing spells. Practice reading this very scroll with different
commands to understand their power.

NEXT DESTINATION:
When you are ready, seek the CELLAR - a chamber that lies beneath this
entrance. The cellar holds ancient secrets about seeing through illusions
and distinguishing between doorways and objects.

NAVIGATION SPELL:
    cd cellar

May your terminal skills grow strong, brave adventurer!

================================================================================
```

> **Concepts:** `cat`, `reading files`

<details>
<summary>📊 <strong>State after this chapter</strong></summary>

| Property | Value |
|----------|-------|
| **Location** | `unknown` |

</details>


---

## Chapter 2: The Cellar

The cellar lies beneath the entrance and introduces enhanced file listing with ``ls -F``, which reveals file types at a glance. You also encounter your first treasure and learn about ``export`` for managing variables.

### Descending into the Cellar

We descend deeper into the dungeon. The cellar is the second room and teaches more advanced listing techniques. Notice how each directory is a room, and navigating between them with ``cd`` is like walking through doorways.

```bash
🚪 entrance [starting hall] ⚔️cd cellar
```

> **Concepts:** `cd`, `nested directories`

### The Cellar Scroll

This scroll teaches ``ls -F``, which adds special symbols after filenames to show their type: ``/`` for directories, ``*`` for executable files, and ``@`` for symbolic links. It's like having enchanted vision that reveals the nature of objects in the room.

```bash
🏰 cellar [underground] ⚔️cat scroll

################################################################################
#                🌟 THE CELLAR OF TRUE SIGHT - ENHANCED TERMINAL VISION       #
################################################################################

🔮 ANCIENT WISDOM: Seeing Beyond the Veil
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

*The air grows thick with mystical energy as you descend into the cellar...*
*Here, ancient magic teaches adventurers to distinguish reality from illusion.*

**Illusions are strong here.** It is difficult to tell what is a doorway and what is an object.
The untrained eye sees only a simple list of names, but the wise terminal mage learns to
perceive the **true nature** of all things in the catacombs.

--------------------------------------------------------------------------------
⚡ THE ENHANCED SIGHT SPELL: ls -F
--------------------------------------------------------------------------------

The magic spell you use to look can be **augmented** with powerful enchantments.

*Master this incantation to pierce through the veils of confusion...*

┌─ ENHANCED SIGHT INCANTATION ───────────────────────────────────────────────┐
│                                                                             │
│ $ ls -F                           # Cast enhanced sight spell              │
│                                                                             │
│ Expected Manifestation:                                                     │
│ scroll  treasure*  armoury/  README.md                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
🎯 What the Mystical Symbols Reveal
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

When you cast `ls -F`, the mystical energies reveal secrets through their symbols:

┌─────────────────┬────────────────────────────┬──────────────────────────────┐
│ SYMBOL          │ TYPE                       │ DESCRIPTION                  │
├─────────────────┼────────────────────────────┼──────────────────────────────┤
│ /               │ Directory (Chamber)        │ Rooms you can enter          │
│ *               │ Executable (Encounter)     │ Interactive adventures       │
│ @               │ Symbolic Link (Portal)     │ Magical doorways             │
│ |               │ Named Pipe (Channel)       │ Communication pathways       │
│ =               │ Socket (Connection)        │ Network junction points      │
│ (none)          │ Regular File (Scroll)      │ Documents and knowledge      │
└─────────────────┴────────────────────────────┴──────────────────────────────┘

################################################################################
... (182 more lines) ...
*"In the depths of the cellar, sight becomes insight, and knowledge becomes power."*
*~ Ancient Terminal Wisdom*

**The magic grows stronger within you, brave adventurer. Press onward!**
================================================================================
```

> **Concepts:** `ls -F`, `file type indicators`

### Enhanced Vision

With ``ls -F``, we can now distinguish between regular files, directories (marked with ``/``), and executables (marked with ``*``). The ``treasure`` file shows up with an asterisk — it's a program we can run!

```bash
🏰 cellar [underground] ⚔️ls -F
README.md
armoury/
scroll
treasure*

🏰 You are in the underground cellar. Use ls -F to distinguish file types. Find the emerald!
📜 There is a scroll here. Read it with: cat scroll
⚡ Interactive elements found:
   💰 treasure - Collect treasures
```

> **Concepts:** `ls -F`, `executable indicator *`

### Finding the Amulet

The ``./`` prefix tells the shell to execute the file in the current directory. Running ``./treasure`` triggers the treasure script, which reveals an emerald amulet. The script also secretly unlocks three hidden areas accessible from the entrance level: the chapel, vault, and scrap yard.

```bash
🏰 cellar [underground] ⚔️./treasure
You have found an emerald **amulet**!

To collect treasure, you must have a variable to hold your inventory.

Create a variable and add your treasure to it like this:

export I=amulet,$I

You can always check your wealth with this command:

echo $I
```

> **Concepts:** `./`, `executing scripts`

### Collecting the Amulet

The ``export`` command sets an environment variable. Here we add ``amulet`` to our inventory variable ``$I``. The ``$I`` at the end preserves anything already in inventory. In real-world Linux, ``export`` makes variables available to child processes.

```bash
🏰 cellar [underground] ⚔️export I=amulet,$I
```

> **Concepts:** `export`, `environment variables`, `inventory`

> 🎮 **Player Action:** Run this command to update your game state.

### Checking Your Inventory

``echo`` prints text to the terminal. When combined with ``$I``, it expands the variable and shows our current inventory. This is how you check what treasures you've collected throughout the game.

```bash
🏰 cellar [underground] ⚔️echo $I
amulet,
```

> **Concepts:** `echo`, `variable expansion`

<details>
<summary>📊 <strong>State after this chapter</strong></summary>

| Property | Value |
|----------|-------|
| **Location** | `unknown` |

</details>


---

## Chapter 3: The Armoury

The armoury is stocked with weapons, potions, and knowledge about file execution. You learn to run scripts with ``./``, interact with prompts via ``read``, and manage your health points with environment variables.

### Entering the Armoury

The armoury is the third room on the main path. Here we learn about file permissions, executing scripts, and encounter our first interactive game elements — a treasure, a potion, and more.

```bash
🏰 cellar [underground] ⚔️cd armoury
```

> **Concepts:** `cd`, `game progression`

### The Armoury Scroll

This scroll teaches about executing files with ``./``, the difference between relative and absolute paths, and the ``chmod`` command for managing file permissions. In Linux, a file must have execute permission to be run as a program.

```bash
🗡️ armoury [weapons hall] ⚔️cat scroll

################################################################################
#                  🗡️  THE GRAND ARMOURY                                      #
#             Mastering Execution and Permissions                              #
################################################################################

ANCIENT WISDOM: The Art of Execution
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The metallic clang of weapons echoes through the chamber
as you enter the armoury.  Ancient weapons, magical potions,
and mystical treasures await those brave enough to master
the art of EXECUTABLE COMBAT.

Items that end with * when you run  ls -F  are executable
encounters — programs and scripts you can activate.

################################################################################
#                     ⚡ RUNNING EXECUTABLES                                  #
################################################################################

To activate an executable, use the dot-slash incantation:

    ./treasure        Activate the treasure chest
    ./potion          Consume a magical potion

THE DOT-SLASH EXPLAINED:
    .   = "right here" (current directory)
    /   = path separator
    ./  = "run the thing HERE, not some other command"

Without the dot-slash, the shell looks for system commands
instead of local files.  Always use  ./  for local scripts.

--------------------------------------------------------------------------------
⚡ RELATIVE vs ABSOLUTE PATHS
--------------------------------------------------------------------------------

RELATIVE PATHS (from where you stand):

    ./treasure           Item in THIS room
    ../treasure          Item in the room ABOVE
    chamber/spell        Item in the chamber below

ABSOLUTE PATHS (from the root of the world):

    /usr/bin/ls          System command at exact location
    ~/documents/file     File in your home territory

--------------------------------------------------------------------------------
... (76 more lines) ...
    cd chamber      Advance to the inner chamber
    cd ..           Retreat to the cellar
    pwd             Confirm your location

################################################################################
```

> **Concepts:** `./`, `chmod`, `permissions`, `paths`

### Surveying the Arsenal

Listing with ``-F`` reveals the armoury's contents. Executables (marked ``*``) include ``treasure``, ``potion``, and deeper in, the ``chamber/`` directory awaits.

```bash
🗡️ armoury [weapons hall] ⚔️ls -F
README.md
chamber/
potion*
scroll
treasure*

🗡️ You have entered the armoury. Master chmod and ./script for combat!
📜 There is a scroll here. Read it with: cat scroll
⚡ Interactive elements found:
   💰 treasure - Collect treasures
   🧪 potion - Restore health
```

> **Concepts:** `ls -F`

### Finding the Sword

The armoury's treasure reveals a gleaming silver sword. The sword is essential for combat encounters later in the game — without it, you cannot defeat the statue, monster, or ghost. Always collect every treasure you find!

```bash
🗡️ armoury [weapons hall] ⚔️./treasure
You have found a gleaming silver **sword**!  You marvel at
its craftsmanship, and you recall tales from your childhood
of the great mystic king Rannismir who bore such a sword to
protect the kingdom from the undead.

Add this item to your inventory:

export I=sword,$I

Remember, you can check your inventory:

echo $I
```

> **Concepts:** `./`, `game items`

### Equipping the Sword

We add the sword to our comma-separated inventory variable. Notice the pattern: ``export I=newitem,$I`` — this prepends the new item while keeping everything already collected. Our inventory now contains both the sword and the amulet.

```bash
🗡️ armoury [weapons hall] ⚔️export I=sword,$I
```

> **Concepts:** `export`, `string concatenation`

> 🎮 **Player Action:** Run this command to update your game state.

### Drinking the Potion

The potion script checks your ``$HP`` variable. In the session captured here, HP started at 100, so the potion sees you're already healthy and skips the offer. In a fresh session (where HP starts at 0), it would ask y/n and grant 15 HP. This shows how scripts use variable checks (``if [ "${HP:-0}" -gt 0 ]``) to branch.

```bash
🗡️ armoury [weapons hall] ⚔️./potion
You checked that bottle already.
```

> **Concepts:** `read`, `conditional logic`, `variable checks`

<details>
<summary>📊 <strong>State after this chapter</strong></summary>

| Property | Value |
|----------|-------|
| **Location** | `unknown` |

</details>


---

## Chapter 4: The Chamber of Spirits

The Chamber of Spirits is the climax of the main quest. You face the living statue in combat, master environment variables with ``export`` and ``let``, and discover the ancient art of symbolic links through the wall's inscribed runes.

### Entering the Chamber

The chamber is the deepest room on the main quest path. It contains three encounters: a living statue (combat), a treasure chest (loot), and a spell inscription (magic). This is where you'll learn about environment variables, arithmetic, and symbolic links.

```bash
🗡️ armoury [weapons hall] ⚔️cd chamber
```

> **Concepts:** `cd`, `deep navigation`

### The Chamber Scroll

The chamber's scroll teaches ``export``, ``echo``, ``let``, and ``unset`` — the core commands for managing environment variables. These concepts apply directly to real shell scripting: variables store data, ``let`` performs math, and ``export`` shares values with child processes.

```bash
💎 chamber [treasure room] ⚔️cat scroll

################################################################################
#                    🏰 THE CHAMBER OF SPIRITS                                #
################################################################################

ANCIENT WISDOM: The Power of Memory
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

You stand in a vast underground chamber lit by flickering
blue torchlight.  Runes carved into the walls pulse with
an otherworldly energy.  This is where adventurers learn
the art of MEMORY — the ability to store and recall
knowledge using the power of variables.

################################################################################
#                     📜 ENVIRONMENT VARIABLES                                #
################################################################################

In these catacombs, your memories are stored as VARIABLES.
A variable is a named container that holds a value.

--------------------------------------------------------------------------------
⚡ CREATING VARIABLES: export
--------------------------------------------------------------------------------

The export spell binds a value to a name, making it
available throughout your adventure:

    export HP=15

This creates a variable called HP with the value 15.

┌─────────────────────────────────────────────────────────────────────────────┐
│ VARIABLE REFERENCE                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ COMMAND               │ PURPOSE              │ EXAMPLE                     │
│ export VAR=value      │ Create a variable    │ export HP=15                │
│ echo $VAR             │ Read a variable      │ echo $HP                    │
│ export I=item,$I      │ Append to variable   │ export I=sword,$I           │
│ let "VAR=VAR-5"       │ Do arithmetic        │ let "HP=HP-5"               │
│ unset VAR             │ Forget a variable    │ unset HP                    │
└─────────────────────────────────────────────────────────────────────────────┘

--------------------------------------------------------------------------------
⚡ READING VARIABLES: echo
--------------------------------------------------------------------------------

The echo spell speaks aloud whatever you tell it.
When you prefix a variable name with $, echo reveals
its contents:
... (79 more lines) ...
Once you've completed this chamber, explore the entrance
for hidden rooms that your treasures may have unlocked.
Try:  ls -la ../../..

################################################################################
```

> **Concepts:** `export`, `echo`, `let`, `unset`, `variables`

### Assessing the Chamber

The chamber contains three executable encounters (marked with ``*``): the ``statue``, ``treasure``, and ``spell``. We need to fight the statue first — it guards the way forward.

```bash
💎 chamber [treasure room] ⚔️ls -F
scroll
spell*
statue*
treasure*

💎 The treasure chamber! Run ./treasure, ./statue, or ./spell for rewards.
📜 There is a scroll here. Read it with: cat scroll
⚡ Interactive elements found:
   📜 spell - Cast magic spells
   💰 treasure - Collect treasures
   ⚡ statue - Interactive element
```

> **Concepts:** `ls -F`

### Pre-Combat Inventory Check

Before engaging the statue, we verify our inventory with ``echo $I``. The sword is required to win the fight. This is a good habit — always check your gear before a battle.

```bash
💎 chamber [treasure room] ⚔️echo $I
sword,amulet,
```

> **Concepts:** `echo`, `variable inspection`

### Pre-Combat Health Check

We also check our HP. The statue deals 5 damage during the encounter, so we need at least 6 HP to survive. With 100 HP, we're well prepared.

```bash
💎 chamber [treasure room] ⚔️echo $HP
100
```

> **Concepts:** `echo`, `HP tracking`

### Fighting the Statue

The statue encounter is the main quest's combat challenge. It springs to life and attacks, dealing 5 damage. When asked if we approach and if we have a sword, we answer 'y' to both. With the sword in our inventory (verified by ``grep``), we shatter the statue and claim the diamonds within. The script uses ``let`` for HP arithmetic and ``grep`` to check inventory — two real shell techniques.

```bash
💎 chamber [treasure room] ⚔️./statue
# (input) y
# (input) y
A rugged statue stands in the corner of the room.

Do you approach it? y/n  The statue springs to life, rumbling:

WHO DARES INTRUDE UPON THE CHAMBER OF SPIRITS?

It thrusts a fist at you, hitting you for 5 damage.

The statue's eyes glow with ancient power.
Behind it, you glimpse a stash of diamonds!

Do you have a sword? y/n  You strike the statue and it breaks to pieces!
The diamonds spill onto the floor before you.

Add the diamonds to your inventory:

export I=diamonds,$I

However, you have taken damage.
Deduct 5 from your HP variable:

let "HP=HP-5"
```

> **Concepts:** `./`, `game combat`, `grep`, `let`, `interactive input`

### Collecting Diamonds

We add the diamonds to our growing inventory. The comma-separated format makes it easy to add items with ``export I=newitem,$I``.

```bash
💎 chamber [treasure room] ⚔️export I=diamonds,$I
```

> **Concepts:** `export`, `inventory management`

> 🎮 **Player Action:** Run this command to update your game state.

### Accounting for Damage

The ``let`` command performs integer arithmetic in bash. The statue hit us for 5 damage, so we subtract it from our HP. After this, HP drops from 100 to 95. In real scripting, ``let`` is used for counters, calculations, and loop conditions.

```bash
💎 chamber [treasure room] ⚔️let "HP=HP-5"
```

> **Concepts:** `let`, `bash arithmetic`

> 🎮 **Player Action:** Run this command to update your game state.

### Chamber Treasure

With the statue defeated, we claim the treasure — a stash of coins. Every treasure script follows the same pattern: check if the item is already in inventory, display it if not, and instruct the player to ``export`` it.

```bash
💎 chamber [treasure room] ⚔️./treasure

You have found a stash of **coins**!  They are old and worn
with age,  but they still gleam in the magickal light
emanating from your eyes.

Prefix this item to your inventory:

export I=coins,$I

Remember, you can check your inventory:

echo $I
```

> **Concepts:** `./`, `treasure pattern`

### Collecting Coins

We add the coins to our inventory.

```bash
💎 chamber [treasure room] ⚔️export I=coins,$I
```

> **Concepts:** `export`

> 🎮 **Player Action:** Run this command to update your game state.

### Reading the Runes

The spell inscription on the wall teaches one of the most powerful concepts in Linux: symbolic links (symlinks). A symlink is a shortcut that points to another file or directory. The runes instruct us to create a portal — a symlink — connecting this chamber to a distant part of the dungeon.

```bash
💎 chamber [treasure room] ⚔️./spell
# (input) y
Runes, the language of the ancient mystics that once ruled
this land, are inscribed upon the western wall.

Do you want to read them? y/n  You recall the lessons of Caitlyn the Green, who taught you
these ancient letters.

The runes are instructions on how to summon a portal that
will allow you to walk through an invisible door contained
in the wall.

In Bash, a symbolic link (symlink) is a *shortcut* to
another file or directory.  Create one from this room to the
adjacent one:

ln -fs ../../../chapel/courtyard/aviary/hall portal
```

> **Concepts:** `ln -s`, `symlinks`, `portals`

### Creating a Portal

The ``ln -s`` command creates a symbolic link. Here, ``portal`` becomes a shortcut to the distant aviary hall deep inside the chapel. The ``-f`` flag forces creation even if a link already exists. Symlinks are one of the most useful features in Linux — they let you create shortcuts to files and directories anywhere in the system.

```bash
💎 chamber [treasure room] ⚔️ln -fs ../../../chapel/courtyard/aviary/hall portal
```

> **Concepts:** `ln -s`, `ln -f`, `relative paths`, `symlinks`

<details>
<summary>📊 <strong>State after this chapter</strong></summary>

| Property | Value |
|----------|-------|
| **Location** | `unknown` |

</details>


---

## Command Reference

All terminal commands demonstrated in this walkthrough, organized by category.

### Navigation

| Command / Concept | Description |
|-------------------|-------------|
| `cd` | Change directory — navigate between rooms |
| `directory navigation` | directory navigation |
| `pwd` | Print working directory — show current location |
| `working directory` | working directory |
| `nested directories` | nested directories |
| `deep navigation` | deep navigation |
| `relative paths` | relative paths |

### File Viewing

| Command / Concept | Description |
|-------------------|-------------|
| `ls` | List directory contents — see what's in a room |
| `listing files` | listing files |
| `cat` | Display file contents — read scrolls and files |
| `reading files` | reading files |
| `ls -F` | List with type indicators (`/` dirs, `*` executables) |
| `file type indicators` | file type indicators |
| `executable indicator *` | executable indicator * |
| `echo` | Print text or variable values to the terminal |

### Execution

| Command / Concept | Description |
|-------------------|-------------|
| `./` | Execute a script in the current directory |
| `executing scripts` | executing scripts |
| `chmod` | Change file permissions |
| `permissions` | permissions |
| `paths` | paths |
| `read` | Read user input from stdin |

### Variables & Arithmetic

| Command / Concept | Description |
|-------------------|-------------|
| `export` | Set environment variables for child processes |
| `environment variables` | environment variables |
| `inventory` | inventory |
| `variable expansion` | variable expansion |
| `string concatenation` | string concatenation |
| `let` | Perform integer arithmetic in bash |
| `unset` | Remove an environment variable |
| `variables` | variables |
| `bash arithmetic` | bash arithmetic |

### Text Processing

| Command / Concept | Description |
|-------------------|-------------|
| `grep` | Search for patterns in text |

### Links

| Command / Concept | Description |
|-------------------|-------------|
| `ln -s` | Create a symbolic link (shortcut) |
| `symlinks` | symlinks |
| `portals` | portals |
| `ln -f` | Force-create a link, overwriting existing |

### Other

| Command / Concept | Description |
|-------------------|-------------|
| `game progression` | game progression |
| `game items` | game items |
| `conditional logic` | conditional logic |
| `variable checks` | variable checks |
| `variable inspection` | variable inspection |
| `HP tracking` | HP tracking |
| `game combat` | game combat |
| `interactive input` | interactive input |
| `inventory management` | inventory management |
| `treasure pattern` | treasure pattern |

---

## Session Summary

| Metric | Value |
|--------|-------|
| **Total Steps** | 28 |
| **Duration** | 2.2 seconds |
| **Rooms Visited** | 4 |
| **Items Collected** | 4 |
| **Encounters** | 6 |
| **Success** | ✅ Yes |

### Rooms Visited

`entrance`, `entrance/cellar`, `entrance/cellar/armoury`, `entrance/cellar/armoury/chamber`

### Items Collected

amulet, sword, diamonds, coins

### Encounters

treasure, treasure, potion, statue, treasure, spell

---

*Generated from a recorded Bashcrawl playthrough*
