"use strict";
// Pixel canvas: framebuffer ops, the 3×5 font, half-block encoding, row diffing.

const test = require("node:test");
const assert = require("node:assert/strict");

const { PixelBuffer, PixelScreen, encodeRow, FONT3x5, scaleColor, mixColor } = require("../node/pixels.js");

const ESC = "\u001b";

test("PixelBuffer set/get/rect/add clamp to bounds and 0..255", () => {
    const b = new PixelBuffer(4, 4);
    b.set(1, 1, [10, 20, 30]);
    assert.deepEqual(b.get(1, 1), [10, 20, 30]);
    b.set(-1, 0, [1, 1, 1]);
    b.set(4, 0, [1, 1, 1]);
    assert.equal(b.get(-1, 0), null);
    assert.equal(b.get(4, 0), null);
    b.rect(2, 2, 10, 10, [5, 6, 7]);
    assert.deepEqual(b.get(3, 3), [5, 6, 7]);
    assert.deepEqual(b.get(1, 3), [0, 0, 0]);
    b.add(1, 1, [250, 250, 250]);
    assert.deepEqual(b.get(1, 1), [255, 255, 255]);
    b.clear([9, 9, 9]);
    assert.deepEqual(b.get(0, 0), [9, 9, 9]);
    b.clear();
    assert.equal(b.isBlack(0, 0), true);
});

test("sprite() honours transparency and palette keys; blit() skips black", () => {
    const b = new PixelBuffer(6, 4);
    b.sprite(1, 1, [".#o", "#.."], { "#": [1, 2, 3], o: [7, 8, 9] });
    assert.deepEqual(b.get(1, 1), [0, 0, 0]);
    assert.deepEqual(b.get(2, 1), [1, 2, 3]);
    assert.deepEqual(b.get(3, 1), [7, 8, 9]);
    assert.deepEqual(b.get(1, 2), [1, 2, 3]);
    const dst = new PixelBuffer(6, 4);
    dst.clear([4, 4, 4]);
    dst.blit(b, 0, 0);
    assert.deepEqual(dst.get(1, 1), [4, 4, 4], "black source pixels are transparent");
    assert.deepEqual(dst.get(2, 1), [1, 2, 3]);
});

test("the pixel font covers A-Z, 0-9, and lays out 4 px per glyph", () => {
    for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .:-!$>") {
        assert.ok(FONT3x5[ch], `glyph ${ch}`);
        assert.equal(FONT3x5[ch].length, 5);
        for (const row of FONT3x5[ch]) assert.equal(row.length, 3);
    }
    const b = new PixelBuffer(20, 6);
    const w = b.text(0, 0, "hi", [255, 255, 255], 1);
    assert.equal(w, 7, "two glyphs: 3 + 1 gap + 3");
    assert.equal(PixelBuffer.textWidth("hi", 1), 7);
    assert.equal(PixelBuffer.textWidth("hi", 2), 14);
    assert.deepEqual(b.get(0, 0), [255, 255, 255], "H top-left");
    assert.deepEqual(b.get(1, 0), [0, 0, 0], "H has a gap in the top row");
    assert.deepEqual(b.get(4, 0), [255, 255, 255], "I top row is solid");
    const big = new PixelBuffer(10, 12);
    big.text(0, 0, "I", [1, 1, 1], 2);
    assert.deepEqual(big.get(5, 1), [1, 1, 1], "scale 2 fills 2x2 blocks");
});

test("scanlines dim odd rows only", () => {
    const b = new PixelBuffer(2, 4);
    b.clear([100, 100, 100]);
    b.scanlines(0.5);
    assert.deepEqual(b.get(0, 0), [100, 100, 100]);
    assert.deepEqual(b.get(0, 1), [50, 50, 50]);
    assert.deepEqual(b.get(0, 2), [100, 100, 100]);
});

test("encodeRow: half blocks carry two pixels per cell with minimal SGR", () => {
    const b = new PixelBuffer(5, 2);
    b.set(0, 0, [255, 0, 0]);                    // top only  -> ▀ fg
    b.set(1, 1, [0, 255, 0]);                    // bottom    -> ▄ fg
    b.set(2, 0, [0, 0, 255]); b.set(2, 1, [0, 0, 255]);   // same -> █ fg
    b.set(3, 0, [1, 2, 3]); b.set(3, 1, [4, 5, 6]);       // both -> ▀ fg+bg
    const row = encodeRow(b, 0, true);
    assert.equal(row,
        `${ESC}[38;2;255;0;0m▀${ESC}[38;2;0;255;0m▄${ESC}[38;2;0;0;255m█${ESC}[38;2;1;2;3m${ESC}[48;2;4;5;6m▀${ESC}[0m `);
    const mono = encodeRow(b, 0, false);
    assert.equal(mono.length, 5, "no-color mode is one glyph per cell");
    assert.equal(mono[4], " ");
    assert.notEqual(mono[0], " ");
});

test("encodeRow: runs of equal colour share one SGR; a black row is spaces", () => {
    const b = new PixelBuffer(4, 2);
    b.rect(0, 0, 4, 2, [9, 9, 9]);
    assert.equal(encodeRow(b, 0, true), `${ESC}[38;2;9;9;9m████${ESC}[0m`);
    const empty = new PixelBuffer(4, 2);
    assert.equal(encodeRow(empty, 0, true), "    ");
});

test("PixelScreen rewrites only the cell rows that changed", () => {
    const chunks = [];
    const screen = new PixelScreen({ write: (c) => chunks.push(c), top: 2 });
    const b = new PixelBuffer(4, 6);
    b.set(0, 0, [1, 1, 1]);
    assert.equal(screen.present(b), 3, "first frame writes every row");
    assert.ok(chunks[0].includes(`${ESC}[2;1H`), "rows start at `top`");
    assert.ok(chunks[0].includes(`${ESC}[4;1H`));
    assert.equal(screen.present(b), 0, "identical frame writes nothing");
    assert.equal(chunks.length, 1);
    b.set(0, 5, [2, 2, 2]);
    assert.equal(screen.present(b), 1, "one changed cell row");
    assert.ok(chunks[1].includes(`${ESC}[4;1H`));
    assert.ok(!chunks[1].includes(`${ESC}[2;1H`));
    screen.invalidate();
    assert.equal(screen.present(b), 3, "invalidate forces a full repaint");
    assert.throws(() => new PixelScreen({}), /write/);
});

test("colour helpers", () => {
    assert.deepEqual(scaleColor([100, 200, 300], 0.5), [50, 100, 150]);
    assert.deepEqual(mixColor([0, 0, 0], [100, 200, 50], 0.5), [50, 100, 25]);
});
