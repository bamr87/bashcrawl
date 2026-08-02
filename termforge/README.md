# TermForge

The universal terminal framework extracted from Bashcrawl's browser emulator: one environment-agnostic kernel (parser, VFS, Shell, Line protocol, TerminalView) that powers the web game, local terminal sessions, a lightweight telnet server, and custom dev/monitoring tools — zero runtime dependencies, no build step.

## Try it

```bash
make tty-demo                       # play bashcrawl in this terminal
make telnet-demo                    # serve it at telnet://127.0.0.1:2323
make telnet-demo ARGS="--raw"       # nc-friendly raw TCP mode
make agentwatch                     # AI-agent task dashboard (demo fleet)
make agentwatch ARGS="--data-dir logs/sessions"    # ...over real playtest telemetry
node termforge/node/host-tty.js --app procwatch    # the monitoring-tool demo
make test-js                        # the node --test suite
```

Browser demo of a custom tool: open `apps/procwatch/demo.html` straight from `file://`.

## Layout

- `core/` — environment-agnostic framework (dual-mode files: classic `<script>` + CJS). Vendored file-for-file into `web/assets/js/vendor/termforge/` by `make web-build`; **edit here, never the vendor mirror**. Brand-neutral by contract: app voice arrives via the Shell's `uiText` copy deck (enforced by `test/content-separation.test.js`).
- `node/` — TTY host, telnet host + codec, CLI plumbing (argv parsing is node's own `util.parseArgs`).
- `apps/` — `bashcrawl.js` (the game as an app), `procwatch/` (live host metrics as provider files), and `agentwatch/` (an AI-agent task dashboard: TaskSource → board/feed commands + live files, with a JSONL adapter for the repo's playtest telemetry).
- `test/` — `node --test` suites, golden fixtures, and the deterministic vm harness.

Docs: [architecture](../docs/termforge/architecture.md) · [authoring apps](../docs/termforge/authoring-apps.md) · [telnet host](../docs/termforge/telnet-host.md) · [Line protocol](../docs/schemas/terminal-protocol.v1.md).

## Golden fixtures

`test/fixtures/` pins the game's observable behavior: transcripts recorded against the pre-framework emulator replay byte-identically through every refactor. Regenerate **only** via `node termforge/test/tools/record-goldens.js --update` and treat any fixture diff in review as a claimed behavior change. `fixtures/save/save-v1-legacy.json` is write-once (a real pre-refactor save proving old browser saves still load).
