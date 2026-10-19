import { act, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { getUi, setUi } from "../chrome/ui-store";
import { GameStore } from "../engine/game-store";
import { clearHero, createHero } from "../hero/hero-store";
import { getPrompt, setPromptValue } from "../terminal/prompt-store";
import { dataLoader, loadEngine } from "../test/engine";
import { Journal } from "./Journal";
import { clearDialogues } from "./dialogue-store";
import { getJournal, resetJournal } from "./journal-store";
import { installStory } from "./story";

loadEngine();

describe("the journal", () => {
    beforeEach(() => {
        window.localStorage.clear();
        clearHero();
        createHero({ name: "Mira", role: "scribe" });
        resetJournal();
        clearDialogues();
        setPromptValue("");
        setUi({ overlay: null, tour: null });
    });

    it("shows the chronicle, quests, lore, bestiary and badges, and brings a scroll back", async () => {
        const store = new GameStore();
        await store.boot(dataLoader);
        const off = installStory(store);
        store.execute("pwd");
        store.execute("cat scroll");
        render(<Journal store={store} />);
        await act(async () => { setUi({ overlay: "journal" }); });
        const dialog = await screen.findByRole("dialog", { name: "Journal" });
        expect(within(dialog).getByRole("tab", { name: "Chronicle", selected: true })).toBeInTheDocument();
        expect(dialog).toHaveTextContent("The Descent Begins");
        expect(dialog).toHaveTextContent("Mira");
        expect(dialog).toHaveTextContent("Know Thy Place");
        expect(dialog).toHaveTextContent("Not yet written.");

        await act(async () => { within(dialog).getByRole("tab", { name: "Quests" }).click(); });
        expect(dialog).toHaveTextContent("1/8 main quests");
        expect(dialog).toHaveTextContent("Eyes to See");
        expect(dialog).toHaveTextContent("The Hidden Chapel");

        await act(async () => { within(dialog).getByRole("tab", { name: "Lore" }).click(); });
        expect(dialog).toHaveTextContent("ANCIENT SCROLL OF SIGHT");
        await act(async () => { within(dialog).getByRole("button", { name: "Read again" }).click(); });
        expect(getUi().overlay).toBeNull();
        expect(getPrompt().value).toBe("cat /entrance/scroll");

        await act(async () => { setUi({ overlay: "journal" }); });
        const again = await screen.findByRole("dialog", { name: "Journal" });
        await act(async () => { within(again).getByRole("tab", { name: "Bestiary" }).click(); });
        expect(again).toHaveTextContent("0/11 encounters");
        await act(async () => { within(again).getByRole("tab", { name: "Badges" }).click(); });
        expect(again).toHaveTextContent("First Steps");
        await act(async () => { within(again).getByRole("button", { name: "Close Journal" }).click(); });
        expect(getJournal().readAt).not.toBeNull();
        off();
    });
});
