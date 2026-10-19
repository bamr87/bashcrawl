import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Tooltips } from "./Tooltips";

describe("tooltips", () => {
    afterEach(() => vi.useRealTimers());

    it("replaces a title with a styled bubble after a delay, at once on focus, and hides on Escape", async () => {
        vi.useFakeTimers();
        render(
            <>
                <Tooltips />
                <button type="button" title="Open the journal">Journal</button>
                <button type="button" title="Options">⚙</button>
            </>,
        );
        const journal = screen.getByRole("button", { name: "Journal" });
        await act(async () => { fireEvent.pointerOver(journal); });
        expect(screen.queryByRole("tooltip")).toBeNull();
        expect(journal).not.toHaveAttribute("title");
        expect(journal).toHaveAttribute("data-tip", "Open the journal");
        expect(journal).toHaveAttribute("aria-description", "Open the journal");
        await act(async () => { vi.advanceTimersByTime(400); });
        expect(screen.getByRole("tooltip")).toHaveTextContent("Open the journal");

        // Warm: moving to the next tipped control shows it immediately.
        const options = screen.getByRole("button", { name: "⚙" });
        await act(async () => { fireEvent.pointerOut(journal, { relatedTarget: options }); fireEvent.pointerOver(options); });
        expect(screen.getByRole("tooltip")).toHaveTextContent("Options");
        await act(async () => { fireEvent.keyDown(document, { key: "Escape" }); });
        expect(screen.queryByRole("tooltip")).toBeNull();

        await act(async () => { vi.advanceTimersByTime(600); fireEvent.focusIn(journal); });
        expect(screen.getByRole("tooltip")).toHaveTextContent("Open the journal");
        await act(async () => { fireEvent.focusOut(journal); });
        expect(screen.queryByRole("tooltip")).toBeNull();
    });
});
