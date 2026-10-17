"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const am = require("../core/ascii-motion.js");
const { formatSession, fromText } = require("../node/motion-cli.js");

const CLI = path.resolve(__dirname, "..", "node", "motion-cli.js");

test("from-text turns plain art into a one-frame .asciimtn that renders back exactly", () => {
    const art = "\n   /\\\n  /  \\   \n /____\\\n\n";
    const session = fromText(art, { name: "peak", color: "#22D3EE" });
    assert.equal(session.version, "1.0.0");
    assert.equal(session.name, "peak");
    assert.equal(session.canvas.width, 7);
    assert.equal(session.canvas.height, 3);
    const text = formatSession(session);
    assert.deepEqual(JSON.parse(text), session);
    assert.match(text, /\n {10}"3,0": \{"char":"\/","color":"#22d3ee","bgColor":"transparent"\},\n/);
    assert.equal(am.renderFrame(am.parse(text), 0).text, "   /\\\n  /  \\\n /____\\");
});

test("the CLI flattens a session v2 file into an editor-ready v1 session", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "motion-cli-"));
    const v2 = path.join(dir, "blink.asciimtn");
    fs.writeFileSync(v2, JSON.stringify({
        version: "2.2.0",
        name: "blink",
        canvas: { width: 2, height: 1, canvasBackgroundColor: "#000000" },
        timeline: { frameRate: 10, durationFrames: 2, looping: true },
        layers: [{
            id: "l", name: "l", visible: true, solo: false, propertyTracks: [], effectTracks: [],
            contentFrames: [
                { id: "a", startFrame: 0, durationFrames: 1, data: { "0,0": { char: "*", color: "#ffffff", bgColor: "transparent" } } },
                { id: "b", startFrame: 1, durationFrames: 1, data: { "1,0": { char: "*", color: "#ffffff", bgColor: "transparent" } } },
            ],
        }],
    }));
    const out = path.join(dir, "flat.asciimtn");
    execFileSync(process.execPath, [CLI, "session", v2, "-o", out]);
    const flat = JSON.parse(fs.readFileSync(out, "utf8"));
    assert.equal(flat.version, "1.0.0");
    assert.equal(flat.animation.frames.length, 2);
    assert.equal(flat.animation.looping, true);
    const info = execFileSync(process.execPath, [CLI, "info", out], { encoding: "utf8" });
    assert.match(info, /2x1, 2 frame\(s\), 200 ms @ 10 fps, looping \[session-v1\] "blink"/);
    assert.equal(execFileSync(process.execPath, [CLI, "cat", out, "--frame", "1"], { encoding: "utf8" }), " *\n");
    assert.equal(execFileSync(process.execPath, [CLI, "text", out], { encoding: "utf8" }), "*\n\n,\n\n *\n");
});
