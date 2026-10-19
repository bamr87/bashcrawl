import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { clearHero, createHero } from "../hero/hero-store";
import { loadEngine } from "../test/engine";
import { Intro } from "./Intro";
import { getPrefs, setPrefs } from "./prefs-store";
import { getUi, setUi } from "./ui-store";

loadEngine();

describe("the intro", () => {
    beforeEach(() => {
        window.localStorage.clear();
        clearHero();
        window.location.hash = "";
        setUi({ overlay: null, tour: null });
    });

    it("pages through the overview and begins at the hero's door with the tour", async () => {
        createHero({ name: "Mira", role: "wanderer", look: 0 });
        setPrefs({ introSeen: false });
        render(<Intro />);
        await act(async () => { setUi({ overlay: "intro" }); });
        expect(screen.getByRole("heading", { name: /filesystem/i })).toBeInTheDocument();
        await act(async () => { screen.getByRole("button", { name: "Next" }).click(); });
        expect(screen.getByRole("heading", { name: /Spells, quests and loot/ })).toBeInTheDocument();
        await act(async () => { fireEvent.keyDown(document, { key: "ArrowRight" }); });
        expect(screen.getByRole("heading", { name: /Four doors/ })).toBeInTheDocument();
        expect(screen.getByRole("dialog", { name: "How to play" })).toHaveTextContent("As a Wanderer you start in the Story");
        await act(async () => { screen.getByRole("button", { name: "Begin" }).click(); });
        expect(getPrefs().introSeen).toBe(true);
        expect(getUi().overlay).toBeNull();
        expect(window.location.hash).toBe("#/story");
        expect(getUi().tour).toBe(0);
    });

    it("without a hero it ends in creation", async () => {
        render(<Intro />);
        await act(async () => { setUi({ overlay: "intro" }); });
        await act(async () => { screen.getByRole("button", { name: "Skip intro" }).click(); });
        expect(getUi().overlay).toBe("create");
        expect(getPrefs().introSeen).toBe(true);
    });
});
