### Terminal Illness — A Fantasy Terminal Learning Game

Run a terminal-based RPG that teaches command-line skills through quests and magical theming. Classic Mode provides a structured path; Dynamic Mode is stubbed for future AI integration.

### Quickstart

1) Install Python 3.10+
2) Install dependencies:

```
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

3) Run the game:

```
python -m ti
```

### Core Features (Classic Mode)
- Guided quest progression (pwd, ls, cd, mkdir, touch, cat, grep)
- Virtual filesystem sandbox (safe; doesn’t touch your real files)
- Styled output with quest tracker and status panels
- Command history, path-sensitive tab completion, and contextual hints
- Automatic save/load plus manual `save` command
- Helpful feedback when viewing empty files (`cat` now reports `(empty file)`)

### Quest Flow at a Glance
1. **Awakening** – run `pwd` to learn where you are
2. **Eyes to See** – discover `ls`
3. **First Steps** – travel with `cd /home/hero`
4. **Shape the World** – create `workshop` via `mkdir`
5. **Spark of Creation** – `touch notes.txt` inside the workshop
6. **Read the Signs** – `cat notes.txt` (now surfaces empty files clearly)
7. **Seek the Whisper** – `grep Whisper scroll.txt` while in `/forest`

### Workspace Layout
- `ti/main.py`: Entrypoint and game loop
- `ti/game_state.py`: Persistent progress tracking
- `ti/vfs.py`: In-memory virtual filesystem (seed content + safe sandbox)
- `ti/quests.py`: Classic quests and completion checks
- `ti/terminal_engine.py`: Command parsing, autocompletion, rendering
- `ti/ai_agents.py`: Stubs/placeholders for Dynamic Mode
- Docs & tooling:
	- `COMPLETE_WALKTHROUGH.md`: Narrative walkthrough of every quest
	- `INTERACTIVE_TEST_REPORT.md`: Full QA log covering 100% of interactions
	- `explore_game.py`: Comprehensive exploration harness
	- `direct_test.py`: Scenario-driven gameplay tester
	- `interactive_test.sh`: Timed, full playthrough script
	- `error_test.sh`: Edge-case and error-handling smoke test

### Testing & Quality Assurance
- Every quest, command, and error path exercised in `INTERACTIVE_TEST_REPORT.md`
- `explore_game.py` or `direct_test.py` can be run for automated coverage:

```
source .venv/bin/activate
python explore_game.py      # full command + quest audit
python direct_test.py       # targeted scenario testing
./interactive_test.sh       # scripted terminal playthrough
./error_test.sh             # regression checks for failures
```

### Dynamic Mode (Preview)
Stubs for AI-generated quests/worlds live in `ti/ai_agents.py`. To wire up an LLM, implement providers there and gate calls on env config (e.g., `OPENAI_API_KEY`).

### Resetting Progress
Remove `.ti_save.json` to start fresh:

```
rm -f .ti_save.json
```

### Notes
- The game is self-contained and safe. All file operations happen inside the in-memory VFS.
- Press Ctrl+C or use the `exit` command to quit; progress saves automatically.

