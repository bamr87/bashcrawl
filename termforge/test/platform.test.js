"use strict";
// Platform services: typed events (core/events.js), declarative rules
// (core/rules.js) and feature plugins (core/plugin.js), plus the Shell's
// wiring of all three.

const test = require("node:test");
const assert = require("node:assert");
const { EventBus, TYPES } = require("../core/events.js");
const rules = require("../core/rules.js");
const { validatePlugin, listPlugins } = require("../core/plugin.js");
const { Shell } = require("../core/shell.js");
const posix = require("../core/packs/posix.js");

const WORLD = {
    root: "/lab",
    directories: {
        "/lab": [
            { name: "notes.txt", type: "file", hidden: false },
            { name: "vault", type: "dir", hidden: false },
        ],
        "/lab/vault": [],
    },
    files: { "/lab/notes.txt": "alpha\nbeta\n" },
};

function makeShell(extra) {
    return new Shell({ world: WORLD, packs: [posix], ...(extra || {}) });
}

// ── events ──────────────────────────────────────────────────────────────

test("EventBus stamps seq/session, freezes, and fans out exact, family and wildcard sinks", () => {
    const bus = new EventBus({ session: "s1" });
    const seen = [];
    bus.on("progress.xp", (e) => seen.push(`exact:${e.amount}`));
    bus.on("progress.*", (e) => seen.push(`family:${e.type}`));
    bus.on("*", (e) => seen.push(`all:${e.type}`));
    const event = bus.emit("progress.xp", { amount: 5, type: "spoofed", seq: 99 });
    assert.deepStrictEqual(seen, ["exact:5", "family:progress.xp", "all:progress.xp"]);
    assert.strictEqual(event.type, "progress.xp");
    assert.strictEqual(event.seq, 1);
    assert.strictEqual(event.session, "s1");
    assert.ok(Object.isFrozen(event));
    assert.strictEqual(bus.emit("other").seq, 2);
});

test("a throwing sink is isolated and reported; later sinks still run", () => {
    const errors = [];
    const bus = new EventBus({ onError: (err, e) => errors.push(`${err.message}@${e.type}`) });
    const got = [];
    bus.on("x.y", () => { throw new Error("boom"); });
    bus.on("x.y", () => got.push("second"));
    bus.emit("x.y");
    assert.deepStrictEqual(errors, ["boom@x.y"]);
    assert.deepStrictEqual(got, ["second"]);
});

test("once, unsubscribe, capture, history and pipe", () => {
    const bus = new EventBus({ history: 2 });
    let count = 0;
    bus.once("a.b", () => { count += 1; });
    const off = bus.on("a.b", () => { count += 10; });
    bus.emit("a.b");
    off();
    bus.emit("a.b");
    assert.strictEqual(count, 11);
    const { result, events } = bus.capture(() => { bus.emit("c.d", { n: 1 }); return "done"; });
    assert.strictEqual(result, "done");
    assert.deepStrictEqual(events.map((e) => e.type), ["c.d"]);
    assert.deepStrictEqual(bus.recent().map((e) => e.type), ["a.b", "c.d"]);

    const hub = new EventBus({ session: "hub" });
    const source = new EventBus({ session: "alice" });
    const forwarded = [];
    hub.on("*", (e) => forwarded.push(e));
    source.pipe(hub, (e) => e.type !== "noise.x");
    source.emit("noise.x");
    source.emit("progress.xp", { amount: 3 });
    assert.strictEqual(forwarded.length, 1);
    assert.strictEqual(forwarded[0].session, "hub");
    assert.strictEqual(forwarded[0].origin, "alice");
    assert.strictEqual(forwarded[0].amount, 3);
});

test("the event catalog documents the kernel's own types", () => {
    for (const type of ["line.executed", "command.run", "location.changed"]) {
        assert.ok(TYPES[type], `${type} missing from TYPES`);
    }
});

test("Shell emits command.run per segment, location.changed and line.executed — never when bare", () => {
    const shell = makeShell({ session: "t" });
    const types = [];
    shell.events.on("*", (e) => types.push(e.type === "command.run" ? `run:${e.cmd}:${e.piped}:${e.ok}` : e.type));
    shell.execute("cat notes.txt | wc -l");
    shell.execute("cd vault");
    shell.execute("frobnicate");
    assert.deepStrictEqual(types, [
        "run:cat:false:true", "run:wc:true:true", "line.executed",
        "run:cd:false:true", "location.changed", "line.executed",
        "run:frobnicate:false:false", "line.executed",
    ]);
    const bare = makeShell({ bare: true });
    let fired = 0;
    bare.events.on("*", () => { fired += 1; });
    bare.execute("ls");
    assert.strictEqual(fired, 0);
});

// ── rules ───────────────────────────────────────────────────────────────

test("rules evaluate state, command context and filesystem heads", () => {
    const shell = makeShell();
    const state = {
        cwd: "/lab/vault", xp: 150, inventory: ["key", "lamp"], reveals: { "/a": "/.a" },
        flags: { cleared: true }, stats: { commands: { pwd: 2 } }, best: null,
    };
    const ctx = { state, cmd: "ls", args: ["-la", "notes.txt"], stdin: "x", outputs: [{ kind: "output", text: "hello" }], shell };
    const yes = [
        { state: "xp", gte: 150 }, { state: "stats.commands.pwd", gt: 1 }, { count: "inventory", eq: 2 },
        { count: "reveals", gte: 1 }, { has: "inventory", value: ["lamp", "key"] }, { flag: "cleared" },
        { command: ["ls", "tree"] }, { arg: "notes.txt" }, { option: "a" }, { option: "l" }, { piped: true },
        { ok: true }, { output_includes: "ell" }, { cwd: "/lab/vault" }, { cwd_includes: "vault" },
        { file_exists: "/lab/notes.txt" }, { dir_exists: ".." }, { file_contains: "/lab/notes.txt", text: "beta" },
        { all: [{ always: true }, { not: { exists: "best" } }] }, { any: [{ always: false }, { state: "xp" }] },
        { state: "cwd", matches: "^/lab" }, { state: "inventory", includes: "key" }, { state: "xp", in: [100, 150] },
        { state: "stats.commands.mkdir", eq: 0 }, { state: "stats.commands.mkdir", lt: 1 },
    ];
    for (const rule of yes) {
        assert.deepStrictEqual(rules.validate(rule), [], JSON.stringify(rule));
        assert.strictEqual(rules.evaluate(rule, ctx), true, JSON.stringify(rule));
    }
    const no = [
        { state: "stats.commands.mkdir", gt: 0 }, { option: "z" }, { command: "cat" }, { piped: false },
        { has: "inventory", value: "sword" }, { flag: "nope" }, { file_exists: "missing" }, { exists: "best" },
    ];
    for (const rule of no) assert.strictEqual(rules.evaluate(rule, ctx), false, JSON.stringify(rule));
    // No command context: command heads are simply unmet, never an error.
    assert.strictEqual(rules.evaluate({ command: "ls" }, { state }), false);
});

test("rules: a list on any string head means 'any of', and validate agrees with evaluate", () => {
    const shell = makeShell();
    const ctx = { state: { cwd: "/lab" }, cmd: "grep", args: ["-rn", "beta", "notes.txt"], outputs: [{ kind: "output", text: "notes.txt:2:beta" }], shell };
    const yes = [
        { args_contains: ["alpha", "beta"] }, { option: ["z", "n"] }, { output_includes: ["nope", "beta"] },
        { file_exists: ["missing", "notes.txt"] }, { dir_exists: ["nope", "vault"] },
        { file_contains: ["missing", "notes.txt"], text: "alpha" },
    ];
    for (const rule of yes) {
        assert.deepStrictEqual(rules.validate(rule), [], JSON.stringify(rule));
        assert.strictEqual(rules.evaluate(rule, ctx), true, JSON.stringify(rule));
    }
    assert.strictEqual(rules.evaluate({ output_includes: ["nope", "zilch"] }, ctx), false);
    assert.strictEqual(rules.evaluate({ file_exists: ["missing", "also-missing"] }, ctx), false);
});

test("rules: command heads are unknown outside a command context, so `not` cannot hand out a free pass", () => {
    const shell = makeShell();
    const lineCtx = { state: { cwd: "/lab/vault" }, line: "pwd", shell };
    const cmdCtx = { ...lineCtx, cmd: "pwd", args: [], outputs: [] };
    assert.strictEqual(rules.evaluate({ not: { command: "cd" } }, cmdCtx), true);
    assert.strictEqual(rules.evaluate({ not: { command: "cd" } }, lineCtx), false);
    assert.strictEqual(rules.evaluate({ all: [{ cwd: "/lab/vault" }, { not: { command: "cd" } }] }, lineCtx), false);
    assert.strictEqual(rules.evaluate({ piped: false }, lineCtx), false);
    assert.strictEqual(rules.evaluate({ ok: true }, lineCtx), false);
    assert.strictEqual(rules.evaluate({ not: { output_includes: "x" } }, lineCtx), false);
    // Unknown never poisons what can be decided without a command.
    assert.strictEqual(rules.evaluate({ not: { file_exists: "missing" } }, lineCtx), true);
    assert.strictEqual(rules.evaluate({ any: [{ not: { command: "x" } }, { cwd: "/lab/vault" }] }, lineCtx), true);
    assert.strictEqual(rules.evaluate({ all: [{ cwd: "/nowhere" }, { not: { command: "x" } }] }, lineCtx), false);
    for (const head of rules.COMMAND_HEADS) assert.ok(rules.HEADS.includes(head), head);
});

test("rules.validate rejects authoring mistakes with a located message", () => {
    const cases = [
        [{}, /exactly one/],
        [{ state: "xp", command: "ls" }, /exactly one/],
        [{ state: "xp", bogus: 1 }, /unexpected key 'bogus'/],
        [{ all: [] }, /non-empty list/],
        [{ any: [{ nope: 1 }] }, /any\[0\]/],
        [{ state: "__proto__.polluted" }, /dotted state path/],
        [{ state: "xp", gte: "ten" }, /must be a number/],
        [{ state: "cwd", matches: "(" }, /matches/],
        [{ piped: "yes" }, /true or false/],
        [{ has: "inventory" }, /needs a value/],
    ];
    for (const [rule, pattern] of cases) {
        const errors = rules.validate(rule, "objective");
        assert.ok(errors.some((e) => pattern.test(e) && e.startsWith("objective")), `${JSON.stringify(rule)} -> ${errors}`);
    }
    assert.strictEqual(rules.lookup({ a: { b: 1 } }, "a.constructor"), undefined);
});

// ── plugins ─────────────────────────────────────────────────────────────

function greeter(calls) {
    return {
        id: "greeter",
        name: "Greeter",
        version: "1.0.0",
        description: "says hello",
        commands: {
            hello(args) { return [{ kind: "success", text: `hello ${args[0] || this.pluginState("greeter").name}` }]; },
        },
        meta: { hello: { summary: "greet someone", usage: "hello [NAME]" } },
        hooks: { postCommand(cmd) { calls.push(`post:${cmd}:${this.state.cwd}`); } },
        events: { "location.changed"(event, shell) { calls.push(`moved:${event.to}:${shell === this}`); } },
        uiText: { greeting: "hi", figletDefault: "SHOULD-NOT-WIN" },
        state: { key: "greet", defaults: () => ({ name: "world", count: 0 }) },
        providers: [{
            prefix: "/lab/live",
            isDir: (p) => p === "/lab/live",
            list: () => [{ name: "now", type: "file", hidden: false }],
            read: (p) => (p === "/lab/live/now" ? "tick" : null),
        }],
        setup(shell) {
            calls.push("setup");
            return () => calls.push("teardown");
        },
    };
}

test("use() installs commands, meta, hooks, sinks, copy, state and mounts; uninstall reverses it", () => {
    const calls = [];
    const shell = makeShell();
    const handle = shell.use(greeter(calls));
    assert.deepStrictEqual(calls, ["setup"]);
    assert.strictEqual(shell.execute("hello")[0].text, "hello world");
    assert.strictEqual(shell.execute("hello you")[0].text, "hello you");
    assert.match(shell.execute("man hello")[0].text, /SYNOPSIS\n {4}hello \[NAME\][\s\S]*greet someone/);
    assert.strictEqual(shell.text("greeting"), "hi");
    assert.strictEqual(shell.text("figletDefault"), "TERMFORGE", "a plugin never overrides existing copy");
    assert.strictEqual(shell.execute("cat live/now")[0].text, "tick");
    shell.execute("cd vault");
    assert.ok(calls.includes("moved:/lab/vault:true"));
    assert.ok(calls.includes("post:cd:/lab/vault"));
    assert.deepStrictEqual(listPlugins(shell).map((p) => [p.id, p.commands]), [["greeter", ["hello"]]]);
    assert.ok(shell.completions("hel").includes("hello"));

    handle.uninstall();
    assert.ok(calls.includes("teardown"));
    assert.strictEqual(shell.handlers.hello, undefined);
    assert.strictEqual(shell.commandMeta.hello, undefined);
    const before = calls.length;
    shell.execute("cd ..");
    assert.strictEqual(calls.length, before, "hooks and sinks are unsubscribed");
    assert.strictEqual(shell.plugins.size, 0);
});

test("pluginState survives a wholesale state swap and tops up new default fields", () => {
    const shell = makeShell();
    shell.use(greeter([]));
    shell.pluginState("greeter").count = 3;
    shell.state = { ...shell.state, greet: { name: "saved" } };
    const slice = shell.pluginState("greeter");
    assert.deepStrictEqual(slice, { name: "saved", count: 0 });
    shell.state = { ...shell.state, greet: "corrupt" };
    assert.deepStrictEqual(shell.pluginState("greeter"), { name: "world", count: 0 });
    assert.strictEqual(shell.pluginState("unknown"), null);
});

test("requires, duplicates and malformed plugins are refused", () => {
    const shell = makeShell();
    assert.throws(() => shell.use({ id: "needs", requires: ["greeter"] }), /requires greeter/);
    shell.use(greeter([]));
    assert.throws(() => shell.use(greeter([])), /already installed/);
    assert.doesNotThrow(() => shell.use({ id: "needs", requires: ["greeter"] }));
    assert.match(validatePlugin({ id: "Bad Id" }).join(), /kebab-case/);
    assert.match(validatePlugin({ id: "x", commands: { a: 1 } }).join(), /command 'a' must be a function/);
    assert.match(validatePlugin({ id: "x", surprise: true }).join(), /unknown key 'surprise'/);
    assert.match(validatePlugin({ id: "x", state: { key: "k" } }).join(), /state needs/);
});

test("a plugin command the app manifest already maps is not re-registered or removed", () => {
    const shell = makeShell();
    const plugin = greeter([]);
    shell.handlers.hello = plugin.commands.hello;
    const handle = shell.use(plugin);
    handle.uninstall();
    assert.strictEqual(shell.handlers.hello, plugin.commands.hello);
});

test("constructor plugins install in order", () => {
    const calls = [];
    const shell = makeShell({ plugins: [greeter(calls), { id: "after", requires: ["greeter"] }] });
    assert.deepStrictEqual(Array.from(shell.plugins.keys()), ["greeter", "after"]);
});

test("a plugin whose setup throws leaves nothing behind and can be installed again", () => {
    const shell = makeShell();
    const calls = [];
    const broken = { ...greeter(calls), setup() { throw new Error("needs an option"); } };
    assert.throws(() => shell.use(broken), /needs an option/);
    assert.strictEqual(shell.plugins.has("greeter"), false);
    assert.strictEqual(shell.handlers.hello, undefined);
    assert.strictEqual(shell.commandMeta.hello, undefined);
    assert.strictEqual(shell.vfs.providerFor("/lab/live"), null);
    shell.execute("cd vault");
    assert.deepStrictEqual(calls, [], "its hooks and sinks are gone");
    assert.doesNotThrow(() => shell.use(greeter(calls)));
    assert.strictEqual(shell.execute("hello")[0].text, "hello world");
});

test("uninstall unmounts a plugin's providers, so a reinstall does not stack mounts", () => {
    const shell = makeShell();
    const first = shell.use(greeter([]));
    assert.strictEqual(shell.execute("cat live/now")[0].text, "tick");
    first.uninstall();
    assert.strictEqual(shell.vfs.providerFor("/lab/live"), null);
    assert.strictEqual(shell.execute("cat live/now")[0].kind, "error");
    assert.ok(!shell.vfs.entries("/lab").some((e) => e.name === "live"), "the mount is gone from the listing");
    const second = shell.use(greeter([]));
    assert.strictEqual(shell.execute("cat live/now")[0].text, "tick");
    second.uninstall();
    assert.strictEqual(shell.vfs.providerFor("/lab/live"), null, "no stale mount survives a second cycle");
});

test("mv refuses a read-only mount as its destination, like cp and > already did", () => {
    const shell = makeShell();
    shell.use(greeter([]));
    shell.execute("touch note");
    assert.match(shell.execute("mv note live/note")[0].text, /read-only/);
    assert.match(shell.execute("mv note live")[0].text, /read-only/);
    assert.strictEqual(shell.state.userNodes["/lab/live/note"], undefined);
    assert.ok(shell.state.userNodes["/lab/note"], "the source is untouched");
    assert.strictEqual(shell.execute("cat live/now")[0].text, "tick");
});
