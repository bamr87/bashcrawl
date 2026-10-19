import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { setSettings } from "../chrome/settings-store";
import { setUi } from "../chrome/ui-store";
import { clearHero, createHero } from "../hero/hero-store";
import { loadEngine } from "../test/engine";
import { clearDialogues, getDialogue, pushDialogue } from "./dialogue-store";
import { StoryDialogue } from "./StoryDialogue";

loadEngine();

describe("the dialogue box", () => {
    beforeEach(() => {
        window.localStorage.clear();
        clearHero();
        createHero({ name: "Mira", role: "wanderer" });
        clearDialogues();
        setUi({ overlay: null, tour: null });
        setSettings({ textSpeed: "instant" });
    });

    it("tells a chapter page by page, queues the next, and waits while an overlay is up", async () => {
        render(<StoryDialogue />);
        await act(async () => {
            pushDialogue({ id: "a", kicker: "Prologue", title: "The Descent Begins", pages: ["One.", "Two."] });
            pushDialogue({ id: "b", kicker: "Chapter I", title: "Know Thy Place", pages: ["Three."] });
        });
        const box = screen.getByRole("dialog", { name: "Prologue: The Descent Begins" });
        expect(box).toHaveTextContent("One.");
        expect(box).toHaveTextContent("1 / 2 · 1 more");
        await act(async () => { screen.getByRole("button", { name: "Continue ▸" }).click(); });
        expect(screen.getByRole("dialog", { name: /Descent/ })).toHaveTextContent("Two.");
        await act(async () => { screen.getByRole("button", { name: "Close" }).click(); });
        expect(getDialogue().current?.id).toBe("b");
        expect(screen.getByRole("dialog", { name: "Chapter I: Know Thy Place" })).toHaveTextContent("Three.");

        await act(async () => { setUi({ overlay: "journal" }); });
        expect(screen.queryByRole("dialog", { name: /Know Thy Place/ })).toBeNull();
        await act(async () => { setUi({ overlay: null }); });
        expect(screen.getByRole("dialog", { name: /Know Thy Place/ })).toBeInTheDocument();
        await act(async () => { fireEvent.keyDown(document, { key: "Escape" }); });
        expect(getDialogue().current).toBeNull();
    });
});
