import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it } from "vitest";

import { GameStore } from "../engine/game-store";
import { dataLoader, loadEngine } from "../test/engine";
import { TerminalLog } from "./TerminalLog";

loadEngine();

describe("TerminalLog", () => {
    it("is a live log the store paints into, once, even under StrictMode", async () => {
        window.localStorage.clear();
        const store = new GameStore();
        await store.boot(dataLoader);
        const { container, unmount } = render(
            <StrictMode>
                <TerminalLog store={store} label="Dungeon log" />
            </StrictMode>,
        );
        const pre = container.querySelector("pre");
        expect(pre).toHaveAttribute("role", "log");
        expect(pre).toHaveAttribute("aria-live", "polite");
        expect(pre).toHaveAccessibleName("Dungeon log");
        expect(pre?.textContent?.split("Welcome to Bashcrawl.").length).toBe(2);
        store.execute("pwd");
        expect(pre?.textContent?.split("/entrance $ pwd").length).toBe(2);
        unmount();
        store.execute("ls");
        expect(pre?.textContent).not.toContain("/entrance $ ls");
    });
});
