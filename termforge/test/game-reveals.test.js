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

// Nested reveals: a hidden room inside an already-revealed room must be keyed
// by the visible parent path, or `cd study` fails after ./tome (#104).
const LIBRARY = "cd /entrance/chapel/courtyard/aviary/hall/library";

test("./tome reveals study/ so `cd study` and `ls` work by its visible name", () => {
    const { runtime, out } = play([...REVEAL, LIBRARY, "./tome", "ls", "cd study"]);
    assert.ok(out["./tome"].includes("🔓 A new passage opens: study/"), out["./tome"].join("\n"));
    assert.match(out.ls.join("\n"), /\bstudy\b/);
    assert.doesNotMatch(out.ls.join("\n"), /\.study/);
    assert.strictEqual(out["cd study"][0], "Moved to /entrance/chapel/courtyard/aviary/hall/library/study");
    assert.ok(runtime.state.reveals["/entrance/chapel/courtyard/aviary/hall/library/study"]);
});

test("vfs.visible() is the inverse of actual() across nested reveals", () => {
    const { runtime } = play([...REVEAL, LIBRARY, "./tome"]);
    const real = "/entrance/.chapel/courtyard/aviary/hall/library/.study/grimoire";
    const vis = runtime.vfs.visible(real);
    assert.strictEqual(vis, "/entrance/chapel/courtyard/aviary/hall/library/study/grimoire");
    assert.strictEqual(runtime.actual(vis), real);
});

// Quest 7 needs amulet + coins; the game must say so instead of soft-locking (#103).
// The issue's repro: quests 0-6 done, but the off-path chamber (coins) skipped.
const PREP = [
    "pwd", "ls", "cd cellar", "cat scroll", "./treasure", "cd armoury", "./treasure",
    "cd /entrance", "mkdir workshop", "cd workshop", "touch notes.txt",
    "cd /entrance/cellar", "grep catacombs scroll",
];
const GRIMOIRE = [LIBRARY, "./tome", "cd study", "./grimoire", "source grimoire"];

test("source grimoire without coins names the missing item and does not claim the quest", () => {
    const { runtime, out } = play([...PREP, ...GRIMOIRE, "hint", "quest"]);
    const src = out["source grimoire"].join("\n");
    const q = runtime.quests[runtime.state.currentQuestId];
    assert.strictEqual(q && q.id, 7, "quest 7 should be the active (stalled) quest");
    assert.doesNotMatch(src, /quest ready/);
    assert.match(src, /You still need: coins/);
    assert.match(out.hint.join("\n"), /You still need: coins/);
    assert.match(out.quest.join("\n"), /You still need: coins/);
    assert.match(q.hint, /coins/);
});

test("fetching the coins and sourcing again completes the final quest (no softlock)", () => {
    const { runtime, out } = play([
        ...PREP, ...GRIMOIRE,
        "cd /entrance/cellar/armoury/chamber", "./treasure",
        "cd /entrance/chapel/courtyard/aviary/hall/library/study", "source grimoire",
    ]);
    assert.ok(runtime.state.completedQuestIds.includes(7), JSON.stringify(runtime.state.completedQuestIds));
    assert.strictEqual(runtime.quests[runtime.state.currentQuestId], undefined);
    assert.ok(out["source grimoire"].join("\n").length > 0);
});

test("with coins, source grimoire says the quest is ready", () => {
    const { out } = play([
        ...PREP, "cd /entrance/cellar/armoury/chamber", "./treasure",
        ...GRIMOIRE,
    ]);
    assert.match(out["source grimoire"].join("\n"), /Scriptorium quest ready/);
});

test("the study's web room panel only suggests commands the web port supports", () => {
    const { runtime } = play([...REVEAL, LIBRARY, "./tome", "cd study"]);
    const meta = runtime.currentRoomMeta();
    const text = JSON.stringify([meta.next_steps, meta.essential_commands, meta.hint]);
    assert.doesNotMatch(text, /cd portal|init_help/);
    assert.match(text, /source grimoire/);
});
