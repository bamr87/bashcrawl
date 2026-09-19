# AGENTS.md

Filesystem dungeon (`entrance/`) + static web trainer (`web/`) generated from the same content. Python/Node are tooling only; the bash game has no runtime deps. Longer notes: `CLAUDE.md`, `.github/instructions/`, `docs/contributing.md`.

## Where to edit

| Change | Edit here | Do not edit |
|---|---|---|
| Rooms, scrolls, encounters | `entrance/` + `src/help/data/*.yaml` | `web/data/*.json`, `docs/generated/` |
| Emulator kernel | `termforge/core/` (dual-mode UMD+CJS) | `web/assets/js/vendor/termforge/` |
| Game commands / HUD / arcade | `web/assets/js/runtime.js` (and siblings) | reimplement commands in arcade games |
| Playtest harness | `src/playtest/` | |

`web/data/*.json` and the vendor mirror are **committed** projections. After content or `termforge/core/` changes: `make web-build` and commit the result. `make web-test` fails CI if they are stale.

New `termforge/core/*.js` files must keep the dual-mode wrapper (`core/` cannot import `node:*` or the DOM) and be listed in `web/index.html` **before** `runtime.js`.

## Commands

`Makefile` is canonical (`BASHCRAWL_ROOT`, `PYTHONPATH=src:test`). `make help` lists targets.

```bash
make setup                 # chmod encounters
make validate-contracts    # YAML ↔ filesystem ↔ walkthrough ↔ runtime handlers
make web-build             # export JSON + vendor TermForge
make web-test              # web-build + bundle/handler parity
make test                  # pytest unit + integration (cds into test/)
make test-js               # node --test termforge/test/*.test.js
make lint                  # shellcheck + yamllint + markdownlint + ruff
make lint-js               # node --check on every tracked *.js
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
- Infra scripts (`setup.sh`, `help.sh`, `lib/*.sh`) **do** use `set -euo pipefail`.
- macOS bash 3.2: `sed -i.bak`, no GNU-only flags. CI smokes `/bin/bash`.
- New encounter **basename** must be added to `ENCOUNTERS` in `setup.sh` or `./setup.sh` will not `chmod +x` it.
- New room: directory + depth-graded `scroll` + chmod'd encounters + unlock `mv` in a treasure + `src/help/data/*.yaml` + `test/datasets/walkthrough.json` + `lib/reset.sh` if it can be unlocked. Then `make validate-contracts && make web-test`.
- Scroll grades: entrance = pure ASCII / 80 cols / `===` dividers; cellar/armoury = Unicode OK; hidden areas = markdown OK. Details: `.github/instructions/scrolls.instructions.md` and `rooms.instructions.md`.

## Web / TermForge gotchas

- `this.handlers = { … }` in `runtime.js` must stay **one static literal**, one `key: ref,` per line, bare refs only, exactly one `this.handlers = {` in the file. `demo: true` entries in `src/help/data/runtime_commands.yaml` must appear there.
- Mini-games are (seed world + goal + score) over a scoped bare `Runtime`. Do not fork command behavior.
- Goldens: regenerate only with `node termforge/test/tools/record-goldens.js --update`. A fixture diff is a claimed behavior change. `termforge/test/fixtures/save/save-v1-legacy.json` is write-once.
- Do not rename or drop keys on the story save (`bashcrawl-web-state-v1`); `termforge/test/game-save.test.js` locks the shape.
- `make generate-contract-docs` writes `docs/generated/` — do not hand-edit those files.
