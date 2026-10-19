"use strict";
// The game as plugins over data: progression catalogs come from
// src/help/data/progression.yaml (web/data/progression.json), the features
// are TermForge plugins under web/assets/js/plugins/, and the runtime
// announces what happened on the typed event bus.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { REPO_ROOT, WEB_JS, DATA_DIR, RUNTIME_FILES, loadGameData } = require("./helpers/game-harness.js");
const { loadClassic } = require("./helpers/load-classic.js");
const rules = require("../core/rules.js");

const PLUGIN_DIR = path.join(WEB_JS, "plugins");
const progression = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "progression.json"), "utf8"));

function boot(dataOverride) {
    const env = loadClassic({ files: RUNTIME_FILES, seed: 9 });
    env.sandbox.__data = { ...loadGameData(), ...(dataOverride || {}) };
    const runtime = env.run("new BashcrawlRuntime.Runtime(__data)");
    delete env.sandbox.__data;
    return { env, runtime };
}

test("every authored achievement rule passes the JS rule validator", () => {
    assert.ok(progression.achievements.length > 0);
    for (const badge of progression.achievements) {
        assert.deepStrictEqual(rules.validate(badge.when, `achievements.${badge.id}`), []);
    }
});

test("the Python rule mirror (validate_content_contracts.py) matches core/rules.js", () => {
    const py = fs.readFileSync(path.join(REPO_ROOT, "scripts", "validate_content_contracts.py"), "utf8");
    const tuple = (name) => {
        const m = py.match(new RegExp(`${name} = \\(([\\s\\S]*?)\\)\\n`));
        assert.ok(m, `${name} not found`);
        return m[1].match(/"([a-z_]+)"/g).map((q) => q.slice(1, -1));
    };
    assert.deepStrictEqual(tuple("RULE_HEADS"), [...rules.HEADS]);
    assert.deepStrictEqual(tuple("RULE_COMPARATORS"), [...rules.COMPARATORS]);
});

test("GAME_PLUGINS, the plugin directory, the test harness and index.html agree", () => {
    const { env } = boot();
    const ids = Array.from(env.run("BashcrawlRuntime.GAME_PLUGINS"));
    const files = fs.readdirSync(PLUGIN_DIR).filter((f) => f.endsWith(".js")).map((f) => f.replace(/\.js$/, ""));
    assert.deepStrictEqual([...ids].sort(), [...files].sort(), "a plugin file is not installed (or vice versa)");
    const harnessOrder = RUNTIME_FILES.filter((f) => f.includes(`${path.sep}plugins${path.sep}`)).map((f) => path.basename(f, ".js"));
    assert.deepStrictEqual(harnessOrder, ids);
    const index = fs.readFileSync(path.join(REPO_ROOT, "web", "index.html"), "utf8");
    const indexOrder = [...index.matchAll(/assets\/js\/plugins\/([a-z-]+)\.js/g)].map((m) => m[1]);
    assert.deepStrictEqual(indexOrder, ids);
});

test("every game plugin is a valid TermForge plugin and is installed on the runtime", () => {
    const { env, runtime } = boot();
    for (const id of env.run("Array.from(BashcrawlRuntime.GAME_PLUGINS)")) {
        const errors = env.run(`TermForge.plugin.validatePlugin(BashcrawlPlugins[${JSON.stringify(id)}].plugin)`);
        assert.deepStrictEqual(Array.from(errors), [], id);
        assert.ok(runtime.plugins.has(id), `${id} not installed`);
    }
    // Plugin metadata reaches `man`.
    assert.match(runtime.execute("man pathfind")[0].text, /SYNOPSIS\n {4}pathfind \[quit\]/);
});

test("the runtime reports what happened on the typed event bus", () => {
    const { runtime } = boot();
    const seen = [];
    runtime.events.on("*", (e) => seen.push(e));
    runtime.execute("pwd");
    runtime.execute("cd cellar");
    runtime.execute("./treasure");
    const types = seen.map((e) => e.type);
    for (const type of ["quest.completed", "progress.xp", "achievement.unlocked", "location.changed",
        "encounter.run", "item.gained", "node.revealed", "command.run", "line.executed"]) {
        assert.ok(types.includes(type), `missing ${type}: ${types.join(", ")}`);
    }
    const quest = seen.find((e) => e.type === "quest.completed");
    assert.equal(quest.id, 0);
    const badge = seen.find((e) => e.type === "achievement.unlocked");
    assert.equal(badge.id, "first_steps");
    const xp = seen.filter((e) => e.type === "progress.xp");
    assert.equal(xp[xp.length - 1].total, runtime.state.xp, "progress.xp carries the running total");
    assert.ok(seen.some((e) => e.type === "item.gained" && e.item === "amulet"));
});

test("new progression content needs no JavaScript: a custom badge and rank take effect", () => {
    const custom = JSON.parse(JSON.stringify(progression));
    custom.achievements.unshift({
        id: "lister", icon: "📜", title: "Lister", desc: "Listed a room with ls -l.", xp: 7,
        when: { all: [{ state: "stats.commands.ls", gte: 1 }, { flag: "never_set" }] },
    });
    custom.achievements.unshift({
        id: "echoer", icon: "📣", title: "Echoer", desc: "Echoed something.", xp: 11,
        when: { state: "stats.commands.echo", gt: 0 },
    });
    custom.ranks = [{ min: 0, title: "Hatchling" }, { min: 10, title: "Fledgling" }];
    const { runtime } = boot({ progression: custom });
    const out = runtime.execute("echo hi").map((o) => o.text || "");
    assert.ok(out.some((t) => t.includes("Achievement unlocked: Echoer") && t.includes("(+11 XP)")), out.join("\n"));
    assert.ok(out.some((t) => t.includes("You are now Fledgling!")), out.join("\n"));
    assert.ok(!runtime.state.achievements.includes("lister"));
    assert.match(runtime.execute("achievements")[0].text, new RegExp(`/${custom.achievements.length} unlocked`));
});

test("a runtime without progression data (arcade sandboxes) gets empty catalogs", () => {
    const { runtime } = boot({ progression: undefined });
    assert.deepStrictEqual(Array.from(runtime.catalog.achievements), []);
    assert.equal(runtime.catalog.ranks.length, 1);
    assert.match(runtime.execute("train")[0].text, /no trials are loaded/);
    assert.equal(runtime.state.trainer, null);
});

test("a saved arena run pointing past the loaded trials is dropped, not crashed on", () => {
    const env = loadClassic({ files: RUNTIME_FILES, seed: 3 });
    env.sandbox.__data = loadGameData();
    const runtime = env.run(`(() => {
        const state = BashcrawlRuntime.defaultState(__data.world.root);
        state.trainer = { queue: [0, 999], pos: 0, score: 0, streak: 0, best: 0, tries: 0, active: true, speed: false, startedAt: 0 };
        return new BashcrawlRuntime.Runtime(__data, state);
    })()`);
    assert.equal(runtime.state.trainer, null);
    assert.throws(() => env.run(`BashcrawlRuntime.loadState(__data.world, {
        trainer: { queue: [999], pos: 0, score: 0, streak: 0, best: 0, tries: 0, active: true, speed: false, startedAt: 0 } }, __data.progression)`),
    /invalid trainer/);
});
