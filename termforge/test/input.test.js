"use strict";
// Input-layer tests: the pure helpers shared with the browser, the LineEditor
// used by byte-stream hosts, and the TTY byte decoder.

const test = require("node:test");
const assert = require("node:assert");
const { historyStep, applyCompletion, LineEditor, createByteDecoder } = require("../core/input.js");

test("historyStep mirrors the historical index math", () => {
    const state = { history: ["a", "b", "c"], historyIndex: 3 };
    assert.strictEqual(historyStep(state, -1), "c");
    assert.strictEqual(historyStep(state, -1), "b");
    assert.strictEqual(historyStep(state, -1), "a");
    assert.strictEqual(historyStep(state, -1), "a", "clamps at the oldest entry");
    assert.strictEqual(historyStep(state, 1), "b");
    assert.strictEqual(historyStep(state, 1), "c");
    assert.strictEqual(historyStep(state, 1), "", "stepping past the newest clears the input");
    assert.strictEqual(historyStep({ history: [], historyIndex: -1 }, -1), null);
});

test("applyCompletion: single, multiple, none", () => {
    assert.deepStrictEqual(applyCompletion("cat scr", ["scroll"]), { value: "cat scroll", echo: null });
    assert.deepStrictEqual(applyCompletion("s", ["sort", "sed"]), { value: null, echo: "sort  sed" });
    assert.deepStrictEqual(applyCompletion("zz", []), { value: null, echo: null });
});

function makeEditor(overrides = {}) {
    const written = [];
    const submitted = [];
    const state = { history: ["pwd", "ls"], historyIndex: 2 };
    const editor = new LineEditor({
        promptLabel: () => "/w $",
        completions: (text) => (text === "sc" ? ["scroll"] : text === "s" ? ["sort", "sed"] : []),
        state,
        onSubmit: (line) => submitted.push(line),
        write: (chunk) => written.push(chunk),
        ...overrides,
    });
    return { editor, written, submitted, state };
}

test("LineEditor: typing, backspace, submit", () => {
    const { editor, written, submitted } = makeEditor();
    for (const ch of "lss") editor.feed({ type: "char", ch });
    editor.feed({ type: "backspace" });
    editor.feed({ type: "submit" });
    assert.deepStrictEqual(submitted, ["ls"]);
    assert.strictEqual(written.join(""), "lss\b \b\r\n");
    assert.strictEqual(editor.buffer, "");
});

test("LineEditor: history recall redraws the line", () => {
    const { editor, written } = makeEditor();
    editor.feed({ type: "histPrev" });
    assert.strictEqual(editor.buffer, "ls");
    assert.ok(written.at(-1).endsWith("/w $ ls"));
    editor.feed({ type: "histPrev" });
    assert.strictEqual(editor.buffer, "pwd");
});

test("LineEditor: completion applies or echoes candidates", () => {
    const { editor, written } = makeEditor();
    for (const ch of "sc") editor.feed({ type: "char", ch });
    editor.feed({ type: "complete" });
    assert.strictEqual(editor.buffer, "scroll");
    const e2 = makeEditor();
    e2.editor.feed({ type: "char", ch: "s" });
    e2.editor.feed({ type: "complete" });
    assert.strictEqual(e2.editor.buffer, "s", "ambiguous completion keeps the buffer");
    assert.ok(e2.written.join("").includes("sort  sed"));
});

test("LineEditor: interrupt clears, eof signals the host", () => {
    let eof = false;
    const { editor, written } = makeEditor({ onEof: () => { eof = true; } });
    editor.feed({ type: "char", ch: "x" });
    editor.feed({ type: "interrupt" });
    assert.strictEqual(editor.buffer, "");
    assert.ok(written.join("").includes("^C"));
    editor.feed({ type: "eof" });
    assert.ok(eof);
});

function decodeAll(chunks) {
    const events = [];
    const feed = createByteDecoder((ev) => events.push(ev));
    for (const chunk of chunks) feed(chunk);
    return events;
}

test("byte decoder: line endings, controls, arrows, chunk-spanning escapes", () => {
    assert.deepStrictEqual(decodeAll(["hi\r\n"]).map((e) => e.type), ["char", "char", "submit"]);
    assert.deepStrictEqual(decodeAll(["a\r", "\nb"]).map((e) => e.type), ["char", "submit", "char"],
        "CRLF split across chunks submits once");
    assert.deepStrictEqual(decodeAll(["a\r\u0000"]).map((e) => e.type), ["char", "submit"],
        "telnet CR NUL submits once");
    assert.deepStrictEqual(decodeAll(["\u007f", "\b"]).map((e) => e.type), ["backspace", "backspace"]);
    assert.deepStrictEqual(decodeAll(["\u0003", "\u0004", "\u000c", "\t"]).map((e) => e.type),
        ["interrupt", "eof", "clearScreen", "complete"]);
    assert.deepStrictEqual(decodeAll(["\u001b[A", "\u001b", "[B"]).map((e) => e.type),
        ["histPrev", "histNext"], "escape sequences survive chunk boundaries");
    assert.deepStrictEqual(decodeAll(["\u001b[C"]), [{ type: "arrow", dir: "right" }]);
    assert.deepStrictEqual(decodeAll(["\u001b[D"]), [{ type: "arrow", dir: "left" }]);
    assert.deepStrictEqual(decodeAll(["é¥"]).map((e) => e.ch), ["é", "¥"], "non-ASCII passes through");
});

test("byte decoder: pager keys and SGR mouse, including split CSI", () => {
    assert.deepStrictEqual(decodeAll(["\u001b[5~"]), [{ type: "page", dir: "up" }]);
    assert.deepStrictEqual(decodeAll(["\u001b[6~"]), [{ type: "page", dir: "down" }]);
    assert.deepStrictEqual(decodeAll(["\u001b[5;2~"]), [{ type: "page", dir: "up" }], "shift+pageup");
    assert.deepStrictEqual(decodeAll(["\u001b[H"]), [{ type: "home" }]);
    assert.deepStrictEqual(decodeAll(["\u001b[F"]), [{ type: "end" }]);
    assert.deepStrictEqual(decodeAll(["\u001b[<64;10;5M"]), [{
        type: "mouse", btn: 64, x: 10, y: 5, down: true, wheel: 1,
    }]);
    assert.deepStrictEqual(decodeAll(["\u001b[<65;10;5M"]), [{
        type: "mouse", btn: 65, x: 10, y: 5, down: true, wheel: -1,
    }]);
    assert.deepStrictEqual(decodeAll(["\u001b[<0;4;20M"]), [{
        type: "mouse", btn: 0, x: 4, y: 20, down: true, wheel: 0,
    }]);
    assert.deepStrictEqual(decodeAll(["\u001b[<0;4;20m"]), [{
        type: "mouse", btn: 0, x: 4, y: 20, down: false, wheel: 0,
    }]);
    assert.deepStrictEqual(
        decodeAll(["\u001b[<64;", "12;8M"]).map((e) => e.wheel),
        [1],
        "SGR mouse survives chunk boundaries",
    );
});

test("line editing preserves Unicode around insertion and delete", () => {
    const { editor, submitted } = makeEditor({ echo: false });
    for (const ch of "echo A界😀C") editor.feed({ type: "char", ch });
    editor.feed({ type: "arrow", dir: "left" });
    editor.feed({ type: "backspace" });
    editor.feed({ type: "char", ch: "B" });
    editor.feed({ type: "delete" });
    editor.feed({ type: "home" });
    editor.feed({ type: "char", ch: "#" });
    editor.feed({ type: "end" });
    editor.feed({ type: "submit" });
    assert.deepStrictEqual(submitted, ["#echo A界B"]);
});

test("an overflowing line is bounded and never submitted as a truncated command", () => {
    let overflows = 0;
    const { editor, submitted } = makeEditor({ maxLine: 8, onOverflow: () => overflows++ });
    for (const ch of "echo truncated") editor.feed({ type: "char", ch });
    assert.equal(editor.buffer.length, 8);
    assert.equal(overflows, 1);
    editor.feed({ type: "submit" });
    assert.deepStrictEqual(submitted, []);
    for (const ch of "pwd") editor.feed({ type: "char", ch });
    editor.feed({ type: "submit" });
    assert.deepStrictEqual(submitted, ["pwd"]);
});

test("horizontal input scrolling keeps wide glyphs and the cursor in bounds", () => {
    const { inputWindow, displayWidth } = require("../core/input.js");
    const text = "echo " + "界😀".repeat(40);
    for (const columns of [20, 40, 80]) {
        for (const cursor of [0, 5, text.length]) {
            const frame = inputWindow("/entrance/cellar/armoury $", text, cursor, columns);
            assert.ok(displayWidth(frame.text) < columns);
            assert.ok(frame.column >= 1 && frame.column <= columns);
            assert.ok(!/[\uD800-\uDBFF]$/.test(frame.text));
        }
    }
});
