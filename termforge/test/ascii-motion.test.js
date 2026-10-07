"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    FORMAT,
    EFFECT_TYPES,
    parse,
    frameIndex,
    totalDuration,
    applyEffect,
    renderFrame,
    Player,
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

test("parses session v1 maps and refuses unflattened session v2", () => {
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
    assert.throws(
        () => parse({ version: "2.0.0", layers: [{ id: "layer-1" }] }),
        /session v2/,
    );
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

    const waved = applyEffect("wave-warp", [
        { x: 4, y: 2, char: "O", color: "#ffffff", bgColor: "transparent" },
    ], { amplitude: 2, wavelength: 8, speed: 0, axis: "x" }, { elapsed: 0 });
    assert.equal(waved[0].x, 6);
    assert.equal(waved[0].y, 2);

    assert.throws(() => applyEffect("bloom", cells, {}), /unknown ASCII Motion effect/);
    assert.ok(EFFECT_TYPES.includes("motion-trails"));
    assert.ok(EFFECT_TYPES.includes("wiggle"));
});

test("motion trails composite the previous frame under the current cells", () => {
    const clip = parse({
        canvas: { width: 3, height: 1, backgroundColor: "#000000" },
        animation: { frameRate: 10, looping: false },
        effects: [{ type: "motion-trails", length: 1, decay: 0.5 }],
        frames: [
            { duration: 50, content: ["#  "] },
            { duration: 50, content: ["  #"] },
        ],
    });
    const frame = renderFrame(clip, 1, { elapsed: 50 });
    const ghost = frame.cells.find((c) => c.x === 0);
    const head = frame.cells.find((c) => c.x === 2);
    assert.ok(ghost);
    assert.equal(head.char, "#");
    assert.notEqual(ghost.color, "#ffffff");
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
