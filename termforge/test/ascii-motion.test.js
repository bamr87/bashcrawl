"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    FORMAT,
    EFFECT_TYPES,
    parse,
    flattenSession,
    frameIndex,
    totalDuration,
    evaluateEasing,
    interpolateKeyframes,
    applyEffect,
    renderFrame,
    describe,
    toSession,
    toText,
    Player,
    Library,
} = require("../core/ascii-motion.js");

test("parses an ASCII Motion JSON export, including stringified color maps", () => {
    const clip = parse({
        metadata: { title: "Pulse", exportVersion: "1.0.0" },
        canvas: { width: 5, height: 3, backgroundColor: "#111111" },
        typography: { fontSize: 16, characterSpacing: 1, lineSpacing: 1 },
        animation: { frameRate: 8, looping: true, currentFrame: 0 },
        frames: [
            {
                title: "Frame 0",
                duration: 120,
                content: ["  +  ", " +++ ", "  +  "],
                colors: { foreground: { "2,0": "#FF0000" } },
            },
            {
                title: "Frame 1",
                duration: 80,
                content: "+++++",
                colors: { foreground: JSON.stringify({ "0,0": "#00ff00" }) },
            },
        ],
    });
    assert.equal(clip.format, FORMAT);
    assert.equal(clip.title, "Pulse");
    assert.equal(clip.width, 5);
    assert.equal(clip.height, 3);
    assert.equal(clip.looping, true);
    assert.equal(clip.frames.length, 2);
    assert.equal(clip.frames[0].duration, 120);
    assert.equal(clip.frames[0].cells.find((c) => c.x === 2 && c.y === 0).color, "#ff0000");
    assert.equal(clip.frames[1].cells.find((c) => c.x === 0 && c.y === 0).color, "#00ff00");
    assert.equal(renderFrame(clip, 0).text, "  +\n +++\n  +");
    assert.match(renderFrame(clip, 0).ansi, /\u001b\[38;2;255;0;0m\+/);
    assert.equal(renderFrame(clip, 0).lines[0].kind, "art");
});

test("parses text export frames split on the comma separator", () => {
    const clip = parse("ASCII Motion Text Export\nFrames: 2\n\n---\n\n  +\n  *\n\n,\n\n  *\n  +");
    assert.equal(clip.frames.length, 2);
    assert.equal(renderFrame(clip, 0).text, "  +\n  *");
    assert.equal(renderFrame(clip, 1).text, "  *\n  +");
    assert.equal(frameIndex(clip, 100), 1);
    assert.equal(frameIndex(clip, 250, true), 0);
});

test("parses session v1 maps", () => {
    const clip = parse({
        version: "1.0.0",
        canvas: { width: 3, height: 1, canvasBackgroundColor: "#000000" },
        animation: {
            frameRate: 10,
            looping: false,
            frames: [{ id: "a", duration: 50, data: { "1,0": { char: "#", color: "#ffffff", bgColor: "transparent" } } }],
        },
    });
    assert.equal(renderFrame(clip, 0).text, " #");
    assert.equal(totalDuration(clip), 50);
});

test("parses an HTML-export frame grid", () => {
    const clip = parse({
        canvas: { width: 2, height: 1, backgroundColor: "#000000" },
        frames: [{
            duration: 40,
            characters: [["A", "B"]],
            colors: [["#ffffff", "#00ffff"]],
            backgrounds: [["transparent", "#220000"]],
        }],
    });
    assert.equal(renderFrame(clip, 0).text, "AB");
    assert.equal(clip.frames[0].cells.find((c) => c.x === 1).bgColor, "#220000");
});

test("steps a player across frame holds and marks the clip done", () => {
    const player = new Player({
        clip: {
            canvas: { width: 1, height: 1, backgroundColor: "#000000" },
            animation: { frameRate: 10, looping: false },
            frames: [
                { duration: 40, content: ["A"] },
                { duration: 60, content: ["B"] },
            ],
        },
    });
    assert.equal(player.frame().text, "A");
    assert.equal(player.frame().done, false);
    player.advance(player.frame().hold);
    assert.equal(player.frame().text, "B");
    player.advance(player.frame().hold);
    assert.equal(player.frame().done, true);
    assert.equal(player.duration(), 100);
});

test("applies ASCII Motion cell effects", () => {
    const cells = [{ x: 0, y: 0, char: "#", color: "#ff0000", bgColor: "transparent" }];
    const shifted = applyEffect("hue-saturation", cells, { hue: 120 });
    assert.equal(shifted[0].color, "#00ff00");
    assert.equal(shifted[0].char, "#");

    const crushed = applyEffect("levels", cells, {
        shadowsInput: 0,
        midtonesInput: 50,
        highlightsInput: 255,
        outputMin: 0,
        outputMax: 0,
    });
    assert.equal(crushed[0].color, "#000000");

    const remapped = applyEffect("remap-characters", cells, { characterMappings: { "#": "*" } });
    assert.equal(remapped[0].char, "*");
    const recolored = applyEffect("remap-colors", cells, {
        colorMappings: { "#ff0000": "#0000ff" },
        matchExact: true,
    });
    assert.equal(recolored[0].color, "#0000ff");

    const still = applyEffect("scatter", cells, { strength: 0, seed: 3 });
    assert.deepEqual(still[0], cells[0]);
    const scattered = applyEffect("scatter", cells, { strength: 100, seed: 7, scatterType: "noise" });
    const again = applyEffect("scatter", cells, { strength: 100, seed: 7, scatterType: "noise" });
    assert.deepEqual(scattered, again);
    assert.ok(scattered[0].x !== 0 || scattered[0].y !== 0);

    // Editor math: horizontal axis moves y by amplitude * sin(x * frequency * PI / 10 + phase).
    const dot = [{ x: 5, y: 4, char: "O", color: "#ffffff", bgColor: "transparent" }];
    const waved = applyEffect("wave-warp", dot, { axis: "horizontal", amplitude: 2, frequency: 1, speed: 0, phase: 0 }, { elapsed: 0 });
    assert.deepEqual([waved[0].x, waved[0].y], [5, 6]);
    const sideways = applyEffect("wave-warp", dot, { axis: "vertical", amplitude: 2, frequency: 1, speed: 0, phase: 0 }, { elapsed: 0 });
    assert.deepEqual([sideways[0].x, sideways[0].y], [7, 4]);
    const offCanvas = applyEffect("wave-warp", dot, { amplitude: 9, frequency: 1, speed: 0 }, { elapsed: 0, width: 8, height: 8 });
    assert.equal(offCanvas.length, 0);

    const swayed = applyEffect("wiggle", dot, { mode: "horizontal-wave", waveAmplitude: 3, waveFrequency: 1 }, { elapsed: 1571 });
    assert.deepEqual([swayed[0].x, swayed[0].y], [8, 4]);
    const shaken = applyEffect("wiggle", dot, { mode: "noise", noiseSeed: 4 }, { elapsed: 900 });
    assert.deepEqual(applyEffect("wiggle", dot, { mode: "noise", noiseSeed: 4 }, { elapsed: 900 }), shaken);

    assert.throws(() => applyEffect("bloom", cells, {}), /unknown ASCII Motion effect/);
    assert.ok(EFFECT_TYPES.includes("motion-trails"));
    assert.ok(EFFECT_TYPES.includes("wiggle"));
});

test("motion trails composite earlier frames under the current cells in trail colors", () => {
    const clip = parse({
        canvas: { width: 3, height: 1, backgroundColor: "#000000" },
        animation: { frameRate: 10, looping: false },
        effects: [{ type: "motion-trails", trailCount: 1, frameDelay: 1, trailColor1: "#336699" }],
        frames: [
            { duration: 50, content: ["#  "] },
            { duration: 50, content: ["  #"] },
        ],
    });
    const frame = renderFrame(clip, 1, { elapsed: 50 });
    const ghost = frame.cells.find((c) => c.x === 0);
    const head = frame.cells.find((c) => c.x === 2);
    assert.equal(ghost.color, "#336699");
    assert.equal(head.char, "#");
    assert.equal(head.color, "#ffffff");
    assert.equal(renderFrame(clip, 0).cells.length, 1);
});

function v2Session(overrides) {
    return {
        version: "2.2.0",
        name: "Layered",
        canvas: { width: 6, height: 3, canvasBackgroundColor: "#101010", showGrid: true },
        timeline: { frameRate: 10, durationFrames: 4, looping: true },
        layers: [],
        ...overrides,
    };
}

function layer(id, frames, extra) {
    return {
        id,
        name: id,
        visible: true,
        solo: false,
        locked: false,
        opacity: 100,
        propertyTracks: [],
        staticProperties: { "transform.anchorPoint.x": 3, "transform.anchorPoint.y": 1 },
        effectTracks: [],
        contentFrames: frames.map((frame, i) => ({ id: `${id}-cf${i}`, name: `F${i}`, ...frame })),
        ...extra,
    };
}

const at = (char, x, y, color) => ({ [`${x},${y}`]: { char, color: color || "#ffffff", bgColor: "transparent" } });

test("flattens a session v2 layer timeline: z-order, holds, gaps, and merged frames", () => {
    const clip = parse(v2Session({
        layers: [
            layer("bg", [{ startFrame: 0, durationFrames: 4, data: { ...at("-", 0, 0), ...at("-", 1, 0) } }]),
            layer("fg", [
                { startFrame: 0, durationFrames: 2, data: at("A", 1, 0, "#ff0000") },
                { startFrame: 3, durationFrames: 1, data: at("B", 2, 0) },
            ]),
        ],
    }));
    assert.equal(clip.source, "session-v2");
    assert.equal(clip.title, "Layered");
    assert.equal(clip.width, 6);
    assert.equal(clip.backgroundColor, "#101010");
    assert.equal(clip.looping, true);
    assert.deepEqual(clip.frames.map((f) => Math.round(f.duration)), [200, 100, 100]);
    assert.equal(renderFrame(clip, 0).text, "-A");
    assert.equal(renderFrame(clip, 0).cells.find((c) => c.x === 1).color, "#ff0000");
    assert.equal(renderFrame(clip, 1).text, "--");
    assert.equal(renderFrame(clip, 2).text, "--B");
    assert.equal(flattenSession(v2Session({ layers: [layer("bg", [{ startFrame: 0, durationFrames: 4, data: at("x", 0, 0) }])] }), { merge: false }).frames.length, 4);
});

test("session v2 honours visibility, solo, hidden content frames, and groups", () => {
    const base = (extra, frame) => layer(extra.id, [{ startFrame: 0, durationFrames: 1, data: at(extra.ch, extra.x, 0), ...(frame || {}) }], extra.props);
    const text = (session) => renderFrame(parse(session), 0).text;
    const three = [base({ id: "a", ch: "a", x: 0 }), base({ id: "b", ch: "b", x: 1 }), base({ id: "c", ch: "c", x: 2 })];
    assert.equal(text(v2Session({ timeline: { frameRate: 10, durationFrames: 1 }, layers: three })), "abc");
    three[1].visible = false;
    assert.equal(text(v2Session({ timeline: { frameRate: 10, durationFrames: 1 }, layers: three })), "a c");
    three[2].solo = true;
    assert.equal(text(v2Session({ timeline: { frameRate: 10, durationFrames: 1 }, layers: three })), "  c");
    const hidden = [base({ id: "h", ch: "h", x: 0 }, { hidden: true }), base({ id: "k", ch: "k", x: 1 })];
    assert.equal(text(v2Session({ timeline: { frameRate: 10, durationFrames: 1 }, layers: hidden })), " k");
    const grouped = [base({ id: "g1", ch: "g", x: 0, props: { parentGroupId: "grp" } }), base({ id: "free", ch: "f", x: 4 })];
    const group = {
        id: "grp", name: "grp", childLayerIds: ["g1"], visible: true, solo: false, locked: false, collapsed: false,
        propertyTracks: [], staticProperties: { "transform.position.x": 2 }, effectTracks: [],
    };
    assert.equal(text(v2Session({ timeline: { frameRate: 10, durationFrames: 1 }, layers: grouped, layerGroups: [group] })), "  g f");
    assert.equal(text(v2Session({ timeline: { frameRate: 10, durationFrames: 1 }, layers: grouped, layerGroups: [{ ...group, visible: false }] })), "    f");
});

test("session v2 keyframes position with the editor's easing and transforms scale", () => {
    const track = (path, keyframes, loopKeyframes) => ({ id: path, propertyPath: path, loopKeyframes: Boolean(loopKeyframes), keyframes });
    const mover = layer("m", [{ startFrame: 0, durationFrames: 5, data: at("@", 0, 1) }], {
        propertyTracks: [track("transform.position.x", [
            { id: "k0", frame: 0, value: 0, easing: { type: "linear" } },
            { id: "k1", frame: 4, value: 4, easing: { type: "linear" } },
        ])],
    });
    const clip = flattenSession(v2Session({ timeline: { frameRate: 10, durationFrames: 5 }, layers: [mover] }), { merge: false });
    assert.deepEqual(clip.frames.map((f) => f.cells[0].x), [0, 1, 2, 3, 4]);

    const held = layer("h", [{ startFrame: 0, durationFrames: 4, data: at("@", 0, 1) }], {
        propertyTracks: [track("transform.position.x", [
            { id: "k0", frame: 0, value: 0, easing: { type: "hold" } },
            { id: "k1", frame: 3, value: 5, easing: { type: "linear" } },
        ])],
    });
    const holdClip = flattenSession(v2Session({ timeline: { frameRate: 10, durationFrames: 4 }, layers: [held] }), { merge: false });
    assert.deepEqual(holdClip.frames.map((f) => f.cells[0].x), [0, 0, 0, 5]);

    const wide = layer("w", [{ startFrame: 0, durationFrames: 1, data: { ...at("<", 2, 1), ...at(">", 3, 1) } }], {
        staticProperties: { "transform.anchorPoint.x": 3, "transform.anchorPoint.y": 1, "transform.scale.x": 2 },
    });
    assert.equal(renderFrame(parse(v2Session({ timeline: { frameRate: 10, durationFrames: 1 }, layers: [wide] })), 0).text.trim(), "<<>>");

    assert.equal(evaluateEasing(0.5, { type: "linear" }), 0.5);
    assert.ok(evaluateEasing(0.5, { type: "ease-in" }) < 0.5);
    assert.ok(evaluateEasing(0.5, { type: "ease-out" }) > 0.5);
    assert.ok(evaluateEasing(0.8, { type: "ease-out-back" }) > 1);
    assert.equal(evaluateEasing(0.5, { type: "custom", x1: 0, y1: 0, x2: 1, y2: 1 }).toFixed(4), "0.5000");
    const loop = [{ frame: 0, value: 0, easing: { type: "linear" } }, { frame: 2, value: 2, easing: { type: "linear" } }];
    assert.equal(interpolateKeyframes(loop, 3, true), 1);
    assert.equal(interpolateKeyframes(loop, 3, false), 2);
    assert.equal(interpolateKeyframes([{ frame: 0, value: "a" }, { frame: 4, value: "b" }], 2), "a");
});

test("session v2 effect tracks run in their time range with keyframed settings", () => {
    const red = (startFrame, durationFrames, extra) => ({
        id: "et", ownerId: null, collapsed: false,
        effectBlock: {
            id: "eb", effectType: "remap-colors", startFrame, durationFrames, enabled: true,
            settings: { colorMappings: { "#ffffff": "#ff0000" }, matchExact: false }, propertyTracks: [], ...extra,
        },
    });
    const one = layer("one", [{ startFrame: 0, durationFrames: 3, data: at("#", 0, 0) }], { effectTracks: [red(1, 1)] });
    const clip = flattenSession(v2Session({ timeline: { frameRate: 10, durationFrames: 3 }, layers: [one] }), { merge: false });
    assert.deepEqual(clip.frames.map((f) => f.cells[0].color), ["#ffffff", "#ff0000", "#ffffff"]);

    const off = layer("off", [{ startFrame: 0, durationFrames: 1, data: at("#", 0, 0) }], { effectTracks: [red(0, 1, { enabled: false })] });
    assert.equal(parse(v2Session({ timeline: { frameRate: 10, durationFrames: 1 }, layers: [off] })).frames[0].cells[0].color, "#ffffff");

    const hue = {
        id: "g", ownerId: null, collapsed: false,
        effectBlock: {
            id: "hb", effectType: "hue-saturation", startFrame: 0, durationFrames: 3, enabled: true,
            settings: { hue: 0, saturation: 0, lightness: 0 },
            propertyTracks: [{ id: "p", propertyPath: "hue", loopKeyframes: false, keyframes: [
                { id: "a", frame: 0, value: 0, easing: { type: "linear" } },
                { id: "b", frame: 2, value: 240, easing: { type: "linear" } },
            ] }],
        },
    };
    const tinted = layer("t", [{ startFrame: 0, durationFrames: 3, data: at("#", 0, 0, "#ff0000") }]);
    const global = flattenSession(v2Session({ timeline: { frameRate: 10, durationFrames: 3 }, layers: [tinted], globalEffects: [hue] }), { merge: false });
    assert.deepEqual(global.frames.map((f) => f.cells[0].color), ["#ff0000", "#00ff00", "#0000ff"]);
});

test("session v2 motion trails read the layer's earlier frames; unsupported layers warn", () => {
    const trail = {
        id: "tr", ownerId: "dot", collapsed: false,
        effectBlock: {
            id: "tb", effectType: "motion-trails", startFrame: 0, durationFrames: 3, enabled: true,
            settings: { trailCount: 2, frameDelay: 1, trailColor1: "#888888", trailColor2: "#444444" }, propertyTracks: [],
        },
    };
    const dot = layer("dot", [
        { startFrame: 0, durationFrames: 1, data: at("o", 0, 0) },
        { startFrame: 1, durationFrames: 1, data: at("o", 1, 0) },
        { startFrame: 2, durationFrames: 1, data: at("o", 2, 0) },
    ], { effectTracks: [trail] });
    const gen = { ...layer("rain", []), kind: "generator", generator: { generatorType: "digital-rain" } };
    const clip = parse(v2Session({ timeline: { frameRate: 10, durationFrames: 3 }, layers: [dot, gen], postEffectTracks: [{ id: "crt" }] }));
    const last = renderFrame(clip, clip.frames.length - 1);
    assert.equal(last.text, "ooo");
    assert.deepEqual(last.cells.sort((a, b) => a.x - b.x).map((c) => c.color), ["#444444", "#888888", "#ffffff"]);
    assert.equal(clip.warnings.length, 2);
    assert.match(clip.warnings[0], /generator layer "rain"/);
    assert.deepEqual(describe(clip).warnings, clip.warnings);
});

test("a Library names clips, resolves aliases, and parses each source once", () => {
    const pulse = { canvas: { width: 1, height: 1 }, frames: [{ duration: 50, content: ["*"] }] };
    const lib = new Library({ pulse }, { aliases: { beat: "pulse", echo: "beat", loop: "loop" } });
    assert.deepEqual(lib.names(), ["pulse"]);
    assert.equal(lib.resolve("echo"), "pulse");
    assert.equal(lib.has("loop"), false);
    assert.equal(lib.get("bogus"), null);
    assert.equal(lib.get("beat"), lib.get("pulse"));
    assert.equal(lib.source("echo"), pulse);
    assert.equal(lib.player("echo", { speed: 2 }).frame().text, "*");
    lib.add("beat", "~");
    assert.equal(lib.get("beat").frames.length, 1);
    assert.equal(renderFrame(lib.get("beat"), 0).text, "~");
});

test("writers round-trip a clip through session v1 and the text export", () => {
    const source = {
        canvas: { width: 3, height: 1, backgroundColor: "#000000" },
        animation: { frameRate: 8, looping: true },
        frames: [
            { duration: 120, content: ["a b"], colors: { foreground: { "0,0": "#ff0000" } } },
            { duration: 80, content: [" c"] },
        ],
    };
    const session = toSession(source, { name: "pair" });
    assert.equal(session.version, "1.0.0");
    assert.equal(session.name, "pair");
    assert.equal(session.animation.frames[0].data["0,0"].color, "#ff0000");
    const back = parse(JSON.stringify(session));
    assert.deepEqual(back.frames.map((f) => f.duration), [120, 80]);
    assert.equal(renderFrame(back, 0).text, "a b");
    assert.equal(back.looping, true);
    const text = toText(source);
    assert.equal(text, "a b\n\n,\n\n c\n");
    assert.equal(parse(text).frames.length, 2);
    assert.equal(renderFrame(parse("\n   indented\n  art\n"), 0).text, "   indented\n  art");
});

test("looping playback keeps cycling beyond multiple clip durations", () => {
    const clip = parse({ canvas: { width: 1, height: 1 }, animation: { looping: true }, frames: [
        { duration: 50, content: ["A"] }, { duration: 50, content: ["B"] },
    ] });
    const player = new Player({ clip, looping: true });
    player.advance(200);
    assert.equal(player.frame().text, "A");
    player.advance(50);
    assert.equal(player.frame().text, "B");
    assert.equal(player.frame().done, false);
});
