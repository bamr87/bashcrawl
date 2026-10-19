import { afterEach, describe, expect, it } from "vitest";

import { addTrauma, getTrauma, resetShake, tick } from "./shake";

describe("screen shake", () => {
    afterEach(() => resetShake());

    it("offsets #stage while trauma decays, then clears the variables", () => {
        const stage = document.createElement("div");
        stage.id = "stage";
        document.body.appendChild(stage);
        addTrauma(0.6);
        expect(getTrauma()).toBeCloseTo(0.6);
        tick(16);
        expect(stage.style.getPropertyValue("--shake-x")).toMatch(/px$/);
        expect(stage.style.getPropertyValue("--shake-rot")).toMatch(/deg$/);
        for (let t = 32; t < 2000; t += 16) tick(t);
        expect(getTrauma()).toBe(0);
        expect(stage.style.getPropertyValue("--shake-x")).toBe("");
        stage.remove();
    });

    it("caps trauma at 1", () => {
        addTrauma(0.8);
        addTrauma(0.8);
        expect(getTrauma()).toBe(1);
    });
});
