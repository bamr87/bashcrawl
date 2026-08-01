"use strict";
// Unit tests for termforge/core/vfs.js — loaded via require() (the node/CJS
// half of the dual-mode header; the browser half is exercised by the golden
// suite, which loads the vendored copy as a classic script).

const test = require("node:test");
const assert = require("node:assert");
const { createVfs } = require("../core/vfs.js");
const { defaultShellState, mergeSavedState } = require("../core/state.js");

function fixtureWorld() {
    return {
        root: "/keep",
        directories: {
            "/keep": [
                { name: "scroll", type: "file", hidden: false },
                { name: "cellar", type: "dir", hidden: false },
                { name: ".vault", type: "dir", hidden: true },
                { name: ".note", type: "file", hidden: true },
            ],
            "/keep/cellar": [{ name: "map", type: "file", hidden: false }],
            "/keep/.vault": [
                { name: "gold", type: "file", hidden: false },
                { name: ".crypt", type: "dir", hidden: true },
            ],
            "/keep/.vault/.crypt": [{ name: "bones", type: "file", hidden: false }],
        },
        files: {
            "/keep/scroll": "read me",
            "/keep/cellar/map": "x marks",
            "/keep/.vault/gold": "shiny",
            "/keep/.vault/.crypt/bones": "rattle",
        },
        rooms: { "/keep": { title: "The Keep" }, "/keep/.vault": { title: "Hidden Vault" } },
    };
}

function makeVfs(stateOverrides = {}) {
    const state = { ...defaultShellState("/keep"), ...stateOverrides };
    const vfs = createVfs(fixtureWorld(), { getState: () => state });
    return { vfs, state };
}

test("resolve handles relative, absolute, dot and dot-dot paths", () => {
    const { vfs } = makeVfs();
    assert.strictEqual(vfs.resolve("cellar", "/keep"), "/keep/cellar");
    assert.strictEqual(vfs.resolve(".", "/keep/cellar"), "/keep/cellar");
    assert.strictEqual(vfs.resolve("..", "/keep/cellar"), "/keep");
    assert.strictEqual(vfs.resolve("../..", "/keep/cellar"), "/");
    assert.strictEqual(vfs.resolve("/keep/cellar/../scroll", "/anywhere"), "/keep/scroll");
    assert.strictEqual(vfs.resolve("a//b///c", "/keep"), "/keep/a/b/c");
});

test("userNodes overlay shadows world files and peels back off", () => {
    const { vfs, state } = makeVfs();
    assert.strictEqual(vfs.readFile("/keep/scroll"), "read me");
    state.userNodes["/keep/scroll"] = { type: "file", content: "overwritten" };
    assert.strictEqual(vfs.readFile("/keep/scroll"), "overwritten");
    delete state.userNodes["/keep/scroll"];
    assert.strictEqual(vfs.readFile("/keep/scroll"), "read me", "world original shows through after rm");
});

test("reveals translate visible paths longest-prefix-first", () => {
    const { vfs, state } = makeVfs();
    state.reveals["/keep/vault"] = "/keep/.vault";
    assert.strictEqual(vfs.actual("/keep/vault"), "/keep/.vault");
    assert.strictEqual(vfs.actual("/keep/vault/gold"), "/keep/.vault/gold");
    assert.strictEqual(vfs.readFile("/keep/vault/gold"), "shiny");
    assert.ok(vfs.isDir("/keep/vault"));
    // Nested reveal: the longer visible prefix must win.
    state.reveals["/keep/vault/crypt"] = "/keep/.vault/.crypt";
    assert.strictEqual(vfs.actual("/keep/vault/crypt/bones"), "/keep/.vault/.crypt/bones");
    assert.strictEqual(vfs.readFile("/keep/vault/crypt/bones"), "rattle");
});

test("entries: hidden filtering, un-dotting of revealed rooms, userNode merge, sorting", () => {
    const { vfs, state } = makeVfs();
    assert.deepStrictEqual(vfs.entries("/keep", false).map((e) => e.name), ["cellar", "scroll"]);
    assert.deepStrictEqual(
        vfs.entries("/keep", true).map((e) => e.name),
        [".note", ".vault", "cellar", "scroll"],
    );
    state.reveals["/keep/vault"] = "/keep/.vault";
    const revealed = vfs.entries("/keep", false);
    assert.deepStrictEqual(revealed.map((e) => e.name), ["cellar", "scroll", "vault"]);
    assert.strictEqual(revealed.find((e) => e.name === "vault").hidden, false);
    state.userNodes["/keep/torch"] = { type: "file", content: "" };
    state.userNodes["/keep/.secret"] = { type: "file", content: "" };
    assert.deepStrictEqual(
        vfs.entries("/keep", false).map((e) => e.name),
        ["cellar", "scroll", "torch", "vault"],
    );
    assert.ok(vfs.entries("/keep", true).some((e) => e.name === ".secret"));
});

test("findHiddenDir locates dotted rooms without recording anything", () => {
    const { vfs, state } = makeVfs();
    assert.deepStrictEqual(vfs.findHiddenDir("vault"), {
        visiblePath: "/keep/vault",
        realPath: "/keep/.vault",
    });
    assert.strictEqual(vfs.findHiddenDir("nonexistent"), null);
    assert.deepStrictEqual(state.reveals, {}, "findHiddenDir must not mutate state");
});

test("roomMeta follows reveals", () => {
    const { vfs, state } = makeVfs();
    assert.strictEqual(vfs.roomMeta("/keep").title, "The Keep");
    state.reveals["/keep/vault"] = "/keep/.vault";
    assert.strictEqual(vfs.roomMeta("/keep/vault").title, "Hidden Vault");
    assert.deepStrictEqual(vfs.roomMeta("/nowhere"), {});
});

test("getState thunk survives wholesale state replacement (reset)", () => {
    let state = defaultShellState("/keep");
    const vfs = createVfs(fixtureWorld(), { getState: () => state });
    state.userNodes["/keep/torch"] = { type: "file", content: "lit" };
    assert.strictEqual(vfs.readFile("/keep/torch"), "lit");
    state = defaultShellState("/keep");
    assert.strictEqual(vfs.readFile("/keep/torch"), null, "reset state must drop user nodes");
});

test("providers: longest mount wins, mounts list in parents, reads are provider-owned", () => {
    const { vfs } = makeVfs();
    vfs.addProvider({
        prefix: "/keep/proc",
        isDir: (p) => p === "/keep/proc",
        list: (p) => (p === "/keep/proc"
            ? [
                { name: "uptime", type: "file", hidden: false },
                { name: "load", type: "file", hidden: false },
            ]
            : null),
        read: (p) => (p === "/keep/proc/uptime" ? "42 days" : p === "/keep/proc/load" ? "0.17" : null),
    });
    vfs.addProvider({
        prefix: "/keep/proc/deep",
        isDir: (p) => p === "/keep/proc/deep",
        list: () => [],
        read: () => "nested wins",
    });
    assert.ok(vfs.isDir("/keep/proc"));
    assert.deepStrictEqual(vfs.entries("/keep/proc").map((e) => e.name), ["load", "uptime"]);
    assert.strictEqual(vfs.readFile("/keep/proc/uptime"), "42 days");
    assert.strictEqual(vfs.node("/keep/proc/uptime").type, "file");
    assert.strictEqual(vfs.node("/keep/proc/nope"), null);
    // Longest prefix takes precedence.
    assert.strictEqual(vfs.readFile("/keep/proc/deep/anything"), "nested wins");
    // The mount shows up as a directory in its parent's listing.
    assert.ok(vfs.entries("/keep").some((e) => e.name === "proc" && e.type === "dir"));
    // providerFor exposes ownership (Shell uses this to refuse writes).
    assert.ok(vfs.providerFor("/keep/proc/uptime"));
    assert.strictEqual(vfs.providerFor("/keep/scroll"), null);
});

test("mergeSavedState mirrors storage.js semantics", () => {
    const base = { ...defaultShellState("/keep"), stats: { a: 1, b: 2 } };
    const merged = mergeSavedState(base, {
        cwd: "/keep/cellar",
        envVars: { TORCH: "lit" },
        stats: { b: 9 },
        history: ["ls"],
    });
    assert.strictEqual(merged.cwd, "/keep/cellar");
    assert.deepStrictEqual(merged.envVars, { TORCH: "lit" });
    assert.deepStrictEqual(merged.stats, { a: 1, b: 9 }, "object fields merge key-by-key");
    assert.deepStrictEqual(merged.history, ["ls"], "arrays replace wholesale");
    assert.strictEqual(merged.historyIndex, -1, "missing saved fields keep defaults");
    assert.strictEqual(mergeSavedState(base, null), base);
    assert.strictEqual(mergeSavedState(base, "bogus"), base);
});
