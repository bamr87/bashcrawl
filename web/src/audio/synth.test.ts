import { describe, expect, it } from "vitest";

import { play, SFX } from "./sfx";
import { setSound, soundOn, SOUND_KEY } from "./sound-store";
import { available, canPlay, tone, unlock } from "./synth";

describe("synth", () => {
    it("is silent and safe without an AudioContext (jsdom), and off by default", () => {
        expect(available()).toBe(false);
        expect(soundOn()).toBe(false);
        expect(() => { unlock(); tone(440); play("xp"); play("levelup"); }).not.toThrow();
        expect(canPlay()).toBe(false);
    });

    it("remembers the sound preference under its own key", () => {
        setSound(true);
        expect(window.localStorage.getItem(SOUND_KEY)).toBe("on");
        expect(soundOn()).toBe(true);
        setSound(false);
        expect(window.localStorage.getItem(SOUND_KEY)).toBe("off");
    });

    it("has a phrase for every named sound", () => {
        for (const [name, fn] of Object.entries(SFX)) {
            expect(fn, name).toBeTypeOf("function");
            expect(() => fn()).not.toThrow();
        }
    });
});
