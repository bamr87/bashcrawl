import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GameStore } from "../engine/game-store";
import { artClip, isPlaying, paintedText, preferReducedMotion } from "../test/art";
import { dataLoader, loadEngine } from "../test/engine";
import { ArcadeStore } from "./arcade-store";
import { ArcadeHome } from "./ArcadeHome";

loadEngine();

async function mount() {
    window.localStorage.clear();
    const story = new GameStore();
    await story.boot(dataLoader);
    const arcade = new ArcadeStore(story);
    const { container } = render(<ArcadeHome store={arcade} />);
    return { arcade, art: container.querySelector('.bc-arcade-intro [data-art="door-arcade"]') };
}

describe("the arcade floor", () => {
    let restore: (() => void) | null = null;
    afterEach(() => {
        restore?.();
        restore = null;
    });

    it("heads the trial cards with the door's ASCII Motion clip, playing once from its first frame", async () => {
        const { arcade, art } = await mount();
        const clip = artClip("door-arcade");
        expect(clip?.frames).toBeGreaterThan(1);
        expect(art).toHaveAttribute("aria-hidden", "true");
        expect(art).not.toHaveAttribute("tabindex");
        expect(paintedText(art)).toBe(clip?.frameText(0));
        expect(isPlaying(art)).toBe(true);
        expect(screen.getAllByRole("button", { name: /^Play / })).toHaveLength(arcade.games.length);
    });

    it("paints the clip's resting frame and holds still under prefers-reduced-motion", async () => {
        restore = preferReducedMotion();
        const { art } = await mount();
        const clip = artClip("door-arcade");
        expect(paintedText(art)).toBe(clip?.frameText(clip.frames - 1));
        expect(isPlaying(art)).toBe(false);
    });
});
