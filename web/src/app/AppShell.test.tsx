import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell, BOTTOM_CHROME_VAR } from "./AppShell";

function rectOfHeight(height: number): DOMRect {
    return { x: 0, y: 0, top: 0, left: 0, right: 360, bottom: height, width: 360, height, toJSON: () => ({}) } as DOMRect;
}

afterEach(() => vi.restoreAllMocks());

describe("the app shell's bottom edge", () => {
    it("publishes the dock + footer height for the feedback button to clear, and withdraws it on unmount", () => {
        // jsdom lays nothing out: give the dock and the footer the heights they have at 360 px.
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
            if (this.classList.contains("bc-dock-slot")) return rectOfHeight(86);
            if (this.classList.contains("bc-footer")) return rectOfHeight(33.4);
            return rectOfHeight(0);
        });
        const { unmount } = render(<AppShell mode="story" dock={<div className="bc-dock">prompt</div>}>stage</AppShell>);
        expect(document.documentElement.style.getPropertyValue(BOTTOM_CHROME_VAR)).toBe("120px");
        unmount();
        expect(document.documentElement.style.getPropertyValue(BOTTOM_CHROME_VAR)).toBe("");
    });
});
