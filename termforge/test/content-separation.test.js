"use strict";
// Framework/content separation contract: termforge/core/ is brand-neutral.
// Game voice (strings, fortune deck, banner art) lives with the app and
// reaches the packs through the Shell's uiText copy deck — never hard-coded
// in the framework. This test greps every core file for the flagship game's
// vocabulary; if it fires, move the string into the app's uiText (see
// GAME_UI_TEXT in web/assets/js/runtime.js) and give the framework a neutral
// default in DEFAULT_UI_TEXT (core/shell.js).

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const CORE = path.resolve(__dirname, "..", "core");

// Case-insensitive game vocabulary. `encounters` is deliberately absent: it
// is a legacy key of the world schema (an optional metadata map), not copy.
const FORBIDDEN = [
    /bashcrawl/i,
    /dungeon/i,
    /entrance/i,
    /adventurer/i,
    /grimoire/i,
    /amulet/i,
    /chapel/i,
    /cellar/i,
    /catacomb/i,
    /web port/i,
];

function coreFiles(dir = CORE) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...coreFiles(full));
        else if (entry.name.endsWith(".js")) out.push(full);
    }
    return out;
}

test("termforge/core contains no game vocabulary", () => {
    const offences = [];
    for (const file of coreFiles()) {
        const lines = fs.readFileSync(file, "utf8").split("\n");
        lines.forEach((line, i) => {
            for (const pattern of FORBIDDEN) {
                if (pattern.test(line)) {
                    offences.push(`${path.relative(CORE, file)}:${i + 1} matches ${pattern}: ${line.trim()}`);
                }
            }
        });
    }
    assert.deepStrictEqual(offences, [],
        "game content leaked into the framework — route it through uiText");
});

test("the neutral copy deck covers every key the game overrides", () => {
    const { DEFAULT_UI_TEXT } = require("../core/shell.js");
    const source = fs.readFileSync(
        path.resolve(__dirname, "..", "..", "web", "assets", "js", "runtime.js"), "utf8");
    const match = source.match(/const GAME_UI_TEXT = \{([\s\S]*?)\n {4}\};/);
    assert.ok(match, "runtime.js must declare GAME_UI_TEXT");
    const gameKeys = [...match[1].matchAll(/^ {8}([A-Za-z]\w*):/gm)].map((m) => m[1]);
    assert.ok(gameKeys.length >= 8, `expected the game to override its copy deck, got ${gameKeys}`);
    for (const key of gameKeys) {
        assert.ok(key in DEFAULT_UI_TEXT,
            `GAME_UI_TEXT.${key} has no neutral framework default in DEFAULT_UI_TEXT`);
    }
});
