import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { currentRoute, navigateHome } from "../app/useHashRoute";
import { setPrefs } from "../chrome/prefs-store";
import { getUi, setUi } from "../chrome/ui-store";
import { GameStore } from "../engine/game-store";
import { clearHero, createHero, getHero } from "../hero/hero-store";
import { dataLoader, loadEngine } from "../test/engine";
import { LandingScreen } from "./LandingScreen";

loadEngine();

async function mount() {
    const store = new GameStore();
    await store.boot(dataLoader);
    render(<LandingScreen store={store} />);
    return store;
}

describe("the home page", () => {
    beforeEach(() => {
        window.localStorage.clear();
        clearHero();
        setPrefs({ mode: null, onboarded: false, introSeen: true });
        setUi({ overlay: null, tour: null, privacyOpen: false });
        navigateHome();
    });

    it("pitches the game to a newcomer and leads into hero creation", async () => {
        await mount();
        expect(screen.getByRole("heading", { level: 1, name: "Learn the terminal by playing." })).toBeInTheDocument();
        await act(async () => { screen.getByRole("button", { name: /Start playing/ }).click(); });
        expect(getUi().overlay).toBe("create");
    });

    it("lets a newcomer skip setup straight into the Story door", async () => {
        await mount();
        await act(async () => { screen.getByRole("button", { name: "Skip setup, jump in" }).click(); });
        expect(getHero()?.name).toBe("Adventurer");
        expect(currentRoute()).toEqual({ kind: "mode", mode: "story" });
    });

    it("takes a returning hero back to their last door", async () => {
        createHero({ name: "Mira", role: "scribe" });
        setPrefs({ mode: "arcade", onboarded: true });
        await mount();
        expect(screen.queryByRole("button", { name: "Skip setup, jump in" })).toBeNull();
        await act(async () => { screen.getByRole("button", { name: /Continue as Mira/ }).click(); });
        expect(currentRoute()).toEqual({ kind: "mode", mode: "arcade" });
    });

    it("shows the four doors with figures read from the game's content", async () => {
        const store = await mount();
        const doors = screen.getByRole("heading", { name: "Pick how you like to learn" }).parentElement as HTMLElement;
        const quests = store.runtime?.quests.length ?? 0;
        expect(within(doors).getByText(new RegExp(`^${quests} quests`))).toBeInTheDocument();
        expect(within(doors).getByText(/courses · \d+ lessons/)).toBeInTheDocument();
        await act(async () => { within(doors).getByRole("button", { name: /Reference/ }).click(); });
        expect(currentRoute()).toEqual({ kind: "mode", mode: "reference" });
    });

    it("runs real commands in a sandbox that never touches the saved game", async () => {
        const store = await mount();
        const log = screen.getByRole("log", { name: "Sandbox terminal output" });
        await act(async () => { screen.getByRole("button", { name: "pwd" }).click(); });
        expect(log).toHaveTextContent("/entrance");
        const input = screen.getByRole("textbox", { name: "Sandbox command" });
        await act(async () => {
            fireEvent.change(input, { target: { value: "cd cellar" } });
            fireEvent.submit(input.closest("form") as HTMLFormElement);
        });
        await act(async () => { screen.getByRole("button", { name: "pwd" }).click(); });
        expect(log).toHaveTextContent("/entrance/cellar");
        // The story's own runtime never moved, ran nothing and completed nothing.
        expect(store.runtime?.state.cwd).toBe("/entrance");
        expect(store.runtime?.state.history).toEqual([]);
        expect(store.runtime?.state.completedQuestIds).toEqual([]);
        // After a few commands it points at the real thing.
        expect(screen.getByRole("button", { name: /Keep going in the real dungeon/ })).toBeInTheDocument();
    });

    it("says so, and offers a reload, when the game's data did not load", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const store = new GameStore();
        await store.boot(async () => { throw new Error("offline"); });
        render(<LandingScreen store={store} />);
        expect(screen.getByRole("alert")).toHaveTextContent("did not load");
        expect(within(screen.getByRole("alert")).getByRole("button", { name: "Reload" })).toBeInTheDocument();
        expect(screen.getByRole("log", { name: "Sandbox terminal output" })).toHaveTextContent("did not load");
        expect(screen.getByRole("textbox", { name: "Sandbox command" })).toBeDisabled();
        error.mockRestore();
    });

    it("opens the privacy panel from the footer and credits the original", async () => {
        await mount();
        await act(async () => { screen.getByRole("button", { name: "Privacy" }).click(); });
        expect(getUi().privacyOpen).toBe(true);
        expect(screen.getByRole("link", { name: /Seth Kenlon/ })).toHaveAttribute("href", "https://gitlab.com/slackermedia/bashcrawl");
    });
});
