// Vitest setup: jest-dom matchers plus the browser APIs jsdom lacks that the
// app touches at module load (matchMedia for the theme and motion, a
// ResizeObserver, scrollTo). The engine loader (the classic game scripts
// evaluated into jsdom's window) is imported by the tests that need it.
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only auto-registers its cleanup when `afterEach` is a
// global; vitest globals are off here, so unmount after every test ourselves.
afterEach(() => cleanup());

if (typeof window !== "undefined") {
    if (typeof window.matchMedia !== "function") {
        window.matchMedia = (query: string): MediaQueryList => ({
            matches: false,
            media: query,
            onchange: null,
            addEventListener() {},
            removeEventListener() {},
            addListener() {},
            removeListener() {},
            dispatchEvent() { return false; },
        });
    }
    if (typeof window.ResizeObserver !== "function") {
        class ResizeObserverStub {
            observe() {}
            unobserve() {}
            disconnect() {}
        }
        window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    }
    if (typeof window.scrollTo !== "function") {
        window.scrollTo = () => {};
    }
    if (typeof Element.prototype.scrollIntoView !== "function") {
        Element.prototype.scrollIntoView = () => {};
    }
}
