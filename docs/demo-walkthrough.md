# Bashcrawl: Complete Game Walkthrough

> **Auto-generated** from a test demo run on 2026-02-16 22:23
>
> Duration: 7.5s | Steps: 118 | Rooms: 23 | Errors: 0

---

Bashcrawl is an educational text-based adventure game that teaches
terminal (shell) commands through immersive fantasy gameplay.
Directories are rooms, files named `scroll` are lessons, and
executable scripts are interactive encounters with treasures,
potions, monsters, and spells.

This walkthrough demonstrates a complete playthrough — every command
a player would type, the terminal output they would see, and an
explanation of what each command teaches.

The output is captured from ``main.sh``'s interactive terminal
emulator running in batch mode, so prompts, area context, quest
completions, and game-script output appear exactly as a real player
would see them.


## Table of Contents

1. [Chapter 1: The Entrance](#the-entrance)
2. [Chapter 2: The Cellar](#the-cellar)
3. [Chapter 3: The Armoury](#the-armoury)
4. [Chapter 4: The Chamber of Spirits](#the-chamber-of-spirits)
5. [Chapter 5: The Workshop](#the-workshop)
6. [Chapter 6: The Chapel](#the-chapel)
7. [Chapter 7: The Aviary](#the-aviary)
8. [Chapter 8: The Great Hall](#the-great-hall)
9. [Chapter 9: The Library](#the-library)
10. [Chapter 10: The Graveyard](#the-graveyard)
11. [Chapter 11: The Vault](#the-vault)
12. [Chapter 12: The Scrap Yard](#the-scrap-yard)
13. [Chapter 13: The Rift](#the-rift)
14. [Command Reference](#command-reference)
15. [Session Summary](#session-summary)

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

# Start playing (interactive terminal emulator)
bash main.sh --interactive

# Or play natively
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

The potion script checks your ``$HP`` variable. In ``main.sh``'s interactive mode, HP starts at 100, so the potion sees you're already healthy and skips the offer. In native mode (where HP starts at 0), it would ask y/n and grant 15 HP. This shows how scripts use variable checks (``if [ "${HP:-0}" -gt 0 ]``) to branch.

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

We also check our HP. The statue deals 5 damage during the encounter, so we need at least 6 HP to survive. With 100 HP from the interactive emulator's default, we're well prepared.

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

## Chapter 5: The Workshop

The workshop is a side room off the entrance that serves as a hands-on practice lab for file management: ``mkdir``, ``touch``, ``cp``, ``rm``, and output redirection with ``>``.

### Returning to the Entrance

We navigate back to the entrance using ``..`` (parent directory) three times — from chamber to armoury to cellar to entrance. Each ``..`` moves up one level in the directory hierarchy.

```bash
💎 chamber [treasure room] ⚔️cd ../../..
✨ Quest complete: First Steps!
   Reward: Pathwalker's charm (+100 XP)
🎯 QUEST TRACKER:
   Quest 4/7: Shape the World
   Objective: Create a new space by running 'mkdir workshop' while in the entrance.
   Reward: Builder's sigil (+100 XP)
```

> **Concepts:** `cd ..`, `parent directory`

### The Workshop

The workshop is a tutorial room off the main path that teaches file manipulation commands. It's a safe space to practice creating, copying, and deleting files.

```bash
🚪 entrance [starting hall] ⚔️cd workshop
```

> **Concepts:** `cd`, `side paths`

### Workshop Scroll

This scroll teaches essential file management commands: ``mkdir`` (create directories), ``touch`` (create empty files), ``cp`` (copy files), ``rm`` (delete files), ``rmdir`` (delete empty directories), ``rm -r`` (delete recursively), and ``echo 'text' > file`` (write to files). These are the everyday tools of a system administrator.

```bash
🔧 workshop [creation tutorial] ⚔️cat scroll

================================================================================
                        THE WORKSHOP
================================================================================

You enter a cluttered workspace filled with half-finished
projects and dusty tools.  A workbench sits in the center,
covered with plans for building and organizing.

This is a place of creation and destruction — where you
learn to shape the dungeon itself.

================================================================================
                    CREATION SPELLS
================================================================================

COMMAND            PURPOSE                      DESCRIPTION
--------           --------                     -----------
mkdir NAME         Create a room                Make a new directory
touch NAME         Create an object             Make a new empty file
cp SRC DEST        Duplicate an object          Copy a file

================================================================================
                    DESTRUCTION SPELLS
================================================================================

COMMAND            PURPOSE                      DESCRIPTION
--------           --------                     -----------
rm NAME            Destroy an object            Delete a file
rmdir NAME         Collapse a room              Delete an empty directory
rm -r NAME         Obliterate a room            Delete directory and contents

       *** WARNING: rm CANNOT BE UNDONE! ***
       *** There is no "undo" in the terminal! ***

================================================================================
                    WORKSHOP CHALLENGES
================================================================================

CHALLENGE 1: Build a storage room
    mkdir storage

CHALLENGE 2: Create a note inside it
    touch storage/note.txt

CHALLENGE 3: Write to the note (using echo and redirection)
    echo "My first note" > storage/note.txt

CHALLENGE 4: Read your note
    cat storage/note.txt
... (35 more lines) ...
Return to the entrance when you're ready:

    cd ..

================================================================================
```

> **Concepts:** `mkdir`, `touch`, `cp`, `rm`, `rmdir`, `echo >`

### Leaving the Workshop

We return to the entrance to continue exploring.

```bash
🔧 workshop [creation tutorial] ⚔️cd ..
```

> **Concepts:** `cd ..`

<details>
<summary>📊 <strong>State after this chapter</strong></summary>

| Property | Value |
|----------|-------|
| **Location** | `entrance` |

</details>


---

## Chapter 6: The Chapel

With the amulet collected, the chapel's doors swing open. This hidden area introduces command history, more complex interactions, and hidden items that prove useful later.

### Hidden Rooms Revealed

After collecting the cellar treasure, three previously hidden directories were unlocked: ``chapel/``, ``vault/``, and ``scrap/``. In the original game, these were hidden as dot-directories (``.chapel``, etc.) — in Linux, files and directories starting with ``.`` are hidden from ``ls`` unless you use ``ls -a``. The treasure script used ``mv`` to rename them, revealing them.

```bash
🚪 entrance [starting hall] ⚔️ls
README.md
cellar/
chapel/
scrap/
scroll
vault/
workshop/

🚪 You stand at the entrance to the catacombs. Read the 'scroll' for guidance.
📜 There is a scroll here. Read it with: cat scroll
```

> **Concepts:** `hidden files`, `ls -a`, `mv`, `dot-directories`

### Entering the Chapel

The chapel is the first of three hidden areas unlocked after collecting the amulet. It contains an elaborate sub-dungeon with a courtyard, aviary, graveyard, and more.

```bash
🚪 entrance [starting hall] ⚔️cd chapel
```

> **Concepts:** `cd`, `hidden areas`

### Chapel Scroll

The chapel scroll teaches command history — using the UP and DOWN arrow keys to recall previous commands. This is one of the most time-saving features of any shell.

```bash
📍 chapel [exploring] ⚔️cat scroll

# There is writing upon the wall.
#
# It is written in the common language of the land.
#
# It appears to be inscribed in blood:
#
#      T U R N    B A C K
#
# Speaking of turning back:
#
# You can re-use previous commands by pressing the
# UP and DOWN arrow to scroll through your history.
# Try it!
```

> **Concepts:** `command history`, `arrow keys`

### Chapel Contents

The chapel has several items and passages, including an ``altar`` (executable — an interactive puzzle), a ``courtyard/`` directory, and a ``graveyard/`` directory. Each branch leads deeper into the chapel's mysteries.

```bash
📍 chapel [exploring] ⚔️ls -F
altar*
courtyard/
graveyard/
scroll
📜 There is a scroll here. Read it with: cat scroll
⚡ Interactive elements found:
   ⚡ altar - Interactive element
```

> **Concepts:** `ls -F`

### The Courtyard

The courtyard is an open area with a fountain, some rags on the ground, and a passage to the aviary. There are hidden items here that will help in later encounters.

```bash
📍 chapel [exploring] ⚔️cd courtyard
```

> **Concepts:** `cd`

### Courtyard Atmosphere

The courtyard scroll is atmospheric — it describes the scene rather than teaching commands directly. Not every scroll is a tutorial; some set the mood and provide clues.

```bash
🌿 courtyard [chapel grounds] ⚔️cat scroll

There is a great fountain in the center of this courtyard.
The waters are bright and clear in the magickal light
emanating from your eyes.

There were once plants growing here, but they are all
dead and gnarled now.

If you stand still here, you can hear the soft rippling
of water, and even the occasional splash.

Perhaps there are fish that yet live in the fountain?
```

> **Concepts:** `cat`, `environmental storytelling`

### Finding Hidden Items

Under the rags on the courtyard floor, we find a salted fish. This seems insignificant now, but the fish is essential for befriending the penguin in the aviary later. Game design teaches us to explore thoroughly — similarly, in Linux, important files can be in unexpected places.

```bash
🌿 courtyard [chapel grounds] ⚔️./rags
# (input) y
There's a pile of old **rags**.  They are old and worn with
age, and probably fell off of some poor adventurer.

Do you want to take the rags? y/n  As you take the rags from the floor, you find a salted fish,
probably from the rations of the former owner of these rags.
Prefix these items to your inventory:

export I=rags,fish,$I

Remember, you can check your inventory

echo $I
```

> **Concepts:** `./`, `exploration`, `game items`

### Collecting Rags and Fish

We add the rags and fish to our inventory.

```bash
🌿 courtyard [chapel grounds] ⚔️export I=rags,fish,$I
```

> **Concepts:** `export`

> 🎮 **Player Action:** Run this command to update your game state.

<details>
<summary>📊 <strong>State after this chapter</strong></summary>

| Property | Value |
|----------|-------|
| **Location** | `unknown` |

</details>


---

## Chapter 7: The Aviary

The frost-bitten aviary houses penguins and an ice crystal. Here you learn tab completion, encounter ``sed`` for text manipulation, and collect items needed for the vault.

### Into the Aviary

The aviary is a cold, frost-bitten room inhabited by penguins and containing an icy pond with a crystal. This area teaches tab completion and introduces ``grep``.

```bash
🌿 courtyard [chapel grounds] ⚔️cd aviary
```

> **Concepts:** `cd`

### Aviary Scroll

This scroll introduces tab completion — pressing TAB after typing part of a filename or command will auto-complete it. Try ``cd h`` + TAB to complete to ``cd hall/``. This is one of the most essential productivity features in any terminal.

```bash
🦅 aviary [bird sanctuary] ⚔️cat scroll

You enter a room that has been magickally frost-bitten.

Snow and frost covers the ground, an icy pond leading perhaps
to an underground lake or to the outside, is in the far corner.

A few small black and white birds waddle around the room,
taking no notice of you.

Tip:
You can make your shell autocomplete the names of files and
directories by pressing the Tab key after typing the first
few letters.

When you move to the next room, try typing

cd h

and then press TAB.
```

> **Concepts:** `tab completion`

### Aviary Contents

The aviary contains a ``crystal`` (executable), a ``penguin`` (executable encounter), a ``scroll``, and the ``hall/`` directory leading deeper.

```bash
🦅 aviary [bird sanctuary] ⚔️ls -F
crystal*
hall/
penguin*
scroll

⛪ Chapel path: Discover hidden commands and the ancient library tome.
📜 There is a scroll here. Read it with: cat scroll
⚡ Interactive elements found:
   ⚡ penguin - Interactive element
   ⚡ crystal - Interactive element
```

> **Concepts:** `ls -F`

### The Penguin Encounter

The penguin approaches us. Since we have the salted fish in our inventory, we can offer it to the penguin. The script uses ``grep`` to check if 'fish' is in our ``$I`` variable. After feeding the penguin, it teaches us ``sed`` — a stream editor that can modify text. We use it to remove the fish from our inventory string.

```bash
🦅 aviary [bird sanctuary] ⚔️./penguin
# (input) y
# (input) y
One of the birds finally notices your presence.  It turns
its head sideways, seemingly beckoning for you to come
closer.

Do you get closer? y/n  You take a step forward, and the bird rushes toward you, its
mouth open wide.

Do you happen to have a fish? y/n  
You toss the fish at the penguin,  which catches the fish
mid-air and gobbles it down.

Don't forget to remove the fish from your inventory.  Try
the following command:

export I=$(sed "s/fish//; s/,,/,/" <<< $I)
```

> **Concepts:** `./`, `grep`, `sed`, `string manipulation`

### Removing the Fish

The ``sed`` command (stream editor) performs text substitution. ``s/fish//`` removes 'fish' from our inventory string, and ``s/,,/,/`` cleans up any double commas left behind. The ``$()`` syntax runs a command and captures its output — called command substitution. The ``<<<`` operator is a here-string that feeds a variable directly to a command's stdin.

```bash
🦅 aviary [bird sanctuary] ⚔️export I=$(sed "s/fish//; s/,,/,/" <<< $I)
```

> **Concepts:** `sed`, `command substitution`, `$()`, `here-string`

> 🎮 **Player Action:** Run this command to update your game state.

### The Ice Crystal

A white crystal forged by the Queen of Winter lies in the icy pond. We collect it — this crystal will be needed later in the vault to enchant our sword for the ghost fight. Pay attention to items that seem decorative; they often have a purpose later.

```bash
🦅 aviary [bird sanctuary] ⚔️./crystal
A white crystal, forged by the Queen of Winter, on the
frosty ground.

You can prefix this item to your inventory:

I=crystal,$I

Remember, you can check your inventory:

echo $I
```

> **Concepts:** `./`

### Collecting the Crystal

We add the crystal to our inventory.

```bash
🦅 aviary [bird sanctuary] ⚔️export I=crystal,$I
```

> **Concepts:** `export`

> 🎮 **Player Action:** Run this command to update your game state.

<details>
<summary>📊 <strong>State after this chapter</strong></summary>

| Property | Value |
|----------|-------|
| **Location** | `unknown` |

</details>


---

## Chapter 8: The Great Hall

The great hall introduces ``grep`` — one of Linux's most powerful search tools — and a combat encounter with a fearsome monster guarding a treasure.

### Entering the Hall

The hall is a large chamber at the end of the aviary path. A fearsome monster guards a library beyond. This room teaches ``grep`` — one of the most powerful search commands in Linux.

```bash
🦅 aviary [bird sanctuary] ⚔️cd hall
```

> **Concepts:** `cd`

### The Hall Scroll

This scroll teaches ``grep`` — a command that searches for patterns in text. ``grep WORD file`` finds lines containing WORD. ``grep -r`` searches recursively through directories. ``grep WORD <<< "$VAR"`` searches a variable. The ``--quiet`` flag suppresses output and is used in scripts for silent checks.

```bash
🏛️ hall [grand chamber] ⚔️cat scroll

################################################################################
#                      🏚️  THE DARKENED HALL                                  #
################################################################################

ANCIENT WISDOM: Know Your Enemy
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The air grows thick and foul.  Claw marks gouge the stone
walls, and the remnants of shattered weapons litter the
floor.  Something dangerous lurks ahead.

Before you proceed, prepare yourself.

--------------------------------------------------------------------------------
⚡ CHECK YOUR READINESS
--------------------------------------------------------------------------------

A wise adventurer checks their supplies before battle:

    echo $I           Check your inventory
    echo $HP          Check your health

If you have a SWORD, your attacks will be stronger.
If you don't, consider retreating to find one.

    If your inventory shows:  sword,amulet,
    you are ready to fight.

    If not:  cd ..  to go back and explore.

--------------------------------------------------------------------------------
⚡ VARIABLE TESTING: grep
--------------------------------------------------------------------------------

The grep spell searches for a pattern within text.
It can check if you carry a specific item:

    grep sword <<< "$I"

If 'sword' is in your inventory, grep will print it.
If not, grep prints nothing and returns an error code.

┌─────────────────────────────────────────────────────────────────────────────┐
│ GREP REFERENCE                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ COMMAND                      │ PURPOSE                                     │
│ grep WORD FILE               │ Search for WORD in a file                   │
│ grep WORD <<< "$VAR"         │ Search for WORD in a variable               │
│ grep --quiet WORD <<< "$I"   │ Silent check (for scripts)                  │
... (25 more lines) ...
    let "HP=HP-5"

GOOD LUCK, ADVENTURER.

################################################################################
```

> **Concepts:** `grep`, `grep -r`, `grep --quiet`, `here-strings`

### Hall Contents

The hall contains the ``monster`` (executable combat encounter), the ``library/`` directory, and a scroll.

```bash
🏛️ hall [grand chamber] ⚔️ls -F
library/
monster*
scroll

⛪ Chapel path: Discover hidden commands and the ancient library tome.
📜 There is a scroll here. Read it with: cat scroll
⚡ Interactive elements found:
   👹 monster - Combat encounter
```

> **Concepts:** `ls -F`

### Monster Combat

The monster encounter is a random combat system. You pick a number, and both you and the monster get random attack rolls. Having the sword gives a significant bonus. On victory, the monster is slain and drops a crown treasure. On defeat, you take 5 HP damage and can try again. The combat uses bash's ``$RANDOM`` variable, ``let`` for arithmetic, and ``grep`` to check for the sword.

```bash
🏛️ hall [grand chamber] ⚔️./monster
# (input) y
# (input) 5
A hulking three-legged beast, with a mouth full of fangs and
a barbed tail and 8 arms, lumbers toward you.

If you have a sword, you can attack.  Otherwise, you should
run.

Do you want to attack? y/n  Enter a number:  The monster rolled  18
You rolled  62
A hit! A palpable hit!  You have slain the beast.
```

> **Concepts:** `$RANDOM`, `let`, `grep`, `game combat`

### Post-Combat Loot

After defeating the monster, new files appear: ``treasure`` and ``carcass`` (the defeated monster renamed). The monster script dynamically created the treasure file — showing how scripts can modify the filesystem.

```bash
🏛️ hall [grand chamber] ⚔️ls -F
carcass*
library/
scroll
treasure*

⛪ Chapel path: Discover hidden commands and the ancient library tome.
📜 There is a scroll here. Read it with: cat scroll
⚡ Interactive elements found:
   ⚡ carcass - Interactive element
   💰 treasure - Collect treasures
```

> **Concepts:** `ls`, `dynamic file creation`

### Claiming the Crown

The monster dropped a crown. This treasure will be needed at the royal tombs in the graveyard.

```bash
🏛️ hall [grand chamber] ⚔️./treasure
# (input) y
You have found a **crown**!  Add it to your inventory.
```

> **Concepts:** `./`

### Collecting the Crown

We add the crown to our inventory.

```bash
🏛️ hall [grand chamber] ⚔️export I=crown,$I
```

> **Concepts:** `export`

> 🎮 **Player Action:** Run this command to update your game state.

<details>
<summary>📊 <strong>State after this chapter</strong></summary>

| Property | Value |
|----------|-------|
| **Location** | `unknown` |

</details>


---

## Chapter 9: The Library

A small, atmospheric library with dusty tomes. A brief respite before the graveyard.

### The Library

A small library with dusty shelves and an ancient tome. This room is more atmospheric — it hints at the deeper lore of the dungeon.

```bash
🏛️ hall [grand chamber] ⚔️cd library
```

> **Concepts:** `cd`

### Library Scroll

The library scroll describes the room's atmosphere.

```bash
📚 library [ancient tomes] ⚔️cat scroll
#
# You are in a small library.  There are
# shelves on all sides of the room,
# containing many books and knicknacks.
# Before you, there is a small table
# with a very large book open on it.
#
```

> **Concepts:** `cat`

### To the Graveyard

We navigate from the library back up through the hall, aviary, courtyard, and chapel, then into the graveyard. Using multiple ``..`` segments lets us traverse large distances in the directory tree in one command.

```bash
📚 library [ancient tomes] ⚔️cd ../../../../graveyard
```

> **Concepts:** `cd`, `relative paths`, `..`

<details>
<summary>📊 <strong>State after this chapter</strong></summary>

| Property | Value |
|----------|-------|
| **Location** | `entrance/chapel/graveyard` |

</details>


---

## Chapter 10: The Graveyard

The graveyard is an elaborate puzzle area teaching ``touch``, ``sort``, pipes (``|``), and ``uniq``. Three codes must be found across its sub-areas to unlock the mausoleum.

### Graveyard Atmosphere

The graveyard scroll sets 'a haunting scene — tombstones, skeletal trees, and a mausoleum sealed with a rusty padlock. We need to find three numbers to unlock it.

```bash
🪦 graveyard [resting place] ⚔️cat scroll
# The graveyard is a haunting place, shrouded in mist and silence.
#
# Rusted iron gates creak in the cold wind, leading to a field of
# weathered tombstones, some cracked and others half-hidden by ivy.
#
# Twisted, barren trees loom over the field, with branches like
# skeletal fingers reaching toward a perpetually overcast sky.
# The air is thick with the scent of damp earth and decay.
# Every footstep on the gravel path seems to echo in
# the oppressive stillness.
#
# A dark and crumbling mausoleum stands ominously in the
# centre, its door secured with an old rusty padlock.
```

> **Concepts:** `cat`

### Graveyard Layout

The graveyard has several sub-areas: ``columbarium/``, ``lower-quadrant/``, ``royal-tombs/``. The ``padlock`` executable guards the hidden mausoleum. Three numbers are hidden across these sub-areas.

```bash
🪦 graveyard [resting place] ⚔️ls -F
columbarium/
lower-quadrant/
padlock*
royal-tombs/
scroll

🪦 The graveyard holds secrets. Use ls -a to find the hidden mausoleum.
📜 There is a scroll here. Read it with: cat scroll
⚡ Interactive elements found:
   ⚡ padlock - Interactive element
```

> **Concepts:** `ls -F`

### The Columbarium

The columbarium — a wall of burial niches. We need to find the right niche number and create a file with ``touch``.

```bash
🪦 graveyard [resting place] ⚔️cd columbarium
```

> **Concepts:** `cd`

### Columbarium Puzzle

The scroll teaches ``touch`` — creating empty files. We need to create a file named ``15`` (the correct niche number), then run ``./open`` to receive the first code.

```bash
📍 columbarium [exploring] ⚔️cat scroll
# Before you is the columbarium, a weathered stone structure
# adorned with carvings of angels and vines. Rows of niches
# line its walls, some with long burnt-out candles, others
# with worn inscriptions and small tokens of remembrance.
#
# Many have distinctive symbols on their front. Maybe you 
# can find one that is helpful.
#
# If you think you have found the right niche, you can touch
# it with the following command:
# 
# touch <number of niche>
#
# This creates an empty file in the current room (directory).
# After you have created the file, try to "open" the niche.
#
# If you know a spell that helps you search, you can make it easier
# for yourself.
```

> **Concepts:** `touch`, `file creation`

### Touching the Right Niche

``touch`` creates an empty file with the given name. In this case, creating file ``15`` signals to the ``open`` script that we've found the right niche. In real Linux, ``touch`` is commonly used to create placeholder files or update file timestamps.

```bash
📍 columbarium [exploring] ⚔️touch 15
```

> **Concepts:** `touch`

### Opening the Niche

The niche reveals the number **2712** — the first of three codes needed to unlock the mausoleum padlock.

```bash
📍 columbarium [exploring] ⚔️./open
You open the niche, revealing a hidden plaque with a number etched 
into its surface. The quiet of the graveyard thickens as the number 
**2712** emerges from the shadows.

Remember the number by adding it to your inventory:

export I=2712,$I
```

> **Concepts:** `./`

### Remembering the Code

We store the first padlock code in our inventory.

```bash
📍 columbarium [exploring] ⚔️export I=2712,$I
```

> **Concepts:** `export`

> 🎮 **Player Action:** Run this command to update your game state.

### Lower Quadrant

The lower quadrant of the graveyard has old gravestones that need to be sorted to find a key date.

```bash
📍 columbarium [exploring] ⚔️cd ../lower-quadrant
```

> **Concepts:** `cd`

### Sorting the Gravestones

This scroll teaches the ``sort`` command — it arranges lines of text in alphabetical or numerical order. We use it to sort the gravestones and find a familiar name with an important year.

```bash
📍 lower-quadrant [exploring] ⚔️cat scroll
# In the lower quadrant of the graveyard, the land dips slightly,
# and fog clings to the uneven ground. The gravestones here are
# modest and small, many leaning with age, with inscriptions
# barely legible beneath creeping ivy.
#
# The air is damp and heavy, carrying the scent of wet earth and
# decay. The faint sound of trickling water from an unseen stream
# accentuates the stillness of the graveyard.
#
# As you try to make sense of the gravestones, a spell comes
# to your mind that could be helpful.
# You can sort the gravestones by date with the spell:
#
# sort gravestones
#
# Once you do this, look for a familiar name and take 
# note of the year of death. Add the year to your Inventory:
#
# export I=<year of death>,$I
```

> **Concepts:** `sort`

### Reading the Sorted Stones

``sort`` arranges the gravestone entries. We look for a name that connects to the game's lore and note the year **1765** — the second padlock code.

```bash
📍 lower-quadrant [exploring] ⚔️sort gravestones
1765,1702,Frederick Kingsley
1781,1724,Henry Abernathy
1787,1736,Agnes Merriweather
1798,1743,Ezekiel Carrington
1800,1758,Jonathan Hale
1802,1749,Harriet Fenwick
1812,1760,Philip Tremont
1820,1768,Matthias Blackwood
1824,1771,Vivian Radcliffe
1831,1777,Oswald Sinclair
1832,1785,Samuel Garrison
1843,1790,Gregor Wilhelm
1846,1783,Nicholas Barlow
1851,1797,Louisa Cartwright
1853,1805,Cornelius Drummond
1854,1799,Isabel Montrose
1863,1809,Lydia Redgrave
1864,1811,Catherine Delacroix
1867,1820,Josephine Clarke
1869,1822,Victor Hartwell
1870,1816,Alexander Grimshaw
1872,1828,Evelyn Winters
1875,1832,Eleanor Hawthorne
1880,1835,Martha Holloway
1887,1839,Beatrice Lovelace
1889,1840,Edgar Ravenscroft
1893,1847,Sarah Whitmore
1901,1852,Barnabas Drake
1908,1867,Annabelle Lancaster
1910,1859,Margaret Westfield
1914,1863,Alice Kensington
1917,1871,Thomas Yates
1926,1883,Eliza Mayfield
1932,1885,Rupert Ashton
1935,1889,Simon Blackwell
1937,1895,Isabella Thorne
1945,1901,Lucille Gray
1950,1903,Harold Griffiths
1954,1910,Diana Albright
1960,1915,Clara Montague
Year of Death,Birth Year,Name
```

> **Concepts:** `sort`, `text processing`

### Second Code

We store the second padlock code.

```bash
📍 lower-quadrant [exploring] ⚔️export I=1765,$I
```

> **Concepts:** `export`

> 🎮 **Player Action:** Run this command to update your game state.

### Royal Tombs

The royal tombs contain stone statues — one of which can receive the crown we took from the monster.

```bash
📍 lower-quadrant [exploring] ⚔️cd ../royal-tombs
```

> **Concepts:** `cd`

### Royal Tombs Atmosphere

Weathered marble, cracked tombs, stone angels and lions — the royal tombs are the resting place of ancient kings.

```bash
📍 royal-tombs [exploring] ⚔️cat scroll
# As you enter the plot of royal graves, a sense of faded grandeur
# fills the air. The once imposing gravestones, crafted from marble
# and adorned with royal crests, now show signs of neglect, their
# surfaces weathered and chipped. Moss creeps up the bases of the
# monuments, and the intricate carvings of crowns and heraldry are
# worn by time.
#
# A few of the grandest tombs have cracked open, iron gates rusted
# and askew. The stone angels and lions, meant to stand as vigilant
# guardians, are more forlorn than proud. It is quiet here, save for
# an occasional rustle of dry leaves and the distant call of a crow 
# echoing through the stillness.
```

> **Concepts:** `cat`

### Placing the Crown

The statues encounter checks our inventory for the crown. We need to choose the correct statue (number 5 — the king). Placing the crown reveals the third code: **7432**. The script also teaches ``sed`` for removing items from inventory.

```bash
📍 royal-tombs [exploring] ⚔️./statues
# (input) y
# (input) 5
Standing in front of the statues, you are thinking about the symbols
on the padlock. Do you have an item in your inventory that looks familiar?

Do you have the item? y/n  
You hold the crown in your hands, pondering where to place it.

Enter the number of the statue where you want to place the crown:  
You come upon a solitary grave marked by a grand statue of a king,
his once-majestic figure now weathered and worn. The crown
that once adorned his head is missing. Vines climb the statue's base,
weaving around the king's feet.

As you gently place the crown on the statue's head, a low rumble
echoes through the ground, and the stone king's eyes slowly open,
glowing with an ethereal light. The statue shifts, raising its arm
to reveal a hidden engraving on the base—a secret number, **7432**
etched in ancient script. It faintly pulses gold, and the king nods
solemnly to you before returning to stillness.

Remove the crown from your inventory:

export I=$(sed 's/crown,//' <<< $I)

Remember the number by adding it to your inventory:

export I=7432,$I
```

> **Concepts:** `./`, `grep`, `sed`, `interactive puzzles`

### Third Code

We store the third and final padlock code.

```bash
📍 royal-tombs [exploring] ⚔️export I=7432,$I
```

> **Concepts:** `export`

> 🎮 **Player Action:** Run this command to update your game state.

### Removing the Crown

The crown was placed on the statue, so we remove it from our inventory using ``sed``.

```bash
📍 royal-tombs [exploring] ⚔️export I=$(echo $I | sed 's/crown//;s/,,/,/')
```

> **Concepts:** `sed`, `command substitution`

> 🎮 **Player Action:** Run this command to update your game state.

### Back to Graveyard

We return to the graveyard entrance.

```bash
📍 royal-tombs [exploring] ⚔️cd ..
```

> **Concepts:** `cd ..`

### Unlocking the Mausoleum

The padlock checks our inventory for the three codes: 2712, 1765, and 7432. With all three present, the padlock opens and the mausoleum directory is revealed (renamed from ``.mausoleum`` to ``mausoleum``).

```bash
🪦 graveyard [resting place] ⚔️./padlock
# (input) y
The old padlock features three dials, each adorned with a distinct
symbol:
  an amulet
  a crown
  a tombstone with the initials F.K. 

The dials are worn and scratched, their numbers barely visible beneath
layers of rust and grime. The intricate symbols, though faded, hint at
the lock's connection to ancient, enigmatic lore.

have you found the numbers? y/n  
The old crumbling mausoleum stands silent and imposing, its weathered
stone facade adorned with creeping ivy and shattered stained glass
windows. The heavy, rusted padlock on the large, ornately carved wooden
door glints faintly in the dim light as you prepare to enter, the ancient
numbers you've gathered poised to reveal the secrets within.

As the padlock clatters to the ground, the mausoleum's door creaks open,
revealing a dimly lit interior cloaked in dust and cobwebs.
```

> **Concepts:** `./`, `mv`, `unlocking hidden dirs`

### The Mausoleum

The newly unlocked mausoleum contains loot, a room description file, and a spell scroll.

```bash
🪦 graveyard [resting place] ⚔️cd mausoleum
```

> **Concepts:** `cd`

### Mausoleum Scroll

The mausoleum scroll teaches ``cat`` on specific files and hints at using ``./loot`` after solving the room's puzzle.

```bash
📍 mausoleum [exploring] ⚔️cat scroll
# Inside the decayed mausoleum, you catch glimpses of
# tarnished silver urns, rusted candlesticks, and ornate chests
# scattered among the debris. The grand chamber is filled with
# relics of a bygone era, half-buried and cloaked in dust. 
#
# It would be unwise to sift through the loot, for there are
# often traps protecting the belongings of the dead.
#
# Check the contents of the room with:
# 
# cat room
#
# Once you have found the number of the correct item, pick it up
# by running the "loot" script.
```

> **Concepts:** `cat`

### Reading the Room

The ``room`` file contains descriptions of items with numbers — we need to find the right combination to answer the loot script's question.

```bash
📍 mausoleum [exploring] ⚔️cat room
This is not the spell you are looking for 0123456789
This is not the debris you are looking for 0123456789
This is not the urn you are looking for 0123456789
This is not the debris you are looking for 0123456789
This is not the debris you are looking for 0123456789
This is not the urn you are looking for 0123456789
This is not the spell you are looking for 0123456789
This is not the chest you are looking for 0123456789
This is not the spell you are looking for 0123456789
This is not the debris you are looking for 0123456789
This is not the debris you are looking for 0123456789
This is not the spell you are looking for 0123456789
This is not the urn you are looking for 0123456789
This is not the debris you are looking for 0123456789
This is not the urn you are looking for 0123456789
This is not the spell you are looking for 0123456789
This is not the urn you are looking for 0123456789
This is not the chest you are looking for 0123456789
This is not the urn you are looking for 0123456789
This is not the candlesticks you are looking for 0123456789
This is not the urn you are looking for 0123456789
This is not the candlesticks you are looking for 0123456789
This is not the chest you are looking for 0123456789
This is not the candlesticks you are looking for 0123456789
This is not the debris you are looking for 0123456789
This is not the spell you are looking for 0123456789
This is not the chest you are looking for 0123456789
This is not the debris you are looking for 0123456789
This is not the spell you are looking for 0123456789
This is not the chest you are looking for 0123456789
This is not the spell you are looking for 0123456789
This is not the urn you are looking for 0123456789
This is not the spell you are looking for 0123456789
This is not the urn you are looking for 0123456789
This is not the urn you are looking for 0123456789
This is not the chest you are looking for 0123456789
This is not the debris you are looking for 0123456789
This is not the urn you are looking for 0123456789
This is not the candlesticks you are looking for 0123456789
This is not the urn you are looking for 0123456789
This is not the debris you are looking for 0123456789
This is not the spell you are looking for 0123456789
This is not the urn you are looking for 0123456789
This is not the chest you are looking for 0123456789
This is not the debris you are looking for 0123456789
This is not the spell you are looking for 0123456789
This is not the debris you are looking for 0123456789
This is not the spell you are looking for 0123456789
This is not the debris you are looking for 0123456789
This is not the urn you are looking for 0123456789
... (354 more lines) ...
This is not the candlesticks you are looking for 0123456789
This is not the chest you are looking for 0123456789
This is not the candlesticks you are looking for 0123456789
This is not the urn you are looking for 0123456789
This is the spell you are looking for
```

> **Concepts:** `cat`

### The Spell of Aid

This spell teaches piping: ``sort room | uniq``. The pipe (``|``) sends the output of one command as input to another. ``uniq`` removes consecutive duplicate lines. Together, they help decode the room's puzzle.

```bash
📍 mausoleum [exploring] ⚔️cat spell
# As you hastily scan the room, your gaze falls upon a tattered,
# ancient scroll partially protruding from beneath a crumbled
# chest. Ignoring the other trinkets, you pull it free, revealing
# faded runes scratched onto the fragile parchment. Unfurling the
# scroll, you recognize it as a spell of aid:
# 
# In decayed rooms where shadows stay,
# 'uniq' will charm the clones away.
#
# You can combine spells (commands) with a pipe (|) character.
# The "uniq" command omits repeated lines.
# Sort the room, and then pipe its output
# to "uniq" for a short list. Try the incantation:
#
# sort room | uniq
```

> **Concepts:** `pipe |`, `sort`, `uniq`

### Solving the Puzzle

We pipe ``sort`` output through ``uniq`` to eliminate duplicates and reveal the true contents. The answer code is **27121981**.

```bash
📍 mausoleum [exploring] ⚔️sort room | uniq
This is not the candlesticks you are looking for 0123456789
This is not the chest you are looking for 0123456789
This is not the debris you are looking for 0123456789
This is not the spell you are looking for 0123456789
This is not the urn you are looking for 0123456789
This is the chest you are looking for note: 27121981
This is the spell you are looking for
```

> **Concepts:** `pipe |`, `sort`, `uniq`

### Claiming the Loot

We enter the code **27121981**. If correct, we receive gold coins, a bracelet, and silver keys. Wrong answers cause the mausoleum to collapse, re-hiding it and triggering a game over.

```bash
📍 mausoleum [exploring] ⚔️./loot
# (input) 27121981
As your hand hovers over the array of chests, you feel an eerie
pull toward one in particular.

What is the number of your choice?  As you pry it open, a soft creak reveals its contents. You find a
trove of ancient **gold coins**, a jewel-encrusted **bracelet**
with a large emerald, and a set of **silver keys** engraved with 
mysterious runes. The treasures glimmer with a hint of long-
forgotten wealth and secrets.

Add the Items to your inventory with:

export I=goldcoins,bracelet,silverkeys,$I,
```

> **Concepts:** `./`, `interactive scripts`

### Mausoleum Loot

We collect all three items from the mausoleum.

```bash
📍 mausoleum [exploring] ⚔️export I=goldcoins,bracelet,silverkeys,$I,
```

> **Concepts:** `export`

> 🎮 **Player Action:** Run this command to update your game state.

### Returning to Entrance

We navigate back to the entrance level.

```bash
📍 mausoleum [exploring] ⚔️cd ../../..
```

> **Concepts:** `cd`, `..`

<details>
<summary>📊 <strong>State after this chapter</strong></summary>

| Property | Value |
|----------|-------|
| **Location** | `entrance` |

</details>


---

## Chapter 11: The Vault

The vault holds the key to the final area. You enchant your sword with an ice crystal, solve the orb/goblet puzzle using ``cp``, and face a ghostly wizard in combat.

### Entering the Vault

The vault is the second hidden area. It contains glass shards, a stronghold with the goblet puzzle, and deeper within, a nursery and a ghost.

```bash
🚪 entrance [starting hall] ⚔️cd vault
```

> **Concepts:** `cd`

### Vault Scroll

The vault scroll describes an eerie scene — glass shards that seem to watch you, and a painting of two goblets.

```bash
📍 vault [exploring] ⚔️cat scroll

# You have entered an asymmetric room with shards of glass
# arranged along the floor in haphazard patterns.
#
# As you move past them, they each appear to turn slightly,
# as if watching you go.
#
# On the wall is a picture of two goblets:
# one glows brightly,
# the other shines darkly
```

> **Concepts:** `cat`

### Vault Contents

The vault contains ``glass`` (executable — for the ice crystal), ``scroll``, and ``stronghold/`` (directory leading deeper).

```bash
📍 vault [exploring] ⚔️ls -F
glass*
scroll
stronghold/
📜 There is a scroll here. Read it with: cat scroll
⚡ Interactive elements found:
   ⚡ glass - Interactive element
```

> **Concepts:** `ls -F`

### Enchanting the Sword

The glass encounter checks if we have the ice crystal from the aviary. If so, we can place it among the glass shards to enchant our sword with blizzard power. This gives +2 bonus in the ghost fight. The script uses ``grep`` to check inventory and ``sed`` to remove the crystal.

```bash
📍 vault [exploring] ⚔️./glass
# (input) y
Do you have an ice crystal? y/n  You place the ice crystal among the shards of glass.  The
sword in your hands becomes cold.  You feel the power of
1000 blizzards coursing through it.

Don't forget to remove the crystal from your inventory.  Try
the following command:

export I=$(sed 's/crystal,//' <<< $I)
```

> **Concepts:** `./`, `grep`, `sed`, `game mechanics`

### Crystal Consumed

The crystal was used to enchant our sword, so we remove it from inventory.

```bash
📍 vault [exploring] ⚔️export I=$(echo $I | sed 's/crystal//;s/,,/,/')
```

> **Concepts:** `sed`, `command substitution`

> 🎮 **Player Action:** Run this command to update your game state.

### The Stronghold

The stronghold is a fortified inner chamber containing the goblet puzzle — the key to unlocking the rift.

```bash
📍 vault [exploring] ⚔️cd stronghold
```

> **Concepts:** `cd`

### Stronghold Scroll

The scroll describes a goblet at the center of a runic triangle, flanked by ``orb1`` and empty spaces for ``orb2`` and ``orb3``. The hint? Copy ``orb1`` to create the missing orbs.

```bash
🏰 stronghold [vault heart] ⚔️cat scroll

# There is a fine gold goblet at the center of a
# runic triangle on the floor.
# You try to take the goblet, but your hand
# passes through it as if it were illusory.
#
# You notice a glowing orb, labeled orb1, in one
# corner of the triangle. The other points of the
# triangle are labeled orb2 and orb3, but the orbs
# have long since been stolen by tomb raiders.
#
# Perhaps adding more orbs would free the goblet's
# material form.
#
# You remember a spell your magick teacher,
# Caitlin the Green, taught you long ago:
# a spell to copy and name objects...
#
```

> **Concepts:** `cat`, `cp`

### Stronghold Contents

We see ``goblet`` (executable), ``orb1`` (a file to copy), ``scroll``, and ``nursery/`` deeper within.

```bash
🏰 stronghold [vault heart] ⚔️ls -F
goblet*
nursery/
orb1
scroll

💰 Vault path: Master variables, collect the goblet to unlock the Rift!
📜 There is a scroll here. Read it with: cat scroll
⚡ Interactive elements found:
   ⚡ goblet - Interactive element
```

> **Concepts:** `ls`

### Copying the First Orb

``cp`` copies files. We duplicate ``orb1`` to create ``orb2``. This is a fundamental filesystem operation — creating copies of files is essential for backups, templates, and more.

```bash
🏰 stronghold [vault heart] ⚔️cp orb1 orb2
```

> **Concepts:** `cp`, `file duplication`

### Copying the Second Orb

We create the third orb to complete the set.

```bash
🏰 stronghold [vault heart] ⚔️cp orb1 orb3
```

> **Concepts:** `cp`

### Activating the Goblet

With all three orbs present (``orb1``, ``orb2``, ``orb3``), the goblet activates and announces that the rift has opened. The script uses file-existence checks (``-f orb2`` and ``-f orb3``) and then runs ``mv ../../.rift ../../rift`` to unlock the rift directory at the entrance level.

```bash
🏰 stronghold [vault heart] ⚔️./goblet
You have freed the goblet's material form.  Add 'goblet' to
your inventory.

export I=goblet,$I

A strange energy pulses through the dungeon walls.
Somewhere far above, in the entrance hall, a hidden
passage to the RIFT has opened...
```

> **Concepts:** `./`, `cp`, `file existence checks`, `mv`

### Collecting the Goblet

We add the goblet to our inventory.

```bash
🏰 stronghold [vault heart] ⚔️export I=goblet,$I
```

> **Concepts:** `export`

> 🎮 **Player Action:** Run this command to update your game state.

### The Nursery

The nursery of the still dead lies below the stronghold.

```bash
🏰 stronghold [vault heart] ⚔️cd nursery
```

> **Concepts:** `cd`

### Nursery Scroll

A brief atmospheric text — the nursery of the still dead.

```bash
🌱 nursery [vault garden] ⚔️cat scroll

# Once a thriving nursery filled with vibrant plants,
# this is now the Nursery of the Still Dead (it says so,
# in writing on the wall).
```

> **Concepts:** `cat`

### The Lab

The laboratory — an abandoned wizard's workspace where a ghost awaits.

```bash
🌱 nursery [vault garden] ⚔️cd lab
```

> **Concepts:** `cd`

### Lab Scroll

The lab scroll describes the eerie abandoned laboratory.

```bash
🧪 lab [alchemy room] ⚔️cat scroll

# An abandoned laboratory of a wizard long dead.
#
# A lone magickal torch ignites as you enter, shedding
# light on the workshop, and casts haunting shadows
# on every surface.
#
# The flames lick the walls, burning off the moss that had
# gathered there. The burning moss sizzles in the silence
# of the catacombs, like angelic wailing or singing.
```

> **Concepts:** `cat`

### Ghost Combat

The ghost of an evil wizard manifests. This is another random combat encounter using the same dice-roll system as the monster. Having the enchanted sword (via the ice crystal and glass encounter) gives +2 bonus. On victory, the ghost drops an emerald and platinum coins.

```bash
🧪 lab [alchemy room] ⚔️./ghost
# (input) y
# (input) 3
The room shakes, a gust of wind blasts you from nowhere.
You sense that a presence has entered the room.  The pain
you suddenly feel assures you that you are under attack by a
ghostly entity!

If you have a sword, you can attack.  Otherwise, you should
run.

Do you want to attack? y/n  Enter a number:  The monster rolled  29
You rolled  51
+2 bonus from a mysterious wintry patron!
A hit! A palpable hit!  You have slain the spirit of the
evil wizard.
```

> **Concepts:** `./`, `combat`, `$RANDOM`, `game bonuses`

### Returning to Entrance

We navigate back to the entrance level.

```bash
🧪 lab [alchemy room] ⚔️cd ../../../..
```

> **Concepts:** `cd`, `..`

<details>
<summary>📊 <strong>State after this chapter</strong></summary>

| Property | Value |
|----------|-------|
| **Location** | `entrance` |

</details>


---

## Chapter 12: The Scrap Yard

The scrap yard provides a focused lesson on symbolic links (``ln -s``) — shortcuts that connect distant parts of the filesystem.

### The Scrap Yard

The scrap yard is the third hidden area. Despite its unassuming name, it teaches one of Linux's most powerful features: symbolic links.

```bash
🚪 entrance [starting hall] ⚔️cd scrap
```

> **Concepts:** `cd`

### Scrap Scroll — Symlinks Deep Dive

This scroll provides an in-depth lesson on ``ln -s`` (creating symlinks), ``ls -l`` (viewing where links point), and ``rm linkname`` (removing symlinks). Symlinks are shortcuts — references to files or directories located elsewhere. They're used everywhere in Linux: ``/usr/bin/python`` is often a symlink, libraries use them for versioning, and they simplify complex directory structures.

```bash
📍 scrap [exploring] ⚔️cat scroll

================================================================================
                          THE SCRAP HEAP
================================================================================

You enter a dusty alcove littered with discarded parchments
and broken tools.  Among the debris, you find an ancient
note scratched into the stone wall:

"Descend, bold traveller, into the dungeons of POSIX
 which the shadow of Scartaris touches, and you will
 learn the magickal incantations of the Wildebeest."

--------------------------------------------------------------------------------
                     SYMLINK SPELL: ln -s
--------------------------------------------------------------------------------

A symlink is a magickal portal — a shortcut that points
to another location without moving the original.

CREATING A PORTAL:

    ln -s TARGET LINK_NAME

EXAMPLE — Create a portal to a hidden rift:

    From the entrance:
        ln -s .rift portal

    From the chamber:
        ln -s ../../../../.rift portal

Once created, you can walk through the portal:

    cd portal

NOTE: The portal points to where something IS, not where
you want it to BE.  If the target path is wrong, the portal
leads nowhere.

CHECK IF SOMETHING IS A PORTAL:

    ls -l

    Symlinks appear as:  portal -> .rift

REMOVE A PORTAL:

    rm portal

    This removes the link, NOT the destination!

--------------------------------------------------------------------------------
              "I have done this, in the place of the
               singing flame."
                     — Arnnisen the Gray
--------------------------------------------------------------------------------

================================================================================
```

> **Concepts:** `ln -s`, `ls -l`, `rm`, `symlinks`

### Leaving the Scrap Yard

We return to the entrance for the final challenge.

```bash
📍 scrap [exploring] ⚔️cd ..
```

> **Concepts:** `cd ..`

<details>
<summary>📊 <strong>State after this chapter</strong></summary>

| Property | Value |
|----------|-------|
| **Location** | `entrance` |

</details>


---

## Chapter 13: The Rift

The rift is the endgame dimension. You use ``$USER`` to solve a POSIX puzzle, ``mv`` to silence enemy war drums, and face Nyarlathotep in the final battle. Victory means mastering the Bash shell.

### Entering the Rift

The rift is the endgame area — a dimension of red skies and flame trees. It was unlocked by the goblet in the vault's stronghold. The final boss, Nyarlathotep, awaits in the arena pit.

```bash
🚪 entrance [starting hall] ⚔️cd rift
```

> **Concepts:** `cd`, `endgame`

### Rift Scroll

The rift scroll is atmospheric — red sky, mountains floating in the sky, and flame trees. You have entered another dimension.

```bash
📍 rift [exploring] ⚔️cat scroll

# You find yourself on a world not of this reality.
#
# The sky is red, mountains hang in the sky and
# trees are flames that form from smoke
# decending from the heavens.
#
# You have entered the rift.
#
```

> **Concepts:** `cat`

### Rift Contents

The rift contains ``box`` (a POSIX login puzzle), ``arena/`` (where the final boss waits), and ``spire/`` (a mysterious tower with an elevator).

```bash
📍 rift [exploring] ⚔️ls -F
arena/
box*
scroll
spire/
📜 There is a scroll here. Read it with: cat scroll
⚡ Interactive elements found:
   ⚡ box - Interactive element
```

> **Concepts:** `ls -F`

### The POSIX Box

The illuminated metal box presents a POSIX login screen. It asks for your username — the ``$USER`` environment variable. Entering your actual system username unlocks armour and a combat bonus. This teaches the ``$USER`` variable, which is preset by the operating system.

```bash
📍 rift [exploring] ⚔️./box
# (input) y
# (input) ${USER}
A metal box sits upon the ground.  It appears to be
illuminated from within.  There is a window in the box. The
window is black, but there is luminescent writing.

Do you want to read the writing? y/n  
.--------------------------------,
|       Welcome to POSIX         |
|   Enter your username:         |
'--------------------------------'
```

> **Concepts:** `$USER`, `environment variables`, `POSIX`

### The Arena

The Chamber of Nyarlathotep — an ancient arena built for blood sport. A gaping pit lies at its center.

```bash
📍 rift [exploring] ⚔️cd arena
```

> **Concepts:** `cd`

### Arena Scroll

The arena scroll describes the scene and suggests preparing for the final battle. Summoning a potion first would be wise.

```bash
⚔️ arena [combat pit] ⚔️cat scroll

 .:|  T H E C H A M B E R O F  |:.
.:||  N Y A R L A T H O T E P  ||:.
-----------------------------------
| /                             \ |
| |                             | |
|||                             |||
|||                             |||
|||                             |||
|||                             |||
|||                             |||
|||                             |||
||| __________________________  |||
|||/''''                   ''''\|||
-----------------------------------

# You have entered an ancient arena,
# probably used for worship.
#
# And "worship", in this dangerous realm,
# usually means blood sport.
#
# There is a gaping pit in the center
# of the arena.
#
# If you remember how to summon a potion,
# this might be a good time to do it.
```

> **Concepts:** `cat`

### The Pit

We descend into the pit where Nyarlathotep, the crawling chaos, has been waiting.

```bash
⚔️ arena [combat pit] ⚔️cd pit
```

> **Concepts:** `cd`

### Pit Scroll

Nyarlathotep has been waiting.

```bash
🕳️ pit [boss lair] ⚔️cat scroll

# You have entered the chamber of
# Nyarlathotep, the crawling chaos.
#
# Nyarlathotep, older than the old
# gods themselves, has been waiting for you.
```

> **Concepts:** `cat`

### Pit Contents

The pit contains ``drummer`` (to weaken Nyarlathotep), ``nyarlathotep`` (the final boss), ``wizard-light`` (summon an ally), plus the ``drum`` text file and ``scroll``.

```bash
🕳️ pit [boss lair] ⚔️ls -F
drum
drummer*
nyarlathotep*
scroll
wizard-light*

🌀 The Rift: Advanced challenges. Boss encounters in the Pit, secrets in the Spire!
📜 There is a scroll here. Read it with: cat scroll
⚡ Interactive elements found:
   ⚡ drummer - Interactive element
   ⚡ nyarlathotep - Interactive element
   ⚡ wizard-light - Interactive element
```

> **Concepts:** `ls`

### Stopping the Drums

The drummer script reveals that war drums give Nyarlathotep extra strength (+2 to his roll). The hint is to use ``mv`` to rename or remove the ``drum`` file. Once the drum is gone, Nyarlathotep loses the bonus.

```bash
🕳️ pit [boss lair] ⚔️./drummer
War drums pound in the distance, giving Nyarlathotep
strength.

If you know a spell to un-summon the drums, Nyarlathotep
would probably weaken! If you know how to look up a new
command, learn the "mv" command now.
```

> **Concepts:** `./`, `mv`

### Silencing the Drums

We use ``mv`` to rename ``drum`` to ``drum.silenced``, effectively removing the drummer's power source. ``mv`` can both move files to new locations and rename them. This strategic use of filesystem manipulation is the final lesson of the game.

```bash
🕳️ pit [boss lair] ⚔️mv drum drum.silenced
```

> **Concepts:** `mv`, `rename files`

### The Final Battle

Nyarlathotep — the crawling chaos — is the final boss. The combat uses the same dice system but with higher stakes: the base monster roll is +3, silencing the drum gives -2 (net +1), and the POSIX box blessing gives an additional +2 bonus to the player. On victory, Nyarlathotep is defeated and drops legendary loot. On loss, 10 HP damage. This is the culmination of every command learned throughout the game.

```bash
🕳️ pit [boss lair] ⚔️./nyarlathotep
# (input) y
# (input) 7
In the blink of an eye, Nyarlathotep is standing before you.
From its hands emanate black necrotic rays, and your mind
screams.

Are you armed? y/n  Enter a number.
The monster rolled  46
You rolled  97
A hit! A palpable hit!  You have vanquished the elder god of
chaos!
```

> **Concepts:** `./`, `combat`, `game finale`

### Victory Loot

After defeating Nyarlathotep, new files appear: ``treasure`` (hair of a god), ``platinum`` (bracelet of chaotic necromancy), and ``end`` (the victory message).

```bash
🕳️ pit [boss lair] ⚔️ls -F
drum.silenced
drummer*
end
nyarlathotep*
platinum*
scroll
treasure*
wizard-light*

🌀 The Rift: Advanced challenges. Boss encounters in the Pit, secrets in the Spire!
📜 There is a scroll here. Read it with: cat scroll
⚡ Interactive elements found:
   ⚡ drummer - Interactive element
   ⚡ nyarlathotep - Interactive element
   ⚡ platinum - Interactive element
```

> **Concepts:** `ls`

### The End

The ``end`` file contains the game's victory message. You have reached the end of Bashcrawl. You now know enough Bash to use it for everyday activities — navigating directories, viewing files, managing permissions, writing scripts, using pipes and filters, and understanding symlinks, environment variables, and arithmetic.

```bash
🕳️ pit [boss lair] ⚔️cat end
You have reached the end of the game.  You know enough Bash
now to use it for every day activities.  Practice makes
perfect, so be sure to use it often.  For continued Bash
tips, visit opensource.com often.

And eventually, we hope to see you contribute your own
dungeon rooms to Bashcrawl!
```

> **Concepts:** `cat`, `completion`

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
| `cd ..` | Move to parent directory — go back one level |
| `parent directory` | parent directory |
| `..` | .. |

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

### File Management

| Command / Concept | Description |
|-------------------|-------------|
| `mkdir` | Create a new directory |
| `touch` | Create an empty file or update timestamps |
| `cp` | Copy files or directories |
| `rm` | Remove (delete) files |
| `rmdir` | Remove empty directories |
| `echo >` | Redirect output to a file (overwrite) |
| `mv` | Move or rename files and directories |
| `file creation` | file creation |
| `file duplication` | file duplication |
| `rename files` | rename files |

### Execution

| Command / Concept | Description |
|-------------------|-------------|
| `./` | Execute a script in the current directory |
| `executing scripts` | executing scripts |
| `chmod` | Change file permissions |
| `permissions` | permissions |
| `paths` | paths |
| `read` | Read user input from stdin |
| `interactive scripts` | interactive scripts |

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
| `$USER` | Environment variable containing your username |
| `POSIX` | Portable Operating System Interface standard |

### Text Processing

| Command / Concept | Description |
|-------------------|-------------|
| `grep` | Search for patterns in text |
| `sed` | Stream editor — find and replace in text |
| `string manipulation` | string manipulation |
| `command substitution` | command substitution |
| `$()` | Command substitution — capture command output |
| `grep -r` | Search recursively through directories |
| `grep --quiet` | Silent search — exit code only |
| `here-strings` | here-strings |
| `sort` | Sort lines of text |
| `text processing` | text processing |
| `pipe |` | Send output of one command as input to another |
| `uniq` | Remove duplicate consecutive lines |

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
| `side paths` | side paths |
| `hidden files` | hidden files |
| `ls -a` | ls -a |
| `dot-directories` | dot-directories |
| `hidden areas` | hidden areas |
| `command history` | Use UP/DOWN arrows to recall commands |
| `arrow keys` | arrow keys |
| `environmental storytelling` | environmental storytelling |
| `exploration` | exploration |
| `tab completion` | Press TAB to auto-complete commands/filenames |
| `here-string` | here-string |
| `$RANDOM` | $RANDOM |
| `dynamic file creation` | dynamic file creation |
| `interactive puzzles` | interactive puzzles |
| `unlocking hidden dirs` | unlocking hidden dirs |
| `game mechanics` | game mechanics |
| `file existence checks` | file existence checks |
| `combat` | combat |
| `game bonuses` | game bonuses |
| `ls -l` | ls -l |
| `endgame` | endgame |
| `game finale` | game finale |
| `completion` | completion |

---

## Session Summary

| Metric | Value |
|--------|-------|
| **Total Steps** | 118 |
| **Duration** | 7.5 seconds |
| **Rooms Visited** | 23 |
| **Items Collected** | 15 |
| **Encounters** | 21 |
| **Success** | ✅ Yes |

### Rooms Visited

`entrance`, `entrance/cellar`, `entrance/cellar/armoury`, `entrance/cellar/armoury/chamber`, `entrance/workshop`, `entrance/chapel`, `entrance/chapel/courtyard`, `entrance/chapel/courtyard/aviary`, `entrance/chapel/courtyard/aviary/hall`, `entrance/chapel/courtyard/aviary/hall/library`, `entrance/chapel/graveyard`, `entrance/chapel/graveyard/columbarium`, `entrance/chapel/graveyard/lower-quadrant`, `entrance/chapel/graveyard/royal-tombs`, `entrance/chapel/graveyard/mausoleum`, `entrance/vault`, `entrance/vault/stronghold`, `entrance/vault/stronghold/nursery`, `entrance/vault/stronghold/nursery/lab`, `entrance/scrap`, `entrance/rift`, `entrance/rift/arena`, `entrance/rift/arena/pit`

### Items Collected

amulet, sword, diamonds, coins, rags, fish, crystal, crown, 2712, 1765, 7432, goldcoins, bracelet, silverkeys, goblet

### Encounters

treasure, treasure, potion, statue, treasure, spell, rags, penguin, crystal, monster, treasure, open, statues, padlock, loot, glass, goblet, ghost, box, drummer, nyarlathotep

---

*Generated by Bashcrawl Demo Test Framework*
