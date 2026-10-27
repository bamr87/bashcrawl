# The Bashcrawl Platform

> The platform's five layers, the learning loop, how its patterns align with bashOS and chui, how to extend it, and the contracts that keep it honest.

Bashcrawl is a terminal learning platform built in five layers. The classic game is still the filesystem itself (`cd entrance && cat scroll`). Around it sits a kernel that emulates a shell, a few platform services, a set of feature plugins, content kept as data, and five surfaces that all run the same thing:

- real bash
- the browser
- a full-screen terminal HUD
- a telnet server
- a shared telnet hub

The design borrows its patterns from the sibling repos [bashOS](https://github.com/bamr87/bashos) and [chui](https://github.com/bamr87/chui). The [alignment table](#alignment-with-bashos-and-chui) below maps each one.

## The layers

```text
 surfaces   real bash (entrance/) · web (DOM) · tty HUD · telnet · telnet --hub
            └─ bin/bashcrawl: one dispatch table for all of them
 ─────────────────────────────────────────────────────────────────────────────
 userland   courses/<id>/*.md          lessons: Markdown + frontmatter, rule objectives
 (data)     src/help/data/*.yaml        rooms, quests, encounters, progression, arcade…
            entrance/                   the dungeon itself
 ─────────────────────────────────────────────────────────────────────────────
 features   web/assets/js/plugins/      the game: arena, pathfind, daily, achievements,
                                        progress, bestiary
            termforge/core/             platform plugins: curriculum, mastery, explain
            termforge/node/hub.js       multiplayer presence + chat (telnet --hub)
 ─────────────────────────────────────────────────────────────────────────────
 platform   core/events.js              typed event bus (what happened)
            core/rules.js               declarative predicates (when it is true)
            core/plugin.js              shell.use(plugin): a feature in one call
 ─────────────────────────────────────────────────────────────────────────────
 kernel     core/shell.js · vfs.js · parser.js · packs/posix.js · protocol.js
            Line records (what a command prints) · HookBus (where features attach)
```

Each layer only depends on the ones below it. The kernel and platform are **brand-neutral**: `termforge/test/content-separation.test.js` fails the build if game vocabulary leaks into `termforge/core/`. Any TermForge app can install the platform plugins (`learn`, `skills`, `review`, `explain`), not just the game.

## The learning loop

| You do | The platform does | Where it lives |
|---|---|---|
| `learn` | lists the courses; `learn ID` enrolls you and seeds the lab at `/lab/ID/` | `core/curriculum.js`, `courses/` |
| `lesson` | shows the lesson text and its objectives; `lesson hint` nudges | `core/curriculum.js` |
| type real commands | checks every objective (a rule) after every command and every line; a met lesson pays XP and opens the next | `core/rules.js` |
| keep playing | every `command.run` event grows a skill: uses, distinct flags, failures | `core/mastery.js` |
| `skills` | your skill map, mastery 0 to 5 per command | `core/mastery.js` |
| `review` | a Leitner-box drill of your weakest, most-due skills, rescheduled at 1, 2, 4, 8 and 16 days | `core/mastery.js` |
| `explain LINE` | breaks any line into stages, flags, arguments, pipes and redirects, with no model call | `core/explain.js` |
| `bashcrawl lab ID` | copies the same lab into `~/.bashcrawl/labs/ID` for practice in a real shell | `bin/bashcrawl` |
| the 🎓 **Learn** tab (browser) | a lesson reader beside the same terminal: the lesson rendered from Markdown, click-to-type code, the objective checklist and hints, and the course catalogue as cards | `web/assets/js/learn.js` |

Five courses ship today:

1. Finding Your Way
2. Reading the Runes
3. The Pipeline Forge
4. The Artificer's Workshop
5. Words of Power

That's 25 lessons and 70 objectives. `termforge/test/courses.test.js` plays every one from a fresh lab using only the authored solutions.

## Alignment with bashOS and chui

| Pattern | bashOS / chui | Bashcrawl |
|---|---|---|
| One spec per file, frontmatter + body | `.claude/commands/*.md`, with a `bashos:` loop in the frontmatter | `courses/<id>/NN-lesson.md`, with objectives (rules) in the frontmatter |
| Typed events; surfaces render, kernels never print | `src/bashos/events.py` | `termforge/core/events.js` ([schema](schemas/events.v1.md)) |
| Registration is one entry | the desktop `AppSpec` registry | `termforge/apps/registry.js` and `shell.use(plugin)` ([schema](schemas/plugin.v1.md)) |
| A launcher that works before any dependency | `bin/bashos chui …` runs plain shell before the venv | `bin/bashcrawl` (`play`, `courses`, `lab`, `doctor` and `reset` need only bash) |
| One dispatch table | `chui/tui.sh` | `main()` in `bin/bashcrawl` |
| Verdict-style health | `bin/os-health`: `[ OK ]`/`[WARN]`/`[CRIT]`, exit 0/1/2 | `bashcrawl doctor` (and `make doctor`) |
| Blast radius in one place, deny by default | `opencode/policy.py` | in-memory VFS, read-only providers; the telnet hub is opt-in, sanitized and rate-limited |
| Never deletes a real file | chui moves dotfiles aside | `bashcrawl lab --fresh` moves an old lab aside |
| Runs on stock macOS bash 3.2 | chui's test suite | `bin/bashcrawl` runs in the CI macOS job |
| Deterministic floor | `/health` runs `bin/os-health` before the model | `explain`, mastery and review are rule-based and offline |

## Extending the platform

| To add… | Do this | Checked by |
|---|---|---|
| a badge | an entry in `achievements:` in `src/help/data/progression.yaml` whose `when` is a [rule](schemas/rules.v1.md) | `make validate-contracts`, `progression.test.js` |
| a rank, creature, arena trial or review card | an entry in the matching `progression.yaml` list | `make validate-contracts` |
| a course or lesson | Markdown files under `courses/`, see [authoring-courses.md](authoring-courses.md) | `courses.test.js` (every lesson is winnable, none is free) |
| a game feature | a plugin file in `web/assets/js/plugins/`, its id in `GAME_PLUGINS` (runtime.js), its `<script>` in `web/index.html` and its commands in the handlers literal | `validate_static_web.py`, `progression.test.js` |
| a platform feature any app can use | a brand-neutral plugin factory in `termforge/core/` (see `curriculum.js`) | `content-separation.test.js`, `platform.test.js` |
| a TermForge app | one entry in `termforge/apps/registry.js` | `apps.test.js` |
| a surface reaction to something | a sink on `shell.events` (`"achievement.unlocked"`, `"lesson.*"`, `"*"` …) | `platform.test.js` |

After content or core changes, run `make web-build` and commit the regenerated `web/data/*.json` and vendor mirror, as before.

## Contracts that keep it honest

- **Golden transcripts** (`termforge/test/fixtures/transcripts/`) pin the game's output byte for byte. A fixture diff is a claimed behavior change.
- **Course solvability** (`courses.test.js`) checks two things: every objective is met by its own `solution`, and no lesson is complete the moment it starts.
- **POSIX accuracy** (`packs.test.js`): line-oriented commands count lines like real tools. `wc -l` matches `wc -l` on the same file.
- **Content contracts** (`validate_content_contracts.py`): rooms, quests, encounters, progression and courses are checked against each other and the filesystem.
- **Save shape** (`game-save.test.js`): additive only. The `learn` and `mastery` slices were appended, and the frozen legacy save still loads.

## Surfaces at a glance

| Surface | Start it | Needs |
|---|---|---|
| real bash | `bashcrawl play`, or `cd entrance && cat scroll` | bash (3.2+) |
| browser | <https://bamr87.github.io/bashcrawl/> or `bashcrawl web` (serves `web/dist`; `make web-dev` for hot reload) — Story, Learn, Arcade and Reference doors (`Alt+1`–`4`) | a browser; Node 22.22+ to build (`make web-bundle`), python3 to serve the build |
| terminal HUD | `bashcrawl tty` (`make tty-demo`) | Node 20.16+ |
| telnet | `bashcrawl serve` (`make telnet-demo`) | Node 20.16+ |
| telnet hub (MUD mode) | `bashcrawl hub` (`make telnet-hub`) | Node 20.16+ |
