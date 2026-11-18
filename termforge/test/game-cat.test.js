"use strict";
// `cat` on an encounter script prints its real source, as on a real system,
// under ONE dim line that says how to play it (bamr87/bashcrawl#114). Piped
// and redirected output stays byte-identical, so the note never reaches
// another command's stdin or a file; `cat scroll` and the Scholar counter are
// unchanged.

const test = require("node:test");
const assert = require("node:assert");
const { createGameRuntime } = require("./helpers/game-harness.js");

const TREASURE = "/entrance/cellar/treasure";
const LIBRARY = "/entrance/chapel/courtyard/aviary/hall/library";
const NOTE = /is an encounter/;

function fresh(lines = []) {
    const { runtime } = createGameRuntime({ seed: 1 });
    for (const line of lines) runtime.execute(line);
    return runtime;
}

// The runtime lives in a vm context: compare plain copies, not its objects.
function plain(o) {
    return { kind: o.kind, text: o.text };
}

function notes(out) {
    return out.filter((o) => o.kind === "dim" && NOTE.test(o.text || ""));
}

test("cat <encounter>: exactly one dim note, then the unchanged source", () => {
    const rt = fresh(["cd cellar"]);
    const source = rt.readFile(TREASURE);
    assert.ok(source.startsWith("#!/usr/bin/env bash"), "the fixture is a real script");
    const out = rt.execute("cat treasure");
    assert.strictEqual(notes(out).length, 1, JSON.stringify(out));
    assert.strictEqual(out[0].kind, "dim");
    assert.ok(!out[0].text.includes("\n"), "the note is one line");
    assert.match(out[0].text, /^treasure is an encounter/);
    assert.ok(out[0].text.includes("`./treasure`"), out[0].text);
    assert.ok(out[0].text.includes("`cat` shows its source"), out[0].text);
    assert.deepStrictEqual(plain(out[1]), { kind: "output", text: source });
});

test("the note names the visible script in a revealed room", () => {
    const rt = fresh(["cd cellar", "./treasure", `cd ${LIBRARY}`]);
    const out = rt.execute("cat tome");
    assert.strictEqual(notes(out).length, 1, JSON.stringify(out));
    assert.ok(out[0].text.includes("`./tome`"), out[0].text);
    assert.strictEqual(out[1].text, rt.readFile(`${LIBRARY}/tome`));
});

test("cat of an encounter in another room says to go there first", () => {
    const rt = fresh();
    const out = rt.execute("cat cellar/treasure");
    assert.strictEqual(notes(out).length, 1, JSON.stringify(out));
    assert.ok(out[0].text.includes("its room"), out[0].text);
    assert.ok(out[0].text.includes("`./treasure`"), out[0].text);
    assert.strictEqual(out[1].text, rt.readFile(TREASURE));
});

test("piped and redirected cat output is byte-identical (no note)", () => {
    const rt = fresh(["cd cellar"]);
    const source = rt.readFile(TREASURE);
    const head = rt.execute("cat treasure | head -1");
    assert.strictEqual(notes(head).length, 0, JSON.stringify(head));
    assert.deepStrictEqual(plain(head[0]), { kind: "output", text: source.split("\n")[0] });
    // The pipe carries exactly the file: same count as wc reading it directly.
    const piped = rt.execute("cat treasure | wc -l")[0].text;
    assert.strictEqual(`${piped} treasure`, rt.execute("wc -l treasure")[0].text);
    const wrote = rt.execute("cat treasure > copy");
    assert.strictEqual(notes(wrote).length, 0, JSON.stringify(wrote));
    assert.strictEqual(rt.readFile(rt.resolve("copy")), source);
});

test("cat scroll is unchanged and the Scholar counter counts scrolls only", () => {
    const rt = fresh(["cd cellar"]);
    const before = rt.state.stats.catScrollCount;
    const scroll = rt.execute("cat scroll");
    assert.strictEqual(notes(scroll).length, 0);
    assert.strictEqual(scroll[0].kind, "output");
    assert.strictEqual(scroll[0].text, rt.readFile("/entrance/cellar/scroll"));
    assert.strictEqual(rt.state.stats.catScrollCount, before + 1);
    rt.execute("cat treasure");
    assert.strictEqual(rt.state.stats.catScrollCount, before + 1);
});

test("no note on errors, player-written files or less", () => {
    const rt = fresh(["cd cellar"]);
    assert.strictEqual(notes(rt.execute("cat nofile")).length, 0);
    assert.strictEqual(notes(rt.execute("less treasure")).length, 0);
    rt.execute("echo hi > treasure");
    const shadowed = rt.execute("cat treasure");
    assert.strictEqual(notes(shadowed).length, 0, JSON.stringify(shadowed));
    assert.deepStrictEqual(plain(shadowed[0]), { kind: "output", text: "hi" });
});
