# ⚔️ Bashcrawl — learn the terminal by playing

> **v3.1** — one game, two doors: the classic filesystem dungeon in your terminal,
> and a free browser trainer with mini-games and cheatsheets built from the same content.

Bashcrawl teaches real POSIX terminal skills through a fantasy dungeon crawl. The core idea: **the filesystem is the game.** Directories are rooms, files named `scroll` are the story and the lessons, and executable scripts are the encounters. Every command you learn — `pwd`, `ls`, `cd`, `cat`, `grep`, `find`, pipes, variables, permissions — is the real thing, usable on any Linux/macOS machine forever.

## 🎮 Play it

### In your browser (the flagship)

Open the **[web app](https://bamr87.github.io/bashcrawl/)** — no install, free, works on mobile.

Three doors:

- **⚔ Story** — descend the dungeon. Quests guide you from `pwd` to pipes; hidden
rooms reward `grep`, `find`, environment variables, and symbolic links. XP, achievements, a fog-of-war map, and a pixel hero cheer you on.
- **🕹 Practice Arcade** — timed mini-games on the same bash emulator:
  - **Path Navigator** — race through the real dungeon to a target room (`cd`/`ls`/`tree`).
  - **grep/find Hunt** — one file carries the sigil; track it down (`grep -r`, `find -name`, dotfiles).
  - **Pipe Puzzle** — forge a pipeline that turns INPUT into TARGET (`sort | uniq -c | head`…).
  - **Command Flash** — rapid-fire "which command?" drills, generated from the game's own reference data.

  Scores persist, bests are tracked, and every win feeds XP back to your story hero.
- **📖 Reference** — searchable cheatsheets for every command the dungeon teaches,
plus a glossary and a map of *where* each concept is taught. While you play the story, a **concept spotlight** shows what the current room teaches, and an inline hint reminds you of syntax as you type.

### Old school, in a real terminal

```bash
git clone https://github.com/bamr87/bashcrawl.git
cd bashcrawl
./setup.sh        # one-time: makes the encounters executable
cd entrance
cat scroll        # ...and the dungeon takes it from there
```

That's the whole game loop: read scrolls, move with `cd`, look with `ls`, run encounters with `./treasure`. No launcher, no dependencies, no framework — just bash and your curiosity. Stuck? `bash help.sh` gives context-aware help.

Reset your dungeon after playing: `bash lib/reset.sh` (preview with `--dry`).

## 🧭 What's in the box

| Piece | What it is |
|---|---|
| `entrance/` | The dungeon itself — rooms, scrolls, encounters. Pure bash. |
| `web/` | The static browser trainer (story + arcade + reference). No build framework, hosted free on GitHub Pages. |
| `termforge/` | **TermForge** — the universal terminal framework extracted from the web emulator: one kernel powering the browser game, `make tty-demo` (play in your terminal), `make telnet-demo` (serve over lightweight telnet/TCP), and custom monitoring-style tools. Zero dependencies; node needed only for the framework, never to play the bash game. See [docs/termforge/architecture.md](docs/termforge/architecture.md). |
| `src/help/` | The bash help engine and the **content registries** (`data/*.yaml`) — the single source of truth for rooms, quests, commands, encounters, tutorials, and arcade content. |
| `scripts/export_static_web.py` | Generates `web/data/*.json` from `entrance/` + the YAML registries. The web app is always a projection of the real game. |
| `src/playtest/` | A lean MCP harness: an AI agent plays the *real* dungeon in a sandboxed bash session, and a scorer flags content gaps. |
| `test/` | Contract + integration tests keeping the registries, the filesystem, and the web runtime in sync (plus `termforge/test/` — the framework's own `node --test` suite with golden transcripts). |

## 🔧 For developers

```bash
make help               # all targets
make web-build          # regenerate web/data/*.json from the game content
make web-preview        # serve the web app at http://127.0.0.1:8000
make web-test           # build + validate the static bundle
make validate-contracts # YAML registries ↔ filesystem ↔ runtime parity
make test               # unit + integration suite (pytest)
make lint               # shellcheck + yamllint + markdownlint (+ ruff)
make playtest           # Claude plays the game blind via MCP, then scores it
```

Python (3.10+) is only needed for the web export and the playtest harness: `pip install -r requirements.txt` (just `pyyaml` + `mcp`).

### Adding content

1. Add rooms/scrolls/encounters under `entrance/` (see `.github/instructions/`).
2. Keep the registries in `src/help/data/*.yaml` in sync — they drive the help
   system, the web app, and the docs.
3. Arcade content lives in `src/help/data/arcade.yaml` (pipe puzzles, hunts,
   flashcard decks); Command Flash also auto-generates decks from `commands.yaml`.
4. `make validate-contracts && make web-test` — CI enforces both.

### Playtesting with an AI agent

The MCP server lets an agent play exactly like a human at a terminal — a persistent bash session in a throwaway copy of the dungeon:

```bash
PYTHONPATH=src python3 -m playtest.mcp_server   # tools: bashcrawl_start/observe/command/report_gap
bash scripts/playtest.sh                        # full loop: N blind runs + gap report + gates
```

## 🙏 Lineage

Bashcrawl was created by [Seth Kenlon](https://gitlab.com/slackermedia/bashcrawl) as a pure-filesystem game for teaching GNU/Linux basics. This fork keeps that soul — the terminal game is still just directories, scrolls, and bash — and adds the browser trainer generated from the same content.

Contributions welcome — read [docs/contributing.md](docs/contributing.md) first.
