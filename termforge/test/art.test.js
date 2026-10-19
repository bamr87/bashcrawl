"use strict";
// Art contract: every picture the framework and the game draw is an ASCII
// Motion clip (termforge/motion/, motion/art/ — .asciimtn files the editor
// opens), rendered through Shell#art. No art lives in code as string literals.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { Shell } = require("../core/shell.js");
const flavour = require("../core/packs/flavour.js");
const { DEFAULT_ART } = require("../core/art.js");
const { RUNTIME_FILES, WEB_JS, loadGameData } = require("./helpers/game-harness.js");
const { loadClassic } = require("./helpers/load-classic.js");

const REPO = path.resolve(__dirname, "..", "..");
const world = { root: "/", directories: { "/": { children: [] } }, files: {} };

test("the Shell draws the framework's default art and lets an app override it", () => {
    const plain = new Shell({ world, packs: [flavour] });
    assert.deepEqual(Object.keys(DEFAULT_ART).sort(), ["banner", "cow", "sl"]);
    assert.match(plain.art("banner"), /T E R M F O R G E/);
    assert.match(plain.art("cow"), /\(oo\)/);
    assert.equal(plain.art("nope"), "");
    const cow = plain.handlers.cowsay.call(plain, ["hi"])[0].text.split("\n");
    assert.deepEqual(cow.slice(0, 3), [" ____", "< hi >", " ----"]);
    assert.match(cow[4], /\(oo\)/);

    const branded = new Shell({ world, packs: [flavour], art: { banner: "  MY APP\n  ======", logo: "<>" } });
    assert.equal(branded.handlers.banner.call(branded, [])[0].text, "  MY APP\n  ======");
    assert.equal(branded.art("logo"), "<>");
    assert.match(branded.art("sl"), /=====O/);
    assert.equal(branded.artLibrary().has("cow"), true);
});

function gameRuntime() {
    const env = loadClassic({ files: [...RUNTIME_FILES, path.join(WEB_JS, "hud.js")] });
    env.sandbox.__data = loadGameData();
    return { env, runtime: env.run("new BashcrawlRuntime.Runtime(__data)") };
}

test("every piece of game art resolves to its ASCII Motion clip", () => {
    const { env, runtime } = gameRuntime();
    const clips = env.sandbox.BashcrawlArtClips;
    for (const name of Object.keys(clips)) {
        assert.ok(runtime.art(name).trim().length > 0, `art clip ${name} renders empty`);
    }
    assert.match(runtime.art("banner"), /Type {2}pwd {2}to begin/);
    for (const key of env.sandbox.BashcrawlHud.VIGNETTE_KEYS) {
        assert.ok(clips[`room-${key}`], `room-${key} has no clip`);
    }
    runtime.execute("cd cellar");
    const out = runtime.execute("./treasure");
    assert.equal(out[0].kind, "art");
    assert.equal(out[0].text, runtime.art("encounter-treasure"));
});

// Runs of 3+ lines that are nothing but an art-looking string literal are a
// picture in code. Move it to an .asciimtn (termforge/node/motion-cli.js
// from-text) and draw it with Shell#art. gem.js's pixel masks and the hero
// sprite's part bitmaps (web/src/hero/sprite.ts) are bitmaps for rects, not
// text art, so they are exempt.
test("no hardcoded multi-line ASCII art in the JS and TSX sources", () => {
    const roots = ["web/assets/js", "web/src", "termforge/core", "termforge/node", "termforge/apps"].map((r) => path.join(REPO, r));
    const skip = /vendor[\\/]|fx-clips\.js$|art-clips\.js$|core[\\/]art\.js$|node[\\/]gem\.js$|hero[\\/]sprite\.ts$|web[\\/]dist[\\/]|node_modules[\\/]/;
    const artLine = /^\s*["'`][^"'`]*[\\/|_=*~^()<>[\]{}#.+-]{2,}[^"'`]*["'`],?\s*$/;
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        return /\.(js|ts|tsx)$/.test(entry.name) ? [full] : [];
    });
    const offences = [];
    for (const file of roots.flatMap(walk)) {
        if (skip.test(file)) continue;
        let run = 0;
        fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
            run = artLine.test(line) ? run + 1 : 0;
            if (run === 3) offences.push(`${path.relative(REPO, file)}:${i - 1}`);
        });
    }
    assert.deepEqual(offences, [], "hardcoded art: move it into an ASCII Motion clip");
    const index = fs.readFileSync(path.join(REPO, "web", "index.html"), "utf8");
    for (const pre of index.match(/<pre[^>]*>[\s\S]*?<\/pre>/g) || []) {
        assert.ok(!/<pre[^>]*>[^<]*\S[^<]*<\/pre>/.test(pre) || /data-art=/.test(pre), `index.html <pre> holds inline art: ${pre.slice(0, 60)}`);
    }
});
