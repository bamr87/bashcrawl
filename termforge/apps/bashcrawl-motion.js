"use strict";
// Shared stage planner for command motion.
//
// UI review of every option, after playing the TTY and the browser:
//
//   stage     ASCII Motion clips play in a reserved band under the log.
//             The last frame holds until the next command. The band never
//             covers log glyphs, never shifts the viewport, and is never
//             written into scrollback. Those three all hid or erased art.
//   wash      Every other motion is a short color wash on the web only.
//             It does not move glyphs. The TTY has no wash; the toast and
//             header attention carry the event.
//   attention Damage pulses the header without moving glyphs.
//   toast     Quest, XP, item, heal, level-up stay on their own row.
//   layout    hud dock / sidebar / fold / width are not effects.
//   flags     -a -F -l and friends stay washes. They are modifiers, not scenes.
//   reduced   One static frame, no timer.
//
// Clips exist for radar, scan, warp, spark, cast, steam, burn, and error.
// climb / rewind / home reuse warp. cat leaves the reader quiet.

const path = require("node:path");

const TermForge = require("../node/index.js");

const HOLD_MS = 72;
const MAX_FRAMES = 6;
const STAGE = new Set(["radar", "scan", "warp", "spark", "cast", "steam", "burn", "error", "climb", "rewind", "home"]);

function fxCatalog() {
    if (!global.TermForge) global.TermForge = TermForge;
    if (!global.BashcrawlFxClips) {
        require(path.join(__dirname, "..", "..", "web", "assets", "js", "fx-clips.js"));
    }
    if (!global.BashcrawlCommandFx) {
        require(path.join(__dirname, "..", "..", "web", "assets", "js", "fx.js"));
    }
    return global.BashcrawlCommandFx;
}

function clipNamed(name) {
    const fx = fxCatalog();
    const source = fx.clipFor(name);
    if (!source || !STAGE.has(name)) return null;
    return TermForge.asciiMotion.parse(source);
}

function framesOf(clip) {
    if (!clip) return [];
    const player = new TermForge.asciiMotion.Player({ clip, looping: false, speed: 1.15 });
    const frames = [];
    while (frames.length < MAX_FRAMES) {
        const frame = player.frame();
        if (frame.done) break;
        const lines = frame.text.split("\n");
        while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
        if (lines.some((line) => line.trim())) frames.push(lines);
        player.advance(frame.hold);
    }
    return frames;
}

function planMotion(line, options) {
    const opts = options || {};
    const fx = fxCatalog();
    const spec = fx.describe(line || "");
    if (opts.error) spec.motion = "error";
    const events = opts.events || [];
    let motion = spec.motion;
    if (!opts.error) {
        if (events.some((ev) => ev && ev.type === "levelup")) motion = "cast";
        else if (events.some((ev) => ev && ev.type === "quest")) motion = "spark";
        else if (events.some((ev) => ev && ev.type === "unlock")) motion = "warp";
    }
    const frames = framesOf(clipNamed(motion));
    if (!frames.length) return null;
    return { motion, frames: opts.reducedMotion ? frames.slice(-1) : frames, hold: HOLD_MS, stage: true };
}

function review() {
    const fx = fxCatalog();
    const rows = [];
    for (const [cmd, entry] of Object.entries(fx.commands || {})) {
        const motion = entry.motion;
        rows.push({
            cmd,
            motion,
            treatment: STAGE.has(motion) ? "stage" : "wash",
        });
    }
    rows.push({ cmd: "_flags", motion: "*", treatment: "wash" });
    rows.push({ cmd: "_layout", motion: "dock|sidebar|fold|width", treatment: "layout" });
    rows.push({ cmd: "_damage", motion: "attention", treatment: "attention" });
    rows.push({ cmd: "_events", motion: "toast", treatment: "toast" });
    return rows;
}

module.exports = { planMotion, clipNamed, framesOf, review, STAGE };
