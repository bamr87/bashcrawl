<!-- kit: sdlc v0.1.0 · AGENTS.md is the CANONICAL agent instructions file (decision D4, UPS-AGENT-07/08). -->

# bashcrawl

> How to work in Bashcrawl, the terminal-teaching dungeon crawl: exact commands, layout, conventions and the invariants the gates enforce; canonical for every agent and contributor.

## What this repo is

Bashcrawl (v3.2) teaches real POSIX terminal commands through a fantasy dungeon crawl. **The filesystem is the game**: directories are rooms, files named `scroll` are the lessons, and executable scripts (`treasure`, `potion`, `spell`, `statue`, `ghost`, `monster`, `goblet`) are encounters. It serves learners at a real terminal or in the browser, and the people who author rooms and courses. The parts:

- **Terminal-core** (`entrance/`, `help.sh` + `src/help/`, `lib/`): pure POSIX shell, no dependencies, played with real `cd`/`ls`/`cat`.
- **Web trainer** (`web/`): a React 19 + Vite + TypeScript app (`web/src/`) over a classic-script engine (`web/assets/js/`) with four doors — Learn, Story, Practice Arcade, Reference. Its data is exported from the game by `scripts/export_static_web.py`; `npm run build` writes `web/dist/` (gitignored), which `pages.yml` deploys.
- **TermForge** (`termforge/`): the zero-dependency terminal framework the web emulator was extracted into — the kernel (`termforge/core/`), node hosts (tty HUD, telnet, hub) and apps.
- **Learning platform** (`courses/`): Markdown lessons whose objectives are TermForge rules, served by the `curriculum`, `mastery` and `explain` plugins on every surface.
- **Playtest harness** (`src/playtest/`): an MCP server that lets an AI agent play the real bash game in a sandboxed PTY, plus a recorder and scorer.
- **Launcher** (`bin/bashcrawl`): one optional, bash 3.2-compatible dispatch table for every surface.

A change is done when the CI gates below pass locally, every committed projection is regenerated, and the nearest README or doc is updated. The layer model is [docs/PLATFORM.md](docs/PLATFORM.md); the full component map is [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Stack & commands

Bash (3.2-compatible) for the game; Python 3.10+ (`pyyaml`, `mcp`) for the web export, validators and harness; Node ≥ 22.22 for the web app (the engine suites and hosts need only Node ≥ 20.16). The `Makefile` is canonical and exports `BASHCRAWL_ROOT` and `PYTHONPATH=src:test`; `make help` and the generated [docs/generated/make-targets.md](docs/generated/make-targets.md) list every target.

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

CI (`ci.yml`) runs exactly those gates: `make lint` + `make lint-js` + `npm run lint`, then `make validate-contracts` + `make test` + `make test-js` + `make web-test` on Node 24, plus a stock macOS `/bin/bash` 3.2 smoke. A fresh-clone run (`git clone . /tmp/x && cd /tmp/x && make validate-contracts web-test test test-js`) is what CI sees.

Single test (the pytest ini lives in `test/`; markers `unit`, `integration`, `slow`, `bash`):

```bash
cd test
export PYTHONPATH="$PWD/../src:$PWD" BASHCRAWL_ROOT="$PWD/.."
python3 -m pytest unit/test_static_web.py -v
```

Play, inspect and playtest:

```bash
bash help.sh                                    # contextual help; also: help.sh commands | map
bash lib/reset.sh --dry                         # preview a game-state reset (then drop --dry)
bin/bashcrawl courses                           # the catalogue; bin/bashcrawl lab ID copies a lab
make tty-demo                                   # the full-screen HUD (ARGS="--no-hud" for the stream)
make telnet-demo                                # telnet://127.0.0.1:2323 (make telnet-hub: MUD mode)
make doctor                                     # [ OK ]/[WARN]/[CRIT] per surface, exit 0/1/2
make agent-sandbox ARGS="--json"                # throwaway dungeon for an agent (--pty, --blind)
PYTHONPATH=src python3 -m playtest.mcp_server   # MCP: bashcrawl_start/observe/command/state/stop
make playtest                                   # blank-slate Claude playtest via MCP, then score
make generate-contract-docs                     # rewrite docs/generated/ (--check runs in validate-contracts)
```

`make playtest` needs the `claude` CLI and `CLAUDE_CODE_OAUTH_TOKEN` (it skips without them). `make playtest-grok` uses OpenCode SuperGrok OAuth (`~/.local/share/opencode/auth.json`, refreshed against `auth.x.ai`), with `XAI_API_KEY` as fallback only; `python3 -m playtest.xai_auth status|login` inspects or device-logs-in. MCP `bashcrawl_state` returns the room listing, scroll, inventory and HP, and `bashcrawl_start context=true` attaches a compact HUD to every reply; blank-slate playtests use neither and learn from the screen only.

## Layout

| Path | What lives there |
|---|---|
| `entrance/` | The dungeon: rooms, scrolls, encounters; hidden areas ship as dotted dirs |
| `courses/` | One directory per course: `course.md`, `NN-lesson.md`, `lab/` |
| `src/help/` | The bash help engine and the YAML content registries (`data/*.yaml`) |
| `src/playtest/` | The MCP playtest harness (Python) |
| `lib/`, `setup.sh`, `help.sh` | Shared shell libs, the chmod setup, the help shim |
| `bin/bashcrawl` | The launcher |
| `termforge/` | The framework: `core/` (source of truth), `node/` hosts, `apps/`, `motion/`, `test/` |
| `web/` | The trainer: `src/` (React app), `assets/js/` (engine), `data/` (generated), `index.html` |
| `motion/` | All art, as ASCII Motion `.asciimtn` files |
| `scripts/` | Export, vendoring, validators, generators, lint and test runners |
| `test/` | pytest unit + integration suites and datasets |
| `docs/` | Guides, schemas, the component map; `docs/generated/` is generated |
| `tools/` | Vendored hub tools (`unwrap-prose.py`, `docs_index.py`) — never edit |

## Conventions

- **Backlog of record:** GitHub Issues with the fleet labels. Pick up issues labelled `agent:ready`; never touch `agent:hold` or `human-review`.
- **Definition of Done:** the checklist in `.github/PULL_REQUEST_TEMPLATE/pull_request_template.md`, plus the CI gates above green locally.
- **Decisions:** none are recorded as ADRs yet; add `docs/adr/NNNN-slug.md` for anything hard to reverse.
- **Commits:** Conventional Commits (`feat fix docs style refactor test chore perf ci build`). **Branches:** `feature/`, `fix/`, `docs/`, `refactor/`, `test/` or `chore/` off `main`.
- **Changelog:** `CHANGELOG.md` (Keep a Changelog) records notable changes under `## [Unreleased]`.
- **Markdown:** one paragraph per line (`python3 tools/unwrap-prose.py --check`, `--write` to fix); CI's `markdown-oneline` pushes the fix otherwise.
- **Never:** push to `main` directly, commit a lockfile or secrets, suppress type errors, leave empty exception handlers, or hand-edit generated or vendored files: `web/data/*.json`, `web/assets/js/vendor/termforge/`, `termforge/core/art.js`, `web/assets/js/{fx-clips,art-clips}.js`, `docs/generated/`, `web/dist/`, `tools/`.
- Dependabot owns dependency updates.

## Where to edit

| Change | Edit here | Do not edit |
|---|---|---|
| Rooms, scrolls, encounters | `entrance/` + `src/help/data/*.yaml` | `web/data/*.json`, `docs/generated/` |
| Courses and lessons | `courses/<id>/` — see [docs/authoring-courses.md](docs/authoring-courses.md) | `web/data/courses.json` |
| Badges, ranks, bestiary, trials, skills, review cards | `src/help/data/progression.yaml` (badges are TermForge rules) | JS literals |
| Emulator kernel + platform services | `termforge/core/` (dual-mode, brand-neutral) | `web/assets/js/vendor/termforge/` |
| Game features (arena, daily, …) | `web/assets/js/plugins/<id>.js` + `GAME_PLUGINS` in `runtime.js` + a `<script>` in `web/index.html` | a second copy of a command |
| Game commands, presenter models, arcade games | `web/assets/js/runtime.js`, `hud.js`, `arcade.js` (`GAMES`), `vim.js` | an engine file turned ES module |
| Web UI (screens, HUD panes, effects, sound) | `web/src/`; tokens in `web/src/styles/tokens.css`, reactions in `web/src/fx/effects.ts`, sounds in `web/src/audio/sfx.ts` | colour literals or `z-index` numbers outside `tokens.css`; the log's children (a DomSink paints them) |
| Art | `motion/*.asciimtn` + `src/help/data/motion.yaml` | string literals in code |
| TermForge apps | `termforge/apps/registry.js` (one entry per app) | if-chains in the hosts |
| Launcher / playtest harness | `bin/bashcrawl` / `src/playtest/` | |

## Game content

- Hidden areas (`entrance/.chapel/`, `.vault/`, `.scrap/`, `.rift/`) are unlocked with `mv`; their visible names and `entrance/workshop/` are gitignored player state. Reset with `bash lib/reset.sh --dry` then `bash lib/reset.sh` — never `git checkout -- entrance/`.
- Game executables: `#!/usr/bin/env bash`, the 14-line "wandered out of bounds" header, no strict mode, plain-text heredocs (no ANSI), and they **never mutate git-tracked files**. State is `$I`/`$HP` plus untracked flags (`touch .statue_defeated`).
- Infra scripts (`setup.sh`, `help.sh`, `lib/*.sh`) use `set -euo pipefail`, `lib/colors.sh` and `lib/log.sh` — except `lib/playrc.sh`, the rcfile `bashcrawl play` sources into the player's interactive shell, where strict mode would break the game.
- macOS bash 3.2: `sed -i.bak` (never bare `sed -i`), no GNU-only flags, auto-detect `ls` colour flags. Lint shellchecks every `*.sh` and every executable under `entrance/` (severity=error).
- A new encounter **basename** goes in `ENCOUNTERS` in `setup.sh`, or `./setup.sh` will not `chmod +x` it.
- New room: directory + depth-graded `scroll` + chmod'd encounters + the unlock `mv` in a prerequisite treasure + `src/help/data/*.yaml` + `test/datasets/walkthrough.json` + `lib/reset.sh` if it can be unlocked; then `make generate-contract-docs && make validate-contracts && make web-test`. See `.github/instructions/rooms.instructions.md`.
- Scroll grades (`.github/instructions/scrolls.instructions.md`): entrance = pure ASCII, 80 columns, `===` dividers; cellar/armoury = Unicode box-drawing and emoji, `####` headers; hidden areas = Markdown.
- Courses: every objective needs a `solution` (`termforge/test/courses.test.js` replays them from a fresh lab and fails if a lesson is unwinnable or already complete); course files are tracked content, so check `git check-ignore` (`*.tmp` is ignored repo-wide).

## Web and TermForge rules

- **The engine stays classic.** `web/assets/js/**` is classic/CJS scripts shared with the node hosts; never make one an ES module, and the root `package.json` must never declare `"type": "module"`. `web/index.html` loads them in a fixed order that `scripts/validate_static_web.py` enforces ([the order](docs/ARCHITECTURE.md#web-app-rules)).
- **Edit `termforge/core/`, never the vendor mirror.** New core files keep the dual-mode wrapper (no `node:*`, no DOM), stay brand-neutral (`content-separation.test.js`), and are listed in `web/index.html` before `runtime.js`.
- **Committed projections:** `web/data/*.json` and the vendor mirror are committed; after content or `termforge/core/` changes run `make web-build` and commit the result — `make web-test` fails CI when they are stale.
- **The handlers literal:** `this.handlers = { … }` in `runtime.js` stays one static literal (exactly one `this.handlers = {` in the file), one `key: ref,` per line, bare refs only; every `demo: true` entry in `src/help/data/runtime_commands.yaml` must appear there (`validate_runtime_commands.py`).
- **Plugin order is hook order:** curriculum, then `GAME_PLUGINS` in order (`postExecute` order matters: achievements → daily → progress's rank-up), then mastery and explain.
- **Mini-games** are seed world + goal predicate + scoring over a scoped bare `Runtime`; never reimplement command behaviour. A new Vim Catacombs level is an `arcade.yaml` `vim_levels` entry whose `solution` wins at exactly `par` and steps on no spike (`arcade-vim.test.js`).
- **Design tokens:** colour literals and numeric `z-index` live only in `web/src/styles/tokens.css` (`theme.test.ts`); read a colour in code with `colorOf(role)`; everything that moves is gated on `prefers-reduced-motion`.
- **Art** is drawn only through `Shell#art(name)` / `<ArtClip name>`, never string literals (`art.test.js` scans `web/src` too).
- **The reader layer** (`web/src/terminal/prose.ts`, `log-decor.ts`) never rewrites text — `prose.test.ts` round-trips every scroll byte for byte; teach the classifier a convention rather than converting a scroll to Markdown.
- **Prompt words that open screens** (`journal`, `menu`, `hero`, `options`, `title`, …) go in `GameStore.intercept()`, not a `runtime.js` handler. Never use `AnimatePresence mode="wait"`; under jsdom assert store state, not a dialog's absence.
- **Saves are additive:** never rename or drop keys of the story save `bashcrawl-web-state-v1` (`game-save.test.js`); `termforge/test/fixtures/save/save-v1-legacy.json` is write-once; the `learn`/`mastery` slices are owned and sanitized by their plugins. Every `localStorage` key is listed in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#web-app-rules).
- **Goldens** (`termforge/test/fixtures/transcripts/`) are the emulator's behaviour contract: a fixture diff is a claimed behaviour change, regenerated only with `node termforge/test/tools/record-goldens.js --update`.
- **Registries** in `src/help/data/*.yaml` are the single source of truth for the help system, the web export and the docs; `progression.yaml` and `courses/` are validated by `make validate-contracts` (a Python mirror of the rule heads, parity-tested against `core/rules.js`).

## Fleet context

Member of the bamr87 fleet: a submodule of [bamr87/bamr87](https://github.com/bamr87/bamr87) (registry `_data/projects.yml`, standards in its `specs/`). Commit and push here first; the hub bumps its pointer afterwards. The loops that act on this repo: the hub's shared `standard-ci.yml` gate (the `standard` job in `ci.yml`), the hub's fleet-pulse doctor and issue pipeline (draft PRs and issues, never merges), the `markdown-oneline` prose kit, and this repo's own `claude.yml` (`@claude` mentions) and weekly `blank-slate-audit.yml` playtest.

## Standard deviations

none
