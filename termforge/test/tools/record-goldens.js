"use strict";
// Golden-fixture recorder. Runs every scenario in helpers/scenarios.js against
// the CURRENT game runtime under the deterministic vm harness and writes:
//
//   fixtures/transcripts/<name>.json   — per-step Line[] outputs + final state
//   fixtures/save/defaults-current.json — defaultState() shape (key order too)
//   fixtures/save/save-v1-legacy.json   — a played save in the v1 storage shape
//
// Usage:
//   node termforge/test/tools/record-goldens.js --update   # (re)write fixtures
//   node termforge/test/tools/record-goldens.js            # dry-run: print diff summary
//
// Fixtures are the pixel-identity contract for the TermForge refactor: they
// were first recorded against the pre-refactor emulator, and every phase since
// must replay them byte-identically. Only --update rewrites them; a fixture
// diff in a PR is a claimed behavior change.

const fs = require("node:fs");
const path = require("node:path");
const { DEFAULT_CLOCK_START } = require("../helpers/load-classic.js");
const { FIXTURES_DIR, createGameRuntime, playTranscript } = require("../helpers/game-harness.js");
const { SCENARIOS } = require("../helpers/scenarios.js");

const TRANSCRIPTS_DIR = path.join(FIXTURES_DIR, "transcripts");
const SAVE_DIR = path.join(FIXTURES_DIR, "save");

function recordScenario(scenario) {
    const { env, runtime } = createGameRuntime({ seed: scenario.seed });
    const steps = playTranscript(runtime, env, scenario.steps);
    return {
        name: scenario.name,
        seed: scenario.seed,
        clockStart: DEFAULT_CLOCK_START,
        steps,
        finalState: JSON.parse(JSON.stringify(runtime.state)),
    };
}

function recordDefaults() {
    const { env } = createGameRuntime({ seed: 1 });
    return env.run("JSON.stringify(BashcrawlRuntime.defaultState('/entrance'), null, 2)") + "\n";
}

function recordLegacySave() {
    // A realistic mid-game save: replay the main quest scenario and freeze the
    // resulting state exactly as storage.js would have persisted it.
    const scenario = SCENARIOS.find((s) => s.name === "main-quest-run");
    const { env, runtime } = createGameRuntime({ seed: scenario.seed });
    playTranscript(runtime, env, scenario.steps);
    return JSON.stringify(runtime.state, null, 2) + "\n";
}

function main() {
    const update = process.argv.includes("--update");
    fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
    fs.mkdirSync(SAVE_DIR, { recursive: true });

    const outputs = [];
    for (const scenario of SCENARIOS) {
        outputs.push({
            file: path.join(TRANSCRIPTS_DIR, `${scenario.name}.json`),
            content: JSON.stringify(recordScenario(scenario), null, 2) + "\n",
        });
    }
    outputs.push({ file: path.join(SAVE_DIR, "defaults-current.json"), content: recordDefaults() });
    // The legacy save is a WRITE-ONCE archaeological artifact: it was captured
    // from the pre-TermForge emulator and exists to prove old browser saves
    // keep loading. Never modernize it — delete the file manually if you truly
    // mean to re-capture.
    const legacyFile = path.join(SAVE_DIR, "save-v1-legacy.json");
    if (!fs.existsSync(legacyFile)) {
        outputs.push({ file: legacyFile, content: recordLegacySave() });
    } else {
        console.log("  frozen     " + path.relative(process.cwd(), legacyFile));
    }

    let changed = 0;
    for (const { file, content } of outputs) {
        const rel = path.relative(process.cwd(), file);
        const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
        if (existing === content) {
            console.log(`  unchanged  ${rel}`);
            continue;
        }
        changed += 1;
        if (update) {
            fs.writeFileSync(file, content);
            console.log(`  ${existing === null ? "created " : "updated "}  ${rel}`);
        } else {
            console.log(`  DIFFERS    ${rel}  (run with --update to rewrite)`);
        }
    }
    if (!update && changed > 0) {
        console.error(`\n${changed} fixture(s) differ from the current runtime.`);
        process.exit(1);
    }
    console.log(update ? "\nFixtures written." : "\nAll fixtures match the current runtime.");
}

main();
