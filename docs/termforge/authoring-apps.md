# Authoring TermForge Apps

A TermForge **app** is a world + command packs + hooks, wrapped in a small descriptor the hosts understand. The same app runs in the browser (classic scripts), in a local terminal (`host-tty.js`), and over telnet (`host-telnet.js`).

## The App descriptor

```js
// my-tool.js
module.exports = {
    createApp(options = {}) {
        return {
            id: "my-tool",
            name: "My Tool",
            createSession({ width } = {}) {
                const session = {
                    runtime,            // duck type below
                    banner: [ { kind: "banner", text: "MY TOOL" } ],   // Line[] printed once
                    onControl(action) { /* "reset": rebuild session.runtime */ },
                };
                return session;
            },
        };
    },
};
```

`runtime` is anything with the Shell surface the hosts use: `execute(line) -> Line[]`, `completions(text) -> string[]`, `promptLabel() -> string`, and `state` (with `history`/`historyIndex` for the editor). A plain `TermForge.Shell` qualifies; so does the bashcrawl `Runtime` subclass.

Run it: `node termforge/node/host-tty.js --app ./my-tool.js` or `node termforge/node/host-telnet.js --app ./my-tool.js --raw`.

## Command packs

A pack is a plain module: `{ name, commands, meta? }`.

```js
const pack = {
    name: "greetings",
    commands: {
        // Unbound functions; ALWAYS invoked as fn.call(shell, args, stdin).
        // Return Line[] (docs/schemas/terminal-protocol.v1.md). Use any public
        // Shell member via `this` (resolve, readFile, entries, state, rng, ...).
        hello(args, stdin) {
            const name = args[0] || (stdin ? stdin.trim() : "world");
            return [{ kind: "success", text: `Hello, ${name}!` }];
        },
    },
    meta: { hello: { summary: "greet someone", usage: "hello [NAME]" } },
};
const shell = new TermForge.Shell({ world, packs: [TermForge.packs.posix, pack] });
```

Later packs win name collisions (`registry.buildHandlers`). Handlers registered this way feed tab completion and `man` automatically.

## Authoring a world

Inline worlds are plain objects (this is the same shape the Practice Arcade builds from scenario specs):

```js
const world = {
    root: "/lab",
    directories: {
        "/lab": [
            { name: "notes.txt", type: "file", hidden: false },
            { name: "vault", type: "dir", hidden: false },
            { name: ".secret", type: "file", hidden: true },
        ],
        "/lab/vault": [],
    },
    files: { "/lab/notes.txt": "hello\n", "/lab/.secret": "shh" },
};
```

For **live data**, mount a read-only provider instead of static files:

```js
shell.vfs.addProvider({
    prefix: "/lab/proc",
    isDir: (p) => p === "/lab/proc",
    list: (p) => (p === "/lab/proc" ? [{ name: "uptime", type: "file", hidden: false }] : null),
    read: (p) => (p === "/lab/proc/uptime" ? String(process.uptime()) : null),
});
```

Provider files recompute on every read, list in their parent directory, take precedence over world/overlay entries under their prefix, and refuse writes — so `cat proc/uptime | rev` and `grep -r` work over live data with zero extra code.

## Hooks

Subscribe app behavior on `shell.hooks` (full table in [architecture.md](architecture.md)). The two most useful for tools:

- `execDispatch(name)` — make `./thing` do something (return `Line[]`, or `null` to decline).
- `postCommand(cmd, args, stdin, outputs)` — telemetry/scoring after every command.

## The worked example

`termforge/apps/procwatch/` (~150 lines) is the reference custom tool: an injectable metric source (`node:os` by default, `MOCK_SOURCE` for tests and the `demo.html` browser demo), a `sys` dashboard pack, and the provider mount described above. Its tests (`termforge/test/apps.test.js`) show the whole surface exercised without any host.

## How bashcrawl itself is an app

The game (`web/assets/js/runtime.js`) is `class Runtime extends TermForge.Shell` plus: a fully-enumerated static `this.handlers = { ... }` literal mixing pack functions (`P.cat`, `F.cowsay`) with game commands (`this.cmdQuest`) — that literal doubles as the game's command manifest and is what `scripts/validate_runtime_commands.py` regex-reads, so keep one `key: ref,` per line, bare references only — and an `installGameHooks()` wiring quests, achievements, the trainer, pathfind, and encounters onto the hook spine. `termforge/apps/bashcrawl.js` wraps that same class in the App descriptor for the node hosts.
