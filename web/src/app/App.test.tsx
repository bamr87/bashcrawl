import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getUi, setUi } from "../chrome/ui-store";
import { game } from "../engine/game-store";
import { dataLoader, loadEngine } from "../test/engine";
import { THEME_KEY } from "../theme/theme-store";
import { App } from "./App";

loadEngine();

describe("the app shell", () => {
    it("has the landmarks, the skip link first, one main, and working chrome", async () => {
        window.localStorage.clear();
        window.location.hash = "#/story";
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

        // Theme cycles dark → light → auto and persists.
        const theme = screen.getByRole("button", { name: /^Theme: Dark/ });
        await act(async () => { theme.click(); });
        expect(document.documentElement.getAttribute("data-theme")).toBe("light");
        expect(window.localStorage.getItem(THEME_KEY)).toBe("light");
        await act(async () => { screen.getByRole("button", { name: /^Theme: Light/ }).click(); });
        expect(document.documentElement.getAttribute("data-theme")).toBe("auto");
        await act(async () => { screen.getByRole("button", { name: /^Theme: Auto/ }).click(); });
        expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

        // Alt+2 opens Learn; `?` opens the shortcuts; Escape closes them.
        await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "2", code: "Digit2", altKey: true, bubbles: true })); });
        expect(window.location.hash).toBe("#/learn");
        expect(screen.getByRole("tab", { name: /Learn/ })).toHaveAttribute("aria-selected", "true");
        await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true })); });
        expect(getUi().helpOpen).toBe(true);
        expect(screen.getByRole("dialog", { name: "Keyboard" })).toBeInTheDocument();
        await act(async () => { setUi({ helpOpen: false }); });

        // The reference hides the prompt dock and the status strip.
        await act(async () => { screen.getByRole("tab", { name: /Reference/ }).click(); });
        expect(window.location.hash).toBe("#/reference");
        expect(screen.queryByRole("textbox", { name: "Command" })).toBeNull();
        expect(screen.queryByRole("group", { name: "Hero status" })).toBeNull();
        expect(screen.getByRole("searchbox", { name: "Search the reference" })).toBeInTheDocument();
    });
});
