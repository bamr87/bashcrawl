"use strict";
// Course contract: every lesson in courses/ can be won, and none is free.
//
// For each course, a fresh game runtime enrolls, walks into the lab, and
// types each objective's authored `solution` in order — exactly as a learner
// would, history included. Every objective must be met by its own solution,
// every lesson must complete and hand over to the next, and the course must
// finish. A lesson that is already complete the moment it starts (all its
// objectives true without doing anything) fails the build: content must
// teach, not just congratulate.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { DATA_DIR, RUNTIME_FILES, loadGameData } = require("./helpers/game-harness.js");
const { loadClassic } = require("./helpers/load-classic.js");
const curriculum = require("../core/curriculum.js");
const rules = require("../core/rules.js");

const bundle = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "courses.json"), "utf8"));

function boot() {
    const env = loadClassic({ files: RUNTIME_FILES, seed: 11 });
    env.sandbox.__data = loadGameData();
    const runtime = env.run("new BashcrawlRuntime.Runtime(__data)");
    delete env.sandbox.__data;
    // What SessionController does before every line: record history.
    const run = (line) => {
        runtime.state.history.push(line);
        runtime.state.historyIndex = runtime.state.history.length;
        return runtime.execute(line).map((o) => o.text || "");
    };
    return { runtime, run };
}

test("the compiled course bundle is valid and every objective rule validates", () => {
    assert.equal(bundle.version, 1);
    assert.ok(bundle.courses.length >= 5, "the platform ships at least five courses");
    assert.deepStrictEqual(curriculum.validateCourses(bundle.courses), []);
    for (const course of bundle.courses) {
        for (const lesson of course.lessons) {
            lesson.objectives.forEach((obj, i) => {
                assert.deepStrictEqual(rules.validate(obj.when, `${course.id}/${lesson.id}#${i + 1}`), []);
            });
        }
    }
});

for (const course of bundle.courses) {
    test(`course ${course.id}: every lesson is won by its own solutions`, () => {
        const { runtime, run } = boot();
        const enrolled = run(`learn ${course.id}`).join("\n");
        assert.match(enrolled, new RegExp(`Enrolled: ${course.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
        run(`cd /lab/${course.id}`);
        const progress = () => runtime.state.learn.progress[course.id];
        course.lessons.forEach((lesson, li) => {
            assert.equal(progress().lesson, li, `${lesson.id} should be the current lesson`);
            // Reaching a lesson must not complete it.
            run("lesson");
            assert.equal(progress().lesson, li, `${course.id}/${lesson.id} completed without any work`);
            assert.ok(progress().met.length < lesson.objectives.length, `${course.id}/${lesson.id} starts fully met`);
            lesson.objectives.forEach((obj, oi) => {
                const already = li === progress().lesson && progress().met.includes(oi);
                const out = run(obj.solution).join("\n");
                const metNow = progress().done.includes(lesson.id) || progress().met.includes(oi);
                assert.ok(already || metNow,
                    `${course.id}/${lesson.id} objective ${oi + 1} not met by its solution \`${obj.solution}\`:\n${out}`);
            });
            assert.ok(progress().done.includes(lesson.id), `${course.id}/${lesson.id} did not complete`);
        });
        assert.equal(progress().complete, true, `${course.id} did not complete`);
        assert.match(run("learn").join("\n"), new RegExp(`✅ ${course.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    });
}

test("objectives announce themselves, lessons pay XP, and the lab is a real sandbox", () => {
    const { runtime, run } = boot();
    const xp0 = runtime.state.xp;
    run("learn navigator");
    const out = run("cd /lab/navigator").join("\n");
    assert.match(out, /✔ Objective: Walk into the lab/);
    const done = run("pwd").join("\n");
    assert.match(done, /🎓 Lesson complete: Where am I\?/);
    assert.match(done, /Next up — Lesson 2\/5: Look around/);
    assert.ok(runtime.state.xp > xp0, "lesson XP was awarded");
    // The lab is writable session state, and `lab reset` restores it.
    run("rm README");
    assert.equal(runtime.readFile("/lab/navigator/README"), null);
    assert.match(run("lab reset").join("\n"), /Lab restored/);
    assert.match(runtime.readFile("/lab/navigator/README"), /Welcome, traveller/);
    // Hints, outline, pause and resume.
    assert.match(run("lesson hint").join("\n"), /💡 List what is in the lab/);
    assert.match(run("lesson list").join("\n"), /✅ Where am I\?[\s\S]*▶ Look around/);
    assert.match(run("learn quit").join("\n"), /Paused Finding Your Way/);
    assert.match(run("lesson").join("\n"), /No course is active/);
    assert.match(run("learn 1").join("\n"), /Resuming: Finding Your Way/);
    assert.match(run("learn nope").join("\n"), /No such course: nope/);
});

test("a failed command never meets an objective; course progress survives a save round-trip", () => {
    const { runtime, run } = boot();
    run("learn reading");
    run("cd /lab/reading");
    run("cat ballad.tx");
    assert.deepStrictEqual(Array.from(runtime.state.learn.progress.reading.met), []);
    run("cat ballad.txt");
    assert.deepStrictEqual(Array.from(runtime.state.learn.progress.reading.met), [0]);
    const token = run("save export")[0];
    const { runtime: other, run: runOther } = boot();
    assert.match(runOther(`save import ${token}`).join("\n"), /Progress imported/);
    assert.equal(other.state.learn.active, "reading");
    assert.deepStrictEqual(Array.from(other.state.learn.progress.reading.met), [0]);
    assert.match(runOther("lesson").join("\n"), /✅ Print the whole ballad/);
});

test("an imported save cannot smuggle bad course progress past the curriculum", () => {
    const { runtime, run } = boot();
    runtime.state = {
        ...runtime.state,
        learn: { active: "no-such-course", progress: { navigator: { lesson: 99, met: ["x", 7], done: ["nope", "where-am-i"], complete: "yes" }, ghost: {} } },
    };
    run("learn");
    const learn = runtime.state.learn;
    assert.equal(learn.active, null);
    assert.deepStrictEqual(Object.keys(learn.progress), ["navigator"]);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(learn.progress.navigator)), { lesson: 0, met: [], done: ["where-am-i"], complete: false });
    // A claimed completion without the progress to back it is dropped.
    runtime.state = { ...runtime.state, learn: { active: null, progress: {}, completed: ["navigator", "navigator", "ghost"] } };
    run("learn");
    assert.deepStrictEqual(Array.from(runtime.state.learn.completed), []);
    // So is `complete` without every lesson earned.
    const navigator = bundle.courses.find((c) => c.id === "navigator");
    const some = navigator.lessons.slice(0, 2).map((l) => l.id);
    runtime.state = { ...runtime.state, learn: { active: null, progress: { navigator: { lesson: 4, met: [], done: some, complete: true } }, completed: ["navigator"] } };
    run("learn");
    assert.equal(runtime.state.learn.progress.navigator.complete, false);
    assert.deepStrictEqual(Array.from(runtime.state.learn.completed), []);
});

test("skipping lessons defers them: a course completes, and pays, only once every lesson is earned", () => {
    const { runtime, run } = boot();
    const course = bundle.courses.find((c) => c.id === "navigator");
    run(`learn ${course.id}`);
    const xp0 = runtime.state.xp;
    const badges0 = (runtime.state.achievements || []).length;
    const progress = () => runtime.state.learn.progress[course.id];
    for (let i = 0; i < course.lessons.length - 1; i += 1) assert.match(run("lesson skip").join("\n"), /Skipped[\s\S]*Next up/);
    const wrapped = run("lesson skip").join("\n");
    assert.match(wrapped, /Skipped[\s\S]*5 lessons are still to be earned — Lesson 1\/5/);
    assert.equal(progress().complete, false);
    assert.equal(progress().lesson, 0, "back to the first lesson still unearned");
    assert.deepStrictEqual(Array.from(runtime.state.learn.completed), []);
    assert.equal(runtime.state.xp, xp0, "skipping pays nothing — not even the course bonus");
    assert.equal((runtime.state.achievements || []).length, badges0, "and unlocks nothing");
    // Earn lesson 2 out of order: the pointer moves forward past it, never back onto an earned lesson.
    run("lesson skip");
    assert.equal(progress().lesson, 1);
    run(`cd /lab/${course.id}`);
    for (const obj of course.lessons[1].objectives) run(obj.solution);
    assert.deepStrictEqual(Array.from(progress().done), [course.lessons[1].id]);
    assert.equal(progress().lesson, 2);
    // Earning the rest in the order the course now serves them (3, 4, 5, then
    // back to the skipped 1) finishes the course for real.
    const served = [];
    for (let guard = 0; !progress().complete && guard < course.lessons.length; guard += 1) {
        served.push(progress().lesson + 1);
        for (const obj of course.lessons[progress().lesson].objectives) run(obj.solution);
    }
    assert.deepStrictEqual(served, [3, 4, 5, 1]);
    assert.equal(progress().complete, true);
    assert.deepStrictEqual(Array.from(runtime.state.learn.completed), [course.id]);
    assert.ok(runtime.state.xp > xp0);
});

test("resuming a course or typing `lab` never undoes the learner's work; only `lab reset` re-seeds", () => {
    const { runtime, run } = boot();
    run("learn workshop");
    run("cd /lab/workshop");
    run("rm inbox/junk.old");
    run("mv inbox/report-draft.txt inbox/report.txt");
    assert.match(run("lab").join("\n"), /Lab: \/lab\/workshop/);
    assert.equal(runtime.readFile("/lab/workshop/inbox/junk.old"), null, "`lab` did not resurrect a removed file");
    run("learn quit");
    run("learn workshop");
    assert.equal(runtime.readFile("/lab/workshop/inbox/junk.old"), null, "resuming did not either");
    assert.equal(runtime.readFile("/lab/workshop/inbox/report-draft.txt"), null, "a rename stays renamed");
    assert.ok(runtime.readFile("/lab/workshop/inbox/report.txt"));
    assert.match(run("lab reset").join("\n"), /Lab restored/);
    assert.ok(runtime.readFile("/lab/workshop/inbox/junk.old"));
    assert.equal(runtime.readFile("/lab/workshop/inbox/report.txt"), null);
});
