import { describe, expect, it } from "vitest";

import { allowed, DEFAULT_SETTINGS, getSettings, initSettings, SETTINGS_KEY, setSettings } from "./settings-store";

describe("settings store", () => {
    it("applies the options to <html>, gates the effects and persists", () => {
        window.localStorage.clear();
        initSettings();
        expect(getSettings()).toEqual(DEFAULT_SETTINGS);
        expect(document.documentElement.dataset.textSpeed).toBe("normal");
        expect(allowed()).toEqual({ particles: true, flash: true, shake: true });

        setSettings({ textSpeed: "slow", effects: "off", textSize: "large" });
        expect(document.documentElement.dataset.textSpeed).toBe("slow");
        expect(document.documentElement.dataset.effects).toBe("off");
        expect(document.documentElement.dataset.textSize).toBe("large");
        expect(allowed()).toEqual({ particles: false, flash: false, shake: false });
        expect(JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "{}")).toMatchObject({ textSpeed: "slow", effects: "off" });

        setSettings({ effects: "light" });
        expect(allowed()).toEqual({ particles: true, flash: false, shake: true });
        setSettings({ shake: false, effects: "full" });
        expect(allowed()).toEqual({ particles: true, flash: true, shake: false });

        // Unknown values fall back.
        setSettings({ textSpeed: "warp" as never, effects: "max" as never });
        expect(getSettings()).toMatchObject({ textSpeed: "normal", effects: "full" });
        setSettings(DEFAULT_SETTINGS);
    });
});
