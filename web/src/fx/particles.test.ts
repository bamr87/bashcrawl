// @vitest-environment node
import { describe, expect, it } from "vitest";

import { ParticleSystem, Wipe } from "./particles";

const colors = ["red", "gold"];
let seed = 7;
const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

describe("ParticleSystem", () => {
    it("recycles the oldest particle at the cap instead of growing", () => {
        const system = new ParticleSystem(20);
        system.emit("spark", { from: { x: 0, y: 0 }, count: 15, colors, random });
        system.emit("spark", { from: { x: 0, y: 0 }, count: 15, colors, random });
        expect(system.count).toBe(20);
    });

    it("orbs steer to their target and report each arrival", () => {
        const system = new ParticleSystem(64);
        let arrived = 0;
        system.emit("orb", { from: { x: 0, y: 0 }, to: { x: 300, y: -200 }, count: 8, colors, random, onArrive: () => { arrived++; } });
        for (let i = 0; i < 90; i++) system.step(1 / 60);
        expect(arrived).toBe(8);
        expect(system.count).toBe(0);
    });

    it("sparks, embers and glints expire; confetti falls", () => {
        const system = new ParticleSystem(64);
        system.emit("spark", { from: { x: 10, y: 10 }, count: 5, colors, random });
        system.emit("glint", { from: { x: 10, y: 10 }, count: 5, colors, random });
        system.emit("ember", { from: { x: 10, y: 10 }, count: 5, colors, random });
        for (let i = 0; i < 200; i++) system.step(1 / 60);
        expect(system.count).toBe(0);
        system.emit("confetti", { from: { x: 100, y: 0 }, count: 3, colors, random });
        system.step(0.5);
        expect(system.count).toBe(3);
    });

    it("steps clamp to 50 ms and render touches every live particle", () => {
        const system = new ParticleSystem(16);
        system.emit("ring", { from: { x: 5, y: 5 }, count: 1, colors, random, ttl: 1 });
        system.step(5); // one huge frame counts as 50 ms
        expect(system.count).toBe(1);
        const calls: string[] = [];
        const ctx = new Proxy({}, { get: (_t, key) => (key === "globalAlpha" || key === "fillStyle" || key === "strokeStyle" || key === "lineWidth") ? 1 : () => { calls.push(String(key)); } }) as unknown as CanvasRenderingContext2D;
        system.render(ctx);
        expect(calls).toContain("arc");
    });
});

describe("Wipe", () => {
    it("swaps once at the darkest moment and finishes after the out phase", () => {
        let swaps = 0;
        const wipe = new Wipe({ rect: { x: 0, y: 0, width: 100, height: 50 }, color: "black", inMs: 100, outMs: 100, seed: 1, onSwap: () => { swaps++; } });
        wipe.step(0.05);
        expect(swaps).toBe(0);
        wipe.step(0.06);
        expect(swaps).toBe(1);
        expect(wipe.done).toBe(false);
        wipe.step(0.2);
        expect(swaps).toBe(1);
        expect(wipe.done).toBe(true);
        expect(wipe.alphaAt(3)).toBeLessThanOrEqual(1);
    });
});
