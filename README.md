# ⚔️ Bashcrawl — learn the terminal by playing

> **v3.1** — one game, two doors: the classic filesystem dungeon in your terminal,
> and a free browser trainer with mini-games and cheatsheets built from the same content.

[![CI](https://github.com/bamr87/bashcrawl/actions/workflows/ci.yml/badge.svg)](https://github.com/bamr87/bashcrawl/actions/workflows/ci.yml) [![License: GPL-3.0-only](https://img.shields.io/badge/license-GPL--3.0--only-blue)](LICENSE) [![Live site](https://img.shields.io/badge/live-bamr87.github.io%2Fbashcrawl-2ea44f)](https://bamr87.github.io/bashcrawl/)

> Based on [**bashcrawl** by Seth Kenlon](https://gitlab.com/slackermedia/bashcrawl) (GPLv3). This project is a derivative of the original and is distributed under the same license, GPL-3.0-only. See [Lineage](#-lineage) and [NOTICE](NOTICE).

## Overview

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

### The front door: `bin/bashcrawl`

One launcher reaches every way to play. It's plain bash, so it runs on macOS `/bin/bash` 3.2. Each subcommand needs only what its own surface needs:

```bash
bin/bashcrawl play        # the classic dungeon in a bash subshell (bash only)
bin/bashcrawl tty         # the full-screen HUD in this terminal (Node 20.16+)
bin/bashcrawl serve       # telnet server on 127.0.0.1:2323
bin/bashcrawl hub         # …as a shared hub: who · say · emote · shout · top
bin/bashcrawl web         # the browser trainer on 127.0.0.1:8000
bin/bashcrawl courses     # the course catalogue
bin/bashcrawl lab ID      # copy a course's lab to ~/.bashcrawl/labs/ID for practice in a real shell
bin/bashcrawl doctor      # [ OK ] / [WARN] / [CRIT] for every surface on this machine
```

## 🎓 Learn

Beyond the dungeon, every surface (browser, `tty`, telnet) carries a learning platform:

- **`learn`** opens the courses, and **`learn ID`** starts one. Each lesson has objectives the game checks as you type the real commands, and each course has a **lab** of real files under `/lab/ID` to read, pipe, change and break (`lab reset` restores it).
- **`skills`** shows your skill map. Every command you run grows a skill: uses, the flags you've discovered, and what tripped you up.
- **`review`** is a spaced-repetition drill of your weakest, most-due skills (Leitner boxes, rescheduled 1 to 16 days out).
- **`explain LINE`** takes any command line apart: stages, flags, what each argument is here, pipes and redirects. It works offline with no AI call. Plain `explain` explains the line you just ran.

| Course | Level | Teaches |
|---|---|---|
| Finding Your Way | beginner | `pwd`, `ls -aF`, `cd`, relative and absolute paths, `tree`, `find` |
| Reading the Runes | beginner | `cat`, `file`, `head`/`tail -n`, `wc`, `nl`, `less` |
| The Pipeline Forge | intermediate | `grep -cvi`, `\|`, `sort`/`uniq -c`, `cut` on CSV, `>`/`>>`, a six-stage report |
| The Artificer's Workshop | intermediate | `mkdir`, `touch`, `cp`, `mv`, `rm`, `chmod +x`, `echo >` |
| Words of Power | advanced | variables, `let`, aliases, globs and quoting, `history` |

Courses are Markdown files with frontmatter. Adding one needs no code: see [docs/authoring-courses.md](docs/authoring-courses.md). The whole architecture, and how it lines up with the sibling repos [bashOS](https://github.com/bamr87/bashos) and [chui](https://github.com/bamr87/chui), is in [docs/PLATFORM.md](docs/PLATFORM.md).

## 🧭 What's in the box

| Piece | What it is |
|---|---|
| `entrance/` | The dungeon itself — rooms, scrolls, encounters. Pure bash. |
| `courses/` | The courses: one Markdown file per lesson, objectives as rules, a lab of practice files per course. |
| `bin/bashcrawl` | The launcher: one dispatch table for every surface, plus `doctor` and `lab`. |
| `web/` | The static browser trainer (story + arcade + reference). No build framework, hosted free on GitHub Pages. |
| `termforge/` | **TermForge** — the universal terminal framework extracted from the web emulator: one kernel powering the browser game, `make tty-demo` (play in your terminal), `make telnet-demo` (serve over lightweight telnet/TCP), and custom monitoring-style tools. Zero dependencies; node needed only for the framework, never to play the bash game. See [docs/termforge/architecture.md](docs/termforge/architecture.md). |
| `src/help/` | The bash help engine and the **content registries** (`data/*.yaml`) — the single source of truth for rooms, quests, commands, encounters, tutorials, arcade content, and progression (ranks, badges as rules, bestiary, trials, skills, review cards). |
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
make doctor             # what this machine can run, verdict-style
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

Bashcrawl was created by [Seth Kenlon](https://gitlab.com/slackermedia/bashcrawl) (with many upstream contributors) as a pure-filesystem game for teaching GNU/Linux basics, released under the GNU GPL v3. This project is a derivative of that original: it keeps that soul — the terminal game is still just directories, scrolls, and bash — and adds the browser trainer generated from the same content.

Contributions welcome — read [docs/contributing.md](docs/contributing.md) first.

## Contributing

Contributions are welcome via pull request. Use [Conventional Commits](https://www.conventionalcommits.org/) and keep the CI checks green. The fleet-wide workflow is described in the hub's [CONTRIBUTING.md](https://github.com/bamr87/bamr87/blob/main/CONTRIBUTING.md). AI agents should start with [AGENTS.md](AGENTS.md) (with [CLAUDE.md](CLAUDE.md) for Claude Code).

## Changelog

Notable changes are recorded in [CHANGELOG.md](CHANGELOG.md).

## License

Copyright (C) 2019-2026 Seth Kenlon and the upstream bashcrawl contributors (original game). Copyright (C) 2025-2026 Amr Abdel-Motaleb (modifications).

Bashcrawl is a derivative of [the original bashcrawl](https://gitlab.com/slackermedia/bashcrawl) and, like it, is free software released under the [GNU General Public License v3.0](LICENSE) (`GPL-3.0-only`). See [NOTICE](NOTICE) for full attribution and the third-party components it includes. Contributions are accepted under the same license.

---

<!-- bamr87-portfolio-footer -->
Part of the [bamr87 portfolio](https://github.com/bamr87) — browse every project on [Amr's GitHub profile](https://github.com/bamr87).
