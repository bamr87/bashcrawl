"use strict";
// BashcrawlHud presenter contract: the shared models both renderers consume
// (web/assets/js/game.js DOM panels, termforge/node/host-tty.js TuiScreen).
// Loaded exactly like the browser loads it: vendored core + runtime.js +
// hud.js as classic scripts in one sandbox realm.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { RUNTIME_FILES, WEB_JS, loadGameData } = require("./helpers/game-harness.js");
const { loadClassic } = require("./helpers/load-classic.js");

const HUD_FILE = path.join(WEB_JS, "hud.js");

function createHudRuntime() {
    const env = loadClassic({ files: [...RUNTIME_FILES, HUD_FILE] });
    const data = loadGameData();
    env.sandbox.__data = data;
    const runtime = env.run("new BashcrawlRuntime.Runtime(__data)");
    delete env.sandbox.__data;
    return { env, data, runtime, hud: env.sandbox.BashcrawlHud };
}

test("bar() renders clamped fill segments", () => {
    const { hud } = createHudRuntime();
    assert.equal(hud.bar(0, 100, 10), "░".repeat(10));
    assert.equal(hud.bar(100, 100, 10), "█".repeat(10));
    assert.equal(hud.bar(50, 100, 10), "█".repeat(5) + "░".repeat(5));
    assert.equal(hud.bar(-20, 100, 10), "░".repeat(10));
    assert.equal(hud.bar(500, 100, 10), "█".repeat(10));
});

test("snapshot + diffEvents surface xp/item/quest transitions from real play", () => {
    const { runtime, hud } = createHudRuntime();
    const before = hud.snapshot(runtime);
    assert.equal(before.hp, 100);
    assert.equal(before.inventory.length, 0);

    runtime.execute("pwd"); // first-steps achievement (+XP) at minimum
    const afterPwd = hud.snapshot(runtime);
    assert.ok(afterPwd.xp > before.xp, "pwd should award XP");
    const events = hud.diffEvents(before, afterPwd);
    assert.ok(events.some((e) => e.type === "xp" && e.amount === afterPwd.xp - before.xp));

    runtime.execute("cd cellar");
    runtime.execute("./treasure");
    const afterLoot = hud.snapshot(runtime);
    assert.ok(afterLoot.inventory.length > afterPwd.inventory.length, "treasure should add loot");
    const lootEvents = hud.diffEvents(afterPwd, afterLoot);
    const item = lootEvents.find((e) => e.type === "item");
    assert.ok(item, "expected an item event");
    assert.ok(item.items.length >= 1);
});

test("diffEvents reports damage and levelup transitions", () => {
    const { runtime, hud } = createHudRuntime();
    const before = hud.snapshot(runtime);
    runtime.state.hp -= 7;
    const hurt = hud.snapshot(runtime);
    const damage = hud.diffEvents(before, hurt).find((e) => e.type === "damage");
    assert.ok(damage);
    assert.equal(damage.amount, 7);

    runtime.state.xp += 500;
    runtime.state.rankIndex += 1;
    const promoted = hud.snapshot(runtime);
    const levelup = hud.diffEvents(hurt, promoted).find((e) => e.type === "levelup");
    assert.ok(levelup, "rankIndex increase should emit a levelup event");
    assert.ok(levelup.text.includes("★"));
});

test("questModel mirrors the quest chain and side objectives", () => {
    const { runtime, hud } = createHudRuntime();
    const quest = hud.questModel(runtime);
    assert.ok(quest.mainTotal > 0);
    assert.equal(quest.rows.length, quest.mainTotal);
    assert.equal(quest.mainDone, 0);
    assert.ok(quest.current && typeof quest.current.title === "string");
    assert.equal(quest.side.length, hud.SIDE_QUESTS.length);
    assert.ok(quest.side.every((s) => s.done === false), "no side quests done at boot");
    assert.equal(quest.rows.filter((r) => r.status === "active").length, 1);
});

test("ensureVisited records the room trail idempotently", () => {
    const { runtime, hud } = createHudRuntime();
    hud.ensureVisited(runtime);
    const first = runtime.state.visited.slice();
    hud.ensureVisited(runtime);
    assert.deepEqual(runtime.state.visited, first);
    assert.ok(first.includes("/entrance"));
});

test("mapModel applies fog of war: frontier rooms appear, unvisited stay fogged", () => {
    const { runtime, hud } = createHudRuntime();
    hud.ensureVisited(runtime);
    const atStart = hud.mapModel(runtime);
    const cellar = atStart.rows.find((r) => r.name === "cellar/");
    assert.ok(cellar, "cellar door is visible from the entrance");
    assert.equal(cellar.seen, false, "cellar not yet visited -> fog");
    assert.ok(!atStart.rows.some((r) => r.name === "armoury/"), "armoury undiscovered at boot");
    assert.ok(atStart.rows.find((r) => r.here).name.includes("entrance"));

    runtime.execute("cd cellar");
    hud.ensureVisited(runtime);
    const inCellar = hud.mapModel(runtime);
    assert.equal(inCellar.rows.find((r) => r.name === "cellar/").here, true);
    assert.ok(inCellar.rows.some((r) => r.name === "armoury/"), "armoury door discovered");
    assert.ok(inCellar.explored >= 2);
});

test("roomModel and vignettes describe the current room", () => {
    const { runtime, hud } = createHudRuntime();
    const room = hud.roomModel(runtime);
    assert.equal(room.path, "/entrance");
    assert.equal(room.vignette.key, "entrance");
    assert.ok(Array.isArray(room.vignette.art) && room.vignette.art.length > 0);
    assert.ok(room.entries.some((e) => e.name === "scroll"));
    const dir = room.entries.find((e) => e.type === "dir");
    assert.ok(dir && dir.marker === "/" && dir.icon.length > 0);
});

test("panels() emits the full sidebar spec with kind/text lines", () => {
    const { runtime, hud } = createHudRuntime();
    hud.ensureVisited(runtime);
    const panels = hud.panels(runtime, { width: 28 });
    const titles = panels.map((p) => p.title);
    for (const expected of ["HERO", "VITALS", "QUEST", "PACK", "MAP", "ROOM"]) {
        assert.ok(titles.some((t) => t.includes(expected)), `missing panel ${expected}`);
    }
    for (const panel of panels) {
        assert.ok(panel.lines.length > 0, `${panel.title} has lines`);
        for (const line of panel.lines) {
            assert.equal(typeof line.kind, "string");
            assert.equal(typeof line.text, "string");
        }
    }
    const vitals = panels.find((p) => p.title.includes("VITALS"));
    assert.ok(vitals.lines[0].text.includes("HP"));
    assert.ok(vitals.lines[0].text.includes("100/100"));
});

test("strip() compresses the HUD into one status line", () => {
    const { runtime, hud } = createHudRuntime();
    const strip = hud.strip(runtime);
    assert.equal(strip.length, 1);
    assert.ok(strip[0].text.includes("♥"));
    assert.ok(strip[0].text.includes("/entrance"));
});
