"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { planMotion, review } = require("../apps/bashcrawl-motion.js");

test("pwd plans a stage clip that holds more than one frame", () => {
    const plan = planMotion("pwd");
    assert.equal(plan.motion, "radar");
    assert.equal(plan.stage, true);
    assert.ok(plan.frames.length >= 3);
    assert.ok(plan.frames[0].join("\n").includes("."));
    assert.notEqual(plan.frames[0].join("\n"), plan.frames[1].join("\n"));
    assert.equal(plan.shift, undefined);
    assert.equal(plan.sweep, undefined);
});

test("cd plans warp in the stage, not a viewport slide", () => {
    const down = planMotion("cd cellar", { events: [{ type: "move", from: "/entrance", to: "/entrance/cellar" }] });
    assert.equal(down.motion, "warp");
    assert.equal(down.stage, true);
    assert.ok(down.frames[0].length >= 4);
});

test("a bad command plans no stage clip (the error line carries it) and cat stays a wash", () => {
    // #111: the big "do not enter" sign stays off the stage; the clip is
    // still bundled for an explicit play.
    assert.equal(planMotion("nope", { error: true }), null);
    assert.equal(planMotion("cd nowhere", { error: true }), null);
    const read = planMotion("cat scroll");
    assert.equal(read, null);
});

test("every command option is classified by the review", () => {
    const rows = review();
    const byCmd = new Map(rows.map((row) => [row.cmd, row.treatment]));
    assert.equal(byCmd.get("pwd"), "stage");
    assert.equal(byCmd.get("ls"), "stage");
    assert.equal(byCmd.get("cd"), "stage");
    assert.equal(byCmd.get("rm"), "stage");
    assert.equal(byCmd.get("sl"), "stage");
    assert.equal(byCmd.get("cat"), "wash");
    assert.equal(byCmd.get("grep"), "wash");
    assert.equal(byCmd.get("clear"), "wash");
    assert.equal(byCmd.get("_flags"), "wash");
    assert.equal(byCmd.get("_layout"), "layout");
    assert.equal(byCmd.get("_damage"), "attention");
    assert.equal(byCmd.get("_events"), "toast");
    assert.ok(rows.filter((row) => row.treatment === "stage").length >= 8);
    assert.ok(rows.filter((row) => row.treatment === "wash").length >= 20);
});

test("the TTY stage set and event overrides come from the shared clip manifest", () => {
    const { stageMotions } = require("../apps/bashcrawl-motion.js");
    const stage = stageMotions();
    for (const motion of ["radar", "scan", "warp", "climb", "rewind", "home"]) {
        assert.ok(stage.includes(motion), motion);
    }
    assert.ok(!stage.includes("error"), "failures stay off the stage (#111)");
    assert.equal(planMotion("ls", { events: [{ type: "quest" }] }).motion, "spark");
    assert.equal(planMotion("ls", { events: [{ type: "unlock" }] }).motion, "warp");
    assert.equal(planMotion("cd ..").motion, "climb");
    assert.equal(planMotion("echo hi", { reducedMotion: true }), null);
    assert.equal(planMotion("pwd", { reducedMotion: true }).frames.length, 1);
});
