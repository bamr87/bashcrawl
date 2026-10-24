# AGENTS.md

Filesystem dungeon (`entrance/`) + browser trainer (`web/`: a React + Vite app in `web/src/` over the classic-script engine in `web/assets/js/`) generated from the same content. Python/Node are tooling only; the bash game has no runtime deps. Longer notes: `CLAUDE.md`, `.github/instructions/`, `docs/contributing.md`.

## Where to edit

| Change | Edit here | Do not edit |
|---|---|---|
| Rooms, scrolls, encounters | `entrance/` + `src/help/data/*.yaml` | `web/data/*.json`, `docs/generated/` |
| Courses and lessons | `courses/<id>/` (`course.md`, `NN-lesson.md`, `lab/`) — see `docs/authoring-courses.md` | `web/data/courses.json` |
| Badges, ranks, bestiary, arena trials, skills, review cards | `src/help/data/progression.yaml` (badges are TermForge rules) | JS literals — they are data now |
| Emulator kernel + platform services | `termforge/core/` (dual-mode UMD+CJS, brand-neutral) | `web/assets/js/vendor/termforge/` |
| Game features (arena, daily, …) | `web/assets/js/plugins/<id>.js` + `GAME_PLUGINS` in `runtime.js` + a `<script>` in `web/index.html` | a second copy of a command |
| Game commands / presenter models / arcade games | `web/assets/js/runtime.js` (the manifest), `hud.js` (models both renderers read), `arcade.js` (`GAMES`), `vim.js` (the Vim Catacombs' editor) | reimplement commands in arcade games; turn an engine file into an ES module |
| Web UI (screens, HUD panes, effects, sound) | `web/src/` — React + TypeScript; tokens in `web/src/styles/tokens.css`, reactions in `web/src/fx/effects.ts`, sounds in `web/src/audio/sfx.ts` | colour literals or `z-index` numbers outside `tokens.css`; touching the log's children (a DomSink paints it) |
| Launcher | `bin/bashcrawl` (bash 3.2-compatible, shellcheck-clean) | |
| TermForge apps | `termforge/apps/registry.js` (one entry per app) | if-chains in the hosts |
| Playtest harness | `src/playtest/` | |

`web/data/*.json` and the vendor mirror are **committed** projections. After content or `termforge/core/` changes: `make web-build` and commit the result. `make web-test` fails CI if they are stale.

New `termforge/core/*.js` files must keep the dual-mode wrapper (`core/` cannot import `node:*` or the DOM) and be listed in `web/index.html` **before** `runtime.js`.

## Commands

`Makefile` is canonical (`BASHCRAWL_ROOT`, `PYTHONPATH=src:test`). `make help` lists targets.

```bash
make setup                 # chmod encounters
make validate-contracts    # YAML ↔ filesystem ↔ walkthrough ↔ runtime handlers
make web-install           # npm install for the web app (node >= 22.22; no lockfile)
make web-build             # export JSON + bundle motion + vendor TermForge (python only)
make web-dev               # Vite dev server, http://127.0.0.1:5173
make web-bundle            # web-build + vite build -> web/dist
make web-test              # web-build + bundle/handler parity + eslint + vitest + vite build
make test                  # pytest unit + integration (cds into test/)
make test-js               # node --test termforge/test/*.test.js
make lint                  # shellcheck + yamllint + markdownlint + ruff
make lint-js               # node --check on every tracked *.js
make doctor                # bin/bashcrawl doctor — one [ OK ]/[WARN]/[CRIT] line per check
make clean                 # bash lib/reset.sh — not git checkout
```

Single pytest (ini lives in `test/`, not the repo root):

```bash
cd test
export PYTHONPATH="$PWD/../src:$PWD" BASHCRAWL_ROOT="$PWD/.."
python3 -m pytest unit/test_static_web.py -v
```

CI gate (`ci.yml`): `make lint` + `make lint-js`, then `make validate-contracts` + `make test` + `make test-js`, plus a macOS `/bin/bash` 3.2 smoke. No `npm install` — `package.json` has zero runtime deps; Node ≥ 20.16 only for `test-js` / tty hosts.

`make playtest` needs the `claude` CLI + `CLAUDE_CODE_OAUTH_TOKEN`; without them the script skips.
`make playtest-grok` uses OpenCode SuperGrok OAuth (`~/.local/share/opencode/auth.json`), refreshing against `auth.x.ai`. Console `XAI_API_KEY` is fallback only. `python3 -m playtest.xai_auth status|login` to inspect or device-login.

Agent sandbox (throwaway copy of the dungeon):

```bash
make agent-sandbox                 # context HUD; type commands like a player
make agent-sandbox ARGS="--json"   # one JSON object per turn on stdout
make agent-sandbox ARGS="--pty"    # raw bash, as a human would play
PYTHONPATH=src python3 -m playtest.mcp_server   # MCP: start/observe/command/state/stop
```

MCP `bashcrawl_state` returns room listing, scroll, inventory, and HP. `bashcrawl_start context=true` attaches a compact HUD to every command reply. Blank-slate playtests omit both and learn from the screen only.

## Game content

The filesystem **is** the game. Hidden areas ship as dotted dirs (`entrance/.chapel/`, `.vault/`, `.scrap/`, `.rift/`) and are unlocked with `mv`. Visible names (`entrance/chapel/` …) and `entrance/workshop/` are gitignored player state.

- Reset with `bash lib/reset.sh --dry` then `bash lib/reset.sh`. Never `git checkout -- entrance/`.
- Game executables: `#!/usr/bin/env bash`, 14-line "wandered out of bounds" header, no `set -euo pipefail`, plain-text heredocs (no ANSI), **never mutate git-tracked files**. State is `$I` / `$HP` and untracked flags (`touch .statue_defeated`).
- Infra scripts (`setup.sh`, `help.sh`, `lib/*.sh`) **do** use `set -euo pipefail` — except `lib/playrc.sh`, the rcfile of `bashcrawl play`: it is sourced into the player's interactive shell, where strict mode would break the game.
- macOS bash 3.2: `sed -i.bak`, no GNU-only flags. CI smokes `/bin/bash`.
- New encounter **basename** must be added to `ENCOUNTERS` in `setup.sh` or `./setup.sh` will not `chmod +x` it.
- New room: directory + depth-graded `scroll` + chmod'd encounters + unlock `mv` in a treasure + `src/help/data/*.yaml` + `test/datasets/walkthrough.json` + `lib/reset.sh` if it can be unlocked. Then `make validate-contracts && make web-test`.
- Scroll grades: entrance = pure ASCII / 80 cols / `===` dividers; cellar/armoury = Unicode OK; hidden areas = markdown OK. Details: `.github/instructions/scrolls.instructions.md` and `rooms.instructions.md`.

## Learning platform gotchas

- Every objective needs a `solution`; `termforge/test/courses.test.js` replays them from a fresh lab and fails if a lesson is unwinnable or already complete when it starts.
- Course and lab files are tracked content: check `git check-ignore` (`*.tmp` is ignored repo-wide), and keep Markdown one paragraph per line (`python3 tools/unwrap-prose.py --check`).
- `learn`/`mastery` save slices are owned by their plugins, which sanitize them on load — never trust their shape elsewhere.
- Install order is hook order: curriculum, then the game plugins in `GAME_PLUGINS` order, then mastery and explain.
- A fresh-clone run of the gate (`git clone . /tmp/x && cd /tmp/x && make validate-contracts web-test test test-js`) is what CI sees.

## Web / TermForge gotchas

- `this.handlers = { … }` in `runtime.js` must stay **one static literal**, one `key: ref,` per line, bare refs only, exactly one `this.handlers = {` in the file. `demo: true` entries in `src/help/data/runtime_commands.yaml` must appear there.
- Mini-games are (seed world + goal + score) over a scoped bare `Runtime`. Do not fork command behavior.
- Goldens: regenerate only with `node termforge/test/tools/record-goldens.js --update`. A fixture diff is a claimed behavior change. `termforge/test/fixtures/save/save-v1-legacy.json` is write-once.
- Do not rename or drop keys on the story save (`bashcrawl-web-state-v1`); `termforge/test/game-save.test.js` locks the shape.
- `make generate-contract-docs` writes `docs/generated/` — do not hand-edit those files.

## Claude Code notes

Moved verbatim from the former `CLAUDE.md` on 2026-10-20 (decision D4: one canonical agent file). Fold these into the sections above when you next touch them.


This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bashcrawl (v3.2) is an educational text-based adventure game that teaches POSIX terminal commands through fantasy dungeon-crawl gameplay. The core game is **the filesystem itself**: directories are rooms, files named `scroll` are educational content, and executable scripts (`treasure`, `potion`, `spell`, `statue`, `ghost`, `monster`, `goblet`) are interactive encounters.

The repo has **two player surfaces, one harness, one embedded framework, and a learning platform on top** (the layer map and how it aligns with bashOS/chui: `docs/PLATFORM.md`):

- **Terminal-core** (`entrance/`, `help.sh` + `src/help/`, minimal `lib/`) — pure POSIX shell,
  no dependencies, no launcher. Played with real `cd`/`ls`/`cat`: `cd entrance && cat scroll`.
- **Web trainer** (`web/`) — a **React 19 + Vite + TypeScript** app (`web/src/`, strict, Tailwind 4 over `--fleet-*` tokens, a 16-bit dungeon-RPG skin) over the same classic-script **engine**: `web/index.html` loads the vendored TermForge core, `runtime.js`, the plugins and the presenters as classic `<script>` tags in a fixed order, then the app module (`src/main.tsx`). Four doors: **Learn** (a lesson reader beside the same story terminal — `web/src/learn/`), **Story** (the dungeon on the in-browser bash emulator with the HUD, a particle/shake/flash effects layer and synthesized SFX — `web/src/hud/`, `web/src/fx/`, `web/src/audio/`), **Practice Arcade** (five mini-games — four on scoped runtimes, the **Vim Catacombs** on a vim buffer — `web/src/arcade/` over `BashcrawlArcade.GAMES`), and **Reference** (searchable cheatsheets). Content is generated by `scripts/export_static_web.py`; `npm run build` compiles the app into `web/dist/` (gitignored) with the engine and data copied beside the bundle, and `pages.yml` deploys that. Node ≥ 22.22 for the web toolchain (vitest/jsdom); the engine's own suites still run on Node 20.
- **Playtest harness** (`src/playtest/`) — a lean MCP server that lets an AI agent play the
*real* bash game in a sandboxed PTY session (`bashcrawl_start/observe/command/report_gap`), with a JSONL recorder and scorer for content-gap audits. Python 3.10+, deps: `pyyaml` + `mcp`.
- **TermForge** (`termforge/`) — the universal terminal framework extracted from the web
emulator (v3.2): an environment-agnostic kernel (parser, VFS with providers, Shell + hook spine, Line protocol, TerminalView + DOM/ANSI sinks) as dual-mode files (classic script and CJS, zero deps, no build step), plus node hosts (`host-tty.js`, `host-telnet.js`) and apps (`bashcrawl.js`, `procwatch/`). Docs: `docs/termforge/architecture.md`, `docs/termforge/authoring-apps.md`, `docs/termforge/telnet-host.md`, `docs/schemas/terminal-protocol.v1.md`. Core is vendored into `web/assets/js/vendor/termforge/` by `make web-build` — **edit `termforge/core/`, never the vendor mirror** (byte-verified by `make web-test`).
- **Learning platform** — `courses/<id>/*.md` (Markdown + YAML frontmatter, one lesson per file; objectives are TermForge rules) compiled to `web/data/courses.json`, served on every surface by three brand-neutral TermForge plugins: `core/curriculum.js` (`learn`/`lesson`/`lab`), `core/mastery.js` (`skills`/`review` — skill map + Leitner spaced review), `core/explain.js` (`explain` — offline command-line breakdown). Authoring: `docs/authoring-courses.md`.
- **Launcher** — `bin/bashcrawl` (plain bash, 3.2-compatible): one dispatch table for `play`/`tty`/`serve`/`hub`/`web`/`courses`/`lab`/`doctor`/`reset`. It is optional — the classic game still needs no launcher.

The removed Textual TUI, Flask viewer, and Docker tooling live only in git history (pre-3.1).

## Commands

The `Makefile` is the canonical task runner (exports `BASHCRAWL_ROOT` and `PYTHONPATH=src:test`).

```bash
make setup             # chmod encounters + print how to start
make web-install       # npm install (always-latest ranges, no lockfile; node >= 22.22)
make web-build         # export entrance/ + YAML registries -> web/data/*.json; bundle motion/*.asciimtn; vendor the core
make motion CLIP=...   # preview an ASCII Motion file in the terminal (make motion-info: summarize all)
make web-dev           # Vite dev server with hot reload at http://127.0.0.1:5173
make web-bundle        # web-build + npm run build -> web/dist (what Pages deploys)
make web-preview       # serve the production build at http://127.0.0.1:4173
make web-test          # web-build + validate bundle + runtime-command parity + eslint + vitest + vite build
make validate-contracts# registries <-> filesystem <-> runtime parity
make generate-contract-docs
make test              # unit + integration (pytest)
make test-unit / test-integration
make test-js           # TermForge framework tests (node --test, zero deps)
make test-mcp          # playtest-harness smoke tests in a local .venv
                       # (make test also drives host-tty.js on a real PTY: test/integration/test_tty_host.py)
make playtest          # blank-slate agent playtest (needs claude CLI + OAuth token)
make lint              # shellcheck + yamllint + markdownlint + ruff
make lint-js           # node --check over every tracked JS file
make tty-demo          # play bashcrawl in this terminal (full-screen HUD; ARGS="--no-hud" for the classic stream)
make telnet-demo       # serve bashcrawl at telnet://127.0.0.1:2323 (ARGS="--raw" for nc)
make telnet-hub        # same, as a shared hub (MUD mode): who/say/emote/shout/name/top
make doctor            # bin/bashcrawl doctor: [ OK ]/[WARN]/[CRIT] per check, exit 0/1/2
make agentwatch        # AI-agent task dashboard (ARGS="--data-dir logs/sessions" for real logs)
make clean             # bash lib/reset.sh — reset game state
```

### Running a single test

Tests run from `test/` (where `pytest.ini` lives). Markers: `unit`, `integration`, `slow`, `bash`.

```bash
cd test
export PYTHONPATH="$PWD/../src:$PWD"
export BASHCRAWL_ROOT="$PWD/.."
python3 -m pytest unit/test_static_web.py -v
python3 -m pytest integration/test_mcp_server.py -v    # playtest harness smoke
```

### Playing / inspecting the game directly

```bash
cd entrance && cat scroll          # the game — that's it
bash help.sh                       # contextual help; also: help.sh commands | map
bash lib/reset.sh --dry            # preview a game-state reset (always dry-run first)
bin/bashcrawl courses              # the course catalogue; bin/bashcrawl lab ID copies a lab to ~/.bashcrawl/labs/ID
PYTHONPATH=src python3 -m playtest.mcp_server   # MCP playtest server (agents)
PYTHONPATH=src python3 -m playtest.agent        # direct sandbox HUD; --json / --pty / --blind
```

## Architecture

### Directory-as-Room map

Main path: `entrance/` → `cellar/` → `armoury/` → `chamber/`.

Hidden areas (all rooted under `entrance/`) are unlocked by collecting treasures, which `mv` a dotted directory to its visible name:
- `.chapel/` → `graveyard/`, `courtyard/{aviary,hall,library}/` — `grep`, `find`, pipes
- `.vault/` → `stronghold/{nursery,lab}/` — variables, env, process substitution
- `.scrap/` — a **directory** (not a file) whose scroll teaches `ln -s`
- `.rift/` → `arena/pit/`, `spire/mezzanine/` — advanced scripting, checksums
- `entrance/workshop/` — does not exist until the player runs `mkdir` (player-created room)

### Key components

| Component | Purpose |
|-----------|---------|
| `entrance/.functions` | Defines `gameover()` and `help()`; each encounter script sources it itself. |
| `help.sh` | Root shim that `exec`s `src/help.sh` (sources `src/help/bashcrawl_help.sh`). |
| `src/help/` | Bash help engine; YAML **content registries** in `src/help/data/`. |
| `lib/` | Minimal shared shell libs: `colors.sh`, `log.sh` (JSONL), `yaml_reader.sh`, `reset.sh`. |
| `setup.sh` | chmods encounter scripts (`--quick` for tooling/tests). |
| `termforge/core/` | The TermForge kernel (source of truth): `parser`, `vfs` (+ read-only providers), `shell` (hook spine, injectable clock/rng, owns an `EventBus`, `use(plugin)`), `packs/{posix,flavour}`, `protocol`, `view`, `sinks/{dom,ansi}`, `input`, `ascii-motion` (plays every ASCII Motion format incl. session v2, editor effects, `Library`), `art` (**generated** from `termforge/motion/*.asciimtn` by `scripts/build_motion.py`). Platform services: `events` (typed bus), `rules` (declarative predicates), `plugin` (`shell.use`), and the learning plugins `curriculum`, `mastery`, `explain`. Dual-mode files, vendored to `web/assets/js/vendor/termforge/`. Schemas: `docs/schemas/{events,rules,plugin}.v1.md`. |
| `termforge/node/` | Node hosts: `host-tty.js` (full-screen HUD via the `session.hud()` contract, or classic stream with `--no-hud`/piped stdio; damage events jolt the frame), `tui.js` (TuiScreen: app-agnostic ANSI compositor — sidebar panels, toast row, input row, host-driven jolt offset), `pixels.js` (PixelBuffer + PixelScreen: a cols×(2·rows) truecolor framebuffer painted with half-block cells, pixel font, row-diffed output), `gem.js` (the hidden gem: DAEMON STORM, a pixel shooter — `xyzzy`/`plugh`/Konami in HUD mode; fixed 50 ms tick, seeded RNG, `BASHCRAWL_GEM_SEED` pins a run; zero deps), `host-telnet.js` + `telnet-codec.js` (RFC 854 subset), `index.js` (framework namespace for require()). |
| `termforge/apps/` | `registry.js` (the app registry: `--app ID` resolves here, `--app list` prints it), `bashcrawl.js` (the game as an App descriptor for the hosts), `procwatch/` (custom-tool reference: live metrics as provider files), `agentwatch/` (AI-agent task dashboard: TaskSource → board/feed + live files; JSONL adapter for `logs/sessions/`). |
| `termforge/node/hub.js` | The telnet hub (`host-telnet.js --hub`): presence, room/global chat, leaderboard, event announcements; sanitizes control/escape characters and rate-limits. Opt-in — the default server stays isolated. |
| `web/assets/js/plugins/` | The game's features as TermForge plugins (`achievements`, `daily`, `progress`, `arena`, `pathfind`, `bestiary`), installed by `runtime.js` in `GAME_PLUGINS` order (postExecute order matters: achievements → daily → rank-up). Catalogs come from `src/help/data/progression.yaml`. |
| `courses/` | Courses: `course.md` + `NN-lesson.md` (frontmatter objectives with a `solution` each) + `lab/` files seeded at `/lab/<id>/`. Compiled by `scripts/course_loader.py`. |
| `bin/bashcrawl` | The optional launcher / dispatch table (bash 3.2-compatible, shellcheck-clean); `doctor` follows bashOS's `bin/os-health` verdict format. |
| `termforge/test/` | `node --test` suites incl. golden transcripts (pixel-identity contract; regenerate only via `record-goldens.js --update`) and the telnet loopback integration. |
| `web/assets/js/runtime.js` | The **bashcrawl game assembly** over TermForge: `class Runtime extends TermForge.Shell`, the full 74-entry `this.handlers` literal (the `validate_runtime_commands.py` regex contract — one `key: ref,` per line, bare references only), and `installGameHooks()` (quests/achievements/daily/trainer/pathfind/encounters). |
| `web/assets/js/hud.js` | The **shared HUD presenter** (one engine, two renderers): status strip, next-step suggestions, side quests, fog-of-war map model, HP/XP, room/quest/hero/lesson/skills models, `diffEvents()` and the layout store — consumed by the React HUD (`web/src/hud/`) and the TTY host (`tui.js` panels). Loaded like runtime.js: classic script in the browser, require()'d by `termforge/apps/bashcrawl.js`. |
| `web/assets/js/fx.js` | The **command FX catalog** (`BashcrawlCommandFx`): parses a line into `{cmd, flags, motion, accent, piped, redirect}`, stamps `data-fx-*` on the stage and plays the ASCII Motion stage clips for those motions (manifest from `motion.yaml` via `fx-clips.js`). Required by the TTY/telnet hosts (`termforge/apps/bashcrawl-motion.js`); the React effects layer calls `apply()` per command. |
| `motion/` | **All art is ASCII Motion files** (`.asciimtn`, editable at ascii-motion.app): `clips/` (command-stage animations), `art/` (banner, encounter portraits, room vignettes — multi-frame ambient loops — arena/levelup/profile/pathfind, the landing logo reveal). Registered in `src/help/data/motion.yaml`; `scripts/build_motion.py` (in `make web-build`) bundles them into `web/assets/js/{fx-clips,art-clips}.js` + `termforge/core/art.js`. Code draws art only via `Shell#art(name)` / `<ArtClip name>` — never string literals (`termforge/test/art.test.js` scans `web/src` too). Workflow: `docs/termforge/ascii-motion.md`. |
| `web/assets/js/learn.js` | The lesson **Markdown renderer** (`BashcrawlLearn.renderMarkdown`/`inlineHtml`): the subset courses use, escaped, with click-to-fill code. The reader over it is React (`web/src/learn/LessonReader.tsx`). |
| `web/assets/js/ambient.js` | **Ambient ASCII Motion** (`BashcrawlAmbient`): plays `.asciimtn` clips in a node — room vignettes loop, the landing logo reveals once. Visibility-aware, stops when the node is detached, paints the resting frame under `prefers-reduced-motion`; cells in the clip's default colour (`#ffffff`) inherit the CSS colour. Wrapped by `web/src/fx/useAmbientClip.ts` and `ArtClip.tsx`. |
| `web/assets/js/arcade.js` | The arcade's **games** (`BashcrawlArcade.GAMES`: Path Navigator, grep/find Hunt, Pipe Puzzle, Command Flash — seed world + goal predicate + scoring over a scoped bare Runtime — and the **Vim Catacombs**, whose world is a vim buffer) plus `CHEAT_LINES`, `BLOCKED_IN_GAME`, `scopedRuntime`. The flow (start/hint/quit/finish/records) is `web/src/arcade/arcade-store.ts`. |
| `web/assets/js/vim.js` | **`BashcrawlVim`**, the modal editor behind the Vim Catacombs: a deterministic vim engine (normal-mode motions, counts, operators `d`/`y`/`c`, a register, `u`, `f`/`t`/`;`/`,`, literal `/` search with wrap, insert mode) fed one key at a time, with an `allowed` set — the level's spellbook — it refuses early. Knows nothing of gems or levels: `arcade.js` reads the buffer after each command (`*` gem taken on landing, `!` spike costs a heart, `target` an exact buffer, won only from normal mode). Levels are `arcade.yaml` `vim_levels` (keys cumulative in file order; each carries a `solution` in vim notation — `<esc>`, `<cr>`, a `/text` run — that `termforge/test/arcade-vim.test.js` plays and must win at exactly `par`). Keys reach it through `InputTarget.keystroke` (the `PromptBar` offers every plain key to the owner first; `:` and `/` are left to the prompt in normal mode); the buffer is drawn by `web/src/arcade/VimStage.tsx` above the trial log. Dual-mode like `hud.js`. |
| `web/src/app/` | **The React shell**: `App.tsx` (providers, route → screen, app-wide keys, boot), `AppShell.tsx` (skip link, header with mode tabs and settings, one `<main id="main-content">`, the `#stage` shake wrapper, footer), `useHashRoute.ts` (`#/story` … `#/reference`, NotFound), `modes.ts`. |
| `web/src/engine/` | **The engine bridge**: `types.ts` (typed surface of the globals), `index.ts` (`requireEngine()`), `game-store.ts` (owns the Runtime, TerminalView + DomSink, SessionController, save/restore/reset, presenter models memoised per version, `useSyncExternalStore`; one instance per page, registered on `globalThis` so HMR never splits it), `fx-bus.ts` (what a command changed, published once), `data.ts`. |
| `web/src/terminal/` | The one shared prompt (`PromptBar`: Enter/↑↓/Tab/Ctrl+L/?/Ctrl+/), `TerminalLog` (a `<pre>` the engine's DomSink paints; React never touches its children — a click on a `data-fill` command types it), **the reader layer** (`prose.ts`: a per-line classifier for what a file viewer printed; `log-decor.ts`: the DOM pass after each paint — command echoes, prose, `code` chips in runtime hints, the `.rv`/`--i` cascade, and placement, which opens a block taller than the log at its title), `ScrollCue` ("▼ more"), `SuggestionChips` (fill, never run), `InlineHint`, the `Pager` for `less` (formatted by the same classifier), `actions.ts` (run/fill/goto/try — every chip goes through here), `prompt-store.ts`. |
| `web/src/hero/` | **The hero**: `hero-store.ts` (name, path, appearance, tour taken — `bashcrawl-web-hero-v1`, kept apart from the engine's save; `whoami` knows nothing of it), `roles.ts` (the four paths), `appearance.ts` (the wardrobe catalogue — skin, eyes, hair style/colour, headgear, outfit, dye, trim, weapon, cape, companion — role presets, a random roll, the sanitiser, and `paletteStyle()` which hands the picks to CSS as `--hero-*` token references), `sprite.ts` (the 16×28 pixel character: part bitmaps of colour *slots* composed in layer order into runs; the bitmaps are template literals and `art.test.js` exempts them like `gem.js`), `HeroSprite.tsx` (one `<g>` per layer, one `<rect>` per run; `crop="bust"` for the header), `HeroFigure.tsx`, `AppearanceEditor.tsx` (the wardrobe UI), `CreateHero.tsx` (the five-step wizard — a path dresses the hero in its preset until the wardrobe is touched), `ProfileDialog.tsx` (rename, wardrobe, path, the sheet, a confirmed new game through `GameStore.newRun()`), `HeroButton.tsx`. The hero's colours are art tokens (`--bc-hero-*` in `tokens.css`, the same in both themes); shades are derived in `hud.css` with `color-mix`. |
| `web/src/chrome/` | The shell's chrome and **the game's own screens**: `TitleScreen` (Continue · New game/New hero · How to play · Options; ↑↓/Enter/Esc, a menu cursor), `Intro` (three overview pages, seen once — `prefs.introSeen`), `Tour` (coach marks over the live page; a stop whose target has no size is skipped; the last one types `pwd`), `OptionsDialog` + `SettingsForm` (theme, sound, effects, shake, text speed/size, CRT), `settings-store.ts` (`bashcrawl-web-settings-v1`, applied as `data-*` on `<html>`), `GameMenu` (the pause menu: Escape with nothing open, `Alt+M`, `menu`), `Tooltips` (one tooltip layer for every `title=` — the title moves to `data-tip` + `aria-description` on first hover, so write tooltips as `title` and nothing else), `ui-store.ts` (which overlay is up, the tour step, `isIdle()`), the docs drawer, toasts, shortcuts help, the error boundary. |
| `web/src/story/` | **The chronicle**: `chronicle.ts` (the story — a prologue, a chapter per main quest, one per hidden hall, an epilogue — authored with `{name}`/`{path}` and rendered for the hero when shown), `journal-store.ts` (chapters unlocked, scrolls read with the command that re-opens them, halls found, ranks — `bashcrawl-web-journal-v1`, unread count), `story.ts` (`installStory()` on the FX bus: a quest completed → its chapter, a hall discovered → its chapter and a note, a `cat` → a lore entry, the main road walked → the epilogue; `unlockChapter()` is also what creation calls for the prologue), `dialogue-store.ts` + `StoryDialogue.tsx` (the RPG dialogue box under the log: typewriter at the text-speed option, Enter/click turns the page, waits while an overlay or the tour is up), `QuestTracker.tsx` (the objective in the stage's corner), `Journal.tsx` (Chronicle · Quests · Lore · Bestiary · Badges; `Alt+J`, `journal`, the header). The engine knows none of this: its quests and rooms are the triggers, the narration is the web's. |
| `web/src/hud/` | The 16-bit HUD over `BashcrawlHud`: `StatusStrip` (rank → next rank, HP, quests, badges, streak), `PanelFrame`, `Gauge`, `RollingNumber`, the eight panes, `HudMenu` (show/hide/reorder/dock, saved under `bashcrawl-hud-layout-v1`), `Sidebar` (an overlay under 900px). |
| `web/src/fx/` | **The effects layer**: `effects.ts` is the one event → effect table (canvas bursts, shake, flash, pane pulses, hero mood, SFX per `Hud.diffEvents` type); `fx-engine.ts` + `particles.ts` (typed-array pool on one fixed canvas, room wipes, idle loop stops, hidden-tab pause), `shake.ts` (trauma model on `#stage`), `flash-store.ts`/`ScreenFlash.tsx`, `anchors.ts` (`data-fx-anchor` targets), `bump.ts`, `hero-mood.ts`, `useAmbientClip.ts`, `ArtClip.tsx`, and the **title cards** (`banner-store.ts`, `Banners.tsx`: first entry to a room, a quest cleared, a rank, a passage, a lesson — queued one at a time). All gated on `prefers-reduced-motion` and the Effects option. |
| `web/src/audio/` | Web Audio chiptune SFX, no files: `synth.ts` (tone/arp, gesture unlock), `sfx.ts` (a phrase per event), `sound-store.ts` (off by default, `bashcrawl-web-sound-v1`). |
| `web/src/styles/` | `tokens.css` — **the only file with colour literals** (`--fleet-*` roles, dark/light/auto via `data-theme` + `data-resolved`, layer and motion scales, reduced-motion collapse; `theme.test.ts` enforces it), `app.css` (Tailwind 4 `@theme inline` map, base, shell chrome), `terminal.css`, `hud.css`, `fx.css`, `learn.css`, `arcade.css`, `chrome.css`. |
| `web/src/test/` | `setup.ts` (jest-dom, cleanup, jsdom polyfills) and `engine.ts`, which evaluates the real engine files — the same list as `termforge/test/helpers/game-harness.js` — into jsdom's window so component tests play the actual game. |
| `src/playtest/` | `bash_session.py` (PTY bash REPL + sentinel prompt), `sandbox.py`, `recorder.py`, `harness.py`, `mcp_server.py`, `scorer.py`. |
| `scripts/` | `export_static_web.py`, `vendor_termforge.py`, `validate_*`, `generate_*`, `playtest.sh`, `lint.sh`, `run_tests.sh`. |

### Game encounter files

All game executables share a structure: `#!/usr/bin/env bash` shebang, the 14-line "wandered out of bounds" boilerplate comment, game-state checks (grep inventory / test `$HP`), story output via `cat << EOF` heredocs (plain text, no ANSI), then instructions telling the **player** to run `export`/`mv` commands. Game executables must **NEVER mutate git-tracked files** and do not use strict mode.

State is held entirely in environment variables and untracked flag files:
```bash
export I=amulet,$I              # Inventory: comma-separated env var
grep --quiet amulet <<< "$I"    # Check for an item
export HP=15                    # Health (set by potions)
let "HP=HP-5"                   # Combat damage
touch .statue_defeated          # Non-destructive "defeated" flag, checked on re-entry
mv ../../.chapel ../../chapel   # Unlock a hidden room (target may be 2+ levels up)
```

## Conventions

### Shell scripts
- All executables use `#!/usr/bin/env bash`.
- **Infrastructure** scripts (`setup.sh`, `help.sh`, `lib/*.sh`) use `set -euo pipefail`,
  shared color constants from `lib/colors.sh`, structured logging via `lib/log.sh`.
- `lib/playrc.sh` is the one exception: it is the rcfile `bashcrawl play` sources into the player's interactive shell, where strict mode would break the game itself.
- **Game executables** use no strict mode, emit plain text, never modify tracked files.
- macOS compatibility: use `sed -i.bak` (not bare `sed -i`); auto-detect `ls` color flags.
- `.shellcheckrc` disables a number of checks; the lint job shellchecks all `*.sh` plus
  executable game files under `entrance/` (severity=error for the latter).

### Scroll content (depth-graded — see `.github/instructions/scrolls.instructions.md`)
- **Level 1** (`entrance`): pure ASCII, `===` dividers, 80-char width, no Unicode/ANSI.
- **Level 2** (`cellar`/`armoury`): Unicode box-drawing and emojis OK, `####` headers.
- **Level 3** (hidden areas): Markdown features allowed.

### Adding a new room
1. Create the directory under the appropriate parent; add a depth-appropriate `scroll`;
   add executable encounters (`chmod +x`); wire the unlock in a prerequisite `treasure`.
2. Update `src/help/data/rooms.yaml` (+ `encounters.yaml` etc.).
3. `make validate-contracts && make web-build` — the web app must pick the room up.
   See `.github/instructions/rooms.instructions.md`.

### Web: engine vs app
- **The engine stays classic.** `web/assets/js/**` (the vendored core, `runtime.js`, `plugins/`, `hud.js`, `storage.js`, `fx.js`, `fx-clips.js`, `art-clips.js`, `ambient.js`, `learn.js`, `vim.js`, `arcade.js`) are classic/CJS scripts shared with the node hosts and the node test harness; they are not compiled by Vite and must not become ES modules. `web/index.html` loads them in a fixed order: the 22 vendored TermForge core files (`protocol → parser → state → vfs → hooks → registry → events → rules → plugin → curriculum → mastery → explain → shell → packs/posix → packs/flavour → view → sinks/dom → sinks/ansi → input → session → ascii-motion → art`), then `storage → art-clips → plugins/{achievements,daily,progress,arena,pathfind,bestiary} → runtime → hud → learn → fx-clips → fx → ambient → vim → arcade`, with `vite-ignore` on each tag, then `<script type="module" src="./src/main.tsx">`. `validate_static_web.py` enforces the order (and the same in `web/dist/index.html` when built); `vite.config.mts`'s `copyEngine` ships `web/assets/js` and `web/data` into `web/dist` verbatim. The root `package.json` must **never** declare `"type": "module"`.
- **The app is React** (`web/src/`, TypeScript strict, `npm run lint` is ESLint flat with the react-hooks compiler rules). State outside React lives in small external stores (`web/src/lib/store.ts`, `useSyncExternalStore`); the game store publishes a version per command and components read presenter models from `BashcrawlHud` through `useModel(name)`. New game features are still plugins (`web/assets/js/plugins/`, registered in `GAME_PLUGINS`, loaded by `index.html`); new UI is a component under `web/src/` — a HUD pane goes in `web/src/hud/` + `Sidebar.tsx`, a new reaction in `web/src/fx/effects.ts`, a new sound in `web/src/audio/sfx.ts`.
- **Design values live in `web/src/styles/tokens.css` only** (`--fleet-*` roles; `theme.test.ts` fails on a colour literal or a numeric `z-index` anywhere else under `web/src`, canvas code included — read a colour with `colorOf(role)`). Tailwind utilities name the role (`bg-panel`, `text-gold`); the pixel chrome is the `.bc-frame`/`.bc-btn`/`.bc-chip` primitives. Everything that moves is inside `prefers-reduced-motion: no-preference` or gated in JS.
- **The reader layer** (`web/src/terminal/prose.ts` + `log-decor.ts`) runs after every paint. It classifies what a file viewer printed by the scrolls' own plain-text conventions (`===`/`####` rules and the title between them, `#  TITLE  #` frames, CAPS labels, `$ cmd  # comment`, command/purpose tables, box panels, `*atmosphere*`, `**emphasis**`, `` `code` ``, Markdown in the READMEs, a script mode for `cat treasure`) and never rewrites the text: markers stay in the DOM inside `.sc-mark` (hidden by CSS except in box tables), so `prose.test.ts` round-trips every scroll byte for byte. Fresh lines cascade in (`.rv`/`--i`; the step is the text-speed option) and a block taller than the log opens at its title. Keep the scrolls terminal-readable — teach the classifier a convention rather than converting content to Markdown for the web's sake.
- **First run**: no hero (`bashcrawl-web-hero-v1`) means the title screen → `CreateHero` → `Intro` (once) → the hero's door → `Tour` (until `hero.tourDone`) → the prologue in the dialogue box. The brand button reopens the title; the portrait in the party bar, `?`, 📖 and ⚙ open the profile, the shortcuts, the journal and Options; Escape with nothing open is the pause menu. The hero, the options and the journal are app state only; the engine's save is untouched by them, and `GameStore.newRun()` (+ `resetJournal()`) is the one way to start over.
- **The prompt answers some words with screens**: `journal`, `menu`/`pause`, `hero`/`wardrobe`, `options`/`settings`, `title` never reach the engine — `GameStore.intercept()` echoes a dim line and opens the overlay (`InputTarget.intercept`). Add a word there, not a handler in `runtime.js`. Hotkeys: `Alt+J/H/O/M`; they live in `App.tsx` and `chrome/shortcuts.ts` together.
- **Screens slide, nothing snaps**: `App.tsx` keys the screen on the route and the mode event runs the pixel wipe over the stage; panels fold through a grid track (`.bc-panel-fold`, the body goes `inert` + `aria-hidden`, never `hidden`); the status strip and dock enter with a slide. A new surface should get the same treatment — and never `AnimatePresence mode="wait"`.
- A mini-game = *(seed world + goal predicate + scoring)* over a scoped bare `Runtime` (`BashcrawlArcade.GAMES` in `arcade.js`) —
  never reimplement command behavior outside `termforge/core/` + `runtime.js`. The Vim Catacombs is the one trial whose world is not the shell: a `vim.js` buffer, `needsWorld: false`, keys through the store's `keystroke` hook, `:`/`/` lines through `execute()`; a new vim level is a `vim_levels` entry with a winning `solution`, never a change to the engine's semantics.
- Framework changes go in `termforge/core/` (then `make web-build` re-vendors); game-only
changes go in `runtime.js`. The `this.handlers = {…}` literal in `runtime.js` must stay a single static literal (validator regex contract).
- `localStorage` keys: story save `bashcrawl-web-state-v1`, arcade `bashcrawl-web-arcade-v1`,
shell prefs `bashcrawl-web-shell-v1` (last door, `onboarded`, `introSeen`), HUD layout `bashcrawl-hud-layout-v1`, theme `bashcrawl-web-theme` (`dark|light|auto`), CRT `bashcrawl-web-crt`, sound `bashcrawl-web-sound-v1`, hero `bashcrawl-web-hero-v1`, options `bashcrawl-web-settings-v1`, journal `bashcrawl-web-journal-v1` (additive keys; never break the story save — `termforge/test/game-save.test.js` locks the shape). The `learn` and `mastery` slices are owned (and sanitized on load) by the curriculum and mastery plugins.
- Tests: `npm run test:web` (vitest + Testing Library; `web/src/test/engine.ts` loads the real engine into jsdom) for the app, `make test-js` for the engine. Dialogs animate out with `AnimatePresence`, which never completes under jsdom — assert the store state, not the DOM's absence, and never use `mode="wait"` for a sequence of cards (the next one never mounts there); key an enter-only `motion.div` instead.

## Content Contracts

Game content is described by shared, version-controlled registries (`src/help/data/*.yaml`: `rooms.yaml`, `quests.yaml`, `commands.yaml`, `encounters.yaml`, `runtime_commands.yaml`, `tutorials.yaml`, `arcade.yaml`, `motion.yaml`, etc.). They are the single source of truth for the help system, the web export, and the docs. When changing game content or registries:
- `make validate-contracts` — registries vs. the real filesystem.
- `make web-test` — regenerates `web/data/*.json`, re-vendors `termforge/core/`,
validates the bundle (`test_static_web.py` fails CI if committed data or the vendor mirror is stale), then runs ESLint, vitest and the Vite build (needs `make web-install` once).
- `scripts/validate_runtime_commands.py` — every `runtime_commands.yaml` entry flagged
  `demo: true` must appear in the `this.handlers` literal in `web/assets/js/runtime.js`.
- `make test-js` — the TermForge suite; the golden transcripts are the emulator's
  behavior contract (a fixture diff is a claimed behavior change). `courses.test.js` plays every course from a fresh lab using only the authored `solution`s — every lesson must be winnable and none free. `arcade-vim.test.js` does the same for the Vim Catacombs: every level's `solution` wins at exactly `par`, steps on no spike, and clears nothing early; `vim.test.js` is the editor's own contract.
- `progression.yaml` (ranks, achievements as rules, bestiary, trials, skills, review cards) and `courses/` are validated by `make validate-contracts` (a Python mirror of the rule heads, parity-tested against `core/rules.js`).
- New files under `courses/`: check `git check-ignore` — `*.tmp` is ignored repo-wide. Markdown follows the one-paragraph-per-line rule (`tools/unwrap-prose.py --check`; CI pushes a fix otherwise).
- Regenerate docs with `make generate-contract-docs` (writes `docs/generated/*.md`).

## Integration Points

- **CI** (`.github/workflows/`, three workflows): `ci.yml` is the PR/push gate — `lint`
(shellcheck/yamllint/markdownlint/ruff via `scripts/lint.sh`, `make lint-js`, `npm run lint`), `test` (`make validate-contracts` + the full pytest suite via `make test` + the TermForge suite via `make test-js` + `make web-test`; node 24 via setup-node, `npm install` with no lockfile), and `macos-smoke` (real gameplay on stock macOS bash 3.2). `pages.yml` runs `make web-test` and deploys `web/dist` on main. `blank-slate-audit.yml` is the weekly agent playtest. The hub's `standard-ci.yml` also runs the root manifest's `lint`/`test`/`build`; `ci.yml` passes it `node-version: 24`, because its default Node 20 ships npm 10, whose engines-aware resolution of the always-latest ranges crashes before any script runs (`Cannot read properties of null (reading 'edgesOut')`, reproducible in `node:20`), and vitest stays `test:web` so that job's `npm test` is still the engine suite. Every CI check mirrors a local `make` target; content rules (shebangs/scrolls/unlocks) live in `validate_content_contracts.py`, not inline in workflows. Dependabot owns all dependency updates (`.github/dependabot.yml`).
- **MCP server**: `playtest.mcp_server`, configured in `.mcp.json` / `.cursor/mcp.json` with
  `PYTHONPATH=src`; smoke-tested via `make test-mcp`.
- **Logging**: JSONL session logs in `logs/sessions/` (playtest recorder + test log capture).
- **Docs**: human docs in `docs/`; generated docs in `docs/generated/` (do not hand-edit).

## Governance

Read [`docs/constitution.md`](docs/constitution.md) before changing anything: it is the highest-precedence rule set here and wins over this file when they disagree. It changes only through a numbered record in [`docs/amendments/`](docs/amendments/), ratified by the maintainer merging the PR; agents propose, never merge. Every user-facing feature has a stable id in [`features/features.yml`](features/features.yml) with `status`, location and the PRD requirement ids it serves; the PRD's "Feature catalog" block is generated from it (`python3 <bamr87/bamr87>/tools/governance_lint.py prd-sync . --write`; check with `… check .`). Never hand-edit that block or `CHANGELOG.md`.
