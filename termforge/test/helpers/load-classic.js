"use strict";
// vm-based loader for classic (IIFE) browser scripts.
//
// Builds a fresh sandbox realm per call with `window` pointing at the sandbox
// itself, so files written for <script> tags (storage.js, runtime.js, the
// vendored TermForge core) load unmodified under node. The sandbox is seeded
// with deterministic shims:
//
//   - Date        → FakeDate: `new Date()` / `Date.now()` read a mutable clock,
//                   and the local-time accessors the game uses (getFullYear/
//                   getMonth/getDate/toString) are pinned to UTC so golden
//                   fixtures are identical in every host timezone.
//   - Math.random → seeded LCG, patched inside the realm's own Math.
//   - btoa/atob   → Buffer-backed polyfills (node has no btoa global pre-16,
//                   and the runtime's `save export` depends on it).
//   - localStorage → optional in-memory store for storage.js tests.
//
// The clock only moves when a test calls advance()/setNow() — never on its
// own — which is what makes recorded transcripts replayable forever.

const fs = require("node:fs");
const vm = require("node:vm");

// 2026-01-15T12:00:00Z — arbitrary fixed instant all fixtures are recorded at.
const DEFAULT_CLOCK_START = Date.UTC(2026, 0, 15, 12, 0, 0);

function makeFakeDate(clock) {
    class FakeDate extends Date {
        constructor(...args) {
            if (args.length === 0) super(clock.now);
            else super(...args);
        }
        static now() {
            return clock.now;
        }
        getFullYear() { return this.getUTCFullYear(); }
        getMonth() { return this.getUTCMonth(); }
        getDate() { return this.getUTCDate(); }
        toString() { return this.toISOString(); }
    }
    return FakeDate;
}

function makeSeededRng(seed) {
    let s = seed >>> 0;
    return function seededRandom() {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

function loadClassic({
    files = [],
    clockStart = DEFAULT_CLOCK_START,
    seed = 42,
    localStorageData = null,
} = {}) {
    const clock = { now: clockStart };
    const sandbox = {};
    sandbox.window = sandbox;
    sandbox.self = sandbox;
    sandbox.console = console;
    sandbox.Date = makeFakeDate(clock);
    sandbox.btoa = (s) => Buffer.from(String(s), "latin1").toString("base64");
    sandbox.atob = (s) => Buffer.from(String(s), "base64").toString("latin1");
    if (localStorageData) {
        const store = new Map(Object.entries(localStorageData));
        sandbox.localStorage = {
            getItem: (k) => (store.has(k) ? store.get(k) : null),
            setItem: (k, v) => { store.set(k, String(v)); },
            removeItem: (k) => { store.delete(k); },
        };
    }
    const context = vm.createContext(sandbox);
    sandbox.__seededRandom = makeSeededRng(seed);
    vm.runInContext("Math.random = __seededRandom;", context);
    delete sandbox.__seededRandom;
    for (const file of files) {
        vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
    }
    return {
        sandbox,
        clock,
        setNow(ms) { clock.now = ms; },
        advance(ms) { clock.now += ms; },
        run(code) { return vm.runInContext(code, context); },
    };
}

module.exports = { loadClassic, makeSeededRng, DEFAULT_CLOCK_START };
