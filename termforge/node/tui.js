"use strict";
// TermForge TUI compositor — a full-screen ANSI frame for byte-stream hosts.
//
// Draws a btop-style boxed session the web app gets as DOM panels:
//
//   ┌─ log 12-40/80 · PgUp/wheel ────────────┬─ hud ────────────┐
//   │ scrollback (independent offset)        │ ─ ⚔ TITLE ────── │
//   │                                        │   {kind,text}    │
//   ├─ toast row (transient event) ──────────┴──────────────────┤
//   └ input row (prompt + line buffer, live cursor) ────────────┘
//
// Narrow terminals collapse the sidebar into a status strip above the log.
// PgUp/PgDn, mouse wheel, and click-to-focus scroll the log (or sidebar)
// without leaving the input line. The compositor is app-agnostic: panel/
// strip/toast content arrives as data (the app's hud() contract). No timers
// here — hosts own toast lifetimes, repaints, and the damage jolt.

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
        this.jolt = 0;
        this.started = false;
        this.logOffset = 0;
        this.sideOffset = 0;
        this.focus = "input";
        this.dock = "right";
        this.sideWidth = SIDEBAR_W;
        this._sideMeta = [];
    }

    // ── state feeds ─────────────────────────────────────────────────────────

    setPanels(panels) { this.panels = Array.isArray(panels) && panels.length ? panels : null; }

    setStrip(lines) { this.strip = Array.isArray(lines) && lines.length ? lines : null; }

    setPrompt(label) { this.prompt = String(label || "$"); }

    setInput(buffer) { this.input = String(buffer || ""); }

    setToast(line) { this.toastLine = line || null; }

    /** Horizontal frame offset in cells (host-driven shake FX; 0 = settled). */
    setJolt(cells) { this.jolt = Math.max(0, Math.min(8, Number(cells) || 0)); }

    appendLog(lines) {
        for (const line of lines || []) {
            this.log.push({ kind: line.kind || "output", text: line.text || "" });
        }
        if (this.log.length > this.logCap) {
            this.log.splice(0, this.log.length - this.logCap);
        }
        this.logOffset = 0;
    }

    clearLog() {
        this.log.length = 0;
        this.logOffset = 0;
    }

    setFocus(zone) {
        if (zone === "log" || zone === "side" || zone === "input") this.focus = zone;
    }

    setDock(side) {
        this.dock = side === "left" ? "left" : "right";
    }

    setSideWidth(width) {
        const n = Number(width);
        this.sideWidth = Math.max(20, Math.min(40, Number.isFinite(n) ? Math.round(n) : SIDEBAR_W));
    }

    pageSize() {
        return Math.max(1, this._geometry().height - 1);
    }

    scrollLog(delta) {
        this.logOffset = this._clampOffset(this.logOffset + (Number(delta) || 0), this._logMaxOffset());
        return this.logOffset;
    }

    scrollSide(delta) {
        this.sideOffset = this._clampOffset(this.sideOffset + (Number(delta) || 0), this._sideMaxOffset());
        return this.sideOffset;
    }

    hitTest(x, y) {
        const g = this._geometry();
        const col = Number(x) || 0;
        const row = Number(y) || 0;
        if (row === g.inputRow) return { zone: "input" };
        if (g.chrome && row === g.toastRow) return { zone: "toast" };
        const onSide = g.wide && (
            g.dock === "left" ? col <= this.sideWidth : col >= g.sepCol
        );
        if (g.header && row === g.top - 1) {
            return onSide ? { zone: "side", kind: "title" } : { zone: "log", kind: "title" };
        }
        if (row < g.top || row > g.logBottom) return null;
        if (onSide) {
            this._sideAllRows();
            const idx = (row - g.top) + this.sideOffset;
            const meta = this._sideMeta[idx] || {};
            return { zone: "side", id: meta.id || null, kind: meta.kind || "body" };
        }
        return { zone: "log" };
    }

    // ── lifecycle ───────────────────────────────────────────────────────────

    start(size) {
        this.started = true;
        if (size) { this.cols = size.cols || 80; this.rows = size.rows || 24; }
        this._write(`${CSI}?1049h${CSI}?1000h${CSI}?1006h${CSI}2J${CSI}H`);
        this.render();
    }

    stop() {
        if (!this.started) return;
        this.started = false;
        this._write(`${CSI}?1000l${CSI}?1006l${CSI}?1049l${CSI}?25h`);
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
        return Array.isArray(this.panels) && this.panels.length > 0
            && this.cols >= MIN_WIDE && this.rows >= MIN_ROWS;
    }

    _clampOffset(value, max) {
        return Math.max(0, Math.min(max, value));
    }

    _geometry() {
        const wide = this._wide();
        const chrome = this.rows >= MIN_ROWS;
        const inputRow = this.rows;
        const toastRow = chrome ? this.rows - 1 : 0;
        let top = 1;
        const stripLines = (!wide && chrome && this.strip) ? this.strip.length : 0;
        if (stripLines) top += stripLines + 1;
        const header = chrome;
        if (header) top += 1;
        const logBottom = (chrome ? toastRow : inputRow) - 1;
        const height = Math.max(0, logBottom - top + 1);
        const dock = this.dock === "left" ? "left" : "right";
        const sideW = this.sideWidth || SIDEBAR_W;
        const sepCol = wide
            ? (dock === "left" ? sideW + 1 : this.cols - sideW - 1)
            : this.cols + 1;
        const logWidth = wide ? Math.max(10, this.cols - sideW - 2) : this.cols;
        return {
            wide, chrome, header, top, logBottom, height, sepCol, logWidth,
            toastRow, inputRow, stripLines, dock, sideW,
        };
    }

    _wrappedLog(width) {
        const rows = [];
        for (const entry of this.log) {
            for (const piece of wrap(entry.text, width)) {
                rows.push({ kind: entry.kind, text: piece });
            }
        }
        return rows;
    }

    _logMaxOffset() {
        const g = this._geometry();
        return Math.max(0, this._wrappedLog(g.logWidth).length - g.height);
    }

    _sideAllRows() {
        const rows = [];
        const meta = [];
        const width = this.sideWidth || SIDEBAR_W;
        for (const panel of this.panels || []) {
            const title = ` ${panel.title} `;
            const rule = "─".repeat(Math.max(0, width - dispWidth(title) - 1));
            rows.push(this._sgr("2", "─") + this._sgr("1;36", title) + this._sgr("2", rule));
            meta.push({ id: panel.id || null, kind: "title" });
            if (panel.collapsed) continue;
            for (const line of panel.lines || []) {
                rows.push(" " + this._kind(line.kind, clip(line.text, width - 1)));
                meta.push({ id: panel.id || null, kind: "body" });
            }
        }
        this._sideMeta = meta;
        return rows;
    }

    _sideMaxOffset() {
        const g = this._geometry();
        if (!g.wide) return 0;
        return Math.max(0, this._sideAllRows().length - g.height);
    }

    _sidebarRows(budget) {
        const all = this._sideAllRows();
        const maxOff = Math.max(0, all.length - budget);
        this.sideOffset = this._clampOffset(this.sideOffset, maxOff);
        const slice = all.slice(this.sideOffset, this.sideOffset + budget);
        if (this.sideOffset + budget < all.length && slice.length) {
            slice[slice.length - 1] = this._sgr("2", " …");
        }
        return slice;
    }

    _logRows(budget, width) {
        const all = this._wrappedLog(width);
        const maxOff = Math.max(0, all.length - budget);
        this.logOffset = this._clampOffset(this.logOffset, maxOff);
        const start = Math.max(0, all.length - budget - this.logOffset);
        return all.slice(start, start + budget).map((row) => this._kind(row.kind, row.text));
    }

    _headerTitles(g, logTotal) {
        const maxOff = Math.max(0, logTotal - g.height);
        const shownEnd = Math.max(0, logTotal - this.logOffset);
        const shownStart = Math.max(1, shownEnd - g.height + 1);
        const mark = this.logOffset > 0 ? "▲" : (maxOff > 0 ? "▼" : " ");
        const range = logTotal
            ? `${mark} ${shownStart}-${shownEnd}/${logTotal}`
            : "log";
        const logTitle = this.focus === "log" ? ` LOG ${range} ` : ` log ${range} `;
        const hudTitle = this.focus === "side" ? " HUD " : " hud ";
        return { logTitle, hudTitle };
    }

    _inputCol() {
        return Math.min(this.cols, dispWidth(this.prompt) + 1 + dispWidth(this.input) + 1);
    }

    /** Fast path: repaint only the input row (per-keystroke). */
    renderInput() {
        if (!this.started) return;
        const row = this.rows;
        const pad = " ".repeat(this.jolt);
        const text = clip(`${this.prompt} ${this.input}`, this.cols - 1 - this.jolt);
        this._write(`${CSI}${row};1H${CSI}2K${pad}${text}${CSI}${row};${this._inputCol() + this.jolt}H`);
    }

    /** Full frame repaint. */
    render() {
        if (!this.started) return;
        const parts = [`${CSI}?25l`];
        const jolt = this.jolt;
        const pad = " ".repeat(jolt);
        const put = (row, text) => parts.push(`${CSI}${row};1H${CSI}2K${pad}${text}`);
        const g = this._geometry();
        let logTop = 1;

        if (g.stripLines) {
            for (const line of this.strip) {
                put(logTop, this._kind(line.kind, clip(line.text, this.cols)));
                logTop += 1;
            }
            put(logTop, this._sgr("2", "─".repeat(this.cols)));
            logTop += 1;
        }

        const allLog = this._wrappedLog(g.logWidth);
        if (g.header) {
            const titles = this._headerTitles(g, allLog.length);
            if (g.wide && g.dock === "left") {
                const hudRule = "─".repeat(Math.max(0, g.sideW - dispWidth(titles.hudTitle)));
                const logRule = "─".repeat(Math.max(0, this.cols - g.sepCol - dispWidth(titles.logTitle)));
                const head = this._sgr("2", "┌") + this._sgr(this.focus === "side" ? "1;36" : "2", titles.hudTitle)
                    + this._sgr("2", hudRule)
                    + `${CSI}${logTop};${g.sepCol + jolt}H` + this._sgr("2", "┬")
                    + this._sgr(this.focus === "log" ? "1;36" : "2", titles.logTitle) + this._sgr("2", logRule);
                put(logTop, head);
            } else {
                const logRule = "─".repeat(Math.max(0, (g.wide ? g.sepCol - 1 : this.cols) - dispWidth(titles.logTitle) - 1));
                let head = this._sgr("2", "┌") + this._sgr(this.focus === "log" ? "1;36" : "2", titles.logTitle) + this._sgr("2", logRule);
                if (g.wide) {
                    const hudRule = "─".repeat(Math.max(0, g.sideW - dispWidth(titles.hudTitle)));
                    head += `${CSI}${logTop};${g.sepCol + jolt}H` + this._sgr("2", "┬")
                        + this._sgr(this.focus === "side" ? "1;36" : "2", titles.hudTitle) + this._sgr("2", hudRule);
                } else {
                    head += this._sgr("2", "┐");
                }
                put(logTop, head);
            }
            logTop += 1;
        }

        const budget = g.height;
        const logRows = this._logRows(budget, g.logWidth);
        const sideRows = g.wide ? this._sidebarRows(budget) : [];

        for (let i = 0; i < budget; i += 1) {
            const row = logTop + i;
            let text = logRows[i] || "";
            if (g.wide && g.dock === "left") {
                text = (sideRows[i] || "") + `${CSI}${row};${g.sepCol + jolt}H` + this._sgr("2", "│") + (logRows[i] || "");
            } else if (g.wide) {
                text += `${CSI}${row};${g.sepCol + jolt}H` + this._sgr("2", "│") + (sideRows[i] || "");
            }
            put(row, text);
        }

        if (g.chrome) {
            if (this.toastLine) {
                const toast = ` ${this.toastLine.text} `;
                const inset = Math.max(0, Math.floor((this.cols - dispWidth(toast)) / 2));
                const style = ANSI_STYLES[this.toastLine.kind || "info"] || "36";
                put(g.toastRow, " ".repeat(inset) + this._sgr(`7;${style}`, clip(toast, this.cols)));
            } else {
                put(g.toastRow, this._sgr("2", "─".repeat(this.cols)));
            }
        }

        put(g.inputRow, clip(`${this.prompt} ${this.input}`, this.cols - 1 - jolt));
        parts.push(`${CSI}${g.inputRow};${this._inputCol() + jolt}H${CSI}?25h`);
        this._write(parts.join(""));
    }
}

module.exports = { TuiScreen, dispWidth, clip, wrap };
