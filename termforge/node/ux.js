"use strict";
// UI/UX review for the terminal stage.
//
// Drives the same compositor and stage planner the TTY host uses, records
// every painted frame, and scores the failures that kept shipping:
// effects written into the log, art covered by the stage, full-width wipes,
// viewport slides, a stage that vanishes, and a stage that eats the log.
//
//   node termforge/node/ux.js
//   node --test termforge/test/ux-review.test.js

const { TuiScreen } = require("./tui.js");
const { TerminalView } = require("./index.js").view;
const { SessionController } = require("./index.js").session;
const { createApp } = require("../apps/bashcrawl.js");
const { planMotion, review } = require("../apps/bashcrawl-motion.js");
const { presentStage } = require("./motion.js");

const SCRIPT = [
    { line: "pwd", stage: "RADAR", log: "____" },
    { line: "ls", stage: "MANIFEST", log: "____" },
    { line: "cat scroll", stage: null, log: "CELLAR" },
];

function decode(data, cols, rows) {
    const grid = Array.from({ length: rows }, () => Array(cols).fill(" "));
    let x = 0;
    let y = 0;
    let i = 0;
    const cup = (row, col) => {
        y = Math.max(0, Math.min(rows - 1, row - 1));
        x = Math.max(0, Math.min(cols - 1, col - 1));
    };
    while (i < data.length) {
        const ch = data[i];
        if (ch === "\u001b" && data[i + 1] === "[") {
            let j = i + 2;
            while (j < data.length && !(data.charCodeAt(j) >= 64 && data.charCodeAt(j) <= 126)) j += 1;
            if (j >= data.length) break;
            const cmd = data[j];
            const params = data.slice(i + 2, j).split(";");
            const n = (k, d = 1) => {
                const v = parseInt(params[k], 10);
                return Number.isFinite(v) ? v : d;
            };
            if (cmd === "H" || cmd === "f") cup(n(0, 1), n(1, 1));
            else if (cmd === "A") y = Math.max(0, y - n(0, 1));
            else if (cmd === "B") y = Math.min(rows - 1, y + n(0, 1));
            else if (cmd === "C") x = Math.min(cols - 1, x + n(0, 1));
            else if (cmd === "D") x = Math.max(0, x - n(0, 1));
            else if (cmd === "K" && y >= 0 && y < rows) {
                const start = n(0, 0) === 2 ? 0 : x;
                for (let c = start; c < cols; c += 1) grid[y][c] = " ";
            } else if (cmd === "J" && n(0, 0) === 2) {
                for (let r = 0; r < rows; r += 1) grid[r].fill(" ");
                x = 0;
                y = 0;
            }
            i = j + 1;
            continue;
        }
        if (ch === "\r") x = 0;
        else if (ch === "\n") {
            y = Math.min(rows - 1, y + 1);
            x = 0;
        } else if (ch >= " ") {
            if (x >= cols) {
                x = 0;
                y = Math.min(rows - 1, y + 1);
            }
            if (y < rows) grid[y][x] = ch;
            x += 1;
        }
        i += 1;
    }
    return grid.map((row) => row.join("").replace(/\s+$/, ""));
}

function finding(rule, pass, detail, evidence) {
    return { rule, severity: "error", pass: Boolean(pass), detail, evidence: evidence || "" };
}

function analyze(trace) {
    const findings = [];
    const catalog = review();
    const treatments = new Set(catalog.map((row) => row.treatment));
    findings.push(finding(
        "coverage",
        treatments.has("stage") && treatments.has("wash") && treatments.has("layout") && treatments.has("attention") && treatments.has("toast"),
        "every option is stage, wash, layout, attention, or toast",
        catalog.map((row) => `${row.cmd}:${row.treatment}`).slice(0, 8).join(" "),
    ));

    for (const turn of trace.turns) {
        findings.push(finding("cursor-bounds", turn.frames.every((frame) => frame.validCursor), `${turn.line}: cursor addresses stay inside the terminal`));
        const injected = turn.frames.some((frame) => {
            if (!frame.stage) return false;
            return frame.stage.split("\n").some((line) => line.trim() && frame.log.includes(line.trim()));
        });
        findings.push(finding(
            "log-not-injected",
            !injected,
            `${turn.line}: stage text stays out of the log`,
            injected ? "stage line found in screen.log" : "log clean",
        ));
        findings.push(finding(
            "no-shift",
            turn.frames.every((frame) => frame.shift == null && frame.sweep == null),
            `${turn.line}: no viewport slide or sweep`,
        ));
        findings.push(finding(
            "log-room",
            turn.frames.every((frame) => frame.height >= frame.minimumLog),
            `${turn.line}: log keeps at least 12 rows beside the stage`,
            turn.frames.map((frame) => `h=${frame.height} stage=${frame.stageRows}`).join(" "),
        ));
        const wiped = turn.frames.some((frame) => frame.grid.some((row) => (row.match(/━/g) || []).length > 20));
        findings.push(finding(
            "no-wipe",
            !wiped,
            `${turn.line}: no full-width bar replaces a row`,
        ));
        if (turn.expectLog) {
            const held = turn.frames.every((frame) => frame.log.includes(turn.expectLog));
            findings.push(finding(
                "log-art-survives",
                held,
                `${turn.line}: ${turn.expectLog} remains in the log`,
            ));
        }
        const last = turn.frames[turn.frames.length - 1];
        if (turn.expectStage) {
            findings.push(finding(
                "stage-holds",
                Boolean(last && last.stage.includes(turn.expectStage) && (!last.visibleStage || last.grid.some((row) => row.includes(turn.expectStage)))),
                `${turn.line}: ${turn.expectStage} still painted after the clip`,
            ));
            const distinct = new Set(turn.frames.map((frame) => frame.stage)).size;
            findings.push(finding(
                "motion-changes",
                distinct >= 2 || trace.reducedMotion,
                `${turn.line}: the stage actually changes`,
                `${distinct} distinct frames`,
            ));
            const inLogPane = last.grid.slice(last.logTop - 1, last.logBottom).some((row) => {
                const text = last.wide ? (last.dock === "left" ? row.slice(last.sepCol) : row.slice(0, last.sepCol - 1)) : row;
                return text.includes(turn.expectStage);
            });
            findings.push(finding(
                "stage-disjoint",
                !inLogPane,
                `${turn.line}: stage art stays out of the log pane`,
            ));
        } else {
            findings.push(finding(
                "stage-clears",
                !last || !last.stage.trim(),
                `${turn.line}: a wash command clears the stage`,
                last ? last.stage.slice(0, 40) : "",
            ));
        }
    }
    return {
        cols: trace.cols,
        rows: trace.rows,
        findings,
        pass: findings.every((item) => item.pass),
    };
}

function formatReport(result) {
    const lines = [`UX review ${result.cols}x${result.rows}  ${result.pass ? "PASS" : "FAIL"}`];
    for (const item of result.findings) {
        lines.push(`  ${item.pass ? "PASS" : "FAIL"} ${item.rule}  ${item.detail}${item.evidence ? `  (${item.evidence})` : ""}`);
    }
    return lines.join("\n");
}

function runReview(options) {
    const opts = options || {};
    const cols = opts.cols || 100;
    const rows = opts.rows || 36;
    const script = opts.script || SCRIPT;
    const writes = [];
    const screen = new TuiScreen({ write: (chunk) => writes.push(chunk), color: true });
    const session = createApp().createSession({ hud: true });
    const view = new TerminalView({
        sink: {
            write: (lines) => screen.appendLog(lines),
            clear: () => screen.clearLog(),
        },
        cap: 2000,
    });
    const controller = new SessionController(session, { view });
    view.appendOutputs(session.banner || []);
    const boot = session.hud();
    screen.setPanels(boot.panels);
    screen.setPrompt(boot.prompt);
    screen.setStrip(boot.strip);
    if (opts.dock) screen.setDock(opts.dock);
    screen.start({ cols, rows });
    const turns = [];
    for (const step of script) {
        const outputs = controller.execute(step.line, { echo: true });
        const hud = session.hud();
        screen.setPanels(hud.panels);
        screen.setPrompt(hud.prompt);
        screen.setStrip(hud.strip);
        screen.setStage(null);
        const minimumLog = Math.min(12, screen._geometry().height);
        const error = outputs.some((out) => out && out.kind === "error");
        const plan = planMotion(step.line, { error, events: hud.events, reducedMotion: opts.reducedMotion });
        const count = plan && plan.stage ? plan.frames.length : 1;
        const frames = [];
        for (let i = 0; i < count; i += 1) {
            presentStage(screen, plan, i);
            writes.length = 0;
            screen.render();
            const g = screen._geometry();
            frames.push({
                stage: screen.stage ? screen.stage.join("\n") : "",
                log: screen.log.map((line) => line.text).join("\n"),
                grid: decode(writes.join(""), cols, rows),
                validCursor: (writes.join("").match(/\u001b\[(\d+);(\d+)H/g) || []).every((cup) => {
                    const [row, col] = cup.match(/\d+/g).map(Number);
                    return row >= 1 && row <= rows && col >= 1 && col <= cols;
                }),
                shift: screen.shift,
                sweep: screen.sweep,
                height: g.height,
                stageRows: g.stageRows,
                sepCol: g.sepCol,
                wide: g.wide, logTop: g.top, logBottom: g.logBottom, dock: g.dock,
                visibleStage: g.stageArt.length > 0, minimumLog,
            });
        }
        turns.push({
            line: step.line,
            expectStage: plan && plan.stage ? plan.frames.at(-1).filter((line) => line.trim()).at(-1).trim() : null,
            expectLog: step.log,
            frames,
        });
    }
    const result = analyze({ cols, rows, turns, reducedMotion: opts.reducedMotion });
    result.report = formatReport(result);
    return result;
}

module.exports = { runReview, analyze, formatReport, decode, SCRIPT };

if (require.main === module) {
    const result = runReview();
    process.stdout.write(`${result.report}\n`);
    process.exit(result.pass ? 0 : 1);
}
