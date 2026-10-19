import { beforeEach, describe, expect, it } from "vitest";

import { cleanName, clearHero, createHero, DEFAULT_NAME, getHero, HERO_KEY, LOOKS, NAME_MAX, rollName, roleMeta, setHero } from "./hero-store";

describe("hero store", () => {
    beforeEach(() => {
        window.localStorage.clear();
        clearHero();
    });

    it("rolls pronounceable names from a seedable source", () => {
        const seq = [0.1, 0.9, 0.5];
        let i = 0;
        const rng = () => seq[i++ % seq.length] ?? 0;
        const first = rollName(rng);
        expect(first).toMatch(/^[A-Z][a-z]+$/);
        i = 0;
        expect(rollName(rng)).toBe(first);
        expect(rollName(() => 0.1)).toMatch(/^[A-Z][a-z]+$/);
    });

    it("cleans names", () => {
        expect(cleanName("  Kael   the  Bold ")).toBe("Kael the Bold");
        expect(cleanName("<script>")).toBe("script");
        expect(cleanName("")).toBe(DEFAULT_NAME);
        expect(cleanName("x".repeat(40)).length).toBe(NAME_MAX);
    });

    it("creates, updates, persists and clears a hero", () => {
        expect(getHero()).toBeNull();
        const hero = createHero({ name: "Mira", role: "scribe", look: 2 });
        expect(hero).toMatchObject({ name: "Mira", role: "scribe", look: 2, tourDone: false });
        expect(JSON.parse(window.localStorage.getItem(HERO_KEY) ?? "{}")).toMatchObject({ name: "Mira", role: "scribe" });
        setHero({ tourDone: true, look: 99 });
        expect(getHero()).toMatchObject({ name: "Mira", tourDone: true, look: 0 });
        expect(roleMeta("scribe").door).toBe("learn");
        expect(roleMeta("rogue").door).toBe("arcade");
        expect(LOOKS.length).toBe(4);
        clearHero();
        expect(getHero()).toBeNull();
        expect(window.localStorage.getItem(HERO_KEY)).toBeNull();
    });
});
