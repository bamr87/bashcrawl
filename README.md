# Bashcrawl

> Learn real terminal skills by playing a fantasy dungeon crawl — in your own shell, or in a free browser trainer built from the same content.

[![CI](https://github.com/bamr87/bashcrawl/actions/workflows/ci.yml/badge.svg)](https://github.com/bamr87/bashcrawl/actions/workflows/ci.yml) [![License: GPL-3.0-only](https://img.shields.io/badge/license-GPL--3.0--only-blue)](LICENSE) [![Live site](https://img.shields.io/badge/live-bamr87.github.io%2Fbashcrawl-2ea44f)](https://bamr87.github.io/bashcrawl/)

## Overview

Bashcrawl teaches real POSIX terminal skills through a fantasy dungeon crawl. The core idea: **the filesystem is the game.** Directories are rooms, files named `scroll` are the story and the lessons, and executable scripts are the encounters. Every command you learn — `pwd`, `ls`, `cd`, `cat`, `grep`, `find`, pipes, variables, permissions — is the real thing, usable on any Linux/macOS machine forever.

Version 3.2 has one game and two doors: the classic filesystem dungeon in your terminal, and a free browser trainer with courses, mini-games and cheatsheets generated from the same content.

> Based on [**bashcrawl** by Seth Kenlon](https://gitlab.com/slackermedia/bashcrawl) (GPLv3). This project is a derivative of the original and is distributed under the same license, GPL-3.0-only. See [Lineage](#-lineage) and [NOTICE](NOTICE).

## Features

- **🎓 Learn** — guided courses beside a real terminal: the lesson on one side (click any `command` to drop it into the prompt), the shell on the other, every objective checked as you type. Each course seeds a lab of real files to practise on. Start here if the terminal is new to you.
- **⚔ Story** — descend the dungeon. Quests guide you from `pwd` to pipes; hidden rooms reward `grep`, `find`, environment variables and symbolic links. XP, achievements, a fog-of-war map and a pixel hero cheer you on; a status strip keeps your rank, health, quests, badges and streak in view, and **next-step chips** under the log suggest what to type.
- **🕹 Practice Arcade** — timed mini-games on the same bash emulator: **Path Navigator** (`cd`/`ls`/`tree`), **grep/find Hunt** (`grep -r`, `find -name`, dotfiles), **Pipe Puzzle** (`sort | uniq -c | head`…), **Command Flash** (rapid "which command?" drills from the game's own reference data) and the **Vim Catacombs** — VIM Adventures-style levels on a real vim buffer where the keys unlock level by level and score is keystrokes against par. Scores persist, and every win feeds XP back to your story hero.
- **📖 Reference** — searchable cheatsheets for every command the dungeon teaches, a glossary, and a map of *where* each concept is taught; while you play, a **concept spotlight** shows what the current room teaches.
- **The classic game** — no launcher, no dependencies, no framework: read scrolls, move with `cd`, look with `ls`, run encounters with `./treasure`. Stuck? `bash help.sh` gives context-aware help.
- **Every surface, one launcher** — `bin/bashcrawl` (plain bash, runs on macOS `/bin/bash` 3.2) reaches the classic dungeon, a full-screen terminal HUD, a telnet server, a shared telnet hub, the browser trainer, the course labs and a `doctor` health check.
- **A learning platform everywhere** — `learn` and `lesson` run the courses, `skills` shows the skill map every command grows, `review` is a spaced-repetition drill of your weakest skills, and `explain LINE` takes any command line apart offline, with no AI call.
- **AI playtesting** — an MCP harness lets an agent play the *real* dungeon in a sandboxed bash session, and a scorer flags content gaps.

## Quick start

Play in your browser: open the **[web app](https://bamr87.github.io/bashcrawl/)** — no install, free, works on mobile.

Play in a real terminal:

```bash
git clone https://github.com/bamr87/bashcrawl.git
cd bashcrawl
./setup.sh        # one-time: makes the encounters executable
cd entrance
cat scroll        # ...and the dungeon takes it from there
```

Reset your dungeon after playing with `bash lib/reset.sh` (preview with `--dry`).

Build, test and lint from the checkout (Python 3.10+ for the tooling, Node 22.22+ for the web app):

```bash
make setup               # play: chmod the encounters, then `cd entrance && cat scroll`
make venv                # .venv with requirements.txt + requirements-dev.txt
make web-install         # npm install (Node >= 22.22, always-latest ranges, no lockfile)
make web-dev             # web-build, then the Vite dev server at http://127.0.0.1:5173
make validate-contracts  # registries <-> filesystem <-> walkthrough <-> runtime handlers
make test                # pytest unit + integration
make test-js             # TermForge suites (node --test, zero deps)
make web-test            # web-build + bundle/handler parity + eslint + vitest + vite build
make lint                # shellcheck + yamllint + markdownlint + ruff
make lint-js             # node --check on every tracked *.js
make web-bundle          # build: web-build + vite build -> web/dist (what Pages serves)
```

## The launcher

`bin/bashcrawl` is the front door to every surface: `play`, `tty`, `serve`, `hub`, `web`, `courses`, `lab`, `doctor` and `reset`. Each subcommand needs only what its own surface needs — `play`, `courses`, `lab`, `doctor` and `reset` need nothing but bash. `bin/bashcrawl help` prints them all, and so does the generated [launcher reference](docs/generated/launcher.md).

## 🎓 Learn

Every surface (browser, `tty`, telnet) carries the learning platform. Each lesson has objectives the game checks as you type the real commands, and each course has a **lab** of real files under `/lab/ID` to read, pipe, change and break (`lab reset` restores it); `bin/bashcrawl lab ID` copies the same lab into real bash. Five courses ship today, from *Finding Your Way* (beginner) to *Words of Power* (advanced) — the generated [course catalogue](docs/generated/courses.md) lists them all. Courses are Markdown files with frontmatter, so adding one needs no code: see [docs/authoring-courses.md](docs/authoring-courses.md). How the platform lines up with the sibling repos [bashOS](https://github.com/bamr87/bashos) and [chui](https://github.com/bamr87/chui) is in [docs/PLATFORM.md](docs/PLATFORM.md).

## 🙏 Lineage

Bashcrawl was created by [Seth Kenlon](https://gitlab.com/slackermedia/bashcrawl) (with many upstream contributors) as a pure-filesystem game for teaching GNU/Linux basics, released under the GNU GPL v3. This project is a derivative of that original: it keeps that soul — the terminal game is still just directories, scrolls and bash — and adds the browser trainer generated from the same content.

## Documentation

Every guide, schema and generated reference is indexed in [docs/README.md](docs/README.md) — start with [getting started](docs/getting-started.md) and the [gameplay guide](docs/gameplay.md), or, for the code, [docs/PLATFORM.md](docs/PLATFORM.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Project structure

| Piece | What it is |
|---|---|
| `entrance/` | The dungeon itself — rooms, scrolls, encounters. Pure bash. |
| `courses/` | The courses: one Markdown file per lesson, objectives as rules, a lab of practice files per course. |
| `bin/bashcrawl` | The launcher: one dispatch table for every surface, plus `doctor` and `lab`. |
| `web/` | The browser trainer: a React + Vite app (`web/src/`, a 16-bit dungeon-RPG skin with a particle/shake/flash effects layer and optional chiptune SFX) over the same classic-script engine the terminal hosts run. Built to `web/dist/`, hosted free on GitHub Pages. |
| `termforge/` | **TermForge** — the universal terminal framework extracted from the web emulator: one kernel powering the browser game, the terminal HUD, the telnet server and custom monitoring-style tools. Zero dependencies. See [docs/termforge/architecture.md](docs/termforge/architecture.md). |
| `src/help/` | The bash help engine and the **content registries** (`data/*.yaml`) — the single source of truth for rooms, quests, commands, encounters, tutorials, arcade content and progression. |
| `scripts/` | The exporter that generates `web/data/*.json` from `entrance/` + the registries (the web app is always a projection of the real game), plus validators and doc generators. |
| `src/playtest/` | The MCP playtest harness: an agent plays the real dungeon in a sandboxed bash session. |
| `test/` | Contract and integration tests keeping the registries, the filesystem and the web runtime in sync (plus `termforge/test/`, the framework's own suite with golden transcripts). |
| `docs/` | Guides, schemas, the component map, and `docs/generated/` reference pages. |

## Development

Python (3.10+) is only needed for the web export, the validators and the playtest harness (`pip install -r requirements.txt` is just `pyyaml` + `mcp`); Node (22.22+) only to build or test the web app — the bash game never needs either to play. The commands are in [Quick start](#quick-start); `make help` and the generated [make targets reference](docs/generated/make-targets.md) list every target. To add rooms, scrolls or encounters, follow [docs/contributing.md](docs/contributing.md) and `.github/instructions/`; arcade content (pipe puzzles, hunts, flashcard decks, vim levels) lives in `src/help/data/arcade.yaml`. The exact gates, invariants and where to edit what are in [AGENTS.md](AGENTS.md), the canonical guide for contributors and agents.

## Contributing

Contributions are welcome via pull request — read [docs/contributing.md](docs/contributing.md) first. Use [Conventional Commits](https://www.conventionalcommits.org/) and keep the CI checks green. The fleet-wide workflow is described in the hub's [CONTRIBUTING.md](https://github.com/bamr87/bamr87/blob/main/CONTRIBUTING.md). AI agents start with [AGENTS.md](AGENTS.md).

## Changelog

Notable changes are recorded in [CHANGELOG.md](CHANGELOG.md).

## License

Copyright (C) 2019-2026 Seth Kenlon and the upstream bashcrawl contributors (original game). Copyright (C) 2025-2026 Amr Abdel-Motaleb (modifications).

Bashcrawl is a derivative of [the original bashcrawl](https://gitlab.com/slackermedia/bashcrawl) and, like it, is free software released under the [GNU General Public License v3.0](LICENSE) (`GPL-3.0-only`). See [NOTICE](NOTICE) for full attribution and the third-party components it includes. Contributions are accepted under the same license.

---

<!-- bamr87-portfolio-footer -->
Part of the [bamr87 portfolio](https://github.com/bamr87) — browse every project on [Amr's GitHub profile](https://github.com/bamr87).
