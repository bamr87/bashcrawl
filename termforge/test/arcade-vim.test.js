"use strict";
// The Vim Catacombs trial (web/assets/js/arcade.js over vim.js) against its
// content: every level in arcade.yaml is winnable with its authored solution,
// its par is that solution's keystroke count (so the score is honest), the
// solution steps on no spike, and no level is cleared for free. Then the
// game rules themselves: the spellbook gate, spikes, : and / routing, and
// level selection from the cleared list.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { loadClassic } = require("./helpers/load-classic.js");
const { RUNTIME_FILES, WEB_JS, DATA_DIR } = require("./helpers/game-harness.js");

function arcadeEnv() {
    const env = loadClassic({ files: [...RUNTIME_FILES, path.join(WEB_JS, "vim.js"), path.join(WEB_JS, "arcade.js")] });
    const arcade = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "arcade.json"), "utf8"));
    const game = env.sandbox.BashcrawlArcade.GAMES.find((g) => g.id === "vim");
    return { env, arcade, game, data: { world: null, commands: null, arcade } };
}

function begin(game, data, persist, levelId) {
    const scenario = game.makeScenario(data, persist, levelId);
    assert.ok(scenario, "the level builds");
    return { ...scenario, rt: null, moves: 0, hints: 0, startedAt: 0 };
}

test("the trial is registered with the others and its levels are exported", () => {
    const { env, arcade } = arcadeEnv();
    // The sandbox realm has its own Array prototype: copy before a strict deep comparison.
    assert.deepEqual(Array.from(env.sandbox.BashcrawlArcade.GAMES, (g) => g.id), ["pathnav", "hunt", "pipes", "flash", "vim"]);
    assert.ok(arcade.vim_levels.length >= 10, "a real progression");
    assert.equal(arcade.vim_levels[0].id, "first-steps");
});

test("every level is winnable with its solution, at exactly par, without a spike", () => {
    const { game, data, arcade } = arcadeEnv();
    for (const level of arcade.vim_levels) {
        const ctx = begin(game, data, { games: {} }, level.id);
        assert.equal(ctx.level.id, level.id);
        let last = { done: false };
        level.solution.forEach((run, i) => {
            assert.equal(last.done, false, `${level.id}: cleared before run ${i} (${run}) — the solution is longer than needed`);
            last = game.input(run, ctx);
            const refused = Array.from(last.outputs).filter((o) => o.kind === "error").map((o) => o.text);
            assert.equal(refused.length, 0, `${level.id}: run "${run}" was refused: ${refused.join(" | ")}`);
        });
        assert.equal(last.done, true, `${level.id}: not cleared by its solution`);
        assert.equal(last.success, true, `${level.id}: ended in failure`);
        assert.equal(ctx.hp, 3, `${level.id}: the solution steps on a spike`);
        assert.equal(ctx.keys, level.par, `${level.id}: par ${level.par} but the solution takes ${ctx.keys} keystrokes`);
        if (level.target) assert.deepEqual(Array.from(ctx.vim.lines), level.target);
        else assert.equal(ctx.taken, ctx.total);
        const { score, detail } = game.scoreFor(ctx);
        assert.equal(score, 110, `${level.id}: a par run scores 100 + the par bonus (${detail})`);
    }
});

test("no level is free: nothing is cleared before a key is pressed, and gems need a landing", () => {
    const { game, data, arcade } = arcadeEnv();
    for (const level of arcade.vim_levels) {
        const ctx = begin(game, data, { games: {} }, level.id);
        assert.equal(ctx.taken, 0);
        assert.ok(ctx.total > 0 || level.target, `${level.id} has nothing to win`);
    }
    const ctx = begin(game, data, { games: {} }, "the-count");
    game.input("6j", ctx);
    assert.equal(ctx.taken, 1);
    assert.equal(ctx.hp, 3, "a count passes over the spike without landing on it");
});

test("the spellbook grows level by level and refuses what is not yet learned", () => {
    const { game, data } = arcadeEnv();
    const first = begin(game, data, { games: {} }, "first-steps");
    assert.deepEqual(Array.from(first.allowed), ["h", "j", "k", "l"]);
    const locked = game.keystroke("G", first);
    assert.equal(locked.consumed, true, "a refused key is still the editor's");
    assert.match(locked.outputs[0].text, /G is not in your spellbook yet — this level: h j k l/);
    assert.equal(first.keys, 1, "a refused key still costs a keystroke");
    assert.deepEqual([first.vim.row, first.vim.col], [0, 0]);
    const run = game.input("jjG", first);
    assert.equal(run.outputs.filter((o) => o.kind === "error").length, 1, "a typed run stops at the refused key");
    assert.equal(first.vim.row, 2);
    const count = begin(game, data, { games: {} }, "the-count");
    assert.deepEqual(Array.from(count.allowed), ["h", "j", "k", "l", "w", "b", "e", "0", "^", "$", "count"]);
    const gauntlet = begin(game, data, { games: {} }, "the-gauntlet");
    assert.ok(gauntlet.allowed.includes("dd") && gauntlet.allowed.includes("/") && gauntlet.allowed.includes("i"));
    assert.match(game.cheatsFor(count).find(([syntax]) => syntax.startsWith("3j"))[1], /^★/, "this level's keys are starred in the cheats");
    assert.equal(game.cheatsFor(first).some(([syntax]) => syntax.startsWith("w ·")), false, "unlearned keys have no cheat yet");
});

test("spikes cost hearts and the third ends the trial in defeat", () => {
    const { game, data } = arcadeEnv();
    const ctx = begin(game, data, { games: {} }, "first-steps");
    game.input("jjllll", ctx); // (2,4) is the spike
    assert.equal(ctx.hp, 2);
    assert.equal(ctx.traps, 1);
    game.input("hl", ctx);
    assert.equal(ctx.hp, 1, "stepping off and back on springs it again");
    const end = game.input("hl", ctx);
    assert.equal(ctx.hp, 0);
    assert.equal(end.done, true);
    assert.equal(end.success, false);
    assert.ok(game.scoreFor(ctx).score >= 20);
});

test(": and / are left to the prompt in normal mode but typed while inserting; / searches", () => {
    const { game, data } = arcadeEnv();
    const seek = begin(game, data, { games: {} }, "seek");
    assert.equal(game.keystroke(":", seek).consumed, false);
    assert.equal(game.keystroke("/", seek).consumed, false);
    assert.equal(seek.keys, 0, "handing a key back costs nothing");
    const miss = game.input("/nothing-here", seek);
    assert.match(miss.outputs[0].text, /E486: Pattern not found/);
    assert.equal(seek.keys, "/nothing-here".length + 1);
    const hit = game.input("/*", seek);
    assert.equal(seek.taken, 1);
    assert.equal(hit.outputs.some((o) => o.kind === "success"), true);
    const scribe = begin(game, data, { games: {} }, "the-scribe");
    game.input("A", scribe);
    assert.equal(scribe.vim.mode, "insert");
    assert.equal(game.keystroke(":", scribe).consumed, true, "a colon is text in insert mode");
    assert.equal(scribe.vim.lines[0], "open sesame:");
    game.input("<esc>", scribe);
    assert.equal(scribe.vim.mode, "normal");
    const nested = game.input("jj:q", scribe);
    assert.match(nested.outputs[nested.outputs.length - 1].text, /is not a key here/);
});

test("deleting a gem is warned and undo brings it back; a taken gem is a checkpoint", () => {
    const { game, data } = arcadeEnv();
    const ctx = begin(game, data, { games: {} }, "the-gauntlet");
    const out = game.input("3Gdd", ctx); // the third row holds a gem mid-line
    assert.match(Array.from(out.outputs, (o) => o.text).join("\n"), /a gem was destroyed/);
    game.input("u", ctx);
    assert.equal(ctx.vim.lines[2], "...the dark * remembers....");
    assert.equal(ctx.warned, false);
    game.input("f*", ctx);
    assert.equal(ctx.taken, 1);
    assert.equal(ctx.vim.lines[2], "...the dark . remembers....");
    const undo = game.input("u", ctx);
    assert.equal(ctx.taken, 1, "u does not give a gem back");
    assert.equal(undo.outputs[0].kind, "dim");
});

test("the next uncleared level is chosen by default; everything cleared replays the gauntlet", () => {
    const { game, data, arcade } = arcadeEnv();
    const ids = arcade.vim_levels.map((l) => l.id);
    assert.equal(begin(game, data, { games: {} }).level.id, ids[0]);
    assert.equal(begin(game, data, { games: { vim: { best: 0, plays: 1, seen: [ids[0]], cleared: [ids[0]] } } }).level.id, ids[1]);
    assert.equal(begin(game, data, { games: { vim: { best: 0, plays: 1, seen: ids, cleared: ids } } }).level.id, ids[ids.length - 1]);
    assert.equal(begin(game, data, { games: {} }, "seek").level.id, "seek");
    assert.equal(begin(game, data, { games: {} }, "no-such-level").level.id, ids[0], "an unknown level id falls back");
    assert.equal(game.makeScenario({ world: null, commands: null, arcade: { vim_levels: [] } }, { games: {} }), null);
});
