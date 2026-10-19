import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getPrefs } from "./prefs-store";
import { loadEngine } from "../test/engine";
import { Landing } from "./Landing";
import { getUi, setUi } from "./ui-store";

loadEngine();

describe("the title screen", () => {
    it("offers the four doors; choosing one is remembered and opens it", async () => {
        window.localStorage.clear();
        render(<Landing />);
        await act(async () => { setUi({ landingOpen: true }); });
        const dialog = screen.getByRole("dialog", { name: "Welcome to Bashcrawl" });
        expect(dialog).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Learn/ })).toHaveFocus();
        expect(dialog.querySelector('[data-art="landing-brand"]')).toBeInTheDocument();
        await act(async () => { screen.getByRole("button", { name: /Practice Arcade/ }).click(); });
        expect(getUi().landingOpen).toBe(false);
        expect(getPrefs().onboarded).toBe(true);
        expect(window.location.hash).toBe("#/arcade");
        expect(JSON.parse(window.localStorage.getItem("bashcrawl-web-shell-v1") ?? "{}")).toMatchObject({ onboarded: true });
    });

    it("Escape takes the Story door", async () => {
        render(<Landing />);
        await act(async () => { setUi({ landingOpen: true }); });
        await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
        expect(getUi().landingOpen).toBe(false);
        expect(window.location.hash).toBe("#/story");
    });
});
