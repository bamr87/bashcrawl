(function (global, factory) {
    "use strict";
    const api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else {
        global.TermForge = global.TermForge || {};
        global.TermForge.input = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";
    // TermForge input helpers.
    //
    // Two layers share one contract:
    //   1. Pure helpers (historyStep, applyCompletion) — used by the browser,
    //      whose native <input> element remains the real line editor (IME,
    //      mobile keyboards, paste all keep working), and by the LineEditor.
    //   2. LineEditor + createByteDecoder — a full line editor for byte-stream
    //      hosts (TTY, telnet) speaking the small event vocabulary:
     //      char/submit/backspace/histPrev/histNext/complete/clearScreen/
     //      interrupt/eof/arrow/page/home/end/mouse.

    const ESC = "\u001b";

    /**
     * Step through state.history. Mutates state.historyIndex, exactly like the
     * historical story-mode implementation. Returns the input value to show,
     * or null when there is no history (leave the input untouched).
     */
    function historyStep(state, direction) {
        const history = state.history;
        if (!history.length) return null;
        state.historyIndex = Math.max(0, Math.min(history.length, state.historyIndex + direction));
        return state.historyIndex >= history.length ? "" : history[state.historyIndex];
    }

    /**
     * Tab-completion resolution over a candidate list:
     *   one candidate  -> { value: text-with-last-word-replaced, echo: null }
     *   many           -> { value: null, echo: "cand1  cand2  ..." }
     *   none           -> { value: null, echo: null }
     */
    function applyCompletion(text, candidates) {
        if (candidates.length === 1) {
            const parts = text.split(/\s+/);
            parts[parts.length - 1] = candidates[0];
            return { value: parts.join(" "), echo: null };
        }
        if (candidates.length > 1) {
            return { value: null, echo: candidates.join("  ") };
        }
        return { value: null, echo: null };
    }

    /**
     * Server-side line editor for byte-stream hosts. The host decodes bytes to
     * events (createByteDecoder) and feeds them here; the editor manages the
     * buffer, echo, history recall and completion, and hands finished lines to
     * onSubmit.
     */
    function cellWidth(ch) {
        const code = ch.codePointAt(0);
        if (code === 0x200d || code === 0xfe0f || /\p{Mark}/u.test(ch)) return 0;
        return (code >= 0x1100 && code <= 0x115f) || (code >= 0x2e80 && code <= 0xa4cf)
            || (code >= 0xac00 && code <= 0xd7a3) || (code >= 0xf900 && code <= 0xfaff)
            || (code >= 0xff00 && code <= 0xff60) || (code >= 0xffe0 && code <= 0xffe6)
            || (code >= 0x1f000 && code <= 0x1faff) || (code >= 0x2600 && code <= 0x27bf) ? 2 : 1;
    }
    function displayWidth(text) { return Array.from(String(text)).reduce((n, ch) => n + cellWidth(ch), 0); }

    // Horizontally scroll long commands so the editable cursor stays visible.
    function inputWindow(prompt, buffer, cursor, columns) {
        const width = Math.max(1, columns - 1);
        let label = Array.from(String(prompt) + " ").slice(-width * 2).join("");
        while (displayWidth(label) > Math.max(0, width - 8)) label = Array.from(label).slice(1).join("");
        // Only inspect the visible neighbourhood of a potentially large line.
        let prefixStart = Math.max(0, cursor - columns * 2);
        if (/^[\uDC00-\uDFFF]$/.test(buffer[prefixStart] || "")) prefixStart += 1;
        const prefix = buffer.slice(prefixStart, cursor);
        const chars = Array.from(prefix + buffer.slice(cursor, cursor + columns * 2));
        const position = Array.from(prefix).length;
        const room = Math.max(1, width - displayWidth(label));
        let start = position;
        let used = 0;
        while (start > 0 && used + cellWidth(chars[start - 1]) < room) {
            start -= 1;
            used += cellWidth(chars[start]);
        }
        let text = label;
        for (let i = start; i < chars.length && displayWidth(text) + cellWidth(chars[i]) <= width; i += 1) text += chars[i];
        return { text, column: Math.min(columns, displayWidth(label) + used + 1) };
    }

    class LineEditor {
        constructor(options) {
            this.promptLabel = options.promptLabel || (() => "$");
            this.completions = options.completions || (() => []);
            this.state = options.state;
            this.onSubmit = options.onSubmit;
            this.onEof = options.onEof || (() => {});
            this.onOverflow = options.onOverflow || (() => this.write("\u0007"));
            this.write = options.write;
            this.echo = options.echo !== false;
            this.columns = options.columns || (() => 80);
            this.maxLine = options.maxLine || 4096;
            this.buffer = "";
            this.cursor = 0;
            this.overflow = false;
        }
        showPrompt() { this.write(inputWindow(this.promptLabel(), this.buffer, this.cursor, this.columns()).text); }
        redraw() {
            if (!this.echo) return;
            const shown = inputWindow(this.promptLabel(), this.buffer, this.cursor, this.columns());
            this.write(`\r${ESC}[2K${shown.text}${displayWidth(shown.text) + 1 === shown.column ? "" : `${ESC}[${shown.column}G`}`);
        }
        reset() { this.buffer = ""; this.cursor = 0; this.overflow = false; }
        limit(value) { return typeof this.maxLine === "function" ? this.maxLine(value) : this.maxLine; }
        replace(value) {
            const limit = this.limit(value);
            let bounded = "";
            for (const ch of value) {
                if (bounded.length + ch.length > limit) break;
                bounded += ch;
            }
            this.overflow = value.length > limit;
            if (this.overflow) this.onOverflow(limit);
            this.buffer = bounded;
            this.cursor = this.buffer.length;
            this.redraw();
        }
        feed(ev) {
            switch (ev.type) {
                case "char": {
                    const candidate = this.buffer.slice(0, this.cursor) + ev.ch + this.buffer.slice(this.cursor);
                    const limit = this.limit(candidate);
                    if (candidate.length > limit) {
                        if (!this.overflow) this.onOverflow(limit);
                        this.overflow = true;
                        return;
                    }
                    const atEnd = this.cursor === this.buffer.length;
                    this.buffer = candidate;
                    this.cursor += ev.ch.length;
                    if (this.echo && atEnd && this.buffer.length < this.columns() && displayWidth(this.promptLabel() + " " + this.buffer) < this.columns() - 1) this.write(ev.ch);
                    else this.redraw();
                    return;
                }
                case "backspace": {
                    if (!this.cursor) return;
                    const previous = Array.from(this.buffer.slice(0, this.cursor)).pop();
                    const atEnd = this.cursor === this.buffer.length;
                    this.buffer = this.buffer.slice(0, this.cursor - previous.length) + this.buffer.slice(this.cursor);
                    this.cursor -= previous.length;
                    if (this.echo && atEnd && cellWidth(previous) === 1 && displayWidth(this.promptLabel() + " " + this.buffer) < this.columns() - 2) this.write("\b \b");
                    else this.redraw();
                    return;
                }
                case "delete": {
                    const next = Array.from(this.buffer.slice(this.cursor))[0];
                    if (next) this.buffer = this.buffer.slice(0, this.cursor) + this.buffer.slice(this.cursor + next.length);
                    this.redraw();
                    return;
                }
                case "arrow":
                    if (ev.dir === "left") this.cursor -= (Array.from(this.buffer.slice(0, this.cursor)).pop() || "").length;
                    else this.cursor += (Array.from(this.buffer.slice(this.cursor))[0] || "").length;
                    this.redraw();
                    return;
                case "home": this.cursor = 0; this.redraw(); return;
                case "end": this.cursor = this.buffer.length; this.redraw(); return;
                case "submit": {
                    const line = this.buffer;
                    const overflow = this.overflow;
                    this.reset();
                    this.write("\r\n");
                    if (!overflow) this.onSubmit(line);
                    else this.showPrompt();
                    return;
                }
                case "histPrev":
                case "histNext": {
                    const value = historyStep(this.state, ev.type === "histPrev" ? -1 : 1);
                    if (value != null) this.replace(value);
                    return;
                }
                case "complete": {
                    const prefix = this.buffer.slice(0, this.cursor);
                    const { value, echo } = applyCompletion(prefix, this.completions(prefix));
                    if (value != null) {
                        const suffix = this.buffer.slice(this.cursor);
                        this.replace(value + suffix);
                        this.cursor = Math.min(value.length, this.buffer.length);
                        this.redraw();
                    } else if (echo) { this.write(`\r\n${echo}\r\n`); this.redraw(); }
                    return;
                }
                case "clearScreen": this.write(`${ESC}[2J${ESC}[H`); this.redraw(); return;
                case "interrupt": this.reset(); this.write("^C\r\n"); this.showPrompt(); return;
                case "eof":
                    if (this.buffer) this.feed({ type: "delete" });
                    else this.onEof();
                    return;
                default:
            }
        }
    }

    /**
     * Byte decoder for TTY/telnet input. Returns feed(text) which translates a
     * decoded string chunk into editor events. Handles CR/LF/CRLF/CR-NUL
     * submits, both backspace codes, ^C ^D ^L, Tab, arrow/pager keys, and
     * SGR mouse (state survives chunk boundaries).
     */
    function emitCsi(seq, emit) {
        if (seq === `${ESC}[A`) { emit({ type: "histPrev" }); return; }
        if (seq === `${ESC}[B`) { emit({ type: "histNext" }); return; }
        if (seq === `${ESC}[C`) { emit({ type: "arrow", dir: "right" }); return; }
        if (seq === `${ESC}[D`) { emit({ type: "arrow", dir: "left" }); return; }
        if (seq === `${ESC}[H`) { emit({ type: "home" }); return; }
        if (seq === `${ESC}[F`) { emit({ type: "end" }); return; }
        const body = seq.slice(2);
        if (body[0] === "<" && /[Mm]$/.test(body)) {
            const match = /^<(\d+);(\d+);(\d+)([Mm])$/.exec(body);
            if (!match) return;
            const btn = Number(match[1]);
            const x = Number(match[2]);
            const y = Number(match[3]);
            let wheel = 0;
            if (btn === 64) wheel = 1;
            else if (btn === 65) wheel = -1;
            emit({ type: "mouse", btn, x, y, down: match[4] === "M", wheel });
            return;
        }
        if (body.endsWith("~")) {
            const n = parseInt(body, 10);
            if (n === 3) emit({ type: "delete" });
            else if (n === 5) emit({ type: "page", dir: "up" });
            else if (n === 6) emit({ type: "page", dir: "down" });
            else if (n === 1) emit({ type: "home" });
            else if (n === 4) emit({ type: "end" });
        }
    }

    function createByteDecoder(emit) {
        let pendingCr = false;   // swallow the LF/NUL of CRLF / CR NUL
        let esc = "";            // in-flight escape sequence

        return function feed(text) {
            for (const ch of String(text)) {
                if (pendingCr) {
                    pendingCr = false;
                    if (ch === "\n" || ch === "\u0000") continue;
                }
                if (esc) {
                    esc += ch;
                    if (esc === `${ESC}[`) continue;
                    if (esc.length === 2 && ch !== "[") { esc = ""; continue; }
                    // Final byte of a CSI sequence is in @ ... ~
                    if (ch >= "@" && ch <= "~") {
                        emitCsi(esc, emit);
                        esc = "";
                    } else if (esc.length > 24) {
                        esc = "";
                    }
                    continue;
                }
                if (ch === ESC) { esc = ch; continue; }
                if (ch === "\r") { pendingCr = true; emit({ type: "submit" }); continue; }
                if (ch === "\n") { emit({ type: "submit" }); continue; }
                if (ch === "\u007f" || ch === "\b") { emit({ type: "backspace" }); continue; }
                if (ch === "\u0003") { emit({ type: "interrupt" }); continue; }
                if (ch === "\u0004") { emit({ type: "eof" }); continue; }
                if (ch === "\u000c") { emit({ type: "clearScreen" }); continue; }
                if (ch === "\t") { emit({ type: "complete" }); continue; }
                if (ch >= " " || ch.charCodeAt(0) > 0x7f) { emit({ type: "char", ch }); continue; }
            }
        };
    }

    return { historyStep, applyCompletion, LineEditor, createByteDecoder, inputWindow, displayWidth };
});
