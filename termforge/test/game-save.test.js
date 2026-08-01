"use strict";
// Save-compatibility contract for the `bashcrawl-web-state-v1` localStorage
// save. Two guarantees:
//
//   1. defaultState() keeps the exact shape AND key order of the committed
//      fixture (key order matters: JSON.stringify output is what gets stored,
//      and byte-stable saves make drift diffable).
//   2. A legacy save captured from the pre-refactor runtime still loads
//      through storage.js's real merge path and plays on unchanged.

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { FIXTURES_DIR, createGameRuntime } = require("./helpers/game-harness.js");

const SAVE_DIR = path.join(FIXTURES_DIR, "save");
const STORAGE_KEY = "bashcrawl-web-state-v1";

function readFixture(name) {
    return fs.readFileSync(path.join(SAVE_DIR, name), "utf8");
}

test("defaultState() matches the committed shape, including key order", () => {
    const { env } = createGameRuntime({ seed: 1 });
    const current = env.run("JSON.stringify(BashcrawlRuntime.defaultState('/entrance'), null, 2)") + "\n";
    assert.strictEqual(
        current,
        readFixture("defaults-current.json"),
        "defaultState() drifted from fixtures/save/defaults-current.json — " +
        "this would change the persisted save shape (bashcrawl-web-state-v1)",
    );
});

test("a legacy v1 save loads through storage.js and plays on", () => {
    const legacy = JSON.parse(readFixture("save-v1-legacy.json"));
    const { runtime } = createGameRuntime({
        seed: 7,
        withStorage: true,
        localStorageData: { [STORAGE_KEY]: JSON.stringify(legacy) },
        stateExpr: "BashcrawlStorage.load(() => BashcrawlRuntime.defaultState(__data.world.root))",
    });

    // Everything the legacy save carried survives the merge.
    assert.strictEqual(runtime.state.xp, legacy.xp);
    assert.strictEqual(runtime.state.hp, legacy.hp);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(runtime.state.inventory)), legacy.inventory);
    assert.deepStrictEqual(
        JSON.parse(JSON.stringify(runtime.state.completedQuestIds)),
        legacy.completedQuestIds,
    );
    assert.deepStrictEqual(JSON.parse(JSON.stringify(runtime.state.reveals)), legacy.reveals);
    assert.strictEqual(runtime.state.cwd, legacy.cwd);

    // Read-only commands must not disturb loaded progress (stats counters are
    // the one thing every dispatch legitimately bumps, so compare without them).
    const stripStats = (state) => {
        const copy = JSON.parse(JSON.stringify(state));
        delete copy.stats;
        return copy;
    };
    const before = JSON.stringify(stripStats(runtime.state));
    for (const line of ["inventory", "status", "echo $I"]) {
        const outputs = runtime.execute(line);
        assert.ok(!outputs.some((o) => o.kind === "error"), `\`${line}\` errored on a legacy save`);
    }
    assert.strictEqual(JSON.stringify(stripStats(runtime.state)), before,
        "read-only commands mutated a freshly loaded legacy save");

    // The revealed room from the legacy save is still walkable.
    const cdOut = runtime.execute("cd /entrance/chapel");
    assert.ok(cdOut.some((o) => o.kind === "success"), "revealed room from legacy save not walkable");

    // And the state still serializes (what storage.save would persist).
    assert.ok(JSON.stringify(runtime.state).length > 0);
});
