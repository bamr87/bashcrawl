import { afterEach, describe, expect, it, vi } from "vitest";

import { banner, clearBanners, dismissBanner, getBanner } from "./banner-store";

describe("title cards", () => {
    afterEach(() => {
        clearBanners();
        vi.useRealTimers();
    });

    it("shows one card at a time, each for its dwell, and a click skips ahead", () => {
        vi.useFakeTimers();
        banner("room", "THE CELLAR", "Learn file types here");
        banner("quest", "Know Thy Place", "+10 XP");
        banner("rank", "Apprentice of the Shell");
        expect(getBanner()).toMatchObject({ kind: "room", title: "THE CELLAR" });
        vi.advanceTimersByTime(1500);
        expect(getBanner()).toMatchObject({ kind: "quest", sub: "+10 XP" });
        dismissBanner();
        expect(getBanner()).toMatchObject({ kind: "rank" });
        vi.advanceTimersByTime(2500);
        expect(getBanner()).toBeNull();
    });
});
