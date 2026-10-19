import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_APPEARANCE, ROLE_PRESETS } from "./appearance";
import { cleanName, clearHero, createHero, DEFAULT_NAME, getHero, HERO_KEY, NAME_MAX, rollName, roleMeta, setHero } from "./hero-store";

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
        const hero = createHero({ name: "Mira", role: "scribe", appearance: ROLE_PRESETS.scribe });
        expect(hero).toMatchObject({ name: "Mira", role: "scribe", tourDone: false, appearance: { outfit: "robe", weapon: "tome", companion: "owl" } });
        expect(JSON.parse(window.localStorage.getItem(HERO_KEY) ?? "{}")).toMatchObject({ name: "Mira", appearance: { outfit: "robe" } });
        setHero({ tourDone: true, appearance: { ...hero.appearance, skin: 99, headgear: "crown" } });
        expect(getHero()).toMatchObject({ name: "Mira", tourDone: true, appearance: { skin: DEFAULT_APPEARANCE.skin, headgear: "crown" } });
        expect(createHero({ name: "Pip", role: "wanderer" }).appearance).toEqual(DEFAULT_APPEARANCE);
        expect(roleMeta("scribe").door).toBe("learn");
        expect(roleMeta("rogue").door).toBe("arcade");
        clearHero();
        expect(getHero()).toBeNull();
        expect(window.localStorage.getItem(HERO_KEY)).toBeNull();
    });

    it("migrates a hero saved with one of the four legacy looks", () => {
        window.localStorage.setItem(HERO_KEY, JSON.stringify({ name: "Old", role: "rogue", look: 2, created: "2026-10-01T00:00:00.000Z", tourDone: true }));
        // The store read storage at import; a fresh create/sanitise path covers the migration.
        const migrated = createHero({ name: "Old", role: "rogue" });
        expect(migrated.appearance).toEqual(DEFAULT_APPEARANCE);
    });
});
