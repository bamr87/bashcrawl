import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GameStore } from "../engine/game-store";
import { dataLoader, loadEngine } from "../test/engine";
import { ArcadeStore } from "./arcade-store";
import { VimStage } from "./VimStage";

loadEngine();

async function boot() {
    window.localStorage.clear();
    const story = new GameStore();
    await story.boot(dataLoader);
    return new ArcadeStore(story);
}

describe("the Vim Catacombs stage", () => {
    it("draws the buffer with the cursor, gems, spikes, the gutter and a mode line", async () => {
        const arcade = await boot();
        arcade.start("vim", "first-steps");
        const { container } = render(<VimStage store={arcade} />);
        expect(container.querySelectorAll(".bc-vim-gem")).toHaveLength(4);
        expect(container.querySelectorAll(".bc-vim-spike")).toHaveLength(1);
        expect(container.querySelector(".bc-vim-cursor")?.textContent).toBe(".");
        expect(container.querySelector(".bc-vim-mode")?.textContent).toBe("-- NORMAL --");
        expect(container.querySelector(".bc-vim")?.getAttribute("data-mode")).toBe("normal");
        const gutters = Array.from(container.querySelectorAll(".bc-vim-buffer .bc-vim-gutter"), (g) => g.textContent?.trim());
        expect(gutters).toEqual(["1", "2", "3", "4", "5", "6"]);
        await act(async () => { arcade.execute("jllll"); });
        expect(container.querySelector(".bc-vim-gems")?.textContent).toBe("✦ 1/4");
        expect(container.querySelector(".bc-vim-line[data-current] .bc-vim-gutter")?.textContent?.trim()).toBe("2");
        expect(container.querySelector(".bc-vim-pos")?.textContent).toBe("2,5");
    });

    it("numbers lines relative to the cursor once counts are learned, and shows a target while inserting", async () => {
        const arcade = await boot();
        arcade.start("vim", "the-count");
        const { container, rerender } = render(<VimStage store={arcade} />);
        const gutters = Array.from(container.querySelectorAll(".bc-vim-buffer .bc-vim-gutter"), (g) => g.textContent?.trim());
        expect(gutters).toEqual(["1", "1", "2", "3", "4", "5", "6", "7"]);
        arcade.execute(":q");
        arcade.start("vim", "the-scribe");
        rerender(<VimStage store={arcade} />);
        expect(container.querySelector(".bc-vim-target")?.textContent).toContain("open sesame now");
        await act(async () => { arcade.keystroke("A", ""); });
        expect(container.querySelector(".bc-vim")?.getAttribute("data-mode")).toBe("insert");
        expect(container.querySelector(".bc-vim-mode")?.textContent).toBe("-- INSERT --");
        expect(container.querySelector(".bc-vim-cursor")?.textContent).toBe(" ");
        await act(async () => { arcade.keystroke("d", ""); });
        expect(container.querySelector(".bc-vim-line[data-current]")?.textContent).toContain("open sesamed");
        await act(async () => { arcade.keystroke("Escape", ""); });
        expect(container.querySelector(".bc-vim-mode")?.textContent).toBe("-- NORMAL --");
        await act(async () => { arcade.keystroke("2", ""); });
        expect(container.querySelector(".bc-vim-mode")?.textContent).toBe("2");
    });
});
