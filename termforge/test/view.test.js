"use strict";
// TerminalView + sink tests. The DomSink case locks the exact innerHTML
// format the historical story/arcade renderers produced — byte-identical
// spans — using a stub element (no DOM library needed).

const test = require("node:test");
const assert = require("node:assert");
const { TerminalView } = require("../core/view.js");
const { DomSink, escapeHtml } = require("../core/sinks/dom.js");
const { AnsiSink, ANSI_STYLES } = require("../core/sinks/ansi.js");

test("appendLine splits newlines, defaults kind, enforces the cap", () => {
    const view = new TerminalView({ cap: 3 });
    view.appendLine("info", "a\nb");
    view.appendLine(null, "c");
    assert.deepStrictEqual(view.lines, [
        { kind: "info", text: "a" },
        { kind: "info", text: "b" },
        { kind: "output", text: "c" },
    ]);
    view.appendLine("dim", "d");
    assert.deepStrictEqual(view.lines.map((l) => l.text), ["b", "c", "d"], "cap trims oldest");
});

test("appendOutputs routes control records via onControl", () => {
    const seen = [];
    const view = new TerminalView({
        cap: 10,
        onControl(action) {
            seen.push(action);
            return action === "reset"; // historical story quirk: reset falls through
        },
    });
    view.appendOutputs([
        { kind: "output", text: "one" },
        { kind: "control", action: "levelup" },
        { kind: "control", action: "reset" },
        { kind: "output", text: "two" },
    ]);
    assert.deepStrictEqual(seen, ["levelup", "reset"]);
    assert.deepStrictEqual(view.lines.map((l) => `${l.kind}:${l.text}`), [
        "output:one", "control:", "output:two",
    ]);
    view.appendOutputs([{ kind: "control", action: "clear" }, { kind: "info", text: "fresh" }]);
    assert.deepStrictEqual(view.lines, [{ kind: "info", text: "fresh" }], "clear resets, then continues");
});

test("DomSink renders the exact historical span format", () => {
    const el = { innerHTML: "", scrollTop: 0, scrollHeight: 100, clientHeight: 40 };
    const view = new TerminalView({ sink: new DomSink(el), cap: 10 });
    view.appendLine("error", 'x < 1 & "y"');
    view.appendLine(null, "plain");
    view.flush();
    assert.strictEqual(
        el.innerHTML,
        '<span class="kind-error">x &lt; 1 &amp; &quot;y&quot;</span>\n<span class="kind-output">plain</span>',
    );
    assert.strictEqual(el.scrollTop, 60, "scroll pinned to bottom");
});

test("escapeHtml handles the four specials", () => {
    assert.strictEqual(escapeHtml('<a href="x">&'), "&lt;a href=&quot;x&quot;&gt;&amp;");
    assert.strictEqual(escapeHtml(42), "42");
});

test("AnsiSink streams SGR-wrapped lines with CRLF; control records paint empty", () => {
    let out = "";
    const sink = new AnsiSink({ write: (c) => { out += c; } });
    const view = new TerminalView({ sink, cap: 10 });
    view.appendLine("error", "boom");
    view.appendLine("output", "plain");
    view.appendLine("success", "yay");
    assert.strictEqual(
        out,
        "\u001b[31mboom\u001b[0m\r\nplain\r\n\u001b[32myay\u001b[0m\r\n",
    );
    assert.strictEqual(new AnsiSink({ write() {}, color: false }).paint({ kind: "error", text: "x" }), "x");
    assert.strictEqual(Object.keys(ANSI_STYLES).length, 9, "one style per protocol kind");
});
