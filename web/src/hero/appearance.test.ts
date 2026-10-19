import { describe, expect, it } from "vitest";

import {
    COMPANIONS, DEFAULT_APPEARANCE, describeAppearance, DYE_NAMES, HAIR_STYLES, HEADGEARS, legacyLook, OUTFITS, paletteStyle,
    randomAppearance, ROLE_PRESETS, sanitizeAppearance, SKIN_NAMES, WEAPONS,
} from "./appearance";
import { ROLES } from "./roles";

describe("appearance", () => {
    it("sanitises a saved appearance and migrates the four legacy looks", () => {
        expect(sanitizeAppearance(null)).toEqual(DEFAULT_APPEARANCE);
        expect(sanitizeAppearance({ skin: 99, hair: "bouffant", outfit: "plate", dye: -1, cape: 3, companion: "dragon" }))
            .toEqual({ ...DEFAULT_APPEARANCE, outfit: "plate", cape: 3 });
        expect(sanitizeAppearance({ cape: null }).cape).toBeNull();
        expect(legacyLook(2).dye).toBe(3);
        expect(legacyLook(undefined)).toEqual(DEFAULT_APPEARANCE);
        expect(sanitizeAppearance(undefined, legacyLook(1)).dye).toBe(4);
    });

    it("rolls a random appearance inside the catalogue", () => {
        const seq = [0.99, 0.01, 0.5, 0.75, 0.2, 0.6, 0.4, 0.3, 0.8, 0.1, 0.9, 0.05];
        let i = 0;
        const rolled = randomAppearance(() => seq[i++ % seq.length] ?? 0);
        expect(rolled.skin).toBeLessThan(SKIN_NAMES.length);
        expect(rolled.dye).toBeLessThan(DYE_NAMES.length);
        expect(HAIR_STYLES).toContain(rolled.hair);
        expect(HEADGEARS).toContain(rolled.headgear);
        expect(OUTFITS).toContain(rolled.outfit);
        expect(WEAPONS).toContain(rolled.weapon);
        expect(COMPANIONS).toContain(rolled.companion);
        expect(sanitizeAppearance(rolled)).toEqual(rolled);
    });

    it("dresses every path and hands the palette to CSS as token references only", () => {
        for (const role of ROLES) {
            const preset = ROLE_PRESETS[role.id];
            expect(sanitizeAppearance(preset)).toEqual(preset);
            const style = paletteStyle(preset);
            for (const value of Object.values(style)) expect(value).toMatch(/^var\(--/);
        }
        expect(paletteStyle(ROLE_PRESETS.rogue)["--hero-cape"]).toBe("var(--bc-hero-dye-10)");
        expect(paletteStyle(ROLE_PRESETS.scribe)["--hero-pet"]).toBe("var(--bc-hero-pet-owl)");
        expect(describeAppearance(ROLE_PRESETS.sage)).toBe("silver-haired, in a violet robe, staff in hand, a bat at heel");
        expect(describeAppearance({ ...DEFAULT_APPEARANCE, hair: "bald", weapon: "none" })).toBe("bald, in a forest tunic, empty-handed");
    });
});
