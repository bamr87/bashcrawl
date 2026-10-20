/* Bashcrawl Vim — the modal editor behind the Practice Arcade's Vim Catacombs.
 *
 * A compact, deterministic vim engine: a buffer (lines + cursor), normal mode
 * (motions, counts, operators, a register, undo) and insert mode, fed one key
 * at a time. It knows nothing about gems, spikes or levels — the arcade game
 * in arcade.js reads the buffer after every command and decides what the
 * cursor landed on. The engine stays faithful to vim where a learner would
 * notice: word classes (word / punctuation / blank), `dw` never crossing a
 * line, `cw` acting like `ce`, `$` remembering the column, `t` stopping one
 * short, `;` and `,` repeating a find, `/` searching the whole buffer with
 * wrap-around, Escape stepping the cursor back one.
 *
 * A level restricts the keys a player may use (the "spellbook"): feed() takes
 * an `allowed` set of key names and rejects anything outside it, early, with
 * an error the game can print. Key names are the keys themselves (`h`, `$`,
 * `gg`, `f`, `dd`, `d`, `p`, `i`…) plus `count` for a digit prefix; `u` and
 * Escape are always allowed.
 *
 * Dual-mode like hud.js: a classic script (global.BashcrawlVim) that is also
 * a CommonJS module for the node suite (termforge/test/vim.test.js).
 */
(function initVim(global) {
    "use strict";

    const BLANK = 0;
    const PUNCT = 1;
    const WORD = 2;

    const OPERATORS = new Set(["d", "y", "c"]);
    const SIMPLE = new Set(["x", "X", "p", "P", "u", "~", "J", "D", "C", "Y", "i", "a", "I", "A", "o", "O"]);
    const MOTIONS = new Set(["h", "j", "k", "l", "w", "b", "e", "W", "B", "E", "0", "^", "$", "G", ";", ",", "n", "N", " ", "Backspace"]);
    const FINDS = new Set(["f", "t", "F", "T"]);
    const LINEWISE = new Set(["j", "k", "gg", "G"]);
    const INCLUSIVE = new Set(["e", "E", "$", "f", "t", "F", "T", ";", ","]);
    const ALWAYS = new Set(["u", "Escape"]);

    function charClass(ch, big) {
        if (ch === undefined || ch === "" || ch === " " || ch === "\t") return BLANK;
        if (big) return WORD;
        return /[A-Za-z0-9_]/.test(ch) ? WORD : PUNCT;
    }

    function isDigit(key) {
        return typeof key === "string" && key.length === 1 && key >= "0" && key <= "9";
    }

    function clampCol(line, col, pastEnd) {
        const max = pastEnd ? line.length : Math.max(0, line.length - 1);
        return Math.max(0, Math.min(max, col));
    }

    function firstNonBlank(line) {
        const idx = line.search(/\S/);
        return idx < 0 ? Math.max(0, line.length - 1) : idx;
    }

    // ── keys ────────────────────────────────────────────────────────────

    const NAMED = {
        esc: "Escape", escape: "Escape", cr: "Enter", enter: "Enter", return: "Enter",
        bs: "Backspace", backspace: "Backspace", space: " ", lt: "<", tab: "\t",
    };

    /** Vim's own key notation → one key name per entry: `3w`, `dd`, `A now<esc>`, `<lt>`. */
    function toKeys(text) {
        const keys = [];
        const source = String(text ?? "");
        let i = 0;
        while (i < source.length) {
            if (source[i] === "<") {
                const close = source.indexOf(">", i + 1);
                const name = close > i ? source.slice(i + 1, close).toLowerCase() : "";
                if (name && Object.prototype.hasOwnProperty.call(NAMED, name)) {
                    keys.push(NAMED[name]);
                    i = close + 1;
                    continue;
                }
            }
            if (source[i] === "\n") keys.push("Enter");
            else if (source[i] === "\x1b") keys.push("Escape");
            else keys.push(source[i]);
            i += 1;
        }
        return keys;
    }

    /** The printable name of a key, for messages and the mode line. */
    function keyLabel(key) {
        if (key === " ") return "Space";
        if (key === "\t") return "Tab";
        return key;
    }

    // ── state ───────────────────────────────────────────────────────────

    function createState(lines, options = {}) {
        const text = Array.isArray(lines) ? lines.map((l) => String(l ?? "")) : String(lines ?? "").split("\n");
        const state = {
            lines: text.length ? text : [""],
            row: 0,
            col: 0,
            want: 0,
            mode: "normal",
            pending: [],
            register: null,
            undo: [],
            lastFind: null,
            lastSearch: null,
            changes: 0,
        };
        state.row = Math.max(0, Math.min(state.lines.length - 1, options.row || 0));
        state.col = clampCol(state.lines[state.row], options.col || 0, false);
        state.want = state.col;
        return state;
    }

    function snapshot(state) {
        state.undo.push({ lines: state.lines.slice(), row: state.row, col: state.col });
        if (state.undo.length > 100) state.undo.splice(0, state.undo.length - 100);
    }

    function setCursor(state, row, col, keepWant) {
        state.row = Math.max(0, Math.min(state.lines.length - 1, row));
        state.col = clampCol(state.lines[state.row], col, false);
        if (!keepWant) state.want = state.col;
    }

    // ── word motions (vim's `w` / `e` / `b` and their WORD cousins) ─────

    function nextWordStart(state, row, col, big) {
        const lines = state.lines;
        let line = lines[row];
        const cls = charClass(line[col], big);
        if (cls !== BLANK) {
            while (col < line.length && charClass(line[col], big) === cls) col += 1;
        }
        for (;;) {
            if (col >= line.length) {
                if (row >= lines.length - 1) return { row, col: line.length, eof: true };
                row += 1;
                col = 0;
                line = lines[row];
                if (line.length === 0) return { row, col: 0, eof: false };
                continue;
            }
            if (charClass(line[col], big) === BLANK) {
                col += 1;
                continue;
            }
            return { row, col, eof: false };
        }
    }

    function nextWordEnd(state, row, col, big) {
        const lines = state.lines;
        let line = lines[row];
        col += 1;
        for (;;) {
            if (col >= line.length) {
                if (row >= lines.length - 1) return { row, col: Math.max(0, line.length - 1), eof: true };
                row += 1;
                col = 0;
                line = lines[row];
                continue;
            }
            if (charClass(line[col], big) === BLANK) {
                col += 1;
                continue;
            }
            break;
        }
        const cls = charClass(line[col], big);
        while (col + 1 < line.length && charClass(line[col + 1], big) === cls) col += 1;
        return { row, col, eof: false };
    }

    function prevWordStart(state, row, col, big) {
        const lines = state.lines;
        let line = lines[row];
        if (row === 0 && col === 0) return null;
        col -= 1;
        for (;;) {
            if (col < 0) {
                if (row === 0) return { row: 0, col: 0 };
                row -= 1;
                line = lines[row];
                col = line.length - 1;
                if (line.length === 0) return { row, col: 0 };
                continue;
            }
            if (charClass(line[col], big) === BLANK) {
                col -= 1;
                continue;
            }
            break;
        }
        const cls = charClass(line[col], big);
        while (col > 0 && charClass(line[col - 1], big) === cls) col -= 1;
        return { row, col };
    }

    function findInLine(line, col, ch, kind, count) {
        let at = col;
        for (let n = 0; n < count; n += 1) {
            if (kind === "f" || kind === "t") {
                at = line.indexOf(ch, at + 1 + (kind === "t" && n === 0 ? 1 : 0));
            } else {
                const from = at - 1 - (kind === "T" && n === 0 ? 1 : 0);
                at = from < 0 ? -1 : line.lastIndexOf(ch, from);
            }
            if (at < 0) return -1;
        }
        if (kind === "t") return at - 1;
        if (kind === "T") return at + 1;
        return at;
    }

    function searchFrom(state, pattern, backward, row, col) {
        const lines = state.lines;
        const total = lines.length;
        if (!pattern) return null;
        if (!backward) {
            for (let step = 0; step <= total; step += 1) {
                const r = (row + step) % total;
                const from = step === 0 ? col + 1 : 0;
                const hit = lines[r].indexOf(pattern, from);
                if (hit >= 0 && (step < total || hit <= col)) return { row: r, col: hit, wrapped: row + step >= total };
            }
            return null;
        }
        for (let step = 0; step <= total; step += 1) {
            const r = (row - step + total * 2) % total;
            const line = lines[r];
            const to = step === 0 ? col - 1 : line.length;
            const hit = to < 0 ? -1 : line.lastIndexOf(pattern, to);
            if (hit >= 0 && (step < total || hit >= col)) return { row: r, col: hit, wrapped: row - step < 0 };
        }
        return null;
    }

    // ── motions → a target position and its range kind ──────────────────

    /** @returns {{row:number, col:number, kind:string, fail?:boolean}} */
    function motionTarget(state, motion, count, forOperator) {
        const key = motion.key;
        const n = count || 1;
        const { row, col } = state;
        const line = state.lines[row];
        const kind = LINEWISE.has(key) ? "linewise" : INCLUSIVE.has(key) ? "inclusive" : "exclusive";
        const at = (r, c, extra) => ({ row: r, col: c, kind, ...extra });
        switch (key) {
            case "h":
            case "Backspace":
                return col === 0 ? at(row, col, { fail: true }) : at(row, Math.max(0, col - n));
            case "l":
            case " ": {
                const max = forOperator ? line.length : Math.max(0, line.length - 1);
                return col >= max ? at(row, col, { fail: true }) : at(row, Math.min(max, col + n));
            }
            case "j":
                return row >= state.lines.length - 1 ? at(row, col, { fail: true }) : at(Math.min(state.lines.length - 1, row + n), state.want);
            case "k":
                return row === 0 ? at(row, col, { fail: true }) : at(Math.max(0, row - n), state.want);
            case "0":
                return at(row, 0);
            case "^":
                return at(row, firstNonBlank(line));
            case "$": {
                const r = Math.min(state.lines.length - 1, row + n - 1);
                return at(r, Math.max(0, state.lines[r].length - 1), { want: Infinity, pastEnd: forOperator ? state.lines[r].length : undefined });
            }
            case "gg": {
                const r = count ? Math.min(state.lines.length - 1, count - 1) : 0;
                return at(r, firstNonBlank(state.lines[r]));
            }
            case "G": {
                const r = count ? Math.min(state.lines.length - 1, count - 1) : state.lines.length - 1;
                return at(r, firstNonBlank(state.lines[r]));
            }
            case "w":
            case "W": {
                let pos = { row, col };
                for (let i = 0; i < n; i += 1) {
                    pos = nextWordStart(state, pos.row, pos.col, key === "W");
                    if (pos.eof) break;
                }
                if (pos.eof && !forOperator) return at(pos.row, Math.max(0, state.lines[pos.row].length - 1), { eof: true });
                return at(pos.row, pos.col, { eof: pos.eof });
            }
            case "e":
            case "E": {
                let pos = { row, col };
                for (let i = 0; i < n; i += 1) pos = nextWordEnd(state, pos.row, pos.col, key === "E");
                return at(pos.row, pos.col);
            }
            case "b":
            case "B": {
                let pos = { row, col };
                for (let i = 0; i < n; i += 1) {
                    const next = prevWordStart(state, pos.row, pos.col, key === "B");
                    if (!next) return at(row, col, { fail: true });
                    pos = next;
                }
                return at(pos.row, pos.col);
            }
            case "f":
            case "t":
            case "F":
            case "T": {
                const hit = findInLine(line, col, motion.ch, key, n);
                if (hit < 0 || hit === col) return at(row, col, { fail: true });
                return at(row, hit);
            }
            case ";":
            case ",": {
                const last = state.lastFind;
                if (!last) return at(row, col, { fail: true });
                let k = last.kind;
                if (key === ",") k = { f: "F", F: "f", t: "T", T: "t" }[k];
                const hit = findInLine(line, col, last.ch, k, n);
                if (hit < 0 || hit === col) return at(row, col, { fail: true });
                return at(row, hit);
            }
            case "n":
            case "N": {
                const last = state.lastSearch;
                if (!last) return at(row, col, { fail: true });
                const backward = key === "N" ? !last.backward : last.backward;
                let pos = { row, col };
                for (let i = 0; i < n; i += 1) {
                    const hit = searchFrom(state, last.pattern, backward, pos.row, pos.col);
                    if (!hit) return at(row, col, { fail: true });
                    pos = hit;
                }
                return at(pos.row, pos.col);
            }
            default:
                return at(row, col, { fail: true });
        }
    }

    // ── the normal-mode grammar ────────────────────────────────────────

    function readCount(keys, i) {
        let count = 0;
        let seen = false;
        while (i < keys.length && isDigit(keys[i]) && !(count === 0 && keys[i] === "0")) {
            count = count * 10 + Number(keys[i]);
            seen = true;
            i += 1;
        }
        return { count: seen ? count : 0, next: i };
    }

    function parseMotion(keys, i) {
        if (i >= keys.length) return { status: "partial" };
        const key = keys[i];
        if (key === "g") {
            if (i + 1 >= keys.length) return { status: "partial" };
            return keys[i + 1] === "g" ? { status: "complete", motion: { key: "gg" }, next: i + 2 } : { status: "invalid", key: `g${keyLabel(keys[i + 1])}` };
        }
        if (FINDS.has(key)) {
            if (i + 1 >= keys.length) return { status: "partial" };
            const ch = keys[i + 1];
            if (ch === "Escape") return { status: "cancel" };
            if (ch.length !== 1) return { status: "invalid", key: `${key}${keyLabel(ch)}` };
            return { status: "complete", motion: { key, ch }, next: i + 2 };
        }
        if (MOTIONS.has(key)) return { status: "complete", motion: { key }, next: i + 1 };
        return { status: "invalid", key: keyLabel(key) };
    }

    /** Parse a pending key sequence: partial (wait), complete (a command), invalid, or cancel. */
    function parseNormal(keys) {
        const first = readCount(keys, 0);
        let i = first.next;
        if (i >= keys.length) return { status: "partial" };
        const key = keys[i];
        if (key === "Escape") return { status: "cancel" };
        if (OPERATORS.has(key)) {
            i += 1;
            const second = readCount(keys, i);
            i = second.next;
            const count = first.count || second.count ? (first.count || 1) * (second.count || 1) : 0;
            if (i >= keys.length) return { status: "partial" };
            if (keys[i] === key) return { status: "complete", cmd: { type: "lineop", op: key, count } };
            const motion = parseMotion(keys, i);
            if (motion.status !== "complete") return motion.status === "invalid" ? { status: "invalid", key: `${key}${motion.key}` } : motion;
            return { status: "complete", cmd: { type: "op", op: key, motion: motion.motion, count } };
        }
        if (key === "r") {
            if (i + 1 >= keys.length) return { status: "partial" };
            const ch = keys[i + 1];
            if (ch === "Escape") return { status: "cancel" };
            if (ch.length !== 1) return { status: "invalid", key: `r${keyLabel(ch)}` };
            return { status: "complete", cmd: { type: "replace", ch, count: first.count } };
        }
        if (SIMPLE.has(key)) return { status: "complete", cmd: { type: "simple", key, count: first.count } };
        const motion = parseMotion(keys, i);
        if (motion.status !== "complete") return motion;
        return { status: "complete", cmd: { type: "motion", motion: motion.motion, count: first.count } };
    }

    // The key names a level's spellbook must contain for this command.
    function motionName(motion) {
        if (motion.key === " ") return "l";
        if (motion.key === "Backspace") return "h";
        return motion.key;
    }

    function requiredKeys(cmd) {
        const names = [];
        if (cmd.count) names.push("count");
        if (cmd.type === "motion") names.push(motionName(cmd.motion));
        else if (cmd.type === "op") names.push(cmd.op, motionName(cmd.motion));
        else if (cmd.type === "lineop") names.push(cmd.op + cmd.op);
        else if (cmd.type === "replace") names.push("r");
        else names.push(cmd.key);
        return names;
    }

    function allowedHas(allowed, name) {
        if (!allowed || ALWAYS.has(name)) return true;
        if (allowed.has(name)) return true;
        // `dd` is covered by the `d` operator; `D` by `d` + `$`; `x` stays its own key.
        if (name.length === 2 && name[0] === name[1] && OPERATORS.has(name[0])) return allowed.has(name[0]);
        if (name === "D") return allowed.has("d") && allowed.has("$");
        if (name === "C") return allowed.has("c") && allowed.has("$");
        if (name === "Y") return allowed.has("y") || allowed.has("yy");
        return false;
    }

    // The earliest a key can be refused: before the rest of the command is typed.
    function headName(key) {
        if (isDigit(key) && key !== "0") return "count";
        if (key === "g") return "gg";
        if (key === " ") return "l";
        if (key === "Backspace") return "h";
        return key;
    }

    function isKnownHead(key) {
        return isDigit(key) || key === "g" || key === "r" || OPERATORS.has(key) || SIMPLE.has(key) || MOTIONS.has(key) || FINDS.has(key);
    }

    function headAllowed(allowed, key) {
        if (!allowed) return true;
        const name = headName(key);
        if (OPERATORS.has(key)) return allowed.has(key) || allowed.has(key + key);
        return allowedHas(allowed, name);
    }

    // ── applying commands ───────────────────────────────────────────────

    function deleteRange(state, from, to, kind) {
        // from/to ordered; exclusive drops [from, to), inclusive [from, to].
        const lines = state.lines;
        if (kind === "linewise") {
            const removed = lines.splice(from.row, to.row - from.row + 1);
            if (!lines.length) lines.push("");
            state.register = { text: removed, linewise: true };
            setCursor(state, Math.min(from.row, lines.length - 1), firstNonBlank(lines[Math.min(from.row, lines.length - 1)]));
            return;
        }
        const endCol = kind === "inclusive" ? to.col + 1 : to.col;
        if (from.row === to.row) {
            const line = lines[from.row];
            const text = line.slice(from.col, endCol);
            lines[from.row] = line.slice(0, from.col) + line.slice(endCol);
            state.register = { text: [text], linewise: false };
        } else {
            const head = lines[from.row].slice(0, from.col);
            const tail = lines[to.row].slice(endCol);
            const text = [lines[from.row].slice(from.col), ...lines.slice(from.row + 1, to.row), lines[to.row].slice(0, endCol)];
            lines.splice(from.row, to.row - from.row + 1, head + tail);
            state.register = { text, linewise: false };
        }
        setCursor(state, from.row, from.col);
    }

    function yankRange(state, from, to, kind) {
        const lines = state.lines;
        if (kind === "linewise") {
            state.register = { text: lines.slice(from.row, to.row + 1), linewise: true };
            return;
        }
        const endCol = kind === "inclusive" ? to.col + 1 : to.col;
        if (from.row === to.row) state.register = { text: [lines[from.row].slice(from.col, endCol)], linewise: false };
        else state.register = { text: [lines[from.row].slice(from.col), ...lines.slice(from.row + 1, to.row), lines[to.row].slice(0, endCol)], linewise: false };
    }

    function orderRange(a, b) {
        const forward = a.row < b.row || (a.row === b.row && a.col <= b.col);
        return forward ? [a, b] : [b, a];
    }

    function enterInsert(state, row, col, takeSnapshot = true) {
        if (takeSnapshot) snapshot(state);
        state.mode = "insert";
        state.row = Math.max(0, Math.min(state.lines.length - 1, row));
        state.col = clampCol(state.lines[state.row], col, true);
        state.want = state.col;
    }

    function applyOperator(state, op, motion, count) {
        // `cw` on a word behaves like `ce` — vim's most-loved irregularity.
        let effective = motion;
        if (op === "c" && (motion.key === "w" || motion.key === "W") && charClass(state.lines[state.row][state.col], motion.key === "W") !== BLANK) {
            effective = { key: motion.key === "w" ? "e" : "E" };
        }
        const target = motionTarget(state, effective, count, true);
        if (target.fail) return false;
        let kind = target.kind;
        let end = { row: target.row, col: target.col };
        if ((motion.key === "w" || motion.key === "W") && op !== "c") {
            // `dw` never crosses a line: the last word of a line is deleted to its end.
            if (end.row !== state.row) end = { row: state.row, col: state.lines[state.row].length };
            else if (target.eof) end = { row: state.row, col: state.lines[state.row].length };
        }
        if (kind === "inclusive" && target.pastEnd !== undefined) {
            end = { row: end.row, col: target.pastEnd };
            kind = "exclusive";
        }
        if (FINDS.has(motion.key)) state.lastFind = { ch: motion.ch, kind: motion.key };
        const [from, to] = orderRange({ row: state.row, col: state.col }, end);
        if (op === "y") {
            yankRange(state, from, to, kind);
            setCursor(state, from.row, from.col);
            return true;
        }
        snapshot(state);
        if (op === "c" && kind === "linewise") {
            const removed = state.lines.splice(from.row, to.row - from.row + 1, "");
            state.register = { text: removed, linewise: true };
            state.changes += 1;
            enterInsert(state, from.row, 0, false);
            return true;
        }
        deleteRange(state, from, to, kind);
        state.changes += 1;
        if (op === "c") enterInsert(state, state.row, from.col, false);
        return true;
    }

    function applyLineOp(state, op, count) {
        const n = count || 1;
        const from = { row: state.row, col: 0 };
        const to = { row: Math.min(state.lines.length - 1, state.row + n - 1), col: 0 };
        if (op === "y") {
            yankRange(state, from, to, "linewise");
            return true;
        }
        snapshot(state);
        if (op === "c") {
            const removed = state.lines.splice(from.row, to.row - from.row + 1, "");
            state.register = { text: removed, linewise: true };
            state.changes += 1;
            enterInsert(state, from.row, 0, false);
            return true;
        }
        deleteRange(state, from, to, "linewise");
        state.changes += 1;
        return true;
    }

    function paste(state, after, count) {
        const reg = state.register;
        if (!reg || !reg.text.length) return false;
        snapshot(state);
        const n = count || 1;
        if (reg.linewise) {
            const block = [];
            for (let i = 0; i < n; i += 1) block.push(...reg.text);
            const at = after ? state.row + 1 : state.row;
            state.lines.splice(at, 0, ...block);
            setCursor(state, at, firstNonBlank(state.lines[at]));
        } else {
            const line = state.lines[state.row];
            const col = after && line.length ? state.col + 1 : state.col;
            let text = reg.text;
            if (n > 1) {
                const joined = reg.text.join("\n").repeat(n);
                text = joined.split("\n");
            }
            if (text.length === 1) {
                state.lines[state.row] = line.slice(0, col) + text[0] + line.slice(col);
                setCursor(state, state.row, col + text[0].length - 1);
            } else {
                const head = line.slice(0, col) + text[0];
                const tail = text[text.length - 1] + line.slice(col);
                state.lines.splice(state.row, 1, head, ...text.slice(1, -1), tail);
                setCursor(state, state.row, col);
            }
        }
        state.changes += 1;
        return true;
    }

    function applySimple(state, key, count) {
        const n = count || 1;
        const line = state.lines[state.row];
        switch (key) {
            case "x":
                if (!line.length) return false;
                return applyOperator(state, "d", { key: "l" }, n);
            case "X":
                if (state.col === 0) return false;
                return applyOperator(state, "d", { key: "h" }, n);
            case "D":
                return applyOperator(state, "d", { key: "$" }, n);
            case "C":
                return applyOperator(state, "c", { key: "$" }, n);
            case "Y":
                return applyLineOp(state, "y", n);
            case "p":
                return paste(state, true, n);
            case "P":
                return paste(state, false, n);
            case "u": {
                const last = state.undo.pop();
                if (!last) return false;
                state.lines = last.lines;
                setCursor(state, last.row, last.col);
                state.changes += 1;
                return true;
            }
            case "~": {
                if (!line.length) return false;
                snapshot(state);
                const end = Math.min(line.length, state.col + n);
                const swapped = line.slice(state.col, end).replace(/[a-zA-Z]/g, (c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()));
                state.lines[state.row] = line.slice(0, state.col) + swapped + line.slice(end);
                setCursor(state, state.row, Math.min(Math.max(0, line.length - 1), end));
                state.changes += 1;
                return true;
            }
            case "J": {
                if (state.row >= state.lines.length - 1) return false;
                snapshot(state);
                const joins = Math.max(1, n - 1);
                for (let i = 0; i < joins && state.row < state.lines.length - 1; i += 1) {
                    const current = state.lines[state.row];
                    const next = state.lines[state.row + 1].replace(/^\s+/, "");
                    const glue = current.length && next.length && !/\s$/.test(current) ? " " : "";
                    state.lines.splice(state.row, 2, current + glue + next);
                    setCursor(state, state.row, current.length);
                }
                state.changes += 1;
                return true;
            }
            case "i":
                enterInsert(state, state.row, state.col);
                return true;
            case "a":
                enterInsert(state, state.row, line.length ? state.col + 1 : 0);
                return true;
            case "I":
                enterInsert(state, state.row, line.search(/\S/) < 0 ? line.length : line.search(/\S/));
                return true;
            case "A":
                enterInsert(state, state.row, line.length);
                return true;
            case "o":
                snapshot(state);
                state.lines.splice(state.row + 1, 0, "");
                enterInsert(state, state.row + 1, 0, false);
                return true;
            case "O":
                snapshot(state);
                state.lines.splice(state.row, 0, "");
                enterInsert(state, state.row, 0, false);
                return true;
            default:
                return false;
        }
    }

    function applyMotion(state, motion, count) {
        const target = motionTarget(state, motion, count, false);
        if (FINDS.has(motion.key)) state.lastFind = { ch: motion.ch, kind: motion.key };
        if (target.fail) return false;
        const keepWant = LINEWISE.has(motion.key) && motion.key !== "gg" && motion.key !== "G";
        setCursor(state, target.row, target.col, keepWant);
        if (target.want === Infinity) state.want = Infinity;
        return true;
    }

    function applyCommand(state, cmd) {
        switch (cmd.type) {
            case "motion":
                return applyMotion(state, cmd.motion, cmd.count);
            case "op":
                return applyOperator(state, cmd.op, cmd.motion, cmd.count);
            case "lineop":
                return applyLineOp(state, cmd.op, cmd.count);
            case "replace": {
                const line = state.lines[state.row];
                const n = cmd.count || 1;
                if (state.col + n > line.length) return false;
                snapshot(state);
                state.lines[state.row] = line.slice(0, state.col) + cmd.ch.repeat(n) + line.slice(state.col + n);
                setCursor(state, state.row, state.col + n - 1);
                state.changes += 1;
                return true;
            }
            case "simple":
                return applySimple(state, cmd.key, cmd.count);
            default:
                return false;
        }
    }

    function describe(cmd) {
        if (cmd.type === "motion") return `${cmd.count || ""}${motionLabel(cmd.motion)}`;
        if (cmd.type === "op") return `${cmd.count || ""}${cmd.op}${motionLabel(cmd.motion)}`;
        if (cmd.type === "lineop") return `${cmd.count || ""}${cmd.op}${cmd.op}`;
        if (cmd.type === "replace") return `${cmd.count || ""}r${cmd.ch}`;
        return `${cmd.count || ""}${cmd.key}`;
    }

    function motionLabel(motion) {
        return motion.ch !== undefined ? `${motion.key}${motion.ch}` : keyLabel(motion.key);
    }

    // ── insert mode ─────────────────────────────────────────────────────

    function feedInsert(state, key) {
        const line = state.lines[state.row];
        if (key === "Escape") {
            state.mode = "normal";
            setCursor(state, state.row, Math.max(0, state.col - 1));
            state.changes += 1;
            return { consumed: true, applied: true, kind: "mode" };
        }
        if (key === "Enter") {
            state.lines.splice(state.row, 1, line.slice(0, state.col), line.slice(state.col));
            state.row += 1;
            state.col = 0;
            state.want = 0;
            return { consumed: true, applied: true, kind: "insert" };
        }
        if (key === "Backspace") {
            if (state.col > 0) {
                state.lines[state.row] = line.slice(0, state.col - 1) + line.slice(state.col);
                state.col -= 1;
            } else if (state.row > 0) {
                const prev = state.lines[state.row - 1];
                state.lines.splice(state.row - 1, 2, prev + line);
                state.row -= 1;
                state.col = prev.length;
            } else {
                return { consumed: true, applied: false, kind: "insert" };
            }
            state.want = state.col;
            return { consumed: true, applied: true, kind: "insert" };
        }
        if (typeof key === "string" && key.length === 1 && key !== "\t") {
            state.lines[state.row] = line.slice(0, state.col) + key + line.slice(state.col);
            state.col += 1;
            state.want = state.col;
            return { consumed: true, applied: true, kind: "insert" };
        }
        return { consumed: false, applied: false, kind: null };
    }

    // ── the one entry point ─────────────────────────────────────────────

    function toSet(allowed) {
        if (!allowed) return null;
        return allowed instanceof Set ? allowed : new Set(allowed);
    }

    /**
     * Feed one key. Returns { consumed, applied, kind, command, pending, error }:
     * consumed=false means the key is not the editor's (the host may use it);
     * applied=true means the buffer or cursor may have changed; error is
     * { code: "locked" | "unknown" | "fail", key, message } or null.
     */
    function feed(state, key, options = {}) {
        const allowed = toSet(options.allowed);
        const base = { consumed: true, applied: false, kind: null, command: null, pending: "", error: null };
        if (state.mode === "insert") {
            const result = feedInsert(state, key);
            return { ...base, ...result };
        }
        if (key === "Escape") {
            if (!state.pending.length) return { ...base, consumed: false };
            state.pending = [];
            return { ...base, kind: "cancel" };
        }
        if (typeof key !== "string" || (key.length !== 1 && key !== "Backspace")) return { ...base, consumed: false };
        if (!state.pending.length) {
            if (!isKnownHead(key)) return { ...base, error: { code: "unknown", key: keyLabel(key), message: `${keyLabel(key)} is not a key you know here` } };
            if (!headAllowed(allowed, key)) return { ...base, error: { code: "locked", key: headName(key), message: `${keyLabel(headName(key))} is not in your spellbook yet` } };
        }
        state.pending.push(key);
        const parsed = parseNormal(state.pending);
        if (parsed.status === "partial") return { ...base, kind: "pending", pending: state.pending.map(keyLabel).join("") };
        const typed = state.pending.map(keyLabel).join("");
        state.pending = [];
        if (parsed.status === "cancel") return { ...base, kind: "cancel" };
        if (parsed.status === "invalid") {
            return { ...base, error: { code: "unknown", key: parsed.key, message: `${parsed.key} is not a key you know here` } };
        }
        const cmd = parsed.cmd;
        const missing = requiredKeys(cmd).find((name) => !allowedHas(allowed, name));
        if (missing) {
            return { ...base, command: typed, error: { code: "locked", key: missing, message: `${keyLabel(missing)} is not in your spellbook yet` } };
        }
        const ok = applyCommand(state, cmd);
        return {
            ...base,
            applied: ok,
            kind: cmd.type === "motion" ? "motion" : cmd.type === "simple" && /^[iaIAoO]$/.test(cmd.key) ? "mode" : "edit",
            command: describe(cmd),
            error: ok ? null : { code: "fail", key: typed, message: `${typed} cannot move from here` },
        };
    }

    /** `/pattern` from the command line: literal, case-sensitive, wraps around. */
    function search(state, pattern, backward = false) {
        state.pending = [];
        if (!pattern) return { found: false, wrapped: false };
        state.lastSearch = { pattern, backward: Boolean(backward) };
        const hit = searchFrom(state, pattern, backward, state.row, state.col);
        if (!hit) return { found: false, wrapped: false };
        setCursor(state, hit.row, hit.col);
        return { found: true, wrapped: Boolean(hit.wrapped) };
    }

    const api = {
        createState,
        feed,
        search,
        toKeys,
        keyLabel,
        parseNormal,
        motionTarget,
        charClass,
        requiredKeys,
        allowedHas,
        BLANK,
        PUNCT,
        WORD,
    };

    if (typeof module === "object" && module && module.exports) module.exports = api;
    global.BashcrawlVim = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
