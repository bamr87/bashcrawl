import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getUi, setUi } from "../chrome/ui-store";
import { game } from "../engine/game-store";
import { clearHero, createHero, setHero } from "../hero/hero-store";
import { dataLoader, loadEngine } from "../test/engine";
import { THEME_KEY } from "../theme/theme-store";
import { App } from "./App";

loadEngine();

describe("the app shell", () => {
    it("has the landmarks, the skip link first, one main, and working chrome", async () => {
        window.localStorage.clear();
        window.location.hash = "#/story";
        // A returning hero who has taken the tour: no title screen, no tour.
        clearHero();
        createHero({ name: "Mira", role: "wanderer" });
        setHero({ tourDone: true });
        setUi({ overlay: null, tour: null });
        await game.boot(dataLoader);
        const { container } = render(<App />);

        const first = container.querySelector("a, button, input");
        expect(first).toHaveClass("bc-skip");
        expect(first).toHaveAttribute("href", "#main-content");
        expect(container.querySelectorAll("main").length).toBe(1);
        expect(container.querySelector("main")).toHaveAttribute("id", "main-content");
        expect(screen.getByRole("navigation", { name: "Game modes" })).toBeInTheDocument();
        expect(screen.getByRole("complementary", { name: "Game status panels" })).toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
        expect(screen.getByRole("log", { name: "Dungeon log" })).toBeInTheDocument();
        expect(screen.getByRole("group", { name: "Hero status" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^Hero Mira/ })).toBeInTheDocument();
        expect(screen.queryByRole("dialog")).toBeNull();

        // Options: the theme cycles dark → light → auto and persists.
        await act(async () => { screen.getByRole("button", { name: "Options" }).click(); });
        const options = screen.getByRole("dialog", { name: "Options" });
        expect(options).toBeInTheDocument();
        const theme = within(screen.getByRole("radiogroup", { name: "Theme" }));
        await act(async () => { theme.getByRole("radio", { name: "Light" }).click(); });
        expect(document.documentElement.getAttribute("data-theme")).toBe("light");
        expect(window.localStorage.getItem(THEME_KEY)).toBe("light");
        await act(async () => { theme.getByRole("radio", { name: "Auto" }).click(); });
        expect(document.documentElement.getAttribute("data-theme")).toBe("auto");
        await act(async () => { theme.getByRole("radio", { name: "Dark" }).click(); });
        expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
        await act(async () => { screen.getByRole("button", { name: "Close Options" }).click(); });
        expect(getUi().overlay).toBeNull();

        // The brand opens the title screen; Escape (Continue) closes it.
        await act(async () => { screen.getByRole("button", { name: "Bashcrawl: title screen" }).click(); });
        expect(screen.getByRole("dialog", { name: "Bashcrawl title screen" })).toBeInTheDocument();
        await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
        expect(getUi().overlay).toBeNull();

        // Alt+2 opens Learn; `?` opens the shortcuts; Escape closes them.
        await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "2", code: "Digit2", altKey: true, bubbles: true })); });
        expect(window.location.hash).toBe("#/learn");
        expect(screen.getByRole("tab", { name: /Learn/ })).toHaveAttribute("aria-selected", "true");
        await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true })); });
        expect(getUi().helpOpen).toBe(true);
        expect(screen.getByRole("dialog", { name: "Keyboard" })).toBeInTheDocument();
        await act(async () => { setUi({ helpOpen: false }); });

        // Escape with nothing open is the game menu; Alt+J the journal; the prompt knows `menu`.
        await act(async () => { screen.getByRole("tab", { name: /Story/ }).click(); });
        await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
        expect(getUi().overlay).toBe("menu");
        expect(screen.getByRole("dialog", { name: "Game menu" })).toBeInTheDocument();
        await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
        expect(getUi().overlay).toBeNull();
        await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "j", code: "KeyJ", altKey: true, bubbles: true })); });
        expect(getUi().overlay).toBe("journal");
        expect(screen.getByRole("dialog", { name: "Journal" })).toBeInTheDocument();
        await act(async () => { setUi({ overlay: null }); });
        const prompt = screen.getByRole("textbox", { name: "Command" });
        await act(async () => { fireEvent.change(prompt, { target: { value: "journal" } }); fireEvent.keyDown(prompt, { key: "Enter" }); });
        expect(getUi().overlay).toBe("journal");
        expect(screen.getByRole("log", { name: "Dungeon log" })).toHaveTextContent("the journal opens");
        await act(async () => { setUi({ overlay: null }); });

        // The reference hides the prompt dock and the status strip.
        await act(async () => { screen.getByRole("tab", { name: /Reference/ }).click(); });
        expect(window.location.hash).toBe("#/reference");
        expect(screen.queryByRole("textbox", { name: "Command" })).toBeNull();
        expect(screen.queryByRole("group", { name: "Hero status" })).toBeNull();
        expect(screen.getByRole("searchbox", { name: "Search the reference" })).toBeInTheDocument();
    });
});
