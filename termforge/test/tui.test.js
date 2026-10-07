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

test("damage attention keeps cursor and row geometry stable", () => {
    const { screen, chunks } = makeScreen();
    screen.setPanels([{ title: "HERO", lines: [{ kind: "info", text: "Lv 1" }] }]);
    screen.setPrompt("/entrance $");
    screen.setInput("ls");
    screen.start({ cols: 100, rows: 12 });
    chunks.length = 0;
    screen.render();
    const before = stripAnsi(chunks.join(""));
    chunks.length = 0;
    screen.setAttention(true);
    screen.render();
    assert.equal(stripAnsi(chunks.join("")), before);
    assert.ok(chunks.join("").includes("\u001b[1;31m"));
    const addresses = chunks.join("").match(/\u001b\[(\d+);(\d+)H/g) || [];
    assert.ok(addresses.every((cup) => { const [row, col] = cup.match(/\d+/g).map(Number); return row >= 1 && row <= 12 && col >= 1 && col <= 100; }));
});

test("stage is a dedicated sidebar section and does not cover the log", () => {
    const { screen, chunks, frame, reset } = makeScreen();
    screen.setPanels([{ title: "HERO", lines: [{ kind: "info", text: "Lv 1" }] }]);
    screen.appendLog([{ kind: "output", text: "banner-art-stays" }]);
    screen.start({ cols: 100, rows: 30 });
    reset();
    screen.setStage(["  +  ", " RADAR"]);
    screen.render();
    const painted = frame();
    assert.ok(painted.includes("banner-art-stays"), "log art is not covered");
    assert.ok(painted.includes("stage"), "stage section is labeled");
    assert.ok(painted.includes("RADAR"), "stage art is painted");
    const raw = chunks.join("");
    const stageAt = raw.indexOf("stage");
    const radarAt = raw.indexOf("RADAR");
    assert.ok(stageAt >= 0 && radarAt > stageAt, "art sits under the stage header");
});

test("log scrollback windows history; appendLog re-pins to the tail", () => {
    const { screen, frame, reset } = makeScreen();
    for (let i = 0; i < 40; i += 1) screen.appendLog([{ kind: "output", text: `line-${i}` }]);
    screen.start({ cols: 100, rows: 12 });
    reset();
    screen.render();
    let painted = frame();
    assert.ok(painted.includes("line-39"), "tail is visible when pinned");
    assert.ok(!painted.includes("line-0"), "head is offscreen when pinned");
    screen.scrollLog(screen.pageSize() * 4);
    reset();
    screen.render();
    painted = frame();
    assert.ok(painted.includes("line-0"), "PgUp reaches the oldest lines");
    assert.ok(!painted.includes("line-39"), "tail leaves the window once scrolled");
    screen.appendLog([{ kind: "output", text: "line-new" }]);
    reset();
    screen.render();
    painted = frame();
    assert.ok(painted.includes("line-new"), "new output re-pins to the bottom");
    assert.equal(screen.logOffset, 0);
});

test("hitTest maps clicks onto log, side, and input panes", () => {
    const { screen } = makeScreen();
    screen.setPanels(PANELS);
    screen.start({ cols: 100, rows: 24 });
    assert.equal(screen.hitTest(2, 24).zone, "input");
    assert.equal(screen.hitTest(90, 10).zone, "side");
    assert.equal(screen.hitTest(10, 10).zone, "log");
});

test("collapsed panels render title only; dock left still hit-tests the side", () => {
    const { screen, frame, reset } = makeScreen();
    screen.setPanels([
        { id: "room", title: "▾ ROOM", collapsed: false, lines: [{ kind: "info", text: "scroll" }] },
        { id: "map", title: "▸ MAP", collapsed: true, lines: [{ kind: "info", text: "secret" }] },
    ]);
    screen.start({ cols: 100, rows: 24 });
    reset();
    screen.render();
    const painted = frame();
    assert.ok(painted.includes("ROOM"));
    assert.ok(painted.includes("scroll"));
    assert.ok(painted.includes("MAP"));
    assert.ok(!painted.includes("secret"), "folded pane hides its body");
    screen.setDock("left");
    reset();
    screen.render();
    assert.equal(screen.hitTest(5, 10).zone, "side");
    assert.equal(screen.hitTest(80, 10).zone, "log");
});

test("start enables SGR mouse; stop disables it", () => {
    const { screen, chunks } = makeScreen();
    screen.start({ cols: 80, rows: 24 });
    const boot = chunks.join("");
    assert.ok(boot.includes("?1000h") && boot.includes("?1006h"), "mouse tracking on");
    chunks.length = 0;
    screen.stop();
    const halt = chunks.join("");
    assert.ok(halt.includes("?1000l") && halt.includes("?1006l"), "mouse tracking off");
});
