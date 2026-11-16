import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { GameStore } from "../engine/game-store";
import { dataLoader, loadEngine } from "../test/engine";
import type { InputTarget } from "./input-target";
import { PromptBar } from "./PromptBar";
import { compactLabel, shortLabel } from "./prompt-label";
import { fillPrompt, setPromptValue } from "./prompt-store";

loadEngine();

const DEEP = "/entrance/chapel/courtyard/aviary/hall/library/.study";

async function bootedStore(): Promise<GameStore> {
    window.localStorage.clear();
    setPromptValue("");
    const store = new GameStore();
    await store.boot(dataLoader);
    return store;
}

function stubTarget(label: string): InputTarget {
    return {
        id: "stub",
        execute: () => undefined,
        acceptsEmpty: () => false,
        historyStep: () => null,
        complete: () => null,
        clearLog: () => undefined,
        promptLabel: () => label,
        placeholder: () => "",
    };
}

describe("PromptBar", () => {
    it("shortens a path label to the room's name", () => {
        expect(shortLabel("/entrance/cellar $")).toBe("cellar $");
        expect(shortLabel("/entrance $")).toBe("entrance $");
        expect(shortLabel("arcade ▸")).toBe("arcade ▸");
    });

    // The wide-screen label shortens from the left, like bash's
    // PROMPT_DIRTRIM, so the room you are in is never the part clipped (#112).
    it.each([
        ["/entrance $", "~ $"],
        ["/entrance/cellar $", "~/cellar $"],
        ["/entrance/chapel/courtyard/aviary $", "~/chapel/courtyard/aviary $"],
        [`${DEEP} $`, "~/chapel/…/.study $"],
        ["/graveyard/a/b/c/d $", "/graveyard/…/d $"],
        ["arcade ▸", "arcade ▸"],
    ])("compacts %s to %s", (input, output) => {
        expect(compactLabel(input)).toBe(output);
    });

    it("keeps /entrance only as a whole segment and leaves the suffix alone", () => {
        expect(compactLabel("/entrancehall/a $")).toBe("/entrancehall/a $");
        expect(compactLabel("/ $")).toBe("/ $");
        expect(compactLabel("/entrance/cellar ⚔")).toBe("~/cellar ⚔");
        expect(compactLabel("seek The Study [3] ❯")).toBe("seek The Study [3] ❯");
    });

    it("shows the compact label on wide screens and the full path in the tooltip", () => {
        const label = `${DEEP} $`;
        const { container } = render(<PromptBar target={stubTarget(label)} label={label} placeholder="" />);
        expect(container.querySelector(".bc-prompt-full")?.textContent).toBe("~/chapel/…/.study $");
        expect(container.querySelector(".bc-prompt-short")?.textContent).toBe(".study $");
        expect(container.querySelector(".bc-prompt-label")).toHaveAttribute("title", `Full path: ${DEEP}`);
    });

    it("runs on Enter, recalls history, completes on Tab and clears on Ctrl+L", async () => {
        const store = await bootedStore();
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
