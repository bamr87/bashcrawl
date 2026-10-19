import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GameStore } from "../engine/game-store";
import { dataLoader, loadEngine } from "../test/engine";
import { Pager } from "./Pager";
import { getPrompt } from "./prompt-store";

loadEngine();

describe("Pager", () => {
    it("shows less as formatted prose and casts a clicked command", async () => {
        window.localStorage.clear();
        const store = new GameStore();
        await store.boot(dataLoader);
        render(<Pager store={store} />);
        act(() => {
            store.execute("less scroll");
        });
        const dialog = await screen.findByRole("dialog");
        expect(dialog.querySelector(".sc-h1")?.textContent).toMatch(/ANCIENT SCROLL OF SIGHT/);
        expect(dialog.textContent).toContain("$ cat scroll");
        fireEvent.click(dialog.querySelector('[data-fill="cd cellar"]') as HTMLElement);
        expect(getPrompt().value).toBe("cd cellar");
        expect(store.snap.get().page).toBeNull();
    });
});
