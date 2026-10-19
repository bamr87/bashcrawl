// Colour mode (UPS-FE-06): a `dark | light | auto` preference persisted
// under the key the previous UI used, applied as data-theme on <html>, with
// the effective scheme mirrored in data-resolved so tokens.css writes its
// light block once. index.html repeats the resolution inline before first
// paint so there is no flash; this store takes over from there.
import { createStore, useStore } from "../lib/store";
import { readRaw, writeRaw } from "../lib/storage";

export type ThemePref = "dark" | "light" | "auto";
export type Scheme = "dark" | "light";

export const THEME_KEY = "bashcrawl-web-theme";
const ORDER: ThemePref[] = ["dark", "light", "auto"];
const LIGHT_QUERY = "(prefers-color-scheme: light)";

function isPref(value: unknown): value is ThemePref {
    return value === "dark" || value === "light" || value === "auto";
}

function media(): MediaQueryList | null {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(LIGHT_QUERY) : null;
}

export function resolveScheme(pref: ThemePref): Scheme {
    if (pref !== "auto") return pref;
    const query = media();
    return query && query.matches ? "light" : "dark";
}

function readPref(): ThemePref {
    const raw = readRaw(THEME_KEY);
    return isPref(raw) ? raw : "dark";
}

export interface ThemeState {
    pref: ThemePref;
    resolved: Scheme;
}

const store = createStore<ThemeState>({ pref: "dark", resolved: "dark" });

function apply(pref: ThemePref): void {
    const resolved = resolveScheme(pref);
    const root = document.documentElement;
    root.setAttribute("data-theme", pref);
    root.setAttribute("data-resolved", resolved);
    store.set({ pref, resolved });
}

let booted = false;
export function initTheme(): void {
    if (booted) return;
    booted = true;
    apply(readPref());
    const query = media();
    if (query) {
        const onChange = () => { if (store.get().pref === "auto") apply("auto"); };
        if (typeof query.addEventListener === "function") query.addEventListener("change", onChange);
    }
}

export function setTheme(pref: ThemePref): void {
    writeRaw(THEME_KEY, pref);
    apply(pref);
}

export function cycleTheme(): ThemePref {
    const current = store.get().pref;
    const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
    setTheme(next);
    return next;
}

export function getTheme(): ThemeState {
    return store.get();
}

export function useTheme(): ThemeState {
    return useStore(store);
}

export const THEME_LABELS: Record<ThemePref, string> = { dark: "Dark", light: "Light", auto: "Auto" };
