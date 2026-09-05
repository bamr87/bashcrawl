"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { WEB_JS, createGameRuntime } = require("./helpers/game-harness.js");
const { loadClassic } = require("./helpers/load-classic.js");

const PARSER = path.join(WEB_JS, "vendor", "termforge", "parser.js");
const FX = path.join(WEB_JS, "fx.js");

// The handler literal in runtime.js is the contract (validate_runtime_commands.py
// guards it); deriving from it here means a new command cannot ship without FX.
function handlerNames() {
    return Object.keys(createGameRuntime().runtime.handlers);
}

function catalog() {
    const env = loadClassic({ files: [PARSER, FX] });
    return env.sandbox.BashcrawlCommandFx;
}

test("every runtime handler has a command FX (aliases included)", () => {
    const fx = catalog();
    const names = handlerNames();
    assert.ok(names.length >= 70, `expected the full handler set, got ${names.length}`);
    for (const name of names) {
        const spec = fx.describe(name);
        assert.equal(spec.known, true, `${name} should be a known FX command`);
        assert.ok(spec.motion, `${name} needs a motion`);
        assert.ok(spec.accent.startsWith("#"), `${name} needs an accent`);
    }
});

test("option combinations produce unique FX keys", () => {
    const fx = catalog();
    const lines = [
        "ls", "ls -a", "ls -F", "ls -l", "ls -la", "ls -laF", "ls -lah",
        "ls -aF", "grep foo", "grep -i foo", "grep -r foo", "grep -n foo",
        "grep -v foo", "grep -ril foo", "grep -c foo", "head scroll", "head -n 20 scroll",
        "tail scroll", "tail -n 5 scroll", "tail -f scroll", "wc scroll", "wc -l scroll",
        "sort", "sort -n", "sort -r", "sort -u", "sort -nr", "uniq", "uniq -c",
        "find . -name scroll", "find . -type f", "chmod +x spell", "chmod -x spell",
        "cd cellar", "cd ..", "cd -", "cd ~", "cat scroll", "cat scroll | wc -l",
        "ls -F | grep '*'", "./treasure", "boguscmd",
    ];
    const keys = lines.map((line) => fx.describe(line).key);
    const unique = new Set(keys);
    assert.equal(unique.size, keys.length, `duplicate FX keys: ${keys.join(" | ")}`);
});

test("cd variants and exec/pipe/redirect specialize the motion", () => {
    const fx = catalog();
    assert.equal(fx.describe("cd cellar").motion, "warp");
    assert.equal(fx.describe("cd ..").motion, "climb");
    assert.equal(fx.describe("cd -").motion, "rewind");
    assert.equal(fx.describe("cd ~").motion, "home");
    assert.equal(fx.describe("./statue").exec, true);
    assert.equal(fx.describe("./statue").motion, "cast");
    assert.equal(fx.describe("cat scroll | wc -l").piped, true);
    assert.equal(fx.describe("echo hi > notes").redirect, "write");
    assert.equal(fx.describe("echo hi >> notes").redirect, "append");
    assert.equal(fx.describe("nope").motion, "error");
    assert.equal(fx.describe("ls -laF").flags.join(""), "Fal");
    assert.equal(fx.describe("cat scroll").motion, "cat");
    assert.equal(fx.describe("less scroll").cmd, "cat");
    assert.equal(fx.outputLineCount([{ kind: "output", text: "a\nb\nc" }]), 3);
});
