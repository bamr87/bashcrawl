"use strict";
// `hint` knows where the player is, and repeated failures get a nudge (#105).
//
//   - When the active quest names a room and the player is elsewhere, `hint`
//     adds the next `cd` step of the shortest route through rooms the player
//     can enter now; following it repeatedly reaches the quest's room.
//   - A quest room that is still hidden routes to the room whose encounter
//     opens it (the library's tome opens the study), never to the room itself.
//   - Three failing command lines in a row append one dim "Stuck?" line; a
//     clean line resets the count; arena answers are not commands.

const test = require("node:test");
const assert = require("node:assert");
const { createGameRuntime } = require("./helpers/game-harness.js");

const STUCK = /^Stuck\? Try `hint`/;

function game() {
    const { runtime } = createGameRuntime({ seed: 1 });
    const run = (line) => runtime.execute(line);
    const text = (line) => run(line).map((o) => o.text || "").join("\n");
    return { runtime, run, text };
}

function playAll(g, lines) {
    for (const line of lines) g.run(line);
}

function nextStep(g) {
    const m = g.text("hint").match(/Next: cd (\S+)/);
    return m ? m[1] : null;
}

// Follow `hint` until it stops giving a step; returns the steps taken.
function followHints(g, limit = 12) {
    const steps = [];
    for (let i = 0; i < limit; i += 1) {
        const step = nextStep(g);
        if (!step) return steps;
        steps.push(step);
        const out = g.run(`cd ${step}`);
        assert.ok(!out.some((o) => o.kind === "error"), `hint step "cd ${step}" failed: ${JSON.stringify(out)}`);
    }
    assert.fail(`hint kept giving steps after ${limit} moves: ${steps.join(", ")}`);
    return steps;
}

// Quests 0-5 done, the cellar treasure run (chapel, vault and scrap revealed);
// quest 6 (grep in the cellar or armoury) is active, the player is in the vault.
const TO_QUEST_6 = [
    "pwd", "ls", "cd cellar", "cat scroll", "./treasure", "cd ..",
    "mkdir workshop", "cd workshop", "touch notes.txt", "cd ..", "cd vault",
];

// Hidden room names (their dotted world directories), for the "never names an
// unrevealed room" checks.
function hiddenRoomNames(runtime) {
    const names = new Set();
    for (const list of Object.values(runtime.world.directories)) {
        for (const entry of list) if (entry.type === "dir" && entry.hidden) names.add(entry.name.replace(/^\./, ""));
    }
    return [...names];
}

function unrevealed(runtime) {
    const revealed = new Set(Object.keys(runtime.state.reveals).map((p) => p.split("/").pop()));
    return hiddenRoomNames(runtime).filter((name) => !revealed.has(name));
}

// The lines `hint` adds on top of the quest's own text: the route and the
// room note.
function addedLines(outputs) {
    return outputs.map((o) => o.text || "").join("\n").split("\n")
        .filter((line) => /🧭|Here:/.test(line));
}

test("hint in the vault names a cd step toward the quest room, and following it arrives", () => {
    const g = game();
    playAll(g, TO_QUEST_6);
    assert.strictEqual(g.runtime.state.currentQuestId, 6);
    assert.strictEqual(g.runtime.state.cwd, "/entrance/vault");
    const hint = g.text("hint");
    assert.match(hint, /You're in the vault\. The cellar is 2 rooms away, at \/entrance\/cellar\. Next: cd \.\./);
    assert.deepStrictEqual(followHints(g), ["..", "cellar"]);
    assert.strictEqual(g.runtime.state.cwd, "/entrance/cellar");
    assert.doesNotMatch(g.text("hint"), /Next: cd/, "no step once the player stands in the quest room");
});

test("hint gives no route when the player already satisfies the quest's location", () => {
    const g = game();
    playAll(g, [...TO_QUEST_6, "cd /entrance/cellar/armoury"]);
    assert.doesNotMatch(g.text("hint"), /🧭/);
});

test("a hidden quest room routes to the encounter that opens it, then to the room once revealed", () => {
    const g = game();
    playAll(g, [...TO_QUEST_6, "cd /entrance/cellar", "grep catacombs scroll", "cd /entrance/vault"]);
    assert.strictEqual(g.runtime.state.currentQuestId, 7);
    const before = g.text("hint");
    assert.match(before, /The way on starts in the library \(\.\/tome\), 6 rooms away, at \/entrance\/chapel\/courtyard\/aviary\/hall\/library\. Next: cd \.\./);
    for (const line of addedLines(g.run("hint"))) assert.doesNotMatch(line, /study/, "the sealed study must not be named");
    assert.deepStrictEqual(followHints(g), ["..", "chapel", "courtyard", "aviary", "hall", "library"]);
    assert.match(g.text("hint"), /The way on opens from here: run \.\/tome/);

    // Fetch the coins the tome checks for, open the study, follow the hints in.
    playAll(g, ["cd /entrance/cellar/armoury/chamber", "./treasure", "cd /entrance/chapel/courtyard/aviary/hall/library", "./tome", "cd /entrance"]);
    assert.ok(g.runtime.state.reveals["/entrance/chapel/courtyard/aviary/hall/library/study"], "the tome should have opened the study");
    assert.match(g.text("hint"), /The study is 6 rooms away, at \/entrance\/chapel\/courtyard\/aviary\/hall\/library\/study\. Next: cd chapel/);
    followHints(g);
    assert.strictEqual(g.runtime.state.cwd, "/entrance/chapel/courtyard/aviary/hall/library/study");
});

test("hint never routes through or names a room that hasn't been revealed", () => {
    // Quests 0-6 done without the cellar treasure: the chapel (and the library
    // inside it) is still hidden, so there is no route and no room is named.
    const g = game();
    playAll(g, [
        "pwd", "ls", "cd cellar", "cat scroll", "cd ..", "mkdir workshop", "cd workshop",
        "touch notes.txt", "cd /entrance/cellar", "grep catacombs scroll", "cd /entrance",
    ]);
    assert.strictEqual(g.runtime.state.currentQuestId, 7);
    assert.deepStrictEqual(Object.keys(g.runtime.state.reveals), []);
    const hidden = [...unrevealed(g.runtime), "library", "courtyard", "aviary", "hall"];
    for (const room of ["/entrance", "/entrance/cellar", "/entrance/cellar/armoury", "/entrance/workshop"]) {
        g.run(`cd ${room}`);
        const out = g.run("hint");
        assert.doesNotMatch(out.map((o) => o.text).join("\n"), /Next: cd/, `no revealed route exists from ${room}`);
        for (const line of addedLines(out)) {
            for (const name of hidden) assert.ok(!line.toLowerCase().includes(name), `hint in ${room} named ${name}: ${line}`);
        }
    }

    // After the reveal: steps never take a dotted name, and the vault's room
    // note (which mentions the still-hidden Rift) is left out.
    const h = game();
    playAll(h, TO_QUEST_6);
    const vault = h.run("hint");
    assert.ok(unrevealed(h.runtime).includes("rift"));
    for (const line of addedLines(vault)) assert.doesNotMatch(line.toLowerCase(), /\brift\b/);
    assert.doesNotMatch(vault.map((o) => o.text).join("\n"), /\/\./, "no dotted path in the route");
    for (const step of followHints(h)) assert.ok(step === ".." || !step.startsWith("."), `dotted step ${step}`);
});

test("hint still adds the room's own note where it spoils nothing", () => {
    const g = game();
    const out = g.run("hint");
    assert.strictEqual(out[0].kind, "magic");
    assert.match(out[0].text, /^🔮 Awakening: Know Thy Place/);
    assert.deepStrictEqual([...out.slice(1).map((o) => o.kind)], ["dim"]);
    assert.match(out[1].text, /Here: You stand at the entrance to the catacombs\./);
});

test("three failing commands in a row produce exactly one Stuck? line", () => {
    const g = game();
    const outs = ["lgs", "cd portal", "cd study"].map((line) => g.run(line));
    const nudges = outs.map((out) => out.filter((o) => STUCK.test(o.text || "")));
    assert.deepStrictEqual(nudges.map((n) => n.length), [0, 0, 1]);
    assert.strictEqual(nudges[2][0].kind, "dim");
    assert.strictEqual(outs[2][outs[2].length - 1], nudges[2][0], "the nudge is the last line");
    // The count starts again after a nudge: a fourth failure is quiet.
    assert.ok(!g.run("lgs").some((o) => STUCK.test(o.text || "")));
    assert.strictEqual(g.runtime.state.stats.errorStreak, 1);
});

test("a successful command resets the failure count", () => {
    const g = game();
    g.run("lgs");
    g.run("lgs");
    assert.strictEqual(g.runtime.state.stats.errorStreak, 2);
    assert.ok(!g.run("pwd").some((o) => STUCK.test(o.text || "")));
    assert.strictEqual(g.runtime.state.stats.errorStreak, 0);
    const quiet = ["lgs", "lgs"].flatMap((line) => g.run(line));
    assert.ok(!quiet.some((o) => STUCK.test(o.text || "")), "two failures after a reset must not nudge");
    // An empty line is neither a failure nor a success.
    g.run("   ");
    assert.strictEqual(g.runtime.state.stats.errorStreak, 2);
    assert.ok(g.run("lgs").some((o) => STUCK.test(o.text || "")));
});

test("wrong answers in the Training Arena are not counted as stuck commands", () => {
    const g = game();
    g.run("lgs");
    g.run("train");
    assert.ok(g.runtime.state.trainer && g.runtime.state.trainer.active);
    const answers = ["blargh", "blargh", "blargh", "blargh"].flatMap((line) => g.run(line));
    assert.ok(answers.some((o) => o.kind === "error"), "the arena should reject the answers");
    assert.ok(!answers.some((o) => STUCK.test(o.text || "")), "no nudge inside the arena");
    assert.strictEqual(g.runtime.state.stats.errorStreak, 0, "`train` itself succeeded and reset the count");
});

test("the failure count is an additive save key", () => {
    const g = game();
    assert.strictEqual(g.runtime.state.stats.errorStreak, 0);
    g.run("lgs");
    g.run("lgs");
    const saved = JSON.parse(JSON.stringify(g.runtime.state));
    const load = (state) => createGameRuntime({
        seed: 1,
        withStorage: true,
        localStorageData: { "bashcrawl-web-state-v1": JSON.stringify(state) },
        stateExpr: "BashcrawlStorage.load(() => BashcrawlRuntime.defaultState(__data.world.root))",
    }).runtime;
    // A reload keeps the count: one more failure is the third in a row.
    const reloaded = load(saved);
    assert.strictEqual(reloaded.state.stats.errorStreak, 2);
    assert.ok(reloaded.execute("lgs").some((o) => STUCK.test(o.text || "")));
    // A save from before the key existed still loads, with the default.
    delete saved.stats.errorStreak;
    const old = load(saved);
    assert.strictEqual(old.state.stats.errorStreak, 0);
    assert.strictEqual(old.state.cwd, saved.cwd);
});
