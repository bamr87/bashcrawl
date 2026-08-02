"use strict";
// Kernel tests for termforge/core/shell.js — a Shell composed purely from
// framework parts (no game, no browser): pipelines, redirection, globs,
// aliases, hooks, injectables, provider write-guard.

const test = require("node:test");
const assert = require("node:assert");
const { Shell } = require("../core/shell.js");
const posix = require("../core/packs/posix.js");
const flavour = require("../core/packs/flavour.js");
const { HookBus } = require("../core/hooks.js");
const { buildHandlers, describe } = require("../core/registry.js");

function makeWorld() {
    return {
        root: "/ship",
        directories: {
            "/ship": [
                { name: "log", type: "file", hidden: false },
                { name: "deck", type: "dir", hidden: false },
            ],
            "/ship/deck": [],
        },
        files: { "/ship/log": "alpha\nbravo\nalpha\ncharlie" },
    };
}

function makeShell(options = {}) {
    return new Shell({
        world: makeWorld(),
        packs: [posix, flavour],
        ...options,
    });
}

function textOf(outputs) {
    return outputs.map((o) => o.text ?? "").join("\n");
}

test("pipelines chain stdin and stop at the first erroring segment", () => {
    const shell = makeShell();
    assert.strictEqual(textOf(shell.execute("cat log | sort | uniq -c | head -1")), "      2 alpha");
    const out = shell.execute("cat missing | wc -l");
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].kind, "error");
    assert.match(out[0].text, /No such file/);
});

test("stdin derivation drops error and control records", () => {
    const shell = makeShell();
    // `clear` emits a control record; piping it onward contributes no text, so
    // wc sees empty stdin (not null — the pipe still connected).
    const out = shell.execute("clear | wc -l");
    assert.strictEqual(out[0].text, "0 0 0");
});

test("redirection writes the overlay, appends, and reports the dim summary", () => {
    const shell = makeShell();
    let out = shell.execute("cat log | sort -u > sorted");
    assert.deepStrictEqual(out, [{ kind: "dim", text: "(wrote 3 lines to sorted)" }]);
    assert.strictEqual(textOf(shell.execute("cat sorted")), "alpha\nbravo\ncharlie");
    out = shell.execute("echo delta >> sorted");
    assert.deepStrictEqual(out, [{ kind: "dim", text: "(appended 1 line to sorted)" }]);
    assert.strictEqual(textOf(shell.execute("cat sorted")), "alpha\nbravo\ncharlie\ndelta");
    assert.strictEqual(shell.execute("echo x >")[0].kind, "error");
    assert.strictEqual(shell.execute("echo x > f g")[0].kind, "error");
});

test("glob expansion honors quoting", () => {
    const shell = makeShell();
    assert.strictEqual(textOf(shell.execute("echo l*")), "log");
    assert.strictEqual(textOf(shell.execute("echo 'l*'")), "l*");
    assert.strictEqual(textOf(shell.execute("echo z*")), "z*", "no match keeps the literal");
});

test("aliases expand the head token only", () => {
    const shell = makeShell();
    shell.execute("alias ll='ls -F'");
    assert.strictEqual(textOf(shell.execute("ll")), "deck/  log");
    assert.strictEqual(textOf(shell.execute("echo ll")), "ll");
});

test("unknown commands error without dispatch", () => {
    const shell = makeShell();
    assert.deepStrictEqual(shell.execute("warp 9"), [
        { kind: "error", text: "Unknown command: warp. Try help." },
    ]);
});

test("hook spine: order, interception, appended lines, exec dispatch", () => {
    const calls = [];
    const hooks = new HookBus();
    hooks.on("preExecute", (line) => calls.push(`pre:${line}`));
    hooks.on("beforeCommand", (cmd) => calls.push(`before:${cmd}`));
    hooks.on("postCommand", (cmd, args, stdin) => calls.push(`post:${cmd}:${stdin === undefined ? "undef" : JSON.stringify(stdin)}`));
    hooks.on("postExecute", () => [{ kind: "dim", text: "(tick)" }]);
    hooks.on("observePipeline", () => [{ kind: "info", text: "(seen)" }]);
    hooks.on("execDispatch", (name) => (name === "probe" ? [{ kind: "success", text: "probe ran" }] : null));

    const shell = makeShell({ hooks });
    const out = shell.execute("pwd | wc -l");
    // observePipeline lines land inside the pipeline result; postExecute after.
    assert.deepStrictEqual(out.map((o) => o.text), ["1 1 5", "(seen)", "(tick)"]);
    assert.deepStrictEqual(calls, [
        "pre:pwd | wc -l",
        "before:pwd", "post:pwd:null",
        "before:wc", 'post:wc:"/ship"',
    ]);

    calls.length = 0;
    // observePipeline fires for ./script lines too (the pre-framework emulator
    // ran its pathfind observer on every non-redirect pipeline).
    assert.deepStrictEqual(shell.execute("./probe").map((o) => o.text), ["probe ran", "(seen)", "(tick)"]);
    assert.deepStrictEqual(calls, ["pre:./probe", "before:./probe", "post:./probe:undef"]);
    assert.strictEqual(shell.execute("./ghost")[0].kind, "error");

    // interceptLine replaces the pipeline wholesale.
    hooks.on("interceptLine", (line) => (line === "42?" ? [{ kind: "magic", text: "yes" }] : null));
    assert.deepStrictEqual(shell.execute("42?").map((o) => o.text), ["yes", "(tick)"]);
});

test("bare mode skips every hook", () => {
    const hooks = new HookBus();
    let fired = false;
    hooks.on("preExecute", () => { fired = true; });
    const shell = makeShell({ hooks, bare: true });
    assert.strictEqual(textOf(shell.execute("pwd")), "/ship");
    assert.strictEqual(fired, false);
    shell.bare = false;
    shell.execute("pwd");
    assert.strictEqual(fired, true, "bare stays a live, post-hoc-settable switch");
});

test("injectables: clock, rng, encodeBase64", () => {
    const shell = makeShell({
        clock: { now: () => Date.UTC(2026, 0, 15, 12, 0, 0) },
        rng: () => 0,
    });
    assert.match(textOf(shell.execute("date")), /2026/);
    const fortune = textOf(shell.execute("fortune"));
    assert.match(fortune, /cd \.\. and try again/, "rng()=0 draws the first neutral fortune");
    assert.strictEqual(shell.encodeBase64("hi"), "aGk=");
});

test("uiText: neutral defaults, app overrides, template entries", () => {
    const neutral = makeShell();
    assert.strictEqual(neutral.text("execFileKind"), "program");
    assert.match(neutral.manBuiltinNote("ls"), /^Built-in command/);
    const branded = makeShell({
        uiText: {
            fortunes: ["Fortune favours the override."],
            manBuiltinNote: (cmd) => `See the ${cmd} chapter of the manual.`,
        },
    });
    assert.match(textOf(branded.execute("fortune")), /favours the override/);
    assert.strictEqual(branded.manBuiltinNote("ls"), "See the ls chapter of the manual.");
    assert.strictEqual(branded.text("execFileKind"), "program",
        "unset keys keep their neutral defaults");
});

test("writes into provider mounts are refused", () => {
    const shell = makeShell();
    shell.vfs.addProvider({
        prefix: "/ship/sys",
        isDir: (p) => p === "/ship/sys",
        list: () => [{ name: "uptime", type: "file", hidden: false }],
        read: (p) => (p === "/ship/sys/uptime" ? "42" : null),
    });
    assert.strictEqual(textOf(shell.execute("cat sys/uptime")), "42");
    const out = shell.execute("echo boom > sys/uptime");
    assert.strictEqual(out[0].kind, "error");
    assert.match(out[0].text, /read-only/);
    assert.strictEqual(textOf(shell.execute("cat sys/uptime")), "42");
});

test("completions cover handler names then directory entries", () => {
    const shell = makeShell();
    assert.ok(shell.completions("gr").includes("grep"));
    assert.deepStrictEqual(shell.completions("cat l"), ["log"]);
});

test("registry: buildHandlers merge order and describe metadata", () => {
    const handlers = buildHandlers(posix, { name: "x", commands: { pwd: () => [] } });
    assert.notStrictEqual(handlers.pwd, posix.commands.pwd, "later pack wins");
    assert.strictEqual(describe([posix, flavour], "cowsay").summary, "an ASCII cow speaks");
    assert.strictEqual(describe([posix], "nope"), null);
});

test("shell state defaults are framework-shaped (no game fields)", () => {
    const shell = makeShell();
    assert.deepStrictEqual(Object.keys(shell.state), [
        "cwd", "prevCwd", "aliases", "envVars", "userNodes", "history", "historyIndex", "reveals",
    ]);
    assert.strictEqual(shell.promptLabel(), "/ship $");
});
