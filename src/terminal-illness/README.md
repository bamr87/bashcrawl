### Terminal Illness — Bashcrawl Python Wrapper

A rich Python terminal interface that wraps the real bashcrawl game directories, adding quest tracking, styled output, tab completion, AI-powered Merlin chat, and save/load on top of the actual dungeon rooms.

### Quickstart

1) Install Python 3.10+
2) Install dependencies:

```
cd src/terminal-illness
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

3) Run the game (from the repo root):

```
python -m ti
```

Or specify the game root explicitly:

```
python -m ti --game-root /path/to/bashcrawl
```

### Architecture

The Python wrapper operates on the **real bashcrawl filesystem** — the same `entrance/`, `cellar/`, `armoury/`, and `chamber/` directories used by the native bash game. All commands (`ls`, `cd`, `cat`, `mkdir`, etc.) execute against real files, sandboxed to the game root.

### Module Layout

| File | Purpose |
|------|---------|
| `ti/main.py` | Entry point — auto-detects game root, handles save/load |
| `ti/filesystem.py` | Real filesystem wrapper with sandbox guard |
| `ti/terminal_engine.py` | Command parsing, tab completion, Rich UI rendering |
| `ti/game_state.py` | Persistent progress: quests, inventory (`$I`), HP, env vars |
| `ti/quests.py` | Quest definitions mapped to bashcrawl rooms |
| `ti/ai_agents.py` | Stubs for AI-generated quest/world expansion |
| `ti/ai_chat.py` | **Merlin AI chat service** — streams Claude responses |
| `ti/chat_context.py` | Game context builder for AI prompt injection |
| `ti/chat_panel.py` | Textual widget for the toggleable Merlin chat panel |
| `ti/chat_cli.py` | CLI bridge — lets `help.sh` call Merlin from bash |
| `ti/data/merlin_prompt.txt` | Merlin wizard persona + teaching rules system prompt |
| `seed_prompt.instructions.md` | LLM prompt template for AI agent integration |

### Merlin AI Chat Guide

Press **F3** to open the Merlin chat panel — a side panel where an AI wizard
guides you through the dungeon using Socratic hints and dungeon metaphors.

```
merlin how do I open the scroll?   # Open panel + ask in one command
```

Merlin is powered by **Claude** (`anthropic` SDK) and requires
`ANTHROPIC_API_KEY` in your environment. Without a key, Merlin falls back
to static contextual hints.

**Proactive nudges** — Merlin automatically offers guidance when:
- You enter a new room
- Your HP drops below 20
- You appear stuck (same command repeated 3+ times)
- You complete a quest

**Terminal-only AI bridge:**
```bash
bash help.sh merlin "how do I find hidden files?"
```

### Key Bindings (TUI)

| Key | Action |
|---|---|
| `F1` | Show help |
| `F2` | Show dungeon map |
| `F3` | **Toggle Merlin AI chat panel** |
| `Ctrl+S` | Save progress |
| `Ctrl+Q` | Quit |
| `Ctrl+L` | Clear output log |
| `Tab` | Command completion |
| `↑↓` | Command history |

### Quest Flow

1. **Awakening** — run `pwd` to learn your location
2. **Eyes to See** — `ls` to reveal rooms and scrolls
3. **First Steps** — `cd cellar` to descend deeper
4. **Ancient Knowledge** — `cat scroll` to read dungeon lore
5. **Shape the World** — `mkdir` to create something new
6. **Spark of Creation** — `touch` to create a file
7. **Seek the Whisper** — `grep` to search within scrolls

### Game Script Execution

Run bash game scripts directly:

```
./treasure    # Collect treasure, update inventory
./potion      # Drink a potion, gain HP
./statue      # Combat encounter
```

Scripts run via `subprocess` with the current game environment (`$I`, `$HP`).

### Commands

`pwd`, `ls`, `cd`, `mkdir`, `touch`, `cat`, `grep`, `rm`, `cp`, `mv`, `export`, `echo`, `save`, `load`, `merlin`, `exit`, plus `./script` execution.

### Resetting Progress

```
rm -f .ti_save.json
```

### Notes

- The game operates on real files within the bashcrawl game root.
- A sandbox guard prevents navigation outside the game directory.
- Press Ctrl+C or use `exit` to quit; progress saves automatically.

