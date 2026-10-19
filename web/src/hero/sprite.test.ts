import { describe, expect, it } from "vitest";

import {
    COMPANIONS, DEFAULT_APPEARANCE, HAIR_STYLES, HEADGEARS, OUTFITS, ROLE_PRESETS, WEAPONS, type Appearance,
} from "./appearance";
import { allParts, compose, EYE_ROW, LAYERS, OUT_H, OUT_W, SCALE, SLOT_VARS, validateParts } from "./sprite";

function pixels(a: Appearance): number {
    return compose(a).reduce((sum, layer) => sum + layer.runs.reduce((n, run) => n + run.w, 0), 0);
}

describe("the hero sprite", () => {
    it("is authored on a 16-wide canvas and stays inside it", () => {
        expect(validateParts()).toEqual([]);
        expect(allParts().length).toBeGreaterThan(25);
        for (const layer of compose(DEFAULT_APPEARANCE)) {
            for (const run of layer.runs) {
                expect(run.x).toBeGreaterThanOrEqual(0);
                expect(run.x + run.w).toBeLessThanOrEqual(OUT_W);
                expect(run.y).toBeGreaterThanOrEqual(0);
                expect(run.y).toBeLessThan(OUT_H);
                expect(SLOT_VARS[run.slot]).toBeTruthy();
            }
        }
    });

    it("draws every part variant, in layer order, with the eyes above the headgear", () => {
        const layered = compose({ ...DEFAULT_APPEARANCE, headgear: "helm", cape: 2, companion: "cat" });
        expect(layered.map((layer) => layer.name)).toEqual([...LAYERS]);
        // Each authored eye is one cell; at 2× it is a 2×2 square (EPX never rounds a lone pixel).
        const eyes = layered.find((layer) => layer.name === "eyes");
        expect(eyes?.runs.map((run) => [run.x, run.y, run.w])).toEqual([
            [6 * SCALE, EYE_ROW * SCALE, SCALE], [9 * SCALE, EYE_ROW * SCALE, SCALE],
            [6 * SCALE, EYE_ROW * SCALE + 1, SCALE], [9 * SCALE, EYE_ROW * SCALE + 1, SCALE],
        ]);
        expect(layered.find((layer) => layer.name === "cape")?.runs.length).toBeGreaterThan(0);
        expect(layered.find((layer) => layer.name === "companion")?.runs.length).toBeGreaterThan(0);
        // The helm covers the hair (a few pixels peek out at the temples, as they should).
        const hairPixels = (a: Appearance) => compose(a).find((layer) => layer.name === "hair")?.runs.reduce((n, run) => n + run.w, 0) ?? 0;
        expect(hairPixels({ ...DEFAULT_APPEARANCE, headgear: "helm" })).toBeLessThan(hairPixels(DEFAULT_APPEARANCE) / 3);
        // A hood shows only the fringe (four authored cells, at 2×).
        expect(hairPixels({ ...DEFAULT_APPEARANCE, headgear: "hood" })).toBeLessThanOrEqual(4 * SCALE * SCALE);

        for (const hair of HAIR_STYLES) expect(pixels({ ...DEFAULT_APPEARANCE, hair })).toBeGreaterThan(150);
        for (const headgear of HEADGEARS) expect(pixels({ ...DEFAULT_APPEARANCE, headgear })).toBeGreaterThan(150);
        for (const outfit of OUTFITS) expect(pixels({ ...DEFAULT_APPEARANCE, outfit })).toBeGreaterThan(150);
        for (const weapon of WEAPONS) expect(pixels({ ...DEFAULT_APPEARANCE, weapon })).toBeGreaterThan(150);
        for (const companion of COMPANIONS) expect(pixels({ ...DEFAULT_APPEARANCE, companion })).toBeGreaterThan(150);
        for (const preset of Object.values(ROLE_PRESETS)) expect(pixels(preset)).toBeGreaterThan(150);
    });

    it("merges horizontal runs, rounds corners at 2×, and is deterministic", () => {
        const a = compose(DEFAULT_APPEARANCE);
        const b = compose({ ...DEFAULT_APPEARANCE });
        expect(a).toEqual(b);
        // A bald head's top outline (authored 6 cells wide at row 4) is one run per fine row —
        // and the upper fine row is shorter than the lower one: EPX rounded the corners.
        const bald = compose({ ...DEFAULT_APPEARANCE, hair: "bald" }).find((layer) => layer.name === "body");
        const upper = bald?.runs.filter((run) => run.y === 4 * SCALE) ?? [];
        const lower = bald?.runs.filter((run) => run.y === 4 * SCALE + 1) ?? [];
        expect(upper.length).toBe(1);
        expect(lower.length).toBe(1);
        expect(upper[0]?.slot).toBe("o");
        expect((upper[0]?.w ?? 0) < (lower[0]?.w ?? 0)).toBe(true);
        // The lower row covers the authored run and may reach into the concave corners beside it.
        expect(lower[0]?.x).toBeLessThanOrEqual(5 * SCALE);
        expect((lower[0]?.x ?? 0) + (lower[0]?.w ?? 0)).toBeGreaterThanOrEqual(11 * SCALE);
        // A weapon never overlaps the body: every weapon run sits right of the torso.
        const weapon = compose({ ...DEFAULT_APPEARANCE, weapon: "staff" }).find((layer) => layer.name === "weapon");
        expect(weapon?.runs.every((run) => run.x >= 12 * SCALE)).toBe(true);
    });
});
