import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { GameStore } from "../engine/game-store";
import { dataLoader, loadEngine } from "../test/engine";
import { PromptBar } from "./PromptBar";
import { shortLabel } from "./prompt-label";
import { fillPrompt, setPromptValue } from "./prompt-store";

loadEngine();

describe("PromptBar", () => {
    it("shortens a path label to the room's name", () => {
        expect(shortLabel("/entrance/cellar $")).toBe("cellar $");
        expect(shortLabel("/entrance $")).toBe("entrance $");
        expect(shortLabel("arcade ▸")).toBe("arcade ▸");
    });

    it("runs on Enter, recalls history, completes on Tab and clears on Ctrl+L", async () => {
        window.localStorage.clear();
        setPromptValue("");
        const store = new GameStore();
        await store.boot(dataLoader);
        const user = userEvent.setup();
        render(<PromptBar target={store} label={store.promptLabel()} placeholder="e.g. pwd" />);
        const input = screen.getByRole("textbox", { name: "Command" });
        expect(input).toHaveAttribute("placeholder", "e.g. pwd");

        await user.click(input);
        await user.keyboard("pwd{Enter}");
        expect(input).toHaveValue("");
        expect(store.model("statusModel").questsDone).toBe(1);

        await user.keyboard("{Enter}");
        expect(store.view?.lines.at(-1)?.text).not.toBe("/entrance $ ");

        await user.keyboard("{ArrowUp}");
        expect(input).toHaveValue("pwd");
        await user.clear(input);
        await user.keyboard("cd ce{Tab}");
        expect(input).toHaveValue("cd cellar");

        // Filled from outside React (a chip, the reference's ▶): value and focus.
        await act(async () => { fillPrompt("ls -F"); });
        expect(input).toHaveValue("ls -F");
        expect(input).toHaveFocus();

        await user.keyboard("{Control>}l{/Control}");
        expect(store.view?.lines).toEqual([]);
    });
});
