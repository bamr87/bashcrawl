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
    // Loads the open export formats from https://github.com/cameronfoxly/Ascii-Motion
    // (JSON export, text export, HTML frame grids, session v1 .asciimtn) and steps
    // them as cell grids. Timeline effects that ASCII Motion bakes at export time
    // can also be applied live: levels, hue-saturation, remap-colors,
    // remap-characters, scatter, plus playback effects wave-warp, wiggle, and
    // motion-trails. No DOM, no node:*. Session v2 layer timelines are not
    // flattened here — export JSON or text for playback.

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
            const raw = input.replace(/^\uFEFF/, "").trim();
            if (!raw) throw new Error("empty ASCII Motion export");
            if (raw[0] === "{" || raw[0] === "[") return parse(JSON.parse(raw));
            return parseText(raw);
        }
        if (!input || typeof input !== "object") {
            throw new Error("ASCII Motion clip must be an object or export string");
        }
        if (Array.isArray(input.layers) && !input.frames && !(input.animation && input.animation.frames)) {
            throw new Error("ASCII Motion session v2 is not flattened; export JSON or text");
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
        if (sessionFrames && sessionFrames[0] && sessionFrames[0].data && !sessionFrames[0].content) {
            frames = sessionFrames.map((frame) => frameFromMap(frame, frameRate));
        } else if (Array.isArray(input.frames) && input.frames[0] && input.frames[0].characters) {
            frames = input.frames.map((frame) => frameFromGrid(frame, frameRate));
        } else if (Array.isArray(input.frames) && input.frames[0] && Array.isArray(input.frames[0].cells)) {
            frames = input.frames.map((frame) => frameFromCells(frame, frameRate));
        } else if (Array.isArray(input.frames) && input.frames[0] && (input.frames[0].content != null || input.frames[0].contentString != null)) {
            frames = input.frames.map((frame) => frameFromContent(frame, width, height, frameRate));
        } else if (typeof input.text === "string") {
            return parseText(input.text);
        } else {
            throw new Error("unrecognized ASCII Motion export");
        }
        const size = bounds(frames, width, height);
        return finish({
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

    function effectWave(cells, settings, ctx) {
        const amplitude = Number(settings.amplitude) || 0;
        if (!amplitude) return copyCells(cells);
        const wavelength = Number(settings.wavelength) || 8;
        const speed = settings.speed == null ? 1 : Number(settings.speed);
        const phase = ((ctx && ctx.elapsed) || 0) / 1000 * speed * Math.PI * 2;
        const axis = settings.axis === "y" ? "y" : "x";
        return cells.map((item) => {
            const along = axis === "y" ? item.x : item.y;
            const shift = Math.round(Math.sin((along / wavelength) * Math.PI * 2 + phase) * amplitude);
            return axis === "y"
                ? { ...item, y: item.y + shift }
                : { ...item, x: item.x + shift };
        });
    }

    function effectWiggle(cells, settings, ctx) {
        const amount = Number(settings.amount) || 0;
        if (!amount) return copyCells(cells);
        const speed = settings.speed == null ? 4 : Number(settings.speed);
        const bucket = Math.floor((((ctx && ctx.elapsed) || 0) / 1000) * speed);
        const rng = seededRng((Number(settings.seed) || 1) + bucket * 997);
        return cells.map((item) => {
            const dx = rng.nextInt(-amount, amount);
            const dy = rng.nextInt(-amount, amount);
            return { ...item, x: item.x + dx, y: item.y + dy };
        });
    }

    function effectTrails(cells, _settings, ctx) {
        const clip = ctx && ctx.clip;
        const index = ctx && ctx.index;
        if (!clip || index == null) return copyCells(cells);
        const length = Math.max(0, Number(_settings.length) || 2);
        const decay = _settings.decay == null ? 0.45 : Number(_settings.decay);
        const bg = clip.backgroundColor === "transparent" ? "#000000" : clip.backgroundColor;
        const layered = new Map();
        for (let step = length; step >= 1; step -= 1) {
            const prev = clip.frames[index - step];
            if (!prev) continue;
            const opacity = Math.pow(decay, step);
            for (const item of prev.cells) {
                layered.set(`${item.x},${item.y}`, {
                    ...item,
                    color: mixHex(bg, item.color, opacity),
                    bgColor: item.bgColor === "transparent" ? "transparent" : mixHex(bg, item.bgColor, opacity),
                });
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

    function applyEffect(type, cells, settings, ctx) {
        const fn = EFFECTS[type];
        if (!fn) throw new Error(`unknown ASCII Motion effect: ${type}`);
        return fn(cells || [], settings || {}, ctx || {});
    }

    function applyEffects(cells, effects, ctx) {
        let current = cells || [];
        for (const effect of effects || []) {
            if (!effect || !EFFECTS[effect.type]) continue;
            current = EFFECTS[effect.type](current, effect, ctx || {});
        }
        return current;
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

    return {
        FORMAT,
        EFFECT_TYPES,
        parse,
        frameIndex,
        totalDuration,
        applyEffect,
        applyEffects,
        renderFrame,
        Player,
    };
});
