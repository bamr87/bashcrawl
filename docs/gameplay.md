# Gameplay Guide

Bashcrawl teaches terminal commands through a fantasy dungeon adventure. Directories
are rooms, files named `scroll` are educational content, and executable scripts are
interactive encounters.

## Core Commands

| Action | Command | Example |
|--------|---------|---------|
| Look around | `ls` or `ls -F` | See room contents |
| Move to a room | `cd DIRECTORY` | `cd cellar` |
| Go back | `cd ..` | Return to parent room |
| Read a scroll | `cat scroll` | Display educational content |
| Run an encounter | `./EXECUTABLE` | `./treasure` |
| Check location | `pwd` | Print working directory |
| Find hidden items | `ls -la` | Show hidden files/dirs |

## Room Progression

The main path teaches commands in order of complexity:

```
entrance/          → ls, cd, cat, pwd
  └── cellar/      → ls -F, file types, ./executable
      └── armoury/ → chmod, permissions, paths
          └── chamber/ → export, echo, let, variables
```

After collecting treasures, hidden areas unlock from the entrance:

- **chapel/** — Deep dungeon with multiple sub-rooms and a monster fight
- **vault/** — Teaches `cp` (copy files) with an orb puzzle
- **scrap/** — Teaches `ln -s` (symlinks / portals)
- **rift/** — Unlocked by completing the vault; advanced challenges

## Inventory System

Your inventory is a comma-separated environment variable `$I`:

```bash
export I=amulet,$I       # Add an item
echo $I                  # Check inventory → amulet,sword,
grep sword <<< "$I"      # Check for specific item
```

Treasures tell you what to add. Follow their `export` instructions.

## Health System

Health is tracked in the `$HP` environment variable:

```bash
export HP=15             # Set by potions
echo $HP                 # Check health
let "HP=HP-5"            # Take damage
```

If HP reaches 0 during combat, you die and `gameover()` triggers.

## Game File Types

When you run `ls -F`, indicators reveal file types:

| Indicator | Meaning | Action |
|-----------|---------|--------|
| `/` | Directory (room) | `cd` into it |
| `*` | Executable (encounter) | Run with `./` |
| (none) | Regular file (scroll) | Read with `cat` |
| `@` | Symlink (portal) | `cd` through it |

## Encounters

| File Name | What It Does |
|-----------|-------------|
| `treasure` | Adds items to inventory, may unlock hidden rooms |
| `potion` | Interactive y/n prompt; sets HP variable |
| `spell` | Teaches `ln -s`; creates portal symlinks |
| `statue` | Combat encounter; tests for sword in inventory |
| `monster` | Dice-roll combat; randomly generated outcomes |
| `ghost` | Combat in deep hidden areas |
| `goblet` | Puzzle requiring `cp` to solve |

## Hidden Rooms

Hidden directories (prefixed with `.`) are unlocked when you run treasure
scripts or complete encounters. They become visible via `ls -la` and
accessible via `cd`.

The unlock mechanism uses `mv` to rename hidden directories:
```
.chapel → chapel    (unlocked by cellar/armoury treasures)
.vault  → vault     (unlocked by cellar/armoury treasures)
.scrap  → scrap     (unlocked by cellar/armoury treasures)
.rift   → rift      (unlocked by vault/stronghold/goblet)
```

## Combat

Combat encounters (`statue`, `monster`, `ghost`) follow this pattern:

1. Story text describes the enemy
2. You choose to fight or flee (y/n)
3. If fighting, the game checks your inventory for a weapon
4. Damage is dealt via `let "HP=HP-5"`
5. If HP ≤ 0, `gameover()` runs — you die and restart at entrance

**Tip:** Always have a sword (`./treasure` in the armoury) and health
(`./potion`) before entering combat rooms.

## Game State

The game uses environment variables (`$I`, `$HP`) and file-based flags
(`.statue_defeated`, renamed directories) to track progress. These persist
only in your current shell session.

To start fresh: `bash lib/reset.sh`
