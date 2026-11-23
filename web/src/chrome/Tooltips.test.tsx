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

    it("stays quiet when a control arrives under a pointer that has not moved since its click", async () => {
        vi.useFakeTimers();
        render(
            <>
                <Tooltips />
                <button type="button" title="100 XP to the next rank">XP</button>
            </>,
        );
        const xp = screen.getByRole("button", { name: "XP" });
        // A click elsewhere changed the screen; this control is now under the pointer.
        await act(async () => { fireEvent.pointerDown(document.body); fireEvent.pointerOver(xp); });
        await act(async () => { vi.advanceTimersByTime(1500); });
        expect(screen.queryByRole("tooltip")).toBeNull();
        // Once the pointer really moves over it, it is being pointed at.
        await act(async () => { fireEvent.pointerMove(xp); });
        await act(async () => { vi.advanceTimersByTime(400); });
        expect(screen.getByRole("tooltip")).toHaveTextContent("100 XP to the next rank");
    });
});
