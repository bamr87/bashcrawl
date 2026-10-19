import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { getPrefs, setPrefs } from "../chrome/prefs-store";
import { getUi, setUi } from "../chrome/ui-store";
import { loadEngine } from "../test/engine";
import { CreateHero } from "./CreateHero";
import { clearHero, getHero } from "./hero-store";

loadEngine();

describe("hero creation", () => {
    beforeEach(() => {
        window.localStorage.clear();
        clearHero();
        setPrefs({ mode: null, onboarded: false, introSeen: false });
        window.location.hash = "";
        setUi({ overlay: null, tour: null });
    });

    it("walks name → path → look → preferences → begin, then straight into the hero's door", async () => {
        setPrefs({ introSeen: true });
        render(<CreateHero />);
        await act(async () => { setUi({ overlay: "create" }); });
        expect(screen.getByRole("dialog", { name: "Create your hero" })).toBeInTheDocument();

        const name = screen.getByLabelText("Hero name");
        expect(name).toHaveFocus();
        await act(async () => { fireEvent.change(name, { target: { value: "  Mira  " } }); });
        expect(screen.getByRole("img", { name: /Mira, Wanderer/ })).toBeInTheDocument();
        await act(async () => { fireEvent.keyDown(name, { key: "Enter" }); });

        await act(async () => { screen.getByRole("radio", { name: /Scribe/ }).click(); });
        expect(screen.getByRole("img", { name: /Mira, Scribe/ })).toBeInTheDocument();
        await act(async () => { screen.getByRole("button", { name: "Next" }).click(); });

        await act(async () => { screen.getByRole("radio", { name: "Arcane" }).click(); });
        await act(async () => { screen.getByRole("button", { name: "Next" }).click(); });

        expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument();
        expect(screen.getByRole("radiogroup", { name: "Text speed" })).toBeInTheDocument();
        await act(async () => { screen.getByRole("button", { name: "Next" }).click(); });

        expect(screen.getByRole("heading", { name: /Ready/ })).toBeInTheDocument();
        await act(async () => { screen.getByRole("button", { name: "Begin the descent" }).click(); });

        expect(getHero()).toMatchObject({ name: "Mira", role: "scribe", look: 2 });
        expect(getPrefs().onboarded).toBe(true);
        expect(getUi().overlay).toBeNull();
        expect(window.location.hash).toBe("#/learn");
        expect(getUi().tour).toBe(0);
    });

    it("leads into the intro the first time", async () => {
        render(<CreateHero />);
        await act(async () => { setUi({ overlay: "create" }); });
        for (let i = 0; i < 4; i++) {
            await act(async () => { screen.getByRole("button", { name: "Next" }).click(); });
        }
        await act(async () => { screen.getByRole("button", { name: "Begin the descent" }).click(); });
        expect(getHero()).not.toBeNull();
        expect(getUi().overlay).toBe("intro");
    });

    it("Escape returns to the title", async () => {
        render(<CreateHero />);
        await act(async () => { setUi({ overlay: "create" }); });
        await act(async () => { fireEvent.keyDown(screen.getByLabelText("Hero name"), { key: "Escape" }); });
        expect(getUi().overlay).toBe("title");
    });
});
