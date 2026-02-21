# 🌟 The Cellar of True Sight

*The air grows thick with mystical energy as you descend into the cellar. Here, ancient magic teaches adventurers to distinguish reality from illusion.*

**Illusions are strong here.** It is difficult to tell what is a doorway and what is an object. The untrained eye sees only a simple list of names, but the wise terminal mage learns to perceive the **true nature** of all things in the catacombs.

## ⚡ The Enhanced Sight Spell: `ls -F`

The magic spell you use to look can be **augmented**. From now on, cast your spell like this:

```bash
ls -F
```

When you cast `ls -F`, mystical symbols reveal the true nature of each entity:

*   **`/`** at the end means a **Directory** (a room you can enter).
*   **`*`** at the end means an **Executable** (a program or monster you can run).
*   No symbol at the end means a **Regular File** (a scroll or item to be read).

To make this permanent for your session, you can create a **command alias**:

```bash
alias ls='ls -F'
```

---

## 💎 The Amulet Forging Challenge

You have discovered an ancient `treasure` artifact. It is not a chest to be opened, but a magickal item that reveals a powerful **amulet-forging recipe** when activated.

**The Challenge:**

Your task is to forge this recipe into a runnable script named `forge_amulet.sh`. You must do this with a **single command-line incantation**. This command must:

1.  **Activate** the `treasure` artifact to reveal the recipe text.
2.  **Filter** the output to capture *only* the line containing the recipe itself.
3.  **Write** the captured recipe into the new `forge_amulet.sh` file.
4.  **Make** the new script executable.

**Hints:**
*   Activate the treasure with `./treasure`.
*   You will need to channel the output of one command into another using a **pipe (`|`)**.
*   The `grep` command is excellent for filtering text to find specific lines.
*   Combine commands with `&&`.

Once you have successfully forged the script, you can claim your reward by running it with the `source` command, which will properly add the amulet to your inventory:

```bash
source ./forge_amulet.sh
```

Check your success with `echo $I`.

## 🗺️ Next Steps

After forging your amulet, new paths will open:

*   **🗡️ The Armoury**: Learn combat skills and file manipulation.
*   **⛪ Hidden Chapel**: Discover secret commands and advanced techniques.
*   **💰 The Vault**: Master inventory management and environment variables.
*   **🔧 The Scrap**: Learn symlinks (ln -s), shortcuts, and portal creation.