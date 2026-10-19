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

test("diffEvents reports move, heal, and unlock transitions", () => {
    const { runtime, hud } = createHudRuntime();
    const before = hud.snapshot(runtime);
    assert.equal(before.reveals, 0);

    runtime.execute("cd cellar");
    const moved = hud.snapshot(runtime);
    const move = hud.diffEvents(before, moved).find((e) => e.type === "move");
    assert.ok(move, "cd should emit a move event");
    assert.equal(move.to, "/entrance/cellar");

    runtime.state.hp = 80;
    const hurt = hud.snapshot(runtime);
    runtime.state.hp = 95;
    const healed = hud.snapshot(runtime);
    const heal = hud.diffEvents(hurt, healed).find((e) => e.type === "heal");
    assert.ok(heal);
    assert.equal(heal.amount, 15);

    runtime.execute("./treasure");
    const looted = hud.snapshot(runtime);
    assert.ok(looted.reveals > moved.reveals, "treasure should unlock hidden rooms");
    const unlock = hud.diffEvents(moved, looted).find((e) => e.type === "unlock");
    assert.ok(unlock, "unlocking chapel/vault/scrap should emit unlock");
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
    assert.ok(room.teaches.some((t) => /ls|cd|pwd|cat/i.test(t)));
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
    const roomPanel = panels.find((p) => p.title.includes("ROOM"));
    const roomText = roomPanel.lines.map((l) => l.text).join("\n");
    assert.ok(roomText.includes("scroll"), "ROOM panel lists the scroll");
    assert.ok(roomText.includes("cellar"), "ROOM panel lists exits");
    assert.equal(panels[0].title.includes("ROOM"), true, "ROOM leads so it survives a short sidebar");
});

test("hud layout can hide, fold, reorder, dock, and parse commands", () => {
    const { runtime, hud } = createHudRuntime();
    hud.ensureVisited(runtime);
    assert.equal(hud.parseHudLine("ls"), null);
    hud.applyAction({ op: "toggle", id: "map", field: "visible", value: false });
    let panels = hud.panels(runtime);
    assert.ok(!panels.some((p) => p.id === "map"));
    hud.applyAction({ op: "toggle", id: "quest", field: "collapsed", value: true });
    const quest = hud.panels(runtime).find((p) => p.id === "quest");
    assert.equal(quest.collapsed, true);
    assert.equal(quest.lines.length, 0);
    hud.applyAction(hud.parseHudLine("hud dock left"));
    assert.equal(hud.getLayout().dock, "left");
    hud.applyAction(hud.parseHudLine("hud reset"));
    panels = hud.panels(runtime);
    assert.equal(panels[0].id, "room");
    assert.ok(panels.some((p) => p.id === "map" && p.lines.length > 0));
});

test("strip() compresses the HUD into status plus a Here listing", () => {
    const { runtime, hud } = createHudRuntime();
    const strip = hud.strip(runtime);
    assert.equal(strip.length, 2);
    assert.ok(strip[0].text.includes("♥"));
    assert.ok(strip[0].text.includes("/entrance"));
    assert.ok(strip[1].text.includes("Here:"));
    assert.ok(strip[1].text.includes("scroll"));
});

// ── learning platform: lesson + skills panes and events ───────────────────

test("lessonModel and skillsModel follow a course, and diffEvents names what grew", () => {
    const { runtime, hud } = createHudRuntime();
    assert.deepEqual({ ...hud.lessonModel(runtime) }, { active: false, courses: runtime.courses.length, completed: 0 });
    const s0 = hud.snapshot(runtime);
    runtime.execute("learn navigator");
    runtime.execute("cd /lab/navigator");
    const s1 = hud.snapshot(runtime);
    const objective = hud.diffEvents(s0, s1).find((e) => e.type === "objective");
    assert.ok(objective, "meeting an objective emits an objective event");
    const skill = hud.diffEvents(s0, s1).find((e) => e.type === "skill");
    assert.equal(skill.text, "⬆ cd · Novice");
    runtime.execute("pwd");
    const s2 = hud.snapshot(runtime);
    assert.ok(hud.diffEvents(s1, s2).some((e) => e.type === "lesson"), "finishing a lesson emits a lesson event");
    const lesson = hud.lessonModel(runtime);
    assert.equal(lesson.course, "Finding Your Way");
    assert.equal(lesson.n, 2);
    assert.equal(lesson.met, 0);
    assert.equal(lesson.lab, "/lab/navigator");
    const skills = hud.skillsModel(runtime);
    assert.ok(skills.practised >= 2 && skills.total >= 30);
    const panes = hud.panels(runtime, { width: 30 }).map((p) => p.id);
    assert.ok(panes.includes("lesson") && panes.includes("skills"));
});

test("a saved layout from before the learning panes gains them, visible, in definition order", () => {
    const { hud } = createHudRuntime();
    const old = { version: 1, dock: "left", sidebar: true, width: 28, panes: [{ id: "map", visible: false, collapsed: false }] };
    const layout = hud.normalizeLayout(old);
    assert.deepEqual(layout.panes.map((p) => p.id), hud.PANE_DEFS.map((d) => d.id));
    assert.equal(layout.panes.find((p) => p.id === "lesson").visible, true);
    assert.equal(layout.panes.find((p) => p.id === "map").visible, false);
});

// ── status strip + next-step suggestions ──────────────────────────────────

test("statusModel reports rank progress, vitals, quests and only a live streak", () => {
    const { runtime, hud } = createHudRuntime();
    const ranks = runtime.catalog.ranks;
    const fresh = hud.statusModel(runtime);
    assert.equal(fresh.xp, 0);
    assert.equal(fresh.rank, ranks[0].title);
    assert.equal(fresh.rankIndex, 0);
    // Spread: the model is built in the sandbox realm, so its prototype differs.
    assert.deepEqual({ ...fresh.nextRank }, { title: ranks[1].title, min: ranks[1].min, remaining: ranks[1].min });
    assert.equal(fresh.pct, 0);
    assert.equal(fresh.hp, 100);
    assert.equal(fresh.hpMax, 100);
    assert.equal(fresh.questsDone, 0);
    assert.equal(fresh.questsTotal, runtime.quests.length);
    assert.equal(fresh.streak, 0);
    assert.equal(fresh.badgeTotal, runtime.catalog.achievements.length);
    runtime.execute("pwd");
    const after = hud.statusModel(runtime);
    assert.ok(after.xp > 0, "pwd earns XP");
    assert.equal(after.questsDone, 1);
    assert.ok(after.pct > 0 || after.rankIndex > 0, "progress toward the next rank moves");
    // A streak shows while it is alive (done today, or yesterday with today open).
    runtime.state.daily = { date: "2026-10-18", lastDate: "2026-10-18", streak: 3, completed: true };
    assert.equal(hud.statusModel(runtime).streak, 3);
    assert.equal(hud.statusModel(runtime).dailyDone, true);
    runtime.state.daily = { date: "2026-10-18", lastDate: "2026-10-17", streak: 3, completed: false };
    assert.equal(hud.statusModel(runtime).streak, 3, "yesterday's streak is still alive");
    assert.equal(hud.statusModel(runtime).dailyDone, false);
    runtime.state.daily = { date: "2026-10-18", lastDate: "2026-10-01", streak: 3, completed: false };
    assert.equal(hud.statusModel(runtime).streak, 0, "a lapsed streak is not shown");
    runtime.state.xp = 100000;
    const top = hud.statusModel(runtime);
    assert.equal(top.rank, ranks[ranks.length - 1].title);
    assert.equal(top.nextRank, null);
    assert.equal(top.pct, 100);
});

test("suggestionsModel leads with the quest's own command when it can run from here", () => {
    const { runtime, hud } = createHudRuntime();
    let rows = hud.suggestionsModel(runtime);
    assert.equal(rows[0].kind, "quest");
    assert.equal(rows[0].cmd, "pwd");
    assert.ok(rows.some((r) => r.cmd === "cat scroll" && r.kind === "room"), "the room's essentials follow");
    assert.ok(rows.length <= 6);
    assert.equal(new Set(rows.map((r) => r.cmd)).size, rows.length, "no duplicate chips");
    runtime.execute("pwd");
    runtime.execute("ls");
    assert.equal(hud.suggestionsModel(runtime)[0].cmd, "cd cellar");
    runtime.execute("cd cellar");
    rows = hud.suggestionsModel(runtime);
    assert.equal(rows[0].cmd, "cat scroll");
    assert.ok(rows.some((r) => r.cmd === "./treasure" && r.kind === "room"), "encounters in the room are offered");
    runtime.execute("cat scroll");
    // "Return to the entrance with 'cd ..', then use 'mkdir workshop'": the
    // first step that can run from here leads, then the next one.
    assert.equal(hud.suggestionsModel(runtime)[0].cmd, "cd ..");
    runtime.execute("cd ..");
    assert.equal(hud.suggestionsModel(runtime)[0].cmd, "mkdir workshop");
    runtime.execute("mkdir workshop");
    assert.equal(hud.suggestionsModel(runtime)[0].cmd, "touch notes.txt");
});

test("suggestionsModel skips a quest command that cannot land here and adds the lesson's chips", () => {
    const { runtime, hud } = createHudRuntime();
    for (const line of ["pwd", "ls", "cd cellar", "cat scroll", "cd ..", "mkdir workshop", "touch notes.txt"]) runtime.execute(line);
    // The grep quest is scoped to the cellar/armoury: at the entrance it is not offered.
    assert.ok(!hud.suggestionsModel(runtime).some((r) => r.kind === "quest"), "grep is not suggested outside its rooms");
    runtime.execute("cd cellar");
    assert.equal(hud.suggestionsModel(runtime)[0].cmd, "grep magic scroll");
    runtime.execute("learn navigator");
    const rows = hud.suggestionsModel(runtime);
    assert.ok(rows.some((r) => r.cmd === "cd /lab/navigator" && r.kind === "lesson"), "a lab elsewhere is one chip away");
    assert.ok(rows.some((r) => r.cmd === "lesson hint" && r.kind === "lesson"));
    assert.equal(rows[0].kind, "quest", "the quest still leads");
});

test("defaultLayout honours a surface's pane order and folded panes; saved flags survive", () => {
    const { hud } = createHudRuntime();
    const web = hud.defaultLayout({ dock: "left", order: ["quest", "room", "bogus", "quest"], collapsed: ["hero"] });
    assert.deepEqual(web.panes.slice(0, 2).map((p) => p.id), ["quest", "room"]);
    assert.equal(web.panes.length, hud.PANE_DEFS.length, "every pane is present exactly once");
    assert.equal(web.panes.find((p) => p.id === "hero").collapsed, true);
    assert.equal(web.panes.find((p) => p.id === "quest").collapsed, false);
    const saved = { version: 1, dock: "left", panes: [{ id: "hero", visible: true, collapsed: false }, { id: "map", visible: false, collapsed: true }] };
    const merged = hud.normalizeLayout(saved, { order: ["quest", "room"], collapsed: ["hero", "skills"] });
    assert.deepEqual(merged.panes.slice(0, 2).map((p) => p.id), ["quest", "room"], "the surface's order applies to a saved layout");
    assert.equal(merged.panes.find((p) => p.id === "hero").collapsed, false, "a saved fold flag wins");
    assert.equal(merged.panes.find((p) => p.id === "skills").collapsed, true, "an unsaved pane takes the surface default");
    assert.equal(merged.panes.find((p) => p.id === "map").visible, false);
    assert.deepEqual(hud.defaultLayout().panes.map((p) => p.id), hud.PANE_DEFS.map((d) => d.id), "no overrides: definition order");
});
