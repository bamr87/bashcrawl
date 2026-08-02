"use strict";
// Pixel-identity contract: replay every recorded transcript fixture through
// the current game runtime and require byte-identical Line[] outputs at every
// step, plus an identical final state. These fixtures were first recorded
// against the pre-TermForge emulator; every refactor phase must keep them
// green. Regenerate ONLY via: node termforge/test/tools/record-goldens.js --update

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { FIXTURES_DIR, createGameRuntime } = require("./helpers/game-harness.js");
const { SCENARIOS } = require("./helpers/scenarios.js");

const TRANSCRIPTS_DIR = path.join(FIXTURES_DIR, "transcripts");

test("every scenario has a recorded fixture (and vice versa)", () => {
    const recorded = fs.readdirSync(TRANSCRIPTS_DIR).filter((f) => f.endsWith(".json")).sort();
    const expected = SCENARIOS.map((s) => `${s.name}.json`).sort();
    assert.deepStrictEqual(recorded, expected,
        "scenarios.js and fixtures/transcripts/ are out of sync — run record-goldens.js --update");
});

for (const scenario of SCENARIOS) {
    test(`golden transcript: ${scenario.name}`, () => {
        const fixture = JSON.parse(
            fs.readFileSync(path.join(TRANSCRIPTS_DIR, `${scenario.name}.json`), "utf8"),
        );
        assert.strictEqual(fixture.seed, scenario.seed, "fixture recorded with a different seed");
        const { env, runtime } = createGameRuntime({
            seed: fixture.seed,
            clockStart: fixture.clockStart,
        });
        fixture.steps.forEach((step, i) => {
            if (step.advanceMs) env.advance(step.advanceMs);
            const outputs = JSON.parse(JSON.stringify(runtime.execute(step.line)));
            assert.deepStrictEqual(
                outputs,
                step.outputs,
                `step ${i} (\`${step.line}\`) diverged from the recorded transcript`,
            );
        });
        assert.deepStrictEqual(
            JSON.parse(JSON.stringify(runtime.state)),
            fixture.finalState,
            "final runtime state diverged from the recorded transcript",
        );
    });
}
