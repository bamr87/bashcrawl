"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { SessionController, Pager } = require("../core/session.js");
const { TerminalView } = require("../core/view.js");
const { validateLine } = require("../core/protocol.js");
const { fileStore } = require("../node/file-store.js");
const { createApp } = require("../apps/bashcrawl.js");
const { createGameRuntime } = require("./helpers/game-harness.js");

test("shared controller routes reset and pages, persists replacement state, and closes", () => {
    const saved = [];
    const pages = [];
    const store = { load: () => null, save: (state) => saved.push(state) };
    const session = createApp().createSession({ persistence: store, pager: true });
    const view = new TerminalView();
    const controller = new SessionController(session, { view, onPage: (text) => pages.push(text) });
    controller.execute("cd cellar");
    const old = session.runtime;
    controller.execute("reset");
    assert.notEqual(session.runtime, old);
    assert.equal(session.runtime.state.cwd, "/entrance");
    assert.equal(saved.at(-1), session.runtime.state);
    const outputs = controller.execute("less scroll");
    assert.ok(outputs.every((out) => validateLine(out).ok));
    assert.ok(pages[0].includes("ANCIENT SCROLL"));
    assert.ok(!view.lines.some((line) => line.text.includes("ANCIENT SCROLL")));
    controller.close();
    const before = saved.length;
    controller.execute("cd cellar");
    assert.equal(saved.length, before);
    assert.equal(session.runtime.state.cwd, "/entrance");
});

test("stream less and piped/redirected less produce ordinary readable output", () => {
    const session = createApp().createSession({ pager: true });
    assert.ok(!session.runtime.execute("less scroll | wc -l").some((out) => out.action));
    session.runtime.execute("less scroll > notes");
    assert.ok(session.runtime.readFile("/entrance/notes").includes("ANCIENT SCROLL"));
    const stream = createApp().createSession({ surface: "telnet" });
    assert.ok(stream.runtime.execute("less scroll").some((out) => out.text.includes("ANCIENT SCROLL")));
    assert.ok(stream.banner.some((out) => /Temporary/.test(out.text)));
    assert.ok(!stream.banner.some((out) => /fold|dock|PgUp/.test(out.text)));
});

test("pager navigation and resize clamp the offset and leave with q", () => {
    const pager = new Pager(Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n"));
    pager.resize(20, 5);
    pager.feed({ type: "char", ch: " " });
    assert.equal(pager.page()[0], "line 5");
    pager.feed({ type: "end" });
    assert.equal(pager.page().at(-1), "line 29");
    pager.resize(20, 15);
    assert.equal(pager.offset, 15);
    assert.equal(pager.feed({ type: "char", ch: "q" }), false);
});

test("a disk save reloads progress and invalid saves fail without overwriting", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "termforge-save-"));
    try {
        const file = path.join(dir, "story.json");
        const store = fileStore(file);
        const session = createApp().createSession({ persistence: store });
        const controller = new SessionController(session, { view: new TerminalView() });
        controller.execute("cd cellar");
        controller.execute("pwd");
        const restored = createApp().createSession({ persistence: store });
        assert.equal(restored.runtime.state.cwd, "/entrance/cellar");
        assert.deepEqual(restored.runtime.state.history, ["cd cellar", "pwd"]);
        assert.deepEqual(restored.runtime.state.completedQuestIds, [0]);
        fs.writeFileSync(file, '{"cwd":"/missing"}');
        assert.throws(() => createApp().createSession({ persistence: store }), /location/);
        assert.equal(fs.readFileSync(file, "utf8"), '{"cwd":"/missing"}');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("UTF-8 save tokens round-trip and invalid import keeps the current state", () => {
    const { runtime } = createGameRuntime();
    runtime.execute("echo café界😀 > notes");
    runtime.execute("cd cellar");
    const token = runtime.execute("save export")[0].text;
    runtime.execute("cd ..");
    assert.ok(runtime.execute(`save import ${token}`).some((out) => /Progress imported/.test(out.text)));
    assert.equal(runtime.state.cwd, "/entrance/cellar");
    assert.equal(runtime.readFile("/entrance/notes"), "café界😀");
    for (const invalid of [{ history: null }, { inventory: [3] }, { daily: [] }, { cwd: "/missing" }, { hp: "no" }, { completedQuestIds: ["0"] }, { speedrunBest: "1.2" }, { trainer: { active: true } }, { pathfind: { active: true } }, { stats: { commands: { pwd: "bad" } } }]) {
        const old = runtime.state;
        const bad = Buffer.from(JSON.stringify(invalid)).toString("base64");
        assert.ok(runtime.execute(`save import ${bad}`).some((out) => out.kind === "error"));
        assert.equal(runtime.state, old);
    }
});

test("rapid stream commands keep ordered output with no cursor motion", () => {
    const result = spawnSync(process.execPath, [path.resolve(__dirname, "../node/host-tty.js"), "--no-hud"], {
        input: "pwd\nls\necho café界😀\necho final-sentinel\n",
        encoding: "utf8", env: { ...process.env, BASHCRAWL_SAVE_FILE: "" }, timeout: 5000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /café界😀/);
    assert.match(result.stdout, /final-sentinel/);
    assert.ok(result.stdout.indexOf("café界😀") < result.stdout.indexOf("final-sentinel"));
    assert.ok(!result.stdout.includes("\u001b["));
});

test("controller reapplies capabilities after a view callback replaces the runtime", () => {
    const { runtime, data } = createGameRuntime();
    let current = runtime;
    const session = { get runtime() { return current; } };
    const view = new TerminalView({ onControl(action) {
        if (action === "reset") current = new runtime.constructor(data);
    } });
    const controller = new SessionController(session, { view, capabilities: { pager: true } });
    controller.execute("reset");
    assert.equal(current.capabilities.pager, true);
    assert.ok(controller.execute("less scroll").some((out) => out.action === "page"));
});

test("large portable saves import through the controller without copying tokens to history or logs", () => {
    const session = createApp().createSession();
    session.runtime.state.userNodes["/entrance/notes"] = { type: "file", content: "界".repeat(30000) };
    const token = session.runtime.execute("save export")[0].text;
    assert.ok(token.length > 4096);
    const target = createApp().createSession();
    const view = new TerminalView();
    const controller = new SessionController(target, { view });
    assert.ok(controller.execute(`save import ${token}`, { echo: true }).some((out) => out.kind === "success"));
    assert.equal(target.runtime.readFile("/entrance/notes"), "界".repeat(30000));
    assert.ok(!view.lines.some((out) => out.text.includes(token)));
    controller.execute("save import invalid-secret-token", { echo: true });
    assert.equal(target.runtime.state.history.at(-1), "save import [token]");
    assert.ok(!view.lines.some((out) => out.text.includes("invalid-secret-token")));
    assert.ok(controller.execute("echo " + "x".repeat(4096)).some((out) => out.kind === "error"));
});

test("active training and path-finding sessions restore and continue", () => {
    for (const command of ["train", "speedrun", "pathfind"]) {
        const { runtime, data } = createGameRuntime();
        runtime.execute(command);
        // The arena intercepts ordinary commands, so serialize the live state.
        const encoded = Buffer.from(JSON.stringify(runtime.state)).toString("base64");
        const target = new runtime.constructor(data);
        assert.ok(target.execute(`save import ${encoded}`).some((out) => out.kind === "success"));
        const outputs = target.execute(command === "pathfind" ? "pathfind" : "hint");
        assert.ok(!outputs.some((out) => out.kind === "error"));
    }
});
