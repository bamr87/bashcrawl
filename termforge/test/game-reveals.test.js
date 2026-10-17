"use strict";
// Encounters inside a revealed room must work from the room's VISIBLE path.
// A reveal aliases `/entrance/chapel` -> `/entrance/.chapel` (mirroring the
// terminal game's `mv .chapel chapel`), while world.encounters stays keyed by
// the stored, dotted path — so every encounter lookup has to translate the
// visible cwd through actual() first (bamr87/bashcrawl#96).

const test = require("node:test");
const assert = require("node:assert");
const { createGameRuntime } = require("./helpers/game-harness.js");

function play(lines) {
    const { runtime } = createGameRuntime({ seed: 1 });
    const out = {};
    for (const line of lines) out[line] = runtime.execute(line).map((o) => o.text);
    return { runtime, out };
}

// `./treasure` in the cellar reveals chapel + vault; `./goblet` reveals rift.
const REVEAL = ["cd cellar", "./treasure", "cd /entrance"];

test("file + ./script run from a revealed room's visible path", () => {
    const { runtime, out } = play([
        ...REVEAL, "cd chapel", "cd courtyard", "file rags", "./rags", "./fountain",
        "cd aviary", "file crystal", "./crystal",
    ]);
    assert.strictEqual(out["cd courtyard"][0], "Moved to /entrance/chapel/courtyard");
    assert.strictEqual(out["file rags"][0], "rags: executable script (loot)");
    assert.ok(out["./rags"].includes("🐟 Tattered rags with a fish inside"), out["./rags"].join("\n"));
    assert.ok(out["./rags"].includes("Inventory gained: fish"));
    assert.ok(out["./fountain"].includes("⛲ A magical fountain — beware the curse"), out["./fountain"].join("\n"));
    assert.strictEqual(out["file crystal"][0], "crystal: executable script (loot)");
    assert.ok(out["./crystal"].includes("Inventory gained: crystal"), out["./crystal"].join("\n"));
    assert.ok(runtime.state.inventory.includes("fish"));
});

test("encounters under revealed vault/ and rift/ run by their visible paths", () => {
    const { runtime, out } = play([
        ...REVEAL, "cd vault", "cd stronghold", "./goblet",
        "cd /entrance", "cd rift", "file box", "./box",
    ]);
    assert.ok(out["./goblet"].includes("Inventory gained: goblet"), out["./goblet"].join("\n"));
    assert.strictEqual(out["file box"][0], "box: executable script (puzzle)");
    assert.ok(out["./box"].includes("Inventory gained: armour"), out["./box"].join("\n"));
    assert.ok(runtime.state.inventory.includes("goblet"));
    assert.ok(runtime.state.inventory.includes("armour"));
});

test("the dotted stored path still runs encounters after a reveal", () => {
    const { runtime, out } = play([...REVEAL, "cd /entrance/.chapel/courtyard", "./rags"]);
    assert.ok(out["./rags"].includes("Inventory gained: fish"), out["./rags"].join("\n"));
    assert.ok(runtime.state.inventory.includes("fish"));
});
