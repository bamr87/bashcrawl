"use strict";
// Story progression (issue #106): the story ladder is not the arena ladder,
// rank follows the quest line, one command never fires two LEVEL UPs, and
// `xp`, the HUD and `profile` read one scale.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { FIXTURES_DIR, RUNTIME_FILES, loadGameData, createGameRuntime } = require("./helpers/game-harness.js");
const { loadClassic } = require("./helpers/load-classic.js");

const HUD_FILE = path.join(__dirname, "..", "..", "web", "assets", "js", "hud.js");
const LEGACY = path.join(FIXTURES_DIR, "save", "save-v1-legacy.json");

function hudRuntime(stateExpr) {
    const env = loadClassic({ files: [...RUNTIME_FILES, HUD_FILE], seed: 1 });
    env.sandbox.__data = loadGameData();
    const runtime = env.run(`new BashcrawlRuntime.Runtime(__data${stateExpr ? `, ${stateExpr}` : ""})`);
    delete env.sandbox.__data;
    return { env, runtime, hud: env.sandbox.BashcrawlHud };
}

const levelUps = (outputs) => outputs.filter((o) => o.kind === "control" && o.action === "levelup").length;

test("pwd, ls, cd cellar on a fresh save never reach the top rank", () => {
    const { runtime } = createGameRuntime({ seed: 1 });
    const top = runtime.catalog.ranks[runtime.catalog.ranks.length - 1].title;
    let total = 0;
    for (const line of ["pwd", "ls", "cd cellar"]) {
        const out = runtime.execute(line);
        assert.ok(levelUps(out) <= 1, `${line}: at most one LEVEL UP`);
        total += levelUps(out);
        assert.ok(!out.some((o) => /You are now Archmage/.test(o.text || "")), line);
    }
    assert.notEqual(runtime.rankFor(runtime.state.xp).title, top);
    assert.ok(total <= 1, `at most one rank-up in three commands (saw ${total})`);
});

test("the top story rank needs every main quest, however much XP", () => {
    const { runtime } = createGameRuntime({ seed: 1 });
    const ranks = runtime.catalog.ranks;
    const top = ranks[ranks.length - 1];
    const last = runtime.quests.length - 1;
    runtime.state.completedQuestIds = runtime.quests.map((_, i) => i).filter((i) => i !== last);
    runtime.state.xp = 1000000;
    assert.notEqual(runtime.rankFor(runtime.state.xp).title, top.title);
    runtime.state.completedQuestIds.push(last);
    assert.equal(runtime.rankFor(runtime.state.xp).title, top.title);
    assert.ok(top.min > 0 && top.quests === runtime.quests.length);
});

test("the arena scores a run on its own ladder", () => {
    const { runtime } = createGameRuntime({ seed: 1 });
    assert.notDeepEqual(runtime.catalog.arenaRanks, runtime.catalog.ranks);
    assert.equal(runtime.rankFor(190, runtime.catalog.arenaRanks).title, "Archmage of the Command Line");
    assert.notEqual(runtime.rankFor(190).title, "Archmage of the Command Line");
});

test("the daily goal is not met by the first command, whichever bucket the day lands in", () => {
    const probe = createGameRuntime({ seed: 1 });
    const dailyGoalFor = probe.env.run("BashcrawlPlugins.daily.dailyGoalFor");
    const days = new Map();
    for (let d = 1; d <= 28; d++) {
        const day = `2026-02-${String(d).padStart(2, "0")}`;
        if (!days.has(dailyGoalFor(day))) days.set(dailyGoalFor(day), day);
    }
    assert.equal(days.size, 4, "all four goal buckets exercised");
    for (const [goal, day] of days) {
        for (const first of ["pwd", "ls", "cd cellar"]) {
            const { runtime } = createGameRuntime({ seed: 1, clockStart: new Date(`${day}T12:00:00`).getTime() });
            runtime.execute(first);
            assert.equal(runtime.state.daily.goal, goal);
            assert.equal(runtime.state.daily.completed, false, `${day} (${goal} XP) after ${first}`);
        }
    }
});

test("xp, the HUD Lv line and profile report one progression scale", () => {
    const { runtime, hud } = hudRuntime();
    for (const [xp, quests] of [[0, 0], [55, 1], [180, 3], [260, 4], [520, 6], [2000, 7], [2000, 8]]) {
        runtime.state.xp = xp;
        runtime.state.completedQuestIds = Array.from({ length: quests }, (_, i) => i);
        const model = hud.heroModel(runtime);
        const status = hud.statusModel(runtime);
        const line = runtime.execute("xp").map((o) => o.text).join("\n");
        assert.match(line, new RegExp(`^Level ${model.level}\\b`), `xp ${xp}/${quests}`);
        assert.equal(status.level, model.level);
        assert.equal(status.rank, model.rank);
        assert.ok(runtime.execute("profile").some((o) => o.text && o.text.includes(`Rank:  ${model.rank}`)));
        assert.ok(model.level === runtime.catalog.ranks.findIndex((r) => r.title === model.rank) + 1);
        if (status.nextRank) assert.ok(status.nextRank.remaining >= 0);
        assert.ok(model.into <= model.span);
    }
});

test("a legacy save is re-baselined to the new ladder: no LEVEL UP, no negative remaining", () => {
    const legacy = JSON.parse(fs.readFileSync(LEGACY, "utf8"));
    assert.equal(legacy.rankIndex, 4, "fixture is write-once and carries the old baseline");
    for (const save of [legacy, { ...legacy, xp: 205, completedQuestIds: [0, 1, 2], rankIndex: 4 }]) {
        const { env, data } = createGameRuntime({ seed: 7 });
        env.sandbox.__save = JSON.stringify(save);
        env.sandbox.__data = data;
        const runtime = env.run("new BashcrawlRuntime.Runtime(__data, BashcrawlRuntime.loadState(__data.world, JSON.parse(__save), __data.progression))");
        const idx = runtime.catalog.ranks.indexOf(runtime.rankFor(save.xp));
        assert.equal(runtime.state.rankIndex, idx, "rankIndex re-baselined on load");
        for (const line of ["pwd", "ls"]) assert.equal(levelUps(runtime.execute(line)), 0, `${line}: no retroactive LEVEL UP`);
        assert.equal(runtime.state.rankIndex, idx);
    }
});
