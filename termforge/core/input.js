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
    //      interrupt/eof.

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
    class LineEditor {
        /**
         * @param {object} options
         * @param {() => string} options.promptLabel
         * @param {(text: string) => string[]} [options.completions]
         * @param {object} options.state           shell state ({history, historyIndex})
         * @param {(line: string) => void} options.onSubmit
         * @param {(chunk: string) => void} options.write
         * @param {() => void} [options.onEof]
         * @param {boolean} [options.echo]         echo typed chars (default true)
         */
        constructor(options) {
            this.promptLabel = options.promptLabel || (() => "$");
            this.completions = options.completions || (() => []);
            this.state = options.state;
            this.onSubmit = options.onSubmit;
            this.onEof = options.onEof || (() => {});
            this.write = options.write;
            this.echo = options.echo !== false;
            this.buffer = "";
        }

        showPrompt() {
            this.write(`${this.promptLabel()} `);
        }

        redraw() {
            this.write(`\r${ESC}[K${this.promptLabel()} ${this.buffer}`);
        }

        feed(ev) {
            switch (ev.type) {
                case "char":
                    this.buffer += ev.ch;
                    if (this.echo) this.write(ev.ch);
                    return;
                case "backspace":
                    if (this.buffer.length) {
                        this.buffer = this.buffer.slice(0, -1);
                        if (this.echo) this.write("\b \b");
                    }
                    return;
                case "submit": {
                    const line = this.buffer;
                    this.buffer = "";
                    this.write("\r\n");
                    this.onSubmit(line);
                    return;
                }
                case "histPrev":
                case "histNext": {
                    const value = historyStep(this.state, ev.type === "histPrev" ? -1 : 1);
                    if (value != null) {
                        this.buffer = value;
                        this.redraw();
                    }
                    return;
                }
                case "complete": {
                    const { value, echo } = applyCompletion(this.buffer, this.completions(this.buffer));
                    if (value != null) {
                        this.buffer = value;
                        this.redraw();
                    } else if (echo) {
                        this.write(`\r\n${echo}\r\n`);
                        this.redraw();
                    }
                    return;
                }
                case "clearScreen":
                    this.write(`${ESC}[2J${ESC}[H`);
                    this.redraw();
                    return;
                case "interrupt":
                    this.buffer = "";
                    this.write("^C\r\n");
                    this.showPrompt();
                    return;
                case "eof":
                    this.onEof();
                    return;
                default:
            }
        }
    }

    /**
     * Byte decoder for TTY/telnet input. Returns feed(text) which translates a
     * decoded string chunk into editor events. Handles CR/LF/CRLF/CR-NUL
     * submits, both backspace codes, ^C ^D ^L, Tab, and arrow-key escape
     * sequences (state survives chunk boundaries).
     */
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
                        if (esc === `${ESC}[A`) emit({ type: "histPrev" });
                        else if (esc === `${ESC}[B`) emit({ type: "histNext" });
                        esc = "";
                    } else if (esc.length > 12) {
                        esc = ""; // runaway sequence: bail out
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
                // other C0 control bytes: dropped
            }
        };
    }

    return { historyStep, applyCompletion, LineEditor, createByteDecoder };
});
