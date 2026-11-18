"use strict";
// `map` is fog of war (issue #107): it prints exactly what the sidebar map
// (Hud.mapModel) shows; `tree` stays the real filesystem.

const test = require("node:test");
const assert = require("node:assert/strict");

const { createGameRuntime } = require("./helpers/game-harness.js");

const text = (outputs) => outputs.map((o) => o.text || "").join("\n");

// Room names a `map` reply prints, in the sidebar's "name/" form.
function printedRooms(outputs) {
    const art = outputs.find((o) => o.kind === "art").text.split("\n");
    return art.map((line, i) => {
        const name = line.replace(/^[\s│├└─]+/, "").replace(/\s+(←|░).*$/, "");
        return i === 0 ? name.split("/").pop() + "/" : name;
    });
}

function modelRows(env, runtime) {
    env.sandbox.__rt = runtime;
    const rows = JSON.parse(env.run("JSON.stringify(BashcrawlHud.mapModel(__rt).rows)"));
    delete env.sandbox.__rt;
    return rows;
}

test("after cd cellar and ./treasure, map hides library/ and lab/ and marks cellar/", () => {
    const { runtime } = createGameRuntime({ seed: 1 });
    runtime.execute("cd cellar");
    runtime.execute("./treasure");
    const out = text(runtime.execute("map"));
    assert.ok(!out.includes("library/"), out);
    assert.ok(!out.includes("lab/"), out);
    assert.match(out, /cellar\/\s+← you are here/);
    // The real filesystem is still bigger than what the player has charted.
    assert.ok(text(runtime.execute("tree /entrance")).includes("library"), "tree still shows the real filesystem");
});

test("map prints exactly the rows of Hud.mapModel, and marks fog", () => {
    const { env, runtime } = createGameRuntime({ seed: 1 });
    let sawFog = false;
    for (const line of ["map", "cd cellar", "map", "./treasure", "map", "cd armoury", "map", "cd /entrance", "map", "cd chapel", "map"]) {
        const out = runtime.execute(line);
        if (line !== "map") continue;
        const rows = modelRows(env, runtime);
        assert.deepEqual(printedRooms(out), rows.map((r) => r.name), `after ${runtime.state.cwd}`);
        const art = out.find((o) => o.kind === "art").text.split("\n");
        rows.forEach((row, i) => {
            assert.equal(art[i].includes("░ unexplored"), !row.seen && !row.here, art[i]);
            assert.equal(art[i].includes("← you are here"), row.here, art[i]);
        });
        sawFog = sawFog || rows.some((r) => !r.seen);
    }
    assert.ok(sawFog, "the scenario meets at least one fog room");
});

test("tree is the real filesystem, unchanged by fog", () => {
    const { runtime } = createGameRuntime({ seed: 1 });
    const before = text(runtime.execute("tree"));
    runtime.execute("cd cellar");
    runtime.execute("./treasure");
    runtime.execute("cd /entrance");
    const after = text(runtime.execute("tree"));
    assert.ok(!/unexplored|you are here/.test(before + after));
    assert.ok(/armoury/.test(before) && /cellar/.test(before), "unvisited rooms are listed");
    assert.ok(after.split("\n").length >= before.split("\n").length);
});
