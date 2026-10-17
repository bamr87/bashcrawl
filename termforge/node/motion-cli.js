#!/usr/bin/env node
"use strict";
// TermForge motion CLI — inspect, preview, and convert ASCII Motion files
// (https://github.com/cameronfoxly/Ascii-Motion) from a terminal.
//
//   motion-cli.js info FILE...              size, frames, duration, warnings
//   motion-cli.js cat FILE [--frame N] [--ansi]
//   motion-cli.js play FILE [--loop] [--speed X] [--plain]
//   motion-cli.js session FILE [-o OUT] [--name NAME]
//                                           any format (JSON/text/v1/v2) -> .asciimtn v1
//   motion-cli.js from-text FILE|- [-o OUT] [--name NAME] [--color HEX]
//                                           plain ASCII art -> one-frame .asciimtn
//   motion-cli.js text FILE                 -> ASCII Motion text export
//
// .asciimtn is the only format the editor opens, so `session` / `from-text`
// are how hand-drawn or exported art becomes editable there. Session files are
// written one cell per line so diffs stay reviewable. Zero dependencies.

const fs = require("node:fs");
const path = require("node:path");

const am = require("../core/ascii-motion.js");

function usage(code) {
    const text = fs.readFileSync(__filename, "utf8").split("\n").slice(3, 13)
        .map((line) => line.replace(/^\/\/ ?/, "")).join("\n");
    (code ? process.stderr : process.stdout).write(`${text}\n`);
    process.exit(code);
}

function parseArgs(argv) {
    const out = { _: [] };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === "-o" || arg === "--out") out.out = argv[++i];
        else if (arg === "--frame") out.frame = Number(argv[++i]);
        else if (arg === "--speed") out.speed = Number(argv[++i]);
        else if (arg === "--name") out.name = argv[++i];
        else if (arg === "--color") out.color = argv[++i];
        else if (arg === "--loop") out.loop = true;
        else if (arg === "--ansi") out.ansi = true;
        else if (arg === "--plain") out.plain = true;
        else if (arg === "-h" || arg === "--help") out.help = true;
        else out._.push(arg);
    }
    return out;
}

function readSource(file) {
    if (!file) usage(2);
    return file === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(file, "utf8");
}

// Stable session v1 layout: everything at 2-space indent except each frame's
// cell map, which keeps one `"x,y": {...}` entry per line in row-major order.
function formatSession(session) {
    const frames = session.animation.frames.map((frame) => {
        const keys = Object.keys(frame.data).sort((a, b) => {
            const [ax, ay] = a.split(",").map(Number);
            const [bx, by] = b.split(",").map(Number);
            return ay - by || ax - bx;
        });
        const cells = keys.map((key) => `          ${JSON.stringify(key)}: ${JSON.stringify(frame.data[key])}`);
        const head = Object.entries(frame).filter(([k]) => k !== "data")
            .map(([k, v]) => `        ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
        return ["      {", ...head, cells.length ? `        "data": {\n${cells.join(",\n")}\n        }` : '        "data": {}', "      }"].join("\n");
    });
    const animation = Object.entries(session.animation).filter(([k]) => k !== "frames")
        .map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
    const top = Object.entries(session).filter(([k]) => k !== "animation")
        .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
    return [
        "{",
        ...top,
        '  "animation": {',
        `    "frames": [\n${frames.join(",\n")}\n    ],`,
        animation.join(",\n"),
        "  }",
        "}",
        "",
    ].join("\n");
}

// Plain text art -> one-frame clip. Leading/trailing blank lines are kept out;
// interior spacing is preserved exactly.
function fromText(raw, options) {
    const opts = options || {};
    const lines = String(raw).replace(/\r\n/g, "\n").replace(/\t/g, "    ").split("\n");
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    while (lines.length && !lines[0].trim()) lines.shift();
    const width = lines.reduce((max, line) => Math.max(max, Array.from(line.replace(/\s+$/, "")).length), 0) || 1;
    const color = opts.color || "#FFFFFF";
    const foreground = {};
    lines.forEach((line, y) => {
        Array.from(line).forEach((ch, x) => {
            if (ch !== " ") foreground[`${x},${y}`] = color;
        });
    });
    return am.toSession({
        canvas: { width, height: lines.length || 1, backgroundColor: "#000000" },
        animation: { frameRate: 12, looping: false },
        frames: [{ duration: 1000, content: lines.length ? lines : [""], colors: { foreground } }],
    }, { name: opts.name || "art" });
}

function writeOut(text, out) {
    if (out) fs.writeFileSync(out, text);
    else process.stdout.write(text);
}

function play(clip, opts) {
    const player = new am.Player({ clip, looping: Boolean(opts.loop), speed: opts.speed > 0 ? opts.speed : 1 });
    const height = clip.height;
    const out = process.stdout;
    let first = true;
    const draw = () => {
        const frame = player.frame();
        const body = (opts.plain ? frame.text : frame.ansi).split("\n");
        while (body.length < height) body.push("");
        if (!first) out.write(`\u001b[${height}A`);
        first = false;
        out.write(body.map((line) => `\u001b[2K${line}`).join("\n") + "\n");
        if (frame.done) return;
        setTimeout(() => {
            player.advance(frame.hold);
            draw();
        }, Math.max(16, frame.hold));
    };
    process.on("SIGINT", () => {
        out.write("\u001b[0m\n");
        process.exit(0);
    });
    draw();
}

function main(argv) {
    const [command, ...rest] = argv;
    const opts = parseArgs(rest);
    if (!command || opts.help || command === "help") usage(command ? 0 : 2);
    const file = opts._[0];
    switch (command) {
        case "info":
            if (!opts._.length) usage(2);
            for (const each of opts._) {
                const info = am.describe(readSource(each));
                process.stdout.write(`${each}: ${info.width}x${info.height}, ${info.frames} frame(s), ${info.durationMs} ms` +
                    ` @ ${info.frameRate} fps${info.looping ? ", looping" : ""} [${info.source}]` +
                    `${info.title ? ` "${info.title}"` : ""}\n`);
                for (const warning of info.warnings) process.stdout.write(`  warning: ${warning}\n`);
            }
            return;
        case "cat": {
            const clip = am.parse(readSource(file));
            const index = opts.frame == null ? 0 : opts.frame;
            const frame = am.renderFrame(clip, index);
            process.stdout.write(`${opts.ansi ? frame.ansi : frame.text}\n`);
            return;
        }
        case "play":
            play(am.parse(readSource(file)), opts);
            return;
        case "session": {
            const name = opts.name || path.basename(file || "art").replace(/\.[^.]+$/, "");
            writeOut(formatSession(am.toSession(readSource(file), { name })), opts.out);
            return;
        }
        case "from-text":
            writeOut(formatSession(fromText(readSource(file), opts)), opts.out);
            return;
        case "text":
            writeOut(am.toText(readSource(file)), opts.out);
            return;
        default:
            process.stderr.write(`motion-cli: unknown command '${command}'\n`);
            usage(2);
    }
}

if (require.main === module) {
    process.stdout.on("error", (err) => {
        if (err.code === "EPIPE") process.exit(0);
        throw err;
    });
    main(process.argv.slice(2));
}

module.exports = { formatSession, fromText, main };
