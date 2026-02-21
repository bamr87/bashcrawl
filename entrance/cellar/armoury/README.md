# 🗡️ The Grand Armoury

*The metallic clang of weapons echoes through the chamber. This sacred armoury teaches the essential skills of executing programs, wielding scripts, and manipulating file permissions—the true weapons of a terminal warrior.*

## ⚡ Activation Spells: Running Executable Files

Items that end with `*` are **executable encounters**. You can activate them using a **relative path**:

```bash
./treasure      # Activate the treasure artifact in this room
./potion        # Consume the magickal potion
```

The `./` prefix is crucial. It tells the shell to look for the program in the current directory (`.`).

## 🔐 Permission Mastery: The `chmod` Enchantment

Sometimes, a script you create won't run. This is often because it doesn't have **execute permissions**. You can grant these permissions with the `chmod` command:

```bash
# Make a file executable
chmod +x your_script_name.sh
```

---

## 🏆 Armoury Forging Challenges

The artifacts in this room are not simple items; they are magickal forges that reveal powerful recipes when activated. Your challenge is to capture these recipes and turn them into usable scripts.

### Challenge 1: Forge the Sword

The `treasure` artifact holds the recipe for a gleaming silver **sword**. To forge it, you must create an executable script named `forge_sword.sh` with a single command.

**The Task:**

1.  **Activate** the `./treasure` artifact.
2.  **Pipe** its output to `grep` to isolate the recipe line.
3.  **Redirect** that line into a new file, `forge_sword.sh`.
4.  **Chain** a `chmod +x` command to make it executable.

Once forged, `source ./forge_sword.sh` to add the sword to your inventory.

### Challenge 2: Drink the Potion

The `potion` artifact holds the recipe for a health-restoring elixir. To drink it, you must create an executable script named `drink_potion.sh` with a single command.

**The Task:**

1.  **Activate** the `./potion` artifact.
2.  **Pipe** its output to `grep` to isolate the recipe line.
3.  **Redirect** that line into a new file, `drink_potion.sh`.
4.  **Chain** a `chmod +x` command to make it executable.

Once created, `source ./drink_potion.sh` to gain your health points.

## 🗺️ Next Steps

After mastering the armoury, you can advance to the inner `chamber/` for more advanced spellcasting, or return to the `cellar` to explore other paths.
