import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GameStore } from "../engine/game-store";
import { dataLoader, loadEngine } from "../test/engine";
import { getPrompt, setPromptValue } from "../terminal/prompt-store";
import { DocsDrawer } from "./DocsDrawer";
import { getUi, setUi } from "./ui-store";

loadEngine();

describe("the docs drawer", () => {
    it("opens, follows the game's room and quest, and a command button fills the prompt", async () => {
        window.localStorage.clear();
        setPromptValue("");
        const store = new GameStore();
        await store.boot(dataLoader);
        render(<DocsDrawer store={store} />);
        expect(screen.queryByRole("complementary", { name: "Bashcrawl documentation" })).toBeNull();

        await act(async () => { setUi({ docsOpen: true }); });
        const drawer = screen.getByRole("complementary", { name: "Bashcrawl documentation" });
        expect(drawer).toHaveTextContent("THE ENTRANCE HALL");
        expect(drawer).toHaveTextContent("Awakening: Know Thy Place");
        expect(screen.getByRole("searchbox", { name: "Search the documentation" })).toHaveFocus();

        await act(async () => { store.execute("cd cellar"); });
        expect(drawer).toHaveTextContent("THE CELLAR");

        const button = screen.getAllByRole("button", { name: /^ls/ })[0];
        await act(async () => { button.click(); });
        expect(getPrompt().value).toBe("ls");
        expect(getUi().docsOpen).toBe(false);
    });
});
