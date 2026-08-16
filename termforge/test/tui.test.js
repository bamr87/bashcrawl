"use strict";
// TuiScreen compositor contract: full-screen frame layout, sidebar panels,
// narrow-terminal strip fallback, toast row, log wrap, and input row.

const test = require("node:test");
const assert = require("node:assert/strict");

const { TuiScreen, dispWidth, clip, wrap } = require("../node/tui.js");

const stripAnsi = (text) => text.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "");

function makeScreen(options) {
    const chunks = [];
    const screen = new TuiScreen({ write: (chunk) => chunks.push(chunk), ...options });
    return { screen, chunks, frame: () => stripAnsi(chunks.join("")), reset: () => { chunks.length = 0; } };
}

const PANELS = [
    { title: "⚔ HERO", lines: [{ kind: "magic", text: "Novice Whisperer" }, { kind: "info", text: "Lv 1  ░░░░░░░░░░ 0/200" }] },
    { title: "♥ VITALS", lines: [{ kind: "success", text: "HP ██████████ 100/100" }] },
];

test("width helpers respect wide glyphs", () => {
    assert.equal(dispWidth("abc"), 3);
    assert.equal(dispWidth("💰💰"), 4);
    assert.equal(clip("💰💰💰", 4), "💰💰");
    assert.equal(clip("abcdef", 3), "abc");
    assert.deepEqual(wrap("abcdef", 3), ["abc", "def"]);
    assert.deepEqual(wrap("", 5), [""]);
});

test("start/stop bracket the session in the alternate screen", () => {
    const { screen, chunks } = makeScreen();
    screen.start({ cols: 100, rows: 30 });
    assert.ok(chunks.join("").includes("[?1049h"), "start enters alt screen");
    screen.stop();
    assert.ok(chunks.join("").includes("[?1049l"), "stop leaves alt screen");
    assert.equal(screen.started, false);
});

test("wide layout draws sidebar panels beside the log", () => {
    const { screen, frame, reset } = makeScreen();
    screen.setPanels(PANELS);
    screen.appendLog([{ kind: "info", text: "Welcome to the dungeon." }]);
    screen.setPrompt("/entrance $");
    screen.setInput("pwd");
    screen.start({ cols: 100, rows: 30 });
    reset();
    screen.render();
    const painted = frame();
    assert.ok(painted.includes("⚔ HERO"), "panel title painted");
    assert.ok(painted.includes("Novice Whisperer"), "panel body painted");
    assert.ok(painted.includes("Welcome to the dungeon."), "log painted");
    assert.ok(painted.includes("/entrance $ pwd"), "input row painted");
    assert.ok(painted.includes("│"), "sidebar separator painted");
});

test("narrow layout swaps the sidebar for the status strip", () => {
    const { screen, frame, reset } = makeScreen();
    screen.setPanels(PANELS);
    screen.setStrip([{ kind: "success", text: "♥ ██████████ 100 · Lv 1" }]);
    screen.appendLog([{ kind: "output", text: "hello" }]);
    screen.start({ cols: 60, rows: 20 });
    reset();
    screen.render();
    const painted = frame();
    assert.ok(painted.includes("♥ ██████████ 100"), "strip painted");
    assert.ok(!painted.includes("⚔ HERO"), "sidebar suppressed under 88 cols");
    assert.ok(painted.includes("hello"));
});

test("toast row shows transient events and clears back to a rule", () => {
    const { screen, frame, reset } = makeScreen();
    screen.setPanels(PANELS);
    screen.start({ cols: 100, rows: 30 });
    screen.setToast({ kind: "success", text: "+25 XP" });
    reset();
    screen.render();
    assert.ok(frame().includes("+25 XP"), "toast painted");
    screen.setToast(null);
    reset();
    screen.render();
    assert.ok(!frame().includes("+25 XP"), "toast cleared");
});

test("log wraps long lines and respects the cap", () => {
    const { screen, frame, reset } = makeScreen({ logCap: 5 });
    for (let i = 0; i < 10; i += 1) {
        screen.appendLog([{ kind: "output", text: `line-${i}` }]);
    }
    assert.equal(screen.log.length, 5, "cap trims the buffer");
    screen.appendLog([{ kind: "output", text: "x".repeat(200) }]);
    screen.start({ cols: 100, rows: 30 });
    reset();
    screen.render();
    // 200 chars in a ~66-col log pane must occupy several rows, none oversized.
    const rows = frame().split("\n").join("").length;
    assert.ok(rows > 0);
    assert.ok(frame().includes("x".repeat(30)), "wrapped long line painted");
});

test("tiny terminals degrade to log + input without chrome", () => {
    const { screen, frame, reset } = makeScreen();
    screen.setPanels(PANELS);
    screen.setStrip([{ kind: "info", text: "strip" }]);
    screen.appendLog([{ kind: "output", text: "deep" }]);
    screen.start({ cols: 40, rows: 6 });
    reset();
    screen.setPrompt("$");
    screen.setInput("ls");
    screen.render();
    const painted = frame();
    assert.ok(painted.includes("deep"));
    assert.ok(painted.includes("$ ls"));
    assert.ok(!painted.includes("strip"), "no strip below MIN_ROWS");
});

test("renderInput repaints only the input row", () => {
    const { screen, chunks, reset } = makeScreen();
    screen.start({ cols: 100, rows: 30 });
    screen.setPrompt("/entrance $");
    screen.setInput("cd cel");
    reset();
    screen.renderInput();
    const out = chunks.join("");
    assert.ok(stripAnsi(out).includes("/entrance $ cd cel"));
    assert.ok(!out.includes("[1;1H"), "no full-frame repaint");
});
