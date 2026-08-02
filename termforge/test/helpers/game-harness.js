"use strict";
// Shared builder for the bashcrawl game runtime under the vm loader.
//
// Both the golden recorder (tools/record-goldens.js) and the golden replayer
// (game-golden.test.js) go through this module, so the environment a fixture
// was recorded in is — by construction — the environment it is replayed in.

const fs = require("node:fs");
const path = require("node:path");
const { loadClassic, DEFAULT_CLOCK_START } = require("./load-classic.js");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const WEB_JS = path.join(REPO_ROOT, "web", "assets", "js");
const DATA_DIR = path.join(REPO_ROOT, "web", "data");
const FIXTURES_DIR = path.resolve(__dirname, "..", "fixtures");

// Classic scripts the game runtime needs, in index.html order: the vendored
// TermForge core first (exactly as index.html loads it), then the runtime.
// Loading the vendor copies (not termforge/core/) means these tests exercise
// what the browser actually ships; the vendor freshness check guarantees the
// two trees are byte-identical.
const VENDOR_JS = path.join(WEB_JS, "vendor", "termforge");
const RUNTIME_FILES = [
    path.join(VENDOR_JS, "protocol.js"),
    path.join(VENDOR_JS, "parser.js"),
    path.join(VENDOR_JS, "state.js"),
    path.join(VENDOR_JS, "vfs.js"),
    path.join(VENDOR_JS, "hooks.js"),
    path.join(VENDOR_JS, "registry.js"),
    path.join(VENDOR_JS, "shell.js"),
    path.join(VENDOR_JS, "packs", "posix.js"),
    path.join(VENDOR_JS, "packs", "flavour.js"),
    path.join(VENDOR_JS, "view.js"),
    path.join(VENDOR_JS, "sinks", "dom.js"),
    path.join(VENDOR_JS, "sinks", "ansi.js"),
    path.join(VENDOR_JS, "input.js"),
    path.join(WEB_JS, "runtime.js"),
];

const STORAGE_FILE = path.join(WEB_JS, "storage.js");

function loadGameData() {
    const read = (name) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
    return { world: read("world.json"), quests: read("quests.json"), commands: read("commands.json") };
}

// Build a Runtime inside a fresh deterministic sandbox. Options:
//   seed / clockStart   — determinism knobs (recorded into each fixture)
//   withStorage         — also load storage.js (needs localStorageData)
//   localStorageData    — {key: rawJsonString} backing the localStorage shim
//   state               — vm-side expression for the initial state (default:
//                         a fresh defaultState for the world root)
function createGameRuntime({
    seed,
    clockStart = DEFAULT_CLOCK_START,
    withStorage = false,
    localStorageData = null,
    stateExpr = "BashcrawlRuntime.defaultState(__data.world.root)",
} = {}) {
    const files = withStorage ? [STORAGE_FILE, ...RUNTIME_FILES] : [...RUNTIME_FILES];
    const env = loadClassic({ files, clockStart, seed, localStorageData });
    const data = loadGameData();
    env.sandbox.__data = data;
    const runtime = env.run(`new BashcrawlRuntime.Runtime(__data, ${stateExpr})`);
    delete env.sandbox.__data;
    return { env, data, runtime };
}

// Execute a scenario's steps in order. A step is either a plain command string
// or { line, advanceMs } — advanceMs moves the fake clock BEFORE the line runs
// (how fixtures exercise speed-run timing and daily rollovers).
function playTranscript(runtime, env, steps) {
    const record = [];
    for (const step of steps) {
        const line = typeof step === "string" ? step : step.line;
        const advanceMs = typeof step === "object" && step.advanceMs ? step.advanceMs : 0;
        if (advanceMs) env.advance(advanceMs);
        const outputs = JSON.parse(JSON.stringify(runtime.execute(line)));
        const entry = { line, outputs };
        if (advanceMs) entry.advanceMs = advanceMs;
        record.push(entry);
    }
    return record;
}

module.exports = {
    REPO_ROOT,
    WEB_JS,
    DATA_DIR,
    FIXTURES_DIR,
    RUNTIME_FILES,
    STORAGE_FILE,
    loadGameData,
    createGameRuntime,
    playTranscript,
};
