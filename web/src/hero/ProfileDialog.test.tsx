import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { getUi, setUi } from "../chrome/ui-store";
import { GameStore } from "../engine/game-store";
import { dataLoader, loadEngine } from "../test/engine";
import { clearHero, createHero, getHero } from "./hero-store";
import { ProfileDialog } from "./ProfileDialog";

loadEngine();

describe("the hero profile", () => {
    beforeEach(() => {
        window.localStorage.clear();
        clearHero();
        setUi({ overlay: null, tour: null });
    });

    it("shows the sheet, renames, changes the look, and starts a new game after a confirm", async () => {
        createHero({ name: "Mira", role: "scribe", look: 1 });
        const store = new GameStore();
        await store.boot(dataLoader);
        store.execute("pwd");
        expect(store.model("statusModel").xp).toBeGreaterThan(0);
        render(<ProfileDialog store={store} />);
        await act(async () => { setUi({ overlay: "profile" }); });
        const dialog = await screen.findByRole("dialog", { name: "Hero" });
        expect(dialog).toHaveTextContent("Mira");
        expect(dialog).toHaveTextContent("Scribe");
        expect(dialog).toHaveTextContent("Spells cast");
        expect(dialog).toHaveTextContent("Rooms found");

        await act(async () => { screen.getByRole("button", { name: "Rename" }).click(); });
        const input = screen.getByLabelText("New name");
        await act(async () => { fireEvent.change(input, { target: { value: "Mira the Bold" } }); });
        await act(async () => { fireEvent.submit(input.closest("form") as HTMLFormElement); });
        expect(getHero()?.name).toBe("Mira the Bold");
        expect(dialog).toHaveTextContent("Mira the Bold");

        await act(async () => { screen.getByRole("radio", { name: "Ember" }).click(); });
        expect(getHero()?.look).toBe(3);

        await act(async () => { screen.getByRole("button", { name: "New game…" }).click(); });
        await act(async () => { screen.getByRole("button", { name: "Yes, start over" }).click(); });
        expect(getHero()).toBeNull();
        expect(store.model("statusModel").xp).toBe(0);
        expect(getUi().overlay).toBe("create");
    });
});
