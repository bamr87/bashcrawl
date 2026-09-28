"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { runReview, decode } = require("../node/ux.js");

test("the UX review passes on the live stage", () => {
    const result = runReview();
    assert.equal(result.pass, true, result.report);
});

test("the decoder keeps cursor-addressed rows apart", () => {
    const grid = decode("\u001b[2;1Hbanner\u001b[8;1HRADAR", 20, 10);
    assert.equal(grid[1], "banner");
    assert.equal(grid[7], "RADAR");
    assert.ok(!grid.some((row) => row.includes("banner") && row.includes("RADAR")));
});

for (const [cols, rows] of [[40, 8], [80, 8], [80, 24], [100, 30], [120, 40]]) {
    for (const dock of ["left", "right"]) {
        for (const reducedMotion of [false, true]) {
            test(`UX ${cols}x${rows}, ${dock}, reduced motion ${reducedMotion}`, () => {
                const result = runReview({ cols, rows, dock, reducedMotion });
                assert.equal(result.pass, true, result.report);
            });
        }
    }
}
