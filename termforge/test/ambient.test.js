"use strict";
// web/assets/js/ambient.js — ASCII Motion clips playing in the page. A stub
// document is enough: the painter builds text nodes and spans, and the
// reduced-motion path paints a clip's resting frame without a timer.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { WEB_JS } = require("./helpers/game-harness.js");
const CORE = path.resolve(__dirname, "..", "core");

function fakeDocument() {
    const node = (tag) => ({
        tag, style: {}, childNodes: [], isConnected: true, textContent: "",
        appendChild(child) { this.childNodes.push(child); return child; },
        replaceChildren() { this.childNodes = []; },
        get text() { return this.childNodes.map((c) => (c.tag === "#text" ? c.textContent : c.textContent)).join(""); },
    });
    return {
        hidden: false,
        createElement: (tag) => node(tag),
        createTextNode: (text) => ({ tag: "#text", textContent: text }),
        addEventListener() {},
    };
}

function boot({ reduced = false } = {}) {
    const sandbox = { document: fakeDocument(), setTimeout, clearTimeout };
    sandbox.window = sandbox;
    sandbox.matchMedia = (q) => ({ matches: reduced && q.includes("reduce"), addEventListener() {} });
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(CORE, "ascii-motion.js"), "utf8"), sandbox);
    vm.runInContext(fs.readFileSync(path.join(WEB_JS, "ambient.js"), "utf8"), sandbox);
    return sandbox;
}

const CLIP = "ab\n c\n\n,\n\nxy\n z\n";

test("paint merges runs by colour and lets default-coloured cells inherit the CSS colour", () => {
    const sb = boot();
    const am = sb.TermForge.asciiMotion;
    const clip = am.parse({ name: "t", width: 4, height: 1, frames: [{ content: ["abcd"], duration: 100, colors: { foreground: { "1,0": "#ff0000", "2,0": "#ff0000" } } }] });
    const node = sb.document.createElement("pre");
    sb.BashcrawlAmbient.paint(node, am.renderFrame(clip, 0), { width: clip.width, height: clip.height });
    assert.deepEqual(node.childNodes.map((c) => [c.tag, c.textContent, (c.style || {}).color || ""]), [
        ["#text", "a", ""], ["span", "bc", "#ff0000"], ["#text", "d", ""],
    ]);
});

test("under reduced motion a loop rests on its first frame and a reveal on its last", () => {
    const sb = boot({ reduced: true });
    const node = sb.document.createElement("pre");
    assert.ok(sb.BashcrawlAmbient.loop(node, CLIP));
    assert.equal(node.text, "ab\n c");
    assert.equal(sb.BashcrawlAmbient.isPlaying(node), false);
    let done = 0;
    assert.ok(sb.BashcrawlAmbient.once(node, CLIP, { onDone: () => { done += 1; } }));
    assert.equal(node.text, "xy\n z");
    assert.equal(done, 1);
});

test("a playing loop advances frames, survives being inserted after play(), and stops once detached", async () => {
    const sb = boot();
    const node = sb.document.createElement("pre");
    node.isConnected = false; // built first, inserted after — the first frame still paints
    assert.ok(sb.BashcrawlAmbient.loop(node, CLIP));
    assert.equal(node.text, "ab\n c");
    assert.equal(sb.BashcrawlAmbient.isPlaying(node), true);
    node.isConnected = true;
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(node.text, "xy\n z", "the second frame painted after its hold");
    node.isConnected = false;
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(sb.BashcrawlAmbient.isPlaying(node), false, "a detached node ends its loop");
    assert.equal(sb.BashcrawlAmbient.play(node, 42), null, "something that is not a clip plays nothing");
});
