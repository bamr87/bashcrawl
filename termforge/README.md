# TermForge

The universal terminal framework extracted from Bashcrawl's browser emulator: one environment-agnostic kernel (parser, VFS, Shell, Line protocol, TerminalView) that powers the web game, local terminal sessions, a lightweight telnet server, and custom dev/monitoring tools — zero runtime dependencies, no build step.

## Try it

```bash
make tty-demo                       # play bashcrawl; saves to ~/.bashcrawl/story.json
make tty-demo ARGS="--no-motion"    # static stage, no attention timers
make tty-demo ARGS="--save-file /tmp/story.json"   # separate local save
make telnet-demo                    # serve it at telnet://127.0.0.1:2323
make telnet-demo ARGS="--raw"       # nc-friendly raw TCP mode
make agentwatch                     # AI-agent task dashboard (demo fleet)
make agentwatch ARGS="--data-dir logs/sessions"    # ...over real playtest telemetry
node termforge/node/host-tty.js --app procwatch    # the monitoring-tool demo
make test-js                        # the node --test suite
```

Browser demo of a custom tool: open `apps/procwatch/demo.html` straight from `file://`.

## Layout

- `core/` — environment-agnostic framework (dual-mode files: classic `<script>` + CJS), including `ascii-motion.js` (plays [ASCII Motion](https://github.com/cameronfoxly/Ascii-Motion) JSON/text/session-v1 exports and the cell-grid effects). Vendored file-for-file into `web/assets/js/vendor/termforge/` by `make web-build`; **edit here, never the vendor mirror**. Brand-neutral by contract: app voice arrives via the Shell's `uiText` copy deck (enforced by `test/content-separation.test.js`).
- `node/` — TTY host, telnet host + codec, CLI plumbing (argv parsing is node's own `util.parseArgs`).
- `apps/` — `bashcrawl.js` (the game as an app), `procwatch/` (live host metrics as provider files), and `agentwatch/` (an AI-agent task dashboard: TaskSource → board/feed commands + live files, with a JSONL adapter for the repo's playtest telemetry).
- `test/` — `node --test` suites, golden fixtures, and the deterministic vm harness.

Docs: [architecture](../docs/termforge/architecture.md) · [authoring apps](../docs/termforge/authoring-apps.md) · [telnet host](../docs/termforge/telnet-host.md) · [hidden gem](../docs/termforge/hidden-gem.md) · [Line protocol](../docs/schemas/terminal-protocol.v2.md).

## Input and reading

TTY and negotiated telnet input support left/right, Home/End, Delete, history, Tab completion, and Unicode across split byte chunks. Long input scrolls horizontally; commands beyond the 4096-character limit never execute in truncated form. Telnet disconnects on overflow. Home/End scroll a focused HUD pane or edit the input when it is focused.

`less FILE` opens a reader in the web or full-screen TTY: Space/PgDn forward, b/PgUp back, q to close. Stream sessions print the text. Telnet sessions are temporary; `save export` and `save import TOKEN` move progress between sessions. Browser saves retain their existing format.

## Golden fixtures

`test/fixtures/` pins the game's observable behavior: transcripts recorded against the pre-framework emulator replay byte-identically through every refactor. Regenerate **only** via `node termforge/test/tools/record-goldens.js --update` and treat any fixture diff in review as a claimed behavior change. `fixtures/save/save-v1-legacy.json` is write-once (a real pre-refactor save proving old browser saves still load).

Bashcrawl save-import tokens have a separate 1 MiB line budget. Their contents are masked in command history and log echoes; ordinary commands retain the 4096-character cap.
