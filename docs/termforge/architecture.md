# TermForge Architecture

TermForge is the universal terminal framework extracted from Bashcrawl's browser emulator: one environment-agnostic kernel that powers the web game, real terminal sessions, a lightweight telnet server, and custom dev/monitoring tools.

One sentence per layer: a **Shell** executes command lines over a **VFS** world and returns **Line protocol** records; a **TerminalView** buffers those records and paints them through a **sink** (DOM or ANSI); a **SessionController** owns command history, controls, errors, and persistence; **hosts** own transport and input; **apps** compose worlds, command packs, and hooks.

## Module map

```text
termforge/
  core/                 environment-agnostic; every file dual-mode (classic <script> + CJS)
    protocol.js         Line protocol constants + validators (docs/schemas/terminal-protocol.v2.md)
    parser.js           tokenizer, pipe/redirect splitting, flag/list/set parsers
    state.js            defaultShellState + mergeSavedState + validateSavedState (framework apps/hosts)
    vfs.js              world maps + session overlay + reveals + read-only providers
    hooks.js            HookBus: on / run / first / collect
    registry.js         pack merging (buildHandlers) + command metadata (describe)
    events.js           typed EventBus: what happened (docs/schemas/events.v1.md)
    rules.js            declarative predicates: evaluate + validate (docs/schemas/rules.v1.md)
    plugin.js           shell.use(plugin): a feature in one call (docs/schemas/plugin.v1.md)
    curriculum.js       platform plugin: courses, lessons, rule objectives, labs (learn/lesson/lab)
    mastery.js          platform plugin: skill map + Leitner spaced review (skills/review)
    explain.js          platform plugin: offline command-line explainer (explain)
    shell.js            the Shell kernel: execute/runPipeline/executeSegment + injectables
    packs/posix.js      the portable teaching toolkit (~34 commands)
    packs/flavour.js    fortune/cowsay/figlet/banner/sl
    view.js             TerminalView: buffer, cap, control routing, sink flush
    sinks/dom.js        DomSink (span-per-line innerHTML) + the canonical escapeHtml
    sinks/ansi.js       AnsiSink (kind -> SGR, CRLF, erase-screen clear)
    input.js            historyStep/applyCompletion + LineEditor + byte decoder (arrows, PgUp, SGR mouse)
    session.js          shared command lifecycle, host capabilities, persistence, pager
    ascii-motion.js     ASCII Motion player: every export + session v1/v2, effects, Library (no DOM)
    art.js              GENERATED from termforge/motion/*.asciimtn: default art (banner, cow, sl)
  node/                 node-only hosts (never vendored)
    index.js            the framework namespace for require()
    data-loader.js      reads web/data/*.json from disk
    cli.js              argv parsing + app resolution
    file-store.js       atomic JSON persistence for local sessions
    motion.js           generic stage presentation (apps supply the plan)
    motion-cli.js       inspect / preview / convert ASCII Motion files (info, play, session, from-text)
    host-tty.js         local terminal host (full-screen HUD, raw mode, or piped line mode)
    pixels.js           PixelBuffer + half-block PixelScreen: a cols×(2·rows) 24-bit framebuffer in ANSI
    gem.js              hidden gem: DAEMON STORM, a pixel shooter overlay (Konami / xyzzy in HUD mode)
    tui.js              TuiScreen: btop-style compositor (boxed log/hud, mouse+PgUp scroll, toast, input)
    telnet-codec.js     RFC 854 subset state machine (socket-free)
    host-telnet.js      multi-session telnet/TCP server (--hub: shared presence + chat)
    hub.js              Hub: who/say/emote/shout/name/top across sessions, sanitized + rate-limited
  apps/
    registry.js         the app registry: --app ID resolves here, --app list prints it
    bashcrawl.js        the game as an App descriptor for the node hosts
    bashcrawl-motion.js game-specific FX catalog and stage planning
    procwatch/          demo monitoring tool: live metrics as VFS provider files
  motion/               the framework's default art as .asciimtn sessions (-> core/art.js)
  test/                 node --test suites + golden fixtures + vm harness
```

## Dependency rules

- `core/` files may depend only on other `core/` files and language built-ins — never on the DOM, `node:*` modules, or anything outside `core/`.
- `node/` files may use `node:*` modules and `core/`.
- `apps/` compose both; an app that wants to run in the browser too keeps its core logic free of `node:*` (procwatch does this with an injectable metric source).
- The bashcrawl game assembly (`web/assets/js/runtime.js`) is a **consumer** of core, not part of it.

## The dual-mode module header

Every `core/` file uses one wrapper so the same bytes load as a classic `<script>` (attaching to `window.TermForge.*`) and as a CJS module under node:

```js
(function (global, factory) {
    "use strict";
    const api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else {
        global.TermForge = global.TermForge || {};
        global.TermForge.<name> = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () { /* ... */ });
```

Files with dependencies resolve them per environment (`require("./parser.js")` under CJS, `global.TermForge.parser` as a classic script) — see `core/shell.js`. There is no build step and no `"type": "module"`; classic-script order in `web/index.html` is the browser's dependency graph, and `termforge/node/index.js` is node's.

## ASCII Motion

All art is [ASCII Motion](https://github.com/cameronfoxly/Ascii-Motion) files. Nothing is drawn from string literals in code. `core/ascii-motion.js` (`TermForge.asciiMotion`) plays every format the editor writes: JSON and text exports, HTML frame grids, session v1, and session v2 layer timelines. For v2 it flattens layers, groups, keyframed transforms with the editor's easing, and effect tracks. The cell effects use the editor's own settings: `levels`, `hue-saturation`, `remap-colors`, `remap-characters`, `scatter`, `wave-warp`, `wiggle`, and `motion-trails`. `Library` names clips for an app. The Shell owns one, holding `core/art.js` defaults under the app's `art` option, and `Shell#art(name)` renders a clip as text. That is how the flavour pack draws `banner`/`cowsay`/`sl` and how the game draws portraits, vignettes, and banners.

The command stage uses the same files. `motion/clips/` is registered in `src/help/data/motion.yaml`, along with aliases, the stage set, and event overrides, and is bundled into `fx-clips.js`. The browser (`fx.js`) and `apps/bashcrawl-motion.js` read that one manifest. `node/motion.js` only presents an app-supplied plan. On a wide terminal the clip plays in a labeled `stage` section at the bottom of the sidebar, not in the log. Color washes, header attention, toasts, and HUD layout options stay separate. At small sizes the stage is suppressed to preserve reading space, and reduced motion holds one static frame. Stream hosts have no animated cursor effects.

Authoring workflow, CLI, and what is and isn't rendered: [ascii-motion.md](ascii-motion.md).

## The Shell and its hook spine

`new Shell({ world, state?, handlers?, packs?, commands?, hooks?, clock?, rng?, encodeBase64?, bare? })`.

Command handlers are **unbound functions** invoked as `fn.call(shell, args, stdin)` returning `Line[]`; they may use any public Shell member through `this`. Apps either compose packs (`registry.buildHandlers`) or enumerate an explicit `handlers` literal (bashcrawl does, as its command manifest).

All app-specific behavior attaches through the HookBus instead of living in the kernel:

| Hook | Fired | Semantics | Bashcrawl subscriber |
|------|-------|-----------|----------------------|
| `preExecute(line)` | before anything runs | side effects | daily-challenge rollover |
| `interceptLine(line) -> Line[]?` | before parsing | first non-null **replaces** the pipeline | Training Arena answers |
| `postExecute(line, out) -> Line[]` | after the pipeline | appended | achievements → daily → rank-up |
| `observePipeline(line, out) -> Line[]` | non-redirect pipeline exit | appended | Path-Finder arrival detection |
| `beforeCommand(cmd, args, stdin)` | per segment, pre-dispatch | side effects | command stats |
| `execDispatch(name) -> Line[]?` | `./name` | first non-null handles it; all-null → error | encounter engine |
| `postCommand(cmd, args, stdin, out)` | per segment, post-dispatch | side effects | quest advancement, scroll counter, lesson objectives |
| `promptLabel() -> string?` | when a host draws the prompt | first non-null replaces it | review session prompt |

`bare: true` (constructor option, also settable post-hoc) skips every hook in `execute()` — the Practice Arcade uses it for scoped sandboxes.

## Platform services: events, rules, plugins

Three brand-neutral modules sit on top of the hook spine (the whole picture, with the learning plugins built on them, is in [docs/PLATFORM.md](../PLATFORM.md)):

- **Typed events** (`core/events.js`, [schema](../schemas/events.v1.md)). Each Shell owns an `EventBus` (`shell.events`) and emits `command.run` per segment, `location.changed`, and `line.executed`; apps and plugins add their own (`quest.completed`, `achievement.unlocked`, `lesson.completed`, `skill.levelled`, …). Sinks are synchronous, isolated on error, and never print — the bashOS `events.py` contract. Bare shells emit nothing.
- **Rules** (`core/rules.js`, [schema](../schemas/rules.v1.md)). One evaluator and validator for declarative predicates over state, the command that just ran, and the VFS — badges and lesson objectives are YAML/frontmatter, not lambdas.
- **Plugins** (`core/plugin.js`, [schema](../schemas/plugin.v1.md)). `shell.use(plugin)` installs commands, `man` metadata, hooks, event sinks, read-only mounts, copy-deck defaults and a sanitized state slice in one call, and returns an uninstall handle. The game's features (`web/assets/js/plugins/`) and the learning platform (`curriculum`, `mastery`, `explain`) are all plugins.

Determinism: `clock`, `rng`, and `encodeBase64` are injectable; tests pin them (the golden fixtures replay byte-identically forever) and hosts default to the environment's own.

Content stays out of the framework: every brandable string a core pack emits routes through the Shell's `uiText` copy deck (`DEFAULT_UI_TEXT` in `shell.js` holds the neutral defaults; apps override entries — the game's voice is `GAME_UI_TEXT` in `runtime.js`). `termforge/test/content-separation.test.js` fails the build if game vocabulary appears anywhere under `termforge/core/`.

## VFS: worlds, overlay, reveals, providers

A world is flat maps — the exact shape `scripts/export_static_web.py` emits and `arcade.js`'s `worldFromScenario` builds:

```js
{ root, directories: { "/path": [{name, type: "dir"|"file"|"exec", hidden}] },
  files: { "/path/file": "contents" }, rooms?: {...}, encounters?: {...} }
```

Layered on top, in lookup precedence order:

1. **Providers** — read-only dynamic subtrees (`vfs.addProvider({ prefix, isDir, list, read })`), longest mount wins, mounts appear as directories in their parent's listing, writes into a mount are refused. This is the monitoring-tool seam: procwatch maps `node:os` metrics to `/procwatch/sys/*`, recomputed on every read.
2. **`state.userNodes`** — session-created files/dirs; a written file shadows a same-named world file and `rm` peels the shadow back off.
3. **The world** (+ `state.reveals`, the visible-path → dotted-path aliases for unlocked hidden rooms, applied longest-prefix-first).

The VFS reads state through a `getState()` thunk, so a host can replace the whole state object (reset) without rebuilding anything.

## State ownership

Framework shell state (`state.defaultShellState`): `cwd, prevCwd, aliases, envVars, userNodes, history, historyIndex, reveals`. Apps add their own fields on top.

The bashcrawl game deliberately does **not** build its state from this module: its fused `defaultState()` literal in `web/assets/js/runtime.js` IS the persisted `bashcrawl-web-state-v1` save shape, locked (keys and key order) by `termforge/test/fixtures/save/defaults-current.json`.

## Session lifecycle and persistence

`core/session.js` exports `SessionController` and `Pager`. The web story, TTY, and telnet hosts use the controller to record bounded history, execute commands, route controls, surface errors, and save progress. Control callbacks may replace the runtime; capabilities and persistence are reapplied afterwards. Hosts supply a view, optional storage adapter, and page callback. Arcade trials keep their scoped bare runtimes and score lifecycle.

`Runtime` emits the v2 `page` control for `less FILE` only when the host advertises a pager. Pipelines and redirections always receive ordinary file output. The TTY pager occupies the log pane without changing scrollback; the browser uses a keyboard-accessible dialog. Stream and telnet sessions print the file and explain that behavior in their banner.

Interactive local Bashcrawl sessions save atomically to `~/.bashcrawl/story.json`; override with `--save-file PATH` or `BASHCRAWL_SAVE_FILE`. Piped sessions persist only with an explicit path. Telnet sessions are temporary and isolated. All surfaces accept UTF-8 `save export` / `save import TOKEN`; imports validate before replacing state. Local invalid saves fail startup without overwriting the file. Browser recovery copies use the additive `bashcrawl-web-state-v1-recovery` key. The story save shape and legacy fixture remain unchanged.

The DOM sink appends new lines without remounting existing output. It follows the tail while pinned, including stage layout changes, and preserves the reader's scroll position after they scroll up.

## The vendoring contract

`termforge/core/` is the single source of truth. `make web-build` mirrors it file-for-file into `web/assets/js/vendor/termforge/` (committed, because `web/` deploys to GitHub Pages verbatim). `scripts/vendor_termforge.py --check` enforces byte-identity in both directions and runs inside `scripts/validate_static_web.py`, `make web-test`, and the pytest suite. **Edit `termforge/core/`, never the vendor mirror.** `web/index.html` must load every vendored file before `runtime.js`; the validator checks that too.

## Testing

`make test-js` runs the `node --test` suites (zero npm dependencies). The cornerstone is the golden-transcript harness: `termforge/test/helpers/load-classic.js` loads the vendored classic scripts into a vm sandbox with a pinned clock/rng/btoa, and `game-golden.test.js` replays recorded fixtures byte-for-byte — the pixel-identity contract that carried the extraction. Regenerate fixtures only via `node termforge/test/tools/record-goldens.js --update`; a fixture diff in review is a claimed behavior change.
