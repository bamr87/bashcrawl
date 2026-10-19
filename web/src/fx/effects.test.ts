// @vitest-environment node
import { describe, expect, it } from "vitest";

import { SFX } from "../audio/sfx";
import type { HudEvent, HudEventType } from "../engine/types";
import { effectFor } from "./effects";

const TYPES: HudEventType[] = ["quest", "damage", "heal", "xp", "item", "levelup", "move", "unlock", "lesson", "objective", "skill"];

describe("the event → effect table", () => {
    it("scales XP orbs with the amount and aims them at the gauge", () => {
        expect(effectFor({ type: "xp", amount: 5, text: "" }).canvas[0]).toMatchObject({ kind: "orb", from: "log-tail", to: "xp", count: 3 });
        expect(effectFor({ type: "xp", amount: 50, text: "" }).canvas[0]).toMatchObject({ count: 10 });
        expect(effectFor({ type: "xp", amount: 500, text: "" }).canvas[0]).toMatchObject({ count: 14 });
    });

    it("hits shake harder the more they hurt, and flash red", () => {
        const light = effectFor({ type: "damage", amount: 5, text: "" });
        const heavy = effectFor({ type: "damage", amount: 40, text: "" });
        expect(light.shake).toBeCloseTo(0.4);
        expect(heavy.shake).toBeCloseTo(0.75);
        expect(heavy.flash).toBe("damage");
        expect(heavy.mood).toBe("hurt");
        expect(heavy.sfx).toBe("damage");
    });

    it("celebrates a rank-up with confetti, a bloom and a fanfare; a room change wipes", () => {
        const up = effectFor({ type: "levelup", text: "" });
        expect(up.flash).toBe("levelup");
        expect(up.canvas.some((b) => b.kind === "confetti")).toBe(true);
        expect(up.sfx).toBe("levelup");
        const move = effectFor({ type: "move", from: "/entrance", to: "/entrance/cellar", text: "" });
        expect(move.wipe).toBe(true);
        expect(move.shake).toBe(0);
    });

    it("maps every event type and every sound it names exists", () => {
        for (const type of TYPES) {
            const effect = effectFor({ type, text: "" } as HudEvent);
            expect(effect.panes.length + effect.canvas.length + (effect.flash ? 1 : 0) + (effect.wipe ? 1 : 0), type).toBeGreaterThan(0);
            if (effect.sfx) expect(SFX[effect.sfx], `${type} → ${effect.sfx}`).toBeTypeOf("function");
        }
    });
});
