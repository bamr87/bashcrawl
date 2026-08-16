"use strict";
// TermForge TUI compositor — a full-screen ANSI frame for byte-stream hosts.
//
// Draws the graphical session layout the web app gets from its DOM panels:
//
//   ┌ log (scrollback, wrapped) ─────────────┬─ sidebar panels ─┐
//   │ …                                      │ ─ ⚔ TITLE ────── │
//   │ …                                      │   pre-formatted  │
//   │ …                                      │   {kind,text}    │
//   ├─ toast row (transient event) ──────────┴──────────────────┤
//   └ input row (prompt + line buffer, live cursor) ────────────┘
//
// Narrow terminals collapse the sidebar into a one-line status strip above
// the log. The compositor is app-agnostic: panel/strip/toast content arrives
// as data (the app's hud() contract, see termforge/apps/bashcrawl.js); kinds
// reuse the AnsiSink SGR palette so the sidebar matches the log colors.
// No timers and no clock in here — hosts own toast lifetimes and repaints.

const { ANSI_STYLES } = require("../core/sinks/ansi.js");

const ESC = "\u001b";
const CSI = `${ESC}[`;
const MIN_WIDE = 88;    // need this many columns before the sidebar pays rent
const SIDEBAR_W = 30;
const MIN_ROWS = 8;     // below this: log + input only, no chrome

// Approximate display width: CJK, Hangul, and emoji cells count 2; combining
// marks, ZWJ, and variation selectors count 0. Close enough for panel layout
// (each row is erased before repaint, so a rare miss never leaves artifacts).
function charWidth(ch) {
    const code = ch.codePointAt(0);
    if (code === 0x200d || code === 0xfe0f || (code >= 0x0300 && code <= 0x036f)) return 0;
    if ((code >= 0x1100 && code <= 0x115f)
        || (code >= 0x2e80 && code <= 0xa4cf)
        || (code >= 0xac00 && code <= 0xd7a3)
        || (code >= 0xf900 && code <= 0xfaff)
        || (code >= 0xfe30 && code <= 0xfe4f)
        || (code >= 0xff00 && code <= 0xff60)
        || (code >= 0xffe0 && code <= 0xffe6)
        || (code >= 0x1f000 && code <= 0x1faff)
        || (code >= 0x2600 && code <= 0x27bf)
        || (code >= 0x2b00 && code <= 0x2bff)) return 2;
    return 1;
}

function dispWidth(text) {
    let width = 0;
    for (const ch of String(text)) width += charWidth(ch);
    return width;
}

/** Clip text to a display width (never mid-codepoint; wide cells respected). */
function clip(text, width) {
    let out = "";
    let used = 0;
    for (const ch of String(text)) {
        const w = charWidth(ch);
        if (used + w > width) break;
        out += ch;
        used += w;
    }
    return out;
}

/** Soft-wrap one logical line into display rows of at most `width` cells. */
function wrap(text, width) {
    const str = String(text);
    if (!str) return [""];
    const rows = [];
    let row = "";
    let used = 0;
    for (const ch of str) {
        const w = charWidth(ch);
        if (used + w > width) {
            rows.push(row);
            row = "";
            used = 0;
        }
        row += ch;
        used += w;
    }
    rows.push(row);
    return rows;
}

class TuiScreen {
    /**
     * @param {object} options
     * @param {(chunk: string) => void} options.write  receives ANSI frames
     * @param {boolean} [options.color]   emit SGR codes (default true)
     * @param {number}  [options.logCap]  scrollback cap in logical lines
     */
    constructor(options) {
        const opts = options || {};
        if (typeof opts.write !== "function") throw new Error("TuiScreen requires options.write");
        this._write = opts.write;
        this.color = opts.color !== false;
        this.logCap = opts.logCap || 500;
        this.cols = 80;
        this.rows = 24;
        this.log = [];
        this.panels = null;
        this.strip = null;
        this.toastLine = null;
        this.prompt = "$";
        this.input = "";
        this.started = false;
    }

    // ── state feeds ─────────────────────────────────────────────────────────

    setPanels(panels) { this.panels = Array.isArray(panels) && panels.length ? panels : null; }

    setStrip(lines) { this.strip = Array.isArray(lines) && lines.length ? lines : null; }

    setPrompt(label) { this.prompt = String(label || "$"); }

    setInput(buffer) { this.input = String(buffer || ""); }

    setToast(line) { this.toastLine = line || null; }

    appendLog(lines) {
        for (const line of lines || []) {
            this.log.push({ kind: line.kind || "output", text: line.text || "" });
        }
        if (this.log.length > this.logCap) {
            this.log.splice(0, this.log.length - this.logCap);
        }
    }

    clearLog() { this.log.length = 0; }

    // ── lifecycle ───────────────────────────────────────────────────────────

    start(size) {
        this.started = true;
        if (size) { this.cols = size.cols || 80; this.rows = size.rows || 24; }
        this._write(`${CSI}?1049h${CSI}2J${CSI}H`);
        this.render();
    }

    stop() {
        if (!this.started) return;
        this.started = false;
        this._write(`${CSI}?1049l${CSI}?25h`);
    }

    resize(cols, rows) {
        this.cols = cols || this.cols;
        this.rows = rows || this.rows;
        if (this.started) this._write(`${CSI}2J`);
    }

    // ── painting ────────────────────────────────────────────────────────────

    _sgr(code, text) {
        if (!this.color || !code) return text;
        return `${CSI}${code}m${text}${CSI}0m`;
    }

    _kind(kind, text) {
        return this._sgr(ANSI_STYLES[kind || "output"] || "", text);
    }

    _wide() {
        return Boolean(this.panels) && this.cols >= MIN_WIDE && this.rows >= MIN_ROWS;
    }

    // Flatten panels into sidebar rows: a rule-with-title header per panel,
    // then its body lines, truncated to the row budget with a dim ellipsis.
    _sidebarRows(budget) {
        const rows = [];
        for (const panel of this.panels || []) {
            const title = ` ${panel.title} `;
            const rule = "─".repeat(Math.max(0, SIDEBAR_W - dispWidth(title) - 1));
            rows.push(this._sgr("2", "─") + this._sgr("1;36", title) + this._sgr("2", rule));
            for (const line of panel.lines || []) {
                rows.push(" " + this._kind(line.kind, clip(line.text, SIDEBAR_W - 1)));
            }
        }
        if (rows.length > budget && budget > 0) {
            rows.length = budget - 1;
            rows.push(this._sgr("2", " …"));
        }
        return rows;
    }

    // Wrap the log tail into at most `budget` display rows of `width` cells.
    _logRows(budget, width) {
        const rows = [];
        for (let i = this.log.length - 1; i >= 0 && rows.length < budget; i -= 1) {
            const entry = this.log[i];
            const wrapped = wrap(entry.text, width);
            for (let j = wrapped.length - 1; j >= 0 && rows.length < budget; j -= 1) {
                rows.push(this._kind(entry.kind, wrapped[j]));
            }
        }
        return rows.reverse();
    }

    _inputCol() {
        return Math.min(this.cols, dispWidth(this.prompt) + 1 + dispWidth(this.input) + 1);
    }

    /** Fast path: repaint only the input row (per-keystroke). */
    renderInput() {
        if (!this.started) return;
        const row = this.rows;
        const text = clip(`${this.prompt} ${this.input}`, this.cols - 1);
        this._write(`${CSI}${row};1H${CSI}2K${text}${CSI}${row};${this._inputCol()}H`);
    }

    /** Full frame repaint. */
    render() {
        if (!this.started) return;
        const parts = [`${CSI}?25l`];
        const put = (row, text) => parts.push(`${CSI}${row};1H${CSI}2K${text}`);
        const wide = this._wide();
        const chrome = this.rows >= MIN_ROWS;
        const toastRow = chrome ? this.rows - 1 : 0;
        let logTop = 1;

        if (!wide && chrome && this.strip) {
            for (const line of this.strip) {
                put(logTop, this._kind(line.kind, clip(line.text, this.cols)));
                logTop += 1;
            }
            put(logTop, this._sgr("2", "─".repeat(this.cols)));
            logTop += 1;
        }

        const logBottom = (chrome ? toastRow : this.rows) - 1;
        const budget = Math.max(0, logBottom - logTop + 1);
        const sepCol = wide ? this.cols - SIDEBAR_W - 1 : this.cols + 1;
        const logWidth = wide ? sepCol - 2 : this.cols;
        const logRows = this._logRows(budget, Math.max(10, logWidth));
        const sideRows = wide ? this._sidebarRows(budget) : [];

        for (let i = 0; i < budget; i += 1) {
            const row = logTop + i;
            let text = logRows[i] || "";
            if (wide) {
                // The sidebar is positioned absolutely so a stray wide glyph in
                // the log can never push it out of its column.
                text += `${CSI}${row};${sepCol}H` + this._sgr("2", "│") + (sideRows[i] || "");
            }
            put(row, text);
        }

        if (chrome) {
            if (this.toastLine) {
                const toast = ` ${this.toastLine.text} `;
                const pad = Math.max(0, Math.floor((this.cols - dispWidth(toast)) / 2));
                const style = ANSI_STYLES[this.toastLine.kind || "info"] || "36";
                put(toastRow, " ".repeat(pad) + this._sgr(`7;${style}`, clip(toast, this.cols)));
            } else {
                put(toastRow, this._sgr("2", "─".repeat(this.cols)));
            }
        }

        put(this.rows, clip(`${this.prompt} ${this.input}`, this.cols - 1));
        parts.push(`${CSI}${this.rows};${this._inputCol()}H${CSI}?25h`);
        this._write(parts.join(""));
    }
}

module.exports = { TuiScreen, dispWidth, clip, wrap };
