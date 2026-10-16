(function (global, factory) {
    "use strict";
    const api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else {
        global.TermForge = global.TermForge || {};
        global.TermForge.asciiMotion = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";
    // ASCII Motion playback for TermForge.
    //
    // Loads every open file format from https://github.com/cameronfoxly/Ascii-Motion
    // (MIT): JSON export, text export, HTML frame grids, session v1 .asciimtn, and
    // session v2 .asciimtn layer timelines (flattened: layers, groups, keyframed
    // transforms with the editor's easing, effect tracks). Clips step as cell
    // grids. The editor's cell effects run live with its own settings: levels,
    // hue-saturation, remap-colors, remap-characters, scatter, wave-warp, wiggle,
    // motion-trails. Library names clips for an app; toSession/toText write files
    // the editor opens. No DOM, no node:*. Generator layers and WebGL post effects
    // are not rendered (flattenSession lists them in clip.warnings).

    const FORMAT = "ascii-motion-json-1";
    const EFFECT_TYPES = Object.freeze([
        "levels",
        "hue-saturation",
        "remap-colors",
        "remap-characters",
        "scatter",
        "wave-warp",
        "wiggle",
        "motion-trails",
    ]);

    function clampByte(n) {
        return Math.max(0, Math.min(255, Math.round(n)));
    }

    function normalizeColor(value, fallback) {
        const raw = String(value == null ? "" : value).trim();
        if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) return raw.toLowerCase();
        if (raw.toLowerCase() === "transparent") return "transparent";
        return fallback;
    }

    function hexToRgb(hex) {
        const raw = normalizeColor(hex, "");
        if (!raw || raw === "transparent") return null;
        const body = raw.slice(1);
        const full = body.length === 3
            ? body.split("").map((ch) => ch + ch).join("")
            : body;
        return {
            r: parseInt(full.slice(0, 2), 16),
            g: parseInt(full.slice(2, 4), 16),
            b: parseInt(full.slice(4, 6), 16),
        };
    }

    function rgbToHex(r, g, b) {
        const part = (n) => clampByte(n).toString(16).padStart(2, "0");
        return `#${part(r)}${part(g)}${part(b)}`;
    }

    function hexToHsl(hex) {
        const rgb = hexToRgb(hex);
        if (!rgb) return null;
        const r = rgb.r / 255;
        const g = rgb.g / 255;
        const b = rgb.b / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0;
        let s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h /= 6;
        }
        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    }

    function hslToHex(h, s, l) {
        const hue = ((h % 360) + 360) % 360 / 360;
        const sat = Math.max(0, Math.min(100, s)) / 100;
        const lit = Math.max(0, Math.min(100, l)) / 100;
        if (sat === 0) {
            const v = Math.round(lit * 255);
            return rgbToHex(v, v, v);
        }
        const q = lit < 0.5 ? lit * (1 + sat) : lit + sat - lit * sat;
        const p = 2 * lit - q;
        const hue2rgb = (t) => {
            let u = t;
            if (u < 0) u += 1;
            if (u > 1) u -= 1;
            if (u < 1 / 6) return p + (q - p) * 6 * u;
            if (u < 1 / 2) return q;
            if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
            return p;
        };
        return rgbToHex(
            Math.round(hue2rgb(hue + 1 / 3) * 255),
            Math.round(hue2rgb(hue) * 255),
            Math.round(hue2rgb(hue - 1 / 3) * 255),
        );
    }

    function mixHex(from, to, t) {
        const a = hexToRgb(from) || { r: 0, g: 0, b: 0 };
        const b = hexToRgb(to) || a;
        const u = Math.max(0, Math.min(1, t));
        return rgbToHex(a.r + (b.r - a.r) * u, a.g + (b.g - a.g) * u, a.b + (b.b - a.b) * u);
    }

    function colorMap(value) {
        if (!value) return {};
        if (typeof value === "string") {
            try {
                const parsed = JSON.parse(value);
                return parsed && typeof parsed === "object" ? parsed : {};
            } catch (_err) {
                return {};
            }
        }
        return typeof value === "object" ? value : {};
    }

    function cell(x, y, char, color, bgColor) {
        return {
            x,
            y,
            char: char && char !== "" ? char : " ",
            color: normalizeColor(color, "#ffffff"),
            bgColor: normalizeColor(bgColor, "transparent"),
        };
    }

    function durationOf(value, frameRate) {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) return n;
        const fps = Number(frameRate);
        if (Number.isFinite(fps) && fps > 0) return 1000 / fps;
        return 100;
    }

    function effectsOf(source) {
        if (!source || !Array.isArray(source.effects)) return [];
        return source.effects.filter((effect) => effect && typeof effect.type === "string");
    }

    function frameFromContent(entry, width, height, frameRate) {
        const content = entry.content != null ? entry.content : entry.contentString;
        const lines = Array.isArray(content) ? content.map((line) => String(line)) : String(content || "").split("\n");
        const fg = colorMap(entry.colors && entry.colors.foreground);
        const bg = colorMap(entry.colors && entry.colors.background);
        const h = height || lines.length || 1;
        const w = width || lines.reduce((max, line) => Math.max(max, Array.from(line).length), 0) || 1;
        const cells = [];
        for (let y = 0; y < lines.length && y < h; y += 1) {
            const chars = Array.from(lines[y]);
            for (let x = 0; x < chars.length && x < w; x += 1) {
                const ch = chars[x];
                const color = fg[`${x},${y}`];
                const bgColor = bg[`${x},${y}`];
                if ((ch && ch !== " ") || color || bgColor) {
                    cells.push(cell(x, y, ch, color, bgColor));
                }
            }
        }
        return { duration: durationOf(entry.duration, frameRate), cells, spanW: w, spanH: h };
    }

    function frameFromCells(entry, frameRate) {
        const cells = [];
        let spanW = 0;
        let spanH = 0;
        for (const item of entry.cells || []) {
            if (!item) continue;
            const x = Number(item.x);
            const y = Number(item.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            cells.push(cell(x, y, item.char, item.color, item.bgColor));
            spanW = Math.max(spanW, x + 1);
            spanH = Math.max(spanH, y + 1);
        }
        return { duration: durationOf(entry.duration, frameRate), cells, spanW, spanH };
    }

    function frameFromMap(entry, frameRate) {
        const data = entry.data || {};
        const cells = [];
        for (const key of Object.keys(data)) {
            const parts = key.split(",");
            const x = Number(parts[0]);
            const y = Number(parts[1]);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            const item = data[key] || {};
            cells.push(cell(x, y, item.char, item.color, item.bgColor));
        }
        return { duration: durationOf(entry.duration, frameRate), cells, spanW: 0, spanH: 0 };
    }

    function frameFromGrid(entry, frameRate) {
        const rows = entry.characters || [];
        const colors = entry.colors || [];
        const backgrounds = entry.backgrounds || [];
        const cells = [];
        let spanW = 0;
        for (let y = 0; y < rows.length; y += 1) {
            const row = rows[y] || [];
            spanW = Math.max(spanW, row.length);
            for (let x = 0; x < row.length; x += 1) {
                const ch = row[x];
                const color = colors[y] && colors[y][x];
                const bgColor = backgrounds[y] && backgrounds[y][x];
                if ((ch && ch !== " ") || (color && color !== "#ffffff") || (bgColor && bgColor !== "transparent")) {
                    cells.push(cell(x, y, ch, color, bgColor));
                }
            }
        }
        return { duration: durationOf(entry.duration, frameRate), cells, spanW, spanH: rows.length };
    }

    function bounds(frames, width, height) {
        let w = width || 0;
        let h = height || 0;
        for (const frame of frames) {
            w = Math.max(w, frame.spanW || 0);
            h = Math.max(h, frame.spanH || 0);
            for (const item of frame.cells) {
                w = Math.max(w, item.x + 1);
                h = Math.max(h, item.y + 1);
            }
        }
        return { width: w || 1, height: h || 1 };
    }

    function parseText(raw) {
        let body = String(raw || "").replace(/\r\n/g, "\n");
        if (body.startsWith("ASCII Motion Text Export")) {
            const marker = body.indexOf("\n---\n");
            body = marker >= 0 ? body.slice(marker + 5) : body;
        }
        body = body.replace(/^\n+/, "").replace(/\n+$/, "");
        const chunks = body.length
            ? body.split(/\n,\n/).map((chunk) => chunk.replace(/^\n+|\n+$/g, "")).filter((chunk) => chunk.length)
            : [];
        const frames = chunks.map((chunk) => frameFromContent({
            content: chunk.split("\n"),
            duration: 100,
        }, 0, 0, 0));
        const kept = frames.length ? frames : [frameFromContent({ content: [""], duration: 100 }, 1, 1, 0)];
        const size = bounds(kept, 0, 0);
        return finish({
            source: "text",
            title: "",
            width: size.width,
            height: size.height,
            backgroundColor: "#000000",
            frameRate: 10,
            looping: false,
            currentFrame: 0,
            frames: kept,
            effects: [],
        });
    }

    function finish(clip) {
        clip.format = FORMAT;
        clip.frames = clip.frames.map((frame) => ({
            duration: durationOf(frame.duration, clip.frameRate),
            cells: frame.cells.filter((item) => item.char !== " " || item.bgColor !== "transparent" || item.color !== "#ffffff"),
        }));
        return clip;
    }

    function parse(input) {
        if (typeof input === "string") {
            const raw = input.replace(/^\uFEFF/, "");
            const head = raw.trim();
            if (!head) throw new Error("empty ASCII Motion export");
            if (head[0] === "{" || head[0] === "[") return parse(JSON.parse(head));
            // Untrimmed: the first line's indentation is part of the art.
            return parseText(raw);
        }
        if (!input || typeof input !== "object") {
            throw new Error("ASCII Motion clip must be an object or export string");
        }
        if (Array.isArray(input.layers) && !input.frames && !(input.animation && input.animation.frames)) {
            return flattenSession(input);
        }
        if (input.format === FORMAT && Array.isArray(input.frames) && input.frames[0] && Array.isArray(input.frames[0].cells)) {
            const frames = input.frames.map((frame) => frameFromCells(frame, input.frameRate));
            const size = bounds(frames, Number(input.width) || 0, Number(input.height) || 0);
            return finish({
                title: input.title || "",
                width: size.width,
                height: size.height,
                backgroundColor: normalizeColor(input.backgroundColor, "#000000"),
                frameRate: Number(input.frameRate) || 12,
                looping: Boolean(input.looping),
                currentFrame: Number(input.currentFrame) || 0,
                frames,
                effects: effectsOf(input),
                warnings: Array.isArray(input.warnings) ? input.warnings.slice() : [],
                source: input.source || "clip",
            });
        }
        const sessionFrames = input.animation && Array.isArray(input.animation.frames)
            ? input.animation.frames
            : null;
        const canvas = input.canvas || {};
        const width = Number(canvas.width || input.width) || 0;
        const height = Number(canvas.height || input.height) || 0;
        const backgroundColor = normalizeColor(
            canvas.backgroundColor || canvas.canvasBackgroundColor || input.backgroundColor,
            "#000000",
        );
        const animation = input.animation || {};
        const frameRate = Number(animation.frameRate || input.frameRate) || 12;
        const looping = animation.looping != null ? Boolean(animation.looping) : Boolean(input.looping);
        const currentFrame = Number(animation.currentFrame != null ? animation.currentFrame : input.currentFrame) || 0;
        const title = (input.metadata && (input.metadata.title || input.metadata.projectName))
            || input.name
            || "";
        let frames;
        let source;
        if (sessionFrames && sessionFrames[0] && sessionFrames[0].data && !sessionFrames[0].content) {
            frames = sessionFrames.map((frame) => frameFromMap(frame, frameRate));
            source = "session-v1";
        } else if (Array.isArray(input.frames) && input.frames[0] && input.frames[0].characters) {
            frames = input.frames.map((frame) => frameFromGrid(frame, frameRate));
            source = "html-grid";
        } else if (Array.isArray(input.frames) && input.frames[0] && Array.isArray(input.frames[0].cells)) {
            frames = input.frames.map((frame) => frameFromCells(frame, frameRate));
            source = "json-cells";
        } else if (Array.isArray(input.frames) && input.frames[0] && (input.frames[0].content != null || input.frames[0].contentString != null)) {
            frames = input.frames.map((frame) => frameFromContent(frame, width, height, frameRate));
            source = "json";
        } else if (typeof input.text === "string") {
            return parseText(input.text);
        } else {
            throw new Error("unrecognized ASCII Motion export");
        }
        const size = bounds(frames, width, height);
        return finish({
            source,
            title,
            width: size.width,
            height: size.height,
            backgroundColor,
            frameRate,
            looping,
            currentFrame,
            frames,
            effects: effectsOf(input),
        });
    }

    function totalDuration(clip) {
        return (clip.frames || []).reduce((sum, frame) => sum + durationOf(frame.duration, clip.frameRate), 0);
    }

    function frameIndex(clip, elapsedMs, looping) {
        const frames = clip.frames || [];
        if (!frames.length) return 0;
        const loop = looping != null ? looping : clip.looping;
        const total = totalDuration(clip) || 1;
        let t = Math.max(0, Number(elapsedMs) || 0);
        if (loop) t %= total;
        else if (t >= total) return frames.length - 1;
        let acc = 0;
        for (let i = 0; i < frames.length; i += 1) {
            acc += durationOf(frames[i].duration, clip.frameRate);
            if (t < acc) return i;
        }
        return frames.length - 1;
    }

    function copyCells(cells) {
        return cells.map((item) => ({ ...item }));
    }

    function applyLevelsChannel(value, shadows, midtones, highlights, outputMin, outputMax) {
        if (highlights <= shadows) return clampByte(value);
        if (value <= shadows) return clampByte(outputMin);
        if (value >= highlights) return clampByte(outputMax);
        const normalized = (value - shadows) / (highlights - shadows);
        const gamma = midtones <= 50
            ? 0.1 + (midtones / 50) * 0.9
            : 1 + ((midtones - 50) / 50) * 2;
        const adjusted = Math.pow(normalized, 1 / gamma);
        return clampByte(outputMin + adjusted * (outputMax - outputMin));
    }

    function applyLevelsColor(color, settings) {
        const rgb = hexToRgb(color);
        if (!rgb) return color;
        const shadows = Number(settings.shadowsInput) || 0;
        const midtones = settings.midtonesInput == null ? 50 : Number(settings.midtonesInput);
        const highlights = settings.highlightsInput == null ? 255 : Number(settings.highlightsInput);
        const outputMin = Number(settings.outputMin) || 0;
        const outputMax = settings.outputMax == null ? 255 : Number(settings.outputMax);
        return rgbToHex(
            applyLevelsChannel(rgb.r, shadows, midtones, highlights, outputMin, outputMax),
            applyLevelsChannel(rgb.g, shadows, midtones, highlights, outputMin, outputMax),
            applyLevelsChannel(rgb.b, shadows, midtones, highlights, outputMin, outputMax),
        );
    }

    function effectLevels(cells, settings) {
        return cells.map((item) => ({
            ...item,
            color: applyLevelsColor(item.color, settings),
            bgColor: item.bgColor === "transparent" ? "transparent" : applyLevelsColor(item.bgColor, settings),
        }));
    }

    function effectHue(cells, settings) {
        const hue = Number(settings.hue) || 0;
        const saturation = Number(settings.saturation) || 0;
        const lightness = Number(settings.lightness) || 0;
        const shift = (color) => {
            const hsl = hexToHsl(color);
            if (!hsl) return color;
            return hslToHex(hsl.h + hue, hsl.s + saturation, hsl.l + lightness);
        };
        return cells.map((item) => ({
            ...item,
            color: shift(item.color),
            bgColor: item.bgColor === "transparent" ? "transparent" : shift(item.bgColor),
        }));
    }

    function lookupColor(color, mappings, exact) {
        if (!mappings) return null;
        if (mappings[color]) return mappings[color];
        if (exact) return null;
        const lower = String(color).toLowerCase();
        for (const key of Object.keys(mappings)) {
            if (key.toLowerCase() === lower) return mappings[key];
        }
        if (lower.startsWith("#") && mappings[lower.slice(1)]) return mappings[lower.slice(1)];
        if (!lower.startsWith("#") && mappings[`#${lower}`]) return mappings[`#${lower}`];
        return null;
    }

    function effectRemapColors(cells, settings) {
        const mappings = settings.colorMappings || {};
        const exact = settings.matchExact !== false;
        return cells.map((item) => {
            const fg = lookupColor(item.color, mappings, exact);
            const bg = item.bgColor === "transparent" ? null : lookupColor(item.bgColor, mappings, exact);
            return {
                ...item,
                color: normalizeColor(fg || item.color, item.color),
                bgColor: bg ? normalizeColor(bg, item.bgColor) : item.bgColor,
            };
        });
    }

    function effectRemapChars(cells, settings) {
        const mappings = settings.characterMappings || {};
        return cells.map((item) => {
            const next = mappings[item.char];
            return next ? { ...item, char: String(next) } : { ...item };
        });
    }

    function seededRng(seed) {
        let state = Math.abs(Number(seed) || 1) % 233280;
        if (state === 0) state = 1;
        const next = () => {
            state = (state * 9301 + 49297) % 233280;
            return state / 233280;
        };
        return {
            next,
            nextInt(min, max) {
                return min + Math.floor(next() * (max - min + 1));
            },
            nextFloat(min, max) {
                return min + next() * (max - min);
            },
        };
    }

    function scatterDelta(x, y, maxDistance, scatterType, rng) {
        if (scatterType === "bayer-2x2") {
            const bayer = [[0, 2], [3, 1]];
            const distance = Math.round((bayer[Math.abs(y) % 2][Math.abs(x) % 2] / 4) * maxDistance);
            const direction = ((x + y) % 4) * (Math.PI / 2);
            return { dx: Math.round(Math.cos(direction) * distance), dy: Math.round(Math.sin(direction) * distance) };
        }
        if (scatterType === "bayer-4x4") {
            const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
            const distance = Math.round((bayer[Math.abs(y) % 4][Math.abs(x) % 4] / 16) * maxDistance);
            const direction = ((x + y) % 8) * (Math.PI / 4);
            return { dx: Math.round(Math.cos(direction) * distance), dy: Math.round(Math.sin(direction) * distance) };
        }
        if (scatterType === "gaussian") {
            const u1 = Math.max(0.0001, rng.next());
            const u2 = rng.next();
            const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
            const distance = Math.min(maxDistance, Math.abs(gaussian) * (maxDistance / 3));
            const angle = rng.nextFloat(0, Math.PI * 2);
            return { dx: Math.round(Math.cos(angle) * distance), dy: Math.round(Math.sin(angle) * distance) };
        }
        const angle = rng.nextFloat(0, Math.PI * 2);
        const distance = rng.nextFloat(0, maxDistance);
        return { dx: Math.round(Math.cos(angle) * distance), dy: Math.round(Math.sin(angle) * distance) };
    }

    function effectScatter(cells, settings) {
        const strength = settings.strength == null ? 0 : Number(settings.strength);
        const maxDisplacement = Math.round((strength / 100) * 10);
        if (!maxDisplacement) return copyCells(cells);
        const rng = seededRng(settings.seed == null ? 1 : settings.seed);
        const byPos = new Map();
        for (const item of cells) byPos.set(`${item.x},${item.y}`, { ...item });
        const swapped = new Set();
        const pairs = [];
        for (const item of cells) {
            const pos = `${item.x},${item.y}`;
            if (swapped.has(pos)) continue;
            if (item.char === " " && item.color === "transparent" && item.bgColor === "transparent") continue;
            const delta = scatterDelta(item.x, item.y, maxDisplacement, settings.scatterType || "noise", rng);
            const target = `${item.x + delta.dx},${item.y + delta.dy}`;
            if (target === pos || swapped.has(target)) continue;
            const distance = Math.sqrt(delta.dx ** 2 + delta.dy ** 2);
            pairs.push([pos, target, distance]);
            swapped.add(pos);
            swapped.add(target);
        }
        const out = new Map(byPos);
        for (const [pos, target, distance] of pairs) {
            const a = byPos.get(pos);
            const b = byPos.get(target);
            if (!a) continue;
            if (settings.blendColors) {
                const weight = 1 - (distance / maxDisplacement);
                const blend = (c1, c2) => {
                    if (c1 === "transparent") return c2 || "transparent";
                    if (!c2 || c2 === "transparent") return c1;
                    return mixHex(c1, c2, Math.max(0, Math.min(1, 1 - weight)));
                };
                out.set(target, { ...a, x: Number(target.split(",")[0]), y: Number(target.split(",")[1]), color: blend(a.color, b && b.color), bgColor: blend(a.bgColor, b && b.bgColor) });
                if (b) {
                    out.set(pos, { ...b, x: a.x, y: a.y, color: blend(b.color, a.color), bgColor: blend(b.bgColor, a.bgColor) });
                } else {
                    out.delete(pos);
                }
            } else {
                const [tx, ty] = target.split(",").map(Number);
                out.set(target, { ...a, x: tx, y: ty });
                if (b) out.set(pos, { ...b, x: a.x, y: a.y });
                else out.delete(pos);
            }
        }
        return [...out.values()];
    }

    // Time effects use the editor's settings and math (timeEffectsProcessing.ts):
    // time is the elapsed playback in ms, and cells pushed off the canvas drop.
    function elapsedOf(ctx) {
        if (!ctx) return 0;
        if (ctx.elapsed != null) return Number(ctx.elapsed) || 0;
        const fps = Number(ctx.frameRate) || 12;
        return ((Number(ctx.frame) || 0) / fps) * 1000;
    }

    function placeShifted(cells, ctx, shift) {
        const w = ctx && ctx.width;
        const h = ctx && ctx.height;
        const out = new Map();
        for (const item of cells) {
            const next = shift(item);
            if (w && h && (next.x < 0 || next.y < 0 || next.x >= w || next.y >= h)) continue;
            out.set(`${next.x},${next.y}`, next);
        }
        return [...out.values()];
    }

    function effectWave(cells, settings, ctx) {
        const amplitude = Number(settings.amplitude) || 0;
        const frequency = Number(settings.frequency) || 0;
        const speed = Number(settings.speed) || 0;
        const phase = (elapsedOf(ctx) * speed / 1000) + ((Number(settings.phase) || 0) * Math.PI / 180);
        const vertical = settings.axis === "vertical";
        return placeShifted(cells, ctx, (item) => {
            const along = vertical ? item.y : item.x;
            const shift = Math.round(amplitude * Math.sin((along * frequency * Math.PI / 10) + phase));
            return vertical ? { ...item, x: item.x + shift } : { ...item, y: item.y + shift };
        });
    }

    // 2D simplex noise, ported from simplex-noise 4.0.3 (MIT, Jonas Wagner) so the
    // wiggle "noise" mode lands on the same offsets as the editor.
    const SQRT3 = Math.sqrt(3);
    const F2 = 0.5 * (SQRT3 - 1);
    const G2 = (3 - SQRT3) / 6;
    const GRAD2 = [1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 1, 0, -1, 0, 0, 1, 0, -1, 0, 1, 0, -1];
    const noiseCache = new Map();

    function createNoise2D(random) {
        const perm = new Uint8Array(512);
        for (let i = 0; i < 256; i += 1) perm[i] = i;
        for (let i = 0; i < 255; i += 1) {
            const r = i + ~~(random() * (256 - i));
            const aux = perm[i];
            perm[i] = perm[r];
            perm[r] = aux;
        }
        for (let i = 256; i < 512; i += 1) perm[i] = perm[i - 256];
        const gx = Array.from(perm, (v) => GRAD2[(v % 12) * 2]);
        const gy = Array.from(perm, (v) => GRAD2[(v % 12) * 2 + 1]);
        const corner = (t, gi, x, y) => {
            if (t < 0) return 0;
            const tt = t * t;
            return tt * tt * (gx[gi] * x + gy[gi] * y);
        };
        return function noise2D(x, y) {
            const s = (x + y) * F2;
            const i = Math.floor(x + s) | 0;
            const j = Math.floor(y + s) | 0;
            const t = (i + j) * G2;
            const x0 = x - (i - t);
            const y0 = y - (j - t);
            const i1 = x0 > y0 ? 1 : 0;
            const j1 = x0 > y0 ? 0 : 1;
            const x1 = x0 - i1 + G2;
            const y1 = y0 - j1 + G2;
            const x2 = x0 - 1 + 2 * G2;
            const y2 = y0 - 1 + 2 * G2;
            const ii = i & 255;
            const jj = j & 255;
            return 70 * (
                corner(0.5 - x0 * x0 - y0 * y0, ii + perm[jj], x0, y0) +
                corner(0.5 - x1 * x1 - y1 * y1, ii + i1 + perm[jj + j1], x1, y1) +
                corner(0.5 - x2 * x2 - y2 * y2, ii + 1 + perm[jj + 1], x2, y2)
            );
        };
    }

    function noiseFor(seed) {
        const key = Number(seed) || 0;
        if (!noiseCache.has(key)) noiseCache.set(key, createNoise2D(() => key / 9999));
        return noiseCache.get(key);
    }

    function effectWiggle(cells, settings, ctx) {
        const time = elapsedOf(ctx);
        let dx = 0;
        let dy = 0;
        if (settings.mode === "horizontal-wave" || settings.mode === "vertical-wave") {
            const offset = Math.round((Number(settings.waveAmplitude) || 0) *
                Math.sin(time * (Number(settings.waveFrequency) || 0) / 1000));
            if (settings.mode === "horizontal-wave") dx = offset;
            else dy = offset;
        } else if (settings.mode === "noise") {
            const noise = noiseFor(settings.noiseSeed);
            const scale = time / 1000;
            const octaves = Math.max(0, Number(settings.noiseOctaves) || 0);
            for (let octave = 0; octave < octaves; octave += 1) {
                const k = Math.pow(2, octave);
                dx += ((Number(settings.noiseHAmplitude) || 0) / k) *
                    noise(scale * (Number(settings.noiseHFrequency) || 0) * k, 0);
                dy += ((Number(settings.noiseVAmplitude) || 0) / k) *
                    noise(0, scale * (Number(settings.noiseVFrequency) || 0) * k);
            }
            dx = Math.round(dx);
            dy = Math.round(dy);
        }
        return placeShifted(cells, ctx, (item) => ({ ...item, x: item.x + dx, y: item.y + dy }));
    }

    const TRAIL_COLORS = Object.freeze([
        "#aaaaaa", "#999999", "#888888", "#777777", "#666666",
        "#555555", "#444444", "#333333", "#282828", "#222222",
    ]);

    // Screen-space: trails read earlier frames through ctx.composite(frame) on a
    // flattened session, or the clip's own frames for a flat export.
    function effectTrails(cells, settings, ctx) {
        const count = Math.round(Math.max(1, Math.min(10, settings.trailCount == null ? 3 : Number(settings.trailCount))));
        const delay = Math.round(Math.max(1, Math.min(30, settings.frameDelay == null ? 2 : Number(settings.frameDelay))));
        let lookup = ctx && ctx.composite;
        if (!lookup && ctx && ctx.clip) {
            lookup = (index) => (ctx.clip.frames[index] ? ctx.clip.frames[index].cells : []);
        }
        const current = ctx && (ctx.frame != null ? ctx.frame : ctx.index);
        if (!lookup || current == null) return copyCells(cells);
        const layered = new Map();
        for (let i = count; i >= 1; i -= 1) {
            const at = current - i * delay;
            if (at < 0) continue;
            const color = normalizeColor(settings[`trailColor${i}`], TRAIL_COLORS[i - 1]);
            for (const item of lookup(at) || []) {
                if (item.char && item.char !== " ") layered.set(`${item.x},${item.y}`, { ...item, color });
            }
        }
        for (const item of cells) layered.set(`${item.x},${item.y}`, { ...item });
        return [...layered.values()];
    }

    const EFFECTS = {
        levels: effectLevels,
        "hue-saturation": effectHue,
        "remap-colors": effectRemapColors,
        "remap-characters": effectRemapChars,
        scatter: effectScatter,
        "wave-warp": effectWave,
        wiggle: effectWiggle,
        "motion-trails": effectTrails,
    };

    // The editor's defaultSettings per effect (src/registry/effects/*.ts).
    const EFFECT_DEFAULTS = Object.freeze({
        levels: { shadowsInput: 0, midtonesInput: 50, highlightsInput: 255, outputMin: 0, outputMax: 255 },
        "hue-saturation": { hue: 0, saturation: 0, lightness: 0 },
        "remap-colors": { colorMappings: {}, matchExact: true },
        "remap-characters": { characterMappings: {} },
        scatter: { strength: 50, scatterType: "noise", seed: 0, blendColors: false },
        "wave-warp": { axis: "horizontal", frequency: 1, amplitude: 5, speed: 5, phase: 0 },
        wiggle: {
            mode: "horizontal-wave", waveFrequency: 1, waveAmplitude: 3, noiseOctaves: 3,
            noiseHFrequency: 1, noiseHAmplitude: 10, noiseVFrequency: 1, noiseVAmplitude: 10, noiseSeed: 0,
        },
        "motion-trails": { trailCount: 3, frameDelay: 2 },
    });
    const SCREEN_SPACE = new Set(["motion-trails"]);

    function applyEffect(type, cells, settings, ctx) {
        const fn = EFFECTS[type];
        if (!fn) throw new Error(`unknown ASCII Motion effect: ${type}`);
        return fn(cells || [], { ...EFFECT_DEFAULTS[type], ...(settings || {}) }, ctx || {});
    }

    function applyEffects(cells, effects, ctx) {
        let current = cells || [];
        for (const effect of effects || []) {
            if (!effect || !EFFECTS[effect.type]) continue;
            current = EFFECTS[effect.type](current, { ...EFFECT_DEFAULTS[effect.type], ...effect }, ctx || {});
        }
        return current;
    }

    // ── Session v2: layer timelines ──────────────────────────────────────
    // Mirrors the editor's compositor (layerCompositing.ts + easing.ts): content
    // frames per layer, keyframed transforms with cubic-bezier easing, layer
    // groups, solo/visibility, and effect tracks at layer, group, and global
    // scope. Each timeline frame is composited, then identical neighbours merge.

    const CELL_ASPECT_RATIO = 0.6;
    const EASING_PRESETS = Object.freeze({
        linear: [0, 0, 1, 1],
        hold: [0, 0, 0, 0],
        "ease-in": [0.42, 0, 1, 1],
        "ease-out": [0, 0, 0.58, 1],
        "ease-in-out": [0.42, 0, 0.58, 1],
        "ease-out-back": [0.34, 1.56, 0.64, 1],
        "ease-in-back": [0.36, 0, 0.66, -0.56],
        bounce: [0.34, 1.4, 0.64, 1],
    });
    const TRANSFORM_DEFAULTS = Object.freeze({
        "transform.position.x": 0,
        "transform.position.y": 0,
        "transform.scale.x": 1,
        "transform.scale.y": 1,
        "transform.rotation": 0,
        "transform.anchorPoint.x": 0,
        "transform.anchorPoint.y": 0,
    });

    function bezier(t, p1, p2) {
        const mt = 1 - t;
        return 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t;
    }

    function solveBezierX(x, x1, x2) {
        let t = x;
        for (let i = 0; i < 8; i += 1) {
            const err = bezier(t, x1, x2) - x;
            if (Math.abs(err) < 1e-7) return t;
            const mt = 1 - t;
            const slope = 3 * mt * mt * x1 + 6 * mt * t * (x2 - x1) + 3 * t * t * (1 - x2);
            if (Math.abs(slope) < 1e-12) break;
            t -= err / slope;
        }
        let lo = 0;
        let hi = 1;
        t = x;
        for (let i = 0; i < 10; i += 1) {
            const err = bezier(t, x1, x2) - x;
            if (Math.abs(err) < 1e-7) return t;
            if (err > 0) hi = t;
            else lo = t;
            t = (lo + hi) / 2;
        }
        return t;
    }

    function evaluateEasing(progress, easing) {
        if (progress <= 0) return 0;
        if (progress >= 1) return 1;
        const curve = easing || { type: "linear" };
        if (curve.type === "hold") return 0;
        if (curve.type === "linear" || (!EASING_PRESETS[curve.type] && curve.type !== "custom")) return progress;
        const pts = curve.type === "custom"
            ? [curve.x1 == null ? 0 : curve.x1, curve.y1 == null ? 0 : curve.y1, curve.x2 == null ? 1 : curve.x2, curve.y2 == null ? 1 : curve.y2]
            : EASING_PRESETS[curve.type];
        return bezier(solveBezierX(progress, pts[0], pts[2]), pts[1], pts[3]);
    }

    function interpolateKeyframes(keyframes, frame, loop) {
        const sorted = (keyframes || []).slice().sort((a, b) => a.frame - b.frame);
        if (!sorted.length) return undefined;
        if (sorted.length === 1) return sorted[0].value;
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        let f = frame;
        const span = last.frame - first.frame;
        if (loop && span > 0) f = first.frame + (((frame - first.frame) % span) + span) % span;
        if (f <= first.frame) return first.value;
        if (f >= last.frame) return last.value;
        for (let i = 0; i < sorted.length - 1; i += 1) {
            const a = sorted[i];
            const b = sorted[i + 1];
            if (f < a.frame || f > b.frame) continue;
            if (typeof a.value !== "number" || typeof b.value !== "number") {
                return f >= b.frame ? b.value : a.value;
            }
            if (a.frame === b.frame) return a.value;
            return a.value + (b.value - a.value) * evaluateEasing((f - a.frame) / (b.frame - a.frame), a.easing);
        }
        return last.value;
    }

    function propertyAt(owner, path, frame) {
        const track = (owner.propertyTracks || []).find((t) => t && t.propertyPath === path);
        if (track && track.keyframes && track.keyframes.length) {
            const value = Number(interpolateKeyframes(track.keyframes, frame, track.loopKeyframes));
            if (Number.isFinite(value)) return value;
        }
        const fixed = owner.staticProperties && owner.staticProperties[path];
        if (fixed != null && Number.isFinite(Number(fixed))) return Number(fixed);
        return TRANSFORM_DEFAULTS[path] || 0;
    }

    function transformAt(owner, frame) {
        return {
            x: propertyAt(owner, "transform.position.x", frame),
            y: propertyAt(owner, "transform.position.y", frame),
            sx: propertyAt(owner, "transform.scale.x", frame),
            sy: propertyAt(owner, "transform.scale.y", frame),
            rot: propertyAt(owner, "transform.rotation", frame),
            ax: propertyAt(owner, "transform.anchorPoint.x", frame),
            ay: propertyAt(owner, "transform.anchorPoint.y", frame),
        };
    }

    function rotate(x, y, degrees) {
        if (!degrees) return { x, y };
        const rad = (degrees * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const sx = x * CELL_ASPECT_RATIO;
        return {
            x: Math.round((sx * cos - y * sin) / CELL_ASPECT_RATIO),
            y: Math.round(sx * sin + y * cos),
        };
    }

    function visibleCell(item) {
        return Boolean(item && ((item.char && item.char !== " ") || (item.bgColor && item.bgColor !== "transparent")));
    }

    // Place a layer's local cells on the canvas: identity is a straight copy;
    // anything else inverse-maps each destination cell (no gaps on scale/rotate).
    function placeCells(source, t, width, height) {
        const out = new Map();
        const identity = !t.x && !t.y && t.sx === 1 && t.sy === 1 && !t.rot;
        if (identity) {
            for (const [key, item] of source) {
                if (!visibleCell(item)) continue;
                if (item.x < 0 || item.y < 0 || item.x >= width || item.y >= height) continue;
                out.set(key, item);
            }
            return out;
        }
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (const item of source.values()) {
            minX = Math.min(minX, item.x);
            maxX = Math.max(maxX, item.x);
            minY = Math.min(minY, item.y);
            maxY = Math.max(maxY, item.y);
        }
        if (minX === Infinity) return out;
        const forward = (x, y) => {
            const r = rotate((x - t.ax) * t.sx, (y - t.ay) * t.sy, t.rot);
            return { x: Math.round(r.x + t.ax + t.x), y: Math.round(r.y + t.ay + t.y) };
        };
        const corners = [forward(minX, minY), forward(maxX + 1, minY), forward(minX, maxY + 1), forward(maxX + 1, maxY + 1)];
        const x0 = Math.max(0, Math.min(...corners.map((c) => c.x)) - 1);
        const x1 = Math.min(width - 1, Math.max(...corners.map((c) => c.x)) + 1);
        const y0 = Math.max(0, Math.min(...corners.map((c) => c.y)) - 1);
        const y1 = Math.min(height - 1, Math.max(...corners.map((c) => c.y)) + 1);
        for (let sy = y0; sy <= y1; sy += 1) {
            for (let sx = x0; sx <= x1; sx += 1) {
                const r = rotate(sx - t.x - t.ax, sy - t.y - t.ay, -t.rot);
                const lx = t.sx !== 0 ? Math.round(r.x / t.sx + t.ax) : t.ax;
                const ly = t.sy !== 0 ? Math.round(r.y / t.sy + t.ay) : t.ay;
                const item = source.get(`${lx},${ly}`);
                if (visibleCell(item)) out.set(`${sx},${sy}`, { ...item, x: sx, y: sy });
            }
        }
        return out;
    }

    function cellMapOf(data) {
        const out = new Map();
        for (const key of Object.keys(data || {})) {
            const parts = key.split(",");
            const x = Number(parts[0]);
            const y = Number(parts[1]);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            const item = data[key] || {};
            out.set(`${x},${y}`, cell(x, y, item.char, item.color, item.bgColor));
        }
        return out;
    }

    function blockSettings(block, frame) {
        const settings = { ...EFFECT_DEFAULTS[block.effectType], ...(block.settings || {}) };
        for (const track of block.propertyTracks || []) {
            if (!track || !track.propertyPath || !track.keyframes || !track.keyframes.length) continue;
            settings[track.propertyPath] = interpolateKeyframes(track.keyframes, frame, track.loopKeyframes);
        }
        return settings;
    }

    function activeBlocks(tracks, frame, screen) {
        const out = [];
        for (const track of tracks || []) {
            const block = track && (track.effectBlock || track);
            if (!block || !EFFECTS[block.effectType] || block.enabled === false) continue;
            if (SCREEN_SPACE.has(block.effectType) !== screen) continue;
            const start = Number(block.startFrame) || 0;
            const span = block.durationFrames == null ? Infinity : Number(block.durationFrames);
            if (frame < start || frame >= start + span) continue;
            out.push(block);
        }
        return out;
    }

    function runBlocks(cellsMap, blocks, ctx) {
        if (!blocks.length) return cellsMap;
        let list = [...cellsMap.values()];
        for (const block of blocks) {
            list = EFFECTS[block.effectType](list, blockSettings(block, ctx.frame), ctx);
        }
        const out = new Map();
        for (const item of list) out.set(`${item.x},${item.y}`, item);
        return out;
    }

    function contentFrameAt(layer, frame) {
        for (const cf of layer.contentFrames || []) {
            const start = Number(cf.startFrame) || 0;
            const span = cf.durationFrames == null ? 1 : Number(cf.durationFrames);
            if (frame >= start && frame < start + span) return cf.hidden ? null : cf;
        }
        return null;
    }

    function sessionModel(input) {
        const canvas = input.canvas || {};
        const timeline = input.timeline || {};
        const frameRate = Number(timeline.frameRate) || 12;
        const layers = (input.layers || []).filter(Boolean).map((layer) => ({
            ...layer,
            contentFrames: (layer.contentFrames || []).filter(Boolean).map((cf) => ({ ...cf, cells: cellMapOf(cf.data) })),
        }));
        let span = Number(timeline.durationFrames) || 0;
        if (!span) {
            for (const layer of layers) {
                for (const cf of layer.contentFrames) {
                    span = Math.max(span, (Number(cf.startFrame) || 0) + (cf.durationFrames == null ? 1 : Number(cf.durationFrames)));
                }
            }
        }
        const groups = new Map();
        for (const group of input.layerGroups || []) if (group && group.id) groups.set(group.id, group);
        const warnings = [];
        for (const layer of layers) {
            if (layer.kind === "generator") {
                warnings.push(`generator layer "${layer.name || layer.id}" is not rendered; bake it or export JSON`);
            }
        }
        if (Array.isArray(input.postEffectTracks) && input.postEffectTracks.length) {
            warnings.push("post effects (WebGL shaders) are not rendered in a terminal");
        }
        return {
            title: input.name || (input.metadata && input.metadata.title) || "",
            width: Number(canvas.width) || 1,
            height: Number(canvas.height) || 1,
            backgroundColor: normalizeColor(canvas.canvasBackgroundColor || canvas.backgroundColor, "#000000"),
            frameRate,
            looping: timeline.looping != null ? Boolean(timeline.looping) : Boolean(input.looping),
            span: Math.max(1, span),
            layers,
            groups,
            globalEffects: input.globalEffects || [],
            warnings,
        };
    }

    function compositeSession(model, frame, opts) {
        const options = opts || {};
        const cache = options.cache || new Map();
        const memoKey = `${options.scope || "all"}@${frame}`;
        if (cache.has(memoKey)) return cache.get(memoKey);
        const layers = options.layers || model.layers;
        const ctxBase = {
            frame,
            frameRate: model.frameRate,
            width: model.width,
            height: model.height,
            backgroundColor: model.backgroundColor,
        };
        const groupOf = (layer) => (layer.parentGroupId ? model.groups.get(layer.parentGroupId) : null);
        const shown = (layer) => {
            const group = groupOf(layer);
            return layer.visible !== false && !(group && group.visible === false);
        };
        const soloed = (layer) => Boolean(layer.solo || (groupOf(layer) && groupOf(layer).solo));
        const anySolo = layers.some((layer) => shown(layer) && soloed(layer));
        const result = new Map();
        const groupBuckets = new Map();
        for (const layer of layers) {
            if (!shown(layer) || (anySolo && !soloed(layer))) continue;
            const cf = layer.kind === "generator" ? null : contentFrameAt(layer, frame);
            if (!cf) continue;
            const group = groupOf(layer);
            let cellsMap = runBlocks(cf.cells, activeBlocks(layer.effectTracks, frame, false), ctxBase);
            if (group) cellsMap = runBlocks(cellsMap, activeBlocks(group.effectTracks, frame, false), ctxBase);
            const t = transformAt(layer, frame);
            if (group) {
                const g = transformAt(group, frame);
                t.x += g.x;
                t.y += g.y;
                t.sx *= g.sx;
                t.sy *= g.sy;
                t.rot += g.rot;
            }
            let placed = placeCells(cellsMap, t, model.width, model.height);
            const screen = options.noScreen ? [] : activeBlocks(layer.effectTracks, frame, true);
            if (screen.length) {
                const scope = `layer:${layer.id}`;
                placed = runBlocks(placed, screen, {
                    ...ctxBase,
                    composite: (at) => [...compositeSession(model, at, { cache, scope, layers: [layer], noScreen: true, noGlobal: true }).values()],
                });
            }
            let target = result;
            if (group && !options.noScreen && activeBlocks(group.effectTracks, frame, true).length) {
                if (!groupBuckets.has(group.id)) groupBuckets.set(group.id, new Map());
                target = groupBuckets.get(group.id);
            }
            for (const [key, item] of placed) target.set(key, item);
        }
        for (const [id, bucket] of groupBuckets) {
            const group = model.groups.get(id);
            const scope = `group:${id}`;
            const members = model.layers.filter((layer) => layer.parentGroupId === id);
            const done = runBlocks(bucket, activeBlocks(group.effectTracks, frame, true), {
                ...ctxBase,
                composite: (at) => [...compositeSession(model, at, { cache, scope, layers: members, noScreen: true, noGlobal: true }).values()],
            });
            for (const [key, item] of done) result.set(key, item);
        }
        let out = result;
        if (!options.noGlobal) {
            out = runBlocks(out, activeBlocks(model.globalEffects, frame, false), ctxBase);
            const screen = options.noScreen ? [] : activeBlocks(model.globalEffects, frame, true);
            if (screen.length) {
                out = runBlocks(out, screen, {
                    ...ctxBase,
                    composite: (at) => [...compositeSession(model, at, { cache, scope: "global", noScreen: true }).values()],
                });
            }
        }
        cache.set(memoKey, out);
        return out;
    }

    function frameKey(cells) {
        return cells.map((item) => `${item.x},${item.y},${item.char},${item.color},${item.bgColor}`).sort().join("|");
    }

    // Flatten a session v2 timeline into a playable clip. Options: maxFrames
    // (default 2400) caps the timeline walk; merge:false keeps one clip frame per
    // timeline frame.
    function flattenSession(input, opts) {
        const options = opts || {};
        const model = sessionModel(input);
        const limit = Math.max(1, Number(options.maxFrames) || 2400);
        const steps = Math.min(model.span, limit);
        if (model.span > limit) model.warnings.push(`timeline truncated to ${limit} of ${model.span} frames`);
        const step = 1000 / model.frameRate;
        const cache = new Map();
        const frames = [];
        let lastKey = null;
        for (let f = 0; f < steps; f += 1) {
            const cells = [...compositeSession(model, f, { cache }).values()];
            const key = options.merge === false ? null : frameKey(cells);
            if (key !== null && key === lastKey) {
                frames[frames.length - 1].duration += step;
                continue;
            }
            frames.push({ duration: step, cells, spanW: model.width, spanH: model.height });
            lastKey = key;
        }
        const clip = finish({
            source: "session-v2",
            title: model.title,
            width: model.width,
            height: model.height,
            backgroundColor: model.backgroundColor,
            frameRate: model.frameRate,
            looping: model.looping,
            currentFrame: 0,
            frames,
            effects: [],
        });
        clip.warnings = model.warnings;
        return clip;
    }

    function renderText(cells, width, height) {
        const rows = [];
        for (let y = 0; y < height; y += 1) rows.push(new Array(width).fill(" "));
        for (const item of cells) {
            if (item.y < 0 || item.x < 0 || item.y >= height || item.x >= width) continue;
            const chars = Array.from(item.char || " ");
            rows[item.y][item.x] = chars[0] || " ";
        }
        const lines = rows.map((row) => row.join("").replace(/\s+$/, ""));
        while (lines.length && lines[lines.length - 1] === "") lines.pop();
        return lines.join("\n");
    }

    function ansiColor(hex, ground) {
        const rgb = hexToRgb(hex);
        if (!rgb) return "";
        return `\u001b[${ground};2;${rgb.r};${rgb.g};${rgb.b}m`;
    }

    function renderAnsi(cells, width, height) {
        const rows = [];
        for (let y = 0; y < height; y += 1) {
            rows.push(new Array(width).fill(null));
        }
        for (const item of cells) {
            if (item.y < 0 || item.x < 0 || item.y >= height || item.x >= width) continue;
            rows[item.y][item.x] = item;
        }
        const lines = [];
        for (const row of rows) {
            let line = "";
            let open = false;
            for (const item of row) {
                if (!item || (item.char === " " && item.bgColor === "transparent")) {
                    if (open) {
                        line += "\u001b[0m";
                        open = false;
                    }
                    line += item ? item.char : " ";
                    continue;
                }
                line += ansiColor(item.color, 38);
                if (item.bgColor !== "transparent") line += ansiColor(item.bgColor, 48);
                line += Array.from(item.char || " ")[0] || " ";
                open = true;
            }
            if (open) line += "\u001b[0m";
            lines.push(line.replace(/\s+$/, ""));
        }
        while (lines.length && lines[lines.length - 1] === "") lines.pop();
        return lines.join("\n");
    }

    function renderFrame(clip, index, opts) {
        const options = opts || {};
        const frames = clip.frames || [];
        const i = Math.max(0, Math.min(frames.length - 1, index || 0));
        const frame = frames[i] || { duration: 100, cells: [] };
        const effects = options.effects || clip.effects || [];
        const cells = applyEffects(frame.cells, effects, {
            clip,
            index: i,
            elapsed: options.elapsed || 0,
            frameRate: clip.frameRate,
            width: clip.width,
            height: clip.height,
            backgroundColor: clip.backgroundColor,
        });
        const text = renderText(cells, clip.width, clip.height);
        return {
            index: i,
            duration: durationOf(frame.duration, clip.frameRate),
            cells,
            text,
            ansi: renderAnsi(cells, clip.width, clip.height),
            lines: text.split("\n").map((line) => ({ kind: options.kind || "art", text: line })),
        };
    }

    class Player {
        constructor(options) {
            const opts = options || {};
            this.clip = parse(opts.clip);
            this.speed = opts.speed > 0 ? opts.speed : 1;
            this.looping = opts.looping != null ? Boolean(opts.looping) : this.clip.looping;
            this.effects = opts.effects || this.clip.effects;
            this.elapsed = Math.max(0, Number(opts.elapsed) || 0);
        }

        duration() {
            return totalDuration(this.clip);
        }

        advance(dt) {
            this.elapsed += Math.max(0, Number(dt) || 0) * this.speed;
            return this.frame();
        }

        seek(ms) {
            this.elapsed = Math.max(0, Number(ms) || 0);
            return this.frame();
        }

        frame() {
            const total = this.duration();
            const done = !this.looping && this.elapsed >= total && total > 0;
            const index = frameIndex(this.clip, this.elapsed, this.looping);
            const rendered = renderFrame(this.clip, index, { elapsed: this.elapsed, effects: this.effects });
            const hold = rendered.duration / this.speed;
            return { ...rendered, elapsed: this.elapsed, hold, done, looping: this.looping };
        }
    }

    // A named set of clips for an app: sources stay as authored (any format
    // parse() takes) and are parsed once on first use. Aliases point a motion
    // name at another clip, e.g. "climb" -> "warp".
    class Library {
        constructor(sources, options) {
            const opts = options || {};
            this._sources = new Map();
            this._aliases = new Map();
            this._parsed = new Map();
            for (const [name, source] of Object.entries(sources || {})) this.add(name, source);
            for (const [name, target] of Object.entries(opts.aliases || {})) this.alias(name, target);
        }

        add(name, source) {
            if (!name || source == null) return this;
            this._sources.set(String(name), source);
            this._aliases.delete(String(name));
            this._parsed.delete(String(name));
            return this;
        }

        alias(name, target) {
            if (!name || !target || String(name) === String(target)) return this;
            this._aliases.set(String(name), String(target));
            return this;
        }

        resolve(name) {
            let key = String(name || "");
            const seen = new Set();
            while (this._aliases.has(key) && !seen.has(key)) {
                seen.add(key);
                key = this._aliases.get(key);
            }
            return this._sources.has(key) ? key : null;
        }

        has(name) {
            return this.resolve(name) !== null;
        }

        names() {
            return [...this._sources.keys()].sort();
        }

        aliases() {
            return Object.fromEntries([...this._aliases.entries()].sort());
        }

        source(name) {
            const key = this.resolve(name);
            return key === null ? null : this._sources.get(key);
        }

        get(name) {
            const key = this.resolve(name);
            if (key === null) return null;
            if (!this._parsed.has(key)) this._parsed.set(key, parse(this._sources.get(key)));
            return this._parsed.get(key);
        }

        player(name, options) {
            const clip = this.get(name);
            return clip ? new Player({ ...(options || {}), clip }) : null;
        }
    }

    // Writers: a parsed clip back out as files the editor opens. Session v1 is
    // what ASCII Motion's importer migrates into a layer timeline; the text
    // export is the plain frames-split-on-"," format.
    function toSession(input, meta) {
        const clip = parse(input);
        const info = meta || {};
        return {
            version: "1.0.0",
            name: info.name || clip.title || "Untitled Project",
            description: info.description || "",
            canvas: {
                width: clip.width,
                height: clip.height,
                canvasBackgroundColor: clip.backgroundColor,
                showGrid: true,
            },
            animation: {
                frames: clip.frames.map((frame, i) => ({
                    id: `frame-${i + 1}`,
                    name: `Frame ${i + 1}`,
                    duration: Math.round(frame.duration),
                    data: Object.fromEntries(frame.cells.map((item) => [
                        `${item.x},${item.y}`,
                        { char: item.char, color: item.color, bgColor: item.bgColor },
                    ])),
                })),
                currentFrameIndex: 0,
                frameRate: clip.frameRate,
                looping: clip.looping,
            },
        };
    }

    function toText(input) {
        const clip = parse(input);
        return clip.frames.map((_frame, i) => renderFrame(clip, i, { effects: [] }).text).join("\n\n,\n\n") + "\n";
    }

    function describe(input) {
        const clip = parse(input);
        return {
            title: clip.title,
            source: clip.source,
            width: clip.width,
            height: clip.height,
            frames: clip.frames.length,
            durationMs: Math.round(totalDuration(clip)),
            frameRate: clip.frameRate,
            looping: clip.looping,
            effects: (clip.effects || []).map((effect) => effect.type),
            warnings: clip.warnings || [],
        };
    }

    return {
        FORMAT,
        EFFECT_TYPES,
        EFFECT_DEFAULTS,
        EASING_PRESETS,
        parse,
        flattenSession,
        frameIndex,
        totalDuration,
        evaluateEasing,
        interpolateKeyframes,
        applyEffect,
        applyEffects,
        renderFrame,
        describe,
        toSession,
        toText,
        Player,
        Library,
    };
});
