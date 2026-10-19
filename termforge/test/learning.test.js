"use strict";
// The learning platform's other two plugins: the skill model + spaced review
// (core/mastery.js) and the offline explainer (core/explain.js) — as framework
// parts on a bare Shell, and wired into the game runtime.

const test = require("node:test");
const assert = require("node:assert/strict");

const { Shell } = require("../core/shell.js");
const posix = require("../core/packs/posix.js");
const mastery = require("../core/mastery.js");
const explain = require("../core/explain.js");
const { RUNTIME_FILES, loadGameData } = require("./helpers/game-harness.js");
const { loadClassic } = require("./helpers/load-classic.js");

const DAY = 86400000;
const WORLD = {
    root: "/w",
    directories: { "/w": [{ name: "notes", type: "file", hidden: false }, { name: "a.log", type: "file", hidden: false }] },
    files: { "/w/notes": "alpha\nbeta\n", "/w/a.log": "x\n" },
};
const SKILLS = [{ group: "Basics", commands: ["ls", "cat", "grep", "wc"] }];
const CARDS = [
    { skill: "ls", q: "Show hidden files too.", a: ["ls -a"], why: "-a is all" },
    { skill: "cat", q: "Print notes.", a: ["cat notes"], why: "" },
    { skill: "grep", q: "Find beta in notes.", a: ["grep beta notes"], why: "" },
    { skill: "wc", q: "Count lines of notes.", a: ["wc -l notes"], why: "" },
];

function masteryShell(extra) {
    const clock = { t: Date.UTC(2026, 0, 1), now() { return this.t; } };
    let xp = 0;
    const shell = new Shell({
        world: WORLD, packs: [posix], clock, rng: () => 0.5,
        plugins: [mastery.plugin({ skills: SKILLS, cards: CARDS, size: 3, award: (_s, n) => { xp += n; }, ...(extra || {}) })],
    });
    return { shell, clock, xp: () => xp, run: (line) => shell.execute(line).map((o) => o.text || "").join("\n") };
}

test("the skill model grows from real use: uses, distinct flags, failures, level events", () => {
    const { shell, run } = masteryShell();
    const levelled = [];
    shell.events.on("skill.levelled", (e) => levelled.push(`${e.skill}:${e.level}:${e.label}`));
    run("ls");
    run("ls -a");
    run("ls -la");
    run("cat nope");
    run("frobnicate");
    const s = shell.state.mastery.skills;
    assert.deepStrictEqual({ ...s.ls, flags: [...s.ls.flags] }, { uses: 3, fails: 0, flags: ["a", "l"], box: 0, due: 0 });
    assert.equal(s.cat.fails, 1);
    assert.equal(s.frobnicate, undefined, "only tracked skills are recorded");
    assert.deepStrictEqual(levelled, ["ls:1:Novice", "ls:2:Apprentice"], "3 uses + 2 flags = 7 points: Apprentice (Adept needs 10)");
    assert.equal(mastery.levelOf(s.cat), 0, "a failure alone is not mastery");
    const map = run("skills");
    assert.match(map, /🧠 Skills — 1\/4 practised/);
    assert.match(map, /ls +██░░░ +Apprentice +-a -l/);
    assert.match(map, /grep +░░░░░ +not yet tried/);
    assert.match(run("skills ls"), /level 2\/5 \(7 pts\)[\s\S]*3 successful · 0 failed[\s\S]*-a -l/);
    assert.match(run("skills nope"), /No such skill: nope/);
});

test("review drills touched-and-due skills first, one card per skill, on a Leitner schedule", () => {
    const { shell, clock, xp, run } = masteryShell();
    run("cat nope"); // a touched skill with a failure: first in line
    run("grep beta notes");
    const start = run("review");
    assert.match(start, /🃏 Review — 3 cards/);
    assert.match(start.split("\n")[1], /🃏 1\/3\s+\[cat\]\s+Print notes\./, "the failed skill comes first");
    assert.equal(shell.promptLabel(), "review 1/3 ❯");
    assert.match(run("cat notes"), /✅ Correct — moved up to box 1; next review in 1 day[\s\S]*\[grep\]/);
    assert.equal(shell.state.mastery.skills.cat.box, 1);
    assert.equal(shell.state.mastery.skills.cat.due, clock.t + DAY);
    assert.match(run("hint"), /💡/);
    assert.match(run("grep alpha notes"), /One more try/);
    assert.match(run("grep alpha notes"), /The answer: grep beta notes[\s\S]*back to box 0/);
    assert.match(run("skip"), /Skipped[\s\S]*Review complete — 1\/3 correct/);
    assert.equal(shell.state.mastery.review, null);
    assert.equal(shell.promptLabel(), "/w $");
    assert.equal(xp(), 5, "only the correct card paid XP");
    assert.equal(shell.state.mastery.reviews, 1);
    // Tomorrow, cat is due again.
    clock.t += DAY;
    assert.match(run("skills cat"), /box 1\/5 · due now/);
});

test("answers compare whitespace-collapsed, and case-insensitively only for lowercase answers", () => {
    assert.ok(mastery.accepts({ a: ["ls -a"] }, "  ls   -a "));
    assert.ok(mastery.accepts({ a: ["ls -a"] }, "LS -A"));
    assert.ok(!mastery.accepts({ a: ["ls -F"] }, "ls -f"));
    assert.ok(mastery.accepts({ a: ["ls -F"] }, "ls -F"));
});

test("review can be refused (busy), quit mid-way, and an imported slice is sanitized", () => {
    const busy = masteryShell({ busy: () => "Finish the quiz first." });
    assert.match(busy.run("review"), /Finish the quiz first\./);
    const { shell, run } = masteryShell();
    run("review");
    assert.match(run("quit"), /Review ended early[\s\S]*0\/0 correct/);
    shell.state = {
        ...shell.state,
        mastery: {
            skills: { ls: { uses: -4, fails: "x", flags: ["a", "<script>", 3], box: 99, due: 5 }, ghost: { uses: 9 } },
            review: { queue: [0, 99], pos: 0 },
            reviews: -1,
        },
    };
    run("skills");
    const m = shell.state.mastery;
    assert.deepStrictEqual(Object.keys(m.skills), ["ls"]);
    assert.deepStrictEqual({ ...m.skills.ls, flags: [...m.skills.ls.flags] }, { uses: 0, fails: 0, flags: ["a"], box: 5, due: 5 });
    assert.equal(m.review, null);
    assert.equal(m.reviews, 0);
});

test("explain captures the raw line, decodes flags and arguments, and never runs anything", () => {
    const shell = new Shell({ world: WORLD, packs: [posix], plugins: [explain.plugin({ docs: { meta: posix.meta } })] });
    const text = (line) => shell.execute(line).map((o) => o.text || "").join("\n");
    const out = text("explain cat notes | grep -n beta | wc -l > count");
    assert.match(out, /① cat notes[\s\S]*② grep -n beta[\s\S]*③ wc -l/);
    assert.match(out, /-n +prefix each match with its line number/);
    assert.match(out, /pipe: grep's output becomes wc's input/);
    assert.match(out, /> count: write the final output into count/);
    assert.equal(shell.readFile("/w/count"), null, "explain must not run the line");
    assert.match(text("explain 'ls -a'"), /① ls -a/);
    assert.match(text("explain rm *.log"), /expands it to 1 name: a.log[\s\S]*⚠ removes files for good/);
    assert.match(text("explain grpe x"), /not a command here — did you mean grep\?/);
    assert.match(text("explain find . -name '*.log'"), /quoted, so the command sees the pattern itself/);
    shell.state.history.push("wc -l notes", "explain");
    assert.match(text("explain"), /🔍 explain  wc -l notes/);
    const fresh = new Shell({ world: WORLD, packs: [posix], plugins: [explain.plugin()] });
    assert.match(fresh.execute("explain")[0].text, /Nothing to explain yet/);
});

test("in the game: skills, review and explain are wired, guarded against the arena, and silent in play", () => {
    const env = loadClassic({ files: RUNTIME_FILES, seed: 5 });
    env.sandbox.__data = loadGameData();
    const runtime = env.run("new BashcrawlRuntime.Runtime(__data)");
    const run = (line) => runtime.execute(line).map((o) => o.text || "").join("\n");
    // Practice is recorded without a single extra line in the log.
    assert.equal(run("ls"), runtime.execute("ls")[0].text);
    assert.ok(runtime.state.mastery.skills.ls.uses >= 1);
    assert.match(run("skills"), /🧠 Skills — 1\/\d+ practised/);
    assert.match(run("explain cat scroll | wc -l"), /① cat scroll[\s\S]*a file \(\/entrance\/scroll\)/);
    // One input-capturing mode at a time.
    run("train");
    assert.match(run("review"), /^❌ "review" fizzles/, "inside the arena, review is just a wrong answer");
    run("quit");
    assert.match(run("review"), /🃏 Review/);
    assert.match(runtime.promptLabel(), /^review 1\/5 ❯$/);
    assert.match(run("train"), /The answer|One more try/, "inside a review, train is just a wrong answer");
    run("quit");
    assert.equal(runtime.state.mastery.review, null);
});
