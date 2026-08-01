(function (global, factory) {
    "use strict";
    const api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else {
        global.TermForge = global.TermForge || {};
        global.TermForge.view = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";
    // TermForge TerminalView — the one terminal log widget.
    //
    // Holds the visible line buffer, splits multi-line text, enforces the
    // scrollback cap, and routes protocol control records; painting is
    // delegated to a pluggable sink (DOM, ANSI stream, test capture). This
    // replaces the twin renderers that used to live in the story and arcade
    // modules.
    //
    // Control routing: a "clear" action always empties the buffer. Every other
    // action is offered to onControl(action, record); returning true appends
    // the record to the buffer afterwards (the historical story-mode behavior
    // for "reset"), returning false/undefined swallows it (e.g. "levelup",
    // which is pure fanfare).

    class TerminalView {
        /**
         * @param {object} [options]
         * @param {{render?: (lines: {kind,text}[]) => void,
         *          write?: (lines: {kind,text}[]) => void}|null} [options.sink]
         * @param {number} [options.cap]  scrollback cap in lines
         * @param {(action: string, record: object) => boolean|void} [options.onControl]
         */
        constructor(options) {
            const opts = options || {};
            this.sink = opts.sink || null;
            this.cap = opts.cap || 600;
            this.onControl = opts.onControl || (() => false);
            /** @type {{kind: string, text: string}[]} */
            this.lines = [];
        }

        /** Append one logical line (split on \n) under a display kind. */
        appendLine(kind, text) {
            const fresh = [];
            for (const line of String(text ?? "").split("\n")) {
                fresh.push({ kind: kind || "output", text: line });
            }
            this.lines.push(...fresh);
            if (this.lines.length > this.cap) {
                this.lines.splice(0, this.lines.length - this.cap);
            }
            if (this.sink && this.sink.write) this.sink.write(fresh);
        }

        /** Append a protocol Line[] (command output), routing control records. */
        appendOutputs(outputs) {
            for (const out of outputs || []) {
                if (out.action === "clear") {
                    this.clear();
                    continue;
                }
                if (out.action) {
                    if (!this.onControl(out.action, out)) continue;
                }
                this.appendLine(out.kind, out.text || "");
            }
        }

        clear() {
            this.lines.length = 0;
            if (this.sink && this.sink.write) this.sink.write([]);
        }

        /** Full repaint through the sink (for render-style sinks). */
        flush() {
            if (this.sink && this.sink.render) this.sink.render(this.lines);
        }
    }

    return { TerminalView };
});
