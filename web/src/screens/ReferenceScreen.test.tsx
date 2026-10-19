import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GameStore } from "../engine/game-store";
import { dataLoader, loadEngine } from "../test/engine";
import { getPrompt, setPromptValue } from "../terminal/prompt-store";
import { ReferenceScreen } from "./ReferenceScreen";

loadEngine();

describe("the reference", () => {
    it("searches, filters by category, and ▶ drops a command into the Story prompt", async () => {
        window.localStorage.clear();
        setPromptValue("");
        window.location.hash = "#/reference";
        const store = new GameStore();
        await store.boot(dataLoader);
        const { container } = render(<ReferenceScreen store={store} />);
        expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "true");
        const before = container.querySelectorAll(".bc-ref-table tr").length;
        expect(before).toBeGreaterThan(20);

        const search = screen.getByRole("searchbox", { name: "Search the reference" });
        await act(async () => {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
            setter?.call(search, "grep");
            search.dispatchEvent(new Event("input", { bubbles: true }));
        });
        const after = container.querySelectorAll(".bc-ref-table tr").length;
        expect(after).toBeGreaterThan(0);
        expect(after).toBeLessThan(before);
        expect(container).toHaveTextContent(/grep/);

        const tryButton = container.querySelector<HTMLButtonElement>('.bc-ref-try[aria-label^="Try cat"]') ?? container.querySelector<HTMLButtonElement>(".bc-ref-try");
        const label = tryButton?.getAttribute("aria-label") ?? "";
        await act(async () => { tryButton?.click(); });
        expect(window.location.hash).toBe("#/story");
        const filled = getPrompt().value;
        expect(filled.length).toBeGreaterThan(0);
        expect(filled).not.toMatch(/<[^>]+>/);
        expect(label).toContain(filled.trim().split(" ")[0]);
    });
});
