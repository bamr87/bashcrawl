import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { loadEngine } from "../test/engine";
import { GameMenu } from "./GameMenu";
import { getUi, setUi } from "./ui-store";

loadEngine();

describe("the pause menu", () => {
    beforeEach(() => setUi({ overlay: null, tour: null }));

    it("lists the game's menu, moves with the arrows, opens the journal, and Escape resumes", async () => {
        render(<GameMenu />);
        await act(async () => { setUi({ overlay: "menu" }); });
        const items = screen.getAllByRole("menuitem");
        expect(items.map((item) => item.textContent)).toEqual(expect.arrayContaining([
            expect.stringContaining("Continue"), expect.stringContaining("Journal"), expect.stringContaining("Hero"),
            expect.stringContaining("Options"), expect.stringContaining("Title screen"),
        ]));
        expect(items[0]).toHaveFocus();
        await act(async () => { fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" }); });
        expect(items[1]).toHaveFocus();
        await act(async () => { items[1]?.click(); });
        expect(getUi().overlay).toBe("journal");

        await act(async () => { setUi({ overlay: "menu" }); });
        await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
        expect(getUi().overlay).toBeNull();
    });
});
