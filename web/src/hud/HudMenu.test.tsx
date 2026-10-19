import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getUi, setUi } from "../chrome/ui-store";
import { GameStore } from "../engine/game-store";
import { dataLoader, loadEngine } from "../test/engine";
import { HudMenu } from "./HudMenu";

loadEngine();

describe("HudMenu", () => {
    it("hides, docks and resets the layout, persisting under the HUD key", async () => {
        window.localStorage.clear();
        const store = new GameStore();
        await store.boot(dataLoader);
        render(<HudMenu store={store} />);
        await act(async () => { setUi({ hudOpen: true }); });
        expect(screen.getByRole("dialog", { name: "Panels" })).toBeInTheDocument();

        await act(async () => { screen.getByRole("checkbox", { name: /Map/ }).click(); });
        expect(store.layout().panes.find((p) => p.id === "map")?.visible).toBe(false);

        await act(async () => { screen.getByRole("button", { name: "Dock right" }).click(); });
        expect(store.layout().dock).toBe("right");
        expect(JSON.parse(window.localStorage.getItem("bashcrawl-hud-layout-v1") ?? "{}")).toMatchObject({ dock: "right" });

        await act(async () => { screen.getByRole("button", { name: "Move Location up" }).click(); });
        expect(store.layout().panes.map((p) => p.id).slice(0, 2)).toEqual(["room", "quest"]);

        await act(async () => { screen.getByRole("button", { name: "Reset layout" }).click(); });
        expect(store.layout().dock).toBe("left");
        expect(store.layout().panes.map((p) => p.id).slice(0, 2)).toEqual(["quest", "room"]);
        expect(store.layout().panes.find((p) => p.id === "map")?.visible).toBe(true);
        expect(store.layout().panes.find((p) => p.id === "hero")?.collapsed).toBe(true);

        // The dialog leaves through an exit animation; the state closes at once.
        await act(async () => { screen.getByRole("button", { name: "Close Panels" }).click(); });
        expect(getUi().hudOpen).toBe(false);
    });
});
