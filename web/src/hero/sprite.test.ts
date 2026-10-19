import { describe, expect, it } from "vitest";

import {
    COMPANIONS, DEFAULT_APPEARANCE, HAIR_STYLES, HEADGEARS, OUTFITS, ROLE_PRESETS, WEAPONS, type Appearance,
} from "./appearance";
import { allParts, compose, EYE_ROW, LAYERS, SLOT_VARS, SPRITE_H, SPRITE_W, validateParts } from "./sprite";

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
                expect(run.x + run.w).toBeLessThanOrEqual(SPRITE_W);
                expect(run.y).toBeGreaterThanOrEqual(0);
                expect(run.y).toBeLessThan(SPRITE_H);
                expect(SLOT_VARS[run.slot]).toBeTruthy();
            }
        }
    });

    it("draws every part variant, in layer order, with the eyes above the headgear", () => {
        const layered = compose({ ...DEFAULT_APPEARANCE, headgear: "helm", cape: 2, companion: "cat" });
        expect(layered.map((layer) => layer.name)).toEqual([...LAYERS]);
        const eyes = layered.find((layer) => layer.name === "eyes");
        expect(eyes?.runs.map((run) => [run.x, run.y, run.w])).toEqual([[6, EYE_ROW, 1], [9, EYE_ROW, 1]]);
        expect(layered.find((layer) => layer.name === "cape")?.runs.length).toBeGreaterThan(0);
        expect(layered.find((layer) => layer.name === "companion")?.runs.length).toBeGreaterThan(0);
        // The helm covers the hair (a few pixels peek out at the temples, as they should).
        const hairPixels = (a: Appearance) => compose(a).find((layer) => layer.name === "hair")?.runs.reduce((n, run) => n + run.w, 0) ?? 0;
        expect(hairPixels({ ...DEFAULT_APPEARANCE, headgear: "helm" })).toBeLessThan(hairPixels(DEFAULT_APPEARANCE) / 3);
        // A hood shows only the fringe.
        expect(hairPixels({ ...DEFAULT_APPEARANCE, headgear: "hood" })).toBeLessThanOrEqual(4);

        for (const hair of HAIR_STYLES) expect(pixels({ ...DEFAULT_APPEARANCE, hair })).toBeGreaterThan(150);
        for (const headgear of HEADGEARS) expect(pixels({ ...DEFAULT_APPEARANCE, headgear })).toBeGreaterThan(150);
        for (const outfit of OUTFITS) expect(pixels({ ...DEFAULT_APPEARANCE, outfit })).toBeGreaterThan(150);
        for (const weapon of WEAPONS) expect(pixels({ ...DEFAULT_APPEARANCE, weapon })).toBeGreaterThan(150);
        for (const companion of COMPANIONS) expect(pixels({ ...DEFAULT_APPEARANCE, companion })).toBeGreaterThan(150);
        for (const preset of Object.values(ROLE_PRESETS)) expect(pixels(preset)).toBeGreaterThan(150);
    });

    it("merges horizontal runs and is deterministic", () => {
        const a = compose(DEFAULT_APPEARANCE);
        const b = compose({ ...DEFAULT_APPEARANCE });
        expect(a).toEqual(b);
        // A bald head's top outline is one 6-wide run, not six rects (hair would cover it).
        const bald = compose({ ...DEFAULT_APPEARANCE, hair: "bald" }).find((layer) => layer.name === "body");
        expect(bald?.runs.find((run) => run.y === 4)).toEqual({ x: 5, y: 4, w: 6, slot: "o" });
        // A weapon never overlaps the body: every weapon run sits right of the torso.
        const weapon = compose({ ...DEFAULT_APPEARANCE, weapon: "staff" }).find((layer) => layer.name === "weapon");
        expect(weapon?.runs.every((run) => run.x >= 12)).toBe(true);
    });
});
