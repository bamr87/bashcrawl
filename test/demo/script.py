"""Full game demo script — every command for a complete Bashcrawl playthrough.

Each ``DemoStep`` defines a command, its educational context, and expected
output.  Steps are organized into chapters that follow the game's
progression from the entrance through all hidden rooms and the final boss.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class DemoStep:
    """A single scripted command in the demo playthrough."""

    command: str
    chapter: str
    section: str
    explanation: str
    concepts: list[str] = field(default_factory=list)
    stdin_input: Optional[str] = None
    is_setup: bool = False
    expected_contains: list[str] = field(default_factory=list)


# ===================================================================
# Chapter 1 — The Entrance
# ===================================================================

_CH1 = "The Entrance"

CHAPTER_1: list[DemoStep] = [
    DemoStep(
        command="cd entrance",
        chapter=_CH1,
        section="Entering the Dungeon",
        explanation=(
            "Every adventure begins with a single step. In the terminal, "
            "``cd`` (change directory) moves you into a new directory — "
            "think of it as walking through a door. We step into the "
            "``entrance/`` directory to begin the game."
        ),
        concepts=["cd", "directory navigation"],
    ),
    DemoStep(
        command="pwd",
        chapter=_CH1,
        section="Where Am I?",
        explanation=(
            "The ``pwd`` command (print working directory) shows your "
            "current location in the filesystem. In the game, this is "
            "like checking a map — it tells you which room you're "
            "standing in."
        ),
        concepts=["pwd", "working directory"],
        expected_contains=["entrance"],
    ),
    DemoStep(
        command="ls",
        chapter=_CH1,
        section="Looking Around",
        explanation=(
            "The ``ls`` command lists the contents of the current "
            "directory. In the dungeon, this is like looking around the "
            "room to see what's here — files, directories, scrolls, and "
            "treasures."
        ),
        concepts=["ls", "listing files"],
        expected_contains=["scroll", "cellar"],
    ),
    DemoStep(
        command="cat scroll",
        chapter=_CH1,
        section="Reading Your First Scroll",
        explanation=(
            "The ``cat`` command displays the contents of a file. "
            "Scrolls are the game's tutorial texts — they teach you new "
            "terminal commands as you progress deeper into the dungeon. "
            "This first scroll introduces the basic commands you'll need "
            "to navigate: ``ls``, ``cd``, and ``cat``."
        ),
        concepts=["cat", "reading files"],
        expected_contains=["ls"],
    ),
]

# ===================================================================
# Chapter 2 — The Cellar
# ===================================================================

_CH2 = "The Cellar"

CHAPTER_2: list[DemoStep] = [
    DemoStep(
        command="cd cellar",
        chapter=_CH2,
        section="Descending into the Cellar",
        explanation=(
            "We descend deeper into the dungeon. The cellar is the "
            "second room and teaches more advanced listing techniques. "
            "Notice how each directory is a room, and navigating between "
            "them with ``cd`` is like walking through doorways."
        ),
        concepts=["cd", "nested directories"],
    ),
    DemoStep(
        command="cat scroll",
        chapter=_CH2,
        section="The Cellar Scroll",
        explanation=(
            "This scroll teaches ``ls -F``, which adds special symbols "
            "after filenames to show their type: ``/`` for directories, "
            "``*`` for executable files, and ``@`` for symbolic links. "
            "It's like having enchanted vision that reveals the nature "
            "of objects in the room."
        ),
        concepts=["ls -F", "file type indicators"],
    ),
    DemoStep(
        command="ls -F",
        chapter=_CH2,
        section="Enhanced Vision",
        explanation=(
            "With ``ls -F``, we can now distinguish between regular "
            "files, directories (marked with ``/``), and executables "
            "(marked with ``*``). The ``treasure`` file shows up with "
            "an asterisk — it's a program we can run!"
        ),
        concepts=["ls -F", "executable indicator *"],
        expected_contains=["treasure"],
    ),
    DemoStep(
        command="./treasure",
        chapter=_CH2,
        section="Finding the Amulet",
        explanation=(
            "The ``./`` prefix tells the shell to execute the file in "
            "the current directory. Running ``./treasure`` triggers the "
            "treasure script, which reveals an emerald amulet. The "
            "script also secretly unlocks three hidden areas accessible "
            "from the entrance level: the chapel, vault, and scrap yard."
        ),
        concepts=["./", "executing scripts"],
        expected_contains=["amulet", "export"],
    ),
    DemoStep(
        command="export I=amulet,$I",
        chapter=_CH2,
        section="Collecting the Amulet",
        explanation=(
            "The ``export`` command sets an environment variable. Here "
            "we add ``amulet`` to our inventory variable ``$I``. The "
            "``$I`` at the end preserves anything already in inventory. "
            "In real-world Linux, ``export`` makes variables available "
            "to child processes."
        ),
        concepts=["export", "environment variables", "inventory"],
        is_setup=True,
    ),
    DemoStep(
        command="echo $I",
        chapter=_CH2,
        section="Checking Your Inventory",
        explanation=(
            "``echo`` prints text to the terminal. When combined with "
            "``$I``, it expands the variable and shows our current "
            "inventory. This is how you check what treasures you've "
            "collected throughout the game."
        ),
        concepts=["echo", "variable expansion"],
        expected_contains=["amulet"],
    ),
]

# ===================================================================
# Chapter 3 — The Armoury
# ===================================================================

_CH3 = "The Armoury"

CHAPTER_3: list[DemoStep] = [
    DemoStep(
        command="cd armoury",
        chapter=_CH3,
        section="Entering the Armoury",
        explanation=(
            "The armoury is the third room on the main path. Here we "
            "learn about file permissions, executing scripts, and "
            "encounter our first interactive game elements — a treasure, "
            "a potion, and more."
        ),
        concepts=["cd", "game progression"],
    ),
    DemoStep(
        command="cat scroll",
        chapter=_CH3,
        section="The Armoury Scroll",
        explanation=(
            "This scroll teaches about executing files with ``./``, the "
            "difference between relative and absolute paths, and the "
            "``chmod`` command for managing file permissions. In Linux, "
            "a file must have execute permission to be run as a program."
        ),
        concepts=["./", "chmod", "permissions", "paths"],
    ),
    DemoStep(
        command="ls -F",
        chapter=_CH3,
        section="Surveying the Arsenal",
        explanation=(
            "Listing with ``-F`` reveals the armoury's contents. "
            "Executables (marked ``*``) include ``treasure``, "
            "``potion``, and deeper in, the ``chamber/`` directory "
            "awaits."
        ),
        concepts=["ls -F"],
        expected_contains=["treasure", "potion", "chamber"],
    ),
    DemoStep(
        command="./treasure",
        chapter=_CH3,
        section="Finding the Sword",
        explanation=(
            "The armoury's treasure reveals a gleaming silver sword. "
            "The sword is essential for combat encounters later in the "
            "game — without it, you cannot defeat the statue, monster, "
            "or ghost. Always collect every treasure you find!"
        ),
        concepts=["./", "game items"],
        expected_contains=["sword", "export"],
    ),
    DemoStep(
        command="export I=sword,$I",
        chapter=_CH3,
        section="Equipping the Sword",
        explanation=(
            "We add the sword to our comma-separated inventory variable. "
            "Notice the pattern: ``export I=newitem,$I`` — this prepends "
            "the new item while keeping everything already collected. "
            "Our inventory now contains both the sword and the amulet."
        ),
        concepts=["export", "string concatenation"],
        is_setup=True,
    ),
    DemoStep(
        command="./potion",
        chapter=_CH3,
        section="Drinking the Potion",
        explanation=(
            "The potion script uses ``read`` to ask for your input — "
            "a y/n prompt. By answering 'y', the potion grants you 15 "
            "health points (HP). Potions use a variable called ``$HP`` "
            "to track your health, which you'll need for combat."
        ),
        concepts=["read", "interactive scripts", "stdin"],
        stdin_input="y\n",
        expected_contains=["HP", "15"],
    ),
    DemoStep(
        command="export HP=15",
        chapter=_CH3,
        section="Setting Health Points",
        explanation=(
            "As instructed by the potion, we set our HP to 15. In bash, "
            "variables don't have types — ``HP`` is stored as a string "
            "but can be used in arithmetic with the ``let`` command."
        ),
        concepts=["export", "numeric variables"],
        is_setup=True,
    ),
]

# ===================================================================
# Chapter 4 — The Chamber of Spirits
# ===================================================================

_CH4 = "The Chamber of Spirits"

CHAPTER_4: list[DemoStep] = [
    DemoStep(
        command="cd chamber",
        chapter=_CH4,
        section="Entering the Chamber",
        explanation=(
            "The chamber is the deepest room on the main quest path. "
            "It contains three encounters: a living statue (combat), a "
            "treasure chest (loot), and a spell inscription (magic). "
            "This is where you'll learn about environment variables, "
            "arithmetic, and symbolic links."
        ),
        concepts=["cd", "deep navigation"],
    ),
    DemoStep(
        command="cat scroll",
        chapter=_CH4,
        section="The Chamber Scroll",
        explanation=(
            "The chamber's scroll teaches ``export``, ``echo``, ``let``, "
            "and ``unset`` — the core commands for managing environment "
            "variables. These concepts apply directly to real shell "
            "scripting: variables store data, ``let`` performs math, and "
            "``export`` shares values with child processes."
        ),
        concepts=["export", "echo", "let", "unset", "variables"],
    ),
    DemoStep(
        command="ls -F",
        chapter=_CH4,
        section="Assessing the Chamber",
        explanation=(
            "The chamber contains three executable encounters (marked "
            "with ``*``): the ``statue``, ``treasure``, and ``spell``. "
            "We need to fight the statue first — it guards the way "
            "forward."
        ),
        concepts=["ls -F"],
        expected_contains=["statue", "treasure", "spell"],
    ),
    DemoStep(
        command="echo $I",
        chapter=_CH4,
        section="Pre-Combat Inventory Check",
        explanation=(
            "Before engaging the statue, we verify our inventory with "
            "``echo $I``. The sword is required to win the fight. This "
            "is a good habit — always check your gear before a battle."
        ),
        concepts=["echo", "variable inspection"],
        expected_contains=["sword", "amulet"],
    ),
    DemoStep(
        command="echo $HP",
        chapter=_CH4,
        section="Pre-Combat Health Check",
        explanation=(
            "We also check our HP. The statue deals 5 damage during "
            "the encounter, so we need at least 6 HP to survive. With "
            "15 HP from the potion, we're well prepared."
        ),
        concepts=["echo", "HP tracking"],
        expected_contains=["15"],
    ),
    DemoStep(
        command="./statue",
        chapter=_CH4,
        section="Fighting the Statue",
        explanation=(
            "The statue encounter is the main quest's combat challenge. "
            "It springs to life and attacks, dealing 5 damage. When "
            "asked if we approach and if we have a sword, we answer "
            "'y' to both. With the sword in our inventory (verified by "
            "``grep``), we shatter the statue and claim the diamonds "
            "within. The script uses ``let`` for HP arithmetic and "
            "``grep`` to check inventory — two real shell techniques."
        ),
        concepts=["./", "game combat", "grep", "let", "interactive input"],
        stdin_input="y\ny\n",
        expected_contains=["diamonds", "export"],
    ),
    DemoStep(
        command="export I=diamonds,$I",
        chapter=_CH4,
        section="Collecting Diamonds",
        explanation=(
            "We add the diamonds to our growing inventory. The "
            "comma-separated format makes it easy to add items with "
            "``export I=newitem,$I``."
        ),
        concepts=["export", "inventory management"],
        is_setup=True,
    ),
    DemoStep(
        command='let "HP=HP-5"',
        chapter=_CH4,
        section="Accounting for Damage",
        explanation=(
            "The ``let`` command performs integer arithmetic in bash. "
            "The statue hit us for 5 damage, so we subtract it from our "
            "HP. After this, HP drops from 15 to 10. In real scripting, "
            "``let`` is used for counters, calculations, and loop "
            "conditions."
        ),
        concepts=["let", "bash arithmetic"],
        is_setup=True,
    ),
    DemoStep(
        command="./treasure",
        chapter=_CH4,
        section="Chamber Treasure",
        explanation=(
            "With the statue defeated, we claim the treasure — a stash "
            "of coins. Every treasure script follows the same pattern: "
            "check if the item is already in inventory, display it if "
            "not, and instruct the player to ``export`` it."
        ),
        concepts=["./", "treasure pattern"],
        expected_contains=["export"],
    ),
    DemoStep(
        command="export I=coins,$I",
        chapter=_CH4,
        section="Collecting Coins",
        explanation="We add the coins to our inventory.",
        concepts=["export"],
        is_setup=True,
    ),
    DemoStep(
        command="./spell",
        chapter=_CH4,
        section="Reading the Runes",
        explanation=(
            "The spell inscription on the wall teaches one of the most "
            "powerful concepts in Linux: symbolic links (symlinks). A "
            "symlink is a shortcut that points to another file or "
            "directory. The runes instruct us to create a portal — a "
            "symlink — connecting this chamber to a distant part of "
            "the dungeon."
        ),
        concepts=["ln -s", "symlinks", "portals"],
        stdin_input="y\n",
        expected_contains=["ln"],
    ),
    DemoStep(
        command="ln -fs ../../../chapel/courtyard/aviary/hall portal",
        chapter=_CH4,
        section="Creating a Portal",
        explanation=(
            "The ``ln -s`` command creates a symbolic link. Here, "
            "``portal`` becomes a shortcut to the distant aviary hall "
            "deep inside the chapel. The ``-f`` flag forces creation "
            "even if a link already exists. Symlinks are one of the "
            "most useful features in Linux — they let you create "
            "shortcuts to files and directories anywhere in the system."
        ),
        concepts=["ln -s", "ln -f", "relative paths", "symlinks"],
    ),
]

# ===================================================================
# Chapter 5 — The Workshop (Side Quest)
# ===================================================================

_CH5 = "The Workshop"

CHAPTER_5: list[DemoStep] = [
    DemoStep(
        command="cd ../../..",
        chapter=_CH5,
        section="Returning to the Entrance",
        explanation=(
            "We navigate back to the entrance using ``..`` (parent "
            "directory) three times — from chamber to armoury to cellar "
            "to entrance. Each ``..`` moves up one level in the "
            "directory hierarchy."
        ),
        concepts=["cd ..", "parent directory"],
    ),
    DemoStep(
        command="cd workshop",
        chapter=_CH5,
        section="The Workshop",
        explanation=(
            "The workshop is a tutorial room off the main path that "
            "teaches file manipulation commands. It's a safe space to "
            "practice creating, copying, and deleting files."
        ),
        concepts=["cd", "side paths"],
    ),
    DemoStep(
        command="cat scroll",
        chapter=_CH5,
        section="Workshop Scroll",
        explanation=(
            "This scroll teaches essential file management commands: "
            "``mkdir`` (create directories), ``touch`` (create empty "
            "files), ``cp`` (copy files), ``rm`` (delete files), "
            "``rmdir`` (delete empty directories), ``rm -r`` (delete "
            "recursively), and ``echo 'text' > file`` (write to files). "
            "These are the everyday tools of a system administrator."
        ),
        concepts=["mkdir", "touch", "cp", "rm", "rmdir", "echo >"],
    ),
    DemoStep(
        command="cd ..",
        chapter=_CH5,
        section="Leaving the Workshop",
        explanation="We return to the entrance to continue exploring.",
        concepts=["cd .."],
    ),
]

# ===================================================================
# Chapter 6 — The Chapel
# ===================================================================

_CH6 = "The Chapel"

CHAPTER_6: list[DemoStep] = [
    DemoStep(
        command="ls",
        chapter=_CH6,
        section="Hidden Rooms Revealed",
        explanation=(
            "After collecting the cellar treasure, three previously "
            "hidden directories were unlocked: ``chapel/``, ``vault/``, "
            "and ``scrap/``. In the original game, these were hidden "
            "as dot-directories (``.chapel``, etc.) — in Linux, files "
            "and directories starting with ``.`` are hidden from ``ls`` "
            "unless you use ``ls -a``. The treasure script used ``mv`` "
            "to rename them, revealing them."
        ),
        concepts=["hidden files", "ls -a", "mv", "dot-directories"],
    ),
    DemoStep(
        command="cd chapel",
        chapter=_CH6,
        section="Entering the Chapel",
        explanation=(
            "The chapel is the first of three hidden areas unlocked "
            "after collecting the amulet. It contains an elaborate "
            "sub-dungeon with a courtyard, aviary, graveyard, and more."
        ),
        concepts=["cd", "hidden areas"],
    ),
    DemoStep(
        command="cat scroll",
        chapter=_CH6,
        section="Chapel Scroll",
        explanation=(
            "The chapel scroll teaches command history — using the "
            "UP and DOWN arrow keys to recall previous commands. This "
            "is one of the most time-saving features of any shell."
        ),
        concepts=["command history", "arrow keys"],
    ),
    DemoStep(
        command="ls -F",
        chapter=_CH6,
        section="Chapel Contents",
        explanation=(
            "The chapel has several items and passages, including an "
            "``altar`` (executable — an interactive puzzle), a "
            "``courtyard/`` directory, and a ``graveyard/`` directory. "
            "Each branch leads deeper into the chapel's mysteries."
        ),
        concepts=["ls -F"],
    ),
    DemoStep(
        command="cd courtyard",
        chapter=_CH6,
        section="The Courtyard",
        explanation=(
            "The courtyard is an open area with a fountain, some rags "
            "on the ground, and a passage to the aviary. There are "
            "hidden items here that will help in later encounters."
        ),
        concepts=["cd"],
    ),
    DemoStep(
        command="cat scroll",
        chapter=_CH6,
        section="Courtyard Atmosphere",
        explanation=(
            "The courtyard scroll is atmospheric — it describes the "
            "scene rather than teaching commands directly. Not every "
            "scroll is a tutorial; some set the mood and provide clues."
        ),
        concepts=["cat", "environmental storytelling"],
    ),
    DemoStep(
        command="./rags",
        chapter=_CH6,
        section="Finding Hidden Items",
        explanation=(
            "Under the rags on the courtyard floor, we find a salted "
            "fish. This seems insignificant now, but the fish is "
            "essential for befriending the penguin in the aviary later. "
            "Game design teaches us to explore thoroughly — similarly, "
            "in Linux, important files can be in unexpected places."
        ),
        concepts=["./", "exploration", "game items"],
        stdin_input="y\n",
        expected_contains=["fish"],
    ),
    DemoStep(
        command="export I=rags,fish,$I",
        chapter=_CH6,
        section="Collecting Rags and Fish",
        explanation="We add the rags and fish to our inventory.",
        concepts=["export"],
        is_setup=True,
    ),
]

# ===================================================================
# Chapter 7 — The Aviary
# ===================================================================

_CH7 = "The Aviary"

CHAPTER_7: list[DemoStep] = [
    DemoStep(
        command="cd aviary",
        chapter=_CH7,
        section="Into the Aviary",
        explanation=(
            "The aviary is a cold, frost-bitten room inhabited by "
            "penguins and containing an icy pond with a crystal. "
            "This area teaches tab completion and introduces ``grep``."
        ),
        concepts=["cd"],
    ),
    DemoStep(
        command="cat scroll",
        chapter=_CH7,
        section="Aviary Scroll",
        explanation=(
            "This scroll introduces tab completion — pressing TAB "
            "after typing part of a filename or command will auto-"
            "complete it. Try ``cd h`` + TAB to complete to ``cd hall/``. "
            "This is one of the most essential productivity features "
            "in any terminal."
        ),
        concepts=["tab completion"],
    ),
    DemoStep(
        command="ls -F",
        chapter=_CH7,
        section="Aviary Contents",
        explanation=(
            "The aviary contains a ``crystal`` (executable), a "
            "``penguin`` (executable encounter), a ``scroll``, and "
            "the ``hall/`` directory leading deeper."
        ),
        concepts=["ls -F"],
    ),
    DemoStep(
        command="./penguin",
        chapter=_CH7,
        section="The Penguin Encounter",
        explanation=(
            "The penguin approaches us. Since we have the salted fish "
            "in our inventory, we can offer it to the penguin. The "
            "script uses ``grep`` to check if 'fish' is in our ``$I`` "
            "variable. After feeding the penguin, it teaches us ``sed`` "
            "— a stream editor that can modify text. We use it to "
            "remove the fish from our inventory string."
        ),
        concepts=["./", "grep", "sed", "string manipulation"],
        stdin_input="y\ny\n",
    ),
    DemoStep(
        command='export I=$(sed "s/fish//; s/,,/,/" <<< $I)',
        chapter=_CH7,
        section="Removing the Fish",
        explanation=(
            "The ``sed`` command (stream editor) performs text "
            "substitution. ``s/fish//`` removes 'fish' from our "
            "inventory string, and ``s/,,/,/`` cleans up any double "
            "commas left behind. The ``$()`` syntax runs a command and "
            "captures its output — called command substitution. The "
            "``<<<`` operator is a here-string that feeds a variable "
            "directly to a command's stdin."
        ),
        concepts=["sed", "command substitution", "$()", "here-string"],
        is_setup=True,
    ),
    DemoStep(
        command="./crystal",
        chapter=_CH7,
        section="The Ice Crystal",
        explanation=(
            "A white crystal forged by the Queen of Winter lies in the "
            "icy pond. We collect it — this crystal will be needed "
            "later in the vault to enchant our sword for the ghost "
            "fight. Pay attention to items that seem decorative; they "
            "often have a purpose later."
        ),
        concepts=["./"],
    ),
    DemoStep(
        command="export I=crystal,$I",
        chapter=_CH7,
        section="Collecting the Crystal",
        explanation="We add the crystal to our inventory.",
        concepts=["export"],
        is_setup=True,
    ),
]

# ===================================================================
# Chapter 8 — The Hall (Monster Combat)
# ===================================================================

_CH8 = "The Great Hall"

CHAPTER_8: list[DemoStep] = [
    DemoStep(
        command="cd hall",
        chapter=_CH8,
        section="Entering the Hall",
        explanation=(
            "The hall is a large chamber at the end of the aviary path. "
            "A fearsome monster guards a library beyond. This room "
            "teaches ``grep`` — one of the most powerful search "
            "commands in Linux."
        ),
        concepts=["cd"],
    ),
    DemoStep(
        command="cat scroll",
        chapter=_CH8,
        section="The Hall Scroll",
        explanation=(
            "This scroll teaches ``grep`` — a command that searches "
            "for patterns in text. ``grep WORD file`` finds lines "
            "containing WORD. ``grep -r`` searches recursively through "
            "directories. ``grep WORD <<< \"$VAR\"`` searches a "
            "variable. The ``--quiet`` flag suppresses output and is "
            "used in scripts for silent checks."
        ),
        concepts=["grep", "grep -r", "grep --quiet", "here-strings"],
    ),
    DemoStep(
        command="ls -F",
        chapter=_CH8,
        section="Hall Contents",
        explanation=(
            "The hall contains the ``monster`` (executable combat "
            "encounter), the ``library/`` directory, and a scroll."
        ),
        concepts=["ls -F"],
    ),
    DemoStep(
        command="./monster",
        chapter=_CH8,
        section="Monster Combat",
        explanation=(
            "The monster encounter is a random combat system. You pick "
            "a number, and both you and the monster get random attack "
            "rolls. Having the sword gives a significant bonus. On "
            "victory, the monster is slain and drops a crown treasure. "
            "On defeat, you take 5 HP damage and can try again. The "
            "combat uses bash's ``$RANDOM`` variable, ``let`` for "
            "arithmetic, and ``grep`` to check for the sword."
        ),
        concepts=["$RANDOM", "let", "grep", "game combat"],
        stdin_input="y\n5\n",
    ),
    DemoStep(
        command="ls -F",
        chapter=_CH8,
        section="Post-Combat Loot",
        explanation=(
            "After defeating the monster, new files appear: ``treasure`` "
            "and ``carcass`` (the defeated monster renamed). The monster "
            "script dynamically created the treasure file — showing how "
            "scripts can modify the filesystem."
        ),
        concepts=["ls", "dynamic file creation"],
    ),
    DemoStep(
        command="./treasure",
        chapter=_CH8,
        section="Claiming the Crown",
        explanation=(
            "The monster dropped a crown. This treasure will be needed "
            "at the royal tombs in the graveyard."
        ),
        concepts=["./"],
        stdin_input="y\n",
    ),
    DemoStep(
        command="export I=crown,$I",
        chapter=_CH8,
        section="Collecting the Crown",
        explanation="We add the crown to our inventory.",
        concepts=["export"],
        is_setup=True,
    ),
]

# ===================================================================
# Chapter 9 — The Library
# ===================================================================

_CH9 = "The Library"

CHAPTER_9: list[DemoStep] = [
    DemoStep(
        command="cd library",
        chapter=_CH9,
        section="The Library",
        explanation=(
            "A small library with dusty shelves and an ancient tome. "
            "This room is more atmospheric — it hints at the deeper "
            "lore of the dungeon."
        ),
        concepts=["cd"],
    ),
    DemoStep(
        command="cat scroll",
        chapter=_CH9,
        section="Library Scroll",
        explanation="The library scroll describes the room's atmosphere.",
        concepts=["cat"],
    ),
    DemoStep(
        command="cd ../../../../graveyard",
        chapter=_CH9,
        section="To the Graveyard",
        explanation=(
            "We navigate from the library back up through the hall, "
            "aviary, courtyard, and chapel, then into the graveyard. "
            "Using multiple ``..`` segments lets us traverse large "
            "distances in the directory tree in one command."
        ),
        concepts=["cd", "relative paths", ".."],
    ),
]

# ===================================================================
# Chapter 10 — The Graveyard
# ===================================================================

_CH10 = "The Graveyard"

CHAPTER_10: list[DemoStep] = [
    DemoStep(
        command="cat scroll",
        chapter=_CH10,
        section="Graveyard Atmosphere",
        explanation=(
            "The graveyard scroll sets 'a haunting scene — tombstones, "
            "skeletal trees, and a mausoleum sealed with a rusty "
            "padlock. We need to find three numbers to unlock it."
        ),
        concepts=["cat"],
    ),
    DemoStep(
        command="ls -F",
        chapter=_CH10,
        section="Graveyard Layout",
        explanation=(
            "The graveyard has several sub-areas: ``columbarium/``, "
            "``lower-quadrant/``, ``royal-tombs/``. The ``padlock`` "
            "executable guards the hidden mausoleum. Three numbers "
            "are hidden across these sub-areas."
        ),
        concepts=["ls -F"],
    ),
    DemoStep(
        command="cd columbarium",
        chapter=_CH10,
        section="The Columbarium",
        explanation=(
            "The columbarium — a wall of burial niches. We need to "
            "find the right niche number and create a file with "
            "``touch``."
        ),
        concepts=["cd"],
    ),
    DemoStep(
        command="cat scroll",
        chapter=_CH10,
        section="Columbarium Puzzle",
        explanation=(
            "The scroll teaches ``touch`` — creating empty files. We "
            "need to create a file named ``15`` (the correct niche "
            "number), then run ``./open`` to receive the first code."
        ),
        concepts=["touch", "file creation"],
    ),
    DemoStep(
        command="touch 15",
        chapter=_CH10,
        section="Touching the Right Niche",
        explanation=(
            "``touch`` creates an empty file with the given name. In "
            "this case, creating file ``15`` signals to the ``open`` "
            "script that we've found the right niche. In real Linux, "
            "``touch`` is commonly used to create placeholder files "
            "or update file timestamps."
        ),
        concepts=["touch"],
    ),
    DemoStep(
        command="./open",
        chapter=_CH10,
        section="Opening the Niche",
        explanation=(
            "The niche reveals the number **2712** — the first of "
            "three codes needed to unlock the mausoleum padlock."
        ),
        concepts=["./"],
        expected_contains=["2712"],
    ),
    DemoStep(
        command="export I=2712,$I",
        chapter=_CH10,
        section="Remembering the Code",
        explanation="We store the first padlock code in our inventory.",
        concepts=["export"],
        is_setup=True,
    ),
    DemoStep(
        command="cd ../lower-quadrant",
        chapter=_CH10,
        section="Lower Quadrant",
        explanation=(
            "The lower quadrant of the graveyard has old gravestones "
            "that need to be sorted to find a key date."
        ),
        concepts=["cd"],
    ),
    DemoStep(
        command="cat scroll",
        chapter=_CH10,
        section="Sorting the Gravestones",
        explanation=(
            "This scroll teaches the ``sort`` command — it arranges "
            "lines of text in alphabetical or numerical order. We "
            "use it to sort the gravestones and find a familiar name "
            "with an important year."
        ),
        concepts=["sort"],
    ),
    DemoStep(
        command="sort gravestones",
        chapter=_CH10,
        section="Reading the Sorted Stones",
        explanation=(
            "``sort`` arranges the gravestone entries. We look for a "
            "name that connects to the game's lore and note the year "
            "**1765** — the second padlock code."
        ),
        concepts=["sort", "text processing"],
    ),
    DemoStep(
        command="export I=1765,$I",
        chapter=_CH10,
        section="Second Code",
        explanation="We store the second padlock code.",
        concepts=["export"],
        is_setup=True,
    ),
    DemoStep(
        command="cd ../royal-tombs",
        chapter=_CH10,
        section="Royal Tombs",
        explanation=(
            "The royal tombs contain stone statues — one of which can "
            "receive the crown we took from the monster."
        ),
        concepts=["cd"],
    ),
    DemoStep(
        command="cat scroll",
        chapter=_CH10,
        section="Royal Tombs Atmosphere",
        explanation=(
            "Weathered marble, cracked tombs, stone angels and lions "
            "— the royal tombs are the resting place of ancient kings."
        ),
        concepts=["cat"],
    ),
    DemoStep(
        command="./statues",
        chapter=_CH10,
        section="Placing the Crown",
        explanation=(
            "The statues encounter checks our inventory for the crown. "
            "We need to choose the correct statue (number 5 — the "
            "king). Placing the crown reveals the third code: **7432**. "
            "The script also teaches ``sed`` for removing items from "
            "inventory."
        ),
        concepts=["./", "grep", "sed", "interactive puzzles"],
        stdin_input="y\n5\n",
        expected_contains=["7432"],
    ),
    DemoStep(
        command="export I=7432,$I",
        chapter=_CH10,
        section="Third Code",
        explanation="We store the third and final padlock code.",
        concepts=["export"],
        is_setup=True,
    ),
    DemoStep(
        command="export I=$(echo $I | sed 's/crown//;s/,,/,/')",
        chapter=_CH10,
        section="Removing the Crown",
        explanation=(
            "The crown was placed on the statue, so we remove it from "
            "our inventory using ``sed``."
        ),
        concepts=["sed", "command substitution"],
        is_setup=True,
    ),
    DemoStep(
        command="cd ..",
        chapter=_CH10,
        section="Back to Graveyard",
        explanation="We return to the graveyard entrance.",
        concepts=["cd .."],
    ),
    DemoStep(
        command="./padlock",
        chapter=_CH10,
        section="Unlocking the Mausoleum",
        explanation=(
            "The padlock checks our inventory for the three codes: "
            "2712, 1765, and 7432. With all three present, the padlock "
            "opens and the mausoleum directory is revealed (renamed "
            "from ``.mausoleum`` to ``mausoleum``)."
        ),
        concepts=["./", "mv", "unlocking hidden dirs"],
        stdin_input="y\n",
    ),
    DemoStep(
        command="cd mausoleum",
        chapter=_CH10,
        section="The Mausoleum",
        explanation=(
            "The newly unlocked mausoleum contains loot, a room "
            "description file, and a spell scroll."
        ),
        concepts=["cd"],
    ),
    DemoStep(
        command="cat scroll",
        chapter=_CH10,
        section="Mausoleum Scroll",
        explanation=(
            "The mausoleum scroll teaches ``cat`` on specific files "
            "and hints at using ``./loot`` after solving the room's "
            "puzzle."
        ),
        concepts=["cat"],
    ),
    DemoStep(
        command="cat room",
        chapter=_CH10,
        section="Reading the Room",
        explanation=(
            "The ``room`` file contains descriptions of items with "
            "numbers — we need to find the right combination to answer "
            "the loot script's question."
        ),
        concepts=["cat"],
    ),
    DemoStep(
        command="cat spell",
        chapter=_CH10,
        section="The Spell of Aid",
        explanation=(
            "This spell teaches piping: ``sort room | uniq``. The "
            "pipe (``|``) sends the output of one command as input to "
            "another. ``uniq`` removes consecutive duplicate lines. "
            "Together, they help decode the room's puzzle."
        ),
        concepts=["pipe |", "sort", "uniq"],
    ),
    DemoStep(
        command="sort room | uniq",
        chapter=_CH10,
        section="Solving the Puzzle",
        explanation=(
            "We pipe ``sort`` output through ``uniq`` to eliminate "
            "duplicates and reveal the true contents. The answer code "
            "is **27121981**."
        ),
        concepts=["pipe |", "sort", "uniq"],
    ),
    DemoStep(
        command="./loot",
        chapter=_CH10,
        section="Claiming the Loot",
        explanation=(
            "We enter the code **27121981**. If correct, we receive "
            "gold coins, a bracelet, and silver keys. Wrong answers "
            "cause the mausoleum to collapse, re-hiding it and "
            "triggering a game over."
        ),
        concepts=["./", "interactive scripts"],
        stdin_input="27121981\n",
    ),
    DemoStep(
        command="export I=goldcoins,bracelet,silverkeys,$I,",
        chapter=_CH10,
        section="Mausoleum Loot",
        explanation="We collect all three items from the mausoleum.",
        concepts=["export"],
        is_setup=True,
    ),
    DemoStep(
        command="cd ../../..",
        chapter=_CH10,
        section="Returning to Entrance",
        explanation="We navigate back to the entrance level.",
        concepts=["cd", ".."],
    ),
]

# ===================================================================
# Chapter 11 — The Vault
# ===================================================================

_CH11 = "The Vault"

CHAPTER_11: list[DemoStep] = [
    DemoStep(
        command="cd vault",
        chapter=_CH11,
        section="Entering the Vault",
        explanation=(
            "The vault is the second hidden area. It contains glass "
            "shards, a stronghold with the goblet puzzle, and deeper "
            "within, a nursery and a ghost."
        ),
        concepts=["cd"],
    ),
    DemoStep(
        command="cat scroll",
        chapter=_CH11,
        section="Vault Scroll",
        explanation=(
            "The vault scroll describes an eerie scene — glass shards "
            "that seem to watch you, and a painting of two goblets."
        ),
        concepts=["cat"],
    ),
    DemoStep(
        command="ls -F",
        chapter=_CH11,
        section="Vault Contents",
        explanation=(
            "The vault contains ``glass`` (executable — for the ice "
            "crystal), ``scroll``, and ``stronghold/`` (directory "
            "leading deeper)."
        ),
        concepts=["ls -F"],
    ),
    DemoStep(
        command="./glass",
        chapter=_CH11,
        section="Enchanting the Sword",
        explanation=(
            "The glass encounter checks if we have the ice crystal "
            "from the aviary. If so, we can place it among the glass "
            "shards to enchant our sword with blizzard power. This "
            "gives +2 bonus in the ghost fight. The script uses "
            "``grep`` to check inventory and ``sed`` to remove the "
            "crystal."
        ),
        concepts=["./", "grep", "sed", "game mechanics"],
        stdin_input="y\n",
    ),
    DemoStep(
        command="export I=$(echo $I | sed 's/crystal//;s/,,/,/')",
        chapter=_CH11,
        section="Crystal Consumed",
        explanation=(
            "The crystal was used to enchant our sword, so we remove "
            "it from inventory."
        ),
        concepts=["sed", "command substitution"],
        is_setup=True,
    ),
    DemoStep(
        command="cd stronghold",
        chapter=_CH11,
        section="The Stronghold",
        explanation=(
            "The stronghold is a fortified inner chamber containing "
            "the goblet puzzle — the key to unlocking the rift."
        ),
        concepts=["cd"],
    ),
    DemoStep(
        command="cat scroll",
        chapter=_CH11,
        section="Stronghold Scroll",
        explanation=(
            "The scroll describes a goblet at the center of a runic "
            "triangle, flanked by ``orb1`` and empty spaces for "
            "``orb2`` and ``orb3``. The hint? Copy ``orb1`` to create "
            "the missing orbs."
        ),
        concepts=["cat", "cp"],
    ),
    DemoStep(
        command="ls -F",
        chapter=_CH11,
        section="Stronghold Contents",
        explanation=(
            "We see ``goblet`` (executable), ``orb1`` (a file to "
            "copy), ``scroll``, and ``nursery/`` deeper within."
        ),
        concepts=["ls"],
    ),
    DemoStep(
        command="cp orb1 orb2",
        chapter=_CH11,
        section="Copying the First Orb",
        explanation=(
            "``cp`` copies files. We duplicate ``orb1`` to create "
            "``orb2``. This is a fundamental filesystem operation — "
            "creating copies of files is essential for backups, "
            "templates, and more."
        ),
        concepts=["cp", "file duplication"],
    ),
    DemoStep(
        command="cp orb1 orb3",
        chapter=_CH11,
        section="Copying the Second Orb",
        explanation="We create the third orb to complete the set.",
        concepts=["cp"],
    ),
    DemoStep(
        command="./goblet",
        chapter=_CH11,
        section="Activating the Goblet",
        explanation=(
            "With all three orbs present (``orb1``, ``orb2``, ``orb3``), "
            "the goblet activates and announces that the rift has "
            "opened. The script uses file-existence checks (``-f orb2`` "
            "and ``-f orb3``) and then runs ``mv ../../.rift ../../rift`` "
            "to unlock the rift directory at the entrance level."
        ),
        concepts=["./", "cp", "file existence checks", "mv"],
        expected_contains=["goblet"],
    ),
    DemoStep(
        command="export I=goblet,$I",
        chapter=_CH11,
        section="Collecting the Goblet",
        explanation="We add the goblet to our inventory.",
        concepts=["export"],
        is_setup=True,
    ),
    DemoStep(
        command="cd nursery",
        chapter=_CH11,
        section="The Nursery",
        explanation=(
            "The nursery of the still dead lies below the stronghold."
        ),
        concepts=["cd"],
    ),
    DemoStep(
        command="cat scroll",
        chapter=_CH11,
        section="Nursery Scroll",
        explanation="A brief atmospheric text — the nursery of the still dead.",
        concepts=["cat"],
    ),
    DemoStep(
        command="cd lab",
        chapter=_CH11,
        section="The Lab",
        explanation=(
            "The laboratory — an abandoned wizard's workspace where "
            "a ghost awaits."
        ),
        concepts=["cd"],
    ),
    DemoStep(
        command="cat scroll",
        chapter=_CH11,
        section="Lab Scroll",
        explanation="The lab scroll describes the eerie abandoned laboratory.",
        concepts=["cat"],
    ),
    DemoStep(
        command="./ghost",
        chapter=_CH11,
        section="Ghost Combat",
        explanation=(
            "The ghost of an evil wizard manifests. This is another "
            "random combat encounter using the same dice-roll system "
            "as the monster. Having the enchanted sword (via the ice "
            "crystal and glass encounter) gives +2 bonus. On victory, "
            "the ghost drops an emerald and platinum coins."
        ),
        concepts=["./", "combat", "$RANDOM", "game bonuses"],
        stdin_input="y\n3\n",
    ),
    DemoStep(
        command="cd ../../../..",
        chapter=_CH11,
        section="Returning to Entrance",
        explanation="We navigate back to the entrance level.",
        concepts=["cd", ".."],
    ),
]

# ===================================================================
# Chapter 12 — The Scrap Yard
# ===================================================================

_CH12 = "The Scrap Yard"

CHAPTER_12: list[DemoStep] = [
    DemoStep(
        command="cd scrap",
        chapter=_CH12,
        section="The Scrap Yard",
        explanation=(
            "The scrap yard is the third hidden area. Despite its "
            "unassuming name, it teaches one of Linux's most powerful "
            "features: symbolic links."
        ),
        concepts=["cd"],
    ),
    DemoStep(
        command="cat scroll",
        chapter=_CH12,
        section="Scrap Scroll — Symlinks Deep Dive",
        explanation=(
            "This scroll provides an in-depth lesson on ``ln -s`` "
            "(creating symlinks), ``ls -l`` (viewing where links "
            "point), and ``rm linkname`` (removing symlinks). Symlinks "
            "are shortcuts — references to files or directories "
            "located elsewhere. They're used everywhere in Linux: "
            "``/usr/bin/python`` is often a symlink, libraries use "
            "them for versioning, and they simplify complex directory "
            "structures."
        ),
        concepts=["ln -s", "ls -l", "rm", "symlinks"],
    ),
    DemoStep(
        command="cd ..",
        chapter=_CH12,
        section="Leaving the Scrap Yard",
        explanation="We return to the entrance for the final challenge.",
        concepts=["cd .."],
    ),
]

# ===================================================================
# Chapter 13 — The Rift (Final Area)
# ===================================================================

_CH13 = "The Rift"

CHAPTER_13: list[DemoStep] = [
    DemoStep(
        command="cd rift",
        chapter=_CH13,
        section="Entering the Rift",
        explanation=(
            "The rift is the endgame area — a dimension of red skies "
            "and flame trees. It was unlocked by the goblet in the "
            "vault's stronghold. The final boss, Nyarlathotep, awaits "
            "in the arena pit."
        ),
        concepts=["cd", "endgame"],
    ),
    DemoStep(
        command="cat scroll",
        chapter=_CH13,
        section="Rift Scroll",
        explanation=(
            "The rift scroll is atmospheric — red sky, mountains "
            "floating in the sky, and flame trees. You have entered "
            "another dimension."
        ),
        concepts=["cat"],
    ),
    DemoStep(
        command="ls -F",
        chapter=_CH13,
        section="Rift Contents",
        explanation=(
            "The rift contains ``box`` (a POSIX login puzzle), "
            "``arena/`` (where the final boss waits), and ``spire/`` "
            "(a mysterious tower with an elevator)."
        ),
        concepts=["ls -F"],
    ),
    DemoStep(
        command="./box",
        chapter=_CH13,
        section="The POSIX Box",
        explanation=(
            "The illuminated metal box presents a POSIX login screen. "
            "It asks for your username — the ``$USER`` environment "
            "variable. Entering your actual system username unlocks "
            "armour and a combat bonus. This teaches the ``$USER`` "
            "variable, which is preset by the operating system."
        ),
        concepts=["$USER", "environment variables", "POSIX"],
        stdin_input="y\n${USER}\n",
    ),
    DemoStep(
        command="cd arena",
        chapter=_CH13,
        section="The Arena",
        explanation=(
            "The Chamber of Nyarlathotep — an ancient arena built for "
            "blood sport. A gaping pit lies at its center."
        ),
        concepts=["cd"],
    ),
    DemoStep(
        command="cat scroll",
        chapter=_CH13,
        section="Arena Scroll",
        explanation=(
            "The arena scroll describes the scene and suggests "
            "preparing for the final battle. Summoning a potion first "
            "would be wise."
        ),
        concepts=["cat"],
    ),
    DemoStep(
        command="cd pit",
        chapter=_CH13,
        section="The Pit",
        explanation=(
            "We descend into the pit where Nyarlathotep, the crawling "
            "chaos, has been waiting."
        ),
        concepts=["cd"],
    ),
    DemoStep(
        command="cat scroll",
        chapter=_CH13,
        section="Pit Scroll",
        explanation="Nyarlathotep has been waiting.",
        concepts=["cat"],
    ),
    DemoStep(
        command="ls -F",
        chapter=_CH13,
        section="Pit Contents",
        explanation=(
            "The pit contains ``drummer`` (to weaken Nyarlathotep), "
            "``nyarlathotep`` (the final boss), ``wizard-light`` "
            "(summon an ally), plus the ``drum`` text file and "
            "``scroll``."
        ),
        concepts=["ls"],
    ),
    DemoStep(
        command="./drummer",
        chapter=_CH13,
        section="Stopping the Drums",
        explanation=(
            "The drummer script reveals that war drums give "
            "Nyarlathotep extra strength (+2 to his roll). The hint "
            "is to use ``mv`` to rename or remove the ``drum`` file. "
            "Once the drum is gone, Nyarlathotep loses the bonus."
        ),
        concepts=["./", "mv"],
    ),
    DemoStep(
        command="mv drum drum.silenced",
        chapter=_CH13,
        section="Silencing the Drums",
        explanation=(
            "We use ``mv`` to rename ``drum`` to ``drum.silenced``, "
            "effectively removing the drummer's power source. ``mv`` "
            "can both move files to new locations and rename them. "
            "This strategic use of filesystem manipulation is the "
            "final lesson of the game."
        ),
        concepts=["mv", "rename files"],
    ),
    DemoStep(
        command="./nyarlathotep",
        chapter=_CH13,
        section="The Final Battle",
        explanation=(
            "Nyarlathotep — the crawling chaos — is the final boss. "
            "The combat uses the same dice system but with higher "
            "stakes: the base monster roll is +3, silencing the drum "
            "gives -2 (net +1), and the POSIX box blessing gives an "
            "additional +2 bonus to the player. On victory, "
            "Nyarlathotep is defeated and drops legendary loot. On "
            "loss, 10 HP damage. This is the culmination of every "
            "command learned throughout the game."
        ),
        concepts=["./", "combat", "game finale"],
        stdin_input="y\n7\n",
    ),
    DemoStep(
        command="ls -F",
        chapter=_CH13,
        section="Victory Loot",
        explanation=(
            "After defeating Nyarlathotep, new files appear: "
            "``treasure`` (hair of a god), ``platinum`` (bracelet of "
            "chaotic necromancy), and ``end`` (the victory message)."
        ),
        concepts=["ls"],
    ),
    DemoStep(
        command="cat end",
        chapter=_CH13,
        section="The End",
        explanation=(
            "The ``end`` file contains the game's victory message. "
            "You have reached the end of Bashcrawl. You now know enough "
            "Bash to use it for everyday activities — navigating "
            "directories, viewing files, managing permissions, writing "
            "scripts, using pipes and filters, and understanding "
            "symlinks, environment variables, and arithmetic."
        ),
        concepts=["cat", "completion"],
    ),
]

# ===================================================================
# Assemble the complete script
# ===================================================================

FULL_GAME_SCRIPT: list[DemoStep] = (
    CHAPTER_1
    + CHAPTER_2
    + CHAPTER_3
    + CHAPTER_4
    + CHAPTER_5
    + CHAPTER_6
    + CHAPTER_7
    + CHAPTER_8
    + CHAPTER_9
    + CHAPTER_10
    + CHAPTER_11
    + CHAPTER_12
    + CHAPTER_13
)

# Also export a "critical path only" subset (entrance → chamber)
CRITICAL_PATH_SCRIPT: list[DemoStep] = (
    CHAPTER_1 + CHAPTER_2 + CHAPTER_3 + CHAPTER_4
)

# Chapter metadata for the markdown generator
CHAPTERS: list[dict[str, str]] = [
    {
        "name": _CH1,
        "intro": (
            "The adventure begins at the dungeon entrance. Here you "
            "learn the three most fundamental terminal commands: "
            "``pwd`` (where am I?), ``ls`` (what's here?), and "
            "``cat`` (read a file). These three commands form the "
            "foundation of all terminal navigation."
        ),
    },
    {
        "name": _CH2,
        "intro": (
            "The cellar lies beneath the entrance and introduces "
            "enhanced file listing with ``ls -F``, which reveals file "
            "types at a glance. You also encounter your first treasure "
            "and learn about ``export`` for managing variables."
        ),
    },
    {
        "name": _CH3,
        "intro": (
            "The armoury is stocked with weapons, potions, and "
            "knowledge about file execution. You learn to run scripts "
            "with ``./``, interact with prompts via ``read``, and "
            "manage your health points with environment variables."
        ),
    },
    {
        "name": _CH4,
        "intro": (
            "The Chamber of Spirits is the climax of the main quest. "
            "You face the living statue in combat, master environment "
            "variables with ``export`` and ``let``, and discover the "
            "ancient art of symbolic links through the wall's "
            "inscribed runes."
        ),
    },
    {
        "name": _CH5,
        "intro": (
            "The workshop is a side room off the entrance that serves "
            "as a hands-on practice lab for file management: "
            "``mkdir``, ``touch``, ``cp``, ``rm``, and output "
            "redirection with ``>``."
        ),
    },
    {
        "name": _CH6,
        "intro": (
            "With the amulet collected, the chapel's doors swing open. "
            "This hidden area introduces command history, more complex "
            "interactions, and hidden items that prove useful later."
        ),
    },
    {
        "name": _CH7,
        "intro": (
            "The frost-bitten aviary houses penguins and an ice "
            "crystal. Here you learn tab completion, encounter ``sed`` "
            "for text manipulation, and collect items needed for "
            "the vault."
        ),
    },
    {
        "name": _CH8,
        "intro": (
            "The great hall introduces ``grep`` — one of Linux's most "
            "powerful search tools — and a combat encounter with a "
            "fearsome monster guarding a treasure."
        ),
    },
    {
        "name": _CH9,
        "intro": (
            "A small, atmospheric library with dusty tomes. A brief "
            "respite before the graveyard."
        ),
    },
    {
        "name": _CH10,
        "intro": (
            "The graveyard is an elaborate puzzle area teaching "
            "``touch``, ``sort``, pipes (``|``), and ``uniq``. Three "
            "codes must be found across its sub-areas to unlock the "
            "mausoleum."
        ),
    },
    {
        "name": _CH11,
        "intro": (
            "The vault holds the key to the final area. You enchant "
            "your sword with an ice crystal, solve the orb/goblet "
            "puzzle using ``cp``, and face a ghostly wizard in combat."
        ),
    },
    {
        "name": _CH12,
        "intro": (
            "The scrap yard provides a focused lesson on symbolic "
            "links (``ln -s``) — shortcuts that connect distant parts "
            "of the filesystem."
        ),
    },
    {
        "name": _CH13,
        "intro": (
            "The rift is the endgame dimension. You use ``$USER`` to "
            "solve a POSIX puzzle, ``mv`` to silence enemy war drums, "
            "and face Nyarlathotep in the final battle. Victory means "
            "mastering the Bash shell."
        ),
    },
]
