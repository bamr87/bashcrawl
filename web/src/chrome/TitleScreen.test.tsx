import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { GameStore } from "../engine/game-store";
import { clearHero, createHero, getHero } from "../hero/hero-store";
import { dataLoader, loadEngine } from "../test/engine";
import { setPrefs } from "./prefs-store";
import { TitleScreen } from "./TitleScreen";
import { getUi, setUi } from "./ui-store";

loadEngine();

async function mount() {
    const store = new GameStore();
    await store.boot(dataLoader);
    render(<TitleScreen store={store} />);
    await act(async () => { setUi({ overlay: "title" }); });
    return store;
}

describe("the title screen", () => {
    beforeEach(() => {
        window.localStorage.clear();
        clearHero();
        setUi({ overlay: null, tour: null });
    });

    it("leads a newcomer with New game, moves the cursor with the arrows and opens creation", async () => {
        await mount();
        const dialog = screen.getByRole("dialog", { name: "Bashcrawl title screen" });
        expect(dialog.querySelector('[data-art="landing-brand"]')).toBeInTheDocument();
        const items = screen.getAllByRole("menuitem");
        expect(items[0]).toHaveTextContent("New game");
        expect(items[0]).toHaveFocus();
        expect(items.map((item) => item.textContent)).toEqual(expect.arrayContaining([expect.stringContaining("How to play"), expect.stringContaining("Options")]));
        await act(async () => { fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" }); });
        expect(items[1]).toHaveFocus();
        await act(async () => { fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowUp" }); });
        expect(items[0]).toHaveFocus();
        await act(async () => { items[0]?.click(); });
        expect(getUi().overlay).toBe("create");
    });

    it("continues an existing hero through their last door, and can start over", async () => {
        createHero({ name: "Mira", role: "scribe", look: 1 });
        setPrefs({ mode: "arcade", onboarded: true });
        const store = await mount();
        store.execute("pwd");
        const items = screen.getAllByRole("menuitem");
        expect(items[0]).toHaveTextContent("Continue");
        expect(items[0]).toHaveTextContent("Mira");
        await act(async () => { items[0]?.click(); });
        expect(getUi().overlay).toBeNull();
        expect(window.location.hash).toBe("#/arcade");

        await act(async () => { setUi({ overlay: "title" }); });
        await act(async () => { screen.getByRole("menuitem", { name: /New hero/ }).click(); });
        expect(screen.getByRole("group", { name: "Start over?" })).toHaveTextContent("Mira");
        await act(async () => { screen.getByRole("button", { name: "Yes, new hero" }).click(); });
        expect(getHero()).toBeNull();
        expect(getUi().overlay).toBe("create");
        expect(store.model("statusModel").xp).toBe(0);
    });

    it("Escape takes the first entry", async () => {
        await mount();
        await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
        expect(getUi().overlay).toBe("create");
    });
});
