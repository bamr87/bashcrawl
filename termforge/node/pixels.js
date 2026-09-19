"use strict";
// TermForge pixel canvas — sub-cell "high-res" graphics for byte-stream hosts.
//
// A terminal cell is two vertically stacked pixels. The upper half block (▀)
// paints them independently: foreground = top pixel, background = bottom
// pixel, both 24-bit. A cols×rows terminal therefore holds a cols×(2·rows)
// framebuffer with roughly square pixels — enough for sprites, particles,
// a pixel font, and proper explosions, while every byte stays plain ANSI.
//
//   PixelBuffer  — RGB framebuffer with set/get/rect/sprite/text/blit/add
//   FONT3x5      — the pixel font (A–Z, 0–9, punctuation) text() draws with
//   encodeRow()  — one cell row → SGR runs ("▀" / "▄" / "█" / " ")
//   PixelScreen  — presents a buffer to a write() sink, rewriting only the
//                  cell rows that changed since the last frame
//
// No timers, no input, no game state: hosts own the clock and the layout.

const ESC = "\u001b";
const CSI = `${ESC}[`;

const FONT3x5 = Object.freeze({
    A: [".#.", "#.#", "###", "#.#", "#.#"],
    B: ["##.", "#.#", "##.", "#.#", "##."],
    C: [".##", "#..", "#..", "#..", ".##"],
    D: ["##.", "#.#", "#.#", "#.#", "##."],
    E: ["###", "#..", "##.", "#..", "###"],
    F: ["###", "#..", "##.", "#..", "#.."],
    G: [".##", "#..", "#.#", "#.#", ".##"],
    H: ["#.#", "#.#", "###", "#.#", "#.#"],
    I: ["###", ".#.", ".#.", ".#.", "###"],
    J: ["..#", "..#", "..#", "#.#", ".#."],
    K: ["#.#", "#.#", "##.", "#.#", "#.#"],
    L: ["#..", "#..", "#..", "#..", "###"],
    M: ["#.#", "###", "###", "#.#", "#.#"],
    N: ["##.", "#.#", "#.#", "#.#", "#.#"],
    O: [".#.", "#.#", "#.#", "#.#", ".#."],
    P: ["##.", "#.#", "##.", "#..", "#.."],
    Q: [".#.", "#.#", "#.#", ".#.", "..#"],
    R: ["##.", "#.#", "##.", "#.#", "#.#"],
    S: [".##", "#..", ".#.", "..#", "##."],
    T: ["###", ".#.", ".#.", ".#.", ".#."],
    U: ["#.#", "#.#", "#.#", "#.#", "###"],
    V: ["#.#", "#.#", "#.#", "#.#", ".#."],
    W: ["#.#", "#.#", "###", "###", "#.#"],
    X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
    Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
    Z: ["###", "..#", ".#.", "#..", "###"],
    0: ["###", "#.#", "#.#", "#.#", "###"],
    1: [".#.", "##.", ".#.", ".#.", "###"],
    2: ["##.", "..#", ".#.", "#..", "###"],
    3: ["###", "..#", ".##", "..#", "###"],
    4: ["#.#", "#.#", "###", "..#", "..#"],
    5: ["###", "#..", "##.", "..#", "##."],
    6: [".##", "#..", "###", "#.#", "###"],
    7: ["###", "..#", ".#.", ".#.", ".#."],
    8: ["###", "#.#", "###", "#.#", "###"],
    9: ["###", "#.#", "###", "..#", "##."],
    " ": ["...", "...", "...", "...", "..."],
    ".": ["...", "...", "...", "...", ".#."],
    ",": ["...", "...", "...", ".#.", "#.."],
    ":": ["...", ".#.", "...", ".#.", "..."],
    "-": ["...", "...", "###", "...", "..."],
    "_": ["...", "...", "...", "...", "###"],
    "!": [".#.", ".#.", ".#.", "...", ".#."],
    "?": ["###", "..#", ".##", "...", ".#."],
    "$": [".##", "##.", ".#.", ".##", "##."],
    ">": ["#..", ".#.", "..#", ".#.", "#.."],
    "<": ["..#", ".#.", "#..", ".#.", "..#"],
    "&": [".#.", "#.#", ".#.", "#.#", ".##"],
    "%": ["#.#", "..#", ".#.", "#..", "#.#"],
    "#": ["#.#", "###", "#.#", "###", "#.#"],
    "/": ["..#", "..#", ".#.", "#..", "#.."],
    "*": ["#.#", ".#.", "###", ".#.", "#.#"],
    "+": ["...", ".#.", "###", ".#.", "..."],
    "(": [".#.", "#..", "#..", "#..", ".#."],
    ")": [".#.", "..#", "..#", "..#", ".#."],
    "[": ["##.", "#..", "#..", "#..", "##."],
    "]": [".##", "..#", "..#", "..#", ".##"],
    "|": [".#.", ".#.", ".#.", ".#.", ".#."],
    "=": ["...", "###", "...", "###", "..."],
    "'": [".#.", ".#.", "...", "...", "..."],
    "^": [".#.", "#.#", "...", "...", "..."],
});
const FONT_W = 3;
const FONT_H = 5;
const FONT_GAP = 1;

function clamp255(n) {
    return n < 0 ? 0 : n > 255 ? 255 : n | 0;
}

function scaleColor(rgb, k) {
    return [clamp255(rgb[0] * k), clamp255(rgb[1] * k), clamp255(rgb[2] * k)];
}

function mixColor(a, b, t) {
    return [
        clamp255(a[0] + (b[0] - a[0]) * t),
        clamp255(a[1] + (b[1] - a[1]) * t),
        clamp255(a[2] + (b[2] - a[2]) * t),
    ];
}

class PixelBuffer {
    constructor(width, height) {
        this.w = Math.max(1, width | 0);
        this.h = Math.max(1, height | 0);
        this.data = new Uint8ClampedArray(this.w * this.h * 3);
    }

    clear(rgb) {
        if (!rgb) {
            this.data.fill(0);
            return;
        }
        for (let i = 0; i < this.data.length; i += 3) {
            this.data[i] = rgb[0];
            this.data[i + 1] = rgb[1];
            this.data[i + 2] = rgb[2];
        }
    }

    inBounds(x, y) {
        return x >= 0 && y >= 0 && x < this.w && y < this.h;
    }

    set(x, y, rgb) {
        x = Math.round(x);
        y = Math.round(y);
        if (!this.inBounds(x, y)) return;
        const i = (y * this.w + x) * 3;
        this.data[i] = rgb[0];
        this.data[i + 1] = rgb[1];
        this.data[i + 2] = rgb[2];
    }

    /** Additive blend (glow, halos). */
    add(x, y, rgb) {
        x = Math.round(x);
        y = Math.round(y);
        if (!this.inBounds(x, y)) return;
        const i = (y * this.w + x) * 3;
        this.data[i] = clamp255(this.data[i] + rgb[0]);
        this.data[i + 1] = clamp255(this.data[i + 1] + rgb[1]);
        this.data[i + 2] = clamp255(this.data[i + 2] + rgb[2]);
    }

    get(x, y) {
        x = Math.round(x);
        y = Math.round(y);
        if (!this.inBounds(x, y)) return null;
        const i = (y * this.w + x) * 3;
        return [this.data[i], this.data[i + 1], this.data[i + 2]];
    }

    isBlack(x, y) {
        const i = (y * this.w + x) * 3;
        return this.data[i] === 0 && this.data[i + 1] === 0 && this.data[i + 2] === 0;
    }

    rect(x, y, w, h, rgb) {
        const x0 = Math.max(0, Math.round(x));
        const y0 = Math.max(0, Math.round(y));
        const x1 = Math.min(this.w, Math.round(x + w));
        const y1 = Math.min(this.h, Math.round(y + h));
        for (let py = y0; py < y1; py += 1) {
            for (let px = x0; px < x1; px += 1) {
                const i = (py * this.w + px) * 3;
                this.data[i] = rgb[0];
                this.data[i + 1] = rgb[1];
                this.data[i + 2] = rgb[2];
            }
        }
    }

    /**
     * Blit a character sprite. `rows` is an array of equal-length strings;
     * "." and " " are transparent, every other char looks up `palette`.
     */
    sprite(x, y, rows, palette) {
        const ox = Math.round(x);
        const oy = Math.round(y);
        for (let r = 0; r < rows.length; r += 1) {
            const row = rows[r];
            for (let c = 0; c < row.length; c += 1) {
                const ch = row[c];
                if (ch === "." || ch === " ") continue;
                const rgb = palette[ch] || palette["#"];
                if (rgb) this.set(ox + c, oy + r, rgb);
            }
        }
    }

    /** Draw text in the 3×5 font; returns the width in pixels. */
    text(x, y, str, rgb, scale) {
        const k = Math.max(1, scale | 0);
        let cx = Math.round(x);
        const cy = Math.round(y);
        for (const raw of String(str)) {
            const ch = raw.toUpperCase();
            const glyph = FONT3x5[ch] || FONT3x5["?"];
            for (let r = 0; r < FONT_H; r += 1) {
                for (let c = 0; c < FONT_W; c += 1) {
                    if (glyph[r][c] !== "#") continue;
                    if (k === 1) this.set(cx + c, cy + r, rgb);
                    else this.rect(cx + c * k, cy + r * k, k, k, rgb);
                }
            }
            cx += (FONT_W + FONT_GAP) * k;
        }
        return cx - Math.round(x) - FONT_GAP * k;
    }

    static textWidth(str, scale) {
        const k = Math.max(1, scale | 0);
        const n = String(str).length;
        return n ? n * (FONT_W + FONT_GAP) * k - FONT_GAP * k : 0;
    }

    /** Copy `src` onto this buffer at an offset, skipping black source pixels. */
    blit(src, dx, dy) {
        const ox = Math.round(dx);
        const oy = Math.round(dy);
        for (let y = 0; y < src.h; y += 1) {
            const ty = y + oy;
            if (ty < 0 || ty >= this.h) continue;
            for (let x = 0; x < src.w; x += 1) {
                const tx = x + ox;
                if (tx < 0 || tx >= this.w) continue;
                const si = (y * src.w + x) * 3;
                if (src.data[si] === 0 && src.data[si + 1] === 0 && src.data[si + 2] === 0) continue;
                const ti = (ty * this.w + tx) * 3;
                this.data[ti] = src.data[si];
                this.data[ti + 1] = src.data[si + 1];
                this.data[ti + 2] = src.data[si + 2];
            }
        }
    }

    /** Multiply every pixel on odd rows by `k` — the CRT scanline look. */
    scanlines(k) {
        for (let y = 1; y < this.h; y += 2) {
            const start = y * this.w * 3;
            const end = start + this.w * 3;
            for (let i = start; i < end; i += 1) this.data[i] = clamp255(this.data[i] * k);
        }
    }
}

// ── encoding ────────────────────────────────────────────────────────────────

const RAMP = " ░▒▓█";

function luminance(r, g, b) {
    return (r * 299 + g * 587 + b * 114) / 1000;
}

/**
 * Encode cell row `cy` (pixel rows 2cy and 2cy+1) as SGR runs. Black pixels
 * are the terminal's own background, so empty space costs a single byte.
 */
function encodeRow(buf, cy, color) {
    const yTop = cy * 2;
    const yBot = yTop + 1;
    const hasBot = yBot < buf.h;
    let out = "";
    let fg = null;
    let bg = null;
    for (let x = 0; x < buf.w; x += 1) {
        const ti = (yTop * buf.w + x) * 3;
        const bi = hasBot ? (yBot * buf.w + x) * 3 : -1;
        const tr = buf.data[ti];
        const tg = buf.data[ti + 1];
        const tb = buf.data[ti + 2];
        const br = hasBot ? buf.data[bi] : 0;
        const bgc = hasBot ? buf.data[bi + 1] : 0;
        const bb = hasBot ? buf.data[bi + 2] : 0;
        const topBlack = tr === 0 && tg === 0 && tb === 0;
        const botBlack = br === 0 && bgc === 0 && bb === 0;

        if (!color) {
            const lum = Math.max(luminance(tr, tg, tb), luminance(br, bgc, bb));
            out += RAMP[Math.min(4, Math.round((lum / 255) * 4))];
            continue;
        }

        let glyph;
        let wantFg = null;
        let wantBg = null;
        if (topBlack && botBlack) {
            glyph = " ";
        } else if (topBlack) {
            glyph = "▄";
            wantFg = `${br};${bgc};${bb}`;
        } else if (botBlack) {
            glyph = "▀";
            wantFg = `${tr};${tg};${tb}`;
        } else if (tr === br && tg === bgc && tb === bb) {
            glyph = "█";
            wantFg = `${tr};${tg};${tb}`;
        } else {
            glyph = "▀";
            wantFg = `${tr};${tg};${tb}`;
            wantBg = `${br};${bgc};${bb}`;
        }
        if (wantBg === null && bg !== null) {
            out += `${CSI}0m`;
            fg = null;
            bg = null;
        }
        if (wantFg !== fg) {
            out += wantFg === null ? `${CSI}39m` : `${CSI}38;2;${wantFg}m`;
            fg = wantFg;
        }
        if (wantBg !== bg) {
            out += `${CSI}48;2;${wantBg}m`;
            bg = wantBg;
        }
        out += glyph;
    }
    if (fg !== null || bg !== null) out += `${CSI}0m`;
    return out;
}

class PixelScreen {
    /**
     * @param {object} options
     * @param {(chunk: string) => void} options.write
     * @param {number} [options.top]    1-based terminal row of pixel row 0 (default 1)
     * @param {boolean} [options.color] 24-bit output (default true); false = luminance ramp
     */
    constructor(options) {
        const opts = options || {};
        if (typeof opts.write !== "function") throw new Error("PixelScreen requires options.write");
        this._write = opts.write;
        this.top = opts.top || 1;
        this.color = opts.color !== false;
        this.prev = [];
        this.frames = 0;
        this.bytes = 0;
    }

    /** Forget the last frame so the next present() rewrites every row. */
    invalidate() {
        this.prev = [];
    }

    /** Paint a buffer; only cell rows that changed are written. Returns rows written. */
    present(buf) {
        const cellRows = Math.ceil(buf.h / 2);
        const parts = [];
        for (let cy = 0; cy < cellRows; cy += 1) {
            const row = encodeRow(buf, cy, this.color);
            if (row === this.prev[cy]) continue;
            this.prev[cy] = row;
            parts.push(`${CSI}${this.top + cy};1H${row}`);
        }
        this.prev.length = cellRows;
        if (parts.length) {
            const chunk = `${CSI}?25l${parts.join("")}`;
            this.bytes += chunk.length;
            this._write(chunk);
        }
        this.frames += 1;
        return parts.length;
    }
}

module.exports = {
    PixelBuffer,
    PixelScreen,
    encodeRow,
    FONT3x5,
    FONT_W,
    FONT_H,
    scaleColor,
    mixColor,
    clamp255,
};
