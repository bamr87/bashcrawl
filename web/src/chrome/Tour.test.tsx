import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { GameStore } from "../engine/game-store";
import { clearHero, createHero, getHero } from "../hero/hero-store";
import { StatusStrip } from "../hud/StatusStrip";
import { StoryScreen } from "../screens/StoryScreen";
import { PromptDock } from "../terminal/PromptDock";
import { getPrompt, setPromptValue } from "../terminal/prompt-store";
import { dataLoader, loadEngine } from "../test/engine";
import { Tour } from "./Tour";
import { getUi, setUi, startTour } from "./ui-store";

loadEngine();

async function mount() {
    const store = new GameStore();
    await store.boot(dataLoader);
    render(
        <>
            <StatusStrip store={store} />
            <StoryScreen store={store} />
            <PromptDock store={store} />
            <Tour />
        </>,
    );
    await act(async () => { startTour(); });
    return store;
}

describe("the guided tour", () => {
    beforeEach(() => {
        window.localStorage.clear();
        clearHero();
        createHero({ name: "Mira", role: "wanderer" });
        setPromptValue("");
        setUi({ overlay: null, tour: null });
    });

    it("walks the page, skips stops whose target has no size, and casts pwd at the end", async () => {
        await mount();
        const dialog = screen.getByRole("dialog", { name: "Guided tour" });
        expect(dialog).toHaveTextContent("Welcome, Mira");
        expect(dialog).toHaveTextContent("1 / 7");
        // jsdom lays nothing out, so every anchored stop measures 0×0 and is
        // skipped: Next lands on the last card.
        await act(async () => { screen.getByRole("button", { name: "Next" }).click(); });
        expect(screen.getByRole("dialog", { name: "Guided tour" })).toHaveTextContent("Ready");
        await act(async () => { screen.getByRole("button", { name: "Cast pwd" }).click(); });
        expect(getUi().tour).toBeNull();
        expect(getHero()?.tourDone).toBe(true);
        expect(getPrompt().value).toBe("pwd");
    });

    it("Escape skips and is remembered", async () => {
        await mount();
        await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
        expect(getUi().tour).toBeNull();
        expect(getHero()?.tourDone).toBe(true);
        expect(getPrompt().value).toBe("");
    });
});
