// The retro CRT overlay (scanlines, vignette, phosphor glow), off by
// default, remembered under the key the previous UI used.
import { createStore, useStore } from "../lib/store";
import { readRaw, writeRaw } from "../lib/storage";

export const CRT_KEY = "bashcrawl-web-crt";

const store = createStore<{ on: boolean }>({ on: false });

function apply(on: boolean): void {
    document.documentElement.setAttribute("data-crt", on ? "on" : "off");
    store.set({ on });
}

let booted = false;
export function initCrt(): void {
    if (booted) return;
    booted = true;
    apply(readRaw(CRT_KEY) === "on");
}

export function setCrt(on: boolean): void {
    writeRaw(CRT_KEY, on ? "on" : "off");
    apply(on);
}

export function useCrt(): { on: boolean } {
    return useStore(store);
}
